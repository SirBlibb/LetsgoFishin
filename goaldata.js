/*
 * Goal ETA maths for ore or bar targets.
 *
 * Ore goals use an observed ore/hour rate (ExportStats does not record current
 * ore, current bars, or ore/hour). Bar goals convert the bars still needed into
 * ore with the same crafting model the bomb tool uses, then apply the rate.
 *
 * Exposed as window.GoalData.
 */
(function (global) {
  "use strict";

  var BD = global.BombData;
  var MILESTONE_PCTS = [25, 50, 75, 100];

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

  function toMs(v) {
    if (v === null || v === undefined || v === "") return null;
    var ms = v instanceof Date ? v.getTime() : new Date(v).getTime();
    return isFinite(ms) ? ms : null;
  }

  /*
   * Ore per hour from a measured ore gain. Returns null when the measurement
   * is unusable (missing values, no time, or no ore gained).
   */
  function oreRate(before, after, minutes) {
    var b = asNumber(before, null);
    var a = asNumber(after, null);
    var m = asNumber(minutes, null);
    if (b === null || a === null || m === null) return null;
    if (!(m > 0) || !(a > b)) return null;
    return (a - b) / (m / 60);
  }

  /*
   * Long-run bars per ore for one bar level. Craft multipliers are random, so
   * this is an expected value, not what a single craft will produce.
   */
  function barRate(values, level) {
    if (!BD) return null;
    var bar = BD.barByLevel(level);
    if (!bar) return null;

    var s = BD.normalizeValues(values);
    var craft = BD.craftMultiplier(s);
    var cost = BD.effectiveCost(bar.cost, s.barCraftCostMulti);
    var output = Math.max(1, s.barOutputMulti);
    var barsPerOre = output * craft / cost;

    return {
      level: bar.level,
      bar: bar,
      baseCost: bar.cost,
      effectiveCost: cost,
      craftMultiplier: craft,
      barOutputMultiplier: output,
      barsPerOre: barsPerOre,
      orePerBar: barsPerOre > 0 ? 1 / barsPerOre : Infinity
    };
  }

  function etaFor(oreLeft, rate, hoursPerDay, nowMs) {
    var left = Math.max(0, oreLeft);
    if (left === 0) {
      return { hours: 0, calendarDays: 0, finishAt: new Date(nowMs) };
    }
    if (!(rate > 0)) {
      return { hours: Infinity, calendarDays: Infinity, finishAt: null };
    }

    var hours = left / rate;
    var days = hoursPerDay > 0 ? hours / hoursPerDay : Infinity;
    var finishAt = hoursPerDay > 0 ? new Date(nowMs + days * 86400000) : null;
    return { hours: hours, calendarDays: days, finishAt: finishAt };
  }

  /*
   * Estimate a goal.
   *
   * input = {
   *   mode: "ore" | "bars",
   *   currentOre, targetOre,
   *   currentBars, targetBars, level,
   *   values,                    // BombData crafting values (bar mode)
   *   orePerHour, hoursPerDay,
   *   now,                       // Date, timestamp, or parseable string
   *   deadline                   // optional Date, timestamp, or string
   * }
   *
   * `remaining` is in goal units (ore or bars). `remainingOre` is the ore you
   * still have to mine; that is what the rate turns into time.
   */
  function estimate(input) {
    var s = input || {};
    var mode = s.mode === "bars" ? "bars" : "ore";
    var nowMs = toMs(s.now);
    if (nowMs === null) nowMs = Date.now();

    var rate = Math.max(0, asNumber(s.orePerHour, 0));
    var hoursPerDay = clamp(asNumber(s.hoursPerDay, 0), 0, 24);
    var currentOre = Math.max(0, asNumber(s.currentOre, 0));

    var out = {
      mode: mode,
      now: new Date(nowMs),
      rate: rate,
      hoursPerDay: hoursPerDay,
      unit: mode === "bars" ? "bars" : "ore",
      currentOre: currentOre,
      current: 0,
      target: 0,
      remaining: 0,
      remainingOre: 0,
      oreNeeded: 0,
      goalReached: false,
      readyToCraft: false,
      progress: 0,
      hours: 0,
      calendarDays: 0,
      finishAt: new Date(nowMs),
      milestones: [],
      barRate: null,
      deadline: null,
      deadlinePlayHours: null,
      deadlinePassed: false,
      requiredRate: null,
      error: null
    };

    var targetOre;
    var targetBars;
    var currentBars;
    var br;

    if (mode === "bars") {
      targetBars = Math.max(0, asNumber(s.targetBars, 0));
      currentBars = Math.max(0, asNumber(s.currentBars, 0));
      out.current = currentBars;
      out.target = targetBars;
      out.remaining = Math.max(0, targetBars - currentBars);
      out.progress = targetBars > 0 ? clamp(currentBars / targetBars, 0, 1) : 0;

      br = barRate(s.values, s.level);
      out.barRate = br;
      if (br && br.barsPerOre > 0 && isFinite(br.barsPerOre)) {
        out.oreNeeded = out.remaining / br.barsPerOre;
        out.remainingOre = Math.max(0, out.oreNeeded - currentOre);
      } else {
        out.oreNeeded = Infinity;
        out.remainingOre = Infinity;
        out.error = "Choose a valid bar level.";
      }
    } else {
      targetOre = Math.max(0, asNumber(s.targetOre, 0));
      out.current = currentOre;
      out.target = targetOre;
      out.remaining = Math.max(0, targetOre - currentOre);
      out.remainingOre = out.remaining;
      out.oreNeeded = out.remaining;
      out.progress = targetOre > 0 ? clamp(currentOre / targetOre, 0, 1) : 0;
    }

    out.goalReached = out.target > 0 && out.remaining <= 0;
    out.readyToCraft = mode === "bars" && out.target > 0 && !out.error &&
      !out.goalReached && out.remainingOre === 0;

    if (!out.error) {
      var eta = etaFor(out.remainingOre, rate, hoursPerDay, nowMs);
      out.hours = eta.hours;
      out.calendarDays = eta.calendarDays;
      out.finishAt = eta.finishAt;
    } else {
      out.hours = Infinity;
      out.calendarDays = Infinity;
      out.finishAt = null;
    }

    out.milestones = MILESTONE_PCTS.map(function (pct) {
      var amount = out.target * pct / 100;
      var oreLeft;

      if (out.error) {
        oreLeft = Infinity;
      } else if (mode === "bars") {
        var barsLeft = Math.max(0, amount - currentBars);
        oreLeft = Math.max(0, barsLeft / br.barsPerOre - currentOre);
      } else {
        oreLeft = Math.max(0, amount - currentOre);
      }

      var mEta = etaFor(oreLeft, rate, hoursPerDay, nowMs);
      return {
        pct: pct,
        amount: amount,
        remainingOre: oreLeft,
        hours: mEta.hours,
        calendarDays: mEta.calendarDays,
        finishAt: mEta.finishAt
      };
    });

    var deadlineMs = toMs(s.deadline);
    if (deadlineMs !== null) {
      var wallHours = (deadlineMs - nowMs) / 3600000;
      var playHours = wallHours > 0 ? wallHours * (hoursPerDay / 24) : 0;

      out.deadline = new Date(deadlineMs);
      out.deadlinePassed = wallHours <= 0;
      out.deadlinePlayHours = playHours;

      if (out.remainingOre === 0) out.requiredRate = 0;
      else if (playHours > 0 && isFinite(out.remainingOre)) out.requiredRate = out.remainingOre / playHours;
      else out.requiredRate = Infinity;
    }

    return out;
  }

  global.GoalData = {
    MILESTONE_PCTS: MILESTONE_PCTS,
    oreRate: oreRate,
    barRate: barRate,
    estimate: estimate
  };

})(typeof window !== "undefined" ? window : globalThis);
