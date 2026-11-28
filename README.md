# Obelisk Miner Tools

A static website with a shared **account importer** plus tools for *Idle Obelisk Miner*:

- **Let's Go Fishing** ranks every fishing gem upgrade by how much fish/time it adds **per gem you spend**.
- **Legendary Fish** estimates the average time to catch a dock's legendary fish from dock power, catch chance, tick speed, double / triple tick chance, and the Angler drone.
- **Bomb Comparison** works out whether the **Bomb of Plenty** or **Transmuter Bomb** produces more bars at a chosen bar level, or across a dungeon floor's Void Drone portal mix.
- **Goal ETA** estimates how long an ore or bar target will take from a measured ore/hour rate, with progress, milestones, and the rate a deadline needs.
- **Best Floor to Farm** ranks all 132 dungeon floors for any ore or vein, with Void Drone and bomb advice, warnings and a what-if stats editor.
- **Contract Point Planner** ranks all 34 contract upgrades for a chosen mix of ore, veins, stars, bars, and damage, then turns spare CP (or a full respec) into an ordered spend plan.
- **Max Damage** shows the biggest pickaxe and bomb hit you can reach with damage consumables toggled on and the damage contracts maxed, with a crit-tier breakdown and current-vs-max comparison.
- **Tracker** records every imported ExportStats JSON as a dated snapshot and charts any stat's growth over time, with one-metric or normalized multi-stat graphs.

The fishing optimizer is a faithful JavaScript port of the community Google Sheet **"Let's Go
Fishing - V2.0.6"** (`Obefish` tab). You can type your stats in by hand, or import the game's
**ExportStats JSON** once on the home page and let every tool use it. It also ranks the
**fish-purchased upgrades** (Fishing Rod, Drone, boats, ticks, ...) by fish/time gained per
power-weighted fish spent (section 6).

The bomb comparison follows the community Transmuter calculator's expected-value formulas and uses
the wiki's bar costs through **Neopolium** (World 4). Its floor mode also uses the wiki's 132
dungeon floors, their native 80/20 or 50/50 ore pairs, and the expected effect of Void Drone
portals. Goal ETA reuses the same bar costs and crafting formulas to turn a bar target into ore,
then times it with your measured ore per hour.

No build step, no server: open `index.html` in a browser.

## Quick start

1. Open `index.html` in any modern browser (works from `file://`). The home page opens at `#/home`.
2. Paste your ExportStats JSON on the home page and press **Apply JSON**. You can also drag a `.json`
   file onto the page. Every successful import is recorded as a dated snapshot in the **Tracker**.
3. Open a tool from the cards (or the header): **Let's Go Fishing** (`#/fishing`),
   **Legendary Fish** (`#/legendary`), **Bomb comparison** (`#/bombs`), **Goal ETA** (`#/goal`,
   home card only), **Contract planner** (`#/contracts`), **Max damage** (`#/damage`),
   **Best floor** (`#/floors`, `#/floors/veins`), or **Tracker** (`#/tracker`). A refresh or
   bookmark reopens the tool directly.
4. Anything the game did not record (a few bar levels, bundles, statues, etc.) stays at 0 and is
   shown as a manual field - fill those in inside the tool.
5. In the fishing tool, read the **Ranking** table: it is sorted best-first. `Score/gem` is the
   ranking metric.
6. To plan a goal, enter your current amount, the target, and your measured ore per hour. Current
   ore, current bars, and ore/hour are never in ExportStats, so the goal tool always asks for them.
7. In the contract planner, choose **Current levels + spare CP** or **Full respec**, enter spare CP
   and contracts completed, then set the five goal weights (or use a preset). The spend plan and
   next-level ranking update immediately.

## Home page and shared account

The home page (`#/home`) is the account hub:

- Paste, load, or drag in an ExportStats file once. The raw JSON is saved in this browser under the
  `obelisk-account-v1` local-storage key, separately from each tool's settings.
- The account summary shows the game version, export timestamp, source, import time, and how many
  fields were mapped.
- Each analysis tool card shows whether it will use the saved account or fall back to manual entry.
  The Tracker card instead shows how many snapshots are recorded.
- **Reset** clears the saved account, the fishing tool's settings, the bomb tool's current values
  and floor/portal inputs, the goal tool's targets and measured rate, the legendary fish tool's
  dock and power/tick values, the contract planner's budget, weights, and manual levels, the Max
  Damage tool's scenario and hand edits, and the Best Floor tool's saved mode and what-if stats.
  It does **not** clear the Tracker's snapshot history; use **Clear history** on the Tracker page
  for that.
- Tools read the account through `window.AccountStore` (`account.js`), so future tools can be added
  without changing the import flow.

Tool settings are saved automatically: the fishing tool under `lgf-optimizer-state-v1`, the
legendary fish tool under `obelisk-legendary-v1`, the goal tool under `obelisk-goal-v1`, the
contract planner under `obelisk-contracts-v1`, the bomb tool under `obelisk-bombs-v1`, the Max
Damage tool under `obelisk-damage-v1`, the Best Floor tool under `obelisk-floors-v1`, and the
Tracker's pinned/selected stats under `obelisk-tracker-prefs-v1`. The snapshot history itself
lives in IndexedDB, not local storage.

The bomb tool keeps its mode, level, floor, ore and portal inputs, and keeps stats only when you
edited them by hand; untouched stats are re-read from the account each time.

## How to get ExportStats

In-game, use the **Export Stats** option, copy the text, and paste it into the importer. The
format is:

```json
{ "time": "...", "version": "v2.2.20", "stats": { "fishing_enhance_array": [ ... ], ... } }
```

## What gets auto-filled

| ExportStats key | Maps to |
| --- | --- |
| `fishing_enhance_array[0..14]` | Enhancement levels (rows 22-36) |
| `fishing_upgrades_array[0..17]` | Fishing - Upgrades levels (rows 3-20) |
| `skill_tree_nodes_array[42,44,43,45,51,52]` | Skill-tree levels (rows 38-43) |
| `fishing_regular_card_array[4*d..4*d+3]` | The 4 Tier-1 fish cards on dock `d` |
| `fishing_legendary_card_levels_array[d]` | Legendary card level on dock `d` |
| `fishing_legendary_tribute_levels_array[d]` | Tribute level on dock `d` |
| `pet_array[12]` / `pet_skin_set_a_array[12]` / `pet_quest_array[12]` | Mr Nibbles level / Dr Cool skin / Mr Nibbles' Quest |
| `idols_array[19,9,23,26]` | Astraeus / Poseidon / Tethys / Ares levels |
| `black_hole_level` | "Black Hole >= 10" flag |
| `fishing_legendary_tribute_levels_array[5]` | "Abyss Tribute 1 completed" flag |

Dock order (index `d`): **Lake, Desert, Tundra, Ocean, Nuclear, Abyss, Cave, Volcano, Sky,
Solaris, Galaxy**.

### Manual fields (not in ExportStats)

Fishing Drone Base Power, Fishing Drone Power, Cetus, Super Star, 3x Tick Speed, Fishing Tick 5x
Chance, Halfway Package, Fish / Polychrome / Shiny / Legendary-Hauler bundles, Gilded & Platinum
Statues of Craftmanship, the three bonus-percent fields and "gems/hour". Set these by hand.

## Important assumptions

- **Legendary card vs. Tribute mapping.** The sheet has two manual per-dock columns (`AE`, `AF`).
  `AE` drives several bonuses (`AE > 0`, `AE > 1`); `AF` is not used by the ranking at all. This
  site maps `AE` = **legendary card level** and `AF` = **tribute level**. If your data disagrees,
  just edit those selects in the *Fish cards* table - `AF` has no effect on the ranking.
- **Abyss Tribute flag.** `C32` ("Abyss Tribute 1") is taken as true when the Abyss tribute array
  value is `>= 2` (i.e. Tribute 1 completed). It reduces dock ticks by 10%.
- Values/limits come from the sheet's own tables; if the game changes caps, edit `data.js`.

## Ranking metric

- Normal mode: `(new fish/time - current fish/time) / gem cost` (higher is better).
- Exponential mode: `(1 + growth)^(100000 / gem cost)` (higher is better) - useful when you care
  about compounding over a fixed gem budget.
- Upgrades blocked by their in-sheet gate (e.g. requires Tier-2 boat, or a maxed prerequisite)
  are shown greyed-out with the reason and are excluded from the ranking.

## Planning a purchase ("what if I buy this?")

Each rankable row has a **+1** button. Pressing it:

1. commits one level of that upgrade (as if you had bought it),
2. re-ranks everything, and
3. shows how much each row moved: `▲n` moved up, `▼n` moved down, `=` unchanged, plus a
   "fish/s vs. before" delta under the table title.

Press **+1** repeatedly to plan a multi-purchase shopping list; **Undo last purchase** steps back
one level at a time. The level inputs in section 2 stay in sync, and any manual edit clears the
comparison so the arrows never go stale.

## Fish upgrade ranking (section 6)

The *Fishing - Upgrades* rows (3-20) are bought with **fish**, not gems, so they get their own table:

- Score = `(new fish/time - current fish/time) / weighted cost`, where
  `weighted cost = fish count x the fish's power rating` (the wiki's catch-difficulty stat), so
  prices paid in different species are comparable.
- Cost tables (count + species per level) and power ratings come from the wiki's *Fishing* page
  (v2.2.30, Upgrades + Aquarium sections) and live in `fishcosts.js`. The wiki shows prices above
  ~99,999 rounded (`111k`, `1.56m`), so high-level scores are approximate.
- Rows locked behind a boat level are greyed out with the requirement; the two boat rows are shown
  as unlock purchases (they add no fish/time directly), and maxed rows show "Maxed".
- Some upgrades only do something in the right context (Shiny Multiplier needs a super-shiny
  chance > 0; Tier 2 Dock Power needs a Tier-2 dock selected). Those rows read
  "No direct fish/time change" until your state makes them matter.

## Legendary Fish (`#/legendary`)

Estimates how long a legendary fish takes on average. Pick the dock, and the tool turns your
fishing power and tick stats into dock fills per hour and a legendary chance per fill.

- **Dock and eligibility** sets the target, the ticks required for one fill, and whether all four
  polychrome cards are confirmed. With an account loaded, the tick requirement comes from
  `fishing_enhance_array[10]` (Tier 2 Dock Ticks), the Motley School skill, and the Abyss tribute.
- **Dock power** uses the export's rod power, drone capacity, drone base power, drone multiplier,
  and Tier 2 dock multiplier. Every fishing drone is assumed assigned to the selected dock; lower
  the count if you split them.
- **Tick speed** uses the tick reduction, double / triple / 5x tick chances, and an optional 3x
  tick buff. The expected ticks per tick event uses the fishing optimizer's `tickPoly` formula.
- **Angler drone** adds passive ticks while equipped and a legendary chance bonus while fuelled.
  The export's Angler flags, grade, and suit upgrade level pre-fill it.
- **Results** show the average, median, 90% / 95% / 99% times, the chance by seven time horizons,
  and a fastest-first table for every dock.

### Formulas

- **Dock power:** `(rod power + drones × drone base power × drone multiplier) × Tier 2 dock power`.
  The Tier 2 multiplier only applies to Cave, Volcano, Sky, Solaris, and Galaxy.
- **Catch chance:** `100 × dock power ÷ last-fish power rating`, capped at 999%.
- **Legendary steps:** `min(9, floor(catch chance ÷ 100))`. The dock also needs all four
  polychrome cards. Each step is a 1/150,000 base chance per dock fill.
- **Angler bonus:** while equipped and fuelled, `angler factor = 1 + 0.02 × (grade + 1)`, so the
  legendary chance becomes `steps × angler factor ÷ 150,000`. At the highest grade the
  denominator is about 81,000.
- **Ticks per event:** double, triple, and 5x procs are independent and stack, including 2×3=6,
  2×5=10, 3×5=15, and all three for 30 ticks.
- **Angler ticks:** the suit gives 2 ticks per cycle. While fuelled it also has a 1% chance per
  cycle of `6 × (grade + 1)` extra ticks, so its expected rate is
  `(2 + 1% × 6 × (grade + 1)) ÷ cycle seconds`, where the cycle is
  `1140 − 40 × suit level` seconds (real time).
- **Tick rate:** `tick time = (60 − tick reduction) ÷ (3 if the 3x buff is on)`, and
  `ticks/second = ticks per event ÷ tick time + Angler passive ticks/second`.
- **Dock fills:** `fills/second = ticks/second ÷ ticks required per fill`.
- **Average time:** `1 ÷ (fills/second × legendary chance per fill)`. Median and percentile times
  use the geometric distribution, `t = ln(1 − q) ÷ (fills/second × ln(1 − chance per fill))`.

### Assumptions and caveats

- The fisher and every fishing drone are assumed to be on the selected dock, which gives the
  fastest possible rate for that dock. The all-docks table repeats this assumption for each dock,
  so it compares one dock at a time rather than all docks being fished at once.
- Catch chance is capped at 999%, and the legendary steps stop at 9 (900%). A 1,999% catch chance
  is still 9/150,000.
- Game speed does not affect fishing. Offline ticks are treated exactly like online ticks, and tick
  overflow carries into the next dock fill.
- The Angler bonus only applies while fuelled. Its passive and extra ticks are modelled in real
  time from the suit's cycle; some sources report drone ticks scale with game speed, which is not
  included. The legendary bonus is modelled as the wiki's multiplicative denominator reduction
  (`150,000 ÷ 1.86 ≈ 81,000` at max); some community calculators treat it as a flat reduction
  instead. The 3x tick buff is temporary, so it is off by default for a long-run average.
- The result is a long-run average and a set of odds, not a guarantee. Individual catches follow a
  geometric distribution, so a fish can arrive much earlier or later than the average. Legendary
  fish odds may have hidden account-seeded behaviour or may change between game versions; check
  important decisions in-game.

The dock ratings, legendary names, and base tick requirements come from the wiki's
[*Fishing*](https://shminer.miraheze.org/wiki/Fishing) and
[*Drones*](https://shminer.miraheze.org/wiki/Drones) pages.

## Bomb of Plenty vs Transmuter (`#/bombs`)

This tool compares the expected bars from each bomb in two modes:

- **Bar level** compares one ore tier: Tin is level 1 and Neopolium is level 86 (World 4). A bar
  level is the ore tier you are crafting, not a dungeon floor.
- **Void Drone floor** compares a whole dungeon floor's natural ore mix after Void Drone portals.
  Pick any floor from 1 to 132; the tool shows the floor's native pair, expected portal yield, and
  the resulting mix, then compares the bombs on that mix.

The **Base ore per bomb** input (default 1,000) scales the totals. In floor mode it is labelled
**Native ore (before portals)** and means floor ore before portal effects. It does not affect the
breakpoint or the winner.

### Bar level mode

The selected level shows:

- expected bars from Bomb of Plenty (BoP ore, then crafting),
- expected bars from Transmuter (direct bars plus crafting the leftover ore),
- which one wins and by what margin,
- the breakpoint and the last/first known bar levels on each side,
- a strip with one square per bar level, coloured by the winner. Clicking a square selects that
  level. Floor mode shows the same strip with one square per floor.

The **All bar levels** table repeats the comparison for every known bar, split into World 1-4
sections. The selected level is highlighted. The **Breakpoint** is an *effective* ore cost per bar:
below it BoP wins, above it Transmuter wins. Effective cost follows the community calculator's
`floor(base cost x bar_craft_cost_multi)` method, with a minimum of 1 ore per bar, so a level right
at the breakpoint can move because of rounding.

### Void Drone floor mode

Dungeon floors are grouped into ore pairs. The first floor of a pair is **80% lower ore / 20% next
ore**; the second floor of the pair is **50/50**. Stone has four pairs (floors 1-8), Magma has five
(floors 9-18), and every other zone has three pairs. The 21 zones cover all 132 floors across
Worlds 1-4.

Void Drone portals are modelled per native ore. An ore of level `i` with native weight `w`:

- keeps `(1 - p) x w` at level `i`, and
- sends `p x w` through a portal, multiplied by the portal multiplier `m` and spread uniformly over
  levels `1..i`.

The **Void portal chance** (0-100%) and **Void portal multiplier** inputs are pre-filled from
`void_portal_chance` and `void_portal_multi` when an account is loaded. The floor is pre-filled from
`current_floor`. All three can be changed.

Floor mode shows:

- the selected floor's native ore pair, zone, and expected portal yield,
- aggregate bars from each bomb for the mixed floor,
- whether the floor mix is below or above the breakpoint,
- a **Native ore on floor** table with the ordinary bar-level winner for each ore on that floor, and
- an **All floors** table for all 132 floors, grouped by zone, with the selected floor highlighted.

The floor verdict is an aggregate *bar-count* proxy: a mixed floor produces several bar types, so
use the native-ore rows when you care about one specific bar.

### Auto-filled stats

The bomb tool maps these ExportStats keys. Missing keys fall back to the calculator defaults, and
the stats panel warns how many were missing.

| ExportStats key | Used as |
| --- | --- |
| `free_craft_chance` | Free craft chance |
| `double_craft_chance` | Double craft chance |
| `triple_craft_chance` | Triple craft chance |
| `craft_5x_chance` | 5x craft chance |
| `craft_10x_chance` | 10x craft chance |
| `craft_20x_chance` | 20x craft chance |
| `craft_100x_chance` | 100x craft chance |
| `bar_craft_cost_multi` | Effective bar craft cost multiplier |
| `bar_output_multi` | Bar output multiplier (crafting + Transmuter) |
| `bomb_of_plenty_multi` | Bomb of Plenty ore multiplier |
| `bomb_transmuter_multi` | Transmuter direct-bar multiplier |
| `bomb_trans_apply_bop_chance` | Chance Transmuter also applies BoP |
| `bomb_of_plenty_make_gold_chance` | Chance BoP turns ore golden |
| `golden_ore_chance` | Natural golden ore chance |
| `golden_ore_multi` | Golden ore multiplier |
| `current_floor` | Starting dungeon floor in floor mode |
| `void_portal_chance` | Void portal chance (%) |
| `void_portal_multi` | Void portal multiplier |

`current_floor`, `void_portal_chance`, and `void_portal_multi` only pre-fill the floor controls; they
are not part of the 15 editable stat fields. The floor controls always remain editable.

### Formulas

The expected-value model follows the community calculator. Bar level mode uses:

- `toMult(p, n) = 1 + clamp(p / 100, 0, 1) * (n - 1)`
- `craftMult = 1 / (1 - clamp(free / 100, 0, 0.99)) * toMult(x2, 2) * toMult(x3, 3) * ... * toMult(x100, 100)`
- `A` = expected ore per base ore with a BoP stack; `T` = expected ore per base ore with the
  Transmuter's BoP chance.
- `effectiveCost = max(1, floor(baseBarCost * barCraftCostMulti))`
- `barOutput = max(1, bar_output_multi)`
- `BoP bars = barOutput * craftMult * A / effectiveCost`
- `Transmuter bars = barOutput * (transmuterMult * T + craftMult * T / effectiveCost)`
- `breakpoint = craftMult * (A - T) / (transmuterMult * T)`

Floor mode rewrites the native pair into effective weights, including the portal multiplier:

- `p = clamp(portalChance / 100, 0, 1)`, `m = max(1, portalMulti)`
- for each native ore at level `i` with weight `w`:
  `weights[i] += (1 - p) * w`, then for `j = 1..i`: `weights[j] += p * w * m / i`
- `Y = sum(weights)`, `S = sum(weights[level] / effectiveCost[level])`,
  `mixCost = Y / S`
- `BoP floor bars = barOutput * craftMult * A * S`
- `Transmuter floor bars = barOutput * (transmuterMult * T * Y + craftMult * T * S)`
- BoP wins while `mixCost < breakpoint`; Transmuter wins above it.

For a normalized native mix, the portal yield is `Y = 1 + p * (m - 1)`. At `p = 0` or `p = 1`, the
portal multiplier only scales the whole mix, so it cancels out of `mixCost`; at an intermediate
chance it changes how much weight sits on cheaper portal ore and can change the winner.

Golden ore is handled as an expected value: natural golden ore is worth `goldenOreMulti`, BoP can
convert more ore to golden, and those chances are blended before the BoP multiplier is applied.
Bar output applies to both sides, so it scales the bar totals but does not move the breakpoint.

Bar base costs and world numbers come from the wiki's
[*Craft*](https://shminer.miraheze.org/wiki/Craft) and
[*Ores*](https://shminer.miraheze.org/wiki/Ores) pages. Floor ranges and native ore pairs come from
the wiki's [*Floors*](https://shminer.miraheze.org/wiki/Floors) page, and portal behaviour is based
on the [community Transmuter calculator](https://tabatkins.com/obelisk/transmuter/) and the wiki's
[*Drones*](https://shminer.miraheze.org/wiki/Drones) page. Current data ends at Neopolium (World 4)
and floor 132; if the game adds more bars or floors, extend `BARS` or `FLOOR_ZONES` in
`bombdata.js`.

### Caveats

- **Floor bars are an aggregate.** A floor's effective mix covers several bar tiers, so the floor
  verdict counts one bar from each tier equally. Use the **Native ore on floor** rows when you are
  farming one specific bar; the bar-level mode remains the exact comparison for that bar.
- **Portal modifiers are not fully modelled.** The tool assumes the natural 80/20 or 50/50 mix, a
  uniform portal result from Tin up to each native ore's level, and no special floor variants.
  Area-specific portal-chance modifiers (for example Hattium and Mintium have a 0.40x portal chance),
  golden/rainbow/galactic portal upgrades, and special floor rules are not applied. Enter an
  effective chance by hand if you need one of those modifiers.
- **Whole-floor multipliers cancel.** Special floor multipliers such as prismatic or rainbow floors
  scale all ore on the floor, so they scale both bombs equally and do not change the winner. They
  are not included in the displayed bar totals.
- Using **both** bombs together (for example with a spoon auto-firing both) is always better than
  using either one alone. The tool only compares one bomb at a time.
- Golden ore and BoP stacking are random, and portals are random; the results are long-run expected
  values, not guarantees for a single bomb or floor.
- The game may change costs or mechanics. Sanity-check important decisions against the wiki and the
  community calculator.

## Goal ETA (`#/goal`)

Estimates how long an **ore** or **bar** target will take. ExportStats does not record your live ore
or bar balances or your ore/hour rate, so those are always manual.

- **Ore goal:** current ore, target ore, ore per hour, and play hours per day.
- **Bar goal:** current bars, target bars, current ore, and the bar level you are crafting. The tool
  reuses the bomb tool's nine crafting stats to convert bars into ore.
- **Rate helper:** enter the ore before and after a session plus the minutes elapsed; it calculates
  ore/hour and applies it to the goal.
- **Estimate:** remaining amount, play time, calendar time at your hours per day, finish date and
  time, progress, 25/50/75/100% milestones, and the rate needed to hit an optional deadline. If
  your current ore already covers the remaining bars, it reads **Ready now** rather than a time.

A deadline uses the play time available before it:
`play hours = wall-clock hours until deadline x hours per day / 24`, then
`required ore/hour = ore remaining / play hours`. The finish date assumes you spread your play hours
evenly from now, so it is a planning estimate rather than a schedule.

### Bar conversion

`barsPerOre = bar_output_multi x craftMultiplier / effectiveCost`, using the same `craftMultiplier`
and `effectiveCost` as the bomb tool. The ore still to mine is:

`max(0, bars remaining / barsPerOre - current ore)`

Craft multipliers are random, so `barsPerOre` is a long-run average. Short sessions can produce very
different bar counts.

### Caveats

- The estimate is only as good as the ore/hour rate you measured. Rates change with world, pickaxe,
  rock layout, upgrades, and how actively you play.
- The bar conversion assumes every mined ore goes into the selected bar. Ore spent on other bars,
  bombs, or upgrades is not modelled.
- Milestones and the finish date use the same constant rate and hours-per-day assumptions; they do
  not predict offline time, downtime, or upgrades you buy along the way.
- A deadline assumes you actually play the hours you entered before that date.

## Best Floor to Farm (`#/floors`)

A port of the community sheet **"IOM - Best Floor To Farm" V3.4.2** (game v2.2.52; CrisRody, Metzli
and OrionAF). Choose an **ore** or a **vein** and the tool ranks the floors for it. The sheet's
JSON tab is replaced by your saved account, so there is no paste step.

- **Best ore:** ranks floors by ore per hour for the selected ore. With the Void Drone it lists the
  top 20 floors (a portal turns a rock into any ore of equal or lower level, so higher floors work
  too); without it the sheet lists just the best 2. "Value" is the share of a perfect floor (every
  ore on screen is yours); values with and without the drone use different perfect floors.
- **Best veins:** ranks floors by veins per hour (spawn rate and rarity, 2x research, the
  Veinmorpher bomb, golden / rainbow / gleaming veins and void portals). Floors with equal values
  share a rank, shown as `1-8`.
- **Void Drone:** *Auto* follows the sheet (use it when its best floor beats the best no-void
  floor); *Always* / *Never* override that choice without changing your stats.
- **Floor modifiers:** the 23 "negative" floor ranges (fixed golden-floor chances, rainbow / golden
  ore / prismatic changes, 0.4x portal floors, slower game speed) are applied per floor and shown
  as tags.
- **Warnings and reminders** (account only): outdated or newer export, ore or floors you cannot
  one-shot, locked or unresearched veins, exported on a modifier floor, Void / Minotaur /
  Veinseeker drone not owned, equipped or fueled, Golden Steak off or running out. Every reminder
  is listed, not only the first as in the sheet. **Bomb advice** (Bomb of Plenty vs Transmuter) is
  shown for the selected ore.
- **Your stats:** every stat the sheet's green cells use, pre-filled from the account. Edits are
  kept as overrides on top of the export (marked *edited*; a fresh import clears them). Without an
  account the sheet's manual mode applies, including its world gates and the Void Drone multiplier
  stack (grade, Minotaur, Coal Generator, level-400 upgrade, Omniportal, contract, Arcanist, Hydra).
  **Imported stats** mirrors the sheet's JSON tab (name, key, value, value used) and **Floor
  explorer** lists all 132 floors, sortable.
- Saved in `obelisk-floors-v1`; the home-page **Reset** clears it.

Differences from the sheet:

- The "can I one-shot it" test reports the real answer. The sheet's text parser leaves a stray `}`
  on the last export key (`3.0}`), so its one-shot cells show `#VALUE!` whenever damage is not
  enough, and its `IFERROR` then reads that as "yes".
- Version checks compare numbers (`v2.2.9 < v2.2.10`), and the sheet's "you are using an outdated
  sheet" check is dropped.
- Manual percent inputs are real percents (the sheet wants fractions).

Data: ore, vein and modifier tables live in `floortables.js`, **generated** by
`tools/extract_floor_sheet.py` from an `.xlsx` download of the sheet (needs `openpyxl`; see the
script header). It also writes the golden fixtures (`test/ref_floors_*.json`), the export fixture
and the vein pictures in `img/veins/`. Sheet bar costs differ slightly from the wiki costs in
`bombdata.js` (for example Cognite 1046 vs 1050); both are kept as they are.

Caveats: the sheet's values are only verifiable for the one ore and vein it had selected when it
was exported (Tin / Stone Vein). Run the sheet with the numbers you care about when something looks
off. Export your stats on a floor without modifiers.

## Contract Point Planner (`#/contracts`)

Ranks every contract upgrade for **ore**, **veins**, **stars**, **bars/crafting**, and **damage**,
then builds a shopping list from a Contract Point budget.

- **Current levels + spare CP** starts from your saved account's `contracts_array` (or the editable
  level table) and spends only the spare CP you enter.
- **Full respec** refunds every owned contract level at the current cost-reduction rate, adds your
  spare CP, then plans from zero. Respec gains are versus your current levels, so a goal can show a
  negative gain.
- **Goal weights** are sliders from 0 to 100. They are normalised to 100%, so a 100/100 split shows
  50% each. Presets jump to 100% ore, 100% veins, 100% stars, or 50/50 ore + veins. All zero disables
  buying.
- **Contracts completed** is manual because ExportStats does not record it. It only powers the two
  "+1% per Contract" damage upgrades; leave it at 0 if you do not use them.
- The **level table** shows all 34 upgrades with their current level, cap, and OB requirement. It is
  editable so you can plan for cap increases or OB levels that are not in the export.
- The **spend plan** is greedy: each step buys the affordable level with the highest weighted score.
- The **Ranking / Summary** toggle switches the upgrade view. **Ranking** lists all 34 upgrades
  best-first; capped, OB-locked, maxed, and no-effect rows are greyed out and explained. **Summary**
  lists every upgrade with its current level, cap, CP already spent, next price, CP still needed to
  max, and grand totals. The summary's **Spent** column equals the respec refund, and **To max**
  includes OB-locked upgrades at their listed prices.

### Goal model

Each goal is the product of its upgrades' multiplicative factors:

| Goal | Contract upgrades that affect it |
| --- | --- |
| Ore | Golden Floor Multi, Base Game Speed, Rainbow Floor Multi/Chance, Golden Ore Chance, Prismatic Floor Multi, Golden Void Portal Chance, All Portal Multi |
| Veins | Vein Income Multiplier, Golden Vein Chance, Base Game Speed, Rainbow Vein Multiplier |
| Stars | Super Star Spawn Rate, Base Game Speed, Super Star Supernova, Star Supergiant, Super Star Supergiant, All Star Multiplier, All Radiant Multi |
| Bars / crafting | Triple Craft Chance, 10x Craft Chance, Upgrade Bar Cost, Base Game Speed |
| Damage | Per-contract pickaxe/bomb damage, pickaxe crits, bomb recharge, ultra/omega crits, 1.08x pickaxe & bomb damage, Base Game Speed |

Ore Sell Price, EXP Gain, Prestige Point Gain, Lootfrog Triple Spawn Chance, and Rune Craft Multi do
not map to these five goals, so they appear greyed out with "No effect on selected goals".

Factors use the upgrade's level and the current account stats:

- **Multi:** `f = 1 + amount x level`.
- **Compound:** `f = 1.08 ^ level` for the "1.08x" damage upgrade.
- **Chance:** `f = 1 + min(1, c0 + amount x level) x (multi - 1)`, where
  `c0 = export chance - amount x owned level`. A chance already at 100% gains nothing and is
  marked **Capped**.
- **Craft:** the triple and 10x craft chances are changed one at a time through the bomb tool's
  craft multiplier. The base chance is the export chance minus the contract contribution; a craft
  chance already at 100% is marked **Capped**.
- **Bar cost:** `f = 1 / (1 - 0.05 x level)`.
- **Per contract:** `f = 1 + 0.01 x level x contracts completed`.
- **Damage:** pickaxe and bomb factors are multiplied separately, then averaged 50/50.

### Costs, scoring, and respec

Costs come from the wiki's [*Contracts*](https://shminer.miraheze.org/wiki/Contracts) page
(v2.2.23) and follow `Module:CostTable`: linear upgrades add a step to the previous raw cost, and
exponential upgrades multiply the previous raw cost by the scaling. Level and scaling overrides
switch on at their listed level. Displayed costs are rounded, but later levels keep scaling from the
raw previous cost.

- `cost = round(raw cost x (1 - contract_upgrade_cost_reduction))`. The reduction is applied
  without integer rounding; this is an assumption worth checking against one in-game price.
- `score = sum(weight x ln(G(level + 1) / G(level))) / cost`.
- `plan` repeatedly buys the highest-scoring affordable level until nothing positive fits.
- `respec budget = spare CP + sum(cost of every owned level at the current reduction)`.
- `weighted total = exp(sum(weight x ln(goal after / goal before))) - 1`. In respec mode "before" is
  your current levels, not zero.

The data uses the current table length: each upgrade's base max plus 14 cap levels. Cost totals are
verified against the wiki: Triple Craft 6,776, Vein Income 48,398, and Ore Sell Price 135,451.

### Auto-filled stats

| ExportStats key | Used as |
| --- | --- |
| `contracts_array` | Current contract upgrade levels |
| `contract_cap_increase` | Extra levels added to every upgrade cap |
| `contract_upgrade_cost_reduction` | Contract Point cost reduction |
| `obelisk_level` | OB gates on World 2-4 upgrades |
| `*_chance` / `*_multi` | Base chance and multiplier for chance upgrades |
| `triple_craft_chance` / `craft_10x_chance` | Base crafting chances |
| Crafting stats | Fed through the bomb tool's craft multiplier |

The saved account supplies these automatically; every level, weight, and budget remains editable.
Without an account the planner uses OB 0, cap +0, and 0% cost reduction.

### Caveats

- Contract bonuses are treated as their own multiplicative factors, not added into the export's huge
  stat totals (for example `rainbow_floor_multi`). If the game sums them additively, the factors
  should be `(stat + bonus) / stat` instead.
- Portal and damage upgrades multiply the whole goal. That overstates them when only part of your
  income uses portals, or when your pickaxe/bomb use is not 50/50.
- Greedy spending is close to, but not guaranteed to be, the exact optimal plan.
- The planner does not simulate future contract income, bar costs paid to complete contracts, or CP
  gained along the way; it only plans the budget and completion count you enter.
- Costs, caps, and OB gates are hard-coded for v2.2.23. If the game adds levels or upgrades, extend
  `UPGRADES`, `MAX_LEVELS`, and the cost tables in `contractdata.js`.

## Max Damage (`#/damage`)

Shows the biggest **pickaxe** and **bomb** hit a player can reach, with damage consumables toggled
on and the damage contracts maxed. The export is the starting point: the calculator removes the
consumables and contract levels already baked into the exported stats, then rebuilds the numbers
for the selected scenario.

- **Consumables:** checkboxes for Apple, Pike, Juicy Plums, Rock Cake, Primal Meat, Hamburger,
  Chaos Totem, Banana Coffee, and Blue Cow. Presets switch between **All damage items**, **At
  export** (using `item_uptime_array`), and **None**. Golden Primal Meat (Black Hole 13+) and
  Golden Hamburger (Blackened Basker tribute) are detected from the account; Golden Chaos Totem is
  a manual what-if checkbox.
- **Contracts:** **Maxed for damage** sets the eight damage upgrades to their current cap
  (`base max + contract_cap_increase`). OB-locked upgrades stay at their current level and are
  tagged with their OB requirement. **Current levels** keeps the exported levels. The contract
  table shows current and maxed level, effect, and the change. Contracts completed is manual
  because ExportStats does not record it.
- **Results:** maximum pickaxe hit, current-setup comparison, maximum bomb hit, base damage,
  max crit multiplier, expected hit, expected DPS, attack speed, game speed, and a crit-tier table
  with the chance, multiplier, and damage of each outcome. The Obelisk armour card shows the
  effective armour and the damage after armour for the selected target; the table below it lists
  the next five OB levels with their effective armour and pass/fail for the selected and current
  setups.
- **Breakdowns:** the contract table and consumable table show exactly what changed. The
  **Your stats** accordion pre-fills every damage stat from the account and keeps hand edits in
  this browser until a new import or Reset.

### Damage model

The export's `pickaxe_damage` and `bomb_damage` are the final base values before crits, so the
calculator divides out the current damage-contract factors and the consumables that were active at
export:

- **Base damage:** `export / current contract factor / active item factor`, then multiplied by the
  selected item factor and contract factor.
- **Rock Cake + Primal Meat:** additive within the item menu: `1 + 0.30 + 1.00` (Golden Primal
  Meat is `+2.00`). **Hamburger** multiplies that result: `3 + 0.12 x workshop_array[22]` (Golden
  `2x`).
- **Crit items:** Apple adds 10 percentage points of pickaxe crit chance; Pike adds 30% crit
  damage; Juicy Plums adds 25 percentage points of crit chance and 25% crit damage.
- **Crit chain:** a Super crit needs a Crit, an Ultra needs a Super, and an Omega needs an Ultra.
  The maximum hit uses the highest tier with a non-zero chance; the expected hit weights each
  outcome by its probability.
- **Contracts:** Pickaxe Damage, Pickaxe Crit Damage, the two per-contract upgrades, and the 1.08x
  upgrade multiply the hit; Super/Ultra/Omega crit chance upgrades decide which tiers can trigger.
  Chance upgrades use `base chance + amount x level`, where the base chance is the export chance
  minus the owned contract contribution.
- **DPS:** expected hit x attack speed x game speed. Game speed is read from the export and may
  include the floor the export was taken on.
- **Bomb:** `bomb_damage x (1 + bomb_additional_multiplier)` (capped at 99,999x), then the
  consumable and bomb-contract factors and the bomb crit chain.
- **Obelisk armour:** the base armour table is multiplied by the export's
  `obelisk_armor_reduction` (the game's Obelisk Armor Reduction stat, e.g. `0.12`). Armour is
  subtracted from the base pickaxe hit before crits; if the base hit is not above the armour, the
  hit deals 0 even when a crit would otherwise be enough.

### Caveats

- The export is treated as already including the contract levels and active items it records. If
  the game applies contract bonuses in a different way, the contract portion can differ. The
  contract planner makes the same assumption.
- Crit chance above 100% is capped for the expected hit; the maximum hit still uses the tier if
  its chance is above 0.
- The maximum pickaxe hit is the raw hit before Obelisk armour. The armour card applies the
  effective armour (base x Obelisk Armor Reduction) and subtracts it from the base hit before
  crits. Ore damage-reduction modifiers are not applied.
- Base Game Speed and Bomb Recharge contracts are not maxed because they do not change a single
  hit's damage.
- Maxed damage contracts respect your OB level: an upgrade above the current OB stays at its
  current level. Edit the OB level in **Your stats** to see a future what-if.
- Item uptime is read as `item_uptime_array[index] > 0`, following the Best Floor tool's Golden
  Steak handling and the community damage calculator.
- Banana Coffee's optional game-speed effect from the Cephalus idol is left inside the export's
  game speed; DPS is therefore approximate when that idol is active.

## Tracker (`#/tracker`)

The Tracker turns the shared account import into a progress history. Every successful paste or
drag-drop of an ExportStats JSON appends a snapshot. Importing the same
export twice does not create a duplicate: snapshots are keyed by the export's own `time`, and an
identical fingerprint is skipped. If the same export date appears again with different stats, the
new record replaces the old one.

### Snapshot dates

The export's `time` is an Excel serial date (days since 1899-12-30), so the file already contains
the date and time the game exported it. The tracker reads those digits in your local timezone, so
the wall-clock time stays stable and can be compared with the true `importedAt` instant. It does
not depend on when you paste the file. If an export has no usable time, the browser import time is
used instead. A date can be corrected from the snapshot table; the edit moves the point on the
chart but keeps the snapshot's export identity.

### Active account vs. history

The snapshot history is independent of the account currently loaded into the tools. An export
older than the active account is recorded in the Tracker but does **not** replace the account, so
backfilling old exports cannot accidentally downgrade the fishing, bomb, goal, or contract tools.
A newer import still updates the active account as before. **Use** in the snapshot table loads a
chosen snapshot into every tool deliberately (after a confirmation, because manual edits in the
tools will be replaced), and **Clear history** removes the snapshots without touching the active
account. The home page **Reset** button also leaves the history alone.

If the history is empty and this browser already has a saved account, the first visit seeds one
snapshot from that account (marked as seeded; a built-in sample account is skipped). Pasting the
same export again does not duplicate it.

### Graph

- **One stat** is plotted in its own units. A log axis is used automatically when the plotted range
  spans about 100x or more, and **Scale** lets you force linear or log.
- **Several stats** switch to a normalized overlay: every series starts at 100% at its first
  positive value, so multipliers, levels, and damage can share one chart. Leading zeros are skipped
  rather than plotted as 0%. Hovering or tapping a point shows the exact raw values, and the
  **Chart data** table gives keyboard users the same values.
- Up to eight stats can be compared at once; the palette has one distinct colour per series.
- The quick-pick chips default to OB level, current floor, worlds unlocked, black hole level,
  all-floor multiplier, ore sell price multiplier, game speed, pickaxe damage, bomb damage, fishing
  income multiplier, total fishing upgrade levels, and total contract levels. Search the full
  export field list to add any other numeric stat; `derived:` metrics sum the obvious progress
  arrays (contracts, fishing upgrades and enhancements, cards, pets, skill-tree nodes, idols).
- **Range** filters to the last 30, 90, or 365 days relative to the newest snapshot, not today's
  date. With only one snapshot in range the chart shows a single point.

Pinned metrics and the last selection/range/scale are saved under
`obelisk-tracker-prefs-v1`. Unpinning a selected metric removes it from the chart; the search box
can add it back.

### Storage and backups

- Snapshot history is stored in the `obelisk-tracker` IndexedDB database (`snapshots` store),
  separately from the active account in `obelisk-account-v1`. There is no automatic snapshot cap
  in IndexedDB.
- If IndexedDB is unavailable (some `file://` setups, private modes, or a blocked database), the
  tracker falls back to local storage and keeps the newest 50 snapshots, with a visible warning.
  If even local storage is unavailable, snapshots last for the session only. Unreadable fallback
  data is backed up under `obelisk-tracker-fallback-v1-corrupt` instead of being silently
  overwritten.
- **Download history** writes a portable JSON bundle containing the raw export and its metadata.
  **Import history** merges a bundle by export date; an existing date is replaced only when the
  incoming record differs and is at least as new. **Clear history** asks for confirmation and does
  not affect the active account.

### Caveats

- A snapshot is a point-in-time copy of the stats the game exports. Balances the game does not put
  in ExportStats (current ore, bars, gems) and observations such as ore/hour are not tracked.
- The normalized multi-stat view is for comparing growth rates; it does not imply the stats share
  units or that one is more important than another.
- Export times are wall-clock values from the game's serializer. Timezone or clock changes can
  shift when a snapshot appears; correct the date in the snapshot table if needed.
- IndexedDB can be cleared by the browser, a private session, or a site-data reset. Download a
  history file if the record matters.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Home page + fishing, legendary, bomb, goal, contract, Max Damage, Best Floor, and Tracker tool shells |
| `styles.css` | Styling |
| `model.js` | The ported fishing model (`window.FishModel`) |
| `legendarydata.js` | Legendary fish power, catch chance, legendary steps, tick rate, and distribution maths (`window.LegendaryData`) |
| `legendary.js` | Legendary Fish calculator UI (`window.LegendaryTool`) |
| `data.js` | Field labels/limits (`window.UI_SPEC`) |
| `fishcosts.js` | Fish-upgrade cost tables + fish power ratings (`window.FISH_DATA`) |
| `exportstats.js` | ExportStats -> inputs mapper (`window.ExportStats`) |
| `account.js` | Shared saved-account storage (`window.AccountStore`) |
| `bombdata.js` | Bar costs, floor/zone data, portal mix, and bomb formulas (`window.BombData`) |
| `bombs.js` | Bomb comparison UI, bar and floor modes (`window.BombTool`) |
| `goaldata.js` | Goal ETA + bar conversion maths (`window.GoalData`) |
| `goals.js` | Goal ETA UI and measured-rate helper (`window.GoalTool`) |
| `contractdata.js` | Contract levels, caps, costs, goals, ranking, and spend plans (`window.ContractData`) |
| `contracts.js` | Contract Point Planner UI (`window.ContractTool`) |
| `damagedata.js` | Max damage maths: consumables, crit tiers, and maxed damage contracts (`window.DamageData`) |
| `damage.js` | Max Damage calculator UI (`window.DamageTool`) |
| `floortables.js` | Generated ore / vein / floor-modifier tables (`window.FloorTables`) |
| `floordata.js` | Best Floor maths ported from the sheet (`window.FloorData`) |
| `floors.js` | Best Floor to Farm UI (`window.FloorTool`) |
| `img/veins/` | The 21 vein pictures from the sheet |
| `tools/extract_floor_sheet.py` | Dev script: sheet .xlsx -> tables, fixtures, images |
| `trackerdata.js` | Export timestamps, snapshots, metric catalogue, chart maths, and IndexedDB/local history (`window.TrackerData`) |
| `tracker.js` | Tracker UI, graph, snapshot table, and history download/import (`window.TrackerTool`) |
| `app.js` | View routing + fishing tool UI wiring + account import |
| `sample.js` | Test fixture: a sample ExportStats export (`window.SAMPLE_EXPORT`, game v2.2.20) |
| `sample_v2252.js` | Test fixture: a v2.2.52 export (`window.SAMPLE_EXPORT_V2252`) |
| `test/validate.js` | Model vs. the sheet's cached default values |
| `test/validate_export.js` | Export mapping + full-sample run |
| `test/validate_legendary.js` | Legendary fish power, steps, Angler, tick, distribution, and page wiring |
| `test/validate_fish.js` | Fish data shape + fish ranking behaviour |
| `test/validate_bombs.js` | Bomb formulas, floor/portal mixes, breakpoints, and page wiring |
| `test/validate_goal.js` | Goal ETA formulas, bar conversion, and page wiring |
| `test/validate_contracts.js` | Contract costs, goals, ranking, plans, respec, and page wiring |
| `test/validate_damage.js` | Max damage item factors, crit tiers, contract maxing, sample export, and page wiring |
| `test/validate_floors.js` | Best Floor maths vs the sheet's cached values (default and loaded), manual mode, import, and page wiring |
| `test/validate_tracker.js` | Tracker timestamps, snapshot merging, chart series, and storage |
| `test/ui_smoke.js` | Headless UI wiring smoke test (all tools) |

## Running the tests

```
node test/validate.js
node test/validate_export.js
node test/validate_fish.js
node test/validate_legendary.js
node test/validate_bombs.js
node test/validate_goal.js
node test/validate_contracts.js
node test/validate_damage.js
node test/validate_floors.js
node test/validate_tracker.js
node test/ui_smoke.js
```

`validate.js` checks the ported model against the spreadsheet's cached values in the default
(empty) state; the others exercise the import mapping, the fish cost/ranking data, the legendary
fish power/tick/distribution maths, the bomb comparison, the goal ETA maths, the contract planner's
costs/plans/respec, the Max Damage item and contract maths, the Best Floor maths, the Tracker's
timestamps/series/storage, and the UI wiring.

## Disclaimer

Community project, not affiliated with the game or the sheet's authors. Always sanity-check a
result against the original spreadsheet or calculator before spending gems.
