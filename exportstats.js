/*
 * ExportStats import: turn the game's "ExportStats" JSON into FishModel inputs.
 *
 * Field meanings are taken from
 *   https://shminer.miraheze.org/wiki/Guides/Working_With_ExportStats
 * Dock order (indexes 0-10): Lake, Desert, Tundra, Ocean, Nuclear, Abyss,
 * Cave, Volcano, Sky, Solaris, Galaxy.
 *
 * Exposed as window.ExportStats.
 */
(function (global) {
  "use strict";

  var DOCKS = (global.FishModel && global.FishModel.DOCKS) || [];

  function isNum(v) { return typeof v === "number" && isFinite(v); }
  function get(stats, key) { return Object.prototype.hasOwnProperty.call(stats, key) ? stats[key] : undefined; }

  // Parse raw text (or an already-parsed object) -> stats object.
  function parseExport(raw) {
    var obj = raw;
    if (typeof raw === "string") {
      obj = JSON.parse(raw);
    }
    if (!obj || typeof obj !== "object") throw new Error("Not an ExportStats object");
    if (obj.stats && typeof obj.stats === "object") {
      return { version: obj.version || "?", time: obj.time, stats: obj.stats };
    }
    // allow a bare stats object
    return { version: obj.version || "?", time: obj.time, stats: obj };
  }

  function cloneInputs(inp) {
    return JSON.parse(JSON.stringify(inp));
  }

  /*
   * Applies every mapping we are confident about.  Anything unmapped stays at
   * its current value and is reported as "manual".
   */
  function apply(stats, baseInputs) {
    var inputs = cloneInputs(baseInputs);
    var applied = [], missing = [];
    var G = inputs.G, C = inputs.C;

    function arr(key) {
      var v = get(stats, key);
      return Array.isArray(v) ? v : null;
    }
    function setG(row, val, src) {
      if (isNum(val)) { G[row] = val; applied.push(src + " -> G" + row); }
      else missing.push(src);
    }

    // Fishing - Enhance: fishing_enhance_array[0..14] -> G22..G36
    var enh = arr("fishing_enhance_array");
    if (enh) { for (var i = 0; i < 15; i++) setG(22 + i, enh[i], "fishing_enhance_array[" + i + "]"); }
    else missing.push("fishing_enhance_array");

    // Fishing - Upgrades: fishing_upgrades_array[0..17] -> G3..G20
    var upg = arr("fishing_upgrades_array");
    if (upg) { for (var j = 0; j < 18; j++) setG(3 + j, upg[j], "fishing_upgrades_array[" + j + "]"); }
    else missing.push("fishing_upgrades_array");

    // Skill tree: indices 42,44,43,45,51,52 -> G38,G39,G40,G41,G42,G43
    var st = arr("skill_tree_nodes_array");
    if (st) {
      var map = { 42: 38, 44: 39, 43: 40, 45: 41, 51: 42, 52: 43 };
      Object.keys(map).forEach(function (idx) {
        if (isNum(st[idx])) { G[map[idx]] = st[idx]; applied.push("skill_tree_nodes_array[" + idx + "] -> G" + map[idx]); }
      });
    } else missing.push("skill_tree_nodes_array");

    // Regular fish cards: 4 per dock
    var reg = arr("fishing_regular_card_array");
    if (reg) {
      DOCKS.forEach(function (d, di) {
        var c = inputs.cards[d.id];
        for (var k = 0; k < 4; k++) {
          var v = reg[4 * di + k];
          if (isNum(v)) c.t1[k] = v;
        }
      });
      applied.push("fishing_regular_card_array -> T1 cards");
    } else missing.push("fishing_regular_card_array");

    // Legendary card (AE) + Tribute (AF) per dock
    var leg = arr("fishing_legendary_card_levels_array");
    if (leg) {
      DOCKS.forEach(function (d, di) { if (isNum(leg[di])) inputs.cards[d.id].ae = leg[di]; });
      applied.push("fishing_legendary_card_levels_array -> legendary card (AE)");
    } else missing.push("fishing_legendary_card_levels_array");

    var trib = arr("fishing_legendary_tribute_levels_array");
    if (trib) {
      DOCKS.forEach(function (d, di) { if (isNum(trib[di])) inputs.cards[d.id].af = trib[di]; });
      applied.push("fishing_legendary_tribute_levels_array -> tribute (AF)");
      // C32 = "Do you have Abyss Tribute 1?" (Abyss index 5, Tribute 1 = value >= 2)
      if (isNum(trib[5])) { C[32] = trib[5] >= 2; applied.push("tribute[Abyss] -> C32"); }
    } else missing.push("fishing_legendary_tribute_levels_array");

    // Pets
    var pet = arr("pet_array");
    if (pet && isNum(pet[12])) { C[16] = pet[12]; applied.push("pet_array[12] -> Mr Nibbles level"); }
    else missing.push("pet_array[12]");
    var psa = arr("pet_skin_set_a_array");
    if (psa) { C[17] = psa[12] === 1; applied.push("pet_skin_set_a_array[12] -> Dr Cool owned"); }
    else missing.push("pet_skin_set_a_array[12]");
    var pq = arr("pet_quest_array");
    if (pq && (isNum(pq[12]) || pq[12] === 0)) { C[18] = pq[12] || null; applied.push("pet_quest_array[12] -> Mr Nibbles quest"); }
    else missing.push("pet_quest_array[12]");

    // Black hole
    if (isNum(get(stats, "black_hole_level"))) {
      C[25] = get(stats, "black_hole_level") >= 10;
      applied.push("black_hole_level -> Black Hole >=10");
    } else missing.push("black_hole_level");

    // Arch idols: Astraeus[19], Poseidon[9], Tethys[23], Ares[26]
    var idols = arr("idols_array");
    if (idols) {
      if (isNum(idols[19])) { C[27] = idols[19]; applied.push("idols_array[19] -> Astraeus"); }
      if (isNum(idols[9])) { C[28] = idols[9]; applied.push("idols_array[9] -> Poseidon"); }
      if (isNum(idols[23])) { C[29] = idols[23]; applied.push("idols_array[23] -> Tethys"); }
      if (isNum(idols[26])) { C[30] = idols[26]; applied.push("idols_array[26] -> Ares"); }
    } else missing.push("idols_array");

    return { inputs: inputs, applied: applied, missing: missing, version: undefined };
  }

  global.ExportStats = {
    parseExport: parseExport,
    apply: apply
  };

})(typeof window !== "undefined" ? window : globalThis);
