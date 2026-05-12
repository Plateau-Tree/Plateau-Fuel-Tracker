import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import * as XLSX from "xlsx";
// xlsx-js-style is an API-compatible fork of xlsx that supports cell styling
// (fills, fonts, borders). Used only by the reconciliation export so the
// other xlsx exports stay on the lighter stock library.
import * as XLSXStyle from "xlsx-js-style";
import { createClient } from "@supabase/supabase-js";

// ─── Supabase setup ─────────────────────────────────────────────────────────
// createClient connects your app to your Supabase database.
// SUPABASE_URL = your project's web address (where the database lives)
// SUPABASE_ANON_KEY = a public key that lets your app talk to the database
// These are safe to have in frontend code — Row Level Security on the database
// controls what users can actually do.
const SUPABASE_URL = "https://gevlhzzlivsiyxaysskv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdldmxoenpsaXZzaXl4YXlzc2t2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMTE0NTMsImV4cCI6MjA4OTg4NzQ1M30.sWHGjuS5vuUapuGQRqmGeH1qE3iW9gfg8AyAlY86gRg";
const supabase = (SUPABASE_URL !== "YOUR_SUPABASE_URL" && SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY")
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// ─── Supabase helper functions ──────────────────────────────────────────────
// These functions handle reading/writing to the cloud database.
// "upsert" means "insert or update" — if the row exists, update it; if not, create it.
// This prevents duplicate entries if the same data is saved twice.
const db = {
  // Fetch all fuel entries from the database, sorted newest first
  async loadEntries() {
    if (!supabase) return null;
    const { data, error } = await supabase.from("fuel_entries").select("*").order("created_at", { ascending: false });
    if (error) { console.error("DB loadEntries:", error); return null; }
    // Convert database column names (snake_case) back to app format (camelCase)
    return data.map(row => {
      const meta = row.metadata || {};
      return {
        id: row.id,
        driver: row.driver,
        driverName: row.driver,
        registration: row.registration,
        date: row.date,
        station: row.station,
        fuelType: row.fuel_type,
        litres: row.litres ? Number(row.litres) : null,
        totalCost: row.total_cost ? Number(row.total_cost) : null,
        pricePerLitre: row.price_per_litre ? Number(row.price_per_litre) : null,
        odometer: row.odometer ? Number(row.odometer) : null,
        division: row.division,
        vehicleType: row.vehicle_type,
        cardNumber: row.card_number,
        fleetCardNumber: row.card_number,
        vehicleOnCard: row.vehicle_on_card,
        cardRego: row.vehicle_on_card,
        discounts: row.discounts ? Number(row.discounts) : null,
        handwrittenNotes: row.handwritten_notes,
        lines: row.lines || [],
        otherItems: row.other_items || [],
        flags: row.flags || [],
        splitGroup: row.split_group,
        splitIndex: row.split_index,
        // Extra fields from metadata
        entryType: meta.entryType || null,
        equipment: meta.equipment || null,
        fleetCardVehicle: meta.fleetCardVehicle || null,
        fleetCardDriver: meta.fleetCardDriver || null,
        vehicleName: meta.vehicleName || null,
        splitReceipt: meta.splitReceipt || false,
        hasReceipt: meta.hasReceipt || false,
        _aiConfidence: meta._aiConfidence || null,
        _aiIssues: meta._aiIssues || [],
        _cardConfidence: meta._cardConfidence || null,
        _cardMatchConfidence: meta._cardMatchConfidence || null,
        _cardCorrected: meta._cardCorrected || false,
        _cardConfusable: meta._cardConfusable || null,
        _cardOriginalCard: meta._cardOriginalCard || null,
        _cardOriginalRego: meta._cardOriginalRego || null,
        _cardRawRead: meta._cardRawRead || null,
        _cardAiIssues: meta._cardAiIssues || null,
        // Auto-reconcile bookkeeping — present only on entries synthesised
        // by the FleetCard CSV import (AUTO_RECONCILE_DRIVERS path). Lets
        // the Data tab spot which rows were never lodged manually.
        _autoCreated: meta._autoCreated || false,
        _autoCreatedFrom: meta._autoCreatedFrom || null,
        _autoCreatedFromTxn: meta._autoCreatedFromTxn || null,
        _autoCreatedAt: meta._autoCreatedAt || null,
        // Driver-name resolution (alias / nickname / typo) suggestion —
        // attached at submission time, surfaced as an admin flag.
        _driverNameResolution: meta._driverNameResolution || null,
        receiptUrl: meta.receiptUrl || null,
        linkedVehicle: meta.linkedVehicle || null,
      };
    });
  },

  // Save one fuel entry to the database
  async saveEntry(entry) {
    if (!supabase) return;
    const { error } = await supabase.from("fuel_entries").upsert({
      id: entry.id,
      driver: entry.driverName || entry.driver,
      registration: entry.registration,
      date: entry.date,
      station: entry.station,
      fuel_type: entry.fuelType,
      litres: entry.litres,
      total_cost: entry.totalCost,
      price_per_litre: entry.pricePerLitre,
      odometer: entry.odometer,
      division: entry.division,
      vehicle_type: entry.vehicleType,
      card_number: entry.fleetCardNumber || entry.cardNumber,
      vehicle_on_card: entry.cardRego || entry.vehicleOnCard,
      discounts: entry.discounts,
      handwritten_notes: entry.handwrittenNotes,
      lines: entry.lines || [],
      other_items: entry.otherItems || [],
      flags: entry.flags || [],
      split_group: entry.splitGroup,
      split_index: entry.splitIndex,
      metadata: {
        entryType: entry.entryType || null,
        equipment: entry.equipment || null,
        fleetCardVehicle: entry.fleetCardVehicle || null,
        fleetCardDriver: entry.fleetCardDriver || null,
        vehicleName: entry.vehicleName || null,
        splitReceipt: entry.splitReceipt || false,
        hasReceipt: entry.hasReceipt || false,
        _aiConfidence: entry._aiConfidence || null,
        _aiIssues: entry._aiIssues || [],
        _cardConfidence: entry._cardConfidence || null,
        _cardMatchConfidence: entry._cardMatchConfidence || null,
        _cardCorrected: entry._cardCorrected || false,
        _cardConfusable: entry._cardConfusable || null,
        _cardOriginalCard: entry._cardOriginalCard || null,
        _cardOriginalRego: entry._cardOriginalRego || null,
        _cardRawRead: entry._cardRawRead || null,
        _cardAiIssues: entry._cardAiIssues || null,
        _autoCreated: entry._autoCreated || false,
        _autoCreatedFrom: entry._autoCreatedFrom || null,
        _autoCreatedFromTxn: entry._autoCreatedFromTxn || null,
        _autoCreatedAt: entry._autoCreatedAt || null,
        _driverNameResolution: entry._driverNameResolution || null,
        receiptUrl: entry.receiptUrl || null,
        linkedVehicle: entry.linkedVehicle || null,
      },
    });
    if (error) console.error("DB saveEntry:", error);
  },

  // Delete a fuel entry from the database
  async deleteEntry(id) {
    if (!supabase) return;
    const { error } = await supabase.from("fuel_entries").delete().eq("id", id);
    if (error) console.error("DB deleteEntry:", error);
  },

  // Load all service data from the database
  async loadServiceData() {
    if (!supabase) return null;
    const { data, error } = await supabase.from("service_data").select("*");
    if (error) { console.error("DB loadServiceData:", error); return null; }
    // Convert array of rows into an object keyed by registration
    const result = {};
    data.forEach(row => {
      result[row.registration] = {
        lastServiceDate: row.last_service_date,
        lastServiceOdometer: row.last_service_odometer ? Number(row.last_service_odometer) : null,
        serviceIntervalKm: row.service_interval_km ? Number(row.service_interval_km) : null,
        nextServiceDue: row.next_service_due,
        notes: row.notes,
      };
    });
    return result;
  },

  // Save service data for one vehicle
  async saveServiceData(rego, data) {
    if (!supabase) return;
    const { error } = await supabase.from("service_data").upsert({
      registration: rego,
      last_service_date: data.lastServiceDate,
      last_service_odometer: data.lastServiceOdometer,
      service_interval_km: data.serviceIntervalKm,
      next_service_due: data.nextServiceDue,
      notes: data.notes,
    });
    if (error) console.error("DB saveServiceData:", error);
  },

  // Load all resolved flags
  async loadResolvedFlags() {
    if (!supabase) return null;
    const { data, error } = await supabase.from("resolved_flags").select("*");
    if (error) { console.error("DB loadResolvedFlags:", error); return null; }
    const result = {};
    data.forEach(row => {
      result[row.id] = { by: row.resolved_by, note: row.note, at: row.resolved_at };
    });
    return result;
  },

  // Save a resolved flag
  async saveResolvedFlag(flagId, flagData) {
    if (!supabase) return;
    const { error } = await supabase.from("resolved_flags").upsert({
      id: flagId,
      resolved_by: flagData.by,
      note: flagData.note,
      resolved_at: flagData.at,
    });
    if (error) console.error("DB saveResolvedFlag:", error);
  },

  // Delete a resolved flag (when un-resolving)
  async deleteResolvedFlag(flagId) {
    if (!supabase) return;
    const { error } = await supabase.from("resolved_flags").delete().eq("id", flagId);
    if (error) console.error("DB deleteResolvedFlag:", error);
  },

  // Load a shared app setting (like the API key)
  async loadSetting(key) {
    if (!supabase) return null;
    const { data, error } = await supabase.from("app_settings").select("value").eq("key", key).single();
    if (error) { if (error.code !== "PGRST116") console.error("DB loadSetting:", error); return null; }
    return data?.value || null;
  },

  // Save a shared app setting
  async saveSetting(key, value) {
    if (!supabase) return;
    const { error } = await supabase.from("app_settings").upsert({ key, value });
    if (error) console.error("DB saveSetting:", error);
  },

  // Delete a setting row entirely (vs saveSetting(key, null) which just sets
  // value=null and leaves the row taking up disk space + showing up in scans).
  // Used by the receipt-image cleanup so old `receipt_img_<id>` rows actually
  // free their storage rather than lingering as null-valued rows.
  async deleteSetting(key) {
    if (!supabase) return;
    const { error } = await supabase.from("app_settings").delete().eq("key", key);
    if (error) console.error("DB deleteSetting:", error);
  },

  // Fleet card transactions (stored as JSON in app_settings)
  async loadFleetCardTransactions() {
    const raw = await this.loadSetting("fleet_card_transactions");
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
  },
  async saveFleetCardTransactions(txns) {
    await this.saveSetting("fleet_card_transactions", JSON.stringify(txns));
  },

  // Ensure the "receipts" storage bucket exists (creates it if not)
  async ensureReceiptBucket() {
    if (!supabase) return false;
    try {
      // Try to get the bucket first
      const { data, error } = await supabase.storage.getBucket("receipts");
      if (data) return true; // Bucket already exists
      // If it doesn't exist, create it
      if (error) {
        const { error: createError } = await supabase.storage.createBucket("receipts", {
          public: true,
          fileSizeLimit: 10485760, // 10MB max per receipt image
        });
        if (createError) {
          // Not critical — app_settings table is used as primary receipt storage
          console.log("Storage bucket unavailable (using database storage instead)");
          return false;
        }
        console.log("Created 'receipts' storage bucket");
        return true;
      }
    } catch (err) {
      console.error("ensureReceiptBucket error:", err);
      return false;
    }
    return false;
  },
};

// ─── Storage compatibility layer ────────────────────────────────────────────
// localStorage acts as a fast local cache. Supabase is the cloud "source of truth".
// If Supabase is unavailable, the app still works using localStorage alone.
//
// Quota handling: browsers cap localStorage at ~5–10MB per origin. Without
// protection, a bloated cache (primarily receipt image blobs) would cause
// every subsequent set() to throw QuotaExceededError silently — swallowed by
// the .catch(()=>{}) wrappers at call sites, leaving entries.json stuck on
// the last successful write. The set() below detects quota errors and evicts
// the oldest receipt images (biggest storage consumers) until the write
// succeeds. Supabase remains the source of truth, so evicting local copies
// is safe — they'll re-load on demand.
function __evictOldestReceiptImages(targetToFree = 1) {
  const imgKeys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith("fuel_receipt_img_")) imgKeys.push(k);
  }
  // Evict in insertion order (oldest localStorage entries are typically first).
  // Without a dedicated LRU timestamp, this is a reasonable heuristic.
  let evicted = 0;
  for (const k of imgKeys) {
    if (evicted >= targetToFree) break;
    try { localStorage.removeItem(k); evicted++; } catch (_) {}
  }
  return evicted;
}
if (!window.storage) {
  window.storage = {
    async get(key) {
      const v = localStorage.getItem(key);
      return v !== null ? { value: v } : null;
    },
    async set(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch (err) {
        const isQuota = err && (err.name === "QuotaExceededError" ||
          err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
          err.code === 22 || err.code === 1014);
        if (!isQuota) throw err;
        // Quota hit — try to free space and retry up to 3 times. Evict receipt
        // images first (largest), then give up and re-throw so the caller can
        // surface a warning if it wants to.
        console.warn(`[Storage] Quota exceeded writing "${key}" — evicting oldest receipt image caches`);
        for (let attempt = 0; attempt < 3; attempt++) {
          const freed = __evictOldestReceiptImages(5);
          if (freed === 0) break; // nothing left to evict
          try { localStorage.setItem(key, value); return; } catch (_) { /* retry */ }
        }
        console.error(`[Storage] Still over quota for "${key}" after evictions — data not cached locally (Supabase remains source of truth)`);
        throw err;
      }
    },
    async delete(key) {
      localStorage.removeItem(key);
    },
  };
}

// ─── Config ────────────────────────────────────────────────────────────────
const DIVISIONS = {
  Tree: {
    label: "Tree",
    color: { bg: "#f0fdf4", text: "#15803d", border: "#86efac", accent: "#16a34a" },
    types: ["Ute", "Truck", "Excavator", "EWP", "Chipper", "Stump Grinder", "Trailer", "Other"],
  },
  Landscape: {
    label: "Landscape",
    color: { bg: "#faf5ff", text: "#7c3aed", border: "#c4b5fd", accent: "#7c3aed" },
    types: ["Hired Vehicle", "Mower", "Trailer", "Landscape Tractor", "Ute", "Truck", "Other"],
  },
};
const DIVISION_KEYS = Object.keys(DIVISIONS);
const ALL_VEHICLE_TYPES = [...new Set(DIVISION_KEYS.flatMap(d => DIVISIONS[d].types))];

const VT_COLORS = {
  Ute: { bg: "#dcfce7", text: "#15803d", border: "#86efac" },
  Truck: { bg: "#fef3c7", text: "#b45309", border: "#fcd34d" },
  Excavator: { bg: "#fee2e2", text: "#b91c1c", border: "#fca5a5" },
  EWP: { bg: "#dbeafe", text: "#1d4ed8", border: "#93c5fd" },
  Chipper: { bg: "#fce7f3", text: "#be185d", border: "#f9a8d4" },
  "Stump Grinder": { bg: "#fef9c3", text: "#a16207", border: "#facc15" },
  Trailer: { bg: "#ffedd5", text: "#c2410c", border: "#fdba74" },
  "Hired Vehicle": { bg: "#f5f3ff", text: "#6d28d9", border: "#c4b5fd" },
  Mower: { bg: "#ecfdf5", text: "#047857", border: "#6ee7b7" },
  "Landscape Tractor": { bg: "#fefce8", text: "#854d0e", border: "#fde047" },
  Other: { bg: "#f1f5f9", text: "#475569", border: "#cbd5e1" },
};

const SERVICE_INTERVAL_KM = 10000;
const SERVICE_INTERVAL_HRS = 500; // Hours-based service interval for plant/equipment
const SERVICE_WARNING_KM = 2000; // Warn at 8000km (10000 - 2000)
const SERVICE_WARNING_HRS = 50;  // Warn at 450hrs (500 - 50)

// Vehicle types that track hours instead of km
const HOURS_BASED_TYPES = new Set(["Excavator", "Stump Grinder", "Mower", "Landscape Tractor", "Chipper"]);
const isHoursBased = (vehicleType) => HOURS_BASED_TYPES.has(vehicleType);
const odoUnit = (vehicleType) => isHoursBased(vehicleType) ? "hrs" : "km";
const serviceInterval = (vehicleType) => isHoursBased(vehicleType) ? SERVICE_INTERVAL_HRS : SERVICE_INTERVAL_KM;
const serviceWarning = (vehicleType) => isHoursBased(vehicleType) ? SERVICE_WARNING_HRS : SERVICE_WARNING_KM;

// Typical fuel efficiency ranges — L/km for road vehicles, L/hr for hours-based equipment.
// `high` values were raised 4x in May 2026 (from the original mid-2024 set) because the
// previous thresholds were tuned for "normal driving" and flagged practically every loaded
// tree-care fill-up as anomalous. The current values only fire on egregious outliers —
// genuinely suspect fills (wrong vehicle / siphoning / leaks). Admin can override per-type
// in Settings → "Fuel efficiency flag thresholds"; that override is persisted to Supabase
// and synced across devices. This constant is the factory default used when no override
// has been saved.
const DEFAULT_EFFICIENCY_RANGES = {
  Ute: { low: 0.06, high: 0.72, unit: "L/km" },
  Truck: { low: 0.10, high: 1.80, unit: "L/km" },
  Excavator: { low: 4, high: 100, unit: "L/hr" },
  EWP: { low: 0.05, high: 1.20, unit: "L/km" },
  Chipper: { low: 3, high: 60, unit: "L/hr" },
  "Stump Grinder": { low: 3, high: 60, unit: "L/hr" },
  Trailer: { low: 0.06, high: 0.80, unit: "L/km" },
  "Hired Vehicle": { low: 0.04, high: 1.20, unit: "L/km" },
  Mower: { low: 2, high: 48, unit: "L/hr" },
  "Landscape Tractor": { low: 4, high: 80, unit: "L/hr" },
  Other: { low: 0.04, high: 1.60, unit: "L/km" },
};

// Helper to get division for a vehicle type
function getDivision(vehicleType) {
  for (const [div, cfg] of Object.entries(DIVISIONS)) {
    if (cfg.types.includes(vehicleType)) return div;
  }
  return "Tree";
}

// Get the full label with division prefix for landscape types that overlap with tree
function getDisplayLabel(vehicleType, division) {
  return vehicleType;
}

// ─── Utilities ─────────────────────────────────────────────────────────────

// Format fleet card number for display: "7034305110028204" → "7034 3051 1002 8204"
const formatCardNumber = (num) => {
  if (!num) return "";
  const digits = String(num).replace(/\s/g, "");
  return digits.replace(/(.{4})(?=.)/g, "$1 ");
};

// ─── Driver Fleet Card Database (from fleet card spreadsheet) ───────────
const DRIVER_CARDS = [
{n:"KYLE OSBORNE",c:"7034305113700650",r:"AP85DF"},{n:"JASON SORBARA",c:"7034305108940667",r:"AT13VE"},{n:"NAISH",c:"7034305107330928",r:"BF51KJ"},{n:"JUSTIN LEWIS",c:"7034305116558659",r:"BJ57HC"},{n:"NICK JONES",c:"7034305117074284",r:"BR22ZZ"},{n:"YARRAN/JASON HUGHES",c:"7034305116939826",r:"BT08QM"},{n:"BRENDAN RICHARDSON",c:"7034305110165261",r:"BY38KR"},{n:"LUKE BARTLEY",c:"7034305117926277",r:"CA10BL"},{n:"BILLY PRICE",c:"7034305113893588",r:"CC24TI"},{n:"GAB FITZGERALD",c:"7034305111758833",r:"CC94JL"},{n:"JOE HUTTON",c:"7034305117597540",r:"CD36PH"},{n:"SAM THOMAS",c:"7034305117902278",r:"CH90KL"},{n:"DANIEL THOMSON",c:"7034305108274448",r:"CH95ZD"},{n:"KYLE OSBORNE",c:"7034305109332146",r:"CI98BZ"},{n:"KEV CARRILLO",c:"7034305108260140",r:"CJ55FB"},{n:"DAN THOMPSON",c:"7034305107310136",r:"CL52NS"},{n:"BILLY PRICE",c:"7034305116027192",r:"CM77KG"},{n:"CHRIS PLAYER",c:"7034305117020659",r:"CN47HS"},{n:"SHAUN COLE",c:"7034305113746059",r:"CP60AF"},{n:"DENNIS KOCJANCIC",c:"7034305116296961",r:"CP06YZ"},{n:"SHANE DEMIRAL",c:"7034305112151236",r:"CT74KE"},{n:"SAXON",c:"7034305106890443",r:"CV14NO"},{n:"LAURA HARDWOOD",c:"7034305114887118",r:"CX22BE"},{n:"WATER TRUCK / MICK THOMAS",c:"7034305118302718",r:"CX23BE"},{n:"JAYDEN STRONG",c:"7034305112823891",r:"DB78SC"},{n:"KYLE OSBORNE",c:"7034305117002350",r:"DF25LB"},{n:"JACOB DEVEIGNE",c:"7034305110028204",r:"DF26LB"},{n:"ALEX GLYNN",c:"7034305112341555",r:"DI05QD"},{n:"BLOWER TRUCK",c:"7034305112809668",r:"CS63LP"},{n:"JACOB DEVEIGNE",c:"7034305117003408",r:"DP60DA"},{n:"BRETT SONTER",c:"7034305108863984",r:"DPL85C"},{n:"TIM PRICE",c:"7034305117463065",r:"DP90CQ"},{n:"JASON HUGHES",c:"7034305112129919",r:"DSU65Y"},{n:"SONYA",c:"7034305114570151",r:"EAE28V"},{n:"SAM LAW",c:"7034305118360872",r:"EBL30C"},{n:"AMELIA PLUMMER",c:"7034305115642942",r:"ECE83U"},{n:"LEE DAVIS",c:"7034305107318832",r:"EES53B"},{n:"JOE PELLIZZON",c:"7034305117257665",r:"EYO62W"},{n:"JOHN LARGEY",c:"7034305111069538",r:"EOL97X"},{n:"MARTIN HOWARD",c:"7034305113441354",r:"EQE85L"},{n:"BJ",c:"7034305110325493",r:"EQP77D"},{n:"JOE HURST",c:"7034305112846991",r:"EQP77E"},{n:"RHYS DWYER",c:"7034305109386829",r:"ERQ21S"},{n:"ANT YOUNGMAN",c:"7034305117050979",r:"EVA47B"},{n:"DECLAN KANE",c:"7034305107192484",r:"EYN61Z"},{n:"DAYNE COOMBE",c:"7034305107009274",r:"EYO02K"},{n:"CASS CHAPPLE",c:"7034305107286914",r:"EYP02J"},{n:"DANE PLUMMER",c:"7034305116249275",r:"FGP29X"},{n:"TONY PLUMMER",c:"7034305111220834",r:"FHX25L"},{n:"JOE DALEY",c:"7034305116246156",r:"FMT17H"},{n:"JASON JOHNSON",c:"7034305113817595",r:"JCJ010"},{n:"CAM WILLIAMS",c:"7034305117354637",r:"MISC3"},{n:"CARLOS CARRILLO",c:"7034305115254565",r:"WIA53F"},{n:"WADE HANNELL",c:"7034305116506179",r:"WNU522"},{n:"BRENDON DEACON / OLD BOGIE",c:"7034305117074201",r:"XN56BU"},{n:"NATHAN MORALES",c:"7034305110311667",r:"XN59QZ"},{n:"SCOTT WOOD",c:"7034305110006994",r:"XN95CF"},{n:"ALEX GLYNN",c:"7034305116398783",r:"XO05MA"},{n:"MATTHEW BROCK",c:"7034305108678176",r:"XO05RX"},{n:"MATT ROGERS",c:"7034305111375786",r:"XO08FN"},{n:"MAROS MENCAK",c:"7034305111698906",r:"XO20NL"},{n:"TIM PRICE",c:"7034305113655797",r:"XO49LN"},{n:"SHAUN DENNISON",c:"7034305110811948",r:"XO96XP"},{n:"STEVE NEWTON",c:"7034305111299762",r:"XP058N"},{n:"DOUG GRANT",c:"7034305116197722",r:"XP31AG"},{n:"JASON HUGHES",c:"7034305116247253",r:"XP41MC"},{n:"JASON SORBARA",c:"7034305118477429",r:"XP86LM"},{n:"ROGER BORG",c:"7034305118263860",r:"YMN14E"},{n:"MATHEW BROCK",c:"7034305108678176",r:"XO05RX"},{n:"NICK JONES",c:"7034305118134137",r:"TA55AA"},{n:"CAM WILLIAMS",c:"7034305118134749",r:"TA80QZ"},{n:"MAROS MENCAK",c:"7034305118133972",r:"TC70VA"},{n:"JASON HUGHES",c:"7034305118175825",r:"TC80LA"},{n:"SPARE",c:"7034305118133980",r:"TL48UF"},{n:"DENNIS KOCJANCIC",c:"7034305118145893",r:"TL56PO"},{n:"DOUG GRANT",c:"7034305118148491",r:"TM84AT"},{n:"SPARE",c:"7034305118133311",r:"TP97AL"},{n:"STEVE NEWTON",c:"7034305118133477",r:"TP99AL"},{n:"MATT ROGERS",c:"7034305118177383",r:"YN05HA"},{n:"SCOTT WOOD",c:"7034305118178019",r:"YN71AN"}
];

// ─── Deleted-driver naming convention ──────────────────────────────────────
// When admin removes a driver from the Drivers tab, every entry that driver
// owned has its `driverName` rewritten to `*DELETED_<originalName>*` —
// the entries themselves stay in the database (so historical totals remain
// accurate) but the Drivers tab hides them from the active list and routes
// them into the "Deleted drivers archive" collapsible section. The wrapping
// asterisks make the marker stand out if it ever leaks into a place we
// didn't expect (and prevents real names from collisions).
const DELETED_DRIVER_PREFIX = "*DELETED_";
const DELETED_DRIVER_SUFFIX = "*";
const isDeletedDriverName = (name) =>
  typeof name === "string" &&
  name.startsWith(DELETED_DRIVER_PREFIX) &&
  name.endsWith(DELETED_DRIVER_SUFFIX) &&
  name.length > DELETED_DRIVER_PREFIX.length + DELETED_DRIVER_SUFFIX.length;
const originalDriverName = (deletedName) =>
  isDeletedDriverName(deletedName)
    ? deletedName.slice(DELETED_DRIVER_PREFIX.length, -DELETED_DRIVER_SUFFIX.length)
    : deletedName;

// ─── Driver Name Aliases ───────────────────────────────────────────────────
// Maps known name variants to a single canonical form so the same person
// doesn't appear as two different drivers on the Drivers tab or in reports.
// Keys are lowercase/trimmed; values are the canonical display name.
const DRIVER_NAME_ALIASES = {
  "joseph pellizzon": "Joe Pellizzon",
};
function normalizeDriverName(name) {
  if (!name) return name;
  const key = name.trim().toLowerCase().replace(/\s+/g, " ");
  return DRIVER_NAME_ALIASES[key] || name.trim();
}

// ─── Driver Name Nickname / Typo Resolution ───────────────────────────────
// Common English first-name short forms. Kept small and only bidirectional
// pairs we're confident about — "Pete" could be short for Peter, but we
// avoid entries like "Pat" that could point to Patrick OR Patricia without
// context. Extend carefully as new drivers join.
const DRIVER_FIRSTNAME_NICKNAMES = {
  cam:         ["cameron"],          cameron:     ["cam"],
  nick:        ["nicholas"],         nicholas:    ["nick"],
  tim:         ["timothy"],          timothy:     ["tim"],
  tom:         ["thomas"],           thomas:      ["tom"],
  matt:        ["matthew", "mathew"], matthew:    ["matt", "mathew"],
  mathew:      ["matt", "matthew"],
  mike:        ["michael"],          michael:     ["mike"],
  chris:       ["christopher"],      christopher: ["chris"],
  rob:         ["robert", "bob"],    robert:      ["rob", "bob"],
  bob:         ["robert", "rob"],
  dan:         ["daniel"],           daniel:      ["dan"],
  dave:        ["david"],            david:       ["dave"],
  sam:         ["samuel"],           samuel:      ["sam"],
  joe:         ["joseph"],           joseph:      ["joe"],
  ant:         ["anthony"],          anthony:     ["ant", "tony"],
  tony:        ["anthony"],
  ben:         ["benjamin"],         benjamin:    ["ben"],
  pete:        ["peter"],            peter:       ["pete"],
  andy:        ["andrew"],           andrew:      ["andy"],
  alex:        ["alexander"],        alexander:   ["alex"],
  // Common spelling variants we've seen in live data
  brendan:     ["brendon"],          brendon:     ["brendan"],
};

// Split a full name into { first, last }. Takes first token as first name
// and everything else (joined) as last name so "Van Der Berg" stays intact.
function splitDriverName(full) {
  const parts = (full || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

// True when two first names plausibly refer to the same person — identical,
// a registered nickname, or one is a ≥3-char prefix of the other. Prefix
// rule catches drivers where the dictionary would be overkill (e.g. a rare
// nickname only used on one team) without matching too-short prefixes that
// would collide across unrelated names.
function firstNamesEquivalent(a, b) {
  const x = (a || "").trim().toLowerCase();
  const y = (b || "").trim().toLowerCase();
  if (!x || !y) return false;
  if (x === y) return true;
  if ((DRIVER_FIRSTNAME_NICKNAMES[x] || []).includes(y)) return true;
  if ((DRIVER_FIRSTNAME_NICKNAMES[y] || []).includes(x)) return true;
  const shorter = x.length <= y.length ? x : y;
  const longer  = x.length <= y.length ? y : x;
  return shorter.length >= 3 && longer.startsWith(shorter);
}

// Resolve a typed driver name against a pool of known canonical names.
// Returns { canonical, confidence, from, distance? }. Never rewrites the
// name unless the match is strong — low-confidence typos are reported as
// suggestions so the UI can flag them for admin review instead of silently
// swapping the name.
//
//   exact    — identical after case/whitespace normalization
//   alias    — matched DRIVER_NAME_ALIASES
//   nickname — same last name + nickname-equivalent first name
//   typo     — edit distance ≤ 2 on the full name, same first-AND-last
//              initial (so "Joe Hirst" → "Joe Hurst" matches but "Joe
//              Hurst" can't silently slide to "Dave Hall")
//   none     — no plausible match, caller keeps the typed value
function resolveDriverName(typed, knownNames) {
  const clean = (typed || "").trim().replace(/\s+/g, " ");
  if (!clean) return { canonical: typed, confidence: "none", from: typed };
  const lower = clean.toLowerCase();

  if (DRIVER_NAME_ALIASES[lower]) {
    return { canonical: DRIVER_NAME_ALIASES[lower], confidence: "alias", from: clean };
  }

  const known = new Map(); // lowercaseFull -> { canonical, firstLower, lastLower }
  for (const n of knownNames || []) {
    if (!n) continue;
    const norm = n.trim().replace(/\s+/g, " ");
    if (!norm) continue;
    const { first, last } = splitDriverName(norm);
    known.set(norm.toLowerCase(), { canonical: norm, firstLower: first.toLowerCase(), lastLower: last.toLowerCase() });
  }
  if (known.size === 0) return { canonical: clean, confidence: "none", from: clean };

  if (known.has(lower)) {
    return { canonical: known.get(lower).canonical, confidence: "exact", from: clean };
  }

  const { first: tFirst, last: tLast } = splitDriverName(clean);
  if (tLast) {
    const tLastLower = tLast.toLowerCase();
    for (const v of known.values()) {
      if (!v.lastLower || v.lastLower !== tLastLower) continue;
      const vFirst = v.canonical.split(/\s+/)[0];
      if (firstNamesEquivalent(tFirst, vFirst)) {
        return { canonical: v.canonical, confidence: "nickname", from: clean };
      }
    }
  }

  if (clean.length >= 5) {
    const tFirstInit = (tFirst[0] || "").toLowerCase();
    const tLastInit  = (tLast[0]  || "").toLowerCase();
    let bestMatch = null, bestDist = Infinity;
    for (const v of known.values()) {
      const vFull = v.canonical;
      if (Math.abs(vFull.length - clean.length) > 2) continue;
      const vFirstInit = v.firstLower[0] || "";
      const vLastInit  = v.lastLower[0]  || "";
      if (tFirstInit && vFirstInit && tFirstInit !== vFirstInit) continue;
      if (tLastInit && vLastInit && tLastInit !== vLastInit) continue;
      const d = editDistance(lower, vFull.toLowerCase());
      if (d > 2 || d === 0) continue;
      if (d < bestDist) { bestDist = d; bestMatch = v.canonical; }
    }
    if (bestMatch) {
      return { canonical: bestMatch, confidence: "typo", from: clean, distance: bestDist };
    }
  }

  return { canonical: clean, confidence: "none", from: clean };
}

// Build the canonical-name pool from the static DBs only. Deliberately
// skips entry-derived names so a driver's own repeated typos (e.g. five
// submissions of "Joe Hirst") can't promote themselves to authoritative.
// Computed lazily — DRIVER_CARDS / REGO_DB don't change at runtime, so
// callers can cache the result if hot.
function getKnownDriverNames() {
  const titleCase = (s) => (s || "").replace(/\b\w+/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());
  const out = new Set();
  for (const v of Object.values(DRIVER_NAME_ALIASES)) out.add(v);
  for (const c of DRIVER_CARDS) if (c.n) out.add(titleCase(c.n));
  for (const v of REGO_DB) if (v.dr) out.add(titleCase(v.dr));
  return [...out];
}

// Admin-curated driver-name merges (Settings → Merge driver names). Mutated
// from inside App via setLearnedDriverAliasesDB once the cloud-loaded value
// arrives. Keys are lower-case, values are the target display name.
//
// Kept module-scope so the resolver below can read it without dragging
// component state through every caller — same reason DRIVER_NAME_ALIASES
// itself is module-scope.
let _learnedDriverAliases = {};
function setLearnedDriverAliasesDB(map) {
  _learnedDriverAliases = (map && typeof map === "object") ? map : {};
}

// Run a typed driver name through alias / nickname / typo resolution.
// Returns { name, resolution }:
//   · high-confidence (exact / alias / nickname) — `name` is the canonical
//     form, `resolution` carries metadata only when the name actually
//     changed (so admin can review the rewrite).
//   · low-confidence typo — `name` stays as typed; `resolution` carries the
//     suggestion so getEntryFlags can surface it for admin review.
//   · no match — save as typed, no metadata.
//
// Module-scope on purpose — used by both top-level entry forms inside App
// and by the standalone EditEntryModal / EditVehicleModal components, so
// it can't depend on App's state. See git history for the bug where
// keeping it App-scoped silently broke Save buttons inside the modals.
function canonicalizeDriverName(typed) {
  if (!typed) return { name: typed, resolution: null };
  const lower = (typed || "").trim().toLowerCase().replace(/\s+/g, " ");
  // Admin-curated merge takes priority over everything — explicit override.
  if (_learnedDriverAliases[lower]) {
    const target = _learnedDriverAliases[lower];
    return {
      name: target,
      resolution: target.trim() !== (typed || "").trim()
        ? { from: typed.trim(), canonical: target, confidence: "alias" }
        : null,
    };
  }
  const res = resolveDriverName(typed, getKnownDriverNames());
  if (res.confidence === "exact" || res.confidence === "alias" || res.confidence === "nickname") {
    return {
      name: res.canonical,
      resolution: res.canonical.trim() !== (typed || "").trim() ? res : null,
    };
  }
  if (res.confidence === "typo") {
    return { name: typed.trim(), resolution: res };
  }
  return { name: typed.trim(), resolution: null };
}

// Spread into an entry object literal to set driverName +
// _driverNameResolution in one step. Used at every entry-build site.
function driverFieldsFor(raw) {
  const r = canonicalizeDriverName(raw);
  return { driverName: r.name, _driverNameResolution: r.resolution };
}

// Lookup fleet cards by driver name — fuzzy match, returns all cards for that person
function lookupDriverCards(name) {
  if (!name || name.length < 2) return [];
  const u = name.trim().toUpperCase();
  // Exact match first
  const exact = DRIVER_CARDS.filter(c => c.n === u);
  if (exact.length > 0) return exact;
  // Partial: name starts with input, or input starts with name, or last name match
  const partial = DRIVER_CARDS.filter(c => {
    if (c.n.startsWith(u) || u.startsWith(c.n)) return true;
    // Match by last name or first name
    const parts = u.split(/\s+/);
    const cParts = c.n.split(/\s+/);
    return parts.some(p => p.length >= 3 && cParts.some(cp => cp === p || cp.startsWith(p) || p.startsWith(cp)));
  });
  return partial;
}

// ─── Rego Master Database (from master list spreadsheet) ───────────────────
const REGO_DB = [{"r":"38359D","t":"Other","d":"Tree","n":"AVANT TELESCOPIC LOADER","m":"AVANT 750"},{"r":"00440E","t":"Excavator","d":"Tree","n":"EXCAVATOR  8T","m":"KUBOTA KX080"},{"r":"25393E","t":"Excavator","d":"Tree","n":"EXCAVATOR","m":"KOBELCO SK55SRX-6"},{"r":"40971E","t":"Other","d":"Tree","n":"AVANT TELESCOPIC LOADER","m":"AVANT 750"},{"r":"TA55AA","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 12in","m":"BANDIT BAN990","dr":"NICK JONES","c":"7034305118134137","f":"Diesel"},{"r":"TP97AL","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 15in","m":"BANDIT 159006A","dr":"SPARE","c":"7034305118133311","f":"Diesel"},{"r":"TD34ZR","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 15in","m":"BANDIT 159006A"},{"r":"TP99AL","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 15in","m":"BANDIT 159006A","dr":"STEVE NEWTON","c":"7034305118133477","f":"Diesel"},{"r":"TL40RW","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 15in","m":"BANDIT 159006A"},{"r":"50197D","t":"Excavator","d":"Tree","n":"EXCAVATOR 20T","m":"CASE CX210C"},{"r":"TA80QZ","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 18in","m":"BANDIT 189007A","dr":"CAM WILLIAMS","c":"7034305118134749","f":"Diesel"},{"r":"53667E","t":"Excavator","d":"Tree","n":"EXCAVATOR  5.5T","m":"KOBELCO SK55S7A"},{"r":"TC70VA","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 18in","m":"BANDIT 159006A","dr":"MAROS MENCAK","c":"7034305118133972","f":"Diesel"},{"r":"61609E","t":"Excavator","d":"Tree","n":"EXCAVATOR  8T","m":"KUBOTA KX080"},{"r":"TL48UF","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 18in","m":"BANDIT 18XP","dr":"SPARE","c":"7034305118133980","f":"Diesel"},{"r":"TL56PO","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 18in","m":"VERMEER BC1800","dr":"DENNIS KOCJANCIC","c":"7034305118145893","f":"Diesel"},{"r":"TM84AT","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 18in","m":"VERMEER BC1800","dr":"DOUG GRANT","c":"7034305118148491","f":"Diesel"},{"r":"YN05HA","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 22in","m":"BANDIT MTETAND","dr":"MATT ROGERS","c":"7034305118177383","f":"Diesel"},{"r":"YN29AW","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 22in","m":"BANDIT MTETAND"},{"r":"YN71AN","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 22in","m":"BANDIT MTETAND","dr":"SCOTT WOOD","c":"7034305118178019","f":"Diesel"},{"r":"BJ57HC","t":"Ute","d":"Tree","n":"TOYOTA HILUX","m":"TOYOTA HILUX4","dr":"JUSTIN LEWIS","c":"7034305116558659","f":"Premium unleaded"},{"r":"BY38KR","t":"Ute","d":"Tree","n":"Toyota Landcruiser","m":"Toyota Landcruiser","dr":"BRENDAN RICHARSON","c":"7034305110165261","f":"Diesel"},{"r":"26228E","t":"Mower","d":"Landscape","n":"HUSTLER RIDE ON MOWER","m":"HUSTLER SUPERZ 60inch"},{"r":"BW63RR","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL UTE - VMS","m":"TOYOTA HILUX"},{"r":"31182E","t":"Mower","d":"Landscape","n":"KUBOTA RIDE ON MOWER","m":"KUBOTA ZD1221 60inch"},{"r":"CA10BL","t":"Ute","d":"Tree","n":"MITSUBISHI TRITON","m":"MITSUBISHI TRITON","dr":"LUKE BARTLEY","c":"7034305117926277","f":"Diesel"},{"r":"36989E","t":"Mower","d":"Landscape","n":"KUBOTA RIDE ON MOWER","m":"KUBOTA ZD1221 60inch"},{"r":"36990E","t":"Landscape Tractor","d":"Landscape","n":"KUBOTA TRACTOR","m":"KUBOTA M9540D"},{"r":"BR22ZZ","t":"Truck","d":"Tree","n":"TRUCK-HINO 500","m":"HINO FG8J","dr":"NICK JONES","c":"7034305117074284","f":"Fuel"},{"r":"BT08QM","t":"Truck","d":"Tree","n":"TRUCK - HINO TIPPER","m":"HINO FG8J","dr":"YARRAN/JASON HUGHES","c":"7034305116939826","f":"Diesel"},{"r":"53369E","t":"Mower","d":"Landscape","n":"KUBOTA RIDE ON MOWER","m":"KUBOTA ZD1221 60inch"},{"r":"59040D","t":"Mower","d":"Landscape","n":"KUBOTA RIDE ON MOWER","m":"KUBOTA ZD1221 60inch"},{"r":"62925E","t":"Mower","d":"Landscape","n":"KUBOTA RIDE ON MOWER","m":"KUBOTA ZD1221R 60inch"},{"r":"CC24TI","t":"Ute","d":"Tree","n":"Toyota Hilux 4x4","m":"Toyota HILUX 4","dr":"BILLY PRICE","c":"7034305113893588","f":"Premium Diesel"},{"r":"CC94JL","t":"Ute","d":"Tree","n":"ISUZU D-MAX","m":"ISUZU D-MA08A","dr":"GAB FITZGERALD","c":"7034305111758833","f":"Diesel"},{"r":"CD36PH","t":"Ute","d":"Tree","n":"TOYOTA HILUX","m":"TOYOTA HILUX4","dr":"JOE HUTTON","c":"7034305117597540","f":"Fuel"},{"r":"CH90KL","t":"Ute","d":"Tree","n":"TOYOTA HILUX","m":"TOYOTA HILUX4","dr":"SAM THOMAS","c":"7034305117902278","f":"Unleaded"},{"r":"CJ55FB","t":"Ute","d":"Tree","n":"TOYOTA HILUX","m":"TOYOTA HILUX4","dr":"KEV CARRILLO","c":"7034305108260140","f":"Unleaded"},{"r":"CP60AF","t":"Ute","d":"Tree","n":"ISUZU D-MAX","m":"ISUZU D-MA12","dr":"SHAUN COLE","c":"7034305113746059","f":"Diesel"},{"r":"CV14NO","t":"Ute","d":"Tree","n":"Toyota Hilux","m":"Toyota HILUX 4","dr":"SAXON","c":"7034305106890443","f":"Diesel"},{"r":"CN47HS","t":"Truck","d":"Tree","n":"ISUZU D Max","m":"ISUZU NQR","dr":"CHRIS PLAYER - (STUMP TRUCK - OLD TRENT SHEATH)","c":"7034305117020659","f":"Diesel"},{"r":"66695E","t":"Mower","d":"Landscape","n":"KUBOTA RIDE ON MOWER","m":"KUBOTA ZD1221R 60inch"},{"r":"CP06YZ","t":"Truck","d":"Tree","n":"TRUCK - UD","m":"UD PKC8E","dr":"DENNIS KOCJANCIC","c":"7034305116296961","f":"Diesel"},{"r":"CS63LP","t":"Truck","d":"Tree","n":"MITSUBISHI CANTER (Blower)","m":"MITSUBISHI CANT08","dr":"BLOWER TRUCK","c":"7034305112809668","f":"Diesel"},{"r":"CE52JK","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL - TMA","m":"ISUZU FTR900M"},{"r":"CZ86TX","t":"Ute","d":"Landscape","n":"TRAFFIC CONTROL UTE","m":"ISUZU D-MA20"},{"r":"CZ33TZ","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL UTE - VMS","m":"ISUZU D-MAX"},{"r":"DA32FL","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL UTE - VMS","m":"ISUZU D-MAX"},{"r":"DA37FL","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL UTE - VMS","m":"ISUZU D-MAX"},{"r":"CP11JO","t":"Truck","d":"Tree","n":"TRUCK - HINO","m":"HINO FGIJ","dr":"SPARE - OLD BRENDON DEACON","c":"7034305116851328","f":"Diesel"},{"r":"DF25LB","t":"Truck","d":"Tree","n":"ISUZU Crew Cab","m":"ISUZU NNR","dr":"KYLE OSBORNE","c":"7034305117002350","f":"Diesel"},{"r":"DFW77E","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL UTE - VMS","m":"ISUZU D-MAX"},{"r":"DF26LB","t":"Truck","d":"Tree","n":"ISUZU Crew Cab","m":"ISUZU NNR","dr":"JACOB DEVINGNE?","c":"7034305110028204","f":"Diesel"},{"r":"DI32GU","t":"Ute","d":"Landscape","n":"TRAFFIC CONTROL UTE","m":"TOYOTA HILUX 4","c":"7034305110681705","f":"Premium unleaded"},{"r":"DM84ZB","t":"Truck","d":"Tree","n":"ISUZU Crew Cab","m":"ISUZU NHNN07"},{"r":"DL45RF","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL UTE - VMS","m":"ISUZU D-MAX"},{"r":"DP60DA","t":"Truck","d":"Tree","n":"ISUZU TRUCK","m":"ISUZU NHNN07","dr":"JACOB DEVEIGNE","c":"7034305117003408","f":"Diesel"},{"r":"XO05MA","t":"Truck","d":"Tree","n":"Nissan UD Float","m":"UD PKC397A","dr":"ALEX GLYNN","c":"7034305116398783","f":"Diesel"},{"r":"XO05RX","t":"Truck","d":"Tree","n":"Hino 300 Series","m":"Hino 30007B","dr":"Mathew Brock","c":"7034 3051 0867 8176"},{"r":"DB78SC","t":"Ute","d":"Tree","n":"ISUZU D-MAX SX CAB CHASSIS","m":"ISUZU D-MA12","dr":"JAYDEN STRONG","c":"7034305112823891","f":"Diesel"},{"r":"DI05QD","t":"Ute","d":"Tree","n":"TOYOTA Hilux","m":"TOYOTA HILUX 4","dr":"ALEX GLYNN","c":"7034305112341555","f":"Premium unleaded"},{"r":"BX27ZL","t":"Ute","d":"Tree","n":"TOYOTA Hilux","m":"TOYOTA HILUX 4"},{"r":"DP90CQ","t":"Ute","d":"Tree","n":"FORD RANGER","m":"FORD RANGER","dr":"TIM PRICE","c":"7034305117463065","f":"Diesel"},{"r":"BY49ZT","t":"Ute","d":"Tree","n":"FORD RANGER","m":"FORD RANGER"},{"r":"XN59QZ","t":"EWP","d":"Tree","n":"MITSUBISHI / VERSA LIFT TOWER","m":"MITSUBISHI FUSO","dr":"NATHAN MORALES","c":"7034305110311667","f":"Diesel"},{"r":"XN56BU","t":"Truck","d":"Tree","n":"ISUZU BOGIE -TIPPER","m":"ISUZU FVZ193A","dr":"BRENDON DEACON / OLD BOGIE","c":"7034305117074201","f":"Diesel"},{"r":"XN70FQ","t":"Truck","d":"Tree","n":"TRUCK - MITSU TIPPER","m":"MITSUBISHI FN62FK","dr":"SPARE","c":"7034305117074300","f":"Diesel"},{"r":"XN95CF","t":"Truck","d":"Tree","n":"TRUCK - UD","m":"UD GWB","dr":"SCOTT WOOD","c":"7034305110006994","f":"Diesel"},{"r":"DPL85C","t":"Ute","d":"Tree","n":"MITSUBISHI TRITON","m":"MITSUBISHI TRITON","dr":"BRETT SONTER","c":"7034305108863984","f":"Diesel"},{"r":"DSU65Y","t":"Ute","d":"Tree","n":"MITSUBISHI TRITON","m":"MITSUBISHI TRITON","dr":"JASON HUGHES","c":"7034305112129919","f":"Unleaded"},{"r":"DXS19T","t":"Ute","d":"Tree","n":"Toyota Hilux","m":"TOYOTA HILUX 4"},{"r":"EAE28V","t":"Other","d":"Tree","n":"PORSCHE MACAN","m":"PORSCHE MACA14","dr":"SONYA","c":"7034305114570151","f":"Premium unleaded"},{"r":"EYI04H","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL UTE - VMS","m":"ISUZU D-MAX"},{"r":"EYI04J","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL UTE - VMS","m":"ISUZU D-MAX"},{"r":"DI08XE","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL - TMA","m":"MITSUA TF"},{"r":"ECE83U","t":"Ute","d":"Tree","n":"UTE","m":"Volkswagon Amarok","dr":"AMELIA PLUMMER","c":"7034305115642942","f":"Diesel"},{"r":"6117231263","t":"Stump Grinder","d":"Tree","n":"STUMP GRINDER - HUMPER - ORANGE","m":"RHYSCORP SH25hp"},{"r":"1800D","t":"Stump Grinder","d":"Tree","n":"STUMP GRINDER - RED ROO","m":"RED ROO 5014TRX"},{"r":"66HP","t":"Stump Grinder","d":"Tree","n":"STUMP GRINDER - RED ROO 7015TRX","m":""},{"r":"PT44","t":"Stump Grinder","d":"Tree","n":"STUMP GRINDER - RED ROO 7015TRX","m":"RED ROO 7015TRX"},{"r":"PT20","t":"Stump Grinder","d":"Tree","n":"STUMP GRINDER","m":""},{"r":"PT31","t":"Stump Grinder","d":"Tree","n":"STUMP GRINDER","m":""},{"r":"CM77KG","t":"EWP","d":"Tree","n":"TOWER-ISUZU - EWP","m":"ISUZU FVZ193A","dr":"BILLY PRICE (21M)","c":"7034305116027192","f":"Diesel"},{"r":"EES53B","t":"Ute","d":"Tree","n":"ISUZU D-MAX","m":"ISUZU D-MA08A","dr":"LEE DAVIS","c":"7034305107318832","f":"Diesel"},{"r":"EOL97X","t":"Ute","d":"Tree","n":"FORD RANGER","m":"FORD RANGER","dr":"JOHN LARGEY","c":"7034305111069538","f":"Diesel"},{"r":"EQE85L","t":"Ute","d":"Tree","n":"FORD RANGER","m":"FORD RANGER","dr":"MARTIN HOWARD","c":"7034305113441354","f":"Diesel"},{"r":"EQP77D","t":"Ute","d":"Tree","n":"TOYOTA HILUX","m":"TOYOTA HILUX 4","dr":"BJ","c":"7034305110325493","f":"Unleaded"},{"r":"EQP77E","t":"Ute","d":"Tree","n":"TOYOTA HILUX","m":"TOYOTA HILUX 4","dr":"JOE HURST","c":"7034305112846991","f":"Unleaded"},{"r":"ERQ21S","t":"Ute","d":"Tree","n":"FORD RANGER","m":"FORD RANGER","dr":"RHYS DWYER","c":"7034305109386829","f":"Diesel"},{"r":"EVA47B","t":"Ute","d":"Tree","n":"MITSUBISHI TRITON","m":"FORD RANGER","dr":"ANT YOUNGMAN","c":"7034305117050979","f":"Diesel"},{"r":"EYN61Z","t":"Other","d":"Tree","n":"Mazda CX5","m":"Mazda CX5","dr":"DECLAN KANE","c":"7034305107192484","f":"Unleaded"},{"r":"EYP02J","t":"Ute","d":"Tree","n":"LDV T60","m":"LDV SK8C17","dr":"CASS CHAPPLE","c":"7034305107286914","f":"Diesel"},{"r":"EYP02K","t":"Ute","d":"Tree","n":"LDV T60","m":"LDV SK8C17"},{"r":"FGP29X","t":"Ute","d":"Tree","n":"ISUZU D Max","m":"ISUZU D-MAX","dr":"DANE PLUMMER","c":"7034305116249275","f":"Diesel"},{"r":"FHX25L","t":"Ute","d":"Tree","n":"Toyota Landcruiser","m":"TOYOTA LANDCRUISER","dr":"TONY PLUMMER","c":"7034305111220834","f":"Diesel"},{"r":"FMT17H","t":"Ute","d":"Tree","n":"ISUZU D Max","m":"ISUZU D-MAX","dr":"JOE DALEY","c":"7034305116246156","f":"Diesel"},{"r":"TA39WQ","t":"Trailer","d":"Tree","n":"TRAILER","m":"QUALTY 8X501A"},{"r":"TB17YY","t":"Trailer","d":"Tree","n":"TRAILER","m":"MARIOT 12XT"},{"r":"YN04HA","t":"Trailer","d":"Tree","n":"TRAILER","m":"JPTRLR TRIAXLE"},{"r":"TE46QM","t":"Trailer","d":"Tree","n":"TRAILER","m":"JPTRLR TRIAXLE"},{"r":"XO08FN","t":"Truck","d":"Tree","n":"TRUCK - UD","m":"UD PK","dr":"MATT ROGERS","c":"7034305111375786","f":"Diesel"},{"r":"TG26UA","t":"Trailer","d":"Tree","n":"TRAILER","m":"ATA 9X6"},{"r":"XO20NL","t":"Truck","d":"Tree","n":"TRUCK - UD","m":"UDTRUC PKC","dr":"MAROS MENCAK","c":"7034305111698906","f":"Diesel"},{"r":"TE74NJ","t":"Trailer","d":"Tree","n":"TRAILER - (Mower)","m":"DEAN 190S06A"},{"r":"TF46NU","t":"Trailer","d":"Tree","n":"TRAILER - (Mower)","m":"SWTTLR SWT"},{"r":"TG29WL","t":"Trailer","d":"Tree","n":"TRAILER - (Mower)","m":"BETTER BT"},{"r":"U64347","t":"Trailer","d":"Tree","n":"JPTRLR TANDEM Trailer","m":"JPRLR TANDEM"},{"r":"TG30WL","t":"Trailer","d":"Tree","n":"TRAILER - (Mower)","m":"BETTER BT"},{"r":"TG31WL","t":"Trailer","d":"Tree","n":"TRAILER - (Mower)","m":"BETTER BT"},{"r":"TL30YS","t":"Trailer","d":"Tree","n":"TRAILER - (Blower)","m":"BALANCE BT53FWT"},{"r":"TL30ZN","t":"Trailer","d":"Tree","n":"TRAILER - (Traffic Control)","m":"MARIO 10X5"},{"r":"TL49PN","t":"Trailer","d":"Tree","n":"Trailer (Avant)","m":"BRIANJ 888"},{"r":"TL69XK","t":"Trailer","d":"Tree","n":"TRAILER - (Mower)","m":"DEAN 109S06A"},{"r":"TF52XQ","t":"Trailer","d":"Tree","n":"TRAILER - (Mower)","m":"DEAN 109S06A"},{"r":"TP56GL","t":"Trailer","d":"Tree","n":"TRAILER Maxim - (Mower)","m":"MAXIM STB"},{"r":"OLD TC80RW","t":"Trailer","d":"Tree","n":"TRAILER Maxim - (Mower)","m":"MAXIM STB"},{"r":"TG05QH","t":"Trailer","d":"Tree","n":"TRAILER - (Vermeer)","m":"SURWEL SW2400"},{"r":"XN14ZF","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL - TMA","m":"ISUZU FTR900M"},{"r":"YN78AN","t":"Trailer","d":"Tree","n":"TRAILER FLOAT","m":"TAG TANDEM"},{"r":"XN61YG","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL - TMA","m":"UD PKC8E"},{"r":"XO49LN","t":"Truck","d":"Tree","n":"TRUCK - UD","m":"UD GWB","dr":"TIM PRICE","c":"7034305113655797","f":"Diesel"},{"r":"XP05BN","t":"Truck","d":"Tree","n":"Isuzu Tipper","m":"Isuzu FSR140"},{"r":"XO26SK","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL - TMA","m":"IVECO EUROCARGO"},{"r":"XN07XY","t":"Truck","d":"Tree","n":"IVECO - HAULAGE TRUCK","m":"IVECO STRA05A","dr":"BRETT SONTER/LEE DAVIS","f":"Diesel"},{"r":"XO37SC","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL - TMA","m":"MITSUA TA FIGH"},{"r":"XO39LU","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL - TMA","m":"HINO GH500 1828"},{"r":"XO68TY","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL - TMA","m":"IVECO DAIL07"},{"r":"XP31AG","t":"Truck","d":"Tree","n":"Mitsubishi Tipper","m":"MITSUBISHI FM6503A","dr":"DOUG GRANT","c":"7034305116197722","f":"Diesel"},{"r":"XP36GC","t":"Truck","d":"Tree","n":"Truck Hino PT#62","m":"HINO 30007A","dr":"4 TONNER / BRENDON HOOKE","c":"7034305117461226","f":"Diesel"},{"r":"XP80KS","t":"Truck","d":"Tree","n":"TRUCK - HINO TIPPER","m":"HINO FG1J01A","dr":"SPARE","c":"7034305117533503","f":"Diesel"},{"r":"XO71ZL","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL - TMA","m":"MITSUA TA FIGH"},{"r":"XN25DA","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL - TMA","m":""},{"r":"XO82XV","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL - TMA","m":"MITSUA TA FIGH"},{"r":"XO96XP","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL - TMA","m":"MITSUA TF","dr":"SHAUN DENNISON","c":"7034305110811948","f":"Diesel"},{"r":"XP57ES","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL - TMA","m":"MITSUA TA FIGH"},{"r":"XP86LM","t":"Truck","d":"Tree","n":"TRUCK - ISUZU","m":"ISUZU FVRL96A","dr":"JASON SORBARA","f":"Diesel"},{"r":"YN22AO","t":"Trailer","d":"Tree","n":"PLANT TRAILER","m":"FWR Single Axle Tag Trailer"},{"r":"CX22BE","t":"Truck","d":"Landscape","n":"MITSUBISHI CANTER","m":"MITSUBISHI CANT08","dr":"LAURA HARDWOOD","c":"7034305114887118","f":"Diesel"},{"r":"XO35UP","t":"Truck","d":"Tree","n":"MERCEDES TIPPER J&R HIRE","m":"MERCEDES BENZ 2643","dr":"CAM WILLIAMS","c":"MISC3","f":"Diesel"},{"r":"BZ04EH","t":"Truck","d":"Landscape","n":"FUSO CANTER","m":"MITSUBISHI CANT08","dr":"GRAFFITI TRUCK","c":"7034305113417867","f":"Diesel"},{"r":"Z41694","t":"Trailer","d":"Tree","n":"TRAILER ARROW BOARD","m":"DATA DATASIG"},{"r":"Z80212","t":"Trailer","d":"Tree","n":"TRAILER ARROW BOARD","m":"Data Signs DATASIG"},{"r":"CI98BZ","t":"Truck","d":"Landscape","n":"Isuzu Truck","m":"ISUZU NPR300","dr":"KYLE OSBORNE","c":"7034305109332146","f":"Diesel"},{"r":"CL52NS","t":"Truck","d":"Landscape","n":"HINO Truck - 300 SERIES","m":"HINO 300S11","dr":"DAN THOMPSON","c":"7034305107310136","f":"Diesel"},{"r":"CT74KE","t":"Truck","d":"Tree","n":"ISUZU Truck","m":"ISUZU NHNL07","dr":"SHANE DEMIRAL","c":"7034305112151236","f":"Diesel"},{"r":"CX23BE","t":"Truck","d":"Landscape","n":"FUSO CANTER","m":"MITSUBISHI CANTER","dr":"WATER TRUCK / MICK THOMAS","c":"7034305118302718","f":"Diesel"},{"r":"YMN14E","t":"Ute","d":"Tree","n":"ISUZU D Max","m":"ISUZU D-MA21","dr":"ROGER BORG","c":"7034305118263860","f":"Diesel"},{"r":"PT#30","t":"Other","d":"Tree","n":"VERMEER LOADER","m":"VERMEER CTX100"},{"r":"CX45MJ","t":"Truck","d":"Landscape","n":"ISUZU WATER CART","m":"ISUZU NLR200","dr":"JUSTIN LEWIS","c":"7034305118229598","f":"Diesel"},{"r":"TC80LA","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 15in","m":"BANDIT 159006A","dr":"JASON HUGHES","c":"7034305118175825","f":"Diesel"},{"r":"AP85DF","t":"Other","d":"Tree","n":"Mitsubishi Canter Auto","m":"","dr":"KYLE OSBORNE","c":"7034305113700650","f":"Diesel"},{"r":"AT13VE","t":"Truck","d":"Tree","n":"Isuzu Tipper","m":"","dr":"JASON SORBARA","c":"7034305108940667","f":"Diesel"},{"r":"BF51KJ","t":"Other","d":"Tree","n":"NLR Series","m":"","dr":"NAISH","c":"7034305107330928","f":"Diesel"},{"r":"BST66Q","t":"Ute","d":"Tree","n":"Toyota Hilux SR","m":"","dr":"YARD SPARE","c":"7034305116359132","f":"Unleaded"},{"r":"CH95ZD","t":"Other","d":"Tree","n":"Mitsubishi Canter","m":"","dr":"DANIEL THOMSON","c":"7034305108274448","f":"Diesel"},{"r":"CIC51E","t":"Other","d":"Tree","n":"Ford Ranger","m":"","c":"7034305114657123","f":"Unleaded"},{"r":"CM80RV","t":"Truck","d":"Tree","n":"Hino FD8J Truck","m":"","c":"7034305114621285","f":"Diesel"},{"r":"EBL30C","t":"Other","d":"Tree","n":"FORD FALCON","m":"","dr":"SAM LAW","c":"7034305118360872","f":"Unleaded"},{"r":"EYO62W","t":"Other","d":"Tree","n":"MERC BENZ 300CE","m":"","dr":"JOE PELLIZZON","c":"7034305117257665","f":"Unleaded"},{"r":"EYO02K","t":"Ute","d":"Tree","n":"LDV T60 UTE LDV","m":"","dr":"DAYNE COOMBE","c":"7034305107009274","f":"Diesel"},{"r":"FWN82W","t":"Other","d":"Tree","n":"","m":"","dr":"JOEL SONTER"},{"r":"JCJ010","t":"Other","d":"Tree","n":"RAM RAM 1500","m":"","dr":"JASON JOHNSON","c":"7034305113817595","f":"Unleaded"},{"r":"MISC3","t":"Other","d":"Tree","n":"ANY ANY","m":"","dr":"CAM WILLIAMS","f":"Diesel"},{"r":"WIA53F","t":"Other","d":"Tree","n":"Nissan Navara Nissan Navara","m":"","dr":"CARLOS CARRILLO","c":"7034305115254565","f":"Diesel"},{"r":"WNU522","t":"EWP","d":"Tree","n":"HINO 500","m":"","dr":"WADE HANNELL","c":"7034305116506179","f":"Diesel"},{"r":"XO86LP","t":"EWP","d":"Tree","n":"ISUZU NPR200","m":"","c":"7034305114342411","f":"Diesel"},{"r":"XP058N","t":"Truck","d":"Tree","n":"ISUZU FSR 140","m":"","dr":"STEVE NEWTON","c":"7034305111299762","f":"Diesel"},{"r":"XP41MC","t":"EWP","d":"Tree","n":"HINO-500","m":"","dr":"JASON HUGHES","c":"7034305116247253","f":"Diesel"},{"r":"XP21GC","t":"EWP","d":"Tree","n":"","m":"","dr":"DAN VANDERMEEL","c":"XP21GC"},{"r":"XP60OO","t":"EWP","d":"Tree","n":"","m":"","dr":"SAM THOMAS","c":"XP60OO"},{"r":"XN00NX","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL - TMA","m":""},{"r":"XN31GR","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL - TMA","m":""},{"r":"XN64MA","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL - TMA","m":""},{"r":"XV87JT","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL - TMA","m":""}];

// ─── Card field auto-fill helpers ──────────────────────────────────────────
// Two-way mapping between fleet card numbers and the rego embossed on the
// card, sourced from the curated DBs above. Fleet card receipts only
// consistently show ONE of the two (the card number on some, the rego on
// others), so entries were often persisted with just one side filled in.
// The reconciliation view then couldn't line them up cleanly. These helpers
// let us backfill the missing side whenever the DB has a definitive answer.
const _normCardNum = (s) => (s || "").replace(/[\s\[\]]/g, "");
const _normRego    = (s) => (s || "").trim().toUpperCase().replace(/\s+/g, "");

// cardNumber → rego (as embossed on the fleet card). NOT the vehicle rego
// the driver is actually fueling — drivers can legitimately use a card
// assigned to a different vehicle.
function lookupRegoByCardNumber(cardNumber) {
  const clean = _normCardNum(cardNumber);
  if (!clean || clean.length < 4) return "";
  const dc = DRIVER_CARDS.find(c => _normCardNum(c.c) === clean);
  if (dc?.r) return dc.r;
  const rd = REGO_DB.find(e => e.c && _normCardNum(e.c) === clean);
  return rd?.r || "";
}

// rego → cardNumber. Skips DB rows whose `c` isn't a real 16-digit card
// (a few REGO_DB rows store the rego itself in `c` as a placeholder).
function lookupCardNumberByRego(rego) {
  const u = _normRego(rego);
  if (!u) return "";
  const valid = (c) => {
    const clean = _normCardNum(c);
    return clean.length >= 16 && !clean.includes("*");
  };
  const dc = DRIVER_CARDS.find(c => _normRego(c.r) === u && valid(c.c));
  if (dc?.c) return _normCardNum(dc.c);
  const rd = REGO_DB.find(e => e.r && _normRego(e.r) === u && valid(e.c));
  return rd?.c ? _normCardNum(rd.c) : "";
}

// Return a copy of `entry` with cardRego / fleetCardNumber filled in via
// DB lookup when one is present and the other is blank. Pure — returns the
// original reference when nothing changes. Only ever FILLS blanks, never
// overwrites existing data (so Carlos's WIA53F-vs-EIA53F exception and any
// future admin-corrected values stay intact).
function autofillCardFields(entry) {
  if (!entry || typeof entry !== "object") return entry;
  const hasCard = _normCardNum(entry.fleetCardNumber).length >= 4;
  const hasRego = _normRego(entry.cardRego).length > 0;
  if (hasCard && hasRego) return entry;
  if (!hasCard && !hasRego) return entry;
  if (hasCard) {
    const rego = lookupRegoByCardNumber(entry.fleetCardNumber);
    return rego ? { ...entry, cardRego: rego } : entry;
  }
  // hasRego && !hasCard
  const card = lookupCardNumberByRego(entry.cardRego);
  return card ? { ...entry, fleetCardNumber: card } : entry;
}

// ─── Auto-Reconcile Drivers ───────────────────────────────────────────────
// Specific managers / drivers who don't lodge receipts via the app but
// always drive the same vehicle on the same fleet card. When a FleetCard
// CSV import lands a transaction matching one of these (by card number
// OR rego), we synthesise a matching app entry from the txn data so the
// reconciliation auto-pairs them. The driver doesn't need to install the
// app, but their fuel still shows up in the dashboard / per-driver
// reports automatically.
//
// Add new drivers here ONLY when the rego ↔ card ↔ driver triplet is
// stable (one card → one vehicle → one person) — anything fuzzier
// belongs in the regular review flow instead, otherwise we risk
// silently mis-attributing fuel.
const AUTO_RECONCILE_DRIVERS = [
  { rego: "FHX25L", card: "7034305111220834", driver: "Tony Plummer",   division: "Tree", vehicleType: "Ute", fuelType: "Diesel" },
  { rego: "XP21GC", card: "7034305117554921", driver: "Dan Vandermeel", division: "Tree", vehicleType: "EWP", fuelType: "Diesel" },
  { rego: "CM77KG", card: "7034305116027192", driver: "Billy Price",    division: "Tree", vehicleType: "EWP", fuelType: "Diesel" },
];
// Match a txn against the auto-reconcile list. Card number wins (more
// specific); rego fallback handles the case where the CSV rego column
// is populated but the card column is missing/garbled.
function findAutoReconcileDriver(cardNumber, rego) {
  const cleanCard = (cardNumber || "").replace(/[\s\[\]]/g, "");
  const cleanRego = (rego || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (cleanCard) {
    const byCard = AUTO_RECONCILE_DRIVERS.find(d => d.card === cleanCard);
    if (byCard) return byCard;
  }
  if (cleanRego) {
    const byRego = AUTO_RECONCILE_DRIVERS.find(d => d.rego === cleanRego);
    if (byRego) return byRego;
  }
  return null;
}

// Traffic control vehicles are ALWAYS Landscape division
function enforceTrafficRule(match) {
  if (match && match.n && /TRAFFIC/i.test(match.n) && match.d !== "Landscape") {
    return { ...match, d: "Landscape" };
  }
  return match;
}

function lookupRego(rego, learnedDB, allEntries) {
  if (!rego || rego.length < 2) return null;
  const u = rego.trim().toUpperCase().replace(/\s+/g, "").replace(/#/g, "");
  let result = null;

  // 1. Check learned data first (from real driver submissions — most up to date)
  if (learnedDB) {
    const learned = learnedDB[u];
    if (learned && learned.t && learned.d) result = { ...learned, r: u, _src: "learned" };
  }

  // 2. Check entry history — the MOST RECENT entry for this rego is the best source
  if (!result && allEntries && allEntries.length > 0) {
    const regoEntries = allEntries.filter(e => e.registration === u);
    if (regoEntries.length > 0) {
      const latest = regoEntries[regoEntries.length - 1];
      if (latest.division && latest.vehicleType) {
        result = {
          r: u, t: latest.vehicleType, d: latest.division,
          n: latest.vehicleName || latest.vehicleType,
          dr: latest.driverName || "", f: latest.fuelType || "",
          c: latest.fleetCardNumber || "",
          _src: "history",
        };
      }
    }
  }

  // 3. Fall back to static spreadsheet DB
  if (!result) {
    const exact = REGO_DB.find(v => v.r.toUpperCase().replace(/\s+/g, "") === u);
    if (exact) result = { ...exact, _src: "db" };
    else if (u.length >= 4) {
      const partial = REGO_DB.find(v => v.r.toUpperCase().replace(/\s+/g, "").startsWith(u) || u.startsWith(v.r.toUpperCase().replace(/\s+/g, "")));
      if (partial) result = { ...partial, _src: "db" };
    }
  }

  // Always enforce: traffic control = Landscape
  return enforceTrafficRule(result);
}

function guessType(rego, learnedDB, allEntries) {
  const match = lookupRego(rego, learnedDB, allEntries);
  if (match) return match.t;
  const u = (rego || "").toUpperCase();
  if (u.includes("EWP")) return "EWP";
  if (/^(TRK|TRUCK)/.test(u)) return "Truck";
  if (/^UTE/.test(u)) return "Ute";
  if (/^(EXC|CAT)/.test(u)) return "Excavator";
  if (/^(CHIP|CHP)/.test(u)) return "Chipper";
  if (/^PT\d+$/.test(u)) return "Stump Grinder";
  if (/^(STUMP|SG)/.test(u)) return "Stump Grinder";
  if (/^TRL/.test(u)) return "Trailer";
  if (/^(MOW|MWR)/.test(u)) return "Mower";
  if (/^(HIRE|HRD)/.test(u)) return "Hired Vehicle";
  if (/^(TRAC|LTR)/.test(u)) return "Landscape Tractor";
  return "";
}

async function fileToB64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

// Compress image to stay under API 5MB limit (targets ~3.5MB max)
const MAX_B64_BYTES = 8_000_000;
const MAX_DIMENSION = 3200;

async function compressImage(file, rotation = 0) {
  // Read file as data URL first (works reliably in all environments)
  const originalDataUrl = typeof file === "string" ? file : await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error("Failed to read image file"));
    r.readAsDataURL(file);
  });

  // Load into an Image element
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("Failed to decode image"));
    i.src = originalDataUrl;
  });

  let { width, height } = img;

  // Scale down if too large
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const scale = MAX_DIMENSION / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  // Handle rotation — swap dimensions for 90/270
  const isRotated90 = rotation === 90 || rotation === 270;
  const cw = isRotated90 ? height : width;
  const ch = isRotated90 ? width : height;

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");

  // Apply rotation around center
  if (rotation) {
    ctx.translate(cw / 2, ch / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(img, -width / 2, -height / 2, width, height);
  } else {
    ctx.drawImage(img, 0, 0, width, height);
  }

  // Try progressively lower quality until under limit
  let quality = 0.92;
  const MIN_QUALITY = 0.5;
  let dataUrl;
  for (let attempt = 0; attempt < 5; attempt++) {
    dataUrl = canvas.toDataURL("image/jpeg", quality);
    const sizeBytes = Math.ceil((dataUrl.length - 23) * 0.75);
    if (sizeBytes < MAX_B64_BYTES) break;
    quality = Math.max(quality - 0.15, MIN_QUALITY);
    if (attempt >= 2) {
      width = Math.round(width * 0.75);
      height = Math.round(height * 0.75);
      const sw = isRotated90 ? height : width;
      const sh = isRotated90 ? width : height;
      canvas.width = sw;
      canvas.height = sh;
      if (rotation) {
        ctx.translate(sw / 2, sh / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.drawImage(img, -width / 2, -height / 2, width, height);
      } else {
        ctx.drawImage(img, 0, 0, width, height);
      }
    }
  }

  const b64 = dataUrl.split(",")[1];
  return { b64, mime: "image/jpeg" };
}

// ─── Receipt + Card scan prompt (combined, multi-line aware) ─────────────
// ─── Sydney-anchored "today" helpers ──────────────────────────────────────
// All "future date" checks MUST use Sydney time, not the device's local clock,
// because fleet drivers' phones can be set to any timezone and the app itself
// runs in Sydney (AEST/AEDT). Using device local time caused false "future date"
// flags early in the morning when device TZ was UTC.
// Parse a value that may be a number, numeric string, or empty. Returns a
// finite number (including 0) or null. Unlike the `parseFloat(x) || null`
// idiom scattered through older code, this preserves a legitimate zero
// instead of silently dropping $0 costs, 0-litre entries, etc.
const toNum = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

const sydneyTodayYMD = () => {
  // Returns {y, m, d} of today's calendar date in Australia/Sydney.
  const str = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  const [y, m, d] = str.split("-").map(Number);
  return { y, m, d };
};
const sydneyTodayAU = () => {
  // "DD/MM/YYYY" string in Sydney.
  const { y, m, d } = sydneyTodayYMD();
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
};
// True if DD/MM/YYYY (or similar) string is a day AFTER today in Sydney.
const isAfterSydneyToday = (dateStr) => {
  if (!dateStr) return false;
  const parts = String(dateStr).match(/(\d{1,2})\D+(\d{1,2})\D+(\d{2,4})/);
  if (!parts) return false;
  let dd = parseInt(parts[1], 10);
  let mm = parseInt(parts[2], 10);
  let yy = parseInt(parts[3], 10);
  // Reject nonsense values before any comparison. Previously malformed
  // inputs could slip through and get persisted as epoch-adjacent dates.
  if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yy)) return false;
  if (dd < 1 || dd > 31 || mm < 1 || mm > 12) return false;
  if (yy < 100) yy += 2000;
  if (yy < 2000 || yy > new Date().getFullYear() + 1) return false;
  const t = sydneyTodayYMD();
  if (yy !== t.y) return yy > t.y;
  if (mm !== t.m) return mm > t.m;
  return dd > t.d;
};

// Built fresh per call so "today's date" is never stale even if the tab has
// been open overnight. (Previously this was a top-level template literal, so
// the date baked in at module-load time and drifted.)
const buildReceiptScanPrompt = () => `You are an expert fuel receipt scanner. Analyze this image very carefully. It typically contains a fuel receipt AND a fleet card in the same photo.

═══════════════════════════════════════════════════
STEP 1: READ THE RECEIPT TOP-TO-BOTTOM, LINE-BY-LINE
═══════════════════════════════════════════════════

Read the receipt like a human would — starting from the TOP and working DOWN, reading each line LEFT-TO-RIGHT.

SECTION A — HEADER (top of receipt):
The petrol station name, address and business info is at the very top. Note the station name.

SECTION B — DATE & TRANSACTION INFO:
Usually a line showing the date and transaction/receipt number.

⚠️ DATES ARE ALWAYS AUSTRALIAN DAY-FIRST FORMAT — DD/MM/YY OR DD/MM/YYYY. ⚠️
This app serves an Australian fleet. Every receipt is printed at an Australian petrol station, where dates ALWAYS go DAY first, MONTH second, YEAR last.

NEVER interpret slash-separated dates as:
  ✗ YY/MM/DD (year-first, ISO-style) — WRONG. "22/03/26" is NOT 26 March 2022.
  ✗ MM/DD/YYYY (US month-first) — WRONG. "04/10/26" is NOT 10 April 2026.

ALWAYS interpret slash-separated dates as DD/MM/YY:
  ✓ "22/03/26" = 22nd March 2026 (twenty-second of March twenty-twenty-six)
  ✓ "13/03/26" = 13th March 2026
  ✓ "5/4/26" = 5th April 2026
  ✓ "13/03/2026" = 13th March 2026
  ✓ "04/10/26" = 4th October 2026

Even when the first two digits look like they COULD plausibly be a year (e.g. "22" or "23"), they are still the DAY in Australian format. Output dates as DD/MM/YYYY with a 4-digit year — for 2-digit years assume the current century (e.g. "26" → "2026").

CRITICAL DATE RULE: The date on a receipt can NEVER be in the future. Receipts record past transactions. Today's date (Sydney AEST/AEDT) is ${sydneyTodayAU()}. If you read a date that appears to be after today, you have almost certainly misread the day, month, or year. Common misreads:
- Swapping day and month (e.g. reading "04/10" as 10th April when it's actually 4th October)
- Wrong year (e.g. reading "25" instead of "26" or vice versa)
- Misreading a digit (e.g. "1" as "7", "5" as "6")

FRESHNESS HINT: Fuel receipts are usually within the last few weeks. A receipt dated more than ~12 months ago is suspicious and probably a misread (almost certainly you flipped DD/MM/YY into YY/MM/DD). If your interpretation gives a date older than 12 months, RE-READ assuming Australian DD/MM/YY before committing to the answer.

Do NOT raise YY/MM/DD as an alternative reading or "issue" — it is never a valid interpretation in this context. If you see a date and the AU DD/MM/YY reading lands in the past 12 months, that IS the answer; report high confidence.

SECTION C — FUEL ENTRIES (the most critical section):
This section contains fuel purchase information in a roughly columnar format. Each fuel entry is spread across 1 or 2 lines. The columns are typically:
  Column 1: Fuel name/type (e.g. "DIESEL", "UNLEADED", "PREMIUM 95")
  Column 2: Quantity in litres (e.g. "45.23" or "45.23L") — typically between 10L and 450L
  Column 3: Price per litre (e.g. "2.829" or "2.829$/L") — ALWAYS between $1.40 and $4.00 in Australia
  Column 4: Subtotal cost for this line (e.g. "127.96") — this is the HIGHEST number on the line, usually 10×–400× the PPL

⚠️ THE #1 MISTAKE TO AVOID — CONFUSING SUBTOTAL WITH PRICE PER LITRE ⚠️
The price per litre (PPL) is a SMALL NUMBER (between 1.40 and 4.00 dollars). It typically sits DIRECTLY NEXT TO the fuel name — often on the same row or the row below. It is NOT the total cost and NOT the subtotal.
  - PPL correct examples: 1.899, 2.329, 2.749, 3.299, 3.499 (values between 1.40 and 4.00)
  - PPL correct in "cents" format: 189.9, 232.9, 274.9, 329.9 (values between 140.0 and 400.0 — divide by 100 to get dollars)
  - NEVER pick a PPL value: 45.80, 141.56, 145.80, 220.02, 383.01 (these are SUBTOTALS, not prices per litre)
  - NEVER pick a PPL value: any number >$4.01/L after dividing cents by 100, any number <$1.39/L

HARD RULE: If the value you are about to report as pricePerLitre is OUTSIDE the range $1.40–$4.00 (or 140–400 if printed in cents), you have picked the wrong number. STOP. Re-read the receipt. Find the small number next to the fuel name that IS in this range — THAT is the PPL. The larger number you were about to pick is almost certainly the line subtotal or the grand total.

CENTS vs DOLLARS DISAMBIGUATION:
- If PPL is printed as "189.9" or "232.9" (3 digits before decimal, decimal present), it's CENTS — divide by 100. Return 1.899 or 2.329.
- If PPL is printed as "1.899" or "2.329" (1 digit before decimal), it's DOLLARS — return as-is.
- A 4-digit integer with no decimal (e.g. "1899") on a PPL line is ALMOST ALWAYS cents — return 1.899.
- NEVER return a PPL above 4.00 or below 1.40.

POSITIONAL COLUMN ORDER (reinforcement):
On a single fuel line, the PHYSICAL left-to-right order is always:
  [FUEL NAME] ... [LITRES] ... [PPL] ... [SUBTOTAL]
The SUBTOTAL is ALWAYS the rightmost (and largest) number on the line. The PPL is ALWAYS smaller than the subtotal. If you see three numbers on one line and assign the largest to pricePerLitre, you have swapped columns — swap them back.

CROSS-CHECK BEFORE RETURNING: For every fuel line, verify litres × pricePerLitre ≈ subtotal_cost. If the product is >20% off the printed subtotal, you have misread one of the three numbers — re-read them before returning.

⚠️ CRITICAL: SUBTOTAL-PER-LINE ≠ GRAND TOTAL ⚠️
When the receipt has MULTIPLE entries (e.g. Diesel + AdBlue), each line has its OWN subtotal. The grand TOTAL at the bottom is the SUM of all subtotals. NEVER cross-check a single line's litres × PPL against the grand total — only against THAT line's own subtotal. Example:
  Diesel: 144.10L × $2.829/L = $407.60  ← line subtotal
  AdBlue: 25.10L × $2.980/L = $74.80    ← line subtotal
  TOTAL: $482.40                          ← grand total (sum)
Diesel PPL cross-checks against $407.60 only, NOT $482.40.

If a fuel entry spans 2 lines, the format is often:
  Line A: "1 FUEL TYPE NAME          $SUBTOTAL_COST  B"
  Line B: "Pump: XX  QUANTITY Litre  PRICE$/L"

Once all values (fuel name, quantity, price per litre, subtotal) are found for one entry, the next fuel entry (if any) starts on the next line(s).

SECTION D — TOTAL:
After all fuel entries, there is a line marked "TOTAL" showing the total cost of all entries combined. This MUST be recorded.

═══════════════════════════════════════════════════
STEP 2: READING NUMBERS — ABSOLUTE PRECISION REQUIRED
═══════════════════════════════════════════════════

CRITICAL — DIGIT ORDER: Read every number EXACTLY as printed, digit by digit, LEFT to RIGHT.
- If the receipt prints "2.829", the value is 2.829 — NOT 2.289, NOT 2.892, NOT 2.928.
- If the receipt prints "128.57", the value is 128.57 — NOT 125.87, NOT 182.57.
- If the receipt prints "1.999", the value is 1.999 — NOT 1.899, NOT 9.991.

NEVER rearrange, swap, or transpose digits. Each digit must be read in the EXACT position it appears on the receipt. If you are unsure about a digit, flag it in confidence.issues rather than guessing.

COMMON DIGIT-READING ERRORS TO AVOID:
- Swapping adjacent digits: "2.829" read as "2.289" ← WRONG
- Reversing digit groups: "45.23" read as "23.45" ← WRONG
- Misreading similar characters: 8↔3, 6↔0, 5↔6, 1↔7 — look carefully at each digit
- Reading a number from a DIFFERENT line and assigning it to the wrong entry

VERIFICATION AFTER READING: After reading all numbers from the receipt, verify each fuel line:
  Quantity × Price Per Litre should ≈ Subtotal Cost
  Example: 45.23L × $2.829/L = $127.96 ✓

If the math checks out: great — you read the receipt correctly. Report the values as-is.

If the math does NOT check out:
1. FIRST, go back and re-read the numbers from the receipt image again, character by character. You may have misread or transposed a digit. The receipt was generated by a computer, so its numbers are ALWAYS internally consistent.
2. If after re-reading you are CONFIDENT about what the receipt says and the math still doesn't match (e.g. due to rounding or surcharges), report the values exactly as printed.
3. If after re-reading you are UNCERTAIN about specific digits (blurry, smudged, hard to distinguish 3 vs 8, etc.), you MAY use the reverse calculation to resolve the ambiguity. For example: if you can clearly read the subtotal ($127.96) and the price per litre ($2.829), but the quantity looks like it could be "45.23" or "45.28", calculate 127.96 ÷ 2.829 = 45.23 to determine the correct quantity. This is a legitimate use of cross-checking.
4. When you use reverse calculation to resolve an uncertain digit, note this in confidence.issues (e.g. "Used cost÷price to verify litres — digit was unclear").

In short: READ FIRST, calculate second. The reverse calculation is a VALIDATION tool for uncertain digits, not a replacement for reading. If you can clearly read all digits, report them as-is even if the math is off by a cent or two due to rounding.

═══════════════════════════════════════════════════
STEP 3: WHAT TO EXTRACT
═══════════════════════════════════════════════════

RECEIPT DATA:
Look for EVERY separate fuel transaction/line item. Receipts often contain MULTIPLE fuel lines from DIFFERENT pumps (e.g. Pump 5, Pump 8). Each pump/transaction is a SEPARATE fuel fill-up. You MUST detect and list each one individually.

ONLY COUNT ACTUAL FUEL LINES — DO NOT include:
- Discounts (e.g. "FLEET CARD DISCOUNT", negative amounts)
- Surcharges (e.g. "FLEET CARD SURCHARGE", "CARD FEE")
- GST lines, Subtotals, running totals
- Non-fuel products (oil, AdBlue, accessories — these go in "otherItems")

READING LITRES vs PUMP METER READINGS:
1. ACTUAL QUANTITY PURCHASED (what we want) — appears on the SAME LINE as the price-per-litre and total cost. Example: "8.09 L  2.465  19.94" means 8.09L purchased.
2. CUMULATIVE PUMP METER READINGS (IGNORE) — standalone large number on a separate line like "246.5 L". These are the pump's running total, NOT the purchase amount.

RECEIPT LINE FORMAT — TWO-LINE PRODUCTS:
  "1 ADBLUE              26.05 B"      ← AdBlue costs $26.05
  "Pump: 21  13.03 Litre  1.999$/L"    ← AdBlue is 13.03L at $1.999/L
  "1 ULT. DIESEL        383.01 B"      ← Diesel costs $383.01
  "Pump: 22  128.57 Litre  2.979$/L"   ← Diesel is 128.57L at $2.979/L

RECEIPT LINE FORMAT — THREE-LINE PUMP BLOCKS (common on Caltex/Ampol/7-Eleven):
  "Pump 05"                            ← pump identifier line (skip — no values)
  "DIESEL         45.23L @ 2.829"      ← litres 45.23, PPL 2.829
  "                      $127.96"      ← subtotal $127.96
The "L" suffix after a number DEFINITIVELY marks LITRES. The "@" or "$/L" DEFINITIVELY marks PPL. The "$" prefix on the rightmost number DEFINITIVELY marks SUBTOTAL. Use these markers to disambiguate columns.

Each product has its OWN cost, litres, and price-per-litre. Do NOT merge them.

NON-FUEL PURCHASES:
Oil, AdBlue, coolant, car wash, food, etc. List these separately in "otherItems" with litres, cost, and pricePerLitre where applicable.

FLEET CARD DATA — PHYSICAL CARD ONLY:
Look for a PHYSICAL orange/red Shell FleetCard VISIBLE AS A SEPARATE CARD in the photo (not just text on the receipt). If you can only see "FLEETCARD" printed on the receipt paper with no physical plastic card visible, set both cardNumber and vehicleOnCard to null.

The physical card layout:
  Line 1: "FleetCard" logo
  Line 2: 16-digit card number, embossed — always starts with "70343051"
  Line 3: Vehicle type/model (e.g. "NNR-451", "HILUX") — NOT the registration
  Line 4: VEHICLE REGISTRATION — short 5-7 char alphanumeric code (e.g. "DF25LB", "EIA53F")
  Line 5: Expiry date (e.g. "EXP 11/30")

READING PRIORITY: read the REGISTRATION carefully — it's the primary key the app uses to look up the card. The 16-digit embossed card number is hard to read under shadow/glare; the app has a database that maps every rego to its correct card number automatically, so if ANY digit of the card number is uncertain, set cardNumber to null rather than guessing. A null card with a correct rego is MUCH better than a wrong card. The card number always starts with "70343051" — if your reading disagrees with that prefix, re-check.

Also look for handwritten notes, and the vehicle odometer if visible.

═══════════════════════════════════════════════════
STEP 4: OUTPUT FORMAT
═══════════════════════════════════════════════════

Return ONLY valid JSON with no other text:
{
  "date": "DD/MM/YYYY — Australian DAY-FIRST format ALWAYS. '22/03/26' = 22 March 2026 (NEVER 26 March 2022). Never use YY/MM/DD or MM/DD/YYYY interpretations.",
  "station": "station name or null",
  "fuelType": "primary fuel type or null",
  "pricePerLitre": number_in_DOLLARS_per_litre_or_null,
  "totalCost": number_total_on_receipt_or_null,
  "litres": number_total_FUEL_litres_only,
  "lines": [
    {"litres": number, "cost": number_or_null, "pump": "pump number or null", "fuelType": "EXACT fuel type as printed on receipt", "pricePerLitre": number_or_null, "digitsCertain": true_or_false}
  ],
  "otherItems": [
    {"description": "EXACT item name as printed on receipt", "cost": number_or_null, "quantity": "string or null", "litres": number_or_null, "pricePerLitre": number_in_dollars_or_null}
  ],
  "discounts": number_total_discounts_or_null,
  "cardNumber": "full 16 digit fleet card number FROM PHYSICAL CARD or null",
  "vehicleOnCard": "registration from physical fleet card or null",
  "odometer": number_odometer_reading_or_null,
  "handwrittenNotes": "any handwritten text visible or null",
  "confidence": {
    "overall": "high|medium|low",
    "issues": ["list specific concerns about digit clarity, blurry areas, or uncertain readings"]
  }
}

═══════════════════════════════════════════════════
RULES
═══════════════════════════════════════════════════
- "lines" array must ONLY contain actual FUEL dispensed. Never include discounts as a line.
- AdBlue is NOT fuel — it MUST go in "otherItems", NEVER in "lines". Same for DEF.
- CROSS-CHECK EVERY PRODUCT: litres × pricePerLitre ≈ cost. If it doesn't match, RE-READ the digits from the image first. Only use reverse calculation if you genuinely cannot make out a digit.
- "digitsCertain" per line: set to true if you could clearly read all digits for that line. Set to false if any digit was blurry, ambiguous, or you had to use reverse calculation to resolve it. When digitsCertain is false, the system may use cross-checking math to validate your values.
- pricePerLitre must be in DOLLARS ($1.40–$4.00 range). If the printed value is in cents (140–400 range), DIVIDE BY 100. Example: "274.9 c/L" = 2.749 $/L.
- ⚠️ NEVER report a pricePerLitre outside $1.40–$4.00 (dollars) or 140–400 (cents). Any value outside these bands is NOT a PPL — it's a subtotal, total, or pump/transaction number you misidentified. Go back and find the correct small number next to the fuel name.
- Each line MUST have its OWN fuelType and pricePerLitre. Do NOT copy values between lines.
- "otherItems" uses EXACT description as printed. Empty array [] if none. Ignore surcharges/fees.
- "litres" is the total of fuel lines ONLY.
- "cardNumber" null unless PHYSICAL CARD with 16 digits is visible.
- CONFIDENCE: "high" = clear image, all values readable, math checks out. "medium" = some blurry/uncertain digits or used reverse calculation to resolve ambiguity. "low" = very blurry or unreadable. Always list specific digit uncertainties in issues.
- REMEMBER: READ FIRST, calculate second. The receipt's printed numbers are the primary source of truth. Reverse calculation is your backup tool for resolving uncertain digits — not a replacement for careful reading.`;

// ─────────────────────────────────────────────────────────────────────────────
// Fleet card scan prompt — single source of truth for both the combined
// receipt+card flow and the card-only scan flow. Keeping this in one place
// prevents the two call sites from drifting out of sync.
//
// The prompt asks the AI to:
//  1. Report the raw digits it saw (so we can track what it actually read
//     even after our post-processing corrects it).
//  2. Self-report a confidence level based on how clearly it could read the
//     embossed digits — this drives the "Fleet card unclear" admin flag,
//     which is independent of whether the matcher could later map the scan
//     to a known card in the database.
// ─────────────────────────────────────────────────────────────────────────────
const buildCardScanPrompt = () => `Extract fleet card details from this image. This should show a Shell FleetCard — an orange/red plastic card with embossed (raised) digits and text.

CARD LAYOUT (top to bottom):
Line 1: "FleetCard" logo
Line 2: 16-digit card number, EMBOSSED — always starts with "70343051" (the fixed Plateau Trees prefix)
Line 3: Vehicle type/model description (e.g. "NNR-451", "HILUX", "RANGER") — this is NOT the registration
Line 4: VEHICLE REGISTRATION — short 5-7 character alphanumeric code (e.g. "DF25LB", "EIA53F", "BC12AB"). This is the key field to read accurately.
Line 5: Expiry date (e.g. "EXP 11/30")

═══════════════════════════════════════════════════
READING PRIORITY: REGISTRATION FIRST, CARD NUMBER SECOND
═══════════════════════════════════════════════════

The app matches fleet cards to vehicles by REGISTRATION, not by card number. The registration is short (5-7 chars), printed high-contrast, and easy to read. The 16-digit embossed card number is hard to read under glare/shadow and the app has a database that maps every rego to its card number automatically.

Your job:
1. Read the REGISTRATION carefully and accurately. Compare against the expected format (e.g. DF25LB is 2 letters + 2 digits + 2 letters). If any character is ambiguous (O vs 0, I vs 1, 8 vs B), flag it in confidence.issues. This field is the primary lookup key — getting it right is what matters most.
2. Read the 16-digit card number ONLY if clearly legible. If any digit is uncertain, return null for cardNumber rather than guessing — the app will fill it in from the database using the rego. A null cardNumber is MUCH better than a wrong one.

CRITICAL RULES:
- The embossed 16-digit card number always starts with "70343051". If you can see the first 8 digits and they're NOT "70343051", you're misreading — re-examine the image.
- Embossed digits cast shadows under flash. Common misreads: 8↔6, 8↔3, 1↔7, 0↔8, 5↔6, 5↔3, 9↔0. If ANY digit is uncertain, leave cardNumber null.
- The registration is on the line BELOW the vehicle-type line. Don't confuse a model code like "NNR-451" with the rego.
- If you can only see "FLEETCARD" printed on a receipt (not a physical plastic card), there is no card to scan — return null for both fields.
- Your confidence in the REGO is what matters most. If you could read it clearly, overall confidence can be "high" even if the card number was hard to read.

Return ONLY valid JSON (no other text):
{
  "cardNumber": "16-digit card number if clearly legible, else null",
  "vehicleOnCard": "the registration from the rego line (primary field — read this accurately)",
  "rawCardRead": "what you actually saw for the card number, even if uncertain — pass through unchanged",
  "confidence": {
    "overall": "high | medium | low",
    "issues": ["list any uncertain characters, especially on the rego — e.g. '4th rego char could be 5 or S', 'card digits too blurry to read'"]
  }
}

CONFIDENCE GUIDE (based on REGO clarity primarily):
- "high" — rego is unambiguous; card number either clearly readable or cleanly null.
- "medium" — one rego character required careful inspection OR confident rego with uncertain card digits.
- "low" — rego itself is ambiguous, or the card is too blurry/obscured/angled to read any field reliably.`;

// Normalize station name using learned corrections
function normalizeStationName(rawStation, learnedCorrections) {
  if (!rawStation || !learnedCorrections?.stations) return rawStation;
  const trimmed = rawStation.trim();
  const key = trimmed.toUpperCase();
  // Exact match first
  if (learnedCorrections.stations[key]) {
    const canonical = learnedCorrections.stations[key].canonical;
    console.log(`[Learn] Station auto-corrected: "${rawStation}" → "${canonical}"`);
    return canonical;
  }
  // Fuzzy match: try cleaning common variations (removing punctuation, extra spaces)
  const cleaned = key.replace(/[^A-Z0-9\s]/g, "").replace(/\s+/g, " ").trim();
  for (const [storedKey, mapping] of Object.entries(learnedCorrections.stations)) {
    const storedCleaned = storedKey.replace(/[^A-Z0-9\s]/g, "").replace(/\s+/g, " ").trim();
    if (storedCleaned === cleaned) {
      console.log(`[Learn] Station fuzzy-matched: "${rawStation}" → "${mapping.canonical}"`);
      return mapping.canonical;
    }
    // Edit distance check — tightened to dist ≤ 1 plus minimum length, so
    // short-name coincidences (e.g. "BP 1" vs "BP 7") don't auto-merge and
    // nearby-but-distinct sites stay separate. The exact / punct-cleaned
    // comparisons above still handle the common "Shell Penrith." vs "Shell
    // Penrith" case at dist=0.
    const minLen = Math.min(cleaned.length, storedCleaned.length);
    if (minLen >= 6 && cleaned.length <= 40 && storedCleaned.length <= 40 && typeof editDistance === "function") {
      const dist = editDistance(cleaned, storedCleaned);
      if (dist === 1) {
        console.log(`[Learn] Station edit-distance matched (d=1): "${rawStation}" → "${mapping.canonical}"`);
        return mapping.canonical;
      }
    }
  }
  return trimmed;
}

// Apply all learned corrections to freshly scanned receipt data
function applyLearnedCorrections(data, learnedCorrections) {
  if (!data || !learnedCorrections) return data;

  // 1. Station name normalization
  if (data.station) {
    const corrected = normalizeStationName(data.station, learnedCorrections);
    if (corrected !== data.station) {
      data._originalStation = data.station;
      data.station = corrected;
      data._stationCorrected = true;
    }
  }

  // 2. Fuel type correction for known stations
  const station = data.station || "";
  const fuelType = (data.fuelType || "").trim();
  if (station && fuelType && learnedCorrections.fuelTypeCorrections?.[station]) {
    const stationFixes = learnedCorrections.fuelTypeCorrections[station];
    const correctedFuel = stationFixes[fuelType.toUpperCase()];
    if (correctedFuel) {
      console.log(`[Learn] Fuel type auto-corrected at "${station}": "${fuelType}" → "${correctedFuel}"`);
      data._originalFuelType = data.fuelType;
      data.fuelType = correctedFuel;
    }
  }
  // Also correct fuel types in individual lines
  if (data.lines && Array.isArray(data.lines) && station && learnedCorrections.fuelTypeCorrections?.[station]) {
    const stationFixes = learnedCorrections.fuelTypeCorrections[station];
    data.lines.forEach(line => {
      if (line.fuelType) {
        const fix = stationFixes[(line.fuelType || "").toUpperCase()];
        if (fix) line.fuelType = fix;
      }
    });
  }

  // 3. Price sanity check against station history
  if (station && data.pricePerLitre && learnedCorrections.stationPrices?.[station]) {
    const history = learnedCorrections.stationPrices[station];
    if (history.lastPrices && history.lastPrices.length >= 2) {
      const avgPrice = history.lastPrices.reduce((s, p) => s + p, 0) / history.lastPrices.length;
      const scannedPpl = parseFloat(data.pricePerLitre);
      if (scannedPpl > 0 && avgPrice > 0) {
        const deviation = Math.abs(scannedPpl - avgPrice) / avgPrice;
        // 50% deviation was too loose — $2.00/L vs $3.00/L wouldn't flag.
        // Fleet fuel prices rarely move more than ±15% within a few weeks at
        // the same station, so 20% is a conservative anomaly bar.
        if (deviation > 0.2) {
          if (!data._mathIssues) data._mathIssues = [];
          data._mathIssues.push(`Price $${scannedPpl.toFixed(3)}/L unusual for ${station} (avg $${avgPrice.toFixed(3)}/L) — check for digit misread`);
          console.log(`[Learn] Price anomaly at "${station}": scanned $${scannedPpl.toFixed(3)} vs avg $${avgPrice.toFixed(3)} (deviation ${(deviation * 100).toFixed(0)}%)`);
        }
      }
    }
  }

  return data;
}

// Normalize receipt data: ensure lines array exists and totals are consistent
function normalizeReceiptData(data, learnedCorrections) {
  if (!data) return data;
  // DEBUG: Log raw AI output before any normalization
  console.log("═══ RAW AI SCAN OUTPUT ═══");
  console.log("totalCost:", data.totalCost, "litres:", data.litres, "pricePerLitre:", data.pricePerLitre);
  console.log("lines:", JSON.stringify(data.lines, null, 2));
  console.log("otherItems:", JSON.stringify(data.otherItems, null, 2));
  // Capture AI's original totals BEFORE any recalculation — the phantom-line
  // detector below needs a reference point to tell whether extra lines were
  // hallucinated. Without this snapshot, later recalcs (AdBlue removal,
  // discount filter) overwrite data.litres with the line-sum, making the
  // detector compare the sum to itself (always false — dead code).
  const aiOriginal = {
    litres: typeof data.litres === "number" ? data.litres : null,
    totalCost: typeof data.totalCost === "number" ? data.totalCost : null,
    confidenceOverall: (data.confidence?.overall || "").toLowerCase(),
  };
  // Auto-correct year misreads: ONLY when the day+month strongly suggest the
  // receipt is from the last couple of weeks but the year got AI-misread
  // (e.g. "01/04/2025" → "01/04/2026"). Previously this also triggered on
  // `withinReasonableRange` (any ±1-year difference) which silently rewrote
  // legitimately-old receipts. Now we require day+month to be within 7 days
  // of today AND the year to be exactly one off.
  if (data.date) {
    const scannedTs = parseDate(data.date);
    if (scannedTs) {
      const scanned = new Date(scannedTs);
      const now = new Date();
      const currentYear = now.getFullYear();
      const scannedYear = scanned.getFullYear();
      const yearOffByOne = Math.abs(scannedYear - currentYear) === 1;
      if (yearOffByOne) {
        // Compute day-of-year difference (mod 365) so Dec 30 vs Jan 2 counts as close
        const scannedDoy = Math.floor((scanned - new Date(Date.UTC(scannedYear, 0, 1))) / 86400000);
        const nowDoy = Math.floor((now - new Date(Date.UTC(currentYear, 0, 1))) / 86400000);
        const rawDiff = Math.abs(scannedDoy - nowDoy);
        const doyDiff = Math.min(rawDiff, 365 - rawDiff);
        if (doyDiff <= 7) {
          // Replace year in the date string
          const oldYear2 = String(scannedYear).slice(-2);
          const oldYear4 = String(scannedYear);
          const newYear2 = String(currentYear).slice(-2);
          const newYear4 = String(currentYear);
          let fixed = data.date;
          if (fixed.includes(oldYear4)) fixed = fixed.replace(oldYear4, newYear4);
          else if (fixed.includes(oldYear2)) fixed = fixed.replace(new RegExp(`\\b${oldYear2}\\b`), newYear2);
          if (fixed !== data.date) {
            console.log(`[Date Fix] Year auto-corrected (near-today match): "${data.date}" → "${fixed}"`);
            data._originalDate = data.date;
            data.date = fixed;
          }
        }
      }
    }
  }

  // CRITICAL: Auto-correct future dates — receipts can NEVER be in the future.
  // Anchored to today in Sydney (Australia/Sydney), not the device's local
  // clock. Drivers' phones can be set to any timezone and this caused false
  // "future date" flags around midnight.
  if (data.date && isAfterSydneyToday(data.date)) {
    data._originalDate = data._originalDate || data.date;
    // Try swapping day/month (common DD/MM vs MM/DD confusion)
    const parts = data.date.match(/(\d{1,2})\D+(\d{1,2})\D+(\d{2,4})/);
    if (parts) {
      const [ p1, p2, p3] = parts;
      const swapped = `${p2}/${p1}/${p3}`;
      if (!isAfterSydneyToday(swapped)) {
        console.log(`[Date Fix] Future date corrected by swapping day/month: "${data.date}" → "${swapped}"`);
        data.date = swapped;
        data._futureDateCorrected = true;
      } else {
        data._futureDateDetected = true;
        console.warn(`[Date Fix] FUTURE DATE DETECTED: "${data.date}" — cannot auto-correct, user must fix`);
      }
    } else {
      data._futureDateDetected = true;
      console.warn(`[Date Fix] FUTURE DATE DETECTED: "${data.date}" — cannot auto-correct, user must fix`);
    }
  }

  // Ensure lines array exists
  if (!data.lines || !Array.isArray(data.lines) || data.lines.length === 0) {
    data.lines = [{ litres: data.litres || null, cost: data.totalCost || null, pump: null, fuelType: data.fuelType || null }];
  }
  // Ensure otherItems array exists
  if (!data.otherItems || !Array.isArray(data.otherItems)) data.otherItems = [];
  // Filter out fleet card surcharges and transaction fees from otherItems
  data.otherItems = data.otherItems.filter(item => {
    const desc = (item.description || "").toLowerCase();
    if (/surcharge|card\s*fee|transaction\s*fee|fleet\s*card|eftpos\s*fee|merchant\s*fee/i.test(desc)) return false;
    return true;
  });

  // Move AdBlue/DEF from fuel lines to otherItems (AdBlue is NOT fuel)
  const isAdBlue = (fuelType) => {
    const ft = (fuelType || "").toLowerCase();
    return /adblue|ad[\s-]*blue|def\b|diesel\s*exhaust|exhaust\s*fluid|urea|aus\s*32/i.test(ft);
  };
  const adblueLines = data.lines.filter(line => isAdBlue(line.fuelType));
  if (adblueLines.length > 0) {
    data.lines = data.lines.filter(line => !isAdBlue(line.fuelType));
    adblueLines.forEach(ab => {
      data.otherItems.push({
        description: ab.fuelType || "AdBlue",
        cost: ab.cost || null,
        quantity: ab.litres ? `${ab.litres}L` : null,
        litres: ab.litres,
        pricePerLitre: ab.pricePerLitre,
      });
    });
    // CRITICAL: Recalculate data.litres after removing AdBlue from fuel lines
    // The AI may have included AdBlue litres in the total
    const fuelLitresAfterAdBlue = data.lines.reduce((s, l) => s + (l.litres || 0), 0);
    if (fuelLitresAfterAdBlue > 0) {
      data.litres = parseFloat(fuelLitresAfterAdBlue.toFixed(2));
    }
  }

  // Filter out discount/surcharge/non-fuel lines that the AI might have included
  data.lines = data.lines.filter(line => {
    // Remove lines with negative cost (discounts)
    if (line.cost != null && line.cost < 0) return false;
    // Remove lines with zero or no litres
    if (!line.litres || line.litres <= 0) return false;
    // Remove lines whose fuelType suggests it's a discount/fee
    const ft = (line.fuelType || "").toLowerCase();
    if (/discount|surcharge|fee|gst|subtotal/i.test(ft)) return false;
    return true;
  });

  // If all lines were filtered, create a fallback from totals
  if (data.lines.length === 0 && data.litres > 0) {
    data.lines = [{ litres: data.litres, cost: data.totalCost || null, pump: null, fuelType: data.fuelType || null }];
  }

  // ALWAYS recalculate data.litres from remaining fuel lines (after AdBlue removal + filters)
  const postFilterLitres = data.lines.reduce((s, l) => s + (l.litres || 0), 0);
  if (postFilterLitres > 0) {
    data.litres = parseFloat(postFilterLitres.toFixed(2));
  }

  // Detect phantom/duplicate lines — compare against the AI's ORIGINAL
  // reported total (not the recalculated-from-lines value, which would always
  // equal the line sum and make this dead code). Only drop lines when an
  // independent signal (totalCost) confirms the reported total is trustworthy;
  // otherwise the reported total itself may be the misread, and deleting real
  // lines would lose legitimate fuel.
  const aiOrigTotalLitres = aiOriginal.litres;
  const aiOrigTotalCost = aiOriginal.totalCost;
  if (aiOrigTotalLitres && data.lines.length > 1) {
    const lineLitresSum = data.lines.reduce((s, l) => s + (l.litres || 0), 0);
    if (lineLitresSum > aiOrigTotalLitres * 1.5 && lineLitresSum > aiOrigTotalLitres + 20) {
      // Search for the best subset that sums near the reported total
      const sortedLines = [...data.lines].sort((a, b) => (b.litres || 0) - (a.litres || 0));
      let bestSubset = [sortedLines[0]];
      let bestDiff = Math.abs((sortedLines[0]?.litres || 0) - aiOrigTotalLitres);
      for (let i = 0; i < sortedLines.length; i++) {
        for (let j = i + 1; j < sortedLines.length; j++) {
          const sum = (sortedLines[i].litres || 0) + (sortedLines[j].litres || 0);
          const diff = Math.abs(sum - aiOrigTotalLitres);
          if (diff < bestDiff) { bestDiff = diff; bestSubset = [sortedLines[i], sortedLines[j]]; }
        }
      }
      if (bestSubset.length < data.lines.length) {
        // Cost corroboration: compare subset vs full-line cost sums to the AI's
        // reported totalCost. Two independent signals agreeing (litres + cost)
        // is the bar for dropping real-looking lines.
        const subsetCost = bestSubset.reduce((s, l) => s + (l.cost || 0), 0);
        const fullLinesCost = data.lines.reduce((s, l) => s + (l.cost || 0), 0);
        const tolerance = aiOrigTotalCost > 0 ? Math.min(aiOrigTotalCost * 0.05, 5) : 0;
        const subsetCostMatches = aiOrigTotalCost > 0 && subsetCost > 0 &&
          Math.abs(subsetCost - aiOrigTotalCost) < tolerance;
        const fullCostMatches = aiOrigTotalCost > 0 && fullLinesCost > 0 &&
          Math.abs(fullLinesCost - aiOrigTotalCost) < tolerance;
        const aiLowConf = aiOriginal.confidenceOverall === "low";

        data._mathIssues = data._mathIssues || [];
        if (subsetCostMatches && !fullCostMatches && !aiLowConf) {
          // Both signals agree: reported total is right, extra lines are phantoms.
          data._mathIssues.push(`Removed ${data.lines.length - bestSubset.length} phantom fuel line(s) — AI detected ${data.lines.length} but litres AND cost confirm ~${aiOrigTotalLitres}L total.`);
          data.lines = bestSubset;
        } else if (fullCostMatches) {
          // Line costs sum to the reported total — the lines are correct and
          // the REPORTED TOTAL LITRES is the misread. Keep all lines, let the
          // downstream recalc set data.litres from the line sum. Flag for review.
          data._mathIssues.push(`Scanned ${data.lines.length} fuel line(s) summing ${lineLitresSum.toFixed(2)}L — line costs match total, so reported total of ~${aiOrigTotalLitres}L looks misread. Using line sum.`);
        } else {
          // Ambiguous — neither signal corroborates. Leave lines intact and flag
          // for manual review so the user can decide.
          data._mathIssues.push(`Scanned ${data.lines.length} fuel line(s) summing ${lineLitresSum.toFixed(2)}L vs reported ${aiOrigTotalLitres}L. Cost data couldn't resolve the mismatch — please review manually before submitting.`);
        }
      }
    }
  }

  // ── PPL sanity correction ──
  // Australian retail PPL is ALWAYS between $1.40 and $4.00/L.
  // Some receipts print it in cents (274.9) — divide by 100 to get dollars (2.749).
  // But if the AI grabbed a SUBTOTAL (e.g. 141.56) by mistake, dividing by 100 gives
  // a plausible-looking but wrong PPL (1.4156). Defend against that by comparing
  // the claimed PPL to what cost÷litres implies, and preferring the latter when
  // cost÷litres lands cleanly in the $1.40–$4.00 band.
  const PPL_MIN = 1.40, PPL_MAX = 4.00;
  const pplFromCostLitres = (c, l) => (c > 0 && l > 0) ? (c / l) : null;
  const inPplBand = (v) => v != null && v >= PPL_MIN && v <= PPL_MAX;

  // correctPpl decides between trusting the AI's reported PPL and substituting
  // a cost÷litres-derived value. The critical risk is a cascade: if litres is
  // misread but PPL is correct, cost÷litres produces a wrong implied PPL and
  // we would overwrite a CORRECT field with a WRONG one.
  //
  // Gating rules:
  //   • trustAiRead = AI said digits were certain AND the cents/dollars
  //     conversion (if needed) already lands in-band. When trustAiRead is
  //     true we never let implied-from-math overwrite it — we only use the
  //     implied value to flag a mismatch.
  //   • When the AI itself flagged uncertainty (digitsCertain === false),
  //     we DO use implied as before.
  //   • When we have no digitsCertain signal (top-level, or missing), we
  //     fall back to the old behaviour — use implied only if AI's value is
  //     out-of-band or blatantly wrong (>15% off), so tiny rounding
  //     differences can't flip a correct PPL.
  const correctPpl = (reported, cost, litres, context, digitsCertain) => {
    if (reported == null) return { value: null, note: null };
    const asIs = reported;
    const asCents = reported > 10 ? reported / 100 : null;
    const implied = pplFromCostLitres(cost, litres);

    // Pick the interpretation of `reported` that lands in-band.
    let inBandReported = null;
    if (inPplBand(asIs)) inBandReported = asIs;
    else if (asCents != null && inPplBand(asCents)) inBandReported = Math.round(asCents * 10000) / 10000;

    const trustAiRead = digitsCertain === true && inBandReported != null;

    if (inPplBand(implied)) {
      const rounded = Math.round(implied * 10000) / 10000;
      // AI value matches implied (within 1c) → trust AI value directly
      if (Math.abs(asIs - implied) < 0.015) return { value: asIs, note: null };
      if (asCents != null && Math.abs(asCents - implied) < 0.015) return { value: Math.round(asCents * 10000) / 10000, note: null };

      // AI value disagrees with implied. What we do next depends on the
      // AI's self-reported certainty on THIS field.
      if (trustAiRead) {
        // The AI explicitly said the digits were clear. A mismatch here
        // usually means litres or cost was misread — DO NOT overwrite the
        // PPL, just surface the discrepancy for manual review.
        return {
          value: inBandReported,
          note: `${context}: PPL $${inBandReported}/L disagrees with cost÷litres ($${rounded}/L) — AI reported high certainty on PPL, so likely litres or cost was misread. Flagging for review.`,
        };
      }
      if (digitsCertain === false) {
        // AI told us it was unsure about this line's digits — fine to use
        // reverse-calc to resolve the ambiguity.
        return { value: rounded, note: `${context}: PPL ${reported} looked wrong (cost/litres implies $${rounded}/L) — corrected using cross-check (AI flagged digits as uncertain).` };
      }
      // No per-field certainty signal. Be conservative: only override if the
      // AI's reading is WAY off (>15%) — small discrepancies are more likely
      // rounding/surcharges than a PPL misread.
      const implDiff = inBandReported != null ? Math.abs(inBandReported - rounded) / rounded : 1;
      if (inBandReported != null && implDiff < 0.15) {
        return {
          value: inBandReported,
          note: `${context}: PPL $${inBandReported}/L differs from cost÷litres ($${rounded}/L) by ${(implDiff * 100).toFixed(1)}% — keeping AI-read value; please verify.`,
        };
      }
      return { value: rounded, note: `${context}: PPL ${reported} looked wrong (cost/litres implies $${rounded}/L) — corrected from printed subtotal.` };
    }
    // No reliable cost÷litres → fall back to range-based interpretation
    if (inPplBand(asIs)) return { value: asIs, note: null };
    if (inPplBand(asCents)) return { value: Math.round(asCents * 10000) / 10000, note: null };
    // Can't validate → null it out rather than keep a garbage number
    return { value: null, note: `${context}: PPL ${reported} outside valid $1.40–$4.00 range — cleared for manual review.` };
  };

  data._mathIssues = data._mathIssues || [];
  // Top-level PPL — no per-field digitsCertain exists, so defer to overall
  // scan confidence: treat "high" overall as a trust signal.
  const topLevelDigitsCertain = (data.confidence?.overall === "high") ? true : (data.confidence?.overall === "low" ? false : undefined);
  {
    // IMPORTANT: Only reverse-calc the top-level PPL against totalCost when the
    // receipt has a SINGLE fuel line and NO other items. Otherwise totalCost
    // includes adblue/oil/other items and the math will mislead us into
    // "correcting" a perfectly good PPL. Per-line correction below handles
    // multi-line receipts using each line's own subtotal.
    const singleFuelLine = Array.isArray(data.lines) && data.lines.length === 1;
    const noOtherItems = !Array.isArray(data.otherItems) || data.otherItems.length === 0;
    const noDiscounts = !data.discounts || data.discounts === 0;
    const safeToUseTotal = singleFuelLine && noOtherItems && noDiscounts;
    // Prefer the single line's own subtotal if present, else fall back to totalCost when safe
    const topLevelCost = singleFuelLine && data.lines[0]?.cost != null
      ? data.lines[0].cost
      : (safeToUseTotal ? data.totalCost : null);
    const topLevelLitres = singleFuelLine && data.lines[0]?.litres != null
      ? data.lines[0].litres
      : (safeToUseTotal ? data.litres : null);
    const { value, note } = correctPpl(data.pricePerLitre, topLevelCost, topLevelLitres, "Receipt", topLevelDigitsCertain);
    if (value !== data.pricePerLitre) {
      if (data.pricePerLitre != null) data._originalPpl = data.pricePerLitre;
      data.pricePerLitre = value;
    }
    if (note) data._mathIssues.push(note);
  }
  // Per-line PPL — use per-line cost/litres (much more accurate than totals)
  data.lines = data.lines.map((line, idx) => {
    const { value, note } = correctPpl(line.pricePerLitre, line.cost, line.litres, `Line ${idx + 1}`, line.digitsCertain);
    if (value !== line.pricePerLitre) {
      if (line.pricePerLitre != null) line._originalPpl = line.pricePerLitre;
      line.pricePerLitre = value;
      if (value != null) line._pplCorrected = true;
    }
    if (note) data._mathIssues.push(note);
    return line;
  });

  // ── Fuel math cross-check: litres × pricePerLitre = cost ──
  // PHILOSOPHY: The AI reads numbers directly from a computer-printed receipt.
  // The receipt's own numbers are ALWAYS internally consistent (qty × price = subtotal).
  // If the math doesn't check out, the AI misread a digit — we should FLAG it for review
  // rather than silently "correcting" values, which can make things worse.
  // We ONLY fill in genuinely MISSING values, never override confident AI-read values.
  // BUT if the AI flagged uncertainty (digitsCertain: false or confidence: medium/low),
  // we use reverse calculation cross-checks to validate and correct.
  const ppl = data.pricePerLitre;
  data._mathIssues = data._mathIssues || [];

  // If overall confidence is medium or low, mark all lines as uncertain so cross-checking kicks in
  const overallConfidence = data.confidence?.overall || "high";
  if (overallConfidence === "medium" || overallConfidence === "low") {
    data.lines.forEach(line => {
      if (line.digitsCertain === undefined || line.digitsCertain === null) {
        line.digitsCertain = false; // treat as uncertain when AI isn't confident overall
      }
    });
  }

  // If there's only one fuel line and it's missing cost, inherit from totalCost —
  // but ONLY if there are no otherItems/discounts (otherwise totalCost includes
  // adblue/oil/fees and would overstate the fuel line's subtotal).
  if (data.lines.length === 1 && !data.lines[0].cost && data.totalCost) {
    const noOtherItems = !Array.isArray(data.otherItems) || data.otherItems.length === 0;
    const noDiscounts = !data.discounts || data.discounts === 0;
    if (noOtherItems && noDiscounts) {
      data.lines[0].cost = data.totalCost;
    }
  }

  data.lines = data.lines.map((line, idx) => {
    const litres = line.litres;
    const cost = line.cost;
    const price = line.pricePerLitre || ppl;

    // ONLY fill in genuinely MISSING values from the other two — never override existing ones
    if (litres && cost && !line.pricePerLitre && !ppl) {
      // Have litres and cost, missing price → calculate it
      line.pricePerLitre = parseFloat((cost / litres).toFixed(4));
    } else if (cost && price && !litres) {
      // Have cost and price, missing litres → calculate it
      line.litres = parseFloat((cost / price).toFixed(2));
    } else if (litres && price && !cost) {
      // Have litres and price, missing cost → calculate it
      line.cost = parseFloat((litres * price).toFixed(2));
    }

    // If all 3 exist, verify consistency using cross-check math.
    // How aggressively we correct depends on whether the AI flagged uncertainty (digitsCertain).
    if (line.litres && line.cost && line.cost > 0 && (line.pricePerLitre || ppl)) {
      const lp = line.pricePerLitre || ppl;
      const expected = line.litres * lp;
      const diff = Math.abs(expected - line.cost);
      const tolerance = line.cost * 0.03; // 3% tolerance for rounding
      const uncertain = line.digitsCertain === false; // AI flagged this line as uncertain

      if (diff > tolerance && diff > 0.50) {
        const calcPrice = parseFloat((line.cost / line.litres).toFixed(4));
        const calcLitres = parseFloat((line.cost / lp).toFixed(2));
        const priceFromCostLitres = line.cost / line.litres;
        const priceReasonable = priceFromCostLitres >= 1.0 && priceFromCostLitres <= 4.5;

        if (uncertain) {
          // AI was UNCERTAIN about its reading — use reverse calculation to validate/correct.
          // This is the intended use: the AI couldn't clearly read the digits, so math helps.
          data._mathIssues.push(`Line ${idx+1}: AI uncertain — cross-checking ${line.litres}L × $${lp}/L = $${expected.toFixed(2)} vs subtotal $${line.cost}`);

          if (priceReasonable && Math.abs(calcPrice - lp) > 0.01) {
            // Cost and litres imply a reasonable price different from what AI read → fix price
            line._originalPpl = line.pricePerLitre;
            line.pricePerLitre = calcPrice;
            line._corrected = true;
            data._mathIssues.push(`Line ${idx+1}: price corrected via cross-check: $${lp}/L → $${calcPrice}/L`);
          } else if (lp >= 1.0 && lp <= 4.5) {
            // Price and cost look reliable → fix litres
            line._originalLitres = line.litres;
            line.litres = calcLitres;
            line._corrected = true;
            data._mathIssues.push(`Line ${idx+1}: litres corrected via cross-check: ${litres} → ${calcLitres}`);
          }
        } else {
          // AI was CONFIDENT about its reading — only flag, don't auto-correct small differences.
          // Only intervene for major misreads (>15%) like pump meter totals or cents vs dollars.
          data._mathIssues.push(`Line ${idx+1}: ${line.litres}L × $${lp}/L = $${expected.toFixed(2)} but subtotal is $${line.cost} (diff $${diff.toFixed(2)}) — verify receipt digits`);

          if (diff > line.cost * 0.15 && diff > 5.00) {
            if (priceReasonable && Math.abs(calcPrice - lp) > 0.05) {
              line._originalPpl = line.pricePerLitre;
              line.pricePerLitre = calcPrice;
              line._corrected = true;
              data._mathIssues.push(`Line ${idx+1}: price likely misread — adjusted from $${lp}/L to $${calcPrice}/L`);
            } else if (lp >= 1.0 && lp <= 4.5 && line.litres > 200 && line.cost < 200) {
              const cL = parseFloat((line.cost / lp).toFixed(2));
              line._originalLitres = line.litres;
              line.litres = cL;
              line._corrected = true;
              data._mathIssues.push(`Line ${idx+1}: litres ${litres} looks like pump meter reading — adjusted to ${cL}`);
            }
          }
        }
      }
    }
    return line;
  });

  // Recalculate totals ONLY from corrected lines (where we had to fix pump meter misreads etc.)
  const lineSum = data.lines.reduce((s, l) => s + (l.litres || 0), 0);
  if (!data.litres || data.lines.some(l => l._corrected)) {
    data.litres = parseFloat(lineSum.toFixed(2));
  }

  // Update global pricePerLitre ONLY if missing — trust AI-read value first
  if (data.lines.some(l => l._corrected) && data.lines.length === 1 && data.lines[0].pricePerLitre) {
    data.pricePerLitre = data.lines[0].pricePerLitre;
  }
  if (!data.pricePerLitre && data.litres && data.totalCost) {
    // No price was read from receipt — calculate it as fallback
    const otherItemsCostForPpl = data.otherItems.reduce((s, item) => s + (item.cost || 0), 0);
    const fuelOnlyCostForPpl = data.totalCost - otherItemsCostForPpl;
    const costForPpl = (fuelOnlyCostForPpl > 0 && fuelOnlyCostForPpl > data.totalCost * 0.3)
      ? fuelOnlyCostForPpl : data.totalCost;
    data.pricePerLitre = parseFloat((costForPpl / data.litres).toFixed(4));
  } else if (data.pricePerLitre && data.litres && data.totalCost) {
    // Price WAS read from receipt — only flag if it seems very wrong, but do NOT override
    const otherItemsCostForPpl = data.otherItems.reduce((s, item) => s + (item.cost || 0), 0);
    const fuelOnlyCostForPpl = data.totalCost - otherItemsCostForPpl;
    const costForPpl = (fuelOnlyCostForPpl > 0 && fuelOnlyCostForPpl > data.totalCost * 0.3)
      ? fuelOnlyCostForPpl : data.totalCost;
    const pplDiff = Math.abs(data.pricePerLitre * data.litres - costForPpl);
    if (pplDiff > costForPpl * 0.10 && pplDiff > 5.00) {
      const calcGlobalPpl = parseFloat((costForPpl / data.litres).toFixed(4));
      data._mathIssues.push(`Price/L check: $${data.pricePerLitre}/L × ${data.litres}L = $${(data.pricePerLitre * data.litres).toFixed(2)} vs fuel cost $${costForPpl.toFixed(2)} — verify receipt`);
      // Only override if the difference is massive (>25%) suggesting a major misread
      if (pplDiff > costForPpl * 0.25) {
        data._mathIssues.push(`Price/L overridden: $${data.pricePerLitre}/L → $${calcGlobalPpl}/L (>25% discrepancy)`);
        data.pricePerLitre = calcGlobalPpl;
      }
    }
  }

  // ── Verify sum of line costs matches receipt total ──
  // Flag large discrepancies but be conservative about overriding AI-read line values.
  // The AI was instructed to read each number exactly as printed — trust that over calculations.
  if (data.totalCost && data.lines.length > 0) {
    const lineCostSum = data.lines.reduce((s, l) => s + (l.cost || 0), 0);
    const otherCostSum = data.otherItems.reduce((s, item) => s + (item.cost || 0), 0);
    const expectedProductTotal = lineCostSum + otherCostSum;

    if (lineCostSum > 0) {
      const totalDiff = Math.abs(data.totalCost - expectedProductTotal);

      // Only intervene for VERY large discrepancies (>25% and >$20)
      // Smaller differences are likely surcharges/fees/rounding — flag but don't override
      if (totalDiff > 20 && totalDiff > data.totalCost * 0.25) {
        data._mathIssues.push(`Line costs ($${lineCostSum.toFixed(2)}) + other ($${otherCostSum.toFixed(2)}) = $${expectedProductTotal.toFixed(2)} vs receipt total $${data.totalCost} — large discrepancy, needs review`);

        const fuelCost = data.totalCost - otherCostSum;
        if (data.lines.length === 1 && fuelCost > 0) {
          // Single fuel line with massive cost mismatch — the AI probably missed the subtotal
          // Only override cost if the line has no cost at all, or if discrepancy is extreme
          if (!data.lines[0].cost || Math.abs(data.lines[0].cost - fuelCost) > fuelCost * 0.5) {
            data.lines[0].cost = parseFloat(fuelCost.toFixed(2));
            if (data.lines[0].litres) {
              data.lines[0].pricePerLitre = parseFloat((fuelCost / data.lines[0].litres).toFixed(4));
            }
            data.lines[0]._corrected = true;
          }
        }
        // For multi-line: do NOT redistribute costs — flag for human review instead
      } else if (totalDiff > 5 && totalDiff > data.totalCost * 0.05) {
        // Moderate discrepancy — likely surcharges or fees, just flag it
        data._mathIssues.push(`Note: line costs ($${expectedProductTotal.toFixed(2)}) differ from receipt total ($${data.totalCost}) by $${totalDiff.toFixed(2)} — likely surcharges/fees`);
      }
    }
  }

  // If totalCost is missing, sum from lines
  if (!data.totalCost && data.lines.length > 0) {
    const lineTotal = data.lines.reduce((s, l) => s + (l.cost || 0), 0);
    if (lineTotal > 0) data.totalCost = parseFloat(lineTotal.toFixed(2));
  }

  // Calculate fuel-only cost (totalCost minus non-fuel items and plus discounts)
  const otherItemsCost = data.otherItems.reduce((s, item) => s + (item.cost || 0), 0);
  const fuelOnlyCost = data.lines.reduce((s, l) => s + (l.cost || 0), 0);
  data.fuelCost = fuelOnlyCost > 0 ? parseFloat(fuelOnlyCost.toFixed(2)) : data.totalCost;
  data.otherItemsCost = otherItemsCost > 0 ? parseFloat(otherItemsCost.toFixed(2)) : 0;

  // DEBUG: Log final normalized output
  console.log("═══ AFTER NORMALIZATION ═══");
  console.log("totalCost:", data.totalCost, "litres:", data.litres, "pricePerLitre:", data.pricePerLitre, "fuelCost:", data.fuelCost);
  console.log("lines:", JSON.stringify(data.lines, null, 2));
  console.log("otherItems:", JSON.stringify(data.otherItems, null, 2));
  if (data._mathIssues?.length) console.log("mathIssues:", data._mathIssues);

  // Apply learned corrections (station names, fuel types, price sanity checks)
  if (learnedCorrections) {
    applyLearnedCorrections(data, learnedCorrections);
  }

  return data;
}

// ─── Known card/rego exceptions ────────────────────────────────────────────
// Real-world fleet cards that are embossed with a DIFFERENT rego than the
// actual vehicle they belong to (database/admin errors that cannot be fixed
// without re-issuing the physical card). These pairs are ALLOWED to coexist —
// fuzzy-matching should NOT try to "correct" one to the other, and flagging
// logic should mark them as "known exception" rather than a data-entry error.
// Format: { cardRego, vehicleRego, driver, reason }
const KNOWN_CARD_REGO_EXCEPTIONS = [
  { cardRego: "WIA53F", vehicleRego: "EIA53F", driver: "Carlos Carillo", reason: "Fleet card embossed with wrong rego; physical card still in use" },
];
function isKnownCardRegoException(cardRego, vehicleRego) {
  if (!cardRego || !vehicleRego) return null;
  const cr = cardRego.toUpperCase().replace(/\s+/g, "");
  const vr = vehicleRego.toUpperCase().replace(/\s+/g, "");
  return KNOWN_CARD_REGO_EXCEPTIONS.find(e =>
    (e.cardRego === cr && e.vehicleRego === vr) ||
    (e.cardRego === vr && e.vehicleRego === cr)
  ) || null;
}

// ─── Fuzzy Fleet Card Matching ──────────────────────────────────────────────
// Compares a scanned value against known fleet cards/regos and auto-corrects
// misreads. Uses "edit distance" — the number of character changes needed to
// turn one string into another. E.g. "DI5OD" vs "DI05QD" = distance 2.
// If the scanned value is very close to a known value (within 2 changes),
// we assume the AI misread it and correct it automatically.

function editDistance(a, b) {
  // Levenshtein distance — counts minimum insertions, deletions, substitutions
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// All Plateau Trees fleet cards share this prefix — NEVER changes
const FLEET_CARD_PREFIX = "70343051";

// Vehicle types ranked by typical fuel consumption (highest first)
// Used to match fuel lines to vehicles: highest litres → largest consumer
const VEHICLE_FUEL_RANK = {
  "Truck": 1, "Excavator": 2, "EWP": 3, "Chipper": 4,
  "Ute": 5, "Stump Grinder": 6, "Landscape Tractor": 7, "Hired Vehicle": 8,
  "Trailer": 9, "Mower": 10, "Other": 11,
};

// Sort vehicles so largest consumers come first, then match sorted fuel lines (highest litres first)
function smartMatchLinesToVehicles(vehicles, fuelLines) {
  // vehicles: [{ id, type, litres?, ... }]  fuelLines: [{ litres, cost, ... }]
  if (!fuelLines || fuelLines.length === 0 || vehicles.length === 0) return [];

  // Sort fuel lines by litres descending (highest first)
  const sortedLines = [...fuelLines].sort((a, b) => (b.litres || 0) - (a.litres || 0));

  // Sort vehicles by fuel consumption rank (largest consumer first)
  const rankedVehicles = vehicles.map((v, origIdx) => ({
    ...v, origIdx, rank: VEHICLE_FUEL_RANK[v.type] || 99,
  })).sort((a, b) => a.rank - b.rank);

  // Match: biggest fuel line → biggest consumer vehicle
  const matches = new Array(vehicles.length).fill(null);
  rankedVehicles.forEach((v, i) => {
    if (i < sortedLines.length) {
      matches[v.origIdx] = sortedLines[i];
    }
  });
  return matches;
}

// Reconcile learned card mappings with the current static DB.
// Admin edits to DRIVER_CARDS / REGO_DB (source code) or to the "Learned Card
// Corrections" admin section must flow into the learning system — otherwise a
// stale mapping will override the corrected DB on every scan (because the
// learned layer is checked BEFORE the static DB in fuzzyMatchFleetCard).
//
// For each learned mapping, we look up what the static DB currently says for
// its `correctRego`. If the DB's card number differs from the mapping's
// remembered `correctCard`, we update the mapping in place — preserving the
// valuable "AI misread pattern" learning but refreshing the card target to
// match admin's authoritative edit.
//
// Returns { reconciled, changed } where `changed` is the number of mappings
// that were updated. Pure function — no side effects.
function reconcileCardMappingsWithDB(mappings) {
  if (!mappings || typeof mappings !== "object") return { reconciled: {}, changed: 0 };
  const keys = Object.keys(mappings);
  if (keys.length === 0) return { reconciled: mappings, changed: 0 };

  // Build rego → canonical card lookup. DRIVER_CARDS wins when both sources
  // list a rego (it's the curated primary list); REGO_DB fills in the rest.
  const regoToCard = {};
  DRIVER_CARDS.forEach(d => {
    if (!d.r || !d.c) return;
    const r = d.r.toUpperCase().replace(/\s+/g, "");
    const c = d.c.replace(/\s/g, "");
    if (c.length >= 16 && !c.includes("*")) regoToCard[r] = c;
  });
  REGO_DB.forEach(v => {
    if (!v.r || !v.c) return;
    const r = v.r.toUpperCase().replace(/\s+/g, "");
    const c = v.c.replace(/\s/g, "");
    if (c.length >= 16 && !c.includes("*") && !regoToCard[r]) regoToCard[r] = c;
  });

  // Build the set of ALL canonical card numbers currently in use so we can
  // detect a different kind of staleness: when a mapping's raw-AI-read card
  // value now matches a genuine canonical card belonging to a DIFFERENT
  // vehicle. Keeping such a mapping would misroute future scans of that
  // other vehicle back to this mapping's correctRego — a cross-card
  // contamination bug. Drop those mappings.
  const canonicalCards = new Set(Object.values(regoToCard));
  const canonicalCardSuffixes = new Set(
    [...canonicalCards].map(c => c.length >= 8 ? c.slice(-8) : c)
  );

  const reconciled = {};
  let changed = 0;
  let dropped = 0;
  for (const [key, m] of Object.entries(mappings)) {
    const correctRego = (m?.correctRego || "").toUpperCase().replace(/\s+/g, "");
    const staticCard = correctRego ? regoToCard[correctRego] : null;

    // Cross-card collision check: does the mapping's rawCard (or its suffix,
    // or the key itself for card-keyed mappings) now match a canonical card
    // that ISN'T this mapping's own target?
    const rawCard = ((m?.rawCard || "") + "").replace(/[\s*]/g, "").toUpperCase();
    const rawCardFromKey = !key.startsWith("rego_") ? key.toUpperCase() : "";
    const candidates = [rawCard, rawCardFromKey].filter(Boolean);
    const ownTargetCard = staticCard || (m?.correctCard || "").replace(/\s/g, "");
    const collidesWithOtherCanonical = candidates.some(cand => {
      if (!cand) return false;
      // Direct full-card match with a canonical card that isn't ours
      if (canonicalCards.has(cand) && cand !== ownTargetCard) return true;
      // Suffix match (legacy-keyed mapping could collide via last-8)
      if (cand.length >= 8) {
        const suffix = cand.slice(-8);
        const ownSuffix = ownTargetCard ? ownTargetCard.slice(-8) : "";
        if (canonicalCardSuffixes.has(suffix) && suffix !== ownSuffix) return true;
      }
      return false;
    });
    if (collidesWithOtherCanonical) {
      console.log(`[Card Learning] Dropping stale mapping "${key}" for ${correctRego || "(no rego)"} — its raw-read now matches a different canonical card number (would misroute other scans).`);
      dropped++;
      continue; // excluded from reconciled
    }

    if (staticCard) {
      const cleanLearned = (m.correctCard || "").replace(/\s/g, "");
      if (cleanLearned !== staticCard) {
        console.log(`[Card Learning] Reconciling ${correctRego}: learned card ${cleanLearned || "(none)"} → DB card ${staticCard}`);
        reconciled[key] = {
          ...m,
          correctCard: staticCard,
          _reconciledAt: new Date().toISOString(),
          _prevCorrectCard: cleanLearned || null,
        };
        changed++;
        continue;
      }
    }
    reconciled[key] = m;
  }
  return { reconciled, changed, dropped };
}

function fuzzyMatchFleetCard(scannedCard, scannedRego, learnedDB, learnedCardMappings) {
  if (!scannedCard && !scannedRego) return { cardNumber: null, vehicleOnCard: null };

  // Known card/rego exceptions — real-world cards embossed with a rego that
  // differs from the actual vehicle. When the scanned card rego matches an
  // exception, pass through the card rego AS-IS (it's genuinely what's on the
  // card) but also surface the actual vehicle rego so the form/entry uses it.
  if (scannedRego) {
    const cleanScannedRego = scannedRego.toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9]/g, "");
    const exception = KNOWN_CARD_REGO_EXCEPTIONS.find(e => e.cardRego === cleanScannedRego);
    if (exception) {
      return {
        cardNumber: scannedCard || null,
        vehicleOnCard: cleanScannedRego, // what the card literally says — e.g. WIA53F
        actualVehicleRego: exception.vehicleRego, // the real vehicle — e.g. EIA53F
        _corrected: false,
        _confidence: "high",
        _knownException: exception,
        _originalCard: scannedCard,
        _originalRego: scannedRego,
      };
    }
  }

  // ── Check learned corrections first (instant match from previous user edits) ──
  //
  // Key policy:
  //   • NEW mappings are keyed by the FULL cleaned AI-read card number (or
  //     `rego_<REGO>` when no card was available). Keying by the full string
  //     avoids the collision risk of last-8-only keys when the fleet grows.
  //   • LEGACY mappings keyed by last-8 are still honoured for backward
  //     compatibility, but only when there is NO ambiguity — i.e. exactly
  //     one stored mapping resolves to that suffix. Otherwise we skip and
  //     let REGO_DB matching take over rather than silently guessing.
  //   • Confidence: a mapping with confirmCount < 2 is returned as "medium"
  //     — a single user correction could itself have been a slip. After a
  //     second confirming correction it becomes "high".
  if (learnedCardMappings && Object.keys(learnedCardMappings).length > 0) {
    const cleanScan = scannedCard ? scannedCard.replace(/[\s*]/g, "").toUpperCase() : "";
    const cleanRego = scannedRego ? scannedRego.toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9]/g, "") : "";

    const confidenceFor = (mapping) => (mapping?.confirmCount >= 2 ? "high" : "medium");

    const resolveCardMapping = (scan) => {
      if (!scan) return null;
      // 1) Exact full-card match (new-format key).
      if (learnedCardMappings[scan]) return { mapping: learnedCardMappings[scan], source: "exact" };
      // 2) Last-8 key match (legacy format).
      const scanSuffix = scan.length > 8 ? scan.slice(-8) : scan;
      if (learnedCardMappings[scanSuffix] && scanSuffix !== scan) {
        return { mapping: learnedCardMappings[scanSuffix], source: "legacy-suffix" };
      }
      // 3) Suffix scan across new-format keys — only accept when unambiguous.
      if (scanSuffix.length >= 4) {
        const suffixMatches = [];
        for (const [key, m] of Object.entries(learnedCardMappings)) {
          if (key.startsWith("rego_")) continue;
          if (key === scanSuffix) continue; // already considered in (2)
          // Compare either the stored rawCard or the key itself.
          const storedRaw = (m.rawCard || key || "").toUpperCase();
          if (storedRaw.length >= 8 && storedRaw.slice(-8) === scanSuffix) {
            suffixMatches.push(m);
          }
        }
        if (suffixMatches.length === 1) return { mapping: suffixMatches[0], source: "suffix-unique" };
        // >1 candidates → ambiguous, deliberately don't pick one.
      }
      return null;
    };

    if (cleanScan) {
      const hit = resolveCardMapping(cleanScan);
      if (hit) {
        const { mapping, source } = hit;
        console.log(`Fleet card auto-corrected from learned mapping (${source}): "${cleanScan}" → ${mapping.correctCard} (${mapping.correctRego}) — confirmCount=${mapping.confirmCount || 1}`);
        return {
          cardNumber: mapping.correctCard,
          vehicleOnCard: mapping.correctRego,
          _corrected: true,
          _confidence: confidenceFor(mapping),
          _confusableRegos: null,
          _originalCard: scannedCard,
          _originalRego: scannedRego,
          _learnedMatch: true,
          _learnedSource: source,
          _learnedConfirmCount: mapping.confirmCount || 1,
        };
      }
    }

    if (cleanRego) {
      const regoMapping = learnedCardMappings[`rego_${cleanRego}`];
      if (regoMapping) {
        console.log(`Fleet card auto-corrected from learned rego mapping: "${cleanRego}" → ${regoMapping.correctCard} — confirmCount=${regoMapping.confirmCount || 1}`);
        return {
          cardNumber: regoMapping.correctCard,
          vehicleOnCard: regoMapping.correctRego,
          _corrected: true,
          _confidence: confidenceFor(regoMapping),
          _confusableRegos: null,
          _originalCard: scannedCard,
          _originalRego: scannedRego,
          _learnedMatch: true,
          _learnedSource: "rego",
          _learnedConfirmCount: regoMapping.confirmCount || 1,
        };
      }
    }
  }

  // Build a list of all known fleet cards and regos from REGO_DB + learnedDB
  const knownCards = []; // { card, rego, unique8, source }
  REGO_DB.forEach(v => {
    if (v.c && v.c.length >= 6) {
      const cleanCard = v.c.replace(/[\s]/g, "");
      if (cleanCard.includes("*") || cleanCard.length < 16) return;
      knownCards.push({ card: cleanCard, rego: v.r.toUpperCase().replace(/\s+/g, ""), unique8: cleanCard.slice(-8), source: v });
    }
  });
  if (learnedDB) {
    Object.entries(learnedDB).forEach(([rego, data]) => {
      if (data.c && data.c.length >= 6) {
        const cleanCard = data.c.replace(/[\s*]/g, "");
        if (!knownCards.some(k => k.card === cleanCard && k.rego === rego)) {
          knownCards.push({ card: cleanCard, rego: rego.toUpperCase().replace(/\s+/g, ""), unique8: cleanCard.slice(-8), source: data });
        }
      }
    });
  }

  // Build rego lookup list
  const allRegos = REGO_DB.map(v => ({ rego: v.r.toUpperCase().replace(/\s+/g, ""), source: v }));
  if (learnedDB) {
    Object.entries(learnedDB).forEach(([rego, data]) => {
      allRegos.push({ rego: rego.toUpperCase().replace(/\s+/g, ""), source: data });
    });
  }

  let bestMatch = null;
  let bestScore = Infinity;
  const cleanScannedCard = scannedCard ? scannedCard.replace(/[\s*]/g, "").toUpperCase() : "";
  const cleanScannedRego = scannedRego ? scannedRego.toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9]/g, "") : "";

  // Extract the unique part of the scanned card (last 8 digits, or whatever's left after removing prefix)
  let scannedUnique8 = "";
  if (cleanScannedCard) {
    if (cleanScannedCard.startsWith(FLEET_CARD_PREFIX)) {
      scannedUnique8 = cleanScannedCard.slice(8);
    } else if (cleanScannedCard.length <= 8) {
      // AI may have only scanned the unique portion
      scannedUnique8 = cleanScannedCard;
    } else {
      // AI scanned something odd — try to extract last 8 digits
      scannedUnique8 = cleanScannedCard.slice(-8);
    }
  }

  // ── STRATEGY 1: Match by REGO (PRIMARY path — rego-first) ──
  // The registration is short, high-contrast, and printed (not embossed),
  // so the AI reads it much more reliably than the 16 embossed card digits.
  // The prompt is explicitly biased to prefer null cardNumber over a guess.
  // Policy: when a rego is found in the DB (exact or edit-dist 1), the DB's
  // canonical card number is authoritative — we don't second-guess it using
  // whatever the AI tried to read off the embossed card, UNLESS there's a
  // genuine tie-break case (confusable regos + an exact card match on one
  // of them, handled in Strategy 2 below).
  let confusableRegos = [];
  let regoMatchedInDB = false; // set when Strategy 1 finds an authoritative rego hit
  if (cleanScannedRego && cleanScannedRego.length >= 3) {
    const closeMatches = [];
    for (const known of allRegos) {
      const dist = editDistance(cleanScannedRego, known.rego);
      if (dist <= 1) closeMatches.push({ ...known, dist });
    }
    closeMatches.sort((a, b) => a.dist - b.dist || a.rego.localeCompare(b.rego));
    const seen = new Set();
    const unique = closeMatches.filter(m => { if (seen.has(m.rego)) return false; seen.add(m.rego); return true; });

    if (unique.length > 0) {
      const bestRegoEntry = unique[0];
      const cardMatch = knownCards.find(k => k.rego === bestRegoEntry.rego);
      if (cardMatch) {
        bestMatch = cardMatch;
        bestScore = bestRegoEntry.dist;
        regoMatchedInDB = true;
      } else {
        // Rego found but no card stored in DB — keep the rego, let Strategy 2
        // try to supply the card number.
        bestMatch = { card: "", rego: bestRegoEntry.rego, unique8: "", source: bestRegoEntry.source };
        bestScore = bestRegoEntry.dist;
      }
      if (unique.length > 1) {
        confusableRegos = unique.map(m => m.rego);
      }
    }
  }

  // ── STRATEGY 2: Match by UNIQUE 8 DIGITS of the card ──
  // Only if rego didn't find a match, or to confirm/improve the rego match.
  //
  // With 200+ fleet cards all sharing the "70343051" prefix, the effective
  // unique space is only 8 digits — accepting any 2-edit neighbour here will
  // eventually pick the wrong card for ambiguous reads. We now require:
  //   • dist ≤ 1 always, OR
  //   • dist = 2 only when the scanned REGO independently corroborates
  //     (dist ≤ 1 to the candidate's rego) — two signals agreeing.
  if (scannedUnique8 && scannedUnique8.length >= 4) {
    let bestCardMatch = null;
    let bestCardDist = Infinity;

    for (const known of knownCards) {
      const knownUnique = known.unique8;

      // Compare unique 8 digits with edit distance
      const dist = editDistance(scannedUnique8, knownUnique);
      const regoCorroborates = !!cleanScannedRego && !!known.rego &&
        editDistance(cleanScannedRego, known.rego) <= 1;
      const accept = dist <= 1 || (dist === 2 && regoCorroborates);

      if (accept && dist < bestCardDist) {
        bestCardDist = dist;
        bestCardMatch = known;
      }

      // Also try: if AI dropped digits, check if scanned unique is a subsequence
      if (!bestCardMatch && scannedUnique8.length >= 4 && scannedUnique8.length < 8) {
        // Check if scanned digits appear in order within the known unique digits
        let si = 0;
        for (let ki = 0; ki < knownUnique.length && si < scannedUnique8.length; ki++) {
          if (scannedUnique8[si] === knownUnique[ki]) si++;
        }
        if (si >= scannedUnique8.length * 0.7) { // 70% of scanned chars found in sequence
          const subDist = knownUnique.length - si; // how many were skipped
          if (subDist < bestCardDist) {
            bestCardDist = subDist;
            bestCardMatch = known;
          }
        }
      }
    }

    if (bestCardMatch) {
      if (!bestMatch) {
        // No rego match at all — only card data available, use it.
        bestMatch = bestCardMatch;
        bestScore = bestCardDist;
      } else if (bestCardMatch.rego === bestMatch.rego) {
        // Card confirms the rego lookup. If Strategy 1 picked a rego-only
        // row with no card data (REGO_DB entry missing `c`), upgrade to
        // the card-bearing row so we return a usable card number.
        if (!bestMatch.card && bestCardMatch.card) {
          bestMatch = bestCardMatch;
        }
        bestScore = 0;
      } else if (!regoMatchedInDB && bestCardDist === 0 && bestScore > 0) {
        // No authoritative rego hit (Strategy 1 picked a rego-only fallback
        // or nothing), but card exact-matches a different rego — switch to
        // the card match. This fires only when rego-first had nothing to
        // stand on; we never let an embossed-digit read override a rego
        // that was successfully looked up in the DB.
        bestMatch = bestCardMatch;
        bestScore = 0;
      } else if (regoMatchedInDB && confusableRegos.length > 1 &&
                 bestCardDist === 0 && confusableRegos.includes(bestCardMatch.rego)) {
        // Disambiguation case: rego had near-identical alternatives (e.g.
        // DF25LB / DF26LB) AND the card read is exact on one of those
        // alternatives — use the card as the tie-break. This is the ONLY
        // time the AI's card read is allowed to override an authoritative
        // rego hit.
        bestMatch = bestCardMatch;
        bestScore = 0;
      }
      // Otherwise keep the rego match — rego is the primary key.
    }
  }

  // ── STRATEGY 3: Last resort — if we have rego and card but nothing matched yet ──
  if (!bestMatch && cleanScannedRego) {
    for (const known of knownCards) {
      const regoDist = editDistance(cleanScannedRego, known.rego);
      if (regoDist <= 1) {
        bestMatch = known;
        bestScore = 1;
        break;
      }
    }
  }

  // Always use the known prefix + correct card from database
  // If we matched but the card was mangled, replace with the database version
  if (bestMatch && bestMatch.card) {
    // Ensure the card always has the correct prefix
    if (bestMatch.card.length === 16 && !bestMatch.card.startsWith(FLEET_CARD_PREFIX)) {
      bestMatch.card = FLEET_CARD_PREFIX + bestMatch.card.slice(8);
    }
  } else if (cleanScannedCard && !bestMatch) {
    // No match found — at minimum fix the prefix if it looks like a Plateau Trees card
    if (cleanScannedCard.length >= 12) {
      const fixedCard = FLEET_CARD_PREFIX + (cleanScannedCard.length > 8 ? cleanScannedCard.slice(-8) : cleanScannedCard);
      return {
        cardNumber: fixedCard.slice(0, 16),
        vehicleOnCard: scannedRego || null,
        _corrected: false,
        _originalCard: scannedCard,
        _originalRego: scannedRego,
      };
    }
  }

  // Determine confidence level
  // "high" = exact match or rego-confirmed card match with no confusables
  // "low"  = fuzzy match with edits, no rego confirmation, OR confusable regos exist
  // "none" = no match found at all
  let confidence = "none";
  if (bestMatch) {
    if (bestScore === 0 && confusableRegos.length === 0) {
      confidence = "high"; // exact match, no confusable alternatives
    } else if (bestScore === 0 && confusableRegos.length > 0) {
      confidence = "low"; // exact rego match BUT similar regos exist (e.g. DF25LB vs DF26LB)
    } else if (bestScore === 1 && confusableRegos.length === 0 && cleanScannedRego && bestMatch.rego && editDistance(cleanScannedRego, bestMatch.rego) <= 1) {
      confidence = "high"; // rego confirmed, no confusables
    } else {
      confidence = "low"; // fuzzy match only — warn the user
    }
  }

  if (bestMatch && bestScore > 0) {
    const corrections = [];
    if (cleanScannedCard && bestMatch.card && cleanScannedCard !== bestMatch.card.toUpperCase()) {
      corrections.push(`Card: "${scannedCard}" → "${bestMatch.card}"`);
    }
    if (cleanScannedRego && bestMatch.rego && cleanScannedRego !== bestMatch.rego) {
      corrections.push(`Rego: "${scannedRego}" → "${bestMatch.rego}"`);
    }
    if (corrections.length > 0) {
      console.log(`[Fuzzy Match] Auto-corrected (${confidence}):`, corrections.join(", "));
    }
  }

  // Flag when the returned card came from the DB via a rego lookup rather
  // than being read off the embossed digits — useful for audit + UI hints
  // ("card number was pulled from your vehicle database, not from the card
  // image"). Set when rego matched authoritatively AND the DB supplied a
  // card, regardless of whether the AI's card read was usable.
  const cardFromRegoDBLookup = regoMatchedInDB && !!bestMatch?.card;

  return {
    cardNumber: bestMatch?.card || scannedCard || null,
    vehicleOnCard: bestMatch?.rego || scannedRego || null,
    _corrected: bestScore > 0 && bestMatch !== null,
    _confidence: confidence,
    _confusableRegos: confusableRegos.length > 1 ? confusableRegos : null,
    _originalCard: bestScore > 0 ? scannedCard : null,
    _originalRego: bestScore > 0 ? scannedRego : null,
    _cardFromRegoLookup: cardFromRegoDBLookup,
  };
}

// ─── Claude vision model catalogue ─────────────────────────────────────────
// Each scan task (orientation / receipt / card) picks one of these. Admin
// can change the choice per task in Settings — orientation barely needs
// any reasoning so Haiku is a great default; receipt scans hit the most
// detail and benefit from Sonnet/Opus accuracy.
//
// To add a new model: drop another row here. The dropdown surfaces every
// row; the "Custom" option in Settings lets admin enter any model id
// without touching code.
const CLAUDE_MODEL_OPTIONS = [
  { id: "claude-haiku-4-5-20251001",  label: "Haiku 4.5",  tier: "fast",     note: "Cheapest tier. Plenty for orientation / simple OCR." },
  { id: "claude-sonnet-4-20250514",   label: "Sonnet 4",   tier: "balanced", note: "Balanced tier. Older Sonnet." },
  { id: "claude-sonnet-4-5-20250929", label: "Sonnet 4.5", tier: "balanced", note: "Balanced tier. Solid budget pick for receipts." },
  // Opus 4.7 — at $5/$25 per Mtok it's 3x cheaper than the older Opus 4 / 4.5
  // and only ~1.7x more than Sonnet 4.5, so it's the new sensible "best
  // accuracy without paying the old Opus tax" default.
  { id: "claude-opus-4-7",            label: "Opus 4.7",   tier: "strong",   note: "$5 / $25 per Mtok. Recommended default — top accuracy at Sonnet-ish cost." },
  { id: "claude-opus-4-20250514",     label: "Opus 4",     tier: "strong",   note: "$15 / $75 per Mtok. Old default — superseded by Opus 4.7 at 3x lower cost." },
  { id: "claude-opus-4-5-20250929",   label: "Opus 4.5",   tier: "strong",   note: "$15 / $75 per Mtok. Most expensive — usually only worth it for unusual edge cases." },
];

// Per-task defaults if the admin hasn't picked anything yet. With Opus 4.7
// priced at ~$0.028 per scan call (vs ~$0.083 for Opus 4 and ~$0.017 for
// Sonnet 4.5), Opus 4.7 is the new default across all three tasks — the
// accuracy headroom is worth the small premium over Sonnet for receipts
// where misreads cost real reconciliation time. Admin can flip orientation
// back to Haiku 4.5 in two clicks if they want to squeeze more cost out.
const DEFAULT_API_MODELS = {
  orientation: "claude-opus-4-7",
  receipt:     "claude-opus-4-7",
  card:        "claude-opus-4-7",
};

const API_TASK_LABELS = {
  orientation: { label: "Orientation check", desc: "Detects which way the receipt photo needs to rotate before OCR." },
  receipt:     { label: "Receipt scan",      desc: "Reads date, litres, $/L, total, fuel type, line items, fleet-card detail." },
  card:        { label: "Fleet-card scan",   desc: "Reads the 16-digit number and embossed rego off the physical card." },
};

async function claudeScan(apiKey, b64, mime, prompt, model) {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      // Fall back to Opus 4 if no model is supplied — preserves the old
      // pre-selector behaviour for any caller we missed.
      model: model || "claude-opus-4-20250514",
      max_tokens: 2000,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mime, data: b64 } },
          { type: "text", text: prompt },
        ],
      }],
    }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${resp.status}`);
  }
  const d = await resp.json();
  const rawText = d.content?.[0]?.text || "{}";
  // Strip markdown code fences
  let raw = rawText.replace(/```json\n?|```/g, "").trim();
  // Try direct parse first
  try { return JSON.parse(raw); } catch (_) {}
  // Opus may wrap JSON in extra text — extract the JSON object
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); } catch (_) {}
  }
  console.error("Failed to parse AI response:", raw);
  throw new Error("AI returned an unreadable response — please try scanning again");
}

function parseDate(str) {
  if (!str || typeof str !== "string") return 0;
  // Strip ordinal suffixes (e.g. "16th" → "16") and month names → numbers
  let cleaned = str.trim()
    .replace(/(\d+)(st|nd|rd|th)/gi, "$1")
    .replace(/\b(january|jan)\b/gi, "1").replace(/\b(february|feb)\b/gi, "2")
    .replace(/\b(march|mar)\b/gi, "3").replace(/\b(april|apr)\b/gi, "4")
    .replace(/\b(may)\b/gi, "5").replace(/\b(june|jun)\b/gi, "6")
    .replace(/\b(july|jul)\b/gi, "7").replace(/\b(august|aug)\b/gi, "8")
    .replace(/\b(september|sep)\b/gi, "9").replace(/\b(october|oct)\b/gi, "10")
    .replace(/\b(november|nov)\b/gi, "11").replace(/\b(december|dec)\b/gi, "12");
  // Normalise separators: spaces, commas, slashes, dashes, dots → "/"
  cleaned = cleaned.replace(/[\s,\-\.]+/g, "/").replace(/\/+/g, "/").replace(/^\/|\/$/g, "");
  const p = cleaned.split("/");
  if (p.length < 3) return 0;
  let y, m, d;
  if (p[0].length === 4) {
    // YYYY/MM/DD format
    [y, m, d] = p.map(Number);
  } else {
    // DD/MM/YYYY or DD/MM/YY (Australian standard — always day first)
    [d, m, y] = p.map(Number);
  }
  // Expand 2-digit year: 00-49 → 2000s, 50-99 → 1900s
  if (y >= 0 && y <= 99) {
    y += y <= 49 ? 2000 : 1900;
  }
  // Basic range checks
  if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) return 0;
  // Year sanity: fleet tracker sees modern receipts only. Reject obviously
  // bogus years so a "50" or "1995" misread doesn't persist as epoch-adjacent
  // garbage that silently sorts to the top of reports. Window is wide enough
  // to tolerate historical-data entry (2000+) but rejects future typos.
  const currentYear = new Date().getFullYear();
  if (y < 2000 || y > currentYear + 1) return 0;
  // Round-trip validation: reject impossible combinations like 30/02/2024
  // that JavaScript's Date would silently roll over (Feb 30 → Mar 1–2). Without
  // this, odometer cross-checks and date-based sorts operate on a different
  // date than what the receipt claims.
  const ts = Date.UTC(y, m - 1, d);
  const rt = new Date(ts);
  if (rt.getUTCFullYear() !== y || rt.getUTCMonth() !== m - 1 || rt.getUTCDate() !== d) return 0;
  return ts;
}

// Insert a new entry in chronological order for its vehicle.
// Odometer is the source of truth for ordering — it can never go backwards.
// If a driver submits a receipt late, odometer tells us where it actually belongs.
// Date is only used as a tiebreaker when odometer readings are identical.
function insertChronological(allEntries, newEntry) {
  const rego = newEntry.registration;

  // Collect same-rego entries and track their original indices
  const sameRego = [];
  const regoIndices = [];
  allEntries.forEach((e, i) => {
    if (e.registration === rego) {
      sameRego.push(e);
      regoIndices.push(i);
    }
  });

  // Add the new entry
  sameRego.push(newEntry);

  // Sort by odometer (primary), then date (tiebreaker)
  sameRego.sort((a, b) => {
    const odoA = a.odometer || 0;
    const odoB = b.odometer || 0;
    if (odoA !== odoB) return odoA - odoB;
    // Same odometer — use date as tiebreaker
    return parseDate(a.date) - parseDate(b.date);
  });

  // Rebuild: copy original array, replace same-rego slots with sorted entries,
  // then insert any remaining entry (the new one) after the last same-rego position
  const result = [...allEntries];
  for (let i = 0; i < regoIndices.length; i++) {
    result[regoIndices[i]] = sameRego[i];
  }
  // Insert remaining sorted entries after the last known position
  const insertPos = regoIndices.length > 0
    ? regoIndices[regoIndices.length - 1] + 1
    : result.length;
  const remaining = sameRego.slice(regoIndices.length);
  result.splice(insertPos, 0, ...remaining);

  return result;
}

// Standard sort for entries of the same rego: odometer first, date tiebreaker
function sortEntries(a, b) {
  const odoA = a.odometer || 0;
  const odoB = b.odometer || 0;
  if (odoA !== odoB) return odoA - odoB;
  return parseDate(a.date) - parseDate(b.date);
}

// ─── Excel Export ───────────────────────────────────────────────────────────
function exportVehicleType(entries, vehicleType, serviceData) {
  const vt = vehicleType || "Other";
  const filtered = entries.filter(e => (e.vehicleType || "Other") === vt);
  if (!filtered.length) { alert(`No ${vehicleType} entries to export.`); return; }

  const wb = XLSX.utils.book_new();
  const byRego = {};
  filtered.forEach(e => {
    if (!byRego[e.registration]) byRego[e.registration] = [];
    byRego[e.registration].push(e);
  });

  Object.entries(byRego).sort().forEach(([rego, arr]) => {
    arr.sort(sortEntries);
    const svc = getLatestService(serviceData[rego]) || {};

    const rows = arr.map((e, i) => {
      const prev = i > 0 ? arr[i - 1] : null;
      const odoStart = prev?.odometer ?? "";
      const odoFinish = e.odometer ?? "";
      const kmTravelled = prev?.odometer != null && e.odometer != null
        ? e.odometer - prev.odometer : "";
      const litres = e.litres ?? "";
      const ppl = e.pricePerLitre ?? "";
      const totalCost = e.totalCost ?? "";
      const lPerKm = kmTravelled && litres ? (litres / kmTravelled) : "";
      const calcCost = litres && ppl ? litres * ppl : "";
      const moreLess = totalCost && calcCost ? totalCost - calcCost : "";

      const hrsMode = isHoursBased(e.vehicleType);
      const uLabel = hrsMode ? "Hours" : "KM";
      const effLabel = hrsMode ? "L/hr" : "L/km";
      const effDecimals = hrsMode ? 1 : 4;
      return {
        "Division": e.division || getDivision(e.vehicleType) || "",
        "Registration": e.registration || "",
        "Date": e.date || "",
        "Driver": e.driverName || "",
        [`${uLabel} Start`]: odoStart,
        [`${uLabel} Finish`]: odoFinish,
        [`${uLabel} Travelled`]: kmTravelled,
        "Fuel (Litres)": litres,
        "Price per Litre ($)": ppl,
        "Total Fuel Cost ($)": totalCost,
        "": "",
        [effLabel]: lPerKm ? parseFloat(lPerKm.toFixed(effDecimals)) : "",
        [`${uLabel} Travelled (calc)`]: kmTravelled,
        "Total Litres": litres,
        "Cost of Petrol ($/L)": ppl,
        "Calc Fuel Cost ($)": calcCost ? parseFloat(calcCost.toFixed(2)) : "",
        "More/Less ($)": moreLess ? parseFloat(moreLess.toFixed(2)) : "",
        " ": "",
        "Last Service Date": svc.lastServiceDate || "",
        [`Last Service (${hrsMode ? "hrs" : "kms"})`]: svc.lastServiceKms || "",
        "Next Service Due": svc.lastServiceKms ? svc.lastServiceKms + serviceInterval(e.vehicleType) : "",
        "Station": e.station || "",
        "Fleet Card No.": e.fleetCardNumber || "",
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);

    // Add total row at the bottom
    const totalRow = rows.length + 1; // +1 for header
    const totalLitres = arr.reduce((s, e) => s + (e.litres || 0), 0);
    const totalCostSum = arr.reduce((s, e) => s + (e.totalCost || 0), 0);
    const totalKm = arr.length > 1 && arr[arr.length - 1].odometer && arr[0].odometer
      ? arr[arr.length - 1].odometer - arr[0].odometer : "";
    XLSX.utils.sheet_add_aoa(ws, [[
      "", rego, "", "", "", "", totalKm, totalLitres, "",
      Math.round(totalCostSum * 100) / 100, "",
      "", totalKm, totalLitres, "", "", "", "", "", "", "", ""
    ]], { origin: `A${totalRow + 1}` });
    // Bold the total row label
    const totalLabelCell = `A${totalRow + 1}`;
    if (!ws[totalLabelCell]) ws[totalLabelCell] = {};
    ws[totalLabelCell].v = "TOTAL";

    ws["!cols"] = Array(22).fill({ wch: 16 });
    XLSX.utils.book_append_sheet(wb, ws, rego.slice(0, 31));
  });

  XLSX.writeFile(wb, `Fuel_${vt}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ─── Fleet Card Monthly Summary Export ──────────────────────────────────────
function getMonthKey(dateStr) {
  const t = parseDate(dateStr);
  if (!t) return "Unknown";
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function getMonthLabel(key) {
  if (key === "Unknown") return "Unknown";
  const [y, m] = key.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m) - 1]} ${y}`;
}

function buildCardSummary(entries) {
  // Group all entries (vehicle + other) by fleet card number
  const byCard = {};
  entries.forEach(e => {
    const card = e.fleetCardNumber || e.cardRego || "";
    if (!card || card.length < 4) return;
    if (!byCard[card]) byCard[card] = [];
    byCard[card].push(e);
  });

  // For each card, group by month
  const cards = Object.entries(byCard).sort().map(([cardNum, cardEntries]) => {
    const byMonth = {};
    cardEntries.forEach(e => {
      const mk = getMonthKey(e.date);
      if (!byMonth[mk]) byMonth[mk] = [];
      byMonth[mk].push(e);
    });

    const months = Object.entries(byMonth).sort().map(([mk, monthEntries]) => ({
      key: mk, label: getMonthLabel(mk),
      entries: monthEntries,
      totalLitres: monthEntries.reduce((s, e) => s + (e.litres || 0), 0),
      totalCost: monthEntries.reduce((s, e) => s + (e.totalCost || 0), 0),
      transactions: monthEntries.length,
    }));

    // Find a display name for this card from DB or entries
    const cardDb = DRIVER_CARDS.find(c => c.c === cardNum);
    const lastEntry = cardEntries[cardEntries.length - 1];
    const displayName = cardDb?.n || lastEntry?.driverName || "";
    const displayRego = cardDb?.r || lastEntry?.registration || lastEntry?.cardRego || "";

    return {
      cardNum, displayName, displayRego, months,
      totalLitres: months.reduce((s, m) => s + m.totalLitres, 0),
      totalCost: months.reduce((s, m) => s + m.totalCost, 0),
      totalTransactions: cardEntries.length,
    };
  });

  return cards;
}

function exportFleetCardSummary(entries, selectedMonth) {
  const cards = buildCardSummary(entries);
  if (!cards.length) return;
  const wb = XLSX.utils.book_new();

  // Summary sheet: one row per card
  const summaryRows = cards.map(c => {
    const month = selectedMonth ? c.months.find(m => m.key === selectedMonth) : null;
    return {
      "Fleet Card Number": c.cardNum,
      "Assigned Driver": c.displayName,
      "Card Rego": c.displayRego,
      "Transactions": month ? month.transactions : c.totalTransactions,
      "Total Litres": parseFloat((month ? month.totalLitres : c.totalLitres).toFixed(2)),
      "Total Spent ($)": parseFloat((month ? month.totalCost : c.totalCost).toFixed(2)),
    };
  });
  // Add totals row
  summaryRows.push({
    "Fleet Card Number": "TOTAL",
    "Assigned Driver": "",
    "Card Rego": "",
    "Transactions": summaryRows.reduce((s, r) => s + r["Transactions"], 0),
    "Total Litres": parseFloat(summaryRows.reduce((s, r) => s + r["Total Litres"], 0).toFixed(2)),
    "Total Spent ($)": parseFloat(summaryRows.reduce((s, r) => s + r["Total Spent ($)"], 0).toFixed(2)),
  });
  const sws = XLSX.utils.json_to_sheet(summaryRows);
  sws["!cols"] = [{ wch: 22 }, { wch: 20 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, sws, "Card Summary");

  // Detail sheet per card
  cards.forEach(c => {
    const allEntries = selectedMonth
      ? c.months.filter(m => m.key === selectedMonth).flatMap(m => m.entries)
      : c.months.flatMap(m => m.entries);
    if (!allEntries.length) return;
    const rows = allEntries.map(e => ({
      "Date": e.date || "",
      "Driver": e.driverName || "",
      "Registration": e.registration || e.equipment || "",
      "Type": e.entryType === "other" ? "Other" : e.vehicleType || "",
      "Station": e.station || "",
      "Litres": e.litres || "",
      "Price/L ($)": e.pricePerLitre || "",
      "Total ($)": e.totalCost ? parseFloat(e.totalCost.toFixed(2)) : "",
      "Notes": e.notes || "",
    }));
    rows.push({ "Date": "TOTAL", "Litres": parseFloat(allEntries.reduce((s, e) => s + (e.litres || 0), 0).toFixed(2)), "Total ($)": parseFloat(allEntries.reduce((s, e) => s + (e.totalCost || 0), 0).toFixed(2)) });
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = Array(9).fill({ wch: 16 });
    const name = `...${c.cardNum.slice(-6)}`;
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  });

  const monthLabel = selectedMonth ? getMonthLabel(selectedMonth) : "All";
  XLSX.writeFile(wb, `FleetCard_Summary_${monthLabel.replace(/\s/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ─── Shared UI atoms ────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Barlow+Condensed:wght@600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', sans-serif; background: #f8fafc; color: #0f172a; -webkit-text-size-adjust: 100%; }
  html { -webkit-tap-highlight-color: transparent; }
  input, select, textarea, button { font-family: inherit; font-size: 16px; }
  input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
  input:focus, select:focus, textarea:focus { font-size: 16px; }
  .fade-in { animation: fadeIn 0.2s ease; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }
  .data-table { width: 100%; border-collapse: collapse; font-size: 11px; }
  .data-table th { padding: 7px 8px; text-align: left; font-weight: 700; font-size: 10px; letter-spacing: 0.04em; text-transform: uppercase; white-space: nowrap; position: sticky; top: 0; z-index: 1; }
  .data-table td { padding: 6px 8px; white-space: nowrap; border-bottom: 1px solid #f1f5f9; }
  .data-table tbody tr:hover { background: #f8fafc; }
  .flag-badge { display: inline-flex; align-items: center; gap: 3px; padding: 2px 7px; border-radius: 10px; font-size: 10px; font-weight: 600; white-space: nowrap; }
  .flag-warn { background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; }
  .flag-danger { background: #fef2f2; color: #b91c1c; border: 1px solid #fca5a5; }
  .flag-ok { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
  .flag-info { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }
  .svc-overdue { animation: pulseRed 2s ease-in-out infinite; }
  @keyframes pulseRed { 0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.15); } 50% { box-shadow: 0 0 0 6px rgba(239,68,68,0.08); } }
  .kpi-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .kpi-grid-5 { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
  .kpi-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  @media (max-width: 480px) {
    .kpi-grid-4 { grid-template-columns: repeat(2, 1fr); }
    .kpi-grid-5 { grid-template-columns: repeat(3, 1fr); }
    .kpi-grid-3 { grid-template-columns: repeat(3, 1fr); }
    .data-table th, .data-table td { padding: 5px 6px; font-size: 10px; }
  }
  @media (max-width: 360px) {
    .kpi-grid-5 { grid-template-columns: repeat(2, 1fr); }
    .kpi-grid-3 { grid-template-columns: repeat(2, 1fr); }
  }
`;

function Toast({ msg, type, onDone }) {
  // Dep array includes msg/type so a new toast replacing an old one resets
  // the timer. The parent passes a stable onDone via useCallback so this
  // effect doesn't re-fire on every unrelated re-render (which previously
  // caused toasts to linger indefinitely during active UI changes).
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone, msg, type]);
  const colors = type === "error" || type === "danger" ? { bg: "#fef2f2", border: "#fca5a5", text: "#b91c1c", icon: "\u26A0" }
    : type === "warn" ? { bg: "#fffbeb", border: "#fcd34d", text: "#b45309", icon: "\u26A0" }
    : { bg: "#f0fdf4", border: "#86efac", text: "#15803d", icon: "\u2713" };
  return (
    <div style={{
      position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
      background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text,
      padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 500,
      boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 999, whiteSpace: "nowrap",
      maxWidth: "90vw", overflow: "hidden", textOverflow: "ellipsis",
      animation: "fadeIn 0.2s ease",
    }}>
      {colors.icon} {msg}
    </div>
  );
}

function Pill({ label, color }) {
  const c = VT_COLORS[color] || VT_COLORS.Other;
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 20,
      fontSize: 11, fontWeight: 600, letterSpacing: "0.04em",
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
    }}>{label}</span>
  );
}

function PhotoUpload({ preview, scanning, onFile, inputRef, label, caption }) {
  const [drag, setDrag] = useState(false);
  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files[0]); }}
        style={{
          border: `2px dashed ${drag ? "#22c55e" : preview ? "#86efac" : "#cbd5e1"}`,
          borderRadius: 10, overflow: "hidden", cursor: scanning ? "wait" : "pointer",
          background: drag ? "#f0fdf4" : preview ? "#fafffe" : "#fafafa",
          minHeight: preview ? "auto" : 110, transition: "all 0.2s",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {preview ? (
          <img src={preview} alt="preview" style={{ width: "100%", display: "block", maxHeight: 220, objectFit: "contain", borderRadius: 8 }} />
        ) : (
          <div style={{ textAlign: "center", padding: 20, color: "#94a3b8" }}>
            <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" style={{ marginBottom: 8, display: "block", margin: "0 auto 8px" }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
            </svg>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#64748b" }}>{label}</div>
            <div style={{ fontSize: 11, marginTop: 3 }}>{caption || "Tap or drag to upload"}</div>
          </div>
        )}
      </div>
      {scanning && (
        <div style={{ textAlign: "center", marginTop: 8, fontSize: 12, color: "#15803d", fontWeight: 500 }}>
          <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>{"\u25CC"}</span> Scanning with AI...
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => onFile(e.target.files[0])} />
    </div>
  );
}

function ScanCard({ data, fields, title }) {
  if (!data) return null;
  return (
    <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: 12, marginTop: 10 }} className="fade-in">
      <div style={{ fontSize: 11, color: "#15803d", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 8, textTransform: "uppercase" }}>
        {"\u2713"} {title}
      </div>
      {fields.map(({ key, label, fmt }) => (
        <div key={key} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 13 }}>
          <span style={{ color: "#64748b" }}>{label}</span>
          <span style={{ fontWeight: 500, color: "#0f172a" }}>{data[key] != null ? (fmt ? fmt(data[key]) : data[key]) : "\u2014"}</span>
        </div>
      ))}
    </div>
  );
}

function PrimaryBtn({ children, onClick, disabled, loading }) {
  return (
    <button onClick={onClick} disabled={disabled || loading} style={{
      background: disabled || loading ? "#d1fae5" : "#16a34a",
      color: disabled || loading ? "#86efac" : "#fff",
      border: "none", borderRadius: 8, padding: "12px 22px",
      fontSize: 15, fontWeight: 600, cursor: disabled || loading ? "not-allowed" : "pointer",
      fontFamily: "inherit", transition: "background 0.15s", width: "100%",
      minHeight: 46,
    }}>
      {loading ? "Please wait..." : children}
    </button>
  );
}

function SecondaryBtn({ children, onClick, small }) {
  return (
    <button onClick={onClick} style={{
      background: "white", color: "#374151",
      border: "1px solid #e2e8f0", borderRadius: 8,
      padding: small ? "8px 14px" : "11px 18px",
      fontSize: small ? 13 : 14, fontWeight: 500, cursor: "pointer",
      fontFamily: "inherit", minHeight: small ? 38 : 44,
    }}>
      {children}
    </button>
  );
}

function FieldInput({ label, value, onChange, placeholder, type = "text", required, hint }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 12, color: "#374151", fontWeight: 600, marginBottom: 5 }}>
        {label}{required && <span style={{ color: "#ef4444", marginLeft: 2 }}>*</span>}
      </label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        inputMode={type === "number" ? "decimal" : undefined}
        step={type === "number" ? "any" : undefined}
        style={{
          width: "100%", background: "white", border: "1px solid #e2e8f0",
          borderRadius: 8, padding: "9px 12px", color: "#0f172a", fontSize: 14,
          outline: "none", transition: "border 0.15s",
        }}
        onFocus={e => e.target.style.borderColor = "#22c55e"}
        onBlur={e => e.target.style.borderColor = "#e2e8f0"}
      />
      {hint && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>{hint}</div>}
    </div>
  );
}

// ─── Step indicator ─────────────────────────────────────────────────────────
function StepBar({ step }) {
  const steps = ["Driver & Vehicle", "Photo & Scan", "Review"];
  // Steps are sequential: 1 = Driver & Vehicle, 2 = Photo & Scan, 3 = Review, 4 = Success
  const displayStep = step <= 2 ? step : step === 3 ? 3 : 4;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", marginBottom: 28, gap: 0 }}>
      {steps.map((label, i) => {
        const n = i + 1;
        const done = displayStep > n;
        const active = displayStep === n;
        return (
          <div key={n} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
              <div style={{
                width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                background: done ? "#16a34a" : active ? "#22c55e" : "#e2e8f0",
                color: done || active ? "white" : "#94a3b8",
                fontSize: done ? 14 : 12, fontWeight: 700, transition: "all 0.25s",
                border: active ? "2px solid #16a34a" : "2px solid transparent",
              }}>
                {done ? "\u2713" : n}
              </div>
              <span style={{ fontSize: 10, color: active ? "#16a34a" : "#94a3b8", fontWeight: active ? 600 : 400, textAlign: "center", maxWidth: 60 }}>{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                width: 36, height: 2, background: step > n ? "#16a34a" : "#e2e8f0",
                margin: "0 2px", marginBottom: 22, transition: "background 0.3s", flexShrink: 0,
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Reply Form for flag resolution ─────────────────────────────────────
function ReplyForm({ fid, onResolve, onCancel }) {
  const [note, setNote] = useState("");
  const [by, setBy] = useState("");
  return (
    <div className="fade-in" style={{ marginTop: 8, padding: "10px 12px", background: "#f8fafc", borderRadius: 6, border: "1px solid #e2e8f0" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Resolve this issue</div>
      <input
        value={by} onChange={e => setBy(e.target.value)} placeholder="Your name"
        style={{
          width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid #e2e8f0",
          fontSize: 12, marginBottom: 6, outline: "none", fontFamily: "inherit",
          background: "white", color: "#0f172a",
        }}
        onFocus={e => e.target.style.borderColor = "#22c55e"}
        onBlur={e => e.target.style.borderColor = "#e2e8f0"}
      />
      <textarea
        value={note} onChange={e => setNote(e.target.value)}
        placeholder="Add a note — what was done? (optional)"
        rows={2}
        style={{
          width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid #e2e8f0",
          fontSize: 12, marginBottom: 8, outline: "none", fontFamily: "inherit", resize: "vertical",
          background: "white", color: "#0f172a",
        }}
        onFocus={e => e.target.style.borderColor = "#22c55e"}
        onBlur={e => e.target.style.borderColor = "#e2e8f0"}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onCancel} style={{
          padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 500,
          background: "white", color: "#64748b", border: "1px solid #e2e8f0",
          cursor: "pointer", fontFamily: "inherit",
        }}>Cancel</button>
        <button onClick={() => onResolve(note, by || "Admin")} style={{
          padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 700,
          background: "#16a34a", color: "white", border: "none",
          cursor: "pointer", fontFamily: "inherit",
        }}>{"\u2713"} Mark Resolved</button>
      </div>
    </div>
  );
}

// ─── Confirm Dialog ──────────────────────────────────────────────────────
function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16,
    }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} className="fade-in" style={{
        background: "white", borderRadius: 12, padding: 24, width: "100%", maxWidth: 340,
        boxShadow: "0 20px 40px rgba(0,0,0,0.15)", textAlign: "center",
      }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>{"\u26A0"}</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", marginBottom: 6 }}>Are you sure?</div>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>{message}</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: "10px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500,
            background: "white", color: "#374151", border: "1px solid #e2e8f0",
            cursor: "pointer", fontFamily: "inherit",
          }}>Cancel</button>
          <button onClick={onConfirm} style={{
            flex: 1, padding: "10px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700,
            background: "#dc2626", color: "white", border: "none",
            cursor: "pointer", fontFamily: "inherit",
          }}>Delete</button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Vehicle Modal ─────────────────────────────────────────────────
function EditVehicleModal({ rego, currentDivision, currentType, currentName, entries: regoEntries, onSave, onClose }) {
  const [newRego, setNewRego] = useState(rego || "");
  const [div, setDiv] = useState(currentDivision || "");
  const [vtype, setVtype] = useState(currentType || "");
  const [vname, setVname] = useState(currentName || "");
  const divTypes = div && DIVISIONS[div] ? DIVISIONS[div].types : [];
  const cleanNewRego = newRego.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  const regoChanged = cleanNewRego && cleanNewRego !== rego;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="fade-in" style={{
        background: "white", borderRadius: 12, padding: 24, width: "100%", maxWidth: 400,
        boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>Edit Vehicle</div>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 18 }}>
          {rego} {"\u00B7"} {regoEntries} entries {"\u00B7"} currently {currentDivision} / {currentType}
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12, color: "#374151", fontWeight: 600, marginBottom: 6 }}>Registration</label>
          <input
            value={newRego}
            onChange={e => setNewRego(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
            placeholder="e.g. EIA53F"
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, fontFamily: "inherit", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", outline: "none", color: "#0f172a" }}
            onFocus={e => e.target.style.borderColor = "#7c3aed"}
            onBlur={e => e.target.style.borderColor = "#e2e8f0"}
          />
          {regoChanged && (
            <div style={{ fontSize: 11, color: "#c2410c", marginTop: 6 }}>
              {"\u26A0\uFE0F"} Renaming will update all {regoEntries} entries from {rego} to {cleanNewRego}
            </div>
          )}
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12, color: "#374151", fontWeight: 600, marginBottom: 6 }}>Vehicle Name</label>
          <input
            value={vname}
            onChange={e => setVname(e.target.value)}
            placeholder="e.g. TOYOTA HILUX"
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, fontFamily: "inherit", outline: "none", color: "#0f172a" }}
            onFocus={e => e.target.style.borderColor = "#7c3aed"}
            onBlur={e => e.target.style.borderColor = "#e2e8f0"}
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12, color: "#374151", fontWeight: 600, marginBottom: 6 }}>Division</label>
          <div style={{ display: "flex", gap: 8 }}>
            {DIVISION_KEYS.map(dk => {
              const dc = DIVISIONS[dk].color;
              const sel = div === dk;
              return (
                <button key={dk} onClick={() => { setDiv(dk); setVtype(""); }} style={{
                  flex: 1, padding: "10px 14px", borderRadius: 10, fontSize: 14, cursor: "pointer",
                  fontFamily: "inherit", fontWeight: sel ? 700 : 500,
                  background: sel ? dc.bg : "white", color: sel ? dc.text : "#64748b",
                  border: `2px solid ${sel ? dc.border : "#e2e8f0"}`, transition: "all 0.15s",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}>
                  <span style={{ fontSize: 16 }}>{dk === "Tree" ? "\uD83C\uDF33" : "\uD83C\uDF3F"}</span>
                  {dk}
                </button>
              );
            })}
          </div>
        </div>

        {div && (
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "block", fontSize: 12, color: "#374151", fontWeight: 600, marginBottom: 6 }}>Vehicle Type</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {divTypes.map(t => {
                const c = VT_COLORS[t] || VT_COLORS.Other;
                const sel = vtype === t;
                return (
                  <button key={t} onClick={() => setVtype(t)} style={{
                    padding: "7px 14px", borderRadius: 20, fontSize: 13, cursor: "pointer",
                    fontFamily: "inherit", fontWeight: sel ? 700 : 500,
                    background: sel ? c.bg : "white", color: sel ? c.text : "#64748b",
                    border: `1.5px solid ${sel ? c.border : "#e2e8f0"}`, transition: "all 0.15s",
                  }}>{t}</button>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <SecondaryBtn onClick={onClose} small>Cancel</SecondaryBtn>
          <div style={{ flex: 1 }}>
            <PrimaryBtn onClick={() => { if (div && vtype && cleanNewRego) onSave(rego, div, vtype, cleanNewRego, vname.trim()); }} disabled={!div || !vtype || !cleanNewRego}>
              Save Changes
            </PrimaryBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Receipt Viewer Modal ────────────────────────────────────────────────
function ReceiptViewer({ entryId, entry, loadFn, onClose }) {
  const [img, setImg] = useState(null);
  const [loading, setLoading] = useState(true);
  // Cancellation flag mirrors the InlineReceipt pattern below — without it a
  // slow receipt A load that resolves AFTER the user closes and opens receipt
  // B would overwrite B's image (or setState on an unmounted component).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setImg(null);
    (async () => {
      const data = await loadFn(entryId);
      if (!cancelled) { setImg(data); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [entryId, loadFn]);
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex",
      alignItems: "flex-start", justifyContent: "center", zIndex: 100, padding: "40px 16px",
      overflowY: "auto",
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="fade-in" style={{
        background: "white", borderRadius: 12, padding: 20, width: "100%", maxWidth: 500,
        boxShadow: "0 20px 40px rgba(0,0,0,0.2)", maxHeight: "85vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>{"\uD83D\uDCC4"} Receipt</div>
            <div style={{ fontSize: 11, color: "#64748b" }}>
              {entry?.registration || entry?.equipment || "Entry"} {"\u00B7"} {entry?.date || ""} {"\u00B7"} {entry?.driverName || ""}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: "#94a3b8", cursor: "pointer" }}>{"\u00D7"}</button>
        </div>
        {loading ? (
          <div style={{ textAlign: "center", padding: "32px 0", color: "#94a3b8" }}>Loading receipt...</div>
        ) : img ? (
          <img src={img.url || `data:${img.mime};base64,${img.b64}`} alt="Receipt" style={{
            width: "100%", borderRadius: 8, border: "1px solid #e2e8f0",
          }} />
        ) : (
          <div style={{ textAlign: "center", padding: "32px 0", color: "#94a3b8" }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>{"\uD83D\uDCC4"}</div>
            No receipt image stored for this entry
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Inline Receipt (for flags / review panels) ─────────────────────────
function InlineReceipt({ entryId, loadFn }) {
  const [img, setImg] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const data = await loadFn(entryId);
      if (!cancelled) { setImg(data); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [entryId, loadFn]);
  return (
    <div style={{ marginTop: 8, borderRadius: 8, overflow: "hidden", border: "1px solid #e2e8f0", background: "#f8fafc" }}>
      {loading ? (
        <div style={{ textAlign: "center", padding: "16px 0", color: "#94a3b8", fontSize: 11 }}>Loading receipt...</div>
      ) : img ? (
        <img src={img.url || `data:${img.mime};base64,${img.b64}`} alt="Receipt" style={{
          width: "100%", display: "block", cursor: "zoom-in",
        }} onClick={e => {
          // Open full-size in new tab for zooming
          const w = window.open();
          if (w) { const imgEl = w.document.createElement("img"); imgEl.src = img.url || `data:${img.mime};base64,${img.b64}`; imgEl.style.maxWidth = "100%"; w.document.body.appendChild(imgEl); w.document.title = "Receipt"; }
        }} />
      ) : (
        <div style={{ textAlign: "center", padding: "16px 0", color: "#94a3b8", fontSize: 11 }}>No receipt image found</div>
      )}
    </div>
  );
}

// ─── Manual Add Entry Modal ──────────────────────────────────────────────
function ManualEntryModal({ rego, division, vehicleType, onSave, onClose }) {
  const [f, setF] = useState({
    driverName: "", date: "", odometer: "", litres: "", pricePerLitre: "", totalCost: "",
    station: "", fuelType: "", fleetCardNumber: "", cardRego: "",
  });
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));

  // Auto-calc total when litres and price change
  const litres = parseFloat(f.litres) || 0;
  const ppl = parseFloat(f.pricePerLitre) || 0;
  const autoTotal = litres && ppl ? (litres * ppl).toFixed(2) : "";

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex",
      alignItems: "flex-start", justifyContent: "center", zIndex: 100, padding: "40px 16px",
      overflowY: "auto",
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "white", borderRadius: 12, padding: 24, width: "100%", maxWidth: 440,
        boxShadow: "0 20px 40px rgba(0,0,0,0.15)", maxHeight: "85vh", overflowY: "auto",
      }} className="fade-in">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>Add Entry</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>{rego} {"\u00B7"} {division} {"\u00B7"} {vehicleType}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: "#94a3b8", cursor: "pointer" }}>{"\u00D7"}</button>
        </div>

        <FieldInput label="Driver Name" value={f.driverName} onChange={v => set("driverName", v)} placeholder="Who fuelled this vehicle" required />
        <FieldInput label="Date" value={f.date} onChange={v => set("date", v)} placeholder="DD/MM/YYYY" required />
        <FieldInput label={isHoursBased(vehicleType) ? "Hour Meter" : "Odometer"} value={f.odometer} onChange={v => set("odometer", v)} placeholder={isHoursBased(vehicleType) ? "e.g. 4500" : "e.g. 154597"} type="number" required />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <FieldInput label="Litres" value={f.litres} onChange={v => set("litres", v)} placeholder="e.g. 65.86" type="number" />
          <FieldInput label="Price per Litre ($)" value={f.pricePerLitre} onChange={v => set("pricePerLitre", v)} placeholder="e.g. 2.259" type="number" />
        </div>
        <FieldInput label="Total Fuel Cost ($)" value={f.totalCost || autoTotal} onChange={v => set("totalCost", v)} placeholder={autoTotal ? `Auto: $${autoTotal}` : "e.g. 148.78"} type="number" />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <FieldInput label="Station" value={f.station} onChange={v => set("station", v)} placeholder="e.g. Ampol" />
          <FieldInput label="Fuel Type" value={f.fuelType} onChange={v => set("fuelType", v)} placeholder="e.g. Diesel" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <FieldInput label="Fleet Card Number" value={formatCardNumber(f.fleetCardNumber)} onChange={v => set("fleetCardNumber", v.replace(/\s/g, ""))} placeholder="Optional" />
          <FieldInput label="Fleet Card Rego" value={f.cardRego} onChange={v => set("cardRego", v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7))} placeholder="e.g. EIA53F" />
        </div>

        <div style={{ marginTop: 8 }}>
          <PrimaryBtn onClick={() => {
            if (!f.driverName || !f.date || !f.odometer) return;
            const cleanCardRego = (f.cardRego || "").toUpperCase().replace(/\s+/g, "");
            onSave({
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              submittedAt: new Date().toISOString(),
              ...driverFieldsFor(f.driverName.trim()),
              registration: rego,
              division, vehicleType,
              odometer: parseFloat(f.odometer) || null,
              date: f.date.trim(),
              litres: parseFloat(f.litres) || null,
              pricePerLitre: parseFloat(f.pricePerLitre) || null,
              totalCost: parseFloat(f.totalCost || autoTotal) || null,
              station: f.station.trim(),
              fuelType: f.fuelType.trim(),
              fleetCardNumber: f.fleetCardNumber.trim(),
              cardRego: cleanCardRego,
              fleetCardVehicle: cleanCardRego, fleetCardDriver: "", vehicleName: "",
              manualEntry: true,
            });
          }}>Add Entry</PrimaryBtn>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Entry Modal ────────────────────────────────────────────────────
function EditEntryModal({ entry, onSave, onDelete, onClose, loadReceiptFn }) {
  // Common oil product labels (mirrors OIL_PRODUCTS inside entry form component)
  const OIL_PRODUCT_LABELS = ["2 Stroke Oil", "Engine Oil", "Chain & Bar Oil", "Hydraulic Oil", "Gear Oil", "Other Oil"];
  const isOilProductLabel = (equip) => OIL_PRODUCT_LABELS.some(o => o.toLowerCase() === (equip || "").toLowerCase());

  const [entryType, setEntryType] = useState(entry.entryType === "other" ? "other" : "vehicle");
  const [subType, setSubType] = useState(entry.subType || (isOilProductLabel(entry.equipment) ? "product" : "fuel"));
  const [f, setF] = useState({
    driverName: entry.driverName || "",
    registration: entry.registration || "",
    date: entry.date || "",
    odometer: entry.odometer?.toString() || "",
    litres: entry.litres?.toString() || "",
    pricePerLitre: entry.pricePerLitre?.toString() || "",
    totalCost: entry.totalCost?.toString() || "",
    station: entry.station || "",
    fuelType: entry.fuelType || "",
    division: entry.division || "",
    vehicleType: entry.vehicleType || "",
    // Oil & Others fields
    equipment: entry.equipment || "",
    linkedVehicle: entry.linkedVehicle || "",
    quantity: entry.quantity?.toString() || "",
    notes: entry.notes || "",
    fleetCardNumber: entry.fleetCardNumber || "",
    cardRego: entry.cardRego || "",
  });
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));
  const [showReceipt, setShowReceipt] = useState(!!entry.hasReceipt);
  const [receiptImg, setReceiptImg] = useState(null);
  const [receiptLoading, setReceiptLoading] = useState(false);

  useEffect(() => {
    if (showReceipt && entry.hasReceipt && loadReceiptFn && !receiptImg) {
      setReceiptLoading(true);
      loadReceiptFn(entry.id).then(data => { setReceiptImg(data); setReceiptLoading(false); }).catch(() => setReceiptLoading(false));
    }
  }, [showReceipt, entry.id, entry.hasReceipt, loadReceiptFn, receiptImg]);

  const activeDivision = f.division ? DIVISIONS[f.division] : null;
  const divTypes = activeDivision ? activeDivision.types : [];
  const hasReceipt = entry.hasReceipt && loadReceiptFn;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex",
      alignItems: "flex-start", justifyContent: "center", zIndex: 100, padding: "24px 16px",
      overflowY: "auto",
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "white", borderRadius: 12, width: "100%",
        maxWidth: hasReceipt && showReceipt ? 900 : 440,
        boxShadow: "0 20px 40px rgba(0,0,0,0.15)", maxHeight: "90vh", overflowY: "auto",
        transition: "max-width 0.3s ease",
      }} className="fade-in">
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px 0 24px" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>Edit Entry</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>{entry.registration} {"\u00B7"} {entry.date || "No date"}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {hasReceipt && (
              <button onClick={() => setShowReceipt(!showReceipt)} style={{
                padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                background: showReceipt ? "#7c3aed" : "#faf5ff",
                color: showReceipt ? "white" : "#7c3aed",
                border: `1px solid ${showReceipt ? "#7c3aed" : "#c4b5fd"}`,
                cursor: "pointer", fontFamily: "inherit",
              }}>{"\uD83D\uDCC4"} {showReceipt ? "Hide Receipt" : "Show Receipt"}</button>
            )}
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: "#94a3b8", cursor: "pointer" }}>{"\u00D7"}</button>
          </div>
        </div>

        {/* Split layout: receipt + form side by side */}
        <div style={{
          display: hasReceipt && showReceipt ? "flex" : "block",
          flexWrap: "wrap", gap: 0,
        }}>
          {/* Receipt panel */}
          {hasReceipt && showReceipt && (
            <div style={{
              flex: "1 1 320px", minWidth: 280, maxHeight: "80vh", overflowY: "auto",
              padding: "16px 20px", borderRight: "1px solid #e2e8f0", background: "#f8fafc",
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>{"\uD83D\uDCC4"} Receipt Image</div>
              {receiptLoading ? (
                <div style={{ textAlign: "center", padding: "32px 0", color: "#94a3b8", fontSize: 12 }}>Loading receipt...</div>
              ) : receiptImg ? (
                <img src={receiptImg.url || `data:${receiptImg.mime};base64,${receiptImg.b64}`} alt="Receipt" style={{
                  width: "100%", borderRadius: 8, border: "1px solid #e2e8f0", cursor: "zoom-in",
                }} onClick={() => {
                  const w = window.open();
                  if (w) { const imgEl = w.document.createElement("img"); imgEl.src = receiptImg.url || `data:${receiptImg.mime};base64,${receiptImg.b64}`; imgEl.style.maxWidth = "100%"; w.document.body.appendChild(imgEl); w.document.title = "Receipt"; }
                }} />
              ) : (
                <div style={{ textAlign: "center", padding: "32px 0", color: "#94a3b8", fontSize: 12 }}>No receipt image found</div>
              )}
            </div>
          )}

          {/* Edit form */}
          <div style={{ flex: "1 1 360px", minWidth: 300, padding: "16px 24px 24px 24px" }}>

        {/* Entry type toggle — lets admin fix entries filed under the wrong category */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12, color: "#374151", fontWeight: 600, marginBottom: 5 }}>Entry Type</label>
          <div style={{ display: "flex", gap: 6 }}>
            {[
              { k: "vehicle", label: "\uD83D\uDE97 Vehicle" },
              { k: "other", label: "\uD83D\uDEE2 Oil & Others" },
            ].map(opt => {
              const sel = entryType === opt.k;
              return (
                <button key={opt.k} onClick={() => setEntryType(opt.k)} style={{
                  flex: 1, padding: "8px 10px", borderRadius: 8, fontSize: 12, cursor: "pointer",
                  fontFamily: "inherit", fontWeight: sel ? 700 : 500,
                  background: sel ? "#eff6ff" : "white", color: sel ? "#1d4ed8" : "#64748b",
                  border: `1.5px solid ${sel ? "#93c5fd" : "#e2e8f0"}`,
                }}>{opt.label}</button>
              );
            })}
          </div>
          {entryType !== (entry.entryType === "other" ? "other" : "vehicle") && (
            <div style={{ marginTop: 6, fontSize: 11, color: "#b45309", background: "#fefce8", border: "1px solid #fde68a", borderRadius: 6, padding: "6px 8px" }}>
              {"\u26A0 Converting this entry to "}<b>{entryType === "other" ? "Oil & Others" : "Vehicle"}</b>{". Some fields will be cleared on save."}
            </div>
          )}
        </div>

        <FieldInput label="Driver Name" value={f.driverName} onChange={v => set("driverName", v)} placeholder="Driver name" required />

        {entryType === "vehicle" ? (
          <>
            <FieldInput label="Registration" value={f.registration} onChange={v => set("registration", v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} placeholder="e.g. EIA53F" required />
            <FieldInput label="Date" value={f.date} onChange={v => set("date", v)} placeholder="DD/MM/YYYY" required />
            <FieldInput label={isHoursBased(f.vehicleType) ? "Hour Meter" : "Odometer"} value={f.odometer} onChange={v => set("odometer", v)} placeholder={isHoursBased(f.vehicleType) ? "e.g. 4500" : "e.g. 154597"} type="number" required />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <FieldInput label="Litres" value={f.litres} onChange={v => set("litres", v)} placeholder="e.g. 65.86" type="number" />
              <FieldInput label="Price per Litre ($)" value={f.pricePerLitre} onChange={v => set("pricePerLitre", v)} placeholder="e.g. 2.259" type="number" />
            </div>
            <FieldInput label="Total Fuel Cost ($)" value={f.totalCost} onChange={v => set("totalCost", v)} placeholder="e.g. 148.78" type="number" />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <FieldInput label="Station" value={f.station} onChange={v => set("station", v)} placeholder="e.g. Ampol Brookvale" />
              <FieldInput label="Fuel Type" value={f.fuelType} onChange={v => set("fuelType", v)} placeholder="e.g. Diesel" />
            </div>

            {/* Fleet card fields — editable here so admins can fix unclear AI card reads */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <FieldInput
                label="Fleet Card Number"
                value={formatCardNumber(f.fleetCardNumber)}
                onChange={v => set("fleetCardNumber", v.replace(/\s/g, ""))}
                placeholder="16-digit card"
              />
              <FieldInput
                label="Fleet Card Rego"
                value={f.cardRego}
                onChange={v => set("cardRego", v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7))}
                placeholder="e.g. EIA53F"
              />
            </div>
          </>
        ) : (
          <>
            {/* Oil & Others entry fields */}
            <FieldInput label="Date" value={f.date} onChange={v => set("date", v)} placeholder="DD/MM/YYYY" required />

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, color: "#374151", fontWeight: 600, marginBottom: 5 }}>Category</label>
              <div style={{ display: "flex", gap: 6 }}>
                {[
                  { k: "fuel", label: "\u26FD Fuel (Jerry Can, Chainsaw, etc.)" },
                  { k: "product", label: "\uD83D\uDEE2 Oil / Product" },
                ].map(opt => {
                  const sel = subType === opt.k;
                  return (
                    <button key={opt.k} onClick={() => setSubType(opt.k)} style={{
                      flex: 1, padding: "7px 8px", borderRadius: 8, fontSize: 11, cursor: "pointer",
                      fontFamily: "inherit", fontWeight: sel ? 700 : 500,
                      background: sel ? "#f0fdf4" : "white", color: sel ? "#15803d" : "#64748b",
                      border: `1.5px solid ${sel ? "#86efac" : "#e2e8f0"}`,
                    }}>{opt.label}</button>
                  );
                })}
              </div>
            </div>

            <FieldInput label="Equipment / Item" value={f.equipment} onChange={v => set("equipment", v)} placeholder={subType === "product" ? "e.g. Engine Oil" : "e.g. Jerry Can"} required />
            <FieldInput label="Linked Vehicle Rego (optional)" value={f.linkedVehicle} onChange={v => set("linkedVehicle", v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} placeholder="e.g. EIA53F" />

            {subType === "fuel" ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <FieldInput label="Litres" value={f.litres} onChange={v => set("litres", v)} placeholder="e.g. 5.00" type="number" />
                  <FieldInput label="Price per Litre ($)" value={f.pricePerLitre} onChange={v => set("pricePerLitre", v)} placeholder="e.g. 2.259" type="number" />
                </div>
                <FieldInput label="Total Cost ($)" value={f.totalCost} onChange={v => set("totalCost", v)} placeholder="e.g. 11.30" type="number" />
              </>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <FieldInput label="Quantity" value={f.quantity} onChange={v => set("quantity", v)} placeholder="e.g. 2" type="number" />
                <FieldInput label="Total Cost ($)" value={f.totalCost} onChange={v => set("totalCost", v)} placeholder="e.g. 19.98" type="number" />
              </div>
            )}

            <FieldInput label="Station" value={f.station} onChange={v => set("station", v)} placeholder="e.g. BP Marsden Park" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <FieldInput
                label="Fleet Card Number"
                value={formatCardNumber(f.fleetCardNumber)}
                onChange={v => set("fleetCardNumber", v.replace(/\s/g, ""))}
                placeholder="16-digit card"
              />
              <FieldInput
                label="Fleet Card Rego"
                value={f.cardRego}
                onChange={v => set("cardRego", v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7))}
                placeholder="e.g. EIA53F"
              />
            </div>
            <FieldInput label="Notes" value={f.notes} onChange={v => set("notes", v)} placeholder="Description / context" />
          </>
        )}

        {/* Division */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12, color: "#374151", fontWeight: 600, marginBottom: 5 }}>Division</label>
          <div style={{ display: "flex", gap: 6 }}>
            {DIVISION_KEYS.map(dk => {
              const dc = DIVISIONS[dk].color;
              const sel = f.division === dk;
              return (
                <button key={dk} onClick={() => { set("division", dk); set("vehicleType", ""); }} style={{
                  flex: 1, padding: "7px 10px", borderRadius: 8, fontSize: 12, cursor: "pointer",
                  fontFamily: "inherit", fontWeight: sel ? 700 : 500,
                  background: sel ? dc.bg : "white", color: sel ? dc.text : "#64748b",
                  border: `1.5px solid ${sel ? dc.border : "#e2e8f0"}`,
                }}>{dk}</button>
              );
            })}
          </div>
        </div>

        {/* Vehicle type — only for vehicle entries */}
        {entryType === "vehicle" && f.division && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 12, color: "#374151", fontWeight: 600, marginBottom: 5 }}>Vehicle Type</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {divTypes.map(t => {
                const c = VT_COLORS[t] || VT_COLORS.Other;
                const sel = f.vehicleType === t;
                return (
                  <button key={t} onClick={() => set("vehicleType", t)} style={{
                    padding: "5px 10px", borderRadius: 16, fontSize: 11, cursor: "pointer",
                    fontFamily: "inherit", fontWeight: sel ? 700 : 500,
                    background: sel ? c.bg : "white", color: sel ? c.text : "#64748b",
                    border: `1.5px solid ${sel ? c.border : "#e2e8f0"}`,
                  }}>{t}</button>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button onClick={() => onDelete(entry.id)} style={{
            padding: "10px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5",
            cursor: "pointer", fontFamily: "inherit",
          }}>Delete</button>
          <div style={{ flex: 1 }}>
            <PrimaryBtn onClick={() => {
              // Parse numeric inputs preserving zeros and decimals.
              // parseFloat("") → NaN → null; parseFloat("0") → 0 (not null).
              const numOrNull = (v) => {
                if (v === null || v === undefined) return null;
                const s = String(v).trim();
                if (s === "") return null;
                const n = parseFloat(s);
                return Number.isFinite(n) ? n : null;
              };
              const intOrNull = (v) => {
                if (v === null || v === undefined) return null;
                const s = String(v).trim();
                if (s === "") return null;
                const n = parseInt(s, 10);
                return Number.isFinite(n) ? n : null;
              };
              if (entryType === "other") {
                // Build "Oil & Others" entry — strip vehicle-only fields
                const isProduct = subType === "product";
                onSave({
                  ...entry,
                  entryType: "other",
                  subType: isProduct ? "product" : "fuel",
                  ...driverFieldsFor(f.driverName.trim()),
                  date: f.date.trim(),
                  equipment: f.equipment.trim(),
                  linkedVehicle: f.linkedVehicle.trim().toUpperCase() || null,
                  station: f.station.trim(),
                  notes: f.notes.trim(),
                  division: f.division || "Tree",
                  // Product = quantity+cost; Fuel = litres+ppl+cost
                  litres: isProduct ? null : numOrNull(f.litres),
                  pricePerLitre: isProduct ? null : numOrNull(f.pricePerLitre),
                  quantity: isProduct ? intOrNull(f.quantity) : null,
                  totalCost: numOrNull(f.totalCost),
                  fuelType: f.equipment.trim(),
                  fleetCardNumber: f.fleetCardNumber || entry.fleetCardNumber || "",
                  cardRego: f.cardRego || entry.cardRego || "",
                  // Clear vehicle-only fields
                  registration: null,
                  vehicleType: null,
                  odometer: null,
                });
              } else {
                // Vehicle entry — strip other-only fields
                onSave({
                  ...entry,
                  entryType: null, // normal vehicle entry
                  subType: null,
                  ...driverFieldsFor(f.driverName.trim()),
                  registration: f.registration.trim().toUpperCase(),
                  date: f.date.trim(),
                  odometer: numOrNull(f.odometer),
                  litres: numOrNull(f.litres),
                  pricePerLitre: numOrNull(f.pricePerLitre),
                  totalCost: numOrNull(f.totalCost),
                  station: f.station.trim(),
                  fuelType: f.fuelType.trim(),
                  division: f.division,
                  vehicleType: f.vehicleType,
                  fleetCardNumber: f.fleetCardNumber.replace(/\s/g, "") || "",
                  cardRego: (f.cardRego || "").toUpperCase().replace(/\s+/g, ""),
                  // Clear other-only fields
                  equipment: null,
                  linkedVehicle: null,
                  quantity: null,
                });
              }
            }}>Save Changes</PrimaryBtn>
          </div>
        </div>
        </div>{/* end form panel */}
        </div>{/* end split layout */}
      </div>
    </div>
  );
}

// ─── Service Modal ──────────────────────────────────────────────────────────
// Get the latest service record for flag calculations (backward compatible)
function getLatestService(svcData) {
  if (!svcData) return null;
  // New format: { records: [...] }
  if (svcData.records && Array.isArray(svcData.records)) {
    const services = svcData.records.filter(r => r.type === "service").sort((a, b) => (b.kms || 0) - (a.kms || 0));
    if (services.length > 0) return { lastServiceDate: services[0].date, lastServiceKms: services[0].kms };
    return null;
  }
  // Old format: { lastServiceDate, lastServiceKms }
  if (svcData.lastServiceDate || svcData.lastServiceKms) return svcData;
  return null;
}

// Migrate old service format to new
function migrateServiceData(svcData) {
  if (!svcData) return { records: [] };
  if (svcData.records) return svcData;
  // Old format → new
  const records = [];
  if (svcData.lastServiceDate || svcData.lastServiceKms) {
    records.push({
      id: "migrated-1",
      type: "service",
      date: svcData.lastServiceDate || "",
      kms: svcData.lastServiceKms || null,
      description: "Service (migrated from previous record)",
      addedBy: "System",
      addedAt: new Date().toISOString(),
    });
  }
  return { records };
}

const SERVICE_RECORD_TYPES = [
  { value: "service", label: "\uD83D\uDD27 Service", color: "#16a34a" },
  { value: "mechanical", label: "\u2699 Mechanical Repair", color: "#2563eb" },
  { value: "inspection", label: "\uD83D\uDD0D Inspection", color: "#f59e0b" },
  { value: "note", label: "\uD83D\uDCDD Note", color: "#64748b" },
];

function ServiceModal({ rego, current, onSave, onClose, vehicleType: vtProp }) {
  const data = migrateServiceData(current);
  const [records, setRecords] = useState(data.records || []);
  const [addMode, setAddMode] = useState(false);
  const [newType, setNewType] = useState("service");
  const [newDate, setNewDate] = useState("");
  const [newKms, setNewKms] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newBy, setNewBy] = useState("");

  const sorted = [...records].sort((a, b) => {
    if (a.kms && b.kms) return b.kms - a.kms;
    return (b.addedAt || "").localeCompare(a.addedAt || "");
  });

  const addRecord = () => {
    if (!newDate && !newDesc) return;
    const rec = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: newType,
      date: newDate,
      kms: parseFloat(newKms) || null,
      description: newDesc.trim(),
      addedBy: newBy.trim() || "Admin",
      addedAt: new Date().toISOString(),
    };
    const updated = [...records, rec];
    setRecords(updated);
    onSave(rego, { records: updated });
    setAddMode(false);
    setNewType("service"); setNewDate(""); setNewKms(""); setNewDesc(""); setNewBy("");
  };

  const deleteRecord = (id) => {
    const updated = records.filter(r => r.id !== id);
    setRecords(updated);
    onSave(rego, { records: updated });
  };

  const latest = getLatestService({ records });

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex",
      alignItems: "flex-start", justifyContent: "center", zIndex: 100, padding: "40px 16px",
      overflowY: "auto",
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "white", borderRadius: 12, padding: 24, width: "100%", maxWidth: 520,
        boxShadow: "0 20px 40px rgba(0,0,0,0.15)", maxHeight: "85vh", overflowY: "auto",
      }} className="fade-in">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>{"\uD83D\uDD27"} Service & Mechanics</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>{rego} {"\u00B7"} {records.length} record{records.length !== 1 ? "s" : ""}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: "#94a3b8", cursor: "pointer" }}>{"\u00D7"}</button>
        </div>

        {/* Service status summary */}
        {latest && (
          <div style={{
            background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8,
            padding: "10px 12px", marginBottom: 16, fontSize: 12,
          }}>
            <div style={{ fontWeight: 700, color: "#15803d", fontSize: 11, marginBottom: 4 }}>Latest Service</div>
            <div style={{ display: "flex", gap: 16 }}>
              <span><span style={{ color: "#64748b" }}>Date:</span> <strong>{latest.lastServiceDate}</strong></span>
              <span><span style={{ color: "#64748b" }}>{isHoursBased(vtProp) ? "Hours:" : "Odometer:"}</span> <strong>{latest.lastServiceKms?.toLocaleString()} {odoUnit(vtProp)}</strong></span>
              {latest.lastServiceKms != null && <span><span style={{ color: "#64748b" }}>Next due:</span> <strong>{(latest.lastServiceKms + serviceInterval(vtProp)).toLocaleString()} {odoUnit(vtProp)}</strong></span>}
            </div>
          </div>
        )}

        {/* Add new record button */}
        {!addMode ? (
          <button onClick={() => setAddMode(true)} style={{
            width: "100%", padding: "10px", borderRadius: 8, fontSize: 13, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit", marginBottom: 16,
            background: "#16a34a", color: "white", border: "none",
          }}>{"\u002B"} Add Record</button>
        ) : (
          <div style={{
            background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10,
            padding: 14, marginBottom: 16,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 10 }}>New Record</div>

            {/* Type selector */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
              {SERVICE_RECORD_TYPES.map(t => (
                <button key={t.value} onClick={() => setNewType(t.value)} style={{
                  padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit",
                  background: newType === t.value ? t.color : "white",
                  color: newType === t.value ? "white" : t.color,
                  border: `1px solid ${t.color}`,
                }}>{t.label}</button>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <FieldInput label="Date" value={newDate} onChange={setNewDate} placeholder="DD/MM/YYYY" required />
              {(newType === "service" || newType === "mechanical") && (
                <FieldInput label={isHoursBased(vtProp) ? "Hour Meter" : "Odometer (km)"} value={newKms} onChange={setNewKms} placeholder={isHoursBased(vtProp) ? "e.g. 4500" : "e.g. 154000"} type="number" />
              )}
            </div>
            <FieldInput label="Description" value={newDesc} onChange={setNewDesc} placeholder={
              newType === "service" ? "e.g. 10,000km service — oil, filters, brakes checked" :
              newType === "mechanical" ? "e.g. Replaced alternator belt, new battery fitted" :
              newType === "inspection" ? "e.g. Pre-purchase inspection — passed" :
              "e.g. Driver reported grinding noise from front left"
            } />
            <FieldInput label="Added by" value={newBy} onChange={setNewBy} placeholder="Your name" />

            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <SecondaryBtn onClick={() => { setAddMode(false); setNewType("service"); setNewDate(""); setNewKms(""); setNewDesc(""); setNewBy(""); }} small>Cancel</SecondaryBtn>
              <div style={{ flex: 1 }}><PrimaryBtn onClick={addRecord}>Save Record</PrimaryBtn></div>
            </div>
          </div>
        )}

        {/* Records list */}
        {sorted.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 0", color: "#94a3b8", fontSize: 13 }}>
            No records yet. Add a service, repair, or note.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sorted.map(rec => {
              const typeInfo = SERVICE_RECORD_TYPES.find(t => t.value === rec.type) || SERVICE_RECORD_TYPES[3];
              return (
                <div key={rec.id} style={{
                  border: `1px solid ${typeInfo.color}20`, borderLeft: `4px solid ${typeInfo.color}`,
                  borderRadius: 8, padding: "10px 12px", background: "white",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <span style={{
                        fontSize: 9, fontWeight: 700, color: typeInfo.color, textTransform: "uppercase",
                        background: `${typeInfo.color}15`, padding: "2px 6px", borderRadius: 4, letterSpacing: "0.04em",
                      }}>{typeInfo.label}</span>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginTop: 4 }}>{rec.description || "No description"}</div>
                    </div>
                    <button onClick={() => deleteRecord(rec.id)} style={{
                      background: "none", border: "none", color: "#cbd5e1", cursor: "pointer", fontSize: 14,
                    }}>{"\u00D7"}</button>
                  </div>
                  <div style={{ display: "flex", gap: 12, fontSize: 10, color: "#64748b", marginTop: 6, flexWrap: "wrap" }}>
                    {rec.date && <span>{"\uD83D\uDCC5"} {rec.date}</span>}
                    {rec.kms && <span>{"\uD83D\uDCCF"} {rec.kms.toLocaleString()} {odoUnit(vtProp)}</span>}
                    {rec.addedBy && <span>{"\uD83D\uDC64"} {rec.addedBy}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Flag logic ─────────────────────────────────────────────────────────────
// `ranges` is the per-vehicle-type efficiency-threshold map, pulled from
// component state (admin-tunable in Settings). Falls back to the factory
// defaults when no override exists or this is called from a code path that
// hasn't been wired up yet — keeps the function safe to call out of context.
function getEntryFlags(entry, prevEntry, vehicleType, svcData, ranges = DEFAULT_EFFICIENCY_RANGES) {
  const flags = [];
  const odo = entry.odometer;
  const prevOdo = prevEntry?.odometer;
  const litres = entry.litres;
  const ppl = entry.pricePerLitre;
  const totalCost = entry.totalCost;

  // ══════════════════════════════════════════════════════════════════════════
  // category: "ai" — AI scan confidence & data quality issues
  // These appear in the DATA section for manual review/correction
  // ══════════════════════════════════════════════════════════════════════════

  // AI Confidence Flags — receipt-level uncertainty
  const allIssues = [...(entry._aiIssues || [])];
  if (entry._aiConfidence === "low") {
    flags.push({ category: "ai", type: "danger", text: "AI low confidence", detail: `The scanner was unsure about this receipt. Issues: ${allIssues.join(", ") || "unclear image"}` });
  } else if (entry._aiConfidence === "medium") {
    flags.push({ category: "ai", type: "warn", text: "AI uncertain", detail: `Some values may be inaccurate. Issues: ${allIssues.join(", ") || "partially unclear"}` });
  }

  // Fleet card mistake flag — only flag when the card TEXT read is itself
  // uncertain. Card/rego mismatch is NOT an error (many drivers share cards),
  // so we deliberately do not flag mismatches here.
  //
  // _cardConfidence comes from the AI's own self-report on how clearly it
  // could read the embossed digits — NOT from the fuzzy matcher (which has
  // its own `_cardMatchConfidence`). A scan where the AI confidently read
  // digits but the matcher couldn't map them to a known card is not an AI
  // error; the card may simply be new or the matcher's DB out of date.
  if (entry._cardConfidence === "low" || entry._cardConfidence === "medium") {
    const raw = entry._cardRawRead || entry._cardOriginalCard || "?";
    const issues = Array.isArray(entry._cardAiIssues) && entry._cardAiIssues.length
      ? ` Issues: ${entry._cardAiIssues.join("; ")}.`
      : "";
    const wording = entry._cardConfidence === "low"
      ? "couldn't confidently read"
      : "was only partially confident reading";
    flags.push({
      category: "ai",
      type: entry._cardConfidence === "low" ? "danger" : "warn",
      text: "Fleet card unclear",
      detail: `Scanner ${wording} the fleet card (AI saw "${raw}").${issues} Verify the card number and rego below.`,
    });
  }

  // Registration looks suspicious
  const rego = entry.registration || "";
  if (rego && (rego.length < 4 || rego.length > 8)) {
    flags.push({ category: "ai", type: "warn", text: "Unusual rego format", detail: `"${rego}" — expected 4-8 characters` });
  }

  // Known card/rego exception — informational only. Mismatches are NOT
  // treated as errors because fleet cards are often shared between vehicles.
  const cardRego = entry.cardRego || entry.fleetCardVehicle || "";
  if (cardRego && rego && cardRego.toUpperCase().replace(/\s+/g, "") !== rego.toUpperCase().replace(/\s+/g, "")) {
    const exception = isKnownCardRegoException(cardRego, rego);
    if (exception) {
      flags.push({ category: "ai", type: "info", text: "Known card/rego exception", detail: `${exception.driver}: card embossed "${exception.cardRego}" but vehicle is "${exception.vehicleRego}" — ${exception.reason}` });
    }
  }

  // Driver name looks suspicious
  const driverName = entry.driverName || "";
  if (driverName && (/\d/.test(driverName))) {
    flags.push({ category: "ai", type: "warn", text: "Numbers in driver name", detail: `"${driverName}" contains digits — possible typo` });
  }
  if (driverName && driverName.split(" ").some(p => p.length === 1 && p !== "&")) {
    flags.push({ category: "ai", type: "info", text: "Short name part", detail: `"${driverName}" — check first/last name is complete` });
  }

  // Driver-name resolution flags — attached by canonicalizeDriverName at
  // submission time. `nickname` / `alias` entries were auto-corrected on
  // save (info-level acknowledgement), while `typo` matches are kept as
  // typed and surface a warn-level suggestion for admin to either confirm
  // or correct.
  const dnRes = entry._driverNameResolution;
  if (dnRes && dnRes.confidence) {
    if (dnRes.confidence === "nickname" || dnRes.confidence === "alias") {
      flags.push({
        category: "ai", type: "info", text: "Driver name normalised",
        detail: `Submitted as "${dnRes.from}" \u2192 saved as "${dnRes.canonical}" (${dnRes.confidence} match). Edit if this merged the wrong person.`,
      });
    } else if (dnRes.confidence === "typo") {
      flags.push({
        category: "ai", type: "warn", text: "Possible driver-name typo",
        detail: `"${dnRes.from}" looks close to "${dnRes.canonical}" (${dnRes.distance}-letter difference). Open the entry to confirm or correct.`,
      });
    }
  }

  // Unusually high litres
  if (litres > 300) {
    flags.push({ category: "ai", type: "warn", text: "Very high litres", detail: `${litres}L — verify this is correct` });
  }

  // Fuel price outside reasonable range
  if (ppl && (ppl < 1.0 || ppl > 3.50)) {
    flags.push({ category: "ai", type: "warn", text: "Unusual fuel price", detail: `$${ppl}/L — expected $1.00-$3.50/L` });
  }

  // Date in the future
  if (entry.date) {
    if (entry.date && isAfterSydneyToday(entry.date)) {
      flags.push({ category: "ai", type: "danger", text: "Future date", detail: `${entry.date} is in the future — likely misread` });
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // category: "ops" — Operational / fleet management issues
  // These appear in the DASHBOARD for admin resolution
  // ══════════════════════════════════════════════════════════════════════════

  const hrsMode = isHoursBased(vehicleType);
  const unit = hrsMode ? "hrs" : "km";
  let kmTravelled = null;
  if (prevOdo != null && odo != null) {
    kmTravelled = odo - prevOdo;
    if (kmTravelled < 0) {
      flags.push({ category: "ops", type: "danger", text: `${hrsMode ? "Hours" : "Odo"} went backwards`, detail: `${prevOdo.toLocaleString()} \u2192 ${odo.toLocaleString()} ${unit}` });
    } else if (kmTravelled === 0) {
      flags.push({ category: "ops", type: "warn", text: `No ${unit} recorded`, detail: `${hrsMode ? "Hours" : "Odometer"} unchanged since last entry` });
    }
  }

  if (kmTravelled > 0 && litres > 0) {
    const efficiency = litres / kmTravelled; // L/km or L/hr depending on type
    const range = ranges[vehicleType] || ranges.Other || DEFAULT_EFFICIENCY_RANGES.Other;
    const effUnit = hrsMode ? "L/hr" : "L/km";
    const decimals = hrsMode ? 1 : 3;
    if (efficiency > range.high) {
      flags.push({ category: "ops", type: "warn", text: "High fuel usage", detail: `${efficiency.toFixed(decimals)} ${effUnit} \u2014 above expected for ${vehicleType}` });
    }
    // "Low fuel usage" used to flag here as well (info-level), but admin
    // found no operational benefit \u2014 removed in May 2026. The `range.low`
    // value is still used to colour-tint values in the Data/Dashboard
    // tables blue, but no longer raises a flag for review.
  }

  if (litres > 0 && ppl > 0 && totalCost > 0) {
    const calcCost = litres * ppl;
    const diff = totalCost - calcCost;
    const absDiff = Math.abs(diff);
    const pctDiff = (absDiff / calcCost) * 100;
    if (pctDiff > 15) {
      flags.push({ category: "ops", type: "warn", text: `Cost variance $${absDiff.toFixed(2)} (${pctDiff.toFixed(0)}%)`, detail: `Actual $${totalCost.toFixed(2)} vs calc $${calcCost.toFixed(2)} \u2014 exceeds fleet card leeway` });
    } else if (absDiff > 0.50) {
      flags.push({ category: "ops", type: "info", text: diff > 0 ? "Fleet card surcharge" : "Fleet card discount", detail: `${diff > 0 ? "+" : ""}$${diff.toFixed(2)} (${pctDiff.toFixed(1)}%) \u2014 actual $${totalCost.toFixed(2)} vs calc $${calcCost.toFixed(2)}` });
    }
  }

  if (svcData) {
    const latestSvc = getLatestService(svcData);
    if (latestSvc?.lastServiceKms && odo) {
      const svcInt = serviceInterval(vehicleType);
      const svcWarn = serviceWarning(vehicleType);
      const nextDue = latestSvc.lastServiceKms + svcInt;
      const since = odo - latestSvc.lastServiceKms;
      const remaining = nextDue - odo;
      if (odo >= nextDue) {
        flags.push({ category: "ops", type: "danger", text: "SERVICE OVERDUE", detail: `${since.toLocaleString()} ${unit} since service \u2014 due at ${nextDue.toLocaleString()} ${unit}` });
      } else if (remaining <= svcWarn) {
        flags.push({ category: "ops", type: "warn", text: `Service in ${remaining.toLocaleString()} ${unit}`, detail: `${since.toLocaleString()} ${unit} since service \u2014 due at ${nextDue.toLocaleString()} ${unit}` });
      }
    }
  }

  return flags;
}

// ─── Main App ────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState("submit");
  const [step, setStep] = useState(1);
  const [userRole, setUserRole] = useState("user"); // "user" | "admin"
  const [showLogin, setShowLogin] = useState(false);
  const [loginInput, setLoginInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [entries, setEntries] = useState([]);
  const [serviceData, setServiceData] = useState({});
  const [learnedDB, setLearnedDB] = useState({}); // { "REGO": { t, d, n, m, dr, c, f } } — learned from driver submissions
  const [learnedCardMappings, setLearnedCardMappings] = useState({}); // { "raw_unique8": { correctCard, correctRego, rawCard, rawRego, learnedAt } }
  const [learnedCorrections, setLearnedCorrections] = useState({ stations: {}, stationPrices: {}, digitPatterns: [], fuelTypeCorrections: {}, stats: { totalCorrections: 0, correctionsByField: {}, lastUpdated: null } });
  const [aiScanSnapshot, setAiScanSnapshot] = useState(null); // frozen copy of AI scan output before user edits
  const [photoDate, setPhotoDate] = useState(null); // extracted EXIF date from receipt photo
  const [dateCrossValidation, setDateCrossValidation] = useState(null); // cross-validation result
  const learnedCardMappingsRef = useRef(learnedCardMappings);
  const learnedDBRef = useRef(learnedDB);
  const learnedCorrectionsRef = useRef(learnedCorrections);
  const entriesRef = useRef(entries);
  useEffect(() => { learnedDBRef.current = learnedDB; }, [learnedDB]);
  useEffect(() => { learnedCardMappingsRef.current = learnedCardMappings; }, [learnedCardMappings]);
  useEffect(() => { learnedCorrectionsRef.current = learnedCorrections; }, [learnedCorrections]);
  useEffect(() => { entriesRef.current = entries; }, [entries]);

  const [storageReady, setStorageReady] = useState(false);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState("");
  // Cross-device sync tracking: timestamp of last successful cloud refresh
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const lastRefreshAttemptRef = useRef(0); // debouncing guard
  // Tracks whether an edit modal is open — cloud refresh pauses while set so
  // admin's unsaved form state isn't clobbered by a Realtime push mid-edit.
  const editingInProgressRef = useRef(false);
  // In-flight cloud saves. The post-close "force refresh" used to fetch
  // cloud state before fire-and-forget save() promises had landed, then
  // overwrite local with stale cloud data — admin's resolved flags would
  // pop back into the open list "for a second" before being re-resolved.
  // Track which entries / flags have a save in flight so refreshFromCloud
  // can skip their cloud copies until the write settles.
  const pendingEntrySavesRef = useRef(new Set());
  const pendingFlagSavesRef = useRef(new Set());
  const resolvedFlagsRef = useRef({});

  const [apiKey, setApiKey] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  // Per-task model selection (orientation / receipt / card). Persisted
  // via localStorage + Supabase setting "api_models" so all devices use
  // the same models. Falls back to DEFAULT_API_MODELS if nothing saved.
  const [apiModels, setApiModels] = useState(DEFAULT_API_MODELS);
  // Per-vehicle-type fuel-efficiency thresholds for the "High fuel usage" /
  // "Low fuel usage" flags. Admin-tunable in Settings. Persisted via
  // localStorage + Supabase setting "efficiency_thresholds" so all devices
  // see the same values. Falls back to DEFAULT_EFFICIENCY_RANGES if no
  // override saved. Stored as a partial map (only customised types are
  // saved); merged with defaults on read so adding a new vehicle type to
  // DEFAULT_EFFICIENCY_RANGES later doesn't require migrating saved data.
  const [efficiencyThresholds, setEfficiencyThresholds] = useState(DEFAULT_EFFICIENCY_RANGES);
  const efficiencyThresholdsRef = useRef(efficiencyThresholds);
  useEffect(() => { efficiencyThresholdsRef.current = efficiencyThresholds; }, [efficiencyThresholds]);
  // Admin-curated "merge driver names" map — persisted via localStorage +
  // Supabase setting "learned_driver_aliases". Keys are lower-case source
  // spellings, values are the canonical display name. Synced into the
  // module-level _learnedDriverAliases mirror via setLearnedDriverAliasesDB
  // whenever this state changes, so canonicalizeDriverName picks it up.
  const [learnedDriverAliases, setLearnedDriverAliases] = useState({});
  useEffect(() => { setLearnedDriverAliasesDB(learnedDriverAliases); }, [learnedDriverAliases]);

  // ── Driver auto-fill profiles ──────────────────────────────────────────
  // Admin-curated map of driver name → default rego/division/vehicle/card.
  // When a driver enters their name on Step 1 and it matches a key here,
  // the form auto-fills with the saved defaults and the fleet-card photo
  // step is skipped (the saved card details get attached directly). This
  // is the "single-vehicle / single-card user" workflow for management
  // who use the same vehicle and card every time. Cloud-synced via
  // Supabase setting "driver_profiles" so admin can manage from any
  // device and changes propagate to all phones in the field. Keyed by
  // lower-case full name ("first last").
  const [driverProfiles, setDriverProfiles] = useState({});
  const driverProfilesRef = useRef(driverProfiles);
  useEffect(() => { driverProfilesRef.current = driverProfiles; }, [driverProfiles]);
  // Profile currently applied to the in-progress submission (or null).
  // When set, the wizard skips the fleet-card photo step and shows the
  // "Submitting as X" banner on Step 1. Cleared by clicking
  // "Different vehicle today?" or "Scan card anyway" in the banner.
  // Ref alongside the state so async scan handlers can read the current
  // value after their `await`s (state captured at the start of the
  // handler may be stale by the time the AI scan returns).
  const [profileApplied, setProfileApplied] = useState(null);
  const profileAppliedRef = useRef(profileApplied);
  useEffect(() => { profileAppliedRef.current = profileApplied; }, [profileApplied]);
  // Settings → Driver profiles form state. Local-only; clears after a
  // successful add or edit.
  const [profileEditing, setProfileEditing] = useState(null); // null | { isNew: bool, original?: lowerKey, name, rego, division, vehicleType, cardNumber, cardRego }

  const [showKey, setShowKey] = useState(false);
  // Settings → Merge driver names form state. Local-only; clears after a
  // successful merge.
  const [mergeFrom, setMergeFrom] = useState("");
  const [mergeTo, setMergeTo] = useState("");
  const [adminPasscode, setAdminPasscode] = useState("admin"); // default passcode
  const [passcodeInput, setPasscodeInput] = useState("");

  const [form, setForm] = useState({ driverFirstName: "", driverLastName: "", registration: "", division: "", vehicleType: "", odometer: "", ppl: "" });
  const [savedDriver, setSavedDriver] = useState(null); // { name, rego }
  const [otherMode, setOtherMode] = useState(false);
  const [otherForm, setOtherForm] = useState({ equipment: "", station: "", fleetCard: "", cardRego: "", notes: "", division: "Tree", litres: "", ppl: "", totalCost: "" });
  const [driverCards, setDriverCards] = useState([]); // matched fleet cards for current driver name

  const [receiptPreview, setReceiptPreview] = useState(null);
  const [receiptB64, setReceiptB64] = useState(null);
  const [receiptMime, setReceiptMime] = useState("image/jpeg");
  const [receiptRotation, setReceiptRotation] = useState(0);
  const [receiptFile, setReceiptFile] = useState(null); // original file for re-compression on rotate
  const [receiptData, setReceiptData] = useState(null);
  const [reviewConfirmed, setReviewConfirmed] = useState(false); // user confirmed suspect scan values
  const [receiptScanning, setReceiptScanning] = useState(false);

  const [cardPreview, setCardPreview] = useState(null);
  const [cardB64, setCardB64] = useState(null);
  const [cardData, setCardData] = useState(null);
  const [cardScanning, setCardScanning] = useState(false);

  const [saving, setSaving] = useState(false);
  const [splitMode, setSplitMode] = useState(false);
  const [splits, setSplits] = useState([]); // [{ id, rego, odometer, litres, _match }]
  const [manualCard, setManualCard] = useState(false);
  const [manualCardNum, setManualCardNum] = useState("");
  const [manualCardRego, setManualCardRego] = useState("");
  const [dataFilter, setDataFilter] = useState("All");
  const [dataSearch, setDataSearch] = useState("");
  const [driverSearch, setDriverSearch] = useState("");
  const [expandedDriver, setExpandedDriver] = useState(null);
  // Drivers tab — collapsible "Deleted drivers archive" at the bottom of
  // the Drivers list. Closed by default so the active list stays uncluttered.
  const [deletedDriversExpanded, setDeletedDriversExpanded] = useState(false);
  const [cardMonth, setCardMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; });
  const [cardSearch, setCardSearch] = useState("");
  const [editingCard, setEditingCard] = useState(null); // { oldCard, newCard, newDrivers, newRegos } for inline card header editing
  const [expandedFuelType, setExpandedFuelType] = useState(null);
  const [collapsedFleetGroups, setCollapsedFleetGroups] = useState({});
  // Per-section collapse state on the Dashboard (persists via localStorage)
  const [collapsedDashSections, setCollapsedDashSections] = useState(() => {
    try { return JSON.parse(localStorage.getItem("fuel_dash_collapsed") || "{}"); } catch (_) { return {}; }
  });
  const toggleDashSection = (key) => setCollapsedDashSections(prev => {
    const next = { ...prev, [key]: !prev[key] };
    try { localStorage.setItem("fuel_dash_collapsed", JSON.stringify(next)); } catch (_) {}
    return next;
  });
  const [worseningFilter, setWorseningFilter] = useState(false); // highlight worsening vehicles on dashboard
  const [overdueFilter, setOverdueFilter] = useState(false); // show overdue vehicles on dashboard
  const [approachingFilter, setApproachingFilter] = useState(false); // show approaching service vehicles on dashboard
  const [vehicleSpendSort, setVehicleSpendSort] = useState("cost-desc");
  const [expandedSpendVehicle, setExpandedSpendVehicle] = useState(null); // rego expanded in spend section
  const [expandedFleetVehicle, setExpandedFleetVehicle] = useState(null); // rego expanded in dashboard fleet table
  const [pendingExtraEntries, setPendingExtraEntries] = useState(null); // auto-detected extra receipt lines after submission
  const [showAddVehicleData, setShowAddVehicleData] = useState(false);
  const [dashPeriod, setDashPeriod] = useState("daily"); // "daily" | "weekly" | "monthly" | "custom" | "all"
  // Use Sydney local date (not UTC) so opening the dashboard shows today's
  // entries — toISOString() can return yesterday's date during early-morning
  // Sydney hours because it returns UTC.
  const [dashDate, setDashDate] = useState(() => {
    const { y, m, d } = sydneyTodayYMD();
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  });
  const [dashDateEnd, setDashDateEnd] = useState(() => {
    const { y, m, d } = sydneyTodayYMD();
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  });
  const [expandedRego, setExpandedRego] = useState(null);
  const [serviceModal, setServiceModal] = useState(null);
  const [showFlags, setShowFlags] = useState(false);
  const [showAiReview, setShowAiReview] = useState(false);
  const [showAiFlags, setShowAiFlags] = useState(false);
  const [resolvedFlags, setResolvedFlags] = useState({}); // { "flagId": { by, note, at } }
  // Mirror resolvedFlags into a ref so refreshFromCloud and async cloud
  // saves can read the latest value without stale-closure surprises.
  useEffect(() => { resolvedFlagsRef.current = resolvedFlags; }, [resolvedFlags]);
  const [flagsFilter, setFlagsFilter] = useState("open"); // "open" | "resolved" | "all"
  const [aiFlagsFilter, setAiFlagsFilter] = useState("open"); // separate filter for AI flags modal
  const [replyingFlag, setReplyingFlag] = useState(null); // flagId currently being responded to
  const [flagsRegoSearch, setFlagsRegoSearch] = useState(""); // rego search in flags modal
  const [flagDetailPopup, setFlagDetailPopup] = useState(null); // { flag, x, y } for inline flag detail popup
  const [expandedReceipt, setExpandedReceipt] = useState(null); // flagId or entryId whose receipt is shown inline
  const [selectedFlagIds, setSelectedFlagIds] = useState(() => new Set()); // bulk-select for flag modals
  const [editingEntry, setEditingEntry] = useState(null); // entry object being edited
  const [vehicleMenu, setVehicleMenu] = useState(null); // rego string for open menu
  const [editingVehicle, setEditingVehicle] = useState(null); // rego string for edit vehicle modal
  const [manualEntry, setManualEntry] = useState(null); // { rego, division, vehicleType } for manual add
  const [manualReceiptMode, setManualReceiptMode] = useState(false); // skip photo, enter receipt data manually
  const [manualReceipt, setManualReceipt] = useState({ date: "", station: "", cardNumber: "", cardRego: "" });
  const [viewingReceipt, setViewingReceipt] = useState(null); // entry ID to view receipt
  const [confirmAction, setConfirmAction] = useState(null);
  const [addVehicle, setAddVehicle] = useState({ rego: "", div: "Tree", type: "Ute", name: "", owner: "", fuel: "Diesel" });
  // Form state for the "Teach AI a Fleet Card" settings card — lets admin
  // pre-register a rego → card mapping so the scanner can't misread it.
  const [addCard, setAddCard] = useState({ rego: "", cardNumber: "", driver: "", vehicleRego: "" });
  const [fleetCardTxns, setFleetCardTxns] = useState([]); // imported fleet card transactions
  // Soft-delete bin: deleted entries go here (with a _deletedAt timestamp)
  // instead of being hard-deleted. Admin can restore from the Data tab or
  // permanently purge. Auto-purged after TRASH_RETENTION_MS on app load.
  const [trashEntries, setTrashEntries] = useState([]);
  const trashEntriesRef = useRef(trashEntries);
  useEffect(() => { trashEntriesRef.current = trashEntries; }, [trashEntries]);
  const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
  const [reconFilter, setReconFilter] = useState("all"); // "all" | "matched" | "scan_error" | "missing" | "app_only"
  const [reconSearch, setReconSearch] = useState("");
  const [reconUploading, setReconUploading] = useState(false);
  // Reconciliation date range — defaults to today's Sydney date on both ends
  // so the admin sees a single-day reconciliation by default (their usual
  // end-of-day workflow). Empty string means "no bound on that side".
  const [reconFromDate, setReconFromDate] = useState(() => {
    const { y, m, d } = sydneyTodayYMD();
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  });
  const [reconToDate, setReconToDate] = useState(() => {
    const { y, m, d } = sydneyTodayYMD();
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  });
  const csvInputRef = useRef(null);

  // ── Receipt image compression ──
  // Compress a base64 image to JPEG at reduced resolution for database storage
  const compressReceiptImage = (b64, mime) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        // Max 1200px on longest side — good enough for receipt readability
        const MAX = 1200;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else { w = Math.round(w * MAX / h); h = MAX; }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        // Compress to JPEG at 0.6 quality — typically yields 80-200KB for a receipt
        const compressed = canvas.toDataURL("image/jpeg", 0.6);
        const compressedB64 = compressed.split(",")[1];
        resolve({ b64: compressedB64, mime: "image/jpeg" });
      };
      img.onerror = () => resolve({ b64, mime }); // If compression fails, use original
      img.src = `data:${mime};base64,${b64}`;
    });
  };

  // ── Receipt image storage ──
  //
  // Two storage backends, tried in order:
  //   1. Supabase Storage bucket "receipts" — PRIMARY for new receipts.
  //      Keeps photo blobs OUT of Postgres tables, so they don't bloat
  //      app_settings rows or get rebroadcast to every admin tab on every
  //      Realtime push. Bucket reads/writes don't count against the
  //      project's Postgres Disk IO budget — which historically was the
  //      single biggest IO drain (each receipt-save UPSERT into
  //      app_settings was a multi-hundred-KB row write + a Realtime
  //      broadcast of that same KB payload to every subscribed client).
  //   2. app_settings table (legacy fallback) — kept so existing receipts
  //      already saved as `__db__` URLs still work, and so a bucket
  //      misconfiguration doesn't break receipt submission.
  //
  // `loadReceiptImage` already handles both URL shapes (a non-`__db__`
  // string is treated as a direct image URL and shown via <img src=...>;
  // a `__db__<id>` string triggers an app_settings lookup).
  const saveReceiptImage = async (entryId, b64, mime) => {
    try {
      // Compress the image first to keep storage manageable
      const compressed = await compressReceiptImage(b64, mime);

      if (supabase) {
        // PRIMARY: upload to the storage bucket. JPEG bytes go straight
        // to the bucket; we persist the resulting public URL on the
        // entry's receiptUrl so loadReceiptImage's non-`__db__` branch
        // picks it up automatically.
        try {
          const fileBytes = Uint8Array.from(atob(compressed.b64), c => c.charCodeAt(0));
          const path = `${entryId}.jpg`;
          const { error: upErr } = await supabase.storage
            .from("receipts")
            .upload(path, fileBytes, { contentType: "image/jpeg", upsert: true });
          if (!upErr) {
            const { data: pub } = supabase.storage.from("receipts").getPublicUrl(path);
            const entry = entriesRef.current.find(e => e.id === entryId);
            if (entry && pub?.publicUrl) {
              const updated = { ...entry, hasReceipt: true, receiptUrl: pub.publicUrl };
              const nextEntries = entriesRef.current.map(e => e.id === entryId ? updated : e);
              entriesRef.current = nextEntries;
              setEntries(nextEntries);
              db.saveEntry(updated).catch(() => {});
            }
            console.log("Receipt image uploaded to storage bucket for entry:", entryId);
            return;
          }
          console.warn("Storage bucket upload failed, falling back to app_settings:", upErr);
        } catch (bucketErr) {
          console.warn("Storage bucket path threw, falling back to app_settings:", bucketErr);
        }

        // FALLBACK: legacy app_settings path. Only used if the bucket
        // upload fails (RLS misconfigured, bucket missing, network blip).
        const imgData = JSON.stringify({ b64: compressed.b64, mime: compressed.mime });
        await db.saveSetting(`receipt_img_${entryId}`, imgData);
        const entry = entriesRef.current.find(e => e.id === entryId);
        if (entry) {
          const updated = { ...entry, hasReceipt: true, receiptUrl: `__db__${entryId}` };
          const nextEntries = entriesRef.current.map(e => e.id === entryId ? updated : e);
          entriesRef.current = nextEntries;
          setEntries(nextEntries);
          db.saveEntry(updated).catch(() => {});
        }
        console.log("Receipt image saved to app_settings (fallback) for entry:", entryId);
      } else {
        // No Supabase — fallback to localStorage
        const imgData = JSON.stringify({ b64: compressed.b64, mime: compressed.mime });
        await window.storage.set(`fuel_receipt_img_${entryId}`, imgData);
      }
    } catch (err) {
      console.error("saveReceiptImage error:", err);
      showToast("Receipt image could not be saved — trying local backup", "warn");
      // Final fallback: localStorage
      try {
        const compressed = await compressReceiptImage(b64, mime);
        await window.storage.set(`fuel_receipt_img_${entryId}`, JSON.stringify(compressed));
      } catch (_) {}
    }
  };

  // Stable identity so child modals (ReceiptViewer, EditEntryModal, etc.)
  // don't re-run their receipt-fetch effect on every parent re-render. All
  // dependencies the function actually uses are refs, so empty deps are safe.
  const loadReceiptImage = useCallback(async (entryId) => {
    try {
      const entry = entriesRef.current.find(e => e.id === entryId);
      // Check for database-stored receipt
      if (entry?.receiptUrl?.startsWith("__db__") || entry?.receiptUrl?.startsWith("__db_fallback__")) {
        const raw = await db.loadSetting(`receipt_img_${entryId}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          return { url: `data:${parsed.mime};base64,${parsed.b64}` };
        }
      }
      // Check for Supabase Storage URL (legacy / if bucket exists)
      if (entry?.receiptUrl && !entry.receiptUrl.startsWith("__db")) {
        return { url: entry.receiptUrl };
      }
      // Try loading from database even if receiptUrl isn't set (entry may have hasReceipt=true)
      if (supabase) {
        const raw = await db.loadSetting(`receipt_img_${entryId}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          // Backfill the receiptUrl so next load is faster — immutable update so
          // React re-renders the "Show Receipt" button and the entry row badge.
          if (entry) {
            const updated = { ...entry, receiptUrl: `__db__${entryId}`, hasReceipt: true };
            const nextEntries = entriesRef.current.map(e => e.id === entryId ? updated : e);
            entriesRef.current = nextEntries;
            setEntries(nextEntries);
            db.saveEntry(updated).catch(() => {});
          }
          return { url: `data:${parsed.mime};base64,${parsed.b64}` };
        }
      }
      // Final fallback: try localStorage
      const res = await window.storage.get(`fuel_receipt_img_${entryId}`);
      if (res?.value) {
        const parsed = JSON.parse(res.value);
        if (parsed.b64) return { url: `data:${parsed.mime};base64,${parsed.b64}` };
        return parsed;
      }
      return null;
    } catch (_) { return null; }
  }, []);

  const deleteReceiptImage = async (entryId) => {
    try {
      if (supabase) {
        // Delete the legacy app_settings row entirely (NOT save-with-null —
        // that would leave a null-valued row taking up disk space). Falls
        // back to nulling for older bucket-less projects that don't have
        // delete privileges.
        await db.deleteSetting(`receipt_img_${entryId}`).catch(() =>
          db.saveSetting(`receipt_img_${entryId}`, null).catch(() => {})
        );
        // Also try Supabase Storage (where new receipts live)
        await supabase.storage.from("receipts").remove([`${entryId}.jpg`, `${entryId}.png`]).catch(() => {});
      }
      // Also clean up localStorage fallback
      await window.storage.delete(`fuel_receipt_img_${entryId}`);
    } catch (_) {}
  };

  // ── Auto-delete receipt photos older than RECEIPT_RETENTION_DAYS ──
  //
  // Storage hygiene pass. Receipt photos are the single largest disk
  // consumer in the project (one ~80–200 KB JPEG per fuel claim). Even
  // with the bucket migration relieving Postgres IO pressure, the bucket
  // itself fills up over time. This pass runs at most once per 24 hours
  // when an admin opens the Data tab, finds claim entries older than
  // 30 days that still carry a photo, and deletes the photo (entry row
  // itself stays — only the image is removed so historical exports and
  // reconciliation history are not affected).
  //
  // Skipped automatically:
  //   • Entries with any unresolved admin flag — the photo is evidence
  //     for the dispute and must outlive the retention window.
  //   • Entries with no date and no parseable timestamp in the id, so we
  //     never delete a photo whose age we can't verify.
  //
  // Cooldown is keyed in localStorage, so it persists across page reloads
  // but is per-browser — running on a second admin's machine the next day
  // is fine and idempotent (nothing left to delete = no-op).
  const RECEIPT_RETENTION_DAYS = 30;
  const autoDeleteOldReceipts = useCallback(async () => {
    if (!supabase) return;
    // Throttle: only one full pass per 24h per browser.
    try {
      const lastRunRaw = localStorage.getItem("fuel_receipt_cleanup_last_run");
      const lastRun = lastRunRaw ? parseInt(lastRunRaw, 10) : 0;
      if (Date.now() - lastRun < 24 * 60 * 60 * 1000) return;
    } catch (_) { /* ignore — proceed */ }

    const now = Date.now();
    const cutoffMs = RECEIPT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const allEntries = entriesRef.current || [];
    const resolved = resolvedFlagsRef.current || {};
    const fid = (f) => `${f.rego}::${f.text}::${f.date || ""}::${f.odo || ""}`;

    const candidates = allEntries.filter(e => {
      if (!e.receiptUrl && !e.hasReceipt) return false;
      // Receipt age — prefer entry.date (the receipt's printed date), fall
      // back to the entry id's embedded epoch (ids are Date.now().toString()
      // at submission time).
      let entryMs = null;
      if (e.date) {
        const d = new Date(e.date);
        if (!isNaN(d.getTime())) entryMs = d.getTime();
      }
      if (entryMs == null) {
        const idMs = parseInt((e.id || "").slice(0, 13), 10);
        if (!isNaN(idMs)) entryMs = idMs;
      }
      if (entryMs == null) return false;
      if (now - entryMs < cutoffMs) return false;
      // Preserve photos on entries with open flags — they're evidence
      const flags = e.flags || [];
      const hasOpen = flags.some(f => !resolved[fid(f)]);
      if (hasOpen) return false;
      return true;
    });

    if (candidates.length === 0) {
      try { localStorage.setItem("fuel_receipt_cleanup_last_run", Date.now().toString()); } catch (_) {}
      return;
    }

    console.log(`[Receipt cleanup] Deleting ${candidates.length} receipt photo(s) older than ${RECEIPT_RETENTION_DAYS} days`);

    let deleted = 0;
    const deletedIds = new Set();
    for (const e of candidates) {
      try {
        // Storage bucket — remove both common extensions (we always upload
        // .jpg now but historical receipts may be .png).
        await supabase.storage.from("receipts").remove([`${e.id}.jpg`, `${e.id}.png`]).catch(() => {});
        // app_settings legacy row — deleting the row (not nulling) so the
        // storage is actually freed. Safe to call even if no row exists.
        await db.deleteSetting(`receipt_img_${e.id}`).catch(() => {});
        // Update the entry record — clears the photo button on the data tab
        // and stops future loadReceiptImage calls from re-fetching a
        // now-missing image.
        const updated = { ...e, receiptUrl: null, hasReceipt: false };
        await db.saveEntry(updated).catch(() => {});
        deletedIds.add(e.id);
        deleted++;
      } catch (err) {
        console.warn("[Receipt cleanup] Failed to delete receipt for entry:", e.id, err);
      }
    }

    if (deleted > 0) {
      // Patch local state so the UI updates without a refetch
      const nextEntries = (entriesRef.current || []).map(e =>
        deletedIds.has(e.id) ? { ...e, receiptUrl: null, hasReceipt: false } : e
      );
      entriesRef.current = nextEntries;
      setEntries(nextEntries);
      try { await window.storage.set("fuel_entries", JSON.stringify(nextEntries)); } catch (_) {}
      showToast(`Cleaned up ${deleted} old receipt photo${deleted === 1 ? "" : "s"} (>${RECEIPT_RETENTION_DAYS} days)`);
    }

    try { localStorage.setItem("fuel_receipt_cleanup_last_run", Date.now().toString()); } catch (_) {}
  }, [showToast]);

  const receiptRef = useRef();
  const scanResultsRef = useRef();
  // scanIdRef guards all RECEIPT scans (initial upload, rotate, re-scan) so a
  // stale async result from a superseded scan can never overwrite the latest
  // one. cardScanIdRef does the same for CARD-only uploads, kept separate so
  // uploading a card mid-receipt-scan doesn't invalidate the in-flight receipt.
  const scanIdRef = useRef(0);
  const cardScanIdRef = useRef(0);
  const cardRef = useRef();

  const showToast = useCallback((msg, type = "success") => setToast({ msg, type }), []);
  // Stable identity so Toast's auto-dismiss effect doesn't reset every parent
  // re-render — passing an inline `() => setToast(null)` made the timer
  // restart continuously and toasts never faded out.
  const dismissToast = useCallback(() => setToast(null), []);

  // ── Storage ───────────────────────────────────────────────────────────────
  // On app load: try to fetch data from Supabase (cloud) first.
  // If Supabase is not configured or fails, fall back to localStorage (device).
  // This means data works offline AND syncs to the cloud when available.
  useEffect(() => {
    (async () => {
      try {
        // First, load local data (fast — already on this device)
        const [eRes, kRes, sRes, lRes, rRes, pRes, trRes] = await Promise.all([
          window.storage.get("fuel_entries").catch(() => null),
          window.storage.get("fuel_api_key").catch(() => null),
          window.storage.get("fuel_service_data").catch(() => null),
          window.storage.get("fuel_learned_db").catch(() => null),
          window.storage.get("fuel_resolved_flags").catch(() => null),
          window.storage.get("fuel_admin_passcode").catch(() => null),
          window.storage.get("fuel_trash_entries").catch(() => null),
        ]);
        let localEntries = eRes?.value ? JSON.parse(eRes.value) : [];
        let localService = sRes?.value ? JSON.parse(sRes.value) : {};
        let localResolved = rRes?.value ? JSON.parse(rRes.value) : {};
        if (kRes?.value) { setApiKey(kRes.value); setApiKeyInput(kRes.value); }
        if (lRes?.value) setLearnedDB(JSON.parse(lRes.value));
        if (pRes?.value) { setAdminPasscode(pRes.value); setPasscodeInput(pRes.value); }
        // Per-task model selection — local cache reads first, cloud
        // refresh below overrides if a more recent value exists.
        try {
          const mRes = await window.storage.get("fuel_api_models");
          if (mRes?.value) {
            const loaded = JSON.parse(mRes.value);
            setApiModels({ ...DEFAULT_API_MODELS, ...loaded });
          }
        } catch (_) {}
        // Per-vehicle-type efficiency thresholds — local cache reads first,
        // cloud refresh below overrides if a more recent value exists.
        // Stored as a partial map (only customised types); merged with
        // DEFAULT_EFFICIENCY_RANGES so newly-added types default sensibly.
        try {
          const tRes = await window.storage.get("fuel_efficiency_thresholds");
          if (tRes?.value) {
            const loaded = JSON.parse(tRes.value);
            if (loaded && typeof loaded === "object") {
              setEfficiencyThresholds({ ...DEFAULT_EFFICIENCY_RANGES, ...loaded });
            }
          }
        } catch (_) {}
        // Driver auto-fill profiles — local cache reads first, cloud refresh
        // below overrides if available.
        try {
          const dpRes = await window.storage.get("fuel_driver_profiles");
          if (dpRes?.value) {
            const loaded = JSON.parse(dpRes.value);
            if (loaded && typeof loaded === "object") setDriverProfiles(loaded);
          }
        } catch (_) {}
        // Admin-curated driver name merges — load local cache first; cloud
        // refresh path syncs from Supabase for cross-device alignment.
        try {
          const aRes = await window.storage.get("fuel_learned_driver_aliases");
          if (aRes?.value) {
            const loaded = JSON.parse(aRes.value);
            if (loaded && typeof loaded === "object") {
              setLearnedDriverAliases(loaded);
              setLearnedDriverAliasesDB(loaded);
            }
          }
        } catch (_) {}
        // Load trash bin (soft-deleted entries) + auto-purge anything older
        // than the retention window so the bin can't grow without bound.
        if (trRes?.value) {
          try {
            const loaded = JSON.parse(trRes.value);
            const now = Date.now();
            const kept = [];
            const expired = [];
            for (const t of loaded) {
              const ts = t?._deletedAt ? new Date(t._deletedAt).getTime() : now;
              if (isNaN(ts) || now - ts > TRASH_RETENTION_MS) expired.push(t);
              else kept.push(t);
            }
            if (expired.length > 0) {
              // Wipe receipt images for entries that have expired out of
              // the bin — they can never be restored, so the image is dead
              // weight in storage.
              for (const e of expired) { try { await deleteReceiptImage(e.id); } catch (_) {} }
              try { await window.storage.set("fuel_trash_entries", JSON.stringify(kept)); } catch (_) {}
              db.saveSetting("trash_entries", JSON.stringify(kept)).catch(() => {});
              console.log(`[Trash] Auto-purged ${expired.length} entr${expired.length === 1 ? "y" : "ies"} past ${TRASH_RETENTION_MS / 86400000}-day retention`);
            }
            setTrashEntries(kept);
          } catch (_) {}
        }
        // Load learned card corrections + reconcile with current static DB
        // (admin edits to DRIVER_CARDS/REGO_DB must override stale learned values)
        try {
          const cmRes = await window.storage.get("fuel_learned_card_mappings");
          if (cmRes?.value) {
            const loaded = JSON.parse(cmRes.value);
            const { reconciled, changed, dropped } = reconcileCardMappingsWithDB(loaded);
            setLearnedCardMappings(reconciled);
            if (changed > 0 || dropped > 0) {
              try { await window.storage.set("fuel_learned_card_mappings", JSON.stringify(reconciled)); } catch (_) {}
              db.saveSetting("learned_card_mappings", JSON.stringify(reconciled)).catch(() => {});
              console.log(`[Card Learning] Local load: reconciled ${changed}, dropped ${dropped} stale mapping(s) against static DB`);
            }
          }
        } catch (_) {}
        // Load learned corrections (self-learning system)
        try {
          const lcRes = await window.storage.get("fuel_learned_corrections");
          if (lcRes?.value) setLearnedCorrections(JSON.parse(lcRes.value));
        } catch (_) {}

        // Then, try to load from Supabase (cloud — shared across all devices)
        if (supabase) {
          const [cloudEntries, cloudService, cloudResolved, cloudApiKey] = await Promise.all([
            db.loadEntries().catch(() => null),
            db.loadServiceData().catch(() => null),
            db.loadResolvedFlags().catch(() => null),
            db.loadSetting("anthropic_api_key").catch(() => null),
          ]);
          // Use cloud data if available, otherwise use local data
          if (cloudEntries) localEntries = cloudEntries;
          if (cloudService) localService = cloudService;
          if (cloudResolved) localResolved = cloudResolved;
          // Use shared API key from cloud if available (overrides local)
          if (cloudApiKey) { setApiKey(cloudApiKey); setApiKeyInput(cloudApiKey); }
          // Per-task model selection from cloud (overrides local)
          db.loadSetting("api_models").then(raw => {
            if (!raw) return;
            try {
              setApiModels({ ...DEFAULT_API_MODELS, ...JSON.parse(raw) });
              window.storage.set("fuel_api_models", raw).catch(() => {});
            } catch (_) {}
          }).catch(() => {});
          // Efficiency thresholds from cloud (overrides local)
          db.loadSetting("efficiency_thresholds").then(raw => {
            if (!raw) return;
            try {
              const loaded = JSON.parse(raw);
              if (loaded && typeof loaded === "object") {
                setEfficiencyThresholds({ ...DEFAULT_EFFICIENCY_RANGES, ...loaded });
                window.storage.set("fuel_efficiency_thresholds", raw).catch(() => {});
              }
            } catch (_) {}
          }).catch(() => {});
          // Driver auto-fill profiles from cloud (overrides local) — admin
          // can manage these from any device, all field phones pick them up.
          db.loadSetting("driver_profiles").then(raw => {
            if (!raw) return;
            try {
              const loaded = JSON.parse(raw);
              if (loaded && typeof loaded === "object") {
                setDriverProfiles(loaded);
                window.storage.set("fuel_driver_profiles", raw).catch(() => {});
              }
            } catch (_) {}
          }).catch(() => {});
          // Admin-curated driver name merges from cloud — overrides local.
          db.loadSetting("learned_driver_aliases").then(raw => {
            if (!raw) return;
            try {
              const loaded = JSON.parse(raw);
              if (loaded && typeof loaded === "object") {
                setLearnedDriverAliases(loaded);
                setLearnedDriverAliasesDB(loaded);
                window.storage.set("fuel_learned_driver_aliases", raw).catch(() => {});
              }
            } catch (_) {}
          }).catch(() => {});
          // Load fleet card transactions
          db.loadFleetCardTransactions().then(txns => { if (txns?.length) setFleetCardTxns(txns); }).catch(() => {});
          // Load learned card corrections from cloud + reconcile with static DB
          db.loadSetting("learned_card_mappings").then(raw => {
            if (raw) {
              try {
                const loaded = JSON.parse(raw);
                const { reconciled, changed, dropped } = reconcileCardMappingsWithDB(loaded);
                setLearnedCardMappings(reconciled);
                if (changed > 0 || dropped > 0) {
                  window.storage.set("fuel_learned_card_mappings", JSON.stringify(reconciled)).catch(() => {});
                  db.saveSetting("learned_card_mappings", JSON.stringify(reconciled)).catch(() => {});
                  console.log(`[Card Learning] Cloud load: reconciled ${changed}, dropped ${dropped} stale mapping(s) against static DB`);
                }
              } catch (_) {}
            }
          }).catch(() => {});
          // Load learned corrections (self-learning system) from cloud
          db.loadSetting("learned_corrections").then(raw => {
            if (raw) { try { setLearnedCorrections(JSON.parse(raw)); } catch (_) {} }
          }).catch(() => {});
          // Load soft-delete bin from cloud. Kept separate from entries so
          // if another device already deleted something, this device sees
          // it in the bin and can restore it (or purge it forever).
          db.loadSetting("trash_entries").then(raw => {
            if (!raw) return;
            try {
              const loaded = JSON.parse(raw);
              const now = Date.now();
              const kept = loaded.filter(t => {
                const ts = t?._deletedAt ? new Date(t._deletedAt).getTime() : now;
                return !isNaN(ts) && now - ts <= TRASH_RETENTION_MS;
              });
              setTrashEntries(kept);
              trashEntriesRef.current = kept;
              try { window.storage.set("fuel_trash_entries", JSON.stringify(kept)); } catch (_) {}
            } catch (_) {}
          }).catch(() => {});
          // Load learned DB (per-rego vehicle metadata) from cloud. Without this,
          // "Edit Vehicle" and similar admin edits stayed stuck on one device.
          db.loadSetting("learned_db").then(raw => {
            if (raw) {
              try {
                const parsed = JSON.parse(raw);
                setLearnedDB(parsed);
                learnedDBRef.current = parsed;
                try { window.storage.set("fuel_learned_db", JSON.stringify(parsed)); } catch (_) {}
              } catch (_) {}
            }
          }).catch(() => {});
        }

        // ── One-time name corrections migration (v1) ──
        const NAME_MIGRATION_KEY = "fuel_name_migration_v3";
        let migrationDone = false;
        try { migrationDone = !!(await window.storage.get(NAME_MIGRATION_KEY))?.value; } catch (_) {}
        if (!migrationDone) {
          // Title-case helper: "KYLE OSBORNE" → "Kyle Osborne"
          const titleCase = (s) => s ? s.replace(/\b\w+/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase()) : s;
          const isAllCaps = (s) => s && s.length > 2 && s === s.toUpperCase() && /[A-Z]/.test(s);
          // Merge map: old name → new canonical name
          const mergeMap = {
            "nicholas jones": "Nick Jones", "Nicholas Jones": "Nick Jones",
            "natalie hughes": "Jason Hughes", "Natalie Hughes": "Jason Hughes",
            "samuel thomas": "Sam Thomas", "Samuel Thomas": "Sam Thomas",
          };
          const removeNames = new Set(["Martin Howard", "martin howard"]);

          // Fix entries
          let entriesChanged = false;
          const removedEntries = [];
          localEntries = localEntries.filter(e => {
            const dn = (e.driverName || "").trim();
            if (removeNames.has(dn) || removeNames.has(dn.toLowerCase())) { entriesChanged = true; removedEntries.push(e); return false; }
            return true;
          }).map(e => {
            let dn = (e.driverName || "").trim();
            if (!dn) return e;
            // Merge names
            if (mergeMap[dn]) { entriesChanged = true; return { ...e, driverName: mergeMap[dn] }; }
            const lk = dn.toLowerCase();
            for (const [k, v] of Object.entries(mergeMap)) { if (k.toLowerCase() === lk) { entriesChanged = true; return { ...e, driverName: v }; } }
            // Fix ALL-CAPS
            if (isAllCaps(dn)) { entriesChanged = true; return { ...e, driverName: titleCase(dn) }; }
            return e;
          });

          // Fix learnedDB
          let parsedLearned = lRes?.value ? JSON.parse(lRes.value) : {};
          let learnedChanged = false;
          for (const [rego, data] of Object.entries(parsedLearned)) {
            if (!data.dr) continue;
            const dr = data.dr.trim();
            if (removeNames.has(dr) || removeNames.has(dr.toLowerCase())) {
              parsedLearned[rego] = { ...data, dr: "" };
              learnedChanged = true;
            } else if (mergeMap[dr] || Object.entries(mergeMap).find(([k]) => k.toLowerCase() === dr.toLowerCase())) {
              parsedLearned[rego] = { ...data, dr: mergeMap[dr] || Object.entries(mergeMap).find(([k]) => k.toLowerCase() === dr.toLowerCase())[1] };
              learnedChanged = true;
            } else if (isAllCaps(dr)) {
              parsedLearned[rego] = { ...data, dr: titleCase(dr) };
              learnedChanged = true;
            }
          }

          if (entriesChanged) {
            try { await window.storage.set("fuel_entries", JSON.stringify(localEntries)); } catch (_) {}
            // Sync changed entries to Supabase + delete removed ones (await deletes to ensure they complete before next load)
            if (supabase) {
              await Promise.all([
                ...localEntries.map(e => db.saveEntry(e).catch(() => {})),
                ...removedEntries.filter(e => e.id).map(e => db.deleteEntry(e.id).catch(() => {})),
              ]);
            }
          }
          if (learnedChanged) {
            try { await window.storage.set("fuel_learned_db", JSON.stringify(parsedLearned)); } catch (_) {}
            setLearnedDB(parsedLearned);
          }
          try { await window.storage.set(NAME_MIGRATION_KEY, "done"); } catch (_) {}
          console.log(`[Migration] Name corrections applied — entries: ${entriesChanged}, learned: ${learnedChanged}`);
        }

        // ── One-time Carlos Carillo card/rego fixup (v1) ──
        // Carlos's fleet card is embossed WIA53F but his actual vehicle is EIA53F.
        // Existing entries may have registration=WIA53F; rewrite to EIA53F while keeping cardRego=WIA53F.
        const CARLOS_MIGRATION_KEY = "fuel_carlos_rego_migration_v1";
        let carlosMigrationDone = false;
        try { carlosMigrationDone = !!(await window.storage.get(CARLOS_MIGRATION_KEY))?.value; } catch (_) {}
        if (!carlosMigrationDone) {
          let carlosEntriesChanged = false;
          const changedCarlosEntries = [];
          localEntries = localEntries.map(e => {
            const rego = (e.registration || "").toUpperCase().replace(/\s+/g, "");
            const dn = (e.driverName || "").trim().toLowerCase();
            const isCarlos = dn === "carlos carillo";
            // If the entry registration is WIA53F (the card rego), rewrite to EIA53F (actual vehicle)
            if (rego === "WIA53F" || (isCarlos && rego === "WIA53F")) {
              carlosEntriesChanged = true;
              const updated = {
                ...e,
                registration: "EIA53F",
                cardRego: e.cardRego || "WIA53F",
                fleetCardVehicle: e.fleetCardVehicle || "WIA53F",
              };
              changedCarlosEntries.push(updated);
              return updated;
            }
            return e;
          });

          // Fix learnedDB: if WIA53F is in there as a vehicle, move it to EIA53F
          let parsedLearnedCarlos = lRes?.value ? JSON.parse(lRes.value) : {};
          let carlosLearnedChanged = false;
          if (parsedLearnedCarlos["WIA53F"]) {
            const wiaData = parsedLearnedCarlos["WIA53F"];
            const { ["WIA53F"]: _removed, ...restLearned } = parsedLearnedCarlos;
            parsedLearnedCarlos = {
              ...restLearned,
              ["EIA53F"]: { ...(restLearned["EIA53F"] || {}), ...wiaData },
            };
            carlosLearnedChanged = true;
          }

          if (carlosEntriesChanged) {
            try { await window.storage.set("fuel_entries", JSON.stringify(localEntries)); } catch (_) {}
            if (supabase) {
              await Promise.all(changedCarlosEntries.map(e => db.saveEntry(e).catch(() => {})));
            }
          }
          if (carlosLearnedChanged) {
            try { await window.storage.set("fuel_learned_db", JSON.stringify(parsedLearnedCarlos)); } catch (_) {}
            setLearnedDB(parsedLearnedCarlos);
          }
          try { await window.storage.set(CARLOS_MIGRATION_KEY, "done"); } catch (_) {}
          console.log(`[Migration] Carlos rego fixup — entries: ${carlosEntriesChanged} (${changedCarlosEntries.length}), learnedDB: ${carlosLearnedChanged}`);
        }

        // ── One-time card ↔ rego backfill (v1) ──
        // Older entries were persisted with just a card number or just a
        // card rego (whichever the AI could read off the receipt). That
        // made reconciliation finicky because the FleetCard CSV can use
        // either side as its identifier. Run autofillCardFields once
        // across all entries to fill every resolvable blank, then push
        // the changed rows back to Supabase. Idempotent — re-running it
        // after the key is cleared is safe.
        const CARD_AUTOFILL_KEY = "fuel_card_autofill_migration_v1";
        let cardAutofillDone = false;
        try { cardAutofillDone = !!(await window.storage.get(CARD_AUTOFILL_KEY))?.value; } catch (_) {}
        if (!cardAutofillDone) {
          const changedAutofillEntries = [];
          localEntries = localEntries.map(e => {
            const filled = autofillCardFields(e);
            if (filled !== e) changedAutofillEntries.push(filled);
            return filled;
          });
          if (changedAutofillEntries.length > 0) {
            try { await window.storage.set("fuel_entries", JSON.stringify(localEntries)); } catch (_) {}
            if (supabase) {
              await Promise.all(changedAutofillEntries.map(e => db.saveEntry(e).catch(() => {})));
            }
          }
          try { await window.storage.set(CARD_AUTOFILL_KEY, "done"); } catch (_) {}
          console.log(`[Migration] Card autofill — backfilled ${changedAutofillEntries.length} entr${changedAutofillEntries.length === 1 ? "y" : "ies"}`);
        }

        // ── One-time Opus 4.7 default reset (v1) ──
        // Pricing for Opus 4.7 (\$5/\$25 per Mtok) collapsed the old
        // "use cheap models for cost" trade-off, so it's now the
        // recommended default for all three scan tasks. Devices that
        // already saved a prior selection (Haiku/Sonnet/Sonnet from the
        // earlier rollout) need a one-shot reset to pick up the new
        // defaults — this writes Opus 4.7 across the board to both
        // localStorage and Supabase, then marks the migration done.
        // Future admin changes via Settings still persist normally.
        const OPUS47_DEFAULT_KEY = "fuel_api_models_opus47_default_v1";
        let opus47Done = false;
        try { opus47Done = !!(await window.storage.get(OPUS47_DEFAULT_KEY))?.value; } catch (_) {}
        if (!opus47Done) {
          const json = JSON.stringify(DEFAULT_API_MODELS);
          setApiModels(DEFAULT_API_MODELS);
          try { await window.storage.set("fuel_api_models", json); } catch (_) {}
          if (supabase) {
            try { await db.saveSetting("api_models", json); } catch (_) {}
          }
          try { await window.storage.set(OPUS47_DEFAULT_KEY, "done"); } catch (_) {}
          console.log("[Migration] API model defaults reset to Opus 4.7 across all tasks");
        }

        setEntries(localEntries);
        setServiceData(localService);
        setResolvedFlags(localResolved);
        // Load saved driver profile
        try {
          const dRes = await window.storage.get("fuel_saved_driver");
          if (dRes?.value) {
            const dp = JSON.parse(dRes.value);
            setSavedDriver(dp);
            // Pre-fill form
            if (dp.name || dp.rego) {
              setForm(f => {
                const updated = { ...f };
                if (dp.firstName) { updated.driverFirstName = dp.firstName; updated.driverLastName = dp.lastName || ""; }
                else if (dp.name) { const parts = dp.name.split(" "); updated.driverFirstName = parts[0] || ""; updated.driverLastName = parts.slice(1).join(" ") || ""; }
                if (dp.rego) {
                  updated.registration = dp.rego.toUpperCase();
                  const match = lookupRego(dp.rego, lRes?.value ? JSON.parse(lRes.value) : {}, eRes?.value ? JSON.parse(eRes.value) : []);
                  if (match) {
                    updated.division = match.d;
                    updated.vehicleType = match.t;
                    updated._regoMatch = match;
                  }
                }
                return updated;
              });
            }
          }
        } catch (_) {}
      } catch (_) {}
      // Record first successful sync (so the admin "last synced" indicator is meaningful)
      if (supabase) setLastSyncedAt(new Date());
      setStorageReady(true);
    })();
  }, []);

  // persist saves fuel entries to BOTH localStorage (fast) and Supabase (cloud).
  // This way the app feels instant but data is also backed up and shared.
  // Every entry passes through autofillCardFields here, so whenever we know
  // either the card number OR the card rego we also record the matching
  // counterpart from the DB. Fleet card receipts tend to show only one of
  // the two, so without this step ~half of entries land in storage with a
  // blank cardRego or blank fleetCardNumber and reconciliation can't line
  // them up with the bank's CSV.
  const persist = async (newEntries, changedEntry = null) => {
    const autofilled = newEntries.map(autofillCardFields);
    const normChanged = changedEntry ? autofillCardFields(changedEntry) : null;
    entriesRef.current = autofilled;
    setEntries(autofilled);
    try { await window.storage.set("fuel_entries", JSON.stringify(autofilled)); } catch (_) {}
    // Sync to cloud: save only the changed entry (faster than saving everything).
    // Mark the entry's id as pending so a refresh that fires before the cloud
    // save lands won't replace our just-saved value with the stale cloud copy.
    if (normChanged) {
      pendingEntrySavesRef.current.add(normChanged.id);
      db.saveEntry(normChanged)
        .catch(() => {})
        .finally(() => { pendingEntrySavesRef.current.delete(normChanged.id); });
    }
  };

  // persistTrash saves the soft-delete bin to both localStorage (instant
  // restore even offline) and Supabase app_settings (so restore works from
  // another device if someone deletes from the wrong machine).
  const persistTrash = async (newTrash) => {
    trashEntriesRef.current = newTrash;
    setTrashEntries(newTrash);
    try { await window.storage.set("fuel_trash_entries", JSON.stringify(newTrash)); } catch (_) {}
    db.saveSetting("trash_entries", JSON.stringify(newTrash)).catch(() => {});
  };

  // persistService saves vehicle service data to both local and cloud
  const persistService = async (newData, changedRego = null) => {
    setServiceData(newData);
    try { await window.storage.set("fuel_service_data", JSON.stringify(newData)); } catch (_) {}
    if (changedRego && newData[changedRego]) {
      db.saveServiceData(changedRego, newData[changedRego]).catch(() => {});
    }
  };

  const handleServiceSave = (rego, data) => {
    const updated = { ...serviceData, [rego]: data };
    persistService(updated, rego);
  };

  // Keep learnedDB bounded so it can't grow past the 1MB app_settings.value
  // soft-cap or eat disproportionate localStorage quota. Fleet size is well
  // under 500 in practice — this cap only bites if stray/phantom regos leak
  // in from AI misreads. Eviction prefers entries whose data is thinnest
  // (only a `dr` field, no type/division/name) and that haven't been
  // updated recently.
  const LEARNED_DB_CAP = 500;
  const trimLearnedDB = (db) => {
    if (!db || typeof db !== "object") return db;
    const keys = Object.keys(db);
    if (keys.length <= LEARNED_DB_CAP) return db;
    const richness = (v) => (v?.t ? 2 : 0) + (v?.d ? 2 : 0) + (v?.n ? 1 : 0) + (v?.dr ? 1 : 0) + (v?.c ? 2 : 0);
    const sortedKeys = keys.sort((a, b) => {
      const rA = richness(db[a]);
      const rB = richness(db[b]);
      if (rA !== rB) return rA - rB; // thinner entries evicted first
      return a.localeCompare(b); // stable tiebreaker
    });
    const toEvict = sortedKeys.slice(0, keys.length - LEARNED_DB_CAP);
    const trimmed = { ...db };
    toEvict.forEach(k => delete trimmed[k]);
    console.log(`[Learned DB] Trimmed ${toEvict.length} entries to stay under ${LEARNED_DB_CAP} cap`);
    return trimmed;
  };
  const persistLearned = async (newData) => {
    const trimmed = trimLearnedDB(newData);
    learnedDBRef.current = trimmed; // sync ref immediately so subsequent calls see latest
    try { await window.storage.set("fuel_learned_db", JSON.stringify(trimmed)); setLearnedDB(trimmed); }
    catch (_) { setLearnedDB(trimmed); }
    // Also sync to cloud so edits on one device reach the others (without this,
    // "Edit Vehicle" and other learnedDB changes stayed stuck on one computer).
    db.saveSetting("learned_db", JSON.stringify(trimmed)).catch(() => {});
  };

  // persistResolved saves flag resolutions to both local and cloud
  const persistResolved = async (newData, changedFlagId = null, deleted = false) => {
    setResolvedFlags(newData);
    resolvedFlagsRef.current = newData;
    try { await window.storage.set("fuel_resolved_flags", JSON.stringify(newData)); } catch (_) {}
    if (changedFlagId) {
      const clearPending = () => { pendingFlagSavesRef.current.delete(changedFlagId); };
      if (deleted) {
        db.deleteResolvedFlag(changedFlagId).catch(() => {}).finally(clearPending);
      } else if (newData[changedFlagId]) {
        db.saveResolvedFlag(changedFlagId, newData[changedFlagId]).catch(() => {}).finally(clearPending);
      } else {
        clearPending();
      }
    }
  };

  // ── Cross-device refresh ───────────────────────────────────────────────────
  // Pulls the latest shared data from Supabase and updates local state +
  // localStorage cache. Called on mount, when the tab regains visibility /
  // focus, on a periodic interval while visible, and whenever Supabase
  // Realtime pushes a change. Debounced so rapid-fire triggers don't thrash.
  const refreshFromCloud = useCallback(async ({ silent = true, force = false } = {}) => {
    if (!supabase) return;
    // Never overwrite local entries while an edit modal is open — the user's
    // unsaved form would silently get clobbered by a cloud push. Skipped
    // refreshes resume as soon as the modal closes (a state change triggers
    // the auto-refresh effect to re-evaluate).
    if (!force && editingInProgressRef.current) {
      console.log("[Sync] Skipping refresh — edit modal open");
      return;
    }
    const now = Date.now();
    // Debounce: skip if we just refreshed <8s ago, unless force=true.
    // Raised from 2s to 8s as part of the Disk IO budget rescue — a burst
    // of Realtime pushes (e.g. an admin batch-resolving 20 flags) used to
    // trigger 20 back-to-back refreshes; now they coalesce into one or
    // two. Manual user-initiated refreshes still bypass via force=true.
    if (!force && now - lastRefreshAttemptRef.current < 8000) return;
    lastRefreshAttemptRef.current = now;
    setIsSyncing(true);
    try {
      const [cloudEntries, cloudService, cloudResolved, cloudApiKey, cloudApiModels] = await Promise.all([
        db.loadEntries().catch(() => null),
        db.loadServiceData().catch(() => null),
        db.loadResolvedFlags().catch(() => null),
        db.loadSetting("anthropic_api_key").catch(() => null),
        db.loadSetting("api_models").catch(() => null),
      ]);
      if (cloudEntries) {
        // Run cloud entries through autofillCardFields so freshly pulled
        // rows from other devices or older sessions show a populated
        // cardRego / fleetCardNumber immediately. Any newly filled row
        // also gets pushed back to Supabase so the next device downloads
        // the completed record instead of re-filling it.
        //
        // For any entry whose save is currently in flight, prefer the
        // local copy — the cloud's response is from BEFORE our save and
        // would clobber the just-saved value. Once the save settles the
        // pending marker clears and the next refresh picks up the cloud
        // copy normally.
        const pendingIds = pendingEntrySavesRef.current;
        const localById = new Map((entriesRef.current || []).map(e => [e.id, e]));
        const filled = [];
        const changed = [];
        for (const e of cloudEntries) {
          if (pendingIds.has(e.id) && localById.has(e.id)) {
            filled.push(localById.get(e.id));
            continue;
          }
          const f = autofillCardFields(e);
          filled.push(f);
          if (f !== e) changed.push(f);
        }
        // Locally-created entries whose save hasn't reached the cloud yet
        // (e.g. just-submitted on this device) won't appear in cloudEntries —
        // re-include them so they don't vanish from the UI.
        const cloudIds = new Set(cloudEntries.map(e => e.id));
        for (const id of pendingIds) {
          if (!cloudIds.has(id) && localById.has(id)) filled.push(localById.get(id));
        }
        setEntries(filled);
        entriesRef.current = filled;
        try { await window.storage.set("fuel_entries", JSON.stringify(filled)); } catch (_) {}
        if (changed.length > 0) {
          Promise.all(changed.map(e => db.saveEntry(e).catch(() => {})))
            .then(() => console.log(`[Autofill] Normalized ${changed.length} cloud entries on refresh`));
        }
      }
      if (cloudService) {
        setServiceData(cloudService);
        try { await window.storage.set("fuel_service_data", JSON.stringify(cloudService)); } catch (_) {}
      }
      if (cloudResolved) {
        // Same race-protection as entries: if a flag's save is still in
        // flight, prefer the local resolution state for that fid (the
        // cloud's response was generated before our write). For an
        // unresolve in flight that means keeping it absent locally; for
        // a resolve in flight, keeping it set locally.
        const pendingFids = pendingFlagSavesRef.current;
        const localResolved = resolvedFlagsRef.current || {};
        let merged;
        if (pendingFids.size === 0) {
          merged = cloudResolved;
        } else {
          merged = { ...cloudResolved };
          for (const fid of pendingFids) {
            if (localResolved[fid]) merged[fid] = localResolved[fid];
            else delete merged[fid];
          }
        }
        setResolvedFlags(merged);
        resolvedFlagsRef.current = merged;
        try { await window.storage.set("fuel_resolved_flags", JSON.stringify(merged)); } catch (_) {}
      }
      if (cloudApiKey) {
        setApiKey(cloudApiKey);
        setApiKeyInput(cloudApiKey);
      }
      if (cloudApiModels) {
        try {
          const parsed = JSON.parse(cloudApiModels);
          setApiModels({ ...DEFAULT_API_MODELS, ...parsed });
          try { window.storage.set("fuel_api_models", cloudApiModels); } catch (_) {}
        } catch (_) {}
      }
      // Pull admin-curated driver-name merges so cross-device alignment
      // happens automatically (admin merges on desktop -> drivers' phones
      // pick up the alias on next refresh).
      db.loadSetting("learned_driver_aliases").then(raw => {
        if (!raw) return;
        try {
          const loaded = JSON.parse(raw);
          if (loaded && typeof loaded === "object") {
            setLearnedDriverAliases(loaded);
            setLearnedDriverAliasesDB(loaded);
            window.storage.set("fuel_learned_driver_aliases", raw).catch(() => {});
          }
        } catch (_) {}
      }).catch(() => {});
      // Fire-and-forget the settings-backed collections
      db.loadFleetCardTransactions().then(txns => { if (txns) setFleetCardTxns(txns); }).catch(() => {});
      db.loadSetting("learned_card_mappings").then(raw => {
        if (!raw) return;
        try {
          const loaded = JSON.parse(raw);
          const { reconciled, changed, dropped } = reconcileCardMappingsWithDB(loaded);
          setLearnedCardMappings(reconciled);
          learnedCardMappingsRef.current = reconciled;
          try { window.storage.set("fuel_learned_card_mappings", JSON.stringify(reconciled)); } catch (_) {}
          if (changed > 0 || dropped > 0) db.saveSetting("learned_card_mappings", JSON.stringify(reconciled)).catch(() => {});
        } catch (_) {}
      }).catch(() => {});
      db.loadSetting("learned_corrections").then(raw => {
        if (!raw) return;
        try {
          const lc = JSON.parse(raw);
          setLearnedCorrections(lc);
          learnedCorrectionsRef.current = lc;
          try { window.storage.set("fuel_learned_corrections", JSON.stringify(lc)); } catch (_) {}
        } catch (_) {}
      }).catch(() => {});
      db.loadSetting("learned_db").then(raw => {
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw);
          setLearnedDB(parsed);
          learnedDBRef.current = parsed;
          try { window.storage.set("fuel_learned_db", JSON.stringify(parsed)); } catch (_) {}
        } catch (_) {}
      }).catch(() => {});
      setLastSyncedAt(new Date());
      if (!silent) showToast("Synced from cloud");
    } catch (err) {
      console.error("[Sync] refreshFromCloud failed:", err);
      if (!silent) showToast("Sync failed — check connection", "error");
    } finally {
      setIsSyncing(false);
    }
  }, [showToast]);

  // ── Automatic cross-device sync triggers ───────────────────────────────────
  // Runs AFTER the initial mount load has set up state. Ensures admin edits
  // from one computer reach others without spending the project's Disk IO
  // budget on redundant refreshes:
  //   1) Tab becomes visible again → refresh
  //   2) Window regains focus → refresh
  //   3) Supabase Realtime push on fuel_entries / service_data /
  //      resolved_flags → refresh (debounced 8s in refreshFromCloud)
  //   4) Periodic 5-minute interval while tab is visible → safety net
  //
  // Two deliberate Disk IO economies vs. the original wiring:
  //
  // (a) NO Realtime subscription on app_settings. Receipt photos used to be
  //     written into app_settings as base64 blobs; every save fired a
  //     postgres_changes broadcast that fanned out to every admin tab and
  //     triggered a full refreshFromCloud (which itself runs ~10 SELECTs).
  //     New receipts now live in the storage bucket, so app_settings only
  //     changes when an admin edits API keys / learned mappings — those
  //     pick up on the next focus/visibility refresh, which is fine.
  //
  // (b) Polling cadence relaxed from 60s → 5 minutes. Realtime catches all
  //     entry/service/flag changes near-instantly; the interval only
  //     matters as a fallback when a Realtime message is dropped. At 60s
  //     a tab open all day was firing ~1440 refreshFromCloud calls,
  //     each ≈10 SELECTs = 14,400 reads/day per open tab. At 5 minutes
  //     that drops to ~2,880 reads/day per tab — an ~80% reduction.
  useEffect(() => {
    if (!supabase || !storageReady) return;

    const handleVisibility = () => {
      if (document.visibilityState === "visible") refreshFromCloud({ silent: true });
    };
    const handleFocus = () => refreshFromCloud({ silent: true });

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);

    // Periodic poll (5 min) — only when the tab is visible. Mostly redundant
    // with Realtime; kept as a safety net for dropped Realtime messages.
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") refreshFromCloud({ silent: true });
    }, 5 * 60_000);

    // Realtime subscriptions — push-based near-instant updates. If Realtime
    // isn't enabled on a table in the Supabase dashboard, the subscribe will
    // simply no-op and we fall back to the focus/interval triggers above.
    //
    // app_settings is intentionally NOT subscribed (see (a) above).
    const channels = [];
    try {
      const triggerRefresh = () => refreshFromCloud({ silent: true });
      const mkChannel = (name, table) =>
        supabase
          .channel(`sync-${name}`)
          .on("postgres_changes", { event: "*", schema: "public", table }, triggerRefresh)
          .subscribe();
      channels.push(mkChannel("entries", "fuel_entries"));
      channels.push(mkChannel("service", "service_data"));
      channels.push(mkChannel("flags", "resolved_flags"));
    } catch (err) {
      console.warn("[Sync] Realtime subscribe failed — relying on focus/interval:", err);
    }

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
      clearInterval(interval);
      channels.forEach(ch => { try { supabase.removeChannel(ch); } catch (_) {} });
    };
  }, [storageReady, refreshFromCloud]);

  // Receipt-photo retention pass — runs at most once per 24h whenever an
  // admin opens the Data tab. Deferred a couple of seconds so initial render
  // and any in-flight refreshFromCloud finish first (avoids racing the
  // entries list while we're filtering it). See autoDeleteOldReceipts for
  // the retention rules + skip conditions.
  useEffect(() => {
    if (view !== "data" || !storageReady) return;
    const t = setTimeout(() => { autoDeleteOldReceipts().catch(() => {}); }, 2000);
    return () => clearTimeout(t);
  }, [view, storageReady, autoDeleteOldReceipts]);

  // Keep editingInProgressRef in sync with modal-open states. refreshFromCloud
  // reads this ref and skips while the admin has unsaved form state. When the
  // modal closes, we nudge a refresh so the user picks up any cloud changes
  // that accumulated during the edit session.
  useEffect(() => {
    const wasEditing = editingInProgressRef.current;
    const isEditing = !!(editingEntry || editingVehicle || manualEntry);
    editingInProgressRef.current = isEditing;
    if (wasEditing && !isEditing && supabase && storageReady) {
      // Just closed the last edit modal — catch up on any deferred refreshes.
      refreshFromCloud({ silent: true, force: true });
    }
  }, [editingEntry, editingVehicle, manualEntry, storageReady, refreshFromCloud]);

  // Generate a stable unique ID for a flag
  const flagId = (f) => `${f.rego}::${f.text}::${f.date || ""}::${f.odo || ""}`;

  const resolveFlag = (fid, note, by) => {
    const flagData = { by: by || "Admin", note: note || "", at: new Date().toISOString() };
    const updated = { ...resolvedFlagsRef.current, [fid]: flagData };
    pendingFlagSavesRef.current.add(fid);
    persistResolved(updated, fid);
  };

  const unresolveFlag = (fid) => {
    const { [fid]: _, ...rest } = resolvedFlagsRef.current;
    pendingFlagSavesRef.current.add(fid);
    persistResolved(rest, fid, true);
  };

  // Bulk resolve — single local/state write, parallel cloud writes.
  // Much faster than looping resolveFlag() which would serialise N network calls.
  const resolveFlagsBulk = async (fids, note, by) => {
    if (!fids || fids.length === 0) return;
    const at = new Date().toISOString();
    const flagData = { by: by || "Admin", note: note || "Bulk resolved", at };
    const updated = { ...resolvedFlagsRef.current };
    for (const fid of fids) updated[fid] = flagData;
    setResolvedFlags(updated);
    resolvedFlagsRef.current = updated;
    try { await window.storage.set("fuel_resolved_flags", JSON.stringify(updated)); } catch (_) {}
    // Mark each fid as pending so refreshFromCloud doesn't blow our local
    // resolution away if it fires before the cloud save lands.
    for (const fid of fids) pendingFlagSavesRef.current.add(fid);
    // Fire all cloud writes in parallel — failures don't block the UI.
    await Promise.all(fids.map(fid =>
      db.saveResolvedFlag(fid, flagData)
        .catch(() => {})
        .finally(() => { pendingFlagSavesRef.current.delete(fid); })
    ));
    showToast(`Resolved ${fids.length} issue${fids.length === 1 ? "" : "s"}`);
  };

  // Persist learned card mappings to local + cloud storage.
  // Always reconcile against the current static DB on write so admin edits
  // (via Cards tab × / Clear All, or any future admin card-editing UI)
  // immediately flow through to the correct card numbers.
  const persistCardMappings = async (newMappings) => {
    const { reconciled } = reconcileCardMappingsWithDB(newMappings || {});
    learnedCardMappingsRef.current = reconciled;
    setLearnedCardMappings(reconciled);
    try { await window.storage.set("fuel_learned_card_mappings", JSON.stringify(reconciled)); } catch (_) {}
    db.saveSetting("learned_card_mappings", JSON.stringify(reconciled)).catch(() => {});
  };

  // ── Self-learning correction system ────────────────────────────────────────
  // Trim learned corrections to stay within storage caps
  const trimLearnedCorrections = (data) => {
    // Stations: max 200 entries, LRU by lastSeen
    if (data.stations && Object.keys(data.stations).length > 200) {
      const sorted = Object.entries(data.stations).sort((a, b) => (a[1].lastSeen || "").localeCompare(b[1].lastSeen || ""));
      const trimmed = Object.fromEntries(sorted.slice(-200));
      data.stations = trimmed;
    }
    // Station prices: max 100 stations, 5 prices each
    if (data.stationPrices) {
      const keys = Object.keys(data.stationPrices);
      if (keys.length > 100) {
        const sorted = keys.sort((a, b) => {
          const ap = data.stationPrices[a], bp = data.stationPrices[b];
          return (ap.lastSeen || "").localeCompare(bp.lastSeen || "");
        });
        sorted.slice(0, sorted.length - 100).forEach(k => delete data.stationPrices[k]);
      }
      Object.values(data.stationPrices).forEach(sp => {
        if (sp.lastPrices && sp.lastPrices.length > 5) sp.lastPrices = sp.lastPrices.slice(-5);
        if (sp.fuelTypes && sp.fuelTypes.length > 10) sp.fuelTypes = sp.fuelTypes.slice(-10);
      });
    }
    // Digit patterns: max 50, keep highest count
    if (data.digitPatterns && data.digitPatterns.length > 50) {
      data.digitPatterns.sort((a, b) => b.count - a.count);
      data.digitPatterns = data.digitPatterns.slice(0, 50);
    }
    // Fuel type corrections: max 100 stations
    if (data.fuelTypeCorrections && Object.keys(data.fuelTypeCorrections).length > 100) {
      const keys = Object.keys(data.fuelTypeCorrections);
      keys.slice(0, keys.length - 100).forEach(k => delete data.fuelTypeCorrections[k]);
    }
    return data;
  };

  // Persist learned corrections to local + cloud storage
  const persistCorrections = async (newData) => {
    const trimmed = trimLearnedCorrections(newData);
    learnedCorrectionsRef.current = trimmed;
    setLearnedCorrections(trimmed);
    try { await window.storage.set("fuel_learned_corrections", JSON.stringify(trimmed)); } catch (_) {}
    db.saveSetting("learned_corrections", JSON.stringify(trimmed)).catch(() => {});
  };

  // Analyze digit differences between AI-read and user-corrected numeric values.
  // Uses Levenshtein DP with traceback so length-mismatched corrections still
  // surface learning signal — previously the function bailed on any length
  // mismatch, which threw away the most valuable patterns (missing/extra
  // digits, e.g. AI "2.82" vs receipt "2.829").
  //
  // Returned op shapes:
  //   { from: "X", to: "Y", field }   — substitution (classic misread)
  //   { from: "X", to: "",  field }   — AI added a digit that isn't there
  //   { from: "",  to: "Y", field }   — AI missed a digit
  const analyzeDigitDiff = (aiValue, userValue, field) => {
    const a = String(aiValue).replace(/[^0-9]/g, "");
    const u = String(userValue).replace(/[^0-9]/g, "");
    if (!a || !u || a === u) return [];
    const m = a.length, n = u.length;
    // Build DP table
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (a[i - 1] === u[j - 1]) dp[i][j] = dp[i - 1][j - 1];
        else dp[i][j] = 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
      }
    }
    // Ignore wholesale rewrites — if the edit distance is large relative to
    // length, the correction isn't a digit-level pattern, it's a full re-read.
    if (dp[m][n] > Math.max(2, Math.floor(Math.max(m, n) * 0.5))) return [];
    // Traceback to reconstruct ops
    const diffs = [];
    let i = m, j = n;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && a[i - 1] === u[j - 1]) { i--; j--; continue; }
      const sub = i > 0 && j > 0 ? dp[i - 1][j - 1] : Infinity;
      const del = i > 0 ? dp[i - 1][j] : Infinity;
      const ins = j > 0 ? dp[i][j - 1] : Infinity;
      const best = Math.min(sub, del, ins);
      if (best === sub) { diffs.push({ from: a[i - 1], to: u[j - 1], field }); i--; j--; }
      else if (best === del) { diffs.push({ from: a[i - 1], to: "", field }); i--; }
      else { diffs.push({ from: "", to: u[j - 1], field }); j--; }
    }
    return diffs.reverse();
  };

  // Learn from user corrections — called on submission to compare AI output vs final values
  const learnFromCorrections = (snapshot, finalReceipt, finalCard, finalForm) => {
    if (!snapshot) return;
    const corrections = JSON.parse(JSON.stringify(learnedCorrectionsRef.current));
    if (!corrections.stations) corrections.stations = {};
    if (!corrections.stationPrices) corrections.stationPrices = {};
    if (!corrections.digitPatterns) corrections.digitPatterns = [];
    if (!corrections.fuelTypeCorrections) corrections.fuelTypeCorrections = {};
    if (!corrections.stats) corrections.stats = { totalCorrections: 0, correctionsByField: {}, lastUpdated: null };
    const today = new Date().toISOString().slice(0, 10);
    let correctionsMade = 0;

    // 1. Station name learning
    const aiStation = (snapshot.station || "").trim();
    const userStation = (finalReceipt?.station || "").trim();
    if (aiStation && userStation && aiStation.toUpperCase() !== userStation.toUpperCase()) {
      const key = aiStation.toUpperCase();
      if (corrections.stations[key]) {
        corrections.stations[key].canonical = userStation;
        corrections.stations[key].count = (corrections.stations[key].count || 0) + 1;
        corrections.stations[key].lastSeen = today;
      } else {
        corrections.stations[key] = { canonical: userStation, count: 1, lastSeen: today };
      }
      corrections.stats.correctionsByField.station = (corrections.stats.correctionsByField.station || 0) + 1;
      correctionsMade++;
    }

    // 2. Record station price baseline — but only when the PPL is trustworthy.
    // If normalizeReceiptData algorithmically corrected the PPL (_pplCorrected)
    // AND the user didn't override it (no _rawPpl), we have no independent
    // confirmation of the value — recording it could poison future anomaly
    // detection, since every subsequent correct scan would look like a 20%+
    // deviation. Safer to skip the baseline this one time.
    const finalStation = userStation || aiStation;
    const finalFuelType = (finalReceipt?.fuelType || "").trim();
    const userEditedPpl = finalReceipt?._rawPpl != null && finalReceipt._rawPpl !== "";
    const pplWasAlgorithmicallyCorrected = !!snapshot?._pplCorrected ||
      (Array.isArray(snapshot?.lines) && snapshot.lines.some(l => l?._pplCorrected));
    const pplIsTrustworthy = userEditedPpl || !pplWasAlgorithmicallyCorrected;
    // Prefer the user's raw-typed value when present; it reflects their
    // intent more accurately than the normalized float (which may have been
    // corrected before the user saw it).
    const rawPplParsed = userEditedPpl ? parseFloat(finalReceipt._rawPpl) : NaN;
    const finalPpl = Number.isFinite(rawPplParsed) && rawPplParsed > 0
      ? rawPplParsed
      : parseFloat(finalReceipt?.pricePerLitre);
    if (finalStation && finalPpl > 0 && pplIsTrustworthy) {
      const sKey = finalStation;
      if (!corrections.stationPrices[sKey]) corrections.stationPrices[sKey] = { lastPrices: [], fuelTypes: [], lastSeen: today };
      corrections.stationPrices[sKey].lastPrices.push(finalPpl);
      corrections.stationPrices[sKey].lastSeen = today;
      if (finalFuelType && !corrections.stationPrices[sKey].fuelTypes.includes(finalFuelType)) {
        corrections.stationPrices[sKey].fuelTypes.push(finalFuelType);
      }
    } else if (finalStation && finalPpl > 0 && !pplIsTrustworthy) {
      console.log(`[Learn] Skipping station price baseline for "${finalStation}" — PPL was algorithmically corrected and user did not override, so the value is unverified.`);
    }

    // 3. Fuel type corrections per station
    const aiFuelType = (snapshot.fuelType || "").trim();
    if (finalStation && aiFuelType && finalFuelType && aiFuelType.toUpperCase() !== finalFuelType.toUpperCase()) {
      if (!corrections.fuelTypeCorrections[finalStation]) corrections.fuelTypeCorrections[finalStation] = {};
      corrections.fuelTypeCorrections[finalStation][aiFuelType.toUpperCase()] = finalFuelType;
      corrections.stats.correctionsByField.fuelType = (corrections.stats.correctionsByField.fuelType || 0) + 1;
      correctionsMade++;
    }

    // 4. Digit pattern analysis for numeric fields
    const numericFields = [
      { name: "litres", ai: snapshot.litres || snapshot._rawLitres, user: finalReceipt?.litres || finalReceipt?._rawLitres },
      { name: "cost", ai: snapshot.totalCost || snapshot.fuelCost, user: finalReceipt?.totalCost || finalReceipt?._rawCost },
      { name: "pricePerLitre", ai: snapshot.pricePerLitre, user: finalReceipt?.pricePerLitre || finalReceipt?._rawPpl },
    ];
    numericFields.forEach(({ name, ai, user }) => {
      if (!ai || !user) return;
      const aiStr = String(ai), userStr = String(user);
      if (aiStr === userStr) return;
      const diffs = analyzeDigitDiff(aiStr, userStr, name);
      diffs.forEach(diff => {
        const existing = corrections.digitPatterns.find(p => p.from === diff.from && p.to === diff.to && p.field === diff.field);
        if (existing) existing.count++;
        else corrections.digitPatterns.push({ ...diff, count: 1 });
      });
      if (diffs.length > 0) {
        corrections.stats.correctionsByField[name] = (corrections.stats.correctionsByField[name] || 0) + 1;
        correctionsMade++;
      }
    });

    // 5. Date corrections
    const aiDate = (snapshot.date || "").trim();
    const userDate = (finalReceipt?.date || "").trim();
    if (aiDate && userDate && aiDate !== userDate) {
      corrections.stats.correctionsByField.date = (corrections.stats.correctionsByField.date || 0) + 1;
      correctionsMade++;
    }

    // Update stats
    if (correctionsMade > 0) {
      corrections.stats.totalCorrections = (corrections.stats.totalCorrections || 0) + correctionsMade;
      corrections.stats.lastUpdated = new Date().toISOString();
      console.log(`[Learn] Recorded ${correctionsMade} correction(s) from user edits`);
    }

    persistCorrections(corrections);
  };

  // Learn fleet card ↔ rego association immediately when user edits card data on Steps 2/3
  // This ensures future scans benefit from manual corrections without waiting for submission
  // Also learns raw AI misread → correct card mapping for future auto-correction
  // Build a cardData shape that carries both the matcher's confidence (whether
  // we could map this scan to a known card) and the AI's own confidence
  // (whether the embossed digits were legible). These are two different
  // signals — the first drives auto-correction behaviour, the second drives
  // the "Fleet card unclear" admin flag. They must not be conflated.
  const buildCardDataFromMatch = (matched, aiResult) => ({
    cardNumber: matched.cardNumber,
    vehicleOnCard: matched.vehicleOnCard,
    _corrected: matched._corrected,
    _matchConfidence: matched._confidence, // fuzzy-matcher confidence
    _aiConfidence: aiResult?.confidence?.overall || null, // AI's self-report
    _aiIssues: aiResult?.confidence?.issues || [],
    _rawCardRead: aiResult?.rawCardRead || aiResult?.cardNumber || null,
    _confusableRegos: matched._confusableRegos,
    _originalCard: matched._originalCard,
    _originalRego: matched._originalRego,
    _knownException: matched._knownException,
    actualVehicleRego: matched.actualVehicleRego,
  });

  const learnFleetCardCorrection = useCallback((cardNumber, cardRego, rawCardFromAI, rawRegoFromAI) => {
    if (!cardRego || !cardNumber) return;
    const rego = cardRego.toUpperCase().replace(/\s+/g, "");
    const card = cardNumber.replace(/\s/g, "");
    if (!rego || !card || card.length < 10) return;

    // Learn the rego → card association
    const currentDB = learnedDBRef.current;
    const existing = currentDB[rego] || {};
    if (existing.c !== card) {
      const updated = { ...existing, c: card };
      const newLearned = { ...currentDB, [rego]: updated };
      persistLearned(newLearned);
    }

    // Learn the raw AI misread → correct mapping (so future identical misreads auto-correct)
    const rawCard = rawCardFromAI || "";
    const rawRego = rawRegoFromAI || "";
    const cleanRawCard = rawCard.replace(/[\s*]/g, "").toUpperCase();
    const cleanRawRego = rawRego.toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9]/g, "");

    // Only learn if the AI read something different from the corrected value
    const cardDiffers = cleanRawCard && cleanRawCard !== card.toUpperCase();
    const regoDiffers = cleanRawRego && cleanRawRego !== rego;

    if (cardDiffers || regoDiffers) {
      const currentMappings = learnedCardMappingsRef.current;
      // Key by the FULL raw card (previously last-8 — risked cross-card collisions).
      // Fall back to rego-based key when no card was read.
      const rawKey = cleanRawCard
        ? cleanRawCard
        : `rego_${cleanRawRego}`;

      // Migrate / dedupe legacy last-8 key if present and consistent
      const legacyKey = cleanRawCard && cleanRawCard.length > 8 ? cleanRawCard.slice(-8) : null;
      const legacyEntry = legacyKey && currentMappings[legacyKey];

      const existingAtKey = currentMappings[rawKey];
      const sameTarget = existingAtKey
        && existingAtKey.correctCard === card
        && existingAtKey.correctRego === rego;
      const legacySameTarget = legacyEntry
        && legacyEntry.correctCard === card
        && legacyEntry.correctRego === rego;

      const priorCount = sameTarget
        ? (existingAtKey.confirmCount || 1)
        : (legacySameTarget ? (legacyEntry.confirmCount || 1) : 0);

      const newMapping = {
        correctCard: card,
        correctRego: rego,
        rawCard: cleanRawCard || null,
        rawRego: cleanRawRego || null,
        confirmCount: priorCount + 1,
        learnedAt: existingAtKey?.learnedAt || new Date().toISOString(),
        lastSeen: new Date().toISOString(),
      };

      const updatedMappings = { ...currentMappings, [rawKey]: newMapping };
      // Drop the legacy last-8 entry if it was pointing to the same target
      if (legacyKey && legacyKey !== rawKey && legacySameTarget) {
        delete updatedMappings[legacyKey];
      }
      persistCardMappings(updatedMappings);
      console.log(`Learned card correction: "${rawKey}" → card ${card}, rego ${rego} (confirmCount=${newMapping.confirmCount})`);
    }
  }, []);

  // Learn from every submission — driver corrections override the static spreadsheet DB
  const learnFromSubmission = (entry) => {
    const rego = entry.registration;
    if (!rego) return;

    // Read from ref (always current, even mid-batch)
    const currentDB = learnedDBRef.current;
    const existing = currentDB[rego] || {};

    // Build updated record — learn division & vehicle type corrections, but NEVER
    // overwrite the original registered owner (dr) — drivers share vehicles
    const updated = {
      ...existing,
      t: entry.vehicleType || existing.t || "",
      d: entry.division || existing.d || "",
      n: entry.vehicleName || existing.n || entry.vehicleType || "",
      f: entry.fuelType || existing.f || "",
    };
    // Preserve original owner: only set dr if there isn't one already (from DB or previous learn)
    if (!updated.dr) {
      const staticMatch = REGO_DB.find(v => v.r.toUpperCase().replace(/\s+/g, "") === rego);
      if (staticMatch?.dr) updated.dr = staticMatch.dr;
    }
    if (entry.fleetCardNumber) updated.c = entry.fleetCardNumber;

    // Enforce: traffic control vehicles are always Landscape
    if (updated.n && /TRAFFIC/i.test(updated.n)) updated.d = "Landscape";

    // Build a make/model line from the static DB if we don't have one
    const staticMatch = REGO_DB.find(v => v.r.toUpperCase().replace(/\s+/g, "") === rego);
    if (staticMatch?.m && !updated.m) updated.m = staticMatch.m;
    if (staticMatch?.n && (!updated.n || updated.n === entry.vehicleType)) updated.n = staticMatch.n;

    const newLearned = { ...currentDB, [rego]: updated };
    persistLearned(newLearned);
  };

  // ── Driver auto-fill profile helpers ──────────────────────────────────
  // Persist the admin-curated profile map to local + cloud.
  const persistDriverProfiles = async (next) => {
    setDriverProfiles(next);
    const json = JSON.stringify(next);
    try { await window.storage.set("fuel_driver_profiles", json); } catch (_) {}
    try { await db.saveSetting("driver_profiles", json); } catch (_) {}
  };

  // Look up a profile by full name (case-insensitive). Returns the profile
  // object or null. Reads from the ref so callbacks see the latest map.
  const findProfileByName = (firstName, lastName) => {
    const fullName = `${(firstName || "").trim()} ${(lastName || "").trim()}`.trim();
    if (!fullName) return null;
    return driverProfilesRef.current[fullName.toLowerCase()] || null;
  };

  // Apply a profile to the in-progress submission: pre-fill rego/division/
  // vehicle in the form, populate cardData with the saved card details so
  // the receipt-photo step doesn't need a card visible, and set the
  // profileApplied flag (drives the Step 1 banner + suppresses the
  // missing-card warning on Step 2).
  const applyDriverProfile = (profile) => {
    if (!profile) return;
    setForm(f => ({
      ...f,
      registration: profile.rego || f.registration,
      division: profile.division || f.division,
      vehicleType: profile.vehicleType || f.vehicleType,
    }));
    if (profile.cardNumber || profile.cardRego) {
      setCardData({
        cardNumber: profile.cardNumber || null,
        vehicleOnCard: profile.cardRego || profile.rego || null,
      });
    }
    setProfileApplied(profile);
  };

  // "Different vehicle today?" — clears the profile from THIS submission
  // only. The profile remains saved in driverProfiles; next time this
  // driver opens the app, it'll auto-apply again.
  const clearProfileForThisEntry = () => {
    setProfileApplied(null);
    setForm(f => ({ ...f, registration: "", division: "", vehicleType: "", odometer: "" }));
    setCardData(null);
  };

  // "Scan card anyway" — keeps form pre-fill (rego/division/vehicle) but
  // re-enables the card-photo step for THIS submission. Useful if a
  // driver swapped cards or wants to verify.
  const scanCardAnyway = () => {
    setProfileApplied(null);
    setCardData(null);
  };

  // Auto-apply when the driver name on Step 1 matches a saved profile.
  // Runs whenever the name fields change. Skipped in otherMode (jerry-can
  // / equipment entries don't fit the single-vehicle pattern).
  useEffect(() => {
    if (otherMode) return;
    if (step !== 1) return;
    const profile = findProfileByName(form.driverFirstName, form.driverLastName);
    if (profile) {
      // Only re-apply if a different (or no) profile is currently active.
      if (!profileApplied || profileApplied.name?.toLowerCase() !== profile.name?.toLowerCase()) {
        applyDriverProfile(profile);
      }
    } else if (profileApplied) {
      // Name no longer matches a profile — drop the auto-fill flag but
      // leave any values the user might have edited intact.
      setProfileApplied(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.driverFirstName, form.driverLastName, otherMode, step, driverProfiles]);

  // ── Form helpers ──────────────────────────────────────────────────────────
  const getLastOdometer = (rego) => {
    if (!rego) return null;
    const r = rego.toUpperCase().replace(/\s+/g, "");
    const regoEntries = entriesRef.current.filter(e => e.registration?.toUpperCase().replace(/\s+/g, "") === r && e.odometer);
    if (regoEntries.length === 0) return null;
    return Math.max(...regoEntries.map(e => e.odometer));
  };

  const getOdoWarning = () => {
    const odo = parseFloat(form.odometer);
    if (!odo || !form.registration) return null;
    const lastOdo = getLastOdometer(form.registration);
    if (!lastOdo) return null;
    const hrsMode = isHoursBased(form.vehicleType);
    const u = hrsMode ? "hrs" : "km";
    if (odo < lastOdo) return { type: "danger", text: `${hrsMode ? "Hours" : "Odometer"} is lower than last recorded (${lastOdo.toLocaleString()} ${u}). Did you miss a digit?` };
    const jump = odo - lastOdo;
    const jumpThreshold = hrsMode ? 5000 : 30000;
    if (jump > jumpThreshold) return { type: "warn", text: `That's ${jump.toLocaleString()} ${u} since last fill-up \u2014 unusually high. Double-check the reading.` };
    return null;
  };

  const resetForm = () => {
    setStep(1);
    // Re-apply saved driver profile if exists
    const base = { driverFirstName: "", driverLastName: "", registration: "", division: "", vehicleType: "", odometer: "", ppl: "" };
    if (savedDriver) {
      if (savedDriver.firstName) base.driverFirstName = savedDriver.firstName;
      if (savedDriver.lastName) base.driverLastName = savedDriver.lastName;
      // Fallback for old saved profiles that only have .name
      if (!savedDriver.firstName && savedDriver.name) {
        const parts = savedDriver.name.split(" ");
        base.driverFirstName = parts[0] || "";
        base.driverLastName = parts.slice(1).join(" ") || "";
      }
      if (savedDriver.rego) {
        base.registration = savedDriver.rego.toUpperCase();
        const match = lookupRego(savedDriver.rego, learnedDBRef.current, entriesRef.current);
        if (match) {
          base.division = match.d;
          base.vehicleType = match.t;
          base._regoMatch = match;
        }
      }
    }
    setForm(base);
    setOtherMode(false);
    setOtherForm({ equipment: "", station: "", fleetCard: "", cardRego: "", notes: "", division: "Tree", litres: "", ppl: "", totalCost: "", quantity: "", _customEquipment: "" });
    setDriverCards([]);
    setReceiptPreview(null); setReceiptB64(null); setReceiptData(null); setReceiptMime("image/jpeg");
    setReceiptRotation(0); setReceiptFile(null);
    setCardPreview(null); setCardB64(null); setCardData(null);
    setManualCard(false); setManualCardNum(""); setManualCardRego("");
    // Clear the per-submission profile flag — the useEffect on the name
    // fields will re-apply the matching profile (if any) once setForm(base)
    // re-populates the name from savedDriver. Without this reset, the
    // useEffect's "same profile already active" guard skips re-applying
    // and the new submission ends up with name-only auto-fill.
    setProfileApplied(null);
    setSplitMode(false); setSplits([]);
    setPendingExtraEntries(null);
    setAiScanSnapshot(null);
    setPhotoDate(null);
    setDateCrossValidation(null);
    setReviewConfirmed(false);
    setError("");
  };

  const ORIENTATION_PROMPT = `You are looking at a fuel receipt or docket from a petrol station. Your job is to determine if the image needs rotation so the text reads normally (left to right, top to bottom).

Look at the MAIN BODY TEXT of the receipt — the station name, date, fuel type, litres, and dollar amounts. Ignore barcodes, logos, or small rotated text.

How to decide:
- If the main text reads normally (left to right, top to bottom): rotation = 0
- If the receipt is sideways and you'd need to turn your head RIGHT to read it: rotation = 270 (the image was rotated 90° clockwise, so we rotate 270° to fix)
- If the receipt is sideways and you'd need to turn your head LEFT to read it: rotation = 90 (the image was rotated 270° clockwise, so we rotate 90° to fix)
- If the text is completely upside down: rotation = 180

IMPORTANT: Most phone photos of receipts are already upright (rotation = 0). Only suggest rotation if the text is clearly NOT readable in its current orientation. When in doubt, return 0.

Return ONLY valid JSON: {"rotation": 0} or {"rotation": 90} or {"rotation": 180} or {"rotation": 270}`;

  // Date anomaly check — flag if scanned date is outside 14-day window
  const DATE_WINDOW_DAYS = 14;
  // ── Date Cross-Validation System ─────────────────────────────────────────
  // Extract date from photo EXIF data or file.lastModified as ground truth
  const getPhotoDate = async (file) => {
    if (!file) return null;
    // Try to extract EXIF DateTimeOriginal from JPEG
    try {
      const buf = await file.slice(0, 128 * 1024).arrayBuffer(); // read first 128KB
      const view = new DataView(buf);
      // Check JPEG SOI marker
      if (view.getUint16(0) === 0xFFD8) {
        let offset = 2;
        while (offset < view.byteLength - 4) {
          const marker = view.getUint16(offset);
          if (marker === 0xFFE1) { // APP1 (EXIF)
            const length = view.getUint16(offset + 2);
            // Check "Exif\0\0" header
            const exifHeader = String.fromCharCode(view.getUint8(offset + 4), view.getUint8(offset + 5), view.getUint8(offset + 6), view.getUint8(offset + 7));
            if (exifHeader === "Exif") {
              const tiffStart = offset + 10;
              const littleEndian = view.getUint16(tiffStart) === 0x4949;
              const ifdOffset = view.getUint32(tiffStart + 4, littleEndian);
              const ifdStart = tiffStart + ifdOffset;
              const numEntries = view.getUint16(ifdStart, littleEndian);
              // Search IFD0 for ExifIFD pointer (tag 0x8769)
              let exifIFDOffset = null;
              for (let i = 0; i < numEntries && ifdStart + 2 + i * 12 + 12 <= view.byteLength; i++) {
                const entryOffset = ifdStart + 2 + i * 12;
                const tag = view.getUint16(entryOffset, littleEndian);
                if (tag === 0x8769) {
                  exifIFDOffset = view.getUint32(entryOffset + 8, littleEndian);
                  break;
                }
              }
              if (exifIFDOffset) {
                const exifStart = tiffStart + exifIFDOffset;
                const exifEntries = view.getUint16(exifStart, littleEndian);
                for (let i = 0; i < exifEntries && exifStart + 2 + i * 12 + 12 <= view.byteLength; i++) {
                  const entryOffset = exifStart + 2 + i * 12;
                  const tag = view.getUint16(entryOffset, littleEndian);
                  // 0x9003 = DateTimeOriginal, 0x9004 = DateTimeDigitized, 0x0132 = DateTime
                  if (tag === 0x9003 || tag === 0x9004) {
                    const valOffset = view.getUint32(entryOffset + 8, littleEndian);
                    const dateBytes = new Uint8Array(buf, tiffStart + valOffset, 19);
                    const dateStr = String.fromCharCode(...dateBytes); // "YYYY:MM:DD HH:MM:SS"
                    const [datePart] = dateStr.split(" ");
                    const [y, m, d] = datePart.split(":").map(Number);
                    if (y > 2000 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
                      console.log(`[DateCross] EXIF DateTimeOriginal: ${dateStr}`);
                      return new Date(y, m - 1, d);
                    }
                  }
                }
              }
            }
            offset += 2 + length;
          } else if ((marker & 0xFF00) === 0xFF00) {
            offset += 2 + view.getUint16(offset + 2);
          } else {
            break;
          }
        }
      }
    } catch (_) { /* EXIF parsing failed — fall through to lastModified */ }
    // Fallback: use file's lastModified timestamp (when the photo was saved/taken)
    if (file.lastModified) {
      const d = new Date(file.lastModified);
      console.log(`[DateCross] Using file.lastModified: ${d.toISOString()}`);
      return d;
    }
    return null;
  };

  // Cross-validate AI-scanned date against multiple independent signals
  const crossValidateDate = (scannedDateStr, photoDate, rego, currentOdometer) => {
    const result = { issues: [], suggestedDate: null, confidence: "ok" };
    const scannedTs = parseDate(scannedDateStr);
    if (!scannedTs) return result;
    const scannedDate = new Date(scannedTs);

    // Signal 1: Photo date (EXIF or lastModified)
    if (photoDate) {
      const photoDayStart = new Date(photoDate.getFullYear(), photoDate.getMonth(), photoDate.getDate());
      const scannedDayStart = new Date(scannedDate.getUTCFullYear(), scannedDate.getUTCMonth(), scannedDate.getUTCDate());
      const gapDays = Math.round((photoDayStart - scannedDayStart) / 86400000);
      if (gapDays > 2) {
        result.issues.push({
          signal: "photo",
          message: `Photo taken ${photoDate.toLocaleDateString("en-AU")} but receipt date reads ${scannedDateStr} (${gapDays} days earlier)`,
          detail: "The photo date is much more recent than the scanned date — the AI likely misread a digit",
        });
        result.suggestedDate = photoDate;
      } else if (gapDays < -1) {
        result.issues.push({
          signal: "photo",
          message: `Receipt date ${scannedDateStr} is ${Math.abs(gapDays)} days after the photo was taken`,
          detail: "The scanned date is after the photo date — likely a digit misread",
        });
      }
    }

    // Signal 2: Submission time (current time — drivers typically submit within 0-2 days)
    const now = new Date();
    const nowDayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const scannedDayStart2 = new Date(scannedDate.getUTCFullYear(), scannedDate.getUTCMonth(), scannedDate.getUTCDate());
    const submissionGap = Math.round((nowDayStart - scannedDayStart2) / 86400000);
    if (submissionGap > 5) {
      result.issues.push({
        signal: "submission",
        message: `Receipt date is ${submissionGap} days before submission — unusually old`,
        detail: "Drivers normally submit within 1-2 days. A large gap often means a digit was misread.",
      });
      if (!result.suggestedDate) {
        // Suggest today's date as a fallback if no photo date
        result.suggestedDate = now;
      }
    }

    // Signal 3: Odometer sequence (date should be chronological with odometer)
    if (rego && currentOdometer) {
      const r = rego.toUpperCase().replace(/\s+/g, "");
      const odoNum = parseFloat(currentOdometer);
      if (r && odoNum > 0) {
        const regoEntries = entriesRef.current
          .filter(e => e.registration?.toUpperCase().replace(/\s+/g, "") === r && e.odometer && e.date)
          .sort((a, b) => (a.odometer || 0) - (b.odometer || 0));
        // Find the entry with the closest lower odometer
        const prevEntry = [...regoEntries].reverse().find(e => e.odometer < odoNum);
        if (prevEntry) {
          const prevDate = parseDate(prevEntry.date);
          if (prevDate && scannedTs < prevDate) {
            const prevDateObj = new Date(prevDate);
            result.issues.push({
              signal: "odometer",
              message: `Odometer is higher than previous entry (${prevEntry.odometer.toLocaleString()}) on ${prevEntry.date}, but scanned date ${scannedDateStr} is earlier`,
              detail: "The odometer increased but the date went backwards — the date is likely misread",
            });
          }
        }
        // Check if there's a later entry with lower odometer (date should be before it)
        const nextEntry = regoEntries.find(e => e.odometer > odoNum);
        if (nextEntry) {
          const nextDate = parseDate(nextEntry.date);
          if (nextDate && scannedTs > nextDate) {
            result.issues.push({
              signal: "odometer",
              message: `Odometer is lower than a later entry (${nextEntry.odometer.toLocaleString()}) on ${nextEntry.date}, but scanned date ${scannedDateStr} is after it`,
              detail: "The odometer is lower but the date is later — the date may be misread",
            });
          }
        }
      }
    }

    // Set confidence level based on number of signals flagging
    if (result.issues.length >= 2) result.confidence = "high_risk";
    else if (result.issues.length === 1) result.confidence = "warning";

    // Format suggested date as DD/MM/YYYY if we have one
    if (result.suggestedDate) {
      const sd = result.suggestedDate;
      result.suggestedDateStr = `${String(sd.getDate()).padStart(2, "0")}/${String(sd.getMonth() + 1).padStart(2, "0")}/${sd.getFullYear()}`;
    }

    if (result.issues.length > 0) {
      console.log(`[DateCross] ${result.issues.length} issue(s) found for date "${scannedDateStr}":`, result.issues.map(i => i.signal).join(", "));
    }

    return result;
  };

  const checkScannedDate = (normalized) => {
    if (!normalized?.date) return;
    const scannedTs = parseDate(normalized.date);
    if (!scannedTs) return;
    const scannedDate = new Date(scannedTs);
    const now = new Date();
    const diffMs = Math.abs(now - scannedDate);
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    // Anchor "future" check to Sydney calendar, not device local clock.
    if (isAfterSydneyToday(normalized.date)) {
      showToast(`Date "${normalized.date}" is in the FUTURE — this is impossible! Please correct the date.`, "error");
    } else if (diffDays > DATE_WINDOW_DAYS) {
      showToast(`Date "${normalized.date}" is ${diffDays} days ago — please double-check.`, "warn");
    }
  };

  const handleReceiptFile = async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    if (receiptPreview?.startsWith("blob:")) URL.revokeObjectURL(receiptPreview);
    setReceiptPreview(URL.createObjectURL(file));
    setReceiptFile(file);
    setReceiptRotation(0);
    setReceiptData(null);
    // When a profile is active the card details are already on file —
    // don't blow them away just because the user is taking a new receipt
    // photo. The post-scan AI extraction is also skipped below.
    if (!profileApplied) setCardData(null);
    setDateCrossValidation(null);
    setReviewConfirmed(false);
    // Extract photo date from EXIF in background
    getPhotoDate(file).then(pd => setPhotoDate(pd)).catch(() => setPhotoDate(null));
    if (!apiKey) { setError("Add an Anthropic API key in Settings first."); return; }
    const currentScanId = ++scanIdRef.current;
    setReceiptScanning(true); setError("");
    try {
      // Step 1: Compress at 0° for orientation check
      let { b64, mime } = await compressImage(file, 0);
      if (scanIdRef.current !== currentScanId) return; // superseded by newer upload

      // Step 2: Auto-detect orientation
      let rotation = 0;
      try {
        const orientResult = await claudeScan(apiKey, b64, mime, ORIENTATION_PROMPT, apiModels.orientation);
        if (scanIdRef.current !== currentScanId) return;
        if (orientResult?.rotation && [90, 180, 270].includes(orientResult.rotation)) {
          rotation = orientResult.rotation;
          // Re-compress with corrected rotation
          const corrected = await compressImage(file, rotation);
          if (scanIdRef.current !== currentScanId) return;
          b64 = corrected.b64;
          mime = corrected.mime;
          setReceiptPreview(`data:${mime};base64,${b64}`);
          setReceiptRotation(rotation);
        }
      } catch (_) { /* orientation check failed — continue with original */ }

      if (scanIdRef.current !== currentScanId) return;
      // Step 3: Full receipt scan on properly oriented image
      setReceiptB64(b64);
      setReceiptMime(mime);
      let result = await claudeScan(apiKey, b64, mime, buildReceiptScanPrompt(), apiModels.receipt);
      if (scanIdRef.current !== currentScanId) return;
      let normalized = normalizeReceiptData(result, learnedCorrectionsRef.current);

      // Step 4: Orientation validation — if scan produced very little data and we rotated,
      // the orientation was probably wrong. Try again at 0°.
      if (rotation !== 0) {
        const hasDate = !!normalized.date;
        const hasStation = !!normalized.station;
        const hasLitres = normalized.litres > 0;
        const hasCost = normalized.totalCost > 0 || normalized.fuelCost > 0;
        const dataQuality = [hasDate, hasStation, hasLitres, hasCost].filter(Boolean).length;
        if (dataQuality <= 1) {
          console.log(`[Orientation] Rotated scan produced low data (quality=${dataQuality}/4). Retrying at 0°...`);
          try {
            const original = await compressImage(file, 0);
            if (scanIdRef.current !== currentScanId) return;
            const retryResult = await claudeScan(apiKey, original.b64, original.mime, buildReceiptScanPrompt(), apiModels.receipt);
            if (scanIdRef.current !== currentScanId) return;
            const retryNormalized = normalizeReceiptData(retryResult, learnedCorrectionsRef.current);
            const retryQuality = [!!retryNormalized.date, !!retryNormalized.station, retryNormalized.litres > 0, (retryNormalized.totalCost > 0 || retryNormalized.fuelCost > 0)].filter(Boolean).length;
            if (retryQuality > dataQuality) {
              console.log(`[Orientation] Original orientation (0°) produced better data (quality=${retryQuality}/4). Using original.`);
              b64 = original.b64; mime = original.mime;
              result = retryResult; normalized = retryNormalized;
              rotation = 0;
              setReceiptB64(b64); setReceiptMime(mime);
              setReceiptPreview(`data:${mime};base64,${b64}`);
              setReceiptRotation(0);
            }
          } catch (_) { /* retry failed — keep rotated version */ }
        }
      }

      setReceiptData(normalized);
      setAiScanSnapshot(JSON.parse(JSON.stringify(normalized)));
      checkScannedDate(normalized);
      // Cross-validate date against photo EXIF + odometer history
      if (normalized.date) {
        const rego = form.registration || normalized.vehicleOnCard || "";
        const odo = form.odometer ? parseInt(form.odometer) : null;
        const cv = crossValidateDate(normalized.date, photoDate, rego, odo);
        setDateCrossValidation(cv && cv.issues.length > 0 ? cv : null);
      }
      if (normalized.cardNumber || normalized.vehicleOnCard) {
        // When a driver profile is active, the saved card details are
        // authoritative \u2014 don't let the AI's read of the receipt photo
        // overwrite them. The receipt scan is still useful for litres /
        // price / station data, just not for card details.
        if (!profileAppliedRef.current) {
          const matched = fuzzyMatchFleetCard(normalized.cardNumber, normalized.vehicleOnCard, learnedDBRef.current, learnedCardMappingsRef.current);
          setCardData(buildCardDataFromMatch(matched, result));
          // Known card/rego exception (e.g. Carlos Carillo's WIA53F card for EIA53F vehicle):
          // auto-fill form registration with the ACTUAL vehicle rego, not the one on the card.
          if (matched._knownException && matched.actualVehicleRego && !form.registration) {
            setForm(f => ({ ...f, registration: matched.actualVehicleRego }));
          }
        }
      }
    } catch (e) {
      if (scanIdRef.current !== currentScanId) return;
      setError("Scan failed \u2014 " + e.message);
    }
    if (scanIdRef.current !== currentScanId) return;
    setReceiptScanning(false);
    setTimeout(() => scanResultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 200);
  };

  const rotateAndRescan = async (newRotation) => {
    if (!receiptFile || !apiKey) return;
    // Increment shared receipt scanId so any in-flight scan from a previous
    // rotation/upload/rescan is abandoned before it can overwrite new state.
    const currentScanId = ++scanIdRef.current;
    setReceiptRotation(newRotation);
    setReceiptScanning(true); setError(""); setReceiptData(null);
    if (!profileApplied) setCardData(null);
    setReviewConfirmed(false);
    try {
      const { b64, mime } = await compressImage(receiptFile, newRotation);
      if (scanIdRef.current !== currentScanId) return;
      setReceiptB64(b64);
      setReceiptMime(mime);
      setReceiptPreview(`data:${mime};base64,${b64}`);
      const result = await claudeScan(apiKey, b64, mime, buildReceiptScanPrompt(), apiModels.receipt);
      if (scanIdRef.current !== currentScanId) return;
      const normalized = normalizeReceiptData(result, learnedCorrectionsRef.current);
      setReceiptData(normalized);
      setAiScanSnapshot(JSON.parse(JSON.stringify(normalized)));
      checkScannedDate(normalized);
      if (normalized.date) {
        const rego = form.registration || normalized.vehicleOnCard || "";
        const odo = form.odometer ? parseInt(form.odometer) : null;
        const cv = crossValidateDate(normalized.date, photoDate, rego, odo);
        setDateCrossValidation(cv && cv.issues.length > 0 ? cv : null);
      }
      if (normalized.cardNumber || normalized.vehicleOnCard) {
        // Profile-active short-circuit (see handleReceiptFile for rationale).
        if (!profileAppliedRef.current) {
          const matched = fuzzyMatchFleetCard(normalized.cardNumber, normalized.vehicleOnCard, learnedDBRef.current, learnedCardMappingsRef.current);
          setCardData(buildCardDataFromMatch(matched, result));
          // Known card/rego exception (e.g. Carlos Carillo's WIA53F card for EIA53F vehicle):
          // auto-fill form registration with the ACTUAL vehicle rego, not the one on the card.
          if (matched._knownException && matched.actualVehicleRego && !form.registration) {
            setForm(f => ({ ...f, registration: matched.actualVehicleRego }));
          }
        }
      }
    } catch (e) {
      if (scanIdRef.current !== currentScanId) return;
      setError("Rotate/scan failed \u2014 " + e.message);
    }
    // Only clear the scanning flag if WE are still the latest scan — otherwise
    // the newer scan is already in progress and will toggle it itself.
    if (scanIdRef.current !== currentScanId) return;
    setReceiptScanning(false);
    setTimeout(() => scanResultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 200);
  };

  const rescanReceipt = async () => {
    if (!receiptB64 || !apiKey) return;
    // Same scanIdRef as handleReceiptFile / rotateAndRescan — a re-scan
    // supersedes any in-flight receipt scan that came before it.
    const currentScanId = ++scanIdRef.current;
    setReceiptScanning(true); setError("");
    try {
      const result = await claudeScan(apiKey, receiptB64, receiptMime, buildReceiptScanPrompt(), apiModels.receipt);
      if (scanIdRef.current !== currentScanId) return;
      const normalized = normalizeReceiptData(result, learnedCorrectionsRef.current);
      setReceiptData(normalized);
      setAiScanSnapshot(JSON.parse(JSON.stringify(normalized)));
      checkScannedDate(normalized);
      if (normalized.date) {
        const rego = form.registration || normalized.vehicleOnCard || "";
        const odo = form.odometer ? parseInt(form.odometer) : null;
        const cv = crossValidateDate(normalized.date, photoDate, rego, odo);
        setDateCrossValidation(cv && cv.issues.length > 0 ? cv : null);
      }
      if (normalized.cardNumber || normalized.vehicleOnCard) {
        // Profile-active short-circuit (see handleReceiptFile for rationale).
        if (!profileAppliedRef.current) {
          const matched = fuzzyMatchFleetCard(normalized.cardNumber, normalized.vehicleOnCard, learnedDBRef.current, learnedCardMappingsRef.current);
          setCardData(buildCardDataFromMatch(matched, result));
          // Known card/rego exception (e.g. Carlos Carillo's WIA53F card for EIA53F vehicle):
          // auto-fill form registration with the ACTUAL vehicle rego, not the one on the card.
          if (matched._knownException && matched.actualVehicleRego && !form.registration) {
            setForm(f => ({ ...f, registration: matched.actualVehicleRego }));
          }
        }
      }
    } catch (e) {
      if (scanIdRef.current !== currentScanId) return;
      setError("Re-scan failed \u2014 " + e.message);
    }
    if (scanIdRef.current !== currentScanId) return;
    setReceiptScanning(false);
    setTimeout(() => scanResultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 200);
  };

  const handleCardFile = async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    if (cardPreview?.startsWith("blob:")) URL.revokeObjectURL(cardPreview);
    setCardPreview(URL.createObjectURL(file));
    setCardData(null);
    if (!apiKey) return;
    // Independent card scanId so a card re-upload doesn't poison the receipt
    // scan — but still guards against the user rapid-firing two card uploads.
    const currentScanId = ++cardScanIdRef.current;
    setCardScanning(true); setError("");
    try {
      const { b64, mime } = await compressImage(file);
      if (cardScanIdRef.current !== currentScanId) return;
      setCardB64(b64);
      const result = await claudeScan(apiKey, b64, mime, buildCardScanPrompt(), apiModels.card);
      if (cardScanIdRef.current !== currentScanId) return;
      if (result?.cardNumber || result?.vehicleOnCard) {
        // Run the matcher so the card-only flow benefits from the same
        // learned-mapping and REGO_DB lookups as the combined-scan flow,
        // and so _matchConfidence / _aiConfidence stay separated consistently.
        const matched = fuzzyMatchFleetCard(result.cardNumber, result.vehicleOnCard, learnedDBRef.current, learnedCardMappingsRef.current);
        setCardData(buildCardDataFromMatch(matched, result));
        if (matched._knownException && matched.actualVehicleRego && !form.registration) {
          setForm(f => ({ ...f, registration: matched.actualVehicleRego }));
        }
      } else {
        setCardData(null);
      }
    } catch (e) {
      if (cardScanIdRef.current !== currentScanId) return;
      setError("Card scan failed \u2014 " + e.message);
    }
    if (cardScanIdRef.current !== currentScanId) return;
    setCardScanning(false);
  };

  const handleSubmit = async () => {
    // Block submission if date is after today in Sydney
    const dateStr = receiptData?.date || "";
    if (dateStr && isAfterSydneyToday(dateStr)) {
      setError("Cannot submit: the date is in the future. Receipts can only be from today or earlier. Please correct the date first.");
      return;
    }
    // Learn from any corrections the user made (compare AI snapshot vs final values)
    if (aiScanSnapshot) {
      learnFromCorrections(aiScanSnapshot, receiptData, cardData, form);
    }
    setSaving(true);
    // Parse any raw string values that may have been edited in review
    const ppl = parseFloat(receiptData?.pricePerLitre) || null;
    const date = dateStr;
    const station = receiptData?.station || "";
    const baseFuelType = receiptData?.fuelType || "";
    const cardNum = cardData?.cardNumber || "";
    const cardVeh = cardData?.vehicleOnCard || "";
    const now = new Date().toISOString();
    const parsedLitresTotal = parseFloat(receiptData?.litres) || null;
    const parsedTotalCost = parseFloat(receiptData?.totalCost) || null;

    // ── "Other" mode (non-vehicle fuel claims) ──
    if (otherMode) {
      const isOil = isOilProduct(otherForm.equipment);
      const otherEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        submittedAt: now,
        entryType: "other",
        subType: isOil ? "product" : "fuel", // distinguish fuel vs product purchase
        division: otherForm.division || "Tree",
        ...driverFieldsFor(`${form.driverFirstName.trim()} ${form.driverLastName.trim()}`.trim()),
        equipment: otherForm.equipment.trim(),
        station: otherForm.station.trim() || station,
        fleetCardNumber: cardData?.cardNumber || cardNum || otherForm.fleetCard.trim() || "",
        cardRego: cardData?.vehicleOnCard || cardVeh || otherForm.cardRego.trim().toUpperCase() || "",
        date,
        // For oil products: use quantity + price instead of litres + ppl
        litres: isOil ? null : (parsedLitresTotal || parseFloat(otherForm.litres) || null),
        pricePerLitre: isOil ? null : (ppl || parseFloat(otherForm.ppl) || null),
        quantity: isOil ? (parseInt(otherForm.quantity) || 1) : null,
        totalCost: parsedTotalCost || parseFloat(otherForm.totalCost) || null,
        fuelType: baseFuelType || otherForm.equipment.trim(),
        notes: otherForm.notes.trim() + (isOil && otherForm.quantity ? ` (Qty: ${otherForm.quantity})` : ""),
        hasReceipt: !!receiptB64,
        _aiConfidence: receiptData?.confidence?.overall || null,
        _aiIssues: [...(receiptData?.confidence?.issues || []), ...(receiptData?._mathIssues || [])],
        // _cardConfidence now tracks the AI's own confidence in its read,
        // NOT the matcher's confidence. This is what the "Fleet card unclear"
        // admin flag fires on — we want to know when the SCANNER was unsure,
        // not when the matcher couldn't map a confident scan.
        _cardConfidence: cardData?._aiConfidence || null,
        _cardMatchConfidence: cardData?._matchConfidence || null,
        _cardCorrected: !!cardData?._corrected,
        _cardConfusable: cardData?._confusableRegos || null,
        _cardOriginalCard: cardData?._originalCard || null,
        _cardOriginalRego: cardData?._originalRego || null,
        _cardRawRead: cardData?._rawCardRead || null,
        _cardAiIssues: cardData?._aiIssues || null,
        _reviewConfirmed: needsReviewConfirmation ? reviewConfirmed : null, // null=clean scan, true=user confirmed a suspect scan
      };
      // entriesRef.current reflects any cloud changes that arrived while the
      // user was on the review screen — closure `entries` could be stale.
      await persist([...entriesRef.current, otherEntry], otherEntry);
      if (receiptB64) await saveReceiptImage(otherEntry.id, receiptB64, receiptMime);
      setSaving(false);
      setStep(4);
      return;
    }

    // ── Normal vehicle mode ──
    // Scanned receipt lines and other items for order-based matching
    const scannedLines = receiptData?.lines || [];
    const scannedOtherItems = [...(receiptData?.otherItems || [])]; // copy so we can consume
    let nextLineIdx = 0; // tracks which receipt line to match next
    let nextOtherIdx = 0; // tracks which otherItem to match next

    // Single group-id shared by every entry derived from this one receipt scan
    // (primary, vehicle splits, "other" splits, AND any pending extras the
    // user later confirms on Step 4). Lets us regroup multi-pump receipts
    // retroactively — the DB column existed but was never populated.
    const splitGroupId = `sg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

    const buildEntry = (rego, division, vehicleType, odometer, litres, regoMatch, matchedLine, userPplOverride) => {
      const lineFuelType = matchedLine?.fuelType || baseFuelType || regoMatch?.f || "";
      const parsedLitres = parseFloat(litres) || null;
      const scannedLineCost = matchedLine?.cost || null;
      const scannedLineLitres = matchedLine?.litres || null;

      // Price per litre priority: user-entered > scanned line > calculated from cost÷litres > global
      // If the user manually typed a price, that ALWAYS takes precedence over the AI scan.
      let linePpl;
      if (userPplOverride && userPplOverride > 0) {
        // User explicitly entered $/L — trust their input first
        linePpl = userPplOverride;
      } else if (matchedLine?.pricePerLitre) {
        linePpl = matchedLine.pricePerLitre;
      } else if (scannedLineCost && scannedLineLitres && scannedLineLitres > 0) {
        linePpl = parseFloat((scannedLineCost / scannedLineLitres).toFixed(4));
      } else {
        linePpl = ppl;
      }

      // Cost: if user entered different litres than scanned (split), recalculate from litres × ppl
      // If litres match scanned, use scanned cost directly
      let entryCost;
      if (parsedLitres && scannedLineLitres && Math.abs(parsedLitres - scannedLineLitres) < 0.5) {
        // User litres ≈ scanned litres — use scanned cost (most accurate)
        entryCost = scannedLineCost;
      } else {
        // User entered different litres (split receipt) — calculate from price
        entryCost = (parsedLitres || 0) * (linePpl || 0) || null;
      }
      return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        submittedAt: now,
        ...driverFieldsFor(`${form.driverFirstName.trim()} ${form.driverLastName.trim()}`.trim()),
        registration: rego,
        division: division || getDivision(vehicleType),
        vehicleType,
        odometer: parseFloat(odometer) || null,
        date,
        litres: parsedLitres,
        pricePerLitre: linePpl,
        totalCost: entryCost,
        station,
        fuelType: lineFuelType,
        fleetCardNumber: cardNum || regoMatch?.c || "",
        cardRego: cardVeh,
        fleetCardVehicle: cardVeh,
        fleetCardDriver: regoMatch?.dr || "",
        vehicleName: regoMatch?.n || "",
        splitReceipt: splitMode || false,
        splitGroup: splitGroupId,
        hasReceipt: !!receiptB64,
        _aiConfidence: receiptData?.confidence?.overall || null,
        _aiIssues: [...(receiptData?.confidence?.issues || []), ...(receiptData?._mathIssues || [])],
        // _cardConfidence now tracks the AI's own confidence in its read,
        // NOT the matcher's confidence. This is what the "Fleet card unclear"
        // admin flag fires on — we want to know when the SCANNER was unsure,
        // not when the matcher couldn't map a confident scan.
        _cardConfidence: cardData?._aiConfidence || null,
        _cardMatchConfidence: cardData?._matchConfidence || null,
        _cardCorrected: !!cardData?._corrected,
        _cardConfusable: cardData?._confusableRegos || null,
        _cardOriginalCard: cardData?._originalCard || null,
        _cardOriginalRego: cardData?._originalRego || null,
        _cardRawRead: cardData?._rawCardRead || null,
        _cardAiIssues: cardData?._aiIssues || null,
        _reviewConfirmed: needsReviewConfirmation ? reviewConfirmed : null, // null=clean scan, true=user confirmed a suspect scan
      };
    };

    // Primary vehicle entry — match to first scanned fuel line
    const primaryMatch = form._regoMatch;
    const primaryLine = scannedLines[nextLineIdx] || null;
    if (primaryLine) nextLineIdx++;
    const primaryLitres = splitMode
      ? (parseFloat(form.litres) || primaryLine?.litres || ((parsedLitresTotal || 0) - splits.reduce((s, sp) => s + (parseFloat(sp.litres) || 0), 0)))
      : (parseFloat(form.litres) || primaryLine?.litres || parsedLitresTotal);
    // ALWAYS pass the primary fuel line data (not just in split mode)
    // so buildEntry can use its cost/price instead of the global ppl
    // Pass user-entered price per litre so it takes precedence over AI scan
    const userEnteredPpl = parseFloat(form.ppl) || null;
    const primaryEntry = buildEntry(
      form.registration.trim().toUpperCase(),
      form.division, form.vehicleType,
      form.odometer, primaryLitres, primaryMatch, primaryLine, userEnteredPpl
    );

    // Use the ref rather than closure `entries` — the submit handler was
    // bound at render time; a cloud refresh since then would silently be lost
    // if we built the new array off the stale state value.
    let allNew = entriesRef.current;
    const createdIds = [];
    allNew = insertChronological(allNew, primaryEntry);
    createdIds.push(primaryEntry.id);
    learnFromSubmission(primaryEntry);

    // Split entries — match using price/litres hints when available, otherwise by order
    if (splitMode) {
      // Build available (unconsumed) fuel lines for smart matching
      const availableLines = scannedLines.map((l, i) => ({ ...l, _idx: i })).filter((_, i) => i >= nextLineIdx);

      const findBestLine = (sp) => {
        if (availableLines.length === 0) return null;
        const spPpl = parseFloat(sp.ppl) || null;
        const spLitres = parseFloat(sp.litres) || null;
        const spType = sp.vehicleType || sp._match?.t || "Other";

        // If user entered a price, find the line closest to that price
        if (spPpl) {
          let best = null, bestDiff = Infinity;
          availableLines.forEach(l => {
            const lPpl = l.pricePerLitre || (l.cost && l.litres ? l.cost / l.litres : null);
            if (lPpl) {
              const diff = Math.abs(lPpl - spPpl);
              if (diff < bestDiff) { bestDiff = diff; best = l; }
            }
          });
          if (best && bestDiff < 1) {
            availableLines.splice(availableLines.indexOf(best), 1);
            return best;
          }
        }
        // If user entered litres, find the line closest to that litres
        if (spLitres) {
          let best = null, bestDiff = Infinity;
          availableLines.forEach(l => {
            if (l.litres) {
              const diff = Math.abs(l.litres - spLitres);
              if (diff < bestDiff) { bestDiff = diff; best = l; }
            }
          });
          if (best && bestDiff < spLitres * 0.3) {
            availableLines.splice(availableLines.indexOf(best), 1);
            return best;
          }
        }
        // Smart fallback 1: match by fuel type — if vehicle has a known fuel type, match to the scanned line with the same fuel type
        const spFuel = (sp.fuelType || sp._match?.f || "").toLowerCase();
        if (spFuel && availableLines.length > 1) {
          const fuelMatch = availableLines.find(l => {
            const lFuel = (l.fuelType || "").toLowerCase();
            if (!lFuel) return false;
            // Match diesel variants together, unleaded/petrol variants together
            const isDiesel = (f) => /diesel|gas\s*oil/i.test(f);
            const isUnleaded = (f) => /unleaded|petrol|premium\s*\d|e10|ulp|pulp|95|98/i.test(f);
            if (isDiesel(spFuel) && isDiesel(lFuel)) return true;
            if (isUnleaded(spFuel) && isUnleaded(lFuel)) return true;
            return lFuel.includes(spFuel) || spFuel.includes(lFuel);
          });
          if (fuelMatch) {
            availableLines.splice(availableLines.indexOf(fuelMatch), 1);
            return fuelMatch;
          }
        }
        // Smart fallback 2: match by vehicle size — larger vehicles get higher litres
        if (availableLines.length > 1) {
          const rank = VEHICLE_FUEL_RANK[spType] || 99;
          // Large vehicles (rank 1-5) get the highest litre line, small ones get the lowest
          const sorted = [...availableLines].sort((a, b) => (b.litres || 0) - (a.litres || 0));
          const best = rank <= 5 ? sorted[0] : sorted[sorted.length - 1];
          if (best) {
            availableLines.splice(availableLines.indexOf(best), 1);
            return best;
          }
        }
        // Final fallback: next available in order
        return availableLines.shift() || null;
      };

      for (const sp of splits) {
        if (sp.splitType === "other") {
          if (!sp.equipment) continue;
          // Match otherItem by description similarity (not just index)
          const equipLower = (sp.equipment || "").toLowerCase().trim();
          let matchedOther = null;
          for (let oi = nextOtherIdx; oi < scannedOtherItems.length; oi++) {
            const desc = (scannedOtherItems[oi]?.description || "").toLowerCase();
            if (desc.includes(equipLower) || equipLower.includes(desc) ||
                (equipLower === "adblue" && /adblue|ad[\s-]*blue|def|urea/i.test(desc))) {
              matchedOther = scannedOtherItems[oi];
              if (oi === nextOtherIdx) nextOtherIdx++;
              break;
            }
          }
          if (!matchedOther && nextOtherIdx < scannedOtherItems.length) {
            matchedOther = scannedOtherItems[nextOtherIdx++];
          }
          const isFuelOther = FUEL_EQUIPMENT_RE.test(sp.equipment);
          const matchedFuelLine = isFuelOther ? findBestLine(sp) : null;

          let equipDesc = sp.equipment.trim();
          let notes = sp.notes || "";
          let entryPpl = ppl;
          let cost = null;
          let entryLitres = parseFloat(sp.litres) || null;

          if (matchedOther && !isFuelOther) {
            equipDesc = `${sp.equipment.trim()} \u2014 ${matchedOther.description}`;
            cost = matchedOther.cost || null;
            entryLitres = matchedOther.litres || entryLitres;
            entryPpl = matchedOther.pricePerLitre || (matchedOther.litres > 0 && matchedOther.cost > 0 ? parseFloat((matchedOther.cost / matchedOther.litres).toFixed(4)) : null);
            notes = notes || `${matchedOther.description}${matchedOther.quantity ? " (" + matchedOther.quantity + ")" : ""} \u2014 $${matchedOther.cost?.toFixed(2) || "?"}`;
          } else if (matchedFuelLine) {
            entryLitres = matchedFuelLine.litres || entryLitres;
            entryPpl = matchedFuelLine.pricePerLitre || parseFloat(sp.ppl) || ppl;
            cost = matchedFuelLine.cost || ((entryLitres || 0) * (entryPpl || 0)) || null;
            if (matchedFuelLine.fuelType) notes = notes || `Fuel: ${matchedFuelLine.fuelType}`;
          } else {
            const userPpl = parseFloat(sp.ppl) || ppl;
            cost = (entryLitres || 0) * (userPpl || 0) || null;
            entryPpl = userPpl;
          }

          // User override from review step takes priority
          if (sp._costOverride) cost = parseFloat(sp._costOverride) || cost;
          if (sp._pplOverride) entryPpl = parseFloat(sp._pplOverride) || entryPpl;

          // Link AdBlue/other items to the primary vehicle from this receipt
          const linkedRego = form.registration?.trim().toUpperCase() || null;

          const otherSplitEntry = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            submittedAt: now,
            entryType: "other",
            division: form.division || "Tree",
            ...driverFieldsFor(`${form.driverFirstName.trim()} ${form.driverLastName.trim()}`.trim()),
            equipment: equipDesc,
            station,
            fleetCardNumber: cardNum,
            cardRego: cardVeh,
            date,
            litres: entryLitres,
            pricePerLitre: entryPpl,
            totalCost: cost,
            fuelType: sp._fuelTypeOverride || matchedFuelLine?.fuelType || (matchedOther ? matchedOther.description : baseFuelType),
            notes,
            splitReceipt: true,
            splitGroup: splitGroupId,
            hasReceipt: !!receiptB64,
            linkedVehicle: linkedRego,
          };
          allNew = [...allNew, otherSplitEntry];
          createdIds.push(otherSplitEntry.id);
        } else {
          // Vehicle split → match to best fuel line using price/litres hints
          if (!sp.rego) continue;
          const matchedLine = findBestLine(sp);
          const match = lookupRego(sp.rego, learnedDBRef.current, entriesRef.current) || sp._match;
          // Determine litres: user-entered → matched scanned line → remainder calculation → 0
          let spLitresVal = parseFloat(sp.litres) || 0;
          if (!spLitresVal && matchedLine?.litres) {
            // AI scanned line has litres — use them directly (no user input needed)
            spLitresVal = matchedLine.litres;
          }
          if (!spLitresVal && parsedLitresTotal > 0) {
            // Fallback: calculate remainder from total minus all other known litres
            const v1Used = parseFloat(form.litres) || primaryLine?.litres || 0;
            const otherSplitsUsed = splits.filter(s => s.splitType === "vehicle" && s.id !== sp.id).reduce((s, o) => {
              // Use user-entered litres, or the matched line's litres if available
              const userL = parseFloat(o.litres) || 0;
              if (userL > 0) return s + userL;
              // Check if this split's scanned line has litres
              const oLine = o._matchedLine;
              return s + (oLine?.litres || 0);
            }, 0);
            const remainder = parseFloat((parsedLitresTotal - v1Used - otherSplitsUsed).toFixed(2));
            if (remainder > 0) spLitresVal = remainder;
          }
          const spUserPpl = parseFloat(sp.ppl) || null;
          const splitEntry = buildEntry(
            sp.rego.trim().toUpperCase(),
            sp.division || match?.d || "",
            sp.vehicleType || match?.t || "",
            sp.odometer, spLitresVal || 0, match, matchedLine, spUserPpl
          );
          if (sp._costOverride) splitEntry.totalCost = parseFloat(sp._costOverride) || splitEntry.totalCost;
          if (sp._pplOverride) splitEntry.pricePerLitre = parseFloat(sp._pplOverride) || splitEntry.pricePerLitre;
          if (sp._fuelTypeOverride) splitEntry.fuelType = sp._fuelTypeOverride;
          if (sp._vehicleOverride) splitEntry.vehicleType = sp._vehicleOverride;
          allNew = insertChronological(allNew, splitEntry);
          createdIds.push(splitEntry.id);
          learnFromSubmission(splitEntry);
        }
      }
    }

    await persist(allNew);
    // Sync all new entries to cloud
    for (const eid of createdIds) {
      const entry = allNew.find(e => e.id === eid);
      if (entry) db.saveEntry(entry).catch(() => {});
    }
    // Save receipt image for all entries from this submission
    if (receiptB64) {
      for (const eid of createdIds) {
        await saveReceiptImage(eid, receiptB64, receiptMime);
      }
    }

    // ── Auto-detect extra receipt lines that the user didn't account for ──
    // If user only entered 1 vehicle (no split mode) but receipt has multiple fuel lines or other items,
    // auto-create draft entries and prompt the user to verify them on Step 4.
    if (!splitMode && scannedLines.length > 0) {
      const extraFuelLines = scannedLines.slice(1); // line 0 was used for primary vehicle
      const extraOtherItems = scannedOtherItems; // none were consumed in non-split mode
      const now2 = new Date().toISOString();

      if (extraFuelLines.length > 0 || extraOtherItems.length > 0) {
        const extras = [];
        extraFuelLines.forEach((line, i) => {
          extras.push({
            _draftId: `draft-fuel-${Date.now()}-${i}`,
            _type: "vehicle",
            _sourceLabel: line.fuelType || "Fuel",
            _line: line,
            // Propagate split-group so the pending-extras entry (when later
            // confirmed via savePendingExtra) shares the primary entry's group.
            _splitGroup: splitGroupId,
            rego: "",
            division: "",
            vehicleType: "",
            odometer: "",
            litres: line.litres || null,
            pricePerLitre: line.pricePerLitre || null,
            cost: line.cost || null,
            fuelType: line.fuelType || "",
            date: receiptData?.date || "",
            station: receiptData?.station || "",
            driverFirstName: form.driverFirstName?.trim() || "",
            driverLastName: form.driverLastName?.trim() || "",
            fleetCardNumber: cardNum || "",
            _confirmed: false,
          });
        });
        extraOtherItems.forEach((item, i) => {
          extras.push({
            _draftId: `draft-other-${Date.now()}-${i}`,
            _type: "other",
            _sourceLabel: item.description || "Other item",
            _item: item,
            _splitGroup: splitGroupId,
            equipment: item.description || "",
            litres: item.litres || null,
            pricePerLitre: item.pricePerLitre || null,
            cost: item.cost || null,
            date: receiptData?.date || "",
            station: receiptData?.station || "",
            driverFirstName: form.driverFirstName?.trim() || "",
            driverLastName: form.driverLastName?.trim() || "",
            division: form.division || "Tree",
            linkedVehicle: form.registration?.trim().toUpperCase() || "",
            _confirmed: false,
          });
        });
        setPendingExtraEntries(extras);
      }
    }

    setSaving(false);
    setStep(4);
  };

  // Collect the resolved-flag IDs that belong to a given entry, so deleting
  // the entry also cleans up its flag-resolution state. Without this, the
  // resolvedFlags table grows forever, and if a later entry ever produces
  // the same rego+date+odo tuple it would auto-inherit the stale resolution.
  const collectOrphanFlagIds = (entry) => {
    if (!entry) return [];
    const rego = entry.registration || "";
    const date = entry.date || "";
    const odo = entry.odometer != null ? String(entry.odometer) : "";
    const orphans = [];
    for (const fid of Object.keys(resolvedFlags)) {
      // flagId format: `${rego}::${text}::${date}::${odo}` — text may contain
      // "::", so split by it and take first/last fields only.
      const parts = fid.split("::");
      if (parts.length < 4) continue;
      const fRego = parts[0];
      const fOdo = parts[parts.length - 1];
      const fDate = parts[parts.length - 2];
      if (fRego === rego && fDate === date && fOdo === odo) orphans.push(fid);
    }
    return orphans;
  };

  // Soft-delete: the entry moves to the Recently Deleted bin (trash) rather
  // than being permanently erased. Admin can restore from there for the
  // next 30 days, after which it's auto-purged. The row IS removed from
  // Supabase's `entries` table immediately — the trash copy, kept in the
  // `trash_entries` app_setting, is the authoritative record while in the
  // bin. Receipt images are preserved until the trash entry is purged so
  // restore brings back the full record.
  const deleteEntry = async (id) => {
    // Read from the ref, not the closure-captured `entries` — a Realtime
    // refresh between render and click would otherwise make us persist a
    // stale array and silently delete entries added on other devices.
    const entry = entriesRef.current.find(e => e.id === id);
    if (!entry) return;
    const orphanFlags = collectOrphanFlagIds(entry);
    // Stamp the entry with deletion metadata and push onto the top of the
    // trash (newest-first ordering, same as everywhere else in the app).
    const trashed = { ...entry, _deletedAt: new Date().toISOString() };
    await persistTrash([trashed, ...trashEntriesRef.current]);
    await persist(entriesRef.current.filter(e => e.id !== id));
    db.deleteEntry(id).catch(() => {});
    // NOTE: deliberately do NOT delete the receipt image — restore needs it.
    // The image is wiped in purgeFromTrash / auto-purge instead.
    // Cleanup orphan flag resolutions so they can't silently auto-resolve a
    // future entry that happens to share this entry's rego+date+odo tuple.
    if (orphanFlags.length > 0) {
      const rest = { ...resolvedFlags };
      orphanFlags.forEach(fid => { delete rest[fid]; });
      await persistResolved(rest);
      orphanFlags.forEach(fid => db.deleteResolvedFlag(fid).catch(() => {}));
    }
    showToast("Entry moved to Recently Deleted \u00B7 restore from the Data tab");
  };

  // Pull an entry back out of the trash and reinstate it. Strips the
  // _deletedAt stamp and persists the entry back to Supabase.
  const restoreFromTrash = async (id) => {
    const trashed = trashEntriesRef.current.find(e => e.id === id);
    if (!trashed) return;
    // eslint-disable-next-line no-unused-vars
    const { _deletedAt, ...restored } = trashed;
    await persist([...entriesRef.current, restored], restored);
    await persistTrash(trashEntriesRef.current.filter(e => e.id !== id));
    showToast(`Restored entry for ${restored.registration || restored.equipment || "entry"}`);
  };

  // Permanently delete a trashed entry. Also wipes the receipt image so the
  // storage quota isn't held by an un-restorable item.
  const purgeFromTrash = async (id) => {
    await persistTrash(trashEntriesRef.current.filter(e => e.id !== id));
    try { await deleteReceiptImage(id); } catch (_) {}
    showToast("Entry permanently deleted");
  };

  const updateEntry = async (updatedEntry) => {
    // entriesRef.current reflects any cloud changes that arrived after this
    // handler was bound — using the stale closure would drop those changes.
    const newEntries = entriesRef.current.map(e => e.id === updatedEntry.id ? updatedEntry : e);
    // Re-sort this vehicle's entries by odometer
    const rego = updatedEntry.registration;
    const regoEntries = newEntries.filter(e => e.registration === rego).sort(sortEntries);
    // Rebuild: keep other entries in place, weave sorted rego entries back in
    const result = [];
    let ri = 0;
    for (const e of newEntries) {
      if (e.registration !== rego) result.push(e);
      else if (ri < regoEntries.length) result.push(regoEntries[ri++]);
    }
    await persist(result, updatedEntry);
    learnFromSubmission(updatedEntry);
    showToast("Entry updated");
  };

  // Bulk update fleet card details across all entries with that card number
  const updateCardDetails = async (oldCardNum, newCardNum, newRego) => {
    const oldKey = oldCardNum.replace(/\s/g, "");
    const newKey = newCardNum.replace(/\s/g, "");
    const updated = entriesRef.current.map(e => {
      const entryCard = (e.fleetCardNumber || e.cardNumber || "").replace(/\s/g, "");
      if (entryCard !== oldKey) return e;
      const u = { ...e };
      if (newKey && newKey !== oldKey) {
        u.fleetCardNumber = newKey;
        u.cardNumber = newKey;
      }
      if (newRego !== undefined) {
        u.cardRego = newRego.toUpperCase();
        u.vehicleOnCard = newRego.toUpperCase();
      }
      return u;
    });
    await persist(updated);
    // Update each affected entry in Supabase
    for (const e of updated) {
      const entryCard = (e.fleetCardNumber || e.cardNumber || "").replace(/\s/g, "");
      if (entryCard === newKey) db.saveEntry(e).catch(() => {});
    }
    showToast(`Updated card ...${newKey.slice(-6)}`);
  };

  // Soft-delete a driver: rename every entry assigned to them to
  // "*DELETED_(Name)*" but keep the historical fuel data intact. The driver
  // disappears from the active Drivers tab list and shows up in the
  // "Deleted drivers archive" collapsible at the bottom — admin can
  // Restore from there to bring them back. Their litres / cost still roll
  // up to the dashboard totals (under the ghost name) so historical reports
  // stay accurate. The merged *DELETED_* prefix is intentionally ugly so it
  // sticks out if it ever shows up somewhere unexpected.
  const deleteDriver = (driver) => {
    if (!driver || !driver.entries) return;
    const safeName = (driver.name || "Unknown").trim();
    const newName = `${DELETED_DRIVER_PREFIX}${safeName}${DELETED_DRIVER_SUFFIX}`;
    const count = driver.entries.length;
    setConfirmAction({
      message: `Delete driver "${safeName}"?\n\nTheir ${count} entr${count === 1 ? "y" : "ies"} will stay in the system but the driver name will be marked as deleted so historical totals stay intact. They'll move from the active Drivers list into the "Deleted drivers archive" at the bottom of the Drivers tab — you can restore them from there if needed.`,
      onConfirm: async () => {
        const driverEntryIds = new Set(driver.entries.map(e => e.id).filter(Boolean));
        if (driverEntryIds.size === 0) { setConfirmAction(null); return; }
        const modified = [];
        const updated = entriesRef.current.map(e => {
          if (!driverEntryIds.has(e.id)) return e;
          const next = { ...e, driverName: newName, _driverNameResolution: null };
          modified.push(next);
          return next;
        });
        // Local + storage update for instant UI feedback
        entriesRef.current = updated;
        setEntries(updated);
        try { await window.storage.set("fuel_entries", JSON.stringify(updated)); } catch (_) {}
        // Cloud-save each rewritten entry. Mark as pending so the post-
        // confirm refresh can't replay stale cloud data and undo the rename.
        for (const e of modified) {
          pendingEntrySavesRef.current.add(e.id);
          db.saveEntry(e).catch(() => {}).finally(() => {
            pendingEntrySavesRef.current.delete(e.id);
          });
        }
        setConfirmAction(null);
        setExpandedDriver(null);
        showToast(`Driver "${safeName}" archived · ${modified.length} entr${modified.length === 1 ? "y" : "ies"} preserved`);
      },
    });
  };

  // Restore a previously-deleted driver: strip the *DELETED_…* wrapper from
  // every matching entry and re-save. Inverse of `deleteDriver`. Useful when
  // an admin deleted the wrong driver, or when a name returns to active
  // duty. Only restores entries that match the EXACT *DELETED_<name>*
  // string we're restoring — won't accidentally pull in a different
  // deleted driver with a similar name.
  const restoreDriver = (deletedDriver) => {
    if (!deletedDriver || !deletedDriver.entries) return;
    const original = originalDriverName(deletedDriver.name);
    const count = deletedDriver.entries.length;
    setConfirmAction({
      message: `Restore "${original}"?\n\nTheir ${count} entr${count === 1 ? "y" : "ies"} will move back to the active Drivers list under the original name "${original}".`,
      onConfirm: async () => {
        const driverEntryIds = new Set(deletedDriver.entries.map(e => e.id).filter(Boolean));
        if (driverEntryIds.size === 0) { setConfirmAction(null); return; }
        const modified = [];
        const updated = entriesRef.current.map(e => {
          if (!driverEntryIds.has(e.id)) return e;
          const next = { ...e, driverName: original };
          modified.push(next);
          return next;
        });
        entriesRef.current = updated;
        setEntries(updated);
        try { await window.storage.set("fuel_entries", JSON.stringify(updated)); } catch (_) {}
        for (const e of modified) {
          pendingEntrySavesRef.current.add(e.id);
          db.saveEntry(e).catch(() => {}).finally(() => {
            pendingEntrySavesRef.current.delete(e.id);
          });
        }
        setConfirmAction(null);
        showToast(`Driver "${original}" restored · ${modified.length} entr${modified.length === 1 ? "y" : "ies"}`);
      },
    });
  };

  // Persist the admin-curated alias map to local + cloud and update the
  // module-level mirror so future submissions resolve through it.
  const persistDriverAliases = async (next) => {
    setLearnedDriverAliases(next);
    setLearnedDriverAliasesDB(next);
    const json = JSON.stringify(next);
    try { await window.storage.set("fuel_learned_driver_aliases", json); } catch (_) {}
    try { await db.saveSetting("learned_driver_aliases", json); } catch (_) {}
  };

  // Bulk-rename every entry with driverName === fromName to canonical
  // toName, then store fromName -> toName in the alias map so any
  // FUTURE submissions of the source spelling auto-resolve to canonical.
  // Runs idempotently — calling with no entries to rename just saves
  // the alias and toasts "0 entries renamed".
  const mergeDriverNames = async (fromName, toName) => {
    const from = (fromName || "").trim();
    const to = (toName || "").trim();
    if (!from || !to) return { count: 0 };
    if (from.toLowerCase() === to.toLowerCase()) return { count: 0 };

    const fromLower = from.toLowerCase();
    const modified = [];
    const updated = entriesRef.current.map(e => {
      const dn = (e.driverName || e.driver || "").trim().toLowerCase();
      if (dn !== fromLower) return e;
      const next = { ...e, driverName: to, _driverNameResolution: null };
      modified.push(next);
      return next;
    });

    if (modified.length > 0) {
      entriesRef.current = updated;
      setEntries(updated);
      try { await window.storage.set("fuel_entries", JSON.stringify(updated)); } catch (_) {}
      // Cloud-save with pending tracking so the post-merge refresh can't
      // replay stale rows and undo the rename (mirrors the race fix from
      // commit 11ee76c).
      for (const e of modified) {
        pendingEntrySavesRef.current.add(e.id);
        db.saveEntry(e).catch(() => {}).finally(() => {
          pendingEntrySavesRef.current.delete(e.id);
        });
      }
    }

    // Always remember the alias — even when 0 entries match (admin can
    // pre-register a future-proof mapping for typos that haven't appeared
    // in the data yet).
    const nextAliases = { ...learnedDriverAliases, [fromLower]: to };
    await persistDriverAliases(nextAliases);

    showToast(`Merged "${from}" → "${to}" · ${modified.length} entr${modified.length === 1 ? "y" : "ies"} renamed`);
    return { count: modified.length };
  };

  const removeDriverAlias = async (fromKey) => {
    if (!fromKey) return;
    // eslint-disable-next-line no-unused-vars
    const { [fromKey]: _removed, ...rest } = learnedDriverAliases;
    await persistDriverAliases(rest);
    showToast(`Removed alias for "${fromKey}"`);
  };

  const deleteVehicle = (rego) => {
    setConfirmAction({
      message: `Delete ALL entries for ${rego}? This cannot be undone.`,
      onConfirm: async () => {
        // Delete all entries for this vehicle from cloud. Read from the ref
        // so a cloud refresh between click and confirm doesn't strand entries
        // added from other devices.
        const current = entriesRef.current;
        const toDelete = current.filter(e => e.registration === rego);
        // Collect orphan flag IDs for every entry we're deleting, so we can
        // purge resolvedFlags in one pass after the entry persist.
        const orphanFlags = new Set();
        toDelete.forEach(e => collectOrphanFlagIds(e).forEach(fid => orphanFlags.add(fid)));
        for (const e of toDelete) { db.deleteEntry(e.id).catch(() => {}); }
        await persist(current.filter(e => e.registration !== rego));
        if (orphanFlags.size > 0) {
          const rest = { ...resolvedFlags };
          orphanFlags.forEach(fid => { delete rest[fid]; });
          await persistResolved(rest);
          orphanFlags.forEach(fid => db.deleteResolvedFlag(fid).catch(() => {}));
        }
        if (serviceData[rego]) {
          const { [rego]: _, ...rest } = serviceData;
          await persistService(rest);
        }
        const currentDB = learnedDBRef.current;
        if (currentDB[rego]) {
          const { [rego]: _, ...rest } = currentDB;
          await persistLearned(rest);
        }
        setExpandedRego(null);
        setConfirmAction(null);
        showToast(`All entries for ${rego} deleted`);
      },
    });
  };

  const saveVehicleEdit = async (rego, newDivision, newVehicleType, newRego, newVehicleName) => {
    const finalRego = (newRego || rego).toUpperCase().replace(/[^A-Z0-9]/g, "");
    const renaming = finalRego && finalRego !== rego;
    const cleanName = (newVehicleName || "").trim();
    // Guard: block a rename that collides with an existing different vehicle's learnedDB entry
    if (renaming && learnedDBRef.current[finalRego]) {
      showToast(`${finalRego} already exists in vehicle database`, "warn");
      return;
    }
    // entriesRef.current reflects the latest cloud state — the edit modal
    // was open while refresh was paused, but we still prefer the ref for
    // consistency with all other save paths.
    const updated = entriesRef.current.map(e =>
      e.registration === rego
        ? { ...e, registration: finalRego, division: newDivision, vehicleType: newVehicleType, vehicleName: cleanName || e.vehicleName || "" }
        : e
    );
    await persist(updated);
    // Sync updated entries to cloud (all entries that now have finalRego and were originally rego)
    updated.filter(e => e.registration === finalRego).forEach(e => db.saveEntry(e).catch(() => {}));
    // Update learnedDB: move old rego key to new rego key if renaming
    const currentDB = learnedDBRef.current;
    const existing = currentDB[rego] || {};
    let newLearned;
    if (renaming) {
      const { [rego]: _oldKey, ...rest } = currentDB;
      newLearned = { ...rest, [finalRego]: { ...existing, ...(rest[finalRego] || {}), t: newVehicleType, d: newDivision, n: cleanName || existing.n || rest[finalRego]?.n || "" } };
    } else {
      newLearned = { ...currentDB, [rego]: { ...existing, t: newVehicleType, d: newDivision, n: cleanName || existing.n || "" } };
    }
    await persistLearned(newLearned);
    setEditingVehicle(null);
    if (renaming) showToast(`${rego} renamed to ${finalRego} (${newDivision} / ${newVehicleType})`);
    else showToast(`${rego} updated to ${newDivision} / ${newVehicleType}`);
  };

  // ── Render steps ──────────────────────────────────────────────────────────
  const addSplit = (type) => setSplits(prev => [...prev, {
    id: Date.now().toString(), splitType: type || "vehicle",
    rego: "", odometer: "", litres: "", ppl: "", division: "", vehicleType: "", _match: null,
    equipment: "", fleetCard: "", cardRego: "", notes: "",
  }]);
  const removeSplit = (id) => { setSplits(prev => prev.filter(s => s.id !== id)); if (splits.length <= 1) setSplitMode(false); };
  const updateSplit = (id, field, value) => {
    setSplits(prev => prev.map(s => {
      if (s.id !== id) return s;
      const updated = { ...s, [field]: value };
      if (field === "rego" && s.splitType === "vehicle") {
        const isTypingMore = value.length > (s.rego || "").length;
        const match = lookupRego(value, learnedDBRef.current, entriesRef.current);
        updated._match = match || null;
        if (match) {
          // Only auto-fill when typing forward, not when deleting/editing
          updated.rego = (isTypingMore && match.r && match.r.length > value.length) ? match.r : value;
          updated.division = match.d;
          updated.vehicleType = match.t;
        }
      }
      return updated;
    }));
  };

  // Equipment presets split into two categories with different entry formats
  // FUEL category: recorded like a fuel entry (litres, $/L, total cost)
  const FUEL_EQUIPMENT = [
    { label: "Chainsaws", icon: "\uD83E\uDE93" },
    { label: "Jerry Can", icon: "\uD83D\uDEE2" },
    { label: "Fuel Cell/Pod", icon: "\u26FD" },
    { label: "Leaf Blower", icon: "\uD83C\uDF43" },
    { label: "AdBlue", icon: "\uD83D\uDCA7" },
    { label: "Hire Equipment", icon: "\uD83D\uDD27" },
    { label: "2 Stroke Fuel", icon: "\u26FD" },
  ];
  // OIL/PRODUCT category: recorded like a retail purchase (quantity, price)
  const OIL_PRODUCTS = [
    { label: "2 Stroke Oil", icon: "\uD83D\uDEE2" },
    { label: "Engine Oil", icon: "\uD83D\uDEE2" },
    { label: "Chain & Bar Oil", icon: "\uD83D\uDEE2" },
    { label: "Hydraulic Oil", icon: "\uD83D\uDEE2" },
    { label: "Gear Oil", icon: "\uD83D\uDEE2" },
    { label: "Other Oil", icon: "\uD83D\uDEE2" },
  ];
  const ALL_EQUIPMENT_PRESETS = [...FUEL_EQUIPMENT, ...OIL_PRODUCTS];
  const isOilProduct = (equip) => OIL_PRODUCTS.some(o => o.label.toLowerCase() === (equip || "").toLowerCase());

// Equipment types that consume FUEL (not oil/adblue) — used to match "other" splits to fuel lines vs otherItems
const FUEL_EQUIPMENT_RE = /jerry|2.?stroke.?fuel|stump|leaf.?blow|chainsaw|fuel.?cell|fuel.?pod|mower|hedger|hire/i;

  const renderStep1 = () => {
    const activeDivision = form.division ? DIVISIONS[form.division] : null;
    const divTypes = activeDivision ? activeDivision.types : [];

    return (
      <div className="fade-in">
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>
            {otherMode ? "Oil & Other Fuel Claim" : `Driver & Vehicle${splitMode ? "s" : ""}`}
          </div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>
            {otherMode ? "For non-vehicle fuel \u2014 jerry cans, chainsaws, 2 stroke, oil, etc." : "Enter the details for this fuel stop"}
          </div>
        </div>

        {/* Vehicle / Other toggle */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          <button onClick={() => { setOtherMode(false); setSplitMode(false); setSplits([]); setError(""); }} style={{
            flex: 1, padding: "10px 14px", borderRadius: 8, fontSize: 13, cursor: "pointer",
            fontFamily: "inherit", fontWeight: !otherMode ? 700 : 500,
            background: !otherMode ? "#f0fdf4" : "white", color: !otherMode ? "#15803d" : "#64748b",
            border: `2px solid ${!otherMode ? "#86efac" : "#e2e8f0"}`, transition: "all 0.15s",
          }}>{"\uD83D\uDE97"} Vehicle</button>
          <button onClick={() => { setOtherMode(true); setSplitMode(false); setSplits([]); setError(""); }} style={{
            flex: 1, padding: "10px 14px", borderRadius: 8, fontSize: 13, cursor: "pointer",
            fontFamily: "inherit", fontWeight: otherMode ? 700 : 500,
            background: otherMode ? "#fefce8" : "white", color: otherMode ? "#854d0e" : "#64748b",
            border: `2px solid ${otherMode ? "#fde047" : "#e2e8f0"}`, transition: "all 0.15s",
          }}>{"\u26FD"} Oil & Other</button>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <FieldInput label="First Name" value={form.driverFirstName} onChange={v => {
              const capitalized = v.charAt(0).toUpperCase() + v.slice(1);
              setForm(f => ({ ...f, driverFirstName: capitalized }));
            }} placeholder="e.g. Jason" required />
          </div>
          <div style={{ flex: 1 }}>
            <FieldInput label="Last Name" value={form.driverLastName} onChange={v => {
              const capitalized = v.charAt(0).toUpperCase() + v.slice(1);
              setForm(f => ({ ...f, driverLastName: capitalized }));
            }} placeholder="e.g. Johnston" required />
          </div>
        </div>

        {/* Save my details */}
        {savedDriver ? (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "6px 10px", background: "#f0fdf4", border: "1px solid #86efac",
            borderRadius: 6, marginBottom: 14, fontSize: 11,
          }}>
            <span style={{ color: "#15803d" }}>
              {"\u2713"} Saved: <strong>{savedDriver.name}</strong>
              {savedDriver.rego && <span> {"\u00B7"} {savedDriver.rego}</span>}
            </span>
            <button onClick={async () => {
              setSavedDriver(null);
              try { await window.storage.delete("fuel_saved_driver"); } catch (_) {}
              showToast("Saved details cleared");
            }} style={{ background: "none", border: "1px solid #86efac", borderRadius: 4, color: "#15803d", cursor: "pointer", fontSize: 10, fontFamily: "inherit", fontWeight: 500, padding: "2px 8px" }}>Forget me</button>
          </div>
        ) : (
          <button onClick={async () => {
            const firstName = form.driverFirstName.trim();
            const lastName = form.driverLastName.trim();
            const rego = form.registration.trim().toUpperCase();
            if (!firstName || !lastName) { showToast("Enter your first and last name first", "warn"); return; }
            const profile = { name: `${firstName} ${lastName}`, firstName, lastName, rego: rego || null };
            setSavedDriver(profile);
            try { await window.storage.set("fuel_saved_driver", JSON.stringify(profile)); } catch (_) {}
            showToast(`Details saved \u2014 your name${rego ? " and rego" : ""} will auto-fill next time`);
          }} style={{
            background: "none", border: "none", color: "#94a3b8", fontSize: 11,
            cursor: "pointer", padding: "0 0 12px 0", fontFamily: "inherit", fontWeight: 500,
          }}>{"\uD83D\uDCBE"} Remember my details on this device</button>
        )}

        {/* Recent entry indicator */}
        {(() => {
          const name = `${form.driverFirstName?.trim() || ""} ${form.driverLastName?.trim() || ""}`.trim();
          if (!name) return null;
          const driverEntries = entries.filter(e => e.driverName?.toUpperCase() === name.toUpperCase()).sort((a, b) => {
            const da = parseDate(a.date), db = parseDate(b.date);
            if (!da || !db) return 0;
            return new Date(db) - new Date(da);
          });
          if (driverEntries.length === 0) return null;
          const last = driverEntries[0];
          const lastDate = parseDate(last.date);
          const daysAgo = lastDate ? Math.round((new Date() - new Date(lastDate)) / 86400000) : null;
          const rego = last.entryType === "other" ? (last.equipment || "Other") : (last.registration || "");
          return (
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 12, padding: "6px 10px", background: "#f8fafc", borderRadius: 6, border: "1px solid #e2e8f0" }}>
              Last entry: <strong>{rego}</strong>
              {last.date && <span> {"\u00B7"} {last.date}</span>}
              {daysAgo != null && <span style={{ color: daysAgo > 14 ? "#b45309" : "#94a3b8" }}> ({daysAgo === 0 ? "today" : daysAgo === 1 ? "yesterday" : `${daysAgo} days ago`})</span>}
              {last.totalCost && <span> {"\u00B7"} ${parseFloat(last.totalCost).toFixed(2)}</span>}
            </div>
          );
        })()}

        {/* ═══ OTHER MODE ═══ */}
        {otherMode && (
          <>
            {/* Division selector */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, color: "#374151", fontWeight: 600, marginBottom: 6 }}>Division</label>
              <div style={{ display: "flex", gap: 8 }}>
                {["Tree", "Landscape"].map(d => (
                  <button key={d} onClick={() => setOtherForm(f => ({ ...f, division: d }))} style={{
                    flex: 1, padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                    cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                    background: otherForm.division === d ? (d === "Tree" ? "#f0fdf4" : "#faf5ff") : "white",
                    color: otherForm.division === d ? (d === "Tree" ? "#16a34a" : "#7c3aed") : "#94a3b8",
                    border: `2px solid ${otherForm.division === d ? (d === "Tree" ? "#16a34a" : "#7c3aed") : "#e2e8f0"}`,
                  }}>{d === "Tree" ? "\uD83C\uDF33" : "\uD83C\uDF3F"} {d}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, color: "#374151", fontWeight: 600, marginBottom: 6 }}>
                What is this entry for? <span style={{ color: "#ef4444" }}>*</span>
              </label>
              {/* Fuel-type items */}
              <div style={{ fontSize: 10, fontWeight: 600, color: "#854d0e", marginBottom: 4 }}>{"\u26FD"} Fuel Items</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
                {FUEL_EQUIPMENT.map(p => {
                  const selected = otherForm.equipment === p.label;
                  return (
                    <button key={p.label} onClick={() => setOtherForm(f => ({ ...f, equipment: selected ? "" : p.label }))} style={{
                      padding: "8px 14px", borderRadius: 10, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                      fontWeight: selected ? 700 : 500, transition: "all 0.15s",
                      background: selected ? "#fef3c7" : "white",
                      color: selected ? "#92400e" : "#78350f",
                      border: `2px solid ${selected ? "#f59e0b" : "#fde047"}`,
                      boxShadow: selected ? "0 0 0 2px rgba(245, 158, 11, 0.2)" : "none",
                    }}>{p.icon} {p.label}</button>
                  );
                })}
              </div>
              {/* Oil/product items */}
              <div style={{ fontSize: 10, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>{"\uD83D\uDEE2"} Oil & Products</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
                {OIL_PRODUCTS.map(p => {
                  const selected = otherForm.equipment === p.label;
                  return (
                    <button key={p.label} onClick={() => setOtherForm(f => ({ ...f, equipment: selected ? "" : p.label }))} style={{
                      padding: "8px 14px", borderRadius: 10, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                      fontWeight: selected ? 700 : 500, transition: "all 0.15s",
                      background: selected ? "#e0e7ff" : "white",
                      color: selected ? "#3730a3" : "#64748b",
                      border: `2px solid ${selected ? "#6366f1" : "#e2e8f0"}`,
                      boxShadow: selected ? "0 0 0 2px rgba(99, 102, 241, 0.2)" : "none",
                    }}>{p.icon} {p.label}</button>
                  );
                })}
              </div>
              {/* Custom entry fallback */}
              {!otherForm.equipment && (
                <input value={otherForm._customEquipment || ""} onChange={e => setOtherForm(f => ({ ...f, _customEquipment: e.target.value }))}
                  onBlur={e => { if (e.target.value.trim()) setOtherForm(f => ({ ...f, equipment: f._customEquipment.trim(), _customEquipment: "" })); }}
                  placeholder="Or type a custom item..."
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px dashed #e2e8f0", fontSize: 12, outline: "none", fontFamily: "inherit", color: "#64748b", boxSizing: "border-box" }}
                  onFocus={e => e.target.style.borderColor = "#fde047"} />
              )}
              {otherForm.equipment && (
                <div style={{ fontSize: 12, color: "#15803d", fontWeight: 600, marginTop: 4 }}>
                  {"\u2713"} Selected: {otherForm.equipment}
                </div>
              )}
            </div>

            {/* Conditional fields based on equipment type */}
            {otherForm.equipment && !isOilProduct(otherForm.equipment) && (
              /* FUEL-TYPE ENTRY: Litres + $/L + Total Cost */
              <div style={{ background: "#fffbeb", border: "1px solid #fde047", borderRadius: 10, padding: "12px", marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#92400e", marginBottom: 8 }}>{"\u26FD"} Fuel Details</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: "#374151", fontWeight: 600, marginBottom: 5 }}>Litres</label>
                    <input value={otherForm.litres} onChange={e => setOtherForm(f => ({ ...f, litres: e.target.value }))} placeholder="e.g. 13.03" type="number" inputMode="decimal"
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, outline: "none", fontFamily: "inherit", color: "#0f172a", background: "white" }}
                      onFocus={e => e.target.style.borderColor = "#fde047"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: "#374151", fontWeight: 600, marginBottom: 5 }}>$/L</label>
                    <input value={otherForm.ppl} onChange={e => setOtherForm(f => ({ ...f, ppl: e.target.value }))} placeholder="e.g. 1.999" type="number" inputMode="decimal"
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, outline: "none", fontFamily: "inherit", color: "#0f172a", background: "white" }}
                      onFocus={e => e.target.style.borderColor = "#fde047"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: "#374151", fontWeight: 600, marginBottom: 5 }}>Total Cost</label>
                    <input value={otherForm.totalCost} onChange={e => setOtherForm(f => ({ ...f, totalCost: e.target.value }))}
                      placeholder={(() => { const l = parseFloat(otherForm.litres) || 0; const p = parseFloat(otherForm.ppl) || 0; return l > 0 && p > 0 ? `$${(l * p).toFixed(2)}` : "e.g. 26.05"; })()}
                      type="number" inputMode="decimal"
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, outline: "none", fontFamily: "inherit", color: "#0f172a", background: "white" }}
                      onFocus={e => e.target.style.borderColor = "#fde047"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
                  </div>
                </div>
              </div>
            )}
            {otherForm.equipment && isOilProduct(otherForm.equipment) && (
              /* OIL/PRODUCT ENTRY: Quantity + Price (retail purchase format) */
              <div style={{ background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: 10, padding: "12px", marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#4338ca", marginBottom: 8 }}>{"\uD83D\uDEE2"} Product Purchase</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: "#374151", fontWeight: 600, marginBottom: 5 }}>Quantity</label>
                    <input value={otherForm.quantity || ""} onChange={e => setOtherForm(f => ({ ...f, quantity: e.target.value }))} placeholder="e.g. 2"
                      type="number" inputMode="numeric"
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, outline: "none", fontFamily: "inherit", color: "#0f172a", background: "white" }}
                      onFocus={e => e.target.style.borderColor = "#6366f1"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: "#374151", fontWeight: 600, marginBottom: 5 }}>Price ($)</label>
                    <input value={otherForm.totalCost} onChange={e => setOtherForm(f => ({ ...f, totalCost: e.target.value }))} placeholder="e.g. 19.98"
                      type="number" inputMode="decimal"
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, outline: "none", fontFamily: "inherit", color: "#0f172a", background: "white" }}
                      onFocus={e => e.target.style.borderColor = "#6366f1"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
                  </div>
                </div>
                <div style={{ fontSize: 10, color: "#64748b", marginTop: 6 }}>
                  {parseFloat(otherForm.quantity) > 0 && parseFloat(otherForm.totalCost) > 0 && (
                    <span>{"\u2192"} {otherForm.quantity}x {otherForm.equipment} @ ${(parseFloat(otherForm.totalCost) / parseFloat(otherForm.quantity)).toFixed(2)} each</span>
                  )}
                </div>
              </div>
            )}

            <FieldInput label="Petrol Station" value={otherForm.station}
              onChange={v => setOtherForm(f => ({ ...f, station: v }))} placeholder="e.g. BP Marsden Park" />

            <FieldInput label="Notes" value={otherForm.notes}
              onChange={v => setOtherForm(f => ({ ...f, notes: v }))} placeholder="e.g. Shell 2T 200ml $19.98, for truck XN07XY" />

            {/* ── Split: add more items from same receipt ── */}
            {splitMode && splits.map((sp, si) => {
              const isOther = sp.splitType === "other";
              const isVehicle = sp.splitType === "vehicle";
              const spMatch = sp._match;
              const borderColor = isVehicle ? "#e2e8f0" : "#fde047";
              const bgColor = isVehicle ? "#f8fafc" : "#fefce8";
              const labelColor = isVehicle ? "#1e40af" : "#854d0e";
              return (
                <div key={sp.id} className="fade-in" style={{
                  background: bgColor, border: `1px solid ${borderColor}`, borderRadius: 10,
                  padding: "12px 14px", marginBottom: 10,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: labelColor }}>
                      {isVehicle ? `\uD83D\uDE97 Vehicle ${si + 2}` : `\u26FD Other ${si + 2}`}
                    </span>
                    <button onClick={() => removeSplit(sp.id)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 16 }}>{"\u00D7"}</button>
                  </div>
                  {isVehicle ? (
                    <>
                      <div>
                        <label style={{ display: "block", fontSize: 11, color: "#374151", fontWeight: 600, marginBottom: 3 }}>Registration</label>
                        <input value={sp.rego} onChange={e => updateSplit(sp.id, "rego", e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6))} placeholder="e.g. AB12CD" maxLength={6}
                          style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 13, outline: "none", fontFamily: "inherit", color: "#0f172a", background: "white", textTransform: "uppercase" }}
                          onFocus={e => e.target.style.borderColor = "#22c55e"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 8 }}>
                        <div>
                          <label style={{ display: "block", fontSize: 11, color: "#374151", fontWeight: 600, marginBottom: 3 }}>{isHoursBased(sp.vehicleType) ? "Hour Meter" : "Odometer"}</label>
                          <input value={sp.odometer} onChange={e => updateSplit(sp.id, "odometer", e.target.value)} placeholder={isHoursBased(sp.vehicleType) ? "e.g. 4500" : "e.g. 23140"} type="number"
                            style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 13, outline: "none", fontFamily: "inherit", color: "#0f172a", background: "white" }}
                            onFocus={e => e.target.style.borderColor = "#22c55e"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: 11, color: "#374151", fontWeight: 600, marginBottom: 3 }}>Litres</label>
                          <input value={sp.litres} onChange={e => updateSplit(sp.id, "litres", e.target.value)} placeholder="e.g. 15.14" type="number"
                            style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 13, outline: "none", fontFamily: "inherit", color: "#0f172a", background: "white" }}
                            onFocus={e => e.target.style.borderColor = "#22c55e"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: 11, color: "#374151", fontWeight: 600, marginBottom: 3 }}>$/L <span style={{ fontWeight: 400, color: "#94a3b8" }}>(opt)</span></label>
                          <input value={sp.ppl || ""} onChange={e => updateSplit(sp.id, "ppl", e.target.value)} placeholder="e.g. 2.049" type="number" inputMode="decimal"
                            style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 13, outline: "none", fontFamily: "inherit", color: "#0f172a", background: "white" }}
                            onFocus={e => e.target.style.borderColor = "#22c55e"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label style={{ display: "block", fontSize: 11, color: "#374151", fontWeight: 600, marginBottom: 4 }}>What is this for?</label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
                          {ALL_EQUIPMENT_PRESETS.map(p => {
                            const selected = sp.equipment === p.label;
                            const isOil = OIL_PRODUCTS.some(o => o.label === p.label);
                            return (
                              <button key={p.label} onClick={() => updateSplit(sp.id, "equipment", selected ? "" : p.label)} style={{
                                padding: "5px 10px", borderRadius: 8, fontSize: 10, cursor: "pointer", fontFamily: "inherit",
                                fontWeight: selected ? 700 : 500, transition: "all 0.15s",
                                background: selected ? (isOil ? "#e0e7ff" : "#fef3c7") : "white",
                                color: selected ? (isOil ? "#3730a3" : "#92400e") : "#64748b",
                                border: `1.5px solid ${selected ? (isOil ? "#6366f1" : "#f59e0b") : "#e2e8f0"}`,
                              }}>{p.icon} {p.label}</button>
                            );
                          })}
                        </div>
                        {!sp.equipment && (
                          <input value={sp._customEquip || ""} onChange={e => updateSplit(sp.id, "_customEquip", e.target.value)}
                            onBlur={e => { if (e.target.value.trim()) { updateSplit(sp.id, "equipment", e.target.value.trim()); updateSplit(sp.id, "_customEquip", ""); }}}
                            placeholder="Or type a custom item..."
                            style={{ width: "100%", padding: "6px 10px", borderRadius: 7, border: "1px dashed #e2e8f0", fontSize: 11, outline: "none", fontFamily: "inherit", color: "#64748b", background: "white", boxSizing: "border-box" }} />
                        )}
                        {sp.equipment && <div style={{ fontSize: 11, color: "#15803d", fontWeight: 600 }}>{"\u2713"} {sp.equipment}</div>}
                      </div>
                      {/* Conditional fields: fuel vs oil/product */}
                      {sp.equipment && !isOilProduct(sp.equipment) && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 8 }}>
                          <div>
                            <label style={{ display: "block", fontSize: 10, color: "#374151", fontWeight: 600, marginBottom: 3 }}>Litres</label>
                            <input value={sp.litres} onChange={e => updateSplit(sp.id, "litres", e.target.value)} placeholder="e.g. 15.14" type="number"
                              style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 13, outline: "none", fontFamily: "inherit", color: "#0f172a", background: "white" }}
                              onFocus={e => e.target.style.borderColor = "#fde047"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 10, color: "#374151", fontWeight: 600, marginBottom: 3 }}>$/L <span style={{ fontWeight: 400, color: "#94a3b8" }}>(opt)</span></label>
                            <input value={sp.ppl || ""} onChange={e => updateSplit(sp.id, "ppl", e.target.value)} placeholder="e.g. 1.899" type="number" inputMode="decimal"
                              style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 13, outline: "none", fontFamily: "inherit", color: "#0f172a", background: "white" }}
                              onFocus={e => e.target.style.borderColor = "#fde047"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 10, color: "#374151", fontWeight: 600, marginBottom: 3 }}>Notes</label>
                            <input value={sp.notes || ""} onChange={e => updateSplit(sp.id, "notes", e.target.value)} placeholder="Optional"
                              style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 13, outline: "none", fontFamily: "inherit", color: "#0f172a", background: "white" }}
                              onFocus={e => e.target.style.borderColor = "#fde047"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
                          </div>
                        </div>
                      )}
                      {sp.equipment && isOilProduct(sp.equipment) && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                          <div>
                            <label style={{ display: "block", fontSize: 10, color: "#374151", fontWeight: 600, marginBottom: 3 }}>Quantity</label>
                            <input value={sp.quantity || ""} onChange={e => updateSplit(sp.id, "quantity", e.target.value)} placeholder="e.g. 2" type="number" inputMode="numeric"
                              style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 13, outline: "none", fontFamily: "inherit", color: "#0f172a", background: "white" }}
                              onFocus={e => e.target.style.borderColor = "#6366f1"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 10, color: "#374151", fontWeight: 600, marginBottom: 3 }}>Price ($)</label>
                            <input value={sp.ppl || ""} onChange={e => updateSplit(sp.id, "ppl", e.target.value)} placeholder="e.g. 19.98" type="number" inputMode="decimal"
                              style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 13, outline: "none", fontFamily: "inherit", color: "#0f172a", background: "white" }}
                              onFocus={e => e.target.style.borderColor = "#6366f1"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}

            {/* Add more buttons for split */}
            {splitMode && (
              <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                <button onClick={() => addSplit("vehicle")} style={{
                  flex: 1, padding: "8px 12px", borderRadius: 8, fontSize: 11,
                  cursor: "pointer", fontFamily: "inherit", fontWeight: 500,
                  background: "#f8fafc", color: "#64748b",
                  border: "1px dashed #cbd5e1",
                }}>{"\uD83D\uDE97"} + Vehicle</button>
                <button onClick={() => addSplit("other")} style={{
                  flex: 1, padding: "8px 12px", borderRadius: 8, fontSize: 11,
                  cursor: "pointer", fontFamily: "inherit", fontWeight: 500,
                  background: "#fefce8", color: "#854d0e",
                  border: "1px dashed #fde047",
                }}>{"\u26FD"} + Other Item</button>
              </div>
            )}

            {/* Initial split toggle */}
            {!splitMode && (
              <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                <button onClick={() => { setSplitMode(true); addSplit("vehicle"); }} style={{
                  flex: 1, padding: "10px 12px", borderRadius: 8, fontSize: 12,
                  cursor: "pointer", fontFamily: "inherit", fontWeight: 500,
                  background: "#f8fafc", color: "#64748b",
                  border: "1px dashed #cbd5e1",
                }}>{"\uD83D\uDE97"} + Add vehicle</button>
                <button onClick={() => { setSplitMode(true); addSplit("other"); }} style={{
                  flex: 1, padding: "10px 12px", borderRadius: 8, fontSize: 12,
                  cursor: "pointer", fontFamily: "inherit", fontWeight: 500,
                  background: "#fefce8", color: "#854d0e",
                  border: "1px dashed #fde047",
                }}>{"\u26FD"} + Add other item</button>
              </div>
            )}

            {error && <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 13, color: "#b91c1c" }}>{error}</div>}
            <PrimaryBtn onClick={() => {
              if (!form.driverFirstName || !form.driverLastName) { setError("Please enter your first and last name."); return; }
              if (!otherForm.equipment) { setError("Please select what this entry is for (tap a button above, e.g. Chainsaws, Engine Oil)"); return; }
              if (splitMode) {
                for (const sp of splits) {
                  if (sp.splitType === "vehicle" && (!sp.rego || !sp.odometer)) { setError("Please fill in rego and odometer for all vehicles."); return; }
                  if (sp.splitType === "other" && !sp.equipment) { setError("Please enter the equipment/purpose for all other items."); return; }
                }
              }
              document.activeElement?.blur(); setError(""); setStep(2);
            }}>Continue to Receipt {"\u2192"}</PrimaryBtn>
          </>
        )}

        {/* ═══ VEHICLE MODE ═══ */}
        {!otherMode && (
          <>
        {splitMode && <div style={{ fontSize: 12, fontWeight: 700, color: "#15803d", marginBottom: 8, marginTop: 4 }}>Vehicle 1</div>}

        <FieldInput label="Registration Number" value={form.registration} required
          maxLength={6}
          onChange={v => {
            // Only allow letters and numbers, max 6 characters
            v = v.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6);
            const prevLen = form.registration.length;
            const isTypingMore = v.length > prevLen;
            const db = learnedDBRef.current;
            const match = lookupRego(v, db, entriesRef.current);
            if (match) {
              // Only auto-fill the full rego when user is typing forward (adding chars),
              // not when deleting or editing — so the user can still make corrections
              const fullRego = (isTypingMore && match.r && match.r.length > v.length) ? match.r.slice(0, 6) : v;
              setForm(f => ({ ...f, registration: fullRego, vehicleType: match.t, division: match.d, _regoMatch: match }));
            } else {
              const vt = guessType(v, db, entriesRef.current);
              if (vt) {
                const div = getDivision(vt);
                setForm(f => ({ ...f, registration: v, vehicleType: vt, division: div, _regoMatch: null }));
              } else {
                setForm(f => ({ ...f, registration: v, _regoMatch: null }));
              }
            }
          }}
          placeholder="e.g. AB12CD" hint="6 characters — letters and numbers only" />

        {/* Auto-fill override link — small text-link sitting directly
            under the rego field. Only the override is shown here; the
            "Scan card anyway" option lives on Step 2 (the receipt
            photo page) so it's not in the way of the entry form. */}
        {!otherMode && profileApplied && (
          <button onClick={clearProfileForThisEntry}
            title={`Clear the auto-filled vehicle for this entry only — your profile (${profileApplied.name}) stays saved and will reapply next submission`}
            style={{
              background: "none", border: "none", color: "#64748b",
              fontSize: 11, padding: "0", margin: "-8px 0 12px 0",
              cursor: "pointer", fontFamily: "inherit", textDecoration: "underline",
              alignSelf: "flex-start",
            }}
          >Different vehicle today?</button>
        )}

        {/* Rego match card */}
        {form._regoMatch && (
          <div className="fade-in" style={{
            background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8,
            padding: "10px 12px", marginBottom: 14,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#15803d" }}>{"\u2713"} Vehicle found</span>
              <Pill label={form._regoMatch.d} color={form._regoMatch.t} />
              <Pill label={form._regoMatch.t} color={form._regoMatch.t} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{form._regoMatch.n}</div>
            {form._regoMatch.m && <div style={{ fontSize: 12, color: "#64748b" }}>{form._regoMatch.m}</div>}
            {(form._regoMatch.dr || form._regoMatch.c || form._regoMatch.f) && (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #bbf7d0", display: "flex", flexWrap: "wrap", gap: 12, fontSize: 11 }}>
                {form._regoMatch.dr && <div><span style={{ color: "#94a3b8" }}>Fleet card driver:</span>{" "}<span style={{ color: "#374151", fontWeight: 600 }}>{form._regoMatch.dr}</span></div>}
                {form._regoMatch.c && <div><span style={{ color: "#94a3b8" }}>Card #:</span>{" "}<span style={{ color: "#374151", fontWeight: 500 }}>{form._regoMatch.c.slice(-6)}</span></div>}
                {form._regoMatch.f && <div><span style={{ color: "#94a3b8" }}>Fuel:</span>{" "}<span style={{ color: "#374151", fontWeight: 500 }}>{form._regoMatch.f}</span></div>}
              </div>
            )}
            {form._regoMatch.dr && form.driverFirstName && `${form.driverFirstName} ${form.driverLastName}`.trim().toUpperCase() !== form._regoMatch.dr.toUpperCase() && (
              <div style={{ marginTop: 6, fontSize: 10, color: "#b45309", background: "#fffbeb", padding: "4px 8px", borderRadius: 4, border: "1px solid #fcd34d" }}>
                {"\u26A0"} Fleet card is assigned to {form._regoMatch.dr} {"\u2014"} different driver is fine, cards are often shared
              </div>
            )}
            <div style={{ marginTop: 6, fontSize: 10, color: form._regoMatch._src === "learned" || form._regoMatch._src === "history" ? "#7c3aed" : "#94a3b8" }}>
              {form._regoMatch._src === "learned"
                ? "\uD83E\uDDE0 Learned from previous driver submissions"
                : form._regoMatch._src === "history"
                ? "\uD83E\uDDE0 Learned from entry history"
                : "\uD83D\uDCCB From fleet database"}
            </div>
          </div>
        )}
        {form._regoMatch && (
          <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 10, cursor: "pointer" }}
            onClick={() => setForm(f => ({ ...f, _regoMatch: null, division: "", vehicleType: "" }))}>
            {"\u270E"} Wrong? Tap to select manually {form._regoMatch._src === "db" ? "\u2014 your correction will be remembered" : ""}
          </div>
        )}

        {/* Manual division/type — hidden when auto-matched */}
        {!form._regoMatch && (
          <>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 12, color: "#374151", fontWeight: 600, marginBottom: 6 }}>Division <span style={{ color: "#ef4444" }}>*</span></label>
            <div style={{ display: "flex", gap: 8 }}>
              {DIVISION_KEYS.map(dk => {
                const dc = DIVISIONS[dk].color; const sel = form.division === dk;
                return (
                  <button key={dk} onClick={() => setForm(f => ({ ...f, division: dk, vehicleType: "" }))} style={{
                    flex: 1, padding: "10px 14px", borderRadius: 10, fontSize: 14, cursor: "pointer",
                    fontFamily: "inherit", fontWeight: sel ? 700 : 500,
                    background: sel ? dc.bg : "white", color: sel ? dc.text : "#64748b",
                    border: `2px solid ${sel ? dc.border : "#e2e8f0"}`, transition: "all 0.15s",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  }}><span style={{ fontSize: 16 }}>{dk === "Tree" ? "\uD83C\uDF33" : "\uD83C\uDF3F"}</span>{dk}</button>
                );
              })}
            </div>
          </div>
          {form.division && (
            <div style={{ marginBottom: 14 }} className="fade-in">
              <label style={{ display: "block", fontSize: 12, color: "#374151", fontWeight: 600, marginBottom: 6 }}>Vehicle Type <span style={{ color: "#ef4444" }}>*</span></label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {divTypes.map(t => {
                  const c = VT_COLORS[t] || VT_COLORS.Other; const sel = form.vehicleType === t;
                  return (
                    <button key={t} onClick={() => setForm(f => ({ ...f, vehicleType: t }))} style={{
                      padding: "7px 14px", borderRadius: 20, fontSize: 13, cursor: "pointer",
                      fontFamily: "inherit", fontWeight: sel ? 700 : 500,
                      background: sel ? c.bg : "white", color: sel ? c.text : "#64748b",
                      border: `1.5px solid ${sel ? c.border : "#e2e8f0"}`, transition: "all 0.15s",
                    }}>{t}</button>
                  );
                })}
              </div>
            </div>
          )}
          </>
        )}

        <div style={{ display: "grid", gridTemplateColumns: splitMode ? "1fr 1fr" : "1fr", gap: 10 }}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 12, color: "#374141", fontWeight: 600, marginBottom: 5, textAlign: splitMode ? "left" : "center" }}>
              {isHoursBased(form.vehicleType) ? "Hour Meter Reading" : "Odometer Reading"}<span style={{ color: "#ef4444", marginLeft: 2 }}>*</span>
            </label>
            <input
              type="number" value={form.odometer} onChange={e => setForm(f => ({ ...f, odometer: e.target.value }))}
              placeholder={(() => { const last = getLastOdometer(form.registration); const u = isHoursBased(form.vehicleType) ? "hrs" : "km"; return last ? `Last: ${last.toLocaleString()} ${u}` : isHoursBased(form.vehicleType) ? "e.g. 1250" : "e.g. 4340"; })()}
              inputMode="decimal"
              style={{
                width: "100%", background: "white", border: `1px solid ${getOdoWarning()?.type === "danger" ? "#fca5a5" : getOdoWarning()?.type === "warn" ? "#fcd34d" : "#e2e8f0"}`,
                borderRadius: 8, padding: "9px 12px", color: "#0f172a", fontSize: 14,
                outline: "none", transition: "border 0.15s",
              }}
              onFocus={e => e.target.style.borderColor = "#22c55e"}
              onBlur={e => e.target.style.borderColor = getOdoWarning() ? (getOdoWarning().type === "danger" ? "#fca5a5" : "#fcd34d") : "#e2e8f0"}
            />
            {(() => {
              const last = getLastOdometer(form.registration);
              const warn = getOdoWarning();
              return (
                <>
                  {last && !warn && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>Last recorded: <strong>{last.toLocaleString()} {isHoursBased(form.vehicleType) ? "hrs" : "km"}</strong></div>}
                  {warn && (
                    <div style={{ fontSize: 11, marginTop: 4, padding: "5px 8px", borderRadius: 5,
                      background: warn.type === "danger" ? "#fef2f2" : "#fffbeb",
                      color: warn.type === "danger" ? "#b91c1c" : "#b45309",
                      border: `1px solid ${warn.type === "danger" ? "#fca5a5" : "#fcd34d"}`,
                    }}>{"\u26A0"} {warn.text}</div>
                  )}
                </>
              );
            })()}
          </div>
          {splitMode && (() => {
            const totalScanned = receiptData?.litres || 0;
            const otherVehicleLitres = splits.filter(s => s.splitType === "vehicle").reduce((s, sp) => s + (parseFloat(sp.litres) || 0), 0);
            const remaining = totalScanned > 0 ? Math.max(0, parseFloat((totalScanned - otherVehicleLitres).toFixed(2))) : 0;
            const hint = remaining > 0 && !form.litres
              ? `${remaining}L remaining from ${totalScanned}L total`
              : "How many litres went into this vehicle";
            return (
              <FieldInput label="Litres for this vehicle" value={form.litres || ""} type="number"
                onChange={v => setForm(f => ({ ...f, litres: v }))} placeholder={remaining > 0 ? `${remaining}` : "e.g. 44.35"} hint={hint} />
            );
          })()}
        </div>
        {splitMode && (
          <div style={{ marginBottom: 14 }}>
            <FieldInput label="Price per litre ($/L)" value={form.ppl || ""} type="number"
              onChange={v => setForm(f => ({ ...f, ppl: v }))} placeholder="e.g. 2.859" hint="Optional — will be filled from receipt scan if left blank" />
          </div>
        )}

        {/* ── Additional items (vehicles or other) ── */}
        {splitMode && splits.map((sp, si) => {
          const isOther = sp.splitType === "other";
          const spMatch = sp._match;
          const borderColor = isOther ? "#fde047" : "#e2e8f0";
          const bgColor = isOther ? "#fefce8" : "#f8fafc";
          const labelColor = isOther ? "#854d0e" : "#1e40af";
          return (
            <div key={sp.id} className="fade-in" style={{
              background: bgColor, border: `1px solid ${borderColor}`, borderRadius: 10,
              padding: "12px 14px", marginBottom: 10, marginTop: si === 0 ? 6 : 0,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: labelColor }}>
                  {isOther ? `\u26FD Other Item ${si + 2}` : `\uD83D\uDE97 Vehicle ${si + 2}`}
                </span>
                <button onClick={() => removeSplit(sp.id)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>{"\u00D7"}</button>
              </div>

              {isOther ? (
                <>
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: "#374151", fontWeight: 600, marginBottom: 4 }}>What is this for?</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
                      {ALL_EQUIPMENT_PRESETS.map(p => {
                        const selected = sp.equipment === p.label;
                        const isOilP = OIL_PRODUCTS.some(o => o.label === p.label);
                        return (
                          <button key={p.label} onClick={() => updateSplit(sp.id, "equipment", selected ? "" : p.label)} style={{
                            padding: "5px 10px", borderRadius: 8, fontSize: 10, cursor: "pointer", fontFamily: "inherit",
                            fontWeight: selected ? 700 : 500, transition: "all 0.15s",
                            background: selected ? (isOilP ? "#e0e7ff" : "#fef3c7") : "white",
                            color: selected ? (isOilP ? "#3730a3" : "#92400e") : "#64748b",
                            border: `1.5px solid ${selected ? (isOilP ? "#6366f1" : "#f59e0b") : "#e2e8f0"}`,
                          }}>{p.icon} {p.label}</button>
                        );
                      })}
                    </div>
                    {!sp.equipment && (
                      <input value={sp._customEquip || ""} onChange={e => updateSplit(sp.id, "_customEquip", e.target.value)}
                        onBlur={e => { if (e.target.value.trim()) { updateSplit(sp.id, "equipment", e.target.value.trim()); updateSplit(sp.id, "_customEquip", ""); }}}
                        placeholder="Or type a custom item..."
                        style={{ width: "100%", padding: "6px 10px", borderRadius: 7, border: "1px dashed #e2e8f0", fontSize: 11, outline: "none", fontFamily: "inherit", color: "#64748b", background: "white", boxSizing: "border-box" }} />
                    )}
                    {sp.equipment && <div style={{ fontSize: 11, color: "#15803d", fontWeight: 600, marginTop: 2 }}>{"\u2713"} {sp.equipment}</div>}
                  </div>
                  {/* Fuel-type fields */}
                  {sp.equipment && !isOilProduct(sp.equipment) && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 8 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 10, color: "#374151", fontWeight: 600, marginBottom: 3 }}>Litres</label>
                        <input value={sp.litres} onChange={e => updateSplit(sp.id, "litres", e.target.value)} placeholder="e.g. 15.14" type="number" inputMode="decimal"
                          style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 13, outline: "none", fontFamily: "inherit", color: "#0f172a", background: "white" }}
                          onFocus={e => e.target.style.borderColor = "#fde047"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 10, color: "#374151", fontWeight: 600, marginBottom: 3 }}>$/L <span style={{ fontWeight: 400, color: "#94a3b8" }}>(opt)</span></label>
                        <input value={sp.ppl || ""} onChange={e => updateSplit(sp.id, "ppl", e.target.value)} placeholder="e.g. 1.899" type="number" inputMode="decimal"
                          style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 13, outline: "none", fontFamily: "inherit", color: "#0f172a", background: "white" }}
                          onFocus={e => e.target.style.borderColor = "#fde047"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 10, color: "#374151", fontWeight: 600, marginBottom: 3 }}>Notes</label>
                        <input value={sp.notes || ""} onChange={e => updateSplit(sp.id, "notes", e.target.value)} placeholder="Optional"
                          style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 13, outline: "none", fontFamily: "inherit", color: "#0f172a", background: "white" }}
                          onFocus={e => e.target.style.borderColor = "#fde047"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
                      </div>
                    </div>
                  )}
                  {/* Oil/product fields */}
                  {sp.equipment && isOilProduct(sp.equipment) && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 10, color: "#374151", fontWeight: 600, marginBottom: 3 }}>Quantity</label>
                        <input value={sp.quantity || ""} onChange={e => updateSplit(sp.id, "quantity", e.target.value)} placeholder="e.g. 2" type="number" inputMode="numeric"
                          style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 13, outline: "none", fontFamily: "inherit", color: "#0f172a", background: "white" }}
                          onFocus={e => e.target.style.borderColor = "#6366f1"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 10, color: "#374151", fontWeight: 600, marginBottom: 3 }}>Price ($)</label>
                        <input value={sp.ppl || ""} onChange={e => updateSplit(sp.id, "ppl", e.target.value)} placeholder="e.g. 19.98" type="number" inputMode="decimal"
                          style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 13, outline: "none", fontFamily: "inherit", color: "#0f172a", background: "white" }}
                          onFocus={e => e.target.style.borderColor = "#6366f1"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ display: "block", fontSize: 11, color: "#374151", fontWeight: 600, marginBottom: 3 }}>Registration</label>
                    <input value={sp.rego} onChange={e => updateSplit(sp.id, "rego", e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6))} placeholder="e.g. AB12CD" maxLength={6}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 13, outline: "none", fontFamily: "inherit", color: "#0f172a", background: "white" }}
                      onFocus={e => e.target.style.borderColor = "#22c55e"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
                  </div>
                  {spMatch && (
                    <div style={{ fontSize: 10, color: "#15803d", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
                      {"\u2713"} {spMatch.n || spMatch.t} {"\u00B7"} {spMatch.d} / {spMatch.t}
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 11, color: "#374151", fontWeight: 600, marginBottom: 3 }}>{isHoursBased(sp.vehicleType) ? "Hour Meter" : "Odometer"}</label>
                      <input value={sp.odometer} onChange={e => updateSplit(sp.id, "odometer", e.target.value)} placeholder={isHoursBased(sp.vehicleType) ? "e.g. 4500" : "Reading"} type="number" inputMode="decimal"
                        style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 13, outline: "none", fontFamily: "inherit", color: "#0f172a", background: "white" }}
                        onFocus={e => e.target.style.borderColor = "#22c55e"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 11, color: "#374151", fontWeight: 600, marginBottom: 3 }}>Litres</label>
                      {(() => {
                        const totalScanned = receiptData?.litres || 0;
                        const v1Litres = parseFloat(form.litres) || 0;
                        const otherSplitLitres = splits.filter(s => s.splitType === "vehicle" && s.id !== sp.id).reduce((s, o) => s + (parseFloat(o.litres) || 0), 0);
                        const usedLitres = v1Litres + otherSplitLitres;
                        const remaining = totalScanned > 0 ? Math.max(0, parseFloat((totalScanned - usedLitres).toFixed(2))) : 0;
                        return (
                          <input value={sp.litres} onChange={e => updateSplit(sp.id, "litres", e.target.value)} placeholder={remaining > 0 ? `${remaining}` : "e.g. 15.14"} type="number" inputMode="decimal"
                            style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 13, outline: "none", fontFamily: "inherit", color: "#0f172a", background: "white" }}
                            onFocus={e => e.target.style.borderColor = "#22c55e"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
                        );
                      })()}
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 11, color: "#374151", fontWeight: 600, marginBottom: 3 }}>$/L <span style={{ fontWeight: 400, color: "#94a3b8" }}>(opt)</span></label>
                      <input value={sp.ppl || ""} onChange={e => updateSplit(sp.id, "ppl", e.target.value)} placeholder="e.g. 2.049" type="number" inputMode="decimal"
                        style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 13, outline: "none", fontFamily: "inherit", color: "#0f172a", background: "white" }}
                        onFocus={e => e.target.style.borderColor = "#22c55e"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })}

        {splitMode && (
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <button onClick={() => addSplit("vehicle")} style={{
              flex: 1, padding: "8px", borderRadius: 6, fontSize: 12, fontWeight: 600,
              background: "white", color: "#1e40af", border: "1px dashed #93c5fd",
              cursor: "pointer", fontFamily: "inherit",
            }}>{"\uD83D\uDE97"} + Vehicle</button>
            <button onClick={() => addSplit("other")} style={{
              flex: 1, padding: "8px", borderRadius: 6, fontSize: 12, fontWeight: 600,
              background: "#fefce8", color: "#854d0e", border: "1px dashed #fde047",
              cursor: "pointer", fontFamily: "inherit",
            }}>{"\u26FD"} + Other Item</button>
          </div>
        )}

        {/* + Split toggle */}
        {!splitMode && (
          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            <button onClick={() => { setSplitMode(true); if (splits.length === 0) addSplit("vehicle"); }} style={{
              flex: 1, padding: "10px 12px", borderRadius: 8, fontSize: 12,
              cursor: "pointer", fontFamily: "inherit", fontWeight: 500,
              background: "#f8fafc", color: "#64748b",
              border: "1px dashed #cbd5e1", transition: "all 0.15s",
            }}>
              {"\uD83D\uDE97"} + Add vehicle
            </button>
            <button onClick={() => { setSplitMode(true); addSplit("other"); }} style={{
              flex: 1, padding: "10px 12px", borderRadius: 8, fontSize: 12,
              cursor: "pointer", fontFamily: "inherit", fontWeight: 500,
              background: "#fefce8", color: "#854d0e",
              border: "1px dashed #fde047", transition: "all 0.15s",
            }}>
              {"\u26FD"} + Add other item
            </button>
          </div>
        )}

        {error && <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 13, color: "#b91c1c" }}>{error}</div>}
        <PrimaryBtn onClick={() => {
          // Specific validation messages so users know exactly what's missing
          const missing = [];
          if (!form.driverFirstName) missing.push("First Name");
          if (!form.driverLastName) missing.push("Last Name");
          if (!form.registration) missing.push("Vehicle Registration");
          if (!form.division) missing.push("Division");
          if (!form.vehicleType) missing.push("Vehicle Type");
          if (!form.odometer) missing.push(isHoursBased(form.vehicleType) ? "Hour Meter Reading" : "Odometer Reading");
          if (missing.length > 0) {
            setError(`Please fill in: ${missing.join(", ")}`);
            return;
          }
          if (splitMode) {
            for (let si = 0; si < splits.length; si++) {
              const sp = splits[si];
              if (sp.splitType === "vehicle" && !sp.rego) { setError(`Vehicle ${si + 2}: Please enter the registration`); return; }
              if (sp.splitType === "vehicle" && !sp.odometer) { setError(`Vehicle ${si + 2} (${sp.rego || "?"}): Please enter the ${isHoursBased(sp.vehicleType) ? "hour reading" : "odometer"}`); return; }
              if (sp.splitType === "other" && !sp.equipment) { setError(`Other Item ${si + 1}: Please enter what this is for (e.g. AdBlue, Oil)`); return; }
            }
          }
          document.activeElement?.blur(); setError(""); setStep(2);
        }}>Continue {"\u2192"}</PrimaryBtn>
        </>
        )}
      </div>
    );
  };

  const cardOnlyRef = useRef();

  const handleCardOnlyFile = async (file) => {
    if (!file || !file.type.startsWith("image/") || !apiKey) return;
    setReceiptScanning(true); setError("");
    try {
      const { b64, mime } = await compressImage(file);
      const result = await claudeScan(apiKey, b64, mime, buildCardScanPrompt(), apiModels.card);
      if (result?.cardNumber || result?.vehicleOnCard) {
        const matched = fuzzyMatchFleetCard(result.cardNumber, result.vehicleOnCard, learnedDBRef.current, learnedCardMappingsRef.current);
        setCardData(buildCardDataFromMatch(matched, result));
        if (matched._knownException && matched.actualVehicleRego && !form.registration) {
          setForm(f => ({ ...f, registration: matched.actualVehicleRego }));
        }
        showToast(matched._corrected ? "Fleet card scanned (auto-corrected)" : matched._knownException ? `Known exception: card shows ${matched.vehicleOnCard}, vehicle is ${matched.actualVehicleRego}` : "Fleet card scanned");
      } else {
        setError("Could not read fleet card from this photo. Try entering manually.");
      }
    } catch (e) { setError("Card scan failed \u2014 " + e.message); }
    setReceiptScanning(false);
  };

  const renderStep2 = () => {
    const hasReceipt = receiptData && (receiptData.litres || receiptData.totalCost);
    const hasCard = cardData?.cardNumber;
    const missingReceipt = receiptData && !hasReceipt;
    const missingCard = receiptData && !hasCard;

    return (
    <div className="fade-in">
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>
          {profileApplied ? "Receipt photo" : "Photo"}
        </div>
        <div style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>
          {profileApplied
            ? <>Take a clear photo of the receipt only. Your fleet card details are already saved on file \u2014 no need to capture the card.</>
            : <>Take a clear photo including both the receipt and fleet card in the same photo. Make sure the entire receipt is visible and the fleet card number is shown clearly.</>
          }
          {splitMode && <><br /><span style={{ color: "#1e40af", fontWeight: 500 }}>Split receipt: litres will be allocated per vehicle from Step 1</span></>}
        </div>
        <div style={{
          marginTop: 8, padding: "8px 12px", background: "#eff6ff", border: "1px solid #93c5fd",
          borderRadius: 8, fontSize: 11, color: "#1e40af",
        }}>
          {profileApplied
            ? <><strong>Tips for a good scan:</strong> Lay the receipt flat {"\u00B7"} Make sure all text is in focus and the receipt total is visible {"\u00B7"} Nothing is cut off at the edges</>
            : <><strong>Tips for a good scan:</strong> Lay the receipt flat {"\u00B7"} Place the fleet card next to it showing the full 16-digit number {"\u00B7"} Make sure all text is in focus and nothing is cut off</>
          }
        </div>
      </div>
      {!apiKey && (
        <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: 10, marginBottom: 14, fontSize: 13, color: "#b45309" }}>
          No API key set. Go to Settings to add your Anthropic API key.
        </div>
      )}
      <PhotoUpload preview={receiptPreview} scanning={receiptScanning} onFile={handleReceiptFile}
        inputRef={receiptRef}
        label={profileApplied ? "Receipt photo" : "Receipt & fleet card photo"}
        caption={profileApplied ? "Just the receipt \u2014 card is on file" : "Both receipt and fleet card in one clear photo"} />

      {/* Rotation controls */}
      {receiptPreview && !receiptScanning && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          marginBottom: 10, marginTop: -4,
        }}>
          <span style={{ fontSize: 10, color: "#94a3b8" }}>{receiptRotation ? `Auto-rotated ${receiptRotation}\u00B0` : "Still wrong?"}</span>
          <button onClick={() => rotateAndRescan((receiptRotation + 270) % 360)} style={{
            padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit",
            background: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0",
          }}>{"\u21BA"} Left</button>
          <button onClick={() => rotateAndRescan((receiptRotation + 90) % 360)} style={{
            padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit",
            background: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0",
          }}>{"\u21BB"} Right</button>
        </div>
      )}

      <div ref={scanResultsRef} />
      <ScanCard data={receiptData} title="Receipt data extracted" fields={[
        { key: "date", label: "Date" }, { key: "station", label: "Station" }, { key: "fuelType", label: "Fuel type" },
        { key: "pricePerLitre", label: "Price per litre", fmt: v => `$${v}` },
        ...(receiptData?.otherItemsCost > 0 ? [
          { key: "fuelCost", label: "Fuel cost", fmt: v => `$${v}` },
          { key: "otherItemsCost", label: "Non-fuel items", fmt: v => `$${v}` },
          { key: "totalCost", label: "Receipt total", fmt: v => `$${v}` },
        ] : [
          { key: "totalCost", label: "Total cost", fmt: v => `$${v}` },
        ]),
        { key: "litres", label: "Fuel Litres", fmt: v => `${v} L` },
      ]} />

      {/* Individual fuel lines breakdown */}
      {receiptData?.lines?.length > 1 && (
        <div className="fade-in" style={{
          background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 8,
          padding: "10px 12px", marginTop: 8,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#1e40af", marginBottom: 6, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            {"\u26FD"} {receiptData.lines.length} Separate Fuel Lines Detected
          </div>
          {receiptData.lines.map((line, li) => (
            <div key={li} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "5px 8px", background: "white", borderRadius: 5, marginBottom: 3,
              border: "1px solid #dbeafe", fontSize: 12,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 20, height: 20, borderRadius: "50%", background: "#dbeafe", color: "#1e40af", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{li + 1}</span>
                <span style={{ fontWeight: 600, color: "#0f172a" }}>{line.litres}L</span>
                {line.pricePerLitre && <span style={{ color: "#64748b", fontSize: 10 }}>@${line.pricePerLitre}/L</span>}
                {line.pump && <span style={{ color: "#64748b", fontSize: 10 }}>Pump {line.pump}</span>}
                {line.fuelType && <span style={{ color: "#94a3b8", fontSize: 10 }}>{line.fuelType}</span>}
              </div>
              {line.cost && <span style={{ color: "#374151", fontWeight: 500 }}>${line.cost.toFixed(2)}</span>}
            </div>
          ))}
          {splitMode && (receiptData.lines.length >= 1 + splits.filter(s => s.splitType === "vehicle").length || receiptData.otherItems?.length > 0) && (
            <button onClick={() => {
              const lines = receiptData.lines;
              const otherItems = receiptData.otherItems || [];

              // Build list of all vehicles: primary + split vehicles + fuel-consuming others
              const allVehicles = [];
              const primaryType = form._regoMatch?.t || form.vehicleType || "Other";
              allVehicles.push({ id: "primary", type: primaryType, isPrimary: true });

              const vehicleSplits = splits.filter(s => s.splitType === "vehicle");
              const otherSplits = splits.filter(s => s.splitType === "other");
              vehicleSplits.forEach(sp => {
                const spMatch = sp._match || lookupRego(sp.rego, learnedDBRef.current, entriesRef.current);
                allVehicles.push({ id: sp.id, type: spMatch?.t || sp.vehicleType || "Other", isPrimary: false });
              });
              // Fuel-consuming "other" items (jerry cans, chainsaws, etc)
              const fuelOthers = otherSplits.filter(sp => FUEL_EQUIPMENT_RE.test(sp.equipment));
              fuelOthers.forEach(sp => {
                allVehicles.push({ id: sp.id, type: "Other", isPrimary: false, isOther: true });
              });

              // Smart match: highest litres → largest vehicle
              const matched = smartMatchLinesToVehicles(allVehicles, lines);

              // Apply primary match
              const primaryLine = matched[0];
              if (primaryLine?.litres) setForm(f => ({ ...f, litres: primaryLine.litres.toString() }));

              // Apply split matches
              let otherIdx = 0;
              setSplits(prev => prev.map(sp => {
                // Find this split's match
                const vIdx = allVehicles.findIndex(v => v.id === sp.id);
                if (vIdx >= 0 && matched[vIdx]) {
                  const line = matched[vIdx];
                  return { ...sp, litres: line.litres?.toString() || sp.litres, _matchedLine: line, _matchedItem: null };
                }
                // Non-fuel other items → match to otherItems
                if (sp.splitType === "other" && !FUEL_EQUIPMENT_RE.test(sp.equipment) && otherIdx < otherItems.length) {
                  const item = otherItems[otherIdx++];
                  return item ? { ...sp, _matchedItem: item, _matchedLine: null } : sp;
                }
                return sp;
              }));
              showToast("Auto-allocated from receipt");
            }} style={{
              width: "100%", marginTop: 6, padding: "7px 12px", borderRadius: 6,
              fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              background: "#1e40af", color: "white", border: "none",
            }}>
              {"\u2728"} Auto-allocate from receipt
            </button>
          )}
          {splitMode && receiptData.lines.length < 1 + splits.filter(s => s.splitType === "vehicle").length && (
            <div style={{ fontSize: 10, color: "#b45309", marginTop: 6, padding: "4px 8px", background: "#fffbeb", borderRadius: 4 }}>
              {"\u26A0"} {receiptData.lines.length} fuel lines but {1 + splits.filter(s => s.splitType === "vehicle").length} vehicles {"\u2014"} allocate litres manually
            </div>
          )}
        </div>
      )}

      {/* Handwritten notes detected */}
      {receiptData?.handwrittenNotes && (
        <div style={{
          background: "#fefce8", border: "1px solid #fde047", borderRadius: 8,
          padding: "8px 12px", marginTop: 8, fontSize: 11,
        }}>
          <span style={{ fontWeight: 700, color: "#854d0e" }}>{"\u270D"} Handwritten notes detected:</span>{" "}
          <span style={{ color: "#374151" }}>{receiptData.handwrittenNotes}</span>
        </div>
      )}

      {/* Non-fuel items detected */}
      {receiptData?.otherItems?.length > 0 && (
        <div className="fade-in" style={{
          background: "#faf5ff", border: "1px solid #c4b5fd", borderRadius: 8,
          padding: "8px 12px", marginTop: 8, fontSize: 11,
        }}>
          <div style={{ fontWeight: 700, color: "#7c3aed", marginBottom: 4 }}>{"\uD83D\uDED2"} Non-fuel items on receipt:</div>
          {receiptData.otherItems.map((item, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
              <span style={{ color: "#374151" }}>{item.description}{item.quantity ? ` (${item.quantity})` : ""}</span>
              {item.cost && <span style={{ fontWeight: 600, color: "#7c3aed" }}>${item.cost.toFixed(2)}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Discount detected */}
      {receiptData?.discounts && receiptData.discounts !== 0 && (
        <div className="fade-in" style={{
          background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8,
          padding: "8px 12px", marginTop: 8, fontSize: 11,
        }}>
          <span style={{ fontWeight: 700, color: "#15803d" }}>{"\uD83C\uDD93"} Fleet card discount:</span>{" "}
          <span style={{ color: "#374151", fontWeight: 600 }}>${Math.abs(receiptData.discounts).toFixed(2)}</span>
        </div>
      )}

      {receiptData && (
        <button onClick={rescanReceipt} disabled={receiptScanning} style={{
          background: "none", border: "none", color: "#94a3b8", fontSize: 12, cursor: "pointer", padding: "4px 0", marginTop: 4, fontFamily: "inherit",
        }}>{"\u21BB"} Re-scan</button>
      )}

      {/* Fleet card detected from the same photo (or from an active
          driver profile \u2014 see profileApplied). When a profile is
          active, the "Different fleetcard?" link offers a one-click
          escape hatch to clear the on-file card and re-enable the
          scan UI for this entry only. */}
      {hasCard && (
        <div className="fade-in" style={{
          background: cardData._corrected ? "#f0fdf4" : "#fff7ed",
          border: `1px solid ${cardData._corrected ? "#86efac" : "#fdba74"}`,
          borderRadius: 8, padding: "8px 12px", marginTop: 10, fontSize: 12,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, gap: 8 }}>
            <div style={{ fontWeight: 700, color: cardData._corrected ? "#15803d" : "#c2410c", fontSize: 11 }}>
              {"\uD83D\uDCB3"} Fleet card {profileApplied ? "on file" : (cardData._corrected ? "matched & auto-corrected" : "detected")}
            </div>
            {profileApplied && (
              <button onClick={scanCardAnyway}
                title={`Clear the saved card for this entry only and re-enable the fleet-card scan \u2014 useful if ${profileApplied.name} has swapped cards or is using a different one today`}
                style={{
                  background: "none", border: "none",
                  color: "#1e40af", fontSize: 11,
                  padding: 0, cursor: "pointer", fontFamily: "inherit",
                  textDecoration: "underline", whiteSpace: "nowrap",
                }}
              >Different fleetcard?</button>
            )}
          </div>
          <div style={{ display: "flex", gap: 16 }}>
            <span><span style={{ color: "#94a3b8" }}>Card:</span> <span style={{ fontWeight: 600, color: "#0f172a" }}>...{cardData.cardNumber.slice(-6)}</span></span>
            {cardData.vehicleOnCard && <span><span style={{ color: "#94a3b8" }}>Rego:</span> <span style={{ fontWeight: 600, color: "#0f172a" }}>{cardData.vehicleOnCard}</span></span>}
          </div>
          {cardData._corrected && (
            <div style={{ fontSize: 10, color: "#64748b", marginTop: 4, fontStyle: "italic" }}>
              AI scanned: {cardData._originalCard ? `card "${cardData._originalCard}"` : ""}{cardData._originalCard && cardData._originalRego ? " / " : ""}{cardData._originalRego ? `rego "${cardData._originalRego}"` : ""} {"\u2192"} matched to known fleet data
            </div>
          )}
        </div>
      )}

      {/* ── MISSING DATA WARNINGS ── */}
      {/* Missing receipt data */}
      {missingReceipt && (
        <div className="fade-in" style={{
          background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8,
          padding: "10px 12px", marginTop: 10,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", marginBottom: 6 }}>{"\u26A0"} Receipt data not detected</div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>The AI couldn't read receipt details from this photo. Try uploading a clearer photo or re-scan.</div>
        </div>
      )}

      {/* Missing fleet card */}
      {missingCard && !manualCard && (
        <div className="fade-in" style={{
          background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8,
          padding: "10px 12px", marginTop: 10,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#b45309", marginBottom: 6 }}>{"\uD83D\uDCB3"} Fleet card not detected</div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>No physical fleet card with a 16-digit number was found in the photo. You can scan a separate card photo or enter the details manually:</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => {
              const inp = cardOnlyRef.current;
              if (inp) { inp.value = ""; inp.click(); }
            }} style={{
              flex: 1, padding: "7px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
              background: "white", color: "#b45309", border: "1px solid #fcd34d",
            }}>{"\uD83D\uDCF7"} Upload card photo</button>
            <button onClick={() => setManualCard(true)} style={{
              flex: 1, padding: "7px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
              background: "white", color: "#b45309", border: "1px solid #fcd34d",
            }}>{"\u270E"} Enter manually</button>
          </div>
          <input ref={cardOnlyRef} type="file" accept="image/*" style={{ display: "none" }}
            onChange={e => { if (e.target.files?.[0]) handleCardOnlyFile(e.target.files[0]); }} />
        </div>
      )}

      {/* Manual card entry form */}
      {manualCard && !hasCard && (
        <div className="fade-in" style={{
          background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8,
          padding: "10px 12px", marginTop: 10,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#374151" }}>{"\uD83D\uDCB3"} Enter fleet card details</span>
            <button onClick={() => setManualCard(false)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 14 }}>{"\u00D7"}</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label style={{ display: "block", fontSize: 10, color: "#64748b", fontWeight: 600, marginBottom: 3 }}>Card Number</label>
              <input value={formatCardNumber(manualCardNum)} onChange={e => setManualCardNum(e.target.value.replace(/\s/g, ""))} placeholder="e.g. 7034 3051 1700 2350"
                style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, outline: "none", fontFamily: "inherit", color: "#0f172a" }}
                onFocus={e => e.target.style.borderColor = "#22c55e"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10, color: "#64748b", fontWeight: 600, marginBottom: 3 }}>Card Rego</label>
              <input value={manualCardRego} onChange={e => setManualCardRego(e.target.value.toUpperCase())} placeholder="e.g. DF25LB"
                style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, outline: "none", fontFamily: "inherit", color: "#0f172a" }}
                onFocus={e => e.target.style.borderColor = "#22c55e"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
            </div>
          </div>
          <button onClick={() => {
            if (manualCardNum || manualCardRego) {
              const cleanCard = manualCardNum.replace(/\s/g, "");
              const cleanRego = manualCardRego.trim().toUpperCase();
              setCardData({ cardNumber: cleanCard || null, vehicleOnCard: cleanRego || null });
              // Learn this card ↔ rego association for future scans
              if (cleanCard && cleanRego) learnFleetCardCorrection(cleanCard, cleanRego);
              showToast("Fleet card details saved & learned for future scans");
            }
          }} style={{
            marginTop: 8, padding: "6px 14px", borderRadius: 6, fontSize: 11, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit",
            background: "#16a34a", color: "white", border: "none",
          }}>Save card details</button>
        </div>
      )}

      {/* Odometer detected */}
      {receiptData?.odometer && (
        <div className="fade-in" style={{
          background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8,
          padding: "8px 12px", marginTop: 8, fontSize: 12,
        }}>
          <span style={{ fontWeight: 700, color: "#15803d", fontSize: 11 }}>{"\uD83D\uDCCF"} Odometer detected:</span>{" "}
          <span style={{ fontWeight: 600, color: "#0f172a" }}>{receiptData.odometer.toLocaleString()} {isHoursBased(form.vehicleType) ? "hrs" : "km"}</span>
        </div>
      )}

      {/* ── Manual entry toggle ── */}
      {!receiptPreview && !receiptScanning && (
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <button onClick={() => setManualReceiptMode(m => !m)} style={{
            background: "none", border: "none", color: "#64748b", fontSize: 12, cursor: "pointer",
            fontFamily: "inherit", textDecoration: "underline",
          }}>{manualReceiptMode ? "Cancel manual entry" : "No photo? Enter details manually"}</button>
        </div>
      )}

      {/* ── Manual receipt entry form ── */}
      {manualReceiptMode && !receiptPreview && (
        <div className="fade-in" style={{
          background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10,
          padding: "14px 16px", marginTop: 10,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>Manual Receipt Entry</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
            <div>
              <label style={{ display: "block", fontSize: 10, color: "#64748b", fontWeight: 600, marginBottom: 3 }}>Date *</label>
              <input type="date" value={manualReceipt.date} onChange={e => setManualReceipt(r => ({ ...r, date: e.target.value }))}
                style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, outline: "none", fontFamily: "inherit", color: "#0f172a" }}
                onFocus={e => e.target.style.borderColor = "#22c55e"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10, color: "#64748b", fontWeight: 600, marginBottom: 3 }}>Petrol Station</label>
              <input value={manualReceipt.station} onChange={e => setManualReceipt(r => ({ ...r, station: e.target.value }))} placeholder="e.g. BP Marsden Park"
                style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, outline: "none", fontFamily: "inherit", color: "#0f172a" }}
                onFocus={e => e.target.style.borderColor = "#22c55e"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
            </div>
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Fleet Card</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 10, color: "#64748b", fontWeight: 600, marginBottom: 3 }}>Card Number</label>
              <input value={formatCardNumber(manualReceipt.cardNumber)} onChange={e => setManualReceipt(r => ({ ...r, cardNumber: e.target.value.replace(/\s/g, "") }))} placeholder="e.g. 7034 3051 1700 2350"
                style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, outline: "none", fontFamily: "inherit", color: "#0f172a" }}
                onFocus={e => e.target.style.borderColor = "#22c55e"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10, color: "#64748b", fontWeight: 600, marginBottom: 3 }}>Card Rego</label>
              <input value={manualReceipt.cardRego} onChange={e => setManualReceipt(r => ({ ...r, cardRego: e.target.value.toUpperCase() }))} placeholder="e.g. DF25LB"
                style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, outline: "none", fontFamily: "inherit", color: "#0f172a", textTransform: "uppercase" }}
                onFocus={e => e.target.style.borderColor = "#22c55e"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
            </div>
          </div>

          {/* Vehicle 1 fuel details */}
          <div style={{ fontSize: 11, fontWeight: 700, color: "#1e40af", marginBottom: 6 }}>Vehicle 1 — {form.registration || "Primary"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
            <div>
              <label style={{ display: "block", fontSize: 10, color: "#64748b", fontWeight: 600, marginBottom: 3 }}>Litres *</label>
              <input value={manualReceipt.v1Litres || ""} onChange={e => setManualReceipt(r => ({ ...r, v1Litres: e.target.value }))} placeholder="e.g. 128.57" type="number" inputMode="decimal"
                style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, outline: "none", fontFamily: "inherit", color: "#0f172a" }}
                onFocus={e => e.target.style.borderColor = "#22c55e"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10, color: "#64748b", fontWeight: 600, marginBottom: 3 }}>$/L *</label>
              <input value={manualReceipt.v1Ppl || ""} onChange={e => setManualReceipt(r => ({ ...r, v1Ppl: e.target.value }))} placeholder="e.g. 2.979" type="number" inputMode="decimal"
                style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, outline: "none", fontFamily: "inherit", color: "#0f172a" }}
                onFocus={e => e.target.style.borderColor = "#22c55e"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10, color: "#64748b", fontWeight: 600, marginBottom: 3 }}>Total Cost *</label>
              <input value={manualReceipt.v1Cost || ""} onChange={e => setManualReceipt(r => ({ ...r, v1Cost: e.target.value }))} placeholder="e.g. 383.01" type="number" inputMode="decimal"
                style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, outline: "none", fontFamily: "inherit", color: "#0f172a" }}
                onFocus={e => e.target.style.borderColor = "#22c55e"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
            </div>
          </div>

          {/* Split vehicles — show entry fields for each */}
          {splitMode && splits.map((sp, si) => {
            const isVehicle = sp.splitType === "vehicle";
            const label = isVehicle ? `Vehicle ${si + 2} — ${sp.rego || ""}` : `Other ${si + 2} — ${sp.equipment || ""}`;
            const color = isVehicle ? "#1e40af" : "#854d0e";
            const mKey = `sp_${sp.id}`;
            return (
              <div key={sp.id} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color, marginBottom: 6 }}>{label}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 10, color: "#64748b", fontWeight: 600, marginBottom: 3 }}>Litres</label>
                    <input value={manualReceipt[`${mKey}_litres`] || ""} onChange={e => setManualReceipt(r => ({ ...r, [`${mKey}_litres`]: e.target.value }))} placeholder="e.g. 13.03" type="number" inputMode="decimal"
                      style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, outline: "none", fontFamily: "inherit", color: "#0f172a" }}
                      onFocus={e => e.target.style.borderColor = "#22c55e"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 10, color: "#64748b", fontWeight: 600, marginBottom: 3 }}>$/L</label>
                    <input value={manualReceipt[`${mKey}_ppl`] || ""} onChange={e => setManualReceipt(r => ({ ...r, [`${mKey}_ppl`]: e.target.value }))} placeholder="e.g. 1.999" type="number" inputMode="decimal"
                      style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, outline: "none", fontFamily: "inherit", color: "#0f172a" }}
                      onFocus={e => e.target.style.borderColor = "#22c55e"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 10, color: "#64748b", fontWeight: 600, marginBottom: 3 }}>Cost</label>
                    <input value={manualReceipt[`${mKey}_cost`] || ""} onChange={e => setManualReceipt(r => ({ ...r, [`${mKey}_cost`]: e.target.value }))} placeholder="e.g. 26.05" type="number" inputMode="decimal"
                      style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, outline: "none", fontFamily: "inherit", color: "#0f172a" }}
                      onFocus={e => e.target.style.borderColor = "#22c55e"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
                  </div>
                </div>
              </div>
            );
          })}

          <button onClick={() => {
            if (!manualReceipt.date) { setError("Please enter the receipt date."); return; }
            const v1L = parseFloat(manualReceipt.v1Litres) || 0;
            const v1Ppl = parseFloat(manualReceipt.v1Ppl) || 0;
            const v1Cost = parseFloat(manualReceipt.v1Cost) || (v1L * v1Ppl) || 0;

            // Build lines array — Vehicle 1 + any split vehicles
            const lines = [{ litres: v1L, cost: v1Cost, pricePerLitre: v1Ppl || (v1L > 0 ? v1Cost / v1L : 0), fuelType: form._regoMatch?.f || "Diesel" }];
            const otherItems = [];
            let totalLitres = v1L;
            let totalCost = v1Cost;

            if (splitMode) {
              for (const sp of splits) {
                const mKey = `sp_${sp.id}`;
                const spL = parseFloat(manualReceipt[`${mKey}_litres`]) || 0;
                const spPpl = parseFloat(manualReceipt[`${mKey}_ppl`]) || 0;
                const spCost = parseFloat(manualReceipt[`${mKey}_cost`]) || (spL * spPpl) || 0;
                totalCost += spCost;

                if (sp.splitType === "vehicle") {
                  lines.push({ litres: spL, cost: spCost, pricePerLitre: spPpl || (spL > 0 ? spCost / spL : 0), fuelType: "Diesel" });
                  totalLitres += spL;
                } else {
                  otherItems.push({ description: sp.equipment || "Other", litres: spL, cost: spCost, pricePerLitre: spPpl || (spL > 0 ? spCost / spL : 0) });
                }
              }
            }

            // Format date from yyyy-mm-dd to dd/mm/yyyy
            const [y, m, d] = manualReceipt.date.split("-");
            const formattedDate = `${d}/${m}/${y}`;

            // Set receipt data as if scanned
            setReceiptData({
              date: formattedDate,
              station: manualReceipt.station || "",
              fuelType: lines[0]?.fuelType || "Diesel",
              litres: totalLitres,
              pricePerLitre: v1Ppl,
              totalCost: totalCost,
              fuelCost: lines.reduce((s, l) => s + (l.cost || 0), 0),
              lines: lines.filter(l => l.litres > 0),
              otherItems,
              confidence: { overall: "manual", issues: [] },
              _manualEntry: true,
            });

            // Set card data
            const cleanCard = (manualReceipt.cardNumber || "").replace(/\s/g, "");
            const cleanRego = (manualReceipt.cardRego || "").trim().toUpperCase();
            if (cleanCard || cleanRego) {
              const matched = fuzzyMatchFleetCard(cleanCard, cleanRego, learnedDBRef.current, learnedCardMappingsRef.current);
              // Manual entry — no AI scan was involved, so no AI-side
              // confidence exists. Pass null so the flag-firing logic knows
              // this wasn't machine-read.
              setCardData(buildCardDataFromMatch(matched, null));
              if (matched._knownException && matched.actualVehicleRego && !form.registration) {
                setForm(f => ({ ...f, registration: matched.actualVehicleRego }));
              }
              // Don't learn exception cards as a correction (they're genuinely different)
              if (cleanCard && cleanRego && !matched._knownException) learnFleetCardCorrection(cleanCard, cleanRego);
            }

            // Set form litres for Vehicle 1
            if (v1L > 0) setForm(f => ({ ...f, litres: v1L.toString() }));

            // Update split litres/ppl
            if (splitMode) {
              setSplits(prev => prev.map(sp => {
                const mKey = `sp_${sp.id}`;
                const spL = manualReceipt[`${mKey}_litres`] || sp.litres;
                const spPpl = manualReceipt[`${mKey}_ppl`] || sp.ppl;
                return { ...sp, litres: spL, ppl: spPpl };
              }));
            }

            setManualReceiptMode(false);
            setReceiptPreview("manual");
            showToast("Manual receipt data saved");
            setError("");
          }} style={{
            width: "100%", marginTop: 6, padding: "8px 14px", borderRadius: 8,
            fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            background: "#16a34a", color: "white", border: "none",
          }}>Save & Continue</button>
        </div>
      )}

      {error && <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: 10, marginBottom: 12, marginTop: 12, fontSize: 13, color: "#b91c1c" }}>{error}</div>}
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <SecondaryBtn onClick={() => { setError(""); setStep(1); }}>{"\u2190"} Back</SecondaryBtn>
        <div style={{ flex: 1 }}>
          <PrimaryBtn onClick={() => { document.activeElement?.blur(); setError(""); setStep(3); }} disabled={(!receiptPreview && !manualReceiptMode) || receiptScanning}>Review {"\u2192"}</PrimaryBtn>
        </div>
      </div>
    </div>
    );
  };

  // ── Review-confirmation gate ──
  // Show a single "I've checked the numbers" checkbox next to submit
  // ONLY when the AI scan looks suspect (medium/low confidence or math issues).
  // Clean scans submit without extra friction.
  const needsReviewConfirmation = (() => {
    if (!receiptData) return false;
    const conf = receiptData.confidence?.overall;
    if (conf === "medium" || conf === "low") return true;
    if (receiptData._mathIssues && receiptData._mathIssues.length > 0) return true;
    if (receiptData._futureDateDetected) return true;
    return false;
  })();

  const renderReviewConfirmGate = () => {
    if (!needsReviewConfirmation) return null;
    const issues = [
      ...(receiptData._mathIssues || []),
      ...(receiptData.confidence?.issues || []),
    ].filter(Boolean);
    const conf = receiptData.confidence?.overall || "medium";
    return (
      <div style={{
        background: "#fffbeb", border: "2px solid #fbbf24", borderRadius: 10,
        padding: "12px 14px", marginBottom: 12,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e", marginBottom: 6 }}>
          {"\u26A0"} The scan wasn't fully confident ({conf}) — quick check before submitting
        </div>
        {issues.length > 0 && (
          <ul style={{ margin: "4px 0 10px", paddingLeft: 18, fontSize: 11, color: "#78350f", lineHeight: 1.45 }}>
            {issues.slice(0, 4).map((msg, i) => (<li key={i}>{msg}</li>))}
            {issues.length > 4 && <li style={{ color: "#a16207" }}>{`+${issues.length - 4} more — see flags after submit`}</li>}
          </ul>
        )}
        <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer", fontSize: 12, color: "#0f172a", fontWeight: 600 }}>
          <input
            type="checkbox"
            checked={reviewConfirmed}
            onChange={e => setReviewConfirmed(e.target.checked)}
            style={{ marginTop: 2, width: 16, height: 16, cursor: "pointer", accentColor: "#16a34a" }}
          />
          <span>I've checked the numbers above (litres, $/L, total cost, date) and they match the receipt.</span>
        </label>
      </div>
    );
  };
  const canSubmitReview = !needsReviewConfirmation || reviewConfirmed;

  const renderStep3 = () => {
    // Shared inline edit row style
    const rowStyle = (i, len) => ({
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "6px 14px", fontSize: 13,
      borderBottom: i < len - 1 ? "1px solid #f1f5f9" : "none",
      background: i % 2 === 0 ? "white" : "#fafafa",
    });
    const labelStyle = { color: "#64748b", fontSize: 12, flexShrink: 0, marginRight: 12 };
    const inputStyle = {
      textAlign: "right", fontWeight: 500, color: "#0f172a", background: "transparent",
      border: "1px solid transparent", borderRadius: 4, padding: "4px 6px", outline: "none",
      fontFamily: "inherit", fontSize: 13, width: "100%", maxWidth: 200,
    };
    const focusStyle = (e) => { e.target.style.borderColor = "#22c55e"; e.target.style.background = "#f0fdf4"; };
    const blurStyle = (e) => { e.target.style.borderColor = "transparent"; e.target.style.background = "transparent"; };

    // ── Other mode review ──
    if (otherMode) {
      return (
        <div className="fade-in">
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>Review Oil & Other Claim</div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>Tap any value to edit before submitting</div>
          </div>
          {/* Future date blocking popup */}
          {(() => {
            if (!receiptData?.date) return null;
            if (!isAfterSydneyToday(receiptData.date)) return null;
            return (
              <div className="fade-in" style={{
                background: "#fef2f2", border: "2px solid #dc2626", borderRadius: 10,
                padding: "16px", marginBottom: 16, textAlign: "center",
              }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>{"\u26D4"}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#dc2626", marginBottom: 6 }}>
                  Future Date Detected — This is Impossible
                </div>
                <div style={{ fontSize: 13, color: "#991b1b", marginBottom: 10, lineHeight: 1.5 }}>
                  The date "<strong>{receiptData.date}</strong>" is in the future. Receipts can only be from today or earlier.
                  Please correct the date before submitting.
                </div>
                <div style={{ fontSize: 12, color: "#b91c1c", fontWeight: 600 }}>
                  {"\u2193"} Fix the date in the "Date" field below
                </div>
              </div>
            );
          })()}

          {/* Date cross-validation mismatch banner */}
          {dateCrossValidation?.issues?.length > 0 && (() => {
            if (receiptData?.date && isAfterSydneyToday(receiptData.date)) return null; // future date banner already showing
            return (
              <div className="fade-in" style={{
                background: "#fffbeb", border: "2px solid #f59e0b", borderRadius: 10,
                padding: "14px 16px", marginBottom: 16,
              }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#92400e", marginBottom: 6 }}>
                  {"\u26A0"} Date May Be Misread
                </div>
                <div style={{ fontSize: 12, color: "#78350f", marginBottom: 8, lineHeight: 1.5 }}>
                  {dateCrossValidation.issues.map((iss, i) => <div key={i}>{"\u2022"} {iss.message} <span style={{ fontSize: 10, color: "#a16207" }}>({iss.signal})</span></div>)}
                </div>
                {dateCrossValidation.suggestedDateStr && (
                  <button onClick={() => {
                    setReceiptData(d => ({...d, date: dateCrossValidation.suggestedDateStr, _futureDateDetected: false, _futureDateCorrected: false}));
                    setDateCrossValidation(null);
                  }} style={{
                    background: "#f59e0b", color: "white", border: "none", borderRadius: 8,
                    padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer",
                  }}>
                    Use Suggested Date: {dateCrossValidation.suggestedDateStr}
                  </button>
                )}
                {!dateCrossValidation.suggestedDateStr && (
                  <div style={{ fontSize: 12, color: "#b45309", fontWeight: 600 }}>
                    {"\u2193"} Please verify the date in the field below
                  </div>
                )}
              </div>
            );
          })()}

          <div style={{ background: "white", border: "1px solid #fde047", borderRadius: 10, overflow: "hidden", marginBottom: 20 }}>
            <div style={{ background: "#fefce8", padding: "8px 14px", fontSize: 11, fontWeight: 700, color: "#854d0e", letterSpacing: "0.04em", textTransform: "uppercase" }}>{"\u26FD"} Oil & Other Claim</div>
            {[
              { label: "First Name", val: form.driverFirstName, set: v => setForm(f => ({...f, driverFirstName: v})) },
              { label: "Last Name", val: form.driverLastName, set: v => setForm(f => ({...f, driverLastName: v})) },
              { label: "Division", val: otherForm.division, set: v => setOtherForm(f => ({...f, division: v})) },
              { label: "Equipment", val: otherForm.equipment, set: v => setOtherForm(f => ({...f, equipment: v})) },
              { label: "Station", val: otherForm.station || receiptData?.station || "", set: v => setOtherForm(f => ({...f, station: v})) },
              { label: "Fleet Card", val: formatCardNumber(cardData?.cardNumber || otherForm.fleetCard || ""), set: v => {
                const cleanCard = v.replace(/\s/g, "");
                setCardData(d => ({...(d || {}), cardNumber: cleanCard}));
                const rego = cardData?.vehicleOnCard || otherForm.cardRego;
                if (rego && cleanCard.length >= 10) learnFleetCardCorrection(cleanCard, rego, cardData?._originalCard, cardData?._originalRego);
              }},
              { label: "Card Rego", val: cardData?.vehicleOnCard || otherForm.cardRego || "", set: v => {
                const cleanRego = v.toUpperCase().replace(/[^A-Z0-9]/g, "");
                setCardData(d => ({...(d || {}), vehicleOnCard: cleanRego}));
                const card = cardData?.cardNumber || otherForm.fleetCard;
                if (card && card.length >= 10 && cleanRego) learnFleetCardCorrection(card, cleanRego, cardData?._originalCard, cardData?._originalRego);
              }},
              { label: "Date", val: receiptData?.date || "", set: v => { setReceiptData(d => ({...d, date: v, _futureDateDetected: false, _futureDateCorrected: false})); setDateCrossValidation(null); }, warn: (() => {
                if (!receiptData?.date) return null;
                if (isAfterSydneyToday(receiptData.date)) return "IMPOSSIBLE: This date is in the future! Receipts cannot have future dates. Please correct this date now.";
                if (dateCrossValidation?.issues?.length) return dateCrossValidation.issues.map(i => i.message).join(" | ");
                const ts = parseDate(receiptData.date); if (!ts) return null;
                const scannedDate = new Date(ts);
                const diffDays = Math.round(Math.abs(new Date() - scannedDate) / 86400000);
                if (diffDays > DATE_WINDOW_DAYS) return `Date is ${diffDays} days ago — please double-check`;
                return null;
              })() },
              { label: "Litres", val: receiptData?._rawLitres || receiptData?.litres?.toString() || "", set: v => setReceiptData(d => ({...d, litres: v, _rawLitres: v})) },
              { label: "$/L", val: receiptData?._rawPpl || receiptData?.pricePerLitre?.toString() || "", set: v => setReceiptData(d => ({...d, pricePerLitre: v, _rawPpl: v})) },
              { label: "Total Cost", val: receiptData?._rawCost || receiptData?.totalCost?.toString() || "", set: v => setReceiptData(d => ({...d, totalCost: v, _rawCost: v})) },
              { label: "Notes", val: otherForm.notes || "", set: v => setOtherForm(f => ({...f, notes: v})) },
            ].map(({ label, val, set, warn }, i, arr) => (
              <div key={label}>
                <div style={rowStyle(i, arr.length)}>
                  <span style={labelStyle}>{label}</span>
                  <input value={val} onChange={e => set(e.target.value)} style={{...inputStyle, ...(warn ? { color: "#dc2626", fontWeight: 700 } : {})}} onFocus={focusStyle} onBlur={blurStyle} />
                </div>
                {warn && <div style={{ padding: "4px 14px 6px", fontSize: 11, color: "#dc2626", fontWeight: 600, background: "#fef2f2", borderBottom: "1px solid #fca5a5" }}>{"\u26A0"} {warn}</div>}
              </div>
            ))}
          </div>
          {renderReviewConfirmGate()}
          <div style={{ display: "flex", gap: 10 }}>
            <SecondaryBtn onClick={() => setStep(2)}>{"\u2190"} Back</SecondaryBtn>
            <div style={{ flex: 1 }}><PrimaryBtn onClick={handleSubmit} loading={saving} disabled={!canSubmitReview}>Submit Claim</PrimaryBtn></div>
          </div>
        </div>
      );
    }

    // ── Vehicle mode review — smart match scanned lines to vehicles ──
    const scannedLines = receiptData?.lines || [];
    const scannedOtherItems = receiptData?.otherItems || [];
    const regoMatch = form._regoMatch;
    const globalPpl = receiptData?.pricePerLitre;

    // Smart match: build vehicles list, match by litres/type
    let otherItemIdx = 0;
    let primaryLine = null;
    const availableLinesForReview = [...scannedLines];

    if (splitMode && availableLinesForReview.length > 0) {
      const primaryType = regoMatch?.t || form.vehicleType || "Other";
      const userLitresInput = parseFloat(form.litres) || 0;

      // Try to match by user-entered litres first (most reliable)
      if (userLitresInput > 0) {
        let bestIdx = 0, bestDiff = Infinity;
        availableLinesForReview.forEach((l, i) => {
          const diff = Math.abs((l.litres || 0) - userLitresInput);
          if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
        });
        primaryLine = availableLinesForReview.splice(bestIdx, 1)[0];
      } else {
        // No user litres — match by vehicle size (largest vehicle gets highest litres)
        const rank = VEHICLE_FUEL_RANK[primaryType] || 99;
        if (rank <= 5) {
          // Large vehicle — get the line with most litres
          const sorted = availableLinesForReview.map((l, i) => ({ l, i })).sort((a, b) => (b.l.litres || 0) - (a.l.litres || 0));
          primaryLine = availableLinesForReview.splice(sorted[0].i, 1)[0];
        } else {
          // Small vehicle/equipment — get the line with least litres
          const sorted = availableLinesForReview.map((l, i) => ({ l, i })).sort((a, b) => (a.l.litres || 0) - (b.l.litres || 0));
          primaryLine = availableLinesForReview.splice(sorted[0].i, 1)[0];
        }
      }
    } else if (!splitMode) {
      // When the receipt has MULTIPLE fuel lines but the user is NOT in
      // split mode, assign line 0 to the primary entry and leave the rest
      // as "extras" — the same model handleSubmit uses on save. Previously
      // this branch forced primaryLine = null, which made the review screen
      // display receipt TOTALS (litres + cost summed across all lines) even
      // though the saved entry only used line 0. Result: a 22.24L unleaded
      // + 51.31L diesel receipt for ONE vehicle was displayed as a 73.55L
      // entry on review but only stored 22.24L — and the "X extra fuel
      // lines" banner was the only hint that anything was off.
      //
      // Now: one entry = one line. Review = what actually gets stored. The
      // extra lines stay in `availableLinesForReview` and surface via the
      // "X extra fuel line(s) — add as separate entries?" banner (which
      // appears below this review form and is the trigger for adding
      // them as additional entries post-submit).
      if (availableLinesForReview.length > 1) {
        primaryLine = availableLinesForReview.shift();
      } else {
        primaryLine = null; // single-line receipt — receiptData totals == line 0 anyway
      }
    }
    const primaryFuelType = primaryLine?.fuelType || receiptData?.fuelType || regoMatch?.f || "";
    const primaryLitres = splitMode
      ? (form.litres || primaryLine?.litres?.toString() || "0")
      : (primaryLine?.litres?.toString() || receiptData?._rawLitres || receiptData?.litres?.toString() || "");

    // Price per litre logic:
    // - If user entered $/L on Step 1, trust that first
    // - In split mode: trust the scanned line's price (user is splitting litres, not changing price)
    // - In non-split mode: recalculate from cost ÷ litres as a cross-check
    const userLitres = parseFloat(primaryLitres);
    const userPpl = parseFloat(form.ppl);
    let primaryPpl;
    if (userPpl > 0) {
      // User explicitly entered $/L on Step 1 — trust it
      primaryPpl = userPpl;
    } else if (splitMode) {
      // Split mode: price per litre stays the same regardless of how litres are divided
      primaryPpl = primaryLine?.pricePerLitre || receiptData?.pricePerLitre || globalPpl;
    } else if (primaryLine) {
      // Multi-line receipt — use the ASSIGNED line's price, not the receipt's
      // overall ppl (which is a weighted average across all fuels and would
      // mismatch the saved entry's litres × cost).
      primaryPpl = primaryLine.pricePerLitre
        || ((primaryLine.cost && primaryLine.litres) ? parseFloat((primaryLine.cost / primaryLine.litres).toFixed(4)) : globalPpl);
    } else {
      // Single-line receipt — recompute from totals (cost ÷ litres) for accuracy
      const lineCost = parseFloat(receiptData?._rawCost || receiptData?.fuelCost || receiptData?.totalCost || 0);
      if (userLitres > 0 && lineCost > 0) {
        primaryPpl = parseFloat((lineCost / userLitres).toFixed(4));
      } else {
        primaryPpl = globalPpl;
      }
    }

    // Cost logic:
    // - In split mode: cost = user's litres × price per litre (not the full receipt cost)
    // - Multi-line non-split: use the ASSIGNED line's cost (one entry = one line)
    // - Single-line non-split: use the receipt total (which equals the only line's cost)
    const primaryCost = receiptData?._rawCost
      || (splitMode
        ? (userLitres > 0 && primaryPpl > 0 ? (userLitres * primaryPpl).toFixed(2) : (primaryLine?.cost?.toFixed(2) || ""))
        : (primaryLine?.cost?.toFixed(2) || receiptData?.fuelCost?.toString() || receiptData?.totalCost?.toString() || ""));

    const vehicleRows = [
      { label: "First Name", val: form.driverFirstName, set: v => setForm(f => ({...f, driverFirstName: v})) },
      { label: "Last Name", val: form.driverLastName, set: v => setForm(f => ({...f, driverLastName: v})) },
      { label: "Registration", val: form.registration, set: v => setForm(f => ({...f, registration: v.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6)})) },
      { label: "Division", val: form.division, set: v => setForm(f => ({...f, division: v})) },
      { label: "Vehicle type", val: form.vehicleType, set: v => setForm(f => ({...f, vehicleType: v})) },
      { label: isHoursBased(form.vehicleType) ? "Hour Meter" : "Odometer", val: form.odometer, set: v => setForm(f => ({...f, odometer: v})) },
      { label: "Date", val: receiptData?.date || "", set: v => { setReceiptData(d => ({...d, date: v, _futureDateDetected: false, _futureDateCorrected: false})); setDateCrossValidation(null); }, warn: (() => {
        if (!receiptData?.date) return null;
        if (isAfterSydneyToday(receiptData.date)) return "IMPOSSIBLE: This date is in the future! Receipts cannot have future dates. Please correct this date now.";
        if (dateCrossValidation?.issues?.length) return dateCrossValidation.issues.map(i => i.message).join(" | ");
        const ts = parseDate(receiptData.date); if (!ts) return null;
        const scannedDate = new Date(ts);
        const diffDays = Math.round(Math.abs(new Date() - scannedDate) / 86400000);
        if (diffDays > DATE_WINDOW_DAYS) return `Date is ${diffDays} days ago — please double-check`;
        return null;
      })() },
      { label: "Station", val: receiptData?.station || "", set: v => setReceiptData(d => ({...d, station: v})) },
      { label: "Fuel type", val: primaryFuelType, set: v => setReceiptData(d => ({...d, fuelType: v})) },
      { label: "Litres", val: primaryLitres, set: v => {
        // Edit routing:
        // - Split mode → form.litres (handleSubmit reads from there for primary)
        // - Multi-line non-split → form.litres too (overrides the assigned line's
        //   litres in handleSubmit, which checks form.litres BEFORE primaryLine.litres)
        // - Single-line non-split → receiptData.litres (which IS the entry's litres
        //   since parsedLitresTotal == primaryLine.litres in that case)
        if (splitMode || primaryLine) setForm(f => ({...f, litres: v}));
        else setReceiptData(d => ({...d, litres: v, _rawLitres: v}));
      } },
      { label: "$/L", val: receiptData?._rawPpl || primaryPpl?.toString() || "", set: v => setReceiptData(d => ({...d, pricePerLitre: v, _rawPpl: v})) },
      { label: "Cost", val: primaryCost, set: v => setReceiptData(d => ({...d, totalCost: v, _rawCost: v})) },
    ];

    const cardRows = [
      { label: "Card Number", val: formatCardNumber(cardData?.cardNumber || regoMatch?.c || ""), set: v => {
        const cleanCard = v.replace(/\s/g, "");
        setCardData(d => ({...(d || {}), cardNumber: cleanCard}));
        // Learn this card ↔ rego association + raw AI misread mapping
        const rego = cardData?.vehicleOnCard || form.registration;
        if (rego && cleanCard.length >= 10) learnFleetCardCorrection(cleanCard, rego, cardData?._originalCard, cardData?._originalRego);
      }},
      { label: "Card Rego", val: cardData?.vehicleOnCard || "", set: v => {
        const cleanRego = v.toUpperCase().replace(/[^A-Z0-9]/g, "");
        setCardData(d => ({...(d || {}), vehicleOnCard: cleanRego}));
        // Learn this rego ↔ card association + raw AI misread mapping
        const card = cardData?.cardNumber;
        if (card && card.length >= 10 && cleanRego) learnFleetCardCorrection(card, cleanRego, cardData?._originalCard, cardData?._originalRego);
      }},
    ];
    const hasCardData = !!(cardData?.cardNumber || regoMatch?.c);

    // Pre-compute matched data for each split — smart match by litres/type
    const splitPreviews = splits.map(sp => {
      const isOther = sp.splitType === "other";
      const isFuelOther = isOther && FUEL_EQUIPMENT_RE.test(sp.equipment);

      if (isOther && !isFuelOther) {
        // Non-fuel item → match to scanned otherItem by description similarity
        const equipLower = (sp.equipment || "").toLowerCase().trim();
        // First try: find an otherItem whose description matches the equipment name
        let matchedIdx = -1;
        for (let oi = 0; oi < scannedOtherItems.length; oi++) {
          const desc = (scannedOtherItems[oi]?.description || "").toLowerCase();
          if (desc.includes(equipLower) || equipLower.includes(desc) ||
              (equipLower === "adblue" && /adblue|ad[\s-]*blue|def|urea/i.test(desc))) {
            matchedIdx = oi;
            break;
          }
        }
        // Fallback: use next available otherItem by index
        if (matchedIdx < 0 && otherItemIdx < scannedOtherItems.length) {
          matchedIdx = otherItemIdx;
        }
        if (matchedIdx >= 0 && matchedIdx < scannedOtherItems.length) {
          const item = scannedOtherItems[matchedIdx];
          if (matchedIdx === otherItemIdx) otherItemIdx++;
          return { ...sp, _matchedItem: item, _matchedLine: null, _isFuelOther: false };
        }
        return { ...sp, _matchedLine: null, _matchedItem: null, _isFuelOther: false };
      } else if ((isOther && isFuelOther) || !isOther) {
        // Fuel-type — smart match from remaining available lines
        let line = null;
        if (availableLinesForReview.length > 0) {
          const spLitres = parseFloat(sp.litres) || 0;
          const spType = sp.vehicleType || sp._match?.t || "Other";

          if (spLitres > 0) {
            // Match by user-entered litres (closest match)
            let bestIdx = 0, bestDiff = Infinity;
            availableLinesForReview.forEach((l, i) => {
              const diff = Math.abs((l.litres || 0) - spLitres);
              if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
            });
            line = availableLinesForReview.splice(bestIdx, 1)[0];
          } else if (availableLinesForReview.length > 1) {
            // Try fuel type matching first (diesel→diesel, unleaded→unleaded)
            const spFuel = (sp.fuelType || sp._match?.f || "").toLowerCase();
            let fuelMatchIdx = -1;
            if (spFuel) {
              const isDiesel = (f) => /diesel|gas\s*oil/i.test(f);
              const isUnleaded = (f) => /unleaded|petrol|premium\s*\d|e10|ulp|pulp|95|98/i.test(f);
              fuelMatchIdx = availableLinesForReview.findIndex(l => {
                const lFuel = (l.fuelType || "").toLowerCase();
                if (!lFuel) return false;
                if (isDiesel(spFuel) && isDiesel(lFuel)) return true;
                if (isUnleaded(spFuel) && isUnleaded(lFuel)) return true;
                return lFuel.includes(spFuel) || spFuel.includes(lFuel);
              });
            }
            if (fuelMatchIdx >= 0) {
              line = availableLinesForReview.splice(fuelMatchIdx, 1)[0];
            } else {
              // Fallback: match by vehicle size
              const rank = VEHICLE_FUEL_RANK[spType] || 99;
              const sorted = availableLinesForReview.map((l, i) => ({ l, i })).sort((a, b) => (b.l.litres || 0) - (a.l.litres || 0));
              const pickIdx = rank <= 5 ? sorted[0].i : sorted[sorted.length - 1].i;
              line = availableLinesForReview.splice(pickIdx, 1)[0];
            }
          } else {
            line = availableLinesForReview.shift();
          }
        }
        return { ...sp, _matchedLine: line, _matchedItem: null, _isFuelOther: isFuelOther };
      }
      return { ...sp, _matchedLine: null, _matchedItem: null, _isFuelOther: false };
    });

    // ── Detect unmatched receipt items ──
    // In split mode: availableLinesForReview already had primary + split matches spliced out
    // In non-split mode: primary vehicle uses 1 line, rest are unmatched
    const unmatchedFuelLines = splitMode
      ? [...availableLinesForReview]
      : scannedLines.slice(1); // primary vehicle accounts for line 0
    // For other items: count how many "other" splits exist for non-fuel items
    const otherSplitCount = splits.filter(sp => sp.splitType === "other" && !FUEL_EQUIPMENT_RE.test(sp.equipment)).length;
    const unmatchedOtherItems = scannedOtherItems.length > otherSplitCount
      ? scannedOtherItems.slice(otherSplitCount) : [];
    const hasUnmatched = unmatchedFuelLines.length > 0 || unmatchedOtherItems.length > 0;

    // Auto-create splits for unmatched items
    const autoAddUnmatched = () => {
      if (!splitMode) setSplitMode(true);
      const newSplits = [];
      unmatchedFuelLines.forEach(line => {
        newSplits.push({
          id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
          splitType: "vehicle", rego: "", odometer: "",
          litres: line.litres?.toString() || "",
          ppl: line.pricePerLitre?.toString() || "",
          division: "", vehicleType: "", _match: null,
          equipment: "", fleetCard: "", cardRego: "", notes: "",
          _autoFuelType: line.fuelType || "",
        });
      });
      unmatchedOtherItems.forEach(item => {
        newSplits.push({
          id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
          splitType: "other", rego: "", odometer: "",
          litres: item.litres?.toString() || "",
          ppl: item.pricePerLitre?.toString() || "",
          division: "", vehicleType: "", _match: null,
          equipment: item.description || "Other",
          fleetCard: "", cardRego: "", notes: "",
        });
      });
      setSplits(prev => [...prev, ...newSplits]);
      showToast(`Added ${newSplits.length} entr${newSplits.length === 1 ? "y" : "ies"} from receipt`);
    };

    return (
      <div className="fade-in">
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>Review & Confirm</div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>
            {splitMode ? `Split receipt \u2014 ${1 + splits.length} items \u00B7 ` : ""}Tap any value to edit
          </div>
        </div>

        {/* Future date blocking popup */}
        {(() => {
          if (!receiptData?.date) return null;
          if (!isAfterSydneyToday(receiptData.date)) return null;
          return (
            <div className="fade-in" style={{
              background: "#fef2f2", border: "2px solid #dc2626", borderRadius: 10,
              padding: "16px", marginBottom: 16, textAlign: "center",
            }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{"\u26D4"}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#dc2626", marginBottom: 6 }}>
                Future Date Detected — This is Impossible
              </div>
              <div style={{ fontSize: 13, color: "#991b1b", marginBottom: 10, lineHeight: 1.5 }}>
                The date "<strong>{receiptData.date}</strong>" is in the future. Receipts can only be from today or earlier.
                The AI may have misread the date. Please scroll down and correct the date before submitting.
              </div>
              {receiptData._originalDate && receiptData._originalDate !== receiptData.date && (
                <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 8 }}>
                  AI originally read: "{receiptData._originalDate}" — auto-corrected but still invalid
                </div>
              )}
              <div style={{ fontSize: 12, color: "#b91c1c", fontWeight: 600 }}>
                {"\u2193"} Fix the date in the "Date" field below
              </div>
            </div>
          );
        })()}

        {/* Date cross-validation mismatch banner */}
        {dateCrossValidation?.issues?.length > 0 && (() => {
          if (receiptData?.date && isAfterSydneyToday(receiptData.date)) return null; // future date banner already showing
          return (
            <div className="fade-in" style={{
              background: "#fffbeb", border: "2px solid #f59e0b", borderRadius: 10,
              padding: "14px 16px", marginBottom: 16,
            }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#92400e", marginBottom: 6 }}>
                {"\u26A0"} Date May Be Misread
              </div>
              <div style={{ fontSize: 12, color: "#78350f", marginBottom: 8, lineHeight: 1.5 }}>
                {dateCrossValidation.issues.map((iss, i) => <div key={i}>{"\u2022"} {iss.message} <span style={{ fontSize: 10, color: "#a16207" }}>({iss.signal})</span></div>)}
              </div>
              {dateCrossValidation.suggestedDateStr && (
                <button onClick={() => {
                  setReceiptData(d => ({...d, date: dateCrossValidation.suggestedDateStr, _futureDateDetected: false, _futureDateCorrected: false}));
                  setDateCrossValidation(null);
                }} style={{
                  background: "#f59e0b", color: "white", border: "none", borderRadius: 8,
                  padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer",
                }}>
                  Use Suggested Date: {dateCrossValidation.suggestedDateStr}
                </button>
              )}
              {!dateCrossValidation.suggestedDateStr && (
                <div style={{ fontSize: 12, color: "#b45309", fontWeight: 600 }}>
                  {"\u2193"} Please verify the date in the field below
                </div>
              )}
            </div>
          );
        })()}

        {/* Unmatched receipt items warning */}
        {hasUnmatched && (
          <div style={{
            background: "#fffbeb", border: "2px solid #fbbf24", borderRadius: 10,
            padding: "12px 14px", marginBottom: 16,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#92400e", marginBottom: 6 }}>
              {"\u26A0"} Receipt has items you haven't added yet
            </div>
            <div style={{ fontSize: 12, color: "#78350f", marginBottom: 10 }}>
              The scanned receipt shows {unmatchedFuelLines.length > 0 && (
                <strong>{unmatchedFuelLines.length} extra fuel line{unmatchedFuelLines.length !== 1 ? "s" : ""}</strong>
              )}
              {unmatchedFuelLines.length > 0 && unmatchedOtherItems.length > 0 && " and "}
              {unmatchedOtherItems.length > 0 && (
                <strong>{unmatchedOtherItems.length} other item{unmatchedOtherItems.length !== 1 ? "s" : ""}</strong>
              )}
              {" "}that {unmatchedFuelLines.length + unmatchedOtherItems.length === 1 ? "isn't" : "aren't"} assigned to any entry.
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
              {unmatchedFuelLines.map((line, i) => (
                <div key={`uf-${i}`} style={{
                  background: "white", border: "1px solid #fbbf24", borderRadius: 6,
                  padding: "5px 10px", fontSize: 11,
                }}>
                  <span style={{ fontWeight: 700, color: "#92400e" }}>{"\u26FD"} {line.fuelType || "Fuel"}</span>
                  {line.litres != null && <span style={{ color: "#78350f" }}> {line.litres}L</span>}
                  {line.cost != null && <span style={{ color: "#78350f" }}> ${line.cost.toFixed(2)}</span>}
                </div>
              ))}
              {unmatchedOtherItems.map((item, i) => (
                <div key={`uo-${i}`} style={{
                  background: "white", border: "1px solid #fbbf24", borderRadius: 6,
                  padding: "5px 10px", fontSize: 11,
                }}>
                  <span style={{ fontWeight: 700, color: "#1e40af" }}>{"\uD83D\uDEE2"} {item.description || "Other"}</span>
                  {item.litres != null && <span style={{ color: "#78350f" }}> {item.litres}L</span>}
                  {item.cost != null && <span style={{ color: "#78350f" }}> ${item.cost.toFixed(2)}</span>}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={autoAddUnmatched} style={{
                padding: "8px 14px", borderRadius: 7, fontSize: 12, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
                background: "#f59e0b", color: "white", border: "none",
              }}>Add {unmatchedFuelLines.length + unmatchedOtherItems.length} entr{unmatchedFuelLines.length + unmatchedOtherItems.length === 1 ? "y" : "ies"} automatically</button>
              <button onClick={() => setStep(2)} style={{
                padding: "8px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
                background: "white", color: "#92400e", border: "1px solid #fbbf24",
              }}>{"\u2190"} Go back & add manually</button>
            </div>
          </div>
        )}

        {splitMode && (
          <div style={{ fontSize: 12, fontWeight: 700, color: "#15803d", marginBottom: 6 }}>Vehicle 1 (primary)</div>
        )}

        {/* Fuel Receipt Section */}
        <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>
          <div style={{ background: "#f0fdf4", padding: "8px 14px", fontSize: 11, fontWeight: 700, color: "#15803d", letterSpacing: "0.04em", textTransform: "uppercase", borderBottom: "1px solid #86efac" }}>
            {"\u26FD"} Fuel Receipt Details
          </div>
          {vehicleRows.map(({ label, val, set, warn }, i) => (
            <div key={label}>
              <div style={rowStyle(i, vehicleRows.length)}>
                <span style={labelStyle}>{label}</span>
                {set ? (
                  <input value={val} onChange={e => set(e.target.value)} style={{...inputStyle, ...(warn ? { color: "#dc2626", fontWeight: 700 } : {})}} onFocus={focusStyle} onBlur={blurStyle} />
                ) : (
                  <span style={{ fontWeight: 500, color: "#0f172a", textAlign: "right", fontSize: 13 }}>{val || "\u2014"}</span>
                )}
              </div>
              {warn && <div style={{ padding: "4px 14px 6px", fontSize: 11, color: "#dc2626", fontWeight: 600, background: "#fef2f2", borderBottom: "1px solid #fca5a5" }}>{"\u26A0"} {warn}</div>}
            </div>
          ))}
        </div>

        {/* Fleet Card Section */}
        {hasCardData && (() => {
          const conf = cardData?._confidence || "none";
          const isLow = conf === "low";
          const borderColor = isLow ? "#fca5a5" : "#fdba74";
          const bgColor = isLow ? "#fef2f2" : "#fff7ed";
          const textColor = isLow ? "#dc2626" : "#c2410c";
          return (
          <div style={{ background: "white", border: `2px solid ${borderColor}`, borderRadius: 10, overflow: "hidden", marginBottom: splitMode ? 12 : 20 }}>
            <div style={{ background: bgColor, padding: "10px 14px", borderBottom: `1px solid ${borderColor}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: textColor, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                {"\uD83D\uDCB3"} Fleet Card Details
                {isLow && <span style={{ marginLeft: 8, padding: "2px 8px", background: "#dc2626", color: "white", borderRadius: 4, fontSize: 9, fontWeight: 700, letterSpacing: "0.05em" }}>UNSURE</span>}
                {cardData?._learnedMatch && <span style={{ marginLeft: 8, padding: "2px 8px", background: "#16a34a", color: "white", borderRadius: 4, fontSize: 9, fontWeight: 700, letterSpacing: "0.05em" }}>LEARNED</span>}
              </div>
              <div style={{ fontSize: 11, color: isLow ? "#dc2626" : "#92400e", marginTop: 3, fontWeight: isLow ? 700 : 500 }}>
                {cardData?._learnedMatch
                  ? "\u2705 Auto-corrected using a previously learned correction from a manual edit"
                  : isLow
                  ? "\u26A0 Low confidence match — the AI could not clearly read this fleet card. Please verify the card number and rego manually."
                  : "\u26A0 Please double-check the card number and rego below — AI scanning can misread embossed card text"}
              </div>
              {isLow && cardData?._originalCard && (
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>
                  AI read: card "{formatCardNumber(cardData._originalCard)}"{cardData._originalRego ? `, rego "${cardData._originalRego}"` : ""} — auto-corrected to closest match
                </div>
              )}
              {cardData?._confusableRegos && (
                <div style={{ fontSize: 11, color: "#b45309", marginTop: 6, padding: "6px 10px", background: "#fffbeb", borderRadius: 6, border: "1px solid #fcd34d" }}>
                  <strong>{"\u26A0"} Similar regos detected:</strong> {cardData._confusableRegos.join(", ")} — please confirm which vehicle this is for
                </div>
              )}
            </div>
            {cardRows.map(({ label, val, set }, i) => (
              <div key={label} style={rowStyle(i, cardRows.length)}>
                <span style={labelStyle}>{label}</span>
                <input value={val} onChange={e => set(e.target.value)} style={{...inputStyle, fontWeight: 700, color: isLow ? "#dc2626" : "#c2410c"}} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
            ))}
          </div>
          );
        })()}
        {!hasCardData && <div style={{ marginBottom: splitMode ? 12 : 20 }} />}

        {/* Split entries — matched to scanned data */}
        {splitMode && splitPreviews.map((sp, si) => {
          const isOther = sp.splitType === "other";
          const ml = sp._matchedLine;
          const mi = sp._matchedItem;

          let spRows;
          if (isOther && (mi || ml)) {
            // Matched to a scanned item or fuel line
            const srcLitres = mi?.litres || ml?.litres || null;
            const srcCost = mi?.cost || ml?.cost || null;
            const srcPpl = mi?.pricePerLitre || ml?.pricePerLitre || (srcLitres > 0 && srcCost > 0 ? parseFloat((srcCost / srcLitres).toFixed(4)) : null);
            const displayLitres = srcLitres?.toString() || sp.litres || "";
            const displayPpl = srcPpl?.toString() || "";
            const displayCost = sp._costOverride || srcCost?.toFixed(2) || (parseFloat(displayLitres) > 0 && srcPpl > 0 ? (parseFloat(displayLitres) * srcPpl).toFixed(2) : "");
            spRows = [
              { label: "Equipment", val: sp.equipment, set: v => updateSplit(sp.id, "equipment", v) },
              { label: "Matched to", val: (mi?.description || ml?.fuelType || "") + (mi?.quantity ? ` (${mi.quantity})` : ""), set: null },
              { label: "Litres", val: displayLitres, set: v => updateSplit(sp.id, "litres", v) },
              { label: "$/L", val: sp._pplOverride || displayPpl, set: v => updateSplit(sp.id, "_pplOverride", v) },
              { label: "Cost", val: displayCost, set: v => updateSplit(sp.id, "_costOverride", v) },
              { label: "Notes", val: sp.notes || "", set: v => updateSplit(sp.id, "notes", v) },
            ];
          } else if (isOther) {
            const spLitres = parseFloat(sp.litres) || 0;
            // Try to find a matching otherItem by equipment name for price lookup
            const otherMatch = scannedOtherItems.find(oi => oi.description && sp.equipment && oi.description.toLowerCase().includes(sp.equipment.toLowerCase()));
            const otherPpl = otherMatch?.pricePerLitre || (otherMatch?.litres > 0 && otherMatch?.cost > 0 ? parseFloat((otherMatch.cost / otherMatch.litres).toFixed(4)) : null);
            const otherCost = otherMatch?.cost || (spLitres && otherPpl ? spLitres * otherPpl : (spLitres && globalPpl ? spLitres * globalPpl : null));
            spRows = [
              { label: "Equipment", val: sp.equipment, set: v => updateSplit(sp.id, "equipment", v) },
              { label: "Litres", val: sp.litres, set: v => updateSplit(sp.id, "litres", v) },
              { label: "$/L", val: sp._pplOverride || otherPpl?.toString() || globalPpl?.toString() || "", set: v => updateSplit(sp.id, "_pplOverride", v) },
              { label: "Cost", val: sp._costOverride || (otherCost ? otherCost.toFixed(2) : ""), set: v => updateSplit(sp.id, "_costOverride", v) },
              { label: "Notes", val: sp.notes || "", set: v => updateSplit(sp.id, "notes", v) },
            ];
          } else {
            const spMatch = sp._match || lookupRego(sp.rego, learnedDBRef.current, entriesRef.current);
            // Price: user-entered > scanned line > global
            const spUserPpl = parseFloat(sp.ppl) || 0;
            const spPpl = spUserPpl > 0 ? spUserPpl : (ml?.pricePerLitre || globalPpl || 0);
            // Litres priority: user-entered > AI scanned line > remainder calculation
            const spUserLitres = parseFloat(sp.litres) || 0;
            let spDisplayLitres = sp.litres;
            let litresSource = spUserLitres > 0 ? "user" : null;
            if (!spUserLitres && ml?.litres) {
              // AI matched a scanned line with litres — use it
              spDisplayLitres = ml.litres.toString();
              litresSource = "scan";
            }
            if (!spUserLitres && !ml?.litres && receiptData?.litres > 0) {
              // No user input and no matched line — try remainder calculation
              const v1Used = parseFloat(form.litres) || 0;
              const otherUsed = splits.filter(s => s.splitType === "vehicle" && s.id !== sp.id).reduce((s, o) => s + (parseFloat(o.litres) || 0), 0);
              const rem = parseFloat((receiptData.litres - v1Used - otherUsed).toFixed(2));
              if (rem > 0) { spDisplayLitres = rem.toString(); litresSource = "remainder"; }
            }
            const spFinalLitres = parseFloat(spDisplayLitres) || 0;
            // Cost: use scanned line cost if litres match, otherwise calculate
            let spCalcCost;
            if (ml?.cost && ml?.litres && spFinalLitres > 0 && Math.abs(spFinalLitres - ml.litres) < 0.5) {
              spCalcCost = ml.cost.toFixed(2);
            } else {
              spCalcCost = spFinalLitres > 0 && spPpl > 0 ? (spFinalLitres * spPpl).toFixed(2) : "";
            }
            spRows = [
              { label: "Registration", val: sp.rego, set: v => updateSplit(sp.id, "rego", v.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6)) },
              { label: "Vehicle", val: sp._vehicleOverride || spMatch?.n || spMatch?.t || "\u2014", set: v => updateSplit(sp.id, "_vehicleOverride", v) },
              { label: "Fuel type", val: sp._fuelTypeOverride || ml?.fuelType || "", set: v => updateSplit(sp.id, "_fuelTypeOverride", v) },
              { label: isHoursBased(sp.vehicleType) ? "Hour Meter" : "Odometer", val: sp.odometer, set: v => updateSplit(sp.id, "odometer", v) },
              { label: "Litres", val: spDisplayLitres, set: v => updateSplit(sp.id, "litres", v) },
              { label: "$/L", val: sp._pplOverride || spPpl?.toString() || "", set: v => updateSplit(sp.id, "_pplOverride", v) },
              { label: "Cost", val: sp._costOverride || spCalcCost, set: v => updateSplit(sp.id, "_costOverride", v) },
            ];
            // Show hint if values were auto-filled from AI scan
            if (litresSource === "scan" && ml) {
              spRows.push({ label: "\uD83E\uDD16 Auto-filled", val: `From receipt line: ${ml.fuelType || "fuel"} — ${ml.litres}L @ $${ml.pricePerLitre || "?"}/L`, set: null });
            }
          }
          return (
            <div key={sp.id}>
              <div style={{ fontSize: 12, fontWeight: 700, color: isOther ? "#854d0e" : "#1e40af", marginBottom: 6 }}>
                {isOther ? `\u26FD Other ${si + 2}` : `\uD83D\uDE97 Vehicle ${si + 2}`}
                {ml && <span style={{ fontWeight: 400, color: "#94a3b8", marginLeft: 6, fontSize: 10 }}>{"\u2190"} matched to fuel line {scannedLines.indexOf(ml) + 1}</span>}
                {mi && <span style={{ fontWeight: 400, color: "#94a3b8", marginLeft: 6, fontSize: 10 }}>{"\u2190"} matched to {mi.description}</span>}
              </div>
              <div style={{ background: "white", border: `1px solid ${isOther ? "#fde047" : "#e2e8f0"}`, borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>
                {spRows.map(({ label, val, set }, i) => (
                  <div key={label} style={rowStyle(i, spRows.length)}>
                    <span style={labelStyle}>{label}</span>
                    {set ? (
                      <input value={val} onChange={e => set(e.target.value)} style={inputStyle} onFocus={focusStyle} onBlur={blurStyle} />
                    ) : (
                      <span style={{ fontWeight: 500, color: "#0f172a", textAlign: "right", fontSize: 13 }}>{val || "\u2014"}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {splitMode && receiptData?.totalCost && (
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16, padding: "8px 12px", background: "#f8fafc", borderRadius: 6, border: "1px solid #e2e8f0" }}>
            <strong>Receipt total:</strong> ${receiptData.totalCost} {"\u00B7"} Split across {1 + splits.length} items
          </div>
        )}

        {/* Duplicate entry warning */}
        {(() => {
          const rego = form.registration?.trim().toUpperCase();
          const dateStr = receiptData?.date || "";
          const litres = parseFloat(receiptData?.litres) || 0;
          if (!rego || !dateStr) return null;
          const dupe = entries.find(e =>
            e.registration === rego && e.date === dateStr &&
            litres > 0 && e.litres && Math.abs(e.litres - litres) < litres * 0.1
          );
          if (!dupe) return null;
          return (
            <div style={{
              fontSize: 12, color: "#b91c1c", background: "#fef2f2", border: "2px solid #fca5a5",
              borderRadius: 8, padding: "10px 12px", marginBottom: 12, textAlign: "left",
            }}>
              <strong>{"\u26A0"} Possible duplicate!</strong> An entry for <strong>{rego}</strong> on <strong>{dateStr}</strong> with <strong>{dupe.litres}L</strong> already exists.
              Are you sure this is a different fill-up?
            </div>
          );
        })()}

        {/* Warning if unmatched items exist — user can still submit, but will be prompted after */}
        {hasUnmatched && !splitMode && (
          <div style={{
            fontSize: 11, color: "#92400e", background: "#fffbeb", border: "1px solid #fbbf24",
            borderRadius: 8, padding: "8px 12px", marginBottom: 12, textAlign: "left",
          }}>
            <strong>{"\u26A0"} Heads up:</strong> Your receipt has extra items that aren't included yet.
            You can submit now and we'll ask you about them on the next screen,
            or go back to add them manually.
          </div>
        )}

        {renderReviewConfirmGate()}
        <div style={{ display: "flex", gap: 10 }}>
          <SecondaryBtn onClick={() => setStep(2)}>{"\u2190"} Back</SecondaryBtn>
          <div style={{ flex: 1 }}>
            <PrimaryBtn onClick={handleSubmit} loading={saving} disabled={!canSubmitReview}>
              {splitMode ? `Submit ${1 + splits.length} Entries` : hasUnmatched ? "Submit & Review Extras" : "Submit Entry"}
            </PrimaryBtn>
          </div>
        </div>
      </div>
    );
  };

  // Save a single pending extra entry (vehicle or other)
  const savePendingExtra = async (draft) => {
    const now = new Date().toISOString();
    const driverName = normalizeDriverName(`${draft.driverFirstName || ""} ${draft.driverLastName || ""}`.trim());

    if (draft._type === "vehicle") {
      if (!draft.rego) { showToast("Please enter a rego for this vehicle"); return; }
      if (!draft.odometer) { showToast("Please enter an odometer/hour reading"); return; }
      const match = lookupRego(draft.rego, learnedDBRef.current, entriesRef.current);
      const entry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        submittedAt: now,
        driverName,
        registration: draft.rego.trim().toUpperCase(),
        division: draft.division || match?.d || getDivision(draft.vehicleType),
        vehicleType: draft.vehicleType || match?.t || "",
        odometer: toNum(draft.odometer),
        date: draft.date,
        litres: toNum(draft.litres),
        pricePerLitre: toNum(draft.pricePerLitre),
        // Prefer explicit cost; else compute litres × ppl. toNum() preserves
        // a legitimate $0 (unlike `|| null`, which dropped zero silently).
        totalCost: (() => {
          const explicit = toNum(draft.cost);
          if (explicit !== null) return explicit;
          const l = toNum(draft.litres), p = toNum(draft.pricePerLitre);
          return (l !== null && p !== null) ? l * p : null;
        })(),
        station: draft.station,
        fuelType: draft.fuelType || match?.f || "",
        fleetCardNumber: draft.fleetCardNumber || match?.c || "",
        cardRego: cardData?.vehicleOnCard || "",
        splitReceipt: true,
        splitGroup: draft._splitGroup || null,
        hasReceipt: !!receiptB64,
        _aiConfidence: receiptData?.confidence?.overall || null,
        _aiIssues: ["Auto-detected extra fuel line from receipt"],
        // _cardConfidence now tracks the AI's own confidence in its read,
        // NOT the matcher's confidence. This is what the "Fleet card unclear"
        // admin flag fires on — we want to know when the SCANNER was unsure,
        // not when the matcher couldn't map a confident scan.
        _cardConfidence: cardData?._aiConfidence || null,
        _cardMatchConfidence: cardData?._matchConfidence || null,
        _cardCorrected: !!cardData?._corrected,
        _cardConfusable: cardData?._confusableRegos || null,
        _cardOriginalCard: cardData?._originalCard || null,
        _cardOriginalRego: cardData?._originalRego || null,
        _cardRawRead: cardData?._rawCardRead || null,
        _cardAiIssues: cardData?._aiIssues || null,
      };
      const newEntries = insertChronological(entriesRef.current, entry);
      // persist() already saves to Supabase — the explicit saveEntry below was
      // a duplicate that doubled network traffic and opened a race window.
      await persist(newEntries, entry);
      if (receiptB64) await saveReceiptImage(entry.id, receiptB64, receiptMime);
      learnFromSubmission(entry);
    } else {
      // Other item
      if (!draft.equipment) { showToast("Please enter equipment/purpose"); return; }
      const entry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        submittedAt: now,
        entryType: "other",
        division: draft.division || "Tree",
        driverName,
        equipment: draft.equipment,
        station: draft.station,
        fleetCardNumber: draft.fleetCardNumber || "",
        cardRego: cardData?.vehicleOnCard || "",
        date: draft.date,
        litres: toNum(draft.litres),
        pricePerLitre: toNum(draft.pricePerLitre),
        // Prefer explicit cost; else compute litres × ppl. toNum() preserves
        // a legitimate $0 (unlike `|| null`, which dropped zero silently).
        totalCost: (() => {
          const explicit = toNum(draft.cost);
          if (explicit !== null) return explicit;
          const l = toNum(draft.litres), p = toNum(draft.pricePerLitre);
          return (l !== null && p !== null) ? l * p : null;
        })(),
        fuelType: draft._sourceLabel || "",
        notes: "",
        splitReceipt: true,
        splitGroup: draft._splitGroup || null,
        hasReceipt: !!receiptB64,
        linkedVehicle: draft.linkedVehicle || "",
      };
      const newEntries = [...entriesRef.current, entry];
      // persist() already saves to Supabase — the explicit saveEntry below was
      // a duplicate that doubled network traffic and opened a race window.
      await persist(newEntries, entry);
      if (receiptB64) await saveReceiptImage(entry.id, receiptB64, receiptMime);
    }

    // Mark this draft as confirmed
    setPendingExtraEntries(prev => prev.map(d =>
      d._draftId === draft._draftId ? { ...d, _confirmed: true } : d
    ));
    showToast(`${draft._type === "vehicle" ? "Vehicle" : "Other"} entry saved!`);
  };

  // Dismiss a pending extra (user says it's not needed)
  const dismissPendingExtra = (draftId) => {
    setPendingExtraEntries(prev => prev.filter(d => d._draftId !== draftId));
  };

  // Update a field on a pending extra draft
  const updatePendingExtra = (draftId, field, value) => {
    setPendingExtraEntries(prev => prev.map(d =>
      d._draftId === draftId ? { ...d, [field]: value } : d
    ));
  };

  const renderStep4 = () => {
    const parsedCost = parseFloat(receiptData?.totalCost) || parseFloat(receiptData?._rawCost) || null;
    const parsedLitres = parseFloat(receiptData?.litres) || parseFloat(receiptData?._rawLitres) || null;
    const fuelType = receiptData?.fuelType || "";
    const station = receiptData?.station || otherForm.station || "";
    const date = receiptData?.date || "";
    const hasPending = pendingExtraEntries && pendingExtraEntries.some(d => !d._confirmed);

    return (
      <div className="fade-in" style={{ textAlign: "center", padding: "24px 0" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: otherMode ? "#fefce8" : hasPending ? "#fffbeb" : "#f0fdf4", border: `2px solid ${otherMode ? "#fde047" : hasPending ? "#fbbf24" : "#86efac"}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 28 }}>{hasPending ? "\u26A0" : "\u2713"}</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: otherMode ? "#854d0e" : hasPending ? "#92400e" : "#15803d", marginBottom: 6 }}>
          {otherMode ? "Claim Saved!" : splitMode ? `${1 + splits.length} Entries Saved!` : "Entry Saved!"}
        </div>
        {hasPending && (
          <div style={{ fontSize: 13, color: "#92400e", fontWeight: 600, marginBottom: 16 }}>
            But wait — we found extra items on your receipt!
          </div>
        )}
        {!hasPending && <div style={{ height: 10 }} />}

        {/* Summary card */}
        <div style={{
          background: "white", border: "1px solid #e2e8f0", borderRadius: 10,
          padding: "16px", textAlign: "left", marginBottom: hasPending ? 12 : 20,
        }}>
          {/* Primary entry */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                {otherMode ? otherForm.equipment : form.registration.toUpperCase()}
              </div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                {`${form.driverFirstName} ${form.driverLastName}`.trim()}{date ? ` \u00B7 ${date}` : ""}
              </div>
            </div>
            {parsedCost && <div style={{ fontSize: 20, fontWeight: 700, color: "#16a34a" }}>${parsedCost.toFixed(2)}</div>}
          </div>

          {/* Detail pills */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: splitMode ? 10 : 0 }}>
            {parsedLitres && <span style={{ padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 500, background: "#f0fdf4", color: "#15803d", border: "1px solid #86efac" }}>{parsedLitres.toFixed(1)}L</span>}
            {fuelType && <span style={{ padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 500, background: "#f8fafc", color: "#374151", border: "1px solid #e2e8f0" }}>{fuelType}</span>}
            {!otherMode && form.division && <span style={{ padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 500, background: form.division === "Tree" ? "#f0fdf4" : "#faf5ff", color: form.division === "Tree" ? "#15803d" : "#7c3aed", border: `1px solid ${form.division === "Tree" ? "#86efac" : "#c4b5fd"}` }}>{form.division}</span>}
            {!otherMode && form.vehicleType && <span style={{ padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 500, background: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0" }}>{form.vehicleType}</span>}
            {!otherMode && form.odometer && <span style={{ padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 500, background: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0" }}>{parseFloat(form.odometer).toLocaleString()} {isHoursBased(form.vehicleType) ? "hrs" : "km"}</span>}
            {station && <span style={{ padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 500, background: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0" }}>{station}</span>}
          </div>

          {/* Split items */}
          {splitMode && splits.length > 0 && (
            <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 10 }}>
              {splits.map((sp, i) => (
                <div key={sp.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", fontSize: 12 }}>
                  <span style={{ color: "#374151" }}>
                    {sp.splitType === "other"
                      ? `\u26FD ${sp.equipment || "Other"}`
                      : `\uD83D\uDE97 ${(sp.rego || "?").toUpperCase()}`
                    }
                  </span>
                  <span style={{ color: "#64748b" }}>
                    {sp.litres ? `${sp.litres}L` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Pending extra entries auto-detected from receipt ── */}
        {pendingExtraEntries && pendingExtraEntries.length > 0 && (
          <div style={{ textAlign: "left", marginBottom: 16 }}>
            {pendingExtraEntries.map((draft, di) => {
              if (draft._confirmed) {
                return (
                  <div key={draft._draftId} style={{
                    background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10,
                    padding: "10px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 8,
                  }}>
                    <span style={{ fontSize: 18 }}>{"\u2713"}</span>
                    <span style={{ fontSize: 12, color: "#15803d", fontWeight: 600 }}>
                      {draft._type === "vehicle" ? `${draft.rego} — saved` : `${draft.equipment} — saved`}
                    </span>
                  </div>
                );
              }

              const isVehicle = draft._type === "vehicle";
              return (
                <div key={draft._draftId} style={{
                  background: "#fffbeb", border: "2px solid #fbbf24", borderRadius: 10,
                  padding: "14px", marginBottom: 10,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#92400e" }}>
                      {isVehicle ? `\u26FD Extra fuel line detected` : `\uD83D\uDEE2 Extra item detected`}
                    </div>
                    <button onClick={() => dismissPendingExtra(draft._draftId)} style={{
                      padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600,
                      background: "white", color: "#94a3b8", border: "1px solid #e2e8f0", cursor: "pointer",
                    }}>Not needed</button>
                  </div>

                  {/* What we detected */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                    <span style={{ padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600, background: "white", color: "#92400e", border: "1px solid #fbbf24" }}>{draft._sourceLabel}</span>
                    {draft.litres && <span style={{ padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 500, background: "white", color: "#374151", border: "1px solid #e2e8f0" }}>{draft.litres}L</span>}
                    {draft.pricePerLitre && <span style={{ padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 500, background: "white", color: "#374151", border: "1px solid #e2e8f0" }}>${draft.pricePerLitre}/L</span>}
                    {draft.cost && <span style={{ padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600, background: "white", color: "#16a34a", border: "1px solid #86efac" }}>${draft.cost.toFixed ? draft.cost.toFixed(2) : draft.cost}</span>}
                  </div>

                  {/* Input fields the user needs to fill in */}
                  <div style={{ fontSize: 12, color: "#78350f", fontWeight: 600, marginBottom: 6 }}>
                    {isVehicle ? "Which vehicle was this fuel for?" : "What was this item for?"}
                  </div>

                  {isVehicle ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <input value={draft.rego || ""} onChange={e => updatePendingExtra(draft._draftId, "rego", e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6))}
                          placeholder="Vehicle rego *" style={{
                            flex: 1, padding: "8px 10px", borderRadius: 7, fontSize: 13, fontWeight: 700,
                            border: "2px solid #fbbf24", background: "white", outline: "none", fontFamily: "inherit",
                          }}
                          onBlur={() => {
                            if (draft.rego) {
                              const m = lookupRego(draft.rego, learnedDBRef.current, entriesRef.current);
                              if (m) {
                                updatePendingExtra(draft._draftId, "division", m.d || "");
                                updatePendingExtra(draft._draftId, "vehicleType", m.t || "");
                              }
                            }
                          }}
                        />
                        <input value={draft.odometer || ""} onChange={e => updatePendingExtra(draft._draftId, "odometer", e.target.value)}
                          placeholder={isHoursBased(draft.vehicleType) ? "Hour reading *" : "Odometer *"} type="number" style={{
                            flex: 1, padding: "8px 10px", borderRadius: 7, fontSize: 13,
                            border: "2px solid #fbbf24", background: "white", outline: "none", fontFamily: "inherit",
                          }}
                        />
                      </div>
                      {draft.rego && (() => {
                        const m = lookupRego(draft.rego, learnedDBRef.current, entriesRef.current);
                        return m ? (
                          <div style={{ fontSize: 11, color: "#15803d", fontWeight: 500 }}>
                            {"\u2713"} {m.n || m.t} — {m.d} {m.t ? `(${m.t})` : ""}
                          </div>
                        ) : null;
                      })()}
                    </div>
                  ) : (
                    <input value={draft.equipment || ""} onChange={e => updatePendingExtra(draft._draftId, "equipment", e.target.value)}
                      placeholder="Equipment/purpose" style={{
                        width: "100%", padding: "8px 10px", borderRadius: 7, fontSize: 13,
                        border: "2px solid #fbbf24", background: "white", outline: "none", fontFamily: "inherit",
                        boxSizing: "border-box",
                      }}
                    />
                  )}

                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button onClick={() => savePendingExtra(draft)} style={{
                      flex: 1, padding: "10px", borderRadius: 7, fontSize: 13, fontWeight: 700,
                      cursor: "pointer", fontFamily: "inherit",
                      background: "#f59e0b", color: "white", border: "none",
                    }}>{"\u2713"} Save this entry</button>
                  </div>
                </div>
              );
            })}

            {/* Dismiss all button */}
            {hasPending && (
              <button onClick={() => setPendingExtraEntries(prev => prev.filter(d => d._confirmed))} style={{
                width: "100%", padding: "8px", borderRadius: 7, fontSize: 11, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit", marginTop: 4,
                background: "white", color: "#94a3b8", border: "1px solid #e2e8f0",
              }}>Dismiss all extra items — they're not needed</button>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <SecondaryBtn onClick={resetForm}>+ New Entry</SecondaryBtn>
        </div>
      </div>
    );
  };


  // ── Data view ─────────────────────────────────────────────────────────────
  const renderData = () => {
    // Separate vehicle entries from "other" claims
    const vehicleEntries = entries.filter(e => e.entryType !== "other" && e.registration);

    // Build available vehicle types for filter
    const allVehicleTypes = [...new Set(vehicleEntries.map(e => e.vehicleType).filter(Boolean))].sort();

    // Apply search filter
    const searchTerm = dataSearch.trim().toUpperCase();
    const searchFiltered = searchTerm
      ? vehicleEntries.filter(e =>
          (e.registration || "").toUpperCase().includes(searchTerm) ||
          (e.driverName || "").toUpperCase().includes(searchTerm) ||
          (e.vehicleType || "").toUpperCase().includes(searchTerm) ||
          (e.division || "").toUpperCase().includes(searchTerm) ||
          (e.vehicleName || "").toUpperCase().includes(searchTerm)
        )
      : vehicleEntries;

    // Apply division/type filter
    const filtered = dataFilter === "All" ? searchFiltered
      : DIVISION_KEYS.includes(dataFilter) ? searchFiltered.filter(e => (e.division || getDivision(e.vehicleType)) === dataFilter)
      : searchFiltered.filter(e => e.vehicleType === dataFilter);

    // Group: division → vehicleType → rego (skip entries with no registration)
    const divGroups = {};
    filtered.forEach(e => {
      if (!e.registration) return;
      const div = e.division || getDivision(e.vehicleType) || "Tree";
      const vt = e.vehicleType || "Other";
      if (!divGroups[div]) divGroups[div] = {};
      if (!divGroups[div][vt]) divGroups[div][vt] = {};
      if (!divGroups[div][vt][e.registration]) divGroups[div][vt][e.registration] = [];
      divGroups[div][vt][e.registration].push(e);
    });

    const totalSpend = entries.reduce((s, e) => s + (e.totalCost || 0), 0);
    const regoCount = new Set(vehicleEntries.map(e => e.registration)).size;
    const filteredRegoCount = new Set(filtered.map(e => e.registration)).size;

    // Count flags directly from the SAME enriched objects the modal uses.
    // Regenerating flags via a parallel loop (as we used to) risked producing
    // flag.text values that differed in whitespace/derived numbers, so the
    // resolvedFlags[flagId] lookup would miss and counts would never drop.
    let totalFlags = 0;
    let totalAiFlags = 0;
    fleetAnalysis.forEach(v => {
      v.flags.forEach(f => {
        if (f.type !== "danger" && f.type !== "warn") return;
        if (resolvedFlags[flagId(f)]) return;
        if (f.category === "ops") totalFlags++;
        else if (f.category === "ai") totalAiFlags++;
      });
    });

    return (
      <div onClick={() => vehicleMenu && setVehicleMenu(null)}>
        {/* Summary stats */}
        <div className="kpi-grid-4" style={{ marginBottom: 20 }}>
          {[
            { label: "Entries", value: entries.length, color: "#16a34a" },
            { label: "Total Spend", value: `$${totalSpend.toFixed(0)}`, color: "#16a34a" },
            { label: "Vehicles", value: regoCount, color: "#16a34a" },
          ].map(s => (
            <div key={s.label} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
          {/* Flags button — clickable to open issues */}
          <div onClick={() => { if (totalFlags > 0) { setShowFlags(true); setFlagsFilter("open"); } }}
            style={{ background: "white", border: `1px solid ${totalFlags > 0 ? "#fca5a5" : "#e2e8f0"}`, borderRadius: 10, padding: "10px 8px", textAlign: "center", cursor: totalFlags > 0 ? "pointer" : "default", transition: "all 0.15s" }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: totalFlags > 0 ? "#dc2626" : "#16a34a" }}>{totalFlags > 0 ? "\u26A0" : "\u2713"} {totalFlags}</div>
            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2, fontWeight: 500 }}>Flags</div>
          </div>
        </div>

        {/* AI Review Banner */}
        {isAdmin && totalAiFlags > 0 && (
          <div onClick={() => setShowAiReview(!showAiReview)} style={{
            background: showAiReview ? "#ede9fe" : "#fefce8", border: `1px solid ${showAiReview ? "#a78bfa" : "#fcd34d"}`,
            borderRadius: 10, padding: "12px 14px", marginBottom: 16, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>{"\uD83E\uDD16"}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                  {totalAiFlags} potential mistake{totalAiFlags !== 1 ? "s" : ""} to review
                </div>
                <div style={{ fontSize: 11, color: "#64748b" }}>
                  AI flagged entries that may have scanning errors or incorrect data
                </div>
              </div>
            </div>
            <span style={{ fontSize: 14, color: "#64748b" }}>{showAiReview ? "\u25B2" : "\u25BC"}</span>
          </div>
        )}

        {/* AI Review Panel */}
        {isAdmin && showAiReview && (() => {
          // Reuse fleetAnalysis enriched flags so IDs match the KPI + modal exactly
          const aiFlags = [];
          fleetAnalysis.forEach(v => {
            v.flags.forEach(f => {
              if (f.category !== "ai") return;
              if (f.type !== "danger" && f.type !== "warn") return;
              const fid = flagId(f);
              if (resolvedFlags[fid]) return;
              aiFlags.push({ ...f, _id: fid });
            });
          });

          if (aiFlags.length === 0) return (
            <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: "16px", marginBottom: 16, textAlign: "center" }}>
              <span style={{ fontSize: 16 }}>{"\u2713"}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#15803d", marginLeft: 8 }}>All AI flags reviewed</span>
            </div>
          );

          return (
            <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px", marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                {"\uD83E\uDD16"} AI Scan Review
                <span style={{ fontSize: 11, fontWeight: 500, color: "#64748b" }}>— tap an entry to edit and correct</span>
              </div>
              {aiFlags.map(f => (
                <div key={f._id} style={{
                  padding: "10px 12px", marginBottom: 8, borderRadius: 8,
                  background: f.type === "danger" ? "#fef2f2" : "#fffbeb",
                  border: `1px solid ${f.type === "danger" ? "#fca5a5" : "#fcd34d"}`,
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, color: "#0f172a", fontSize: 12 }}>{f.rego}</span>
                        <span style={{ fontWeight: 600, fontSize: 11, color: f.type === "danger" ? "#b91c1c" : "#92400e" }}>{f.text}</span>
                        <span style={{ color: "#94a3b8", fontSize: 10 }}>{f.date || ""}</span>
                      </div>
                      <div style={{ color: "#64748b", fontSize: 10, marginTop: 2 }}>{f.detail}</div>
                    </div>
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      {f._entry?.hasReceipt && (
                        <button onClick={() => setExpandedReceipt(expandedReceipt === f._id ? null : f._id)} style={{
                          padding: "4px 10px", borderRadius: 5, fontSize: 10, fontWeight: 600,
                          background: expandedReceipt === f._id ? "#2563eb" : "#eff6ff",
                          color: expandedReceipt === f._id ? "white" : "#2563eb",
                          border: `1px solid ${expandedReceipt === f._id ? "#2563eb" : "#bfdbfe"}`,
                          cursor: "pointer", fontFamily: "inherit",
                        }}>{"\uD83D\uDCC4"} {expandedReceipt === f._id ? "Hide" : "Receipt"}</button>
                      )}
                      <button onClick={() => setEditingEntry(f._entry)} style={{
                        padding: "4px 10px", borderRadius: 5, fontSize: 10, fontWeight: 600,
                        background: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0",
                        cursor: "pointer", fontFamily: "inherit",
                      }}>{"\u270E"} Edit</button>
                      <button onClick={() => {
                        resolveFlag(f._id, "Reviewed — no action needed", "Admin");
                      }} style={{
                        padding: "4px 10px", borderRadius: 5, fontSize: 10, fontWeight: 600,
                        background: "#f0fdf4", color: "#15803d", border: "1px solid #86efac",
                        cursor: "pointer", fontFamily: "inherit",
                      }}>{"\u2713"} OK</button>
                    </div>
                  </div>
                  {expandedReceipt === f._id && f._entry?.hasReceipt && (
                    <InlineReceipt entryId={f._entry.id} loadFn={loadReceiptImage} />
                  )}
                </div>
              ))}
            </div>
          );
        })()}

        {/* Search and filter */}
        <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
          {/* Search bar */}
          <div style={{ position: "relative", marginBottom: 10 }}>
            <input
              value={dataSearch} onChange={e => setDataSearch(e.target.value)}
              placeholder="Search rego, driver, vehicle type..."
              style={{
                width: "100%", padding: "10px 12px 10px 34px", borderRadius: 8, border: "1px solid #e2e8f0",
                fontSize: 13, outline: "none", fontFamily: "inherit", color: "#0f172a",
              }}
              onFocus={e => e.target.style.borderColor = "#22c55e"}
              onBlur={e => e.target.style.borderColor = "#e2e8f0"}
            />
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: "#94a3b8" }}>{"\uD83D\uDD0D"}</span>
            {dataSearch && (
              <button onClick={() => setDataSearch("")} style={{
                position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 16,
              }}>{"\u00D7"}</button>
            )}
          </div>

          {/* Division filter */}
          <div style={{ display: "flex", gap: 5, marginBottom: 8, flexWrap: "wrap" }}>
            {["All", ...DIVISION_KEYS].map(t => {
              const isDivision = DIVISION_KEYS.includes(t);
              const dc = isDivision ? DIVISIONS[t].color : null;
              return (
                <button key={t} onClick={() => setDataFilter(dataFilter === t ? "All" : t)} style={{
                  padding: "5px 12px", borderRadius: 20, fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                  fontWeight: dataFilter === t ? 700 : 500,
                  background: dataFilter === t ? (dc ? dc.bg : "#16a34a") : "white",
                  color: dataFilter === t ? (dc ? dc.text : "white") : "#64748b",
                  border: `1px solid ${dataFilter === t ? (dc ? dc.border : "#16a34a") : "#e2e8f0"}`,
                }}>{t === "All" ? "All" : `${t === "Tree" ? "\uD83C\uDF33" : "\uD83C\uDF3F"} ${t}`}</button>
              );
            })}
          </div>

          {/* Vehicle type filter */}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {allVehicleTypes.map(t => {
              const c = VT_COLORS[t] || VT_COLORS.Other;
              const isActive = dataFilter === t;
              return (
                <button key={t} onClick={() => setDataFilter(isActive ? "All" : t)} style={{
                  padding: "3px 10px", borderRadius: 14, fontSize: 10, cursor: "pointer", fontFamily: "inherit",
                  fontWeight: isActive ? 700 : 400,
                  background: isActive ? c.bg : "white",
                  color: isActive ? c.text : "#94a3b8",
                  border: `1px solid ${isActive ? c.border : "#e2e8f0"}`,
                }}>{t}</button>
              );
            })}
          </div>

          {/* Add Vehicle button + form */}
          <div style={{ marginTop: 10, marginBottom: 8 }}>
            <button onClick={() => setShowAddVehicleData(v => !v)} style={{
              padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
              background: showAddVehicleData ? "#f8fafc" : "#16a34a",
              color: showAddVehicleData ? "#64748b" : "white",
              border: `1px solid ${showAddVehicleData ? "#e2e8f0" : "#16a34a"}`,
            }}>{showAddVehicleData ? "Cancel" : "\u2795 Add New Vehicle"}</button>
          </div>
          {showAddVehicleData && (
            <div className="fade-in" style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: "14px 16px", marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#15803d", marginBottom: 10 }}>Add New Vehicle</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: "#64748b", fontWeight: 600, marginBottom: 3 }}>Registration *</label>
                  <input value={addVehicle.rego} onChange={e => setAddVehicle(v => ({ ...v, rego: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) }))} placeholder="e.g. XP86LM" maxLength={6}
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, outline: "none", fontFamily: "inherit", color: "#0f172a", textTransform: "uppercase" }}
                    onFocus={e => e.target.style.borderColor = "#22c55e"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: "#64748b", fontWeight: 600, marginBottom: 3 }}>Division *</label>
                  <select value={addVehicle.div} onChange={e => setAddVehicle(v => ({ ...v, div: e.target.value }))} style={{
                    width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, fontFamily: "inherit", color: "#0f172a", background: "white",
                  }}>
                    {DIVISION_KEYS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: "#64748b", fontWeight: 600, marginBottom: 3 }}>Vehicle Type *</label>
                  <select value={addVehicle.type} onChange={e => setAddVehicle(v => ({ ...v, type: e.target.value }))} style={{
                    width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, fontFamily: "inherit", color: "#0f172a", background: "white",
                  }}>
                    {ALL_VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: "#64748b", fontWeight: 600, marginBottom: 3 }}>Vehicle Name</label>
                  <input value={addVehicle.name} onChange={e => setAddVehicle(v => ({ ...v, name: e.target.value }))} placeholder="e.g. Toyota Hilux"
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, outline: "none", fontFamily: "inherit", color: "#0f172a" }}
                    onFocus={e => e.target.style.borderColor = "#22c55e"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: "#64748b", fontWeight: 600, marginBottom: 3 }}>Owner/Driver</label>
                  <input value={addVehicle.owner} onChange={e => setAddVehicle(v => ({ ...v, owner: e.target.value }))} placeholder="e.g. Kyle Osborne"
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, outline: "none", fontFamily: "inherit", color: "#0f172a" }}
                    onFocus={e => e.target.style.borderColor = "#22c55e"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: "#64748b", fontWeight: 600, marginBottom: 3 }}>Fuel Type</label>
                  <select value={addVehicle.fuel} onChange={e => setAddVehicle(v => ({ ...v, fuel: e.target.value }))} style={{
                    width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, fontFamily: "inherit", color: "#0f172a", background: "white",
                  }}>
                    {["Diesel","Unleaded","Premium Unleaded","Premium Diesel","E10"].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button onClick={() => {
                const rego = addVehicle.rego.trim().toUpperCase();
                if (!rego || rego.length < 2) { showToast("Enter a registration number", "warn"); return; }
                const existing = learnedDB[rego] || {};
                const updated = {
                  ...existing,
                  t: addVehicle.type, d: addVehicle.div,
                  n: addVehicle.name.trim() || existing.n || addVehicle.type,
                  f: addVehicle.fuel || existing.f || "",
                };
                if (addVehicle.owner.trim()) updated.dr = addVehicle.owner.trim();
                const newDB = { ...learnedDB, [rego]: updated };
                persistLearned(newDB);
                showToast(`${rego} saved to vehicle database`);
                setAddVehicle({ rego: "", div: "Tree", type: "Ute", name: "", owner: "", fuel: "Diesel" });
                setShowAddVehicleData(false);
              }} style={{
                padding: "8px 20px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
                background: "#16a34a", color: "white", border: "none", width: "100%",
              }}>Save Vehicle</button>
            </div>
          )}

          {/* Filter summary */}
          {(searchTerm || dataFilter !== "All") && (
            <div style={{ marginTop: 8, fontSize: 11, color: "#64748b" }}>
              Showing {filteredRegoCount} vehicle{filteredRegoCount !== 1 ? "s" : ""} ({filtered.length} entries)
              {searchTerm && <span> matching "<strong>{dataSearch}</strong>"</span>}
              {dataFilter !== "All" && <span> in <strong>{dataFilter}</strong></span>}
              <button onClick={() => { setDataSearch(""); setDataFilter("All"); }} style={{
                background: "none", border: "none", color: "#16a34a", cursor: "pointer", fontSize: 11, fontFamily: "inherit", fontWeight: 600, marginLeft: 8,
              }}>Clear filters</button>
            </div>
          )}
        </div>

        {/* Export by division */}
        {vehicleEntries.length > 0 && (
          <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 10 }}>Export to Excel</div>
            {DIVISION_KEYS.map(dk => {
              const dc = DIVISIONS[dk].color;
              const divEntries = vehicleEntries.filter(e => (e.division || getDivision(e.vehicleType)) === dk);
              if (!divEntries.length) return null;
              const divTypes = [...new Set(divEntries.map(e => e.vehicleType || "Other"))].filter(Boolean).sort();
              return (
                <div key={dk} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: dc.text, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                    <span>{dk === "Tree" ? "\uD83C\uDF33" : "\uD83C\uDF3F"}</span> {dk}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                    {divTypes.map(t => {
                      const c = VT_COLORS[t] || VT_COLORS.Other;
                      return (
                        <button key={`${dk}-${t}`} onClick={() => exportVehicleType(divEntries, t, serviceData)} style={{
                          padding: "7px 12px", borderRadius: 7, fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 600,
                          background: c.bg, color: c.text, border: `1px solid ${c.border}`,
                        }}>{"\u2193"} {t}s</button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <button onClick={() => {
              DIVISION_KEYS.forEach(dk => {
                const divEntries = vehicleEntries.filter(e => (e.division || getDivision(e.vehicleType)) === dk);
                [...new Set(divEntries.map(e => e.vehicleType || "Other"))].filter(Boolean).forEach(t => exportVehicleType(divEntries, t, serviceData));
              });
            }} style={{ padding: "7px 12px", borderRadius: 7, fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 600, background: "#f8fafc", color: "#374151", border: "1px solid #e2e8f0", marginTop: 6 }}>
              {"\u2193"} Export All
            </button>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>Includes entry data + calculated analysis + service tracking {"\u00B7"} one tab per rego</div>
          </div>
        )}

        {/* Vehicle entries grouped by division → vehicle type → rego */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>{"\u25CB"}</div>
            <div style={{ fontWeight: 500 }}>{searchTerm ? `No vehicles matching "${dataSearch}"` : "No entries yet"}</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>{searchTerm ? "Try a different search term" : "Submit your first fuel receipt to get started"}</div>
          </div>
        ) : (
          DIVISION_KEYS.filter(dk => divGroups[dk]).map(dk => {
            const dc = DIVISIONS[dk].color;
            const vtGroups = divGroups[dk];
            return (
              <div key={dk} style={{ marginBottom: 28 }}>
                {/* Division header */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 10, marginBottom: 14,
                  padding: "8px 12px", background: dc.bg, borderRadius: 8,
                  border: `1px solid ${dc.border}`,
                }}>
                  <span style={{ fontSize: 18 }}>{dk === "Tree" ? "\uD83C\uDF33" : "\uD83C\uDF3F"}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: dc.text, letterSpacing: "0.04em" }}>{dk} Division</span>
                  <div style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: dc.text, opacity: 0.7 }}>
                    {Object.values(vtGroups).reduce((s, rg) => s + Object.values(rg).flat().length, 0)} entries
                  </span>
                </div>

                {Object.entries(vtGroups).map(([vt, regoGroups]) => (
                  <div key={vt} style={{ marginBottom: 20, marginLeft: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <Pill label={vt} color={vt} />
                      <div style={{ flex: 1, height: 1, background: "#f1f5f9" }} />
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>{Object.values(regoGroups).flat().length} entries</span>
                    </div>

                    {Object.entries(regoGroups).sort().map(([rego, regoEntries]) => {
                      const sorted = [...regoEntries].sort(sortEntries);
                      const isExpanded = expandedRego === rego;
                      const svc = getLatestService(serviceData[rego]);
                      const latestOdo = sorted[sorted.length - 1]?.odometer;
                      const svcInt = serviceInterval(vt);
                      const svcWarn = serviceWarning(vt);
                      const nextServiceDue = svc?.lastServiceKms ? svc.lastServiceKms + svcInt : null;
                      const isOverdue = nextServiceDue && latestOdo && latestOdo >= nextServiceDue;
                      const isServiceSoon = nextServiceDue && latestOdo && !isOverdue && (nextServiceDue - latestOdo) <= svcWarn;

                      // Collect flags
                      const vehicleFlags = [];
                      sorted.forEach((e, i) => {
                        const flags = getEntryFlags(e, i > 0 ? sorted[i - 1] : null, vt, serviceData[rego], efficiencyThresholds);
                        flags.forEach(f => {
                          // Must set `date` (not just `entryDate`) so flagId matches
                          // the IDs produced by the modal/KPI count — otherwise the
                          // "resolved" lookup here always misses and counts stay high.
                          const enriched = { ...f, rego, date: e.date, entryDate: e.date, odo: e.odometer, _entry: e };
                          enriched._id = flagId(enriched);
                          vehicleFlags.push(enriched);
                        });
                      });
                      // Filter out resolved flags
                      const openVehicleFlags = vehicleFlags.filter(f => !resolvedFlags[flagId(f)]);
                      const dangerCount = openVehicleFlags.filter(f => f.category === "ops" && f.type === "danger").length;
                      const warnCount = openVehicleFlags.filter(f => f.category === "ops" && f.type === "warn").length;
                      const aiCount = openVehicleFlags.filter(f => f.category === "ai" && (f.type === "danger" || f.type === "warn")).length;
                      // Service overdue only shows red if not resolved
                      const serviceOverdueResolved = isOverdue && vehicleFlags.filter(f => f.text === "SERVICE OVERDUE").every(f => resolvedFlags[flagId(f)]);
                      const showOverdueHighlight = isOverdue && !serviceOverdueResolved;
                      const vehicleTotalCost = sorted.reduce((s, e) => s + (e.totalCost || 0), 0);
                      const vehicleTotalLitres = sorted.reduce((s, e) => s + (e.litres || 0), 0);

                      return (
                        <div key={rego} style={{ marginBottom: 16, position: "relative" }}>
                          {/* Vehicle header */}
                          <div onClick={() => { setExpandedRego(isExpanded ? null : rego); setFlagDetailPopup(null); }}
                            className={showOverdueHighlight ? "svc-overdue" : ""}
                            style={{
                              background: "white",
                              border: `1px solid ${showOverdueHighlight ? "#fca5a5" : isServiceSoon ? "#fcd34d" : "#e2e8f0"}`,
                              borderRadius: isExpanded ? "10px 10px 0 0" : 10, padding: "12px 14px", cursor: "pointer", transition: "all 0.15s",
                            }}>
                            {(() => {
                              const vehicleName = sorted[sorted.length - 1]?.vehicleName
                                || lookupRego(rego, learnedDBRef.current, entries)?.n
                                || "";
                              return (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", letterSpacing: "0.03em" }}>{rego}</span>
                                {vehicleName && <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{vehicleName}</span>}
                                {dangerCount > 0 && <span onClick={(ev) => {
                                  ev.stopPropagation();
                                  const dangerFlags = openVehicleFlags.filter(f => f.category === "ops" && f.type === "danger");
                                  setFlagDetailPopup(prev => prev?.rego === rego && prev?.filterType === "danger" ? null : { rego, flags: dangerFlags, filterType: "danger" });
                                }} className="flag-badge flag-danger" style={{ cursor: "pointer" }}>{"\u26A0"} {dangerCount}</span>}
                                {warnCount > 0 && <span onClick={(ev) => {
                                  ev.stopPropagation();
                                  const warnFlags = openVehicleFlags.filter(f => f.category === "ops" && f.type === "warn");
                                  setFlagDetailPopup(prev => prev?.rego === rego && prev?.filterType === "warn" ? null : { rego, flags: warnFlags, filterType: "warn" });
                                }} className="flag-badge flag-warn" style={{ cursor: "pointer" }}>{"\u26A1"} {warnCount}</span>}
                                {aiCount > 0 && <span onClick={(ev) => {
                                  ev.stopPropagation();
                                  const aiFlags = openVehicleFlags.filter(f => f.category === "ai" && (f.type === "danger" || f.type === "warn"));
                                  setFlagDetailPopup(prev => prev?.rego === rego && prev?.filterType === "ai" ? null : { rego, flags: aiFlags, filterType: "ai" });
                                }} style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 7px", borderRadius: 10, fontSize: 10, fontWeight: 700, background: "#ede9fe", color: "#7c3aed", border: "1px solid #c4b5fd", cursor: "pointer" }}>{"\uD83E\uDD16"} {aiCount}</span>}
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                {vehicleTotalCost > 0 && <span style={{ fontSize: 13, fontWeight: 700, color: "#16a34a" }}>${vehicleTotalCost.toFixed(2)}</span>}
                                {/* 3-dot menu */}
                                <button onClick={ev => { ev.stopPropagation(); setVehicleMenu(vehicleMenu === rego ? null : rego); }} style={{
                                  background: "none", border: "none", cursor: "pointer", padding: "4px 6px",
                                  color: "#94a3b8", fontSize: 16, lineHeight: 1, letterSpacing: "2px",
                                }}>{"\u22EF"}</button>
                                <span style={{ fontSize: 18, color: "#94a3b8", transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>{"\u25BE"}</span>
                              </div>
                            </div>
                              );
                            })()}
                            <div style={{ display: "flex", gap: 16, fontSize: 11, color: "#64748b", flexWrap: "wrap" }}>
                              <span>{sorted.length} fill-ups</span>
                              {vehicleTotalLitres > 0 && <span>{vehicleTotalLitres.toFixed(1)}L total</span>}
                              {latestOdo && <span>{isHoursBased(vt) ? "Hours" : "Odo"}: {latestOdo.toLocaleString()} {isHoursBased(vt) ? "hrs" : "km"}</span>}
                              {svc?.lastServiceDate && <span>Last svc: {svc.lastServiceDate}</span>}
                              {nextServiceDue && (
                                <span style={{ color: showOverdueHighlight ? "#dc2626" : isServiceSoon ? "#b45309" : "#64748b", fontWeight: showOverdueHighlight ? 700 : 400 }}>
                                  {showOverdueHighlight ? `SERVICE OVERDUE (due ${nextServiceDue.toLocaleString()})` : `Next svc: ${nextServiceDue.toLocaleString()} ${odoUnit(vt)}`}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Flag detail popup */}
                          {flagDetailPopup?.rego === rego && (
                            <div onClick={ev => ev.stopPropagation()} className="fade-in" style={{
                              background: flagDetailPopup.filterType === "ai" ? "#faf5ff" : flagDetailPopup.filterType === "danger" ? "#fef2f2" : "#fffbeb",
                              border: `1px solid ${flagDetailPopup.filterType === "ai" ? "#c4b5fd" : flagDetailPopup.filterType === "danger" ? "#fca5a5" : "#fcd34d"}`,
                              borderRadius: 8, padding: "10px 12px", margin: "6px 0",
                            }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: flagDetailPopup.filterType === "ai" ? "#7c3aed" : flagDetailPopup.filterType === "danger" ? "#b91c1c" : "#92400e" }}>
                                  {flagDetailPopup.filterType === "ai" ? "\uD83E\uDD16 AI Scan Issues" : flagDetailPopup.filterType === "danger" ? "\u26A0 Issues" : "\u26A1 Warnings"} — {rego}
                                </span>
                                <button onClick={(ev) => { ev.stopPropagation(); setFlagDetailPopup(null); }} style={{
                                  background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 16, lineHeight: 1,
                                }}>{"\u00D7"}</button>
                              </div>
                              {flagDetailPopup.flags.map((f, fi) => {
                                const isResolved = resolvedFlags[f._id];
                                const resolveInfo = isResolved ? resolvedFlags[f._id] : null;
                                return (
                                <div key={f._id || fi} style={{
                                  background: isResolved ? "#f0fdf4" : "white", borderRadius: 6, padding: "8px 10px", marginBottom: fi < flagDetailPopup.flags.length - 1 ? 6 : 0,
                                  border: `1px solid ${isResolved ? "#86efac" : flagDetailPopup.filterType === "ai" ? "#e9d5ff" : flagDetailPopup.filterType === "danger" ? "#fecaca" : "#fde68a"}`,
                                  opacity: isResolved ? 0.7 : 1,
                                }}>
                                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontSize: 11, fontWeight: 700, color: isResolved ? "#15803d" : "#0f172a", marginBottom: 3 }}>
                                        {isResolved && <span style={{ marginRight: 4 }}>{"\u2713"}</span>}
                                        {f.text}
                                        {f.entryDate && <span style={{ fontWeight: 400, color: "#94a3b8", marginLeft: 6 }}>{f.entryDate}</span>}
                                      </div>
                                      <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.4 }}>{f.detail}</div>
                                      {f.odo && <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 3 }}>Odo: {f.odo.toLocaleString()}</div>}
                                      {resolveInfo && (
                                        <div style={{ fontSize: 10, color: "#15803d", marginTop: 4, fontStyle: "italic" }}>
                                          Resolved{resolveInfo.by ? ` by ${resolveInfo.by}` : ""}{resolveInfo.note ? `: ${resolveInfo.note}` : ""}
                                        </div>
                                      )}
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                                      {f._entry?.hasReceipt && (
                                        <button onClick={() => setExpandedReceipt(expandedReceipt === f._id ? null : f._id)} style={{
                                          padding: "4px 8px", borderRadius: 5, fontSize: 10, fontWeight: 600,
                                          background: expandedReceipt === f._id ? "#7c3aed" : "#faf5ff",
                                          color: expandedReceipt === f._id ? "white" : "#7c3aed",
                                          border: `1px solid ${expandedReceipt === f._id ? "#7c3aed" : "#c4b5fd"}`,
                                          cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                                        }}>{"\uD83D\uDCC4"} {expandedReceipt === f._id ? "Hide" : "Receipt"}</button>
                                      )}
                                      {f._entry && (
                                        <button onClick={() => { setEditingEntry(f._entry); setFlagDetailPopup(null); }} style={{
                                          padding: "4px 8px", borderRadius: 5, fontSize: 10, fontWeight: 600,
                                          background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe",
                                          cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                                        }}>{"\u270E"} Edit</button>
                                      )}
                                      {!isResolved ? (
                                        <button onClick={() => resolveFlag(f._id, "Reviewed — no action needed", "Admin")} style={{
                                          padding: "4px 8px", borderRadius: 5, fontSize: 10, fontWeight: 600,
                                          background: "#f0fdf4", color: "#15803d", border: "1px solid #86efac",
                                          cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                                        }}>{"\u2713"} Resolve</button>
                                      ) : (
                                        <button onClick={() => unresolveFlag(f._id)} style={{
                                          padding: "4px 8px", borderRadius: 5, fontSize: 10, fontWeight: 600,
                                          background: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5",
                                          cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                                        }}>{"\u21A9"} Reopen</button>
                                      )}
                                    </div>
                                  </div>
                                  {expandedReceipt === f._id && f._entry?.hasReceipt && (
                                    <div style={{ marginTop: 8 }}>
                                      <InlineReceipt entryId={f._entry.id} loadFn={loadReceiptImage} />
                                    </div>
                                  )}
                                </div>
                                );
                              })}
                              {flagDetailPopup.flags.length === 0 && (
                                <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", padding: 8 }}>No issues found</div>
                              )}
                            </div>
                          )}

                          {/* 3-dot dropdown menu */}
                          {vehicleMenu === rego && (
                            <div onClick={ev => ev.stopPropagation()} className="fade-in" style={{
                              position: "absolute", right: 14, top: 42, zIndex: 20,
                              background: "white", border: "1px solid #e2e8f0", borderRadius: 8,
                              boxShadow: "0 8px 24px rgba(0,0,0,0.12)", minWidth: 180, overflow: "hidden",
                            }}>
                              <button onClick={(ev) => { ev.stopPropagation(); setVehicleMenu(null); setEditingVehicle(rego); }} style={{
                                width: "100%", padding: "10px 14px", background: "none", border: "none", borderBottom: "1px solid #f1f5f9",
                                fontSize: 12, fontWeight: 500, color: "#374151", cursor: "pointer", fontFamily: "inherit",
                                textAlign: "left", display: "flex", alignItems: "center", gap: 8,
                              }}><span style={{ fontSize: 14 }}>{"\u270E"}</span> Edit Vehicle</button>
                              <button onClick={(ev) => {
                                ev.stopPropagation();
                                setVehicleMenu(null);
                                const latest = sorted[sorted.length - 1];
                                setManualEntry({ rego, division: latest?.division || getDivision(vt), vehicleType: vt });
                              }} style={{
                                width: "100%", padding: "10px 14px", background: "none", border: "none", borderBottom: "1px solid #f1f5f9",
                                fontSize: 12, fontWeight: 500, color: "#374151", cursor: "pointer", fontFamily: "inherit",
                                textAlign: "left", display: "flex", alignItems: "center", gap: 8,
                              }}><span style={{ fontSize: 14 }}>{"\u2795"}</span> Add Entry</button>
                              <button onClick={(ev) => { ev.stopPropagation(); setVehicleMenu(null); setServiceModal(rego); }} style={{
                                width: "100%", padding: "10px 14px", background: "none", border: "none", borderBottom: "1px solid #f1f5f9",
                                fontSize: 12, fontWeight: 500, color: "#374151", cursor: "pointer", fontFamily: "inherit",
                                textAlign: "left", display: "flex", alignItems: "center", gap: 8,
                              }}><span style={{ fontSize: 14 }}>{"\uD83D\uDD27"}</span> Service & Mechanics</button>
                              <button onClick={(ev) => { ev.stopPropagation(); setVehicleMenu(null); setExpandedRego(isExpanded ? null : rego); }} style={{
                                width: "100%", padding: "10px 14px", background: "none", border: "none", borderBottom: "1px solid #f1f5f9",
                                fontSize: 12, fontWeight: 500, color: "#374151", cursor: "pointer", fontFamily: "inherit",
                                textAlign: "left", display: "flex", alignItems: "center", gap: 8,
                              }}><span style={{ fontSize: 14 }}>{"\uD83D\uDCCA"}</span> {isExpanded ? "Hide Entries" : "View Entries"}</button>
                              <button onClick={(ev) => { ev.stopPropagation(); setVehicleMenu(null); deleteVehicle(rego); }} style={{
                                width: "100%", padding: "10px 14px", background: "none", border: "none",
                                fontSize: 12, fontWeight: 500, color: "#dc2626", cursor: "pointer", fontFamily: "inherit",
                                textAlign: "left", display: "flex", alignItems: "center", gap: 8,
                              }}><span style={{ fontSize: 14 }}>{"\uD83D\uDDD1"}</span> Delete Vehicle</button>
                            </div>
                          )}

                          {/* Expanded data tables */}
                          {isExpanded && (
                            <div className="fade-in">
                              {/* Service bar */}
                              <div style={{
                                background: showOverdueHighlight ? "#fef2f2" : isServiceSoon ? "#fffbeb" : "#f8fafc",
                                border: `1px solid ${showOverdueHighlight ? "#fca5a5" : isServiceSoon ? "#fcd34d" : "#e2e8f0"}`,
                                borderTop: "none", padding: "10px 14px",
                                display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8,
                              }}>
                                <div style={{ fontSize: 11, color: "#64748b" }}>
                                  {svc ? (
                                    <>
                                      <strong style={{ color: "#374151" }}>Service:</strong> {svc.lastServiceDate} at {svc.lastServiceKms?.toLocaleString()} {odoUnit(vt)}
                                      {" \u00B7 "}<strong>Next due:</strong> {(svc.lastServiceKms + serviceInterval(vt)).toLocaleString()} {odoUnit(vt)}
                                      {latestOdo && svc.lastServiceKms && <>{" \u00B7 "}<strong>{(latestOdo - svc.lastServiceKms).toLocaleString()} {odoUnit(vt)}</strong> since service</>}
                                    </>
                                  ) : <span style={{ color: "#94a3b8" }}>No service record {"\u2014"} use {"\u22EF"} menu to add</span>}
                                </div>
                              </div>

                              {/* Two-table data area */}
                              <div style={{ background: "white", border: "1px solid #e2e8f0", borderTop: "none", borderRadius: "0 0 10px 10px", overflow: "hidden" }}>
                                <div style={{ overflowX: "auto" }}>
                                  <table className="data-table">
                                    <thead>
                                      <tr>
                                        <th style={{ background: "#f0fdf4", color: "#15803d", borderBottom: "2px solid #86efac", padding: "6px 8px" }} colSpan={8}>
                                          {"\u25B8"} Entry Data
                                        </th>
                                        <th style={{ background: "#f8fafc", width: 3, padding: 0, borderBottom: "2px solid #e2e8f0" }}></th>
                                        <th style={{ background: "#eff6ff", color: "#1e40af", borderBottom: "2px solid #93c5fd", padding: "6px 8px" }} colSpan={6}>
                                          {"\u25B8"} Calculated Analysis
                                        </th>
                                        <th style={{ background: "#f8fafc", width: 3, padding: 0, borderBottom: "2px solid #e2e8f0" }}></th>
                                        <th style={{ background: "#fefce8", color: "#854d0e", borderBottom: "2px solid #fde047", padding: "6px 8px" }} colSpan={3}>
                                          {"\u25B8"} Service
                                        </th>
                                        <th style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", width: 30 }}></th>
                                      </tr>
                                      <tr style={{ background: "#fafafa" }}>
                                        <th style={{ color: "#374151", borderBottom: "1px solid #e2e8f0" }}>Rego</th>
                                        <th style={{ color: "#374151", borderBottom: "1px solid #e2e8f0" }}>Date</th>
                                        <th style={{ color: "#374151", borderBottom: "1px solid #e2e8f0" }}>{isHoursBased(vt) ? "Hrs Start" : "Odo Start"}</th>
                                        <th style={{ color: "#374151", borderBottom: "1px solid #e2e8f0" }}>{isHoursBased(vt) ? "Hrs Finish" : "Odo Finish"}</th>
                                        <th style={{ color: "#374151", borderBottom: "1px solid #e2e8f0" }}>{isHoursBased(vt) ? "Hrs Used" : "KM Trav."}</th>
                                        <th style={{ color: "#374151", borderBottom: "1px solid #e2e8f0" }}>Litres</th>
                                        <th style={{ color: "#374151", borderBottom: "1px solid #e2e8f0" }}>$/L</th>
                                        <th style={{ color: "#374151", borderBottom: "1px solid #e2e8f0", borderRight: "1px solid #e2e8f0" }}>Fuel Cost</th>
                                        <th style={{ background: "#f8fafc", width: 3, padding: 0, borderBottom: "1px solid #e2e8f0" }}></th>
                                        <th style={{ color: "#1e40af", borderBottom: "1px solid #e2e8f0" }}>{isHoursBased(vt) ? "L/hr" : "L/km"}</th>
                                        <th style={{ color: "#1e40af", borderBottom: "1px solid #e2e8f0" }}>{isHoursBased(vt) ? "Hrs Used" : "KM Trav."}</th>
                                        <th style={{ color: "#1e40af", borderBottom: "1px solid #e2e8f0" }}>Tot. Litres</th>
                                        <th style={{ color: "#1e40af", borderBottom: "1px solid #e2e8f0" }}>Petrol $/L</th>
                                        <th style={{ color: "#1e40af", borderBottom: "1px solid #e2e8f0" }}>Calc Cost</th>
                                        <th style={{ color: "#1e40af", borderBottom: "1px solid #e2e8f0", borderRight: "1px solid #e2e8f0" }}>+/- Var.</th>
                                        <th style={{ background: "#f8fafc", width: 3, padding: 0, borderBottom: "1px solid #e2e8f0" }}></th>
                                        <th style={{ color: "#854d0e", borderBottom: "1px solid #e2e8f0" }}>Svc Date</th>
                                        <th style={{ color: "#854d0e", borderBottom: "1px solid #e2e8f0" }}>{isHoursBased(vt) ? "Svc Hrs" : "Svc KMs"}</th>
                                        <th style={{ color: "#854d0e", borderBottom: "1px solid #e2e8f0" }}>Next Due</th>
                                        <th style={{ borderBottom: "1px solid #e2e8f0", width: 30 }}></th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {sorted.map((e, i) => {
                                        const prev = i > 0 ? sorted[i - 1] : null;
                                        const odoStart = prev?.odometer;
                                        const odoFinish = e.odometer;
                                        const kmTravelled = (odoStart != null && odoFinish != null) ? odoFinish - odoStart : null;
                                        const litres = e.litres;
                                        const ppl = e.pricePerLitre;
                                        const totalCost = e.totalCost;
                                        const lPerKm = (kmTravelled > 0 && litres > 0) ? litres / kmTravelled : null;
                                        const calcCost = (litres > 0 && ppl > 0) ? litres * ppl : null;
                                        const variance = (totalCost != null && calcCost != null) ? totalCost - calcCost : null;
                                        const flags = getEntryFlags(e, prev, vt, serviceData[rego], efficiencyThresholds);
                                        const hasFlag = flags.some(f => f.type === "danger" || f.type === "warn");
                                        const showSvc = i === sorted.length - 1;
                                        const effRange = efficiencyThresholds[vt] || efficiencyThresholds.Other || DEFAULT_EFFICIENCY_RANGES.Other;

                                        return (
                                          <tr key={e.id} style={{ background: hasFlag ? "#fffbf0" : "white" }}>
                                            <td style={{ fontWeight: 600, color: "#374151", fontSize: 10 }}>{e.registration}</td>
                                            <td style={{ color: "#374151" }}>{e.date || "\u2014"}</td>
                                            <td style={{ color: "#64748b" }}>{odoStart != null ? odoStart.toLocaleString() : "\u2014"}</td>
                                            <td style={{ color: "#374151", fontWeight: 500 }}>{odoFinish != null ? odoFinish.toLocaleString() : "\u2014"}</td>
                                            <td style={{ color: kmTravelled != null && kmTravelled < 0 ? "#dc2626" : "#374151", fontWeight: 600 }}>
                                              {kmTravelled != null ? kmTravelled.toLocaleString() : "\u2014"}
                                            </td>
                                            <td style={{ color: "#374151" }}>{litres != null ? `${litres}L` : "\u2014"}</td>
                                            <td style={{ color: "#374151" }}>{ppl != null ? `$${ppl}` : "\u2014"}</td>
                                            <td style={{ color: "#16a34a", fontWeight: 600, borderRight: "1px solid #f1f5f9" }}>
                                              {totalCost != null ? `$${totalCost.toFixed(2)}` : "\u2014"}
                                            </td>
                                            <td style={{ background: "#f8fafc", width: 3, padding: 0 }}></td>
                                            <td style={{
                                              fontWeight: 600,
                                              color: lPerKm != null ? (lPerKm > effRange.high ? "#dc2626" : lPerKm < effRange.low ? "#2563eb" : "#15803d") : "#94a3b8"
                                            }}>
                                              {lPerKm != null ? lPerKm.toFixed(isHoursBased(vt) ? 1 : 3) : "\u2014"}
                                            </td>
                                            <td style={{ color: "#64748b" }}>{kmTravelled != null ? kmTravelled.toLocaleString() : "\u2014"}</td>
                                            <td style={{ color: "#64748b" }}>{litres != null ? `${litres}L` : "\u2014"}</td>
                                            <td style={{ color: "#64748b" }}>{ppl != null ? `$${ppl}` : "\u2014"}</td>
                                            <td style={{ color: "#374151", fontWeight: 500 }}>{calcCost != null ? `$${calcCost.toFixed(2)}` : "\u2014"}</td>
                                            {(() => {
                                              const pctVar = variance != null && calcCost ? (Math.abs(variance) / calcCost) * 100 : 0;
                                              const isOver15 = pctVar > 15;
                                              const isNoticeable = Math.abs(variance || 0) > 0.50;
                                              return (
                                                <td style={{
                                                  fontWeight: 600, borderRight: "1px solid #f1f5f9",
                                                  color: variance != null ? (isOver15 ? (variance > 0 ? "#dc2626" : "#2563eb") : "#64748b") : "#94a3b8"
                                                }}>
                                                  {variance != null ? (
                                                    <span>
                                                      {`${variance >= 0 ? "+" : ""}$${variance.toFixed(2)}`}
                                                      {isNoticeable && !isOver15 && (
                                                        <span style={{ fontSize: 8, marginLeft: 3, padding: "1px 4px", borderRadius: 3, fontWeight: 500, background: variance > 0 ? "#fff7ed" : "#f0fdf4", color: variance > 0 ? "#c2410c" : "#15803d", border: `1px solid ${variance > 0 ? "#fdba74" : "#86efac"}` }}>
                                                          {variance > 0 ? "surcharge" : "discount"}
                                                        </span>
                                                      )}
                                                    </span>
                                                  ) : "\u2014"}
                                                </td>
                                              );
                                            })()}
                                            <td style={{ background: "#f8fafc", width: 3, padding: 0 }}></td>
                                            <td style={{ color: "#854d0e", fontSize: 10 }}>{showSvc && svc?.lastServiceDate ? svc.lastServiceDate : (showSvc ? "\u2014" : "")}</td>
                                            <td style={{ color: "#854d0e", fontSize: 10 }}>{showSvc && svc?.lastServiceKms ? svc.lastServiceKms.toLocaleString() : (showSvc ? "\u2014" : "")}</td>
                                            <td style={{
                                              fontSize: 10, fontWeight: showSvc && showOverdueHighlight ? 700 : 400,
                                              color: showSvc && showOverdueHighlight ? "#dc2626" : showSvc && isServiceSoon ? "#b45309" : "#854d0e"
                                            }}>
                                              {showSvc && nextServiceDue ? nextServiceDue.toLocaleString() : (showSvc ? "\u2014" : "")}
                                            </td>
                                            <td style={{ whiteSpace: "nowrap" }}>
                                              {e.hasReceipt && <button onClick={() => setViewingReceipt(e.id)} title="View receipt" style={{ background: "none", border: "none", color: "#16a34a", cursor: "pointer", fontSize: 12, lineHeight: 1, padding: "2px 4px" }}>{"\uD83D\uDCC4"}</button>}
                                              <button onClick={() => setEditingEntry(e)} title="Edit" style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 12, lineHeight: 1, padding: "2px 4px" }}>{"\u270E"}</button>
                                              <button onClick={() => setConfirmAction({ message: `Delete this entry for ${e.registration} on ${e.date || "unknown date"}? This will remove it from all sections (Data, Fleet Cards, Dashboard).`, onConfirm: async () => { await deleteEntry(e.id); setConfirmAction(null); } })} title="Delete" style={{ background: "none", border: "none", color: "#cbd5e1", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "2px 4px" }}>{"\u00D7"}</button>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>

                              {/* Flags summary — clickable to show details */}
                              {vehicleFlags.length > 0 && (
                                <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                                  {vehicleFlags.map((f, fi) => (
                                    <div key={fi} className={`flag-badge flag-${f.type}`}
                                      onClick={() => setFlagDetailPopup(prev =>
                                        prev?.rego === rego && prev?._singleIdx === fi ? null : { rego, flags: [f], filterType: f.category === "ai" ? "ai" : f.type, _singleIdx: fi }
                                      )}
                                      style={{ cursor: "pointer" }}>
                                      {f.type === "danger" ? "\u26A0" : f.type === "warn" ? "\u26A1" : f.category === "ai" ? "\uD83E\uDD16" : f.type === "info" ? "\u2139" : "\u2713"}{" "}
                                      {f.text}
                                      {f.entryDate && <span style={{ opacity: 0.7, marginLeft: 3 }}>({f.entryDate})</span>}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Linked Oil & Other items (AdBlue etc.) */}
                              {(() => {
                                const linkedOthers = entries.filter(e => e.entryType === "other" && e.linkedVehicle && e.linkedVehicle.toUpperCase() === rego.toUpperCase());
                                if (linkedOthers.length === 0) return null;
                                return (
                                  <div style={{ marginTop: 8, background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "8px 12px" }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: "#1e40af", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                                      <span style={{ fontSize: 14 }}>{"\uD83D\uDCA7"}</span> Linked Oil & Other Items
                                    </div>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                      {linkedOthers.map((lo, li) => (
                                        <div key={li} style={{
                                          background: "white", border: "1px solid #93c5fd", borderRadius: 6,
                                          padding: "4px 10px", fontSize: 11, display: "flex", alignItems: "center", gap: 8,
                                        }}>
                                          <span style={{ fontWeight: 700, color: "#1e40af" }}>{lo.itemDescription || lo.fuelType || "Other"}</span>
                                          {lo.litres != null && <span style={{ color: "#374151" }}>{lo.litres}L</span>}
                                          {lo.pricePerLitre != null && <span style={{ color: "#64748b" }}>${lo.pricePerLitre}/L</span>}
                                          {lo.totalCost != null && <span style={{ color: "#16a34a", fontWeight: 600 }}>${lo.totalCost.toFixed(2)}</span>}
                                          {lo.date && <span style={{ color: "#94a3b8" }}>{lo.date}</span>}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            );
          })
        )}

        {/* ── Oil & Others Sections (by Division) ── */}
        {(() => {
          const otherEntries = entries.filter(e => e.entryType === "other");
          if (otherEntries.length === 0) return null;

          const renderOtherTable = (divEntries, divName, divColor) => {
            if (divEntries.length === 0) return null;
            const divTotal = divEntries.reduce((s, e) => s + (e.totalCost || 0), 0);
            return (
              <div style={{ marginTop: 28 }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 10, marginBottom: 14,
                  padding: "8px 12px", background: divColor.bg, borderRadius: 8,
                  border: `1px solid ${divColor.border}`,
                }}>
                  <span style={{ fontSize: 18 }}>{divName === "Tree" ? "\uD83C\uDF33" : "\uD83C\uDF3F"}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: divColor.text, letterSpacing: "0.04em" }}>{divName} Oil & Others</span>
                  <div style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: divColor.text, opacity: 0.7 }}>
                    {divEntries.length} claims {"\u00B7"} ${divTotal.toFixed(2)}
                  </span>
                </div>
                <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ overflowX: "auto" }}>
                    <table className="data-table">
                      <thead>
                        <tr style={{ background: divColor.bg }}>
                          {/* Card Rego leads the row now — mirrors the vehicle-entries
                              tables where the rego is the first column. Makes it
                              easier to scan who the expense belongs to than hunting
                              for the rego mid-row. */}
                          {["Card Rego", "Driver", "PT / Equipment", "Station", "Fleet Card", "Date", "Litres", "$/L", "Cost", "Notes", ""].map(h => (
                            <th key={h} style={{ color: divColor.text, borderBottom: `2px solid ${divColor.border}` }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {divEntries.map(e => (
                          <tr key={e.id} style={{ background: "white" }}>
                            <td style={{ fontWeight: 600, color: "#374151", fontSize: 10 }}>{e.cardRego || lookupRegoByCardNumber(e.fleetCardNumber) || "\u2014"}</td>
                            <td style={{ fontWeight: 500, color: "#374151" }}>{e.driverName || "\u2014"}</td>
                            <td style={{ fontWeight: 600, color: divColor.text }}>{e.equipment || "\u2014"}</td>
                            <td style={{ color: "#64748b" }}>{e.station || "\u2014"}</td>
                            <td style={{ color: "#374141", fontSize: 10 }}>{formatCardNumber(e.fleetCardNumber) || "\u2014"}</td>
                            <td style={{ color: "#374151" }}>{e.date || "\u2014"}</td>
                            <td style={{ color: "#374151" }}>{e.litres ? `${e.litres}L` : "\u2014"}</td>
                            <td style={{ color: "#374151" }}>{e.pricePerLitre ? `$${e.pricePerLitre}` : "\u2014"}</td>
                            <td style={{ color: "#16a34a", fontWeight: 600 }}>{e.totalCost ? `$${e.totalCost.toFixed(2)}` : "\u2014"}</td>
                            <td style={{ color: "#64748b", fontSize: 10, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.notes || "\u2014"}</td>
                            <td style={{ whiteSpace: "nowrap" }}>
                              {e.hasReceipt && <button onClick={() => setViewingReceipt(e.id)} title="View receipt" style={{ background: "none", border: "none", color: "#16a34a", cursor: "pointer", fontSize: 12, lineHeight: 1, padding: "2px 4px" }}>{"\uD83D\uDCC4"}</button>}
                              <button onClick={() => setEditingEntry(e)} title="Edit" style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 12, lineHeight: 1, padding: "2px 4px" }}>{"\u270E"}</button>
                              <button onClick={() => setConfirmAction({ message: `Delete this ${e.equipment} claim? This will remove it from all sections (Data, Fleet Cards, Dashboard).`, onConfirm: async () => { await deleteEntry(e.id); setConfirmAction(null); } })} title="Delete" style={{ background: "none", border: "none", color: "#cbd5e1", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "2px 4px" }}>{"\u00D7"}</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          };

          const treeOthers = otherEntries.filter(e => e.division === "Tree" || !e.division);
          const landscapeOthers = otherEntries.filter(e => e.division === "Landscape");

          return (
            <>
              {renderOtherTable(treeOthers, "Tree", { bg: "#f0fdf4", text: "#15803d", border: "#86efac" })}
              {renderOtherTable(landscapeOthers, "Landscape", { bg: "#faf5ff", text: "#7c3aed", border: "#c4b5fd" })}
            </>
          );
        })()}

        {/* ── Recently Deleted ──────────────────────────────────────
            Soft-deleted entries land here for 30 days before being
            auto-purged. Admin can restore (puts the entry back into
            the dashboard / reports) or delete permanently. Receipt
            images are preserved until purge so restore brings back
            the full record. */}
        {trashEntries.length > 0 && (
          <div style={{ marginTop: 28, background: "white", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
            <div style={{
              padding: "10px 14px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <span style={{ fontSize: 16 }}>{"\uD83D\uDDD1"}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                  Recently Deleted {"\u00B7"} {trashEntries.length}
                </div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 1 }}>
                  Auto-purged after 30 days. Restore puts the entry back into all reports.
                </div>
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr style={{ background: "#fafafa" }}>
                    <th style={{ color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>Rego / Equipment</th>
                    <th style={{ color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>Driver</th>
                    <th style={{ color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>Date</th>
                    <th style={{ color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>Litres</th>
                    <th style={{ color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>Cost</th>
                    <th style={{ color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>Deleted</th>
                    <th style={{ color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>Expires</th>
                    <th style={{ color: "#64748b", borderBottom: "1px solid #e2e8f0", width: 220 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {[...trashEntries]
                    .sort((a, b) => new Date(b._deletedAt || 0) - new Date(a._deletedAt || 0))
                    .map(t => {
                      const deletedMs = new Date(t._deletedAt).getTime();
                      const expiresMs = deletedMs + TRASH_RETENTION_MS;
                      const daysLeft = Math.max(0, Math.ceil((expiresMs - Date.now()) / 86400000));
                      const deletedAgo = (() => {
                        const diffMs = Date.now() - deletedMs;
                        const mins = Math.floor(diffMs / 60000);
                        if (mins < 1) return "just now";
                        if (mins < 60) return `${mins}m ago`;
                        const hrs = Math.floor(mins / 60);
                        if (hrs < 24) return `${hrs}h ago`;
                        const days = Math.floor(hrs / 24);
                        return `${days}d ago`;
                      })();
                      return (
                        <tr key={t.id} style={{ background: "white" }}>
                          <td style={{ fontWeight: 600, color: "#374151", fontSize: 11 }}>
                            {t.registration || t.equipment || "\u2014"}
                          </td>
                          <td style={{ color: "#374151", fontSize: 11 }}>{t.driverName || "\u2014"}</td>
                          <td style={{ color: "#64748b", fontSize: 11 }}>{t.date || "\u2014"}</td>
                          <td style={{ color: "#64748b", fontSize: 11 }}>{t.litres != null ? `${t.litres}L` : "\u2014"}</td>
                          <td style={{ color: "#16a34a", fontWeight: 600, fontSize: 11 }}>
                            {t.totalCost != null ? `$${t.totalCost.toFixed(2)}` : "\u2014"}
                          </td>
                          <td style={{ color: "#64748b", fontSize: 10 }}>{deletedAgo}</td>
                          <td style={{ color: daysLeft <= 3 ? "#b45309" : "#64748b", fontSize: 10, fontWeight: daysLeft <= 3 ? 600 : 400 }}>
                            {daysLeft > 0 ? `${daysLeft}d` : "expires today"}
                          </td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            <button onClick={() => restoreFromTrash(t.id)} title="Restore to active entries" style={{
                              padding: "4px 10px", marginRight: 6, borderRadius: 6, fontSize: 11, fontWeight: 600,
                              background: "#f0fdf4", color: "#15803d", border: "1px solid #86efac", cursor: "pointer", fontFamily: "inherit",
                            }}>{"\u21BA"} Restore</button>
                            <button onClick={() => setConfirmAction({
                              message: `Permanently delete the ${t.registration || t.equipment || "entry"} record from ${t.date || "unknown date"}?\n\nThis cannot be undone — even Restore won't bring it back.`,
                              onConfirm: async () => { await purgeFromTrash(t.id); setConfirmAction(null); },
                            })} title="Delete forever" style={{
                              padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                              background: "#fef2f2", color: "#b91c1c", border: "1px solid #fca5a5", cursor: "pointer", fontFamily: "inherit",
                            }}>{"\uD83D\uDDD1"} Delete forever</button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };
  const fleetAnalysis = useMemo(() => {
    const vehicleOnly = entries.filter(e => e.entryType !== "other");
    const allRegos = [...new Set(vehicleOnly.map(e => e.registration))];
    const vehicles = allRegos.map(rego => {
      const regoEntries = vehicleOnly.filter(e => e.registration === rego).sort(sortEntries);
      const latest = regoEntries[regoEntries.length - 1];
      const first = regoEntries[0];
      const vt = latest?.vehicleType || "Other";
      const div = latest?.division || getDivision(vt) || "Tree";
      const svc = getLatestService(serviceData[rego]);
      const latestOdo = latest?.odometer || 0;
      const nextServiceDue = svc?.lastServiceKms ? svc.lastServiceKms + serviceInterval(vt) : null;
      const kmSinceService = svc?.lastServiceKms ? latestOdo - svc.lastServiceKms : null;
      const kmToService = nextServiceDue ? nextServiceDue - latestOdo : null;

      // Service status
      let svcStatus = "unknown"; // unknown, ok, approaching, due, overdue
      if (!svc?.lastServiceKms) svcStatus = "unknown";
      else if (latestOdo >= nextServiceDue) svcStatus = "overdue";
      else if (kmToService <= serviceWarning(vt)) svcStatus = "approaching";
      else svcStatus = "ok";

      // Calculate L/km for each fill-up pair
      const efficiencies = [];
      regoEntries.forEach((e, i) => {
        if (i === 0) return;
        const prev = regoEntries[i - 1];
        const km = (e.odometer || 0) - (prev.odometer || 0);
        if (km > 0 && e.litres > 0) {
          efficiencies.push({ lPerKm: e.litres / km, km, litres: e.litres, date: e.date });
        }
      });

      const avgLPerKm = efficiencies.length > 0
        ? efficiencies.reduce((s, e) => s + e.lPerKm, 0) / efficiencies.length : null;

      // Trend: compare last 3 vs earlier entries
      let trend = null; // "improving", "worsening", "stable"
      if (efficiencies.length >= 4) {
        const recent = efficiencies.slice(-3);
        const earlier = efficiencies.slice(0, -3);
        const recentAvg = recent.reduce((s, e) => s + e.lPerKm, 0) / recent.length;
        const earlierAvg = earlier.reduce((s, e) => s + e.lPerKm, 0) / earlier.length;
        const pctChange = earlierAvg > 0 ? ((recentAvg - earlierAvg) / earlierAvg) * 100 : 0;
        if (pctChange > 15) trend = "worsening";
        else if (pctChange < -15) trend = "improving";
        else trend = "stable";
      }

      // Anomaly detection: any fill-up where L/km is >50% above vehicle's own average
      const anomalies = [];
      if (avgLPerKm && avgLPerKm > 0) {
        efficiencies.forEach(eff => {
          if (eff.lPerKm > avgLPerKm * 1.5) {
            anomalies.push({ ...eff, type: "high", pct: Math.round(((eff.lPerKm - avgLPerKm) / avgLPerKm) * 100) });
          }
        });
      }

      // Collect all flags
      const flags = [];
      regoEntries.forEach((e, i) => {
        const prev = i > 0 ? regoEntries[i - 1] : null;
        getEntryFlags(e, prev, vt, serviceData[rego], efficiencyThresholds).forEach(f => flags.push({ ...f, rego, date: e.date, odo: e.odometer, _entryId: e.id, _entry: e }));
      });

      // Fuel cost totals
      const totalLitres = regoEntries.reduce((s, e) => s + (e.litres || 0), 0);
      const totalCost = regoEntries.reduce((s, e) => s + (e.totalCost || 0), 0);
      const totalKm = (latestOdo && first?.odometer) ? latestOdo - first.odometer : 0;

      return {
        rego, vt, div, latestOdo, svc, svcStatus, nextServiceDue,
        kmSinceService, kmToService, avgLPerKm, trend, anomalies, flags,
        totalLitres, totalCost, totalKm, fillUps: regoEntries.length,
        efficiencies, latestDriver: latest?.driverName || "",
        vehicleName: latest?.vehicleName || "",
      };
    });

    return vehicles;
  }, [entries, serviceData, efficiencyThresholds]);

  // ── Dashboard view ────────────────────────────────────────────────────────
  const renderDashboard = () => {
    const fleet = fleetAnalysis;
    const overdue = fleet.filter(v => v.svcStatus === "overdue");
    const approaching = fleet.filter(v => v.svcStatus === "approaching");
    const allFlags = fleet.flatMap(v => v.flags.filter(f => f.category === "ops" && (f.type === "danger" || f.type === "warn")));
    const openFlagCount = allFlags.filter(f => !resolvedFlags[flagId(f)]).length;
    const worsening = fleet.filter(v => v.trend === "worsening");

    // ── Period filtering ──
    const baseDate = new Date(dashDate + "T00:00:00");
    const getRange = () => {
      if (dashPeriod === "daily") {
        const start = new Date(baseDate);
        const end = new Date(baseDate); end.setDate(end.getDate() + 1);
        return { start, end, label: baseDate.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) };
      }
      if (dashPeriod === "weekly") {
        const day = baseDate.getDay();
        const start = new Date(baseDate); start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
        const end = new Date(start); end.setDate(end.getDate() + 7);
        const endFri = new Date(start); endFri.setDate(endFri.getDate() + 6);
        return { start, end, label: `${start.toLocaleDateString("en-AU", { day: "numeric", month: "short" })} \u2013 ${endFri.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}` };
      }
      if (dashPeriod === "monthly") {
        const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
        const end = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1);
        return { start, end, label: baseDate.toLocaleDateString("en-AU", { month: "long", year: "numeric" }) };
      }
      if (dashPeriod === "custom") {
        const start = new Date(dashDate + "T00:00:00");
        const end = new Date(dashDateEnd + "T00:00:00"); end.setDate(end.getDate() + 1);
        const daysDiff = Math.round((end - start) / 86400000);
        return { start, end, label: `${start.toLocaleDateString("en-AU", { day: "numeric", month: "short" })} \u2013 ${new Date(dashDateEnd + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })} (${daysDiff} days)` };
      }
      return { start: null, end: null, label: "All Time" };
    };
    const range = getRange();

    const isInRange = (e) => {
      if (!range.start) return true;
      const d = parseDate(e.date);
      if (!d) return false;
      const dt = new Date(d);
      return dt >= range.start && dt < range.end;
    };

    const periodEntries = entries.filter(isInRange);
    const periodVehicle = periodEntries.filter(e => e.entryType !== "other");
    const periodOther = periodEntries.filter(e => e.entryType === "other");
    const periodSpend = periodEntries.reduce((s, e) => s + (e.totalCost || 0), 0);
    const periodLitres = periodVehicle.reduce((s, e) => s + (e.litres || 0), 0);
    const periodVehicleCount = new Set(periodVehicle.map(e => e.registration)).size;
    const periodFillUps = periodVehicle.length;

    // Navigation
    const navPeriod = (dir) => {
      const d = new Date(dashDate + "T00:00:00");
      if (dashPeriod === "daily") d.setDate(d.getDate() + dir);
      else if (dashPeriod === "weekly") d.setDate(d.getDate() + (dir * 7));
      else if (dashPeriod === "monthly") d.setMonth(d.getMonth() + dir);
      // Use local date components (not toISOString which converts to UTC and can skip days in AEST)
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      setDashDate(`${yyyy}-${mm}-${dd}`);
    };

    // Per-vehicle breakdown for this period
    const periodByVehicle = {};
    periodVehicle.forEach(e => {
      if (!periodByVehicle[e.registration]) periodByVehicle[e.registration] = { rego: e.registration, division: e.division, type: e.vehicleType, litres: 0, cost: 0, fills: 0, km: 0, drivers: new Set(), odos: [], entries: [], cardRegos: new Set() };
      periodByVehicle[e.registration].entries.push(e);
      periodByVehicle[e.registration].litres += e.litres || 0;
      periodByVehicle[e.registration].cost += e.totalCost || 0;
      periodByVehicle[e.registration].fills += 1;
      if (e.driverName) periodByVehicle[e.registration].drivers.add(e.driverName);
      if (e.odometer) periodByVehicle[e.registration].odos.push(e.odometer);
      const cr = (e.cardRego || e.fleetCardVehicle || "").toUpperCase().replace(/\s+/g, "");
      if (cr) periodByVehicle[e.registration].cardRegos.add(cr);
    });
    // Calculate KM from odometer range
    Object.values(periodByVehicle).forEach(v => {
      if (v.odos.length >= 2) {
        v.odos.sort((a, b) => a - b);
        v.km = v.odos[v.odos.length - 1] - v.odos[0];
      }
    });
    const periodVehicles = Object.values(periodByVehicle).sort((a, b) => b.cost - a.cost);
    const periodTotalKm = periodVehicles.reduce((s, v) => s + v.km, 0);

    // Sort fleet: when filter active, bring matching vehicles to top
    const sorted = [...fleet].sort((a, b) => {
      if (worseningFilter) {
        const aw = a.trend === "worsening" ? 0 : 1;
        const bw = b.trend === "worsening" ? 0 : 1;
        if (aw !== bw) return aw - bw;
      }
      if (overdueFilter) {
        const ao = a.svcStatus === "overdue" ? 0 : 1;
        const bo = b.svcStatus === "overdue" ? 0 : 1;
        if (ao !== bo) return ao - bo;
      }
      if (approachingFilter) {
        const aa = a.svcStatus === "approaching" ? 0 : 1;
        const ba = b.svcStatus === "approaching" ? 0 : 1;
        if (aa !== ba) return aa - ba;
      }
      const statusOrder = { overdue: 0, approaching: 1, unknown: 2, ok: 3 };
      const sa = statusOrder[a.svcStatus] ?? 2;
      const sb = statusOrder[b.svcStatus] ?? 2;
      if (sa !== sb) return sa - sb;
      return b.flags.length - a.flags.length;
    });

    const svcColor = (status) => ({
      overdue: { bg: "#fef2f2", text: "#dc2626", border: "#fca5a5", label: "OVERDUE" },
      approaching: { bg: "#fffbeb", text: "#b45309", border: "#fcd34d", label: "DUE SOON" },
      ok: { bg: "#f0fdf4", text: "#15803d", border: "#86efac", label: "OK" },
      unknown: { bg: "#f8fafc", text: "#94a3b8", border: "#e2e8f0", label: "NO DATA" },
    }[status] || { bg: "#f8fafc", text: "#94a3b8", border: "#e2e8f0", label: "?" });

    return (
      <div>
        {/* Header with flags button */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a" }}>Fleet Dashboard</div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>Vehicle health, fuel consumption & service tracking</div>
          </div>
          <button onClick={() => { setShowFlags(true); setFlagsFilter("open"); }} style={{
            padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6,
            background: openFlagCount > 0 ? "#fef2f2" : "#f0fdf4",
            color: openFlagCount > 0 ? "#dc2626" : "#15803d",
            border: `1px solid ${openFlagCount > 0 ? "#fca5a5" : "#86efac"}`,
          }}>
            {openFlagCount > 0 ? "\u26A0" : "\u2713"} {openFlagCount} Open {openFlagCount === 1 ? "Issue" : "Issues"}
          </button>
        </div>

        {/* ── Period selector ── */}
        <div style={{
          background: "#a855f7", border: "1px solid #e2e8f0", borderRadius: 10,
          padding: "12px 16px", marginBottom: 16,
        }}>
          {/* Period tabs */}
          <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
            {[["daily", "Day"], ["weekly", "Week"], ["monthly", "Month"], ["custom", "Custom"], ["all", "All Time"]].map(([key, label]) => (
              <button key={key} onClick={() => setDashPeriod(key)} style={{
                flex: 1, padding: "7px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                background: dashPeriod === key ? "#16a34a" : "#f8fafc",
                color: dashPeriod === key ? "white" : "#64748b",
                border: `1px solid ${dashPeriod === key ? "#16a34a" : "#e2e8f0"}`,
              }}>{label}</button>
            ))}
          </div>

          {/* Date picker */}
          {dashPeriod !== "all" && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                <label style={{ fontSize: 11, color: "#64748b", fontWeight: 600, flexShrink: 0 }}>
                  {dashPeriod === "custom" ? "From:" : dashPeriod === "daily" ? "Date:" : dashPeriod === "weekly" ? "Week of:" : "Month:"}
                </label>
                <input type="date" value={dashDate}
                  onChange={e => {
                    setDashDate(e.target.value);
                    if (dashPeriod === "custom" && e.target.value > dashDateEnd) setDashDateEnd(e.target.value);
                  }}
                  style={{
                    flex: 1, padding: "8px 10px", borderRadius: 7, border: "1px solid #e2e8f0",
                    fontSize: 13, fontFamily: "inherit", color: "#0f172a", outline: "none", maxWidth: 180,
                  }}
                  onFocus={e => e.target.style.borderColor = "#22c55e"}
                  onBlur={e => e.target.style.borderColor = "#e2e8f0"}
                />
              </div>
              {dashPeriod === "custom" && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                  <label style={{ fontSize: 11, color: "#64748b", fontWeight: 600, flexShrink: 0 }}>To:</label>
                  <input type="date" value={dashDateEnd}
                    onChange={e => setDashDateEnd(e.target.value)}
                    min={dashDate}
                    style={{
                      flex: 1, padding: "8px 10px", borderRadius: 7, border: "1px solid #e2e8f0",
                      fontSize: 13, fontFamily: "inherit", color: "#0f172a", outline: "none", maxWidth: 180,
                    }}
                    onFocus={e => e.target.style.borderColor = "#22c55e"}
                    onBlur={e => e.target.style.borderColor = "#e2e8f0"}
                  />
                </div>
              )}
              {/* Quick nav arrows still available */}
              {dashPeriod !== "custom" && (
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => navPeriod(-1)} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 14, color: "#64748b" }}>{"\u25C0"}</button>
                  <button onClick={() => setDashDate(new Date().toISOString().slice(0, 10))} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 11, fontFamily: "inherit", color: "#64748b", fontWeight: 600 }}>Today</button>
                  <button onClick={() => navPeriod(1)} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 14, color: "#64748b" }}>{"\u25B6"}</button>
                </div>
              )}
            </div>
          )}

          {/* Period summary */}
          {dashPeriod !== "all" && (
            <div style={{ textAlign: "center", marginTop: 10, fontSize: 11, color: "#94a3b8" }}>
              <span style={{ fontWeight: 600, color: "#374151" }}>{range.label}</span>
              {" \u00B7 "}{periodFillUps} fill-ups {"\u00B7"} {periodVehicleCount} vehicles {"\u00B7"} {periodOther.length} other claims
            </div>
          )}
        </div>

        {/* ── Period KPIs ── */}
        <div className="kpi-grid-5" style={{ marginBottom: 16 }}>
          {[
            { label: "Fuel Spend", value: `$${periodSpend.toFixed(0)}`, color: "#0f172a" },
            { label: "Litres", value: `${periodLitres.toFixed(0)}L`, color: "#0f172a" },
            { label: "Fill-ups", value: periodFillUps, color: "#16a34a" },
            { label: "Other Claims", value: periodOther.length > 0 ? `$${periodOther.reduce((s, e) => s + (e.totalCost || 0), 0).toFixed(0)}` : "$0", color: periodOther.length > 0 ? "#854d0e" : "#94a3b8" },
            { label: dashPeriod === "daily" ? "Avg $/fill" : "Avg $/day", value: (() => {
              if (dashPeriod === "daily") return periodFillUps > 0 ? `$${(periodSpend / periodFillUps).toFixed(0)}` : "$0";
              if (dashPeriod === "weekly") return `$${(periodSpend / 7).toFixed(0)}`;
              if (dashPeriod === "monthly") { const days = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0).getDate(); return `$${(periodSpend / days).toFixed(0)}`; }
              const firstDate = entries.length > 0 ? parseDate(entries[0]?.date) : 0;
              const allDays = firstDate > 0 ? Math.max(1, Math.round((Date.now() - firstDate) / 86400000)) : 1;
              return `$${(periodSpend / allDays).toFixed(0)}`;
            })(), color: "#64748b" },
          ].map(s => (
            <div key={s.label} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 2, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Period vehicle breakdown ── */}
        {periodVehicles.length > 0 && (() => {
          const exportDashboard = () => {
            const wb = XLSX.utils.book_new();
            const safeName = range.label.replace(/[\/\\*?\[\]:]/g, "").slice(0, 20);

            // Summary sheet
            const summaryRows = [
              ["Fleet Dashboard Report", "", "", "", "", "", "", "", range.label],
              [`Period: ${dashPeriod.charAt(0).toUpperCase() + dashPeriod.slice(1)}`, "", "", "", "", "", "", "", `Generated: ${new Date().toLocaleDateString("en-AU")}`],
              [],
              ["Vehicle Rego", "Fleet Card Rego", "Division", "Type", "Fill-ups", "KM Travelled", "Litres", "Cost ($)", "Drivers"],
            ];
            periodVehicles.forEach(v => {
              const cardRegoStr = v.cardRegos ? [...v.cardRegos].filter(Boolean).join(" / ") : "";
              summaryRows.push([v.rego, cardRegoStr, v.division, v.type, v.fills, v.km || "", Math.round(v.litres * 100) / 100, Math.round(v.cost * 100) / 100, [...v.drivers].join(", ")]);
            });
            summaryRows.push([]);
            summaryRows.push(["TOTAL", "", "", "", periodFillUps, periodTotalKm || "", Math.round(periodLitres * 100) / 100, Math.round(periodSpend * 100) / 100, ""]);
            summaryRows.push([]);
            summaryRows.push(["Avg $/day", "", "", "", "", "", "", (() => {
              if (dashPeriod === "daily") return Math.round(periodSpend * 100) / 100;
              if (dashPeriod === "weekly") return Math.round(periodSpend / 7 * 100) / 100;
              if (dashPeriod === "monthly") { const days = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0).getDate(); return Math.round(periodSpend / days * 100) / 100; }
              return "";
            })(), ""]);

            const sws = XLSX.utils.aoa_to_sheet(summaryRows);
            sws["!cols"] = [{wch:14},{wch:14},{wch:12},{wch:14},{wch:10},{wch:12},{wch:10},{wch:12},{wch:30}];
            XLSX.utils.book_append_sheet(wb, sws, "Summary");

            // Individual entries sheet
            const entryRows = [
              ["All Entries — " + range.label],
              [],
              ["Date", "Driver", "Vehicle Rego", "Fleet Card Rego", "Division", "Type", "Odometer", "Litres", "$/L", "Cost ($)", "Fuel Type", "Station", "Fleet Card #"],
            ];
            periodEntries.forEach(e => {
              entryRows.push([
                e.date || "", e.driverName || "",
                e.entryType === "other" ? (e.equipment || "Other") : (e.registration || ""),
                e.cardRego || e.fleetCardVehicle || "",
                e.division || "", e.vehicleType || e.entryType || "",
                e.odometer || "", e.litres || "", e.pricePerLitre || "",
                e.totalCost ? Math.round(e.totalCost * 100) / 100 : "",
                e.fuelType || "", e.station || "", e.fleetCardNumber || "",
              ]);
            });
            const ews = XLSX.utils.aoa_to_sheet(entryRows);
            ews["!cols"] = [{wch:12},{wch:18},{wch:14},{wch:14},{wch:12},{wch:14},{wch:10},{wch:8},{wch:7},{wch:10},{wch:14},{wch:20},{wch:20}];
            XLSX.utils.book_append_sheet(wb, ews, "All Entries");

            // Other claims sheet if any
            if (periodOther.length > 0) {
              // Column layout (per spec):
              // A Date · B Driver · C Equipment · D Fleetcard Rego · E Division
              // F (blank) · G (blank) · H Litres · I $/L · J Cost ($)
              // K (blank) · L Station · M Fleet Card Number · N Notes
              const oRows = [
                ["Oil & Other Claims — " + range.label],
                [],
                ["Date", "Driver", "Equipment", "Fleetcard Rego", "Division",
                 "", "", "Litres", "$/L", "Cost ($)",
                 "", "Station", "Fleet Card Number", "Notes"],
              ];
              periodOther.forEach(e => {
                oRows.push([
                  e.date || "",                 // A
                  e.driverName || "",           // B
                  e.equipment || "",            // C
                  e.cardRego || "",             // D
                  e.division || "",             // E
                  "",                           // F (blank)
                  "",                           // G (blank)
                  e.litres || "",               // H
                  e.pricePerLitre || "",        // I (blank when not applicable)
                  e.totalCost ? Math.round(e.totalCost * 100) / 100 : "", // J
                  "",                           // K (blank)
                  e.station || "",              // L
                  e.fleetCardNumber || "",      // M
                  e.notes || "",                // N
                ]);
              });
              const ows = XLSX.utils.aoa_to_sheet(oRows);
              ows["!cols"] = [
                {wch:12},{wch:18},{wch:25},{wch:12},{wch:12},
                {wch:6},{wch:6},{wch:8},{wch:7},{wch:10},
                {wch:6},{wch:20},{wch:20},{wch:30},
              ];
              XLSX.utils.book_append_sheet(wb, ows, "Oil & Others");
            }

            XLSX.writeFile(wb, `Dashboard_Report_${safeName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
            showToast("Dashboard report exported");
          };

          const sortedPV = [...periodVehicles].sort((a, b) => {
            switch (vehicleSpendSort) {
              case "cost-desc": return b.cost - a.cost;
              case "cost-asc": return a.cost - b.cost;
              case "litres-desc": return b.litres - a.litres;
              case "litres-asc": return a.litres - b.litres;
              case "fills-desc": return b.fills - a.fills;
              case "km-desc": return b.km - a.km;
              case "alpha-asc": return (a.rego || "").localeCompare(b.rego || "");
              case "alpha-desc": return (b.rego || "").localeCompare(a.rego || "");
              default: return b.cost - a.cost;
            }
          });

          const spendCollapsed = !!collapsedDashSections.vehicleSpend;
          return (
          <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
            <div style={{ padding: "10px 14px", background: "#f8fafc", borderBottom: spendCollapsed ? "none" : "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <button onClick={() => toggleDashSection("vehicleSpend")} style={{
                background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#374151",
              }}>
                <span style={{ fontSize: 10, color: "#94a3b8", transform: spendCollapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.2s", display: "inline-block" }}>{"\u25BC"}</span>
                {"\uD83D\uDE97"} Vehicle Spend — {range.label}
              </button>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <select value={vehicleSpendSort} onChange={e => setVehicleSpendSort(e.target.value)} style={{
                  padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: 500,
                  fontFamily: "inherit", color: "#374151", border: "1px solid #e2e8f0",
                  background: "white", cursor: "pointer", outline: "none",
                }}>
                  {[["cost-desc","Highest Cost"],["cost-asc","Lowest Cost"],["litres-desc","Most Litres"],["litres-asc","Least Litres"],["fills-desc","Most Fill-ups"],["km-desc","Most KM"],["alpha-asc","A \u2192 Z"],["alpha-desc","Z \u2192 A"]].map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
                <button onClick={exportDashboard} style={{
                  padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit",
                  background: "#16a34a", color: "white", border: "none",
                }}>{"\uD83D\uDCE5"} Export</button>
              </div>
            </div>
            {!spendCollapsed && (<>
            {/* Summary bar */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, padding: "10px 14px", borderBottom: "1px solid #e2e8f0", background: "#f0fdf4" }}>
              {[
                ["\uD83D\uDE97", `${sortedPV.length} Vehicles`],
                ["\u26FD", `${periodFillUps} Fill-ups`],
                ["\uD83D\uDCA7", `${periodLitres.toFixed(0)}L`],
                ["\uD83D\uDCB0", `$${periodSpend.toFixed(2)}`],
              ].map(([icon, text]) => (
                <span key={text} style={{ fontSize: 11, fontWeight: 600, color: "#15803d", background: "white", padding: "3px 10px", borderRadius: 8, border: "1px solid #bbf7d0" }}>{icon} {text}</span>
              ))}
            </div>
            {/* Vehicle cards */}
            <div style={{ padding: "8px 10px" }}>
              {sortedPV.map(v => {
                const maxCost = sortedPV.length > 0 ? Math.max(...sortedPV.map(x => x.cost)) : 1;
                const pct = periodSpend > 0 ? ((v.cost / periodSpend) * 100) : 0;
                const barW = maxCost > 0 ? ((v.cost / maxCost) * 100) : 0;
                const isExpanded = expandedSpendVehicle === v.rego;
                const hb = isHoursBased(v.type);
                return (
                  <div key={v.rego} style={{ marginBottom: 6, border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden", background: isExpanded ? "#f8fafc" : "white" }}>
                    {/* Vehicle header row - clickable */}
                    <div onClick={() => setExpandedSpendVehicle(isExpanded ? null : v.rego)}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", cursor: "pointer", flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", minWidth: 80 }}>{v.rego}</span>
                      <span style={{ padding: "1px 6px", borderRadius: 8, fontSize: 9, fontWeight: 600,
                        background: v.division === "Tree" ? "#f0fdf4" : "#faf5ff",
                        color: v.division === "Tree" ? "#15803d" : "#7c3aed",
                      }}>{v.division || "Tree"}</span>
                      <span style={{ fontSize: 10, color: "#64748b" }}>{v.type}</span>
                      <div style={{ flex: 1, minWidth: 60 }}>
                        <div style={{ height: 6, background: "#e2e8f0", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ width: `${barW}%`, height: "100%", background: "linear-gradient(90deg, #22c55e, #16a34a)", borderRadius: 3, transition: "width 0.3s" }} />
                        </div>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#16a34a", minWidth: 70, textAlign: "right" }}>${v.cost.toFixed(2)}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: "#64748b", minWidth: 40, textAlign: "right" }}>{pct.toFixed(1)}%</span>
                      <span style={{ fontSize: 12, color: "#94a3b8", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>{"\u25BC"}</span>
                    </div>
                    {/* Expanded detail */}
                    {isExpanded && (
                      <div style={{ borderTop: "1px solid #e2e8f0", padding: "8px 12px" }}>
                        {/* Stats row */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 8 }}>
                          {[
                            ["Fill-ups", v.fills],
                            ["Litres", v.litres.toFixed(1) + "L"],
                            [hb ? "Hours" : "KM", v.km > 0 ? v.km.toLocaleString() : "\u2014"],
                            ["Drivers", [...v.drivers].join(", ") || "\u2014"],
                          ].map(([lbl, val]) => (
                            <div key={lbl} style={{ fontSize: 10 }}>
                              <span style={{ color: "#94a3b8", fontWeight: 500 }}>{lbl}: </span>
                              <span style={{ color: "#374151", fontWeight: 600 }}>{val}</span>
                            </div>
                          ))}
                        </div>
                        {/* Transaction list */}
                        {v.entries && v.entries.length > 0 && (
                          <div style={{ overflowX: "auto", marginBottom: 6 }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                              <thead>
                                <tr style={{ background: "#f1f5f9" }}>
                                  {["Date", "Driver", "Station", "Litres", "$/L", "Cost", hb ? "Hours" : "Odo"].map(h => (
                                    <th key={h} style={{ padding: "4px 6px", textAlign: "left", fontWeight: 600, color: "#64748b", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>{h}</th>
                                  ))}
                                  <th style={{ padding: "4px 6px", borderBottom: "1px solid #e2e8f0" }}></th>
                                </tr>
                              </thead>
                              <tbody>
                                {v.entries.sort((a, b) => {
                                  const da = parseDate(a.date), db = parseDate(b.date);
                                  return (db || new Date(0)) - (da || new Date(0));
                                }).map(e => (
                                  <tr key={e.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                    <td style={{ padding: "4px 6px", color: "#374151", whiteSpace: "nowrap" }}>{e.date || "\u2014"}</td>
                                    <td style={{ padding: "4px 6px", color: "#374151" }}>{e.driverName || "\u2014"}</td>
                                    <td style={{ padding: "4px 6px", color: "#64748b" }}>{e.station || "\u2014"}</td>
                                    <td style={{ padding: "4px 6px", color: "#374151" }}>{e.litres ? e.litres + "L" : "\u2014"}</td>
                                    <td style={{ padding: "4px 6px", color: "#374151" }}>{e.pricePerLitre ? "$" + e.pricePerLitre : "\u2014"}</td>
                                    <td style={{ padding: "4px 6px", fontWeight: 600, color: "#16a34a" }}>{e.totalCost ? "$" + e.totalCost.toFixed(2) : "\u2014"}</td>
                                    <td style={{ padding: "4px 6px", color: "#374151" }}>{e.odometerReading || "\u2014"}</td>
                                    <td style={{ padding: "4px 6px", display: "flex", gap: 4 }}>
                                      {e.hasReceipt && (
                                        <button onClick={(ev) => { ev.stopPropagation(); setViewingReceipt(e.id); }} title="View receipt" style={{
                                          padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 600,
                                          background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", cursor: "pointer",
                                        }}>{"\uD83D\uDCC4"}</button>
                                      )}
                                      <button onClick={(ev) => { ev.stopPropagation(); setEditingEntry(e); }} title="Edit entry" style={{
                                        padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 600,
                                        background: "#fefce8", color: "#854d0e", border: "1px solid #fde047", cursor: "pointer",
                                      }}>{"\u270F\uFE0F"}</button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        <button onClick={() => { setView("data"); setDataSearch(v.rego); setExpandedRego(v.rego); }} style={{
                          padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 600,
                          background: "white", color: "#2563eb", border: "1px solid #bfdbfe", cursor: "pointer",
                        }}>View full history {"\u2192"}</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            </>)}
          </div>
          );
        })()}
        {periodVehicles.length === 0 && dashPeriod !== "all" && periodOther.length === 0 && (
          <div style={{ textAlign: "center", padding: "24px 0", color: "#94a3b8", fontSize: 13, background: "white", border: "1px solid #e2e8f0", borderRadius: 10, marginBottom: 16 }}>
            No fuel entries for {range.label}
          </div>
        )}

        {/* ── Other claims for this period ── */}
        {periodOther.length > 0 && (() => {
          const otherCollapsed = !!collapsedDashSections.oilOthers;
          return (
          <div style={{ background: "white", border: "1px solid #fde047", borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
            <div style={{ padding: "10px 14px", background: "#fefce8", borderBottom: otherCollapsed ? "none" : "1px solid #fde047", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button onClick={() => toggleDashSection("oilOthers")} style={{
                background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#854d0e",
              }}>
                <span style={{ fontSize: 10, color: "#a16207", transform: otherCollapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.2s", display: "inline-block" }}>{"\u25BC"}</span>
                {"\u26FD"} Oil & Other Claims — {range.label}
              </button>
              <span style={{ fontSize: 11, color: "#854d0e", fontWeight: 500 }}>
                {periodOther.length} claim{periodOther.length !== 1 ? "s" : ""} {"\u00B7"} ${periodOther.reduce((s, e) => s + (e.totalCost || 0), 0).toFixed(2)}
              </span>
            </div>
            {!otherCollapsed && (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr style={{ background: "#fffbeb" }}>
                    {/* Card Rego leads the row so each claim is immediately
                        attributable to a specific fleet-card holder — same
                        format as the vehicle-entry tables elsewhere. */}
                    <th style={{ color: "#854d0e", borderBottom: "1px solid #fde047" }}>Card Rego</th>
                    <th style={{ color: "#854d0e", borderBottom: "1px solid #fde047" }}>Date</th>
                    <th style={{ color: "#854d0e", borderBottom: "1px solid #fde047" }}>Driver</th>
                    <th style={{ color: "#854d0e", borderBottom: "1px solid #fde047" }}>Division</th>
                    <th style={{ color: "#854d0e", borderBottom: "1px solid #fde047" }}>Equipment</th>
                    <th style={{ color: "#854d0e", borderBottom: "1px solid #fde047" }}>Litres</th>
                    <th style={{ color: "#854d0e", borderBottom: "1px solid #fde047" }}>$/L</th>
                    <th style={{ color: "#854d0e", borderBottom: "1px solid #fde047" }}>Cost</th>
                    <th style={{ color: "#854d0e", borderBottom: "1px solid #fde047" }}>Station</th>
                    <th style={{ color: "#854d0e", borderBottom: "1px solid #fde047" }}>Notes</th>
                    <th style={{ color: "#854d0e", borderBottom: "1px solid #fde047" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {periodOther.map(e => (
                    <tr key={e.id}>
                      <td style={{ fontWeight: 600, color: "#0f172a", fontSize: 11 }}>
                        {e.cardRego || lookupRegoByCardNumber(e.fleetCardNumber) || "\u2014"}
                      </td>
                      <td style={{ color: "#374151", fontSize: 11 }}>{e.date || "\u2014"}</td>
                      <td style={{ color: "#374151", fontSize: 11 }}>{e.driverName || "\u2014"}</td>
                      <td style={{ fontSize: 11 }}>
                        <span style={{ padding: "1px 6px", borderRadius: 8, fontSize: 9, fontWeight: 600,
                          background: e.division === "Tree" ? "#f0fdf4" : "#faf5ff",
                          color: e.division === "Tree" ? "#15803d" : "#7c3aed",
                        }}>{e.division || "Tree"}</span>
                      </td>
                      <td style={{ fontWeight: 600, color: "#0f172a", fontSize: 11 }}>{e.equipment || "\u2014"}</td>
                      <td style={{ color: "#374151", fontSize: 11 }}>{e.litres || "\u2014"}</td>
                      <td style={{ color: "#374151", fontSize: 11 }}>{e.pricePerLitre ? `$${e.pricePerLitre}` : "\u2014"}</td>
                      <td style={{ fontWeight: 600, color: "#16a34a", fontSize: 11 }}>{e.totalCost ? `$${e.totalCost.toFixed(2)}` : "\u2014"}</td>
                      <td style={{ color: "#64748b", fontSize: 10 }}>{e.station || "\u2014"}</td>
                      <td style={{ color: "#64748b", fontSize: 10, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.notes || "\u2014"}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {e.hasReceipt && (
                          <button onClick={() => setViewingReceipt(e.id)} title="View receipt" style={{
                            padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600,
                            background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", cursor: "pointer", marginRight: 3,
                          }}>{"\uD83D\uDCC4"}</button>
                        )}
                        <button onClick={() => setEditingEntry(e)} title="Edit entry" style={{
                          padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600,
                          background: "#fefce8", color: "#854d0e", border: "1px solid #fde047", cursor: "pointer",
                        }}>{"\u270F\uFE0F"}</button>
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: "#fffbeb", borderTop: "2px solid #fde047" }}>
                    <td></td>
                    <td style={{ fontWeight: 700, color: "#854d0e" }}>TOTAL</td>
                    <td></td><td></td><td></td>
                    <td style={{ fontWeight: 700, color: "#854d0e" }}>{periodOther.reduce((s, e) => s + (e.litres || 0), 0) > 0 ? periodOther.reduce((s, e) => s + (e.litres || 0), 0).toFixed(1) + "L" : ""}</td>
                    <td></td>
                    <td style={{ fontWeight: 700, color: "#16a34a" }}>${periodOther.reduce((s, e) => s + (e.totalCost || 0), 0).toFixed(2)}</td>
                    <td></td><td></td><td></td>
                  </tr>
                </tbody>
              </table>
            </div>
            )}
          </div>
          );
        })()}

        {/* Alert cards */}
        <div className="kpi-grid-3" style={{ marginBottom: 20 }}>
          <button onClick={() => { setOverdueFilter(!overdueFilter); setApproachingFilter(false); }} style={{
            background: overdueFilter ? "#dc2626" : "#fef2f2",
            border: `2px solid ${overdueFilter ? "#dc2626" : "#fca5a5"}`,
            borderRadius: 10, padding: "12px 10px", textAlign: "center", cursor: "pointer",
            fontFamily: "inherit", width: "100%", transition: "all 0.2s",
          }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: overdueFilter ? "white" : "#dc2626" }}>{overdue.length}</div>
            <div style={{ fontSize: 10, color: overdueFilter ? "rgba(255,255,255,0.9)" : "#b91c1c", marginTop: 2, fontWeight: 600 }}>
              {overdueFilter ? "\u2713 Showing Overdue" : "Service Overdue"}
            </div>
          </button>
          <button onClick={() => { setApproachingFilter(!approachingFilter); setOverdueFilter(false); }} style={{
            background: approachingFilter ? "#b45309" : "#fffbeb",
            border: `2px solid ${approachingFilter ? "#b45309" : "#fcd34d"}`,
            borderRadius: 10, padding: "12px 10px", textAlign: "center", cursor: "pointer",
            fontFamily: "inherit", width: "100%", transition: "all 0.2s",
          }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: approachingFilter ? "white" : "#b45309" }}>{approaching.length}</div>
            <div style={{ fontSize: 10, color: approachingFilter ? "rgba(255,255,255,0.9)" : "#92400e", marginTop: 2, fontWeight: 600 }}>
              {approachingFilter ? "\u2713 Showing Due Soon" : "Service Due Soon"}
            </div>
          </button>
          <button onClick={() => setWorseningFilter(!worseningFilter)} style={{
            background: worseningFilter ? "#c2410c" : "#fff7ed",
            border: `2px solid ${worseningFilter ? "#c2410c" : "#fdba74"}`,
            borderRadius: 10, padding: "12px 10px", textAlign: "center", cursor: "pointer",
            fontFamily: "inherit", width: "100%", transition: "all 0.2s",
          }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: worseningFilter ? "white" : "#c2410c" }}>{worsening.length}</div>
            <div style={{ fontSize: 10, color: worseningFilter ? "rgba(255,255,255,0.9)" : "#c2410c", marginTop: 2, fontWeight: 600 }}>
              {worseningFilter ? "\u2713 Showing Worsening" : "Efficiency Worsening"}
            </div>
          </button>
        </div>

        {/* Worsening vehicles detail panel */}
        {worseningFilter && worsening.length > 0 && (
          <div className="fade-in" style={{
            background: "#fff7ed", border: "1px solid #fdba74", borderRadius: 10,
            padding: 16, marginBottom: 20,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#c2410c" }}>
                {"\u26A0"} {worsening.length} Vehicle{worsening.length !== 1 ? "s" : ""} with Worsening Efficiency
              </div>
              <button onClick={() => setWorseningFilter(false)} style={{
                background: "none", border: "none", fontSize: 18, color: "#c2410c", cursor: "pointer",
              }}>{"\u00D7"}</button>
            </div>
            <div style={{ fontSize: 11, color: "#92400e", marginBottom: 12 }}>
              These vehicles show 15%+ higher fuel consumption in recent fill-ups compared to their earlier average.
              Review their entry history to identify causes.
            </div>
            {worsening.map(v => {
              const effRange = efficiencyThresholds[v.vt] || efficiencyThresholds.Other || DEFAULT_EFFICIENCY_RANGES.Other;
              const hb = isHoursBased(v.vt);
              const unit = hb ? "L/hr" : "L/km";
              const recent3 = v.efficiencies.slice(-3);
              const earlier = v.efficiencies.slice(0, -3);
              const recentAvg = recent3.length > 0 ? recent3.reduce((s, e) => s + e.lPerKm, 0) / recent3.length : null;
              const earlierAvg = earlier.length > 0 ? earlier.reduce((s, e) => s + e.lPerKm, 0) / earlier.length : null;
              const pctIncrease = earlierAvg && recentAvg ? Math.round(((recentAvg - earlierAvg) / earlierAvg) * 100) : null;
              return (
                <div key={v.rego} style={{
                  background: "white", border: "1px solid #e2e8f0", borderRadius: 8,
                  padding: "10px 14px", marginBottom: 8,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, color: "#0f172a", fontSize: 14 }}>{v.rego}</span>
                        {v.vehicleName && <span style={{ fontSize: 11, color: "#94a3b8" }}>{v.vehicleName}</span>}
                        <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "#fef2f2", color: "#dc2626", fontWeight: 600, border: "1px solid #fca5a5" }}>
                          {"\u2191"} {pctIncrease != null ? `+${pctIncrease}%` : "worsening"}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 16, fontSize: 11, color: "#64748b", marginTop: 4 }}>
                        <span>{v.div} {"\u00B7"} {v.vt}</span>
                        {earlierAvg != null && <span>Before: <strong style={{ color: "#374151" }}>{earlierAvg.toFixed(hb ? 1 : 3)} {unit}</strong></span>}
                        {recentAvg != null && <span>Recent: <strong style={{ color: "#dc2626" }}>{recentAvg.toFixed(hb ? 1 : 3)} {unit}</strong></span>}
                        <span>{v.fillUps} fill-ups</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button onClick={() => {
                        setView("data"); setDataSearch(v.rego); setExpandedRego(v.rego);
                      }} style={{
                        padding: "6px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                        background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe",
                        cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                      }}>{"\uD83D\uDCCA"} View History</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Service overdue detail panel */}
        {overdueFilter && overdue.length > 0 && (
          <div className="fade-in" style={{
            background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10,
            padding: 16, marginBottom: 20,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#dc2626" }}>
                {"\u26A0"} {overdue.length} Vehicle{overdue.length !== 1 ? "s" : ""} with Overdue Service
              </div>
              <button onClick={() => setOverdueFilter(false)} style={{
                background: "none", border: "none", fontSize: 18, color: "#dc2626", cursor: "pointer",
              }}>{"\u00D7"}</button>
            </div>
            <div style={{ fontSize: 11, color: "#991b1b", marginBottom: 12 }}>
              These vehicles have exceeded their scheduled service interval and need attention.
            </div>
            {overdue.map(v => {
              const hb = isHoursBased(v.vt);
              const unit = hb ? "hrs" : "km";
              return (
                <div key={v.rego} style={{
                  background: "white", border: "1px solid #fecaca", borderRadius: 8,
                  padding: "10px 14px", marginBottom: 8,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, color: "#0f172a", fontSize: 14 }}>{v.rego}</span>
                        {v.vehicleName && <span style={{ fontSize: 11, color: "#94a3b8" }}>{v.vehicleName}</span>}
                        <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "#fef2f2", color: "#dc2626", fontWeight: 600, border: "1px solid #fca5a5" }}>
                          OVERDUE
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 16, fontSize: 11, color: "#64748b", marginTop: 4, flexWrap: "wrap" }}>
                        <span>{v.div} {"\u00B7"} {v.vt}</span>
                        {v.svc?.lastServiceDate && <span>Last service: <strong style={{ color: "#374151" }}>{v.svc.lastServiceDate}</strong></span>}
                        {v.nextServiceDue && <span>Due at: <strong style={{ color: "#dc2626" }}>{v.nextServiceDue.toLocaleString()} {unit}</strong></span>}
                        {v.latestOdo && <span>Current: <strong style={{ color: "#374151" }}>{v.latestOdo.toLocaleString()} {unit}</strong></span>}
                        {v.kmSinceService != null && <span>Since service: <strong style={{ color: "#dc2626" }}>{Math.round(v.kmSinceService).toLocaleString()} {unit}</strong></span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button onClick={() => {
                        setView("data"); setDataSearch(v.rego); setExpandedRego(v.rego);
                      }} style={{
                        padding: "6px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                        background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe",
                        cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                      }}>{"\uD83D\uDCCA"} View</button>
                      <button onClick={() => {
                        setView("data"); setServiceModal(v.rego);
                      }} style={{
                        padding: "6px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                        background: "#f0fdf4", color: "#15803d", border: "1px solid #86efac",
                        cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                      }}>{"\uD83D\uDD27"} Service</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Service due soon detail panel */}
        {approachingFilter && approaching.length > 0 && (
          <div className="fade-in" style={{
            background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 10,
            padding: 16, marginBottom: 20,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#b45309" }}>
                {"\u26A1"} {approaching.length} Vehicle{approaching.length !== 1 ? "s" : ""} with Service Due Soon
              </div>
              <button onClick={() => setApproachingFilter(false)} style={{
                background: "none", border: "none", fontSize: 18, color: "#b45309", cursor: "pointer",
              }}>{"\u00D7"}</button>
            </div>
            <div style={{ fontSize: 11, color: "#92400e", marginBottom: 12 }}>
              These vehicles are approaching their next service interval. Schedule maintenance soon.
            </div>
            {approaching.map(v => {
              const hb = isHoursBased(v.vt);
              const unit = hb ? "hrs" : "km";
              return (
                <div key={v.rego} style={{
                  background: "white", border: "1px solid #fde68a", borderRadius: 8,
                  padding: "10px 14px", marginBottom: 8,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, color: "#0f172a", fontSize: 14 }}>{v.rego}</span>
                        {v.vehicleName && <span style={{ fontSize: 11, color: "#94a3b8" }}>{v.vehicleName}</span>}
                        {v.kmToService != null && (
                          <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "#fffbeb", color: "#b45309", fontWeight: 600, border: "1px solid #fcd34d" }}>
                            {Math.round(v.kmToService).toLocaleString()} {unit} remaining
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 16, fontSize: 11, color: "#64748b", marginTop: 4, flexWrap: "wrap" }}>
                        <span>{v.div} {"\u00B7"} {v.vt}</span>
                        {v.svc?.lastServiceDate && <span>Last service: <strong style={{ color: "#374151" }}>{v.svc.lastServiceDate}</strong></span>}
                        {v.nextServiceDue && <span>Due at: <strong style={{ color: "#b45309" }}>{v.nextServiceDue.toLocaleString()} {unit}</strong></span>}
                        {v.latestOdo && <span>Current: <strong style={{ color: "#374151" }}>{v.latestOdo.toLocaleString()} {unit}</strong></span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button onClick={() => {
                        setView("data"); setDataSearch(v.rego); setExpandedRego(v.rego);
                      }} style={{
                        padding: "6px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                        background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe",
                        cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                      }}>{"\uD83D\uDCCA"} View</button>
                      <button onClick={() => {
                        setView("data"); setServiceModal(v.rego);
                      }} style={{
                        padding: "6px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                        background: "#f0fdf4", color: "#15803d", border: "1px solid #86efac",
                        cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                      }}>{"\uD83D\uDD27"} Service</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Fleet table — grouped by division → vehicle type */}
        {(() => {
          const fleetCollapsed = !!collapsedDashSections.fleetTable;
          return (
          <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
            <div style={{ padding: "10px 14px", background: "#f8fafc", borderBottom: fleetCollapsed ? "none" : "1px solid #e2e8f0" }}>
              <button onClick={() => toggleDashSection("fleetTable")} style={{
                background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#374151",
              }}>
                <span style={{ fontSize: 10, color: "#94a3b8", transform: fleetCollapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.2s", display: "inline-block" }}>{"\u25BC"}</span>
                {"\uD83D\uDE9B"} Fleet Overview
              </button>
            </div>
            {!fleetCollapsed && (<div style={{ padding: 10 }}>{(() => {
          // Group sorted vehicles by division → vehicle type
          const groups = {};
          sorted.forEach(v => {
            const div = v.div || "Other";
            const vt = v.vt || "Other";
            const key = `${div}|||${vt}`;
            if (!groups[key]) groups[key] = { div, vt, vehicles: [] };
            groups[key].vehicles.push(v);
          });
          // Sort groups: Tree first, then Landscape, then by vehicle type
          const divOrder = { Tree: 0, Landscape: 1 };
          const groupList = Object.values(groups).sort((a, b) => {
            const da = divOrder[a.div] ?? 2, db = divOrder[b.div] ?? 2;
            if (da !== db) return da - db;
            return a.vt.localeCompare(b.vt);
          });
          const toggleGroup = (key) => setCollapsedFleetGroups(prev => ({ ...prev, [key]: !prev[key] }));
          const DIV_COLORS = { Tree: { bg: "#f0fdf4", border: "#86efac", text: "#15803d" }, Landscape: { bg: "#eff6ff", border: "#93c5fd", text: "#1e40af" } };

          return groupList.map(group => {
            const key = `${group.div}|||${group.vt}`;
            const isCollapsed = collapsedFleetGroups[key];
            const dc = DIV_COLORS[group.div] || { bg: "#f8fafc", border: "#e2e8f0", text: "#374151" };
            // Only count OPEN flags — skip anything already resolved by admin
            const groupFlags = group.vehicles.reduce((s, v) => s + v.flags.filter(f =>
              f.category === "ops" && (f.type === "danger" || f.type === "warn") && !resolvedFlags[flagId(f)]
            ).length, 0);
            // Service overdue badge also hides when its flag(s) are resolved
            const groupOverdue = group.vehicles.filter(v => {
              if (v.svcStatus !== "overdue") return false;
              const overdueFlags = v.flags.filter(f => f.text === "SERVICE OVERDUE");
              if (overdueFlags.length === 0) return true;
              return overdueFlags.some(f => !resolvedFlags[flagId(f)]);
            }).length;

            return (
              <div key={key} style={{ marginBottom: 10 }}>
                <button onClick={() => toggleGroup(key)} style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 14px", borderRadius: isCollapsed ? 10 : "10px 10px 0 0",
                  border: `1px solid ${dc.border}`, background: dc.bg, cursor: "pointer", fontFamily: "inherit",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "#64748b", transition: "transform 0.2s", transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }}>{"\u25BC"}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: dc.text }}>{group.div}</span>
                    <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>{"\u00B7"} {group.vt}</span>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>({group.vehicles.length})</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {groupOverdue > 0 && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "#fef2f2", color: "#dc2626", fontWeight: 600 }}>{groupOverdue} overdue</span>}
                    {groupFlags > 0 && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "#fef2f2", color: "#dc2626", fontWeight: 600 }}>{groupFlags} flags</span>}
                  </div>
                </button>
                {!isCollapsed && (
                  <div style={{ background: "white", border: `1px solid ${dc.border}`, borderTop: "none", borderRadius: "0 0 10px 10px", overflow: "hidden" }}>
                    <div style={{ overflowX: "auto" }}>
                      <table className="data-table">
                        <thead>
                          <tr style={{ background: "#f8fafc" }}>
                            <th style={{ borderBottom: "2px solid #e2e8f0", color: "#374151" }}>Vehicle</th>
                            <th style={{ borderBottom: "2px solid #e2e8f0", color: "#374151" }}>Odometer</th>
                            <th style={{ borderBottom: "2px solid #e2e8f0", color: "#374151" }}>Fill-ups</th>
                            <th style={{ borderBottom: "2px solid #e2e8f0", color: "#374151" }}>{isHoursBased(group.vt) ? "Total Hrs" : "Total KM"}</th>
                            <th style={{ borderBottom: "2px solid #e2e8f0", color: "#374151" }}>Total L</th>
                            <th style={{ borderBottom: "2px solid #e2e8f0", color: "#1e40af" }}>{isHoursBased(group.vt) ? "Avg L/hr" : "Avg L/km"}</th>
                            <th style={{ borderBottom: "2px solid #e2e8f0", color: "#1e40af" }}>Trend</th>
                            <th style={{ borderBottom: "2px solid #e2e8f0", color: "#854d0e" }}>Service</th>
                            <th style={{ borderBottom: "2px solid #e2e8f0", color: "#374151" }}>Flags</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.vehicles.map(v => {
                            const sc = svcColor(v.svcStatus);
                            const effRange = efficiencyThresholds[v.vt] || efficiencyThresholds.Other || DEFAULT_EFFICIENCY_RANGES.Other;
                            const isRowExpanded = expandedFleetVehicle === v.rego;
                            const vehicleEntries = entries
                              .filter(e => e.entryType !== "other" && e.registration === v.rego)
                              .sort(sortEntries);
                            const hb = isHoursBased(v.vt);
                            return (
                              <React.Fragment key={v.rego}>
                              <tr onClick={() => setExpandedFleetVehicle(isRowExpanded ? null : v.rego)}
                                  style={{
                                    background: v.svcStatus === "overdue" ? "#fef2f2" : v.svcStatus === "approaching" ? "#fffdf5" : (isRowExpanded ? "#f8fafc" : "white"),
                                    cursor: "pointer",
                                  }}>
                                <td style={{ fontWeight: 700, color: "#0f172a" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <span style={{ fontSize: 10, color: "#94a3b8", transform: isRowExpanded ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.2s", display: "inline-block" }}>{"\u25BC"}</span>
                                    <span>{v.rego}</span>
                                  </div>
                                  {v.vehicleName && <div style={{ fontSize: 9, color: "#94a3b8", fontWeight: 400, marginLeft: 16 }}>{v.vehicleName}</div>}
                                </td>
                                <td style={{ color: "#374151" }}>{v.latestOdo ? v.latestOdo.toLocaleString() : "\u2014"}</td>
                                <td style={{ color: "#64748b", textAlign: "center" }}>{v.fillUps}</td>
                                <td style={{ color: "#374151" }}>{v.totalKm > 0 ? v.totalKm.toLocaleString() : "\u2014"}</td>
                                <td style={{ color: "#374151" }}>{v.totalLitres > 0 ? `${v.totalLitres.toFixed(0)}L` : "\u2014"}</td>
                                <td style={{
                                  fontWeight: 600,
                                  color: v.avgLPerKm ? (v.avgLPerKm > effRange.high ? "#dc2626" : v.avgLPerKm < effRange.low ? "#2563eb" : "#15803d") : "#94a3b8",
                                }}>
                                  {v.avgLPerKm ? v.avgLPerKm.toFixed(isHoursBased(v.vt) ? 1 : 3) : "\u2014"}
                                </td>
                                <td>
                                  {v.trend === "worsening" && <span style={{ color: "#dc2626", fontWeight: 600, fontSize: 10 }}>{"\u2191"} Worsening</span>}
                                  {v.trend === "improving" && <span style={{ color: "#15803d", fontWeight: 600, fontSize: 10 }}>{"\u2193"} Improving</span>}
                                  {v.trend === "stable" && <span style={{ color: "#64748b", fontSize: 10 }}>{"\u2192"} Stable</span>}
                                  {!v.trend && <span style={{ color: "#cbd5e1", fontSize: 10 }}>{"\u2014"}</span>}
                                </td>
                                <td>
                                  <span className={`flag-badge flag-${v.svcStatus === "overdue" ? "danger" : v.svcStatus === "approaching" ? "warn" : "ok"}`} style={{ fontSize: 9 }}>
                                    {sc.label}
                                    {v.kmToService != null && v.svcStatus !== "unknown" && (
                                      <span style={{ marginLeft: 3, opacity: 0.8 }}>
                                        {v.svcStatus === "overdue" ? `+${Math.abs(v.kmToService).toLocaleString()}` : v.kmToService.toLocaleString()}{odoUnit(v.vt)}
                                      </span>
                                    )}
                                  </span>
                                </td>
                                <td>
                                  {(() => {
                                    const openOps = v.flags.filter(f =>
                                      f.category === "ops" && (f.type === "danger" || f.type === "warn") && !resolvedFlags[flagId(f)]
                                    );
                                    return openOps.length > 0 ? (
                                      <span className="flag-badge flag-danger" style={{ fontSize: 9, cursor: "pointer" }} onClick={(ev) => { ev.stopPropagation(); setShowFlags(true); }}>
                                        {openOps.length}
                                      </span>
                                    ) : (
                                      <span style={{ color: "#86efac", fontSize: 12 }}>{"\u2713"}</span>
                                    );
                                  })()}
                                </td>
                              </tr>
                              {isRowExpanded && (
                                <tr style={{ background: "#f8fafc" }}>
                                  <td colSpan={9} style={{ padding: "8px 12px 12px 12px" }}>
                                    {vehicleEntries.length === 0 ? (
                                      <div style={{ fontSize: 11, color: "#94a3b8", padding: "8px 0" }}>No entries for this vehicle.</div>
                                    ) : (
                                      <div style={{ overflowX: "auto", background: "white", border: "1px solid #e2e8f0", borderRadius: 6 }}>
                                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                                          <thead>
                                            <tr style={{ background: "#f1f5f9" }}>
                                              {["Date", "Driver", "Station", "Litres", "$/L", "Cost", hb ? "Hours" : "Odo", ""].map((h, hi) => (
                                                <th key={hi} style={{ padding: "4px 6px", textAlign: "left", fontWeight: 600, color: "#64748b", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>{h}</th>
                                              ))}
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {vehicleEntries.map(e => (
                                              <tr key={e.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                                <td style={{ padding: "4px 6px", color: "#374151", whiteSpace: "nowrap" }}>{e.date || "\u2014"}</td>
                                                <td style={{ padding: "4px 6px", color: "#374151" }}>{e.driverName || "\u2014"}</td>
                                                <td style={{ padding: "4px 6px", color: "#64748b" }}>{e.station || "\u2014"}</td>
                                                <td style={{ padding: "4px 6px", color: "#374151" }}>{e.litres ? `${e.litres}L` : "\u2014"}</td>
                                                <td style={{ padding: "4px 6px", color: "#374151" }}>{e.pricePerLitre ? `$${e.pricePerLitre}` : "\u2014"}</td>
                                                <td style={{ padding: "4px 6px", fontWeight: 600, color: "#16a34a" }}>{e.totalCost ? `$${e.totalCost.toFixed(2)}` : "\u2014"}</td>
                                                <td style={{ padding: "4px 6px", color: "#374151" }}>{e.odometer ? e.odometer.toLocaleString() : "\u2014"}</td>
                                                <td style={{ padding: "4px 6px", whiteSpace: "nowrap" }}>
                                                  {e.hasReceipt && (
                                                    <button onClick={(ev) => { ev.stopPropagation(); setViewingReceipt(e.id); }} title="View receipt" style={{
                                                      padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 600,
                                                      background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", cursor: "pointer", marginRight: 3,
                                                    }}>{"\uD83D\uDCC4"}</button>
                                                  )}
                                                  <button onClick={(ev) => { ev.stopPropagation(); setEditingEntry(e); }} title="Edit entry" style={{
                                                    padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 600,
                                                    background: "#fefce8", color: "#854d0e", border: "1px solid #fde047", cursor: "pointer",
                                                  }}>{"\u270F\uFE0F"}</button>
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          });
        })()}</div>)}
          </div>
          );
        })()}

        {/* Efficiency anomalies section */}
        {fleet.some(v => v.anomalies.length > 0) && (
          <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, padding: 16, marginTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#b91c1c", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 10 }}>{"\u26A0"} Fuel Consumption Anomalies</div>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 10 }}>Fill-ups where fuel consumption was 50%+ above that vehicle's own average {"\u2014"} may indicate leaks, theft, incorrect data, or mechanical issues.</div>
            {fleet.filter(v => v.anomalies.length > 0).map(v => (
              <div key={v.rego} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 4 }}>{v.rego} <span style={{ fontWeight: 400, color: "#94a3b8" }}>avg {v.avgLPerKm?.toFixed(isHoursBased(v.vt) ? 1 : 3)} {isHoursBased(v.vt) ? "L/hr" : "L/km"}</span></div>
                {v.anomalies.map((a, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, fontSize: 11, color: "#dc2626", padding: "2px 0" }}>
                    <span>{a.date || "?"}</span>
                    <span style={{ fontWeight: 600 }}>{a.lPerKm.toFixed(isHoursBased(v.vt) ? 1 : 3)} {isHoursBased(v.vt) ? "L/hr" : "L/km"}</span>
                    <span style={{ color: "#94a3b8" }}>+{a.pct}% above avg</span>
                    <span style={{ color: "#64748b" }}>{a.litres}L / {a.km.toLocaleString()}{odoUnit(v.vt)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Fuel type breakdown */}
        {(() => {
          const vehicleEntries = entries.filter(e => e.entryType !== "other");

          // Normalize all fuel types to 4 categories
          const normalizeFuelType = (ft) => {
            if (!ft) return "Unknown";
            const l = ft.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
            if (/diesel/i.test(l)) return "Diesel";
            if (/ethanol|e10|e85/i.test(l)) return "Unleaded + Ethanol";
            if (/premium|95|98|ultimate|vpower|vortex/i.test(l)) return "Premium Unleaded";
            if (/unleaded|91|regular|petrol|fuel|gasoline/i.test(l)) return "Regular Unleaded";
            if (l === "unknown" || l === "") return "Unknown";
            return "Unknown";
          };

          const FUEL_CATEGORIES = ["Diesel", "Regular Unleaded", "Premium Unleaded", "Unleaded + Ethanol"];
          const FUEL_COLORS = { "Diesel": "#0f172a", "Regular Unleaded": "#16a34a", "Premium Unleaded": "#2563eb", "Unleaded + Ethanol": "#f59e0b", "Unknown": "#94a3b8" };

          const fuelTypes = {};
          vehicleEntries.forEach(e => {
            const cat = normalizeFuelType(e.fuelType);
            if (!fuelTypes[cat]) fuelTypes[cat] = { litres: 0, cost: 0, count: 0, entries: [] };
            fuelTypes[cat].litres += e.litres || 0;
            fuelTypes[cat].cost += e.totalCost || 0;
            fuelTypes[cat].count += 1;
            fuelTypes[cat].entries.push(e);
          });
          // Show categories in fixed order, skip empty ones
          const sorted = [...FUEL_CATEGORIES, "Unknown"].filter(c => fuelTypes[c]).map(c => [c, fuelTypes[c]]);
          const totalLitresAll = sorted.reduce((s, [ v]) => s + v.litres, 0);
          if (sorted.length === 0) return null;

          return (
            <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, padding: 16, marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 12 }}>{"\u26FD"} Fuel Type Breakdown</div>

              {/* Stacked bar */}
              <div style={{ display: "flex", height: 28, borderRadius: 6, overflow: "hidden", marginBottom: 14 }}>
                {sorted.map(([ft, data]) => {
                  const pct = totalLitresAll > 0 ? (data.litres / totalLitresAll) * 100 : 0;
                  if (pct < 0.5) return null;
                  return (
                    <div key={ft} title={`${ft}: ${pct.toFixed(1)}%`} style={{
                      width: `${pct}%`, background: FUEL_COLORS[ft],
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 9, fontWeight: 700, color: "white",
                      transition: "width 0.3s",
                    }}>
                      {pct >= 10 ? `${pct.toFixed(0)}%` : ""}
                    </div>
                  );
                })}
              </div>

              {/* Detail rows — expandable */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {sorted.map(([ft, data]) => {
                  const pct = totalLitresAll > 0 ? (data.litres / totalLitresAll) * 100 : 0;
                  const isOpen = expandedFuelType === ft;
                  return (
                    <div key={ft}>
                      <div onClick={() => setExpandedFuelType(isOpen ? null : ft)} style={{
                        display: "flex", alignItems: "center", gap: 10, fontSize: 12,
                        padding: "6px 8px", borderRadius: 6, cursor: "pointer",
                        background: isOpen ? "#f8fafc" : "transparent",
                        transition: "background 0.15s",
                      }}>
                        <div style={{ width: 10, height: 10, borderRadius: 3, background: FUEL_COLORS[ft], flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, color: "#0f172a", minWidth: 120 }}>{ft}</span>
                        <span style={{ color: "#64748b", flex: 1 }}>{data.litres.toFixed(0)}L</span>
                        <span style={{ color: "#64748b" }}>${data.cost.toFixed(0)}</span>
                        <span style={{ color: "#64748b", fontSize: 11 }}>{data.count} fills</span>
                        <span style={{ fontWeight: 700, color: FUEL_COLORS[ft], minWidth: 45, textAlign: "right" }}>{pct.toFixed(1)}%</span>
                        <span style={{ color: "#94a3b8", fontSize: 14, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>{"\u25BE"}</span>
                      </div>

                      {/* Expanded fill-ups */}
                      {isOpen && (
                        <div className="fade-in" style={{
                          margin: "4px 0 8px 20px", borderLeft: `3px solid ${FUEL_COLORS[ft]}`,
                          paddingLeft: 12,
                        }}>
                          <div style={{ overflowX: "auto" }}>
                            <table className="data-table">
                              <thead>
                                <tr style={{ background: "#fafafa" }}>
                                  <th style={{ color: "#64748b", borderBottom: "1px solid #e2e8f0", fontSize: 10 }}>Date</th>
                                  <th style={{ color: "#64748b", borderBottom: "1px solid #e2e8f0", fontSize: 10 }}>Driver</th>
                                  <th style={{ color: "#64748b", borderBottom: "1px solid #e2e8f0", fontSize: 10 }}>Rego</th>
                                  <th style={{ color: "#64748b", borderBottom: "1px solid #e2e8f0", fontSize: 10 }}>Station</th>
                                  <th style={{ color: "#64748b", borderBottom: "1px solid #e2e8f0", fontSize: 10 }}>Litres</th>
                                  <th style={{ color: "#64748b", borderBottom: "1px solid #e2e8f0", fontSize: 10 }}>$/L</th>
                                  <th style={{ color: "#64748b", borderBottom: "1px solid #e2e8f0", fontSize: 10 }}>Cost</th>
                                </tr>
                              </thead>
                              <tbody>
                                {data.entries.sort((a, b) => parseDate(b.date) - parseDate(a.date)).map(e => (
                                  <tr key={e.id}>
                                    <td style={{ color: "#374151", fontSize: 11 }}>{e.date || "\u2014"}</td>
                                    <td style={{ color: "#374151", fontSize: 11 }}>{e.driverName || "\u2014"}</td>
                                    <td style={{ fontWeight: 600, color: "#0f172a", fontSize: 11 }}>{e.registration || "\u2014"}</td>
                                    <td style={{ color: "#64748b", fontSize: 10 }}>{e.station || "\u2014"}</td>
                                    <td style={{ color: "#374151", fontSize: 11 }}>{e.litres ? `${e.litres}L` : "\u2014"}</td>
                                    <td style={{ color: "#64748b", fontSize: 11 }}>{e.pricePerLitre ? `$${e.pricePerLitre}` : "\u2014"}</td>
                                    <td style={{ fontWeight: 600, color: "#16a34a", fontSize: 11 }}>{e.totalCost ? `$${e.totalCost.toFixed(2)}` : "\u2014"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Total */}
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b" }}>
                <span style={{ fontWeight: 600, color: "#374151" }}>Total</span>
                <span>{totalLitresAll.toFixed(0)}L across {sorted.length} fuel types</span>
              </div>
            </div>
          );
        })()}
      </div>
    );
  };
  // Reusable bulk-action bar for flag modals.
  // Shows: [select-all] N selected of M visible · [Resolve N selected] [Clear]
  const BulkActionBar = ({ visibleIds, openIds, accent }) => {
    const selectableIds = openIds; // only open flags can be bulk-resolved
    const allSelectableSelected = selectableIds.length > 0 && selectableIds.every(id => selectedFlagIds.has(id));
    const someSelected = selectableIds.some(id => selectedFlagIds.has(id));
    const selectedOpenIds = selectableIds.filter(id => selectedFlagIds.has(id));
    const toggleAll = () => {
      setSelectedFlagIds(prev => {
        const next = new Set(prev);
        if (allSelectableSelected) { for (const id of selectableIds) next.delete(id); }
        else { for (const id of selectableIds) next.add(id); }
        return next;
      });
    };
    if (selectableIds.length === 0 && selectedFlagIds.size === 0) return null;
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        padding: "8px 12px", marginBottom: 12, borderRadius: 8,
        background: someSelected ? "#eff6ff" : "#f8fafc",
        border: `1px solid ${someSelected ? (accent || "#2563eb") : "#e2e8f0"}`,
      }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: "#374151", fontWeight: 600 }}>
          <input type="checkbox" checked={allSelectableSelected}
            onChange={toggleAll}
            ref={el => { if (el) el.indeterminate = !allSelectableSelected && someSelected; }}
            style={{ width: 16, height: 16, cursor: "pointer", accentColor: accent || "#2563eb" }}
          />
          Select all open ({selectableIds.length})
        </label>
        <div style={{ flex: 1, fontSize: 11, color: "#64748b" }}>
          {selectedOpenIds.length > 0 && <span style={{ fontWeight: 600, color: accent || "#2563eb" }}>{selectedOpenIds.length} selected</span>}
        </div>
        {selectedOpenIds.length > 0 && (
          <>
            <button onClick={async () => {
              await resolveFlagsBulk(selectedOpenIds, "Bulk resolved", "Admin");
              setSelectedFlagIds(new Set());
            }} style={{
              padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700,
              background: "#16a34a", color: "white", border: "none",
              cursor: "pointer", fontFamily: "inherit",
            }}>{"\u2713"} Resolve {selectedOpenIds.length} selected</button>
            <button onClick={() => setSelectedFlagIds(new Set())} style={{
              padding: "6px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
              background: "white", color: "#64748b", border: "1px solid #e2e8f0",
              cursor: "pointer", fontFamily: "inherit",
            }}>Clear</button>
          </>
        )}
      </div>
    );
  };

  // Per-row bulk-select checkbox (small, left of the flag row)
  const BulkSelectBox = ({ id, disabled, accent }) => (
    <input type="checkbox" checked={selectedFlagIds.has(id)} disabled={disabled}
      onChange={e => {
        e.stopPropagation();
        setSelectedFlagIds(prev => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id); else next.add(id);
          return next;
        });
      }}
      onClick={e => e.stopPropagation()}
      title={disabled ? "Already resolved" : "Select for bulk resolve"}
      style={{
        width: 16, height: 16, cursor: disabled ? "not-allowed" : "pointer",
        flexShrink: 0, marginTop: 4, accentColor: accent || "#2563eb",
        opacity: disabled ? 0.4 : 1,
      }}
    />
  );

  const renderFlagsModal = () => {
    if (!showFlags) return null;
    const fleet = fleetAnalysis;
    // Dashboard only shows operational flags — AI flags appear in Data section
    const opsFlags = fleet.flatMap(v => v.flags.filter(f => f.category === "ops" && (f.type === "danger" || f.type === "warn")));

    // Add stable ID to each flag
    const flagsWithId = opsFlags.map(f => ({ ...f, _id: flagId(f) }));
    const openFlags = flagsWithId.filter(f => !resolvedFlags[f._id]);
    const doneFlags = flagsWithId.filter(f => resolvedFlags[f._id]);
    const baseVisible = flagsFilter === "open" ? openFlags : flagsFilter === "resolved" ? doneFlags : flagsWithId;
    const regoQ = flagsRegoSearch.trim().toUpperCase();
    const visibleFlags = regoQ ? baseVisible.filter(f => (f.rego || "").toUpperCase().includes(regoQ)) : baseVisible;

    // Unique regos for quick-pick pills
    const allRegos = [...new Set(baseVisible.map(f => f.rego).filter(Boolean))].sort();

    // Group by type of issue
    const groupFlags = (list) => {
      const svc = list.filter(f => f.text.includes("SERVICE") || f.text.includes("Service"));
      const fuel = list.filter(f => f.text.includes("fuel") || f.text.includes("Fuel") || f.text.includes("litres") || f.text.includes("Litres") || f.text.includes("price"));
      const cost = list.filter(f => f.text.includes("Cost") || f.text.includes("cost") || f.text.includes("variance"));
      const odo = list.filter(f => f.text.includes("Odo") || f.text.includes("km"));
      const matched = [...svc, ...fuel, ...cost, ...odo];
      const other = list.filter(f => !matched.includes(f));
      return [
        { title: "Service Required", icon: "\uD83D\uDD27", flags: svc, color: "#b91c1c" },
        { title: "Fuel Consumption Issues", icon: "\u26FD", flags: fuel, color: "#b45309" },
        { title: "Cost Discrepancies", icon: "\uD83D\uDCB0", flags: cost, color: "#b45309" },
        { title: "Odometer / Distance / Hours Issues", icon: "\uD83D\uDCCF", flags: odo, color: "#b45309" },
        { title: "Other", icon: "\u26A1", flags: other, color: "#64748b" },
      ].filter(g => g.flags.length > 0);
    };

    const groups = groupFlags(visibleFlags);

    const FlagItem = ({ f }) => {
      const isResolved = !!resolvedFlags[f._id];
      const resolution = resolvedFlags[f._id];
      const isReplying = replyingFlag === f._id;

      return (
        <div style={{
          padding: "8px 10px", marginBottom: 6, borderRadius: 8,
          background: isResolved ? "#f8fafc" : f.type === "danger" ? "#fef2f2" : "#fffbeb",
          border: `1px solid ${isResolved ? "#e2e8f0" : f.type === "danger" ? "#fca5a5" : "#fcd34d"}`,
          opacity: isResolved ? 0.7 : 1, transition: "all 0.2s",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            {/* Bulk select (disabled if already resolved) */}
            <BulkSelectBox id={f._id} disabled={isResolved} accent="#f59e0b" />
            {/* Resolve toggle */}
            <button onClick={() => isResolved ? unresolveFlag(f._id) : setReplyingFlag(isReplying ? null : f._id)}
              style={{
                width: 22, height: 22, borderRadius: 6, border: `2px solid ${isResolved ? "#16a34a" : "#cbd5e1"}`,
                background: isResolved ? "#16a34a" : "white", color: "white", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12,
                fontWeight: 700, flexShrink: 0, marginTop: 1, transition: "all 0.15s",
              }}>
              {isResolved ? "\u2713" : ""}
            </button>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700, color: "#0f172a", fontSize: 12 }}>{f.rego}</span>
                <span style={{
                  fontWeight: 600, fontSize: 11,
                  color: isResolved ? "#64748b" : f.type === "danger" ? "#b91c1c" : "#92400e",
                  textDecoration: isResolved ? "line-through" : "none",
                }}>{f.text}</span>
                <span style={{ color: "#94a3b8", fontSize: 10 }}>{f.date || ""}</span>
              </div>
              <div style={{ color: "#64748b", fontSize: 10, marginTop: 2 }}>{f.detail}</div>

              {/* Resolution info */}
              {isResolved && resolution && (
                <div style={{ marginTop: 6, padding: "4px 8px", background: "#f0fdf4", borderRadius: 4, border: "1px solid #bbf7d0", fontSize: 10 }}>
                  <span style={{ color: "#15803d", fontWeight: 600 }}>{"\u2713"} Resolved by {resolution.by}</span>
                  <span style={{ color: "#94a3b8", marginLeft: 8 }}>{resolution.at ? new Date(resolution.at).toLocaleDateString("en-AU") : ""}</span>
                  {resolution.note && <div style={{ color: "#374151", marginTop: 2 }}>{resolution.note}</div>}
                </div>
              )}

              {/* Reply form */}
              {isReplying && !isResolved && (
                <ReplyForm fid={f._id} onResolve={(note, by) => { resolveFlag(f._id, note, by); setReplyingFlag(null); }} onCancel={() => setReplyingFlag(null)} />
              )}
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
              {f._entry?.hasReceipt && (
                <button onClick={() => setExpandedReceipt(expandedReceipt === f._id ? null : f._id)} style={{
                  padding: "4px 8px", borderRadius: 5, fontSize: 10, fontWeight: 600,
                  background: expandedReceipt === f._id ? "#7c3aed" : "#faf5ff",
                  color: expandedReceipt === f._id ? "white" : "#7c3aed",
                  border: `1px solid ${expandedReceipt === f._id ? "#7c3aed" : "#c4b5fd"}`,
                  cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                }}>{"\uD83D\uDCC4"} {expandedReceipt === f._id ? "Hide" : "Receipt"}</button>
              )}
              {!isResolved && !isReplying && (
                <button onClick={() => setReplyingFlag(f._id)} style={{
                  padding: "4px 8px", borderRadius: 5, fontSize: 10, fontWeight: 600,
                  background: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0",
                  cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                }}>Respond</button>
              )}
              {f._entry && (
                <button onClick={() => { setEditingEntry(f._entry); setShowFlags(false); }} style={{
                  padding: "4px 8px", borderRadius: 5, fontSize: 10, fontWeight: 600,
                  background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe",
                  cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                }}>{"\u270E"} Edit</button>
              )}
            </div>
          </div>
          {expandedReceipt === f._id && f._entry?.hasReceipt && (
            <InlineReceipt entryId={f._entry.id} loadFn={loadReceiptImage} />
          )}
        </div>
      );
    };

    return (
      <div style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex",
        alignItems: "flex-start", justifyContent: "center", zIndex: 100, padding: "40px 16px",
        overflowY: "auto",
      }} onClick={() => { setShowFlags(false); setReplyingFlag(null); setFlagsRegoSearch(""); setSelectedFlagIds(new Set()); }}>
        <div onClick={e => e.stopPropagation()} style={{
          background: "white", borderRadius: 14, padding: 24, width: "100%", maxWidth: 640,
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)", maxHeight: "85vh", overflowY: "auto",
        }} className="fade-in">
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>{"\u26A0"} Issues to Address</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                {openFlags.length} open {"\u00B7"} {doneFlags.length} resolved
                {regoQ && <span style={{ color: "#2563eb", fontWeight: 600 }}> {"\u00B7"} filtered: {flagsRegoSearch}</span>}
              </div>
            </div>
            <button onClick={() => { setShowFlags(false); setReplyingFlag(null); setFlagsRegoSearch(""); setSelectedFlagIds(new Set()); }} style={{
              background: "none", border: "none", fontSize: 24, color: "#94a3b8", cursor: "pointer", lineHeight: 1,
            }}>{"\u00D7"}</button>
          </div>

          {/* Progress bar */}
          {flagsWithId.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b", marginBottom: 4 }}>
                <span>{doneFlags.length} of {flagsWithId.length} resolved</span>
                <span style={{ fontWeight: 600, color: doneFlags.length === flagsWithId.length ? "#15803d" : "#374151" }}>
                  {flagsWithId.length > 0 ? Math.round((doneFlags.length / flagsWithId.length) * 100) : 0}%
                </span>
              </div>
              <div style={{ height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 3, transition: "width 0.3s",
                  width: `${flagsWithId.length > 0 ? (doneFlags.length / flagsWithId.length) * 100 : 0}%`,
                  background: doneFlags.length === flagsWithId.length ? "#16a34a" : "#f59e0b",
                }} />
              </div>
            </div>
          )}

          {/* Filter tabs */}
          <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
            {[
              { key: "open", label: `Open (${openFlags.length})` },
              { key: "resolved", label: `Resolved (${doneFlags.length})` },
              { key: "all", label: `All (${flagsWithId.length})` },
            ].map(tab => (
              <button key={tab.key} onClick={() => setFlagsFilter(tab.key)} style={{
                padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: flagsFilter === tab.key ? 700 : 500,
                cursor: "pointer", fontFamily: "inherit",
                background: flagsFilter === tab.key ? "#0f172a" : "#f8fafc",
                color: flagsFilter === tab.key ? "white" : "#64748b",
                border: `1px solid ${flagsFilter === tab.key ? "#0f172a" : "#e2e8f0"}`,
              }}>{tab.label}</button>
            ))}
          </div>

          {/* Rego search */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ position: "relative", marginBottom: allRegos.length > 1 ? 8 : 0 }}>
              <input value={flagsRegoSearch} onChange={e => setFlagsRegoSearch(e.target.value)}
                placeholder="Filter by vehicle rego..."
                style={{
                  width: "100%", padding: "8px 12px 8px 32px", borderRadius: 8,
                  border: `1px solid ${flagsRegoSearch ? "#2563eb" : "#e2e8f0"}`,
                  fontSize: 12, outline: "none", fontFamily: "inherit", color: "#0f172a",
                  background: flagsRegoSearch ? "#eff6ff" : "white",
                }}
                onFocus={e => e.target.style.borderColor = "#2563eb"}
                onBlur={e => { if (!flagsRegoSearch) e.target.style.borderColor = "#e2e8f0"; }}
              />
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#94a3b8" }}>{"\uD83D\uDD0D"}</span>
              {flagsRegoSearch && (
                <button onClick={() => setFlagsRegoSearch("")} style={{
                  position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 16,
                }}>{"\u00D7"}</button>
              )}
            </div>
            {allRegos.length > 1 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {allRegos.map(r => (
                  <button key={r} onClick={() => setFlagsRegoSearch(flagsRegoSearch === r ? "" : r)} style={{
                    padding: "3px 8px", borderRadius: 5, fontSize: 10, fontWeight: 600,
                    cursor: "pointer", fontFamily: "inherit",
                    background: flagsRegoSearch.toUpperCase() === r ? "#2563eb" : "#f8fafc",
                    color: flagsRegoSearch.toUpperCase() === r ? "white" : "#64748b",
                    border: `1px solid ${flagsRegoSearch.toUpperCase() === r ? "#2563eb" : "#e2e8f0"}`,
                  }}>{r}</button>
                ))}
              </div>
            )}
          </div>

          {/* Bulk action bar */}
          <BulkActionBar
            visibleIds={visibleFlags.map(f => f._id)}
            openIds={visibleFlags.filter(f => !resolvedFlags[f._id]).map(f => f._id)}
            accent="#f59e0b"
          />

          {/* Flag list */}
          {visibleFlags.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: flagsFilter === "open" ? "#15803d" : "#94a3b8" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>{flagsFilter === "open" ? "\u2713" : regoQ ? "\uD83D\uDD0D" : "\uD83D\uDCCB"}</div>
              <div style={{ fontWeight: 600 }}>
                {regoQ ? `No issues found for "${flagsRegoSearch}"` : flagsFilter === "open" ? "All clear! No open issues." : flagsFilter === "resolved" ? "No resolved issues yet." : "No issues found."}
              </div>
              {regoQ && <button onClick={() => setFlagsRegoSearch("")} style={{ marginTop: 8, padding: "4px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0", cursor: "pointer", fontFamily: "inherit" }}>Clear search</button>}
            </div>
          ) : (
            groups.map(g => (
              <div key={g.title} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: g.color, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <span>{g.icon}</span> {g.title} <span style={{ fontWeight: 400, color: "#94a3b8" }}>({g.flags.length})</span>
                </div>
                {g.flags.map(f => <FlagItem key={f._id} f={f} />)}
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  // ── AI Flags Modal ──────────────────────────────────────────────────────
  const renderAiFlagsModal = () => {
    if (!showAiFlags) return null;
    const fleet = fleetAnalysis;
    const allAiFlags = fleet.flatMap(v => v.flags.filter(f => f.category === "ai" && (f.type === "danger" || f.type === "warn")));
    const flagsWithId = allAiFlags.map(f => ({ ...f, _id: flagId(f) }));
    const openFlags = flagsWithId.filter(f => !resolvedFlags[f._id]);
    const doneFlags = flagsWithId.filter(f => resolvedFlags[f._id]);
    const visibleFlags = aiFlagsFilter === "open" ? openFlags : aiFlagsFilter === "resolved" ? doneFlags : flagsWithId;

    return (
      <div style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex",
        alignItems: "flex-start", justifyContent: "center", zIndex: 100, padding: "40px 16px",
        overflowY: "auto",
      }} onClick={() => { setShowAiFlags(false); setSelectedFlagIds(new Set()); }}>
        <div onClick={e => e.stopPropagation()} style={{
          background: "white", borderRadius: 14, padding: 24, width: "100%", maxWidth: 640,
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)", maxHeight: "85vh", overflowY: "auto",
        }} className="fade-in">
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#7c3aed" }}>{"\uD83E\uDD16"} AI Scan Issues</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                {openFlags.length} to review {"\u00B7"} {doneFlags.length} resolved
              </div>
            </div>
            <button onClick={() => { setShowAiFlags(false); setSelectedFlagIds(new Set()); }} style={{
              background: "none", border: "none", fontSize: 24, color: "#94a3b8", cursor: "pointer", lineHeight: 1,
            }}>{"\u00D7"}</button>
          </div>

          {/* Progress bar */}
          {flagsWithId.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b", marginBottom: 4 }}>
                <span>{doneFlags.length} of {flagsWithId.length} reviewed</span>
                <span style={{ fontWeight: 600, color: doneFlags.length === flagsWithId.length ? "#15803d" : "#7c3aed" }}>
                  {flagsWithId.length > 0 ? Math.round((doneFlags.length / flagsWithId.length) * 100) : 0}%
                </span>
              </div>
              <div style={{ height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 3, transition: "width 0.3s",
                  width: `${flagsWithId.length > 0 ? (doneFlags.length / flagsWithId.length) * 100 : 0}%`,
                  background: doneFlags.length === flagsWithId.length ? "#16a34a" : "#7c3aed",
                }} />
              </div>
            </div>
          )}

          {/* Filter tabs */}
          <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
            {[
              { key: "open", label: `To Review (${openFlags.length})` },
              { key: "resolved", label: `Resolved (${doneFlags.length})` },
              { key: "all", label: `All (${flagsWithId.length})` },
            ].map(tab => (
              <button key={tab.key} onClick={() => setAiFlagsFilter(tab.key)} style={{
                padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: aiFlagsFilter === tab.key ? 700 : 500,
                cursor: "pointer", fontFamily: "inherit",
                background: aiFlagsFilter === tab.key ? "#7c3aed" : "#f8fafc",
                color: aiFlagsFilter === tab.key ? "white" : "#64748b",
                border: `1px solid ${aiFlagsFilter === tab.key ? "#7c3aed" : "#e2e8f0"}`,
              }}>{tab.label}</button>
            ))}
          </div>

          {/* Bulk action bar */}
          <BulkActionBar
            visibleIds={visibleFlags.map(f => f._id)}
            openIds={visibleFlags.filter(f => !resolvedFlags[f._id]).map(f => f._id)}
            accent="#7c3aed"
          />

          {/* Flag list */}
          {visibleFlags.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: aiFlagsFilter === "open" ? "#15803d" : "#94a3b8" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>{aiFlagsFilter === "open" ? "\u2713" : "\uD83E\uDD16"}</div>
              <div style={{ fontWeight: 600 }}>
                {aiFlagsFilter === "open" ? "All AI flags reviewed!" : aiFlagsFilter === "resolved" ? "No resolved flags yet." : "No AI flags found."}
              </div>
            </div>
          ) : (
            visibleFlags.map(f => {
              const isResolved = !!resolvedFlags[f._id];
              const resolution = resolvedFlags[f._id];
              return (
                <div key={f._id} style={{
                  padding: "10px 12px", marginBottom: 8, borderRadius: 8,
                  background: isResolved ? "#f8fafc" : f.type === "danger" ? "#faf5ff" : "#fffbeb",
                  border: `1px solid ${isResolved ? "#e2e8f0" : f.type === "danger" ? "#c4b5fd" : "#fcd34d"}`,
                  opacity: isResolved ? 0.7 : 1,
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <BulkSelectBox id={f._id} disabled={isResolved} accent="#7c3aed" />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, color: "#0f172a", fontSize: 12 }}>{f.rego}</span>
                        <span style={{
                          fontWeight: 600, fontSize: 11, color: isResolved ? "#64748b" : "#7c3aed",
                          textDecoration: isResolved ? "line-through" : "none",
                        }}>{f.text}</span>
                        <span style={{ color: "#94a3b8", fontSize: 10 }}>{f.date || ""}</span>
                      </div>
                      <div style={{ color: "#64748b", fontSize: 10, marginTop: 2 }}>{f.detail}</div>
                      {isResolved && resolution && (
                        <div style={{ marginTop: 6, padding: "4px 8px", background: "#f0fdf4", borderRadius: 4, border: "1px solid #bbf7d0", fontSize: 10 }}>
                          <span style={{ color: "#15803d", fontWeight: 600 }}>{"\u2713"} Reviewed by {resolution.by}</span>
                          {resolution.note && <div style={{ color: "#374151", marginTop: 2 }}>{resolution.note}</div>}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      {f._entry?.hasReceipt && (
                        <button onClick={() => setExpandedReceipt(expandedReceipt === f._id ? null : f._id)} style={{
                          padding: "4px 10px", borderRadius: 5, fontSize: 10, fontWeight: 600,
                          background: expandedReceipt === f._id ? "#7c3aed" : "#faf5ff",
                          color: expandedReceipt === f._id ? "white" : "#7c3aed",
                          border: `1px solid ${expandedReceipt === f._id ? "#7c3aed" : "#c4b5fd"}`,
                          cursor: "pointer", fontFamily: "inherit",
                        }}>{"\uD83D\uDCC4"} {expandedReceipt === f._id ? "Hide" : "Receipt"}</button>
                      )}
                      {!isResolved && f._entry && (
                        <button onClick={() => { setEditingEntry(f._entry); setShowAiFlags(false); }} style={{
                          padding: "4px 10px", borderRadius: 5, fontSize: 10, fontWeight: 600,
                          background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe",
                          cursor: "pointer", fontFamily: "inherit",
                        }}>{"\u270E"} Edit</button>
                      )}
                      {!isResolved && (
                        <button onClick={() => resolveFlag(f._id, "Reviewed — no action needed", "Admin")} style={{
                          padding: "4px 10px", borderRadius: 5, fontSize: 10, fontWeight: 600,
                          background: "#f0fdf4", color: "#15803d", border: "1px solid #86efac",
                          cursor: "pointer", fontFamily: "inherit",
                        }}>{"\u2713"} OK</button>
                      )}
                      {isResolved && (
                        <button onClick={() => unresolveFlag(f._id)} style={{
                          padding: "4px 10px", borderRadius: 5, fontSize: 10, fontWeight: 600,
                          background: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0",
                          cursor: "pointer", fontFamily: "inherit",
                        }}>Undo</button>
                      )}
                    </div>
                  </div>
                  {expandedReceipt === f._id && f._entry?.hasReceipt && (
                    <InlineReceipt entryId={f._entry.id} loadFn={loadReceiptImage} />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  // ── Driver Database ────────────────────────────────────────────────────
  const renderDrivers = () => {
    // Build driver profiles from entries — merge near-matches (case, 1-2 letter typos)
    const driverMap = {};
    const driverKeys = []; // track all canonical keys for fuzzy lookup
    const findMatchingKey = (nameKey) => {
      // Exact match first
      if (driverMap[nameKey]) return nameKey;
      // Fuzzy match: edit distance <= 2 on lowercase names
      // Only fuzzy match names with 5+ characters to avoid merging short unrelated names (e.g. "Ben" & "Dan")
      if (nameKey.length < 5) return null;
      for (const existing of driverKeys) {
        if (existing.length < 5) continue;
        if (Math.abs(existing.length - nameKey.length) > 2) continue; // quick length check
        if (editDistance(nameKey, existing) <= 2) return existing;
      }
      return null;
    };
    for (const e of entries) {
      const rawName = e.driverName || e.driver || "";
      if (!rawName) continue;
      const name = normalizeDriverName(rawName);
      const nameKey = name.trim().toLowerCase();
      const matchedKey = findMatchingKey(nameKey);
      const key = matchedKey || nameKey;
      if (!driverMap[key]) {
        driverMap[key] = { name: name.trim(), entries: [], vehicles: new Set(), divisions: new Set(), totalLitres: 0, totalCost: 0, lastEntry: null, nameVariants: {} };
        driverKeys.push(key);
      }
      const d = driverMap[key];
      // Track name variants to pick the most common spelling
      const trimmed = name.trim();
      d.nameVariants[trimmed] = (d.nameVariants[trimmed] || 0) + 1;
      d.entries.push(e);
      if (e.registration) d.vehicles.add(e.registration);
      if (e.division) d.divisions.add(e.division);
      d.totalLitres += parseFloat(e.litres) || 0;
      d.totalCost += parseFloat(e.totalCost) || 0;
      const eTs = parseDate(e.date);
      const lastTs = d.lastEntry ? parseDate(d.lastEntry.date) : 0;
      if (!d.lastEntry || (eTs && eTs > (lastTs || 0))) d.lastEntry = e;
    }
    // Set display name to most common variant
    for (const d of Object.values(driverMap)) {
      const best = Object.entries(d.nameVariants).sort((a, b) => b[1] - a[1])[0];
      if (best) d.name = best[0];
    }

    // Sort by name
    const allDrivers = Object.values(driverMap).sort((a, b) => a.name.localeCompare(b.name));
    // Partition into active (shown in main list, summary stats, activity)
    // and deleted (routed to the collapsible archive at the bottom).
    let driverList = allDrivers.filter(d => !isDeletedDriverName(d.name));
    const deletedDriverList = allDrivers.filter(d => isDeletedDriverName(d.name));

    // Filter by search — active list only. The archive has its own list and
    // is small enough not to need search filtering.
    if (driverSearch.trim()) {
      const q = driverSearch.trim().toLowerCase();
      driverList = driverList.filter(d =>
        d.name.toLowerCase().includes(q) ||
        [...d.vehicles].some(v => v.toLowerCase().includes(q))
      );
    }

    return (
      <div className="fade-in">
        <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>Driver Database</div>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
          {driverList.length} driver{driverList.length !== 1 ? "s" : ""} found {"\u00B7"} Search by name or rego
        </div>

        {/* Search */}
        <input value={driverSearch} onChange={e => setDriverSearch(e.target.value)} placeholder="Search drivers by name or vehicle rego..."
          style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, outline: "none", fontFamily: "inherit", color: "#0f172a", marginBottom: 16 }}
          onFocus={e => e.target.style.borderColor = "#22c55e"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />

        {/* Driver Activity */}
        {(() => {
          const now = new Date();
          const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
          // Skip deleted drivers — the activity card is about who's
          // currently working, not who's been archived. Deleted drivers
          // get their own collapsible section below the list.
          const activeDriverObjs = Object.values(driverMap).filter(d => !isDeletedDriverName(d.name));
          const allDriverNames = activeDriverObjs.map(d => d.name).sort();
          const activeDrivers = new Set();
          activeDriverObjs.forEach(d => {
            d.entries.forEach(e => {
              if (!e.date) return;
              const dt = parseDate(e.date);
              if (dt && new Date(dt) >= weekAgo) activeDrivers.add(d.name);
            });
          });
          const inactiveDrivers = allDriverNames.filter(d => !activeDrivers.has(d));
          const driverLastEntry = {};
          activeDriverObjs.forEach(drv => {
            if (!drv.lastEntry) return;
            const ts = parseDate(drv.lastEntry.date);
            if (!ts) return;
            driverLastEntry[drv.name] = { dt: new Date(ts), date: drv.lastEntry.date, rego: drv.lastEntry.registration || drv.lastEntry.equipment || "" };
          });
          if (allDriverNames.length === 0) return null;
          return (
            <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", letterSpacing: "0.04em", textTransform: "uppercase" }}>{"\uD83D\uDC64"} Driver Activity (last 7 days)</div>
                <div style={{ display: "flex", gap: 8, fontSize: 11 }}>
                  <span style={{ color: "#15803d", fontWeight: 600 }}>{activeDrivers.size} active</span>
                  {inactiveDrivers.length > 0 && <span style={{ color: "#dc2626", fontWeight: 600 }}>{inactiveDrivers.length} inactive</span>}
                </div>
              </div>
              {activeDrivers.size > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: inactiveDrivers.length > 0 ? 10 : 0 }}>
                  {[...activeDrivers].sort().map(d => {
                    const info = driverLastEntry[d];
                    return (
                      <div key={d} title={info ? `Last: ${info.date} \u00B7 ${info.rego}` : ""} style={{
                        padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 500,
                        background: "#f0fdf4", color: "#15803d", border: "1px solid #86efac",
                        cursor: "pointer",
                      }} onClick={() => { setDriverSearch(d); setExpandedDriver(d.toLowerCase()); }}>{"\u2713"} {d}</div>
                    );
                  })}
                </div>
              )}
              {inactiveDrivers.length > 0 && (
                <>
                  <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>No entries this week</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {inactiveDrivers.map(d => {
                      const info = driverLastEntry[d];
                      const daysSince = info ? Math.round((now - info.dt) / 86400000) : null;
                      return (
                        <div key={d} title={info ? `Last: ${info.date} \u00B7 ${info.rego}` : "No entries recorded"} style={{
                          padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 500,
                          background: daysSince && daysSince > 30 ? "#fef2f2" : "#f8fafc",
                          color: daysSince && daysSince > 30 ? "#dc2626" : "#64748b",
                          border: `1px solid ${daysSince && daysSince > 30 ? "#fca5a5" : "#e2e8f0"}`,
                          cursor: "pointer",
                        }} onClick={() => { setDriverSearch(d); setExpandedDriver(d.toLowerCase()); }}>
                          {d}
                          {daysSince != null && <span style={{ marginLeft: 4, fontSize: 9, color: "#94a3b8" }}>{daysSince}d ago</span>}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {/* Summary stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
          {[
            ["Total Drivers", driverList.length, "#1e40af", "#eff6ff"],
            ["Total Entries", driverList.reduce((s, d) => s + d.entries.length, 0), "#15803d", "#f0fdf4"],
            ["Total Spend", `$${driverList.reduce((s, d) => s + d.totalCost, 0).toFixed(2)}`, "#b45309", "#fffbeb"],
          ].map(([label, val, color, bg]) => (
            <div key={label} style={{ background: bg, borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 10, fontWeight: 600, color, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginTop: 2 }}>{val}</div>
            </div>
          ))}
        </div>

        {/* Driver list */}
        {driverList.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>
            {driverSearch ? "No drivers match your search" : "No entries recorded yet"}
          </div>
        )}

        {driverList.map(driver => {
          const isExpanded = expandedDriver === driver.name.toLowerCase();
          const lastE = driver.lastEntry;
          const sortedEntries = [...driver.entries].sort((a, b) => (parseDate(b.date) || 0) - (parseDate(a.date) || 0));

          return (
            <div key={driver.name} style={{ marginBottom: 8 }}>
              {/* Driver header — split into a clickable expand region (left)
                  and an admin-only delete button (right). Wrapping the whole
                  row in a single <button> previously made it impossible to
                  nest a delete button without HTML validity errors. */}
              <div style={{
                width: "100%", display: "flex", alignItems: "stretch",
                borderRadius: 10, border: "1px solid #e2e8f0",
                background: isExpanded ? "#f0fdf4" : "white",
                transition: "all 0.15s", overflow: "hidden",
              }}>
                <button
                  onClick={() => setExpandedDriver(isExpanded ? null : driver.name.toLowerCase())}
                  style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "12px 14px", border: "none", background: "transparent",
                    cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                  }}
                >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%", background: "#16a34a", color: "white",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, fontWeight: 700,
                  }}>
                    {driver.name.split(" ").map(n => n[0] || "").join("").toUpperCase().slice(0, 2)}
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{driver.name}</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>
                      {driver.entries.length} entr{driver.entries.length !== 1 ? "ies" : "y"} {"\u00B7"} {[...driver.divisions].join(", ")} {"\u00B7"} {[...driver.vehicles].size} vehicle{driver.vehicles.size !== 1 ? "s" : ""}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>${driver.totalCost.toFixed(2)}</div>
                  <div style={{ fontSize: 10, color: "#94a3b8" }}>
                    Last: {lastE?.date || "—"}
                  </div>
                </div>
                </button>
                {isAdmin && (
                  <button
                    onClick={(ev) => { ev.stopPropagation(); deleteDriver(driver); }}
                    title={`Delete driver "${driver.name}" · entries kept under *DELETED_${driver.name}*`}
                    style={{
                      padding: "0 14px", border: "none",
                      borderLeft: "1px solid #e2e8f0",
                      background: "transparent", color: "#cbd5e1",
                      cursor: "pointer", fontSize: 16, fontFamily: "inherit",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={ev => { ev.currentTarget.style.background = "#fef2f2"; ev.currentTarget.style.color = "#dc2626"; }}
                    onMouseLeave={ev => { ev.currentTarget.style.background = "transparent"; ev.currentTarget.style.color = "#cbd5e1"; }}
                  >{"🗑"}</button>
                )}
              </div>

              {/* Expanded driver details */}
              {isExpanded && (
                <div className="fade-in" style={{
                  border: "1px solid #e2e8f0", borderTop: "none", borderRadius: "0 0 10px 10px",
                  padding: "12px 14px", background: "#f8fafc",
                }}>
                  {/* Merged names notice */}
                  {Object.keys(driver.nameVariants).length > 1 && (
                    <div style={{
                      background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 6,
                      padding: "6px 10px", marginBottom: 10, fontSize: 10, color: "#1e40af",
                    }}>
                      <strong>Merged spellings:</strong>{" "}
                      {Object.entries(driver.nameVariants).map(([v, count]) => `"${v}" (${count}×)`).join(", ")}
                    </div>
                  )}

                  {/* Driver summary */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                    {[
                      ["Total Litres", `${driver.totalLitres.toFixed(1)}L`],
                      ["Total Cost", `$${driver.totalCost.toFixed(2)}`],
                      ["Vehicles", [...driver.vehicles].join(", ") || "—"],
                      ["Division", [...driver.divisions].join(", ") || "—"],
                    ].map(([label, val]) => (
                      <div key={label} style={{ background: "white", borderRadius: 6, padding: "6px 8px", border: "1px solid #e2e8f0" }}>
                        <div style={{ fontSize: 9, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", marginTop: 1, wordBreak: "break-all" }}>{val}</div>
                      </div>
                    ))}
                  </div>

                  {/* Last entry highlight */}
                  {lastE && (
                    <div style={{
                      background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 8,
                      padding: "8px 12px", marginBottom: 10,
                    }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#1e40af", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>Latest Entry</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, fontSize: 11 }}>
                        <div><span style={{ color: "#64748b" }}>Date:</span> <strong>{lastE.date || "—"}</strong></div>
                        <div><span style={{ color: "#64748b" }}>Rego:</span> <strong>{lastE.registration || lastE.equipment || "—"}</strong></div>
                        <div><span style={{ color: "#64748b" }}>Litres:</span> <strong>{lastE.litres || "—"}</strong></div>
                        <div><span style={{ color: "#64748b" }}>Cost:</span> <strong>${parseFloat(lastE.totalCost || 0).toFixed(2)}</strong></div>
                      </div>
                      {lastE.station && <div style={{ fontSize: 10, color: "#64748b", marginTop: 3 }}>Station: {lastE.station}</div>}
                    </div>
                  )}

                  {/* Entry history table */}
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Entry History</div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                      <thead>
                        <tr style={{ background: "#e2e8f0" }}>
                          {["Date", "Vehicle/Item", "Station", "Litres", "$/L", "Cost", "Odo", ...(isAdmin ? [""] : [])].map(h => (
                            <th key={h || "_actions"} style={{ padding: "5px 8px", textAlign: "left", fontWeight: 600, color: "#374151", whiteSpace: "nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sortedEntries.map((e, i) => (
                          <tr key={e.id || i} style={{ background: i % 2 === 0 ? "white" : "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "5px 8px", whiteSpace: "nowrap" }}>{e.date || "—"}</td>
                            <td style={{ padding: "5px 8px", fontWeight: 500 }}>{e.registration || e.equipment || "—"}</td>
                            <td style={{ padding: "5px 8px", color: "#64748b" }}>{e.station || "—"}</td>
                            <td style={{ padding: "5px 8px" }}>{e.litres || "—"}</td>
                            <td style={{ padding: "5px 8px" }}>{e.pricePerLitre ? `$${parseFloat(e.pricePerLitre).toFixed(3)}` : "—"}</td>
                            <td style={{ padding: "5px 8px", fontWeight: 500 }}>{e.totalCost ? `$${parseFloat(e.totalCost).toFixed(2)}` : "—"}</td>
                            <td style={{ padding: "5px 8px", color: "#64748b" }}>{e.odometer || "—"}</td>
                            {isAdmin && (
                              <td style={{ padding: "5px 4px", whiteSpace: "nowrap" }}>
                                {e.hasReceipt && (
                                  <button onClick={() => setViewingReceipt(e.id)} title="View receipt" style={{
                                    background: "none", border: "none", color: "#7c3aed", cursor: "pointer",
                                    fontSize: 13, lineHeight: 1, padding: "2px 4px",
                                  }}>{"\uD83D\uDCC4"}</button>
                                )}
                                <button onClick={() => setEditingEntry(e)} title="Edit entry" style={{
                                  background: "none", border: "none", color: "#2563eb", cursor: "pointer",
                                  fontSize: 13, lineHeight: 1, padding: "2px 4px",
                                }}>{"\u270E"}</button>
                                <button onClick={() => setConfirmAction({
                                  message: `Delete this ${e.registration || e.equipment || ""} entry from ${e.date || "unknown date"}? This will remove it from all sections.`,
                                  onConfirm: async () => { await deleteEntry(e.id); setConfirmAction(null); }
                                })} title="Delete entry" style={{
                                  background: "none", border: "none", color: "#cbd5e1", cursor: "pointer",
                                  fontSize: 15, lineHeight: 1, padding: "2px 4px",
                                }}>{"\u00D7"}</button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* ── Deleted drivers archive ─────────────────────────────────────
            Collapsible section listing every driver that's been removed
            from the active list. Their entries stay in the database
            (so historical totals don't change) but they don't clutter
            the main Drivers tab. Admin-only Restore button per row
            puts a driver back in the active list. */}
        {deletedDriverList.length > 0 && (() => {
          const totalArchivedEntries = deletedDriverList.reduce((s, d) => s + d.entries.length, 0);
          const totalArchivedSpend = deletedDriverList.reduce((s, d) => s + d.totalCost, 0);
          return (
            <div style={{ marginTop: 24, background: "white", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
              <button
                onClick={() => setDeletedDriversExpanded(!deletedDriversExpanded)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 14px", background: deletedDriversExpanded ? "#f8fafc" : "transparent",
                  border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                  borderBottom: deletedDriversExpanded ? "1px solid #f1f5f9" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18 }}>{"🗄"}{"️"}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>Deleted drivers archive</div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>
                      {deletedDriverList.length} driver{deletedDriverList.length !== 1 ? "s" : ""} {"·"} {totalArchivedEntries} entr{totalArchivedEntries !== 1 ? "ies" : "y"} preserved {"·"} ${totalArchivedSpend.toFixed(2)}
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 500, color: "#94a3b8" }}>
                  {deletedDriversExpanded ? "Collapse ▲" : "Expand ▼"}
                </span>
              </button>
              {deletedDriversExpanded && (
                <div style={{ padding: "10px 14px 14px", background: "#f8fafc" }}>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 10, lineHeight: 1.5 }}>
                    These drivers were removed from the active Drivers list. Their fuel entries are kept in the database — historical dashboard totals stay accurate — but the drivers no longer show up alongside the active team. Restore brings a driver back to the active list under their original name.
                  </div>
                  {deletedDriverList.map(d => {
                    const original = originalDriverName(d.name);
                    const lastEDate = d.lastEntry?.date || "—";
                    return (
                      <div key={d.name} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "10px 12px", marginBottom: 6, background: "white",
                        borderRadius: 8, border: "1px solid #e2e8f0",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: "50%", background: "#cbd5e1", color: "white",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 12, fontWeight: 700, flexShrink: 0,
                          }}>
                            {original.split(" ").map(n => n[0] || "").join("").toUpperCase().slice(0, 2)}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>
                              {original}
                              <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 400, marginLeft: 8, fontStyle: "italic" }}>archived</span>
                            </div>
                            <div style={{ fontSize: 11, color: "#94a3b8" }}>
                              {d.entries.length} entr{d.entries.length !== 1 ? "ies" : "y"} {"·"} ${d.totalCost.toFixed(2)} {"·"} {[...d.vehicles].length} vehicle{d.vehicles.size !== 1 ? "s" : ""} {"·"} last: {lastEDate}
                            </div>
                          </div>
                        </div>
                        {isAdmin && (
                          <button
                            onClick={() => restoreDriver(d)}
                            title={`Restore "${original}" to the active Drivers list`}
                            style={{
                              padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                              background: "#f0fdf4", color: "#15803d",
                              border: "1px solid #86efac", cursor: "pointer", fontFamily: "inherit",
                              flexShrink: 0,
                            }}
                          >Restore</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    );
  };

  // ── Fleet Card Row Parser ──────────────────────────────────────────────
  // Works off ROW arrays (not raw CSV text) so the upload handler can feed in
  // Excel-parsed rows that preserve cell types (Date objects, numbers). The
  // previous string-based parser silently broke on Excel serial dates like
  // 46132 — every transaction came back with an unparseable date and every
  // match showed "missing receipt".
  const parseFleetCardRows = (rows) => {
    if (!Array.isArray(rows) || rows.length < 2) return [];
    const rawHeaders = rows[0].map(h => (h == null ? "" : String(h)).trim().toLowerCase());
    const colMap = {};
    rawHeaders.forEach((h, i) => {
      if (/^transaction\s*date$/.test(h)) colMap.date = i;
      else if (/^transaction\s*time$/.test(h)) colMap.time = i;
      else if (/^card\s*no|fleet.*card|^card\s*num/.test(h)) colMap.cardNumber = i;
      else if (/registration|^rego$|vehicle.*reg/.test(h)) colMap.rego = i;
      else if (/^quantity$|^litre|^liter|^volume$/.test(h)) colMap.litres = i;
      else if (/^unit\s*price$|price.*per.*li|^ppl$|^\$.*l$|^rate$/.test(h)) colMap.ppl = i;
      else if (/^total$|^amount$|^total.*cost$/.test(h)) colMap.cost = i;
      else if (/merchant.*site|station|^site$|^location$/.test(h)) colMap.station = i;
      else if (/^odo|odometer|mileage/.test(h)) colMap.odometer = i;
      else if (/^transaction\s*num/.test(h)) colMap.transactionNumber = i;
      else if (/cardholder|^driver$/.test(h)) colMap.driver = i;
      else if (/product|fuel.*type/.test(h)) colMap.product = i;
      else if (!colMap.date && /^date$/.test(h)) colMap.date = i;
    });

    // Convert an Excel date cell to Australian DD/MM/YYYY. Accepts JS Date
    // (what XLSX gives with cellDates:true) or a serial number or any string.
    const toAusDate = (v) => {
      if (v == null || v === "") return "";
      if (v instanceof Date && !isNaN(v.getTime())) {
        return `${String(v.getDate()).padStart(2, "0")}/${String(v.getMonth() + 1).padStart(2, "0")}/${v.getFullYear()}`;
      }
      if (typeof v === "number" && v > 25000 && v < 100000) {
        // Excel serial → JS Date. Excel's epoch is 1899-12-30 (accounting
        // for Excel's leap-year bug), so serial N = (N - 25569) days past
        // Unix epoch.
        const ms = (v - 25569) * 86400 * 1000;
        const d = new Date(ms);
        if (!isNaN(d.getTime())) {
          return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
        }
      }
      // String — may already be DD/MM/YYYY or could be US format from CSV
      return String(v).trim();
    };

    // Convert Excel time cell (fraction of a day) or a Date-with-epoch-offset
    // to HH:MM. Falls through to string form for plain inputs.
    const toTime = (v) => {
      if (v == null || v === "") return null;
      if (v instanceof Date && !isNaN(v.getTime())) {
        return `${String(v.getHours()).padStart(2, "0")}:${String(v.getMinutes()).padStart(2, "0")}`;
      }
      if (typeof v === "number" && v >= 0 && v < 1) {
        const totalMin = Math.round(v * 24 * 60);
        const h = Math.floor(totalMin / 60), m = totalMin % 60;
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      }
      return String(v).trim();
    };

    const txns = [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.every(v => v == null || v === "")) continue; // blank line
      const get = (key) => {
        if (colMap[key] == null) return "";
        const v = row[colMap[key]];
        if (v == null) return "";
        return typeof v === "string" ? v.trim().replace(/^"|"$/g, "") : String(v);
      };
      const rawCost = get("cost").replace(/[$]/g, "");
      const rawPpl = get("ppl").replace(/[$]/g, "");
      const litres = parseFloat(get("litres")) || null;
      const cost = parseFloat(rawCost) || null;
      const ppl = parseFloat(rawPpl) || (litres && cost ? parseFloat((cost / litres).toFixed(4)) : null);
      const rawCard = get("cardNumber").replace(/[\[\]\s]/g, "");
      const rawOdo = get("odometer");
      const odoVal = parseFloat(rawOdo) || null;
      const product = get("product");
      // Surcharge / fee detection — these rows appear in FleetCard Australia
      // exports (e.g. "BP Surcharge") but aren't real fuel transactions. Flag
      // them so reconciliation can skip them while still letting admin see
      // a "filtered N surcharges" summary.
      const isSurcharge = /surcharge|card\s*fee|transaction\s*fee|merchant\s*fee|fleet\s*card\s*fee|eftpos\s*fee|service\s*fee/i.test(product);
      const txn = {
        id: `txn-${Date.now()}-${r}-${Math.random().toString(36).slice(2, 6)}`,
        date: toAusDate(colMap.date != null ? row[colMap.date] : ""),
        time: toTime(colMap.time != null ? row[colMap.time] : null),
        cardNumber: rawCard,
        rego: get("rego").toUpperCase().replace(/[^A-Z0-9]/g, ""),
        litres,
        ppl,
        cost,
        station: get("station"),
        odometer: odoVal && odoVal > 0 && odoVal !== 777 ? odoVal : null,
        driver: get("driver"),
        product,
        transactionNumber: get("transactionNumber") || null,
        isSurcharge,
        importedAt: new Date().toISOString(),
      };
      if (!txn.date && !txn.cardNumber && !txn.rego && !txn.cost) continue;
      txns.push(txn);
    }
    return txns;
  };

  // ── Receipt-level grouping for reconciliation ────────────────────────────
  // Splits on the same receipt reconcile to a SINGLE fleet-card transaction
  // (the FleetCard report only has the receipt-level total, not per-driver
  // allocations). Group entries by splitGroup when present; otherwise fall
  // back to rego+date+card so older entries (created before splitGroup was
  // populated) still merge correctly. The grouping is view-only — nothing
  // in persisted state changes.
  const normalizeCardNum = (s) => (s || "").replace(/[\s\[\]]/g, "");

  // Look up the canonical "fleetcard rego" for a card number by searching the
  // static DRIVER_CARDS and REGO_DB. The `r` field in both DBs is the rego
  // stored with the card by the fleet card provider — i.e. what will appear
  // in the FleetCard Australia CSV export. This is NOT always the rego of
  // the vehicle the driver is actually using (e.g. Carlos Carrillo's card is
  // embossed WIA53F but he drives EIA53F). Returns "" if the card isn't known.
  const lookupFleetCardRego = (cardNumber) => {
    const clean = normalizeCardNum(cardNumber);
    if (!clean || clean.length < 4) return "";
    const dc = DRIVER_CARDS.find(c => normalizeCardNum(c.c) === clean);
    if (dc?.r) return dc.r;
    const rd = REGO_DB.find(e => e.c && normalizeCardNum(e.c) === clean);
    if (rd?.r) return rd.r;
    return "";
  };

  // Derive the fleetcard rego for an entry: prefer what the AI scanned off
  // the card (e.cardRego), fall back to DB lookup by card number, else empty.
  // This is what we match against the CSV's rego column — not the vehicle
  // rego, which can legitimately differ from what's on the card.
  const deriveFleetCardRego = (e) => {
    if (e?.cardRego) return e.cardRego;
    return lookupFleetCardRego(e?.fleetCardNumber);
  };

  const buildReceiptGroupsFromEntries = (entriesList) => {
    const groups = {};
    for (const e of entriesList) {
      const key = e.splitGroup ||
        `fallback|${(e.registration || "").toUpperCase()}|${e.date || ""}|${normalizeCardNum(e.fleetCardNumber)}`;
      if (!groups[key]) {
        groups[key] = {
          key,
          date: e.date || "",
          registration: e.registration || "",        // vehicle rego (what the driver actually drove)
          cardRego: e.cardRego || "",                // raw cardRego field from entry (if AI scanned it)
          fleetCardRego: deriveFleetCardRego(e),     // authoritative rego for matching — cardRego or DB lookup
          fleetCardNumber: e.fleetCardNumber || "",
          driverName: e.driverName || "",
          station: e.station || "",
          totalCost: 0,
          totalLitres: 0,
          entries: [],
        };
      }
      const g = groups[key];
      g.totalCost += e.totalCost || 0;
      g.totalLitres += e.litres || 0;
      g.entries.push(e);
      // Fill first-seen metadata where missing
      if (!g.driverName && e.driverName) g.driverName = e.driverName;
      if (!g.station && e.station) g.station = e.station;
      if (!g.fleetCardNumber && e.fleetCardNumber) g.fleetCardNumber = e.fleetCardNumber;
      if (!g.cardRego && e.cardRego) g.cardRego = e.cardRego;
      if (!g.fleetCardRego) g.fleetCardRego = deriveFleetCardRego(e);
    }
    return Object.values(groups);
  };

  // ── Fleet Card Transaction Matching ───────────────────────────────────────
  // Match a fleet-card transaction to a receipt GROUP. Returns one of:
  //   matched    — card/rego match AND total cost within tolerance
  //   scan_error — card/rego match but cost is off by more than tolerance
  //                (signals the receipt scan likely got the amount wrong)
  //   missing    — no app entry at all for this txn's card/rego on this date
  //                (signals the driver hasn't lodged the receipt yet)
  // Find every plausible receipt group a txn COULD match: same date AND
  // (same card number OR — falling back — same fleet-card rego). Returns
  // the groups unranked; caller decides which to assign.
  const findTxnCandidates = (txn, groups) => {
    if (!txn.date) return [];
    const txnDate = parseDate(txn.date);
    if (!txnDate) return [];
    const cleanTxnCard = normalizeCardNum(txn.cardNumber);
    const cleanTxnRego = (txn.rego || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const sameDay = groups.filter(g => {
      const gTs = parseDate(g.date);
      return gTs && gTs === txnDate;
    });
    if (sameDay.length === 0) return [];
    const cardCandidates = cleanTxnCard
      ? sameDay.filter(g => g.entries.some(e => normalizeCardNum(e.fleetCardNumber) === cleanTxnCard))
      : [];
    if (cardCandidates.length > 0) return cardCandidates;
    // Fallback: fleet-card rego (NOT vehicle rego — Carlos drives EIA53F
    // on a WIA53F card; matching on vehicle rego would misroute).
    if (!cleanTxnRego) return [];
    return sameDay.filter(g => {
      const gFleetRego = (g.fleetCardRego || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      return gFleetRego && gFleetRego === cleanTxnRego;
    });
  };

  // Assign each fleet-card txn to AT MOST ONE receipt group. A receipt
  // group can likewise only belong to one txn. Without this, the same
  // app receipt was showing up twice in the reconciliation when two
  // CSV transactions shared a card+date+rego — each txn independently
  // picked its best candidate, and the smaller-cost side "duplicated"
  // the receipt row on screen.
  //
  // Algorithm: enumerate every plausible (txn, group) pair with its
  // cost diff, sort smallest-diff first, then greedily claim pairs
  // where neither side is already claimed. This guarantees the tightest
  // cost matches win — a near-exact $100.01 pair beats a sloppy $105
  // pair for the same group, even when the $105 txn was processed first.
  // Pairs without a comparable cost sort last (Infinity) and only claim
  // a group if no costed pair already took it.
  const assignTxnsToGroups = (txns, groups) => {
    const pairs = [];
    for (const txn of txns) {
      const cands = findTxnCandidates(txn, groups);
      for (const g of cands) {
        const diff = (txn.cost != null && g.totalCost > 0)
          ? Math.abs(txn.cost - g.totalCost)
          : Infinity;
        pairs.push({ txn, group: g, diff });
      }
    }
    pairs.sort((a, b) => a.diff - b.diff);

    const assignments = new Map();   // txn.id -> { group, diff }
    const claimedGroups = new Set(); // group.key
    for (const p of pairs) {
      if (assignments.has(p.txn.id)) continue;
      if (claimedGroups.has(p.group.key)) continue;
      assignments.set(p.txn.id, { group: p.group, diff: p.diff === Infinity ? null : p.diff });
      claimedGroups.add(p.group.key);
    }
    return { assignments, claimedGroups };
  };

  // Resolve a (txn, group, diff) assignment into the status the UI uses.
  // Tolerance: $2 AND 5% must BOTH be exceeded to flag as scan_error —
  // mirrors the previous behaviour so match counts stay stable.
  const statusForAssignment = (txn, group, diff) => {
    if (!group) return { status: "missing", group: null, diff: null };
    if (diff == null) return { status: "matched", group, diff: null }; // no cost to compare
    if (group.totalCost > 0) {
      const pct = (diff / group.totalCost) * 100;
      if (diff > 2 && pct > 5) return { status: "scan_error", group, diff };
    }
    return { status: "matched", group, diff };
  };

  // ── Reconciliation View ───────────────────────────────────────────────────
  const renderReconciliation = () => {
    const handleCSVUpload = async (file) => {
      if (!file) return;
      setReconUploading(true);
      try {
        let rows;
        if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
          const buf = await file.arrayBuffer();
          // cellDates:true → date/time cells come back as JS Date objects
          // instead of raw Excel serial numbers (46132). raw:true preserves
          // number types for cost/litres columns.
          const wb = XLSX.read(buf, { type: "array", cellDates: true });
          const ws = wb.Sheets[wb.SheetNames[0]];
          rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true });
        } else {
          // CSV fallback — tokenize into rows with basic quote handling.
          const text = await file.text();
          const lines = text.split(/\r?\n/).filter(l => l.trim());
          rows = lines.map(line => {
            const row = [];
            let cur = "", inQ = false;
            for (const ch of line) {
              if (ch === '"') inQ = !inQ;
              else if (ch === ',' && !inQ) { row.push(cur); cur = ""; }
              else cur += ch;
            }
            row.push(cur);
            return row.map(s => s.trim());
          });
        }
        const newTxns = parseFleetCardRows(rows);
        if (newTxns.length === 0) {
          showToast("No transactions found in file. Check column headers.", "warn");
          setReconUploading(false);
          return;
        }
        // Merge with existing (avoid duplicates by date+card+cost)
        const existing = [...fleetCardTxns];
        let added = 0;
        for (const t of newTxns) {
          const dup = existing.find(ex =>
            (t.transactionNumber && ex.transactionNumber && t.transactionNumber === ex.transactionNumber && t.product === ex.product) ||
            (ex.date === t.date && ex.cardNumber === t.cardNumber && ex.cost === t.cost && ex.rego === t.rego && ex.product === t.product)
          );
          if (!dup) { existing.push(t); added++; }
        }
        setFleetCardTxns(existing);
        await db.saveFleetCardTransactions(existing);

        // ── Auto-reconcile shortcut for managers who never lodge receipts ──
        // For each newly-imported txn whose card / rego matches an entry in
        // AUTO_RECONCILE_DRIVERS, synthesise a matching app entry so the
        // reconciliation pairs them automatically. Only runs on FRESH txns
        // (added=true, dup=false) so re-importing the same CSV doesn't
        // double-create. Also skipped for surcharges and for txns that
        // already have a real app entry (driver lodged a receipt manually).
        const autoEntries = [];
        const now = new Date().toISOString();
        const newTxnIds = new Set();
        for (const t of newTxns) {
          if (t.isSurcharge) continue;
          // Only act on the txns we actually added (the dup check above
          // skipped re-imports). Re-derive added-ness by id since `added`
          // is just a count.
          if (!existing.find(ex => ex.id === t.id)) continue;
          if (newTxnIds.has(t.id)) continue;
          newTxnIds.add(t.id);
          const auto = findAutoReconcileDriver(t.cardNumber, t.rego);
          if (!auto) continue;
          // Skip if there's already an app entry that the matcher would
          // pair with this txn (rego + same date + cost within tolerance).
          // Avoids over-writing a real receipt the driver did happen to
          // lodge, or stomping on entries created on a previous import.
          const txnDate = parseDate(t.date);
          const tolerance = Math.max(2, Math.abs(t.cost || 0) * 0.05);
          const alreadyCovered = entriesRef.current.some(e => {
            if (parseDate(e.date) !== txnDate) return false;
            const eCard = (e.fleetCardNumber || "").replace(/[\s\[\]]/g, "");
            const eRego = (e.cardRego || e.registration || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
            const cardMatch = eCard && eCard === auto.card;
            const regoMatch = eRego && eRego === auto.rego;
            if (!cardMatch && !regoMatch) return false;
            // Cost-aware: if the existing entry's totalCost is within
            // tolerance of the txn cost, treat it as "already covered".
            // If the existing entry has no cost, also consider it a
            // match — assume the admin will fix that one up manually.
            if (e.totalCost == null) return true;
            return Math.abs((e.totalCost || 0) - (t.cost || 0)) <= tolerance;
          });
          if (alreadyCovered) continue;
          autoEntries.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            submittedAt: now,
            driverName: auto.driver,
            registration: auto.rego,
            division: auto.division,
            vehicleType: auto.vehicleType,
            date: t.date,
            litres: t.litres,
            pricePerLitre: t.ppl,
            totalCost: t.cost,
            station: t.station,
            fuelType: auto.fuelType,
            fleetCardNumber: auto.card,
            cardRego: auto.rego,
            fleetCardVehicle: auto.rego,
            fleetCardDriver: auto.driver,
            odometer: t.odometer || null,
            hasReceipt: false,
            // Tracing fields so admin can spot auto-created entries on the
            // Data tab and tell which CSV import produced them.
            _autoCreated: true,
            _autoCreatedFrom: "fleetcard_csv",
            _autoCreatedFromTxn: t.id,
            _autoCreatedAt: now,
          });
        }
        if (autoEntries.length > 0) {
          const merged = [...entriesRef.current, ...autoEntries];
          await persist(merged);
          // persist() only cloud-saves a single changedEntry, so loop the
          // rest manually with the same pending-saves protection used
          // elsewhere — otherwise a refresh between persist and cloud
          // sync would wipe the new rows.
          for (const e of autoEntries) {
            pendingEntrySavesRef.current.add(e.id);
            db.saveEntry(e).catch(() => {}).finally(() => {
              pendingEntrySavesRef.current.delete(e.id);
            });
          }
        }
        const autoMsg = autoEntries.length > 0
          ? ` · auto-created ${autoEntries.length} app entr${autoEntries.length === 1 ? "y" : "ies"} for ${[...new Set(autoEntries.map(e => e.driverName))].join(", ")}`
          : "";
        showToast(`Imported ${added} new transaction${added !== 1 ? "s" : ""} (${newTxns.length - added} duplicates skipped)${autoMsg}`);
      } catch (err) {
        showToast("Failed to parse file: " + err.message, "warn");
      }
      setReconUploading(false);
    };

    // Convert YYYY-MM-DD to epoch ms (start-of-day UTC) so both txn.date
    // (DD/MM/YYYY via parseDate) and the range bounds can be compared uniformly.
    const rangeDateToTs = (isoDate) => {
      if (!isoDate) return null;
      const [y, m, d] = isoDate.split("-").map(Number);
      if (!y || !m || !d) return null;
      return Date.UTC(y, m - 1, d);
    };
    const fromTs = rangeDateToTs(reconFromDate);
    const toTs = rangeDateToTs(reconToDate);
    const inRange = (dateStr) => {
      const ts = parseDate(dateStr);
      if (!ts) return false;
      if (fromTs != null && ts < fromTs) return false;
      if (toTs != null && ts > toTs) return false;
      return true;
    };

    // Filter imported transactions to the selected range. Keep surcharges
    // separate so we can show the admin how many were auto-hidden.
    const inRangeTxns = fleetCardTxns.filter(t => inRange(t.date));
    const surchargeTxns = inRangeTxns.filter(t => t.isSurcharge);
    const fuelTxns = inRangeTxns.filter(t => !t.isSurcharge);

    // Filter app entries to the same range, then group splits back into
    // their receipts so each reconciles as a single unit.
    const inRangeEntries = entries.filter(e => inRange(e.date));
    const receiptGroups = buildReceiptGroupsFromEntries(inRangeEntries);

    // Globally assign txns to receipt groups so no group is claimed twice
    // (see assignTxnsToGroups for the algorithm). Each txn then resolves
    // to matched / scan_error / missing based on its assigned group's
    // cost diff.
    const { assignments, claimedGroups } = assignTxnsToGroups(fuelTxns, receiptGroups);
    const results = fuelTxns.map(txn => {
      const a = assignments.get(txn.id);
      return { txn, ...statusForAssignment(txn, a?.group || null, a?.diff ?? null) };
    });

    const matched = results.filter(r => r.status === "matched");
    const scanErrors = results.filter(r => r.status === "scan_error");
    const missing = results.filter(r => r.status === "missing");

    // Receipt groups in range with no matching transaction — "app only".
    // Usually rare (would mean: driver lodged a receipt but no fleet-card
    // transaction was found). Could be a manual/cash entry, a wrong card
    // number, or the FleetCard report hasn't been re-downloaded yet.
    const appOnlyGroups = receiptGroups.filter(g => !claimedGroups.has(g.key));

    // Filter
    const filtered = reconFilter === "all" ? results
      : reconFilter === "matched" ? matched
      : reconFilter === "scan_error" ? scanErrors
      : reconFilter === "missing" ? missing
      : reconFilter === "app_only" ? [] // handled separately below
      : results;

    // Search (matches either side)
    const searchTerm = reconSearch.trim().toUpperCase();
    const matchesSearch = (r) => {
      if (!searchTerm) return true;
      return (
        (r.txn.rego || "").includes(searchTerm) ||
        (r.txn.cardNumber || "").includes(searchTerm) ||
        (r.txn.driver || "").toUpperCase().includes(searchTerm) ||
        (r.txn.station || "").toUpperCase().includes(searchTerm) ||
        (r.group?.fleetCardRego || "").toUpperCase().includes(searchTerm) ||
        (r.group?.registration || "").toUpperCase().includes(searchTerm) ||
        (r.group?.driverName || "").toUpperCase().includes(searchTerm)
      );
    };
    const searched = filtered.filter(matchesSearch);
    const searchedAppOnly = (reconFilter === "all" || reconFilter === "app_only")
      ? appOnlyGroups.filter(g => {
          if (!searchTerm) return true;
          return (g.fleetCardRego || "").toUpperCase().includes(searchTerm) ||
                 (g.registration || "").toUpperCase().includes(searchTerm) ||
                 (g.driverName || "").toUpperCase().includes(searchTerm) ||
                 normalizeCardNum(g.fleetCardNumber).includes(searchTerm);
        })
      : [];

    // Row-level background tint per status (light tint so cells stay legible)
    const statusStyle = {
      matched:    { bg: "#f0fdf4", bgAlt: "#fafffc", border: "#86efac", text: "#15803d", label: "\u2713",  title: "Matched" },
      scan_error: { bg: "#fffbeb", bgAlt: "#fffcf2", border: "#fcd34d", text: "#b45309", label: "\u26A0",  title: "Scan error" },
      missing:    { bg: "#fef2f2", bgAlt: "#fff7f7", border: "#fca5a5", text: "#dc2626", label: "\u2717",  title: "Missing receipt" },
      app_only:   { bg: "#eff6ff", bgAlt: "#f7fafe", border: "#93c5fd", text: "#1d4ed8", label: "\u24D8",  title: "App only" },
    };

    // ── Cell edit commits ────────────────────────────────────────────────
    // Fleet-card side: mutate the txn object in the fleetCardTxns array and
    // persist the whole array (Supabase stores the bundle as one JSON blob).
    const saveTxnEdit = async (txnId, field, rawValue) => {
      const next = fleetCardTxns.map(t => {
        if (t.id !== txnId) return t;
        let v = rawValue;
        if (field === "cost" || field === "ppl" || field === "litres") {
          const parsed = parseFloat(String(rawValue).replace(/[$]/g, ""));
          v = Number.isFinite(parsed) ? parsed : null;
        } else if (field === "rego") {
          v = String(rawValue).toUpperCase().replace(/[^A-Z0-9]/g, "");
        } else if (typeof rawValue === "string") {
          v = rawValue.trim();
        }
        return { ...t, [field]: v };
      });
      setFleetCardTxns(next);
      try { await db.saveFleetCardTransactions(next); } catch (_) {}
    };
    const deleteTxn = async (txnId) => {
      const next = fleetCardTxns.filter(t => t.id !== txnId);
      setFleetCardTxns(next);
      try { await db.saveFleetCardTransactions(next); } catch (_) {}
    };

    // App side: delegate to updateEntry, which handles persist + cloud sync +
    // odometer re-sort. Safe because the reconciliation view only edits a
    // single entry at a time (single-entry groups). For multi-entry groups
    // we show the totals read-only and expose an "Edit splits" affordance.
    const saveEntryEdit = (entryId, field, rawValue) => {
      const entry = entriesRef.current.find(e => e.id === entryId);
      if (!entry) return;
      let v = rawValue;
      if (["totalCost", "pricePerLitre", "litres", "odometer"].includes(field)) {
        const parsed = parseFloat(String(rawValue).replace(/[$]/g, ""));
        v = Number.isFinite(parsed) ? parsed : null;
      } else if (field === "registration") {
        v = String(rawValue).toUpperCase().replace(/[^A-Z0-9]/g, "");
      } else if (typeof rawValue === "string") {
        v = rawValue.trim();
      }
      if (entry[field] === v) return; // no-op
      updateEntry({ ...entry, [field]: v });
    };

    // ── Build aligned rows ──────────────────────────────────────────────
    // One row per receipt group — even when the receipt was split across
    // multiple vehicles / AdBlue / etc. The underlying entries stay intact
    // on the Data tab (so per-vehicle dashboards are unaffected); we just
    // collapse them here so the reconciliation compares whole-receipt
    // totals against whole-transaction totals. Matching already uses
    // `g.totalCost` (sum of splits) so no logic change is needed above.
    const alignedRows = [];
    const pushResultRows = (r) => {
      const entries = r.group?.entries || [];
      alignedRows.push({
        txn: r.txn,
        group: r.group,
        entry: entries[0] || null, // primary — used only when splitTotal === 1
        entries,                   // full split list for aggregate display
        splitIdx: 0,
        splitTotal: entries.length || 1,
        status: r.status,
        diff: r.diff,
      });
    };
    for (const r of results) pushResultRows(r);
    for (const g of appOnlyGroups) pushResultRows({ txn: null, group: g, status: "app_only", diff: null });

    // Sort alphabetically by fleet-card rego (primary), then date/time so
    // splits of the same group stay adjacent. Empty regos sort last so the
    // "unknowns" don't clutter the top of each section.
    const sortKey = (r) => {
      const d = parseDate(r.txn?.date || r.group?.date) || 0;
      const t = r.txn?.time || "";
      // Prefer fleet-card rego (txn.rego / group.fleetCardRego) — that's the
      // authoritative matching key. Fall back to vehicle rego only if neither
      // side has a fleet-card rego.
      const rego = (r.txn?.rego || r.group?.fleetCardRego || r.group?.registration || "").toUpperCase();
      const groupId = r.group?.key || r.txn?.id || "";
      return { d, t, rego, groupId };
    };
    alignedRows.sort((a, b) => {
      const A = sortKey(a), B = sortKey(b);
      // Alphabetical by rego — empties land at the bottom of each section
      if (A.rego !== B.rego) {
        if (!A.rego) return 1;
        if (!B.rego) return -1;
        return A.rego.localeCompare(B.rego);
      }
      if (A.d !== B.d) return A.d - B.d;
      if (A.t !== B.t) return A.t.localeCompare(B.t);
      return A.groupId.localeCompare(B.groupId);
    });

    // Apply filter + search first. Row == whole receipt, so search needs
    // to look across every split — a receipt that has vehicle A in split 1
    // and AdBlue in split 2 should match "A" or "ADBLUE".
    const filteredBase = alignedRows.filter(r => {
      if (reconFilter !== "all" && r.status !== reconFilter) return false;
      if (!searchTerm) return true;
      const entryHit = (r.entries || []).some(e =>
        (e.cardRego || "").toUpperCase().includes(searchTerm) ||
        (e.registration || "").toUpperCase().includes(searchTerm) ||
        (e.driverName || "").toUpperCase().includes(searchTerm) ||
        (e.station || "").toUpperCase().includes(searchTerm) ||
        (e.fuelType || "").toUpperCase().includes(searchTerm) ||
        normalizeCardNum(e.fleetCardNumber).includes(searchTerm)
      );
      return (
        entryHit ||
        (r.txn?.rego || "").includes(searchTerm) ||
        (r.txn?.cardNumber || "").includes(searchTerm) ||
        (r.txn?.driver || "").toUpperCase().includes(searchTerm) ||
        (r.txn?.station || "").toUpperCase().includes(searchTerm) ||
        (r.group?.fleetCardRego || "").toUpperCase().includes(searchTerm)
      );
    });

    // Break into four sections so the admin works one problem type at a
    // time. Exact matches up top (the clean pile), then three "Needs
    // Review" buckets — each surfaces a distinct failure mode:
    //   · Scan Errors  — receipt + txn both exist but totals disagree
    //                    (usually an OCR slip the admin can correct)
    //   · Mismatch     — txn has no matching receipt in the app
    //                    (driver forgot to log a receipt)
    //   · App Only     — receipt exists but no txn in the fleet report
    //                    (unusual — possibly a different card or surcharge)
    const exactRows     = filteredBase.filter(r => r.status === "matched");
    const scanErrorRows = filteredBase.filter(r => r.status === "scan_error");
    const missingRows   = filteredBase.filter(r => r.status === "missing");
    const appOnlyRows   = filteredBase.filter(r => r.status === "app_only");

    // Section headers only appear in the "All" view, and only when there
    // are at least two non-empty buckets — a single banner above a single
    // category adds noise. Per-filter views rely on the filter button
    // itself as the header.
    const populatedBuckets = [exactRows, scanErrorRows, missingRows, appOnlyRows].filter(a => a.length > 0);
    const showSections = reconFilter === "all" && populatedBuckets.length >= 2;

    const displayRows = [];
    if (showSections) {
      if (exactRows.length > 0) {
        displayRows.push({ __section: "exact", label: `Exact Matches \u00B7 ${exactRows.length}` });
        displayRows.push(...exactRows);
      }
      if (scanErrorRows.length > 0) {
        displayRows.push({ __section: "scan_error", label: `Scan Errors \u00B7 ${scanErrorRows.length}` });
        displayRows.push(...scanErrorRows);
      }
      if (missingRows.length > 0) {
        displayRows.push({ __section: "missing", label: `Mismatch \u00B7 ${missingRows.length}` });
        displayRows.push(...missingRows);
      }
      if (appOnlyRows.length > 0) {
        displayRows.push({ __section: "app_only", label: `App Only \u00B7 ${appOnlyRows.length}` });
        displayRows.push(...appOnlyRows);
      }
    } else {
      displayRows.push(...filteredBase);
    }

    // Styling for the section divider rows — mirrors each category's KPI
    // pill colour so the banner feels visually linked to the filter chip.
    const sectionRowStyle = {
      exact:      { bg: "#dcfce7", border: "#4ade80", text: "#14532d", icon: "\u2713" },
      scan_error: { bg: "#fef3c7", border: "#f59e0b", text: "#78350f", icon: "\u26A0" },
      missing:    { bg: "#fee2e2", border: "#f87171", text: "#7f1d1d", icon: "\u2717" },
      app_only:   { bg: "#dbeafe", border: "#60a5fa", text: "#1e3a8a", icon: "\u24D8" },
    };

    // Uniform row height so the two tables visually align side-by-side.
    // Values tuned for the wide-container reconciliation layout — plenty of
    // breathing room now that the view fills the viewport on desktop.
    const BASE_ROW_H = 46;
    const cellStyle = {
      padding: "0 4px",
      fontSize: 12,
      color: "#0f172a",
      verticalAlign: "middle",
      borderBottom: "1px solid #eef2f6",
      whiteSpace: "nowrap",
    };
    const inputStyle = {
      width: "100%",
      padding: "8px 8px",
      fontSize: 12,
      border: "1px solid transparent",
      background: "transparent",
      borderRadius: 4,
      fontFamily: "inherit",
      color: "#0f172a",
      outline: "none",
      cursor: "text",
      transition: "background 0.1s, border-color 0.1s",
    };
    // Hover affordance — subtle dotted underline hint + light grey background
    // so every editable cell telegraphs "click me". Focus ups the contrast.
    const hoverCellStyle = (e) => {
      if (document.activeElement === e.target) return;
      e.target.style.background = "#f8fafc";
      e.target.style.borderColor = "#e2e8f0";
    };
    const focusCellStyle = (e) => { e.target.style.background = "white"; e.target.style.borderColor = "#93c5fd"; };
    const blurCellStyle = (e) => { e.target.style.background = "transparent"; e.target.style.borderColor = "transparent"; };

    // Editable cell — uncontrolled input, commits on blur + Enter, Esc reverts.
    const EditCell = ({ value, onCommit, align = "left", width, readOnly = false, placeholder = "", type = "text", title, muted = false }) => (
      <td style={{ ...cellStyle, textAlign: align, width }} title={title || (readOnly ? undefined : "Click to edit")}>
        {readOnly ? (
          <span style={{ padding: "6px 6px", display: "inline-block", color: "#64748b" }}>{value ?? ""}</span>
        ) : (
          <input
            key={value ?? ""}
            type={type}
            defaultValue={value ?? ""}
            placeholder={placeholder}
            onFocus={focusCellStyle}
            onMouseEnter={hoverCellStyle}
            onMouseLeave={(e) => { if (document.activeElement !== e.target) blurCellStyle(e); }}
            onBlur={(e) => { blurCellStyle(e); if (e.target.value !== String(value ?? "")) onCommit(e.target.value); }}
            onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") { e.target.value = value ?? ""; e.target.blur(); } }}
            style={{ ...inputStyle, textAlign: align, ...(muted ? { color: "#64748b", fontSize: 11 } : {}) }}
          />
        )}
      </td>
    );

    // Quick-set range buttons
    const setRangeTo = (daysAgo) => {
      const today = new Date();
      const from = new Date(today); from.setDate(today.getDate() - daysAgo);
      const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      setReconFromDate(fmt(from));
      setReconToDate(fmt(today));
    };

    // Build a single-sheet side-by-side Excel workbook of the current
    // reconciliation view. Respects the active date range + filter + search
    // (so if the admin has filtered to just "Scan Errors", only those rows
    // export). Each split entry gets its own row on the app side; the
    // fleet-card side only fills the first split row of a group.
    const exportReconciliation = () => {
      try {
        // Colour map (ARGB format — xlsx-js-style wants 8-hex-digit strings
        // with a leading opacity pair; FF = fully opaque). Fills chosen to
        // match the on-screen row tints for instant recognition, with the
        // status column using the darker accent so it pops.
        const EXCEL_STATUS = {
          matched:    { fill: "FFEAF7EF", accent: "FFBBE5C9", text: "FF15803D" },
          scan_error: { fill: "FFFFF5D6", accent: "FFFCD57F", text: "FFB45309" },
          missing:    { fill: "FFFDE7E7", accent: "FFFAB5B5", text: "FFB91C1C" },
          app_only:   { fill: "FFE6EFFE", accent: "FF9EBDFB", text: "FF1D4ED8" },
        };
        const BORDER_COL = "FFD1D5DB";
        const thinBorder = {
          top:    { style: "thin", color: { rgb: BORDER_COL } },
          bottom: { style: "thin", color: { rgb: BORDER_COL } },
          left:   { style: "thin", color: { rgb: BORDER_COL } },
          right:  { style: "thin", color: { rgb: BORDER_COL } },
        };

        const aoa = [];
        // Title + summary block
        const rangeLabel = reconFromDate === reconToDate ? reconFromDate : `${reconFromDate} to ${reconToDate}`;
        aoa.push([`Fleet Card Reconciliation — ${rangeLabel}`]);
        aoa.push([`Generated ${new Date().toLocaleString("en-AU")}`]);
        aoa.push([`Matched: ${matched.length}  ·  Scan Errors: ${scanErrors.length}  ·  Missing Receipt: ${missing.length}  ·  App Only: ${appOnlyGroups.length}  ·  Surcharges filtered: ${surchargeTxns.length}`]);
        if (reconFilter !== "all") aoa.push([`Filter: ${reconFilter.replace("_", " ")}`]);
        if (reconSearch.trim()) aoa.push([`Search: "${reconSearch.trim()}"`]);
        // Legend row — one colour swatch per classification
        aoa.push([
          "Legend:",
          "✓ Matched", "", "⚠ Scan Error", "", "✗ Missing Receipt", "", "ⓘ App Only",
        ]);
        aoa.push([]); // blank row
        const legendRowIdx = aoa.length - 2; // index of the legend row (0-based)

        // Section headers row (visual grouping)
        aoa.push([
          "— FLEET CARD REPORT —", "", "", "", "", "", "", "", "", "", "",
          "", // separator col
          "— APP ENTRIES —", "", "", "", "", "", "", "", "", "", "", "", "",
        ]);
        const sectionRowIdx = aoa.length - 1;
        // Column headers. App side shows Rego (fleet card) as the primary matching
        // key, with Vehicle (actual rego driven) as a secondary column — they're
        // usually identical but diverge when a driver uses a card embossed with a
        // different rego than the vehicle they're fuelling.
        aoa.push([
          "Status", "Date", "Time", "Rego", "Card", "Driver", "Station", "Product", "Litres", "$/L", "Total",
          "",
          "Status", "Date", "Rego", "Vehicle", "Driver", "Card", "Station", "Fuel", "Litres", "$/L", "Total", "Receipt", "Split",
        ]);
        const headerColsRowIdx = aoa.length - 1;
        const firstDataRowIdx = aoa.length; // data starts at this 0-based row

        // Track each emitted row so we can style it correctly in the second pass.
        // Section banner rows (the "Exact Matches" / "Needs Review" dividers)
        // get a full-width merge + coloured banner; data rows get their usual
        // per-status tint. Keeping the meta array flat sidesteps any row-index
        // arithmetic if sections are added/removed later.
        const rowMeta = []; // { kind: "section"|"data", rowIdx, status?, sectionKind? }

        for (const r of displayRows) {
          if (r.__section) {
            // Echo the banner text on BOTH sides so each panel is self-labelled
            // when an admin hides a column pane in Excel.
            const bannerIcon =
              r.__section === "exact"      ? "\u2713" :
              r.__section === "scan_error" ? "\u26A0" :
              r.__section === "missing"    ? "\u2717" :
              r.__section === "app_only"   ? "\u24D8" :
                                             "\u2022";
            const bannerText = `${bannerIcon}  ${r.label}`;
            const rowArr = new Array(25).fill("");
            rowArr[0] = bannerText;
            rowArr[12] = bannerText;
            aoa.push(rowArr);
            rowMeta.push({ kind: "section", rowIdx: aoa.length - 1, sectionKind: r.__section });
            continue;
          }

          const st = statusStyle[r.status];
          const statusLabel = st?.title || r.status;

          let fleetCardCols;
          if (r.txn) {
            fleetCardCols = [
              statusLabel,
              r.txn.date || "",
              r.txn.time || "",
              r.txn.rego || "",
              r.txn.cardNumber || "",
              r.txn.driver || "",
              r.txn.station || "",
              r.txn.product || "",
              r.txn.litres != null ? r.txn.litres : "",
              r.txn.ppl != null ? r.txn.ppl : "",
              r.txn.cost != null ? r.txn.cost : "",
            ];
          } else {
            fleetCardCols = [statusLabel, "", "", "", "", "", "— no transaction in report —", "", "", "", ""];
          }

          let appCols;
          if (r.group && r.entries && r.entries.length > 0) {
            // One row per receipt group. Multi-split receipts show whole-
            // receipt totals with comma-joined vehicle regos / fuels so the
            // reconciliation compares like-for-like against the fleet card
            // transaction total. The individual splits remain intact on the
            // Data tab for per-vehicle reporting.
            const entries = r.entries;
            const uniq = (arr) => Array.from(new Set(arr.map(s => (s || "").trim()).filter(Boolean)));
            const g = r.group;
            let litres, ppl, cost, regos, fuels;
            if (entries.length > 1) {
              litres = entries.reduce((s, x) => s + (x.litres || 0), 0);
              cost   = entries.reduce((s, x) => s + (x.totalCost || 0), 0);
              ppl    = litres > 0 ? cost / litres : 0;
              regos  = uniq(entries.map(x => x.registration)).join(", ");
              fuels  = uniq(entries.map(x => x.fuelType)).join(", ");
            } else {
              const e = entries[0];
              litres = e.litres != null ? e.litres : "";
              ppl    = e.pricePerLitre != null ? e.pricePerLitre : "";
              cost   = e.totalCost != null ? e.totalCost : "";
              regos  = e.registration || "";
              fuels  = e.fuelType || "";
            }
            const anyReceipt = entries.some(x => x.hasReceipt);
            appCols = [
              statusLabel,
              g.date || "",
              g.fleetCardRego || lookupFleetCardRego(g.fleetCardNumber) || "",
              regos,
              g.driverName || "",
              g.fleetCardNumber || "",
              g.station || "",
              fuels,
              litres,
              typeof ppl === "number" ? Number(ppl.toFixed(3)) : ppl,
              cost,
              anyReceipt ? "Yes" : "",
              entries.length > 1 ? `${entries.length} splits` : "",
            ];
          } else {
            const followUp = r.txn?.driver ? `follow up with ${r.txn.driver}` : "driver unknown";
            // Placeholder text lands in the Station column (index 6) — now aligned
            // with the fleet-card side's "— no transaction —" placeholder.
            appCols = [statusLabel, "", "", "", "", "", `— no receipt lodged (${followUp}) —`, "", "", "", "", "", ""];
          }

          aoa.push([...fleetCardCols, "", ...appCols]);
          rowMeta.push({ kind: "data", rowIdx: aoa.length - 1, status: r.status });
        }

        const ws = XLSXStyle.utils.aoa_to_sheet(aoa);
        const numCols = 25; // A..Y — app side gained a "Vehicle" column (index 15)

        // Helper — set a style on a cell (creating it if missing).
        const addrFor = (r, c) => XLSXStyle.utils.encode_cell({ r, c });
        const setStyle = (r, c, style) => {
          const addr = addrFor(r, c);
          if (!ws[addr]) ws[addr] = { v: "", t: "s" };
          ws[addr].s = { ...(ws[addr].s || {}), ...style };
        };

        // ── Title / summary block styling (rows 0 through sectionRowIdx-2) ──
        const summaryBold = { font: { bold: true, sz: 14 }, alignment: { horizontal: "left" } };
        setStyle(0, 0, { font: { bold: true, sz: 16, color: { rgb: "FF0F172A" } }, alignment: { horizontal: "left" } });
        setStyle(1, 0, { font: { italic: true, sz: 10, color: { rgb: "FF64748B" } } });
        setStyle(2, 0, { font: { sz: 11, color: { rgb: "FF374151" } } });

        // ── Legend row — each coloured swatch gets a fill of its status colour ──
        const legendCells = [
          { col: 1, status: "matched" },
          { col: 3, status: "scan_error" },
          { col: 5, status: "missing" },
          { col: 7, status: "app_only" },
        ];
        setStyle(legendRowIdx, 0, { font: { bold: true, sz: 10, color: { rgb: "FF64748B" } } });
        legendCells.forEach(({ col, status }) => {
          const c = EXCEL_STATUS[status];
          setStyle(legendRowIdx, col, {
            fill: { patternType: "solid", fgColor: { rgb: c.fill } },
            font: { bold: true, sz: 10, color: { rgb: c.text } },
            alignment: { horizontal: "center" },
            border: thinBorder,
          });
        });

        // ── Section headers row — slate background, white bold text ──
        for (let c = 0; c < numCols; c++) {
          if (c === 11) continue; // separator column stays blank
          setStyle(sectionRowIdx, c, {
            fill: { patternType: "solid", fgColor: { rgb: "FF334155" } },
            font: { bold: true, sz: 11, color: { rgb: "FFFFFFFF" } },
            alignment: { horizontal: "center", vertical: "center" },
          });
        }

        // ── Column headers row — light slate, bold ──
        for (let c = 0; c < numCols; c++) {
          if (c === 11) continue;
          setStyle(headerColsRowIdx, c, {
            fill: { patternType: "solid", fgColor: { rgb: "FFE2E8F0" } },
            font: { bold: true, sz: 10, color: { rgb: "FF0F172A" } },
            alignment: { horizontal: "center", vertical: "center" },
            border: thinBorder,
          });
        }

        // ── Data + section banner rows — colour each by role ──
        // Section banner styling — mirrors the on-screen category colours
        // so the Excel output is visually consistent with the app view.
        const SECTION_STYLE = {
          exact:      { fill: "FFDCFCE7", text: "FF14532D" }, // green
          scan_error: { fill: "FFFEF3C7", text: "FF78350F" }, // amber
          missing:    { fill: "FFFEE2E2", text: "FF7F1D1D" }, // red
          app_only:   { fill: "FFDBEAFE", text: "FF1E3A8A" }, // blue
        };
        for (const m of rowMeta) {
          if (m.kind === "section") {
            const s = SECTION_STYLE[m.sectionKind];
            for (let col = 0; col < numCols; col++) {
              if (col === 11) continue; // separator column stays blank
              setStyle(m.rowIdx, col, {
                fill: { patternType: "solid", fgColor: { rgb: s.fill } },
                font: { bold: true, sz: 11, color: { rgb: s.text } },
                alignment: { horizontal: "left", vertical: "center" },
                border: thinBorder,
              });
            }
            continue;
          }
          const c = EXCEL_STATUS[m.status] || EXCEL_STATUS.matched;
          for (let col = 0; col < numCols; col++) {
            if (col === 11) continue; // separator stays transparent
            // Status columns (0 and 12) get the darker accent tint + bold
            const isStatusCol = col === 0 || col === 12;
            setStyle(m.rowIdx, col, {
              fill: { patternType: "solid", fgColor: { rgb: isStatusCol ? c.accent : c.fill } },
              font: { bold: isStatusCol, sz: 10, color: { rgb: isStatusCol ? c.text : "FF0F172A" } },
              alignment: {
                // Right-align numeric columns: L-side Litres/$/L/Total (8–10) and
                // R-side Litres/$/L/Total (20–22, shifted +1 from old layout after
                // the Vehicle column was inserted at col 15).
                horizontal: isStatusCol ? "center" : (col >= 8 && col <= 10) || (col >= 20 && col <= 22) ? "right" : "left",
                vertical: "center",
                wrapText: false,
              },
              border: thinBorder,
            });
          }
        }

        // Column widths tuned so the file opens with everything readable
        ws["!cols"] = [
          { wch: 16 }, // L-Status
          { wch: 11 }, // L-Date
          { wch: 7 },  // L-Time
          { wch: 9 },  // L-Rego
          { wch: 20 }, // L-Card
          { wch: 18 }, // L-Driver
          { wch: 30 }, // L-Station
          { wch: 14 }, // L-Product
          { wch: 9 },  // L-Litres
          { wch: 8 },  // L-$/L
          { wch: 10 }, // L-Total
          { wch: 2 },  // separator
          { wch: 22 }, // R-Status
          { wch: 11 }, // R-Date
          { wch: 9 },  // R-Rego (fleet card)
          { wch: 9 },  // R-Vehicle
          { wch: 18 }, // R-Driver
          { wch: 20 }, // R-Card
          { wch: 30 }, // R-Station
          { wch: 14 }, // R-Fuel
          { wch: 9 },  // R-Litres
          { wch: 8 },  // R-$/L
          { wch: 10 }, // R-Total
          { wch: 9 },  // R-Receipt
          { wch: 7 },  // R-Split
        ];
        // Row heights — slightly taller header + data rows for readability
        ws["!rows"] = [];
        ws["!rows"][sectionRowIdx] = { hpt: 22 };
        ws["!rows"][headerColsRowIdx] = { hpt: 18 };

        // Merge the title + section header rows for readability
        const textRowCount = 3 +
          (reconFilter !== "all" ? 1 : 0) +
          (reconSearch.trim() ? 1 : 0);
        ws["!merges"] = [
          ...Array.from({ length: textRowCount }, (_, i) => ({ s: { r: i, c: 0 }, e: { r: i, c: numCols - 1 } })),
          { s: { r: sectionRowIdx, c: 0 },  e: { r: sectionRowIdx, c: 10 } }, // "— FLEET CARD REPORT —"
          { s: { r: sectionRowIdx, c: 12 }, e: { r: sectionRowIdx, c: numCols - 1 } }, // "— APP ENTRIES —"
          // Section banner rows (Exact Matches / Needs Review) — merge each
          // side so the banner text reads as one continuous label per panel.
          ...rowMeta.filter(m => m.kind === "section").flatMap(m => [
            { s: { r: m.rowIdx, c: 0 },  e: { r: m.rowIdx, c: 10 } },
            { s: { r: m.rowIdx, c: 12 }, e: { r: m.rowIdx, c: numCols - 1 } },
          ]),
        ];
        // Freeze the header area (below the column-headers row) so scrolling
        // keeps the labels and title in view.
        ws["!freeze"] = { xSplit: "0", ySplit: String(firstDataRowIdx), topLeftCell: addrFor(firstDataRowIdx, 0), activePane: "bottomLeft", state: "frozen" };
        ws["!views"] = [{ state: "frozen", ySplit: firstDataRowIdx, xSplit: 0, topLeftCell: addrFor(firstDataRowIdx, 0) }];

        const wb = XLSXStyle.utils.book_new();
        XLSXStyle.utils.book_append_sheet(wb, ws, "Reconciliation");

        const fileRange = reconFromDate === reconToDate ? reconFromDate : `${reconFromDate}_to_${reconToDate}`;
        const filterTag = reconFilter !== "all" ? `_${reconFilter}` : "";
        const filename = `Reconciliation_${fileRange}${filterTag}.xlsx`;
        XLSXStyle.writeFile(wb, filename);
        const dataRowCount = rowMeta.filter(m => m.kind === "data").length;
        showToast(`Exported ${dataRowCount} row${dataRowCount !== 1 ? "s" : ""} to ${filename}`);
      } catch (err) {
        console.error("Reconciliation export failed:", err);
        showToast("Export failed: " + err.message, "warn");
      }
    };

    return (
      <div className="fade-in">
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>Fleet Card Reconciliation</div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>
            Pick a date range, upload the FleetCard Australia report, and the app will match it against lodged receipts
          </div>
        </div>

        {/* Date range picker */}
        <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#0891b2", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 8 }}>Date Range</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={{ display: "block", fontSize: 10, color: "#64748b", fontWeight: 600, marginBottom: 3 }}>From</label>
              <input type="date" value={reconFromDate} onChange={e => setReconFromDate(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 13, fontFamily: "inherit", outline: "none", color: "#0f172a" }} />
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={{ display: "block", fontSize: 10, color: "#64748b", fontWeight: 600, marginBottom: 3 }}>To</label>
              <input type="date" value={reconToDate} onChange={e => setReconToDate(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 13, fontFamily: "inherit", outline: "none", color: "#0f172a" }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
            {[
              { label: "Today", days: 0 },
              { label: "Yesterday", days: 1, single: true },
              { label: "Last 7 days", days: 7 },
              { label: "Last 30 days", days: 30 },
            ].map(r => (
              <button key={r.label} onClick={() => {
                if (r.single) {
                  const d = new Date(); d.setDate(d.getDate() - r.days);
                  const f = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                  setReconFromDate(f); setReconToDate(f);
                } else {
                  setRangeTo(r.days);
                }
              }} style={{
                padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 500,
                background: "#f0f9ff", color: "#0891b2", border: "1px solid #bae6fd",
                cursor: "pointer", fontFamily: "inherit",
              }}>{r.label}</button>
            ))}
          </div>
        </div>

        {/* Upload area */}
        <div style={{
          background: "white", border: "2px dashed #cbd5e1", borderRadius: 12,
          padding: 20, textAlign: "center", marginBottom: 16, cursor: "pointer",
          transition: "border-color 0.15s",
        }}
          onClick={() => csvInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = "#16a34a"; }}
          onDragLeave={e => { e.currentTarget.style.borderColor = "#cbd5e1"; }}
          onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = "#cbd5e1"; handleCSVUpload(e.dataTransfer.files[0]); }}
        >
          <input ref={csvInputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }}
            onChange={e => handleCSVUpload(e.target.files[0])} />
          <div style={{ fontSize: 28, marginBottom: 6 }}>{reconUploading ? "\u23F3" : "\uD83D\uDCC4"}</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>
            {reconUploading ? "Importing..." : "Drop FleetCard Australia report here or tap to upload"}
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
            Supports CSV and Excel (.xlsx) {"\u00B7"} Auto-detects columns {"\u00B7"} Surcharges filtered automatically
          </div>
        </div>

        {/* Stats bar + dual spreadsheet — show whenever EITHER side has data,
            so clearing the imported report leaves the App Entries panel up
            for easy visual comparison before re-uploading. */}
        {(fleetCardTxns.length > 0 || inRangeEntries.length > 0) && (
          <>
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 8,
            }}>
              {[
                { key: "all",        label: "Total",    count: results.length,         color: "#374151", bg: "#f8fafc", border: "#e2e8f0" },
                { key: "matched",    label: "Matched",  count: matched.length,         color: "#15803d", bg: "#f0fdf4", border: "#86efac" },
                { key: "scan_error", label: "Scan Err", count: scanErrors.length,      color: "#b45309", bg: "#fffbeb", border: "#fcd34d" },
                { key: "missing",    label: "Missing",  count: missing.length,         color: "#dc2626", bg: "#fef2f2", border: "#fca5a5" },
                { key: "app_only",   label: "App Only", count: appOnlyGroups.length,   color: "#1d4ed8", bg: "#eff6ff", border: "#93c5fd" },
              ].map(s => (
                <button key={s.key} onClick={() => setReconFilter(s.key)}
                  style={{
                    background: reconFilter === s.key ? s.bg : "white",
                    border: `1px solid ${reconFilter === s.key ? s.border : "#e2e8f0"}`,
                    borderRadius: 8, padding: "8px 4px", cursor: "pointer", fontFamily: "inherit", textAlign: "center",
                  }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.count}</div>
                  <div style={{ fontSize: 10, color: s.color, fontWeight: 600, marginTop: 2 }}>{s.label}</div>
                </button>
              ))}
            </div>

            {/* Summary line */}
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 12, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
              <span>
                Range: <strong>{reconFromDate}</strong> to <strong>{reconToDate}</strong>
                {surchargeTxns.length > 0 && <span> {"\u00B7"} {surchargeTxns.length} surcharge{surchargeTxns.length !== 1 ? "s" : ""} auto-filtered</span>}
              </span>
              <span>
                {receiptGroups.length} receipt{receiptGroups.length !== 1 ? "s" : ""} in app {"\u00B7"} {fuelTxns.length} fuel txn{fuelTxns.length !== 1 ? "s" : ""} in report
              </span>
            </div>

            {/* Search + actions toolbar */}
            <div style={{ marginBottom: 12, display: "flex", gap: 8, alignItems: "stretch" }}>
              <input value={reconSearch} onChange={e => setReconSearch(e.target.value)}
                placeholder="Search by rego, card number, driver, station..."
                style={{
                  flex: 1, padding: "9px 12px", borderRadius: 8, border: "1px solid #e2e8f0",
                  fontSize: 13, fontFamily: "inherit", outline: "none", color: "#0f172a",
                }}
                onFocus={e => e.target.style.borderColor = "#22c55e"}
                onBlur={e => e.target.style.borderColor = "#e2e8f0"}
              />
              <button
                onClick={exportReconciliation}
                disabled={displayRows.length === 0}
                title={displayRows.length === 0 ? "Nothing to export yet" : "Download a side-by-side Excel comparison of the current view"}
                style={{
                  padding: "9px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: displayRows.length === 0 ? "#f1f5f9" : "#0f766e",
                  color: displayRows.length === 0 ? "#94a3b8" : "white",
                  border: `1px solid ${displayRows.length === 0 ? "#e2e8f0" : "#0f766e"}`,
                  cursor: displayRows.length === 0 ? "not-allowed" : "pointer",
                  fontFamily: "inherit", whiteSpace: "nowrap",
                }}
              >{"\uD83D\uDCCA"} Export Excel</button>
            </div>

            {/* ── Dual spreadsheet layout ──────────────────────────────── */}
            {displayRows.length === 0 ? (
              <div style={{ textAlign: "center", padding: 30, color: "#94a3b8", fontSize: 13, background: "white", border: "1px solid #e2e8f0", borderRadius: 10 }}>
                {fuelTxns.length === 0 && receiptGroups.length === 0
                  ? "No transactions or app entries in the selected date range"
                  : "Nothing matches the current filter"}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {/* ── LEFT: FleetCard Report ─────────────────────────── */}
                <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ padding: "8px 12px", fontSize: 11, fontWeight: 700, color: "#374151", letterSpacing: "0.04em", textTransform: "uppercase", borderBottom: "1px solid #e2e8f0", background: "#fafafa", display: "flex", justifyContent: "space-between" }}>
                    <span>{"\uD83D\uDCCB"} FleetCard Report</span>
                    <span style={{ fontWeight: 500, color: "#94a3b8" }}>{fuelTxns.length} fuel txn{fuelTxns.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                      <thead>
                        <tr style={{ background: "#f8fafc", position: "sticky", top: 0 }}>
                          <th style={{ ...cellStyle, fontSize: 10, textTransform: "uppercase", fontWeight: 700, color: "#64748b", width: 22 }}></th>
                          <th style={{ ...cellStyle, fontSize: 10, textTransform: "uppercase", fontWeight: 700, color: "#64748b", width: 76 }}>Date</th>
                          <th style={{ ...cellStyle, fontSize: 10, textTransform: "uppercase", fontWeight: 700, color: "#64748b", width: 48 }}>Time</th>
                          <th style={{ ...cellStyle, fontSize: 10, textTransform: "uppercase", fontWeight: 700, color: "#64748b", width: 84 }}>Rego</th>
                          <th style={{ ...cellStyle, fontSize: 10, textTransform: "uppercase", fontWeight: 700, color: "#64748b" }}>Station</th>
                          <th style={{ ...cellStyle, fontSize: 10, textTransform: "uppercase", fontWeight: 700, color: "#64748b", width: 78 }}>Product</th>
                          <th style={{ ...cellStyle, fontSize: 10, textTransform: "uppercase", fontWeight: 700, color: "#64748b", width: 58, textAlign: "right" }}>L</th>
                          <th style={{ ...cellStyle, fontSize: 10, textTransform: "uppercase", fontWeight: 700, color: "#64748b", width: 52, textAlign: "right" }}>$/L</th>
                          <th style={{ ...cellStyle, fontSize: 10, textTransform: "uppercase", fontWeight: 700, color: "#64748b", width: 70, textAlign: "right" }}>Total</th>
                          <th style={{ ...cellStyle, fontSize: 10, textTransform: "uppercase", fontWeight: 700, color: "#64748b", width: 24 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayRows.map((r, i) => {
                          // Section divider — spans the full row in both tables so
                          // the left/right panels stay visually aligned.
                          if (r.__section) {
                            const sec = sectionRowStyle[r.__section];
                            return (
                              <tr key={`L-sec-${r.__section}`} style={{ background: sec.bg, borderTop: `2px solid ${sec.border}`, borderBottom: `2px solid ${sec.border}` }}>
                                <td colSpan={10} style={{ ...cellStyle, padding: "10px 12px", fontSize: 11, fontWeight: 700, color: sec.text, letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                                  {sec.icon} {r.label}
                                </td>
                              </tr>
                            );
                          }
                          const st = statusStyle[r.status] || statusStyle.matched;
                          const rowBg = i % 2 === 0 ? st.bg : st.bgAlt;
                          // App-only row: txn missing
                          if (!r.txn) {
                            return (
                              <tr key={`L-${i}`} style={{ height: BASE_ROW_H, background: rowBg }}>
                                <td style={{ ...cellStyle, textAlign: "center", color: st.text, fontWeight: 700 }} title={st.title}>{st.label}</td>
                                <td colSpan={9} style={{ ...cellStyle, color: "#94a3b8", fontStyle: "italic", padding: "0 8px" }}>— no transaction in report —</td>
                              </tr>
                            );
                          }
                          // Every row represents one whole receipt group — the fleet
                          // card side always has a single txn per receipt, so splits
                          // no longer produce continuation rows on the left.
                          const t = r.txn;
                          return (
                            <tr key={`L-${i}`} style={{ height: BASE_ROW_H, background: rowBg }}>
                              <td style={{ ...cellStyle, textAlign: "center", color: st.text, fontWeight: 700 }} title={st.title}>
                                {st.label}
                                {r.splitTotal > 1 && (
                                  <div
                                    style={{ fontSize: 8, color: st.text, fontWeight: 600, marginTop: 1 }}
                                    title={`Receipt was split into ${r.splitTotal} app entries — reconciliation shows the whole-receipt total`}
                                  >{r.splitTotal}{"\u00D7"}</div>
                                )}
                              </td>
                              <EditCell value={t.date} onCommit={v => saveTxnEdit(t.id, "date", v)} />
                              <EditCell value={t.time} onCommit={v => saveTxnEdit(t.id, "time", v)} />
                              <EditCell value={t.rego} onCommit={v => saveTxnEdit(t.id, "rego", v)} />
                              <EditCell value={t.station} onCommit={v => saveTxnEdit(t.id, "station", v)} />
                              <EditCell value={t.product} onCommit={v => saveTxnEdit(t.id, "product", v)} />
                              <EditCell value={t.litres} onCommit={v => saveTxnEdit(t.id, "litres", v)} align="right" />
                              <EditCell value={t.ppl} onCommit={v => saveTxnEdit(t.id, "ppl", v)} align="right" />
                              <EditCell value={t.cost != null ? t.cost.toFixed(2) : ""} onCommit={v => saveTxnEdit(t.id, "cost", v)} align="right" />
                              <td style={{ ...cellStyle, textAlign: "center" }}>
                                <button onClick={() => setConfirmAction({
                                  message: `Remove this fleet card transaction row?\n\n${t.rego || "?"} · ${t.station || "?"} · $${t.cost != null ? t.cost.toFixed(2) : "?"}`,
                                  onConfirm: () => { deleteTxn(t.id); setConfirmAction(null); },
                                })} title="Remove this row" style={{
                                  background: "none", border: "none", color: "#cbd5e1", cursor: "pointer",
                                  fontSize: 14, lineHeight: 1, padding: "2px 4px",
                                }}>{"\u00D7"}</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ── RIGHT: App Entries (receipts) ──────────────────────── */}
                <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ padding: "8px 12px", fontSize: 11, fontWeight: 700, color: "#374151", letterSpacing: "0.04em", textTransform: "uppercase", borderBottom: "1px solid #e2e8f0", background: "#fafafa", display: "flex", justifyContent: "space-between" }}>
                    <span>{"\uD83D\uDCF1"} App Entries</span>
                    <span style={{ fontWeight: 500, color: "#94a3b8" }}>{receiptGroups.length} receipt{receiptGroups.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                      <thead>
                        <tr style={{ background: "#f8fafc", position: "sticky", top: 0 }}>
                          <th style={{ ...cellStyle, fontSize: 10, textTransform: "uppercase", fontWeight: 700, color: "#64748b", width: 22 }}></th>
                          <th style={{ ...cellStyle, fontSize: 10, textTransform: "uppercase", fontWeight: 700, color: "#64748b", width: 76 }}>Date</th>
                          <th style={{ ...cellStyle, fontSize: 10, textTransform: "uppercase", fontWeight: 700, color: "#64748b", width: 84 }} title="Rego as printed on the fleet card (authoritative for matching)">Rego</th>
                          <th style={{ ...cellStyle, fontSize: 9, textTransform: "uppercase", fontWeight: 600, color: "#94a3b8", width: 54 }} title="Vehicle rego the driver actually drove (often matches, but can differ)">Vehicle</th>
                          <th style={{ ...cellStyle, fontSize: 10, textTransform: "uppercase", fontWeight: 700, color: "#64748b" }}>Driver</th>
                          <th style={{ ...cellStyle, fontSize: 10, textTransform: "uppercase", fontWeight: 700, color: "#64748b" }}>Station</th>
                          <th style={{ ...cellStyle, fontSize: 10, textTransform: "uppercase", fontWeight: 700, color: "#64748b", width: 62 }}>Fuel</th>
                          <th style={{ ...cellStyle, fontSize: 10, textTransform: "uppercase", fontWeight: 700, color: "#64748b", width: 58, textAlign: "right" }}>L</th>
                          <th style={{ ...cellStyle, fontSize: 10, textTransform: "uppercase", fontWeight: 700, color: "#64748b", width: 52, textAlign: "right" }}>$/L</th>
                          <th style={{ ...cellStyle, fontSize: 10, textTransform: "uppercase", fontWeight: 700, color: "#64748b", width: 70, textAlign: "right" }}>Total</th>
                          <th style={{ ...cellStyle, fontSize: 10, textTransform: "uppercase", fontWeight: 700, color: "#64748b", width: 36, textAlign: "center" }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayRows.map((r, i) => {
                          // Section divider — mirrors the one in the FleetCard
                          // table so both sides visually align at the split.
                          if (r.__section) {
                            const sec = sectionRowStyle[r.__section];
                            return (
                              <tr key={`R-sec-${r.__section}`} style={{ background: sec.bg, borderTop: `2px solid ${sec.border}`, borderBottom: `2px solid ${sec.border}` }}>
                                <td colSpan={11} style={{ ...cellStyle, padding: "10px 12px", fontSize: 11, fontWeight: 700, color: sec.text, letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                                  {sec.icon} {r.label}
                                </td>
                              </tr>
                            );
                          }
                          const st = statusStyle[r.status] || statusStyle.matched;
                          const rowBg = i % 2 === 0 ? st.bg : st.bgAlt;
                          // Missing-receipt row: txn present, no group/entry
                          if (!r.group || !r.entry) {
                            return (
                              <tr key={`R-${i}`} style={{ height: BASE_ROW_H, background: rowBg }}>
                                <td style={{ ...cellStyle, textAlign: "center", color: st.text, fontWeight: 700 }} title={st.title}>{st.label}</td>
                                <td colSpan={10} style={{ ...cellStyle, color: "#94a3b8", fontStyle: "italic", padding: "0 8px" }}>
                                  — no receipt lodged{r.txn?.driver ? ` · follow up with ${r.txn.driver}` : ""} —
                                </td>
                              </tr>
                            );
                          }
                          const isScanError = r.status === "scan_error";
                          // ── Multi-split receipt: show one aggregated read-only row
                          //    with summed litres + cost, and comma-joined fuel/vehicle
                          //    values so the admin sees the whole receipt at a glance.
                          //    The original per-vehicle splits stay editable on the
                          //    Data tab — reconciliation just compares whole receipts. */
                          if (r.splitTotal > 1) {
                            const entries = r.entries || [];
                            const uniq = (arr) => Array.from(new Set(arr.map(s => (s || "").trim()).filter(Boolean)));
                            const aggRegos  = uniq(entries.map(x => x.registration)).join(", ");
                            const aggFuels  = uniq(entries.map(x => x.fuelType)).join(", ");
                            const aggLitres = entries.reduce((s, x) => s + (x.litres || 0), 0);
                            const aggCost   = entries.reduce((s, x) => s + (x.totalCost || 0), 0);
                            const aggPpl    = aggLitres > 0 ? aggCost / aggLitres : 0;
                            const anyReceipt = entries.find(x => x.hasReceipt);
                            const g = r.group || {};
                            const splitTitle = `Receipt split across ${r.splitTotal} entries: ${entries.map(x => `${x.registration || "?"} $${(x.totalCost || 0).toFixed(2)}`).join(", ")}. Edit individual splits on the Data tab.`;
                            const roStyle = { ...cellStyle, padding: "0 8px", color: "#475569" };
                            return (
                              <tr key={`R-${i}`} style={{ height: BASE_ROW_H, background: rowBg }} title={splitTitle}>
                                <td style={{ ...cellStyle, textAlign: "center", color: st.text, fontWeight: 700 }} title={st.title}>
                                  {st.label}
                                  <div style={{ fontSize: 8, color: st.text, fontWeight: 600, marginTop: 1 }}>{r.splitTotal}{"\u00D7"}</div>
                                </td>
                                <td style={roStyle}>{g.date || ""}</td>
                                <td style={roStyle} title="Rego printed on the fleet card (used for matching)">
                                  {g.fleetCardRego || lookupFleetCardRego(g.fleetCardNumber) || ""}
                                </td>
                                <td style={{ ...roStyle, color: "#64748b", fontSize: 11 }} title={`Split across: ${aggRegos}`}>
                                  {aggRegos}
                                </td>
                                <td style={roStyle}>{g.driverName || ""}</td>
                                <td style={roStyle}>{g.station || ""}</td>
                                <td style={roStyle} title={`Fuel types across splits: ${aggFuels}`}>{aggFuels}</td>
                                <td style={{ ...roStyle, textAlign: "right" }}>{aggLitres ? aggLitres.toFixed(2) : ""}</td>
                                <td style={{ ...roStyle, textAlign: "right" }}>{aggPpl ? aggPpl.toFixed(3) : ""}</td>
                                <td style={{ ...roStyle, textAlign: "right", position: "relative" }}>
                                  <div style={{ fontWeight: 600, color: "#0f172a" }}>{aggCost ? aggCost.toFixed(2) : ""}</div>
                                  {isScanError && r.diff != null && (
                                    <div style={{ fontSize: 9, color: "#b45309", fontWeight: 700, marginTop: -2 }}>Δ ${r.diff.toFixed(2)}</div>
                                  )}
                                </td>
                                <td style={{ ...cellStyle, textAlign: "center", whiteSpace: "nowrap" }}>
                                  {anyReceipt && (
                                    <button onClick={() => setViewingReceipt(anyReceipt.id)} title="View receipt image" style={{
                                      background: "none", border: "none", color: "#16a34a", cursor: "pointer", fontSize: 14, padding: "2px 3px",
                                    }}>{"\uD83D\uDCC4"}</button>
                                  )}
                                </td>
                              </tr>
                            );
                          }
                          // ── Single-entry receipt: keep the original editable row.
                          const e = r.entry;
                          return (
                            <tr key={`R-${i}`} style={{ height: BASE_ROW_H, background: rowBg }}>
                              <td style={{ ...cellStyle, textAlign: "center", color: st.text, fontWeight: 700 }} title={st.title}>
                                {st.label}
                              </td>
                              <EditCell value={e.date} onCommit={v => saveEntryEdit(e.id, "date", v)} />
                              <EditCell
                                value={e.cardRego}
                                onCommit={v => saveEntryEdit(e.id, "cardRego", v)}
                                placeholder={lookupFleetCardRego(e.fleetCardNumber) || ""}
                                title="Rego printed on the fleet card (used for matching)"
                              />
                              <EditCell
                                value={e.registration}
                                onCommit={v => saveEntryEdit(e.id, "registration", v)}
                                muted
                                title="Vehicle rego actually driven — often same as fleet card rego, but can differ"
                              />
                              <EditCell value={e.driverName} onCommit={v => saveEntryEdit(e.id, "driverName", v)} />
                              <EditCell value={e.station} onCommit={v => saveEntryEdit(e.id, "station", v)} />
                              <EditCell value={e.fuelType} onCommit={v => saveEntryEdit(e.id, "fuelType", v)} />
                              <EditCell value={e.litres} onCommit={v => saveEntryEdit(e.id, "litres", v)} align="right" />
                              <EditCell value={e.pricePerLitre} onCommit={v => saveEntryEdit(e.id, "pricePerLitre", v)} align="right" />
                              <td style={{ ...cellStyle, textAlign: "right", padding: "0 2px", position: "relative" }}>
                                <input
                                  key={e.totalCost ?? ""}
                                  type="text"
                                  defaultValue={e.totalCost != null ? e.totalCost.toFixed(2) : ""}
                                  onFocus={focusCellStyle}
                                  onMouseEnter={hoverCellStyle}
                                  onMouseLeave={(ev) => { if (document.activeElement !== ev.target) blurCellStyle(ev); }}
                                  onBlur={(ev) => { blurCellStyle(ev); if (ev.target.value !== String(e.totalCost != null ? e.totalCost.toFixed(2) : "")) saveEntryEdit(e.id, "totalCost", ev.target.value); }}
                                  onKeyDown={(ev) => { if (ev.key === "Enter") ev.target.blur(); if (ev.key === "Escape") { ev.target.value = e.totalCost != null ? e.totalCost.toFixed(2) : ""; ev.target.blur(); } }}
                                  style={{ ...inputStyle, textAlign: "right" }}
                                  title="Click to edit"
                                />
                                {isScanError && r.diff != null && (
                                  <div style={{ fontSize: 9, color: "#b45309", fontWeight: 700, marginTop: -2, paddingRight: 6 }}>Δ ${r.diff.toFixed(2)}</div>
                                )}
                              </td>
                              <td style={{ ...cellStyle, textAlign: "center", whiteSpace: "nowrap" }}>
                                {e.hasReceipt && (
                                  <button onClick={() => setViewingReceipt(e.id)} title="View receipt image" style={{
                                    background: "none", border: "none", color: "#16a34a", cursor: "pointer", fontSize: 14, padding: "2px 3px",
                                  }}>{"\uD83D\uDCC4"}</button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ── Scoped clear controls ────────────────────────────────
                The old single "Clear all" button was a nuclear-only option —
                too easy to wipe months of imported data when the admin just
                wanted to reset the current range. Three explicit scopes give
                the admin control over WHAT gets removed:
                  1. In date range  — only txns dated {from} → {to}
                  2. Visible only   — respects date range + filter + search
                  3. All            — everything ever imported (nuclear)
                App receipt entries (`entries`) are NEVER touched by any of
                these — only the imported FleetCard report rows.
                Hidden entirely when there are no imports to clear, so the
                admin can keep comparing the App Entries panel to incoming
                data without a stale "Clear all (0)" panel getting in the way. */}
            {fleetCardTxns.length > 0 && (() => {
              const visibleTxnIds = new Set(searched.map(r => r.txn?.id).filter(Boolean));
              const visibleCount = visibleTxnIds.size;
              const rangeCount = inRangeTxns.length;
              const allCount = fleetCardTxns.length;
              const rangeLabel = (reconFromDate && reconToDate)
                ? `${reconFromDate} \u2192 ${reconToDate}`
                : "the selected range";
              const btnBase = {
                padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                fontFamily: "inherit", whiteSpace: "nowrap",
              };
              const btnActive = (color, bg, border) => ({
                ...btnBase, background: bg, color, border: `1px solid ${border}`, cursor: "pointer",
              });
              const btnDisabled = {
                ...btnBase, background: "#f1f5f9", color: "#cbd5e1",
                border: "1px solid #e2e8f0", cursor: "not-allowed",
              };
              return (
                <div style={{
                  marginTop: 16, padding: "12px 14px",
                  background: "#fafafa", border: "1px solid #e5e7eb", borderRadius: 10,
                }}>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8, textAlign: "center", lineHeight: 1.55 }}>
                    Clear imported FleetCard report rows.{" "}
                    <strong style={{ color: "#334155" }}>App receipt entries are never affected</strong> {"\u00B7"}{" "}
                    Use search + filter above to narrow what <em>Visible only</em> removes.
                  </div>
                  <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
                    {/* ── Clear in date range ─────────────────────────── */}
                    <button
                      disabled={rangeCount === 0}
                      title={rangeCount === 0
                        ? "No imported transactions fall within this date range"
                        : `Remove ${rangeCount} imported transaction${rangeCount !== 1 ? "s" : ""} dated ${rangeLabel}`}
                      onClick={() => setConfirmAction({
                        message: `Remove ${rangeCount} imported fleet card transaction${rangeCount !== 1 ? "s" : ""} dated ${rangeLabel}? App receipts are not touched. This cannot be undone.`,
                        onConfirm: async () => {
                          const next = fleetCardTxns.filter(t => !inRange(t.date));
                          setFleetCardTxns(next);
                          try { await db.saveFleetCardTransactions(next); } catch (_) {}
                          setConfirmAction(null);
                          showToast(`Cleared ${rangeCount} transaction${rangeCount !== 1 ? "s" : ""} in date range`);
                        },
                      })}
                      style={rangeCount === 0 ? btnDisabled : btnActive("#b45309", "#fffbeb", "#fcd34d")}
                    >
                      {"\uD83D\uDCC5"} Clear date range ({rangeCount})
                    </button>
                    {/* ── Clear visible only ──────────────────────────── */}
                    <button
                      disabled={visibleCount === 0}
                      title={visibleCount === 0
                        ? "No transactions currently visible"
                        : `Remove the ${visibleCount} transaction${visibleCount !== 1 ? "s" : ""} shown in the FleetCard Report panel (respects filter + search)`}
                      onClick={() => setConfirmAction({
                        message: `Remove ${visibleCount} imported fleet card transaction${visibleCount !== 1 ? "s" : ""} currently visible in this view? App receipts are not touched. This cannot be undone.`,
                        onConfirm: async () => {
                          const next = fleetCardTxns.filter(t => !visibleTxnIds.has(t.id));
                          setFleetCardTxns(next);
                          try { await db.saveFleetCardTransactions(next); } catch (_) {}
                          setConfirmAction(null);
                          showToast(`Cleared ${visibleCount} visible transaction${visibleCount !== 1 ? "s" : ""}`);
                        },
                      })}
                      style={visibleCount === 0 ? btnDisabled : btnActive("#0369a1", "#f0f9ff", "#7dd3fc")}
                    >
                      {"\uD83D\uDC41"} Clear visible only ({visibleCount})
                    </button>
                    {/* ── Clear all (nuclear) ─────────────────────────── */}
                    <button
                      disabled={allCount === 0}
                      title={allCount === 0
                        ? "Nothing to clear"
                        : `Nuclear option: remove every imported fleet card transaction, across all dates (${allCount} total)`}
                      onClick={() => setConfirmAction({
                        message: `Remove ALL ${allCount} imported fleet card transaction${allCount !== 1 ? "s" : ""}, across every date? App receipts are not touched. This cannot be undone.`,
                        onConfirm: async () => {
                          setFleetCardTxns([]);
                          try { await db.saveFleetCardTransactions([]); } catch (_) {}
                          setConfirmAction(null);
                          showToast(`Cleared all ${allCount} imported transaction${allCount !== 1 ? "s" : ""}`);
                        },
                      })}
                      style={allCount === 0 ? btnDisabled : btnActive("#b91c1c", "#fef2f2", "#fca5a5")}
                    >
                      {"\uD83D\uDDD1"} Clear all ({allCount})
                    </button>
                  </div>
                </div>
              );
            })()}
          </>
        )}

        {/* Only show the full empty-state CTA when there's literally nothing
            to look at — no imports AND no app entries in the selected range.
            If app entries exist but imports are empty, the dual layout above
            takes over and the right panel keeps those entries visible for
            visual comparison. */}
        {fleetCardTxns.length === 0 && inRangeEntries.length === 0 && (
          <div style={{ textAlign: "center", padding: 30, color: "#94a3b8" }}>
            <div style={{ fontSize: 14, marginBottom: 6 }}>No fleet card data imported yet</div>
            <div style={{ fontSize: 12 }}>Upload a CSV or Excel file from your fleet card provider to start reconciling</div>
          </div>
        )}
      </div>
    );
  };

  // ── Fleet Card Summary ───────────────────────────────────────────────────
  const renderCards = () => {
    // Parse month filter
    const [filterYear, filterMonth] = cardMonth.split("-").map(Number);

    // Filter entries to selected month
    const monthEntries = entries.filter(e => {
      if (!e.date) return false;
      const d = parseDate(e.date);
      if (!d) return false;
      const dt = new Date(d);
      return dt.getFullYear() === filterYear && dt.getMonth() + 1 === filterMonth;
    });

    // Group by fleet card rego (the registration embossed on the physical card)
    const byRego = {};
    monthEntries.forEach(e => {
      const rego = (e.cardRego || "").trim().toUpperCase();
      if (!rego) return;
      if (!byRego[rego]) byRego[rego] = { rego, entries: [], totalLitres: 0, totalCost: 0, drivers: new Set(), cards: new Set() };
      byRego[rego].entries.push(e);
      byRego[rego].totalLitres += e.litres || 0;
      byRego[rego].totalCost += e.totalCost || 0;
      if (e.driverName) byRego[rego].drivers.add(e.driverName);
      if (e.fleetCardNumber) byRego[rego].cards.add(e.fleetCardNumber.replace(/\s/g, ""));
    });

    const cards = Object.values(byRego).sort((a, b) => a.rego.localeCompare(b.rego));

    // Filter by search term
    const cardSearchTerm = cardSearch.trim().toUpperCase();
    const filteredCards = cardSearchTerm
      ? cards.filter(c =>
          c.rego.includes(cardSearchTerm) ||
          [...c.drivers].some(d => d.toUpperCase().includes(cardSearchTerm)) ||
          [...c.cards].some(cn => cn.includes(cardSearchTerm) || cn.slice(-6).includes(cardSearchTerm))
        )
      : cards;

    const grandTotal = cards.reduce((s, c) => s + c.totalCost, 0);
    const grandLitres = cards.reduce((s, c) => s + c.totalLitres, 0);
    const monthLabel = new Date(filterYear, filterMonth - 1).toLocaleDateString("en-AU", { year: "numeric", month: "long" });

    // Month navigation
    const prevMonth = () => {
      const d = new Date(filterYear, filterMonth - 2);
      setCardMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
    };
    const nextMonth = () => {
      const d = new Date(filterYear, filterMonth);
      setCardMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
    };

    // Export to Excel
    const exportCardSummary = () => {
      const wb = XLSX.utils.book_new();

      // Summary sheet
      const summaryRows = [
        ["Fleet Card Transaction Summary", "", "", "", monthLabel],
        [],
        ["Rego", "Card Number(s)", "Drivers", "Transactions", "Total Litres", "Total Cost"],
      ];
      cards.forEach(c => {
        summaryRows.push([
          c.rego, [...c.cards].map(cn => `...${cn.slice(-6)}`).join(", ") || "\u2014",
          [...c.drivers].join(", "),
          c.entries.length, Math.round(c.totalLitres * 100) / 100,
          Math.round(c.totalCost * 100) / 100,
        ]);
      });
      summaryRows.push([]);
      summaryRows.push(["", "", "", "GRAND TOTAL", grandLitres.toFixed(2), grandTotal.toFixed(2)]);
      const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
      summaryWs["!cols"] = [{wch:12},{wch:22},{wch:25},{wch:12},{wch:12},{wch:12}];
      XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

      // Per-card detail sheets
      cards.forEach(c => {
        const tabName = c.rego.slice(0, 31);
        const rows = [
          [`Rego: ${c.rego}`, "", "", "", "", monthLabel],
          [`Card(s): ${[...c.cards].map(cn => formatCardNumber(cn)).join(", ") || "\u2014"}`],
          ["Drivers: " + [...c.drivers].join(", ")],
          [],
          ["Date", "Driver", "Station", "Litres", "$/L", "Cost", "Fuel Type", "Division", "Type", "Card"],
        ];
        c.entries.forEach(e => {
          rows.push([
            e.date || "", e.driverName || "",
            e.station || "", e.litres || "", e.pricePerLitre || "",
            e.totalCost ? Math.round(e.totalCost * 100) / 100 : "",
            e.fuelType || "", e.division || "", e.vehicleType || "",
            e.fleetCardNumber ? `...${e.fleetCardNumber.slice(-6)}` : "",
          ]);
        });
        rows.push([]);
        rows.push(["", "", "TOTAL", c.totalLitres.toFixed(2), "", c.totalCost.toFixed(2)]);
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws["!cols"] = [{wch:12},{wch:18},{wch:20},{wch:8},{wch:7},{wch:10},{wch:10},{wch:10},{wch:12},{wch:12}];
        XLSX.utils.book_append_sheet(wb, ws, tabName);
      });

      XLSX.writeFile(wb, `FleetCard_Summary_${monthLabel.replace(/\s/g, "_")}.xlsx`);
      showToast("Fleet card summary exported");
    };

    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a" }}>Fleet Card Summary</div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>Monthly transaction totals per fleet card</div>
          </div>
          {cards.length > 0 && (
            <button onClick={exportCardSummary} style={{
              padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
              background: "#16a34a", color: "white", border: "none",
            }}>{"\uD83D\uDCE5"} Export Excel</button>
          )}
        </div>

        {/* Month selector */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 16,
          marginBottom: 20, padding: "10px 16px", background: "white",
          border: "1px solid #e2e8f0", borderRadius: 10,
        }}>
          <button onClick={prevMonth} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#64748b" }}>{"\u25C0"}</button>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>{monthLabel}</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>{cards.length} cards {"\u00B7"} {monthEntries.length} transactions</div>
          </div>
          <button onClick={nextMonth} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#64748b" }}>{"\u25B6"}</button>
        </div>

        {/* Grand totals */}
        {cards.length > 0 && (
          <div className="kpi-grid-3" style={{ marginBottom: 20 }}>
            {[
              { label: "Total Spend", value: `$${grandTotal.toFixed(2)}`, color: "#0f172a" },
              { label: "Total Litres", value: `${grandLitres.toFixed(0)}L`, color: "#0f172a" },
              { label: "Vehicles", value: cards.length, color: "#16a34a" },
            ].map(s => (
              <div key={s.label} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 10px", textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2, fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        {cards.length > 0 && (
          <div style={{ marginBottom: 16, position: "relative" }}>
            <input
              value={cardSearch} onChange={e => setCardSearch(e.target.value)}
              placeholder="Search by rego, driver, or card number..."
              style={{
                width: "100%", padding: "10px 12px 10px 34px", borderRadius: 8, border: "1px solid #e2e8f0",
                fontSize: 13, outline: "none", fontFamily: "inherit", color: "#0f172a",
              }}
              onFocus={e => e.target.style.borderColor = "#22c55e"}
              onBlur={e => e.target.style.borderColor = "#e2e8f0"}
            />
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: "#94a3b8" }}>{"\uD83D\uDD0D"}</span>
            {cardSearch && (
              <button onClick={() => setCardSearch("")} style={{
                position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 16,
              }}>{"\u00D7"}</button>
            )}
            {cardSearchTerm && (
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 6 }}>
                Showing {filteredCards.length} of {cards.length} card{cards.length !== 1 ? "s" : ""} matching "<strong>{cardSearch}</strong>"
                <button onClick={() => setCardSearch("")} style={{
                  background: "none", border: "none", color: "#16a34a", cursor: "pointer", fontSize: 11, fontFamily: "inherit", fontWeight: 600, marginLeft: 8,
                }}>Clear</button>
              </div>
            )}
          </div>
        )}

        {/* Card list */}
        {filteredCards.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>{"\uD83D\uDCB3"}</div>
            <div style={{ fontWeight: 500 }}>{cardSearchTerm ? `No cards matching "${cardSearch}"` : `No fleet card transactions for ${monthLabel}`}</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>{cardSearchTerm ? "Try a different rego or driver name" : "Entries with fleet card numbers will appear here"}</div>
          </div>
        ) : (
          filteredCards.map(c => (
            <div key={c.rego} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, marginBottom: 12, overflow: "hidden" }}>
              {/* Card header — grouped by rego */}
              <div style={{
                padding: "12px 14px", background: "#fff7ed", borderBottom: "1px solid #fdba74",
                display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {isAdmin && editingCard?.oldRego === c.rego ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 10, color: "#64748b", fontWeight: 600, width: 55 }}>Rego:</span>
                        <input value={editingCard.newRego} onChange={e => setEditingCard(p => ({ ...p, newRego: e.target.value.toUpperCase() }))}
                          style={{ flex: 1, padding: "4px 8px", borderRadius: 5, border: "1px solid #fdba74", fontSize: 12, fontFamily: "inherit", outline: "none", color: "#0f172a", textTransform: "uppercase" }} />
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 10, color: "#64748b", fontWeight: 600, width: 55 }}>Card #:</span>
                        <input value={formatCardNumber(editingCard.newCard)} onChange={e => setEditingCard(p => ({ ...p, newCard: e.target.value.replace(/\s/g, "") }))}
                          style={{ flex: 1, padding: "4px 8px", borderRadius: 5, border: "1px solid #fdba74", fontSize: 12, fontFamily: "inherit", outline: "none", color: "#0f172a" }} />
                      </div>
                      <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                        <button onClick={async () => {
                          await updateCardDetails(editingCard.oldCard, editingCard.newCard, editingCard.newRego);
                          setEditingCard(null);
                        }} style={{ padding: "4px 12px", borderRadius: 5, fontSize: 10, fontWeight: 700, background: "#16a34a", color: "white", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Save</button>
                        <button onClick={() => setEditingCard(null)} style={{ padding: "4px 12px", borderRadius: 5, fontSize: 10, fontWeight: 600, background: "white", color: "#64748b", border: "1px solid #e2e8f0", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#c2410c", display: "flex", alignItems: "center", gap: 6 }}>
                        {"\uD83D\uDE9A"} {c.rego}
                        {isAdmin && (
                          <button onClick={() => setEditingCard({ oldRego: c.rego, oldCard: [...c.cards][0] || "", newCard: [...c.cards][0] || "", newRego: c.rego })}
                            title="Edit card details" style={{ background: "none", border: "none", color: "#c2410c", cursor: "pointer", fontSize: 12, padding: "0 4px", opacity: 0.6 }}>{"\u270E"}</button>
                        )}
                      </div>
                      <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>
                        {[...c.drivers].join(", ")}{c.cards.size > 0 ? ` \u00B7 ${[...c.cards].map(cn => `...${cn.slice(-6)}`).join(", ")}` : ""}
                      </div>
                    </>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>${c.totalCost.toFixed(2)}</div>
                    <div style={{ fontSize: 10, color: "#64748b" }}>{c.totalLitres.toFixed(1)}L {"\u00B7"} {c.entries.length} txns</div>
                  </div>
                  <button onClick={() => {
                    const wb = XLSX.utils.book_new();
                    const rows = [
                      [`Rego: ${c.rego}`, "", "", "", "", monthLabel],
                      [`Card(s): ${[...c.cards].map(cn => formatCardNumber(cn)).join(", ") || "\u2014"}`],
                      [`Drivers: ${[...c.drivers].join(", ")}`],
                      [],
                      ["Date", "Driver", "Station", "Litres", "$/L", "Cost ($)", "Fuel Type", "Division", "Type", "Card"],
                    ];
                    c.entries.forEach(e => {
                      rows.push([
                        e.date || "", e.driverName || "",
                        e.station || "", e.litres || "", e.pricePerLitre || "",
                        e.totalCost ? Math.round(e.totalCost * 100) / 100 : "",
                        e.fuelType || "", e.division || "", e.vehicleType || e.entryType || "",
                        e.fleetCardNumber ? `...${e.fleetCardNumber.slice(-6)}` : "",
                      ]);
                    });
                    rows.push([]);
                    rows.push(["", "", "TOTAL", c.totalLitres.toFixed(2), "", Math.round(c.totalCost * 100) / 100]);
                    const ws = XLSX.utils.aoa_to_sheet(rows);
                    ws["!cols"] = [{wch:12},{wch:18},{wch:20},{wch:8},{wch:7},{wch:10},{wch:14},{wch:10},{wch:12},{wch:12}];
                    XLSX.utils.book_append_sheet(wb, ws, "Transactions");
                    XLSX.writeFile(wb, `FleetCard_${c.rego}_${monthLabel.replace(/\s/g, "_")}.xlsx`);
                    showToast(`Exported ${c.rego}`);
                  }} title="Download this rego" style={{
                    padding: "6px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                    cursor: "pointer", fontFamily: "inherit",
                    background: "#c2410c", color: "white", border: "none", flexShrink: 0,
                  }}>{"\uD83D\uDCE5"}</button>
                </div>
              </div>

              {/* Transaction table */}
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr style={{ background: "#fafafa" }}>
                      <th style={{ color: "#374151", borderBottom: "1px solid #e2e8f0" }}>Date</th>
                      <th style={{ color: "#374151", borderBottom: "1px solid #e2e8f0" }}>Driver</th>
                      <th style={{ color: "#374151", borderBottom: "1px solid #e2e8f0" }}>Rego / Item</th>
                      <th style={{ color: "#374151", borderBottom: "1px solid #e2e8f0" }}>Station</th>
                      <th style={{ color: "#374151", borderBottom: "1px solid #e2e8f0" }}>Litres</th>
                      <th style={{ color: "#374151", borderBottom: "1px solid #e2e8f0" }}>$/L</th>
                      <th style={{ color: "#374151", borderBottom: "1px solid #e2e8f0" }}>Cost</th>
                      {isAdmin && <th style={{ color: "#374151", borderBottom: "1px solid #e2e8f0", width: 50 }}></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {c.entries.map(e => (
                      <tr key={e.id}>
                        <td style={{ color: "#374151" }}>{e.date || "\u2014"}</td>
                        <td style={{ color: "#374151" }}>{e.driverName || "\u2014"}</td>
                        <td style={{ fontWeight: 600, color: "#0f172a" }}>
                          {e.entryType === "other" ? (e.equipment || "Other") : (e.registration || "\u2014")}
                        </td>
                        <td style={{ color: "#64748b", fontSize: 10 }}>{e.station || "\u2014"}</td>
                        <td style={{ color: "#374151" }}>{e.litres ? `${e.litres}L` : "\u2014"}</td>
                        <td style={{ color: "#64748b" }}>{e.pricePerLitre ? `$${e.pricePerLitre}` : "\u2014"}</td>
                        <td style={{ fontWeight: 600, color: "#16a34a" }}>{e.totalCost ? `$${e.totalCost.toFixed(2)}` : "\u2014"}</td>
                        {isAdmin && (
                          <td style={{ whiteSpace: "nowrap" }}>
                            <button onClick={() => setEditingEntry(e)} title="Edit" style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 12, lineHeight: 1, padding: "2px 4px" }}>{"\u270E"}</button>
                            <button onClick={() => setConfirmAction({ message: `Delete this entry for ${e.registration || e.equipment || "unknown"} on ${e.date || "unknown date"}? This will remove it from all sections (Data, Fleet Cards, Dashboard).`, onConfirm: async () => { await deleteEntry(e.id); setConfirmAction(null); } })} title="Delete" style={{ background: "none", border: "none", color: "#cbd5e1", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "2px 4px" }}>{"\u00D7"}</button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {/* Total row */}
                    <tr style={{ background: "#f8fafc", borderTop: "2px solid #e2e8f0" }}>
                      <td colSpan={4} style={{ fontWeight: 700, color: "#374151", textAlign: "right" }}>Card Total:</td>
                      <td style={{ fontWeight: 700, color: "#0f172a" }}>{c.totalLitres.toFixed(1)}L</td>
                      <td></td>
                      <td style={{ fontWeight: 700, color: "#16a34a" }}>${c.totalCost.toFixed(2)}</td>
                      {isAdmin && <td></td>}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}

        {/* Learned Card Corrections — admin section showing what the system has learned */}
        {isAdmin && (() => {
          // Multiple keys often point at the same target — manual entries
          // are stored under both a rego-key and the full-card-key; auto-
          // learned entries can have full-card + legacy-suffix keys. Dedupe
          // by (correctRego, correctCard) so the admin sees one row per
          // taught card. Prefer entries with higher confirmCount so the
          // "most trusted" representation wins the display slot.
          const rawMappingEntries = Object.entries(learnedCardMappings);
          const seenByTarget = new Map();
          for (const [key, m] of rawMappingEntries) {
            const uniqKey = `${(m?.correctRego || "").toUpperCase()}|${(m?.correctCard || "").replace(/\s/g, "")}`;
            const prev = seenByTarget.get(uniqKey);
            if (!prev || (m?.confirmCount || 0) > (prev[1].confirmCount || 0)) {
              seenByTarget.set(uniqKey, [key, m]);
            }
          }
          const mappingEntries = [...seenByTarget.values()]
            .sort(([ a], [ b]) => (a.correctRego || "").localeCompare(b.correctRego || ""));
          if (mappingEntries.length === 0) return null;
          return (
            <div style={{ marginTop: 28 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>{"\uD83E\uDDE0"} Learned Card Corrections</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                    The system has learned {mappingEntries.length} correction{mappingEntries.length !== 1 ? "s" : ""} from manual edits. These auto-apply on future scans.
                  </div>
                </div>
                <button onClick={() => setConfirmAction({
                  message: `Clear all ${mappingEntries.length} learned card corrections? The system will go back to fuzzy matching only.`,
                  onConfirm: () => { persistCardMappings({}); setConfirmAction(null); showToast("Learned corrections cleared"); }
                })} style={{
                  padding: "6px 12px", borderRadius: 6, fontSize: 10, fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
                  background: "white", color: "#dc2626", border: "1px solid #fecaca",
                }}>Clear All</button>
              </div>
              <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
                <table className="data-table">
                  <thead>
                    <tr style={{ background: "#fafafa" }}>
                      <th style={{ color: "#374151", borderBottom: "1px solid #e2e8f0" }}>Rego</th>
                      <th style={{ color: "#374151", borderBottom: "1px solid #e2e8f0" }}>AI Misread</th>
                      <th style={{ color: "#374151", borderBottom: "1px solid #e2e8f0" }}>Corrected To</th>
                      <th style={{ color: "#374151", borderBottom: "1px solid #e2e8f0" }}>Learned</th>
                      <th style={{ color: "#374151", borderBottom: "1px solid #e2e8f0", width: 40 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappingEntries.map(([key, m]) => (
                      <tr key={key}>
                        <td style={{ fontWeight: 600, color: "#0f172a", fontSize: 12 }}>
                          {m.correctRego || "\u2014"}
                          {m.manual && (
                            <span style={{
                              marginLeft: 6, padding: "1px 6px", fontSize: 9, fontWeight: 700,
                              background: "#e0f7fa", color: "#0891b2", border: "1px solid #7dd3fc",
                              borderRadius: 3, textTransform: "uppercase", letterSpacing: "0.04em",
                            }}>Manual</span>
                          )}
                        </td>
                        <td style={{ color: "#dc2626", fontSize: 11, fontFamily: "monospace" }}>
                          {m.manual ? <span style={{ color: "#94a3b8", fontStyle: "italic" }}>n/a</span> : (m.rawCard ? `...${m.rawCard.slice(-8)}` : m.rawRego || key)}
                        </td>
                        <td style={{ color: "#16a34a", fontSize: 11, fontFamily: "monospace", fontWeight: 600 }}>
                          ...{m.correctCard?.slice(-8) || "?"}
                        </td>
                        <td style={{ color: "#64748b", fontSize: 10 }}>
                          {m.learnedAt ? new Date(m.learnedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" }) : "\u2014"}
                        </td>
                        <td>
                          <button onClick={() => {
                            // Remove every key whose target matches this row's
                            // (correctRego, correctCard) so manual entries
                            // stored under both rego + card keys disappear
                            // together rather than leaving a stale row.
                            const targetRego = (m.correctRego || "").toUpperCase();
                            const targetCard = (m.correctCard || "").replace(/\s/g, "");
                            const rest = Object.fromEntries(
                              Object.entries(learnedCardMappings).filter(([ v]) => {
                                const vRego = (v?.correctRego || "").toUpperCase();
                                const vCard = (v?.correctCard || "").replace(/\s/g, "");
                                return !(vRego === targetRego && vCard === targetCard);
                              })
                            );
                            persistCardMappings(rest);
                            showToast("Correction removed");
                          }} title="Remove this correction" style={{
                            background: "none", border: "none", color: "#cbd5e1", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "2px 4px",
                          }}>{"\u00D7"}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
      </div>
    );
  };

  // ── Settings ──────────────────────────────────────────────────────────────
  const renderSettings = () => (
    <div className="fade-in">
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>Settings</div>
        <div style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>Configure your Anthropic API key for AI image scanning</div>
      </div>
      <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, padding: 16, marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8, letterSpacing: "0.04em", textTransform: "uppercase" }}>Anthropic API Key</label>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <input type={showKey ? "text" : "password"} value={apiKeyInput}
              onChange={e => setApiKeyInput(e.target.value)} placeholder="sk-ant-..."
              style={{ width: "100%", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "9px 40px 9px 12px", fontSize: 13, fontFamily: "inherit", color: "#0f172a", outline: "none" }} />
            <button onClick={() => setShowKey(s => !s)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>
              {showKey ? "hide" : "show"}
            </button>
          </div>
          <button onClick={async () => {
            await window.storage.set("fuel_api_key", apiKeyInput).catch(() => {});
            await db.saveSetting("anthropic_api_key", apiKeyInput);
            setApiKey(apiKeyInput); showToast("API key saved (shared with all devices)");
          }} style={{ padding: "9px 16px", background: "#16a34a", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>Save</button>
        </div>
        <div style={{ fontSize: 11, color: "#94a3b8" }}>Shared across all devices via cloud {"\u00B7"} only sent to Anthropic for scanning {"\u00B7"} get a key at console.anthropic.com</div>
        {apiKey && <div style={{ fontSize: 12, color: "#15803d", marginTop: 6, fontWeight: 500 }}>{"\u2713"} API key is set</div>}
      </div>

      {/* \u2500\u2500 Model selector per task \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
          Different scan tasks have very different cost/accuracy needs.
          Orientation just needs "is this rotated?" \u2014 Haiku handles it
          for ~25x less than Opus. Receipt scanning is the heavy one;
          admin can leave it on Sonnet 4.5 for normal use and bump up
          to Opus only if a particular fleet's receipts get mis-read. */}
      {(() => {
        const persistApiModels = async (next) => {
          setApiModels(next);
          const json = JSON.stringify(next);
          try { await window.storage.set("fuel_api_models", json); } catch (_) {}
          try { await db.saveSetting("api_models", json); } catch (_) {}
        };
        const setOne = (task, modelId) => {
          persistApiModels({ ...apiModels, [task]: modelId });
        };
        const tasks = ["orientation", "receipt", "card"];
        return (
          <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", letterSpacing: "0.04em", textTransform: "uppercase" }}>Models per task</div>
              <button
                onClick={() => persistApiModels({ ...DEFAULT_API_MODELS })}
                title="Reset all three tasks to the recommended defaults"
                style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 500, background: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0", cursor: "pointer", fontFamily: "inherit" }}
              >Reset to defaults</button>
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
              Pick which Claude vision model handles each scan. Defaults to Opus 4.7 across the board ($5/$25 per Mtok — best accuracy without the old-Opus price). For tighter cost: flip Orientation to Haiku 4.5 (a ~5x savings on that task with no accuracy hit).
            </div>
            {tasks.map(task => {
              const meta = API_TASK_LABELS[task];
              const current = apiModels[task] || DEFAULT_API_MODELS[task];
              const isCustom = !CLAUDE_MODEL_OPTIONS.find(m => m.id === current);
              const currentMeta = CLAUDE_MODEL_OPTIONS.find(m => m.id === current);
              return (
                <div key={task} style={{ marginBottom: 14, padding: "10px 12px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{meta.label}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>{currentMeta ? currentMeta.tier : "custom"}</div>
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>{meta.desc}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {CLAUDE_MODEL_OPTIONS.map(opt => {
                      const sel = opt.id === current;
                      const tierBg = opt.tier === "fast" ? "#f0fdf4" : opt.tier === "balanced" ? "#eff6ff" : "#fef3c7";
                      const tierBorder = opt.tier === "fast" ? "#86efac" : opt.tier === "balanced" ? "#93c5fd" : "#fcd34d";
                      const tierText = opt.tier === "fast" ? "#15803d" : opt.tier === "balanced" ? "#1e40af" : "#92400e";
                      return (
                        <button
                          key={opt.id}
                          onClick={() => setOne(task, opt.id)}
                          title={opt.note}
                          style={{
                            padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                            background: sel ? tierBg : "white",
                            color: sel ? tierText : "#64748b",
                            border: `1.5px solid ${sel ? tierBorder : "#e2e8f0"}`,
                            cursor: "pointer", fontFamily: "inherit",
                          }}
                        >{opt.label}</button>
                      );
                    })}
                    <button
                      onClick={() => {
                        const custom = window.prompt(
                          `Custom model id for "${meta.label}"\n\nEnter any Anthropic model id (e.g. claude-opus-4-7-20251015). Leave blank to keep current.`,
                          isCustom ? current : ""
                        );
                        if (custom && custom.trim()) setOne(task, custom.trim());
                      }}
                      title="Type any model id by hand \u2014 useful for new releases not in the dropdown yet."
                      style={{
                        padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                        background: isCustom ? "#fef3c7" : "white",
                        color: isCustom ? "#92400e" : "#94a3b8",
                        border: `1.5px solid ${isCustom ? "#fcd34d" : "#e2e8f0"}`,
                        cursor: "pointer", fontFamily: "inherit",
                      }}
                    >{isCustom ? `Custom: ${current.replace(/^claude-/, "")}` : "Custom\u2026"}</button>
                  </div>
                  {currentMeta && (
                    <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 6, fontStyle: "italic" }}>{currentMeta.note}</div>
                  )}
                </div>
              );
            })}
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
              Changes save instantly and sync to all devices. Each receipt submission usually fires orientation + receipt (so 2 calls); a low-confidence scan can trigger a 3rd retry on the receipt model.
            </div>
          </div>
        );
      })()}

      {/* ── Fuel-usage flag thresholds ─────────────────────────────────
          The "High fuel usage" / "Low fuel usage" flags compare each
          fill-up's L/100km (road) or L/hr (hours-based) against a
          per-vehicle-type ceiling and floor. Defaults are tuned for
          tree-care work — heavy loads, stop-start traffic, full days
          of equipment running — so they only fire on egregious outliers.
          Admin can tune per type here if a particular fleet pattern
          calls for tighter or looser bounds. Saved to Supabase so all
          devices see the same values. */}
      {(() => {
        const persistThresholds = async (next) => {
          setEfficiencyThresholds(next);
          // Only persist the customised types to keep the saved blob
          // small and let the defaults silently track future changes
          // to DEFAULT_EFFICIENCY_RANGES.
          const partial = {};
          for (const [vt, r] of Object.entries(next)) {
            const def = DEFAULT_EFFICIENCY_RANGES[vt];
            if (!def || r.low !== def.low || r.high !== def.high) partial[vt] = r;
          }
          const json = JSON.stringify(partial);
          try { await window.storage.set("fuel_efficiency_thresholds", json); } catch (_) {}
          try { await db.saveSetting("efficiency_thresholds", json); } catch (_) {}
        };
        const setOne = (vt, key, displayValue) => {
          const def = DEFAULT_EFFICIENCY_RANGES[vt] || DEFAULT_EFFICIENCY_RANGES.Other;
          const isHrs = def.unit === "L/hr";
          // Road vehicles are stored as L/km internally but displayed as
          // L/100km in the UI. Convert back on save: L/100km / 100 = L/km.
          const stored = isHrs ? Number(displayValue) : Number(displayValue) / 100;
          if (!Number.isFinite(stored) || stored <= 0) return;
          const current = efficiencyThresholds[vt] || def;
          persistThresholds({ ...efficiencyThresholds, [vt]: { ...current, [key]: stored } });
        };
        const resetOne = (vt) => {
          const def = DEFAULT_EFFICIENCY_RANGES[vt];
          if (!def) return;
          persistThresholds({ ...efficiencyThresholds, [vt]: { ...def } });
        };
        const resetAll = () => persistThresholds({ ...DEFAULT_EFFICIENCY_RANGES });
        // Display-format helpers: road = L/100km (familiar to AU fleet
        // managers); hours-based = L/hr.
        const fmt = (val, isHrs) => isHrs
          ? Number(val).toFixed(val < 10 ? 1 : 0)
          : Number(val * 100).toFixed(val * 100 < 10 ? 1 : 0);
        const types = Object.keys(DEFAULT_EFFICIENCY_RANGES);
        // Only `high` is user-editable now (low no longer flags), so the
        // master Reset button reflects whether any high has been edited
        // away from defaults — pre-existing low overrides on stored data
        // are left alone but don't count toward "custom" here.
        const anyCustom = types.some(vt => {
          const cur = efficiencyThresholds[vt];
          const def = DEFAULT_EFFICIENCY_RANGES[vt];
          return cur && def && cur.high !== def.high;
        });
        return (
          <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", letterSpacing: "0.04em", textTransform: "uppercase" }}>Fuel-usage flag thresholds</div>
              <button
                onClick={resetAll}
                disabled={!anyCustom}
                title="Reset every vehicle type back to the factory defaults"
                style={{
                  padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 500,
                  background: anyCustom ? "#f8fafc" : "#f1f5f9",
                  color: anyCustom ? "#64748b" : "#cbd5e1",
                  border: "1px solid #e2e8f0", cursor: anyCustom ? "pointer" : "default", fontFamily: "inherit",
                }}
              >Reset all to defaults</button>
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
              An entry flags as <b>High fuel usage</b> when it exceeds the high value for its vehicle type. Defaults catch only egregious outliers — tighten if you want to surface more entries, loosen if you're getting noise. (Low-end thresholds aren't shown because "low fuel usage" is no longer flagged.)
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(120px, 1.4fr) minmax(80px, 1fr) auto", gap: 8, alignItems: "center", fontSize: 11, color: "#94a3b8", marginBottom: 6, paddingBottom: 6, borderBottom: "1px solid #f1f5f9" }}>
              <div style={{ fontWeight: 600 }}>Vehicle type</div>
              <div style={{ fontWeight: 600 }}>High</div>
              <div></div>
            </div>
            {types.map(vt => {
              const def = DEFAULT_EFFICIENCY_RANGES[vt];
              const cur = efficiencyThresholds[vt] || def;
              const isHrs = def.unit === "L/hr";
              const unitLabel = isHrs ? "L/hr" : "L/100km";
              // Only flag custom on `high` now — `low` no longer drives any
              // flag, so an admin who edited a low value in a previous build
              // shouldn't see this row marked "custom" (and shouldn't be
              // able to reset something they can't see).
              const isCustom = cur.high !== def.high;
              return (
                <div key={vt} style={{ display: "grid", gridTemplateColumns: "minmax(120px, 1.4fr) minmax(80px, 1fr) auto", gap: 8, alignItems: "center", padding: "6px 0" }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#0f172a" }}>
                    {vt}
                    <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: 6, fontWeight: 400 }}>{unitLabel}</span>
                  </div>
                  <input
                    type="number"
                    step={isHrs ? "0.5" : "1"}
                    min="0"
                    defaultValue={fmt(cur.high, isHrs)}
                    onBlur={e => {
                      const v = e.target.value;
                      if (v === "" || Number(v) === Number(fmt(cur.high, isHrs))) return;
                      setOne(vt, "high", v);
                    }}
                    style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: "5px 8px", fontSize: 12, fontFamily: "inherit", color: isCustom ? "#1e40af" : "#0f172a", outline: "none", width: "100%", fontWeight: isCustom ? 600 : 400 }}
                  />
                  <button
                    onClick={() => resetOne(vt)}
                    disabled={!isCustom}
                    title={isCustom ? `Reset ${vt} high to default (${fmt(def.high, isHrs)} ${unitLabel})` : "Already at default"}
                    style={{
                      padding: "4px 8px", borderRadius: 6, fontSize: 10, fontWeight: 500,
                      background: "transparent",
                      color: isCustom ? "#64748b" : "#cbd5e1",
                      border: "1px solid " + (isCustom ? "#e2e8f0" : "#f1f5f9"),
                      cursor: isCustom ? "pointer" : "default", fontFamily: "inherit", whiteSpace: "nowrap",
                    }}
                  >Reset</button>
                </div>
              );
            })}
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 10 }}>
              Edits save on tab-out. Road vehicles are entered in L/100km (Australian convention); plant/equipment in L/hr. Changes sync to all devices.
            </div>
          </div>
        );
      })()}

      {/* ── Driver auto-fill profiles ───────────────────────────────────
          For management / single-vehicle drivers who always use the same
          rego + fleet card. Admin creates a profile here keyed by the
          driver's name; once that driver enters their name on Step 1 of
          a submission (on any device), the form auto-fills and the
          fleet-card photo step is skipped. Profiles sync via Supabase so
          admin can manage from anywhere — no need to walk up to each
          phone. */}
      {(() => {
        // Save / overwrite a profile keyed by lowercase name.
        const saveProfile = async (data) => {
          const fullName = (data.name || "").trim();
          if (!fullName) { showToast("Driver name required"); return false; }
          const key = fullName.toLowerCase();
          const next = { ...driverProfiles };
          // If admin renamed an existing profile, drop the old key first.
          if (data.original && data.original !== key) delete next[data.original];
          next[key] = {
            name: fullName,
            rego: (data.rego || "").trim().toUpperCase(),
            division: data.division || "",
            vehicleType: data.vehicleType || "",
            cardNumber: (data.cardNumber || "").replace(/\s/g, ""),
            cardRego: (data.cardRego || "").trim().toUpperCase(),
          };
          await persistDriverProfiles(next);
          showToast(`Profile saved for ${fullName}`);
          return true;
        };
        const removeProfile = (key) => {
          const profile = driverProfiles[key];
          if (!profile) return;
          setConfirmAction({
            message: `Remove auto-fill profile for "${profile.name}"?\n\nTheir entries stay untouched — only the saved defaults are deleted. They'll go back to manually entering vehicle and card details on each submission.`,
            onConfirm: async () => {
              const next = { ...driverProfiles };
              delete next[key];
              await persistDriverProfiles(next);
              setConfirmAction(null);
              showToast(`Profile removed for ${profile.name}`);
            },
          });
        };
        const profileEntries = Object.entries(driverProfiles).sort((a, b) => a[1].name.localeCompare(b[1].name));
        const allDivisions = Object.keys(DIVISIONS);
        const editing = profileEditing;
        const editTypes = editing?.division ? (DIVISIONS[editing.division]?.types || []) : ALL_VEHICLE_TYPES;
        return (
          <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", letterSpacing: "0.04em", textTransform: "uppercase" }}>Driver auto-fill profiles</div>
              {!editing && (
                <button
                  onClick={() => setProfileEditing({ isNew: true, name: "", rego: "", division: "", vehicleType: "", cardNumber: "", cardRego: "" })}
                  title="Create a new auto-fill profile for a single-vehicle driver"
                  style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: "#16a34a", color: "white", border: "none", cursor: "pointer", fontFamily: "inherit" }}
                >+ Add profile</button>
              )}
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
              Saved drivers (e.g. management who always use one ute + one card) skip the fleet-card photo step on submission. The receipt photo is still required. Profiles sync to all devices via the cloud.
            </div>

            {/* Add / edit form */}
            {editing && (
              <div className="fade-in" style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 10 }}>
                  {editing.isNew ? "New profile" : `Editing "${editing.name}"`}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 10, color: "#64748b", fontWeight: 600, marginBottom: 3 }}>Driver name (full)</label>
                    <input value={editing.name} onChange={e => setProfileEditing({ ...editing, name: e.target.value })}
                      placeholder="e.g. Bob Smith"
                      style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, outline: "none", fontFamily: "inherit", color: "#0f172a" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 10, color: "#64748b", fontWeight: 600, marginBottom: 3 }}>Default rego</label>
                    <input value={editing.rego} onChange={e => setProfileEditing({ ...editing, rego: e.target.value.toUpperCase() })}
                      placeholder="e.g. CD36PH"
                      style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, outline: "none", fontFamily: "inherit", color: "#0f172a" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 10, color: "#64748b", fontWeight: 600, marginBottom: 3 }}>Division</label>
                    <select value={editing.division} onChange={e => setProfileEditing({ ...editing, division: e.target.value, vehicleType: "" })}
                      style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, outline: "none", fontFamily: "inherit", color: "#0f172a", background: "white" }}>
                      <option value="">— select —</option>
                      {allDivisions.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 10, color: "#64748b", fontWeight: 600, marginBottom: 3 }}>Vehicle type</label>
                    <select value={editing.vehicleType} onChange={e => setProfileEditing({ ...editing, vehicleType: e.target.value })}
                      style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, outline: "none", fontFamily: "inherit", color: "#0f172a", background: "white" }}>
                      <option value="">— select —</option>
                      {editTypes.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 10, color: "#64748b", fontWeight: 600, marginBottom: 3 }}>Fleet card number</label>
                    <input value={formatCardNumber(editing.cardNumber)} onChange={e => setProfileEditing({ ...editing, cardNumber: e.target.value.replace(/\s/g, "") })}
                      placeholder="7034 3051 …"
                      style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, outline: "none", fontFamily: "inherit", color: "#0f172a" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 10, color: "#64748b", fontWeight: 600, marginBottom: 3 }}>Card rego (usually same as vehicle)</label>
                    <input value={editing.cardRego} onChange={e => setProfileEditing({ ...editing, cardRego: e.target.value.toUpperCase() })}
                      placeholder="e.g. CD36PH"
                      style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, outline: "none", fontFamily: "inherit", color: "#0f172a" }} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button onClick={async () => { const ok = await saveProfile(editing); if (ok) setProfileEditing(null); }}
                    style={{ padding: "7px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: "#16a34a", color: "white", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Save profile</button>
                  <button onClick={() => setProfileEditing(null)}
                    style={{ padding: "7px 14px", borderRadius: 6, fontSize: 12, fontWeight: 500, background: "white", color: "#64748b", border: "1px solid #e2e8f0", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                </div>
              </div>
            )}

            {/* List */}
            {profileEntries.length === 0 && !editing && (
              <div style={{ fontSize: 12, color: "#94a3b8", padding: "8px 0", fontStyle: "italic" }}>
                No profiles yet — click "+ Add profile" to set one up.
              </div>
            )}
            {profileEntries.map(([key, p]) => (
              <div key={key} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "8px 10px", marginBottom: 6, background: "#f8fafc",
                borderRadius: 8, border: "1px solid #e2e8f0",
              }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>{p.name}</div>
                  <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>
                    {[
                      p.rego && `${p.rego}`,
                      p.vehicleType && `${p.vehicleType}`,
                      p.division && `${p.division}`,
                      p.cardNumber && `card …${p.cardNumber.slice(-4)}`,
                    ].filter(Boolean).join("  ·  ") || "(no defaults set)"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => setProfileEditing({ isNew: false, original: key, ...p })}
                    title="Edit this profile"
                    style={{ padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: 500, background: "white", color: "#2563eb", border: "1px solid #bfdbfe", cursor: "pointer", fontFamily: "inherit" }}>Edit</button>
                  <button onClick={() => removeProfile(key)}
                    title="Delete this profile (entries stay untouched)"
                    style={{ padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: 500, background: "white", color: "#dc2626", border: "1px solid #fecaca", cursor: "pointer", fontFamily: "inherit" }}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* ── Merge driver names ───────────────────────────────────────
          Auto-resolution at submission time can't catch every nickname
          / typo / spelling drift. This card lets the admin do bulk
          renames + register the alias for future submissions, so a
          variant only has to be cleaned up once. */}
      {(() => {
        // Build a unique driver-name list with entry counts. Sort by
        // entry count desc so the most-used names land at the top.
        const counts = {};
        for (const e of entries) {
          const dn = (e.driverName || e.driver || "").trim();
          if (!dn) continue;
          counts[dn] = (counts[dn] || 0) + 1;
        }
        const uniqueNames = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
        // Case-insensitive count lookup — admin might type "joe hirst"
        // when entries store "Joe Hirst", and we still want to show the
        // accurate preview count.
        const fromTrim = (mergeFrom || "").trim();
        const fromLower = fromTrim.toLowerCase();
        const fromCount = fromLower
          ? Object.entries(counts).reduce((s, [n, c]) => n.toLowerCase() === fromLower ? s + c : s, 0)
          : 0;
        const previewClean = fromTrim && mergeTo.trim() && fromLower !== mergeTo.trim().toLowerCase();
        return (
          <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 4 }}>Merge driver names</div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
              Combine alternate spellings or nicknames into one canonical name. Updates existing entries AND remembers the alias so future submissions auto-resolve.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, alignItems: "end", marginBottom: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>Merge name</label>
                <input
                  type="text"
                  value={mergeFrom}
                  onChange={e => setMergeFrom(e.target.value)}
                  placeholder="Type or pick a name to merge"
                  list="merge-from-suggestions"
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, fontFamily: "inherit", color: "#0f172a", outline: "none", boxSizing: "border-box" }}
                />
                <datalist id="merge-from-suggestions">
                  {uniqueNames.map(([n, c]) => (
                    <option key={n} value={n}>{c} {c === 1 ? "entry" : "entries"}</option>
                  ))}
                </datalist>
              </div>
              <div style={{ fontSize: 18, color: "#94a3b8", fontWeight: 700, paddingBottom: 9 }}>{"→"}</div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>Into (canonical name)</label>
                <input
                  type="text"
                  value={mergeTo}
                  onChange={e => setMergeTo(e.target.value)}
                  placeholder="Type the canonical name"
                  list="merge-to-suggestions"
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, fontFamily: "inherit", color: "#0f172a", outline: "none", boxSizing: "border-box" }}
                />
                <datalist id="merge-to-suggestions">
                  {uniqueNames.map(([n]) => <option key={n} value={n} />)}
                </datalist>
              </div>
            </div>
            {previewClean && (
              <div style={{ background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#1e40af", marginBottom: 10 }}>
                {fromCount > 0 ? (
                  <>Preview: <strong>{fromCount}</strong> existing entr{fromCount === 1 ? "y" : "ies"} will be renamed from <strong>"{fromTrim}"</strong> to <strong>"{mergeTo.trim()}"</strong>. Future submissions of "{fromTrim}" will also auto-resolve.</>
                ) : (
                  <>No existing entries match <strong>"{fromTrim}"</strong> yet — alias <strong>"{fromTrim}"</strong> {"→"} <strong>"{mergeTo.trim()}"</strong> will still be saved so any future submission of "{fromTrim}" auto-resolves to "{mergeTo.trim()}".</>
                )}
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={async () => {
                  if (!previewClean) return;
                  await mergeDriverNames(mergeFrom, mergeTo);
                  setMergeFrom("");
                  setMergeTo("");
                }}
                disabled={!previewClean}
                style={{
                  padding: "9px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: previewClean ? "#16a34a" : "#f1f5f9",
                  color: previewClean ? "white" : "#94a3b8",
                  border: previewClean ? "1px solid #16a34a" : "1px solid #e2e8f0",
                  cursor: previewClean ? "pointer" : "not-allowed", fontFamily: "inherit",
                }}
              >Merge</button>
              {(mergeFrom || mergeTo) && (
                <button
                  onClick={() => { setMergeFrom(""); setMergeTo(""); }}
                  style={{ padding: "9px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500, background: "white", color: "#64748b", border: "1px solid #e2e8f0", cursor: "pointer", fontFamily: "inherit" }}
                >Clear</button>
              )}
            </div>
            {/* Saved aliases list */}
            {Object.keys(learnedDriverAliases).length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6 }}>
                  Saved aliases · {Object.keys(learnedDriverAliases).length}
                </div>
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
                  {Object.entries(learnedDriverAliases)
                    .sort((a, b) => a[1].localeCompare(b[1]))
                    .map(([from, to], i, arr) => (
                      <div key={from} style={{
                        display: "grid", gridTemplateColumns: "1fr auto 1fr auto", gap: 8, alignItems: "center",
                        padding: "8px 12px", borderBottom: i < arr.length - 1 ? "1px solid #e2e8f0" : "none", fontSize: 12,
                      }}>
                        <span style={{ color: "#64748b", fontStyle: "italic" }}>{from}</span>
                        <span style={{ color: "#94a3b8" }}>{"→"}</span>
                        <span style={{ color: "#0f172a", fontWeight: 600 }}>{to}</span>
                        <button
                          onClick={() => removeDriverAlias(from)}
                          title={`Stop auto-resolving "${from}" to "${to}". Existing renamed entries are NOT reverted.`}
                          style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 500, background: "white", color: "#b91c1c", border: "1px solid #fca5a5", cursor: "pointer", fontFamily: "inherit" }}
                        >Remove</button>
                      </div>
                    ))}
                </div>
              </div>
            )}
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>
              {"•"} Removing an alias only stops future auto-resolution; entries already merged stay renamed (you'd need to re-merge to undo).
            </div>
          </div>
        );
      })()}

      <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 10 }}>Data</div>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>{entries.length} entries {"\u00B7"} {Object.keys(serviceData).length} service records {"\u00B7"} {Object.keys(learnedDB).length} learned vehicles {"\u00B7"} {Object.keys(resolvedFlags).length} resolved issues</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setConfirmAction({
            message: "Delete all fuel entries? This cannot be undone.",
            onConfirm: async () => { for (const e of entries) { db.deleteEntry(e.id).catch(() => {}); } await persist([]); setConfirmAction(null); showToast("All entries deleted"); }
          })} style={{ padding: "8px 16px", background: "#fef2f2", color: "#b91c1c", border: "1px solid #fca5a5", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Clear all entries</button>
          <button onClick={() => setConfirmAction({
            message: "Delete all service records?",
            onConfirm: async () => { await persistService({}); setConfirmAction(null); showToast("Service records deleted"); }
          })} style={{ padding: "8px 16px", background: "#fffbeb", color: "#92400e", border: "1px solid #fcd34d", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Clear service records</button>
          <button onClick={() => setConfirmAction({
            message: "Reset learned vehicle data back to original fleet database? Driver corrections will be lost.",
            onConfirm: async () => { await persistLearned({}); setConfirmAction(null); showToast("Learned data reset"); }
          })} style={{ padding: "8px 16px", background: "#f5f3ff", color: "#6d28d9", border: "1px solid #c4b5fd", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Reset learned data</button>
          {Object.keys(resolvedFlags).length > 0 && (
            <button onClick={() => setConfirmAction({
              message: "Clear all resolved issue history? Issues will reappear as open.",
              onConfirm: async () => { await persistResolved({}); setConfirmAction(null); showToast("Resolved history cleared"); }
            })} style={{ padding: "8px 16px", background: "#f0fdf4", color: "#15803d", border: "1px solid #86efac", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Clear resolved history</button>
          )}
        </div>
      </div>

      {/* Cloud Sync */}
      <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#0891b2", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 10 }}>{"\u2601\uFE0F"} Cloud Sync</div>
        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 10 }}>
          Admin edits sync across all computers automatically — on tab focus, via live push updates, and every minute while open. Tap below to force a refresh now.
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button
            disabled={isSyncing || !supabase}
            onClick={async () => { await refreshFromCloud({ silent: false, force: true }); }}
            style={{
              padding: "8px 16px",
              background: isSyncing ? "#e0f2fe" : "#f0f9ff",
              color: "#0891b2",
              border: "1px solid #7dd3fc",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              cursor: isSyncing || !supabase ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              opacity: supabase ? 1 : 0.5,
            }}
          >{isSyncing ? "Syncing\u2026" : "\uD83D\uDD04 Sync now"}</button>
          <div style={{ fontSize: 11, color: "#64748b" }}>
            {!supabase
              ? "Cloud sync unavailable (no Supabase config)"
              : lastSyncedAt
                ? (() => {
                    const secs = Math.round((Date.now() - lastSyncedAt.getTime()) / 1000);
                    if (secs < 10) return "Last synced: just now";
                    if (secs < 60) return `Last synced: ${secs}s ago`;
                    const mins = Math.round(secs / 60);
                    if (mins < 60) return `Last synced: ${mins} min ago`;
                    return `Last synced: ${lastSyncedAt.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}`;
                  })()
                : "Not yet synced"}
          </div>
        </div>
      </div>

      {/* AI Learning Stats */}
      <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#7c3aed", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 10 }}>{"\uD83E\uDDE0"} AI Learning</div>
        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 10 }}>The AI learns from your corrections to improve future scans automatically.</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
          {[
            { label: "Corrections", value: learnedCorrections.stats?.totalCorrections || 0, color: "#7c3aed" },
            { label: "Stations Learned", value: Object.keys(learnedCorrections.stations || {}).length, color: "#2563eb" },
            { label: "Card Mappings", value: Object.keys(learnedCardMappings || {}).length, color: "#16a34a" },
          ].map(s => (
            <div key={s.label} style={{ background: "#faf5ff", border: "1px solid #e9d5ff", borderRadius: 8, padding: "10px 8px", textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 9, color: "#64748b", marginTop: 2, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>
        {(() => {
          const byField = learnedCorrections.stats?.correctionsByField || {};
          const sorted = Object.entries(byField).sort((a, b) => b[1] - a[1]);
          if (sorted.length === 0) return <div style={{ fontSize: 11, color: "#94a3b8" }}>No corrections recorded yet. Submit entries and the AI will learn from any edits you make.</div>;
          return (
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Top correction types:</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {sorted.map(([field, count]) => (
                  <span key={field} style={{ padding: "3px 8px", borderRadius: 10, fontSize: 10, fontWeight: 600, background: "#f5f3ff", color: "#7c3aed", border: "1px solid #e9d5ff" }}>
                    {field}: {count}
                  </span>
                ))}
              </div>
              {learnedCorrections.stats?.lastUpdated && (
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 8 }}>Last learned: {new Date(learnedCorrections.stats.lastUpdated).toLocaleDateString("en-AU")}</div>
              )}
            </div>
          );
        })()}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={() => setConfirmAction({
            message: "Clear all AI learning data? Station corrections, price history, and digit patterns will be lost. The AI will start learning from scratch.",
            onConfirm: async () => {
              await persistCorrections({ stations: {}, stationPrices: {}, digitPatterns: [], fuelTypeCorrections: {}, stats: { totalCorrections: 0, correctionsByField: {}, lastUpdated: null } });
              setConfirmAction(null);
              showToast("AI learning data cleared");
            }
          })} style={{ padding: "8px 16px", background: "#faf5ff", color: "#7c3aed", border: "1px solid #e9d5ff", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Reset AI learning</button>
        </div>
      </div>

      {/* Teach AI a Fleet Card — pre-register a rego → card-number mapping */}
      <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#0891b2", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 10 }}>{"\uD83D\uDCB3"} Teach AI a Fleet Card</div>
        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 10 }}>
          Pre-teach a card so the scanner can't misread it. Next time this rego is scanned, it's forced to map to the 16-digit number below — overrides fuzzy matching entirely.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div>
            <label style={{ display: "block", fontSize: 10, color: "#64748b", fontWeight: 600, marginBottom: 3 }}>Fleet Card Rego *</label>
            <input
              value={addCard.rego}
              onChange={e => setAddCard(c => ({ ...c, rego: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7) }))}
              placeholder="e.g. DF25LB"
              style={{
                width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 13,
                outline: "none", fontFamily: "inherit", color: "#0f172a", textTransform: "uppercase",
              }}
              onFocus={e => e.target.style.borderColor = "#0891b2"}
              onBlur={e => e.target.style.borderColor = "#e2e8f0"}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 10, color: "#64748b", fontWeight: 600, marginBottom: 3 }}>16-digit Card Number *</label>
            <input
              value={addCard.cardNumber}
              onChange={e => setAddCard(c => ({ ...c, cardNumber: e.target.value.replace(/[^0-9]/g, "").slice(0, 16) }))}
              placeholder="e.g. 7034305117002350"
              inputMode="numeric"
              style={{
                width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 13,
                outline: "none", fontFamily: "monospace", color: "#0f172a", letterSpacing: "0.05em",
              }}
              onFocus={e => e.target.style.borderColor = "#0891b2"}
              onBlur={e => e.target.style.borderColor = "#e2e8f0"}
            />
            {addCard.cardNumber && addCard.cardNumber.length !== 16 && (
              <div style={{ fontSize: 10, color: "#b45309", marginTop: 2 }}>{addCard.cardNumber.length} / 16 digits</div>
            )}
            {addCard.cardNumber.length === 16 && !addCard.cardNumber.startsWith("7034") && (
              <div style={{ fontSize: 10, color: "#dc2626", marginTop: 2 }}>Fleet card numbers always start with 7034</div>
            )}
          </div>
          <div>
            <label style={{ display: "block", fontSize: 10, color: "#64748b", fontWeight: 600, marginBottom: 3 }}>Driver (optional)</label>
            <input
              value={addCard.driver}
              onChange={e => setAddCard(c => ({ ...c, driver: e.target.value }))}
              placeholder="e.g. Kyle Osborne"
              style={{
                width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 13,
                outline: "none", fontFamily: "inherit", color: "#0f172a",
              }}
              onFocus={e => e.target.style.borderColor = "#0891b2"}
              onBlur={e => e.target.style.borderColor = "#e2e8f0"}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 10, color: "#64748b", fontWeight: 600, marginBottom: 3 }}>
              Vehicle Rego <span style={{ color: "#94a3b8", fontWeight: 400 }}>(only if card is embossed with a different rego)</span>
            </label>
            <input
              value={addCard.vehicleRego}
              onChange={e => setAddCard(c => ({ ...c, vehicleRego: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7) }))}
              placeholder="leave blank in 99% of cases"
              style={{
                width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 13,
                outline: "none", fontFamily: "inherit", color: "#0f172a", textTransform: "uppercase",
              }}
              onFocus={e => e.target.style.borderColor = "#0891b2"}
              onBlur={e => e.target.style.borderColor = "#e2e8f0"}
            />
          </div>
        </div>
        <button onClick={() => {
          const cardRego = addCard.rego.trim().toUpperCase();
          const cardNumber = addCard.cardNumber.replace(/\s/g, "");
          const vehicleRego = addCard.vehicleRego.trim().toUpperCase();
          const driver = addCard.driver.trim();
          if (!cardRego || cardRego.length < 2) { showToast("Enter the fleet card rego", "warn"); return; }
          if (cardNumber.length !== 16) { showToast("Card number must be exactly 16 digits", "warn"); return; }
          if (!cardNumber.startsWith("7034")) { showToast("Fleet card numbers always start with 7034", "warn"); return; }

          // Drop any existing mappings pointing at this rego so we don't
          // accumulate stale rawCard-keyed entries when admin re-teaches it.
          const cleaned = Object.fromEntries(
            Object.entries(learnedCardMappings).filter(([_k, v]) =>
              (v?.correctRego || "").toUpperCase() !== cardRego
            )
          );
          const now = new Date().toISOString();
          const mapping = {
            correctCard: cardNumber,
            correctRego: cardRego,
            rawCard: cardNumber,
            rawRego: cardRego,
            learnedAt: now,
            confirmCount: 99, // manual entries are trusted immediately
            manual: true,
            ...(driver ? { driver } : {}),
          };
          // Store under BOTH the rego key (catches scans that only surface a rego)
          // AND the full card number (catches scans where the full card digits
          // are read but the rego is unreadable).
          const next = {
            ...cleaned,
            [`rego_${cardRego}`]: mapping,
            [cardNumber]: mapping,
          };
          persistCardMappings(next);

          // Also register in learnedDB so later lookups + Cards tab find it.
          const targetRego = vehicleRego || cardRego;
          const existing = learnedDB[targetRego] || {};
          const learnedUpdate = { ...existing, c: cardNumber };
          if (driver) learnedUpdate.dr = driver;
          persistLearned({ ...learnedDB, [targetRego]: learnedUpdate });

          showToast(`Fleet card ${cardRego} \u2192 \u2026${cardNumber.slice(-8)} saved`);
          setAddCard({ rego: "", cardNumber: "", driver: "", vehicleRego: "" });
        }} style={{
          marginTop: 12, padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700,
          cursor: "pointer", fontFamily: "inherit",
          background: "#0891b2", color: "white", border: "none", width: "100%",
        }}>Teach AI this Card</button>
      </div>

      {/* Add Vehicle to Learned DB */}
      <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#16a34a", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 10 }}>{"\u2795"} Add Vehicle</div>
        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 10 }}>Manually add or update a vehicle in the system. This overrides the fleet spreadsheet data.</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div>
            <label style={{ display: "block", fontSize: 10, color: "#64748b", fontWeight: 600, marginBottom: 3 }}>Registration *</label>
            <input value={addVehicle.rego} onChange={e => setAddVehicle(v => ({ ...v, rego: e.target.value.toUpperCase() }))} placeholder="e.g. XP86LM" style={{
              width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 13,
              outline: "none", fontFamily: "inherit", color: "#0f172a", textTransform: "uppercase",
            }} onFocus={e => e.target.style.borderColor = "#22c55e"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 10, color: "#64748b", fontWeight: 600, marginBottom: 3 }}>Division *</label>
            <select value={addVehicle.div} onChange={e => setAddVehicle(v => ({ ...v, div: e.target.value }))} style={{
              width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 13,
              fontFamily: "inherit", color: "#0f172a", background: "white",
            }}>
              <option value="Tree">Tree</option>
              <option value="Landscape">Landscape</option>
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 10, color: "#64748b", fontWeight: 600, marginBottom: 3 }}>Vehicle Type *</label>
            <select value={addVehicle.type} onChange={e => setAddVehicle(v => ({ ...v, type: e.target.value }))} style={{
              width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 13,
              fontFamily: "inherit", color: "#0f172a", background: "white",
            }}>
              {["Ute","Truck","Excavator","EWP","Chipper","Stump Grinder","Trailer","Hired Vehicle","Mower","Landscape Tractor","Other"].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 10, color: "#64748b", fontWeight: 600, marginBottom: 3 }}>Vehicle Name</label>
            <input value={addVehicle.name} onChange={e => setAddVehicle(v => ({ ...v, name: e.target.value }))} placeholder="e.g. Toyota Hilux" style={{
              width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 13,
              outline: "none", fontFamily: "inherit", color: "#0f172a",
            }} onFocus={e => e.target.style.borderColor = "#22c55e"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 10, color: "#64748b", fontWeight: 600, marginBottom: 3 }}>Registered Owner</label>
            <input value={addVehicle.owner} onChange={e => setAddVehicle(v => ({ ...v, owner: e.target.value }))} placeholder="e.g. Kyle Osborne" style={{
              width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 13,
              outline: "none", fontFamily: "inherit", color: "#0f172a",
            }} onFocus={e => e.target.style.borderColor = "#22c55e"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 10, color: "#64748b", fontWeight: 600, marginBottom: 3 }}>Fuel Type</label>
            <select value={addVehicle.fuel} onChange={e => setAddVehicle(v => ({ ...v, fuel: e.target.value }))} style={{
              width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 13,
              fontFamily: "inherit", color: "#0f172a", background: "white",
            }}>
              {["Diesel","Unleaded","Premium Unleaded","Premium Diesel","E10"].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
        <button onClick={() => {
          const rego = addVehicle.rego.trim().toUpperCase();
          if (!rego || rego.length < 2) { showToast("Enter a registration number", "warn"); return; }
          const existing = learnedDB[rego] || {};
          const updated = {
            ...existing,
            t: addVehicle.type, d: addVehicle.div,
            n: addVehicle.name.trim() || existing.n || addVehicle.type,
            f: addVehicle.fuel || existing.f || "",
          };
          if (addVehicle.owner.trim()) updated.dr = addVehicle.owner.trim();
          const newDB = { ...learnedDB, [rego]: updated };
          persistLearned(newDB);
          showToast(`${rego} saved to vehicle database`);
          setAddVehicle({ rego: "", div: "Tree", type: "Ute", name: "", owner: "", fuel: "Diesel" });
        }} style={{
          marginTop: 12, padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700,
          cursor: "pointer", fontFamily: "inherit",
          background: "#16a34a", color: "white", border: "none", width: "100%",
        }}>Save Vehicle</button>
      </div>

      {/* Learned Vehicle Data list */}
      <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, padding: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#7c3aed", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 10 }}>{"\uD83E\uDDE0"} Learned Vehicle Data</div>
        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 10 }}>These overrides take priority over the original fleet spreadsheet. Added manually or learned from driver submissions.</div>
        {Object.keys(learnedDB).length === 0 ? (
          <div style={{ textAlign: "center", padding: "16px 0", color: "#94a3b8", fontSize: 12 }}>No learned vehicles yet. Add one above or submit entries to build the database.</div>
        ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 300, overflowY: "auto" }}>
          {Object.entries(learnedDB).sort().map(([rego, data]) => (
            <div key={rego} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px", background: "#faf5ff", borderRadius: 6, fontSize: 11 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", flex: 1 }}>
                <input
                  defaultValue={rego}
                  key={`rego-${rego}`}
                  onBlur={e => {
                    const newRego = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
                    if (!newRego || newRego === rego) { e.target.value = rego; return; }
                    if (learnedDB[newRego]) {
                      showToast(`${newRego} already exists in database`, "warn");
                      e.target.value = rego;
                      return;
                    }
                    const { [rego]: _moved, ...rest } = learnedDB;
                    const updated = { ...rest, [newRego]: data };
                    persistLearned(updated);
                    showToast(`Renamed ${rego} \u2192 ${newRego}`);
                  }}
                  onKeyDown={e => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") { e.target.value = rego; e.target.blur(); } }}
                  style={{ fontWeight: 700, color: "#0f172a", fontSize: 11, border: "none", borderBottom: "1px dashed #cbd5e1", background: "transparent", padding: "1px 4px", outline: "none", width: 80, fontFamily: "inherit", textTransform: "uppercase" }}
                  onFocus={e => e.target.style.borderBottomColor = "#7c3aed"}
                />
                <span style={{ color: "#7c3aed", fontWeight: 500 }}>{data.d}</span>
                <span style={{ color: "#64748b" }}>{data.t}</span>
                {data.n && data.n !== data.t && <span style={{ color: "#94a3b8" }}>{data.n}</span>}
                <input
                  value={data.dr || ""}
                  onChange={e => {
                    const updated = { ...learnedDB, [rego]: { ...data, dr: e.target.value } };
                    setLearnedDB(updated);
                  }}
                  onBlur={e => {
                    const val = e.target.value.trim();
                    const updated = { ...learnedDB, [rego]: { ...data, dr: val } };
                    persistLearned(updated);
                    if (val !== (data.dr || "").trim()) showToast(`Updated driver for ${rego}`);
                  }}
                  placeholder="Driver name"
                  style={{ color: "#64748b", fontStyle: "italic", fontSize: 11, border: "none", borderBottom: "1px dashed #cbd5e1", background: "transparent", padding: "1px 4px", outline: "none", width: 110, fontFamily: "inherit" }}
                  onFocus={e => e.target.style.borderBottomColor = "#7c3aed"}
                />
                {data.f && <span style={{ color: "#94a3b8" }}>({data.f})</span>}
              </div>
              <button onClick={() => {
                const { [rego]: _, ...rest } = learnedDB;
                persistLearned(rest);
                showToast(`Reset ${rego} to fleet database`);
              }} style={{ background: "none", border: "none", color: "#c4b5fd", cursor: "pointer", fontSize: 13, flexShrink: 0 }}>{"\u00D7"}</button>
            </div>
          ))}
        </div>
        )}
      </div>

      {/* Admin passcode */}
      <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, padding: 16, marginTop: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#1e40af", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 10 }}>{"\uD83D\uDD10"} Admin Passcode</div>
        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 10 }}>Change the passcode required to access admin features (Dashboard, Data, Cards, Settings).</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="password" value={passcodeInput}
            onChange={e => setPasscodeInput(e.target.value)}
            placeholder="Enter new passcode"
            style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, outline: "none", fontFamily: "inherit", color: "#0f172a" }}
            onFocus={e => e.target.style.borderColor = "#22c55e"}
            onBlur={e => e.target.style.borderColor = "#e2e8f0"}
          />
          <button onClick={async () => {
            const val = passcodeInput.trim();
            if (!val || val.length < 3) { showToast("Passcode must be at least 3 characters", "warn"); return; }
            setAdminPasscode(val);
            try { await window.storage.set("fuel_admin_passcode", val); } catch (_) {}
            showToast("Admin passcode updated");
          }} style={{
            padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit",
            background: "#1e40af", color: "white", border: "none",
          }}>Save</button>
        </div>
        <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 6 }}>Passcode is set {"\u00B7"} min 3 characters</div>
      </div>
    </div>
  );

  // ── Main layout ───────────────────────────────────────────────────────────
  if (!storageReady) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", fontFamily: "Inter, sans-serif", color: "#94a3b8", fontSize: 14 }}>Loading...</div>
  );

  const isAdmin = userRole === "admin";
  const navItems = isAdmin
    ? [["submit", "+ Entry"], ["dashboard", "Dashboard"], ["data", "Data"], ["drivers", "Drivers"], ["cards", "Cards"], ["reconcile", "Reconcile"], ["settings", "\u2699"]]
    : [["submit", "+ Entry"]];
  const navColors = {
    submit: "#16a34a",     // green
    dashboard: "#2563eb",  // blue
    data: "#7c3aed",       // purple
    drivers: "#0891b2",    // teal
    cards: "#c2410c",      // orange
    reconcile: "#0d9488",  // emerald
    settings: "#64748b",   // slate
  };

  const handleLogin = () => {
    if (loginInput === adminPasscode) {
      setUserRole("admin");
      setShowLogin(false);
      setLoginInput("");
      setLoginError("");
      showToast("Admin access granted");
    } else {
      setLoginError("Incorrect passcode");
    }
  };

  const handleLogout = () => {
    setUserRole("user");
    setView("submit");
    resetForm();
    showToast("Signed out of admin");
  };

  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh", fontFamily: "'Inter', sans-serif", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <style>{css}</style>
      <div style={{
        background: "white", borderBottom: "1px solid #e2e8f0",
        padding: "0 16px", display: "flex", alignItems: "center",
        justifyContent: "space-between", height: 56, position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <img src="/favicon.png" alt="PT Logo" style={{ width: 36, height: 36, borderRadius: 4 }} />
          <div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: "#16a34a", letterSpacing: "0.06em" }}>PLATEAU TREES</div>
            <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", lineHeight: 1 }}>Fuel Tracker</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center", overflowX: "auto", flexShrink: 1 }}>
          {navItems.map(([v, label]) => {
            const nc = navColors[v] || "#16a34a";
            return (
              <button key={v} onClick={() => { setView(v); if (v === "submit") resetForm(); }} style={{
                padding: "8px 12px", borderRadius: 7, fontSize: 12, cursor: "pointer",
                fontFamily: "inherit", fontWeight: view === v ? 700 : 500,
                background: view === v ? nc : "transparent",
                color: view === v ? "white" : "#64748b",
                border: `1px solid ${view === v ? nc : "#e2e8f0"}`,
                transition: "all 0.15s", whiteSpace: "nowrap", minHeight: 38, flexShrink: 0,
              }}>{label}</button>
            );
          })}
          {/* Role button */}
          {isAdmin ? (
            <button onClick={handleLogout} title="Sign out of admin" style={{
              padding: "8px 10px", borderRadius: 7, fontSize: 11, cursor: "pointer",
              fontFamily: "inherit", fontWeight: 600, minHeight: 38, flexShrink: 0,
              background: "#eff6ff", color: "#1e40af", border: "1px solid #93c5fd", whiteSpace: "nowrap",
            }}>{"\uD83D\uDD12"} Admin</button>
          ) : (
            <button onClick={() => setShowLogin(true)} title="Admin login" style={{
              padding: "8px 10px", borderRadius: 7, fontSize: 11, cursor: "pointer",
              fontFamily: "inherit", fontWeight: 500, minHeight: 38, flexShrink: 0,
              background: "transparent", color: "#94a3b8", border: "1px solid #e2e8f0",
            }}>{"\uD83D\uDD13"}</button>
          )}
        </div>
      </div>

      {/* Login modal */}
      {showLogin && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16,
        }} onClick={() => { setShowLogin(false); setLoginInput(""); setLoginError(""); }}>
          <div onClick={e => e.stopPropagation()} className="fade-in" style={{
            background: "white", borderRadius: 12, padding: 24, width: "100%", maxWidth: 340,
            boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
          }}>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>{"\uD83D\uDD10"}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>Admin Login</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Enter the admin passcode to access management features</div>
            </div>
            <input
              type="password" value={loginInput}
              onChange={e => { setLoginInput(e.target.value); setLoginError(""); }}
              onKeyDown={e => { if (e.key === "Enter") handleLogin(); }}
              placeholder="Passcode"
              autoFocus
              style={{
                width: "100%", padding: "12px 14px", borderRadius: 8, fontSize: 16, textAlign: "center",
                border: `2px solid ${loginError ? "#fca5a5" : "#e2e8f0"}`, outline: "none",
                fontFamily: "inherit", color: "#0f172a", letterSpacing: "0.2em",
              }}
              onFocus={e => { if (!loginError) e.target.style.borderColor = "#22c55e"; }}
              onBlur={e => { if (!loginError) e.target.style.borderColor = "#e2e8f0"; }}
            />
            {loginError && <div style={{ fontSize: 12, color: "#dc2626", textAlign: "center", marginTop: 8 }}>{loginError}</div>}
            <button onClick={handleLogin} style={{
              width: "100%", marginTop: 12, padding: "12px", borderRadius: 8, fontSize: 14, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
              background: "#16a34a", color: "white", border: "none",
            }}>Unlock</button>
          </div>
        </div>
      )}

      <div style={{
        // Per-view max width. Admin workflows (dashboard / data / cards /
        // drivers / reconcile) all run on a desktop monitor and benefit
        // from every horizontal pixel — tables with 10+ columns were
        // scrolling horizontally at the old 960px cap and the admin asked
        // to see them fit the page. Reconcile keeps its bigger ceiling
        // because its two side-by-side spreadsheets double the width
        // appetite. The 1800px / 2400px caps stop ultra-wide monitors
        // from stretching rows to unreadable line lengths.
        //
        // Submit (driver entry flow) stays slim — drivers submit from
        // their phones, and the 520px column keeps the form readable on
        // a narrow screen.
        maxWidth: view === "reconcile"
          ? "min(100%, 2400px)"
          : (view === "data" || view === "dashboard" || view === "cards" || view === "drivers") ? "min(100%, 1800px)"
          : 520,
        margin: "0 auto",
        padding: view === "reconcile" ? "24px 20px"
          : (view === "data" || view === "dashboard" || view === "cards" || view === "drivers") ? "24px 20px"
          : "24px 16px",
        transition: "max-width 0.3s",
      }}>
        {view === "submit" && (
          <>
            {step < 4 && <StepBar step={step} />}
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
            {step === 4 && renderStep4()}
          </>
        )}
        {view === "dashboard" && renderDashboard()}
        {view === "data" && renderData()}
        {view === "drivers" && renderDrivers()}
        {view === "cards" && renderCards()}
        {view === "reconcile" && renderReconciliation()}
        {view === "settings" && renderSettings()}
      </div>
      {serviceModal && (
        <ServiceModal rego={serviceModal} current={serviceData[serviceModal]}
          vehicleType={entries.find(e => e.registration === serviceModal)?.vehicleType || ""}
          onSave={handleServiceSave} onClose={() => setServiceModal(null)} />
      )}
      {editingEntry && (
        <EditEntryModal
          entry={editingEntry}
          onSave={(updated) => {
            updateEntry(updated);
            // Auto-resolve all open flags attached to this entry — editing
            // the entry means the admin has addressed the issue.
            try {
              const flagsForEntry = fleetAnalysis
                .flatMap(v => v.flags || [])
                .filter(fl => fl._entryId === updated.id)
                .map(fl => flagId(fl))
                .filter(fid => !resolvedFlags[fid]);
              if (flagsForEntry.length > 0) {
                resolveFlagsBulk(flagsForEntry, "Auto-resolved: entry edited", "Admin");
              }
            } catch (_) { /* non-fatal */ }
            setEditingEntry(null);
          }}
          onDelete={(id) => {
            // Guard against accidental clicks — confirmation is required.
            // Soft-delete means the row lands in Recently Deleted (Data tab)
            // where it can be restored for 30 days.
            const ent = entriesRef.current.find(e => e.id === id);
            const label = ent?.registration || ent?.equipment || "this entry";
            const dateLabel = ent?.date || "unknown date";
            setConfirmAction({
              message: `Delete the ${label} entry from ${dateLabel}?\n\nIt'll move to Recently Deleted (Data tab) where you can restore it for 30 days before it's purged for good.`,
              onConfirm: async () => {
                await deleteEntry(id);
                setEditingEntry(null);
                setConfirmAction(null);
              },
            });
          }}
          onClose={() => setEditingEntry(null)}
          loadReceiptFn={loadReceiptImage}
        />
      )}
      {renderFlagsModal()}
      {renderAiFlagsModal()}
      {editingVehicle && (() => {
        const veEntries = entries.filter(e => e.registration === editingVehicle);
        const latest = veEntries[veEntries.length - 1];
        const dbMatch = lookupRego(editingVehicle, learnedDBRef.current, entries);
        const currentName = latest?.vehicleName || dbMatch?.n || "";
        return (
          <EditVehicleModal
            rego={editingVehicle}
            currentDivision={latest?.division || ""}
            currentType={latest?.vehicleType || ""}
            currentName={currentName}
            entries={veEntries.length}
            onSave={saveVehicleEdit}
            onClose={() => setEditingVehicle(null)}
          />
        );
      })()}
      {manualEntry && (
        <ManualEntryModal
          rego={manualEntry.rego}
          division={manualEntry.division}
          vehicleType={manualEntry.vehicleType}
          onSave={async (entry) => {
            // Use the ref so a Realtime refresh that snuck in while the modal
            // was open doesn't cause us to write a stale entries array back.
            const newEntries = insertChronological(entriesRef.current, entry);
            await persist(newEntries, entry);
            setManualEntry(null);
            setExpandedRego(entry.registration);
            showToast(`Entry added for ${entry.registration}`);
          }}
          onClose={() => setManualEntry(null)}
        />
      )}
      {viewingReceipt && (
        <ReceiptViewer
          entryId={viewingReceipt}
          entry={entries.find(e => e.id === viewingReceipt)}
          loadFn={loadReceiptImage}
          onClose={() => setViewingReceipt(null)}
        />
      )}
      {confirmAction && (
        <ConfirmDialog
          message={confirmAction.message}
          onConfirm={confirmAction.onConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      )}
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={dismissToast} />}
    </div>
  );
}
