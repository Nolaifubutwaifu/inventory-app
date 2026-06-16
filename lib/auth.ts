"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { db, newId, now } from "./db";
import type { User } from "./types";

const CURRENT_USER_KEY = "inventory:currentUserId";
const PBKDF2_ITERATIONS = 100_000;
const HASH_BYTES = 32;
const AUTH_EVENT = "inventory:auth-change";

// ---------- DEV AUTH BYPASS ----------
// Temporary: skip the login/register flow so the app can be tested without
// signing in every time. When true, a local dev user is auto-created and
// signed in if nobody is logged in. Set to false (or delete this block and
// the ensureDevUser call in AuthProvider) to restore the normal login flow.
const DEV_AUTH_BYPASS = true;
const DEV_USER_EMAIL = "dev@local.test";

export async function ensureDevUser(): Promise<string> {
  let user = await db.users.where("email").equals(DEV_USER_EMAIL).first();
  if (!user) {
    user = {
      id: newId(),
      email: DEV_USER_EMAIL,
      businessName: "Dev Workspace",
      displayName: "Dev",
      passwordHash: "",
      passwordSalt: "",
      onboardedAt: now(),
      createdAt: now(),
    };
    await db.users.add(user);
  } else if (!user.onboardedAt) {
    await db.users.update(user.id, { onboardedAt: now() });
  }
  setStoredUserId(user.id);
  return user.id;
}

// ---------- Password hashing (Web Crypto PBKDF2-SHA-256) ----------

function toHex(buffer: ArrayBuffer): string {
  const view = new Uint8Array(buffer);
  let out = "";
  for (let i = 0; i < view.length; i++) {
    out += view[i].toString(16).padStart(2, "0");
  }
  return out;
}

function randomSalt(bytes = 16): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return toHex(arr.buffer);
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

async function hashPassword(password: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const saltBytes = hexToBytes(saltHex);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBytes.buffer.slice(
        saltBytes.byteOffset,
        saltBytes.byteOffset + saltBytes.byteLength
      ) as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    HASH_BYTES * 8
  );
  return toHex(bits);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// ---------- Current user storage ----------

function getStoredUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(CURRENT_USER_KEY);
  } catch {
    return null;
  }
}

function setStoredUserId(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (id) window.localStorage.setItem(CURRENT_USER_KEY, id);
    else window.localStorage.removeItem(CURRENT_USER_KEY);
  } catch {
    // ignore — storage unavailable
  }
  window.dispatchEvent(new Event(AUTH_EVENT));
}

// Sync accessor for non-React callers (repo functions).
export function getCurrentUserIdSync(): string | null {
  return getStoredUserId();
}

// ---------- Public API: register / login / logout ----------

export class AuthError extends Error {
  code:
    | "email_taken"
    | "invalid_credentials"
    | "weak_password"
    | "invalid_email"
    | "missing_field";
  constructor(
    code: AuthError["code"],
    message: string
  ) {
    super(message);
    this.code = code;
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function register(input: {
  email: string;
  password: string;
  businessName: string;
  displayName: string;
}): Promise<User> {
  const email = normalizeEmail(input.email);
  const businessName = input.businessName.trim();
  const displayName = input.displayName.trim() || email.split("@")[0];

  if (!email) throw new AuthError("missing_field", "Email is required");
  if (!businessName)
    throw new AuthError("missing_field", "Business name is required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new AuthError("invalid_email", "That doesn't look like an email");
  if (input.password.length < 6)
    throw new AuthError(
      "weak_password",
      "Password must be at least 6 characters"
    );

  const existing = await db.users.where("email").equals(email).first();
  if (existing) {
    throw new AuthError(
      "email_taken",
      "An account already exists for this email"
    );
  }

  const salt = randomSalt();
  const hash = await hashPassword(input.password, salt);

  const user: User = {
    id: newId(),
    email,
    businessName,
    displayName,
    passwordHash: hash,
    passwordSalt: salt,
    createdAt: now(),
  };
  await db.users.add(user);
  setStoredUserId(user.id);
  return user;
}

export async function login(
  email: string,
  password: string
): Promise<User> {
  const normalized = normalizeEmail(email);
  const user = await db.users.where("email").equals(normalized).first();
  if (!user) {
    throw new AuthError("invalid_credentials", "Wrong email or password");
  }
  const candidate = await hashPassword(password, user.passwordSalt);
  if (!constantTimeEqual(candidate, user.passwordHash)) {
    throw new AuthError("invalid_credentials", "Wrong email or password");
  }
  setStoredUserId(user.id);
  return user;
}

export function logout() {
  setStoredUserId(null);
}

export async function getCurrentUser(): Promise<User | undefined> {
  const id = getStoredUserId();
  if (!id) return undefined;
  return db.users.get(id);
}

export async function markOnboarded(userId: string): Promise<void> {
  await db.users.update(userId, { onboardedAt: now() });
}

export async function updateProfile(
  userId: string,
  patch: Partial<Pick<User, "businessName" | "displayName">>
): Promise<void> {
  await db.users.update(userId, patch);
}

// Cascade-deletes the user and everything they own. Caller is responsible for
// clearing the current-user pointer (or calling logout()) afterward.
export async function deleteAccount(userId: string): Promise<void> {
  await db.transaction(
    "rw",
    [db.users, db.items, db.sessions, db.entries, db.locationTemplates],
    async () => {
      await db.entries.where("userId").equals(userId).delete();
      await db.sessions.where("userId").equals(userId).delete();
      await db.items.where("userId").equals(userId).delete();
      await db.locationTemplates.where("userId").equals(userId).delete();
      await db.users.delete(userId);
    }
  );
}

// ---------- React context + hook ----------

interface AuthContextValue {
  userId: string | null;
  user: User | undefined;
  loading: boolean;
  refresh: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [user, setUser] = useState<User | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    let id = getStoredUserId();
    if (!id && DEV_AUTH_BYPASS) {
      // Auto sign-in a local dev user so login can be skipped. Remove the
      // DEV_AUTH_BYPASS block above to restore the normal login flow.
      id = await ensureDevUser();
    }
    setUserId(id);
    if (!id) {
      setUser(undefined);
      setLoading(false);
      return;
    }
    const u = await db.users.get(id);
    if (!u) {
      // Stored ID points at a deleted user — clear it.
      setStoredUserId(null);
      setUser(undefined);
      setUserId(null);
    } else {
      setUser(u);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const handler = () => {
      refresh();
    };
    window.addEventListener(AUTH_EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(AUTH_EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, [refresh]);

  const value = useMemo<AuthContextValue>(
    () => ({ userId, user, loading, refresh }),
    [userId, user, loading, refresh]
  );

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}

export function useCurrentUserId(): string | null {
  return useAuth().userId;
}
