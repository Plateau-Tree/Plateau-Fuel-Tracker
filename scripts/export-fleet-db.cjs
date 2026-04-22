// One-off script: dump the fleet card database from App.jsx into a
// formatted Excel file. Run: node scripts/export-fleet-db.cjs
const XLSX = require("xlsx-js-style");
const fs = require("fs");

const src = fs.readFileSync("src/App.jsx", "utf8");

// ── Parse DRIVER_CARDS ──
const driverBlock = src.match(/const DRIVER_CARDS = \[([\s\S]*?)\];/)[1];
const driverEntries = [...driverBlock.matchAll(/\{n:"([^"]*)",c:"([^"]*)",r:"([^"]*)"\}/g)].map(m => ({
  driver: m[1], card: m[2], rego: m[3], src: "DRIVER_CARDS",
}));

// ── Parse REGO_DB ──
const regoBlock = src.match(/const REGO_DB = \[([\s\S]*?)\];/)[1];
const regoEntries = [];
const regoRegex = /\{(?:[^{}]|\{[^{}]*\})*\}/g;
let match;
while ((match = regoRegex.exec(regoBlock)) !== null) {
  try {
    const obj = JSON.parse(match[0]);
    if (obj.r && obj.c && typeof obj.c === "string" && obj.c.startsWith("7034")) {
      regoEntries.push({
        driver: obj.dr || "",
        card: obj.c.replace(/\s/g, ""),
        rego: obj.r,
        type: obj.t || "",
        division: obj.d || "",
        name: obj.n || "",
        fuel: obj.f || "",
        src: "REGO_DB",
      });
    }
  } catch (_) {}
}

// Lookup to enrich DRIVER_CARDS rows with REGO_DB metadata
const regoByPair = {};
regoEntries.forEach(e => {
  regoByPair[e.rego + "|" + e.card] = e;
  if (!regoByPair["_" + e.rego]) regoByPair["_" + e.rego] = e;
});

// Merge, prefer DRIVER_CARDS when the same (rego, card) appears in both
const combined = {};
for (const e of [...driverEntries, ...regoEntries]) {
  const key = (e.rego || "").toUpperCase() + "|" + (e.card || "").replace(/\s/g, "");
  if (!combined[key] || (combined[key].src === "REGO_DB" && e.src === "DRIVER_CARDS")) {
    const meta = regoByPair[e.rego + "|" + e.card] || regoByPair["_" + e.rego] || {};
    combined[key] = {
      rego: e.rego,
      card: e.card,
      driver: e.driver || meta.driver || "",
      type: meta.type || "",
      division: meta.division || "",
      name: meta.name || "",
      fuel: meta.fuel || "",
      source: e.src,
    };
  }
}
const rows = Object.values(combined).sort((a, b) => a.rego.localeCompare(b.rego));

// Duplicate regos
const regoGroups = {};
rows.forEach(r => { (regoGroups[r.rego] = regoGroups[r.rego] || []).push(r); });
const dupRegos = new Set(Object.entries(regoGroups).filter(([, a]) => a.length > 1).map(([r]) => r));

// ── Build Sheet 1: All Cards ──
const aoa = [];
aoa.push(["Plateau Trees Fleet Card Database"]);
aoa.push([`Generated ${new Date().toLocaleString("en-AU")} · ${rows.length} rego/card pairs · ${dupRegos.size} regos with duplicates`]);
aoa.push([]);
aoa.push(["Rego", "Card Number", "Driver / Holder", "Vehicle Type", "Division", "Vehicle Name", "Fuel Type", "Flag"]);
rows.forEach(r => {
  aoa.push([
    r.rego, r.card, r.driver, r.type, r.division, r.name, r.fuel,
    dupRegos.has(r.rego) ? "DUPLICATE REGO" : "",
  ]);
});
const ws = XLSX.utils.aoa_to_sheet(aoa);

const titleStyle = { font: { bold: true, sz: 16, color: { rgb: "FF0F172A" } } };
const subStyle = { font: { italic: true, sz: 10, color: { rgb: "FF64748B" } } };
const headerStyle = {
  fill: { patternType: "solid", fgColor: { rgb: "FF0F766E" } },
  font: { bold: true, sz: 11, color: { rgb: "FFFFFFFF" } },
  alignment: { horizontal: "center", vertical: "center" },
  border: {
    top: { style: "thin", color: { rgb: "FFD1D5DB" } },
    bottom: { style: "thin", color: { rgb: "FFD1D5DB" } },
    left: { style: "thin", color: { rgb: "FFD1D5DB" } },
    right: { style: "thin", color: { rgb: "FFD1D5DB" } },
  },
};
const cellBorder = {
  top: { style: "thin", color: { rgb: "FFE5E7EB" } },
  bottom: { style: "thin", color: { rgb: "FFE5E7EB" } },
  left: { style: "thin", color: { rgb: "FFE5E7EB" } },
  right: { style: "thin", color: { rgb: "FFE5E7EB" } },
};

const setStyle = (sheet, r, c, s) => {
  const addr = XLSX.utils.encode_cell({ r, c });
  if (!sheet[addr]) sheet[addr] = { v: "", t: "s" };
  sheet[addr].s = { ...(sheet[addr].s || {}), ...s };
};

setStyle(ws, 0, 0, titleStyle);
setStyle(ws, 1, 0, subStyle);
for (let c = 0; c < 8; c++) setStyle(ws, 3, c, headerStyle);

const DUP_BG = "FFFEF3C7";
const ZEBRA_BG = "FFF9FAFB";
rows.forEach((row, i) => {
  const r = 4 + i;
  const isDup = dupRegos.has(row.rego);
  const fill = isDup
    ? { patternType: "solid", fgColor: { rgb: DUP_BG } }
    : (i % 2 === 1 ? { patternType: "solid", fgColor: { rgb: ZEBRA_BG } } : undefined);
  for (let c = 0; c < 8; c++) {
    const font = { sz: 10, color: { rgb: "FF0F172A" } };
    if (c === 1) font.name = "Consolas"; // monospace card column
    if (isDup && c === 7) { font.bold = true; font.color = { rgb: "FFB45309" }; }
    setStyle(ws, r, c, {
      ...(fill ? { fill } : {}),
      font,
      alignment: { horizontal: "left", vertical: "center" },
      border: cellBorder,
    });
  }
});

ws["!cols"] = [
  { wch: 10 }, { wch: 20 }, { wch: 30 }, { wch: 16 },
  { wch: 12 }, { wch: 32 }, { wch: 18 }, { wch: 18 },
];
ws["!merges"] = [
  { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
  { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
];
ws["!views"] = [{ state: "frozen", ySplit: 4, xSplit: 0, topLeftCell: "A5" }];

// ── Sheet 2: Duplicates ──
const dupAoa = [];
dupAoa.push(["Duplicate regos — admin decision needed"]);
dupAoa.push([`${dupRegos.size} regos have multiple card numbers. Pick one per rego and remove the others from DRIVER_CARDS / REGO_DB in src/App.jsx.`]);
dupAoa.push([]);
dupAoa.push(["Rego", "Card Number", "Driver / Holder", "Decision (keep/remove)"]);
const dupGroupEntries = Object.entries(regoGroups).filter(([, a]) => a.length > 1).sort();
for (const [rego, arr] of dupGroupEntries) {
  for (const e of arr) dupAoa.push([e.rego, e.card, e.driver, ""]);
  dupAoa.push([]);
}
const ws2 = XLSX.utils.aoa_to_sheet(dupAoa);
setStyle(ws2, 0, 0, titleStyle);
setStyle(ws2, 1, 0, { font: { italic: true, sz: 10, color: { rgb: "FFB45309" } } });
for (let c = 0; c < 4; c++) setStyle(ws2, 3, c, headerStyle);

let curRow = 4;
for (const [, arr] of dupGroupEntries) {
  for (let i = 0; i < arr.length; i++) {
    for (let c = 0; c < 4; c++) {
      const font = { sz: 10 };
      if (c === 1) font.name = "Consolas";
      setStyle(ws2, curRow, c, {
        fill: { patternType: "solid", fgColor: { rgb: DUP_BG } },
        font,
        border: cellBorder,
      });
    }
    curRow++;
  }
  curRow++;
}
ws2["!cols"] = [{ wch: 10 }, { wch: 20 }, { wch: 30 }, { wch: 28 }];
ws2["!merges"] = [
  { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
  { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "All Cards");
XLSX.utils.book_append_sheet(wb, ws2, "Duplicate Regos");
const outPath = "C:/Users/ptsuser/Downloads/Plateau_Fleet_Card_Database.xlsx";
XLSX.writeFile(wb, outPath);
console.log("Wrote:", outPath);
console.log("  Sheet 1: All Cards — " + rows.length + " rows");
console.log("  Sheet 2: Duplicate Regos — " + dupRegos.size + " regos (" +
  dupGroupEntries.reduce((s, [, a]) => s + a.length, 0) + " rows)");
