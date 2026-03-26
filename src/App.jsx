import { useState, useRef, useEffect, useCallback, useMemo } from "react";
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
};

// ─── Storage compatibility layer ────────────────────────────────────────────
// localStorage acts as a fast local cache. Supabase is the cloud "source of truth".
// If Supabase is unavailable, the app still works using localStorage alone.
if (!window.storage) {
  window.storage = {
    async get(key) {
      const v = localStorage.getItem(key);
      return v !== null ? { value: v } : null;
    },
    async set(key, value) {
      localStorage.setItem(key, value);
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
    types: ["Hired Vehicle", "Mower", "Trailer", "Landscape Tractor", "Ute", "Truck"],
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
const SERVICE_WARNING_KM = 2000; // Warn at 8000km (10000 - 2000)

// Typical fuel efficiency ranges (L/km) for flagging
const EFFICIENCY_RANGES = {
  Ute: { low: 0.06, high: 0.18 },
  Truck: { low: 0.10, high: 0.45 },
  Excavator: { low: 0.05, high: 0.50 },
  EWP: { low: 0.05, high: 0.30 },
  Chipper: { low: 0.04, high: 0.30 },
  "Stump Grinder": { low: 0.03, high: 0.25 },
  Trailer: { low: 0.06, high: 0.20 },
  "Hired Vehicle": { low: 0.04, high: 0.30 },
  Mower: { low: 0.02, high: 0.15 },
  "Landscape Tractor": { low: 0.05, high: 0.35 },
  Other: { low: 0.04, high: 0.40 },
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
// ─── Driver Fleet Card Database (from fleet card spreadsheet) ───────────
const DRIVER_CARDS = [
{n:"KYLE OSBORNE",c:"7034305113700650",r:"AP85DF"},{n:"JASON SORBARA",c:"7034305108940667",r:"AT13VE"},{n:"NAISH",c:"7034305107330928",r:"BF51KJ"},{n:"JUSTIN LEWIS",c:"7034305116558659",r:"BJ57HC"},{n:"NICK JONES",c:"7034305115783134",r:"BR22ZZ"},{n:"JASON HUGHES",c:"7034305105574238",r:"BT08QM"},{n:"BRENDAN RICHARDSON",c:"7034305110165261",r:"BY38KR"},{n:"LUKE BARTLEY",c:"7034305106436460",r:"CA10BL"},{n:"BILLY PRICE",c:"7034305113893588",r:"CC24TI"},{n:"GAB FITZGERALD",c:"7034305111758833",r:"CC94JL"},{n:"JOE HUTTON",c:"7034305106228180",r:"CD36PH"},{n:"RACHAEL KEATING",c:"7034305106786955",r:"CH90KL"},{n:"DANIEL THOMSON",c:"7034305108274448",r:"CH95ZD"},{n:"KYLE OSBORNE",c:"7034305109332146",r:"CI98BZ"},{n:"KEV CARRILLO",c:"7034305108260140",r:"CJ55FB"},{n:"DAN THOMPSON",c:"7034305107310136",r:"CL52NS"},{n:"BILLY PRICE",c:"7034305116027192",r:"CM77KG"},{n:"CHRIS PLAYER",c:"7034305117020659",r:"CN47HS"},{n:"SHAUN COLE",c:"7034305113746059",r:"CP60AF"},{n:"DENNIS KOCJANCIC",c:"7034305116296961",r:"CP06YZ"},{n:"SHANE DEMIRAL",c:"7034305112151236",r:"CT74KE"},{n:"SAXON",c:"7034305106890443",r:"CV14NO"},{n:"LAURA HARDWOOD",c:"7034305114887118",r:"CX22BE"},{n:"MICK THOMAS",c:"7034305106791179",r:"CX23BE"},{n:"JAYDEN STRONG",c:"7034305112823891",r:"DB78SC"},{n:"KYLE OSBORNE",c:"7034305117002350",r:"DF25LB"},{n:"JACOB DEVEIGNE",c:"7034305110028204",r:"DF26LB"},{n:"ALEX GLYNN",c:"7034305112341555",r:"DI05QD"},{n:"DAMIAN SEMPEL",c:"7034305116822212",r:"CS63LP"},{n:"JACOB DEVEIGNE",c:"703430513408",r:"DP60DA"},{n:"BRETT SONTER",c:"7034305108863984",r:"DPL85C"},{n:"TIM PRICE",c:"7034305114660168",r:"DP90CQ"},{n:"JASON HUGHES",c:"7034305112129919",r:"DSU65Y"},{n:"PHIL CARSON",c:"7034305108545714",r:"DSU65Y"},{n:"SONYA",c:"7034305114570151",r:"EAE28V"},{n:"SAM LAW",c:"7034305113442394",r:"EBL30C"},{n:"AMELIA PLUMMER",c:"7034305115642942",r:"ECE83U"},{n:"LEE DAVIS",c:"7034305107318832",r:"EES53B"},{n:"JOE PELLIZZON",c:"7034305117257665",r:"EYO62W"},{n:"JOHN LARGEY",c:"7034305111069538",r:"EOL97X"},{n:"MARTIN HOWARD",c:"7034305113441354",r:"EQE85L"},{n:"BJ",c:"7034305110325493",r:"EQP77D"},{n:"JOE HURST",c:"7034305112846991",r:"EQP77E"},{n:"RHYS DWYER",c:"7034305109386829",r:"ERQ21S"},{n:"ANT YOUNGMAN",c:"7034305105562266",r:"EVA47B"},{n:"DECLAN KANE",c:"7034305107192484",r:"EYN61Z"},{n:"DAYNE COOMBE",c:"7034305107009274",r:"EYO02K"},{n:"CASS CHAPPLE",c:"7034305107286914",r:"EYP02J"},{n:"DANE PLUMMER",c:"7034305116249275",r:"FGP29X"},{n:"TONY PLUMMER",c:"7034305111220834",r:"FHX25L"},{n:"JOE DALEY",c:"7034305116246156",r:"FMT17H"},{n:"JASON JOHNSON",c:"7034305113817595",r:"JCJ010"},{n:"CAM WILLIAMS",c:"7034305105984726",r:"MISC3"},{n:"CARLOS CARRILLO",c:"7034305115254565",r:"WIA53F"},{n:"WADE HANNELL",c:"7034305116506179",r:"WNU522"},{n:"OLD BOGIE",c:"7034305111430383",r:"XN56BU"},{n:"NATHAN MORALES",c:"7034305110311667",r:"XN59QZ"},{n:"SCOTT WOOD",c:"7034305110006994",r:"XN95CF"},{n:"ALEX GLYNN",c:"7034305116398783",r:"XO05MA"},{n:"MATTHEW BROCK",c:"7034305108678176",r:"XO05RX"},{n:"MATT ROGERS",c:"7034305111375786",r:"XO08FN"},{n:"MAROS MENCAK",c:"7034305111698906",r:"XO20NL"},{n:"TIM PRICE",c:"7034305113655797",r:"XO49LN"},{n:"SHAUN DENNISON",c:"7034305110811948",r:"XO96XP"},{n:"STEVE NEWTON",c:"7034305111299762",r:"XP058N"},{n:"DOUG GRANT",c:"7034305116197722",r:"XP31AG"},{n:"JASON HUGHES",c:"7034305116247253",r:"XP41MC"},{n:"JASON SORBARA",c:"7034305117860930",r:"XP86LM"},{n:"ROGER BORG",c:"7034305106723230",r:"YMN14E"},{n:"MATHEW BROCK",c:"7034305108678176",r:"XO05RX"}
];

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
const REGO_DB = [{"r":"38359D","t":"Other","d":"Tree","n":"AVANT TELESCOPIC LOADER","m":"AVANT 750"},{"r":"00440E","t":"Excavator","d":"Tree","n":"EXCAVATOR  8T","m":"KUBOTA KX080"},{"r":"25393E","t":"Excavator","d":"Tree","n":"EXCAVATOR","m":"KOBELCO SK55SRX-6"},{"r":"40971E","t":"Other","d":"Tree","n":"AVANT TELESCOPIC LOADER","m":"AVANT 750"},{"r":"TA55AA","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 12in","m":"BANDIT BAN990"},{"r":"TP97AL","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 15in","m":"BANDIT 159006A"},{"r":"TD34ZR","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 15in","m":"BANDIT 159006A"},{"r":"TP99AL","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 15in","m":"BANDIT 159006A"},{"r":"TL40RW","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 15in","m":"BANDIT 159006A"},{"r":"50197D","t":"Excavator","d":"Tree","n":"EXCAVATOR 20T","m":"CASE CX210C"},{"r":"TA80QZ","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 18in","m":"BANDIT 189007A"},{"r":"53667E","t":"Excavator","d":"Tree","n":"EXCAVATOR  5.5T","m":"KOBELCO SK55S7A"},{"r":"TC70VA","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 18in","m":"BANDIT 159006A"},{"r":"61609E","t":"Excavator","d":"Tree","n":"EXCAVATOR  8T","m":"KUBOTA KX080"},{"r":"TL48UF","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 18in","m":"BANDIT 18XP"},{"r":"TL56PO","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 18in","m":"VERMEER BC1800"},{"r":"TM84AT","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 18in","m":"VERMEER BC1800"},{"r":"YN05HA","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 22in","m":"BANDIT MTETAND"},{"r":"YN29AW","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 22in","m":"BANDIT MTETAND"},{"r":"YN71AN","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 22in","m":"BANDIT MTETAND"},{"r":"BJ57HC","t":"Ute","d":"Tree","n":"TOYOTA HILUX","m":"TOYOTA HILUX4","dr":"JUSTIN LEWIS","c":"7034305116558659","f":"Premium unleaded"},{"r":"BY38KR","t":"Ute","d":"Tree","n":"Toyota Landcruiser","m":"Toyota Landcruiser","dr":"BRENDAN RICHARSON","c":"7034305110165261","f":"Diesel"},{"r":"26228E","t":"Mower","d":"Landscape","n":"HUSTLER RIDE ON MOWER","m":"HUSTLER SUPERZ 60inch"},{"r":"BW63RR","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL UTE - VMS","m":"TOYOTA HILUX"},{"r":"31182E","t":"Mower","d":"Landscape","n":"KUBOTA RIDE ON MOWER","m":"KUBOTA ZD1221 60inch"},{"r":"CA10BL","t":"Ute","d":"Tree","n":"MITSUBISHI TRITON","m":"MITSUBISHI TRITON","dr":"LUKE BARTLEY","c":"7034305106436460","f":"Diesel"},{"r":"36989E","t":"Mower","d":"Landscape","n":"KUBOTA RIDE ON MOWER","m":"KUBOTA ZD1221 60inch"},{"r":"36990E","t":"Landscape Tractor","d":"Landscape","n":"KUBOTA TRACTOR","m":"KUBOTA M9540D"},{"r":"BR22ZZ","t":"Truck","d":"Tree","n":"TRUCK-HINO 500","m":"HINO FG8J","dr":"NICK JONES","c":"7034305115783134","f":"Fuel"},{"r":"BT08QM","t":"Truck","d":"Tree","n":"TRUCK - HINO TIPPER","m":"HINO FG8J","dr":"JASON HUGHES","c":"7034305105574238","f":"Diesel"},{"r":"53369E","t":"Mower","d":"Landscape","n":"KUBOTA RIDE ON MOWER","m":"KUBOTA ZD1221 60inch"},{"r":"59040D","t":"Mower","d":"Landscape","n":"KUBOTA RIDE ON MOWER","m":"KUBOTA ZD1221 60inch"},{"r":"62925E","t":"Mower","d":"Landscape","n":"KUBOTA RIDE ON MOWER","m":"KUBOTA ZD1221R 60inch"},{"r":"CC24TI","t":"Ute","d":"Tree","n":"Toyota Hilux 4x4","m":"Toyota HILUX 4","dr":"BILLY PRICE","c":"7034305113893588","f":"Premium Diesel"},{"r":"CC94JL","t":"Ute","d":"Tree","n":"ISUZU D-MAX","m":"ISUZU D-MA08A","dr":"GAB FITZGERALD","c":"7034305111758833","f":"Diesel"},{"r":"CD36PH","t":"Ute","d":"Tree","n":"TOYOTA HILUX","m":"TOYOTA HILUX4","dr":"JOE HUTTON","c":"7034305106228180","f":"Fuel"},{"r":"CH90KL","t":"Ute","d":"Tree","n":"TOYOTA HILUX","m":"TOYOTA HILUX4","dr":"RACHAEL KEATING","c":"7034305106786955","f":"Unleaded"},{"r":"CJ55FB","t":"Ute","d":"Tree","n":"TOYOTA HILUX","m":"TOYOTA HILUX4","dr":"KEV CARRILLO","c":"7034305108260140","f":"Unleaded"},{"r":"CP60AF","t":"Ute","d":"Tree","n":"ISUZU D-MAX","m":"ISUZU D-MA12","dr":"SHAUN COLE","c":"7034305113746059","f":"Diesel"},{"r":"CV14NO","t":"Ute","d":"Tree","n":"Toyota Hilux","m":"Toyota HILUX 4","dr":"SAXON","c":"7034305106890443","f":"Diesel"},{"r":"CN47HS","t":"Truck","d":"Tree","n":"ISUZU D Max","m":"ISUZU NQR","dr":"CHRIS PLAYER - (STUMP TRUCK - OLD TRENT SHEATH)","c":"7034305117020659","f":"Diesel"},{"r":"66695E","t":"Mower","d":"Landscape","n":"KUBOTA RIDE ON MOWER","m":"KUBOTA ZD1221R 60inch"},{"r":"CP06YZ","t":"Truck","d":"Tree","n":"TRUCK - UD","m":"UD PKC8E","dr":"DENNIS KOCJANCIC","c":"7034305116296961","f":"Diesel"},{"r":"CS63LP","t":"Truck","d":"Tree","n":"MITSUBISHI CANTER (Blower)","m":"MITSUBISHI CANT08","dr":"BLOWER TRUCK","c":"7034305112809668","f":"Diesel"},{"r":"CE52JK","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL - TMA","m":"ISUZU FTR900M"},{"r":"CZ86TX","t":"Ute","d":"Landscape","n":"TRAFFIC CONTROL UTE","m":"ISUZU D-MA20"},{"r":"CZ33TZ","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL UTE - VMS","m":"ISUZU D-MAX"},{"r":"DA32FL","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL UTE - VMS","m":"ISUZU D-MAX"},{"r":"DA37FL","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL UTE - VMS","m":"ISUZU D-MAX"},{"r":"CP11JO","t":"Truck","d":"Tree","n":"TRUCK - HINO","m":"HINO FGIJ","dr":"SPARE","c":"7034305106957424","f":"Diesel"},{"r":"DF25LB","t":"Truck","d":"Tree","n":"ISUZU Crew Cab","m":"ISUZU NNR","dr":"KYLE OSBORNE","c":"7034305111704035","f":"Diesel"},{"r":"DFW77E","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL UTE - VMS","m":"ISUZU D-MAX"},{"r":"DF26LB","t":"Truck","d":"Tree","n":"ISUZU Crew Cab","m":"ISUZU NNR","dr":"JACOB DEVINGNE?","c":"7034305110028204","f":"Diesel"},{"r":"DI32GU","t":"Ute","d":"Landscape","n":"TRAFFIC CONTROL UTE","m":"TOYOTA HILUX 4","c":"7034305110681705","f":"Premium unleaded"},{"r":"DM84ZB","t":"Truck","d":"Tree","n":"ISUZU Crew Cab","m":"ISUZU NHNN07"},{"r":"DL45RF","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL UTE - VMS","m":"ISUZU D-MAX"},{"r":"DP60DA","t":"Truck","d":"Tree","n":"ISUZU TRUCK","m":"ISUZU NHNN07","dr":"JACOB DEVEIGNE","c":"7034 3051****3408","f":"Diesel"},{"r":"XO05MA","t":"Truck","d":"Tree","n":"Nissan UD Float","m":"UD PKC397A","dr":"ALEX GLYNN","c":"7034305116398783","f":"Diesel"},{"r":"XO05RX","t":"Truck","d":"Tree","n":"Hino 300 Series","m":"Hino 30007B","dr":"Mathew Brock","c":"7034 3051 0867 8176"},{"r":"DB78SC","t":"Ute","d":"Tree","n":"ISUZU D-MAX SX CAB CHASSIS","m":"ISUZU D-MA12","dr":"JAYDEN STRONG","c":"7034305112823891","f":"Diesel"},{"r":"DI05QD","t":"Ute","d":"Tree","n":"TOYOTA Hilux","m":"TOYOTA HILUX 4","dr":"ALEX GLYNN","c":"7034305112341555","f":"Premium unleaded"},{"r":"BX27ZL","t":"Ute","d":"Tree","n":"TOYOTA Hilux","m":"TOYOTA HILUX 4"},{"r":"DP90CQ","t":"Ute","d":"Tree","n":"FORD RANGER","m":"FORD RANGER","dr":"TIM PRICE","c":"7034305114660168","f":"Diesel"},{"r":"BY49ZT","t":"Ute","d":"Tree","n":"FORD RANGER","m":"FORD RANGER"},{"r":"XN59QZ","t":"EWP","d":"Tree","n":"MITSUBISHI / VERSA LIFT TOWER","m":"MITSUBISHI FUSO","dr":"NATHAN MORALES","c":"7034305110311667","f":"Diesel"},{"r":"XN56BU","t":"Truck","d":"Tree","n":"ISUZU BOGIE -TIPPER","m":"ISUZU FVZ193A","dr":"OLD BOGIE","c":"7034305111430383","f":"Diesel"},{"r":"XN70FQ","t":"Truck","d":"Tree","n":"TRUCK - MITSU TIPPER","m":"MITSUBISHI FN62FK","dr":"SPARE","c":"7034305108388719","f":"Diesel"},{"r":"XN95CF","t":"Truck","d":"Tree","n":"TRUCK - UD","m":"UD GWB","dr":"SCOTT WOOD","c":"7034305110006994","f":"Diesel"},{"r":"DPL85C","t":"Ute","d":"Tree","n":"MITSUBISHI TRITON","m":"MITSUBISHI TRITON","dr":"BRETT SONTER","c":"7034305108863984","f":"Diesel"},{"r":"DSU65Y","t":"Ute","d":"Tree","n":"MITSUBISHI TRITON","m":"MITSUBISHI TRITON","dr":"JASON HUGHES","c":"7034305112129919","f":"Unleaded"},{"r":"DXS19T","t":"Ute","d":"Tree","n":"Toyota Hilux","m":"TOYOTA HILUX 4"},{"r":"EAE28V","t":"Other","d":"Tree","n":"PORSCHE MACAN","m":"PORSCHE MACA14","dr":"SONYA","c":"7034305114570151","f":"Premium unleaded"},{"r":"EYI04H","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL UTE - VMS","m":"ISUZU D-MAX"},{"r":"EYI04J","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL UTE - VMS","m":"ISUZU D-MAX"},{"r":"DI08XE","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL - TMA","m":"MITSUA TF"},{"r":"ECE83U","t":"Ute","d":"Tree","n":"UTE","m":"Volkswagon Amarok","dr":"AMELIA PLUMMER","c":"7034305115642942","f":"Diesel"},{"r":"6117231263","t":"Stump Grinder","d":"Tree","n":"STUMP GRINDER - HUMPER - ORANGE","m":"RHYSCORP SH25hp"},{"r":"1800D","t":"Stump Grinder","d":"Tree","n":"STUMP GRINDER - RED ROO","m":"RED ROO 5014TRX"},{"r":"66HP","t":"Stump Grinder","d":"Tree","n":"STUMP GRINDER - RED ROO 7015TRX","m":""},{"r":"PT44","t":"Stump Grinder","d":"Tree","n":"STUMP GRINDER - RED ROO 7015TRX","m":"RED ROO 7015TRX"},{"r":"PT20","t":"Stump Grinder","d":"Tree","n":"STUMP GRINDER","m":""},{"r":"PT31","t":"Stump Grinder","d":"Tree","n":"STUMP GRINDER","m":""},{"r":"CM77KG","t":"EWP","d":"Tree","n":"TOWER-ISUZU - EWP","m":"ISUZU FVZ193A","dr":"BILLY PRICE (21M)","c":"7034305116027192","f":"Diesel"},{"r":"EES53B","t":"Ute","d":"Tree","n":"ISUZU D-MAX","m":"ISUZU D-MA08A","dr":"LEE DAVIS","c":"7034305107318832","f":"Diesel"},{"r":"EOL97X","t":"Ute","d":"Tree","n":"FORD RANGER","m":"FORD RANGER","dr":"JOHN LARGEY","c":"7034305111069538","f":"Diesel"},{"r":"EQE85L","t":"Ute","d":"Tree","n":"FORD RANGER","m":"FORD RANGER","dr":"MARTIN HOWARD","c":"7034305113441354","f":"Diesel"},{"r":"EQP77D","t":"Ute","d":"Tree","n":"TOYOTA HILUX","m":"TOYOTA HILUX 4","dr":"BJ","c":"7034305110325493","f":"Unleaded"},{"r":"EQP77E","t":"Ute","d":"Tree","n":"TOYOTA HILUX","m":"TOYOTA HILUX 4","dr":"JOE HURST","c":"7034305112846991","f":"Unleaded"},{"r":"ERQ21S","t":"Ute","d":"Tree","n":"FORD RANGER","m":"FORD RANGER","dr":"RHYS DWYER","c":"7034305109386829","f":"Diesel"},{"r":"EVA47B","t":"Ute","d":"Tree","n":"MITSUBISHI TRITON","m":"FORD RANGER","dr":"ANT YOUNGMAN","c":"7034305105562266","f":"Diesel"},{"r":"EYN61Z","t":"Other","d":"Tree","n":"Mazda CX5","m":"Mazda CX5","dr":"DECLAN KANE","c":"7034305107192484","f":"Unleaded"},{"r":"EYP02J","t":"Ute","d":"Tree","n":"LDV T60","m":"LDV SK8C17","dr":"CASS CHAPPLE","c":"7034305107286914","f":"Diesel"},{"r":"EYP02K","t":"Ute","d":"Tree","n":"LDV T60","m":"LDV SK8C17"},{"r":"FGP29X","t":"Ute","d":"Tree","n":"ISUZU D Max","m":"ISUZU D-MAX","dr":"DANE PLUMMER","c":"7034305116249275","f":"Diesel"},{"r":"FHX25L","t":"Ute","d":"Tree","n":"Toyota Landcruiser","m":"TOYOTA LANDCRUISER","dr":"TONY PLUMMER","c":"7034305111220834","f":"Diesel"},{"r":"FMT17H","t":"Ute","d":"Tree","n":"ISUZU D Max","m":"ISUZU D-MAX","dr":"JOE DALEY","c":"7034305116246156","f":"Diesel"},{"r":"TA39WQ","t":"Trailer","d":"Tree","n":"TRAILER","m":"QUALTY 8X501A"},{"r":"TB17YY","t":"Trailer","d":"Tree","n":"TRAILER","m":"MARIOT 12XT"},{"r":"YN04HA","t":"Trailer","d":"Tree","n":"TRAILER","m":"JPTRLR TRIAXLE"},{"r":"TE46QM","t":"Trailer","d":"Tree","n":"TRAILER","m":"JPTRLR TRIAXLE"},{"r":"XO08FN","t":"Truck","d":"Tree","n":"TRUCK - UD","m":"UD PK","dr":"MATT ROGERS","c":"7034305111375786","f":"Diesel"},{"r":"TG26UA","t":"Trailer","d":"Tree","n":"TRAILER","m":"ATA 9X6"},{"r":"XO20NL","t":"Truck","d":"Tree","n":"TRUCK - UD","m":"UDTRUC PKC","dr":"MAROS MENCAK","c":"7034305111698906","f":"Diesel"},{"r":"TE74NJ","t":"Trailer","d":"Tree","n":"TRAILER - (Mower)","m":"DEAN 190S06A"},{"r":"TF46NU","t":"Trailer","d":"Tree","n":"TRAILER - (Mower)","m":"SWTTLR SWT"},{"r":"TG29WL","t":"Trailer","d":"Tree","n":"TRAILER - (Mower)","m":"BETTER BT"},{"r":"U64347","t":"Trailer","d":"Tree","n":"JPTRLR TANDEM Trailer","m":"JPRLR TANDEM"},{"r":"TG30WL","t":"Trailer","d":"Tree","n":"TRAILER - (Mower)","m":"BETTER BT"},{"r":"TG31WL","t":"Trailer","d":"Tree","n":"TRAILER - (Mower)","m":"BETTER BT"},{"r":"TL30YS","t":"Trailer","d":"Tree","n":"TRAILER - (Blower)","m":"BALANCE BT53FWT"},{"r":"TL30ZN","t":"Trailer","d":"Tree","n":"TRAILER - (Traffic Control)","m":"MARIO 10X5"},{"r":"TL49PN","t":"Trailer","d":"Tree","n":"Trailer (Avant)","m":"BRIANJ 888"},{"r":"TL69XK","t":"Trailer","d":"Tree","n":"TRAILER - (Mower)","m":"DEAN 109S06A"},{"r":"TF52XQ","t":"Trailer","d":"Tree","n":"TRAILER - (Mower)","m":"DEAN 109S06A"},{"r":"TP56GL","t":"Trailer","d":"Tree","n":"TRAILER Maxim - (Mower)","m":"MAXIM STB"},{"r":"OLD TC80RW","t":"Trailer","d":"Tree","n":"TRAILER Maxim - (Mower)","m":"MAXIM STB"},{"r":"TG05QH","t":"Trailer","d":"Tree","n":"TRAILER - (Vermeer)","m":"SURWEL SW2400"},{"r":"XN14ZF","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL - TMA","m":"ISUZU FTR900M"},{"r":"YN78AN","t":"Trailer","d":"Tree","n":"TRAILER FLOAT","m":"TAG TANDEM"},{"r":"XN61YG","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL - TMA","m":"UD PKC8E"},{"r":"XO49LN","t":"Truck","d":"Tree","n":"TRUCK - UD","m":"UD GWB","dr":"TIM PRICE","c":"7034305113655797","f":"Diesel"},{"r":"XP05BN","t":"Truck","d":"Tree","n":"Isuzu Tipper","m":"Isuzu FSR140"},{"r":"XO26SK","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL - TMA","m":"IVECO EUROCARGO"},{"r":"XN07XY","t":"Truck","d":"Tree","n":"IVECO - HAULAGE TRUCK","m":"IVECO STRA05A","dr":"BRETT SONTER/LEE DAVIS","f":"Diesel"},{"r":"XO37SC","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL - TMA","m":"MITSUA TA FIGH"},{"r":"XO39LU","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL - TMA","m":"HINO GH500 1828"},{"r":"XO68TY","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL - TMA","m":"IVECO DAIL07"},{"r":"XP31AG","t":"Truck","d":"Tree","n":"Mitsubishi Tipper","m":"MITSUBISHI FM6503A","dr":"DOUG GRANT","c":"7034305116197722","f":"Diesel"},{"r":"XP36GC","t":"Truck","d":"Tree","n":"Truck Hino PT#62","m":"HINO 30007A","dr":"SPARE (SOON TO BE BRENDON DEACON?)","c":"7034305113207938","f":"Diesel"},{"r":"XP80KS","t":"Truck","d":"Tree","n":"TRUCK - HINO TIPPER","m":"HINO FG1J01A","dr":"SPARE","c":"7034305117533503","f":"Diesel"},{"r":"XO71ZL","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL - TMA","m":"MITSUA TA FIGH"},{"r":"XN25DA","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL - TMA","m":""},{"r":"XO82XV","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL - TMA","m":"MITSUA TA FIGH"},{"r":"XO96XP","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL - TMA","m":"MITSUA TF","dr":"SHAUN DENNISON","c":"7034305110811948","f":"Diesel"},{"r":"XP57ES","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL - TMA","m":"MITSUA TA FIGH"},{"r":"XP86LM","t":"Truck","d":"Tree","n":"TRUCK - ISUZU","m":"ISUZU FVRL96A","dr":"JASON SORBARA","c":"7034305108940667","f":"Diesel"},{"r":"YN22AO","t":"Trailer","d":"Tree","n":"PLANT TRAILER","m":"FWR Single Axle Tag Trailer"},{"r":"CX22BE","t":"Truck","d":"Landscape","n":"MITSUBISHI CANTER","m":"MITSUBISHI CANT08","dr":"LAURA HARDWOOD","c":"7034305114887118","f":"Diesel"},{"r":"XO35UP","t":"Truck","d":"Tree","n":"MERCEDES TIPPER J&R HIRE","m":"MERCEDES BENZ 2643","dr":"CAM WILLIAMS","c":"MISC3","f":"Diesel"},{"r":"BZ04EH","t":"Truck","d":"Landscape","n":"FUSO CANTER","m":"MITSUBISHI CANT08","dr":"GRAFFITI TRUCK","c":"7034305113417867","f":"Diesel"},{"r":"Z41694","t":"Trailer","d":"Tree","n":"TRAILER ARROW BOARD","m":"DATA DATASIG"},{"r":"Z80212","t":"Trailer","d":"Tree","n":"TRAILER ARROW BOARD","m":"Data Signs DATASIG"},{"r":"CI98BZ","t":"Truck","d":"Landscape","n":"Isuzu Truck","m":"ISUZU NPR300","dr":"KYLE OSBORNE","c":"7034305109332146","f":"Diesel"},{"r":"CL52NS","t":"Truck","d":"Landscape","n":"HINO Truck - 300 SERIES","m":"HINO 300S11","dr":"DAN THOMPSON","c":"7034305107310136","f":"Diesel"},{"r":"CT74KE","t":"Truck","d":"Tree","n":"ISUZU Truck","m":"ISUZU NHNL07","dr":"SHANE DEMIRAL","c":"7034305112151236","f":"Diesel"},{"r":"CX23BE","t":"Truck","d":"Landscape","n":"FUSO CANTER","m":"MITSUBISHI CANTER","dr":"MICK THOMAS","c":"7034305106791179","f":"Diesel"},{"r":"YMN14E","t":"Ute","d":"Tree","n":"ISUZU D Max","m":"ISUZU D-MA21","dr":"ROGER BORG","c":"7034305106723230","f":"Diesel"},{"r":"PT#30","t":"Other","d":"Tree","n":"VERMEER LOADER","m":"VERMEER CTX100"},{"r":"CX45MJ","t":"Truck","d":"Landscape","n":"ISUZU WATER CART","m":"ISUZU NLR200","dr":"NAISH","c":"7034305107330928","f":"Diesel"},{"r":"TC80LA","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 15in","m":"BANDIT 159006A"},{"r":"AP85DF","t":"Other","d":"Tree","n":"Mitsubishi Canter Auto","m":"","dr":"KYLE OSBORNE","c":"7034305113700650","f":"Diesel"},{"r":"AT13VE","t":"Truck","d":"Tree","n":"Isuzu Tipper","m":"","dr":"JASON SORBARA","c":"7034305108940667","f":"Diesel"},{"r":"BF51KJ","t":"Other","d":"Tree","n":"NLR Series","m":"","dr":"NAISH","c":"7034305107330928","f":"Diesel"},{"r":"BST66Q","t":"Ute","d":"Tree","n":"Toyota Hilux SR","m":"","dr":"YARD SPARE","c":"7034305116359132","f":"Unleaded"},{"r":"CH95ZD","t":"Other","d":"Tree","n":"Mitsubishi Canter","m":"","dr":"DANIEL THOMSON","c":"7034305108274448","f":"Diesel"},{"r":"CIC51E","t":"Other","d":"Tree","n":"Ford Ranger","m":"","c":"7034305114657123","f":"Unleaded"},{"r":"CM80RV","t":"Truck","d":"Tree","n":"Hino FD8J Truck","m":"","c":"7034305114621285","f":"Diesel"},{"r":"EBL30C","t":"Other","d":"Tree","n":"FORD FALCON","m":"","dr":"SAM LAW","c":"7034305113442394","f":"Unleaded"},{"r":"EYO62W","t":"Other","d":"Tree","n":"MERC BENZ 300CE","m":"","dr":"JOE PELLIZZON","c":"7034305117257665","f":"Unleaded"},{"r":"EYO02K","t":"Ute","d":"Tree","n":"LDV T60 UTE LDV","m":"","dr":"DAYNE COOMBE","c":"7034305107009274","f":"Diesel"},{"r":"FWN82W","t":"Other","d":"Tree","n":"","m":"","dr":"JOEL SONTER"},{"r":"JCJ010","t":"Other","d":"Tree","n":"RAM RAM 1500","m":"","dr":"JASON JOHNSON","c":"7034305113817595","f":"Unleaded"},{"r":"MISC3","t":"Other","d":"Tree","n":"ANY ANY","m":"","dr":"CAM WILLIAMS","c":"7034305105984726","f":"Diesel"},{"r":"WIA53F","t":"Other","d":"Tree","n":"Nissan Navara Nissan Navara","m":"","dr":"CARLOS CARRILLO","c":"7034305115254565","f":"Diesel"},{"r":"WNU522","t":"EWP","d":"Tree","n":"HINO 500","m":"","dr":"WADE HANNELL","c":"7034305116506179","f":"Diesel"},{"r":"XO86LP","t":"EWP","d":"Tree","n":"ISUZU NPR200","m":"","c":"7034305114342411","f":"Diesel"},{"r":"XP058N","t":"Truck","d":"Tree","n":"ISUZU FSR 140","m":"","dr":"STEVE NEWTON","c":"7034305111299762","f":"Diesel"},{"r":"XP41MC","t":"EWP","d":"Tree","n":"HINO-500","m":"","dr":"JASON HUGHES","c":"7034305116247253","f":"Diesel"},{"r":"XP21GC","t":"EWP","d":"Tree","n":"","m":"","dr":"DAN VANDERMEEL","c":"XP21GC"},{"r":"XP60OO","t":"EWP","d":"Tree","n":"","m":"","dr":"SAM THOMAS","c":"XP60OO"},{"r":"XN00NX","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL - TMA","m":""},{"r":"XN31GR","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL - TMA","m":""},{"r":"XN64MA","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL - TMA","m":""},{"r":"XV87JT","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL - TMA","m":""}];

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
const MAX_B64_BYTES = 3_500_000;
const MAX_DIMENSION = 2048;

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
  let quality = 0.8;
  const MIN_QUALITY = 0.3;
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
const RECEIPT_SCAN_PROMPT = `Analyze this image very carefully. It typically contains a fuel receipt AND a fleet card in the same photo. Extract ALL of the following:

RECEIPT DATA:
Look for EVERY separate fuel transaction/line item. Receipts often contain MULTIPLE fuel lines from DIFFERENT pumps (e.g. Pump 5, Pump 8). Each pump/transaction is a SEPARATE fuel fill-up, likely for a different vehicle. You MUST detect and list each one individually.

CRITICAL — ONLY COUNT ACTUAL FUEL LINES:
Only include lines that represent ACTUAL FUEL DISPENSED (with litres, price-per-litre, and a cost).
DO NOT include any of these as fuel lines:
- Discounts (e.g. "FLEET CARD DISCOUNT", "FUEL DISCOUNT", negative amounts)
- Surcharges (e.g. "FLEET CARD SURCHARGE", "CARD FEE")
- GST lines
- Subtotals or running totals
- Non-fuel products (oil, AdBlue, accessories — these go in "otherItems" instead)

CRITICAL — READING LITRES CORRECTLY:
Fuel receipts show MULTIPLE numbers that look like litres. You MUST distinguish between:
1. ACTUAL QUANTITY PURCHASED (what we want) — appears in the QTY column, on the SAME LINE as the price-per-litre and total cost. Example: "8.09 L  2.465  19.94" means 8.09L was purchased.
2. CUMULATIVE PUMP METER READINGS (IGNORE THESE) — appear on a SEPARATE line, usually below the transaction line, as a standalone large number like "246.5 L" or "191.9 L". These are the pump's running total and are NOT the quantity purchased.

HOW TO VERIFY: For each fuel line, multiply litres × price-per-litre. The result should approximately equal the line cost. Example: 8.09 × 2.465 ≈ $19.94 ✓. If your litres × price gives a wildly wrong number, you picked the WRONG number.

NON-FUEL PURCHASES:
Look for any non-fuel items on the receipt such as motor oil (e.g. "Mobil Special 20W-50"), AdBlue, coolant, car wash, food, etc. List these separately in "otherItems".

FLEET CARD DATA — PHYSICAL CARD ONLY:
Look for a PHYSICAL orange/red Shell FleetCard that is VISIBLE AS A SEPARATE CARD in the photo (not just text on the receipt). The card must show the full 16-digit number starting with 7034 printed on the card itself.

CRITICAL: Many receipts print the word "FLEETCARD" as a payment method, and sometimes show the last 4 digits of the card. This is NOT enough — we need the full 16-digit number from the PHYSICAL CARD visible in the image. If you can only see "FLEETCARD" printed on the receipt paper but no actual physical card with 16 digits is visible, set cardNumber to null.

The physical card layout from top to bottom is:
  Line 1: "FleetCard" logo (on the card itself, not the receipt)
  Line 2: 16-digit card number starting with 7034
  Line 3: Cardholder surname + vehicle model (e.g. "WHITE NNR-451") — NOT the registration
  Line 4: VEHICLE REGISTRATION — the actual rego (e.g. "DF25LB") — short 5-7 char code
  Line 5: Expiry date (e.g. "EXP 11/30")

CRITICAL: The vehicle registration is on the line BELOW the surname/model line. Do NOT use the surname line as the registration.

Also look for handwritten notes, and the vehicle odometer if visible on the dashboard.

Return ONLY valid JSON with no other text:
{
  "date": "DD/MM/YYYY — Australian format: DAY first, then MONTH, then full 4-digit YEAR. If receipt shows 16/03/26 return 16/03/2026. Never reverse the day and year.",
  "station": "station name or null",
  "fuelType": "primary fuel type or null",
  "pricePerLitre": number_in_DOLLARS_per_litre_or_null,
  "totalCost": number_total_on_receipt_or_null,
  "litres": number_total_FUEL_litres_only,
  "lines": [
    {"litres": number, "cost": number_or_null, "pump": "pump number or null", "fuelType": "EXACT fuel type as printed on receipt", "pricePerLitre": number_or_null}
  ],
  "otherItems": [
    {"description": "EXACT item name as printed on receipt", "cost": number_or_null, "quantity": "string or null"}
  ],
  "discounts": number_total_discounts_or_null,
  "cardNumber": "full 16 digit fleet card number FROM PHYSICAL CARD or null",
  "vehicleOnCard": "registration from physical fleet card or null",
  "odometer": number_odometer_reading_or_null,
  "handwrittenNotes": "any handwritten text visible or null",
  "confidence": {
    "overall": "high|medium|low — your overall confidence in the accuracy of this scan",
    "issues": ["list of specific concerns, e.g. 'blurry text near total', 'partially obscured card number', 'handwriting hard to read', 'date partially cut off', 'unsure if litres is 8.09 or 80.9'"]
  }
}

RULES:
- "lines" array must ONLY contain actual fuel dispensed. If 2 fuel types were pumped, return 2 lines. Never include discounts as a line.
- CRITICAL: pricePerLitre must ALWAYS be in DOLLARS, not cents. Australian receipts often show price in cents per litre (e.g. "274.9 c/L" or "274.90c/L" or "@ 274.9"). If the price looks like it's in cents (typically 100-400 range for fuel), DIVIDE BY 100 to convert to dollars. Example: "274.9 c/L" = 2.749 dollars per litre. "189.9c/L" = 1.899 dollars per litre. Australian fuel typically costs between $1.00 and $4.00 per litre — any value outside this range is almost certainly in cents.
- CRITICAL: Each line MUST have its OWN fuelType and pricePerLitre extracted from the receipt. Do NOT copy the same fuel type to all lines. Example: if line 1 says "PREMIUM DIESEL @ $2.049/L" and line 2 says "PREMIUM 95 @ $1.919/L", then line 1 fuelType is "Premium Diesel" and line 2 fuelType is "Premium 95" — they are DIFFERENT fuels with DIFFERENT prices.
- "otherItems" lists non-fuel products (oil, AdBlue, etc.) with the EXACT description as printed. Empty array [] if none. Do NOT include fleet card surcharges, card fees, or transaction fees — these are standard station charges and should be ignored entirely.
- "litres" is the total of fuel lines ONLY (not other items).
- "cardNumber" must be null unless you can see the PHYSICAL CARD with 16 digits in the image.
- If no fleet card is visible, set cardNumber and vehicleOnCard to null.
- If no odometer is visible, set odometer to null.
- CONFIDENCE: Rate "high" if image is clear and all values are readable. Rate "medium" if some text is blurry, partially obscured, or you had to guess between similar characters (0/O, 1/I, 5/S, 8/B, D/0). Rate "low" if the image is very blurry, upside down, or large portions are unreadable. Always list specific concerns in "issues" — be honest about anything you're unsure of.`;

// Normalize receipt data: ensure lines array exists and totals are consistent
function normalizeReceiptData(data) {
  if (!data) return data;
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

  // Fix price per litre if reported in cents instead of dollars (e.g. 274.9 instead of 2.749)
  if (data.pricePerLitre && data.pricePerLitre > 10) {
    data.pricePerLitre = Math.round((data.pricePerLitre / 100) * 10000) / 10000;
  }
  data.lines = data.lines.map(line => {
    if (line.pricePerLitre && line.pricePerLitre > 10) {
      line.pricePerLitre = Math.round((line.pricePerLitre / 100) * 10000) / 10000;
    }
    return line;
  });

  // Cross-check each line: litres × price should ≈ cost (use per-line price when available)
  const ppl = data.pricePerLitre;
  data.lines = data.lines.map(line => {
    if (line.litres && line.cost && line.cost > 0) {
      const linePpl = line.pricePerLitre || ppl || (line.cost / line.litres);
      const expected = line.litres * linePpl;
      if (expected > line.cost * 3) {
        const correctedLitres = parseFloat((line.cost / linePpl).toFixed(2));
        if (correctedLitres > 0 && correctedLitres < line.litres) {
          line._originalLitres = line.litres;
          line.litres = correctedLitres;
          line._corrected = true;
        }
      }
    }
    return line;
  });

  // Recalculate litres from clean fuel lines
  const lineSum = data.lines.reduce((s, l) => s + (l.litres || 0), 0);
  if (!data.litres || data.lines.some(l => l._corrected)) {
    data.litres = parseFloat(lineSum.toFixed(2));
  }
  // Cross-check total litres against totalCost
  if (data.litres && ppl && data.totalCost) {
    const expectedTotal = data.litres * ppl;
    if (expectedTotal > data.totalCost * 3) {
      data.litres = parseFloat((data.totalCost / ppl).toFixed(2));
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

  return data;
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

function fuzzyMatchFleetCard(scannedCard, scannedRego, learnedDB) {
  if (!scannedCard && !scannedRego) return { cardNumber: null, vehicleOnCard: null };

  // Build a list of all known fleet cards and regos from REGO_DB + learnedDB
  const knownCards = []; // { card, rego, source }
  REGO_DB.forEach(v => {
    if (v.c && v.c.length >= 6) knownCards.push({ card: v.c.replace(/[\s*]/g, ""), rego: v.r.toUpperCase().replace(/\s+/g, ""), source: v });
  });
  if (learnedDB) {
    Object.entries(learnedDB).forEach(([rego, data]) => {
      if (data.c && data.c.length >= 6) {
        const cleanCard = data.c.replace(/[\s*]/g, "");
        // Don't duplicate if already in REGO_DB
        if (!knownCards.some(k => k.card === cleanCard && k.rego === rego)) {
          knownCards.push({ card: cleanCard, rego: rego.toUpperCase().replace(/\s+/g, ""), source: data });
        }
      }
    });
  }

  let bestMatch = null;
  let bestScore = Infinity;
  const cleanScannedCard = scannedCard ? scannedCard.replace(/[\s*]/g, "").toUpperCase() : "";
  const cleanScannedRego = scannedRego ? scannedRego.toUpperCase().replace(/\s+/g, "") : "";

  // Helper: count how many digits match in the same position
  const digitMatchScore = (a, b) => {
    const len = Math.min(a.length, b.length);
    let matches = 0;
    for (let i = 0; i < len; i++) { if (a[i] === b[i]) matches++; }
    return matches;
  };

  // Helper: check if first N and last M digits match (prefix/suffix anchoring)
  const prefixSuffixScore = (scanned, known) => {
    if (scanned.length < 6 || known.length < 6) return 0;
    let score = 0;
    // Check first 4 digits (account prefix — rarely misread)
    const prefixLen = Math.min(4, scanned.length, known.length);
    for (let i = 0; i < prefixLen; i++) { if (scanned[i] === known[i]) score += 3; }
    // Check last 3 digits (often printed on receipt too)
    const suffixStart = Math.min(scanned.length, known.length);
    for (let i = 1; i <= 3 && i <= suffixStart; i++) {
      if (scanned[scanned.length - i] === known[known.length - i]) score += 3;
    }
    // Add positional digit matches for the middle section
    score += digitMatchScore(scanned, known);
    return score;
  };

  // Strategy 1: Match by fleet card number (smart multi-signal matching)
  // Fleet cards share a common 8-digit account prefix (e.g. 70343051) — the LAST 8 digits
  // are what uniquely identify each card. Focus matching on those unique digits.
  if (cleanScannedCard && cleanScannedCard.length >= 6) {
    for (const known of knownCards) {
      const knownClean = known.card.toUpperCase();
      // Same length check (cards should be same format)
      if (Math.abs(cleanScannedCard.length - knownClean.length) > 2) continue;

      const dist = editDistance(cleanScannedCard, knownClean);
      // Exact or near-exact match (0-2 edits) — high confidence
      if (dist <= 2 && dist < bestScore) {
        bestScore = dist;
        bestMatch = known;
        continue;
      }

      // For 16-digit cards: focus on the unique last 8 digits
      // First 8 digits are shared account prefix across all fleet cards
      if (knownClean.length >= 12) {
        const scannedUnique = cleanScannedCard.slice(-8); // Last 8 = unique card ID
        const knownUnique = knownClean.slice(-8);
        const uniqueDist = editDistance(scannedUnique, knownUnique);
        const uniqueMatches = digitMatchScore(scannedUnique, knownUnique);
        const first4Match = cleanScannedCard.slice(0, 4) === knownClean.slice(0, 4);
        const last3Match = cleanScannedCard.slice(-3) === knownClean.slice(-3);
        const last4Match = cleanScannedCard.slice(-4) === knownClean.slice(-4);

        // High confidence: last 8 digits are close (<=3 edits) — the unique part mostly matches
        if (uniqueDist <= 3 && first4Match) {
          const score = uniqueDist === 0 ? 0 : 1;
          if (score < bestScore) { bestScore = score; bestMatch = known; }
          continue;
        }
        // High confidence: prefix AND suffix match (anchored at both ends)
        if (first4Match && (last3Match || last4Match)) {
          const score = 1;
          if (score < bestScore) { bestScore = score; bestMatch = known; }
          continue;
        }
        // Medium confidence: last 3-4 digits match and >50% of unique digits match
        if ((last3Match || last4Match) && uniqueMatches >= 4) {
          const score = 2;
          if (score < bestScore) { bestScore = score; bestMatch = known; }
          continue;
        }
        // Medium confidence: prefix matches and >50% of unique digits match
        if (first4Match && uniqueMatches >= 4) {
          const score = 2;
          if (score < bestScore) { bestScore = score; bestMatch = known; }
          continue;
        }
        // Lower confidence: >60% of all digits match positionally
        const posMatches = digitMatchScore(cleanScannedCard, knownClean);
        const matchRatio = posMatches / Math.max(cleanScannedCard.length, knownClean.length);
        if (matchRatio > 0.6 && cleanScannedCard.length === knownClean.length) {
          const score = 3;
          if (score < bestScore) { bestScore = score; bestMatch = known; }
          continue;
        }
      }
    }
  }

  // Strategy 2: Match by vehicle registration (fuzzy)
  if (cleanScannedRego && cleanScannedRego.length >= 3) {
    const allRegos = REGO_DB.map(v => ({ rego: v.r.toUpperCase().replace(/\s+/g, ""), source: v }));
    if (learnedDB) {
      Object.entries(learnedDB).forEach(([rego, data]) => {
        allRegos.push({ rego: rego.toUpperCase().replace(/\s+/g, ""), source: data });
      });
    }
    for (const known of allRegos) {
      const dist = editDistance(cleanScannedRego, known.rego);
      const maxDist = known.rego.length >= 5 ? 2 : 1;
      if (dist <= maxDist && dist < bestScore) {
        bestScore = dist;
        const cardMatch = knownCards.find(k => k.rego === known.rego);
        bestMatch = cardMatch || { card: "", rego: known.rego, source: known.source };
      }
    }
  }

  // Strategy 3: If no card match yet but we matched a rego, find that rego's card
  // Also if we have BOTH a card and rego scan, use the rego to validate/find the right card
  if (!bestMatch && cleanScannedRego && cleanScannedCard) {
    // Try to find a known card where the rego matches closely
    for (const known of knownCards) {
      const regoDist = editDistance(cleanScannedRego, known.rego);
      if (regoDist <= 2) {
        bestMatch = known;
        bestScore = 1;
        break;
      }
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
      console.log("[Fuzzy Match] Auto-corrected:", corrections.join(", "));
    }
  }

  return {
    cardNumber: bestMatch?.card || scannedCard || null,
    vehicleOnCard: bestMatch?.rego || scannedRego || null,
    _corrected: bestScore > 0 && bestMatch !== null,
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
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
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
  const raw = (d.content?.[0]?.text || "{}").replace(/```json\n?|```/g, "").trim();
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to parse AI response:", raw);
    throw new Error("AI returned an unreadable response — please try scanning again");
  }
}

function parseDate(str) {
  if (!str) return 0;
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
  // Validate parts are reasonable
  if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) return 0;
  return Date.UTC(y, m - 1, d);
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
  const filtered = entries.filter(e => e.vehicleType === vehicleType);
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

      return {
        "Division": e.division || getDivision(e.vehicleType) || "",
        "Registration": e.registration || "",
        "Date": e.date || "",
        "Driver": e.driverName || "",
        "Odometer Start": odoStart,
        "Odometer Finish": odoFinish,
        "KM Travelled": kmTravelled,
        "Fuel (Litres)": litres,
        "Price per Litre ($)": ppl,
        "Total Fuel Cost ($)": totalCost,
        "": "",
        "L/km": lPerKm ? parseFloat(lPerKm.toFixed(4)) : "",
        "KM Travelled (calc)": kmTravelled,
        "Total Litres": litres,
        "Cost of Petrol ($/L)": ppl,
        "Calc Fuel Cost ($)": calcCost ? parseFloat(calcCost.toFixed(2)) : "",
        "More/Less ($)": moreLess ? parseFloat(moreLess.toFixed(2)) : "",
        " ": "",
        "Last Service Date": svc.lastServiceDate || "",
        "Last Service (kms)": svc.lastServiceKms || "",
        "Next Service Due": svc.lastServiceKms ? svc.lastServiceKms + SERVICE_INTERVAL_KM : "",
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

  XLSX.writeFile(wb, `Fuel_${vehicleType}_${new Date().toISOString().slice(0, 10)}.xlsx`);
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
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
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
function EditVehicleModal({ rego, currentDivision, currentType, entries: regoEntries, onSave, onClose }) {
  const [div, setDiv] = useState(currentDivision || "");
  const [vtype, setVtype] = useState(currentType || "");
  const divTypes = div && DIVISIONS[div] ? DIVISIONS[div].types : [];

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
            <PrimaryBtn onClick={() => { if (div && vtype) onSave(rego, div, vtype); }} disabled={!div || !vtype}>
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
  useEffect(() => {
    (async () => {
      setLoading(true);
      const data = await loadFn(entryId);
      setImg(data);
      setLoading(false);
    })();
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
          <img src={`data:${img.mime};base64,${img.b64}`} alt="Receipt" style={{
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

// ─── Manual Add Entry Modal ──────────────────────────────────────────────
function ManualEntryModal({ rego, division, vehicleType, onSave, onClose }) {
  const [f, setF] = useState({
    driverName: "", date: "", odometer: "", litres: "", pricePerLitre: "", totalCost: "",
    station: "", fuelType: "", fleetCardNumber: "",
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
        <FieldInput label="Odometer" value={f.odometer} onChange={v => set("odometer", v)} placeholder="e.g. 154597" type="number" required />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <FieldInput label="Litres" value={f.litres} onChange={v => set("litres", v)} placeholder="e.g. 65.86" type="number" />
          <FieldInput label="Price per Litre ($)" value={f.pricePerLitre} onChange={v => set("pricePerLitre", v)} placeholder="e.g. 2.259" type="number" />
        </div>
        <FieldInput label="Total Fuel Cost ($)" value={f.totalCost || autoTotal} onChange={v => set("totalCost", v)} placeholder={autoTotal ? `Auto: $${autoTotal}` : "e.g. 148.78"} type="number" />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <FieldInput label="Station" value={f.station} onChange={v => set("station", v)} placeholder="e.g. Ampol" />
          <FieldInput label="Fuel Type" value={f.fuelType} onChange={v => set("fuelType", v)} placeholder="e.g. Diesel" />
        </div>
        <FieldInput label="Fleet Card Number" value={f.fleetCardNumber} onChange={v => set("fleetCardNumber", v)} placeholder="Optional" />

        <div style={{ marginTop: 8 }}>
          <PrimaryBtn onClick={() => {
            if (!f.driverName || !f.date || !f.odometer) return;
            onSave({
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              submittedAt: new Date().toISOString(),
              driverName: f.driverName.trim(),
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
              fleetCardVehicle: "", fleetCardDriver: "", vehicleName: "",
              manualEntry: true,
            });
          }}>Add Entry</PrimaryBtn>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Entry Modal ────────────────────────────────────────────────────
function EditEntryModal({ entry, onSave, onDelete, onClose }) {
  const [f, setF] = useState({
    driverName: entry.driverName || "",
    date: entry.date || "",
    odometer: entry.odometer?.toString() || "",
    litres: entry.litres?.toString() || "",
    pricePerLitre: entry.pricePerLitre?.toString() || "",
    totalCost: entry.totalCost?.toString() || "",
    station: entry.station || "",
    fuelType: entry.fuelType || "",
    division: entry.division || "",
    vehicleType: entry.vehicleType || "",
  });
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));

  const activeDivision = f.division ? DIVISIONS[f.division] : null;
  const divTypes = activeDivision ? activeDivision.types : [];

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
            <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>Edit Entry</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>{entry.registration} {"\u00B7"} {entry.date || "No date"}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: "#94a3b8", cursor: "pointer" }}>{"\u00D7"}</button>
        </div>

        <FieldInput label="Driver Name" value={f.driverName} onChange={v => set("driverName", v)} placeholder="Driver name" required />
        <FieldInput label="Date" value={f.date} onChange={v => set("date", v)} placeholder="DD/MM/YYYY" required />
        <FieldInput label="Odometer" value={f.odometer} onChange={v => set("odometer", v)} placeholder="e.g. 154597" type="number" required />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <FieldInput label="Litres" value={f.litres} onChange={v => set("litres", v)} placeholder="e.g. 65.86" type="number" />
          <FieldInput label="Price per Litre ($)" value={f.pricePerLitre} onChange={v => set("pricePerLitre", v)} placeholder="e.g. 2.259" type="number" />
        </div>
        <FieldInput label="Total Fuel Cost ($)" value={f.totalCost} onChange={v => set("totalCost", v)} placeholder="e.g. 148.78" type="number" />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <FieldInput label="Station" value={f.station} onChange={v => set("station", v)} placeholder="e.g. Ampol Brookvale" />
          <FieldInput label="Fuel Type" value={f.fuelType} onChange={v => set("fuelType", v)} placeholder="e.g. Diesel" />
        </div>

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

        {/* Vehicle type */}
        {f.division && (
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
              onSave({
                ...entry,
                driverName: f.driverName.trim(),
                date: f.date.trim(),
                odometer: parseFloat(f.odometer) || null,
                litres: parseFloat(f.litres) || null,
                pricePerLitre: parseFloat(f.pricePerLitre) || null,
                totalCost: parseFloat(f.totalCost) || null,
                station: f.station.trim(),
                fuelType: f.fuelType.trim(),
                division: f.division,
                vehicleType: f.vehicleType,
              });
            }}>Save Changes</PrimaryBtn>
          </div>
        </div>
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

function ServiceModal({ rego, current, onSave, onClose }) {
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
              <span><span style={{ color: "#64748b" }}>Odometer:</span> <strong>{latest.lastServiceKms?.toLocaleString()} km</strong></span>
              <span><span style={{ color: "#64748b" }}>Next due:</span> <strong>{(latest.lastServiceKms + SERVICE_INTERVAL_KM).toLocaleString()} km</strong></span>
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
                <FieldInput label="Odometer (km)" value={newKms} onChange={setNewKms} placeholder="e.g. 154000" type="number" />
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
                    {rec.kms && <span>{"\uD83D\uDCCF"} {rec.kms.toLocaleString()} km</span>}
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

  // AI Confidence Flags
  if (entry._aiConfidence === "low") {
    flags.push({ category: "ai", type: "danger", text: "AI low confidence", detail: `The scanner was unsure about this receipt. Issues: ${(entry._aiIssues || []).join(", ") || "unclear image"}` });
  } else if (entry._aiConfidence === "medium") {
    flags.push({ category: "ai", type: "warn", text: "AI uncertain", detail: `Some values may be inaccurate. Issues: ${(entry._aiIssues || []).join(", ") || "partially unclear"}` });
  }

  // Registration looks suspicious
  const rego = entry.registration || "";
  if (rego && (rego.length < 4 || rego.length > 8)) {
    flags.push({ category: "ai", type: "warn", text: "Unusual rego format", detail: `"${rego}" — expected 4-8 characters` });
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
    const entryDate = parseDate(entry.date);
    if (entryDate && new Date(entryDate) > new Date()) {
      flags.push({ category: "ai", type: "danger", text: "Future date", detail: `${entry.date} is in the future — likely misread` });
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // category: "ops" — Operational / fleet management issues
  // These appear in the DASHBOARD for admin resolution
  // ══════════════════════════════════════════════════════════════════════════

  let kmTravelled = null;
  if (prevOdo != null && odo != null) {
    kmTravelled = odo - prevOdo;
    if (kmTravelled < 0) {
      flags.push({ category: "ops", type: "danger", text: "Odo went backwards", detail: `${prevOdo.toLocaleString()} \u2192 ${odo.toLocaleString()}` });
    } else if (kmTravelled === 0) {
      flags.push({ category: "ops", type: "warn", text: "No km travelled", detail: "Odometer unchanged since last entry" });
    }
  }

  if (kmTravelled > 0 && litres > 0) {
    const lPerKm = litres / kmTravelled;
    const range = EFFICIENCY_RANGES[vehicleType] || EFFICIENCY_RANGES.Other;
    if (lPerKm > range.high) {
      flags.push({ category: "ops", type: "warn", text: "High fuel usage", detail: `${lPerKm.toFixed(3)} L/km \u2014 above expected for ${vehicleType}` });
    } else if (lPerKm < range.low) {
      flags.push({ category: "ops", type: "info", text: "Low fuel usage", detail: `${lPerKm.toFixed(3)} L/km \u2014 below expected` });
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
      const nextDue = latestSvc.lastServiceKms + SERVICE_INTERVAL_KM;
      const kmSince = odo - latestSvc.lastServiceKms;
      const kmRemaining = nextDue - odo;
      if (odo >= nextDue) {
        flags.push({ category: "ops", type: "danger", text: "SERVICE OVERDUE", detail: `${kmSince.toLocaleString()} km since service \u2014 due at ${nextDue.toLocaleString()} km` });
      } else if (kmRemaining <= SERVICE_WARNING_KM) {
        flags.push({ category: "ops", type: "warn", text: `Service in ${kmRemaining.toLocaleString()} km`, detail: `${kmSince.toLocaleString()} km since service \u2014 due at ${nextDue.toLocaleString()} km` });
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
  const learnedDBRef = useRef(learnedDB);
  const entriesRef = useRef(entries);
  useEffect(() => { learnedDBRef.current = learnedDB; }, [learnedDB]);
  useEffect(() => { entriesRef.current = entries; }, [entries]);
  const [storageReady, setStorageReady] = useState(false);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState("");

  const [apiKey, setApiKey] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [adminPasscode, setAdminPasscode] = useState("admin"); // default passcode
  const [passcodeInput, setPasscodeInput] = useState("");

  const [form, setForm] = useState({ driverFirstName: "", driverLastName: "", registration: "", division: "", vehicleType: "", odometer: "" });
  const [savedDriver, setSavedDriver] = useState(null); // { name, rego }
  const [otherMode, setOtherMode] = useState(false);
  const [otherForm, setOtherForm] = useState({ equipment: "", station: "", fleetCard: "", cardRego: "", notes: "", division: "Tree" });
  const [driverCards, setDriverCards] = useState([]); // matched fleet cards for current driver name

  const [receiptPreview, setReceiptPreview] = useState(null);
  const [receiptB64, setReceiptB64] = useState(null);
  const [receiptMime, setReceiptMime] = useState("image/jpeg");
  const [receiptRotation, setReceiptRotation] = useState(0);
  const [receiptFile, setReceiptFile] = useState(null); // original file for re-compression on rotate
  const [receiptData, setReceiptData] = useState(null);
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
  const [cardMonth, setCardMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; });
  const [cardSearch, setCardSearch] = useState("");
  const [editingCard, setEditingCard] = useState(null); // { oldCard, newCard, newDrivers, newRegos } for inline card header editing
  const [expandedFuelType, setExpandedFuelType] = useState(null);
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
  const [replyingFlag, setReplyingFlag] = useState(null); // flagId currently being responded to
  const [editingEntry, setEditingEntry] = useState(null); // entry object being edited
  const [vehicleMenu, setVehicleMenu] = useState(null); // rego string for open menu
  const [editingVehicle, setEditingVehicle] = useState(null); // rego string for edit vehicle modal
  const [manualEntry, setManualEntry] = useState(null); // { rego, division, vehicleType } for manual add
  const [viewingReceipt, setViewingReceipt] = useState(null); // entry ID to view receipt
  const [confirmAction, setConfirmAction] = useState(null);
  const [addVehicle, setAddVehicle] = useState({ rego: "", div: "Tree", type: "Ute", name: "", owner: "", fuel: "Diesel" });

  // ── Receipt image storage ──
  const saveReceiptImage = async (entryId, b64, mime) => {
    try { await window.storage.set(`fuel_receipt_img_${entryId}`, JSON.stringify({ b64, mime })); }
    catch (_) {}
  };

  const loadReceiptImage = async (entryId) => {
    try {
      const res = await window.storage.get(`fuel_receipt_img_${entryId}`);
      return res?.value ? JSON.parse(res.value) : null;
    } catch (_) { return null; }
  };

  const deleteReceiptImage = async (entryId) => {
    try { await window.storage.delete(`fuel_receipt_img_${entryId}`); }
    catch (_) {}
  };

  const receiptRef = useRef();
  const scanResultsRef = useRef();
  const scanIdRef = useRef(0);
  const cardRef = useRef();

  const showToast = useCallback((msg, type = "success") => setToast({ msg, type }), []);

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

  const persistLearned = async (newData) => {
    learnedDBRef.current = newData; // sync ref immediately so subsequent calls see latest
    try { await window.storage.set("fuel_learned_db", JSON.stringify(newData)); setLearnedDB(newData); }
    catch (_) { setLearnedDB(newData); }
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
    if (odo < lastOdo) return { type: "danger", text: `Odometer is lower than last recorded (${lastOdo.toLocaleString()} km). Did you miss a digit?` };
    const jump = odo - lastOdo;
    if (jump > 30000) return { type: "warn", text: `That's ${jump.toLocaleString()} km since last fill-up \u2014 unusually high. Double-check the reading.` };
    return null;
  };

  const resetForm = () => {
    setStep(1);
    // Re-apply saved driver profile if exists
    const base = { driverFirstName: "", driverLastName: "", registration: "", division: "", vehicleType: "", odometer: "" };
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
    setOtherForm({ equipment: "", station: "", fleetCard: "", cardRego: "", notes: "", division: "Tree" });
    setDriverCards([]);
    setReceiptPreview(null); setReceiptB64(null); setReceiptData(null); setReceiptMime("image/jpeg");
    setReceiptRotation(0); setReceiptFile(null);
    setCardPreview(null); setCardB64(null); setCardData(null);
    setManualCard(false); setManualCardNum(""); setManualCardRego("");
    setSplitMode(false); setSplits([]);
    setError("");
  };

  const ORIENTATION_PROMPT = `Look at this image. Is the text in the image upright and readable, or is the image rotated/sideways/upside down?
Return ONLY valid JSON: {"rotation": 0} if text is upright, {"rotation": 90} if rotated 90° clockwise, {"rotation": 180} if upside down, {"rotation": 270} if rotated 90° counter-clockwise.
Only return one of: 0, 90, 180, or 270.`;

  const handleReceiptFile = async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    if (receiptPreview?.startsWith("blob:")) URL.revokeObjectURL(receiptPreview);
    setReceiptPreview(URL.createObjectURL(file));
    setReceiptFile(file);
    setReceiptRotation(0);
    setReceiptData(null); setCardData(null);
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
      const result = await claudeScan(apiKey, b64, mime, RECEIPT_SCAN_PROMPT);
      if (scanIdRef.current !== currentScanId) return;
      const normalized = normalizeReceiptData(result);
      setReceiptData(normalized);
      if (normalized.cardNumber || normalized.vehicleOnCard) {
        const matched = fuzzyMatchFleetCard(normalized.cardNumber, normalized.vehicleOnCard, learnedDBRef.current);
        setCardData({ cardNumber: matched.cardNumber, vehicleOnCard: matched.vehicleOnCard, _corrected: matched._corrected, _originalCard: matched._originalCard, _originalRego: matched._originalRego });
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
    setReceiptRotation(newRotation);
    setReceiptScanning(true); setError(""); setReceiptData(null); setCardData(null);
    try {
      const { b64, mime } = await compressImage(receiptFile, newRotation);
      setReceiptB64(b64);
      setReceiptMime(mime);
      setReceiptPreview(`data:${mime};base64,${b64}`);
      const result = await claudeScan(apiKey, b64, mime, RECEIPT_SCAN_PROMPT);
      const normalized = normalizeReceiptData(result);
      setReceiptData(normalized);
      if (normalized.cardNumber || normalized.vehicleOnCard) {
        const matched = fuzzyMatchFleetCard(normalized.cardNumber, normalized.vehicleOnCard, learnedDBRef.current);
        setCardData({ cardNumber: matched.cardNumber, vehicleOnCard: matched.vehicleOnCard, _corrected: matched._corrected, _originalCard: matched._originalCard, _originalRego: matched._originalRego });
      }
    } catch (e) { setError("Rotate/scan failed \u2014 " + e.message); }
    setReceiptScanning(false);
    setTimeout(() => scanResultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 200);
  };

  const rescanReceipt = async () => {
    if (!receiptB64 || !apiKey) return;
    setReceiptScanning(true); setError("");
    try {
      const result = await claudeScan(apiKey, receiptB64, receiptMime, RECEIPT_SCAN_PROMPT);
      const normalized = normalizeReceiptData(result);
      setReceiptData(normalized);
      if (normalized.cardNumber || normalized.vehicleOnCard) {
        const matched = fuzzyMatchFleetCard(normalized.cardNumber, normalized.vehicleOnCard, learnedDBRef.current);
        setCardData({ cardNumber: matched.cardNumber, vehicleOnCard: matched.vehicleOnCard, _corrected: matched._corrected, _originalCard: matched._originalCard, _originalRego: matched._originalRego });
      }
    } catch (e) { setError("Re-scan failed \u2014 " + e.message); }
    setReceiptScanning(false);
    setTimeout(() => scanResultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 200);
  };

  const handleCardFile = async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    if (cardPreview?.startsWith("blob:")) URL.revokeObjectURL(cardPreview);
    setCardPreview(URL.createObjectURL(file));
    setCardData(null);
    if (!apiKey) return;
    setCardScanning(true); setError("");
    try {
      const { b64, mime } = await compressImage(file);
      setCardB64(b64);
      const result = await claudeScan(apiKey, b64, mime,
        `Extract fleet card details from this Shell FleetCard image. The card layout top to bottom is:
Line 1: "FleetCard" logo
Line 2: 16-digit card number starting with 7034
Line 3: Cardholder surname + vehicle model (e.g. "WHITE NNR-451") — this is NOT the rego
Line 4: VEHICLE REGISTRATION — the actual rego (e.g. "DF25LB") — short 5-7 char alphanumeric code
Line 5: Expiry date

CRITICAL: The registration is on the line BELOW the surname. Do NOT return the surname line as the rego.

Return ONLY valid JSON: {"cardNumber":"full 16 digit number or null","vehicleOnCard":"registration from line 4 or null"}`
      );
      setCardData(result);
    } catch (e) { setError("Card scan failed \u2014 " + e.message); }
    setCardScanning(false);
  };

  const handleSubmit = async () => {
    setSaving(true);
    // Parse any raw string values that may have been edited in review
    const ppl = parseFloat(receiptData?.pricePerLitre) || null;
    const date = receiptData?.date || "";
    const station = receiptData?.station || "";
    const baseFuelType = receiptData?.fuelType || "";
    const cardNum = cardData?.cardNumber || "";
    const cardVeh = cardData?.vehicleOnCard || "";
    const now = new Date().toISOString();
    const parsedLitresTotal = parseFloat(receiptData?.litres) || null;
    const parsedTotalCost = parseFloat(receiptData?.totalCost) || null;

    // ── "Other" mode (non-vehicle fuel claims) ──
    if (otherMode) {
      const otherEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        submittedAt: now,
        entryType: "other",
        division: otherForm.division || "Tree",
        driverName: `${form.driverFirstName.trim()} ${form.driverLastName.trim()}`.trim(),
        equipment: otherForm.equipment.trim(),
        station: otherForm.station.trim() || station,
        fleetCardNumber: cardData?.cardNumber || cardNum || otherForm.fleetCard.trim() || "",
        cardRego: cardData?.vehicleOnCard || cardVeh || otherForm.cardRego.trim().toUpperCase() || "",
        date,
        litres: parsedLitresTotal,
        pricePerLitre: ppl,
        totalCost: parsedTotalCost,
        fuelType: baseFuelType,
        notes: otherForm.notes.trim(),
        hasReceipt: !!receiptB64,
        _aiConfidence: receiptData?.confidence?.overall || null,
        _aiIssues: receiptData?.confidence?.issues || [],
      };
      await persist([...entries, otherEntry], otherEntry);
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

    const buildEntry = (rego, division, vehicleType, odometer, litres, regoMatch, matchedLine) => {
      const lineFuelType = matchedLine?.fuelType || baseFuelType || regoMatch?.f || "";
      const linePpl = matchedLine?.pricePerLitre || ppl;
      const parsedLitres = parseFloat(litres) || null;
      return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        submittedAt: now,
        driverName: `${form.driverFirstName.trim()} ${form.driverLastName.trim()}`.trim(),
        registration: rego,
        division: division || getDivision(vehicleType),
        vehicleType,
        odometer: parseFloat(odometer) || null,
        date,
        litres: parsedLitres,
        pricePerLitre: linePpl,
        totalCost: matchedLine?.cost || ((parsedLitres || 0) * (linePpl || 0)) || null,
        station,
        fuelType: lineFuelType,
        fleetCardNumber: cardNum || regoMatch?.c || "",
        fleetCardVehicle: cardVeh,
        fleetCardDriver: regoMatch?.dr || "",
        vehicleName: regoMatch?.n || "",
        splitReceipt: splitMode || false,
        hasReceipt: !!receiptB64,
        _aiConfidence: receiptData?.confidence?.overall || null,
        _aiIssues: receiptData?.confidence?.issues || [],
      };
    };

    // Primary vehicle entry — match to first scanned fuel line
    const primaryMatch = form._regoMatch;
    const primaryLine = scannedLines[nextLineIdx] || null;
    if (primaryLine) nextLineIdx++;
    const primaryLitres = splitMode
      ? (parseFloat(form.litres) || primaryLine?.litres || ((parsedLitresTotal || 0) - splits.reduce((s, sp) => s + (parseFloat(sp.litres) || 0), 0)))
      : (parsedLitresTotal || primaryLine?.litres);
    const primaryEntry = buildEntry(
      form.registration.trim().toUpperCase(),
      form.division, form.vehicleType,
      form.odometer, primaryLitres, primaryMatch, splitMode ? primaryLine : null
    );

    let allNew = entries;
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
          if (best && bestDiff < 1) { // within $1/L tolerance
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
          if (best && bestDiff < spLitres * 0.3) { // within 30% tolerance
            availableLines.splice(availableLines.indexOf(best), 1);
            return best;
          }
        }
        // Fallback: next available in order
        return availableLines.shift() || null;
      };

      for (const sp of splits) {
        if (sp.splitType === "other") {
          if (!sp.equipment) continue;
          const matchedOther = scannedOtherItems[nextOtherIdx] || null;
          const isFuelOther = FUEL_EQUIPMENT_RE.test(sp.equipment);
          const matchedFuelLine = isFuelOther ? findBestLine(sp) : null;

          let equipDesc = sp.equipment.trim();
          let notes = sp.notes || "";
          let entryPpl = ppl;
          let cost = null;
          let entryLitres = parseFloat(sp.litres) || null;

          if (matchedOther && !isFuelOther) {
            nextOtherIdx++;
            equipDesc = `${sp.equipment.trim()} \u2014 ${matchedOther.description}`;
            cost = matchedOther.cost || null;
            entryPpl = null;
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

          const otherSplitEntry = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            submittedAt: now,
            entryType: "other",
            division: form.division || "Tree",
            driverName: `${form.driverFirstName.trim()} ${form.driverLastName.trim()}`.trim(),
            equipment: equipDesc,
            station,
            fleetCardNumber: cardNum,
            cardRego: cardVeh,
            date,
            litres: entryLitres,
            pricePerLitre: entryPpl,
            totalCost: cost,
            fuelType: matchedFuelLine?.fuelType || (matchedOther ? matchedOther.description : baseFuelType),
            notes,
            splitReceipt: true,
            hasReceipt: !!receiptB64,
          };
          allNew = [...allNew, otherSplitEntry];
          createdIds.push(otherSplitEntry.id);
        } else {
          // Vehicle split → match to best fuel line using price/litres hints
          if (!sp.rego) continue;
          const matchedLine = findBestLine(sp);
          const match = lookupRego(sp.rego, learnedDBRef.current, entriesRef.current) || sp._match;
          const splitEntry = buildEntry(
            sp.rego.trim().toUpperCase(),
            sp.division || match?.d || "",
            sp.vehicleType || match?.t || "",
            sp.odometer, sp.litres || matchedLine?.litres || 0, match, matchedLine
          );
          if (sp._costOverride) splitEntry.totalCost = parseFloat(sp._costOverride) || splitEntry.totalCost;
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
    setSaving(false);
    setStep(4);
  };

  const deleteEntry = async (id) => {
    await persist(entries.filter(e => e.id !== id));
    db.deleteEntry(id).catch(() => {});
    await deleteReceiptImage(id);
    showToast("Entry deleted");
  };

  const updateEntry = async (updatedEntry) => {
    const newEntries = entries.map(e => e.id === updatedEntry.id ? updatedEntry : e);
    // Re-sort this vehicle's entries by odometer
    const rego = updatedEntry.registration;
    const regoEntries = newEntries.filter(e => e.registration === rego).sort(sortEntries);
    const otherEntries = newEntries.filter(e => e.registration !== rego);
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
    const updated = entries.map(e => {
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
        // Delete all entries for this vehicle from cloud
        const toDelete = entries.filter(e => e.registration === rego);
        for (const e of toDelete) { db.deleteEntry(e.id).catch(() => {}); }
        await persist(entries.filter(e => e.registration !== rego));
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

  const saveVehicleEdit = async (rego, newDivision, newVehicleType) => {
    const updated = entries.map(e =>
      e.registration === rego ? { ...e, division: newDivision, vehicleType: newVehicleType } : e
    );
    await persist(updated);
    // Sync updated entries to cloud
    updated.filter(e => e.registration === rego).forEach(e => db.saveEntry(e).catch(() => {}));
    const currentDB = learnedDBRef.current;
    const existing = currentDB[rego] || {};
    const newLearned = { ...currentDB, [rego]: { ...existing, t: newVehicleType, d: newDivision } };
    await persistLearned(newLearned);
    setEditingVehicle(null);
    showToast(`${rego} updated to ${newDivision} / ${newVehicleType}`);
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
        const match = lookupRego(value, learnedDBRef.current, entriesRef.current);
        updated._match = match || null;
        if (match) {
          updated.rego = match.r || value; // Auto-fill full rego
          updated.division = match.d;
          updated.vehicleType = match.t;
        }
      }
      return updated;
    }));
  };

  const EQUIPMENT_PRESETS = ["Chainsaws", "2 Stroke Fuel", "Jerry Can", "Engine Oil", "Chain & Bar Oil", "Stump Grinder", "Fuel Cell/Pod", "Leaf Blower", "AdBlue", "Hire Equipment"];

// Equipment types that consume FUEL (not oil/adblue) — used to match "other" splits to fuel lines vs otherItems
const FUEL_EQUIPMENT_RE = /jerry|2.?stroke|stump|leaf.?blow|chainsaw|fuel.?cell|fuel.?pod|mower|hedger|adblue/i;

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
          <button onClick={() => setOtherMode(false)} style={{
            flex: 1, padding: "10px 14px", borderRadius: 8, fontSize: 13, cursor: "pointer",
            fontFamily: "inherit", fontWeight: !otherMode ? 700 : 500,
            background: !otherMode ? "#f0fdf4" : "white", color: !otherMode ? "#15803d" : "#64748b",
            border: `2px solid ${!otherMode ? "#86efac" : "#e2e8f0"}`, transition: "all 0.15s",
          }}>{"\uD83D\uDE97"} Vehicle</button>
          <button onClick={() => setOtherMode(true)} style={{
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
                Equipment / Purpose <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input value={otherForm.equipment} onChange={e => setOtherForm(f => ({ ...f, equipment: e.target.value }))}
                placeholder="e.g. Chainsaws, Jerry Can, 2 Stroke Fuel"
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, outline: "none", fontFamily: "inherit", color: "#0f172a", marginBottom: 8 }}
                onFocus={e => e.target.style.borderColor = "#fde047"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {EQUIPMENT_PRESETS.map(p => (
                  <button key={p} onClick={() => setOtherForm(f => ({ ...f, equipment: f.equipment ? `${f.equipment}, ${p}` : p }))} style={{
                    padding: "4px 10px", borderRadius: 14, fontSize: 10, cursor: "pointer", fontFamily: "inherit",
                    fontWeight: 500, background: "#fefce8", color: "#854d0e", border: "1px solid #fde047",
                  }}>{p}</button>
                ))}
              </div>
            </div>

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
                        <input value={sp.rego} onChange={e => updateSplit(sp.id, "rego", e.target.value.toUpperCase())} placeholder="e.g. 59040D"
                          style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 13, outline: "none", fontFamily: "inherit", color: "#0f172a", background: "white", textTransform: "uppercase" }}
                          onFocus={e => e.target.style.borderColor = "#22c55e"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 8 }}>
                        <div>
                          <label style={{ display: "block", fontSize: 11, color: "#374151", fontWeight: 600, marginBottom: 3 }}>Odometer</label>
                          <input value={sp.odometer} onChange={e => updateSplit(sp.id, "odometer", e.target.value)} placeholder="e.g. 23140" type="number"
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
                        <label style={{ display: "block", fontSize: 11, color: "#374151", fontWeight: 600, marginBottom: 3 }}>Equipment / Purpose</label>
                        <input value={sp.equipment} onChange={e => updateSplit(sp.id, "equipment", e.target.value)} placeholder="e.g. Jerry Can, Chainsaws"
                          style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 13, outline: "none", fontFamily: "inherit", color: "#0f172a", background: "white" }}
                          onFocus={e => e.target.style.borderColor = "#fde047"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6, marginBottom: 8 }}>
                        {EQUIPMENT_PRESETS.map(p => (
                          <button key={p} onClick={() => updateSplit(sp.id, "equipment", sp.equipment ? `${sp.equipment}, ${p}` : p)} style={{
                            padding: "3px 8px", borderRadius: 12, fontSize: 9, cursor: "pointer", fontFamily: "inherit",
                            fontWeight: 500, background: "#fefce8", color: "#854d0e", border: "1px solid #fde047",
                          }}>{p}</button>
                        ))}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                        <div>
                          <label style={{ display: "block", fontSize: 11, color: "#374151", fontWeight: 600, marginBottom: 3 }}>Litres</label>
                          <input value={sp.litres} onChange={e => updateSplit(sp.id, "litres", e.target.value)} placeholder="e.g. 15.14" type="number"
                            style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 13, outline: "none", fontFamily: "inherit", color: "#0f172a", background: "white" }}
                            onFocus={e => e.target.style.borderColor = "#fde047"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: 11, color: "#374151", fontWeight: 600, marginBottom: 3 }}>$/L <span style={{ fontWeight: 400, color: "#94a3b8" }}>(opt)</span></label>
                          <input value={sp.ppl || ""} onChange={e => updateSplit(sp.id, "ppl", e.target.value)} placeholder="e.g. 1.899" type="number" inputMode="decimal"
                            style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 13, outline: "none", fontFamily: "inherit", color: "#0f172a", background: "white" }}
                            onFocus={e => e.target.style.borderColor = "#fde047"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: 11, color: "#374151", fontWeight: 600, marginBottom: 3 }}>Notes</label>
                          <input value={sp.notes || ""} onChange={e => updateSplit(sp.id, "notes", e.target.value)} placeholder="Optional"
                            style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 13, outline: "none", fontFamily: "inherit", color: "#0f172a", background: "white" }}
                            onFocus={e => e.target.style.borderColor = "#fde047"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
                        </div>
                      </div>
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
              if (!otherForm.equipment) { setError("Please enter the equipment / purpose."); return; }
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
          onChange={v => {
            v = v.toUpperCase();
            const db = learnedDBRef.current;
            const match = lookupRego(v, db, entriesRef.current);
            if (match) {
              // Auto-fill the full rego if user typed a partial match (4+ chars) and we found the vehicle
              const fullRego = match.r || v;
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
          placeholder="e.g. Cat 29404e" hint="This takes priority over what's shown on the fleet card" />

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
            <label style={{ display: "block", fontSize: 12, color: "#374151", fontWeight: 600, marginBottom: 5 }}>
              Odometer / Hours Reading<span style={{ color: "#ef4444", marginLeft: 2 }}>*</span>
            </label>
            <input
              type="number" value={form.odometer} onChange={e => setForm(f => ({ ...f, odometer: e.target.value }))}
              placeholder={(() => { const last = getLastOdometer(form.registration); return last ? `Last: ${last.toLocaleString()} km` : "e.g. 4340"; })()}
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
                  {last && !warn && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>Last recorded: <strong>{last.toLocaleString()} km</strong></div>}
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
          {splitMode && (
            <FieldInput label="Litres for this vehicle" value={form.litres || ""} type="number"
              onChange={v => setForm(f => ({ ...f, litres: v }))} placeholder="e.g. 44.35" hint="How many litres went into this vehicle" />
          )}
        </div>

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
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ display: "block", fontSize: 11, color: "#374151", fontWeight: 600, marginBottom: 3 }}>Equipment / Purpose</label>
                    <input value={sp.equipment} onChange={e => updateSplit(sp.id, "equipment", e.target.value)} placeholder="e.g. Jerry Can, Chainsaws"
                      style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 13, outline: "none", fontFamily: "inherit", color: "#0f172a", background: "white" }}
                      onFocus={e => e.target.style.borderColor = "#fde047"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                    {EQUIPMENT_PRESETS.map(p => (
                      <button key={p} onClick={() => updateSplit(sp.id, "equipment", sp.equipment ? `${sp.equipment}, ${p}` : p)} style={{
                        padding: "3px 8px", borderRadius: 12, fontSize: 9, cursor: "pointer", fontFamily: "inherit",
                        fontWeight: 500, background: "#fefce8", color: "#854d0e", border: "1px solid #fde047",
                      }}>{p}</button>
                    ))}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 11, color: "#374151", fontWeight: 600, marginBottom: 3 }}>Litres</label>
                      <input value={sp.litres} onChange={e => updateSplit(sp.id, "litres", e.target.value)} placeholder="e.g. 15.14" type="number" inputMode="decimal"
                        style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 13, outline: "none", fontFamily: "inherit", color: "#0f172a", background: "white" }}
                        onFocus={e => e.target.style.borderColor = "#fde047"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 11, color: "#374151", fontWeight: 600, marginBottom: 3 }}>$/L <span style={{ fontWeight: 400, color: "#94a3b8" }}>(opt)</span></label>
                      <input value={sp.ppl || ""} onChange={e => updateSplit(sp.id, "ppl", e.target.value)} placeholder="e.g. 1.919" type="number" inputMode="decimal"
                        style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 13, outline: "none", fontFamily: "inherit", color: "#0f172a", background: "white" }}
                        onFocus={e => e.target.style.borderColor = "#fde047"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 11, color: "#374151", fontWeight: 600, marginBottom: 3 }}>Notes <span style={{ fontWeight: 400, color: "#94a3b8" }}>(opt)</span></label>
                      <input value={sp.notes} onChange={e => updateSplit(sp.id, "notes", e.target.value)} placeholder="e.g. for truck"
                        style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 13, outline: "none", fontFamily: "inherit", color: "#0f172a", background: "white" }}
                        onFocus={e => e.target.style.borderColor = "#fde047"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ display: "block", fontSize: 11, color: "#374151", fontWeight: 600, marginBottom: 3 }}>Registration</label>
                    <input value={sp.rego} onChange={e => updateSplit(sp.id, "rego", e.target.value.toUpperCase())} placeholder="e.g. 59040D"
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
                      <label style={{ display: "block", fontSize: 11, color: "#374151", fontWeight: 600, marginBottom: 3 }}>Odometer</label>
                      <input value={sp.odometer} onChange={e => updateSplit(sp.id, "odometer", e.target.value)} placeholder="Reading" type="number" inputMode="decimal"
                        style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 13, outline: "none", fontFamily: "inherit", color: "#0f172a", background: "white" }}
                        onFocus={e => e.target.style.borderColor = "#22c55e"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 11, color: "#374151", fontWeight: 600, marginBottom: 3 }}>Litres</label>
                      <input value={sp.litres} onChange={e => updateSplit(sp.id, "litres", e.target.value)} placeholder="e.g. 15.14" type="number" inputMode="decimal"
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
          if (!form.driverFirstName || !form.driverLastName || !form.registration || !form.division || !form.vehicleType || !form.odometer) { setError("Please fill in all required fields."); return; }
          if (splitMode) {
            for (const sp of splits) {
              if (sp.splitType === "vehicle" && (!sp.rego || !sp.odometer)) { setError("Please fill in rego and odometer for all vehicles."); return; }
              if (sp.splitType === "other" && !sp.equipment) { setError("Please enter the equipment/purpose for all other items."); return; }
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
      const result = await claudeScan(apiKey, b64, mime,
        `Extract fleet card details from this Shell FleetCard image. The card layout top to bottom is:
Line 1: "FleetCard" logo
Line 2: 16-digit card number starting with 7034
Line 3: Cardholder surname + vehicle model (e.g. "WHITE NNR-451") — this is NOT the rego
Line 4: VEHICLE REGISTRATION — the actual rego (e.g. "DF25LB") — short 5-7 char alphanumeric code
Line 5: Expiry date

CRITICAL: The registration is on the line BELOW the surname. Do NOT return the surname line as the rego.

Return ONLY valid JSON: {"cardNumber":"full 16 digit number or null","vehicleOnCard":"registration from line 4 or null"}`
      );
      if (result?.cardNumber || result?.vehicleOnCard) {
        const matched = fuzzyMatchFleetCard(result.cardNumber, result.vehicleOnCard, learnedDBRef.current);
        setCardData({ cardNumber: matched.cardNumber, vehicleOnCard: matched.vehicleOnCard, _corrected: matched._corrected, _originalCard: matched._originalCard, _originalRego: matched._originalRego });
        showToast(matched._corrected ? "Fleet card scanned (auto-corrected)" : "Fleet card scanned");
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
              // Allocate fuel line 0 → primary vehicle
              if (lines[0]?.litres) setForm(f => ({ ...f, litres: lines[0].litres.toString() }));
              let fuelIdx = 1;
              let otherIdx = 0;
              setSplits(prev => prev.map(sp => {
                if (sp.splitType === "vehicle" && fuelIdx < lines.length) {
                  const line = lines[fuelIdx++];
                  return line?.litres ? { ...sp, litres: line.litres.toString(), _matchedLine: line } : sp;
                }
                if (sp.splitType === "other") {
                  // Is this a fuel-consuming item (jerry can, chainsaw, etc)?
                  const isFuel = FUEL_EQUIPMENT_RE.test(sp.equipment);
                  if (isFuel && fuelIdx < lines.length) {
                    // Match to next fuel line
                    const line = lines[fuelIdx++];
                    return { ...sp, litres: line.litres?.toString() || sp.litres, _matchedLine: line, _matchedItem: null };
                  } else if (!isFuel && otherIdx < otherItems.length) {
                    // Match to next non-fuel otherItem
                    const item = otherItems[otherIdx++];
                    return item ? { ...sp, _matchedItem: item, _matchedLine: null } : sp;
                  }
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
              <input value={manualCardNum} onChange={e => setManualCardNum(e.target.value)} placeholder="e.g. 7034 3051 1700 2350"
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
              setCardData({ cardNumber: manualCardNum.replace(/\s/g, "") || null, vehicleOnCard: manualCardRego.trim().toUpperCase() || null });
              showToast("Fleet card details saved");
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
          <span style={{ fontWeight: 600, color: "#0f172a" }}>{receiptData.odometer.toLocaleString()} km</span>
        </div>
      )}

      {error && <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: 10, marginBottom: 12, marginTop: 12, fontSize: 13, color: "#b91c1c" }}>{error}</div>}
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <SecondaryBtn onClick={() => { setError(""); setStep(1); }}>{"\u2190"} Back</SecondaryBtn>
        <div style={{ flex: 1 }}>
          <PrimaryBtn onClick={() => { document.activeElement?.blur(); setError(""); setStep(3); }} disabled={!receiptPreview || receiptScanning}>Review {"\u2192"}</PrimaryBtn>
        </div>
      </div>
    </div>
    );
  };

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
          <div style={{ background: "white", border: "1px solid #fde047", borderRadius: 10, overflow: "hidden", marginBottom: 20 }}>
            <div style={{ background: "#fefce8", padding: "8px 14px", fontSize: 11, fontWeight: 700, color: "#854d0e", letterSpacing: "0.04em", textTransform: "uppercase" }}>{"\u26FD"} Oil & Other Claim</div>
            {[
              { label: "First Name", val: form.driverFirstName, set: v => setForm(f => ({...f, driverFirstName: v})) },
              { label: "Last Name", val: form.driverLastName, set: v => setForm(f => ({...f, driverLastName: v})) },
              { label: "Division", val: otherForm.division, set: v => setOtherForm(f => ({...f, division: v})) },
              { label: "Equipment", val: otherForm.equipment, set: v => setOtherForm(f => ({...f, equipment: v})) },
              { label: "Station", val: otherForm.station || receiptData?.station || "", set: v => setOtherForm(f => ({...f, station: v})) },
              { label: "Fleet Card", val: cardData?.cardNumber || otherForm.fleetCard || "", set: v => setCardData(d => ({...(d || {}), cardNumber: v.replace(/\s/g, "")})) },
              { label: "Card Rego", val: cardData?.vehicleOnCard || otherForm.cardRego || "", set: v => setCardData(d => ({...(d || {}), vehicleOnCard: v.toUpperCase()})) },
              { label: "Date", val: receiptData?.date || "", set: v => setReceiptData(d => ({...d, date: v})) },
              { label: "Litres", val: receiptData?._rawLitres || receiptData?.litres?.toString() || "", set: v => setReceiptData(d => ({...d, litres: v, _rawLitres: v})) },
              { label: "$/L", val: receiptData?._rawPpl || receiptData?.pricePerLitre?.toString() || "", set: v => setReceiptData(d => ({...d, pricePerLitre: v, _rawPpl: v})) },
              { label: "Total Cost", val: receiptData?._rawCost || receiptData?.totalCost?.toString() || "", set: v => setReceiptData(d => ({...d, totalCost: v, _rawCost: v})) },
              { label: "Notes", val: otherForm.notes || "", set: v => setOtherForm(f => ({...f, notes: v})) },
            ].map(({ label, val, set }, i, arr) => (
              <div key={label} style={rowStyle(i, arr.length)}>
                <span style={labelStyle}>{label}</span>
                <input value={val} onChange={e => set(e.target.value)} style={inputStyle} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <SecondaryBtn onClick={() => setStep(2)}>{"\u2190"} Back</SecondaryBtn>
            <div style={{ flex: 1 }}><PrimaryBtn onClick={handleSubmit} loading={saving}>Submit Claim</PrimaryBtn></div>
          </div>
        </div>
      );
    }

    // ── Vehicle mode review — match scanned lines to entries in order ──
    const scannedLines = receiptData?.lines || [];
    const scannedOtherItems = receiptData?.otherItems || [];
    const regoMatch = form._regoMatch;
    const globalPpl = receiptData?.pricePerLitre;

    // Build matched preview data in same order as handleSubmit
    let lineIdx = 0;
    let otherItemIdx = 0;

    const primaryLine = splitMode && scannedLines[lineIdx] ? scannedLines[lineIdx++] : null;
    const primaryFuelType = primaryLine?.fuelType || receiptData?.fuelType || regoMatch?.f || "";
    const primaryPpl = primaryLine?.pricePerLitre || globalPpl;
    const primaryLitres = splitMode
      ? (form.litres || primaryLine?.litres?.toString() || "0")
      : (receiptData?._rawLitres || receiptData?.litres?.toString() || "");
    const primaryCost = receiptData?._rawCost
      || (splitMode
        ? (primaryLine?.cost?.toFixed(2) || (parseFloat(primaryLitres) * (primaryPpl || 0)).toFixed(2))
        : (receiptData?.fuelCost?.toString() || receiptData?.totalCost?.toString() || ""));

    const vehicleRows = [
      { label: "First Name", val: form.driverFirstName, set: v => setForm(f => ({...f, driverFirstName: v})) },
      { label: "Last Name", val: form.driverLastName, set: v => setForm(f => ({...f, driverLastName: v})) },
      { label: "Registration", val: form.registration, set: v => setForm(f => ({...f, registration: v.toUpperCase()})) },
      { label: "Division", val: form.division, set: v => setForm(f => ({...f, division: v})) },
      { label: "Vehicle type", val: form.vehicleType, set: v => setForm(f => ({...f, vehicleType: v})) },
      { label: "Odometer", val: form.odometer, set: v => setForm(f => ({...f, odometer: v})) },
      { label: "Date", val: receiptData?.date || "", set: v => setReceiptData(d => ({...d, date: v})) },
      { label: "Station", val: receiptData?.station || "", set: v => setReceiptData(d => ({...d, station: v})) },
      { label: "Fuel type", val: primaryFuelType, set: v => setReceiptData(d => ({...d, fuelType: v})) },
      { label: "Litres", val: primaryLitres, set: v => { if (splitMode) setForm(f => ({...f, litres: v})); else setReceiptData(d => ({...d, litres: v, _rawLitres: v})); } },
      { label: "$/L", val: receiptData?._rawPpl || primaryPpl?.toString() || "", set: v => setReceiptData(d => ({...d, pricePerLitre: v, _rawPpl: v})) },
      { label: "Cost", val: primaryCost, set: v => setReceiptData(d => ({...d, totalCost: v, _rawCost: v})) },
    ];

    const cardRows = [
      { label: "Card Number", val: cardData?.cardNumber || regoMatch?.c || "", set: v => setCardData(d => ({...(d || {}), cardNumber: v.replace(/\s/g, "")})) },
      { label: "Card Rego", val: cardData?.vehicleOnCard || "", set: v => setCardData(d => ({...(d || {}), vehicleOnCard: v.toUpperCase()})) },
    ];
    const hasCardData = !!(cardData?.cardNumber || regoMatch?.c);

    // Pre-compute matched data for each split
    const splitPreviews = splits.map(sp => {
      const isOther = sp.splitType === "other";
      const isFuelOther = isOther && FUEL_EQUIPMENT_RE.test(sp.equipment);

      if (isOther && !isFuelOther && otherItemIdx < scannedOtherItems.length) {
        // Non-fuel item → match to next otherItem
        const item = scannedOtherItems[otherItemIdx++];
        return { ...sp, _matchedItem: item, _matchedLine: null, _isFuelOther: false };
      } else if ((isOther && isFuelOther) || !isOther) {
        // Fuel-type (vehicle or fuel-other like jerry can) → match to next fuel line
        const line = lineIdx < scannedLines.length ? scannedLines[lineIdx++] : null;
        return { ...sp, _matchedLine: line, _matchedItem: null, _isFuelOther: isFuelOther };
      }
      return { ...sp, _matchedLine: null, _matchedItem: null, _isFuelOther: false };
    });

    return (
      <div className="fade-in">
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>Review & Confirm</div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>
            {splitMode ? `Split receipt \u2014 ${1 + splits.length} items \u00B7 ` : ""}Tap any value to edit
          </div>
        </div>

        {splitMode && (
          <div style={{ fontSize: 12, fontWeight: 700, color: "#15803d", marginBottom: 6 }}>Vehicle 1 (primary)</div>
        )}

        {/* Fuel Receipt Section */}
        <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>
          <div style={{ background: "#f0fdf4", padding: "8px 14px", fontSize: 11, fontWeight: 700, color: "#15803d", letterSpacing: "0.04em", textTransform: "uppercase", borderBottom: "1px solid #86efac" }}>
            {"\u26FD"} Fuel Receipt Details
          </div>
          {vehicleRows.map(({ label, val, set }, i) => (
            <div key={label} style={rowStyle(i, vehicleRows.length)}>
              <span style={labelStyle}>{label}</span>
              {set ? (
                <input value={val} onChange={e => set(e.target.value)} style={inputStyle} onFocus={focusStyle} onBlur={blurStyle} />
              ) : (
                <span style={{ fontWeight: 500, color: "#0f172a", textAlign: "right", fontSize: 13 }}>{val || "\u2014"}</span>
              )}
            </div>
          ))}
        </div>

        {/* Fleet Card Section */}
        {hasCardData && (
          <div style={{ background: "white", border: "2px solid #fdba74", borderRadius: 10, overflow: "hidden", marginBottom: splitMode ? 12 : 20 }}>
            <div style={{ background: "#fff7ed", padding: "10px 14px", borderBottom: "1px solid #fdba74" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#c2410c", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                {"\uD83D\uDCB3"} Fleet Card Details
              </div>
              <div style={{ fontSize: 11, color: "#92400e", marginTop: 3, fontWeight: 500 }}>
                {"\u26A0"} Please double-check the card number and rego below — AI scanning can misread embossed card text
              </div>
            </div>
            {cardRows.map(({ label, val, set }, i) => (
              <div key={label} style={rowStyle(i, cardRows.length)}>
                <span style={labelStyle}>{label}</span>
                <input value={val} onChange={e => set(e.target.value)} style={{...inputStyle, fontWeight: 700, color: "#c2410c"}} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
            ))}
          </div>
        )}
        {!hasCardData && <div style={{ marginBottom: splitMode ? 12 : 20 }} />}

        {/* Split entries — matched to scanned data */}
        {splitMode && splitPreviews.map((sp, si) => {
          const isOther = sp.splitType === "other";
          const ml = sp._matchedLine;
          const mi = sp._matchedItem;

          let spRows;
          if (isOther && mi) {
            spRows = [
              { label: "Equipment", val: sp.equipment, set: v => updateSplit(sp.id, "equipment", v) },
              { label: "Matched to", val: mi.description + (mi.quantity ? ` (${mi.quantity})` : ""), set: null },
              { label: "Cost", val: sp._costOverride || mi.cost?.toFixed(2) || "", set: v => updateSplit(sp.id, "_costOverride", v) },
            ];
          } else if (isOther && ml) {
            spRows = [
              { label: "Equipment", val: sp.equipment, set: v => updateSplit(sp.id, "equipment", v) },
              { label: "Fuel type", val: ml.fuelType || "", set: null },
              { label: "Litres", val: ml.litres?.toString() || sp.litres, set: v => updateSplit(sp.id, "litres", v) },
              { label: "$/L", val: ml.pricePerLitre?.toString() || globalPpl?.toString() || "", set: null },
              { label: "Cost", val: sp._costOverride || ml.cost?.toFixed(2) || "", set: v => updateSplit(sp.id, "_costOverride", v) },
              { label: "Notes", val: sp.notes || "", set: v => updateSplit(sp.id, "notes", v) },
            ];
          } else if (isOther) {
            const spLitres = parseFloat(sp.litres) || 0;
            spRows = [
              { label: "Equipment", val: sp.equipment, set: v => updateSplit(sp.id, "equipment", v) },
              { label: "Litres", val: sp.litres, set: v => updateSplit(sp.id, "litres", v) },
              { label: "Notes", val: sp.notes || "", set: v => updateSplit(sp.id, "notes", v) },
              { label: "Cost", val: sp._costOverride || (spLitres && globalPpl ? (spLitres * globalPpl).toFixed(2) : ""), set: v => updateSplit(sp.id, "_costOverride", v) },
            ];
          } else {
            const spMatch = sp._match || lookupRego(sp.rego, learnedDBRef.current, entriesRef.current);
            spRows = [
              { label: "Registration", val: sp.rego, set: v => updateSplit(sp.id, "rego", v.toUpperCase()) },
              { label: "Vehicle", val: spMatch?.n || spMatch?.t || "\u2014", set: null },
              { label: "Fuel type", val: ml?.fuelType || "", set: null },
              { label: "Odometer", val: sp.odometer, set: v => updateSplit(sp.id, "odometer", v) },
              { label: "Litres", val: ml?.litres?.toString() || sp.litres, set: v => updateSplit(sp.id, "litres", v) },
              { label: "$/L", val: ml?.pricePerLitre?.toString() || globalPpl?.toString() || "", set: null },
              { label: "Cost", val: sp._costOverride || ml?.cost?.toFixed(2) || "", set: v => updateSplit(sp.id, "_costOverride", v) },
            ];
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

        <div style={{ display: "flex", gap: 10 }}>
          <SecondaryBtn onClick={() => setStep(2)}>{"\u2190"} Back</SecondaryBtn>
          <div style={{ flex: 1 }}>
            <PrimaryBtn onClick={handleSubmit} loading={saving}>
              {splitMode ? `Submit ${1 + splits.length} Entries` : "Submit Entry"}
            </PrimaryBtn>
          </div>
        </div>
      </div>
    );
  };

  const renderStep4 = () => {
    const parsedCost = parseFloat(receiptData?.totalCost) || parseFloat(receiptData?._rawCost) || null;
    const parsedLitres = parseFloat(receiptData?.litres) || parseFloat(receiptData?._rawLitres) || null;
    const fuelType = receiptData?.fuelType || "";
    const station = receiptData?.station || otherForm.station || "";
    const date = receiptData?.date || "";

    return (
      <div className="fade-in" style={{ textAlign: "center", padding: "24px 0" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: otherMode ? "#fefce8" : "#f0fdf4", border: `2px solid ${otherMode ? "#fde047" : "#86efac"}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 28 }}>{"\u2713"}</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: otherMode ? "#854d0e" : "#15803d", marginBottom: 16 }}>
          {otherMode ? "Claim Saved!" : splitMode ? `${1 + splits.length} Entries Saved!` : "Entry Saved!"}
        </div>

        {/* Summary card */}
        <div style={{
          background: "white", border: "1px solid #e2e8f0", borderRadius: 10,
          padding: "16px", textAlign: "left", marginBottom: 20,
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
            {!otherMode && form.odometer && <span style={{ padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 500, background: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0" }}>{parseFloat(form.odometer).toLocaleString()} km</span>}
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

    // Count operational flags only (excluding resolved) — AI flags show in Data section
    let totalFlags = 0;
    let totalAiFlags = 0;
    [...new Set(vehicleEntries.map(e => e.registration))].forEach(rego => {
      const re = vehicleEntries.filter(e => e.registration === rego).sort(sortEntries);
      const vt = re[0]?.vehicleType || "Other";
      re.forEach((e, i) => {
        const flags = getEntryFlags(e, i > 0 ? re[i - 1] : null, vt, serviceData[rego]);
        totalFlags += flags.filter(f => f.category === "ops" && (f.type === "danger" || f.type === "warn") && !resolvedFlags[flagId({ ...f, rego, date: e.date, odo: e.odometer })]).length;
        totalAiFlags += flags.filter(f => f.category === "ai" && (f.type === "danger" || f.type === "warn") && !resolvedFlags[flagId({ ...f, rego, date: e.date, odo: e.odometer })]).length;
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
          const aiFlags = [];
          [...new Set(vehicleEntries.map(e => e.registration))].forEach(rego => {
            const re = vehicleEntries.filter(e => e.registration === rego).sort(sortEntries);
            const vt = re[0]?.vehicleType || "Other";
            re.forEach((e, i) => {
              const flags = getEntryFlags(e, i > 0 ? re[i - 1] : null, vt, serviceData[rego]);
              flags.filter(f => f.category === "ai" && (f.type === "danger" || f.type === "warn")).forEach(f => {
                const fid = flagId({ ...f, rego, date: e.date, odo: e.odometer });
                if (!resolvedFlags[fid]) {
                  aiFlags.push({ ...f, rego, date: e.date, _id: fid, _entry: e });
                }
              });
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
        {entries.length > 0 && (
          <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 10 }}>Export to Excel</div>
            {DIVISION_KEYS.map(dk => {
              const dc = DIVISIONS[dk].color;
              const divEntries = entries.filter(e => (e.division || getDivision(e.vehicleType)) === dk);
              if (!divEntries.length) return null;
              const divTypes = [...new Set(divEntries.map(e => e.vehicleType))];
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
                const divEntries = entries.filter(e => (e.division || getDivision(e.vehicleType)) === dk);
                [...new Set(divEntries.map(e => e.vehicleType))].forEach(t => exportVehicleType(divEntries, t, serviceData));
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
                      const nextServiceDue = svc?.lastServiceKms ? svc.lastServiceKms + SERVICE_INTERVAL_KM : null;
                      const isOverdue = nextServiceDue && latestOdo && latestOdo >= nextServiceDue;
                      const isServiceSoon = nextServiceDue && latestOdo && !isOverdue && (nextServiceDue - latestOdo) <= SERVICE_WARNING_KM;

                      // Collect flags
                      const vehicleFlags = [];
                      sorted.forEach((e, i) => {
                        const flags = getEntryFlags(e, i > 0 ? sorted[i - 1] : null, vt, serviceData[rego]);
                        flags.forEach(f => vehicleFlags.push({ ...f, rego, entryDate: e.date, odo: e.odometer }));
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
                          <div onClick={() => setExpandedRego(isExpanded ? null : rego)}
                            className={showOverdueHighlight ? "svc-overdue" : ""}
                            style={{
                              background: "white",
                              border: `1px solid ${showOverdueHighlight ? "#fca5a5" : isServiceSoon ? "#fcd34d" : "#e2e8f0"}`,
                              borderRadius: isExpanded ? "10px 10px 0 0" : 10, padding: "12px 14px", cursor: "pointer", transition: "all 0.15s",
                            }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", letterSpacing: "0.03em" }}>{rego}</span>
                                {dangerCount > 0 && <span onClick={(ev) => { ev.stopPropagation(); setShowFlags(true); setFlagsFilter("open"); }} className="flag-badge flag-danger" style={{ cursor: "pointer" }}>{"\u26A0"} {dangerCount}</span>}
                                {warnCount > 0 && <span onClick={(ev) => { ev.stopPropagation(); setShowFlags(true); setFlagsFilter("open"); }} className="flag-badge flag-warn" style={{ cursor: "pointer" }}>{"\u26A1"} {warnCount}</span>}
                                {aiCount > 0 && <span onClick={(ev) => { ev.stopPropagation(); setShowAiFlags(true); }} style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 7px", borderRadius: 10, fontSize: 10, fontWeight: 700, background: "#ede9fe", color: "#7c3aed", border: "1px solid #c4b5fd", cursor: "pointer" }}>{"\uD83E\uDD16"} {aiCount}</span>}
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
                            <div style={{ display: "flex", gap: 16, fontSize: 11, color: "#64748b", flexWrap: "wrap" }}>
                              <span>{sorted.length} fill-ups</span>
                              {vehicleTotalLitres > 0 && <span>{vehicleTotalLitres.toFixed(1)}L total</span>}
                              {latestOdo && <span>Odo: {latestOdo.toLocaleString()} km</span>}
                              {svc?.lastServiceDate && <span>Last svc: {svc.lastServiceDate}</span>}
                              {nextServiceDue && (
                                <span style={{ color: showOverdueHighlight ? "#dc2626" : isServiceSoon ? "#b45309" : "#64748b", fontWeight: showOverdueHighlight ? 700 : 400 }}>
                                  {showOverdueHighlight ? `SERVICE OVERDUE (due ${nextServiceDue.toLocaleString()})` : `Next svc: ${nextServiceDue.toLocaleString()} km`}
                                </span>
                              )}
                            </div>
                          </div>

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
                                      <strong style={{ color: "#374151" }}>Service:</strong> {svc.lastServiceDate} at {svc.lastServiceKms?.toLocaleString()} km
                                      {" \u00B7 "}<strong>Next due:</strong> {(svc.lastServiceKms + SERVICE_INTERVAL_KM).toLocaleString()} km
                                      {latestOdo && svc.lastServiceKms && <>{" \u00B7 "}<strong>{(latestOdo - svc.lastServiceKms).toLocaleString()} km</strong> since service</>}
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
                                        <th style={{ color: "#374151", borderBottom: "1px solid #e2e8f0" }}>Odo Start</th>
                                        <th style={{ color: "#374151", borderBottom: "1px solid #e2e8f0" }}>Odo Finish</th>
                                        <th style={{ color: "#374151", borderBottom: "1px solid #e2e8f0" }}>KM Trav.</th>
                                        <th style={{ color: "#374151", borderBottom: "1px solid #e2e8f0" }}>Litres</th>
                                        <th style={{ color: "#374151", borderBottom: "1px solid #e2e8f0" }}>$/L</th>
                                        <th style={{ color: "#374151", borderBottom: "1px solid #e2e8f0", borderRight: "1px solid #e2e8f0" }}>Fuel Cost</th>
                                        <th style={{ background: "#f8fafc", width: 3, padding: 0, borderBottom: "1px solid #e2e8f0" }}></th>
                                        <th style={{ color: "#1e40af", borderBottom: "1px solid #e2e8f0" }}>L/km</th>
                                        <th style={{ color: "#1e40af", borderBottom: "1px solid #e2e8f0" }}>KM Trav.</th>
                                        <th style={{ color: "#1e40af", borderBottom: "1px solid #e2e8f0" }}>Tot. Litres</th>
                                        <th style={{ color: "#1e40af", borderBottom: "1px solid #e2e8f0" }}>Petrol $/L</th>
                                        <th style={{ color: "#1e40af", borderBottom: "1px solid #e2e8f0" }}>Calc Cost</th>
                                        <th style={{ color: "#1e40af", borderBottom: "1px solid #e2e8f0", borderRight: "1px solid #e2e8f0" }}>+/- Var.</th>
                                        <th style={{ background: "#f8fafc", width: 3, padding: 0, borderBottom: "1px solid #e2e8f0" }}></th>
                                        <th style={{ color: "#854d0e", borderBottom: "1px solid #e2e8f0" }}>Svc Date</th>
                                        <th style={{ color: "#854d0e", borderBottom: "1px solid #e2e8f0" }}>Svc KMs</th>
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
                                              {lPerKm != null ? lPerKm.toFixed(3) : "\u2014"}
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

                              {/* Flags summary */}
                              {vehicleFlags.length > 0 && (
                                <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                                  {vehicleFlags.map((f, fi) => (
                                    <div key={fi} className={`flag-badge flag-${f.type}`} title={f.detail}>
                                      {f.type === "danger" ? "\u26A0" : f.type === "warn" ? "\u26A1" : f.type === "info" ? "\u2139" : "\u2713"}{" "}
                                      {f.text}
                                      {f.entryDate && <span style={{ opacity: 0.7, marginLeft: 3 }}>({f.entryDate})</span>}
                                    </div>
                                  ))}
                                </div>
                              )}
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
                            <td style={{ color: "#374151", fontSize: 10 }}>{e.fleetCardNumber || "\u2014"}</td>
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
      const nextServiceDue = svc?.lastServiceKms ? svc.lastServiceKms + SERVICE_INTERVAL_KM : null;
      const kmSinceService = svc?.lastServiceKms ? latestOdo - svc.lastServiceKms : null;
      const kmToService = nextServiceDue ? nextServiceDue - latestOdo : null;

      // Service status
      let svcStatus = "unknown"; // unknown, ok, approaching, due, overdue
      if (!svc?.lastServiceKms) svcStatus = "unknown";
      else if (latestOdo >= nextServiceDue) svcStatus = "overdue";
      else if (kmToService <= SERVICE_WARNING_KM) svcStatus = "approaching";
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
  }, [entries, serviceData, resolvedFlags]);

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
      setDashDate(d.toISOString().slice(0, 10));
    };

    // Per-vehicle breakdown for this period
    const periodByVehicle = {};
    periodVehicle.forEach(e => {
      if (!periodByVehicle[e.registration]) periodByVehicle[e.registration] = { rego: e.registration, division: e.division, type: e.vehicleType, litres: 0, cost: 0, fills: 0, km: 0, drivers: new Set(), odos: [] };
      periodByVehicle[e.registration].litres += e.litres || 0;
      periodByVehicle[e.registration].cost += e.totalCost || 0;
      periodByVehicle[e.registration].fills += 1;
      if (e.driverName) periodByVehicle[e.registration].drivers.add(e.driverName);
      if (e.odometer) periodByVehicle[e.registration].odos.push(e.odometer);
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

    // Sort fleet: overdue first, then approaching, then by most flags
    const sorted = [...fleet].sort((a, b) => {
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
              ["Fleet Dashboard Report", "", "", "", "", "", "", range.label],
              [`Period: ${dashPeriod.charAt(0).toUpperCase() + dashPeriod.slice(1)}`, "", "", "", "", "", "", `Generated: ${new Date().toLocaleDateString("en-AU")}`],
              [],
              ["Vehicle", "Division", "Type", "Fill-ups", "KM Travelled", "Litres", "Cost ($)", "Drivers"],
            ];
            periodVehicles.forEach(v => {
              summaryRows.push([v.rego, v.division, v.type, v.fills, v.km || "", Math.round(v.litres * 100) / 100, Math.round(v.cost * 100) / 100, [...v.drivers].join(", ")]);
            });
            summaryRows.push([]);
            summaryRows.push(["TOTAL", "", "", periodFillUps, periodTotalKm || "", Math.round(periodLitres * 100) / 100, Math.round(periodSpend * 100) / 100, ""]);
            summaryRows.push([]);
            summaryRows.push(["Avg $/day", "", "", "", "", "", (() => {
              if (dashPeriod === "daily") return Math.round(periodSpend * 100) / 100;
              if (dashPeriod === "weekly") return Math.round(periodSpend / 7 * 100) / 100;
              if (dashPeriod === "monthly") { const days = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0).getDate(); return Math.round(periodSpend / days * 100) / 100; }
              return "";
            })(), ""]);

            const sws = XLSX.utils.aoa_to_sheet(summaryRows);
            sws["!cols"] = [{wch:14},{wch:12},{wch:14},{wch:10},{wch:12},{wch:10},{wch:12},{wch:30}];
            XLSX.utils.book_append_sheet(wb, sws, "Summary");

            // Individual entries sheet
            const entryRows = [
              ["All Entries — " + range.label],
              [],
              ["Date", "Driver", "Registration", "Division", "Type", "Odometer", "Litres", "$/L", "Cost ($)", "Fuel Type", "Station", "Fleet Card"],
            ];
            periodEntries.forEach(e => {
              entryRows.push([
                e.date || "", e.driverName || "",
                e.entryType === "other" ? (e.equipment || "Other") : (e.registration || ""),
                e.division || "", e.vehicleType || e.entryType || "",
                e.odometer || "", e.litres || "", e.pricePerLitre || "",
                e.totalCost ? Math.round(e.totalCost * 100) / 100 : "",
                e.fuelType || "", e.station || "", e.fleetCardNumber || "",
              ]);
            });
            const ews = XLSX.utils.aoa_to_sheet(entryRows);
            ews["!cols"] = [{wch:12},{wch:18},{wch:14},{wch:12},{wch:14},{wch:10},{wch:8},{wch:7},{wch:10},{wch:14},{wch:20},{wch:20}];
            XLSX.utils.book_append_sheet(wb, ews, "All Entries");

            // Other claims sheet if any
            if (periodOther.length > 0) {
              const oRows = [
                ["Oil & Other Claims — " + range.label],
                [],
                ["Date", "Driver", "Division", "Equipment", "Station", "Fleet Card", "Card Rego", "Litres", "$/L", "Cost ($)", "Notes"],
              ];
              periodOther.forEach(e => {
                oRows.push([
                  e.date || "", e.driverName || "", e.division || "",
                  e.equipment || "", e.station || "", e.fleetCardNumber || "",
                  e.cardRego || "", e.litres || "", e.pricePerLitre || "",
                  e.totalCost ? Math.round(e.totalCost * 100) / 100 : "",
                  e.notes || "",
                ]);
              });
              const ows = XLSX.utils.aoa_to_sheet(oRows);
              ows["!cols"] = [{wch:12},{wch:18},{wch:12},{wch:25},{wch:20},{wch:20},{wch:10},{wch:8},{wch:7},{wch:10},{wch:30}];
              XLSX.utils.book_append_sheet(wb, ows, "Oil & Others");
            }

            XLSX.writeFile(wb, `Dashboard_Report_${safeName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
            showToast("Dashboard report exported");
          };

          return (
          <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
            <div style={{ padding: "10px 14px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>{"\uD83D\uDE97"} Vehicle Spend — {range.label}</span>
              <button onClick={exportDashboard} style={{
                padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
                background: "#16a34a", color: "white", border: "none",
              }}>{"\uD83D\uDCE5"} Export</button>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr style={{ background: "#fafafa" }}>
                    <th style={{ color: "#374151", borderBottom: "1px solid #e2e8f0" }}>Vehicle</th>
                    <th style={{ color: "#374151", borderBottom: "1px solid #e2e8f0" }}>Division</th>
                    <th style={{ color: "#374151", borderBottom: "1px solid #e2e8f0" }}>Type</th>
                    <th style={{ color: "#374151", borderBottom: "1px solid #e2e8f0" }}>Fill-ups</th>
                    <th style={{ color: "#374151", borderBottom: "1px solid #e2e8f0" }}>KM</th>
                    <th style={{ color: "#374151", borderBottom: "1px solid #e2e8f0" }}>Litres</th>
                    <th style={{ color: "#374151", borderBottom: "1px solid #e2e8f0" }}>Cost</th>
                    <th style={{ color: "#374151", borderBottom: "1px solid #e2e8f0" }}>Drivers</th>
                  </tr>
                </thead>
                <tbody>
                  {periodVehicles.map(v => (
                    <tr key={v.rego}>
                      <td style={{ fontWeight: 700, color: "#0f172a" }}>{v.rego}</td>
                      <td style={{ color: "#64748b", fontSize: 11 }}>{v.division}</td>
                      <td style={{ color: "#64748b", fontSize: 11 }}>{v.type}</td>
                      <td style={{ color: "#374151" }}>{v.fills}</td>
                      <td style={{ color: "#374151" }}>{v.km > 0 ? v.km.toLocaleString() : "\u2014"}</td>
                      <td style={{ color: "#374151" }}>{v.litres.toFixed(1)}L</td>
                      <td style={{ fontWeight: 600, color: "#16a34a" }}>${v.cost.toFixed(2)}</td>
                      <td style={{ color: "#64748b", fontSize: 10 }}>{[...v.drivers].join(", ")}</td>
                    </tr>
                  ))}
                  <tr style={{ background: "#f8fafc", borderTop: "2px solid #e2e8f0" }}>
                    <td style={{ fontWeight: 700, color: "#374151" }}>TOTAL</td>
                    <td></td><td></td>
                    <td style={{ fontWeight: 700 }}>{periodFillUps}</td>
                    <td style={{ fontWeight: 700 }}>{periodTotalKm > 0 ? periodTotalKm.toLocaleString() : "\u2014"}</td>
                    <td style={{ fontWeight: 700 }}>{periodLitres.toFixed(0)}L</td>
                    <td style={{ fontWeight: 700, color: "#16a34a" }}>${periodSpend.toFixed(2)}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          );
        })()}
        {periodVehicles.length === 0 && dashPeriod !== "all" && periodOther.length === 0 && (
          <div style={{ textAlign: "center", padding: "24px 0", color: "#94a3b8", fontSize: 13, background: "white", border: "1px solid #e2e8f0", borderRadius: 10, marginBottom: 16 }}>
            No fuel entries for {range.label}
          </div>
        )}

        {/* ── Other claims for this period ── */}
        {periodOther.length > 0 && (
          <div style={{ background: "white", border: "1px solid #fde047", borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
            <div style={{ padding: "10px 14px", background: "#fefce8", borderBottom: "1px solid #fde047", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#854d0e" }}>{"\u26FD"} Oil & Other Claims — {range.label}</span>
              <span style={{ fontSize: 11, color: "#854d0e", fontWeight: 500 }}>
                {periodOther.length} claim{periodOther.length !== 1 ? "s" : ""} {"\u00B7"} ${periodOther.reduce((s, e) => s + (e.totalCost || 0), 0).toFixed(2)}
              </span>
            </div>
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
                    </tr>
                  ))}
                  <tr style={{ background: "#fffbeb", borderTop: "2px solid #fde047" }}>
                    <td style={{ fontWeight: 700, color: "#854d0e" }}>TOTAL</td>
                    <td></td><td></td><td></td>
                    <td style={{ fontWeight: 700, color: "#854d0e" }}>{periodOther.reduce((s, e) => s + (e.litres || 0), 0) > 0 ? periodOther.reduce((s, e) => s + (e.litres || 0), 0).toFixed(1) + "L" : ""}</td>
                    <td></td>
                    <td style={{ fontWeight: 700, color: "#16a34a" }}>${periodOther.reduce((s, e) => s + (e.totalCost || 0), 0).toFixed(2)}</td>
                    <td></td><td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Alert cards */}
        <div className="kpi-grid-3" style={{ marginBottom: 20 }}>
          <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "12px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#dc2626" }}>{overdue.length}</div>
            <div style={{ fontSize: 10, color: "#b91c1c", marginTop: 2, fontWeight: 600 }}>Service Overdue</div>
          </div>
          <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 10, padding: "12px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#b45309" }}>{approaching.length}</div>
            <div style={{ fontSize: 10, color: "#92400e", marginTop: 2, fontWeight: 600 }}>Service Due Soon</div>
          </div>
          <div style={{ background: "#fff7ed", border: "1px solid #fdba74", borderRadius: 10, padding: "12px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#c2410c" }}>{worsening.length}</div>
            <div style={{ fontSize: 10, color: "#c2410c", marginTop: 2, fontWeight: 600 }}>Efficiency Worsening</div>
          </div>
        </div>

        {/* Fleet table */}
        <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={{ borderBottom: "2px solid #e2e8f0", color: "#374151" }}>Vehicle</th>
                  <th style={{ borderBottom: "2px solid #e2e8f0", color: "#374151" }}>Division</th>
                  <th style={{ borderBottom: "2px solid #e2e8f0", color: "#374151" }}>Type</th>
                  <th style={{ borderBottom: "2px solid #e2e8f0", color: "#374151" }}>Odometer</th>
                  <th style={{ borderBottom: "2px solid #e2e8f0", color: "#374151" }}>Fill-ups</th>
                  <th style={{ borderBottom: "2px solid #e2e8f0", color: "#374151" }}>Total KM</th>
                  <th style={{ borderBottom: "2px solid #e2e8f0", color: "#374151" }}>Total L</th>
                  <th style={{ borderBottom: "2px solid #e2e8f0", color: "#1e40af" }}>Avg L/km</th>
                  <th style={{ borderBottom: "2px solid #e2e8f0", color: "#1e40af" }}>Trend</th>
                  <th style={{ borderBottom: "2px solid #e2e8f0", color: "#854d0e" }}>Service</th>
                  <th style={{ borderBottom: "2px solid #e2e8f0", color: "#374151" }}>Flags</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(v => {
                  const sc = svcColor(v.svcStatus);
                  const effRange = EFFICIENCY_RANGES[v.vt] || EFFICIENCY_RANGES.Other;
                  return (
                    <tr key={v.rego} style={{
                      background: v.svcStatus === "overdue" ? "#fef2f2" : v.svcStatus === "approaching" ? "#fffdf5" : "white",
                    }}>
                      <td style={{ fontWeight: 700, color: "#0f172a" }}>
                        <div>{v.rego}</div>
                        {v.vehicleName && <div style={{ fontSize: 9, color: "#94a3b8", fontWeight: 400 }}>{v.vehicleName}</div>}
                      </td>
                      <td><Pill label={v.div} color={v.vt} /></td>
                      <td style={{ fontSize: 10, color: "#64748b" }}>{v.vt}</td>
                      <td style={{ color: "#374151" }}>{v.latestOdo ? v.latestOdo.toLocaleString() : "\u2014"}</td>
                      <td style={{ color: "#64748b", textAlign: "center" }}>{v.fillUps}</td>
                      <td style={{ color: "#374151" }}>{v.totalKm > 0 ? v.totalKm.toLocaleString() : "\u2014"}</td>
                      <td style={{ color: "#374151" }}>{v.totalLitres > 0 ? `${v.totalLitres.toFixed(0)}L` : "\u2014"}</td>
                      <td style={{
                        fontWeight: 600,
                        color: v.avgLPerKm ? (v.avgLPerKm > effRange.high ? "#dc2626" : v.avgLPerKm < effRange.low ? "#2563eb" : "#15803d") : "#94a3b8",
                      }}>
                        {v.avgLPerKm ? v.avgLPerKm.toFixed(3) : "\u2014"}
                      </td>
                      <td>
                        {v.trend === "worsening" && <span style={{ color: "#dc2626", fontWeight: 600, fontSize: 10 }}>{"\u2191"} Worsening</span>}
                        {v.trend === "improving" && <span style={{ color: "#15803d", fontWeight: 600, fontSize: 10 }}>{"\u2193"} Improving</span>}
                        {v.trend === "stable" && <span style={{ color: "#64748b", fontSize: 10 }}>{"\u2192"} Stable</span>}
                        {!v.trend && <span style={{ color: "#cbd5e1", fontSize: 10 }}>\u2014</span>}
                      </td>
                      <td>
                        <span className={`flag-badge flag-${v.svcStatus === "overdue" ? "danger" : v.svcStatus === "approaching" ? "warn" : "ok"}`} style={{ fontSize: 9 }}>
                          {sc.label}
                          {v.kmToService != null && v.svcStatus !== "unknown" && (
                            <span style={{ marginLeft: 3, opacity: 0.8 }}>
                              {v.svcStatus === "overdue" ? `+${Math.abs(v.kmToService).toLocaleString()}` : v.kmToService.toLocaleString()}km
                            </span>
                          )}
                        </span>
                      </td>
                      <td>
                        {v.flags.filter(f => f.category === "ops" && (f.type === "danger" || f.type === "warn")).length > 0 ? (
                          <span className="flag-badge flag-danger" style={{ fontSize: 9, cursor: "pointer" }} onClick={() => setShowFlags(true)}>
                            {v.flags.filter(f => f.category === "ops" && (f.type === "danger" || f.type === "warn")).length}
                          </span>
                        ) : (
                          <span style={{ color: "#86efac", fontSize: 12 }}>{"\u2713"}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Efficiency anomalies section */}
        {fleet.some(v => v.anomalies.length > 0) && (
          <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, padding: 16, marginTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#b91c1c", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 10 }}>{"\u26A0"} Fuel Consumption Anomalies</div>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 10 }}>Fill-ups where fuel consumption was 50%+ above that vehicle's own average {"\u2014"} may indicate leaks, theft, incorrect data, or mechanical issues.</div>
            {fleet.filter(v => v.anomalies.length > 0).map(v => (
              <div key={v.rego} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 4 }}>{v.rego} <span style={{ fontWeight: 400, color: "#94a3b8" }}>avg {v.avgLPerKm?.toFixed(3)} L/km</span></div>
                {v.anomalies.map((a, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, fontSize: 11, color: "#dc2626", padding: "2px 0" }}>
                    <span>{a.date || "?"}</span>
                    <span style={{ fontWeight: 600 }}>{a.lPerKm.toFixed(3)} L/km</span>
                    <span style={{ color: "#94a3b8" }}>+{a.pct}% above avg</span>
                    <span style={{ color: "#64748b" }}>{a.litres}L / {a.km.toLocaleString()}km</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* ── Driver Activity ── */}
        {(() => {
          const now = new Date();
          const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
          const allDrivers = [...new Set(entries.map(e => e.driverName).filter(Boolean))].sort();
          const activeDrivers = new Set();
          entries.forEach(e => {
            if (!e.driverName || !e.date) return;
            const d = parseDate(e.date);
            if (d && new Date(d) >= weekAgo) activeDrivers.add(e.driverName);
          });
          const inactiveDrivers = allDrivers.filter(d => !activeDrivers.has(d));
          const driverLastEntry = {};
          entries.forEach(e => {
            if (!e.driverName) return;
            const d = parseDate(e.date);
            if (!d) return;
            const dt = new Date(d);
            if (!driverLastEntry[e.driverName] || dt > driverLastEntry[e.driverName].dt) {
              driverLastEntry[e.driverName] = { dt, date: e.date, rego: e.registration || e.equipment || "" };
            }
          });
          if (allDrivers.length === 0) return null;
          return (
            <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, padding: 16, marginBottom: 20 }}>
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
                      }}>{"\u2713"} {d}</div>
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
                        }}>
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
  const renderFlagsModal = () => {
    if (!showFlags) return null;
    const fleet = fleetAnalysis;
    // Dashboard only shows operational flags — AI flags appear in Data section
    const opsFlags = fleet.flatMap(v => v.flags.filter(f => f.category === "ops" && (f.type === "danger" || f.type === "warn")));

    // Add stable ID to each flag
    const flagsWithId = opsFlags.map(f => ({ ...f, _id: flagId(f) }));
    const openFlags = flagsWithId.filter(f => !resolvedFlags[f._id]);
    const doneFlags = flagsWithId.filter(f => resolvedFlags[f._id]);
    const visibleFlags = flagsFilter === "open" ? openFlags : flagsFilter === "resolved" ? doneFlags : flagsWithId;

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
        { title: "Odometer / KM Issues", icon: "\uD83D\uDCCF", flags: odo, color: "#b45309" },
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
            {/* Checkbox */}
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
        </div>
      );
    };

    return (
      <div style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex",
        alignItems: "flex-start", justifyContent: "center", zIndex: 100, padding: "40px 16px",
        overflowY: "auto",
      }} onClick={() => { setShowFlags(false); setReplyingFlag(null); }}>
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
              </div>
            </div>
            <button onClick={() => { setShowFlags(false); setReplyingFlag(null); }} style={{
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

          {/* Flag list */}
          {visibleFlags.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: flagsFilter === "open" ? "#15803d" : "#94a3b8" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>{flagsFilter === "open" ? "\u2713" : "\uD83D\uDCCB"}</div>
              <div style={{ fontWeight: 600 }}>
                {flagsFilter === "open" ? "All clear! No open issues." : flagsFilter === "resolved" ? "No resolved issues yet." : "No issues found."}
              </div>
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
    const visibleFlags = flagsFilter === "open" ? openFlags : flagsFilter === "resolved" ? doneFlags : flagsWithId;

    return (
      <div style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex",
        alignItems: "flex-start", justifyContent: "center", zIndex: 100, padding: "40px 16px",
        overflowY: "auto",
      }} onClick={() => setShowAiFlags(false)}>
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
            <button onClick={() => setShowAiFlags(false)} style={{
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
              <button key={tab.key} onClick={() => setFlagsFilter(tab.key)} style={{
                padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: flagsFilter === tab.key ? 700 : 500,
                cursor: "pointer", fontFamily: "inherit",
                background: flagsFilter === tab.key ? "#7c3aed" : "#f8fafc",
                color: flagsFilter === tab.key ? "white" : "#64748b",
                border: `1px solid ${flagsFilter === tab.key ? "#7c3aed" : "#e2e8f0"}`,
              }}>{tab.label}</button>
            ))}
          </div>

          {/* Flag list */}
          {visibleFlags.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: flagsFilter === "open" ? "#15803d" : "#94a3b8" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>{flagsFilter === "open" ? "\u2713" : "\uD83E\uDD16"}</div>
              <div style={{ fontWeight: 600 }}>
                {flagsFilter === "open" ? "All AI flags reviewed!" : flagsFilter === "resolved" ? "No resolved flags yet." : "No AI flags found."}
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
                </div>
              );
            })
          )}
        </div>
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

    // Group by fleet card number
    const byCard = {};
    monthEntries.forEach(e => {
      const card = e.fleetCardNumber || e.cardRego || "";
      if (!card) return;
      const key = card.replace(/\s/g, "");
      if (!byCard[key]) byCard[key] = { card: key, entries: [], totalLitres: 0, totalCost: 0, drivers: new Set(), regos: new Set() };
      byCard[key].entries.push(e);
      byCard[key].totalLitres += e.litres || 0;
      byCard[key].totalCost += e.totalCost || 0;
      if (e.driverName) byCard[key].drivers.add(e.driverName);
      if (e.registration) byCard[key].regos.add(e.registration);
      if (e.entryType === "other" && e.equipment) byCard[key].regos.add(e.equipment);
    });

    const cards = Object.values(byCard).sort((a, b) => b.totalCost - a.totalCost);

    // Filter by search term
    const cardSearchTerm = cardSearch.trim().toUpperCase();
    const filteredCards = cardSearchTerm
      ? cards.filter(c =>
          [...c.regos].some(r => r.toUpperCase().includes(cardSearchTerm)) ||
          [...c.drivers].some(d => d.toUpperCase().includes(cardSearchTerm)) ||
          c.card.includes(cardSearchTerm) ||
          c.card.slice(-6).includes(cardSearchTerm)
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
        ["Card Number", "Last 6", "Drivers", "Vehicles/Items", "Transactions", "Total Litres", "Total Cost"],
      ];
      cards.forEach(c => {
        summaryRows.push([
          c.card, `...${c.card.slice(-6)}`,
          [...c.drivers].join(", "), [...c.regos].join(", "),
          c.entries.length, Math.round(c.totalLitres * 100) / 100,
          Math.round(c.totalCost * 100) / 100,
        ]);
      });
      summaryRows.push([]);
      summaryRows.push(["", "", "", "", "GRAND TOTAL", grandLitres.toFixed(2), grandTotal.toFixed(2)]);
      const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
      summaryWs["!cols"] = [{wch:20},{wch:10},{wch:25},{wch:25},{wch:12},{wch:12},{wch:12}];
      XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

      // Per-card detail sheets
      cards.forEach(c => {
        const tabName = `Card ${c.card.slice(-6)}`.slice(0, 31);
        const rows = [
          [`Fleet Card: ${c.card}`, "", "", "", "", monthLabel],
          ["Drivers: " + [...c.drivers].join(", ")],
          [],
          ["Date", "Driver", "Rego / Item", "Station", "Litres", "$/L", "Cost", "Fuel Type", "Division", "Type"],
        ];
        c.entries.forEach(e => {
          rows.push([
            e.date || "", e.driverName || "",
            e.entryType === "other" ? (e.equipment || "Other") : (e.registration || ""),
            e.station || "", e.litres || "", e.pricePerLitre || "",
            e.totalCost ? Math.round(e.totalCost * 100) / 100 : "",
            e.fuelType || "", e.division || "", e.vehicleType || "",
          ]);
        });
        rows.push([]);
        rows.push(["", "", "", "TOTAL", c.totalLitres.toFixed(2), "", c.totalCost.toFixed(2)]);
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws["!cols"] = [{wch:12},{wch:18},{wch:14},{wch:20},{wch:8},{wch:7},{wch:10},{wch:10},{wch:10},{wch:12}];
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
              { label: "Fleet Cards", value: cards.length, color: "#16a34a" },
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
            <div key={c.card} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, marginBottom: 12, overflow: "hidden" }}>
              {/* Card header */}
              <div style={{
                padding: "12px 14px", background: "#fff7ed", borderBottom: "1px solid #fdba74",
                display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {isAdmin && editingCard?.oldCard === c.card ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 10, color: "#64748b", fontWeight: 600, width: 55 }}>Card #:</span>
                        <input value={editingCard.newCard} onChange={e => setEditingCard(p => ({ ...p, newCard: e.target.value.replace(/\s/g, "") }))}
                          style={{ flex: 1, padding: "4px 8px", borderRadius: 5, border: "1px solid #fdba74", fontSize: 12, fontFamily: "inherit", outline: "none", color: "#0f172a" }} />
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 10, color: "#64748b", fontWeight: 600, width: 55 }}>Rego:</span>
                        <input value={editingCard.newRego} onChange={e => setEditingCard(p => ({ ...p, newRego: e.target.value.toUpperCase() }))}
                          style={{ flex: 1, padding: "4px 8px", borderRadius: 5, border: "1px solid #fdba74", fontSize: 12, fontFamily: "inherit", outline: "none", color: "#0f172a", textTransform: "uppercase" }} />
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
                        {"\uD83D\uDCB3"} ...{c.card.slice(-6)}
                        {isAdmin && (
                          <button onClick={() => setEditingCard({ oldCard: c.card, newCard: c.card, newRego: [...c.regos].join(", ") })}
                            title="Edit card details" style={{ background: "none", border: "none", color: "#c2410c", cursor: "pointer", fontSize: 12, padding: "0 4px", opacity: 0.6 }}>{"\u270E"}</button>
                        )}
                      </div>
                      <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>
                        {[...c.drivers].join(", ")} {"\u00B7"} {[...c.regos].join(", ")}
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
                      [`Fleet Card: ...${c.card.slice(-6)}`, "", "", "", "", monthLabel],
                      [`Drivers: ${[...c.drivers].join(", ")}`],
                      [`Vehicles: ${[...c.regos].join(", ")}`],
                      [],
                      ["Date", "Driver", "Rego / Item", "Division", "Type", "Station", "Litres", "$/L", "Cost ($)", "Fuel Type", "Notes"],
                    ];
                    c.entries.forEach(e => {
                      rows.push([
                        e.date || "", e.driverName || "",
                        e.entryType === "other" ? (e.equipment || "Other") : (e.registration || ""),
                        e.division || "", e.vehicleType || e.entryType || "",
                        e.station || "", e.litres || "", e.pricePerLitre || "",
                        e.totalCost ? Math.round(e.totalCost * 100) / 100 : "",
                        e.fuelType || "", e.notes || "",
                      ]);
                    });
                    rows.push([]);
                    rows.push(["TOTAL", "", "", "", "", "", c.totalLitres.toFixed(2), "", Math.round(c.totalCost * 100) / 100, "", ""]);
                    const ws = XLSX.utils.aoa_to_sheet(rows);
                    ws["!cols"] = [{wch:12},{wch:18},{wch:14},{wch:12},{wch:12},{wch:20},{wch:8},{wch:7},{wch:10},{wch:14},{wch:25}];
                    XLSX.utils.book_append_sheet(wb, ws, "Transactions");
                    XLSX.writeFile(wb, `FleetCard_${c.card.slice(-6)}_${monthLabel.replace(/\s/g, "_")}.xlsx`);
                    showToast(`Exported card ...${c.card.slice(-6)}`);
                  }} title="Download this card" style={{
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
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700, color: "#0f172a" }}>{rego}</span>
                <span style={{ color: "#7c3aed", fontWeight: 500 }}>{data.d}</span>
                <span style={{ color: "#64748b" }}>{data.t}</span>
                {data.n && data.n !== data.t && <span style={{ color: "#94a3b8" }}>{data.n}</span>}
                {data.dr && <span style={{ color: "#94a3b8", fontStyle: "italic" }}>{data.dr}</span>}
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
    ? [["submit", "+ Entry"], ["dashboard", "Dashboard"], ["data", "Data"], ["cards", "Cards"], ["settings", "\u2699"]]
    : [["submit", "+ Entry"]];

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
          {navItems.map(([v, label]) => (
            <button key={v} onClick={() => { setView(v); if (v === "submit") resetForm(); }} style={{
              padding: "8px 12px", borderRadius: 7, fontSize: 12, cursor: "pointer",
              fontFamily: "inherit", fontWeight: view === v ? 700 : 500,
              background: view === v ? "#16a34a" : "transparent",
              color: view === v ? "white" : "#64748b",
              border: `1px solid ${view === v ? "#16a34a" : "#e2e8f0"}`,
              transition: "all 0.15s", whiteSpace: "nowrap", minHeight: 38, flexShrink: 0,
            }}>{label}</button>
          ))}
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

      <div style={{ maxWidth: (view === "data" || view === "dashboard" || view === "cards") ? 960 : 520, margin: "0 auto", padding: "24px 16px", transition: "max-width 0.3s" }}>
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
        {view === "cards" && renderCards()}
        {view === "settings" && renderSettings()}
      </div>
      {serviceModal && (
        <ServiceModal rego={serviceModal} current={serviceData[serviceModal]}
          onSave={handleServiceSave} onClose={() => setServiceModal(null)} />
      )}
      {editingEntry && (
        <EditEntryModal
          entry={editingEntry}
          onSave={(updated) => { updateEntry(updated); setEditingEntry(null); }}
          onDelete={(id) => { deleteEntry(id); setEditingEntry(null); }}
          onClose={() => setEditingEntry(null)}
        />
      )}
      {renderFlagsModal()}
      {renderAiFlagsModal()}
      {editingVehicle && (() => {
        const veEntries = entries.filter(e => e.registration === editingVehicle);
        const latest = veEntries[veEntries.length - 1];
        return (
          <EditVehicleModal
            rego={editingVehicle}
            currentDivision={latest?.division || ""}
            currentType={latest?.vehicleType || ""}
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
            const newEntries = insertChronological(entries, entry);
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
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}
