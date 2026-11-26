"use client";

import type { CSSProperties } from "react";
import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return <SonnerToaster closeButton style={{
    "--normal-bg": "var(--card)",
    "--normal-text": "var(--foreground)",
    "--normal-border": "var(--border)",
  } as CSSProperties} />;
}
