'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import type { User } from '@/lib/types';
import styles from '../auth.module.css';

function LoginContent() {
  const router       = useRouter();
  const params       = useSearchParams();
  const setUser      = useAuthStore((s) => s.setUser);

  const [identifier, setIdentifier] = useState('');
  const [password,   setPassword]   = useState('');
  const [error,      setError]      = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!identifier.trim()) { setError('이메일 또는 @아이디를 입력해주세요'); return; }
    setSubmitting(true);
    try {
      const data = await api.post<{ user: User }>('/api/auth/login', {
        identifier: identifier.trim(), password,
      });
      setUser(data.user);
      const redirect = params?.get('redirect');
      const dest = (redirect && redirect.startsWith('/')) ? redirect : '/';
      router.replace(dest);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '로그인에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const signupHref = (() => {
    const redirect = params?.get('redirect');
    return redirect ? `/signup?redirect=${encodeURIComponent(redirect)}` : '/signup';
  })();

  return (
    <main className={styles.wrap}>
      <div className={styles.nav}>
        <button className={styles.backBtn} onClick={() => router.back()}>←</button>
        <span className={styles.navLabel}>로그인</span>
      </div>

      <h1 className={styles.title}>다시 만나서 반가워요</h1>
      <p className={styles.subtitle}>이메일 또는 @아이디로 로그인하세요.</p>

      <form className={styles.form} onSubmit={onSubmit}>
        <div className={styles.group}>
          <label className={styles.label}>이메일 또는 @아이디</label>
          <input className={styles.input} type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="email@example.com 또는 @user_id" autoComplete="username" />
        </div>
        <div className={styles.group}>
          <label className={styles.label}>비밀번호</label>
          <input className={styles.input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호" autoComplete="current-password" />
        </div>

        <p className={styles.globalError}>{error}</p>

        <button className={styles.submit} type="submit" disabled={submitting}>
          {submitting ? '로그인 중...' : '로그인'}
        </button>
      </form>

      <p className={styles.switchRow} style={{ marginTop: 12 }}>
        <Link href="/reset-password" className={styles.textLink}>비밀번호를 잊으셨나요?</Link>
      </p>
      <p className={styles.switchRow}>
        계정이 없으신가요?{' '}
        <Link href={signupHref} className={styles.textLink}>회원가입</Link>
      </p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
