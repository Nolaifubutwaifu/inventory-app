"use client";

import { useEffect } from "react";
import { ensureSeedData } from "@/lib/seed";

export function SeedOnMount() {
  useEffect(() => {
    ensureSeedData().catch((e) => {
      console.error("Failed to seed sample data", e);
    });
  }, []);
  return null;
}
