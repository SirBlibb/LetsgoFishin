/*
 * Shared account storage for the Obelisk Miner tools.
 *
 * A record is { raw, source, version, exportedAt, importedAt, applied, missing }
 * where `raw` is the original ExportStats JSON text. Storing the raw export means
 * future tools can re-map it without asking the player to paste it again.
 *
 * Exposed as window.AccountStore.
 */
(function (global) {
  "use strict";

  var KEY = "obelisk-account-v1";

  function getStorage() {
    try {
      if (global && global.localStorage) return global.localStorage;
    } catch (e) { /* storage blocked */ }
    return null;
  }

  function isRecord(v) {
    return !!v && typeof v === "object" && typeof v.raw === "string";
  }

  function load() {
    var store = getStorage();
    if (!store) return null;
    try {
      var rec = JSON.parse(store.getItem(KEY) || "null");
      return isRecord(rec) ? rec : null;
    } catch (e) {
      return null;
    }
  }

  function save(record) {
    if (!isRecord(record)) return false;
    var store = getStorage();
    if (!store) return false;
    try {
      store.setItem(KEY, JSON.stringify(record));
      notify();
      return true;
    } catch (e) {
      return false;
    }
  }

  function clear() {
    var store = getStorage();
    if (!store) return;
    try {
      store.removeItem(KEY);
    } catch (e) { /* ignored */ }
    notify();
  }

  function notify() {
    if (typeof global.dispatchEvent !== "function" || typeof global.CustomEvent !== "function") return;
    try {
      global.dispatchEvent(new global.CustomEvent("obelisk-account-change"));
    } catch (e) { /* ignored */ }
  }

  global.AccountStore = {
    KEY: KEY,
    load: load,
    save: save,
    clear: clear,
    getStorage: getStorage
  };

})(typeof window !== "undefined" ? window : globalThis);
