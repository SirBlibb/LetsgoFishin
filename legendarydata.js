/*
 * Legendary fish maths for Idle Obelisk Miner.
 *
 * A dock rolls for its legendary fish whenever its tick meter fills, but only
 * if every fish in that dock has a Polychrome card and the fourth fish is at
 * 100% catch chance or better. The legendary chance is one 1/150,000 step per
 * full 100% of last-fish catch chance (capped at 9 steps), and a fuelled Angler
 * drone divides the denominator by 1 + 2% x (grade + 1).
 *
 * Exposed as window.LegendaryData. Pure functions, no DOM.
 */
(function (global) {
  "use strict";

  var FM = global.FishModel || null;
  var ES = global.ExportStats || null;

  var BASE_TICK_SECONDS = 60;
  var LEGENDARY_DENOMINATOR = 150000;
  var LEGENDARY_MAX_STEPS = 9;
  var LEGENDARY_STEP_SIZE = 100;
  var ANGLER_BONUS_PER_GRADE = 0.02;
  var ANGLER_BUFF_TICK_CHANCE = 0.01;
  var ANGLER_BUFF_TICKS_PER_GRADE = 6;
  var ANGLER_PASSIVE_TICKS = 2;
  var ANGLER_PASSIVE_BASE_SECONDS = 1140;
  var ANGLER_PASSIVE_SECONDS_PER_LEVEL = 40;

  // Last fish rating comes from the wiki's Aquarium tables.
  var DOCKS = [
    { id: "Lake", tier: 1, lastFish: "Golden Trout", rating: 490, baseTicks: 5, legendary: "Rainbow Trout" },
    { id: "Desert", tier: 1, lastFish: "Scarabshoe Crab", rating: 1170, baseTicks: 8, legendary: "Dune's Eelworm" },
    { id: "Tundra", tier: 1, lastFish: "Auroreel", rating: 2800, baseTicks: 12, legendary: "Glacial Shellstealer" },
    { id: "Ocean", tier: 1, lastFish: "Gem Whale", rating: 6680, baseTicks: 16, legendary: "Megalodon" },
    { id: "Nuclear", tier: 1, lastFish: "Wastefish", rating: 15930, baseTicks: 22, legendary: "Radioactive Slug" },
    { id: "Abyss", tier: 1, lastFish: "Wreckshell Pilferer", rating: 38020, baseTicks: 30, legendary: "Cthulhu" },
    { id: "Cave", tier: 2, lastFish: "Arapaim-al", rating: 136080, baseTicks: 40, legendary: "Glimmering Geoduck" },
    { id: "Volcano", tier: 2, lastFish: "Basalturtle", rating: 324740, baseTicks: 50, legendary: "Laviathan" },
    { id: "Sky", tier: 2, lastFish: "Lunar Sunfish", rating: 774930, baseTicks: 60, legendary: "Storm Serpent" },
    { id: "Solaris", tier: 2, lastFish: "Planetary Jellyfish", rating: 1850000, baseTicks: 70, legendary: "Melting Gibbous" },
    { id: "Galaxy", tier: 2, lastFish: "Dark Matter Blackdragon", rating: 4410000, baseTicks: 80, legendary: "Blackened Basker" }
  ];

  var DOCK_BY_ID = {};
  DOCKS.forEach(function (d) { DOCK_BY_ID[d.id] = d; });

  /* ---------------------------------------------------------------- */
  /* small helpers                                                    */
  /* ---------------------------------------------------------------- */

  function num(v, fallback) {
    if (typeof v === "number" && isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "") {
      var n = parseFloat(v);
      if (isFinite(n)) return n;
    }
    return fallback;
  }

  function bool(v, fallback) {
    return typeof v === "boolean" ? v : fallback;
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function nonNeg(v, fallback) {
    return Math.max(0, num(v, fallback));
  }

  function emptyPolyMap(value) {
    var map = {};
    DOCKS.forEach(function (d) { map[d.id] = !!value; });
    return map;
  }

  function baseTickMap() {
    var map = {};
    DOCKS.forEach(function (d) { map[d.id] = d.baseTicks; });
    return map;
  }

  function dockById(id) {
    return DOCK_BY_ID[id] || null;
  }

  /* ---------------------------------------------------------------- */
  /* defaults and account mapping                                     */
  /* ---------------------------------------------------------------- */

  function defaults() {
    return {
      dock: "Lake",
      rodAssigned: true,
      rodPower: 0,
      dronesAssigned: 0,
      droneCapacity: 0,
      droneBasePower: 0,
      droneMultiplier: 1,
      tier2DockMulti: 1,

      tickReduction: 0,
      tick3x: false,
      doubleTick: 0,
      tripleTick: 0,
      fiveTick: 0,

      anglerEquipped: false,
      anglerFueled: false,
      anglerGrade: 0,
      anglerUpgradeLevel: 0,

      ticksAuto: true,
      ticksPerFill: 5,
      polyCards: false,
      polyKnown: false,
      polyByDock: emptyPolyMap(false),
      dockTicks: baseTickMap(),

      source: "defaults",
      accountVersion: null
    };
  }

  function tickForDock(input, dockId) {
    var s = input || {};
    var d = dockById(dockId) || DOCKS[0];
    var ticks = s.dockTicks && s.dockTicks[d.id];
    if (typeof ticks === "number" && isFinite(ticks) && ticks > 0) return ticks;
    return d.baseTicks;
  }

  function polyForDock(input, dockId) {
    var s = input || {};
    if (s.polyByDock && typeof s.polyByDock[dockId] === "boolean") return s.polyByDock[dockId];
    return !!s.polyCards;
  }

  function polyFromStats(stats) {
    var arr = stats && stats.fishing_regular_card_array;
    var map = {};
    var known = Array.isArray(arr) && arr.length >= DOCKS.length * 4;
    DOCKS.forEach(function (d, i) {
      var poly = known;
      if (known) {
        for (var k = 0; k < 4; k++) {
          var v = arr[4 * i + k];
          if (typeof v !== "number" || !isFinite(v) || v < 3) { poly = false; break; }
        }
      }
      map[d.id] = !!poly;
    });
    return { map: map, known: known };
  }

  function dockTicksFromStats(stats) {
    var map = {};
    if (!FM || !ES) return baseTickMap();
    try {
      var inputs = ES.apply(stats || {}, FM.defaultInputs()).inputs;
      DOCKS.forEach(function (d) {
        var t = FM.dockTick(d.id, "AI", inputs);
        map[d.id] = (typeof t === "number" && isFinite(t) && t > 0) ? t : d.baseTicks;
      });
      return map;
    } catch (e) {
      return baseTickMap();
    }
  }

  /*
   * Pull the fishing stats the calculator needs out of a raw ExportStats
   * `stats` object. Missing keys fall back to the manual-entry defaults.
   */
  function fromAccountStats(stats) {
    var s = stats || {};
    var applied = 0;
    var missing = [];

    function takeNum(key, fallback) {
      var v = s[key];
      if (typeof v === "number" && isFinite(v)) { applied++; return v; }
      missing.push(key);
      return fallback;
    }
    function takeBool(key, fallback) {
      var v = s[key];
      if (typeof v === "boolean") { applied++; return v; }
      missing.push(key);
      return fallback;
    }

    var capacity = takeNum("fishing_drone_capacity", 0);
    var anglerGrade = takeNum("angler_fuel_grade", 0);
    var suitLevels = Array.isArray(s.drones_suit_level_array) ? s.drones_suit_level_array : null;
    var anglerLevel = suitLevels && typeof suitLevels[8] === "number" && isFinite(suitLevels[8])
      ? Math.max(0, suitLevels[8])
      : 0;
    if (!suitLevels) missing.push("drones_suit_level_array[8]");

    var cards = polyFromStats(s);
    if (!cards.known) missing.push("fishing_regular_card_array");

    return {
      rodPower: takeNum("fishing_rod_power", 0),
      droneCapacity: capacity,
      droneBasePower: takeNum("fishing_drone_power", 0),
      droneMultiplier: takeNum("fishing_drone_multiplier", 1),
      tier2DockMulti: takeNum("fishing_tier2_dock_multi", 1),

      tickReduction: takeNum("fishing_tick_reduction_seconds", 0),
      doubleTick: takeNum("fishing_double_tick_chance", 0),
      tripleTick: takeNum("fishing_triple_tick_chance", 0),
      fiveTick: takeNum("fishing_5x_tick_chance", 0),

      anglerEquipped: takeBool("is_drone_angler_equipped", false),
      anglerFueled: takeBool("is_drone_angler_equipped_and_fueled", false),
      anglerGrade: anglerGrade,
      anglerUpgradeLevel: anglerLevel,

      polyByDock: cards.map,
      polyKnown: cards.known,
      dockTicks: dockTicksFromStats(s),
      applied: applied,
      missing: missing
    };
  }

  /* ---------------------------------------------------------------- */
  /* power, catch chance, and legendary chance                        */
  /* ---------------------------------------------------------------- */

  function dronePowerEach(input) {
    var s = input || {};
    return nonNeg(s.droneBasePower, 0) * nonNeg(s.droneMultiplier, 0);
  }

  function dockPower(input) {
    var s = input || {};
    var d = dockById(s.dock) || DOCKS[0];
    var rod = s.rodAssigned === false ? 0 : nonNeg(s.rodPower, 0);
    var drones = nonNeg(s.dronesAssigned, 0) * dronePowerEach(s);
    var raw = rod + drones;
    var tier2 = d.tier === 2 ? nonNeg(s.tier2DockMulti, 1) : 1;
    return raw * tier2;
  }

  function catchChance(input) {
    var s = input || {};
    var d = dockById(s.dock) || DOCKS[0];
    var power = dockPower(s);
    if (!(d.rating > 0)) return 0;
    return 100 * power / d.rating;
  }

  function legendarySteps(chance) {
    var c = Math.min(999, Math.max(0, num(chance, 0)));
    return clamp(Math.floor(c / LEGENDARY_STEP_SIZE), 0, LEGENDARY_MAX_STEPS);
  }

  function anglerFactor(input) {
    var s = input || {};
    if (!s.anglerEquipped || !s.anglerFueled) return 1;
    return 1 + ANGLER_BONUS_PER_GRADE * (nonNeg(s.anglerGrade, 0) + 1);
  }

  function legendaryChancePerFill(input) {
    var s = input || {};
    var steps = legendarySteps(catchChance(s));
    if (steps <= 0) return 0;
    return steps * anglerFactor(s) / LEGENDARY_DENOMINATOR;
  }

  function tickSeconds(input) {
    var s = input || {};
    var reduction = clamp(nonNeg(s.tickReduction, 0), 0, BASE_TICK_SECONDS - 0.1);
    var seconds = Math.max(0.1, BASE_TICK_SECONDS - reduction);
    if (s.tick3x) seconds = Math.max(0.1, seconds / 3);
    return seconds;
  }

  function expectedTicksPerEvent(input) {
    var s = input || {};
    var p2 = clamp(nonNeg(s.doubleTick, 0) / 100, 0, 1);
    var p3 = clamp(nonNeg(s.tripleTick, 0) / 100, 0, 1);
    var p5 = clamp(nonNeg(s.fiveTick, 0) / 100, 0, 1);

    return FM
      ? FM.tickPoly(p2, p3, p5)
      : (1 + p2 + 2 * p3 + 4 * p5);
  }

  // The Angler grants 2 ticks per cycle while equipped. While fuelled it also
  // has a 1% chance per cycle to add 6 x (grade + 1) more ticks.
  function anglerTicksPerCycle(input) {
    var s = input || {};
    if (!s.anglerEquipped) return 0;
    var ticks = ANGLER_PASSIVE_TICKS;
    if (s.anglerFueled) {
      ticks += ANGLER_BUFF_TICK_CHANCE * ANGLER_BUFF_TICKS_PER_GRADE * (nonNeg(s.anglerGrade, 0) + 1);
    }
    return ticks;
  }

  function anglerPassiveTicksPerSecond(input) {
    var s = input || {};
    if (!s.anglerEquipped) return 0;
    var level = clamp(nonNeg(s.anglerUpgradeLevel, 0), 0, 15);
    var interval = Math.max(60, ANGLER_PASSIVE_BASE_SECONDS - ANGLER_PASSIVE_SECONDS_PER_LEVEL * level);
    return anglerTicksPerCycle(s) / interval;
  }

  function totalTicksPerSecond(input) {
    return expectedTicksPerEvent(input) / tickSeconds(input) + anglerPassiveTicksPerSecond(input);
  }

  /* ---------------------------------------------------------------- */
  /* distribution helpers                                             */
  /* ---------------------------------------------------------------- */

  // Time t where P(caught by t) = q for independent rolls at `rate` per second.
  function quantileSeconds(rate, chancePerRoll, q) {
    if (!(rate > 0) || !(chancePerRoll > 0)) return Infinity;
    if (chancePerRoll >= 1) return 0;
    return Math.log(1 - q) / (rate * Math.log1p(-chancePerRoll));
  }

  function chanceBySeconds(rate, chancePerRoll, seconds) {
    if (!(rate > 0) || !(chancePerRoll > 0) || !(seconds > 0)) return 0;
    if (chancePerRoll >= 1) return 1;
    return 1 - Math.pow(1 - chancePerRoll, rate * seconds);
  }

  /* ---------------------------------------------------------------- */
  /* the calculator                                                   */
  /* ---------------------------------------------------------------- */

  function compute(input) {
    var s = input || {};
    var d = dockById(s.dock) || DOCKS[0];
    var power = dockPower(s);
    var rawCatch = d.rating > 0 ? 100 * power / d.rating : 0;
    var cappedCatch = Math.min(999, Math.max(0, rawCatch));
    var steps = legendarySteps(cappedCatch);
    var poly = !!s.polyCards;
    var eligible = steps > 0 && poly;

    var factor = anglerFactor(s);
    var denominator = LEGENDARY_DENOMINATOR / factor;
    var chancePerFill = steps > 0 ? steps * factor / LEGENDARY_DENOMINATOR : 0;

    var ticksPerEvent = expectedTicksPerEvent(s);
    var passiveTicks = anglerPassiveTicksPerSecond(s);
    var tickLength = tickSeconds(s);
    var ticksPerSecond = ticksPerEvent / tickLength + passiveTicks;

    var fallbackTicks = d.baseTicks;
    var ticksPerFill = nonNeg(s.ticksPerFill, fallbackTicks) || fallbackTicks;
    ticksPerFill = Math.max(1, ticksPerFill);

    var fillsPerSecond = ticksPerSecond / ticksPerFill;
    var fillsPerHour = fillsPerSecond * 3600;
    var secondsPerFill = fillsPerSecond > 0 ? 1 / fillsPerSecond : Infinity;
    var catchesPerSecond = fillsPerSecond * chancePerFill;
    var meanSeconds = catchesPerSecond > 0 ? 1 / catchesPerSecond : Infinity;

    var qList = [0.5, 0.75, 0.9, 0.95, 0.99];
    var quantiles = qList.map(function (q) {
      return {
        chance: q,
        seconds: quantileSeconds(fillsPerSecond, chancePerFill, q)
      };
    });

    var horizons = [
      { label: "1 hour", seconds: 3600 },
      { label: "6 hours", seconds: 6 * 3600 },
      { label: "1 day", seconds: 86400 },
      { label: "3 days", seconds: 3 * 86400 },
      { label: "1 week", seconds: 7 * 86400 },
      { label: "30 days", seconds: 30 * 86400 },
      { label: "90 days", seconds: 90 * 86400 }
    ];
    var within = horizons.map(function (h) {
      return {
        label: h.label,
        seconds: h.seconds,
        chance: chanceBySeconds(fillsPerSecond, chancePerFill, h.seconds)
      };
    });

    var nextStepPower = steps < LEGENDARY_MAX_STEPS
      ? (steps + 1) * LEGENDARY_STEP_SIZE / 100 * d.rating
      : null;

    return {
      dock: d,
      power: power,
      rodPowerUsed: s.rodAssigned === false ? 0 : nonNeg(s.rodPower, 0),
      dronePowerEach: dronePowerEach(s),
      dronePowerTotal: nonNeg(s.dronesAssigned, 0) * dronePowerEach(s),
      tier2Multiplier: d.tier === 2 ? nonNeg(s.tier2DockMulti, 1) : 1,

      catchChance: rawCatch,
      cappedCatchChance: cappedCatch,
      steps: steps,
      polyCards: poly,
      eligiblePower: steps > 0,
      eligible: eligible,

      anglerFactor: factor,
      legendaryDenominator: denominator,
      chancePerFill: chancePerFill,
      oneInFills: chancePerFill > 0 ? 1 / chancePerFill : Infinity,
      chancePerFillPercent: chancePerFill * 100,

      tickSeconds: tickLength,
      expectedTicksPerEvent: ticksPerEvent,
      anglerPassiveTicksPerSecond: passiveTicks,
      ticksPerSecond: ticksPerSecond,
      ticksPerFill: ticksPerFill,
      fillsPerSecond: fillsPerSecond,
      fillsPerHour: fillsPerHour,
      secondsPerFill: secondsPerFill,

      catchesPerSecond: catchesPerSecond,
      catchesPerDay: catchesPerSecond * 86400,
      meanSeconds: meanSeconds,
      meanHours: meanSeconds / 3600,
      meanDays: meanSeconds / 86400,
      medianSeconds: quantiles[0].seconds,
      quantiles: quantiles,
      within: within,

      powerFor100: d.rating,
      powerFor900: d.rating * LEGENDARY_MAX_STEPS,
      nextStepPower: nextStepPower,
      nextStepGap: nextStepPower === null ? 0 : Math.max(0, nextStepPower - power),
      powerGapFor100: Math.max(0, d.rating - power)
    };
  }

  global.LegendaryData = {
    DOCKS: DOCKS,
    DOCK_BY_ID: DOCK_BY_ID,
    BASE_TICK_SECONDS: BASE_TICK_SECONDS,
    LEGENDARY_DENOMINATOR: LEGENDARY_DENOMINATOR,
    LEGENDARY_MAX_STEPS: LEGENDARY_MAX_STEPS,
    LEGENDARY_STEP_SIZE: LEGENDARY_STEP_SIZE,
    ANGLER_BONUS_PER_GRADE: ANGLER_BONUS_PER_GRADE,
    ANGLER_BUFF_TICK_CHANCE: ANGLER_BUFF_TICK_CHANCE,
    ANGLER_BUFF_TICKS_PER_GRADE: ANGLER_BUFF_TICKS_PER_GRADE,
    ANGLER_PASSIVE_TICKS: ANGLER_PASSIVE_TICKS,
    ANGLER_PASSIVE_BASE_SECONDS: ANGLER_PASSIVE_BASE_SECONDS,
    ANGLER_PASSIVE_SECONDS_PER_LEVEL: ANGLER_PASSIVE_SECONDS_PER_LEVEL,
    defaults: defaults,
    dockById: dockById,
    tickForDock: tickForDock,
    polyForDock: polyForDock,
    fromAccountStats: fromAccountStats,
    dronePowerEach: dronePowerEach,
    dockPower: dockPower,
    catchChance: catchChance,
    legendarySteps: legendarySteps,
    anglerFactor: anglerFactor,
    legendaryChancePerFill: legendaryChancePerFill,
    tickSeconds: tickSeconds,
    expectedTicksPerEvent: expectedTicksPerEvent,
    anglerTicksPerCycle: anglerTicksPerCycle,
    anglerPassiveTicksPerSecond: anglerPassiveTicksPerSecond,
    totalTicksPerSecond: totalTicksPerSecond,
    quantileSeconds: quantileSeconds,
    chanceBySeconds: chanceBySeconds,
    compute: compute
  };

})(typeof window !== "undefined" ? window : globalThis);
