import React from 'react';
import { SignIn } from '@clerk/clerk-react';
import { KeyRound } from 'lucide-react';

interface SignInCardProps {
  hasValidKey: boolean;
}

export const SignInCard: React.FC<SignInCardProps> = ({ hasValidKey }) => {
  if (!hasValidKey) {
    return (
      <div className="min-h-screen bg-brand-page flex items-center justify-center p-4">
        <div className="w-full max-w-md hq-card bg-white border-brand-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-brand-subtle flex items-center justify-center text-brand-primary">
              <KeyRound size={20} />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-brand-heading">
                Clerk Setup Required
              </h1>
              <p className="text-xs text-brand-muted">
                Frontend publishable key not detected
              </p>
            </div>
          </div>

          <p className="text-sm text-brand-body mb-4">
            To enable sign-in, configure your Clerk Publishable Key:
          </p>

          <div className="bg-brand-section p-3 rounded-control border border-brand-border text-xs font-mono text-brand-heading mb-3 select-all">
            <span className="text-brand-muted font-sans font-medium block mb-1">Local Development:</span>
            apps/web/.env.local<br />
            VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
          </div>

          <div className="bg-brand-section p-3 rounded-control border border-brand-border text-xs font-mono text-brand-heading mb-4 select-all">
            <span className="text-brand-muted font-sans font-medium block mb-1">Cloudflare Deployment:</span>
            Workers / Pages &gt; Settings &gt; Variables and Secrets<br />
            Name: VITE_CLERK_PUBLISHABLE_KEY<br />
            Value: pk_live_... (or pk_test_...)
          </div>

          <p className="text-xs text-brand-muted">
            After configuring, redeploy the application or restart your local server.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <SignIn routing="hash" />
    </div>
  );
};
