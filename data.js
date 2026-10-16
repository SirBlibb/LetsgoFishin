/*
 * UI metadata: labels + constraints for the manual Obefish inputs.
 * Exposed as window.UI_SPEC.
 */
(function (global) {
  "use strict";

  // Manual scalar inputs keyed to Obefish column C.
  var SCALARS = [
    { key: 3, group: "Drone", label: "Fishing Drone Base Power (bar level)", type: "int", min: 0, max: 50 },
    { key: 12, group: "Drone", label: "Fishing Drone Power (bar level)", type: "int", min: 0, max: 52 },
    { key: 23, group: "Drone", label: "Cetus level", type: "int", min: 0, max: 32 },
    { key: 24, group: "Drone", label: "Super Star level", type: "int", min: 0, max: 15 },

    { key: 5, group: "Tick Speed", label: "3x Fishing Tick Speed owned", type: "bool" },
    { key: 7, group: "Tick Speed", label: "Fishing Tick 5x Chance +2% (bar level)", type: "int", min: 0, max: 21 },
    { key: 37, group: "Tick Speed", label: "Halfway Package level", type: "int", min: 0, max: 5 },

    { key: 9, group: "Bundles", label: "Fish Bundle owned", type: "bool" },
    { key: 10, group: "Bundles", label: "Polychrome Potency Bundle owned", type: "bool" },
    { key: 14, group: "Bundles", label: "Shiny Fish Multiplier +10% owned", type: "bool" },
    { key: 36, group: "Bundles", label: "Legendary Hauler Bundle level", type: "int", min: 0, max: 20 },

    { key: 16, group: "Pets", label: "Mr Nibbles level", type: "int", min: 0, max: 25 },
    { key: 17, group: "Pets", label: "Dr Cool skin owned", type: "bool" },
    { key: 18, group: "Pets", label: "Mr Nibbles' Quest level (blank = none)", type: "num", min: 0, max: 11, blank: true },

    { key: 27, group: "Arch Idols", label: "Astraeus level", type: "int", min: 0, max: 1100 },
    { key: 28, group: "Arch Idols", label: "Poseidon level", type: "int", min: 0, max: 20 },
    { key: 29, group: "Arch Idols", label: "Tethys level", type: "int", min: 0, max: 860 },
    { key: 30, group: "Arch Idols", label: "Ares level", type: "int", min: 0, max: 5000 },

    { key: 20, group: "Statues", label: "Gilded Statue of Craftmanship", type: "bool" },
    { key: 21, group: "Statues", label: "Platinum Statue of Craftmanship", type: "bool" },

    { key: 25, group: "Misc", label: "Black Hole level >= 10", type: "bool" },
    { key: 32, group: "Misc", label: "Abyss Tribute 1 completed", type: "bool", hint: "Reduces dock ticks by 10%" },
    { key: 39, group: "Misc", label: "Pace bonus % (blank = 0)", type: "num", min: 0, blank: true },
    { key: 40, group: "Misc", label: "Multiplier bonus % (blank = 0)", type: "num", min: 0, blank: true },
    { key: 41, group: "Misc", label: "Rod card bonus % (blank = 0)", type: "num", min: 0, blank: true },
    { key: 43, group: "Misc", label: "Gems per hour (info only)", type: "num", min: 0, blank: true }
  ];

  // Fishing - Upgrades inputs (Obefish rows 3-20). Max = level the example
  // export uses (the sample player is maxed), which matches the sheet caps.
  var UPGRADE_INPUTS = [
    { row: 3, label: "Fishing Rod", max: 60 },
    { row: 4, label: "Fishing Drone", max: 50 },
    { row: 5, label: "Upgrade Boat", max: 5 },
    { row: 6, label: "Tick Speed", max: 40 },
    { row: 7, label: "Fish Multiplier", max: 30 },
    { row: 8, label: "Rod Multiplier", max: 20 },
    { row: 9, label: "Drone Multiplier", max: 20 },
    { row: 10, label: "Double Tick", max: 30 },
    { row: 11, label: "Fishing Drone x2", max: 30 },
    { row: 12, label: "Shiny Fish Chance", max: 25 },
    { row: 13, label: "Drone Base Power", max: 30 },
    { row: 14, label: "Triple Tick", max: 25 },
    { row: 15, label: "Upgrade Tier 2 Boat", max: 5 },
    { row: 16, label: "Shiny Multiplier", max: 20 },
    { row: 17, label: "Tier 2 Dock Power", max: 20 },
    { row: 18, label: "Super Shiny Chance", max: 20 },
    { row: 19, label: "Poly Card Multi", max: 25 },
    { row: 20, label: "Drone Cloner", max: 30 }
  ];

  var T1_CARD_NAMES = ["None", "Base", "Gilded", "Polychrome", "Infernal"];
  var LEGENDARY_NAMES = ["None", "Base", "Gilded", "Polychrome", "Infernal"];
  var TRIBUTE_NAMES = ["Not caught", "Legendary caught", "Tribute 1", "Tribute 2"];

  global.UI_SPEC = {
    SCALARS: SCALARS,
    UPGRADE_INPUTS: UPGRADE_INPUTS,
    T1_CARD_NAMES: T1_CARD_NAMES,
    LEGENDARY_NAMES: LEGENDARY_NAMES,
    TRIBUTE_NAMES: TRIBUTE_NAMES
  };

})(typeof window !== "undefined" ? window : globalThis);
