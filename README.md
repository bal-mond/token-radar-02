# Token Launch Radar — radar-2

[![make.fun](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/bal-mond/token-radar-02/rank.svg)](https://make.fun/bounty/token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/bal-mond/token-radar-02/reward.svg)](https://make.fun/bounty/token-radar-01)

A token launch radar for the [make.fun bounty](https://make.fun/bounty/token-radar-01):
it reads a sealed snapshot of every protocol DefiLlama tracks, works out which
ones still record no token, and ranks them by what their launch would be worth —
then hands in a web dashboard with the board, a detail view for each protocol,
and the steps to farm it.

## The model (radar-2)

Every number is derived from the sealed snapshot at run time, never from a
hand-kept list of names:

- **Size curve, fitted.** `log(market cap) = a + b · log(TVL)`, least squares
  over the snapshot's own traded tokens with a known market cap (128 clean
  comps). The curve is fitted fresh on every run.
- **Growth, down-weighted.** The 7-day change, clamped to −60%…+120%, at
  weight 0.25 — small on purpose, because in-sample growth barely predicts a
  traded token's multiple (r = −0.14).
- **Maturity.** Longer-running with no token counts for more, up to a cap.
- **Token odds.** The snapshot's own listing rate (416 of 758 record a token),
  decayed with no-token age. A protocol that has run years with no token has
  shown it is less likely ever to list.
- **Expected value = implied × odds.** The board ranks by expected value.

Terms that did not survive the blind test are dropped and the dashboard says
so: a per-category median multiple predicts traded market caps worse than the
curve in leave-one-out, so none is used.

## The tests (run at build time, shown on the dashboard)

- Leave-one-out over 128 comps: median error ×3.4, 32% of predictions within
  2x of the real market cap.
- Walk-forward (fitted on tokens listed before 2025-01-01, tested on those
  listed after): median error ×3.1, 26% within 2x.

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
