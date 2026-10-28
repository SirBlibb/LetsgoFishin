// Validates Contract Point planner costs, scores, plans, and page wiring.
global.window = global;

require("../bombdata.js");
require("../contractdata.js");

var fs = require("fs");
var path = require("path");

var CD = globalThis.ContractData;

var fails = 0;
function check(name, cond) { if (!cond) { fails++; console.log("FAIL " + name); } }
function close(a, b) { var m = Math.max(1, Math.abs(a), Math.abs(b)); return Math.abs(a - b) / m < 1e-9; }

var raw = fs.readFileSync(path.join(__dirname, "..", "sample.js"), "utf-8");
var json = raw.replace(/^window\.SAMPLE_EXPORT\s*=\s*/, "").replace(/;\s*$/, "");
var stats = JSON.parse(json).stats;
var ctx = CD.fromExport(stats);
var levels = ctx.levels.slice();

function totalCost(index) {
  var total = 0;
  for (var level = 1; level <= CD.MAX_LEVELS[index]; level++) {
    total += CD.costAt(index, level, 0);
  }
  return total;
}

/* ---- wiki cost tables ---------------------------------------------- */

check("34 upgrades", CD.UPGRADES.length === 34 && CD.GOAL_IDS.length === 5);
check("Triple Craft total is 6,776", totalCost(1) === 6776);
check("Vein Income total is 48,398", totalCost(12) === 48398);
check("Ore Sell total is 135,451", totalCost(11) === 135451);
check("sample cap increase is 14", ctx.capIncrease === 14);
check("sample cost reduction is 12.6464%", close(ctx.costReduction, 0.12646400000000005));

check("exponential base cost", CD.costAt(1, 1, 0) === 14);
check("exponential scaling", CD.costAt(1, 2, 0) === 18 && CD.costAt(1, 19, 0) === 1574);
check("Star Supergiant scaling override starts at level 3",
  CD.costAt(24, 1, 0) === 520 && CD.costAt(24, 2, 0) === 650 &&
  CD.costAt(24, 3, 0) === 845 && CD.costAt(24, 4, 0) === 1099);
check("cost reduction applies to the next level", close(CD.costAt(1, 1, ctx.costReduction), 14 * (1 - ctx.costReduction)));

/* ---- linear CostTable rule ----------------------------------------- */

var linear0 = [10, 500, 1500, 3000, 5000, 8500, 12500, 14000, 17000, 20000, 23000, 26000, 29000, 32000, 35000];
var linear10 = [100, 500, 1500, 3000, 5000, 8500, 12500, 14000, 17000, 20000, 23000, 26000, 29000, 32000, 35000];
var ok0 = true, ok10 = true;
linear0.forEach(function (cost, i) { if (CD.costAt(0, i + 1, 0) !== cost) ok0 = false; });
linear10.forEach(function (cost, i) { if (CD.costAt(10, i + 1, 0) !== cost) ok10 = false; });
check("Pickaxe Damage Per Contract linear overrides", ok0);
check("Bomb Damage Per Contract linear overrides", ok10);
check("linear totals include the overrides", totalCost(0) === 227010 && totalCost(10) === 227100);

/* ---- caps and OB gates --------------------------------------------- */

check("cap with no increase is the base max", CD.capFor(1, 0) === 5 && CD.capFor(33, 0) === 5);
check("cap with +14 reaches the table length", CD.capFor(1, 14) === 19 && CD.capFor(33, 14) === 19);
check("table length is base max + 14", CD.UPGRADES.every(function (up, i) {
  return CD.MAX_LEVELS[i] === up.baseMax + 14;
}));
check("sample levels are all at or below cap", levels.every(function (level, i) {
  return level >= 0 && level <= CD.capFor(i, ctx.capIncrease);
}));

var sampleRanks = CD.rankNext(levels, ctx, { ore: 1 });
var portalRow = sampleRanks.filter(function (r) { return r.index === 33; })[0];
check("All Portal Multi is level 0", portalRow.level === 0);
check("All Portal Multi is OB-locked at OB 71", portalRow.locked === true && portalRow.obMin === 73);
check("All Portal Multi has no next price while locked", portalRow.cost === null);

/* ---- goals and scoring --------------------------------------------- */

var values = CD.goalValues(levels, ctx);
check("goal values are positive", CD.GOAL_IDS.every(function (id) { return values[id] > 0 && isFinite(values[id]); }));
var oreZero = CD.zeroLevels();
var orePlus = oreZero.slice();
orePlus[14] = 1;
check("ore goal uses golden floor multi",
  close(CD.goalValues(orePlus, ctx).ore / CD.goalValues(oreZero, ctx).ore, 1 + 0.03));

var cappedStats = JSON.parse(JSON.stringify(stats));
cappedStats.contracts_array[2] = 5;
cappedStats.pickaxe_super_crit_chance = 100;
var cappedCtx = CD.fromExport(cappedStats);
var cappedRow = CD.rankNext(cappedCtx.levels, cappedCtx, { damage: 1 }).filter(function (r) {
  return r.index === 2;
})[0];
check("capped super crit is not maxed", cappedRow.maxed === false);
check("capped super crit is flagged", cappedRow.capped === true);
check("capped super crit has no score", cappedRow.score === 0 && cappedRow.logGain === 0);

var cappedCraftStats = JSON.parse(JSON.stringify(stats));
cappedCraftStats.craft_10x_chance = 100;
cappedCraftStats.contracts_array[9] = 0;
var cappedCraftCtx = CD.fromExport(cappedCraftStats);
var cappedCraftRow = CD.rankNext(cappedCraftCtx.levels, cappedCraftCtx, { bars: 1 }).filter(function (r) {
  return r.index === 9;
})[0];
check("capped craft chance is not maxed", cappedCraftRow.maxed === false);
check("capped craft chance is flagged", cappedCraftRow.capped === true);
check("capped craft chance has no score", cappedCraftRow.score === 0 && cappedCraftRow.logGain === 0);

var barsBefore = CD.goalValues(levels, ctx).bars;
var noBarCost = levels.slice();
noBarCost[7] = 0;
check("upgrade bar cost raises the bar goal", barsBefore > CD.goalValues(noBarCost, ctx).bars);

/* ---- spend plans --------------------------------------------------- */

var plan = CD.planSpend(levels, ctx, { ore: 60, veins: 40 }, 20000);
var buyTotal = plan.buys.reduce(function (sum, buy) { return sum + buy.cost; }, 0);
check("plan never exceeds the budget", plan.spent <= plan.budget + 1e-9);
check("plan keeps the budget and leftover consistent", close(plan.spent + plan.left, plan.budget));
check("plan buy costs sum to spent", close(buyTotal, plan.spent));
check("plan starts from the supplied levels", close(CD.refundFor(plan.startLevels, ctx), CD.refundFor(levels, ctx)));
check("plan reports a positive weighted gain", plan.weightedGain > 0);

var veinPlan = CD.planSpend(levels, ctx, { veins: 100 }, 20000);
check("100% veins plan buys something", veinPlan.buys.length > 0);
check("100% veins plan buys only veins or speed", veinPlan.buys.every(function (buy) {
  return buy.index === 12 || buy.index === 15 || buy.index === 17 || buy.index === 26;
}));

var orePlan = CD.planSpend(levels, ctx, { ore: 100 }, 20000);
check("100% ore and 100% veins give different plans", orePlan.buys.length > 0 &&
  orePlan.buys.map(function (b) { return b.name; }).join("|") !==
  veinPlan.buys.map(function (b) { return b.name; }).join("|"));

var zero = CD.zeroLevels();
var mixed = CD.planSpend(zero, ctx, { ore: 50, veins: 50 }, 5000);
check("a mix plan fits its budget", mixed.spent <= mixed.budget + 1e-9);
check("a mix plan improves both weighted goals", mixed.goals.ore.gain > 0 && mixed.goals.veins.gain > 0);

/* ---- respec -------------------------------------------------------- */

var refund = CD.refundFor(levels, ctx);
check("refund is positive", refund > 0);
check("respec budget is spare plus refund", close(CD.respecBudget(1234, levels, ctx), 1234 + refund));
var respecPlan = CD.planSpend(zero, ctx, { ore: 1 }, CD.respecBudget(1234, levels, ctx));
check("respec plan starts from zero", respecPlan.startLevels.every(function (v) { return v === 0; }));
check("respec plan uses the refunded budget", close(respecPlan.budget, 1234 + refund));
check("respec plan fits the refunded budget", respecPlan.spent <= respecPlan.budget + 1e-9);

var respecBudget0 = CD.respecBudget(0, levels, ctx);
var respecVsCurrent = CD.planSpend(zero, ctx, { ore: 100 }, respecBudget0, levels);
check("respec baseline keeps the zero start levels", respecVsCurrent.startLevels.every(function (v) { return v === 0; }));
check("respec baseline compares against the current levels",
  close(respecVsCurrent.goals.ore.before, CD.goalValues(levels, ctx).ore));
check("100% ore respec lowers veins versus current levels", respecVsCurrent.goals.veins.gain < 0);
var respecNoBase = CD.planSpend(zero, ctx, { ore: 100 }, respecBudget0);
check("no baseline still compares against the start levels",
  close(respecNoBase.goals.ore.before, CD.goalValues(zero, ctx).ore) && respecNoBase.goals.ore.gain > 0);
var respecZeroBase = CD.planSpend(zero, ctx, { ore: 100 }, respecBudget0, zero);
check("a zero baseline matches the default",
  close(respecZeroBase.goals.veins.gain, respecNoBase.goals.veins.gain) &&
  close(respecZeroBase.weightedGain, respecNoBase.weightedGain));

/* ---- page wiring --------------------------------------------------- */

var html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf-8");
var app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf-8");
[
  "view-contracts",
  "contracts-mode-current", "contracts-mode-respec", "contracts-mode-note",
  "contracts-spare", "contracts-completed", "contracts-budget-note",
  "contracts-weight-ore", "contracts-weight-ore-value",
  "contracts-weight-veins", "contracts-weight-veins-value",
  "contracts-weight-stars", "contracts-weight-stars-value",
  "contracts-weight-bars", "contracts-weight-bars-value",
  "contracts-weight-damage", "contracts-weight-damage-value",
  "contracts-preset-ore", "contracts-preset-veins", "contracts-preset-stars", "contracts-preset-mix",
  "contracts-levels-details", "contracts-levels",
  "contracts-plan", "contracts-result", "contracts-ranking",
  "contracts-badge", "contracts-account-note", "contracts-account-status"
].forEach(function (id) {
  check("index.html has #" + id, html.indexOf('id="' + id + '"') >= 0);
});
check("contractdata.js is loaded", html.indexOf('src="contractdata.js"') >= 0);
check("contracts.js is loaded", html.indexOf('src="contracts.js"') >= 0);
check("nav links to the contracts tool", html.indexOf('href="#/contracts" data-nav="contracts"') >= 0);
check("home card links to the contracts tool", html.indexOf('href="#/contracts">Open tool</a>') >= 0);
check("app routes the contracts view", app.indexOf('contracts: "view-contracts"') >= 0);
check("app refreshes the contracts tool after import", app.indexOf("ContractTool.refreshAccount") >= 0);
check("app resets the contracts tool", app.indexOf("ContractTool.resetAll") >= 0);
check("app initialises the contracts tool", app.indexOf("ContractTool.init") >= 0);
check("app titles the contracts view", app.indexOf("Contract Point Planner - Obelisk Miner Tools") >= 0);

console.log("Triple " + totalCost(1) + " | Vein income " + totalCost(12) + " | Ore sell " + totalCost(11) +
  " | respec " + CD.respecBudget(1234, levels, ctx));
console.log(fails === 0 ? "CONTRACT VALIDATION OK" : fails + " FAILED");
process.exitCode = fails === 0 ? 0 : 1;
