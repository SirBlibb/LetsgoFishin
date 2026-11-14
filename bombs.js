/*
 * Bomb of Plenty vs Transmuter Bomb comparison UI.
 *
 * Depends on:
 *   bombdata.js  (window.BombData)
 *   exportstats.js / account.js when a saved account is present
 *
 * Exposed as window.BombTool so app.js can initialise it and refresh it after
 * an account import/reset.
 */
(function (global) {
  "use strict";

  var BD = global.BombData;
  var ACCOUNT = global.AccountStore || null;
  var ES = global.ExportStats || null;
  var KEY = "obelisk-bombs-v1";

  var state = {
    values: BD ? BD.defaults() : {},
    level: 1,
    ore: 1000,
    mode: "bar",
    floor: 1,
    portalChance: 0,
    portalMulti: 1,
    source: "defaults",
    account: null,
    applied: 0,
    missing: BD ? BD.FIELDS.length : 0
  };

  var nodes = {};

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

  function fmtInt(n) {
    if (n === null || n === undefined || !isFinite(n)) return "-";
    return Math.round(n).toLocaleString("en-US");
  }

  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return "-";
    return (n * 100).toFixed(2) + "%";
  }

  // Margins span 0.01% to thousands of percent; keep about three significant figures.
  function fmtMargin(n) {
    if (n === null || n === undefined || !isFinite(n)) return "-";
    var p = n * 100;
    return p.toFixed(p < 10 ? 2 : p < 100 ? 1 : 0) + "%";
  }

  function fmtFactor(n) {
    if (n === null || n === undefined || !isFinite(n)) return "-";
    return String(Math.round(n * 10000) / 10000);
  }

  function fmtBreakpoint(n) {
    if (n === null || n === undefined || !isFinite(n)) return "-";
    if (Math.abs(n) >= 1000) return fmt(n);
    return String(Math.round(n * 10000) / 10000);
  }

  // Keep long ExportStats floats (0.3936600000000001) readable in number inputs.
  function inputValue(n) {
    if (typeof n !== "number" || !isFinite(n) || n === 0) return n;
    return String(Number(n.toPrecision(10)));
  }

  function scrollWrap(table) {
    var w = el("div", "table-scroll");
    w.appendChild(table);
    return w;
  }

  function getStorage() {
    try {
      if (global && global.localStorage) return global.localStorage;
    } catch (e) { /* storage blocked */ }
    return null;
  }

  function asNumber(v, fallback) {
    return typeof v === "number" && isFinite(v) ? v : fallback;
  }

  function fmtShare(n) {
    return (Math.round(n * 10000) / 100) + "%";
  }

  function mixLabel(info) {
    return info.ores.map(function (ore) {
      return ore.bar.name + " " + fmtShare(ore.weight);
    }).join(" / ");
  }

  function floorOptionLabel(info) {
    return "Floor " + info.floor + " - " + mixLabel(info);
  }

  function portalLabel(result) {
    var mix = result.portal || result.mix;
    if (!mix || !(mix.chance > 0)) return "no portals";
    return fmtPct(mix.chance) + " portal chance at " + fmtFactor(mix.multi) + "x";
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
    var mapped = BD.fromAccountStats(acct.stats);
    var context = BD.fromAccountContext(acct.stats);
    state.values = mapped.values;
    state.source = "account";
    state.account = acct;
    state.applied = mapped.applied.length;
    state.missing = mapped.missing.length;
    state.floor = context.floor;
    state.portalChance = context.portalChance;
    state.portalMulti = context.portalMulti;
    if (state.missing > 0 && nodes.statsDetails) nodes.statsDetails.open = true;
    fillStatsInputs();
    fillContextInputs();
    syncModeUI();
    updateSourceNote();
    update();
  }

  function resetToDefaults(resetContext) {
    state.values = BD.defaults();
    state.source = "defaults";
    state.account = null;
    state.applied = 0;
    state.missing = BD.FIELDS.length;
    if (resetContext) {
      state.level = 1;
      state.ore = 1000;
      state.mode = "bar";
      state.floor = 1;
      state.portalChance = 0;
      state.portalMulti = 1;
      if (nodes.ore) nodes.ore.value = state.ore;
    }
    if (nodes.statsDetails) nodes.statsDetails.open = true;
    fillStatsInputs();
    fillContextInputs();
    syncModeUI();
    updateSourceNote();
    update();
  }

  // Called by app.js after an import or a reset on the home page.
  function refreshAccount() {
    if (!BD) return;
    var acct = readAccount();
    if (acct && acct.stats) {
      applyAccount(acct);
    } else {
      resetToDefaults(true);
    }
  }

  function markManual() {
    if (state.source === "account") state.source = "account-edited";
    else if (state.source !== "account-edited") state.source = "manual";
    updateSourceNote();
  }

  function updateSourceNote() {
    if (nodes.statsSource) {
      if (state.source === "account") {
        nodes.statsSource.textContent = "From account (" + state.applied + "/" + BD.FIELDS.length + " fields)";
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
        nodes.statsWarning.textContent = state.missing + " of " + BD.FIELDS.length +
          " stats were not in the account export; defaults are used for those fields. Enter them below.";
      } else if (state.source === "account-edited") {
        nodes.statsWarning.textContent = "You have changed the account values; the comparison updates immediately.";
      } else {
        nodes.statsWarning.textContent = "";
      }
    } else if (state.source === "defaults") {
      nodes.statsWarning.textContent = "Showing generic defaults. Import an account on the home page, or edit the values below.";
    } else {
      nodes.statsWarning.textContent = "";
    }
  }

  /* ---------------------------------------------------------------- */
  /* saved inputs                                                     */
  /* ---------------------------------------------------------------- */

  function loadSaved() {
    var store = getStorage();
    if (!store) return null;
    try {
      var saved = JSON.parse(store.getItem(KEY) || "null");
      return saved && typeof saved === "object" ? saved : null;
    } catch (e) {
      return null;
    }
  }

  // Runs after the account (or defaults) is applied, so the saved target wins
  // over the account's floor and portals. Stats are only restored when edited by
  // hand; untouched account stats are re-read so a newer export shows up.
  function restoreSaved(saved, hasAccount) {
    if (saved.mode === "bar" || saved.mode === "floor") state.mode = saved.mode;
    var level = Math.floor(asNumber(saved.level, state.level));
    if (BD.barByLevel(level)) state.level = level;
    var floor = Math.floor(asNumber(saved.floor, state.floor));
    if (BD.floorInfo(floor)) state.floor = floor;
    // A cleared ore field saves 0; don't reopen the tool showing 0 bars everywhere.
    if (asNumber(saved.ore, 0) > 0) state.ore = saved.ore;
    state.portalChance = Math.max(0, Math.min(100, asNumber(saved.portalChance, state.portalChance)));
    state.portalMulti = Math.max(1, asNumber(saved.portalMulti, state.portalMulti));

    if ((saved.source === "manual" || saved.source === "account-edited") &&
        saved.values && typeof saved.values === "object") {
      state.values = BD.normalizeValues(saved.values);
      state.source = hasAccount ? "account-edited" : "manual";
    }
  }

  function saveInputs() {
    var store = getStorage();
    if (!store) return;
    var edited = state.source === "manual" || state.source === "account-edited";
    try {
      store.setItem(KEY, JSON.stringify({
        mode: state.mode,
        level: state.level,
        floor: state.floor,
        ore: state.ore,
        portalChance: state.portalChance,
        portalMulti: state.portalMulti,
        source: state.source,
        values: edited ? state.values : null
      }));
    } catch (e) { /* storage full or blocked */ }
  }

  /* ---------------------------------------------------------------- */
  /* inputs                                                           */
  /* ---------------------------------------------------------------- */

  function renderLevelOptions() {
    if (!nodes.level) return;
    nodes.level.innerHTML = "";

    var groups = {};
    BD.BARS.forEach(function (bar) { (groups[bar.world] = groups[bar.world] || []).push(bar); });

    Object.keys(groups).forEach(function (world) {
      var og = el("optgroup");
      og.label = "World " + world;
      groups[world].forEach(function (bar) {
        var o = el("option", null, "Level " + bar.level + " - " + bar.name + " (" + fmtInt(bar.cost) + " ore/bar)");
        o.value = String(bar.level);
        og.appendChild(o);
      });
      nodes.level.appendChild(og);
    });

    nodes.level.value = String(state.level);
  }

  function renderFloorOptions() {
    if (!nodes.floor) return;
    nodes.floor.innerHTML = "";

    BD.FLOOR_ZONES.forEach(function (zone) {
      var og = el("optgroup");
      og.label = "World " + zone.world + " - " + zone.name;
      for (var floor = zone.startFloor; floor <= zone.endFloor; floor++) {
        var info = BD.floorInfo(floor);
        if (!info) continue;
        var o = el("option", null, floorOptionLabel(info));
        o.value = String(floor);
        og.appendChild(o);
      }
      nodes.floor.appendChild(og);
    });

    nodes.floor.value = String(state.floor);
  }

  function renderStats() {
    if (!nodes.stats) return;
    nodes.stats.innerHTML = "";

    var byGroup = {};
    BD.FIELDS.forEach(function (f) { (byGroup[f.group] = byGroup[f.group] || []).push(f); });

    Object.keys(byGroup).forEach(function (group) {
      var sec = el("div", "subsection");
      sec.appendChild(el("h3", null, group));
      var grid = el("div", "grid");

      byGroup[group].forEach(function (f) {
        var wrap = el("label", "field");
        wrap.appendChild(el("span", "field-label", f.label + (f.unit ? " (" + f.unit + ")" : "")));

        var inp = el("input");
        inp.type = "number";
        inp.id = "bomb-stat-" + f.key;
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

      sec.appendChild(grid);
      nodes.stats.appendChild(sec);
    });
  }

  function fillStatsInputs() {
    BD.FIELDS.forEach(function (f) {
      var inp = document.getElementById("bomb-stat-" + f.key);
      if (inp) inp.value = inputValue(state.values[f.key]);
    });
  }

  function fillContextInputs() {
    if (nodes.level) nodes.level.value = String(state.level);
    if (nodes.ore) nodes.ore.value = inputValue(state.ore);
    if (nodes.floor) nodes.floor.value = String(state.floor);
    if (nodes.portalChance) nodes.portalChance.value = inputValue(state.portalChance);
    if (nodes.portalMulti) nodes.portalMulti.value = inputValue(state.portalMulti);
  }

  function syncModeUI() {
    var floorMode = state.mode === "floor";
    if (nodes.modeBar) nodes.modeBar.checked = !floorMode;
    if (nodes.modeFloor) nodes.modeFloor.checked = floorMode;
    if (nodes.levelField) nodes.levelField.hidden = floorMode;
    if (nodes.floorField) nodes.floorField.hidden = !floorMode;
    if (nodes.portalChanceField) nodes.portalChanceField.hidden = !floorMode;
    if (nodes.portalMultiField) nodes.portalMultiField.hidden = !floorMode;
    if (nodes.levelNote) nodes.levelNote.hidden = floorMode;
    if (nodes.floorNote) nodes.floorNote.hidden = !floorMode;
    if (nodes.oreLabel) {
      nodes.oreLabel.textContent = floorMode ? "Native ore (before portals)" : "Base ore per bomb";
    }
    if (nodes.modeNote) {
      nodes.modeNote.textContent = floorMode
        ? "Floor mode uses the floor's natural ore mix, then applies the portal chance and multiplier to every native ore."
        : "Bar level mode compares one ore tier. Void Drone floor mode estimates a floor's mixed ore after portals.";
    }
    if (nodes.tableTitle) {
      nodes.tableTitle.textContent = floorMode ? "3. Every floor" : "3. Every bar level";
    }
    if (nodes.tableLead) {
      nodes.tableLead.textContent = floorMode
        ? "The same floor-mix comparison for all 132 dungeon floors, grouped by zone. The selected floor is highlighted."
        : "The same comparison across all known bars, split by world. The selected level is highlighted.";
    }
  }

  function bindControls() {
    function setMode(mode) {
      state.mode = mode === "floor" ? "floor" : "bar";
      syncModeUI();
      update();
    }

    if (nodes.modeBar) {
      nodes.modeBar.addEventListener("change", function () {
        if (nodes.modeBar.checked) setMode("bar");
      });
    }

    if (nodes.modeFloor) {
      nodes.modeFloor.addEventListener("change", function () {
        if (nodes.modeFloor.checked) setMode("floor");
      });
    }

    if (nodes.level) {
      nodes.level.addEventListener("change", function () {
        state.level = parseInt(nodes.level.value, 10) || 1;
        update();
      });
    }

    if (nodes.floor) {
      nodes.floor.addEventListener("change", function () {
        var info = BD.floorInfo(parseInt(nodes.floor.value, 10));
        state.floor = info ? info.floor : 1;
        update();
      });
    }

    if (nodes.portalChance) {
      nodes.portalChance.addEventListener("input", function () {
        var v = parseFloat(nodes.portalChance.value);
        state.portalChance = isFinite(v) ? Math.max(0, Math.min(100, v)) : 0;
        update();
      });
    }

    if (nodes.portalMulti) {
      nodes.portalMulti.addEventListener("input", function () {
        var v = parseFloat(nodes.portalMulti.value);
        state.portalMulti = isFinite(v) ? Math.max(1, v) : 1;
        update();
      });
    }

    if (nodes.ore) {
      nodes.ore.value = state.ore;
      nodes.ore.addEventListener("input", function () {
        var v = parseFloat(nodes.ore.value);
        state.ore = isFinite(v) && v > 0 ? v : 0;
        update();
      });
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
      nodes.reset.addEventListener("click", function () { resetToDefaults(false); });
    }
  }

  /* ---------------------------------------------------------------- */
  /* results                                                          */
  /* ---------------------------------------------------------------- */

  function renderLevelNote(bar, row, result) {
    if (!nodes.levelNote) return;
    var note = "Level " + bar.level + " - " + bar.name + " (World " + bar.world + "). Base cost " +
      fmtInt(bar.cost) + " ore per bar.";
    if (row.effectiveCost !== bar.cost) {
      note += " With your " + fmtFactor(result.costMultiplier) + "x multiplier: " +
        fmtInt(row.effectiveCost) + " ore per bar.";
    }
    note += " A bar level is the ore tier, not a dungeon floor.";
    nodes.levelNote.textContent = note;
  }

  function winnerName(winner) {
    return winner === "bop" ? "Bomb of Plenty" : winner === "trans" ? "Transmuter" : "Tie";
  }

  function pick(n) {
    if (state.mode === "floor") state.floor = n;
    else state.level = n;
    fillContextInputs();
    update();
    // update() rebuilt the strip, so move keyboard focus to the new cell.
    var cell = document.getElementById("bomb-cell-" + n);
    if (cell && typeof cell.focus === "function") cell.focus();
  }

  // One clickable square per bar level or floor, coloured by the winner.
  // cells: [{ n, label, winner, groupStart }]
  function winnerStrip(cells, selected, what) {
    var wrap = el("div", "bomb-strip-wrap");
    var strip = el("div", "bomb-strip");
    strip.id = "bomb-strip";
    strip.setAttribute("role", "group");
    strip.setAttribute("aria-label", "Winner at every " + what);
    cells.forEach(function (c) {
      var b = el("button", "bomb-cell " + c.winner +
        (c.groupStart ? " group-start" : "") + (c.n === selected ? " selected" : ""));
      b.type = "button";
      b.id = "bomb-cell-" + c.n;
      b.title = c.label;
      b.setAttribute("aria-label", c.label);
      b.setAttribute("aria-pressed", c.n === selected ? "true" : "false");
      // Roving tabindex: one tab stop for the whole strip, arrow keys move within it.
      b.tabIndex = c.n === selected ? 0 : -1;
      b.addEventListener("click", function () { pick(c.n); });
      strip.appendChild(b);
    });
    strip.addEventListener("keydown", function (e) {
      var step = e && e.key === "ArrowRight" ? 1 : e && e.key === "ArrowLeft" ? -1 : 0;
      if (!step) return;
      e.preventDefault();
      var next = Math.max(cells[0].n, Math.min(cells[cells.length - 1].n, selected + step));
      if (next !== selected) pick(next);
    });
    wrap.appendChild(strip);

    var legend = el("div", "bomb-strip-legend");
    legend.appendChild(el("span", "bomb-key bop"));
    legend.appendChild(el("span", null, "Bomb of Plenty"));
    legend.appendChild(el("span", "bomb-key trans"));
    legend.appendChild(el("span", null, "Transmuter"));
    if (cells.some(function (c) { return c.winner === "tie"; })) {
      legend.appendChild(el("span", "bomb-key tie"));
      legend.appendChild(el("span", null, "Tie"));
    }
    legend.appendChild(el("span", "bomb-strip-tip", "Pick a square to compare that " + what + "."));
    wrap.appendChild(legend);
    return wrap;
  }

  function bombCard(kind, title, total, details, winner, note) {
    var card = el("article", "bomb-card" + (winner === kind ? " winner" : ""));
    card.id = "bomb-" + kind + "-card";

    var head = el("div", "bomb-card-head");
    head.appendChild(el("h3", "bomb-card-title", title));
    if (winner === kind) head.appendChild(el("span", "bomb-chip", "Winner"));
    card.appendChild(head);

    var figure = el("div", "bomb-figure", fmt(total));
    figure.id = "bomb-" + kind + "-bars";
    card.appendChild(figure);
    card.appendChild(el("div", "bomb-figure-note",
      note || ("bars from " + fmtInt(state.ore) + " base ore")));

    var dl = el("dl", "bomb-breakdown");
    details.forEach(function (item) {
      var row = el("div");
      row.appendChild(el("dt", null, item[0]));
      row.appendChild(el("dd", null, item[1]));
      dl.appendChild(row);
    });
    card.appendChild(dl);

    return card;
  }

  function renderResults(bar, row, result) {
    var root = nodes.results;
    if (!root) return;
    root.innerHTML = "";

    var ore = state.ore;
    var bopBars = row.bopPerOre * ore;
    var transBars = row.transPerOre * ore;
    var directBars = row.directTransPerOre * ore;
    var craftedBars = row.craftedTransPerOre * ore;
    var winner = row.winner;

    var verdict = el("div", "bomb-verdict " +
      (winner === "bop" ? "win-bop" : winner === "trans" ? "win-trans" : "win-tie"));
    verdict.id = "bomb-verdict";

    var badgeText = winner === "bop" ? "Bomb of Plenty wins" : winner === "trans" ? "Transmuter wins" : "Effectively tied";
    verdict.appendChild(el("span", "bomb-verdict-badge", badgeText));

    var main;
    if (winner === "tie" || row.advantage * 100 < 0.005) {
      main = "Both bombs produce essentially the same bars at " + bar.name + " (level " + bar.level + ").";
    } else {
      main = (winner === "bop" ? "Bomb of Plenty" : "Transmuter Bomb") + " produces " +
        fmtMargin(row.advantage) + " more bars at " + bar.name + " (level " + bar.level + ").";
    }
    var verdictText = el("p", "bomb-verdict-text", main);
    verdictText.id = "bomb-verdict-text";
    verdict.appendChild(verdictText);
    var sub = el("p", "bomb-verdict-sub",
      "From " + fmtInt(ore) + " base ore: " + fmt(bopBars) + " bars with Bomb of Plenty vs " +
      fmt(transBars) + " with Transmuter.");
    sub.id = "bomb-verdict-sub";
    verdict.appendChild(sub);
    root.appendChild(verdict);

    var cards = el("div", "bomb-cards");
    cards.appendChild(bombCard("bop", "Bomb of Plenty", bopBars, [
      ["Expected ore", fmt(result.bopOre * ore)],
      ["Craft multiplier", "×" + fmt(result.craftMultiplier)],
      ["Effective cost", fmtInt(row.effectiveCost) + " ore/bar"]
    ], winner));
    cards.appendChild(bombCard("trans", "Transmuter Bomb", transBars, [
      ["Expected ore", fmt(result.transOre * ore)],
      ["Direct bars", fmt(directBars)],
      ["Crafted leftovers", fmt(craftedBars)],
      ["Effective cost", fmtInt(row.effectiveCost) + " ore/bar"]
    ], winner));
    root.appendChild(cards);

    if (Math.abs(result.barOutputMultiplier - 1) > 1e-9) {
      root.appendChild(el("p", "hint",
        "Both totals include your " + fmtFactor(result.barOutputMultiplier) + "x bar output multiplier."));
    }

    var bp = el("div", "bomb-breakpoint");
    bp.id = "bomb-breakpoint";
    bp.appendChild(el("h3", null, "Breakpoint"));

    var low = result.lastBopIndex >= 0 ? result.rows[result.lastBopIndex] : null;
    var high = result.firstTransIndex >= 0 ? result.rows[result.firstTransIndex] : null;
    var line;
    if (!low && !high) {
      line = "Every known bar level is effectively tied with these stats.";
    } else if (!high) {
      line = "Bomb of Plenty wins at every known bar level (through " + low.bar.name + ").";
    } else if (!low) {
      line = "Transmuter Bomb wins at every known bar level (starting at " + high.bar.name + ").";
    } else {
      line = "Bomb of Plenty wins up to " + low.bar.name + " (level " + low.bar.level + "). " +
        "Transmuter Bomb wins from " + high.bar.name + " (level " + high.bar.level + ") onward.";
    }
    var breakpointMain = el("p", "bomb-breakpoint-main", line);
    breakpointMain.id = "bomb-breakpoint-main";
    bp.appendChild(breakpointMain);
    bp.appendChild(winnerStrip(result.rows.map(function (r, i) {
      return {
        n: r.level,
        winner: r.winner,
        groupStart: i > 0 && r.bar.world !== result.rows[i - 1].bar.world,
        label: "Level " + r.level + " " + r.bar.name + ": " + winnerName(r.winner) +
          (r.winner === "tie" ? "" : " by " + fmtMargin(r.advantage))
      };
    }), state.level, "bar level"));

    var detail;
    if (isFinite(result.transition) && result.transition > 0) {
      detail = "Breakpoint: " + fmtBreakpoint(result.transition) + " effective ore per bar";
      if (result.costMultiplier > 0 && Math.abs(result.costMultiplier - 1) > 1e-9) {
        detail += " (" + fmtBreakpoint(result.baseTransition) + " base ore per bar at " +
          fmtFactor(result.costMultiplier) + "x).";
      } else {
        detail += ".";
      }
    } else if (isFinite(result.transition)) {
      detail = "The breakpoint is at or below zero, outside the known bar costs.";
    } else {
      detail = "The breakpoint is above the most expensive known bar.";
    }
    bp.appendChild(el("p", "hint", detail));

    if (result.tieCount > 0) {
      bp.appendChild(el("p", "hint", result.tieCount + " level" + (result.tieCount === 1 ? " is" : "s are") +
        " effectively tied; rounding can put a level right at the breakpoint."));
    }
    root.appendChild(bp);
  }

  function renderFloorNote(info, result) {
    if (!nodes.floorNote) return;
    var mix = result.portal;
    var parts = [];
    parts.push("Floor " + info.floor + " (" + info.zone + ", World " + info.world + ").");
    parts.push("Native mix: " + mixLabel(info) + ".");
    if (mix.chance > 0) {
      parts.push("Portals: " + fmtPct(mix.chance) + " chance at " + fmtFactor(mix.multi) + "x.");
    } else {
      parts.push("Void portals are off.");
    }
    parts.push("Expected ore yield: " + fmtFactor(mix.totalYield) + "x native ore.");
    nodes.floorNote.textContent = parts.join(" ");
  }

  function renderNativeRows(info, result) {
    var sec = el("div", "bomb-native");
    sec.id = "bomb-native";
    sec.appendChild(el("h3", null, "Native ore on floor " + info.floor));
    sec.appendChild(el("p", "hint",
      "If you only care about one ore, this is the ordinary bar-level winner for that ore. The floor verdict above combines both."));

    var table = el("table", "bomb-table bomb-native-table");
    var thead = el("thead");
    var hr = el("tr");
    ["Ore", "Level", "Floor share", "BoP bars/ore", "Trans bars/ore", "Better", "Margin"]
      .forEach(function (label) { hr.appendChild(el("th", null, label)); });
    thead.appendChild(hr);
    table.appendChild(thead);

    var tbody = el("tbody");
    result.nativeRows.forEach(function (row) {
      var tr = el("tr");
      tr.id = "bomb-native-row-" + row.level;
      tr.appendChild(el("td", "name", row.bar.name));
      tr.appendChild(el("td", "num", String(row.level)));
      tr.appendChild(el("td", "num", fmtShare(row.weight)));
      tr.appendChild(el("td", "num", fmt(row.bopPerOre)));
      tr.appendChild(el("td", "num", fmt(row.transPerOre)));
      var winner = row.winner === "bop" ? "BoP" : row.winner === "trans" ? "Trans" : "Tie";
      tr.appendChild(el("td", "bomb-winner " + row.winner, winner));
      tr.appendChild(el("td", "num", row.winner === "tie" ? "-" : fmtMargin(row.advantage)));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    sec.appendChild(scrollWrap(table));
    return sec;
  }

  function renderFloorResults(result, floorRows) {
    var root = nodes.results;
    if (!root) return;
    root.innerHTML = "";

    var info = result.floor;
    var ore = state.ore;
    var bopBars = result.bopBarsPerBase * ore;
    var transBars = result.transBarsPerBase * ore;
    var directBars = result.directTransBarsPerBase * ore;
    var craftedBars = result.craftedTransBarsPerBase * ore;
    var winner = result.winner;

    var verdict = el("div", "bomb-verdict " +
      (winner === "bop" ? "win-bop" : winner === "trans" ? "win-trans" : "win-tie"));
    verdict.id = "bomb-verdict";

    var badgeText = winner === "bop" ? "Bomb of Plenty wins" : winner === "trans" ? "Transmuter wins" : "Effectively tied";
    verdict.appendChild(el("span", "bomb-verdict-badge", badgeText + " on this floor"));

    var main;
    if (winner === "tie" || result.advantage * 100 < 0.005) {
      main = "Both bombs produce essentially the same bars from floor " + info.floor + "'s expected ore mix.";
    } else {
      main = (winner === "bop" ? "Bomb of Plenty" : "Transmuter Bomb") + " produces " +
        fmtMargin(result.advantage) + " more bars from floor " + info.floor + "'s expected ore mix.";
    }
    var verdictText = el("p", "bomb-verdict-text", main);
    verdictText.id = "bomb-verdict-text";
    verdict.appendChild(verdictText);
    var sub = el("p", "bomb-verdict-sub",
      "From " + fmtInt(ore) + " native ore with " + portalLabel(result) + ": " +
      fmt(bopBars) + " bars with Bomb of Plenty vs " + fmt(transBars) + " with Transmuter.");
    sub.id = "bomb-verdict-sub";
    verdict.appendChild(sub);
    root.appendChild(verdict);

    var figureNote = "bars from " + fmtInt(ore) + " native floor ore";
    var cards = el("div", "bomb-cards");
    cards.appendChild(bombCard("bop", "Bomb of Plenty", bopBars, [
      ["Portal yield", fmtFactor(result.totalYield) + "x"],
      ["Ore after BoP", fmt(result.bopOre * result.totalYield * ore)],
      ["Craft multiplier", "×" + fmt(result.craftMultiplier)],
      ["Effective mix cost", fmtBreakpoint(result.mixCost) + " ore/bar"]
    ], winner, figureNote));
    cards.appendChild(bombCard("trans", "Transmuter Bomb", transBars, [
      ["Portal yield", fmtFactor(result.totalYield) + "x"],
      ["Direct bars", fmt(directBars)],
      ["Crafted leftovers", fmt(craftedBars)],
      ["Effective mix cost", fmtBreakpoint(result.mixCost) + " ore/bar"]
    ], winner, figureNote));
    root.appendChild(cards);

    if (Math.abs(result.barOutputMultiplier - 1) > 1e-9) {
      root.appendChild(el("p", "hint",
        "Both totals include your " + fmtFactor(result.barOutputMultiplier) + "x bar output multiplier."));
    }

    var bp = el("div", "bomb-breakpoint");
    bp.id = "bomb-breakpoint";
    bp.appendChild(el("h3", null, "Floor breakpoint"));

    var line;
    if (winner === "tie") {
      line = "This floor's expected mix is effectively at your breakpoint.";
    } else if (isFinite(result.transition) && result.transition > 0) {
      line = "This floor's mix costs " + fmtBreakpoint(result.mixCost) + " effective ore per bar, " +
        (winner === "trans" ? "above" : "below") + " your " +
        fmtBreakpoint(result.transition) + " breakpoint.";
    } else {
      line = winner === "trans"
        ? "Transmuter wins on this floor's expected mix."
        : "Bomb of Plenty wins on this floor's expected mix.";
    }
    var breakpointMain = el("p", "bomb-breakpoint-main", line);
    breakpointMain.id = "bomb-breakpoint-main";
    bp.appendChild(breakpointMain);
    bp.appendChild(winnerStrip(floorRows.map(function (f, i) {
      return {
        n: f.info.floor,
        winner: f.result.winner,
        groupStart: i > 0 && f.info.zone !== floorRows[i - 1].info.zone,
        label: "Floor " + f.info.floor + " (" + mixLabel(f.info) + "): " + winnerName(f.result.winner) +
          (f.result.winner === "tie" ? "" : " by " + fmtMargin(f.result.advantage))
      };
    }), state.floor, "floor"));

    var detail;
    if (isFinite(result.transition) && result.transition > 0) {
      detail = "Breakpoint: " + fmtBreakpoint(result.transition) + " effective ore per bar";
      if (result.costMultiplier > 0 && Math.abs(result.costMultiplier - 1) > 1e-9) {
        detail += " (" + fmtBreakpoint(result.baseTransition) + " base ore per bar at " +
          fmtFactor(result.costMultiplier) + "x).";
      } else {
        detail += ".";
      }
    } else if (isFinite(result.transition)) {
      detail = "The breakpoint is at or below zero, outside the known bar costs.";
    } else {
      detail = "The breakpoint is above the most expensive known bar.";
    }
    bp.appendChild(el("p", "hint", detail));

    if (result.totalYield > 1 + 1e-9) {
      bp.appendChild(el("p", "hint",
        "Void portals add " + fmtPct(result.totalYield - 1) + " more ore before bomb effects."));
    }
    if (!(result.portal.chance > 0)) {
      bp.appendChild(el("p", "hint",
        "Set the portal chance above 0 to include Void Drone portals in this floor comparison."));
    } else if (result.portal.multi <= 1 + 1e-9) {
      bp.appendChild(el("p", "hint",
        "A portal multiplier of 1x makes portals a pure ore downgrade; they add no extra ore."));
    }
    root.appendChild(bp);
    root.appendChild(renderNativeRows(info, result));
  }

  function renderTable(result) {
    if (!nodes.table) return;
    nodes.table.innerHTML = "";

    var table = el("table", "bomb-table");
    table.appendChild(el("caption", null, "Expected bars from " + fmtInt(state.ore) + " base ore"));

    var thead = el("thead");
    var hr = el("tr");
    ["Level", "Bar", "Base cost", "Eff. cost", "BoP bars", "Trans bars", "Better", "Margin"]
      .forEach(function (label) { hr.appendChild(el("th", null, label)); });
    thead.appendChild(hr);
    table.appendChild(thead);

    var groups = [];
    var byWorld = {};
    result.rows.forEach(function (row) {
      var world = row.bar.world;
      if (!byWorld[world]) {
        byWorld[world] = { world: world, rows: [] };
        groups.push(byWorld[world]);
      }
      byWorld[world].rows.push(row);
    });

    groups.forEach(function (group) {
      var tbody = el("tbody", "bomb-world");
      tbody.id = "bomb-world-" + group.world;

      var first = group.rows[0];
      var last = group.rows[group.rows.length - 1];
      var worldRow = el("tr", "bomb-world-head");
      var worldHead = el("th");
      worldHead.colSpan = 8;
      worldHead.scope = "colgroup";
      worldHead.appendChild(el("span", "bomb-world-name", "World " + group.world));
      worldHead.appendChild(el("span", "bomb-world-meta",
        "Levels " + first.level + "-" + last.level + " · " + first.bar.name + " to " + last.bar.name +
        " · " + group.rows.length + " bars"));
      worldRow.appendChild(worldHead);
      tbody.appendChild(worldRow);

      group.rows.forEach(function (row) {
        var tr = el("tr");
        if (row.level === state.level) tr.className = "selected";

        tr.appendChild(el("td", "num", String(row.level)));
        tr.appendChild(el("td", "name", row.bar.name));
        tr.appendChild(el("td", "num", fmtInt(row.baseCost)));
        tr.appendChild(el("td", "num", fmtInt(row.effectiveCost)));
        tr.appendChild(el("td", "num", fmt(row.bopPerOre * state.ore)));
        tr.appendChild(el("td", "num", fmt(row.transPerOre * state.ore)));

        var winner = row.winner === "bop" ? "BoP" : row.winner === "trans" ? "Trans" : "Tie";
        tr.appendChild(el("td", "bomb-winner " + row.winner, winner));
        tr.appendChild(el("td", "num", row.winner === "tie" ? "-" : fmtMargin(row.advantage)));

        tbody.appendChild(tr);
      });

      table.appendChild(tbody);
    });
    nodes.table.appendChild(scrollWrap(table));

    var bopWins = 0;
    var transWins = 0;
    var ties = 0;
    result.rows.forEach(function (row) {
      if (row.winner === "bop") bopWins++;
      else if (row.winner === "trans") transWins++;
      else ties++;
    });

    if (nodes.tableSummary) {
      var parts = [];
      if (bopWins) parts.push(bopWins + " BoP");
      if (transWins) parts.push(transWins + " Transmuter");
      if (ties) parts.push(ties + " tie" + (ties === 1 ? "" : "s"));
      nodes.tableSummary.textContent = "Show all " + result.rows.length + " levels" +
        (parts.length ? " (" + parts.join(", ") + ")" : "");
    }
  }

  function renderFloorTable(floorRows) {
    if (!nodes.table) return;
    nodes.table.innerHTML = "";

    var table = el("table", "bomb-table bomb-floor-table");
    var portalText = state.portalChance > 0
      ? fmtFactor(state.portalChance) + "% portal chance at " + fmtFactor(state.portalMulti) + "x"
      : "portals off";
    table.appendChild(el("caption", null,
      "Expected bars from " + fmtInt(state.ore) + " native ore · " + portalText));

    var thead = el("thead");
    var hr = el("tr");
    ["Floor", "Native ores", "Portal yield", "Mix cost", "BoP bars", "Trans bars", "Better", "Margin"]
      .forEach(function (label) { hr.appendChild(el("th", null, label)); });
    thead.appendChild(hr);
    table.appendChild(thead);

    var bopWins = 0;
    var transWins = 0;
    var ties = 0;

    BD.FLOOR_ZONES.forEach(function (zone, zoneIndex) {
      var tbody = el("tbody", "bomb-world");
      tbody.id = "bomb-zone-" + (zoneIndex + 1);

      var first = BD.floorInfo(zone.startFloor);
      var last = BD.floorInfo(zone.endFloor);
      var zoneRow = el("tr", "bomb-world-head");
      var zoneHead = el("th");
      zoneHead.colSpan = 8;
      zoneHead.scope = "colgroup";
      zoneHead.appendChild(el("span", "bomb-world-name", "World " + zone.world + " - " + zone.name));
      zoneHead.appendChild(el("span", "bomb-world-meta",
        "Floors " + zone.startFloor + "-" + zone.endFloor + " · " +
        first.ores[0].bar.name + " to " + last.ores[1].bar.name + " · " +
        zone.floors + " floors"));
      zoneRow.appendChild(zoneHead);
      tbody.appendChild(zoneRow);

      for (var floor = zone.startFloor; floor <= zone.endFloor; floor++) {
        var info = floorRows[floor - 1].info;
        var mix = floorRows[floor - 1].mix;
        var result = floorRows[floor - 1].result;

        if (result.winner === "bop") bopWins++;
        else if (result.winner === "trans") transWins++;
        else ties++;

        var tr = el("tr");
        if (info.floor === state.floor) tr.className = "selected";
        tr.id = "bomb-floor-row-" + info.floor;

        tr.appendChild(el("td", "num", String(info.floor)));
        tr.appendChild(el("td", "name bomb-floor-ores", mixLabel(info)));
        tr.appendChild(el("td", "num", fmtFactor(mix.totalYield) + "x"));
        tr.appendChild(el("td", "num", fmtBreakpoint(result.mixCost)));
        tr.appendChild(el("td", "num", fmt(result.bopBarsPerBase * state.ore)));
        tr.appendChild(el("td", "num", fmt(result.transBarsPerBase * state.ore)));

        var winner = result.winner === "bop" ? "BoP" : result.winner === "trans" ? "Trans" : "Tie";
        tr.appendChild(el("td", "bomb-winner " + result.winner, winner));
        tr.appendChild(el("td", "num", result.winner === "tie" ? "-" : fmtMargin(result.advantage)));

        tbody.appendChild(tr);
      }

      table.appendChild(tbody);
    });

    nodes.table.appendChild(scrollWrap(table));

    if (nodes.tableSummary) {
      var parts = [];
      if (bopWins) parts.push(bopWins + " BoP");
      if (transWins) parts.push(transWins + " Transmuter");
      if (ties) parts.push(ties + " tie" + (ties === 1 ? "" : "s"));
      nodes.tableSummary.textContent = "Show all " + BD.FLOOR_COUNT + " floors" +
        (parts.length ? " (" + parts.join(", ") + ")" : "");
    }
  }

  // Every floor's mix and result, shared by the strip and the floor table.
  function floorRowsOf() {
    var rows = [];
    for (var floor = 1; floor <= BD.FLOOR_COUNT; floor++) {
      var info = BD.floorInfo(floor);
      var mix = BD.portalMix(info, state.portalChance, state.portalMulti);
      rows.push({ info: info, mix: mix, result: BD.analyseMix(state.values, mix) });
    }
    return rows;
  }

  function update() {
    if (!BD) return;
    var bar = BD.barByLevel(state.level) || BD.BARS[0];
    state.level = bar.level;

    if (state.mode === "floor") {
      var info = BD.floorInfo(state.floor) || BD.floorInfo(1);
      state.floor = info.floor;
      var floorResult = BD.analyseFloor(state.values, state.floor, state.portalChance, state.portalMulti);
      var floorRows = floorRowsOf();
      renderFloorNote(info, floorResult);
      renderFloorResults(floorResult, floorRows);
      renderFloorTable(floorRows);
    } else {
      var result = BD.analyse(state.values);
      var row = result.rows[bar.level - 1];
      renderLevelNote(bar, row, result);
      renderResults(bar, row, result);
      renderTable(result);
    }
    saveInputs();
  }

  /* ---------------------------------------------------------------- */
  /* init                                                             */
  /* ---------------------------------------------------------------- */

  function cacheNodes() {
    nodes.level = document.getElementById("bomb-level");
    nodes.levelField = document.getElementById("bomb-level-field");
    nodes.floor = document.getElementById("bomb-floor");
    nodes.floorField = document.getElementById("bomb-floor-field");
    nodes.portalChance = document.getElementById("bomb-portal-chance");
    nodes.portalChanceField = document.getElementById("bomb-portal-chance-field");
    nodes.portalMulti = document.getElementById("bomb-portal-multi");
    nodes.portalMultiField = document.getElementById("bomb-portal-multi-field");
    nodes.modeBar = document.getElementById("bomb-mode-bar");
    nodes.modeFloor = document.getElementById("bomb-mode-floor");
    nodes.modeNote = document.getElementById("bomb-mode-note");
    nodes.ore = document.getElementById("bomb-ore");
    nodes.oreLabel = document.getElementById("bomb-ore-label");
    nodes.results = document.getElementById("bomb-results");
    nodes.levelNote = document.getElementById("bomb-level-note");
    nodes.floorNote = document.getElementById("bomb-floor-note");
    nodes.stats = document.getElementById("bomb-stats");
    nodes.statsDetails = document.getElementById("bomb-stats-details");
    nodes.statsSource = document.getElementById("bomb-stats-source");
    nodes.statsWarning = document.getElementById("bomb-stats-warning");
    nodes.reload = document.getElementById("bomb-reload-account");
    nodes.reset = document.getElementById("bomb-reset-stats");
    nodes.table = document.getElementById("bomb-table");
    nodes.tableSummary = document.getElementById("bomb-table-summary");
    nodes.tableTitle = document.getElementById("bomb-table-title");
    nodes.tableLead = document.getElementById("bomb-table-lead");
  }

  function init() {
    if (!BD) return;
    cacheNodes();
    if (!nodes.results || !nodes.stats) return;

    renderLevelOptions();
    renderFloorOptions();
    renderStats();
    bindControls();
    syncModeUI();

    var saved = loadSaved();
    var acct = readAccount();
    var hasAccount = !!(acct && acct.stats);
    if (hasAccount) applyAccount(acct);
    else resetToDefaults(true);

    if (saved) {
      restoreSaved(saved, hasAccount);
      fillStatsInputs();
      fillContextInputs();
      syncModeUI();
      updateSourceNote();
      update();
    }
  }

  global.BombTool = {
    init: init,
    refreshAccount: refreshAccount,
    getState: function () {
      return {
        mode: state.mode,
        level: state.level,
        ore: state.ore,
        floor: state.floor,
        portalChance: state.portalChance,
        portalMulti: state.portalMulti,
        source: state.source,
        values: BD ? BD.normalizeValues(state.values) : {}
      };
    }
  };

})(typeof window !== "undefined" ? window : globalThis);
