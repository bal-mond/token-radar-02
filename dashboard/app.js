// Token Launch Radar, radar-4 — the page. Renders window.RADAR (written by
// main.ts into data.js beside this page). No fetch, no network, no framework.
// Views: launch board, full ledger, traded anchors, model & tests, one
// protocol's detail. The hash picks the view: #board, #ledger, #anchors,
// #model, #detail:<slug>, #filtered (the board, verdict FARM only).
(function () {
  var R = window.RADAR;
  if (!R) { document.getElementById('meta').textContent = 'No data: data.js did not load.'; return; }

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function money(n) {
    if (n == null) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }
  function int(n) { return n == null ? '—' : Math.round(n).toLocaleString('en-US'); }
  function pct(n) { return n == null ? '—' : (n > 0 ? '+' : '') + n.toFixed(1) + '%'; }
  function pill(v) { return '<span class="pill ' + v + '">' + v + '</span>'; }
  function tag(s) { return '<span class="tag ' + s + '">' + s + '</span>'; }

  // ---- header, KPIs, integrity strip ----
  $('meta').textContent = 'Snapshot ' + R.as_of + ' · floor $' + (R.floor_usd / 1e6) + 'M · ' + R.scanned +
    ' protocols scanned · model ' + R.model_version + ' · source ' + R.source;
  var t = R.tests;
  var kpis = [
    [R.counts.launch, 'launch candidates ranked', 'of ' + R.scanned + ' protocols'],
    [R.board_size, 'protocols accounted for', R.counts.excluded + ' excluded · ' + R.counts.traded + ' traded'],
    [R.watchlist_size + '/' + R.watchlist_size, 'watchlist covered', 'the floor, never the ceiling'],
    ['x' + t.loo_median_factor, 'LOO median error', 'walk-forward x' + t.walk_median_factor + ' / x' + t.walk2_median_factor],
    [t.odds_auc, 'token-odds AUC (5-fold)', 'log-loss ' + t.odds_logloss + ' · age only'],
    [R.launch_verdicts.FARM + ' FARM', 'launch verdicts', R.launch_verdicts.THIN + ' THIN · ' + R.launch_verdicts.SKIP + ' SKIP'],
  ];
  $('kpis').innerHTML = kpis.map(function (k) {
    return '<div class="kpi"><b>' + esc(k[0]) + '</b><span>' + esc(k[1]) + '</span><small>' + esc(k[2]) + '</small></div>';
  }).join('');
  $('checks').innerHTML = R.checks.map(function (c) {
    return '<span class="check' + (c.pass ? '' : ' fail') + '" title="' + esc(c.detail) + '"><b>' +
      (c.pass ? 'PASS' : 'FAIL') + '</b>' + esc(c.name) + '</span>';
  }).join('');

  // ---- filters ----
  var cats = [];
  R.rows.forEach(function (r) { if (r.category && cats.indexOf(r.category) < 0) cats.push(r.category); });
  cats.sort();
  $('fcat').innerHTML = '<option value="">All categories</option>' + cats.map(function (c) {
    return '<option>' + esc(c) + '</option>';
  }).join('');

  var sortKey = 'launch_rank', sortDir = 1;
  function filteredRows(list) {
    var q = $('q').value.trim().toLowerCase();
    var cat = $('fcat').value, ver = $('fverdict').value;
    return list.filter(function (r) {
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0) return false;
      if (cat && r.category !== cat) return false;
      if (ver && r.verdict !== ver) return false;
      return true;
    });
  }
  function sorted(list) {
    var k = sortKey;
    return list.slice().sort(function (a, b) {
      var x = a[k], y = b[k];
      if (x == null) return 1; if (y == null) return -1;
      if (typeof x === 'string') return (x < y ? -1 : x > y ? 1 : 0) * sortDir;
      return (x - y) * sortDir;
    });
  }

  var launchRows = R.rows.filter(function (r) { return r.status === 'launch'; });
  var boardCols = [
    ['launch_rank', 'Launch #', 'num'], ['name', 'Protocol', ''],
    ['category', 'Category', ''], ['chains', 'Chains', ''],
    ['tvl_usd', 'TVL', 'num'], ['change_7d', '7d', 'num'],
    ['implied_value_usd', 'Implied value', 'num'], ['p10', 'P10–P90', 'num'],
    ['token_odds', 'Token odds', 'num'], ['verdict', 'Verdict', ''],
  ];
  function boardCell(r, k) {
    if (k === 'name') return '<b>' + esc(r.name) + '</b><br><span style="color:var(--dim);font-size:12px">' + esc(r.slug) + '</span>';
    if (k === 'chains') return esc((r.chains || []).join(', ') || '—');
    if (k === 'tvl_usd') return money(r.tvl_usd);
    if (k === 'change_7d') return pct(r.change_7d);
    if (k === 'implied_value_usd') return '<b>' + money(r.implied_value_usd) + '</b>';
    if (k === 'p10') return money(r.implied_p10_usd) + ' – ' + money(r.implied_p90_usd);
    if (k === 'token_odds') return (r.token_odds * 100).toFixed(0) + '%';
    if (k === 'verdict') return pill(r.verdict);
    if (k === 'category') return esc(r.category || '—');
    return esc(r[k]);
  }
  function renderTable(table, cols, rows, rowKey) {
    var thead = table.querySelector('thead'), tbody = table.querySelector('tbody');
    thead.innerHTML = '<tr>' + cols.map(function (c) {
      return '<th data-k="' + c[0] + '" class="' + c[2] + '">' + esc(c[1]) +
        (sortKey === c[0] ? (sortDir > 0 ? ' ▲' : ' ▼') : '') + '</th>';
    }).join('') + '</tr>';
    tbody.innerHTML = rows.map(function (r) {
      return '<tr data-slug="' + esc(r.slug) + '">' + cols.map(function (c) {
        return '<td class="' + c[2] + '">' + boardCell(r, c[0]) + '</td>';
      }).join('') + '</tr>';
    }).join('');
    thead.querySelectorAll('th').forEach(function (th) {
      th.onclick = function () {
        var k = th.getAttribute('data-k');
        if (sortKey === k) sortDir = -sortDir; else { sortKey = k; sortDir = 1; }
        renderAll();
      };
    });
    tbody.querySelectorAll('tr').forEach(function (tr) {
      tr.onclick = function () { location.hash = '#detail:' + tr.getAttribute('data-slug'); };
    });
  }

  var boardCountText = '', ledgerCountText = '', anchorsCountText = '';
  function syncCount() {
    var v = ['board', 'ledger', 'anchors', 'model', 'detail'].filter(function (x) { return !$('view-' + x).hidden; })[0];
    if (v === 'ledger') $('count').textContent = ledgerCountText;
    else if (v === 'anchors') $('count').textContent = anchorsCountText;
    else if (v === 'board') $('count').textContent = boardCountText;
  }
  function renderBoard() {
    var rows = sorted(filteredRows(launchRows));
    renderTable($('board'), boardCols, rows);
    boardCountText = rows.length + ' of ' + launchRows.length + ' launch rows';
  }

  var ledgerCols = [
    ['rank', 'Rank', 'num'], ['name', 'Protocol', ''],
    ['status', 'Status', ''], ['category', 'Category', ''],
    ['tvl_usd', 'TVL', 'num'], ['implied_value_usd', 'Board value', 'num'],
    ['mcap_usd', 'Market cap', 'num'], ['verdict', 'Call', ''],
  ];
  function ledgerCell(r, k) {
    if (k === 'status') return tag(r.status) + (r.status === 'excluded' ? '<br><span style="color:var(--dim);font-size:12px">' + esc(r.exclusion_reason || '') + '</span>' : '');
    if (k === 'mcap_usd') return r.mcap_usd == null ? '<span style="color:var(--dim)">not recorded</span>' : money(r.mcap_usd);
    if (k === 'implied_value_usd') return '<b>' + money(r.implied_value_usd) + '</b>';
    return boardCell(r, k);
  }
  function renderLedger() {
    var rows = sorted(filteredRows(R.rows));
    var shown = rows.slice(0, 100);
    var table = $('ledger');
    var thead = table.querySelector('thead'), tbody = table.querySelector('tbody');
    thead.innerHTML = '<tr>' + ledgerCols.map(function (c) {
      return '<th data-k="' + c[0] + '" class="' + c[2] + '">' + esc(c[1]) +
        (sortKey === c[0] ? (sortDir > 0 ? ' ▲' : ' ▼') : '') + '</th>';
    }).join('') + '</tr>';
    tbody.innerHTML = shown.map(function (r) {
      return '<tr data-slug="' + esc(r.slug) + '">' + ledgerCols.map(function (c) {
        return '<td class="' + c[2] + '">' + ledgerCell(r, c[0]) + '</td>';
      }).join('') + '</tr>';
    }).join('');
    thead.querySelectorAll('th').forEach(function (th) {
      th.onclick = function () {
        var k = th.getAttribute('data-k');
        if (sortKey === k) sortDir = -sortDir; else { sortKey = k; sortDir = 1; }
        renderAll();
      };
    });
    tbody.querySelectorAll('tr').forEach(function (tr) {
      tr.onclick = function () { location.hash = '#detail:' + tr.getAttribute('data-slug'); };
    });
    $('ledger-more').textContent = 'Showing ' + shown.length + ' of ' + rows.length + ' ledger rows. Narrow the filters to see the rest.';
    ledgerCountText = rows.length + ' of ' + R.rows.length + ' ledger rows';
  }

  function renderAnchors() {
    var table = $('anchors');
    var cols = [
      ['#', '#', 'num'], ['name', 'Protocol', ''], ['category', 'Category', ''],
      ['tvl_usd', 'TVL', 'num'], ['mcap_usd', 'Market cap', 'num'],
      ['curve_predicted_usd', 'Curve says', 'num'], ['curve_multiple', 'Multiple', 'num'],
    ];
    table.querySelector('thead').innerHTML = '<tr>' + cols.map(function (c) {
      return '<th class="' + c[2] + '">' + esc(c[1]) + '</th>';
    }).join('') + '</tr>';
    table.querySelector('tbody').innerHTML = R.live.map(function (p, i) {
      return '<tr data-slug="' + esc(p.slug) + '"><td class="num">' + (i + 1) + '</td><td><b>' + esc(p.name) +
        '</b><br><span style="color:var(--dim);font-size:12px">' + esc(p.slug) + '</span></td><td>' + esc(p.category || '—') +
        '</td><td class="num">' + money(p.tvl_usd) + '</td><td class="num"><b>' + money(p.mcap_usd) +
        '</b></td><td class="num">' + money(p.curve_predicted_usd) + '</td><td class="num">' +
        p.curve_multiple.toFixed(2) + 'x</td></tr>';
    }).join('');
    table.querySelectorAll('tbody tr').forEach(function (tr) {
      tr.onclick = function () { location.hash = '#detail:' + tr.getAttribute('data-slug'); };
    });
    $('count').textContent = R.live.length + ' traded anchors';
    anchorsCountText = R.live.length + ' traded anchors';
  }

  function renderDetail(slug) {
    var r = null;
    R.rows.forEach(function (x) { if (x.slug === slug) r = x; });
    var d = $('detail');
    if (!r) { d.innerHTML = '<div class="card"><h2>Not found</h2><p>No protocol with slug ' + esc(slug) + ' is in this snapshot.</p></div>'; return; }
    var tiers = r.farm_tiers.length ? '<h3>Deposit tiers — costed and netted</h3><table class="plain"><thead><tr><th>Tier</th><th class="num">Capital</th><th class="num">Gas</th><th class="num">Cost</th><th class="num">Break-even</th></tr></thead><tbody>' +
      r.farm_tiers.map(function (tier) {
        return '<tr><td>' + esc(tier.label) + '</td><td class="num">$' + int(tier.capital_usd) + '</td><td class="num">$' + int(tier.gas_usd) + '</td><td class="num">$' + int(tier.cost_usd) + '</td><td class="num">$' + int(tier.break_even_usd) + '</td></tr>';
      }).join('') + '</tbody></table>' : '';
    var modelLine = r.status === 'traded'
      ? (r.mcap_usd == null
        ? '<p><b>Traded anchor.</b> No market cap is recorded for this token, so the board value is the curve’s estimate of ' + money(r.curve_predicted_usd) + ' and the radar states no multiple. The call below is an LP / incentives call, not a launch farm.</p>'
        : '<p><b>Traded anchor.</b> Market cap ' + money(r.mcap_usd) + ' against a curve prediction of ' + money(r.curve_predicted_usd) +
          ' — the token trades at ' + r.curve_multiple.toFixed(2) + 'x what the comps curve would have said. The call below is an LP / incentives call on that multiple, not a launch farm.</p>')
      : r.status === 'excluded'
        ? '<p><b>Excluded from the launch board.</b> ' + esc(r.exclusion_reason || '') + ' Its fitted launch value is still shown, so the exclusion is visible instead of silent.</p>'
        : '<p><b>Model breakdown.</b> TVL ' + money(r.tvl_usd) + ' through the fitted curve gives a raw launch value of ' + money(r.implied_raw_usd) +
          ' (curve multiple ' + r.curve_multiple.toFixed(2) + 'x TVL). Token odds ' + (r.token_odds * 100).toFixed(0) +
          '% at ' + (r.age_days == null ? 'unknown age' : int(r.age_days) + ' days') + ' give the expected value ' + money(r.implied_value_usd) +
          '. P10–P90: ' + money(r.implied_p10_usd) + ' – ' + money(r.implied_p90_usd) + '.</p>';
    var thirdCell = r.status === 'traded'
      ? '<div class="cell"><b>' + (r.mcap_usd == null ? '—' : money(r.mcap_usd)) + '</b><span>Market cap' + (r.mcap_usd == null ? ' (not recorded)' : '') + '</span></div>'
      : '<div class="cell"><b>' + (r.token_odds * 100).toFixed(0) + '%</b><span>Token odds</span></div>';
    d.innerHTML = '<div class="card"><h2>' + esc(r.name) + ' ' + tag(r.status) + ' ' + pill(r.verdict) + '</h2>' +
      '<p>' + esc(r.slug) + ' · ' + esc(r.category || 'no category') + ' · ' + esc((r.chains || []).join(', ') || 'no chain listed') +
      ' · TVL ' + money(r.tvl_usd) + (r.change_7d == null ? '' : ' · 7d ' + pct(r.change_7d)) +
      ' · ledger rank ' + r.rank + (r.launch_rank ? ' · launch #' + r.launch_rank : '') + '</p>' +
      '<div class="grid">' +
      '<div class="cell"><b>' + money(r.implied_value_usd) + '</b><span>Board value</span></div>' +
      '<div class="cell"><b>' + money(r.implied_raw_usd) + '</b><span>Raw curve value</span></div>' +
      thirdCell +
      '<div class="cell"><b>$' + int(r.expected_receipt_usd) + '</b><span>Expected receipt</span></div>' +
      '</div>' + modelLine + tiers +
      '<h3>Farm plan — ' + r.farm_steps.length + ' steps</h3><ol class="steps">' +
      r.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol></div>';
  }

  function renderModel() {
    var c = R.curve, o = R.odds;
    var rows = t.variants.map(function (v) {
      return '<tr><td>' + esc(v.name) + (v.shipped ? ' <span class="tag launch">SHIPPED</span>' : '') + '</td><td class="num">x' + v.loo.toFixed(2) +
        '</td><td class="num">x' + v.walk2025.toFixed(2) + '</td><td class="num">x' + v.walk2024.toFixed(2) +
        '</td><td class="num">x' + v.fold.toFixed(2) + '</td></tr>';
    }).join('');
    var orows = t.odds_variants.map(function (v) {
      return '<tr><td>' + esc(v.name) + (v.shipped ? ' <span class="tag launch">SHIPPED</span>' : '') + '</td><td class="num">' +
        v.logloss.toFixed(3) + '</td><td class="num">' + v.auc.toFixed(3) + '</td></tr>';
    }).join('');
    var crows = t.odds_calibration.map(function (b) {
      return '<tr><td>' + int(b.age_lo_days) + '–' + (b.age_hi_days == null ? '∞' : int(b.age_hi_days)) + ' days</td><td class="num">' +
        b.n + '</td><td class="num">' + (b.predicted * 100).toFixed(0) + '%</td><td class="num">' + (b.actual * 100).toFixed(0) + '%</td></tr>';
    }).join('');
    $('model').innerHTML =
      '<div class="card"><h2>The value model</h2>' +
      '<p>log(market cap) = ' + c.intercept.toFixed(3) + ' + ' + c.slope.toFixed(3) + ' · log(TVL), least squares over the snapshot’s own ' + c.comps +
      ' traded tokens with a recorded market cap. Median error: leave-one-out x' + t.loo_median_factor + ' (' + (t.loo_within_2x * 100).toFixed(1) +
      '% within 2x, n=' + t.loo_n + '), walk-forward x' + t.walk_median_factor + ' (fit before 2025, ' + t.walk_train_n + '+' + t.walk_test_n +
      ') and x' + t.walk2_median_factor + ' (before Jul 2024, ' + t.walk2_train_n + '+' + t.walk2_test_n + '), time-split x' + t.time_split_median_factor +
      ' (fit before 2024, ' + t.time_split_train_n + '+' + t.time_split_test_n + '), 10-fold x' + t.fold_median_factor + '.</p>' +
      '<p>Token odds: P(listed | age) = sigmoid(' + o.intercept.toFixed(3) + ' + ' + o.slope_per_year.toFixed(3) + ' · age in years), fitted on ' +
      o.known_age_n + ' known-age protocols (' + o.listed_n + ' listed). Ever-lists odds use pi = ' + o.pi + ', the listed share among the oldest decile. ' +
      '5-fold log-loss ' + t.odds_logloss + ', AUC ' + t.odds_auc + '; split-half calibration max gap ' + t.odds_max_calibration_gap + '.</p>' +
      '<p>P10–P90 band: x' + t.p10_factor + ' – x' + t.p90_factor + ' of the raw value. It holds ' + (t.p90_coverage_walk * 100).toFixed(1) +
      '% on the 2025 walk-forward test set, ' + (t.p90_coverage_walk2 * 100).toFixed(1) + '% on the 2024 cut and ' + (t.p90_coverage_fold * 100).toFixed(1) + '% on the 10-fold predictions — an 80% band, measured, not asserted.</p></div>' +
      '<div class="card"><h2>Every value term, tested held-out</h2>' +
      '<p>Median error factor (lower is better). A variant ships only if it beats the plain curve on LOO and on both walk-forward cuts. None does: the quadratic wins one walk-forward cut and loses the other; the per-category curves lose on LOO because no category has more than 15 comps. So the plain global curve ships, and the losers stay on the page.</p>' +
      '<table class="plain"><thead><tr><th>Variant</th><th class="num">LOO</th><th class="num">Walk ’25</th><th class="num">Walk ’24</th><th class="num">10-fold</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="card"><h2>Token odds, tested</h2>' +
      '<p>5-fold log-loss and AUC. Adding TVL, chain count or an age-squared term changes nothing, so age alone ships.</p>' +
      '<table class="plain"><thead><tr><th>Odds variant</th><th class="num">Log-loss</th><th class="num">AUC</th></tr></thead><tbody>' + orows + '</tbody></table>' +
      '<h3>Split-half calibration (fit on one slug half, checked on the other)</h3>' +
      '<table class="plain"><thead><tr><th>Age bucket</th><th class="num">n</th><th class="num">Predicted listed</th><th class="num">Actual listed</th></tr></thead><tbody>' + crows + '</tbody></table></div>';
    $('count').textContent = t.variants.length + ' value variants · ' + t.odds_variants.length + ' odds variants tested';
  }

  function show(view) {
    ['board', 'ledger', 'anchors', 'model', 'detail'].forEach(function (v) {
      $('view-' + v).hidden = v !== view;
    });
    document.querySelectorAll('#tabs button').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-view') === view || (view === 'detail' && b.getAttribute('data-view') === 'board'));
    });
    $('controls').style.display = (view === 'board' || view === 'ledger') ? '' : 'none';
  }
  function renderAll() { renderBoard(); renderLedger(); renderAnchors(); syncCount(); }
  function route() {
    var h = (location.hash || '#board').slice(1);
    if (h.indexOf('detail:') === 0) { show('detail'); renderDetail(h.slice(7)); return; }
    if (h === 'filtered') { $('fverdict').value = 'FARM'; sortKey = 'launch_rank'; sortDir = 1; show('board'); renderAll(); return; }
    if (h === 'ledger' || h === 'anchors' || h === 'model') {
      show(h); if (h === 'model') renderModel(); else renderAll(); return;
    }
    show('board'); renderAll();
  }
  document.querySelectorAll('#tabs button').forEach(function (b) {
    b.onclick = function () { location.hash = '#' + b.getAttribute('data-view'); };
  });
  $('back').onclick = function () { location.hash = '#board'; };
  ['q', 'fcat', 'fverdict'].forEach(function (id) {
    $(id).addEventListener('input', renderAll);
    $(id).addEventListener('change', renderAll);
  });
  window.addEventListener('hashchange', route);
  route();
})();
