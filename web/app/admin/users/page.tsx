'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { useUIStore } from '@/store/ui';
import { api, ApiError } from '@/lib/api';
import {
  MODEL_LABELS,
  fmtAdminDate,
  type AdminUserRow,
  type AdminUserDetail,
} from '@/lib/admin';
import shell from '../admin.module.css';

/**
 * 어드민 유저 관리 — `/admin/users`.
 *
 * 원본: admin.html users 패널 + admin.js loadUsers/renderUsers/openUserDetail/toggleRole/deleteUser
 *        + routes/admin.js GET /users, GET /users/:publicId, PATCH /users/:publicId/role, DELETE /users/:publicId.
 *
 * 목록(정렬·페이지네이션·액션) ↔ 상세(패널 스왑). 접근 보호는 middleware.
 */
const PAGE_SIZE = 20;
type SortKey = 'name' | 'date' | 'sessions' | 'role';

const fetcher = (p: string) => api.get<AdminUserRow[]>(p);

export default function AdminUsersPage() {
  const setAppReady = useUIStore((s) => s.setAppReady);
  const showToast = useUIStore((s) => s.showToast);
  const showDeleteConfirm = useUIStore((s) => s.showDeleteConfirm);
  const { data: users = [], mutate, isLoading } = useSWR('/api/admin/users', fetcher);

  const [sort, setSort] = useState<SortKey>('date');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    setAppReady(true);
  }, [setAppReady]);

  const sorted = useMemo(() => {
    const arr = [...users];
    arr.sort((a, b) => {
      let r = 0;
      if (sort === 'name') r = a.nickname.localeCompare(b.nickname, 'ko');
      else if (sort === 'date') r = a.created_at - b.created_at;
      else if (sort === 'sessions') r = a.session_count - b.session_count;
      else if (sort === 'role') r = a.role.localeCompare(b.role);
      return dir === 'asc' ? r : -r;
    });
    return arr;
  }, [users, sort, dir]);

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

  const onToggleRole = (u: AdminUserRow) => {
    const next = u.role === 'admin' ? 'user' : 'admin';
    showDeleteConfirm({
      title: `${u.nickname}의 role을 ${next}로 변경할까요?`,
      desc: next === 'admin' ? '어드민 권한을 부여합니다.' : '어드민 권한을 회수합니다.',
      confirmLabel: '변경',
      onConfirm: async () => {
        try {
          await api.patch(`/api/admin/users/${u.public_id}/role`, { role: next });
          await mutate();
          showToast(`role이 ${next}로 변경되었습니다.`);
        } catch (err) {
          showToast(err instanceof ApiError ? err.message : '변경 실패');
        }
      },
    });
  };

  const onDelete = (u: AdminUserRow) => {
    showDeleteConfirm({
      title: `"${u.nickname}"를 완전 삭제할까요?`,
      desc: '유저의 세션·페르소나 등이 함께 삭제됩니다. 복구할 수 없습니다.',
      confirmLabel: '삭제',
      onConfirm: async () => {
        try {
          await api.delete(`/api/admin/users/${u.public_id}`);
          await mutate();
          if (detailId === u.public_id) setDetailId(null);
          showToast('유저가 삭제되었습니다.');
        } catch (err) {
          showToast(err instanceof ApiError ? err.message : '삭제 실패');
        }
      },
    });
  };

  if (detailId) {
    return (
      <UserDetail
        publicId={detailId}
        onBack={() => setDetailId(null)}
        onToggleRole={onToggleRole}
        onDelete={onDelete}
      />
    );
  }

  return (
    <>
      <div className={shell.pageHeader}>
        <h1 className={shell.pageTitle}>유저 관리</h1>
        <span className={shell.pageSub}>{total}명</span>
      </div>

      <div className={shell.card}>
        <div className={shell.tableWrap}>
          <table className={shell.dataTable}>
            <thead>
              <tr>
                <th className={shell.sortableTh} onClick={() => onSort('name')}>닉네임 {sortIcon('name')}</th>
                <th>이메일</th>
                <th className={shell.sortableTh} onClick={() => onSort('date')}>가입일 {sortIcon('date')}</th>
                <th className={shell.sortableTh} onClick={() => onSort('sessions')}>세션 {sortIcon('sessions')}</th>
                <th>성인인증</th>
                <th className={shell.sortableTh} onClick={() => onSort('role')}>Role {sortIcon('role')}</th>
                <th>액션</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={7} className={shell.dim}>불러오는 중...</td></tr>
              )}
              {!isLoading && pageRows.length === 0 && (
                <tr><td colSpan={7} className={shell.dim}>유저 없음</td></tr>
              )}
              {pageRows.map((u) => (
                <tr key={u.public_id}>
                  <td className={shell.nameCell}>{u.nickname}</td>
                  <td>{u.email}</td>
                  <td>{fmtAdminDate(u.created_at)}</td>
                  <td>{u.session_count}</td>
                  <td>
                    {u.adult_verified ? (
                      <span className={`${shell.badge} ${shell.badgeActive}`}>인증됨</span>
                    ) : (
                      <span className={shell.dim}>—</span>
                    )}
                  </td>
                  <td>
                    {u.role === 'admin' ? (
                      <span className={`${shell.badge} ${shell.badgeAdmin}`}>admin</span>
                    ) : (
                      <span className={`${shell.badge} ${shell.badgeUser}`}>user</span>
                    )}
                  </td>
                  <td>
                    <button className={`${shell.btn} ${shell.btnGhost} ${shell.btnXs}`} onClick={() => setDetailId(u.public_id)}>상세</button>
                    <button className={`${shell.btn} ${shell.btnGhost} ${shell.btnXs}`} style={{ marginLeft: 4 }} onClick={() => onToggleRole(u)}>
                      {u.role === 'admin' ? '→ user' : '→ admin'}
                    </button>
                    <button className={`${shell.btn} ${shell.btnDanger} ${shell.btnXs}`} style={{ marginLeft: 4 }} onClick={() => onDelete(u)}>삭제</button>
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
              <button
                key={p}
                className={`${shell.pgBtn} ${p === curPage ? shell.pgActive : ''}`}
                onClick={() => setPage(p)}
              >
                {p}
              </button>
            ))}
            <button className={shell.pgBtn} disabled={curPage === totalPages} onClick={() => setPage(curPage + 1)}>›</button>
          </div>
        )}
      </div>
    </>
  );
}

// ── 상세 패널 ────────────────────────────────────────────
function UserDetail({
  publicId,
  onBack,
  onToggleRole,
  onDelete,
}: {
  publicId: string;
  onBack: () => void;
  onToggleRole: (u: AdminUserRow) => void;
  onDelete: (u: AdminUserRow) => void;
}) {
  const { data, isLoading } = useSWR(`/api/admin/users/${publicId}`, (p: string) =>
    api.get<AdminUserDetail>(p),
  );

  return (
    <>
      <div className={shell.pageHeader}>
        <button className={`${shell.btn} ${shell.btnGhost} ${shell.btnSm}`} onClick={onBack}>← 목록</button>
        <h1 className={shell.pageTitle} style={{ marginLeft: 8 }}>
          {data?.user.nickname ?? '유저 상세'}
        </h1>
      </div>

      {isLoading && <p className={shell.dim}>불러오는 중...</p>}
      {!isLoading && !data && <p className={shell.dim}>유저를 찾을 수 없습니다.</p>}

      {data && (
        <>
          <div className={shell.detailSection}>
            <h3>기본 정보</h3>
            <div className={shell.kvGrid}>
              <div><div className={shell.kvLabel}>이메일</div><div className={shell.kvValue}>{data.user.email}</div></div>
              <div><div className={shell.kvLabel}>가입일</div><div className={shell.kvValue}>{fmtAdminDate(data.user.created_at)}</div></div>
              <div><div className={shell.kvLabel}>Role</div><div className={shell.kvValue}>{data.user.role}</div></div>
              <div><div className={shell.kvLabel}>성인 인증</div><div className={shell.kvValue}>{data.user.adult_verified ? '완료' : '미완료'}</div></div>
              <div><div className={shell.kvLabel}>성인 콘텐츠</div><div className={shell.kvValue}>{data.user.adult_content_enabled ? 'ON' : 'OFF'}</div></div>
              <div><div className={shell.kvLabel}>Public ID</div><div className={`${shell.kvValue} ${shell.mono}`}>{data.user.public_id}</div></div>
            </div>
            <div className={shell.actionRow}>
              <button className={`${shell.btn} ${shell.btnGhost}`} onClick={() => onToggleRole(data.user)}>
                Role: {data.user.role} → {data.user.role === 'admin' ? 'user' : 'admin'}
              </button>
              <button className={`${shell.btn} ${shell.btnDanger}`} onClick={() => onDelete(data.user)}>강제 탈퇴</button>
            </div>
          </div>

          <div className={shell.detailSection}>
            <h3>세션 ({data.sessions.length}개)</h3>
            <div className={shell.tableWrap}>
              <table className={shell.dataTable}>
                <thead><tr><th>ID</th><th>캐릭터</th><th>모델</th><th>메시지</th><th>생성일</th></tr></thead>
                <tbody>
                  {data.sessions.length === 0 ? (
                    <tr><td colSpan={5} className={shell.dim}>세션 없음</td></tr>
                  ) : (
                    data.sessions.map((s) => (
                      <tr key={s.id}>
                        <td className={`${shell.nameCell} ${shell.mono}`}>{s.id.slice(0, 12)}…</td>
                        <td>{s.character_id}</td>
                        <td>{MODEL_LABELS[s.model] ?? s.model}</td>
                        <td>{s.message_count}</td>
                        <td>{fmtAdminDate(s.created_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className={shell.detailSection}>
            <h3>페르소나 ({data.personas.length}개)</h3>
            <div className={shell.tableWrap}>
              <table className={shell.dataTable}>
                <thead><tr><th>ID</th><th>이름</th><th>성격 요약</th></tr></thead>
                <tbody>
                  {data.personas.length === 0 ? (
                    <tr><td colSpan={3} className={shell.dim}>페르소나 없음</td></tr>
                  ) : (
                    data.personas.map((p) => {
                      const d = typeof p.data === 'string' ? safeParse(p.data) : p.data;
                      return (
                        <tr key={p.id}>
                          <td>{p.id}</td>
                          <td className={shell.nameCell}>{d.name || ''}</td>
                          <td>{(d.personality || '').slice(0, 60)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function safeParse(s: string): { name?: string; personality?: string } {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
