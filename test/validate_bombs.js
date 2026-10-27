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

/* ---- floor data ---------------------------------------------------- */

check("21 dungeon zones", BD.FLOOR_ZONES.length === 21);
check("132 dungeon floors", BD.FLOOR_COUNT === 132);
check("zones cover every floor without gaps", BD.FLOOR_ZONES.every(function (z, i) {
  return i === 0 ? z.startFloor === 1 : z.startFloor === BD.FLOOR_ZONES[i - 1].endFloor + 1;
}));
check("last zone ends at the floor count", BD.FLOOR_ZONES[20].endFloor === BD.FLOOR_COUNT);
check("every zone has an even number of floors", BD.FLOOR_ZONES.every(function (z) {
  return z.floors % 2 === 0 && z.pairs === z.floors / 2;
}));
check("world 1 has 42 floors", BD.FLOOR_ZONES.filter(function (z) { return z.world === 1; })
  .reduce(function (n, z) { return n + z.floors; }, 0) === 42);
check("world 2 has 30 floors", BD.FLOOR_ZONES.filter(function (z) { return z.world === 2; })
  .reduce(function (n, z) { return n + z.floors; }, 0) === 30);
check("world 3 has 30 floors", BD.FLOOR_ZONES.filter(function (z) { return z.world === 3; })
  .reduce(function (n, z) { return n + z.floors; }, 0) === 30);
check("world 4 has 30 floors", BD.FLOOR_ZONES.filter(function (z) { return z.world === 4; })
  .reduce(function (n, z) { return n + z.floors; }, 0) === 30);
check("Stone has four ore pairs", BD.FLOOR_ZONES[0].name === "Stone" && BD.FLOOR_ZONES[0].pairs === 4);
check("Magma has five ore pairs", BD.FLOOR_ZONES[1].name === "Magma" && BD.FLOOR_ZONES[1].pairs === 5);
check("other zones have three ore pairs", BD.FLOOR_ZONES.slice(2).every(function (z) {
  return z.pairs === 3;
}));

var f1 = BD.floorInfo(1);
check("floor 1 is Stone Tin/Copper", f1.floor === 1 && f1.zone === "Stone" && f1.world === 1 &&
  f1.ores[0].bar.name === "Tin" && f1.ores[1].bar.name === "Copper");
check("first floor of a pair is 80/20", f1.firstOfPair === true &&
  close(f1.ores[0].weight, 0.8) && close(f1.ores[1].weight, 0.2));
check("floor 5 pairs Mithril with Adamant", (function () {
  var f = BD.floorInfo(5);
  return f.lowLevel === 3 && f.highLevel === 4 &&
    f.ores[0].bar.name === "Mithril" && f.ores[1].bar.name === "Adamant";
})());
check("floor 5 starts its pair", BD.floorInfo(5).firstOfPair === true &&
  BD.floorInfo(5).pairStartFloor === 5 && BD.floorInfo(5).pairEndFloor === 6);
check("floor 8 is 50/50", (function () {
  var f = BD.floorInfo(8);
  return !f.firstOfPair && close(f.ores[0].weight, 0.5) && close(f.ores[1].weight, 0.5) &&
    f.ores[0].bar.name === "Adamant" && f.ores[1].bar.name === "Runite";
})());
check("floor 9 starts Magma at Runite", (function () {
  var f = BD.floorInfo(9);
  return f.zone === "Magma" && f.lowLevel === 5 && f.ores[0].bar.name === "Runite";
})());
check("floor 129 is Candyland Lollipopite/Mintium", (function () {
  var f = BD.floorInfo(129);
  return f.zone === "Candyland" && f.world === 4 && f.lowLevel === 84 && f.highLevel === 85 &&
    f.ores[0].bar.name === "Lollipopite" && f.ores[1].bar.name === "Mintium";
})());
check("floor 132 ends at Neopolium", (function () {
  var f = BD.floorInfo(132);
  return !f.firstOfPair && f.ores[1].bar.name === "Neopolium" &&
    close(f.ores[0].weight, 0.5) && close(f.ores[1].weight, 0.5);
})());
check("invalid floors return null", BD.floorInfo(0) === null && BD.floorInfo(133) === null &&
  BD.floorInfo(null) === null && BD.floorInfo(-5) === null);
check("floor numbers are floored", BD.floorInfo(5.9).floor === 5);

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

/* ---- portal mix and aggregate floor formulas ---------------------- */

var floor5Info = BD.floorInfo(5);
var mixOff = BD.portalMix(floor5Info, 0, 50);
check("portals off keeps the native weights", close(mixOff.weights[3], 0.8) &&
  close(mixOff.weights[4], 0.2));
check("portals off yields one native ore", close(mixOff.totalYield, 1));
check("portals off keeps two ore levels", mixOff.levels.length === 2);
check("portals off is not applied", mixOff.applied === false);

var mixFull = BD.portalMix(floor5Info, 100, 4);
check("full portals yield the multiplier", close(mixFull.totalYield, 4));
check("full portal Tin weight", close(mixFull.weights[1], 1.2666666666666666));
check("full portal Copper weight", close(mixFull.weights[2], 1.2666666666666666));
check("full portal Mithril weight", close(mixFull.weights[3], 1.2666666666666666));
check("full portal Adamant weight", close(mixFull.weights[4], 0.2));
check("full portals are applied", mixFull.applied === true);

var mixHalf = BD.portalMix(floor5Info, 50, 3);
check("portal yield follows 1 + p(m - 1)", close(mixHalf.totalYield, 2));
check("half portal Tin weight", close(mixHalf.weights[1], 0.475));
check("half portal Copper weight", close(mixHalf.weights[2], 0.475));
check("half portal Mithril weight", close(mixHalf.weights[3], 0.875));
check("half portal Adamant weight", close(mixHalf.weights[4], 0.175));

var mixClamp = BD.portalMix(floor5Info, 150, 0.5);
check("portal chance clamps to 100%", close(mixClamp.chance, 1));
check("portal multiplier floors at 1", mixClamp.multi === 1);
check("1x portals do not add ore", close(mixClamp.totalYield, 1));
check("1x portals are not applied", mixClamp.applied === false);
check("no floor info means no portal mix", BD.portalMix(null, 50, 3) === null);

var floor5 = BD.analyseFloor(mapped.values, 5, 0, 1);
var s5 = 0.8 / BD.effectiveCost(7, mapped.values.barCraftCostMulti) +
  0.2 / BD.effectiveCost(8, mapped.values.barCraftCostMulti);
check("floor 5 aggregate craft units", close(floor5.craftUnitsPerBase, s5));
check("floor 5 aggregate mix cost", close(floor5.mixCost, 1 / s5));
check("floor 5 aggregate yield", close(floor5.totalYield, 1));
check("floor 5 aggregate BoP bars", close(floor5.bopBarsPerBase, barOutput * craft * A * s5));
check("floor 5 aggregate Trans bars", close(floor5.transBarsPerBase,
  barOutput * (284 * T + craft * T * s5)));
check("floor 5 aggregate favours BoP", floor5.winner === "bop");
check("floor 5 mix cost is under the breakpoint", floor5.mixCost < floor5.transition);
check("floor 5 aggregate BoP matches the weighted bar rows", close(floor5.bopBarsPerBase,
  floor5.levels.reduce(function (sum, level) {
    return sum + level.weight * a.rows[level.level - 1].bopPerOre;
  }, 0)));
check("floor 5 aggregate Trans matches the weighted bar rows", close(floor5.transBarsPerBase,
  floor5.levels.reduce(function (sum, level) {
    return sum + level.weight * a.rows[level.level - 1].transPerOre;
  }, 0)));
check("floor 5 native rows cover both ores", floor5.nativeRows.length === 2 &&
  floor5.nativeRows[0].bar.name === "Mithril" && floor5.nativeRows[1].bar.name === "Adamant");
check("floor 5 native winners split by ore", floor5.nativeRows[0].winner === "bop" &&
  floor5.nativeRows[1].winner === "trans");

var floor41 = BD.analyseFloor(mapped.values, 41, 0, 1);
check("floor 41 favours Transmuter", floor41.winner === "trans");
check("floor 41 mix cost is above the breakpoint", floor41.mixCost > floor41.transition);
var floor129 = BD.analyseFloor(mapped.values, 129, 0, 142.2733375);
check("floor 129 favours Transmuter", floor129.winner === "trans");
check("floor 129 native rows use Lollipopite and Mintium",
  floor129.nativeRows[0].bar.name === "Lollipopite" &&
  floor129.nativeRows[1].bar.name === "Mintium");
check("invalid floor analysis returns null", BD.analyseFloor(mapped.values, 0, 0, 1) === null);
check("missing mix returns null", BD.analyseMix(mapped.values, null) === null);

var floor5Portals = BD.analyseFloor(mapped.values, 5, 100, 4);
check("floor 5 full portals add ore", close(floor5Portals.totalYield, 4));
check("floor 5 full portal mix cost", close(floor5Portals.mixCost, 1.5384615384615388));
check("floor 5 full portals still favour BoP", floor5Portals.winner === "bop");

var floor5p50m1 = BD.analyseFloor(mapped.values, 5, 50, 1);
var floor5p50m100 = BD.analyseFloor(mapped.values, 5, 50, 100);
check("portal multiplier moves the effective mix cost",
  Math.abs(floor5p50m1.mixCost - floor5p50m100.mixCost) > 1e-6);
check("portal multiplier cancels at 0%", close(
  BD.analyseFloor(mapped.values, 5, 0, 1).mixCost,
  BD.analyseFloor(mapped.values, 5, 0, 100).mixCost));
check("portal multiplier cancels at 100%", close(
  BD.analyseFloor(mapped.values, 5, 100, 1).mixCost,
  BD.analyseFloor(mapped.values, 5, 100, 100).mixCost));

/* ---- account floor context ---------------------------------------- */

var context = BD.fromAccountContext(stats);
check("sample current floor", context.floor === 129);
check("sample portal chance", context.portalChance === 0);
check("sample portal multiplier", close(context.portalMulti, 142.2733375));

var emptyContext = BD.fromAccountContext({});
check("missing context defaults to floor 1", emptyContext.floor === 1);
check("missing context defaults portals off", emptyContext.portalChance === 0 &&
  emptyContext.portalMulti === 1);

var oddContext = BD.fromAccountContext({
  current_floor: 999,
  void_portal_chance: 150,
  void_portal_multi: 0.5
});
check("context clamps the floor", oddContext.floor === 132);
check("context clamps the portal chance", oddContext.portalChance === 100);
check("context clamps the portal multiplier", oddContext.portalMulti === 1);
check("context parses string values", (function () {
  var c = BD.fromAccountContext({
    current_floor: "5.8",
    void_portal_chance: "12.5",
    void_portal_multi: "3"
  });
  return c.floor === 5 && c.portalChance === 12.5 && c.portalMulti === 3;
})());

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
  "view-bombs", "bomb-level", "bomb-floor", "bomb-ore", "bomb-results", "bomb-level-note",
  "bomb-floor-note", "bomb-mode-bar", "bomb-mode-floor", "bomb-mode-note",
  "bomb-level-field", "bomb-floor-field", "bomb-portal-chance-field",
  "bomb-portal-multi-field", "bomb-portal-chance", "bomb-portal-multi", "bomb-ore-label",
  "bomb-stats", "bomb-stats-details", "bomb-stats-source", "bomb-stats-warning",
  "bomb-reload-account", "bomb-reset-stats", "bomb-table", "bomb-table-summary",
  "bomb-table-title", "bomb-table-lead", "bombs-account-status", "bombs-badge",
  "bombs-account-note"
].forEach(function (id) {
  check("index.html has #" + id, html.indexOf('id="' + id + '"') >= 0);
});
check("bombdata.js is loaded", html.indexOf('src="bombdata.js"') >= 0);
check("bombs.js is loaded", html.indexOf('src="bombs.js"') >= 0);
check("bombdata.js loads before bombs.js",
  html.indexOf('src="bombdata.js"') < html.indexOf('src="bombs.js"'));
check("nav links to the bomb tool", html.indexOf('href="#/bombs" data-nav="bombs"') >= 0);
check("home card links to the bomb tool", html.indexOf('href="#/bombs">Open tool</a>') >= 0);
check("app routes the bomb view", app.indexOf('bombs: "view-bombs"') >= 0);
check("app refreshes the bomb tool after import", app.indexOf("BombTool.refreshAccount") >= 0);
check("app initialises the bomb tool", app.indexOf("BombTool.init") >= 0);

console.log("bars: " + BD.BARS.length + " | breakpoint: " + a.transition.toFixed(4) +
  " effective / " + a.baseTransition.toFixed(4) + " base | BoP through " +
  a.rows[a.lastBopIndex].bar.name + ", Transmuter from " + a.rows[a.firstTransIndex].bar.name);
console.log("floors: " + BD.FLOOR_COUNT + " in " + BD.FLOOR_ZONES.length + " zones | floor 5 mix " +
  floor5.mixCost.toFixed(4) + " vs " + floor5.transition.toFixed(4) + " breakpoint");
console.log(fails === 0 ? "BOMB VALIDATION OK" : fails + " FAILED");
process.exitCode = fails === 0 ? 0 : 1;
