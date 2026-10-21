/**
 * lib/notion.js
 *
 * Notion REST API 얇은 클라이언트. 외부 의존성 없이 전역 fetch 사용 (Node 18+).
 *
 * 레이트리밋 대응이 이 파일의 존재 이유다. Notion은 평균 3req/s를 넘기면 429를
 * 돌려주는데, 문서 미러링은 블록 단위라 요청이 수백 건씩 나간다. 그래서 모든
 * 요청을 지수 백오프로 재시도하고, 병렬 호출은 mapLimit으로 묶어 흘린다.
 */

const API_BASE = 'https://api.notion.com/v1';
const API_VER = '2022-06-28';
const MAX_RETRY = 5;
const BASE_WAIT = 400; // ms — 429/5xx 첫 재시도 대기. 이후 2배씩 증가.

const APPEND_CHUNK = 100; // blocks/children 요청당 블록 상한 (Notion 제약)
const RICH_TEXT_LIMIT = 2000; // rich_text 하나의 content 상한 (Notion 제약)
const PAGE_SIZE = 100;

// ── 유틸 ──────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Notion 페이지 URL 또는 ID 문자열에서 대시 포함 UUID를 뽑는다.
 * "https://.../FOLIO-AI-33ffb510d64d8037af6cf4ef20b28a97" → "33ffb510-d64d-8037-af6c-f4ef20b28a97"
 */
function extractId(raw) {
  if (!raw) return null;
  const hex = String(raw).replace(/[^0-9a-fA-F]/g, '');
  if (hex.length < 32) return null;
  const id = hex.slice(-32).toLowerCase();
  return [id.slice(0, 8), id.slice(8, 12), id.slice(12, 16), id.slice(16, 20), id.slice(20)].join(
    '-'
  );
}

/** 동시 실행 수를 limit으로 묶어 순서 보장된 결과 배열을 돌려준다. */
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await fn(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/** 긴 문자열을 Notion rich_text 상한에 맞춰 잘라 rich_text 배열로 만든다. */
function chunkPlain(text, annotations) {
  const parts = [];
  for (let i = 0; i < text.length; i += RICH_TEXT_LIMIT) {
    parts.push({
      type: 'text',
      text: { content: text.slice(i, i + RICH_TEXT_LIMIT) },
      ...(annotations ? { annotations } : {}),
    });
  }
  return parts.length ? parts : [{ type: 'text', text: { content: '' } }];
}

// ── 클라이언트 ────────────────────────────────────────────

function createClient(token, { concurrency = 4, dryRun = false, log = console.log } = {}) {
  if (!token) throw new Error('NOTION_TOKEN이 없습니다');

  let requestCount = 0;

  async function request(method, path, body) {
    const url = `${API_BASE}${path}`;

    for (let attempt = 0; ; attempt++) {
      requestCount++;

      let res;
      try {
        res = await fetch(url, {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            'Notion-Version': API_VER,
            'Content-Type': 'application/json',
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
      } catch (err) {
        // 네트워크 단절 — 재시도 대상
        if (attempt >= MAX_RETRY) {
          throw new Error(`Notion 요청 실패 (${method} ${path}): ${err.message}`, { cause: err });
        }
        await sleep(BASE_WAIT * 2 ** attempt);
        continue;
      }

      if (res.ok) return res.status === 204 ? null : res.json();

      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt >= MAX_RETRY) {
        const detail = await res.text().catch(() => '');
        throw new Error(`Notion ${res.status} (${method} ${path}): ${detail.slice(0, 400)}`);
      }

      // 429는 Retry-After(초)를 주는 경우가 있다. 있으면 그 값을 따른다.
      const after = Number(res.headers.get('retry-after'));
      await sleep(Number.isFinite(after) && after > 0 ? after * 1000 : BASE_WAIT * 2 ** attempt);
    }
  }

  /** cursor 페이지네이션을 끝까지 돌려 results를 전부 모은다. */
  async function paginate(method, path, body) {
    const all = [];
    let cursor;

    do {
      const payload =
        method === 'GET'
          ? null
          : { ...(body || {}), page_size: PAGE_SIZE, ...(cursor ? { start_cursor: cursor } : {}) };
      const qs =
        method === 'GET' ? `?page_size=${PAGE_SIZE}${cursor ? `&start_cursor=${cursor}` : ''}` : '';

      const data = await request(method, `${path}${qs}`, payload);
      all.push(...(data.results || []));
      cursor = data.has_more ? data.next_cursor : null;
    } while (cursor);

    return all;
  }

  // ── 블록 ──

  const listChildren = (blockId) => paginate('GET', `/blocks/${blockId}/children`);

  /** 블록을 100개씩 끊어 순차 append. 순서가 결과물이라 병렬화하지 않는다. */
  async function appendChildren(blockId, blocks) {
    if (dryRun) return;
    for (let i = 0; i < blocks.length; i += APPEND_CHUNK) {
      await request('PATCH', `/blocks/${blockId}/children`, {
        children: blocks.slice(i, i + APPEND_CHUNK),
      });
    }
  }

  /** Notion에 블록 벌크 삭제가 없어 개별 DELETE를 병렬로 흘린다. */
  async function deleteBlocks(ids) {
    if (dryRun || !ids.length) return;
    await mapLimit(ids, concurrency, (id) => request('DELETE', `/blocks/${id}`));
  }

  // ── 페이지 ──

  const getPage = (id) => request('GET', `/pages/${id}`);
  const updatePage = (id, body) => (dryRun ? null : request('PATCH', `/pages/${id}`, body));
  const createPage = (body) => (dryRun ? { id: 'dry-run' } : request('POST', '/pages', body));
  const createDatabase = (body) =>
    dryRun ? { id: 'dry-run' } : request('POST', '/databases', body);

  const queryDatabase = (id, filter) =>
    paginate('POST', `/databases/${id}/query`, filter ? { filter } : {});

  return {
    request,
    paginate,
    listChildren,
    appendChildren,
    deleteBlocks,
    getPage,
    updatePage,
    createPage,
    createDatabase,
    queryDatabase,
    mapLimit: (items, fn) => mapLimit(items, concurrency, fn),
    get requestCount() {
      return requestCount;
    },
    dryRun,
    log,
  };
}

module.exports = { createClient, extractId, mapLimit, chunkPlain, RICH_TEXT_LIMIT, APPEND_CHUNK };
