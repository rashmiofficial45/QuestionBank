"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteImport } from "@/app/admin/actions";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function DeleteImport({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startDeletion] = useTransition();
  const [error, setError] = useState("");

  function confirmDelete() {
    setError("");
    startDeletion(async () => {
      try {
        const result = await deleteImport(id);
        if (result.error) {
          setError(result.error);
          return;
        }
        if (result.filesRetained) toast.warning("Import deleted. Some uploaded files could not be removed.");
        else toast.success("Import deleted.");
        setOpen(false);
        router.replace("/admin/imports");
      } catch {
        setError("Could not delete this import. Try again.");
      }
    });
  }

  return <AlertDialog open={open} onOpenChange={(next) => { if (!pending) { setOpen(next); setError(""); } }}>
    <AlertDialogTrigger asChild>
      <Button type="button" variant="outline" size="sm"><Trash2 />Delete import</Button>
    </AlertDialogTrigger>
    <AlertDialogContent onEscapeKeyDown={(event) => { if (pending) event.preventDefault(); }}>
      <div className="grid gap-2">
        <AlertDialogTitle className="text-lg font-semibold">Delete this import?</AlertDialogTitle>
        <AlertDialogDescription className="break-words text-sm text-muted-foreground">
          This permanently removes “{title}”, its uploaded files, and any draft questions.
        </AlertDialogDescription>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <AlertDialogCancel asChild><Button type="button" variant="outline" disabled={pending}>Cancel</Button></AlertDialogCancel>
        <Button type="button" variant="destructive" disabled={pending} onClick={confirmDelete}>{pending ? "Deleting…" : "Delete import"}</Button>
      </div>
    </AlertDialogContent>
  </AlertDialog>;
}
