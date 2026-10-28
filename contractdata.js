/*
 * Contract Point planner maths.
 *
 * Data comes from the wiki's Contracts page (v2.2.23):
 *   https://shminer.miraheze.org/wiki/Contracts
 * Costs follow Module:CostTable:
 *   exponential: previous raw cost x scaling
 *   linear:      previous raw cost + step
 * with overrideLevel/overrideScaling taking effect from their listed level.
 *
 * goal value = product of the factors of the upgrades mapped to that goal.
 * Goal gains are logged before they are weighted, so one CP spent on a small
 * goal does not drown out the same relative gain on a huge one.
 *
 * shortcut: contract bonuses are treated as their own multiplicative factors,
 * not added into the export's huge stat totals (for example
 * rainbow_floor_multi 8.4M). If the game turns out to sum them additively,
 * these factors should be changed to (stat + bonus) / stat.
 *
 * shortcut: portal and damage upgrades multiply the whole goal, which
 * overstates them when only part of your income uses portals or when the
 * pickaxe/bomb split is not 50/50. The README says so too.
 *
 * Exposed as window.ContractData.
 */
(function (global) {
  "use strict";

  var BD = global.BombData || null;

  var GOALS = [
    { id: "ore", label: "Ore" },
    { id: "veins", label: "Veins" },
    { id: "stars", label: "Stars" },
    { id: "bars", label: "Bars / crafting" },
    { id: "damage", label: "Damage" }
  ];

  var GOAL_IDS = GOALS.map(function (g) { return g.id; });

  /*
   * Contract upgrades in the wiki's summary order. `contracts_array` uses this
   * order (W1 0-9, W2 10-19, W3 20-25, W4 26-33).
   *
   * kind:
   *   mult         additive percentage bonus: 1 + amount * level
   *   compound     per-level multiplier: amount ^ level (the 1.08x upgrade)
   *   chance       chance x multiplier: 1 + min(1, c0 + amount*level) * (m - 1)
   *   craft        craft-multiplier ratio for triple/10x craft chance
   *   cost         bar-cost reduction: 1 / (1 - amount * level)
   *   perContract  1 + 0.01 * level * contractsCompleted
   *
   * `amount` for chance entries is percentage points per level.
   */
  var UPGRADES = [
    {
      index: 0, name: "Pickaxe Damage Per Contract", world: 1, bonus: "+1% per Contract",
      baseMax: 1, obMin: 0, kind: "perContract", goals: ["damage"], branch: "pickaxe",
      cost: {
        type: "linear", base: 10, scaling: 490,
        overrides: { 3: 1500, 5: 5000, 7: 12500, 8: 14000 },
        scalingOverrides: { 3: 1500, 5: 3500, 8: 3000 }
      }
    },
    {
      index: 1, name: "Triple Craft Chance", world: 1, bonus: "+1%",
      baseMax: 5, obMin: 0, kind: "craft", goals: ["bars"],
      amount: 1, craftKey: "tripleCraftChance", craftStat: "triple_craft_chance",
      cost: { type: "exponential", base: 14, scaling: 1.3 }
    },
    {
      index: 2, name: "Pickaxe Super Crit Chance", world: 1, bonus: "+2%",
      baseMax: 5, obMin: 0, kind: "chance", goals: ["damage"], branch: "pickaxe",
      amount: 2, chanceKey: "pickaxe_super_crit_chance", multiKey: "pickaxe_super_crit_damage",
      cost: { type: "exponential", base: 18, scaling: 1.3 }
    },
    {
      index: 3, name: "Bomb Recharge Rate", world: 1, bonus: "+3%",
      baseMax: 5, obMin: 0, kind: "mult", goals: ["damage"], branch: "bomb",
      amount: 0.03,
      cost: { type: "exponential", base: 22, scaling: 1.3 }
    },
    {
      index: 4, name: "EXP Gain", world: 1, bonus: "+10%",
      baseMax: 5, obMin: 0, kind: "mult", goals: [], amount: 0.10,
      cost: { type: "exponential", base: 26, scaling: 1.3 }
    },
    {
      index: 5, name: "Pickaxe Crit Damage", world: 1, bonus: "+8%",
      baseMax: 5, obMin: 0, kind: "mult", goals: ["damage"], branch: "pickaxe",
      amount: 0.08,
      cost: { type: "exponential", base: 30, scaling: 1.3 }
    },
    {
      index: 6, name: "Pickaxe Damage", world: 1, bonus: "+15%",
      baseMax: 3, obMin: 0, kind: "mult", goals: ["damage"], branch: "pickaxe",
      amount: 0.15,
      cost: { type: "exponential", base: 34, scaling: 1.3 }
    },
    {
      index: 7, name: "Upgrade Bar Cost", world: 1, bonus: "-5%",
      baseMax: 3, obMin: 0, kind: "cost", goals: ["bars"], amount: 0.05,
      cost: { type: "exponential", base: 38, scaling: 1.3 }
    },
    {
      index: 8, name: "Prestige Point Gain", world: 1, bonus: "+10%",
      baseMax: 3, obMin: 0, kind: "mult", goals: [], amount: 0.10,
      cost: { type: "exponential", base: 42, scaling: 1.3 }
    },
    {
      index: 9, name: "10x Craft Chance", world: 1, bonus: "+1%",
      baseMax: 1, obMin: 0, kind: "craft", goals: ["bars"],
      amount: 1, craftKey: "craft10xChance", craftStat: "craft_10x_chance",
      cost: { type: "exponential", base: 150, scaling: 1.6 }
    },
    {
      index: 10, name: "Bomb Damage Per Contract", world: 2, bonus: "+1% per Contract",
      baseMax: 1, obMin: 0, kind: "perContract", goals: ["damage"], branch: "bomb",
      cost: {
        type: "linear", base: 100, scaling: 400,
        overrides: { 3: 1500, 5: 5000, 7: 12500, 8: 14000 },
        scalingOverrides: { 3: 1500, 5: 3500, 8: 3000 }
      }
    },
    {
      index: 11, name: "Ore Sell Price", world: 2, bonus: "+15%",
      baseMax: 10, obMin: 0, kind: "mult", goals: [], amount: 0.15,
      cost: { type: "exponential", base: 75, scaling: 1.3 }
    },
    {
      index: 12, name: "Vein Income Multiplier", world: 2, bonus: "+4%",
      baseMax: 5, obMin: 0, kind: "mult", goals: ["veins"], amount: 0.04,
      cost: { type: "exponential", base: 100, scaling: 1.3 }
    },
    {
      index: 13, name: "Pickaxe and Bomb Ultra Crit Chance", world: 2, bonus: "+1%",
      baseMax: 5, obMin: 0, kind: "chance", goals: ["damage"], branch: "both", amount: 1,
      parts: [
        { branch: "pickaxe", chanceKey: "pickaxe_ultra_crit_chance", multiKey: "pickaxe_ultra_crit_damage" },
        { branch: "bomb", chanceKey: "bomb_ultra_crit_chance", multiKey: "bomb_ultra_crit_damage" }
      ],
      cost: { type: "exponential", base: 125, scaling: 1.3 }
    },
    {
      index: 14, name: "Golden Floor Multiplier", world: 2, bonus: "+3%",
      baseMax: 5, obMin: 0, kind: "mult", goals: ["ore"], amount: 0.03,
      cost: { type: "exponential", base: 150, scaling: 1.3 }
    },
    {
      index: 15, name: "Golden Vein Chance", world: 2, bonus: "+1%",
      baseMax: 5, obMin: 0, kind: "chance", goals: ["veins"],
      amount: 1, chanceKey: "golden_vein_chance", multiKey: "golden_vein_multi",
      cost: { type: "exponential", base: 175, scaling: 1.3 }
    },
    {
      index: 16, name: "Super Star Spawn Rate", world: 2, bonus: "+3%",
      baseMax: 5, obMin: 23, kind: "mult", goals: ["stars"], amount: 0.03,
      cost: { type: "exponential", base: 200, scaling: 1.3 }
    },
    {
      index: 17, name: "Base Game Speed", world: 2, bonus: "+1%",
      baseMax: 10, obMin: 23, kind: "mult", goals: ["ore", "veins", "stars", "bars", "damage"],
      branch: "both", amount: 0.01,
      cost: { type: "exponential", base: 250, scaling: 1.3 }
    },
    {
      index: 18, name: "Rainbow Floor Multi", world: 2, bonus: "+2%",
      baseMax: 10, obMin: 28, kind: "mult", goals: ["ore"], amount: 0.02,
      cost: { type: "exponential", base: 265, scaling: 1.3 }
    },
    {
      index: 19, name: "Super Star Supernova Chance", world: 2, bonus: "+0.15%",
      baseMax: 10, obMin: 28, kind: "chance", goals: ["stars"],
      amount: 0.15, chanceKey: "super_star_supernova_chance", multiKey: "super_star_supernova_multi",
      cost: { type: "exponential", base: 280, scaling: 1.3 }
    },
    {
      index: 20, name: "Rainbow Floor Chance", world: 3, bonus: "+0.30%",
      baseMax: 10, obMin: 42, kind: "chance", goals: ["ore"],
      amount: 0.30, chanceKey: "rainbow_floor_chance", multiKey: "rainbow_floor_multi",
      cost: { type: "exponential", base: 300, scaling: 1.25 }
    },
    {
      index: 21, name: "Golden Ore Chance", world: 3, bonus: "+0.20%",
      baseMax: 15, obMin: 42, kind: "chance", goals: ["ore"],
      amount: 0.20, chanceKey: "golden_ore_chance", multiKey: "golden_ore_multi",
      cost: { type: "exponential", base: 325, scaling: 1.3 }
    },
    {
      index: 22, name: "Pickaxe and Bomb Omega Crit Chance", world: 3, bonus: "+2%",
      baseMax: 15, obMin: 42, kind: "chance", goals: ["damage"], branch: "both", amount: 2,
      parts: [
        { branch: "pickaxe", chanceKey: "pickaxe_omega_crit_chance", multiKey: "pickaxe_omega_crit_damage" },
        { branch: "bomb", chanceKey: "bomb_omega_crit_chance", multiKey: "bomb_omega_crit_damage" }
      ],
      cost: { type: "exponential", base: 350, scaling: 1.3 }
    },
    {
      index: 23, name: "Pickaxe and Bomb Damage", world: 3, bonus: "1.08x",
      baseMax: 5, obMin: 45, kind: "compound", goals: ["damage"], branch: "both",
      amount: 1.08,
      cost: { type: "exponential", base: 400, scaling: 1.3 }
    },
    {
      index: 24, name: "Star Supergiant Chance", world: 3, bonus: "+0.20%",
      baseMax: 5, obMin: 50, kind: "chance", goals: ["stars"],
      amount: 0.20, chanceKey: "star_supergiant_chance", multiKey: "star_supergiant_multi",
      cost: {
        type: "exponential", base: 520, scaling: 1.25,
        scalingOverrides: { 3: 1.3 }
      }
    },
    {
      index: 25, name: "Super Star Supergiant Chance", world: 3, bonus: "+0.10%",
      baseMax: 5, obMin: 52, kind: "chance", goals: ["stars"],
      amount: 0.10, chanceKey: "super_star_supergiant_chance", multiKey: "super_star_supergiant_multi",
      cost: { type: "exponential", base: 750, scaling: 1.3 }
    },
    {
      index: 26, name: "Rainbow Vein Multiplier", world: 4, bonus: "+1%",
      baseMax: 5, obMin: 62, kind: "mult", goals: ["veins"], amount: 0.01,
      cost: { type: "exponential", base: 2500, scaling: 1.3 }
    },
    {
      index: 27, name: "Prismatic Floor Multi", world: 4, bonus: "+0.50%",
      baseMax: 5, obMin: 64, kind: "mult", goals: ["ore"], amount: 0.005,
      cost: { type: "exponential", base: 3250, scaling: 1.3 }
    },
    {
      index: 28, name: "All Star Multiplier", world: 4, bonus: "+0.65%",
      baseMax: 5, obMin: 65, kind: "mult", goals: ["stars"], amount: 0.0065,
      cost: { type: "exponential", base: 4000, scaling: 1.3 }
    },
    {
      index: 29, name: "Lootfrog Triple Spawn Chance", world: 4, bonus: "+0.10%",
      baseMax: 5, obMin: 66, kind: "mult", goals: [], amount: 0.001,
      cost: { type: "exponential", base: 4750, scaling: 1.3 }
    },
    {
      index: 30, name: "Golden Void Portal Chance", world: 4, bonus: "+0.10%",
      baseMax: 5, obMin: 67, kind: "chance", goals: ["ore"],
      amount: 0.10, chanceKey: "golden_void_portal_chance", multiKey: "golden_void_portal_multi",
      cost: { type: "exponential", base: 5500, scaling: 1.3 }
    },
    {
      index: 31, name: "All Radiant Multi", world: 4, bonus: "+1%",
      baseMax: 5, obMin: 70, kind: "mult", goals: ["stars"], amount: 0.01,
      cost: { type: "exponential", base: 6000, scaling: 1.3 }
    },
    {
      index: 32, name: "Rune Craft Multi", world: 4, bonus: "+0.50%",
      baseMax: 5, obMin: 71, kind: "mult", goals: [], amount: 0.005,
      cost: { type: "exponential", base: 6500, scaling: 1.3 }
    },
    {
      index: 33, name: "All Portal Multi", world: 4, bonus: "+0.40%",
      baseMax: 5, obMin: 73, kind: "mult", goals: ["ore"], amount: 0.004,
      cost: { type: "exponential", base: 885, scaling: 1.3 }
    }
  ];

  // Each wiki CostTable has baseMax + 14 rows in the current game version.
  var MAX_LEVELS = UPGRADES.map(function (up) { return up.baseMax + 14; });

  var costCache = [];

  function asNumber(v, fallback) {
    if (typeof v === "number" && isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "") {
      var n = parseFloat(v);
      if (isFinite(n)) return n;
    }
    return fallback;
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function round6(v) {
    return Math.round(v * 1e6) / 1e6;
  }

  function capFor(index, capIncrease) {
    var up = UPGRADES[index];
    if (!up) return 0;
    var extra = Math.max(0, Math.floor(asNumber(capIncrease, 0)));
    return Math.min(MAX_LEVELS[index], up.baseMax + extra);
  }

  function scalingForLevel(up, level) {
    var active = up.cost.scaling;
    var overrides = up.cost.scalingOverrides || {};
    var highest = -Infinity;

    Object.keys(overrides).forEach(function (key) {
      var idx = parseInt(key, 10);
      if (isFinite(idx) && idx <= level && idx > highest) {
        highest = idx;
        active = overrides[key];
      }
    });

    return active;
  }

  function baseCosts(index) {
    if (costCache[index]) return costCache[index];

    var up = UPGRADES[index];
    var arr = [0];
    var prev = 0;

    for (var level = 1; level <= MAX_LEVELS[index]; level++) {
      var raw;

      if (up.cost.type === "linear") {
        var override = up.cost.overrides && up.cost.overrides[level];
        if (override != null) raw = override;
        else if (level === 1) raw = up.cost.base;
        else raw = prev + scalingForLevel(up, level);
      } else {
        // Module:CostTable scales the raw previous cost, so a scaling
        // override takes effect from that level onwards.
        raw = level === 1 ? up.cost.base : prev * scalingForLevel(up, level);
      }

      // Module:CostTable keeps scaling from the raw previous cost, not the
      // displayed/rounded one.
      prev = raw;
      arr[level] = Math.round(raw);
    }

    costCache[index] = arr;
    return arr;
  }

  /*
   * Cost of the next level. `level` is the level being bought (1-based).
   * The cost reduction is applied as cost x (1 - r); this is an assumption
   * until it is checked against an in-game price.
   */
  function costAt(index, level, reduction) {
    var arr = baseCosts(index);
    var base = arr[level];
    if (!base) return 0;

    var r = clamp(asNumber(reduction, 0), 0, 0.99);
    return round6(base * (1 - r));
  }

  function totalCost(index, reduction) {
    var total = 0;
    for (var level = 1; level <= MAX_LEVELS[index]; level++) {
      total += costAt(index, level, reduction);
    }
    return total;
  }

  function normalizeWeights(weights) {
    var out = {};
    var sum = 0;

    GOALS.forEach(function (g) {
      var v = Math.max(0, asNumber(weights && weights[g.id], 0));
      out[g.id] = v;
      sum += v;
    });

    if (sum > 0) {
      GOALS.forEach(function (g) { out[g.id] /= sum; });
    }

    return out;
  }

  function normalizeLevels(levels, ctx) {
    var capIncrease = ctx && ctx.capIncrease;
    var out = [];

    for (var i = 0; i < UPGRADES.length; i++) {
      var cap = capFor(i, capIncrease);
      var v = Math.floor(asNumber(levels && levels[i], 0));
      out.push(clamp(v, 0, cap));
    }

    return out;
  }

  function statNumber(stats, key, fallback) {
    return asNumber(stats && stats[key], fallback);
  }

  function chanceBaseKey(up, part) {
    return up.index + (part ? ":" + part.branch : "");
  }

  function chanceBaseFor(up, part, ctx) {
    var key = chanceBaseKey(up, part);
    if (ctx && ctx.baseChances && ctx.baseChances[key] !== undefined) {
      return ctx.baseChances[key];
    }

    var source = part || up;
    var chance = statNumber(ctx && ctx.stats, source.chanceKey, 0);
    var baseLevels = (ctx && ctx.baseLevels) || (ctx && ctx.levels) || [];
    return Math.max(0, chance - up.amount * asNumber(baseLevels[up.index], 0));
  }

  function chanceMultiFor(up, part, ctx) {
    var source = part || up;
    return Math.max(1, statNumber(ctx && ctx.stats, source.multiKey, 1));
  }

  function chanceFactor(baseChance, amount, level, multi) {
    var p = clamp((baseChance + amount * level) / 100, 0, 1);
    return 1 + p * (Math.max(1, multi) - 1);
  }

  function craftBaseFor(up, ctx) {
    if (ctx && ctx.craftBase && ctx.craftBase[up.craftKey] !== undefined) {
      return ctx.craftBase[up.craftKey];
    }

    var baseLevel = ((ctx && ctx.baseLevels) || (ctx && ctx.levels) || [])[up.index] || 0;
    return Math.max(0, statNumber(ctx && ctx.stats, up.craftStat, 0) - up.amount * baseLevel);
  }

  function isCapped(up, level, ctx) {
    if (up.parts) {
      return up.parts.every(function (part) {
        return chanceBaseFor(up, part, ctx) + up.amount * level >= 100;
      });
    }
    if (up.kind === "craft") {
      return craftBaseFor(up, ctx) + up.amount * level >= 100;
    }
    if (up.kind !== "chance") return false;
    return chanceBaseFor(up, null, ctx) + up.amount * level >= 100;
  }

  function craftFactor(up, level, ctx) {
    var baseKey = up.craftKey;
    var base = craftBaseFor(up, ctx);

    var p0 = clamp(base / 100, 0, 1);
    var p1 = clamp((base + up.amount * level) / 100, 0, 1);
    var n = baseKey === "tripleCraftChance" ? 3 : 10;

    if (BD && typeof BD.craftMultiplier === "function") {
      var source = (ctx && ctx.craftValues) || (BD.defaults ? BD.defaults() : {});
      var before = BD.normalizeValues(source);
      var after = BD.normalizeValues(source);
      before[baseKey] = base;
      after[baseKey] = clamp(base + up.amount * level, 0, 100);

      var denom = BD.craftMultiplier(before);
      if (denom > 0) return BD.craftMultiplier(after) / denom;
    }

    return (1 + p1 * (n - 1)) / (1 + p0 * (n - 1));
  }

  function factorFor(up, level, ctx) {
    switch (up.kind) {
      case "mult":
        return 1 + up.amount * level;
      case "compound":
        return Math.pow(up.amount, level);
      case "chance":
        return chanceFactor(
          chanceBaseFor(up, null, ctx),
          up.amount,
          level,
          chanceMultiFor(up, null, ctx)
        );
      case "craft":
        return craftFactor(up, level, ctx);
      case "cost":
        return 1 / Math.max(1e-9, 1 - up.amount * level);
      case "perContract":
        return 1 + 0.01 * level * Math.max(0, asNumber(ctx && ctx.contractsCompleted, 0));
      default:
        return 1;
    }
  }

  function damageValues(levels, ctx) {
    var pickaxe = 1;
    var bomb = 1;

    UPGRADES.forEach(function (up) {
      if (up.goals.indexOf("damage") < 0) return;
      var level = levels[up.index];

      if (up.parts) {
        up.parts.forEach(function (part) {
          var f = chanceFactor(
            chanceBaseFor(up, part, ctx),
            up.amount,
            level,
            chanceMultiFor(up, part, ctx)
          );
          if (part.branch === "pickaxe") pickaxe *= f;
          else if (part.branch === "bomb") bomb *= f;
        });
        return;
      }

      var factor = factorFor(up, level, ctx);
      if (up.branch === "pickaxe") pickaxe *= factor;
      else if (up.branch === "bomb") bomb *= factor;
      else { pickaxe *= factor; bomb *= factor; }
    });

    return {
      pickaxe: pickaxe,
      bomb: bomb,
      average: (pickaxe + bomb) / 2
    };
  }

  function goalValues(levels, ctx) {
    ctx = ctx || fromExport({});
    var lv = normalizeLevels(levels, ctx);
    var out = {};

    GOALS.forEach(function (goal) {
      if (goal.id === "damage") return;
      var value = 1;

      UPGRADES.forEach(function (up) {
        if (up.goals.indexOf(goal.id) < 0) return;
        value *= factorFor(up, lv[up.index], ctx);
      });

      out[goal.id] = value;
    });

    out.damage = damageValues(lv, ctx).average;
    return out;
  }

  /*
   * Build a planner context from an ExportStats stats object. It also records
   * the base chance of every chance upgrade (export chance minus the contract
   * contribution) so changing levels does not change the underlying chance.
   */
  function fromExport(input) {
    var stats = input && input.stats ? input.stats : (input || {});
    var arr = Array.isArray(stats.contracts_array) ? stats.contracts_array : [];
    var capIncrease = Math.max(0, Math.floor(asNumber(stats.contract_cap_increase, 0)));
    var levels = [];

    for (var i = 0; i < UPGRADES.length; i++) {
      var cap = capFor(i, capIncrease);
      var raw = Math.floor(asNumber(arr[i], 0));
      levels.push(clamp(raw, 0, cap));
    }

    var ctx = {
      capIncrease: capIncrease,
      obeliskLevel: Math.max(0, asNumber(stats.obelisk_level, 0)),
      costReduction: clamp(asNumber(stats.contract_upgrade_cost_reduction, 0), 0, 0.99),
      contractsCompleted: 0,
      levels: levels,
      baseLevels: levels.slice(),
      stats: {},
      baseChances: {},
      craftBase: {},
      craftValues: null
    };

    UPGRADES.forEach(function (up) {
      if (up.parts) {
        up.parts.forEach(function (part) {
          ctx.stats[part.chanceKey] = statNumber(stats, part.chanceKey, 0);
          ctx.stats[part.multiKey] = statNumber(stats, part.multiKey, 1);
          ctx.baseChances[chanceBaseKey(up, part)] = Math.max(
            0,
            ctx.stats[part.chanceKey] - up.amount * levels[up.index]
          );
        });
      } else if (up.kind === "chance") {
        ctx.stats[up.chanceKey] = statNumber(stats, up.chanceKey, 0);
        ctx.stats[up.multiKey] = statNumber(stats, up.multiKey, 1);
        ctx.baseChances[chanceBaseKey(up, null)] = Math.max(
          0,
          ctx.stats[up.chanceKey] - up.amount * levels[up.index]
        );
      }
    });

    ctx.stats.triple_craft_chance = statNumber(stats, "triple_craft_chance", 0);
    ctx.stats.craft_10x_chance = statNumber(stats, "craft_10x_chance", 0);
    ctx.craftBase.tripleCraftChance = Math.max(0,
      ctx.stats.triple_craft_chance - UPGRADES[1].amount * levels[1]);
    ctx.craftBase.craft10xChance = Math.max(0,
      ctx.stats.craft_10x_chance - UPGRADES[9].amount * levels[9]);

    if (BD && typeof BD.fromAccountStats === "function") {
      ctx.craftValues = BD.fromAccountStats(stats).values;
    }

    return ctx;
  }

  // `before` is goalValues(levels, ctx), computed once by rankNext for all candidates.
  function evaluateCandidate(levels, ctx, weights, index, before) {
    var up = UPGRADES[index];
    var cap = capFor(index, ctx.capIncrease);
    var level = levels[index];
    var maxed = level >= cap;
    var locked = up.obMin > 0 && asNumber(ctx.obeliskLevel, 0) < up.obMin;
    var cost = maxed || locked ? null : costAt(index, level + 1, ctx.costReduction);
    var effects = {};
    var logGain = 0;

    GOALS.forEach(function (g) { effects[g.id] = 0; });

    if (!maxed && !locked) {
      var next = levels.slice();
      next[index] = level + 1;
      var after = goalValues(next, ctx);

      GOALS.forEach(function (g) {
        var ratio = before[g.id] > 0 && after[g.id] > 0 ? after[g.id] / before[g.id] : 1;
        if (!isFinite(ratio) || ratio < 0) ratio = 1;
        var log = Math.log(ratio);
        if (Math.abs(log) < 1e-15) log = 0;
        effects[g.id] = ratio - 1;
        logGain += weights[g.id] * log;
      });
    }

    var noEffect = up.goals.length === 0 || (!maxed && !locked && logGain <= 1e-15);
    var score = maxed || locked || noEffect || !(cost > 0) ? 0 : logGain / cost;

    return {
      index: index,
      name: up.name,
      world: up.world,
      bonus: up.bonus,
      goals: up.goals.slice(),
      level: level,
      cap: cap,
      maxed: maxed,
      locked: locked,
      obMin: up.obMin,
      cost: cost,
      score: score,
      logGain: logGain,
      effects: effects,
      noEffect: noEffect,
      capped: isCapped(up, level, ctx),
      rank: null
    };
  }

  function rankNext(levels, ctx, weights) {
    ctx = ctx || fromExport({});
    var lv = normalizeLevels(levels, ctx);
    var w = normalizeWeights(weights);
    var rows = [];
    var before = goalValues(lv, ctx);

    for (var i = 0; i < UPGRADES.length; i++) {
      rows.push(evaluateCandidate(lv, ctx, w, i, before));
    }

    var ranked = rows.filter(function (r) {
      return !r.maxed && !r.locked && !r.noEffect && r.logGain > 0;
    }).sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return a.index - b.index;
    });

    ranked.forEach(function (r, n) { r.rank = n + 1; });

    var rest = rows.filter(function (r) { return ranked.indexOf(r) < 0; })
      .sort(function (a, b) { return a.index - b.index; });

    return ranked.concat(rest);
  }

  function refundFor(levels, ctx) {
    ctx = ctx || fromExport({});
    var lv = normalizeLevels(levels, ctx);
    var total = 0;

    for (var i = 0; i < UPGRADES.length; i++) {
      for (var level = 1; level <= lv[i]; level++) {
        total += costAt(i, level, ctx.costReduction);
      }
    }

    return round6(total);
  }

  function respecBudget(spareCp, levels, ctx) {
    return round6(Math.max(0, asNumber(spareCp, 0)) + refundFor(levels, ctx));
  }

  /*
   * Per-upgrade totals for the summary view. `spent` is the CP already in the
   * owned levels (the respec refund value), and `toMax` is what remains to buy
   * every level up to the current cap. `next` is null once the upgrade is maxed.
   */
  function summaryFor(levels, ctx) {
    ctx = ctx || fromExport({});
    var lv = normalizeLevels(levels, ctx);
    var rows = [];
    var totals = {
      level: 0, cap: 0, remaining: 0,
      spent: 0, toMax: 0, total: 0,
      maxed: 0, locked: 0
    };

    UPGRADES.forEach(function (up) {
      var cap = capFor(up.index, ctx.capIncrease);
      var level = lv[up.index];
      var spent = 0;
      var toMax = 0;
      var n;

      for (n = 1; n <= level; n++) spent += costAt(up.index, n, ctx.costReduction);
      for (n = level + 1; n <= cap; n++) toMax += costAt(up.index, n, ctx.costReduction);

      var locked = up.obMin > 0 && asNumber(ctx.obeliskLevel, 0) < up.obMin;
      var maxed = level >= cap;

      spent = round6(spent);
      toMax = round6(toMax);

      rows.push({
        index: up.index,
        name: up.name,
        world: up.world,
        bonus: up.bonus,
        level: level,
        cap: cap,
        remaining: cap - level,
        next: maxed ? null : costAt(up.index, level + 1, ctx.costReduction),
        spent: spent,
        toMax: toMax,
        total: round6(spent + toMax),
        maxed: maxed,
        locked: locked,
        obMin: up.obMin
      });

      totals.level += level;
      totals.cap += cap;
      totals.remaining += cap - level;
      totals.spent += spent;
      totals.toMax += toMax;
      if (maxed) totals.maxed++;
      if (locked) totals.locked++;
    });

    totals.spent = round6(totals.spent);
    totals.toMax = round6(totals.toMax);
    totals.total = round6(totals.spent + totals.toMax);

    return { rows: rows, totals: totals };
  }

  // Gains are measured against compareLevels when given (respec vs current), else the start levels.
  function planSpend(levels, ctx, weights, budget, compareLevels) {
    ctx = ctx || fromExport({});
    var w = normalizeWeights(weights);
    var start = normalizeLevels(levels, ctx);
    var current = start.slice();
    var pool = Math.max(0, asNumber(budget, 0));
    var spent = 0;
    var buys = [];
    var guard = 0;

    while (guard++ < 2000) {
      var ranking = rankNext(current, ctx, w);
      var pick = null;

      for (var i = 0; i < ranking.length; i++) {
        var row = ranking[i];
        if (row.maxed || row.locked || row.noEffect || !(row.score > 0)) continue;
        if (row.cost <= pool - spent + 1e-9) { pick = row; break; }
      }

      if (!pick) break;

      current[pick.index] += 1;
      spent += pick.cost;
      buys.push({
        index: pick.index,
        name: pick.name,
        world: pick.world,
        level: current[pick.index],
        cost: pick.cost,
        runningTotal: round6(spent),
        score: pick.score
      });
    }

    spent = round6(spent);
    var before = goalValues(compareLevels ? normalizeLevels(compareLevels, ctx) : start, ctx);
    var after = goalValues(current, ctx);
    var goals = {};
    var weightedLog = 0;

    GOALS.forEach(function (g) {
      var ratio = before[g.id] > 0 && after[g.id] > 0 ? after[g.id] / before[g.id] : 1;
      if (!isFinite(ratio) || ratio < 0) ratio = 1;
      goals[g.id] = {
        before: before[g.id],
        after: after[g.id],
        gain: ratio - 1
      };
      weightedLog += w[g.id] * Math.log(ratio);
    });

    return {
      startLevels: start,
      levels: current,
      buys: buys,
      budget: round6(pool),
      spent: spent,
      left: round6(Math.max(0, pool - spent)),
      goals: goals,
      weightedLog: weightedLog,
      weightedGain: Math.exp(weightedLog) - 1
    };
  }

  function zeroLevels() {
    return UPGRADES.map(function () { return 0; });
  }

  global.ContractData = {
    GOALS: GOALS,
    GOAL_IDS: GOAL_IDS,
    UPGRADES: UPGRADES,
    MAX_LEVELS: MAX_LEVELS,
    costAt: costAt,
    capFor: capFor,
    goalValues: goalValues,
    rankNext: rankNext,
    planSpend: planSpend,
    fromExport: fromExport,
    totalCost: totalCost,
    refundFor: refundFor,
    respecBudget: respecBudget,
    summaryFor: summaryFor,
    normalizeWeights: normalizeWeights,
    normalizeLevels: normalizeLevels,
    zeroLevels: zeroLevels
  };

})(typeof window !== "undefined" ? window : globalThis);
