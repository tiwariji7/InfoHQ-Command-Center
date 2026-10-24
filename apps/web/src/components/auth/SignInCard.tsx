import React from 'react';
import { SignIn } from '@clerk/clerk-react';
import { ShieldCheck, KeyRound } from 'lucide-react';

interface SignInCardProps {
  hasValidKey: boolean;
}

export const SignInCard: React.FC<SignInCardProps> = ({ hasValidKey }) => {
  if (!hasValidKey) {
    return (
      <div className="min-h-screen bg-brand-page flex items-center justify-center p-4">
        <div className="w-full max-w-lg hq-card bg-white border-brand-border">
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
            To enable Superadmin sign-in, add your Clerk Publishable Key to your local environment file:
          </p>

          <div className="bg-brand-section p-3 rounded-control border border-brand-border text-xs font-mono text-brand-heading mb-4 select-all">
            apps/web/.env.local<br />
            VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
          </div>

          <p className="text-xs text-brand-muted">
            After updating <code className="text-brand-heading font-medium">apps/web/.env.local</code>, restart the frontend server.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-page flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-chip bg-brand-subtle border border-brand-border text-xs font-medium text-brand-primary mb-3">
            <ShieldCheck size={14} />
            <span>InfoHQ Command Center</span>
          </div>
          <h1 className="text-2xl font-bold text-brand-heading">Superadmin Sign In</h1>
          <p className="text-sm text-brand-muted mt-1">
            Authorized administrative access only
          </p>
        </div>

        <div className="hq-card bg-white p-6 shadow-sm border border-brand-border flex justify-center">
          <SignIn
            routing="hash"
            appearance={{
              elements: {
                rootBox: 'w-full',
                card: 'shadow-none p-0 border-none w-full bg-transparent',
                headerTitle: 'hidden',
                headerSubtitle: 'hidden',
                formButtonPrimary:
                  'bg-[#7C5CE8] hover:bg-[#6A48DC] text-white text-sm font-medium rounded-control h-11',
                formFieldInput:
                  'rounded-control border-brand-border focus:border-brand-primary text-sm h-11',
                footerAction: 'hidden', // hides public sign up link
              },
            }}
          />
        </div>
      </div>
    </div>
  );
};
