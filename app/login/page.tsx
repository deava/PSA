'use client'
import { apiFetch } from '@/lib/api-config';

import { Suspense, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/hooks/useAuth"
import { LoginForm } from "@/components/login-form"
import { DemoLoginForm } from "@/components/demo-login-form"
import { isDemoMode } from "@/lib/demo-mode"
import { isSupabaseConfigured } from "@/lib/supabase"

export default function Page() {
  const { user, userProfile, loading } = useAuth()
  const router = useRouter()
  const supabaseReady = isSupabaseConfigured()

  // Check for first-run (no users) and redirect to onboarding
  useEffect(() => {
    if (!supabaseReady) return
    apiFetch('/api/onboarding/check-first-run')
      .then(res => res.json())
      .then(data => {
        if (data.firstRun) {
          router.replace('/onboarding')
        }
      })
      .catch(() => {})
  }, [router, supabaseReady])

  useEffect(() => {
    // Wait for auth to finish loading before checking
    if (loading) return

    // If user is already authenticated, redirect appropriately
    if (user) {
      // Client users go to client portal
      if (userProfile && (userProfile as any).is_client) {
        router.replace('/client-portal')
      } else {
        router.replace('/welcome')
      }
    }
  }, [user, userProfile, loading, router])

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10 bg-[#080B0F]">
        <div className="w-full max-w-sm text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00C2A8] mx-auto"></div>
          <p className="mt-3 text-sm text-[#8B9BB4]">Checking authentication...</p>
        </div>
      </div>
    )
  }

  // If user is authenticated, show loading while redirecting
  if (user) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10 bg-[#080B0F]">
        <div className="w-full max-w-sm text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00C2A8] mx-auto"></div>
          <p className="mt-3 text-sm text-[#8B9BB4]">Redirecting...</p>
        </div>
      </div>
    )
  }

  // User is not authenticated, show login form
  const demoMode = isDemoMode()

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10 bg-[#080B0F] grid-bg">
      <div className={demoMode ? "w-full max-w-2xl" : "w-full max-w-sm"}>
        {/* Show setup instructions when database is not configured */}
        {!supabaseReady && (
          <div className="mb-6 p-4 border border-yellow-500/20 bg-yellow-500/5 rounded-lg">
            <h2 className="text-sm font-semibold text-yellow-400 mb-2">Database Not Connected</h2>
            <p className="text-sm text-yellow-400/70 mb-3">
              Supabase is not configured. To get started:
            </p>
            <ol className="text-sm text-yellow-400/70 space-y-1 list-decimal list-inside">
              <li>Copy <code className="bg-yellow-500/10 px-1 rounded text-xs">.env.local.template</code> to <code className="bg-yellow-500/10 px-1 rounded text-xs">.env.local</code></li>
              <li>Add your Supabase cloud project URL and keys</li>
              <li>Run <code className="bg-yellow-500/10 px-1 rounded text-xs">npm run dev</code></li>
            </ol>
            <p className="text-xs text-yellow-400/50 mt-3">
              See the README for detailed setup instructions.
            </p>
          </div>
        )}

        <Suspense fallback={<div className="text-[#8B9BB4] text-sm">Loading...</div>}>
          {demoMode ? <DemoLoginForm /> : <LoginForm />}
        </Suspense>
      </div>
    </div>
  )
}
