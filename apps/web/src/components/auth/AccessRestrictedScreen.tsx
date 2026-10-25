import React from 'react';
import { useClerk, useUser } from '@clerk/clerk-react';
import { ShieldAlert, LogOut } from 'lucide-react';

interface AccessRestrictedScreenProps {
  reason?: string;
}

export const AccessRestrictedScreen: React.FC<AccessRestrictedScreenProps> = ({
  reason = 'Your account is not authorized to access InfoHQ Command Center.',
}) => {
  const { signOut } = useClerk();
  const { user } = useUser();

  const userEmail = user?.primaryEmailAddress?.emailAddress || 'Signed-in user';

  return (
    <div className="min-h-screen bg-brand-page flex items-center justify-center p-4">
      <div className="w-full max-w-md hq-card border-brand-border bg-white text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-brand-errorBg flex items-center justify-center mb-4 text-brand-destructive">
          <ShieldAlert size={24} />
        </div>

        <h1 className="text-xl font-semibold text-brand-heading mb-2">
          Access Restricted
        </h1>

        <p className="text-sm text-brand-body mb-4">
          {reason}
        </p>

        <div className="p-3 bg-brand-section rounded-control border border-brand-border text-xs text-brand-muted mb-6">
          <span className="font-medium text-brand-heading">Account:</span> {userEmail}
          <div className="mt-1">
            Access level: <span className="font-medium text-brand-heading">Authorized Team Member</span>
          </div>
        </div>

        <button
          onClick={() => signOut()}
          className="w-full hq-btn-secondary justify-center text-sm"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </div>
  );
};
