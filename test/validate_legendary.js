// Validates legendary fish maths against the wiki formulas and page wiring.
require("../model.js");
require("../data.js");
require("../fishcosts.js");
require("../exportstats.js");
require("../legendarydata.js");

var fs = require("fs");
var path = require("path");

var LD = globalThis.LegendaryData;

var fails = 0;
function check(name, cond) { if (!cond) { fails++; console.log("FAIL " + name); } }
function close(a, b) {
  var m = Math.max(1, Math.abs(a), Math.abs(b));
  return Math.abs(a - b) / m < 1e-9;
}

/* ---- dock table ---------------------------------------------------- */

check("11 docks are listed", LD.DOCKS.length === 11);
check("Lake is a Tier 1 dock", LD.dockById("Lake").tier === 1 && LD.dockById("Lake").baseTicks === 5);
check("Abyss is a Tier 1 dock", LD.dockById("Abyss").tier === 1);
check("Cave is a Tier 2 dock", LD.dockById("Cave").tier === 2);
check("Lake last fish is Golden Trout at 490", LD.dockById("Lake").lastFish === "Golden Trout" &&
  LD.dockById("Lake").rating === 490);
check("Galaxy comes last", LD.DOCKS[10].id === "Galaxy" && LD.DOCKS[10].rating === 4410000);
check("every dock has a legendary name", LD.DOCKS.every(function (d) { return !!d.legendary; }));
check("unknown dock is not found", LD.dockById("Nowhere") === null);

/* ---- power and catch chance --------------------------------------- */

var s = LD.defaults();
s.rodPower = 1000;
s.dronesAssigned = 10;
s.droneBasePower = 20;
s.droneMultiplier = 2;
s.dock = "Lake";
check("drone power per drone", close(LD.dronePowerEach(s), 40));
check("Tier 1 dock power is rod + drones", close(LD.dockPower(s), 1000 + 400));
check("Lake catch chance", close(LD.catchChance(s), 100 * 1400 / 490));

s.dock = "Cave";
s.tier2DockMulti = 1.5;
check("Tier 2 dock power applies the multiplier", close(LD.dockPower(s), 1400 * 1.5));
check("Tier 2 catch chance", close(LD.catchChance(s), 100 * 2100 / 136080));

s.rodAssigned = false;
check("unassigned rod contributes nothing", close(LD.dockPower(s), 600));

var abyss = LD.defaults();
abyss.dock = "Abyss";
abyss.rodPower = 38020;
abyss.tier2DockMulti = 2;
check("Abyss does not use the Tier 2 dock multiplier", close(LD.dockPower(abyss), 38020));
check("Abyss at its rating is exactly 100%", close(LD.catchChance(abyss), 100));

/* ---- legendary steps ---------------------------------------------- */

check("below 100% has no legendary step", LD.legendarySteps(0) === 0 && LD.legendarySteps(99.99) === 0);
check("100% gives one step", LD.legendarySteps(100) === 1);
check("199% is still one step", LD.legendarySteps(199.99) === 1);
check("200% gives two steps", LD.legendarySteps(200) === 2);
check("899% gives eight steps", LD.legendarySteps(899.9) === 8);
check("900% reaches the cap", LD.legendarySteps(900) === 9);
check("999% is still nine steps", LD.legendarySteps(999) === 9);
check("huge catch chances cap at nine steps", LD.legendarySteps(50000) === 9);

/* ---- angler denominator ------------------------------------------- */

var a = LD.defaults();
check("no Angler means no legendary bonus", LD.anglerFactor(a) === 1);
a.anglerEquipped = true;
check("equipped but unfuelled Angler means no bonus", LD.anglerFactor(a) === 1);
a.anglerFueled = true;
check("fuelled grade 0 Angler gives +2%", close(LD.anglerFactor(a), 1.02));
a.anglerGrade = 11;
check("fuelled grade 11 Angler gives +24%", close(LD.anglerFactor(a), 1.24));
a.anglerGrade = 42;
check("max grade Angler approaches 81k", close(LD.anglerFactor(a), 1.86) &&
  close(LD.LEGENDARY_DENOMINATOR / LD.anglerFactor(a), 80645.16129032258));

/* ---- legendary chance per fill ------------------------------------ */

var c = LD.defaults();
c.dock = "Lake";
c.rodPower = 49000;
c.ticksPerFill = 5;
c.polyCards = true;
check("49k power on Lake reaches 9 steps", LD.legendarySteps(LD.catchChance(c)) === 9);
check("no Angler chance is 9/150k", close(LD.legendaryChancePerFill(c), 9 / 150000));
c.anglerEquipped = true;
c.anglerFueled = true;
c.anglerGrade = 11;
check("grade 11 Angler chance uses the reduced denominator",
  close(LD.legendaryChancePerFill(c), 9 * 1.24 / 150000));

/* ---- tick speed and tick procs ------------------------------------ */

var t = LD.defaults();
t.tickReduction = 55;
check("tick bar uses the reduction", close(LD.tickSeconds(t), 5));
t.tick3x = true;
check("3x buff divides tick time", close(LD.tickSeconds(t), 5 / 3));
t.tick3x = false;
t.tickReduction = 100;
check("tick time never reaches zero", close(LD.tickSeconds(t), 0.1));

t = LD.defaults();
check("no tick procs averages one tick", close(LD.expectedTicksPerEvent(t), 1));
t.doubleTick = 50;
check("50% double averages 1.5 ticks", close(LD.expectedTicksPerEvent(t), 1.5));
t.tripleTick = 50;
check("double and triple stack", close(LD.expectedTicksPerEvent(t), 3));
t = LD.defaults();
t.fiveTick = 100;
check("guaranteed 5x gives five ticks", close(LD.expectedTicksPerEvent(t), 5));

t = LD.defaults();
t.anglerEquipped = true;
t.anglerFueled = true;
t.anglerGrade = 0;
check("tick procs ignore the Angler", close(LD.expectedTicksPerEvent(t), 1));
check("fuelled grade 0 Angler averages 2.06 ticks per cycle", close(LD.anglerTicksPerCycle(t), 2.06));
check("grade 0 Angler ticks per second", close(LD.anglerPassiveTicksPerSecond(t), 2.06 / 1140));
t.anglerGrade = 42;
check("max grade Angler averages 4.58 ticks per cycle", close(LD.anglerTicksPerCycle(t), 4.58));
t.anglerFueled = false;
check("unfuelled Angler only gives the base ticks", close(LD.anglerTicksPerCycle(t), 2));
check("unfuelled Angler tick rate", close(LD.anglerPassiveTicksPerSecond(t), 2 / 1140));

t = LD.defaults();
t.anglerEquipped = true;
t.anglerUpgradeLevel = 0;
check("Angler passive at level 0", close(LD.anglerPassiveTicksPerSecond(t), 2 / 1140));
t.anglerUpgradeLevel = 15;
check("Angler passive at level 15", close(LD.anglerPassiveTicksPerSecond(t), 2 / 540));
t.anglerFueled = true;
t.anglerGrade = 42;
check("fuelled max Angler rate at level 15", close(LD.anglerPassiveTicksPerSecond(t), 4.58 / 540));
t.anglerEquipped = false;
check("no passive ticks without the Angler", LD.anglerPassiveTicksPerSecond(t) === 0);

/* ---- full calculation --------------------------------------------- */

var full = LD.defaults();
full.dock = "Lake";
full.rodPower = 49000;
full.ticksPerFill = 5;
full.tickReduction = 55;
full.polyCards = true;
var r = LD.compute(full);
check("catch chance is capped for display", r.cappedCatchChance === 999);
check("full result has nine steps", r.steps === 9);
check("full result is eligible with cards", r.eligible === true);
check("tick bar is 5 seconds", close(r.tickSeconds, 5));
check("expected ticks per event is one", close(r.expectedTicksPerEvent, 1));
check("ticks per second", close(r.ticksPerSecond, 0.2));
check("fills per second", close(r.fillsPerSecond, 0.04));
check("seconds per fill", close(r.secondsPerFill, 25));
check("chance per fill", close(r.chancePerFill, 6e-5));
check("catches per second", close(r.catchesPerSecond, 2.4e-6));
check("mean seconds", close(r.meanSeconds, 1 / 2.4e-6));
check("mean days", close(r.meanDays, (1 / 2.4e-6) / 86400));
check("median uses the geometric distribution",
  close(r.medianSeconds, Math.log(0.5) / (0.04 * Math.log1p(-6e-5))));
check("90% quantile uses the geometric distribution",
  close(r.quantiles[2].seconds, Math.log(0.1) / (0.04 * Math.log1p(-6e-5))));
check("one-day chance is cumulative", close(r.within[2].chance,
  1 - Math.pow(1 - 6e-5, 0.04 * 86400)));
check("chance at the mean time is about 63.2%", close(
  LD.chanceBySeconds(r.fillsPerSecond, r.chancePerFill, r.meanSeconds), 0.6321315954873978));

var noPower = LD.defaults();
noPower.dock = "Lake";
noPower.polyCards = true;
var nr = LD.compute(noPower);
check("zero power has no steps", nr.steps === 0);
check("zero power has no chance per fill", nr.chancePerFill === 0);
check("zero power has no average", nr.meanSeconds === Infinity);
check("zero power reports the 100% power gap", close(nr.powerGapFor100, 490));
check("zero power reports the first step power", close(nr.nextStepPower, 490));

var notPoly = LD.defaults();
notPoly.dock = "Lake";
notPoly.rodPower = 49000;
notPoly.ticksPerFill = 5;
notPoly.polyCards = false;
var npr = LD.compute(notPoly);
check("missing cards leaves the time hypothetical", npr.eligible === false && isFinite(npr.meanSeconds));

var nextStep = LD.defaults();
nextStep.dock = "Lake";
nextStep.rodPower = 1000;
var nsr = LD.compute(nextStep);
check("1000 power is two steps", nsr.steps === 2);
check("next step power is three times the fish rating", close(nsr.nextStepPower, 1470));
check("next step power gap", close(nsr.nextStepGap, 470));

var ang = LD.defaults();
ang.dock = "Lake";
ang.rodPower = 49000;
ang.ticksPerFill = 5;
ang.tickReduction = 55;
ang.doubleTick = 50;
ang.tripleTick = 50;
ang.polyCards = true;
var ar = LD.compute(ang);
check("tick procs shorten the average", close(ar.meanSeconds, r.meanSeconds / 3));
ang.anglerEquipped = true;
ang.anglerFueled = true;
ang.anglerGrade = 11;
ang.anglerUpgradeLevel = 15;
var arr = LD.compute(ang);
check("Angler shortens the average further", arr.meanSeconds < ar.meanSeconds);
check("Angler passive ticks include the buff", close(arr.anglerPassiveTicksPerSecond, 2.72 / 540));
check("Angler does not change the tick-proc average", close(arr.expectedTicksPerEvent, 3));
check("Angler ticks per cycle", close(LD.anglerTicksPerCycle(ang), 2.72));

/* ---- sample export mapping ---------------------------------------- */

var sampleRaw = fs.readFileSync(path.join(__dirname, "..", "sample_v2252.js"), "utf-8");
var sampleMatch = sampleRaw.match(/window\.SAMPLE_EXPORT_V2252\s*=\s*(\{[\s\S]*\})\s*;?\s*$/);
var stats = JSON.parse(sampleMatch[1]).stats;
var from = LD.fromAccountStats(stats);
check("sample rod power", close(from.rodPower, 86007.636));
check("sample drone capacity", from.droneCapacity === 155);
check("sample drone base power", close(from.droneBasePower, 20.5));
check("sample drone multiplier", close(from.droneMultiplier, 6.281621346));
check("sample Tier 2 multiplier", close(from.tier2DockMulti, 1.163225));
check("sample tick reduction", from.tickReduction === 52);
check("sample double tick chance", close(from.doubleTick, 28.5));
check("sample triple tick chance", close(from.tripleTick, 27.75));
check("sample 5x tick chance", from.fiveTick === 0);
check("sample Angler is not equipped", from.anglerEquipped === false && from.anglerFueled === false);
check("sample Angler grade", from.anglerGrade === 11);
check("sample Angler upgrade level", from.anglerUpgradeLevel === 15);
check("sample cards are known", from.polyKnown === true);
check("sample Lake cards are polychrome", from.polyByDock.Lake === true);
check("sample Cave cards are not polychrome", from.polyByDock.Cave === false);
check("sample Abyss ticks include Motley School", from.dockTicks.Abyss === 24);
check("sample Cave ticks include Motley School", from.dockTicks.Cave === 37);
check("sample Galaxy ticks include Motley School", from.dockTicks.Galaxy === 77);

var sampleInput = LD.defaults();
sampleInput.rodPower = from.rodPower;
sampleInput.dronesAssigned = from.droneCapacity;
sampleInput.droneBasePower = from.droneBasePower;
sampleInput.droneMultiplier = from.droneMultiplier;
sampleInput.tier2DockMulti = from.tier2DockMulti;
sampleInput.tickReduction = from.tickReduction;
sampleInput.doubleTick = from.doubleTick;
sampleInput.tripleTick = from.tripleTick;
sampleInput.fiveTick = from.fiveTick;
sampleInput.ticksPerFill = from.dockTicks.Lake;
sampleInput.polyCards = true;
var sr = LD.compute(sampleInput);
check("sample Lake dock power", close(sr.power, 105967.48782691504));
check("sample Lake catch chance", close(sr.catchChance, 21626.01792386021));
check("sample Lake reaches nine steps", sr.steps === 9);
check("sample Lake fills per hour", close(sr.fillsPerHour, 179.83575));
check("sample Lake average is about 3.86 days", close(sr.meanDays, 3.8615483542312607));

/* ---- page wiring --------------------------------------------------- */

var html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf-8");
var app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf-8");

[
  "view-legendary",
  "legendary-account-status", "legendary-loadSample", "legendary-dock", "legendary-ticks",
  "legendary-ticksAuto", "legendary-poly", "legendary-dockNote",
  "legendary-rodPower", "legendary-drones", "legendary-droneBase", "legendary-droneMulti",
  "legendary-tier2", "legendary-rodAssigned", "legendary-powerNote",
  "legendary-tickReduction", "legendary-doubleTick", "legendary-tripleTick", "legendary-fiveTick",
  "legendary-tick3x", "legendary-tickNote",
  "legendary-anglerEquipped", "legendary-anglerFueled", "legendary-anglerGrade",
  "legendary-anglerLevel", "legendary-anglerNote",
  "legendary-hero", "legendary-warning", "legendary-facts", "legendary-timeline", "legendary-docks",
  "legendary-badge", "legendary-account-note"
].forEach(function (id) {
  check("index.html has #" + id, html.indexOf('id="' + id + '"') >= 0);
});

check("legendarydata.js is loaded", html.indexOf('src="legendarydata.js"') >= 0);
check("legendary.js is loaded", html.indexOf('src="legendary.js"') >= 0);
check("nav links to the legendary tool", html.indexOf('href="#/legendary" data-nav="legendary"') >= 0);
check("home card links to the legendary tool", html.indexOf('href="#/legendary">Open tool</a>') >= 0);
check("app routes the legendary view", app.indexOf('legendary: "view-legendary"') >= 0);
check("app refreshes the legendary tool after import", app.indexOf("LegendaryTool.refreshAccount") >= 0);
check("app resets the legendary tool", app.indexOf("LegendaryTool.resetAll") >= 0);
check("app initialises the legendary tool", app.indexOf("LegendaryTool.init") >= 0);

console.log("sample Lake: " + sr.meanDays.toFixed(2) + " days average, " +
  sr.fillsPerHour.toFixed(1) + " fills/hour, " + sr.steps + "/9 steps");
console.log(fails === 0 ? "LEGENDARY VALIDATION OK" : fails + " FAILED");
process.exitCode = fails === 0 ? 0 : 1;
