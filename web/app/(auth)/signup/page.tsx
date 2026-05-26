'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import type { User } from '@/lib/types';
import styles from '../auth.module.css';

const VALID_EMAIL    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_PASSWORD = /^(?=.*[a-zA-Z])(?=.*\d).{8,}$/;
const VALID_NICKNAME = /^[^\s!@#$%^&*()+=\[\]{};':"\\|,.<>/?`~]{2,12}$/;
const VALID_USERNAME = /^[a-z0-9_]{3,20}$/;

function SignupContent() {
  const router  = useRouter();
  const params  = useSearchParams();
  const setUser = useAuthStore((s) => s.setUser);

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [username, setUsername] = useState('');

  const [unameStatus, setUnameStatus] = useState<'idle'|'checking'|'available'|'taken'|'invalid'>('idle');
  const [unameMsg,    setUnameMsg]    = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [error,      setError]      = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const v = username.trim().toLowerCase();
    if (!v) { setUnameStatus('idle'); setUnameMsg(''); return; }
    if (!VALID_USERNAME.test(v)) {
      setUnameStatus('invalid'); setUnameMsg('영문 소문자/숫자/언더바 3~20자');
      return;
    }
    setUnameStatus('checking'); setUnameMsg('확인 중...');
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await api.get<{ available: boolean }>(`/api/auth/check-username?username=${encodeURIComponent(v)}`);
        if (data.available) { setUnameStatus('available'); setUnameMsg('사용 가능한 아이디입니다'); }
        else                { setUnameStatus('taken');     setUnameMsg('이미 사용 중인 아이디입니다'); }
      } catch {
        setUnameStatus('invalid'); setUnameMsg('확인 실패');
      }
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [username]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!VALID_EMAIL.test(email))       { setError('이메일 형식이 올바르지 않습니다'); return; }
    if (!VALID_PASSWORD.test(password)) { setError('비밀번호는 8자 이상, 영문과 숫자를 포함해야 합니다'); return; }
    if (!VALID_NICKNAME.test(nickname)) { setError('닉네임은 2~12자, 특수문자 없이 입력해주세요'); return; }
    if (unameStatus !== 'available')    { setError('@아이디를 확인해주세요'); return; }

    setSubmitting(true);
    try {
      const data = await api.post<{ user: User }>('/api/auth/register', {
        email, password, nickname, username: username.trim().toLowerCase(),
      });
      setUser(data.user);
      const redirect = params?.get('redirect');
      const dest = (redirect && redirect.startsWith('/')) ? redirect : '/';
      router.replace(dest);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '회원가입에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const feedbackClass =
    unameStatus === 'checking'  ? styles.fieldFeedbackChecking :
    unameStatus === 'available' ? styles.fieldFeedbackSuccess  :
    (unameStatus === 'taken' || unameStatus === 'invalid') ? styles.fieldFeedbackError :
    '';

  const loginHref = (() => {
    const redirect = params?.get('redirect');
    return redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : '/login';
  })();

  return (
    <main className={styles.wrap}>
      <div className={styles.nav}>
        <button className={styles.backBtn} onClick={() => router.back()}>←</button>
        <span className={styles.navLabel}>회원가입</span>
      </div>

      <h1 className={styles.title}>Folio 시작하기</h1>
      <p className={styles.subtitle}>이메일과 @아이디로 가입할 수 있어요.</p>

      <form className={styles.form} onSubmit={onSubmit}>
        <div className={styles.group}>
          <label className={styles.label}>이메일</label>
          <input className={styles.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" autoComplete="email" />
        </div>

        <div className={styles.group}>
          <label className={styles.label}>비밀번호</label>
          <input className={styles.input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8자 이상 · 영문 + 숫자" autoComplete="new-password" />
        </div>

        <div className={styles.group}>
          <label className={styles.label}>닉네임</label>
          <input className={styles.input} type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="2~12자, 특수문자 제외" maxLength={12} />
        </div>

        <div className={styles.group}>
          <label className={styles.label}>@아이디</label>
          <div className={styles.atPrefix}>
            <span>@</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              placeholder="user_id"
              maxLength={20}
              autoComplete="off"
            />
          </div>
          <p className={`${styles.fieldFeedback} ${feedbackClass}`}>{unameMsg}</p>
        </div>

        <p className={styles.globalError}>{error}</p>

        <button className={styles.submit} type="submit" disabled={submitting}>
          {submitting ? '가입 중...' : '회원가입'}
        </button>
      </form>

      <p className={styles.switchRow}>
        이미 계정이 있으신가요?{' '}
        <Link href={loginHref} className={styles.textLink}>로그인</Link>
      </p>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupContent />
    </Suspense>
  );
}
