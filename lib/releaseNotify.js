const fs            = require('fs');
const path          = require('path');
const Anthropic     = require('@anthropic-ai/sdk');
const { callGemini } = require('./gemini');
const { stmt }       = require('../db');

const CHANGELOG_PATH   = path.join(__dirname, '..', 'CHANGELOG.md');
const STATE_PATH       = path.join(__dirname, '..', 'data', 'release-notify.json');

// ── 버전 파싱 ─────────────────────────────────────────────

function parseChangelog() {
  const raw = fs.readFileSync(CHANGELOG_PATH, 'utf-8');

  // 최신 버전 번호 추출 (<!-- changelog-last-version: 0.26 -->)
  const metaMatch = raw.match(/changelog-last-version:\s*([\d.]+)/);
  if (!metaMatch) return null;
  const version = `v${metaMatch[1]}`;

  // 해당 버전 섹션 내용 추출 (## v0.26 ... 다음 ## 전까지)
  const sectionMatch = raw.match(
    new RegExp(`## ${version}[^\n]*\n([\\s\\S]*?)(?=\n## v|$)`)
  );
  const content = sectionMatch ? sectionMatch[1].trim() : '';

  return { version, content };
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
  } catch (_) {
    return { lastNotifiedVersion: null };
  }
}

function saveState(version) {
  fs.writeFileSync(STATE_PATH, JSON.stringify({ lastNotifiedVersion: version }, null, 2), 'utf-8');
}

// ── AI 알림 문구 생성 ──────────────────────────────────────

const SYSTEM = '당신은 앱 업데이트 알림 작성자입니다. 개발 로그를 유저 친화적인 한국어 알림으로 변환합니다.';

function buildPrompt(version, content) {
  return `다음은 "${version}" 업데이트의 개발 로그입니다.
이걸 읽는 일반 유저에게 보낼 앱 내 알림 문구를 작성하세요.

요구사항:
- title: 25자 이내, 이모지 1개 포함, 유저 관점으로 (예: "🧠 이제 캐릭터가 당신을 기억해요")
- body: 80자 이내, 핵심 변경사항 1~2가지만, 기술 용어 없이 자연스러운 한국어
- JSON 형식으로만 응답: {"title": "...", "body": "..."}

개발 로그:
${content.slice(0, 3000)}`;
}

async function generateNotification(version, content) {
  const prompt = buildPrompt(version, content);
  const history = [{ role: 'user', content: prompt }];

  let raw;
  try {
    raw = await callGemini({ model: 'gemini-2.5-flash', systemInstruction: SYSTEM, history, maxTokens: 1024 });
  } catch (geminiErr) {
    console.warn('[ReleaseNotify] Gemini 실패, Anthropic 폴백:', geminiErr.message);
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 512, system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    });
    raw = res.content[0].text;
  }

  // 마크다운 코드블록 제거
  const stripped = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  // 1) 전체 직접 파싱 시도
  try { return JSON.parse(stripped); } catch (_) {}
  // 2) 최외곽 {} 추출 (중첩 미지원이지만 title/body 단순 문자열엔 충분)
  const start = stripped.indexOf('{');
  const end   = stripped.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error(`JSON 블록 없음: ${raw.slice(0, 120)}`);
  return JSON.parse(stripped.slice(start, end + 1));
}

// ── 메인 진입점 ───────────────────────────────────────────

async function checkAndNotify() {
  const parsed = parseChangelog();
  if (!parsed) return;

  const { version, content } = parsed;
  const state = loadState();

  if (state.lastNotifiedVersion === version) return; // 이미 알림 발송됨

  console.log(`[ReleaseNotify] 새 버전 감지: ${version}`);

  try {
    const { title, body } = await generateNotification(version, content);
    // user_id = null → 전체 브로드캐스트, category = 'notice'
    stmt.createNotification.run(null, 'notice', title, body, version);
    saveState(version);
    console.log(`[ReleaseNotify] 알림 생성 완료: "${title}"`);
  } catch (err) {
    console.error('[ReleaseNotify] 알림 생성 실패:', err.message);
  }
}

module.exports = { checkAndNotify };
