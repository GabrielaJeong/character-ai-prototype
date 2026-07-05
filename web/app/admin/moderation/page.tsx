'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { useUIStore } from '@/store/ui';
import { api } from '@/lib/api';
import {
  MODEL_LABELS,
  MOD_STEP_LABEL,
  MOD_STEP_COLOR,
  fmtAdminDate,
  type AdminModerationLog,
  type AdminModerationDetail,
  type AdminCharRow,
} from '@/lib/admin';
import shell from '../admin.module.css';

/**
 * 어드민 콘텐츠 모더레이션 — `/admin/moderation`.
 *
 * 원본: admin.js loadModeration/openModerationDetail + routes/admin.js GET /moderation, /moderation/:publicId.
 *
 * 필터(from/to/캐릭터/단계) → 위반 로그 목록 ↔ 상세(위반정보 + 마스킹 입력/응답 + 전체 대화 컨텍스트).
 */
const charsFetcher = (p: string) => api.get<AdminCharRow[]>(p);

export default function AdminModerationPage() {
  const setAppReady = useUIStore((s) => s.setAppReady);
  const { data: chars = [] } = useSWR('/api/admin/characters', charsFetcher);

  // 필터 입력 상태
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [charId, setCharId] = useState('');
  const [step, setStep] = useState('');
  const [logs, setLogs] = useState<AdminModerationLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    setAppReady(true);
  }, [setAppReady]);

  const charName = (id: string | null) => chars.find((c) => c.id === id)?.name || id || '—';

  const runQuery = async () => {
    const p = new URLSearchParams();
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    if (charId) p.set('characterId', charId);
    if (step) p.set('triggerStep', step);
    const qs = p.toString();
    setLoading(true);
    try {
      const data = await api.get<AdminModerationLog[]>(`/api/admin/moderation${qs ? '?' + qs : ''}`);
      setLogs(data);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  // 최초 1회 자동 조회
  useEffect(() => {
    runQuery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (detailId) {
    return <ModerationDetail publicId={detailId} chars={chars} onBack={() => setDetailId(null)} />;
  }

  return (
    <>
      <div className={shell.pageHeader}>
        <h1 className={shell.pageTitle}>콘텐츠 모더레이션</h1>
      </div>

      <div className={`${shell.card} ${shell.filterBar}`} style={{ marginBottom: 16 }}>
        <label>From <input type="date" className={shell.inputSm} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>To <input type="date" className={shell.inputSm} value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <label>
          캐릭터
          <select className={shell.selectSm} value={charId} onChange={(e) => setCharId(e.target.value)}>
            <option value="">전체</option>
            {chars.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label>
          방어 단계
          <select className={shell.selectSm} value={step} onChange={(e) => setStep(e.target.value)}>
            <option value="">전체</option>
            <option value="1">1단계</option>
            <option value="2">2단계</option>
            <option value="3">3단계</option>
          </select>
        </label>
        <button className={`${shell.btn} ${shell.btnPrimary} ${shell.btnSm}`} onClick={runQuery}>조회</button>
      </div>

      <div className={shell.card}>
        <div className={shell.tableWrap}>
          <table className={shell.dataTable}>
            <thead>
              <tr>
                <th>시간</th><th>유저</th><th>캐릭터</th><th>모델</th><th>단계</th><th>유저 입력</th><th>응답 요약</th><th></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8} className={shell.dim}>불러오는 중...</td></tr>}
              {!loading && logs.length === 0 && (
                <tr><td colSpan={8} className={shell.dim} style={{ textAlign: 'center', padding: 20 }}>기록 없음</td></tr>
              )}
              {logs.map((log) => {
                const st = log.trigger_step || 0;
                return (
                  <tr key={log.public_id}>
                    <td style={{ fontSize: 12 }}>{fmtAdminDate(log.created_at)}</td>
                    <td>{log.user_nickname || <span className={shell.dim}>게스트</span>}</td>
                    <td>{charName(log.character_id)}</td>
                    <td style={{ fontSize: 12 }}>{MODEL_LABELS[log.model || ''] || log.model || '—'}</td>
                    <td>
                      <span style={{ color: MOD_STEP_COLOR[st] || 'var(--admin-text-dim)', fontWeight: 600 }}>
                        {MOD_STEP_LABEL[st] || `${st}단계`}
                      </span>
                    </td>
                    <td className={shell.dim} style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 12 }}>
                      {log.user_input_masked || '—'}
                    </td>
                    <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 12 }}>
                      {log.ai_response_summary || '—'}
                    </td>
                    <td>
                      <button className={`${shell.btn} ${shell.btnGhost} ${shell.btnXs}`} onClick={() => setDetailId(log.public_id)}>상세</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ── 상세 ────────────────────────────────────────────────
function ModerationDetail({
  publicId,
  chars,
  onBack,
}: {
  publicId: string;
  chars: AdminCharRow[];
  onBack: () => void;
}) {
  const { data, isLoading } = useSWR(`/api/admin/moderation/${publicId}`, (p: string) =>
    api.get<AdminModerationDetail>(p),
  );

  const charName = (id: string | null) => chars.find((c) => c.id === id)?.name || id || '—';

  return (
    <>
      <div className={shell.pageHeader}>
        <button className={`${shell.btn} ${shell.btnGhost} ${shell.btnSm}`} onClick={onBack}>← 목록</button>
        <h1 className={shell.pageTitle} style={{ marginLeft: 8, fontSize: 18 }}>위반 로그 상세</h1>
      </div>

      {isLoading && <p className={shell.dim}>불러오는 중...</p>}
      {!isLoading && !data && <p className={shell.dim}>로그를 찾을 수 없습니다.</p>}

      {data && (() => {
        const { log, messages, user } = data;
        const st = log.trigger_step || 0;
        return (
          <>
            <div className={shell.detailSection}>
              <h3>위반 정보</h3>
              <div className={shell.kvGrid}>
                <div><div className={shell.kvLabel}>발생 시각</div><div className={shell.kvValue}>{fmtAdminDate(log.created_at)}</div></div>
                <div><div className={shell.kvLabel}>방어 단계</div><div className={shell.kvValue}>{MOD_STEP_LABEL[st] || `${st}단계`}</div></div>
                <div><div className={shell.kvLabel}>캐릭터</div><div className={shell.kvValue}>{charName(log.character_id)}</div></div>
                <div><div className={shell.kvLabel}>모델</div><div className={shell.kvValue}>{MODEL_LABELS[log.model || ''] || log.model || '—'}</div></div>
                <div><div className={shell.kvLabel}>유저</div><div className={shell.kvValue}>{user ? user.nickname : '게스트'}</div></div>
                <div><div className={shell.kvLabel}>Safety</div><div className={shell.kvValue}>{log.safety_status || '—'}</div></div>
              </div>
            </div>
            <div className={shell.detailSection}>
              <h3>유저 입력 (마스킹)</h3>
              <pre className={shell.sysPreview}>{log.user_input_masked || '—'}</pre>
            </div>
            <div className={shell.detailSection}>
              <h3>AI 응답 요약</h3>
              <pre className={shell.sysPreview}>{log.ai_response_summary || '—'}</pre>
            </div>
            <div className={shell.detailSection}>
              <h3>세션 전체 대화 컨텍스트 ({messages.length}개 메시지)</h3>
              {messages.length === 0 ? (
                <p className={shell.dim}>메시지 없음</p>
              ) : (
                messages.map((m, i) => (
                  <div key={i}>
                    <div className={shell.msgRoleLabel}>{m.role === 'user' ? '유저' : '어시스턴트'}</div>
                    <div className={`${shell.msgBubble} ${m.role === 'user' ? shell.msgUser : shell.msgAssistant}`}>
                      {m.content}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        );
      })()}
    </>
  );
}
