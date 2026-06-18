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

export type InvoiceImportStatus = "pending" | "imported" | "dismissed";

// One line item parsed off a MYOB invoice. `imported` flips to true once the
// line has been turned into a count entry, so re-running an import never
// double-counts a line.
export interface InvoiceImportLine {
  rawSku: string;
  description: string;
  quantity: number;
  unitPrice?: number;
  imported?: boolean;
}

// A MYOB invoice dropped into the watched folder, parsed into structured line
// items server-side and delivered here through the same sync channel as every
// other record. The user reviews it in-app and turns its lines into counts.
export interface InvoiceImport {
  id: ID;
  userId: ID;
  filename: string;
  invoiceNumber?: string;
  invoiceDate?: string; // as printed on the invoice (free-form)
  party?: string; // customer / supplier name on the invoice
  lines: InvoiceImportLine[];
  status: InvoiceImportStatus;
  createdAt: number;
  importedAt?: number;
  importedSessionId?: ID;
}
