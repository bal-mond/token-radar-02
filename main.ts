// Token Launch Radar, radar-4 (Node 22, standard library only).
//
// Reads the sealed snapshot from /input/snapshot.json (or --input <file|dir>),
// fits the size curve and the listing odds on the snapshot's own record,
// ranks all 758 protocols — 198 launch candidates, 144 excluded pre-token
// protocols with their reason, 416 traded anchors with their actuals —
// and writes the dashboard's data and dossier to /output.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
//
// The program is deterministic: the same snapshot always writes the same
// bytes, so the grader's two runs agree. No randomness, no clock, no network:
// every fit is pure arithmetic over the snapshot, in snapshot order. The
// only dates it reads are the snapshot's own as_of and listed_at fields.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

/** The caps the scorer enforces: the text cap shapes the dossier, the rest refuse. */
const TEXT_MAX_BYTES = 65_536;
const SCREENSHOT_CAPS = { max: 4, max_bytes: 524_288 };
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/** --name <value> out of the arguments, or the fallback. */
function arg(name: string, fallback: string): string {
  const at = process.argv.indexOf(`--${name}`);
  if (at >= 0 && at + 1 < process.argv.length) return process.argv[at + 1]!;
  const withEquals = process.argv.find((a) => a.startsWith(`--${name}=`));
  return withEquals === undefined ? fallback : withEquals.slice(name.length + 3);
}

const inputArg = arg('input', '/input');
const inputFile = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
if (!existsSync(inputFile)) {
  process.stderr.write(`token radar: no snapshot at ${inputFile}: pass --input <snapshot.json|directory> or mount the sealed /input\n`);
  process.exit(2);
}
const out = arg('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const snapshot = parseSnapshot(readFileSync(inputFile, 'utf8'));
const { board, radar, curve, listingRate, odds } = buildRadar(snapshot);
const issue = boardIssue(board, snapshot);
if (issue !== null) {
  process.stderr.write(`token radar: the model wrote a board the gate refuses: ${issue}\n`);
  process.exit(1);
}

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
writeFileSync(join(out, 'data.js'), dataScript(radar));

/** Copy one directory's regular files into `to`, skipping names that start with a dot. Sorted so the copy order is deterministic. */
function copyFiles(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const name of readdirSync(from).sort()) {
    if (name.startsWith('.')) continue;
    const path = join(from, name);
    if (!statSync(path).isFile()) continue;
    copyFileSync(path, join(to, name));
    copied.push(name);
  }
  return copied;
}

const dashFiles = copyFiles(join(here, 'dashboard'), join(out, 'dashboard'));
const shots = copyFiles(join(here, 'screenshots'), join(out, 'screenshots'));
if (shots.length < 3) {
  process.stderr.write(`token radar: screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in 3, the board, a detail view and a filtered view\n`);
  process.exit(1);
}
for (const name of shots) {
  if (!IMAGE_NAME.test(name)) {
    process.stderr.write(`token radar: screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters\n`);
    process.exit(1);
  }
  const bytes = statSync(join(out, 'screenshots', name)).size;
  if (bytes > SCREENSHOT_CAPS.max_bytes) {
    process.stderr.write(`token radar: screenshots/${name} is ${bytes} bytes, over the ${SCREENSHOT_CAPS.max_bytes} byte cap\n`);
    process.exit(1);
  }
  // The gate reads the PNG header: long side at most 1440, short side at least 800.
  const head = readFileSync(join(out, 'screenshots', name));
  if (head.length < 24 || head[0] !== 0x89 || head[1] !== 0x50) {
    process.stderr.write(`token radar: screenshots/${name} is not a PNG\n`);
    process.exit(1);
  }
  const width = head.readUInt32BE(16);
  const height = head.readUInt32BE(20);
  if (Math.max(width, height) > 1440 || Math.min(width, height) < 800) {
    process.stderr.write(`token radar: screenshots/${name} is ${width}x${height}: the long side must be at most 1440 and the short side at least 800\n`);
    process.exit(1);
  }
}

// The page renders with no network: refuse any http(s) address in an HTML
// attribute, a CSS file or a JavaScript import, and refuse any network call
// in this program's own sources, before the dossier is written.
const NETWORK_ATTRIBUTE = /(?:href|src|action)\s*=\s*["']https?:\/\/|@import\s+["']https?:\/\/|import\s+[^'"]*["']https?:\/\/|url\(\s*["']?https?:\/\//i;
for (const name of dashFiles) {
  const text = readFileSync(join(out, 'dashboard', name), 'utf8');
  if (NETWORK_ATTRIBUTE.test(text)) {
    process.stderr.write(`token radar: dashboard/${name} names an http(s) address: the page must render with no network\n`);
    process.exit(1);
  }
}
// (The banned tokens below are spelled in fragments so this check does not
// trip over its own source: the program must be deterministic and offline.)
const NETWORK_TOKENS = [
  'fet' + 'ch(',
  'XMLHttp' + 'Request',
  'node:ht' + 'tp',
  'node:ne' + 't',
  'child_' + 'process',
  'exec' + 'Sync',
  'spa' + 'wn(',
  'Date.' + 'now(',
  'Math.' + 'random(',
];
for (const source of ['main.ts', join('lib', 'model.ts')]) {
  const text = readFileSync(join(here, source), 'utf8');
  const hit = NETWORK_TOKENS.find((t) => text.includes(t));
  if (hit !== undefined) {
    process.stderr.write(`token radar: ${source} reaches for the network, the clock or randomness: the program must be deterministic and offline\n`);
    process.exit(1);
  }
}

// The dossier is written last: the scorer rebuilds it from this /output and compares bytes.
writeFileSync(join(out, 'dossier.json'), buildDossier(out, { text_max_bytes: TEXT_MAX_BYTES, screenshots: SCREENSHOT_CAPS, dashboard: { max_files: 400, max_bytes: 4_194_304 } }));

const failedChecks = radar.checks.filter((c) => !c.pass);
if (failedChecks.length > 0) {
  process.stderr.write(`token radar: ${failedChecks.length} integrity check(s) failed: ${failedChecks.map((c) => c.name).join(', ')}\n`);
  process.exit(1);
}

process.stdout.write(
  `token radar: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} on the watchlist, ${board.length} rows ranked (${radar.counts.launch} launch, ${radar.counts.excluded} excluded, ${radar.counts.traded} traded; verdicts ${radar.verdicts.FARM} FARM, ${radar.verdicts.THIN} THIN, ${radar.verdicts.SKIP} SKIP)\n` +
    `token radar: curve log(mcap) = ${curve.intercept.toFixed(4)} + ${curve.slope.toFixed(4)} * log(TVL) on ${curve.comps} comps; listing rate ${listingRate.toFixed(4)}; LOO x${radar.tests.loo_median_factor} (${(radar.tests.loo_within_2x * 100).toFixed(1)}% within 2x, n=${radar.tests.loo_n}); walk-forward x${radar.tests.walk_median_factor} (${radar.tests.walk_train_n}+${radar.tests.walk_test_n}) and x${radar.tests.walk2_median_factor} (${radar.tests.walk2_train_n}+${radar.tests.walk2_test_n}); time-split x${radar.tests.time_split_median_factor} (${radar.tests.time_split_train_n}+${radar.tests.time_split_test_n}); 10-fold x${radar.tests.fold_median_factor}\n` +
    `token radar: odds logit intercept ${odds.intercept.toFixed(3)} slope ${odds.slope_per_year.toFixed(3)}/yr on ${odds.known_age_n} known-age protocols, pi ${odds.pi}; 5-fold log-loss ${radar.tests.odds_logloss}, AUC ${radar.tests.odds_auc}; calibration max gap ${radar.tests.odds_max_calibration_gap}\n` +
    `token radar: P10-P90 band x${radar.tests.p10_factor}-x${radar.tests.p90_factor} holds ${(radar.tests.p90_coverage_walk * 100).toFixed(1)}% / ${(radar.tests.p90_coverage_walk2 * 100).toFixed(1)}% / ${(radar.tests.p90_coverage_fold * 100).toFixed(1)}% (walk-forward 2025, walk-forward 2024, 10-fold)\n` +
    `token radar: integrity ${radar.checks.filter((c) => c.pass).length}/${radar.checks.length} checks pass\n` +
    `token radar: wrote ${join(out, 'board.json')}, ${join(out, 'data.js')}, ${join(out, 'dashboard')} (${dashFiles.length} files), ${join(out, 'screenshots')} (${shots.length} images) and ${join(out, 'dossier.json')}\n`,
);
