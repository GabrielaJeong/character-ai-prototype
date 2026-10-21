/**
 * 미러 동기화의 덮어쓰기 가드 테스트.
 *
 * 제목이 같다는 이유로 사람이 쓴 Notion 페이지를 지우는 사고를 막는 로직이라,
 * 실제 API 호출 없이 클라이언트를 흉내 내 분기만 검증한다.
 */

const { blocksFromMarkdown } = require('../../lib/notionMarkdown');

const HASH = 'a1b2c3d4e5f6';
const OTHER_HASH = '0000deadbeef';

/** 인자(--adopt 등)는 모듈 로드 시점에 읽히므로 매번 새로 require 한다. */
function loadWithArgs(args) {
  jest.resetModules();
  process.argv = ['node', 'sync-notion.js', ...args];
  return require('../../scripts/sync-notion');
}

/** firstBlock 을 첫 자식으로 돌려주는 가짜 Notion 클라이언트. */
function fakeClient(firstBlock, childCount = 3) {
  const calls = { deleted: 0, appended: 0, created: 0 };

  return {
    calls,
    request: async () => ({ results: firstBlock ? [firstBlock] : [] }),
    listChildren: async () => Array.from({ length: childCount }, (_, i) => ({ id: `b${i}` })),
    deleteBlocks: async (ids) => {
      calls.deleted += ids.length;
    },
    appendChildren: async (_id, blocks) => {
      calls.appended += blocks.length;
    },
    createPage: async () => {
      calls.created++;
      return { id: 'new-page' };
    },
  };
}

const mirrorArgs = (mod, client, index, contentHash = HASH) => [
  client,
  'root-id',
  index,
  {
    title: '업데이트 로그',
    source: 'CHANGELOG.md',
    blocks: blocksFromMarkdown('# 제목\n\n- 항목'),
    contentHash,
  },
];

describe('mirrorPage — 덮어쓰기 가드', () => {
  const ORIGINAL_ARGV = process.argv;
  afterAll(() => {
    process.argv = ORIGINAL_ARGV;
  });

  it('동기화 표식이 없는 기존 페이지는 덮어쓰지 않는다', async () => {
    const mod = loadWithArgs([]);
    const human = { type: 'paragraph', paragraph: { rich_text: [] } };
    const client = fakeClient(human);
    const index = { pages: new Map([['업데이트 로그', 'existing-page']]), dbs: new Map() };

    await mod.mirrorPage(...mirrorArgs(mod, client, index));

    expect(client.calls.deleted).toBe(0);
    expect(client.calls.appended).toBe(0);
    expect(mod.skipped).toContain('업데이트 로그');
  });

  it('--adopt 를 주면 기존 페이지를 인수해 교체한다', async () => {
    const mod = loadWithArgs(['--adopt']);
    const human = { type: 'paragraph', paragraph: { rich_text: [] } };
    const client = fakeClient(human);
    const index = { pages: new Map([['업데이트 로그', 'existing-page']]), dbs: new Map() };

    await mod.mirrorPage(...mirrorArgs(mod, client, index));

    expect(client.calls.deleted).toBe(3);
    expect(client.calls.appended).toBeGreaterThan(0);
    expect(mod.skipped).not.toContain('업데이트 로그');
  });

  it('우리가 만든 페이지이고 해시가 같으면 건너뛴다', async () => {
    const mod = loadWithArgs([]);
    const client = fakeClient(mod.markerBlock('CHANGELOG.md', HASH));
    const index = { pages: new Map([['업데이트 로그', 'our-page']]), dbs: new Map() };

    await mod.mirrorPage(...mirrorArgs(mod, client, index));

    expect(client.calls.deleted).toBe(0);
    expect(client.calls.appended).toBe(0);
    expect(mod.skipped).not.toContain('업데이트 로그');
  });

  it('우리가 만든 페이지이고 해시가 다르면 교체한다', async () => {
    const mod = loadWithArgs([]);
    const client = fakeClient(mod.markerBlock('CHANGELOG.md', OTHER_HASH));
    const index = { pages: new Map([['업데이트 로그', 'our-page']]), dbs: new Map() };

    await mod.mirrorPage(...mirrorArgs(mod, client, index));

    expect(client.calls.deleted).toBe(3);
    expect(client.calls.appended).toBeGreaterThan(0);
  });

  it('제목이 같아도 비어 있는 페이지는 그냥 쓴다', async () => {
    const mod = loadWithArgs([]);
    const client = fakeClient(null, 0);
    const index = { pages: new Map([['업데이트 로그', 'empty-page']]), dbs: new Map() };

    await mod.mirrorPage(...mirrorArgs(mod, client, index));

    expect(client.calls.appended).toBeGreaterThan(0);
    expect(mod.skipped).not.toContain('업데이트 로그');
  });

  it('페이지가 없으면 새로 만든다', async () => {
    const mod = loadWithArgs([]);
    const client = fakeClient(null, 0);
    const index = { pages: new Map(), dbs: new Map() };

    await mod.mirrorPage(...mirrorArgs(mod, client, index));

    expect(client.calls.created).toBe(1);
    expect(client.calls.deleted).toBe(0);
  });
});

describe('readMarkerHash', () => {
  it('자기가 만든 표식에서 해시를 되읽는다 (왕복)', () => {
    const mod = loadWithArgs([]);
    expect(mod.readMarkerHash(mod.markerBlock('docs/X.md', HASH))).toBe(HASH);
  });

  it('Notion 응답 형태(plain_text)에서도 읽는다', () => {
    const mod = loadWithArgs([]);
    const fromApi = {
      type: 'callout',
      callout: {
        rich_text: [{ plain_text: `⟳ repo 동기화 · docs/X.md · ${HASH} · 2026-10-21 00:00 UTC` }],
      },
    };
    expect(mod.readMarkerHash(fromApi)).toBe(HASH);
  });

  it('표식이 아닌 블록은 null', () => {
    const mod = loadWithArgs([]);
    expect(mod.readMarkerHash({ type: 'paragraph', paragraph: { rich_text: [] } })).toBeNull();
    expect(mod.readMarkerHash(null)).toBeNull();
  });
});
