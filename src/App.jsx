import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import * as XLSX from "xlsx";
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
const HOURS_BASED_TYPES = new Set(["Excavator", "Stump Grinder", "Mower", "Landscape Tractor"]);
const isHoursBased = (vehicleType) => HOURS_BASED_TYPES.has(vehicleType);
const odoUnit = (vehicleType) => isHoursBased(vehicleType) ? "hrs" : "km";
const serviceInterval = (vehicleType) => isHoursBased(vehicleType) ? SERVICE_INTERVAL_HRS : SERVICE_INTERVAL_KM;
const serviceWarning = (vehicleType) => isHoursBased(vehicleType) ? SERVICE_WARNING_HRS : SERVICE_WARNING_KM;

// Typical fuel efficiency ranges — L/km for road vehicles, L/hr for hours-based equipment
const EFFICIENCY_RANGES = {
  Ute: { low: 0.06, high: 0.18, unit: "L/km" },
  Truck: { low: 0.10, high: 0.45, unit: "L/km" },
  Excavator: { low: 4, high: 25, unit: "L/hr" },
  EWP: { low: 0.05, high: 0.30, unit: "L/km" },
  Chipper: { low: 0.04, high: 0.30, unit: "L/km" },
  "Stump Grinder": { low: 3, high: 15, unit: "L/hr" },
  Trailer: { low: 0.06, high: 0.20, unit: "L/km" },
  "Hired Vehicle": { low: 0.04, high: 0.30, unit: "L/km" },
  Mower: { low: 2, high: 12, unit: "L/hr" },
  "Landscape Tractor": { low: 4, high: 20, unit: "L/hr" },
  Other: { low: 0.04, high: 0.40, unit: "L/km" },
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
{n:"KYLE OSBORNE",c:"7034305113700650",r:"AP85DF"},{n:"JASON SORBARA",c:"7034305108940667",r:"AT13VE"},{n:"NAISH",c:"7034305107330928",r:"BF51KJ"},{n:"JUSTIN LEWIS",c:"7034305116558659",r:"BJ57HC"},{n:"NICK JONES",c:"7034305115783134",r:"BR22ZZ"},{n:"JASON HUGHES",c:"7034305105574238",r:"BT08QM"},{n:"BRENDAN RICHARDSON",c:"7034305110165261",r:"BY38KR"},{n:"LUKE BARTLEY",c:"7034305106436460",r:"CA10BL"},{n:"BILLY PRICE",c:"7034305113893588",r:"CC24TI"},{n:"GAB FITZGERALD",c:"7034305111758833",r:"CC94JL"},{n:"JOE HUTTON",c:"7034305106228180",r:"CD36PH"},{n:"RACHAEL KEATING",c:"7034305106786955",r:"CH90KL"},{n:"DANIEL THOMSON",c:"7034305108274448",r:"CH95ZD"},{n:"KYLE OSBORNE",c:"7034305109332146",r:"CI98BZ"},{n:"KEV CARRILLO",c:"7034305108260140",r:"CJ55FB"},{n:"DAN THOMPSON",c:"7034305107310136",r:"CL52NS"},{n:"BILLY PRICE",c:"7034305116027192",r:"CM77KG"},{n:"CHRIS PLAYER",c:"7034305117020659",r:"CN47HS"},{n:"SHAUN COLE",c:"7034305113746059",r:"CP60AF"},{n:"DENNIS KOCJANCIC",c:"7034305116296961",r:"CP06YZ"},{n:"SHANE DEMIRAL",c:"7034305112151236",r:"CT74KE"},{n:"SAXON",c:"7034305106890443",r:"CV14NO"},{n:"LAURA HARDWOOD",c:"7034305114887118",r:"CX22BE"},{n:"MICK THOMAS",c:"7034305106791179",r:"CX23BE"},{n:"JAYDEN STRONG",c:"7034305112823891",r:"DB78SC"},{n:"KYLE OSBORNE",c:"7034305117002350",r:"DF25LB"},{n:"JACOB DEVEIGNE",c:"7034305110028204",r:"DF26LB"},{n:"ALEX GLYNN",c:"7034305112341555",r:"DI05QD"},{n:"DAMIAN SEMPEL",c:"7034305116822212",r:"CS63LP"},{n:"JACOB DEVEIGNE",c:"7034305117003408",r:"DP60DA"},{n:"BRETT SONTER",c:"7034305108863984",r:"DPL85C"},{n:"TIM PRICE",c:"7034305114660168",r:"DP90CQ"},{n:"JASON HUGHES",c:"7034305112129919",r:"DSU65Y"},{n:"PHIL CARSON",c:"7034305108545714",r:"DSU65Y"},{n:"SONYA",c:"7034305114570151",r:"EAE28V"},{n:"SAM LAW",c:"7034305113442394",r:"EBL30C"},{n:"AMELIA PLUMMER",c:"7034305115642942",r:"ECE83U"},{n:"LEE DAVIS",c:"7034305107318832",r:"EES53B"},{n:"JOE PELLIZZON",c:"7034305117257665",r:"EYO62W"},{n:"JOHN LARGEY",c:"7034305111069538",r:"EOL97X"},{n:"MARTIN HOWARD",c:"7034305113441354",r:"EQE85L"},{n:"BJ",c:"7034305110325493",r:"EQP77D"},{n:"JOE HURST",c:"7034305112846991",r:"EQP77E"},{n:"RHYS DWYER",c:"7034305109386829",r:"ERQ21S"},{n:"ANT YOUNGMAN",c:"7034305105562266",r:"EVA47B"},{n:"DECLAN KANE",c:"7034305107192484",r:"EYN61Z"},{n:"DAYNE COOMBE",c:"7034305107009274",r:"EYO02K"},{n:"CASS CHAPPLE",c:"7034305107286914",r:"EYP02J"},{n:"DANE PLUMMER",c:"7034305116249275",r:"FGP29X"},{n:"TONY PLUMMER",c:"7034305111220834",r:"FHX25L"},{n:"JOE DALEY",c:"7034305116246156",r:"FMT17H"},{n:"JASON JOHNSON",c:"7034305113817595",r:"JCJ010"},{n:"CAM WILLIAMS",c:"7034305117354637",r:"MISC3"},{n:"CARLOS CARRILLO",c:"7034305115254565",r:"WIA53F"},{n:"WADE HANNELL",c:"7034305116506179",r:"WNU522"},{n:"OLD BOGIE",c:"7034305111430383",r:"XN56BU"},{n:"NATHAN MORALES",c:"7034305110311667",r:"XN59QZ"},{n:"SCOTT WOOD",c:"7034305110006994",r:"XN95CF"},{n:"ALEX GLYNN",c:"7034305116398783",r:"XO05MA"},{n:"MATTHEW BROCK",c:"7034305108678176",r:"XO05RX"},{n:"MATT ROGERS",c:"7034305111375786",r:"XO08FN"},{n:"MAROS MENCAK",c:"7034305111698906",r:"XO20NL"},{n:"TIM PRICE",c:"7034305113655797",r:"XO49LN"},{n:"SHAUN DENNISON",c:"7034305110811948",r:"XO96XP"},{n:"STEVE NEWTON",c:"7034305111299762",r:"XP058N"},{n:"DOUG GRANT",c:"7034305116197722",r:"XP31AG"},{n:"JASON HUGHES",c:"7034305116247253",r:"XP41MC"},{n:"JASON SORBARA",c:"7034305117860930",r:"XP86LM"},{n:"ROGER BORG",c:"7034305106723230",r:"YMN14E"},{n:"MATHEW BROCK",c:"7034305108678176",r:"XO05RX"},{n:"NICK JONES",c:"7034305118134137",r:"TA55AA"},{n:"CAM WILLIAMS",c:"7034305118134749",r:"TA80QZ"},{n:"MAROS MENCAK",c:"7034305118133972",r:"TC70VA"},{n:"JASON HUGHES",c:"7034305118175825",r:"TC80LA"},{n:"SPARE",c:"7034305118133980",r:"TL48UF"},{n:"DENNIS KOCJANCIC",c:"7034305118145893",r:"TL56PO"},{n:"DOUG GRANT",c:"7034305118148491",r:"TM84AT"},{n:"SPARE",c:"7034305118133311",r:"TP97AL"},{n:"STEVE NEWTON",c:"7034305118133477",r:"TP99AL"},{n:"MATT ROGERS",c:"7034305118177383",r:"YN05HA"},{n:"SCOTT WOOD",c:"7034305118178019",r:"YN71AN"}
];

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
const REGO_DB = [{"r":"38359D","t":"Other","d":"Tree","n":"AVANT TELESCOPIC LOADER","m":"AVANT 750"},{"r":"00440E","t":"Excavator","d":"Tree","n":"EXCAVATOR  8T","m":"KUBOTA KX080"},{"r":"25393E","t":"Excavator","d":"Tree","n":"EXCAVATOR","m":"KOBELCO SK55SRX-6"},{"r":"40971E","t":"Other","d":"Tree","n":"AVANT TELESCOPIC LOADER","m":"AVANT 750"},{"r":"TA55AA","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 12in","m":"BANDIT BAN990","dr":"NICK JONES","c":"7034305118134137","f":"Diesel"},{"r":"TP97AL","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 15in","m":"BANDIT 159006A","dr":"SPARE","c":"7034305118133311","f":"Diesel"},{"r":"TD34ZR","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 15in","m":"BANDIT 159006A"},{"r":"TP99AL","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 15in","m":"BANDIT 159006A","dr":"STEVE NEWTON","c":"7034305118133477","f":"Diesel"},{"r":"TL40RW","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 15in","m":"BANDIT 159006A"},{"r":"50197D","t":"Excavator","d":"Tree","n":"EXCAVATOR 20T","m":"CASE CX210C"},{"r":"TA80QZ","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 18in","m":"BANDIT 189007A","dr":"CAM WILLIAMS","c":"7034305118134749","f":"Diesel"},{"r":"53667E","t":"Excavator","d":"Tree","n":"EXCAVATOR  5.5T","m":"KOBELCO SK55S7A"},{"r":"TC70VA","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 18in","m":"BANDIT 159006A","dr":"MAROS MENCAK","c":"7034305118133972","f":"Diesel"},{"r":"61609E","t":"Excavator","d":"Tree","n":"EXCAVATOR  8T","m":"KUBOTA KX080"},{"r":"TL48UF","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 18in","m":"BANDIT 18XP","dr":"SPARE","c":"7034305118133980","f":"Diesel"},{"r":"TL56PO","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 18in","m":"VERMEER BC1800","dr":"DENNIS KOCJANCIC","c":"7034305118145893","f":"Diesel"},{"r":"TM84AT","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 18in","m":"VERMEER BC1800","dr":"DOUG GRANT","c":"7034305118148491","f":"Diesel"},{"r":"YN05HA","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 22in","m":"BANDIT MTETAND","dr":"MATT ROGERS","c":"7034305118177383","f":"Diesel"},{"r":"YN29AW","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 22in","m":"BANDIT MTETAND"},{"r":"YN71AN","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 22in","m":"BANDIT MTETAND","dr":"SCOTT WOOD","c":"7034305118178019","f":"Diesel"},{"r":"BJ57HC","t":"Ute","d":"Tree","n":"TOYOTA HILUX","m":"TOYOTA HILUX4","dr":"JUSTIN LEWIS","c":"7034305116558659","f":"Premium unleaded"},{"r":"BY38KR","t":"Ute","d":"Tree","n":"Toyota Landcruiser","m":"Toyota Landcruiser","dr":"BRENDAN RICHARSON","c":"7034305110165261","f":"Diesel"},{"r":"26228E","t":"Mower","d":"Landscape","n":"HUSTLER RIDE ON MOWER","m":"HUSTLER SUPERZ 60inch"},{"r":"BW63RR","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL UTE - VMS","m":"TOYOTA HILUX"},{"r":"31182E","t":"Mower","d":"Landscape","n":"KUBOTA RIDE ON MOWER","m":"KUBOTA ZD1221 60inch"},{"r":"CA10BL","t":"Ute","d":"Tree","n":"MITSUBISHI TRITON","m":"MITSUBISHI TRITON","dr":"LUKE BARTLEY","c":"7034305106436460","f":"Diesel"},{"r":"36989E","t":"Mower","d":"Landscape","n":"KUBOTA RIDE ON MOWER","m":"KUBOTA ZD1221 60inch"},{"r":"36990E","t":"Landscape Tractor","d":"Landscape","n":"KUBOTA TRACTOR","m":"KUBOTA M9540D"},{"r":"BR22ZZ","t":"Truck","d":"Tree","n":"TRUCK-HINO 500","m":"HINO FG8J","dr":"NICK JONES","c":"7034305115783134","f":"Fuel"},{"r":"BT08QM","t":"Truck","d":"Tree","n":"TRUCK - HINO TIPPER","m":"HINO FG8J","dr":"JASON HUGHES","c":"7034305105574238","f":"Diesel"},{"r":"53369E","t":"Mower","d":"Landscape","n":"KUBOTA RIDE ON MOWER","m":"KUBOTA ZD1221 60inch"},{"r":"59040D","t":"Mower","d":"Landscape","n":"KUBOTA RIDE ON MOWER","m":"KUBOTA ZD1221 60inch"},{"r":"62925E","t":"Mower","d":"Landscape","n":"KUBOTA RIDE ON MOWER","m":"KUBOTA ZD1221R 60inch"},{"r":"CC24TI","t":"Ute","d":"Tree","n":"Toyota Hilux 4x4","m":"Toyota HILUX 4","dr":"BILLY PRICE","c":"7034305113893588","f":"Premium Diesel"},{"r":"CC94JL","t":"Ute","d":"Tree","n":"ISUZU D-MAX","m":"ISUZU D-MA08A","dr":"GAB FITZGERALD","c":"7034305111758833","f":"Diesel"},{"r":"CD36PH","t":"Ute","d":"Tree","n":"TOYOTA HILUX","m":"TOYOTA HILUX4","dr":"JOE HUTTON","c":"7034305106228180","f":"Fuel"},{"r":"CH90KL","t":"Ute","d":"Tree","n":"TOYOTA HILUX","m":"TOYOTA HILUX4","dr":"RACHAEL KEATING","c":"7034305106786955","f":"Unleaded"},{"r":"CJ55FB","t":"Ute","d":"Tree","n":"TOYOTA HILUX","m":"TOYOTA HILUX4","dr":"KEV CARRILLO","c":"7034305108260140","f":"Unleaded"},{"r":"CP60AF","t":"Ute","d":"Tree","n":"ISUZU D-MAX","m":"ISUZU D-MA12","dr":"SHAUN COLE","c":"7034305113746059","f":"Diesel"},{"r":"CV14NO","t":"Ute","d":"Tree","n":"Toyota Hilux","m":"Toyota HILUX 4","dr":"SAXON","c":"7034305106890443","f":"Diesel"},{"r":"CN47HS","t":"Truck","d":"Tree","n":"ISUZU D Max","m":"ISUZU NQR","dr":"CHRIS PLAYER - (STUMP TRUCK - OLD TRENT SHEATH)","c":"7034305117020659","f":"Diesel"},{"r":"66695E","t":"Mower","d":"Landscape","n":"KUBOTA RIDE ON MOWER","m":"KUBOTA ZD1221R 60inch"},{"r":"CP06YZ","t":"Truck","d":"Tree","n":"TRUCK - UD","m":"UD PKC8E","dr":"DENNIS KOCJANCIC","c":"7034305116296961","f":"Diesel"},{"r":"CS63LP","t":"Truck","d":"Tree","n":"MITSUBISHI CANTER (Blower)","m":"MITSUBISHI CANT08","dr":"BLOWER TRUCK","c":"7034305112809668","f":"Diesel"},{"r":"CE52JK","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL - TMA","m":"ISUZU FTR900M"},{"r":"CZ86TX","t":"Ute","d":"Landscape","n":"TRAFFIC CONTROL UTE","m":"ISUZU D-MA20"},{"r":"CZ33TZ","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL UTE - VMS","m":"ISUZU D-MAX"},{"r":"DA32FL","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL UTE - VMS","m":"ISUZU D-MAX"},{"r":"DA37FL","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL UTE - VMS","m":"ISUZU D-MAX"},{"r":"CP11JO","t":"Truck","d":"Tree","n":"TRUCK - HINO","m":"HINO FGIJ","dr":"SPARE","c":"7034305106957424","f":"Diesel"},{"r":"DF25LB","t":"Truck","d":"Tree","n":"ISUZU Crew Cab","m":"ISUZU NNR","dr":"KYLE OSBORNE","c":"7034305117002350","f":"Diesel"},{"r":"DFW77E","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL UTE - VMS","m":"ISUZU D-MAX"},{"r":"DF26LB","t":"Truck","d":"Tree","n":"ISUZU Crew Cab","m":"ISUZU NNR","dr":"JACOB DEVINGNE?","c":"7034305110028204","f":"Diesel"},{"r":"DI32GU","t":"Ute","d":"Landscape","n":"TRAFFIC CONTROL UTE","m":"TOYOTA HILUX 4","c":"7034305110681705","f":"Premium unleaded"},{"r":"DM84ZB","t":"Truck","d":"Tree","n":"ISUZU Crew Cab","m":"ISUZU NHNN07"},{"r":"DL45RF","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL UTE - VMS","m":"ISUZU D-MAX"},{"r":"DP60DA","t":"Truck","d":"Tree","n":"ISUZU TRUCK","m":"ISUZU NHNN07","dr":"JACOB DEVEIGNE","c":"7034305117003408","f":"Diesel"},{"r":"XO05MA","t":"Truck","d":"Tree","n":"Nissan UD Float","m":"UD PKC397A","dr":"ALEX GLYNN","c":"7034305116398783","f":"Diesel"},{"r":"XO05RX","t":"Truck","d":"Tree","n":"Hino 300 Series","m":"Hino 30007B","dr":"Mathew Brock","c":"7034 3051 0867 8176"},{"r":"DB78SC","t":"Ute","d":"Tree","n":"ISUZU D-MAX SX CAB CHASSIS","m":"ISUZU D-MA12","dr":"JAYDEN STRONG","c":"7034305112823891","f":"Diesel"},{"r":"DI05QD","t":"Ute","d":"Tree","n":"TOYOTA Hilux","m":"TOYOTA HILUX 4","dr":"ALEX GLYNN","c":"7034305112341555","f":"Premium unleaded"},{"r":"BX27ZL","t":"Ute","d":"Tree","n":"TOYOTA Hilux","m":"TOYOTA HILUX 4"},{"r":"DP90CQ","t":"Ute","d":"Tree","n":"FORD RANGER","m":"FORD RANGER","dr":"TIM PRICE","c":"7034305114660168","f":"Diesel"},{"r":"BY49ZT","t":"Ute","d":"Tree","n":"FORD RANGER","m":"FORD RANGER"},{"r":"XN59QZ","t":"EWP","d":"Tree","n":"MITSUBISHI / VERSA LIFT TOWER","m":"MITSUBISHI FUSO","dr":"NATHAN MORALES","c":"7034305110311667","f":"Diesel"},{"r":"XN56BU","t":"Truck","d":"Tree","n":"ISUZU BOGIE -TIPPER","m":"ISUZU FVZ193A","dr":"OLD BOGIE","c":"7034305111430383","f":"Diesel"},{"r":"XN70FQ","t":"Truck","d":"Tree","n":"TRUCK - MITSU TIPPER","m":"MITSUBISHI FN62FK","dr":"SPARE","c":"7034305108388719","f":"Diesel"},{"r":"XN95CF","t":"Truck","d":"Tree","n":"TRUCK - UD","m":"UD GWB","dr":"SCOTT WOOD","c":"7034305110006994","f":"Diesel"},{"r":"DPL85C","t":"Ute","d":"Tree","n":"MITSUBISHI TRITON","m":"MITSUBISHI TRITON","dr":"BRETT SONTER","c":"7034305108863984","f":"Diesel"},{"r":"DSU65Y","t":"Ute","d":"Tree","n":"MITSUBISHI TRITON","m":"MITSUBISHI TRITON","dr":"JASON HUGHES","c":"7034305112129919","f":"Unleaded"},{"r":"DXS19T","t":"Ute","d":"Tree","n":"Toyota Hilux","m":"TOYOTA HILUX 4"},{"r":"EAE28V","t":"Other","d":"Tree","n":"PORSCHE MACAN","m":"PORSCHE MACA14","dr":"SONYA","c":"7034305114570151","f":"Premium unleaded"},{"r":"EYI04H","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL UTE - VMS","m":"ISUZU D-MAX"},{"r":"EYI04J","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL UTE - VMS","m":"ISUZU D-MAX"},{"r":"DI08XE","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL - TMA","m":"MITSUA TF"},{"r":"ECE83U","t":"Ute","d":"Tree","n":"UTE","m":"Volkswagon Amarok","dr":"AMELIA PLUMMER","c":"7034305115642942","f":"Diesel"},{"r":"6117231263","t":"Stump Grinder","d":"Tree","n":"STUMP GRINDER - HUMPER - ORANGE","m":"RHYSCORP SH25hp"},{"r":"1800D","t":"Stump Grinder","d":"Tree","n":"STUMP GRINDER - RED ROO","m":"RED ROO 5014TRX"},{"r":"66HP","t":"Stump Grinder","d":"Tree","n":"STUMP GRINDER - RED ROO 7015TRX","m":""},{"r":"PT44","t":"Stump Grinder","d":"Tree","n":"STUMP GRINDER - RED ROO 7015TRX","m":"RED ROO 7015TRX"},{"r":"PT20","t":"Stump Grinder","d":"Tree","n":"STUMP GRINDER","m":""},{"r":"PT31","t":"Stump Grinder","d":"Tree","n":"STUMP GRINDER","m":""},{"r":"CM77KG","t":"EWP","d":"Tree","n":"TOWER-ISUZU - EWP","m":"ISUZU FVZ193A","dr":"BILLY PRICE (21M)","c":"7034305116027192","f":"Diesel"},{"r":"EES53B","t":"Ute","d":"Tree","n":"ISUZU D-MAX","m":"ISUZU D-MA08A","dr":"LEE DAVIS","c":"7034305107318832","f":"Diesel"},{"r":"EOL97X","t":"Ute","d":"Tree","n":"FORD RANGER","m":"FORD RANGER","dr":"JOHN LARGEY","c":"7034305111069538","f":"Diesel"},{"r":"EQE85L","t":"Ute","d":"Tree","n":"FORD RANGER","m":"FORD RANGER","dr":"MARTIN HOWARD","c":"7034305113441354","f":"Diesel"},{"r":"EQP77D","t":"Ute","d":"Tree","n":"TOYOTA HILUX","m":"TOYOTA HILUX 4","dr":"BJ","c":"7034305110325493","f":"Unleaded"},{"r":"EQP77E","t":"Ute","d":"Tree","n":"TOYOTA HILUX","m":"TOYOTA HILUX 4","dr":"JOE HURST","c":"7034305112846991","f":"Unleaded"},{"r":"ERQ21S","t":"Ute","d":"Tree","n":"FORD RANGER","m":"FORD RANGER","dr":"RHYS DWYER","c":"7034305109386829","f":"Diesel"},{"r":"EVA47B","t":"Ute","d":"Tree","n":"MITSUBISHI TRITON","m":"FORD RANGER","dr":"ANT YOUNGMAN","c":"7034305105562266","f":"Diesel"},{"r":"EYN61Z","t":"Other","d":"Tree","n":"Mazda CX5","m":"Mazda CX5","dr":"DECLAN KANE","c":"7034305107192484","f":"Unleaded"},{"r":"EYP02J","t":"Ute","d":"Tree","n":"LDV T60","m":"LDV SK8C17","dr":"CASS CHAPPLE","c":"7034305107286914","f":"Diesel"},{"r":"EYP02K","t":"Ute","d":"Tree","n":"LDV T60","m":"LDV SK8C17"},{"r":"FGP29X","t":"Ute","d":"Tree","n":"ISUZU D Max","m":"ISUZU D-MAX","dr":"DANE PLUMMER","c":"7034305116249275","f":"Diesel"},{"r":"FHX25L","t":"Ute","d":"Tree","n":"Toyota Landcruiser","m":"TOYOTA LANDCRUISER","dr":"TONY PLUMMER","c":"7034305111220834","f":"Diesel"},{"r":"FMT17H","t":"Ute","d":"Tree","n":"ISUZU D Max","m":"ISUZU D-MAX","dr":"JOE DALEY","c":"7034305116246156","f":"Diesel"},{"r":"TA39WQ","t":"Trailer","d":"Tree","n":"TRAILER","m":"QUALTY 8X501A"},{"r":"TB17YY","t":"Trailer","d":"Tree","n":"TRAILER","m":"MARIOT 12XT"},{"r":"YN04HA","t":"Trailer","d":"Tree","n":"TRAILER","m":"JPTRLR TRIAXLE"},{"r":"TE46QM","t":"Trailer","d":"Tree","n":"TRAILER","m":"JPTRLR TRIAXLE"},{"r":"XO08FN","t":"Truck","d":"Tree","n":"TRUCK - UD","m":"UD PK","dr":"MATT ROGERS","c":"7034305111375786","f":"Diesel"},{"r":"TG26UA","t":"Trailer","d":"Tree","n":"TRAILER","m":"ATA 9X6"},{"r":"XO20NL","t":"Truck","d":"Tree","n":"TRUCK - UD","m":"UDTRUC PKC","dr":"MAROS MENCAK","c":"7034305111698906","f":"Diesel"},{"r":"TE74NJ","t":"Trailer","d":"Tree","n":"TRAILER - (Mower)","m":"DEAN 190S06A"},{"r":"TF46NU","t":"Trailer","d":"Tree","n":"TRAILER - (Mower)","m":"SWTTLR SWT"},{"r":"TG29WL","t":"Trailer","d":"Tree","n":"TRAILER - (Mower)","m":"BETTER BT"},{"r":"U64347","t":"Trailer","d":"Tree","n":"JPTRLR TANDEM Trailer","m":"JPRLR TANDEM"},{"r":"TG30WL","t":"Trailer","d":"Tree","n":"TRAILER - (Mower)","m":"BETTER BT"},{"r":"TG31WL","t":"Trailer","d":"Tree","n":"TRAILER - (Mower)","m":"BETTER BT"},{"r":"TL30YS","t":"Trailer","d":"Tree","n":"TRAILER - (Blower)","m":"BALANCE BT53FWT"},{"r":"TL30ZN","t":"Trailer","d":"Tree","n":"TRAILER - (Traffic Control)","m":"MARIO 10X5"},{"r":"TL49PN","t":"Trailer","d":"Tree","n":"Trailer (Avant)","m":"BRIANJ 888"},{"r":"TL69XK","t":"Trailer","d":"Tree","n":"TRAILER - (Mower)","m":"DEAN 109S06A"},{"r":"TF52XQ","t":"Trailer","d":"Tree","n":"TRAILER - (Mower)","m":"DEAN 109S06A"},{"r":"TP56GL","t":"Trailer","d":"Tree","n":"TRAILER Maxim - (Mower)","m":"MAXIM STB"},{"r":"OLD TC80RW","t":"Trailer","d":"Tree","n":"TRAILER Maxim - (Mower)","m":"MAXIM STB"},{"r":"TG05QH","t":"Trailer","d":"Tree","n":"TRAILER - (Vermeer)","m":"SURWEL SW2400"},{"r":"XN14ZF","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL - TMA","m":"ISUZU FTR900M"},{"r":"YN78AN","t":"Trailer","d":"Tree","n":"TRAILER FLOAT","m":"TAG TANDEM"},{"r":"XN61YG","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL - TMA","m":"UD PKC8E"},{"r":"XO49LN","t":"Truck","d":"Tree","n":"TRUCK - UD","m":"UD GWB","dr":"TIM PRICE","c":"7034305113655797","f":"Diesel"},{"r":"XP05BN","t":"Truck","d":"Tree","n":"Isuzu Tipper","m":"Isuzu FSR140"},{"r":"XO26SK","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL - TMA","m":"IVECO EUROCARGO"},{"r":"XN07XY","t":"Truck","d":"Tree","n":"IVECO - HAULAGE TRUCK","m":"IVECO STRA05A","dr":"BRETT SONTER/LEE DAVIS","f":"Diesel"},{"r":"XO37SC","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL - TMA","m":"MITSUA TA FIGH"},{"r":"XO39LU","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL - TMA","m":"HINO GH500 1828"},{"r":"XO68TY","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL - TMA","m":"IVECO DAIL07"},{"r":"XP31AG","t":"Truck","d":"Tree","n":"Mitsubishi Tipper","m":"MITSUBISHI FM6503A","dr":"DOUG GRANT","c":"7034305116197722","f":"Diesel"},{"r":"XP36GC","t":"Truck","d":"Tree","n":"Truck Hino PT#62","m":"HINO 30007A","dr":"SPARE (SOON TO BE BRENDON DEACON?)","c":"7034305113207938","f":"Diesel"},{"r":"XP80KS","t":"Truck","d":"Tree","n":"TRUCK - HINO TIPPER","m":"HINO FG1J01A","dr":"SPARE","c":"7034305117533503","f":"Diesel"},{"r":"XO71ZL","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL - TMA","m":"MITSUA TA FIGH"},{"r":"XN25DA","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL - TMA","m":""},{"r":"XO82XV","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL - TMA","m":"MITSUA TA FIGH"},{"r":"XO96XP","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL - TMA","m":"MITSUA TF","dr":"SHAUN DENNISON","c":"7034305110811948","f":"Diesel"},{"r":"XP57ES","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL - TMA","m":"MITSUA TA FIGH"},{"r":"XP86LM","t":"Truck","d":"Tree","n":"TRUCK - ISUZU","m":"ISUZU FVRL96A","dr":"JASON SORBARA","c":"7034305108940667","f":"Diesel"},{"r":"YN22AO","t":"Trailer","d":"Tree","n":"PLANT TRAILER","m":"FWR Single Axle Tag Trailer"},{"r":"CX22BE","t":"Truck","d":"Landscape","n":"MITSUBISHI CANTER","m":"MITSUBISHI CANT08","dr":"LAURA HARDWOOD","c":"7034305114887118","f":"Diesel"},{"r":"XO35UP","t":"Truck","d":"Tree","n":"MERCEDES TIPPER J&R HIRE","m":"MERCEDES BENZ 2643","dr":"CAM WILLIAMS","c":"MISC3","f":"Diesel"},{"r":"BZ04EH","t":"Truck","d":"Landscape","n":"FUSO CANTER","m":"MITSUBISHI CANT08","dr":"GRAFFITI TRUCK","c":"7034305113417867","f":"Diesel"},{"r":"Z41694","t":"Trailer","d":"Tree","n":"TRAILER ARROW BOARD","m":"DATA DATASIG"},{"r":"Z80212","t":"Trailer","d":"Tree","n":"TRAILER ARROW BOARD","m":"Data Signs DATASIG"},{"r":"CI98BZ","t":"Truck","d":"Landscape","n":"Isuzu Truck","m":"ISUZU NPR300","dr":"KYLE OSBORNE","c":"7034305109332146","f":"Diesel"},{"r":"CL52NS","t":"Truck","d":"Landscape","n":"HINO Truck - 300 SERIES","m":"HINO 300S11","dr":"DAN THOMPSON","c":"7034305107310136","f":"Diesel"},{"r":"CT74KE","t":"Truck","d":"Tree","n":"ISUZU Truck","m":"ISUZU NHNL07","dr":"SHANE DEMIRAL","c":"7034305112151236","f":"Diesel"},{"r":"CX23BE","t":"Truck","d":"Landscape","n":"FUSO CANTER","m":"MITSUBISHI CANTER","dr":"MICK THOMAS","c":"7034305106791179","f":"Diesel"},{"r":"YMN14E","t":"Ute","d":"Tree","n":"ISUZU D Max","m":"ISUZU D-MA21","dr":"ROGER BORG","c":"7034305106723230","f":"Diesel"},{"r":"PT#30","t":"Other","d":"Tree","n":"VERMEER LOADER","m":"VERMEER CTX100"},{"r":"CX45MJ","t":"Truck","d":"Landscape","n":"ISUZU WATER CART","m":"ISUZU NLR200","dr":"NAISH","c":"7034305107330928","f":"Diesel"},{"r":"TC80LA","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 15in","m":"BANDIT 159006A","dr":"JASON HUGHES","c":"7034305118175825","f":"Diesel"},{"r":"AP85DF","t":"Other","d":"Tree","n":"Mitsubishi Canter Auto","m":"","dr":"KYLE OSBORNE","c":"7034305113700650","f":"Diesel"},{"r":"AT13VE","t":"Truck","d":"Tree","n":"Isuzu Tipper","m":"","dr":"JASON SORBARA","c":"7034305108940667","f":"Diesel"},{"r":"BF51KJ","t":"Other","d":"Tree","n":"NLR Series","m":"","dr":"NAISH","c":"7034305107330928","f":"Diesel"},{"r":"BST66Q","t":"Ute","d":"Tree","n":"Toyota Hilux SR","m":"","dr":"YARD SPARE","c":"7034305116359132","f":"Unleaded"},{"r":"CH95ZD","t":"Other","d":"Tree","n":"Mitsubishi Canter","m":"","dr":"DANIEL THOMSON","c":"7034305108274448","f":"Diesel"},{"r":"CIC51E","t":"Other","d":"Tree","n":"Ford Ranger","m":"","c":"7034305114657123","f":"Unleaded"},{"r":"CM80RV","t":"Truck","d":"Tree","n":"Hino FD8J Truck","m":"","c":"7034305114621285","f":"Diesel"},{"r":"EBL30C","t":"Other","d":"Tree","n":"FORD FALCON","m":"","dr":"SAM LAW","c":"7034305113442394","f":"Unleaded"},{"r":"EYO62W","t":"Other","d":"Tree","n":"MERC BENZ 300CE","m":"","dr":"JOE PELLIZZON","c":"7034305117257665","f":"Unleaded"},{"r":"EYO02K","t":"Ute","d":"Tree","n":"LDV T60 UTE LDV","m":"","dr":"DAYNE COOMBE","c":"7034305107009274","f":"Diesel"},{"r":"FWN82W","t":"Other","d":"Tree","n":"","m":"","dr":"JOEL SONTER"},{"r":"JCJ010","t":"Other","d":"Tree","n":"RAM RAM 1500","m":"","dr":"JASON JOHNSON","c":"7034305113817595","f":"Unleaded"},{"r":"MISC3","t":"Other","d":"Tree","n":"ANY ANY","m":"","dr":"CAM WILLIAMS","c":"7034305105984726","f":"Diesel"},{"r":"WIA53F","t":"Other","d":"Tree","n":"Nissan Navara Nissan Navara","m":"","dr":"CARLOS CARRILLO","c":"7034305115254565","f":"Diesel"},{"r":"WNU522","t":"EWP","d":"Tree","n":"HINO 500","m":"","dr":"WADE HANNELL","c":"7034305116506179","f":"Diesel"},{"r":"XO86LP","t":"EWP","d":"Tree","n":"ISUZU NPR200","m":"","c":"7034305114342411","f":"Diesel"},{"r":"XP058N","t":"Truck","d":"Tree","n":"ISUZU FSR 140","m":"","dr":"STEVE NEWTON","c":"7034305111299762","f":"Diesel"},{"r":"XP41MC","t":"EWP","d":"Tree","n":"HINO-500","m":"","dr":"JASON HUGHES","c":"7034305116247253","f":"Diesel"},{"r":"XP21GC","t":"EWP","d":"Tree","n":"","m":"","dr":"DAN VANDERMEEL","c":"XP21GC"},{"r":"XP60OO","t":"EWP","d":"Tree","n":"","m":"","dr":"SAM THOMAS","c":"XP60OO"},{"r":"XN00NX","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL - TMA","m":""},{"r":"XN31GR","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL - TMA","m":""},{"r":"XN64MA","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL - TMA","m":""},{"r":"XV87JT","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL - TMA","m":""}];

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
Usually a line showing the date and transaction/receipt number. The date follows Australian Day/Month/Year format:
- "13/03/26" means 13th March 2026
- "13/3/26" means 13th March 2026
- "13/03/2026" means 13th March 2026
- "5/4/26" means 5th April 2026
Always output the date as DD/MM/YYYY with full 4-digit year.

CRITICAL DATE RULE: The date on a receipt can NEVER be in the future. Receipts record past transactions. Today's date (Sydney AEST/AEDT) is ${sydneyTodayAU()}. If you read a date that appears to be after today, you have almost certainly misread the day, month, or year. Common misreads:
- Swapping day and month (e.g. reading "04/10" as 10th April when it's actually 4th October)
- Wrong year (e.g. reading "25" instead of "26" or vice versa)
- Misreading a digit (e.g. "1" as "7", "5" as "6")
Double-check: does the date make sense as a PAST date? If not, re-read the digits carefully.

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
Look for a PHYSICAL orange/red Shell FleetCard VISIBLE AS A SEPARATE CARD in the photo (not just text on the receipt). The card must show the full 16-digit number starting with 7034.

If you can only see "FLEETCARD" printed on the receipt paper but no actual physical card with 16 digits, set cardNumber to null.

The physical card layout:
  Line 1: "FleetCard" logo
  Line 2: 16-digit card number starting with 7034
  Line 3: Cardholder surname + vehicle model (e.g. "WHITE NNR-451") — NOT the registration
  Line 4: VEHICLE REGISTRATION — the actual rego (e.g. "DF25LB") — short 5-7 char code
  Line 5: Expiry date (e.g. "EXP 11/30")

Also look for handwritten notes, and the vehicle odometer if visible.

═══════════════════════════════════════════════════
STEP 4: OUTPUT FORMAT
═══════════════════════════════════════════════════

Return ONLY valid JSON with no other text:
{
  "date": "DD/MM/YYYY — Australian format. If receipt shows 16/03/26 return 16/03/2026.",
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
const buildCardScanPrompt = () => `Extract fleet card details from this image. This should show a Shell FleetCard — an orange/red plastic card with an embossed (raised) 16-digit number.

CARD LAYOUT (top to bottom):
Line 1: "FleetCard" logo
Line 2: 16-digit card number, EMBOSSED (raised ridges) — always starts with "7034"
Line 3: Cardholder surname + vehicle model description (e.g. "WHITE NNR-451", "SMITH HILUX") — this is NOT the registration
Line 4: VEHICLE REGISTRATION — short 5-7 character alphanumeric code (e.g. "DF25LB", "EIA53F", "BC12AB")
Line 5: Expiry date (e.g. "EXP 11/30")

CRITICAL RULES:
- The 16-digit card number is EMBOSSED. Embossed digits create raised ridges that cast shadows under flash photography. Common misreads from shadows: 8↔6, 8↔3, 1↔7, 0↔8, 5↔6, 5↔3, 9↔0. Look CAREFULLY at each digit — the ridge shape, not the shadow, is the true digit.
- The card number ALWAYS starts with "7034". If you read a first four digits that aren't "7034", you have misread the opening digits — re-read.
- The registration is on the line BELOW the surname. Do NOT return the surname line as the rego.
- If there is also a receipt visible in the photo and it says "FLEETCARD" in text, that is just a transaction label — it is NOT the card number. The card number must come from the PHYSICAL plastic card with 16 embossed digits.
- If you cannot clearly see all 16 embossed digits, return null for cardNumber rather than guessing.
- If the angle/glare/blur makes ANY digit ambiguous, set confidence.overall to "medium" or "low" and list the specific ambiguity in confidence.issues.

Return ONLY valid JSON (no other text):
{
  "cardNumber": "16 digit card number or null",
  "vehicleOnCard": "registration from the line below the surname, or null",
  "rawCardRead": "the exact digits you read before any guessing — same as cardNumber if confident, or what you best-effort deciphered",
  "confidence": {
    "overall": "high | medium | low",
    "issues": ["list any specific digits or characters that were unclear, e.g. '3rd digit could be 8 or 6', 'rego partially obscured'"]
  }
}

CONFIDENCE GUIDE:
- "high" — card is in focus, no glare, every digit unambiguous.
- "medium" — one or two digits required careful inspection or the image has minor blur/glare but you are reasonably sure.
- "low" — image is blurry, heavily shadowed, partially obscured, or you had to guess at multiple digits.`;

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
      const [, p1, p2, p3] = parts;
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

  // ── STRATEGY 1: Match by REGO (most reliable — short text, easier for AI to read) ──
  let confusableRegos = []; // regos within edit distance 1 of each other (e.g. DF25LB/DF26LB)
  if (cleanScannedRego && cleanScannedRego.length >= 3) {
    // Find ALL regos within edit distance 1 of the scanned rego
    const closeMatches = [];
    for (const known of allRegos) {
      const dist = editDistance(cleanScannedRego, known.rego);
      if (dist <= 1) closeMatches.push({ ...known, dist });
    }
    // Sort by distance (exact first), then alphabetically
    closeMatches.sort((a, b) => a.dist - b.dist || a.rego.localeCompare(b.rego));
    // Deduplicate by rego
    const seen = new Set();
    const unique = closeMatches.filter(m => { if (seen.has(m.rego)) return false; seen.add(m.rego); return true; });

    if (unique.length > 0) {
      const bestRegoEntry = unique[0];
      const cardMatch = knownCards.find(k => k.rego === bestRegoEntry.rego);
      if (cardMatch) {
        bestMatch = cardMatch;
        bestScore = bestRegoEntry.dist;
      } else {
        bestMatch = { card: "", rego: bestRegoEntry.rego, unique8: "", source: bestRegoEntry.source };
        bestScore = bestRegoEntry.dist;
      }
      // If multiple regos are within distance 1, flag as confusable
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
        // No rego match — use card match
        bestMatch = bestCardMatch;
        bestScore = bestCardDist;
      } else if (bestCardMatch.rego === bestMatch.rego) {
        // Card confirms rego. If Strategy 1 picked a rego-only entry that had
        // no card data (e.g. a REGO_DB row without `c`), upgrade to the
        // bestCardMatch row — it has the authoritative card number we need.
        if (!bestMatch.card && bestCardMatch.card) {
          bestMatch = bestCardMatch;
        }
        bestScore = 0;
      } else if (bestCardDist === 0 && bestScore > 0) {
        // Card is exact but rego pointed elsewhere — trust exact card
        bestMatch = bestCardMatch;
        bestScore = 0;
      }
      // Otherwise keep the rego match — rego is more reliable
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

  return {
    cardNumber: bestMatch?.card || scannedCard || null,
    vehicleOnCard: bestMatch?.rego || scannedRego || null,
    _corrected: bestScore > 0 && bestMatch !== null,
    _confidence: confidence,
    _confusableRegos: confusableRegos.length > 1 ? confusableRegos : null,
    _originalCard: bestScore > 0 ? scannedCard : null,
    _originalRego: bestScore > 0 ? scannedRego : null,
  };
}

async function claudeScan(apiKey, b64, mime, prompt) {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-opus-4-20250514",
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
              driverName: normalizeDriverName(f.driverName.trim()),
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
                  driverName: normalizeDriverName(f.driverName.trim()),
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
                  driverName: normalizeDriverName(f.driverName.trim()),
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
function getEntryFlags(entry, prevEntry, vehicleType, svcData) {
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
    const range = EFFICIENCY_RANGES[vehicleType] || EFFICIENCY_RANGES.Other;
    const effUnit = hrsMode ? "L/hr" : "L/km";
    const decimals = hrsMode ? 1 : 3;
    if (efficiency > range.high) {
      flags.push({ category: "ops", type: "warn", text: "High fuel usage", detail: `${efficiency.toFixed(decimals)} ${effUnit} \u2014 above expected for ${vehicleType}` });
    } else if (efficiency < range.low) {
      flags.push({ category: "ops", type: "info", text: "Low fuel usage", detail: `${efficiency.toFixed(decimals)} ${effUnit} \u2014 below expected` });
    }
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

  const [apiKey, setApiKey] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
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
  const [dashPeriod, setDashPeriod] = useState("monthly"); // "daily" | "weekly" | "monthly" | "custom" | "all"
  const [dashDate, setDashDate] = useState(() => new Date().toISOString().slice(0, 10)); // YYYY-MM-DD
  const [dashDateEnd, setDashDateEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [expandedRego, setExpandedRego] = useState(null);
  const [serviceModal, setServiceModal] = useState(null);
  const [showFlags, setShowFlags] = useState(false);
  const [showAiReview, setShowAiReview] = useState(false);
  const [showAiFlags, setShowAiFlags] = useState(false);
  const [resolvedFlags, setResolvedFlags] = useState({}); // { "flagId": { by, note, at } }
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
  const [fleetCardTxns, setFleetCardTxns] = useState([]); // imported fleet card transactions
  const [reconFilter, setReconFilter] = useState("all"); // "all" | "matched" | "mismatched" | "missing"
  const [reconSearch, setReconSearch] = useState("");
  const [reconUploading, setReconUploading] = useState(false);
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

  // ── Receipt image storage (Supabase app_settings) ──
  const saveReceiptImage = async (entryId, b64, mime) => {
    try {
      // Compress the image first to keep DB storage manageable
      const compressed = await compressReceiptImage(b64, mime);
      const imgData = JSON.stringify({ b64: compressed.b64, mime: compressed.mime });

      if (supabase) {
        // Primary: save to Supabase app_settings table (reliable, no bucket needed)
        await db.saveSetting(`receipt_img_${entryId}`, imgData);
        // Mark entry as having a receipt — immutable update so React re-renders
        // and the ref stays consistent with state (no mutation of old objects).
        const entry = entriesRef.current.find(e => e.id === entryId);
        if (entry) {
          const updated = { ...entry, hasReceipt: true, receiptUrl: `__db__${entryId}` };
          const nextEntries = entriesRef.current.map(e => e.id === entryId ? updated : e);
          entriesRef.current = nextEntries;
          setEntries(nextEntries);
          db.saveEntry(updated).catch(() => {});
        }
        console.log("Receipt image saved to database for entry:", entryId);
      } else {
        // No Supabase — fallback to localStorage
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
        // Delete from app_settings
        await db.saveSetting(`receipt_img_${entryId}`, null);
        // Also try Supabase Storage (legacy)
        await supabase.storage.from("receipts").remove([`${entryId}.jpg`, `${entryId}.png`]).catch(() => {});
      }
      // Also clean up localStorage fallback
      await window.storage.delete(`fuel_receipt_img_${entryId}`);
    } catch (_) {}
  };

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
        const [eRes, kRes, sRes, lRes, rRes, pRes] = await Promise.all([
          window.storage.get("fuel_entries").catch(() => null),
          window.storage.get("fuel_api_key").catch(() => null),
          window.storage.get("fuel_service_data").catch(() => null),
          window.storage.get("fuel_learned_db").catch(() => null),
          window.storage.get("fuel_resolved_flags").catch(() => null),
          window.storage.get("fuel_admin_passcode").catch(() => null),
        ]);
        let localEntries = eRes?.value ? JSON.parse(eRes.value) : [];
        let localService = sRes?.value ? JSON.parse(sRes.value) : {};
        let localResolved = rRes?.value ? JSON.parse(rRes.value) : {};
        if (kRes?.value) { setApiKey(kRes.value); setApiKeyInput(kRes.value); }
        if (lRes?.value) setLearnedDB(JSON.parse(lRes.value));
        if (pRes?.value) { setAdminPasscode(pRes.value); setPasscodeInput(pRes.value); }
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
  const persist = async (newEntries, changedEntry = null) => {
    entriesRef.current = newEntries;
    setEntries(newEntries);
    try { await window.storage.set("fuel_entries", JSON.stringify(newEntries)); } catch (_) {}
    // Sync to cloud: save only the changed entry (faster than saving everything)
    if (changedEntry) {
      db.saveEntry(changedEntry).catch(() => {});
    }
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
    try { await window.storage.set("fuel_resolved_flags", JSON.stringify(newData)); } catch (_) {}
    if (changedFlagId) {
      if (deleted) {
        db.deleteResolvedFlag(changedFlagId).catch(() => {});
      } else if (newData[changedFlagId]) {
        db.saveResolvedFlag(changedFlagId, newData[changedFlagId]).catch(() => {});
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
    // Debounce: skip if we just refreshed <2s ago, unless force=true
    if (!force && now - lastRefreshAttemptRef.current < 2000) return;
    lastRefreshAttemptRef.current = now;
    setIsSyncing(true);
    try {
      const [cloudEntries, cloudService, cloudResolved, cloudApiKey] = await Promise.all([
        db.loadEntries().catch(() => null),
        db.loadServiceData().catch(() => null),
        db.loadResolvedFlags().catch(() => null),
        db.loadSetting("anthropic_api_key").catch(() => null),
      ]);
      if (cloudEntries) {
        setEntries(cloudEntries);
        entriesRef.current = cloudEntries;
        try { await window.storage.set("fuel_entries", JSON.stringify(cloudEntries)); } catch (_) {}
      }
      if (cloudService) {
        setServiceData(cloudService);
        try { await window.storage.set("fuel_service_data", JSON.stringify(cloudService)); } catch (_) {}
      }
      if (cloudResolved) {
        setResolvedFlags(cloudResolved);
        try { await window.storage.set("fuel_resolved_flags", JSON.stringify(cloudResolved)); } catch (_) {}
      }
      if (cloudApiKey) {
        setApiKey(cloudApiKey);
        setApiKeyInput(cloudApiKey);
      }
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
  // from one computer reach others quickly:
  //   1) Tab becomes visible again → refresh
  //   2) Window regains focus → refresh
  //   3) Supabase Realtime push on fuel_entries / app_settings / service_data /
  //      resolved_flags → refresh
  //   4) Periodic 60s interval while tab is visible → safety net
  useEffect(() => {
    if (!supabase || !storageReady) return;

    const handleVisibility = () => {
      if (document.visibilityState === "visible") refreshFromCloud({ silent: true });
    };
    const handleFocus = () => refreshFromCloud({ silent: true });

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);

    // Periodic poll (60s) — only when the tab is visible.
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") refreshFromCloud({ silent: true });
    }, 60_000);

    // Realtime subscriptions — push-based near-instant updates. If Realtime
    // isn't enabled on a table in the Supabase dashboard, the subscribe will
    // simply no-op and we fall back to the focus/interval triggers above.
    const channels = [];
    try {
      const triggerRefresh = () => refreshFromCloud({ silent: true });
      const mkChannel = (name, table) =>
        supabase
          .channel(`sync-${name}`)
          .on("postgres_changes", { event: "*", schema: "public", table }, triggerRefresh)
          .subscribe();
      channels.push(mkChannel("entries", "fuel_entries"));
      channels.push(mkChannel("settings", "app_settings"));
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
    const updated = { ...resolvedFlags, [fid]: flagData };
    persistResolved(updated, fid);
  };

  const unresolveFlag = (fid) => {
    const { [fid]: _, ...rest } = resolvedFlags;
    persistResolved(rest, fid, true);
  };

  // Bulk resolve — single local/state write, parallel cloud writes.
  // Much faster than looping resolveFlag() which would serialise N network calls.
  const resolveFlagsBulk = async (fids, note, by) => {
    if (!fids || fids.length === 0) return;
    const at = new Date().toISOString();
    const flagData = { by: by || "Admin", note: note || "Bulk resolved", at };
    const updated = { ...resolvedFlags };
    for (const fid of fids) updated[fid] = flagData;
    setResolvedFlags(updated);
    try { await window.storage.set("fuel_resolved_flags", JSON.stringify(updated)); } catch (_) {}
    // Fire all cloud writes in parallel — failures don't block the UI.
    await Promise.all(fids.map(fid => db.saveResolvedFlag(fid, flagData).catch(() => {})));
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
    setReceiptData(null); setCardData(null);
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
        const orientResult = await claudeScan(apiKey, b64, mime, ORIENTATION_PROMPT);
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
      let result = await claudeScan(apiKey, b64, mime, buildReceiptScanPrompt());
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
            const retryResult = await claudeScan(apiKey, original.b64, original.mime, buildReceiptScanPrompt());
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
        const matched = fuzzyMatchFleetCard(normalized.cardNumber, normalized.vehicleOnCard, learnedDBRef.current, learnedCardMappingsRef.current);
        setCardData(buildCardDataFromMatch(matched, result));
        // Known card/rego exception (e.g. Carlos Carillo's WIA53F card for EIA53F vehicle):
        // auto-fill form registration with the ACTUAL vehicle rego, not the one on the card.
        if (matched._knownException && matched.actualVehicleRego && !form.registration) {
          setForm(f => ({ ...f, registration: matched.actualVehicleRego }));
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
    setReceiptScanning(true); setError(""); setReceiptData(null); setCardData(null); setReviewConfirmed(false);
    try {
      const { b64, mime } = await compressImage(receiptFile, newRotation);
      if (scanIdRef.current !== currentScanId) return;
      setReceiptB64(b64);
      setReceiptMime(mime);
      setReceiptPreview(`data:${mime};base64,${b64}`);
      const result = await claudeScan(apiKey, b64, mime, buildReceiptScanPrompt());
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
        const matched = fuzzyMatchFleetCard(normalized.cardNumber, normalized.vehicleOnCard, learnedDBRef.current, learnedCardMappingsRef.current);
        setCardData(buildCardDataFromMatch(matched, result));
        // Known card/rego exception (e.g. Carlos Carillo's WIA53F card for EIA53F vehicle):
        // auto-fill form registration with the ACTUAL vehicle rego, not the one on the card.
        if (matched._knownException && matched.actualVehicleRego && !form.registration) {
          setForm(f => ({ ...f, registration: matched.actualVehicleRego }));
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
      const result = await claudeScan(apiKey, receiptB64, receiptMime, buildReceiptScanPrompt());
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
        const matched = fuzzyMatchFleetCard(normalized.cardNumber, normalized.vehicleOnCard, learnedDBRef.current, learnedCardMappingsRef.current);
        setCardData(buildCardDataFromMatch(matched, result));
        // Known card/rego exception (e.g. Carlos Carillo's WIA53F card for EIA53F vehicle):
        // auto-fill form registration with the ACTUAL vehicle rego, not the one on the card.
        if (matched._knownException && matched.actualVehicleRego && !form.registration) {
          setForm(f => ({ ...f, registration: matched.actualVehicleRego }));
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
      const result = await claudeScan(apiKey, b64, mime, buildCardScanPrompt());
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
        driverName: normalizeDriverName(`${form.driverFirstName.trim()} ${form.driverLastName.trim()}`.trim()),
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
        driverName: normalizeDriverName(`${form.driverFirstName.trim()} ${form.driverLastName.trim()}`.trim()),
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
            driverName: normalizeDriverName(`${form.driverFirstName.trim()} ${form.driverLastName.trim()}`.trim()),
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

  const deleteEntry = async (id) => {
    // Read from the ref, not the closure-captured `entries` — a Realtime
    // refresh between render and click would otherwise make us persist a
    // stale array and silently delete entries added on other devices.
    const entry = entriesRef.current.find(e => e.id === id);
    const orphanFlags = collectOrphanFlagIds(entry);
    await persist(entriesRef.current.filter(e => e.id !== id));
    db.deleteEntry(id).catch(() => {});
    await deleteReceiptImage(id);
    // Cleanup orphan flag resolutions so they can't silently auto-resolve a
    // future entry that happens to share this entry's rego+date+odo tuple.
    if (orphanFlags.length > 0) {
      const rest = { ...resolvedFlags };
      orphanFlags.forEach(fid => { delete rest[fid]; });
      await persistResolved(rest);
      orphanFlags.forEach(fid => db.deleteResolvedFlag(fid).catch(() => {}));
    }
    showToast("Entry deleted");
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
      const result = await claudeScan(apiKey, b64, mime, buildCardScanPrompt());
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
        <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>Photo</div>
        <div style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>
          Take a clear photo including both the receipt and fleet card in the same photo. Make sure the entire receipt is visible and the fleet card number is shown clearly.
          {splitMode && <><br /><span style={{ color: "#1e40af", fontWeight: 500 }}>Split receipt: litres will be allocated per vehicle from Step 1</span></>}
        </div>
        <div style={{
          marginTop: 8, padding: "8px 12px", background: "#eff6ff", border: "1px solid #93c5fd",
          borderRadius: 8, fontSize: 11, color: "#1e40af",
        }}>
          <strong>Tips for a good scan:</strong> Lay the receipt flat {"\u00B7"} Place the fleet card next to it showing the full 16-digit number {"\u00B7"} Make sure all text is in focus and nothing is cut off
        </div>
      </div>
      {!apiKey && (
        <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: 10, marginBottom: 14, fontSize: 13, color: "#b45309" }}>
          No API key set. Go to Settings to add your Anthropic API key.
        </div>
      )}
      <PhotoUpload preview={receiptPreview} scanning={receiptScanning} onFile={handleReceiptFile}
        inputRef={receiptRef} label="Receipt & fleet card photo" caption="Both receipt and fleet card in one clear photo" />

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

      {/* Fleet card detected from the same photo */}
      {hasCard && (
        <div className="fade-in" style={{
          background: cardData._corrected ? "#f0fdf4" : "#fff7ed",
          border: `1px solid ${cardData._corrected ? "#86efac" : "#fdba74"}`,
          borderRadius: 8, padding: "8px 12px", marginTop: 10, fontSize: 12,
        }}>
          <div style={{ fontWeight: 700, color: cardData._corrected ? "#15803d" : "#c2410c", marginBottom: 4, fontSize: 11 }}>
            {"\uD83D\uDCB3"} Fleet card {cardData._corrected ? "matched & auto-corrected" : "detected"}
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
      primaryLine = null; // non-split uses receiptData directly
    }
    const primaryFuelType = primaryLine?.fuelType || receiptData?.fuelType || regoMatch?.f || "";
    const primaryLitres = splitMode
      ? (form.litres || primaryLine?.litres?.toString() || "0")
      : (receiptData?._rawLitres || receiptData?.litres?.toString() || "");

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
    } else {
      const lineCost = parseFloat(receiptData?._rawCost || receiptData?.fuelCost || receiptData?.totalCost || 0);
      if (userLitres > 0 && lineCost > 0) {
        primaryPpl = parseFloat((lineCost / userLitres).toFixed(4));
      } else {
        primaryPpl = primaryLine?.pricePerLitre || globalPpl;
      }
    }

    // Cost logic:
    // - In split mode: cost = user's litres × price per litre (not the full receipt cost)
    // - In non-split mode: use the scanned cost directly
    const primaryCost = receiptData?._rawCost
      || (splitMode
        ? (userLitres > 0 && primaryPpl > 0 ? (userLitres * primaryPpl).toFixed(2) : (primaryLine?.cost?.toFixed(2) || ""))
        : (receiptData?.fuelCost?.toString() || receiptData?.totalCost?.toString() || ""));

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
      { label: "Litres", val: primaryLitres, set: v => { if (splitMode) setForm(f => ({...f, litres: v})); else setReceiptData(d => ({...d, litres: v, _rawLitres: v})); } },
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
                        const flags = getEntryFlags(e, i > 0 ? sorted[i - 1] : null, vt, serviceData[rego]);
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
                                        const flags = getEntryFlags(e, prev, vt, serviceData[rego]);
                                        const hasFlag = flags.some(f => f.type === "danger" || f.type === "warn");
                                        const showSvc = i === sorted.length - 1;
                                        const effRange = EFFICIENCY_RANGES[vt] || EFFICIENCY_RANGES.Other;

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
                          {["Driver", "PT / Equipment", "Station", "Fleet Card", "Card Rego", "Date", "Litres", "$/L", "Cost", "Notes", ""].map(h => (
                            <th key={h} style={{ color: divColor.text, borderBottom: `2px solid ${divColor.border}` }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {divEntries.map(e => (
                          <tr key={e.id} style={{ background: "white" }}>
                            <td style={{ fontWeight: 500, color: "#374151" }}>{e.driverName || "\u2014"}</td>
                            <td style={{ fontWeight: 600, color: divColor.text }}>{e.equipment || "\u2014"}</td>
                            <td style={{ color: "#64748b" }}>{e.station || "\u2014"}</td>
                            <td style={{ color: "#374141", fontSize: 10 }}>{formatCardNumber(e.fleetCardNumber) || "\u2014"}</td>
                            <td style={{ fontWeight: 600, color: "#374151" }}>{e.cardRego || "\u2014"}</td>
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
        getEntryFlags(e, prev, vt, serviceData[rego]).forEach(f => flags.push({ ...f, rego, date: e.date, odo: e.odometer, _entryId: e.id, _entry: e }));
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
  }, [entries, serviceData]);

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
          background: "white", border: "1px solid #e2e8f0", borderRadius: 10,
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
              const effRange = EFFICIENCY_RANGES[v.vt] || EFFICIENCY_RANGES.Other;
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
                            const effRange = EFFICIENCY_RANGES[v.vt] || EFFICIENCY_RANGES.Other;
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
          const totalLitresAll = sorted.reduce((s, [, v]) => s + v.litres, 0);
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
    let driverList = Object.values(driverMap).sort((a, b) => a.name.localeCompare(b.name));

    // Filter by search
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
          // Use merged driver list to avoid duplicates
          const allDriverNames = Object.values(driverMap).map(d => d.name).sort();
          const activeDrivers = new Set();
          Object.values(driverMap).forEach(d => {
            d.entries.forEach(e => {
              if (!e.date) return;
              const dt = parseDate(e.date);
              if (dt && new Date(dt) >= weekAgo) activeDrivers.add(d.name);
            });
          });
          const inactiveDrivers = allDriverNames.filter(d => !activeDrivers.has(d));
          const driverLastEntry = {};
          Object.values(driverMap).forEach(drv => {
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
              {/* Driver header */}
              <button onClick={() => setExpandedDriver(isExpanded ? null : driver.name.toLowerCase())} style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 14px", borderRadius: 10, border: "1px solid #e2e8f0",
                background: isExpanded ? "#f0fdf4" : "white", cursor: "pointer", fontFamily: "inherit",
                transition: "all 0.15s",
              }}>
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
      </div>
    );
  };

  // ── Fleet Card CSV Parser ──────────────────────────────────────────────
  const parseFleetCardCSV = (text) => {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];
    // Parse header — normalize common column names
    const rawHeaders = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, "").toLowerCase());
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
      // Fallback: generic date column (only if transaction date not found)
      else if (!colMap.date && /^date$/.test(h)) colMap.date = i;
    });
    // Parse rows
    const txns = [];
    for (let r = 1; r < lines.length; r++) {
      // Handle quoted CSV fields
      const row = [];
      let cur = "", inQ = false;
      for (const ch of lines[r]) {
        if (ch === '"') { inQ = !inQ; }
        else if (ch === ',' && !inQ) { row.push(cur.trim()); cur = ""; }
        else { cur += ch; }
      }
      row.push(cur.trim());
      if (row.length < 3) continue; // skip empty/malformed rows
      const get = (key) => colMap[key] != null ? (row[colMap[key]] || "").replace(/^"|"$/g, "").trim() : "";
      const litres = parseFloat(get("litres")) || null;
      const cost = parseFloat(get("cost")?.replace(/[$,]/g, "")) || null;
      const ppl = parseFloat(get("ppl")?.replace(/[$,]/g, "")) || (litres && cost ? parseFloat((cost / litres).toFixed(4)) : null);
      const rawCard = get("cardNumber").replace(/[\[\]\s]/g, ""); // strip [brackets] and spaces
      const rawOdo = get("odometer");
      const odoVal = parseFloat(rawOdo) || null;
      const txn = {
        id: `txn-${Date.now()}-${r}-${Math.random().toString(36).slice(2, 6)}`,
        date: get("date"),
        time: get("time") || null,
        cardNumber: rawCard,
        rego: get("rego").toUpperCase().replace(/[^A-Z0-9]/g, ""),
        litres,
        ppl,
        cost,
        station: get("station"),
        odometer: odoVal && odoVal > 0 && odoVal !== 777 ? odoVal : null, // 777 = placeholder in fleet card data
        driver: get("driver"),
        product: get("product"),
        transactionNumber: get("transactionNumber") || null,
        importedAt: new Date().toISOString(),
      };
      // Skip rows with no usable data
      if (!txn.date && !txn.cardNumber && !txn.rego && !txn.cost) continue;
      txns.push(txn);
    }
    return txns;
  };

  // ── Fleet Card Transaction Matching ───────────────────────────────────────
  const matchTransactionToEntry = (txn) => {
    // Try to find a matching entry by card number + date + cost (with tolerance)
    const candidates = entries.filter(e => {
      // Date must match
      if (!txn.date || !e.date) return false;
      const txnDate = parseDate(txn.date);
      const entryDate = parseDate(e.date);
      if (!txnDate || !entryDate || txnDate !== entryDate) return false;
      // Card number or rego must match
      const cardMatch = txn.cardNumber && e.fleetCardNumber && txn.cardNumber.replace(/\s/g, "") === e.fleetCardNumber.replace(/\s/g, "");
      const regoMatch = txn.rego && e.registration && txn.rego === e.registration.toUpperCase();
      return cardMatch || regoMatch;
    });
    if (candidates.length === 0) return { status: "missing", entry: null };
    // Find best match by cost
    let best = candidates[0], bestDiff = Infinity;
    for (const c of candidates) {
      if (txn.cost != null && c.totalCost != null) {
        const diff = Math.abs(txn.cost - c.totalCost);
        if (diff < bestDiff) { bestDiff = diff; best = c; }
      }
    }
    // Check if costs match within tolerance ($2 or 5%)
    if (txn.cost != null && best.totalCost != null) {
      const diff = Math.abs(txn.cost - best.totalCost);
      const pct = best.totalCost > 0 ? (diff / best.totalCost) * 100 : 0;
      if (diff > 2 && pct > 5) return { status: "mismatched", entry: best, diff };
    }
    return { status: "matched", entry: best };
  };

  // ── Reconciliation View ───────────────────────────────────────────────────
  const renderReconciliation = () => {
    const handleCSVUpload = async (file) => {
      if (!file) return;
      setReconUploading(true);
      try {
        let text;
        if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
          const buf = await file.arrayBuffer();
          const wb = XLSX.read(buf, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          text = XLSX.utils.sheet_to_csv(ws);
        } else {
          text = await file.text();
        }
        const newTxns = parseFleetCardCSV(text);
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
        showToast(`Imported ${added} new transaction${added !== 1 ? "s" : ""} (${newTxns.length - added} duplicates skipped)`);
      } catch (err) {
        showToast("Failed to parse file: " + err.message, "warn");
      }
      setReconUploading(false);
    };

    // Run matching on all imported transactions
    const results = fleetCardTxns.map(txn => ({
      txn,
      ...matchTransactionToEntry(txn),
    }));

    const matched = results.filter(r => r.status === "matched");
    const mismatched = results.filter(r => r.status === "mismatched");
    const missing = results.filter(r => r.status === "missing");

    // Also find receipts with no matching transaction ("receipt only")
    const matchedEntryIds = new Set(results.filter(r => r.entry).map(r => r.entry.id));

    // Filter
    const filtered = reconFilter === "all" ? results
      : reconFilter === "matched" ? matched
      : reconFilter === "mismatched" ? mismatched
      : missing;

    // Search
    const searchTerm = reconSearch.trim().toUpperCase();
    const searched = searchTerm
      ? filtered.filter(r =>
          (r.txn.rego || "").includes(searchTerm) ||
          (r.txn.cardNumber || "").includes(searchTerm) ||
          (r.txn.driver || "").toUpperCase().includes(searchTerm) ||
          (r.txn.station || "").toUpperCase().includes(searchTerm) ||
          (r.entry?.registration || "").toUpperCase().includes(searchTerm) ||
          (r.entry?.driverName || "").toUpperCase().includes(searchTerm)
        )
      : filtered;

    return (
      <div className="fade-in">
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>Fleet Card Reconciliation</div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>
            Upload daily or monthly fleet card CSV/Excel to match against scanned receipts
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
            {reconUploading ? "Importing..." : "Drop fleet card CSV/Excel here or tap to upload"}
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
            Supports CSV and Excel (.xlsx) {"\u00B7"} Auto-detects columns by header names
          </div>
        </div>

        {/* Stats bar */}
        {fleetCardTxns.length > 0 && (
          <>
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 12,
            }}>
              {[
                { label: "Total", count: results.length, color: "#374151", bg: "#f8fafc", border: "#e2e8f0" },
                { label: "Matched", count: matched.length, color: "#15803d", bg: "#f0fdf4", border: "#86efac" },
                { label: "Mismatched", count: mismatched.length, color: "#b45309", bg: "#fffbeb", border: "#fcd34d" },
                { label: "Missing Receipt", count: missing.length, color: "#dc2626", bg: "#fef2f2", border: "#fca5a5" },
              ].map(s => (
                <button key={s.label} onClick={() => setReconFilter(s.label === "Total" ? "all" : s.label === "Missing Receipt" ? "missing" : s.label.toLowerCase())}
                  style={{
                    background: (reconFilter === "all" && s.label === "Total") || reconFilter === s.label.toLowerCase() || (reconFilter === "missing" && s.label === "Missing Receipt")
                      ? s.bg : "white",
                    border: `1px solid ${(reconFilter === "all" && s.label === "Total") || reconFilter === s.label.toLowerCase() || (reconFilter === "missing" && s.label === "Missing Receipt") ? s.border : "#e2e8f0"}`,
                    borderRadius: 8, padding: "8px 4px", cursor: "pointer", fontFamily: "inherit", textAlign: "center",
                  }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.count}</div>
                  <div style={{ fontSize: 10, color: s.color, fontWeight: 600, marginTop: 2 }}>{s.label}</div>
                </button>
              ))}
            </div>

            {/* Search */}
            <div style={{ marginBottom: 12 }}>
              <input value={reconSearch} onChange={e => setReconSearch(e.target.value)}
                placeholder="Search by rego, card number, driver, station..."
                style={{
                  width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #e2e8f0",
                  fontSize: 13, fontFamily: "inherit", outline: "none", color: "#0f172a",
                }}
                onFocus={e => e.target.style.borderColor = "#22c55e"}
                onBlur={e => e.target.style.borderColor = "#e2e8f0"}
              />
            </div>

            {/* Transaction list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {searched.length === 0 && (
                <div style={{ textAlign: "center", padding: 20, color: "#94a3b8", fontSize: 13 }}>
                  No transactions match the current filter
                </div>
              )}
              {searched.map(({ txn, status, entry, diff }) => (
                <div key={txn.id} style={{
                  background: "white", border: `1px solid ${status === "matched" ? "#86efac" : status === "mismatched" ? "#fcd34d" : "#fca5a5"}`,
                  borderRadius: 10, overflow: "hidden",
                }}>
                  {/* Status header */}
                  <div style={{
                    padding: "6px 12px", fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase",
                    background: status === "matched" ? "#f0fdf4" : status === "mismatched" ? "#fffbeb" : "#fef2f2",
                    color: status === "matched" ? "#15803d" : status === "mismatched" ? "#b45309" : "#dc2626",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <span>{status === "matched" ? "\u2713 Matched" : status === "mismatched" ? "\u26A0 Amount Mismatch" : "\u2717 Missing Receipt"}</span>
                    {txn.date && <span style={{ fontWeight: 500, opacity: 0.8 }}>{txn.date}</span>}
                  </div>

                  <div style={{ padding: "10px 12px" }}>
                    {/* Transaction row */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 12 }}>
                      <div>
                        <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, marginBottom: 2 }}>FLEET CARD</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                          {txn.rego && <span style={{ fontWeight: 700, color: "#0f172a" }}>{txn.rego}</span>}
                          {txn.driver && <span style={{ color: "#64748b" }}>{txn.driver}</span>}
                        </div>
                        <div style={{ color: "#64748b", marginTop: 2, fontSize: 11 }}>
                          {txn.litres != null && <span>{txn.litres}L</span>}
                          {txn.ppl != null && <span> @ ${txn.ppl}/L</span>}
                          {txn.cost != null && <span style={{ fontWeight: 600, color: "#0f172a" }}> = ${txn.cost.toFixed(2)}</span>}
                        </div>
                        {txn.station && <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{txn.station}</div>}
                        {txn.product && <div style={{ fontSize: 10, color: "#94a3b8" }}>{txn.product}</div>}
                        {txn.cardNumber && <div style={{ fontSize: 9, color: "#cbd5e1", marginTop: 2, fontFamily: "monospace" }}>{formatCardNumber(txn.cardNumber)}</div>}
                      </div>

                      {entry ? (
                        <div style={{ borderLeft: "2px solid #e2e8f0", paddingLeft: 10 }}>
                          <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, marginBottom: 2 }}>SCANNED RECEIPT</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                            {entry.registration && <span style={{ fontWeight: 700, color: "#0f172a" }}>{entry.registration}</span>}
                            {entry.driverName && <span style={{ color: "#64748b" }}>{entry.driverName}</span>}
                          </div>
                          <div style={{ color: "#64748b", marginTop: 2, fontSize: 11 }}>
                            {entry.litres != null && <span>{entry.litres}L</span>}
                            {entry.pricePerLitre != null && <span> @ ${entry.pricePerLitre}/L</span>}
                            {entry.totalCost != null && <span style={{ fontWeight: 600, color: "#0f172a" }}> = ${entry.totalCost.toFixed(2)}</span>}
                          </div>
                          {entry.station && <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{entry.station}</div>}
                          {status === "mismatched" && diff != null && (
                            <div style={{ marginTop: 4, fontSize: 11, fontWeight: 700, color: "#b45309", background: "#fffbeb", padding: "2px 8px", borderRadius: 4, display: "inline-block" }}>
                              Difference: ${diff.toFixed(2)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ borderLeft: "2px solid #fca5a5", paddingLeft: 10, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                          <div style={{ fontSize: 12, color: "#dc2626", fontWeight: 600 }}>No receipt uploaded</div>
                          <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
                            {txn.driver ? `Follow up with ${txn.driver}` : "Driver unknown"}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Clear button */}
            <div style={{ marginTop: 16, textAlign: "center" }}>
              <button onClick={() => setConfirmAction({
                message: `Clear all ${fleetCardTxns.length} imported fleet card transactions? This cannot be undone.`,
                onConfirm: async () => {
                  setFleetCardTxns([]);
                  await db.saveFleetCardTransactions([]);
                  setConfirmAction(null);
                  showToast("Fleet card transactions cleared");
                }
              })} style={{
                padding: "8px 16px", background: "#fef2f2", color: "#b91c1c", border: "1px solid #fca5a5",
                borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
              }}>Clear all imported transactions</button>
            </div>
          </>
        )}

        {fleetCardTxns.length === 0 && (
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
          const mappingEntries = Object.entries(learnedCardMappings)
            .sort(([, a], [, b]) => (a.correctRego || "").localeCompare(b.correctRego || ""));
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
                        <td style={{ fontWeight: 600, color: "#0f172a", fontSize: 12 }}>{m.correctRego || "\u2014"}</td>
                        <td style={{ color: "#dc2626", fontSize: 11, fontFamily: "monospace" }}>
                          {m.rawCard ? `...${m.rawCard.slice(-8)}` : m.rawRego || key}
                        </td>
                        <td style={{ color: "#16a34a", fontSize: 11, fontFamily: "monospace", fontWeight: 600 }}>
                          ...{m.correctCard?.slice(-8) || "?"}
                        </td>
                        <td style={{ color: "#64748b", fontSize: 10 }}>
                          {m.learnedAt ? new Date(m.learnedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" }) : "\u2014"}
                        </td>
                        <td>
                          <button onClick={() => {
                            const { [key]: _, ...rest } = learnedCardMappings;
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

      <div style={{ maxWidth: (view === "data" || view === "dashboard" || view === "cards" || view === "drivers" || view === "reconcile") ? 960 : 520, margin: "0 auto", padding: "24px 16px", transition: "max-width 0.3s" }}>
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
          onDelete={(id) => { deleteEntry(id); setEditingEntry(null); }}
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
