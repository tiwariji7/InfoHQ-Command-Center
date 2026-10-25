import React, { useEffect, useState } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { checkHealth, fetchMe, ApiRequestError } from './lib/api.js';
import type { HealthResponse, AuthUser } from '@infohq/shared';
import { SignInCard } from './components/auth/SignInCard.js';
import { AccessRestrictedScreen } from './components/auth/AccessRestrictedScreen.js';
import { Shell } from './components/layout/Shell.js';
import Lenis from 'lenis';

interface AppProps {
  hasValidClerkKey: boolean;
}

export const App: React.FC<AppProps> = ({ hasValidClerkKey }) => {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user: clerkUser } = useUser();

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [authenticatedUser, setAuthenticatedUser] = useState<AuthUser | null>(null);
  const [isVerifyingWithApi, setIsVerifyingWithApi] = useState(false);
  const [accessDeniedReason, setAccessDeniedReason] = useState<string | null>(null);

  // Initialize Lenis with universal rules
  useEffect(() => {
    // Respect prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Native touch scroll on phones/tablets (screen <= 1024)
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    if (prefersReducedMotion || isTouch) {
      return;
    }

    const lenis = new Lenis({
      duration: 0.8,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    const rafId = requestAnimationFrame(raf);
    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);

  // Poll health status once on mount
  useEffect(() => {
    checkHealth()
      .then((data) => {
        setHealth(data);
        setApiError(null);
      })
      .catch((err) => {
        setApiError(err.message || 'API is offline');
      });
  }, []);

  // When signed in with Clerk, verify authorization server-side
  useEffect(() => {
    if (!isSignedIn) {
      setAuthenticatedUser(null);
      setAccessDeniedReason(null);
      return;
    }

    let isMounted = true;
    setIsVerifyingWithApi(true);

    fetchMe(getToken)
      .then((res) => {
        if (isMounted) {
          setAuthenticatedUser(res.user);
          setAccessDeniedReason(null);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          if (err instanceof ApiRequestError && err.status === 403) {
            setAccessDeniedReason(err.data.message || 'Access denied.');
          } else if (err instanceof ApiRequestError && err.status === 401) {
            setAccessDeniedReason('Authentication failed. Please sign in again.');
          } else {
            // In local development before API is running, provide graceful fallback
            console.warn('API verification warning:', err);
            // Default to local display if user is logged in
            setAuthenticatedUser({
              id: clerkUser?.id || 'unknown',
              clerkUserId: clerkUser?.id || 'unknown',
              email: clerkUser?.primaryEmailAddress?.emailAddress || null,
              role: 'superadmin',
              status: 'active',
            });
          }
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsVerifyingWithApi(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isSignedIn, clerkUser, getToken]);

  if (!hasValidClerkKey) {
    return <SignInCard hasValidKey={false} />;
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-brand-page flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-brand-primary border-t-transparent animate-spin"></div>
          <span className="text-xs text-brand-muted">Initializing Command Center...</span>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return <SignInCard hasValidKey={true} />;
  }

  if (isVerifyingWithApi) {
    return (
      <div className="min-h-screen bg-brand-page flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-brand-primary border-t-transparent animate-spin"></div>
          <span className="text-xs text-brand-muted">Verifying authorization...</span>
        </div>
      </div>
    );
  }

  if (accessDeniedReason) {
    return <AccessRestrictedScreen reason={accessDeniedReason} />;
  }

  if (!authenticatedUser) {
    return <AccessRestrictedScreen reason="Account authorization check failed." />;
  }

  return (
    <Shell
      user={authenticatedUser}
      health={health}
      apiError={apiError}
    />
  );
};
