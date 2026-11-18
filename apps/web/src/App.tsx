import React, { useEffect, useState } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { checkHealth, fetchMe, ApiRequestError, logUserLoginApi } from './lib/api.js';
import type { HealthResponse, AuthUser } from '@infohq/shared';
import { SignInCard } from './components/auth/SignInCard.js';
import { AccessRestrictedScreen } from './components/auth/AccessRestrictedScreen.js';
import { Shell } from './components/layout/Shell.js';
import { ClientPortalView } from './components/portal/ClientPortalView.js';
import Lenis from 'lenis';

export const App: React.FC = () => {
  // Check if current route is for Client Portal (token-gated magic link, bypasses Clerk login)
  const [portalToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#\/?/, '?'));
    const token =
      urlParams.get('token') ||
      urlParams.get('portal_token') ||
      hashParams.get('token') ||
      hashParams.get('portal_token');
    const isPortalPath = window.location.pathname.startsWith('/portal');
    if (token) return token;
    if (isPortalPath) return '';
    return null;
  });

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
      prevent: (node) => {
        return Boolean(
          node.hasAttribute?.('data-lenis-prevent') ||
          node.closest?.('[data-lenis-prevent], .popup-scroll, .popup-card, [role="dialog"]')
        );
      },
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

  const clerkUserId = clerkUser?.id;
  const userEmail = clerkUser?.primaryEmailAddress?.emailAddress;

  // When signed in with Clerk, verify authorization server-side
  useEffect(() => {
    if (!isSignedIn || !clerkUserId) {
      setAuthenticatedUser(null);
      setAccessDeniedReason(null);
      return;
    }

    let isMounted = true;
    // Only show full-screen verification on INITIAL load before authenticatedUser is established
    // Once authenticated, background re-verifications happen silently without unmounting <Shell />
    if (!authenticatedUser) {
      setIsVerifyingWithApi(true);
    }

    fetchMe(getToken)
      .then((res) => {
        if (isMounted) {
          setAuthenticatedUser(res.user);
          setAccessDeniedReason(null);

          // Log user login once per browser session
          const sessionKey = `ihq_auth_session_${res.user.id}`;
          if (typeof window !== 'undefined' && !sessionStorage.getItem(sessionKey)) {
            sessionStorage.setItem(sessionKey, 'active');
            logUserLoginApi(getToken);
          }
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
              id: clerkUserId,
              clerkUserId: clerkUserId,
              email: userEmail || null,
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
  }, [isSignedIn, clerkUserId]);

  const [initTimeoutReached, setInitTimeoutReached] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setInitTimeoutReached(true);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  // Render public token-gated Client Portal immediately without requiring Clerk login
  if (portalToken !== null) {
    return <ClientPortalView token={portalToken} />;
  }

  if (!isLoaded && !initTimeoutReached) {
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

  // Only block the UI if we don't have an authenticated user yet
  if (isVerifyingWithApi && !authenticatedUser) {
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
