'use client';

// useSearchParams 사용 → Suspense boundary 필요 (ML-004).

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useUIStore } from '@/store/ui';
import { validatePassword } from '@/lib/validators';
import styles from './page.module.css';

/**
 * `/reset-password?token=<token>` — 비밀번호 재설정.
 *
 * 원본 #screen-reset-password (index.html L953~988) + app.js submitResetPassword.
 *
 * 동작:
 *   - URL의 token 파라미터 필수 — 없으면 안내 + /login 링크
 *   - 새 비밀번호 + 확인 입력 → POST /api/auth/reset-password
 *   - 성공 시 done 뷰 → "로그인하러 가기"
 */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}

function ResetPasswordInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const token = sp.get('token');
  const setAppReady = useUIStore((s) => s.setAppReady);

  const [pw, setPw] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setAppReady(true);
  }, [setAppReady]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!token) {
      setErr('유효하지 않은 링크입니다');
      return;
    }
    const pwErr = validatePassword(pw);
    if (pwErr) {
      setErr(pwErr);
      return;
    }
    if (pw !== pwConfirm) {
      setErr('비밀번호가 일치하지 않습니다');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/api/auth/reset-password', { token, password: pw });
      setDone(true);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : '비밀번호 변경에 실패했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="page-wrap">
        <div className="page-nav">
          <button
            type="button"
            className="btn-back"
            onClick={() => router.push('/login')}
            aria-label="뒤로"
          >
            ←
          </button>
          <span className="nav-label">비밀번호 재설정</span>
        </div>
        <div className="page-body">
          <div className="reset-done-box">
            <p className="reset-done-icon">✓</p>
            <p className="reset-done-title">비밀번호가 변경되었습니다</p>
            <p className="reset-done-desc">새 비밀번호로 로그인해주세요.</p>
            <button
              type="button"
              className="btn-primary"
              style={{ marginTop: 24 }}
              onClick={() => router.push('/login')}
            >
              로그인하러 가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrap">
      <div className="page-nav">
        <button
          type="button"
          className="btn-back"
          onClick={() => router.push('/login')}
          aria-label="뒤로"
        >
          ←
        </button>
        <span className="nav-label">비밀번호 재설정</span>
      </div>
      <div className="page-body">
        {!token && (
          <>
            <p className="content-header-title">유효하지 않은 링크</p>
            <p className="auth-desc">링크가 만료되었거나 잘못된 토큰입니다.</p>
            <button
              type="button"
              className="btn-primary"
              style={{ marginTop: 24 }}
              onClick={() => router.push('/login')}
            >
              로그인으로 돌아가기
            </button>
          </>
        )}
        {token && (
          <>
            <p className="content-header-title">새 비밀번호 설정</p>
            <p className="auth-desc">새로 사용할 비밀번호를 입력해주세요.</p>
            <form onSubmit={onSubmit} className={styles.form}>
              <div className="form-group">
                <label htmlFor="reset-pw-input">새 비밀번호</label>
                <input
                  id="reset-pw-input"
                  type="password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  placeholder="영문+숫자 8자 이상"
                  autoComplete="new-password"
                />
              </div>
              <div className="form-group">
                <label htmlFor="reset-pw-confirm">비밀번호 확인</label>
                <input
                  id="reset-pw-confirm"
                  type="password"
                  value={pwConfirm}
                  onChange={(e) => setPwConfirm(e.target.value)}
                  placeholder="비밀번호 재입력"
                  autoComplete="new-password"
                />
              </div>
              {err && <p className="field-error">{err}</p>}
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? '...' : '비밀번호 변경'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
