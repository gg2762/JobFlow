// Local capture server for JOBFLOW MVP.
// - POST /capture          : append a JD row to queue.csv
// - GET  /queue            : return queue.csv as JSON
// - POST /row/<id>/update  : update specific columns for a row
// - GET  /assets/<file>    : serve static assets (logo, etc.)
// - GET  /                 : dashboard
//
// No external deps. Uses Node native http + fs.

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = parseInt(process.env.JOBFLOW_PORT || '3737', 10);
// ROOT is the project root (the directory containing server.js). Portable across clone locations.
const ROOT = __dirname;
const USER_DATA = path.join(ROOT, 'user_data');
const QUEUE_PATH = path.join(USER_DATA, 'queue.csv');
const ASSETS_DIR = path.join(ROOT, 'assets');
const HEADERS = [
  'id','captured_at','source_url','source_domain','page_title','jd_text',
  'status','blueprint','docx_path','pdf_path','processed_at','applied_at','notes',
  'application_questions'  // JSON-encoded array of {q, a, answered_at}
];

// ----- CSV helpers (RFC 4180 — quote everything, double internal quotes) -----
const quote = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
const rowToCsv = obj => HEADERS.map(h => quote(obj[h])).join(',') + '\n';

function ensureQueue() {
  if (!fs.existsSync(USER_DATA)) fs.mkdirSync(USER_DATA, { recursive: true });
  if (!fs.existsSync(QUEUE_PATH)) {
    fs.writeFileSync(QUEUE_PATH, HEADERS.join(',') + '\n');
    return;
  }
  // Schema migration: if current headers differ from HEADERS, rewrite the file with the new schema.
  const firstLine = fs.readFileSync(QUEUE_PATH, 'utf8').split('\n')[0];
  if (firstLine.replace(/\r/g, '') !== HEADERS.join(',')) {
    const rows = parseCsv(fs.readFileSync(QUEUE_PATH, 'utf8'));
    for (const r of rows) for (const h of HEADERS) if (!(h in r)) {
      r[h] = h === 'application_questions' ? '[]' : '';
    }
    const body = HEADERS.join(',') + '\n' + rows.map(rowToCsv).join('');
    fs.writeFileSync(QUEUE_PATH, body);
    console.log(`Migrated queue.csv schema (now ${HEADERS.length} columns).`);
  }
}

function parseCsv(text) {
  const rows = [];
  let cur = [''], inQuotes = false, i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i+1] === '"') { cur[cur.length-1] += '"'; i += 2; continue; }
      if (ch === '"') { inQuotes = false; i++; continue; }
      cur[cur.length-1] += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === ',') { cur.push(''); i++; continue; }
    if (ch === '\n') { rows.push(cur); cur = ['']; i++; continue; }
    if (ch === '\r') { i++; continue; }
    cur[cur.length-1] += ch; i++;
  }
  if (cur.length > 1 || cur[0] !== '') rows.push(cur);
  if (rows.length === 0) return [];
  const headers = rows[0];
  return rows.slice(1).filter(r => !(r.length === 1 && r[0] === '')).map(r => {
    const o = {};
    headers.forEach((h, idx) => { o[h] = idx < r.length ? r[idx] : ''; });
    return o;
  });
}

// ----- request helpers -----
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, {
    'content-type': type,
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
  });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

// ----- handlers -----
async function handleCapture(req, res) {
  let payload;
  try { payload = JSON.parse(await readBody(req)); }
  catch { return send(res, 400, { error: 'invalid json' }); }
  const { url: srcUrl, title, text } = payload;
  if (!srcUrl || !text) return send(res, 400, { error: 'missing url or text' });

  const captured_at = new Date().toISOString();
  const id = `cap_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`;
  let domain = '';
  try { domain = new URL(srcUrl).hostname; } catch {}

  const row = {
    id, captured_at,
    source_url: srcUrl,
    source_domain: domain,
    page_title: title || '',
    jd_text: text,
    status: 'Queued',
    blueprint: '',
    docx_path: '',
    pdf_path: '',
    processed_at: '',
    applied_at: '',
    notes: '',
    application_questions: '[]',
  };

  ensureQueue();
  fs.appendFileSync(QUEUE_PATH, rowToCsv(row));
  console.log(`[capture] ${id} ← ${domain} : ${(title || '').slice(0, 60)}`);
  return send(res, 200, { ok: true, id, status: 'Queued' });
}

function handleQueue(req, res) {
  ensureQueue();
  const text = fs.readFileSync(QUEUE_PATH, 'utf8');
  const rows = parseCsv(text);
  const parsed = url.parse(req.url, true);
  const full = parsed.query.full === '1';
  const out = full ? rows : rows.map(r => ({ ...r, jd_text: (r.jd_text || '').slice(0, 240) + ((r.jd_text || '').length > 240 ? '…' : '') }));
  return send(res, 200, out);
}

async function handleRowUpdate(req, res, id) {
  let patch;
  try { patch = JSON.parse(await readBody(req)); }
  catch { return send(res, 400, { error: 'invalid json' }); }
  ensureQueue();
  const rows = parseCsv(fs.readFileSync(QUEUE_PATH, 'utf8'));
  const idx = rows.findIndex(r => r.id === id);
  if (idx === -1) return send(res, 404, { error: 'row not found', id });
  for (const k of HEADERS) if (k in patch) rows[idx][k] = patch[k];
  const body = HEADERS.join(',') + '\n' + rows.map(rowToCsv).join('');
  const tmp = QUEUE_PATH + '.tmp';
  fs.writeFileSync(tmp, body);
  fs.renameSync(tmp, QUEUE_PATH);
  console.log(`[update] ${id} ← ${Object.keys(patch).join(',')}`);
  return send(res, 200, { ok: true, id, row: rows[idx] });
}

// ----- dashboard -----
const DASHBOARD_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>JOBFLOW · Queue</title>
<link rel="icon" type="image/png" href="/assets/logo.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap">
<style>
  :root {
    --bg-deep: #0A0E1A;
    --bg-card: #0F1729;
    --bg-elev: #131D33;
    --bg-row-hover: #14203A;
    --border: #1E293B;
    --border-hi: #334155;
    --accent: #22D3EE;
    --accent-glow: #67E8F9;
    --accent-dim: #0E7490;
    --text: #F1F5F9;
    --text-dim: #94A3B8;
    --text-faint: #64748B;
    --ok: #34D399;
    --warn: #FBBF24;
    --danger: #F87171;
    --info: #60A5FA;
    --purple: #C084FC;
    --gray: #64748B;
    --orange: #FB923C;
    --mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    --sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: var(--bg-deep); color: var(--text); font-family: var(--sans); font-size: 14px; line-height: 1.5; -webkit-font-smoothing: antialiased; }
  ::selection { background: var(--accent-dim); color: var(--text); }
  a { color: var(--accent); text-decoration: none; }
  a:hover { color: var(--accent-glow); text-decoration: underline; }
  code { font-family: var(--mono); font-size: 0.9em; background: var(--bg-elev); padding: 1px 6px; border-radius: 3px; color: var(--accent); }
  button { font-family: inherit; }

  /* ===== Top bar ===== */
  .topbar { display: flex; align-items: center; gap: 24px; padding: 18px 28px; border-bottom: 1px solid var(--border); background: linear-gradient(180deg, var(--bg-card) 0%, var(--bg-deep) 100%); }
  .brand { display: flex; align-items: baseline; gap: 12px; }
  .wordmark { font-family: var(--mono); font-size: 18px; font-weight: 700; letter-spacing: 0.18em; color: var(--accent); text-shadow: 0 0 12px rgba(34, 211, 238, 0.55), 0 0 24px rgba(34, 211, 238, 0.25); }
  .tagline { font-family: var(--mono); font-size: 11px; color: var(--text-faint); letter-spacing: 0.05em; }
  .health { margin-left: auto; display: flex; align-items: center; gap: 8px; font-family: var(--mono); font-size: 11px; color: var(--text-dim); }
  .health .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--ok); box-shadow: 0 0 6px var(--ok); animation: pulse 2s ease-in-out infinite; }
  @keyframes pulse { 50% { opacity: 0.5; } }

  /* ===== Main container ===== */
  main { padding: 28px; max-width: 1700px; margin: 0 auto; }

  /* ===== KPI cards row (with pipe connectors) ===== */
  .cards { display: grid; grid-template-columns: 1fr 36px 1fr 36px 1fr; align-items: stretch; margin: 0 0 28px; }
  .card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 18px 20px; min-height: 192px; display: flex; flex-direction: column; }
  .card .label { font-family: var(--mono); font-size: 10px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); margin: 0 0 14px; }
  .pipe { position: relative; display: flex; align-items: center; justify-content: center; }
  .pipe::before { content: ''; position: absolute; top: 50%; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent 0%, var(--accent) 50%, transparent 100%); box-shadow: 0 0 4px var(--accent); }
  .pipe::after { content: '▸'; position: relative; color: var(--accent); font-size: 16px; line-height: 1; background: var(--bg-deep); padding: 0 6px; text-shadow: 0 0 8px var(--accent); }

  /* card 1: control tower */
  .control-tower .stat-big { font-family: var(--mono); font-size: 44px; font-weight: 700; line-height: 1; color: var(--text); }
  .control-tower .stat-big-label { font-size: 12px; color: var(--text-dim); margin-top: 4px; }
  .control-tower .stat-rows { margin-top: auto; display: flex; flex-direction: column; gap: 6px; }
  .control-tower .stat-row { display: flex; justify-content: space-between; align-items: baseline; font-size: 12px; }
  .control-tower .stat-row .k { color: var(--text-dim); }
  .control-tower .stat-row .v { font-family: var(--mono); font-weight: 600; color: var(--text); }

  /* donut cards */
  .donut-card { display: grid; grid-template-columns: 88px 1fr; gap: 18px; align-items: center; }
  .donut-card .label { grid-column: 1 / -1; }
  .donut { width: 88px; height: 88px; }
  .donut text { font-family: var(--mono); font-size: 14px; font-weight: 700; fill: var(--text); }
  .donut text.donut-sub { font-size: 6px; fill: var(--text-dim); font-weight: 500; }
  .legend { display: flex; flex-direction: column; gap: 5px; font-size: 12px; }
  .legend-row { display: grid; grid-template-columns: 10px 1fr auto; gap: 8px; align-items: center; }
  .legend-row .swatch { width: 8px; height: 8px; border-radius: 2px; }
  .legend-row .name { color: var(--text-dim); }
  .legend-row .count { font-family: var(--mono); font-weight: 600; color: var(--text); }
  .legend-empty { color: var(--text-faint); font-size: 12px; font-style: italic; }

  /* ===== Controls (search/filter) ===== */
  .controls { display: flex; gap: 10px; align-items: center; margin: 0 0 16px; flex-wrap: wrap; }
  .controls input, .controls select { background: var(--bg-card); border: 1px solid var(--border); color: var(--text); padding: 8px 12px; border-radius: 6px; font: inherit; font-size: 13px; }
  .controls input { min-width: 280px; }
  .controls input::placeholder { color: var(--text-faint); }
  .controls input:focus, .controls select:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(34, 211, 238, 0.15); }
  .controls .count { font-family: var(--mono); color: var(--text-dim); font-size: 12px; margin-left: auto; }

  .meta { color: var(--text-faint); font-size: 11px; margin: -8px 0 16px; font-family: var(--mono); }

  /* ===== Banner (pending questions hint) ===== */
  .banner { background: rgba(251, 191, 36, 0.08); border: 1px solid rgba(251, 191, 36, 0.3); color: var(--warn); padding: 11px 14px; border-radius: 6px; margin: 0 0 14px; font-size: 13px; display: none; }
  .banner code { background: rgba(251, 191, 36, 0.15); color: var(--warn); }

  /* ===== Table ===== */
  table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
  th { background: var(--bg-elev); font-family: var(--mono); font-weight: 600; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-dim); padding: 12px 14px; text-align: left; border-bottom: 1px solid var(--border); cursor: pointer; user-select: none; }
  th:hover { color: var(--text); background: var(--bg-row-hover); }
  th .arrow { color: var(--text-faint); font-size: 10px; margin-left: 6px; }
  th.sorted .arrow { color: var(--accent); }
  td { padding: 12px 14px; border-bottom: 1px solid var(--border); vertical-align: middle; color: var(--text); }
  tbody tr:last-child td { border-bottom: 0; }
  tr.data-row { cursor: pointer; transition: background 0.1s; }
  tr.data-row:hover { background: var(--bg-row-hover); }
  tr.expanded { background: var(--bg-row-hover); }
  tr.expanded td { border-bottom-color: transparent; }

  /* table column tweaks */
  td .src { font-family: var(--mono); font-size: 12px; color: var(--text-dim); }
  td .blueprint { font-family: var(--mono); font-size: 12px; color: var(--text-dim); }
  td .captured { font-family: var(--mono); font-size: 12px; color: var(--text-dim); white-space: nowrap; }
  td .jd { color: var(--text-dim); max-width: 360px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; font-size: 12px; }
  td .title { color: var(--text); font-weight: 500; }

  .muted { color: var(--text-faint); }

  /* status badges */
  .status { display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 10px; font-family: var(--mono); font-size: 10px; font-weight: 600; letter-spacing: 0.04em; }
  .status::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
  .status-Queued    { background: rgba(251, 191, 36, 0.12); color: var(--warn); }
  .status-Ready     { background: rgba(52, 211, 153, 0.12); color: var(--ok); }
  .status-Submitted { background: rgba(96, 165, 250, 0.12); color: var(--info); }
  .status-Interview { background: rgba(192, 132, 252, 0.12); color: var(--purple); }
  .status-Rejected  { background: rgba(248, 113, 113, 0.12); color: var(--danger); }
  .status-Skipped   { background: rgba(100, 116, 139, 0.12); color: var(--gray); }
  .status-Failed    { background: rgba(251, 146, 60, 0.12); color: var(--orange); }

  /* caret */
  .caret { display: inline-block; width: 10px; color: var(--text-faint); transition: transform 0.15s, color 0.15s; font-size: 10px; }
  tr.expanded .caret { transform: rotate(90deg); color: var(--accent); }

  /* question badge */
  .q-badge { display: inline-block; margin-left: 8px; padding: 1px 7px; background: rgba(251, 191, 36, 0.12); color: var(--warn); border-radius: 8px; font-family: var(--mono); font-size: 10px; font-weight: 600; }
  .q-badge.ready { background: rgba(52, 211, 153, 0.12); color: var(--ok); }

  /* submit checkbox */
  .submit-cell { text-align: center; }
  .submit-cell input { width: 16px; height: 16px; accent-color: var(--accent); cursor: pointer; }
  .submit-cell input:disabled { cursor: not-allowed; }

  /* outcome segmented control */
  .outcome { display: inline-flex; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
  .outcome button { padding: 5px 11px; font-family: var(--mono); font-size: 10px; font-weight: 600; letter-spacing: 0.04em; background: var(--bg-elev); border: 0; border-right: 1px solid var(--border); cursor: pointer; color: var(--text-dim); transition: background 0.1s, color 0.1s; }
  .outcome button:last-child { border-right: 0; }
  .outcome button:hover { background: var(--bg-row-hover); color: var(--text); }
  .outcome button.on-interview { background: rgba(192, 132, 252, 0.18); color: var(--purple); }
  .outcome button.on-rejected  { background: rgba(248, 113, 113, 0.18); color: var(--danger); }
  .outcome button.on-pending   { background: rgba(96, 165, 250, 0.18); color: var(--info); }

  /* PDF link */
  td .pdf-link { font-family: var(--mono); font-size: 12px; }

  /* empty state */
  .empty { color: var(--text-faint); text-align: center; padding: 60px 20px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; font-style: italic; }

  /* ===== Questions panel (expanded rows) ===== */
  tr.qpanel > td { padding: 0; background: var(--bg-deep); border-bottom: 1px solid var(--border); }
  .qpanel-inner { padding: 22px 28px 26px; border-top: 1px solid var(--border); }
  .qpanel-inner h3 { font-family: var(--mono); font-size: 10px; font-weight: 600; color: var(--accent); text-transform: uppercase; letter-spacing: 0.12em; margin: 0 0 14px; }
  .qitem { display: grid; grid-template-columns: 1fr 1fr auto; gap: 12px; margin-bottom: 12px; align-items: start; }
  .qitem textarea { font-family: var(--sans); font-size: 13px; padding: 10px 12px; background: var(--bg-elev); border: 1px solid var(--border); color: var(--text); border-radius: 6px; resize: vertical; min-height: 72px; width: 100%; line-height: 1.5; }
  .qitem textarea:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(34, 211, 238, 0.15); }
  .qitem textarea[readonly] { background: var(--bg-card); color: var(--text); }
  .qitem textarea.pending { color: var(--text-faint); font-style: italic; }
  .qitem .qbtns { display: flex; flex-direction: column; gap: 5px; }
  .qitem .qbtns button { padding: 5px 9px; font-size: 11px; font-family: var(--mono); background: var(--bg-elev); color: var(--text-dim); border: 1px solid var(--border); border-radius: 4px; cursor: pointer; min-width: 32px; }
  .qitem .qbtns button:hover { background: var(--bg-row-hover); color: var(--text); border-color: var(--border-hi); }
  .qitem .qbtns button.danger:hover { background: rgba(248, 113, 113, 0.15); color: var(--danger); border-color: var(--danger); }
  .qpanel-actions { display: flex; gap: 10px; margin-top: 10px; align-items: center; }
  .qpanel-actions button { padding: 7px 14px; font-size: 12px; font-family: var(--mono); font-weight: 600; letter-spacing: 0.04em; border-radius: 5px; cursor: pointer; }
  .qpanel-actions .add { background: var(--bg-elev); color: var(--text); border: 1px solid var(--border); }
  .qpanel-actions .add:hover { background: var(--bg-row-hover); border-color: var(--accent); color: var(--accent); }
  .qpanel-actions .save { background: var(--accent); color: var(--bg-deep); border: 0; }
  .qpanel-actions .save:hover { background: var(--accent-glow); box-shadow: 0 0 12px rgba(34, 211, 238, 0.4); }
  .qpanel-hint { margin-left: auto; color: var(--text-faint); font-size: 11px; font-family: var(--mono); }

  /* ===== Responsive ===== */
  @media (max-width: 1100px) {
    .cards { grid-template-columns: 1fr; gap: 12px; }
    .pipe { height: 24px; }
    .pipe::before { left: 50%; right: auto; top: 0; bottom: 0; width: 1px; height: 100%; background: linear-gradient(180deg, transparent, var(--accent), transparent); }
    .pipe::after { content: '▾'; }
  }
  @media (max-width: 800px) {
    main { padding: 16px; }
    .controls input { min-width: 0; flex: 1; }
    .topbar { padding: 14px 16px; }
    .tagline { display: none; }
  }
</style>
</head>
<body>
<header class="topbar">
  <div class="brand">
    <span class="wordmark">JOBFLOW</span>
    <span class="tagline">// the open-core agentic pipeline</span>
  </div>
  <div class="health"><span class="dot"></span>server healthy</div>
</header>

<main>
  <section class="cards">
    <div class="card control-tower" id="card-tower">
      <p class="label">Control Tower</p>
      <div class="stat-big" id="stat-total">—</div>
      <div class="stat-big-label">applications tracked</div>
      <div class="stat-rows" id="stat-rows"></div>
    </div>
    <div class="pipe" aria-hidden="true"></div>
    <div class="card donut-card" id="card-status">
      <p class="label">Pipeline Status</p>
      <div id="status-donut"></div>
      <div class="legend" id="status-legend"></div>
    </div>
    <div class="pipe" aria-hidden="true"></div>
    <div class="card donut-card" id="card-outcome">
      <p class="label">Outcomes</p>
      <div id="outcome-donut"></div>
      <div class="legend" id="outcome-legend"></div>
    </div>
  </section>

  <div class="meta">CSV: <code>user_data/queue.csv</code> · auto-refresh paused while editing</div>

  <div class="banner" id="banner"></div>

  <div class="controls">
    <input id="search" placeholder="Search title, company, blueprint, notes…" />
    <select id="statusFilter">
      <option value="">All statuses</option>
      <option>Queued</option><option>Ready</option><option>Submitted</option>
      <option>Interview</option><option>Rejected</option><option>Skipped</option><option>Failed</option>
    </select>
    <span class="count" id="count"></span>
  </div>

  <table id="table">
    <thead><tr id="head"></tr></thead>
    <tbody></tbody>
  </table>
  <div class="empty" id="empty" style="display:none">Queue is empty. Click the JOBFLOW extension on a JD page to capture one.</div>
</main>

<script>
const COLS = [
  { key: '_caret',       label: '',          type: 'caret' },
  { key: 'status',       label: 'Status',    type: 'status' },
  { key: 'captured_at',  label: 'Captured',  type: 'date' },
  { key: 'source_domain',label: 'Source',    type: 'link' },
  { key: 'page_title',   label: 'Title',     type: 'text' },
  { key: 'jd_text',      label: 'JD preview',type: 'jd' },
  { key: 'blueprint',    label: 'Blueprint', type: 'blueprint' },
  { key: 'pdf_path',     label: 'PDF',       type: 'pdf' },
  { key: '_submit',      label: 'Submitted', type: 'submit', sortKey: 'applied_at' },
  { key: '_outcome',     label: 'Outcome',   type: 'outcome', sortKey: 'status' },
];

// Status color tokens, kept in sync with CSS.
const STATUS_COLORS = {
  Queued: '#FBBF24', Ready: '#34D399', Submitted: '#60A5FA',
  Interview: '#C084FC', Rejected: '#F87171', Skipped: '#64748B', Failed: '#FB923C',
};
const OUTCOME_ORDER = ['Pending', 'Interview', 'Rejected'];
const OUTCOME_COLORS = { Pending: '#60A5FA', Interview: '#C084FC', Rejected: '#F87171' };

let allRows = [];
let sortKey = 'captured_at', sortDir = -1;
const expandedIds = new Set();
const $search = document.getElementById('search');
const $statusFilter = document.getElementById('statusFilter');
const $banner = document.getElementById('banner');

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function parseQuestions(j) { if (!j) return []; try { return JSON.parse(j) || []; } catch { return []; } }
function questionsStats(rows) {
  let pQ = 0, pR = 0;
  for (const r of rows) {
    const pend = parseQuestions(r.application_questions).filter(x => !x.a).length;
    if (pend > 0) { pQ += pend; pR++; }
  }
  return { pQ, pR };
}

/* ===== KPI cards ===== */
function renderCards(rows) {
  // Status counts.
  const counts = {};
  for (const k of Object.keys(STATUS_COLORS)) counts[k] = 0;
  for (const r of rows) if (counts[r.status] !== undefined) counts[r.status]++;

  // Control tower stats.
  document.getElementById('stat-total').textContent = rows.length;
  const tower = [
    { k: 'Ready to submit', v: counts.Ready, color: '--ok' },
    { k: 'Awaiting outcome', v: counts.Submitted, color: '--info' },
    { k: 'In interview', v: counts.Interview, color: '--purple' },
    { k: 'Closed (rejected/skipped)', v: counts.Rejected + counts.Skipped, color: '--gray' },
  ];
  document.getElementById('stat-rows').innerHTML = tower.map(s =>
    \`<div class="stat-row"><span class="k">\${s.k}</span><span class="v">\${s.v}</span></div>\`
  ).join('');

  // Pipeline status donut.
  const statusSegs = Object.keys(STATUS_COLORS)
    .map(k => ({ label: k, value: counts[k], color: STATUS_COLORS[k] }))
    .filter(s => s.value > 0);
  document.getElementById('status-donut').innerHTML = donutSvg(statusSegs, rows.length);
  document.getElementById('status-legend').innerHTML = legend(statusSegs);

  // Outcome donut — only submitted+ rows.
  const outcomeCounts = { Pending: counts.Submitted, Interview: counts.Interview, Rejected: counts.Rejected };
  const outcomeTotal = outcomeCounts.Pending + outcomeCounts.Interview + outcomeCounts.Rejected;
  const outcomeSegs = OUTCOME_ORDER
    .map(k => ({ label: k, value: outcomeCounts[k], color: OUTCOME_COLORS[k] }))
    .filter(s => s.value > 0);
  document.getElementById('outcome-donut').innerHTML = donutSvg(outcomeSegs, outcomeTotal);
  document.getElementById('outcome-legend').innerHTML = outcomeSegs.length === 0
    ? '<div class="legend-empty">No applications submitted yet.</div>'
    : legend(outcomeSegs);
}

function donutSvg(segs, total) {
  const r = 36, C = 2 * Math.PI * r;
  if (segs.length === 0 || total === 0) {
    return \`<svg viewBox="0 0 100 100" class="donut">
      <circle cx="50" cy="50" r="\${r}" fill="none" stroke="#1E293B" stroke-width="8"/>
      <text x="50" y="54" text-anchor="middle">0</text>
    </svg>\`;
  }
  let offset = 0;
  const arcs = segs.map(s => {
    const len = (s.value / total) * C;
    const arc = \`<circle cx="50" cy="50" r="\${r}" fill="none" stroke="\${s.color}" stroke-width="8" stroke-dasharray="\${len.toFixed(3)} \${(C - len).toFixed(3)}" stroke-dashoffset="\${(-offset).toFixed(3)}" transform="rotate(-90 50 50)" stroke-linecap="butt"/>\`;
    offset += len;
    return arc;
  }).join('');
  return \`<svg viewBox="0 0 100 100" class="donut">
    <circle cx="50" cy="50" r="\${r}" fill="none" stroke="#1E293B" stroke-width="8"/>
    \${arcs}
    <text x="50" y="54" text-anchor="middle">\${total}</text>
  </svg>\`;
}

function legend(segs) {
  if (segs.length === 0) return '<div class="legend-empty">No data yet.</div>';
  return segs.map(s => \`
    <div class="legend-row">
      <div class="swatch" style="background:\${s.color}"></div>
      <div class="name">\${s.label}</div>
      <div class="count">\${s.value}</div>
    </div>\`).join('');
}

/* ===== Table ===== */
function renderHead() {
  const tr = document.getElementById('head');
  tr.innerHTML = '';
  for (const col of COLS) {
    const th = document.createElement('th');
    const key = col.sortKey || col.key;
    const arrow = sortKey === key ? (sortDir === 1 ? '▲' : '▼') : (col.type === 'caret' ? '' : '↕');
    th.innerHTML = col.label + (arrow ? \`<span class="arrow">\${arrow}</span>\` : '');
    if (sortKey === key) th.classList.add('sorted');
    if (col.type !== 'caret') {
      th.onclick = () => { if (sortKey === key) sortDir = -sortDir; else { sortKey = key; sortDir = 1; } paint(); };
    } else { th.style.cursor = 'default'; }
    tr.appendChild(th);
  }
}

function applyFilters(rows) {
  const q = $search.value.trim().toLowerCase();
  const s = $statusFilter.value;
  return rows.filter(r => {
    if (s && r.status !== s) return false;
    if (!q) return true;
    const hay = [r.page_title, r.source_domain, r.blueprint, r.notes, r.jd_text].join(' ').toLowerCase();
    return hay.includes(q);
  });
}

function compareRows(a, b) {
  const va = a[sortKey] || '', vb = b[sortKey] || '';
  if (va < vb) return -sortDir; if (va > vb) return sortDir; return 0;
}

function renderCell(col, r) {
  switch (col.type) {
    case 'caret':     return '<span class="caret">▶</span>';
    case 'status':    return \`<span class="status status-\${r.status || 'Queued'}">\${r.status || 'Queued'}</span>\`;
    case 'date':      return '<span class="captured">' + (r.captured_at || '').replace('T', ' ').slice(0, 16) + '</span>';
    case 'link':      return r.source_url ? \`<a href="\${r.source_url}" target="_blank" class="src">\${escapeHtml(r.source_domain || '')}</a>\` : '';
    case 'text':      return '<span class="title">' + escapeHtml(r.page_title || '') + '</span>' + qBadge(r);
    case 'jd':        return '<div class="jd">' + escapeHtml(r.jd_text || '') + '</div>';
    case 'blueprint': return '<span class="blueprint">' + (r.blueprint || '').replace('blueprint_', '').replace('.md', '') + '</span>';
    case 'pdf':       return r.pdf_path ? '<a class="pdf-link" href="file://' + encodeURI(r.pdf_path) + '">open</a>' : '<span class="muted">—</span>';
    case 'submit':    return submitCell(r);
    case 'outcome':   return outcomeCell(r);
  }
}

function qBadge(r) {
  const qs = parseQuestions(r.application_questions);
  if (qs.length === 0) return '';
  const pending = qs.filter(x => !x.a).length;
  return pending > 0
    ? '<span class="q-badge">' + pending + ' Q pending</span>'
    : '<span class="q-badge ready">' + qs.length + ' Q ready</span>';
}

function submitCell(r) {
  const isReady = r.status === 'Ready';
  const isPast = ['Submitted', 'Interview', 'Rejected'].includes(r.status);
  if (!isReady && !isPast) return '<span class="muted">—</span>';
  const checked = isPast ? 'checked' : '';
  const disabled = isPast ? 'disabled' : '';
  return '<div class="submit-cell"><input type="checkbox" data-action="submit" data-id="' + r.id + '" ' + checked + ' ' + disabled + ' title="Mark application as submitted" /></div>';
}

function outcomeCell(r) {
  if (!['Submitted', 'Interview', 'Rejected'].includes(r.status)) return '<span class="muted">—</span>';
  // "Pending" = Submitted internal status (no decision yet).
  const cls = s => {
    if (s === 'Pending' && r.status === 'Submitted') return 'on-pending';
    if (s === 'Interview' && r.status === 'Interview') return 'on-interview';
    if (s === 'Rejected' && r.status === 'Rejected') return 'on-rejected';
    return '';
  };
  return \`<div class="outcome">
    <button data-action="outcome" data-id="\${r.id}" data-value="Interview" class="\${cls('Interview')}">Interview</button>
    <button data-action="outcome" data-id="\${r.id}" data-value="Rejected"  class="\${cls('Rejected')}">Rejected</button>
    <button data-action="outcome" data-id="\${r.id}" data-value="Pending"   class="\${cls('Pending')}">Pending</button>
  </div>\`;
}

function questionsPanel(r) {
  const qs = parseQuestions(r.application_questions);
  const items = qs.map((q, idx) => {
    const a = q.a || '';
    const hasA = a.length > 0;
    return \`<div class="qitem" data-row="\${r.id}" data-idx="\${idx}">
      <textarea data-field="q" placeholder="Type your application question…">\${escapeHtml(q.q || '')}</textarea>
      <textarea data-field="a" readonly class="\${hasA ? '' : 'pending'}">\${hasA ? escapeHtml(a) : '(pending — save & run /answer-questions)'}</textarea>
      <div class="qbtns">
        \${hasA ? '<button data-action="copy" title="Copy answer">📋</button><button data-action="clear-a" class="danger" title="Delete answer, mark pending">↻</button>' : ''}
        <button data-action="remove-q" class="danger" title="Remove this question">×</button>
      </div>
    </div>\`;
  }).join('');
  return \`<tr class="qpanel" data-row="\${r.id}">
    <td colspan="\${COLS.length}">
      <div class="qpanel-inner">
        <h3>Application Questions</h3>
        <div class="qlist" data-row="\${r.id}">\${items}</div>
        <div class="qpanel-actions">
          <button class="add" data-action="add-q" data-row="\${r.id}">+ Add question</button>
          <button class="save" data-action="save-q" data-row="\${r.id}">Save questions</button>
          <span class="qpanel-hint">After saving, run <code>/answer-questions</code> in Claude Code.</span>
        </div>
      </div>
    </td>
  </tr>\`;
}

function paint() {
  renderCards(allRows);
  renderHead();
  const filtered = applyFilters(allRows).slice().sort(compareRows);
  const tbody = document.querySelector('#table tbody');
  tbody.innerHTML = '';
  document.getElementById('count').textContent = filtered.length + ' of ' + allRows.length + ' rows';
  if (allRows.length === 0) {
    document.getElementById('empty').style.display = 'block';
    document.getElementById('table').style.display = 'none';
  } else {
    document.getElementById('empty').style.display = 'none';
    document.getElementById('table').style.display = 'table';
    for (const r of filtered) {
      const tr = document.createElement('tr');
      tr.className = 'data-row' + (expandedIds.has(r.id) ? ' expanded' : '');
      tr.dataset.row = r.id;
      tr.innerHTML = COLS.map(c => '<td>' + renderCell(c, r) + '</td>').join('');
      tbody.appendChild(tr);
      if (expandedIds.has(r.id)) {
        const panel = document.createElement('tbody');
        panel.innerHTML = questionsPanel(r);
        while (panel.firstChild) tbody.appendChild(panel.firstChild);
      }
    }
  }
  const { pQ, pR } = questionsStats(allRows);
  if (pQ > 0) {
    $banner.innerHTML = 'You have <strong>' + pQ + '</strong> pending question' + (pQ === 1 ? '' : 's') + ' across <strong>' + pR + '</strong> row' + (pR === 1 ? '' : 's') + '. Run <code>/answer-questions</code> in Claude Code to populate.';
    $banner.style.display = 'block';
  } else { $banner.style.display = 'none'; }
  document.title = 'JOBFLOW · ' + allRows.length + ' tracked';
}

/* ===== Events ===== */
document.addEventListener('click', async (e) => {
  const t = e.target;
  const dataRow = t.closest && t.closest('tr.data-row');
  const interactive = t.closest && t.closest('a, button, input, textarea, select');
  if (dataRow && !interactive) {
    const id = dataRow.dataset.row;
    if (expandedIds.has(id)) expandedIds.delete(id); else expandedIds.add(id);
    paint(); return;
  }
  if (t.dataset.action === 'submit' && t.tagName === 'INPUT' && t.checked) {
    await updateRow(t.dataset.id, { status: 'Submitted', applied_at: new Date().toISOString() }); return;
  }
  if (t.dataset.action === 'outcome' && t.tagName === 'BUTTON') {
    const v = t.dataset.value;
    const newStatus = v === 'Pending' ? 'Submitted' : v;
    await updateRow(t.dataset.id, { status: newStatus }); return;
  }
  if (t.dataset.action === 'add-q') { addQuestionRow(t.dataset.row); return; }
  if (t.dataset.action === 'save-q') { await saveQuestions(t.dataset.row); return; }
  if (t.dataset.action === 'remove-q') { t.closest('.qitem').remove(); return; }
  if (t.dataset.action === 'clear-a') {
    const item = t.closest('.qitem');
    const idx = parseInt(item.dataset.idx, 10);
    const id = item.dataset.row;
    const row = allRows.find(r => r.id === id);
    const qs = parseQuestions(row.application_questions);
    if (qs[idx]) { qs[idx].a = ''; qs[idx].answered_at = ''; }
    await updateRow(id, { application_questions: JSON.stringify(qs) }); return;
  }
  if (t.dataset.action === 'copy') {
    const item = t.closest('.qitem');
    const ta = item.querySelector('textarea[data-field="a"]');
    try { await navigator.clipboard.writeText(ta.value); flashButton(t, '✓'); }
    catch { flashButton(t, '✗'); } return;
  }
});

function flashButton(btn, label) { const orig = btn.textContent; btn.textContent = label; setTimeout(() => { btn.textContent = orig; }, 1000); }

function addQuestionRow(rowId) {
  const list = document.querySelector('.qlist[data-row="' + rowId + '"]');
  if (!list) return;
  const newIdx = list.children.length;
  const div = document.createElement('div');
  div.className = 'qitem'; div.dataset.row = rowId; div.dataset.idx = newIdx;
  div.innerHTML = '<textarea data-field="q" placeholder="Type your application question…"></textarea>'
    + '<textarea data-field="a" readonly class="pending">(pending — save & run /answer-questions)</textarea>'
    + '<div class="qbtns"><button data-action="remove-q" class="danger" title="Remove this question">×</button></div>';
  list.appendChild(div);
  div.querySelector('textarea[data-field="q"]').focus();
}

async function saveQuestions(rowId) {
  const list = document.querySelector('.qlist[data-row="' + rowId + '"]');
  if (!list) return;
  const row = allRows.find(r => r.id === rowId);
  const oldQs = parseQuestions(row.application_questions);
  const items = list.querySelectorAll('.qitem');
  const newQs = [];
  items.forEach((it) => {
    const q = it.querySelector('textarea[data-field="q"]').value.trim();
    if (!q) return;
    const idx = parseInt(it.dataset.idx, 10);
    const prior = !isNaN(idx) && oldQs[idx] ? oldQs[idx] : null;
    if (prior && prior.q === q && prior.a) newQs.push({ q, a: prior.a, answered_at: prior.answered_at || '' });
    else newQs.push({ q, a: '', answered_at: '' });
  });
  await updateRow(rowId, { application_questions: JSON.stringify(newQs) });
}

async function updateRow(id, patch) {
  await fetch('/row/' + id + '/update', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) });
  await load();
}

$search.addEventListener('input', paint);
$statusFilter.addEventListener('change', paint);

async function load() { allRows = await fetch('/queue').then(r => r.json()); paint(); }
load();
setInterval(() => { if (expandedIds.size === 0) load(); }, 5000);
</script>
</body>
</html>`;

// ----- routing -----
const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const route = `${req.method} ${parsed.pathname}`;

  if (req.method === 'OPTIONS') return send(res, 204, '');
  if (route === 'GET /')          return send(res, 200, DASHBOARD_HTML, 'text/html; charset=utf-8');
  if (route === 'GET /queue')     return handleQueue(req, res);
  if (route === 'POST /capture')  return handleCapture(req, res);
  if (route === 'GET /health')    return send(res, 200, { ok: true });
  // POST /row/<id>/update — update specific columns for a row (used by /process-queue skill).
  const rowMatch = parsed.pathname.match(/^\/row\/([^/]+)\/update$/);
  if (req.method === 'POST' && rowMatch) return handleRowUpdate(req, res, rowMatch[1]);
  // GET /assets/<file> — serve static files from <project root>/assets/.
  const assetMatch = parsed.pathname.match(/^\/assets\/([^/]+)$/);
  if (req.method === 'GET' && assetMatch) {
    const file = path.join(ASSETS_DIR, assetMatch[1]);
    if (!file.startsWith(ASSETS_DIR + path.sep)) return send(res, 403, { error: 'forbidden' });
    if (!fs.existsSync(file)) return send(res, 404, { error: 'not found' });
    const ext = path.extname(file).slice(1).toLowerCase();
    const type = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml', ico: 'image/x-icon', webp: 'image/webp' }[ext] || 'application/octet-stream';
    res.writeHead(200, { 'content-type': type, 'cache-control': 'public, max-age=3600' });
    fs.createReadStream(file).pipe(res);
    return;
  }
  return send(res, 404, { error: 'not found' });
});

server.listen(PORT, '127.0.0.1', () => {
  ensureQueue();
  console.log(`JOBFLOW server up on http://localhost:${PORT}`);
  console.log(`Queue: ${QUEUE_PATH}`);
});
