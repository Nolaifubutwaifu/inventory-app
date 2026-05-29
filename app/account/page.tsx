"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Building2,
  ChevronRight,
  LogOut,
  Mail,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/Button";
import { useConfirm } from "@/components/ConfirmDialog";
import { Input } from "@/components/Input";
import { PageHeader } from "@/components/PageHeader";
import { useToast } from "@/components/Toast";
import { deleteAccount, logout, updateProfile, useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/utils";

export default function AccountPage() {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const { user, refresh } = useAuth();

  const [businessName, setBusinessName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setBusinessName(user.businessName);
      setDisplayName(user.displayName);
      setDirty(false);
    }
  }, [user]);

  if (!user) return null;

  async function onSave() {
    if (!user) return;
    setSaving(true);
    try {
      await updateProfile(user.id, {
        businessName: businessName.trim() || user.businessName,
        displayName: displayName.trim() || user.displayName,
      });
      refresh();
      setDirty(false);
      toast.show("Profile updated", "success");
    } finally {
      setSaving(false);
    }
  }

  async function onLogout() {
    const ok = await confirm({
      title: "Sign out?",
      message: "Your data stays on this device and you can sign back in any time.",
      confirmLabel: "Sign out",
      destructive: true,
    });
    if (ok) {
      logout();
      router.replace("/auth/login");
    }
  }

  async function onDeleteAccount() {
    if (!user) return;
    const first = await confirm({
      title: "Delete account?",
      message:
        "This permanently removes your account, every item, every count session, and all photos on this device. There is no undo.",
      confirmLabel: "Continue",
      destructive: true,
    });
    if (!first) return;
    const second = await confirm({
      title: "Are you absolutely sure?",
      message: `Delete the account for ${user.email}? This cannot be reversed.`,
      confirmLabel: "Delete forever",
      destructive: true,
    });
    if (!second) return;
    await deleteAccount(user.id);
    logout();
    toast.show("Account deleted", "success");
    router.replace("/auth/register");
  }

  return (
    <div>
      <PageHeader title="Account" subtitle={user.email} />
      <div className="space-y-6 px-4 pt-4 pb-8">
        <section className="rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <UserRound className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">{user.displayName}</p>
              <p className="truncate text-sm text-muted">{user.businessName}</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted">
            Joined {formatDate(user.createdAt)}
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted">
            Profile
          </h2>
          <Input
            label="Business name"
            value={businessName}
            onChange={(e) => {
              setBusinessName(e.target.value);
              setDirty(true);
            }}
          />
          <Input
            label="Your name"
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value);
              setDirty(true);
            }}
          />
          {dirty && (
            <Button onClick={onSave} size="lg" block disabled={saving}>
              Save changes
            </Button>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted">
            Details
          </h2>
          <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
            <li className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0">
              <Mail className="h-4 w-4 text-muted" />
              <span className="flex-1 truncate text-sm">{user.email}</span>
            </li>
            <li className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0">
              <Building2 className="h-4 w-4 text-muted" />
              <span className="flex-1 truncate text-sm">{user.businessName}</span>
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted">
            Help
          </h2>
          <button
            onClick={() => router.push("/welcome?replay=1")}
            className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-4 text-left transition active:scale-[0.99]"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="flex-1 text-sm font-medium">Replay walkthrough</span>
            <ChevronRight className="h-4 w-4 text-muted" />
          </button>
        </section>

        <Button variant="danger" size="lg" block onClick={onLogout}>
          <LogOut className="h-5 w-5" />
          Sign out
        </Button>

        <section className="space-y-2 pt-4">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-danger">
            Danger zone
          </h2>
          <div className="space-y-3 rounded-2xl border border-danger/30 bg-danger/5 p-4">
            <p className="text-sm text-muted">
              Deleting your account erases every item, count, and photo on this
              device. There is no undo.
            </p>
            <button
              onClick={onDeleteAccount}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-danger/40 bg-transparent px-4 py-3 text-sm font-semibold text-danger transition active:scale-[0.99] hover:bg-danger/10"
            >
              <Trash2 className="h-4 w-4" />
              Delete account
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
