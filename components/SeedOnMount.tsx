"use client";

// Seeding is now triggered explicitly on user registration (see app/auth/register).
// This component is intentionally a no-op — left in place so the import in
// layout.tsx stays valid for any future bootstrapping that needs to run client-side.
export function SeedOnMount() {
  return null;
}
