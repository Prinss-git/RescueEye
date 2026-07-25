/**
 * Query client configuration and the app-lifecycle wiring React Native needs.
 *
 * TanStack Query's defaults assume a browser: it refetches on window focus and
 * polls regardless of whether the app is visible. On a phone that drains a
 * responder's battery for data nobody is looking at, so focus is driven from
 * AppState instead.
 */
import { AppState, type AppStateStatus, Platform } from 'react-native'
import { QueryClient, focusManager, keepPreviousData } from '@tanstack/react-query'
import { ApiError } from './client'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Field conditions mean intermittent signal is normal, not exceptional.
      // Retry transport failures, but never retry a 4xx — a 401 or 403 will
      // fail identically three more times and just delay the error.
      retry: (failureCount, error) => {
        if (error instanceof ApiError && !error.isNetworkError) return false
        return failureCount < 3
      },
      retryDelay: attempt => Math.min(1000 * 2 ** attempt, 15_000),
      staleTime: 10_000,
      // Keep showing the last known data while refetching, so the UI never
      // flashes an empty state on a poll — the old loops did this constantly.
      placeholderData: keepPreviousData,
      refetchOnReconnect: true,
    },
  },
})

/** Called once from App.tsx. Returns an unsubscribe for symmetry. */
export function wireAppStateFocus() {
  function onChange(status: AppStateStatus) {
    if (Platform.OS !== 'web') {
      focusManager.setFocused(status === 'active')
    }
  }
  const subscription = AppState.addEventListener('change', onChange)
  return () => subscription.remove()
}
