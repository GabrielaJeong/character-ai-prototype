/**
 * 백엔드와 공유하는 도메인 타입.
 * Express API 응답 형태에 맞춰 작성.
 */

export type Rating = 'all' | 'toggleable' | 'adult_only';
export type Safety = 'on' | 'off';

export interface User {
  id: number;
  public_id: string;
  email: string;
  nickname: string;
  username: string | null;
  avatar: string | null;
  role: 'user' | 'admin';
  default_persona_id: number | null;
  adult_content_enabled: number; // SQLite boolean
  adult_verified: number;
  created_at: number;
  isDemo?: boolean;
}

export interface Character {
  id: string;
  name: string;
  nameEn?: string;
  role?: string;
  team?: string;
  rating: Rating;
  safetyToggle?: boolean;
  defaultSafety?: Safety;
  badge_override?: string | null;
  tags: string[];
  image?: string;
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
  owner_username?: string;
  // 통계
  session_count?: number;
  bookmark_count?: number;
}

export interface Persona {
  id: number;
  user_id: number;
  data: {
    name?: string;
    age?: number;
    gender?: 'male' | 'female' | null;
    appearance?: string;
    personality?: string;
    notes?: string;
    avatar?: string;
  };
  created_at: number;
}

export interface Session {
  id: string;
  character_id: string;
  safety: Safety;
  model?: string;
  persona: Persona['data'];
  message_count: number;
  last_message?: string;
  created_at: number;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  created_at?: number;
}

export interface Notification {
  id: number;
  user_id: number | null; // null = broadcast
  category: 'social' | 'system' | 'notice';
  title: string;
  body: string | null;
  related_id: string | null;
  created_at: number;
  is_read?: boolean;
}
