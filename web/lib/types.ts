/**
 * 백엔드 (Express + SQLite) 응답과 일치하는 도메인 타입.
 *
 * 주의:
 *   - SQLite는 boolean 컬럼을 INTEGER로 저장. boolean 필드는 0 | 1 또는 number로 받음.
 *   - 일부 컬럼은 ALTER TABLE로 나중에 추가되어 null 가능.
 */

export type Rating = 'all' | 'toggleable' | 'adult_only';
export type Safety = 'on' | 'off';
export type Role   = 'user' | 'admin';

// ── User ─────────────────────────────────────────────────
// db/index.js users 테이블 + migrations 반영
export interface User {
  id: number;
  email: string;
  nickname: string;
  username: string | null;
  avatar: string | null;
  role: Role;
  public_id: string;                  // UUID v4
  default_persona_id: number | null;
  adult_content_enabled: 0 | 1;
  adult_verified: 0 | 1;
  created_at: number;
  // /api/auth/me 응답에서만 추가되는 필드
  isDemo?: boolean;
}

// ── Character ────────────────────────────────────────────
// /api/characters 응답 (config.json + 통계 + owner 정보 merge)
export interface Character {
  id: string;
  name: string;
  nameEn?: string;
  role?: string;
  team?: string;                      // 일부 캐릭터에만
  rating: Rating;
  safetyToggle?: boolean;             // false면 토글 비활성
  defaultSafety?: Safety;
  badge_override?: 'new' | 'hot' | 'up' | null;
  tags: string[];
  image?: string;                     // /images/ihwa.png 같은 경로
  about?: {
    world?: string;
    avg_length?: string;
    tone?: string;
    traits?: string[];
    opening_line?: string;
  };
  notes?: {
    creator_note?: string;
    rules?: string[];
    tip?: string;
    notes_by?: string;
    notes_date?: string;
  };
  worldbuilding?: string;             // 일부 캐릭터
  // 유저 제작 캐릭터에만
  owner_user_id?: number;
  owner_username?: string;
  is_pinned?: 0 | 1;
  // 통계 (백엔드 routes/characters.js에서 stats 객체로 반환)
  stats?: {
    sessions: number;
    bookmarks: number;
  };
  // 백엔드 계산 (badge_override 있으면 그것, 없으면 NEW/HOT/UP 자동 판정)
  badge?: 'NEW' | 'HOT' | 'UP' | null;
  // coming soon 상태
  status?: 'coming_soon' | 'active';
  // 등록 시점
  created_at?: number;
  is_active?: 0 | 1;
}

// ── Persona ──────────────────────────────────────────────
export interface PersonaData {
  name?: string;
  age?: number;
  gender?: 'male' | 'female' | null;
  appearance?: string;
  personality?: string;
  notes?: string;
  avatar?: string;
}
export interface Persona {
  id: number;
  user_id: number;
  data: PersonaData;
  created_at: number;
}

// ── Session ──────────────────────────────────────────────
export interface Session {
  id: string;                         // UUID
  character_id: string;
  safety: Safety;
  model?: string;
  persona: PersonaData;
  message_count: number;
  last_message?: string;
  created_at: number;
}

// 세션 상세 (메시지 포함)
export interface SessionDetail extends Session {
  messages: Message[];
}

// ── Message ──────────────────────────────────────────────
export interface Message {
  id?: number;
  session_id?: string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: number;
}

// ── Notification ─────────────────────────────────────────
export type NotificationCategory = 'social' | 'system' | 'notice';
export interface Notification {
  id: number;
  user_id: number | null;             // null = 전체 브로드캐스트
  category: NotificationCategory;
  title: string;
  body: string | null;
  related_id: string | null;
  created_at: number;
  is_read?: boolean;                  // join 결과
}

// ── Bookmark ─────────────────────────────────────────────
export interface Bookmark {
  id: number;
  user_id: number;
  character_id: string;
  created_at: number;
}

// ── Curation ─────────────────────────────────────────────
// /api/curation 응답 — 큐레이션 JSON 그대로
export interface Curation {
  banners?: CurationBanner[];
  editorPicks?: CurationEditorPick[];
  tagCloud?: string[];
  topCreators?: { name: string; img?: string }[];
  genres?: { name: string; img?: string; count?: number }[];
  upcoming?: { name: string; role?: string; img?: string }[];
}
export interface CurationBanner {
  title: string;
  subtitle?: string;
  img?: string;
}
export interface CurationEditorPick {
  title?: string;
  charId?: string;
  img?: string;
}

// ── Creator profile ──────────────────────────────────────
export interface CreatorProfile {
  user: Pick<User, 'public_id' | 'email' | 'nickname' | 'username' | 'avatar' | 'role' | 'created_at'>;
  characters: Character[];
}
