/* Validation: compare the JS port against the sheet's cached values at the
 * default (all-zero) input state.  Run:  node test/validate.js            */
const path = require("path");
require(path.join(__dirname, "..", "model.js"));
const FM = globalThis.FishModel;
const ref = require(path.join(__dirname, "ref_default.json"));

let pass = 0, fail = 0;
function close(a, b) {
  if (a === b) return true;
  if (typeof a !== "number" || typeof b !== "number") return false;
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));
}
function check(label, got, want) {
  if (want === null || want === undefined || typeof want === "string") return;
  if (close(got, want)) { pass++; }
  else { fail++; console.log(`FAIL ${label}: got ${got}, want ${want}`); }
}

const inputs = FM.defaultInputs();
const h = FM.computeHelpers(inputs);
const r = FM.computeModel(inputs);

// helpers
["AI3","AI5","AI7","AI9","AI11","AI14","AI16","AI18","AI20","AI22",
 "AI25","AI27","AI29","AI31","AJ34","AK34","AL34","AI34"].forEach(k => {
  check(k, h[k], ref[k]);
});

// AU + AY per row (AY via computeAY directly; row 36 blank-gated on default)
const AY_ROWS = [22,23,24,25,26,27,28,29,30,31,32,33,34,35,38,39,40,41,42,43];
AY_ROWS.forEach(row => {
  const u = r.rows.find(x => x.row === row);
  check("AU" + row, u.cost, ref["AU" + row]);
  if (row === 27 || row === 29) return; // exp-only, no AY in ref
  const ay = FM.computeAY(row, inputs, h);
  check("AY" + row, ay, ref["AY" + row]);
});

// AZ scores (only the ones the sheet reports in default / non-exp mode)
[22,23,24,38,39].forEach(row => {
  const u = r.rows.find(x => x.row === row);
  check("AZ" + row, u.score, ref["AZ" + row]);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
