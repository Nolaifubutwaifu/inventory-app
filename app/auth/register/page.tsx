"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Boxes, Loader2, ShieldCheck, UserPlus } from "lucide-react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { PasswordInput } from "@/components/PasswordInput";
import { useToast } from "@/components/Toast";
import { AuthError, register, useAuth } from "@/lib/auth";
import { seedDemoDataForUser } from "@/lib/seed";

export default function RegisterPage() {
  const router = useRouter();
  const toast = useToast();
  const { refresh } = useAuth();
  const [businessName, setBusinessName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<
    Partial<Record<"email" | "password" | "businessName" | "form", string>>
  >({});

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldError({});
    setSubmitting(true);
    try {
      const user = await register({
        email,
        password,
        businessName,
        displayName,
      });
      // Seed sample items so the new user can see what the app does.
      await seedDemoDataForUser(user.id);
      refresh();
      toast.show("Account created — let's get you set up", "success");
      router.replace("/welcome");
    } catch (err) {
      if (err instanceof AuthError) {
        if (err.code === "email_taken" || err.code === "invalid_email") {
          setFieldError({ email: err.message });
        } else if (err.code === "weak_password") {
          setFieldError({ password: err.message });
        } else if (err.code === "missing_field") {
          setFieldError({ businessName: err.message });
        } else {
          setFieldError({ form: err.message });
        }
      } else {
        setFieldError({ form: "Couldn't create your account. Please try again." });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col px-6 pb-10" style={{ paddingTop: "max(env(safe-area-inset-top), 2rem)" }}>
      <div className="flex flex-1 flex-col justify-center">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-fg shadow-sm">
            <Boxes className="h-9 w-9" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">Create your account</h1>
          <p className="mt-1 text-sm text-muted">
            Track inventory for your business — counts and photos saved on this
            device.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <Input
            label="Business name"
            placeholder="e.g. Acme Storage Co."
            autoComplete="organization"
            required
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            error={fieldError.businessName}
          />
          <Input
            label="Your name"
            placeholder="What should we call you?"
            autoComplete="name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            hint="Used on count entries you create."
          />
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldError.email}
          />
          <PasswordInput
            label="Password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint="At least 6 characters."
            error={fieldError.password}
          />
          {fieldError.form && (
            <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {fieldError.form}
            </p>
          )}
          <Button type="submit" size="lg" block disabled={submitting}>
            {submitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <UserPlus className="h-5 w-5" />
                Create account
              </>
            )}
          </Button>
          <p className="flex items-center justify-center gap-1.5 text-xs text-muted">
            <ShieldCheck className="h-3.5 w-3.5" />
            Your data stays on this device.
          </p>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/auth/login" className="font-semibold text-primary">
          Sign in
        </Link>
      </p>
    </div>
  );
}
