// ─── Model Config ────────────────────────────────────────
const MODELS = [
  { id: 'claude-sonnet-4-6',         label: 'Sonnet 4.6',       desc: '균형 잡힌 성능',          provider: 'claude'  },
  { id: 'claude-opus-4-6',           label: 'Opus 4.6',         desc: '최고 성능',               provider: 'claude'  },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5',        desc: '빠른 응답',               provider: 'claude'  },
  { id: 'gemini-2.5-flash',          label: 'Gemini 2.5 Flash', desc: '빠르고 효율적 · Google',  provider: 'gemini'  },
  { id: 'gemini-2.5-pro',            label: 'Gemini 2.5 Pro',   desc: '최고 성능 · Google',      provider: 'gemini'  },
  { id: 'gemini-3.1-pro-preview',    label: 'Gemini 3.1 Pro',   desc: '최신 모델 · Google · 기본값', provider: 'gemini'  },
];

const CHAT_DEFAULT_MODEL    = 'gemini-3.1-pro-preview'; // 새 채팅 기본 모델
const BUILDER_DEFAULT_MODEL = 'claude-sonnet-4-6';      // 빌더 기본 모델

// ─── State ───────────────────────────────────────────────
let sessionId        = null;
let userName         = '';
let lastAssistantEl  = null;
let currentMode      = 'chat';   // 'chat' | 'novel'
let messageLog       = [];       // [{ role, sender, text }]
let userImageUrl     = null;     // base64 profile image
let currentModel     = CHAT_DEFAULT_MODEL;
let characters       = [];       // loaded from /api/characters
let currentCharacter = null;     // selected character config object
let currentSafety    = 'on';     // 'on' | 'off'

// ─── AvatarUpload Component ───────────────────────────────
// Creates a reusable profile image upload widget.
// Options: { hint?, onChange(url|null) }
// Returns: { getUrl(), setUrl(url), reset() }
function createAvatarUpload(container, { hint = '1장 업로드 가능', onChange } = {}) {
  container.className = 'upload-avatar-wrap';

  // Circle trigger
  const trigger = document.createElement('div');
  trigger.className = 'upload-avatar';

  const plus = document.createElement('span');
  plus.className   = 'upload-avatar-plus';
  plus.textContent = '+';

  const preview = document.createElement('img');
  preview.className    = 'upload-avatar-img';
  preview.style.display = 'none';
  preview.alt          = '프로필';

  trigger.appendChild(plus);
  trigger.appendChild(preview);

  // Hidden file input
  const fileInput = document.createElement('input');
  fileInput.type   = 'file';
  fileInput.accept = 'image/*';
  fileInput.style.display = 'none';

  // Meta block (hint + remove button)
  const meta = document.createElement('div');

  const hintEl = document.createElement('p');
  hintEl.className = 'upload-avatar-hint';
  hintEl.innerHTML = hint;

  const removeBtn = document.createElement('button');
  removeBtn.type         = 'button';
  removeBtn.className    = 'upload-remove';
  removeBtn.textContent  = '이미지 제거';
  removeBtn.style.display = 'none';

  meta.appendChild(hintEl);
  meta.appendChild(removeBtn);

  container.appendChild(trigger);
  container.appendChild(fileInput);
  container.appendChild(meta);

  // Events
  trigger.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target.result;
      preview.src            = url;
      preview.style.display  = 'block';
      plus.style.display     = 'none';
      removeBtn.style.display = 'inline';
      onChange?.(url);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  });

  removeBtn.addEventListener('click', () => {
    preview.src             = '';
    preview.style.display   = 'none';
    plus.style.display      = '';
    removeBtn.style.display = 'none';
    onChange?.(null);
  });

  return {
    getUrl: () => (preview.src && preview.src !== window.location.href ? preview.src : null),
    setUrl: (url) => {
      if (url) {
        preview.src            = url;
        preview.style.display  = 'block';
        plus.style.display     = 'none';
        removeBtn.style.display = 'inline';
      } else {
        preview.src             = '';
        preview.style.display   = 'none';
        plus.style.display      = '';
        removeBtn.style.display = 'none';
      }
    },
    reset: () => {
      preview.src             = '';
      preview.style.display   = 'none';
      plus.style.display      = '';
      removeBtn.style.display = 'none';
      onChange?.(null);
    },
  };
}

// ─── ChatInput Component ──────────────────────────────────
// Creates a reusable <div class="chat-input-wrap"> with textarea + send button.
// Options: { inputId, btnId, onSend, placeholder? }
function createChatInput(container, { inputId, btnId, onSend, placeholder = '메시지를 입력하세요' }) {
  container.className = 'chat-input-wrap';

  const textarea = document.createElement('textarea');
  textarea.id          = inputId;
  textarea.className   = 'chat-input';
  textarea.placeholder = placeholder;
  textarea.rows        = 1;
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); }
  });
  textarea.addEventListener('input', () => autoResize(textarea));

  const btn = document.createElement('button');
  btn.id        = btnId;
  btn.className = 'btn-send';
  btn.textContent = '↑';
  btn.addEventListener('click', onSend);

  container.appendChild(textarea);
  container.appendChild(btn);
  return { textarea, btn };
}

// ─── Avatar upload state (populated by components) ───────
let personaAvatarUpload = null;  // persona setup screen
let builderAvatarUpload = null;  // builder edit screen
let manualAvatarUpload  = null;  // manual builder screen

// ─── Splash ───────────────────────────────────────────────
let _splashDone  = false;
let _dataReady   = false;
let _timerReady  = false;

function _tryDismissSplash() {
  if (_splashDone || !_dataReady || !_timerReady) return;
  _splashDone = true;
  const splash = document.getElementById('splash');
  splash.classList.add('splash-out');
  splash.addEventListener('animationend', () => splash.remove(), { once: true });
}

// ─── Init ─────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  // Splash timer — minimum display ~1.5s
  setTimeout(() => { _timerReady = true; _tryDismissSplash(); }, 1500);
  // Mount avatar upload components
  personaAvatarUpload = createAvatarUpload(
    document.getElementById('persona-avatar-container'),
    { hint: '1장 업로드 가능<br>채팅 모드에서만 표시됩니다.',
      onChange: (url) => { userImageUrl = url; } }
  );
  builderAvatarUpload = createAvatarUpload(
    document.getElementById('builder-avatar-container'),
    { hint: '캐릭터 프로필 이미지 (선택)' }
  );
  manualAvatarUpload = createAvatarUpload(
    document.getElementById('bm-avatar-container'),
    { hint: '캐릭터 프로필 이미지 (선택)' }
  );

  // Mount chat input components
  createChatInput(document.getElementById('chat-input-container'),    { inputId: 'chat-input',    btnId: 'btn-send',         onSend: sendMessage  });
  createChatInput(document.getElementById('builder-input-container'), { inputId: 'builder-input', btnId: 'builder-btn-send', onSend: builderSend  });

  initModelPicker();
  initBuilderModelPicker();
  initNoticeCarousel();
  initAuth();
  loadCurationSections();
  loadCharacters();
  loadNotifBadge();
  // Bottom nav visible on landing by default
  document.getElementById('bottom-nav')?.classList.remove('hidden');

  document.addEventListener('click', (e) => {
    const picker = document.getElementById('model-picker');
    const btn    = document.getElementById('btn-model');
    if (
      picker.classList.contains('open') &&
      !picker.contains(e.target) &&
      !btn.contains(e.target)
    ) {
      picker.classList.remove('open');
    }
    const bPicker = document.getElementById('builder-model-picker');
    const bBtn    = document.getElementById('btn-builder-model');
    if (
      bPicker.classList.contains('open') &&
      !bPicker.contains(e.target) &&
      !bBtn.contains(e.target)
    ) {
      bPicker.classList.remove('open');
    }
  });

});

// ─── Character Loading & Selection ───────────────────────
async function loadCharacters() {
  try {
    const res  = await fetch('/api/characters');
    characters = await res.json();
    renderCharacterGrid(characters);
    // Route after characters are loaded (handles direct URL access)
    renderRoute(window.location.pathname);
  } catch (_) {
    document.getElementById('char-grid').innerHTML =
      '<p style="font-size:13px;color:var(--text-dim);">캐릭터를 불러오지 못했습니다.</p>';
  } finally {
    _dataReady = true;
    _tryDismissSplash();
  }
}

// 섹션 헤더 컴포넌트 빌더
// eyebrow: 'RECOMMENDED.feed', title: '추천 캐릭터', viewAll: { label, onClick } (optional)
function buildFeedHeader(eyebrow, title, viewAll) {
  const viewAllBtn = viewAll
    ? `<button class="feed-view-all" onclick="${viewAll.onClick}">VIEW ALL <span class="feed-arrow">→</span></button>`
    : '';
  return `
    <div class="feed-header">
      <div class="feed-header-top">
        <span class="feed-eyebrow"><span class="feed-chevron">›</span> ${eyebrow}</span>
      </div>
      <div class="feed-header-main">
        <h2 class="feed-title">${title}</h2>
        ${viewAllBtn}
      </div>
    </div>`;
}

// K 단위 포맷
function fmtK(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

// 공통 카드 빌더 — 이미지 카드 + 카드 하단 정보 블록을 묶은 wrapper 반환
function buildCharCard(char, index) {
  const isComingSoon = char.status === 'coming_soon';

  // 넘버링 배지
  const numStr = String(index + 1).padStart(2, '0');

  // 상태 배지
  const badgeMap = {
    NEW: { cls: 'badge-new', dot: '●', label: 'NEW' },
    HOT: { cls: 'badge-hot', dot: '●', label: 'HOT' },
    UP:  { cls: 'badge-up',  dot: '●', label: 'UP'  },
  };
  const b = char.badge && badgeMap[char.badge];

  // 태그
  const visibleTags = Array.isArray(char.tags) ? char.tags.slice(0, 3) : [];
  const tagsHtml = visibleTags.length
    ? `<div class="char-card-tags">${visibleTags.map(t => `<span class="char-card-tag">#${t}</span>`).join('')}</div>`
    : '';

  // 이미지 카드
  const card = document.createElement('div');
  card.className = 'char-card' + (isComingSoon ? ' char-card-disabled' : '');
  if (!isComingSoon) card.onclick = () => selectCharacter(char.id);
  card.innerHTML = `
    ${char.image
      ? `<img src="${char.image}" alt="${char.name}" class="char-card-img" />`
      : `<div class="char-card-img-placeholder">${char.name[0]}</div>`}
    <span class="char-card-number">#B${numStr}</span>
    ${b ? `<span class="char-card-status-badge ${b.cls}"><span class="status-dot">${b.dot}</span>${b.label}</span>` : ''}
    <div class="char-card-overlay">${tagsHtml}</div>
    ${isComingSoon ? `<div class="char-card-coming-overlay"></div><span class="char-card-soon-badge">Coming Soon</span>` : ''}
  `;

  // 카드 하단 정보 (카드 밖)
  const stats = char.stats;
  const info = document.createElement('div');
  info.className = 'char-card-info';
  // Creator tag — only for user-created chars that have an owner with a username
  const creatorTag = (char.id?.startsWith('char_') && char.owner_username)
    ? `<div class="char-card-creator" onclick="event.stopPropagation();navigateTo('/creator/@${char.owner_username}')">@${char.owner_username}</div>`
    : '';

  info.innerHTML = `
    <div class="char-card-name">${char.name}</div>
    <div class="char-card-role">${char.role || char.team || ''}</div>
    ${creatorTag}
    ${stats ? `<div class="char-card-stats">
      <span class="char-stat"><span class="char-stat-icon">▲</span>${fmtK(stats.sessions)}</span>
      <span class="char-stat"><span class="char-stat-icon">♥</span>${fmtK(stats.bookmarks)}</span>
    </div>` : ''}
  `;

  const wrap = document.createElement('div');
  wrap.className = 'char-card-wrap';
  wrap.appendChild(card);
  wrap.appendChild(info);
  return wrap;
}

function renderCharacterGrid(list) {
  const grid = document.getElementById('char-grid');
  grid.innerHTML = '';
  list.forEach((char, i) => grid.appendChild(buildCharCard(char, i)));
}

function selectCharacter(id) {
  currentCharacter = characters.find(c => c.id === id) || null;
  if (!currentCharacter) return;
  populateIntroScreen(currentCharacter);
  navigateTo(`/character/${id}`);
}

function populateIntroScreen(char) {
  // Image
  const img = document.getElementById('intro-img');
  if (char.image) {
    img.src   = char.image;
    img.alt   = char.name;
    img.style.display = '';
  } else {
    img.style.display = 'none';
  }

  // Name + subtitle
  document.getElementById('intro-fullname').textContent = char.fullName || char.name;
  document.getElementById('intro-subtitle').textContent = char.subtitle || char.team || '';

  // Tags
  const tagsEl = document.getElementById('intro-tags');
  if (tagsEl) {
    if (Array.isArray(char.tags) && char.tags.length > 0) {
      tagsEl.innerHTML = char.tags.map(t => `<span class="intro-tag-chip">#${t}</span>`).join('');
      tagsEl.style.display = '';
    } else {
      tagsEl.style.display = 'none';
    }
  }

  // Profile table
  const profileCard = document.getElementById('intro-profile-card');
  if (char.profile && Object.keys(char.profile).length > 0) {
    profileCard.innerHTML = Object.entries(char.profile).map(([k, v]) =>
      `<div class="pt-row"><span class="pt-key">${k}</span><span class="pt-val">${v}</span></div>`
    ).join('');
    profileCard.style.display = '';
  } else {
    profileCard.style.display = 'none';
  }

  // Creator's note
  const noteCard = document.getElementById('intro-note-card');
  if (char.description && char.description.length > 0) {
    noteCard.innerHTML = `
      <p class="note-eyebrow">제작자 노트</p>
      ${char.description.map(p => `<p>${p}</p>`).join('')}
    `;
    noteCard.style.display = '';
  } else {
    noteCard.style.display = 'none';
  }

  // Worldbuilding accordion
  const wbEl = document.getElementById('intro-worldbuilding');
  if (char.worldbuilding) {
    wbEl.style.display = '';
    wbEl.innerHTML = `
      <div class="wb-accordion">
        <button class="wb-toggle" onclick="toggleWorldbuilding(this)" aria-expanded="false">
          <span class="wb-title">세계관</span>
          <span class="wb-caret">›</span>
        </button>
        <div class="wb-body" hidden>
          <div class="wb-content">${simpleMarkdown(char.worldbuilding)}</div>
        </div>
      </div>
    `;
  } else {
    wbEl.style.display = 'none';
    wbEl.innerHTML = '';
  }

  // Safety segment control
  mountSafetySegment(char);

  // Bookmark button
  updateBookmarkBtn();
}

// ─── SafetySegment Component ─────────────────────────────
// Mounts a segment control into `container`.
// Returns: { setValue(safety) }
function createSafetySegment(container, { canToggle, defaultSafety, onChange } = {}) {
  container.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'safety-segment-wrap';

  const segment = document.createElement('div');
  segment.className   = 'safety-segment';
  segment.dataset.safety = defaultSafety || 'on';
  if (!canToggle) segment.classList.add('safety-segment-disabled');

  const btnOn = document.createElement('button');
  btnOn.className   = 'safety-seg-btn' + (defaultSafety !== 'off' ? ' active' : '');
  btnOn.textContent = '🔒 전연령';
  btnOn.disabled    = !canToggle;

  const btnOff = document.createElement('button');
  btnOff.className   = 'safety-seg-btn' + (defaultSafety === 'off' ? ' active' : '');
  btnOff.textContent = '🔞 성인';
  btnOff.disabled    = !canToggle;

  const hint = document.createElement('p');
  hint.className    = 'safety-segment-hint';
  hint.textContent  = '모드를 변경할 수 없습니다';
  hint.style.display = canToggle ? 'none' : '';

  function setValue(value) {
    segment.dataset.safety = value;
    btnOn.classList.toggle('active',  value === 'on');
    btnOff.classList.toggle('active', value === 'off');
    onChange?.(value);
  }

  btnOn.addEventListener('click',  () => setValue('on'));
  btnOff.addEventListener('click', () => setValue('off'));

  segment.appendChild(btnOn);
  segment.appendChild(btnOff);
  wrap.appendChild(segment);
  wrap.appendChild(hint);
  container.appendChild(wrap);

  return { setValue };
}

let _safetySegment = null;  // current mounted instance

function setSafety(_value) { /* kept for legacy inline calls — no-op, handled by component */ }

function mountSafetySegment(char) {
  // toggleable 캐릭터라도 성인 인증 없으면 전연령 고정
  const adultEnabled  = !!_currentUser?.adult_content_enabled;
  const ratingLocked  = char.rating === 'toggleable' && !adultEnabled;
  const canToggle     = char.safetyToggle !== false && !ratingLocked;
  const defaultSafety = char.defaultSafety === 'off' ? 'off' : 'on';
  // 잠긴 경우 전연령 강제
  currentSafety = ratingLocked ? 'on' : defaultSafety;

  _safetySegment = createSafetySegment(
    document.getElementById('safety-segment-container'),
    {
      canToggle,
      defaultSafety: currentSafety,
      onChange: (value) => { currentSafety = value; },
    }
  );
}

function updateChatHeader(char) {
  if (!char) return;
  const avatar = document.getElementById('chat-header-avatar');
  if (char.image) {
    avatar.src   = char.image;
    avatar.alt   = char.name;
    avatar.style.display = '';
  } else {
    avatar.style.display = 'none';
  }
  document.getElementById('chat-header-name').textContent   = char.name;
  document.getElementById('chat-header-status').textContent =
    `${char.team}${char.role ? ' · ' + char.role : ''}`;
}


// ─── History Select-Delete State ─────────────────────────
let _selectMode   = false;
let _selectedIds  = new Set();

function toggleSelectMode() {
  _selectMode ? exitSelectMode() : enterSelectMode();
}

function enterSelectMode() {
  _selectMode  = true;
  _selectedIds = new Set();

  document.getElementById('history-default-actions').style.display = 'none';
  document.getElementById('history-select-actions').style.display  = '';
  document.getElementById('btn-confirm-delete').disabled = true;

  document.querySelectorAll('.session-card').forEach(card => {
    card.classList.add('select-mode');
  });
}

function exitSelectMode() {
  _selectMode  = false;
  _selectedIds = new Set();

  document.getElementById('history-default-actions').style.display = '';
  document.getElementById('history-select-actions').style.display  = 'none';

  document.querySelectorAll('.session-card').forEach(card => {
    card.classList.remove('select-mode', 'selected');
    const cb = card.querySelector('.session-checkbox');
    if (cb) cb.classList.remove('checked');
  });
}

function _updateDeleteBtn() {
  const btn = document.getElementById('btn-confirm-delete');
  if (!btn) return;
  btn.disabled = _selectedIds.size === 0;
}

function _toggleCardSelection(card, id) {
  if (_selectedIds.has(id)) {
    _selectedIds.delete(id);
    card.classList.remove('selected');
    card.querySelector('.session-checkbox').classList.remove('checked');
  } else {
    _selectedIds.add(id);
    card.classList.add('selected');
    card.querySelector('.session-checkbox').classList.add('checked');
  }
  _updateDeleteBtn();
}

async function loadSessionList() {
  exitSelectMode();
  const container = document.getElementById('session-list');
  container.innerHTML = '<p style="font-size:13px;color:var(--text-dim);">불러오는 중...</p>';

  try {
    const res  = await fetch('/api/sessions');
    const list = await res.json();

    if (list.length === 0) {
      container.innerHTML = '<p style="font-size:13px;color:var(--text-dim);">저장된 대화가 없습니다.</p>';
      return;
    }

    container.innerHTML = '';
    list.forEach(session => {
      const card = document.createElement('div');
      card.className  = 'session-card';
      card.dataset.id = session.id;

      const date    = new Date(session.created_at * 1000);
      const dateStr = `${date.getFullYear()}.${String(date.getMonth()+1).padStart(2,'0')}.${String(date.getDate()).padStart(2,'0')}`;
      const charConf = characters.find(c => c.id === session.character_id);
      const charName = charConf ? charConf.name : (session.character_id || '이화');

      // Checkbox (span — inputs don't support ::after)
      const checkbox = document.createElement('span');
      checkbox.className = 'session-checkbox';

      // Avatar wrap + badge
      const avatarWrap = document.createElement('div');
      avatarWrap.className = 'session-avatar-wrap';

      const avatarEl = document.createElement('div');
      avatarEl.className = 'session-avatar';
      if (charConf?.image) {
        avatarEl.style.backgroundImage = `url('${charConf.image}')`;
        avatarEl.classList.add('session-avatar-img');
      } else {
        avatarEl.textContent = charName[0];
      }

      avatarWrap.appendChild(avatarEl);

      const pennant = document.createElement('span');
      pennant.className = `session-safety-pennant ${session.safety === 'off' ? 'adult' : 'all-ages'}`;

      // Card body
      const body = document.createElement('div');
      body.className = 'session-card-body';
      body.innerHTML = `
        <div class="session-card-top">
          <span class="session-char-name">${charName}</span>
          <span class="session-date">${dateStr}</span>
        </div>
        <p class="session-preview">${session.last_message ? escapeHtml(session.last_message) : '대화 없음'}</p>
        <span class="session-persona-tag">${session.persona.name || '알 수 없음'}</span>
      `;

      card.appendChild(pennant);
      card.appendChild(checkbox);
      card.appendChild(avatarWrap);
      card.appendChild(body);

      card.addEventListener('click', (e) => {
        if (_selectMode) {
          e.preventDefault();
          _toggleCardSelection(card, session.id);
        } else {
          loadSession(session.id);
        }
      });

      container.appendChild(card);
    });
  } catch (_) {
    container.innerHTML = '<p style="font-size:13px;color:var(--text-dim);">불러오기 실패</p>';
  }
}

function handleDeleteClick() {
  if (!_selectMode || _selectedIds.size === 0) return;
  document.getElementById('delete-modal-title').textContent =
    `선택한 ${_selectedIds.size}개의 대화를 삭제하시겠습니까?`;
  document.getElementById('delete-modal-overlay').classList.add('open');
}

function handleDeleteAll() {
  const cards = document.querySelectorAll('.session-card');
  if (!cards.length) return;
  document.getElementById('delete-modal-title').textContent =
    `대화 ${cards.length}개를 모두 삭제하시겠습니까?`;
  // 전체 ID를 _selectedIds에 임시 세팅
  _selectedIds = new Set([...cards].map(c => c.dataset.id));
  document.getElementById('delete-modal-overlay').classList.add('open');
}

function closeDeleteModal(e) {
  if (e && e.target !== document.getElementById('delete-modal-overlay')) return;
  document.getElementById('delete-modal-overlay').classList.remove('open');
}

async function confirmDelete() {
  document.getElementById('delete-modal-overlay').classList.remove('open');
  const ids = [..._selectedIds];
  await Promise.all(ids.map(id =>
    fetch(`/api/chat/${id}`, { method: 'DELETE' })
  ));
  // Remove cards from DOM without full reload
  ids.forEach(id => {
    document.querySelector(`.session-card[data-id="${id}"]`)?.remove();
  });
  exitSelectMode();
  // Show empty state if nothing left
  const container = document.getElementById('session-list');
  if (!container.querySelector('.session-card')) {
    container.innerHTML = '<p style="font-size:13px;color:var(--text-dim);">저장된 대화가 없습니다.</p>';
  }
}

async function loadSession(id) {
  try {
    const res  = await fetch(`/api/sessions/${id}`);
    const data = await res.json();

    sessionId = data.id;
    userName  = data.persona.name || '';

    // Restore character
    const charConf = characters.find(c => c.id === data.character_id) || characters[0] || null;
    currentCharacter = charConf;
    updateChatHeader(currentCharacter);

    // Restore model
    setModelUI(data.model || CHAT_DEFAULT_MODEL);

    // Restore user image
    userImageUrl = localStorage.getItem(`user-img:${id}`) || null;

    messageLog = [];
    document.getElementById('chat-messages').innerHTML = '';

    const charName = currentCharacter?.name || '이화';
    data.messages.forEach(m => {
      appendMessage(m.role, m.role === 'user' ? userName : charName, m.content);
    });

    // Restore note dot
    try {
      const nr = await fetch(`/api/sessions/${id}/note`);
      const nd = await nr.json();
      document.getElementById('note-dot').style.display = nd.note?.trim() ? 'block' : 'none';
    } catch (_) {}

    navigateTo(`/character/${currentCharacter?.id || 'unknown'}/chat`);
    scrollToBottom();
  } catch (_) {
    alert('대화를 불러오는 데 실패했습니다.');
  }
}

// ─── Screen Navigation ───────────────────────────────────
function showScreen(id) {
  if (id !== 'screen-history' && _selectMode) exitSelectMode();
  if (id === 'screen-persona') { _selectedGender = null; document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('active')); }
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(id);
  target.classList.add('active');
  if (id !== 'screen-chat') target.scrollTop = 0;
  if (id === 'screen-history') loadSessionList();
  if (id === 'screen-explore') loadExplore();

  // Bottom nav: hidden in chat screens and login
  const nav = document.getElementById('bottom-nav');
  const noNavScreens = ['screen-chat', 'screen-builder-chat', 'screen-builder-loading', 'screen-builder-manual', 'screen-login', 'screen-reset-password', 'screen-notification', 'screen-persona-select', 'screen-persona-select-edit'];
  if (nav) nav.classList.toggle('hidden', noNavScreens.includes(id));
  updateNavActiveTab(id);
}

// ─── Router ───────────────────────────────────────────────
// Routes (evaluated top-to-bottom, first match wins):
//   /                          → landing
//   /history                   → session history list
//   /character/:id             → character intro
//   /character/:id/chat        → chat
//   /persona                   → persona setup (choice or form, requires currentCharacter)
//   /persona/new               → standalone persona creation (no character needed)
//   /persona/select            → persona select list (requires currentCharacter)
//   /persona/select/:id        → persona select edit (requires currentCharacter)
//   /persona/:id               → persona detail page (auth required)
//   /builder                   → builder chat
//   /builder/preview           → builder edit/preview
//   /login                     → login / register
//   /mypage                    → mypage (auth required)
const ROUTES = [
  { pattern: /^\/character\/([^/]+)\/chat$/,    handler: (m) => _routeChat(m[1])              },
  { pattern: /^\/character\/([^/]+)$/,          handler: (m) => _routeIntro(m[1])             },
  { pattern: /^\/persona\/new$/,                handler: ()  => _routePersonaNew()            },
  { pattern: /^\/persona\/select\/(\d+)$/,      handler: (m) => _routePersonaSelectEdit(m[1]) },
  { pattern: /^\/persona\/select$/,             handler: ()  => _routePersonaSelect()         },
  { pattern: /^\/persona\/(\d+)$/,              handler: (m) => _routePersonaDetail(m[1])     },
  { pattern: /^\/explore$/,                     handler: ()  => _routeExplore()               },
  { pattern: /^\/history$/,                     handler: ()  => _routeGated('screen-history')      },
  { pattern: /^\/persona$/,                     handler: ()  => _routePersonaLinked()              },
  { pattern: /^\/builder\/preview$/,            handler: ()  => _routeGated('screen-builder-edit')   },
  { pattern: /^\/builder\/chat$/,               handler: ()  => _routeGated('screen-builder-chat')   },
  { pattern: /^\/builder\/manual$/,             handler: ()  => _routeGated('screen-builder-manual') },
  { pattern: /^\/builder$/,                     handler: ()  => _routeGated('screen-builder')        },
  { pattern: /^\/notification$/,                handler: ()  => _routeNotification()              },
  { pattern: /^\/login$/,                       handler: ()  => _routeLogin()                      },
  { pattern: /^\/reset-password$/,              handler: ()  => _routeResetPassword()              },
  { pattern: /^\/mypage$/,                      handler: ()  => _routeMypage()                     },
  { pattern: /^\/creator\/@([^/]+)$/,           handler: (m) => _routeCreator(m[1])                },
  { pattern: /^\/$/,                            handler: ()  => showScreen('screen-landing')       },
];

function _routeExplore() {
  showScreen('screen-explore');
  loadExplore();
  if (_curationData) _renderExploreCuration(_curationData);
}

function _routeGated(screenId) {
  if (!_currentUser) {
    showAuthGate('로그인이 필요한 기능입니다', '이 기능을 이용하려면 로그인해주세요.', window.location.pathname);
    return;
  }
  showScreen(screenId);
}

// ─── Notifications ────────────────────────────────────────
let _notifItems = [];
let _notifActiveTab = 'all';

function _routeNotification() {
  showScreen('screen-notification');
  loadNotifications();
}

async function loadNotifBadge() {
  try {
    const res  = await fetch('/api/notifications/unread-count');
    const data = await res.json();
    const badge = document.getElementById('notif-badge');
    if (!badge) return;
    if (data.count > 0) {
      badge.textContent = data.count > 9 ? '9+' : data.count;
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
  } catch (_) {}
}

async function loadNotifications() {
  const feed = document.getElementById('notif-list');
  if (!feed) return;
  try {
    const res  = await fetch('/api/notifications');
    const data = await res.json();
    _notifItems = data.items || [];
    // 헤더 [N new] 배지
    const countEl = document.getElementById('notif-new-count');
    if (countEl) countEl.textContent = data.unreadCount > 0 ? `[${data.unreadCount} new]` : '';
    // 현재 탭으로 렌더
    renderNotifFeed(_notifActiveTab);
  } catch (_) {
    feed.innerHTML = '<p class="notif-empty">알림을 불러오지 못했습니다.</p>';
  }
}

function switchNotifTab(btn, tab) {
  _notifActiveTab = tab;
  document.querySelectorAll('.notif-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderNotifFeed(tab);
}

function renderNotifFeed(tab) {
  const feed = document.getElementById('notif-list');
  if (!feed) return;

  const filtered = tab === 'all' ? _notifItems : _notifItems.filter(n => n.category === tab);

  // 날짜 그룹 계산
  const now       = Date.now() / 1000;
  const todayMidnight    = new Date(); todayMidnight.setHours(0,0,0,0);
  const todayStart       = todayMidnight.getTime() / 1000;
  const yesterdayStart   = todayStart - 86400;
  const weekStart        = todayStart - 6 * 86400;

  const fmtDate = ts => {
    const d = new Date(ts * 1000);
    return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
  };

  const groups = [
    { key: 'today',     label: 'TODAY · 오늘',        items: filtered.filter(n => n.created_at >= todayStart) },
    { key: 'yesterday', label: 'YESTERDAY · 어제',    items: filtered.filter(n => n.created_at >= yesterdayStart && n.created_at < todayStart) },
    { key: 'week',      label: 'THIS.WEEK · 이번주',  items: filtered.filter(n => n.created_at >= weekStart   && n.created_at < yesterdayStart) },
    { key: 'older',     label: 'EARLIER · 이전',      items: filtered.filter(n => n.created_at <  weekStart) },
  ].filter(g => g.items.length > 0);

  if (filtered.length === 0) {
    feed.innerHTML = `<div class="notif-empty-state"><p class="notif-empty-title">NO MATCHES</p><p class="notif-empty-desc">새로운 알림이 오면 여기에 표시돼요.</p></div>`;
    return;
  }

  feed.innerHTML = groups.map(g => `
    <div class="notif-group">
      <div class="notif-group-header">
        <span class="notif-group-label">${g.label}</span>
        <span class="notif-group-date">${fmtDate(g.items[0].created_at)}</span>
      </div>
      ${g.items.map(n => buildNotifRow(n)).join('')}
    </div>
  `).join('');

  // NOTICE 아코디언 체크 (DOM 삽입 후 실제 높이 측정)
  requestAnimationFrame(applyNoticeAccordions);
}

function buildNotifRow(n) {
  const cat = n.category;
  // 아이콘 SVG
  const iconSvg = cat === 'social'
    ? `<img src="/images/icon-social.svg" width="18" height="18" alt="social">`
    : cat === 'notice'
    ? `<img src="/images/icon-notice.svg" width="18" height="18" alt="notice">`
    : `<img src="/images/icon-system.svg" width="18" height="18" alt="system">`;
  // 카테고리 뱃지
  const catBadge = cat === 'social'
    ? `<span class="notif-cat-badge notif-cat-social">SOCIAL</span>`
    : cat === 'notice'
    ? `<span class="notif-cat-badge notif-cat-notice">NOTICE</span>`
    : `<span class="notif-cat-badge notif-cat-sys">SYSTEM</span>`;
  const timeStr = notifTimeStr(n.created_at);

  return `
    <div class="notif-row${!n.is_read ? ' notif-row-recent' : ' notif-row-read'}"
         data-id="${n.id}" onclick="onNotifRowClick(this,${n.id})">
      <div class="notif-row-icon notif-icon-${cat}">${iconSvg}</div>
      <div class="notif-row-content">
        <div class="notif-row-top">
          <span class="notif-row-title">${n.title}</span>
          ${catBadge}
        </div>
        ${n.body
          ? cat === 'notice'
            ? `<div class="notif-notice-body-wrap"><p class="notif-row-body">${n.body}</p></div>`
            : `<p class="notif-row-body">${n.body}</p>`
          : ''}
        <p class="notif-row-time">${timeStr}</p>
      </div>
    </div>
  `;
}

// NOTICE 아코디언 — 렌더 후 실제 높이 체크해서 버튼 주입
function applyNoticeAccordions() {
  document.querySelectorAll('.notif-notice-body-wrap').forEach(wrap => {
    if (wrap.dataset.checked) return;
    wrap.dataset.checked = '1';
    // scrollHeight > clientHeight 이면 내용이 clamp 밖으로 넘침 → 버튼 추가
    if (wrap.scrollHeight > wrap.clientHeight + 2) {
      const btn = document.createElement('button');
      btn.className = 'notif-notice-toggle';
      btn.textContent = '더 보기';
      btn.onclick = (e) => {
        e.stopPropagation();
        const expanded = wrap.classList.toggle('notif-notice-expanded');
        btn.textContent = expanded ? '접기' : '더 보기';
      };
      wrap.after(btn);
    }
  });
}

function notifTimeStr(unixSec) {
  const diff = Math.floor(Date.now() / 1000) - unixSec;
  const d = new Date(unixSec * 1000);
  const hhmm = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  if (diff < 86400)    return hhmm;
  if (diff < 86400*2)  return `어제 ${hhmm}`;
  return `${d.getMonth()+1}/${d.getDate()} ${hhmm}`;
}

function onNotifRowClick(el, id) {
  // 읽음 처리
  if (!el.classList.contains('notif-row-read') && _currentUser) {
    fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
    el.classList.remove('notif-row-recent');
    el.classList.add('notif-row-read');
    // 헤더 카운트 갱신
    const countEl = document.getElementById('notif-new-count');
    if (countEl) {
      const cur = parseInt(countEl.textContent.replace(/\D/g,'')) || 0;
      const next = Math.max(0, cur - 1);
      countEl.textContent = next > 0 ? `[${next} new]` : '';
    }
    loadNotifBadge();
  }
}

async function markAllNotifRead() {
  if (!_currentUser) return;
  await fetch('/api/notifications/read-all', { method: 'PATCH' });
  document.querySelectorAll('.notif-row').forEach(el => el.classList.add('notif-row-read'));
  const countEl = document.getElementById('notif-new-count');
  if (countEl) countEl.textContent = '';
  loadNotifBadge();
}

function timeAgo(unixSec) {
  const diff = Math.floor(Date.now() / 1000) - unixSec;
  if (diff < 60)    return '방금 전';
  if (diff < 3600)  return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

function _routeLogin() {
  if (_currentUser) { navigateTo('/'); return; }
  showAuthView('login');
  showScreen('screen-login');
}

function _routeResetPassword() {
  if (_currentUser) { navigateTo('/'); return; }
  const token = new URLSearchParams(window.location.search).get('token');
  if (!token) { navigateTo('/login'); return; }
  document.getElementById('reset-pw-form-view').style.display = '';
  document.getElementById('reset-pw-done-view').style.display = 'none';
  document.getElementById('reset-pw-global-err').textContent  = '';
  document.getElementById('reset-pw-form').reset();
  showScreen('screen-reset-password');
}

function _routeMypage() {
  if (!_currentUser) {
    showAuthGate('마이페이지', '마이페이지를 이용하려면 로그인이 필요합니다.', window.location.pathname);
    return;
  }
  loadMypage();
  showScreen('screen-mypage');
}

function _routeCreator(username) {
  showScreen('screen-creator');
  loadCreatorProfile(username);
}

async function loadCreatorProfile(username) {
  const body = document.getElementById('creator-page-body');
  const navLabel = document.getElementById('creator-nav-username');
  body.innerHTML = '<p style="padding:40px 20px;text-align:center;color:var(--text-muted);">불러오는 중...</p>';
  if (navLabel) navLabel.textContent = '@' + username;

  try {
    const res  = await fetch(`/api/creator/${encodeURIComponent(username)}`);
    if (!res.ok) {
      body.innerHTML = '<p style="padding:60px 20px;text-align:center;color:var(--text-muted);">크리에이터를 찾을 수 없습니다.</p>';
      return;
    }
    const { user, characters, isOwner } = await res.json();

    // Stats aggregation
    const totalWorks  = characters.length;
    const totalChats  = characters.reduce((s, c) => s + (c.stats?.sessions || 0), 0);
    const totalLikes  = characters.reduce((s, c) => s + (c.stats?.bookmarks || 0), 0);

    // Avatar HTML
    const avatarHtml = user.avatar
      ? `<img src="${user.avatar}" class="creator-avatar-img" alt="">`
      : `<div class="creator-avatar-letter">${(user.nickname || '?')[0].toUpperCase()}</div>`;

    // Action button
    const actionBtn = isOwner
      ? `<button class="creator-action-btn" onclick="openMypageModal('info')">프로필 편집</button>`
      : `<button class="creator-action-btn creator-follow-btn">팔로우</button>`;

    // Character cards
    const pinnedChars = characters.filter(c => c.pinned);
    const allChars    = characters;

    function creatorCharCard(c) {
      const pinBtn = isOwner
        ? `<button class="creator-pin-btn ${c.pinned ? 'pinned' : ''}" onclick="toggleCreatorPin('${c.id}','${username}')" title="${c.pinned ? '핀 해제' : '핀 고정'}">
            ${c.pinned ? '⊛' : '⊙'}
           </button>`
        : '';
      return `
        <div class="creator-char-card" onclick="navigateTo('/character/${c.id}')">
          ${c.image
            ? `<img src="${c.image}" class="creator-char-img" alt="">`
            : `<div class="creator-char-img creator-char-img-empty">✦</div>`}
          ${pinBtn}
          <div class="creator-char-info">
            <div class="creator-char-name">${c.name}</div>
            <div class="creator-char-role">${c.role || ''}</div>
            <div class="creator-char-stats">
              <span>▲ ${fmtK(c.stats?.sessions || 0)}</span>
              <span>♥ ${fmtK(c.stats?.bookmarks || 0)}</span>
            </div>
          </div>
        </div>`;
    }

    body.innerHTML = `
      <div class="creator-header">
        <div class="creator-avatar-wrap">${avatarHtml}</div>
        <div class="creator-header-info">
          <div class="creator-nickname">${user.nickname}</div>
          <div class="creator-handle">@${user.username}</div>
        </div>
        <div class="creator-header-actions">${actionBtn}</div>
      </div>

      <div class="creator-stats-bar">
        <div class="creator-stat">
          <span class="creator-stat-val">${totalWorks}</span>
          <span class="creator-stat-label">WORKS</span>
        </div>
        <div class="creator-stat">
          <span class="creator-stat-val">${fmtK(totalChats)}</span>
          <span class="creator-stat-label">CHATS</span>
        </div>
        <div class="creator-stat">
          <span class="creator-stat-val">${fmtK(totalLikes)}</span>
          <span class="creator-stat-label">LIKES</span>
        </div>
      </div>

      ${pinnedChars.length ? `
      <div class="creator-section">
        <div class="creator-section-label"><span class="creator-section-prefix">&gt;</span> PINNED.WORK</div>
        <div class="creator-char-list">
          ${pinnedChars.map(creatorCharCard).join('')}
        </div>
      </div>` : ''}

      <div class="creator-section">
        <div class="creator-section-label"><span class="creator-section-prefix">&gt;</span> ALL.WORKS</div>
        ${allChars.length
          ? `<div class="creator-char-list">${allChars.map(creatorCharCard).join('')}</div>`
          : `<p class="creator-empty">아직 공개된 작품이 없습니다.</p>`}
      </div>
    `;
  } catch (err) {
    body.innerHTML = '<p style="padding:60px 20px;text-align:center;color:var(--text-muted);">오류가 발생했습니다.</p>';
  }
}

async function toggleCreatorPin(charId, username) {
  try {
    const res = await fetch(`/api/creator/${charId}/pin`, { method: 'PATCH' });
    if (!res.ok) return;
    loadCreatorProfile(username);
  } catch (_) {}
}

// ── Persona mode state ────────────────────────────────────
let _personaMode = 'linked'; // 'linked' | 'standalone'

function personaGoBack() {
  if (_personaMode === 'standalone') goBack('/mypage');
  else goBack(`/character/${currentCharacter?.id}`);
}

function showPersonaNewForm() {
  document.getElementById('persona-choice-wrap').style.display = 'none';
  document.getElementById('persona-form-wrap').style.display   = 'flex';
}

// /persona  →  character-linked (choice if has personas)
// 버튼 클릭 → 비동기 처리 후 화면 전환 (라우터 우회)
async function openPersonaSetup() {
  if (!currentCharacter) { navigateTo('/persona/new'); return; }
  _personaMode = 'linked';

  // UI 기본 세팅
  const charName = currentCharacter.name || '캐릭터';
  document.getElementById('persona-nav-label').textContent       = 'Persona Setup';
  document.getElementById('persona-subtitle').textContent        = `${charName}이(가) 당신을 알 수 있도록 정보를 입력해주세요.`;
  document.getElementById('persona-recommend-btn').style.display = 'flex';
  document.getElementById('persona-submit-btn').textContent      = '대화 시작';
  document.getElementById('p-notes').placeholder                 = `${charName}와(과)의 관계 등 특이사항을 입력해주세요`;

  let showChoice = false;
  if (_currentUser) {
    try {
      const res  = await fetch('/api/personas');
      const rows = res.ok ? await res.json() : [];
      showChoice = Array.isArray(rows) && rows.length > 0;
    } catch (e) {
      console.error('openPersonaSetup: personas fetch failed', e);
    }
  }

  document.getElementById('persona-choice-wrap').style.display = showChoice ? 'flex' : 'none';
  document.getElementById('persona-form-wrap').style.display   = showChoice ? 'none' : 'flex';

  window.history.pushState({ folio: true }, '', '/persona');
  showScreen('screen-persona');
}

// URL 직접 접근 / popstate 대비 (동기 fallback)
function _routePersonaLinked() {
  if (!currentCharacter) { navigateTo('/persona/new'); return; }
  _personaMode = 'linked';
  // URL 직접 접근: choice 없이 폼 표시
  document.getElementById('persona-choice-wrap').style.display   = 'none';
  document.getElementById('persona-form-wrap').style.display     = 'flex';
  document.getElementById('persona-recommend-btn').style.display = 'flex';
  document.getElementById('persona-submit-btn').textContent      = '대화 시작';
  showScreen('screen-persona');
}

// /persona/new  →  standalone (no character needed)
function _routePersonaNew() {
  _personaMode = 'standalone';

  // 폼 완전 초기화 (먼저 실행해서 잔존 데이터 제거)
  ['p-name', 'p-age', 'p-appearance', 'p-personality', 'p-notes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  _selectedGender = null;
  document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('active'));
  personaAvatarUpload?.reset?.();

  // UI 설정
  const $navLabel   = document.getElementById('persona-nav-label');
  const $choiceWrap = document.getElementById('persona-choice-wrap');
  const $formWrap   = document.getElementById('persona-form-wrap');
  const $recommend  = document.getElementById('persona-recommend-btn');
  const $submit     = document.getElementById('persona-submit-btn');

  if ($navLabel)   $navLabel.textContent    = '새 페르소나';
  if ($choiceWrap) $choiceWrap.style.display = 'none';
  if ($formWrap)   $formWrap.style.display   = '';
  if ($recommend)  $recommend.style.display  = 'none';   // 캐릭터 컨텍스트 없으므로 숨김
  if ($submit)     $submit.textContent       = '저장하기';

  // 캐릭터 컨텍스트 없으므로 제네릭 텍스트로 리셋
  const $subtitle = document.getElementById('persona-subtitle');
  if ($subtitle) $subtitle.textContent = '페르소나 정보를 입력해주세요.';
  const $notes = document.getElementById('p-notes');
  if ($notes) $notes.placeholder = '특이사항을 입력해주세요';

  showScreen('screen-persona');
}

// /persona/select  →  persona list for character-linked selection
async function _routePersonaSelect() {
  if (!currentCharacter) { navigateTo('/'); return; }
  if (!_currentUser)     { navigateTo('/persona'); return; }
  try {
    const rows = await (await fetch('/api/personas')).json();
    const defaultId = _currentUser?.default_persona_id;
    const list = document.getElementById('persona-select-list');
    if (!rows.length) {
      list.innerHTML = '<p class="mypage-empty" style="padding:32px 0;text-align:center;grid-column:1/-1;">저장된 페르소나가 없습니다.</p>';
    } else {
      list.innerHTML = rows.map(p => {
        const d = p.data;
        const isDefault = p.id === defaultId;
        const meta = [d.age ? d.age + '세' : '', d.gender === 'male' ? '남' : d.gender === 'female' ? '여' : ''].filter(Boolean).join(' · ');
        const hasImg = !!d.avatar;
        return `
          <div class="mypage-p-card${isDefault ? ' is-default' : ''}${hasImg ? ' has-image' : ''}" onclick="navigateTo('/persona/select/${p.id}')">
            ${hasImg
              ? `<img class="mypage-p-img" src="${d.avatar}" alt="${d.name || ''}">`
              : `<div class="mypage-p-no-img">
                   <div class="mypage-p-add-icon">
                     <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                   </div>
                 </div>`}
            <div class="mypage-p-overlay">
              <div class="mypage-p-name">${d.name || '이름 없음'}${isDefault ? ' <span class="default-badge">기본</span>' : ''}</div>
              ${meta ? `<div class="mypage-p-meta">${meta}</div>` : ''}
            </div>
          </div>`;
      }).join('');
    }
    showScreen('screen-persona-select');
  } catch (_) { navigateTo('/persona'); }
}

// /persona/select/:id  →  editable pre-filled form → startChatFromSelected
let _pseGender = null;

async function _routePersonaSelectEdit(id) {
  if (!currentCharacter) { navigateTo('/'); return; }
  try {
    const rows = await (await fetch('/api/personas')).json();
    const p    = rows.find(r => r.id === Number(id));
    if (!p) { navigateTo('/persona/select'); return; }
    const d = p.data;

    document.getElementById('pse-name').value        = d.name        || '';
    document.getElementById('pse-age').value         = d.age         || '';
    document.getElementById('pse-appearance').value  = d.appearance  || '';
    document.getElementById('pse-personality').value = d.personality || '';
    document.getElementById('pse-notes').value       = d.notes       || '';
    _pseGender = d.gender || null;
    document.querySelectorAll('.pse-gender-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.value === _pseGender)
    );
    showScreen('screen-persona-select-edit');
  } catch (_) { navigateTo('/persona/select'); }
}

function selectPseGender(value) {
  _pseGender = (_pseGender === value) ? null : value;
  document.querySelectorAll('.pse-gender-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.value === _pseGender)
  );
}

function startChatFromSelected(event) {
  event.preventDefault();
  if (!currentCharacter) return;
  userName = document.getElementById('pse-name').value.trim();
  const r = t => resolveUser(t, userName);
  window._persona = {
    name:        document.getElementById('pse-name').value.trim(),
    age:         parseInt(document.getElementById('pse-age').value),
    gender:      _pseGender,
    appearance:  r(document.getElementById('pse-appearance').value.trim()),
    personality: r(document.getElementById('pse-personality').value.trim()),
    notes:       r(document.getElementById('pse-notes').value.trim()),
  };
  window._characterId = currentCharacter.id;
  window._safety      = currentSafety;
  sessionId    = 'session-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  messageLog   = [];
  document.getElementById('chat-messages').innerHTML = '';
  document.getElementById('note-dot').style.display = 'none';
  setModelUI(CHAT_DEFAULT_MODEL);
  updateChatHeader(currentCharacter);
  userImageUrl = null;
  navigateTo(`/character/${currentCharacter.id}/chat`);
}

async function _routePersonaDetail(id) {
  if (!_currentUser) {
    showAuthGate('페르소나', '페르소나를 보려면 로그인이 필요합니다.', window.location.pathname);
    return;
  }
  try {
    const res  = await fetch('/api/personas');
    const rows = await res.json();
    const p    = rows.find(r => r.id === Number(id));
    if (!p) { navigateTo('/mypage'); return; }
    _populatePersonaDetail(p);
    showScreen('screen-persona-detail');
  } catch (_) { navigateTo('/mypage'); }
}

let _pdPersonaId = null;  // 현재 열린 페르소나 ID

function _populatePersonaDetail(p) {
  _pdPersonaId    = p.id;
  const d         = p.data;
  const isDefault = p.id === _currentUser?.default_persona_id;
  const genderTxt = d.gender === 'male' ? '남성' : d.gender === 'female' ? '여성' : '';
  const metaParts = [d.age ? d.age + '세' : '', genderTxt].filter(Boolean);
  const metaStr   = metaParts.join(' · ');
  const nameStr   = d.name || '이름 없음';

  // 3:4 프로필 카드
  const $card = document.getElementById('pd-card');
  if (d.avatar) {
    $card.innerHTML = `
      <img class="pd-card-img" src="${d.avatar}" alt="${nameStr}">
      <div class="pd-card-overlay">
        <div class="pd-card-name">${nameStr}</div>
        ${metaStr ? `<div class="pd-card-meta">${metaStr}</div>` : ''}
      </div>`;
  } else {
    $card.innerHTML = `
      <div class="pd-card-no-img">
        <div class="pd-card-no-img-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
          </svg>
        </div>
      </div>
      <div class="pd-card-overlay">
        <div class="pd-card-name">${nameStr}</div>
        ${metaStr ? `<div class="pd-card-meta">${metaStr}</div>` : ''}
      </div>`;
  }

  const fields = [
    d.appearance  && ['외형',   d.appearance],
    d.personality && ['성격',   d.personality],
    d.notes       && ['특이사항', d.notes],
  ].filter(Boolean);

  const profileCard = document.getElementById('pd-profile-card');
  if (fields.length) {
    profileCard.innerHTML = fields.map(([k, v]) =>
      `<div class="pt-row"><span class="pt-key">${k}</span><span class="pt-val">${v}</span></div>`
    ).join('');
    profileCard.style.display = '';
  } else {
    profileCard.style.display = 'none';
  }

  document.getElementById('pd-actions').innerHTML = `
    ${!isDefault
      ? `<button class="btn-primary" onclick="setDefaultPersona(${p.id});goBack('/mypage')">기본 설정</button>`
      : `<div style="display:flex;flex-direction:column;align-items:center;gap:6px;width:100%;">
           <p class="pd-default-label">✓ 현재 기본 페르소나</p>
           <button class="pd-delete-link" style="color:var(--text-dim);" onclick="clearDefaultPersona()">기본 해제</button>
         </div>`}
    <button class="pd-delete-link" onclick="deletePersona(${p.id});navigateTo('/mypage')">페르소나 삭제</button>
  `;
}

function _routeIntro(id) {
  const char = characters.find(c => c.id === id);
  if (!char) return showScreen('screen-landing');
  currentCharacter = char;
  populateIntroScreen(char);
  showScreen('screen-intro');
}

function _routeChat(id) {
  // Chat via URL only works if an active session exists for this character.
  // Otherwise fall back to intro.
  const char = characters.find(c => c.id === id);
  if (!char) return showScreen('screen-landing');
  if (sessionId && currentCharacter?.id === id) {
    showScreen('screen-chat');
  } else {
    currentCharacter = char;
    populateIntroScreen(char);
    showScreen('screen-intro');
  }
}


function renderRoute(path) {
  const pathname = (path || window.location.pathname).split('?')[0];
  for (const { pattern, handler } of ROUTES) {
    const m = pathname.match(pattern);
    if (m) { handler(m); return; }
  }
  // Unknown path → landing
  showScreen('screen-landing');
}

// ─── Worldbuilding Accordion ─────────────────────────────
function toggleWorldbuilding(btn) {
  const body = btn.nextElementSibling;
  const expanded = btn.getAttribute('aria-expanded') === 'true';
  if (expanded) {
    btn.setAttribute('aria-expanded', 'false');
    body.hidden = true;
  } else {
    btn.setAttribute('aria-expanded', 'true');
    body.hidden = false;
  }
}

function simpleMarkdown(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^/, '<p>').replace(/$/, '</p>');
}

function navigateTo(path) {
  window.history.pushState({ folio: true }, '', path);
  renderRoute(path);
}

function goBack(fallback = '/') {
  if (window.history.state?.folio || window.history.length > 1) {
    history.back();
  } else {
    navigateTo(fallback);
  }
}

// Back/forward buttons
window.addEventListener('popstate', () => renderRoute(window.location.pathname));

// ─── Toast ────────────────────────────────────────────────
let _toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
}

// ─── Character Search ─────────────────────────────────────
const CHOSUNG = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

function getChosung(str) {
  return [...str].map(ch => {
    const code = ch.charCodeAt(0) - 0xAC00;
    if (code < 0 || code > 11171) return ch;
    return CHOSUNG[Math.floor(code / 28 / 21)];
  }).join('');
}

function matchesQuery(char, q) {
  if (!q) return true;
  const lower = q.toLowerCase();
  const isChosung = /^[ㄱ-ㅎ]+$/.test(q);

  const targets = [
    char.name || '',
    char.fullName || '',
    char.subtitle || '',
    char.role || '',
    char.team || '',
    ...(Array.isArray(char.tags) ? char.tags : []),
    ...(Array.isArray(char.description) ? char.description : []),
  ];

  return targets.some(t => {
    const s = String(t);
    if (isChosung) return getChosung(s).includes(q);
    return s.toLowerCase().includes(lower);
  });
}

// ─── Explore Screen ──────────────────────────────────────
const EXPLORE_SUGGESTED_TAGS = ['현실', '판타지', '초자연', '로맨스', '액션', '일상', '다정', '차가운', '다혈질', '과묵', '밝은', '어두운'];

let _exploreQuery    = '';
let _exploreActiveTags = new Set();
let _exploreDebounce = null;

function loadExplore() {
  _exploreQuery = '';
  _exploreActiveTags = new Set();

  const input = document.getElementById('explore-search-input');
  if (input) input.value = '';

  _buildExploreTagBar();
  _applyExploreFilter();

  // init search input listener (idempotent via flag)
  if (!input?._exploreInited) {
    input?.addEventListener('input', () => {
      clearTimeout(_exploreDebounce);
      _exploreDebounce = setTimeout(() => {
        _exploreQuery = input.value;
        _applyExploreFilter();
      }, 300);
    });
    input?.addEventListener('keydown', e => {
      if (e.key === 'Escape') { input.value = ''; _exploreQuery = ''; _applyExploreFilter(); }
    });
    if (input) input._exploreInited = true;
  }
}

function _buildExploreTagBar() {
  const bar = document.getElementById('explore-tag-bar');
  if (!bar) return;

  // Gather all unique tags from loaded characters
  const charTags = new Set();
  characters.forEach(c => (c.tags || []).forEach(t => charTags.add(t)));

  // Merge: suggested first, then any extras from characters
  const allTags = [...EXPLORE_SUGGESTED_TAGS];
  charTags.forEach(t => { if (!allTags.includes(t)) allTags.push(t); });

  bar.innerHTML = '';

  // 전체 chip
  const allChip = document.createElement('button');
  allChip.className = 'explore-tag-chip' + (_exploreActiveTags.size === 0 ? ' active' : '');
  allChip.textContent = '전체';
  allChip.onclick = () => { _exploreActiveTags.clear(); _updateExploreTagBar(); _applyExploreFilter(); };
  bar.appendChild(allChip);

  allTags.forEach(tag => {
    const chip = document.createElement('button');
    chip.className = 'explore-tag-chip' + (_exploreActiveTags.has(tag) ? ' active' : '');
    chip.textContent = '#' + tag;
    chip.dataset.tag = tag;
    chip.onclick = () => {
      if (_exploreActiveTags.has(tag)) _exploreActiveTags.delete(tag);
      else _exploreActiveTags.add(tag);
      _updateExploreTagBar();
      _applyExploreFilter();
    };
    bar.appendChild(chip);
  });
}

function _updateExploreTagBar() {
  const bar = document.getElementById('explore-tag-bar');
  if (!bar) return;
  bar.querySelectorAll('.explore-tag-chip').forEach(chip => {
    if (!chip.dataset.tag) {
      chip.classList.toggle('active', _exploreActiveTags.size === 0);
    } else {
      chip.classList.toggle('active', _exploreActiveTags.has(chip.dataset.tag));
    }
  });
}

function _applyExploreFilter() {
  const results = characters.filter(c => {
    const matchesSearch = matchesQuery(c, _exploreQuery.trim());
    const matchesTags   = _exploreActiveTags.size === 0 ||
      [..._exploreActiveTags].every(tag => (c.tags || []).includes(tag));
    return matchesSearch && matchesTags;
  });

  const grid = document.getElementById('explore-grid');
  if (!grid) return;

  if (results.length === 0) {
    grid.innerHTML = '<p class="explore-empty">검색 결과가 없습니다.</p>';
    return;
  }

  grid.innerHTML = '';
  results.forEach((char, i) => grid.appendChild(buildCharCard(char, i)));
}

// ─── Explore View Tabs ───────────────────────────────────
let _currentChartSort = 'weekly';

const _chartData = {
  daily: [
    { rank:1,  name:'이화',    role:'프로파일러',    chats:'12.4k', img:'/images/ihwa.png',    change:2,  dir:'up'   },
    { rank:2,  name:'박재헌',  role:'서울 사장',     chats:'8.9k',  img:'/images/jaeheon.png', change:1,  dir:'down' },
    { rank:3,  name:'지세현',  role:'메인 작가',     chats:'7.2k',  img:'/images/sehyun.png',  change:0,  dir:'none' },
    { rank:4,  name:'한윤서',  role:'심야 DJ',      chats:'6.3k',  img:'/images/coming1.jpg', change:4,  dir:'up'   },
    { rank:5,  name:'강도윤',  role:'형사',          chats:'4.7k',  img:'/images/coming2.jpg', change:2,  dir:'down' },
    { rank:6,  name:'오영일',  role:'소설 편집자',   chats:'4.1k',  img:'/images/yujin.png',   change:3,  dir:'up'   },
    { rank:7,  name:'최시원',  role:'사진작가',      chats:'3.8k',  img:'/images/coming3.jpg', change:1,  dir:'down' },
    { rank:8,  name:'한세아',  role:'소설가',        chats:'3.5k',  img:'/images/coming4.jpg', change:0,  dir:'none' },
    { rank:9,  name:'이준혁',  role:'인디 뮤지션',   chats:'3.1k',  img:'/images/coming2.jpg', change:5,  dir:'up'   },
    { rank:10, name:'김유진',  role:'바리스타',      chats:'2.9k',  img:'/images/coming1.jpg', change:2,  dir:'down' },
    { rank:11, name:'박소율',  role:'웹툰 작가',     chats:'2.6k',  img:'/images/coming3.jpg', change:1,  dir:'up'   },
    { rank:12, name:'서민준',  role:'변호사',        chats:'2.4k',  img:'/images/coming4.jpg', change:3,  dir:'down' },
    { rank:13, name:'정하은',  role:'심리상담사',    chats:'2.2k',  img:'/images/ihwa.png',    change:0,  dir:'none' },
    { rank:14, name:'윤재원',  role:'북카페 사장',   chats:'2.0k',  img:'/images/jaeheon.png', change:2,  dir:'up'   },
    { rank:15, name:'류다현',  role:'야간 간호사',   chats:'1.8k',  img:'/images/sehyun.png',  change:1,  dir:'down' },
    { rank:16, name:'임서진',  role:'건축 설계사',   chats:'1.7k',  img:'/images/yujin.png',   change:4,  dir:'up'   },
    { rank:17, name:'강민서',  role:'유학생',        chats:'1.5k',  img:'/images/coming1.jpg', change:0,  dir:'none' },
    { rank:18, name:'오지안',  role:'마케터',        chats:'1.3k',  img:'/images/coming2.jpg', change:2,  dir:'down' },
    { rank:19, name:'문채원',  role:'로스쿨 학생',   chats:'1.2k',  img:'/images/coming3.jpg', change:1,  dir:'up'   },
    { rank:20, name:'신우혁',  role:'스타트업 CEO',  chats:'1.0k',  img:'/images/coming4.jpg', change:3,  dir:'down' },
  ],
  weekly: [
    { rank:1,  name:'이화',    role:'프로파일러',    chats:'58.2k', img:'/images/ihwa.png',    change:2,  dir:'up'   },
    { rank:2,  name:'박재헌',  role:'서울 사장',     chats:'41.7k', img:'/images/jaeheon.png', change:1,  dir:'down' },
    { rank:3,  name:'지세현',  role:'메인 작가',     chats:'37.4k', img:'/images/sehyun.png',  change:0,  dir:'none' },
    { rank:4,  name:'한윤서',  role:'심야 DJ',      chats:'29.1k', img:'/images/coming1.jpg', change:4,  dir:'up'   },
    { rank:5,  name:'강도윤',  role:'형사',          chats:'22.6k', img:'/images/coming2.jpg', change:2,  dir:'down' },
    { rank:6,  name:'오영일',  role:'소설 편집자',   chats:'19.3k', img:'/images/yujin.png',   change:1,  dir:'up'   },
    { rank:7,  name:'최시원',  role:'사진작가',      chats:'17.8k', img:'/images/coming3.jpg', change:3,  dir:'down' },
    { rank:8,  name:'한세아',  role:'소설가',        chats:'15.2k', img:'/images/coming4.jpg', change:0,  dir:'none' },
    { rank:9,  name:'이준혁',  role:'인디 뮤지션',   chats:'13.9k', img:'/images/coming2.jpg', change:6,  dir:'up'   },
    { rank:10, name:'김유진',  role:'바리스타',      chats:'12.1k', img:'/images/coming1.jpg', change:2,  dir:'down' },
    { rank:11, name:'박소율',  role:'웹툰 작가',     chats:'10.8k', img:'/images/coming3.jpg', change:1,  dir:'up'   },
    { rank:12, name:'서민준',  role:'변호사',        chats:'9.4k',  img:'/images/coming4.jpg', change:4,  dir:'down' },
    { rank:13, name:'정하은',  role:'심리상담사',    chats:'8.7k',  img:'/images/ihwa.png',    change:0,  dir:'none' },
    { rank:14, name:'윤재원',  role:'북카페 사장',   chats:'7.9k',  img:'/images/jaeheon.png', change:2,  dir:'up'   },
    { rank:15, name:'류다현',  role:'야간 간호사',   chats:'7.1k',  img:'/images/sehyun.png',  change:1,  dir:'down' },
    { rank:16, name:'임서진',  role:'건축 설계사',   chats:'6.3k',  img:'/images/yujin.png',   change:5,  dir:'up'   },
    { rank:17, name:'강민서',  role:'유학생',        chats:'5.6k',  img:'/images/coming1.jpg', change:0,  dir:'none' },
    { rank:18, name:'오지안',  role:'마케터',        chats:'4.9k',  img:'/images/coming2.jpg', change:3,  dir:'down' },
    { rank:19, name:'문채원',  role:'로스쿨 학생',   chats:'4.2k',  img:'/images/coming3.jpg', change:1,  dir:'up'   },
    { rank:20, name:'신우혁',  role:'스타트업 CEO',  chats:'3.7k',  img:'/images/coming4.jpg', change:2,  dir:'down' },
  ],
  monthly: [
    { rank:1,  name:'박재헌',  role:'서울 사장',     chats:'198k',  img:'/images/jaeheon.png', change:0,  dir:'none' },
    { rank:2,  name:'이화',    role:'프로파일러',    chats:'174k',  img:'/images/ihwa.png',    change:3,  dir:'up'   },
    { rank:3,  name:'한윤서',  role:'심야 DJ',      chats:'142k',  img:'/images/coming1.jpg', change:1,  dir:'up'   },
    { rank:4,  name:'지세현',  role:'메인 작가',     chats:'119k',  img:'/images/sehyun.png',  change:2,  dir:'down' },
    { rank:5,  name:'강도윤',  role:'형사',          chats:'97k',   img:'/images/coming2.jpg', change:1,  dir:'down' },
    { rank:6,  name:'이준혁',  role:'인디 뮤지션',   chats:'83k',   img:'/images/coming2.jpg', change:5,  dir:'up'   },
    { rank:7,  name:'오영일',  role:'소설 편집자',   chats:'71k',   img:'/images/yujin.png',   change:2,  dir:'up'   },
    { rank:8,  name:'최시원',  role:'사진작가',      chats:'64k',   img:'/images/coming3.jpg', change:0,  dir:'none' },
    { rank:9,  name:'한세아',  role:'소설가',        chats:'58k',   img:'/images/coming4.jpg', change:3,  dir:'down' },
    { rank:10, name:'서민준',  role:'변호사',        chats:'49k',   img:'/images/coming4.jpg', change:1,  dir:'up'   },
    { rank:11, name:'김유진',  role:'바리스타',      chats:'43k',   img:'/images/coming1.jpg', change:2,  dir:'down' },
    { rank:12, name:'정하은',  role:'심리상담사',    chats:'38k',   img:'/images/ihwa.png',    change:4,  dir:'up'   },
    { rank:13, name:'박소율',  role:'웹툰 작가',     chats:'33k',   img:'/images/coming3.jpg', change:0,  dir:'none' },
    { rank:14, name:'윤재원',  role:'북카페 사장',   chats:'28k',   img:'/images/jaeheon.png', change:1,  dir:'down' },
    { rank:15, name:'임서진',  role:'건축 설계사',   chats:'24k',   img:'/images/yujin.png',   change:6,  dir:'up'   },
    { rank:16, name:'류다현',  role:'야간 간호사',   chats:'21k',   img:'/images/sehyun.png',  change:2,  dir:'down' },
    { rank:17, name:'강민서',  role:'유학생',        chats:'18k',   img:'/images/coming1.jpg', change:0,  dir:'none' },
    { rank:18, name:'신우혁',  role:'스타트업 CEO',  chats:'15k',   img:'/images/coming2.jpg', change:3,  dir:'up'   },
    { rank:19, name:'오지안',  role:'마케터',        chats:'12k',   img:'/images/coming3.jpg', change:1,  dir:'down' },
    { rank:20, name:'문채원',  role:'로스쿨 학생',   chats:'9k',    img:'/images/coming4.jpg', change:2,  dir:'up'   },
  ],
};

const _chartLabels = {
  daily:   { eyebrow:'CHART.DAILY',   title:'TODAY · TOP 20',      date:() => { const d=new Date(); return `${d.getMonth()+1}.${String(d.getDate()).padStart(2,'0')}`; } },
  weekly:  { eyebrow:'CHART.WEEKLY',  title:'THIS WEEK · TOP 20',  date:() => { const d=new Date(); const mon=new Date(d); mon.setDate(d.getDate()-d.getDay()+1); const sun=new Date(mon); sun.setDate(mon.getDate()+6); return `${mon.getMonth()+1}.${String(mon.getDate()).padStart(2,'0')} — ${sun.getMonth()+1}.${String(sun.getDate()).padStart(2,'0')}`; } },
  monthly: { eyebrow:'CHART.MONTHLY', title:'THIS MONTH · TOP 20', date:() => { const d=new Date(); return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}`; } },
};

function switchExploreView(view) {
  document.getElementById('explore-view-curation').style.display = view === 'curation' ? '' : 'none';
  document.getElementById('explore-view-ranking').style.display  = view === 'ranking'  ? '' : 'none';
  document.getElementById('explore-tab-curation').classList.toggle('active', view === 'curation');
  document.getElementById('explore-tab-ranking').classList.toggle('active',  view === 'ranking');
  if (view === 'ranking') _renderChart(_currentChartSort);
}

function switchChartSort(sort) {
  _currentChartSort = sort;
  ['daily','weekly','monthly'].forEach(s => {
    document.getElementById(`chart-sort-${s}`).classList.toggle('active', s === sort);
  });
  _renderChart(sort);
}

function _renderChart(sort) {
  const lbl  = _chartLabels[sort];
  const data = _chartData[sort];

  const eyebrowEl = document.querySelector('#explore-view-ranking .feed-eyebrow');
  if (eyebrowEl) eyebrowEl.innerHTML = `<span class="feed-chevron">›</span> ${lbl.eyebrow}`;
  const titleEl = document.querySelector('.chart-title');
  if (titleEl) titleEl.textContent = lbl.title;
  const dateEl = document.getElementById('chart-date-label');
  if (dateEl) dateEl.textContent = lbl.date();

  const list = document.getElementById('chart-list');
  if (!list) return;
  list.innerHTML = data.map(item => {
    const changeHtml = item.dir === 'none'
      ? `<span class="chart-change chart-change-none">—</span>`
      : item.dir === 'up'
        ? `<span class="chart-change chart-change-up">▲ ${item.change}</span>`
        : `<span class="chart-change chart-change-down">▼ ${item.change}</span>`;
    return `
      <div class="chart-row">
        <span class="chart-rank">#${item.rank}</span>
        <img class="chart-avatar" src="${item.img}" alt="${item.name}">
        <div class="chart-info">
          <span class="chart-name">${item.name}</span>
          <span class="chart-meta">${item.role} · ${item.chats} chats</span>
        </div>
        ${changeHtml}
      </div>`;
  }).join('');
}

// ─── Curation Sections ───────────────────────────────────
let _curationData = null;

async function loadCurationSections() {
  try {
    const res = await fetch('/api/curation');
    _curationData = await res.json();
    _renderLandingCuration(_curationData);
    _renderExploreCuration(_curationData);
  } catch (e) {
    console.warn('큐레이션 로드 실패:', e);
  }
}

function _renderLandingCuration(c) {
  const secCreators = document.getElementById('section-creators');
  if (secCreators && c.creators) {
    secCreators.innerHTML = `
      <div class="feed-header">
        <div class="feed-header-top"><span class="feed-eyebrow"><span class="feed-chevron">›</span> TOP.creators</span></div>
        <div class="feed-header-main"><h2 class="feed-title">이번 주 제작자</h2></div>
      </div>
      <div class="creator-row" id="creator-slider">
        ${c.creators.map(cr => `
          <div class="creator-card">
            <div class="creator-avatar"><img src="${cr.img}" alt=""></div>
            <span class="creator-handle">${cr.handle}</span>
            <span class="creator-count">${cr.count}</span>
          </div>`).join('')}
      </div>`;
    initDragSlider(document.getElementById('creator-slider'));
  }

  const secGenres = document.getElementById('section-genres');
  if (secGenres && c.genres) {
    secGenres.innerHTML = `
      <div class="feed-header">
        <div class="feed-header-top"><span class="feed-eyebrow"><span class="feed-chevron">›</span> GENRE.catalog</span></div>
        <div class="feed-header-main">
          <h2 class="feed-title">장르로 찾아보기</h2>
          <button class="feed-view-all" onclick="navigateTo('/explore')">ALL <span class="feed-arrow">→</span></button>
        </div>
      </div>
      <div class="genre-row" id="genre-slider">
        ${c.genres.map(g => `
          <div class="genre-card" style="background-image:url('${g.img}')">
            <div class="genre-card-overlay">
              <span class="genre-card-label">${g.label}</span>
              <span class="genre-card-title">${g.title}</span>
              <span class="genre-card-count">${g.count}</span>
            </div>
          </div>`).join('')}
      </div>`;
    initDragSlider(document.getElementById('genre-slider'));
  }

  const secUpcoming = document.getElementById('section-upcoming');
  if (secUpcoming && c.upcoming) {
    secUpcoming.innerHTML = `
      <div class="feed-header">
        <div class="feed-header-top"><span class="feed-eyebrow"><span class="feed-chevron">›</span> UPCOMING.feed</span></div>
        <div class="feed-header-main"><h2 class="feed-title">다가오는 캐릭터</h2></div>
      </div>
      <div class="char-grid">
        ${c.upcoming.map(u => `
          <div class="char-card char-card-disabled">
            <img class="char-card-img" src="${u.img}" alt="">
            <div class="char-card-overlay">
              <div class="char-card-name">${u.name}</div>
              <div class="char-card-role">${u.role}</div>
            </div>
            <div class="char-card-pending-overlay"><span class="char-card-pending-label">준비중</span></div>
          </div>`).join('')}
      </div>`;
  }
}

let _bcTimer = null;
let _bcIdx   = 0;

function _renderExploreCuration(c) {
  const secBroadcast = document.getElementById('section-broadcast');
  if (secBroadcast && c.broadcast?.length) {
    const items = c.broadcast;
    secBroadcast.innerHTML = `
      <div class="bc-carousel">
        <div class="bc-track" id="bc-track">
          ${items.map(bc => `
            <div class="broadcast-banner">
              <div class="broadcast-banner-img" style="background-image:url('${bc.img}')"></div>
              <div class="broadcast-banner-inner">
                <div class="broadcast-badge"><span class="broadcast-dot"></span>BROADCAST · NOW</div>
                <h3 class="broadcast-title">${bc.title.replace(/\n/g,'<br>')}</h3>
                <p class="broadcast-meta">${bc.subtitle}</p>
              </div>
            </div>`).join('')}
        </div>
        <div class="bc-dots" id="bc-dots">
          ${items.map((_,i) => `<span class="bc-dot${i===0?' bc-dot-active':''}" onclick="_bcGo(${i})"></span>`).join('')}
        </div>
      </div>`;
    _bcIdx = 0;
    if (_bcTimer) clearInterval(_bcTimer);
    if (items.length > 1) _bcTimer = setInterval(() => _bcGo((_bcIdx + 1) % items.length), 4000);
    _initBcSwipe(document.getElementById('bc-track'), items.length);
  }

  const secTags = document.getElementById('section-tags');
  if (secTags && c.tags) {
    secTags.innerHTML = `
      <div class="tag-cloud-section">
        <div class="feed-header">
          <div class="feed-header-top"><span class="feed-eyebrow"><span class="feed-chevron">›</span> TAG.CLOUD</span></div>
          <div class="feed-header-main"><h2 class="feed-title">지금 자주 쓰이는 태그</h2></div>
        </div>
        <div class="tag-cloud-pills">
          ${c.tags.map(t => `<span class="tag-pill">${t}</span>`).join('')}
        </div>
      </div>`;
  }

  const secCollections = document.getElementById('section-collections');
  if (secCollections && c.collections) {
    secCollections.innerHTML = `
      <div class="editor-picks-section">
        <div class="feed-header" style="margin-bottom:16px;">
          <div class="feed-header-top"><span class="feed-eyebrow"><span class="feed-chevron">›</span> EDITOR.PICKS</span></div>
          <div class="feed-header-main">
            <h2 class="feed-title">이번 달의 큐레이션</h2>
            <button class="feed-view-all">ARCHIVE <span class="feed-arrow">→</span></button>
          </div>
          <p class="editor-picks-sub">주제로 묶인 캐릭터 시리즈.</p>
        </div>
        <div class="collection-list">
          ${c.collections.map(col => `
            <div class="collection-card">
              <div class="collection-card-img" style="background-image:url('${col.img}')"></div>
              <div class="collection-card-inner">
                <div>
                  <div class="collection-num">${col.num}</div>
                  <h3 class="collection-title">${col.title}</h3>
                </div>
                <p class="collection-meta">${col.meta}</p>
              </div>
            </div>`).join('')}
        </div>
      </div>`;
  }
}

// ─── Broadcast Carousel ──────────────────────────────────
function _bcGo(idx) {
  const track = document.getElementById('bc-track');
  const dots  = document.querySelectorAll('#bc-dots .bc-dot');
  if (!track) return;
  _bcIdx = idx;
  track.style.transform = `translateX(${-idx * 100}%)`;
  dots.forEach((d, i) => d.classList.toggle('bc-dot-active', i === idx));
}

function _initBcSwipe(track, total) {
  if (!track) return;
  let startX = 0, moved = false;
  track.addEventListener('touchstart', e => { startX = e.touches[0].clientX; moved = false; }, { passive: true });
  track.addEventListener('touchmove',  e => { moved = Math.abs(e.touches[0].clientX - startX) > 10; }, { passive: true });
  track.addEventListener('touchend',   e => {
    if (!moved) return;
    const diff = e.changedTouches[0].clientX - startX;
    if (diff < -40 && _bcIdx < total - 1) _bcGo(_bcIdx + 1);
    if (diff >  40 && _bcIdx > 0)         _bcGo(_bcIdx - 1);
    if (_bcTimer) { clearInterval(_bcTimer); _bcTimer = setInterval(() => _bcGo((_bcIdx + 1) % total), 4000); }
  });
}

// ─── Drag Slider ─────────────────────────────────────────
function initDragSlider(el) {
  if (!el || el._dragInited) return;
  el._dragInited = true;
  let isDown = false, startX = 0, scrollLeft = 0;

  el.addEventListener('mousedown', e => {
    isDown = true;
    el.classList.add('dragging');
    startX = e.pageX - el.offsetLeft;
    scrollLeft = el.scrollLeft;
  });
  el.addEventListener('mouseleave', () => { isDown = false; el.classList.remove('dragging'); });
  el.addEventListener('mouseup',    () => { isDown = false; el.classList.remove('dragging'); });
  el.addEventListener('mousemove',  e => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    el.scrollLeft = scrollLeft - (x - startX);
  });
}

// ─── Notice Carousel ─────────────────────────────────────
function initNoticeCarousel() {
  const carousel   = document.getElementById('notice-carousel');
  const pagination = document.getElementById('notice-pagination');
  if (!carousel || !pagination) return;

  const slides = carousel.querySelectorAll('.notice-slide');
  const total  = slides.length;

  function updatePage() {
    const idx  = Math.round(carousel.scrollLeft / carousel.clientWidth);
    pagination.textContent = `${idx + 1} / ${total}`;
  }

  carousel.addEventListener('scroll', updatePage, { passive: true });
  updatePage();
}

// ─── Model Picker ────────────────────────────────────────
function initModelPicker() {
  const picker = document.getElementById('model-picker');
  picker.innerHTML = '';

  let lastProvider = null;
  MODELS.forEach(m => {
    // Insert divider between provider groups
    if (lastProvider && m.provider !== lastProvider) {
      const divider = document.createElement('div');
      divider.className = 'model-divider';
      picker.appendChild(divider);
    }
    lastProvider = m.provider;

    const opt = document.createElement('div');
    opt.className  = 'model-option' + (m.id === currentModel ? ' active' : '');
    opt.dataset.id = m.id;
    opt.innerHTML  = `
      <div class="model-option-left">
        <span class="model-option-name">
          ${m.label}
          <span class="model-provider-badge model-provider-${m.provider}">${m.provider === 'gemini' ? 'Google' : 'Anthropic'}</span>
        </span>
        <span class="model-option-desc">${m.desc}</span>
      </div>
      <span class="model-option-check">✓</span>
    `;
    opt.onclick = () => selectModel(m.id);
    picker.appendChild(opt);
  });
}

function toggleModelPicker() {
  const picker = document.getElementById('model-picker');
  if (picker.classList.contains('open')) {
    picker.classList.remove('open');
    return;
  }
  const btn  = document.getElementById('btn-model');
  const rect = btn.getBoundingClientRect();
  picker.style.bottom = (window.innerHeight - rect.top + 20) + 'px';
  picker.style.left   = rect.left + 'px';
  picker.classList.add('open');
}

function selectModel(id) {
  currentModel = id;
  const found = MODELS.find(m => m.id === id);
  if (found) document.getElementById('model-label').textContent = found.label;
  document.querySelectorAll('.model-option').forEach(opt => {
    opt.classList.toggle('active', opt.dataset.id === id);
  });
  document.getElementById('model-picker').classList.remove('open');
}

function setModelUI(id) {
  const found = MODELS.find(m => m.id === id) || MODELS[0];
  currentModel = found.id;
  document.getElementById('model-label').textContent = found.label;
  document.querySelectorAll('.model-option').forEach(opt => {
    opt.classList.toggle('active', opt.dataset.id === found.id);
  });
}

// ─── Builder Model Picker ─────────────────────────────────
function initBuilderModelPicker() {
  const picker = document.getElementById('builder-model-picker');
  picker.innerHTML = '';

  let lastProvider = null;
  MODELS.forEach(m => {
    if (lastProvider && m.provider !== lastProvider) {
      const divider = document.createElement('div');
      divider.className = 'model-divider';
      picker.appendChild(divider);
    }
    lastProvider = m.provider;

    const opt = document.createElement('div');
    opt.className  = 'model-option' + (m.id === builderModel ? ' active' : '');
    opt.dataset.id = m.id;
    opt.innerHTML  = `
      <div class="model-option-left">
        <span class="model-option-name">
          ${m.label}
          <span class="model-provider-badge model-provider-${m.provider}">${m.provider === 'gemini' ? 'Google' : 'Anthropic'}</span>
        </span>
        <span class="model-option-desc">${m.desc}</span>
      </div>
      <span class="model-option-check">✓</span>
    `;
    opt.onclick = () => selectBuilderModel(m.id);
    picker.appendChild(opt);
  });
}

function toggleBuilderModelPicker() {
  const picker = document.getElementById('builder-model-picker');
  if (picker.classList.contains('open')) {
    picker.classList.remove('open');
    return;
  }
  const btn  = document.getElementById('btn-builder-model');
  const rect = btn.getBoundingClientRect();
  picker.style.bottom = (window.innerHeight - rect.top + 20) + 'px';
  picker.style.left   = rect.left + 'px';
  picker.classList.add('open');
}

function selectBuilderModel(id) {
  builderModel = id;
  const found = MODELS.find(m => m.id === id);
  if (found) document.getElementById('builder-model-label').textContent = found.label;
  document.getElementById('builder-model-picker')
    .querySelectorAll('.model-option')
    .forEach(opt => opt.classList.toggle('active', opt.dataset.id === id));
  document.getElementById('builder-model-picker').classList.remove('open');
}

function setBuilderModelUI(id) {
  const found = MODELS.find(m => m.id === id) || MODELS[0];
  builderModel = found.id;
  document.getElementById('builder-model-label').textContent = found.label;
  document.getElementById('builder-model-picker')
    .querySelectorAll('.model-option')
    .forEach(opt => opt.classList.toggle('active', opt.dataset.id === found.id));
}


// ─── {{user}} Token ───────────────────────────────────────
function resolveUser(text, name) {
  if (!text) return text;
  return text.replace(/\{\{user\}\}/g, name || '{{user}}');
}

function syncUserPlaceholders(name) {
  if (_personaMode === 'standalone') return;
  const charName = currentCharacter?.name || '캐릭터';
  document.getElementById('p-notes').placeholder = `${charName}와(과)의 관계 등 특이사항을 입력해주세요`;
}

// ─── Recommended Persona ─────────────────────────────────
function fillRecommended() {
  const p = currentCharacter?.recommendedPersona;
  if (!p) return;
  document.getElementById('p-name').value        = p.name        || '';
  document.getElementById('p-age').value         = p.age         || '';
  document.getElementById('p-appearance').value  = p.appearance  || '';
  document.getElementById('p-personality').value = p.personality || '';
  document.getElementById('p-notes').value       = p.notes       || '';
  _selectedGender = p.gender || null;
  document.querySelectorAll('.gender-btn').forEach(b => b.classList.toggle('active', b.dataset.value === _selectedGender));
  syncUserPlaceholders(p.name || '');
}

// ─── Gender Select ────────────────────────────────────────
let _selectedGender = null;

function selectGender(value) {
  _selectedGender = (_selectedGender === value) ? null : value;
  document.querySelectorAll('.gender-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === _selectedGender);
  });
}

// ─── Start Chat ───────────────────────────────────────────
async function startChat(event) {
  event.preventDefault();

  // Standalone mode: save persona and go back to mypage
  if (_personaMode === 'standalone') {
    const name   = document.getElementById('p-name').value.trim();
    const avatar = personaAvatarUpload?.getUrl() || null;
    const data = {
      name,
      age:         parseInt(document.getElementById('p-age').value),
      gender:      _selectedGender,
      appearance:  document.getElementById('p-appearance').value.trim(),
      personality: document.getElementById('p-personality').value.trim(),
      notes:       document.getElementById('p-notes').value.trim(),
      ...(avatar ? { avatar } : {}),
    };
    try {
      await fetch('/api/personas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      });
      showToast('페르소나가 저장되었습니다.');
      navigateTo('/mypage');
    } catch (_) { showToast('저장에 실패했습니다.'); }
    return;
  }

  if (!currentCharacter) {
    alert('캐릭터를 먼저 선택해주세요.');
    return;
  }

  userName = document.getElementById('p-name').value.trim();
  const r  = t => resolveUser(t, userName);

  userImageUrl = personaAvatarUpload?.getUrl() || null;

  window._persona = {
    name:        userName,
    age:         parseInt(document.getElementById('p-age').value),
    gender:      _selectedGender,
    appearance:  r(document.getElementById('p-appearance').value.trim()),
    personality: r(document.getElementById('p-personality').value.trim()),
    notes:       r(document.getElementById('p-notes').value.trim()),
    ...(userImageUrl ? { avatar: userImageUrl } : {}),
  };
  window._characterId = currentCharacter.id;
  window._safety      = currentSafety;

  sessionId = 'session-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);

  messageLog = [];
  document.getElementById('chat-messages').innerHTML = '';
  document.getElementById('note-dot').style.display = 'none';
  setModelUI(CHAT_DEFAULT_MODEL);
  updateChatHeader(currentCharacter);

  if (userImageUrl) localStorage.setItem(`user-img:${sessionId}`, userImageUrl);

  // Save persona to user account if logged in
  if (_currentUser) {
    fetch('/api/personas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: window._persona }),
    }).catch(() => {});
  }

  navigateTo(`/character/${currentCharacter.id}/chat`);
}

// ─── Reset / Back ─────────────────────────────────────────
async function resetChat() {
  sessionId = null;
  navigateTo('/');
}

// ─── Character Profile Modal ─────────────────────────────
function openCharProfile() {
  const char = currentCharacter;
  if (!char) return;

  const body = document.getElementById('char-profile-body');

  // Image
  const imgHtml = char.image
    ? `<img src="${char.image}" alt="${char.name}" class="char-profile-img" />`
    : '';

  // Profile rows
  const profileHtml = (char.profile && Object.keys(char.profile).length > 0)
    ? `<div class="profile-card" style="margin-top:0;">
        ${Object.entries(char.profile).map(([k, v]) =>
          `<div class="pt-row"><span class="pt-key">${k}</span><span class="pt-val">${v}</span></div>`
        ).join('')}
       </div>`
    : '';

  // Creator's note
  const noteHtml = (char.description && char.description.length > 0)
    ? `<div class="note-card">
        <p class="note-eyebrow">제작자 노트</p>
        ${char.description.map(p => `<p>${p}</p>`).join('')}
       </div>`
    : '';

  body.innerHTML = `
    ${imgHtml}
    <div class="char-profile-names">
      <p class="char-profile-fullname">${char.fullName || char.name}</p>
      <p class="char-profile-subtitle">${char.subtitle || char.team || ''}</p>
    </div>
    ${profileHtml}
    ${noteHtml}
  `;

  document.getElementById('char-profile-overlay').classList.add('open');
}

function _dismissCharProfile() {
  const overlay = document.getElementById('char-profile-overlay');
  const panel   = overlay.querySelector('.char-profile-panel');
  panel.classList.add('closing');
  panel.addEventListener('animationend', () => {
    panel.classList.remove('closing');
    overlay.classList.remove('open');
  }, { once: true });
}

function closeCharProfile(e) {
  if (e && e.target !== document.getElementById('char-profile-overlay')) return;
  _dismissCharProfile();
}

function closeCharProfilePanel() {
  _dismissCharProfile();
}

// ─── Note Panel ───────────────────────────────────────────
async function openNote() {
  if (!sessionId) return;
  try {
    const res  = await fetch(`/api/sessions/${sessionId}/note`);
    const data = await res.json();
    const ta   = document.getElementById('note-textarea');
    ta.value   = data.note || '';
    updateNoteCount();
  } catch (_) {}
  document.getElementById('note-overlay').classList.add('open');
}

function closeNotePanel() {
  document.getElementById('note-overlay').classList.remove('open');
}

function closeNote(e) {
  if (e.target === document.getElementById('note-overlay')) closeNotePanel();
}

function updateNoteCount() {
  const ta = document.getElementById('note-textarea');
  document.getElementById('note-count').textContent = `${ta.value.length} / 1000`;
}

async function saveNote() {
  if (!sessionId) return;
  const note = document.getElementById('note-textarea').value;
  try {
    await fetch(`/api/sessions/${sessionId}/note`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ note }),
    });
    document.getElementById('note-dot').style.display = note.trim() ? 'block' : 'none';
    closeNotePanel();
  } catch (_) {}
}

// ─── Send Message ─────────────────────────────────────────
async function sendMessage() {
  const input    = document.getElementById('chat-input');
  const text     = input.value.trim();
  const charName = currentCharacter?.name || '이화';
  if (!text || !sessionId) return;

  input.value = '';
  autoResize(input);
  setInputDisabled(true);

  appendMessage('user', userName || '유저', text);
  const typingEl = appendTyping(charName);

  const body = { sessionId, message: text, model: currentModel };
  if (window._persona) {
    body.persona     = window._persona;
    body.characterId = window._characterId || currentCharacter?.id || 'ihwa';
    body.safety      = window._safety || 'on';
    window._persona     = null;
    window._characterId = null;
    window._safety      = null;
  }

  try {
    const res  = await fetch('/api/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
    const data = await res.json();
    typingEl.remove();

    if (data.error) {
      appendMessage('assistant', charName, '(오류가 발생했습니다. 잠시 후 다시 시도해주세요.)');
    } else {
      appendMessage('assistant', charName, data.reply);
    }
  } catch (_) {
    typingEl.remove();
    appendMessage('assistant', charName, '(연결에 실패했습니다.)');
  }

  setInputDisabled(false);
  input.focus();
}

// ─── Mode Toggle ─────────────────────────────────────────
function toggleMode() {
  currentMode = currentMode === 'chat' ? 'novel' : 'chat';
  document.getElementById('btn-mode-toggle').textContent =
    currentMode === 'novel' ? '💬 채팅' : '📖 소설';
  const container = document.getElementById('chat-messages');
  container.classList.toggle('novel-mode', currentMode === 'novel');
  lastAssistantEl = null;
  container.innerHTML = '';
  messageLog.forEach(m => renderMessage(m.role, m.sender, m.text, container));
  scrollToBottom();
}

// ─── DOM Helpers ─────────────────────────────────────────
function appendMessage(role, sender, text) {
  messageLog.push({ role, sender, text });
  return renderMessage(role, sender, text, document.getElementById('chat-messages'));
}

function renderMessage(role, sender, text, container) {
  if (role === 'assistant' && lastAssistantEl) {
    const old = lastAssistantEl.querySelector('.btn-regenerate');
    if (old) old.remove();
  }

  const wrap = document.createElement('div');
  wrap.className = 'msg ' + role;

  if (role === 'assistant') {
    // Character avatar
    const avatar = document.createElement('img');
    avatar.src       = currentCharacter?.image || '/images/ihwa.png';
    avatar.alt       = sender;
    avatar.className = 'msg-avatar';
    wrap.appendChild(avatar);

    const inner = document.createElement('div');
    inner.className = 'msg-inner';

    const name = document.createElement('div');
    name.className   = 'msg-sender';
    name.textContent = sender;

    const bubble = document.createElement('div');
    bubble.className  = 'msg-bubble';
    bubble._versions  = [text];
    bubble._vIdx      = 0;
    if (currentMode === 'novel') {
      bubble.innerHTML = highlightDialogue(escapeHtml(text));
    } else {
      bubble.textContent = text;
    }

    // Pagination (hidden until 2+ versions exist)
    const pagination = document.createElement('div');
    pagination.className    = 'msg-pagination';
    pagination.style.display = 'none';
    bubble._paginationEl = pagination;

    const btnPrev = document.createElement('button');
    btnPrev.className   = 'btn-pg';
    btnPrev.textContent = '←';
    btnPrev.onclick = () => {
      if (bubble._vIdx > 0) { bubble._vIdx--; _applyVersion(bubble); }
    };

    const pgCounter = document.createElement('span');
    pgCounter.className = 'pg-counter';

    const btnNext = document.createElement('button');
    btnNext.className   = 'btn-pg';
    btnNext.textContent = '→';
    btnNext.onclick = () => {
      if (bubble._vIdx < bubble._versions.length - 1) { bubble._vIdx++; _applyVersion(bubble); }
    };

    pagination.appendChild(btnPrev);
    pagination.appendChild(pgCounter);
    pagination.appendChild(btnNext);

    const regenBtn = document.createElement('button');
    regenBtn.className   = 'btn-regenerate';
    regenBtn.textContent = '↺ 다시 생성';
    regenBtn.onclick     = () => regenerateMessage(wrap, bubble, regenBtn);

    inner.appendChild(name);
    inner.appendChild(bubble);
    inner.appendChild(pagination);
    inner.appendChild(regenBtn);
    wrap.appendChild(inner);
    lastAssistantEl = wrap;
  } else {
    // User message
    if (userImageUrl) {
      const avatar = document.createElement('img');
      avatar.src       = userImageUrl;
      avatar.alt       = userName;
      avatar.className = 'msg-user-avatar';
      wrap.appendChild(avatar);
    }
    const inner = document.createElement('div');
    inner.className = 'msg-inner-user';

    const name = document.createElement('div');
    name.className   = 'msg-sender';
    name.textContent = sender;

    const bubble = document.createElement('div');
    bubble.className   = 'msg-bubble';
    bubble.textContent = text;

    inner.appendChild(name);
    inner.appendChild(bubble);
    wrap.appendChild(inner);
  }

  container.appendChild(wrap);
  scrollToBottom();
  return wrap;
}

function highlightDialogue(html) {
  html = html.replace(/\u201C([^\u201D\n]*)\u201D/g,
    '<span class="dialogue">\u201C$1\u201D</span>');
  html = html.replace(/"([^"\n]+)"/g,
    '<span class="dialogue">"$1"</span>');
  return html;
}

function _applyVersion(bubbleEl) {
  const text  = bubbleEl._versions[bubbleEl._vIdx];
  const total = bubbleEl._versions.length;
  const idx   = bubbleEl._vIdx;

  if (currentMode === 'novel') {
    bubbleEl.innerHTML = highlightDialogue(escapeHtml(text));
  } else {
    bubbleEl.textContent = text;
  }

  const pg = bubbleEl._paginationEl;
  if (!pg) return;
  pg.style.display = total > 1 ? 'flex' : 'none';
  pg.querySelector('.pg-counter').textContent = `${idx + 1} / ${total}`;
  pg.querySelectorAll('.btn-pg')[0].disabled = idx === 0;
  pg.querySelectorAll('.btn-pg')[1].disabled = idx === total - 1;
}

async function regenerateMessage(_wrapEl, bubbleEl, btnEl) {
  if (!sessionId) return;
  btnEl.disabled = true;
  const prevText = bubbleEl._versions[bubbleEl._vIdx];

  // Show typing indicator
  bubbleEl.className = 'typing-bubble';
  bubbleEl.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';

  try {
    const res  = await fetch('/api/chat/regenerate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ sessionId }),
    });
    const data = await res.json();
    bubbleEl.className = 'msg-bubble';
    const newText = data.error ? '(재생성에 실패했습니다.)' : data.reply;

    // Add new version and show it
    bubbleEl._versions.push(newText);
    bubbleEl._vIdx = bubbleEl._versions.length - 1;
    _applyVersion(bubbleEl);

    const last = messageLog.findLast(m => m.role === 'assistant');
    if (last) last.text = newText;
  } catch (_) {
    bubbleEl.className = 'msg-bubble';
    bubbleEl._versions[bubbleEl._vIdx] = prevText;
    _applyVersion(bubbleEl);
  }
  btnEl.disabled = false;
  scrollToBottom();
}

function appendTyping(charName) {
  const container = document.getElementById('chat-messages');
  const wrap = document.createElement('div');
  wrap.className = 'msg assistant';

  const avatar = document.createElement('img');
  avatar.src       = currentCharacter?.image || '/images/ihwa.png';
  avatar.alt       = charName || '이화';
  avatar.className = 'msg-avatar';

  const inner = document.createElement('div');
  inner.className = 'msg-inner';

  const name = document.createElement('div');
  name.className   = 'msg-sender';
  name.textContent = charName || '이화';

  const bubble = document.createElement('div');
  bubble.className = 'typing-bubble';
  bubble.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';

  inner.appendChild(name);
  inner.appendChild(bubble);
  wrap.appendChild(avatar);
  wrap.appendChild(inner);
  container.appendChild(wrap);
  scrollToBottom();
  return wrap;
}

function scrollToBottom() {
  const el = document.getElementById('chat-messages');
  el.scrollTop = el.scrollHeight;
}

function setInputDisabled(disabled) {
  document.getElementById('chat-input').disabled = disabled;
  document.getElementById('btn-send').disabled   = disabled;
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 100) + 'px';
}

// ─── Character Builder ────────────────────────────────────
let builderSessionId = null;
let builderCharData  = null;
let builderSystemMd  = null;
let _builderTags     = [];   // 태그 편집 중 상태
let _builderRating   = 'all_ages'; // 'all_ages' | 'toggleable' | 'adult_only'

function selectBuilderRating(value) {
  _builderRating = value;
  document.querySelectorAll('#be-rating-group .rating-select-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === value);
  });
}

// ── AI Builder tag input ───────────────────────────────────
function _initTagInput() {
  const input = document.getElementById('be-tag-input');
  if (!input) return;
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      _addBuilderTag(input.value);
      input.value = '';
    } else if (e.key === 'Backspace' && input.value === '' && _builderTags.length) {
      _builderTags.pop();
      _renderBuilderTags();
    }
  });
  input.addEventListener('input', () => {
    if (input.value.includes(',')) {
      input.value.split(',').forEach(t => _addBuilderTag(t));
      input.value = '';
    }
  });
}

function _addBuilderTag(raw) {
  const tag = raw.trim().replace(/^#/, '');
  if (!tag || _builderTags.includes(tag) || _builderTags.length >= 8) return;
  _builderTags.push(tag);
  _renderBuilderTags();
}

function addBuilderTagSuggest(tag) {
  _addBuilderTag(tag);
  document.getElementById('be-tag-input')?.focus();
}

function _removeBuilderTag(idx) {
  _builderTags.splice(idx, 1);
  _renderBuilderTags();
}

function _renderBuilderTags() {
  const wrap = document.getElementById('be-tag-chips');
  if (!wrap) return;
  wrap.innerHTML = _builderTags.map((t, i) =>
    `<span class="tag-chip">#${t}<button type="button" class="tag-chip-x" onclick="_removeBuilderTag(${i})">×</button></span>`
  ).join('');
}

// ── Manual Builder state & tag input ─────────────────────
let _manualTags   = [];
let _manualRating = 'all_ages';

function selectManualRating(value) {
  _manualRating = value;
  document.querySelectorAll('#bm-rating-group .rating-select-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === value);
  });
}

function _initManualTagInput() {
  const input = document.getElementById('bm-tag-input');
  if (!input) return;
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      _addManualTag(input.value);
      input.value = '';
    } else if (e.key === 'Backspace' && input.value === '' && _manualTags.length) {
      _manualTags.pop();
      renderManualTags();
    }
  });
  input.addEventListener('input', () => {
    if (input.value.includes(',')) {
      input.value.split(',').forEach(t => _addManualTag(t));
      input.value = '';
    }
  });
}

function _addManualTag(raw) {
  const tag = raw.trim().replace(/^#/, '');
  if (!tag || _manualTags.includes(tag) || _manualTags.length >= 8) return;
  _manualTags.push(tag);
  renderManualTags();
}

function addManualTag(tag) {
  _addManualTag(tag);
  document.getElementById('bm-tag-input')?.focus();
}

function removeManualTag(idx) {
  _manualTags.splice(idx, 1);
  renderManualTags();
}

function renderManualTags() {
  const wrap = document.getElementById('bm-tag-chips');
  if (!wrap) return;
  wrap.innerHTML = _manualTags.map((t, i) =>
    `<span class="tag-chip">#${t}<button type="button" class="tag-chip-x" onclick="removeManualTag(${i})">×</button></span>`
  ).join('');
}

function _generateManualSystemPrompt(d) {
  const lines = [];
  lines.push(`당신은 ${d.name}입니다. 아래 설정에 따라 캐릭터를 연기하세요.\n`);
  if (d.age || d.occupation) {
    lines.push('## 기본 정보');
    if (d.age)        lines.push(`- 나이: ${d.age}세`);
    if (d.occupation) lines.push(`- 직업/역할: ${d.occupation}`);
    lines.push('');
  }
  if (d.appearance)    lines.push(`## 외형\n${d.appearance}\n`);
  if (d.personality)   lines.push(`## 성격\n${d.personality}\n`);
  if (d.speechStyle)   lines.push(`## 말투\n${d.speechStyle}\n`);
  if (d.speechExamples?.length) {
    lines.push('## 말투 예시');
    d.speechExamples.forEach(e => lines.push(`- "${e}"`));
    lines.push('');
  }
  if (d.background)     lines.push(`## 배경 스토리\n${d.background}\n`);
  if (d.worldbuilding)  lines.push(`## 세계관\n${d.worldbuilding}\n`);
  if (d.relationship)   lines.push(`## 유저와의 관계\n${d.relationship}\n`);
  lines.push(`## 대화 규칙\n- 항상 ${d.name}의 말투와 성격을 유지하세요.\n- 캐릭터 설정에서 벗어나지 마세요.\n- 자연스럽고 몰입감 있는 대화를 이어가세요.`);
  return lines.join('\n');
}

async function registerManualCharacter() {
  const name = document.getElementById('bm-name').value.trim();
  if (!name) { showToast('캐릭터 이름을 입력해주세요.'); return; }

  const examples = (document.getElementById('bm-speechExamples').value || '')
    .split('\n').map(s => s.trim()).filter(Boolean);

  const characterData = {
    name,
    occupation:     document.getElementById('bm-occupation').value.trim(),
    age:            document.getElementById('bm-age').value || '',
    subtitle:       document.getElementById('bm-subtitle').value.trim(),
    appearance:     document.getElementById('bm-appearance').value.trim(),
    personality:    document.getElementById('bm-personality').value.trim(),
    speechStyle:    document.getElementById('bm-speechStyle').value.trim(),
    speechExamples: examples,
    background:     document.getElementById('bm-background').value.trim(),
    worldbuilding:  document.getElementById('bm-worldbuilding').value.trim(),
    relationship:   document.getElementById('bm-relationship').value.trim(),
    tags:           _manualTags,
    rating:         _manualRating,
    hasProfanity:   _manualRating === 'adult_only',
  };

  const systemPrompt = _generateManualSystemPrompt(characterData);
  const imageData    = manualAvatarUpload?.getUrl() || null;

  showScreen('screen-builder-loading');
  const bar = document.getElementById('builder-progress-bar');
  bar.style.width = '0%';
  let prog = 0;
  const iv = setInterval(() => {
    prog = Math.min(prog + 8, 85);
    bar.style.width = prog + '%';
  }, 120);

  try {
    const res  = await fetch('/api/characters/create', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ characterData, systemPrompt, imageData }),
    });
    clearInterval(iv);
    bar.style.width = '100%';

    if (!res.ok) throw new Error('create failed');
    const data = await res.json();

    await loadCharacters();
    setTimeout(() => {
      showToast('캐릭터가 등록되었습니다!');
      navigateTo('/');
    }, 400);
  } catch (err) {
    clearInterval(iv);
    console.error('registerManualCharacter error:', err);
    showScreen('screen-builder-manual');
    showToast('캐릭터 등록에 실패했습니다. 다시 시도해주세요.');
  }
}

let builderModel     = BUILDER_DEFAULT_MODEL;

function openBuilder() {
  if (!_currentUser) { showAuthGate('캐릭터 제작', '캐릭터를 제작하려면 로그인이 필요합니다.'); return; }
  navigateTo('/builder');
}

function openBuilderChat() {
  if (!_currentUser) { showAuthGate('캐릭터 제작', '캐릭터를 제작하려면 로그인이 필요합니다.'); return; }
  // Reset AI builder state
  builderSessionId = null;
  builderCharData  = null;
  builderSystemMd  = null;
  builderModel     = BUILDER_DEFAULT_MODEL;
  setBuilderModelUI(BUILDER_DEFAULT_MODEL);
  document.getElementById('builder-messages').innerHTML = '';
  document.getElementById('builder-input').value = '';

  navigateTo('/builder/chat');
  const builderInput = document.getElementById('builder-input');
  builderInput.style.height = '';
  setTimeout(initBuilderConversation, 80);
}

function openBuilderManual() {
  if (!_currentUser) { showAuthGate('캐릭터 제작', '캐릭터를 제작하려면 로그인이 필요합니다.'); return; }
  // Reset manual builder state
  _manualTags   = [];
  _manualRating = 'all_ages';
  ['bm-name','bm-occupation','bm-subtitle','bm-appearance','bm-personality',
   'bm-speechStyle','bm-speechExamples','bm-background','bm-worldbuilding','bm-relationship']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('bm-age').value = '';
  renderManualTags();
  document.querySelectorAll('#bm-rating-group .rating-select-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.value === 'all_ages');
  });
  manualAvatarUpload?.reset?.();
  navigateTo('/builder/manual');
  _initManualTagInput();
}

async function initBuilderConversation() {
  setBuilderInputDisabled(true);
  const typingEl = appendBuilderTyping();

  try {
    const res  = await fetch('/api/builder/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ message: '시작해줘', builderSessionId: null, model: builderModel }),
    });
    const data = await res.json();
    typingEl.remove();
    builderSessionId = data.builderSessionId;
    appendBuilderMessage('assistant', data.reply);
    if (data.isReady) handleCharacterReady(data.reply);
  } catch (_) {
    typingEl.remove();
    appendBuilderMessage('assistant', '(연결에 실패했습니다. 다시 시도해주세요.)');
  }

  setBuilderInputDisabled(false);
  document.getElementById('builder-input').focus();
}

async function builderSend() {
  const input = document.getElementById('builder-input');
  const text  = input.value.trim();
  if (!text) return;

  input.value = '';
  autoResize(input);
  setBuilderInputDisabled(true);

  appendBuilderMessage('user', text);
  const typingEl = appendBuilderTyping();

  try {
    const res  = await fetch('/api/builder/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ message: text, builderSessionId, model: builderModel }),
    });
    const data = await res.json();
    typingEl.remove();
    builderSessionId = data.builderSessionId;
    appendBuilderMessage('assistant', data.reply);
    if (data.isReady) handleCharacterReady(data.reply);
  } catch (_) {
    typingEl.remove();
    appendBuilderMessage('assistant', '(연결에 실패했습니다. 다시 시도해주세요.)');
  }

  setBuilderInputDisabled(false);
  input.focus();
}

// Strip [CHARACTER_READY]...[/CHARACTER_READY] from display text
function cleanBuilderReply(text) {
  return text.replace(/\[CHARACTER_READY\][\s\S]*?\[\/CHARACTER_READY\]/g, '').trim();
}

function extractCharReady(text) {
  const match = text.match(/\[CHARACTER_READY\]([\s\S]*?)\[\/CHARACTER_READY\]/);
  if (!match) return null;
  try {
    let jsonStr = match[1].trim();
    const codeMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeMatch) jsonStr = codeMatch[1];
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

function handleCharacterReady(reply) {
  const charData = extractCharReady(reply);
  if (!charData) return;
  builderCharData = charData;

  // Attach a "생성하기" CTA to the last assistant message
  const msgs = document.querySelectorAll('#builder-messages .msg.assistant');
  const lastMsg = msgs[msgs.length - 1];
  if (lastMsg) {
    const btn = document.createElement('button');
    btn.className = 'btn-builder-generate';
    btn.textContent = '✦ 캐릭터 생성하기';
    btn.onclick = startGenerating;
    lastMsg.querySelector('.msg-inner')?.appendChild(btn);
  }
}

async function startGenerating() {
  if (!builderCharData) return;

  showScreen('screen-builder-loading');

  // Animate progress bar up to ~85% while request is pending
  const bar = document.getElementById('builder-progress-bar');
  bar.style.width = '0%';
  bar.style.transition = 'width 0.4s ease';
  let progress = 0;
  const interval = setInterval(() => {
    progress = Math.min(progress + (Math.random() * 12 + 4), 85);
    bar.style.width = progress + '%';
  }, 500);

  try {
    const res  = await fetch('/api/builder/generate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ characterData: builderCharData }),
    });
    const data = await res.json();

    clearInterval(interval);
    bar.style.transition = 'width 0.3s ease';
    bar.style.width = '100%';

    if (data.error) {
      setTimeout(() => {
        showScreen('screen-builder-chat');
        showToast('생성에 실패했습니다. 다시 시도해주세요.');
      }, 400);
      return;
    }

    builderSystemMd = data.systemPrompt;
    setTimeout(showBuilderEdit, 500);
  } catch (_) {
    clearInterval(interval);
    showScreen('screen-builder-chat');
    showToast('생성에 실패했습니다. 다시 시도해주세요.');
  }
}

function showBuilderEdit() {
  builderAvatarUpload?.reset();
  const d = builderCharData || {};
  document.getElementById('be-name').value          = d.name        || '';
  document.getElementById('be-age').value           = d.age         || '';
  document.getElementById('be-occupation').value    = d.occupation  || '';
  document.getElementById('be-subtitle').value      = d.subtitle    || '';
  document.getElementById('be-appearance').value    = d.appearance  || '';
  document.getElementById('be-personality').value   = d.personality || '';
  document.getElementById('be-speechStyle').value   = d.speechStyle || '';
  document.getElementById('be-speechExamples').value =
    Array.isArray(d.speechExamples) ? d.speechExamples.join('\n') : '';
  document.getElementById('be-systemPrompt').value  = builderSystemMd || '';

  // Rating
  const savedRating = d.rating || (d.hasProfanity ? 'adult_only' : 'all_ages');
  selectBuilderRating(savedRating);

  // Tags
  _builderTags = Array.isArray(d.tags) ? [...d.tags] : [];
  _renderBuilderTags();
  _initTagInput();

  navigateTo('/builder/preview');
}

async function registerCharacter() {
  const name = document.getElementById('be-name').value.trim();
  if (!name) { showToast('이름을 입력해주세요.'); return; }

  const updatedData = {
    ...(builderCharData || {}),
    name,
    age:           parseInt(document.getElementById('be-age').value) || (builderCharData?.age),
    occupation:    document.getElementById('be-occupation').value.trim(),
    subtitle:      document.getElementById('be-subtitle').value.trim(),
    appearance:    document.getElementById('be-appearance').value.trim(),
    personality:   document.getElementById('be-personality').value.trim(),
    speechStyle:   document.getElementById('be-speechStyle').value.trim(),
    speechExamples: document.getElementById('be-speechExamples').value
      .split('\n').map(l => l.trim()).filter(Boolean),
    rating:        _builderRating,
    hasProfanity:  _builderRating === 'adult_only',
    tags:          [..._builderTags],
  };

  const systemPrompt = document.getElementById('be-systemPrompt').value.trim();

  try {
    const res  = await fetch('/api/characters/create', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        characterData: updatedData,
        systemPrompt,
        imageData: builderAvatarUpload?.getUrl() || null,
      }),
    });
    const data = await res.json();

    if (data.error) {
      console.error('Register error from server:', data.error);
      showToast('등록에 실패했습니다: ' + data.error);
      return;
    }

    showToast('캐릭터가 등록되었습니다!');
    await loadCharacters();
    navigateTo('/');
  } catch (err) {
    console.error('Register fetch error:', err);
    showToast('등록에 실패했습니다.');
  }
}

async function rebuildCharacter() {
  if (!builderCharData) return;
  // Sync any edits back to builderCharData before regenerating
  builderCharData = {
    ...(builderCharData || {}),
    name:          document.getElementById('be-name').value.trim(),
    age:           parseInt(document.getElementById('be-age').value) || builderCharData?.age,
    occupation:    document.getElementById('be-occupation').value.trim(),
    subtitle:      document.getElementById('be-subtitle').value.trim(),
    appearance:    document.getElementById('be-appearance').value.trim(),
    personality:   document.getElementById('be-personality').value.trim(),
    speechStyle:   document.getElementById('be-speechStyle').value.trim(),
    speechExamples: document.getElementById('be-speechExamples').value
      .split('\n').map(l => l.trim()).filter(Boolean),
    rating:        _builderRating,
    hasProfanity:  _builderRating === 'adult_only',
  };
  await startGenerating();
}

// ─── Builder DOM Helpers ──────────────────────────────────
function appendBuilderMessage(role, text) {
  const container = document.getElementById('builder-messages');
  const wrap = document.createElement('div');
  wrap.className = 'msg ' + role;

  if (role === 'assistant') {
    const avatar = document.createElement('div');
    avatar.className = 'builder-avatar';
    avatar.textContent = '✦';
    wrap.appendChild(avatar);

    const inner = document.createElement('div');
    inner.className = 'msg-inner';

    const name = document.createElement('div');
    name.className   = 'msg-sender';
    name.textContent = 'Folio Builder';

    const bubble = document.createElement('div');
    bubble.className   = 'msg-bubble';
    bubble.textContent = cleanBuilderReply(text);

    inner.appendChild(name);
    inner.appendChild(bubble);
    wrap.appendChild(inner);
  } else {
    const inner = document.createElement('div');
    inner.className = 'msg-inner-user';

    const name = document.createElement('div');
    name.className   = 'msg-sender';
    name.textContent = '나';

    const bubble = document.createElement('div');
    bubble.className   = 'msg-bubble';
    bubble.textContent = text;

    inner.appendChild(name);
    inner.appendChild(bubble);
    wrap.appendChild(inner);
  }

  container.appendChild(wrap);
  container.scrollTop = container.scrollHeight;
  return wrap;
}

function appendBuilderTyping() {
  const container = document.getElementById('builder-messages');
  const wrap = document.createElement('div');
  wrap.className = 'msg assistant';

  const avatar = document.createElement('div');
  avatar.className = 'builder-avatar';
  avatar.textContent = '✦';

  const inner = document.createElement('div');
  inner.className = 'msg-inner';

  const name = document.createElement('div');
  name.className   = 'msg-sender';
  name.textContent = 'Folio Builder';

  const bubble = document.createElement('div');
  bubble.className = 'typing-bubble';
  bubble.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';

  inner.appendChild(name);
  inner.appendChild(bubble);
  wrap.appendChild(avatar);
  wrap.appendChild(inner);
  container.appendChild(wrap);
  container.scrollTop = container.scrollHeight;
  return wrap;
}

function setBuilderInputDisabled(disabled) {
  document.getElementById('builder-input').disabled    = disabled;
  document.getElementById('builder-btn-send').disabled = disabled;
}

// ═══════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════
let _currentUser = null;

async function initAuth() {
  try {
    const res  = await fetch('/api/auth/me');
    const data = await res.json();
    _currentUser = data.user || null;
    updateAuthUI();
    updateAdultToggleUI();
    if (_currentUser) loadBookmarks();
  } catch (_) {}
}

// ── Adult Content System ───────────────────────────────────
// OFF→ON 시도: 비로그인이면 auth gate, 인증 안 됐으면 verify modal
async function setAdultToggle(enable) {
  if (!enable) {
    // OFF: 인증 불필요, 즉시 저장
    if (_currentUser) {
      const res  = await fetch('/api/auth/adult-content', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: false }),
      });
      if (res.ok) {
        const data = await res.json();
        _currentUser = data.user;
      }
    }
    updateAdultToggleUI();
    await loadCharacters();
    return;
  }

  // ON: 로그인 필요
  if (!_currentUser) {
    showAuthGate('성인 콘텐츠', '성인 콘텐츠를 이용하려면 로그인이 필요합니다.', window.location.pathname);
    return;
  }

  // 이미 인증됐으면 바로 ON
  if (_currentUser.adult_verified) {
    const res  = await fetch('/api/auth/adult-content', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    });
    if (res.ok) {
      const data = await res.json();
      _currentUser = data.user;
      updateAdultToggleUI();
      await loadCharacters();
    }
    return;
  }

  // 첫 인증: verify modal
  openAdultVerify();
}

function openAdultVerify() {
  const overlay = document.getElementById('adult-verify-overlay');
  const check   = document.getElementById('adult-verify-check');
  const confirm = document.getElementById('adult-verify-confirm');
  if (check)   check.checked    = false;
  if (confirm) confirm.disabled = true;
  overlay?.classList.add('open');
}

function closeAdultVerify(e) {
  if (e && e.target !== document.getElementById('adult-verify-overlay')) return;
  // 취소 시 토글 원복
  updateAdultToggleUI();
  document.getElementById('adult-verify-overlay')?.classList.remove('open');
}

async function confirmAdultVerify() {
  if (!document.getElementById('adult-verify-check')?.checked) return;
  try {
    const res  = await fetch('/api/auth/adult-verify', { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('adult-verify failed:', res.status, err);
      showToast(err.error || '인증에 실패했습니다.');
      return;
    }
    const data = await res.json();
    _currentUser = data.user;
    document.getElementById('adult-verify-overlay')?.classList.remove('open');
    updateAdultToggleUI();
    await loadCharacters();
    showToast('성인 콘텐츠가 활성화되었습니다.');
  } catch (e) {
    console.error('confirmAdultVerify error:', e);
    showToast('인증에 실패했습니다.');
  }
}

function updateAdultToggleUI() {
  const enabled = !!_currentUser?.adult_content_enabled;

  // 메인 화면 세그먼트
  document.getElementById('adult-seg-all')?.classList.toggle('active', !enabled);
  document.getElementById('adult-seg-18')?.classList.toggle('active',  enabled);

  // 마이페이지 토글
  const mpToggle = document.getElementById('adult-mypage-toggle');
  if (mpToggle) mpToggle.checked = enabled;
  const mpSub = document.getElementById('adult-mypage-sub');
  if (mpSub) {
    if (!_currentUser) {
      mpSub.textContent = '로그인 후 이용 가능';
    } else if (!_currentUser.adult_verified) {
      mpSub.textContent = '성인 인증 후 이용 가능';
    } else {
      mpSub.textContent = enabled ? '현재 성인 콘텐츠 표시 중' : '현재 전연령 콘텐츠만 표시';
    }
  }
}

async function onMypageAdultToggle(el) {
  const prev = !el.checked;  // revert optimistically
  el.checked = prev;          // reset until confirmed
  await setAdultToggle(!prev);
}

// ── Bookmarks ─────────────────────────────────────────────
let _bookmarkedIds = new Set();

async function loadBookmarks() {
  try {
    const res = await fetch('/api/bookmarks');
    if (!res.ok) return;
    const ids = await res.json();
    _bookmarkedIds = new Set(ids);
    updateBookmarkBtn();
  } catch (_) {}
}

function updateBookmarkBtn() {
  const btn  = document.getElementById('btn-bookmark');
  const icon = document.getElementById('bookmark-icon');
  if (!btn || !currentCharacter) return;

  if (!_currentUser) { btn.style.display = 'none'; return; }

  btn.style.display = '';
  const active = _bookmarkedIds.has(currentCharacter.id);
  icon.setAttribute('fill', active ? 'currentColor' : 'none');
  btn.classList.toggle('active', active);
}

async function toggleBookmark() {
  if (!_currentUser) { showToast('로그인이 필요합니다.'); return; }
  if (!currentCharacter) return;
  const id = currentCharacter.id;
  const isBookmarked = _bookmarkedIds.has(id);
  const method = isBookmarked ? 'DELETE' : 'POST';
  try {
    await fetch(`/api/bookmarks/${id}`, { method });
    if (isBookmarked) _bookmarkedIds.delete(id);
    else              _bookmarkedIds.add(id);
    updateBookmarkBtn();
    showToast(isBookmarked ? '책갈피를 해제했습니다.' : '책갈피에 추가했습니다.');
  } catch (_) { showToast('오류가 발생했습니다.'); }
}

function updateAuthUI() {
  // Nav tab label stays fixed as "마이페이지"
}

function updateNavActiveTab(screenId) {
  const map = {
    'screen-landing':  '캐릭터',
    'screen-explore':  '탐색',
    'screen-history':  '대화',
    'screen-mypage':   '마이페이지',
  };
  const label = map[screenId];
  document.querySelectorAll('.nav-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.label === label);
  });
}

// ── Auth gate modal ───────────────────────────────────────
let _authGateIntendedPath = null;

function showAuthGate(title = '로그인이 필요한 기능입니다', desc = '이 기능을 이용하려면 로그인해주세요.', intendedPath = null) {
  document.getElementById('auth-gate-title').textContent = title;
  document.getElementById('auth-gate-desc').textContent  = desc;
  document.getElementById('auth-gate-overlay').classList.add('open');
  _authGateIntendedPath = intendedPath;
}
function closeAuthGate(e) {
  if (e && e.target !== document.getElementById('auth-gate-overlay')) return;
  document.getElementById('auth-gate-overlay').classList.remove('open');
  if (_authGateIntendedPath) {
    _authGateIntendedPath = null;
    navigateTo('/');
  }
}

// ── Login / Register screens ──────────────────────────────
function showAuthView(view) {
  document.getElementById('auth-login-view').style.display    = view === 'login'    ? '' : 'none';
  document.getElementById('auth-register-view').style.display = view === 'register' ? '' : 'none';
  document.getElementById('auth-forgot-view').style.display   = view === 'forgot'   ? '' : 'none';
  const labels = { login: '로그인', register: '회원가입', forgot: '비밀번호 찾기' };
  document.getElementById('auth-nav-label').textContent = labels[view] || '로그인';
  if (view === 'forgot') {
    document.getElementById('forgot-form').reset();
    const errEl = document.getElementById('forgot-global-err');
    errEl.textContent = '';
    errEl.style.color = '';
  }
}

// Inline validation
const VALIDATORS = {
  email:    { re: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, msg: '이메일 형식이 올바르지 않습니다' },
  password: { re: /^(?=.*[a-zA-Z])(?=.*\d).{8,}$/, msg: '비밀번호는 8자 이상, 영문과 숫자를 포함해야 합니다' },
  nickname: { re: /^[^\s!@#$%^&*()+=[^\]{};':"\\|,.<>/?`~]{2,12}$/, msg: '닉네임은 2~12자, 특수문자 없이 입력해주세요' },
};
function validateField(inputId, errId, type) {
  const val = document.getElementById(inputId).value;
  const v   = VALIDATORS[type];
  const err = v.re.test(val) ? '' : v.msg;
  document.getElementById(errId).textContent = err;
  return !err;
}

async function submitForgotPassword(e) {
  e.preventDefault();
  const email = document.getElementById('forgot-email').value.trim();
  const errEl = document.getElementById('forgot-global-err');
  errEl.textContent = '';

  try {
    const res  = await fetch('/api/auth/forgot-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error; return; }

    if (data._demo_token) {
      navigateTo(`/reset-password?token=${data._demo_token}`);
    } else {
      // 가입되지 않은 이메일 — 안내만 표시
      errEl.style.color = 'var(--text-muted)';
      errEl.textContent = '해당 이메일로 가입된 계정이 없습니다.';
    }
  } catch {
    errEl.textContent = '오류가 발생했습니다. 다시 시도해주세요.';
  }
}

async function submitResetPassword(e) {
  e.preventDefault();
  const pw        = document.getElementById('reset-pw-input').value;
  const pwConfirm = document.getElementById('reset-pw-confirm').value;
  const errEl     = document.getElementById('reset-pw-global-err');
  const confirmEl = document.getElementById('reset-pw-confirm-err');
  errEl.textContent     = '';
  confirmEl.textContent = '';

  if (!validateField('reset-pw-input', 'reset-pw-err', 'password')) return;
  if (pw !== pwConfirm) {
    confirmEl.textContent = '비밀번호가 일치하지 않습니다';
    return;
  }

  const token = new URLSearchParams(window.location.search).get('token');
  try {
    const res  = await fetch('/api/auth/reset-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password: pw }),
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error; return; }

    document.getElementById('reset-pw-form-view').style.display = 'none';
    document.getElementById('reset-pw-done-view').style.display = '';
  } catch {
    errEl.textContent = '오류가 발생했습니다. 다시 시도해주세요.';
  }
}

async function submitLogin(e) {
  e.preventDefault();
  const identifier = document.getElementById('login-identifier').value.trim();
  const pw         = document.getElementById('login-pw').value;
  document.getElementById('login-global-err').textContent = '';

  if (!identifier) {
    document.getElementById('login-global-err').textContent = '이메일 또는 @아이디를 입력해주세요';
    return;
  }

  try {
    const res  = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password: pw }),
    });
    const data = await res.json();
    if (!res.ok) { document.getElementById('login-global-err').textContent = data.error; return; }
    _currentUser = data.user;
    updateAuthUI();
    const dest = _authGateIntendedPath || '/';
    _authGateIntendedPath = null;
    navigateTo(dest);
  } catch (_) {
    document.getElementById('login-global-err').textContent = '로그인에 실패했습니다.';
  }
}

// ── Username availability check (debounced) ───────────────
let _usernameDebounce = null;
let _usernameValid = false;

function onUsernameInput(input) {
  const val = input.value.trim().toLowerCase();
  const statusEl = document.getElementById('reg-username-status');
  _usernameValid = false;

  // Clear debounce
  clearTimeout(_usernameDebounce);

  if (!val) { statusEl.textContent = ''; statusEl.className = 'field-feedback'; return; }

  // Local format check
  if (!/^[a-z0-9_]{3,20}$/.test(val)) {
    statusEl.textContent = '영문 소문자/숫자/언더바 3~20자';
    statusEl.className = 'field-feedback error';
    return;
  }

  statusEl.textContent = '확인 중...';
  statusEl.className = 'field-feedback checking';

  _usernameDebounce = setTimeout(async () => {
    try {
      const res  = await fetch(`/api/auth/check-username?username=${encodeURIComponent(val)}`);
      const data = await res.json();
      if (data.available) {
        statusEl.textContent = '사용 가능한 아이디입니다';
        statusEl.className = 'field-feedback ok';
        _usernameValid = true;
      } else {
        statusEl.textContent = data.error || '이미 사용 중인 아이디입니다';
        statusEl.className = 'field-feedback error';
        _usernameValid = false;
      }
    } catch (_) {
      statusEl.textContent = '';
      statusEl.className = 'field-feedback';
    }
  }, 400);
}

async function submitRegister(e) {
  e.preventDefault();
  const emailOk = validateField('reg-email', 'reg-email-err', 'email');
  const pwOk    = validateField('reg-pw',    'reg-pw-err',    'password');
  const nickOk  = validateField('reg-nick',  'reg-nick-err',  'nickname');
  if (!emailOk || !pwOk || !nickOk) return;

  const username = document.getElementById('reg-username').value.trim().toLowerCase();
  const statusEl = document.getElementById('reg-username-status');
  if (!username) {
    statusEl.textContent = '@아이디를 입력해주세요';
    statusEl.className = 'field-feedback error';
    return;
  }
  if (!_usernameValid) {
    statusEl.textContent = statusEl.textContent || '아이디를 확인해주세요';
    statusEl.className = 'field-feedback error';
    return;
  }

  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-pw').value;
  const nickname = document.getElementById('reg-nick').value.trim();
  document.getElementById('reg-global-err').textContent = '';

  try {
    const res  = await fetch('/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, nickname, username }),
    });
    const data = await res.json();
    if (!res.ok) { document.getElementById('reg-global-err').textContent = data.error; return; }
    _currentUser = data.user;
    updateAuthUI();
    const dest = _authGateIntendedPath || '/';
    _authGateIntendedPath = null;
    navigateTo(dest);
  } catch (_) {
    document.getElementById('reg-global-err').textContent = '회원가입에 실패했습니다.';
  }
}

async function logoutUser() {
  await fetch('/api/auth/logout', { method: 'POST' });
  _currentUser = null;
  updateAuthUI();
  navigateTo('/');
}

// ═══════════════════════════════════════════════════════════
// MYPAGE
// ═══════════════════════════════════════════════════════════
async function loadMypage() {
  if (!_currentUser) return;
  document.getElementById('mypage-nickname').textContent = _currentUser.nickname;

  const usernameEl = document.getElementById('mypage-username');
  if (usernameEl) {
    if (_currentUser.username) {
      usernameEl.textContent = '@' + _currentUser.username;
      usernameEl.style.display = '';
    } else {
      usernameEl.textContent = '';
      usernameEl.style.display = 'none';
    }
  }

  document.getElementById('mypage-email').textContent         = _currentUser.email;
  document.getElementById('mypage-avatar-letter').textContent = _currentUser.nickname[0].toUpperCase();

  const creatorBtn = document.getElementById('btn-creator-profile');
  if (creatorBtn) creatorBtn.style.display = _currentUser.username ? '' : 'none';

  const img     = document.getElementById('mypage-avatar-img');
  const letterW = document.getElementById('mypage-avatar-letter-wrap');
  if (_currentUser.avatar) {
    img.src            = _currentUser.avatar + '?t=' + Date.now();
    img.style.display  = 'block';
    letterW.style.display = 'none';
  } else {
    img.style.display  = 'none';
    letterW.style.display = 'flex';
  }
  updateAdultToggleUI();
  switchMypageTab('persona');
  loadMypagePersonas();
  loadMypageChars();
  loadMypageBookmarks();
}

function triggerAvatarUpload() {
  document.getElementById('mypage-avatar-input').click();
}

async function handleAvatarChange(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (ev) => {
    const avatarData = ev.target.result;
    const res  = await fetch('/api/auth/me', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatarData }),
    });
    const data = await res.json();
    if (res.ok) { _currentUser = data.user; loadMypage(); }
    else showToast('사진 업로드에 실패했습니다.');
  };
  reader.readAsDataURL(file);
  input.value = '';
}

// ── Tab switching ─────────────────────────────────────────
let _mypageActiveTab = 'persona';
const _MYPAGE_TABS = ['persona', 'chars', 'bookmark'];

function switchMypageTab(tab) {
  _mypageActiveTab = tab;
  const idx = _MYPAGE_TABS.indexOf(tab);
  _MYPAGE_TABS.forEach(t => {
    document.getElementById(`mypage-tab-${t}`)?.classList.toggle('active', t === tab);
    document.getElementById(`mypage-panel-${t}`)?.classList.toggle('active', t === tab);
  });
  const indicator = document.getElementById('mypage-tab-indicator');
  if (indicator) indicator.style.left = `${idx * 33.333}%`;
}

// ── Personas ─────────────────────────────────────────────
async function loadMypagePersonas() {
  const list = document.getElementById('mypage-personas-list');
  try {
    const res  = await fetch('/api/personas');
    const rows = await res.json();
    const deleteAllBtn = document.getElementById('btn-delete-all-personas');
    if (!rows.length) {
      if (deleteAllBtn) deleteAllBtn.style.display = 'none';
      list.innerHTML = '<p class="mypage-empty" style="padding:32px 0;text-align:center;">저장된 페르소나가 없습니다.</p>';
      return;
    }
    if (deleteAllBtn) deleteAllBtn.style.display = '';
    const defaultId = _currentUser?.default_persona_id;
    list.innerHTML = rows.map(p => {
      const d = p.data;
      const isDefault = p.id === defaultId;
      const initial = (d.name || '?')[0].toUpperCase();
      const meta = [d.age ? d.age + '세' : '', d.gender === 'male' ? '남' : d.gender === 'female' ? '여' : ''].filter(Boolean).join(' · ');
      const hasImg = !!d.avatar;
      return `
        <div class="mypage-p-card${isDefault ? ' is-default' : ''}${hasImg ? ' has-image' : ''}" onclick="openPersonaDetail(${p.id})">
          ${hasImg
            ? `<img class="mypage-p-img" src="${d.avatar}" alt="${d.name || ''}">`
            : `<div class="mypage-p-no-img">
                 <div class="mypage-p-add-icon">
                   <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                 </div>
               </div>`}
          <div class="mypage-p-overlay">
            <div class="mypage-p-name">${d.name || '이름 없음'}${isDefault ? ' <span class="default-badge">기본</span>' : ''}</div>
            ${meta ? `<div class="mypage-p-meta">${meta}</div>` : ''}
            <div class="mypage-p-actions">
              ${!isDefault ? `<button class="mypage-card-action-btn" onclick="event.stopPropagation();setDefaultPersona(${p.id})">기본 설정</button>` : ''}
              <button class="mypage-card-action-btn danger" onclick="event.stopPropagation();deletePersona(${p.id})">삭제</button>
            </div>
          </div>
        </div>`;
    }).join('');
  } catch (_) {
    list.innerHTML = '<p class="mypage-empty" style="padding:32px 0;text-align:center;">불러오기 실패</p>';
  }
}

function openPersonaDetail(id) {
  navigateTo(`/persona/${id}`);
}

async function deleteAllPersonas() {
  if (!confirm('페르소나를 전부 삭제하시겠습니까?')) return;
  try {
    const res  = await fetch('/api/personas');
    const rows = await res.json();
    await Promise.all(rows.map(p => fetch(`/api/personas/${p.id}`, { method: 'DELETE' })));
    const me = await (await fetch('/api/auth/me')).json();
    _currentUser = me.user;
    loadMypagePersonas();
    showToast('전체 삭제되었습니다.');
  } catch (_) { showToast('삭제에 실패했습니다.'); }
}

function newPersonaFromMypage() {
  navigateTo('/persona/new');
}

async function setDefaultPersona(id) {
  await fetch(`/api/personas/${id}/set-default`, { method: 'PATCH' });
  const res  = await fetch('/api/auth/me');
  const data = await res.json();
  _currentUser = data.user;
  loadMypagePersonas();
}

async function clearDefaultPersona() {
  await fetch('/api/personas/default', { method: 'DELETE' });
  const res  = await fetch('/api/auth/me');
  const data = await res.json();
  _currentUser = data.user;
  // 현재 페이지 액션 버튼만 갱신
  if (_pdPersonaId) {
    const rows = await (await fetch('/api/personas')).json();
    const p = rows.find(r => r.id === _pdPersonaId);
    if (p) _populatePersonaDetail(p);
  }
}

async function onPdImgSelected(input) {
  const file = input.files?.[0];
  if (!file || !_pdPersonaId) return;
  input.value = '';  // 같은 파일 재선택 허용

  const reader = new FileReader();
  reader.onload = async (e) => {
    const avatar = e.target.result;  // base64 dataURL

    // 현재 persona data 가져와서 avatar 업데이트
    try {
      const rows = await (await fetch('/api/personas')).json();
      const p    = rows.find(r => r.id === _pdPersonaId);
      if (!p) return;

      const newData = { ...p.data, avatar };
      await fetch(`/api/personas/${_pdPersonaId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ data: newData }),
      });

      // 카드 즉시 갱신
      _populatePersonaDetail({ ...p, data: newData });
      showToast('이미지가 등록되었습니다.');
    } catch (_) {
      showToast('이미지 등록에 실패했습니다.');
    }
  };
  reader.readAsDataURL(file);
}

async function deletePersona(id) {
  if (!confirm('이 페르소나를 삭제하시겠습니까?')) return;
  await fetch(`/api/personas/${id}`, { method: 'DELETE' });
  const res  = await fetch('/api/auth/me');
  const data = await res.json();
  _currentUser = data.user;
  loadMypagePersonas();
}

// ── My characters ─────────────────────────────────────────
function loadMypageChars() {
  const list = document.getElementById('mypage-chars-list');
  const mine = characters.filter(c => c.id.startsWith('char_'));
  if (!mine.length) {
    list.innerHTML = '<p class="mypage-empty" style="padding:32px 0;text-align:center;">제작한 캐릭터가 없습니다.</p>';
    return;
  }
  list.innerHTML = mine.map(c => `
    <div class="mypage-char-card-wrap">
      <div class="char-card" onclick="navigateTo('/character/${c.id}')">
        ${c.image ? `<img class="char-card-img" src="${c.image}" alt="">` : '<div class="char-card-img char-card-img-empty">✦</div>'}
        <div class="char-card-overlay">
          <div class="char-card-name">${c.name}</div>
          ${c.role ? `<div class="char-card-role">${c.role}</div>` : ''}
        </div>
      </div>
      <div class="mypage-char-card-actions">
        <button class="mypage-card-action-btn" onclick="event.stopPropagation();editMypageChar('${c.id}')">편집</button>
        <button class="mypage-card-action-btn danger" onclick="event.stopPropagation();deleteMypageChar('${c.id}')">삭제</button>
      </div>
    </div>`).join('');
}

// ── Bookmarked characters ─────────────────────────────────
async function loadMypageBookmarks() {
  const panel = document.getElementById('mypage-panel-bookmark');
  if (!panel) return;
  try {
    const res = await fetch('/api/bookmarks');
    if (!res.ok) throw new Error();
    const ids = await res.json();
    if (!ids.length) {
      panel.innerHTML = '<p class="mypage-empty" style="padding:48px 0;text-align:center;">아직 책갈피한 캐릭터가 없습니다.</p>';
      return;
    }
    const bookmarked = ids.map(id => characters.find(c => c.id === id)).filter(Boolean);
    if (!bookmarked.length) {
      panel.innerHTML = '<p class="mypage-empty" style="padding:48px 0;text-align:center;">아직 책갈피한 캐릭터가 없습니다.</p>';
      return;
    }
    panel.innerHTML = `<div class="mypage-card-grid">${bookmarked.map(c => `
      <div class="char-card" onclick="navigateTo('/character/${c.id}')">
        ${c.image ? `<img class="char-card-img" src="${c.image}" alt="">` : '<div class="char-card-img char-card-img-empty">✦</div>'}
        <div class="char-card-overlay">
          <div class="char-card-name">${c.name}</div>
          ${c.role ? `<div class="char-card-role">${c.role}</div>` : ''}
        </div>
      </div>`).join('')}</div>`;
  } catch (_) {}
}

async function editMypageChar(id) {
  try {
    const [cfgRes, sysRes] = await Promise.all([
      fetch(`/api/characters/${id}`),
      fetch(`/api/characters/${id}/system`),
    ]);
    const cfg = await cfgRes.json();
    const sys = await sysRes.json();
    const bd  = cfg._builderData || {};

    builderCharData = {
      name:          cfg.name,
      age:           parseInt(cfg.profile?.['나이']) || '',
      occupation:    cfg.role || '',
      subtitle:      cfg.subtitle || '',
      hasProfanity:  cfg.defaultSafety === 'off',
      tags:          Array.isArray(cfg.tags) ? cfg.tags : [],
      appearance:    bd.appearance    || '',
      personality:   bd.personality   || '',
      speechStyle:   bd.speechStyle   || '',
      speechExamples: bd.speechExamples || [],
      background:    bd.background    || '',
      relationship:  bd.relationship  || '',
      boundaries:    bd.boundaries    || '',
    };
    builderSystemMd     = sys.systemPrompt || '';
    builderEditTargetId = id;

    showBuilderEdit();
  } catch (_) { showToast('불러오기에 실패했습니다.'); }
}

let builderEditTargetId = null;

async function deleteMypageChar(id) {
  if (!confirm('이 캐릭터를 삭제하시겠습니까?')) return;
  try {
    await fetch(`/api/characters/${id}`, { method: 'DELETE' });
    await loadCharacters();
    loadMypageChars();
    showToast('캐릭터가 삭제되었습니다.');
  } catch (_) { showToast('삭제에 실패했습니다.'); }
}

// ── Mypage settings modal ─────────────────────────────────
function openMypageModal(type) {
  const overlay = document.getElementById('mypage-modal-overlay');
  const body    = document.getElementById('mypage-modal-body');

  const inputStyle = 'padding:10px 12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-btn);color:var(--text);font-size:14px;font-family:var(--font);width:100%;box-sizing:border-box;';

  if (type === 'info') {
    const atWrapStyle = `display:flex;align-items:center;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-btn);overflow:hidden;`;
    const atPrefixStyle = `padding:0 10px;font-size:15px;font-weight:600;color:#A8B5C8;background:var(--surface);border-right:1px solid var(--border);height:40px;display:flex;align-items:center;flex-shrink:0;`;
    const atInputStyle = `flex:1;border:none;background:transparent;padding:10px 12px;font-size:14px;font-family:var(--font);color:var(--text);outline:none;`;

    body.innerHTML = `
      <p class="delete-modal-title" style="margin-bottom:16px;">내 정보 수정</p>

      <div style="display:flex;flex-direction:column;gap:14px;">
        <div class="form-group">
          <label style="font-size:12px;color:var(--text-muted);">닉네임</label>
          <input type="text" id="modal-nickname" value="${_currentUser.nickname}" placeholder="2~12자"
            style="${inputStyle}" oninput="validateField('modal-nickname','modal-nick-err','nickname')" />
          <p class="field-error" id="modal-nick-err"></p>
        </div>
        <div class="form-group">
          <label style="font-size:12px;color:var(--text-muted);">@아이디</label>
          <div style="${atWrapStyle}">
            <span style="${atPrefixStyle}">@</span>
            <input type="text" id="modal-username" value="${_currentUser.username || ''}" placeholder="my_username"
              style="${atInputStyle}" oninput="onModalUsernameInput(this)" />
          </div>
          <p class="field-feedback" id="modal-username-status" style="font-size:12px;margin-top:4px;"></p>
        </div>
        <div class="form-group">
          <label style="font-size:12px;color:var(--text-muted);">이메일</label>
          <input type="email" id="modal-email" value="${_currentUser.email}"
            style="${inputStyle}" oninput="validateField('modal-email','modal-email-err','email')" />
          <p class="field-error" id="modal-email-err"></p>
        </div>
        <hr style="border:none;border-top:1px solid var(--border);margin:2px 0;">
        <div class="form-group">
          <label style="font-size:12px;color:var(--text-muted);">현재 비밀번호</label>
          <input type="password" id="modal-cur-pw" placeholder="비밀번호 변경 시 입력" style="${inputStyle}" />
        </div>
        <div class="form-group">
          <label style="font-size:12px;color:var(--text-muted);">새 비밀번호</label>
          <input type="password" id="modal-new-pw" placeholder="영문+숫자 8자 이상 (변경 시에만)"
            style="${inputStyle}" oninput="validateField('modal-new-pw','modal-pw-err','password')" />
          <p class="field-error" id="modal-pw-err"></p>
        </div>
        <p class="field-error" id="modal-info-global-err"></p>
      </div>
      <div class="delete-modal-actions" style="margin-top:20px;">
        <button class="btn-ghost" onclick="closeMypageModal()">취소</button>
        <button class="btn-primary" style="flex:1;" onclick="saveInfo()">저장</button>
      </div>`;
  }
  overlay.classList.add('open');
}
function closeMypageModal(e) {
  if (e && e.target !== document.getElementById('mypage-modal-overlay')) return;
  document.getElementById('mypage-modal-overlay').classList.remove('open');
}

let _modalUsernameDebounce = null;
let _modalUsernameValid = true; // true if unchanged from current value

function onModalUsernameInput(input) {
  const val = input.value.trim().toLowerCase();
  const statusEl = document.getElementById('modal-username-status');

  clearTimeout(_modalUsernameDebounce);

  // Same as current username → always valid
  if (val === (_currentUser?.username || '')) {
    statusEl.textContent = '';
    statusEl.className = 'field-feedback';
    _modalUsernameValid = true;
    return;
  }

  _modalUsernameValid = false;

  if (!val) {
    statusEl.textContent = '';
    statusEl.className = 'field-feedback';
    _modalUsernameValid = false;
    return;
  }

  if (!/^[a-z0-9_]{3,20}$/.test(val)) {
    statusEl.textContent = '영문 소문자/숫자/언더바 3~20자';
    statusEl.className = 'field-feedback error';
    return;
  }

  statusEl.textContent = '확인 중...';
  statusEl.className = 'field-feedback checking';

  _modalUsernameDebounce = setTimeout(async () => {
    try {
      const res  = await fetch(`/api/auth/check-username?username=${encodeURIComponent(val)}`);
      const data = await res.json();
      if (data.available) {
        statusEl.textContent = '사용 가능한 아이디입니다';
        statusEl.className = 'field-feedback ok';
        _modalUsernameValid = true;
      } else {
        statusEl.textContent = data.error || '이미 사용 중인 아이디입니다';
        statusEl.className = 'field-feedback error';
        _modalUsernameValid = false;
      }
    } catch (_) {}
  }, 400);
}

async function saveInfo() {
  const nickOk  = validateField('modal-nickname', 'modal-nick-err',   'nickname');
  const emailOk = validateField('modal-email',    'modal-email-err',  'email');
  if (!nickOk || !emailOk) return;

  const nickname        = document.getElementById('modal-nickname').value.trim();
  const usernameInput   = document.getElementById('modal-username');
  const username        = usernameInput ? usernameInput.value.trim().toLowerCase() : null;
  const email           = document.getElementById('modal-email').value.trim();
  const currentPassword = document.getElementById('modal-cur-pw').value;
  const newPassword     = document.getElementById('modal-new-pw').value;
  const globalErr       = document.getElementById('modal-info-global-err');
  globalErr.textContent = '';

  // Validate username if changed
  if (username !== null && username !== (_currentUser?.username || '')) {
    if (!_modalUsernameValid) {
      const statusEl = document.getElementById('modal-username-status');
      if (statusEl) { statusEl.textContent = statusEl.textContent || '아이디를 확인해주세요'; statusEl.className = 'field-feedback error'; }
      return;
    }
  }

  if (newPassword) {
    if (!validateField('modal-new-pw', 'modal-pw-err', 'password')) return;
    if (!currentPassword) { globalErr.textContent = '현재 비밀번호를 입력해주세요'; return; }
  }

  const payload = { nickname, email };
  if (username !== null && username !== (_currentUser?.username || '')) payload.username = username;
  if (newPassword) { payload.currentPassword = currentPassword; payload.newPassword = newPassword; }

  const res  = await fetch('/api/auth/me', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) { globalErr.textContent = data.error; return; }
  _currentUser = data.user;
  loadMypage();
  closeMypageModal();
  showToast('정보가 저장되었습니다.');
}

// ── Delete account ────────────────────────────────────────
function startDeleteAccount() {
  document.getElementById('delete-account-overlay').classList.add('open');
}
function closeDeleteAccount(e) {
  if (e && e.target !== document.getElementById('delete-account-overlay')) return;
  document.getElementById('delete-account-overlay').classList.remove('open');
}
async function confirmDeleteAccount() {
  try {
    await fetch('/api/auth/me', { method: 'DELETE' });
    _currentUser = null;
    updateAuthUI();
    closeDeleteAccount();
    navigateTo('/');
    showToast('탈퇴가 완료되었습니다.');
  } catch (_) { showToast('오류가 발생했습니다.'); }
}
