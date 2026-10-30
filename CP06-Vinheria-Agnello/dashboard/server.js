'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const configPath = path.join(root, 'config.json');
if (!fs.existsSync(configPath)) {
  console.error('Copie dashboard/config.example.json para dashboard/config.json e confira o servidor FIWARE.');
  process.exit(1);
}
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
for (const field of ['fiwareHost', 'service', 'servicePath', 'entityId', 'entityType']) {
  if (!config[field]) throw new Error(`Falta ${field} em config.json`);
}
if (!/^[a-zA-Z0-9.-]+$/.test(config.fiwareHost)) throw new Error('fiwareHost inválido');

const ATTRS = ['temperature', 'relativeHumidity', 'illuminance'];
const PERIODS = { '24h': 86400000, '7d': 604800000, '30d': 2592000000 };
const headers = { 'Fiware-Service': config.service, 'Fiware-ServicePath': config.servicePath };

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(type.startsWith('application/json') ? JSON.stringify(body) : body);
}

async function requestJson(url) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(7000) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`FIWARE respondeu HTTP ${response.status}`);
  return response.json();
}

function entityUrl() {
  return `http://${config.fiwareHost}:1026/v2/entities/${encodeURIComponent(config.entityId)}`;
}

function historyUrl(attr, from, offset) {
  const base = `http://${config.fiwareHost}:8666/STH/v2/entities/${encodeURIComponent(config.entityId)}/attrs/${attr}`;
  const query = new URLSearchParams({ type: config.entityType, hLimit: '100', hOffset: String(offset), dateFrom: from });
  return `${base}?${query}`;
}

async function loadHistory(attr, from, maxRows) {
  const rows = [];
  let truncated = false;
  for (let offset = 0; offset < maxRows; offset += 100) {
    const data = await requestJson(historyUrl(attr, from, offset));
    const page = Array.isArray(data?.values) ? data.values : Array.isArray(data?.value) ? data.value : [];
    for (const item of page) {
      const value = Number(item.attrValue);
      const time = new Date(item.recvTime);
      if (Number.isFinite(value) && Number.isFinite(time.getTime())) rows.push({ time: time.toISOString(), value });
    }
    if (page.length < 100) return { rows, truncated };
  }
  truncated = true;
  return { rows, truncated };
}

function parsePeriod(url) {
  const period = url.searchParams.get('period') || '24h';
  if (!PERIODS[period]) throw new Error('Período inválido');
  return { period, from: new Date(Date.now() - PERIODS[period]).toISOString() };
}

async function apiData(url, res) {
  const { period, from } = parsePeriod(url);
  const [entityResult, ...historyResults] = await Promise.allSettled([
    requestJson(entityUrl()),
    ...ATTRS.map(attr => loadHistory(attr, from, 300))
  ]);
  const errors = [];
  const entity = entityResult.status === 'fulfilled' ? entityResult.value : null;
  if (entityResult.status === 'rejected') errors.push(`Orion: ${entityResult.reason.message}`);
  const history = {};
  const truncated = [];
  historyResults.forEach((result, index) => {
    const attr = ATTRS[index];
    if (result.status === 'fulfilled') {
      history[attr] = result.value.rows;
      if (result.value.truncated) truncated.push(attr);
    } else {
      history[attr] = [];
      errors.push(`STH ${attr}: ${result.reason.message}`);
    }
  });
  const latest = entity ? Object.fromEntries(ATTRS.map(attr => [attr, Number(entity[attr]?.value)])) : null;
  if (latest) for (const attr of ATTRS) if (!Number.isFinite(latest[attr])) latest[attr] = null;
  send(res, 200, {
    period, generatedAt: new Date().toISOString(), entityId: config.entityId,
    latest, observedAt: entity?.dateObserved?.value || null,
    history, truncated, errors
  });
}

function csvCell(value) {
  const text = String(value ?? '');
  const safe = typeof value === 'number' ? text : /^[=+@\-\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

async function apiExport(url, res) {
  const { period, from } = parsePeriod(url);
  const results = await Promise.all(ATTRS.map(attr => loadHistory(attr, from, 10000)));
  const rows = ATTRS.flatMap((attr, index) => results[index].rows.map(row => ({ attribute: attr, ...row })));
  rows.sort((a, b) => a.time.localeCompare(b.time) || a.attribute.localeCompare(b.attribute));
  const lines = ['timestamp_utc,atributo,valor', ...rows.map(row =>
    [row.time, row.attribute, row.value].map(csvCell).join(','))];
  const csv = '\uFEFF' + lines.join('\r\n') + '\r\n';
  res.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="vinheria-cp06-${period}.csv"`,
    'Cache-Control': 'no-store',
    'X-History-Truncated': results.some(x => x.truncated) ? 'true' : 'false'
  });
  res.end(csv);
}

const staticFiles = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8']
};

const server = http.createServer(async (req, res) => {
  try {
    if (req.method !== 'GET') return send(res, 405, { error: 'Método não permitido' });
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api/data') return await apiData(url, res);
    if (url.pathname === '/api/export') return await apiExport(url, res);
    if (url.pathname === '/api/health') return send(res, 200, { ok: true, entityId: config.entityId });
    const file = staticFiles[url.pathname];
    if (!file) return send(res, 404, { error: 'Página não encontrada' });
    const content = fs.readFileSync(path.join(root, 'public', file[0]));
    return send(res, 200, content, file[1]);
  } catch (error) {
    console.error(error);
    return send(res, error.message === 'Período inválido' ? 400 : 502, { error: error.message });
  }
});

const port = Number(process.env.PORT || 3000);
if (require.main === module) {
  server.listen(port, '127.0.0.1', () => console.log(`Dashboard CP06: http://127.0.0.1:${port}`));
}
module.exports = { server };
