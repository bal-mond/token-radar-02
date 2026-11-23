# Token Launch Radar — radar-3

[![make.fun](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/bal-mond/token-radar-02/rank.svg)](https://make.fun/bounty/token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/bal-mond/token-radar-02/reward.svg)](https://make.fun/bounty/token-radar-01)

A token launch radar for the [make.fun bounty](https://make.fun/bounty/token-radar-01):
it reads a sealed snapshot of every protocol DefiLlama tracks, works out which
ones still record no token, and ranks them by what their launch would be worth —
then hands in a web dashboard with the board, a detail view for each protocol,
and the steps to farm it.

## The model (radar-3)

Every number is derived from the sealed snapshot at run time, never from a
hand-kept list of names:

- **Size curve, fitted.** `log(market cap) = a + b · log(TVL)`, least squares
  over the snapshot's own traded tokens with a known market cap (128 clean
  comps). The curve is fitted fresh on every run.
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

## What changed from radar-2, and why

- **Growth term dropped.** radar-2 kept the 7-day change at weight 0.25
  (in-sample r = −0.14). Out of sample it hurts: LOO x3.77 against x3.40
  bare, 10-fold x3.58 against x3.57, walk-forward x3.14 against x3.08.
- **Maturity term dropped.** radar-2 multiplied by 0.7–1.0 on protocol age
  (in-sample r = −0.02 against the curve residual). Out of sample it hurts
  worse: LOO x3.58, 10-fold x3.63, walk-forward x4.44.
- **Odds fitted instead of asserted.** radar-2 multiplied the flat listing
  rate (0.55) by an exp decay with a hand-picked 1095-day timescale. radar-3
  fits the decay from the listing record itself.
- **More tests, all shown.** Second walk-forward cut (2024-07-01), 10-fold
  cross-validation, the term-by-term LOO table (growth, age, quadratic,
  category intercept, Huber, trimmed), and the odds calibration table.
- **Integrity strip 6 → 10 checks** on the dashboard cover, each computed
  from the data it checks.

Terms that did not survive the blind test are dropped and the dashboard says
so, with the numbers: a per-category median multiple predicts traded market
caps worse than the curve in leave-one-out (x5.5 against x3.4), so none is
used; a quadratic curve, a shrunk category intercept, a Huber fit and a
trimmed refit all lose to plain OLS too.

## The tests (run at build time, shown on the dashboard)

- Leave-one-out over 128 comps: median error ×3.40, 32% of predictions
  within 2x of the real market cap.
- Walk-forward (fitted on tokens listed before 2025-01-01, tested on those
  listed after): median error ×3.08, 26% within 2x. Second cut
  (2024-07-01): ×3.16, 33% within 2x.
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

## Layout

- `main.ts` — the entrypoint
- `lib/model.ts` — the fitted model, the farm plans, the out-of-sample tests
- `vendor/makefun-board.ts` — the kit's dossier library, byte for byte
- `dashboard/` — the static page (no network): board, detail view, live
  anchors, model page
- `screenshots/` — the board, a protocol's detail view, and a filtered view
- `LICENSE` — MIT
