export type ID = string;

export type SessionStatus = "in_progress" | "completed";

export interface Item {
  id: ID;
  name: string;
  sku: string;
  category: string;
  color: string;
  size: string;
  photoUrl?: string;
  referencePhotos?: string[];
  matchingLidSku?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CountSession {
  id: ID;
  name: string;
  countedBy: string;
  status: SessionStatus;
  createdAt: number;
  completedAt?: number;
}

export interface CountEntry {
  id: ID;
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
