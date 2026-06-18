export function isInvoiceImportEnabled(): boolean {
  return process.env.NEXT_PUBLIC_MYOB_IMPORT_ENABLED === "1";
}
