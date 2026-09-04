"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Trash2, KeyRound, Copy, Check, ShieldCheck } from "lucide-react";
import {
  addMember, removeMember, changeMemberRole, resetMemberPassword,
} from "./actions";

type Member = {
  user_id: string;
  email: string;
  role: "owner" | "admin" | "viewer";
  created_at: string;
};

export default function AdminRoster({
  orgSlug, orgId, currentUserId, isOwner, members,
}: {
  orgSlug: string;
  orgId: string;
  currentUserId: string;
  isOwner: boolean;
  members: Member[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "viewer">("admin");
  const [tempPw, setTempPw] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  function flash(setter: (v: string | null) => void, v: string) {
    setter(v);
    setTimeout(() => setter(null), 3500);
  }

  function addNew(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setError(null); setOk(null); setTempPw(null);
    const fd = new FormData();
    fd.set("orgId", orgId);
    fd.set("email", newEmail);
    fd.set("role", newRole);
    startTransition(async () => {
      const r = await addMember(fd);
      if (!r.ok) { flash(setError, r.error); return; }
      setTempPw({ email: r.email, password: r.password });
      setNewEmail("");
      router.refresh();
    });
  }

  function remove(userId: string, email: string) {
    if (userId === currentUserId) {
      return flash(setError, "You can't remove yourself.");
    }
    if (!confirm(`Remove ${email} from this workspace?`)) return;
    setError(null); setOk(null);
    const fd = new FormData();
    fd.set("orgId", orgId); fd.set("userId", userId);
    startTransition(async () => {
      const r = await removeMember(fd);
      if (!r.ok) return flash(setError, r.error);
      flash(setOk, "Removed.");
      router.refresh();
    });
  }

  function changeRole(userId: string, role: "owner" | "admin" | "viewer") {
    setError(null); setOk(null);
    const fd = new FormData();
    fd.set("orgId", orgId); fd.set("userId", userId); fd.set("role", role);
    startTransition(async () => {
      const r = await changeMemberRole(fd);
      if (!r.ok) return flash(setError, r.error);
      flash(setOk, "Role updated.");
      router.refresh();
    });
  }

  function resetPw(userId: string, email: string) {
    if (!confirm(`Reset password for ${email}? A new temporary password will be generated.`)) return;
    setError(null); setOk(null);
    const fd = new FormData();
    fd.set("orgId", orgId); fd.set("userId", userId);
    startTransition(async () => {
      const r = await resetMemberPassword(fd);
      if (!r.ok) return flash(setError, r.error);
      setTempPw({ email: r.email, password: r.password });
    });
  }

  async function copyPw() {
    if (!tempPw) return;
    try { await navigator.clipboard.writeText(tempPw.password); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    catch { /* ignore */ }
  }

  return (
    <div className="space-y-4">
      {isOwner ? (
        <form onSubmit={addNew}
          className="flex flex-wrap items-end gap-2 bg-[var(--brand-cream)] border border-[var(--brand-line)] rounded-xl p-3">
          <div className="flex-1 min-w-[220px]">
            <label className="text-xs uppercase tracking-widest font-bold text-[var(--brand-slate)]">
              Invite by email
            </label>
            <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
              placeholder="colleague@company.co.za"
              className="mt-1 w-full border border-[var(--brand-line)] rounded-md p-2 text-sm bg-white" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest font-bold text-[var(--brand-slate)]">Role</label>
            <select value={newRole} onChange={e => setNewRole(e.target.value as any)}
              className="mt-1 border border-[var(--brand-line)] rounded-md p-2 text-sm bg-white">
              <option value="admin">Admin</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <button type="submit" disabled={pending || !newEmail}
            className="inline-flex items-center gap-2 bg-[var(--brand-red)] hover:bg-[var(--brand-red-deep)] disabled:opacity-60 text-white px-4 py-2 rounded-md text-sm font-bold transition">
            <UserPlus size={12} /> {pending ? "Adding..." : "Add member"}
          </button>
        </form>
      ) : null}

      {error ? (
        <p className="bg-red-50 border border-red-200 text-red-700 rounded-md px-3 py-2 text-sm">{error}</p>
      ) : null}
      {ok ? (
        <p className="bg-green-50 border border-green-200 text-green-800 rounded-md px-3 py-2 text-sm">{ok}</p>
      ) : null}

      {tempPw ? (
        <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 space-y-3">
          <p className="text-sm text-emerald-900">
            <strong>Temporary password for {tempPw.email}.</strong> Share it via a call or in person.
            They will be forced to change it on first sign-in. This is the only time it will be shown.
          </p>
          <div className="flex items-center gap-2 bg-white border border-emerald-300 rounded-md px-3 py-2">
            <span className="font-mono text-base font-bold flex-1 select-all">{tempPw.password}</span>
            <button type="button" onClick={copyPw}
              className="inline-flex items-center gap-1 text-xs font-bold border border-emerald-400 text-emerald-800 hover:bg-emerald-100 px-2 py-1 rounded transition">
              {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="border border-[var(--brand-line)] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--brand-cream)] text-left">
            <tr>
              <Th>Email</Th><Th>Role</Th><Th className="text-right">&nbsp;</Th>
            </tr>
          </thead>
          <tbody>
            {members.map(m => (
              <tr key={m.user_id} className="border-t border-[var(--brand-line)]">
                <Td>
                  <span className="font-mono text-xs inline-flex items-center gap-2">
                    <ShieldCheck size={12} className={m.user_id === currentUserId ? "text-emerald-600" : "text-[var(--brand-red)]"} />
                    {m.email}
                    {m.user_id === currentUserId ? (
                      <span className="text-[10px] uppercase tracking-widest bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">You</span>
                    ) : null}
                  </span>
                </Td>
                <Td>
                  {isOwner && m.user_id !== currentUserId ? (
                    <select value={m.role} onChange={e => changeRole(m.user_id, e.target.value as any)}
                      className="text-xs font-bold border border-[var(--brand-line)] rounded p-1">
                      <option value="owner">Owner</option>
                      <option value="admin">Admin</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  ) : (
                    <span className="text-xs uppercase font-bold tracking-widest text-[var(--brand-slate)]">{m.role}</span>
                  )}
                </Td>
                <Td>
                  {isOwner && m.user_id !== currentUserId ? (
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => resetPw(m.user_id, m.email)} disabled={pending}
                        title="Reset password"
                        className="p-1.5 border border-[var(--brand-line)] rounded-md text-[var(--brand-slate)] hover:text-[var(--brand-ink)] hover:bg-white transition">
                        <KeyRound size={12} />
                      </button>
                      <button onClick={() => remove(m.user_id, m.email)} disabled={pending}
                        title="Remove"
                        className="p-1.5 border border-red-300 rounded-md text-red-700 hover:bg-red-50 transition">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ) : null}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-[var(--brand-slate)]">
        There must always be at least one owner. To transfer ownership, promote another
        admin to owner first, then demote yourself.
      </p>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-2.5 font-bold uppercase tracking-widest text-[10px] text-[var(--brand-slate)] ${className ?? ""}`}>{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-2.5 align-middle">{children}</td>;
}
