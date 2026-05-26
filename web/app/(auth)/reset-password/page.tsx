'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { useUIStore } from '@/store/ui';
import styles from '../auth.module.css';

const VALID_PASSWORD = /^(?=.*[a-zA-Z])(?=.*\d).{8,}$/;

function ResetContent() {
  const router    = useRouter();
  const params    = useSearchParams();
  const showToast = useUIStore((s) => s.showToast);
  const token     = params?.get('token') || '';

  const [email,    setEmail]    = useState('');
  const [sent,     setSent]     = useState(false);
  const [error,    setError]    = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [pw,       setPw]       = useState('');
  const [pwConfirm,setPwConfirm]= useState('');

  const submitForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) { setError('이메일을 입력해주세요'); return; }
    setSubmitting(true);
    try {
      await api.post('/api/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '요청에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!VALID_PASSWORD.test(pw))      { setError('비밀번호는 8자 이상, 영문과 숫자를 포함해야 합니다'); return; }
    if (pw !== pwConfirm)              { setError('비밀번호 확인이 일치하지 않습니다'); return; }
    setSubmitting(true);
    try {
      await api.post('/api/auth/reset-password', { token, password: pw });
      showToast('비밀번호가 변경되었습니다. 로그인해주세요.');
      router.replace('/login');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '비밀번호 변경에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (token) {
    return (
      <main className={styles.wrap}>
        <div className={styles.nav}>
          <button className={styles.backBtn} onClick={() => router.back()}>←</button>
          <span className={styles.navLabel}>비밀번호 재설정</span>
        </div>
        <h1 className={styles.title}>새 비밀번호 설정</h1>
        <p className={styles.subtitle}>새로 사용하실 비밀번호를 입력해주세요.</p>
        <form className={styles.form} onSubmit={submitReset}>
          <div className={styles.group}>
            <label className={styles.label}>새 비밀번호</label>
            <input className={styles.input} type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="8자 이상 · 영문 + 숫자" />
          </div>
          <div className={styles.group}>
            <label className={styles.label}>비밀번호 확인</label>
            <input className={styles.input} type="password" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} placeholder="다시 한 번 입력" />
          </div>
          <p className={styles.globalError}>{error}</p>
          <button className={styles.submit} type="submit" disabled={submitting}>
            {submitting ? '변경 중...' : '비밀번호 변경'}
          </button>
        </form>
      </main>
    );
  }

  if (sent) {
    return (
      <main className={styles.wrap}>
        <div className={styles.nav}>
          <button className={styles.backBtn} onClick={() => router.back()}>←</button>
          <span className={styles.navLabel}>비밀번호 찾기</span>
        </div>
        <h1 className={styles.title}>메일을 확인해주세요</h1>
        <p className={styles.subtitle}>
          입력하신 이메일로 재설정 링크를 발송했습니다.<br />
          (등록되지 않은 이메일에도 동일하게 응답합니다.)
        </p>
        <Link href="/login" className={styles.submit} style={{ textDecoration: 'none', textAlign: 'center', display: 'block' }}>
          로그인으로 돌아가기
        </Link>
      </main>
    );
  }

  return (
    <main className={styles.wrap}>
      <div className={styles.nav}>
        <button className={styles.backBtn} onClick={() => router.back()}>←</button>
        <span className={styles.navLabel}>비밀번호 찾기</span>
      </div>
      <h1 className={styles.title}>비밀번호를 잊으셨나요?</h1>
      <p className={styles.subtitle}>가입하신 이메일로 재설정 링크를 보내드릴게요.</p>
      <form className={styles.form} onSubmit={submitForgot}>
        <div className={styles.group}>
          <label className={styles.label}>이메일</label>
          <input className={styles.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" autoComplete="email" />
        </div>
        <p className={styles.globalError}>{error}</p>
        <button className={styles.submit} type="submit" disabled={submitting}>
          {submitting ? '발송 중...' : '재설정 링크 받기'}
        </button>
      </form>
      <p className={styles.switchRow}>
        <Link href="/login" className={styles.textLink}>← 로그인으로 돌아가기</Link>
      </p>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetContent />
    </Suspense>
  );
}
