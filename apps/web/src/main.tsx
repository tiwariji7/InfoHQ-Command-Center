import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import { App } from './App.js';
import './index.css';

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '';
const hasValidKey = Boolean(
  clerkPublishableKey &&
    clerkPublishableKey.startsWith('pk_') &&
    !clerkPublishableKey.includes('placeholder')
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {hasValidKey ? (
      <ClerkProvider publishableKey={clerkPublishableKey}>
        <App hasValidClerkKey={true} />
      </ClerkProvider>
    ) : (
      <App hasValidClerkKey={false} />
    )}
  </React.StrictMode>
);
