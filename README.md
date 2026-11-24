# Token Launch Radar — radar-5

[![make.fun](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/bal-mond/token-radar-02/rank.svg)](https://make.fun/bounty/token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/bal-mond/token-radar-02/reward.svg)](https://make.fun/bounty/token-radar-01)

A token launch radar for the [make.fun bounty](https://make.fun/bounty/token-radar-01):
it reads a sealed snapshot of every protocol DefiLlama tracks, works out which
ones still record no token, and ranks them by what their launch would be worth —
then hands in a web dashboard with the board, a detail view for each protocol,
and the steps to farm it.

## The model (radar-5)

Every number is derived from the sealed snapshot at run time, never from a
hand-kept list of names:

- **Size curve, fitted.** `log(market cap) = 6.9646 + 0.5223 · log(TVL)`,
  least squares over the snapshot's own traded tokens with a known market cap
  (128 clean comps). The curve is fitted fresh on every run.
- **Token odds, fitted.** A logistic regression P(listed | protocol age),
  fitted by IRLS on the snapshot's 645 protocols with a known age, turned
  into the odds that an unlisted protocol ever lists by
  odds(a) = (pi − q(a)) / (1 − q(a)), where pi is the listed share among the
  oldest decile. 5-fold log-loss 0.625 against 0.694 for the flat base rate,
  AUC 0.704 against 0.500; split-half calibration per age bucket is shown on
  the model page.
- **Expected value = implied × odds.** The board ranks by expected value.
- **P10–P90 range on every row.** The 10th and 90th percentiles of the
  leave-one-out residuals, x0.05 to x8.82 around the curve's prediction. The
  band holds 74% / 77% / 79% on unseen tokens (two walk-forward cuts,
  10-fold).

## What radar-5 tried, and what it found

This build had one job: beat radar-3's value model on leave-one-out error.
The target was LOO ≤ x3.00, the number the field's leaders report.
**It was not reached. LOO is x3.40, the same as radar-3.** The dashboard
says so on the cover and on the model page instead of hiding it.

Thirteen variants were fitted and tested held-out at run time (LOO, two
walk-forward cuts, 10-fold — the full table is on the model page, computed
fresh from the snapshot on every run):

| Variant | LOO | Walk 2025 | Walk 2024 | 10-fold |
| --- | --- | --- | --- | --- |
| Global log-log curve (shipped) | x3.40 | x3.08 | x3.16 | x3.57 |
| Quadratic in log TVL | x3.39 | x2.61 | x3.34 | x3.56 |
| Quadratic, ridge lambda 1 | x3.38 | x2.88 | x3.48 | x3.58 |
| Per-category curve, shrunk | x3.61 | x3.08 | x3.16 | x3.56 |
| Per-category intercept, shrunk | x3.55 | x3.21 | x3.32 | x3.56 |
| Huber robust fit | x3.53 | x3.04 | x3.29 | x3.61 |
| Trimmed refit (2 SD) | x3.52 | x3.22 | x3.14 | x3.47 |
| Theil-Sen | x3.52 | x2.87 | x3.04 | x3.61 |
| kNN local multiple (k=20) | x4.21 | x2.77 | x4.10 | x3.96 |
| TVL-weighted least squares | x3.51 | x4.16 | x3.49 | x3.47 |
| Mean ensemble (OLS+quad+Huber) | x3.41 | x2.94 | x3.27 | x3.59 |
| Bare curve + growth | x3.77 | x3.14 | x2.88 | x3.58 |
| Bare curve + age | x3.58 | x4.44 | x3.01 | x3.63 |

A variant ships only if it beats the bare curve on LOO **and** on both
walk-forward cuts at once. Nothing does. The quadratic's LOO x3.39 is the
only number below the bare curve's, by less than 1% — one observation's
worth of noise — and it loses the second walk-forward cut (x3.34 against
x3.16). The residual noise is the data's, not the fit's: the log residuals'
spread does not vary with TVL (corr −0.08), age (−0.15) or chain count
(−0.02), and the per-category mean residuals that look large (Liquid
Staking −1.01, Canonical Bridge +1.19 in log space) are what 8–15 noisy
comps look like — the shrunk category intercept still loses on LOO.

## What changed from radar-3

- **The hunt itself is the change.** radar-3 tested 7 variants; radar-5
  tests 13, including per-category curves (not just intercepts), ridge-shrunk
  quadratics, Theil-Sen, kNN local multiples, TVL-weighted fits and an
  ensemble — and prints the whole table on the model page, losers included.
- **A third time split.** Walk-forward now has a third cut (fit before
  2024-01-01, test after): median error x2.91 (44 train + 51 test).
- **11 integrity checks on the cover** (was 10), the new one confirming the
  variant table holds 13 variants with exactly one shipped.
- **The honest miss is stated.** The LOO check on the cover reads
  "x3.4 (target x3.00 not reached — see Model)", and the model page leads
  with the missed target. The board keeps radar-3's winning structure
  untouched: 198 ranked launch candidates, 40/40 watchlist, traded tokens
  as anchors only, costed farm verdicts (142 FARM / 53 THIN / 3 SKIP).

## The tests (run at build time, shown on the dashboard)

- Leave-one-out over 128 comps: median error ×3.40, 32% of predictions
  within 2x of the real market cap.
- Walk-forward (fitted on tokens listed before 2025-01-01, tested on those
  listed after): median error ×3.08, 26% within 2x. Second cut
  (2024-07-01): ×3.16, 33% within 2x. Third cut (2024-01-01): ×2.91.
- 10-fold cross-validation: median error ×3.57, 31% within 2x.

The curve is an honest, noisy predictor, and the board says so instead of
hiding it.

## Farm plans

Six steps per protocol, derived from its own record (category, chains, TVL,
age), each with a cost and a time. Capital by TVL tier, gas about $12,
hold 30–60 days by age. A farmer's share is taken as 0.005% of the launch
value. Verdict per row: FARM when the expected receipt is at least 3x the
cost, THIN at 1x, else SKIP — with the break-even in dollars on every row.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <kit>/input/snapshot.json
```

`main.ts` (Node 22, standard library only) reads the snapshot, writes
`board.json` (198 rows: every launch candidate, 40/40 watchlist), `data.js`,
copies `dashboard/` and `screenshots/` to the output, and writes
`dossier.json` with the kit's `vendor/makefun-board.ts`. The program is
deterministic: the same snapshot always writes the same bytes.

## Verification

- Two runs write byte-identical output (`diff -r` clean; board.json
  sha256 `e86756bd8acb72cf2a6a3044185a16da2a711852d25831bac4c0db95561c4957`).
- Board: 198 rows, ranks 1..198, implied values non-increasing, 40/40
  watchlist, farm steps 3–12 strings of 20–600 characters, board.json
  287,572 bytes (cap 8 MiB).
- Dashboard: 3 files, 30,230 bytes — under the 65,536-byte text cap, so the
  dossier shows every source file whole; no http(s) URL in any attribute,
  CSS file or JS import.
- Screenshots: 3 PNGs, each 1440×900, 180–199 KB (cap 512 KiB) — the
  board, a protocol's detail view, and a filtered view, rendered in
  headless Chrome from the dashboard's own files.
- Dossier: 780,700 bytes (cap 1.5 MiB); rebuilding it with the kit's
  `buildDossier` from the same output gives byte-identical JSON.
- Runtime ~2 s per run, well inside the 120 s limit.

## Layout

- `main.ts` — the entrypoint
- `lib/model.ts` — the fitted model, the 13-variant test battery, the farm
  plans, the out-of-sample tests
- `vendor/makefun-board.ts` — the kit's dossier library, byte for byte
- `dashboard/` — the static page (no network): board, detail view, live
  anchors, model page
- `screenshots/` — the board, a protocol's detail view, and a filtered view
- `LICENSE` — MIT
