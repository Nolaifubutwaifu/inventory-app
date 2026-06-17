"use client";

import { AuthProvider } from "@/lib/auth";
import { ConfirmProvider } from "./ConfirmDialog";
import { SyncProvider } from "./SyncProvider";
import { ToastProvider } from "./Toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <SyncProvider />
        <ConfirmProvider>{children}</ConfirmProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
