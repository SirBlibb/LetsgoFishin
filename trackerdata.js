/*
 * Tracker data helpers: ExportStats timestamps, snapshot records, metric
 * catalogue, graph series, and the IndexedDB/local-storage history store.
 *
 * Exposed as window.TrackerData.
 */
(function (global) {
  "use strict";

  var EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
  var DAY_MS = 86400000;
  var DB_NAME = "obelisk-tracker";
  var DB_VERSION = 1;
  var STORE_NAME = "snapshots";
  var FALLBACK_KEY = "obelisk-tracker-fallback-v1";
  var FALLBACK_LIMIT = 50;
  var PREFS_KEY = "obelisk-tracker-prefs-v1";
  var SEEDED_KEY = "obelisk-tracker-seeded-v1";

  var DERIVED = [
    { key: "derived:fishing_upgrades_total", label: "Total fishing upgrade levels", group: "Fishing" },
    { key: "derived:fishing_enhance_total", label: "Total fishing enhance levels", group: "Fishing" },
    { key: "derived:cards_total", label: "Total fish card levels", group: "Fishing" },
    { key: "derived:contracts_total", label: "Total contract levels", group: "Contracts" },
    { key: "derived:pet_levels_total", label: "Total pet levels", group: "Pets" },
    { key: "derived:skill_tree_total", label: "Skill-tree nodes purchased", group: "Skills" },
    { key: "derived:idols_total", label: "Total idol levels", group: "Idols" }
  ];

  var HEADLINE = [
    "obelisk_level",
    "current_floor",
    "worlds_unlocked",
    "black_hole_level",
    "all_floor_multipliers",
    "ore_sell_price_multi",
    "game_speed_multi",
    "pickaxe_damage",
    "bomb_damage",
    "fishing_income_multi",
    "derived:fishing_upgrades_total",
    "derived:contracts_total"
  ];

  var LABELS = {
    obelisk_level: "OB level",
    current_floor: "Current floor",
    worlds_unlocked: "Worlds unlocked",
    black_hole_level: "Black hole level",
    all_floor_multipliers: "All-floor multiplier",
    ore_sell_price_multi: "Ore sell price multiplier",
    game_speed_multi: "Game speed",
    pickaxe_damage: "Pickaxe damage",
    bomb_damage: "Bomb damage",
    fishing_income_multi: "Fishing income multiplier",
    experience_multi: "Experience multiplier",
    prestige_point_multi: "Prestige point multiplier",
    ore_income_multi: "Ore income multiplier",
    bar_output_multi: "Bar output multiplier",
    bar_craft_cost_multi: "Bar craft cost multiplier",
    contract_upgrade_cost_reduction: "Contract cost reduction",
    contract_points_rewarded: "Contract points rewarded",
    all_star_multi: "All-star multiplier",
    star_spawn_rate: "Star spawn rate",
    fishing_rod_power: "Fishing rod power",
    fishing_drone_multiplier: "Fishing drone multiplier",
    fishing_tick_speed: "Fishing tick speed",
    fishing_shiny_chance: "Shiny chance",
    fishing_super_shiny_chance: "Super-shiny chance",
    xp_level_cap: "XP level cap",
    void_portal_chance: "Void portal chance",
    void_portal_multi: "Void portal multiplier",
    golden_floor_chance: "Golden floor chance",
    golden_floor_multi: "Golden floor multiplier",
    rainbow_floor_chance: "Rainbow floor chance",
    rainbow_floor_multi: "Rainbow floor multiplier",
    prismatic_floor_chance: "Prismatic floor chance",
    prismatic_floor_multi: "Prismatic floor multiplier",
    golden_ore_chance: "Golden ore chance",
    golden_ore_multi: "Golden ore multiplier",
    golden_vein_chance: "Golden vein chance",
    golden_vein_multi: "Golden vein multiplier",
    rainbow_vein_chance: "Rainbow vein chance",
    rainbow_vein_multi: "Rainbow vein multiplier",
    vein_income_multi: "Vein income multiplier",
    world_4_quest_progress: "World 4 quests completed",
    pickaxe_crit_chance: "Pickaxe crit chance",
    pickaxe_crit_damage: "Pickaxe crit damage",
    bomb_crit_chance: "Bomb crit chance",
    bomb_crit_damage: "Bomb crit damage",
    bomb_recharge_speed: "Bomb recharge speed",
    bomb_capacity: "Bomb capacity",
    fishing_enhance_array: "Fishing enhance levels",
    skill_tree_nodes_array: "Skill-tree nodes"
  };

  var KNOWN_GROUPS = {
    obelisk_level: "Account",
    current_floor: "Account",
    worlds_unlocked: "Account",
    black_hole_level: "Account",
    experience_multi: "Account",
    prestige_point_multi: "Account",
    xp_level_cap: "Account",
    world_4_quest_progress: "Account",
    all_floor_multipliers: "Economy",
    ore_sell_price_multi: "Economy",
    game_speed_multi: "Economy",
    ore_income_multi: "Economy",
    bar_output_multi: "Economy",
    bar_craft_cost_multi: "Economy",
    contract_upgrade_cost_reduction: "Contracts",
    contract_points_rewarded: "Contracts",
    all_star_multi: "Stars",
    star_spawn_rate: "Stars",
    fishing_income_multi: "Fishing",
    fishing_rod_power: "Fishing",
    fishing_drone_multiplier: "Fishing",
    fishing_tick_speed: "Fishing",
    pickaxe_damage: "Combat",
    bomb_damage: "Combat"
  };

  var PALETTE = [
    "var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)",
    "var(--chart-5)", "var(--chart-6)", "var(--chart-7)", "var(--chart-8)"
  ];

  function isNum(v) { return typeof v === "number" && isFinite(v); }

  function isSampleSource(source) {
    var text = String(source || "").toLowerCase();
    return text === "sample export" || /^v\d+(\.\d+)* sample export$/.test(text);
  }

  function parseSerial(value) {
    if (isNum(value)) return value;
    if (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value.trim())) {
      var n = parseFloat(value);
      return isFinite(n) ? n : null;
    }
    return null;
  }

  function parseExportTime(value) {
    if (value === null || value === undefined || value === "") return null;
    var serial = parseSerial(value);
    if (serial === null) {
      if (typeof value === "string") {
        var t = Date.parse(value);
        return isFinite(t) ? new Date(t) : null;
      }
      return null;
    }
    var ms = EXCEL_EPOCH_MS + serial * DAY_MS;
    if (!isFinite(ms) || ms < Date.UTC(1970, 0, 1) || ms > Date.UTC(2200, 0, 1)) return null;
    var digits = new Date(ms);
    if (isNaN(digits.getTime())) return null;
    // Excel serials are naive wall-clock values. Read the digits in the
    // browser's timezone so they can be compared with importedAt instants.
    var local = new Date(
      digits.getUTCFullYear(), digits.getUTCMonth(), digits.getUTCDate(),
      digits.getUTCHours(), digits.getUTCMinutes(), digits.getUTCSeconds(), digits.getUTCMilliseconds()
    );
    return isNaN(local.getTime()) ? null : local;
  }

  function exportTimeMs(value) {
    var d = parseExportTime(value);
    return d ? d.getTime() : null;
  }

  function pad(n) { return n < 10 ? "0" + n : String(n); }

  function formatTimeMs(ms, short) {
    if (!isNum(ms)) return "not recorded";
    var opts = short
      ? { year: "numeric", month: "short", day: "numeric" }
      : { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" };
    return new Date(ms).toLocaleString("en-US", opts);
  }

  function formatAxisDate(ms, showYear, showTime) {
    if (!isNum(ms)) return "";
    var opts = { month: "short", day: "numeric" };
    if (showYear) opts.year = "numeric";
    if (showTime) {
      opts.hour = "numeric";
      opts.minute = "2-digit";
    }
    return new Date(ms).toLocaleString("en-US", opts);
  }

  function formatExportDate(value) {
    var d = value instanceof Date ? value : parseExportTime(value);
    if (!d) {
      if (typeof value === "string") return value;
      if (isNum(value)) return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
      return "not provided";
    }
    return d.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function toDateInputValue(ms) {
    if (!isNum(ms)) return "";
    var d = new Date(ms);
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
      "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  function fromDateInputValue(value) {
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(value || ""));
    if (!m) return null;
    var ms = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime();
    return isFinite(ms) ? ms : null;
  }

  function stableStringify(value) {
    if (Array.isArray(value)) {
      return "[" + value.map(stableStringify).join(",") + "]";
    }
    if (value && typeof value === "object") {
      return "{" + Object.keys(value).sort().map(function (k) {
        return JSON.stringify(k) + ":" + stableStringify(value[k]);
      }).join(",") + "}";
    }
    return JSON.stringify(value);
  }

  function hashText(text) {
    var h = 2166136261;
    for (var i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul ? Math.imul(h, 16777619) : (h * 16777619);
    }
    return (h >>> 0).toString(16);
  }

  function hashStats(stats) {
    return hashText(stableStringify(stats || {}));
  }

  function parseRaw(raw) {
    if (!raw) return null;
    var obj = raw;
    if (typeof raw === "string") {
      try { obj = JSON.parse(raw); } catch (e) { return null; }
    }
    if (!obj || typeof obj !== "object") return null;
    if (obj.stats && typeof obj.stats === "object" && !Array.isArray(obj.stats)) {
      return { version: obj.version || "?", time: obj.time, stats: obj.stats };
    }
    if (!Array.isArray(obj)) {
      return { version: obj.version || "?", time: obj.time, stats: obj };
    }
    return null;
  }

  function makeSnapshot(parsed, meta) {
    if (!parsed || !parsed.stats || typeof parsed.stats !== "object" || Array.isArray(parsed.stats)) {
      return null;
    }
    meta = meta || {};
    var exportedAt = parseSerial(parsed.time);
    var exportDate = parseExportTime(parsed.time);
    var importedAt = meta.importedAt || new Date().toISOString();
    var timeMs = exportDate ? exportDate.getTime() : (isNum(meta.timeMs) ? meta.timeMs : Date.parse(importedAt));
    if (!isNum(timeMs)) timeMs = Date.now();
    var timeSource = exportDate ? "export" : (isNum(meta.timeMs) ? "manual" : "import");
    var id = exportedAt !== null
      ? "t:" + String(exportedAt)
      : "i:" + new Date(timeMs).toISOString();
    var raw = meta.raw;
    if (typeof raw !== "string") {
      raw = JSON.stringify({ time: parsed.time, version: parsed.version, stats: parsed.stats });
    }
    return {
      id: id,
      exportedAt: exportedAt,
      timeMs: timeMs,
      timeSource: timeSource,
      timeEdited: !!meta.timeEdited,
      importedAt: importedAt,
      version: parsed.version || "?",
      source: meta.source || "imported JSON",
      applied: isNum(meta.applied) ? meta.applied : 0,
      missing: isNum(meta.missing) ? meta.missing : 0,
      seeded: !!meta.seeded,
      raw: raw,
      stats: parsed.stats,
      fingerprint: hashStats(parsed.stats)
    };
  }

  function normalizeSnapshot(rec) {
    if (!rec || typeof rec !== "object") return null;
    var parsed = parseRaw(rec.raw || rec);
    var stats = rec.stats && typeof rec.stats === "object" && !Array.isArray(rec.stats)
      ? rec.stats
      : (parsed ? parsed.stats : null);
    if (!stats || typeof stats !== "object" || Array.isArray(stats)) return null;

    var parsedTime = parsed ? parsed.time : undefined;
    var exportedAt = parseSerial(rec.exportedAt);
    if (exportedAt === null) exportedAt = parseSerial(parsedTime);
    var rawTime = exportedAt !== null ? exportedAt : parsedTime;
    var version = rec.version || (parsed && parsed.version) || "?";
    var importedAt = rec.importedAt || new Date().toISOString();
    var timeMs = isNum(rec.timeMs) ? rec.timeMs : exportTimeMs(rawTime);
    if (!isNum(timeMs) && rec.importedAt) timeMs = Date.parse(rec.importedAt);
    if (!isNum(timeMs)) timeMs = Date.now();

    var snap = makeSnapshot(
      { version: version, time: rawTime, stats: stats },
      {
        raw: typeof rec.raw === "string" ? rec.raw : null,
        source: rec.source || "imported history",
        applied: rec.applied,
        missing: rec.missing,
        importedAt: importedAt,
        seeded: rec.seeded,
        timeMs: timeMs,
        timeEdited: rec.timeEdited
      }
    );
    if (!snap) return null;
    if (typeof rec.id === "string" && rec.id) snap.id = rec.id;
    if (isNum(rec.timeMs)) snap.timeMs = rec.timeMs;
    if (rec.timeSource === "export" || rec.timeSource === "import" || rec.timeSource === "manual") {
      snap.timeSource = rec.timeSource;
    }
    if (rec.timeEdited) snap.timeEdited = true;
    return snap;
  }

  function sortSnapshots(list) {
    return (list || []).slice().sort(function (a, b) {
      if (a.timeMs !== b.timeMs) return a.timeMs - b.timeMs;
      return String(a.importedAt || "").localeCompare(String(b.importedAt || ""));
    });
  }

  function keepEditedTime(prev, next) {
    if (prev && prev.timeEdited && !next.timeEdited) {
      next.timeMs = prev.timeMs;
      next.timeEdited = true;
      next.timeSource = "manual";
    }
    return next;
  }

  function mergeSnapshots(existing, incoming) {
    var map = {};
    var added = 0, skipped = 0, replaced = 0;

    (existing || []).forEach(function (item) {
      var snap = normalizeSnapshot(item);
      if (snap && !map[snap.id]) map[snap.id] = snap;
    });

    (incoming || []).forEach(function (item) {
      var snap = normalizeSnapshot(item);
      if (!snap) return;
      var prev = map[snap.id];
      if (!prev) {
        map[snap.id] = snap;
        added++;
      } else if (prev.fingerprint === snap.fingerprint) {
        skipped++;
      } else {
        var prevAt = Date.parse(prev.importedAt || "");
        var nextAt = Date.parse(snap.importedAt || "");
        if (!isFinite(prevAt) || !isFinite(nextAt) || nextAt >= prevAt) {
          map[snap.id] = keepEditedTime(prev, snap);
          replaced++;
        } else {
          skipped++;
        }
      }
    });

    var out = sortSnapshots(Object.keys(map).map(function (k) { return map[k]; }));
    return { snapshots: out, added: added, skipped: skipped, replaced: replaced };
  }

  function sumArray(arr) {
    if (!Array.isArray(arr)) return null;
    var total = 0;
    for (var i = 0; i < arr.length; i++) {
      if (isNum(arr[i])) total += arr[i];
    }
    return total;
  }

  function getMetricValue(stats, key) {
    if (!stats || !key) return null;
    if (key.indexOf("derived:") === 0) {
      var name = key.slice(8);
      if (name === "fishing_upgrades_total") return sumArray(stats.fishing_upgrades_array);
      if (name === "fishing_enhance_total") return sumArray(stats.fishing_enhance_array);
      if (name === "contracts_total") return sumArray(stats.contracts_array);
      if (name === "pet_levels_total") return sumArray(stats.pet_array);
      if (name === "skill_tree_total") return sumArray(stats.skill_tree_nodes_array);
      if (name === "idols_total") return sumArray(stats.idols_array);
      if (name === "cards_total") {
        var regular = sumArray(stats.fishing_regular_card_array);
        var legendary = sumArray(stats.fishing_legendary_card_levels_array);
        var tribute = sumArray(stats.fishing_legendary_tribute_levels_array);
        if (regular === null && legendary === null && tribute === null) return null;
        return (regular || 0) + (legendary || 0) + (tribute || 0);
      }
      return null;
    }
    return isNum(stats[key]) ? stats[key] : null;
  }

  function derivedByKey(key) {
    for (var i = 0; i < DERIVED.length; i++) {
      if (DERIVED[i].key === key) return DERIVED[i];
    }
    return null;
  }

  function labelFor(key) {
    if (LABELS[key]) return LABELS[key];
    var derived = derivedByKey(key);
    if (derived) return derived.label;
    var text = String(key || "").replace(/^derived:/, "").replace(/_/g, " ");
    text = text.replace(/\bmulti\b/gi, "multiplier")
      .replace(/\bxp\b/gi, "XP")
      .replace(/\bob\b/gi, "OB");
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function groupFor(key) {
    var derived = derivedByKey(key);
    if (derived) return derived.group;
    if (KNOWN_GROUPS[key]) return KNOWN_GROUPS[key];
    var k = String(key || "").toLowerCase();
    if (/^(obelisk|black_hole|world|experience|prestige|xp_|candy|steak|pizza|challenge)/.test(k)) return "Account";
    if (/^(pickaxe|bomb|drone|elixir|minotaur|bear_|chain_|angler_|prism_|void_fuel|starburst)/.test(k)) return "Combat";
    if (/^(fishing|is_drone_)/.test(k)) return "Fishing";
    if (/^contract/.test(k)) return "Contracts";
    if (/^pet/.test(k)) return "Pets";
    if (/^(star|stars|super_star|novagiant|all_star)/.test(k)) return "Stars";
    if (/^(lootbug|lootfrog|chest|item_|relic)/.test(k)) return "Loot & items";
    if (/^(vein|ore|bar|golden|rainbow|void|floor|portal|prism|coal|ores_|all_floor|game_speed|midas|veinseeker)/.test(k)) return "Economy";
    if (/^statue/.test(k)) return "Construction";
    if (/^skill/.test(k)) return "Skills";
    return "Other";
  }

  function buildMetricCatalog(snapshots) {
    var seen = {};
    var out = [];
    function add(key) {
      if (!key || seen[key]) return;
      seen[key] = true;
      out.push({ key: key, label: labelFor(key), group: groupFor(key) });
    }
    DERIVED.forEach(function (d) { add(d.key); });
    (snapshots || []).forEach(function (snap) {
      if (!snap || !snap.stats) return;
      Object.keys(snap.stats).forEach(function (key) {
        if (isNum(snap.stats[key])) add(key);
      });
    });
    out.sort(function (a, b) {
      if (a.group !== b.group) return a.group.localeCompare(b.group);
      return a.label.localeCompare(b.label);
    });
    return out;
  }

  function rangeDays(range) {
    if (range === "30d") return 30;
    if (range === "90d") return 90;
    if (range === "365d") return 365;
    return null;
  }

  function filterSnapshots(snapshots, range) {
    var sorted = sortSnapshots(snapshots);
    var days = rangeDays(range);
    if (!days || sorted.length === 0) return sorted;
    var last = sorted[sorted.length - 1].timeMs;
    var cutoff = last - days * DAY_MS;
    var out = sorted.filter(function (s) { return s.timeMs >= cutoff; });
    return out.length ? out : sorted.slice(-1);
  }

  function buildSeries(snapshots, keys, opts) {
    opts = opts || {};
    var colors = opts.colors || PALETTE;
    var normalize = !!opts.normalize;
    var series = [];

    (keys || []).forEach(function (key, index) {
      var points = [];
      (snapshots || []).forEach(function (snap) {
        var value = getMetricValue(snap.stats, key);
        if (isNum(value)) points.push({ x: snap.timeMs, y: value, raw: value, id: snap.id });
      });
      if (!points.length) return;

      var baseline = null;
      if (normalize) {
        var baseIndex = -1;
        for (var i = 0; i < points.length; i++) {
          if (points[i].y > 0) { baseIndex = i; break; }
        }
        if (baseIndex < 0) return;
        points = points.slice(baseIndex);
        baseline = points[0].y;
        points = points.map(function (p) {
          return { x: p.x, y: (p.y / baseline) * 100, raw: p.raw, id: p.id };
        });
      }

      series.push({
        key: key,
        label: labelFor(key),
        color: colors[index % colors.length],
        points: points,
        rawPoints: points.map(function (p) { return { x: p.x, y: p.raw, id: p.id }; }),
        baseline: baseline,
        latest: points[points.length - 1]
      });
    });

    return series;
  }

  function niceTicks(min, max, count) {
    if (!isNum(min) || !isNum(max)) return [];
    if (min > max) { var t = min; min = max; max = t; }
    if (min === max) {
      var pad = Math.abs(min) > 0 ? Math.abs(min) * 0.1 : 1;
      min -= pad;
      max += pad;
    }
    var target = count || 5;
    var span = max - min;
    var step = span / target;
    var mag = Math.pow(10, Math.floor(Math.log(step) / Math.LN10));
    var norm = step / mag;
    if (norm <= 1) step = 1 * mag;
    else if (norm <= 2) step = 2 * mag;
    else if (norm <= 5) step = 5 * mag;
    else step = 10 * mag;

    var ticks = [];
    var start = Math.ceil(min / step) * step;
    for (var v = start; v <= max + step * 1e-9 && ticks.length < 100; v += step) {
      ticks.push(Math.abs(v) < step * 1e-9 ? 0 : v);
    }
    if (!ticks.length) ticks = [min, max];
    return ticks;
  }

  function logTicks(min, max) {
    if (!(min > 0) || !(max > 0)) return [];
    if (min > max) { var t = min; min = max; max = t; }
    var out = [];
    var startExp = Math.floor(Math.log(min) / Math.LN10);
    var endExp = Math.ceil(Math.log(max) / Math.LN10);
    var mults = [1, 2, 5];
    for (var e = startExp; e <= endExp && out.length < 40; e++) {
      for (var m = 0; m < mults.length; m++) {
        var value = mults[m] * Math.pow(10, e);
        if (value >= min * 0.999999 && value <= max * 1.000001) out.push(value);
      }
    }
    if (out.length > 14) {
      out = out.filter(function (v) {
        var exp = Math.log(v) / Math.LN10;
        return Math.abs(exp - Math.round(exp)) < 1e-9;
      });
    }
    if (out.length < 2) out = [min, max];
    return out;
  }

  function chartModel(snapshots, keys, opts) {
    opts = opts || {};
    var unique = [];
    (keys || []).forEach(function (k) { if (k && unique.indexOf(k) < 0) unique.push(k); });
    var filtered = filterSnapshots(snapshots, opts.range);
    var normalize = unique.length > 1 || !!opts.normalize;
    var series = buildSeries(filtered, unique, { normalize: normalize });

    if (!series.length) {
      return {
        series: [], empty: true, filtered: filtered,
        normalize: normalize, scale: "linear", xTicks: [], yTicks: [], warning: ""
      };
    }

    var xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
    series.forEach(function (s) {
      s.points.forEach(function (p) {
        if (p.x < xMin) xMin = p.x;
        if (p.x > xMax) xMax = p.x;
        if (p.y < yMin) yMin = p.y;
        if (p.y > yMax) yMax = p.y;
      });
    });

    var singleX = xMin === xMax;
    var singleXValue = xMin;
    if (singleX) {
      xMin -= 12 * 3600000;
      xMax += 12 * 3600000;
    }

    var requested = opts.scale || "auto";
    var logPossible = yMin > 0;
    var autoLog = logPossible && yMax / yMin >= 100;
    var scale = "linear";
    var warning = "";

    if (requested === "log") {
      if (!logPossible) warning = "Log scale needs positive values; showing linear.";
      else scale = "log";
    } else if (requested === "auto" && autoLog) {
      scale = "log";
    }

    if (scale === "log") {
      if (yMin === yMax) {
        yMin = yMin / 10;
        yMax = yMax * 10;
      }
    } else if (yMin === yMax) {
      var pad = Math.abs(yMin) > 0 ? Math.abs(yMin) * 0.1 : 1;
      yMin -= pad;
      yMax += pad;
    }

    var span = xMax - xMin;
    var showYear = span > 300 * DAY_MS;
    var showTime = span < 2 * DAY_MS;
    var xTicks = [];
    if (singleX) {
      xTicks.push({ value: singleXValue, label: formatAxisDate(singleXValue, true, true) });
    } else {
      var tickCount = 5;
      for (var i = 0; i <= tickCount; i++) {
        var t = xMin + (span * i) / tickCount;
        xTicks.push({ value: t, label: formatAxisDate(t, showYear, showTime) });
      }
    }

    var yTicks = scale === "log" ? logTicks(yMin, yMax) : niceTicks(yMin, yMax, 5);
    var latest = filtered[filtered.length - 1] || null;

    return {
      series: series,
      filtered: filtered,
      latest: latest,
      empty: false,
      normalize: normalize,
      scale: scale,
      warning: warning,
      xMin: xMin,
      xMax: xMax,
      yMin: yMin,
      yMax: yMax,
      xTicks: xTicks,
      yTicks: yTicks
    };
  }

  var SUFFIX = ["", "k", "m", "b", "t", "qi", "sx", "sp", "oc", "no", "dc", "ud", "dd", "td"];

  function formatValue(n) {
    if (n === null || n === undefined || !isFinite(n)) return "-";
    if (n === 0) return "0";
    var neg = n < 0;
    var v = Math.abs(n);
    if (v >= 1e45) return (neg ? "-" : "") + v.toExponential(3);
    if (v < 0.001) return (neg ? "-" : "") + v.toExponential(2);
    if (v < 1) return (neg ? "-" : "") + v.toPrecision(3);
    var tier = 0;
    while (v >= 1000 && tier < SUFFIX.length - 1) {
      v /= 1000;
      tier++;
    }
    if (v >= 999.5 && tier < SUFFIX.length - 1) {
      v /= 1000;
      tier++;
    }
    var text;
    if (tier === 0) {
      if (Math.abs(v - Math.round(v)) < 1e-9) {
        text = Math.round(v).toString();
      } else {
        text = v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : Math.round(v).toString();
      }
    } else {
      text = v.toFixed(v < 10 ? 2 : v < 100 ? 1 : 0) + SUFFIX[tier];
    }
    return (neg ? "-" : "") + text;
  }

  function formatIndex(n) {
    if (!isNum(n)) return "-";
    if (Math.abs(n) >= 1000) return Math.round(n).toLocaleString("en-US") + "%";
    return (Math.round(n * 10) / 10).toFixed(1) + "%";
  }

  function formatSize(bytes) {
    if (!isNum(bytes) || bytes < 0) return "0 KB";
    if (bytes < 1024) return Math.round(bytes) + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(bytes < 10240 ? 1 : 0) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function snapshotSize(snap) {
    if (!snap) return 0;
    try { return JSON.stringify(snap).length; } catch (e) { return 0; }
  }

  function totalSize(snapshots) {
    var total = 0;
    (snapshots || []).forEach(function (s) { total += snapshotSize(s); });
    return total;
  }

  function activeExportMs(record) {
    if (!record) return null;
    if (isSampleSource(record.source)) return null;
    var fromField = exportTimeMs(record.exportedAt);
    if (fromField !== null) return fromField;
    if (record.raw) {
      var parsed = parseRaw(record.raw);
      if (parsed) return exportTimeMs(parsed.time);
    }
    return null;
  }

  function isOlderThanActive(exportMs, activeRecord) {
    if (!isNum(exportMs)) return false;
    var active = activeExportMs(activeRecord);
    if (active === null) return false;
    return exportMs < active - 1000;
  }

  function activeSnapshotId(snapshots, accountRecord) {
    var active = activeExportMs(accountRecord);
    if (active === null) return null;
    var parsed = parseRaw(accountRecord.raw);
    var fp = parsed ? hashStats(parsed.stats) : null;
    for (var i = 0; i < (snapshots || []).length; i++) {
      var snap = snapshots[i];
      var snapMs = exportTimeMs(snap.exportedAt);
      if (snapMs === null) snapMs = snap.timeMs;
      if (Math.abs(snapMs - active) <= 1000 && (!fp || snap.fingerprint === fp)) return snap.id;
    }
    return null;
  }

  function leanSnapshot(snap) {
    return {
      id: snap.id,
      exportedAt: snap.exportedAt,
      timeMs: snap.timeMs,
      timeSource: snap.timeSource,
      timeEdited: !!snap.timeEdited,
      importedAt: snap.importedAt,
      version: snap.version,
      source: snap.source,
      applied: snap.applied,
      missing: snap.missing,
      seeded: !!snap.seeded,
      raw: typeof snap.raw === "string" ? snap.raw : JSON.stringify({
        time: snap.exportedAt,
        version: snap.version,
        stats: snap.stats
      })
    };
  }

  function bundle(snapshots) {
    return {
      format: "obelisk-tracker-history",
      version: 1,
      exportedAt: new Date().toISOString(),
      snapshots: sortSnapshots(snapshots).map(leanSnapshot)
    };
  }

  function parseBundle(value) {
    var obj = value;
    if (typeof value === "string") {
      try { obj = JSON.parse(value); } catch (e) {
        return { snapshots: [], invalid: 0, error: e.message };
      }
    }
    var list = [];
    if (Array.isArray(obj)) {
      list = obj;
    } else if (obj && Array.isArray(obj.snapshots)) {
      list = obj.snapshots;
    } else if (obj && obj.stats && typeof obj.stats === "object") {
      list = [obj];
    } else if (obj && obj.raw) {
      list = [obj];
    } else {
      return { snapshots: [], invalid: 0, error: "No snapshots found." };
    }

    var out = [];
    var invalid = 0;
    list.forEach(function (item) {
      var snap = normalizeSnapshot(item);
      if (snap) out.push(snap); else invalid++;
    });
    return { snapshots: sortSnapshots(out), invalid: invalid };
  }

  function getStorage(env) {
    if (env && env.localStorage) return env.localStorage;
    try {
      if (global && global.localStorage) return global.localStorage;
    } catch (e) { /* storage blocked */ }
    return null;
  }

  function createStore(env) {
    env = env || {};
    var storage = getStorage(env);
    var idbFactory = env.indexedDB;
    if (idbFactory === undefined) {
      try { idbFactory = global.indexedDB || null; } catch (e) { idbFactory = null; }
    }

    var db = null;
    var mode = "loading";
    var warning = "";
    var cache = [];
    var memory = [];
    var openPromise = null;

    function fallbackWarning() {
      return "IndexedDB is unavailable, so the tracker is using this browser's local storage. " +
        "The fallback keeps the newest " + FALLBACK_LIMIT + " snapshots.";
    }

    function memoryWarning() {
      return "Browser storage is unavailable. Snapshots last for this session only.";
    }

    function keepCorruptFallback(raw) {
      warning = "The local snapshot history could not be read. The old value was kept as " +
        FALLBACK_KEY + "-corrupt.";
      try { storage.setItem(FALLBACK_KEY + "-corrupt", raw); } catch (e) { /* ignored */ }
      return [];
    }

    function readLocal() {
      if (!storage) return null;
      var raw = null;
      try { raw = storage.getItem(FALLBACK_KEY); } catch (e) { return null; }
      if (!raw) return [];
      var parsed;
      try { parsed = JSON.parse(raw); } catch (e) { return keepCorruptFallback(raw); }
      if (!Array.isArray(parsed)) return keepCorruptFallback(raw);
      var out = [];
      parsed.forEach(function (item) {
        var snap = normalizeSnapshot(item);
        if (snap) out.push(snap);
      });
      return sortSnapshots(out);
    }

    function writeLocal(list) {
      if (!storage) return null;
      var sorted = sortSnapshots(list);
      if (sorted.length > FALLBACK_LIMIT) {
        sorted = sorted.slice(sorted.length - FALLBACK_LIMIT);
        warning = "Local storage fallback keeps the newest " + FALLBACK_LIMIT +
          " snapshots; older snapshots were dropped.";
      }
      try {
        storage.setItem(FALLBACK_KEY, JSON.stringify(sorted));
      } catch (e) {
        warning = "Could not write the snapshot history to local storage: " + e.message;
        return null;
      }
      return sorted;
    }

    function loadLocal() {
      var local = readLocal();
      if (local !== null) {
        mode = "local";
        warning = warning || fallbackWarning();
        cache = local;
        return { snapshots: cache.slice(), mode: mode, warning: warning };
      }
      mode = "memory";
      warning = memoryWarning();
      cache = sortSnapshots(memory);
      return { snapshots: cache.slice(), mode: mode, warning: warning };
    }

    function openDb() {
      if (openPromise) return openPromise;
      openPromise = new Promise(function (resolve) {
        if (!idbFactory || typeof idbFactory.open !== "function") {
          resolve(null);
          return;
        }
        var req;
        try {
          req = idbFactory.open(DB_NAME, DB_VERSION);
        } catch (e) {
          resolve(null);
          return;
        }
        var settled = false;
        function done(value) {
          if (!settled) { settled = true; resolve(value); }
        }
        req.onupgradeneeded = function () {
          var database = req.result;
          if (!database.objectStoreNames.contains(STORE_NAME)) {
            var objectStore = database.createObjectStore(STORE_NAME, { keyPath: "id" });
            objectStore.createIndex("timeMs", "timeMs", { unique: false });
          }
        };
        req.onsuccess = function () { done(req.result); };
        req.onerror = function () { done(null); };
        req.onblocked = function () { done(null); };
      });
      return openPromise;
    }

    function idbAll() {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_NAME, "readonly");
        var req = tx.objectStore(STORE_NAME).getAll();
        req.onsuccess = function () {
          var out = [];
          (req.result || []).forEach(function (item) {
            var snap = normalizeSnapshot(item);
            if (snap) out.push(snap);
          });
          resolve(sortSnapshots(out));
        };
        req.onerror = function () { reject(req.error || new Error("IndexedDB read failed")); };
      });
    }

    function idbPut(snap) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(snap);
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { reject(tx.error || new Error("IndexedDB write failed")); };
        tx.onabort = function () { reject(tx.error || new Error("IndexedDB write aborted")); };
      });
    }

    function idbDelete(id) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { reject(tx.error || new Error("IndexedDB delete failed")); };
      });
    }

    function idbClear() {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).clear();
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { reject(tx.error || new Error("IndexedDB clear failed")); };
      });
    }

    function idbWriteAll(list) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_NAME, "readwrite");
        var store = tx.objectStore(STORE_NAME);
        store.clear();
        list.forEach(function (snap) { store.put(snap); });
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { reject(tx.error || new Error("IndexedDB write failed")); };
      });
    }

    // Move snapshots written by the local-storage fallback into IndexedDB once
    // the database becomes available again.
    function migrateFallback(list) {
      if (!storage) return Promise.resolve(list);
      var local = readLocal();
      if (!local || !local.length) return Promise.resolve(list);
      var result = mergeSnapshots(list, local);
      return idbWriteAll(result.snapshots).then(function () {
        try { storage.removeItem(FALLBACK_KEY); } catch (e) { /* ignored */ }
        return result.snapshots;
      }).catch(function () {
        return list;
      });
    }

    function readIdb() {
      return idbAll().then(function (list) {
        return migrateFallback(list).then(function (merged) {
          mode = "indexeddb";
          warning = "";
          cache = merged;
          return { snapshots: cache.slice(), mode: mode, warning: warning };
        });
      });
    }

    function load() {
      if (db) {
        return readIdb().catch(function () {
          db = null;
          openPromise = null;
          return loadLocal();
        });
      }
      return openDb().then(function (opened) {
        if (!opened) return loadLocal();
        db = opened;
        return readIdb().catch(function () {
          db = null;
          openPromise = null;
          return loadLocal();
        });
      });
    }

    function loadSync() {
      if (idbFactory && typeof idbFactory.open === "function") return null;
      return loadLocal();
    }

    function canSync() {
      return mode === "local" || mode === "memory";
    }

    function addLocal(snap) {
      var current = readLocal();
      if (current === null) {
        current = memory.slice();
      }
      var idx = -1;
      for (var i = 0; i < current.length; i++) {
        if (current[i].id === snap.id) { idx = i; break; }
      }
      if (idx >= 0 && current[idx].fingerprint === snap.fingerprint) {
        cache = sortSnapshots(current);
        return { added: false, skipped: true, total: cache.length };
      }
      var replaced = idx >= 0;
      if (replaced) current[idx] = keepEditedTime(current[idx], snap);
      else current.push(snap);

      if (storage) {
        var written = writeLocal(current);
        if (written === null) return { error: warning || "Could not save the snapshot." };
        cache = written;
      } else {
        memory = sortSnapshots(current);
        if (memory.length > FALLBACK_LIMIT) {
          memory = memory.slice(memory.length - FALLBACK_LIMIT);
        }
        cache = memory.slice();
      }
      return { added: !replaced, replaced: replaced, total: cache.length };
    }

    function add(snap) {
      var normalized = normalizeSnapshot(snap);
      if (!normalized) return Promise.resolve({ error: "The snapshot was not valid." });
      if (!db && !canSync()) {
        return load().then(function () { return add(normalized); });
      }
      if (canSync()) return Promise.resolve(addLocal(normalized));

      return idbAll().then(function (list) {
        var idx = -1;
        for (var i = 0; i < list.length; i++) {
          if (list[i].id === normalized.id) { idx = i; break; }
        }
        if (idx >= 0 && list[idx].fingerprint === normalized.fingerprint) {
          cache = sortSnapshots(list);
          return { added: false, skipped: true, total: cache.length };
        }
        var replaced = idx >= 0;
        var toStore = normalized;
        if (replaced) {
          toStore = keepEditedTime(list[idx], normalized);
          list[idx] = toStore;
        } else {
          list.push(toStore);
        }
        return idbPut(toStore).then(function () {
          return idbAll().then(function (fresh) {
            cache = fresh;
            return { added: !replaced, replaced: replaced, total: cache.length };
          });
        });
      }).catch(function (error) {
        return { error: error && error.message ? error.message : "Could not save the snapshot." };
      });
    }

    function addSync(snap) {
      if (!canSync()) return null;
      var normalized = normalizeSnapshot(snap);
      if (!normalized) return { error: "The snapshot was not valid." };
      return addLocal(normalized);
    }

    function update(id, patch) {
      function apply(list) {
        var idx = -1;
        for (var i = 0; i < list.length; i++) {
          if (list[i].id === id) { idx = i; break; }
        }
        if (idx < 0) return null;
        list[idx] = normalizeSnapshot(Object.assign({}, list[idx], patch));
        return list;
      }

      if (canSync()) {
        var current = readLocal();
        if (current === null) current = memory.slice();
        var updated = apply(current);
        if (!updated) return Promise.resolve({ error: "Snapshot not found." });
        if (storage) {
          var written = writeLocal(updated);
          if (written === null) return Promise.resolve({ error: warning || "Could not update the snapshot." });
          cache = written;
        } else {
          memory = sortSnapshots(updated);
          cache = memory.slice();
        }
        return Promise.resolve({ updated: true, total: cache.length });
      }

      return idbAll().then(function (list) {
        var updatedList = apply(list);
        if (!updatedList) return { error: "Snapshot not found." };
        var changed = updatedList[idxOf(updatedList, id)];
        return idbPut(changed).then(function () {
          return idbAll().then(function (fresh) {
            cache = fresh;
            return { updated: true, total: cache.length };
          });
        });
      }).catch(function (error) {
        return { error: error && error.message ? error.message : "Could not update the snapshot." };
      });
    }

    function idxOf(list, id) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === id) return i;
      }
      return -1;
    }

    function remove(id) {
      if (canSync()) {
        var current = readLocal();
        if (current === null) current = memory.slice();
        var next = current.filter(function (s) { return s.id !== id; });
        if (storage) {
          var written = writeLocal(next);
          if (written === null) return Promise.resolve({ error: warning || "Could not delete the snapshot." });
          cache = written;
        } else {
          memory = sortSnapshots(next);
          cache = memory.slice();
        }
        return Promise.resolve({ deleted: true, total: cache.length });
      }
      return idbDelete(id).then(function () {
        return idbAll().then(function (fresh) {
          cache = fresh;
          return { deleted: true, total: cache.length };
        });
      }).catch(function (error) {
        return { error: error && error.message ? error.message : "Could not delete the snapshot." };
      });
    }

    function clear() {
      if (canSync()) {
        if (storage) {
          try { storage.removeItem(FALLBACK_KEY); } catch (e) { /* ignored */ }
        }
        memory = [];
        cache = [];
        return Promise.resolve({ cleared: true, total: 0 });
      }
      return idbClear().then(function () {
        if (storage) {
          try { storage.removeItem(FALLBACK_KEY); } catch (e) { /* ignored */ }
        }
        cache = [];
        return { cleared: true, total: 0 };
      }).catch(function (error) {
        return { error: error && error.message ? error.message : "Could not clear the history." };
      });
    }

    function merge(incoming) {
      var normalized = [];
      (incoming || []).forEach(function (item) {
        var snap = normalizeSnapshot(item);
        if (snap) normalized.push(snap);
      });

      function applyMerge(current) {
        return mergeSnapshots(current, normalized);
      }

      if (canSync()) {
        var current = readLocal();
        if (current === null) current = memory.slice();
        var result = applyMerge(current);
        if (storage) {
          var written = writeLocal(result.snapshots);
          if (written === null) return Promise.resolve({ error: warning || "Could not import the history." });
          cache = written;
        } else {
          memory = result.snapshots;
          cache = memory.slice();
        }
        return Promise.resolve({
          added: result.added, skipped: result.skipped, replaced: result.replaced,
          total: cache.length
        });
      }

      return idbAll().then(function (current) {
        var result = applyMerge(current);
        return idbWriteAll(result.snapshots).then(function () {
          cache = result.snapshots;
          return {
            added: result.added, skipped: result.skipped, replaced: result.replaced,
            total: cache.length
          };
        });
      }).catch(function (error) {
        return { error: error && error.message ? error.message : "Could not import the history." };
      });
    }

    return {
      load: load,
      loadSync: loadSync,
      add: add,
      addSync: addSync,
      update: update,
      remove: remove,
      clear: clear,
      merge: merge,
      canSync: canSync,
      getCached: function () { return cache.slice(); },
      getMode: function () { return mode; },
      getWarning: function () { return warning; }
    };
  }

  global.TrackerData = {
    DB_NAME: DB_NAME,
    DB_VERSION: DB_VERSION,
    STORE_NAME: STORE_NAME,
    FALLBACK_KEY: FALLBACK_KEY,
    FALLBACK_LIMIT: FALLBACK_LIMIT,
    PREFS_KEY: PREFS_KEY,
    SEEDED_KEY: SEEDED_KEY,
    HEADLINE: HEADLINE,
    DERIVED: DERIVED,
    PALETTE: PALETTE,
    isSampleSource: isSampleSource,
    parseExportTime: parseExportTime,
    exportTimeMs: exportTimeMs,
    formatExportDate: formatExportDate,
    formatTimeMs: formatTimeMs,
    formatAxisDate: formatAxisDate,
    toDateInputValue: toDateInputValue,
    fromDateInputValue: fromDateInputValue,
    parseRaw: parseRaw,
    makeSnapshot: makeSnapshot,
    normalizeSnapshot: normalizeSnapshot,
    sortSnapshots: sortSnapshots,
    mergeSnapshots: mergeSnapshots,
    getMetricValue: getMetricValue,
    labelFor: labelFor,
    groupFor: groupFor,
    buildMetricCatalog: buildMetricCatalog,
    filterSnapshots: filterSnapshots,
    buildSeries: buildSeries,
    chartModel: chartModel,
    niceTicks: niceTicks,
    logTicks: logTicks,
    formatValue: formatValue,
    formatIndex: formatIndex,
    formatSize: formatSize,
    snapshotSize: snapshotSize,
    totalSize: totalSize,
    activeExportMs: activeExportMs,
    isOlderThanActive: isOlderThanActive,
    activeSnapshotId: activeSnapshotId,
    bundle: bundle,
    parseBundle: parseBundle,
    createStore: createStore
  };

})(typeof window !== "undefined" ? window : globalThis);
