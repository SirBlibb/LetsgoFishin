/*
 * Let's Go Fishing - optimizer UI.
 * Depends on: model.js (FishModel), data.js (UI_SPEC), exportstats.js (ExportStats).
 */
(function () {
  "use strict";

  var FM = window.FishModel;
  var UI = window.UI_SPEC;
  var ES = window.ExportStats;
  var FD = window.FISH_DATA;
  var ACCOUNT = window.AccountStore || null;

  var STORAGE_KEY = "lgf-optimizer-state-v1";
  var saveTimer = null;

  var savedState = loadSavedState();
  var state = savedState || FM.defaultInputs();
  var restoredSaved = !!savedState;
  var accountRecord = ACCOUNT ? ACCOUNT.load() : null;
  var importReport = null;
  var lastRanks = null;
  var lastBase = null;
  var lastBuy = null;
  var undoStack = [];

  /* ---------------------------------------------------------------- */
  /* helpers                                                          */
  /* ---------------------------------------------------------------- */

  var SUFFIX = ["", "k", "m", "b", "t", "qi", "sx", "sp", "oc", "no", "dc", "ud", "dd", "td"];

  function fmt(n) {
    if (n === null || n === undefined || !isFinite(n)) return "-";
    if (n === 0) return "0";
    var neg = n < 0;
    n = Math.abs(n);
    var tier = 0;
    while (n >= 1000 && tier < SUFFIX.length - 1) { n /= 1000; tier++; }
    var s;
    if (tier === 0) s = (n < 10 ? n.toFixed(2) : n < 100 ? n.toFixed(1) : Math.round(n).toString());
    else s = n.toFixed(n < 10 ? 2 : n < 100 ? 1 : 0) + SUFFIX[tier];
    return (neg ? "-" : "") + s;
  }

  function fmtInt(n) {
    if (n === null || n === undefined || !isFinite(n)) return "-";
    return Math.round(n).toLocaleString("en-US");
  }

  function fmtPct(n) {
    if (n === null || !isFinite(n)) return "-";
    return (n * 100).toFixed(n < 0.001 ? 4 : 2) + "%";
  }

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt !== undefined) e.textContent = txt;
    return e;
  }

  // wide tables scroll sideways on narrow screens instead of stretching the page
  function scrollWrap(table) {
    var w = el("div", "table-scroll");
    w.appendChild(table);
    return w;
  }

  /* ---------------------------------------------------------------- */
  /* saved player details                                             */
  /* ---------------------------------------------------------------- */

  function getStorage() {
    try {
      if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
    } catch (e) { /* storage blocked */ }
    return null;
  }

  function isFiniteNumber(v) { return typeof v === "number" && isFinite(v); }

  function isIntInRange(v, min, max) {
    return isFiniteNumber(v) && Math.floor(v) === v && v >= min && v <= max;
  }

  function clampSpec(v, spec) {
    var min = spec.min != null ? spec.min : 0;
    if (v < min) v = min;
    if (spec.max != null && v > spec.max) v = spec.max;
    return v;
  }

  // Merge saved values onto fresh defaults so older saves keep working when
  // fields are added or limits change, and malformed values are ignored.
  function normalizeState(saved) {
    var base = FM.defaultInputs();
    if (!saved || typeof saved !== "object") return base;

    if (typeof saved.dock === "string" && FM.DOCKS.some(function (d) { return d.id === saved.dock; })) {
      base.dock = saved.dock;
    }
    if (isIntInRange(saved.rodCard, 0, UI.LEGENDARY_NAMES.length - 1)) base.rodCard = saved.rodCard;
    base.expMode = !!saved.expMode;
    base.hideLocked = !!saved.hideLocked;

    var maxByRow = {};
    FM.GEM_UPGRADES.forEach(function (u) { maxByRow[u.row] = u.max; });
    UI.UPGRADE_INPUTS.forEach(function (u) { maxByRow[u.row] = u.max; });
    if (saved.G && typeof saved.G === "object") {
      Object.keys(base.G).forEach(function (row) {
        var v = saved.G[row];
        if (!isFiniteNumber(v)) return;
        var max = maxByRow[row];
        base.G[row] = Math.max(0, max != null ? Math.min(v, max) : v);
      });
    }

    var specByKey = {};
    UI.SCALARS.forEach(function (f) { specByKey[f.key] = f; });
    if (saved.C && typeof saved.C === "object") {
      Object.keys(base.C).forEach(function (key) {
        var spec = specByKey[key];
        var v = saved.C[key];
        if (!spec) return;
        if (spec.type === "bool") {
          if (typeof v === "boolean") base.C[key] = v;
        } else if (v === null) {
          if (spec.blank) base.C[key] = null;
        } else if (isFiniteNumber(v)) {
          base.C[key] = clampSpec(v, spec);
        }
      });
    }

    if (saved.cards && typeof saved.cards === "object") {
      FM.DOCKS.forEach(function (d) {
        var src = saved.cards[d.id];
        if (!src || typeof src !== "object") return;
        var dst = base.cards[d.id];
        if (Array.isArray(src.t1)) {
          for (var k = 0; k < 4; k++) {
            if (isIntInRange(src.t1[k], 0, UI.T1_CARD_NAMES.length - 1)) dst.t1[k] = src.t1[k];
          }
        }
        if (isIntInRange(src.ae, 0, UI.LEGENDARY_NAMES.length - 1)) dst.ae = src.ae;
        if (isIntInRange(src.af, 0, UI.TRIBUTE_NAMES.length - 1)) dst.af = src.af;
      });
    }

    return base;
  }

  function loadSavedState() {
    var store = getStorage();
    if (!store) return null;
    try {
      var raw = store.getItem(STORAGE_KEY);
      if (!raw) return null;
      var saved = JSON.parse(raw);
      return normalizeState(saved && saved.inputs ? saved.inputs : saved);
    } catch (e) {
      return null;
    }
  }

  function saveNow() {
    var store = getStorage();
    if (!store) return;
    try {
      store.setItem(STORAGE_KEY, JSON.stringify({
        version: 1,
        savedAt: new Date().toISOString(),
        inputs: state
      }));
    } catch (e) { /* storage full or blocked */ }
  }

  function persistState() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      saveTimer = null;
      saveNow();
    }, 200);
  }

  function flushSavedState() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    saveNow();
  }

  function forgetSavedState() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    var store = getStorage();
    if (!store) return;
    try { store.removeItem(STORAGE_KEY); } catch (e) { /* ignored */ }
  }

  /* ---------------------------------------------------------------- */
  /* shared account summary                                           */
  /* ---------------------------------------------------------------- */

  function fmtExportTime(v) {
    if (v === null || v === undefined || v === "") return "not provided";
    var TD = window.TrackerData;
    if (TD && typeof TD.formatExportDate === "function") {
      return TD.formatExportDate(v);
    }
    if (typeof v === "string") return v;
    if (typeof v === "number" && isFinite(v)) {
      return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
    }
    return "not provided";
  }

  function fmtLocalDateTime(iso) {
    if (!iso) return "not recorded";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleString("en-US");
  }

  function accountFact(grid, label, value) {
    var f = el("div", "account-fact");
    f.appendChild(el("span", "account-fact-key", label));
    f.appendChild(el("span", "account-fact-value", value));
    grid.appendChild(f);
  }

  function renderAccountSummary() {
    var root = document.getElementById("account-summary");
    if (!root) return;
    root.innerHTML = "";

    if (!accountRecord) {
      if (restoredSaved) {
        root.className = "account-summary";
        var savedHead = el("div", "account-summary-head");
        savedHead.appendChild(el("span", "account-dot"));
        savedHead.appendChild(el("strong", null, "Saved tool details"));
        root.appendChild(savedHead);
        root.appendChild(el("p", "account-note",
          "Your previous settings were restored from this browser, but the raw ExportStats JSON was not stored. " +
          "Import a fresh export to save it and share it across tools."));
      } else {
        root.className = "account-summary empty";
        root.appendChild(el("p", "account-empty",
          "No account JSON loaded yet. You can still open a tool and enter values by hand."));
      }
      updateToolStatus();
      return;
    }

    root.className = "account-summary";
    var head = el("div", "account-summary-head");
    head.appendChild(el("span", "account-dot ok"));
    head.appendChild(el("strong", null, "Account loaded"));
    root.appendChild(head);

    var grid = el("div", "account-facts");
    accountFact(grid, "Game version", accountRecord.version || "unknown");
    accountFact(grid, "Exported", fmtExportTime(accountRecord.exportedAt));
    accountFact(grid, "Source", accountRecord.source || "Imported JSON");
    accountFact(grid, "Imported", fmtLocalDateTime(accountRecord.importedAt));
    if (typeof accountRecord.applied === "number") {
      var mapped = accountRecord.applied + " filled";
      if (typeof accountRecord.missing === "number" && accountRecord.missing > 0) {
        mapped += ", " + accountRecord.missing + " manual";
      }
      accountFact(grid, "Fields", mapped);
    }

    var accountStats = null;
    try {
      var parsed = ES ? ES.parseExport(accountRecord.raw) : JSON.parse(accountRecord.raw);
      accountStats = parsed && parsed.stats ? parsed.stats : parsed;
    } catch (e) { /* summary is best-effort */ }
    if (accountStats) {
      if (typeof accountStats.current_floor === "number" && isFinite(accountStats.current_floor)) {
        accountFact(grid, "Current floor", String(accountStats.current_floor));
      }
      if (typeof accountStats.void_portal_chance === "number" ||
          typeof accountStats.void_portal_multi === "number") {
        var portalChance = typeof accountStats.void_portal_chance === "number" ? accountStats.void_portal_chance : 0;
        var portalMulti = typeof accountStats.void_portal_multi === "number" ? accountStats.void_portal_multi : 1;
        accountFact(grid, "Void portals",
          portalChance.toFixed(2) + "% at " + (Math.round(portalMulti * 10000) / 10000) + "x");
      }
    }

    root.appendChild(grid);
    updateToolStatus();
  }

  function updateToolStatus() {
    var hasAccount = !!accountRecord;
    var hasDetails = hasAccount || restoredSaved;
    var versionSuffix = hasAccount && accountRecord.version ? " (" + accountRecord.version + ")" : "";

    var badge = document.getElementById("fishing-badge");
    if (badge) {
      badge.textContent = hasAccount ? "Account loaded" : (hasDetails ? "Saved details" : "Manual entry");
      badge.className = "badge" + (hasDetails ? " ok" : "");
    }

    var note = document.getElementById("fishing-account-note");
    if (note) {
      note.textContent = hasAccount
        ? "Using your saved " + (accountRecord.version || "") + " account details."
        : (hasDetails
          ? "Using details saved in this browser."
          : "No account yet - the tool also works with manual entry.");
    }

    var status = document.getElementById("tool-account-status");
    if (status) {
      status.textContent = hasAccount
        ? "Using your saved account" + (accountRecord.version ? " (" + accountRecord.version + ")" : "") + "."
        : (hasDetails
          ? "Using details saved in this browser. Import a fresh JSON on the home page to refresh them."
          : "No account JSON loaded - enter values manually, or import one on the home page.");
    }

    var bombBadge = document.getElementById("bombs-badge");
    if (bombBadge) {
      bombBadge.textContent = hasAccount ? "Account loaded" : "Manual entry";
      bombBadge.className = "badge" + (hasAccount ? " ok" : "");
    }

    var bombNote = document.getElementById("bombs-account-note");
    if (bombNote) {
      bombNote.textContent = hasAccount
        ? "Using your saved account" + versionSuffix + " stats, floor, and Void Drone values."
        : "No account yet - bomb, crafting, and Void Drone values can be entered by hand.";
    }

    var bombStatus = document.getElementById("bombs-account-status");
    if (bombStatus) {
      bombStatus.textContent = hasAccount
        ? "Using your saved account" + versionSuffix + ". Floor and void portal values are pre-filled."
        : "No account JSON loaded - enter bomb, crafting, and Void Drone values manually, or import one on the home page.";
    }

    var goalBadge = document.getElementById("goal-badge");
    if (goalBadge) {
      goalBadge.textContent = hasAccount ? "Account loaded" : "Manual entry";
      goalBadge.className = "badge" + (hasAccount ? " ok" : "");
    }

    var goalNote = document.getElementById("goal-account-note");
    if (goalNote) {
      goalNote.textContent = hasAccount
        ? "Uses your saved account" + versionSuffix + " crafting stats. Ore and bar balances stay manual."
        : "No account yet - enter your ore, bars, and crafting stats by hand.";
    }

    var goalStatus = document.getElementById("goal-account-status");
    if (goalStatus) {
      goalStatus.textContent = hasAccount
        ? "Using your saved account" + versionSuffix + " for crafting stats. Current ore and bars are entered by hand."
        : "No account JSON loaded - enter current ore, bars, and crafting stats manually, or import one on the home page.";
    }

    var contractsBadge = document.getElementById("contracts-badge");
    if (contractsBadge) {
      contractsBadge.textContent = hasAccount ? "Account loaded" : "Manual entry";
      contractsBadge.className = "badge" + (hasAccount ? " ok" : "");
    }

    var contractsNote = document.getElementById("contracts-account-note");
    if (contractsNote) {
      contractsNote.textContent = hasAccount
        ? "Uses your saved account" + versionSuffix + " contract levels, caps, OB gates, and cost reduction."
        : "No account yet - contract levels, caps, and OB gates can be entered by hand.";
    }

    var floorsBadge = document.getElementById("floors-badge");
    if (floorsBadge) {
      floorsBadge.textContent = hasAccount ? "Account loaded" : "Manual entry";
      floorsBadge.className = "badge" + (hasAccount ? " ok" : "");
    }

    var floorsNote = document.getElementById("floors-account-note");
    if (floorsNote) {
      floorsNote.textContent = hasAccount
        ? "Uses your saved account" + versionSuffix + " golden / rainbow / void portal stats, drones and bomb."
        : "No account yet - enter your multipliers by hand, or load an export for exact results.";
    }

    // ContractTool owns #contracts-account-status so it can include the exact
    // OB level, cap increase, and cost reduction it is planning with.
  }

  /* ---------------------------------------------------------------- */
  /* settings                                                         */
  /* ---------------------------------------------------------------- */

  function renderSettings(root) {
    root.innerHTML = "";

    var dockWrap = el("label", "field");
    dockWrap.appendChild(el("span", "field-label", "Current dock"));
    var sel = el("select");
    FM.DOCKS.forEach(function (d) {
      var o = el("option", null, d.id + (d.tier === 2 ? " (Tier 2)" : ""));
      o.value = d.id;
      if (d.id === state.dock) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener("change", function () { state.dock = sel.value; clearHistory(); update(); });
    dockWrap.appendChild(sel);
    root.appendChild(dockWrap);

    var rod = el("label", "field");
    rod.appendChild(el("span", "field-label", "Fishing Rod legendary card"));
    var rsel = el("select");
    UI.LEGENDARY_NAMES.forEach(function (nm, i) {
      var o = el("option", null, i + " - " + nm); o.value = i;
      if (i === state.rodCard) o.selected = true;
      rsel.appendChild(o);
    });
    rsel.addEventListener("change", function () { state.rodCard = parseInt(rsel.value, 10); clearHistory(); update(); });
    rod.appendChild(rsel);
    root.appendChild(rod);

    var exp = el("label", "check");
    var inp = el("input"); inp.type = "checkbox"; inp.checked = !!state.expMode;
    inp.addEventListener("change", function () { state.expMode = inp.checked; clearHistory(); update(); });
    exp.appendChild(inp);
    exp.appendChild(el("span", null, "Rank by growth per 100k gems (exponential mode)"));
    root.appendChild(exp);

    var hide = el("label", "check");
    var hideInp = el("input"); hideInp.type = "checkbox"; hideInp.checked = !!state.hideLocked;
    hideInp.addEventListener("change", function () { state.hideLocked = hideInp.checked; update(); });
    hide.appendChild(hideInp);
    hide.appendChild(el("span", null, "Hide locked upgrades in both rankings"));
    root.appendChild(hide);
  }

  /* ---------------------------------------------------------------- */
  /* upgrade level inputs                                             */
  /* ---------------------------------------------------------------- */

  function upgradeField(row, label, max, group) {
    var wrap = el("label", "field");
    wrap.appendChild(el("span", "field-label", label));
    var inp = el("input"); inp.type = "number"; inp.min = 0; inp.max = max; inp.step = 1;
    inp.id = "lv-" + row;
    inp.value = state.G[row];
    inp.addEventListener("input", function () {
      var v = parseFloat(inp.value);
      state.G[row] = isNaN(v) ? 0 : v;
      clearHistory();
      update();
    });
    wrap.appendChild(inp);
    return wrap;
  }

  function renderUpgrades(root) {
    root.innerHTML = "";
    var byGroup = {};
    FM.GEM_UPGRADES.forEach(function (up) {
      (byGroup[up.group] = byGroup[up.group] || []).push(up);
    });
    Object.keys(byGroup).forEach(function (g) {
      var sec = el("div", "subsection");
      sec.appendChild(el("h3", null, g + " (ranked)"));
      var grid = el("div", "grid");
      byGroup[g].forEach(function (up) { grid.appendChild(upgradeField(up.g, up.name + " (max " + up.max + ")", up.max)); });
      sec.appendChild(grid);
      root.appendChild(sec);
    });

    var sec2 = el("div", "subsection");
    sec2.appendChild(el("h3", null, "Fishing - Upgrades (bought with fish, ranked in section 6)"));
    var grid2 = el("div", "grid");
    UI.UPGRADE_INPUTS.forEach(function (u) { grid2.appendChild(upgradeField(u.row, u.label + " (max " + u.max + ")", u.max)); });
    sec2.appendChild(grid2);
    root.appendChild(sec2);
  }

  /* ---------------------------------------------------------------- */
  /* per-dock cards                                                   */
  /* ---------------------------------------------------------------- */

  function smallSelect(names, value, onchange) {
    var s = el("select", "mini");
    names.forEach(function (nm, i) {
      var o = el("option", null, i); o.value = i; o.title = nm;
      if (i === value) o.selected = true;
      s.appendChild(o);
    });
    s.addEventListener("change", function () { onchange(parseInt(s.value, 10)); });
    return s;
  }

  function renderCards(root) {
    root.innerHTML = "";
    var table = el("table", "cards-table");
    var thead = el("thead");
    var hr = el("tr");
    ["Dock", "T1 card 1", "T1 card 2", "T1 card 3", "T1 card 4", "Legendary card", "Tribute"].forEach(function (t) {
      hr.appendChild(el("th", null, t));
    });
    thead.appendChild(hr);
    table.appendChild(thead);

    var tbody = el("tbody");
    FM.DOCKS.forEach(function (d) {
      var c = state.cards[d.id];
      var tr = el("tr");
      tr.appendChild(el("td", "dock-name", d.id));
      for (var k = 0; k < 4; k++) {
        (function (k) {
          var td = el("td");
          td.appendChild(smallSelect(UI.T1_CARD_NAMES, c.t1[k], function (v) { c.t1[k] = v; clearHistory(); update(); }));
          tr.appendChild(td);
        })(k);
      }
      var tdL = el("td");
      tdL.appendChild(smallSelect(UI.LEGENDARY_NAMES, c.ae, function (v) { c.ae = v; clearHistory(); update(); }));
      tr.appendChild(tdL);
      var tdT = el("td");
      tdT.appendChild(smallSelect(UI.TRIBUTE_NAMES, c.af, function (v) { c.af = v; clearHistory(); update(); }));
      tr.appendChild(tdT);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    root.appendChild(scrollWrap(table));
    root.appendChild(el("p", "hint", "Numbers are the ExportStats values: cards 0-4 (None/Base/Gilded/Polychrome/Infernal), tribute 0-3."));
  }

  /* ---------------------------------------------------------------- */
  /* manual scalar inputs                                             */
  /* ---------------------------------------------------------------- */

  function renderScalars(root) {
    root.innerHTML = "";
    var byGroup = {};
    UI.SCALARS.forEach(function (f) { (byGroup[f.group] = byGroup[f.group] || []).push(f); });

    Object.keys(byGroup).forEach(function (g) {
      var sec = el("div", "subsection");
      sec.appendChild(el("h3", null, g));
      var grid = el("div", "grid");
      byGroup[g].forEach(function (f) {
        var wrap = el("label", "field");
        wrap.appendChild(el("span", "field-label", f.label));
        var inp;

        if (f.type === "bool") {
          wrap.className = "check";
          inp = el("input"); inp.type = "checkbox"; inp.checked = !!state.C[f.key];
          inp.addEventListener("change", function () { state.C[f.key] = inp.checked; clearHistory(); update(); });
        } else {
          inp = el("input"); inp.type = "number";
          inp.min = f.min != null ? f.min : 0;
          if (f.max != null) inp.max = f.max;
          inp.step = (f.type === "int") ? 1 : "any";
          inp.value = (state.C[f.key] === null || state.C[f.key] === undefined) ? "" : state.C[f.key];
          if (f.blank) inp.placeholder = "(blank)";
          inp.addEventListener("input", function () {
            if (f.blank && inp.value === "") { state.C[f.key] = null; clearHistory(); update(); return; }
            var v = parseFloat(inp.value);
            state.C[f.key] = isNaN(v) ? (f.blank ? null : 0) : v;
            clearHistory();
            update();
          });
        }
        wrap.appendChild(inp);
        if (f.hint) wrap.title = f.hint;
        grid.appendChild(wrap);
      });
      sec.appendChild(grid);
      root.appendChild(sec);
    });
  }

  /* ---------------------------------------------------------------- */
  /* results                                                          */
  /* ---------------------------------------------------------------- */

  function upgradeForRow(row) {
    var found = null;
    FM.GEM_UPGRADES.forEach(function (u) { if (u.row === row) found = u; });
    if (!found && FD && FD.upgrades) {
      FD.upgrades.forEach(function (u) { if (u.row === row) found = u; });
    }
    return found;
  }

  function snapshotRanks(model) {
    var m = {};
    model.rows.forEach(function (r) { if (r.rank) m[r.row] = r.rank; });
    return m;
  }

  function clearHistory() {
    lastRanks = null;
    lastBase = null;
    lastBuy = null;
    undoStack = [];
  }

  function commitLevel(row) {
    var up = upgradeForRow(row);
    if (!up) return;
    var prev = FM.computeModel(state);
    var prevLevel = num(state.G[row]);
    if (prevLevel >= up.max) return;

    state.G[row] = prevLevel + 1;
    undoStack.push({ row: row, prevLevel: prevLevel, ranks: snapshotRanks(prev), base: prev.base });

    // keep the level input in sync
    var inp = document.getElementById("lv-" + row);
    if (inp) inp.value = state.G[row];

    lastRanks = snapshotRanks(prev);
    lastBase = prev.base;
    lastBuy = row;
    update();
  }

  function undoPurchase() {
    var a = undoStack.pop();
    if (!a) return;
    var now = FM.computeModel(state);
    lastRanks = snapshotRanks(now);
    lastBase = now.base;
    lastBuy = a.row;

    state.G[a.row] = a.prevLevel;
    var inp = document.getElementById("lv-" + a.row);
    if (inp) inp.value = a.prevLevel;
    update();
  }

  function num(v) { return (typeof v === "number" && isFinite(v)) ? v : 0; }

  function renderResults(root, model) {
    root.innerHTML = "";
    var summary = el("div", "summary");
    summary.appendChild(el("div", "stat", "Base average fish/time: " + fmt(model.base) + " fish/s"));
    if (lastBase !== null && isFinite(lastBase) && lastBase > 0 && lastBase !== model.base) {
      var d = model.base / lastBase - 1;
      summary.appendChild(el("div", "stat delta " + (d >= 0 ? "up" : "down"),
        (d >= 0 ? "+" : "") + fmtPct(d) + " fish/s vs. before"));
    }
    root.appendChild(summary);

    var bar = el("div", "rank-bar");
    var undo = el("button", "ghost", "Undo last purchase");
    undo.id = "btn-undo";
    undo.type = "button";
    undo.disabled = undoStack.length === 0;
    undo.addEventListener("click", undoPurchase);
    bar.appendChild(undo);
    if (lastBuy !== null) {
      var up = upgradeForRow(lastBuy);
      bar.appendChild(el("span", "hint", "Last change: " + (up ? up.name : ("row " + lastBuy)) +
        " is now level " + num(state.G[lastBuy]) + ". Arrows show rank movement vs. before."));
    } else {
      bar.appendChild(el("span", "hint", "Press +1 to commit a level and re-rank; buy several in a row to plan ahead."));
    }
    root.appendChild(bar);

    var table = el("table", "results-table");
    var thead = el("thead");
    var cols = ["Rank", "Upgrade", "Level", "Max", "Gem cost", "New fish/time", "Growth", "Score/gem", "Buy", "Note"];
    var hr = el("tr");
    cols.forEach(function (c) { hr.appendChild(el("th", null, c)); });
    thead.appendChild(hr);
    table.appendChild(thead);

    var tbody = el("tbody");
    var shownRows = state.hideLocked
      ? model.rows.filter(function (r) { return !r.locked; })
      : model.rows;
    var hiddenLocked = model.rows.length - shownRows.length;
    shownRows
      .slice()
      .sort(function (a, b) {
        if (a.rankable && b.rankable) return a.rank - b.rank;
        if (a.rankable) return -1;
        if (b.rankable) return 1;
        return a.row - b.row;
      })
      .forEach(function (r) {
        var tr = el("tr");
        if (!r.rankable) tr.className = "blocked";
        if (r.row === lastBuy) tr.className += " just-bought";

        var rankCell = el("td", "rank");
        rankCell.appendChild(el("span", null, r.rank ? String(r.rank) : "-"));
        if (lastRanks && r.rank && lastRanks[r.row]) {
          var delta = lastRanks[r.row] - r.rank;
          if (delta > 0) rankCell.appendChild(el("span", "move up", "▲" + delta));
          else if (delta < 0) rankCell.appendChild(el("span", "move down", "▼" + (-delta)));
          else rankCell.appendChild(el("span", "move same", "="));
        }
        tr.appendChild(rankCell);

        tr.appendChild(el("td", "name", r.name));
        tr.appendChild(el("td", null, String(r.level)));
        tr.appendChild(el("td", null, String(r.max)));
        tr.appendChild(el("td", "num", fmtInt(r.scoreCost)));
        tr.appendChild(el("td", "num", fmt(r.newFishTime)));
        tr.appendChild(el("td", "num", r.growth === null ? "-" : fmtPct(r.growth)));
        tr.appendChild(el("td", "num", r.score === null ? "-" : r.score.toExponential(3)));

        var buyCell = el("td", "buy");
        var b = el("button", "buy-btn", "+1");
        b.type = "button";
        b.title = "Commit one level of " + r.name + " and re-rank";
        b.disabled = !r.rankable;
        b.addEventListener("click", function () { commitLevel(r.row); });
        buyCell.appendChild(b);
        tr.appendChild(buyCell);

        tr.appendChild(el("td", "note", r.rankable ? "" : (r.blocked || "")));
        tbody.appendChild(tr);
      });
    table.appendChild(tbody);
    root.appendChild(scrollWrap(table));
    root.appendChild(el("p", "hint",
      "Ranked by " + (model.expMode ? "growth per 100,000 gems (exponential)" : "(new fish/time - current fish/time) / gem cost") +
      ". Lower gem cost + higher growth = better. Press +1 on a row to spend that upgrade's gems and see how the ranking moves." +
      (hiddenLocked ? " " + hiddenLocked + " locked upgrade" + (hiddenLocked === 1 ? "" : "s") + " hidden." : "")));
  }

  /* ---------------------------------------------------------------- */
  /* fish-purchased upgrades (rows 3-20, paid with fish)              */
  /* ---------------------------------------------------------------- */

  function renderFishResults(root, model) {
    root.innerHTML = "";
    var rows = model.fishRows || [];

    if (!rows.length) {
      root.appendChild(el("p", "hint", "Fish upgrade data not loaded (fishcosts.js missing)."));
      return;
    }

    var table = el("table", "results-table");
    var thead = el("thead");
    var cols = ["Rank", "Upgrade", "Level", "Max", "Next cost", "Weighted cost", "New fish/time", "Growth", "Score/effort", "Buy", "Note"];
    var hr = el("tr");
    cols.forEach(function (c) { hr.appendChild(el("th", null, c)); });
    thead.appendChild(hr);
    table.appendChild(thead);

    var tbody = el("tbody");
    var shownRows = state.hideLocked
      ? rows.filter(function (r) { return !r.locked; })
      : rows;
    var hiddenLocked = rows.length - shownRows.length;
    shownRows
      .slice()
      .sort(function (a, b) {
        if (a.rankable && b.rankable) return a.rank - b.rank;
        if (a.rankable) return -1;
        if (b.rankable) return 1;
        return a.row - b.row;
      })
      .forEach(function (r) {
        var tr = el("tr");
        if (!r.rankable) tr.className = "blocked";
        if (r.row === lastBuy) tr.className += " just-bought";

        tr.appendChild(el("td", "rank", r.rank ? String(r.rank) : "-"));
        tr.appendChild(el("td", "name", r.name));
        tr.appendChild(el("td", null, String(r.level)));
        tr.appendChild(el("td", null, String(r.max)));

        var costCell = el("td", "num", r.count === null ? "-" : fmtInt(r.count) + " \u00d7 " + r.fish);
        if (r.fishPower !== null) costCell.title = r.fish + " power rating: " + fmtInt(r.fishPower);
        tr.appendChild(costCell);

        tr.appendChild(el("td", "num", r.effort === null ? "-" : fmt(r.effort)));
        tr.appendChild(el("td", "num", fmt(r.newFishTime)));
        tr.appendChild(el("td", "num", r.growth === null ? "-" : fmtPct(r.growth)));
        tr.appendChild(el("td", "num", r.score === null ? "-" : r.score.toExponential(3)));

        var buyCell = el("td", "buy");
        var b = el("button", "buy-btn", "+1");
        b.type = "button";
        b.title = "Commit one level of " + r.name + " and re-rank";
        b.disabled = !r.buyable;
        b.addEventListener("click", function () { commitLevel(r.row); });
        buyCell.appendChild(b);
        tr.appendChild(buyCell);

        tr.appendChild(el("td", "note", r.rankable ? "" : (r.blocked || "")));
        tbody.appendChild(tr);
      });
    table.appendChild(tbody);

    root.appendChild(scrollWrap(table));
    root.appendChild(el("p", "hint",
      "Bought with fish, not gems. Score = (new fish/time - current fish/time) / weighted cost, where " +
      "weighted cost = fish count \u00d7 the fish's power rating (how hard it is to catch, so costs across " +
      "species are comparable). Wiki prices above ~99,999 are rounded. Press +1 on a row to spend that " +
      "upgrade's fish and re-rank everything." +
      (hiddenLocked ? " " + hiddenLocked + " locked upgrade" + (hiddenLocked === 1 ? "" : "s") + " hidden." : "")));
  }

  /* ---------------------------------------------------------------- */
  /* import panel                                                     */
  /* ---------------------------------------------------------------- */

  function showReport(msg, ok) {
    var box = document.getElementById("import-status");
    box.textContent = msg;
    box.className = "import-status " + (ok ? "ok" : "warn");
  }

  function recordTracker(parsed, res, rawText, source, done) {
    if (!window.TrackerTool || typeof window.TrackerTool.recordImport !== "function") return;
    window.TrackerTool.recordImport(parsed, res, rawText, source).then(function (result) {
      if (!result || !done) return;
      if (result.error) done("Tracker warning: " + result.error, false);
      else if (result.skipped && result.reason === "sample") done("", true);
      else if (result.skipped) done("Already in the Tracker.", true);
      else if (result.replaced) done("Tracker snapshot updated.", true);
      else if (result.added) done("Tracker snapshot saved.", true);
    }).catch(function (error) {
      if (done) {
        done("Tracker warning: " + (error && error.message ? error.message : error), false);
      }
    });
  }

  function applyImport(raw, source) {
    try {
      var rawText = typeof raw === "string" ? raw : JSON.stringify(raw);
      var parsed = ES.parseExport(rawText);
      var isSample = window.TrackerData && typeof window.TrackerData.isSampleSource === "function"
        ? window.TrackerData.isSampleSource(source)
        : (source === "sample export" || source === "v2.2.52 sample export");
      var isBackfill = false;
      if (!isSample && window.TrackerData) {
        if (typeof window.TrackerData.exportTimeMs === "function" &&
            typeof window.TrackerData.isOlderThanActive === "function") {
          isBackfill = window.TrackerData.isOlderThanActive(
            window.TrackerData.exportTimeMs(parsed.time), accountRecord);
        }
      }

      var res = ES.apply(parsed.stats, FM.defaultInputs());

      if (isBackfill) {
        var backfillMessage = "Imported " + source + " (" + (parsed.version || "?") +
          "): this export is older than the active account, so it was recorded in the Tracker only.";
        showReport(backfillMessage, true);
        recordTracker(parsed, res, rawText, source, function (suffix, ok) {
          showReport(backfillMessage + (suffix ? " " + suffix : ""), ok);
        });
        return;
      }

      var hideLocked = !!state.hideLocked;
      state = res.inputs;
      state.hideLocked = hideLocked;
      importReport = res;
      accountRecord = {
        raw: rawText,
        source: source,
        version: parsed.version || "?",
        exportedAt: parsed.time,
        importedAt: new Date().toISOString(),
        applied: res.applied.length,
        missing: res.missing.length
      };
      if (ACCOUNT) ACCOUNT.save(accountRecord);
      if (window.BombTool) window.BombTool.refreshAccount();
      if (window.GoalTool) window.GoalTool.refreshAccount();
      if (window.ContractTool) window.ContractTool.refreshAccount();
      if (window.FloorTool) window.FloorTool.refreshAccount();
      if (window.TrackerTool) window.TrackerTool.refreshAccount();
      restoredSaved = true;
      clearHistory();
      rebuild();
      renderAccountSummary();

      // Best Floor to Farm reads the raw stats; tell the player if their export lacks any it needs.
      var floorGaps = window.FloorData ? window.FloorData.missingKeys(parsed.stats).length : 0;
      var message = "Imported " + source + " (" + (parsed.version || "?") + "): " +
        res.applied.length + " fields filled, " + res.missing.length +
        " missing (set manually inside the tool)." +
        (floorGaps ? " Best Floor to Farm: " + floorGaps + " stat" + (floorGaps === 1 ? "" : "s") +
          " missing - re-export from the latest game version." : "");
      var messageOk = res.missing.length === 0 && floorGaps === 0;
      showReport(message, messageOk);
      if (!isSample) {
        recordTracker(parsed, res, rawText, source, function (suffix, ok) {
          showReport(message + (suffix ? " " + suffix : ""), messageOk && ok);
        });
      }
    } catch (e) {
      showReport("Import failed: " + e.message, false);
    }
  }

  // Load an existing snapshot into the active account and every tool.
  function loadAccountRecord(record) {
    if (!record || typeof record.raw !== "string") return false;
    try {
      var parsed = ES.parseExport(record.raw);
      var res = ES.apply(parsed.stats, FM.defaultInputs());
      var hideLocked = !!state.hideLocked;
      state = res.inputs;
      state.hideLocked = hideLocked;
      importReport = res;
      accountRecord = {
        raw: record.raw,
        source: record.source || "tracker snapshot",
        version: record.version || parsed.version || "?",
        exportedAt: record.exportedAt !== undefined && record.exportedAt !== null
          ? record.exportedAt
          : parsed.time,
        importedAt: new Date().toISOString(),
        applied: typeof record.applied === "number" ? record.applied : res.applied.length,
        missing: typeof record.missing === "number" ? record.missing : res.missing.length
      };
      if (ACCOUNT) ACCOUNT.save(accountRecord);
      if (window.BombTool) window.BombTool.refreshAccount();
      if (window.GoalTool) window.GoalTool.refreshAccount();
      if (window.ContractTool) window.ContractTool.refreshAccount();
      if (window.TrackerTool) window.TrackerTool.refreshAccount();
      restoredSaved = true;
      clearHistory();
      rebuild();
      renderAccountSummary();
      return true;
    } catch (e) {
      return false;
    }
  }

  function initImport() {
    var ta = document.getElementById("import-text");

    document.getElementById("btn-paste").addEventListener("click", function () {
      if (typeof navigator === "undefined" || !navigator.clipboard || !navigator.clipboard.readText) {
        ta.focus();
        showReport("Clipboard access is unavailable here - click the box and press Ctrl+V.", false);
        return;
      }
      navigator.clipboard.readText().then(function (text) {
        if (!text) {
          showReport("Clipboard is empty.", false);
          return;
        }
        ta.value = text;
        ta.focus();
        showReport("JSON pasted. Press Apply JSON to import it.", true);
      }).catch(function () {
        ta.focus();
        showReport("Could not read the clipboard - click the box and press Ctrl+V.", false);
      });
    });

    ta.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") applyImport(ta.value, "pasted JSON");
    });

    document.getElementById("btn-parse").addEventListener("click", function () {
      applyImport(ta.value, "pasted JSON");
    });
    document.getElementById("btn-sample").addEventListener("click", function () {
      ta.value = JSON.stringify(window.SAMPLE_EXPORT, null, 2);
      applyImport(window.SAMPLE_EXPORT, "sample export");
    });
    var newSample = document.getElementById("btn-sample-new");
    if (newSample) {
      newSample.addEventListener("click", function () {
        if (!window.SAMPLE_EXPORT_V2252) return;
        ta.value = JSON.stringify(window.SAMPLE_EXPORT_V2252, null, 2);
        applyImport(window.SAMPLE_EXPORT_V2252, "v2.2.52 sample export");
      });
    }
    document.getElementById("btn-clear").addEventListener("click", function () {
      state = FM.defaultInputs();
      importReport = null;
      restoredSaved = false;
      accountRecord = null;
      if (ACCOUNT) ACCOUNT.clear();
      if (window.BombTool) window.BombTool.refreshAccount();
      if (window.GoalTool) window.GoalTool.resetAll();
      if (window.ContractTool) window.ContractTool.resetAll();
      if (window.FloorTool) window.FloorTool.resetAll();
      if (window.TrackerTool) window.TrackerTool.refreshAccount();
      clearHistory();
      rebuild();
      forgetSavedState();
      ta.value = "";
      renderAccountSummary();
      showReport("Reset to defaults and cleared the saved account and tool details. Tracker history was kept.", true);
    });

    var file = document.getElementById("import-file");
    file.addEventListener("change", function () {
      var f = file.files[0];
      if (!f) return;
      var rd = new FileReader();
      rd.onload = function () { ta.value = rd.result; applyImport(rd.result, f.name); };
      rd.readAsText(f);
    });

    // drag & drop anywhere
    document.addEventListener("dragover", function (e) { e.preventDefault(); });
    document.addEventListener("drop", function (e) {
      e.preventDefault();
      var f = e.dataTransfer.files[0];
      if (!f) return;
      var rd = new FileReader();
      rd.onload = function () { ta.value = rd.result; applyImport(rd.result, f.name); };
      rd.readAsText(f);
    });
  }

  /* ---------------------------------------------------------------- */
  /* wiring                                                           */
  /* ---------------------------------------------------------------- */

  // sections 3-5: one editor open at a time keeps the rankings close by
  function initAccordion() {
    if (!document.querySelectorAll) return;
    var items = document.querySelectorAll("#input-accordion > details");
    if (!items.length) return;
    var list = Array.prototype.slice.call(items);
    list.forEach(function (item) {
      item.addEventListener("toggle", function () {
        if (!item.open) return;
        list.forEach(function (other) { if (other !== item) other.open = false; });
      });
    });

    var closers = document.querySelectorAll("#input-accordion .acc-close");
    Array.prototype.forEach.call(closers, function (btn) {
      btn.addEventListener("click", function () {
        var item = btn.closest ? btn.closest("details") : null;
        if (item) item.open = false;
        var ranking = document.getElementById("ranking");
        if (ranking && ranking.scrollIntoView) ranking.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  /* ---------------------------------------------------------------- */
  /* home / tool views                                                */
  /* ---------------------------------------------------------------- */

  var VIEW_IDS = { home: "view-home", fishing: "view-fishing", bombs: "view-bombs", goal: "view-goal", contracts: "view-contracts", floors: "view-floors", tracker: "view-tracker" };

  function routeFromHash(hash) {
    var h = String(hash || "").replace(/^#\/?/, "").toLowerCase();
    if (h === "fishing" || h === "fishing-optimizer") return "fishing";
    if (h === "bombs" || h === "bomb" || h === "bomb-comparison" || h === "transmuter") return "bombs";
    if (h === "goal" || h === "goal-eta" || h === "eta" || h === "time-to-goal") return "goal";
    if (h === "contracts" || h === "contract" || h === "contract-planner" || h === "contract-points" || h === "cp") return "contracts";
    if (h === "floors" || h === "floor" || h === "best-floor" || h === "best-ore" || h === "best-veins" ||
        h === "farm" || h === "floors/ore" || h === "floors/veins") return "floors";
    if (h === "tracker" || h === "progress" || h === "growth" || h === "history") return "tracker";
    return "home";
  }

  function currentView() {
    if (typeof window === "undefined" || !window.location) return "home";
    return routeFromHash(window.location.hash);
  }

  function renderView() {
    var view = currentView();

    Object.keys(VIEW_IDS).forEach(function (name) {
      var node = document.getElementById(VIEW_IDS[name]);
      if (node) node.hidden = name !== view;
    });

    var links = document.querySelectorAll ? document.querySelectorAll("[data-nav]") : [];
    Array.prototype.forEach.call(links, function (link) {
      var active = link.getAttribute && link.getAttribute("data-nav") === view;
      if (!link.classList) return;
      if (active) link.classList.add("active");
      else link.classList.remove("active");
    });

    if (document.title !== undefined) {
      document.title = view === "fishing"
        ? "Let's Go Fishing - Gem Upgrade Optimizer"
        : view === "bombs"
          ? "Bomb of Plenty vs Transmuter - Obelisk Miner Tools"
          : view === "goal"
            ? "Goal ETA - Time to an Ore or Bar Target"
            : view === "contracts"
              ? "Contract Point Planner - Obelisk Miner Tools"
              : view === "floors"
                ? "Best Floor to Farm - Obelisk Miner Tools"
                : view === "tracker"
                  ? "Tracker - Progression Over Time"
                  : "Obelisk Miner Tools";
    }
  }

  function onRouteChange() {
    renderView();
    if (typeof window !== "undefined" && typeof window.scrollTo === "function") {
      window.scrollTo(0, 0);
    }
  }

  function initRouter() {
    if (typeof window !== "undefined" && window.addEventListener) {
      window.addEventListener("hashchange", onRouteChange);
    }
    renderView();
  }

  function update() {
    var model = FM.computeModel(state);
    renderResults(document.getElementById("results"), model);
    renderFishResults(document.getElementById("fish-results"), model);
    persistState();
  }

  function rebuild() {
    renderSettings(document.getElementById("settings"));
    renderUpgrades(document.getElementById("upgrades"));
    renderCards(document.getElementById("cards"));
    renderScalars(document.getElementById("scalars"));
    update();
  }

  function init() {
    initRouter();
    initImport();
    initAccordion();
    rebuild();
    renderAccountSummary();
    if (window.BombTool) window.BombTool.init();
    if (window.GoalTool) window.GoalTool.init();
    if (window.ContractTool) window.ContractTool.init();
    if (window.FloorTool) window.FloorTool.init();
    if (window.TrackerTool) window.TrackerTool.init();

    var note = document.getElementById("save-note");
    if (note) {
      note.textContent = getStorage()
        ? "Your account and tool settings are saved automatically in this browser."
        : "This browser is blocking local storage, so details will not be remembered.";
    }

    if (typeof window !== "undefined" && window.addEventListener) {
      window.addEventListener("beforeunload", flushSavedState);
    }

    showReport(restoredSaved
      ? "Restored your saved fishing details from this browser. Open a tool below, or import a fresh JSON."
      : "Paste your ExportStats JSON above, or open a tool and enter values manually.", true);
  }

  window.ObeliskApp = {
    loadAccountRecord: loadAccountRecord
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
