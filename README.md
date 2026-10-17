# Let's Go Fishing - Gem Upgrade Optimizer

A static website that ranks every **fishing gem upgrade** in *Idle Obelisk Miner* by how much
fish/time it adds **per gem you spend**, so you can decide what to buy next.

It is a faithful JavaScript port of the community Google Sheet **"Let's Go Fishing - V2.0.6"**
(`Obefish` tab). You can type your stats in by hand, or import the game's **ExportStats JSON**
to fill almost everything automatically. It also ranks the **fish-purchased upgrades**
(Fishing Rod, Drone, boats, ticks, ...) by fish/time gained per power-weighted fish spent
(section 7).

No build step, no server: open `index.html` in a browser.

## Quick start

1. Open `index.html` in any modern browser (works from `file://`).
2. Click **Load sample** to see it working with a real late-game export, or paste your own
   ExportStats JSON into the text box and press **Parse pasted JSON**. You can also drag a
   `.json` file onto the page.
3. Anything the game did not record (a few bar levels, bundles, statues, etc.) stays at 0 and is
   shown as a manual field - fill those in.
4. Read the **Ranking** table: it is sorted best-first. `Score/gem` is the ranking metric.

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
one level at a time. The level inputs in section 3 stay in sync, and any manual edit clears the
comparison so the arrows never go stale.

## Fish upgrade ranking (section 7)

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

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page shell |
| `styles.css` | Styling |
| `model.js` | The ported model (`window.FishModel`) |
| `data.js` | Field labels/limits (`window.UI_SPEC`) |
| `fishcosts.js` | Fish-upgrade cost tables + fish power ratings (`window.FISH_DATA`) |
| `exportstats.js` | ExportStats -> inputs mapper (`window.ExportStats`) |
| `app.js` | UI wiring |
| `sample.js` | A sample ExportStats export (`window.SAMPLE_EXPORT`) |
| `test/validate.js` | Model vs. the sheet's cached default values |
| `test/validate_export.js` | Export mapping + full-sample run |
| `test/validate_fish.js` | Fish data shape + fish ranking behaviour |
| `test/ui_smoke.js` | Headless UI wiring smoke test |

## Running the tests

```
node test/validate.js
node test/validate_export.js
node test/validate_fish.js
node test/ui_smoke.js
```

`validate.js` checks the ported model against the spreadsheet's cached values in the default
(empty) state; the others exercise the import mapping, the fish cost/ranking data, and the UI
wiring.

## Disclaimer

Community project, not affiliated with the game or the sheet's authors. Always sanity-check a
result against the original spreadsheet before spending gems.
