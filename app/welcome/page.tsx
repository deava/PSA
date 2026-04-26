'use client'

import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { isUnassigned, isSuperadmin, hasPermission } from '@/lib/rbac'
import { Permission } from '@/lib/permissions'
import dynamic from 'next/dynamic'
import {
  CheckCircle,
  Clock,
  Users,
  Building2,
  Mail,
  Phone,
  MapPin,
  ArrowRight,
  Shield,
} from 'lucide-react'

const ProjectUpdatesCard = dynamic(
  () => import('@/components/project-updates-card'),
  {
    loading: () => (
      <div className="w-full rounded-xl border border-white/8 bg-card p-8 text-center">
        <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary mx-auto" />
        <p className="mt-3 text-sm text-muted-foreground">Loading updates...</p>
      </div>
    ),
    ssr: false,
  }
)

const NewsletterCard = dynamic(
  () => import('@/components/newsletter-card'),
  { loading: () => null, ssr: false }
)

export default function WelcomePage() {
  const { user, userProfile, loading } = useAuth()
  const router = useRouter()

  const userIsUnassigned = userProfile ? isUnassigned(userProfile) : false
  const isSuperadminUser = userProfile ? isSuperadmin(userProfile) : false
  const hasRoles = userProfile ? !userIsUnassigned : false
  const [canViewNewsletters, setCanViewNewsletters] = useState(false)

  useEffect(() => {
    if (!userProfile) { setCanViewNewsletters(false); return }
    hasPermission(userProfile, Permission.VIEW_NEWSLETTERS).then(setCanViewNewsletters)
  }, [userProfile])

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (!loading && userProfile && (userProfile as any).is_client) router.replace('/client-portal')
  }, [loading, userProfile, router])

  const isAccountCreated = !!user
  const isEmailVerified = !!(user as any)?.email_confirmed_at
  const isRoleAssigned = hasRoles
  const isSetupComplete = isAccountCreated && isEmailVerified && isRoleAssigned
  const isActuallyUnassigned = userProfile ? isUnassigned(userProfile) : false

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Welcome to Worklo</h1>
            <p className="text-muted-foreground">Please log in to access your account</p>
          </div>
          <Button onClick={() => router.push('/login')} className="w-full max-w-xs">
            Sign In
          </Button>
          <p className="text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <button onClick={() => router.push('/signup')} className="text-primary hover:text-primary/80 transition-colors">
              Sign up here
            </button>
          </p>
        </div>
      </div>
    )
  }

  /* ── Unassigned user view ── */
  if (!loading && userProfile && isActuallyUnassigned) {
    return (
      <div className="space-y-8 mt-8 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
        {/* Greeting */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground">
            {(userProfile as any)?.name ? `Hello, ${(userProfile as any).name}` : 'Welcome to Worklo'}
          </h1>
          <p className="text-muted-foreground">Your account is being set up</p>
        </div>

        {/* Status steps */}
        <div className="rounded-xl border border-white/8 bg-card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-4">Account Status</h2>
          {[
            { label: 'Account Created', done: isAccountCreated },
            { label: 'Email Verified', done: isEmailVerified },
            { label: 'Role Assignment', done: false, pending: true },
          ].map((step) => (
            <div key={step.label} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
              <span className="text-sm font-medium text-foreground">{step.label}</span>
              {step.done ? (
                <CheckCircle className="w-5 h-5 text-primary" />
              ) : (
                <span className="text-xs font-semibold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-full">
                  Pending
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Pending notice */}
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-6 space-y-4">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-foreground mb-1">Role Assignment Pending</h3>
              <p className="text-sm text-muted-foreground">
                Your account is awaiting role assignment
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Welcome to Worklo! Your account has been created successfully, but you haven&apos;t been
            assigned a role yet. An administrator will review your account and assign you to the
            appropriate role and department.
          </p>
          <div className="rounded-lg border border-white/8 bg-card/3 p-4">
            <p className="text-sm font-medium text-foreground mb-2">While you wait:</p>
            <ul className="text-sm text-muted-foreground space-y-1.5">
              <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-primary flex-shrink-0" />You can view and edit your profile</li>
              <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-primary flex-shrink-0" />Check back later for updates</li>
              <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-primary flex-shrink-0" />Contact an administrator if you need immediate access</li>
            </ul>
          </div>
        </div>

        <div className="text-center">
          <Button onClick={() => router.push('/profile')} variant="outline" className="inline-flex items-center gap-2">
            View Profile <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    )
  }

  const needsOnboarding = userProfile &&
    'has_completed_onboarding' in userProfile &&
    (userProfile as any).has_completed_onboarding === false

  /* ── Assigned user view ── */
  return (
    <div className="space-y-8 mt-8 px-4 sm:px-6 lg:px-8">
      {/* Greeting */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-foreground">
          {(userProfile as any)?.name ? `Hello, ${(userProfile as any).name}` : 'Welcome to Worklo'}
        </h1>
        <p className="text-muted-foreground">
          {isSuperadminUser ? 'Superadmin access' : 'Welcome back'}
        </p>
      </div>

      {/* Onboarding hint */}
      {needsOnboarding && (
        <div className="max-w-2xl mx-auto p-4 rounded-lg border border-primary/20 bg-primary/5">
          <p className="text-sm text-primary font-medium">
            Welcome! Follow the tutorial at the bottom of the screen to get oriented.
          </p>
        </div>
      )}

      {/* Setup incomplete status */}
      {!isSetupComplete && (
        <div className="max-w-2xl mx-auto rounded-xl border border-white/8 bg-card p-6 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Account Status</h2>
          </div>
          {[
            { label: 'Account Created', done: isAccountCreated },
            { label: 'Email Verified', done: isEmailVerified },
            {
              label: 'Role Assignment',
              done: hasRoles,
              extra: hasRoles ? (isSuperadminUser ? 'Superadmin' : 'Assigned') : null,
            },
          ].map((step) => (
            <div key={step.label} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
              <span className="text-sm font-medium text-foreground">{step.label}</span>
              {step.done ? (
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-primary" />
                  {step.extra && <span className="text-xs text-primary font-medium">{step.extra}</span>}
                </div>
              ) : (
                <span className="text-xs font-semibold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-full">
                  Pending
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Project updates + newsletters */}
      {isSetupComplete && !isActuallyUnassigned && (
        <div className="max-w-6xl mx-auto w-full">
          <div className={`flex flex-col ${canViewNewsletters ? 'lg:grid lg:grid-cols-2' : ''} gap-6`}>
            <div className="w-full"><ProjectUpdatesCard className="w-full" /></div>
            {canViewNewsletters && (
              <div className="w-full"><NewsletterCard canCreate={isSuperadminUser} className="w-full" /></div>
            )}
          </div>
        </div>
      )}

      {/* What's next cards */}
      {!isSetupComplete && !isActuallyUnassigned && (
        <div className="max-w-4xl mx-auto w-full">
          <h2 className="text-xl font-bold text-foreground text-center mb-6">What&apos;s Next?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              {
                icon: <Users className="w-5 h-5 text-primary" />,
                title: 'Role Assignment',
                desc: 'Get assigned to your department and role',
                body: 'An administrator will assign you to the appropriate department and role based on your position.',
                items: ['Custom role tailored to your responsibilities', 'Specific permissions for your job function', 'Access to relevant projects and accounts'],
              },
              {
                icon: <Building2 className="w-5 h-5 text-primary" />,
                title: 'Department Access',
                desc: "Access your department's tools and projects",
                body: "Once assigned, you'll have access to department-specific features and projects.",
                items: ['Department-specific project access', 'Collaboration with team members', 'Role-based permissions and workflows'],
              },
            ].map((card) => (
              <div key={card.title} className="rounded-xl border border-white/8 bg-card p-6 space-y-3">
                <div className="flex items-center gap-2">
                  {card.icon}
                  <h3 className="font-semibold text-foreground">{card.title}</h3>
                </div>
                <p className="text-xs text-muted-foreground">{card.desc}</p>
                <p className="text-sm text-muted-foreground">{card.body}</p>
                <ul className="space-y-1.5">
                  {card.items.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="w-1 h-1 rounded-full bg-primary flex-shrink-0" />{item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contact */}
      {!isActuallyUnassigned && (
        <div className="max-w-6xl mx-auto w-full">
          <div className="rounded-xl border border-white/8 bg-card p-6">
            <h3 className="font-semibold text-foreground mb-1">Need IT Support?</h3>
            <p className="text-sm text-muted-foreground mb-5">Contact the Worklo team for assistance</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                { icon: <Mail className="w-4 h-4 text-muted-foreground" />, label: 'Email Support', value: 'support@Worklo.dev' },
                { icon: <Phone className="w-4 h-4 text-muted-foreground" />, label: 'Phone Support', value: '(555) 123-4567' },
                { icon: <MapPin className="w-4 h-4 text-muted-foreground" />, label: 'Office', value: '880 W Campus Dr, Blacksburg, VA' },
              ].map((c) => (
                <div key={c.label} className="flex items-center gap-3">
                  {c.icon}
                  <div>
                    <p className="text-sm font-medium text-foreground">{c.label}</p>
                    <p className="text-sm text-muted-foreground">{c.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="text-center pb-8">
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={() => router.push('/dashboard')} className="inline-flex items-center gap-2">
            Go to Dashboard <ArrowRight className="w-4 h-4" />
          </Button>
          <Button onClick={() => router.push('/profile')} variant="outline" className="inline-flex items-center gap-2">
            View Profile <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
        {hasRoles && (
          <p className="mt-3 text-sm text-muted-foreground">
            You have been assigned roles and can access the dashboard
          </p>
        )}
      </div>
    </div>
  )
}
