"use client";

import { Button } from "@/components/ui/button";
import { resetProgress } from "@/app/(student)/actions";

export function ResetForm() {
  return <form action={resetProgress} onSubmit={(event) => {
    if (!window.confirm("Clear attempts, test history, bookmarks, and study notes for this browser?")) event.preventDefault();
  }}><Button variant="outline" type="submit">Reset progress</Button></form>;
}
