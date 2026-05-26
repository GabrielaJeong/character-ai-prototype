'use client';

import useSWR from 'swr';
import { api } from './api';
import type { Character, Notification, Curation, AppVersion } from './types';

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

/** GET /api/notifications — 로그인 시 본인 알림 + 브로드캐스트 */
export function useNotifications() {
  const { data, error, isLoading, mutate } = useSWR<Notification[]>('/api/notifications', fetcher);
  return { notifications: data ?? [], error, isLoading, mutate };
}

/** 미읽음 알림 개수 (홈 헤더 벨 배지용) */
export function useNotifBadgeCount() {
  const { notifications } = useNotifications();
  return notifications.filter((n) => !n.is_read).length;
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
