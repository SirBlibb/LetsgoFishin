// Validates fishcosts.js (data shape + spot values) and the fish-purchased
// upgrade ranking produced by model.js (gating, weighted cost, ordering).
require("../model.js");
require("../data.js");
require("../fishcosts.js");

var FM = globalThis.FishModel;
var FD = globalThis.FISH_DATA;
var UI = globalThis.UI_SPEC;

var fails = 0;
function check(name, cond) { if (!cond) { fails++; console.log("FAIL " + name); } }
function close(a, b) { var m = Math.max(1, Math.abs(a), Math.abs(b)); return Math.abs(a - b) / m < 1e-9; }
function rowOf(rows, row) { var hit = null; rows.forEach(function (r) { if (r.row === row) hit = r; }); return hit; }
function rankables(rows) { return rows.filter(function (r) { return r.rankable; }); }

/* ---- data shape ---------------------------------------------------- */

check("FISH_DATA present", !!FD && !!FD.power && !!FD.upgrades);
check("18 fish upgrades", FD.upgrades.length === 18);

var seen = {};
FD.upgrades.forEach(function (up) {
  check("row " + up.row + " unique", !seen[up.row]); seen[up.row] = true;
  check("row " + up.row + " costs match max", up.costs.length === up.max);
  up.costs.forEach(function (c, i) {
    check("row " + up.row + " lvl " + (i + 1) + " shape",
      Array.isArray(c) && typeof c[0] === "number" && c[0] > 0 && typeof FD.power[c[1]] === "number");
  });
});
check("rows 3-20 covered", [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
  .every(function (r) { return seen[r]; }));
check("all power ratings positive", Object.keys(FD.power).every(function (k) { return FD.power[k] > 0; }));

/* names/maxes must match the UI input spec so the two stay in sync */
UI.UPGRADE_INPUTS.forEach(function (u) {
  var up = null;
  FD.upgrades.forEach(function (f) { if (f.row === u.row) up = f; });
  check("UI spec row " + u.row + " present in FISH_DATA", !!up);
  if (up) {
    check("UI spec row " + u.row + " name matches", up.name === u.label);
    check("UI spec row " + u.row + " max matches", up.max === u.max);
  }
});

/* spot-check the transcription against the wiki */
var rodData = null, boatData = null, t2boatData = null;
FD.upgrades.forEach(function (u) {
  if (u.row === 3) rodData = u;
  if (u.row === 5) boatData = u;
  if (u.row === 15) t2boatData = u;
});
check("rod L1 cost", rodData.costs[0][0] === 10 && rodData.costs[0][1] === "Guppy");
check("rod L50 cost", rodData.costs[49][0] === 254000 && rodData.costs[49][1] === "Wastefish");
check("rod L51 cost (rounded)", rodData.costs[50][0] === 1560000 && rodData.costs[50][1] === "Sturgem");
check("rod L60 cost (rounded)", rodData.costs[59][0] === 10000000 && rodData.costs[59][1] === "Galaxia Whale");
check("boat L5 cost", boatData.costs[4][0] === 1215 && boatData.costs[4][1] === "Wastefish");
check("tier 2 boat L1 cost", t2boatData.costs[0][0] === 2000000 && t2boatData.costs[0][1] === "Wreckshell Pilferer");
check("tier 2 boat L5 cost", t2boatData.costs[4][0] === 10100000 && t2boatData.costs[4][1] === "Planetary Jellyfish");

/* ---- default state -------------------------------------------------- */

var m = FM.computeFishModel(FM.defaultInputs());
check("default: 18 fish rows", m.rows.length === 18);

var rod = rowOf(m.rows, 3);
check("rod next cost", rod.count === 10 && rod.fish === "Guppy");
check("rod weighted cost", rod.effort === 1000);
check("rod rankable", rod.rankable);
check("rod score matches formula", close(rod.score, (rod.newFishTime - m.base) / 1000));
check("rod growth", close(rod.growth, rod.newFishTime / m.base - 1));

var boat = rowOf(m.rows, 5);
check("boat is shown as gate purchase", !boat.rankable && /no direct/i.test(boat.blocked || ""));

var tick = rowOf(m.rows, 6);
check("tick gated by boat", !tick.rankable && /Upgrade Boat/.test(tick.blocked || ""));

var ssc = rowOf(m.rows, 18);
check("row 18 gated by tier 2 boat", !ssc.rankable && /Tier 2 Boat/.test(ssc.blocked || ""));

var def = rankables(m.rows);
check("default rankable rows are rod + drone", def.length === 2 &&
  def[0].row === 3 && def[1].row === 4);
var defRanks = def.map(function (r) { return r.rank; }).sort();
check("default ranks assigned", defRanks[0] === 1 && defRanks[1] === 2);

/* ---- synthetic mid-game state --------------------------------------- */

var inp = FM.defaultInputs();
inp.G[3] = 10; inp.G[4] = 5; inp.G[5] = 5; inp.G[15] = 5; inp.G[16] = 2; inp.G[18] = 7;

var m2 = FM.computeFishModel(inp);
check("row 6 rankable after boat", rowOf(m2.rows, 6).rankable);

var shm = rowOf(m2.rows, 16);
check("row 16 next cost", shm.count === 309000 && shm.fish === "Conductive Eel");
check("row 16 weighted cost", shm.effort === 309000 * 80060);
// No super shiny chance / no tier 2 dock in this state: these upgrades
// provably cannot change income, so they must not be ranked.
check("row 16 inert without shiny chance", !shm.rankable && /no direct/i.test(shm.blocked || ""));
check("row 17 inert on tier 1 dock", !rowOf(m2.rows, 17).rankable);

var ssc2 = rowOf(m2.rows, 18);
check("row 18 next cost at 7", ssc2.count === 1700000 && ssc2.fish === "Lunar Sunfish");

/* shiny + tier 2 dock state: rows 16-18 become meaningful */
var inp3 = FM.defaultInputs();
inp3.dock = "Galaxy";
inp3.C[17] = true; // Dr Cool skin -> shiny chance above zero
inp3.G[3] = 10; inp3.G[4] = 5; inp3.G[5] = 5; inp3.G[15] = 5;
inp3.G[16] = 2; inp3.G[17] = 3; inp3.G[18] = 7;

var m5 = FM.computeFishModel(inp3);
check("row 16 rankable with shiny chance", rowOf(m5.rows, 16).rankable);
check("row 17 rankable on tier 2 dock", rowOf(m5.rows, 17).rankable);
check("row 18 rankable with shiny chance", rowOf(m5.rows, 18).rankable);

var ranked = rankables(m5.rows).sort(function (a, b) { return a.rank - b.rank; });
check("ranks sequential 1..n", ranked.every(function (r, i) { return r.rank === i + 1; }));
check("scores non-increasing with rank", ranked.every(function (r, i) {
  return i === 0 || ranked[i - 1].score >= r.score;
}));

/* computeModel (the app path) carries the fish rows too */
var full = FM.computeModel(inp);
check("computeModel includes fishRows", full.fishRows && full.fishRows.length === 18);

/* ---- maxed + graceful degradation ----------------------------------- */

inp.G[3] = 60;
var m3 = FM.computeFishModel(inp);
check("rod maxed", !rowOf(m3.rows, 3).rankable && rowOf(m3.rows, 3).blocked === "Maxed");

delete globalThis.FISH_DATA;
var m4 = FM.computeFishModel(FM.defaultInputs());
check("graceful without FISH_DATA", m4.rows.length === 0);

console.log(fails === 0 ? "FISH VALIDATION OK" : fails + " FAILED");
process.exitCode = fails === 0 ? 0 : 1;
