import React from 'react';
import {
  Building2,
  CheckSquare,
  Rocket,
  FileText,
  BarChart3,
  Users,
  Mail,
  Settings,
  ShieldCheck,
  Plus,
  ArrowRight,
  Database,
  Cloud,
  CheckCircle2,
  Calendar,
} from 'lucide-react';

interface ModulePlaceholderViewProps {
  moduleKey: string;
  title: string;
  subtitle: string;
  section: string;
  onNavigateTab: (tab: string) => void;
}

export const ModulePlaceholderView: React.FC<ModulePlaceholderViewProps> = ({
  moduleKey,
  title,
  subtitle,
  section,
  onNavigateTab,
}) => {
  // Render specialized high-grade views for Clients, Deployments, and Settings
  if (moduleKey === 'clients') {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-[20px] border border-brand-border p-5 sm:p-6 shadow-[0_8px_30px_rgba(26,8,92,0.05),0_1px_3px_rgba(26,8,92,0.02)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center">
                <Building2 size={20} />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-brand-heading">
                  {title}
                </h1>
                <p className="text-xs sm:text-sm text-brand-muted mt-0.5">{subtitle}</p>
              </div>
            </div>
            <button
              onClick={() => onNavigateTab('leads')}
              className="h-9 px-4 rounded-control text-xs font-semibold text-white bg-gradient-to-r from-[#5B4CF5] via-[#7C5CE8] to-[#914FBB] flex items-center gap-1.5 shadow-md hover:opacity-95 transition-all self-start sm:self-auto cursor-pointer"
            >
              <Plus size={14} />
              <span>Convert Lead to Client</span>
            </button>
          </div>
        </div>

        {/* Empty State / Directory Notice */}
        <div className="bg-white rounded-[20px] border border-brand-border p-12 text-center shadow-[0_8px_30px_rgba(26,8,92,0.05),0_1px_3px_rgba(26,8,92,0.02)]">
          <div className="w-14 h-14 rounded-full bg-brand-page border border-brand-border text-brand-primary flex items-center justify-center mx-auto mb-3">
            <Building2 size={26} />
          </div>
          <h3 className="text-base font-bold text-brand-heading">Client Directory Management</h3>
          <p className="text-xs sm:text-sm text-brand-muted max-w-md mx-auto mt-1 mb-5">
            Client accounts are automatically linked and synced from won sales opportunities and active engineering projects.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => onNavigateTab('projects')}
              className="h-9 px-3.5 rounded-control text-xs font-semibold text-brand-heading bg-brand-section border border-brand-border hover:bg-white hover:border-brand-primary transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <span>View Active Projects</span>
              <ArrowRight size={13} />
            </button>
            <button
              onClick={() => onNavigateTab('pipeline')}
              className="h-9 px-3.5 rounded-control text-xs font-semibold text-brand-primary bg-brand-subtle hover:bg-brand-primary hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>Open Sales Pipeline</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (moduleKey === 'deployments') {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-[20px] border border-brand-border p-5 sm:p-6 shadow-[0_8px_30px_rgba(26,8,92,0.05),0_1px_3px_rgba(26,8,92,0.02)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-700 flex items-center justify-center">
              <Rocket size={20} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-brand-heading">
                {title}
              </h1>
              <p className="text-xs sm:text-sm text-brand-muted mt-0.5">{subtitle}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-[20px] border border-brand-border p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-2">
              <Cloud size={16} className="text-[#F38020]" />
              <h3 className="text-xs font-bold text-brand-heading uppercase tracking-wider">
                Cloudflare Workers API
              </h3>
            </div>
            <div className="text-xl font-bold text-brand-heading">infohq-api</div>
            <div className="mt-2 flex items-center gap-1 text-xs text-emerald-700 font-semibold">
              <CheckCircle2 size={13} />
              <span>Production Healthy (v2.1)</span>
            </div>
          </div>

          <div className="bg-white rounded-[20px] border border-brand-border p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-2">
              <Database size={16} className="text-brand-primary" />
              <h3 className="text-xs font-bold text-brand-heading uppercase tracking-wider">
                Cloudflare D1 Studio
              </h3>
            </div>
            <div className="text-xl font-bold text-brand-heading">infohq_command_db</div>
            <div className="mt-2 flex items-center gap-1 text-xs text-emerald-700 font-semibold">
              <CheckCircle2 size={13} />
              <span>4 Migrations Applied</span>
            </div>
          </div>

          <div className="bg-white rounded-[20px] border border-brand-border p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck size={16} className="text-[#5B4CF5]" />
              <h3 className="text-xs font-bold text-brand-heading uppercase tracking-wider">
                Authentication Layer
              </h3>
            </div>
            <div className="text-xl font-bold text-brand-heading">Clerk Auth Studio</div>
            <div className="mt-2 flex items-center gap-1 text-xs text-emerald-700 font-semibold">
              <CheckCircle2 size={13} />
              <span>Single Superadmin Mode</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (moduleKey === 'settings') {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-[20px] border border-brand-border p-5 sm:p-6 shadow-[0_8px_30px_rgba(26,8,92,0.05),0_1px_3px_rgba(26,8,92,0.02)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-subtle text-brand-primary flex items-center justify-center">
              <Settings size={20} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-brand-heading">
                {title}
              </h1>
              <p className="text-xs sm:text-sm text-brand-muted mt-0.5">{subtitle}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[20px] border border-brand-border p-6 shadow-[0_8px_30px_rgba(26,8,92,0.05),0_1px_3px_rgba(26,8,92,0.02)] space-y-5">
          <div className="border-b border-brand-border pb-4">
            <h3 className="text-sm font-bold text-brand-heading">System Access & Configuration</h3>
            <p className="text-xs text-brand-muted mt-0.5">
              Current environment parameters and administrative permissions.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 bg-brand-page rounded-control border border-brand-border">
              <span className="text-brand-muted block mb-1">Access Tier</span>
              <span className="font-bold text-brand-heading">Single Superadmin Only (Fixed Rule)</span>
            </div>
            <div className="p-3.5 bg-brand-page rounded-control border border-brand-border">
              <span className="text-brand-muted block mb-1">Database Provider</span>
              <span className="font-bold text-brand-heading">Cloudflare D1 SQLite Engine</span>
            </div>
            <div className="p-3.5 bg-brand-page rounded-control border border-brand-border">
              <span className="text-brand-muted block mb-1">Authentication Provider</span>
              <span className="font-bold text-brand-heading">Clerk JWT Verification</span>
            </div>
            <div className="p-3.5 bg-brand-page rounded-control border border-brand-border">
              <span className="text-brand-muted block mb-1">Timezone & Formatting</span>
              <span className="font-bold text-brand-heading">IST (UTC +5:30) / INR (₹)</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Generic clean placeholder for remaining modules (Tasks, Proposals, Analytics, Team, Communications)
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-[20px] border border-brand-border p-5 sm:p-6 shadow-[0_8px_30px_rgba(26,8,92,0.05),0_1px_3px_rgba(26,8,92,0.02)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-brand-subtle text-brand-primary flex items-center justify-center">
            {moduleKey === 'tasks' && <CheckSquare size={20} />}
            {moduleKey === 'proposals' && <FileText size={20} />}
            {moduleKey === 'analytics' && <BarChart3 size={20} />}
            {moduleKey === 'team' && <Users size={20} />}
            {moduleKey === 'communications' && <Mail size={20} />}
          </div>
          <div>
            <div className="text-[11px] font-semibold text-brand-muted uppercase tracking-wider">
              {section}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-brand-heading">
              {title}
            </h1>
            <p className="text-xs sm:text-sm text-brand-muted mt-0.5">{subtitle}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[20px] border border-brand-border p-12 text-center shadow-[0_8px_30px_rgba(26,8,92,0.05),0_1px_3px_rgba(26,8,92,0.02)]">
        <div className="w-14 h-14 rounded-full bg-brand-page border border-brand-border text-brand-muted flex items-center justify-center mx-auto mb-3">
          <Calendar size={26} />
        </div>
        <h3 className="text-base font-bold text-brand-heading">{title} Module</h3>
        <p className="text-xs sm:text-sm text-brand-muted max-w-md mx-auto mt-1 mb-5">
          {subtitle}. No records found yet for this module. Active backend data will populate here as entries are logged.
        </p>
        <button
          onClick={() => onNavigateTab('dashboard')}
          className="h-9 px-4 rounded-control text-xs font-semibold text-white bg-gradient-to-r from-[#5B4CF5] via-[#7C5CE8] to-[#914FBB] inline-flex items-center gap-1.5 shadow-md hover:opacity-95 transition-all cursor-pointer"
        >
          <span>Return to Dashboard</span>
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
};
