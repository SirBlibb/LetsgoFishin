/*
 * Goal ETA tool: estimate the time to an ore or bar target.
 *
 * Depends on:
 *   goaldata.js   (window.GoalData)
 *   bombdata.js   (window.BombData - crafting stats and bar levels)
 *   exportstats.js / account.js when a saved account is present
 *
 * Exposed as window.GoalTool so app.js can initialise it and refresh it after
 * an account import/reset.
 */
(function (global) {
  "use strict";

  var GD = global.GoalData;
  var BD = global.BombData;
  var ACCOUNT = global.AccountStore || null;
  var ES = global.ExportStats || null;

  var KEY = "obelisk-goal-v1";

  var DEFAULTS = {
    mode: "ore",
    currentOre: 0,
    targetOre: 100000,
    currentBars: 0,
    targetBars: 1000,
    level: 1,
    orePerHour: 0,
    hoursPerDay: 8,
    deadline: ""
  };

  var state = {
    mode: DEFAULTS.mode,
    currentOre: DEFAULTS.currentOre,
    targetOre: DEFAULTS.targetOre,
    currentBars: DEFAULTS.currentBars,
    targetBars: DEFAULTS.targetBars,
    level: DEFAULTS.level,
    orePerHour: DEFAULTS.orePerHour,
    hoursPerDay: DEFAULTS.hoursPerDay,
    deadline: DEFAULTS.deadline,
    values: BD ? BD.defaults() : {},
    source: "defaults",
    account: null,
    applied: 0,
    missing: 0
  };

  var nodes = {};
  var lastEstimate = null;

  /* ---------------------------------------------------------------- */
  /* helpers                                                          */
  /* ---------------------------------------------------------------- */

  var SUFFIX = ["", "k", "m", "b", "t", "q", "qi", "sx", "sp", "oc", "no", "dc", "ud", "dd", "td"];

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt !== undefined) e.textContent = txt;
    return e;
  }

  function fmt(n) {
    if (n === null || n === undefined || !isFinite(n)) return "-";
    if (n === 0) return "0";
    var neg = n < 0;
    var abs = Math.abs(n);
    if (abs >= 1e45) return (neg ? "-" : "") + abs.toExponential(3);
    if (abs < 0.001) return (neg ? "-" : "") + abs.toExponential(2);
    if (abs < 1) return (neg ? "-" : "") + abs.toPrecision(3);

    var tier = 0;
    while (abs >= 1000 && tier < SUFFIX.length - 1) {
      abs /= 1000;
      tier++;
    }
    var s;
    if (tier === 0) s = abs < 10 ? abs.toFixed(2) : abs < 100 ? abs.toFixed(1) : Math.round(abs).toString();
    else s = abs.toFixed(abs < 10 ? 2 : abs < 100 ? 1 : 0) + SUFFIX[tier];
    return (neg ? "-" : "") + s;
  }

  function fmtNumber(n) {
    if (n === null || n === undefined || !isFinite(n)) return "-";
    return String(Math.round(n * 1000) / 1000);
  }

  function inputValue(n) {
    if (typeof n !== "number" || !isFinite(n) || n === 0) return n;
    return String(Number(n.toPrecision(10)));
  }

  function fmtDuration(hours) {
    if (hours === null || hours === undefined || !isFinite(hours)) return "-";
    if (hours <= 0) return "0";
    if (hours < 1 / 60) return "< 1 minute";
    if (hours < 1) return Math.round(hours * 60) + " min";
    if (hours < 48) return fmt(hours) + " hours";
    return fmt(hours / 24) + " days of play";
  }

  function fmtCalendar(days) {
    if (days === null || days === undefined || !isFinite(days)) return "-";
    if (days <= 0) return "0 days";
    if (days < 1) return "less than a day";
    return fmt(days) + " calendar day" + (days < 2 ? "" : "s");
  }

  function fmtFinish(date) {
    if (!date) return "-";
    var d = date instanceof Date ? date : new Date(date);
    if (!isFinite(d.getTime())) return "-";
    try {
      return d.toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
      });
    } catch (e) {
      return d.toString();
    }
  }

  function getStorage() {
    try {
      if (global && global.localStorage) return global.localStorage;
    } catch (e) { /* storage blocked */ }
    return null;
  }

  function asNumber(v, fallback) {
    if (typeof v === "number" && isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "") {
      var n = parseFloat(v);
      if (isFinite(n)) return n;
    }
    return fallback;
  }

  function craftingFields() {
    if (!BD) return [];
    return BD.FIELDS.filter(function (f) { return f.group === "Crafting"; });
  }

  function scrollWrap(table) {
    var w = el("div", "table-scroll");
    w.appendChild(table);
    return w;
  }

  /* ---------------------------------------------------------------- */
  /* saved goal inputs                                                */
  /* ---------------------------------------------------------------- */

  function loadSavedInputs() {
    var store = getStorage();
    if (!store) return;
    var saved = null;
    try { saved = JSON.parse(store.getItem(KEY) || "null"); } catch (e) { saved = null; }
    if (!saved || typeof saved !== "object") return;

    if (saved.mode === "bars" || saved.mode === "ore") state.mode = saved.mode;
    state.currentOre = Math.max(0, asNumber(saved.currentOre, DEFAULTS.currentOre));
    state.targetOre = Math.max(0, asNumber(saved.targetOre, DEFAULTS.targetOre));
    state.currentBars = Math.max(0, asNumber(saved.currentBars, DEFAULTS.currentBars));
    state.targetBars = Math.max(0, asNumber(saved.targetBars, DEFAULTS.targetBars));

    var level = Math.floor(asNumber(saved.level, DEFAULTS.level));
    if (BD && level >= 1 && level <= BD.BARS.length) state.level = level;

    state.orePerHour = Math.max(0, asNumber(saved.orePerHour, DEFAULTS.orePerHour));
    state.hoursPerDay = Math.max(0, Math.min(24, asNumber(saved.hoursPerDay, DEFAULTS.hoursPerDay)));
    if (typeof saved.deadline === "string") state.deadline = saved.deadline;
  }

  function saveInputs() {
    var store = getStorage();
    if (!store) return;
    try {
      store.setItem(KEY, JSON.stringify({
        mode: state.mode,
        currentOre: state.currentOre,
        targetOre: state.targetOre,
        currentBars: state.currentBars,
        targetBars: state.targetBars,
        level: state.level,
        orePerHour: state.orePerHour,
        hoursPerDay: state.hoursPerDay,
        deadline: state.deadline
      }));
    } catch (e) { /* storage full or blocked */ }
  }

  function clearSavedInputs() {
    var store = getStorage();
    if (!store) return;
    try { store.removeItem(KEY); } catch (e) { /* ignored */ }
  }

  /* ---------------------------------------------------------------- */
  /* account                                                          */
  /* ---------------------------------------------------------------- */

  function readAccount() {
    if (!ACCOUNT) return null;
    var rec = ACCOUNT.load();
    if (!rec) return null;
    try {
      var parsed = ES ? ES.parseExport(rec.raw) : JSON.parse(rec.raw);
      var stats = parsed && parsed.stats ? parsed.stats : parsed;
      return {
        record: rec,
        stats: stats,
        version: (parsed && parsed.version) || rec.version || "?"
      };
    } catch (e) {
      return { record: rec, stats: null, version: rec.version || "?" };
    }
  }

  function applyAccount(acct) {
    var fields = craftingFields();
    var mapped = BD.fromAccountStats(acct.stats);

    state.values = mapped.values;
    state.source = "account";
    state.account = acct;
    state.applied = fields.filter(function (f) { return mapped.applied.indexOf(f.stat) >= 0; }).length;
    state.missing = fields.length - state.applied;

    if (state.missing > 0 && nodes.statsDetails) nodes.statsDetails.open = true;
    fillStatsInputs();
    updateStatsNote();
    update();
  }

  function resetStats() {
    state.values = BD.defaults();
    state.source = "defaults";
    state.account = null;
    state.applied = 0;
    state.missing = craftingFields().length;
    fillStatsInputs();
    updateStatsNote();
    update();
  }

  // Called by app.js after an import or a reset on the home page.
  function refreshAccount() {
    if (!BD) return;
    var acct = readAccount();
    if (acct && acct.stats) {
      applyAccount(acct);
    } else {
      resetStats();
    }
  }

  function markManual() {
    if (state.source === "account") state.source = "account-edited";
    else if (state.source !== "account-edited") state.source = "manual";
    updateStatsNote();
  }

  function updateStatsNote() {
    var total = craftingFields().length;
    if (nodes.statsSource) {
      if (state.source === "account") {
        nodes.statsSource.textContent = "From account (" + state.applied + "/" + total + " fields)";
      } else if (state.source === "account-edited") {
        nodes.statsSource.textContent = "Account values, edited by hand";
      } else if (state.source === "manual") {
        nodes.statsSource.textContent = "Manual values";
      } else {
        nodes.statsSource.textContent = "Defaults - enter your stats";
      }
    }

    if (!nodes.statsWarning) return;
    if (state.source === "account" || state.source === "account-edited") {
      if (state.missing > 0) {
        nodes.statsWarning.textContent = state.missing + " of " + total +
          " crafting stats were not in the account export; defaults are used for those fields. Enter them below.";
      } else if (state.source === "account-edited") {
        nodes.statsWarning.textContent = "You changed the account values; bar estimates update immediately.";
      } else {
        nodes.statsWarning.textContent = "";
      }
    } else if (state.source === "defaults") {
      nodes.statsWarning.textContent = "No account crafting stats loaded. Import an account on the home page, or edit the values below.";
    } else {
      nodes.statsWarning.textContent = "";
    }
  }

  /* ---------------------------------------------------------------- */
  /* inputs                                                           */
  /* ---------------------------------------------------------------- */

  function renderLevelOptions() {
    if (!nodes.level || !BD) return;
    nodes.level.innerHTML = "";

    var groups = {};
    BD.BARS.forEach(function (bar) { (groups[bar.world] = groups[bar.world] || []).push(bar); });

    Object.keys(groups).forEach(function (world) {
      var og = el("optgroup");
      og.label = "World " + world;
      groups[world].forEach(function (bar) {
        var o = el("option", null, "Level " + bar.level + " - " + bar.name);
        o.value = String(bar.level);
        og.appendChild(o);
      });
      nodes.level.appendChild(og);
    });

    nodes.level.value = String(state.level);
  }

  function renderStats() {
    if (!nodes.stats || !BD) return;
    nodes.stats.innerHTML = "";

    var grid = el("div", "grid");

    craftingFields().forEach(function (f) {
      var wrap = el("label", "field");
      wrap.appendChild(el("span", "field-label", f.label + (f.unit ? " (" + f.unit + ")" : "")));

      var inp = el("input");
      inp.type = "number";
      inp.id = "goal-stat-" + f.key;
      inp.min = f.min != null ? f.min : 0;
      if (f.max != null) inp.max = f.max;
      inp.step = "any";
      inp.value = inputValue(state.values[f.key]);
      inp.placeholder = String(BD.DEFAULTS[f.key]);
      if (f.hint) inp.title = f.hint;
      inp.addEventListener("input", function () {
        var v = parseFloat(inp.value);
        state.values[f.key] = isFinite(v) ? v : BD.DEFAULTS[f.key];
        markManual();
        update();
      });

      wrap.appendChild(inp);
      grid.appendChild(wrap);
    });

    nodes.stats.appendChild(grid);
  }

  function fillStatsInputs() {
    craftingFields().forEach(function (f) {
      var inp = document.getElementById("goal-stat-" + f.key);
      if (inp) inp.value = inputValue(state.values[f.key]);
    });
  }

  function fillInputs() {
    if (nodes.currentOre) nodes.currentOre.value = inputValue(state.currentOre);
    if (nodes.targetOre) nodes.targetOre.value = inputValue(state.targetOre);
    if (nodes.currentBars) nodes.currentBars.value = inputValue(state.currentBars);
    if (nodes.targetBars) nodes.targetBars.value = inputValue(state.targetBars);
    if (nodes.level) nodes.level.value = String(state.level);
    if (nodes.rate) nodes.rate.value = inputValue(state.orePerHour);
    if (nodes.hoursDay) nodes.hoursDay.value = inputValue(state.hoursPerDay);
    if (nodes.deadline) nodes.deadline.value = state.deadline;
  }

  function bindNumber(node, key, min, max) {
    if (!node) return;
    node.addEventListener("input", function () {
      var v = parseFloat(node.value);
      if (!isFinite(v)) v = 0;
      if (min != null) v = Math.max(min, v);
      if (max != null) v = Math.min(max, v);
      state[key] = v;
      update();
    });
  }

  function bindControls() {
    if (nodes.modeOre) {
      nodes.modeOre.addEventListener("change", function () {
        if (nodes.modeOre.checked) {
          state.mode = "ore";
          update();
        }
      });
    }
    if (nodes.modeBars) {
      nodes.modeBars.addEventListener("change", function () {
        if (nodes.modeBars.checked) {
          state.mode = "bars";
          update();
        }
      });
    }

    bindNumber(nodes.currentOre, "currentOre", 0);
    bindNumber(nodes.targetOre, "targetOre", 0);
    bindNumber(nodes.currentBars, "currentBars", 0);
    bindNumber(nodes.targetBars, "targetBars", 0);
    bindNumber(nodes.rate, "orePerHour", 0);
    bindNumber(nodes.hoursDay, "hoursPerDay", 0, 24);

    if (nodes.level) {
      nodes.level.addEventListener("change", function () {
        state.level = parseInt(nodes.level.value, 10) || 1;
        update();
      });
    }

    if (nodes.deadline) {
      var syncDeadline = function () {
        state.deadline = nodes.deadline.value;
        update();
      };
      nodes.deadline.addEventListener("input", syncDeadline);
      nodes.deadline.addEventListener("change", syncDeadline);
    }

    if (nodes.rateBefore) {
      [nodes.rateBefore, nodes.rateAfter, nodes.rateMinutes].forEach(function (node) {
        if (node) node.addEventListener("input", function () { updateRateHelper(false); });
      });
    }
    if (nodes.rateApply) {
      nodes.rateApply.addEventListener("click", function () { updateRateHelper(true); });
    }

    if (nodes.reload) {
      nodes.reload.addEventListener("click", function () {
        var acct = readAccount();
        if (!acct || !acct.stats) {
          if (nodes.statsWarning) {
            nodes.statsWarning.textContent = "No saved account found. Import one on the home page, or keep editing manually.";
          }
          return;
        }
        applyAccount(acct);
      });
    }

    if (nodes.reset) {
      nodes.reset.addEventListener("click", function () { resetStats(); });
    }
  }

  function updateRateHelper(apply) {
    if (!nodes.rateResult || !GD) return;

    var measured = GD.oreRate(
      nodes.rateBefore ? nodes.rateBefore.value : null,
      nodes.rateAfter ? nodes.rateAfter.value : null,
      nodes.rateMinutes ? nodes.rateMinutes.value : null
    );

    if (measured === null) {
      nodes.rateResult.textContent = "Enter two ore readings with some ore gained and a time above zero.";
      if (nodes.rateApply) nodes.rateApply.disabled = true;
      return;
    }

    if (nodes.rateApply) nodes.rateApply.disabled = false;
    nodes.rateResult.textContent = "Measured rate: " + fmt(measured) + " ore/hour.";

    if (apply) {
      state.orePerHour = measured;
      if (nodes.rate) nodes.rate.value = inputValue(measured);
      update();
      nodes.rateResult.textContent = "Measured rate: " + fmt(measured) + " ore/hour. Applied.";
    }
  }

  /* ---------------------------------------------------------------- */
  /* results                                                          */
  /* ---------------------------------------------------------------- */

  function figureText(e) {
    if (e.error) return "-";
    if (e.target <= 0) return "-";
    if (e.goalReached) return "Goal reached";
    if (e.readyToCraft) return "Ready now";
    if (!(e.rate > 0)) return "-";
    return fmtDuration(e.hours);
  }

  function detailText(e) {
    if (e.error) return e.error;
    if (e.target <= 0) return "Set a target above zero.";
    if (e.goalReached) {
      return "You already have " + fmt(e.current) + " of " + fmt(e.target) + " " + e.unit + ".";
    }
    if (e.readyToCraft) {
      return "You already have enough ore to craft the remaining " + fmt(e.remaining) + " bars. Craft them to finish.";
    }
    if (!(e.rate > 0)) {
      return "Enter your ore per hour, or measure it with the rate helper, to see how long this takes.";
    }
    if (!(e.hoursPerDay > 0)) {
      return fmtDuration(e.hours) + " of play. Set play hours per day for a calendar estimate.";
    }
    return "\u2248 " + fmtCalendar(e.calendarDays) + " at " + fmtNumber(e.hoursPerDay) + " h/day.";
  }

  function finishText(e) {
    if (e.error) return "-";
    if (e.target <= 0) return "-";
    if (e.goalReached) return "Goal reached";
    if (e.readyToCraft) return "Ready now";
    if (!(e.rate > 0)) return "Add a rate to estimate";
    if (!(e.hoursPerDay > 0)) return "Set play hours per day";
    return fmtFinish(e.finishAt);
  }

  function finishNote(e) {
    if (e.goalReached) return "No time left to plan.";
    if (e.readyToCraft) return "Craft the bars from your stored ore.";
    if (!(e.rate > 0)) return "The finish date appears once a rate is set.";
    if (!(e.hoursPerDay > 0)) return "No calendar date without play hours per day.";
    return "At " + fmt(e.rate) + " ore/hour and " + fmtNumber(e.hoursPerDay) + " h/day.";
  }

  function progressText(e) {
    if (e.target <= 0) return "Set a target";
    if (e.goalReached) return "Goal reached";
    var pct = Math.round(e.progress * 100);
    return pct + "% " + (e.mode === "bars" ? "crafted" : "complete");
  }

  function statusHint(e) {
    if (e.error) return e.error;
    if (e.target <= 0) return "Set a target above zero to plan a goal.";
    if (e.goalReached) return "Goal reached. Raise the target to plan the next one.";
    if (e.readyToCraft) return "Your stored ore covers the remaining bars. Craft them, then raise the target to plan again.";
    return "";
  }

  function renderFacts(e) {
    var rows = [];

    if (e.mode === "bars") {
      rows.push(["Current bars", fmt(e.current)]);
      rows.push(["Target bars", fmt(e.target)]);
      rows.push(["Bars remaining", fmt(e.remaining)]);
      if (e.barRate) {
        rows.push(["Bar level", "Level " + e.barRate.level + " - " + e.barRate.bar.name]);
        rows.push(["Effective ore per bar", fmt(e.barRate.orePerBar)]);
        rows.push(["Bars per ore (average)", fmt(e.barRate.barsPerOre)]);
        rows.push(["Ore needed for those bars", fmt(e.oreNeeded)]);
        rows.push(["Current ore counted", fmt(e.currentOre)]);
        rows.push(["Ore still to mine", fmt(e.remainingOre)]);
      }
    } else {
      rows.push(["Current ore", fmt(e.currentOre)]);
      rows.push(["Target ore", fmt(e.target)]);
      rows.push(["Ore remaining", fmt(e.remaining)]);
    }

    rows.push(["Your rate", e.rate > 0 ? fmt(e.rate) + " ore/hour" : "Not set"]);
    rows.push(["Play hours per day", fmtNumber(e.hoursPerDay) + " h"]);

    var dl = el("dl", "goal-facts");
    dl.id = "goal-facts";
    rows.forEach(function (row) {
      var wrap = el("div");
      wrap.appendChild(el("dt", null, row[0]));
      wrap.appendChild(el("dd", null, row[1]));
      dl.appendChild(wrap);
    });
    return dl;
  }

  function renderMilestones(e) {
    if (e.target <= 0 || e.error) return null;

    var box = el("div", "goal-milestones");
    box.id = "goal-milestones";
    box.appendChild(el("h3", null, "Milestones"));

    var table = el("table", "goal-milestone-table");
    var thead = el("thead");
    var hr = el("tr");
    var headers = ["Milestone", e.mode === "bars" ? "Bar target" : "Ore target"];
    if (e.mode === "bars") headers.push("Ore to mine");
    headers.push("Time from now", "Finish");
    headers.forEach(function (label) { hr.appendChild(el("th", null, label)); });
    thead.appendChild(hr);
    table.appendChild(thead);

    var tbody = el("tbody");
    e.milestones.forEach(function (m) {
      var done = e.progress * 100 >= m.pct - 1e-9;
      var ready = e.mode === "bars" && !done && m.remainingOre === 0;
      var tr = el("tr", done ? "done" : "");

      tr.appendChild(el("td", "goal-step", m.pct + "%"));
      tr.appendChild(el("td", "num", fmt(m.amount)));
      if (e.mode === "bars") tr.appendChild(el("td", "num", fmt(m.remainingOre)));

      var timeText = done ? "Done" : ready ? "Ready now" :
        (e.rate > 0 && isFinite(m.hours) ? fmtDuration(m.hours) : "-");
      tr.appendChild(el("td", "num", timeText));

      var finish = done ? "-" : ready ? "Now" :
        (e.rate > 0 && e.hoursPerDay > 0 && m.finishAt ? fmtFinish(m.finishAt) : "-");
      tr.appendChild(el("td", "goal-finish-cell", finish));

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    box.appendChild(scrollWrap(table));

    if (e.mode === "bars") {
      box.appendChild(el("p", "hint",
        "Bars per ore is a long-run average. Free and multiplier crafts are random, so a short session can produce very different bar counts."));
    }

    return box;
  }

  function renderDeadline(e) {
    var box = el("div", "goal-deadline-box");
    box.id = "goal-deadline-result";
    box.appendChild(el("h3", null, "Deadline plan"));

    if (!e.deadline) {
      box.appendChild(el("p", "hint", "Set a deadline in step 1 to see the ore per hour it needs."));
      return box;
    }

    if (e.deadlinePassed) {
      var passed = el("p", "goal-warning", "That deadline has already passed. Pick a later date.");
      passed.id = "goal-deadline-status";
      box.appendChild(passed);
      return box;
    }

    if (e.goalReached) {
      var reached = el("p", "goal-deadline-status on-track", "Goal already reached - no extra rate is needed.");
      reached.id = "goal-deadline-status";
      box.appendChild(reached);
      return box;
    }

    if (e.readyToCraft) {
      var ready = el("p", "goal-deadline-status on-track", "No extra ore needed - your stored ore covers the remaining bars.");
      ready.id = "goal-deadline-status";
      box.appendChild(ready);
      return box;
    }

    if (!(e.hoursPerDay > 0) || !(e.requiredRate > 0) || !isFinite(e.requiredRate)) {
      var noTime = el("p", "goal-warning",
        "There is no play time before that deadline at your current hours per day. Raise the hours or choose a later date.");
      noTime.id = "goal-deadline-status";
      box.appendChild(noTime);
      return box;
    }

    var required = el("p", "goal-required-rate",
      "Required rate: " + fmt(Math.ceil(e.requiredRate)) + " ore/hour");
    required.id = "goal-required-rate";
    box.appendChild(required);

    var onTrack = e.rate >= e.requiredRate;
    var gap = Math.abs(e.rate - e.requiredRate);
    var statusText;
    if (onTrack) {
      statusText = "On track at your current rate (" + fmt(gap) + " ore/hour spare).";
    } else {
      statusText = "Short by " + fmt(gap) + " ore/hour at your current rate.";
    }

    var status = el("p", "goal-deadline-status " + (onTrack ? "on-track" : "short"), statusText);
    status.id = "goal-deadline-status";
    box.appendChild(status);

    box.appendChild(el("p", "hint",
      "You have " + fmt(e.deadlinePlayHours) + " play-hours before " + fmtFinish(e.deadline) +
      " at " + fmtNumber(e.hoursPerDay) + " h/day."));

    return box;
  }

  function renderResults() {
    if (!nodes.results || !GD) return;
    nodes.results.innerHTML = "";

    var e = GD.estimate({
      mode: state.mode,
      currentOre: state.currentOre,
      targetOre: state.targetOre,
      currentBars: state.currentBars,
      targetBars: state.targetBars,
      level: state.level,
      values: state.values,
      orePerHour: state.orePerHour,
      hoursPerDay: state.hoursPerDay,
      deadline: state.deadline,
      now: new Date()
    });
    lastEstimate = e;

    var card = el("div", "goal-eta-card");
    card.id = "goal-eta-card";

    var main = el("div", "goal-eta-main");
    main.appendChild(el("span", "goal-eta-label",
      e.mode === "bars" ? "Estimated time to bar goal" : "Estimated time to ore goal"));
    var figure = el("strong", "goal-eta-figure", figureText(e));
    figure.id = "goal-eta";
    main.appendChild(figure);
    var detail = el("span", "goal-eta-detail", detailText(e));
    detail.id = "goal-eta-detail";
    main.appendChild(detail);
    card.appendChild(main);

    var finish = el("div", "goal-eta-finish");
    finish.appendChild(el("span", "goal-eta-label", "Estimated finish"));
    var finishValue = el("strong", "goal-eta-finish-value", finishText(e));
    finishValue.id = "goal-finish";
    finish.appendChild(finishValue);
    var finishSub = el("span", "goal-eta-detail", finishNote(e));
    finishSub.id = "goal-finish-note";
    finish.appendChild(finishSub);
    card.appendChild(finish);

    var progress = el("div", "goal-progress");
    var head = el("div", "goal-progress-head");
    var label = el("span", "goal-progress-label", progressText(e));
    label.id = "goal-progress-label";
    head.appendChild(label);
    head.appendChild(el("span", "goal-progress-amount",
      fmt(e.current) + " / " + fmt(e.target) + " " + e.unit));
    progress.appendChild(head);

    var pct = e.target > 0 ? Math.max(0, Math.min(100, e.progress * 100)) : 0;
    var track = el("div", "goal-progress-track");
    track.id = "goal-progress";
    track.setAttribute("role", "progressbar");
    track.setAttribute("aria-valuemin", "0");
    track.setAttribute("aria-valuemax", "100");
    track.setAttribute("aria-valuenow", String(Math.round(pct)));
    var fill = el("div", "goal-progress-fill");
    fill.id = "goal-progress-fill";
    fill.style.width = pct.toFixed(1) + "%";
    track.appendChild(fill);
    progress.appendChild(track);
    card.appendChild(progress);

    nodes.results.appendChild(card);

    if (e.error) {
      var warn = el("p", "goal-warning", e.error);
      warn.id = "goal-warning";
      nodes.results.appendChild(warn);
    }

    var hint = statusHint(e);
    if (hint) {
      var hintNode = el("p", "hint goal-note", hint);
      hintNode.id = "goal-note";
      nodes.results.appendChild(hintNode);
    }

    nodes.results.appendChild(renderFacts(e));

    var milestones = renderMilestones(e);
    if (milestones) nodes.results.appendChild(milestones);

    nodes.results.appendChild(renderDeadline(e));
  }

  /* ---------------------------------------------------------------- */
  /* mode and update                                                  */
  /* ---------------------------------------------------------------- */

  function renderMode() {
    var bars = state.mode === "bars";

    if (nodes.modeOre) nodes.modeOre.checked = !bars;
    if (nodes.modeBars) nodes.modeBars.checked = bars;

    if (nodes.targetOreField) nodes.targetOreField.hidden = bars;
    if (nodes.currentBarsField) nodes.currentBarsField.hidden = !bars;
    if (nodes.targetBarsField) nodes.targetBarsField.hidden = !bars;
    if (nodes.levelField) nodes.levelField.hidden = !bars;

    if (nodes.currentOreLabel) nodes.currentOreLabel.textContent = bars ? "Ore already mined" : "Current ore";
    if (nodes.modeNote) {
      nodes.modeNote.textContent = bars
        ? "Bars are converted to ore with your crafting stats, then timed with your ore per hour."
        : "Use an ore per hour rate you measured in-game, or the rate helper below.";
    }
  }

  function update() {
    renderMode();
    renderResults();
    saveInputs();
  }

  /* ---------------------------------------------------------------- */
  /* init                                                             */
  /* ---------------------------------------------------------------- */

  function cacheNodes() {
    nodes.modeOre = document.getElementById("goal-mode-ore");
    nodes.modeBars = document.getElementById("goal-mode-bars");
    nodes.modeNote = document.getElementById("goal-mode-note");
    nodes.currentOreLabel = document.getElementById("goal-current-ore-label");
    nodes.currentOre = document.getElementById("goal-current-ore");
    nodes.targetOre = document.getElementById("goal-target-ore");
    nodes.targetOreField = document.getElementById("goal-target-ore-field");
    nodes.currentBars = document.getElementById("goal-current-bars");
    nodes.currentBarsField = document.getElementById("goal-current-bars-field");
    nodes.targetBars = document.getElementById("goal-target-bars");
    nodes.targetBarsField = document.getElementById("goal-target-bars-field");
    nodes.level = document.getElementById("goal-level");
    nodes.levelField = document.getElementById("goal-level-field");
    nodes.rate = document.getElementById("goal-rate");
    nodes.hoursDay = document.getElementById("goal-hours-day");
    nodes.deadline = document.getElementById("goal-deadline");
    nodes.rateBefore = document.getElementById("goal-rate-before");
    nodes.rateAfter = document.getElementById("goal-rate-after");
    nodes.rateMinutes = document.getElementById("goal-rate-minutes");
    nodes.rateApply = document.getElementById("goal-rate-apply");
    nodes.rateResult = document.getElementById("goal-rate-result");
    nodes.results = document.getElementById("goal-results");
    nodes.stats = document.getElementById("goal-stats");
    nodes.statsDetails = document.getElementById("goal-stats-details");
    nodes.statsSource = document.getElementById("goal-stats-source");
    nodes.statsWarning = document.getElementById("goal-stats-warning");
    nodes.reload = document.getElementById("goal-reload-account");
    nodes.reset = document.getElementById("goal-reset-stats");
  }

  function init() {
    if (!GD || !BD) return;
    cacheNodes();
    if (!nodes.results || !nodes.stats) return;

    loadSavedInputs();
    renderLevelOptions();
    renderStats();
    bindControls();
    fillInputs();
    updateRateHelper(false);

    state.missing = craftingFields().length;

    var acct = readAccount();
    if (acct && acct.stats) {
      applyAccount(acct);
    } else {
      state.values = BD.defaults();
      state.source = "defaults";
      state.applied = 0;
      updateStatsNote();
      update();
    }
  }

  // Home-page Reset also clears the goal targets and measured rate.
  function resetAll() {
    if (!BD) return;
    clearSavedInputs();
    state.mode = DEFAULTS.mode;
    state.currentOre = DEFAULTS.currentOre;
    state.targetOre = DEFAULTS.targetOre;
    state.currentBars = DEFAULTS.currentBars;
    state.targetBars = DEFAULTS.targetBars;
    state.level = DEFAULTS.level;
    state.orePerHour = DEFAULTS.orePerHour;
    state.hoursPerDay = DEFAULTS.hoursPerDay;
    state.deadline = DEFAULTS.deadline;

    if (nodes.rateBefore) nodes.rateBefore.value = "";
    if (nodes.rateAfter) nodes.rateAfter.value = "";
    if (nodes.rateMinutes) nodes.rateMinutes.value = "";
    updateRateHelper(false);

    fillInputs();
    resetStats();
    saveInputs();
  }

  global.GoalTool = {
    init: init,
    refreshAccount: refreshAccount,
    resetAll: resetAll,
    getState: function () {
      return {
        mode: state.mode,
        currentOre: state.currentOre,
        targetOre: state.targetOre,
        currentBars: state.currentBars,
        targetBars: state.targetBars,
        level: state.level,
        orePerHour: state.orePerHour,
        hoursPerDay: state.hoursPerDay,
        deadline: state.deadline,
        statsSource: state.source,
        values: BD ? BD.normalizeValues(state.values) : {},
        estimate: lastEstimate
      };
    }
  };

})(typeof window !== "undefined" ? window : globalThis);
