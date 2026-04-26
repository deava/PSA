'use client'
import { apiFetch } from '@/lib/api-config';

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { LoginForm } from "@/components/login-form"
import { DemoLoginForm } from "@/components/demo-login-form"
import { isDemoMode } from "@/lib/demo-mode"
import { isSupabaseConfigured } from "@/lib/supabase"

export default function Home() {
  const { user, userProfile, loading } = useAuth()
  const router = useRouter()
  const supabaseReady = isSupabaseConfigured()

  // First-run check: redirect to onboarding if no users exist
  const [firstRunChecked, setFirstRunChecked] = useState(false)
  const [isFirstRun, setIsFirstRun] = useState(false)

  useEffect(() => {
    if (!supabaseReady) {
      setFirstRunChecked(true)
      return
    }
    apiFetch('/api/onboarding/check-first-run')
      .then(res => res.json())
      .then(data => {
        if (data.firstRun) {
          setIsFirstRun(true)
          router.replace('/onboarding')
        }
        setFirstRunChecked(true)
      })
      .catch(() => setFirstRunChecked(true))
  }, [router, supabaseReady])

  useEffect(() => {
    if (!firstRunChecked || isFirstRun) return
    if (!loading && user && userProfile) {
      // Client users go to client portal, internal users to dashboard
      if ((userProfile as any).is_client) {
        router.push('/client-portal')
      } else {
        router.push('/dashboard')
      }
    }
  }, [user, userProfile, loading, router, firstRunChecked, isFirstRun])

  if (!firstRunChecked || isFirstRun) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (user && userProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    )
  }

  const demoMode = isDemoMode()

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--background)] grid-bg">
      <div className={demoMode ? "w-full max-w-2xl" : "max-w-md w-full"}>
        {!supabaseReady && (
          <div className="mb-6 p-4 border border-yellow-500/20 bg-yellow-500/5 rounded-lg">
            <h2 className="text-sm font-semibold text-yellow-400 mb-2">Database Not Connected</h2>
            <p className="text-sm text-yellow-400/70 mb-3">Supabase is not configured. To get started:</p>
            <ol className="text-sm text-yellow-400/70 space-y-1 list-decimal list-inside">
              <li>Copy <code className="bg-yellow-500/10 px-1 rounded text-xs">.env.local.template</code> to <code className="bg-yellow-500/10 px-1 rounded text-xs">.env.local</code></li>
              <li>Add your Supabase cloud project URL and keys</li>
              <li>Run <code className="bg-yellow-500/10 px-1 rounded text-xs">npm run dev</code></li>
            </ol>
          </div>
        )}

        {!demoMode && (
          <div className="text-center mb-2">
            <h1 className="text-3xl font-bold text-foreground mb-2">Welcome to Worklo</h1>
            <p className="text-muted-foreground">Professional Service Automation Platform</p>
          </div>
        )}

        <Suspense fallback={<div className="text-center text-muted-foreground text-sm">Loading...</div>}>
          {demoMode ? <DemoLoginForm /> : <LoginForm />}
        </Suspense>
      </div>
    </div>
  )
}
