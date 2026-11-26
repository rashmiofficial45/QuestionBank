"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition, type ReactNode } from "react";

export function TestKeyboard({ previous, next, children }: { previous?: string; next?: string; children: ReactNode }) {
  const router = useRouter();
  const region = useRef<HTMLDivElement>(null);
  const [navigating, startNavigation] = useTransition();

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const target = event.target;
      if (!(target instanceof HTMLElement) || target.closest("input:not([data-test-answer]), textarea, select, [contenteditable=true]")) return;
      if (target.matches('[data-slot="table-container"][tabindex="0"]')) return;
      if (target !== document.body && target.id !== "content" && !region.current?.contains(target)) return;

      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const href = event.key === "ArrowLeft" ? previous : next;
        if (href && !navigating) startNavigation(() => router.replace(href));
      }

      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        const options = Array.from(region.current?.querySelectorAll<HTMLElement>("[data-test-answer]:enabled") ?? []);
        if (!options.length) return;
        event.preventDefault();
        const current = options.indexOf(target);
        const down = event.key === "ArrowDown";
        const position = current < 0 ? (down ? 0 : options.length - 1) : current + (down ? 1 : -1);
        options[Math.max(0, Math.min(options.length - 1, position))].focus();
      }

      if (event.key === "Enter" && target.matches("[data-test-answer]:enabled") &&
          (event.repeat || target instanceof HTMLInputElement)) {
        event.preventDefault();
        if (!event.repeat) target.click();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [next, previous, navigating, router]);

  return <div className="test-workspace" ref={region}>{children}</div>;
}
