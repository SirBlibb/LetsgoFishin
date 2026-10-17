require("../model.js");
require("../fishcosts.js");
require("../exportstats.js");

var fs = require("fs");
var path = require("path");

var fm = globalThis.FishModel;
var es = globalThis.ExportStats;

var raw = fs.readFileSync(path.join(__dirname, "..", "sample.js"), "utf-8");
var json = raw.replace(/^window\.SAMPLE_EXPORT\s*=\s*/, "").replace(/;\s*$/, "");

var parsed = es.parseExport(json);
var base = fm.defaultInputs();
var res = es.apply(parsed.stats, base);

var fails = 0;
function check(name, cond) {
  if (!cond) { fails++; console.log("FAIL " + name); }
}

check("version", parsed.version === "v2.2.20");
check("G3", res.inputs.G[3] === 60);
check("G22", res.inputs.G[22] === 100);
check("G38 (skill 42)", res.inputs.G[38] === 3);
check("G39 (skill 44)", res.inputs.G[39] === 3);
check("G40 (skill 43)", res.inputs.G[40] === 3);
check("G41 (skill 45)", res.inputs.G[41] === 3);
check("G42 (skill 51)", res.inputs.G[42] === 3);
check("G43 (skill 52)", res.inputs.G[43] === 3);
check("t1 Lake card1", res.inputs.cards.Lake.t1[0] === 4);
check("legendary Lake (AE)", res.inputs.cards.Lake.ae === 4);
check("tribute Abyss (AF)", res.inputs.cards.Abyss.af === 3);
check("C32 abyss tribute>=2", res.inputs.C[32] === true);
check("C16 Mr Nibbles", res.inputs.C[16] === 25);
check("C17 Dr Cool", res.inputs.C[17] === true);
check("C18 Mr Nibbles quest", res.inputs.C[18] === 10);
check("C27 Astraeus", res.inputs.C[27] === 1050);
check("C28 Poseidon", res.inputs.C[28] === 20);
check("C29 Tethys", res.inputs.C[29] === 830);
check("C30 Ares", res.inputs.C[30] === 1462);
check("C25 black hole", res.inputs.C[25] === true);

var model = fm.computeModel(res.inputs);
check("AI34 finite", isFinite(model.base) && model.base > 0);
check("rows length", model.rows.length === 21);
check("fish rows length", model.fishRows.length === 18);
check("sample is maxed on all fish upgrades",
  model.fishRows.every(function (r) { return !r.rankable && r.blocked === "Maxed"; }));

console.log("applied: " + res.applied.length);
console.log("missing: " + res.missing.length + (res.missing.length ? " (" + res.missing.join(", ") + ")" : ""));
console.log((fails === 0 ? "ALL OK" : fails + " FAILED") + " | AI34=" + model.base.toFixed(6) + " | best=" + model.rows[0].name);
process.exitCode = fails === 0 ? 0 : 1;
