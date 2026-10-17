"use client";
import { t } from "@nimchat/i18n";
import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
export function BillsSheet({
  open,
  title,
  close,
  children
}: {
  open: boolean;
  title: string;
  close(): void;
  children: ReactNode;
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (!value) close();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[88dvh] w-full max-w-xl flex-col rounded-t-2xl border border-slate-700 bg-[#0f172a] text-slate-100 shadow-xl focus:outline-none"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-slate-700 px-5 py-2">
            <Dialog.Title className="text-lg font-semibold">
              {title}
            </Dialog.Title>
            <button
              type="button"
              aria-label={t("Close panel")}
              onClick={close}
              className="min-h-[44px] min-w-[44px] text-xl"
            >
              ×
            </button>
          </div>
          <div className="overflow-y-auto p-5 pb-8">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
