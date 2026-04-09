// ─── State ───────────────────────────────────────────────
let sessionId = null;
let userName  = '';

// ─── Screen Navigation ───────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
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
  const age         = document.getElementById('p-age').value;
  const appearance  = document.getElementById('p-appearance').value.trim();
  const personality = document.getElementById('p-personality').value.trim();
  const notes       = document.getElementById('p-notes').value.trim();

  sessionId = 'session-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);

  window._persona = { name: userName, age: parseInt(age), appearance, personality, notes };

  document.getElementById('chat-messages').innerHTML = '';
  showScreen('screen-chat');
}

// ─── Reset / Back ─────────────────────────────────────────
async function resetChat() {
  if (sessionId) {
    try {
      await fetch('/api/chat/' + sessionId, { method: 'DELETE' });
    } catch (_) {}
    sessionId = null;
  }
  showScreen('screen-persona');
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

  const body = { sessionId, message: text };
  if (window._persona) {
    body.persona   = window._persona;
    window._persona = null; // only send on first message
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
  } catch (err) {
    typingEl.remove();
    appendMessage('assistant', '이화', '(연결에 실패했습니다.)');
  }

  setInputDisabled(false);
  input.focus();
}

// ─── DOM Helpers ─────────────────────────────────────────
function appendMessage(role, sender, text) {
  const container = document.getElementById('chat-messages');

  const wrap   = document.createElement('div');
  wrap.className = 'msg ' + role;

  const name   = document.createElement('div');
  name.className = 'msg-sender';
  name.textContent = sender;

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.textContent = text;

  wrap.appendChild(name);
  wrap.appendChild(bubble);
  container.appendChild(wrap);
  scrollToBottom();
  return wrap;
}

function appendTyping() {
  const container = document.getElementById('chat-messages');

  const wrap   = document.createElement('div');
  wrap.className = 'msg assistant';

  const name   = document.createElement('div');
  name.className = 'msg-sender';
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
  const container = document.getElementById('chat-messages');
  container.scrollTop = container.scrollHeight;
}

function setInputDisabled(disabled) {
  document.getElementById('chat-input').disabled = disabled;
  document.getElementById('btn-send').disabled   = disabled;
}

// ─── Input Helpers ────────────────────────────────────────
function handleKey(event) {
  // Enter sends, Shift+Enter = newline
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}
