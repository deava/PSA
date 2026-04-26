'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-config';
import { Shield, CheckCircle, User, ArrowRight, KeyRound, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Step = 'welcome' | 'verify' | 'create' | 'success';

export function SetupWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('welcome');
  const [loading, setLoading] = useState(false);

  // Step 2 state
  const [token, setToken] = useState('');
  const [tokenError, setTokenError] = useState('');

  // Step 3 state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Step 1 -> Step 2: fire token generation (non-blocking) then advance
  async function handleBeginSetup() {
    setLoading(true);
    // Don't await — backend may be slow. Token prints async in backend terminal.
    apiFetch('/api/onboarding/setup-token').catch(() => {});
    await new Promise((r) => setTimeout(r, 400));
    setLoading(false);
    setStep('verify');
  }

  // Step 2: Verify token
  async function handleVerifyToken() {
    setTokenError('');
    const trimmed = token.trim();
    if (!trimmed) {
      setTokenError('Please enter the setup token.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch('/api/onboarding/setup-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: trimmed }),
      });
      const data = await res.json();

      if (data.valid) {
        setStep('create');
      } else {
        setTokenError('Invalid or expired token. Check your server console for the latest token.');
        toast.error('Token verification failed');
      }
    } catch {
      setTokenError('Failed to verify token. Please try again.');
      toast.error('Network error during verification');
    } finally {
      setLoading(false);
    }
  }

  // Step 3: Validate form client-side
  function validateForm(): boolean {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = 'Name is required.';
    if (!email.trim()) {
      errors.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Please enter a valid email address.';
    }
    if (!password) {
      errors.password = 'Password is required.';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters.';
    }
    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your password.';
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // Step 3: Create superadmin account
  async function handleCreateAccount() {
    if (!validateForm()) return;
    setLoading(true);
    try {
      const res = await apiFetch('/api/onboarding/complete-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token.trim(),
          email: email.trim(),
          password,
          name: name.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStep('success');
      } else {
        toast.error(data.error || 'Failed to create account');
      }
    } catch {
      toast.error('Could not reach the backend. Make sure it is running.');
    } finally {
      setLoading(false);
    }
  }

  const steps: { key: Step; label: string }[] = [
    { key: 'welcome', label: 'Welcome' },
    { key: 'verify', label: 'Verify' },
    { key: 'create', label: 'Account' },
    { key: 'success', label: 'Done' },
  ];
  const stepIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="w-full max-w-lg">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                i <= stepIndex
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {i < stepIndex ? <CheckCircle className="h-4 w-4" /> : i + 1}
            </div>
            {i < steps.length - 1 && (
              <div className={`w-8 h-0.5 transition-colors ${i < stepIndex ? 'bg-primary' : 'bg-muted'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Welcome */}
      {step === 'welcome' && (
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Welcome to Worklo</CardTitle>
            <CardDescription className="text-base">
              First-time setup. Create the initial superadmin account to manage your platform.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-primary/10 p-4 text-sm space-y-2">
              <p className="font-medium text-primary">What happens next:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>A setup token will be printed to your backend terminal</li>
                <li>Enter that token to verify you own this server</li>
                <li>Create your superadmin account</li>
              </ol>
            </div>
          </CardContent>
          <CardFooter className="justify-center">
            <Button size="lg" onClick={handleBeginSetup} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Begin Setup
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 2: Verify Token */}
      {step === 'verify' && (
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
              <KeyRound className="h-8 w-8 text-amber-400" />
            </div>
            <CardTitle className="text-2xl">Verify Your Identity</CardTitle>
            <CardDescription className="text-base">
              Check your backend terminal for the setup token, then paste it below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted/50 border p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Where to find the token:</p>
              <p>Look in the terminal running <code className="bg-muted px-1 rounded">npm run dev:backend</code>. It was printed between <code className="bg-muted px-1 rounded">========</code> lines.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="setup-token">Setup Token</Label>
              <Input
                id="setup-token"
                type="text"
                placeholder="Paste your setup token here"
                value={token}
                onChange={(e) => { setToken(e.target.value); setTokenError(''); }}
                className={tokenError ? 'border-destructive' : ''}
              />
              {tokenError && <p className="text-sm text-destructive">{tokenError}</p>}
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="ghost" onClick={() => setStep('welcome')}>Back</Button>
            <Button onClick={handleVerifyToken} disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</> : <>Verify <ArrowRight className="ml-2 h-4 w-4" /></>}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 3: Create Account */}
      {step === 'create' && (
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
              <User className="h-8 w-8 text-emerald-400" />
            </div>
            <CardTitle className="text-2xl">Create Superadmin Account</CardTitle>
            <CardDescription className="text-base">
              This account will have full administrative access to your Worklo instance.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { id: 'admin-name', label: 'Full Name', type: 'text', placeholder: 'Jane Smith', value: name, onChange: (v: string) => { setName(v); setFormErrors(p => ({ ...p, name: '' })); }, error: formErrors.name },
              { id: 'admin-email', label: 'Email Address', type: 'email', placeholder: 'admin@yourcompany.com', value: email, onChange: (v: string) => { setEmail(v); setFormErrors(p => ({ ...p, email: '' })); }, error: formErrors.email },
              { id: 'admin-password', label: 'Password', type: 'password', placeholder: 'Minimum 8 characters', value: password, onChange: (v: string) => { setPassword(v); setFormErrors(p => ({ ...p, password: '' })); }, error: formErrors.password },
              { id: 'admin-confirm', label: 'Confirm Password', type: 'password', placeholder: 'Re-enter your password', value: confirmPassword, onChange: (v: string) => { setConfirmPassword(v); setFormErrors(p => ({ ...p, confirmPassword: '' })); }, error: formErrors.confirmPassword },
            ].map(f => (
              <div key={f.id} className="space-y-2">
                <Label htmlFor={f.id}>{f.label}</Label>
                <Input id={f.id} type={f.type} placeholder={f.placeholder} value={f.value} onChange={e => f.onChange(e.target.value)} className={f.error ? 'border-destructive' : ''} />
                {f.error && <p className="text-sm text-destructive">{f.error}</p>}
              </div>
            ))}
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="ghost" onClick={() => setStep('verify')}>Back</Button>
            <Button onClick={handleCreateAccount} disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : 'Create Superadmin Account'}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 4: Success */}
      {step === 'success' && (
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle className="h-8 w-8 text-emerald-400" />
            </div>
            <CardTitle className="text-2xl">Setup Complete!</CardTitle>
            <CardDescription className="text-base">
              Your superadmin account has been created. You can now log in.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4 text-sm">
              <p className="font-medium text-emerald-400">Account Details:</p>
              <p className="mt-1 text-muted-foreground"><span className="text-foreground">Email:</span> {email}</p>
              <p className="text-muted-foreground"><span className="text-foreground">Role:</span> Superadmin</p>
            </div>
          </CardContent>
          <CardFooter className="flex-col gap-3">
            <Button size="lg" className="w-full" onClick={() => router.push('/login')}>
              Go to Login <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
