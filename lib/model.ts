// Token Launch Radar, radar-4: the whole ledger, fitted and tested held-out.
//
// What radar-4 changes, and why — every change below is decided by a test
// run at build time from the sealed snapshot, never by taste:
//
//   1. FULL ACCOUNTING. radar-2/3 ranked only the 198 launch candidates.
//      radar-4's board holds all 758 protocols in the snapshot: the 198
//      launch candidates ranked by expected launch value, the 144 pre-token
//      protocols the watchlist rule excludes (each with its exclusion
//      reason), and the 416 traded protocols as anchors carrying their
//      actual market cap where the snapshot records one (128 of them) or
//      the curve's estimate where it does not. The dashboard's Ledger view
//      shows every protocol accounted for; the Launch view is the board
//      the bounty asks for.
//   2. DEPOSIT-SIZED, COSTED FARM PLANS. radar-3 costed one deposit size.
//      radar-4 prices three tiers per launch row (small / standard /
//      large, scaled from the protocol's own TVL tier) with chain-based
//      gas, and nets each tier to its own break-even in dollars. The
//      verdict still comes from the standard tier: expected receipt at the
//      assumed farmer share against the tier's cost.
//   3. EVERY VALUE TERM TESTED, AND THE LOSERS SHOWN. The model page
//      prints the held-out numbers for every variant fitted — quadratic,
//      per-category intercepts and slopes, chain count, growth, age,
//      piecewise, Huber, trimmed, weighted, median-ratio — with LOO,
//      two walk-forward cuts and 10-fold each. The shipped model is the
//      plain global log-log curve because no variant beats it on LOO
//      (x3.40) and on both walk-forward cuts at once; the per-category
//      curves the leaders' titles suggest lose out-of-sample here
//      (LOO x3.50-x3.70) because no category has more than 15 comps.
//      The odds model is the same story: age only (5-fold log-loss
//      0.625, AUC 0.704) beats adding TVL, chain count or age squared.
//
// What stays from radar-3, because the tests kept it: the size curve
// log(mcap) = a + b * log(TVL), least squares over the snapshot's own
// traded tokens with a known market cap (128 clean comps), fitted fresh
// on every run; the fitted logistic token odds P(listed | age) from the
// snapshot's own 645 known-age protocols, turned into ever-lists odds by
// the survival identity; P10-P90 bands from the LOO residuals, with
// their coverage measured on both walk-forward test sets and on the
// 10-fold predictions. Growth and age as value terms stay dropped:
// they make held-out predictions worse. Every number the board states
// is derived from the sealed snapshot at run time, never from a
// hand-kept list of names.

/** One protocol entry: exactly the ten fields the sealed input carries. */
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
  gas_ethereum_usd: number;
  gas_other_usd: number;
  traded_season_share: number;
}

export const MODEL: ModelConstants = {
  unknown_age_days: 365,
  odds_floor: 0.05,
  odds_cap: 0.9,
  farmer_share: 0.00005,
  gas_ethereum_usd: 20,
  gas_other_usd: 6,
  traded_season_share: 0.0002,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-4';

/** How many traded anchors the Anchors view carries, by market cap. */
export const LIVE_ROWS = 40;

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

/** One held-out score for one value-model variant. */
export interface VariantScore {
  name: string;
  loo: number;
  walk2025: number;
  walk2024: number;
  fold: number;
  shipped: boolean;
}

/** One held-out score for one odds-model variant. */
export interface OddsVariantScore {
  name: string;
  logloss: number;
  auc: number;
  shipped: boolean;
}

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One deposit tier of a launch farm plan: its capital, its gas, its break-even. */
export interface FarmTier {
  label: string;
  capital_usd: number;
  gas_usd: number;
  cost_usd: number;
  break_even_usd: number;
}

/** Where a protocol sits in the ledger. */
export type BoardStatus = 'launch' | 'excluded' | 'traded';

/** One row of board.json: all 758 protocols, ranked by board value. */
export interface BoardRow {
  rank: number;
  launch_rank: number | null;
  slug: string;
  name: string;
  status: BoardStatus;
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
  mcap_usd: number | null;
  curve_predicted_usd: number;
  curve_multiple: number;
  token_odds: number;
  listed_share: number;
  verdict: 'FARM' | 'THIN' | 'SKIP';
  farm_cost_usd: number;
  break_even_usd: number;
  expected_receipt_usd: number;
  capital_usd: number;
  hold_days: number;
  exclusion_reason: string | null;
  farm_tiers: FarmTier[];
  farm_steps: string[];
}

/** The dashboard's compact view of one row. */
export interface RadarRow {
  rank: number;
  launch_rank: number | null;
  slug: string;
  name: string;
  status: BoardStatus;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  age_days: number | null;
  implied_value_usd: number;
  implied_raw_usd: number;
  implied_p10_usd: number;
  implied_p90_usd: number;
  mcap_usd: number | null;
  curve_predicted_usd: number;
  curve_multiple: number;
  token_odds: number;
  listed_share: number;
  verdict: 'FARM' | 'THIN' | 'SKIP';
  farm_cost_usd: number;
  break_even_usd: number;
  expected_receipt_usd: number;
  capital_usd: number;
  hold_days: number;
  exclusion_reason: string | null;
  farm_tiers: FarmTier[];
  farm_steps: string[];
}

/** A traded protocol as an anchor: the market's own value next to the curve's. */
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
  walk_median_factor: number;
  walk_within_2x: number;
  walk_train_n: number;
  walk_test_n: number;
  walk2_median_factor: number;
  walk2_within_2x: number;
  walk2_train_n: number;
  walk2_test_n: number;
  time_split_median_factor: number;
  time_split_train_n: number;
  time_split_test_n: number;
  time_split_quad_median_factor: number;
  fold_median_factor: number;
  fold_within_2x: number;
  fold_n: number;
  p10_factor: number;
  p90_factor: number;
  p90_coverage_walk: number;
  p90_coverage_walk2: number;
  p90_coverage_fold: number;
  odds_logloss: number;
  odds_auc: number;
  odds_calibration: CalibrationBucket[];
  odds_max_calibration_gap: number;
  variants: VariantScore[];
  odds_variants: OddsVariantScore[];
}

/** One build-time integrity check, with its evidence. */
export interface IntegrityCheck {
  name: string;
  pass: boolean;
  detail: string;
}

/** Everything the dashboard needs. */
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
  counts: { launch: number; excluded: number; traded: number; comps: number };
  verdicts: { FARM: number; THIN: number; SKIP: number };
  launch_verdicts: { FARM: number; THIN: number; SKIP: number };
  checks: IntegrityCheck[];
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

/**
 * Why a pre-token protocol is not a launch candidate, or null when it is
 * one: the watchlist's own rule, without its TVL floor, stated per row so
 * the Ledger can show the reason instead of silently dropping the row.
 */
export function exclusionReason(p: SnapshotProtocol): string | null {
  if (!isPreToken(p)) return null;
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) {
    return `Category ${p.category}: a wrapped, staked or bridged product, not a launch of its own.`;
  }
  if (VERSIONED.test(p.name)) return 'Name ends in a version marker: a pool of another protocol.';
  const low = p.name.toLowerCase();
  if (/\bwrapped\b/.test(low)) return 'Name carries "wrapped": a wrapped product of a token that trades.';
  if (/\bstaked\b|\bstaking\b/.test(low)) return 'Name carries "staked" or "staking": a staked product of a token that trades.';
  const ex = EXCHANGE_NAMES.find((e) => p.name.startsWith(e));
  if (ex !== undefined) return `Name starts with ${ex}: an exchange product, not a launch of its own.`;
  return null;
}

/** Whether a protocol is one the board may rank as a launch: the watchlist's own rule, without its TVL floor. */
export function isLaunchCandidate(p: SnapshotProtocol): boolean {
  return exclusionReason(p) === null;
}

/** The traded tokens the curve is fitted on: a token that trades, with a positive market cap and TVL. */
export function compsOf(snapshot: Snapshot): SnapshotProtocol[] {
  return snapshot.protocols.filter(
    (p) => !isPreToken(p) && p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0,
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
  chains_n: number;
  listed: boolean;
}

/** The known-age rows: every protocol whose listed_at parses, with its listing status. */
export function ageRowsOf(snapshot: Snapshot): AgeRow[] {
  const rows: AgeRow[] = [];
  for (const p of snapshot.protocols) {
    const a = ageDays(snapshot.as_of, p.listed_at);
    if (a === null) continue;
    rows.push({ slug: p.slug, age_years: a / 365, tvl_usd: p.tvl_usd, chains_n: p.chains.length, listed: !isPreToken(p) });
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

/** Solve A x = b by Gauss-Jordan with partial pivoting. */
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
 * A generic listing logit over a feature function, fitted by IRLS:
 * P(listed) = sigmoid(beta . features). Any number of parameters, a tiny
 * ridge, fifty iterations at most; pure arithmetic, so deterministic.
 */
export function fitLogitGeneric(rows: AgeRow[], feat: (r: AgeRow) => number[]): number[] {
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

/** The standard deposit for one farm position, from the protocol's own TVL. */
export function capitalFor(tvlUsd: number): number {
  if (tvlUsd >= 5_000_000_000) return 250;
  if (tvlUsd >= 1_000_000_000) return 150;
  if (tvlUsd >= 100_000_000) return 100;
  return 50;
}

/** The three deposit tiers of a farm plan: small, standard and large. */
export function farmTiers(tvlUsd: number, chain: string, model: ModelConstants): FarmTier[] {
  const gas = chain === 'Ethereum' ? model.gas_ethereum_usd : model.gas_other_usd;
  const standard = capitalFor(tvlUsd);
  const caps = [Math.max(25, Math.round(standard / 2)), standard, Math.min(500, standard * 2)];
  const labels = ['Small', 'Standard', 'Large'];
  return caps.map((capital, i) => ({
    label: labels[i]!,
    capital_usd: capital,
    gas_usd: gas,
    cost_usd: capital + gas,
    break_even_usd: capital + gas,
  }));
}

/** The gas a farm position pays in total, from the protocol's first chain. */
export function gasFor(p: SnapshotProtocol, model: ModelConstants): number {
  return (p.chains[0] ?? '') === 'Ethereum' ? model.gas_ethereum_usd : model.gas_other_usd;
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
 * A launch candidate's farm plan: six steps, each an action with a cost and
 * a time, priced in three deposit tiers. The plan is derived from the
 * protocol's own record (category, chains, TVL, age), never from a
 * hand-written list of names. The last step nets the plan: the break-even
 * of each tier, the expected receipt at the assumed farmer share, and the
 * verdict.
 */
export function farmStepsLaunch(
  p: SnapshotProtocol,
  age: number | null,
  expectedUsd: number,
  model: ModelConstants,
): FarmStep[] {
  const chain = chainOf(p);
  const tiers = farmTiers(p.tvl_usd, chain, model);
  const standard = tiers[1]!;
  const hold = holdDaysFor(age);
  const receipt = expectedUsd * model.farmer_share;
  const verdict = receipt >= 3 * standard.cost_usd ? 'FARM' : receipt >= standard.cost_usd ? 'THIN' : 'SKIP';
  const weeklyGas = chain === 'Ethereum' ? 4 : 1;
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: `${actionFor(p, standard.capital_usd, chain)} Small $${tiers[0]!.capital_usd}, standard $${standard.capital_usd}, large $${tiers[2]!.capital_usd}.`,
      cost: `$${standard.capital_usd} of capital and about $${standard.gas_usd} of gas at the standard tier`,
      time: '15 minutes to set up',
    },
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`,
      cost: `about $${weeklyGas} of gas a week`,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${standard.capital_usd} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Netted: small breaks even at $${tiers[0]!.break_even_usd}, standard at $${standard.break_even_usd}, large at $${tiers[2]!.break_even_usd}; at the assumed ${(model.farmer_share * 100).toFixed(3)}% farmer share the expected receipt is $${Math.max(1, Math.round(receipt))}, so the verdict is ${verdict}.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/**
 * A traded protocol's plan: the token already trades, so there is no launch
 * to farm. The plan is about providing liquidity and collecting the
 * protocol's ongoing incentives, costed the same way, with the call taken
 * from how the token trades against the comps curve.
 */
export function farmStepsTraded(
  p: SnapshotProtocol,
  age: number | null,
  multiple: number,
  model: ModelConstants,
): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p.tvl_usd);
  const gas = gasFor(p, model);
  const hold = holdDaysFor(age);
  const hasMcap = p.mcap_usd !== null && p.mcap_usd > 0;
  const verdict = hasMcap ? (multiple < 0.7 ? 'FARM' : multiple <= 1.5 ? 'THIN' : 'SKIP') : 'THIN';
  const last = hasMcap
    ? `The token trades at ${multiple.toFixed(2)}x the comps curve, so the call is ${verdict}: it pays only if 30 days of fees and incentives beat the $${gas} of gas.`
    : `No market cap is recorded for this token, so the radar states no multiple and the call is ${verdict}: it pays only if 30 days of fees and incentives beat the $${gas} of gas.`;
  return [
    {
      text: `${p.name} already trades, so there is no launch to farm here; the plan below is for its ongoing incentives, not an airdrop.`,
      cost: 'nothing to check',
      time: '5 minutes',
    },
    {
      text: `${actionFor(p, capital, chain)}`,
      cost: `$${capital} of capital and about $${gas} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: `Check the protocol's rewards page each week and claim only incentives it lists there.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days, then compare the fees and incentives you collected with the $${capital + gas} the position cost.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: last,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/**
 * An excluded pre-token protocol's plan: it records no token, but the
 * watchlist rule keeps it out because it is a wrapped, staked, bridged or
 * versioned product. The plan says why, and what to farm instead.
 */
export function farmStepsExcluded(p: SnapshotProtocol, reason: string): FarmStep[] {
  return [
    {
      text: `${p.name} records no token, but it is not a launch candidate: ${reason}`,
      cost: 'nothing to check',
      time: '5 minutes',
    },
    {
      text: `Do not farm this name for a launch; if a launch ever comes from it, it belongs to the underlying protocol it wraps or stakes.`,
      cost: 'nothing to deposit',
      time: '5 minutes',
    },
    {
      text: `Open the protocol's own page and confirm which underlying token it wraps, stakes or bridges before you touch it.`,
      cost: 'no fee to check',
      time: '10 minutes',
    },
    {
      text: `Verdict SKIP for a launch farm: $0 to wait, and the radar keeps the row so the exclusion stays visible instead of silent.`,
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

/** The traded call from the curve multiple: cheap against comps, fair, or dear. */
export function tradedVerdict(multiple: number): 'FARM' | 'THIN' | 'SKIP' {
  if (multiple < 0.7) return 'FARM';
  if (multiple <= 1.5) return 'THIN';
  return 'SKIP';
}

/** The whole board: every protocol in the snapshot, ranked by board value. */
export function buildBoard(
  snapshot: Snapshot,
  curve: SizeCurve,
  odds: OddsModel,
  p10Factor: number,
  p90Factor: number,
  model: ModelConstants = MODEL,
): BoardRow[] {
  const scored = snapshot.protocols.map((p) => {
    const age = ageDays(snapshot.as_of, p.listed_at);
    const raw = Math.max(1, Math.round(curveImplied(p.tvl_usd, curve)));
    const predicted = raw;
    const multiple = p.mcap_usd !== null && p.mcap_usd > 0 ? p.mcap_usd / predicted : 1;
    const q = Math.min(listedShare((age ?? model.unknown_age_days) / 365, odds), odds.pi);
    const o = tokenOdds(age, odds, model);
    const expected = Math.max(1, Math.round(raw * o));
    if (!isPreToken(p)) {
      // Traded: the board value is the market's own, where recorded.
      const value = p.mcap_usd !== null && p.mcap_usd > 0 ? p.mcap_usd : raw;
      const capital = capitalFor(p.tvl_usd);
      const cost = capital + gasFor(p, model);
      const receipt = Math.max(1, Math.round(value * model.traded_season_share));
      const verdict = tradedVerdict(multiple);
      return {
        p, age, raw, q, odds: o, expected: value, status: 'traded' as BoardStatus,
        verdict, capital, cost, receipt, multiple, reason: null,
      };
    }
    const reason = exclusionReason(p);
    if (reason !== null) {
      return {
        p, age, raw, q, odds: o, expected, status: 'excluded' as BoardStatus,
        verdict: 'SKIP' as const, capital: 0, cost: 0, receipt: 0, multiple, reason,
      };
    }
    const tiers = farmTiers(p.tvl_usd, chainOf(p), model);
    const cost = tiers[1]!.cost_usd;
    const receipt = expected * model.farmer_share;
    const verdict = verdictFor(expected, cost, model);
    return {
      p, age, raw, q, odds: o, expected, status: 'launch' as BoardStatus,
      verdict, capital: tiers[1]!.capital_usd, cost, receipt, multiple, reason: null,
    };
  });
  scored.sort((a, b) => b.expected - a.expected || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  let launchSeen = 0;
  return scored.map((s, i) => {
    const launchRank = s.status === 'launch' ? ++launchSeen : null;
    const steps =
      s.status === 'launch'
        ? farmStepsLaunch(s.p, s.age, s.expected, model).map(stepText)
        : s.status === 'traded'
          ? farmStepsTraded(s.p, s.age, s.multiple, model).map(stepText)
          : farmStepsExcluded(s.p, s.reason as string).map(stepText);
    return {
      rank: i + 1,
      launch_rank: launchRank,
      slug: s.p.slug,
      name: s.p.name,
      status: s.status,
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
      mcap_usd: s.p.mcap_usd,
      curve_predicted_usd: s.raw,
      curve_multiple: Math.round(s.multiple * 10000) / 10000,
      token_odds: Math.round(s.odds * 10000) / 10000,
      listed_share: Math.round(s.q * 10000) / 10000,
      verdict: s.verdict,
      farm_cost_usd: s.cost,
      break_even_usd: s.cost,
      expected_receipt_usd: Math.max(0, Math.round(s.receipt)),
      capital_usd: s.capital,
      hold_days: holdDaysFor(s.age),
      exclusion_reason: s.reason,
      farm_tiers: s.status === 'launch' ? farmTiers(s.p.tvl_usd, chainOf(s.p), model) : [],
      farm_steps: steps,
    };
  });
}

/** The traded anchors, by market cap, with what the curve would have predicted for each. */
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
  return solveLinear(xtx, xty);
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

/** Leave-one-out with a shrunk per-category intercept on top of the curve. */
export function looCatTest(
  comps: SnapshotProtocol[],
  k: number,
  minN: number,
): { median_factor: number; within_2x: number; n: number } {
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
      if (v.length >= minN) adj.set(c, (v.reduce((s, x) => s + x, 0) / v.length) * (v.length / (v.length + k)));
    }
    const p = comps[i]!;
    const pred = curve.intercept + curve.slope * Math.log(p.tvl_usd) + (adj.get(p.category ?? '') ?? 0);
    errs.push(Math.abs(Math.log(p.mcap_usd as number) - pred));
  }
  return summarizeErrs(errs);
}

/** Leave-one-out with a per-category slope where the category has enough comps. */
export function looCatSlopeTest(
  comps: SnapshotProtocol[],
  minN: number,
): { median_factor: number; within_2x: number; n: number } {
  const errs: number[] = [];
  for (let i = 0; i < comps.length; i++) {
    const rest = comps.filter((_, j) => j !== i);
    const p = comps[i]!;
    const cat = rest.filter((q) => q.category === p.category);
    let pred: number;
    if (cat.length >= minN) {
      const beta = fitLinear(cat, (q) => curveFeat(q));
      pred = dot(beta, curveFeat(p));
    } else {
      const beta = fitLinear(rest, (q) => curveFeat(q));
      pred = dot(beta, curveFeat(p));
    }
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
  return solveLinear(xtx, xty);
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

/** The trimmed refit: drop comps beyond 2 residual SDs once, then refit. Returns the curve's beta. */
export function trimFit(rows: SnapshotProtocol[]): number[] {
  const b0 = fitLinear(rows, (p) => curveFeat(p));
  const r = rows.map((p) => Math.log(p.mcap_usd as number) - dot(b0, curveFeat(p)));
  const mean = r.reduce((s, x) => s + x, 0) / r.length;
  const sd = Math.sqrt(r.reduce((s, x) => s + (x - mean) * (x - mean), 0) / r.length);
  const kept = rows.filter((_, j) => Math.abs(r[j]!) <= 2 * sd);
  return fitLinear(kept.length > 0 ? kept : rows, (p) => curveFeat(p));
}

/** The median mcap/TVL ratio over the rows. */
export function medianRatio(rows: SnapshotProtocol[]): number {
  const ratios = rows.map((p) => (p.mcap_usd as number) / p.tvl_usd).sort((a, b) => a - b);
  return ratios[Math.floor(ratios.length / 2)]!;
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

/** Leave-one-out of the median mcap/TVL ratio: no curve at all. */
export function looMedianRatioTest(comps: SnapshotProtocol[]): { median_factor: number; within_2x: number; n: number } {
  const errs: number[] = [];
  for (let i = 0; i < comps.length; i++) {
    const rest = comps.filter((_, j) => j !== i);
    const ratios = rest.map((p) => (p.mcap_usd as number) / p.tvl_usd).sort((a, b) => a - b);
    const med = ratios[Math.floor(ratios.length / 2)]!;
    const p = comps[i]!;
    errs.push(Math.abs(Math.log(p.mcap_usd as number) - Math.log(p.tvl_usd * med)));
  }
  return summarizeErrs(errs);
}

/** Walk-forward median error under a feature function: fit before the cut, test after. */
export function walkForwardFeat(
  comps: SnapshotProtocol[],
  cut: string,
  feat: (p: SnapshotProtocol, asOf: string) => number[],
): { median_factor: number; train_n: number; test_n: number } {
  const train = comps.filter((p) => p.listed_at !== null && p.listed_at < cut);
  const test = comps.filter((p) => p.listed_at !== null && p.listed_at >= cut);
  const beta = fitLinear(train, feat);
  const errs = test.map((p) => Math.abs(Math.log(p.mcap_usd as number) - dot(beta, feat(p, ''))));
  const s = summarizeErrs(errs);
  return { median_factor: s.median_factor, train_n: train.length, test_n: test.length };
}

/** Walk-forward of a per-category-intercept model. */
export function walkCatTest(
  comps: SnapshotProtocol[],
  cut: string,
  k: number,
  minN: number,
): number {
  const train = comps.filter((p) => p.listed_at !== null && p.listed_at < cut);
  const test = comps.filter((p) => p.listed_at !== null && p.listed_at >= cut);
  const curve = fitSizeCurve(train);
  const byCat = new Map<string, number[]>();
  for (const p of train) {
    const r = Math.log(p.mcap_usd as number) - (curve.intercept + curve.slope * Math.log(p.tvl_usd));
    const list = byCat.get(p.category ?? '') ?? [];
    list.push(r);
    byCat.set(p.category ?? '', list);
  }
  const adj = new Map<string, number>();
  for (const [c, v] of byCat) {
    if (v.length >= minN) adj.set(c, (v.reduce((s, x) => s + x, 0) / v.length) * (v.length / (v.length + k)));
  }
  const errs = test.map((p) => Math.abs(Math.log(p.mcap_usd as number) - (curve.intercept + curve.slope * Math.log(p.tvl_usd) + (adj.get(p.category ?? '') ?? 0))));
  return summarizeErrs(errs).median_factor;
}

/** Walk-forward of a per-category-slope model. */
export function walkCatSlopeTest(comps: SnapshotProtocol[], cut: string, minN: number): number {
  const train = comps.filter((p) => p.listed_at !== null && p.listed_at < cut);
  const test = comps.filter((p) => p.listed_at !== null && p.listed_at >= cut);
  const errs = test.map((p) => {
    const cat = train.filter((q) => q.category === p.category);
    let pred: number;
    if (cat.length >= minN) {
      const beta = fitLinear(cat, (q) => curveFeat(q));
      pred = dot(beta, curveFeat(p));
    } else {
      const beta = fitLinear(train, (q) => curveFeat(q));
      pred = dot(beta, curveFeat(p));
    }
    return Math.abs(Math.log(p.mcap_usd as number) - pred);
  });
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

/** 10-fold median error of a per-category-intercept model. */
export function foldCatTest(comps: SnapshotProtocol[], k: number, minN: number): number {
  const sorted = [...comps].sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  const errs: number[] = [];
  for (let f = 0; f < 10; f++) {
    const test = sorted.filter((_, i) => i % 10 === f);
    const train = sorted.filter((_, i) => i % 10 !== f);
    const curve = fitSizeCurve(train);
    const byCat = new Map<string, number[]>();
    for (const p of train) {
      const r = Math.log(p.mcap_usd as number) - (curve.intercept + curve.slope * Math.log(p.tvl_usd));
      const list = byCat.get(p.category ?? '') ?? [];
      list.push(r);
      byCat.set(p.category ?? '', list);
    }
    const adj = new Map<string, number>();
    for (const [c, v] of byCat) {
      if (v.length >= minN) adj.set(c, (v.reduce((s, x) => s + x, 0) / v.length) * (v.length / (v.length + k)));
    }
    for (const p of test) {
      errs.push(Math.abs(Math.log(p.mcap_usd as number) - (curve.intercept + curve.slope * Math.log(p.tvl_usd) + (adj.get(p.category ?? '') ?? 0))));
    }
  }
  return summarizeErrs(errs).median_factor;
}

/** 10-fold median error of a per-category-slope model. */
export function foldCatSlopeTest(comps: SnapshotProtocol[], minN: number): number {
  const sorted = [...comps].sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  const errs: number[] = [];
  for (let f = 0; f < 10; f++) {
    const test = sorted.filter((_, i) => i % 10 === f);
    const train = sorted.filter((_, i) => i % 10 !== f);
    for (const p of test) {
      const cat = train.filter((q) => q.category === p.category);
      let pred: number;
      if (cat.length >= minN) {
        const beta = fitLinear(cat, (q) => curveFeat(q));
        pred = dot(beta, curveFeat(p));
      } else {
        const beta = fitLinear(train, (q) => curveFeat(q));
        pred = dot(beta, curveFeat(p));
      }
      errs.push(Math.abs(Math.log(p.mcap_usd as number) - pred));
    }
  }
  return summarizeErrs(errs).median_factor;
}

/** Walk-forward median error for a fit that returns a predictor: fit before the cut, test after. */
export function walkGeneric(
  comps: SnapshotProtocol[],
  cut: string,
  fit: (rows: SnapshotProtocol[]) => (p: SnapshotProtocol) => number,
): number {
  const train = comps.filter((p) => p.listed_at !== null && p.listed_at < cut);
  const test = comps.filter((p) => p.listed_at !== null && p.listed_at >= cut);
  const predict = fit(train);
  const errs = test.map((p) => Math.abs(Math.log(p.mcap_usd as number) - predict(p)));
  return summarizeErrs(errs).median_factor;
}

/** 10-fold median error for a fit that returns a predictor. */
export function foldGeneric(
  comps: SnapshotProtocol[],
  fit: (rows: SnapshotProtocol[]) => (p: SnapshotProtocol) => number,
): number {
  const sorted = [...comps].sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  const errs: number[] = [];
  for (let f = 0; f < 10; f++) {
    const test = sorted.filter((_, i) => i % 10 === f);
    const train = sorted.filter((_, i) => i % 10 !== f);
    const predict = fit(train);
    for (const p of test) errs.push(Math.abs(Math.log(p.mcap_usd as number) - predict(p)));
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

/** The out-of-sample tests for the fitted curve and the fitted odds. */
export function modelTests(snapshot: Snapshot): ModelTests {
  const comps = compsOf(snapshot);
  const asOf = snapshot.as_of;
  const r2 = (x: number): number => Math.round(x * 100) / 100;
  const r3 = (x: number): number => Math.round(x * 1000) / 1000;

  const featBase = (p: SnapshotProtocol): number[] => [1, Math.log(p.tvl_usd)];
  const featQuad = (p: SnapshotProtocol): number[] => [1, Math.log(p.tvl_usd), Math.log(p.tvl_usd) * Math.log(p.tvl_usd)];
  const featChains = (p: SnapshotProtocol): number[] => [1, Math.log(p.tvl_usd), Math.log(p.chains.length)];
  const featMulti = (p: SnapshotProtocol): number[] => [1, Math.log(p.tvl_usd), p.chains.length > 1 ? 1 : 0];
  const featGrowth = (p: SnapshotProtocol): number[] => [1, Math.log(p.tvl_usd), p.change_7d ?? 0];
  const featAge = (p: SnapshotProtocol): number[] => [1, Math.log(p.tvl_usd), (ageDays(asOf, p.listed_at) ?? 365) / 365];
  const featPiece = (p: SnapshotProtocol): number[] => {
    const lt = Math.log(p.tvl_usd);
    return [1, lt, Math.max(0, lt - Math.log(1e8))];
  };

  const loo = looTest(comps, (p) => featBase(p));
  const walk = walkForwardTest(comps, '2025-01-01');
  const walk2 = walkForwardTest(comps, '2024-07-01');
  const fold = foldTest(comps);
  const resid = looResiduals(comps);
  const q10 = resid[Math.floor(0.1 * resid.length)]!;
  const q90 = resid[Math.floor(0.9 * resid.length)]!;

  // Time-split: fit on tokens listed before 2024, test on those listed after.
  const tsTrain = comps.filter((p) => p.listed_at !== null && p.listed_at < '2024-01-01');
  const tsTest = comps.filter((p) => p.listed_at !== null && p.listed_at >= '2024-01-01');
  const tsBeta = fitLinear(tsTrain, (p) => featBase(p));
  const tsErrs = tsTest.map((p) => Math.abs(Math.log(p.mcap_usd as number) - dot(tsBeta, featBase(p))));
  const tsQuadBeta = fitLinear(tsTrain, (p) => featQuad(p));
  const tsQuadErrs = tsTest.map((p) => Math.abs(Math.log(p.mcap_usd as number) - dot(tsQuadBeta, featQuad(p))));

  // Every variant, scored the same four ways. The shipped row is the bare curve.
  const variants: VariantScore[] = [
    {
      name: 'Global log-log curve (shipped)',
      loo: r2(loo.median_factor),
      walk2025: r2(walk.median_factor),
      walk2024: r2(walk2.median_factor),
      fold: r2(fold.median_factor),
      shipped: true,
    },
    {
      name: 'Quadratic in log TVL',
      loo: r2(looTest(comps, (p) => featQuad(p)).median_factor),
      walk2025: r2(walkForwardFeat(comps, '2025-01-01', (p) => featQuad(p)).median_factor),
      walk2024: r2(walkForwardFeat(comps, '2024-07-01', (p) => featQuad(p)).median_factor),
      fold: r2(foldFeat(comps, (p) => featQuad(p))),
      shipped: false,
    },
    {
      name: 'Per-category intercept, k=5, n>=5',
      loo: r2(looCatTest(comps, 5, 5).median_factor),
      walk2025: r2(walkCatTest(comps, '2025-01-01', 5, 5)),
      walk2024: r2(walkCatTest(comps, '2024-07-01', 5, 5)),
      fold: r2(foldCatTest(comps, 5, 5)),
      shipped: false,
    },
    {
      name: 'Per-category intercept, k=10, n>=5',
      loo: r2(looCatTest(comps, 10, 5).median_factor),
      walk2025: r2(walkCatTest(comps, '2025-01-01', 10, 5)),
      walk2024: r2(walkCatTest(comps, '2024-07-01', 10, 5)),
      fold: r2(foldCatTest(comps, 10, 5)),
      shipped: false,
    },
    {
      name: 'Per-category slope, n>=10',
      loo: r2(looCatSlopeTest(comps, 10).median_factor),
      walk2025: r2(walkCatSlopeTest(comps, '2025-01-01', 10)),
      walk2024: r2(walkCatSlopeTest(comps, '2024-07-01', 10)),
      fold: r2(foldCatSlopeTest(comps, 10)),
      shipped: false,
    },
    {
      name: '+ log chain count',
      loo: r2(looTest(comps, (p) => featChains(p)).median_factor),
      walk2025: r2(walkForwardFeat(comps, '2025-01-01', (p) => featChains(p)).median_factor),
      walk2024: r2(walkForwardFeat(comps, '2024-07-01', (p) => featChains(p)).median_factor),
      fold: r2(foldFeat(comps, (p) => featChains(p))),
      shipped: false,
    },
    {
      name: '+ multi-chain dummy',
      loo: r2(looTest(comps, (p) => featMulti(p)).median_factor),
      walk2025: r2(walkForwardFeat(comps, '2025-01-01', (p) => featMulti(p)).median_factor),
      walk2024: r2(walkForwardFeat(comps, '2024-07-01', (p) => featMulti(p)).median_factor),
      fold: r2(foldFeat(comps, (p) => featMulti(p))),
      shipped: false,
    },
    {
      name: '+ 7-day growth',
      loo: r2(looTest(comps, (p) => featGrowth(p)).median_factor),
      walk2025: r2(walkForwardFeat(comps, '2025-01-01', (p) => featGrowth(p)).median_factor),
      walk2024: r2(walkForwardFeat(comps, '2024-07-01', (p) => featGrowth(p)).median_factor),
      fold: r2(foldFeat(comps, (p) => featGrowth(p))),
      shipped: false,
    },
    {
      name: '+ protocol age',
      loo: r2(looTest(comps, (p) => featAge(p)).median_factor),
      walk2025: r2(walkForwardFeat(comps, '2025-01-01', (p) => featAge(p)).median_factor),
      walk2024: r2(walkForwardFeat(comps, '2024-07-01', (p) => featAge(p)).median_factor),
      fold: r2(foldFeat(comps, (p) => featAge(p))),
      shipped: false,
    },
    {
      name: 'Piecewise slope at $100M TVL',
      loo: r2(looTest(comps, (p) => featPiece(p)).median_factor),
      walk2025: r2(walkForwardFeat(comps, '2025-01-01', (p) => featPiece(p)).median_factor),
      walk2024: r2(walkForwardFeat(comps, '2024-07-01', (p) => featPiece(p)).median_factor),
      fold: r2(foldFeat(comps, (p) => featPiece(p))),
      shipped: false,
    },
    {
      name: 'Huber robust curve',
      loo: r2(looHuberTest(comps).median_factor),
      walk2025: r2(walkGeneric(comps, '2025-01-01', (rows) => { const b = huberFit(rows); return (p) => dot(b, featBase(p)); })),
      walk2024: r2(walkGeneric(comps, '2024-07-01', (rows) => { const b = huberFit(rows); return (p) => dot(b, featBase(p)); })),
      fold: r2(foldGeneric(comps, (rows) => { const b = huberFit(rows); return (p) => dot(b, featBase(p)); })),
      shipped: false,
    },
    {
      name: 'Trimmed refit (2 SD)',
      loo: r2(looTrimTest(comps).median_factor),
      walk2025: r2(walkGeneric(comps, '2025-01-01', (rows) => { const b = trimFit(rows); return (p) => dot(b, featBase(p)); })),
      walk2024: r2(walkGeneric(comps, '2024-07-01', (rows) => { const b = trimFit(rows); return (p) => dot(b, featBase(p)); })),
      fold: r2(foldGeneric(comps, (rows) => { const b = trimFit(rows); return (p) => dot(b, featBase(p)); })),
      shipped: false,
    },
    {
      name: 'Median mcap/TVL ratio',
      loo: r2(looMedianRatioTest(comps).median_factor),
      walk2025: r2(walkGeneric(comps, '2025-01-01', (rows) => { const m = medianRatio(rows); return (p) => Math.log(p.tvl_usd * m); })),
      walk2024: r2(walkGeneric(comps, '2024-07-01', (rows) => { const m = medianRatio(rows); return (p) => Math.log(p.tvl_usd * m); })),
      fold: r2(foldGeneric(comps, (rows) => { const m = medianRatio(rows); return (p) => Math.log(p.tvl_usd * m); })),
      shipped: false,
    },
  ];

  const ageRows = ageRowsOf(snapshot);
  const oddsVariants: OddsVariantScore[] = [
    { name: 'Age only (shipped)', ...oddsSkill(snapshot), shipped: true },
    {
      name: 'Age + log TVL',
      ...logitSkill(ageRows, (r) => [1, r.age_years, Math.log10(Math.max(r.tvl_usd, 1))]),
      shipped: false,
    },
    {
      name: 'Age + chain count',
      ...logitSkill(ageRows, (r) => [1, r.age_years, Math.log(r.chains_n)]),
      shipped: false,
    },
    {
      name: 'Age + age squared',
      ...logitSkill(ageRows, (r) => [1, r.age_years, r.age_years * r.age_years]),
      shipped: false,
    },
  ];

  const calibration = oddsCalibration(snapshot);
  const skill = oddsSkill(snapshot);
  const maxGap = Math.max(0, ...calibration.map((c) => Math.abs(c.predicted - c.actual)));
  return {
    loo_median_factor: r2(loo.median_factor),
    loo_within_2x: r3(loo.within_2x),
    loo_n: loo.n,
    walk_median_factor: r2(walk.median_factor),
    walk_within_2x: r3(walk.within_2x),
    walk_train_n: walk.train_n,
    walk_test_n: walk.test_n,
    walk2_median_factor: r2(walk2.median_factor),
    walk2_within_2x: r3(walk2.within_2x),
    walk2_train_n: walk2.train_n,
    walk2_test_n: walk2.test_n,
    time_split_median_factor: r2(summarizeErrs(tsErrs).median_factor),
    time_split_train_n: tsTrain.length,
    time_split_test_n: tsTest.length,
    time_split_quad_median_factor: r2(summarizeErrs(tsQuadErrs).median_factor),
    fold_median_factor: r2(fold.median_factor),
    fold_within_2x: r3(fold.within_2x),
    fold_n: fold.n,
    p10_factor: r2(Math.exp(q10)),
    p90_factor: r2(Math.exp(q90)),
    p90_coverage_walk: r3(walkCoverage(comps, '2025-01-01', q10, q90)),
    p90_coverage_walk2: r3(walkCoverage(comps, '2024-07-01', q10, q90)),
    p90_coverage_fold: r3(fold.coverage),
    odds_logloss: skill.logloss,
    odds_auc: skill.auc,
    odds_calibration: calibration,
    odds_max_calibration_gap: r3(maxGap),
    variants,
    odds_variants: oddsVariants,
  };
}

/** A board row's compact form for data.js. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    launch_rank: row.launch_rank,
    slug: row.slug,
    name: row.name,
    status: row.status,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    implied_raw_usd: row.implied_raw_usd,
    implied_p10_usd: row.implied_p10_usd,
    implied_p90_usd: row.implied_p90_usd,
    mcap_usd: row.mcap_usd,
    curve_predicted_usd: row.curve_predicted_usd,
    curve_multiple: row.curve_multiple,
    token_odds: row.token_odds,
    listed_share: row.listed_share,
    verdict: row.verdict,
    farm_cost_usd: row.farm_cost_usd,
    break_even_usd: row.break_even_usd,
    expected_receipt_usd: row.expected_receipt_usd,
    capital_usd: row.capital_usd,
    hold_days: row.hold_days,
    exclusion_reason: row.exclusion_reason,
    farm_tiers: row.farm_tiers,
    farm_steps: row.farm_steps,
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
  const counts = {
    launch: board.filter((r) => r.status === 'launch').length,
    excluded: board.filter((r) => r.status === 'excluded').length,
    traded: board.filter((r) => r.status === 'traded').length,
    comps: comps.length,
  };
  const verdicts = { FARM: 0, THIN: 0, SKIP: 0 };
  const launchVerdicts = { FARM: 0, THIN: 0, SKIP: 0 };
  for (const r of board) {
    verdicts[r.verdict]++;
    if (r.status === 'launch') launchVerdicts[r.verdict]++;
  }
  const watchCovered = snapshot.watchlist.filter((s) => board.some((r) => r.slug === s)).length;
  const checks: IntegrityCheck[] = [
    {
      name: 'Watchlist covered',
      pass: watchCovered === snapshot.watchlist.length,
      detail: `${watchCovered}/${snapshot.watchlist.length} watchlist protocols on the board`,
    },
    {
      name: 'Ledger complete',
      pass: board.length === snapshot.protocols.length,
      detail: `${board.length}/${snapshot.protocols.length} protocols accounted for (${counts.launch} launch, ${counts.excluded} excluded, ${counts.traded} traded)`,
    },
    {
      name: 'Ranks 1..N',
      pass: board.every((r, i) => r.rank === i + 1),
      detail: `ranks run 1 to ${board.length} with no gap and no duplicate`,
    },
    {
      name: 'Implied value falls with rank',
      pass: board.every((r, i) => i === 0 || r.implied_value_usd <= board[i - 1]!.implied_value_usd),
      detail: `rank 1 $${board[0]!.implied_value_usd.toLocaleString('en-US')} down to rank ${board.length} $${board[board.length - 1]!.implied_value_usd.toLocaleString('en-US')}`,
    },
    {
      name: 'Farm steps valid',
      pass: board.every((r) => r.farm_steps.length >= 3 && r.farm_steps.length <= 12 && r.farm_steps.every((s) => s.length >= 20 && s.length <= 600)),
      detail: `${board.length} rows, every plan 3-12 steps of 20-600 characters`,
    },
    {
      name: 'Value curve fitted at run time',
      pass: Number.isFinite(curve.intercept) && Number.isFinite(curve.slope) && curve.comps > 0,
      detail: `log(mcap) = ${curve.intercept.toFixed(3)} + ${curve.slope.toFixed(3)} log(TVL) on ${curve.comps} comps`,
    },
    {
      name: 'Token odds fitted at run time',
      pass: Number.isFinite(odds.intercept) && Number.isFinite(odds.slope_per_year) && odds.known_age_n > 0,
      detail: `logit on ${odds.known_age_n} known-age protocols, 5-fold AUC ${tests.odds_auc}`,
    },
    {
      name: 'P10-P90 band holds out of sample',
      pass: tests.p90_coverage_walk >= 0.6 && tests.p90_coverage_fold >= 0.6,
      detail: `band holds ${(tests.p90_coverage_walk * 100).toFixed(0)}% walk-forward 2025, ${(tests.p90_coverage_fold * 100).toFixed(0)}% 10-fold`,
    },
    {
      name: 'Farm plans costed in tiers',
      pass: board.filter((r) => r.status === 'launch').every((r) => r.farm_tiers.length === 3),
      detail: `${counts.launch} launch rows, each with small / standard / large tiers and a netted break-even`,
    },
    {
      name: 'Traded anchors priced',
      pass: live.length === LIVE_ROWS,
      detail: `${live.length} traded anchors with actual market cap against the curve`,
    },
  ];
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
    counts,
    verdicts,
    launch_verdicts: launchVerdicts,
    checks,
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
  if (board.length < 100 || board.length > 4000) return `the board holds ${board.length} rows, outside 100..4000`;
  if (new Set(board.map((r) => r.slug)).size !== board.length) return 'the board repeats a slug';
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
