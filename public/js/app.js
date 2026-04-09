// ─── Model Config ────────────────────────────────────────
const MODELS = [
  { id: 'claude-sonnet-4-6',         label: 'Sonnet 4.6', desc: '균형 잡힌 성능 · 기본값' },
  { id: 'claude-opus-4-6',           label: 'Opus 4.6',   desc: '최고 성능'               },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5',  desc: '빠른 응답'               },
];

// ─── State ───────────────────────────────────────────────
let sessionId       = null;
let userName        = '';
let lastAssistantEl = null;
let currentMode     = 'chat';   // 'chat' | 'novel'
let messageLog      = [];        // [{ role, sender, text }]
let userImageUrl    = null;      // base64 profile image
let currentModel    = MODELS[0].id;

// ─── Init ─────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  initModelPicker();
  checkSavedSessions();

  // Close picker on outside click
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

async function checkSavedSessions() {
  try {
    const res  = await fetch('/api/sessions');
    const list = await res.json();
    if (list.length > 0) {
      document.getElementById('btn-continue').style.display = 'block';
    }
  } catch (_) {}
}

// ─── Screen Navigation ───────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(id);
  target.classList.add('active');
  if (id !== 'screen-chat') target.scrollTop = 0;
  if (id === 'screen-history') loadSessionList();
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
  if (found) {
    document.getElementById('model-label').textContent = found.label;
  }
  // Update active state in picker
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

// ─── Session List ─────────────────────────────────────────
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

      const date = new Date(session.created_at * 1000);
      const dateStr = `${date.getFullYear()}.${String(date.getMonth()+1).padStart(2,'0')}.${String(date.getDate()).padStart(2,'0')}`;

      card.innerHTML = `
        <div class="session-card-top">
          <span class="session-persona-name">${session.persona.name || '알 수 없음'}</span>
          <span class="session-date">${dateStr}</span>
        </div>
        <p class="session-preview">${session.last_message ? escapeHtml(session.last_message) : '대화 없음'}</p>
        <span class="session-meta">메시지 ${session.message_count}개</span>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    container.innerHTML = '<p style="font-size:13px;color:var(--text-dim);">불러오기 실패</p>';
  }
}

async function loadSession(id) {
  try {
    const res  = await fetch(`/api/sessions/${id}`);
    const data = await res.json();

    sessionId = data.id;
    userName  = data.persona.name || '';

    // Restore model for this session
    setModelUI(data.model || MODELS[0].id);

    const container = document.getElementById('chat-messages');
    container.innerHTML = '';

    // appendMessage handles regenerate btn automatically (removes from prev, adds to last assistant)
    // Restore user image from localStorage
    userImageUrl = localStorage.getItem(`user-img:${id}`) || null;

    messageLog = [];
    data.messages.forEach(m => {
      appendMessage(m.role, m.role === 'user' ? userName : '이화', m.content);
    });

    // Restore note dot
    try {
      const nr = await fetch(`/api/sessions/${id}/note`);
      const nd = await nr.json();
      document.getElementById('note-dot').style.display = nd.note?.trim() ? 'block' : 'none';
    } catch (_) {}

    showScreen('screen-chat');
    scrollToBottom();
  } catch (err) {
    alert('대화를 불러오는 데 실패했습니다.');
  }
}

// ─── User Image Upload ───────────────────────────────────
function handleUserImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    userImageUrl = e.target.result;
    document.getElementById('upload-avatar-preview').src          = userImageUrl;
    document.getElementById('upload-avatar-preview').style.display = 'block';
    document.getElementById('upload-avatar-plus').style.display   = 'none';
    document.getElementById('upload-remove').style.display        = 'inline';
  };
  reader.readAsDataURL(file);
  // reset input so same file can be re-selected
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

// Update placeholders in other fields as name is typed
function syncUserPlaceholders(name) {
  const display = name.trim() || '{{user}}';
  document.getElementById('p-notes').placeholder       = `이화의 남자친구. 같은 팀 프로파일러. (${display} 기준)`;
}

// ─── Recommended Persona ─────────────────────────────────
function fillRecommended() {
  document.getElementById('p-name').value        = '강현';
  document.getElementById('p-age').value         = '29';
  document.getElementById('p-appearance').value  = '키가 크고 무표정한 인상. 말을 아끼는 편.';
  document.getElementById('p-personality').value = '무뚝뚝하고 감정 표현이 거의 없지만 이화한테만 미세하게 신경을 쓴다. 거의 소시오패스에 가까운 성격.';
  document.getElementById('p-notes').value       = '이화의 남자친구. S.A. Team Nocturne 소속 프로파일러로 이화와 같은 팀.';
}

// ─── Start Chat ───────────────────────────────────────────
function startChat(event) {
  event.preventDefault();

  userName = document.getElementById('p-name').value.trim();

  const r = t => resolveUser(t, userName);

  window._persona = {
    name:        userName,
    age:         parseInt(document.getElementById('p-age').value),
    appearance:  r(document.getElementById('p-appearance').value.trim()),
    personality: r(document.getElementById('p-personality').value.trim()),
    notes:       r(document.getElementById('p-notes').value.trim()),
  };

  sessionId = 'session-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);

  messageLog = [];
  document.getElementById('chat-messages').innerHTML = '';
  document.getElementById('note-dot').style.display = 'none';
  setModelUI(MODELS[0].id);
  // Persist user image to localStorage for this session
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
  const ta  = document.getElementById('note-textarea');
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
    // Show/hide dot indicator
    document.getElementById('note-dot').style.display = note.trim() ? 'block' : 'none';
    closeNotePanel();
  } catch (_) {}
}

// ─── Send Message ─────────────────────────────────────────
async function sendMessage() {
  const input = document.getElementById('chat-input');
  const text  = input.value.trim();
  if (!text || !sessionId) return;

  input.value = '';
  autoResize(input);
  setInputDisabled(true);

  appendMessage('user', userName || '유저', text);
  const typingEl = appendTyping();

  const body = { sessionId, message: text, model: currentModel };
  if (window._persona) {
    body.persona    = window._persona;
    window._persona = null;
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
      appendMessage('assistant', '이화', '(오류가 발생했습니다. 잠시 후 다시 시도해주세요.)');
    } else {
      appendMessage('assistant', '이화', data.reply);
    }
  } catch (_) {
    typingEl.remove();
    appendMessage('assistant', '이화', '(연결에 실패했습니다.)');
  }

  setInputDisabled(false);
  input.focus();
}

// ─── Mode Toggle ─────────────────────────────────────────
function toggleMode() {
  currentMode = currentMode === 'chat' ? 'novel' : 'chat';

  const btn = document.getElementById('btn-mode-toggle');
  btn.textContent = currentMode === 'novel' ? '💬 채팅' : '📖 소설';

  const container = document.getElementById('chat-messages');
  container.classList.toggle('novel-mode', currentMode === 'novel');

  // Re-render all messages with new mode
  lastAssistantEl = null;
  container.innerHTML = '';
  messageLog.forEach(m => renderMessage(m.role, m.sender, m.text, container));
  scrollToBottom();
}

// ─── DOM Helpers ─────────────────────────────────────────
function appendMessage(role, sender, text) {
  messageLog.push({ role, sender, text });
  const container = document.getElementById('chat-messages');
  return renderMessage(role, sender, text, container);
}

function renderMessage(role, sender, text, container) {
  // Remove regenerate btn from previous last assistant message
  if (role === 'assistant' && lastAssistantEl) {
    const old = lastAssistantEl.querySelector('.btn-regenerate');
    if (old) old.remove();
  }

  const wrap = document.createElement('div');
  wrap.className = 'msg ' + role;

  // Ihwa avatar thumbnail (chat mode only)
  if (role === 'assistant') {
    const avatar = document.createElement('img');
    avatar.src       = '/images/ihwa.png';
    avatar.alt       = '이화';
    avatar.className = 'msg-avatar';
    wrap.appendChild(avatar);
  }

  const name = document.createElement('div');
  name.className   = 'msg-sender';
  name.textContent = sender;

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';

  if (role === 'assistant' && currentMode === 'novel') {
    bubble.innerHTML = highlightDialogue(escapeHtml(text));
  } else {
    bubble.textContent = text;
  }

  if (role === 'assistant') {
    // Wrap name + bubble + regen inside .msg-inner so avatar sits beside them
    const inner = document.createElement('div');
    inner.className = 'msg-inner';
    inner.appendChild(name);
    inner.appendChild(bubble);

    const regenBtn = document.createElement('button');
    regenBtn.className   = 'btn-regenerate';
    regenBtn.textContent = '↺ 다시 생성';
    regenBtn.onclick     = () => regenerateMessage(wrap, bubble, regenBtn);
    inner.appendChild(regenBtn);

    wrap.appendChild(inner);
    lastAssistantEl = wrap;
  } else {
    // User message: optional avatar (chat mode only) + inner wrapper
    if (userImageUrl) {
      const avatar = document.createElement('img');
      avatar.src       = userImageUrl;
      avatar.alt       = userName;
      avatar.className = 'msg-user-avatar';
      wrap.appendChild(avatar);
    }
    const inner = document.createElement('div');
    inner.className = 'msg-inner-user';
    inner.appendChild(name);
    inner.appendChild(bubble);
    wrap.appendChild(inner);
  }

  container.appendChild(wrap);
  scrollToBottom();
  return wrap;
}

// Wrap quoted dialogue in <span class="dialogue">
function highlightDialogue(html) {
  // Typographic double quotes " "
  html = html.replace(/\u201C([^\u201D\n]*)\u201D/g,
    '<span class="dialogue">\u201C$1\u201D</span>');
  // Straight double quotes "..."
  html = html.replace(/"([^"\n]+)"/g,
    '<span class="dialogue">"$1"</span>');
  return html;
}

async function regenerateMessage(_wrapEl, bubbleEl, btnEl) {
  if (!sessionId) return;

  btnEl.disabled    = true;
  const prevText    = bubbleEl.textContent;
  bubbleEl.textContent = '';
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
    // Update stored log entry
    const last = messageLog.findLast(m => m.role === 'assistant');
    if (last) last.text = newText;
  } catch (_) {
    bubbleEl.className   = 'msg-bubble';
    bubbleEl.textContent = prevText;
  }

  btnEl.disabled = false;
  scrollToBottom();
}

function appendTyping() {
  const container = document.getElementById('chat-messages');
  const wrap   = document.createElement('div');
  wrap.className = 'msg assistant';

  const name   = document.createElement('div');
  name.className   = 'msg-sender';
  name.textContent = '이화';

  const bubble = document.createElement('div');
  bubble.className = 'typing-bubble';
  bubble.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';

  wrap.appendChild(name);
  wrap.appendChild(bubble);
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

// ─── Input Helpers ────────────────────────────────────────
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
