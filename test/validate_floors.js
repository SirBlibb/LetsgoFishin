// Validates the Best Floor to Farm maths against the cached values of the
// "IOM - Best Floor To Farm V3.4.2" sheet, plus unit checks and page wiring.
//
//   test/ref_floors_default.json  sheet with no JSON loaded (manual defaults)
//   test/ref_floors_sample.json   sheet with a v2.2.52 ExportStats export loaded
//
// Both are produced by tools/extract_floor_sheet.py.
require("../floortables.js");
require("../floordata.js");
require("../exportstats.js");

var fs = require("fs");
var path = require("path");

var FD = globalThis.FloorData;
var ES = globalThis.ExportStats;

var fails = 0;
function check(name, cond) { if (!cond) { fails++; console.log("FAIL " + name); } }
function close(a, b, tol) {
  var m = Math.max(1, Math.abs(a), Math.abs(b));
  return Math.abs(a - b) / m < (tol || 1e-9);
}
// The sheet's xlsx export rounds huge cached numbers to ~6 significant digits
// (9672190000000000 for 9672193963157644), so compare those loosely.
function tolFor(theirs) { return Math.abs(theirs) >= 1e12 ? 1e-5 : 1e-8; }
function ref(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, name), "utf-8"));
}
function fixtureExport() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "export_2.2.52.json"), "utf-8"));
}

/* ---- static tables -------------------------------------------------- */

check("sheet version", FD.SHEET.version === "V3.4.2" && FD.SHEET.gameVersion === "V2.2.52");
check("86 ores", FD.ORES.length === 86);
check("ore levels sequential", FD.ORES.every(function (o, i) { return o.level === i + 1; }));
check("ore worlds 26/20/20/20", [1, 2, 3, 4].map(function (w) {
  return FD.ORES.filter(function (o) { return o.world === w; }).length;
}).join() === "26,20,20,20");
check("21 veins", FD.VEINS.length === 21);
check("veins tile floors 1-132 without gaps", FD.VEINS[0].firstFloor === 1 && FD.VEINS[20].lastFloor === 132 &&
  FD.VEINS.every(function (v, i) { return i === 0 || v.firstFloor > FD.VEINS[i - 1].lastFloor; }));
check("vein ore ranges stay inside 1-86", FD.VEINS.every(function (v) { return v.firstOre >= 1 && v.lastOre <= 86 && v.firstOre <= v.lastOre; }));
check("23 floor modifier ranges", FD.MODS.length === 23);
check("132 floors", FD.FLOORS.length === 132);
check("every vein has an image file", FD.VEINS.every(function (v) {
  return fs.existsSync(path.join(__dirname, "..", v.image));
}));

/* ---- unit checks ---------------------------------------------------- */

check("parseHealth plain", FD.parseHealth("10") === 10);
check("parseHealth k", close(FD.parseHealth("14.59k"), 14590));
check("parseHealth m", close(FD.parseHealth("1.42m"), 1.42e6));
check("parseHealth qi", close(FD.parseHealth("1.90qi"), 1.9e18));
check("parseHealth oc", close(FD.parseHealth("3.88oc"), 3.88e27));
check("parseHealth dc", close(FD.parseHealth("1.05dc"), 1.05e33));
check("parseHealth udc", close(FD.parseHealth("1.61udc"), 1.61e36));
check("parseHealth ddc", close(FD.parseHealth("220ddc"), 2.2e41));
check("parseHealth matches sheet column AX", FD.ORES.every(function (o) {
  return close(FD.parseHealth(o.healthText), o.health, 1e-6);
}));
check("compareVersion equal ignoring case", FD.compareVersion("v2.2.52", "V2.2.52") === 0);
check("compareVersion older", FD.compareVersion("v2.2.20", "V2.2.52") === -1);
check("compareVersion numeric not text", FD.compareVersion("v2.2.9", "v2.2.10") === -1);
check("compareVersion newer", FD.compareVersion("v2.3.0", "v2.2.52") === 1);
check("W4 speed by quests", [0, 1, 4, 7, 12, 15, 23, 30].map(FD.w4SpeedFromQuests).join() === "0.8,0.7,0.6,0.5,0.4,0.3,0.2,0.2");
check("ore pairs match the sheet formula", FD.FLOORS[0].oreA === 1 && FD.FLOORS[11].oreA === 6 + 0 && FD.FLOORS[131].oreB === 86);
check("floor 1 shares 80/20, floor 2 50/50", FD.FLOORS[0].shareA === 0.8 && FD.FLOORS[1].shareA === 0.5);
check("floors 69-72 golden 0.5", FD.FLOORS[68].mods.goldenFloor === 0.5 && FD.FLOORS[71].mods.goldenFloor === 0.5 && FD.FLOORS[72].mods.goldenFloor === null);
check("floor 102 stacks golden 0.4 + rainbow 0.4", FD.FLOORS[101].mods.goldenFloor === 0.4 && close(FD.FLOORS[101].mods.rainbowX, 0.4));
check("floor 71 speed 0.75 and negative", close(FD.FLOORS[70].mods.speedX, 0.75) && FD.FLOORS[70].negative === true);
check("speed alone is not a negative modifier", FD.FLOORS[96].mods.speedX === 0.75 && FD.FLOORS[96].negative === false);
check("floor 124 prismatic -0.15", close(FD.FLOORS[123].mods.prismaticDelta, -0.15));
check("floor 104 portal 0.4", close(FD.FLOORS[103].mods.portalX, 0.4));

/* ---- golden values from the sheet ----------------------------------- */

function checkFloors(label, env, ore, r) {
  var res = FD.evaluateOre(env, { ore: ore });
  var F = r.floors;
  var bad = [];
  function cmp(cell, mine, theirs) {
    if (theirs === undefined || theirs === null) return;
    if (typeof theirs === "number") {
      if (typeof mine !== "number" || !close(mine, theirs, tolFor(theirs))) bad.push(cell + " " + mine + " vs " + theirs);
    } else if (mine !== theirs) bad.push(cell + " " + mine + " vs " + theirs);
  }
  res.rows.forEach(function (row) {
    var n = row.floor + 1;
    cmp("B" + n, row.world, F["B" + n]);
    cmp("C" + n, row.oreA, F["C" + n]);
    cmp("D" + n, row.oreB, F["D" + n]);
    cmp("E" + n, row.shareA, F["E" + n]);
    cmp("F" + n, row.shareB, F["F" + n]);
    cmp("I" + n, row.mods.goldenFloor === null ? undefined : row.mods.goldenFloor, F["I" + n]);
    cmp("J" + n, row.mods.rainbowX, F["J" + n]);
    cmp("K" + n, row.mods.goldenOreX, F["K" + n]);
    cmp("L" + n, row.mods.prismaticDelta, F["L" + n]);
    cmp("M" + n, row.mods.portalX, F["M" + n]);
    cmp("N" + n, row.mods.speedX, F["N" + n]);
    cmp("O" + n, row.negative ? "Negative" : undefined, F["O" + n]);
    cmp("P" + n, row.P, F["P" + n]);
    cmp("Q" + n, row.Q, F["Q" + n]);
    cmp("R" + n, row.R, F["R" + n]);
    cmp("S" + n, row.S, F["S" + n]);
    cmp("T" + n, row.T, F["T" + n]);
    cmp("U" + n, row.U, F["U" + n]);
    cmp("V" + n, row.V, F["V" + n]);
  });
  check(label + ": 132 floor rows match Floors!B:V (" + bad.slice(0, 3).join("; ") + ")", bad.length === 0);

  // Floors!W only where the sheet's own AY cells are real booleans
  var wBad = 0, wChecked = 0;
  res.rows.forEach(function (row) {
    var ay = r.floorsOres;
    var a = ay["AY" + (row.oreA + 1)], b = ay["AY" + (row.oreB + 1)];
    if (typeof a === "boolean" && typeof b === "boolean" && typeof F["W" + (row.floor + 1)] === "boolean") {
      wChecked++;
      if ((a && b) !== row.oneShot) wBad++;
    }
  });
  check(label + ": floor one-shot flags match where the sheet has them (" + wChecked + ")", wBad === 0);

  check(label + ": Floors!Y3 raw portal chance", close(env.portal.rawChance, F.Y3));
  check(label + ": Floors!Y4 portal value per rock", close(res.portal.valuePerRock, F.Y4));
  check(label + ": Floors!Y5 raw prismatic", close(env.prismaticRaw, F.Y5));
  return res;
}

function checkBestOre(label, env, res, r) {
  var B = r.bestOre;
  var mix = res.mix, pm = res.portal.rows;
  function c(cell, mine) {
    var theirs = B[cell];
    if (theirs === undefined) return;
    check(label + ": Best Ore!" + cell + " (" + mine + " vs " + theirs + ")",
      typeof theirs === "number" ? close(mine, theirs, tolFor(theirs)) : mine === theirs);
  }
  c("V5", env.goldenFloor.c); c("V6", env.goldenFloor.m); c("V7", env.rainbowFloor.c); c("V8", env.rainbowFloor.m);
  c("V9", env.galacticFloor.c); c("V10", env.galacticFloor.m); c("V11", env.prismaticFloor.c); c("V12", env.prismaticFloor.m);
  c("V13", env.goldenOre.c); c("V14", env.goldenOre.m); c("V15", env.rainbowOre.c); c("V16", env.rainbowOre.m);
  c("V17", env.oreIncome); c("V18", env.oresPerScreen); c("V19", env.portal.chance); c("V20", env.portal.normalMulti);
  c("V21", env.portal.golden.c); c("V22", env.portal.golden.m); c("V23", env.portal.rainbow.c); c("V24", env.portal.rainbow.m);
  c("V25", env.portal.galactic.c); c("V26", env.portal.galactic.m); c("V27", env.portal.baseMulti);
  c("V28", env.baseSpeed); c("V29", env.w3Fix); c("V30", env.w4Mod); c("V31", env.world);
  for (var i = 0; i < 8; i++) { c("AA" + (4 + i), mix[i].p); c("AB" + (4 + i), mix[i].m); }
  c("AA15", pm[0].p); c("AB15", pm[0].m); c("AA17", pm[1].p); c("AB17", pm[1].m);
  c("AA19", pm[2].p); c("AB19", pm[2].m); c("AA21", pm[3].p); c("AB21", pm[3].m);
  c("AA23", pm[4].p); c("AB23", pm[4].m); c("AB25", res.portal.average);
  c("AB27", res.oreMultis.golden); c("AB28", res.oreMultis.rainbow);
  c("AB30", res.oreMultis.goldenSteak); c("AB31", res.oreMultis.rainbowSteak);
  c("X34", res.perfect.base);
  if (res.perfect.void !== null) c("X35", res.perfect.void);
  // best floor without the Void Drone (2 rows) and with it (20 rows)
  res.noVoid.forEach(function (e, i) { c("AA" + (38 + i), e.floor); c("X" + (38 + i), e.raw); c("AB" + (38 + i), e.value); });
  res.withVoid.forEach(function (e, i) { c("AA" + (42 + i), e.floor); c("X" + (42 + i), e.raw); c("AB" + (42 + i), e.value); });
  c("E11", res.autoVoid);
  // the ranking panel B20:E39
  res.ranking.forEach(function (e, i) {
    c("C" + (20 + i), e.floor); c("D" + (20 + i), e.value);
    if (e.pctVsNext !== null) c("E" + (20 + i), e.pctVsNext);
  });
  check(label + ": ranking has no extra rows beyond the sheet's",
    B["C" + (20 + res.ranking.length)] === undefined || B["C" + (20 + res.ranking.length)] === "");
  if (env.jsonLoaded) {
    var adv = res.bombAdvice;
    check(label + ": E13 bomb advice", ("Use " + adv.bomb) === B.E13);
    c("Y69", adv.craft); c("Y70", adv.bopValue); c("Y71", adv.transValue); c("V36", adv.barCost);
    check(label + ": G11 first reminder",
      res.reminders.length > 0 && res.reminders[0].text === B.G11);
    check(label + ": G4 'no warnings' agrees", (res.warnings.length === 0) === (B.G4 === "There are no warnings :)"));
  }
}

function checkBestVeins(label, env, res, r) {
  var B = r.bestVeins;
  function c(cell, mine) {
    var theirs = B[cell];
    if (theirs === undefined) return;
    check(label + ": Best Veins!" + cell + " (" + mine + " vs " + theirs + ")",
      typeof theirs === "number" ? close(mine, theirs, tolFor(theirs)) : mine === theirs);
  }
  c("V61", res.veinsPerScreen); c("V62", res.variantMulti); c("V67", res.portal.averageWhenFired);
  c("AB14", res.portal.average);
  c("AA17", res.bestWithVoid); c("AA18", res.bestWithoutVoid); c("AA19", res.perfect.base); c("AA20", res.perfect.used);
  c("E11", res.autoVoid); c("E26", res.incomePerHour === null ? "" : res.incomePerHour);
  res.groups.forEach(function (g, i) { c("AA" + (23 + i), g.value); c("AB" + (23 + i), g.label); });
  var bad = [];
  res.rows.forEach(function (row) {
    var n = row.floor + 1;
    [["AE", row.AE], ["AF", row.AF], ["AG", row.AG], ["AH", row.AH], ["AI", row.AI], ["AJ", row.AJ], ["AK", row.AK]].forEach(function (p) {
      var theirs = B[p[0] + n];
      if (typeof theirs === "number" && !close(p[1], theirs, 1e-8)) bad.push(p[0] + n + " " + p[1] + " vs " + theirs);
    });
  });
  check(label + ": AD:AK helper table matches (" + bad.slice(0, 3).join("; ") + ")", bad.length === 0);
  res.groups.forEach(function (g, i) {
    if (g.pctVsNext !== null && B["E" + (20 + i)] !== undefined) c("E" + (20 + i), g.pctVsNext);
  });
}

// --- sheet with the v2.2.52 export loaded
(function () {
  var r = ref("ref_floors_sample.json");
  var ex = fixtureExport();
  var env = FD.fromExport(ex.stats, ex.version);
  var res = checkFloors("loaded", env, "Tin", r);
  checkBestOre("loaded", env, res, r);
  var vres = FD.evaluateVein(env, { vein: "Stone Vein" });
  checkBestVeins("loaded", env, vres, r);

  // one-shot flags agree with every real boolean in Floors!AY
  var bad = 0, seen = 0;
  FD.ORES.forEach(function (o) {
    var theirs = r.floorsOres["AY" + (o.level + 1)];
    if (typeof theirs === "boolean") { seen++; if (FD.oneShot(env, o) !== theirs) bad++; }
  });
  check("loaded: Floors!AY one-shot flags (" + seen + " real booleans)", bad === 0 && seen > 40);
  // where the sheet shows #VALUE! no tier of bomb is enough; we report that honestly
  var errored = FD.ORES.filter(function (o) { return typeof r.floorsOres["AY" + (o.level + 1)] === "string"; });
  check("loaded: sheet errors only where the ore can't be killed", errored.length > 0 && errored.every(function (o) {
    return FD.oneShot(env, o) === false;
  }));
  check("loaded: Guardium (reduction 0.85) not one-shottable", FD.oneShot(env, FD.ORES[54]) === false);
  check("loaded: Lapis needs Super crit (85% < 100%)", FD.oneShot(env, FD.ORES[26]) === false);
  check("loaded: Neopolium (World 4) beyond the bomb", FD.oneShot(env, FD.ORES[85]) === false);
  check("loaded: Tin one-shot", FD.oneShot(env, FD.ORES[0]) === true);

  // version handling: the export is exactly the tested version
  check("loaded: no version warnings", res.warnings.every(function (w) { return w.code.indexOf("json-") !== 0; }));
  check("loaded: floor 102 export triggers the modifier-floor reminder", res.reminders[0].code === "exported-on-modifier-floor");
  check("loaded: Void Drone owned, equipped, fueled -> no drone reminders",
    res.reminders.every(function (x) { return x.code.indexOf("void-") !== 0; }));
  var old = FD.fromExport(ex.stats, "v2.2.20");
  check("older export warns", FD.evaluateOre(old, { ore: "Tin" }).warnings[0].code === "json-outdated");
  var newer = FD.fromExport(ex.stats, "v2.3.0");
  check("newer export warns", FD.evaluateOre(newer, { ore: "Tin" }).warnings.some(function (w) { return w.code === "json-newer"; }));
})();

// --- sheet in manual mode with every green cell at its default
(function () {
  var r = ref("ref_floors_default.json");
  var env = FD.fromManual(FD.defaultManual());
  var res = checkFloors("default", env, "Tin", r);
  checkBestOre("default", env, res, r);
  var vres = FD.evaluateVein(env, { vein: "Stone Vein" });
  checkBestVeins("default", env, vres, r);
  check("default: manual mode has no bomb advice", res.bombAdvice === null);
  check("default: manual mode skips one-shot checks", res.oneShotSelected === null && res.rows.every(function (x) { return x.oneShot; }));
})();

/* ---- behaviour the fixtures cannot reach ---------------------------- */

(function () {
  var ex = fixtureExport();
  var env = FD.fromExport(ex.stats, ex.version);

  // ore choice moves the answer; shares of a floor sum to <= 1
  var tin = FD.evaluateOre(env, { ore: "Tin" }), lapis = FD.evaluateOre(env, { ore: "Lapis" });
  check("different ores rank different floors", tin.ranking[0].floor !== lapis.ranking[0].floor);
  check("selecting by level equals by name", FD.evaluateOre(env, { ore: 27 }).ranking[0].floor === lapis.ranking[0].floor);
  check("no ore selected -> empty ranking + warning", (function () {
    var r = FD.evaluateOre(env, {});
    return r.ranking.length === 0 && r.warnings.some(function (w) { return w.code === "no-ore"; });
  })());
  check("unknown ore name behaves as none", FD.evaluateOre(env, { ore: "Nope" }).level === 0);

  // portal probabilities add up to the chance
  var pm = tin.portal.rows;
  check("portal mix sums to 1", close(pm.reduce(function (a, x) { return a + x.p; }, 0), 1));

  // no portal chance: void value equals base value
  var noPortal = FD.fromExport(Object.assign({}, ex.stats, { void_portal_chance: 0 }), ex.version);
  var np = FD.evaluateOre(noPortal, { ore: "Tin" });
  check("zero portal chance: V == U", np.rows.every(function (x) { return close(x.U, x.V); }));
  check("zero portal chance with Void Drone owned still says Yes", np.autoVoid === "Yes");
  check("zero portal chance: JSON void multi is 0", noPortal.portal.normalMulti === 0);

  // portal chance is capped at 1 on 0.4x floors
  var strong = FD.fromExport(Object.assign({}, ex.stats, { void_portal_chance: 400 }), ex.version);
  check("raw chance kept above 1", strong.portal.chance === 1 && close(strong.portal.rawChance, 4));
  var sr = FD.evaluateOre(strong, { ore: "Tin" });
  check("0.4x floor: effective chance min(0.4*4,1)", close(sr.rows[103].R, 1) && close(sr.rows[103].R * strong.portal.chance, 1));
  check("0.4x floor: 400% -> still full ratio, 100% -> 0.4", close(FD.voidRatio(FD.fromExport(Object.assign({}, ex.stats, { void_portal_chance: 100 }), ex.version), FD.FLOORS[103]), 0.4));

  // fuel off -> multiplier is 1 instead of the export's multi
  var unfuel = FD.fromExport(Object.assign({}, ex.stats, { is_drone_void_equipped_and_fueled: false }), ex.version);
  check("unfueled Void Drone multi = 1", unfuel.portal.normalMulti === 1);
  var rem = FD.evaluateOre(unfuel, { ore: "Tin" }).reminders.map(function (x) { return x.code; });
  check("unfueled reminder", rem.indexOf("void-not-fueled") >= 0);
  var unequip = FD.fromExport(Object.assign({}, ex.stats, { is_drone_void_equipped: false, is_drone_void_equipped_and_fueled: false }), ex.version);
  check("unequipped reminder", FD.evaluateOre(unequip, { ore: "Tin" }).reminders.some(function (x) { return x.code === "void-not-equipped"; }));

  // override
  var auto = FD.evaluateOre(env, { ore: "Tin" });
  var off = FD.evaluateOre(env, { ore: "Tin", voidMode: "off" });
  var on = FD.evaluateOre(env, { ore: "Tin", voidMode: "on" });
  check("auto picks the void list here", auto.autoVoid === "Yes" && auto.useVoid && auto.ranking.length === 20);
  check("override off shows the no-void list", off.useVoid === false && off.ranking.length === 2 && off.autoVoid === "Yes");
  check("override on shows the void list", on.useVoid === true && on.ranking.length === 20);
  check("override does not change the sheet's own advice", off.autoVoid === auto.autoVoid);

  // W4 toggle widens the cap for World 1-3 ores only when unlocked
  var w4env = FD.fromExport(Object.assign({}, ex.stats, { worlds_unlocked: 4 }), ex.version);
  var capOff = FD.evaluateOre(w4env, { ore: "Tin" });
  var capOn = FD.evaluateOre(w4env, { ore: "Tin", showW4: true });
  check("cap 102 for World 1-3 ores", capOff.cap === 102 && capOn.cap === 132);
  check("World 4 ores always see 132", FD.evaluateOre(w4env, { ore: "Chronite" }).cap === 132);
  check("cap respects unlocked worlds", FD.evaluateOre(env, { ore: "Tin", showW4: true }).cap === 102);

  // ranking ties and ordering
  var vals = auto.ranking.map(function (x) { return x.raw; });
  check("ranking is sorted by value", vals.every(function (v, i) { return i === 0 || vals[i - 1] >= v; }));
  check("pct vs next of last row is null", auto.ranking[19].pctVsNext === null);
  check("pct vs next chain", close(auto.ranking[0].pctVsNext, auto.ranking[0].value / auto.ranking[1].value - 1));

  // pickers
  var oo = FD.oreOptions(env), vo = FD.veinOptions(env);
  check("ore dropdown locks World 4 for a World 3 account", oo[66].locked && !oo[65].locked && oo[85].locked);
  check("vein dropdown locks World 4 veins", vo[16].locked && !vo[15].locked);
  check("unresearched veins flagged (researched 16)", vo[15].unresearched === false && vo[16].unresearched === true);

  // veins
  var stone = FD.evaluateVein(env, { vein: "Stone Vein" });
  var pirate = FD.evaluateVein(env, { vein: "Pirate Vein" });
  check("locked vein warns", pirate.warnings.some(function (w) { return w.code === "vein-world-locked"; }) && pirate.groups.length === 0);
  var neon = FD.evaluateVein(env, { vein: "Neon Vein" });
  check("researched World 3 vein ranks floors 97-102", neon.groups.length > 0 && neon.groups[0].floors.every(function (f) { return f >= 97 && f <= 102; }));
  var w4unlocked = FD.fromExport(Object.assign({}, ex.stats, { worlds_unlocked: 4, vein_researched_array: 17 }), ex.version);
  var wonder = FD.evaluateVein(w4unlocked, { vein: "Wonderland Vein" });
  check("World 4 vein is not capped at 102", wonder.cap === 132 && wonder.groups.length > 0 && wonder.groups[0].floors.every(function (f) { return f >= 103 && f <= 108; }));
  var unres = FD.evaluateVein(FD.fromExport(Object.assign({}, ex.stats, { vein_researched_array: 3 }), ex.version), { vein: "Cloud Vein" });
  check("unresearched vein: zero veins and warning", unres.veinsPerScreen === 0 && unres.groups.length === 0 &&
    unres.warnings.some(function (w) { return w.code === "vein-not-researched"; }));
  var no2x = FD.evaluateVein(FD.fromExport(Object.assign({}, ex.stats, { vein_2x_spawn_array: 0 }), ex.version), { vein: "Stone Vein" });
  check("2x research doubles the spawn rate (capped at a screen)", close(stone.veinsPerScreen, 2 * ex.stats.vein_spawn_rate_multi / 15) &&
    close(no2x.veinsPerScreen, ex.stats.vein_spawn_rate_multi / 15));
  var morph = FD.evaluateVein(env, { vein: "Stone Vein", morph: 1 });
  check("Veinmorpher 100% -> a full screen of veins", close(morph.veinsPerScreen, ex.stats.ores_per_screen));
  var gm = FD.evaluateVein(env, { vein: "Stone Vein", morphGolden: 1 });
  check("make-all-golden raises the variant multi", gm.variantMulti > stone.variantMulti);
  check("vein groups: equal floors share rank", stone.groups[0].floors.length === 8 && stone.groups[0].label === "1-8");
  check("vein group labels", FD.evaluateVein(env, { vein: "Magma Vein" }).groups.every(function (g) { return typeof g.label === "string"; }));
  check("vein override off drops portal income", FD.evaluateVein(env, { vein: "Stone Vein", voidMode: "off" }).perfect.used === stone.perfect.base);
  check("vein override on keeps the average void multi", close(FD.evaluateVein(env, { vein: "Stone Vein", voidMode: "on" }).perfect.used, stone.perfect.base * stone.portal.average));
  check("vein reminders: Veinseeker not equipped", stone.reminders.some(function (x) { return x.code === "veinseeker-not-equipped"; }));
  var floor104 = FD.fromExport(Object.assign({}, ex.stats, { current_floor: 104 }), ex.version);
  check("vein reminder on 0.4x portal floors", FD.evaluateVein(floor104, { vein: "Stone Vein" }).reminders[0].code === "exported-on-portal-floor");

  // base speed normalisation: exporting on a slow floor must not skew results
  var slow = FD.fromExport(Object.assign({}, ex.stats, { current_floor: 71, game_speed_multi: ex.stats.game_speed_multi * 0.75 * 0.7 }), ex.version);
  check("export taken on floor 71 (x0.75, no W3 fix) normalises to the same base speed", (function () {
    var noFix = Object.assign({}, ex.stats, { fishing_notices_array: ex.stats.fishing_notices_array.slice() });
    noFix.fishing_notices_array[14] = 0;
    var e = FD.fromExport(Object.assign({}, noFix, { current_floor: 71, game_speed_multi: 4.2388038 * 0.75 }), ex.version);
    return close(e.baseSpeed, 4.2388038);
  })() && slow.baseSpeed > 0);
})();

/* ---- manual mode ---------------------------------------------------- */

(function () {
  var m = FD.defaultManual();
  var env = FD.fromManual(m);
  check("manual defaults: nothing special in World 1", env.portal.chance === 0 && env.portal.normalMulti === 0 && env.jsonLoaded === false);
  check("manual: World 1 ignores void chance", FD.fromManual(Object.assign({}, m, { portalChance: 50, voidEquipped: true, world: 1 })).portal.chance === 0);
  var w2 = FD.fromManual(Object.assign({}, m, { world: 2, voidEquipped: true, voidFueled: true, voidGrade: 4, portalChance: 30 }));
  check("manual: World 2 void portal 30%", close(w2.portal.chance, 0.3));
  check("manual: void multi (3 + grade)", close(w2.portal.normalMulti, 7));
  check("manual: unfueled drone multi = 1", FD.fromManual(Object.assign({}, m, { world: 2, voidEquipped: true, portalChance: 30 })).portal.normalMulti === 1);
  var w4 = FD.fromManual(Object.assign({}, m, { world: 4, voidEquipped: true, voidFueled: true, voidGrade: 0, portalChance: 10,
    minoEquipped: true, minoFueled: true, minoGrade: 2, coalLevel: 10, lvl400: 100, omni: true, contractLevel: 5, arcanist: 4, hydra: 2 }));
  var expected = 3 * (1 + 0.0025 + 2 * 0.0025) * (1 + 10 * 0.005) * (1 + 100 * 0.001) * 1.02 * (1 + 5 * 0.004) * (1 + 4 * 0.005) * (1 + 2 * 0.0075);
  check("manual: World 4 void multi stack", close(w4.portal.normalMulti, expected));
  check("manual: World 3 gate on golden ore", FD.fromManual(Object.assign({}, m, { world: 2, goldenOreChance: 50 })).goldenOre.c === 0 &&
    FD.fromManual(Object.assign({}, m, { world: 3, goldenOreChance: 50 })).goldenOre.c === 0.5);
  check("manual: percent input is clamped", FD.fromManual(Object.assign({}, m, { world: 4, rainbowOreChance: 250 })).rainbowOre.c === 1);
  check("manual: W4 speed accepts 0.4 or 40", FD.fromManual(Object.assign({}, m, { w4Mod: 40 })).w4Mod === 0.4 &&
    FD.fromManual(Object.assign({}, m, { w4Mod: 0.4 })).w4Mod === 0.4 && FD.fromManual(Object.assign({}, m, { w4Mod: 5 })).w4Mod === 0.2);
  var res = FD.evaluateOre(w2, { ore: "Tin" });
  check("manual: World 2 with the drone says Yes", res.autoVoid === "Yes" || res.autoVoid === "No");
  check("manual: values stay finite", res.ranking.every(function (x) { return isFinite(x.value) && isFinite(x.raw); }));
  check("manual: garbage input falls back to defaults", FD.fromManual({ world: "x", gameSpeed: NaN }).world === 1);
  check("manual: invalid world is clamped", FD.fromManual({ world: 9 }).world === 4);
})();

/* ---- account import ------------------------------------------------- */

(function () {
  var ex = fixtureExport();
  check("export fixture is v2.2.52 with all the keys this tool reads", ex.version === "v2.2.52" && FD.missingKeys(ex.stats).length === 0);
  check("missingKeys reports gaps", FD.missingKeys({}).length === FD.REQUIRED_KEYS.length && FD.missingKeys({ bomb_damage: 1 }).indexOf("bomb_damage") < 0);
  var parsed = ES.parseExport(JSON.stringify(ex));
  check("ExportStats.parseExport exposes the version", parsed.version === "v2.2.52");
  check("fromExport tolerates an empty export", (function () {
    var env = FD.fromExport({}, null);
    var r = FD.evaluateOre(env, { ore: "Tin" });
    return env.jsonLoaded && isFinite(r.perfect.base);
  })());
  var oldSample = fs.readFileSync(path.join(__dirname, "..", "sample.js"), "utf-8").replace(/^window\.SAMPLE_EXPORT\s*=\s*/, "").replace(/;\s*$/, "");
  var old = ES.parseExport(oldSample);
  check("v2.2.20 sample still maps (older version warning)", (function () {
    var env = FD.fromExport(old.stats, old.version);
    var r = FD.evaluateOre(env, { ore: "Tin" });
    return r.warnings.some(function (w) { return w.code === "json-outdated"; });
  })());
})();

/* ---- page wiring ----------------------------------------------------- */

(function () {
  var html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf-8");
  var app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf-8");
  var css = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf-8");
  check("index.html loads floortables.js before floordata.js", html.indexOf('src="floortables.js"') > 0 && html.indexOf('src="floortables.js"') < html.indexOf('src="floordata.js"'));
  check("floordata.js loads before floors.js", html.indexOf('src="floordata.js"') < html.indexOf('src="floors.js"'));
  check("floors.js loads before app.js", html.indexOf('src="floors.js"') < html.indexOf('src="app.js"'));
  check("nav links to the floor tool", html.indexOf('href="#/floors" data-nav="floors"') >= 0);
  check("home card links to the floor tool", html.indexOf('href="#/floors">Open tool</a>') >= 0);
  check("view-floors exists and starts hidden", /<div id="view-floors" class="view" hidden>/.test(html));
  check("app routes the floor view", app.indexOf('floors: "view-floors"') >= 0);
  check("app refreshes the floor tool after import", app.indexOf("FloorTool.refreshAccount") >= 0);
  check("app resets the floor tool", app.indexOf("FloorTool.resetAll") >= 0);
  check("app initialises the floor tool", app.indexOf("FloorTool.init") >= 0);
  check("styles define the floor tool", css.indexOf(".floors-hero") >= 0);
  [
    "floors-account-status", "floors-mode-ore", "floors-mode-veins", "floors-ore", "floors-vein-grid", "floors-show-w4",
    "floors-void-mode", "floors-hero", "floors-alerts", "floors-ranking", "floors-detail", "floors-stats", "floors-explorer"
  ].forEach(function (id) {
    check("index.html has #" + id, html.indexOf('id="' + id + '"') >= 0);
  });
})();

console.log("ores: " + FD.ORES.length + " | veins: " + FD.VEINS.length + " | floors: " + FD.FLOORS.length +
  " | modifier ranges: " + FD.MODS.length);
console.log(fails === 0 ? "FLOOR VALIDATION OK" : fails + " FAILED");
process.exitCode = fails === 0 ? 0 : 1;
