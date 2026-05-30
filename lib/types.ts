export type ID = string;

export type SessionStatus = "in_progress" | "completed";

export interface User {
  id: ID;
  email: string;
  businessName: string;
  displayName: string;
  passwordHash: string;
  passwordSalt: string;
  onboardedAt?: number;
  createdAt: number;
}

export interface Item {
  id: ID;
  userId: ID;
  name: string;
  sku: string;
  category: string;
  color: string;
  size: string;
  photoUrl?: string;
  referencePhotos?: string[];
  barcode?: string;
  matchingLidSku?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CountSession {
  id: ID;
  userId: ID;
  name: string;
  countedBy: string;
  status: SessionStatus;
  createdAt: number;
  completedAt?: number;
}

export interface CountEntry {
  id: ID;
  userId: ID;
  sessionId: ID;
  itemId: ID;
  quantity: number;
  location: string;
  notes?: string;
  createdAt: number;
}

export interface ItemWithTotal extends Item {
  total: number;
  entryCount: number;
}

export interface LocationTemplate {
  id: ID;
  userId: ID;
  label: string;
  createdAt: number;
}
