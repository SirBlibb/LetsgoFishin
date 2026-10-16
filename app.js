/*
 * Let's Go Fishing - optimizer UI.
 * Depends on: model.js (FishModel), data.js (UI_SPEC), exportstats.js (ExportStats).
 */
(function () {
  "use strict";

  var FM = window.FishModel;
  var UI = window.UI_SPEC;
  var ES = window.ExportStats;

  var state = FM.defaultInputs();
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
    sec2.appendChild(el("h3", null, "Fishing - Upgrades (inputs, not ranked)"));
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
    model.rows
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
      ". Lower gem cost + higher growth = better. Press +1 on a row to spend that upgrade's gems and see how the ranking moves."));
  }

  /* ---------------------------------------------------------------- */
  /* import panel                                                     */
  /* ---------------------------------------------------------------- */

  function showReport(msg, ok) {
    var box = document.getElementById("import-status");
    box.textContent = msg;
    box.className = "import-status " + (ok ? "ok" : "warn");
  }

  function applyImport(raw, source) {
    try {
      var parsed = ES.parseExport(raw);
      var res = ES.apply(parsed.stats, FM.defaultInputs());
      state = res.inputs;
      importReport = res;
      clearHistory();
      rebuild();
      showReport("Imported " + source + " (v" + parsed.version + "): " +
        res.applied.length + " fields filled, " + res.missing.length +
        " missing (set manually below).", res.missing.length === 0);
    } catch (e) {
      showReport("Import failed: " + e.message, false);
    }
  }

  function initImport() {
    var ta = document.getElementById("import-text");
    document.getElementById("btn-parse").addEventListener("click", function () {
      applyImport(ta.value, "pasted JSON");
    });
    document.getElementById("btn-sample").addEventListener("click", function () {
      ta.value = JSON.stringify(window.SAMPLE_EXPORT, null, 2);
      applyImport(window.SAMPLE_EXPORT, "sample export");
    });
    document.getElementById("btn-clear").addEventListener("click", function () {
      state = FM.defaultInputs();
      importReport = null;
      clearHistory();
      rebuild();
      showReport("Reset to defaults.", true);
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

  function update() {
    var model = FM.computeModel(state);
    renderResults(document.getElementById("results"), model);
  }

  function rebuild() {
    renderSettings(document.getElementById("settings"));
    renderUpgrades(document.getElementById("upgrades"));
    renderCards(document.getElementById("cards"));
    renderScalars(document.getElementById("scalars"));
    update();
  }

  function init() {
    initImport();
    rebuild();
    showReport("Enter values manually, or import your game's ExportStats JSON.", true);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
