export interface ScanItemRef {
  id: string;
  name: string;
  sku: string;
  color?: string;
  size?: string;
  category?: string;
  // Data URLs for reference photos (already compressed client-side).
  referencePhotos: string[];
}

export interface ScanRequest {
  queryImage: string; // data URL
  items: ScanItemRef[];
}

export interface ScanCandidate {
  itemId: string;
  confidence: number; // 0..1
  reason?: string;
}

export interface ScanResponse {
  topMatches: ScanCandidate[];
}

export type ScanErrorCode =
  | "missing_key"
  | "rate_limited"
  | "bad_request"
  | "no_items"
  | "model_error"
  | "parse_error";

export interface ScanError {
  error: ScanErrorCode;
  message?: string;
  retryAfterSec?: number;
}
