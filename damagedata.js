/*
 * Max damage calculator maths.
 *
 * The account export already contains the player's final pickaxe/bomb stats
 * at export time.  That includes any consumables that were active and the
 * contract levels owned at that moment.  This module removes the known
 * consumable and damage-contract contributions, then rebuilds the stats for a
 * chosen scenario (for example "all damage consumables on, damage contracts
 * maxed").
 *
 * Pure functions, no DOM.  Exposed as window.DamageData.
 */
(function (global) {
  "use strict";

  var CD = global.ContractData || null;

  /*
   * item_uptime_array indexes (wiki: Guides/Working With ExportStats).
   * Only the items that affect damage, attack speed, or game speed are listed.
   */
  var ITEMS = [
    { id: "rockCake", name: "Rock Cake", index: 2, group: "damage", effect: "+30% pickaxe damage (adds with Primal Meat)", short: "+30% pickaxe damage" },
    { id: "primalMeat", name: "Primal Meat", index: 3, group: "damage", effect: "+100% pickaxe damage (Golden: +200%)", short: "+100% pickaxe damage" },
    { id: "hamburger", name: "Hamburger", index: 14, group: "damage", effect: "Pickaxe and bomb damage multiplier (Golden: 2x)", short: "damage multiplier" },
    { id: "apple", name: "Apple", index: 0, group: "crit", effect: "+10% pickaxe crit chance", short: "+10% crit chance" },
    { id: "pike", name: "Pike", index: 5, group: "crit", effect: "+30% pickaxe crit damage", short: "+30% crit damage" },
    { id: "plums", name: "Juicy Plums", index: 6, group: "crit", effect: "+25% pickaxe crit chance and +25% crit damage", short: "+25% crit chance & damage" },
    { id: "chaosTotem", name: "Chaos Totem", index: 9, group: "bomb", effect: "3.00x bomb damage (Golden: 9.00x)", short: "3x bomb damage" },
    { id: "bananaCoffee", name: "Banana Coffee", index: 1, group: "speed", effect: "1.20x pickaxe attack speed", short: "1.20x attack speed" },
    { id: "blueCow", name: "Blue Cow", index: 11, group: "speed", effect: "2x game speed", short: "2x game speed" }
  ];

  var ITEM_BY_ID = {};
  ITEMS.forEach(function (item) { ITEM_BY_ID[item.id] = item; });

  var DAMAGE_CONTRACT_INDICES = [0, 2, 5, 6, 10, 13, 22, 23];

  function asNumber(v, fallback) {
    if (typeof v === "number" && isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "") {
      var n = parseFloat(v);
      if (isFinite(n)) return n;
    }
    return fallback;
  }

  function arr(stats, key, index) {
    var a = stats && stats[key];
    return Array.isArray(a) ? a[index] : undefined;
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function clamp01(v) {
    return clamp(v, 0, 1);
  }

  function isActive(stats, index) {
    var v = arr(stats, "item_uptime_array", index);
    return typeof v === "number" && isFinite(v) && v > 0;
  }

  function defaultItems(on) {
    var out = {};
    ITEMS.forEach(function (item) { out[item.id] = !!on; });
    return out;
  }

  function activeItemsFromStats(stats) {
    var out = {};
    ITEMS.forEach(function (item) { out[item.id] = isActive(stats, item.index); });
    return out;
  }

  function goldenFromStats(stats) {
    return {
      primalMeat: asNumber(stats && stats.black_hole_level, 0) >= 13,
      hamburger: asNumber(arr(stats, "fishing_legendary_tribute_levels_array", 10), 0) >= 2,
      chaosTotem: false
    };
  }

  function hamburgerMultiplier(stats, golden) {
    var level = clamp(asNumber(arr(stats, "workshop_array", 22), 0), 0, 47);
    return (3 + 0.12 * level) * (golden ? 2 : 1);
  }

  function itemBaseFactor(stats, items, golden) {
    golden = golden || { primalMeat: false, hamburger: false, chaosTotem: false };
    var rockCake = items.rockCake ? 0.3 : 0;
    var primalMeat = items.primalMeat ? (golden.primalMeat ? 2 : 1) : 0;
    var hamburger = items.hamburger ? hamburgerMultiplier(stats, golden.hamburger) : 1;
    return (1 + rockCake + primalMeat) * hamburger;
  }

  function itemBombFactor(stats, items, golden) {
    golden = golden || { primalMeat: false, hamburger: false, chaosTotem: false };
    var hamburger = items.hamburger ? hamburgerMultiplier(stats, golden.hamburger) : 1;
    var chaos = items.chaosTotem ? (golden.chaosTotem ? 9 : 3) : 1;
    return hamburger * chaos;
  }

  function itemCritChance(items) {
    return (items.apple ? 10 : 0) + (items.plums ? 25 : 0);
  }

  function itemCritDamage(items) {
    return (items.pike ? 0.3 : 0) + (items.plums ? 0.25 : 0);
  }

  function itemAttackSpeed(items) {
    return items.bananaCoffee ? 1.2 : 1;
  }

  function itemGameSpeed(items) {
    return items.blueCow ? 2 : 1;
  }

  function defaultStats() {
    var workshop = [];
    for (var i = 0; i < 37; i++) workshop.push(0);
    return {
      pickaxe_damage: 1000,
      pickaxe_crit_chance: 0,
      pickaxe_crit_damage: 1,
      pickaxe_super_crit_chance: 0,
      pickaxe_super_crit_damage: 1,
      pickaxe_ultra_crit_chance: 0,
      pickaxe_ultra_crit_damage: 1,
      pickaxe_omega_crit_chance: 0,
      pickaxe_omega_crit_damage: 1,
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
      workshop_array: workshop,
      black_hole_level: 0,
      obelisk_level: 0,
      fishing_legendary_tribute_levels_array: [],
      item_uptime_array: [],
      contracts_array: [],
      contract_cap_increase: 0,
      contracts_completed: 0
    };
  }

  function statsSummary(stats) {
    return {
      pickaxeDamage: Math.max(0, asNumber(stats && stats.pickaxe_damage, 0)),
      critChance: Math.max(0, asNumber(stats && stats.pickaxe_crit_chance, 0)),
      critDamage: Math.max(1, asNumber(stats && stats.pickaxe_crit_damage, 1)),
      superChance: Math.max(0, asNumber(stats && stats.pickaxe_super_crit_chance, 0)),
      superDamage: Math.max(1, asNumber(stats && stats.pickaxe_super_crit_damage, 1)),
      ultraChance: Math.max(0, asNumber(stats && stats.pickaxe_ultra_crit_chance, 0)),
      ultraDamage: Math.max(1, asNumber(stats && stats.pickaxe_ultra_crit_damage, 1)),
      omegaChance: Math.max(0, asNumber(stats && stats.pickaxe_omega_crit_chance, 0)),
      omegaDamage: Math.max(1, asNumber(stats && stats.pickaxe_omega_crit_damage, 1)),
      attackSpeed: Math.max(0, asNumber(stats && stats.pickaxe_attack_speed_per_second, 0)),
      gameSpeed: Math.max(0.01, asNumber(stats && stats.game_speed_multi, 1)),
      bombDamage: Math.max(0, asNumber(stats && stats.bomb_damage, 0)),
      bombAdditional: clamp(1 + asNumber(stats && stats.bomb_additional_multiplier, 0), 1, 99999),
      bombCritChance: Math.max(0, asNumber(stats && stats.bomb_crit_chance, 0)),
      bombCritDamage: Math.max(1, asNumber(stats && stats.bomb_crit_damage, 1)),
      bombSuperChance: Math.max(0, asNumber(stats && stats.bomb_super_crit_chance, 0)),
      bombSuperDamage: Math.max(1, asNumber(stats && stats.bomb_super_crit_damage, 1)),
      bombUltraDamage: Math.max(1, asNumber(stats && stats.bomb_ultra_crit_damage, 1)),
      bombOmegaDamage: Math.max(1, asNumber(stats && stats.bomb_omega_crit_damage, 1)),
      hamburgerLevel: clamp(asNumber(arr(stats, "workshop_array", 22), 0), 0, 47)
    };
  }

  function contractContext(stats, options) {
    if (!CD) return null;

    var opts = options || {};
    var ctx = CD.fromExport(stats || {});
    ctx.contractsCompleted = Math.max(0, asNumber(opts.contractsCompleted, 0));
    ctx.capIncrease = Math.max(0, Math.floor(asNumber(opts.contractCapIncrease, ctx.capIncrease)));

    var currentLevels = CD.normalizeLevels(ctx.levels, ctx);
    var maxLevels = currentLevels.slice();
    DAMAGE_CONTRACT_INDICES.forEach(function (index) {
      var up = CD.UPGRADES[index];
      var locked = up.obMin > 0 && asNumber(ctx.obeliskLevel, 0) < up.obMin;
      maxLevels[index] = locked ? currentLevels[index] : CD.capFor(index, ctx.capIncrease);
    });

    return {
      ctx: ctx,
      currentLevels: currentLevels,
      maxLevels: maxLevels,
      current: CD.damageModel(currentLevels, ctx),
      maxed: CD.damageModel(maxLevels, ctx)
    };
  }

  function rowKey(row) {
    return row.index + ":" + (row.branch || "");
  }

  function contractRows(currentModel, maxModel) {
    var maxByKey = {};
    maxModel.rows.forEach(function (row) { maxByKey[rowKey(row)] = row; });

    return currentModel.rows.map(function (row) {
      var max = maxByKey[rowKey(row)] || row;
      return {
        index: row.index,
        name: row.name,
        world: row.world,
        bonus: row.bonus,
        kind: row.kind,
        branch: row.branch,
        currentLevel: row.level,
        maxLevel: max.level,
        obMin: row.obMin,
        locked: row.locked,
        currentFactor: row.factor,
        maxFactor: max.factor,
        currentChance: row.chance,
        maxChance: max.chance
      };
    });
  }

  /*
   * A crit tier can only happen if every tier before it also rolled.
   * The expected hit uses the unconditional probability of each outcome;
   * the maximum hit uses the highest tier that has a non-zero chance.
   */
  function hitModel(base, critChance, critDamage, superChance, superDamage, ultraChance, ultraDamage, omegaChance, omegaDamage) {
    var pCrit = clamp01(critChance / 100);
    var pSuper = clamp01(superChance / 100);
    var pUltra = clamp01(ultraChance / 100);
    var pOmega = clamp01(omegaChance / 100);

    var critTotal = Math.max(1, critDamage);
    var superTotal = critTotal * Math.max(1, superDamage);
    var ultraTotal = superTotal * Math.max(1, ultraDamage);
    var omegaTotal = ultraTotal * Math.max(1, omegaDamage);

    var canCrit = pCrit > 0;
    var canSuper = canCrit && pSuper > 0;
    var canUltra = canSuper && pUltra > 0;
    var canOmega = canUltra && pOmega > 0;

    var tiers = [
      { id: "plain", name: "Plain hit", chance: 1 - pCrit, damage: base, multiplier: 1 },
      { id: "crit", name: "Crit", chance: pCrit * (1 - pSuper), damage: base * critTotal, multiplier: critTotal },
      { id: "super", name: "Super crit", chance: pCrit * pSuper * (1 - pUltra), damage: base * superTotal, multiplier: superTotal },
      { id: "ultra", name: "Ultra crit", chance: pCrit * pSuper * pUltra * (1 - pOmega), damage: base * ultraTotal, multiplier: ultraTotal },
      { id: "omega", name: "Omega crit", chance: pCrit * pSuper * pUltra * pOmega, damage: base * omegaTotal, multiplier: omegaTotal }
    ];

    var expected = 0;
    tiers.forEach(function (tier) { expected += tier.chance * tier.damage; });

    var maxTier = canOmega ? "omega" : canUltra ? "ultra" : canSuper ? "super" : canCrit ? "crit" : "plain";
    var maxTierInfo = tiers.filter(function (tier) { return tier.id === maxTier; })[0];
    var maxChance = maxTier === "omega" ? pCrit * pSuper * pUltra * pOmega
      : maxTier === "ultra" ? pCrit * pSuper * pUltra
      : maxTier === "super" ? pCrit * pSuper
      : maxTier === "crit" ? pCrit
      : 1;

    return {
      tiers: tiers,
      expected: expected,
      max: maxTierInfo.damage,
      maxTier: maxTier,
      maxTierName: maxTierInfo.name,
      maxChance: maxChance
    };
  }

  function ratio(a, b) {
    if (!(b > 0) || !isFinite(a) || !isFinite(b)) return null;
    return a / b;
  }

  function computeDamage(stats, options) {
    var opts = options || {};
    var source = stats || defaultStats();
    var summary = statsSummary(source);
    var golden = Object.assign({}, goldenFromStats(source), opts.golden || {});
    var activeItems = activeItemsFromStats(source);
    var selectedItems = opts.items
      ? Object.assign({}, defaultItems(false), opts.items)
      : defaultItems(true);
    var contracts = contractContext(source, opts);
    var warnings = [];

    if (!contracts) {
      warnings.push("Contract data is unavailable, so contract levels cannot be modelled.");
    }

    var currentContract = contracts ? contracts.current : null;
    var maxedContract = contracts ? contracts.maxed : null;
    var selectedContract = opts.contractMode === "current" ? currentContract : maxedContract;

    // Remove the known active consumables and current contract factors from
    // the exported totals.  These are the stable "base" values every
    // scenario is rebuilt from.
    var activeBaseFactor = itemBaseFactor(source, activeItems, golden);
    var activeBombFactor = itemBombFactor(source, activeItems, golden);
    var activeCritChance = itemCritChance(activeItems);
    var activeCritDamage = itemCritDamage(activeItems);
    var activeAttackSpeed = itemAttackSpeed(activeItems);
    var activeGameSpeed = itemGameSpeed(activeItems);

    var pickaxeBase = summary.pickaxeDamage /
      Math.max(1e-12, currentContract ? currentContract.pickaxe.base : 1) /
      Math.max(1e-12, activeBaseFactor);
    var critDamageBase = summary.critDamage /
      Math.max(1e-12, currentContract ? currentContract.pickaxe.critDamage : 1) - activeCritDamage;
    var critChanceBase = summary.critChance - activeCritChance;
    var bombBase = summary.bombDamage * summary.bombAdditional /
      Math.max(1e-12, currentContract ? currentContract.bomb.base : 1) /
      Math.max(1e-12, activeBombFactor);
    var attackSpeedBase = summary.attackSpeed / Math.max(1e-12, activeAttackSpeed);
    var gameSpeedBase = summary.gameSpeed / Math.max(1e-12, activeGameSpeed);

    function scenario(items, contractModel) {
      var model = contractModel || { pickaxe: { base: 1, critDamage: 1, chances: {} }, bomb: { base: 1, chances: {} } };
      var base = pickaxeBase * itemBaseFactor(source, items, golden) * model.pickaxe.base;
      var critDamage = Math.max(1, (critDamageBase + itemCritDamage(items)) * model.pickaxe.critDamage);
      var critChance = Math.max(0, critChanceBase + itemCritChance(items));

      var superInfo = model.pickaxe.chances.super || { chance: 0 };
      var ultraInfo = model.pickaxe.chances.ultra || { chance: 0 };
      var omegaInfo = model.pickaxe.chances.omega || { chance: 0 };
      var superChance = superInfo.chance * 100;
      var ultraChance = ultraInfo.chance * 100;
      var omegaChance = omegaInfo.chance * 100;

      var pickaxeHit = hitModel(base, critChance, critDamage, superChance, summary.superDamage,
        ultraChance, summary.ultraDamage, omegaChance, summary.omegaDamage);

      var attackSpeed = attackSpeedBase * itemAttackSpeed(items);
      var gameSpeed = gameSpeedBase * itemGameSpeed(items);
      var pickaxeDps = pickaxeHit.expected * attackSpeed * gameSpeed;

      var bombModelBase = bombBase * itemBombFactor(source, items, golden) * model.bomb.base;
      var bombUltraInfo = model.bomb.chances.ultra || { chance: 0 };
      var bombOmegaInfo = model.bomb.chances.omega || { chance: 0 };
      var bombHit = hitModel(bombModelBase, summary.bombCritChance, summary.bombCritDamage,
        summary.bombSuperChance, summary.bombSuperDamage,
        bombUltraInfo.chance * 100, summary.bombUltraDamage,
        bombOmegaInfo.chance * 100, summary.bombOmegaDamage);

      return {
        pickaxe: {
          base: base,
          critChance: critChance,
          critDamage: critDamage,
          superChance: superChance,
          superDamage: summary.superDamage,
          ultraChance: ultraChance,
          ultraDamage: summary.ultraDamage,
          omegaChance: omegaChance,
          omegaDamage: summary.omegaDamage,
          attackSpeed: attackSpeed,
          gameSpeed: gameSpeed,
          hit: pickaxeHit,
          dps: pickaxeDps,
          itemFactor: itemBaseFactor(source, items, golden),
          contractBaseFactor: model.pickaxe.base,
          contractCritFactor: model.pickaxe.critDamage
        },
        bomb: {
          base: bombModelBase,
          critChance: summary.bombCritChance,
          critDamage: summary.bombCritDamage,
          superChance: summary.bombSuperChance,
          superDamage: summary.bombSuperDamage,
          ultraChance: bombUltraInfo.chance * 100,
          ultraDamage: summary.bombUltraDamage,
          omegaChance: bombOmegaInfo.chance * 100,
          omegaDamage: summary.bombOmegaDamage,
          hit: bombHit,
          dps: bombHit.expected,
          itemFactor: itemBombFactor(source, items, golden),
          contractBaseFactor: model.bomb.base
        }
      };
    }

    var current = scenario(activeItems, currentContract);
    var selected = scenario(selectedItems, selectedContract);

    if (!(summary.pickaxeDamage > 0)) {
      warnings.push("Pickaxe damage is 0. Import an account or enter the base stats in the editor below.");
    }
    if (summary.critChance > 100) {
      warnings.push("Pickaxe crit chance is above 100%; the extra is ignored when averaging hits.");
    }
    if (contracts && asNumber(opts.contractsCompleted, 0) === 0) {
      var perContract = contracts.current.rows.filter(function (row) {
        return row.index === 0 || row.index === 10;
      });
      var owned = perContract.some(function (row) { return row.level > 0; });
      if (owned) {
        warnings.push("Contracts completed is 0, so the two \"+1% per Contract\" upgrades add nothing. Enter your completed contracts above.");
      }
    }

    var contractRowsResult = contracts ? contractRows(contracts.current, contracts.maxed) : [];
    if (contracts) {
      var lockedNames = [];
      contractRowsResult.forEach(function (row) {
        if (!row.locked) return;
        var label = row.name.replace(/ \((pickaxe|bomb)\)$/, "");
        if (lockedNames.indexOf(label) < 0) lockedNames.push(label);
      });
      if (lockedNames.length) {
        warnings.push("OB-locked damage contracts stay at their current level: " +
          lockedNames.join(", ") + " (OB " + contracts.ctx.obeliskLevel + "). Raise the OB level in Your stats to max them.");
      }
    }

    return {
      stats: summary,
      activeItems: activeItems,
      items: selectedItems,
      golden: golden,
      contracts: contracts ? {
        currentLevels: contracts.currentLevels,
        maxLevels: contracts.maxLevels,
        current: contracts.current,
        maxed: contracts.maxed,
        rows: contractRowsResult,
        capIncrease: contracts.ctx.capIncrease,
        completed: contracts.ctx.contractsCompleted
      } : null,
      current: current,
      scenario: selected,
      deltas: {
        maxHit: ratio(selected.pickaxe.hit.max, current.pickaxe.hit.max),
        expected: ratio(selected.pickaxe.hit.expected, current.pickaxe.hit.expected),
        dps: ratio(selected.pickaxe.dps, current.pickaxe.dps),
        bombMaxHit: ratio(selected.bomb.hit.max, current.bomb.hit.max)
      },
      warnings: warnings
    };
  }

  global.DamageData = {
    ITEMS: ITEMS,
    ITEM_BY_ID: ITEM_BY_ID,
    DAMAGE_CONTRACT_INDICES: DAMAGE_CONTRACT_INDICES,
    defaultStats: defaultStats,
    defaultItems: defaultItems,
    activeItemsFromStats: activeItemsFromStats,
    goldenFromStats: goldenFromStats,
    hamburgerMultiplier: hamburgerMultiplier,
    itemBaseFactor: itemBaseFactor,
    itemBombFactor: itemBombFactor,
    itemCritChance: itemCritChance,
    itemCritDamage: itemCritDamage,
    itemAttackSpeed: itemAttackSpeed,
    itemGameSpeed: itemGameSpeed,
    statsSummary: statsSummary,
    hitModel: hitModel,
    computeDamage: computeDamage
  };

})(typeof window !== "undefined" ? window : globalThis);
