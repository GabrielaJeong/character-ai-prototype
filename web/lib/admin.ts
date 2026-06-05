/**
 * 어드민 공유 유틸/타입.
 * 원본: public/js/admin.js (MODELS_LABEL / fmtDate) + routes/admin.js 응답 shape.
 */

/** 모델 id → 풀 라벨 (원본 admin.js MODELS_LABEL). 채팅용 lib/models.ts보다 표기가 김. */
export const MODEL_LABELS: Record<string, string> = {
  'claude-opus-4-6': 'Claude Opus 4.6',
  'claude-sonnet-4-6': 'Claude Sonnet 4.6',
  'claude-haiku-4-5-20251001': 'Claude Haiku 4.5',
  'gemini-3.1-pro-preview': 'Gemini 3.1 Pro',
  'gemini-2.5-pro': 'Gemini 2.5 Pro',
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
};

/** unix초 → 'YYYY. MM. DD. HH:MM' (원본 fmtDate, ko-KR locale) */
export function fmtAdminDate(ts: number | null | undefined): string {
  if (!ts) return '—';
  const d = new Date(ts * 1000);
  return (
    d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }) +
    ' ' +
    d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  );
}

// ── 응답 타입 (routes/admin.js) ──────────────────────────
export interface AdminUserRow {
  id: number;
  email: string;
  nickname: string;
  username: string | null;
  role: 'user' | 'admin';
  avatar: string | null;
  public_id: string;
  adult_verified: 0 | 1;
  adult_content_enabled: 0 | 1;
  created_at: number;
  session_count: number;
}

export interface AdminUserSession {
  id: string;
  character_id: string;
  model: string;
  message_count: number;
  created_at: number;
}

export interface AdminUserPersona {
  id: number;
  data: string | { name?: string; personality?: string };
}

export interface AdminUserDetail {
  user: AdminUserRow;
  sessions: AdminUserSession[];
  personas: AdminUserPersona[];
}

// ── Characters ───────────────────────────────────────────
export interface AdminCharConfig {
  id: string;
  name?: string;
  fullName?: string;
  subtitle?: string;
  rating?: string;
  safetyToggle?: boolean;
  defaultSafety?: string;
  status?: string;
  badge_override?: string | null;
  tags?: string[];
  [key: string]: unknown; // config.json은 임의 필드 허용 (JSON 직접 편집)
}
export interface AdminCharRow extends AdminCharConfig {
  _isPrebuilt?: boolean;
  sessionCount?: number;
}
export interface AdminCharDetail {
  config: AdminCharConfig;
  system: string;
  sessionCount: number;
}
