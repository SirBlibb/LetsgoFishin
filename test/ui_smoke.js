// Minimal DOM stub + load of the site scripts, to catch wiring errors and
// exercise the +1 commit / undo flow.
function makeNode(tag) {
  var n = {
    tagName: tag, children: [], _text: "", _id: "", className: "", style: {},
    value: "", checked: false, selected: false, disabled: false, title: "",
    placeholder: "", type: "", min: 0, max: 0, step: 1, files: [],
    appendChild: function (c) { this.children.push(c); c.parentNode = this; return c; },
    removeChild: function (c) { var i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; },
    addEventListener: function (type, fn) {
      this._l = this._l || {};
      (this._l[type] = this._l[type] || []).push(fn);
    },
    removeEventListener: function () {},
    setAttribute: function () {}, getAttribute: function () { return null; },
    offsetWidth: 190, offsetHeight: 70,
    getBoundingClientRect: function () {
      return { left: 0, top: 0, width: 860, height: 380, right: 860, bottom: 380 };
    }
  };
  Object.defineProperty(n, "textContent", { get: function () { return this._text; }, set: function (v) { this._text = v; } });
  Object.defineProperty(n, "innerHTML", { get: function () { return this._text; }, set: function (v) { this._text = v; this.children = []; } });
  Object.defineProperty(n, "id", {
    get: function () { return this._id; },
    set: function (v) { this._id = v; byId[v] = this; }
  });
  return n;
}

function fire(node, type, props) {
  var hs = node && node._l && node._l[type];
  if (hs) hs.forEach(function (h) {
    var event = { preventDefault: function () {} };
    if (props) Object.keys(props).forEach(function (k) { event[k] = props[k]; });
    h(event);
  });
}

function rowsOf() {
  var results = byId["results"];
  var table = results.children[results.children.length - 2].children[0]; // .table-scroll > table
  return table.children[1].children;
}

function fishRowsOf() {
  var root = byId["fish-results"];
  var table = root.children[root.children.length - 2].children[0]; // .table-scroll > table
  return table.children[1].children;
}

function floorTableRowCount() {
  var root = byId["bomb-table"];
  var table = root.children[0].children[0]; // .table-scroll > table
  var count = 0;
  for (var i = 2; i < table.children.length; i++) {
    count += table.children[i].children.length - 1; // minus the zone heading
  }
  return count;
}

function countUnblocked(rows) {
  var n = 0;
  rows.forEach(function (tr) { if (tr.className.indexOf("blocked") < 0) n++; });
  return n;
}

function findButton(scope, label) {
  if (!scope) return null;
  if (scope.tagName === "button" && scope.textContent === label) return scope;
  for (var i = 0; i < scope.children.length; i++) {
    var f = findButton(scope.children[i], label);
    if (f) return f;
  }
  return null;
}

function findByRowName(rows, name) {
  var hit = null;
  rows.forEach(function (tr) { if (tr.children[1].textContent === name) hit = tr; });
  return hit;
}

function nodeText(node) {
  if (!node) return "";
  var out = node.textContent || "";
  (node.children || []).forEach(function (c) { out += " " + nodeText(c); });
  return out;
}

function goalText(id) { return nodeText(byId[id]); }

function contractLevelRowsOf() {
  var root = byId["contracts-levels"];
  var table = root.children[0].children[0]; // .table-scroll > table
  return table.children[1].children;
}

function contractRankingRowsOf() {
  var root = byId["contracts-ranking"];
  var table = root.children[0].children[0]; // .table-scroll > table
  return table.children[1].children;
}

function contractSummaryRowsOf() {
  var root = byId["contracts-summary"];
  var table = root.children[1].children[0]; // stats summary, then .table-scroll > table
  return table.children[1].children;
}

function findContractRankRow(rows, name) {
  var hit = null;
  rows.forEach(function (tr) {
    if (tr.children[1].textContent.slice(3) === name) hit = tr;
  });
  return hit;
}

function trackerSnapshotRowsOf() {
  var root = byId["tracker-snapshots"];
  var table = root.children[0].children[0]; // .table-scroll > table
  return table.children[1].children;
}

function legendaryDockRowsOf() {
  var root = byId["legendary-docks"];
  var table = root.children[0].children[0]; // .table-scroll > table
  return table.children[1].children;
}

function countTags(node, tag) {
  var count = node && node.tagName === tag ? 1 : 0;
  (node && node.children ? node.children : []).forEach(function (child) {
    count += countTags(child, tag);
  });
  return count;
}

function dateInputValue(d) {
  function pad(n) { return String(n).padStart(2, "0"); }
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
    "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
}

var byId = {};
global.window = global;
global.localStorage = (function () {
  var mem = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
    setItem: function (k, v) { mem[k] = String(v); },
    removeItem: function (k) { delete mem[k]; }
  };
})();
global.document = {
  readyState: "complete",
  title: "",
  createElement: makeNode,
  createElementNS: function (ns, tag) { return makeNode(tag); },
  getElementById: function (id) { return byId[id] || (byId[id] = makeNode("div")); },
  addEventListener: function () {},
  body: makeNode("body")
};
global.FileReader = function () { this.readAsText = function () {}; };

require("../model.js");
require("../data.js");
require("../fishcosts.js");
require("../exportstats.js");
require("../legendarydata.js");
require("../account.js");
require("../trackerdata.js");
require("../sample.js");
require("../bombdata.js");
require("../goaldata.js");
require("../bombs.js");
require("../goals.js");
require("../legendary.js");
require("../contractdata.js");
require("../contracts.js");
require("../damagedata.js");
require("../damage.js");
require("../floortables.js");
require("../floordata.js");
require("../floors.js");
require("../tracker.js");
require("../sample_v2252.js");
require("../app.js");

var FM = global.FishModel;
var ES = global.ExportStats;

function countOptions(scope) {
  var n = 0;
  scope.children.forEach(function (c) {
    if (c.tagName === "option") n++;
    n += countOptions(c);
  });
  return n;
}

var fails = 0;
function check(name, cond) { if (!cond) { fails++; console.log("FAIL " + name); } }

/* ---- default-state render ---------------------------------------- */
var rows = rowsOf();
check("home view visible by default", byId["view-home"].hidden === false);
check("fishing view hidden by default", byId["view-fishing"].hidden === true);
check("bombs view hidden by default", byId["view-bombs"].hidden === true);
check("settings has 4 fields", byId["settings"].children.length === 4);
check("upgrades rendered", byId["upgrades"].children.length >= 3);
check("cards table rendered", byId["cards"].children.length >= 2);
check("scalars rendered", byId["scalars"].children.length >= 5);
check("results table has 21 rows", rows.length === 21);
check("results row has 10 cells", rows[0].children.length === 10);
check("undo disabled with no history", byId["btn-undo"].disabled === true);

check("bomb level dropdown has 86 options", countOptions(byId["bomb-level"]) === 86);
check("bomb results rendered", byId["bomb-results"].children.length > 0);
check("bomb stats rendered", byId["bomb-stats"].children.length >= 3);
check("bomb stats include bar output multiplier", !!byId["bomb-stat-barOutputMulti"]);
check("bomb table rendered", byId["bomb-table"].children.length >= 1);
check("bomb table split into 4 world groups", [1, 2, 3, 4].every(function (world) {
  return !!byId["bomb-world-" + world];
}));
check("bomb world groups hold a heading plus their rows",
  byId["bomb-world-1"].children.length === 27 &&
  byId["bomb-world-2"].children.length === 21 &&
  byId["bomb-world-3"].children.length === 21 &&
  byId["bomb-world-4"].children.length === 21);
check("bomb stats open without an account", byId["bomb-stats-details"].open === true);
check("bomb stats show defaults", byId["bomb-stats-source"].textContent.indexOf("Defaults") >= 0);

check("goal view hidden by default", byId["view-goal"].hidden === true);
check("goal badge is manual entry", byId["goal-badge"].textContent === "Manual entry");
check("goal starts in ore mode", byId["goal-mode-ore"].checked === true);
check("goal ore target field visible", byId["goal-target-ore-field"].hidden === false);
check("goal bar fields hidden", byId["goal-current-bars-field"].hidden === true &&
  byId["goal-target-bars-field"].hidden === true &&
  byId["goal-level-field"].hidden === true);
check("goal level dropdown has 86 options", countOptions(byId["goal-level"]) === 86);
check("goal results rendered", byId["goal-results"].children.length > 0);
check("goal stats show 9 crafting fields", byId["goal-stats"].children.length === 1 &&
  byId["goal-stats"].children[0].children.length === 9);
check("goal stats include bar output multiplier", !!byId["goal-stat-barOutputMulti"]);
check("goal stats show defaults", byId["goal-stats-source"].textContent.indexOf("Defaults") >= 0);
check("goal asks for a rate", byId["goal-eta-detail"].textContent.indexOf("Enter your ore per hour") >= 0);

check("legendary view hidden by default", byId["view-legendary"].hidden === true);
check("legendary badge is manual entry", byId["legendary-badge"].textContent === "Manual entry");
check("legendary starts on Lake", global.LegendaryTool.getState().dock === "Lake");
check("legendary starts with auto ticks", global.LegendaryTool.getState().ticksAuto === true);
check("legendary renders a hero", byId["legendary-hero"].children.length > 0);
check("legendary renders 11 dock rows", legendaryDockRowsOf().length === 11);
check("legendary timeline asks for 100% first",
  nodeText(byId["legendary-timeline"]).indexOf("100% catch chance") >= 0);
check("legendary account status renders",
  byId["legendary-account-status"].textContent.indexOf("No account") >= 0 ||
  byId["legendary-account-status"].textContent.indexOf("Manual") >= 0);

var legendaryRod = byId["legendary-rodPower"];
legendaryRod.value = "49000";
fire(legendaryRod, "input");
var legendaryPoly = byId["legendary-poly"];
legendaryPoly.checked = true;
fire(legendaryPoly, "change");
check("legendary rod power updates the state", global.LegendaryTool.getState().rodPower === 49000);
check("legendary poly checkbox updates the state", global.LegendaryTool.getState().polyCards === true);
check("legendary hero renders an average", nodeText(byId["legendary-hero"]).indexOf("Average time to catch") >= 0);
check("legendary selected dock row is highlighted",
  legendaryDockRowsOf().some(function (tr) { return tr.className.indexOf("legendary-selected") >= 0; }));

check("contracts view hidden by default", byId["view-contracts"].hidden === true);
check("contract badge is manual entry", byId["contracts-badge"].textContent === "Manual entry");
check("contract planner starts in current mode", global.ContractTool.getState().mode === "current");
check("contract planner starts with no spare CP", global.ContractTool.getState().spareCp === 0);
check("contract planner starts 100% ore",
  global.ContractTool.getState().weights.ore === 100 &&
  global.ContractTool.getState().weights.veins === 0);
check("contract planner starts from defaults", global.ContractTool.getState().source === "defaults");
check("contract planner starts at zero levels",
  global.ContractTool.getState().levels.every(function (v) { return v === 0; }));
check("contract level table has 34 rows", contractLevelRowsOf().length === 34);
check("contract level inputs exist", !!byId["contract-level-0"] && !!byId["contract-level-33"]);
check("contract ranking has 34 rows", contractRankingRowsOf().length === 34);
check("contract ranking starts with the best ore upgrade",
  contractRankingRowsOf()[0].children[1].textContent.slice(3) === "Golden Floor Multiplier");
check("contract ranking greys out no-effect upgrades",
  findContractRankRow(contractRankingRowsOf(), "Triple Craft Chance").className.indexOf("blocked") >= 0);
check("contract ranking explains a no-effect upgrade",
  findContractRankRow(contractRankingRowsOf(), "Triple Craft Chance").children[7].textContent ===
  "No effect on selected goals");
check("contract plan starts empty", global.ContractTool.getState().buys.length === 0);
check("contract ranking view is the default", global.ContractTool.getState().view === "ranking" &&
  byId["contracts-view-title"].textContent === "5. Next-level ranking");
check("contract ranking is visible and summary hidden",
  byId["contracts-ranking"].hidden === false && byId["contracts-summary"].hidden === true);

fire(byId["contracts-view-summary"], "click");
check("contract summary toggle switches the view", global.ContractTool.getState().view === "summary");
check("contract summary view is visible and ranking hidden",
  byId["contracts-summary"].hidden === false && byId["contracts-ranking"].hidden === true);
check("contract summary toggle updates the heading",
  byId["contracts-view-title"].textContent === "5. Upgrade summary");
check("contract summary lists every upgrade and a total", contractSummaryRowsOf().length === 35);
check("contract summary shows the level caps",
  contractSummaryRowsOf()[0].children[3].textContent === "1" &&
  contractSummaryRowsOf()[1].children[3].textContent === "5");
check("contract summary has grand totals",
  nodeText(byId["contracts-summary"]).indexOf("To max:") >= 0 &&
  nodeText(byId["contracts-summary"]).indexOf("All-in:") >= 0 &&
  nodeText(byId["contracts-summary"]).indexOf("Levels:") >= 0);
check("contract summary total row is labelled", contractSummaryRowsOf()[34].children[1].textContent === "Total");
check("contract summary view is saved",
  JSON.parse(global.localStorage.getItem("obelisk-contracts-v1")).view === "summary");

fire(byId["contracts-view-ranking"], "click");
check("contract ranking toggle switches back", global.ContractTool.getState().view === "ranking" &&
  byId["contracts-ranking"].hidden === false && byId["contracts-summary"].hidden === true);

/* ---- tracker ------------------------------------------------------ */
check("tracker view hidden by default", byId["view-tracker"].hidden === true);
check("tracker modules are exposed", !!global.TrackerTool && !!global.TrackerData);
var trackerState = global.TrackerTool.getState();
check("tracker starts ready and empty", trackerState.ready === true && trackerState.snapshots === 0);
check("tracker home badge starts empty", byId["tracker-badge"].textContent === "No snapshots");
check("tracker chart starts empty", nodeText(byId["tracker-chart"]).indexOf("No snapshots") >= 0);
check("tracker table starts empty", nodeText(byId["tracker-snapshots"]).indexOf("No snapshots") >= 0);
check("tracker hides quick picks while empty", byId["tracker-chips"].hidden === true);

var trackerParsed = ES.parseExport(window.SAMPLE_EXPORT);
var trackerRes = ES.apply(trackerParsed.stats, FM.defaultInputs());
global.TrackerTool.recordImport(trackerParsed, trackerRes, JSON.stringify(window.SAMPLE_EXPORT), "pasted JSON");
check("tracker records an import", global.TrackerTool.getState().snapshots === 1);
check("tracker quick picks render after an import",
  byId["tracker-chips"].hidden === false && byId["tracker-chips"].children.length >= 10);
check("tracker home badge counts the import", byId["tracker-badge"].textContent === "1 snapshot");
check("tracker table lists the import", trackerSnapshotRowsOf().length === 1);
check("tracker table shows the OB level", trackerSnapshotRowsOf()[0].children[3].textContent === "71");
check("tracker chart draws an svg", countTags(byId["tracker-chart"], "svg") === 1);

var laterExport = JSON.parse(JSON.stringify(window.SAMPLE_EXPORT));
laterExport.time = window.SAMPLE_EXPORT.time + 1;
laterExport.stats.obelisk_level = 72;
var laterParsed = ES.parseExport(laterExport);
var laterRes = ES.apply(laterParsed.stats, FM.defaultInputs());
global.TrackerTool.recordImport(laterParsed, laterRes, JSON.stringify(laterExport), "pasted JSON");
check("tracker keeps two snapshots", global.TrackerTool.getState().snapshots === 2);
check("tracker table is newest first", trackerSnapshotRowsOf()[0].children[3].textContent === "72");
check("tracker chart draws a line", countTags(byId["tracker-chart"], "path") >= 1);
check("tracker status counts the snapshots", byId["tracker-status"].textContent.indexOf("2 snapshots") >= 0);
check("tracker summary counts the snapshots", byId["tracker-snapshots-summary"].textContent.indexOf("2 snapshots") >= 0);
check("tracker chart data table renders", byId["tracker-data"].children.length > 0);
var trackerChartWrap = byId["tracker-chart"].children[0];
var trackerChartSvg = trackerChartWrap.children[0];
var trackerChartTooltip = trackerChartWrap.children[1];
fire(trackerChartSvg, "click", { clientX: 400, clientY: 200 });
check("tracker click opens the exact-value popup",
  trackerChartTooltip.hidden === false && nodeText(trackerChartTooltip).indexOf("71") >= 0);
fire(trackerChartSvg, "pointerdown", { pointerType: "touch" });
fire(trackerChartSvg, "click", { pointerType: "touch", clientX: 400, clientY: 200 });
check("tracker tap keeps the popup open", trackerChartTooltip.hidden === false);
fire(trackerChartSvg, "click", { pointerType: "touch", clientX: 400, clientY: 200 });
check("tracker second tap dismisses the popup", trackerChartTooltip.hidden === true);
fire(byId["tracker-clear-selection"], "click");
check("tracker clears the chart selection", global.TrackerTool.getState().selected.length === 0);
check("tracker disables clear selection when empty", byId["tracker-clear-selection"].disabled === true);
var trackerPrefs = JSON.parse(global.localStorage.getItem("obelisk-tracker-prefs-v1"));
check("tracker remembers a cleared selection", trackerPrefs.selectionCleared === true);
delete require.cache[require.resolve("../tracker.js")];
require("../tracker.js");
global.TrackerTool.init();
check("tracker does not re-select a cleared chart", global.TrackerTool.getState().selected.length === 0);

/* ---- contract planner interactions -------------------------------- */
var contractSpare = byId["contracts-spare"];
contractSpare.value = "1000";
fire(contractSpare, "input");
check("contract spare CP updates the state", global.ContractTool.getState().spareCp === 1000);
check("contract budget follows the spare CP", global.ContractTool.getState().budget === 1000);
check("contract plan buys with a budget", global.ContractTool.getState().buys.length > 0);
check("contract plan stays inside the budget",
  global.ContractTool.getState().spent <= global.ContractTool.getState().budget + 1e-9);

fire(byId["contracts-preset-veins"], "click");
check("contract vein preset switches the weights",
  global.ContractTool.getState().weights.veins === 100 &&
  global.ContractTool.getState().weights.ore === 0);
check("contract vein preset updates the label", byId["contracts-weight-veins-value"].textContent === "100%");
check("contract vein ranking starts with the vein upgrade",
  contractRankingRowsOf()[0].children[1].textContent.slice(3) === "Vein Income Multiplier");

fire(byId["contracts-preset-mix"], "click");
check("contract mix preset splits ore and veins",
  global.ContractTool.getState().weights.ore === 50 &&
  global.ContractTool.getState().weights.veins === 50);
check("contract mix preset updates both labels",
  byId["contracts-weight-ore-value"].textContent === "50%" &&
  byId["contracts-weight-veins-value"].textContent === "50%");

fire(byId["contracts-preset-ore"], "click");
var contractLevel14 = byId["contract-level-14"];
contractLevel14.value = "3";
fire(contractLevel14, "input");
check("contract level input updates the state", global.ContractTool.getState().levels[14] === 3);
check("contract level input updates the ranking",
  findContractRankRow(contractRankingRowsOf(), "Golden Floor Multiplier").children[2].textContent === "3");

var contractRespec = byId["contracts-mode-respec"];
contractRespec.checked = true;
fire(contractRespec, "change");
check("contract respec mode updates the state", global.ContractTool.getState().mode === "respec");
check("contract respec plan refunds the owned levels",
  global.ContractTool.getState().plan.startLevels.every(function (v) { return v === 0; }));
check("contract respec budget exceeds the spare CP",
  global.ContractTool.getState().budget > global.ContractTool.getState().spareCp);
check("contract respec note explains the refund",
  byId["contracts-budget-note"].textContent.indexOf("Respec budget") >= 0 &&
  byId["contracts-budget-note"].textContent.indexOf("refunded") >= 0);
check("contract respec plan stays inside its budget",
  global.ContractTool.getState().spent <= global.ContractTool.getState().budget + 1e-9);

var contractCurrent = byId["contracts-mode-current"];
contractCurrent.checked = true;
fire(contractCurrent, "change");
contractLevel14.value = "0";
fire(contractLevel14, "input");
contractSpare.value = "0";
fire(contractSpare, "input");
fire(byId["contracts-preset-ore"], "click");
check("contract planner returns to current mode", global.ContractTool.getState().mode === "current");
check("contract planner clears the test level", global.ContractTool.getState().levels[14] === 0);

/* ---- goal ore interactions --------------------------------------- */
var goalRate = byId["goal-rate"];
goalRate.value = "1000";
fire(goalRate, "input");
check("goal ETA at 1k ore/hour", byId["goal-eta"].textContent === "4.17 days of play");
check("goal status names the missing account", byId["goal-account-status"].textContent.indexOf("No account") >= 0);

byId["goal-current-ore"].value = "1000";
fire(byId["goal-current-ore"], "input");
byId["goal-target-ore"].value = "11000";
fire(byId["goal-target-ore"], "input");
check("goal ETA uses the current ore", byId["goal-eta"].textContent === "10.0 hours");
check("goal progress percent", byId["goal-progress-label"].textContent === "9% complete");
check("goal progress bar width", byId["goal-progress-fill"].style.width === "9.1%");

byId["goal-rate-before"].value = "0";
fire(byId["goal-rate-before"], "input");
byId["goal-rate-after"].value = "5000";
fire(byId["goal-rate-after"], "input");
byId["goal-rate-minutes"].value = "30";
fire(byId["goal-rate-minutes"], "input");
check("goal rate helper previews the measurement", byId["goal-rate-result"].textContent.indexOf("10.0k ore/hour") >= 0);
fire(byId["goal-rate-apply"], "click");
check("goal rate helper applies the rate", global.GoalTool.getState().orePerHour === 10000);
check("goal rate helper confirms the rate", byId["goal-rate-result"].textContent.indexOf("Applied") >= 0);
check("goal ETA follows the measured rate", byId["goal-eta"].textContent === "1.00 hours");

byId["goal-rate-before"].value = "5000";
fire(byId["goal-rate-before"], "input");
check("goal rate helper rejects no gain", byId["goal-rate-apply"].disabled === true);

var futureDeadline = new Date(Date.now() + 10 * 86400000);
byId["goal-deadline"].value = dateInputValue(futureDeadline);
fire(byId["goal-deadline"], "input");
check("goal deadline renders a required rate", byId["goal-required-rate"].textContent.indexOf("ore/hour") >= 0);
check("goal deadline compares the current rate", byId["goal-deadline-status"].textContent.indexOf("On track") >= 0);
check("goal deadline shows available play hours", goalText("goal-deadline-result").indexOf("play-hours") >= 0);

var frows = fishRowsOf();
check("fish table has 18 rows", frows.length === 18);
check("fish row has 11 cells", frows[0].children.length === 11);
check("fish rankable in default state (rod+drone)", countUnblocked(frows) === 2);

/* ---- hide locked toggle ------------------------------------------ */
var hideBox = byId["settings"].children[3].children[0];
var lockedGem = FM.computeModel(FM.defaultInputs()).rows.filter(function (r) { return r.locked; }).length;
var lockedFish = FM.computeModel(FM.defaultInputs()).fishRows.filter(function (r) { return r.locked; }).length;
check("locked gem rows exist", lockedGem > 0);
check("locked fish rows exist", lockedFish > 0);
hideBox.checked = true;
fire(hideBox, "change");
rows = rowsOf();
frows = fishRowsOf();
check("gem locked rows hidden", rows.length === 21 - lockedGem);
check("fish locked rows hidden", frows.length === 18 - lockedFish);
hideBox.checked = false;
fire(hideBox, "change");
rows = rowsOf();
frows = fishRowsOf();
check("gem rows restored", rows.length === 21);
check("fish rows restored", frows.length === 18);

/* ---- fish +1 purchase -------------------------------------------- */
var fishRod = findByRowName(frows, "Fishing Rod");
var startFishLevel = parseInt(fishRod.children[2].textContent, 10);
var fishBuy = findButton(fishRod.children[9], "+1");
check("fish rod has an enabled +1", !!fishBuy && fishBuy.disabled === false);
fire(fishBuy, "click");
frows = fishRowsOf();
fishRod = findByRowName(frows, "Fishing Rod");
check("fish level incremented", fishRod.children[2].textContent === String(startFishLevel + 1));
check("fish purchase highlighted", fishRod.className.indexOf("just-bought") >= 0);
fire(byId["btn-undo"], "click");
frows = fishRowsOf();
fishRod = findByRowName(frows, "Fishing Rod");
check("fish level reverted", fishRod.children[2].textContent === String(startFishLevel));

/* ---- sample import ----------------------------------------------- */
global.ObeliskApp.applyImport(window.SAMPLE_EXPORT, "sample export");
rows = rowsOf();

var storedAccount = global.AccountStore.load();
check("sample import saves the account record", !!storedAccount && storedAccount.version === "v2.2.20");
check("account record keeps the raw export", !!storedAccount && storedAccount.raw.indexOf("fishing_enhance_array") >= 0);
check("account summary rendered", byId["account-summary"].children.length > 0);
check("fishing tool badge shows the account", byId["fishing-badge"].textContent === "Account loaded");
check("bomb tool badge shows the account", byId["bombs-badge"].textContent === "Account loaded");
check("damage tool badge shows the account", byId["damage-badge"].textContent === "Account loaded");
check("damage tool loads the account", global.DamageTool.getState().source === "account");
check("bomb stats loaded from account", byId["bomb-stats-source"].textContent.indexOf("From account (15/15 fields)") >= 0);
check("bomb bar output loaded from account", byId["bomb-stat-barOutputMulti"].value.indexOf("21.568") === 0);
check("bomb stats warning cleared", byId["bomb-stats-warning"].textContent === "");
check("bomb verdict favours BoP at Tin", byId["bomb-verdict-text"].textContent.indexOf("Bomb of Plenty produces") >= 0);
check("bomb breakpoint names Mithril and Adamant",
  byId["bomb-breakpoint-main"].textContent.indexOf("Mithril") >= 0 &&
  byId["bomb-breakpoint-main"].textContent.indexOf("Adamant") >= 0);
check("bomb table summary counts", byId["bomb-table-summary"].textContent.indexOf("3 BoP") >= 0 &&
  byId["bomb-table-summary"].textContent.indexOf("83 Transmuter") >= 0);
check("goal badge shows the account", byId["goal-badge"].textContent === "Account loaded");
check("goal stats loaded from account", byId["goal-stats-source"].textContent.indexOf("From account (9/9 fields)") >= 0);
check("goal bar output loaded from account", byId["goal-stat-barOutputMulti"].value.indexOf("21.568") === 0);
check("goal stats warning cleared", byId["goal-stats-warning"].textContent === "");
check("goal account status names the account", byId["goal-account-status"].textContent.indexOf("Using your saved account") >= 0);
check("legendary badge shows the account", byId["legendary-badge"].textContent === "Account loaded");
check("legendary status names the account",
  byId["legendary-account-status"].textContent.indexOf("Using your saved account") >= 0);
check("legendary tool loads the account",
  global.LegendaryTool.getState().source === "account" &&
  Math.abs(global.LegendaryTool.getState().rodPower - 441976.14576897986) < 0.01);
check("legendary tool loads the account tick stats",
  global.LegendaryTool.getState().tickReduction === 52 &&
  global.LegendaryTool.getState().doubleTick === 62.5 &&
  global.LegendaryTool.getState().tripleTick === 54.75);
check("legendary tool sees the account poly cards",
  global.LegendaryTool.getState().polyByDock.Lake === true &&
  global.LegendaryTool.getState().polyByDock.Galaxy === true);

check("contract badge shows the account", byId["contracts-badge"].textContent === "Account loaded");
check("contract planner loads the account", global.ContractTool.getState().source === "account" &&
  global.ContractTool.getState().account === "v2.2.20");
check("contract planner loads the account levels",
  global.ContractTool.getState().levels[0] === 15 &&
  global.ContractTool.getState().levels[1] === 19 &&
  global.ContractTool.getState().levels[2] === 7);
check("contract level table shows the account levels",
  byId["contract-level-0"].value === "15" && byId["contract-level-33"].value === "0");
check("contract level table shows the increased caps",
  contractLevelRowsOf()[0].children[4].textContent === "15" &&
  contractLevelRowsOf()[1].children[4].textContent === "19");
check("contract account status shows the gates",
  byId["contracts-account-status"].textContent.indexOf("OB 71") >= 0 &&
  byId["contracts-account-status"].textContent.indexOf("cap +14") >= 0 &&
  byId["contracts-account-status"].textContent.indexOf("cost -12.6%") >= 0);

fire(byId["contracts-view-summary"], "click");
check("contract summary uses the account levels",
  contractSummaryRowsOf()[0].children[2].textContent === "15" &&
  contractSummaryRowsOf()[0].children[3].textContent === "15" &&
  contractSummaryRowsOf()[0].children[7].textContent === "Maxed");
fire(byId["contracts-view-ranking"], "click");

var sampleLocked = global.ContractTool.getState().ranking.filter(function (r) { return r.index === 33; })[0];
check("contract sample locks All Portal Multi", sampleLocked.locked === true && sampleLocked.obMin === 73);
check("contract ranking marks the OB-locked upgrade",
  findContractRankRow(contractRankingRowsOf(), "All Portal Multi").children[7].textContent === "Locked (OB 73)");
check("contract level table greys out the OB-locked upgrade",
  contractLevelRowsOf()[33].className.indexOf("blocked") >= 0);

var sampleContractCtx = global.ContractData.fromExport(window.SAMPLE_EXPORT.stats);
var sampleRefund = global.ContractData.refundFor(sampleContractCtx.levels, sampleContractCtx);
check("contract summary spent matches the respec refund",
  Math.abs(global.ContractTool.getState().summary.totals.spent - sampleRefund) < 1e-6);
var sampleRespec = byId["contracts-mode-respec"];
sampleRespec.checked = true;
fire(sampleRespec, "change");
check("contract respec refunds the account levels",
  Math.abs(global.ContractTool.getState().budget - sampleRefund) < 1e-6);
check("contract respec plans the sample from zero",
  global.ContractTool.getState().plan.startLevels.every(function (v) { return v === 0; }));
check("contract respec spends the sample refund",
  global.ContractTool.getState().spent > 0 &&
  global.ContractTool.getState().spent <= global.ContractTool.getState().budget + 1e-9);
var sampleCurrent = byId["contracts-mode-current"];
sampleCurrent.checked = true;
fire(sampleCurrent, "change");

/* hand-edited levels survive a reload; a fresh import replaces them */
var editedLevel = sampleContractCtx.levels[14] === 5 ? 4 : 5;
byId["contract-level-14"].value = String(editedLevel);
fire(byId["contract-level-14"], "input");
check("contract level edit marks the account levels as edited",
  global.ContractTool.getState().source === "account-edited");
delete require.cache[require.resolve("../contracts.js")];
require("../contracts.js");
global.ContractTool.init();
check("contract reload keeps the edited source", global.ContractTool.getState().source === "account-edited");
check("contract reload keeps the edited level", global.ContractTool.getState().levels[14] === editedLevel);
check("contract reload still applies the account",
  global.ContractTool.getState().account === "v2.2.20" &&
  byId["contracts-account-status"].textContent.indexOf("edited by hand") >= 0 &&
  byId["contracts-account-status"].textContent.indexOf("OB 71") >= 0);
global.ContractTool.refreshAccount();
check("contract import replaces the edited levels",
  global.ContractTool.getState().source === "account" &&
  global.ContractTool.getState().levels[14] === sampleContractCtx.levels[14]);

var imported = ES.apply(ES.parseExport(window.SAMPLE_EXPORT).stats, FM.defaultInputs()).inputs;
var expect = FM.computeModel(imported).rows.filter(function (r) { return r.rankable; });
var rankable = expect.length;

check("sample import keeps 21 rows", rows.length === 21);
check("top row is rank 1", rows[0].children[0].children[0].textContent === "1");

frows = fishRowsOf();
check("sample fish table still 18 rows", frows.length === 18);
check("sample fish maxed (none rankable)", countUnblocked(frows) === 0);

var buyable = 0;
rows.forEach(function (tr) { if (findButton(tr.children[8], "+1").disabled === false) buyable++; });
check("buyable rows match model rankable (" + rankable + ")", buyable === rankable);

/* ---- commit a level ---------------------------------------------- */
var topName = rows[0].children[1].textContent;
var topRow = findByRowName(rows, topName);
var startLevel = parseInt(topRow.children[2].textContent, 10);
check("top row is an expected rankable upgrade", expect[0].name === topName);

fire(findButton(topRow.children[8], "+1"), "click");
rows = rowsOf();
check("still 21 rows after commit", rows.length === 21);
check("undo enabled after commit", byId["btn-undo"].disabled === false);

topRow = findByRowName(rows, topName);
check("purchased row highlighted", topRow.className.indexOf("just-bought") >= 0);
check("level incremented", topRow.children[2].textContent === String(startLevel + 1));

var badges = 0;
rows.forEach(function (tr) { if (tr.children[0].children.length === 2) badges++; });
check("rank movement badge per rankable row (" + rankable + ")", badges === rankable);

/* ---- undo -------------------------------------------------------- */
fire(byId["btn-undo"], "click");
rows = rowsOf();
check("undo disabled again", byId["btn-undo"].disabled === true);
topRow = findByRowName(rows, topName);
check("level reverted", topRow.children[2].textContent === String(startLevel));

/* ---- bomb comparison interactions --------------------------------- */
var levelSel = byId["bomb-level"];
levelSel.value = "4";
fire(levelSel, "change");
check("bomb level changed to Adamant", global.BombTool.getState().level === 4);
check("bomb verdict favours Transmuter at Adamant",
  byId["bomb-verdict-text"].textContent.indexOf("Transmuter Bomb produces") >= 0);

var bopBarsBefore = byId["bomb-bop-bars"].textContent;
byId["bomb-ore"].value = "2000";
fire(byId["bomb-ore"], "input");
check("bomb ore amount is remembered", global.BombTool.getState().ore === 2000);
check("bomb bars scale with the ore amount", byId["bomb-bop-bars"].textContent !== bopBarsBefore);

var bopInput = byId["bomb-stat-bombOfPlentyMulti"];
bopInput.value = "300";
fire(bopInput, "input");
check("bomb manual edit marks the account values as edited",
  global.BombTool.getState().source === "account-edited");

fire(byId["bomb-reset-stats"], "click");
check("bomb reset returns to defaults", global.BombTool.getState().source === "defaults");
check("bomb reset keeps the selected level", global.BombTool.getState().level === 4);

fire(byId["bomb-reload-account"], "click");
check("bomb reload restores the account", global.BombTool.getState().source === "account");
check("bomb reload keeps the selected level", global.BombTool.getState().level === 4);

/* ---- bomb floor mode --------------------------------------------- */
var floorMode = byId["bomb-mode-floor"];
floorMode.checked = true;
fire(floorMode, "change");

check("bomb switches to floor mode", global.BombTool.getState().mode === "floor");
check("bar level field hidden in floor mode", byId["bomb-level-field"].hidden === true);
check("floor controls visible in floor mode",
  byId["bomb-floor-field"].hidden === false &&
  byId["bomb-portal-chance-field"].hidden === false &&
  byId["bomb-portal-multi-field"].hidden === false);
check("floor selector has 132 options", countOptions(byId["bomb-floor"]) === 132);
check("account pre-fills floor 129", global.BombTool.getState().floor === 129);
check("account pre-fills the portal chance", global.BombTool.getState().portalChance === 0);
check("account pre-fills the portal multiplier",
  global.BombTool.getState().portalMulti === 142.2733375);
check("floor select shows the account floor", byId["bomb-floor"].value === "129");
check("floor note names the account floor and zone",
  byId["bomb-floor-note"].textContent.indexOf("Floor 129") >= 0 &&
  byId["bomb-floor-note"].textContent.indexOf("Candyland") >= 0);
check("floor mode rewrites the table heading",
  byId["bomb-table-title"].textContent === "3. Every floor");
check("floor mode rewrites the table lead",
  byId["bomb-table-lead"].textContent.indexOf("132 dungeon floors") >= 0);

check("floor table has 21 zone groups", (function () {
  for (var i = 1; i <= 21; i++) if (!byId["bomb-zone-" + i]) return false;
  return true;
})());
check("Stone group holds a heading plus 8 floors", byId["bomb-zone-1"].children.length === 9);
check("Magma group holds a heading plus 10 floors", byId["bomb-zone-2"].children.length === 11);
check("later zone groups hold a heading plus 6 floors", byId["bomb-zone-3"].children.length === 7);
check("floor table has 132 floor rows", floorTableRowCount() === 132);
check("floor table ends at Neopolium",
  byId["bomb-floor-row-132"].children[1].textContent.indexOf("Neopolium") >= 0);
check("selected floor row is highlighted", byId["bomb-floor-row-129"].className === "selected");
check("floor table summary counts the floors",
  byId["bomb-table-summary"].textContent.indexOf("132 floors") >= 0);
check("floor 129 verdict uses the floor mix",
  byId["bomb-verdict-text"].textContent.indexOf("floor 129") >= 0);
check("floor 129 favours Transmuter",
  byId["bomb-verdict-text"].textContent.indexOf("Transmuter Bomb produces") >= 0);

var floorSel = byId["bomb-floor"];
floorSel.value = "5";
fire(floorSel, "change");
check("floor selection updates the state", global.BombTool.getState().floor === 5);
check("floor 5 note names the Stone zone",
  byId["bomb-floor-note"].textContent.indexOf("Stone") >= 0);
check("floor 5 favours BoP",
  byId["bomb-verdict-text"].textContent.indexOf("Bomb of Plenty produces") >= 0);
check("floor 5 table row is highlighted", byId["bomb-floor-row-5"].className === "selected");
check("native ore rows show both floor ores",
  !!byId["bomb-native-row-3"] && !!byId["bomb-native-row-4"]);
check("native Mithril favours BoP", byId["bomb-native-row-3"].children[5].textContent === "BoP");
check("native Adamant favours Transmuter",
  byId["bomb-native-row-4"].children[5].textContent === "Trans");

var portalChance = byId["bomb-portal-chance"];
var portalMulti = byId["bomb-portal-multi"];
portalChance.value = "100";
fire(portalChance, "input");
portalMulti.value = "4";
fire(portalMulti, "input");
check("portal chance updates the state", global.BombTool.getState().portalChance === 100);
check("portal multiplier updates the state", global.BombTool.getState().portalMulti === 4);
check("floor note shows the portal chance and multiplier",
  byId["bomb-floor-note"].textContent.indexOf("100.00%") >= 0 &&
  byId["bomb-floor-note"].textContent.indexOf("4x") >= 0);
check("floor note shows the portal yield",
  byId["bomb-floor-note"].textContent.indexOf("4x native ore") >= 0);
check("floor 5 still favours BoP through full portals",
  byId["bomb-verdict-text"].textContent.indexOf("Bomb of Plenty produces") >= 0);
check("floor table carries the portal yield", byId["bomb-floor-row-5"].children[2].textContent === "4x");

fire(byId["bomb-reset-stats"], "click");
check("bomb stat reset stays in floor mode", global.BombTool.getState().mode === "floor");
check("bomb stat reset keeps the floor", global.BombTool.getState().floor === 5);
check("bomb stat reset keeps the portal inputs",
  global.BombTool.getState().portalChance === 100 &&
  global.BombTool.getState().portalMulti === 4);
check("bomb stat reset returns to defaults", global.BombTool.getState().source === "defaults");

fire(byId["bomb-reload-account"], "click");
check("bomb reload keeps floor mode", global.BombTool.getState().mode === "floor");
check("bomb reload restores the account floor", global.BombTool.getState().floor === 129);
check("bomb reload restores the account portals",
  global.BombTool.getState().portalChance === 0 &&
  global.BombTool.getState().portalMulti === 142.2733375);

var barMode = byId["bomb-mode-bar"];
barMode.checked = true;
fire(barMode, "change");
check("bar mode shows the level field", byId["bomb-level-field"].hidden === false);
check("bar mode hides the floor controls",
  byId["bomb-floor-field"].hidden === true &&
  byId["bomb-portal-chance-field"].hidden === true &&
  byId["bomb-portal-multi-field"].hidden === true);
check("bar mode restores the table heading",
  byId["bomb-table-title"].textContent === "3. Every bar level");
check("bar mode restores the bar table",
  byId["bomb-table"].children[0].children[0].children.length === 6);

/* winner strip: one cell per level, a click selects it */
check("bomb strip has a cell per bar level", byId["bomb-strip"].children.length === 86);
check("bomb strip colours Mithril BoP and Adamant Transmuter",
  byId["bomb-cell-3"].className.indexOf("bop") >= 0 &&
  byId["bomb-cell-4"].className.indexOf("trans") >= 0);
fire(byId["bomb-cell-10"], "click");
check("bomb strip click selects the level",
  global.BombTool.getState().level === 10 && byId["bomb-level"].value === "10");
check("bomb strip marks the selected cell", byId["bomb-cell-10"].className.indexOf("selected") >= 0);
check("bomb strip is one tab stop", byId["bomb-cell-10"].tabIndex === 0 && byId["bomb-cell-11"].tabIndex === -1);
byId["bomb-strip"]._l.keydown[0]({ key: "ArrowRight", preventDefault: function () {} });
check("bomb strip arrow key moves the selection", global.BombTool.getState().level === 11);
byId["bomb-strip"]._l.keydown[0]({ key: "ArrowLeft", preventDefault: function () {} });

/* the target and hand-edited stats survive a reload; the reload button replaces them */
byId["bomb-ore"].value = "5000";
fire(byId["bomb-ore"], "input");
byId["bomb-stat-bombOfPlentyMulti"].value = "300";
fire(byId["bomb-stat-bombOfPlentyMulti"], "input");
global.BombTool.init();
check("bomb reload keeps the target",
  global.BombTool.getState().mode === "bar" &&
  global.BombTool.getState().level === 10 &&
  global.BombTool.getState().ore === 5000 &&
  byId["bomb-level"].value === "10" && byId["bomb-ore"].value === "5000");
check("bomb reload keeps hand-edited stats",
  global.BombTool.getState().source === "account-edited" &&
  global.BombTool.getState().values.bombOfPlentyMulti === 300 &&
  byId["bomb-stat-bombOfPlentyMulti"].value === "300");
fire(byId["bomb-reload-account"], "click");
check("bomb reload button replaces the hand edits",
  global.BombTool.getState().source === "account" &&
  global.BombTool.getState().values.bombOfPlentyMulti !== 300);
global.BombTool.init();
check("bomb reload of untouched account stats stays on the account",
  global.BombTool.getState().source === "account" && global.BombTool.getState().level === 10);

/* ---- goal bar interactions ---------------------------------------- */
var modeBars = byId["goal-mode-bars"];
modeBars.checked = true;
fire(modeBars, "change");
check("goal switches to bar mode", global.GoalTool.getState().mode === "bars");
check("goal ore target hidden in bar mode", byId["goal-target-ore-field"].hidden === true);
check("goal bar fields visible in bar mode", byId["goal-current-bars-field"].hidden === false &&
  byId["goal-target-bars-field"].hidden === false && byId["goal-level-field"].hidden === false);
check("goal current ore label changes for bars", byId["goal-current-ore-label"].textContent === "Ore already mined");

byId["goal-target-bars"].value = "1000000";
fire(byId["goal-target-bars"], "input");
var goalLevel = byId["goal-level"];
goalLevel.value = "86";
fire(goalLevel, "change");
check("goal bar facts name the selected level", goalText("goal-facts").indexOf("Neopolium") >= 0);
check("goal bar facts show the ore shortfall", goalText("goal-facts").indexOf("Ore still to mine") >= 0);
check("goal bar goal renders an ETA", byId["goal-eta"].textContent.indexOf("hours") >= 0);
check("goal bars progress counts crafted bars", byId["goal-progress-label"].textContent.indexOf("% crafted") >= 0);
check("goal bar milestones rendered", byId["goal-milestones"].children.length > 0);

byId["goal-current-ore"].value = "1000000000";
fire(byId["goal-current-ore"], "input");
check("goal bar goal is ready with stored ore", byId["goal-eta"].textContent === "Ready now");
check("goal ready deadline needs no extra ore", goalText("goal-deadline-result").indexOf("No extra ore needed") >= 0);
byId["goal-current-ore"].value = "1000";
fire(byId["goal-current-ore"], "input");

var barEtaBefore = byId["goal-eta"].textContent;
var goalOutput = byId["goal-stat-barOutputMulti"];
goalOutput.value = "1";
fire(goalOutput, "input");
check("goal manual stat marks the account values as edited",
  global.GoalTool.getState().statsSource === "account-edited");
check("goal manual stat value applied", global.GoalTool.getState().values.barOutputMulti === 1);
check("goal bar ETA changes with a manual stat", byId["goal-eta"].textContent !== barEtaBefore);

fire(byId["goal-reset-stats"], "click");
check("goal stat reset returns to defaults", global.GoalTool.getState().statsSource === "defaults");
check("goal stat reset keeps the bar goal", global.GoalTool.getState().targetBars === 1000000);

fire(byId["goal-reload-account"], "click");
check("goal stat reload restores the account", global.GoalTool.getState().statsSource === "account");

var storedGoal = JSON.parse(global.localStorage.getItem("obelisk-goal-v1"));
check("goal inputs are saved", !!storedGoal && storedGoal.mode === "bars" && storedGoal.targetBars === 1000000);

fire(byId["btn-clear"], "click");
check("bomb reset from the home page returns to defaults", global.BombTool.getState().source === "defaults");
check("bomb reset from the home page returns to bar mode", global.BombTool.getState().mode === "bar");
check("bomb reset restores the floor and portal inputs",
  global.BombTool.getState().floor === 1 &&
  global.BombTool.getState().portalChance === 0 &&
  global.BombTool.getState().portalMulti === 1);
check("bomb reset restores the level and base ore",
  global.BombTool.getState().level === 1 && global.BombTool.getState().ore === 1000);
check("bomb reset shows the bar level controls",
  byId["bomb-level-field"].hidden === false && byId["bomb-floor-field"].hidden === true);
check("bomb badge returns to manual entry", byId["bombs-badge"].textContent === "Manual entry");
check("bomb source label returns to defaults", byId["bomb-stats-source"].textContent.indexOf("Defaults") >= 0);
check("goal reset from the home page returns to manual", byId["goal-badge"].textContent === "Manual entry");
check("goal reset restores ore mode", global.GoalTool.getState().mode === "ore");
check("goal reset clears the measured rate", global.GoalTool.getState().orePerHour === 0);
check("goal reset restores the target", global.GoalTool.getState().currentOre === 0 &&
  global.GoalTool.getState().targetOre === 100000);
check("goal reset clears the deadline", byId["goal-deadline"].value === "");
check("goal reset restores the default stats", byId["goal-stats-source"].textContent.indexOf("Defaults") >= 0);
check("goal reset asks for a rate again", byId["goal-eta-detail"].textContent.indexOf("Enter your ore per hour") >= 0);
check("contract reset returns to manual entry", byId["contracts-badge"].textContent === "Manual entry");
check("contract reset restores the default source", global.ContractTool.getState().source === "defaults");
check("contract reset restores current mode", global.ContractTool.getState().mode === "current");
check("contract reset clears the spare CP", global.ContractTool.getState().spareCp === 0);
check("contract reset clears the completed contracts", global.ContractTool.getState().contractsCompleted === 0);
check("contract reset clears every level",
  global.ContractTool.getState().levels.every(function (v) { return v === 0; }));
check("contract reset restores the ore weight",
  global.ContractTool.getState().weights.ore === 100 &&
  global.ContractTool.getState().weights.veins === 0);
check("contract reset leaves an empty plan",
  global.ContractTool.getState().buys.length === 0 &&
  global.ContractTool.getState().budget === 0);
check("contract reset restores the ranking",
  contractRankingRowsOf().length === 34 &&
  contractRankingRowsOf()[0].children[1].textContent.slice(3) === "Golden Floor Multiplier");
check("legendary reset returns to manual entry", byId["legendary-badge"].textContent === "Manual entry");
check("legendary reset restores Lake", global.LegendaryTool.getState().dock === "Lake");
check("legendary reset clears the rod power", global.LegendaryTool.getState().rodPower === 0);
check("legendary reset restores auto ticks", global.LegendaryTool.getState().ticksAuto === true);
check("contract reset restores the ranking view", global.ContractTool.getState().view === "ranking" &&
  byId["contracts-ranking"].hidden === false && byId["contracts-summary"].hidden === true);
var storedContract = JSON.parse(global.localStorage.getItem("obelisk-contracts-v1"));
check("contract reset saves default inputs", !!storedContract &&
  storedContract.mode === "current" &&
  storedContract.view === "ranking" &&
  storedContract.spareCp === 0 &&
  storedContract.levels.every(function (v) { return v === 0; }));

/* ---- contracts route ---------------------------------------------- */
global.window.location = { hash: "#/contracts" };
delete require.cache[require.resolve("../app.js")];
require("../app.js");
check("contract route shows the contracts view", byId["view-contracts"].hidden === false);
check("contract route hides the home view", byId["view-home"].hidden === true);
check("contract route sets the page title",
  global.document.title === "Contract Point Planner - Obelisk Miner Tools");


/* ---- best floor to farm ------------------------------------------- */
global.window.location = { hash: "#/floors" };
delete require.cache[require.resolve("../app.js")];
require("../app.js");
check("floors route shows the floors view", byId["view-floors"].hidden === false && byId["view-home"].hidden === true);
check("floors route sets the page title", global.document.title === "Best Floor to Farm - Obelisk Miner Tools");
check("floors tool renders without an account", global.FloorTool.getState().account === null &&
  byId["floors-hero"].children.length === 1 && byId["floors-ranking"].children.length > 0);
check("floors ore list has all 86 ores", countOptions(byId["floors-ore"]) === 86);
check("floors vein grid has 21 tiles", byId["floors-vein-grid"].children.length === 21);

global.ObeliskApp.applyImport(window.SAMPLE_EXPORT_V2252, "v2.2.52 sample export");
check("built-in v2.2.52 sample is not recorded in the tracker", global.TrackerTool.getState().snapshots === 2);
var fs1 = global.FloorTool.getState();
check("v2.2.52 sample loads into the floor tool", fs1.account === "v2.2.52" && fs1.env.jsonLoaded === true);
check("floors: Tin on floor 1 with the Void Drone", fs1.result.ranking.length === 20 && fs1.result.ranking[0].floor === 1 && fs1.result.useVoid === true);
check("floors hero names the floor", nodeText(byId["floors-hero"]).indexOf("Farm Tin on floor") >= 0 &&
  nodeText(byId["floors-hero"]).indexOf("89.6%") >= 0);
check("floors alerts list the modifier-floor reminder", nodeText(byId["floors-alerts"]).indexOf("negative ore modifiers") >= 0);
check("floors account status names the version", byId["floors-account-status"].textContent.indexOf("v2.2.52") >= 0);
check("home floors badge shows the account", byId["floors-badge"].textContent === "Account loaded");
check("floors imported-stats mirror lists the sheet's rows", byId["floors-imported"].children[0].children[0].children[1].children.length === 78);
check("floors explorer lists all 132 floors", byId["floors-explorer"].children[1].children[0].children[0].children[2].children.length === 132);

byId["floors-ore"].value = "Lapis";
fire(byId["floors-ore"], "change");
check("floors ore picker re-ranks", global.FloorTool.getState().ore === "Lapis" &&
  global.FloorTool.getState().result.ore.name === "Lapis" && nodeText(byId["floors-alerts"]).indexOf("unable to oneshot") >= 0);

byId["floors-ore"].value = "Tin";
fire(byId["floors-ore"], "change");
byId["floors-void-mode"].value = "off";
fire(byId["floors-void-mode"], "change");
check("floors Void Drone override off shows the 2-floor list", global.FloorTool.getState().result.ranking.length === 2 &&
  global.FloorTool.getState().voidMode === "off" && global.FloorTool.getState().result.autoVoid === "Yes");
byId["floors-void-mode"].value = "auto";
fire(byId["floors-void-mode"], "change");

byId["floors-mode-veins"].checked = true;
fire(byId["floors-mode-veins"], "change");
var fs2 = global.FloorTool.getState();
check("floors vein mode ranks Stone Vein floors 1-8", fs2.mode === "veins" && fs2.result.kind === "vein" &&
  fs2.result.groups[0].label === "1-8" && byId["floors-vein-picker"].hidden === false && byId["floors-ore-picker"].hidden === true);
check("floors vein hero shows the group", nodeText(byId["floors-hero"]).indexOf("1-8") >= 0);

var worldField = byId["floors-f-world"];
worldField.value = "4";
fire(worldField, "input");
var fs3 = global.FloorTool.getState();
check("floors stat edit becomes an override", fs3.overrides.worlds_unlocked === 4 && fs3.env.world === 4);
var stored = JSON.parse(global.localStorage.getItem("obelisk-floors-v1"));
check("floors saves its state", !!stored && stored.mode === "veins" && stored.overrides.worlds_unlocked === 4);

fire(byId["btn-clear"], "click");
var fs4 = global.FloorTool.getState();
check("floors reset restores defaults", fs4.mode === "ore" && fs4.ore === "Tin" && fs4.account === null &&
  Object.keys(fs4.overrides).length === 0 && fs4.voidMode === "auto");

/* ---- max damage calculator --------------------------------------- */
check("damage view hidden by default", byId["view-damage"].hidden === true);
check("damage badge is manual entry", byId["damage-badge"].textContent === "Manual entry");
check("damage starts with maxed contracts", global.DamageTool.getState().contractMode === "maxed");
check("damage starts with all damage items on",
  global.DamageData.ITEMS.every(function (item) { return global.DamageTool.getState().items[item.id] === true; }));
check("damage item cards render", byId["damage-items"].children.length === 9);
check("damage golden controls render", byId["damage-golden"].children.length === 4);
check("damage hero renders", byId["damage-hero"].children.length >= 2);
check("damage stat editor renders three groups", byId["damage-stats-editor"].children.length === 3);
check("damage contract table has 10 rows",
  byId["damage-contracts"].children[0].children[0].children[1].children.length === 10);
check("damage item table has 9 rows",
  byId["damage-item-table"].children[0].children[0].children[1].children.length === 9);

var damageAllMax = global.DamageTool.getState().result.scenario.pickaxe.hit.max;
fire(byId["damage-items-none"], "click");
var damageNoneMax = global.DamageTool.getState().result.scenario.pickaxe.hit.max;
check("damage none preset turns every item off",
  global.DamageData.ITEMS.every(function (item) { return global.DamageTool.getState().items[item.id] === false; }));
check("damage consumables increase the maximum hit", damageAllMax > damageNoneMax);

global.DamageTool.resetAll();
global.ObeliskApp.applyImport(window.SAMPLE_EXPORT_V2252, "v2.2.52 sample export");
check("damage sample loads into the tool", global.DamageTool.getState().source === "account");
check("damage sample detects active consumables",
  global.DamageTool.getState().result.activeItems.apple === true &&
  global.DamageTool.getState().result.activeItems.rockCake === false);
check("damage sample reads the armour reduction stat",
  Math.abs(parseFloat(byId["damage-stat-obelisk_armor_reduction"].value) - 0.12) < 1e-9);
var damageTargetOb = byId["damage-target-ob"];
damageTargetOb.value = "62";
fire(damageTargetOb, "input");
check("damage armour card shows the reduced OB62 armour",
  nodeText(byId["damage-hero"]).indexOf("73.1oc") >= 0);
var damageArmorTableText = nodeText(byId["damage-armor-levels"]);
check("damage armour table lists the next levels",
  damageArmorTableText.indexOf("Next Obelisk armour checks") >= 0 &&
  damageArmorTableText.indexOf("OB 66") >= 0);
check("damage armour table shows not-met thresholds",
  damageArmorTableText.indexOf("Not met") >= 0);
damageTargetOb.value = "0";
fire(damageTargetOb, "input");
var damageSampleMax = global.DamageTool.getState().result.scenario.pickaxe.hit.max;
check("damage sample max hit beats the current hit",
  damageSampleMax > global.DamageTool.getState().result.current.pickaxe.hit.max);
check("damage sample contract table shows the maxed cap",
  byId["damage-contracts"].children[0].children[0].children[1].children[0].children[2].textContent === "10");

var damageCurrentRadio = byId["damage-contracts-current"];
damageCurrentRadio.checked = true;
fire(damageCurrentRadio, "change");
check("damage current contract mode updates the state", global.DamageTool.getState().contractMode === "current");
check("damage current contract mode lowers the max hit",
  global.DamageTool.getState().result.scenario.pickaxe.hit.max < damageSampleMax);
var damageMaxRadio = byId["damage-contracts-max"];
damageMaxRadio.checked = true;
fire(damageMaxRadio, "change");
check("damage maxed contract mode restores the state", global.DamageTool.getState().contractMode === "maxed");

var damageContracts = byId["damage-contracts-completed"];
damageContracts.value = "100";
fire(damageContracts, "input");
check("damage contracts completed updates the state", global.DamageTool.getState().contractsCompleted === 100);
check("damage per-contract upgrades grow with completions",
  global.DamageTool.getState().result.scenario.pickaxe.contractBaseFactor > 1);
damageTargetOb.value = "62";
fire(damageTargetOb, "input");
check("damage armour table updates with contract completions",
  nodeText(byId["damage-armor-levels"]).indexOf("Met") >= 0);
damageTargetOb.value = "0";
fire(damageTargetOb, "input");

/* damage stat edits survive a reload and clear on a new import */
global.ObeliskApp.applyImport(window.SAMPLE_EXPORT, "sample export");
check("damage import loads the v2.2.20 account",
  global.DamageTool.getState().source === "account" &&
  global.DamageTool.getState().account.version === "v2.2.20");
var damageStat = byId["damage-stat-pickaxe_damage"];
damageStat.value = "12345";
fire(damageStat, "input");
check("damage stat edit marks the account as edited",
  global.DamageTool.getState().source === "account-edited");
check("damage stat edit is stored as an override",
  global.DamageTool.getState().overrides.pickaxe_damage === 12345);
delete require.cache[require.resolve("../damage.js")];
require("../damage.js");
global.DamageTool.init();
check("damage reload keeps the stat edit",
  global.DamageTool.getState().overrides.pickaxe_damage === 12345 &&
  global.DamageTool.getState().source === "account-edited");
global.ObeliskApp.applyImport(window.SAMPLE_EXPORT_V2252, "v2.2.52 sample export");
check("a new import clears the damage stat edits",
  Object.keys(global.DamageTool.getState().overrides).length === 0 &&
  global.DamageTool.getState().source === "account");
check("legendary tool follows the newer import",
  global.LegendaryTool.getState().source === "account" &&
  Math.abs(global.LegendaryTool.getState().rodPower - 86007.636) < 0.01);

/* ---- legendary route ---------------------------------------------- */
global.window.location = { hash: "#/legendary" };
delete require.cache[require.resolve("../app.js")];
require("../app.js");
check("legendary route shows the legendary view",
  byId["view-legendary"].hidden === false && byId["view-home"].hidden === true);
check("legendary route sets the page title",
  global.document.title === "Legendary Fish - Average Catch Time");
check("legendary route keeps the dock table", legendaryDockRowsOf().length === 11);

console.log("rows: " + rows.length + " | rankable: " + rankable + " | top: " + topName + " | badges: " + badges);
console.log(fails === 0 ? "UI SMOKE OK" : fails + " FAILED");
process.exitCode = fails === 0 ? 0 : 1;
