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
  description?: string[];             // 단락 배열 (인트로 ABOUT 패널 하단)
  worldbuilding?: string;             // 일부 캐릭터
  recommendedPersona?: PersonaData | null;  // "추천 페르소나 채우기" 버튼 클릭 시 자동 입력
  // 캐릭터 프로필 모달용 (config.json 그대로, list 응답에 포함됨)
  fullName?: string;
  subtitle?: string;
  profile?: Record<string, string>;   // { '나이': '29세', '직업': '...' }
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
  model?: string;
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

// ── Creator profile (GET /api/creator/:username) ─────────
export interface CreatorCharacter {
  id: string;
  name: string;
  role: string;
  image: string | null;
  tags: string[];
  status?: string;
  rating?: string;
  description: string[];
  pinned: boolean;
  stats: { sessions: number; bookmarks: number };
}
export interface CreatorProfile {
  user: {
    id: number;
    username: string;
    nickname: string;
    avatar: string | null;
    public_id: string;
    created_at: number;
  };
  characters: CreatorCharacter[];
  isOwner: boolean;
}

// ── Bookmark ─────────────────────────────────────────────
export interface Bookmark {
  id: number;
  user_id: number;
  character_id: string;
  created_at: number;
}

// ── Curation ─────────────────────────────────────────────
// /api/curation 응답 — data/curation.json 그대로 (server.js 185)
export interface Curation {
  broadcast?: BroadcastItem[];
  tags?: string[];
  collections?: CollectionItem[];
  creators?: CreatorItem[];
  genres?: GenreItem[];
  upcoming?: UpcomingItem[];
}
export interface BroadcastItem {
  title: string;                       // \n 포함 가능 (HTML <br>로 치환)
  subtitle: string;
  img: string;
}
export interface CollectionItem {
  num: string;                         // "COLLECTION.07"
  title: string;
  meta: string;
  img: string;
}
export interface CreatorItem {
  handle: string;                      // "@midnight_atelier"
  count: string;                       // "12 캐릭터"
  img: string;
}
export interface GenreItem {
  label: string;                       // "OFFICE"
  title: string;                       // "오피스 로맨스"
  count: string;                       // "248 작품"
  img: string;
}
export interface UpcomingItem {
  name: string;
  role: string;
  img: string;
}

// ── App version (footer 표시용) ──────────────────────────
export interface AppVersion {
  version: string;                     // "v0.30"
}

