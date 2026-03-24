import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import * as XLSX from "xlsx";

// ─── Config ────────────────────────────────────────────────────────────────
const DIVISIONS = {
  Tree: {
    label: "Tree",
    color: { bg: "#f0fdf4", text: "#15803d", border: "#86efac", accent: "#16a34a" },
    types: ["Ute", "Truck", "Excavator", "EWP", "Chipper", "Trailer", "Other"],
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
  Trailer: { bg: "#ffedd5", text: "#c2410c", border: "#fdba74" },
  "Hired Vehicle": { bg: "#f5f3ff", text: "#6d28d9", border: "#c4b5fd" },
  Mower: { bg: "#ecfdf5", text: "#047857", border: "#6ee7b7" },
  "Landscape Tractor": { bg: "#fefce8", text: "#854d0e", border: "#fde047" },
  Other: { bg: "#f1f5f9", text: "#475569", border: "#cbd5e1" },
};

const SERVICE_INTERVAL_KM = 10000;
const SERVICE_WARNING_KM = 2000; // Warn at 8000km (10000 - 2000)
const COST_VARIANCE_THRESHOLD = 2; // Flag cost discrepancies above $2
const ANOMALY_MULTIPLIER = 1.5; // Flag fuel usage 50%+ above vehicle average
const TREND_CHANGE_PCT = 15; // % change threshold to flag worsening/improving trend

// Typical fuel efficiency ranges (L/km) for flagging
const EFFICIENCY_RANGES = {
  Ute: { low: 0.06, high: 0.18 },
  Truck: { low: 0.10, high: 0.45 },
  Excavator: { low: 0.05, high: 0.50 },
  EWP: { low: 0.05, high: 0.30 },
  Chipper: { low: 0.04, high: 0.30 },
  Trailer: { low: 0.06, high: 0.20 },
  "Hired Vehicle": { low: 0.04, high: 0.30 },
  Mower: { low: 0.02, high: 0.15 },
  "Landscape Tractor": { low: 0.05, high: 0.35 },
  Other: { low: 0.04, high: 0.40 },
};

// Helper to get division for a vehicle type.
// When divisionHint is provided and valid for the type, prefer it (handles shared types like Ute, Truck, Trailer).
function getDivision(vehicleType, divisionHint) {
  if (divisionHint && DIVISIONS[divisionHint]?.types.includes(vehicleType)) {
    return divisionHint;
  }
  for (const [div, cfg] of Object.entries(DIVISIONS)) {
    if (cfg.types.includes(vehicleType)) return div;
  }
  return "Tree";
}

// Safe number parser that preserves zero values (parseFloat("0") || null would incorrectly return null)
function safeParseNum(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = parseFloat(value);
  return isNaN(n) ? null : n;
}

// ─── Utilities ─────────────────────────────────────────────────────────────
// ─── Rego Master Database (from master list spreadsheet) ───────────────────
const REGO_DB = [{"r":"38359D","t":"Other","d":"Tree","n":"AVANT TELESCOPIC LOADER","m":"AVANT 750"},{"r":"00440E","t":"Excavator","d":"Tree","n":"EXCAVATOR  8T","m":"KUBOTA KX080"},{"r":"25393E","t":"Excavator","d":"Tree","n":"EXCAVATOR","m":"KOBELCO SK55SRX-6"},{"r":"40971E","t":"Other","d":"Tree","n":"AVANT TELESCOPIC LOADER","m":"AVANT 750"},{"r":"TA55AA","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 12in","m":"BANDIT BAN990"},{"r":"TP97AL","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 15in","m":"BANDIT 159006A"},{"r":"TD34ZR","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 15in","m":"BANDIT 159006A"},{"r":"TP99AL","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 15in","m":"BANDIT 159006A"},{"r":"TL40RW","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 15in","m":"BANDIT 159006A"},{"r":"50197D","t":"Excavator","d":"Tree","n":"EXCAVATOR 20T","m":"CASE CX210C"},{"r":"TA80QZ","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 18in","m":"BANDIT 189007A"},{"r":"53667E","t":"Excavator","d":"Tree","n":"EXCAVATOR  5.5T","m":"KOBELCO SK55S7A"},{"r":"TC70VA","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 18in","m":"BANDIT 159006A"},{"r":"61609E","t":"Excavator","d":"Tree","n":"EXCAVATOR  8T","m":"KUBOTA KX080"},{"r":"TL48UF","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 18in","m":"BANDIT 18XP"},{"r":"TL56PO","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 18in","m":"VERMEER BC1800"},{"r":"TM84AT","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 18in","m":"VERMEER BC1800"},{"r":"YN05HA","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 22in","m":"BANDIT MTETAND"},{"r":"YN29AW","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 22in","m":"BANDIT MTETAND"},{"r":"YN71AN","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 22in","m":"BANDIT MTETAND"},{"r":"BJ57HC","t":"Ute","d":"Tree","n":"TOYOTA HILUX","m":"TOYOTA HILUX4","dr":"JUSTIN LEWIS","c":"7034305116558659","f":"Premium unleaded"},{"r":"BY38KR","t":"Ute","d":"Tree","n":"Toyota Landcruiser","m":"Toyota Landcruiser","dr":"BRENDAN RICHARSON","c":"7034305110165261","f":"Diesel"},{"r":"26228E","t":"Mower","d":"Landscape","n":"HUSTLER RIDE ON MOWER","m":"HUSTLER SUPERZ 60inch"},{"r":"BW63RR","t":"Hired Vehicle","d":"Landscape","n":"TRAFFIC CONTROL UTE - VMS","m":"TOYOTA HILUX"},{"r":"31182E","t":"Mower","d":"Landscape","n":"KUBOTA RIDE ON MOWER","m":"KUBOTA ZD1221 60inch"},{"r":"CA10BL","t":"Ute","d":"Tree","n":"MITSUBISHI TRITON","m":"MITSUBISHI TRITON","dr":"LUKE BARTLEY","c":"7034305106436460","f":"Diesel"},{"r":"36989E","t":"Mower","d":"Landscape","n":"KUBOTA RIDE ON MOWER","m":"KUBOTA ZD1221 60inch"},{"r":"36990E","t":"Landscape Tractor","d":"Landscape","n":"KUBOTA TRACTOR","m":"KUBOTA M9540D"},{"r":"BR22ZZ","t":"Truck","d":"Tree","n":"TRUCK-HINO 500","m":"HINO FG8J","dr":"NICK JONES","c":"7034305115783134","f":"Fuel"},{"r":"BT08QM","t":"Truck","d":"Tree","n":"TRUCK - HINO TIPPER","m":"HINO FG8J","dr":"JASON HUGHES","c":"7034305105574238","f":"Diesel"},{"r":"53369E","t":"Mower","d":"Landscape","n":"KUBOTA RIDE ON MOWER","m":"KUBOTA ZD1221 60inch"},{"r":"59040D","t":"Mower","d":"Landscape","n":"KUBOTA RIDE ON MOWER","m":"KUBOTA ZD1221 60inch"},{"r":"62925E","t":"Mower","d":"Landscape","n":"KUBOTA RIDE ON MOWER","m":"KUBOTA ZD1221R 60inch"},{"r":"CC24TI","t":"Ute","d":"Tree","n":"Toyota Hilux 4x4","m":"Toyota HILUX 4","dr":"BILLY PRICE","c":"7034305113893588","f":"Premium Diesel"},{"r":"CC94JL","t":"Ute","d":"Tree","n":"ISUZU D-MAX","m":"ISUZU D-MA08A","dr":"GAB FITZGERALD","c":"7034305111758833","f":"Diesel"},{"r":"CD36PH","t":"Ute","d":"Tree","n":"TOYOTA HILUX","m":"TOYOTA HILUX4","dr":"JOE HUTTON","c":"7034305106228180","f":"Fuel"},{"r":"CH90KL","t":"Ute","d":"Tree","n":"TOYOTA HILUX","m":"TOYOTA HILUX4","dr":"RACHAEL KEATING","c":"7034305106786955","f":"Unleaded"},{"r":"CJ55FB","t":"Ute","d":"Tree","n":"TOYOTA HILUX","m":"TOYOTA HILUX4","dr":"KEV CARRILLO","c":"7034305108260140","f":"Unleaded"},{"r":"CP60AF","t":"Ute","d":"Tree","n":"ISUZU D-MAX","m":"ISUZU D-MA12","dr":"SHAUN COLE","c":"7034305113746059","f":"Diesel"},{"r":"CV14NO","t":"Ute","d":"Tree","n":"Toyota Hilux","m":"Toyota HILUX 4","dr":"SAXON","c":"7034305106890443","f":"Diesel"},{"r":"CN47HS","t":"Truck","d":"Tree","n":"ISUZU D Max","m":"ISUZU NQR","dr":"CHRIS PLAYER - (STUMP TRUCK - OLD TRENT SHEATH)","c":"7034305117020659","f":"Diesel"},{"r":"66695E","t":"Mower","d":"Landscape","n":"KUBOTA RIDE ON MOWER","m":"KUBOTA ZD1221R 60inch"},{"r":"CP06YZ","t":"Truck","d":"Tree","n":"TRUCK - UD","m":"UD PKC8E","dr":"DENNIS KOCJANCIC","c":"7034305116296961","f":"Diesel"},{"r":"CS63LP","t":"Truck","d":"Tree","n":"MITSUBISHI CANTER (Blower)","m":"MITSUBISHI CANT08","dr":"BLOWER TRUCK","c":"7034305112809668","f":"Diesel"},{"r":"CE52JK","t":"Truck","d":"Tree","n":"TRAFFIC CONTROL - TMA","m":"ISUZU FTR900M"},{"r":"CZ86TX","t":"Ute","d":"Tree","n":"TRAFFIC CONTROL UTE","m":"ISUZU D-MA20"},{"r":"CZ33TZ","t":"Ute","d":"Tree","n":"TRAFFIC CONTROL UTE - VMS","m":"ISUZU D-MAX"},{"r":"DA32FL","t":"Ute","d":"Tree","n":"TRAFFIC CONTROL UTE - VMS","m":"ISUZU D-MAX"},{"r":"DA37FL","t":"Ute","d":"Tree","n":"TRAFFIC CONTROL UTE - VMS","m":"ISUZU D-MAX"},{"r":"CP11JO","t":"Truck","d":"Tree","n":"TRUCK - HINO","m":"HINO FGIJ","dr":"SPARE","c":"7034305106957424","f":"Diesel"},{"r":"DF25LB","t":"Truck","d":"Tree","n":"ISUZU Crew Cab","m":"ISUZU NNR","dr":"KYLE OSBORNE","c":"7034305111704035","f":"Diesel"},{"r":"DFW77E","t":"Ute","d":"Tree","n":"TRAFFIC CONTROL UTE - VMS","m":"ISUZU D-MAX"},{"r":"DF26LB","t":"Truck","d":"Tree","n":"ISUZU Crew Cab","m":"ISUZU NNR","dr":"JACOB DEVINGNE?","c":"7034305110028204","f":"Diesel"},{"r":"DI32GU","t":"Ute","d":"Tree","n":"TRAFFIC CONTROL UTE","m":"TOYOTA HILUX 4","c":"7034305110681705","f":"Premium unleaded"},{"r":"DM84ZB","t":"Truck","d":"Tree","n":"ISUZU Crew Cab","m":"ISUZU NHNN07"},{"r":"DL45RF","t":"Ute","d":"Tree","n":"TRAFFIC CONTROL UTE - VMS","m":"ISUZU D-MAX"},{"r":"DP60DA","t":"Truck","d":"Tree","n":"ISUZU TRUCK","m":"ISUZU NHNN07","dr":"JACOB DEVEIGNE","c":"7034 3051****3408","f":"Diesel"},{"r":"XO05MA","t":"Truck","d":"Tree","n":"Nissan UD Float","m":"UD PKC397A","dr":"ALEX GLYNN","c":"7034305116398783","f":"Diesel"},{"r":"XO05RX","t":"Truck","d":"Tree","n":"Hino 300 Series","m":"Hino 30007B","dr":"Mathew Brock","c":"7034 3051 0867 8176"},{"r":"DB78SC","t":"Ute","d":"Tree","n":"ISUZU D-MAX SX CAB CHASSIS","m":"ISUZU D-MA12","dr":"JAYDEN STRONG","c":"7034305112823891","f":"Diesel"},{"r":"DI05QD","t":"Ute","d":"Tree","n":"TOYOTA Hilux","m":"TOYOTA HILUX 4","dr":"ALEX GLYNN","c":"7034305112341555","f":"Premium unleaded"},{"r":"BX27ZL","t":"Ute","d":"Tree","n":"TOYOTA Hilux","m":"TOYOTA HILUX 4"},{"r":"DP90CQ","t":"Ute","d":"Tree","n":"FORD RANGER","m":"FORD RANGER","dr":"TIM PRICE","c":"7034305114660168","f":"Diesel"},{"r":"BY49ZT","t":"Ute","d":"Tree","n":"FORD RANGER","m":"FORD RANGER"},{"r":"XN59QZ","t":"EWP","d":"Tree","n":"MITSUBISHI / VERSA LIFT TOWER","m":"MITSUBISHI FUSO","dr":"NATHAN MORALES","c":"7034305110311667","f":"Diesel"},{"r":"XN56BU","t":"Truck","d":"Tree","n":"ISUZU BOGIE -TIPPER","m":"ISUZU FVZ193A","dr":"OLD BOGIE","c":"7034305111430383","f":"Diesel"},{"r":"XN70FQ","t":"Truck","d":"Tree","n":"TRUCK - MITSU TIPPER","m":"MITSUBISHI FN62FK","dr":"SPARE","c":"7034305108388719","f":"Diesel"},{"r":"XN95CF","t":"Truck","d":"Tree","n":"TRUCK - UD","m":"UD GWB","dr":"SCOTT WOOD","c":"7034305110006994","f":"Diesel"},{"r":"DPL85C","t":"Ute","d":"Tree","n":"MITSUBISHI TRITON","m":"MITSUBISHI TRITON","dr":"BRETT SONTER","c":"7034305108863984","f":"Diesel"},{"r":"DSU65Y","t":"Ute","d":"Tree","n":"MITSUBISHI TRITON","m":"MITSUBISHI TRITON","dr":"JASON HUGHES","c":"7034305112129919","f":"Unleaded"},{"r":"DXS19T","t":"Ute","d":"Tree","n":"Toyota Hilux","m":"TOYOTA HILUX 4"},{"r":"EAE28V","t":"Other","d":"Tree","n":"PORSCHE MACAN","m":"PORSCHE MACA14","dr":"SONYA","c":"7034305114570151","f":"Premium unleaded"},{"r":"EYI04H","t":"Ute","d":"Tree","n":"TRAFFIC CONTROL UTE - VMS","m":"ISUZU D-MAX"},{"r":"EYI04J","t":"Ute","d":"Tree","n":"TRAFFIC CONTROL UTE - VMS","m":"ISUZU D-MAX"},{"r":"DI08XE","t":"Truck","d":"Tree","n":"TRAFFIC CONTROL - TMA","m":"MITSUA TF"},{"r":"ECE83U","t":"Ute","d":"Tree","n":"UTE","m":"Volkswagon Amarok","dr":"AMELIA PLUMMER","c":"7034305115642942","f":"Diesel"},{"r":"6117231263","t":"Other","d":"Tree","n":"STUMP GRINDER - HUMPER - ORANGE","m":"RHYSCORP SH25hp"},{"r":"1800D","t":"Other","d":"Tree","n":"STUMP GRINDER - RED ROO","m":"RED ROO 5014TRX"},{"r":"66HP","t":"Other","d":"Tree","n":"STUMP GRINDER - RED ROO 7015TRX","m":""},{"r":"PT#44","t":"Other","d":"Tree","n":"STUMP GRINDER - RED ROO 7015TRX","m":"RED ROO 7015TRX"},{"r":"CM77KG","t":"EWP","d":"Tree","n":"TOWER-ISUZU - EWP","m":"ISUZU FVZ193A","dr":"BILLY PRICE (21M)","c":"7034305116027192","f":"Diesel"},{"r":"EES53B","t":"Ute","d":"Tree","n":"ISUZU D-MAX","m":"ISUZU D-MA08A","dr":"LEE DAVIS","c":"7034305107318832","f":"Diesel"},{"r":"EOL97X","t":"Ute","d":"Tree","n":"FORD RANGER","m":"FORD RANGER","dr":"JOHN LARGEY","c":"7034305111069538","f":"Diesel"},{"r":"EQE85L","t":"Ute","d":"Tree","n":"FORD RANGER","m":"FORD RANGER","dr":"MARTIN HOWARD","c":"7034305113441354","f":"Diesel"},{"r":"EQP77D","t":"Ute","d":"Tree","n":"TOYOTA HILUX","m":"TOYOTA HILUX 4","dr":"BJ","c":"7034305110325493","f":"Unleaded"},{"r":"EQP77E","t":"Ute","d":"Tree","n":"TOYOTA HILUX","m":"TOYOTA HILUX 4","dr":"JOE HURST","c":"7034305112846991","f":"Unleaded"},{"r":"ERQ21S","t":"Ute","d":"Tree","n":"FORD RANGER","m":"FORD RANGER","dr":"RHYS DWYER","c":"7034305109386829","f":"Diesel"},{"r":"EVA47B","t":"Ute","d":"Tree","n":"MITSUBISHI TRITON","m":"FORD RANGER","dr":"ANT YOUNGMAN","c":"7034305105562266","f":"Diesel"},{"r":"EYN61Z","t":"Other","d":"Tree","n":"Mazda CX5","m":"Mazda CX5","dr":"DECLAN KANE","c":"7034305107192484","f":"Unleaded"},{"r":"EYP02J","t":"Ute","d":"Tree","n":"LDV T60","m":"LDV SK8C17","dr":"CASS CHAPPLE","c":"7034305107286914","f":"Diesel"},{"r":"EYP02K","t":"Ute","d":"Tree","n":"LDV T60","m":"LDV SK8C17"},{"r":"FGP29X","t":"Ute","d":"Tree","n":"ISUZU D Max","m":"ISUZU D-MAX","dr":"DANE PLUMMER","c":"7034305116249275","f":"Diesel"},{"r":"FHX25L","t":"Ute","d":"Tree","n":"Toyota Landcruiser","m":"TOYOTA LANDCRUISER","dr":"TONY PLUMMER","c":"7034305111220834","f":"Diesel"},{"r":"FMT17H","t":"Ute","d":"Tree","n":"ISUZU D Max","m":"ISUZU D-MAX","dr":"JOE DALEY","c":"7034305116246156","f":"Diesel"},{"r":"TA39WQ","t":"Trailer","d":"Tree","n":"TRAILER","m":"QUALTY 8X501A"},{"r":"TB17YY","t":"Trailer","d":"Tree","n":"TRAILER","m":"MARIOT 12XT"},{"r":"YN04HA","t":"Trailer","d":"Tree","n":"TRAILER","m":"JPTRLR TRIAXLE"},{"r":"TE46QM","t":"Trailer","d":"Tree","n":"TRAILER","m":"JPTRLR TRIAXLE"},{"r":"XO08FN","t":"Truck","d":"Tree","n":"TRUCK - UD","m":"UD PK","dr":"MATT ROGERS","c":"7034305111375786","f":"Diesel"},{"r":"TG26UA","t":"Trailer","d":"Tree","n":"TRAILER","m":"ATA 9X6"},{"r":"XO20NL","t":"Truck","d":"Tree","n":"TRUCK - UD","m":"UDTRUC PKC","dr":"MAROS MENCAK","c":"7034305111698906","f":"Diesel"},{"r":"TE74NJ","t":"Trailer","d":"Tree","n":"TRAILER - (Mower)","m":"DEAN 190S06A"},{"r":"TF46NU","t":"Trailer","d":"Tree","n":"TRAILER - (Mower)","m":"SWTTLR SWT"},{"r":"TG29WL","t":"Trailer","d":"Tree","n":"TRAILER - (Mower)","m":"BETTER BT"},{"r":"U64347","t":"Trailer","d":"Tree","n":"JPTRLR TANDEM Trailer","m":"JPRLR TANDEM"},{"r":"TG30WL","t":"Trailer","d":"Tree","n":"TRAILER - (Mower)","m":"BETTER BT"},{"r":"TG31WL","t":"Trailer","d":"Tree","n":"TRAILER - (Mower)","m":"BETTER BT"},{"r":"TL30YS","t":"Trailer","d":"Tree","n":"TRAILER - (Blower)","m":"BALANCE BT53FWT"},{"r":"TL30ZN","t":"Trailer","d":"Tree","n":"TRAILER - (Traffic Control)","m":"MARIO 10X5"},{"r":"TL49PN","t":"Trailer","d":"Tree","n":"Trailer (Avant)","m":"BRIANJ 888"},{"r":"TL69XK","t":"Trailer","d":"Tree","n":"TRAILER - (Mower)","m":"DEAN 109S06A"},{"r":"TF52XQ","t":"Trailer","d":"Tree","n":"TRAILER - (Mower)","m":"DEAN 109S06A"},{"r":"TP56GL","t":"Trailer","d":"Tree","n":"TRAILER Maxim - (Mower)","m":"MAXIM STB"},{"r":"OLD TC80RW","t":"Trailer","d":"Tree","n":"TRAILER Maxim - (Mower)","m":"MAXIM STB"},{"r":"TG05QH","t":"Trailer","d":"Tree","n":"TRAILER - (Vermeer)","m":"SURWEL SW2400"},{"r":"XN14ZF","t":"Truck","d":"Tree","n":"TRAFFIC CONTROL - TMA","m":"ISUZU FTR900M"},{"r":"YN78AN","t":"Trailer","d":"Tree","n":"TRAILER FLOAT","m":"TAG TANDEM"},{"r":"XN61YG","t":"Truck","d":"Tree","n":"TRAFFIC CONTROL - TMA","m":"UD PKC8E"},{"r":"XO49LN","t":"Truck","d":"Tree","n":"TRUCK - UD","m":"UD GWB","dr":"TIM PRICE","c":"7034305113655797","f":"Diesel"},{"r":"XP05BN","t":"Truck","d":"Tree","n":"Isuzu Tipper","m":"Isuzu FSR140"},{"r":"XO26SK","t":"Truck","d":"Tree","n":"TRAFFIC CONTROL - TMA","m":"IVECO EUROCARGO"},{"r":"XN07XY","t":"Truck","d":"Tree","n":"IVECO - HAULAGE TRUCK","m":"IVECO STRA05A","dr":"BRETT SONTER/LEE DAVIS","f":"Diesel"},{"r":"XO37SC","t":"Truck","d":"Tree","n":"TRAFFIC CONTROL - TMA","m":"MITSUA TA FIGH"},{"r":"XO39LU","t":"Truck","d":"Tree","n":"TRAFFIC CONTROL - TMA","m":"HINO GH500 1828"},{"r":"XO68TY","t":"Truck","d":"Tree","n":"TRAFFIC CONTROL - TMA","m":"IVECO DAIL07"},{"r":"XP31AG","t":"Truck","d":"Tree","n":"Mitsubishi Tipper","m":"MITSUBISHI FM6503A","dr":"DOUG GRANT","c":"7034305116197722","f":"Diesel"},{"r":"XP36GC","t":"Truck","d":"Tree","n":"Truck Hino PT#62","m":"HINO 30007A","dr":"SPARE (SOON TO BE BRENDON DEACON?)","c":"7034305113207938","f":"Diesel"},{"r":"XP80KS","t":"Truck","d":"Tree","n":"TRUCK - HINO TIPPER","m":"HINO FG1J01A","dr":"SPARE","c":"7034305117533503","f":"Diesel"},{"r":"XO71ZL","t":"Truck","d":"Tree","n":"TRAFFIC CONTROL - TMA","m":"MITSUA TA FIGH"},{"r":"XN25DA","t":"Truck","d":"Tree","n":"TRAFFIC CONTROL - TMA","m":""},{"r":"XO82XV","t":"Truck","d":"Tree","n":"TRAFFIC CONTROL - TMA","m":"MITSUA TA FIGH"},{"r":"XO96XP","t":"Truck","d":"Tree","n":"TRAFFIC CONTROL - TMA","m":"MITSUA TF","dr":"SHAUN DENNISON","c":"7034305110811948","f":"Diesel"},{"r":"XP57ES","t":"Truck","d":"Tree","n":"TRAFFIC CONTROL - TMA","m":"MITSUA TA FIGH"},{"r":"XP86LM","t":"Truck","d":"Tree","n":"TRUCK - ISUZU","m":"ISUZU FVRL96A","dr":"JASON SORBARA","c":"7034305108940667","f":"Diesel"},{"r":"YN22AO","t":"Trailer","d":"Tree","n":"PLANT TRAILER","m":"FWR Single Axle Tag Trailer"},{"r":"CX22BE","t":"Truck","d":"Landscape","n":"MITSUBISHI CANTER","m":"MITSUBISHI CANT08","dr":"LAURA HARDWOOD","c":"7034305114887118","f":"Diesel"},{"r":"XO35UP","t":"Truck","d":"Tree","n":"MERCEDES TIPPER J&R HIRE","m":"MERCEDES BENZ 2643","dr":"CAM WILLIAMS","c":"MISC3","f":"Diesel"},{"r":"BZ04EH","t":"Truck","d":"Landscape","n":"FUSO CANTER","m":"MITSUBISHI CANT08","dr":"GRAFFITI TRUCK","c":"7034305113417867","f":"Diesel"},{"r":"Z41694","t":"Trailer","d":"Tree","n":"TRAILER ARROW BOARD","m":"DATA DATASIG"},{"r":"Z80212","t":"Trailer","d":"Tree","n":"TRAILER ARROW BOARD","m":"Data Signs DATASIG"},{"r":"CI98BZ","t":"Truck","d":"Landscape","n":"Isuzu Truck","m":"ISUZU NPR300","dr":"KYLE OSBORNE","c":"7034305109332146","f":"Diesel"},{"r":"CL52NS","t":"Truck","d":"Landscape","n":"HINO Truck - 300 SERIES","m":"HINO 300S11","dr":"DAN THOMPSON","c":"7034305107310136","f":"Diesel"},{"r":"CT74KE","t":"Truck","d":"Tree","n":"ISUZU Truck","m":"ISUZU NHNL07","dr":"SHANE DEMIRAL","c":"7034305112151236","f":"Diesel"},{"r":"CX23BE","t":"Truck","d":"Landscape","n":"FUSO CANTER","m":"MITSUBISHI CANTER","dr":"MICK THOMAS","c":"7034305106791179","f":"Diesel"},{"r":"YMN14E","t":"Ute","d":"Tree","n":"ISUZU D Max","m":"ISUZU D-MA21","dr":"ROGER BORG","c":"7034305106723230","f":"Diesel"},{"r":"PT#30","t":"Other","d":"Tree","n":"VERMEER LOADER","m":"VERMEER CTX100"},{"r":"CX45MJ","t":"Truck","d":"Landscape","n":"ISUZU WATER CART","m":"ISUZU NLR200","dr":"NAISH","c":"7034305107330928","f":"Diesel"},{"r":"TC80LA","t":"Chipper","d":"Tree","n":"CHIPPER DRUM 15in","m":"BANDIT 159006A"},{"r":"AP85DF","t":"Other","d":"Tree","n":"Mitsubishi Canter Auto","m":"","dr":"KYLE OSBORNE","c":"7034305113700650","f":"Diesel"},{"r":"AT13VE","t":"Truck","d":"Tree","n":"Isuzu Tipper","m":"","dr":"JASON SORBARA","c":"7034305108940667","f":"Diesel"},{"r":"BF51KJ","t":"Other","d":"Tree","n":"NLR Series","m":"","dr":"NAISH","c":"7034305107330928","f":"Diesel"},{"r":"BST66Q","t":"Ute","d":"Tree","n":"Toyota Hilux SR","m":"","dr":"YARD SPARE","c":"7034305116359132","f":"Unleaded"},{"r":"CH95ZD","t":"Other","d":"Tree","n":"Mitsubishi Canter","m":"","dr":"DANIEL THOMSON","c":"7034305108274448","f":"Diesel"},{"r":"CIC51E","t":"Other","d":"Tree","n":"Ford Ranger","m":"","c":"7034305114657123","f":"Unleaded"},{"r":"CM80RV","t":"Truck","d":"Tree","n":"Hino FD8J Truck","m":"","c":"7034305114621285","f":"Diesel"},{"r":"EBL30C","t":"Other","d":"Tree","n":"FORD FALCON","m":"","dr":"SAM LAW","c":"7034305113442394","f":"Unleaded"},{"r":"EYO62W","t":"Other","d":"Tree","n":"MERC BENZ 300CE","m":"","dr":"JOE PELLIZZON","c":"7034305117257665","f":"Unleaded"},{"r":"EYO02K","t":"Ute","d":"Tree","n":"LDV T60 UTE LDV","m":"","dr":"DAYNE COOMBE","c":"7034305107009274","f":"Diesel"},{"r":"FWN82W","t":"Other","d":"Tree","n":"","m":"","dr":"JOEL SONTER"},{"r":"JCJ010","t":"Other","d":"Tree","n":"RAM RAM 1500","m":"","dr":"JASON JOHNSON","c":"7034305113817595","f":"Unleaded"},{"r":"MISC3","t":"Other","d":"Tree","n":"ANY ANY","m":"","dr":"CAM WILLIAMS","c":"7034305105984726","f":"Diesel"},{"r":"WIA53F","t":"Other","d":"Tree","n":"Nissan Navara Nissan Navara","m":"","dr":"CARLOS CARRILLO","c":"7034305115254565","f":"Diesel"},{"r":"WNU522","t":"EWP","d":"Tree","n":"HINO 500","m":"","dr":"WADE HANNELL","c":"7034305116506179","f":"Diesel"},{"r":"XO86LP","t":"EWP","d":"Tree","n":"ISUZU NPR200","m":"","c":"7034305114342411","f":"Diesel"},{"r":"XP058N","t":"Truck","d":"Tree","n":"ISUZU FSR 140","m":"","dr":"STEVE NEWTON","c":"7034305111299762","f":"Diesel"},{"r":"XP41MC","t":"EWP","d":"Tree","n":"HINO-500","m":"","dr":"JASON HUGHES","c":"7034305116247253","f":"Diesel"},{"r":"XP21GC","t":"EWP","d":"Tree","n":"","m":"","dr":"DAN VANDERMEEL","c":"XP21GC"},{"r":"XP60OO","t":"EWP","d":"Tree","n":"","m":"","dr":"SAM THOMAS","c":"XP60OO"}];

function lookupRego(rego, learnedDB, allEntries) {
  if (!rego || rego.length < 2) return null;
  const u = rego.trim().toUpperCase().replace(/\s+/g, "");

  // 1. Check learned data first (from real driver submissions — most up to date)
  if (learnedDB) {
    const learned = learnedDB[u];
    if (learned && learned.t && learned.d) return { ...learned, r: u, _src: "learned" };
  }

  // 2. Check entry history — the MOST RECENT entry for this rego is the best source
  if (allEntries && allEntries.length > 0) {
    const regoEntries = allEntries.filter(e => e.registration === u);
    if (regoEntries.length > 0) {
      const latest = regoEntries[regoEntries.length - 1];
      if (latest.division && latest.vehicleType) {
        return {
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
  const exact = REGO_DB.find(v => v.r.toUpperCase().replace(/\s+/g, "") === u);
  if (exact) return { ...exact, _src: "db" };
  // Only partial match if no exact match found anywhere
  if (u.length >= 4) {
    const partial = REGO_DB.find(v => v.r.toUpperCase().replace(/\s+/g, "").startsWith(u) || u.startsWith(v.r.toUpperCase().replace(/\s+/g, "")));
    if (partial) return { ...partial, _src: "db" };
  }
  return null;
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
  if (/^TRL/.test(u)) return "Trailer";
  if (/^(MOW|MWR)/.test(u)) return "Mower";
  if (/^(HIRE|HRD)/.test(u)) return "Hired Vehicle";
  if (/^(TRAC|LTR)/.test(u)) return "Landscape Tractor";
  return "";
}

// Compress image to stay under API 5MB limit (targets ~3.5MB max)
const MAX_B64_BYTES = 3_500_000;
const MAX_DIMENSION = 2048;

async function compressImage(file) {
  // Read file as data URL first (works reliably in all environments)
  const originalDataUrl = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error("Failed to read image file"));
    r.readAsDataURL(file);
  });

  // If already small enough, return as-is
  const originalB64 = originalDataUrl.split(",")[1];
  if (originalB64.length * 0.75 < MAX_B64_BYTES) {
    return { b64: originalB64, mime: file.type || "image/jpeg" };
  }

  // Load into an Image element for resizing
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

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, width, height);

  // Try progressively lower quality until under limit
  let quality = 0.8;
  let dataUrl;
  for (let attempt = 0; attempt < 5; attempt++) {
    dataUrl = canvas.toDataURL("image/jpeg", quality);
    const sizeBytes = Math.ceil((dataUrl.length - 23) * 0.75);
    if (sizeBytes < MAX_B64_BYTES) break;
    quality -= 0.15;
    if (attempt >= 2) {
      width = Math.round(width * 0.75);
      height = Math.round(height * 0.75);
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
    }
  }

  const b64 = dataUrl.split(",")[1];
  return { b64, mime: "image/jpeg" };
}

// ─── Receipt scan prompt (multi-line aware) ─────────────────────────────
const RECEIPT_SCAN_PROMPT = `Analyze this fuel receipt image very carefully. Look for EVERY separate fuel transaction/line item on the receipt.

CRITICAL: Receipts often contain MULTIPLE fuel lines from DIFFERENT pumps (e.g. Pump 5, Pump 8). Each pump/transaction is a SEPARATE fuel fill-up, likely for a different vehicle. You MUST detect and list each one individually. Look for:
- Multiple "Pump" numbers (Pump 5, Pump 6, Pump 8 etc.)
- Multiple litre amounts on separate lines
- Multiple sale IDs or transaction lines
- Lines like "ULT. DIESEL", "Shell Diesel", "Unleaded" appearing more than once
- Separate "EA Totals" or subtotals per line

Also look for any handwritten notes on the receipt — drivers often write registration numbers and litre allocations (e.g. "15.14L in 59040D" or "44.35L DF25LB").

Return ONLY valid JSON with no other text:
{
  "date": "DD/MM/YYYY",
  "station": "station name or null",
  "fuelType": "fuel type or null",
  "pricePerLitre": number_or_null,
  "totalCost": number_total_on_receipt_or_null,
  "litres": number_total_litres_across_all_lines,
  "lines": [
    {"litres": number, "cost": number_or_null, "pump": "pump number or null", "fuelType": "type or null"}
  ],
  "handwrittenNotes": "any handwritten text visible on receipt or null"
}

If there is only ONE fuel line, the "lines" array should have one entry. NEVER omit lines — if you see 2 pumps, return 2 entries.`;

// Normalize receipt data: ensure lines array exists and totals are consistent
function normalizeReceiptData(data) {
  if (!data) return data;
  // Ensure lines array exists
  if (!data.lines || !Array.isArray(data.lines) || data.lines.length === 0) {
    data.lines = [{ litres: data.litres || null, cost: data.totalCost || null, pump: null, fuelType: data.fuelType || null }];
  }
  // If litres total is missing, sum from lines
  if (!data.litres && data.lines.length > 0) {
    data.litres = data.lines.reduce((s, l) => s + (l.litres || 0), 0);
  }
  // If totalCost is missing, sum from lines
  if (!data.totalCost && data.lines.length > 0) {
    const lineTotal = data.lines.reduce((s, l) => s + (l.cost || 0), 0);
    if (lineTotal > 0) data.totalCost = parseFloat(lineTotal.toFixed(2));
  }
  return data;
}

async function claudeScan(apiKey, b64, mime, prompt) {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
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
  return JSON.parse(raw);
}

function parseDate(str) {
  if (!str) return 0;
  const p = str.split(/[\/\-\.]/);
  if (p.length < 3) return 0;
  if (p[0].length === 4) return new Date(`${p[0]}-${p[1]}-${p[2]}`).getTime();
  return new Date(`${p[2]}-${p[1]}-${p[0]}`).getTime();
}

// Insert a new entry in chronological order for its vehicle.
// Odometer is the source of truth for ordering — it can never go backwards.
// If a driver submits a receipt late, odometer tells us where it actually belongs.
// Date is only used as a tiebreaker when odometer readings are identical.
function insertChronological(allEntries, newEntry) {
  const rego = newEntry.registration;

  // Collect entries for this rego, add new one, sort by odometer then date
  const sameRego = allEntries.filter(e => e.registration === rego);
  sameRego.push(newEntry);
  sameRego.sort((a, b) => {
    const odoA = a.odometer || 0;
    const odoB = b.odometer || 0;
    if (odoA !== odoB) return odoA - odoB;
    return parseDate(a.date) - parseDate(b.date);
  });

  // Rebuild: keep other entries in their original positions,
  // replace each rego slot with the sorted version, append extras at the end
  const result = [];
  let regoIdx = 0;
  for (const e of allEntries) {
    if (e.registration === rego) {
      result.push(sameRego[regoIdx++]);
    } else {
      result.push(e);
    }
  }
  // Append remaining sorted entries (the newly inserted one)
  while (regoIdx < sameRego.length) {
    result.push(sameRego[regoIdx++]);
  }

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
    const svc = serviceData[rego] || {};

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
    ws["!cols"] = Array(22).fill({ wch: 16 });
    XLSX.utils.book_append_sheet(wb, ws, rego.slice(0, 31));
  });

  XLSX.writeFile(wb, `Fuel_${vehicleType}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ─── Shared UI atoms ────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Barlow+Condensed:wght@600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', sans-serif; background: #f8fafc; color: #0f172a; }
  input, select, textarea { font-family: inherit; }
  input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
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
`;

function Toast({ msg, type, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
  return (
    <div style={{
      position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
      background: type === "error" ? "#fef2f2" : "#f0fdf4",
      border: `1px solid ${type === "error" ? "#fca5a5" : "#86efac"}`,
      color: type === "error" ? "#b91c1c" : "#15803d",
      padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 500,
      boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 999, whiteSpace: "nowrap",
      animation: "fadeIn 0.2s ease",
    }}>
      {type === "error" ? "\u26A0 " : "\u2713 "}{msg}
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
      <input ref={inputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => onFile(e.target.files[0])} />
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
      border: "none", borderRadius: 8, padding: "11px 22px",
      fontSize: 14, fontWeight: 600, cursor: disabled || loading ? "not-allowed" : "pointer",
      fontFamily: "inherit", transition: "background 0.15s", width: "100%",
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
      padding: small ? "7px 14px" : "10px 18px",
      fontSize: small ? 12 : 14, fontWeight: 500, cursor: "pointer",
      fontFamily: "inherit",
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
  const steps = ["Driver & Vehicle", "Fuel Receipt", "Fleet Card", "Review"];
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", marginBottom: 28, gap: 0 }}>
      {steps.map((label, i) => {
        const n = i + 1;
        const done = step > n;
        const active = step === n;
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
                odometer: safeParseNum(f.odometer),
                litres: safeParseNum(f.litres),
                pricePerLitre: safeParseNum(f.pricePerLitre),
                totalCost: safeParseNum(f.totalCost),
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
function ServiceModal({ rego, current, onSave, onClose }) {
  const [svcDate, setSvcDate] = useState(current?.lastServiceDate || "");
  const [svcKms, setSvcKms] = useState(current?.lastServiceKms?.toString() || "");
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "white", borderRadius: 12, padding: 24, width: "100%", maxWidth: 380,
        boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
      }} className="fade-in">
        <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>Service Record</div>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 18 }}>Update service info for {rego}</div>

        <FieldInput label="Last Service Date" value={svcDate} onChange={setSvcDate} placeholder="DD/MM/YYYY" required />
        <FieldInput label="Last Service Odometer (km)" value={svcKms} onChange={setSvcKms} placeholder="e.g. 45000" type="number" required />

        <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 16, background: "#f8fafc", padding: "8px 10px", borderRadius: 6 }}>
          Next service will be calculated at <strong>{svcKms ? (parseFloat(svcKms) + SERVICE_INTERVAL_KM).toLocaleString() : "\u2014"} km</strong> (+ {SERVICE_INTERVAL_KM.toLocaleString()} km interval)
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <SecondaryBtn onClick={onClose} small>Cancel</SecondaryBtn>
          <div style={{ flex: 1 }}>
            <PrimaryBtn onClick={() => {
              if (!svcDate || !svcKms) return;
              onSave(rego, { lastServiceDate: svcDate, lastServiceKms: parseFloat(svcKms) });
            }}>Save Service Record</PrimaryBtn>
          </div>
        </div>
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

  let kmTravelled = null;
  if (prevOdo != null && odo != null) {
    kmTravelled = odo - prevOdo;
    if (kmTravelled < 0) {
      flags.push({ type: "danger", text: "Odo went backwards", detail: `${prevOdo.toLocaleString()} \u2192 ${odo.toLocaleString()}` });
    } else if (kmTravelled === 0) {
      flags.push({ type: "warn", text: "No km travelled", detail: "Odometer unchanged since last entry" });
    }
  }

  if (kmTravelled > 0 && litres > 0) {
    const lPerKm = litres / kmTravelled;
    const range = EFFICIENCY_RANGES[vehicleType] || EFFICIENCY_RANGES.Other;
    if (lPerKm > range.high) {
      flags.push({ type: "warn", text: "High fuel usage", detail: `${lPerKm.toFixed(3)} L/km \u2014 above expected for ${vehicleType}` });
    } else if (lPerKm < range.low) {
      flags.push({ type: "info", text: "Low fuel usage", detail: `${lPerKm.toFixed(3)} L/km \u2014 below expected` });
    }
  }

  if (litres > 0 && ppl > 0 && totalCost > 0) {
    const calcCost = litres * ppl;
    const diff = Math.abs(totalCost - calcCost);
    if (diff > COST_VARIANCE_THRESHOLD) {
      flags.push({ type: "warn", text: `Cost variance $${diff.toFixed(2)}`, detail: `Actual $${totalCost.toFixed(2)} vs calc $${calcCost.toFixed(2)}` });
    }
  }

  if (svcData?.lastServiceKms && odo) {
    const nextDue = svcData.lastServiceKms + SERVICE_INTERVAL_KM;
    const kmSince = odo - svcData.lastServiceKms;
    const kmRemaining = nextDue - odo;
    if (odo >= nextDue) {
      flags.push({ type: "danger", text: "SERVICE OVERDUE", detail: `${kmSince.toLocaleString()} km since service \u2014 due at ${nextDue.toLocaleString()} km` });
    } else if (kmRemaining <= SERVICE_WARNING_KM) {
      flags.push({ type: "warn", text: `Service in ${kmRemaining.toLocaleString()} km`, detail: `${kmSince.toLocaleString()} km since service \u2014 due at ${nextDue.toLocaleString()} km` });
    }
  }

  return flags;
}

// ─── Main App ────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState("submit");
  const [step, setStep] = useState(1);
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

  const [form, setForm] = useState({ driverName: "", registration: "", division: "", vehicleType: "", odometer: "" });
  const [otherMode, setOtherMode] = useState(false);
  const [otherForm, setOtherForm] = useState({ equipment: "", station: "", fleetCard: "", cardRego: "", notes: "" });

  const [receiptPreview, setReceiptPreview] = useState(null);
  const [receiptB64, setReceiptB64] = useState(null);
  const [receiptMime, setReceiptMime] = useState("image/jpeg");
  const [receiptData, setReceiptData] = useState(null);
  const [receiptScanning, setReceiptScanning] = useState(false);

  const [cardPreview, setCardPreview] = useState(null);
  const [cardB64, setCardB64] = useState(null);
  const [cardData, setCardData] = useState(null);
  const [cardScanning, setCardScanning] = useState(false);

  const [saving, setSaving] = useState(false);
  const [splitMode, setSplitMode] = useState(false);
  const [splits, setSplits] = useState([]); // [{ id, rego, odometer, litres, _match }]
  const [dataFilter, setDataFilter] = useState("All");
  const [expandedRego, setExpandedRego] = useState(null);
  const [serviceModal, setServiceModal] = useState(null);
  const [showFlags, setShowFlags] = useState(false);
  const [resolvedFlags, setResolvedFlags] = useState({}); // { "flagId": { by, note, at } }
  const [flagsFilter, setFlagsFilter] = useState("open"); // "open" | "resolved" | "all"
  const [replyingFlag, setReplyingFlag] = useState(null); // flagId currently being responded to
  const [editingEntry, setEditingEntry] = useState(null); // entry object being edited
  const [vehicleMenu, setVehicleMenu] = useState(null); // rego string for open menu
  const [editingVehicle, setEditingVehicle] = useState(null); // rego string for edit vehicle modal
  const [confirmAction, setConfirmAction] = useState(null); // { message, onConfirm } for confirm dialog

  const receiptRef = useRef();
  const cardRef = useRef();

  const showToast = useCallback((msg, type = "success") => setToast({ msg, type }), []);

  // ── Storage ───────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [eRes, kRes, sRes, lRes, rRes] = await Promise.all([
          window.storage.get("fuel_entries").catch(() => null),
          window.storage.get("fuel_api_key").catch(() => null),
          window.storage.get("fuel_service_data").catch(() => null),
          window.storage.get("fuel_learned_db").catch(() => null),
          window.storage.get("fuel_resolved_flags").catch(() => null),
        ]);
        if (eRes?.value) setEntries(JSON.parse(eRes.value));
        if (kRes?.value) { setApiKey(kRes.value); setApiKeyInput(kRes.value); }
        if (sRes?.value) setServiceData(JSON.parse(sRes.value));
        if (lRes?.value) setLearnedDB(JSON.parse(lRes.value));
        if (rRes?.value) setResolvedFlags(JSON.parse(rRes.value));
      } catch (_) {}
      setStorageReady(true);
    })();
  }, []);

  const persist = async (newEntries) => {
    entriesRef.current = newEntries;
    try { await window.storage.set("fuel_entries", JSON.stringify(newEntries)); setEntries(newEntries); }
    catch (_) { setEntries(newEntries); }
  };

  const persistService = async (newData) => {
    try { await window.storage.set("fuel_service_data", JSON.stringify(newData)); setServiceData(newData); }
    catch (_) { setServiceData(newData); }
  };

  const handleServiceSave = (rego, data) => {
    const updated = { ...serviceData, [rego]: data };
    persistService(updated);
    setServiceModal(null);
    showToast(`Service record saved for ${rego}`);
  };

  const persistLearned = async (newData) => {
    learnedDBRef.current = newData; // sync ref immediately so subsequent calls see latest
    try { await window.storage.set("fuel_learned_db", JSON.stringify(newData)); setLearnedDB(newData); }
    catch (_) { setLearnedDB(newData); }
  };

  const persistResolved = async (newData) => {
    try { await window.storage.set("fuel_resolved_flags", JSON.stringify(newData)); setResolvedFlags(newData); }
    catch (_) { setResolvedFlags(newData); }
  };

  // Generate a stable unique ID for a flag
  const flagId = (f) => `${f.rego}::${f.text}::${f.date || ""}::${f.odo || ""}`;

  const resolveFlag = (fid, note, by) => {
    const updated = { ...resolvedFlags, [fid]: { by: by || "Admin", note: note || "", at: new Date().toISOString() } };
    persistResolved(updated);
  };

  const unresolveFlag = (fid) => {
    const { [fid]: _, ...rest } = resolvedFlags;
    persistResolved(rest);
  };

  // Learn from every submission — driver corrections override the static spreadsheet DB
  const learnFromSubmission = (entry) => {
    const rego = entry.registration;
    if (!rego) return;

    // Read from ref (always current, even mid-batch)
    const currentDB = learnedDBRef.current;
    const existing = currentDB[rego] || {};

    // Build updated record — always take the latest submission's data
    const updated = {
      ...existing,
      t: entry.vehicleType || existing.t || "",
      d: entry.division || existing.d || "",
      n: entry.vehicleName || existing.n || entry.vehicleType || "",
      dr: entry.driverName || existing.dr || "",
      f: entry.fuelType || existing.f || "",
    };
    if (entry.fleetCardNumber) updated.c = entry.fleetCardNumber;

    // Build a make/model line from the static DB if we don't have one
    const staticMatch = REGO_DB.find(v => v.r.toUpperCase().replace(/\s+/g, "") === rego);
    if (staticMatch?.m && !updated.m) updated.m = staticMatch.m;
    if (staticMatch?.n && (!updated.n || updated.n === entry.vehicleType)) updated.n = staticMatch.n;

    const newLearned = { ...currentDB, [rego]: updated };
    persistLearned(newLearned);
  };

  // ── Form helpers ──────────────────────────────────────────────────────────
  const resetForm = () => {
    setStep(1);
    setForm({ driverName: "", registration: "", division: "", vehicleType: "", odometer: "" });
    setOtherMode(false);
    setOtherForm({ equipment: "", station: "", fleetCard: "", cardRego: "", notes: "" });
    setReceiptPreview(null); setReceiptB64(null); setReceiptData(null); setReceiptMime("image/jpeg");
    setCardPreview(null); setCardB64(null); setCardData(null);
    setSplitMode(false); setSplits([]);
    setError("");
  };

  const handleReceiptFile = async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setReceiptPreview(URL.createObjectURL(file));
    setReceiptData(null);
    if (!apiKey) { setError("Add an Anthropic API key in Settings first."); return; }
    setReceiptScanning(true); setError("");
    try {
      const { b64, mime } = await compressImage(file);
      setReceiptB64(b64);
      setReceiptMime(mime);
      const result = await claudeScan(apiKey, b64, mime, RECEIPT_SCAN_PROMPT);
      setReceiptData(normalizeReceiptData(result));
    } catch (e) { setError("Receipt scan failed \u2014 " + e.message); }
    setReceiptScanning(false);
  };

  const rescanReceipt = async () => {
    if (!receiptB64 || !apiKey) return;
    setReceiptScanning(true); setError("");
    try {
      const result = await claudeScan(apiKey, receiptB64, receiptMime, RECEIPT_SCAN_PROMPT);
      setReceiptData(normalizeReceiptData(result));
    } catch (e) { setError("Re-scan failed \u2014 " + e.message); }
    setReceiptScanning(false);
  };

  const handleCardFile = async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setCardPreview(URL.createObjectURL(file));
    setCardData(null);
    if (!apiKey) return;
    setCardScanning(true); setError("");
    try {
      const { b64, mime } = await compressImage(file);
      setCardB64(b64);
      const result = await claudeScan(apiKey, b64, mime,
        `Extract fleet card details from this image. Return ONLY valid JSON:\n{"cardNumber":"string_or_null","vehicleOnCard":"string_or_null"}`
      );
      setCardData(result);
    } catch (e) { setError("Card scan failed \u2014 " + e.message); }
    setCardScanning(false);
  };

  const handleSubmit = async () => {
    setSaving(true);
    const ppl = receiptData?.pricePerLitre || null;
    const date = receiptData?.date || "";
    const station = receiptData?.station || "";
    const baseFuelType = receiptData?.fuelType || "";
    const cardNum = cardData?.cardNumber || "";
    const cardVeh = cardData?.vehicleOnCard || "";
    const now = new Date().toISOString();

    // ── "Other" mode (non-vehicle fuel claims) ──
    if (otherMode) {
      const otherEntry = {
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        submittedAt: now,
        entryType: "other",
        driverName: form.driverName.trim(),
        equipment: otherForm.equipment.trim(),
        station: otherForm.station.trim() || station,
        fleetCardNumber: otherForm.fleetCard.trim() || cardNum,
        cardRego: otherForm.cardRego.trim().toUpperCase() || cardVeh,
        date,
        litres: receiptData?.litres || null,
        pricePerLitre: ppl,
        totalCost: receiptData?.totalCost || null,
        fuelType: baseFuelType,
        notes: otherForm.notes.trim(),
      };
      await persist([...entries, otherEntry]);
      setSaving(false);
      setStep(5);
      return;
    }

    // ── Normal vehicle mode ──
    const buildEntry = (rego, division, vehicleType, odometer, litres, regoMatch) => {
      const parsedLitres = safeParseNum(litres);
      const calcCost = (parsedLitres != null && ppl != null) ? parsedLitres * ppl : null;
      return {
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        submittedAt: now,
        driverName: form.driverName.trim(),
        registration: rego,
        division: division || getDivision(vehicleType),
        vehicleType,
        odometer: safeParseNum(odometer),
        date,
        litres: parsedLitres,
        pricePerLitre: ppl,
        totalCost: calcCost,
        station,
        fuelType: baseFuelType || regoMatch?.f || "",
        fleetCardNumber: cardNum || regoMatch?.c || "",
        fleetCardVehicle: cardVeh,
        fleetCardDriver: regoMatch?.dr || "",
        vehicleName: regoMatch?.n || "",
        splitReceipt: splitMode || false,
      };
    };

    // Primary vehicle entry — use manually entered litres if specified, otherwise receipt total minus splits
    const primaryMatch = form._regoMatch;
    const primaryLitres = splitMode
      ? (safeParseNum(form.litres) ?? ((receiptData?.litres || 0) - splits.reduce((s, sp) => s + (safeParseNum(sp.litres) || 0), 0)))
      : receiptData?.litres;
    const primaryEntry = buildEntry(
      form.registration.trim().toUpperCase(),
      form.division, form.vehicleType,
      form.odometer, primaryLitres, primaryMatch
    );

    let allNew = entries;
    allNew = insertChronological(allNew, primaryEntry);
    learnFromSubmission(primaryEntry);

    // Split vehicle entries
    if (splitMode) {
      for (const sp of splits) {
        if (!sp.rego) continue;
        const match = lookupRego(sp.rego, learnedDBRef.current, entriesRef.current) || sp._match;
        const splitEntry = buildEntry(
          sp.rego.trim().toUpperCase(),
          sp.division || match?.d || "",
          sp.vehicleType || match?.t || "",
          sp.odometer, sp.litres || 0, match
        );
        allNew = insertChronological(allNew, splitEntry);
        learnFromSubmission(splitEntry);
      }
    }

    await persist(allNew);
    setSaving(false);
    setStep(5);
  };

  const deleteEntry = async (id) => {
    await persist(entries.filter(e => e.id !== id));
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
    await persist(result);
    learnFromSubmission(updatedEntry);
    showToast("Entry updated");
  };

  const deleteVehicle = (rego) => {
    setConfirmAction({
      message: `Delete ALL entries for ${rego}? This cannot be undone.`,
      onConfirm: async () => {
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
    const currentDB = learnedDBRef.current;
    const existing = currentDB[rego] || {};
    const newLearned = { ...currentDB, [rego]: { ...existing, t: newVehicleType, d: newDivision } };
    await persistLearned(newLearned);
    setEditingVehicle(null);
    showToast(`${rego} updated to ${newDivision} / ${newVehicleType}`);
  };

  // ── Render steps ──────────────────────────────────────────────────────────
  const addSplit = () => setSplits(prev => [...prev, { id: Date.now().toString(), rego: "", odometer: "", litres: "", division: "", vehicleType: "", _match: null }]);
  const removeSplit = (id) => { setSplits(prev => prev.filter(s => s.id !== id)); if (splits.length <= 1) setSplitMode(false); };
  const updateSplit = (id, field, value) => {
    setSplits(prev => prev.map(s => {
      if (s.id !== id) return s;
      const updated = { ...s, [field]: value };
      if (field === "rego") {
        const match = lookupRego(value, learnedDBRef.current, entriesRef.current);
        updated._match = match || null;
        if (match) { updated.division = match.d; updated.vehicleType = match.t; }
      }
      return updated;
    }));
  };

  const EQUIPMENT_PRESETS = ["Chainsaws", "2 Stroke Fuel", "Jerry Can", "Engine Oil", "Stump Grinder", "Fuel Cell/Pod", "Leaf Blower", "AdBlue", "Hire Equipment"];

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

        <FieldInput label="Driver Name" value={form.driverName} onChange={v => setForm(f => ({ ...f, driverName: v }))} placeholder="e.g. Jason Johnston" required />

        {/* ═══ OTHER MODE ═══ */}
        {otherMode && (
          <>
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

            <FieldInput label="Fleet Card Number" value={otherForm.fleetCard} required
              onChange={v => setOtherForm(f => ({ ...f, fleetCard: v }))} placeholder="e.g. 7034 3051 1284 6991" hint="Full card number from fleet card" />

            <FieldInput label="Card Registration" value={otherForm.cardRego}
              onChange={v => setOtherForm(f => ({ ...f, cardRego: v }))} placeholder="e.g. CM80RV" hint="Rego shown on the fleet card used" />

            <FieldInput label="Notes" value={otherForm.notes}
              onChange={v => setOtherForm(f => ({ ...f, notes: v }))} placeholder="e.g. Shell 2T 200ml $19.98, for truck XN07XY" />

            {error && <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 13, color: "#b91c1c" }}>{error}</div>}
            <PrimaryBtn onClick={() => {
              if (!form.driverName) { setError("Please enter your name."); return; }
              if (!otherForm.equipment) { setError("Please enter the equipment / purpose."); return; }
              if (!otherForm.fleetCard) { setError("Please enter the fleet card number."); return; }
              setError(""); setStep(2);
            }}>Continue to Receipt {"\u2192"}</PrimaryBtn>
          </>
        )}

        {/* ═══ VEHICLE MODE ═══ */}
        {!otherMode && (
          <>
        {splitMode && <div style={{ fontSize: 12, fontWeight: 700, color: "#15803d", marginBottom: 8, marginTop: 4 }}>Vehicle 1</div>}

        <FieldInput label="Registration Number" value={form.registration} required
          onChange={v => {
            const db = learnedDBRef.current;
            const match = lookupRego(v, db, entriesRef.current);
            if (match) {
              setForm(f => ({ ...f, registration: v, vehicleType: match.t, division: match.d, _regoMatch: match }));
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
            {form._regoMatch.dr && form.driverName && form.driverName.toUpperCase() !== form._regoMatch.dr.toUpperCase() && (
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
          <FieldInput label="Odometer / Hours Reading" value={form.odometer} type="number" required
            onChange={v => setForm(f => ({ ...f, odometer: v }))} placeholder="e.g. 4340" hint="Current reading at time of fill-up" />
          {splitMode && (
            <FieldInput label="Litres for this vehicle" value={form.litres || ""} type="number"
              onChange={v => setForm(f => ({ ...f, litres: v }))} placeholder="e.g. 44.35" hint="How many litres went into this vehicle" />
          )}
        </div>

        {/* ── Additional vehicles ── */}
        {splitMode && splits.map((sp, si) => {
          const spMatch = sp._match;
          return (
            <div key={sp.id} className="fade-in" style={{
              background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10,
              padding: "12px 14px", marginBottom: 10, marginTop: si === 0 ? 6 : 0,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#1e40af" }}>Vehicle {si + 2}</span>
                <button onClick={() => removeSplit(sp.id)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>{"\u00D7"}</button>
              </div>
              <div style={{ marginBottom: 8 }}>
                <label style={{ display: "block", fontSize: 11, color: "#374151", fontWeight: 600, marginBottom: 3 }}>Registration</label>
                <input value={sp.rego} onChange={e => updateSplit(sp.id, "rego", e.target.value)} placeholder="e.g. 59040D"
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 13, outline: "none", fontFamily: "inherit", color: "#0f172a", background: "white" }}
                  onFocus={e => e.target.style.borderColor = "#22c55e"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
              </div>
              {spMatch && (
                <div style={{ fontSize: 10, color: "#15803d", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
                  {"\u2713"} {spMatch.n || spMatch.t} {"\u00B7"} {spMatch.d} / {spMatch.t}
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
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
              </div>
            </div>
          );
        })}

        {splitMode && (
          <button onClick={addSplit} style={{
            width: "100%", padding: "8px", borderRadius: 6, fontSize: 12, fontWeight: 600,
            background: "white", color: "#64748b", border: "1px dashed #cbd5e1",
            cursor: "pointer", fontFamily: "inherit", marginBottom: 10,
          }}>+ Add another vehicle</button>
        )}

        {/* + Vehicle toggle */}
        {!splitMode && (
          <button onClick={() => { setSplitMode(true); if (splits.length === 0) addSplit(); }} style={{
            width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 14,
            cursor: "pointer", fontFamily: "inherit", fontWeight: 500,
            background: "#f8fafc", color: "#64748b",
            border: "1px dashed #cbd5e1", transition: "all 0.15s",
          }}>
            {"\u2795"} Add another vehicle (split receipt)
          </button>
        )}

        {error && <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 13, color: "#b91c1c" }}>{error}</div>}
        <PrimaryBtn onClick={() => {
          if (!form.driverName || !form.registration || !form.division || !form.vehicleType || !form.odometer) { setError("Please fill in all required fields."); return; }
          if (splitMode) {
            for (const sp of splits) {
              if (!sp.rego || !sp.odometer) { setError("Please fill in rego and odometer for all vehicles."); return; }
            }
          }
          setError(""); setStep(2);
        }}>Continue {"\u2192"}</PrimaryBtn>
        </>
        )}
      </div>
    );
  };

  const renderStep2 = () => (
    <div className="fade-in">
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>Fuel Receipt</div>
        <div style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>
          Take a clear photo {"\u2014"} AI extracts date, litres, price and total automatically
          {splitMode && <><br /><span style={{ color: "#1e40af", fontWeight: 500 }}>Split receipt: litres will be allocated per vehicle from Step 1</span></>}
        </div>
      </div>
      {!apiKey && (
        <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: 10, marginBottom: 14, fontSize: 13, color: "#b45309" }}>
          No API key set. Go to Settings to add your Anthropic API key.
        </div>
      )}
      <PhotoUpload preview={receiptPreview} scanning={receiptScanning} onFile={handleReceiptFile}
        inputRef={receiptRef} label="Fuel receipt photo" caption="Tap or drag \u00B7 supports JPG, PNG" />
      <ScanCard data={receiptData} title="Receipt data extracted" fields={[
        { key: "date", label: "Date" }, { key: "station", label: "Station" }, { key: "fuelType", label: "Fuel type" },
        { key: "pricePerLitre", label: "Price per litre", fmt: v => `$${v}` },
        { key: "totalCost", label: "Total cost", fmt: v => `$${v}` },
        { key: "litres", label: "Total Litres", fmt: v => `${v} L` },
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
                {line.pump && <span style={{ color: "#64748b", fontSize: 10 }}>Pump {line.pump}</span>}
                {line.fuelType && <span style={{ color: "#94a3b8", fontSize: 10 }}>{line.fuelType}</span>}
              </div>
              {line.cost && <span style={{ color: "#374151", fontWeight: 500 }}>${line.cost.toFixed(2)}</span>}
            </div>
          ))}
          {splitMode && receiptData.lines.length >= 1 + splits.length && (
            <button onClick={() => {
              // Auto-allocate: line 1 → primary vehicle, line 2+ → splits
              const lines = receiptData.lines;
              if (lines[0]?.litres) setForm(f => ({ ...f, litres: lines[0].litres.toString() }));
              setSplits(prev => prev.map((sp, si) => {
                const line = lines[si + 1];
                if (line?.litres) return { ...sp, litres: line.litres.toString() };
                return sp;
              }));
              showToast("Litres auto-allocated from receipt lines");
            }} style={{
              width: "100%", marginTop: 6, padding: "7px 12px", borderRadius: 6,
              fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              background: "#1e40af", color: "white", border: "none",
            }}>
              {"\u2728"} Auto-allocate lines to vehicles
            </button>
          )}
          {splitMode && receiptData.lines.length < 1 + splits.length && (
            <div style={{ fontSize: 10, color: "#b45309", marginTop: 6, padding: "4px 8px", background: "#fffbeb", borderRadius: 4 }}>
              {"\u26A0"} {receiptData.lines.length} fuel lines detected but {1 + splits.length} vehicles entered {"\u2014"} you'll need to allocate litres manually
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

      {receiptData && (
        <button onClick={rescanReceipt} disabled={receiptScanning} style={{
          background: "none", border: "none", color: "#94a3b8", fontSize: 12, cursor: "pointer", padding: "4px 0", marginTop: 4, fontFamily: "inherit",
        }}>{"\u21BB"} Re-scan</button>
      )}
      {error && <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: 10, marginBottom: 12, marginTop: 12, fontSize: 13, color: "#b91c1c" }}>{error}</div>}
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <SecondaryBtn onClick={() => { setError(""); setStep(1); }}>{"\u2190"} Back</SecondaryBtn>
        <div style={{ flex: 1 }}>
          <PrimaryBtn onClick={() => { setError(""); setStep(3); }} disabled={!receiptPreview || receiptScanning}>Continue {"\u2192"}</PrimaryBtn>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="fade-in">
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>Fleet Card</div>
        <div style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>Photo of the fleet card used {"\u2014"} AI captures the card number for records</div>
      </div>
      <PhotoUpload preview={cardPreview} scanning={cardScanning} onFile={handleCardFile}
        inputRef={cardRef} label="Fleet card photo" caption="Optional \u2014 skip if not applicable" />
      <ScanCard data={cardData} title="Fleet card details" fields={[
        { key: "cardNumber", label: "Card number" }, { key: "vehicleOnCard", label: "Vehicle on card" },
      ]} />
      {cardData?.vehicleOnCard && cardData.vehicleOnCard.toUpperCase() !== form.registration.toUpperCase() && (
        <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: 10, marginTop: 10, fontSize: 12, color: "#92400e" }}>
          Card shows "{cardData.vehicleOnCard}" but the entered rego is "{form.registration.toUpperCase()}". The rego you entered takes priority.
        </div>
      )}
      {error && <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: 10, marginBottom: 12, marginTop: 12, fontSize: 13, color: "#b91c1c" }}>{error}</div>}
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <SecondaryBtn onClick={() => { setError(""); setStep(2); }}>{"\u2190"} Back</SecondaryBtn>
        <div style={{ flex: 1 }}>
          <PrimaryBtn onClick={() => { setError(""); setStep(4); }}>{cardPreview ? "Continue \u2192" : "Skip \u2192"}</PrimaryBtn>
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => {
    // ── Other mode review ──
    if (otherMode) {
      const otherRows = [
        { label: "Driver", value: form.driverName },
        { label: "Equipment / Purpose", value: otherForm.equipment },
        { label: "Station", value: otherForm.station || receiptData?.station || "\u2014" },
        { label: "Fleet Card", value: otherForm.fleetCard },
        { label: "Card Rego", value: otherForm.cardRego || "\u2014" },
        { label: "Date", value: receiptData?.date || "\u2014" },
        { label: "Litres", value: receiptData?.litres ? `${receiptData.litres} L` : "\u2014" },
        { label: "Price / L", value: receiptData?.pricePerLitre ? `$${receiptData.pricePerLitre}` : "\u2014" },
        { label: "Total Cost", value: receiptData?.totalCost ? `$${receiptData.totalCost}` : "\u2014" },
        { label: "Notes", value: otherForm.notes || "\u2014" },
      ];
      return (
        <div className="fade-in">
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>Review Oil & Other Claim</div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>Check everything looks right before submitting</div>
          </div>
          <div style={{ background: "white", border: "1px solid #fde047", borderRadius: 10, overflow: "hidden", marginBottom: 20 }}>
            <div style={{ background: "#fefce8", padding: "8px 14px", fontSize: 11, fontWeight: 700, color: "#854d0e", letterSpacing: "0.04em", textTransform: "uppercase" }}>{"\u26FD"} Oil & Other Claim</div>
            {otherRows.map(({ label, value }, i) => (
              <div key={label} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "8px 14px", fontSize: 13,
                borderBottom: i < otherRows.length - 1 ? "1px solid #f1f5f9" : "none",
                background: i % 2 === 0 ? "white" : "#fafafa",
              }}>
                <span style={{ color: "#64748b" }}>{label}</span>
                <span style={{ fontWeight: 500, color: "#0f172a", textAlign: "right", maxWidth: "60%", wordBreak: "break-word" }}>{value}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <SecondaryBtn onClick={() => setStep(3)}>{"\u2190"} Back</SecondaryBtn>
            <div style={{ flex: 1 }}><PrimaryBtn onClick={handleSubmit} loading={saving}>Submit Claim</PrimaryBtn></div>
          </div>
        </div>
      );
    }

    // ── Vehicle mode review ──
    const regoMatch = form._regoMatch;
    const ppl = receiptData?.pricePerLitre;
    const totalReceiptLitres = receiptData?.litres || 0;
    const splitLitres = splits.reduce((s, sp) => s + (parseFloat(sp.litres) || 0), 0);
    const primaryLitres = splitMode ? Math.max(0, totalReceiptLitres - splitLitres) : totalReceiptLitres;
    const primaryCost = primaryLitres && ppl ? (primaryLitres * ppl).toFixed(2) : null;

    const rows = [
      { label: "Driver", value: form.driverName },
      { label: "Registration", value: form.registration.toUpperCase() },
      { label: "Division", value: form.division },
      { label: "Vehicle type", value: form.vehicleType },
      { label: "Odometer", value: form.odometer },
      { label: "Date", value: receiptData?.date || "\u2014" },
      { label: "Station", value: receiptData?.station || "\u2014" },
      { label: "Fuel type", value: receiptData?.fuelType || regoMatch?.f || "\u2014" },
      { label: "Litres", value: splitMode ? `${primaryLitres.toFixed(2)} L` : (receiptData?.litres ? `${receiptData.litres} L` : "\u2014") },
      { label: "Price per litre", value: ppl ? `$${ppl}` : "\u2014" },
      { label: "Cost", value: splitMode ? (primaryCost ? `$${primaryCost}` : "\u2014") : (receiptData?.totalCost ? `$${receiptData.totalCost}` : "\u2014") },
      { label: "Fleet card", value: cardData?.cardNumber || (regoMatch?.c ? `...${regoMatch.c.slice(-6)} (from DB)` : "\u2014") },
    ];
    return (
      <div className="fade-in">
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>Review & Confirm</div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>
            {splitMode ? `Split receipt \u2014 ${1 + splits.length} vehicles` : "Check everything looks right before submitting"}
          </div>
        </div>

        {splitMode && (
          <div style={{ fontSize: 12, fontWeight: 700, color: "#15803d", marginBottom: 6 }}>Vehicle 1 (primary)</div>
        )}
        <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden", marginBottom: splitMode ? 12 : 20 }}>
          {rows.map(({ label, value }, i) => (
            <div key={label} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "8px 14px", fontSize: 13,
              borderBottom: i < rows.length - 1 ? "1px solid #f1f5f9" : "none",
              background: i % 2 === 0 ? "white" : "#fafafa",
            }}>
              <span style={{ color: "#64748b" }}>{label}</span>
              <span style={{ fontWeight: 500, color: "#0f172a", textAlign: "right" }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Split vehicle summaries */}
        {splitMode && splits.map((sp, si) => {
          const spMatch = sp._match || lookupRego(sp.rego, learnedDBRef.current, entriesRef.current);
          const spLitres = parseFloat(sp.litres) || 0;
          const spCost = spLitres && ppl ? (spLitres * ppl).toFixed(2) : null;
          return (
            <div key={sp.id}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#1e40af", marginBottom: 6 }}>Vehicle {si + 2}</div>
              <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>
                {[
                  { label: "Registration", value: (sp.rego || "?").toUpperCase() },
                  { label: "Vehicle", value: spMatch?.n || spMatch?.t || "\u2014" },
                  { label: "Odometer", value: sp.odometer || "\u2014" },
                  { label: "Litres", value: `${spLitres.toFixed(2)} L` },
                  { label: "Cost", value: spCost ? `$${spCost}` : "\u2014" },
                ].map(({ label, value }, i, arr) => (
                  <div key={label} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "8px 14px", fontSize: 13,
                    borderBottom: i < arr.length - 1 ? "1px solid #f1f5f9" : "none",
                    background: i % 2 === 0 ? "white" : "#fafafa",
                  }}>
                    <span style={{ color: "#64748b" }}>{label}</span>
                    <span style={{ fontWeight: 500, color: "#0f172a", textAlign: "right" }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {splitMode && receiptData?.totalCost && (
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16, padding: "8px 12px", background: "#f8fafc", borderRadius: 6, border: "1px solid #e2e8f0" }}>
            <strong>Receipt total:</strong> ${receiptData.totalCost} {"\u00B7"} Split across {1 + splits.length} vehicles
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <SecondaryBtn onClick={() => setStep(3)}>{"\u2190"} Back</SecondaryBtn>
          <div style={{ flex: 1 }}>
            <PrimaryBtn onClick={handleSubmit} loading={saving}>
              {splitMode ? `Submit ${1 + splits.length} Entries` : "Submit Entry"}
            </PrimaryBtn>
          </div>
        </div>
      </div>
    );
  };

  const renderStep5 = () => (
    <div className="fade-in" style={{ textAlign: "center", padding: "32px 0" }}>
      <div style={{ width: 64, height: 64, borderRadius: "50%", background: otherMode ? "#fefce8" : "#f0fdf4", border: `2px solid ${otherMode ? "#fde047" : "#86efac"}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 28 }}>{"\u2713"}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: otherMode ? "#854d0e" : "#15803d", marginBottom: 6 }}>
        {otherMode ? "Claim Saved!" : splitMode ? `${1 + splits.length} Entries Saved!` : "Entry Saved!"}
      </div>
      <div style={{ fontSize: 13, color: "#64748b", marginBottom: 8 }}>
        {otherMode ? otherForm.equipment : form.registration.toUpperCase()}
        {splitMode && !otherMode && splits.map(s => ` \u00B7 ${(s.rego || "?").toUpperCase()}`)}
      </div>
      {receiptData?.totalCost && <div style={{ fontSize: 28, fontWeight: 700, color: "#0f172a", marginBottom: 24 }}>${receiptData.totalCost}</div>}
      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        <SecondaryBtn onClick={resetForm}>+ New Entry</SecondaryBtn>
        <SecondaryBtn onClick={() => { resetForm(); setView("data"); }}>View Data</SecondaryBtn>
      </div>
    </div>
  );


  // ── Data view ─────────────────────────────────────────────────────────────
  const renderData = () => {
    // Separate vehicle entries from "other" claims
    const vehicleEntries = entries.filter(e => e.entryType !== "other");
    const filterOptions = ["All", ...DIVISION_KEYS.filter(d => vehicleEntries.some(e => (e.division || getDivision(e.vehicleType)) === d))];
    const filtered = dataFilter === "All" ? vehicleEntries
      : DIVISION_KEYS.includes(dataFilter) ? vehicleEntries.filter(e => (e.division || getDivision(e.vehicleType)) === dataFilter)
      : vehicleEntries;

    // Group: division → vehicleType → rego
    const divGroups = {};
    filtered.forEach(e => {
      const div = e.division || getDivision(e.vehicleType) || "Tree";
      const vt = e.vehicleType || "Other";
      if (!divGroups[div]) divGroups[div] = {};
      if (!divGroups[div][vt]) divGroups[div][vt] = {};
      if (!divGroups[div][vt][e.registration]) divGroups[div][vt][e.registration] = [];
      divGroups[div][vt][e.registration].push(e);
    });

    const totalSpend = entries.reduce((s, e) => s + (e.totalCost || 0), 0);
    const regoCount = new Set(vehicleEntries.map(e => e.registration)).size;

    // Count flags
    let totalFlags = 0;
    [...new Set(vehicleEntries.map(e => e.registration))].forEach(rego => {
      const re = vehicleEntries.filter(e => e.registration === rego).sort(sortEntries);
      const vt = re[0]?.vehicleType || "Other";
      re.forEach((e, i) => {
        totalFlags += getEntryFlags(e, i > 0 ? re[i - 1] : null, vt, serviceData[rego]).filter(f => f.type === "danger" || f.type === "warn").length;
      });
    });

    return (
      <div onClick={() => vehicleMenu && setVehicleMenu(null)}>
        {/* Summary stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 20 }}>
          {[
            { label: "Entries", value: entries.length, color: "#16a34a" },
            { label: "Total Spend", value: `$${totalSpend.toFixed(0)}`, color: "#16a34a" },
            { label: "Vehicles", value: regoCount, color: "#16a34a" },
            { label: "Flags", value: totalFlags, color: totalFlags > 0 ? "#dc2626" : "#16a34a" },
          ].map(s => (
            <div key={s.label} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
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

        {/* Division filter */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          {filterOptions.map(t => {
            const isDivision = DIVISION_KEYS.includes(t);
            const dc = isDivision ? DIVISIONS[t].color : null;
            return (
              <button key={t} onClick={() => setDataFilter(t)} style={{
                padding: "5px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                fontWeight: dataFilter === t ? 700 : 500,
                background: dataFilter === t ? (dc ? dc.accent : "#16a34a") : "white",
                color: dataFilter === t ? "white" : (dc ? dc.text : "#64748b"),
                border: `1px solid ${dataFilter === t ? (dc ? dc.accent : "#16a34a") : "#e2e8f0"}`,
              }}>
                {isDivision && <span style={{ marginRight: 4 }}>{t === "Tree" ? "\uD83C\uDF33" : "\uD83C\uDF3F"}</span>}
                {t}
              </button>
            );
          })}
        </div>

        {/* Vehicle entries grouped by division → vehicle type → rego */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>{"\u25CB"}</div>
            <div style={{ fontWeight: 500 }}>No entries yet</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Submit your first fuel receipt to get started</div>
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
                      const svc = serviceData[rego];
                      const latestOdo = sorted[sorted.length - 1]?.odometer;
                      const nextServiceDue = svc?.lastServiceKms ? svc.lastServiceKms + SERVICE_INTERVAL_KM : null;
                      const isOverdue = nextServiceDue && latestOdo && latestOdo >= nextServiceDue;
                      const isServiceSoon = nextServiceDue && latestOdo && !isOverdue && (nextServiceDue - latestOdo) <= SERVICE_WARNING_KM;

                      // Collect flags
                      const vehicleFlags = [];
                      sorted.forEach((e, i) => {
                        const flags = getEntryFlags(e, i > 0 ? sorted[i - 1] : null, vt, svc);
                        flags.forEach(f => vehicleFlags.push({ ...f, entryDate: e.date }));
                      });
                      const dangerCount = vehicleFlags.filter(f => f.type === "danger").length;
                      const warnCount = vehicleFlags.filter(f => f.type === "warn").length;

                      return (
                        <div key={rego} style={{ marginBottom: 16, position: "relative" }}>
                          {/* Vehicle header */}
                          <div onClick={() => setExpandedRego(isExpanded ? null : rego)}
                            className={isOverdue ? "svc-overdue" : ""}
                            style={{
                              background: "white",
                              border: `1px solid ${isOverdue ? "#fca5a5" : isServiceSoon ? "#fcd34d" : "#e2e8f0"}`,
                              borderRadius: isExpanded ? "10px 10px 0 0" : 10, padding: "12px 14px", cursor: "pointer", transition: "all 0.15s",
                            }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", letterSpacing: "0.03em" }}>{rego}</span>
                                {dangerCount > 0 && <span className="flag-badge flag-danger">{"\u26A0"} {dangerCount}</span>}
                                {warnCount > 0 && <span className="flag-badge flag-warn">{"\u26A1"} {warnCount}</span>}
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
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
                              {latestOdo && <span>Odo: {latestOdo.toLocaleString()} km</span>}
                              {svc?.lastServiceDate && <span>Last svc: {svc.lastServiceDate}</span>}
                              {nextServiceDue && (
                                <span style={{ color: isOverdue ? "#dc2626" : isServiceSoon ? "#b45309" : "#64748b", fontWeight: isOverdue ? 700 : 400 }}>
                                  {isOverdue ? `SERVICE OVERDUE (due ${nextServiceDue.toLocaleString()})` : `Next svc: ${nextServiceDue.toLocaleString()} km`}
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
                              <button onClick={() => { setVehicleMenu(null); setEditingVehicle(rego); }} style={{
                                width: "100%", padding: "10px 14px", background: "none", border: "none", borderBottom: "1px solid #f1f5f9",
                                fontSize: 12, fontWeight: 500, color: "#374151", cursor: "pointer", fontFamily: "inherit",
                                textAlign: "left", display: "flex", alignItems: "center", gap: 8,
                              }}><span style={{ fontSize: 14 }}>{"\u270E"}</span> Edit Vehicle</button>
                              <button onClick={() => { setVehicleMenu(null); setServiceModal(rego); }} style={{
                                width: "100%", padding: "10px 14px", background: "none", border: "none", borderBottom: "1px solid #f1f5f9",
                                fontSize: 12, fontWeight: 500, color: "#374151", cursor: "pointer", fontFamily: "inherit",
                                textAlign: "left", display: "flex", alignItems: "center", gap: 8,
                              }}><span style={{ fontSize: 14 }}>{"\uD83D\uDD27"}</span> {svc ? "Update Service" : "Add Service"}</button>
                              <button onClick={() => { setVehicleMenu(null); setExpandedRego(isExpanded ? null : rego); }} style={{
                                width: "100%", padding: "10px 14px", background: "none", border: "none", borderBottom: "1px solid #f1f5f9",
                                fontSize: 12, fontWeight: 500, color: "#374151", cursor: "pointer", fontFamily: "inherit",
                                textAlign: "left", display: "flex", alignItems: "center", gap: 8,
                              }}><span style={{ fontSize: 14 }}>{"\uD83D\uDCCA"}</span> {isExpanded ? "Hide Entries" : "View Entries"}</button>
                              <button onClick={() => { setVehicleMenu(null); deleteVehicle(rego); }} style={{
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
                                background: isOverdue ? "#fef2f2" : isServiceSoon ? "#fffbeb" : "#f8fafc",
                                border: `1px solid ${isOverdue ? "#fca5a5" : isServiceSoon ? "#fcd34d" : "#e2e8f0"}`,
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
                                        const flags = getEntryFlags(e, prev, vt, svc);
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
                                            <td style={{
                                              fontWeight: 600, borderRight: "1px solid #f1f5f9",
                                              color: variance != null ? (variance > COST_VARIANCE_THRESHOLD ? "#dc2626" : variance < -COST_VARIANCE_THRESHOLD ? "#2563eb" : "#15803d") : "#94a3b8"
                                            }}>
                                              {variance != null ? `${variance >= 0 ? "+" : ""}$${variance.toFixed(2)}` : "\u2014"}
                                            </td>
                                            <td style={{ background: "#f8fafc", width: 3, padding: 0 }}></td>
                                            <td style={{ color: "#854d0e", fontSize: 10 }}>{showSvc && svc?.lastServiceDate ? svc.lastServiceDate : (showSvc ? "\u2014" : "")}</td>
                                            <td style={{ color: "#854d0e", fontSize: 10 }}>{showSvc && svc?.lastServiceKms ? svc.lastServiceKms.toLocaleString() : (showSvc ? "\u2014" : "")}</td>
                                            <td style={{
                                              fontSize: 10, fontWeight: showSvc && isOverdue ? 700 : 400,
                                              color: showSvc && isOverdue ? "#dc2626" : showSvc && isServiceSoon ? "#b45309" : "#854d0e"
                                            }}>
                                              {showSvc && nextServiceDue ? nextServiceDue.toLocaleString() : (showSvc ? "\u2014" : "")}
                                            </td>
                                            <td style={{ whiteSpace: "nowrap" }}>
                                              <button onClick={() => setEditingEntry(e)} title="Edit" style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 12, lineHeight: 1, padding: "2px 4px" }}>{"\u270E"}</button>
                                              <button onClick={() => setConfirmAction({ message: `Delete this entry for ${e.registration} on ${e.date || "unknown date"}?`, onConfirm: async () => { await deleteEntry(e.id); setConfirmAction(null); } })} title="Delete" style={{ background: "none", border: "none", color: "#cbd5e1", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "2px 4px" }}>{"\u00D7"}</button>
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

        {/* ── Oil & Others Section ── */}
        {(() => {
          const otherEntries = entries.filter(e => e.entryType === "other");
          if (otherEntries.length === 0) return null;
          const otherTotal = otherEntries.reduce((s, e) => s + (e.totalCost || 0), 0);
          return (
            <div style={{ marginTop: 28 }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 10, marginBottom: 14,
                padding: "8px 12px", background: "#fefce8", borderRadius: 8,
                border: "1px solid #fde047",
              }}>
                <span style={{ fontSize: 18 }}>{"\u26FD"}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#854d0e", letterSpacing: "0.04em" }}>Oil & Others</span>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 11, color: "#854d0e", opacity: 0.7 }}>
                  {otherEntries.length} claims {"\u00B7"} ${otherTotal.toFixed(2)}
                </span>
              </div>
              <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table className="data-table">
                    <thead>
                      <tr style={{ background: "#fefce8" }}>
                        <th style={{ color: "#854d0e", borderBottom: "2px solid #fde047" }}>Driver</th>
                        <th style={{ color: "#854d0e", borderBottom: "2px solid #fde047" }}>PT / Equipment</th>
                        <th style={{ color: "#854d0e", borderBottom: "2px solid #fde047" }}>Station</th>
                        <th style={{ color: "#854d0e", borderBottom: "2px solid #fde047" }}>Fleet Card</th>
                        <th style={{ color: "#854d0e", borderBottom: "2px solid #fde047" }}>Card Rego</th>
                        <th style={{ color: "#854d0e", borderBottom: "2px solid #fde047" }}>Date</th>
                        <th style={{ color: "#854d0e", borderBottom: "2px solid #fde047" }}>Litres</th>
                        <th style={{ color: "#854d0e", borderBottom: "2px solid #fde047" }}>$/L</th>
                        <th style={{ color: "#854d0e", borderBottom: "2px solid #fde047" }}>Cost</th>
                        <th style={{ color: "#854d0e", borderBottom: "2px solid #fde047" }}>Notes</th>
                        <th style={{ borderBottom: "2px solid #fde047", width: 50 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {otherEntries.map(e => (
                        <tr key={e.id} style={{ background: "white" }}>
                          <td style={{ fontWeight: 500, color: "#374151" }}>{e.driverName || "\u2014"}</td>
                          <td style={{ fontWeight: 600, color: "#854d0e" }}>{e.equipment || "\u2014"}</td>
                          <td style={{ color: "#64748b" }}>{e.station || "\u2014"}</td>
                          <td style={{ color: "#374151", fontSize: 10 }}>{e.fleetCardNumber || "\u2014"}</td>
                          <td style={{ fontWeight: 600, color: "#374151" }}>{e.cardRego || "\u2014"}</td>
                          <td style={{ color: "#374151" }}>{e.date || "\u2014"}</td>
                          <td style={{ color: "#374151" }}>{e.litres ? `${e.litres}L` : "\u2014"}</td>
                          <td style={{ color: "#374151" }}>{e.pricePerLitre ? `$${e.pricePerLitre}` : "\u2014"}</td>
                          <td style={{ color: "#16a34a", fontWeight: 600 }}>{e.totalCost ? `$${e.totalCost.toFixed(2)}` : "\u2014"}</td>
                          <td style={{ color: "#64748b", fontSize: 10, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.notes || "\u2014"}</td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            <button onClick={() => setEditingEntry(e)} title="Edit" style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 12, lineHeight: 1, padding: "2px 4px" }}>{"\u270E"}</button>
                            <button onClick={() => setConfirmAction({ message: `Delete this ${e.equipment} claim?`, onConfirm: async () => { await deleteEntry(e.id); setConfirmAction(null); } })} title="Delete" style={{ background: "none", border: "none", color: "#cbd5e1", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "2px 4px" }}>{"\u00D7"}</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
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
      const svc = serviceData[rego];
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
        const pctChange = ((recentAvg - earlierAvg) / earlierAvg) * 100;
        if (pctChange > TREND_CHANGE_PCT) trend = "worsening";
        else if (pctChange < -TREND_CHANGE_PCT) trend = "improving";
        else trend = "stable";
      }

      // Anomaly detection: any fill-up where L/km is significantly above vehicle's own average
      const anomalies = [];
      if (avgLPerKm && avgLPerKm > 0) {
        efficiencies.forEach(eff => {
          if (eff.lPerKm > avgLPerKm * ANOMALY_MULTIPLIER) {
            anomalies.push({ ...eff, type: "high", pct: Math.round(((eff.lPerKm - avgLPerKm) / avgLPerKm) * 100) });
          }
        });
      }

      // Collect all flags
      const flags = [];
      regoEntries.forEach((e, i) => {
        const prev = i > 0 ? regoEntries[i - 1] : null;
        getEntryFlags(e, prev, vt, svc).forEach(f => flags.push({ ...f, rego, date: e.date, odo: e.odometer }));
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
    const totalVehicles = fleet.length;
    const overdue = fleet.filter(v => v.svcStatus === "overdue");
    const approaching = fleet.filter(v => v.svcStatus === "approaching");
    const allFlags = fleet.flatMap(v => v.flags.filter(f => f.type === "danger" || f.type === "warn"));
    const openFlagCount = allFlags.filter(f => !resolvedFlags[flagId(f)]).length;
    const totalSpend = fleet.reduce((s, v) => s + v.totalCost, 0);
    const totalLitres = fleet.reduce((s, v) => s + v.totalLitres, 0);
    const worsening = fleet.filter(v => v.trend === "worsening");

    // Sort: overdue first, then approaching, then by most flags
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

        {/* Top-level KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
          {[
            { label: "Vehicles", value: totalVehicles, color: "#16a34a" },
            { label: "Total Spend", value: `$${totalSpend.toFixed(0)}`, color: "#0f172a" },
            { label: "Total Litres", value: `${totalLitres.toFixed(0)}L`, color: "#0f172a" },
          ].map(s => (
            <div key={s.label} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Alert cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
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
                        {v.flags.filter(f => f.type === "danger" || f.type === "warn").length > 0 ? (
                          <span className="flag-badge flag-danger" style={{ fontSize: 9, cursor: "pointer" }} onClick={() => setShowFlags(true)}>
                            {v.flags.filter(f => f.type === "danger" || f.type === "warn").length}
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
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 10 }}>Fill-ups where fuel consumption was {Math.round((ANOMALY_MULTIPLIER - 1) * 100)}%+ above that vehicle's own average {"\u2014"} may indicate leaks, theft, incorrect data, or mechanical issues.</div>
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
      </div>
    );
  };

  // ── Flags Modal ───────────────────────────────────────────────────────────
  const renderFlagsModal = () => {
    if (!showFlags) return null;
    const fleet = fleetAnalysis;
    const allFlags = fleet.flatMap(v => v.flags.filter(f => f.type === "danger" || f.type === "warn"));

    // Add stable ID to each flag
    const flagsWithId = allFlags.map(f => ({ ...f, _id: flagId(f) }));
    const openFlags = flagsWithId.filter(f => !resolvedFlags[f._id]);
    const doneFlags = flagsWithId.filter(f => resolvedFlags[f._id]);
    const visibleFlags = flagsFilter === "open" ? openFlags : flagsFilter === "resolved" ? doneFlags : flagsWithId;

    // Group by type of issue
    const groupFlags = (list) => {
      const svc = list.filter(f => f.text.includes("SERVICE") || f.text.includes("Service"));
      const fuel = list.filter(f => f.text.includes("fuel") || f.text.includes("Fuel"));
      const cost = list.filter(f => f.text.includes("Cost") || f.text.includes("cost"));
      const odo = list.filter(f => f.text.includes("Odo") || f.text.includes("km"));
      const other = list.filter(f => !svc.includes(f) && !fuel.includes(f) && !cost.includes(f) && !odo.includes(f));
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
                  <span style={{ color: "#94a3b8", marginLeft: 8 }}>{new Date(resolution.at).toLocaleDateString()}</span>
                  {resolution.note && <div style={{ color: "#374151", marginTop: 2 }}>{resolution.note}</div>}
                </div>
              )}

              {/* Reply form */}
              {isReplying && !isResolved && (
                <ReplyForm fid={f._id} onResolve={(note, by) => { resolveFlag(f._id, note, by); setReplyingFlag(null); }} onCancel={() => setReplyingFlag(null)} />
              )}
            </div>

            {/* Quick resolve (no note) */}
            {!isResolved && !isReplying && (
              <button onClick={() => setReplyingFlag(f._id)} style={{
                padding: "4px 8px", borderRadius: 5, fontSize: 10, fontWeight: 600,
                background: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0",
                cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
              }}>Respond</button>
            )}
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
            setApiKey(apiKeyInput); showToast("API key saved");
          }} style={{ padding: "9px 16px", background: "#16a34a", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>Save</button>
        </div>
        <div style={{ fontSize: 11, color: "#94a3b8" }}>Stored locally {"\u00B7"} only sent to Anthropic for scanning {"\u00B7"} get a key at console.anthropic.com</div>
        {apiKey && <div style={{ fontSize: 12, color: "#15803d", marginTop: 6, fontWeight: 500 }}>{"\u2713"} API key is set</div>}
      </div>
      <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 10 }}>Data</div>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>{entries.length} entries {"\u00B7"} {Object.keys(serviceData).length} service records {"\u00B7"} {Object.keys(learnedDB).length} learned vehicles {"\u00B7"} {Object.keys(resolvedFlags).length} resolved issues</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setConfirmAction({
            message: "Delete all fuel entries? This cannot be undone.",
            onConfirm: async () => { await persist([]); setConfirmAction(null); showToast("All entries deleted"); }
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

      {Object.keys(learnedDB).length > 0 && (
      <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, padding: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#7c3aed", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 10 }}>{"\uD83E\uDDE0"} Learned Vehicle Data</div>
        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 10 }}>These overrides were learned from driver submissions and take priority over the original fleet spreadsheet.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 200, overflowY: "auto" }}>
          {Object.entries(learnedDB).sort().map(([rego, data]) => (
            <div key={rego} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px", background: "#faf5ff", borderRadius: 4, fontSize: 11 }}>
              <div>
                <span style={{ fontWeight: 700, color: "#0f172a" }}>{rego}</span>
                <span style={{ color: "#64748b", marginLeft: 8 }}>{data.d} {"\u00B7"} {data.t}</span>
                {data.dr && <span style={{ color: "#94a3b8", marginLeft: 8 }}>{data.dr}</span>}
              </div>
              <button onClick={() => {
                const { [rego]: _, ...rest } = learnedDB;
                persistLearned(rest);
                showToast(`Reset ${rego} to fleet database`);
              }} style={{ background: "none", border: "none", color: "#c4b5fd", cursor: "pointer", fontSize: 13 }}>{"\u00D7"}</button>
            </div>
          ))}
        </div>
      </div>
      )}
    </div>
  );

  // ── Main layout ───────────────────────────────────────────────────────────
  if (!storageReady) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", fontFamily: "Inter, sans-serif", color: "#94a3b8", fontSize: 14 }}>Loading...</div>
  );

  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      <style>{css}</style>
      <div style={{
        background: "white", borderBottom: "1px solid #e2e8f0",
        padding: "0 16px", display: "flex", alignItems: "center",
        justifyContent: "space-between", height: 56, position: "sticky", top: 0, zIndex: 10,
      }}>
        <div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: "#16a34a", letterSpacing: "0.06em" }}>PLATEAU TREES</div>
          <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", lineHeight: 1 }}>Fuel Tracker</div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {[["submit", "+ Entry"], ["dashboard", "Dashboard"], ["data", "Data"], ["settings", "\u2699"]].map(([v, label]) => (
            <button key={v} onClick={() => { setView(v); if (v === "submit") resetForm(); }} style={{
              padding: "6px 12px", borderRadius: 7, fontSize: 12, cursor: "pointer",
              fontFamily: "inherit", fontWeight: view === v ? 700 : 500,
              background: view === v ? "#16a34a" : "transparent",
              color: view === v ? "white" : "#64748b",
              border: `1px solid ${view === v ? "#16a34a" : "#e2e8f0"}`,
              transition: "all 0.15s",
            }}>{label}</button>
          ))}
        </div>
      </div>
      <div style={{ maxWidth: (view === "data" || view === "dashboard") ? 960 : 520, margin: "0 auto", padding: "24px 16px", transition: "max-width 0.3s" }}>
        {view === "submit" && (
          <>
            {step < 5 && <StepBar step={step} />}
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
            {step === 4 && renderStep4()}
            {step === 5 && renderStep5()}
          </>
        )}
        {view === "dashboard" && renderDashboard()}
        {view === "data" && renderData()}
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
