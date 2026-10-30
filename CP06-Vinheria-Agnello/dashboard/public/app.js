'use strict';

const META = {
  temperature: { label: 'Temperatura', unit: '°C', digits: 1 },
  relativeHumidity: { label: 'Umidade relativa', unit: '%', digits: 1 },
  illuminance: { label: 'Luminosidade', unit: 'lux', digits: 1 }
};
const $ = id => document.getElementById(id);
const state = { data: null, metric: 'temperature', loading: false };
const numberFormat = value => Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const dateFormat = value => new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

function setStatus(kind, message) {
  const el = $('status');
  el.className = `status status-${kind}`;
  el.textContent = message;
}

function svg(tag, attrs = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}

function drawChart() {
  const chart = $('chart');
  chart.replaceChildren();
  const compact = window.matchMedia('(max-width: 600px)').matches;
  const width = compact ? 420 : 900;
  chart.setAttribute('viewBox', `0 0 ${width} 280`);
  const rows = state.data?.history?.[state.metric] || [];
  const meta = META[state.metric];
  $('chartLabel').textContent = `${meta.label} · ${meta.unit}`;
  $('sampleCount').textContent = `${rows.length} ${rows.length === 1 ? 'amostra' : 'amostras'}`;
  if (!rows.length) {
    $('chartDescription').textContent = 'Nenhuma leitura histórica neste período. Confira a conexão e o cadastro do dispositivo.';
    const label = svg('text', { x: width / 2, y: 145, 'text-anchor': 'middle', class: 'chart-axis' });
    label.textContent = 'Aguardando dados históricos';
    chart.append(label);
    return;
  }
  const sorted = [...rows].sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
  const x0 = 55, x1 = width - 22, y0 = 16, y1 = 245;
  const times = sorted.map(r => Date.parse(r.time));
  const values = sorted.map(r => Number(r.value));
  const minT = Math.min(...times), maxT = Math.max(...times);
  const minV = Math.min(...values), maxV = Math.max(...values);
  const pad = Math.max((maxV - minV) * .12, state.metric === 'temperature' ? .5 : 1);
  const low = minV - pad, high = maxV + pad;
  const px = t => x0 + (maxT === minT ? .5 : (t - minT) / (maxT - minT)) * (x1 - x0);
  const py = v => y1 - (v - low) / (high - low) * (y1 - y0);
  for (let i = 0; i < 4; i++) {
    const y = y0 + i * (y1 - y0) / 3;
    chart.append(svg('line', { x1: x0, x2: x1, y1: y, y2: y, class: 'chart-grid' }));
    const label = svg('text', { x: x0 - 10, y: y + 4, 'text-anchor': 'end', class: 'chart-axis' });
    label.textContent = numberFormat(high - i * (high - low) / 3);
    chart.append(label);
  }
  const points = sorted.map((r, i) => `${px(times[i]).toFixed(1)},${py(values[i]).toFixed(1)}`).join(' ');
  chart.append(svg('polyline', { points, class: 'chart-line' }));
  if (sorted.length === 1) chart.append(svg('circle', { cx: px(times[0]), cy: py(values[0]), r: 4, class: 'chart-dot' }));
  for (const [x, time] of [[x0, minT], [x1, maxT]]) {
    const label = svg('text', { x, y: 270, 'text-anchor': x === x0 ? 'start' : 'end', class: 'chart-axis' });
    label.textContent = compact
      ? new Date(time).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      : dateFormat(time);
    chart.append(label);
  }
  $('chartDescription').textContent = `${meta.label}: mínimo ${numberFormat(minV)}, máximo ${numberFormat(maxV)} ${meta.unit}. Horários de recebimento no STH-Comet.`;
}

function drawTable() {
  const table = $('records');
  table.replaceChildren();
  const rows = Object.entries(state.data?.history || {}).flatMap(([attr, values]) =>
    values.map(item => ({ attr, ...item })));
  rows.sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
  if (!rows.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 3; td.className = 'empty-row'; td.textContent = 'Ainda não há registros para mostrar neste período.';
    tr.append(td); table.append(tr); return;
  }
  for (const row of rows.slice(0, 18)) {
    const tr = document.createElement('tr');
    for (const value of [dateFormat(row.time), META[row.attr].label, `${numberFormat(row.value)} ${META[row.attr].unit}`]) {
      const td = document.createElement('td'); td.textContent = value; tr.append(td);
    }
    tr.lastChild.className = 'numeric';
    table.append(tr);
  }
}

function render() {
  const data = state.data;
  $('export').disabled = !Object.values(data?.history || {}).some(rows => rows.length > 0);
  for (const attr of Object.keys(META)) {
    const value = data?.latest?.[attr];
    $(attr).textContent = value == null ? '—' : numberFormat(value);
  }
  $('entityId').textContent = `Entidade FIWARE: ${data?.entityId || '—'}`;
  $('lastUpdate').textContent = data?.observedAt ? `Leitura: ${dateFormat(data.observedAt)}` : 'Sem timestamp recebido';
  const age = data?.observedAt ? Date.now() - Date.parse(data.observedAt) : Infinity;
  if (data?.errors?.length) setStatus('error', 'Conexão parcial');
  else if (!data?.latest) setStatus('stale', 'Aguardando dispositivo');
  else if (age > 120000 || age < -60000) setStatus('stale', 'Leitura antiga');
  else setStatus('ok', 'Dados atualizados');
  const warnings = [...(data?.errors || [])];
  if (data?.truncated?.length) warnings.push('O gráfico mostra até 300 amostras por variável neste período. Use Exportar CSV para obter mais registros.');
  $('notice').hidden = warnings.length === 0;
  $('notice').textContent = warnings.join(' ');
  drawChart(); drawTable();
}

async function load() {
  if (state.loading) return;
  state.loading = true;
  $('refresh').disabled = true;
  try {
    const response = await fetch(`/api/data?period=${encodeURIComponent($('period').value)}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Dashboard respondeu HTTP ${response.status}`);
    state.data = await response.json();
    render();
  } catch (error) {
    setStatus('error', 'Sem conexão');
    $('export').disabled = true;
    $('notice').hidden = false;
    $('notice').textContent = `Não foi possível carregar os dados: ${error.message}. Verifique o servidor do dashboard e o FIWARE.`;
  } finally {
    state.loading = false;
    $('refresh').disabled = false;
  }
}

document.querySelectorAll('[data-metric]').forEach(button => button.addEventListener('click', () => {
  state.metric = button.dataset.metric;
  document.querySelectorAll('[data-metric]').forEach(item => {
    const active = item === button;
    item.classList.toggle('active', active);
    item.setAttribute('aria-pressed', String(active));
  });
  drawChart();
}));
$('period').addEventListener('change', load);
$('refresh').addEventListener('click', load);
$('export').addEventListener('click', () => { window.location.href = `/api/export?period=${encodeURIComponent($('period').value)}`; });
load();
drawChart();
setInterval(load, 15000);
window.addEventListener('resize', drawChart);
