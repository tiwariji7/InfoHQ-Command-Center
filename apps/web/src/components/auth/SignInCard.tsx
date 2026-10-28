import React from 'react';
import { SignIn } from '@clerk/clerk-react';
import { KeyRound } from 'lucide-react';
import { AuthErrorBoundary } from './AuthErrorBoundary.js';
import './clerk-auth.css';

interface SignInCardProps {
  hasValidKey: boolean;
}

export const SignInCard: React.FC<SignInCardProps> = ({ hasValidKey }) => {
  if (!hasValidKey) {
    return (
      <div className="min-h-screen w-full bg-brand-page flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        <div className="w-full max-w-[390px] sm:max-w-[420px] bg-white rounded-[20px] sm:rounded-[24px] border border-brand-border p-6 sm:p-8 shadow-[0_8px_30px_rgba(26,8,92,0.05),0_1px_3px_rgba(26,8,92,0.02)] my-auto">
          {/* Simple clean text branding - no heavy graphic icons */}
          <div className="flex flex-col items-center text-center mb-5 sm:mb-6">
            <div className="flex items-center justify-center select-none mb-2.5 sm:mb-3">
              <span className="text-[24px] sm:text-[27px] font-black tracking-tight text-[#FF4D8D]">
                info
              </span>
              <span className="text-[24px] sm:text-[27px] font-black tracking-tight text-brand-heading ml-0.5">
                HQ
              </span>
            </div>
            <h1 className="text-[19px] sm:text-[22px] font-bold text-brand-heading tracking-tight leading-snug">
              Sign in to<br />
              InfoHQ <span className="bg-gradient-to-r from-[#FF4D8D] via-[#A855F7] to-[#5B4CF5] bg-clip-text text-transparent">Command Center</span>
            </h1>
            <p className="mt-1.5 text-xs sm:text-[13px] text-brand-muted">
              Welcome back! Please sign in to continue.
            </p>
          </div>

          <div className="flex items-center gap-3 p-3.5 bg-brand-section rounded-control border border-brand-border mb-4">
            <div className="w-8 h-8 rounded-full bg-brand-subtle flex items-center justify-center text-brand-primary flex-shrink-0">
              <KeyRound size={16} />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-semibold text-brand-heading">
                Clerk Setup Required
              </div>
              <div className="text-[11px] sm:text-xs text-brand-muted">
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
    <div className="min-h-screen w-full bg-brand-page flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-[390px] sm:max-w-[420px] bg-white rounded-[20px] sm:rounded-[24px] border border-brand-border p-6 sm:p-8 shadow-[0_8px_30px_rgba(26,8,92,0.05),0_1px_3px_rgba(26,8,92,0.02)] my-auto">
        {/* Simple clean text branding - no heavy graphic icons as requested */}
        <div className="flex flex-col items-center text-center mb-5 sm:mb-6">
          <div className="flex items-center justify-center select-none mb-2.5 sm:mb-3">
            <span className="text-[24px] sm:text-[27px] font-black tracking-tight text-[#FF4D8D]">
              info
            </span>
            <span className="text-[24px] sm:text-[27px] font-black tracking-tight text-brand-heading ml-0.5">
              HQ
            </span>
          </div>
          <h1 className="text-[19px] sm:text-[22px] font-bold text-brand-heading tracking-tight leading-snug">
            Sign in to<br />
            InfoHQ <span className="bg-gradient-to-r from-[#FF4D8D] via-[#A855F7] to-[#5B4CF5] bg-clip-text text-transparent">Command Center</span>
          </h1>
          <p className="mt-1.5 text-xs sm:text-[13px] text-brand-muted">
            Welcome back! Please sign in to continue.
          </p>
        </div>

        {/* Clerk Sign In component customized with brand tokens */}
        <AuthErrorBoundary>
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
                card: 'w-full shadow-none border-none bg-transparent p-0 gap-4 sm:gap-5',
                header: 'hidden',
                headerTitle: 'hidden',
                headerSubtitle: 'hidden',
                socialButtons: 'hidden',
                dividerRow: 'hidden',
                form: 'gap-3.5 sm:gap-4',
                formField: 'gap-1.5',
                formFieldLabel: 'text-xs sm:text-[13px] font-semibold text-brand-heading tracking-tight block text-left mb-1.5',
                formFieldInput: 'h-11 sm:h-12 rounded-control border border-brand-border bg-white text-brand-heading text-xs sm:text-sm px-3.5 sm:px-4 focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/15 transition-all',
                formButtonPrimary: 'h-11 sm:h-12 rounded-control text-white font-semibold text-xs sm:text-sm tracking-wide shadow-md transition-all',
                formFieldAction: 'text-xs font-medium text-[#5B4CF5] hover:text-brand-primary hover:underline transition-colors',
                identityPreview: 'bg-brand-section border border-brand-border rounded-control p-2.5 sm:p-3 mb-2',
                identityPreviewText: 'text-xs sm:text-sm font-medium text-brand-heading',
                identityPreviewEditButton: 'text-[#5B4CF5] hover:text-brand-primary text-xs font-medium',
                footer: 'pt-2.5 sm:pt-3 pb-0 justify-center border-none bg-transparent',
                footerAction: 'hidden',
                footerPages: 'text-[11px] sm:text-xs text-brand-muted flex items-center justify-center gap-1.5 opacity-85 hover:opacity-100 transition-opacity',
                footerPagesLink: 'text-brand-muted font-medium hover:text-brand-heading',
              },
            }}
          />
        </AuthErrorBoundary>
      </div>
    </div>
  );
};
