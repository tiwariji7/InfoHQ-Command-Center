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
  const [typedEmail, setTypedEmail] = useState<string>('');
  const typedEmailRef = React.useRef<string>('');
  const [isPasswordScreen, setIsPasswordScreen] = useState<boolean>(false);

  // Clear any legacy sessionStorage email from previous builds
  useEffect(() => {
    try {
      sessionStorage.removeItem('infohq_signin_email');
    } catch {
      // ignore
    }
  }, []);

  // Listen to input, change, and submit events to capture email as user types
  useEffect(() => {
    const handleInput = (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (
        target &&
        (target.name === 'identifier' ||
          target.id === 'identifier-field' ||
          target.type === 'email' ||
          target.autocomplete === 'username' ||
          target.autocomplete === 'email')
      ) {
        const val = target.value?.trim();
        if (val) {
          typedEmailRef.current = val;
          setTypedEmail(val);
        }
      }
    };

    const handleFormSubmit = () => {
      const input = document.querySelector<HTMLInputElement>(
        'input[name="identifier"], input[id="identifier-field"], input[type="email"]'
      );
      if (input && input.value.trim()) {
        const val = input.value.trim();
        typedEmailRef.current = val;
        setTypedEmail(val);
      }
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && target.closest('.cl-formButtonPrimary, button[type="submit"]')) {
        handleFormSubmit();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleFormSubmit();
      }
    };

    document.addEventListener('input', handleInput);
    document.addEventListener('change', handleInput);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('input', handleInput);
      document.removeEventListener('change', handleInput);
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, []);

  // Screen detection: strictly check DOM elements for email vs password step
  useEffect(() => {
    const checkScreen = () => {
      const emailInput = document.querySelector<HTMLInputElement>(
        'input[name="identifier"], input[id="identifier-field"], input[type="email"]'
      );
      const passwordInput = document.querySelector<HTMLInputElement>(
        'input[name="password"], input[id="password-field"], input[type="password"]'
      );

      // Email field in DOM -> definitely on email screen
      const hasEmailInput = Boolean(emailInput);
      // Password field in DOM -> definitely on password screen
      const hasPasswordInput = Boolean(passwordInput);

      // If email input is present, capture any value it currently holds
      if (emailInput && emailInput.value.trim()) {
        const val = emailInput.value.trim();
        if (val !== typedEmailRef.current) {
          typedEmailRef.current = val;
          setTypedEmail(val);
        }
      }

      // Check Clerk's identity preview text if rendered
      const domIdentityEmail =
        document.querySelector('.cl-identityPreviewText')?.textContent?.trim() ||
        document.querySelector('.cl-identityPreview')?.textContent?.trim();

      if (domIdentityEmail) {
        const cleanEmail = domIdentityEmail.replace(/Edit$/i, '').trim();
        if (cleanEmail && cleanEmail !== typedEmailRef.current) {
          typedEmailRef.current = cleanEmail;
          setTypedEmail(cleanEmail);
        }
      }

      if (hasEmailInput) {
        setIsPasswordScreen(false);
      } else if (hasPasswordInput) {
        setIsPasswordScreen(true);
      } else {
        // Fallback during route transition
        const isFactor =
          window.location.hash.includes('factor') || window.location.hash.includes('password');
        if (isFactor) {
          setIsPasswordScreen(true);
        }
      }
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
  }, []);

  const handleBackToEmail = () => {
    setIsPasswordScreen(false);

    // Try finding Clerk native back/edit button
    const backOrEditSelectors = [
      '.cl-identityPreviewEditButton',
      '.cl-headerBackLink',
      '.cl-backLink',
      'button[aria-label*="Edit" i]',
      'button[aria-label*="Back" i]',
      '[data-localization-key*="edit" i]',
      '[data-localization-key*="back" i]',
    ];

    let clicked = false;
    for (const selector of backOrEditSelectors) {
      const btn = document.querySelector<HTMLElement>(selector);
      if (btn) {
        btn.click();
        clicked = true;
        break;
      }
    }

    // Reset hash if using hash routing
    if (window.location.hash && window.location.hash !== '#' && window.location.hash !== '#/') {
      window.location.hash = '';
    }

    // Safety timeout check: if still on password screen after 350ms, reload clean
    setTimeout(() => {
      const stillPassword = Boolean(
        document.querySelector('input[type="password"], input[name="password"]')
      );
      if (stillPassword && !clicked) {
        window.location.href = window.location.pathname;
      }
    }, 350);
  };

  const displayEmail =
    typedEmail ||
    document.querySelector('.cl-identityPreviewText')?.textContent?.trim() ||
    signIn?.identifier ||
    '';

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

          {/* Subtitle: on password page shows entered email + pencil icon; on email page shows Welcome back */}
          {isPasswordScreen ? (
            <div className="mt-2 inline-flex items-center justify-center gap-1.5 py-1 px-3 bg-brand-subtle rounded-full border border-brand-border animate-fadeIn">
              <span className="text-xs sm:text-[13px] font-medium text-brand-heading max-w-[210px] sm:max-w-[250px] truncate">
                {displayEmail || 'your email'}
              </span>
              <button
                type="button"
                onClick={handleBackToEmail}
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
