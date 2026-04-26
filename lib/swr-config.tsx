'use client'

import { SWRConfig } from 'swr'
import { ReactNode } from 'react'
import { apiUrl } from './api-config'

// Global fetcher — routes all /api/ requests to the Express backend
const fetcher = async (url: string) => {
  // Rewrite /api/... to http://localhost:4000/api/...
  const fullUrl = url.startsWith('/api/') ? apiUrl(url) : url

  // Forward auth token if available
  let headers: Record<string, string> = {}
  try {
    const { createClientSupabase } = await import('./supabase')
    const supabase = createClientSupabase()
    if (supabase) {
      const { data } = await supabase.auth.getSession()
      if (data.session?.access_token) {
        headers['Authorization'] = `Bearer ${data.session.access_token}`
      }
    }
  } catch { /* ignore */ }

  const res = await fetch(fullUrl, { headers, credentials: 'include' })

  if (!res.ok) {
    const error = new Error('An error occurred while fetching the data.')
    const info = await res.json().catch(() => ({ error: res.statusText }))
    Object.assign(error, { info, status: res.status })
    throw error
  }

  return res.json()
}

export function SWRProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        dedupingInterval: 2000,
        focusThrottleInterval: 60000,
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        revalidateIfStale: false,
        errorRetryCount: 2,
        errorRetryInterval: 5000,
        suspense: false,
        revalidateOnMount: true,
      }}
    >
      {children}
    </SWRConfig>
  )
}
