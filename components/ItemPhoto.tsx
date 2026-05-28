"use client";

import Image from "next/image";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

interface ItemPhotoProps {
  src?: string;
  alt?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: "h-12 w-12",
  md: "h-16 w-16",
  lg: "h-24 w-24",
};

export function ItemPhoto({ src, alt = "", size = "md", className }: ItemPhotoProps) {
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-xl bg-surface-2",
        sizes[size],
        className
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted">
          <Package className="h-1/2 w-1/2" strokeWidth={1.5} />
        </div>
      )}
    </div>
  );
}

// Suppress unused warning in case Image isn't referenced
void Image;
