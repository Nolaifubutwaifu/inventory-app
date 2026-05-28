export function isScanEnabled(): boolean {
  return process.env.NEXT_PUBLIC_AI_SCAN_ENABLED === "1";
}
