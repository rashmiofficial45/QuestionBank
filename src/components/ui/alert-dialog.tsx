"use client";

import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const AlertDialog = AlertDialogPrimitive.Root;
const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
const AlertDialogCancel = AlertDialogPrimitive.Cancel;
const AlertDialogTitle = AlertDialogPrimitive.Title;
const AlertDialogDescription = AlertDialogPrimitive.Description;

function AlertDialogContent({ className, children, ...props }: ComponentProps<typeof AlertDialogPrimitive.Content>) {
  return <AlertDialogPrimitive.Portal>
    <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60" />
    <AlertDialogPrimitive.Content className={cn(
      "fixed top-1/2 left-1/2 z-50 grid w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border bg-card p-5 text-foreground shadow-lg sm:p-6",
      className,
    )} {...props}>
      {children}
    </AlertDialogPrimitive.Content>
  </AlertDialogPrimitive.Portal>;
}

export { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, AlertDialogTrigger };
