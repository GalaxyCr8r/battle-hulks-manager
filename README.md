# Battle Hulks Unit Manager

An unofficial fan tool for [Battle Hulks](https://www.fatdragongames.com/)™ (Fat Dragon Games, 2026):
a browser view of the ten official Mk.I units, a reverse-engineered point-cost model,
and a builder that prices units you design yourself.

Open `index.html` in a browser — there is no build step and no dependencies.

## Why a fitted model?

The version 1.1 rulebook contains no unit-construction rules. Point values appear only as
fixed numbers printed on each unit card, plus a short upgrade list in section 9.0. To make a
builder possible at all, the cost of a unit has to be recovered from the ten published cards
by regression.

The result reproduces all ten official point values exactly once rounded to the nearest 5,
with a largest raw deviation of 1.99 points. It is a *reconstruction* of the designer's
pricing, not an official rule — see the "Cost model" tab in the app for the full list of
caveats, including the fact that Armor and Structure cannot be separated from this sample.

## Layout

| Path | Purpose |
| --- | --- |
| `index.html` | The application |
| `assets/app.js`, `assets/styles.css` | UI and cost-model implementation |
| `data/units.json` | Unit statistics transcribed from the official card PDFs |
| `data/model.json` | Fitted cost-model coefficients |
| `data/data.js` | Generated bundle of the two JSON files, loaded by the page |
| `tools/fit_model.py` | Refits the model against `units.json` |
| `tools/build_data.py` | Regenerates `data/data.js` |

`data/data.js` exists because `fetch()` of a local JSON file fails under the `file://`
protocol; bundling the data into a plain script keeps the page working when opened directly
from disk as well as when served over http.

### After editing the data

```sh
python3 tools/fit_model.py --write   # refit coefficients (needs numpy + scipy)
python3 tools/build_data.py          # regenerate data/data.js
```

## Source of the statistics

Values were read from the official unit card PDFs. Those cards carry no text layer — the
card faces are flattened raster images — so the numbers were transcribed by eye rather than
parsed. Only game statistics are reproduced here; no card artwork is included.

## Legal

Battle Hulks™ is a trademark of Fat Dragon Games, ©2026. This project is an unofficial fan
tool, is not affiliated with or endorsed by Fat Dragon Games, and reproduces only the game
statistics needed to make the tool work.
