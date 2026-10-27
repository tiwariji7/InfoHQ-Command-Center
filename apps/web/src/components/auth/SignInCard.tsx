import React from 'react';
import { SignIn } from '@clerk/clerk-react';
import { KeyRound } from 'lucide-react';
import { InfoHQBrandLogo } from './InfoHQBrandLogo.js';
import './clerk-auth.css';

interface SignInCardProps {
  hasValidKey: boolean;
}

export const SignInCard: React.FC<SignInCardProps> = ({ hasValidKey }) => {
  if (!hasValidKey) {
    return (
      <div className="min-h-screen bg-brand-page flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-[440px] bg-white rounded-card border border-brand-border p-8 sm:p-10 shadow-[0_12px_40px_-10px_rgba(26,8,92,0.08),0_2px_10px_-2px_rgba(26,8,92,0.03)]">
          <div className="flex flex-col items-center text-center mb-6">
            <InfoHQBrandLogo className="h-8 mb-4" />
            <h1 className="text-[23px] sm:text-[25px] font-bold text-brand-heading tracking-tight leading-snug">
              Sign in to<br />
              InfoHQ <span className="bg-gradient-to-r from-[#5B4CF5] via-[#7C5CE8] to-[#E85AA0] bg-clip-text text-transparent">Command Center</span>
            </h1>
            <p className="mt-2 text-sm text-brand-muted">
              Welcome back! Please sign in to continue.
            </p>
          </div>

          <div className="flex items-center gap-3 p-3.5 bg-brand-section rounded-control border border-brand-border mb-4">
            <div className="w-9 h-9 rounded-full bg-brand-subtle flex items-center justify-center text-brand-primary flex-shrink-0">
              <KeyRound size={18} />
            </div>
            <div>
              <div className="text-sm font-semibold text-brand-heading">
                Clerk Setup Required
              </div>
              <div className="text-xs text-brand-muted">
                Frontend publishable key not detected
              </div>
            </div>
          </div>

          <div className="bg-brand-section p-3 rounded-control border border-brand-border text-xs font-mono text-brand-heading mb-3 select-all">
            <span className="text-brand-muted font-sans font-medium block mb-1">Local Development:</span>
            apps/web/.env.local<br />
            VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
          </div>

          <p className="text-xs text-brand-muted text-center">
            After configuring, restart your local server to continue.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-page flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-[440px] bg-white rounded-card border border-brand-border p-8 sm:p-10 shadow-[0_12px_40px_-10px_rgba(26,8,92,0.08),0_2px_10px_-2px_rgba(26,8,92,0.03)]">
        {/* Custom InfoHQ Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <InfoHQBrandLogo className="h-8 mb-4" />
          <h1 className="text-[23px] sm:text-[25px] font-bold text-brand-heading tracking-tight leading-snug">
            Sign in to<br />
            InfoHQ <span className="bg-gradient-to-r from-[#5B4CF5] via-[#7C5CE8] to-[#E85AA0] bg-clip-text text-transparent">Command Center</span>
          </h1>
          <p className="mt-2 text-sm text-brand-muted">
            Welcome back! Please sign in to continue.
          </p>
        </div>

        {/* Clerk Sign In component customized with brand tokens */}
        <SignIn
          routing="hash"
          appearance={{
            layout: {
              socialButtonsVariant: 'blockButton',
              logoPlacement: 'none',
              showOptionalFields: false,
            },
            variables: {
              colorPrimary: '#7C5CE8',
              colorText: '#1A085C',
              colorTextSecondary: '#6B7280',
              colorBackground: '#FFFFFF',
              colorInputBackground: '#FFFFFF',
              colorInputText: '#1A085C',
              borderRadius: '12px',
              fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
            },
            elements: {
              rootBox: 'w-full flex justify-center',
              cardBox: 'w-full shadow-none border-none p-0 bg-transparent',
              card: 'w-full shadow-none border-none bg-transparent p-0 gap-5',
              header: 'hidden',
              headerTitle: 'hidden',
              headerSubtitle: 'hidden',
              socialButtons: 'hidden',
              dividerRow: 'hidden',
              form: 'gap-4',
              formField: 'gap-1.5',
              formFieldLabel: 'text-[13px] font-semibold text-brand-heading tracking-tight',
              formFieldInput: 'h-12 rounded-control border border-brand-border bg-white text-brand-heading text-sm px-4 focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/15 transition-all',
              formButtonPrimary: 'h-12 rounded-control text-white font-semibold text-sm tracking-wide shadow-md transition-all',
              formFieldAction: 'text-xs font-medium text-brand-primary hover:text-brand-hover hover:underline transition-colors',
              identityPreview: 'bg-brand-section border border-brand-border rounded-control p-3 mb-2',
              identityPreviewText: 'text-sm font-medium text-brand-heading',
              identityPreviewEditButton: 'text-brand-primary hover:text-brand-hover text-xs font-medium',
              footer: 'pt-3 pb-0 justify-center border-none bg-transparent',
              footerAction: 'hidden',
              footerPages: 'text-xs text-brand-muted flex items-center justify-center gap-1.5 opacity-85 hover:opacity-100 transition-opacity',
              footerPagesLink: 'text-brand-muted font-medium hover:text-brand-heading',
            },
          }}
        />
      </div>
    </div>
  );
};
