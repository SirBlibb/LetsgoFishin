/*
 * Fish-purchased upgrade data for "Fishing - Upgrades" (Obefish rows 3-20).
 *
 * Cost tables transcribed from the Idle Obelisk Miner wiki ("Fishing" page,
 * v2.2.30, Upgrades section) and fish power ratings from the same page's
 * Aquarium section. The wiki shows costs above ~99,999 abbreviated
 * ("111k", "1.56m"), so those entries are stored rounded.
 *
 * costs[level] is the price of the NEXT level when currently at `level`
 * (costs[0] = price of level 1). Each entry is [count, fishSpecies].
 * `gateRow`/`gateLevel`: the boat upgrade row that must reach `gateLevel`
 * before this upgrade can be bought (5 = Upgrade Boat, 15 = Tier 2 Boat).
 *
 * Exposed as window.FISH_DATA.
 */
(function (global) {
  "use strict";

  var POWER = {
    "Guppy": 100,
    "Bass": 170,
    "Catfish": 290,
    "Golden Trout": 490,
    "Sandscale Carp": 240,
    "Armored Roller": 410,
    "Spiny Puffer": 690,
    "Scarabshoe Crab": 1170,
    "Snow-bellied Swarmer": 570,
    "Frostshell Crab": 970,
    "Frostdrip Spearfish": 1650,
    "Auroreel": 2800,
    "Coralstar": 1360,
    "Anchorfin Stingray": 2310,
    "Pearlescent Tetra": 3930,
    "Gem Whale": 6680,
    "Ionizing Eel": 3240,
    "Gammangler Fish": 5510,
    "Elephant's Blob": 9370,
    "Wastefish": 15930,
    "Hadal Crusher": 7740,
    "Live Sea Mine": 13150,
    "Ventilator Remora": 22360,
    "Wreckshell Pilferer": 38020,
    "Stonescale Carp": 27700,
    "Sturgem": 47090,
    "Conductive Eel": 80060,
    "Arapaim-al": 136080,
    "Molten Archerfish": 66090,
    "Lava Snail": 112360,
    "Obsidian-Tooth Barracuda": 191030,
    "Basalturtle": 324740,
    "Sunglazed Flying Fish": 157720,
    "Cloudcutter Manta": 268140,
    "Shocksailfish": 455830,
    "Lunar Sunfish": 774930,
    "Lanternfish Comet": 376390,
    "UFO": 639870,
    "Sub-Solar Squid": 1090000,
    "Planetary Jellyfish": 1850000,
    "Heliocentric Clam": 898180,
    "Gamma Rayburst Shrimp": 1530000,
    "Galaxia Whale": 2600000,
    "Dark Matter Blackdragon": 4410000
  };

  var UPGRADES = [
    {
      row: 3, name: "Fishing Rod", max: 60, costs: [
        [10, "Guppy"], [12, "Guppy"], [15, "Bass"], [18, "Bass"], [22, "Catfish"], [28, "Catfish"],
        [34, "Golden Trout"], [42, "Golden Trout"], [52, "Sandscale Carp"], [64, "Sandscale Carp"],
        [79, "Armored Roller"], [97, "Armored Roller"], [119, "Spiny Puffer"], [147, "Spiny Puffer"],
        [181, "Scarabshoe Crab"], [223, "Scarabshoe Crab"], [274, "Snow-bellied Swarmer"], [337, "Snow-bellied Swarmer"],
        [415, "Frostshell Crab"], [510, "Frostshell Crab"], [628, "Frostdrip Spearfish"], [772, "Frostdrip Spearfish"],
        [950, "Auroreel"], [1169, "Auroreel"], [1437, "Coralstar"], [1768, "Coralstar"],
        [2175, "Anchorfin Stingray"], [2675, "Anchorfin Stingray"], [3291, "Pearlescent Tetra"], [4048, "Pearlescent Tetra"],
        [4979, "Gem Whale"], [6124, "Gem Whale"], [7532, "Ionizing Eel"], [9265, "Ionizing Eel"],
        [11396, "Gammangler Fish"], [14017, "Gammangler Fish"], [17241, "Elephant's Blob"], [21207, "Elephant's Blob"],
        [26085, "Wastefish"], [32084, "Wastefish"], [39464, "Hadal Crusher"], [48541, "Gem Whale"],
        [59705, "Ionizing Eel"], [73437, "Gammangler Fish"], [90328, "Pearlescent Tetra"], [111000, "Frostdrip Spearfish"],
        [136000, "Sandscale Carp"], [168000, "Gem Whale"], [206000, "Elephant's Blob"], [254000, "Wastefish"],
        [1560000, "Sturgem"], [1920000, "Conductive Eel"], [2360000, "Lava Snail"], [2910000, "Obsidian-Tooth Barracuda"],
        [3570000, "Cloudcutter Manta"], [4400000, "Shocksailfish"], [5410000, "UFO"], [6660000, "Sub-Solar Squid"],
        [8190000, "Gamma Rayburst Shrimp"], [10000000, "Galaxia Whale"]
      ]
    },
    {
      row: 4, name: "Fishing Drone", max: 50, costs: [
        [12, "Bass"], [14, "Guppy"], [17, "Bass"], [21, "Guppy"], [26, "Catfish"], [32, "Guppy"],
        [39, "Catfish"], [48, "Golden Trout"], [58, "Sandscale Carp"], [71, "Armored Roller"],
        [87, "Bass"], [106, "Sandscale Carp"], [130, "Golden Trout"], [159, "Spiny Puffer"],
        [194, "Golden Trout"], [236, "Armored Roller"], [289, "Scarabshoe Crab"], [352, "Sandscale Carp"],
        [430, "Armored Roller"], [524, "Spiny Puffer"], [640, "Scarabshoe Crab"], [781, "Snow-bellied Swarmer"],
        [953, "Snow-bellied Swarmer"], [1162, "Snow-bellied Swarmer"], [1418, "Guppy"], [1730, "Frostshell Crab"],
        [2111, "Frostshell Crab"], [2575, "Frostshell Crab"], [3142, "Frostdrip Spearfish"], [3833, "Frostdrip Spearfish"],
        [4677, "Coralstar"], [5706, "Coralstar"], [6961, "Coralstar"], [8492, "Anchorfin Stingray"],
        [10361, "Anchorfin Stingray"], [12640, "Anchorfin Stingray"], [15421, "Golden Trout"], [18814, "Golden Trout"],
        [22953, "Golden Trout"], [28003, "Spiny Puffer"], [34164, "Spiny Puffer"], [41680, "Spiny Puffer"],
        [50850, "Ionizing Eel"], [62037, "Golden Trout"], [75685, "Ionizing Eel"], [92336, "Scarabshoe Crab"],
        [112000, "Ionizing Eel"], [137000, "Gammangler Fish"], [167000, "Gammangler Fish"], [204000, "Gammangler Fish"]
      ]
    },
    {
      row: 5, name: "Upgrade Boat", max: 5, costs: [
        [15, "Golden Trout"], [45, "Scarabshoe Crab"], [135, "Auroreel"], [405, "Gem Whale"], [1215, "Wastefish"]
      ]
    },
    {
      row: 6, name: "Tick Speed", max: 40, gateRow: 5, gateLevel: 1, costs: [
        [40, "Bass"], [49, "Catfish"], [61, "Golden Trout"], [76, "Sandscale Carp"], [94, "Armored Roller"],
        [117, "Sandscale Carp"], [145, "Golden Trout"], [180, "Catfish"], [223, "Bass"], [277, "Armored Roller"],
        [343, "Spiny Puffer"], [426, "Scarabshoe Crab"], [528, "Snow-bellied Swarmer"], [655, "Frostshell Crab"],
        [812, "Frostdrip Spearfish"], [1007, "Frostshell Crab"], [1249, "Snow-bellied Swarmer"], [1549, "Scarabshoe Crab"],
        [1921, "Frostshell Crab"], [2382, "Auroreel"], [2954, "Coralstar"], [3663, "Anchorfin Stingray"],
        [4542, "Pearlescent Tetra"], [5633, "Gem Whale"], [6985, "Pearlescent Tetra"], [8661, "Anchorfin Stingray"],
        [10740, "Coralstar"], [13318, "Auroreel"], [16514, "Frostdrip Spearfish"], [20478, "Frostshell Crab"],
        [25392, "Snow-bellied Swarmer"], [31487, "Scarabshoe Crab"], [39043, "Spiny Puffer"], [48414, "Armored Roller"],
        [60034, "Sandscale Carp"], [74442, "Golden Trout"], [92308, "Catfish"], [114000, "Bass"],
        [141000, "Guppy"], [175000, "Bass"]
      ]
    },
    {
      row: 7, name: "Fish Multiplier", max: 30, gateRow: 5, gateLevel: 1, costs: [
        [55, "Guppy"], [68, "Bass"], [85, "Catfish"], [107, "Golden Trout"], [134, "Sandscale Carp"],
        [167, "Armored Roller"], [209, "Spiny Puffer"], [262, "Scarabshoe Crab"], [327, "Guppy"], [409, "Bass"],
        [512, "Catfish"], [640, "Golden Trout"], [800, "Sandscale Carp"], [1000, "Armored Roller"],
        [1250, "Spiny Puffer"], [1563, "Scarabshoe Crab"], [1953, "Guppy"], [2442, "Bass"],
        [3053, "Catfish"], [3816, "Golden Trout"], [4770, "Sandscale Carp"], [5963, "Armored Roller"],
        [7453, "Spiny Puffer"], [9317, "Scarabshoe Crab"], [11646, "Guppy"], [14558, "Bass"],
        [18197, "Catfish"], [22747, "Golden Trout"], [28434, "Sandscale Carp"], [35542, "Armored Roller"]
      ]
    },
    {
      row: 8, name: "Rod Multiplier", max: 20, gateRow: 5, gateLevel: 2, costs: [
        [75, "Sandscale Carp"], [97, "Sandscale Carp"], [126, "Armored Roller"], [164, "Armored Roller"],
        [214, "Golden Trout"], [278, "Golden Trout"], [362, "Sandscale Carp"], [470, "Sandscale Carp"],
        [611, "Armored Roller"], [795, "Armored Roller"], [1033, "Spiny Puffer"], [1344, "Spiny Puffer"],
        [1747, "Snow-bellied Swarmer"], [2271, "Snow-bellied Swarmer"], [2953, "Snow-bellied Swarmer"],
        [3838, "Snow-bellied Swarmer"], [4990, "Frostshell Crab"], [6487, "Frostshell Crab"],
        [8434, "Frostshell Crab"], [10964, "Frostshell Crab"]
      ]
    },
    {
      row: 9, name: "Drone Multiplier", max: 20, gateRow: 5, gateLevel: 2, costs: [
        [95, "Armored Roller"], [123, "Armored Roller"], [160, "Spiny Puffer"], [208, "Spiny Puffer"],
        [271, "Snow-bellied Swarmer"], [352, "Snow-bellied Swarmer"], [458, "Frostshell Crab"], [596, "Frostshell Crab"],
        [774, "Golden Trout"], [1007, "Golden Trout"], [1309, "Scarabshoe Crab"], [1702, "Scarabshoe Crab"],
        [2213, "Frostdrip Spearfish"], [2877, "Frostdrip Spearfish"], [3740, "Snow-bellied Swarmer"],
        [4862, "Snow-bellied Swarmer"], [6321, "Spiny Puffer"], [8217, "Guppy"], [10683, "Golden Trout"], [13888, "Golden Trout"]
      ]
    },
    {
      row: 10, name: "Double Tick", max: 30, gateRow: 5, gateLevel: 3, costs: [
        [125, "Snow-bellied Swarmer"], [152, "Snow-bellied Swarmer"], [186, "Snow-bellied Swarmer"],
        [226, "Frostshell Crab"], [276, "Frostshell Crab"], [337, "Frostshell Crab"],
        [412, "Snow-bellied Swarmer"], [502, "Snow-bellied Swarmer"], [613, "Snow-bellied Swarmer"],
        [748, "Frostshell Crab"], [913, "Frostshell Crab"], [1113, "Frostshell Crab"],
        [1359, "Frostdrip Spearfish"], [1658, "Frostdrip Spearfish"], [2022, "Frostdrip Spearfish"],
        [2467, "Spiny Puffer"], [3010, "Spiny Puffer"], [3673, "Spiny Puffer"],
        [4481, "Coralstar"], [5466, "Coralstar"], [6669, "Coralstar"],
        [8137, "Anchorfin Stingray"], [9927, "Anchorfin Stingray"], [12111, "Anchorfin Stingray"],
        [14775, "Coralstar"], [18026, "Coralstar"], [21992, "Coralstar"],
        [26830, "Anchorfin Stingray"], [32732, "Guppy"], [39934, "Guppy"]
      ]
    },
    {
      row: 11, name: "Fishing Drone x2", max: 30, gateRow: 5, gateLevel: 3, costs: [
        [145, "Guppy"], [176, "Bass"], [215, "Catfish"], [263, "Golden Trout"], [321, "Sandscale Carp"],
        [391, "Armored Roller"], [478, "Spiny Puffer"], [583, "Scarabshoe Crab"], [711, "Snow-bellied Swarmer"],
        [868, "Frostshell Crab"], [1059, "Frostdrip Spearfish"], [1292, "Auroreel"], [1576, "Guppy"], [1923, "Bass"],
        [2346, "Catfish"], [2862, "Golden Trout"], [3492, "Sandscale Carp"], [4260, "Armored Roller"],
        [5198, "Spiny Puffer"], [6341, "Scarabshoe Crab"], [7736, "Snow-bellied Swarmer"], [9438, "Frostshell Crab"],
        [11515, "Frostdrip Spearfish"], [14048, "Auroreel"], [17139, "Guppy"], [20910, "Bass"],
        [25510, "Catfish"], [31123, "Golden Trout"], [37970, "Sandscale Carp"], [46323, "Armored Roller"]
      ]
    },
    {
      row: 12, name: "Shiny Fish Chance", max: 25, gateRow: 5, gateLevel: 4, costs: [
        [175, "Catfish"], [215, "Spiny Puffer"], [264, "Frostdrip Spearfish"], [325, "Catfish"], [400, "Spiny Puffer"],
        [492, "Frostdrip Spearfish"], [605, "Coralstar"], [745, "Anchorfin Stingray"], [916, "Frostdrip Spearfish"],
        [1127, "Catfish"], [1387, "Spiny Puffer"], [1706, "Frostdrip Spearfish"], [2098, "Spiny Puffer"],
        [2581, "Frostdrip Spearfish"], [3174, "Pearlescent Tetra"], [3904, "Coralstar"], [4803, "Guppy"],
        [5907, "Guppy"], [7266, "Coralstar"], [8937, "Frostdrip Spearfish"], [10993, "Pearlescent Tetra"],
        [13522, "Coralstar"], [16632, "Frostdrip Spearfish"], [20457, "Pearlescent Tetra"], [25162, "Coralstar"]
      ]
    },
    {
      row: 13, name: "Drone Base Power", max: 30, gateRow: 5, gateLevel: 4, costs: [
        [205, "Guppy"], [246, "Sandscale Carp"], [295, "Snow-bellied Swarmer"], [354, "Coralstar"], [425, "Guppy"],
        [510, "Sandscale Carp"], [612, "Snow-bellied Swarmer"], [734, "Coralstar"], [881, "Guppy"],
        [1057, "Sandscale Carp"], [1269, "Snow-bellied Swarmer"], [1523, "Coralstar"], [1827, "Guppy"],
        [2193, "Sandscale Carp"], [2632, "Snow-bellied Swarmer"], [3158, "Coralstar"], [3790, "Snow-bellied Swarmer"],
        [4548, "Snow-bellied Swarmer"], [5457, "Frostshell Crab"], [6549, "Frostshell Crab"],
        [7859, "Frostdrip Spearfish"], [9431, "Frostdrip Spearfish"], [11317, "Auroreel"], [13580, "Auroreel"],
        [16296, "Coralstar"], [19556, "Guppy"], [23467, "Bass"], [28160, "Catfish"], [33793, "Golden Trout"],
        [40551, "Pearlescent Tetra"]
      ]
    },
    {
      row: 14, name: "Triple Tick", max: 25, gateRow: 5, gateLevel: 4, costs: [
        [245, "Golden Trout"], [301, "Golden Trout"], [370, "Golden Trout"], [455, "Scarabshoe Crab"],
        [560, "Scarabshoe Crab"], [689, "Scarabshoe Crab"], [848, "Auroreel"], [1043, "Auroreel"], [1283, "Auroreel"],
        [1578, "Coralstar"], [1941, "Coralstar"], [2388, "Coralstar"], [2937, "Anchorfin Stingray"],
        [3613, "Anchorfin Stingray"], [4444, "Anchorfin Stingray"], [5466, "Pearlescent Tetra"],
        [6724, "Pearlescent Tetra"], [8270, "Pearlescent Tetra"], [10173, "Ionizing Eel"], [12513, "Ionizing Eel"],
        [15391, "Gammangler Fish"], [18930, "Gammangler Fish"], [23285, "Elephant's Blob"], [28640, "Elephant's Blob"],
        [35228, "Elephant's Blob"]
      ]
    },
    {
      row: 15, name: "Upgrade Tier 2 Boat", max: 5, costs: [
        [2000000, "Wreckshell Pilferer"], [3000000, "Arapaim-al"], [4500000, "Basalturtle"],
        [6750000, "Lunar Sunfish"], [10100000, "Planetary Jellyfish"]
      ]
    },
    {
      row: 16, name: "Shiny Multiplier", max: 20, gateRow: 15, gateLevel: 1, costs: [
        [215000, "Stonescale Carp"], [258000, "Sturgem"], [309000, "Conductive Eel"], [371000, "Arapaim-al"],
        [445000, "Stonescale Carp"], [534000, "Sturgem"], [641000, "Conductive Eel"], [770000, "Arapaim-al"],
        [924000, "Molten Archerfish"], [1100000, "Lava Snail"], [1330000, "Obsidian-Tooth Barracuda"],
        [1590000, "Basalturtle"], [1910000, "Molten Archerfish"], [2300000, "Lava Snail"],
        [2760000, "Obsidian-Tooth Barracuda"], [3310000, "Basalturtle"], [3970000, "Cloudcutter Manta"],
        [4770000, "Shocksailfish"], [5720000, "Lunar Sunfish"], [6860000, "Basalturtle"]
      ]
    },
    {
      row: 17, name: "Tier 2 Dock Power", max: 20, gateRow: 15, gateLevel: 2, costs: [
        [325000, "Molten Archerfish"], [390000, "Lava Snail"], [468000, "Obsidian-Tooth Barracuda"],
        [561000, "Basalturtle"], [673000, "Stonescale Carp"], [808000, "Sturgem"], [970000, "Conductive Eel"],
        [1160000, "Arapaim-al"], [1390000, "Molten Archerfish"], [1670000, "Lava Snail"],
        [2010000, "Obsidian-Tooth Barracuda"], [2410000, "Basalturtle"], [2890000, "Sunglazed Flying Fish"],
        [3470000, "Cloudcutter Manta"], [4170000, "Shocksailfish"], [5000000, "Lunar Sunfish"],
        [6000000, "Lanternfish Comet"], [7210000, "UFO"], [8650000, "Sub-Solar Squid"], [10300000, "Planetary Jellyfish"]
      ]
    },
    {
      row: 18, name: "Super Shiny Chance", max: 20, gateRow: 15, gateLevel: 3, costs: [
        [475000, "Sunglazed Flying Fish"], [570000, "Cloudcutter Manta"], [684000, "Shocksailfish"],
        [820000, "Lunar Sunfish"], [984000, "Sunglazed Flying Fish"], [1180000, "Cloudcutter Manta"],
        [1410000, "Shocksailfish"], [1700000, "Lunar Sunfish"], [2040000, "Lanternfish Comet"], [2450000, "UFO"],
        [2940000, "Sub-Solar Squid"], [3520000, "Planetary Jellyfish"], [4230000, "Heliocentric Clam"],
        [5080000, "Gamma Rayburst Shrimp"], [6090000, "Galaxia Whale"], [7310000, "Dark Matter Blackdragon"],
        [8780000, "Lunar Sunfish"], [10500000, "Lanternfish Comet"], [12600000, "UFO"], [15100000, "Sub-Solar Squid"]
      ]
    },
    {
      row: 19, name: "Poly Card Multi", max: 25, gateRow: 15, gateLevel: 4, costs: [
        [625000, "Lanternfish Comet"], [750000, "Lanternfish Comet"], [900000, "UFO"], [1080000, "UFO"],
        [1290000, "Sub-Solar Squid"], [1550000, "Sub-Solar Squid"], [1860000, "Planetary Jellyfish"],
        [2230000, "Planetary Jellyfish"], [2680000, "Molten Archerfish"], [3220000, "Molten Archerfish"],
        [3860000, "Lava Snail"], [4640000, "Lava Snail"], [5570000, "Obsidian-Tooth Barracuda"],
        [6680000, "Obsidian-Tooth Barracuda"], [8020000, "Basalturtle"], [9620000, "Basalturtle"],
        [11500000, "Planetary Jellyfish"], [13800000, "Planetary Jellyfish"], [16600000, "Heliocentric Clam"],
        [19900000, "Heliocentric Clam"], [23900000, "Gamma Rayburst Shrimp"], [28700000, "Gamma Rayburst Shrimp"],
        [34500000, "Galaxia Whale"], [41400000, "Galaxia Whale"], [49600000, "Dark Matter Blackdragon"]
      ]
    },
    {
      row: 20, name: "Drone Cloner", max: 30, gateRow: 15, gateLevel: 5, costs: [
        [850000, "Lanternfish Comet"], [1020000, "UFO"], [1220000, "Sub-Solar Squid"], [1460000, "Planetary Jellyfish"],
        [1760000, "Sunglazed Flying Fish"], [2110000, "Cloudcutter Manta"], [2530000, "Shocksailfish"],
        [3040000, "Lunar Sunfish"], [3650000, "Heliocentric Clam"], [4380000, "Gamma Rayburst Shrimp"],
        [5260000, "Galaxia Whale"], [6310000, "Dark Matter Blackdragon"], [7570000, "Heliocentric Clam"],
        [9090000, "Gamma Rayburst Shrimp"], [10900000, "Galaxia Whale"], [13000000, "Dark Matter Blackdragon"],
        [15700000, "Heliocentric Clam"], [18800000, "Gamma Rayburst Shrimp"], [22600000, "Galaxia Whale"],
        [27100000, "Lunar Sunfish"], [32500000, "Molten Archerfish"], [39100000, "Shocksailfish"],
        [46900000, "Sturgem"], [56300000, "Lava Snail"], [67500000, "Lunar Sunfish"],
        [81000000, "Dark Matter Blackdragon"], [97300000, "Heliocentric Clam"], [116000000, "UFO"],
        [140000000, "Shocksailfish"], [168000000, "Lanternfish Comet"]
      ]
    }
  ];

  global.FISH_DATA = { power: POWER, upgrades: UPGRADES };

})(typeof window !== "undefined" ? window : globalThis);
