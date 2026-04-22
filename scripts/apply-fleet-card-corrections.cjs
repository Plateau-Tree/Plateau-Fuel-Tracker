// Apply the admin's fleet-card corrections to App.jsx (DRIVER_CARDS + REGO_DB).
// One-off migration, safe to re-run (idempotent) — old numbers will already be
// gone after the first run and later edits will just no-op.

const fs = require("fs");
const path = "src/App.jsx";
let src = fs.readFileSync(path, "utf8");
const originalLen = src.length;

// Driver names in DRIVER_CARDS are UPPERCASE; REGO_DB `dr` also UPPERCASE.
const upper = (s) => (s || "").trim().toUpperCase();

// ── Updates from the admin spreadsheet ───────────────────────────────────
// `action: "replace"` = swap oldCard → newCard in DRIVER_CARDS + REGO_DB,
//    and update the driver name to `newDriver` (uppercased).
// `action: "delete"` = remove that specific (rego, oldCard) mapping from
//    both DRIVER_CARDS and REGO_DB. The rego may still exist in the other
//    DB with a different card; we only scrub the rows that match oldCard.
const updates = [
  { rego: "BR22ZZ", oldCard: "7034305115783134", newCard: "7034305117074284", newDriver: "Nick Jones",                     action: "replace" },
  { rego: "BT08QM", oldCard: "7034305105574238", newCard: "7034305116939826", newDriver: "Yarran/Jason Hughes",            action: "replace" },
  { rego: "CA10BL", oldCard: "7034305106436460", newCard: "7034305117926277", newDriver: "Luke Bartley",                   action: "replace" },
  { rego: "CD36PH", oldCard: "7034305106228180", newCard: "7034305117597540", newDriver: "Joe Hutton",                     action: "replace" },
  { rego: "CH90KL", oldCard: "7034305106786955", newCard: "7034305117902278", newDriver: "Sam Thomas",                     action: "replace" },
  { rego: "CP11JO", oldCard: "7034305106957424", newCard: "7034305116851328", newDriver: "SPARE - old Brendon Deacon",     action: "replace" },
  { rego: "CS63LP", oldCard: "7034305116822212", newCard: "7034305112809668", newDriver: "Blower Truck",                   action: "replace" },
  { rego: "CX23BE", oldCard: "7034305106791179", newCard: "7034305118302718", newDriver: "Water truck / Mick Thomas",      action: "replace" },
  { rego: "CX45MJ", oldCard: "7034305107330928", newCard: "7034305118229598", newDriver: "Justin Lewis",                   action: "replace" },
  { rego: "DP90CQ", oldCard: "7034305114660168", newCard: "7034305117463065", newDriver: "Tim Price",                      action: "replace" },
  { rego: "DSU65Y", oldCard: "7034305108545714", newCard: "",                 newDriver: "",                                action: "delete"  },
  { rego: "EBL30C", oldCard: "7034305113442394", newCard: "7034305118360872", newDriver: "Sam Law",                        action: "replace" },
  { rego: "EVA47B", oldCard: "7034305105562266", newCard: "7034305117050979", newDriver: "Ant Youngman",                   action: "replace" },
  { rego: "MISC3",  oldCard: "7034305105984726", newCard: "",                 newDriver: "",                                action: "delete"  },
  { rego: "XN56BU", oldCard: "7034305111430383", newCard: "7034305117074201", newDriver: "Brendon Deacon / Old Bogie",     action: "replace" },
  { rego: "XN70FQ", oldCard: "7034305108388719", newCard: "7034305117074300", newDriver: "SPARE",                          action: "replace" },
  { rego: "XP36GC", oldCard: "7034305113207938", newCard: "7034305117461226", newDriver: "4 Tonner / Brendon Hooke",       action: "replace" },
  { rego: "XP86LM", oldCard: "7034305117860930", newCard: "7034305118477429", newDriver: "Jason Sorbara",                  action: "replace" },
  { rego: "XP86LM", oldCard: "7034305108940667", newCard: "",                 newDriver: "",                                action: "delete"  },
  { rego: "YMN14E", oldCard: "7034305106723230", newCard: "7034305118263860", newDriver: "Roger Borg",                     action: "replace" },
];

// Helper: escape a string for use inside a regex
const rx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

let driverEdits = 0, regoEdits = 0, driverDeletes = 0, regoDeletes = 0, driverMisses = 0, regoMisses = 0;

for (const u of updates) {
  const driver = upper(u.newDriver);

  // ── DRIVER_CARDS pattern: {n:"...",c:"CARD",r:"REGO"} ──
  // Match entries scoped to the specific rego + oldCard so we don't
  // accidentally touch an AT13VE row that happens to share a card number
  // with an XP86LM row being deleted.
  const dcPattern = new RegExp(
    `\\{n:"[^"]*",c:"${rx(u.oldCard)}",r:"${rx(u.rego)}"\\}`,
    "g"
  );
  if (u.action === "replace") {
    const replacement = `{n:"${driver}",c:"${u.newCard}",r:"${u.rego}"}`;
    const before = src;
    src = src.replace(dcPattern, replacement);
    if (src !== before) driverEdits++; else driverMisses++;
  } else {
    // DELETE — match the entry PLUS its trailing comma (if any). Using a
    // one-sided comma consumption avoids the "{prev}{next}" bug where both
    // sides' commas get stripped and adjacent entries end up butted.
    // Mid-list: `{prev},{TARGET},{next}` → strip `{TARGET},` → `{prev},{next}` ✓
    // Last entry: `{prev},{TARGET}` → strip `{TARGET}` (no trailing comma to
    //   match) → `{prev},` — the `,]` cleanup below normalises.
    // First entry: `[{TARGET},{next}]` → strip `{TARGET},` → `[{next}]` ✓
    const dcDelPattern = new RegExp(
      `\\{n:"[^"]*",c:"${rx(u.oldCard)}",r:"${rx(u.rego)}"\\},?`,
      "g"
    );
    const before = src;
    src = src.replace(dcDelPattern, "");
    if (src !== before) driverDeletes++;
    else driverMisses++;
  }

  // ── REGO_DB pattern: {"r":"REGO",...,"c":"CARD",...} ──
  // Entries use double-quoted JSON-style keys. Match the whole {...}
  // block, anchored on rego + card pair.
  // Split into two approaches because field order varies:
  //   Case A: `"r":"REGO"` appears BEFORE `"c":"CARD"`
  //   Case B: `"c":"CARD"` appears BEFORE `"r":"REGO"` (rare in our data)
  const findRegoEntry = (rego, card) => {
    const blockPattern = /\{(?:[^{}]|\{[^{}]*\})*\}/g;
    let m;
    while ((m = blockPattern.exec(src)) !== null) {
      const block = m[0];
      if (block.includes(`"r":"${rego}"`) && block.includes(`"c":"${card}"`)) {
        return { block, index: m.index, endIndex: m.index + block.length };
      }
    }
    return null;
  };

  const existing = findRegoEntry(u.rego, u.oldCard);
  if (existing) {
    if (u.action === "replace") {
      let newBlock = existing.block.replace(`"c":"${u.oldCard}"`, `"c":"${u.newCard}"`);
      // Also bump the `dr` field to the admin-provided driver name
      if (driver) {
        if (/"dr":"[^"]*"/.test(newBlock)) {
          newBlock = newBlock.replace(/"dr":"[^"]*"/, `"dr":"${driver}"`);
        } else {
          // Insert before the `c` field if no dr existed
          newBlock = newBlock.replace(`"c":"${u.newCard}"`, `"dr":"${driver}","c":"${u.newCard}"`);
        }
      }
      src = src.slice(0, existing.index) + newBlock + src.slice(existing.endIndex);
      regoEdits++;
    } else {
      // DELETE — remove the `c` field (keep the row's vehicle metadata)
      // Strip ,"c":"..." or "c":"...", depending on position
      let newBlock = existing.block
        .replace(new RegExp(`,"c":"${rx(u.oldCard)}"`), "")
        .replace(new RegExp(`"c":"${rx(u.oldCard)}",`), "");
      src = src.slice(0, existing.index) + newBlock + src.slice(existing.endIndex);
      regoDeletes++;
    }
  } else if (u.action === "replace") {
    // It's OK for the card to only exist in one DB — REGO_DB may simply not
    // have this rego entry (e.g. some regos only live in DRIVER_CARDS).
    // Don't count as a miss.
  }
}

// Cleanup any double-commas or array-start/end commas left by deletes
src = src
  .replace(/,,+/g, ",")
  .replace(/\[,/g, "[")
  .replace(/,\]/g, "]");

const diff = src.length - originalLen;
console.log(`DRIVER_CARDS: ${driverEdits} replaces, ${driverDeletes} deletes, ${driverMisses} misses`);
console.log(`REGO_DB:      ${regoEdits} replaces, ${regoDeletes} deletes, ${regoMisses} misses`);
console.log(`File size:    ${originalLen.toLocaleString()} → ${src.length.toLocaleString()} (${diff >= 0 ? "+" : ""}${diff} bytes)`);

fs.writeFileSync(path, src, "utf8");
console.log(`Wrote ${path}`);
