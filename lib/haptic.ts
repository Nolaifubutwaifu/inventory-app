export function haptic(pattern: "tap" | "success" | "warning" | "error" = "tap") {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  const patterns: Record<typeof pattern, number | number[]> = {
    tap: 10,
    success: [10, 30, 10],
    warning: 20,
    error: [40, 60, 40],
  };
  try {
    navigator.vibrate(patterns[pattern]);
  } catch {
    // ignore
  }
}
