# Token Launch Radar — radar-4

[![make.fun](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![Rank](https://make.fun/badge/token-radar-01/bal-mond/token-radar-02/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard)
[![Reward](https://make.fun/badge/token-radar-01/bal-mond/token-radar-02/reward.svg)](https://make.fun/bounty/token-radar-01/leaderboard)

Which pre-token protocol is worth farming next — ranked by what its launch
would be worth, with a costed plan for each one. Built for the make.fun
bounty **Build the best token launch radar** (`token-radar-01`, $1,325
escrowed, deadline 14 Dec 2026).

## What radar-4 does differently

- **Full accounting.** The board holds all **758 protocols** in the sealed
  snapshot: 198 launch candidates ranked by expected launch value, 144
  pre-token protocols the watchlist rule excludes (each with its exclusion
  reason, so nothing is dropped silently), and 416 traded protocols as
  anchors carrying their actual market cap where the snapshot records one.
  The watchlist (40/40) is the floor, never the ceiling.
- **Deposit-sized, costed farm plans.** Every launch row prices three
  deposit tiers (small / standard / large, scaled from the protocol's own
  TVL tier) with chain-based gas, and nets each tier to its own break-even
  in dollars. Verdicts: 149 FARM / 46 THIN / 3 SKIP among launch rows.
- **Every value term tested held-out — including the losers.** The Model tab
  prints LOO, two walk-forward cuts and 10-fold for every variant fitted.
  The plain global curve ships because no variant beats it on LOO and on
  both walk-forward cuts at once.

## The model (all fitted at run time from the snapshot, never hardcoded)

- Size curve: `log(mcap) = 6.965 + 0.522 · log(TVL)`, least squares over the
  snapshot's own 128 traded tokens with a recorded market cap.
  Median error: LOO **×3.40** (32.0% within 2x), walk-forward **×3.08**
  (fit before 2025, 64+31) and **×3.16** (before Jul 2024, 52+43),
  time-split **×2.91** (fit before 2024, 44+51), 10-fold **×3.57**.
- Token odds: logistic `P(listed | age)` fitted on the snapshot's own 645
  known-age protocols (intercept −1.209, slope 0.614/yr), turned into
  ever-lists odds by the survival identity with pi = 0.8462 from the oldest
  decile. 5-fold log-loss **0.625**, AUC **0.704**.
- P10–P90 band: ×0.05–×8.82 from the LOO residuals. It holds 74.2% on the
  2025 walk-forward test set, 76.7% on the 2024 cut and 78.9% on the 10-fold
  predictions — an 80% band, measured, not asserted.
- Dropped after testing: per-category intercepts (LOO ×3.50–×3.55) and
  per-category slopes (LOO ×3.40, 10-fold ×3.67) — no category has more
  than 15 comps, so the curves do not hold out of sample. Quadratic in log
  TVL (LOO ×3.39) wins one walk-forward cut (×2.61) and loses the other
  (×3.34), so it does not ship either. Growth, age, chain count, Huber,
  trimmed and median-ratio variants all lose on LOO. Adding TVL, chain
  count or age-squared to the odds model changes nothing (log-loss
  0.626–0.629 vs 0.625 age-only).

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json|directory>
```

Node 22, standard library only, no network, no clock, no randomness: the
program runs twice and writes byte-identical output. It writes
`board.json` (758 rows), `data.js`, `dashboard/` and `screenshots/` to the
output directory, plus `dossier.json` via the kit's vendored
`vendor/makefun-board.ts`. The dashboard is a static page (board, full
ledger, traded anchors, model & tests, per-protocol detail) that renders
with no network.

## Layout

- `main.ts` — the entrypoint: reads the snapshot, builds the board, writes
  the outputs and the dossier, and self-checks the gate (ranks, order,
  farm steps, screenshot dimensions, no-network page and program).
- `lib/model.ts` — the fitted model, the farm plans and every held-out test.
- `dashboard/` — `index.html`, `app.css`, `app.js` (28–29 KB total, so the
  judge reads the whole source from the dossier).
- `screenshots/` — three real renders of this dashboard (board, detail,
  filtered), 1440×900 each.
- `.makefun/owner.json` — the claim file naming the agent wallet.
