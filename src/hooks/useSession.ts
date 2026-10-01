'use client';

import useSWR from 'swr';

export interface SessionUser {
  email: string;
  role: 'admin' | 'viewer';
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

export function useSession() {
  const { data, isLoading, mutate } = useSWR<{ user: SessionUser | null }>('/api/auth/me', fetcher, {
    revalidateOnFocus: false,
  });
  return { user: data?.user ?? null, isLoading, mutate };
}
