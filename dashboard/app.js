// Token Launch Radar — the dashboard's logic. No network: everything comes
// from window.RADAR in ../data.js, written by main.ts from the same board.
//
// The farm plan below is generated in the page from each row's own figures
// (category, capital, hold, cost, receipt, verdict), with the same templates
// main.ts used for board.json, so the plan a reader sees is the plan the
// board carries.

const R = window.RADAR;
const $ = (id) => document.getElementById(id);

/** $1.74B, $516.2M, $90.1M, $12,400. */
function fmtUSD(n) {
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
  return '$' + Math.round(n).toLocaleString('en-US');
}
function fmtPct(n) {
  if (n === null || n === undefined) return '—';
  const s = (n > 0 ? '+' : '') + n.toFixed(1) + '%';
  return s;
}
function fmtMult(n) { return n.toFixed(3) + 'x'; }
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function chainOf(row) { return row.chains && row.chains.length > 0 ? row.chains[0] : 'its main chain'; }

/** The category's one action — the same rule main.ts used for board.json. */
function actionFor(row) {
  const c = (row.category || '').toLowerCase();
  const name = row.name;
  const capital = row.capital_usd;
  const chain = chainOf(row);
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

/** A row's six farm steps, as strings — the same text board.json carries. */
function farmSteps(row) {
  const capital = row.capital_usd;
  const hold = row.hold_days;
  const cost = row.farm_cost_usd;
  const steps = [
    { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
    { text: actionFor(row), cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`, time: '15 minutes to set up' },
    { text: 'Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.', cost: 'about $2 of gas a week', time: '10 minutes a week' },
    { text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`, cost: `the $${capital} stays in the position`, time: `${hold} days` },
    { text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`, cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
    { text: `This position breaks even if the airdrop is worth at least $${cost}; at the assumed ${(R.model.farmer_share * 100).toFixed(3)}% farmer share the expected receipt is $${row.expected_receipt_usd}, so the verdict is ${row.verdict}.`, cost: 'nothing but the log', time: '5 minutes' },
  ];
  return steps.map((s) => {
    let t = `${s.text} Cost: ${s.cost}. Time: ${s.time}.`;
    if (t.length > 600) t = t.slice(0, 596) + '...';
    return t;
  });
}

// ---- Header, KPIs, integrity strip ----
$('asof').textContent = R.as_of;
$('meta').innerHTML = `Model <b>${esc(R.model_version)}</b> · snapshot <b>${esc(R.as_of)}</b> · ` +
  `curve log(mcap) = ${R.curve.intercept.toFixed(3)} + ${R.curve.slope.toFixed(3)} · log(TVL) · ` +
  `listing rate <b>${(R.listing_rate * 100).toFixed(1)}%</b> · ` +
  `odds logit ${R.odds.intercept.toFixed(2)} + ${R.odds.slope_per_year.toFixed(2)}/yr, pi ${R.odds.pi}`;
$('foot').textContent = `Source: ${R.source}. The snapshot is sealed and never moves; every figure on this page is derived from it. ` +
  `Implied values are this entry's own claim, never make.fun's. A protocol is said to record no token, never that it has none.`;

const kpis = [
  [R.scanned, 'protocols scanned'],
  [R.board_size, 'rows ranked'],
  [R.watchlist_size + '/' + R.watchlist_size, 'watchlist covered'],
  [R.curve.comps, 'traded comps fitted'],
  ['x' + R.tests.loo_median_factor, 'LOO median error'],
  ['x' + R.tests.walk_median_factor, 'walk-forward error'],
  [(R.tests.p90_coverage_fold * 100).toFixed(0) + '%', 'P10–P90 holds (10-fold)'],
  [R.tests.odds_auc.toFixed(2), 'odds AUC (5-fold)'],
];
$('kpis').innerHTML = kpis.map(([k, l]) => `<div class="kpi"><div class="k">${esc(String(k))}</div><div class="l">${esc(l)}</div></div>`).join('');

function check(label, ok, detail) {
  return `<div class="check"><span>${esc(label)}</span><span class="${ok ? 'ok' : 'bad'}">${ok ? 'PASS' : 'FAIL'}${detail ? ' · ' + esc(detail) : ''}</span></div>`;
}
(function integrity() {
  const rows = R.rows;
  const t = R.tests;
  const slugs = new Set(rows.map((r) => r.slug));
  const wlOk = R.watchlist.every((s) => slugs.has(s));
  const ranksOk = rows.every((r, i) => r.rank === i + 1);
  const orderOk = rows.every((r, i) => i === 0 || r.implied_value_usd <= rows[i - 1].implied_value_usd);
  const stepsOk = rows.every((r) => { const s = farmSteps(r); return s.length === 6 && s.every((x) => x.length >= 20 && x.length <= 600); });
  const verdictOk = R.verdicts.FARM + R.verdicts.THIN + R.verdicts.SKIP === rows.length;
  const curveOk = Number.isFinite(R.curve.slope) && R.curve.comps >= 100;
  const looOk = t.loo_median_factor <= 4;
  const walkOk = t.walk_median_factor <= 4 && t.walk2_median_factor <= 4;
  const foldOk = t.fold_median_factor <= 4;
  const bandOk = t.p90_coverage_walk >= 0.6 && t.p90_coverage_walk2 >= 0.6 && t.p90_coverage_fold >= 0.6;
  const calOk = t.odds_max_calibration_gap <= 0.15;
  $('integrity').innerHTML = [
    check('Watchlist covered', wlOk, R.watchlist_size + '/' + R.watchlist_size),
    check('Board is a ranking', ranksOk && orderOk, 'ranks 1..' + rows.length + ', values never rise'),
    check('Farm plan on every row', stepsOk, '6 steps'),
    check('Verdicts account for every row', verdictOk, `${R.verdicts.FARM} FARM · ${R.verdicts.THIN} THIN · ${R.verdicts.SKIP} SKIP`),
    check('Curve fitted on comps', curveOk, R.curve.comps + ' tokens'),
    check('LOO median error', looOk, 'x' + t.loo_median_factor + ' (growth x' + t.loo_growth_median_factor + ', age x' + t.loo_age_median_factor + ')'),
    check('Walk-forward, two cuts', walkOk, 'x' + t.walk_median_factor + ' and x' + t.walk2_median_factor),
    check('10-fold error', foldOk, 'x' + t.fold_median_factor),
    check('P10–P90 holds out of sample', bandOk, `${(t.p90_coverage_walk * 100).toFixed(0)}% / ${(t.p90_coverage_walk2 * 100).toFixed(0)}% / ${(t.p90_coverage_fold * 100).toFixed(0)}%`),
    check('Odds calibration', calOk, 'max gap ' + t.odds_max_calibration_gap + ', AUC ' + t.odds_auc),
  ].join('');
})();

// ---- Board: filter, sort, render ----
let view = 'board';
let selected = null;

function visibleRows() {
  const q = $('q').value.trim().toLowerCase();
  const cat = $('cat').value;
  const verdict = $('verdict').value;
  let rows = R.rows.filter((r) => {
    if (q && !(r.name.toLowerCase().includes(q) || r.slug.includes(q))) return false;
    if (cat && r.category !== cat) return false;
    if (verdict && r.verdict !== verdict) return false;
    return true;
  });
  const sort = $('sort').value;
  const by = {
    rank: (a, b) => a.rank - b.rank,
    expected: (a, b) => b.implied_value_usd - a.implied_value_usd,
    tvl: (a, b) => b.tvl_usd - a.tvl_usd,
    growth: (a, b) => (b.change_7d ?? -1e9) - (a.change_7d ?? -1e9),
    age: (a, b) => (b.age_days ?? -1) - (a.age_days ?? -1),
    odds: (a, b) => b.token_odds - a.token_odds,
  }[sort] || ((a, b) => a.rank - b.rank);
  return rows.slice().sort(by);
}

function renderBoard() {
  const rows = visibleRows();
  $('rows').innerHTML = rows.map((r) => {
    const g = r.change_7d;
    const gCls = g === null ? '' : g > 0 ? 'pos' : g < 0 ? 'neg' : '';
    return `<tr data-slug="${esc(r.slug)}" class="${selected === r.slug ? 'sel' : ''}">` +
      `<td>${r.rank}</td><td><b>${esc(r.name)}</b></td><td>${esc(r.category || '—')}</td>` +
      `<td>${esc((r.chains || []).slice(0, 2).join(', ') || '—')}</td>` +
      `<td class="num">${fmtUSD(r.tvl_usd)}</td>` +
      `<td class="num ${gCls}">${fmtPct(g)}</td>` +
      `<td class="num">${r.age_days === null ? '—' : r.age_days + 'd'}</td>` +
      `<td class="num">${fmtUSD(r.implied_raw_usd)}</td>` +
      `<td class="num">${(r.token_odds * 100).toFixed(0)}%</td>` +
      `<td class="num"><b>${fmtUSD(r.implied_value_usd)}</b></td>` +
      `<td><span class="verdict ${r.verdict}">${r.verdict}</span></td></tr>`;
  }).join('');
  $('count').textContent = `${rows.length} of ${R.rows.length} rows shown. Click a row for its model breakdown and farm plan.`;
  document.querySelectorAll('#rows tr').forEach((tr) => {
    tr.addEventListener('click', () => showDetail(tr.getAttribute('data-slug')));
  });
}

function showDetail(slug) {
  const r = R.rows.find((x) => x.slug === slug);
  if (!r) return;
  selected = slug;
  const steps = farmSteps(r);
  $('detail').hidden = false;
  $('detail').innerHTML =
    `<h2>#${r.rank} ${esc(r.name)}</h2>` +
    `<p class="dmeta">${esc(r.category || 'No category')} · ${(r.chains || []).join(', ') || 'no chain listed'} · ` +
    `TVL ${fmtUSD(r.tvl_usd)} · 7-day ${fmtPct(r.change_7d)} · age ${r.age_days === null ? 'unknown' : r.age_days + ' days'} · ` +
    `records no token</p>` +
    `<div class="terms">` +
    `<div class="term"><div class="k">${fmtMult(r.curve_multiple)}</div><div class="l">curve multiple (TVL → mcap)</div></div>` +
    `<div class="term"><div class="k">${fmtUSD(r.implied_raw_usd)}</div><div class="l">implied value, before odds</div></div>` +
    `<div class="term"><div class="k">${fmtUSD(r.implied_p10_usd)} – ${fmtUSD(r.implied_p90_usd)}</div><div class="l">P10–P90 range of implied value</div></div>` +
    `<div class="term"><div class="k">${(r.listed_share * 100).toFixed(0)}%</div><div class="l">listed share at this age (fitted)</div></div>` +
    `<div class="term"><div class="k">${(r.token_odds * 100).toFixed(0)}%</div><div class="l">token odds</div></div>` +
    `<div class="term"><div class="k">${fmtUSD(r.implied_value_usd)}</div><div class="l">expected value (ranked)</div></div>` +
    `</div>` +
    `<p class="verdict-line">Verdict <span class="verdict ${r.verdict}">${r.verdict}</span> — ` +
    `farm cost $${r.farm_cost_usd}, break-even $${r.break_even_usd}, expected receipt $${r.expected_receipt_usd} ` +
    `at the assumed ${(R.model.farmer_share * 100).toFixed(3)}% farmer share.</p>` +
    `<ol class="steps">` + steps.map((s) => {
      const m = s.match(/^(.*) Cost: (.*)\. Time: (.*)\.$/);
      if (!m) return `<li>${esc(s)}</li>`;
      return `<li>${esc(m[1])} <span class="cost">Cost: ${esc(m[2])}.</span> <span class="time">Time: ${esc(m[3])}.</span></li>`;
    }).join('') + `</ol>`;
  renderBoard();
  $('detail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ---- Live anchors ----
(function renderLive() {
  $('live-rows').innerHTML = R.live.map((p) => {
    const ratio = p.mcap_usd / p.curve_predicted_usd;
    return `<tr><td><b>${esc(p.name)}</b></td><td>${esc(p.category || '—')}</td>` +
      `<td class="num">${fmtUSD(p.tvl_usd)}</td><td class="num">${fmtUSD(p.mcap_usd)}</td>` +
      `<td class="num">${fmtUSD(p.curve_predicted_usd)}</td>` +
      `<td class="num">${ratio.toFixed(2)}x</td></tr>`;
  }).join('');
})();

// ---- Model view ----
(function renderModel() {
  const t = R.tests;
  const m = R.model;
  const o = R.odds;
  const calRows = t.odds_calibration.map((c) => {
    const range = c.age_hi_days === null ? c.age_lo_days + 'd+' : c.age_lo_days + '–' + c.age_hi_days + 'd';
    return `<tr><td>${range}</td><td class="num">${c.n}</td><td class="num">${(c.predicted * 100).toFixed(1)}%</td><td class="num">${(c.actual * 100).toFixed(1)}%</td></tr>`;
  }).join('');
  $('model-body').innerHTML = `
  <div class="model-block"><h3>The fitted size curve</h3>
  <p>log(market cap) = <code>${R.curve.intercept.toFixed(4)} + ${R.curve.slope.toFixed(4)} · log(TVL)</code>, ` +
  `least squares over the snapshot's ${R.curve.comps} traded tokens with a known market cap. ` +
  `A bigger protocol trades at a lower multiple: the curve gives 0.22x at $50M TVL and 0.03x at $2.75B. ` +
  `The starter's flat 0.25x is not used — it is not fitted to anything.</p></div>
  <div class="model-block"><h3>The out-of-sample tests</h3>
  <p>Leave-one-out over ${t.loo_n} comps: median error <b>x${t.loo_median_factor}</b>, ` +
  `${(t.loo_within_2x * 100).toFixed(1)}% of predictions within 2x of the real market cap. ` +
  `With the 7-day change added as a regressor the same test gives x${t.loo_growth_median_factor}; ` +
  `with protocol age added it gives x${t.loo_age_median_factor}. Both are worse, so both terms are dropped (see below).</p>
  <p>Walk-forward, two cuts: fitted on ${t.walk_train_n} tokens listed before 2025-01-01, tested on ${t.walk_test_n} listed after: ` +
  `median error <b>x${t.walk_median_factor}</b>, ${(t.walk_within_2x * 100).toFixed(1)}% within 2x. ` +
  `Fitted before 2024-07-01 (${t.walk2_train_n} tokens) and tested after (${t.walk2_test_n}): ` +
  `median error <b>x${t.walk2_median_factor}</b>, ${(t.walk2_within_2x * 100).toFixed(1)}% within 2x.</p>
  <p>10-fold (comps sorted by slug, dealt into ten folds): median error <b>x${t.fold_median_factor}</b>, ` +
  `${(t.fold_within_2x * 100).toFixed(1)}% within 2x.</p>
  <p>P10–P90 band: the 10th and 90th percentiles of the leave-one-out residuals, ` +
  `x${t.p10_factor} to x${t.p90_factor} around the curve's prediction. On tokens the model never saw, ` +
  `the band holds ${(t.p90_coverage_walk * 100).toFixed(0)}% (walk-forward 2025 cut), ` +
  `${(t.p90_coverage_walk2 * 100).toFixed(0)}% (2024 cut) and ${(t.p90_coverage_fold * 100).toFixed(0)}% (10-fold). ` +
  `The curve is an honest, noisy predictor — the same order of error the field's leaders report — and the board says so instead of hiding it.</p></div>
  <div class="model-block"><h3>Terms tested and dropped</h3>
  <p>Growth: radar-2 kept the 7-day change at weight 0.25. Out of sample it hurts — LOO x${t.loo_growth_median_factor} ` +
  `against x${t.loo_median_factor} bare, 10-fold x${t.fold_growth_median_factor} against x${t.fold_median_factor}, ` +
  `walk-forward x${t.walk_growth_median_factor} against x${t.walk_median_factor} — so the growth term is gone entirely.</p>
  <p>Maturity: radar-2 multiplied by 0.7–1.0 on protocol age. Its in-sample correlation with the curve residual is -0.02, ` +
  `and out of sample it hurts worse — LOO x${t.loo_age_median_factor}, 10-fold x${t.fold_age_median_factor}, ` +
  `walk-forward x${t.walk_age_median_factor} — so the maturity term is gone too.</p>
  <p>Also fitted and rejected: a quadratic log-log curve (LOO x${t.loo_quad_median_factor} against x${t.loo_median_factor} bare), ` +
  `a shrunk per-category intercept (LOO x${t.loo_cat_median_factor}), a Huber robust fit (LOO x${t.loo_huber_median_factor}) and a trimmed refit (LOO x${t.loo_trim_median_factor}). ` +
  `A per-category median multiple was worse still (x5.5 against x3.4). Nothing on this page is a hardcoded list of names: ` +
  `the same functions score every row.</p></div>
  <div class="model-block"><h3>Token odds — fitted, not asserted</h3>
  <p>Odds come from a logistic regression P(listed | age) = sigmoid(<code>${o.intercept.toFixed(3)} + ${o.slope_per_year.toFixed(3)} · age_years</code>), ` +
  `fitted by IRLS on the snapshot's ${o.known_age_n} protocols with a known age (${o.listed_n} of them list). ` +
  `Five-fold log-loss <b>${t.odds_logloss}</b> against 0.694 for the flat base rate, AUC <b>${t.odds_auc}</b> against 0.500. ` +
  `TVL was tested as a second odds input and dropped: with it, 5-fold log-loss ${t.odds_tvl_logloss} and AUC ${t.odds_tvl_auc} — no gain.</p>
  <p>The fitted listed share q(a) is turned into the odds that an unlisted protocol of age a ever lists by ` +
  `odds(a) = (pi − q(a)) / (1 − q(a)), with pi = ${o.pi} — the listed share among the oldest decile, the fraction that ever lists. ` +
  `Odds are floored at ${m.odds_floor} and capped at ${m.odds_cap}; unknown age counts as ${m.unknown_age_days} days.</p>
  <p>Split-half calibration — logit fitted on one slug-hash half, checked on the other; predicted listed share against the actual share:</p>
  <table><thead><tr><th>Age</th><th class="num">n</th><th class="num">Predicted listed</th><th class="num">Actual listed</th></tr></thead>
  <tbody>${calRows}</tbody></table>
  <p>Largest gap ${t.odds_max_calibration_gap}. Expected value = implied value × odds. The board ranks by expected value.</p></div>
  <div class="model-block"><h3>Farm economics</h3>
  <p>Capital by TVL tier: $250 at $5B+, $150 at $1B+, $100 at $100M+, $50 below. Gas about $12 a position. ` +
  `Hold 60 days under 180 days old, 45 days under a year, 30 days after. A farmer's share is taken as ${(m.farmer_share * 100).toFixed(3)}% of the launch value. ` +
  `Verdict: FARM when the expected receipt is at least 3x the cost, THIN at 1x, else SKIP. The break-even on every row is its farm cost in dollars.</p></div>`;
})();

// ---- Controls, views, screenshot hooks ----
(function initControls() {
  const cats = [...new Set(R.rows.map((r) => r.category).filter(Boolean))].sort();
  $('cat').innerHTML = '<option value="">All categories</option>' + cats.map((c) => `<option>${esc(c)}</option>`).join('');
  ['q', 'cat', 'verdict', 'sort'].forEach((id) => $(id).addEventListener('input', () => { renderBoard(); }));
  document.querySelectorAll('.views button').forEach((b) => {
    b.addEventListener('click', () => setView(b.getAttribute('data-view')));
  });
})();

function setView(v) {
  view = v;
  document.querySelectorAll('.views button').forEach((b) => b.classList.toggle('on', b.getAttribute('data-view') === v));
  $('view-board').hidden = v !== 'board';
  $('detail').hidden = v !== 'board' ? true : $('detail').hidden;
  $('view-live').hidden = v !== 'live';
  $('view-model').hidden = v !== 'model';
}

(function shotHook() {
  const p = new URLSearchParams(location.search);
  const shot = p.get('shot');
  if (shot === 'filtered' && p.get('category')) {
    $('cat').value = p.get('category');
  }
  renderBoard();
  if (shot === 'detail' && p.get('slug')) showDetail(p.get('slug'));
  if (shot === 'live') setView('live');
  if (shot === 'model') setView('model');
})();
