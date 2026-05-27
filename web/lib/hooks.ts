'use client';

import useSWR from 'swr';
import { api } from './api';
import type { Character, Notification, Curation, AppVersion, Persona, Session, SessionDetail } from './types';
import { useAuthStore } from '@/store/auth';

const fetcher = <T,>(path: string) => api.get<T>(path);

/** GET /api/characters — 서버에서 user의 adult_content_enabled 따라 필터링됨 */
export function useCharacters() {
  const { data, error, isLoading, mutate } = useSWR<Character[]>('/api/characters', fetcher);
  return { characters: data ?? [], error, isLoading, mutate };
}

/**
 * GET /api/characters/:id — 단건 캐릭터 config (필터링 없음).
 * 성인 콘텐츠 토글이 OFF여도 본인이 과거에 대화한 성인 캐릭터 세션은 열려야 하므로,
 * 세션 hydration 시 list에 없는 경우 이 endpoint로 fallback. (Codex R3 F2)
 */
export function useCharacterDetail(id: string | null) {
  const { data, error, isLoading } = useSWR<Character>(
    id ? `/api/characters/${encodeURIComponent(id)}` : null,
    fetcher,
  );
  return { character: data ?? null, error, isLoading };
}

/** GET /api/curation */
export function useCuration() {
  const { data, error, isLoading } = useSWR<Curation>('/api/curation', fetcher);
  return { curation: data, error, isLoading };
}

/**
 * GET /api/notifications — 로그인 시 본인 알림 + 브로드캐스트.
 * 응답 shape: `{ items: Notification[], unreadCount: number }` (routes/notifications.js)
 */
interface NotificationsResponse {
  items: Notification[];
  unreadCount: number;
}
export function useNotifications() {
  const { data, error, isLoading, mutate } = useSWR<NotificationsResponse>('/api/notifications', fetcher);
  return {
    notifications: data?.items ?? [],
    unreadCount: data?.unreadCount ?? 0,
    error,
    isLoading,
    mutate,
  };
}

/** 미읽음 알림 개수 (홈 헤더 벨 배지용) — 서버가 이미 계산해줌 */
export function useNotifBadgeCount() {
  const { unreadCount } = useNotifications();
  return unreadCount;
}

/**
 * GET /api/personas — 로그인 사용자의 페르소나 목록.
 * 비로그인 시 SWR 비활성 (null key → 요청 안 함).
 * 응답: Persona[] (each row has `data` already JSON-parsed by backend).
 */
export function usePersonas() {
  const user = useAuthStore((s) => s.user);
  const { data, error, isLoading, mutate } = useSWR<Persona[]>(
    user ? '/api/personas' : null,
    fetcher,
  );
  return { personas: data ?? [], error, isLoading, mutate };
}

/**
 * GET /api/sessions — 현재 user 또는 guest의 대화 세션 목록.
 * 응답: Session[] (list view: id/character_id/safety/persona/message_count/last_message/created_at).
 */
export function useSessions() {
  const ready = useAuthStore((s) => s.ready);
  const { data, error, isLoading, mutate } = useSWR<Session[]>(
    ready ? '/api/sessions' : null,
    fetcher,
  );
  return { sessions: data ?? [], error, isLoading, mutate };
}

/**
 * GET /api/sessions/:id — 단일 세션 + 전체 메시지.
 * Chat 페이지에서 `?session=<id>` 로 진입 시 hydrate에 사용.
 */
export function useSession(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<SessionDetail>(
    id ? `/api/sessions/${id}` : null,
    fetcher,
  );
  return { session: data, error, isLoading, mutate };
}

/** GET /api/version — 사이트 푸터의 버전·빌드 표기용 */
export function useAppVersion() {
  // 자주 변경 없음 → revalidate 줄이기
  const { data } = useSWR<AppVersion>('/api/version', fetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
  });
  return data?.version ?? 'v?';
}
