'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { useUIStore } from '@/store/ui';
import { api, ApiError } from '@/lib/api';
import type { AdminCharRow, AdminCharConfig, AdminCharDetail } from '@/lib/admin';
import shell from '../admin.module.css';

/**
 * 어드민 캐릭터 관리 — `/admin/characters`.
 *
 * 원본: admin.js loadCharacters/renderChars/openCharDetail/saveCharFields/saveCharConfigJson/
 *        saveCharSystemMd/toggleCharStatus/deleteChar + routes/admin.js /characters*.
 *
 * 목록(정렬·페이지네이션·액션) ↔ 상세(기본필드/config.json/system.md 편집, 패널 스왑).
 */
const PAGE_SIZE = 20;
type SortKey = 'name' | 'type' | 'rating' | 'status' | 'sessions';

const fetcher = (p: string) => api.get<AdminCharRow[]>(p);

export default function AdminCharactersPage() {
  const setAppReady = useUIStore((s) => s.setAppReady);
  const showToast = useUIStore((s) => s.showToast);
  const showDeleteConfirm = useUIStore((s) => s.showDeleteConfirm);
  const { data: chars = [], mutate, isLoading } = useSWR('/api/admin/characters', fetcher);

  const [sort, setSort] = useState<SortKey>('name');
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    setAppReady(true);
  }, [setAppReady]);

  const sorted = useMemo(() => {
    const arr = [...chars];
    arr.sort((a, b) => {
      let r = 0;
      if (sort === 'name') r = (a.name || '').localeCompare(b.name || '', 'ko');
      else if (sort === 'type') r = (a._isPrebuilt ? 0 : 1) - (b._isPrebuilt ? 0 : 1);
      else if (sort === 'rating') r = (a.rating || '').localeCompare(b.rating || '');
      else if (sort === 'status') r = (a.status || '').localeCompare(b.status || '');
      else if (sort === 'sessions') r = (a.sessionCount || 0) - (b.sessionCount || 0);
      return dir === 'asc' ? r : -r;
    });
    return arr;
  }, [chars, sort, dir]);

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const curPage = Math.min(page, totalPages);
  const pageRows = sorted.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);

  const onSort = (key: SortKey) => {
    if (sort === key) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSort(key);
      setDir('asc');
    }
    setPage(1);
  };
  const sortIcon = (key: SortKey) =>
    sort === key ? (
      <span className={`${shell.sortIcon} ${shell.sortIconActive}`}>{dir === 'asc' ? '▲' : '▼'}</span>
    ) : (
      <span className={shell.sortIcon}>↕</span>
    );

  const onToggleStatus = async (c: AdminCharRow) => {
    const next = c.status === 'inactive' ? 'active' : 'inactive';
    try {
      await api.patch(`/api/admin/characters/${c.id}/status`, { status: next });
      await mutate();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : '상태 변경 실패');
    }
  };

  const onDelete = (c: AdminCharRow) => {
    showDeleteConfirm({
      title: `캐릭터 "${c.name}"를 삭제할까요?`,
      desc: '캐릭터 폴더(config.json·system.md·이미지)가 삭제됩니다. 복구할 수 없습니다.',
      confirmLabel: '삭제',
      onConfirm: async () => {
        try {
          await api.delete(`/api/admin/characters/${c.id}`);
          await mutate();
          if (detailId === c.id) setDetailId(null);
          showToast('캐릭터가 삭제되었습니다.');
        } catch (err) {
          showToast(err instanceof ApiError ? err.message : '삭제 실패');
        }
      },
    });
  };

  if (detailId) {
    return (
      <CharDetail
        id={detailId}
        onBack={() => setDetailId(null)}
        onSaved={() => mutate()}
        onToggleStatus={onToggleStatus}
        onDelete={onDelete}
      />
    );
  }

  return (
    <>
      <div className={shell.pageHeader}>
        <h1 className={shell.pageTitle}>캐릭터 관리</h1>
        <span className={shell.pageSub}>{total}개</span>
      </div>

      <div className={shell.card}>
        <div className={shell.tableWrap}>
          <table className={shell.dataTable}>
            <thead>
              <tr>
                <th className={shell.sortableTh} onClick={() => onSort('name')}>이름 {sortIcon('name')}</th>
                <th className={shell.sortableTh} onClick={() => onSort('type')}>구분 {sortIcon('type')}</th>
                <th className={shell.sortableTh} onClick={() => onSort('rating')}>Rating {sortIcon('rating')}</th>
                <th className={shell.sortableTh} onClick={() => onSort('status')}>상태 {sortIcon('status')}</th>
                <th>태그</th>
                <th className={shell.sortableTh} onClick={() => onSort('sessions')}>세션 {sortIcon('sessions')}</th>
                <th>액션</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={7} className={shell.dim}>불러오는 중...</td></tr>}
              {!isLoading && pageRows.length === 0 && <tr><td colSpan={7} className={shell.dim}>캐릭터 없음</td></tr>}
              {pageRows.map((c) => (
                <tr key={c.id}>
                  <td className={shell.nameCell}>{c.name}</td>
                  <td>
                    {c._isPrebuilt ? (
                      <span className={`${shell.badge} ${shell.badgePrebuilt}`}>프리빌트</span>
                    ) : (
                      <span className={`${shell.badge} ${shell.badgeActive}`}>유저 제작</span>
                    )}
                  </td>
                  <td><span className={shell.dim}>{c.rating || '—'}</span></td>
                  <td>
                    {c.status === 'inactive' ? (
                      <span className={`${shell.badge} ${shell.badgeInactive}`}>비활성</span>
                    ) : (
                      <span className={`${shell.badge} ${shell.badgeActive}`}>활성</span>
                    )}
                  </td>
                  <td>
                    {(c.tags || []).slice(0, 3).map((t) => (
                      <span key={t} className={shell.tagDim}>#{t}</span>
                    ))}
                  </td>
                  <td>{c.sessionCount || 0}</td>
                  <td>
                    <button className={`${shell.btn} ${shell.btnGhost} ${shell.btnXs}`} onClick={() => setDetailId(c.id)}>상세</button>
                    <button className={`${shell.btn} ${shell.btnGhost} ${shell.btnXs}`} style={{ marginLeft: 4 }} onClick={() => onToggleStatus(c)}>
                      {c.status === 'inactive' ? '활성화' : '비활성화'}
                    </button>
                    <button className={`${shell.btn} ${shell.btnDanger} ${shell.btnXs}`} style={{ marginLeft: 4 }} onClick={() => onDelete(c)}>삭제</button>
                  </td>
                </tr>
              ))}
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
    </>
  );
}

// ── 상세 (기본필드 / config.json / system.md 편집) ───────────
function CharDetail({
  id,
  onBack,
  onSaved,
  onToggleStatus,
  onDelete,
}: {
  id: string;
  onBack: () => void;
  onSaved: () => void;
  onToggleStatus: (c: AdminCharRow) => void;
  onDelete: (c: AdminCharRow) => void;
}) {
  const showToast = useUIStore((s) => s.showToast);

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [fullName, setFullName] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [rating, setRating] = useState('all_ages');
  const [safetyToggle, setSafetyToggle] = useState('false');
  const [defaultSafety, setDefaultSafety] = useState('on');
  const [status, setStatus] = useState('active');
  const [badge, setBadge] = useState('');
  const [sessionCount, setSessionCount] = useState(0);
  const [configJson, setConfigJson] = useState('');
  const [systemMd, setSystemMd] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { config, system, sessionCount: sc } = await api.get<AdminCharDetail>(
        `/api/admin/characters/${id}`,
      );
      setName(config.name || '');
      setFullName(config.fullName || '');
      setSubtitle(config.subtitle || '');
      setRating(config.rating || 'all_ages');
      setSafetyToggle(config.safetyToggle ? 'true' : 'false');
      setDefaultSafety(config.defaultSafety || 'on');
      setStatus(config.status || 'active');
      setBadge((config.badge_override as string) || '');
      setSessionCount(sc);
      setConfigJson(JSON.stringify(config, null, 2));
      setSystemMd(system);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const onSaveFields = async () => {
    try {
      // 최신 config 가져와 필드만 덮어쓰기 (원본 saveCharFields)
      const { config: current } = await api.get<AdminCharDetail>(`/api/admin/characters/${id}`);
      const updated: AdminCharConfig = {
        ...current,
        name: name.trim(),
        fullName: fullName.trim(),
        subtitle: subtitle.trim(),
        rating,
        safetyToggle: safetyToggle === 'true',
        defaultSafety,
        status,
        badge_override: badge === '' ? undefined : badge,
      };
      await api.patch(`/api/admin/characters/${id}`, { config: updated });
      setConfigJson(JSON.stringify(updated, null, 2));
      showToast('필드 저장 완료');
      onSaved();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : '저장 실패');
    }
  };

  const onSaveJson = async () => {
    try {
      JSON.parse(configJson); // 유효성 검사
    } catch (e) {
      showToast('JSON 오류: ' + (e instanceof Error ? e.message : ''));
      return;
    }
    try {
      await api.patch(`/api/admin/characters/${id}`, { config: configJson });
      await load();
      showToast('config.json 저장 완료');
      onSaved();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : '저장 실패');
    }
  };

  const onSaveMd = async () => {
    try {
      await api.patch(`/api/admin/characters/${id}`, { system: systemMd });
      showToast('system.md 저장 완료');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : '저장 실패');
    }
  };

  const charRow: AdminCharRow = { id, name, status };

  return (
    <>
      <div className={shell.pageHeader}>
        <button className={`${shell.btn} ${shell.btnGhost} ${shell.btnSm}`} onClick={onBack}>← 목록</button>
        <h1 className={shell.pageTitle} style={{ marginLeft: 8 }}>{name || '캐릭터 상세'}</h1>
      </div>

      {loading ? (
        <p className={shell.dim}>불러오는 중...</p>
      ) : (
        <>
          {/* 기본 필드 편집 */}
          <div className={shell.detailSection}>
            <h3>기본 필드 편집</h3>
            <div className={shell.editGrid}>
              <label className={shell.editField}>
                <span>이름 (name)</span>
                <input className={shell.editInput} value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className={shell.editField}>
                <span>풀네임 (fullName)</span>
                <input className={shell.editInput} value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </label>
              <label className={shell.editField}>
                <span>부제목 (subtitle)</span>
                <input className={shell.editInput} value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
              </label>
              <label className={shell.editField}>
                <span>Rating</span>
                <select className={shell.select} value={rating} onChange={(e) => setRating(e.target.value)}>
                  <option value="all_ages">all_ages</option>
                  <option value="adult_only">adult_only</option>
                  <option value="toggleable">toggleable</option>
                </select>
              </label>
              <label className={shell.editField}>
                <span>Safety Toggle</span>
                <select className={shell.select} value={safetyToggle} onChange={(e) => setSafetyToggle(e.target.value)}>
                  <option value="true">ON (토글 가능)</option>
                  <option value="false">OFF (고정)</option>
                </select>
              </label>
              <label className={shell.editField}>
                <span>Default Safety</span>
                <select className={shell.select} value={defaultSafety} onChange={(e) => setDefaultSafety(e.target.value)}>
                  <option value="on">on</option>
                  <option value="off">off</option>
                </select>
              </label>
              <label className={shell.editField}>
                <span>Status</span>
                <select className={shell.select} value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                </select>
              </label>
              <label className={shell.editField}>
                <span>배지 고정 (badge_override)</span>
                <select className={shell.select} value={badge} onChange={(e) => setBadge(e.target.value)}>
                  <option value="">자동 계산</option>
                  <option value="NEW">NEW</option>
                  <option value="HOT">HOT</option>
                  <option value="UP">UP</option>
                  <option value="none">없음 (강제 숨김)</option>
                </select>
              </label>
              <label className={shell.editField}>
                <span>세션 수 (읽기 전용)</span>
                <input className={shell.editInput} value={sessionCount} disabled />
              </label>
              <label className={shell.editField}>
                <span>ID (읽기 전용)</span>
                <input className={`${shell.editInput} ${shell.mono}`} value={id} disabled />
              </label>
            </div>
            <div className={shell.actionRow}>
              <button className={`${shell.btn} ${shell.btnPrimary}`} onClick={onSaveFields}>필드 저장</button>
              <button className={`${shell.btn} ${shell.btnGhost}`} onClick={() => onToggleStatus(charRow)}>
                {status === 'inactive' ? '활성화' : '비활성화'}
              </button>
              <button className={`${shell.btn} ${shell.btnDanger}`} onClick={() => onDelete(charRow)}>캐릭터 삭제</button>
            </div>
          </div>

          {/* config.json 편집 */}
          <div className={shell.detailSection}>
            <h3>config.json 편집</h3>
            <textarea
              className={`${shell.textarea} ${shell.textareaCode}`}
              value={configJson}
              onChange={(e) => setConfigJson(e.target.value)}
              spellCheck={false}
            />
            <div className={shell.actionRow}>
              <button className={`${shell.btn} ${shell.btnPrimary}`} onClick={onSaveJson}>JSON 저장</button>
              <span className={shell.dim} style={{ fontSize: 12, alignSelf: 'center' }}>저장 시 JSON 유효성 검사 후 덮어씁니다</span>
            </div>
          </div>

          {/* system.md 편집 */}
          <div className={shell.detailSection}>
            <h3>system.md 편집</h3>
            <textarea
              className={`${shell.textarea} ${shell.textareaCode}`}
              value={systemMd}
              onChange={(e) => setSystemMd(e.target.value)}
              spellCheck={false}
            />
            <div className={shell.actionRow}>
              <button className={`${shell.btn} ${shell.btnPrimary}`} onClick={onSaveMd}>MD 저장</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
