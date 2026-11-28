/*
 * Max damage calculator UI.
 *
 * Depends on:
 *   damagedata.js  (window.DamageData)
 *   contractdata.js (window.ContractData)
 *   exportstats.js / account.js when a saved account is present
 *
 * Exposed as window.DamageTool so app.js can initialise it and refresh it
 * after an account import/reset.
 */
(function (global) {
  "use strict";

  var DD = global.DamageData;
  var CD = global.ContractData;
  var ACCOUNT = global.AccountStore || null;
  var ES = global.ExportStats || null;
  var KEY = "obelisk-damage-v1";
  var ARMOR_LEVEL_COUNT = 5;

  var state = {
    stats: DD ? DD.defaultStats() : {},
    source: "defaults",
    account: null,
    items: DD ? DD.defaultItems(true) : {},
    golden: { primalMeat: false, hamburger: false, chaosTotem: false },
    contractMode: "maxed",
    contractsCompleted: 0,
    contractCapIncrease: 0,
    targetOb: 0,
    overrides: {},
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
    while (abs >= 1000 && tier < SUFFIX.length - 1) {
      abs /= 1000;
      tier++;
    }
    var s;
    if (tier === 0) s = abs < 10 ? abs.toFixed(2) : abs < 100 ? abs.toFixed(1) : Math.round(abs).toString();
    else s = abs.toFixed(abs < 10 ? 2 : abs < 100 ? 1 : 0) + SUFFIX[tier];
    return (neg ? "-" : "") + s;
  }

  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return "-";
    return (n * 100).toFixed(2) + "%";
  }

  function fmtChance(n) {
    if (n === null || n === undefined || !isFinite(n)) return "-";
    return (n * 100).toFixed(1) + "%";
  }

  function fmtFactor(n) {
    if (n === null || n === undefined || !isFinite(n)) return "-";
    if (n >= 1000) return fmt(n) + "x";
    return String(Math.round(n * 1000) / 1000) + "x";
  }

  function fmtDelta(n) {
    if (n === null || n === undefined || !isFinite(n)) return "-";
    return "x" + (n >= 100 ? Math.round(n) : n >= 10 ? n.toFixed(1) : n.toFixed(2));
  }

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

  /* ---------------------------------------------------------------- */
  /* saved settings                                                   */
  /* ---------------------------------------------------------------- */

  function loadPrefs() {
    var storage = getStorage();
    if (!storage) return;
    try {
      var raw = storage.getItem(KEY);
      if (!raw) return;
      var p = JSON.parse(raw);
      if (p && typeof p === "object") {
        if (p.items) state.items = Object.assign({}, state.items, p.items);
        if (p.golden) state.golden = Object.assign({}, state.golden, p.golden);
        if (p.overrides && typeof p.overrides === "object") state.overrides = p.overrides;
        if (p.contractMode === "current" || p.contractMode === "maxed") state.contractMode = p.contractMode;
        if (typeof p.targetOb === "number" && isFinite(p.targetOb)) state.targetOb = Math.max(0, Math.floor(p.targetOb));
        if (typeof p.contractsCompleted === "number" && isFinite(p.contractsCompleted)) {
          state.contractsCompleted = Math.max(0, Math.floor(p.contractsCompleted));
        }
      }
    } catch (e) { /* ignore unreadable settings */ }
  }

  function savePrefs() {
    var storage = getStorage();
    if (!storage) return;
    try {
      storage.setItem(KEY, JSON.stringify({
        items: state.items,
        golden: state.golden,
        overrides: state.overrides,
        contractMode: state.contractMode,
        contractsCompleted: state.contractsCompleted,
        targetOb: state.targetOb
      }));
    } catch (e) { /* storage blocked */ }
  }

  /* ---------------------------------------------------------------- */
  /* account                                                          */
  /* ---------------------------------------------------------------- */

  function applyAccount(acct) {
    if (!acct || !acct.stats) return;
    var savedChaosGolden = !!(state.golden && state.golden.chaosTotem);
    state.stats = JSON.parse(JSON.stringify(acct.stats));
    applyOverrides(state.stats, state.overrides);
    if (!isFinite(asNumber(state.stats.obelisk_armor_reduction, NaN))) {
      state.stats.obelisk_armor_reduction = 1;
    }
    state.source = Object.keys(state.overrides || {}).length ? "account-edited" : "account";
    state.account = acct;
    state.golden = DD.goldenFromStats(state.stats);
    state.golden.chaosTotem = savedChaosGolden;
    state.contractCapIncrease = Math.max(0, Math.floor(asNumber(acct.stats.contract_cap_increase, 0)));
    if (nodes.statsDetails) nodes.statsDetails.open = false;
    fillInputs();
    renderItems();
    update();
  }

  function resetAll(keepPrefs) {
    if (!keepPrefs) {
      state.items = DD.defaultItems(true);
      state.golden = { primalMeat: false, hamburger: false, chaosTotem: false };
      state.overrides = {};
      state.contractMode = "maxed";
      state.contractsCompleted = 0;
    }
    state.stats = DD.defaultStats();
    applyOverrides(state.stats, state.overrides);
    state.source = Object.keys(state.overrides || {}).length ? "manual" : "defaults";
    state.account = null;
    state.contractCapIncrease = 0;
    if (nodes.statsDetails) nodes.statsDetails.open = true;
    fillInputs();
    renderItems();
    update();
  }

  // Called by app.js after an import or a reset on the home page.
  function refreshAccount() {
    if (!DD) return;
    var acct = readAccount();
    if (acct && acct.stats) {
      if (state.account && acct.record) {
        var previousKey = state.account.record
          ? String(state.account.record.importedAt) + "|" + state.account.record.raw
          : "";
        var nextKey = String(acct.record.importedAt) + "|" + acct.record.raw;
        if (previousKey !== nextKey) state.overrides = {};
      }
      applyAccount(acct);
    } else {
      resetAll(true);
    }
  }

  function markManual() {
    if (state.source === "account") state.source = "account-edited";
    else if (state.source !== "account-edited") state.source = "manual";
    updateSourceNote();
  }

  function updateSourceNote() {
    if (nodes.accountStatus) {
      if (state.source === "account") {
        var accountLabel = state.account && state.account.record ? "your saved account" : "the sample account";
        nodes.accountStatus.textContent = "Using " + accountLabel +
          (state.account && state.account.version ? " (" + state.account.version + ")" : "") +
          ". Consumables, damage contracts, and the damage stats are pre-filled.";
      } else if (state.source === "account-edited") {
        nodes.accountStatus.textContent = "Using your saved account with hand edits. Edits are kept in this browser until a new import or Reset.";
      } else if (state.source === "manual") {
        nodes.accountStatus.textContent = "Using hand-entered damage stats. Import an account for exact consumable and contract data.";
      } else {
        nodes.accountStatus.textContent = "No account JSON loaded - enter damage stats by hand, or import one on the home page.";
      }
    }

    if (nodes.scenarioNote) {
      var contractText = state.contractMode === "maxed"
        ? "damage contracts maxed at the current cap (base + " + state.contractCapIncrease + ")"
        : "current contract levels";
      var itemText = selectedItemLabel();
      nodes.scenarioNote.textContent = itemText + "; " + contractText +
        ". Contracts completed: " + state.contractsCompleted + ".";
    }
  }

  function selectedItemLabel() {
    var on = DD.ITEMS.filter(function (item) { return state.items[item.id]; });
    if (!on.length) return "No damage consumables";
    if (on.length === DD.ITEMS.length) return "All damage consumables on";
    return on.map(function (item) { return item.name; }).join(", ");
  }

  /* ---------------------------------------------------------------- */
  /* static editors                                                   */
  /* ---------------------------------------------------------------- */

  function applyOverride(stats, key, value) {
    if (key === "workshopHamburger") {
      stats.workshop_array = (stats.workshop_array || []).slice();
      stats.workshop_array[22] = value;
    } else if (key === "blackHoleLevel") {
      stats.black_hole_level = value;
    } else {
      stats[key] = value;
    }
  }

  function applyOverrides(stats, overrides) {
    Object.keys(overrides || {}).forEach(function (key) {
      applyOverride(stats, key, overrides[key]);
    });
  }

  function field(label, key, step) {
    var wrap = el("label", "field");
    wrap.appendChild(el("span", "field-label", label));
    var input = el("input");
    input.type = "number";
    input.id = "damage-stat-" + key;
    input.step = step || "any";
    input.min = "0";
    input.addEventListener("input", function () {
      var v = parseFloat(input.value);
      if (!isFinite(v)) return;
      if (key === "workshopHamburger") v = Math.max(0, Math.floor(v));
      if (key === "blackHoleLevel") v = Math.max(0, Math.floor(v));
      state.overrides[key] = v;
      applyOverride(state.stats, key, v);
      if (key === "blackHoleLevel" && v >= 13) state.golden.primalMeat = true;
      markManual();
      update();
    });
    wrap.appendChild(input);
    return wrap;
  }

  function renderStatEditor() {
    if (!nodes.statsEditor) return;
    nodes.statsEditor.innerHTML = "";

    var pickaxe = el("div", "damage-editor-group");
    pickaxe.appendChild(el("h3", null, "Pickaxe"));
    var pickaxeGrid = el("div", "grid damage-editor-grid");
    [
      ["Pickaxe damage", "pickaxe_damage"],
      ["Crit chance (%)", "pickaxe_crit_chance"],
      ["Crit damage (x)", "pickaxe_crit_damage"],
      ["Super crit chance (%)", "pickaxe_super_crit_chance"],
      ["Super crit damage (x)", "pickaxe_super_crit_damage"],
      ["Ultra crit chance (%)", "pickaxe_ultra_crit_chance"],
      ["Ultra crit damage (x)", "pickaxe_ultra_crit_damage"],
      ["Omega crit chance (%)", "pickaxe_omega_crit_chance"],
      ["Omega crit damage (x)", "pickaxe_omega_crit_damage"],
      ["Attack speed (/s)", "pickaxe_attack_speed_per_second"],
      ["Game speed (x)", "game_speed_multi"]
    ].forEach(function (row) {
      pickaxeGrid.appendChild(field(row[0], row[1]));
    });
    pickaxe.appendChild(pickaxeGrid);
    nodes.statsEditor.appendChild(pickaxe);

    var bomb = el("div", "damage-editor-group");
    bomb.appendChild(el("h3", null, "Bomb"));
    var bombGrid = el("div", "grid damage-editor-grid");
    [
      ["Bomb damage", "bomb_damage"],
      ["Additional bomb multiplier", "bomb_additional_multiplier"],
      ["Crit chance (%)", "bomb_crit_chance"],
      ["Crit damage (x)", "bomb_crit_damage"],
      ["Super crit chance (%)", "bomb_super_crit_chance"],
      ["Super crit damage (x)", "bomb_super_crit_damage"],
      ["Ultra crit chance (%)", "bomb_ultra_crit_chance"],
      ["Ultra crit damage (x)", "bomb_ultra_crit_damage"],
      ["Omega crit chance (%)", "bomb_omega_crit_chance"],
      ["Omega crit damage (x)", "bomb_omega_crit_damage"]
    ].forEach(function (row) {
      bombGrid.appendChild(field(row[0], row[1]));
    });
    bomb.appendChild(bombGrid);
    bomb.appendChild(el("p", "hint", "Additional bomb multiplier is the raw export value; the calculator uses 1 + it, the same as the Best Floor tool."));
    nodes.statsEditor.appendChild(bomb);

    var items = el("div", "damage-editor-group");
    items.appendChild(el("h3", null, "Item and progression stats"));
    var itemGrid = el("div", "grid damage-editor-grid");
    itemGrid.appendChild(field("Hamburger workshop level", "workshopHamburger", "1"));
    itemGrid.appendChild(field("Black hole level", "blackHoleLevel", "1"));
    itemGrid.appendChild(field("Obelisk level", "obelisk_level", "1"));
    itemGrid.appendChild(field("Obelisk armour reduction (x)", "obelisk_armor_reduction", "0.01"));
    items.appendChild(itemGrid);
    items.appendChild(el("p", "hint", "The hamburger level comes from workshop_array[22]. Black hole 13 unlocks Golden Primal Meat; the Blackened Basker tribute unlocks Golden Hamburger. Both are detected from the account, and the golden checkboxes below can override them for a what-if. Obelisk armour reduction is the in-game multiplier applied to the base armour table (0.12 makes OB62 armour 73.1oc instead of 609oc)."));
    nodes.statsEditor.appendChild(items);

    fillStatInputs();
  }

  function fillStatInputs() {
    if (!nodes.statsEditor) return;
    var s = state.stats || {};
    function set(key, value) {
      var input = document.getElementById("damage-stat-" + key);
      if (input) input.value = inputValue(value === undefined || value === null ? 0 : value);
    }
    [
      "pickaxe_damage", "pickaxe_crit_chance", "pickaxe_crit_damage",
      "pickaxe_super_crit_chance", "pickaxe_super_crit_damage",
      "pickaxe_ultra_crit_chance", "pickaxe_ultra_crit_damage",
      "pickaxe_omega_crit_chance", "pickaxe_omega_crit_damage",
      "pickaxe_attack_speed_per_second", "game_speed_multi",
      "bomb_damage", "bomb_additional_multiplier",
      "bomb_crit_chance", "bomb_crit_damage",
      "bomb_super_crit_chance", "bomb_super_crit_damage",
      "bomb_ultra_crit_chance", "bomb_ultra_crit_damage",
      "bomb_omega_crit_chance", "bomb_omega_crit_damage",
      "obelisk_level", "obelisk_armor_reduction"
    ].forEach(function (key) { set(key, s[key]); });
    var workshop = Array.isArray(s.workshop_array) ? asNumber(s.workshop_array[22], 0) : 0;
    set("workshopHamburger", workshop);
    set("blackHoleLevel", asNumber(s.black_hole_level, 0));
  }

  function fillInputs() {
    if (nodes.contractsCompleted) nodes.contractsCompleted.value = String(state.contractsCompleted);
    if (nodes.capIncrease) nodes.capIncrease.value = String(state.contractCapIncrease);
    if (nodes.targetOb) nodes.targetOb.value = String(state.targetOb);
    if (nodes.contractsMax) nodes.contractsMax.checked = state.contractMode === "maxed";
    if (nodes.contractsCurrent) nodes.contractsCurrent.checked = state.contractMode === "current";
    fillStatInputs();
    updateSourceNote();
  }

  /* ---------------------------------------------------------------- */
  /* item editor                                                      */
  /* ---------------------------------------------------------------- */

  function itemEffect(item) {
    if (item.id === "primalMeat") {
      return state.golden.primalMeat ? "+200% pickaxe damage" : "+100% pickaxe damage";
    }
    if (item.id === "hamburger") {
      return fmtFactor(DD.hamburgerMultiplier(state.stats, state.golden.hamburger)) +
        " pickaxe and bomb damage";
    }
    if (item.id === "chaosTotem") {
      return (state.golden.chaosTotem ? "9.00x" : "3.00x") + " bomb damage";
    }
    return item.effect;
  }

  function renderItems() {
    if (!nodes.items) return;
    nodes.items.innerHTML = "";

    DD.ITEMS.forEach(function (item) {
      var label = el("label", "damage-item");
      label.setAttribute("data-item", item.id);
      var check = el("input");
      check.type = "checkbox";
      check.id = "damage-item-" + item.id;
      check.checked = !!state.items[item.id];
      check.addEventListener("change", function () {
        state.items[item.id] = check.checked;
        update();
      });
      label.appendChild(check);

      var main = el("span", "damage-item-main");
      var name = el("span", "damage-item-name", item.name);
      if (state.result && state.result.activeItems[item.id]) {
        name.appendChild(el("span", "damage-item-active", "Active at export"));
      }
      if ((item.id === "primalMeat" && state.golden.primalMeat) ||
          (item.id === "hamburger" && state.golden.hamburger) ||
          (item.id === "chaosTotem" && state.golden.chaosTotem)) {
        name.appendChild(el("span", "damage-item-golden", "Golden"));
      }
      main.appendChild(name);
      main.appendChild(el("span", "damage-item-effect", itemEffect(item)));
      label.appendChild(main);
      if (state.items[item.id]) label.className += " active";
      nodes.items.appendChild(label);
    });

    renderGoldenInputs();
  }

  function renderGoldenInputs() {
    if (!nodes.golden) return;

    if (!nodes.goldenBuilt) {
      nodes.golden.innerHTML = "";
      nodes.golden.appendChild(el("span", "field-label", "Golden item unlocks"));

      function goldenCheck(id, label, hint) {
        var wrap = el("label", "check damage-golden-check");
        var input = el("input");
        input.type = "checkbox";
        input.id = id;
        input.addEventListener("change", function () {
          state.golden[id === "damage-golden-primal" ? "primalMeat" :
            id === "damage-golden-hamburger" ? "hamburger" : "chaosTotem"] = input.checked;
          update();
        });
        wrap.appendChild(input);
        wrap.appendChild(el("span", null, label));
        if (hint) wrap.appendChild(el("span", "hint", hint));
        return wrap;
      }

      nodes.golden.appendChild(goldenCheck(
        "damage-golden-primal", "Golden Primal Meat", "Black Hole 13+"
      ));
      nodes.golden.appendChild(goldenCheck(
        "damage-golden-hamburger", "Golden Hamburger", "Blackened Basker tribute"
      ));
      nodes.golden.appendChild(goldenCheck(
        "damage-golden-chaos", "Golden Chaos Totem", "Skin reward"
      ));
      nodes.goldenBuilt = true;
    }

    function sync(id, checked) {
      var input = document.getElementById(id);
      if (input) input.checked = !!checked;
    }
    sync("damage-golden-primal", state.golden.primalMeat);
    sync("damage-golden-hamburger", state.golden.hamburger);
    sync("damage-golden-chaos", state.golden.chaosTotem);
  }

  /* ---------------------------------------------------------------- */
  /* results                                                          */
  /* ---------------------------------------------------------------- */

  function update() {
    if (!DD) return;
    state.result = DD.computeDamage(state.stats, {
      items: state.items,
      golden: state.golden,
      contractMode: state.contractMode,
      contractsCompleted: state.contractsCompleted,
      contractCapIncrease: state.contractCapIncrease,
      targetOb: state.targetOb
    });
    renderHero();
    renderArmorLevels();
    renderStats();
    renderCritTable();
    renderContracts();
    renderItemTable();
    renderWarnings();
    updateSourceNote();
    renderItems();
    savePrefs();
  }

  function renderHero() {
    if (!nodes.hero) return;
    nodes.hero.innerHTML = "";
    var r = state.result;
    if (!r) return;

    var hero = el("div", "damage-hero");
    var main = el("div", "damage-hero-main");
    main.appendChild(el("span", "damage-hero-label", "Maximum pickaxe hit"));
    main.appendChild(el("strong", "damage-hero-value", fmt(r.scenario.pickaxe.hit.max)));
    main.appendChild(el("span", "damage-hero-sub",
      r.scenario.pickaxe.hit.maxTierName + " · " + fmtChance(r.scenario.pickaxe.hit.maxChance) +
      " chance · before armour"));
    hero.appendChild(main);

    var compare = el("div", "damage-hero-compare");
    compare.appendChild(el("span", "damage-hero-label", "Current setup"));
    compare.appendChild(el("strong", "damage-hero-current", fmt(r.current.pickaxe.hit.max)));
    var delta = r.deltas.maxHit;
    var deltaClass = "damage-delta" +
      (delta !== null && delta >= 1 ? " up" : delta !== null && delta < 1 ? " down" : "");
    compare.appendChild(el("span", deltaClass,
      delta !== null ? fmtDelta(delta) + " max hit" : "no comparison"));
    hero.appendChild(compare);
    nodes.hero.appendChild(hero);

    var bomb = el("div", "damage-bomb-card");
    bomb.appendChild(el("span", "damage-bomb-label", "Maximum bomb hit"));
    bomb.appendChild(el("strong", "damage-bomb-value", fmt(r.scenario.bomb.hit.max)));
    bomb.appendChild(el("span", "damage-bomb-sub",
      r.scenario.bomb.hit.maxTierName + " · " + fmtChance(r.scenario.bomb.hit.maxChance) + " chance · " +
      fmtDelta(r.deltas.bombMaxHit) + " vs current"));
    nodes.hero.appendChild(bomb);

    var ar = r.armor && r.armor.scenario;
    if (ar) {
      var cur = r.armor.current;
      var pass = ar.pass;
      var card = el("div", "damage-bomb-card damage-armor " + (pass ? "pass" : "fail"));
      card.appendChild(el("span", "damage-bomb-label", "Obelisk armour check (OB " + ar.level + ")"));
      card.appendChild(el("strong", "damage-bomb-value",
        pass
          ? "Met · " + fmt(ar.max.hit) + " damage after armour"
          : "Not met · crits cannot damage it"));

      var armorText = "Armour " + fmt(ar.armor);
      if (ar.reduction < 1) {
        armorText += " (" + fmtPct(ar.reduction) + " of " + fmt(ar.baseArmor) + " base)";
      }
      var detail = armorText + " · base hit " + fmt(ar.base) + " is " +
        ar.baseRatio.toPrecision(3) + "× armour";
      if (pass) detail += " · expected " + fmt(ar.expected.hit) + " after armour";
      if (cur) {
        detail += " · current setup base hit " + fmt(cur.base) + " (" +
          cur.baseRatio.toPrecision(3) + "×, " + (cur.pass ? "met" : "not met") + ")";
      }
      card.appendChild(el("span", "damage-bomb-sub", detail));
      nodes.hero.appendChild(card);
    }
  }

  function armorStatus(info) {
    return el("span", "damage-armor-" + (info.pass ? "pass" : "fail"),
      (info.pass ? "Met" : "Not met") + " · " + info.ratio.toPrecision(3) + "×");
  }

  function renderArmorLevels() {
    if (!nodes.armorLevels) return;
    nodes.armorLevels.innerHTML = "";
    var r = state.result;
    var ar = r && r.armor && r.armor.scenario;
    if (!ar) return;

    var rows = DD.armorLevels(ar.level, ARMOR_LEVEL_COUNT,
      r.scenario.pickaxe.base, r.current.pickaxe.base, ar.reduction);
    if (!rows.length) return;

    nodes.armorLevels.appendChild(el("h3", null,
      "Next Obelisk armour checks (OB " + rows[0].level + "–" + rows[rows.length - 1].level + ")"));

    var table = el("table", "damage-table damage-armor-table");
    var thead = el("thead");
    var head = el("tr");
    ["Obelisk", "Effective armour", "Selected scenario", "Current setup"].forEach(function (label) {
      var th = el("th", null, label);
      th.setAttribute("scope", "col");
      head.appendChild(th);
    });
    thead.appendChild(head);
    table.appendChild(thead);

    var tbody = el("tbody");
    rows.forEach(function (row, index) {
      var tr = el("tr");
      if (index === 0) tr.className = "damage-armor-target";
      tr.appendChild(el("td", null, "OB " + row.level));
      tr.appendChild(el("td", null, fmt(row.armor)));
      var scenarioCell = el("td");
      scenarioCell.appendChild(armorStatus(row.scenario));
      tr.appendChild(scenarioCell);
      var currentCell = el("td");
      currentCell.appendChild(armorStatus(row.current));
      tr.appendChild(currentCell);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    nodes.armorLevels.appendChild(scrollWrap(table));

    var reductionText = ar.reduction < 1
      ? "Effective armour = the base armour table × " + fmtPct(ar.reduction) + "."
      : "Effective armour = the base armour table.";
    nodes.armorLevels.appendChild(el("p", "hint", reductionText +
      " Base hits: " + fmt(r.scenario.pickaxe.base) + " selected, " +
      fmt(r.current.pickaxe.base) + " current. Armour must be beaten before crits."));
  }

  function renderStats() {
    if (!nodes.stats) return;
    nodes.stats.innerHTML = "";
    var r = state.result;
    if (!r) return;
    var p = r.scenario.pickaxe;

    var grid = el("div", "damage-stat-grid");
    function stat(label, value, note) {
      var card = el("div", "damage-stat");
      card.appendChild(el("span", "damage-stat-label", label));
      card.appendChild(el("strong", "damage-stat-value", value));
      if (note) card.appendChild(el("span", "damage-stat-note", note));
      grid.appendChild(card);
    }

    stat("Base pickaxe damage", fmt(p.base), "after consumables and contracts");
    stat("Max crit multiplier", fmtFactor(p.hit.max / Math.max(1e-12, p.base)), "all tiers in the chain");
    stat("Expected hit", fmt(p.hit.expected),
      "probability-weighted" + (r.deltas.expected ? " · " + fmtDelta(r.deltas.expected) + " vs current" : ""));
    stat("Expected DPS", fmt(p.dps),
      "expected hit x attack speed x game speed" + (r.deltas.dps ? " · " + fmtDelta(r.deltas.dps) + " vs current" : ""));
    stat("Attack speed", fmt(p.attackSpeed) + " /s", "Banana Coffee included");
    stat("Game speed", fmtFactor(p.gameSpeed), "Blue Cow included");
    nodes.stats.appendChild(grid);

    var breakdown = el("div", "damage-breakdown");
    breakdown.appendChild(el("span", null, "Consumable multiplier: " + fmtFactor(p.itemFactor)));
    breakdown.appendChild(el("span", null, "Contract damage multiplier: " + fmtFactor(p.contractBaseFactor)));
    breakdown.appendChild(el("span", null, "Contract crit multiplier: " + fmtFactor(p.contractCritFactor)));
    nodes.stats.appendChild(breakdown);
  }

  function renderCritTable() {
    if (!nodes.crit) return;
    nodes.crit.innerHTML = "";
    var r = state.result;
    if (!r) return;

    nodes.crit.appendChild(el("h3", null, "Pickaxe crit tiers"));
    var table = el("table", "damage-table");
    var thead = el("thead");
    var hr = el("tr");
    ["Tier", "Chance of this outcome", "Total multiplier", "Damage"].forEach(function (h) {
      hr.appendChild(el("th", null, h));
    });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody");
    r.scenario.pickaxe.hit.tiers.forEach(function (tier) {
      var tr = el("tr");
      if (tier.id === r.scenario.pickaxe.hit.maxTier) tr.className = "damage-best-tier";
      tr.appendChild(el("td", null, tier.name));
      tr.appendChild(el("td", null, fmtChance(tier.chance)));
      tr.appendChild(el("td", null, fmtFactor(tier.multiplier)));
      tr.appendChild(el("td", null, fmt(tier.damage)));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    nodes.crit.appendChild(scrollWrap(table));
    nodes.crit.appendChild(el("p", "hint",
      "Each tier only rolls after the previous one succeeds. The expected hit is the sum of outcome chance x damage; the maximum hit is the highest tier that has a non-zero chance."));
  }

  function renderContracts() {
    if (!nodes.contracts) return;
    nodes.contracts.innerHTML = "";
    var r = state.result;
    if (!r || !r.contracts) {
      nodes.contracts.appendChild(el("p", "hint", "Contract data is unavailable."));
      return;
    }

    var table = el("table", "damage-table damage-contract-table");
    var thead = el("thead");
    var hr = el("tr");
    ["Contract upgrade", "Current", "Maxed", "Current effect", "Maxed effect", "Change"].forEach(function (h) {
      hr.appendChild(el("th", null, h));
    });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody");

    r.contracts.rows.forEach(function (row) {
      var tr = el("tr");
      if (row.locked) tr.className = "damage-locked";
      else if (row.maxLevel !== row.currentLevel) tr.className = "damage-changed";
      tr.appendChild(el("td", null, row.name));
      tr.appendChild(el("td", null, String(row.currentLevel)));

      var maxCell = el("td", null, String(row.maxLevel));
      if (row.locked) maxCell.appendChild(el("span", "damage-lock", "OB " + row.obMin));
      tr.appendChild(maxCell);

      var currentEffect, maxEffect, change;
      if (row.kind === "chance") {
        currentEffect = fmtChance(row.currentChance);
        maxEffect = fmtChance(row.maxChance);
        change = row.locked ? "OB " + row.obMin + " locked"
          : row.maxChance > row.currentChance
            ? "+" + ((row.maxChance - row.currentChance) * 100).toFixed(1) + "pp"
            : "no change";
      } else {
        currentEffect = fmtFactor(row.currentFactor);
        maxEffect = fmtFactor(row.maxFactor);
        change = row.locked ? "OB " + row.obMin + " locked"
          : row.maxFactor > row.currentFactor
            ? fmtFactor(row.maxFactor / Math.max(1e-12, row.currentFactor))
            : "no change";
      }
      tr.appendChild(el("td", null, currentEffect));
      tr.appendChild(el("td", null, maxEffect));
      tr.appendChild(el("td", null, change));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    nodes.contracts.appendChild(scrollWrap(table));
    nodes.contracts.appendChild(el("p", "hint",
      "pp = percentage points. Maxed uses the current contract cap (base max + " + r.contracts.capIncrease +
      " cap increase). Only the damage-related upgrades are changed; non-damage contracts stay at their exported levels."));
  }

  function renderItemTable() {
    if (!nodes.itemTable) return;
    nodes.itemTable.innerHTML = "";
    var r = state.result;
    if (!r) return;

    var table = el("table", "damage-table damage-item-table");
    var thead = el("thead");
    var hr = el("tr");
    ["Consumable", "At export", "Scenario", "Effect"].forEach(function (h) {
      hr.appendChild(el("th", null, h));
    });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody");

    DD.ITEMS.forEach(function (item) {
      var tr = el("tr");
      tr.appendChild(el("td", null, item.name));
      tr.appendChild(el("td", null, r.activeItems[item.id] ? "Active" : "Off"));
      tr.appendChild(el("td", null, r.items[item.id] ? "On" : "Off"));
      tr.appendChild(el("td", null, itemEffect(item)));
      if (r.items[item.id] !== r.activeItems[item.id]) tr.className = "damage-changed";
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    nodes.itemTable.appendChild(scrollWrap(table));
  }

  function renderWarnings() {
    if (!nodes.warnings) return;
    nodes.warnings.innerHTML = "";
    var r = state.result;
    if (!r || !r.warnings.length) return;
    var box = el("div", "damage-warning");
    r.warnings.forEach(function (w) { box.appendChild(el("p", null, w)); });
    nodes.warnings.appendChild(box);
  }

  /* ---------------------------------------------------------------- */
  /* wiring                                                           */
  /* ---------------------------------------------------------------- */

  function init() {
    if (!DD) return;

    nodes.accountStatus = document.getElementById("damage-account-status");
    nodes.scenarioNote = document.getElementById("damage-scenario-note");
    nodes.items = document.getElementById("damage-items");
    nodes.golden = document.getElementById("damage-golden");
    nodes.hero = document.getElementById("damage-hero");
    nodes.armorLevels = document.getElementById("damage-armor-levels");
    nodes.stats = document.getElementById("damage-stats");
    nodes.crit = document.getElementById("damage-crit");
    nodes.contracts = document.getElementById("damage-contracts");
    nodes.itemTable = document.getElementById("damage-item-table");
    nodes.warnings = document.getElementById("damage-warnings");
    nodes.statsEditor = document.getElementById("damage-stats-editor");
    nodes.statsDetails = document.getElementById("damage-stats-details");
    nodes.contractsCompleted = document.getElementById("damage-contracts-completed");
    nodes.capIncrease = document.getElementById("damage-cap-increase");
    nodes.targetOb = document.getElementById("damage-target-ob");
    nodes.contractsMax = document.getElementById("damage-contracts-max");
    nodes.contractsCurrent = document.getElementById("damage-contracts-current");

    loadPrefs();

    if (nodes.contractsCompleted) {
      nodes.contractsCompleted.addEventListener("input", function () {
        var v = parseInt(nodes.contractsCompleted.value, 10);
        if (!isFinite(v)) return;
        state.contractsCompleted = Math.max(0, v);
        update();
      });
    }
    if (nodes.targetOb) {
      nodes.targetOb.addEventListener("input", function () {
        var v = parseInt(nodes.targetOb.value, 10);
        if (!isFinite(v)) return;
        state.targetOb = Math.max(0, v);
        update();
      });
    }
    if (nodes.capIncrease) {
      nodes.capIncrease.addEventListener("input", function () {
        var v = parseInt(nodes.capIncrease.value, 10);
        if (!isFinite(v)) return;
        state.contractCapIncrease = Math.max(0, v);
        update();
      });
    }
    if (nodes.contractsMax) {
      nodes.contractsMax.addEventListener("change", function () {
        if (!nodes.contractsMax.checked) return;
        state.contractMode = "maxed";
        update();
      });
    }
    if (nodes.contractsCurrent) {
      nodes.contractsCurrent.addEventListener("change", function () {
        if (!nodes.contractsCurrent.checked) return;
        state.contractMode = "current";
        update();
      });
    }

    function preset(btn, fn) {
      if (!btn) return;
      btn.addEventListener("click", function () {
        fn();
        renderItems();
        update();
      });
    }
    preset(document.getElementById("damage-items-all"), function () {
      state.items = DD.defaultItems(true);
    });
    preset(document.getElementById("damage-items-export"), function () {
      state.items = DD.activeItemsFromStats(state.stats);
    });
    preset(document.getElementById("damage-items-none"), function () {
      state.items = DD.defaultItems(false);
    });

    renderStatEditor();
    refreshAccount();
  }

  global.DamageTool = {
    init: init,
    refreshAccount: refreshAccount,
    resetAll: resetAll,
    getState: function () { return state; }
  };

})(typeof window !== "undefined" ? window : globalThis);
