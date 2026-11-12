// Validates the max damage calculator: consumables, contract maxing, crit
// tiers, and the page wiring.
global.window = global;

require("../bombdata.js");
require("../contractdata.js");
require("../damagedata.js");

var fs = require("fs");
var path = require("path");

var DD = globalThis.DamageData;

var fails = 0;
function check(name, cond) { if (!cond) { fails++; console.log("FAIL " + name); } }
function close(a, b) { var m = Math.max(1, Math.abs(a), Math.abs(b)); return Math.abs(a - b) / m < 1e-9; }

var raw = fs.readFileSync(path.join(__dirname, "..", "sample_v2252.js"), "utf-8");
var json = raw.match(/\{[\s\S]*\}/)[0];
var stats = JSON.parse(json).stats;

/* ---- item data ---------------------------------------------------- */

check("nine damage-relevant items", DD.ITEMS.length === 9);
check("item indexes match the export", DD.ITEM_BY_ID.rockCake.index === 2 &&
  DD.ITEM_BY_ID.primalMeat.index === 3 && DD.ITEM_BY_ID.hamburger.index === 14);
check("hamburger uses workshop_array[22]", close(DD.hamburgerMultiplier(stats, false), 7.44));
check("golden hamburger doubles the multiplier", close(DD.hamburgerMultiplier(stats, true), 14.88));

var none = DD.defaultItems(false);
var all = DD.defaultItems(true);
check("no items is a 1x base factor", close(DD.itemBaseFactor(stats, none, { primalMeat: false, hamburger: false }), 1));
check("Rock Cake and Primal Meat add together",
  close(DD.itemBaseFactor(stats, { rockCake: true, primalMeat: true }, { primalMeat: false, hamburger: false }), 2.3));
check("Golden Primal Meat is +200%",
  close(DD.itemBaseFactor(stats, { primalMeat: true }, { primalMeat: true, hamburger: false }), 3));
check("all three pickaxe item boosts multiply",
  close(DD.itemBaseFactor(stats, { rockCake: true, primalMeat: true, hamburger: true }, { primalMeat: false, hamburger: false }), 2.3 * 7.44));
check("crit chance items add", DD.itemCritChance({ apple: true, plums: true }) === 35);
check("crit damage items add", close(DD.itemCritDamage({ pike: true, plums: true }), 0.55));
check("Banana Coffee is attack speed", close(DD.itemAttackSpeed({ bananaCoffee: true }), 1.2));
check("Blue Cow is game speed", close(DD.itemGameSpeed({ blueCow: true }), 2));
check("Chaos Totem multiplies bomb damage", close(DD.itemBombFactor(stats, { chaosTotem: true }, { hamburger: false, chaosTotem: false }), 3));
check("Golden Chaos Totem is 9x", close(DD.itemBombFactor(stats, { chaosTotem: true }, { hamburger: false, chaosTotem: true }), 9));

/* ---- crit chain --------------------------------------------------- */

var plain = DD.hitModel(100, 0, 1, 0, 1, 0, 1, 0, 1);
check("no crit chance means a plain hit", plain.maxTier === "plain" && plain.max === 100 && close(plain.expected, 100));

var crit = DD.hitModel(100, 50, 2, 0, 1, 0, 1, 0, 1);
check("crit-only max hit", crit.maxTier === "crit" && crit.max === 200);
check("crit-only expected hit", close(crit.expected, 150));
check("crit-only max chance", close(crit.maxChance, 0.5));

var full = DD.hitModel(100, 100, 2, 100, 3, 100, 4, 100, 5);
check("all crit tiers reach the omega hit", full.maxTier === "omega" && close(full.max, 12000));
check("all guaranteed tiers have the same expected hit", close(full.expected, 12000));
check("all guaranteed tiers have a 100% max chance", close(full.maxChance, 1));

var noUltra = DD.hitModel(100, 100, 2, 100, 3, 0, 4, 100, 5);
check("omega cannot trigger without ultra", noUltra.maxTier === "super" && close(noUltra.max, 600));
check("omega outcome is impossible without ultra",
  noUltra.tiers.filter(function (t) { return t.id === "omega"; })[0].chance === 0);

var noCrit = DD.hitModel(100, 0, 2, 100, 3, 100, 4, 100, 5);
check("no crit chance blocks every later tier", noCrit.maxTier === "plain" && close(noCrit.max, 100));

/* ---- synthetic scenarios ------------------------------------------ */

var synthetic = {
  pickaxe_damage: 1000,
  pickaxe_crit_chance: 100,
  pickaxe_crit_damage: 2,
  pickaxe_super_crit_chance: 100,
  pickaxe_super_crit_damage: 3,
  pickaxe_ultra_crit_chance: 0,
  pickaxe_ultra_crit_damage: 4,
  pickaxe_omega_crit_chance: 100,
  pickaxe_omega_crit_damage: 5,
  pickaxe_attack_speed_per_second: 1,
  game_speed_multi: 1,
  bomb_damage: 100,
  bomb_additional_multiplier: 0,
  bomb_crit_chance: 0,
  bomb_crit_damage: 1,
  bomb_super_crit_chance: 0,
  bomb_super_crit_damage: 1,
  bomb_ultra_crit_chance: 0,
  bomb_ultra_crit_damage: 1,
  bomb_omega_crit_chance: 0,
  bomb_omega_crit_damage: 1,
  workshop_array: [],
  black_hole_level: 0,
  fishing_legendary_tribute_levels_array: [],
  item_uptime_array: [],
  contracts_array: [],
  contract_cap_increase: 0
};

var baseRun = DD.computeDamage(synthetic, { items: none, contractMode: "current" });
check("synthetic current max hit", close(baseRun.current.pickaxe.hit.max, 6000));
check("synthetic current expected hit", close(baseRun.current.pickaxe.hit.expected, 6000));
check("no contracts leaves the base factor at 1", close(baseRun.current.pickaxe.contractBaseFactor, 1));

var itemRun = DD.computeDamage(synthetic, {
  items: { rockCake: true, primalMeat: true, hamburger: true, pike: true, plums: true, apple: true },
  golden: { primalMeat: false, hamburger: false, chaosTotem: false },
  contractMode: "current"
});
check("items multiply the base damage", close(itemRun.scenario.pickaxe.base, 1000 * 2.3 * 3));
check("items raise the crit damage", close(itemRun.scenario.pickaxe.critDamage, 2.55));
check("items raise the max hit", close(itemRun.scenario.pickaxe.hit.max, 1000 * 2.3 * 3 * 2.55 * 3));
check("items are compared against the active-at-export set", close(itemRun.current.pickaxe.hit.max, 6000));

var goldenRun = DD.computeDamage(synthetic, {
  items: { primalMeat: true, hamburger: true },
  golden: { primalMeat: true, hamburger: true, chaosTotem: false },
  contractMode: "current"
});
check("golden items use their stronger values",
  close(goldenRun.scenario.pickaxe.base, 1000 * 3 * 6));

/* ---- sample export ------------------------------------------------ */

var active = DD.activeItemsFromStats(stats);
check("sample detects Apple and Primal Meat active", active.apple === true && active.primalMeat === true);
check("sample detects Rock Cake and Hamburger inactive", active.rockCake === false && active.hamburger === false);
check("sample golden unlocks are off", DD.goldenFromStats(stats).primalMeat === false &&
  DD.goldenFromStats(stats).hamburger === false);

var sampleCurrent = DD.computeDamage(stats, {
  items: active,
  contractMode: "current",
  contractsCompleted: 0,
  contractCapIncrease: stats.contract_cap_increase
});
check("sample current hit equals the exported stats",
  close(sampleCurrent.current.pickaxe.hit.max, sampleCurrent.scenario.pickaxe.hit.max));
check("sample current pickaxe base equals the export",
  close(sampleCurrent.current.pickaxe.base, stats.pickaxe_damage));
check("sample current bomb base equals the export",
  close(sampleCurrent.current.bomb.base, stats.bomb_damage * (1 + stats.bomb_additional_multiplier)));
check("sample current super crit chance equals the export",
  close(sampleCurrent.current.pickaxe.superChance, stats.pickaxe_super_crit_chance));
check("sample current ultra crit chance equals the export",
  close(sampleCurrent.current.pickaxe.ultraChance, stats.pickaxe_ultra_crit_chance));
check("sample current omega crit chance equals the export",
  close(sampleCurrent.current.pickaxe.omegaChance, stats.pickaxe_omega_crit_chance));
check("sample warns about contracts completed",
  sampleCurrent.warnings.some(function (w) { return w.indexOf("Contracts completed") >= 0; }));

var sampleMaxed = DD.computeDamage(stats, {
  items: all,
  contractMode: "maxed",
  contractsCompleted: 100,
  contractCapIncrease: stats.contract_cap_increase
});
check("maxed damage contracts raise the base factor",
  sampleMaxed.scenario.pickaxe.contractBaseFactor > sampleCurrent.scenario.pickaxe.contractBaseFactor);
check("maxed damage contracts raise the crit factor",
  sampleMaxed.scenario.pickaxe.contractCritFactor > sampleCurrent.scenario.pickaxe.contractCritFactor);
check("maxed damage contracts raise the max hit",
  sampleMaxed.scenario.pickaxe.hit.max > sampleCurrent.scenario.pickaxe.hit.max);
check("sample maxed hit is finite", isFinite(sampleMaxed.scenario.pickaxe.hit.max));

var rows = sampleMaxed.contracts.rows;
check("ten damage contract rows", rows.length === 10);
check("per-contract pickaxe row is maxed",
  rows[0].currentLevel === 3 && rows[0].maxLevel === 10);
check("pickaxe crit damage row is maxed",
  rows[2].currentLevel === 1 && rows[2].maxLevel === 14);
check("pickaxe damage row is maxed",
  rows[3].currentLevel === 1 && rows[3].maxLevel === 12);
check("omega crit chance row reaches 100%",
  rows[7].maxChance === 1);
check("super crit chance row reaches 100%",
  rows[1].maxChance === 1);

check("sample maxed bomb hit is finite", isFinite(sampleMaxed.scenario.bomb.hit.max));
check("sample maxed bomb hit beats the current bomb hit",
  sampleMaxed.scenario.bomb.hit.max > sampleMaxed.current.bomb.hit.max);

var noMutate = JSON.parse(JSON.stringify(stats));
DD.computeDamage(stats, { items: all, contractMode: "maxed", contractsCompleted: 100 });
check("computeDamage does not mutate the stats", JSON.stringify(stats) === JSON.stringify(noMutate));

var defaults = DD.computeDamage(DD.defaultStats(), { items: all, contractMode: "maxed" });
check("default manual stats produce a finite result", isFinite(defaults.scenario.pickaxe.hit.max));
check("default manual stats have no contract data problems", defaults.contracts !== null);
check("manual OB 0 locks the omega contract",
  defaults.contracts.rows.some(function (row) { return row.index === 22 && row.locked; }));
check("manual OB 0 warns about locked damage contracts",
  defaults.warnings.some(function (w) { return w.indexOf("OB-locked") >= 0; }));


// Golden what-ifs must raise the hit even when the item was active at export.
(function () {
  var all = DD.defaultItems(true);
  var base = DD.computeDamage(stats, { items: all, contractMode: "current" });
  var gold = DD.computeDamage(stats, { items: all, contractMode: "current", golden: { chaosTotem: true } });
  check("golden chaos totem triples the bomb hit",
    close(gold.scenario.bomb.base / base.scenario.bomb.base, 3));
})();

console.log(fails === 0 ? "DAMAGE OK" : fails + " FAILED");
process.exitCode = fails === 0 ? 0 : 1;
