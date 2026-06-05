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

// ── Moderation ───────────────────────────────────────────
export interface AdminModerationLog {
  public_id: string;
  created_at: number;
  user_id: number | null;
  user_nickname: string | null;
  character_id: string | null;
  model: string | null;
  trigger_step: number | null;
  user_input_masked: string | null;
  ai_response_summary: string | null;
  safety_status?: string | null;
  session_id?: string | null;
}
export interface AdminModerationMessage {
  role: 'user' | 'assistant' | string;
  content: string;
}
export interface AdminModerationDetail {
  log: AdminModerationLog;
  session: unknown;
  messages: AdminModerationMessage[];
  user: { nickname: string } | null;
}

/** 방어 단계 라벨/색 (원본 admin.js labels/colors) */
export const MOD_STEP_LABEL = ['', '1단계 IC거부', '2단계 OOC안내', '3단계 우회차단'];
export const MOD_STEP_COLOR = ['', '#5b8fb9', '#f0b34a', '#e05c5c'];

// ── Dashboard ────────────────────────────────────────────
export interface AdminStats {
  totalUsers: number;
  todaySessions: number;
  totalChars: number;
  modLogs7d: number;
  todayPV: number;
  todayUV: number;
  dau: number;
  mau: number;
}
export interface AdminGraphData {
  labels: string[];
  users: number[];
  sessions: number[];
  pv: number[];
  uv: number[];
  moderation: number[];
}
export type GraphPeriod = 'day' | 'week' | 'month';
