// The token radar's model, radar-3: a fitted value model, tested out of sample.
//
// radar-3 changes two things radar-2 got wrong, and both are decided by the
// tests below, not by taste:
//
//   1. The growth and maturity terms are DROPPED. radar-2 kept growth at
//      weight 0.25 (in-sample r = -0.14) and maturity at 0.7..1.0 (in-sample
//      r = -0.02 against the curve residual). Out of sample they both hurt:
//      leave-one-out median error x3.40 for the bare curve, x3.77 with
//      growth added, x3.58 with age added; 10-fold x3.57 bare against x3.58
//      with growth and x3.63 with age — no gain there either; walk-forward
//      (pre-2025 fit) x3.08 bare against x3.14 with growth and x4.44 with
//      age. A term that makes held-out predictions worse is noise, so the
//      board now ranks on the bare fitted curve times fitted token odds,
//      nothing else.
//   2. Token odds are FITTED, not asserted. radar-2 multiplied the flat
//      listing rate (0.55) by an exp decay with a hand-picked 1095-day
//      timescale. radar-3 fits a logistic regression P(listed | protocol
//      age) on the snapshot's own 645 protocols with a known age, by IRLS,
//      fresh on every run. The fitted curve is then turned into the odds
//      that an unlisted protocol of age a ever lists, by the survival
//      identity odds(a) = (pi - q(a)) / (1 - q(a)), where q(a) is the fitted
//      listed share at age a and pi is the listed share among the oldest
//      decile (the fraction that ever lists). TVL was tested as a second
//      odds input and dropped: its 5-fold log-loss and AUC are computed at
//      run time and printed on the dashboard next to the age-only model's.
//
// What stays: the size curve log(mcap) = a + b * log(TVL), least squares over
// the snapshot's own traded tokens with a known market cap (128 clean comps),
// fitted fresh on every run. A quadratic curve, a shrunk per-category
// intercept, a Huber robust fit and a trimmed refit were all fitted and
// tested too, and none of them beats plain OLS on both walk-forward cuts, so
// plain OLS stays; their leave-one-out errors are printed on the dashboard
// next to the bare curve's. Every number the board states is derived from
// the sealed snapshot at run time, never from a hand-kept list of names.
//
// The tests, run at build time and printed on the dashboard:
//   LOO          leave-one-out over the 128 comps: fit the curve without one
//                token, predict its market cap, record |log(pred/actual)|.
//   LOO+growth   the same, with the 7-day change added as a regressor.
//   LOO+age      the same, with protocol age added as a regressor.
//   walk-forward fit on tokens listed before 2025-01-01, test on those
//                listed after; and a second cut, before/after 2024-07-01.
//   10-fold      comps sorted by slug, dealt into 10 folds, each fold
//                predicted by a curve fitted on the other nine.
//   P10-P90      the 10th and 90th percentiles of the LOO residuals give a
//                prediction band per row; its coverage is measured on both
//                walk-forward test sets and on the 10-fold predictions.
//   odds-cal     the listing logit is fitted on one slug-hash half of the
//                known-age protocols and its predicted listed share is
//                compared with the actual share, per age bucket, on the
//                other half. 5-fold log-loss and AUC are reported too.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The fitted size curve: log(mcap) = intercept + slope * log(TVL). */
export interface SizeCurve {
  intercept: number;
  slope: number;
  comps: number;
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  unknown_age_days: number;
  odds_floor: number;
  odds_cap: number;
  farmer_share: number;
  gas_total_usd: number;
}

export const MODEL: ModelConstants = {
  unknown_age_days: 365,
  odds_floor: 0.05,
  odds_cap: 0.9,
  farmer_share: 0.00005,
  gas_total_usd: 12,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-3';

/** How many live-token protocols the Live anchors view carries, by market cap. */
export const LIVE_ROWS = 24;

/** The fitted listing model: P(listed | age) = sigmoid(intercept + slope * age_years). */
export interface OddsModel {
  intercept: number;
  slope_per_year: number;
  /** The listed share among the oldest decile: the fraction that ever lists. */
  pi: number;
  known_age_n: number;
  listed_n: number;
}

/** One age bucket of the odds split-half calibration check. */
export interface CalibrationBucket {
  age_lo_days: number;
  age_hi_days: number | null;
  n: number;
  predicted: number;
  actual: number;
}

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  implied_raw_usd: number;
  implied_p10_usd: number;
  implied_p90_usd: number;
  token_odds: number;
  listed_share: number;
  curve_multiple: number;
  verdict: 'FARM' | 'THIN' | 'SKIP';
  farm_cost_usd: number;
  break_even_usd: number;
  expected_receipt_usd: number;
  farm_steps: string[];
}

/** The dashboard's compact view of one row; the page generates its farm plan. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  age_days: number | null;
  implied_value_usd: number;
  implied_raw_usd: number;
  implied_p10_usd: number;
  implied_p90_usd: number;
  token_odds: number;
  listed_share: number;
  curve_multiple: number;
  verdict: 'FARM' | 'THIN' | 'SKIP';
  farm_cost_usd: number;
  break_even_usd: number;
  expected_receipt_usd: number;
  capital_usd: number;
  hold_days: number;
}

/** A live-token protocol: it already trades, so the board shows the market's own value next to what the curve would have predicted for it. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number;
  change_7d: number | null;
  curve_predicted_usd: number;
  curve_multiple: number;
}

/** The out-of-sample tests, computed at build time from the snapshot. */
export interface ModelTests {
  loo_median_factor: number;
  loo_within_2x: number;
  loo_n: number;
  loo_growth_median_factor: number;
  loo_age_median_factor: number;
  loo_quad_median_factor: number;
  loo_cat_median_factor: number;
  loo_huber_median_factor: number;
  loo_trim_median_factor: number;
  walk_median_factor: number;
  walk_within_2x: number;
  walk_train_n: number;
  walk_test_n: number;
  walk_growth_median_factor: number;
  walk_age_median_factor: number;
  walk2_median_factor: number;
  walk2_within_2x: number;
  walk2_train_n: number;
  walk2_test_n: number;
  fold_median_factor: number;
  fold_within_2x: number;
  fold_n: number;
  fold_growth_median_factor: number;
  fold_age_median_factor: number;
  p10_factor: number;
  p90_factor: number;
  p90_coverage_walk: number;
  p90_coverage_walk2: number;
  p90_coverage_fold: number;
  odds_logloss: number;
  odds_auc: number;
  odds_tvl_logloss: number;
  odds_tvl_auc: number;
  odds_calibration: CalibrationBucket[];
  odds_max_calibration_gap: number;
}

/** Everything the dashboard needs: the board, the live anchors, the fitted curve and its tests. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  curve: SizeCurve;
  odds: OddsModel;
  listing_rate: number;
  tests: ModelTests;
  watchlist_size: number;
  watchlist: string[];
  scanned: number;
  board_size: number;
  live_size: number;
  verdicts: { FARM: number; THIN: number; SKIP: number };
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Categories that mark a wrapped, staked or bridged product, never a launch of its own. */
const EXCLUDED_CATEGORIES = new Set([
  'Bridge',
  'Canonical Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
  'CEX',
]);

/** Exchange names a launch candidate's name must not start with. */
const EXCHANGE_NAMES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];

/** Whether a protocol is one the board may rank: the watchlist's own rule, without its TVL floor. */
export function isLaunchCandidate(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  const low = p.name.toLowerCase();
  if (/\bwrapped\b|\bstaked\b|\bstaking\b/.test(low)) return false;
  if (EXCHANGE_NAMES.some((e) => p.name.startsWith(e))) return false;
  return true;
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The traded tokens the curve is fitted on: a token that trades, with a positive market cap and TVL. */
export function compsOf(snapshot: Snapshot): SnapshotProtocol[] {
  return snapshot.protocols.filter(
    (p) =>
      !isPreToken(p) &&
      p.mcap_usd !== null &&
      p.mcap_usd > 0 &&
      p.tvl_usd > 0,
  );
}

/** Least squares for log(mcap) = intercept + slope * log(TVL) over the comps. */
export function fitSizeCurve(comps: SnapshotProtocol[]): SizeCurve {
  const xs = comps.map((p) => Math.log(p.tvl_usd));
  const ys = comps.map((p) => Math.log(p.mcap_usd as number));
  const n = xs.length;
  const mx = xs.reduce((s, x) => s + x, 0) / n;
  const my = ys.reduce((s, y) => s + y, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i]! - mx) * (ys[i]! - my);
    den += (xs[i]! - mx) * (xs[i]! - mx);
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = my - slope * mx;
  return { intercept, slope, comps: n };
}

/** What the fitted curve says a protocol of this TVL is worth. */
export function curveImplied(tvlUsd: number, curve: SizeCurve): number {
  return Math.exp(curve.intercept + curve.slope * Math.log(tvlUsd));
}

/** The curve's implied multiple at a TVL: the implied value divided by the TVL. */
export function curveMultiple(tvlUsd: number, curve: SizeCurve): number {
  return curveImplied(tvlUsd, curve) / tvlUsd;
}

/** The logistic function, guarded against overflow. */
export function sigmoid(z: number): number {
  if (z > 30) return 1;
  if (z < -30) return 0;
  return 1 / (1 + Math.exp(-z));
}

/** One known-age protocol for the listing logit: its age in years, its TVL, and whether it lists. */
export interface AgeRow {
  slug: string;
  age_years: number;
  tvl_usd: number;
  listed: boolean;
}

/** The known-age rows: every protocol whose listed_at parses, with its listing status. */
export function ageRowsOf(snapshot: Snapshot): AgeRow[] {
  const rows: AgeRow[] = [];
  for (const p of snapshot.protocols) {
    const a = ageDays(snapshot.as_of, p.listed_at);
    if (a === null) continue;
    rows.push({ slug: p.slug, age_years: a / 365, tvl_usd: p.tvl_usd, listed: !isPreToken(p) });
  }
  return rows;
}

/**
 * The listing logit, fitted by IRLS (Newton-Raphson) on the known-age rows:
 * P(listed | age) = sigmoid(intercept + slope * age_years). Two parameters,
 * a tiny ridge, fifty iterations at most; pure arithmetic, so deterministic.
 */
export function fitListingLogit(rows: AgeRow[]): { intercept: number; slope_per_year: number } {
  const listed = rows.filter((r) => r.listed).length;
  const p0 = rows.length === 0 ? 0.5 : listed / rows.length;
  const pc = Math.min(0.999, Math.max(0.001, p0));
  let b0 = Math.log(pc / (1 - pc));
  let b1 = 0;
  for (let iter = 0; iter < 50; iter++) {
    let g0 = 0;
    let g1 = 0;
    let h00 = 0;
    let h01 = 0;
    let h11 = 0;
    for (const r of rows) {
      const p = sigmoid(b0 + b1 * r.age_years);
      const w = p * (1 - p);
      const d = (r.listed ? 1 : 0) - p;
      g0 += d;
      g1 += d * r.age_years;
      h00 += w;
      h01 += w * r.age_years;
      h11 += w * r.age_years * r.age_years;
    }
    h00 += 1e-6;
    h11 += 1e-6;
    const det = h00 * h11 - h01 * h01;
    if (det === 0) break;
    const s0 = (h11 * g0 - h01 * g1) / det;
    const s1 = (h00 * g1 - h01 * g0) / det;
    b0 += s0;
    b1 += s1;
    if (Math.abs(s0) < 1e-10 && Math.abs(s1) < 1e-10) break;
  }
  return { intercept: b0, slope_per_year: b1 };
}

/** Solve A x = b by Gaussian elimination with partial pivoting. */
function solveLinear(aIn: number[][], bIn: number[]): number[] {
  const n = bIn.length;
  const m = aIn.map((row, i) => [...row, bIn[i]!]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r]![c]!) > Math.abs(m[piv]![c]!)) piv = r;
    const tmp = m[c]!;
    m[c] = m[piv]!;
    m[piv] = tmp;
    const pv = m[c]![c]!;
    if (pv === 0) continue;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = m[r]![c]! / pv;
      for (let j = c; j <= n; j++) m[r]![j]! -= f * m[c]![j]!;
    }
  }
  return m.map((row, i) => (row[i]! === 0 ? 0 : row[n]! / row[i]!));
}

/**
 * A generic listing logit over a feature function, fitted by IRLS
 * (Newton-Raphson): P(listed) = sigmoid(beta . features). Any number of
 * parameters, a tiny ridge, fifty iterations at most; pure arithmetic, so
 * deterministic. The age-only model above is the two-parameter special
 * case of this; the TVL test below fits three.
 */
export function fitLogitGeneric(
  rows: AgeRow[],
  feat: (r: AgeRow) => number[],
): number[] {
  const k = feat(rows[0]!).length;
  const listed = rows.filter((r) => r.listed).length;
  const p0 = rows.length === 0 ? 0.5 : listed / rows.length;
  const pc = Math.min(0.999, Math.max(0.001, p0));
  const beta: number[] = new Array<number>(k).fill(0);
  beta[0] = Math.log(pc / (1 - pc));
  for (let iter = 0; iter < 50; iter++) {
    const g: number[] = new Array<number>(k).fill(0);
    const h: number[][] = Array.from({ length: k }, () => new Array<number>(k).fill(0));
    for (const r of rows) {
      const x = feat(r);
      const p = sigmoid(beta.reduce((s, b, i) => s + b * x[i]!, 0));
      const w = p * (1 - p);
      const d = (r.listed ? 1 : 0) - p;
      for (let i = 0; i < k; i++) {
        g[i]! += d * x[i]!;
        for (let j = 0; j < k; j++) h[i]![j]! += w * x[i]! * x[j]!;
      }
    }
    for (let i = 0; i < k; i++) h[i]![i]! += 1e-6;
    const step = solveLinear(h, g);
    for (let i = 0; i < k; i++) beta[i]! += step[i]!;
    if (step.every((s) => Math.abs(s) < 1e-10)) break;
  }
  return beta;
}

/** The fitted listed share at an age in years. */
export function listedShare(ageYears: number, odds: OddsModel): number {
  return sigmoid(odds.intercept + odds.slope_per_year * ageYears);
}

/**
 * The odds a pre-token protocol of this age ever lists, from the fitted
 * listed share and pi, the listed share among the oldest decile: the
 * protocols that will ever list are pi of the population, q(a) of them have
 * listed by age a, so among the 1 - q(a) still unlisted, (pi - q(a)) will
 * list. Floored and capped by the model constants.
 */
export function tokenOdds(age: number | null, odds: OddsModel, model: ModelConstants): number {
  const a = age ?? model.unknown_age_days;
  if (odds.pi >= 0.999) return model.odds_floor;
  const q = Math.min(listedShare(a / 365, odds), odds.pi);
  const o = (odds.pi - q) / (1 - q);
  return Math.min(model.odds_cap, Math.max(model.odds_floor, o));
}

/** The odds model for a snapshot: the logit fitted on its known-age rows, pi from its oldest decile. */
export function fitOddsModel(snapshot: Snapshot): OddsModel {
  const rows = ageRowsOf(snapshot);
  const logit = fitListingLogit(rows);
  const byAge = [...rows].sort((x, y) => y.age_years - x.age_years);
  const decile = Math.max(1, Math.ceil(byAge.length / 10));
  const oldest = byAge.slice(0, decile);
  const pi = oldest.length === 0 ? 0.5 : oldest.filter((r) => r.listed).length / oldest.length;
  return {
    intercept: logit.intercept,
    slope_per_year: logit.slope_per_year,
    pi: Math.round(pi * 10000) / 10000,
    known_age_n: rows.length,
    listed_n: rows.filter((r) => r.listed).length,
  };
}

/** How much capital one farm position needs, from the protocol's own TVL. */
export function capitalFor(tvlUsd: number): number {
  if (tvlUsd >= 5_000_000_000) return 250;
  if (tvlUsd >= 1_000_000_000) return 150;
  if (tvlUsd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
export function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt token.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time.
 * The plan is derived from the protocol's own record (category, chains, TVL,
 * age), never from a hand-written list of names. The last step nets the plan:
 * the airdrop value that breaks even, the expected receipt at the assumed
 * farmer share, and the verdict.
 */
export function farmSteps(
  p: SnapshotProtocol,
  age: number | null,
  expectedUsd: number,
  model: ModelConstants,
): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p.tvl_usd);
  const hold = holdDaysFor(age);
  const cost = capital + model.gas_total_usd;
  const receipt = expectedUsd * model.farmer_share;
  const verdict = receipt >= 3 * cost ? 'FARM' : receipt >= cost ? 'THIN' : 'SKIP';
  const action = actionFor(p, capital, chain);
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `This position breaks even if the airdrop is worth at least $${cost}; at the assumed ${(model.farmer_share * 100).toFixed(3)}% farmer share the expected receipt is $${Math.max(1, Math.round(receipt))}, so the verdict is ${verdict}.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The verdict from the expected receipt against the farm's cost. */
export function verdictFor(expectedUsd: number, costUsd: number, model: ModelConstants): 'FARM' | 'THIN' | 'SKIP' {
  const receipt = expectedUsd * model.farmer_share;
  if (receipt >= 3 * costUsd) return 'FARM';
  if (receipt >= costUsd) return 'THIN';
  return 'SKIP';
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(
  snapshot: Snapshot,
  curve: SizeCurve,
  odds: OddsModel,
  p10Factor: number,
  p90Factor: number,
  model: ModelConstants = MODEL,
): BoardRow[] {
  const chosen = snapshot.protocols.filter(isLaunchCandidate);
  const scored = chosen.map((p) => {
    const age = ageDays(snapshot.as_of, p.listed_at);
    const raw = Math.max(1, Math.round(curveImplied(p.tvl_usd, curve)));
    const q = Math.min(listedShare((age ?? model.unknown_age_days) / 365, odds), odds.pi);
    const o = tokenOdds(age, odds, model);
    const expected = Math.max(1, Math.round(raw * o));
    const capital = capitalFor(p.tvl_usd);
    const cost = capital + model.gas_total_usd;
    const receipt = expected * model.farmer_share;
    const verdict = verdictFor(expected, cost, model);
    return { p, age, raw, q, odds: o, expected, capital, cost, receipt, verdict };
  });
  scored.sort((a, b) => b.expected - a.expected || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    listed_at: s.p.listed_at,
    age_days: s.age,
    implied_value_usd: s.expected,
    implied_raw_usd: s.raw,
    implied_p10_usd: Math.max(1, Math.round(s.raw * p10Factor)),
    implied_p90_usd: Math.max(1, Math.round(s.raw * p90Factor)),
    token_odds: Math.round(s.odds * 10000) / 10000,
    listed_share: Math.round(s.q * 10000) / 10000,
    curve_multiple: Math.round(curveMultiple(s.p.tvl_usd, curve) * 10000) / 10000,
    verdict: s.verdict,
    farm_cost_usd: s.cost,
    break_even_usd: s.cost,
    expected_receipt_usd: Math.max(1, Math.round(s.receipt)),
    farm_steps: farmSteps(s.p, s.age, s.expected, model).map(stepText),
  }));
}

/** The live-token protocols, by market cap, with what the curve would have predicted for each. */
export function liveRows(snapshot: Snapshot, curve: SizeCurve): LiveRow[] {
  return compsOf(snapshot)
    .sort((a, b) => (b.mcap_usd as number) - (a.mcap_usd as number) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd as number,
      change_7d: p.change_7d,
      curve_predicted_usd: Math.max(1, Math.round(curveImplied(p.tvl_usd, curve))),
      curve_multiple: Math.round(curveMultiple(p.tvl_usd, curve) * 10000) / 10000,
    }));
}

// ---- Out-of-sample tests ----

/** Least squares over a feature function: y = log(mcap), x = features(p). */
export function fitLinear(
  rows: SnapshotProtocol[],
  feat: (p: SnapshotProtocol, asOf: string) => number[],
): number[] {
  const k = feat(rows[0]!, '').length;
  const xtx: number[][] = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  const xty: number[] = new Array<number>(k).fill(0);
  for (const p of rows) {
    const x = feat(p, '');
    const y = Math.log(p.mcap_usd as number);
    for (let i = 0; i < k; i++) {
      xty[i]! += x[i]! * y;
      for (let j = 0; j < k; j++) xtx[i]![j]! += x[i]! * x[j]!;
    }
  }
  // Gaussian elimination with partial pivoting.
  const m = xtx.map((row, i) => [...row, xty[i]!]);
  for (let c = 0; c < k; c++) {
    let piv = c;
    for (let r = c + 1; r < k; r++) if (Math.abs(m[r]![c]!) > Math.abs(m[piv]![c]!)) piv = r;
    const tmp = m[c]!;
    m[c] = m[piv]!;
    m[piv] = tmp;
    const pv = m[c]![c]!;
    if (pv === 0) continue;
    for (let r = 0; r < k; r++) {
      if (r === c) continue;
      const f = m[r]![c]! / pv;
      for (let j = c; j <= k; j++) m[r]![j]! -= f * m[c]![j]!;
    }
  }
  return m.map((row, i) => (row[i]! === 0 ? 0 : row[k]! / row[i]!));
}

function dot(beta: number[], x: number[]): number {
  return beta.reduce((s, b, i) => s + b * x[i]!, 0);
}

function summarizeErrs(errs: number[]): { median_factor: number; within_2x: number; n: number } {
  const sorted = [...errs].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)]!;
  const within = errs.filter((e) => e <= Math.log(2)).length / Math.max(1, errs.length);
  return { median_factor: Math.exp(median), within_2x: within, n: errs.length };
}

/** The bare curve's features: [1, log TVL]. */
function curveFeat(p: SnapshotProtocol): number[] {
  return [1, Math.log(p.tvl_usd)];
}

/** Leave-one-out over the comps under a feature function. */
export function looTest(
  comps: SnapshotProtocol[],
  feat: (p: SnapshotProtocol, asOf: string) => number[],
): { median_factor: number; within_2x: number; n: number } {
  const errs: number[] = [];
  for (let i = 0; i < comps.length; i++) {
    const rest = comps.filter((_, j) => j !== i);
    const beta = fitLinear(rest, feat);
    const p = comps[i]!;
    errs.push(Math.abs(Math.log(p.mcap_usd as number) - dot(beta, feat(p, ''))));
  }
  return summarizeErrs(errs);
}

/** The median of a list, averaging the two middle values when the count is even. */
function medianAvg(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const n = s.length;
  if (n === 0) return 0;
  if (n % 2 === 1) return s[(n - 1) / 2]!;
  return (s[n / 2 - 1]! + s[n / 2]!) / 2;
}

/** Leave-one-out with a shrunk per-category intercept on top of the curve (categories with 5+ comps). */
export function looCatTest(comps: SnapshotProtocol[]): { median_factor: number; within_2x: number; n: number } {
  const errs: number[] = [];
  for (let i = 0; i < comps.length; i++) {
    const rest = comps.filter((_, j) => j !== i);
    const curve = fitSizeCurve(rest);
    const byCat = new Map<string, number[]>();
    for (const p of rest) {
      const r = Math.log(p.mcap_usd as number) - (curve.intercept + curve.slope * Math.log(p.tvl_usd));
      const list = byCat.get(p.category ?? '') ?? [];
      list.push(r);
      byCat.set(p.category ?? '', list);
    }
    const adj = new Map<string, number>();
    for (const [c, v] of byCat) {
      if (v.length >= 5) adj.set(c, (v.reduce((s, x) => s + x, 0) / v.length) * (v.length / (v.length + 5)));
    }
    const p = comps[i]!;
    const pred = curve.intercept + curve.slope * Math.log(p.tvl_usd) + (adj.get(p.category ?? '') ?? 0);
    errs.push(Math.abs(Math.log(p.mcap_usd as number) - pred));
  }
  return summarizeErrs(errs);
}

/** Least squares with per-row weights, for the Huber fit. */
function fitLinearWeighted(
  rows: SnapshotProtocol[],
  feat: (p: SnapshotProtocol, asOf: string) => number[],
  weights: number[],
): number[] {
  const k = feat(rows[0]!, '').length;
  const xtx: number[][] = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  const xty: number[] = new Array<number>(k).fill(0);
  for (let idx = 0; idx < rows.length; idx++) {
    const p = rows[idx]!;
    const x = feat(p, '');
    const y = Math.log(p.mcap_usd as number);
    const w = weights[idx]!;
    for (let i = 0; i < k; i++) {
      xty[i]! += w * x[i]! * y;
      for (let j = 0; j < k; j++) xtx[i]![j]! += w * x[i]! * x[j]!;
    }
  }
  const m = xtx.map((row, i) => [...row, xty[i]!]);
  for (let c = 0; c < k; c++) {
    let piv = c;
    for (let r = c + 1; r < k; r++) if (Math.abs(m[r]![c]!) > Math.abs(m[piv]![c]!)) piv = r;
    const tmp = m[c]!;
    m[c] = m[piv]!;
    m[piv] = tmp;
    const pv = m[c]![c]!;
    if (pv === 0) continue;
    for (let r = 0; r < k; r++) {
      if (r === c) continue;
      const f = m[r]![c]! / pv;
      for (let j = c; j <= k; j++) m[r]![j]! -= f * m[c]![j]!;
    }
  }
  return m.map((row, i) => (row[i]! === 0 ? 0 : row[k]! / row[i]!));
}

/** The Huber robust curve: iteratively reweighted least squares, k = 1.345 * MAD scale. */
export function huberFit(rows: SnapshotProtocol[]): number[] {
  let beta = fitLinear(rows, (p) => curveFeat(p));
  for (let iter = 0; iter < 8; iter++) {
    const r = rows.map((p) => Math.log(p.mcap_usd as number) - dot(beta, curveFeat(p)));
    const med = medianAvg(r);
    const s = 1.4826 * medianAvg(r.map((v) => Math.abs(v - med))) || 1;
    const k = 1.345 * s;
    const w = r.map((v) => (Math.abs(v) <= k ? 1 : k / Math.abs(v)));
    beta = fitLinearWeighted(rows, (p) => curveFeat(p), w);
  }
  return beta;
}

/** Leave-one-out of the Huber robust curve. */
export function looHuberTest(comps: SnapshotProtocol[]): { median_factor: number; within_2x: number; n: number } {
  const errs: number[] = [];
  for (let i = 0; i < comps.length; i++) {
    const rest = comps.filter((_, j) => j !== i);
    const beta = huberFit(rest);
    const p = comps[i]!;
    errs.push(Math.abs(Math.log(p.mcap_usd as number) - dot(beta, curveFeat(p))));
  }
  return summarizeErrs(errs);
}

/** Leave-one-out of a trimmed refit: drop comps beyond 2 residual SDs once, then refit. */
export function looTrimTest(comps: SnapshotProtocol[]): { median_factor: number; within_2x: number; n: number } {
  const errs: number[] = [];
  for (let i = 0; i < comps.length; i++) {
    const rest = comps.filter((_, j) => j !== i);
    const curve0 = fitSizeCurve(rest);
    const r0 = rest.map((p) => Math.log(p.mcap_usd as number) - (curve0.intercept + curve0.slope * Math.log(p.tvl_usd)));
    const mean = r0.reduce((s, x) => s + x, 0) / r0.length;
    const sd = Math.sqrt(r0.reduce((s, x) => s + (x - mean) * (x - mean), 0) / r0.length);
    const kept = rest.filter((_, j) => Math.abs(r0[j]!) <= 2 * sd);
    const curve = fitSizeCurve(kept.length > 0 ? kept : rest);
    const p = comps[i]!;
    errs.push(Math.abs(Math.log(p.mcap_usd as number) - (curve.intercept + curve.slope * Math.log(p.tvl_usd))));
  }
  return summarizeErrs(errs);
}

/** Walk-forward median error under a feature function: fit before the cut, test after. */
export function walkForwardFeat(
  comps: SnapshotProtocol[],
  cut: string,
  feat: (p: SnapshotProtocol, asOf: string) => number[],
): number {
  const train = comps.filter((p) => p.listed_at !== null && p.listed_at < cut);
  const test = comps.filter((p) => p.listed_at !== null && p.listed_at >= cut);
  const beta = fitLinear(train, feat);
  const errs = test.map((p) => Math.abs(Math.log(p.mcap_usd as number) - dot(beta, feat(p, ''))));
  return summarizeErrs(errs).median_factor;
}

/** 10-fold median error under a feature function: comps sorted by slug, dealt into 10 folds. */
export function foldFeat(
  comps: SnapshotProtocol[],
  feat: (p: SnapshotProtocol, asOf: string) => number[],
): number {
  const sorted = [...comps].sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  const errs: number[] = [];
  for (let f = 0; f < 10; f++) {
    const test = sorted.filter((_, i) => i % 10 === f);
    const train = sorted.filter((_, i) => i % 10 !== f);
    const beta = fitLinear(train, feat);
    for (const p of test) errs.push(Math.abs(Math.log(p.mcap_usd as number) - dot(beta, feat(p, ''))));
  }
  return summarizeErrs(errs).median_factor;
}

/** Leave-one-out residuals of the bare curve, in log space, sorted. */
export function looResiduals(comps: SnapshotProtocol[]): number[] {
  const errs: number[] = [];
  for (let i = 0; i < comps.length; i++) {
    const rest = comps.filter((_, j) => j !== i);
    const curve = fitSizeCurve(rest);
    const p = comps[i]!;
    errs.push(Math.log(p.mcap_usd as number) - (curve.intercept + curve.slope * Math.log(p.tvl_usd)));
  }
  return errs.sort((a, b) => a - b);
}

/** Walk-forward: fit on tokens listed before the cut, test on those listed after. */
export function walkForwardTest(
  comps: SnapshotProtocol[],
  cut: string,
): { median_factor: number; within_2x: number; train_n: number; test_n: number } {
  const train = comps.filter((p) => p.listed_at !== null && p.listed_at < cut);
  const test = comps.filter((p) => p.listed_at !== null && p.listed_at >= cut);
  const curve = fitSizeCurve(train);
  const errs = test.map((p) => Math.abs(Math.log(p.mcap_usd as number) - (curve.intercept + curve.slope * Math.log(p.tvl_usd))));
  const s = summarizeErrs(errs);
  return { median_factor: s.median_factor, within_2x: s.within_2x, train_n: train.length, test_n: test.length };
}

/** Walk-forward coverage of the shipped P10-P90 band on the test tokens. */
export function walkCoverage(
  comps: SnapshotProtocol[],
  cut: string,
  q10: number,
  q90: number,
): number {
  const train = comps.filter((p) => p.listed_at !== null && p.listed_at < cut);
  const test = comps.filter((p) => p.listed_at !== null && p.listed_at >= cut);
  if (test.length === 0) return 0;
  const curve = fitSizeCurve(train);
  let hit = 0;
  for (const p of test) {
    const r = Math.log(p.mcap_usd as number) - (curve.intercept + curve.slope * Math.log(p.tvl_usd));
    if (r >= q10 && r <= q90) hit++;
  }
  return hit / test.length;
}

/** 10-fold cross-validation: comps sorted by slug, dealt into 10 folds. */
export function foldTest(comps: SnapshotProtocol[]): { median_factor: number; within_2x: number; n: number; coverage: number; q10: number; q90: number } {
  const sorted = [...comps].sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  const resid = looResiduals(comps);
  const q10 = resid[Math.floor(0.1 * resid.length)]!;
  const q90 = resid[Math.floor(0.9 * resid.length)]!;
  const errs: number[] = [];
  let hit = 0;
  let total = 0;
  for (let f = 0; f < 10; f++) {
    const test = sorted.filter((_, i) => i % 10 === f);
    const train = sorted.filter((_, i) => i % 10 !== f);
    const curve = fitSizeCurve(train);
    for (const p of test) {
      const r = Math.log(p.mcap_usd as number) - (curve.intercept + curve.slope * Math.log(p.tvl_usd));
      errs.push(Math.abs(r));
      total++;
      if (r >= q10 && r <= q90) hit++;
    }
  }
  const s = summarizeErrs(errs);
  return { median_factor: s.median_factor, within_2x: s.within_2x, n: s.n, coverage: total === 0 ? 0 : hit / total, q10, q90 };
}

/** A deterministic slug hash split: even sums go to half A, odd sums to half B. */
function slugParity(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h += slug.charCodeAt(i);
  return h % 2;
}

const CAL_BUCKETS: [number, number | null][] = [
  [0, 180],
  [180, 365],
  [365, 730],
  [730, 1095],
  [1095, 1460],
  [1460, null],
];

/** The odds split-half calibration: fit the logit on half A, check it on half B per age bucket. */
export function oddsCalibration(snapshot: Snapshot): CalibrationBucket[] {
  const rows = ageRowsOf(snapshot);
  const a = rows.filter((r) => slugParity(r.slug) === 0);
  const b = rows.filter((r) => slugParity(r.slug) === 1);
  const logit = fitListingLogit(a);
  return CAL_BUCKETS.map(([lo, hi]) => {
    const sel = b.filter((r) => r.age_years * 365 >= lo && (hi === null || r.age_years * 365 < hi));
    const predicted = sel.length === 0 ? 0 : sel.reduce((s, r) => s + sigmoid(logit.intercept + logit.slope_per_year * r.age_years), 0) / sel.length;
    const actual = sel.length === 0 ? 0 : sel.filter((r) => r.listed).length / sel.length;
    return {
      age_lo_days: lo,
      age_hi_days: hi,
      n: sel.length,
      predicted: Math.round(predicted * 1000) / 1000,
      actual: Math.round(actual * 1000) / 1000,
    };
  });
}

/** 5-fold log-loss and AUC of a listing logit under a feature function: rows sorted by slug, dealt into 5 folds. */
export function logitSkill(
  rowsIn: AgeRow[],
  feat: (r: AgeRow) => number[],
): { logloss: number; auc: number } {
  const rows = [...rowsIn].sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  let llSum = 0;
  let llN = 0;
  const scored: { p: number; listed: boolean }[] = [];
  for (let f = 0; f < 5; f++) {
    const test = rows.filter((_, i) => i % 5 === f);
    const train = rows.filter((_, i) => i % 5 !== f);
    const beta = fitLogitGeneric(train, feat);
    for (const r of test) {
      const p = Math.min(0.999, Math.max(0.001, sigmoid(beta.reduce((s, b, i) => s + b * feat(r)[i]!, 0))));
      llSum += r.listed ? -Math.log(p) : -Math.log(1 - p);
      llN++;
      scored.push({ p, listed: r.listed });
    }
  }
  const pos = scored.filter((s) => s.listed);
  const neg = scored.filter((s) => !s.listed);
  let wins = 0;
  for (const a of pos) {
    for (const b of neg) {
      if (a.p > b.p) wins += 1;
      else if (a.p === b.p) wins += 0.5;
    }
  }
  return {
    logloss: llN === 0 ? 0 : Math.round((llSum / llN) * 1000) / 1000,
    auc: pos.length === 0 || neg.length === 0 ? 0.5 : Math.round((wins / (pos.length * neg.length)) * 1000) / 1000,
  };
}

/** 5-fold log-loss and AUC of the listing logit (age only). */
export function oddsSkill(snapshot: Snapshot): { logloss: number; auc: number } {
  return logitSkill(ageRowsOf(snapshot), (r) => [1, r.age_years]);
}

/**
 * 5-fold log-loss and AUC of the listing logit with TVL added as a second
 * input. The shipped odds use age only because this test shows TVL adds
 * nothing; the numbers are printed on the dashboard next to the age-only
 * ones so the decision can be checked.
 */
export function oddsSkillTVL(snapshot: Snapshot): { logloss: number; auc: number } {
  return logitSkill(ageRowsOf(snapshot), (r) => [1, r.age_years, Math.log10(Math.max(r.tvl_usd, 1))]);
}

/** The out-of-sample tests for the fitted curve and the fitted odds. */
export function modelTests(snapshot: Snapshot): ModelTests {
  const comps = compsOf(snapshot);
  const asOf = snapshot.as_of;
  const loo = looTest(comps, (p) => curveFeat(p));
  const looGrowth = looTest(comps, (p) => [1, Math.log(p.tvl_usd), p.change_7d ?? 0]);
  const looAge = looTest(comps, (p) => [1, Math.log(p.tvl_usd), (ageDays(asOf, p.listed_at) ?? 365) / 365]);
  const looQuad = looTest(comps, (p) => [1, Math.log(p.tvl_usd), Math.log(p.tvl_usd) * Math.log(p.tvl_usd)]);
  const looCat = looCatTest(comps);
  const looHuber = looHuberTest(comps);
  const looTrim = looTrimTest(comps);
  const walk = walkForwardTest(comps, '2025-01-01');
  const walk2 = walkForwardTest(comps, '2024-07-01');
  const walkGrowth = walkForwardFeat(comps, '2025-01-01', (p) => [1, Math.log(p.tvl_usd), p.change_7d ?? 0]);
  const walkAge = walkForwardFeat(comps, '2025-01-01', (p) => [1, Math.log(p.tvl_usd), (ageDays(asOf, p.listed_at) ?? 365) / 365]);
  const foldGrowth = foldFeat(comps, (p) => [1, Math.log(p.tvl_usd), p.change_7d ?? 0]);
  const foldAge = foldFeat(comps, (p) => [1, Math.log(p.tvl_usd), (ageDays(asOf, p.listed_at) ?? 365) / 365]);
  const resid = looResiduals(comps);
  const q10 = resid[Math.floor(0.1 * resid.length)]!;
  const q90 = resid[Math.floor(0.9 * resid.length)]!;
  const fold = foldTest(comps);
  const calibration = oddsCalibration(snapshot);
  const skill = oddsSkill(snapshot);
  const skillTVL = oddsSkillTVL(snapshot);
  const maxGap = Math.max(0, ...calibration.map((c) => Math.abs(c.predicted - c.actual)));
  return {
    loo_median_factor: Math.round(loo.median_factor * 100) / 100,
    loo_within_2x: Math.round(loo.within_2x * 1000) / 1000,
    loo_n: loo.n,
    loo_growth_median_factor: Math.round(looGrowth.median_factor * 100) / 100,
    loo_age_median_factor: Math.round(looAge.median_factor * 100) / 100,
    loo_quad_median_factor: Math.round(looQuad.median_factor * 100) / 100,
    loo_cat_median_factor: Math.round(looCat.median_factor * 100) / 100,
    loo_huber_median_factor: Math.round(looHuber.median_factor * 100) / 100,
    loo_trim_median_factor: Math.round(looTrim.median_factor * 100) / 100,
    walk_median_factor: Math.round(walk.median_factor * 100) / 100,
    walk_within_2x: Math.round(walk.within_2x * 1000) / 1000,
    walk_train_n: walk.train_n,
    walk_test_n: walk.test_n,
    walk_growth_median_factor: Math.round(walkGrowth * 100) / 100,
    walk_age_median_factor: Math.round(walkAge * 100) / 100,
    walk2_median_factor: Math.round(walk2.median_factor * 100) / 100,
    walk2_within_2x: Math.round(walk2.within_2x * 1000) / 1000,
    walk2_train_n: walk2.train_n,
    walk2_test_n: walk2.test_n,
    fold_median_factor: Math.round(fold.median_factor * 100) / 100,
    fold_within_2x: Math.round(fold.within_2x * 1000) / 1000,
    fold_n: fold.n,
    fold_growth_median_factor: Math.round(foldGrowth * 100) / 100,
    fold_age_median_factor: Math.round(foldAge * 100) / 100,
    p10_factor: Math.round(Math.exp(q10) * 100) / 100,
    p90_factor: Math.round(Math.exp(q90) * 100) / 100,
    p90_coverage_walk: Math.round(walkCoverage(comps, '2025-01-01', q10, q90) * 1000) / 1000,
    p90_coverage_walk2: Math.round(walkCoverage(comps, '2024-07-01', q10, q90) * 1000) / 1000,
    p90_coverage_fold: Math.round(fold.coverage * 1000) / 1000,
    odds_logloss: skill.logloss,
    odds_auc: skill.auc,
    odds_tvl_logloss: skillTVL.logloss,
    odds_tvl_auc: skillTVL.auc,
    odds_calibration: calibration,
    odds_max_calibration_gap: Math.round(maxGap * 1000) / 1000,
  };
}

/** A board row's compact form for data.js; the page generates its farm plan. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    implied_raw_usd: row.implied_raw_usd,
    implied_p10_usd: row.implied_p10_usd,
    implied_p90_usd: row.implied_p90_usd,
    token_odds: row.token_odds,
    listed_share: row.listed_share,
    curve_multiple: row.curve_multiple,
    verdict: row.verdict,
    farm_cost_usd: row.farm_cost_usd,
    break_even_usd: row.break_even_usd,
    expected_receipt_usd: row.expected_receipt_usd,
    capital_usd: capitalFor(row.tvl_usd),
    hold_days: holdDaysFor(row.age_days),
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData; curve: SizeCurve; listingRate: number; odds: OddsModel } {
  const comps = compsOf(snapshot);
  const curve = fitSizeCurve(comps);
  const odds = fitOddsModel(snapshot);
  const tests = modelTests(snapshot);
  const listingRate = snapshot.protocols.filter((p) => !isPreToken(p)).length / snapshot.protocols.length;
  const board = buildBoard(snapshot, curve, odds, tests.p10_factor, tests.p90_factor, model);
  const live = liveRows(snapshot, curve);
  const verdicts = { FARM: 0, THIN: 0, SKIP: 0 };
  for (const r of board) verdicts[r.verdict]++;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    curve,
    odds,
    listing_rate: Math.round(listingRate * 10000) / 10000,
    tests,
    watchlist_size: snapshot.watchlist.length,
    watchlist: snapshot.watchlist,
    scanned: snapshot.protocols.length,
    board_size: board.length,
    live_size: live.length,
    verdicts,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar, curve, listingRate, odds };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
    if (!Number.isSafeInteger(r.implied_p10_usd) || r.implied_p10_usd <= 0) return `${r.slug} has P10 ${r.implied_p10_usd}`;
    if (!Number.isSafeInteger(r.implied_p90_usd) || r.implied_p90_usd < r.implied_p10_usd) return `${r.slug} has P90 ${r.implied_p90_usd} below P10`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
