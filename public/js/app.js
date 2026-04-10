// ─── Model Config ────────────────────────────────────────
const MODELS = [
  { id: 'claude-sonnet-4-6',         label: 'Sonnet 4.6',       desc: '균형 잡힌 성능 · 기본값', provider: 'claude'  },
  { id: 'claude-opus-4-6',           label: 'Opus 4.6',         desc: '최고 성능',               provider: 'claude'  },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5',        desc: '빠른 응답',               provider: 'claude'  },
  { id: 'gemini-2.5-flash',          label: 'Gemini 2.5 Flash', desc: '빠르고 효율적 · Google',  provider: 'gemini'  },
  { id: 'gemini-2.5-pro',            label: 'Gemini 2.5 Pro',   desc: '최고 성능 · Google',      provider: 'gemini'  },
];

// ─── State ───────────────────────────────────────────────
let sessionId        = null;
let userName         = '';
let lastAssistantEl  = null;
let currentMode      = 'chat';   // 'chat' | 'novel'
let messageLog       = [];       // [{ role, sender, text }]
let userImageUrl     = null;     // base64 profile image
let currentModel     = MODELS[0].id;
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
  });

  // Select-delete button: hover → "취소" when no selection
  const selectBtn = document.getElementById('btn-select-delete');
  selectBtn.addEventListener('mouseenter', () => {
    if (_selectMode && _selectedIds.size === 0) selectBtn.textContent = '취소';
  });
  selectBtn.addEventListener('mouseleave', () => {
    if (_selectMode) selectBtn.textContent = '삭제';
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

    card.innerHTML = `
      ${imgHtml}
      <div class="char-card-overlay">
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

  // Persona subtitle hint
  document.getElementById('persona-subtitle').textContent =
    `${char.name}이(가) 당신을 알 수 있도록 정보를 입력해주세요.`;

  // Safety segment control
  mountSafetySegment(char);
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

function setSafety(value) { /* kept for legacy inline calls — no-op, handled by component */ }

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

  const btn = document.getElementById('btn-select-delete');
  btn.textContent = '삭제';
  btn.classList.add('btn-select-delete-active');
  btn.classList.remove('btn-select-delete-ready');

  document.querySelectorAll('.session-card').forEach(card => {
    card.classList.add('select-mode');
  });
}

function exitSelectMode() {
  _selectMode  = false;
  _selectedIds = new Set();

  const btn = document.getElementById('btn-select-delete');
  btn.textContent = '선택 삭제';
  btn.classList.remove('btn-select-delete-active', 'btn-select-delete-ready');

  document.querySelectorAll('.session-card').forEach(card => {
    card.classList.remove('select-mode', 'selected');
    const cb = card.querySelector('.session-checkbox');
    if (cb) cb.classList.remove('checked');
  });
}

function _updateDeleteBtn() {
  const btn = document.getElementById('btn-select-delete');
  if (!btn) return;
  btn.classList.toggle('btn-select-delete-ready', _selectedIds.size > 0);
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

// Called when "삭제" btn clicked in active state
function handleDeleteClick() {
  if (!_selectMode) return;
  if (_selectedIds.size === 0) { exitSelectMode(); return; }
  document.getElementById('delete-modal-title').textContent =
    `선택한 ${_selectedIds.size}개의 대화를 삭제하시겠습니까?`;
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
    setModelUI(data.model || MODELS[0].id);

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

  // Bottom nav: hidden only in chat screens
  const nav = document.getElementById('bottom-nav');
  const chatScreens = ['screen-chat', 'screen-builder-chat', 'screen-builder-loading'];
  if (nav) nav.classList.toggle('hidden', chatScreens.includes(id));
}

// ─── Router ───────────────────────────────────────────────
// Routes (evaluated top-to-bottom, first match wins):
//   /                          → landing
//   /history                   → session history list
//   /character/:id             → character intro
//   /character/:id/chat        → chat
//   /persona                   → persona setup (requires currentCharacter)
//   /builder                   → builder chat
//   /builder/preview           → builder edit/preview
const ROUTES = [
  { pattern: /^\/character\/([^/]+)\/chat$/,    handler: (m) => _routeChat(m[1])       },
  { pattern: /^\/character\/([^/]+)$/,          handler: (m) => _routeIntro(m[1])      },
  { pattern: /^\/history$/,                     handler: ()  => showScreen('screen-history')       },
  { pattern: /^\/persona$/,                     handler: ()  => showScreen('screen-persona')       },
  { pattern: /^\/builder\/preview$/,            handler: ()  => showScreen('screen-builder-edit')  },
  { pattern: /^\/builder$/,                     handler: ()  => showScreen('screen-builder-chat')  },
  { pattern: /^\/$/,                            handler: ()  => showScreen('screen-landing')       },
];

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

function navigateTo(path) {
  window.history.pushState(null, '', path);
  renderRoute(path);
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
  if (p.gender) selectGender(p.gender); else { _selectedGender = null; document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('active')); }
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
  setModelUI(MODELS[0].id);
  updateChatHeader(currentCharacter);

  userImageUrl = personaAvatarUpload?.getUrl() || null;
  if (userImageUrl) localStorage.setItem(`user-img:${sessionId}`, userImageUrl);
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

function openBuilder() {
  // Reset builder state
  builderSessionId = null;
  builderCharData  = null;
  builderSystemMd  = null;
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
      body:    JSON.stringify({ message: '시작해줘', builderSessionId: null }),
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
      body:    JSON.stringify({ message: text, builderSessionId }),
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

    if (data.error) { showToast('등록에 실패했습니다.'); return; }

    showToast('캐릭터가 등록되었습니다!');
    await loadCharacters();
    navigateTo('/');
  } catch (_) {
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
