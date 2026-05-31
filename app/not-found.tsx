import Link from "next/link";
import { Compass, Home } from "lucide-react";

export const metadata = {
  title: "Not found — Inventory",
};

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Compass className="h-7 w-7" />
      </div>
      <h1 className="mt-4 text-2xl font-bold tracking-tight">Page not found</h1>
      <p className="mt-2 text-sm text-muted">
        The page you opened does not exist. It may have been renamed or removed.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-fg shadow-sm active:opacity-90"
      >
        <Home className="h-4 w-4" />
        Back to Home
      </Link>
    </div>
  );
}
