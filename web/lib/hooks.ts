'use client';

import useSWR from 'swr';
import { api } from './api';
import type { Character } from './types';

const fetcher = <T,>(path: string) => api.get<T>(path);

export function useCharacters() {
  const { data, error, isLoading, mutate } = useSWR<Character[]>('/api/characters', fetcher);
  return { characters: data ?? [], error, isLoading, mutate };
}
