# Obelisk Miner Tools

A static website with a shared **account importer** plus tools for *Idle Obelisk Miner*:

- **Let's Go Fishing** ranks every fishing gem upgrade by how much fish/time it adds **per gem you spend**.
- **Bomb Comparison** works out whether the **Bomb of Plenty** or **Transmuter Bomb** produces more bars at a chosen bar level, or across a dungeon floor's Void Drone portal mix.
- **Goal ETA** estimates how long an ore or bar target will take from a measured ore/hour rate, with progress, milestones, and the rate a deadline needs.

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
2. Paste your ExportStats JSON on the home page and press **Apply JSON**, or click **Load sample**
   to try it with a real late-game export. You can also drag a `.json` file onto the page.
3. Open a tool from the cards (or the header): **Let's Go Fishing** (`#/fishing`),
   **Bomb comparison** (`#/bombs`), or **Goal ETA** (`#/goal`). A refresh or bookmark reopens the
   tool directly.
4. Anything the game did not record (a few bar levels, bundles, statues, etc.) stays at 0 and is
   shown as a manual field - fill those in inside the tool.
5. In the fishing tool, read the **Ranking** table: it is sorted best-first. `Score/gem` is the
   ranking metric.
6. To plan a goal, enter your current amount, the target, and your measured ore per hour. Current
   ore, current bars, and ore/hour are never in ExportStats, so the goal tool always asks for them.

## Home page and shared account

The home page (`#/home`) is the account hub:

- Paste, load, or drag in an ExportStats file once. The raw JSON is saved in this browser under the
  `obelisk-account-v1` local-storage key, separately from each tool's settings.
- The account summary shows the game version, export timestamp, source, import time, and how many
  fields were mapped.
- Each tool card shows whether it will use the saved account or fall back to manual entry.
- **Reset** clears the saved account, the fishing tool's settings, the bomb tool's current values
  and floor/portal inputs, and the goal tool's targets and measured rate.
- Tools read the account through `window.AccountStore` (`account.js`), so future tools can be added
  without changing the import flow.

Tool settings are still saved automatically under `lgf-optimizer-state-v1`. The bomb tool starts
from the account every time the page opens; edits in its form apply immediately.

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
- the breakpoint and the last/first known bar levels on each side.

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

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Home page + fishing, bomb, and goal tool shells |
| `styles.css` | Styling |
| `model.js` | The ported fishing model (`window.FishModel`) |
| `data.js` | Field labels/limits (`window.UI_SPEC`) |
| `fishcosts.js` | Fish-upgrade cost tables + fish power ratings (`window.FISH_DATA`) |
| `exportstats.js` | ExportStats -> inputs mapper (`window.ExportStats`) |
| `account.js` | Shared saved-account storage (`window.AccountStore`) |
| `bombdata.js` | Bar costs, floor/zone data, portal mix, and bomb formulas (`window.BombData`) |
| `bombs.js` | Bomb comparison UI, bar and floor modes (`window.BombTool`) |
| `goaldata.js` | Goal ETA + bar conversion maths (`window.GoalData`) |
| `goals.js` | Goal ETA UI and measured-rate helper (`window.GoalTool`) |
| `app.js` | View routing + fishing tool UI wiring + account import |
| `sample.js` | A sample ExportStats export (`window.SAMPLE_EXPORT`) |
| `test/validate.js` | Model vs. the sheet's cached default values |
| `test/validate_export.js` | Export mapping + full-sample run |
| `test/validate_fish.js` | Fish data shape + fish ranking behaviour |
| `test/validate_bombs.js` | Bomb formulas, floor/portal mixes, breakpoints, and page wiring |
| `test/validate_goal.js` | Goal ETA formulas, bar conversion, and page wiring |
| `test/ui_smoke.js` | Headless UI wiring smoke test (all tools) |

## Running the tests

```
node test/validate.js
node test/validate_export.js
node test/validate_fish.js
node test/validate_bombs.js
node test/validate_goal.js
node test/ui_smoke.js
```

`validate.js` checks the ported model against the spreadsheet's cached values in the default
(empty) state; the others exercise the import mapping, the fish cost/ranking data, the bomb
comparison, the goal ETA maths, and the UI wiring.

## Disclaimer

Community project, not affiliated with the game or the sheet's authors. Always sanity-check a
result against the original spreadsheet or calculator before spending gems.
