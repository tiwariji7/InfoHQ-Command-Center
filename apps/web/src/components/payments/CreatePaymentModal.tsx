import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import type { CreatePaymentInput, Payment, Project } from '@infohq/shared';
import { createPaymentApi, fetchProjects, generateRazorpayPaymentLinkApi } from '../../lib/api.js';
import { useDraggable } from '../../lib/useDraggable.js';
import {
  X,
  Loader2,
  Copy,
  Check,
  MessageCircle,
  FileText,
  CheckCircle2,
  Zap,
  AlertCircle,
  GripHorizontal,
  RotateCcw,
} from 'lucide-react';

export type MilestoneType = 'advance' | 'part' | 'final' | 'full';

interface CreatePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (payment: Payment) => void;
  onOpenInvoice?: (payment: Payment) => void;
  preSelectedProjectId?: string;
  preSelectedProjectTitle?: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  projectTotalCost?: number;
  alreadyReceived?: number;
  remainingBalance?: number;
}

function getInitials(name?: string): string {
  if (!name) return 'PL';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatRupees(amt: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amt);
}

export const CreatePaymentModal: React.FC<CreatePaymentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onOpenInvoice,
  preSelectedProjectId,
  preSelectedProjectTitle,
  clientName: initialClientName,
  clientPhone: initialClientPhone,
  clientEmail: _initialClientEmail,
  projectTotalCost: initialTotalCost = 0,
  alreadyReceived: initialReceived = 0,
  remainingBalance: initialRemaining,
}) => {
  const { getToken } = useAuth();
  const { cardRef, position, handlePointerDown, resetPosition } = useDraggable('create_payment_card');

  const [projectId, setProjectId] = useState(preSelectedProjectId || '');
  const [projectsList, setProjectsList] = useState<Project[]>([]);
  const [milestoneType, setMilestoneType] = useState<MilestoneType>('advance');
  const [title, setTitle] = useState('Advance Payment — Project Initiation');
  const [amount, setAmount] = useState('');
  const [percentage, setPercentage] = useState('30');
  const currency = 'INR';
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [dueDateStr, setDueDateStr] = useState('');
  const [notes, setNotes] = useState('');

  // Selected project details (if picked from dropdown)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // Flow & State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Link Generated Success State
  const [generatedPayment, setGeneratedPayment] = useState<Payment | null>(null);
  const [generatedLinkUrl, setGeneratedLinkUrl] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Escape key handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Load projects if not pre-selected
  useEffect(() => {
    if (preSelectedProjectId) {
      setProjectId(preSelectedProjectId);
    } else if (isOpen) {
      fetchProjects(getToken)
        .then((res) => {
          setProjectsList(res.projects);
          if (res.projects.length > 0 && !projectId) {
            setProjectId(res.projects[0].id);
            setSelectedProject(res.projects[0]);
          }
        })
        .catch((err) => console.error('Failed to load projects list:', err));
    }
  }, [isOpen, preSelectedProjectId, getToken, projectId]);

  // Update selected project when dropdown changes
  useEffect(() => {
    if (projectId && projectsList.length > 0) {
      const found = projectsList.find((p) => p.id === projectId);
      if (found) setSelectedProject(found);
    }
  }, [projectId, projectsList]);

  // Financial calculations
  const effectiveTotalCost = useMemo(() => {
    if (initialTotalCost > 0) return initialTotalCost;
    if (selectedProject?.budget) {
      const parsed = parseInt(selectedProject.budget.replace(/[^\d]/g, ''), 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return 0;
  }, [initialTotalCost, selectedProject]);

  const effectiveReceived = initialReceived;
  const effectiveRemaining = useMemo(() => {
    if (typeof initialRemaining === 'number') return initialRemaining;
    return Math.max(0, effectiveTotalCost - effectiveReceived);
  }, [initialRemaining, effectiveTotalCost, effectiveReceived]);

  const effectiveClientName =
    initialClientName || selectedProject?.clientName || 'Valued Client';
  const effectiveClientPhone = initialClientPhone || selectedProject?.clientPhone || '';
  const effectiveProjectTitle =
    preSelectedProjectTitle || selectedProject?.title || 'Website Development';

  // Handle milestone type change & auto calculation
  const applyMilestoneType = useCallback(
    (type: MilestoneType) => {
      setMilestoneType(type);
      setError(null);

      if (type === 'final') {
        const finalAmt = effectiveRemaining > 0 ? effectiveRemaining : Math.round(effectiveTotalCost * 0.4);
        setAmount(finalAmt > 0 ? String(finalAmt) : '');
        if (effectiveTotalCost > 0) {
          const pct = Math.min(100, Math.round((finalAmt / effectiveTotalCost) * 100));
          setPercentage(String(pct));
        } else {
          setPercentage('100');
        }
        setTitle('Final Payment — Project Completion & Handover');
      } else if (type === 'full') {
        const fullAmt = effectiveTotalCost > 0 ? effectiveTotalCost : effectiveRemaining;
        setAmount(fullAmt > 0 ? String(fullAmt) : '');
        setPercentage('100');
        setTitle('Full Payment — Complete Project Settlement');
      } else if (type === 'advance') {
        const advPct = 30;
        setPercentage(String(advPct));
        if (effectiveTotalCost > 0) {
          const advAmt = Math.round((effectiveTotalCost * advPct) / 100);
          setAmount(String(advAmt));
        }
        setTitle('Advance Payment — Project Initiation & Architecture');
      } else if (type === 'part') {
        const partPct = 30;
        setPercentage(String(partPct));
        if (effectiveTotalCost > 0) {
          const partAmt = Math.round((effectiveTotalCost * partPct) / 100);
          setAmount(String(partAmt));
        }
        setTitle('Part Payment — Mid-Sprint Milestone Delivery');
      }
    },
    [effectiveRemaining, effectiveTotalCost]
  );

  // Initialize defaults on open
  useEffect(() => {
    if (isOpen) {
      setGeneratedPayment(null);
      setGeneratedLinkUrl(null);
      setCopiedLink(false);
      setError(null);

      const d = new Date();
      d.setDate(d.getDate() + 3);
      setDueDateStr(d.toISOString().split('T')[0]);

      if (effectiveReceived > 0 && effectiveRemaining > 0) {
        applyMilestoneType('final');
      } else {
        applyMilestoneType('advance');
      }
    }
  }, [isOpen, applyMilestoneType, effectiveReceived, effectiveRemaining]);

  // Handle Amount change from input
  const handleAmountChange = (val: string) => {
    setAmount(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0 && effectiveTotalCost > 0) {
      const calcPct = Math.min(100, Math.round((num / effectiveTotalCost) * 100));
      setPercentage(String(calcPct));
    }
  };

  // Handle Percentage change from input
  const handlePercentageChange = (val: string) => {
    setPercentage(val);
    const numPct = parseFloat(val);
    if (!isNaN(numPct) && numPct > 0 && effectiveTotalCost > 0) {
      const calcAmt = Math.round((effectiveTotalCost * numPct) / 100);
      setAmount(String(calcAmt));
    }
  };

  // Quick Percentage Chips
  const handleChipClick = (pct: number) => {
    setPercentage(String(pct));
    if (effectiveTotalCost > 0) {
      const calcAmt = Math.round((effectiveTotalCost * pct) / 100);
      setAmount(String(calcAmt));
    }
  };

  // Remaining Chip Click
  const handleRemainingChipClick = () => {
    if (effectiveRemaining > 0) {
      setAmount(String(effectiveRemaining));
      if (effectiveTotalCost > 0) {
        const pct = Math.min(100, Math.round((effectiveRemaining / effectiveTotalCost) * 100));
        setPercentage(String(pct));
      }
      setMilestoneType('final');
      setTitle('Final Payment — Remaining Project Settlement');
    }
  };

  // Copy Link Handler
  const handleCopyLink = () => {
    if (!generatedLinkUrl) return;
    navigator.clipboard.writeText(generatedLinkUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Generate WhatsApp Share URL
  const waShareUrl = useMemo(() => {
    if (!generatedLinkUrl || !generatedPayment) return null;
    const cleanPhone = effectiveClientPhone.replace(/\D/g, '');
    const phoneParam = cleanPhone.length >= 10
      ? cleanPhone.startsWith('91') ? cleanPhone : '91' + cleanPhone
      : '';
    const message = 'Hello ' + effectiveClientName + ' ji,\n\nHere is the payment link for *' + generatedPayment.title + '* on your project *' + effectiveProjectTitle + '*:\n\n💳 *Amount:* ' + formatRupees(generatedPayment.amount) + '\n📄 *Invoice No:* ' + (generatedPayment.invoiceNumber || 'INV-2026') + '\n🔗 *Pay Securely Online:* ' + generatedLinkUrl + '\n\nPlease let us know once paid so our system records it immediately.\n\nThank you,\n*InfoHQ Command Center*';
    return 'https://wa.me/' + phoneParam + '?text=' + encodeURIComponent(message);
  }, [
    generatedLinkUrl,
    generatedPayment,
    effectiveClientName,
    effectiveClientPhone,
    effectiveProjectTitle,
  ]);

  // Handle Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!projectId) {
      setError('Please select a project.');
      return;
    }
    if (!title.trim()) {
      setError('Payment title or milestone description is required.');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid positive amount.');
      return;
    }

    setIsSubmitting(true);
    try {
      let dueDate: number | null = null;
      if (dueDateStr) {
        const parsed = new Date(dueDateStr).getTime();
        if (!isNaN(parsed)) {
          dueDate = parsed;
        }
      }

      const payload: CreatePaymentInput = {
        projectId,
        title: title.trim(),
        amount: numAmount,
        currency,
        invoiceNumber: invoiceNumber.trim() || undefined,
        dueDate: dueDate || undefined,
        notes: notes.trim() || undefined,
      };

      const res = await createPaymentApi(getToken, payload);
      const createdPayment = res.payment;
      onSuccess(createdPayment);

      // Check if Razorpay Link was created automatically by backend
      if (createdPayment.razorpayPaymentLinkUrl) {
        setGeneratedPayment(createdPayment);
        setGeneratedLinkUrl(createdPayment.razorpayPaymentLinkUrl);
      } else {
        try {
          const linkRes = await generateRazorpayPaymentLinkApi(getToken, createdPayment.id);
          if (linkRes.success && linkRes.paymentLinkUrl) {
            createdPayment.razorpayPaymentLinkUrl = linkRes.paymentLinkUrl;
            setGeneratedPayment(createdPayment);
            setGeneratedLinkUrl(linkRes.paymentLinkUrl);
          } else {
            setGeneratedPayment(createdPayment);
          }
        } catch (linkErr) {
          console.warn('Fallback link generation:', linkErr);
          setGeneratedPayment(createdPayment);
        }
      }
    } catch (err: unknown) {
      console.error('Failed to create payment milestone:', err);
      setError(err instanceof Error ? err.message : 'Failed to create payment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForAnother = () => {
    setGeneratedPayment(null);
    setGeneratedLinkUrl(null);
    setCopiedLink(false);
    setError(null);
    if (effectiveRemaining > 0) {
      applyMilestoneType('final');
    } else {
      applyMilestoneType('advance');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end items-center sm:pr-5 p-3 transition-opacity animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      data-lenis-prevent="true"
      onClick={onClose}
    >
      {/* Floating Popup Card (Matches Profile Card layout, rounded-3xl, 4-side draggable) */}
      <div
        ref={cardRef}
        className="popup-card relative w-full sm:w-[420px] max-w-[420px] h-[calc(100vh-2.5rem)] max-h-[820px] bg-white rounded-3xl shadow-[0_25px_60px_-15px_rgba(26,8,92,0.30)] border border-[#E5E1F0] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
        data-lenis-prevent="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ========================================================= */}
        {/* 4-SIDE DRAG GRIPS (Left & Right Edge Drag Strips)         */}
        {/* ========================================================= */}
        <div
          onPointerDown={handlePointerDown}
          onDoubleClick={resetPosition}
          className="absolute left-0 top-12 bottom-8 w-3.5 z-30 cursor-grab active:cursor-grabbing hover:bg-purple-500/10 transition-colors"
          style={{ touchAction: 'none' }}
          title="Drag left border to move card"
        />
        <div
          onPointerDown={handlePointerDown}
          onDoubleClick={resetPosition}
          className="absolute right-0 top-12 bottom-8 w-3.5 z-30 cursor-grab active:cursor-grabbing hover:bg-purple-500/10 transition-colors"
          style={{ touchAction: 'none' }}
          title="Drag right border to move card"
        />

        {/* ========================================================= */}
        {/* 1. TOP TITLE BAR (Pinned at top & Top Drag Handle)        */}
        {/* ========================================================= */}
        <div
          onPointerDown={handlePointerDown}
          onDoubleClick={resetPosition}
          style={{ touchAction: 'none' }}
          className="px-4 py-3 border-b border-[#E5E1F0] flex items-center justify-between bg-white shrink-0 z-20 cursor-grab active:cursor-grabbing select-none"
          title="Click and drag from any edge to move • Double-click to reset position"
        >
          <div className="flex items-center gap-2 text-[#1A085C]">
            <div className="w-6 h-6 rounded-lg bg-[#F3F0FF] flex items-center justify-center text-[#5B4CF5]">
              <Zap size={14} />
            </div>
            <h2 className="text-xs font-bold text-[#1A085C] tracking-tight">Create Payment Link</h2>
          </div>

          {/* Drag Handle Indicator */}
          <div
            className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F3F0FF]/80 text-[#7C5CE8] text-[10px] font-semibold"
            title="Drag from 4 sides or header to move"
          >
            <GripHorizontal size={14} />
            <span className="hidden sm:inline">Move</span>
          </div>

          <button
            onClick={onClose}
            data-no-drag="true"
            className="w-7 h-7 rounded-lg text-[#6B7280] hover:text-[#1A085C] hover:bg-[#F3F0FF] flex items-center justify-center transition-colors cursor-pointer"
            title="Close"
          >
            <X size={15} />
          </button>
        </div>

        {/* ========================================================= */}
        {/* 2. PROFILE HERO HEADER (Avatar, Title, Financial Stats)   */}
        {/* ========================================================= */}
        <div className="p-4 bg-gradient-to-b from-[#FBFBFE] to-white border-b border-[#E5E1F0] shrink-0">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#5B4CF5] to-[#7C5CE8] text-white flex items-center justify-center font-black text-sm shadow-xs shrink-0">
              {getInitials(effectiveClientName || effectiveProjectTitle)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-sm font-black text-[#1A085C] truncate">
                  {effectiveProjectTitle}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F3F0FF] text-[#5B4CF5] border border-[#5B4CF5]/20 shrink-0">
                  Razorpay Live
                </span>
              </div>
              <p className="text-[11px] text-[#6B7280] font-medium truncate mt-0.5">
                Client: <span className="text-[#1A085C] font-semibold">{effectiveClientName}</span>
                {effectiveClientPhone && ` • ${effectiveClientPhone}`}
              </p>
            </div>
          </div>

          {/* Financial 3-Stat Summary Strip */}
          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-[#E5E1F0]/60">
            <div className="p-2 rounded-xl bg-white border border-[#E5E1F0]/80">
              <span className="text-[9.5px] uppercase tracking-wider text-[#6B7280] font-bold block">Total Cost</span>
              <span className="text-xs font-black text-[#1A085C] mt-0.5 block truncate">
                {effectiveTotalCost > 0 ? formatRupees(effectiveTotalCost) : '₹0'}
              </span>
            </div>

            <div className="p-2 rounded-xl bg-white border border-[#E5E1F0]/80">
              <span className="text-[9.5px] uppercase tracking-wider text-[#16A34A] font-bold block">Received</span>
              <span className="text-xs font-black text-[#16A34A] mt-0.5 block truncate">
                {formatRupees(effectiveReceived)}
              </span>
            </div>

            <div className="p-2 rounded-xl bg-white border border-[#E5E1F0]/80">
              <span className="text-[9.5px] uppercase tracking-wider text-[#D97706] font-bold block">Remaining</span>
              <span className="text-xs font-black text-[#D97706] mt-0.5 block truncate">
                {formatRupees(effectiveRemaining)}
              </span>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 3. SCROLLABLE BODY (Scrollable on cursor hover across card)*/}
        {/* ========================================================= */}
        <div
          className="flex-1 min-h-0 overflow-y-auto popup-scroll p-4 space-y-3.5 focus:outline-none"
          style={{ touchAction: 'pan-y' }}
          data-lenis-prevent="true"
          tabIndex={0}
        >
          {generatedPayment ? (
            /* ========================================================= */
            /* SUCCESS VIEW: LINK GENERATED                              */
            /* ========================================================= */
            <div className="space-y-4 text-center py-2">
              <div className="w-14 h-14 rounded-full bg-emerald-50 text-[#16A34A] border border-emerald-200 mx-auto flex items-center justify-center shadow-xs">
                <CheckCircle2 size={30} />
              </div>

              <div>
                <h3 className="text-sm font-black text-[#1A085C]">
                  Payment Link Generated Successfully!
                </h3>
                <p className="text-xs text-[#6B7280] mt-1">
                  Amount: <span className="font-black text-[#1A085C]">{formatRupees(generatedPayment.amount)}</span>
                  {' • '}
                  Invoice: <span className="font-mono font-bold text-[#5B4CF5]">{generatedPayment.invoiceNumber || 'INV-2026'}</span>
                </p>
              </div>

              {/* Generated Link URL Box */}
              {generatedLinkUrl ? (
                <div className="p-3 bg-[#FAF9FD] rounded-2xl border border-[#E5E1F0] space-y-2 text-left">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#6B7280] block">
                    Razorpay Live Short Link
                  </span>
                  <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-[#E5E1F0]">
                    <span className="font-mono text-xs text-[#1A085C] font-semibold truncate flex-1 select-all">
                      {generatedLinkUrl}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="px-2.5 py-1 rounded-lg bg-[#5B4CF5] hover:bg-[#4C3DE0] text-white text-[11px] font-bold flex items-center gap-1 transition-colors shrink-0 shadow-2xs cursor-pointer"
                    >
                      {copiedLink ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedLink ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-800 text-left">
                  Milestone created. Razorpay keys are processing or offline. You can record payments manually or view invoice below.
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-1 gap-2 pt-1">
                {waShareUrl && (
                  <a
                    href={waShareUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="h-10 px-3 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                  >
                    <MessageCircle size={15} />
                    <span>Send on WhatsApp</span>
                  </a>
                )}

                {onOpenInvoice && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenInvoice(generatedPayment);
                      onClose();
                    }}
                    className="h-10 px-3 rounded-xl bg-white hover:bg-purple-50 border border-[#5B4CF5] text-[#5B4CF5] text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <FileText size={15} />
                    <span>View Branded Invoice</span>
                  </button>
                )}
              </div>

              <div className="p-2.5 rounded-xl bg-[#FAF9FD] border border-[#E5E1F0] text-[11px] text-[#6B7280]">
                🔔 Telegram &amp; CRM notification dispatched automatically.
              </div>
            </div>
          ) : (
            /* ========================================================= */
            /* CREATE PAYMENT FORM                                       */
            /* ========================================================= */
            <form id="create-payment-link-form" onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              {error && (
                <div className="p-3 bg-red-50 text-rose-600 rounded-xl border border-red-200 text-xs flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Project Selection (if not preselected) */}
              {!preSelectedProjectId && (
                <div>
                  <label className="block font-bold text-[#1A085C] mb-1">
                    Select Project <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full h-9 px-3 border border-[#E5E1F0] rounded-xl focus:border-[#5B4CF5] focus:outline-none bg-white text-xs font-semibold text-[#1A085C]"
                  >
                    <option value="">Choose Project</option>
                    {projectsList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} ({p.clientName})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* ========================================================= */}
              {/* QUESTION 1: Client ko kis cheez ka payment karna hai?       */}
              {/* ========================================================= */}
              <div>
                <label className="block font-black text-[#1A085C] mb-1.5 text-xs">
                  Client ko kis cheez ka payment karna hai?
                </label>

                <div className="grid grid-cols-2 gap-2">
                  {/* Advance Payment */}
                  <button
                    type="button"
                    onClick={() => applyMilestoneType('advance')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      milestoneType === 'advance'
                        ? 'border-[#5B4CF5] bg-[#F5F3FF] ring-2 ring-[#5B4CF5]/20'
                        : 'border-[#E5E1F0] bg-white hover:border-[#5B4CF5]/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-[#1A085C]">Advance Payment</span>
                      {milestoneType === 'advance' && (
                        <span className="w-2 h-2 rounded-full bg-[#5B4CF5]" />
                      )}
                    </div>
                    <span className="text-[10px] text-[#6B7280] mt-0.5 block">
                      shuru mein payment
                    </span>
                  </button>

                  {/* Part Payment */}
                  <button
                    type="button"
                    onClick={() => applyMilestoneType('part')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      milestoneType === 'part'
                        ? 'border-[#5B4CF5] bg-[#F5F3FF] ring-2 ring-[#5B4CF5]/20'
                        : 'border-[#E5E1F0] bg-white hover:border-[#5B4CF5]/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-[#1A085C]">Part Payment</span>
                      {milestoneType === 'part' && (
                        <span className="w-2 h-2 rounded-full bg-[#5B4CF5]" />
                      )}
                    </div>
                    <span className="text-[10px] text-[#6B7280] mt-0.5 block">
                      beech mein payment
                    </span>
                  </button>

                  {/* Final Payment */}
                  <button
                    type="button"
                    onClick={() => applyMilestoneType('final')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      milestoneType === 'final'
                        ? 'border-[#5B4CF5] bg-[#F5F3FF] ring-2 ring-[#5B4CF5]/20'
                        : 'border-[#E5E1F0] bg-white hover:border-[#5B4CF5]/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-[#1A085C]">Final Payment</span>
                      {milestoneType === 'final' && (
                        <span className="w-2 h-2 rounded-full bg-[#5B4CF5]" />
                      )}
                    </div>
                    <span className="text-[10px] text-[#16A34A] font-semibold mt-0.5 block truncate">
                      aakhir mein bacha ({formatRupees(effectiveRemaining)})
                    </span>
                  </button>

                  {/* Full Payment */}
                  <button
                    type="button"
                    onClick={() => applyMilestoneType('full')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      milestoneType === 'full'
                        ? 'border-[#5B4CF5] bg-[#F5F3FF] ring-2 ring-[#5B4CF5]/20'
                        : 'border-[#E5E1F0] bg-white hover:border-[#5B4CF5]/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-[#1A085C]">Full Payment</span>
                      {milestoneType === 'full' && (
                        <span className="w-2 h-2 rounded-full bg-[#5B4CF5]" />
                      )}
                    </div>
                    <span className="text-[10px] text-[#6B7280] mt-0.5 block truncate">
                      poora ek saath ({formatRupees(effectiveTotalCost)})
                    </span>
                  </button>
                </div>
              </div>

              {/* ========================================================= */}
              {/* QUESTION 2: Kitna payment lena hai? (Amount & Percentage)   */}
              {/* ========================================================= */}
              <div className="space-y-2">
                <label className="block font-black text-[#1A085C] text-xs">
                  Kitna payment lena hai?
                </label>

                <div className="grid grid-cols-2 gap-2">
                  {/* Amount ₹ */}
                  <div>
                    <span className="text-[10.5px] font-semibold text-[#6B7280] block mb-1">
                      Amount (₹)
                    </span>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-[#6B7280] font-bold text-xs">
                        ₹
                      </span>
                      <input
                        type="number"
                        step="any"
                        required
                        value={amount}
                        onChange={(e) => handleAmountChange(e.target.value)}
                        placeholder="e.g. 15000"
                        className="w-full h-9 pl-7 pr-3 border border-[#E5E1F0] rounded-xl focus:border-[#5B4CF5] focus:outline-none font-bold text-xs text-[#1A085C]"
                      />
                    </div>
                  </div>

                  {/* Percentage % */}
                  <div>
                    <span className="text-[10.5px] font-semibold text-[#6B7280] block mb-1">
                      Percentage (%)
                    </span>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={percentage}
                        onChange={(e) => handlePercentageChange(e.target.value)}
                        placeholder="30"
                        className="w-full h-9 px-3 pr-7 border border-[#E5E1F0] rounded-xl focus:border-[#5B4CF5] focus:outline-none font-bold text-xs text-[#1A085C]"
                      />
                      <span className="absolute right-3 top-2.5 text-[#6B7280] font-bold text-xs">
                        %
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Percentage Chips */}
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  {[20, 30, 50, 75, 100].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handleChipClick(p)}
                      className={`px-2 py-0.5 rounded-lg text-[10.5px] font-bold border transition-colors cursor-pointer ${
                        percentage === String(p)
                          ? 'bg-[#5B4CF5] text-white border-[#5B4CF5]'
                          : 'bg-white text-[#6B7280] border-[#E5E1F0] hover:text-[#1A085C]'
                      }`}
                    >
                      {p}%
                    </button>
                  ))}

                  {effectiveRemaining > 0 && (
                    <button
                      type="button"
                      onClick={handleRemainingChipClick}
                      className="px-2.5 py-0.5 rounded-lg text-[10.5px] font-bold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
                    >
                      Remaining ({formatRupees(effectiveRemaining)})
                    </button>
                  )}
                </div>

                <p className="text-[10px] text-[#6B7280] italic">
                  * Amount manually enter karo ya percentage chip chuno.
                </p>
              </div>

              {/* ========================================================= */}
              {/* PAYMENT DESCRIPTION                                       */}
              {/* ========================================================= */}
              <div>
                <label className="block font-black text-[#1A085C] mb-1 text-xs">
                  Payment Description / Milestone Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Advance Payment — Project Initiation"
                  className="w-full h-9 px-3 border border-[#E5E1F0] rounded-xl focus:border-[#5B4CF5] focus:outline-none text-xs font-semibold text-[#1A085C]"
                />
              </div>

              {/* Due Date & Invoice Number (Compact row) */}
              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <div>
                  <label className="block font-semibold text-[#6B7280] text-[10.5px] mb-1">
                    Payment Due Date
                  </label>
                  <input
                    type="date"
                    value={dueDateStr}
                    onChange={(e) => setDueDateStr(e.target.value)}
                    className="w-full h-8 px-2 border border-[#E5E1F0] rounded-xl focus:border-[#5B4CF5] focus:outline-none text-[11px] text-[#1A085C]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#6B7280] text-[10.5px] mb-1">
                    Invoice Number
                  </label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="Auto (INV-2026-XXXX)"
                    className="w-full h-8 px-2 border border-[#E5E1F0] rounded-xl focus:border-[#5B4CF5] focus:outline-none font-mono text-[11px] text-[#1A085C]"
                  />
                </div>
              </div>

              {/* Internal Notes / Terms */}
              <div>
                <label className="block font-semibold text-[#6B7280] text-[10.5px] mb-1">
                  Terms / Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Advance milestone payable before initiation..."
                  className="w-full px-2.5 py-1.5 border border-[#E5E1F0] rounded-xl focus:border-[#5B4CF5] focus:outline-none text-[11px] text-[#1A085C] resize-none"
                />
              </div>
            </form>
          )}
        </div>

        {/* ========================================================= */}
        {/* PINNED BOTTOM ACTION BAR                                  */}
        {/* ========================================================= */}
        <div className="p-3 bg-white border-t border-[#E5E1F0] shrink-0 flex items-center justify-end gap-2">
          {generatedPayment ? (
            <>
              <button
                type="button"
                onClick={handleResetForAnother}
                className="h-9 px-3.5 rounded-full bg-[#FAF9FD] hover:bg-[#F3F0FF] text-[#1A085C] border border-[#E5E1F0] text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <RotateCcw size={13} />
                <span>Create Another</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="h-9 px-5 rounded-full bg-gradient-to-r from-[#5B4CF5] to-[#7C5CE8] hover:from-[#4C3DE0] hover:to-[#6B4BE0] text-white text-xs font-black transition-all cursor-pointer shadow-xs"
              >
                Done
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="h-9 px-4 rounded-full bg-[#FAF9FD] hover:bg-[#F3F0FF] text-[#1A085C] border border-[#E5E1F0] text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="create-payment-link-form"
                disabled={isSubmitting || !amount || parseFloat(amount) <= 0}
                className="h-9 px-5 rounded-full bg-gradient-to-r from-[#5B4CF5] to-[#7C5CE8] hover:from-[#4C3DE0] hover:to-[#6B4BE0] text-white text-xs font-black flex items-center gap-1.5 shadow-[0_4px_14px_rgba(91,76,245,0.35)] transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Generating Link...</span>
                  </>
                ) : (
                  <>
                    <Zap size={13} />
                    <span>Generate Payment Link</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>

        {/* ========================================================= */}
        {/* BOTTOM DRAG GRIP BAR (4th Side Bottom Drag Handle)        */}
        {/* ========================================================= */}
        <div
          onPointerDown={handlePointerDown}
          onDoubleClick={resetPosition}
          style={{ touchAction: 'none' }}
          className="w-full py-2 bg-gradient-to-t from-[#F8F7FC] to-white border-t border-[#E5E1F0] flex items-center justify-center cursor-grab active:cursor-grabbing select-none shrink-0 hover:bg-[#F3F0FF] transition-colors"
          title="Drag bottom border to move card • Double-click to reset"
        >
          <div className="w-12 h-1 bg-[#D1D5DB] hover:bg-[#7C5CE8] rounded-full transition-colors" />
        </div>
      </div>
    </div>
  );
};
