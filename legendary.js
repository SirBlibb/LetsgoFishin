/*
 * Legendary Fish tool UI.
 *
 * Depends on legendarydata.js (window.LegendaryData), exportstats.js and
 * account.js when a saved account is present.
 *
 * Exposed as window.LegendaryTool so app.js can initialise it and refresh it
 * after an account import/reset.
 */
(function (global) {
  "use strict";

  var LD = global.LegendaryData;
  if (!LD) return;

  var ACCOUNT = global.AccountStore || null;
  var ES = global.ExportStats || null;
  var KEY = "obelisk-legendary-v1";

  var state = LD.defaults();
  var nodes = {};
  var ready = false;
  var lastResult = null;

  var SUFFIX = ["", "k", "m", "b", "t", "q", "qi", "sx", "sp", "oc", "no", "dc", "ud", "dd", "td"];

  /* ---------------------------------------------------------------- */
  /* formatting                                                        */
  /* ---------------------------------------------------------------- */

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

  function fmtInt(n) {
    if (n === null || n === undefined || !isFinite(n)) return "-";
    return Math.round(n).toLocaleString("en-US");
  }

  function fmtPercentValue(pct) {
    if (!isFinite(pct)) return "-";
    if (pct === 0) return "0%";
    if (pct >= 1000) return fmt(pct) + "%";
    if (pct >= 10) return pct.toFixed(1) + "%";
    if (pct >= 0.01) return pct.toFixed(2) + "%";
    if (pct >= 0.0001) return pct.toFixed(4) + "%";
    return pct.toExponential(2) + "%";
  }

  function fmtFraction(p) {
    if (!(p > 0) || !isFinite(p)) return "0%";
    return fmtPercentValue(p * 100);
  }

  function fmtOneIn(p) {
    if (!(p > 0) || !isFinite(p)) return "-";
    var n = 1 / p;
    if (n >= 100) return "1 in " + fmtInt(n);
    return "1 in " + fmt(n);
  }

  function fmtDuration(seconds) {
    if (seconds === null || seconds === undefined || !isFinite(seconds)) return "-";
    if (seconds <= 0) return "0 seconds";
    if (seconds < 1) return "< 1 second";
    if (seconds < 60) return fmt(seconds) + " seconds";
    if (seconds < 3600) return fmt(seconds / 60) + " minutes";
    if (seconds < 86400) return fmt(seconds / 3600) + " hours";
    if (seconds < 86400 * 365) return fmt(seconds / 86400) + " days";
    return fmt(seconds / (86400 * 365)) + " years";
  }

  function fmtDurationDetail(seconds) {
    if (!isFinite(seconds)) return "-";
    if (seconds < 3600) return fmtDuration(seconds);
    if (seconds < 86400) return fmtDuration(seconds) + " (" + fmt(seconds / 86400) + " days)";
    return fmtDuration(seconds) + " (" + fmt(seconds / 3600) + " hours)";
  }

  /* ---------------------------------------------------------------- */
  /* saved state                                                       */
  /* ---------------------------------------------------------------- */

  function getStorage() {
    try {
      if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
    } catch (e) { /* storage blocked */ }
    return null;
  }

  function loadSavedState() {
    var store = getStorage();
    if (!store) return null;
    try {
      var raw = store.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveState() {
    var store = getStorage();
    if (!store) return;
    try {
      store.setItem(KEY, JSON.stringify(state));
    } catch (e) { /* storage full or blocked */ }
  }

  function mergeSaved(saved) {
    var base = LD.defaults();
    if (!saved || typeof saved !== "object") return base;

    Object.keys(base).forEach(function (k) {
      if (k === "polyByDock" || k === "dockTicks" || k === "accountVersion") return;
      var d = base[k];
      var v = saved[k];
      if (typeof d === "number" && typeof v === "number" && isFinite(v)) base[k] = v;
      else if (typeof d === "boolean" && typeof v === "boolean") base[k] = v;
      else if (typeof d === "string" && typeof v === "string") base[k] = v;
    });

    if (typeof saved.dock === "string" && LD.DOCK_BY_ID[saved.dock]) base.dock = saved.dock;
    if (typeof saved.accountVersion === "string") base.accountVersion = saved.accountVersion;

    if (saved.polyByDock && typeof saved.polyByDock === "object") {
      LD.DOCKS.forEach(function (d) {
        if (typeof saved.polyByDock[d.id] === "boolean") base.polyByDock[d.id] = saved.polyByDock[d.id];
      });
    }
    if (saved.dockTicks && typeof saved.dockTicks === "object") {
      LD.DOCKS.forEach(function (d) {
        var v = saved.dockTicks[d.id];
        if (typeof v === "number" && isFinite(v) && v > 0) base.dockTicks[d.id] = v;
      });
    }

    if (!(base.ticksPerFill > 0)) base.ticksPerFill = base.dockTicks[base.dock] || 5;
    base.polyCards = LD.polyForDock(base, base.dock);
    return base;
  }

  /* ---------------------------------------------------------------- */
  /* account import                                                    */
  /* ---------------------------------------------------------------- */

  function readAccount() {
    if (!ACCOUNT || !ES) return null;
    var record = ACCOUNT.load();
    if (!record || typeof record.raw !== "string") return null;
    try {
      var parsed = ES.parseExport(record.raw);
      return {
        stats: parsed.stats,
        version: parsed.version || record.version || "?"
      };
    } catch (e) {
      return null;
    }
  }

  function applyStats(stats, source, version) {
    var a = LD.fromAccountStats(stats);
    state.rodPower = a.rodPower;
    state.droneCapacity = a.droneCapacity;
    state.dronesAssigned = a.droneCapacity;
    state.droneBasePower = a.droneBasePower;
    state.droneMultiplier = a.droneMultiplier;
    state.tier2DockMulti = a.tier2DockMulti;
    state.tickReduction = a.tickReduction;
    state.doubleTick = a.doubleTick;
    state.tripleTick = a.tripleTick;
    state.fiveTick = a.fiveTick;
    state.anglerEquipped = a.anglerEquipped;
    state.anglerFueled = a.anglerEquipped && a.anglerFueled;
    state.anglerGrade = a.anglerGrade;
    state.anglerUpgradeLevel = a.anglerUpgradeLevel;
    state.polyKnown = a.polyKnown;
    if (a.polyKnown) state.polyByDock = a.polyByDock;
    else state.polyByDock = LD.defaults().polyByDock;
    state.dockTicks = a.dockTicks;
    state.ticksPerFill = LD.tickForDock(state, state.dock);
    state.ticksAuto = true;
    state.polyCards = LD.polyForDock(state, state.dock);
    state.source = source;
    state.accountVersion = version || null;
  }

  function refreshAccount() {
    var acct = readAccount();
    if (!acct) {
      renderStatus();
      return;
    }
    applyStats(acct.stats, "account", acct.version);
    if (ready) {
      fillControls();
      update();
    }
  }

  function resetAll() {
    state = LD.defaults();
    if (ready) {
      fillControls();
      update();
    }
  }

  /* ---------------------------------------------------------------- */
  /* derived helpers                                                   */
  /* ---------------------------------------------------------------- */

  function markEdited() {
    if (state.source === "account" || state.source === "account-edited") return "account-edited";
    if (state.source === "sample") return "sample-edited";
    return "manual";
  }

  function selectedTicks() {
    if (state.ticksAuto) return LD.tickForDock(state, state.dock);
    return Math.max(1, Number(state.ticksPerFill) || 1);
  }

  function computeSelected() {
    return LD.compute({
      dock: state.dock,
      rodAssigned: state.rodAssigned,
      rodPower: state.rodPower,
      dronesAssigned: state.dronesAssigned,
      droneCapacity: state.droneCapacity,
      droneBasePower: state.droneBasePower,
      droneMultiplier: state.droneMultiplier,
      tier2DockMulti: state.tier2DockMulti,
      tickReduction: state.tickReduction,
      tick3x: state.tick3x,
      doubleTick: state.doubleTick,
      tripleTick: state.tripleTick,
      fiveTick: state.fiveTick,
      anglerEquipped: state.anglerEquipped,
      anglerFueled: state.anglerFueled,
      anglerGrade: state.anglerGrade,
      anglerUpgradeLevel: state.anglerUpgradeLevel,
      ticksPerFill: selectedTicks(),
      polyCards: !!state.polyCards
    });
  }

  /* ---------------------------------------------------------------- */
  /* note lines                                                        */
  /* ---------------------------------------------------------------- */

  function updateNotes(r) {
    var d = r.dock;
    var tierText = d.tier === 2 ? "a Tier 2 dock" : "a Tier 1 dock";
    nodes.dockNote.textContent = d.id + " is " + tierText + ". Last fish: " + d.lastFish +
      " (power rating " + fmtInt(d.rating) + "). Legendary fish: " + d.legendary + ".";

    var droneText = fmt(state.droneBasePower) + " base x " + fmt(state.droneMultiplier) +
      " multi = " + fmt(r.dronePowerEach) + " power per drone.";
    var assignText = state.droneCapacity > 0
      ? state.dronesAssigned + " of " + fmtInt(state.droneCapacity) + " drones assigned"
      : state.dronesAssigned + " drones assigned";
    var rodText = state.rodAssigned ? "Rod " + fmt(r.rodPowerUsed) : "Rod not assigned here";
    var powerText = rodText + " + " + assignText + " = " + fmt(r.rodPowerUsed + r.dronePowerTotal) + " raw power";
    if (d.tier === 2 && r.tier2Multiplier !== 1) {
      powerText += ", x " + fmt(r.tier2Multiplier) + " Tier 2 = " + fmt(r.power) + " dock power";
    } else {
      powerText += " = " + fmt(r.power) + " dock power";
    }
    nodes.powerNote.textContent = droneText + " " + powerText + ".";

    var tickText = "Tick bar: 60 - " + fmt(state.tickReduction) + " = " + fmt(r.tickSeconds * (state.tick3x ? 3 : 1)) +
      "s" + (state.tick3x ? ", divided by 3 for the active buff = " + fmt(r.tickSeconds) + "s" : "") + ".";
    tickText += " Double / triple / 5x average " + fmt(r.expectedTicksPerEvent) +
      " ticks per tick event. Angler adds " + fmt(r.anglerPassiveTicksPerSecond) +
      " ticks per second (" + fmt(LD.anglerTicksPerCycle(state)) + " per cycle).";
    tickText += " " + fmt(r.ticksPerSecond) + " ticks per second in total, so a dock needing " + fmt(r.ticksPerFill) +
      " ticks fills " + fmt(r.fillsPerHour) + " times per hour.";
    nodes.tickNote.textContent = tickText;

    if (!state.anglerEquipped) {
      nodes.anglerNote.textContent = "Angler not equipped. Equipping it adds passive fishing ticks; fuelling it adds the legendary fish chance bonus and a small extra-tick proc.";
    } else if (!state.anglerFueled) {
      nodes.anglerNote.textContent = "Angler equipped but not fuelled. Passive ticks: " +
        fmt(r.anglerPassiveTicksPerSecond) + " per second (" + fmt(LD.anglerTicksPerCycle(state)) +
        " per cycle). The legendary chance bonus and extra-tick proc only apply while fuelled.";
    } else {
      nodes.anglerNote.textContent = "Angler fuelled at grade " + fmtInt(state.anglerGrade) + ": " +
        fmtPercentValue(LD.ANGLER_BONUS_PER_GRADE * (state.anglerGrade + 1) * 100) +
        " legendary chance bonus, denominator " + fmtInt(r.legendaryDenominator) +
        ". Ticks: " + fmt(LD.anglerTicksPerCycle(state)) + " per cycle, or " +
        fmt(r.anglerPassiveTicksPerSecond) + " per second.";
    }
  }

  /* ---------------------------------------------------------------- */
  /* results                                                           */
  /* ---------------------------------------------------------------- */

  function renderHero(r) {
    nodes.hero.innerHTML = "";

    var card = el("div", "goal-eta-card");
    var main = el("div", "goal-eta-main");
    main.appendChild(el("span", "goal-eta-label", "Average time to catch " + r.dock.legendary));

    var headline;
    if (r.steps <= 0) headline = "Not eligible yet";
    else headline = fmtDuration(r.meanSeconds) + (r.polyCards ? "" : " *");
    main.appendChild(el("div", "goal-eta-figure", headline));

    var detail;
    if (r.steps <= 0) {
      detail = "Needs 100% catch chance on " + r.dock.lastFish + ". You need " +
        fmt(r.powerGapFor100) + " more dock power (" + fmtPercentValue(r.catchChance) + " now).";
    } else if (!r.polyCards) {
      detail = "Assumes all four polychrome cards for this dock. Median " +
        fmtDuration(r.medianSeconds) + "; 90% chance by " + fmtDuration(r.quantiles[2].seconds) + ".";
    } else {
      detail = "Median " + fmtDuration(r.medianSeconds) + "; 90% chance by " +
        fmtDuration(r.quantiles[2].seconds) + "; 99% by " + fmtDuration(r.quantiles[4].seconds) + ".";
    }
    main.appendChild(el("p", "goal-eta-detail", detail));

    var side = el("div", "goal-eta-finish");
    side.appendChild(el("span", "goal-eta-label", "Chance per dock fill"));
    side.appendChild(el("div", "goal-eta-finish-value", r.steps > 0 ? fmtOneIn(r.chancePerFill) : "-"));
    side.appendChild(el("p", "goal-eta-detail", r.steps > 0
      ? fmtFraction(r.chancePerFill) + " - " + fmt(r.fillsPerHour) + " fills per hour"
      : "No legendary roll until the last fish reaches 100%."));

    var progress = el("div", "goal-progress");
    var head = el("div", "goal-progress-head");
    head.appendChild(el("span", "goal-progress-label", "Legendary chance steps"));
    head.appendChild(el("span", null, r.steps + " / " + LD.LEGENDARY_MAX_STEPS));
    progress.appendChild(head);
    var track = el("div", "goal-progress-track");
    var fill = el("div", "goal-progress-fill");
    fill.style.width = (100 * r.steps / LD.LEGENDARY_MAX_STEPS) + "%";
    track.appendChild(fill);
    progress.appendChild(track);
    card.appendChild(main);
    card.appendChild(side);
    card.appendChild(progress);
    nodes.hero.appendChild(card);
  }

  function renderWarnings(r) {
    nodes.warning.innerHTML = "";
    var list = [];

    if (r.steps <= 0) {
      list.push("Not eligible: " + r.dock.lastFish + " is at " + fmtPercentValue(r.catchChance) +
        " catch chance. Reach 100% first; you need " + fmt(r.powerGapFor100) + " more dock power.");
    } else if (!r.polyCards) {
      list.push("All four polychrome cards are required before " + r.dock.legendary +
        " can be caught. The time above is what you would average if you had them.");
    }

    if (state.anglerEquipped && !state.anglerFueled) {
      list.push("The Angler drone is equipped but not fuelled, so its legendary chance bonus is off.");
    }
    if (state.tick3x) {
      list.push("The 3x tick buff is temporary. This average assumes it stays on all the time.");
    }
    if (state.droneCapacity > 0 && state.dronesAssigned > state.droneCapacity) {
      list.push("More drones are assigned than your cap of " + fmtInt(state.droneCapacity) + ".");
    }
    if (state.source === "sample") {
      list.push("These are the v2.2.52 sample stats, not your account. Import your own export for accurate numbers.");
    } else if (state.source === "sample-edited") {
      list.push("These values started from the v2.2.52 sample and were edited by hand.");
    }

    list.forEach(function (text) {
      nodes.warning.appendChild(el("p", null, text));
    });
  }

  function fact(root, label, value) {
    var row = el("div");
    row.appendChild(el("dt", null, label));
    row.appendChild(el("dd", null, value));
    root.appendChild(row);
  }

  function renderFacts(r) {
    nodes.facts.innerHTML = "";
    var dl = el("dl", "goal-facts");

    fact(dl, "Dock power", fmt(r.power) + (r.tier2Multiplier !== 1 ? " (x " + fmt(r.tier2Multiplier) + ")" : ""));
    fact(dl, "Last fish catch chance", fmtPercentValue(Math.min(999, r.catchChance)) + (r.catchChance > 999 ? " (capped)" : ""));
    fact(dl, "Legendary steps", r.steps + " / " + LD.LEGENDARY_MAX_STEPS);
    fact(dl, "Legendary chance per fill", r.steps > 0 ? fmtOneIn(r.chancePerFill) : "-");
    fact(dl, "Angler denominator", r.steps > 0 ? fmtInt(r.legendaryDenominator) + " (" + fmt(r.anglerFactor) + "x chance)" : "-");
    fact(dl, "Ticks to fill this dock", fmt(r.ticksPerFill));
    fact(dl, "Tick bar time", fmt(r.tickSeconds) + " s");
    fact(dl, "Ticks per tick event", fmt(r.expectedTicksPerEvent) + " expected");
    fact(dl, "Angler ticks per cycle", fmt(LD.anglerTicksPerCycle(state)));
    fact(dl, "Angler ticks per second", fmt(r.anglerPassiveTicksPerSecond));
    fact(dl, "Ticks per second", fmt(r.ticksPerSecond));
    fact(dl, "Dock fills per hour", fmt(r.fillsPerHour));
    fact(dl, "Seconds per dock fill", fmt(r.secondsPerFill));
    fact(dl, "Long-run catches per day", r.catchesPerDay > 0 ? fmt(r.catchesPerDay) : "-");
    fact(dl, "Power for next step", r.steps >= LD.LEGENDARY_MAX_STEPS
      ? "900% reached"
      : (fmt(r.nextStepPower) + (r.nextStepGap > 0 ? " (+" + fmt(r.nextStepGap) + ")" : " (reached)")));
    fact(dl, "Power for 900%", fmt(r.powerFor900));

    nodes.facts.appendChild(dl);
  }

  function renderTimeline(r) {
    nodes.timeline.innerHTML = "";
    if (r.steps <= 0) {
      nodes.timeline.appendChild(el("p", "hint", "The odds appear once " + r.dock.lastFish +
        " reaches a 100% catch chance."));
      return;
    }

    var box = el("div", "goal-milestones");
    box.appendChild(el("h3", null, "Chance to have caught it"));
    var wrap = el("div", "table-scroll");
    var table = el("table", "goal-milestone-table");
    var thead = el("thead");
    var hr = el("tr");
    ["Time from now", "Chance caught", "Dock fills"].forEach(function (h) {
      hr.appendChild(el("th", null, h));
    });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody");
    r.within.forEach(function (w) {
      var tr = el("tr");
      tr.appendChild(el("td", null, w.label));
      tr.appendChild(el("td", "num", fmtFraction(w.chance)));
      tr.appendChild(el("td", "num", fmt(w.seconds * r.fillsPerSecond)));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    box.appendChild(wrap);

    box.appendChild(el("h3", "legendary-subhead", "Time for a given chance"));
    var wrap2 = el("div", "table-scroll");
    var table2 = el("table", "goal-milestone-table");
    var thead2 = el("thead");
    var hr2 = el("tr");
    ["Chance", "Time", "Dock fills"].forEach(function (h) {
      hr2.appendChild(el("th", null, h));
    });
    thead2.appendChild(hr2);
    table2.appendChild(thead2);
    var tbody2 = el("tbody");
    r.quantiles.forEach(function (q) {
      var tr = el("tr");
      tr.appendChild(el("td", "goal-step", fmtInt(q.chance * 100) + "%"));
      tr.appendChild(el("td", "goal-finish-cell", fmtDurationDetail(q.seconds)));
      tr.appendChild(el("td", "num", fmt(q.seconds * r.fillsPerSecond)));
      tbody2.appendChild(tr);
    });
    table2.appendChild(tbody2);
    wrap2.appendChild(table2);
    box.appendChild(wrap2);

    nodes.timeline.appendChild(box);
  }

  function renderDocks() {
    nodes.docks.innerHTML = "";
    var rows = LD.DOCKS.map(function (d) {
      var ticks = d.id === state.dock && !state.ticksAuto
        ? Math.max(1, state.ticksPerFill)
        : LD.tickForDock(state, d.id);
      var poly = LD.polyForDock(state, d.id);
      var r = LD.compute({
        dock: d.id,
        rodAssigned: state.rodAssigned,
        rodPower: state.rodPower,
        dronesAssigned: state.dronesAssigned,
        droneBasePower: state.droneBasePower,
        droneMultiplier: state.droneMultiplier,
        tier2DockMulti: state.tier2DockMulti,
        tickReduction: state.tickReduction,
        tick3x: state.tick3x,
        doubleTick: state.doubleTick,
        tripleTick: state.tripleTick,
        fiveTick: state.fiveTick,
        anglerEquipped: state.anglerEquipped,
        anglerFueled: state.anglerFueled,
        anglerGrade: state.anglerGrade,
        anglerUpgradeLevel: state.anglerUpgradeLevel,
        ticksPerFill: ticks,
        polyCards: poly
      });
      return { dock: d, r: r, poly: poly };
    });

    rows.sort(function (a, b) {
      var av = a.r.steps > 0 && isFinite(a.r.meanSeconds) ? a.r.meanSeconds : Infinity;
      var bv = b.r.steps > 0 && isFinite(b.r.meanSeconds) ? b.r.meanSeconds : Infinity;
      if (av !== bv) return av - bv;
      return a.dock.baseTicks - b.dock.baseTicks;
    });

    var wrap = el("div", "table-scroll");
    var table = el("table", "legendary-table");
    var thead = el("thead");
    var hr = el("tr");
    ["Dock", "Last fish", "Catch", "Steps", "Chance / fill", "Ticks / fill", "Fills / hour", "Average time", "Status"].forEach(function (h) {
      hr.appendChild(el("th", null, h));
    });
    thead.appendChild(hr);
    table.appendChild(thead);

    var tbody = el("tbody");
    rows.forEach(function (row) {
      var r = row.r;
      var tr = el("tr");
      if (row.dock.id === state.dock) tr.className = "legendary-selected";
      else if (r.steps <= 0) tr.className = "legendary-blocked";

      var name = el("td", "name");
      name.appendChild(el("span", null, row.dock.id));
      name.appendChild(el("span", "legendary-tier", row.dock.tier === 2 ? " T2" : " T1"));
      tr.appendChild(name);

      tr.appendChild(el("td", null, row.dock.lastFish + " (" + fmt(row.dock.rating) + ")"));
      tr.appendChild(el("td", "num", fmtPercentValue(Math.min(999, r.catchChance))));
      tr.appendChild(el("td", "num", r.steps + " / " + LD.LEGENDARY_MAX_STEPS));
      tr.appendChild(el("td", "num", r.steps > 0 ? fmtOneIn(r.chancePerFill) : "-"));
      tr.appendChild(el("td", "num", fmt(r.ticksPerFill)));
      tr.appendChild(el("td", "num", r.steps > 0 ? fmt(r.fillsPerHour) : "-"));
      tr.appendChild(el("td", "legendary-time", r.steps > 0
        ? fmtDuration(r.meanSeconds) + (row.poly ? "" : " *")
        : "-"));

      var status;
      var statusClass;
      if (r.steps <= 0) {
        status = "Need 100% catch";
        statusClass = "legendary-status no";
      } else if (!row.poly) {
        status = state.polyKnown ? "Cards missing" : "Cards not set";
        statusClass = "legendary-status warn";
      } else {
        status = "Ready";
        statusClass = "legendary-status ready";
      }
      var statusCell = el("td", statusClass, status);
      tr.appendChild(statusCell);

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    nodes.docks.appendChild(wrap);
    nodes.docks.appendChild(el("p", "hint", "Fastest first, assuming the fisher and every fishing drone are assigned to that dock. A * means the four polychrome cards are not confirmed."));
  }

  function renderStatus() {
    if (!nodes.status) return;
    var text;
    var version = state.accountVersion ? " (" + state.accountVersion + ")" : "";
    if (state.source === "account") {
      text = "Using your saved account" + version + ". Every fishing drone is assumed assigned to the selected dock.";
    } else if (state.source === "account-edited") {
      text = "Using your saved account" + version + " with hand edits. Every fishing drone is assumed assigned to the selected dock.";
    } else if (state.source === "sample") {
      text = "Using the v2.2.52 sample. Import your own export for accurate numbers.";
    } else if (state.source === "sample-edited") {
      text = "Using the v2.2.52 sample with hand edits.";
    } else {
      text = "Manual entry - import an ExportStats JSON on the home page to fill these fields automatically.";
    }
    nodes.status.textContent = text;
  }

  function update() {
    if (!ready) return;
    var r = computeSelected();
    lastResult = r;
    renderHero(r);
    renderWarnings(r);
    renderFacts(r);
    renderTimeline(r);
    renderDocks();
    updateNotes(r);
    renderStatus();
    saveState();
  }

  /* ---------------------------------------------------------------- */
  /* controls                                                          */
  /* ---------------------------------------------------------------- */

  function setNumber(id, value) {
    if (nodes[id]) nodes[id].value = String(Number(value.toPrecision(12)));
  }

  function fillControls() {
    if (nodes.dock) nodes.dock.value = state.dock;

    if (nodes.rodAssigned) nodes.rodAssigned.checked = !!state.rodAssigned;
    setNumber("rodPower", state.rodPower);
    setNumber("drones", state.dronesAssigned);
    setNumber("droneBase", state.droneBasePower);
    setNumber("droneMulti", state.droneMultiplier);
    setNumber("tier2", state.tier2DockMulti);
    if (nodes.drones) {
      nodes.drones.max = state.droneCapacity > 0 ? String(Math.floor(state.droneCapacity)) : "";
    }
    if (nodes.rodPower) nodes.rodPower.disabled = !state.rodAssigned;

    setNumber("tickReduction", state.tickReduction);
    if (nodes.tick3x) nodes.tick3x.checked = !!state.tick3x;
    setNumber("doubleTick", state.doubleTick);
    setNumber("tripleTick", state.tripleTick);
    setNumber("fiveTick", state.fiveTick);

    if (nodes.anglerEquipped) nodes.anglerEquipped.checked = !!state.anglerEquipped;
    if (nodes.anglerFueled) nodes.anglerFueled.checked = !!state.anglerFueled;
    if (!state.anglerEquipped) {
      state.anglerFueled = false;
      if (nodes.anglerFueled) nodes.anglerFueled.checked = false;
    }
    setNumber("anglerGrade", state.anglerGrade);
    setNumber("anglerLevel", state.anglerUpgradeLevel);

    if (nodes.ticksAuto) nodes.ticksAuto.checked = !!state.ticksAuto;
    setNumber("ticks", selectedTicks());
    if (nodes.ticks) nodes.ticks.disabled = !!state.ticksAuto;
    if (nodes.poly) nodes.poly.checked = !!state.polyCards;

    var dock = LD.dockById(state.dock) || LD.DOCKS[0];
    if (nodes.tier2) nodes.tier2.disabled = dock.tier !== 2;
    if (nodes.anglerFueled) nodes.anglerFueled.disabled = !state.anglerEquipped;
  }

  function syncDock() {
    if (state.ticksAuto) state.ticksPerFill = LD.tickForDock(state, state.dock);
    state.polyCards = LD.polyForDock(state, state.dock);
  }

  function bindNumber(id, key, after) {
    var node = nodes[id];
    if (!node) return;
    node.addEventListener("input", function () {
      var v = parseFloat(node.value);
      state[key] = isFinite(v) ? Math.max(0, v) : 0;
      state.source = markEdited();
      if (after) after();
      update();
    });
  }

  function bindCheck(id, key, after) {
    var node = nodes[id];
    if (!node) return;
    node.addEventListener("change", function () {
      state[key] = !!node.checked;
      state.source = markEdited();
      if (after) after();
      if (ready) { fillControls(); update(); }
    });
  }

  function bindControls() {
    if (nodes.dock) {
      nodes.dock.addEventListener("change", function () {
        state.dock = nodes.dock.value;
        syncDock();
        fillControls();
        update();
      });
    }

    bindNumber("rodPower", "rodPower");
    bindNumber("drones", "dronesAssigned");
    bindNumber("droneBase", "droneBasePower");
    bindNumber("droneMulti", "droneMultiplier");
    bindNumber("tier2", "tier2DockMulti");
    bindNumber("tickReduction", "tickReduction");
    bindNumber("doubleTick", "doubleTick");
    bindNumber("tripleTick", "tripleTick");
    bindNumber("fiveTick", "fiveTick");
    bindNumber("anglerGrade", "anglerGrade");
    bindNumber("anglerLevel", "anglerUpgradeLevel");

    if (nodes.ticks) {
      nodes.ticks.addEventListener("input", function () {
        var v = parseFloat(nodes.ticks.value);
        state.ticksPerFill = isFinite(v) ? Math.max(1, v) : 1;
        state.ticksAuto = false;
        state.source = markEdited();
        if (nodes.ticksAuto) nodes.ticksAuto.checked = false;
        update();
      });
    }

    if (nodes.ticksAuto) {
      nodes.ticksAuto.addEventListener("change", function () {
        state.ticksAuto = !!nodes.ticksAuto.checked;
        if (state.ticksAuto) state.ticksPerFill = LD.tickForDock(state, state.dock);
        fillControls();
        update();
      });
    }

    if (nodes.poly) {
      nodes.poly.addEventListener("change", function () {
        state.polyCards = !!nodes.poly.checked;
        state.polyByDock[state.dock] = state.polyCards;
        state.source = markEdited();
        update();
      });
    }

    bindCheck("rodAssigned", "rodAssigned");
    bindCheck("tick3x", "tick3x");

    bindCheck("anglerEquipped", "anglerEquipped", function () {
      if (!state.anglerEquipped) state.anglerFueled = false;
    });
    bindCheck("anglerFueled", "anglerFueled");
  }

  function buildDockSelect() {
    if (!nodes.dock) return;
    nodes.dock.innerHTML = "";
    LD.DOCKS.forEach(function (d) {
      var opt = el("option", null, d.id + (d.tier === 2 ? " (Tier 2)" : ""));
      opt.value = d.id;
      nodes.dock.appendChild(opt);
    });
    nodes.dock.value = state.dock;
  }

  function cacheNodes() {
    [
      "dock", "ticks", "ticksAuto", "poly", "rodAssigned", "rodPower", "drones",
      "droneBase", "droneMulti", "tier2", "tickReduction", "tick3x", "doubleTick",
      "tripleTick", "fiveTick", "anglerEquipped", "anglerFueled", "anglerGrade",
      "anglerLevel", "dockNote", "powerNote", "tickNote", "anglerNote", "hero",
      "warning", "facts", "timeline", "docks"
    ].forEach(function (id) {
      nodes[id] = document.getElementById("legendary-" + id);
    });
    nodes.status = document.getElementById("legendary-account-status");
  }

  /* ---------------------------------------------------------------- */
  /* init                                                              */
  /* ---------------------------------------------------------------- */

  function init() {
    cacheNodes();
    if (!nodes.hero || !nodes.dock) return;

    buildDockSelect();
    bindControls();

    var saved = loadSavedState();
    if (saved) {
      state = mergeSaved(saved);
      var acct = readAccount();
      if (state.source === "account" && acct) {
        applyStats(acct.stats, "account", acct.version);
      } else if (state.source === "account" || state.source === "account-edited") {
        if (!acct) state.source = "manual";
      }
    } else {
      var acct2 = readAccount();
      if (acct2) applyStats(acct2.stats, "account", acct2.version);
    }

    ready = true;
    fillControls();
    update();
  }

  global.LegendaryTool = {
    init: init,
    refreshAccount: refreshAccount,
    resetAll: resetAll,
    getState: function () { return state; },
    getResult: function () { return lastResult; }
  };

})(typeof window !== "undefined" ? window : globalThis);
