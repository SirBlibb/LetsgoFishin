/*
 * FishModel — direct port of the "Obefish" sheet from
 * "Let's Go Fishing - V2.0.6" (game v2.1.2).
 *
 * Pure functions, no DOM. Exposed as window.FishModel so the site works
 * straight off the filesystem with classic <script> tags.
 *
 * Naming mirrors the spreadsheet:
 *   AI3/AI5/...  "Fish / Time" building blocks (base, drone, rod, cards, ...)
 *   AI34         final base Fish/Time for the current build
 *   AY<row>      Fish/Time after buying the next level of that upgrade
 *   AU<row>      gem cost of that next level
 *   AZ<row>      ranking score: (AY-AI34)/AU  or, in "exponential" mode,
 *                (1+growth)^(100000/AU)
 */
(function (global) {
  "use strict";

  /* ------------------------------------------------------------------ */
  /* Docks                                                              */
  /* ------------------------------------------------------------------ */

  var DOCKS = [
    { id: "Lake", row: 3, base: 5, tier: 1 },
    { id: "Desert", row: 4, base: 8, tier: 1 },
    { id: "Tundra", row: 5, base: 12, tier: 1 },
    { id: "Ocean", row: 6, base: 16, tier: 1 },
    { id: "Nuclear", row: 7, base: 22, tier: 1 },
    { id: "Abyss", row: 8, base: 30, tier: 2 },
    { id: "Cave", row: 10, base: 40, tier: 2 },
    { id: "Volcano", row: 11, base: 50, tier: 2 },
    { id: "Sky", row: 12, base: 60, tier: 2 },
    { id: "Solaris", row: 13, base: 70, tier: 2 },
    { id: "Galaxy", row: 14, base: 80, tier: 2 }
  ];

  var DOCK_BY_ID = {};
  DOCKS.forEach(function (d) { DOCK_BY_ID[d.id] = d; });

  // COUNTIF(AE3:AE11,">0") -> the first 8 docks.
  var COUNTIF8 = ["Lake", "Desert", "Tundra", "Ocean", "Nuclear", "Abyss", "Cave", "Volcano"];

  /* ------------------------------------------------------------------ */
  /* Gem-purchasable upgrades (the things we rank)                      */
  /* ------------------------------------------------------------------ */

  var GEM_UPGRADES = [
    { row: 22, g: 22, name: "Fish Multiplier", max: 255, group: "Enhance" },
    { row: 23, g: 23, name: "Fishing Drone (x1)", max: 25, group: "Enhance" },
    { row: 24, g: 24, name: "Rod Multiplier", max: 20, group: "Enhance" },
    { row: 25, g: 25, name: "Tick Speed", max: 20, group: "Enhance" },
    { row: 26, g: 26, name: "Drone Multiplier", max: 25, group: "Enhance" },
    { row: 27, g: 27, name: "Token Multiplier", max: 20, group: "Enhance" },
    { row: 28, g: 28, name: "Double Tick Chance", max: 20, group: "Enhance" },
    { row: 29, g: 29, name: "Tiny Notice Chance", max: 20, group: "Enhance" },
    { row: 30, g: 30, name: "Shiny Multiplier", max: 20, group: "Enhance" },
    { row: 31, g: 31, name: "Fishing Drone (x3)", max: 20, group: "Enhance" },
    { row: 32, g: 32, name: "Tier 2 Dock Ticks", max: 10, group: "Enhance" },
    { row: 33, g: 33, name: "Triple Tick Chance", max: 20, group: "Enhance" },
    { row: 34, g: 34, name: "Super Shiny Multiplier", max: 20, group: "Enhance" },
    { row: 35, g: 35, name: "Tier 2 Dock Power", max: 20, group: "Enhance" },
    { row: 36, g: 36, name: "Poly Card Multi", max: 20, group: "Enhance" },
    { row: 38, g: 38, name: "Fishing With Friends", max: 3, group: "Skill Tree" },
    { row: 39, g: 39, name: "Let's Pick Up The Pace", max: 3, group: "Skill Tree" },
    { row: 40, g: 40, name: "Friendship Ended With Tier 1 Items", max: 3, group: "Skill Tree" },
    { row: 41, g: 41, name: "With This Fish I Summon Two More Fish", max: 3, group: "Skill Tree" },
    { row: 42, g: 42, name: "Motley School", max: 3, group: "Skill Tree" },
    { row: 43, g: 43, name: "Completionist Gatekeeper", max: 3, group: "Skill Tree" }
  ];

  /* ------------------------------------------------------------------ */
  /* Spreadsheet helpers                                                */
  /* ------------------------------------------------------------------ */

  function rd(x) { return Math.floor(x); }        // ROUNDDOWN (values >= 0)
  function r0(x) { return Math.round(x); }        // ROUND(x,0)
  function num(x) { var n = Number(x); return isFinite(n) ? n : 0; }
  function blank(x) { return x === null || x === undefined || x === ""; }

  // SWITCH(AD16, 0,1, 1,1.02, 2,1.05, 3,1.1, 4,1+(C41/100)) wrapped in IFERROR(...,1)
  function rodCardFactor(rodCard, c41) {
    var v = num(rodCard);
    if (v === 0) return 1;
    if (v === 1) return 1.02;
    if (v === 2) return 1.05;
    if (v === 3) return 1.1;
    if (v === 4) return 1 + num(c41) / 100;
    return 1;
  }

  /* ------------------------------------------------------------------ */
  /* Inputs                                                             */
  /* ------------------------------------------------------------------ */

  function defaultInputs() {
    return {
      dock: "Lake",
      rodCard: 0,          // AD16 (Fishing Rod legendary card, 0-4)
      expMode: false,      // R18 — rank by growth per million gems
      hideLocked: false,   // UI preference: hide upgrades blocked by prerequisites
      C: {
        3: 0,        // Fishing Drone Base Power stat
        5: false,    // 3x Fishing Tick Speed
        7: 0,        // Fishing Tick 5x Chance stat
        9: false,    // Fish Bundle
        10: false,   // Polychrome Potency Bundle
        12: 0,       // Fishing Drone Power stat
        14: false,   // Shiny Fish Multiplier +10%
        16: 0,       // Mr Nibbles level
        17: false,   // Dr Cool Skin
        18: null,    // Mr Nibbles' Quest (blank = not done)
        20: false,   // Gilded Statue of Craftmanship
        21: false,   // Platinum Statue of Craftmanship
        23: 0,       // Cetus level
        24: 0,       // Super Star level
        25: false,   // Black Hole >= 10
        27: 0,       // Astraeus level
        28: 0,       // Poseidon level
        29: 0,       // Tethys level
        30: 0,       // Ares level
        32: false,   // Abyss Tribute >= 1
        36: false,   // Legendary Hauler Bundle
        37: false,   // Halfway Package
        39: 0,       // (pace bonus %)
        40: 0,       // (multiplier bonus %)
        41: 0,       // (rod card bonus %)
        43: 0        // gems per hour
      },
      G: (function () { var g = {}; for (var r = 3; r <= 43; r++) g[r] = 0; return g; })(),
      cards: (function () {
        var c = {};
        DOCKS.forEach(function (d) { c[d.id] = { t1: [0, 0, 0, 0], ae: 0, af: 0 }; });
        return c;
      })()
    };
  }

  /* ------------------------------------------------------------------ */
  /* Card-derived helpers                                               */
  /* ------------------------------------------------------------------ */

  function droneCountAll(inputs) {
    return DOCKS.filter(function (d) { return num(inputs.cards[d.id].ae) > 0; }).length;
  }
  function countAECountif8(inputs) {
    return COUNTIF8.filter(function (id) { return num(inputs.cards[id].ae) > 0; }).length;
  }
  function ad19(inputs) {
    var s = 0;
    DOCKS.forEach(function (d) {
      var c = inputs.cards[d.id];
      s += num(c.t1[0]) + num(c.t1[1]) + num(c.t1[2]) + num(c.t1[3]) + num(c.ae);
    });
    return s;
  }

  /* ------------------------------------------------------------------ */
  /* Dock tick columns AI / AJ / AK                                     */
  /* ------------------------------------------------------------------ */

  function dockTick(dockId, col, inputs) {
    var f = inputs.C[32] ? 0.9 : 1;
    var g32 = num(inputs.G[32]);
    var g42 = num(inputs.G[42]);
    var base = DOCK_BY_ID[dockId].base;
    var v;
    if (dockId === "Abyss") {
      v = (col === "AK") ? (30 - (g42 + 1) * 2) : (30 - g42 * 2);
    } else if (DOCK_BY_ID[dockId].tier === 1) {
      v = base;
    } else {
      if (col === "AI") v = base - g32 - g42;
      else if (col === "AJ") v = base - (g32 + 1) - g42;
      else v = base - (g32 + 1) - (g42 + 1);
    }
    return rd(v * f);
  }

  function dockT1Sum(dockId, inputs) {
    var c = inputs.cards[dockId];
    return num(c.t1[0]) + num(c.t1[1]) + num(c.t1[2]) + num(c.t1[3]);
  }

  function tickPoly(p27, p29, p31) {
    var a = 1 - p27, b = 1 - p29, c = 1 - p31;
    return 1 * a * b * c
      + 2 * p27 * b * c
      + 3 * a * p29 * c
      + 5 * a * b * p31
      + 6 * p27 * p29 * c
      + 10 * p27 * b * p31
      + 15 * a * p29 * p31
      + 30 * p27 * p29 * p31;
  }

  // VLOOKUP(B34, AH36:AL46, col):  2 -> AI, 3 -> AJ, 4 -> AK, 5 -> AL (T1 sum)
  function lookupDockCol(dockId, col, inputs) {
    if (col === 2) return dockTick(dockId, "AI", inputs);
    if (col === 3) return dockTick(dockId, "AJ", inputs);
    if (col === 4) return dockTick(dockId, "AK", inputs);
    if (col === 5) return dockT1Sum(dockId, inputs);
    throw new Error("bad lookup col");
  }

  var TIER2_TAIL = { Cave: 1, Volcano: 1, Sky: 1, Solaris: 1, Galaxy: 1 };
  function isTier2Tail(dockId) { return !!TIER2_TAIL[dockId]; }
  function matchDock(dockId, inputs) { return isTier2Tail(dockId); }

  /* ------------------------------------------------------------------ */
  /* AI helpers                                                         */
  /* ------------------------------------------------------------------ */

  function computeHelpers(inputs) {
    var C = inputs.C, G = inputs.G;
    var h = {};
    var f = function (g) { return num(G[g]); };
    var match = matchDock(inputs.dock, inputs);

    var t2count = droneCountAll(inputs);
    var c8 = countAECountif8(inputs);
    var ad = ad19(inputs);
    var lake = inputs.cards["Lake"];
    var galaxy = inputs.cards["Galaxy"];

    // AI3 — Fishing Rod Power
    h.AL3 = 1 + 0.04 * f(8);
    h.AM3 = 1 + 0.05 * f(24);
    h.AN3 = 1 + 0.1 * f(42);
    h.AO3 = rodCardFactor(inputs.rodCard, C[41]);
    h.AP3 = 1 + 0.1 * num(C[37]);
    h.AI3 = r0(Math.pow(1.16, f(3)) * 10) * h.AL3 * h.AM3 * h.AN3 * h.AO3 * h.AP3;

    // AI5 — Fishing Drone Capacity
    h.AJ5 = f(4);
    h.AK5 = 2 * f(11);
    h.AL5 = 1 + 0.05 * f(20);
    h.AM5 = f(23);
    h.AN5 = 3 * f(31);
    h.AO5 = 5 * f(38);
    h.AP5 = 5 * f(42);
    h.AQ5 = (num(galaxy.ae) > 0 && num(C[30]) > 0) ? 50 : 0;
    h.AI5 = rd((h.AJ5 + h.AK5 + h.AM5 + h.AN5 + h.AO5 + h.AP5 + h.AQ5) * h.AL5);

    // AI7 — Fishing Drone Base Power
    h.AJ7 = 3;
    h.AK7 = 0.25 * f(13);
    h.AL7 = (num(lake.t1[0]) > 2) ? 0.25 * num(C[28]) : 0;
    h.AM7 = 0.1 * num(C[3]);
    h.AI7 = h.AJ7 + h.AK7 + h.AL7 + h.AM7;

    // AI9 — Drone Power Multiplier
    h.AJ9 = 1 + 0.06 * f(9);
    h.AK9 = 1 + 0.08 * f(26);
    h.AL9 = 1 + 0.1 * f(38);
    h.AM9 = 1 + 0.02 * num(C[12]);
    h.AN9 = 1 + 0.02 * f(43) * t2count;
    h.AO9 = (num(lake.ae) > 1) ? 1 + 0.0005 * num(C[29]) : 1;
    h.AP9 = (num(galaxy.ae) > 0) ? 1 + 0.0001 * num(C[30]) : 1;
    h.AI9 = h.AJ9 * h.AK9 * h.AL9 * h.AM9 * h.AN9 * h.AO9 * h.AP9;

    // AI11 — Tier 2 Dock Power
    h.AJ11 = 0.05 * f(17);
    h.AK11 = 0.05 * f(35);
    h.AL11 = 0.03 * f(43) * t2count;
    h.AM11 = (num(lake.ae) > 1) ? 0.0005 * num(C[29]) : 0;
    h.AN11 = blank(C[18]) ? 0 : num(C[18]) * 0.05 + 0.05;
    h.AO11 = num(C[25]) ? 0.25 : 0;
    h.AP11 = 0.1 * num(C[36]);
    h.AP12 = blank(C[39]) ? 0 : num(C[39]) / 100;
    h.AI11 = (1 + h.AJ11 + h.AK11) * (1 + h.AL11) * (1 + h.AM11) *
             (1 + h.AN11) * (1 + h.AO11) * (1 + h.AP11) * (1 + h.AP12);

    // AI14 — Fish Income Multiplier
    h.AJ14 = 1 + 0.03 * f(7);
    h.AK14 = 1 + 0.05 * f(22);
    h.AL14 = 0.03 * f(38);
    h.AM14 = 0.01 * f(41) * ad;
    h.AN14 = C[21] ? 1.4 : (C[20] ? 1.25 : 1);
    h.AO14 = 1 + 0.02 * num(C[23]);
    h.AP14 = num(C[24]) * 0.0125;
    h.AP16 = 0.1 * num(C[36]);
    h.AI14 = h.AJ14 * h.AK14 * h.AN14 * h.AO14 *
             (1 + h.AL14 + h.AM14) * (1 + h.AP14) * (1 + h.AP16);

    // AI16 — Super Shiny Fish Chance
    h.AJ16 = 0.005 * f(12);
    h.AK16 = 0.001 * f(41) * ad;
    h.AL16 = num(C[17]) ? 0.02 : 0;
    h.AI16 = h.AJ16 + h.AK16 + h.AL16;

    // AI18 — Shiny Multiplier
    h.AJ18 = 5;
    h.AK18 = 1 + 0.05 * f(16);
    h.AL18 = 1 + 0.05 * f(30);
    h.AM18 = 1 + 0.03 * num(C[16]);
    h.AN18 = num(C[14]) ? 1.1 : 1;
    h.AI18 = h.AJ18 * h.AK18 * h.AL18 * h.AM18 * h.AN18;

    // AI20 — Super Shiny Fish Chance
    h.AJ20 = 0.01 * f(43) * t2count;
    h.AK20 = 0.01 * f(18);
    h.AI20 = h.AJ20 + h.AK20;

    // AI22 — Super Shiny Multiplier
    h.AJ22 = 3;
    h.AK22 = 0.15 * f(34);
    h.AL22 = (num(lake.ae) > 1) ? 1 + 0.0005 * num(C[29]) : 1;
    h.AM22 = num(C[32]) ? 3 : 0;
    h.AI22 = (h.AJ22 + h.AK22 + h.AM22) * h.AL22;

    // AI25 — Fishing Tick (seconds)
    h.AJ25 = 60;
    h.AK25 = 0.5 * f(6);
    h.AL25 = 0.5 * f(25);
    h.AM25 = 2 * f(39);
    h.AN25 = num(C[5]) ? 3 : 1;
    h.AI25 = (h.AJ25 - h.AK25 - h.AL25 - h.AM25) / h.AN25;

    // AI27 / AI29 / AI31 — tick probabilities
    h.AJ27 = 0.005 * f(10);
    h.AK27 = 0.005 * f(28);
    h.AL27 = 0.02 * f(39);
    h.AM27 = 0.0003 * num(C[27]);
    h.AI27 = h.AJ27 + h.AK27 + h.AL27 + h.AM27;

    h.AJ29 = num(C[9]) ? 0.1 : 0;
    h.AK29 = 0.0035 * f(14);
    h.AL29 = 0.004 * f(33);
    h.AM29 = 0.01 * f(39);
    h.AN29 = 0.01 * num(C[16]);
    h.AI29 = h.AJ29 + h.AK29 + h.AL29 + h.AM29 + h.AN29;

    h.AJ31 = 0.02 * num(C[7]);
    h.AK31 = 0.03 * num(C[36]);
    h.AL31 = blank(C[40]) ? 0 : num(C[40]) / 100;
    h.AI31 = h.AJ31 + h.AK31 + h.AL31;

    // AI34 = Fish/Time pieces
    h.AJ34 = (h.AI3 + h.AI5 * h.AI7 * h.AI9) * (match ? h.AI11 : 1);
    h.AK34 = h.AI14 * ((1 - h.AI16) * 1 +
                       h.AI16 * (1 - h.AI20) * h.AI18 +
                       h.AI16 * h.AI20 * h.AI18 * h.AI22);
    h.AL34 = (h.AI25 / tickPoly(h.AI27, h.AI29, h.AI31)) * lookupDockCol(inputs.dock, 2, inputs);
    h.AI34 = h.AJ34 * h.AK34 / h.AL34;

    h._t2count = t2count;
    h._c8 = c8;
    h._ad = ad;
    h._match = match;
    return h;
  }

  /* ------------------------------------------------------------------ */
  /* Next-level gem cost (AU)                                           */
  /* ------------------------------------------------------------------ */

  function costAU(row, G) {
    var g = function (r) { return num(G[r]); };
    switch (row) {
      case 22: return (500 + 500 * g(22)) > 99999 ? 99999 : (500 + 500 * g(22));
      case 23: return 750 + 500 * g(23);
      case 24: return 850 + 750 * g(24);
      case 25: return 1000 + 750 * g(25);
      case 26: return 1150 + 850 * g(26);
      case 27: return 1250 + 950 * g(27);
      case 28: return 1450 + 1050 * g(28);
      case 29: return 1750 + 1125 * g(29);
      case 30: return 1950 + 1325 * g(30);
      case 31: return 2450 + 1775 * g(31);
      case 32: return 15000 + 5000 * g(32);
      case 33: return 4450 + 3475 * g(33);
      case 34: return 5550 + 4250 * g(34);
      case 35: return 7550 + 4950 * g(35);
      case 36: return 9550 + 6250 * g(36);
      case 38: return [5000, 6250, 7750][g(38)] || 7750;
      case 39: return [5000, 6250, 7750][g(39)] || 7750;
      case 40: return [6250, 7750, 9750][g(40)] || 9750;
      case 41: return [6250, 7750, 9750][g(41)] || 9750;
      case 42: return [12500, 15625, 19500][g(42)] || 19500;
      case 43: return [12500, 15625, 19500][g(43)] || 19500;
    }
    throw new Error("no cost for row " + row);
  }

  /* ------------------------------------------------------------------ */
  /* Per-upgrade "next level" Fish/Time (AY)                            */
  /* ------------------------------------------------------------------ */

  function computeAY(row, inputs, h) {
    var C = inputs.C, G = inputs.G;
    var f = function (g) { return num(G[g]); };
    var t2count = h._t2count, c8 = h._c8, ad = h._ad, match = h._match;
    var d = inputs.dock;
    var AV;

    switch (row) {
      case 22:
        AV = h.AJ14 * (1 + 0.05 * (f(22) + 1)) * h.AN14 * h.AO14 *
             (1 + h.AL14 + h.AM14) * (1 + h.AP14) * (1 + h.AP16);
        return h.AJ34 * (AV * ((1 - h.AI16) * 1 + h.AI16 * (1 - h.AI20) * h.AI18 +
               h.AI16 * h.AI20 * h.AI18 * h.AI22)) / h.AL34;

      case 23:
        AV = ((f(23) + 1) + h.AJ5 + h.AK5 + h.AN5 + h.AO5 + h.AP5 + h.AQ5) * h.AL5;
        return ((h.AI3 + (AV * h.AI7 * h.AI9)) * (match ? h.AI11 : 1)) * h.AK34 / h.AL34;

      case 24:
        AV = r0(Math.pow(1.16, f(3)) * 10) * h.AL3 * (1 + 0.05 * (f(24) + 1)) *
             h.AN3 * h.AO3 * h.AP3;
        return ((AV + (h.AI5 * h.AI7 * h.AI9)) * (match ? h.AI11 : 1)) * h.AK34 / h.AL34;

      case 25:
        AV = (h.AJ25 - h.AK25 - (0.5 * (f(25) + 1)) - h.AM25) / h.AN25;
        return h.AJ34 * h.AK34 /
               ((AV / tickPoly(h.AI27, h.AI29, h.AI31)) * lookupDockCol(d, 2, inputs));

      case 26:
        AV = (1 + 0.08 * (f(26) + 1)) * (h.AI9 / h.AK9);
        return ((h.AI3 + (h.AI5 * h.AI7 * AV)) * (match ? h.AI11 : 1)) * h.AK34 / h.AL34;

      case 28:
        AV = h.AJ27 + (0.005 * (f(28) + 1)) + h.AL27 + h.AM27;
        return h.AJ34 * h.AK34 /
               ((h.AI25 / tickPoly(AV, h.AI29, h.AI31)) * lookupDockCol(d, 2, inputs));

      case 30:
        AV = (1 + 0.05 * (f(30) + 1)) * (h.AI18 / h.AL18);
        return h.AJ34 * (h.AI14 * ((1 - h.AI16) * 1 + h.AI16 * (1 - h.AI20) * AV +
               h.AI16 * h.AI20 * AV * h.AI22)) / h.AL34;

      case 31:
        AV = ((3 * (f(31) + 1)) + h.AJ5 + h.AK5 + h.AM5 + h.AO5 + h.AP5 + h.AQ5) * h.AL5;
        return ((h.AI3 + (AV * h.AI7 * h.AI9)) * (match ? h.AI11 : 1)) * h.AK34 / h.AL34;

      case 32:
        return h.AJ34 * h.AK34 /
               ((h.AI25 / tickPoly(h.AI27, h.AI29, h.AI31)) * lookupDockCol(d, 3, inputs));

      case 33:
        AV = (0.004 * (f(33) + 1)) + h.AJ29 + h.AK29 + h.AM29 + h.AN29;
        return h.AJ34 * h.AK34 /
               ((h.AI25 / tickPoly(h.AI27, AV, h.AI31)) * lookupDockCol(d, 2, inputs));

      case 34:
        AV = (h.AJ22 + 0.15 * (f(34) + 1) + h.AM22) * h.AL22;
        return h.AJ34 * (h.AI14 * ((1 - h.AI16) * 1 + h.AI16 * (1 - h.AI20) * h.AI18 +
               h.AI16 * h.AI20 * h.AI18 * AV)) / h.AL34;

      case 35:
        AV = (1 + h.AJ11 + 0.05 * (f(35) + 1)) * (1 + h.AL11) * (1 + h.AM11) *
             (1 + h.AN11) * (1 + h.AO11) * (1 + h.AP11) * (1 + h.AP12);
        return ((h.AI3 + (h.AI5 * h.AI7 * h.AI9)) * (match ? AV : 1)) * h.AK34 / h.AL34;

      case 36: {
        if (f(15) < 5) return null;
        if (f(36) >= 20) return null;
        var base0 = (4 + 0.08 * f(19) + 0.1 * f(36)) * (num(C[10]) ? 1.15 : 1);
        var newv = (4 + 0.08 * f(19) + 0.1 * (f(36) + 1)) * (num(C[10]) ? 1.15 : 1);
        var ratio = (lookupDockCol(d, 5, inputs) >= 12) ? (newv / base0 - 1) : 0;
        return h.AI34 * (1 + ratio);
      }

      case 38: {
        var AV38 = ((5 * (f(38) + 1)) + h.AJ5 + h.AK5 + h.AM5 + h.AN5 + h.AP5 + h.AQ5) * h.AL5;
        var AW38 = (1 + 0.1 * (f(38) + 1)) * (h.AJ9 * h.AK9 * h.AM9 * h.AN9 * h.AO9);
        var AX38 = h.AJ14 * h.AK14 * h.AN14 * h.AO14 *
                   (1 + 0.03 * (f(38) + 1) + h.AM14) * (1 + h.AP14) * (1 + h.AP16);
        return ((h.AI3 + (AV38 * h.AI7 * AW38)) * (match ? h.AI11 : 1)) *
               (AX38 * ((1 - h.AI16) * 1 + h.AI16 * (1 - h.AI20) * h.AI18 +
                h.AI16 * h.AI20 * h.AI18 * h.AI22)) / h.AL34;
      }

      case 39: {
        var AV39 = (h.AJ25 - h.AK25 - h.AL25 - (2 * (f(39) + 1))) / h.AN25;
        var AW39 = (0.02 * (f(39) + 1)) + h.AJ27 + h.AK27 + h.AM27;
        var AX39 = (0.01 * (f(39) + 1)) + h.AJ29 + h.AK29 + h.AL29 + h.AN29;
        return h.AJ34 * h.AK34 /
               ((AV39 / tickPoly(AW39, AX39, h.AI31)) * lookupDockCol(d, 2, inputs));
      }

      case 40:
        return h.AI34;

      case 41: {
        var AV41 = h.AJ14 * h.AK14 * h.AN14 * h.AO14 *
                   (1 + h.AL14 + (0.01 * (f(41) + 1) * ad)) * (1 + h.AP14);
        var AW41 = h.AJ16 + h.AL16 + (0.001 * (f(41) + 1) * ad);
        return h.AJ34 * (AV41 * ((1 - AW41) * 1 + AW41 * (1 - h.AI20) * h.AI18 +
               AW41 * h.AI20 * h.AI18 * h.AI22)) / h.AL34;
      }

      case 42: {
        var AV42 = r0(Math.pow(1.16, f(3)) * 10) * h.AL3 * h.AM3 *
                   (1 + 0.1 * (f(42) + 1)) * h.AO3 * h.AP3;
        var AX42 = ((5 * (f(42) + 1)) + h.AJ5 + h.AK5 + h.AM5 + h.AN5 + h.AO5 + h.AQ5) * h.AL5;
        var AW42 = (h.AI25 / tickPoly(h.AI27, h.AI29, h.AI31)) * lookupDockCol(d, 4, inputs);
        return ((AV42 + (AX42 * h.AI7 * h.AI9)) * (match ? h.AI11 : 1)) * h.AK34 / AW42;
      }

      case 43: {
        var AV43 = (1 + h.AJ11 + h.AK11) * (1 + (0.03 * (f(43) + 1) * c8)) *
                   (1 + h.AM11) * (1 + h.AN11) * (1 + h.AO11);
        var AW43 = (1 + 0.02 * (f(43) + 1) * c8) * (h.AJ9 * h.AK9 * h.AL9 * h.AM9 * h.AO9 * h.AP9);
        var AX43 = (0.01 * (f(43) + 1) * t2count) + h.AK20;
        return ((h.AI3 + (h.AI5 * h.AI7 * AW43)) * (match ? AV43 : 1)) *
               (h.AI14 * ((1 - h.AI16) * 1 + h.AI16 * (1 - AX43) * h.AI18 +
                h.AI16 * AX43 * h.AI18 * h.AI22)) / h.AL34;
      }
    }
    throw new Error("no AY for row " + row);
  }

  /* ------------------------------------------------------------------ */
  /* Fish-purchased upgrades (rows 3-20 of the sheet)                   */
  /* ------------------------------------------------------------------ */

  // Data comes from fishcosts.js (window.FISH_DATA). Absent on pages /
  // tests that only load model.js, in which case no fish rows are produced.
  var FISH_GATE_NAMES = { 5: "Upgrade Boat", 15: "Upgrade Tier 2 Boat" };

  // "Effort" of buying one fish-costed level: how many "Guppy-equivalents"
  // the price is worth, using the wiki power rating as catch difficulty.
  function fishEffort(cost, power) {
    if (!cost) return null;
    var rating = num(power[cost[1]]) || 1;
    return cost[0] * rating;
  }

  function computeFishRows(inputs, base) {
    var FD = global.FISH_DATA;
    if (!FD || !FD.upgrades) return [];

    var rows = FD.upgrades.map(function (up) {
      var lvl = Math.max(0, rd(num(inputs.G[up.row])));
      var maxed = lvl >= up.max;

      var gate = null;
      if (up.gateRow && num(inputs.G[up.gateRow]) < up.gateLevel) {
        gate = "Requires " + (FISH_GATE_NAMES[up.gateRow] || ("row " + up.gateRow)) +
               " \u2265 " + up.gateLevel;
      }

      var cost = (!maxed && !gate) ? (up.costs[lvl] || null) : null;
      var ay = null, growth = null, effort = null, score = null;

      if (cost) {
        var sim = JSON.parse(JSON.stringify(inputs));
        sim.G[up.row] = lvl + 1;
        ay = computeHelpers(sim).AI34;
        if (ay !== null && isFinite(ay)) {
          growth = ay / base - 1;
          effort = fishEffort(cost, FD.power);
          // Boat levels do not feed the fish/time math themselves: they only
          // unlock other upgrades, so they are shown as info, not ranked.
          if (isFinite(growth) && effort > 0 && ay !== base) score = (ay - base) / effort;
        }
      }

      return {
        row: up.row,
        name: up.name,
        max: up.max,
        level: lvl,
        count: cost ? cost[0] : null,
        fish: cost ? cost[1] : null,
        fishPower: cost ? (num(FD.power[cost[1]]) || 1) : null,
        effort: effort,
        newFishTime: ay,
        growth: growth,
        score: score,
        rank: null,
        blocked: maxed ? "Maxed"
          : gate ? gate
          : !cost ? "No cost data"
          : (score === null ? "No direct fish/time change (unlocks upgrades)" : null),
        locked: !!gate,
        buyable: !!cost,
        rankable: score !== null && isFinite(score)
      };
    });

    rows.filter(function (r) { return r.rankable; })
      .sort(function (a, b) { return b.score - a.score; })
      .forEach(function (r, i) { r.rank = i + 1; });

    return rows;
  }

  // Lightweight entry point for tests / console use.
  function computeFishModel(rawInputs) {
    var inputs = rawInputs || defaultInputs();
    var h = computeHelpers(inputs);
    return { base: h.AI34, rows: computeFishRows(inputs, h.AI34) };
  }

  /* ------------------------------------------------------------------ */
  /* Gating (blank = not ranked)                                        */
  /* ------------------------------------------------------------------ */

  var EXP_ONLY = { 27: 1, 29: 1 };

  function gateReason(up, inputs) {
    var G = inputs.G, f = function (g) { return num(G[g]); };
    switch (up.row) {
      case 22: case 23: case 24: case 38: case 39: break;
      case 25: case 26: case 27: if (f(5) < 1) return "Requires Fishing Drone ≥ 1"; break;
      case 28: if (f(5) < 2) return "Requires Fishing Drone ≥ 2"; break;
      case 29: if (f(5) < 3) return "Requires Fishing Drone ≥ 3"; break;
      case 30: if (f(5) < 4) return "Requires Fishing Drone ≥ 4"; break;
      case 31: if (f(5) < 5) return "Requires Fishing Drone ≥ 5"; break;
      case 32: if (f(15) < 1) return "Requires Tier 2 Upgrade ≥ 1"; break;
      case 33: if (f(15) < 2) return "Requires Tier 2 Upgrade ≥ 2"; break;
      case 34: if (f(15) < 3) return "Requires Tier 2 Upgrade ≥ 3"; break;
      case 35: if (f(15) < 4) return "Requires Tier 2 Upgrade ≥ 4"; break;
      case 36: if (f(15) < 5) return "Requires Tier 2 Upgrade ≥ 5"; break;
      case 40: if (f(38) < 1) return "Requires Fishing With Friends ≥ 1";
               if (f(40) > 0) return "Already purchased"; break;
      case 41: if (f(39) < 1) return "Requires Let's Pick Up The Pace ≥ 1"; break;
      case 42: if (f(40) < 1) return "Requires Friendship Ended ≥ 1"; break;
      case 43: if (f(41) < 1) return "Requires With This Fish ≥ 1"; break;
    }
    if (EXP_ONLY[up.row] && !inputs.expMode) return "Only ranked in exponential mode";
    return null;
  }

  function isMaxed(up, inputs) {
    if (up.row === 40) {
      // Row 40 shares row 42's max: also blank when Motley School is maxed.
      if (num(inputs.G[42]) >= 3) return true;
    }
    return num(inputs.G[up.g]) >= up.max;
  }

  /* ------------------------------------------------------------------ */
  /* Top level                                                          */
  /* ------------------------------------------------------------------ */

  function computeModel(rawInputs) {
    var inputs = rawInputs || defaultInputs();
    var h = computeHelpers(inputs);
    var base = h.AI34;
    var expMode = !!inputs.expMode;

    var rows = GEM_UPGRADES.map(function (up) {
      var gate = gateReason(up, inputs);
      var maxed = isMaxed(up, inputs);

      // Row 40 (Friendship Ended) is scored using Motley School's next level
      // and the combined gem cost AU42 + AU40.
      var cost = costAU(up.row, inputs.G);
      var scoreCost = (up.row === 40) ? costAU(42, inputs.G) + costAU(40, inputs.G) : cost;

      var ay = null, growth = null, score = null;

      if (!maxed && !gate) {
        if (up.row === 27) {
          growth = (1 + 0.05 * (num(inputs.G[27]) + 1)) / (1 + 0.05 * num(inputs.G[27])) - 1;
          ay = base * (1 + growth);
        } else if (up.row === 29) {
          growth = 1 - (1 - 0.0045 * (num(inputs.G[29]) + 1)) / (1 - 0.0045 * num(inputs.G[29]));
          ay = base * (1 + growth);
        } else if (up.row === 40) {
          ay = computeAY(42, inputs, h); // AY40 in the sheet == AI34; score uses AY42
          growth = ay / base - 1;
        } else {
          ay = computeAY(up.row, inputs, h);
          if (ay !== null && isFinite(ay)) growth = ay / base - 1;
        }

        if (ay !== null && isFinite(ay) && isFinite(growth)) {
          score = expMode ? Math.pow(1 + growth, 100000 / scoreCost) : (ay - base) / scoreCost;
        }
      }

      return {
        row: up.row,
        name: up.name,
        max: up.max,
        group: up.group,
        level: num(inputs.G[up.g]),
        cost: cost,
        scoreCost: scoreCost,
        newFishTime: ay,
        growth: growth,
        score: score,
        rank: null,
        blocked: maxed ? "Maxed" : gate,
        locked: !!gate && gate.indexOf("Requires") === 0,
        rankable: score !== null && isFinite(score)
      };
    });

    var order = rows.filter(function (r) { return r.rankable; })
      .sort(function (a, b) { return b.score - a.score; });
    order.forEach(function (r, i) { r.rank = i + 1; });

    return {
      inputs: inputs,
      helpers: h,
      base: base,
      dock: inputs.dock,
      expMode: expMode,
      rows: rows,
      fishRows: computeFishRows(inputs, base)
    };
  }

  global.FishModel = {
    DOCKS: DOCKS,
    DOCK_BY_ID: DOCK_BY_ID,
    GEM_UPGRADES: GEM_UPGRADES,
    defaultInputs: defaultInputs,
    computeModel: computeModel,
    computeFishModel: computeFishModel,
    computeFishRows: computeFishRows,
    computeHelpers: computeHelpers,
    computeAY: computeAY,
    costAU: costAU,
    tickPoly: tickPoly,
    dockTick: dockTick,
    lookupDockCol: lookupDockCol,
    ad19: ad19,
    rodCardFactor: rodCardFactor
  };

})(typeof window !== "undefined" ? window : globalThis);
