"use client";

import { AuthProvider } from "@/lib/auth";
import { ConfirmProvider } from "./ConfirmDialog";
import { ToastProvider } from "./Toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <ConfirmProvider>{children}</ConfirmProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
