'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { useUIStore } from '@/store/ui';
import { api, ApiError } from '@/lib/api';
import {
  MODEL_LABELS,
  EVAL_MODELS,
  EVAL_ITEMS,
  EVAL_WEIGHTS,
  scoreClassKey,
  fmtAdminDate,
  type AdminEvalData,
  type AdminEvalHistoryRow,
  type AdminEvalRunResult,
  type AdminCharRow,
} from '@/lib/admin';
import shell from '../admin.module.css';

/**
 * 어드민 캐릭터 평가 — `/admin/eval`.
 *
 * 원본: admin.js loadEval/renderEvalMatrix/renderEvalHistory/runEval + routes/admin.js GET /eval, POST /eval/run.
 *
 * 좌: 평가 실행 폼 + 점수 매트릭스(캐릭터×모델) + 평가 이력(아코디언). 우: 대화 미리보기.
 * 평가 실행은 Claude/Gemini를 실제 호출(비용 발생) — 원본과 동일.
 */
const MATRIX_PAGE = 10;
const HISTORY_PAGE = 10;

const SCORE_CLASS: Record<'green' | 'orange' | 'red', string> = {
  green: shell.scoreGreen,
  orange: shell.scoreOrange,
  red: shell.scoreRed,
};

const evalFetcher = (p: string) => api.get<AdminEvalData>(p);
const charsFetcher = (p: string) => api.get<AdminCharRow[]>(p);

interface RunState {
  result: AdminEvalRunResult;
  input: string;
  charName: string;
}

export default function AdminEvalPage() {
  const setAppReady = useUIStore((s) => s.setAppReady);
  const { data, mutate } = useSWR('/api/admin/eval', evalFetcher);
  const { data: chars = [] } = useSWR('/api/admin/characters', charsFetcher);

  const [run, setRun] = useState<RunState | null>(null);

  useEffect(() => {
    setAppReady(true);
  }, [setAppReady]);

  const charName = (id: string) => chars.find((c) => c.id === id)?.name || id;

  return (
    <>
      <div className={shell.pageHeader}>
        <h1 className={shell.pageTitle}>캐릭터 평가</h1>
      </div>

      <div className={shell.evalLayout}>
        <div className={shell.evalLeft}>
          <RunCard chars={chars} onRun={setRun} onDone={() => mutate()} />
          <MatrixCard data={data} charName={charName} />
          <HistoryCard data={data} charName={charName} />
        </div>

        <div className={shell.evalRight}>
          <div className={`${shell.card} ${shell.cardPad}`}>
            <div className={shell.cardTitle}>대화 미리보기</div>
            {run ? (
              <div className={shell.evalChatLog}>
                <div className={shell.evalBubbleWrap}>
                  <div className={shell.evalBubbleLabel}>나</div>
                  <div className={`${shell.evalBubble} ${shell.evalBubbleUser}`}>{run.input}</div>
                </div>
                <div className={shell.evalBubbleWrap}>
                  <div className={shell.evalBubbleLabel}>{run.charName}</div>
                  <div className={`${shell.evalBubble} ${shell.evalBubbleChar}`}>{run.result.aiResponse}</div>
                </div>
              </div>
            ) : (
              <div className={shell.evalChatEmpty}>
                평가를 실행하면
                <br />
                실제 대화를 여기서 확인할 수 있어요
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ── 평가 실행 ────────────────────────────────────────────
function RunCard({
  chars,
  onRun,
  onDone,
}: {
  chars: AdminCharRow[];
  onRun: (r: RunState) => void;
  onDone: () => void;
}) {
  const showToast = useUIStore((s) => s.showToast);
  const [charId, setCharId] = useState('');
  const [model, setModel] = useState(EVAL_MODELS[0]);
  const [testInput, setTestInput] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AdminEvalRunResult | null>(null);

  const onSubmit = async () => {
    if (!charId || !model || !testInput.trim()) {
      showToast('캐릭터, 모델, 테스트 입력을 모두 선택/입력하세요.');
      return;
    }
    setRunning(true);
    setResult(null);
    try {
      const data = await api.post<AdminEvalRunResult>('/api/admin/eval/run', {
        characterId: charId,
        model,
        testInput: testInput.trim(),
      });
      setResult(data);
      onRun({
        result: data,
        input: testInput.trim(),
        charName: chars.find((c) => c.id === charId)?.name || '캐릭터',
      });
      onDone();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : '평가 실패');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className={`${shell.card} ${shell.cardPad}`}>
      <div className={shell.cardTitle}>평가 실행</div>
      <div className={shell.evalRunRow}>
        <select className={shell.select} value={charId} onChange={(e) => setCharId(e.target.value)}>
          <option value="">캐릭터 선택</option>
          {chars.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select className={shell.select} value={model} onChange={(e) => setModel(e.target.value)}>
          {EVAL_MODELS.map((m) => (
            <option key={m} value={m}>{MODEL_LABELS[m]}</option>
          ))}
        </select>
        <button className={`${shell.btn} ${shell.btnPrimary}`} onClick={onSubmit} disabled={running}>
          평가 실행
        </button>
      </div>
      <textarea
        className={shell.textarea}
        value={testInput}
        onChange={(e) => setTestInput(e.target.value)}
        placeholder="테스트 입력 메시지 (예: 오늘 기분 어때?)"
      />
      {running && (
        <div className={shell.evalStatus}>
          <span className={shell.spinner} /> 평가 중...
        </div>
      )}
      {result && (
        <div className={shell.evalResultBlock}>
          <div className={`${shell.evalResultScore} ${SCORE_CLASS[scoreClassKey(result.score)]}`}>
            {result.score.toFixed(1)}점
          </div>
          <div className={shell.evalResultGrid}>
            {EVAL_ITEMS.map((k) => {
              const v = result.detail[k];
              const num = typeof v === 'number' ? v : undefined;
              return (
                <div key={k} className={shell.evalResultItem}>
                  <div className={shell.itemLabel}>{k} ({EVAL_WEIGHTS[k]})</div>
                  <div className={`${shell.itemScore} ${num !== undefined ? SCORE_CLASS[scoreClassKey(num)] : ''}`}>
                    {num ?? '—'}
                  </div>
                </div>
              );
            })}
          </div>
          {result.detail['판정_이유'] && (
            <div className={shell.evalResultReason}>{String(result.detail['판정_이유'])}</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 점수 매트릭스 ────────────────────────────────────────
function MatrixCard({
  data,
  charName,
}: {
  data: AdminEvalData | undefined;
  charName: (id: string) => string;
}) {
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');
  const [sortByScore, setSortByScore] = useState(false); // false=name
  const [page, setPage] = useState(1);

  const matrix = useMemo(() => data?.matrix ?? [], [data]);

  // 최신 점수 lookup (char__model → score)
  const lookup = useMemo(() => {
    const map: Record<string, number> = {};
    const ts: Record<string, number> = {};
    for (const r of matrix) {
      const key = `${r.character_id}__${r.model}`;
      if (ts[key] === undefined || r.evaluated_at > ts[key]) {
        map[key] = r.score;
        ts[key] = r.evaluated_at;
      }
    }
    return map;
  }, [matrix]);

  const charIds = useMemo(() => {
    const ids = [...new Set(matrix.map((r) => r.character_id))];
    ids.sort((a, b) => {
      let r = 0;
      if (!sortByScore) r = charName(a).toLowerCase().localeCompare(charName(b).toLowerCase(), 'ko');
      else {
        const sa = lookup[`${a}__${EVAL_MODELS[0]}`] ?? -1;
        const sb = lookup[`${b}__${EVAL_MODELS[0]}`] ?? -1;
        r = sa - sb;
      }
      return dir === 'asc' ? r : -r;
    });
    return ids;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matrix, lookup, sortByScore, dir]);

  const total = charIds.length;
  const totalPages = Math.max(1, Math.ceil(total / MATRIX_PAGE));
  const curPage = Math.min(page, totalPages);
  const pageIds = charIds.slice((curPage - 1) * MATRIX_PAGE, curPage * MATRIX_PAGE);

  const onSortName = () => {
    if (!sortByScore) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortByScore(false);
      setDir('asc');
    }
    setPage(1);
  };

  return (
    <div className={`${shell.card} ${shell.cardPad}`}>
      <div className={shell.cardTitle}>점수 매트릭스</div>
      <div className={shell.tableWrap}>
        <table className={shell.dataTable}>
          <thead>
            <tr>
              <th className={shell.sortableTh} onClick={onSortName}>
                캐릭터 <span className={shell.sortIcon}>{!sortByScore ? (dir === 'asc' ? '▲' : '▼') : '↕'}</span>
              </th>
              {EVAL_MODELS.map((m) => (
                <th key={m} className={shell.matrixHeadCenter}>{MODEL_LABELS[m]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageIds.length === 0 && <tr><td colSpan={EVAL_MODELS.length + 1} className={shell.dim}>평가 데이터 없음</td></tr>}
            {pageIds.map((cid) => {
              const rowScores = EVAL_MODELS.map((m) => lookup[`${cid}__${m}`]).filter((v): v is number => v !== undefined);
              const rowMin = rowScores.length ? Math.min(...rowScores) : null;
              const rowMax = rowScores.length ? Math.max(...rowScores) : null;
              const single = rowScores.length <= 1 || rowMin === rowMax;
              return (
                <tr key={cid}>
                  <td className={shell.nameCell}>{charName(cid)}</td>
                  {EVAL_MODELS.map((m) => {
                    const sc = lookup[`${cid}__${m}`];
                    if (sc === undefined) return <td key={m} className={`${shell.scoreCell} ${shell.dim}`}>—</td>;
                    const cls = !single && sc === rowMax ? shell.matrixBest : !single && sc === rowMin ? shell.matrixWorst : '';
                    return <td key={m} className={`${shell.scoreCell} ${cls}`}>{sc.toFixed(1)}</td>;
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className={shell.pagination}>
          <button className={shell.pgBtn} disabled={curPage === 1} onClick={() => setPage(curPage - 1)}>‹</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button key={p} className={`${shell.pgBtn} ${p === curPage ? shell.pgActive : ''}`} onClick={() => setPage(p)}>{p}</button>
          ))}
          <button className={shell.pgBtn} disabled={curPage === totalPages} onClick={() => setPage(curPage + 1)}>›</button>
        </div>
      )}
    </div>
  );
}

// ── 평가 이력 (아코디언) ─────────────────────────────────
type HistSort = 'date' | 'char' | 'model' | 'score';

function HistoryCard({
  data,
  charName,
}: {
  data: AdminEvalData | undefined;
  charName: (id: string) => string;
}) {
  const [sort, setSort] = useState<HistSort>('date');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Set<string>>(new Set());

  const history = useMemo(() => data?.history ?? [], [data]);

  const sorted = useMemo(() => {
    const arr = [...history];
    arr.sort((a, b) => {
      let r = 0;
      if (sort === 'date') r = a.evaluated_at - b.evaluated_at;
      else if (sort === 'char') r = charName(a.character_id).toLowerCase().localeCompare(charName(b.character_id).toLowerCase(), 'ko');
      else if (sort === 'model') r = a.model.localeCompare(b.model);
      else if (sort === 'score') r = a.score - b.score;
      return dir === 'asc' ? r : -r;
    });
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, sort, dir]);

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / HISTORY_PAGE));
  const curPage = Math.min(page, totalPages);
  const pageRows = sorted.slice((curPage - 1) * HISTORY_PAGE, curPage * HISTORY_PAGE);

  const rowKey = (r: AdminEvalHistoryRow) => `${r.character_id}__${r.model}__${r.evaluated_at}`;
  const toggle = (k: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const onSort = (key: HistSort) => {
    if (sort === key) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSort(key);
      setDir(key === 'date' ? 'desc' : 'asc');
    }
    setPage(1);
  };
  const icon = (key: HistSort) => (sort === key ? (dir === 'asc' ? '▲' : '▼') : '↕');

  return (
    <div className={`${shell.card} ${shell.cardPad}`}>
      <div className={shell.cardTitle}>평가 이력</div>
      <div className={shell.tableWrap}>
        <table className={shell.dataTable}>
          <thead>
            <tr>
              <th className={shell.sortableTh} onClick={() => onSort('date')}>날짜 <span className={shell.sortIcon}>{icon('date')}</span></th>
              <th className={shell.sortableTh} onClick={() => onSort('char')}>캐릭터 <span className={shell.sortIcon}>{icon('char')}</span></th>
              <th className={shell.sortableTh} onClick={() => onSort('model')}>모델 <span className={shell.sortIcon}>{icon('model')}</span></th>
              <th className={shell.sortableTh} onClick={() => onSort('score')}>점수 <span className={shell.sortIcon}>{icon('score')}</span></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 && <tr><td colSpan={5} className={shell.dim}>이력 없음</td></tr>}
            {pageRows.map((r) => {
              const k = rowKey(r);
              const isOpen = open.has(k);
              return (
                <FragmentRow
                  key={k}
                  r={r}
                  isOpen={isOpen}
                  charName={charName(r.character_id)}
                  onToggle={() => toggle(k)}
                />
              );
            })}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className={shell.pagination}>
          <button className={shell.pgBtn} disabled={curPage === 1} onClick={() => setPage(curPage - 1)}>‹</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button key={p} className={`${shell.pgBtn} ${p === curPage ? shell.pgActive : ''}`} onClick={() => setPage(p)}>{p}</button>
          ))}
          <button className={shell.pgBtn} disabled={curPage === totalPages} onClick={() => setPage(curPage + 1)}>›</button>
        </div>
      )}
    </div>
  );
}

function FragmentRow({
  r,
  isOpen,
  charName,
  onToggle,
}: {
  r: AdminEvalHistoryRow;
  isOpen: boolean;
  charName: string;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className={`${shell.evalHistoryRow} ${isOpen ? shell.evalHistoryRowOpen : ''}`} onClick={onToggle}>
        <td>{fmtAdminDate(r.evaluated_at)}</td>
        <td>{charName}</td>
        <td>{MODEL_LABELS[r.model] || r.model}</td>
        <td><span className={`${shell.scoreCell} ${SCORE_CLASS[scoreClassKey(r.score)]}`}>{r.score.toFixed(1)}</span></td>
        <td className={shell.expandChevron}>{isOpen ? '▼' : '▶'}</td>
      </tr>
      {isOpen && (
        <tr>
          <td colSpan={5} style={{ padding: 0 }}>
            <div className={shell.evalAccordionBody}>
              <div className={shell.evalChipRow}>
                {EVAL_ITEMS.map((k) => {
                  const v = r.detail[k];
                  const num = typeof v === 'number' ? v : undefined;
                  return (
                    <div key={k} className={shell.evalChip}>
                      <div className={shell.evalChipLabel}>
                        {k}<span className={shell.evalChipWeight}>({EVAL_WEIGHTS[k]})</span>
                      </div>
                      <div className={`${shell.evalChipScore} ${num !== undefined ? SCORE_CLASS[scoreClassKey(num)] : ''}`}>
                        {num ?? '—'}
                      </div>
                    </div>
                  );
                })}
              </div>
              {r.detail['판정_이유'] && (
                <div className={shell.evalAccordionReason}>{String(r.detail['판정_이유'])}</div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
