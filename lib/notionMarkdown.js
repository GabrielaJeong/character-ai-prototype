/**
 * lib/notionMarkdown.js
 *
 * 마크다운 → Notion 블록 변환기. repo 문서를 Notion 페이지로 미러링할 때 쓴다.
 *
 * 범위는 docs/ 와 CHANGELOG.md 에서 실제로 쓰이는 문법으로 한정했다:
 * 제목(h1~h3)·목록(중첩 포함)·체크박스·코드블록·인용·구분선·표·인라인 서식.
 * 이미지와 h4 이하는 쓰이지 않아 다루지 않는다.
 */

const { chunkPlain, RICH_TEXT_LIMIT } = require('./notion');

const MAX_TABLE_ROWS = 95; // 표 행은 children으로 들어가 append 100 상한을 공유한다
const MAX_RICH_TEXT_ITEMS = 100; // rich_text 배열 길이 상한 (Notion 제약)
const MAX_CODE_CHARS = RICH_TEXT_LIMIT * 20;

// Notion이 받는 code language 목록(일부). 여기에 없는 값을 보내면 400이 떨어진다.
const LANGS = new Set([
  'bash',
  'c',
  'c#',
  'c++',
  'css',
  'diff',
  'docker',
  'elixir',
  'go',
  'graphql',
  'groovy',
  'haskell',
  'html',
  'java',
  'javascript',
  'json',
  'kotlin',
  'less',
  'lua',
  'makefile',
  'markdown',
  'markup',
  'mermaid',
  'nix',
  'objective-c',
  'perl',
  'php',
  'plain text',
  'powershell',
  'protobuf',
  'python',
  'r',
  'ruby',
  'rust',
  'sass',
  'scala',
  'scss',
  'shell',
  'sql',
  'swift',
  'typescript',
  'vb.net',
  'xml',
  'yaml',
]);

// fence 언어 별칭 → Notion language
const LANG_ALIAS = {
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  sh: 'shell',
  zsh: 'shell',
  console: 'shell',
  ps1: 'powershell',
  py: 'python',
  rb: 'ruby',
  md: 'markdown',
  yml: 'yaml',
  dockerfile: 'docker',
  env: 'bash',
  text: 'plain text',
  txt: 'plain text',
};

// 인라인 서식 토큰. 순서가 의미를 가진다 — 코드 스팬을 먼저 집어 내부를 보호하고,
// `**` 를 `*` 보다 앞에 둔다. `_italic_` 은 지원하지 않는다(snake_case 식별자를
// 기울임으로 오인하는 사고가 문서 전반에서 발생해서다).
const INLINE_RE = new RegExp(
  [
    '(`[^`\\n]+`)', //                                 1 code
    '(\\[[^\\]\\n]*\\]\\([^)\\s]+\\))', //             2 link
    '(\\*\\*[^\\n]+?\\*\\*)', //                       3 bold
    '(~~[^\\n]+?~~)', //                               4 strikethrough
    '((?<![\\w/*])\\*(?![\\s*])[^*\\n]+?(?<!\\s)\\*)', // 5 italic — 경로 glob 오인 방지
  ].join('|'),
  'g'
);

// ── 인라인 ────────────────────────────────────────────────

function textNode(content, annotations, url) {
  const node = { type: 'text', text: { content } };
  if (url) node.text.link = { url };
  if (annotations) node.annotations = annotations;
  return node;
}

/** 마크다운 인라인 문자열 → Notion rich_text 배열. */
function richText(raw) {
  const src = String(raw ?? '');
  if (!src) return [];

  const out = [];
  let last = 0;

  const pushPlain = (s) => {
    if (s) out.push(...chunkPlain(s));
  };

  INLINE_RE.lastIndex = 0;
  for (let m; (m = INLINE_RE.exec(src)); ) {
    pushPlain(src.slice(last, m.index));
    last = m.index + m[0].length;

    const [, code, link, bold, strike, italic] = m;

    if (code) {
      out.push(textNode(code.slice(1, -1), { code: true }));
    } else if (link) {
      const cut = link.lastIndexOf('](');
      const label = link.slice(1, cut);
      const url = link.slice(cut + 2, -1);
      // 상대 경로는 Notion에서 열 수 없는 링크라 코드 서식으로 떨어뜨린다.
      if (/^(https?:|mailto:)/.test(url)) out.push(textNode(label || url, null, url));
      else out.push(textNode(label || url, { code: true }));
    } else if (bold) {
      out.push(textNode(bold.slice(2, -2), { bold: true }));
    } else if (strike) {
      out.push(textNode(strike.slice(2, -2), { strikethrough: true }));
    } else if (italic) {
      out.push(textNode(italic.slice(1, -1), { italic: true }));
    }
  }

  pushPlain(src.slice(last));
  return out.slice(0, MAX_RICH_TEXT_ITEMS);
}

// ── 블록 생성기 ───────────────────────────────────────────

const para = (text) => ({
  object: 'block',
  type: 'paragraph',
  paragraph: { rich_text: richText(text) },
});

const divider = () => ({ object: 'block', type: 'divider', divider: {} });

function heading(level, text) {
  const type = `heading_${Math.min(level, 3)}`;
  return { object: 'block', type, [type]: { rich_text: richText(text) } };
}

function listItem(type, text, checked) {
  const body = { rich_text: richText(text) };
  if (type === 'to_do') body.checked = !!checked;
  return { object: 'block', type, [type]: body };
}

function codeBlock(content, lang) {
  const raw = (lang || '').toLowerCase();
  const mapped = LANG_ALIAS[raw] || raw;
  return {
    object: 'block',
    type: 'code',
    code: {
      rich_text: chunkPlain(content.slice(0, MAX_CODE_CHARS)),
      language: LANGS.has(mapped) ? mapped : 'plain text',
    },
  };
}

const quoteBlock = (lines) => ({
  object: 'block',
  type: 'quote',
  quote: { rich_text: richText(lines.join('\n')) },
});

/** 헤더 1행 + 본문 N행을 Notion table 블록으로. */
function tableBlock(rows) {
  const width = Math.max(...rows.map((r) => r.length));
  const norm = rows.slice(0, MAX_TABLE_ROWS).map((r) => {
    const padded = r.slice(0, width);
    while (padded.length < width) padded.push('');
    return padded;
  });

  return {
    object: 'block',
    type: 'table',
    table: {
      table_width: width,
      has_column_header: true,
      has_row_header: false,
      children: norm.map((cells) => ({
        object: 'block',
        type: 'table_row',
        table_row: { cells: cells.map((c) => richText(c)) },
      })),
    },
  };
}

/** 헤더/행 배열을 바로 표로 (JSON 데이터 렌더링용 — 마크다운을 거치지 않는다). */
const simpleTable = (headers, rows) =>
  tableBlock([headers, ...rows].map((r) => r.map((c) => String(c ?? ''))));

// ── 표 파싱 ───────────────────────────────────────────────

const isTableLine = (l) => /^\s*\|/.test(l);
const isTableSep = (l) => /^\s*\|[\s:|-]+\|?\s*$/.test(l);

const splitRow = (line) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());

// ── 본 변환 ───────────────────────────────────────────────

/**
 * 마크다운 전문을 Notion 블록 배열로 변환한다.
 * 들여쓰기된 목록은 부모 항목의 children으로 중첩된다.
 */
function blocksFromMarkdown(md) {
  const lines = String(md).replace(/\r\n/g, '\n').split('\n');
  const root = [];

  let stack = []; // 들여쓰기 단계별 목록 스택 — { indent, block }
  let paraBuf = [];
  let quoteBuf = [];

  function attach(block, indent) {
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();

    const parent = stack[stack.length - 1];
    if (parent && indent > parent.indent) {
      const body = parent.block[parent.block.type];
      (body.children ||= []).push(block);
    } else {
      root.push(block);
    }
    return block;
  }

  function flushPara() {
    if (!paraBuf.length) return;
    root.push(para(paraBuf.join('\n')));
    paraBuf = [];
  }

  function flushQuote() {
    if (!quoteBuf.length) return;
    root.push(quoteBlock(quoteBuf));
    quoteBuf = [];
  }

  function flushAll() {
    flushPara();
    flushQuote();
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // HTML 주석 — CHANGELOG 상단의 동기화 마커 등. 블록으로 내보내지 않는다.
    if (trimmed.startsWith('<!--')) {
      flushAll();
      while (i < lines.length && !lines[i].includes('-->')) i++;
      continue;
    }

    // 코드블록 — fence 안쪽은 어떤 파싱도 하지 않는다.
    const fence = trimmed.match(/^`{3,}\s*(\S*)/);
    if (fence) {
      flushAll();
      stack = [];
      const body = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) body.push(lines[i++]);
      root.push(codeBlock(body.join('\n'), fence[1]));
      continue;
    }

    // 표 — 연속된 | 줄을 한 덩어리로 모은다.
    if (isTableLine(line)) {
      flushAll();
      stack = [];
      const rows = [];
      while (i < lines.length && isTableLine(lines[i])) {
        if (!isTableSep(lines[i])) rows.push(splitRow(lines[i]));
        i++;
      }
      i--;
      if (rows.length) root.push(tableBlock(rows));
      continue;
    }

    if (!trimmed) {
      flushAll();
      stack = [];
      continue;
    }

    // 구분선
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushAll();
      stack = [];
      root.push(divider());
      continue;
    }

    // 제목
    const h = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flushAll();
      stack = [];
      root.push(heading(h[1].length, h[2]));
      continue;
    }

    // 인용
    const q = trimmed.match(/^>\s?(.*)$/);
    if (q) {
      flushPara();
      stack = [];
      quoteBuf.push(q[1]);
      continue;
    }
    flushQuote();

    const indent = line.match(/^\s*/)[0].replace(/\t/g, '  ').length;

    // 체크박스 — 목록보다 먼저 검사해야 한다 ("- [ ]" 가 "- " 로도 매칭되므로).
    const todo = line.match(/^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/);
    if (todo) {
      flushPara();
      stack.push({ indent, block: attach(listItem('to_do', todo[2], todo[1] !== ' '), indent) });
      continue;
    }

    const ul = line.match(/^\s*[-*+]\s+(.*)$/);
    if (ul) {
      flushPara();
      stack.push({ indent, block: attach(listItem('bulleted_list_item', ul[1]), indent) });
      continue;
    }

    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ol) {
      flushPara();
      stack.push({ indent, block: attach(listItem('numbered_list_item', ol[1]), indent) });
      continue;
    }

    // 목록 항목에 이어지는 들여쓰인 본문은 그 항목에 흡수시킨다.
    if (indent > 0 && stack.length) {
      const top = stack[stack.length - 1];
      const body = top.block[top.block.type];
      body.rich_text = [...body.rich_text, ...richText('\n' + trimmed)].slice(
        0,
        MAX_RICH_TEXT_ITEMS
      );
      continue;
    }

    stack = [];
    paraBuf.push(trimmed);
  }

  flushAll();
  return root;
}

module.exports = {
  blocksFromMarkdown,
  richText,
  simpleTable,
  para,
  heading,
  divider,
  codeBlock,
  tableBlock,
};
