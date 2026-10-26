// Validates Goal ETA maths, bar conversion, and page wiring.
require("../bombdata.js");
require("../goaldata.js");

var fs = require("fs");
var path = require("path");

var BD = globalThis.BombData;
var GD = globalThis.GoalData;

var fails = 0;
function check(name, cond) { if (!cond) { fails++; console.log("FAIL " + name); } }
function close(a, b) { var m = Math.max(1, Math.abs(a), Math.abs(b)); return Math.abs(a - b) / m < 1e-9; }

var SAMPLE_NOW = Date.UTC(2026, 0, 1, 12, 0, 0);
var raw = fs.readFileSync(path.join(__dirname, "..", "sample.js"), "utf-8");
var json = raw.replace(/^window\.SAMPLE_EXPORT\s*=\s*/, "").replace(/;\s*$/, "");
var stats = JSON.parse(json).stats;
var values = BD.fromAccountStats(stats).values;

/* ---- measured rate ------------------------------------------------ */

check("ore rate from a clean measurement", close(GD.oreRate(0, 5000, 30), 10000));
check("ore rate accepts numeric strings", close(GD.oreRate("1000", "2500", "15"), 6000));
check("ore rate handles fractional minutes", close(GD.oreRate(0, 100, 0.5), 12000));
check("ore rate needs a gain", GD.oreRate(1000, 1000, 30) === null);
check("ore rate rejects lost ore", GD.oreRate(1000, 500, 30) === null);
check("ore rate needs time", GD.oreRate(0, 5000, 0) === null);
check("ore rate rejects missing values", GD.oreRate(null, 5000, 30) === null);

/* ---- bar conversion ----------------------------------------------- */

var tin = GD.barRate(values, 1);
check("bar rate returns the selected bar", !!tin && tin.bar.name === "Tin" && tin.level === 1);
check("sample Tin effective cost", tin.effectiveCost === 1);
check("sample Tin craft multiplier", close(tin.craftMultiplier, 35645.99558909091));
check("sample Tin bar output", close(tin.barOutputMultiplier, 21.568748424327275));
check("sample Tin bars per ore", close(tin.barsPerOre, 768839.5111957816));
check("sample Tin ore per bar", close(tin.orePerBar, 1 / 768839.5111957816));
check("bar rate covers Neopolium", GD.barRate(values, 86).bar.name === "Neopolium");
check("Neopolium effective cost", GD.barRate(values, 86).effectiveCost === 10589);
check("unknown bar level returns null", GD.barRate(values, 0) === null && GD.barRate(values, 87) === null);

var plain = GD.barRate(BD.defaults(), 1);
check("default Tin effective cost", plain.effectiveCost === 5);
check("default Tin bars per ore", close(plain.barsPerOre, 0.2));
check("default Tin ore per bar", close(plain.orePerBar, 5));

/* ---- ore estimate -------------------------------------------------- */

var ore = GD.estimate({
  mode: "ore",
  currentOre: 1000,
  targetOre: 11000,
  orePerHour: 1000,
  hoursPerDay: 8,
  now: SAMPLE_NOW
});

check("ore remaining", ore.remaining === 10000 && ore.remainingOre === 10000);
check("ore goal units", ore.unit === "ore");
check("ore progress", close(ore.progress, 1000 / 11000));
check("ore play hours", close(ore.hours, 10));
check("ore calendar days", close(ore.calendarDays, 1.25));
check("ore finish is now plus calendar time", ore.finishAt.getTime() === SAMPLE_NOW + 1.25 * 86400000);
check("ore milestones have four steps", ore.milestones.length === 4);
check("ore 25% target", ore.milestones[0].amount === 2750);
check("ore 25% ore left", ore.milestones[0].remainingOre === 1750);
check("ore 25% hours", close(ore.milestones[0].hours, 1.75));
check("ore 100% matches the goal", ore.milestones[3].amount === 11000 &&
  close(ore.milestones[3].hours, 10));
check("ore deadline is absent by default", ore.deadline === null && ore.requiredRate === null);

var reached = GD.estimate({
  mode: "ore", currentOre: 12000, targetOre: 11000,
  orePerHour: 1000, hoursPerDay: 8, now: SAMPLE_NOW
});
check("reached goal has no remaining ore", reached.remainingOre === 0);
check("reached goal is flagged", reached.goalReached === true && reached.readyToCraft === false);
check("reached goal takes no time", reached.hours === 0 && reached.finishAt.getTime() === SAMPLE_NOW);
check("reached goal is 100%", reached.progress === 1);

var noRate = GD.estimate({
  mode: "ore", currentOre: 0, targetOre: 5000,
  orePerHour: 0, hoursPerDay: 8, now: SAMPLE_NOW
});
check("no rate gives no ETA", noRate.hours === Infinity && noRate.finishAt === null);

var noDays = GD.estimate({
  mode: "ore", currentOre: 0, targetOre: 5000,
  orePerHour: 500, hoursPerDay: 0, now: SAMPLE_NOW
});
check("zero play hours still gives play time", close(noDays.hours, 10));
check("zero play hours gives no calendar date", noDays.calendarDays === Infinity && noDays.finishAt === null);

var emptyTarget = GD.estimate({
  mode: "ore", currentOre: 0, targetOre: 0,
  orePerHour: 500, hoursPerDay: 8, now: SAMPLE_NOW
});
check("zero target is not counted as reached progress", emptyTarget.progress === 0);
check("zero target is not a reached or ready goal", emptyTarget.goalReached === false &&
  emptyTarget.readyToCraft === false);

/* ---- bar estimate -------------------------------------------------- */

var oneOreBars = tin.barsPerOre;
var bars = GD.estimate({
  mode: "bars",
  currentBars: 0,
  targetBars: oneOreBars,
  currentOre: 0,
  level: 1,
  values: values,
  orePerHour: 2,
  hoursPerDay: 8,
  now: SAMPLE_NOW
});
check("bar goal units", bars.unit === "bars");
check("bar goal keeps the bar selection", bars.barRate.bar.name === "Tin");
check("bar goal converts bars to one ore", close(bars.oreNeeded, 1));
check("bar goal has one ore left", close(bars.remainingOre, 1));
check("bar goal time uses ore rate", close(bars.hours, 0.5));
check("bar goal progress is zero", bars.progress === 0);
check("bar goal is not ready without ore", bars.readyToCraft === false && bars.goalReached === false);
check("bar goal 100% milestone matches", close(bars.milestones[3].remainingOre, 1));

var withOre = GD.estimate({
  mode: "bars",
  currentBars: 10,
  targetBars: 10 + oneOreBars * 10,
  currentOre: 4,
  level: 1,
  values: values,
  orePerHour: 3,
  hoursPerDay: 8,
  now: SAMPLE_NOW
});
check("bar goal subtracts current ore", close(withOre.oreNeeded, 10) && close(withOre.remainingOre, 6));
check("bar goal applies the rate to the shortfall", close(withOre.hours, 2));
check("bar goal progress uses bars", close(withOre.progress, 10 / (10 + oneOreBars * 10)));

var alreadyMined = GD.estimate({
  mode: "bars",
  currentBars: 0,
  targetBars: oneOreBars,
  currentOre: 5,
  level: 1,
  values: values,
  orePerHour: 2,
  hoursPerDay: 8,
  now: SAMPLE_NOW
});
check("bar goal can be finished with stored ore", alreadyMined.remainingOre === 0 && alreadyMined.hours === 0);
check("stored ore marks the goal ready, not reached",
  alreadyMined.readyToCraft === true && alreadyMined.goalReached === false);
check("ready bar goal still needs its bars", alreadyMined.remaining > 0);

var badBar = GD.estimate({
  mode: "bars", currentBars: 0, targetBars: 100, currentOre: 0,
  level: 999, values: values, orePerHour: 10, hoursPerDay: 8, now: SAMPLE_NOW
});
check("invalid bar level reports an error", !!badBar.error);
check("invalid bar level has no ETA", badBar.hours === Infinity && badBar.finishAt === null);

/* ---- deadline ------------------------------------------------------ */

var deadlineMs = SAMPLE_NOW + 10 * 86400000;
var deadline = GD.estimate({
  mode: "ore",
  currentOre: 0,
  targetOre: 10000,
  orePerHour: 1000,
  hoursPerDay: 8,
  now: SAMPLE_NOW,
  deadline: deadlineMs
});
check("deadline is parsed", !!deadline.deadline && deadline.deadline.getTime() === deadlineMs);
check("ten days at 8 h/day is 80 play-hours", close(deadline.deadlinePlayHours, 80));
check("required rate for the deadline", close(deadline.requiredRate, 125));
check("deadline is in the future", deadline.deadlinePassed === false);

var past = GD.estimate({
  mode: "ore", currentOre: 0, targetOre: 10000,
  orePerHour: 1000, hoursPerDay: 8,
  now: SAMPLE_NOW, deadline: SAMPLE_NOW - 86400000
});
check("past deadline is flagged", past.deadlinePassed === true);
check("past deadline has an impossible rate", past.requiredRate === Infinity);

var reachedByDeadline = GD.estimate({
  mode: "ore", currentOre: 10000, targetOre: 10000,
  orePerHour: 1000, hoursPerDay: 8,
  now: SAMPLE_NOW, deadline: deadlineMs
});
check("reached goal needs no deadline rate", reachedByDeadline.requiredRate === 0);

/* ---- page wiring --------------------------------------------------- */

var html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf-8");
var app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf-8");
[
  "view-goal",
  "goal-mode-ore", "goal-mode-bars", "goal-mode-note",
  "goal-current-ore-label", "goal-current-ore", "goal-target-ore-field", "goal-target-ore",
  "goal-current-bars-field", "goal-current-bars", "goal-target-bars-field", "goal-target-bars",
  "goal-level-field", "goal-level", "goal-rate", "goal-hours-day", "goal-deadline",
  "goal-rate-before", "goal-rate-after", "goal-rate-minutes", "goal-rate-apply", "goal-rate-result",
  "goal-stats-details", "goal-stats-source", "goal-stats", "goal-stats-warning",
  "goal-reload-account", "goal-reset-stats", "goal-results",
  "goal-badge", "goal-account-note", "goal-account-status"
].forEach(function (id) {
  check("index.html has #" + id, html.indexOf('id="' + id + '"') >= 0);
});
check("goaldata.js is loaded", html.indexOf('src="goaldata.js"') >= 0);
check("goals.js is loaded", html.indexOf('src="goals.js"') >= 0);
check("nav links to the goal tool", html.indexOf('href="#/goal" data-nav="goal"') >= 0);
check("home card links to the goal tool", html.indexOf('href="#/goal">Open tool</a>') >= 0);
check("app routes the goal view", app.indexOf('goal: "view-goal"') >= 0);
check("app refreshes the goal tool after import", app.indexOf("GoalTool.refreshAccount") >= 0);
check("app resets the goal tool", app.indexOf("GoalTool.resetAll") >= 0);
check("app initialises the goal tool", app.indexOf("GoalTool.init") >= 0);

console.log("ore 10k at 1k/h: " + ore.hours + " h (" + ore.calendarDays.toFixed(2) + " days) | Tin " +
  tin.barsPerOre.toFixed(2) + " bars/ore | deadline rate " + deadline.requiredRate);
console.log(fails === 0 ? "GOAL VALIDATION OK" : fails + " FAILED");
process.exitCode = fails === 0 ? 0 : 1;
