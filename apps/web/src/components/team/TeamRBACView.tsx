import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import {
  fetchTeamApi,
  inviteTeamMemberApi,
  updateMemberPermissionsApi,
  revokeTeamMemberApi,
  TeamMemberItem,
  TeamInviteItem,
} from '../../lib/api.js';
import {
  ShieldCheck,
  UserPlus,
  Users,
  Key,
  X,
  Mail,
  Trash2,
  RefreshCw,
  Lock,
  Smartphone,
  Copy,
  Check,
} from 'lucide-react';

const MODULES = [
  { key: 'dashboard', label: 'Overview Dashboard' },
  { key: 'leads', label: 'Leads Inbox' },
  { key: 'pipeline', label: 'Sales Pipeline' },
  { key: 'clients', label: 'Clients Directory' },
  { key: 'projects', label: 'Projects Delivery' },
  { key: 'tasks', label: 'Tasks & Sprints' },
  { key: 'billing', label: 'Invoices & Finance' },
  { key: 'team', label: 'Team & RBAC' },
  { key: 'settings', label: 'System Settings' },
];

export const TeamRBACView: React.FC = () => {
  const { getToken } = useAuth();

  const [members, setMembers] = useState<TeamMemberItem[]>([]);
  const [invitations, setInvitations] = useState<TeamInviteItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [_error, setError] = useState<string | null>(null);

  // Invite modal state
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'project_manager' | 'sales' | 'developer' | 'viewer'>('developer');
  const [invitePerms, setInvitePerms] = useState<Record<string, boolean>>({
    dashboard: true,
    leads: false,
    pipeline: false,
    clients: false,
    projects: true,
    tasks: true,
    billing: false,
    team: false,
    settings: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Permissions Modal
  const [editingMember, setEditingMember] = useState<TeamMemberItem | null>(null);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);

  const loadTeam = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchTeamApi(getToken);
      setMembers(res.members || []);
      setInvitations(res.invitations || []);
    } catch (err: unknown) {
      console.error('Failed to load team:', err);
      setError(err instanceof Error ? err.message : 'Failed to retrieve team roster.');
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  // Handle Send Invitation
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteName.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await inviteTeamMemberApi(getToken, {
        email: inviteEmail.trim(),
        name: inviteName.trim(),
        role: inviteRole,
        permissions: invitePerms,
      });

      let copyNotice = '';
      if (res.inviteLink && typeof navigator !== 'undefined' && navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(res.inviteLink);
          copyNotice = '\n\n📋 Invite link has also been copied to your clipboard.';
        } catch {
          // ignore clipboard permission error
        }
      }

      alert(`${res.message}${copyNotice}`);
      setIsInviteOpen(false);
      setInviteEmail('');
      setInviteName('');
      loadTeam();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to send invite.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle member status (active / suspended)
  const handleToggleStatus = async (member: TeamMemberItem) => {
    if (member.role === 'superadmin') {
      alert('Superadmin status cannot be suspended.');
      return;
    }
    const nextStatus = member.status === 'active' ? 'suspended' : 'active';
    try {
      await updateMemberPermissionsApi(getToken, member.id, { status: nextStatus });
      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? { ...m, status: nextStatus } : m))
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update member status.');
    }
  };

  // Save edited permissions
  const handleSavePermissions = async () => {
    if (!editingMember) return;
    try {
      await updateMemberPermissionsApi(getToken, editingMember.id, {
        permissions: editingMember.permissions,
        role: editingMember.role,
      });
      alert('Permissions updated successfully.');
      setEditingMember(null);
      loadTeam();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save permissions.');
    }
  };

  // Revoke member
  const handleRevoke = async (member: TeamMemberItem) => {
    if (member.role === 'superadmin') {
      alert('Superadmin cannot be revoked.');
      return;
    }
    if (!confirm(`Are you sure you want to revoke access for ${member.name} (${member.email})?`)) return;
    try {
      await revokeTeamMemberApi(getToken, member.id);
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to revoke member.');
    }
  };

  const handleCopyInviteLink = async (inv: TeamInviteItem) => {
    if (!inv.inviteLink) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(inv.inviteLink);
        setCopiedInviteId(inv.id);
        setTimeout(() => setCopiedInviteId(null), 2500);
        return;
      }
    } catch {
      // Fallback if clipboard API permissions are denied or unavailable
    }
    window.prompt('Copy invitation signup link:', inv.inviteLink);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-[20px] border border-[#EAE6F7] p-5 sm:p-6 shadow-[0_8px_30px_rgba(26,8,92,0.05),0_1px_3px_rgba(26,8,92,0.02)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#F3F0FF] text-[#7C5CE8] flex items-center justify-center">
              <ShieldCheck size={20} className="stroke-[2.2]" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#1A085C]">
                Team &amp; Access Control (RBAC)
              </h1>
              <p className="text-xs sm:text-sm text-[#6B7280] mt-0.5 font-medium">
                Strict Superadmin invite gate, granular field permissions &amp; MFA session security.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadTeam}
              className="h-9 px-3 rounded-xl border border-[#EAE6F7] bg-white text-xs font-semibold text-[#1A085C] hover:bg-[#F8F8FF] transition-all flex items-center gap-1.5 shadow-2xs"
            >
              <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>

            <button
              onClick={() => setIsInviteOpen(true)}
              className="h-9 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#5B4CF5] via-[#7C5CE8] to-[#914FBB] flex items-center gap-1.5 shadow-[0_4px_14px_rgba(124,92,232,0.30)] hover:opacity-95 transition-all cursor-pointer"
            >
              <UserPlus size={15} />
              <span>Invite Member</span>
            </button>
          </div>
        </div>

        {/* Security Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-5 pt-5 border-t border-[#EAE6F7]">
          <div className="p-3.5 bg-[#F8F8FF] rounded-xl border border-[#EAE6F7] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <Lock size={16} />
            </div>
            <div>
              <span className="text-[10.5px] font-bold text-[#6B7280] uppercase tracking-wider block">Invite-Only Gate</span>
              <span className="text-xs font-extrabold text-[#1A085C]">Strict Allowlist Enforced</span>
            </div>
          </div>

          <div className="p-3.5 bg-[#F8F8FF] rounded-xl border border-[#EAE6F7] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-100 text-[#7C5CE8] flex items-center justify-center">
              <Smartphone size={16} />
            </div>
            <div>
              <span className="text-[10.5px] font-bold text-[#6B7280] uppercase tracking-wider block">MFA / TOTP Security</span>
              <span className="text-xs font-extrabold text-[#1A085C]">Google Authenticator / TOTP</span>
            </div>
          </div>

          <div className="p-3.5 bg-[#F8F8FF] rounded-xl border border-[#EAE6F7] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center">
              <Key size={16} />
            </div>
            <div>
              <span className="text-[10.5px] font-bold text-[#6B7280] uppercase tracking-wider block">Passwordless Login</span>
              <span className="text-xs font-extrabold text-[#1A085C]">Biometric Passkeys &amp; OTP</span>
            </div>
          </div>
        </div>
      </div>

      {/* Invite Member Modal */}
      {isInviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-lg bg-white rounded-2xl border border-[#EAE6F7] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#EAE6F7]">
              <div className="flex items-center gap-2">
                <UserPlus size={18} className="text-[#7C5CE8]" />
                <h3 className="text-base font-bold text-[#1A085C]">Invite New Team Member</h3>
              </div>
              <button onClick={() => setIsInviteOpen(false)} className="text-[#6B7280] hover:text-[#1A085C]">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSendInvite} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#1A085C]">Full Name</label>
                <input
                  type="text"
                  required
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full h-10 px-3 rounded-xl border border-[#EAE6F7] text-xs font-medium text-[#1A085C] outline-none focus:border-[#7C5CE8]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#1A085C]">Work Email (Account Identifier)</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="rahul@infohq.in or personal email"
                  className="w-full h-10 px-3 rounded-xl border border-[#EAE6F7] text-xs font-medium text-[#1A085C] outline-none focus:border-[#7C5CE8]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#1A085C]">Assigned Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => {
                    const r = e.target.value as typeof inviteRole;
                    setInviteRole(r);
                    if (r === 'project_manager') {
                      setInvitePerms({ dashboard: true, leads: true, pipeline: true, clients: true, projects: true, tasks: true, billing: false, team: false, settings: false });
                    } else if (r === 'sales') {
                      setInvitePerms({ dashboard: true, leads: true, pipeline: true, clients: true, projects: false, tasks: false, billing: false, team: false, settings: false });
                    } else if (r === 'developer') {
                      setInvitePerms({ dashboard: true, leads: false, pipeline: false, clients: false, projects: true, tasks: true, billing: false, team: false, settings: false });
                    } else {
                      setInvitePerms({ dashboard: true, leads: false, pipeline: false, clients: false, projects: false, tasks: false, billing: false, team: false, settings: false });
                    }
                  }}
                  className="w-full h-10 px-3 rounded-xl border border-[#EAE6F7] text-xs font-medium text-[#1A085C] outline-none focus:border-[#7C5CE8]"
                >
                  <option value="developer">Developer / Engineer</option>
                  <option value="project_manager">Project Manager</option>
                  <option value="sales">Sales &amp; Business Development</option>
                  <option value="viewer">Viewer (Read Only)</option>
                </select>
              </div>

              {/* Granular Module Toggles */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-bold text-[#1A085C] flex items-center justify-between">
                  <span>Granular Module Permissions:</span>
                  <span className="text-[10px] font-normal text-[#6B7280]">Superadmin Controlled</span>
                </label>
                <div className="grid grid-cols-2 gap-2 bg-[#F8F8FF] p-3 rounded-xl border border-[#EAE6F7]">
                  {MODULES.map((m) => (
                    <label key={m.key} className="flex items-center gap-2 text-xs font-medium text-[#374151] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!invitePerms[m.key]}
                        onChange={(e) => setInvitePerms({ ...invitePerms, [m.key]: e.target.checked })}
                        className="rounded text-[#7C5CE8] focus:ring-[#7C5CE8]"
                      />
                      <span>{m.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#EAE6F7]">
                <button
                  type="button"
                  onClick={() => setIsInviteOpen(false)}
                  className="h-9 px-4 rounded-xl text-xs font-semibold text-[#6B7280] hover:bg-[#F8F8FF]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-9 px-5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#5B4CF5] to-[#7C5CE8] hover:opacity-95 disabled:opacity-50"
                >
                  {isSubmitting ? 'Issuing Invite...' : 'Authorize & Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Permissions Modal */}
      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl border border-[#EAE6F7] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#EAE6F7]">
              <div>
                <h3 className="text-sm font-bold text-[#1A085C]">Edit Permissions: {editingMember.name}</h3>
                <span className="text-[11px] text-[#6B7280] font-mono">{editingMember.email}</span>
              </div>
              <button onClick={() => setEditingMember(null)} className="text-[#6B7280] hover:text-[#1A085C]">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-[#1A085C] block mb-1">Role</label>
                <select
                  value={editingMember.role}
                  disabled={editingMember.role === 'superadmin'}
                  onChange={(e) => setEditingMember({ ...editingMember, role: e.target.value as any })}
                  className="w-full h-9 px-3 rounded-xl border border-[#EAE6F7] text-xs font-medium text-[#1A085C]"
                >
                  <option value="superadmin">Superadmin</option>
                  <option value="project_manager">Project Manager</option>
                  <option value="sales">Sales</option>
                  <option value="developer">Developer</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[#1A085C] block mb-2">Module Access</label>
                <div className="space-y-1.5 bg-[#F8F8FF] p-3 rounded-xl border border-[#EAE6F7]">
                  {MODULES.map((m) => (
                    <label key={m.key} className="flex items-center justify-between text-xs font-medium text-[#374151] cursor-pointer">
                      <span>{m.label}</span>
                      <input
                        type="checkbox"
                        disabled={editingMember.role === 'superadmin'}
                        checked={editingMember.role === 'superadmin' ? true : !!editingMember.permissions[m.key]}
                        onChange={(e) =>
                          setEditingMember({
                            ...editingMember,
                            permissions: { ...editingMember.permissions, [m.key]: e.target.checked },
                          })
                        }
                        className="rounded text-[#7C5CE8]"
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#EAE6F7]">
              <button
                onClick={() => setEditingMember(null)}
                className="h-8 px-3 rounded-xl text-xs font-semibold text-[#6B7280]"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePermissions}
                className="h-8 px-4 rounded-xl text-xs font-bold text-white bg-[#7C5CE8] hover:bg-[#6A48DC]"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Team Roster */}
      <div className="bg-white rounded-[20px] border border-[#EAE6F7] divide-y divide-[#F0EDF9] shadow-xs overflow-hidden">
        <div className="p-4 bg-[#F8F8FF] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-[#7C5CE8]" />
            <h2 className="text-xs font-extrabold text-[#1A085C] uppercase tracking-wider">
              Authorized Team Members ({members.length})
            </h2>
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-xs text-[#6B7280]">
            <RefreshCw size={22} className="mx-auto mb-2 text-[#7C5CE8] animate-spin" />
            <span>Verifying RBAC permissions and team allowlist...</span>
          </div>
        ) : (
          members.map((member) => {
            const isSuper = member.role === 'superadmin';
            const isSuspended = member.status === 'suspended';
            return (
              <div key={member.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAF9FF]/60 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${
                    isSuper ? 'bg-[#7C5CE8] text-white' : 'bg-[#F3F0FF] text-[#7C5CE8]'
                  }`}>
                    {member.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-bold text-[#1A085C]">{member.name}</span>
                      {isSuper && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-purple-100 text-[#7C5CE8] uppercase tracking-wider">
                          Superadmin
                        </span>
                      )}
                      {isSuspended && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-100 text-rose-700 uppercase tracking-wider">
                          Suspended
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#6B7280] font-mono mt-0.5">
                      {member.email || member.clerkUserId}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    onClick={() => setEditingMember(member)}
                    className="h-8 px-3 rounded-lg border border-[#EAE6F7] text-[11px] font-semibold text-[#1A085C] hover:bg-[#F8F8FF]"
                  >
                    Permissions
                  </button>

                  {!isSuper && (
                    <>
                      <button
                        onClick={() => handleToggleStatus(member)}
                        className={`h-8 px-2.5 rounded-lg text-[11px] font-bold border ${
                          isSuspended
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {isSuspended ? 'Activate' : 'Suspend'}
                      </button>

                      <button
                        onClick={() => handleRevoke(member)}
                        className="p-1.5 text-[#9CA3AF] hover:text-rose-600 rounded-lg hover:bg-rose-50"
                        title="Revoke access"
                      >
                        <Trash2 size={15} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pending Invitations Section */}
      {invitations.length > 0 && (
        <div className="bg-white rounded-[20px] border border-[#EAE6F7] divide-y divide-[#F0EDF9] shadow-xs overflow-hidden">
          <div className="p-4 bg-[#F8F8FF] flex items-center gap-2">
            <Mail size={16} className="text-amber-600" />
            <h2 className="text-xs font-extrabold text-[#1A085C] uppercase tracking-wider">
              Pending Invitations ({invitations.length})
            </h2>
          </div>
          {invitations.map((inv) => (
            <div key={inv.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-[#1A085C] block">{inv.name}</span>
                <span className="text-[11px] text-[#6B7280] font-mono">{inv.email} • Role: {inv.role}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  Awaiting Sign In
                </span>
                {inv.inviteLink && (
                  <button
                    onClick={() => handleCopyInviteLink(inv)}
                    className="h-7 px-2.5 rounded-lg border border-[#EAE6F7] text-[11px] font-semibold text-[#5B4CF5] hover:bg-[#F8F8FF] inline-flex items-center gap-1.5 transition-colors"
                    title="Copy unique signup link"
                  >
                    {copiedInviteId === inv.id ? (
                      <>
                        <Check size={12} className="text-emerald-600" />
                        <span className="text-emerald-600 font-bold">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
