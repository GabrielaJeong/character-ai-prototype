'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { useUIStore } from '@/store/ui';
import { api, ApiError } from '@/lib/api';
import { fmtAdminDate } from '@/lib/admin';
import type { Notification } from '@/lib/types';
import shell from '../admin.module.css';

/**
 * 어드민 알림 관리 — `/admin/notifications`.
 *
 * 원본: admin.js loadAdminNotifications/submitAdminNotif/deleteAdminNotif
 *        + routes/admin.js GET/POST/DELETE /notifications.
 *
 * 등록 폼(category/대상유저/제목/본문) + 목록(SYSTEM·NOTICE만 — social 제외).
 */
const CAT_COLOR: Record<string, string> = {
  social: '#5b8fb9',
  system: '#94a3b8',
  notice: '#f87171',
};
const CAT_LABEL: Record<string, string> = { social: 'SOCIAL', system: 'SYSTEM', notice: 'NOTICE' };

const fetcher = (p: string) => api.get<Notification[]>(p);

export default function AdminNotificationsPage() {
  const setAppReady = useUIStore((s) => s.setAppReady);
  const showToast = useUIStore((s) => s.showToast);
  const showDeleteConfirm = useUIStore((s) => s.showDeleteConfirm);
  const { data = [], mutate, isLoading } = useSWR('/api/admin/notifications', fetcher);

  const [category, setCategory] = useState<'notice' | 'system'>('notice');
  const [userId, setUserId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setAppReady(true);
  }, [setAppReady]);

  // social 제외 (원본 동일)
  const items = data.filter((n) => n.category !== 'social');

  const onSubmit = async () => {
    if (!title.trim()) {
      showToast('제목을 입력해주세요');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/api/admin/notifications', {
        category,
        title: title.trim(),
        body: body.trim() || null,
        user_id: userId.trim() ? Number(userId) : null,
      });
      showToast('알림이 등록됐습니다.');
      setTitle('');
      setBody('');
      setUserId('');
      await mutate();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : '등록 실패');
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = (n: Notification) => {
    showDeleteConfirm({
      title: '이 알림을 삭제할까요?',
      desc: `"${n.title}"`,
      confirmLabel: '삭제',
      onConfirm: async () => {
        try {
          await api.delete(`/api/admin/notifications/${n.id}`);
          await mutate();
          showToast('삭제됐습니다.');
        } catch (err) {
          showToast(err instanceof ApiError ? err.message : '삭제 실패');
        }
      },
    });
  };

  const catBadge = (cat: string) => {
    const color = CAT_COLOR[cat] || '#94a3b8';
    return (
      <span className={shell.catBadge} style={{ background: color + '26', color }}>
        {CAT_LABEL[cat] || cat}
      </span>
    );
  };

  return (
    <>
      <div className={shell.pageHeader}>
        <h1 className={shell.pageTitle}>알림 관리</h1>
      </div>

      {/* 등록 폼 */}
      <div className={`${shell.card} ${shell.cardPad}`} style={{ marginBottom: 16 }}>
        <div className={shell.cardTitle}>새 알림 등록</div>
        <div className={shell.formRow}>
          <div>
            <label className={shell.formLabel}>카테고리</label>
            <select
              className={shell.select}
              style={{ width: '100%' }}
              value={category}
              onChange={(e) => setCategory(e.target.value as 'notice' | 'system')}
            >
              <option value="notice">NOTICE · 공지</option>
              <option value="system">SYSTEM · 시스템</option>
            </select>
          </div>
          <div>
            <label className={shell.formLabel}>
              대상 유저 ID <span className={shell.dim}>(비워두면 전체 공지)</span>
            </label>
            <input
              className={shell.editInput}
              style={{ width: '100%' }}
              type="number"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="예: 3"
            />
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label className={shell.formLabel}>제목</label>
          <input
            className={shell.editInput}
            style={{ width: '100%' }}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="알림 제목"
          />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label className={shell.formLabel}>
            본문 <span className={shell.dim}>(선택)</span>
          </label>
          <textarea
            className={shell.textarea}
            style={{ marginTop: 0 }}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="알림 본문 내용"
            rows={4}
          />
        </div>
        <button className={`${shell.btn} ${shell.btnPrimary}`} onClick={onSubmit} disabled={submitting}>
          {submitting ? '...' : '등록하기'}
        </button>
      </div>

      {/* 목록 */}
      <div className={`${shell.card} ${shell.cardPad}`}>
        <div className={shell.cardTitle}>
          등록된 알림 <span className={shell.dim} style={{ fontSize: 12, fontWeight: 400 }}>(SYSTEM · NOTICE만 표시)</span>
        </div>
        <div className={shell.tableWrap}>
          <table className={shell.dataTable}>
            <thead>
              <tr>
                <th>ID</th><th>카테고리</th><th>대상</th><th>제목</th><th>본문</th><th>등록일</th><th></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={7} className={shell.dim}>불러오는 중...</td></tr>}
              {!isLoading && items.length === 0 && (
                <tr><td colSpan={7} className={shell.dim} style={{ textAlign: 'center', padding: 20 }}>등록된 알림 없음</td></tr>
              )}
              {items.map((n) => (
                <tr key={n.id}>
                  <td className={shell.dim}>{n.id}</td>
                  <td>{catBadge(n.category)}</td>
                  <td className={shell.dim}>{n.user_id ? `유저 #${n.user_id}` : '전체'}</td>
                  <td className={shell.nameCell}>{n.title}</td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {n.body || '—'}
                  </td>
                  <td className={shell.dim} style={{ whiteSpace: 'nowrap' }}>{fmtAdminDate(n.created_at)}</td>
                  <td>
                    <button className={`${shell.btn} ${shell.btnDanger} ${shell.btnXs}`} onClick={() => onDelete(n)}>삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
