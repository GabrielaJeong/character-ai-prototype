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

  // Mount chat input components
  createChatInput(document.getElementById('chat-input-container'),    { inputId: 'chat-input',    btnId: 'btn-send',         onSend: sendMessage  });
  createChatInput(document.getElementById('builder-input-container'), { inputId: 'builder-input', btnId: 'builder-btn-send', onSend: builderSend  });

  initModelPicker();
  initBuilderModelPicker();
  initNoticeCarousel();
  initAuth();
  loadCharacters();
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

function renderCharacterGrid(list) {
  const grid = document.getElementById('char-grid');
  grid.innerHTML = '';

  list.forEach(char => {
    const isComingSoon = char.status === 'coming_soon';
    const card = document.createElement('div');
    card.className = 'char-card' + (isComingSoon ? ' char-card-disabled' : '');
    if (!isComingSoon) card.onclick = () => selectCharacter(char.id);

    const imgHtml = char.image
      ? `<img src="${char.image}" alt="${char.name}" class="char-card-img" />`
      : `<div class="char-card-img-placeholder">${char.name[0]}</div>`;

    const visibleTags = Array.isArray(char.tags) ? char.tags.slice(0, 3) : [];
    const tagsHtml = visibleTags.length
      ? `<div class="char-card-tags">${visibleTags.map(t => `<span class="char-card-tag">#${t}</span>`).join('')}</div>`
      : '';

    card.innerHTML = `
      ${imgHtml}
      <div class="char-card-overlay">
        ${tagsHtml}
        <div class="char-card-name">${char.name}</div>
        <div class="char-card-role">${char.role || char.team}</div>
      </div>
      ${isComingSoon ? `
        <div class="char-card-coming-overlay"></div>
        <span class="char-card-soon-badge">Coming Soon</span>
      ` : ''}
    `;
    grid.appendChild(card);
  });
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

  // Persona subtitle hint
  document.getElementById('persona-subtitle').textContent =
    `${char.name}이(가) 당신을 알 수 있도록 정보를 입력해주세요.`;

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
  const canToggle     = char.safetyToggle !== false;
  const defaultSafety = char.defaultSafety === 'off' ? 'off' : 'on';
  currentSafety = defaultSafety;

  _safetySegment = createSafetySegment(
    document.getElementById('safety-segment-container'),
    {
      canToggle,
      defaultSafety,
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
  const noNavScreens = ['screen-chat', 'screen-builder-chat', 'screen-builder-loading', 'screen-login'];
  if (nav) nav.classList.toggle('hidden', noNavScreens.includes(id));
  updateNavActiveTab(id);
}

// ─── Router ───────────────────────────────────────────────
// Routes (evaluated top-to-bottom, first match wins):
//   /                          → landing
//   /history                   → session history list
//   /character/:id             → character intro
//   /character/:id/chat        → chat
//   /persona                   → persona setup (requires currentCharacter)
//   /persona/:id               → persona detail (auth required)
//   /builder                   → builder chat
//   /builder/preview           → builder edit/preview
//   /login                     → login / register
//   /mypage                    → mypage (auth required)
const ROUTES = [
  { pattern: /^\/character\/([^/]+)\/chat$/,    handler: (m) => _routeChat(m[1])           },
  { pattern: /^\/character\/([^/]+)$/,          handler: (m) => _routeIntro(m[1])          },
  { pattern: /^\/persona\/(\d+)$/,              handler: (m) => _routePersonaDetail(m[1])  },
  { pattern: /^\/explore$/,                     handler: ()  => _routeExplore()            },
  { pattern: /^\/history$/,                     handler: ()  => _routeGated('screen-history')      },
  { pattern: /^\/persona$/,                     handler: ()  => showScreen('screen-persona')       },
  { pattern: /^\/builder\/preview$/,            handler: ()  => _routeGated('screen-builder-edit') },
  { pattern: /^\/builder$/,                     handler: ()  => _routeGated('screen-builder-chat') },
  { pattern: /^\/login$/,                       handler: ()  => _routeLogin()                      },
  { pattern: /^\/mypage$/,                      handler: ()  => _routeMypage()                     },
  { pattern: /^\/$/,                            handler: ()  => showScreen('screen-landing')       },
];

function _routeExplore() {
  showScreen('screen-explore');
  loadExplore();
}

function _routeGated(screenId) {
  if (!_currentUser) {
    showAuthGate('로그인이 필요한 기능입니다', '이 기능을 이용하려면 로그인해주세요.', window.location.pathname);
    return;
  }
  showScreen(screenId);
}

function _routeLogin() {
  if (_currentUser) { navigateTo('/'); return; }
  showAuthView('login');
  showScreen('screen-login');
}

function _routeMypage() {
  if (!_currentUser) {
    showAuthGate('마이페이지', '마이페이지를 이용하려면 로그인이 필요합니다.', window.location.pathname);
    return;
  }
  loadMypage();
  showScreen('screen-mypage');
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

function _populatePersonaDetail(p) {
  const d         = p.data;
  const isDefault = p.id === _currentUser?.default_persona_id;
  const genderTxt = d.gender === 'male' ? '남성' : d.gender === 'female' ? '여성' : '';
  const metaParts = [d.age ? d.age + '세' : '', genderTxt].filter(Boolean);

  document.getElementById('pd-avatar-letter').textContent = (d.name || '?')[0].toUpperCase();
  document.getElementById('pd-name').textContent          = d.name || '이름 없음';
  document.getElementById('pd-meta').textContent          = metaParts.join(' · ');

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
      ? `<button class="btn-ghost" onclick="setDefaultPersona(${p.id});goBack('/mypage')">기본 설정</button>`
      : `<p class="pd-default-label">현재 기본 페르소나</p>`}
    <button class="btn-delete-confirm" onclick="deletePersona(${p.id});navigateTo('/mypage')">삭제</button>
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
  const pathname = path || window.location.pathname;
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
  results.forEach(char => {
    const isComingSoon = char.status === 'coming_soon';
    const card = document.createElement('div');
    card.className = 'char-card' + (isComingSoon ? ' char-card-disabled' : '');
    if (!isComingSoon) card.onclick = () => selectCharacter(char.id);

    const imgHtml = char.image
      ? `<img src="${char.image}" alt="${char.name}" class="char-card-img" />`
      : `<div class="char-card-img-placeholder">${char.name[0]}</div>`;

    const visibleTags = Array.isArray(char.tags) ? char.tags.slice(0, 3) : [];
    const tagsHtml = visibleTags.length
      ? `<div class="char-card-tags">${visibleTags.map(t => `<span class="char-card-tag">#${t}</span>`).join('')}</div>`
      : '';

    card.innerHTML = `
      ${imgHtml}
      <div class="char-card-overlay">
        ${tagsHtml}
        <div class="char-card-name">${char.name}</div>
        <div class="char-card-role">${char.role || char.team}</div>
      </div>
      ${isComingSoon ? `<div class="char-card-coming-overlay"></div><span class="char-card-soon-badge">Coming Soon</span>` : ''}
    `;
    grid.appendChild(card);
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
  const display = name.trim() || '{{user}}';
  const charName = currentCharacter?.name || '캐릭터';
  document.getElementById('p-notes').placeholder = `${charName}의 남자친구. 같은 팀. (${display} 기준)`;
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
function startChat(event) {
  event.preventDefault();

  if (!currentCharacter) {
    alert('캐릭터를 먼저 선택해주세요.');
    return;
  }

  userName = document.getElementById('p-name').value.trim();
  const r  = t => resolveUser(t, userName);

  window._persona = {
    name:        userName,
    age:         parseInt(document.getElementById('p-age').value),
    gender:      _selectedGender,
    appearance:  r(document.getElementById('p-appearance').value.trim()),
    personality: r(document.getElementById('p-personality').value.trim()),
    notes:       r(document.getElementById('p-notes').value.trim()),
  };
  window._characterId = currentCharacter.id;
  window._safety      = currentSafety;

  sessionId = 'session-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);

  messageLog = [];
  document.getElementById('chat-messages').innerHTML = '';
  document.getElementById('note-dot').style.display = 'none';
  setModelUI(CHAT_DEFAULT_MODEL);
  updateChatHeader(currentCharacter);

  userImageUrl = personaAvatarUpload?.getUrl() || null;
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

// ── Tag input logic ───────────────────────────────────────
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
    // 쉼표가 붙어 타이핑된 경우 처리
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
let builderModel     = BUILDER_DEFAULT_MODEL;

function openBuilder() {
  if (!_currentUser) { showAuthGate('캐릭터 제작', '캐릭터를 제작하려면 로그인이 필요합니다.'); return; }
  // Reset builder state
  builderSessionId = null;
  builderCharData  = null;
  builderSystemMd  = null;
  builderModel     = BUILDER_DEFAULT_MODEL;
  setBuilderModelUI(BUILDER_DEFAULT_MODEL);
  document.getElementById('builder-messages').innerHTML = '';
  document.getElementById('builder-input').value = '';

  navigateTo('/builder');
  // Reset input height after screen is visible, then start conversation
  const builderInput = document.getElementById('builder-input');
  builderInput.style.height = '';
  setTimeout(initBuilderConversation, 80);
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
  document.getElementById('be-profanity-toggle').checked = !!d.hasProfanity;

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
    hasProfanity:  document.getElementById('be-profanity-toggle').checked,
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
    hasProfanity:  document.getElementById('be-profanity-toggle').checked,
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
    if (_currentUser) loadBookmarks();
  } catch (_) {}
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
  const isLogin = view === 'login';
  document.getElementById('auth-login-view').style.display    = isLogin ? '' : 'none';
  document.getElementById('auth-register-view').style.display = isLogin ? 'none' : '';
  document.getElementById('auth-nav-label').textContent       = isLogin ? '로그인' : '회원가입';
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

async function submitLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const pw    = document.getElementById('login-pw').value;
  document.getElementById('login-global-err').textContent = '';

  try {
    const res  = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pw }),
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

async function submitRegister(e) {
  e.preventDefault();
  const emailOk = validateField('reg-email', 'reg-email-err', 'email');
  const pwOk    = validateField('reg-pw',    'reg-pw-err',    'password');
  const nickOk  = validateField('reg-nick',  'reg-nick-err',  'nickname');
  if (!emailOk || !pwOk || !nickOk) return;

  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-pw').value;
  const nickname = document.getElementById('reg-nick').value.trim();
  document.getElementById('reg-global-err').textContent = '';

  try {
    const res  = await fetch('/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, nickname }),
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
  document.getElementById('mypage-nickname').textContent      = _currentUser.nickname;
  document.getElementById('mypage-email').textContent         = _currentUser.email;
  document.getElementById('mypage-avatar-letter').textContent = _currentUser.nickname[0].toUpperCase();

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
    if (!rows.length) {
      list.innerHTML = '<p class="mypage-empty" style="padding:32px 0;text-align:center;">저장된 페르소나가 없습니다.</p>';
      return;
    }
    const defaultId = _currentUser?.default_persona_id;
    list.innerHTML = rows.map(p => {
      const d = p.data;
      const isDefault = p.id === defaultId;
      const initial = (d.name || '?')[0].toUpperCase();
      const meta = [d.age ? d.age + '세' : '', d.gender === 'male' ? '남' : d.gender === 'female' ? '여' : ''].filter(Boolean).join(' · ');
      return `
        <div class="mypage-p-card${isDefault ? ' is-default' : ''}" onclick="openPersonaDetail(${p.id})">
          <div class="mypage-p-initial">${initial}</div>
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

function newPersonaFromMypage() {
  showToast('캐릭터를 선택한 뒤 페르소나를 설정해주세요.');
  navigateTo('/');
}

async function setDefaultPersona(id) {
  await fetch(`/api/personas/${id}/set-default`, { method: 'PATCH' });
  const res  = await fetch('/api/auth/me');
  const data = await res.json();
  _currentUser = data.user;
  loadMypagePersonas();
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

async function saveInfo() {
  const nickOk  = validateField('modal-nickname', 'modal-nick-err',   'nickname');
  const emailOk = validateField('modal-email',    'modal-email-err',  'email');
  if (!nickOk || !emailOk) return;

  const nickname        = document.getElementById('modal-nickname').value.trim();
  const email           = document.getElementById('modal-email').value.trim();
  const currentPassword = document.getElementById('modal-cur-pw').value;
  const newPassword     = document.getElementById('modal-new-pw').value;
  const globalErr       = document.getElementById('modal-info-global-err');
  globalErr.textContent = '';

  if (newPassword) {
    if (!validateField('modal-new-pw', 'modal-pw-err', 'password')) return;
    if (!currentPassword) { globalErr.textContent = '현재 비밀번호를 입력해주세요'; return; }
  }

  const payload = { nickname, email };
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
