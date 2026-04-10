// ─── Model Config ────────────────────────────────────────
const MODELS = [
  { id: 'claude-sonnet-4-6',         label: 'Sonnet 4.6', desc: '균형 잡힌 성능 · 기본값' },
  { id: 'claude-opus-4-6',           label: 'Opus 4.6',   desc: '최고 성능'               },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5',  desc: '빠른 응답'               },
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

// ─── Init ─────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
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
});

// ─── Character Loading & Selection ───────────────────────
async function loadCharacters() {
  try {
    const res  = await fetch('/api/characters');
    characters = await res.json();
    renderCharacterGrid(characters);
    checkSavedSessions();
  } catch (_) {
    document.getElementById('char-grid').innerHTML =
      '<p style="font-size:13px;color:var(--text-dim);">캐릭터를 불러오지 못했습니다.</p>';
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
  showScreen('screen-intro');
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

// ─── Session List ─────────────────────────────────────────
async function checkSavedSessions() {
  try {
    const res  = await fetch('/api/sessions');
    const list = await res.json();
    document.getElementById('btn-continue').style.display = list.length > 0 ? 'block' : 'none';
  } catch (_) {}
}

async function loadSessionList() {
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
      card.className = 'session-card';
      card.onclick = () => loadSession(session.id);

      const date    = new Date(session.created_at * 1000);
      const dateStr = `${date.getFullYear()}.${String(date.getMonth()+1).padStart(2,'0')}.${String(date.getDate()).padStart(2,'0')}`;
      const charConf = characters.find(c => c.id === session.character_id);
      const charName = charConf ? charConf.name : (session.character_id || '이화');

      card.innerHTML = `
        <div class="session-card-top">
          <span class="session-persona-name">${session.persona.name || '알 수 없음'} <span style="color:var(--text-dim);font-weight:400;">→ ${charName}</span></span>
          <span class="session-date">${dateStr}</span>
        </div>
        <p class="session-preview">${session.last_message ? escapeHtml(session.last_message) : '대화 없음'}</p>
        <span class="session-meta">메시지 ${session.message_count}개</span>
      `;
      container.appendChild(card);
    });
  } catch (_) {
    container.innerHTML = '<p style="font-size:13px;color:var(--text-dim);">불러오기 실패</p>';
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

    showScreen('screen-chat');
    scrollToBottom();
  } catch (_) {
    alert('대화를 불러오는 데 실패했습니다.');
  }
}

// ─── Screen Navigation ───────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(id);
  target.classList.add('active');
  if (id !== 'screen-chat') target.scrollTop = 0;
  if (id === 'screen-history') loadSessionList();

  // Bottom nav: only visible on landing
  const nav = document.getElementById('bottom-nav');
  if (nav) nav.classList.toggle('hidden', id !== 'screen-landing');
}

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
  MODELS.forEach(m => {
    const opt = document.createElement('div');
    opt.className = 'model-option' + (m.id === currentModel ? ' active' : '');
    opt.dataset.id = m.id;
    opt.innerHTML = `
      <div class="model-option-left">
        <span class="model-option-name">${m.label}</span>
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
  picker.style.bottom = (window.innerHeight - rect.top + 8) + 'px';
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

// ─── User Image Upload ───────────────────────────────────
function handleUserImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    userImageUrl = e.target.result;
    document.getElementById('upload-avatar-preview').src           = userImageUrl;
    document.getElementById('upload-avatar-preview').style.display = 'block';
    document.getElementById('upload-avatar-plus').style.display    = 'none';
    document.getElementById('upload-remove').style.display         = 'inline';
  };
  reader.readAsDataURL(file);
  event.target.value = '';
}

function removeUserImage() {
  userImageUrl = null;
  document.getElementById('upload-avatar-preview').style.display = 'none';
  document.getElementById('upload-avatar-preview').src           = '';
  document.getElementById('upload-avatar-plus').style.display    = '';
  document.getElementById('upload-remove').style.display         = 'none';
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
  syncUserPlaceholders(p.name || '');
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
    appearance:  r(document.getElementById('p-appearance').value.trim()),
    personality: r(document.getElementById('p-personality').value.trim()),
    notes:       r(document.getElementById('p-notes').value.trim()),
  };
  window._characterId = currentCharacter.id;

  sessionId = 'session-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);

  messageLog = [];
  document.getElementById('chat-messages').innerHTML = '';
  document.getElementById('note-dot').style.display = 'none';
  setModelUI(MODELS[0].id);
  updateChatHeader(currentCharacter);

  if (userImageUrl) localStorage.setItem(`user-img:${sessionId}`, userImageUrl);
  showScreen('screen-chat');
}

// ─── Reset / Back ─────────────────────────────────────────
async function resetChat() {
  sessionId = null;
  await checkSavedSessions();
  showScreen('screen-landing');
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
    window._persona     = null;
    window._characterId = null;
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
    bubble.className = 'msg-bubble';
    if (currentMode === 'novel') {
      bubble.innerHTML = highlightDialogue(escapeHtml(text));
    } else {
      bubble.textContent = text;
    }

    const regenBtn = document.createElement('button');
    regenBtn.className   = 'btn-regenerate';
    regenBtn.textContent = '↺ 다시 생성';
    regenBtn.onclick     = () => regenerateMessage(wrap, bubble, regenBtn);

    inner.appendChild(name);
    inner.appendChild(bubble);
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

async function regenerateMessage(_wrapEl, bubbleEl, btnEl) {
  if (!sessionId) return;
  btnEl.disabled       = true;
  const prevText       = bubbleEl.textContent;
  bubbleEl.className   = 'typing-bubble';
  bubbleEl.innerHTML   = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';

  try {
    const res  = await fetch('/api/chat/regenerate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ sessionId }),
    });
    const data = await res.json();
    bubbleEl.className = 'msg-bubble';
    const newText = data.error ? '(재생성에 실패했습니다.)' : data.reply;
    if (currentMode === 'novel' && !data.error) {
      bubbleEl.innerHTML = highlightDialogue(escapeHtml(newText));
    } else {
      bubbleEl.textContent = newText;
    }
    const last = messageLog.findLast(m => m.role === 'assistant');
    if (last) last.text = newText;
  } catch (_) {
    bubbleEl.className   = 'msg-bubble';
    bubbleEl.textContent = prevText;
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

function handleKey(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 100) + 'px';
}
