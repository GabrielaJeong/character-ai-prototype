// ─── Constants ────────────────────────────────────────────
const MODELS_LABEL = {
  'claude-opus-4-6':           'Claude Opus 4.6',
  'claude-sonnet-4-6':         'Claude Sonnet 4.6',
  'claude-haiku-4-5-20251001': 'Claude Haiku 4.5',
  'gemini-3.1-pro-preview':    'Gemini 3.1 Pro',
  'gemini-2.5-pro':            'Gemini 2.5 Pro',
  'gemini-2.5-flash':          'Gemini 2.5 Flash',
};

// ─── State ────────────────────────────────────────────────
let allCharacters  = [];
let chartActivity  = null;
let chartSafety    = null;
let periodA        = 'day';
let periodB        = 'day';

// ─── Table State ──────────────────────────────────────────
const tableState = {
  matrix:  { page: 1, sort: 'name', dir: 'asc',  data: [] },
  history: { page: 1, sort: 'date', dir: 'desc', data: [] },
  users:   { page: 1, sort: 'date', dir: 'desc', data: [] },
  chars:   { page: 1, sort: 'name', dir: 'asc',  data: [] },
};
const PAGE_SIZE = { matrix: 10, history: 10, users: 20, chars: 20 };

// ─── Pagination Helper ────────────────────────────────────
function paginate(id, total, page, pageSize, onPage) {
  const el = document.getElementById(id);
  if (!el) return;
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) { el.innerHTML = ''; return; }

  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 2) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '…') {
      pages.push('…');
    }
  }
  el.innerHTML = `
    <button class="pg-btn" ${page <= 1 ? 'disabled' : ''} onclick="${onPage}(${page - 1})">‹</button>
    ${pages.map(p => p === '…'
      ? `<span class="pg-ellipsis">…</span>`
      : `<button class="pg-btn ${p === page ? 'pg-active' : ''}" onclick="${onPage}(${p})">${p}</button>`
    ).join('')}
    <button class="pg-btn" ${page >= totalPages ? 'disabled' : ''} onclick="${onPage}(${page + 1})">›</button>`;
}

// ─── Sort Header Helper ───────────────────────────────────
function sortIcon(key, stateKey) {
  const s = tableState[stateKey];
  if (s.sort !== key) return '<span class="sort-icon">⇅</span>';
  return s.dir === 'asc' ? '<span class="sort-icon active">↑</span>' : '<span class="sort-icon active">↓</span>';
}
function toggleSort(stateKey, col, onRender) {
  const s = tableState[stateKey];
  if (s.sort === col) s.dir = s.dir === 'asc' ? 'desc' : 'asc';
  else { s.sort = col; s.dir = 'asc'; }
  s.page = 1;
  onRender();
}

// ─── Utils ────────────────────────────────────────────────
function fmtDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts * 1000);
  return d.toLocaleDateString('ko-KR', { year:'numeric', month:'2-digit', day:'2-digit' })
    + ' ' + d.toLocaleTimeString('ko-KR', { hour:'2-digit', minute:'2-digit' });
}
function scoreClass(s) {
  return s >= 90 ? 'score-green' : s >= 60 ? 'score-orange' : 'score-red';
}
function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
async function api(path, opts = {}) {
  const res = await fetch('/api/admin' + path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || res.statusText); }
  return res.json();
}
function showToast(msg, type = 'success') {
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

// ─── URL Routing ──────────────────────────────────────────
function handleRoute() {
  const parts = window.location.pathname.replace(/^\/admin\/?/, '').split('/').filter(Boolean);
  const page  = parts[0] || 'dashboard';
  const id    = parts[1];

  // Update sidebar
  document.querySelectorAll('.nav-item[data-page]').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });

  // Show correct page panel
  ['dashboard','eval','users','characters','moderation'].forEach(p => {
    const el = document.getElementById(`page-${p}`);
    if (el) el.style.display = p === page ? '' : 'none';
  });

  if (page === 'dashboard')   loadDashboard();
  else if (page === 'eval')   loadEval();
  else if (page === 'users') {
    if (id) _openUserDetailById(id);
    else     loadUsers();
  }
  else if (page === 'characters') {
    if (id) _openCharDetailById(id);
    else     loadCharacters();
  }
  else if (page === 'moderation') {
    if (id) _openModerationDetailById(id);
    else     loadModeration();
  }
}

function navigatePage(page) {
  history.pushState({}, '', page === 'dashboard' ? '/admin' : `/admin/${page}`);
  handleRoute();
}

window.addEventListener('popstate', handleRoute);

// ══════════════════════════════════════════════════════════
//  Dashboard
// ══════════════════════════════════════════════════════════
async function loadDashboard() {
  try {
    const s = await api('/stats');
    document.getElementById('stat-users').textContent    = s.totalUsers.toLocaleString();
    document.getElementById('stat-sessions').textContent = s.todaySessions.toLocaleString();
    document.getElementById('stat-chars').textContent    = s.totalChars.toLocaleString();
    document.getElementById('stat-modlogs').textContent  = s.modLogs7d.toLocaleString();
    document.getElementById('stat-pv').textContent       = s.todayPV.toLocaleString();
    document.getElementById('stat-uv').textContent       = s.todayUV.toLocaleString();
    document.getElementById('stat-dau').textContent      = s.dau.toLocaleString();
    document.getElementById('stat-mau').textContent      = s.mau.toLocaleString();
  } catch (err) { console.error('stats:', err); }

  loadGraphA(periodA);
  loadGraphB(periodB);
}

async function loadGraphA(period) {
  try {
    const data = await api(`/stats/graph?period=${period}`);
    renderChartActivity(data);
  } catch (err) { console.error('graph A:', err); }
}

async function loadGraphB(period) {
  try {
    const data = await api(`/stats/graph?period=${period}`);
    renderChartSafety(data);
  } catch (err) { console.error('graph B:', err); }
}

function setPeriodA(p) {
  periodA = p;
  document.querySelectorAll('#period-tabs-a .period-tab').forEach(b => b.classList.toggle('active', b.dataset.period === p));
  loadGraphA(p);
}
function setPeriodB(p) {
  periodB = p;
  document.querySelectorAll('#period-tabs-b .period-tab').forEach(b => b.classList.toggle('active', b.dataset.period === p));
  loadGraphB(p);
}

function toggleDatasetA(idx) {
  if (!chartActivity) return;
  const ds = chartActivity.data.datasets[idx];
  ds.hidden = !ds.hidden;
  chartActivity.update();
}

function renderChartActivity(data) {
  const ctx = document.getElementById('chart-activity').getContext('2d');
  if (chartActivity) chartActivity.destroy();

  // Sync toggles to current hidden state
  const pvChecked = document.getElementById('tgl-pv')?.checked || false;
  const uvChecked = document.getElementById('tgl-uv')?.checked || false;

  chartActivity = new Chart(ctx, {
    data: {
      labels: data.labels,
      datasets: [
        {
          type: 'bar', label: '신규 가입자',
          data: data.users,
          backgroundColor: 'rgba(91,143,185,0.7)',
          borderRadius: 3,
          yAxisID: 'y',
        },
        {
          type: 'bar', label: '신규 세션',
          data: data.sessions,
          backgroundColor: 'rgba(95,217,142,0.6)',
          borderRadius: 3,
          yAxisID: 'y',
        },
        {
          type: 'line', label: 'PV',
          data: data.pv,
          borderColor: '#F0B34A',
          backgroundColor: 'rgba(240,179,74,0.08)',
          tension: 0.3, fill: false, pointRadius: 2,
          yAxisID: 'y2',
          hidden: !pvChecked,
        },
        {
          type: 'line', label: 'UV',
          data: data.uv,
          borderColor: '#C084FC',
          backgroundColor: 'rgba(192,132,252,0.08)',
          tension: 0.3, fill: false, pointRadius: 2,
          yAxisID: 'y2',
          hidden: !uvChecked,
        },
      ],
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#A8B5C8', boxWidth: 12, font: { size: 12 } } },
      },
      scales: {
        x:  { ticks: { color: '#4A5568', maxTicksLimit: 12 }, grid: { color: '#1E2A3A' } },
        y:  { ticks: { color: '#4A5568' }, grid: { color: '#1E2A3A' }, min: 0,
               title: { display: true, text: '가입자 / 세션', color: '#4A5568', font: { size: 11 } } },
        y2: { position: 'right', ticks: { color: '#4A5568' }, grid: { drawOnChartArea: false }, min: 0,
               title: { display: true, text: 'PV / UV', color: '#4A5568', font: { size: 11 } } },
      },
    },
  });
}

function renderChartSafety(data) {
  const ctx = document.getElementById('chart-safety').getContext('2d');
  if (chartSafety) chartSafety.destroy();

  chartSafety = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.labels,
      datasets: [{
        label: 'Safety 위반',
        data: data.moderation,
        borderColor: '#E05C5C',
        backgroundColor: 'rgba(224,92,92,0.1)',
        tension: 0.3, fill: true, pointRadius: 3,
        pointBackgroundColor: '#E05C5C',
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: '#A8B5C8', font: { size: 12 } } } },
      scales: {
        x: { ticks: { color: '#4A5568', maxTicksLimit: 12 }, grid: { color: '#1E2A3A' } },
        y: { ticks: { color: '#4A5568', stepSize: 1 }, grid: { color: '#1E2A3A' }, min: 0 },
      },
    },
  });
}

// ══════════════════════════════════════════════════════════
//  Eval
// ══════════════════════════════════════════════════════════
async function loadEval() {
  try {
    const { matrix, history } = await api('/eval');
    tableState.matrix.data  = matrix;
    tableState.history.data = history;
    tableState.matrix.page  = 1;
    tableState.history.page = 1;
    renderEvalMatrix();
    renderEvalHistory();
  } catch (err) { console.error(err); }
}

function renderEvalMatrix() {
  const s = tableState.matrix;
  const ALL_MODELS = Object.keys(MODELS_LABEL);

  // 최신 점수 lookup
  const lookup = {};
  const latestTs = {};
  for (const r of s.data) {
    const key = `${r.character_id}__${r.model}`;
    if (!latestTs[key] || r.evaluated_at > latestTs[key]) {
      lookup[key] = r.score;
      latestTs[key] = r.evaluated_at;
    }
  }

  // 캐릭터 목록 + 정렬
  let chars = [...new Set(s.data.map(r => r.character_id))];
  chars.sort((a, b) => {
    const na = (allCharacters.find(x => x.id === a)?.name || a).toLowerCase();
    const nb = (allCharacters.find(x => x.id === b)?.name || b).toLowerCase();
    if (s.sort === 'name') return s.dir === 'asc' ? na.localeCompare(nb, 'ko') : nb.localeCompare(na, 'ko');
    // score: 첫 번째 모델 점수 기준
    const sa = lookup[`${a}__${ALL_MODELS[0]}`] ?? -1;
    const sb = lookup[`${b}__${ALL_MODELS[0]}`] ?? -1;
    return s.dir === 'asc' ? sa - sb : sb - sa;
  });

  // 페이지 슬라이싱
  const total = chars.length;
  const start = (s.page - 1) * PAGE_SIZE.matrix;
  chars = chars.slice(start, start + PAGE_SIZE.matrix);

  const head = document.getElementById('eval-matrix-head');
  const body = document.getElementById('eval-matrix-body');

  head.innerHTML = `<th class="sortable-th" onclick="toggleSort('matrix','name',renderEvalMatrix)">캐릭터 ${sortIcon('name','matrix')}</th>`;
  body.innerHTML = '';

  for (const m of ALL_MODELS) {
    const th = document.createElement('th');
    th.textContent = MODELS_LABEL[m];
    head.appendChild(th);
  }
  for (const cid of chars) {
    const tr = document.createElement('tr');
    const c  = allCharacters.find(x => x.id === cid);

    // 이 캐릭터의 점수 목록 (존재하는 것만)
    const rowScores = ALL_MODELS.map(m => lookup[`${cid}__${m}`]).filter(v => v !== undefined);
    const rowMin = rowScores.length ? Math.min(...rowScores) : null;
    const rowMax = rowScores.length ? Math.max(...rowScores) : null;
    // min=max (점수가 하나뿐)이면 둘 다 강조 안 함
    const singleScore = rowScores.length <= 1 || rowMin === rowMax;

    tr.innerHTML = `<td class="name-cell">${esc(c ? c.name : cid)}</td>`;
    for (const m of ALL_MODELS) {
      const sc = lookup[`${cid}__${m}`];
      if (sc === undefined) {
        tr.innerHTML += `<td class="score-cell" style="color:var(--text-dim)">—</td>`;
      } else {
        const isMin = !singleScore && sc === rowMin;
        const isMax = !singleScore && sc === rowMax;
        const accent = isMax ? ' matrix-best' : isMin ? ' matrix-worst' : '';
        tr.innerHTML += `<td class="score-cell${accent}">${sc.toFixed(1)}</td>`;
      }
    }
    body.appendChild(tr);
  }

  paginate('eval-matrix-pagination', total, s.page, PAGE_SIZE.matrix, 'goMatrixPage');
}
function goMatrixPage(p) { tableState.matrix.page = p; renderEvalMatrix(); }

function renderEvalHistory() {
  const s = tableState.history;
  const ITEMS = ['시점','한국어','문체','호칭','감정','클리셰','유려함','묘사','존댓말'];
  const WEIGHTS = { '시점':15,'한국어':15,'문체':15,'호칭':10,'감정':10,'클리셰':10,'유려함':10,'묘사':5,'존댓말':5 };

  // 정렬
  let data = [...s.data];
  data.sort((a, b) => {
    if (s.sort === 'date')  return s.dir === 'asc' ? a.evaluated_at - b.evaluated_at : b.evaluated_at - a.evaluated_at;
    if (s.sort === 'char') {
      const na = (allCharacters.find(x => x.id === a.character_id)?.name || a.character_id).toLowerCase();
      const nb = (allCharacters.find(x => x.id === b.character_id)?.name || b.character_id).toLowerCase();
      return s.dir === 'asc' ? na.localeCompare(nb,'ko') : nb.localeCompare(na,'ko');
    }
    if (s.sort === 'model') return s.dir === 'asc' ? a.model.localeCompare(b.model) : b.model.localeCompare(a.model);
    if (s.sort === 'score') return s.dir === 'asc' ? a.score - b.score : b.score - a.score;
    return 0;
  });

  const total = data.length;
  const start = (s.page - 1) * PAGE_SIZE.history;
  const page  = data.slice(start, start + PAGE_SIZE.history);

  // 헤더
  const thead = document.querySelector('#eval-history-body').closest('table').querySelector('thead tr');
  thead.innerHTML = [
    ['date',  '날짜'],
    ['char',  '캐릭터'],
    ['model', '모델'],
    ['score', '점수'],
  ].map(([key, label]) =>
    `<th class="sortable-th" onclick="toggleSort('history','${key}',renderEvalHistory)">${label} ${sortIcon(key,'history')}</th>`
  ).join('') + '<th></th>';

  const tbody = document.getElementById('eval-history-body');
  tbody.innerHTML = '';

  for (const r of page) {
    const c = allCharacters.find(x => x.id === r.character_id);
    const charName = c ? esc(c.name) : esc(r.character_id);

    const tr = document.createElement('tr');
    tr.className = 'eval-history-row';
    tr.innerHTML = `
      <td>${fmtDate(r.evaluated_at)}</td>
      <td>${charName}</td>
      <td>${MODELS_LABEL[r.model] || r.model}</td>
      <td><span class="score-cell ${scoreClass(r.score)}">${r.score.toFixed(1)}</span></td>
      <td class="expand-chevron">▶</td>`;
    tbody.appendChild(tr);

    const detailTr = document.createElement('tr');
    detailTr.className = 'eval-history-detail';
    detailTr.style.display = 'none';

    const scoreChips = ITEMS.map(k => {
      const v = r.detail[k];
      return `<div class="eval-chip">
        <div class="eval-chip-label">${k}<span class="eval-chip-weight">(${WEIGHTS[k]})</span></div>
        <div class="eval-chip-score ${v !== undefined ? scoreClass(v) : ''}">${v !== undefined ? v : '—'}</div>
      </div>`;
    }).join('');

    detailTr.innerHTML = `<td colspan="5">
      <div class="eval-accordion-body">
        <div class="eval-chip-row">${scoreChips}</div>
        ${r.detail['판정_이유'] ? `<div class="eval-accordion-reason">${esc(r.detail['판정_이유']).replace(/\.(\s+)/g,'.\n')}</div>` : ''}
      </div>
    </td>`;
    tbody.appendChild(detailTr);

    tr.addEventListener('click', () => {
      const open = detailTr.style.display !== 'none';
      detailTr.style.display = open ? 'none' : '';
      tr.querySelector('.expand-chevron').textContent = open ? '▶' : '▼';
      tr.classList.toggle('eval-history-row-open', !open);
    });
  }

  paginate('eval-history-pagination', total, s.page, PAGE_SIZE.history, 'goHistoryPage');
}
function goHistoryPage(p) { tableState.history.page = p; renderEvalHistory(); }

async function runEval() {
  const characterId = document.getElementById('eval-char-select').value;
  const model       = document.getElementById('eval-model-select').value;
  const testInput   = document.getElementById('eval-test-input').value.trim();
  if (!characterId || !model || !testInput) { alert('캐릭터, 모델, 테스트 입력을 모두 선택/입력하세요.'); return; }

  const running = document.getElementById('eval-running');
  const result  = document.getElementById('eval-result');
  running.style.display = ''; result.style.display = 'none';

  try {
    const data = await api('/eval/run', { method: 'POST', body: JSON.stringify({ characterId, model, testInput }) });
    const WEIGHTS = { '시점':15,'한국어':15,'문체':15,'호칭':10,'감정':10,'클리셰':10,'유려함':10,'묘사':5,'존댓말':5 };
    const items = Object.keys(WEIGHTS).map(k => `
      <div class="eval-result-item">
        <div class="item-label">${k} (${WEIGHTS[k]})</div>
        <div class="item-score ${scoreClass(data.detail[k] ?? 0)}">${data.detail[k] ?? '—'}</div>
      </div>`).join('');
    result.innerHTML = `
      <div class="eval-result-score ${scoreClass(data.score)}">${data.score.toFixed(1)}점</div>
      <div class="eval-result-grid">${items}</div>
      <div class="eval-result-reason">${esc(data.detail['판정_이유'] || '')}</div>`;
    result.style.display = '';

    // 오른쪽 대화 미리보기
    const charName = document.getElementById('eval-char-select').selectedOptions[0]?.text || '캐릭터';
    const preview = document.getElementById('eval-chat-preview');
    preview.className = 'eval-chat-log';
    preview.innerHTML = `
      <div class="eval-bubble-wrap">
        <div class="eval-bubble-label">나</div>
        <div class="eval-bubble user">${esc(testInput)}</div>
      </div>
      <div class="eval-bubble-wrap">
        <div class="eval-bubble-label">${esc(charName)}</div>
        <div class="eval-bubble char">${esc(data.aiResponse || '')}</div>
      </div>`;

    loadEval();
  } catch (err) { alert('평가 실패: ' + err.message); }
  finally { running.style.display = 'none'; }
}

// ══════════════════════════════════════════════════════════
//  Users
// ══════════════════════════════════════════════════════════
async function loadUsers() {
  document.getElementById('user-list-panel').style.display   = '';
  document.getElementById('user-detail-panel').style.display = 'none';
  try {
    const users = await api('/users');
    tableState.users.data = users;
    tableState.users.page = 1;
    renderUsers();
  } catch (err) { console.error(err); }
}

function renderUsers() {
  const s = tableState.users;

  let data = [...s.data];
  data.sort((a, b) => {
    if (s.sort === 'name')     return s.dir === 'asc' ? a.nickname.localeCompare(b.nickname,'ko') : b.nickname.localeCompare(a.nickname,'ko');
    if (s.sort === 'date')     return s.dir === 'asc' ? a.created_at - b.created_at : b.created_at - a.created_at;
    if (s.sort === 'sessions') return s.dir === 'asc' ? a.session_count - b.session_count : b.session_count - a.session_count;
    if (s.sort === 'role')     return s.dir === 'asc' ? a.role.localeCompare(b.role) : b.role.localeCompare(a.role);
    return 0;
  });

  const total = data.length;
  const start = (s.page - 1) * PAGE_SIZE.users;
  const page  = data.slice(start, start + PAGE_SIZE.users);

  // 헤더
  const thead = document.querySelector('#users-table-body').closest('table').querySelector('thead tr');
  thead.innerHTML = [
    ['name','닉네임'], ['', '이메일'], ['date','가입일'],
    ['sessions','세션'], ['','성인인증'], ['role','Role'], ['','액션'],
  ].map(([key, label]) => key
    ? `<th class="sortable-th" onclick="toggleSort('users','${key}',renderUsers)">${label} ${sortIcon(key,'users')}</th>`
    : `<th>${label}</th>`
  ).join('');

  const tbody = document.getElementById('users-table-body');
  tbody.innerHTML = '';
  for (const u of page) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="name-cell">${esc(u.nickname)}</td>
      <td>${esc(u.email)}</td>
      <td>${fmtDate(u.created_at)}</td>
      <td>${u.session_count}</td>
      <td>${u.adult_verified ? '<span class="badge badge-active">인증됨</span>' : '<span style="color:var(--text-dim)">—</span>'}</td>
      <td>${u.role === 'admin' ? '<span class="badge badge-admin">admin</span>' : '<span class="badge" style="background:var(--surface2);color:var(--text-dim)">user</span>'}</td>
      <td>
        <button class="btn btn-ghost btn-xs" onclick="openUserDetail('${u.public_id}')">상세</button>
        <button class="btn btn-ghost btn-xs" onclick="toggleRole('${u.public_id}','${u.role}')" style="margin-left:4px">${u.role === 'admin' ? '→ user' : '→ admin'}</button>
        <button class="btn btn-danger btn-xs" onclick="deleteUser('${u.public_id}','${esc(u.nickname)}')" style="margin-left:4px">삭제</button>
      </td>`;
    tbody.appendChild(tr);
  }

  paginate('users-pagination', total, s.page, PAGE_SIZE.users, 'goUsersPage');
}
function goUsersPage(p) { tableState.users.page = p; renderUsers(); }

function openUserDetail(publicId) {
  history.pushState({}, '', `/admin/users/${publicId}`);
  _openUserDetailById(publicId);
}
async function _openUserDetailById(publicId) {
  document.getElementById('user-list-panel').style.display   = 'none';
  document.getElementById('user-detail-panel').style.display = '';
  try {
    const { user, sessions, personas } = await api(`/users/${publicId}`);
    document.getElementById('user-detail-name').textContent = user.nickname;

    const sessRows = sessions.length
      ? sessions.map(s => `<tr>
          <td class="name-cell" style="font-family:monospace;font-size:12px">${esc(s.id.slice(0,12))}…</td>
          <td>${esc(s.character_id)}</td><td>${MODELS_LABEL[s.model] || s.model}</td>
          <td>${s.message_count}</td><td>${fmtDate(s.created_at)}</td></tr>`).join('')
      : '<tr><td colspan="5" style="color:var(--text-dim)">세션 없음</td></tr>';

    const pRows = personas.length
      ? personas.map(p => {
          const d = typeof p.data === 'string' ? JSON.parse(p.data) : p.data;
          return `<tr><td>${p.id}</td><td class="name-cell">${esc(d.name||'')}</td><td>${esc((d.personality||'').slice(0,60))}</td></tr>`;
        }).join('')
      : '<tr><td colspan="3" style="color:var(--text-dim)">페르소나 없음</td></tr>';

    document.getElementById('user-detail-content').innerHTML = `
      <div class="detail-section">
        <h3>기본 정보</h3>
        <div class="detail-kv-grid">
          <div class="detail-kv-item"><div class="kv-label">이메일</div><div class="kv-value">${esc(user.email)}</div></div>
          <div class="detail-kv-item"><div class="kv-label">가입일</div><div class="kv-value">${fmtDate(user.created_at)}</div></div>
          <div class="detail-kv-item"><div class="kv-label">Role</div><div class="kv-value">${user.role}</div></div>
          <div class="detail-kv-item"><div class="kv-label">성인 인증</div><div class="kv-value">${user.adult_verified ? '완료' : '미완료'}</div></div>
          <div class="detail-kv-item"><div class="kv-label">성인 콘텐츠</div><div class="kv-value">${user.adult_content_enabled ? 'ON' : 'OFF'}</div></div>
          <div class="detail-kv-item"><div class="kv-label">Public ID</div><div class="kv-value" style="font-size:12px;font-family:monospace">${esc(user.public_id)}</div></div>
        </div>
        <div class="detail-action-row">
          <button class="btn btn-ghost" onclick="toggleRole('${user.public_id}','${user.role}')">Role: ${user.role} → ${user.role === 'admin' ? 'user' : 'admin'}</button>
          <button class="btn btn-danger" onclick="deleteUser('${user.public_id}','${esc(user.nickname)}')">강제 탈퇴</button>
        </div>
      </div>
      <div class="detail-section">
        <h3>세션 (${sessions.length}개)</h3>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>ID</th><th>캐릭터</th><th>모델</th><th>메시지</th><th>생성일</th></tr></thead>
            <tbody>${sessRows}</tbody>
          </table>
        </div>
      </div>
      <div class="detail-section">
        <h3>페르소나 (${personas.length}개)</h3>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>ID</th><th>이름</th><th>성격 요약</th></tr></thead>
            <tbody>${pRows}</tbody>
          </table>
        </div>
      </div>`;
  } catch (err) { alert(err.message); }
}

function closeUserDetail() {
  history.pushState({}, '', '/admin/users');
  document.getElementById('user-list-panel').style.display   = '';
  document.getElementById('user-detail-panel').style.display = 'none';
  loadUsers();
}

async function toggleRole(publicId, currentRole) {
  const newRole = currentRole === 'admin' ? 'user' : 'admin';
  if (!confirm(`role을 ${newRole}로 변경하시겠습니까?`)) return;
  try { await api(`/users/${publicId}/role`, { method: 'PATCH', body: JSON.stringify({ role: newRole }) }); loadUsers(); }
  catch (err) { alert(err.message); }
}

async function deleteUser(publicId, nickname) {
  if (!confirm(`"${nickname}"를 완전 삭제하시겠습니까?`)) return;
  try { await api(`/users/${publicId}`, { method: 'DELETE' }); navigatePage('users'); }
  catch (err) { alert(err.message); }
}

// ══════════════════════════════════════════════════════════
//  Characters
// ══════════════════════════════════════════════════════════
async function loadCharacters() {
  document.getElementById('char-list-panel').style.display   = '';
  document.getElementById('char-detail-panel').style.display = 'none';
  try {
    const chars = await api('/characters');
    tableState.chars.data = chars;
    tableState.chars.page = 1;
    renderChars();
  } catch (err) { console.error(err); }
}

function renderChars() {
  const s = tableState.chars;

  let data = [...s.data];
  data.sort((a, b) => {
    if (s.sort === 'name')     return s.dir === 'asc' ? a.name.localeCompare(b.name,'ko') : b.name.localeCompare(a.name,'ko');
    if (s.sort === 'type')     return s.dir === 'asc' ? (a._isPrebuilt?0:1) - (b._isPrebuilt?0:1) : (b._isPrebuilt?0:1) - (a._isPrebuilt?0:1);
    if (s.sort === 'rating')   return s.dir === 'asc' ? (a.rating||'').localeCompare(b.rating||'') : (b.rating||'').localeCompare(a.rating||'');
    if (s.sort === 'status')   return s.dir === 'asc' ? (a.status||'').localeCompare(b.status||'') : (b.status||'').localeCompare(a.status||'');
    if (s.sort === 'sessions') return s.dir === 'asc' ? (a.sessionCount||0) - (b.sessionCount||0) : (b.sessionCount||0) - (a.sessionCount||0);
    return 0;
  });

  const total = data.length;
  const start = (s.page - 1) * PAGE_SIZE.chars;
  const page  = data.slice(start, start + PAGE_SIZE.chars);

  // 헤더
  const thead = document.querySelector('#chars-table-body').closest('table').querySelector('thead tr');
  thead.innerHTML = [
    ['name','이름'], ['type','구분'], ['rating','Rating'],
    ['status','상태'], ['','태그'], ['sessions','세션'], ['','액션'],
  ].map(([key, label]) => key
    ? `<th class="sortable-th" onclick="toggleSort('chars','${key}',renderChars)">${label} ${sortIcon(key,'chars')}</th>`
    : `<th>${label}</th>`
  ).join('');

  const tbody = document.getElementById('chars-table-body');
  tbody.innerHTML = '';
  for (const c of page) {
    const tr   = document.createElement('tr');
    const tags = (c.tags||[]).slice(0,3).map(t => `<span style="font-size:11px;color:var(--text-dim)">#${esc(t)}</span>`).join(' ');
    tr.innerHTML = `
      <td class="name-cell">${esc(c.name)}</td>
      <td>${c._isPrebuilt ? '<span class="badge badge-prebuilt">프리빌트</span>' : '<span class="badge badge-user">유저 제작</span>'}</td>
      <td><span style="font-size:12px;color:var(--text-muted)">${c.rating||'—'}</span></td>
      <td>${c.status === 'inactive' ? '<span class="badge badge-inactive">비활성</span>' : '<span class="badge badge-active">활성</span>'}</td>
      <td>${tags}</td>
      <td>${c.sessionCount||0}</td>
      <td>
        <button class="btn btn-ghost btn-xs" onclick="openCharDetail('${c.id}')">상세</button>
        <button class="btn btn-ghost btn-xs" onclick="toggleCharStatus('${c.id}','${c.status||'active'}')" style="margin-left:4px">${c.status === 'inactive' ? '활성화' : '비활성화'}</button>
        <button class="btn btn-danger btn-xs" onclick="deleteChar('${c.id}','${esc(c.name)}')" style="margin-left:4px">삭제</button>
      </td>`;
    tbody.appendChild(tr);
  }

  paginate('chars-pagination', total, s.page, PAGE_SIZE.chars, 'goCharsPage');
}
function goCharsPage(p) { tableState.chars.page = p; renderChars(); }

function openCharDetail(id) {
  history.pushState({}, '', `/admin/characters/${id}`);
  _openCharDetailById(id);
}
async function _openCharDetailById(id) {
  document.getElementById('char-list-panel').style.display   = 'none';
  document.getElementById('char-detail-panel').style.display = '';
  document.getElementById('char-detail-content').innerHTML =
    '<p style="color:var(--text-dim);padding:20px 0">불러오는 중...</p>';

  try {
    const { config, system, sessionCount } = await api(`/characters/${id}`);
    document.getElementById('char-detail-name').textContent = config.name;

    const sel = (val, opts) => opts.map(o =>
      `<option value="${o}" ${val === o ? 'selected' : ''}>${o}</option>`
    ).join('');

    document.getElementById('char-detail-content').innerHTML = `
      <!-- ── 빠른 편집 ─────────────────────────────────── -->
      <div class="detail-section">
        <h3>기본 필드 편집</h3>
        <div class="edit-grid">
          <label class="edit-field">
            <span>이름 (name)</span>
            <input type="text" id="cf-name" value="${esc(config.name||'')}" class="edit-input">
          </label>
          <label class="edit-field">
            <span>풀네임 (fullName)</span>
            <input type="text" id="cf-fullName" value="${esc(config.fullName||'')}" class="edit-input">
          </label>
          <label class="edit-field">
            <span>부제목 (subtitle)</span>
            <input type="text" id="cf-subtitle" value="${esc(config.subtitle||'')}" class="edit-input">
          </label>
          <label class="edit-field">
            <span>Rating</span>
            <select id="cf-rating" class="select">${sel(config.rating, ['all_ages','adult_only','toggleable'])}</select>
          </label>
          <label class="edit-field">
            <span>Safety Toggle</span>
            <select id="cf-safetyToggle" class="select">
              <option value="true"  ${config.safetyToggle  ? 'selected' : ''}>ON (토글 가능)</option>
              <option value="false" ${!config.safetyToggle ? 'selected' : ''}>OFF (고정)</option>
            </select>
          </label>
          <label class="edit-field">
            <span>Default Safety</span>
            <select id="cf-defaultSafety" class="select">${sel(config.defaultSafety, ['on','off'])}</select>
          </label>
          <label class="edit-field">
            <span>Status</span>
            <select id="cf-status" class="select">${sel(config.status||'active', ['active','inactive'])}</select>
          </label>
          <label class="edit-field">
            <span>세션 수 (읽기 전용)</span>
            <input type="text" value="${sessionCount}" class="edit-input" disabled style="opacity:0.4">
          </label>
          <label class="edit-field">
            <span>ID (읽기 전용)</span>
            <input type="text" value="${esc(config.id)}" class="edit-input" disabled style="opacity:0.4;font-family:monospace;font-size:12px">
          </label>
        </div>
        <div class="detail-action-row">
          <button class="btn btn-primary" onclick="saveCharFields('${id}')">필드 저장</button>
          <button class="btn btn-ghost" onclick="toggleCharStatus('${id}','${config.status||'active'}')">${config.status === 'inactive' ? '활성화' : '비활성화'}</button>
          <button class="btn btn-danger" onclick="deleteChar('${id}','${esc(config.name)}')">캐릭터 삭제</button>
        </div>
      </div>

      <!-- ── config.json 편집 ───────────────────────────── -->
      <div class="detail-section">
        <h3>config.json 편집</h3>
        <textarea id="cf-config-json" class="textarea textarea-code">${esc(JSON.stringify(config, null, 2))}</textarea>
        <div class="detail-action-row">
          <button class="btn btn-primary" onclick="saveCharConfigJson('${id}')">JSON 저장</button>
          <span style="font-size:12px;color:var(--text-dim);margin-left:8px">저장 시 JSON 유효성 검사 후 덮어씁니다</span>
        </div>
      </div>

      <!-- ── system.md 편집 ─────────────────────────────── -->
      <div class="detail-section">
        <h3>system.md 편집</h3>
        <textarea id="cf-system-md" class="textarea textarea-code">${esc(system)}</textarea>
        <div class="detail-action-row">
          <button class="btn btn-primary" onclick="saveCharSystemMd('${id}')">MD 저장</button>
        </div>
      </div>`;
  } catch (err) { showToast(err.message, 'error'); }
}

async function saveCharFields(id) {
  try {
    // 서버에서 최신 config 가져온 뒤 필드만 덮어쓰기
    const { config: current } = await api(`/characters/${id}`);
    const updated = {
      ...current,
      name:          document.getElementById('cf-name').value.trim(),
      fullName:      document.getElementById('cf-fullName').value.trim(),
      subtitle:      document.getElementById('cf-subtitle').value.trim(),
      rating:        document.getElementById('cf-rating').value,
      safetyToggle:  document.getElementById('cf-safetyToggle').value === 'true',
      defaultSafety: document.getElementById('cf-defaultSafety').value,
      status:        document.getElementById('cf-status').value,
    };
    await api(`/characters/${id}`, { method: 'PATCH', body: JSON.stringify({ config: updated }) });
    // JSON textarea도 동기화
    document.getElementById('cf-config-json').value = JSON.stringify(updated, null, 2);
    document.getElementById('char-detail-name').textContent = updated.name;
    showToast('필드 저장 완료');
  } catch (err) { showToast(err.message, 'error'); }
}

async function saveCharConfigJson(id) {
  const raw = document.getElementById('cf-config-json').value;
  try {
    JSON.parse(raw); // 유효성 검사
  } catch (err) { showToast('JSON 오류: ' + err.message, 'error'); return; }
  try {
    await api(`/characters/${id}`, { method: 'PATCH', body: JSON.stringify({ config: raw }) });
    // 필드 입력값도 갱신
    await _openCharDetailById(id);
    showToast('config.json 저장 완료');
  } catch (err) { showToast(err.message, 'error'); }
}

async function saveCharSystemMd(id) {
  const content = document.getElementById('cf-system-md').value;
  try {
    await api(`/characters/${id}`, { method: 'PATCH', body: JSON.stringify({ system: content }) });
    showToast('system.md 저장 완료');
  } catch (err) { showToast(err.message, 'error'); }
}

function closeCharDetail() {
  history.pushState({}, '', '/admin/characters');
  document.getElementById('char-list-panel').style.display   = '';
  document.getElementById('char-detail-panel').style.display = 'none';
  loadCharacters();
}

async function toggleCharStatus(id, currentStatus) {
  const newStatus = currentStatus === 'inactive' ? 'active' : 'inactive';
  try { await api(`/characters/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) }); loadCharacters(); }
  catch (err) { alert(err.message); }
}

async function deleteChar(id, name) {
  if (!confirm(`캐릭터 "${name}"를 삭제하시겠습니까?`)) return;
  try { await api(`/characters/${id}`, { method: 'DELETE' }); navigatePage('characters'); }
  catch (err) { alert(err.message); }
}

// ══════════════════════════════════════════════════════════
//  Moderation
// ══════════════════════════════════════════════════════════
async function loadModeration() {
  document.getElementById('mod-list-panel').style.display   = '';
  document.getElementById('mod-detail-panel').style.display = 'none';

  const from = document.getElementById('mod-from').value;
  const to   = document.getElementById('mod-to').value;
  const cid  = document.getElementById('mod-char').value;
  const step = document.getElementById('mod-step').value;

  const p = new URLSearchParams();
  if (from) p.set('from', from);
  if (to)   p.set('to', to);
  if (cid)  p.set('characterId', cid);
  if (step) p.set('triggerStep', step);

  try {
    const logs  = await api('/moderation' + (p.toString() ? '?' + p.toString() : ''));
    const tbody = document.getElementById('mod-table-body');
    tbody.innerHTML = '';

    if (!logs.length) {
      tbody.innerHTML = '<tr><td colspan="8" style="color:var(--text-dim);text-align:center;padding:20px">기록 없음</td></tr>';
      return;
    }
    for (const log of logs) {
      const tr     = document.createElement('tr');
      const c      = allCharacters.find(x => x.id === log.character_id);
      const labels = ['','1단계 IC거부','2단계 OOC안내','3단계 우회차단'];
      const colors = ['','var(--accent)','var(--orange-text)','var(--red-text)'];
      const step   = log.trigger_step || 0;
      tr.innerHTML = `
        <td style="font-size:12px">${fmtDate(log.created_at)}</td>
        <td>${log.user_nickname ? esc(log.user_nickname) : '<span style="color:var(--text-dim)">게스트</span>'}</td>
        <td>${c ? esc(c.name) : esc(log.character_id||'—')}</td>
        <td style="font-size:12px">${MODELS_LABEL[log.model]||esc(log.model||'—')}</td>
        <td><span style="color:${colors[step]||'var(--text-dim)'};font-weight:600">${labels[step]||step+'단계'}</span></td>
        <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;color:var(--text-dim);font-size:12px">${esc(log.user_input_masked||'—')}</td>
        <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;font-size:12px;color:var(--text-muted)">${esc(log.ai_response_summary||'—')}</td>
        <td><button class="btn btn-ghost btn-xs" onclick="openModerationDetail('${log.public_id}')">상세</button></td>`;
      tbody.appendChild(tr);
    }
  } catch (err) { console.error(err); }
}

function openModerationDetail(publicId) {
  history.pushState({}, '', `/admin/moderation/${publicId}`);
  _openModerationDetailById(publicId);
}
async function _openModerationDetailById(publicId) {
  document.getElementById('mod-list-panel').style.display   = 'none';
  document.getElementById('mod-detail-panel').style.display = '';

  try {
    const { log, session, messages, user } = await api(`/moderation/${publicId}`);
    const c     = allCharacters.find(x => x.id === log.character_id);
    const labels = ['','1단계 IC거부','2단계 OOC안내','3단계 우회차단'];
    const step   = log.trigger_step || 0;

    const msgHtml = messages.length
      ? messages.map(m => `
          <div class="msg-role-label">${m.role === 'user' ? '유저' : '어시스턴트'}</div>
          <div class="msg-bubble msg-${m.role}">${esc(m.content)}</div>`).join('')
      : '<p style="color:var(--text-dim)">메시지 없음</p>';

    document.getElementById('mod-detail-content').innerHTML = `
      <div class="detail-section">
        <h3>위반 정보</h3>
        <div class="detail-kv-grid">
          <div class="detail-kv-item"><div class="kv-label">발생 시각</div><div class="kv-value">${fmtDate(log.created_at)}</div></div>
          <div class="detail-kv-item"><div class="kv-label">방어 단계</div><div class="kv-value">${labels[step]||step+'단계'}</div></div>
          <div class="detail-kv-item"><div class="kv-label">캐릭터</div><div class="kv-value">${c ? esc(c.name) : esc(log.character_id||'—')}</div></div>
          <div class="detail-kv-item"><div class="kv-label">모델</div><div class="kv-value">${MODELS_LABEL[log.model]||esc(log.model||'—')}</div></div>
          <div class="detail-kv-item"><div class="kv-label">유저</div><div class="kv-value">${user ? esc(user.nickname) : '게스트'}</div></div>
          <div class="detail-kv-item"><div class="kv-label">Safety</div><div class="kv-value">${log.safety_status||'—'}</div></div>
        </div>
      </div>
      <div class="detail-section">
        <h3>유저 입력 (마스킹)</h3>
        <pre class="sys-preview" style="max-height:none">${esc(log.user_input_masked||'—')}</pre>
      </div>
      <div class="detail-section">
        <h3>AI 응답 요약</h3>
        <pre class="sys-preview" style="max-height:none">${esc(log.ai_response_summary||'—')}</pre>
      </div>
      <div class="detail-section">
        <h3>세션 전체 대화 컨텍스트 (${messages.length}개 메시지)</h3>
        ${msgHtml}
      </div>`;
  } catch (err) { alert(err.message); }
}

function closeModerationDetail() {
  history.pushState({}, '', '/admin/moderation');
  document.getElementById('mod-list-panel').style.display   = '';
  document.getElementById('mod-detail-panel').style.display = 'none';
  loadModeration();
}

// ══════════════════════════════════════════════════════════
//  Init
// ══════════════════════════════════════════════════════════
async function init() {
  // Check auth
  const { user } = await fetch('/api/auth/me').then(r => r.json());

  if (!user || user.role !== 'admin') {
    document.querySelector('.sidebar').style.display = 'none';
    document.getElementById('page-denied').style.display = '';
    document.querySelectorAll('.page:not(#page-denied)').forEach(p => p.style.display = 'none');
    return;
  }

  document.getElementById('admin-user-info').textContent = `@${user.nickname}`;

  // Chart.js global dark theme
  if (typeof Chart !== 'undefined') {
    Chart.defaults.color       = '#A8B5C8';
    Chart.defaults.borderColor = '#1E2A3A';
  }

  // Load characters for selects
  try {
    allCharacters = await fetch('/api/characters').then(r => r.json());
    allCharacters.forEach(c => {
      document.getElementById('eval-char-select').appendChild(new Option(c.name, c.id));
      document.getElementById('mod-char').appendChild(new Option(c.name, c.id));
    });
  } catch (_) {}

  handleRoute();
}

init();
