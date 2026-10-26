/*
 * Bomb of Plenty vs Transmuter Bomb data and expected-value maths.
 *
 * The formulas mirror the community calculator at
 *   https://tabatkins.com/obelisk/transmuter/
 * The tool also applies bar_output_multi to the bar totals; it scales both bombs
 * equally, so it does not move the breakpoint or change the winner.
 * Bar base costs are from the wiki's Craft page (through Neopolium / World 4):
 *   https://shminer.miraheze.org/wiki/Craft
 *
 * Exposed as window.BombData.
 */
(function (global) {
  "use strict";

  /*
   * Base ore cost of one bar, in level order. World numbers follow the wiki's
   * ore list; the first 26 bars are World 1, then 20 per world through World 4.
   */
  var BARS = [
    { world: 1, name: "Tin", cost: 5 },
    { world: 1, name: "Copper", cost: 6 },
    { world: 1, name: "Mithril", cost: 7 },
    { world: 1, name: "Adamant", cost: 8 },
    { world: 1, name: "Runite", cost: 9 },
    { world: 1, name: "Citrine", cost: 10 },
    { world: 1, name: "Amethyst", cost: 11 },
    { world: 1, name: "Topaz", cost: 12 },
    { world: 1, name: "Obsidian", cost: 13 },
    { world: 1, name: "Demonite", cost: 14 },
    { world: 1, name: "VR-Tin", cost: 16 },
    { world: 1, name: "VR-Amethyst", cost: 18 },
    { world: 1, name: "VR-Demonite", cost: 20 },
    { world: 1, name: "VR-ERROR", cost: 22 },
    { world: 1, name: "Lunarium", cost: 25 },
    { world: 1, name: "Earth-C-137", cost: 28 },
    { world: 1, name: "Meteorite", cost: 31 },
    { world: 1, name: "Singularity", cost: 34 },
    { world: 1, name: "Halium", cost: 38 },
    { world: 1, name: "Blasphemite", cost: 42 },
    { world: 1, name: "Angelite", cost: 46 },
    { world: 1, name: "Elysium", cost: 50 },
    { world: 1, name: "Enemite", cost: 60 },
    { world: 1, name: "Beepboopium", cost: 70 },
    { world: 1, name: "Radion-73", cost: 80 },
    { world: 1, name: "Cranium", cost: 90 },

    { world: 2, name: "Lapis", cost: 100 },
    { world: 2, name: "Quartz", cost: 110 },
    { world: 2, name: "Glacialite", cost: 120 },
    { world: 2, name: "Twinklestone", cost: 130 },
    { world: 2, name: "Sandcasium", cost: 140 },
    { world: 2, name: "Clamite", cost: 150 },
    { world: 2, name: "Thunderstone", cost: 160 },
    { world: 2, name: "Crabrock", cost: 170 },
    { world: 2, name: "Hailstone", cost: 180 },
    { world: 2, name: "Frostbite", cost: 190 },
    { world: 2, name: "Icebloom", cost: 200 },
    { world: 2, name: "Pinguinus", cost: 210 },
    { world: 2, name: "Macawrock", cost: 238 },
    { world: 2, name: "Cocore", cost: 266 },
    { world: 2, name: "Rafflenium", cost: 294 },
    { world: 2, name: "Carnivorian", cost: 322 },
    { world: 2, name: "Infernite", cost: 350 },
    { world: 2, name: "Blood-Onyx", cost: 378 },
    { world: 2, name: "Cyrogem", cost: 406 },
    { world: 2, name: "Pinnaclite", cost: 434 },

    { world: 3, name: "Omeletite", cost: 502 },
    { world: 3, name: "Resinite", cost: 570 },
    { world: 3, name: "Impactium", cost: 638 },
    { world: 3, name: "Tricerastone", cost: 706 },
    { world: 3, name: "Duelysium", cost: 774 },
    { world: 3, name: "Arcusite", cost: 842 },
    { world: 3, name: "Phalanxite", cost: 910 },
    { world: 3, name: "Guardium", cost: 978 },
    { world: 3, name: "Cognite", cost: 1050 },
    { world: 3, name: "Telophite", cost: 1110 },
    { world: 3, name: "Steamstone", cost: 1180 },
    { world: 3, name: "Equinine", cost: 1250 },
    { world: 3, name: "Dynamite", cost: 1460 },
    { world: 3, name: "Genevium", cost: 1670 },
    { world: 3, name: "Manhattite", cost: 1870 },
    { world: 3, name: "Rationium", cost: 2080 },
    { world: 3, name: "Vaporium", cost: 2290 },
    { world: 3, name: "Palmite", cost: 2500 },
    { world: 3, name: "Ransomite", cost: 2710 },
    { world: 3, name: "MVPD-1988", cost: 2910 },

    { world: 4, name: "Chronite", cost: 4100 },
    { world: 4, name: "Hattium", cost: 5300 },
    { world: 4, name: "Pishalvite", cost: 6500 },
    { world: 4, name: "Teatimium", cost: 7700 },
    { world: 4, name: "Rumium", cost: 8900 },
    { world: 4, name: "Anchorium", cost: 10100 },
    { world: 4, name: "Mateyum", cost: 11300 },
    { world: 4, name: "Hookite", cost: 12500 },
    { world: 4, name: "Carpetite", cost: 13700 },
    { world: 4, name: "Djinnium", cost: 14900 },
    { world: 4, name: "Sinbadium", cost: 16100 },
    { world: 4, name: "Turbanite", cost: 17300 },
    { world: 4, name: "Carriagum", cost: 18500 },
    { world: 4, name: "Crystal-Rose", cost: 19700 },
    { world: 4, name: "Frogstone", cost: 20900 },
    { world: 4, name: "Slipperite", cost: 22100 },
    { world: 4, name: "Jellystone", cost: 23300 },
    { world: 4, name: "Lollipopite", cost: 24500 },
    { world: 4, name: "Mintium", cost: 25700 },
    { world: 4, name: "Neopolium", cost: 26900 }
  ];

  BARS.forEach(function (bar, i) { bar.level = i + 1; });

  /*
   * The account fields the comparison consumes, in form order. `stat` is the
   * ExportStats key; `key` is the internal camelCase name.
   */
  var FIELDS = [
    { key: "freeCraftChance", stat: "free_craft_chance", label: "Free craft chance", unit: "%", group: "Crafting", min: 0, max: 99, hint: "Chance that a craft costs no ore." },
    { key: "doubleCraftChance", stat: "double_craft_chance", label: "Double craft chance", unit: "%", group: "Crafting", min: 0, max: 100 },
    { key: "tripleCraftChance", stat: "triple_craft_chance", label: "Triple craft chance", unit: "%", group: "Crafting", min: 0, max: 100 },
    { key: "craft5xChance", stat: "craft_5x_chance", label: "5x craft chance", unit: "%", group: "Crafting", min: 0, max: 100 },
    { key: "craft10xChance", stat: "craft_10x_chance", label: "10x craft chance", unit: "%", group: "Crafting", min: 0, max: 100 },
    { key: "craft20xChance", stat: "craft_20x_chance", label: "20x craft chance", unit: "%", group: "Crafting", min: 0, max: 100 },
    { key: "craft100xChance", stat: "craft_100x_chance", label: "100x craft chance", unit: "%", group: "Crafting", min: 0, max: 100 },
    { key: "barCraftCostMulti", stat: "bar_craft_cost_multi", label: "Bar craft cost multiplier", unit: "x", group: "Crafting", min: 0, max: 1, hint: "1 = full base cost. Lower values make every craft cheaper." },
    { key: "barOutputMulti", stat: "bar_output_multi", label: "Bar output multiplier", unit: "x", group: "Crafting", min: 1, hint: "Multiplies bars from crafting and from the Transmuter Bomb." },
    { key: "bombOfPlentyMulti", stat: "bomb_of_plenty_multi", label: "Bomb of Plenty multiplier", unit: "x", group: "Bomb upgrades", min: 1, hint: "How much ore a Bomb of Plenty adds." },
    { key: "bombTransmuterMulti", stat: "bomb_transmuter_multi", label: "Transmuter bomb multiplier", unit: "x", group: "Bomb upgrades", min: 1, hint: "Direct bars produced per affected ore." },
    { key: "transApplyBopChance", stat: "bomb_trans_apply_bop_chance", label: "Transmuter applies BoP", unit: "%", group: "Bomb upgrades", min: 0, max: 100, hint: "Chance that a Transmuter mark also applies a Bomb of Plenty stack." },
    { key: "bopMakeGoldChance", stat: "bomb_of_plenty_make_gold_chance", label: "BoP turns ore golden", unit: "%", group: "Bomb upgrades", min: 0, max: 100, hint: "Chance that Bomb of Plenty turns affected ore golden." },
    { key: "goldenOreChance", stat: "golden_ore_chance", label: "Golden ore chance", unit: "%", group: "Golden ore", min: 0, max: 100 },
    { key: "goldenOreMulti", stat: "golden_ore_multi", label: "Golden ore multiplier", unit: "x", group: "Golden ore", min: 1, hint: "How much a golden ore is worth." }
  ];

  var DEFAULTS = {
    freeCraftChance: 0,
    doubleCraftChance: 0,
    tripleCraftChance: 0,
    craft5xChance: 0,
    craft10xChance: 0,
    craft20xChance: 0,
    craft100xChance: 0,
    barCraftCostMulti: 1,
    barOutputMulti: 1,
    bombOfPlentyMulti: 1,
    bombTransmuterMulti: 1,
    transApplyBopChance: 25,
    bopMakeGoldChance: 0,
    goldenOreChance: 0,
    goldenOreMulti: 5
  };

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function asNumber(v, fallback) {
    if (typeof v === "number" && isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "") {
      var n = parseFloat(v);
      if (isFinite(n)) return n;
    }
    return fallback;
  }

  function defaults() {
    var out = {};
    FIELDS.forEach(function (f) { out[f.key] = DEFAULTS[f.key]; });
    return out;
  }

  function normalizeValues(values) {
    var out = {};
    FIELDS.forEach(function (f) {
      out[f.key] = asNumber(values && values[f.key], DEFAULTS[f.key]);
    });
    return out;
  }

  function toMult(chancePercent, mult) {
    return 1 + clamp(asNumber(chancePercent, 0) / 100, 0, 1) * (mult - 1);
  }

  function craftOf(s) {
    var free = clamp(s.freeCraftChance / 100, 0, 0.99);
    return (1 / (1 - free)) *
      toMult(s.doubleCraftChance, 2) *
      toMult(s.tripleCraftChance, 3) *
      toMult(s.craft5xChance, 5) *
      toMult(s.craft10xChance, 10) *
      toMult(s.craft20xChance, 20) *
      toMult(s.craft100xChance, 100);
  }

  function scale(chance, pass, fail) {
    return chance * pass + (1 - chance) * fail;
  }

  /*
   * Expected ore from one base ore after a possible Bomb of Plenty stack.
   * `bopChance` is a fraction (0..1).
   */
  function oreOf(s, bopChance) {
    var goldChance = clamp(s.goldenOreChance / 100, 0, 1);
    var bopGoldChance = clamp(s.bopMakeGoldChance / 100, 0, 1);
    var goldMult = Math.max(1, s.goldenOreMulti);
    var bopMult = Math.max(1, s.bombOfPlentyMulti);

    var fullGoldChance = scale(goldChance, 1, bopGoldChance);
    var fullGoldMult = scale(fullGoldChance, goldMult, 1);
    var bopOre = bopMult * fullGoldMult;
    var missedOre = scale(goldChance, goldMult, 1);
    return scale(clamp(bopChance, 0, 1), bopOre, missedOre);
  }

  function craftMultiplier(values) {
    return craftOf(normalizeValues(values));
  }

  function boppedOre(values, bopChance) {
    return oreOf(normalizeValues(values), bopChance);
  }

  function effectiveCost(baseCost, costMultiplier) {
    var mult = clamp(asNumber(costMultiplier, 1), 0, 1);
    return Math.max(1, Math.floor(baseCost * mult));
  }

  function barByLevel(level) {
    var n = Math.floor(asNumber(level, 0));
    if (n < 1 || n > BARS.length) return null;
    return BARS[n - 1];
  }

  /*
   * Full comparison for the current stats. Every row is expressed per one base
   * ore; multiply by the player's base-ore amount for a real batch.
   */
  function analyse(values) {
    var s = normalizeValues(values);
    var craft = craftOf(s);
    var bopMult = Math.max(1, s.bombOfPlentyMulti);
    var transMult = Math.max(1, s.bombTransmuterMulti);
    var transBopChance = clamp(s.transApplyBopChance / 100, 0, 1);
    var bopOre = oreOf(s, 1);
    var transOre = oreOf(s, transBopChance);
    var costMultiplier = clamp(s.barCraftCostMulti, 0, 1);
    var barOutput = Math.max(1, s.barOutputMulti);

    var transition = (transMult * transOre > 0)
      ? craft * (bopOre - transOre) / (transMult * transOre)
      : Infinity;

    var rows = BARS.map(function (bar) {
      var cost = effectiveCost(bar.cost, costMultiplier);
      var bopPerOre = barOutput * craft * bopOre / cost;
      var directTransPerOre = barOutput * transMult * transOre;
      var craftedTransPerOre = barOutput * craft * transOre / cost;
      var transPerOre = directTransPerOre + craftedTransPerOre;
      var diff = transPerOre - bopPerOre;
      var tolerance = 1e-12 * Math.max(1, Math.abs(bopPerOre), Math.abs(transPerOre));
      var winner = Math.abs(diff) <= tolerance ? "tie" : (diff > 0 ? "trans" : "bop");
      var advantage = winner === "tie"
        ? 0
        : (winner === "trans" ? transPerOre / bopPerOre - 1 : bopPerOre / transPerOre - 1);

      return {
        level: bar.level,
        bar: bar,
        baseCost: bar.cost,
        effectiveCost: cost,
        bopPerOre: bopPerOre,
        bopBarsPerOre: bopPerOre,
        transPerOre: transPerOre,
        directTransPerOre: directTransPerOre,
        craftedTransPerOre: craftedTransPerOre,
        margin: (transPerOre - bopPerOre) / bopPerOre,
        advantage: advantage,
        winner: winner
      };
    });

    var firstTransIndex = -1;
    var lastBopIndex = -1;
    var tieCount = 0;
    rows.forEach(function (row, i) {
      if (row.winner === "trans" && firstTransIndex < 0) firstTransIndex = i;
      if (row.winner === "bop") lastBopIndex = i;
      if (row.winner === "tie") tieCount++;
    });

    return {
      values: s,
      craftMultiplier: craft,
      bopMultiplier: bopMult,
      transMultiplier: transMult,
      bopOre: bopOre,
      transOre: transOre,
      costMultiplier: costMultiplier,
      barOutputMultiplier: barOutput,
      transition: transition,
      baseTransition: costMultiplier > 0 ? transition / costMultiplier : Infinity,
      rows: rows,
      firstTransIndex: firstTransIndex,
      lastBopIndex: lastBopIndex,
      tieCount: tieCount
    };
  }

  /*
   * Map an ExportStats stats object into form values. Missing keys keep the
   * calculator's defaults and are reported separately so the UI can explain.
   */
  function fromAccountStats(stats) {
    var values = defaults();
    var applied = [];
    var missing = [];
    FIELDS.forEach(function (f) {
      var n = asNumber(stats ? stats[f.stat] : undefined, null);
      if (n === null) {
        missing.push(f.stat);
        return;
      }
      values[f.key] = n;
      applied.push(f.stat);
    });
    return { values: values, applied: applied, missing: missing };
  }

  global.BombData = {
    BARS: BARS,
    FIELDS: FIELDS,
    DEFAULTS: DEFAULTS,
    defaults: defaults,
    normalizeValues: normalizeValues,
    fromAccountStats: fromAccountStats,
    barByLevel: barByLevel,
    toMult: toMult,
    craftMultiplier: craftMultiplier,
    boppedOre: boppedOre,
    effectiveCost: effectiveCost,
    analyse: analyse
  };

})(typeof window !== "undefined" ? window : globalThis);
