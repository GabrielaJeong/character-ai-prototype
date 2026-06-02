'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { useUIStore } from '@/store/ui';
import { api, ApiError } from '@/lib/api';
import {
  validateEmail,
  validateNickname,
  validateUsername,
  validatePassword,
} from '@/lib/validators';
import type { User } from '@/lib/types';
import modal from '@/components/Modal.module.css';
import styles from './MypageInfoModal.module.css';

/**
 * 내 정보 수정 모달 (mypage 전용).
 *
 * 원본: app.js openMypageModal('info') (L4146~4192) + saveInfo + PATCH /api/auth/me.
 *
 * 필드:
 *   - 닉네임 / @아이디(username, debounced 가용성) / 이메일
 *   - 현재 비밀번호 + 새 비밀번호 (변경 시에만)
 *
 * 저장: 변경된 필드만 PATCH /api/auth/me. 성공 시 setUser + onClose.
 */
interface Props {
  onClose: () => void;
}

export function MypageInfoModal({ onClose }: Props) {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const showToast = useUIStore((s) => s.showToast);

  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // username 가용성 (변경 시에만 체크)
  const [usernameStatus, setUsernameStatus] = useState<{
    kind: 'idle' | 'checking' | 'ok' | 'error';
    msg?: string;
  }>({ kind: 'idle' });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const usernameChanged = username.toLowerCase() !== (user?.username ?? '').toLowerCase();

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const lower = username.toLowerCase();
    if (!usernameChanged) {
      setUsernameStatus({ kind: 'idle' });
      return;
    }
    const vErr = validateUsername(lower);
    if (vErr) {
      setUsernameStatus({ kind: 'error', msg: vErr });
      return;
    }
    setUsernameStatus({ kind: 'checking', msg: '확인 중...' });
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await api.get<{ available: boolean; error?: string }>(
          `/api/auth/check-username?username=${encodeURIComponent(lower)}`,
        );
        if (data.available) setUsernameStatus({ kind: 'ok', msg: '사용 가능한 아이디입니다' });
        else setUsernameStatus({ kind: 'error', msg: data.error ?? '이미 사용 중인 @아이디입니다' });
      } catch {
        setUsernameStatus({ kind: 'idle' });
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [username, usernameChanged]);

  const onSave = async () => {
    if (submitting) return;
    setErr(null);

    // 변경된 필드만 모음
    const body: Record<string, unknown> = {};
    if (nickname.trim() !== (user?.nickname ?? '')) {
      const e = validateNickname(nickname);
      if (e) return setErr(e);
      body.nickname = nickname.trim();
    }
    if (usernameChanged) {
      const e = validateUsername(username);
      if (e) return setErr(e);
      if (usernameStatus.kind === 'error') return setErr(usernameStatus.msg ?? '아이디를 확인해주세요');
      body.username = username.toLowerCase();
    }
    if (email.trim() !== (user?.email ?? '')) {
      const e = validateEmail(email);
      if (e) return setErr(e);
      body.email = email.trim();
    }
    if (newPw) {
      if (!curPw) return setErr('현재 비밀번호를 입력해주세요');
      const e = validatePassword(newPw);
      if (e) return setErr(e);
      body.currentPassword = curPw;
      body.newPassword = newPw;
    }

    if (Object.keys(body).length === 0) {
      onClose();
      return;
    }

    setSubmitting(true);
    try {
      const data = await api.patch<{ user: User }>('/api/auth/me', body);
      setUser(data.user);
      showToast('정보가 수정되었습니다.');
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : '저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className={modal.overlay}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={modal.panel} style={{ gap: 0 }}>
        <p className={modal.title} style={{ marginBottom: 16 }}>내 정보 수정</p>
        <div className={styles.form}>
          <div className="form-group">
            <label htmlFor="mp-nickname">닉네임</label>
            <input
              id="mp-nickname"
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="2~12자"
            />
          </div>
          <div className="form-group">
            <label htmlFor="mp-username">@아이디</label>
            <div className="at-input-wrap">
              <span className="at-prefix">@</span>
              <input
                id="mp-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                placeholder="my_username"
                autoComplete="off"
              />
            </div>
            {usernameStatus.kind !== 'idle' && (
              <p className={`field-feedback ${usernameStatus.kind}`}>{usernameStatus.msg}</p>
            )}
          </div>
          <div className="form-group">
            <label htmlFor="mp-email">이메일</label>
            <input
              id="mp-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <hr className={styles.divider} />
          <div className="form-group">
            <label htmlFor="mp-cur-pw">현재 비밀번호</label>
            <input
              id="mp-cur-pw"
              type="password"
              value={curPw}
              onChange={(e) => setCurPw(e.target.value)}
              placeholder="비밀번호 변경 시 입력"
              autoComplete="current-password"
            />
          </div>
          <div className="form-group">
            <label htmlFor="mp-new-pw">새 비밀번호</label>
            <input
              id="mp-new-pw"
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="영문+숫자 8자 이상 (변경 시에만)"
              autoComplete="new-password"
            />
          </div>
          {err && <p className="field-error">{err}</p>}
        </div>
        <div className={modal.actions} style={{ marginTop: 20 }}>
          <button type="button" className={modal.btnGhost} onClick={onClose}>
            취소
          </button>
          <button type="button" className={modal.btnPrimary} onClick={onSave} disabled={submitting}>
            {submitting ? '...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
