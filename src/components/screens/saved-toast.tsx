"use client";

import { useState } from "react";
import { Toast } from "@/components/ui/toast";

/** A level-3 toast shown once when a page opens after a save ("Payment saved."). */
export function SavedToast({ message }: { message: string }) {
  const [open, setOpen] = useState(true);
  return <Toast open={open} onOpenChange={setOpen} message={message} />;
}
