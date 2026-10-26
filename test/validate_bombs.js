// Validates the Bomb of Plenty / Transmuter data, formulas, and page wiring.
require("../bombdata.js");

var fs = require("fs");
var path = require("path");

var BD = globalThis.BombData;

var fails = 0;
function check(name, cond) { if (!cond) { fails++; console.log("FAIL " + name); } }
function close(a, b) { var m = Math.max(1, Math.abs(a), Math.abs(b)); return Math.abs(a - b) / m < 1e-9; }

/* ---- bar data ------------------------------------------------------ */

check("bar data present", !!BD && !!BD.BARS && !!BD.FIELDS);
check("86 known bar levels", BD.BARS.length === 86);
check("level numbers are sequential", BD.BARS.every(function (b, i) { return b.level === i + 1; }));
check("bar costs strictly increase", BD.BARS.every(function (b, i) { return i === 0 || b.cost > BD.BARS[i - 1].cost; }));
check("worlds are non-decreasing", BD.BARS.every(function (b, i) { return i === 0 || b.world >= BD.BARS[i - 1].world; }));
check("world 1 = 26 bars", BD.BARS.filter(function (b) { return b.world === 1; }).length === 26);
check("world 2 = 20 bars", BD.BARS.filter(function (b) { return b.world === 2; }).length === 20);
check("world 3 = 20 bars", BD.BARS.filter(function (b) { return b.world === 3; }).length === 20);
check("world 4 = 20 bars", BD.BARS.filter(function (b) { return b.world === 4; }).length === 20);
check("first bar is Tin at 5", BD.BARS[0].name === "Tin" && BD.BARS[0].cost === 5);
check("last bar is Neopolium at 26.9k", BD.BARS[85].name === "Neopolium" && BD.BARS[85].cost === 26900);
check("barByLevel(1)", BD.barByLevel(1).name === "Tin");
check("barByLevel(86)", BD.barByLevel(86).name === "Neopolium");
check("barByLevel out of range", BD.barByLevel(0) === null && BD.barByLevel(87) === null);

/* ---- fields and defaults ------------------------------------------ */

check("15 stat fields", BD.FIELDS.length === 15);
check("all fields have defaults", BD.FIELDS.every(function (f) {
  return Object.prototype.hasOwnProperty.call(BD.DEFAULTS, f.key);
}));
check("all account keys unique", (function () {
  var seen = {};
  return BD.FIELDS.every(function (f) {
    if (seen[f.stat]) return false;
    seen[f.stat] = true;
    return true;
  });
})());
check("defaults are independent copies", (function () {
  var a = BD.defaults();
  var b = BD.defaults();
  a.bombOfPlentyMulti = 999;
  return b.bombOfPlentyMulti === 1;
})());

/* ---- formula spot checks ------------------------------------------ */

check("toMult at 50% / 2x", close(BD.toMult(50, 2), 1.5));
check("toMult clamps above 100%", close(BD.toMult(150, 3), 3));
check("toMult clamps below 0%", close(BD.toMult(-10, 3), 1));
check("effective cost rounds down", BD.effectiveCost(5, 0.39366) === 1 &&
  BD.effectiveCost(6, 0.39366) === 2 &&
  BD.effectiveCost(7, 0.39366) === 2 &&
  BD.effectiveCost(8, 0.39366) === 3);
check("effective cost is at least 1", BD.effectiveCost(5, 0) === 1);
check("effective cost clamps multiplier above 1", BD.effectiveCost(5, 4) === 5);

/* ---- sample account ------------------------------------------------ */

var raw = fs.readFileSync(path.join(__dirname, "..", "sample.js"), "utf-8");
var json = raw.replace(/^window\.SAMPLE_EXPORT\s*=\s*/, "").replace(/;\s*$/, "");
var stats = JSON.parse(json).stats;
var mapped = BD.fromAccountStats(stats);

check("sample maps all 15 fields", mapped.applied.length === 15 && mapped.missing.length === 0);
check("sample BoP multiplier", mapped.values.bombOfPlentyMulti === 261);
check("sample Transmuter multiplier", mapped.values.bombTransmuterMulti === 284);
check("sample craft cost multiplier", close(mapped.values.barCraftCostMulti, 0.39366));
check("sample bar output multiplier", close(mapped.values.barOutputMulti, 21.568748424327275));
check("sample Trans->BoP chance", mapped.values.transApplyBopChance === 98);

var craft = BD.craftMultiplier(mapped.values);
var A = BD.boppedOre(mapped.values, 1);
var T = BD.boppedOre(mapped.values, 0.98);
var barOutput = Math.max(1, mapped.values.barOutputMulti);
check("sample craft multiplier", close(craft, 35645.99558909091));
check("sample BoP expected ore", close(A, 1129080.7914359018));
check("sample Transmuter expected ore", close(T, 1106583.18755522));

var a = BD.analyse(mapped.values);
check("sample breakpoint", close(a.transition, 2.551788096027201));
check("sample base breakpoint", close(a.baseTransition, 6.482213321209166));
check("sample BoP wins through Mithril", a.lastBopIndex === 2);
check("sample Transmuter wins from Adamant", a.firstTransIndex === 3);
check("sample has no ties", a.tieCount === 0);
check("sample Tin effective cost", a.rows[0].effectiveCost === 1);
check("sample Copper effective cost", a.rows[1].effectiveCost === 2);
check("sample Mithril effective cost", a.rows[2].effectiveCost === 2);
check("sample Adamant effective cost", a.rows[3].effectiveCost === 3);
check("sample Tin favours BoP", a.rows[0].winner === "bop");
check("sample Adamant favours Transmuter", a.rows[3].winner === "trans");
check("sample Tin BoP bars", close(a.rows[0].bopPerOre, barOutput * craft * A));
check("sample Tin Transmuter bars", close(a.rows[0].transPerOre, barOutput * (284 * T + craft * T)));
check("sample Transmuter split adds up", close(a.rows[3].transPerOre,
  a.rows[3].directTransPerOre + a.rows[3].craftedTransPerOre));
check("sample Tin margin", close(a.rows[0].advantage, craft * A / (284 * T + craft * T) - 1));

/* bar output scales the totals but cancels out of the comparison */
var noOutput = BD.analyse(Object.assign({}, mapped.values, { barOutputMulti: 1 }));
check("bar output scales BoP bars", close(a.rows[0].bopPerOre, noOutput.rows[0].bopPerOre * barOutput));
check("bar output scales Transmuter bars", close(a.rows[0].transPerOre, noOutput.rows[0].transPerOre * barOutput));
check("bar output does not move the breakpoint", close(a.transition, noOutput.transition));

/* cost multiplier 1 makes every known bar too expensive for BoP */
var noDiscount = Object.assign({}, mapped.values, { barCraftCostMulti: 1 });
var nd = BD.analyse(noDiscount);
check("no cost reduction: Transmuter wins everywhere", nd.lastBopIndex === -1 && nd.firstTransIndex === 0);
check("no cost reduction: breakpoint stays 2.55 effective", close(nd.transition, a.transition));

/* enormous BoP multiplier flips the whole table when Transmuter does not copy it */
var huge = Object.assign({}, mapped.values, { barCraftCostMulti: 1, bombOfPlentyMulti: 1e12, transApplyBopChance: 0 });
var h = BD.analyse(huge);
check("huge BoP wins everywhere", h.lastBopIndex === 85 && h.firstTransIndex === -1);

/* defaults are the simple calculator fallback: Transmuter always wins */
var d = BD.analyse(BD.defaults());
check("defaults: Transmuter wins everywhere", d.firstTransIndex === 0 && d.lastBopIndex === -1);
check("defaults: one craft multiplier", close(d.craftMultiplier, 1));
check("defaults: one expected ore", close(d.bopOre, 1) && close(d.transOre, 1));

/* missing fields keep defaults and are reported */
var partial = BD.fromAccountStats({ free_craft_chance: 10 });
check("partial mapping keeps present field", partial.values.freeCraftChance === 10);
check("partial mapping reports missing keys", partial.applied.length === 1 && partial.missing.length === 14);
check("partial mapping keeps defaults", partial.values.goldenOreMulti === 5);

/* ---- page wiring --------------------------------------------------- */

var html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf-8");
var app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf-8");
[
  "view-bombs", "bomb-level", "bomb-ore", "bomb-results", "bomb-level-note",
  "bomb-stats", "bomb-stats-details", "bomb-stats-source", "bomb-stats-warning",
  "bomb-reload-account", "bomb-reset-stats", "bomb-table", "bomb-table-summary",
  "bombs-account-status", "bombs-badge", "bombs-account-note"
].forEach(function (id) {
  check("index.html has #" + id, html.indexOf('id="' + id + '"') >= 0);
});
check("bombdata.js is loaded", html.indexOf('src="bombdata.js"') >= 0);
check("bombs.js is loaded", html.indexOf('src="bombs.js"') >= 0);
check("nav links to the bomb tool", html.indexOf('href="#/bombs" data-nav="bombs"') >= 0);
check("home card links to the bomb tool", html.indexOf('href="#/bombs">Open tool</a>') >= 0);
check("app routes the bomb view", app.indexOf('bombs: "view-bombs"') >= 0);
check("app refreshes the bomb tool after import", app.indexOf("BombTool.refreshAccount") >= 0);
check("app initialises the bomb tool", app.indexOf("BombTool.init") >= 0);

console.log("bars: " + BD.BARS.length + " | breakpoint: " + a.transition.toFixed(4) +
  " effective / " + a.baseTransition.toFixed(4) + " base | BoP through " +
  a.rows[a.lastBopIndex].bar.name + ", Transmuter from " + a.rows[a.firstTransIndex].bar.name);
console.log(fails === 0 ? "BOMB VALIDATION OK" : fails + " FAILED");
process.exitCode = fails === 0 ? 0 : 1;
