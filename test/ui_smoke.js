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

var byId = {};
global.window = global;
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
require("../sample.js");
require("../app.js");

var FM = global.FishModel;
var ES = global.ExportStats;

var fails = 0;
function check(name, cond) { if (!cond) { fails++; console.log("FAIL " + name); } }

/* ---- default-state render ---------------------------------------- */
var rows = rowsOf();
check("settings has 3 fields", byId["settings"].children.length === 3);
check("upgrades rendered", byId["upgrades"].children.length >= 3);
check("cards table rendered", byId["cards"].children.length >= 2);
check("scalars rendered", byId["scalars"].children.length >= 5);
check("results table has 21 rows", rows.length === 21);
check("results row has 10 cells", rows[0].children.length === 10);
check("undo disabled with no history", byId["btn-undo"].disabled === true);

var frows = fishRowsOf();
check("fish table has 18 rows", frows.length === 18);
check("fish row has 10 cells", frows[0].children.length === 10);
check("fish rankable in default state (rod+drone)", countUnblocked(frows) === 2);

/* ---- sample import ----------------------------------------------- */
fire(byId["btn-sample"], "click");
rows = rowsOf();

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

console.log("rows: " + rows.length + " | rankable: " + rankable + " | top: " + topName + " | badges: " + badges);
console.log(fails === 0 ? "UI SMOKE OK" : fails + " FAILED");
process.exitCode = fails === 0 ? 0 : 1;
