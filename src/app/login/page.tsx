import LoginForm from '@/components/LoginForm';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-accent-soft mb-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent-cyan">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.125A59.769 59.769 0 0121.485 12 59.768 59.768 0 013.27 20.875L5.999 12zm0 0h7.5" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-foreground">Outage Map</h1>
          <p className="text-xs text-muted mt-1">Sign in to manage alerts, maintenance, and sources</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
