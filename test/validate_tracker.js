// Validates Tracker timestamps, metric series, history merging, and storage.
require("../trackerdata.js");

var fs = require("fs");
var path = require("path");

var TD = globalThis.TrackerData;

var fails = 0;
function check(name, cond) { if (!cond) { fails++; console.log("FAIL " + name); } }
function close(a, b) { var m = Math.max(1, Math.abs(a), Math.abs(b)); return Math.abs(a - b) / m < 1e-9; }

var raw = fs.readFileSync(path.join(__dirname, "..", "sample.js"), "utf-8");
var json = raw.replace(/^window\.SAMPLE_EXPORT\s*=\s*/, "").replace(/;\s*$/, "");
var sample = JSON.parse(json);

/* ---- export time -------------------------------------------------- */

var parsedDate = TD.parseExportTime(sample.time);
check("export time parses", !!parsedDate);
check("export time is the recorded wall clock",
  parsedDate.toISOString().slice(0, 16) === "2026-09-11T17:53");
check("export date formats for the UI",
  TD.formatExportDate(sample.time).indexOf("Sep 11, 2026") >= 0);
check("bad export time is rejected", TD.parseExportTime("not a date") === null);
check("empty export time is rejected", TD.parseExportTime(null) === null);

var minute = Date.UTC(2026, 8, 11, 17, 53);
check("date input round trips", TD.fromDateInputValue(TD.toDateInputValue(minute)) === minute);

/* ---- snapshot records --------------------------------------------- */

var snapA = TD.makeSnapshot(
  { version: sample.version, time: sample.time, stats: sample.stats },
  {
    raw: JSON.stringify(sample),
    source: "pasted JSON",
    applied: 61,
    missing: 11,
    importedAt: "2026-11-12T10:00:00.000Z"
  }
);

check("snapshot is created", !!snapA);
check("snapshot id is the export time", snapA.id === "t:" + String(sample.time));
check("snapshot keeps the export date", snapA.timeMs === parsedDate.getTime());
check("snapshot keeps the raw JSON", snapA.raw.indexOf("fishing_enhance_array") >= 0);
check("snapshot records metadata",
  snapA.version === "v2.2.20" && snapA.applied === 61 && snapA.missing === 11);
check("snapshot has a fingerprint", typeof snapA.fingerprint === "string" && snapA.fingerprint.length > 0);

var snapB = TD.makeSnapshot(
  { version: sample.version, time: sample.time, stats: sample.stats },
  { raw: JSON.stringify(sample), source: "pasted JSON", importedAt: "2026-11-13T10:00:00.000Z" }
);
check("identical exports share a fingerprint", snapA.fingerprint === snapB.fingerprint);

var changedStats = JSON.parse(JSON.stringify(sample.stats));
changedStats.obelisk_level = 99;
var snapC = TD.makeSnapshot(
  { version: "v2.2.21", time: sample.time, stats: changedStats },
  {
    raw: JSON.stringify({ time: sample.time, version: "v2.2.21", stats: changedStats }),
    source: "pasted JSON",
    importedAt: "2026-11-13T10:00:00.000Z"
  }
);
check("same export time with new stats gets a new fingerprint", snapA.fingerprint !== snapC.fingerprint);

/* ---- merging ------------------------------------------------------ */

var mergedSame = TD.mergeSnapshots([snapA], [snapB]);
check("identical snapshots merge without duplicates",
  mergedSame.snapshots.length === 1 && mergedSame.added === 0 && mergedSame.skipped === 1);

var mergedChanged = TD.mergeSnapshots([snapA], [snapC]);
check("same export time with new content replaces",
  mergedChanged.snapshots.length === 1 && mergedChanged.replaced === 1 &&
  mergedChanged.snapshots[0].stats.obelisk_level === 99);

var olderConflict = TD.makeSnapshot(
  { version: "v2.2.20", time: sample.time, stats: { obelisk_level: 1 } },
  { source: "old backup", importedAt: "2026-11-01T00:00:00.000Z" }
);
var mergedOlder = TD.mergeSnapshots([snapC], [olderConflict]);
check("an older conflicting backup does not overwrite",
  mergedOlder.snapshots[0].stats.obelisk_level === 99 && mergedOlder.skipped === 1);

var snapD = TD.makeSnapshot(
  { version: "v2.2.21", time: sample.time + 1, stats: changedStats },
  {
    raw: JSON.stringify({ time: sample.time + 1, version: "v2.2.21", stats: changedStats }),
    source: "pasted JSON",
    importedAt: "2026-11-13T11:00:00.000Z"
  }
);
var mergedNew = TD.mergeSnapshots([snapA], [snapD]);
check("a new export time adds a snapshot", mergedNew.snapshots.length === 2 && mergedNew.added === 1);

/* ---- active account / backfill ------------------------------------ */

var activeRecord = { source: "pasted JSON", exportedAt: sample.time, raw: JSON.stringify(sample) };
check("the same export is not a backfill",
  TD.isOlderThanActive(TD.exportTimeMs(sample.time), activeRecord) === false);
check("an older export is a backfill",
  TD.isOlderThanActive(TD.exportTimeMs(sample.time) - 86400000, activeRecord) === true);
check("built-in sample sources are demos",
  TD.isSampleSource("sample export") && TD.isSampleSource("v2.2.52 sample export"));
check("a real import is not a demo", TD.isSampleSource("pasted JSON") === false);
check("a sample account does not block a real import",
  TD.isOlderThanActive(TD.exportTimeMs(sample.time) - 86400000, { source: "sample export" }) === false);
check("the v2.2.52 sample does not block a real import",
  TD.isOlderThanActive(TD.exportTimeMs(sample.time) - 86400000,
    { source: "v2.2.52 sample export", exportedAt: sample.time }) === false);
check("a missing active account does not block an import",
  TD.isOlderThanActive(TD.exportTimeMs(sample.time), null) === false);
check("the active snapshot is identified",
  TD.activeSnapshotId([snapA], activeRecord) === snapA.id);
check("the sample is never the active snapshot",
  TD.activeSnapshotId([snapA], { source: "sample export", exportedAt: sample.time }) === null);

/* ---- metrics ------------------------------------------------------ */

var catalog = TD.buildMetricCatalog([snapA]);
var catalogKeys = {};
catalog.forEach(function (m) { catalogKeys[m.key] = true; });

check("catalog includes scalar stats", !!catalogKeys.obelisk_level && !!catalogKeys.bomb_damage);
check("catalog includes derived progress", !!catalogKeys["derived:contracts_total"] &&
  !!catalogKeys["derived:fishing_upgrades_total"]);
check("catalog excludes arrays", !catalogKeys.contracts_array && !catalogKeys.fishing_enhance_array);
check("catalog labels known stats", TD.labelFor("fishing_income_multi") === "Fishing income multiplier");
check("catalog groups known stats", TD.groupFor("fishing_income_multi") === "Fishing");

function sum(arr) { return arr.reduce(function (a, b) { return a + b; }, 0); }
check("contract total is the sum of the array",
  TD.getMetricValue(sample.stats, "derived:contracts_total") === sum(sample.stats.contracts_array));
check("fishing upgrade total is the sum of the array",
  TD.getMetricValue(sample.stats, "derived:fishing_upgrades_total") === sum(sample.stats.fishing_upgrades_array));
check("missing arrays return null",
  TD.getMetricValue({}, "derived:contracts_total") === null);
check("scalar values are read directly",
  TD.getMetricValue(sample.stats, "obelisk_level") === sample.stats.obelisk_level);

/* ---- series + chart model ---------------------------------------- */

function statsWith(level, floor, bomb) {
  return { obelisk_level: level, current_floor: floor, bomb_damage: bomb };
}
var baseTime = TD.exportTimeMs(sample.time);
var seriesSnaps = [
  TD.makeSnapshot({ version: "v", time: sample.time, stats: statsWith(70, 100, 10) },
    { importedAt: "2026-01-01T00:00:00.000Z" }),
  TD.makeSnapshot({ version: "v", time: sample.time + 20, stats: statsWith(72, 110, 100) },
    { importedAt: "2026-02-10T00:00:00.000Z" }),
  TD.makeSnapshot({ version: "v", time: sample.time + 60, stats: statsWith(75, 120, 1000) },
    { importedAt: "2026-03-02T00:00:00.000Z" })
];

var single = TD.chartModel(seriesSnaps, ["obelisk_level"], { range: "all", scale: "auto" });
check("single series plots every snapshot", single.series.length === 1 && single.series[0].points.length === 3);
check("single series is not normalized", single.normalize === false);
check("single series keeps raw values", single.series[0].points[0].y === 70);
check("single series has axis ticks", single.xTicks.length >= 2 && single.yTicks.length >= 2);

var multi = TD.chartModel(seriesSnaps, ["obelisk_level", "current_floor"], { range: "all", scale: "auto" });
check("multiple series are normalized", multi.normalize === true && multi.series.length === 2);
check("normalized series start at 100", multi.series[0].points[0].y === 100 && multi.series[1].points[0].y === 100);
check("normalized series keep raw values", multi.series[0].points[2].raw === 75);

var logModel = TD.chartModel(seriesSnaps, ["bomb_damage"], { range: "all", scale: "auto" });
check("auto scale uses log for a wide range", logModel.scale === "log");
var linearModel = TD.chartModel(seriesSnaps, ["bomb_damage"], { range: "all", scale: "linear" });
check("linear scale can be forced", linearModel.scale === "linear");

var recent = TD.chartModel(seriesSnaps, ["obelisk_level"], { range: "30d", scale: "auto" });
check("range filter uses the newest snapshot as now", recent.filtered.length === 1 &&
  recent.filtered[0].stats.obelisk_level === 75);

var month = TD.chartModel(seriesSnaps, ["obelisk_level"], { range: "90d", scale: "auto" });
check("90 day range keeps every snapshot", month.filtered.length === 3);

/* ---- ticks + formatting ------------------------------------------ */

var ticks = TD.niceTicks(0, 100, 5);
check("linear ticks are inside the domain", ticks.length >= 3 && ticks[0] >= 0 && ticks[ticks.length - 1] <= 100);
var logTicks = TD.logTicks(1, 1000);
check("log ticks cover the powers", logTicks.indexOf(1) >= 0 && logTicks.indexOf(10) >= 0 &&
  logTicks.indexOf(100) >= 0 && logTicks.indexOf(1000) >= 0);
check("large numbers use suffixes", TD.formatValue(1500) === "1.50k" && TD.formatValue(1500000) === "1.50m");
check("zero formats cleanly", TD.formatValue(0) === "0");
check("bytes format for the table", TD.formatSize(2048) === "2.0 KB");

/* ---- bundle ------------------------------------------------------- */

var history = TD.bundle([snapA, snapD]);
check("bundle is tagged", history.format === "obelisk-tracker-history" && history.version === 1);
check("bundle keeps every snapshot", history.snapshots.length === 2);
var parsedHistory = TD.parseBundle(JSON.stringify(history));
check("bundle parses back", parsedHistory.snapshots.length === 2 && parsedHistory.invalid === 0);
check("bundle restores stats from raw",
  parsedHistory.snapshots[0].stats.obelisk_level === 71 &&
  parsedHistory.snapshots[1].stats.obelisk_level === 99);
var bare = TD.parseBundle(JSON.stringify(sample));
check("a bare ExportStats JSON is accepted", bare.snapshots.length === 1 &&
  bare.snapshots[0].stats.obelisk_level === 71);

/* ---- fallback store ---------------------------------------------- */

function makeStorage() {
  var mem = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
    setItem: function (k, v) { mem[k] = String(v); },
    removeItem: function (k) { delete mem[k]; }
  };
}

function localSnapshot(time, level) {
  return TD.makeSnapshot(
    { version: "v-test", time: time, stats: { obelisk_level: level } },
    { source: "test", importedAt: new Date(1750000000000 + time * 1000).toISOString() }
  );
}

(async function () {
  var storage = makeStorage();
  var store = TD.createStore({ localStorage: storage, indexedDB: null });
  var loaded = await store.load();
  check("fallback store starts empty", loaded.mode === "local" && loaded.snapshots.length === 0);
  check("fallback warns about IndexedDB", loaded.warning.indexOf("IndexedDB") >= 0);

  var added = await store.add(snapA);
  check("fallback add works", added.added === true && store.getCached().length === 1);

  var duplicate = await store.add(snapB);
  check("fallback dedupes identical exports", duplicate.skipped === true && store.getCached().length === 1);

  var replaced = await store.add(snapC);
  check("fallback replaces an export with new content",
    replaced.replaced === true && store.getCached()[0].stats.obelisk_level === 99);

  var removed = await store.remove(snapA.id);
  check("fallback removes a snapshot", removed.deleted === true && store.getCached().length === 0);

  await store.clear();
  check("fallback clears the history", store.getCached().length === 0);

  for (var i = 0; i < 51; i++) {
    await store.add(localSnapshot(46000 + i, i));
  }
  check("fallback keeps the newest 50 snapshots", store.getCached().length === 50);
  check("fallback explains the cap", store.getWarning().indexOf("50") >= 0);
  check("fallback keeps the newest record", store.getCached()[49].stats.obelisk_level === 50);

  await store.clear();
  await store.add(localSnapshot(46100, 1));
  var merged = await store.merge([localSnapshot(46101, 2), localSnapshot(46102, 3)]);
  check("fallback merge adds new history", merged.added === 2 && store.getCached().length === 3);
  var mergedAgain = await store.merge([localSnapshot(46102, 3)]);
  check("fallback merge skips unchanged history", mergedAgain.skipped === 1 && store.getCached().length === 3);

  console.log((fails === 0 ? "ALL OK" : fails + " FAILED") + " | snapshots=" + store.getCached().length);
  process.exitCode = fails === 0 ? 0 : 1;
})().catch(function (error) {
  console.log("FAIL " + (error && error.stack ? error.stack : error));
  process.exitCode = 1;
});
