import React, { useState, useEffect } from 'react';
import { SignIn, useSignIn } from '@clerk/clerk-react';
import { KeyRound, Pencil } from 'lucide-react';
import { AuthErrorBoundary } from './AuthErrorBoundary.js';
import './clerk-auth.css';

interface SignInCardProps {
  hasValidKey: boolean;
}

const SignInInner: React.FC = () => {
  const { signIn } = useSignIn();
  const [savedEmail, setSavedEmail] = useState<string>(() => {
    try {
      return sessionStorage.getItem('infohq_signin_email') || '';
    } catch {
      return '';
    }
  });
  const [isPasswordScreen, setIsPasswordScreen] = useState<boolean>(false);

  // Capture user input from email field so we have the typed email address
  useEffect(() => {
    const handleInput = (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (target && (target.name === 'identifier' || target.type === 'email')) {
        const val = target.value?.trim();
        if (val) {
          setSavedEmail(val);
          try {
            sessionStorage.setItem('infohq_signin_email', val);
          } catch {
            // ignore storage errors
          }
        }
      }
    };
    document.addEventListener('input', handleInput);
    document.addEventListener('change', handleInput);
    return () => {
      document.removeEventListener('input', handleInput);
      document.removeEventListener('change', handleInput);
    };
  }, []);

  // Detect whether Clerk is currently on the password screen (or factor one screen)
  useEffect(() => {
    const checkScreen = () => {
      const hasPasswordInput = Boolean(
        document.querySelector('input[type="password"], input[name="password"]')
      );
      const isFactorOne =
        window.location.hash.includes('factor') || window.location.hash.includes('password');
      const isNeedsFirstFactor = signIn?.status === 'needs_first_factor';

      // Also try to read email from Clerk's internal identity text if available
      const domIdentityEmail = document.querySelector('.cl-identityPreviewText')?.textContent?.trim();
      if (domIdentityEmail) {
        setSavedEmail(domIdentityEmail);
        try {
          sessionStorage.setItem('infohq_signin_email', domIdentityEmail);
        } catch {
          // ignore
        }
      }

      setIsPasswordScreen(hasPasswordInput || isFactorOne || isNeedsFirstFactor);
    };

    checkScreen();
    const observer = new MutationObserver(checkScreen);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    window.addEventListener('hashchange', checkScreen);
    window.addEventListener('popstate', checkScreen);

    const interval = setInterval(checkScreen, 200);

    return () => {
      observer.disconnect();
      window.removeEventListener('hashchange', checkScreen);
      window.removeEventListener('popstate', checkScreen);
      clearInterval(interval);
    };
  }, [signIn?.status]);

  const handleEditEmail = () => {
    // 1. Try clicking Clerk's native edit button inside identityPreview
    const editBtn = document.querySelector<HTMLButtonElement>(
      '.cl-identityPreviewEditButton, .cl-headerBackLink, button[aria-label*="Edit"], button[aria-label*="edit"], .cl-backLink'
    );
    if (editBtn) {
      editBtn.click();
      return;
    }

    // 2. Try clearing hash to return to main identifier step
    if (window.location.hash && window.location.hash !== '#/' && window.location.hash !== '#') {
      window.location.hash = '';
      return;
    }

    // 3. Fallback reload
    window.location.reload();
  };

  const currentEmail = signIn?.identifier || savedEmail;

  return (
    <div className="min-h-screen w-full bg-brand-page flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-[390px] sm:max-w-[420px] bg-white rounded-[20px] sm:rounded-[24px] border border-brand-border p-6 sm:p-8 shadow-[0_8px_30px_rgba(26,8,92,0.05),0_1px_3px_rgba(26,8,92,0.02)] my-auto">
        {/* Simple clean text branding - Info in purple/indigo gradient like Center */}
        <div className="flex flex-col items-center text-center mb-5 sm:mb-6">
          <div className="flex items-center justify-center select-none mb-2.5 sm:mb-3">
            <span className="text-[24px] sm:text-[27px] font-black tracking-tight bg-gradient-to-r from-[#7C5CE8] via-[#6366F1] to-[#5B4CF5] bg-clip-text text-transparent">
              info
            </span>
            <span className="text-[24px] sm:text-[27px] font-black tracking-tight text-brand-heading ml-0.5">
              HQ
            </span>
          </div>
          <h1 className="text-[19px] sm:text-[22px] font-bold tracking-tight leading-snug">
            <span className="text-brand-heading">Sign in to</span><br />
            <span className="bg-gradient-to-r from-[#7C5CE8] via-[#6366F1] to-[#5B4CF5] bg-clip-text text-transparent font-bold">Info</span>
            <span className="text-brand-heading font-bold">HQ</span>{' '}
            <span className="bg-gradient-to-r from-[#FF4D8D] via-[#A855F7] to-[#5B4CF5] bg-clip-text text-transparent font-bold">Command Center</span>
          </h1>

          {/* Subtitle: switches to Email + Pencil on password screen as requested */}
          {isPasswordScreen && currentEmail ? (
            <div className="mt-2 inline-flex items-center justify-center gap-1.5 py-1 px-3 bg-brand-subtle rounded-full border border-brand-border animate-fadeIn">
              <span className="text-xs sm:text-[13px] font-medium text-brand-heading max-w-[210px] sm:max-w-[250px] truncate">
                {currentEmail}
              </span>
              <button
                type="button"
                onClick={handleEditEmail}
                className="p-1 rounded-full text-[#5B4CF5] hover:text-brand-primary hover:bg-white transition-all inline-flex items-center justify-center cursor-pointer shadow-none hover:shadow-xs"
                title="Change email address"
                aria-label="Change email address"
              >
                <Pencil size={12} className="stroke-[2.5]" />
              </button>
            </div>
          ) : (
            <p className="mt-1.5 text-xs sm:text-[13px] text-brand-muted">
              Welcome back! Please sign in to continue.
            </p>
          )}
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

export const SignInCard: React.FC<SignInCardProps> = ({ hasValidKey }) => {
  if (!hasValidKey) {
    return (
      <div className="min-h-screen w-full bg-brand-page flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        <div className="w-full max-w-[390px] sm:max-w-[420px] bg-white rounded-[20px] sm:rounded-[24px] border border-brand-border p-6 sm:p-8 shadow-[0_8px_30px_rgba(26,8,92,0.05),0_1px_3px_rgba(26,8,92,0.02)] my-auto">
          <div className="flex flex-col items-center text-center mb-5 sm:mb-6">
            <div className="flex items-center justify-center select-none mb-2.5 sm:mb-3">
              <span className="text-[24px] sm:text-[27px] font-black tracking-tight bg-gradient-to-r from-[#7C5CE8] via-[#6366F1] to-[#5B4CF5] bg-clip-text text-transparent">
                info
              </span>
              <span className="text-[24px] sm:text-[27px] font-black tracking-tight text-brand-heading ml-0.5">
                HQ
              </span>
            </div>
            <h1 className="text-[19px] sm:text-[22px] font-bold tracking-tight leading-snug">
              <span className="text-brand-heading">Sign in to</span><br />
              <span className="bg-gradient-to-r from-[#7C5CE8] via-[#6366F1] to-[#5B4CF5] bg-clip-text text-transparent font-bold">Info</span>
              <span className="text-brand-heading font-bold">HQ</span>{' '}
              <span className="bg-gradient-to-r from-[#FF4D8D] via-[#A855F7] to-[#5B4CF5] bg-clip-text text-transparent font-bold">Command Center</span>
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

  return <SignInInner />;
};
