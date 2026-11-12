/*
 * Tracker page UI.
 *
 * Depends on:
 *   trackerdata.js  (window.TrackerData)
 *   account.js      (window.AccountStore)
 *   app.js exposes window.ObeliskApp.loadAccountRecord for "Use this snapshot".
 *
 * Exposed as window.TrackerTool so app.js can initialise it and record imports.
 */
(function (global) {
  "use strict";

  var TD = global.TrackerData;
  var ACCOUNT = global.AccountStore || null;

  if (!TD) {
    global.TrackerTool = {
      init: function () {},
      recordImport: function () { return Promise.resolve({ error: "Tracker data is unavailable." }); },
      refreshAccount: function () {},
      getState: function () { return { ready: false, snapshots: 0 }; }
    };
    return;
  }

  var state = {
    snapshots: [],
    size: 0,
    mode: "loading",
    warning: "",
    notice: "",
    noticeKind: "ok",
    pins: TD.HEADLINE.slice(),
    selected: ["obelisk_level"],
    range: "all",
    scale: "auto",
    editingId: null,
    ready: false
  };

  var store = null;
  var nodes = {};
  var initPromise = null;
  var seededThisSession = false;

  /* ---------------------------------------------------------------- */
  /* helpers                                                          */
  /* ---------------------------------------------------------------- */

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt !== undefined) e.textContent = txt;
    return e;
  }

  function svgEl(tag, attrs) {
    var e = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
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

  function isString(v) { return typeof v === "string" && v !== ""; }

  function uniqueStrings(list) {
    var out = [];
    (list || []).forEach(function (v) {
      if (isString(v) && out.indexOf(v) < 0) out.push(v);
    });
    return out;
  }

  function formatCount(v) {
    if (v === null || v === undefined || !isFinite(v)) return "-";
    if (Math.abs(v - Math.round(v)) < 1e-9) return Math.round(v).toLocaleString("en-US");
    return TD.formatValue(v);
  }

  /* ---------------------------------------------------------------- */
  /* preferences                                                      */
  /* ---------------------------------------------------------------- */

  function loadPrefs() {
    var storage = getStorage();
    if (!storage) return;
    var saved = null;
    try { saved = JSON.parse(storage.getItem(TD.PREFS_KEY) || "null"); } catch (e) { saved = null; }
    if (!saved || typeof saved !== "object") return;

    if (Array.isArray(saved.pins)) state.pins = uniqueStrings(saved.pins).slice(0, 60);
    if (Array.isArray(saved.selected)) state.selected = uniqueStrings(saved.selected).slice(0, 12);
    if (["all", "30d", "90d", "365d"].indexOf(saved.range) >= 0) state.range = saved.range;
    if (["auto", "linear", "log"].indexOf(saved.scale) >= 0) state.scale = saved.scale;
  }

  function savePrefs() {
    var storage = getStorage();
    if (!storage) return;
    try {
      storage.setItem(TD.PREFS_KEY, JSON.stringify({
        pins: state.pins,
        selected: state.selected,
        range: state.range,
        scale: state.scale
      }));
    } catch (e) { /* storage full or blocked */ }
  }

  function setNotice(message, kind) {
    state.notice = message || "";
    state.noticeKind = kind === "warn" ? "warn" : "ok";
  }

  function markSeeded() {
    seededThisSession = true;
    var storage = getStorage();
    if (!storage) return;
    try { storage.setItem(TD.SEEDED_KEY, "1"); } catch (e) { /* ignored */ }
  }

  function hasSeeded() {
    if (seededThisSession) return true;
    var storage = getStorage();
    if (!storage) return false;
    try { return storage.getItem(TD.SEEDED_KEY) === "1"; } catch (e) { return false; }
  }

  /* ---------------------------------------------------------------- */
  /* nodes + init                                                     */
  /* ---------------------------------------------------------------- */

  function cacheNodes() {
    nodes.status = document.getElementById("tracker-status");
    nodes.banner = document.getElementById("tracker-banner");
    nodes.chips = document.getElementById("tracker-chips");
    nodes.search = document.getElementById("tracker-search");
    nodes.metricList = document.getElementById("tracker-metric-list");
    nodes.add = document.getElementById("tracker-add-metric");
    nodes.range = document.getElementById("tracker-range");
    nodes.scale = document.getElementById("tracker-scale");
    nodes.clearSelection = document.getElementById("tracker-clear-selection");
    nodes.note = document.getElementById("tracker-chart-note");
    nodes.chart = document.getElementById("tracker-chart");
    nodes.legend = document.getElementById("tracker-legend");
    nodes.snapshotsDetails = document.getElementById("tracker-snapshots-details");
    nodes.snapshotsSummary = document.getElementById("tracker-snapshots-summary");
    nodes.snapshots = document.getElementById("tracker-snapshots");
    nodes.download = document.getElementById("tracker-download");
    nodes.importBtn = document.getElementById("tracker-import");
    nodes.importFile = document.getElementById("tracker-import-file");
    nodes.clear = document.getElementById("tracker-clear");
    nodes.homeBadge = document.getElementById("tracker-badge");
    nodes.homeNote = document.getElementById("tracker-account-note");
    return !!nodes.chart;
  }

  function setSnapshots(list) {
    state.snapshots = list || [];
    state.size = TD.totalSize(state.snapshots);
  }

  function init() {
    if (initPromise) return initPromise;
    var hasUi = cacheNodes();
    loadPrefs();
    store = TD.createStore();

    if (hasUi) {
      bindControls();
      render();
    }

    var sync = store.loadSync ? store.loadSync() : null;
    if (sync) {
      initPromise = Promise.resolve(applyLoaded(sync));
      return initPromise;
    }

    initPromise = store.load().then(function (res) {
      return applyLoaded(res);
    }).catch(function (error) {
      state.ready = true;
      state.mode = "memory";
      state.warning = "Could not load snapshot history: " + (error && error.message ? error.message : error);
      if (hasUi) render();
      refreshHomeCard();
      return false;
    });
    return initPromise;
  }

  function applyLoaded(res) {
    setSnapshots(res && res.snapshots ? res.snapshots : []);
    state.mode = res && res.mode ? res.mode : "memory";
    state.warning = res && res.warning ? res.warning : "";
    state.ready = true;
    ensureSelection();
    if (nodes.chart) render();
    refreshHomeCard();
    return seedIfNeeded();
  }

  function ensureSelection() {
    if (!state.snapshots.length) {
      savePrefs();
      return;
    }
    var catalog = TD.buildMetricCatalog(state.snapshots);
    var available = {};
    catalog.forEach(function (m) { available[m.key] = true; });

    state.selected = state.selected.filter(function (key) { return available[key]; });

    if (!state.selected.length) {
      var fallback = null;
      for (var i = 0; i < state.pins.length; i++) {
        if (available[state.pins[i]]) { fallback = state.pins[i]; break; }
      }
      if (!fallback && catalog.length) fallback = catalog[0].key;
      if (fallback) state.selected = [fallback];
    }

    state.selected.forEach(function (key) {
      if (state.pins.indexOf(key) < 0) state.pins.push(key);
    });
    savePrefs();
  }

  /* ---------------------------------------------------------------- */
  /* seeding                                                          */
  /* ---------------------------------------------------------------- */

  function seedIfNeeded() {
    if (hasSeeded()) return Promise.resolve(false);
    if (state.snapshots.length) return Promise.resolve(false);
    var record = ACCOUNT ? ACCOUNT.load() : null;
    if (!record || !record.raw || TD.isSampleSource(record.source)) return Promise.resolve(false);
    var parsed = TD.parseRaw(record.raw);
    if (!parsed) return Promise.resolve(false);

    var snap = TD.makeSnapshot(parsed, {
      raw: record.raw,
      source: "seeded from saved account",
      applied: record.applied,
      missing: record.missing,
      importedAt: record.importedAt || new Date().toISOString(),
      seeded: true
    });
    if (!snap) return Promise.resolve(false);

    return store.add(snap).then(function (result) {
      if (result && !result.error) {
        setSnapshots(store.getCached());
        state.mode = store.getMode();
        state.warning = store.getWarning();
        markSeeded();
        ensureSelection();
        setNotice("Seeded the first snapshot from your saved account. Future imports add new snapshots automatically.", "ok");
        if (nodes.chart) render();
        refreshHomeCard();
        return true;
      }
      if (result && result.error) {
        state.warning = result.error;
        if (nodes.chart) render();
      }
      return false;
    }).catch(function () { return false; });
  }

  /* ---------------------------------------------------------------- */
  /* import recording                                                 */
  /* ---------------------------------------------------------------- */

  function finishAdd(result) {
    if (result && !result.error) {
      state.notice = "";
      setSnapshots(store.getCached());
      state.mode = store.getMode();
      state.warning = store.getWarning();
      ensureSelection();
      if (nodes.chart) render();
      refreshHomeCard();
      dispatchChange();
    } else if (result && result.error) {
      state.warning = result.error;
      if (nodes.chart) render();
    }
    return result;
  }

  function recordImport(parsed, res, rawText, source) {
    if (TD.isSampleSource(source)) return Promise.resolve({ skipped: true, reason: "sample" });
    var snap = TD.makeSnapshot(parsed, {
      raw: rawText,
      source: source,
      applied: res && res.applied ? res.applied.length : 0,
      missing: res && res.missing ? res.missing.length : 0,
      importedAt: new Date().toISOString()
    });
    if (!snap) return Promise.resolve({ error: "The export did not contain usable stats." });

    if (state.ready && store && store.canSync && store.canSync()) {
      var immediate = store.addSync ? store.addSync(snap) : null;
      if (immediate) return Promise.resolve(finishAdd(immediate));
    }

    var ready = initPromise || init();
    return ready.then(function () {
      if (!store) return { error: "Tracker storage is unavailable." };
      var sync = store.addSync ? store.addSync(snap) : null;
      if (sync) return finishAdd(sync);
      return store.add(snap).then(finishAdd);
    }).catch(function (error) {
      return { error: error && error.message ? error.message : "Could not save the snapshot." };
    });
  }

  function dispatchChange() {
    if (typeof global.dispatchEvent !== "function") return;
    try {
      global.dispatchEvent(new global.CustomEvent("obelisk-tracker-change"));
    } catch (e) { /* ignored */ }
  }

  function refreshAccount() {
    if (!state.ready) return;
    if (nodes.chart) render();
    refreshHomeCard();
  }

  /* ---------------------------------------------------------------- */
  /* snapshots                                                        */
  /* ---------------------------------------------------------------- */

  function findSnapshot(id) {
    for (var i = 0; i < state.snapshots.length; i++) {
      if (state.snapshots[i].id === id) return state.snapshots[i];
    }
    return null;
  }

  function useSnapshot(id) {
    var snap = findSnapshot(id);
    if (!snap) return;

    var exportedAt = snap.exportedAt !== null ? snap.exportedAt : new Date(snap.timeMs).toISOString();
    var record = {
      raw: snap.raw,
      source: "tracker snapshot",
      version: snap.version,
      exportedAt: exportedAt,
      importedAt: new Date().toISOString(),
      applied: snap.applied,
      missing: snap.missing
    };

    var loaded = false;
    if (global.ObeliskApp && typeof global.ObeliskApp.loadAccountRecord === "function") {
      loaded = global.ObeliskApp.loadAccountRecord(record);
    }
    if (!loaded) {
      if (ACCOUNT) ACCOUNT.save(record);
      if (global.BombTool) global.BombTool.refreshAccount();
      if (global.GoalTool) global.GoalTool.refreshAccount();
      if (global.ContractTool) global.ContractTool.refreshAccount();
    }

    setNotice("Loaded the " + TD.formatTimeMs(snap.timeMs, false) + " snapshot into the tools.", "ok");
    render();
    refreshHomeCard();
  }

  function saveDate(id, value) {
    var ms = TD.fromDateInputValue(value);
    if (ms === null) {
      setNotice("Enter a valid date and time.", "warn");
      renderBanner();
      return;
    }
    store.update(id, { timeMs: ms, timeEdited: true, timeSource: "manual" }).then(function (result) {
      if (result && result.error) {
        setNotice(result.error, "warn");
        renderBanner();
        return;
      }
      setSnapshots(store.getCached());
      state.editingId = null;
      setNotice("Snapshot date updated.", "ok");
      render();
      refreshHomeCard();
      dispatchChange();
    });
  }

  function deleteSnapshot(id) {
    var snap = findSnapshot(id);
    var label = snap ? TD.formatTimeMs(snap.timeMs, false) : "this snapshot";
    if (typeof global.confirm === "function" &&
        !global.confirm("Delete the snapshot from " + label + "? The active account is not affected.")) {
      return;
    }
    store.remove(id).then(function (result) {
      if (result && result.error) {
        setNotice(result.error, "warn");
        renderBanner();
        return;
      }
      setSnapshots(store.getCached());
      setNotice("Snapshot deleted.", "ok");
      render();
      refreshHomeCard();
      dispatchChange();
    });
  }

  function clearHistory() {
    if (!state.snapshots.length) return;
    if (typeof global.confirm === "function" &&
        !global.confirm("Clear all " + state.snapshots.length +
          " snapshots? Your active account and the other tools are not affected.")) {
      return;
    }
    store.clear().then(function (result) {
      if (result && result.error) {
        setNotice(result.error, "warn");
        renderBanner();
        return;
      }
      markSeeded();
      setSnapshots([]);
      state.editingId = null;
      setNotice("Snapshot history cleared. The active account was kept.", "ok");
      render();
      refreshHomeCard();
      dispatchChange();
    });
  }

  /* ---------------------------------------------------------------- */
  /* download / import history                                        */
  /* ---------------------------------------------------------------- */

  function downloadHistory() {
    if (!state.snapshots.length) return;
    var text = JSON.stringify(TD.bundle(state.snapshots), null, 2);
    try {
      if (typeof global.Blob !== "function" || !global.URL || typeof global.URL.createObjectURL !== "function") {
        throw new Error("Download is not available in this browser.");
      }
      var blob = new global.Blob([text], { type: "application/json" });
      var url = global.URL.createObjectURL(blob);
      var link = document.createElement("a");
      link.href = url;
      link.download = "obelisk-tracker-" + new Date().toISOString().slice(0, 10) + ".json";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(function () { global.URL.revokeObjectURL(url); }, 1000);
      setNotice("History downloaded.", "ok");
    } catch (e) {
      setNotice("Could not download the history: " + e.message, "warn");
    }
    renderBanner();
  }

  function importHistoryFile(file) {
    if (!file) return;
    var reader = new global.FileReader();
    reader.onload = function () {
      var parsed = TD.parseBundle(reader.result);
      if (!parsed.snapshots.length) {
        setNotice(parsed.error || "No valid snapshots found in that file.", "warn");
        renderBanner();
        return;
      }
      store.merge(parsed.snapshots).then(function (result) {
        if (result && result.error) {
          setNotice(result.error, "warn");
          renderBanner();
          return;
        }
        setSnapshots(store.getCached());
        state.mode = store.getMode();
        state.warning = store.getWarning();
        ensureSelection();
        setNotice("Imported " + result.added + " new, " + result.skipped +
          " unchanged, " + result.replaced + " replaced" +
          (parsed.invalid ? ", " + parsed.invalid + " invalid" : "") + ".", "ok");
        render();
        refreshHomeCard();
        dispatchChange();
      });
    };
    reader.readAsText(file);
    if (nodes.importFile) nodes.importFile.value = "";
  }

  /* ---------------------------------------------------------------- */
  /* rendering                                                        */
  /* ---------------------------------------------------------------- */

  function render() {
    if (!nodes.chart) return;
    renderStatus();
    renderBanner();
    renderMetricOptions();
    renderGraph();
    renderSnapshots();
  }

  function modeLabel() {
    if (state.mode === "indexeddb") return "IndexedDB";
    if (state.mode === "local") return "local storage";
    return "session only";
  }

  function renderStatus() {
    if (!nodes.status) return;
    if (!state.ready) {
      nodes.status.textContent = "Loading snapshot history...";
      return;
    }
    if (!state.snapshots.length) {
      nodes.status.textContent = "No snapshots yet. Import an ExportStats JSON on the home page.";
      return;
    }
    var latest = state.snapshots[state.snapshots.length - 1];
    nodes.status.textContent = state.snapshots.length +
      (state.snapshots.length === 1 ? " snapshot" : " snapshots") +
      " · latest " + TD.formatTimeMs(latest.timeMs, false) +
      " · " + modeLabel() + " · ≈ " + TD.formatSize(state.size);
  }

  function renderBanner() {
    if (!nodes.banner) return;
    var message = state.warning || state.notice;
    nodes.banner.hidden = !message;
    nodes.banner.textContent = message || "";
    nodes.banner.className = "tracker-banner" +
      (message ? (state.warning || state.noticeKind === "warn" ? " warn" : " ok") : "");
  }

  function renderMetricOptions() {
    if (!nodes.metricList) return;
    nodes.metricList.innerHTML = "";
    TD.buildMetricCatalog(state.snapshots).forEach(function (metric) {
      var option = el("option");
      option.value = metric.label + " · " + metric.group;
      option.label = metric.label;
      nodes.metricList.appendChild(option);
    });
  }

  function findMetric(query) {
    var q = String(query || "").trim().toLowerCase();
    if (!q) return null;
    var catalog = TD.buildMetricCatalog(state.snapshots);
    var starts = null;
    var contains = null;
    for (var i = 0; i < catalog.length; i++) {
      var metric = catalog[i];
      var key = metric.key.toLowerCase();
      var label = metric.label.toLowerCase();
      var option = (metric.label + " · " + metric.group).toLowerCase();
      if (q === key || q === label || q === option) return metric;
      if (!starts && (label.indexOf(q) === 0 || key.indexOf(q) === 0)) starts = metric;
      if (!contains && (label.indexOf(q) >= 0 || key.indexOf(q) >= 0)) contains = metric;
    }
    return starts || contains;
  }

  function addMetric() {
    var query = nodes.search ? nodes.search.value : "";
    var metric = findMetric(query);
    if (!metric) {
      setNotice("No stat matched \"" + String(query).trim() + "\".", "warn");
      renderBanner();
      return;
    }
    if (state.pins.indexOf(metric.key) < 0) state.pins.push(metric.key);
    if (state.selected.indexOf(metric.key) < 0) state.selected.push(metric.key);
    if (nodes.search) nodes.search.value = "";
    state.notice = "";
    savePrefs();
    render();
  }

  function toggleSelected(key) {
    var index = state.selected.indexOf(key);
    if (index >= 0) {
      state.selected.splice(index, 1);
    } else {
      state.selected.push(key);
      if (state.pins.indexOf(key) < 0) state.pins.push(key);
    }
    savePrefs();
    renderGraph();
  }

  function unpin(key) {
    state.pins = state.pins.filter(function (k) { return k !== key; });
    state.selected = state.selected.filter(function (k) { return k !== key; });
    savePrefs();
    renderGraph();
  }

  function isSelected(key) {
    return state.selected.indexOf(key) >= 0;
  }

  function latestMetricValue(key) {
    for (var i = state.snapshots.length - 1; i >= 0; i--) {
      var value = TD.getMetricValue(state.snapshots[i].stats, key);
      if (value !== null) return value;
    }
    return null;
  }

  function renderGraph() {
    renderChips();
    renderChart();
  }

  function renderChips() {
    if (!nodes.chips) return;
    nodes.chips.innerHTML = "";

    var catalog = TD.buildMetricCatalog(state.snapshots);
    var byKey = {};
    catalog.forEach(function (metric) { byKey[metric.key] = metric; });

    var pins = state.pins.slice();
    pins.forEach(function (key) {
      var metric = byKey[key];
      var label = metric ? metric.label : TD.labelFor(key);
      var value = latestMetricValue(key);
      var chip = el("span", "tracker-chip" + (isSelected(key) ? " selected" : ""));
      var main = el("button", "tracker-chip-main");
      main.type = "button";
      main.setAttribute("aria-pressed", isSelected(key) ? "true" : "false");
      main.title = isSelected(key) ? "Remove from the chart" : "Chart this stat";
      main.appendChild(el("span", "tracker-chip-label", label));
      main.appendChild(el("span", "tracker-chip-value", value === null ? "—" : TD.formatValue(value)));
      main.addEventListener("click", function () { toggleSelected(key); });
      chip.appendChild(main);

      var unpinButton = el("button", "tracker-chip-pin", "×");
      unpinButton.type = "button";
      unpinButton.title = "Unpin " + label;
      unpinButton.addEventListener("click", function () { unpin(key); });
      chip.appendChild(unpinButton);
      nodes.chips.appendChild(chip);
    });
  }

  function emptyChart(title, detail) {
    nodes.chart.innerHTML = "";
    var box = el("div", "tracker-empty");
    box.appendChild(el("p", null, title));
    if (detail) box.appendChild(el("p", "hint", detail));
    nodes.chart.appendChild(box);
    if (nodes.legend) nodes.legend.innerHTML = "";
    if (nodes.note) nodes.note.textContent = "";
  }

  function renderChart() {
    if (!nodes.chart) return;
    if (!state.ready) {
      emptyChart("Loading snapshot history...", "The chart appears once the tracker opens its local database.");
      return;
    }
    if (!state.snapshots.length) {
      emptyChart("No snapshots yet.", "Import your ExportStats JSON on the Home page. Every successful import is recorded here automatically.");
      return;
    }
    if (!state.selected.length) {
      emptyChart("Pick a stat above.", "Click a quick-pick chip or search the full export field list.");
      return;
    }

    var model = TD.chartModel(state.snapshots, state.selected, {
      range: state.range,
      scale: state.scale
    });

    if (model.empty) {
      emptyChart("No values in this range.", "Choose a different range, or import another export.");
      return;
    }

    var distinctX = {};
    model.series.forEach(function (series) {
      series.points.forEach(function (point) { distinctX[point.x] = true; });
    });
    var notes = [];
    if (model.normalize) notes.push("Multiple stats are normalized to their first value = 100%.");
    if (model.scale === "log") notes.push("Log scale.");
    if (model.warning) notes.push(model.warning);
    if (Object.keys(distinctX).length === 1) {
      notes.push("Only one snapshot in this range; import another export to see a trend.");
    }
    if (model.normalize) notes.push("Hover the chart to see raw values.");
    if (nodes.note) nodes.note.textContent = notes.join(" ");

    if (typeof document.createElementNS !== "function") {
      emptyChart("This browser cannot draw the graph.", "The snapshot table below still records every import.");
      return;
    }

    var W = 860;
    var H = 380;
    var margin = { left: 70, right: 20, top: 18, bottom: 46 };
    var plotW = W - margin.left - margin.right;
    var plotH = H - margin.top - margin.bottom;

    function xPos(value) {
      return margin.left + ((value - model.xMin) / (model.xMax - model.xMin)) * plotW;
    }
    function yPos(value) {
      if (model.scale === "log") {
        var low = Math.log(model.yMin) / Math.LN10;
        var high = Math.log(model.yMax) / Math.LN10;
        return margin.top + ((high - Math.log(value) / Math.LN10) / (high - low)) * plotH;
      }
      return margin.top + ((model.yMax - value) / (model.yMax - model.yMin)) * plotH;
    }

    var wrap = el("div", "tracker-chart-wrap");
    var svg = svgEl("svg", {
      viewBox: "0 0 " + W + " " + H,
      "class": "tracker-svg",
      role: "img",
      "aria-label": model.series.map(function (s) { return s.label; }).join(", ") + " over time"
    });

    model.yTicks.forEach(function (tick) {
      var y = yPos(tick);
      if (y < margin.top - 1 || y > margin.top + plotH + 1) return;
      svg.appendChild(svgEl("line", {
        x1: margin.left, y1: y, x2: margin.left + plotW, y2: y,
        stroke: "#2b3340", "stroke-width": 1
      }));
      var label = svgEl("text", {
        x: margin.left - 10, y: y + 4, fill: "#8b98a5",
        "font-size": 11, "text-anchor": "end"
      });
      label.textContent = model.normalize ? TD.formatIndex(tick) : TD.formatValue(tick);
      svg.appendChild(label);
    });

    model.xTicks.forEach(function (tick) {
      var x = xPos(tick.value);
      svg.appendChild(svgEl("line", {
        x1: x, y1: margin.top, x2: x, y2: margin.top + plotH,
        stroke: "#2b3340", "stroke-width": 1, "stroke-dasharray": "2 4"
      }));
      var label = svgEl("text", {
        x: x, y: H - 20, fill: "#8b98a5",
        "font-size": 11, "text-anchor": "middle"
      });
      label.textContent = tick.label;
      svg.appendChild(label);
    });

    svg.appendChild(svgEl("line", {
      x1: margin.left, y1: margin.top + plotH,
      x2: margin.left + plotW, y2: margin.top + plotH,
      stroke: "#2b3340", "stroke-width": 1
    }));
    svg.appendChild(svgEl("line", {
      x1: margin.left, y1: margin.top,
      x2: margin.left, y2: margin.top + plotH,
      stroke: "#2b3340", "stroke-width": 1
    }));

    model.series.forEach(function (series) {
      var path = series.points.map(function (point, index) {
        return (index ? "L" : "M") + xPos(point.x).toFixed(1) + " " + yPos(point.y).toFixed(1);
      }).join(" ");
      svg.appendChild(svgEl("path", {
        d: path, fill: "none", stroke: series.color,
        "stroke-width": 2.2, "stroke-linejoin": "round", "stroke-linecap": "round"
      }));
      if (series.points.length <= 60) {
        series.points.forEach(function (point) {
          svg.appendChild(svgEl("circle", {
            cx: xPos(point.x), cy: yPos(point.y), r: 3,
            fill: "#0d1117", stroke: series.color, "stroke-width": 2
          }));
        });
      }
    });

    var hoverLine = svgEl("line", {
      x1: margin.left, y1: margin.top, x2: margin.left, y2: margin.top + plotH,
      stroke: "#8b98a5", "stroke-width": 1, "stroke-dasharray": "3 4", opacity: 0
    });
    svg.appendChild(hoverLine);

    var tooltip = el("div", "tracker-tooltip");
    tooltip.hidden = true;
    wrap.appendChild(svg);
    wrap.appendChild(tooltip);
    nodes.chart.innerHTML = "";
    nodes.chart.appendChild(wrap);

    function hideTooltip() {
      tooltip.hidden = true;
      hoverLine.setAttribute("opacity", 0);
    }

    svg.addEventListener("mousemove", function (event) {
      if (typeof svg.getBoundingClientRect !== "function") return;
      var rect = svg.getBoundingClientRect();
      if (!rect || !rect.width) return;
      var pointerX = ((event.clientX - rect.left) / rect.width) * W;
      if (pointerX < margin.left || pointerX > margin.left + plotW) {
        hideTooltip();
        return;
      }

      var targetTime = model.xMin + ((pointerX - margin.left) / plotW) * (model.xMax - model.xMin);
      var nearest = null;
      model.series.forEach(function (series) {
        series.points.forEach(function (point) {
          if (nearest === null || Math.abs(point.x - targetTime) < Math.abs(nearest - targetTime)) {
            nearest = point.x;
          }
        });
      });
      if (nearest === null) {
        hideTooltip();
        return;
      }

      var x = xPos(nearest);
      hoverLine.setAttribute("x1", x);
      hoverLine.setAttribute("x2", x);
      hoverLine.setAttribute("opacity", 1);

      tooltip.innerHTML = "";
      tooltip.appendChild(el("div", "tracker-tooltip-date", TD.formatTimeMs(nearest, false)));
      model.series.forEach(function (series) {
        var point = null;
        series.points.forEach(function (p) { if (p.x === nearest) point = p; });
        if (!point) return;
        var row = el("div", "tracker-tooltip-row");
        var label = el("span", "tracker-tooltip-label", series.label);
        var value = el("span", "tracker-tooltip-value",
          model.normalize
            ? TD.formatIndex(point.y) + " (" + TD.formatValue(point.raw) + ")"
            : TD.formatValue(point.y));
        value.style.color = series.color;
        row.appendChild(label);
        row.appendChild(value);
        tooltip.appendChild(row);
      });
      tooltip.hidden = false;

      var left = (event.clientX - rect.left) + 12;
      var top = (event.clientY - rect.top) + 12;
      if (typeof wrap.getBoundingClientRect === "function") {
        var wrapRect = wrap.getBoundingClientRect();
        if (wrapRect.width && left + 230 > wrapRect.width) left -= 250;
      }
      tooltip.style.left = Math.max(0, left) + "px";
      tooltip.style.top = Math.max(0, top) + "px";
    });

    svg.addEventListener("mouseleave", hideTooltip);

    renderLegend(model);
  }

  function renderLegend(model) {
    if (!nodes.legend) return;
    nodes.legend.innerHTML = "";
    model.series.forEach(function (series) {
      var item = el("span", "tracker-legend-item");
      var swatch = el("span", "tracker-legend-swatch");
      swatch.style.background = series.color;
      item.appendChild(swatch);
      item.appendChild(el("span", null, series.label));
      nodes.legend.appendChild(item);
    });
  }

  function renderSnapshots() {
    if (!nodes.snapshots) return;
    var count = state.snapshots.length;
    if (nodes.snapshotsSummary) {
      nodes.snapshotsSummary.textContent = count
        ? count + (count === 1 ? " snapshot" : " snapshots") + " · ≈ " + TD.formatSize(state.size)
        : "No snapshots yet";
    }
    if (nodes.download) nodes.download.disabled = !count;
    if (nodes.clear) nodes.clear.disabled = !count;

    nodes.snapshots.innerHTML = "";
    if (!count) {
      nodes.snapshots.appendChild(el("p", "hint",
        "No snapshots recorded yet. Import an ExportStats JSON on the Home page; every successful import becomes a dated snapshot."));
      return;
    }

    var activeId = TD.activeSnapshotId(state.snapshots, ACCOUNT ? ACCOUNT.load() : null);
    var table = el("table", "results-table tracker-snapshots-table");
    var thead = el("thead");
    var headRow = el("tr");
    ["Date", "Version", "Source", "OB", "Floor", "Actions"].forEach(function (label) {
      headRow.appendChild(el("th", null, label));
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = el("tbody");
    state.snapshots.slice().reverse().forEach(function (snap) {
      var row = el("tr");
      if (snap.id === activeId) row.className = "active";

      var dateCell = el("td");
      if (state.editingId === snap.id) {
        var editor = el("div", "tracker-edit-date");
        var input = el("input");
        input.type = "datetime-local";
        input.value = TD.toDateInputValue(snap.timeMs);
        var save = el("button", "ghost", "Save");
        save.type = "button";
        save.addEventListener("click", function () { saveDate(snap.id, input.value); });
        var cancel = el("button", "ghost", "Cancel");
        cancel.type = "button";
        cancel.addEventListener("click", function () {
          state.editingId = null;
          renderSnapshots();
        });
        editor.appendChild(input);
        editor.appendChild(save);
        editor.appendChild(cancel);
        dateCell.appendChild(editor);
      } else {
        dateCell.appendChild(el("span", null, TD.formatTimeMs(snap.timeMs, false)));
        if (snap.timeEdited) dateCell.appendChild(el("span", "tracker-date-edited", "edited"));
        if (snap.id === activeId) {
          var badge = el("span", "badge ok", "Active");
          badge.style.marginLeft = "6px";
          dateCell.appendChild(badge);
        }
      }
      row.appendChild(dateCell);

      row.appendChild(el("td", null, snap.version || "?"));
      var sourceText = snap.seeded ? "Seeded from saved account" : (snap.source || "imported JSON");
      var sourceCell = el("td", "tracker-source", sourceText);
      sourceCell.title = sourceText;
      row.appendChild(sourceCell);

      var obelisk = TD.getMetricValue(snap.stats, "obelisk_level");
      var floor = TD.getMetricValue(snap.stats, "current_floor");
      row.appendChild(el("td", null, formatCount(obelisk)));
      row.appendChild(el("td", null, formatCount(floor)));

      var actions = el("td", "actions");
      var actionsWrap = el("div", "tracker-snapshot-actions");

      var use = el("button", "ghost", "Use");
      use.type = "button";
      use.disabled = snap.id === activeId;
      use.title = use.disabled ? "Already the active account" : "Load this snapshot into the tools";
      use.addEventListener("click", function () { useSnapshot(snap.id); });
      actionsWrap.appendChild(use);

      var edit = el("button", "ghost", "Edit date");
      edit.type = "button";
      edit.addEventListener("click", function () {
        state.editingId = snap.id;
        renderSnapshots();
      });
      actionsWrap.appendChild(edit);

      var remove = el("button", "ghost", "Delete");
      remove.type = "button";
      remove.addEventListener("click", function () { deleteSnapshot(snap.id); });
      actionsWrap.appendChild(remove);

      actions.appendChild(actionsWrap);
      row.appendChild(actions);
      tbody.appendChild(row);
    });

    table.appendChild(tbody);
    nodes.snapshots.appendChild(scrollWrap(table));
  }

  function refreshHomeCard() {
    if (nodes.homeBadge) {
      if (!state.ready) {
        nodes.homeBadge.textContent = "Loading";
        nodes.homeBadge.className = "badge";
      } else if (!state.snapshots.length) {
        nodes.homeBadge.textContent = "No snapshots";
        nodes.homeBadge.className = "badge";
      } else {
        nodes.homeBadge.textContent = state.snapshots.length +
          (state.snapshots.length === 1 ? " snapshot" : " snapshots");
        nodes.homeBadge.className = "badge ok";
      }
    }
    if (nodes.homeNote) {
      if (!state.ready) {
        nodes.homeNote.textContent = "Loading snapshot history...";
      } else if (!state.snapshots.length) {
        nodes.homeNote.textContent = "Every import adds a dated snapshot.";
      } else {
        var latest = state.snapshots[state.snapshots.length - 1];
        nodes.homeNote.textContent = "Latest " + TD.formatTimeMs(latest.timeMs, true) +
          " · " + modeLabel();
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /* wiring                                                           */
  /* ---------------------------------------------------------------- */

  function bindControls() {
    if (nodes.search) {
      nodes.search.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          addMetric();
        }
      });
    }
    if (nodes.add) nodes.add.addEventListener("click", addMetric);
    if (nodes.clearSelection) {
      nodes.clearSelection.addEventListener("click", function () {
        state.selected = [];
        savePrefs();
        renderGraph();
      });
    }
    if (nodes.range) {
      nodes.range.addEventListener("change", function () {
        state.range = nodes.range.value;
        savePrefs();
        renderGraph();
      });
    }
    if (nodes.scale) {
      nodes.scale.addEventListener("change", function () {
        state.scale = nodes.scale.value;
        savePrefs();
        renderGraph();
      });
    }
    if (nodes.download) nodes.download.addEventListener("click", downloadHistory);
    if (nodes.importBtn) {
      nodes.importBtn.addEventListener("click", function () {
        if (nodes.importFile && typeof nodes.importFile.click === "function") nodes.importFile.click();
      });
    }
    if (nodes.importFile) {
      nodes.importFile.addEventListener("change", function () {
        var file = nodes.importFile.files && nodes.importFile.files[0];
        if (file) importHistoryFile(file);
      });
    }
    if (nodes.clear) nodes.clear.addEventListener("click", clearHistory);

    if (typeof global.addEventListener === "function") {
      global.addEventListener("obelisk-account-change", refreshAccount);
    }
  }

  global.TrackerTool = {
    init: init,
    recordImport: recordImport,
    refreshAccount: refreshAccount,
    useSnapshot: useSnapshot,
    getState: function () {
      return {
        ready: state.ready,
        snapshots: state.snapshots.length,
        mode: state.mode,
        warning: state.warning,
        pins: state.pins.slice(),
        selected: state.selected.slice(),
        range: state.range,
        scale: state.scale,
        firstDate: state.snapshots.length ? TD.formatTimeMs(state.snapshots[0].timeMs, false) : null,
        lastDate: state.snapshots.length
          ? TD.formatTimeMs(state.snapshots[state.snapshots.length - 1].timeMs, false)
          : null
      };
    }
  };

})(typeof window !== "undefined" ? window : globalThis);
