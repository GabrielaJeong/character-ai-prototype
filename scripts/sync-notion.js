#!/usr/bin/env node
/**
 * scripts/sync-notion.js
 *
 * repo → Notion 단방향 동기화. GitHub Actions의 push 트리거에서 돌아간다.
 *
 * Usage: node scripts/sync-notion.js [--only=docs,log,chars,curation] [--dry-run] [--force] [--adopt]
 *   --only    동기화 대상 선택 — docs(문서 10종) · log(커밋) · chars(캐릭터) · curation
 *             (기본: 전부)
 *   --dry-run 쓰기 없이 계획만 출력. NOTION_TOKEN 없으면 변환 검사만 수행.
 *   --force   내용이 안 바뀐 페이지도 다시 쓴다
 *   --adopt   제목이 같은 기존 페이지를 미러로 인수한다 (기존 내용 삭제, 되돌릴 수 없음)
 *
 * 기본값은 안전 쪽이다. 제목이 같아도 동기화 표식이 없는 페이지는 사람이 쓴
 * 것으로 보고 건너뛴다 — 루트에 이미 같은 이름의 문서가 있을 때 그것을
 * 말없이 지우는 사고를 막기 위함이다.
 *
 * Env: NOTION_TOKEN, NOTION_PAGE_ID
 *
 * 상태 파일을 두지 않는 설계다. Notion 쪽 대상은 루트 페이지의 자식 중
 * 제목으로 찾고, 없으면 만든다. Actions처럼 워크스페이스가 매번 새로 체크아웃되는
 * 환경에서 매니페스트를 커밋해 되돌리는 일을 피하기 위함이다.
 */

// CI는 의존성 설치 없이 이 스크립트만 돌린다(내장 모듈 + 전역 fetch로 충분).
// 로컬에서는 .env 를 읽어야 하므로 dotenv가 있을 때만 쓴다.
try {
  require('dotenv').config({ quiet: true });
} catch {
  /* CI — 환경변수는 Secrets로 주입된다 */
}

const { execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { createClient, extractId } = require('../lib/notion');
const { blocksFromMarkdown, simpleTable, heading, para } = require('../lib/notionMarkdown');

const ROOT = path.join(__dirname, '..');
const COMMIT_LIMIT = 300; // 커밋 로그 DB에 올릴 최근 커밋 수
const MARKER_PREFIX = '⟳ repo 동기화 ·';
const NOTICE_MARK = '[repo 자동 동기화]';

// 미러링할 문서 — 파일 경로와 Notion 페이지 제목.
// 제목이 Notion 쪽 식별자라, 바꾸면 새 페이지가 생기고 기존 페이지는 남는다.
const DOCS = [
  { file: 'CHANGELOG.md', title: '업데이트 로그' },
  { file: 'docs/CURRENT_STATE.md', title: '현재 상태' },
  { file: 'docs/PRODUCTION_PLAN.md', title: '프로덕션 플랜' },
  { file: 'docs/DECISIONS.md', title: '의사결정 기록' },
  { file: 'docs/DESIGN_SYSTEM.md', title: '디자인 시스템' },
  { file: 'docs/CONVENTIONS.md', title: '코딩 컨벤션' },
  { file: 'docs/LESSONS.md', title: '레슨' },
  { file: 'docs/SECURITY.md', title: '보안' },
  { file: 'docs/CUTOVER_CHECKLIST.md', title: '컷오버 체크리스트' },
  { file: 'docs/SESSION_CHECKLIST.md', title: '세션 체크리스트' },
];

const DB_COMMITS = '커밋 로그';
const DB_CHARS = '캐릭터';
const PAGE_CURATION = '큐레이션 데이터';

const COMMIT_TYPES = [
  'feat',
  'fix',
  'perf',
  'refactor',
  'docs',
  'test',
  'chore',
  'style',
  'build',
  'ci',
];

// ── 인자 ──────────────────────────────────────────────────

const argv = process.argv.slice(2);
const hasFlag = (f) => argv.includes(f);
const onlyArg = argv.find((a) => a.startsWith('--only='));

const DRY_RUN = hasFlag('--dry-run');
const FORCE = hasFlag('--force');
const ADOPT = hasFlag('--adopt');
const ONLY = onlyArg
  ? onlyArg
      .slice(7)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  : null;

const wants = (name) => !ONLY || ONLY.includes(name);

// 덮어쓰기를 거부하고 건너뛴 대상. 실행 끝에 한 번에 안내한다.
const skipped = [];

// ── 유틸 ──────────────────────────────────────────────────

const hash12 = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 12);
const trunc = (s, n) =>
  String(s ?? '').length > n ? String(s).slice(0, n - 1) + '…' : String(s ?? '');
const readFile = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf-8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

function git(args) {
  try {
    return execSync(`git ${args}`, {
      encoding: 'utf-8',
      cwd: ROOT,
      maxBuffer: 32 * 1024 * 1024,
    }).trim();
  } catch {
    return '';
  }
}

// Notion 속성 값 빌더
const pTitle = (t) => ({
  title: [{ type: 'text', text: { content: trunc(t || '(제목 없음)', 200) } }],
});
const pText = (t) => ({
  rich_text: t ? [{ type: 'text', text: { content: trunc(t, 2000) } }] : [],
});
const pSelect = (v) =>
  v ? { select: { name: trunc(String(v).replace(/,/g, ' '), 100) } } : { select: null };
const pDate = (d) => (d ? { date: { start: d } } : { date: null });
// multi_select 옵션 이름에는 쉼표를 쓸 수 없다 — Notion이 400을 돌려준다.
const pMulti = (arr) => ({
  multi_select: [
    ...new Set(
      (arr || []).filter(Boolean).map((v) => trunc(String(v).replace(/,/g, ' ').trim(), 100))
    ),
  ]
    .filter(Boolean)
    .map((name) => ({ name })),
});

/** 미러 페이지 맨 위에 붙이는 동기화 표식. 다음 실행의 변경 감지 기준이 된다. */
function markerBlock(source, contentHash) {
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  return {
    object: 'block',
    type: 'callout',
    callout: {
      icon: { type: 'emoji', emoji: '🔄' },
      color: 'gray_background',
      rich_text: [
        {
          type: 'text',
          text: { content: `${MARKER_PREFIX} ${source} · ${contentHash} · ${stamp} UTC` },
          annotations: { color: 'gray' },
        },
      ],
    },
  };
}

function readMarkerHash(block) {
  if (!block || block.type !== 'callout') return null;
  const text = (block.callout.rich_text || [])
    .map((t) => t.plain_text ?? t.text?.content ?? '')
    .join('');
  const m = text.match(/·\s*([0-9a-f]{12})\s*·/);
  return m ? m[1] : null;
}

/** 동기화 루트 맨 위 안내문. 사람이 여기서 고치면 덮어쓰인다는 경고. */
function noticeBlock() {
  return {
    object: 'block',
    type: 'callout',
    callout: {
      icon: { type: 'emoji', emoji: '🤖' },
      color: 'yellow_background',
      rich_text: [
        { type: 'text', text: { content: NOTICE_MARK }, annotations: { bold: true } },
        {
          type: 'text',
          text: {
            content:
              ' 이 페이지 아래 문서·DB는 repo에서 자동 생성됩니다. ' +
              '여기서 고쳐도 다음 동기화 때 덮어쓰이니, 수정은 repo에서 하세요. ' +
              '(scripts/sync-notion.js · docs/NOTION_SYNC.md)',
          },
        },
      ],
    },
  };
}

/**
 * 루트 맨 위에 안내문을 한 번만 둔다.
 * Notion append는 항상 끝에 붙으므로, 자식 페이지를 만들기 전에 호출해야
 * 빈 전용 페이지에서 안내문이 맨 위에 온다.
 */
async function ensureRootNotice(notion, rootId) {
  const first = await notion.request('GET', `/blocks/${rootId}/children?page_size=1`);
  const head = first.results?.[0];
  const text =
    head?.type === 'callout'
      ? (head.callout.rich_text || []).map((t) => t.plain_text ?? '').join('')
      : '';

  if (text.includes(NOTICE_MARK)) return;

  if (DRY_RUN) {
    console.log('안내문\n  + 루트 상단 안내 callout 추가 예정');
    return;
  }

  await notion.appendChildren(rootId, [noticeBlock()]);
  console.log(
    `안내문\n  + 루트 상단 안내 callout 추가${head ? ' (기존 내용이 있어 맨 아래에 붙습니다)' : ''}`
  );
}

// ── 메인 ──────────────────────────────────────────────────

async function main() {
  const token = process.env.NOTION_TOKEN;
  const rootId = extractId(process.env.NOTION_PAGE_ID);

  if (!token || !rootId) {
    if (DRY_RUN) return convertOnlyReport();
    const miss = [!token && 'NOTION_TOKEN', !rootId && 'NOTION_PAGE_ID'].filter(Boolean).join(', ');
    console.log(`::warning::Notion 동기화를 건너뜁니다 — ${miss} 미설정`);
    console.log(`\n설정 방법은 docs/NOTION_SYNC.md 를 보세요.`);
    return 0; // 설정 전에는 CI를 깨뜨리지 않는다
  }

  const notion = createClient(token, { dryRun: DRY_RUN });
  console.log(`대상 페이지: ${rootId}${DRY_RUN ? '  (dry-run — 쓰지 않음)' : ''}\n`);

  // 루트 페이지 접근 확인 — 연결에 공유되지 않았으면 여기서 걸린다.
  try {
    await notion.getPage(rootId);
  } catch (err) {
    console.error(
      `루트 페이지를 열 수 없습니다. 연결에 페이지가 공유됐는지 확인하세요.\n  ${err.message}`
    );
    return 1;
  }

  const index = await loadIndex(notion, rootId);
  const failures = [];

  await ensureRootNotice(notion, rootId);

  const tasks = [
    ['docs', () => syncDocs(notion, rootId, index)],
    ['curation', () => syncCuration(notion, rootId, index)],
    ['log', () => syncCommits(notion, rootId, index)],
    ['chars', () => syncCharacters(notion, rootId, index)],
  ];

  for (const [name, run] of tasks) {
    if (!wants(name)) continue;
    try {
      await run();
    } catch (err) {
      failures.push(`${name}: ${err.message}`);
      console.error(`  ✗ ${err.message}`);
    }
  }

  console.log(`\n요청 ${notion.requestCount}건`);

  if (skipped.length) {
    console.log(`\n덮어쓰지 않고 건너뛴 ${skipped.length}건: ${skipped.join(', ')}`);
    console.log('  루트 페이지에 같은 제목의 기존 페이지가 있습니다. 셋 중 하나를 고르세요:');
    console.log('   1) 전용 하위 페이지를 만들어 NOTION_PAGE_ID 로 쓰기 (권장)');
    console.log('   2) scripts/sync-notion.js 의 DOCS 에서 해당 title 을 다른 이름으로 변경');
    console.log('   3) 기존 페이지 내용을 버리고 미러로 전환 — --adopt (되돌릴 수 없음)');
  }

  if (failures.length) {
    console.error(`\n실패 ${failures.length}건:`);
    failures.forEach((f) => console.error('  ' + f));
    return 1;
  }
  console.log('동기화 완료');
  return 0;
}

/** 루트 페이지의 자식 페이지·DB를 제목으로 색인한다. */
async function loadIndex(notion, rootId) {
  const kids = await notion.listChildren(rootId);
  const pages = new Map();
  const dbs = new Map();

  for (const k of kids) {
    if (k.type === 'child_page') pages.set(k.child_page.title, k.id);
    else if (k.type === 'child_database') dbs.set(k.child_database.title, k.id);
  }
  return { pages, dbs };
}

// ── 문서 미러링 ───────────────────────────────────────────

/**
 * 자식 페이지의 본문을 블록 배열로 교체한다.
 * 내용 해시가 그대로면 건너뛴다 — 교체는 블록당 DELETE라 비용이 크다.
 */
async function mirrorPage(notion, rootId, index, { title, source, blocks, contentHash }) {
  const pageId = index.pages.get(title);

  if (pageId) {
    const first = await notion.request('GET', `/blocks/${pageId}/children?page_size=1`);
    const head = first.results?.[0];
    const marker = readMarkerHash(head);

    if (marker === contentHash && !FORCE) {
      console.log(`  = ${title} — 변경 없음`);
      return;
    }

    // 동기화 표식이 없는데 내용이 있는 페이지 = 사람이 쓴 기존 페이지다.
    // 제목만 같다는 이유로 남의 글을 지우지 않는다. (--adopt 로 명시적 인수)
    if (head && !marker && !ADOPT) {
      skipped.push(title);
      console.log(`  ! ${title} — 동기화 표식이 없는 기존 페이지. 덮어쓰지 않고 건너뜁니다`);
      return;
    }
  }

  const payload = [markerBlock(source, contentHash), ...blocks];

  if (!pageId) {
    if (DRY_RUN) {
      console.log(`  + ${title} — 새로 생성 (${payload.length} 블록)`);
      return;
    }
    // 생성 시 children은 100개까지만 함께 보낼 수 있어 나머지는 이어 붙인다.
    const created = await notion.createPage({
      parent: { type: 'page_id', page_id: rootId },
      properties: { title: pTitle(title) },
      children: payload.slice(0, 100),
    });
    await notion.appendChildren(created.id, payload.slice(100));
    index.pages.set(title, created.id);
    console.log(`  + ${title} — 생성 (${payload.length} 블록)`);
    return;
  }

  const old = await notion.listChildren(pageId);
  if (DRY_RUN) {
    console.log(`  ~ ${title} — 교체 (${old.length} → ${payload.length} 블록)`);
    return;
  }
  await notion.deleteBlocks(old.map((b) => b.id));
  await notion.appendChildren(pageId, payload);
  console.log(`  ~ ${title} — 교체 (${old.length} → ${payload.length} 블록)`);
}

async function syncDocs(notion, rootId, index) {
  console.log('문서');
  for (const { file, title } of DOCS) {
    if (!exists(file)) {
      console.log(`  ! ${title} — ${file} 없음, 건너뜀`);
      continue;
    }
    const md = readFile(file);
    await mirrorPage(notion, rootId, index, {
      title,
      source: file,
      blocks: blocksFromMarkdown(md),
      contentHash: hash12(md),
    });
  }
}

/** curation.json 은 홈 화면 구성 데이터다. 키별로 표 하나씩 렌더해 읽기용으로 둔다. */
function curationBlocks(data) {
  const blocks = [para('data/curation.json 의 읽기용 사본입니다. 편집은 repo에서 하세요.')];

  for (const [key, value] of Object.entries(data)) {
    blocks.push(heading(2, key));

    if (!Array.isArray(value) || !value.length) {
      blocks.push(para(JSON.stringify(value)));
    } else if (typeof value[0] !== 'object') {
      blocks.push(para(value.join(' · ')));
    } else {
      const cols = [...new Set(value.flatMap(Object.keys))];
      blocks.push(
        simpleTable(
          cols,
          value.map((row) => cols.map((c) => row[c]))
        )
      );
    }
  }
  return blocks;
}

async function syncCuration(notion, rootId, index) {
  const rel = 'data/curation.json';
  if (!exists(rel)) return;

  const raw = readFile(rel);
  const blocks = curationBlocks(JSON.parse(raw));

  console.log('큐레이션');
  await mirrorPage(notion, rootId, index, {
    title: PAGE_CURATION,
    source: rel,
    blocks,
    contentHash: hash12(raw),
  });
}

// ── DB 공통 ───────────────────────────────────────────────

async function ensureDatabase(notion, rootId, index, title, properties) {
  const existing = index.dbs.get(title);
  if (existing) return existing;

  if (DRY_RUN) {
    console.log(`  + DB "${title}" — 새로 생성`);
    return null;
  }

  const db = await notion.createDatabase({
    parent: { type: 'page_id', page_id: rootId },
    title: [{ type: 'text', text: { content: title } }],
    is_inline: true,
    properties,
  });
  index.dbs.set(title, db.id);
  console.log(`  + DB "${title}" — 생성`);
  return db.id;
}

/** DB의 모든 행을 특정 rich_text 속성값으로 색인한다. */
async function indexRowsBy(notion, dbId, propName) {
  const rows = await notion.queryDatabase(dbId);
  const map = new Map();
  for (const r of rows) {
    const prop = r.properties?.[propName];
    const key = (prop?.rich_text || []).map((t) => t.plain_text).join('');
    if (key) map.set(key, r.id);
  }
  return map;
}

// ── 커밋 로그 ─────────────────────────────────────────────

const COMMIT_PROPS = {
  제목: { title: {} },
  해시: { rich_text: {} },
  날짜: { date: {} },
  종류: { select: { options: COMMIT_TYPES.map((name) => ({ name })) } },
  범위: { multi_select: {} },
  작성자: { rich_text: {} },
};

/** 개별 구분자로 포맷해 커밋 본문의 줄바꿈이 파싱을 깨뜨리지 않게 한다. */
function readCommits() {
  const US = '\x1f';
  const RS = '\x1e';
  const out = git(
    `log -n ${COMMIT_LIMIT} --no-merges --format=%H${US}%ad${US}%an${US}%s${RS} --date=short`
  );
  if (!out) return [];

  return out
    .split(RS)
    .map((rec) => rec.replace(/^\s*\n?/, ''))
    .filter(Boolean)
    .map((rec) => {
      const [full, date, author, subject = ''] = rec.split(US);
      const m = subject.match(/^(\w+)(?:\(([^)]*)\))?!?:\s*(.+)$/);
      return {
        hash: full.slice(0, 7),
        date,
        author,
        type: m && COMMIT_TYPES.includes(m[1]) ? m[1] : null,
        scopes: m && m[2] ? m[2].split(/[,/]/).map((s) => s.trim()) : [],
        title: m ? m[3] : subject,
      };
    })
    .filter((c) => c.hash && c.date);
}

async function syncCommits(notion, rootId, index) {
  console.log('커밋 로그');

  const commits = readCommits();
  if (!commits.length) {
    // Actions의 기본 얕은 체크아웃(fetch-depth 1)에서 이렇게 된다.
    console.log('  ! git 이력을 읽지 못했습니다 — checkout에 fetch-depth: 0 이 필요합니다');
    return;
  }

  const dbId = await ensureDatabase(notion, rootId, index, DB_COMMITS, COMMIT_PROPS);
  if (!dbId) return;

  const known = await indexRowsBy(notion, dbId, '해시');
  const fresh = commits.filter((c) => !known.has(c.hash));

  if (!fresh.length) {
    console.log(`  = 새 커밋 없음 (기록 ${known.size}건)`);
    return;
  }

  if (DRY_RUN) {
    console.log(`  + 커밋 ${fresh.length}건 추가 예정 (기록 ${known.size}건)`);
    return;
  }

  // 커밋은 불변이라 신규 행만 만든다. 순서는 날짜 속성이 잡아주므로 병렬로 흘린다.
  await notion.mapLimit(fresh, (c) =>
    notion.createPage({
      parent: { database_id: dbId },
      properties: {
        제목: pTitle(c.title),
        해시: pText(c.hash),
        날짜: pDate(c.date),
        종류: pSelect(c.type),
        범위: pMulti(c.scopes),
        작성자: pText(c.author),
      },
    })
  );
  console.log(`  + 커밋 ${fresh.length}건 추가 (기록 ${known.size}건)`);
}

// ── 캐릭터 ────────────────────────────────────────────────

const CHAR_PROPS = {
  이름: { title: {} },
  ID: { rich_text: {} },
  상태: { select: { options: [{ name: 'active' }, { name: 'draft' }, { name: 'archived' }] } },
  역할: { rich_text: {} },
  소속: { rich_text: {} },
  태그: { multi_select: {} },
  등급: { select: {} },
  세계관: { select: {} },
  톤: { rich_text: {} },
  '평균 분량': { rich_text: {} },
  '첫 대사': { rich_text: {} },
  소유자: { rich_text: {} },
};

function readCharacters() {
  const dir = path.join(ROOT, 'prompts/characters');
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(dir, d.name, 'config.json'))
    .filter(fs.existsSync)
    .map((file) => {
      const raw = fs.readFileSync(file, 'utf-8');
      try {
        return { raw, cfg: JSON.parse(raw) };
      } catch {
        console.log(`  ! ${path.relative(ROOT, file)} — JSON 파싱 실패, 건너뜀`);
        return null;
      }
    })
    .filter((x) => x && x.cfg.id);
}

function characterBody(cfg) {
  const blocks = [];
  const { profile, description, about, notes } = cfg;

  if (profile && Object.keys(profile).length) {
    blocks.push(heading(2, '프로필'));
    blocks.push(simpleTable(['항목', '내용'], Object.entries(profile)));
  }

  const desc = [].concat(description || []).filter(Boolean);
  if (desc.length) {
    blocks.push(heading(2, '소개'));
    desc.forEach((d) => blocks.push(para(d)));
  }

  if (about?.traits?.length) {
    blocks.push(heading(2, '성격'));
    about.traits.forEach((t) =>
      blocks.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: { rich_text: [{ type: 'text', text: { content: trunc(t, 2000) } }] },
      })
    );
  }

  if (notes?.creator_note) {
    blocks.push(heading(2, '제작자 노트'));
    blocks.push({
      object: 'block',
      type: 'quote',
      quote: { rich_text: [{ type: 'text', text: { content: trunc(notes.creator_note, 2000) } }] },
    });
  }

  if (notes?.rules?.length) {
    blocks.push(heading(2, '규칙'));
    notes.rules.forEach((r) =>
      blocks.push({
        object: 'block',
        type: 'numbered_list_item',
        numbered_list_item: { rich_text: [{ type: 'text', text: { content: trunc(r, 2000) } }] },
      })
    );
  }

  return blocks;
}

async function syncCharacters(notion, rootId, index) {
  console.log('캐릭터');

  const chars = readCharacters();
  if (!chars.length) {
    console.log('  ! prompts/characters 에서 캐릭터를 찾지 못했습니다');
    return;
  }

  const dbId = await ensureDatabase(notion, rootId, index, DB_CHARS, CHAR_PROPS);
  if (!dbId) return;

  const known = await indexRowsBy(notion, dbId, 'ID');

  for (const { raw, cfg } of chars) {
    const props = {
      이름: pTitle(cfg.name || cfg.id),
      ID: pText(cfg.id),
      상태: pSelect(cfg.status),
      역할: pText(cfg.role),
      소속: pText(cfg.team),
      태그: pMulti(cfg.tags),
      등급: pSelect(cfg.rating),
      세계관: pSelect(cfg.about?.world),
      톤: pText(cfg.about?.tone),
      '평균 분량': pText(cfg.about?.avg_length),
      '첫 대사': pText(cfg.about?.opening_line),
      소유자: pText(cfg.owner_user_id || '공식'),
    };

    const rowId = known.get(cfg.id);
    const contentHash = hash12(raw);
    const payload = [
      markerBlock(`prompts/characters/${cfg.id}/config.json`, contentHash),
      ...characterBody(cfg),
    ];

    if (!rowId) {
      if (DRY_RUN) {
        console.log(`  + ${cfg.name || cfg.id} — 새로 생성`);
        continue;
      }
      const created = await notion.createPage({
        parent: { database_id: dbId },
        properties: props,
        children: payload.slice(0, 100),
      });
      await notion.appendChildren(created.id, payload.slice(100));
      console.log(`  + ${cfg.name || cfg.id} — 생성`);
      continue;
    }

    const first = await notion.request('GET', `/blocks/${rowId}/children?page_size=1`);
    const head = first.results?.[0];
    const marker = readMarkerHash(head);

    if (marker === contentHash && !FORCE) {
      console.log(`  = ${cfg.name || cfg.id} — 변경 없음`);
      continue;
    }

    // 기존 DB를 재사용한 경우, 사람이 쓴 행 본문을 지우지 않는다.
    if (head && !marker && !ADOPT) {
      skipped.push(`${DB_CHARS}/${cfg.name || cfg.id}`);
      console.log(
        `  ! ${cfg.name || cfg.id} — 동기화 표식이 없는 기존 행. 본문을 덮어쓰지 않습니다`
      );
      continue;
    }

    if (DRY_RUN) {
      console.log(`  ~ ${cfg.name || cfg.id} — 갱신`);
      continue;
    }

    await notion.updatePage(rowId, { properties: props });
    const old = await notion.listChildren(rowId);
    await notion.deleteBlocks(old.map((b) => b.id));
    await notion.appendChildren(rowId, payload);
    console.log(`  ~ ${cfg.name || cfg.id} — 갱신`);
  }
}

// ── 토큰 없는 dry-run: 변환만 검사 ────────────────────────

function convertOnlyReport() {
  console.log('NOTION_TOKEN 없음 — 변환 검사만 수행합니다.\n');

  let total = 0;
  const report = (label, blocks, source) => {
    total += blocks.length;
    console.log(`  ${label.padEnd(16)} ${String(blocks.length).padStart(4)} 블록  ← ${source}`);
  };

  if (wants('docs')) {
    for (const { file, title } of DOCS) {
      if (!exists(file)) {
        console.log(`  ! ${file} 없음`);
        continue;
      }
      report(title, blocksFromMarkdown(readFile(file)), file);
    }
  }

  if (wants('curation') && exists('data/curation.json')) {
    report(
      PAGE_CURATION,
      curationBlocks(JSON.parse(readFile('data/curation.json'))),
      'data/curation.json'
    );
  }

  const chars = wants('chars') ? readCharacters() : [];
  for (const { cfg } of chars) {
    report(cfg.name || cfg.id, characterBody(cfg), `prompts/characters/${cfg.id}/config.json`);
  }

  const commits = wants('log') ? readCommits() : [];
  console.log(`\n  커밋 ${commits.length}건, 캐릭터 ${chars.length}개, 블록 합계 ${total}개`);
  console.log('\n변환 성공 — 모든 블록 생성 경로가 예외 없이 통과했습니다.');
  return 0;
}

if (require.main === module) {
  main()
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = {
  mirrorPage,
  readMarkerHash,
  markerBlock,
  readCommits,
  readCharacters,
  curationBlocks,
  characterBody,
  DOCS,
  skipped,
};
