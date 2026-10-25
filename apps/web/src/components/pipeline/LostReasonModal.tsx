import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';

interface LostReasonModalProps {
  isOpen: boolean;
  leadName: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isSubmitting?: boolean;
}

const PRESET_REASONS = [
  'Budget out of scope / Too high',
  'Chose competitor',
  'Client unresponsive / Ghosted',
  'Project cancelled or deferred',
  'Requirements mismatch',
  'Other',
];

export const LostReasonModal: React.FC<LostReasonModalProps> = ({
  isOpen,
  leadName,
  onClose,
  onConfirm,
  isSubmitting = false,
}) => {
  const [selectedReason, setSelectedReason] = useState(PRESET_REASONS[0]);
  const [customReason, setCustomReason] = useState('');

  if (!isOpen) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const finalReason =
      selectedReason === 'Other'
        ? customReason.trim() || 'Other'
        : selectedReason;
    onConfirm(finalReason);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-heading/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lost-dialog-title"
    >
      <div className="bg-white rounded-card w-full max-w-md border border-brand-border shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-chip bg-red-50 text-brand-destructive flex items-center justify-center">
              <AlertCircle size={18} />
            </div>
            <div>
              <h2 id="lost-dialog-title" className="text-base font-semibold text-brand-heading">
                Mark Lead as Lost
              </h2>
              <p className="text-xs text-brand-muted truncate max-w-[260px]">
                {leadName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-chip text-brand-muted hover:text-brand-heading hover:bg-brand-section transition-colors"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-brand-heading mb-1.5">
              Reason for Loss
            </label>
            <div className="space-y-2">
              {PRESET_REASONS.map((reason) => (
                <label
                  key={reason}
                  className={`flex items-center gap-2.5 p-2.5 rounded-control border text-xs cursor-pointer transition-colors ${
                    selectedReason === reason
                      ? 'border-brand-primary bg-brand-subtle/50 text-brand-heading font-medium'
                      : 'border-brand-border bg-white text-brand-body hover:bg-brand-section'
                  }`}
                >
                  <input
                    type="radio"
                    name="lostReason"
                    value={reason}
                    checked={selectedReason === reason}
                    onChange={() => setSelectedReason(reason)}
                    className="text-brand-primary focus:ring-brand-primary"
                  />
                  <span>{reason}</span>
                </label>
              ))}
            </div>
          </div>

          {selectedReason === 'Other' && (
            <div>
              <label className="block text-xs font-semibold text-brand-heading mb-1">
                Specific Details
              </label>
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Briefly state reason..."
                className="w-full h-10 px-3 rounded-control border border-brand-border text-xs text-brand-heading placeholder:text-brand-lightGray focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-colors"
                autoFocus
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-brand-border">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="hq-btn-secondary text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-control bg-brand-destructive text-white hover:bg-red-700 transition-colors text-xs font-medium"
            >
              {isSubmitting ? 'Saving...' : 'Confirm Lost'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
