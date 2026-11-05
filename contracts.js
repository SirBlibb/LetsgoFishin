/*
 * Contract Point planner UI.
 *
 * Depends on:
 *   contractdata.js  (window.ContractData)
 *   bombdata.js      (craft multiplier for the bar goal)
 *   exportstats.js / account.js when a saved account is present
 *
 * Exposed as window.ContractTool so app.js can initialise it and refresh it
 * after an account import/reset.
 */
(function (global) {
  "use strict";

  var CD = global.ContractData;
  var ACCOUNT = global.AccountStore || null;
  var ES = global.ExportStats || null;

  var KEY = "obelisk-contracts-v1";

  var DEFAULTS = {
    mode: "current",
    view: "ranking",
    spareCp: 0,
    contractsCompleted: 0,
    weights: { ore: 100, veins: 0, stars: 0, bars: 0, damage: 0 }
  };

  var GOALS = CD ? CD.GOALS : [
    { id: "ore", label: "Ore" },
    { id: "veins", label: "Veins" },
    { id: "stars", label: "Stars" },
    { id: "bars", label: "Bars / crafting" },
    { id: "damage", label: "Damage" }
  ];

  var state = {
    mode: DEFAULTS.mode,
    view: DEFAULTS.view,
    spareCp: DEFAULTS.spareCp,
    contractsCompleted: DEFAULTS.contractsCompleted,
    weights: cloneDefaults(),
    levels: CD ? CD.zeroLevels() : [],
    ctx: null,
    source: "defaults",
    account: null
  };

  var nodes = {};
  var lastPlan = null;
  var lastRanking = null;
  var lastSummary = null;
  var lastWeights = null;

  /* ---------------------------------------------------------------- */
  /* helpers                                                          */
  /* ---------------------------------------------------------------- */

  var SUFFIX = ["", "k", "m", "b", "t", "q", "qi", "sx", "sp", "oc", "no", "dc", "ud", "dd", "td"];

  function cloneDefaults() {
    return {
      ore: DEFAULTS.weights.ore,
      veins: DEFAULTS.weights.veins,
      stars: DEFAULTS.weights.stars,
      bars: DEFAULTS.weights.bars,
      damage: DEFAULTS.weights.damage
    };
  }

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

  function signedPct(v) {
    if (v === null || v === undefined || !isFinite(v)) return "-";
    var pct = v * 100;
    if (Math.abs(pct) < 0.005) return "0%";
    var digits = Math.abs(pct) < 0.1 ? 3 : Math.abs(pct) < 1 ? 2 : 1;
    return (pct > 0 ? "+" : "") + pct.toFixed(digits) + "%";
  }

  function inputValue(n) {
    if (typeof n !== "number" || !isFinite(n) || n === 0) return n;
    return String(Number(n.toPrecision(10)));
  }

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

  function getStorage() {
    try {
      if (global && global.localStorage) return global.localStorage;
    } catch (e) { /* storage blocked */ }
    return null;
  }

  function scrollWrap(table) {
    var w = el("div", "table-scroll");
    w.appendChild(table);
    return w;
  }

  /* ---------------------------------------------------------------- */
  /* saved inputs                                                     */
  /* ---------------------------------------------------------------- */

  function loadSavedInputs() {
    var store = getStorage();
    if (!store) return;
    var saved = null;
    try { saved = JSON.parse(store.getItem(KEY) || "null"); } catch (e) { saved = null; }
    if (!saved || typeof saved !== "object") return;

    if (saved.mode === "respec" || saved.mode === "current") state.mode = saved.mode;
    if (saved.view === "summary" || saved.view === "ranking") state.view = saved.view;
    state.spareCp = Math.max(0, asNumber(saved.spareCp, DEFAULTS.spareCp));
    state.contractsCompleted = Math.max(0,
      Math.floor(asNumber(saved.contractsCompleted, DEFAULTS.contractsCompleted)));

    GOALS.forEach(function (g) {
      state.weights[g.id] = clamp(asNumber(saved.weights && saved.weights[g.id], DEFAULTS.weights[g.id]), 0, 100);
    });

    if (Array.isArray(saved.levels) && saved.levels.length === (CD ? CD.UPGRADES.length : 34)) {
      state.levels = saved.levels.map(function (v) {
        return Math.max(0, Math.floor(asNumber(v, 0)));
      });
      if (saved.source === "account-edited") state.source = "account-edited";
    }
  }

  function saveInputs() {
    var store = getStorage();
    if (!store) return;
    try {
      store.setItem(KEY, JSON.stringify({
        mode: state.mode,
        view: state.view,
        spareCp: state.spareCp,
        contractsCompleted: state.contractsCompleted,
        weights: state.weights,
        levels: state.levels,
        source: state.source
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

  // keepLevels: reload with hand-edited levels; the account still supplies caps, OB and chance bases.
  function applyAccount(acct, keepLevels) {
    state.ctx = CD.fromExport(acct.stats);
    if (!keepLevels) {
      state.levels = state.ctx.levels.slice();
      state.source = "account";
    }
    state.account = acct;

    renderLevels();
    fillInputs();
    renderWeights();
    updateAccountStatus();
    update();
  }

  function refreshAccount() {
    if (!CD) return;
    var acct = readAccount();
    if (acct && acct.stats) {
      applyAccount(acct);
      return;
    }

    state.ctx = CD.fromExport({});
    state.source = "defaults";
    state.account = null;
    state.levels = CD.normalizeLevels(state.levels, state.ctx);
    renderLevels();
    updateAccountStatus();
    update();
  }

  function updateAccountStatus() {
    if (!nodes.accountStatus) return;
    var ctx = state.ctx || (CD ? CD.fromExport({}) : null);
    var version = state.account && state.account.version ? " (" + state.account.version + ")" : "";

    if (state.account && ctx) {
      var sourceText = state.source === "account-edited" ? "Account levels, edited by hand" : "Using your saved account" + version;
      nodes.accountStatus.textContent = sourceText + ": OB " + Math.floor(ctx.obeliskLevel) +
        ", cap +" + Math.floor(ctx.capIncrease) +
        ", cost -" + (ctx.costReduction * 100).toFixed(1) + "%.";
    } else {
      nodes.accountStatus.textContent = "No account JSON loaded - enter contract levels by hand. " +
        "OB gates use OB 0, caps use +0, and cost reduction is 0%.";
    }
  }

  /* ---------------------------------------------------------------- */
  /* inputs                                                           */
  /* ---------------------------------------------------------------- */

  function renderLevels() {
    if (!nodes.levels || !CD) return;
    nodes.levels.innerHTML = "";

    var ctx = state.ctx || CD.fromExport({});
    var table = el("table", "results-table contracts-levels-table");
    var thead = el("thead");
    var hr = el("tr");
    ["World", "Upgrade", "Bonus", "Level", "Cap", "OB min"].forEach(function (label) {
      hr.appendChild(el("th", null, label));
    });
    thead.appendChild(hr);
    table.appendChild(thead);

    var tbody = el("tbody");
    CD.UPGRADES.forEach(function (up) {
      var cap = CD.capFor(up.index, ctx.capIncrease);
      var tr = el("tr");
      if (up.obMin > 0 && ctx.obeliskLevel < up.obMin) tr.className = "blocked";

      tr.appendChild(el("td", null, "W" + up.world));
      tr.appendChild(el("td", "name", up.name));
      tr.appendChild(el("td", null, up.bonus));

      var levelCell = el("td");
      var inp = el("input");
      inp.type = "number";
      inp.id = "contract-level-" + up.index;
      inp.min = 0;
      inp.max = cap;
      inp.step = 1;
      inp.value = String(state.levels[up.index] || 0);
      inp.addEventListener("input", function () {
        var v = parseInt(inp.value, 10);
        if (!isFinite(v) || v < 0) v = 0;
        if (v > cap) v = cap;
        if (String(v) !== inp.value) inp.value = String(v);
        state.levels[up.index] = v;
        if (state.source === "account") state.source = "account-edited";
        updateAccountStatus();
        update();
      });
      levelCell.appendChild(inp);
      tr.appendChild(levelCell);

      tr.appendChild(el("td", "num", String(cap)));
      tr.appendChild(el("td", "num", up.obMin > 0 ? String(up.obMin) : "-"));
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    nodes.levels.appendChild(scrollWrap(table));
    nodes.levels.appendChild(el("p", "hint",
      "These are your current levels. Current mode plans from them; respec mode refunds them and plans from zero. " +
      "ExportStats supplies them, but they stay editable."));
  }

  function renderWeights() {
    GOALS.forEach(function (g) {
      var slider = nodes.weightSliders && nodes.weightSliders[g.id];
      if (slider) slider.value = String(state.weights[g.id]);
    });
    updateWeightLabels();
  }

  function updateWeightLabels() {
    var w = CD ? CD.normalizeWeights(state.weights) : state.weights;
    GOALS.forEach(function (g) {
      var label = nodes.weightLabels && nodes.weightLabels[g.id];
      if (!label) return;
      var pct = w[g.id] * 100;
      label.textContent = (Math.round(pct * 10) / 10).toFixed(pct > 0 && pct < 10 ? 1 : 0) + "%";
    });
  }

  function fillInputs() {
    if (nodes.spare) nodes.spare.value = inputValue(state.spareCp);
    if (nodes.completed) nodes.completed.value = inputValue(state.contractsCompleted);
    if (nodes.modeCurrent) nodes.modeCurrent.checked = state.mode === "current";
    if (nodes.modeRespec) nodes.modeRespec.checked = state.mode === "respec";
    renderWeights();
  }

  function bindNumber(node, key, min, integer) {
    if (!node) return;
    node.addEventListener("input", function () {
      var v = parseFloat(node.value);
      if (!isFinite(v)) v = 0;
      if (min != null) v = Math.max(min, v);
      if (integer) v = Math.floor(v);
      state[key] = v;
      if (integer && String(v) !== node.value) node.value = String(v);
      update();
    });
  }

  function setPreset(weights) {
    GOALS.forEach(function (g) {
      state.weights[g.id] = weights[g.id] != null ? weights[g.id] : 0;
    });
    renderWeights();
    update();
  }

  function bindControls() {
    if (nodes.modeCurrent) {
      nodes.modeCurrent.addEventListener("change", function () {
        if (nodes.modeCurrent.checked) {
          state.mode = "current";
          update();
        }
      });
    }
    if (nodes.modeRespec) {
      nodes.modeRespec.addEventListener("change", function () {
        if (nodes.modeRespec.checked) {
          state.mode = "respec";
          update();
        }
      });
    }

    bindNumber(nodes.spare, "spareCp", 0);
    bindNumber(nodes.completed, "contractsCompleted", 0, true);

    GOALS.forEach(function (g) {
      var slider = nodes.weightSliders && nodes.weightSliders[g.id];
      if (!slider) return;
      function readWeight() {
        var v = parseFloat(slider.value);
        if (!isFinite(v)) v = 0;
        state.weights[g.id] = clamp(v, 0, 100);
      }
      // The plan is slow on a full respec, so only relabel while dragging and plan on release.
      slider.addEventListener("input", function () {
        readWeight();
        updateWeightLabels();
      });
      slider.addEventListener("change", function () {
        readWeight();
        update();
      });
    });

    if (nodes.presetOre) nodes.presetOre.addEventListener("click", function () { setPreset({ ore: 100 }); });
    if (nodes.presetVeins) nodes.presetVeins.addEventListener("click", function () { setPreset({ veins: 100 }); });
    if (nodes.presetStars) nodes.presetStars.addEventListener("click", function () { setPreset({ stars: 100 }); });
    if (nodes.presetMix) nodes.presetMix.addEventListener("click", function () { setPreset({ ore: 50, veins: 50 }); });

    if (nodes.viewRanking) {
      nodes.viewRanking.addEventListener("click", function () { setUpgradeView("ranking"); });
    }
    if (nodes.viewSummary) {
      nodes.viewSummary.addEventListener("click", function () { setUpgradeView("summary"); });
    }
  }

  /* ---------------------------------------------------------------- */
  /* results                                                          */
  /* ---------------------------------------------------------------- */

  function renderMode() {
    if (nodes.modeCurrent) nodes.modeCurrent.checked = state.mode === "current";
    if (nodes.modeRespec) nodes.modeRespec.checked = state.mode === "respec";
    if (nodes.modeNote) {
      nodes.modeNote.textContent = state.mode === "respec"
        ? "Full respec: every current level is refunded, then the planner spends the refunded CP plus your spare CP from zero levels."
        : "Current levels: the planner spends only your spare CP on top of the levels below.";
    }
  }

  function renderBudgetNote(plan, refund) {
    if (!nodes.budgetNote) return;
    if (state.mode === "respec") {
      nodes.budgetNote.textContent = "Respec budget: " + fmt(state.spareCp) + " spare + " +
        fmt(refund) + " refunded = " + fmt(plan.budget) + " CP.";
    } else {
      nodes.budgetNote.textContent = "Budget: " + fmt(plan.budget) + " spare CP on top of your current levels.";
    }
  }

  function renderPlan(plan, refund) {
    if (!nodes.plan) return;
    nodes.plan.innerHTML = "";

    var summary = el("div", "summary");
    summary.appendChild(el("div", "stat", "Budget: " + fmt(plan.budget) + " CP"));
    summary.appendChild(el("div", "stat", "Spent: " + fmt(plan.spent) + " CP"));
    summary.appendChild(el("div", "stat", "Left: " + fmt(plan.left) + " CP"));
    if (state.mode === "respec") {
      summary.appendChild(el("div", "stat", "Refund: " + fmt(refund) + " CP"));
    }
    nodes.plan.appendChild(summary);

    if (!plan.buys.length) {
      nodes.plan.appendChild(el("p", "hint",
        "No affordable upgrade improves the selected goals with this budget. Raise the budget, change the weights, or lower the levels."));
      return;
    }

    // Collapse the one-level-at-a-time buys into one row per upgrade, in game order.
    var byIndex = {};
    plan.buys.forEach(function (buy) {
      var row = byIndex[buy.index];
      if (!row) {
        row = byIndex[buy.index] = {
          index: buy.index, world: buy.world, name: buy.name,
          from: buy.level - 1, to: buy.level, cost: 0
        };
      }
      row.to = buy.level;
      row.cost += buy.cost;
    });
    var rows = Object.keys(byIndex).map(function (k) { return byIndex[k]; })
      .sort(function (a, b) { return a.index - b.index; });

    var table = el("table", "results-table contracts-plan-table");
    var thead = el("thead");
    var hr = el("tr");
    ["Upgrade", "Add levels", "Level", "CP"].forEach(function (label) {
      hr.appendChild(el("th", null, label));
    });
    thead.appendChild(hr);
    table.appendChild(thead);

    var tbody = el("tbody");
    rows.forEach(function (row) {
      var tr = el("tr");
      tr.appendChild(el("td", "name", "W" + row.world + " " + row.name));
      tr.appendChild(el("td", "num", "+" + (row.to - row.from)));
      tr.appendChild(el("td", "num", row.from + " \u2192 " + row.to));
      tr.appendChild(el("td", "num", fmt(row.cost)));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    nodes.plan.appendChild(scrollWrap(table));
    nodes.plan.appendChild(el("p", "hint",
      "Levels to add to each upgrade, listed in the game's upgrade order. The planner picks levels greedily " +
      "(highest score per CP first), so the totals are close to, but not guaranteed to be, the exact best plan."));
  }

  function renderResult(plan) {
    if (!nodes.result) return;
    nodes.result.innerHTML = "";

    var summary = el("div", "summary");
    GOALS.forEach(function (g) {
      var gain = plan.goals[g.id] ? plan.goals[g.id].gain : 0;
      var stat = el("div", "stat" + (gain > 0 ? " delta up" : gain < 0 ? " delta down" : ""));
      stat.textContent = g.label + ": " + signedPct(gain);
      summary.appendChild(stat);
    });

    var weighted = el("div", "stat" + (plan.weightedGain > 0 ? " delta up" : plan.weightedGain < 0 ? " delta down" : ""));
    weighted.textContent = "Weighted total: " + signedPct(plan.weightedGain);
    summary.appendChild(weighted);
    nodes.result.appendChild(summary);
    nodes.result.appendChild(el("p", "hint",
      "Weighted total is the weighted geometric mean of the per-goal gains, using the normalised slider weights. " +
      "Only the contract upgrades in this plan are counted; existing stats stay as they are." +
      (state.mode === "respec"
        ? " Respec gains are versus your current levels, so a goal can go down."
        : "")));
  }

  function effectText(row) {
    var parts = [];
    GOALS.forEach(function (g) {
      if (!lastWeights || lastWeights[g.id] <= 0) return;
      if (row.effects[g.id] > 1e-12) {
        parts.push(g.label + " " + signedPct(row.effects[g.id]));
      }
    });
    return parts.join(" · ") || "-";
  }

  function stateText(row) {
    if (row.maxed) return "Maxed";
    if (row.locked) return "Locked (OB " + row.obMin + ")";
    if (row.capped) return "Capped";
    if (row.noEffect) return "No effect on selected goals";
    return "";
  }

  function setUpgradeView(view) {
    if (view !== "summary") view = "ranking";
    if (state.view === view) return;
    state.view = view;
    update();
  }

  function renderUpgradeView() {
    var summary = state.view === "summary";

    if (nodes.viewTitle) {
      nodes.viewTitle.textContent = summary ? "5. Upgrade summary" : "5. Next-level ranking";
    }
    if (nodes.viewRanking) {
      nodes.viewRanking.className = "contracts-view-btn" + (summary ? " ghost" : " active");
      nodes.viewRanking.setAttribute("aria-pressed", summary ? "false" : "true");
    }
    if (nodes.viewSummary) {
      nodes.viewSummary.className = "contracts-view-btn" + (summary ? " active" : " ghost");
      nodes.viewSummary.setAttribute("aria-pressed", summary ? "true" : "false");
    }
    if (nodes.ranking) nodes.ranking.hidden = summary;
    if (nodes.summary) nodes.summary.hidden = !summary;
  }

  function summaryStateText(row) {
    if (row.locked) return "Locked (OB " + row.obMin + ")";
    if (row.maxed) return "Maxed";
    return row.remaining + (row.remaining === 1 ? " level left" : " levels left");
  }

  function renderSummary(summary) {
    if (!nodes.summary || !summary) return;
    nodes.summary.innerHTML = "";

    var totals = summary.totals;
    var bar = el("div", "summary");
    bar.appendChild(el("div", "stat", "Levels: " + totals.level + " / " + totals.cap));
    bar.appendChild(el("div", "stat", "Spent: " + fmt(totals.spent) + " CP"));
    bar.appendChild(el("div", "stat", "To max: " + fmt(totals.toMax) + " CP"));
    bar.appendChild(el("div", "stat", "All-in: " + fmt(totals.total) + " CP"));
    if (totals.locked) {
      bar.appendChild(el("div", "stat", "Locked: " + totals.locked + " upgrade" + (totals.locked === 1 ? "" : "s")));
    }
    nodes.summary.appendChild(bar);

    var table = el("table", "results-table contracts-summary-table");
    var thead = el("thead");
    var hr = el("tr");
    ["World", "Upgrade", "Level", "Cap", "Spent (CP)", "Next (CP)", "To max (CP)", "State"].forEach(function (label) {
      hr.appendChild(el("th", null, label));
    });
    thead.appendChild(hr);
    table.appendChild(thead);

    var tbody = el("tbody");
    summary.rows.forEach(function (row) {
      var tr = el("tr");
      if (row.locked) tr.className = "blocked";

      tr.appendChild(el("td", null, "W" + row.world));
      tr.appendChild(el("td", "name", row.name));
      tr.appendChild(el("td", "num", String(row.level)));
      tr.appendChild(el("td", "num", String(row.cap)));
      tr.appendChild(el("td", "num", fmt(row.spent)));
      tr.appendChild(el("td", "num", row.next === null ? "-" : fmt(row.next)));
      tr.appendChild(el("td", "num", fmt(row.toMax)));
      tr.appendChild(el("td", "note", summaryStateText(row)));
      tbody.appendChild(tr);
    });

    var totalRow = el("tr", "total-row");
    totalRow.appendChild(el("td", null, ""));
    totalRow.appendChild(el("td", "name", "Total"));
    totalRow.appendChild(el("td", "num", String(totals.level)));
    totalRow.appendChild(el("td", "num", String(totals.cap)));
    totalRow.appendChild(el("td", "num", fmt(totals.spent)));
    totalRow.appendChild(el("td", "num", "-"));
    totalRow.appendChild(el("td", "num", fmt(totals.toMax)));
    totalRow.appendChild(el("td", "note",
      totals.remaining === 0 ? "All maxed" :
      totals.remaining + (totals.remaining === 1 ? " level left" : " levels left")));
    tbody.appendChild(totalRow);

    table.appendChild(tbody);
    nodes.summary.appendChild(scrollWrap(table));
    nodes.summary.appendChild(el("p", "hint",
      "Totals use your current levels and the current cost reduction. \"Spent\" is what a respec " +
      "would refund; \"To max\" is the CP still needed to reach every cap. OB-locked upgrades are " +
      "included at their listed prices."));
  }

  function renderRanking(ranking) {
    if (!nodes.ranking) return;
    nodes.ranking.innerHTML = "";

    var table = el("table", "results-table contracts-ranking-table");
    var thead = el("thead");
    var hr = el("tr");
    ["Rank", "Upgrade", "Level", "Cap", "Cost (CP)", "Score", "Effect", "State"].forEach(function (label) {
      hr.appendChild(el("th", null, label));
    });
    thead.appendChild(hr);
    table.appendChild(thead);

    var tbody = el("tbody");
    ranking.forEach(function (row) {
      var tr = el("tr");
      if (row.maxed || row.locked || row.noEffect) tr.className = "blocked";

      tr.appendChild(el("td", "rank", row.rank ? String(row.rank) : "-"));
      tr.appendChild(el("td", "name", "W" + row.world + " " + row.name));
      tr.appendChild(el("td", "num", String(row.level)));
      tr.appendChild(el("td", "num", String(row.cap)));
      tr.appendChild(el("td", "num", row.cost === null ? "-" : fmt(row.cost)));
      tr.appendChild(el("td", "num", row.score > 0 ? row.score.toExponential(3) : "-"));
      tr.appendChild(el("td", "effect", effectText(row)));
      tr.appendChild(el("td", "note", stateText(row)));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    nodes.ranking.appendChild(scrollWrap(table));
    nodes.ranking.appendChild(el("p", "hint",
      "All 34 upgrades, best first. Score = weighted log gain of one more level / CP cost. " +
      "Rows with no effect on the selected goals are greyed out, as are maxed and OB-locked upgrades."));
  }

  /* ---------------------------------------------------------------- */
  /* update                                                           */
  /* ---------------------------------------------------------------- */

  function update() {
    if (!CD) return;

    var ctx = state.ctx || CD.fromExport({});
    state.contractsCompleted = Math.max(0, Math.floor(asNumber(state.contractsCompleted, 0)));
    ctx.contractsCompleted = state.contractsCompleted;

    state.levels = CD.normalizeLevels(state.levels, ctx);
    var currentLevels = state.levels.slice();
    var startLevels = state.mode === "respec" ? CD.zeroLevels() : currentLevels.slice();
    var refund = state.mode === "respec" ? CD.refundFor(currentLevels, ctx) : 0;
    var budget = state.mode === "respec" ? CD.respecBudget(state.spareCp, currentLevels, ctx) : state.spareCp;

    var plan = CD.planSpend(startLevels, ctx, state.weights, budget,
      state.mode === "respec" ? currentLevels : null);
    var ranking = CD.rankNext(startLevels, ctx, state.weights);
    var summary = CD.summaryFor(currentLevels, ctx);

    lastPlan = plan;
    lastRanking = ranking;
    lastSummary = summary;
    lastWeights = CD.normalizeWeights(state.weights);

    renderMode();
    renderBudgetNote(plan, refund);
    renderPlan(plan, refund);
    renderResult(plan);
    renderRanking(ranking);
    renderSummary(summary);
    renderUpgradeView();
    updateWeightLabels();
    updateAccountStatus();
    saveInputs();
  }

  /* ---------------------------------------------------------------- */
  /* init                                                             */
  /* ---------------------------------------------------------------- */

  function cacheNodes() {
    nodes.modeCurrent = document.getElementById("contracts-mode-current");
    nodes.modeRespec = document.getElementById("contracts-mode-respec");
    nodes.modeNote = document.getElementById("contracts-mode-note");
    nodes.spare = document.getElementById("contracts-spare");
    nodes.completed = document.getElementById("contracts-completed");
    nodes.budgetNote = document.getElementById("contracts-budget-note");
    nodes.levels = document.getElementById("contracts-levels");
    nodes.plan = document.getElementById("contracts-plan");
    nodes.result = document.getElementById("contracts-result");
    nodes.viewTitle = document.getElementById("contracts-view-title");
    nodes.viewRanking = document.getElementById("contracts-view-ranking");
    nodes.viewSummary = document.getElementById("contracts-view-summary");
    nodes.ranking = document.getElementById("contracts-ranking");
    nodes.summary = document.getElementById("contracts-summary");
    nodes.accountStatus = document.getElementById("contracts-account-status");

    nodes.weightSliders = {};
    nodes.weightLabels = {};
    GOALS.forEach(function (g) {
      nodes.weightSliders[g.id] = document.getElementById("contracts-weight-" + g.id);
      nodes.weightLabels[g.id] = document.getElementById("contracts-weight-" + g.id + "-value");
    });

    nodes.presetOre = document.getElementById("contracts-preset-ore");
    nodes.presetVeins = document.getElementById("contracts-preset-veins");
    nodes.presetStars = document.getElementById("contracts-preset-stars");
    nodes.presetMix = document.getElementById("contracts-preset-mix");
  }

  function init() {
    if (!CD) return;
    cacheNodes();
    if (!nodes.levels || !nodes.plan || !nodes.result || !nodes.ranking) return;

    loadSavedInputs();
    bindControls();

    var acct = readAccount();
    if (acct && acct.stats) {
      applyAccount(acct, state.source === "account-edited");
    } else {
      state.ctx = CD.fromExport({});
      state.levels = CD.normalizeLevels(state.levels, state.ctx);
      state.source = "defaults";
      state.account = null;
      renderLevels();
      fillInputs();
      updateAccountStatus();
      update();
    }
  }

  // Home-page Reset also clears the contract budget, weights, and manual levels.
  function resetAll() {
    if (!CD) return;
    clearSavedInputs();

    state.mode = DEFAULTS.mode;
    state.view = DEFAULTS.view;
    state.spareCp = DEFAULTS.spareCp;
    state.contractsCompleted = DEFAULTS.contractsCompleted;
    state.weights = cloneDefaults();
    state.ctx = CD.fromExport({});
    state.levels = CD.zeroLevels();
    state.source = "defaults";
    state.account = null;

    renderLevels();
    fillInputs();
    updateAccountStatus();
    update();
  }

  global.ContractTool = {
    init: init,
    refreshAccount: refreshAccount,
    resetAll: resetAll,
    getState: function () {
      return {
        mode: state.mode,
        view: state.view,
        spareCp: state.spareCp,
        contractsCompleted: state.contractsCompleted,
        weights: {
          ore: state.weights.ore,
          veins: state.weights.veins,
          stars: state.weights.stars,
          bars: state.weights.bars,
          damage: state.weights.damage
        },
        levels: state.levels.slice(),
        source: state.source,
        account: state.account ? state.account.version : null,
        budget: lastPlan ? lastPlan.budget : 0,
        spent: lastPlan ? lastPlan.spent : 0,
        left: lastPlan ? lastPlan.left : 0,
        buys: lastPlan ? lastPlan.buys.slice() : [],
        plan: lastPlan,
        ranking: lastRanking,
        summary: lastSummary
      };
    }
  };

})(typeof window !== "undefined" ? window : globalThis);
