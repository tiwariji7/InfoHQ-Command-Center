import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import { App } from './App.js';
import { SignInCard } from './components/auth/SignInCard.js';
import './index.css';

const buildTimeKey = (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '').trim();

const Root: React.FC = () => {
  const [clerkKey, setClerkKey] = useState<string>(buildTimeKey);
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    // If build-time key is already valid, no need to wait
    return !buildTimeKey.startsWith('pk_');
  });

  useEffect(() => {
    if (clerkKey.startsWith('pk_')) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    // Dynamically fetch publishable key from Cloudflare Worker runtime environment
    fetch('/api/auth/config')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { publishableKey?: string } | null) => {
        if (!isMounted) return;
        if (data?.publishableKey && data.publishableKey.trim().startsWith('pk_')) {
          setClerkKey(data.publishableKey.trim());
        }
      })
      .catch((err) => {
        console.warn('Runtime auth config fetch skipped or failed:', err);
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [clerkKey]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-brand-page flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-brand-primary border-t-transparent animate-spin" />
          <span className="text-xs text-brand-muted">Connecting to Command Center...</span>
        </div>
      </div>
    );
  }

  const hasValidKey = Boolean(
    clerkKey && clerkKey.startsWith('pk_') && !clerkKey.includes('placeholder')
  );

  if (hasValidKey) {
    return (
      <ClerkProvider
        publishableKey={clerkKey}
        localization={{
          formFieldInputPlaceholder__emailAddress: 'Enter your email address',
          formFieldInputPlaceholder__emailAddress_username: 'Enter your email address',
          formFieldInputPlaceholder__password: 'Enter your password',
          formFieldLabel__emailAddress: 'Email address',
          formFieldLabel__password: 'Password',
          formButtonPrimary: 'Continue →',
          formFieldAction__forgotPassword: 'Forgot password?',
        }}
      >
        <App />
      </ClerkProvider>
    );
  }

  return <SignInCard hasValidKey={false} />;
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
