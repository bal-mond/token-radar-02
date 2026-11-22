// The token radar's model, radar-2: a fitted value model, tested out of sample.
//
// Every number the board states is derived from the sealed snapshot at run
// time, never from a hand-kept list of names:
//
//   base     = the fitted size curve: log(mcap) = a + b * log(TVL), least
//              squares over the snapshot's own traded tokens with a known
//              market cap (128 clean comps). The curve is fitted fresh on
//              every run; its a and b are printed on the dashboard.
//   growth   = clamp(change_7d, -60, 120); growthMult = 1 + growth/100 * 0.25.
//              The weight is 0.25, not 0.5: in-sample, 7-day growth barely
//              predicts a traded token's mcap/TVL residual (r = -0.14), so
//              the term is kept small and the test is stated on the page.
//   maturity = 0.7 + min(age_days, 1095) / 1095 * 0.3 (age unknown: 365).
//   odds     = the listing rate of the snapshot's own protocols
//              (416 of 758 record a token, about 0.55), decayed with the
//              protocol's no-token age: no decay in the first year, then
//              exp(-(age - 365) / 1095). A protocol that has run years with
//              no token has shown it is less likely ever to list.
//   expected = base * growthMult * maturityMult * odds. The board ranks by
//              expected value: the launch value a farmer can reasonably hope
//              for, not the raw size alone.
//
// Terms that did not survive the blind test are dropped, and the dashboard
// says so: a per-category median multiple predicts traded mcaps worse than
// the curve in leave-one-out (median error x5.5 vs x3.4), so no category
// multiple is used; a TVL-band size factor moves the odds by under 5%, so
// none is used either.
//
// The tests, run at build time and printed on the dashboard:
//   LOO          leave-one-out over the 128 comps: fit the curve without one
//                token, predict its market cap, record |log(pred/actual)|.
//   walk-forward fit on tokens listed before 2025-01-01, test on those
//                listed after. Both report the median error as a factor
//                (exp of the median log error) and the share within 2x.

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
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  odds_decay_days: number;
  odds_floor: number;
  odds_cap: number;
  farmer_share: number;
  gas_total_usd: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.25,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.7,
  maturity_range: 0.3,
  maturity_days: 1095,
  unknown_age_days: 365,
  odds_decay_days: 1095,
  odds_floor: 0.05,
  odds_cap: 0.6,
  farmer_share: 0.00005,
  gas_total_usd: 12,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-2';

/** How many live-token protocols the Live anchors view carries, by market cap. */
export const LIVE_ROWS = 24;

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
  token_odds: number;
  curve_multiple: number;
  growth_multiplier: number;
  maturity_multiplier: number;
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
  token_odds: number;
  curve_multiple: number;
  growth_multiplier: number;
  maturity_multiplier: number;
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
  walk_median_factor: number;
  walk_within_2x: number;
  walk_train_n: number;
  walk_test_n: number;
}

/** Everything the dashboard needs: the board, the live anchors, the fitted curve and its tests. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  curve: SizeCurve;
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

/** What the fitted curve says a protocol of this TVL is worth, before growth, maturity and odds. */
export function curveImplied(tvlUsd: number, curve: SizeCurve): number {
  return Math.exp(curve.intercept + curve.slope * Math.log(tvlUsd));
}

/** The curve's implied multiple at a TVL: the implied value divided by the TVL. */
export function curveMultiple(tvlUsd: number, curve: SizeCurve): number {
  return curveImplied(tvlUsd, curve) / tvlUsd;
}

/** The growth multiplier: the 7-day change, clamped, at a small weight. */
export function growthMultiplier(change7d: number | null, model: ModelConstants): number {
  const g = Math.min(model.growth_cap, Math.max(model.growth_floor, finite(change7d, 0)));
  return 1 + (g / 100) * model.growth_weight;
}

/** The maturity multiplier: longer-running with no token counts for more, up to a cap. */
export function maturityMultiplier(age: number | null, model: ModelConstants): number {
  const a = age ?? model.unknown_age_days;
  return model.maturity_floor + (Math.min(Math.max(a, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
}

/** The odds a pre-token protocol ever lists, from the snapshot's own listing rate, decayed with no-token age. */
export function tokenOdds(age: number | null, listingRate: number, model: ModelConstants): number {
  const a = age ?? model.unknown_age_days;
  const decay = Math.exp(-Math.max(a - model.unknown_age_days, 0) / model.odds_decay_days);
  const odds = listingRate * decay;
  return Math.min(model.odds_cap, Math.max(model.odds_floor, odds));
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
export function buildBoard(snapshot: Snapshot, curve: SizeCurve, listingRate: number, model: ModelConstants = MODEL): BoardRow[] {
  const chosen = snapshot.protocols.filter(isLaunchCandidate);
  const scored = chosen.map((p) => {
    const age = ageDays(snapshot.as_of, p.listed_at);
    const base = curveImplied(p.tvl_usd, curve);
    const gMult = growthMultiplier(p.change_7d, model);
    const mMult = maturityMultiplier(age, model);
    const raw = Math.max(1, Math.round(base * gMult * mMult));
    const odds = tokenOdds(age, listingRate, model);
    const expected = Math.max(1, Math.round(raw * odds));
    const capital = capitalFor(p.tvl_usd);
    const cost = capital + model.gas_total_usd;
    const receipt = expected * model.farmer_share;
    const verdict = verdictFor(expected, cost, model);
    return { p, age, raw, odds, expected, capital, cost, receipt, verdict, gMult, mMult };
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
    token_odds: Math.round(s.odds * 10000) / 10000,
    curve_multiple: Math.round(curveMultiple(s.p.tvl_usd, curve) * 10000) / 10000,
    growth_multiplier: Math.round(s.gMult * 10000) / 10000,
    maturity_multiplier: Math.round(s.mMult * 10000) / 10000,
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

/** Leave-one-out over the comps: fit without one token, predict its market cap. */
export function looTest(comps: SnapshotProtocol[]): { median_factor: number; within_2x: number; n: number } {
  const errs: number[] = [];
  for (let i = 0; i < comps.length; i++) {
    const rest = comps.filter((_, j) => j !== i);
    const curve = fitSizeCurve(rest);
    const p = comps[i]!;
    const pred = curveImplied(p.tvl_usd, curve);
    errs.push(Math.abs(Math.log(pred / (p.mcap_usd as number))));
  }
  errs.sort((a, b) => a - b);
  const median = errs[Math.floor(errs.length / 2)]!;
  const within = errs.filter((e) => e <= Math.log(2)).length / errs.length;
  return { median_factor: Math.exp(median), within_2x: within, n: errs.length };
}

/** Walk-forward: fit on tokens listed before the cut, test on those listed after. */
export function walkForwardTest(comps: SnapshotProtocol[], cut: string): { median_factor: number; within_2x: number; train_n: number; test_n: number } {
  const train = comps.filter((p) => p.listed_at !== null && p.listed_at < cut);
  const test = comps.filter((p) => p.listed_at !== null && p.listed_at >= cut);
  const curve = fitSizeCurve(train);
  const errs = test.map((p) => Math.abs(Math.log(curveImplied(p.tvl_usd, curve) / (p.mcap_usd as number))));
  errs.sort((a, b) => a - b);
  const median = errs.length > 0 ? errs[Math.floor(errs.length / 2)]! : 0;
  const within = errs.length > 0 ? errs.filter((e) => e <= Math.log(2)).length / errs.length : 0;
  return { median_factor: Math.exp(median), within_2x: within, train_n: train.length, test_n: test.length };
}

/** The out-of-sample tests for the fitted curve. */
export function modelTests(snapshot: Snapshot): ModelTests {
  const comps = compsOf(snapshot);
  const loo = looTest(comps);
  const walk = walkForwardTest(comps, '2025-01-01');
  return {
    loo_median_factor: Math.round(loo.median_factor * 100) / 100,
    loo_within_2x: Math.round(loo.within_2x * 1000) / 1000,
    loo_n: loo.n,
    walk_median_factor: Math.round(walk.median_factor * 100) / 100,
    walk_within_2x: Math.round(walk.within_2x * 1000) / 1000,
    walk_train_n: walk.train_n,
    walk_test_n: walk.test_n,
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
    token_odds: row.token_odds,
    curve_multiple: row.curve_multiple,
    growth_multiplier: row.growth_multiplier,
    maturity_multiplier: row.maturity_multiplier,
    verdict: row.verdict,
    farm_cost_usd: row.farm_cost_usd,
    break_even_usd: row.break_even_usd,
    expected_receipt_usd: row.expected_receipt_usd,
    capital_usd: capitalFor(row.tvl_usd),
    hold_days: holdDaysFor(row.age_days),
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData; curve: SizeCurve; listingRate: number } {
  const comps = compsOf(snapshot);
  const curve = fitSizeCurve(comps);
  const listingRate = snapshot.protocols.filter((p) => !isPreToken(p)).length / snapshot.protocols.length;
  const board = buildBoard(snapshot, curve, listingRate, model);
  const live = liveRows(snapshot, curve);
  const tests = modelTests(snapshot);
  const verdicts = { FARM: 0, THIN: 0, SKIP: 0 };
  for (const r of board) verdicts[r.verdict]++;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    curve,
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
  return { board, radar, curve, listingRate };
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
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
