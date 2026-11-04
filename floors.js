/*
 * Best Floor to Farm UI.
 *
 * Depends on:
 *   floortables.js / floordata.js  (window.FloorData)
 *   exportstats.js / account.js    when a saved account is present
 *
 * Exposed as window.FloorTool so app.js can initialise it and refresh it
 * after an account import/reset.
 */
(function (global) {
  "use strict";

  var FD = global.FloorData;
  var ACCOUNT = global.AccountStore || null;
  var ES = global.ExportStats || null;

  var KEY = "obelisk-floors-v1";
  var DEFAULT_ORE = "Tin";
  var DEFAULT_VEIN = "Stone Vein";

  var state = {
    mode: "ore",
    ore: DEFAULT_ORE,
    vein: DEFAULT_VEIN,
    showW4: false,
    voidMode: "auto",
    oreFilter: "",
    manual: FD ? FD.defaultManual() : {},
    overrides: {},
    overridesFor: null,
    morph: 0,
    morphGolden: 0,
    selectedFloor: null,
    explorer: { world: 0, query: "", sort: "floor", dir: 1 },
    account: null,
    env: null,
    result: null
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
    while (abs >= 1000 && tier < SUFFIX.length - 1) { abs /= 1000; tier++; }
    var s;
    if (tier === 0) s = abs < 10 ? abs.toFixed(2) : abs < 100 ? abs.toFixed(1) : Math.round(abs).toString();
    else s = abs.toFixed(abs < 10 ? 2 : abs < 100 ? 1 : 0) + SUFFIX[tier];
    return (neg ? "-" : "") + s;
  }

  function fmtPct(v, digits) {
    if (v === null || v === undefined || !isFinite(v)) return "-";
    var d = digits === undefined ? (Math.abs(v) < 0.1 ? 2 : 1) : digits;
    return (v * 100).toFixed(d) + "%";
  }

  function signedPct(v) {
    if (v === null || v === undefined || !isFinite(v)) return "";
    var pct = v * 100;
    if (Math.abs(pct) < 0.005) return "0%";
    return (pct > 0 ? "+" : "") + pct.toFixed(Math.abs(pct) < 1 ? 2 : 1) + "%";
  }

  function asNumber(v, fallback) {
    if (typeof v === "number" && isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "") {
      var n = parseFloat(v);
      if (isFinite(n)) return n;
    }
    return fallback;
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function getStorage() {
    try {
      if (global && global.localStorage) return global.localStorage;
    } catch (e) { /* storage blocked */ }
    return null;
  }

  function scrollWrap(table) {
    var w = el("div", "table-scroll");
    w.appendChild(table);
    return w;
  }

  function clearNode(n) {
    if (!n) return;
    n.innerHTML = "";
  }

  function cloneJson(v) { return JSON.parse(JSON.stringify(v)); }

  /* ---------------------------------------------------------------- */
  /* stat fields (the sheet's green cells)                            */
  /* ---------------------------------------------------------------- */

  // stat: ExportStats key (account mode, with idx for array entries)
  // man:  FloorData.defaultManual() key (manual mode)
  // only: "account" | "manual" when the field makes sense in one mode only
  var GROUPS = [
    { id: "world", title: "World & speed" },
    { id: "void", title: "Void portals" },
    { id: "floor", title: "Floor modifiers" },
    { id: "ore", title: "Ore" },
    { id: "vein", title: "Veins" }
  ];

  function fld(group, id, label, kind, stat, man, extra) {
    var f = { group: group, id: id, label: label, kind: kind, stat: stat, man: man };
    if (extra) Object.keys(extra).forEach(function (k) { f[k] = extra[k]; });
    return f;
  }

  var FIELDS = [
    fld("world", "world", "World unlocked", "int", "worlds_unlocked", "world", { min: 1, max: 4, where: "Construction → Monuments" }),
    fld("world", "speed", "Game speed multi", "num", "game_speed_multi", "gameSpeed", { min: 0, hint: "Account: as exported. The floor you exported on is divided back out." }),
    fld("world", "w3", "World 3 speed notice bought", "bool", "fishing_notices_array", "w3Fix", { idx: 14, hint: "Without it World 3 floors run at 0.7x speed." }),
    fld("world", "w4q", "World 4 quests done", "int", "world_4_quest_progress", null, { only: "account", min: 0, hint: "Sets the World 4 speed penalty." }),
    fld("world", "w4m", "World 4 quest speed modifier", "num", null, "w4Mod", { only: "manual", min: 0.2, max: 80, step: 0.1, hint: "0.2–0.8 (or 20–80). 0.8 = no quests done." }),

    fld("void", "voidEq", "Void Drone equipped", "bool", "is_drone_void_equipped", "voidEquipped", { where: "Drones" }),
    fld("void", "voidFu", "Void Drone fueled", "bool", "is_drone_void_equipped_and_fueled", "voidFueled", { where: "Drones → Fuel" }),
    fld("void", "voidGr", "Void Drone fuel grade", "int", null, "voidGrade", { only: "manual", min: 0, where: "Drones → Fuel" }),
    fld("void", "pChance", "Void portal chance (%)", "pct", "void_portal_chance", "portalChance", { min: 0, hint: "Needs World 2 and the drone equipped." }),
    fld("void", "pMulti", "Void portal multi", "num", "void_portal_multi", null, { only: "account", min: 0 }),
    fld("void", "pBase", "Void portal base multi", "num", "void_portal_base_multi", "portalBase", { min: 0 }),
    fld("void", "gpC", "Golden void portal chance (%)", "pct", "golden_void_portal_chance", "goldenPortalChance", { min: 0, minWorld: 3 }),
    fld("void", "gpM", "Golden void portal multi", "num", "golden_void_portal_multi", "goldenPortalMulti", { min: 0, minWorld: 3 }),
    fld("void", "rpC", "Rainbow void portal chance (%)", "pct", "rainbow_void_portal_chance", "rainbowPortalChance", { min: 0, minWorld: 3 }),
    fld("void", "rpM", "Rainbow void portal multi", "num", "rainbow_void_portal_multi", "rainbowPortalMulti", { min: 0, minWorld: 3 }),
    fld("void", "xpC", "Galactic void portal chance (%)", "pct", "galactic_void_portal_chance", "galacticPortalChance", { min: 0, minWorld: 4 }),
    fld("void", "xpM", "Galactic void portal multi", "num", "galactic_void_portal_multi", "galacticPortalMulti", { min: 0, minWorld: 4 }),
    fld("void", "minoEq", "Minotaur Drone equipped", "bool", null, "minoEquipped", { only: "manual", minWorld: 4 }),
    fld("void", "minoFu", "Minotaur Drone fueled", "bool", null, "minoFueled", { only: "manual", minWorld: 4 }),
    fld("void", "minoGr", "Minotaur fuel grade", "int", null, "minoGrade", { only: "manual", min: 0, minWorld: 4 }),
    fld("void", "coal", "Coal Generator level", "int", null, "coalLevel", { only: "manual", min: 0, minWorld: 4, where: "Void multi +0.5% per level" }),
    fld("void", "l400", "Level 400 upgrade", "int", null, "lvl400", { only: "manual", min: 0, minWorld: 4, where: "Void multi +0.1% per level" }),
    fld("void", "omni", "Omniportal Bundle", "bool", null, "omni", { only: "manual", minWorld: 4, where: "Void multi +2%" }),
    fld("void", "ctr", "Contract (Ob71+) level", "int", null, "contractLevel", { only: "manual", min: 0, minWorld: 4, where: "Void multi +0.4% per level" }),
    fld("void", "arc", "Arcanist Exchange level", "int", null, "arcanist", { only: "manual", min: 0, minWorld: 4, where: "Void multi +0.5% per level" }),
    fld("void", "hyd", "Stargazing Hydra star", "int", null, "hydra", { only: "manual", min: 0, minWorld: 4, where: "Void multi +0.75% per level" }),

    fld("floor", "gfC", "Golden floor chance (%)", "pct", "golden_floor_chance", "goldenFloorChance", { min: 0, where: "Stats → Ore" }),
    fld("floor", "gfM", "Golden floor multi", "num", "golden_floor_multi", "goldenFloorMulti", { min: 0 }),
    fld("floor", "rfC", "Rainbow floor chance (%)", "pct", "rainbow_floor_chance", "rainbowFloorChance", { min: 0, minWorld: 2 }),
    fld("floor", "rfM", "Rainbow floor multi", "num", "rainbow_floor_multi", "rainbowFloorMulti", { min: 0, minWorld: 2 }),
    fld("floor", "xfC", "Galactic floor chance (%)", "pct", "galactic_floor_chance", "galacticFloorChance", { min: 0, minWorld: 3 }),
    fld("floor", "xfM", "Galactic floor multi", "num", "galactic_floor_multi", "galacticFloorMulti", { min: 0, minWorld: 3 }),
    fld("floor", "pfC", "Prismatic floor chance (%)", "pct", "prismatic_floor_chance", "prismaticFloorChance", { min: 0, minWorld: 4 }),
    fld("floor", "pfM", "Prismatic floor multi", "num", "prismatic_floor_multi", "prismaticFloorMulti", { min: 0, minWorld: 4 }),

    fld("ore", "ops", "Ores per screen", "int", "ores_per_screen", "oresPerScreen", { min: 1, hint: "10 or 12." }),
    fld("ore", "income", "Ore income multi", "num", "ore_income_multi", "oreIncome", { min: 0 }),
    fld("ore", "goC", "Golden ore chance (%)", "pct", "golden_ore_chance", "goldenOreChance", { min: 0, minWorld: 3 }),
    fld("ore", "goM", "Golden ore multi", "num", "golden_ore_multi", "goldenOreMulti", { min: 0, minWorld: 3 }),
    fld("ore", "roC", "Rainbow ore chance (%)", "pct", "rainbow_ore_chance", "rainbowOreChance", { min: 0, minWorld: 4 }),
    fld("ore", "roM", "Rainbow ore multi", "num", "rainbow_ore_multi", "rainbowOreMulti", { min: 0, minWorld: 4 }),

    fld("vein", "vSpawn", "Vein spawn rate multi", "num", "vein_spawn_rate_multi", "veinSpawn", { min: 0 }),
    fld("vein", "vInc", "Vein income multi", "num", "vein_income_multi", "veinIncome", { min: 0 }),
    fld("vein", "gvC", "Golden vein chance (%)", "pct", "golden_vein_chance", "goldenVeinChance", { min: 0 }),
    fld("vein", "gvM", "Golden vein multi", "num", "golden_vein_multi", "goldenVeinMulti", { min: 0 }),
    fld("vein", "rvC", "Rainbow vein chance (%)", "pct", "rainbow_vein_chance", "rainbowVeinChance", { min: 0 }),
    fld("vein", "rvM", "Rainbow vein multi", "num", "rainbow_vein_multi", "rainbowVeinMulti", { min: 0 }),
    fld("vein", "mvC", "Gleaming vein chance (%)", "pct", "gleaming_vein_chance", "gleamingVeinChance", { min: 0 }),
    fld("vein", "mvM", "Gleaming vein multi", "num", "gleaming_vein_multi", "gleamingVeinMulti", { min: 0 })
  ];

  function overrideKey(f) { return f.stat + (f.idx !== undefined ? "#" + f.idx : ""); }

  function fieldActive(f) {
    return state.account ? f.only !== "manual" && !!f.stat : f.only !== "account" && !!f.man;
  }

  function exportValue(f) {
    var stats = state.account && state.account.stats;
    if (!stats) return undefined;
    var v = stats[f.stat];
    if (f.idx !== undefined) v = Array.isArray(v) ? v[f.idx] : undefined;
    if (f.kind === "bool") return v === true || v === 1;
    return typeof v === "number" ? v : undefined;
  }

  function fieldValue(f) {
    if (state.account) {
      var k = overrideKey(f);
      if (Object.prototype.hasOwnProperty.call(state.overrides, k)) return state.overrides[k];
      return exportValue(f);
    }
    return state.manual[f.man];
  }

  function fieldEdited(f) {
    return !!state.account && Object.prototype.hasOwnProperty.call(state.overrides, overrideKey(f));
  }

  function setFieldValue(f, v) {
    if (state.account) {
      var ev = exportValue(f);
      var k = overrideKey(f);
      if (ev !== undefined && ev === v) delete state.overrides[k];
      else state.overrides[k] = v;
    } else {
      state.manual[f.man] = v;
    }
  }

  // Export stats with the player's hand edits laid on top.
  function effectiveStats(stats) {
    var out = {};
    Object.keys(stats).forEach(function (k) { out[k] = stats[k]; });
    FIELDS.forEach(function (f) {
      if (!f.stat) return;
      var k = overrideKey(f);
      if (!Object.prototype.hasOwnProperty.call(state.overrides, k)) return;
      var v = state.overrides[k];
      if (f.idx !== undefined) {
        var arr = Array.isArray(out[f.stat]) ? out[f.stat].slice() : [];
        arr[f.idx] = f.kind === "bool" ? (v ? 1 : 0) : v;
        out[f.stat] = arr;
      } else {
        out[f.stat] = v;
      }
    });
    return out;
  }

  /* ---------------------------------------------------------------- */
  /* saved state                                                      */
  /* ---------------------------------------------------------------- */

  function loadSaved() {
    var store = getStorage();
    if (!store) return;
    var saved = null;
    try { saved = JSON.parse(store.getItem(KEY) || "null"); } catch (e) { saved = null; }
    if (!saved || typeof saved !== "object") return;

    if (saved.mode === "veins" || saved.mode === "ore") state.mode = saved.mode;
    if (typeof saved.ore === "string") state.ore = saved.ore;
    if (typeof saved.vein === "string") state.vein = saved.vein;
    state.showW4 = !!saved.showW4;
    if (saved.voidMode === "on" || saved.voidMode === "off" || saved.voidMode === "auto") state.voidMode = saved.voidMode;
    state.morph = clamp(asNumber(saved.morph, 0), 0, 100);
    state.morphGolden = clamp(asNumber(saved.morphGolden, 0), 0, 100);
    if (saved.manual && typeof saved.manual === "object") {
      var def = FD.defaultManual();
      Object.keys(def).forEach(function (k) {
        var v = saved.manual[k];
        if (typeof def[k] === "boolean") state.manual[k] = !!v;
        else state.manual[k] = asNumber(v, def[k]);
      });
    }
    if (saved.overrides && typeof saved.overrides === "object") {
      Object.keys(saved.overrides).forEach(function (k) {
        var v = saved.overrides[k];
        if (typeof v === "number" || typeof v === "boolean") state.overrides[k] = v;
      });
    }
    if (typeof saved.overridesFor === "string") state.overridesFor = saved.overridesFor;
    if (saved.explorer && typeof saved.explorer === "object") {
      var ex = saved.explorer;
      state.explorer.world = clamp(Math.floor(asNumber(ex.world, 0)), 0, 4);
      if (ex.sort === "floor" || ex.sort === "fph" || ex.sort === "base" || ex.sort === "void") state.explorer.sort = ex.sort;
      state.explorer.dir = ex.dir === -1 ? -1 : 1;
    }
  }

  function saveState() {
    var store = getStorage();
    if (!store) return;
    try {
      store.setItem(KEY, JSON.stringify({
        mode: state.mode, ore: state.ore, vein: state.vein, showW4: state.showW4, voidMode: state.voidMode,
        morph: state.morph, morphGolden: state.morphGolden,
        manual: state.manual, overrides: state.overrides, overridesFor: state.overridesFor,
        explorer: { world: state.explorer.world, sort: state.explorer.sort, dir: state.explorer.dir }
      }));
    } catch (e) { /* storage full or blocked */ }
  }

  function clearSaved() {
    var store = getStorage();
    if (!store) return;
    try { store.removeItem(KEY); } catch (e) { /* ignored */ }
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
      return { record: rec, stats: stats, version: (parsed && parsed.version) || rec.version || "?" };
    } catch (e) {
      return { record: rec, stats: null, version: rec.version || "?" };
    }
  }

  function applyAccountRecord() {
    var acct = readAccount();
    if (acct && acct.stats) {
      state.account = acct;
      var stamp = String(acct.record.importedAt || acct.record.exportedAt || "");
      if (state.overridesFor !== stamp) {         // a fresh import replaces hand edits
        state.overrides = {};
        state.overridesFor = stamp;
      }
    } else {
      state.account = null;
    }
  }

  function refreshAccount() {
    if (!FD) return;
    applyAccountRecord();
    renderPickers();
    renderStats();
    update();
  }

  function updateAccountStatus() {
    if (!nodes.accountStatus) return;
    var env = state.env;
    if (state.account && env) {
      var edits = Object.keys(state.overrides).length;
      nodes.accountStatus.textContent = "Using your saved account (" + state.account.version + "): World " +
        Math.floor(env.world) + ", exported on floor " + (env.currentFloor || "?") + ". " +
        (edits ? edits + " stat" + (edits === 1 ? "" : "s") + " edited by hand. " : "") +
        "Edit any stat under “Your stats” to try a what-if.";
    } else {
      nodes.accountStatus.textContent = "No account JSON loaded – enter your stats by hand under “Your stats”, " +
        "or import an ExportStats JSON on the home page for exact results, warnings and bomb advice.";
    }
    if (nodes.loadSample) nodes.loadSample.hidden = !!state.account;
  }

  /* ---------------------------------------------------------------- */
  /* pickers                                                          */
  /* ---------------------------------------------------------------- */

  function renderPickers() {
    if (!FD || !nodes.ore) return;
    var env = buildEnv();

    // ores
    clearNode(nodes.ore);
    var opts = FD.oreOptions(env);
    var q = String(state.oreFilter || "").toLowerCase();
    var group = null, groupWorld = 0, shown = 0;
    opts.forEach(function (o) {
      var match = !q || o.name.toLowerCase().indexOf(q) >= 0 || o.name === state.ore;
      if (!match) return;
      if (o.world !== groupWorld) {
        group = el("optgroup");
        group.label = "World " + o.world;
        nodes.ore.appendChild(group);
        groupWorld = o.world;
      }
      var opt = el("option", null, o.name + (o.locked ? " (World " + o.world + " locked)" : ""));
      opt.value = o.name;
      opt.disabled = !!o.locked && o.name !== state.ore;
      opt.selected = o.name === state.ore;
      group.appendChild(opt);
      shown++;
    });
    if (!shown) {
      var none = el("option", null, "No ore matches “" + state.oreFilter + "”");
      none.value = "";
      nodes.ore.appendChild(none);
    }
    nodes.ore.value = state.ore;

    // veins
    clearNode(nodes.veinGrid);
    FD.veinOptions(env).forEach(function (v) {
      var b = el("button", "floors-vein" + (v.name === state.vein ? " selected" : "") + (v.locked ? " locked" : "") +
        (v.unresearched ? " unresearched" : ""));
      b.type = "button";
      b.disabled = !!v.locked;
      b.title = v.reason ? v.name + " – " + v.reason : v.name;
      b.setAttribute("aria-pressed", v.name === state.vein ? "true" : "false");
      var img = el("img", "floors-vein-img");
      img.src = v.image;
      img.alt = "";
      img.width = 48;
      img.height = 48;
      b.appendChild(img);
      b.appendChild(el("span", "floors-vein-name", v.name.replace(" Vein", "")));
      var meta = FD.VEINS[v.index - 1];
      b.appendChild(el("span", "floors-vein-meta", v.reason ? v.reason : "Floors " + meta.firstFloor + "–" + meta.lastFloor));
      b.addEventListener("click", function () {
        state.vein = v.name;
        state.selectedFloor = null;
        renderPickers();
        update();
      });
      nodes.veinGrid.appendChild(b);
    });

    updateModeUi();
  }

  function updateModeUi() {
    if (nodes.modeOre) nodes.modeOre.checked = state.mode === "ore";
    if (nodes.modeVeins) nodes.modeVeins.checked = state.mode === "veins";
    if (nodes.orePicker) nodes.orePicker.hidden = state.mode !== "ore";
    if (nodes.veinPicker) nodes.veinPicker.hidden = state.mode !== "veins";
    if (nodes.showW4) nodes.showW4.checked = state.showW4;
    if (nodes.voidMode) nodes.voidMode.value = state.voidMode;
    if (nodes.oreFilter && nodes.oreFilter.value !== state.oreFilter) nodes.oreFilter.value = state.oreFilter;
    if (nodes.showW4Label) {
      nodes.showW4Label.textContent = state.mode === "ore"
        ? "Include World 4 floors for World 1–3 ores"
        : "Include World 4 floors for World 1–3 veins";
    }
    if (nodes.rankingTitle) nodes.rankingTitle.textContent = state.mode === "ore" ? "3. Ranking" : "3. Ranking (veins per hour)";
  }

  /* ---------------------------------------------------------------- */
  /* evaluation                                                       */
  /* ---------------------------------------------------------------- */

  function buildEnv() {
    if (state.account && state.account.stats) {
      return FD.fromExport(effectiveStats(state.account.stats), state.account.version);
    }
    return FD.fromManual(state.manual);
  }

  function evaluate() {
    var env = buildEnv();
    state.env = env;
    state.result = state.mode === "ore"
      ? FD.evaluateOre(env, { ore: state.ore, showW4: state.showW4, voidMode: state.voidMode })
      : FD.evaluateVein(env, { vein: state.vein, showW4: state.showW4, voidMode: state.voidMode,
          morph: state.morph / 100, morphGolden: state.morphGolden / 100 });
    return state.result;
  }

  /* ---------------------------------------------------------------- */
  /* rendering: shared bits                                           */
  /* ---------------------------------------------------------------- */

  function modTags(mods) {
    var tags = [];
    if (mods.goldenFloor !== null) tags.push({ text: "Golden floor " + Math.round(mods.goldenFloor * 100) + "%", cls: "neg" });
    if (mods.rainbowX !== 1) tags.push({ text: "Rainbow ×" + mods.rainbowX, cls: "neg" });
    if (mods.goldenOreX !== 1) tags.push({ text: "Golden ore ×" + mods.goldenOreX, cls: "neg" });
    if (mods.prismaticDelta !== 0) tags.push({ text: "Prismatic " + (mods.prismaticDelta > 0 ? "+" : "−") + Math.abs(Math.round(mods.prismaticDelta * 100)) + "%", cls: "neg" });
    if (mods.portalX !== 1) tags.push({ text: "Portal ×" + mods.portalX, cls: "neg" });
    if (mods.speedX !== 1) tags.push({ text: "Speed " + (mods.speedX < 1 ? "−" : "+") + Math.abs(Math.round((1 - mods.speedX) * 100)) + "%", cls: "slow" });
    return tags;
  }

  function tagList(mods) {
    var wrap = el("span", "floors-tags");
    modTags(mods).forEach(function (t) { wrap.appendChild(el("span", "floors-tag " + t.cls, t.text)); });
    return wrap;
  }

  function chip(text, cls) { return el("span", "floors-chip" + (cls ? " " + cls : ""), text); }

  function oreName(level) { return FD.ORES[level - 1] ? FD.ORES[level - 1].name : "?"; }

  // 80/20 style bar: how a floor splits between its two ores
  function shareBar(row) {
    var wrap = el("span", "floors-share");
    var a = el("span", "floors-share-a");
    a.style.width = Math.round(row.shareA * 100) + "%";
    wrap.appendChild(a);
    wrap.title = oreName(row.oreA) + " " + Math.round(row.shareA * 100) + "% / " + oreName(row.oreB) + " " + Math.round(row.shareB * 100) + "%";
    return wrap;
  }

  function oresText(row) {
    return oreName(row.oreA) + " " + Math.round(row.shareA * 100) + "% · " + oreName(row.oreB) + " " + Math.round(row.shareB * 100) + "%";
  }

  function valueBar(frac) {
    var wrap = el("span", "floors-meter");
    var fill = el("span", "floors-meter-fill");
    fill.style.width = (isFinite(frac) ? clamp(frac, 0, 1) * 100 : 0).toFixed(1) + "%";
    wrap.appendChild(fill);
    return wrap;
  }

  function zoneName(floor) {
    var f = FD.FLOORS[floor - 1];
    return "World " + f.world + " · Floor " + floor;
  }

  /* ---------------------------------------------------------------- */
  /* rendering: hero, alerts                                          */
  /* ---------------------------------------------------------------- */

  function voidChip(res) {
    var forced = res.voidMode !== "auto";
    if (res.useVoid) return chip("Void Drone: Yes" + (forced ? " (forced)" : ""), "ok");
    return chip("Void Drone: No" + (forced ? " (forced)" : ""), forced ? "warn" : "");
  }

  function renderHero(res) {
    clearNode(nodes.hero);
    var box = el("div", "floors-hero");
    nodes.hero.appendChild(box);

    if (res.kind === "ore") {
      if (!res.ore) {
        box.className = "floors-hero empty";
        box.appendChild(el("p", null, "Pick an ore above to see the best floor to farm it on."));
        return;
      }
      var top = res.ranking[0];
      if (!top) {
        box.className = "floors-hero empty";
        box.appendChild(el("p", null, "No floor you can reach produces " + res.ore.name + ". " +
          "Unlock the next world, or tick “Include World 4 floors” if it is a World 1–3 ore."));
        return;
      }
      var row = res.rows[top.floor - 1];
      var main = el("div", "floors-hero-main");
      main.appendChild(el("span", "floors-hero-label", "Farm " + res.ore.name + " on floor"));
      main.appendChild(el("span", "floors-hero-figure", String(top.floor)));
      main.appendChild(el("span", "floors-hero-sub", zoneName(top.floor) + " · " + oresText(row)));
      main.appendChild(shareBar(row));
      box.appendChild(main);

      var side = el("div", "floors-hero-side");
      var meter = el("div", "floors-meter-row");
      meter.appendChild(el("span", "floors-meter-label", "Value"));
      meter.appendChild(valueBar(top.value));
      meter.appendChild(el("span", "floors-meter-value", fmtPct(top.value)));
      side.appendChild(meter);
      side.appendChild(el("p", "floors-hero-note", "of a perfect floor · ≈ " + fmt(top.raw) + " " + res.ore.name + " / hour"));
      var chips = el("div", "floors-chips");
      chips.appendChild(voidChip(res));
      if (res.bombAdvice) chips.appendChild(chip("Use " + res.bombAdvice.bomb, "info"));
      if (res.oneShotSelected === false) chips.appendChild(chip("Can't one-shot " + res.ore.name, "bad"));
      else if (res.oneShotSelected === true) chips.appendChild(chip("One-shots " + res.ore.name, "ok"));
      if (top.oneShot === false) chips.appendChild(chip("Not every ore on this floor one-shots", "bad"));
      modTags(row.mods).forEach(function (t) { chips.appendChild(chip(t.text, t.cls)); });
      side.appendChild(chips);
      box.appendChild(side);
      return;
    }

    // veins
    if (!res.vein) {
      box.className = "floors-hero empty";
      box.appendChild(el("p", null, "Pick a vein above to see where it spawns most."));
      return;
    }
    var g = res.groups[0];
    if (!g) {
      box.className = "floors-hero empty";
      box.appendChild(el("p", null, res.warnings.length ? res.warnings[0].text : "No floor spawns this vein with your stats."));
      return;
    }
    var vmain = el("div", "floors-hero-main");
    var img = el("img", "floors-hero-img");
    img.src = res.vein.image;
    img.alt = "";
    img.width = 48;
    img.height = 48;
    vmain.appendChild(img);
    vmain.appendChild(el("span", "floors-hero-label", "Farm " + res.vein.name + " on floor" + (g.floors.length > 1 ? "s" : "")));
    vmain.appendChild(el("span", "floors-hero-figure", g.label));
    vmain.appendChild(el("span", "floors-hero-sub", "World " + res.vein.world + " · floors " + res.vein.firstFloor + "–" + res.vein.lastFloor +
      " · spawns 1 in " + res.vein.rarity));
    box.appendChild(vmain);

    var vside = el("div", "floors-hero-side");
    var vmeter = el("div", "floors-meter-row");
    vmeter.appendChild(el("span", "floors-meter-label", "Value"));
    vmeter.appendChild(valueBar(g.value));
    vmeter.appendChild(el("span", "floors-meter-value", fmtPct(g.value)));
    vside.appendChild(vmeter);
    vside.appendChild(el("p", "floors-hero-note", "of a perfect floor · ≈ " + fmt(g.raw) + " income / hour"));
    var vchips = el("div", "floors-chips");
    vchips.appendChild(voidChip(res));
    vchips.appendChild(chip(fmt(res.veinsPerScreen) + " veins per screen"));
    if (g.floors.length > 1) vchips.appendChild(chip(g.floors.length + " floors tie"));
    vside.appendChild(vchips);
    box.appendChild(vside);
  }

  function renderAlerts(res) {
    clearNode(nodes.alerts);
    var items = [];
    res.warnings.forEach(function (n) { items.push({ n: n, kind: "Warning" }); });
    res.reminders.forEach(function (n) { items.push({ n: n, kind: "Reminder" }); });
    if (state.account) {
      var miss = FD.missingKeys(effectiveStats(state.account.stats));
      if (miss.length) {
        items.push({ kind: "Warning", n: { severity: "warn", code: "missing-keys",
          text: miss.length + " stat" + (miss.length === 1 ? "" : "s") + " this tool reads " + (miss.length === 1 ? "is" : "are") +
            " missing from your export (" + miss.slice(0, 4).join(", ") + (miss.length > 4 ? ", …" : "") +
            "). Re-export from the latest game version; defaults are used meanwhile." } });
      }
    }
    if (!items.length) {
      var ok = el("p", "floors-allclear", state.account ? "No warnings or reminders – your export looks good." :
        "Warnings and reminders appear once an account is loaded.");
      nodes.alerts.appendChild(ok);
      return;
    }
    var ul = el("ul", "floors-notes");
    items.forEach(function (it) {
      var li = el("li", "floors-note " + it.n.severity);
      li.appendChild(el("span", "floors-note-tag", it.kind));
      li.appendChild(el("span", "floors-note-text", it.n.text));
      ul.appendChild(li);
    });
    nodes.alerts.appendChild(ul);
  }

  /* ---------------------------------------------------------------- */
  /* rendering: ranking                                               */
  /* ---------------------------------------------------------------- */

  function renderRanking(res) {
    clearNode(nodes.ranking);
    if (res.kind === "ore") {
      if (!res.ore) { nodes.ranking.appendChild(el("p", "hint", "No ore selected.")); return; }
      if (!res.ranking.length) { nodes.ranking.appendChild(el("p", "hint", "Nothing to rank for " + res.ore.name + ".")); return; }
    } else {
      if (!res.vein) { nodes.ranking.appendChild(el("p", "hint", "No vein selected.")); return; }
      if (!res.groups.length) { nodes.ranking.appendChild(el("p", "hint", "Nothing to rank for " + res.vein.name + ".")); return; }
    }

    var table = el("table", "results-table floors-table");
    var thead = el("thead");
    var hr = el("tr");
    (res.kind === "ore" ? ["#", "Floor", "Ores on the floor", "Value", "vs next", "Notes"]
                        : ["#", "Floors", "Value", "Per hour", "vs next", "Notes"]).forEach(function (h) {
      hr.appendChild(el("th", null, h));
    });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody");

    if (res.kind === "ore") {
      res.ranking.forEach(function (r) {
        var row = res.rows[r.floor - 1];
        var tr = el("tr", r.floor === state.selectedFloor ? "selected" : "");
        tr.appendChild(el("td", "rank", medal(r.rank)));
        var fc = el("td", "name");
        var btn = el("button", "floors-floor-btn", String(r.floor));
        btn.type = "button";
        btn.title = "Show the breakdown for floor " + r.floor;
        btn.addEventListener("click", function () { selectFloor(r.floor); });
        fc.appendChild(btn);
        fc.appendChild(el("span", "floors-zone", " W" + row.world));
        tr.appendChild(fc);
        var oc = el("td", "floors-ores");
        oc.appendChild(shareBar(row));
        oc.appendChild(el("span", "floors-ores-text", oresText(row)));
        tr.appendChild(oc);
        var vc = el("td", "floors-value");
        vc.appendChild(valueBar(r.value));
        vc.appendChild(el("span", "floors-value-text", fmtPct(r.value)));
        tr.appendChild(vc);
        tr.appendChild(el("td", "num", signedPct(r.pctVsNext)));
        var nc = el("td", "floors-notes-cell");
        nc.appendChild(tagList(row.mods));
        if (r.oneShot === false) nc.appendChild(el("span", "floors-tag bad", "No one-shot"));
        tr.appendChild(nc);
        tbody.appendChild(tr);
      });
    } else {
      res.groups.forEach(function (g) {
        var tr = el("tr", g.floors.indexOf(state.selectedFloor) >= 0 ? "selected" : "");
        tr.appendChild(el("td", "rank", medal(g.rank)));
        var fc = el("td", "name");
        var btn = el("button", "floors-floor-btn", g.label);
        btn.type = "button";
        btn.title = "Show the breakdown for floor " + g.floors[0];
        btn.addEventListener("click", function () { selectFloor(g.floors[0]); });
        fc.appendChild(btn);
        tr.appendChild(fc);
        var vc = el("td", "floors-value");
        vc.appendChild(valueBar(g.value));
        vc.appendChild(el("span", "floors-value-text", fmtPct(g.value)));
        tr.appendChild(vc);
        tr.appendChild(el("td", "num", fmt(g.raw)));
        tr.appendChild(el("td", "num", signedPct(g.pctVsNext)));
        var nc = el("td", "floors-notes-cell");
        var mods = res.rows[g.floors[0] - 1].mods;
        nc.appendChild(tagList(mods));
        tr.appendChild(nc);
        tbody.appendChild(tr);
      });
    }
    table.appendChild(tbody);
    nodes.ranking.appendChild(scrollWrap(table));

    var hint = res.kind === "ore"
      ? (res.useVoid
        ? "Top " + res.ranking.length + " floors with the Void Drone. Value is a share of a perfect floor of this ore: every ore on screen is the selected one, boosted by all your multipliers."
        : "Without the Void Drone only the best " + res.ranking.length + " floor" + (res.ranking.length === 1 ? "" : "s") + " matter: the ore has to be on the floor itself. Values are not comparable between the two modes.")
      : "Floors with the same veins per hour share a rank. Value is a share of a perfect floor (every spawn is this vein).";
    nodes.ranking.appendChild(el("p", "hint", hint));
  }

  function medal(rank) {
    return rank === 1 ? "🥇 1" : rank === 2 ? "🥈 2" : rank === 3 ? "🥉 3" : String(rank);
  }

  function selectFloor(floor) {
    state.selectedFloor = floor;
    if (state.result) {
      renderRanking(state.result);
      renderDetail(state.result);
    }
  }

  /* ---------------------------------------------------------------- */
  /* rendering: floor detail                                          */
  /* ---------------------------------------------------------------- */

  function factRow(dl, k, v, note) {
    var d = el("div");
    d.appendChild(el("dt", null, k));
    var dd = el("dd", null, v);
    if (note) dd.title = note;
    d.appendChild(dd);
    dl.appendChild(d);
  }

  function renderDetail(res) {
    clearNode(nodes.detail);
    var floor = state.selectedFloor;
    if (floor === null || floor < 1 || floor > 132) {
      floor = res.kind === "ore" ? (res.ranking[0] ? res.ranking[0].floor : null) : (res.groups[0] ? res.groups[0].floors[0] : null);
    }
    if (floor === null) {
      nodes.detail.appendChild(el("p", "hint", "Pick a floor from the ranking to see how its number is built."));
      return;
    }
    var row = res.rows[floor - 1];
    var head = el("h3", null, zoneName(floor));
    head.style.marginTop = "0";
    nodes.detail.appendChild(head);
    nodes.detail.appendChild(el("p", "hint floors-detail-ores", oresText(row)));
    var dl = el("dl", "floors-facts");
    var env = state.env;

    if (res.kind === "ore") {
      factRow(dl, "Floors per hour", fmt(row.Q), "game speed × floor speed modifier × World 3/4 penalty × 2880");
      factRow(dl, "Floor multiplier", fmt(row.P), "golden/rainbow/galactic/prismatic floors and golden/rainbow ore, with this floor's modifiers");
      factRow(dl, "Ore share on the floor", fmtPct(row.S), "how much of the floor is your selected ore");
      factRow(dl, "Share reached via portals", fmtPct(row.T), "a void portal turns a rock into a random ore of equal or lower level");
      factRow(dl, "Void ratio", env.portal.chance > 0 ? fmtPct(row.R) : "n/a", "effective portal chance on this floor / your listed chance");
      factRow(dl, "Base value / hour", fmt(row.U));
      factRow(dl, "With Void Drone / hour", fmt(row.V));
      factRow(dl, "One-shot every ore", row.oneShot ? "Yes" : "No");
      if (env.bomb) {
        [row.oreA, row.oreB].forEach(function (lvl) {
          var o = FD.ORES[lvl - 1];
          factRow(dl, o.name + " health", fmt(o.health) + (o.critTier ? " · needs " + o.critTier + " crit" : "") +
            (o.damageReduction ? " · " + Math.round(o.damageReduction * 100) + "% damage reduction" : ""));
        });
        factRow(dl, "Bomb damage", fmt(env.bomb.dmg));
      }
    } else {
      factRow(dl, "Floors per hour", fmt(row.AF));
      factRow(dl, "Vein spawns here", row.AG ? "Yes (floors " + res.vein.firstFloor + "–" + res.vein.lastFloor + ")" : "No");
      factRow(dl, "Portal weight", fmtPct(row.AH), "share of the floor's ores a portal can turn into this vein's ore range");
      factRow(dl, "Portal chance here", fmtPct(Math.min(row.mods.portalX * env.portal.rawChance, 1)));
      factRow(dl, "Veins per rock", "\u00d7" + fmt(row.AI), "expected veins per rock on this floor, counting what void portals add (1 = every rock a vein)");
      factRow(dl, "Veins per hour", fmt(row.AJ));
      factRow(dl, "Veins per screen", fmt(res.veinsPerScreen));
      factRow(dl, "Variant multi", fmt(res.variantMulti), "expected golden/rainbow/gleaming vein multiplier");
    }
    nodes.detail.appendChild(dl);
    var tags = tagList(row.mods);
    if (tags.children && tags.children.length) {
      var t = el("p", "hint");
      t.appendChild(tags);
      nodes.detail.appendChild(t);
    }
    if (row.notes && row.notes.length) nodes.detail.appendChild(el("p", "hint", row.notes.join(" · ")));
  }

  /* ---------------------------------------------------------------- */
  /* rendering: your stats                                            */
  /* ---------------------------------------------------------------- */

  function renderStats() {
    clearNode(nodes.stats);
    if (!FD) return;
    var world = state.env ? state.env.world : buildEnv().world;
    var account = !!state.account;
    var bar = el("div", "acc-actions floors-stats-actions");
    var reset = el("button", "ghost", account ? "Reset edits to my account" : "Reset to sheet defaults");
    reset.type = "button";
    reset.addEventListener("click", function () {
      if (account) state.overrides = {};
      else state.manual = FD.defaultManual();
      renderStats();
      update();
    });
    bar.appendChild(reset);
    nodes.stats.appendChild(el("p", "hint floors-stats-intro", account
      ? "Pre-filled from your export. Edit a value to try a what-if; “edited” marks anything you changed."
      : "These are the sheet's green cells. Chances are in percent. World-gated stats (greyed) are ignored until that world is unlocked, exactly like the sheet."));
    nodes.stats.appendChild(bar);

    GROUPS.forEach(function (g) {
      var list = FIELDS.filter(function (f) { return f.group === g.id && fieldActive(f); });
      if (!list.length) return;
      nodes.stats.appendChild(el("h3", null, g.title));
      var grid = el("div", "grid floors-grid");
      list.forEach(function (f) { grid.appendChild(fieldNode(f, world)); });
      nodes.stats.appendChild(grid);
    });

    // Veinmorpher bomb is never part of ExportStats
    nodes.stats.appendChild(el("h3", null, "Veinmorpher bomb (manual entry, not in the export)"));
    var vm = el("div", "grid floors-grid");
    vm.appendChild(plainField("floors-morph", "Morph all ores to veins (%)", state.morph, function (v) { state.morph = clamp(v, 0, 100); }));
    vm.appendChild(plainField("floors-morph-golden", "Make all veins golden (%)", state.morphGolden, function (v) { state.morphGolden = clamp(v, 0, 100); }));
    nodes.stats.appendChild(vm);
    nodes.stats.appendChild(el("p", "hint", "Only used in Best veins mode."));
  }

  function plainField(id, label, value, onChange) {
    var wrap = el("label", "field");
    wrap.appendChild(el("span", "field-label", label));
    var inp = el("input");
    inp.type = "number";
    inp.id = id;
    inp.min = 0;
    inp.max = 100;
    inp.step = "any";
    inp.value = String(value);
    inp.addEventListener("input", function () {
      var v = parseFloat(inp.value);
      onChange(isFinite(v) ? v : 0);
      update();
    });
    wrap.appendChild(inp);
    return wrap;
  }

  function fieldNode(f, world) {
    var gated = f.minWorld && world < f.minWorld && !state.account;
    var wrap = el("label", "field floors-field" + (gated ? " gated" : ""));
    var top = el("span", "field-label", f.label);
    if (f.minWorld && gated) top.textContent += " · World " + f.minWorld + "+";
    wrap.appendChild(top);
    var val = fieldValue(f);
    var inp = el("input");
    inp.id = "floors-f-" + f.id;
    if (f.kind === "bool") {
      wrap.className += " check-field";
      inp.type = "checkbox";
      inp.checked = !!val;
      inp.addEventListener("change", function () {
        setFieldValue(f, !!inp.checked);
        afterFieldChange(f, wrap);
      });
    } else {
      inp.type = "number";
      inp.step = f.kind === "int" ? 1 : "any";
      if (f.min !== undefined) inp.min = f.min;
      if (f.max !== undefined) inp.max = f.max;
      inp.value = val === undefined || val === null ? "" : String(Number(Number(val).toPrecision(10)));
      inp.addEventListener("input", function () {
        var v = parseFloat(inp.value);
        if (!isFinite(v)) return;
        if (f.min !== undefined && f.id !== "w4m" && v < f.min) v = f.min;
        if (f.kind === "int") v = Math.floor(v);
        setFieldValue(f, v);
        afterFieldChange(f, wrap);
      });
    }
    wrap.appendChild(inp);
    var src = el("span", "floors-source", sourceText(f));
    if (fieldEdited(f)) src.className += " edited";
    wrap.appendChild(src);
    if (f.hint || f.where) wrap.appendChild(el("span", "floors-field-hint", (f.hint || "") + (f.hint && f.where ? " " : "") + (f.where ? "Found under " + f.where + "." : "")));
    f._src = src;
    return wrap;
  }

  function sourceText(f) {
    if (!state.account) return "manual";
    if (fieldEdited(f)) return "edited";
    return exportValue(f) === undefined ? "missing from export" : "from account";
  }

  function afterFieldChange(f, wrap) {
    if (f._src) {
      f._src.textContent = sourceText(f);
      f._src.className = "floors-source" + (fieldEdited(f) ? " edited" : "");
    }
    // changing the world re-gates the pickers and the greyed stats
    if (f.id === "world") { renderPickers(); renderStats(); }
    update();
  }

  /* ---------------------------------------------------------------- */
  /* rendering: imported stats mirror                                 */
  /* ---------------------------------------------------------------- */

  function renderImported() {
    clearNode(nodes.imported);
    if (!nodes.imported) return;
    if (!state.account) {
      nodes.imported.appendChild(el("p", "hint", "Load an ExportStats JSON on the home page to see how every value is read."));
      return;
    }
    var table = el("table", "results-table");
    var thead = el("thead");
    var hr = el("tr");
    ["Name", "Key", "Value", "Used"].forEach(function (h) { hr.appendChild(el("th", null, h)); });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody");
    FD.importedRows(state.account.stats).forEach(function (r) {
      var tr = el("tr");
      tr.appendChild(el("td", "name", r.name));
      tr.appendChild(el("td", "floors-key", r.key + (r.index !== null ? "[" + r.index + "]" : "")));
      tr.appendChild(el("td", "num", r.raw === null ? "missing" : (typeof r.raw === "number" ? fmt(r.raw) : String(r.raw))));
      var used = r.used === null ? "-" : (typeof r.used === "boolean" ? (r.used ? "Yes" : "No") : (typeof r.used === "number" ? fmt(r.used) : String(r.used)));
      tr.appendChild(el("td", "num", used));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    nodes.imported.appendChild(scrollWrap(table));
    nodes.imported.appendChild(el("p", "hint", "A read-only copy of the sheet's JSON tab. “Used” is what the maths reads: percents become fractions capped at 100%, the Golden Steak bonus is ×0.001, bomb damage includes the additional multiplier. Your hand edits are not shown here."));
  }

  /* ---------------------------------------------------------------- */
  /* rendering: floor explorer                                        */
  /* ---------------------------------------------------------------- */

  function renderExplorer(res) {
    clearNode(nodes.explorer);
    if (!nodes.explorer) return;
    var ex = state.explorer;

    var bar = el("div", "floors-explorer-bar");
    var world = el("select");
    world.id = "floors-explorer-world";
    [["0", "All worlds"], ["1", "World 1"], ["2", "World 2"], ["3", "World 3"], ["4", "World 4"]].forEach(function (p) {
      var o = el("option", null, p[1]);
      o.value = p[0];
      o.selected = String(ex.world) === p[0];
      world.appendChild(o);
    });
    world.value = String(ex.world);
    world.addEventListener("change", function () {
      ex.world = parseInt(world.value, 10) || 0;
      saveState();
      renderExplorer(res);
    });
    var search = el("input");
    search.id = "floors-explorer-search";
    search.type = "search";
    search.placeholder = "Floor number or ore name";
    search.value = ex.query;
    search.addEventListener("input", function () {
      ex.query = search.value;
      renderExplorerTable(res, tableHost, countNode);
    });
    var countNode = el("span", "hint floors-count");
    countNode.setAttribute("aria-live", "polite");
    bar.appendChild(world);
    bar.appendChild(search);
    bar.appendChild(countNode);
    nodes.explorer.appendChild(bar);
    var tableHost = el("div");
    nodes.explorer.appendChild(tableHost);
    renderExplorerTable(res, tableHost, countNode);
  }

  function renderExplorerTable(res, host, countNode) {
    clearNode(host);
    var ex = state.explorer;
    var q = String(ex.query || "").toLowerCase();
    var isOre = res.kind === "ore";
    var rows = res.rows.filter(function (r) {
      if (ex.world && r.world !== ex.world) return false;
      if (!q) return true;
      return String(r.floor) === q || oreName(r.oreA).toLowerCase().indexOf(q) >= 0 || oreName(r.oreB).toLowerCase().indexOf(q) >= 0;
    });
    function metric(r, key) {
      if (key === "fph") return isOre ? r.Q : r.AF;
      if (key === "base") return isOre ? r.U : r.AJ;
      if (key === "void") return isOre ? r.V : r.AK;
      return r.floor;
    }
    rows = rows.slice().sort(function (a, b) {
      var d = metric(a, ex.sort) - metric(b, ex.sort);
      return (d !== 0 ? d : a.floor - b.floor) * ex.dir;
    });
    countNode.textContent = rows.length + " of " + res.rows.length + " floors";

    var cols = [["floor", "Floor"], [null, "World"], [null, "Ores"], [null, "Modifiers"], ["fph", "Floors / hr"]];
    if (isOre) { cols.push(["base", "Base / hr"]); cols.push(["void", "Void / hr"]); }
    else { cols.push(["base", "Veins / hr"]); cols.push(["void", "Void forced on"]); }

    var table = el("table", "results-table floors-explorer-table");
    var caption = el("caption", null, isOre ? "Every floor for " + (res.ore ? res.ore.name : "your ore") : "Every floor for " + (res.vein ? res.vein.name : "your vein"));
    table.appendChild(caption);
    var thead = el("thead");
    var hr = el("tr");
    cols.forEach(function (c) {
      var th = el("th");
      if (c[0]) {
        var b = el("button", "floors-sort" + (ex.sort === c[0] ? " active" : ""), c[1] + (ex.sort === c[0] ? (ex.dir === 1 ? " ▲" : " ▼") : ""));
        b.type = "button";
        b.setAttribute("aria-sort", ex.sort === c[0] ? (ex.dir === 1 ? "ascending" : "descending") : "none");
        b.addEventListener("click", function () {
          if (ex.sort === c[0]) ex.dir = -ex.dir;
          else { ex.sort = c[0]; ex.dir = c[0] === "floor" ? 1 : -1; }
          saveState();
          renderExplorerTable(res, host, countNode);
        });
        th.appendChild(b);
      } else {
        th.textContent = c[1];
      }
      hr.appendChild(th);
    });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody");
    if (!rows.length) {
      var empty = el("tr");
      var td = el("td", "hint", "No floor matches “" + ex.query + "”.");
      td.colSpan = cols.length;
      empty.appendChild(td);
      tbody.appendChild(empty);
    }
    rows.forEach(function (r) {
      var tr = el("tr", r.floor === state.selectedFloor ? "selected" : (isOre && r.S === 0 ? "dim" : ""));
      var fc = el("td", "name");
      var btn = el("button", "floors-floor-btn", String(r.floor));
      btn.type = "button";
      btn.addEventListener("click", function () { selectFloor(r.floor); });
      fc.appendChild(btn);
      tr.appendChild(fc);
      tr.appendChild(el("td", null, "W" + r.world));
      tr.appendChild(el("td", "floors-ores-text", oresText(r)));
      var mc = el("td");
      mc.appendChild(tagList(r.mods));
      tr.appendChild(mc);
      tr.appendChild(el("td", "num", fmt(metric(r, "fph"))));
      tr.appendChild(el("td", "num", fmt(metric(r, "base"))));
      tr.appendChild(el("td", "num", fmt(metric(r, "void"))));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    host.appendChild(scrollWrap(table));
  }

  /* ---------------------------------------------------------------- */
  /* update                                                           */
  /* ---------------------------------------------------------------- */

  function voidNote(res) {
    var a = res.autoVoid;
    var base = a === "Yes" ? "Auto: use the Void Drone – its floors beat the best no-void floor."
      : a === "No" ? "Auto: skip the Void Drone – the best no-void floor wins with your portal stats."
      : "Auto has nothing to compare yet (pick something farmable).";
    if (res.voidMode === "on") return base + " You forced it on.";
    if (res.voidMode === "off") return base + " You forced it off.";
    return base;
  }

  function update() {
    if (!FD) return;
    var res = evaluate();
    updateAccountStatus();
    if (nodes.voidNote) nodes.voidNote.textContent = voidNote(res);
    renderHero(res);
    renderAlerts(res);
    renderRanking(res);
    renderDetail(res);
    renderExplorer(res);
    renderImported();
    saveState();
  }

  /* ---------------------------------------------------------------- */
  /* controls                                                         */
  /* ---------------------------------------------------------------- */

  function setMode(mode) {
    if (mode !== "ore" && mode !== "veins") return;
    state.mode = mode;
    state.selectedFloor = null;
    renderPickers();
    update();
  }

  function modeFromHash() {
    if (typeof window === "undefined" || !window.location) return null;
    var h = String(window.location.hash || "").toLowerCase();
    if (/(^#\/?)(floors\/veins|best-veins)$/.test(h)) return "veins";
    if (/(^#\/?)(floors\/ore|best-ore)$/.test(h)) return "ore";
    return null;
  }

  function bindControls() {
    if (nodes.modeOre) nodes.modeOre.addEventListener("change", function () { if (nodes.modeOre.checked) setMode("ore"); });
    if (nodes.modeVeins) nodes.modeVeins.addEventListener("change", function () { if (nodes.modeVeins.checked) setMode("veins"); });
    if (nodes.ore) nodes.ore.addEventListener("change", function () {
      if (!nodes.ore.value) return;
      state.ore = nodes.ore.value;
      state.selectedFloor = null;
      update();
    });
    if (nodes.oreFilter) nodes.oreFilter.addEventListener("input", function () {
      state.oreFilter = nodes.oreFilter.value;
      renderPickers();
    });
    if (nodes.showW4) nodes.showW4.addEventListener("change", function () {
      state.showW4 = !!nodes.showW4.checked;
      state.selectedFloor = null;
      update();
    });
    if (nodes.voidMode) nodes.voidMode.addEventListener("change", function () {
      state.voidMode = nodes.voidMode.value;
      state.selectedFloor = null;
      update();
    });
    if (nodes.loadSample) nodes.loadSample.addEventListener("click", function () {
      var b = document.getElementById("btn-sample-new");
      if (b && typeof b.click === "function") b.click();
      else if (b) {
        var hs = b._l && b._l.click;
        if (hs) hs.forEach(function (h) { h({ preventDefault: function () {} }); });
      }
    });
    if (typeof window !== "undefined" && window.addEventListener) {
      window.addEventListener("hashchange", function () {
        var m = modeFromHash();
        if (m && m !== state.mode) setMode(m);
      });
    }
  }

  function cacheNodes() {
    nodes.accountStatus = document.getElementById("floors-account-status");
    nodes.loadSample = document.getElementById("floors-load-sample");
    nodes.modeOre = document.getElementById("floors-mode-ore");
    nodes.modeVeins = document.getElementById("floors-mode-veins");
    nodes.orePicker = document.getElementById("floors-ore-picker");
    nodes.veinPicker = document.getElementById("floors-vein-picker");
    nodes.ore = document.getElementById("floors-ore");
    nodes.oreFilter = document.getElementById("floors-ore-filter");
    nodes.veinGrid = document.getElementById("floors-vein-grid");
    nodes.showW4 = document.getElementById("floors-show-w4");
    nodes.showW4Label = document.getElementById("floors-show-w4-label");
    nodes.voidMode = document.getElementById("floors-void-mode");
    nodes.voidNote = document.getElementById("floors-void-note");
    nodes.hero = document.getElementById("floors-hero");
    nodes.alerts = document.getElementById("floors-alerts");
    nodes.rankingTitle = document.getElementById("floors-ranking-title");
    nodes.ranking = document.getElementById("floors-ranking");
    nodes.detail = document.getElementById("floors-detail");
    nodes.stats = document.getElementById("floors-stats");
    nodes.imported = document.getElementById("floors-imported");
    nodes.explorer = document.getElementById("floors-explorer");
  }

  function init() {
    if (!FD) return;
    cacheNodes();
    if (!nodes.hero || !nodes.ranking || !nodes.ore) return;
    loadSaved();
    var m = modeFromHash();
    if (m) state.mode = m;
    applyAccountRecord();
    bindControls();
    renderPickers();
    renderStats();
    update();
  }

  // Home-page Reset also clears the floor tool's saved choices and edits.
  function resetAll() {
    if (!FD) return;
    clearSaved();
    state.mode = "ore";
    state.ore = DEFAULT_ORE;
    state.vein = DEFAULT_VEIN;
    state.showW4 = false;
    state.voidMode = "auto";
    state.oreFilter = "";
    state.manual = FD.defaultManual();
    state.overrides = {};
    state.overridesFor = null;
    state.morph = 0;
    state.morphGolden = 0;
    state.selectedFloor = null;
    state.explorer = { world: 0, query: "", sort: "floor", dir: 1 };
    state.account = null;
    renderPickers();
    renderStats();
    update();
  }

  global.FloorTool = {
    init: init,
    refreshAccount: refreshAccount,
    resetAll: resetAll,
    getState: function () {
      return {
        mode: state.mode, ore: state.ore, vein: state.vein, showW4: state.showW4, voidMode: state.voidMode,
        manual: cloneJson(state.manual), overrides: cloneJson(state.overrides),
        morph: state.morph, morphGolden: state.morphGolden,
        selectedFloor: state.selectedFloor,
        account: state.account ? state.account.version : null,
        env: state.env, result: state.result
      };
    }
  };

})(typeof window !== "undefined" ? window : globalThis);
