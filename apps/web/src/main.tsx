import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import { App } from './App.js';
import { SignInCard } from './components/auth/SignInCard.js';
import './index.css';

const clerkPublishableKey = (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '').trim();
const hasValidKey = Boolean(
  clerkPublishableKey &&
    clerkPublishableKey.startsWith('pk_') &&
    !clerkPublishableKey.includes('placeholder')
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {hasValidKey ? (
      <ClerkProvider publishableKey={clerkPublishableKey}>
        <App />
      </ClerkProvider>
    ) : (
      <SignInCard hasValidKey={false} />
    )}
  </React.StrictMode>
);
