'use client';

import useSWR from 'swr';
import { api } from './api';
import type { Character, Notification, Curation, AppVersion, Persona } from './types';
import { useAuthStore } from '@/store/auth';

const fetcher = <T,>(path: string) => api.get<T>(path);

/** GET /api/characters — 서버에서 user의 adult_content_enabled 따라 필터링됨 */
export function useCharacters() {
  const { data, error, isLoading, mutate } = useSWR<Character[]>('/api/characters', fetcher);
  return { characters: data ?? [], error, isLoading, mutate };
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

/** GET /api/version — 사이트 푸터의 버전·빌드 표기용 */
export function useAppVersion() {
  // 자주 변경 없음 → revalidate 줄이기
  const { data } = useSWR<AppVersion>('/api/version', fetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
  });
  return data?.version ?? 'v?';
}
