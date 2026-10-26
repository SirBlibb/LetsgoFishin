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

  var state = {
    values: BD ? BD.defaults() : {},
    level: 1,
    ore: 1000,
    source: "defaults",
    account: null,
    applied: 0,
    missing: BD ? BD.FIELDS.length : 0
  };

  var nodes = {};

  /* ---------------------------------------------------------------- */
  /* helpers                                                          */
  /* ---------------------------------------------------------------- */

  var SUFFIX = ["", "k", "m", "b", "t", "qi", "sx", "sp", "oc", "no", "dc", "ud", "dd", "td"];

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
    state.values = mapped.values;
    state.source = "account";
    state.account = acct;
    state.applied = mapped.applied.length;
    state.missing = mapped.missing.length;
    if (state.missing > 0 && nodes.statsDetails) nodes.statsDetails.open = true;
    fillStatsInputs();
    updateSourceNote();
    update();
  }

  function resetToDefaults() {
    state.values = BD.defaults();
    state.source = "defaults";
    state.account = null;
    state.applied = 0;
    state.missing = BD.FIELDS.length;
    if (nodes.statsDetails) nodes.statsDetails.open = true;
    fillStatsInputs();
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
      resetToDefaults();
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

  function bindControls() {
    if (nodes.level) {
      nodes.level.addEventListener("change", function () {
        state.level = parseInt(nodes.level.value, 10) || 1;
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
      nodes.reset.addEventListener("click", function () { resetToDefaults(); });
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
    nodes.levelNote.textContent = note;
  }

  function bombCard(kind, title, total, details, winner) {
    var card = el("article", "bomb-card" + (winner === kind ? " winner" : ""));
    card.id = "bomb-" + kind + "-card";

    var head = el("div", "bomb-card-head");
    head.appendChild(el("h3", "bomb-card-title", title));
    if (winner === kind) head.appendChild(el("span", "bomb-chip", "Winner"));
    card.appendChild(head);

    var figure = el("div", "bomb-figure", fmt(total));
    figure.id = "bomb-" + kind + "-bars";
    card.appendChild(figure);
    card.appendChild(el("div", "bomb-figure-note", "bars from " + fmtInt(state.ore) + " base ore"));

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
        fmtPct(row.advantage) + " more bars at " + bar.name + " (level " + bar.level + ").";
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
      ["Craft multiplier", fmt(result.craftMultiplier) + "x"],
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
    if (Math.abs(result.costMultiplier - 1) > 1e-9) {
      bp.appendChild(el("p", "hint",
        "Effective cost is rounded down after the craft-cost multiplier, so a level right at the breakpoint can differ from the unrounded estimate."));
    }
    root.appendChild(bp);
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
        tr.appendChild(el("td", "num", row.winner === "tie" ? "-" : fmtPct(row.advantage)));

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

  function update() {
    if (!BD) return;
    var result = BD.analyse(state.values);
    var bar = BD.barByLevel(state.level) || BD.BARS[0];
    state.level = bar.level;
    var row = result.rows[bar.level - 1];

    renderLevelNote(bar, row, result);
    renderResults(bar, row, result);
    renderTable(result);
  }

  /* ---------------------------------------------------------------- */
  /* init                                                             */
  /* ---------------------------------------------------------------- */

  function cacheNodes() {
    nodes.level = document.getElementById("bomb-level");
    nodes.ore = document.getElementById("bomb-ore");
    nodes.results = document.getElementById("bomb-results");
    nodes.levelNote = document.getElementById("bomb-level-note");
    nodes.stats = document.getElementById("bomb-stats");
    nodes.statsDetails = document.getElementById("bomb-stats-details");
    nodes.statsSource = document.getElementById("bomb-stats-source");
    nodes.statsWarning = document.getElementById("bomb-stats-warning");
    nodes.reload = document.getElementById("bomb-reload-account");
    nodes.reset = document.getElementById("bomb-reset-stats");
    nodes.table = document.getElementById("bomb-table");
    nodes.tableSummary = document.getElementById("bomb-table-summary");
  }

  function init() {
    if (!BD) return;
    cacheNodes();
    if (!nodes.results || !nodes.stats) return;

    renderLevelOptions();
    renderStats();
    bindControls();

    var acct = readAccount();
    if (acct && acct.stats) {
      applyAccount(acct);
    } else {
      state.values = BD.defaults();
      state.source = "defaults";
      state.applied = 0;
      state.missing = BD.FIELDS.length;
      if (nodes.statsDetails) nodes.statsDetails.open = true;
      updateSourceNote();
      update();
    }
  }

  global.BombTool = {
    init: init,
    refreshAccount: refreshAccount,
    getState: function () {
      return {
        level: state.level,
        ore: state.ore,
        source: state.source,
        values: BD ? BD.normalizeValues(state.values) : {}
      };
    }
  };

})(typeof window !== "undefined" ? window : globalThis);
