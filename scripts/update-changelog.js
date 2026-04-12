#!/usr/bin/env node
/**
 * scripts/update-changelog.js
 *
 * 새 커밋을 읽어 CHANGELOG.md 상단에 새 버전 항목을 추가합니다.
 * Usage: node scripts/update-changelog.js [git-range]
 *   git-range 예시: "abc1234..HEAD"  또는 "abc1234" (해당 커밋만)
 *   생략 시 CHANGELOG.md 상단의 <!-- changelog-last-commit --> 마커 기준
 */

const { execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const ROOT           = path.join(__dirname, '..');
const CHANGELOG_PATH = path.join(ROOT, 'CHANGELOG.md');
const MARKER_COMMIT  = '<!-- changelog-last-commit:';
const MARKER_VER     = '<!-- changelog-last-version:';

// ── 유틸 ──────────────────────────────────────────────────

function run(cmd) {
  try { return execSync(cmd, { encoding: 'utf-8', cwd: ROOT }).trim(); }
  catch (_) { return ''; }
}

function readChangelog() {
  return fs.existsSync(CHANGELOG_PATH)
    ? fs.readFileSync(CHANGELOG_PATH, 'utf-8')
    : '';
}

// CHANGELOG 상단 메타 마커에서 마지막 기록 커밋 해시·버전 추출
function getMeta(content) {
  const hashLine = content.split('\n').find(l => l.startsWith(MARKER_COMMIT));
  const verLine  = content.split('\n').find(l => l.startsWith(MARKER_VER));
  const hash = hashLine ? hashLine.replace(MARKER_COMMIT, '').replace('-->', '').trim() : null;
  const ver  = verLine  ? verLine.replace(MARKER_VER,  '').replace('-->', '').trim() : '0.0';
  return { hash, ver };
}

// "0.8" → "0.9", "0.9" → "0.10"
function nextVersion(ver) {
  const [major, minor] = ver.split('.').map(Number);
  return `${major}.${minor + 1}`;
}

// ── 커밋 파싱 ─────────────────────────────────────────────

function getCommits(range) {
  const hashes = run(`git log ${range} --format="%H" --reverse`);
  if (!hashes) return [];

  return hashes.split('\n').filter(Boolean).map(hash => {
    const subject = run(`git log -1 --format="%s" ${hash}`);
    const date    = run(`git log -1 --format="%ad" --date=short ${hash}`);
    const body    = run(`git log -1 --format="%b" ${hash}`);

    // subject: "feat: 제목" 또는 "feat(scope): 제목"
    const m        = subject.match(/^(\w+)(?:\([^)]*\))?:\s*(.+)/);
    const category = m ? m[1] : 'chore';
    const title    = m ? m[2] : subject;

    // body에서 - 로 시작하는 불릿 추출 (Co-Authored-By 제외)
    const bullets = body.split('\n')
      .map(l => l.trim())
      .filter(l => (l.startsWith('-') || l.startsWith('*')) &&
                   !l.includes('Co-Authored-By'));

    return { hash, category, title, date, bullets };
  });
}

// ── 엔트리 포맷 ───────────────────────────────────────────

const CATEGORY_LABEL = {
  feat:     '주요 기능',
  fix:      '버그 수정',
  refactor: '리팩터링',
  chore:    '기타',
  docs:     '문서',
  style:    'UI',
  perf:     '성능',
};

function formatEntry(commits, version) {
  const last  = commits[commits.length - 1];
  const date  = last.date;

  // 카테고리별로 그룹핑
  const groups = {};
  for (const c of commits) {
    const label = CATEGORY_LABEL[c.category] || '기타';
    if (!groups[label]) groups[label] = [];
    if (c.bullets.length > 0) {
      groups[label].push(...c.bullets);
    } else {
      groups[label].push(`- ${c.title}`);
    }
  }

  // 헤더: 커밋이 1개면 그 제목, 여러 개면 날짜 기준 병합
  const headerTitle = commits.length === 1
    ? commits[0].title
    : commits.filter(c => c.category === 'feat').map(c => c.title).join(', ')
      || last.title;

  let body = '';
  for (const [label, items] of Object.entries(groups)) {
    // feat가 여러 커밋으로 나뉜 경우 소제목 생략, 단일 카테고리면 소제목 표시
    if (Object.keys(groups).length > 1) {
      body += `\n### ${label}\n`;
    }
    body += items.join('\n') + '\n';
  }

  return `## v${version} — ${date}\n**${headerTitle}**\n${body}`;
}

// ── 메인 ─────────────────────────────────────────────────

const rangeArg = process.argv[2] || null;
const content  = readChangelog();
const meta     = getMeta(content);

// 범위 결정
let range;
if (rangeArg) {
  range = rangeArg;
} else if (meta.hash) {
  range = `${meta.hash}..HEAD`;
} else {
  console.error('오류: CHANGELOG.md에 changelog-last-commit 마커가 없습니다.');
  process.exit(1);
}

const commits = getCommits(range);
if (!commits.length) {
  // changelog 커밋 자체만 있는 경우 등 — 정상 종료
  process.exit(0);
}

// "docs: CHANGELOG 업데이트" 커밋은 로그에서 제외
const meaningful = commits.filter(c =>
  !(c.category === 'docs' && c.title.includes('CHANGELOG'))
);
if (!meaningful.length) {
  process.exit(0);
}

const newVersion = nextVersion(meta.ver);
const entry      = formatEntry(meaningful, newVersion);
const headHash   = run('git rev-parse HEAD');

// 기존 마커 제거
let updated = content
  .replace(/<!-- changelog-last-commit:.*?-->\n?/g, '')
  .replace(/<!-- changelog-last-version:.*?-->\n?/g, '');

// "---\n\n" 첫 번째 구분선 뒤에 새 항목 삽입
const DIVIDER = '---\n\n';
const idx = updated.indexOf(DIVIDER);
if (idx !== -1) {
  const after = idx + DIVIDER.length;
  updated = updated.slice(0, after) + entry + '\n---\n\n' + updated.slice(after);
} else {
  updated = entry + '\n---\n\n' + updated;
}

// 메타 마커를 파일 최상단에 추가
const newMeta = `<!-- changelog-last-commit: ${headHash} -->\n<!-- changelog-last-version: ${newVersion} -->\n\n`;
updated = newMeta + updated;

fs.writeFileSync(CHANGELOG_PATH, updated, 'utf-8');
console.log(`✓ CHANGELOG.md → v${newVersion} (커밋 ${meaningful.length}개)`);
