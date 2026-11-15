import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  FolderKanban,
  Receipt,
  Users,
  Inbox,
  ArrowRight,
  Plus,
  Compass,
  ListTodo,
  Sparkles,
  Command,
  X,
} from 'lucide-react';
import type { Project, Payment, Lead } from '@infohq/shared';

export interface CommandPaletteItem {
  id: string;
  type: 'navigation' | 'lead' | 'project' | 'invoice' | 'action';
  title: string;
  subtitle?: string;
  badge?: string;
  action: () => void;
  icon: React.ElementType;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tabId: string) => void;
  leads?: Lead[];
  projects?: Project[];
  payments?: Payment[];
  onOpenCreateInvoice?: () => void;
  onOpenCreateLead?: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  leads = [],
  projects = [],
  payments = [],
  onOpenCreateInvoice,
  onOpenCreateLead,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Construct items
  const items: CommandPaletteItem[] = useMemo(() => {
    const list: CommandPaletteItem[] = [];

    // Quick Actions
    if (onOpenCreateInvoice) {
      list.push({
        id: 'action-create-invoice',
        type: 'action',
        title: 'Create New Invoice / Milestone',
        subtitle: 'Generate Razorpay payment link & milestone bill',
        badge: 'Action',
        icon: Plus,
        action: () => {
          onClose();
          onOpenCreateInvoice();
        },
      });
    }

    if (onOpenCreateLead) {
      list.push({
        id: 'action-create-lead',
        type: 'action',
        title: 'Add New Inbound Lead',
        subtitle: 'Record contact details, budget & service needed',
        badge: 'Action',
        icon: Plus,
        action: () => {
          onClose();
          onOpenCreateLead();
        },
      });
    }

    // Direct Navigations
    const navs: Array<{ id: string; label: string; sub: string; icon: React.ElementType }> = [
      { id: 'dashboard', label: 'Overview Dashboard', sub: 'Real-time metrics & financial ledger', icon: Compass },
      { id: 'leads', label: 'Leads Inbox', sub: 'Manage inbound queries & deal intake', icon: Inbox },
      { id: 'pipeline', label: 'Sales Pipeline (Kanban)', sub: 'Track deal stages from Discovery to Won', icon: FolderKanban },
      { id: 'projects', label: 'Projects & Engineering', sub: 'Active deliverables, milestones & deadlines', icon: FolderKanban },
      { id: 'tasks', label: 'Tasks & Sprints', sub: 'Engineering sprints & task boards', icon: ListTodo },
      { id: 'payments', label: 'Invoices & Billing', sub: 'Razorpay links, receipts & overdue dues', icon: Receipt },
      { id: 'clients', label: 'Client Directory', sub: 'Client profiles, total billed & ledgers', icon: Users },
    ];

    navs.forEach((n) => {
      list.push({
        id: `nav-${n.id}`,
        type: 'navigation',
        title: n.label,
        subtitle: n.sub,
        badge: 'Go to',
        icon: n.icon,
        action: () => {
          onClose();
          onNavigateTab(n.id);
        },
      });
    });

    // Invoices list
    payments.slice(0, 15).forEach((p) => {
      const invNum = p.invoiceNumber || p.id.slice(0, 12);
      list.push({
        id: `inv-${p.id}`,
        type: 'invoice',
        title: `${invNum} — ₹${Number(p.amount).toLocaleString('en-IN')}`,
        subtitle: `${p.clientName || 'Client'} • ${p.title || 'Milestone'} • ${p.status.toUpperCase()}`,
        badge: 'Invoice',
        icon: Receipt,
        action: () => {
          onClose();
          onNavigateTab('payments');
        },
      });
    });

    // Projects list
    projects.slice(0, 15).forEach((pr) => {
      list.push({
        id: `proj-${pr.id}`,
        type: 'project',
        title: pr.title,
        subtitle: `${pr.clientName} • Status: ${pr.status} • Budget: ${pr.budget || '—'}`,
        badge: 'Project',
        icon: FolderKanban,
        action: () => {
          onClose();
          onNavigateTab('projects');
        },
      });
    });

    // Leads list
    leads.slice(0, 15).forEach((ld) => {
      list.push({
        id: `lead-${ld.id}`,
        type: 'lead',
        title: ld.name,
        subtitle: `${ld.company || ld.serviceNeeded || 'Lead'} • Stage: ${ld.stage.toUpperCase()}`,
        badge: 'Lead',
        icon: Users,
        action: () => {
          onClose();
          onNavigateTab('leads');
        },
      });
    });

    return list;
  }, [leads, projects, payments, onNavigateTab, onClose, onOpenCreateInvoice, onOpenCreateLead]);

  // Filter based on query
  const filteredItems = useMemo(() => {
    if (!query.trim()) return items.slice(0, 12);
    const q = query.toLowerCase().trim();
    return items
      .filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          (i.subtitle && i.subtitle.toLowerCase().includes(q)) ||
          i.type.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [items, query]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1 < filteredItems.length ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filteredItems.length - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = filteredItems[selectedIndex];
        if (selected) {
          selected.action();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex, onClose]);

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector('[data-active="true"]') as HTMLElement | null;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-[#1A085C]/30 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-[0_20px_60px_-15px_rgba(26,8,92,0.25)] border border-[#EAE6F7] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#EAE6F7] bg-[#F8F8FF]/50">
          <Search size={18} className="text-[#7C5CE8] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search leads, projects, invoices, or type a command..."
            className="flex-1 bg-transparent text-sm text-[#1A085C] placeholder:text-[#6B7280]/70 outline-none font-medium"
          />
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white border border-[#EAE6F7] text-[#6B7280]">
              ESC to close
            </span>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-[#6B7280] hover:text-[#1A085C] hover:bg-white"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Results List */}
        <div ref={listRef} className="max-h-[380px] overflow-y-auto p-2 space-y-1">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#6B7280]">
              <Sparkles size={24} className="mx-auto mb-2 text-[#7C5CE8]/60" />
              <p className="font-semibold text-[#1A085C]">No results found</p>
              <p className="text-[11px] mt-0.5">Try searching with a different client name, invoice number, or title.</p>
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  data-active={isSelected ? 'true' : 'false'}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[#F3F0FF] text-[#1A085C]'
                      : 'hover:bg-[#F8F8FF] text-[#374151]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-[#7C5CE8] text-white shadow-2xs'
                          : 'bg-[#F8F8FF] text-[#7C5CE8] border border-[#EAE6F7]'
                      }`}
                    >
                      <Icon size={15} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate flex items-center gap-2 text-[#1A085C]">
                        {item.title}
                      </div>
                      {item.subtitle && (
                        <div className="text-[11px] text-[#6B7280] truncate font-medium">
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.badge && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white border border-[#EAE6F7] text-[#6B7280]">
                        {item.badge}
                      </span>
                    )}
                    {isSelected && <ArrowRight size={13} className="text-[#7C5CE8]" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 border-t border-[#EAE6F7] bg-[#F8F8FF] flex items-center justify-between text-[11px] text-[#6B7280] font-medium">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-[#EAE6F7] text-[10px] font-mono">↑</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-[#EAE6F7] text-[10px] font-mono">↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-[#EAE6F7] text-[10px] font-mono">↵</kbd>
              Open
            </span>
          </div>
          <div className="text-[#7C5CE8] font-bold flex items-center gap-1">
            <Command size={12} /> InfoHQ Command Palette
          </div>
        </div>
      </div>
    </div>
  );
};
