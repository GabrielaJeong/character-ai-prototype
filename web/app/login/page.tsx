'use client';

// useSearchParams 사용 → Suspense boundary 필요 (ML-004).

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { useUIStore } from '@/store/ui';
import {
  validateEmail,
  validatePassword,
  validateNickname,
  validateUsername,
  safeRedirect,
} from '@/lib/validators';
import type { User } from '@/lib/types';
import styles from './page.module.css';

/**
 * `/login?redirect=<path>` — 로그인 / 회원가입 / 비밀번호 찾기 통합 화면.
 *
 * 원본 #screen-login (index.html L869~950) + app.js submitLogin / submitRegister / submitForgotPassword.
 *
 * 뷰 전환:
 *   - 'login' (기본)
 *   - 'register' — "계정이 없으신가요?" 클릭
 *   - 'forgot'   — "비밀번호를 잊으셨나요?" 클릭
 *   - URL은 그대로 /login (state 기반 전환). AuthGate redirect 흐름과 호환.
 *
 * 성공 후 redirect:
 *   - ?redirect=<path> 우선, 없으면 '/'
 *   - safeRedirect로 open-redirect 방지
 *   - router.replace로 /login을 history에서 제거 (L-011)
 */
type View = 'login' | 'register' | 'forgot';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const redirectParam = sp.get('redirect');
  const setUser = useAuthStore((s) => s.setUser);
  const setAppReady = useUIStore((s) => s.setAppReady);
  const showToast = useUIStore((s) => s.showToast);

  const [view, setView] = useState<View>('login');

  useEffect(() => {
    setAppReady(true);
  }, [setAppReady]);

  const onSuccess = (user: User) => {
    setUser(user);
    const target = safeRedirect(redirectParam);
    router.replace(target);
  };

  return (
    <div className="page-wrap">
      <div className="page-nav">
        <button
          type="button"
          className="btn-back"
          onClick={() => router.push('/')}
          aria-label="뒤로"
        >
          ←
        </button>
        <span className="nav-label">
          {view === 'login' ? '로그인' : view === 'register' ? '회원가입' : '비밀번호 찾기'}
        </span>
      </div>
      <div className="page-body">
        {view === 'login' && (
          <LoginView
            onSuccess={onSuccess}
            onSwitchForgot={() => setView('forgot')}
            onSwitchRegister={() => setView('register')}
            showToast={showToast}
          />
        )}
        {view === 'register' && (
          <RegisterView
            onSuccess={onSuccess}
            onSwitchLogin={() => setView('login')}
            showToast={showToast}
          />
        )}
        {view === 'forgot' && (
          <ForgotView
            onSwitchLogin={() => setView('login')}
            showToast={showToast}
          />
        )}
      </div>
    </div>
  );
}

// ─── Login view ─────────────────────────────────────────
function LoginView({
  onSuccess,
  onSwitchForgot,
  onSwitchRegister,
  showToast,
}: {
  onSuccess: (u: User) => void;
  onSwitchForgot: () => void;
  onSwitchRegister: () => void;
  showToast: (m: string) => void;
}) {
  const [identifier, setIdentifier] = useState('');
  const [pw, setPw] = useState('');
  const [remember, setRemember] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!identifier.trim() || !pw) {
      setErr('이메일/아이디와 비밀번호를 모두 입력해주세요');
      return;
    }
    setSubmitting(true);
    try {
      const data = await api.post<{ user: User }>('/api/auth/login', {
        identifier: identifier.trim(),
        password: pw,
        remember,
      });
      onSuccess(data.user);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : '로그인에 실패했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <p className="content-header-title">로그인</p>
      <form onSubmit={onSubmit} className={styles.form}>
        <div className="form-group">
          <label htmlFor="login-identifier">이메일 또는 @아이디</label>
          <input
            id="login-identifier"
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="이메일 또는 @아이디"
            autoComplete="username"
            autoFocus
          />
        </div>
        <div className="form-group">
          <label htmlFor="login-pw">비밀번호</label>
          <input
            id="login-pw"
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="비밀번호"
            autoComplete="current-password"
          />
        </div>
        <label className="login-remember">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          <span>로그인 기억하기</span>
        </label>
        {err && <p className="field-error">{err}</p>}
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? '...' : '로그인'}
        </button>
      </form>
      <p className="auth-switch">
        <button type="button" className="btn-text-link" onClick={onSwitchForgot}>
          비밀번호를 잊으셨나요?
        </button>
      </p>
      <p className="auth-switch">
        계정이 없으신가요?{' '}
        <button type="button" className="btn-text-link" onClick={onSwitchRegister}>
          회원가입
        </button>
      </p>
    </>
  );
}

// ─── Register view ──────────────────────────────────────
function RegisterView({
  onSuccess,
  onSwitchLogin,
  showToast,
}: {
  onSuccess: (u: User) => void;
  onSwitchLogin: () => void;
  showToast: (m: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [nickname, setNickname] = useState('');
  const [username, setUsername] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 즉시 검증 메시지 (input 변경 시)
  const emailErr = email ? validateEmail(email) : null;
  const pwErr = pw ? validatePassword(pw) : null;
  const nickErr = nickname ? validateNickname(nickname) : null;
  const userErr = username ? validateUsername(username) : null;

  // 아이디 가용성 체크 (debounce)
  const [usernameStatus, setUsernameStatus] = useState<{
    kind: 'idle' | 'checking' | 'ok' | 'error';
    msg?: string;
  }>({ kind: 'idle' });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const lower = username.toLowerCase();
    if (!lower) {
      setUsernameStatus({ kind: 'idle' });
      return;
    }
    if (userErr) {
      setUsernameStatus({ kind: 'error', msg: userErr });
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
  }, [username, userErr]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const allErrs = [
      validateEmail(email),
      validatePassword(pw),
      validateNickname(nickname),
      validateUsername(username),
    ].filter(Boolean);
    if (allErrs.length > 0) {
      setErr(allErrs[0]);
      return;
    }
    setSubmitting(true);
    try {
      const data = await api.post<{ user: User }>('/api/auth/register', {
        email: email.trim(),
        password: pw,
        nickname: nickname.trim(),
        username: username.toLowerCase(),
      });
      showToast('가입이 완료되었습니다.');
      onSuccess(data.user);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : '회원가입에 실패했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <p className="content-header-title">회원가입</p>
      <form onSubmit={onSubmit} className={styles.form}>
        <div className="form-group">
          <label htmlFor="reg-email">이메일</label>
          <input
            id="reg-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="hello@example.com"
            autoComplete="email"
          />
          {emailErr && <p className="field-error">{emailErr}</p>}
        </div>
        <div className="form-group">
          <label htmlFor="reg-pw">비밀번호</label>
          <input
            id="reg-pw"
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="영문+숫자 8자 이상"
            autoComplete="new-password"
          />
          {pwErr && <p className="field-error">{pwErr}</p>}
        </div>
        <div className="form-group">
          <label htmlFor="reg-nick">닉네임</label>
          <input
            id="reg-nick"
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="2~12자, 특수문자 없이"
          />
          {nickErr && <p className="field-error">{nickErr}</p>}
        </div>
        <div className="form-group">
          <label htmlFor="reg-username">
            @아이디{' '}
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              영문 소문자·숫자·언더바 3~20자
            </span>
          </label>
          <div className="at-input-wrap">
            <span className="at-prefix">@</span>
            <input
              id="reg-username"
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
        {err && <p className="field-error">{err}</p>}
        <button
          type="submit"
          className="btn-primary"
          disabled={submitting || usernameStatus.kind === 'checking' || usernameStatus.kind === 'error'}
        >
          {submitting ? '...' : '가입하기'}
        </button>
      </form>
      <p className="auth-switch">
        이미 계정이 있으신가요?{' '}
        <button type="button" className="btn-text-link" onClick={onSwitchLogin}>
          로그인
        </button>
      </p>
    </>
  );
}

// ─── Forgot password view ───────────────────────────────
function ForgotView({
  onSwitchLogin,
  showToast,
}: {
  onSwitchLogin: () => void;
  showToast: (m: string) => void;
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState<{ demoToken: string | null } | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const emailErr = validateEmail(email);
    if (emailErr) {
      setErr(emailErr);
      return;
    }
    setSubmitting(true);
    try {
      // 응답에 _demo_token이 있을 수도 있고 (dev 환경), null일 수도 있음 (prod)
      const data = await api.post<{ ok: boolean; _demo_token: string | null }>(
        '/api/auth/forgot-password',
        { email: email.trim() },
      );
      setSent({ demoToken: data._demo_token });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : '요청에 실패했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <>
        <p className="content-header-title">메일을 확인해주세요</p>
        <p className="auth-desc">
          입력하신 이메일이 가입되어 있다면 비밀번호 재설정 링크가 전송됩니다.
        </p>
        {sent.demoToken && (
          <button
            type="button"
            className="btn-primary"
            style={{ marginTop: 20 }}
            onClick={() =>
              router.push(`/reset-password?token=${encodeURIComponent(sent.demoToken!)}`)
            }
          >
            (dev) 토큰으로 바로 이동
          </button>
        )}
        <p className="auth-switch">
          <button type="button" className="btn-text-link" onClick={onSwitchLogin}>
            ← 로그인으로 돌아가기
          </button>
        </p>
      </>
    );
  }

  return (
    <>
      <p className="content-header-title">비밀번호 찾기</p>
      <p className="auth-desc">가입 시 등록한 이메일을 입력해주세요.</p>
      <form onSubmit={onSubmit} className={styles.form}>
        <div className="form-group">
          <label htmlFor="forgot-email">이메일</label>
          <input
            id="forgot-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="hello@example.com"
            autoComplete="email"
            autoFocus
          />
        </div>
        {err && <p className="field-error">{err}</p>}
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? '...' : '다음'}
        </button>
      </form>
      <p className="auth-switch">
        <button type="button" className="btn-text-link" onClick={onSwitchLogin}>
          ← 로그인으로 돌아가기
        </button>
      </p>
    </>
  );
}
