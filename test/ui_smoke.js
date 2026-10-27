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
    setAttribute: function () {}, getAttribute: function () { return null; }
  };
  Object.defineProperty(n, "textContent", { get: function () { return this._text; }, set: function (v) { this._text = v; } });
  Object.defineProperty(n, "innerHTML", { get: function () { return this._text; }, set: function (v) { this._text = v; this.children = []; } });
  Object.defineProperty(n, "id", {
    get: function () { return this._id; },
    set: function (v) { this._id = v; byId[v] = this; }
  });
  return n;
}

function fire(node, type) {
  var hs = node && node._l && node._l[type];
  if (hs) hs.forEach(function (h) { h({ preventDefault: function () {} }); });
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
  createElement: makeNode,
  getElementById: function (id) { return byId[id] || (byId[id] = makeNode("div")); },
  addEventListener: function () {},
  body: makeNode("body")
};
global.FileReader = function () { this.readAsText = function () {}; };

require("../model.js");
require("../data.js");
require("../fishcosts.js");
require("../exportstats.js");
require("../account.js");
require("../sample.js");
require("../bombdata.js");
require("../goaldata.js");
require("../bombs.js");
require("../goals.js");
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
fire(byId["btn-sample"], "click");
rows = rowsOf();

var storedAccount = global.AccountStore.load();
check("sample import saves the account record", !!storedAccount && storedAccount.version === "v2.2.20");
check("account record keeps the raw export", !!storedAccount && storedAccount.raw.indexOf("fishing_enhance_array") >= 0);
check("account summary rendered", byId["account-summary"].children.length > 0);
check("fishing tool badge shows the account", byId["fishing-badge"].textContent === "Account loaded");
check("bomb tool badge shows the account", byId["bombs-badge"].textContent === "Account loaded");
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

console.log("rows: " + rows.length + " | rankable: " + rankable + " | top: " + topName + " | badges: " + badges);
console.log(fails === 0 ? "UI SMOKE OK" : fails + " FAILED");
process.exitCode = fails === 0 ? 0 : 1;
