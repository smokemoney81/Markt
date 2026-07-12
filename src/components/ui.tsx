"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

/** Bottom-Sheet-Modal, optimiert für Handy. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="safe-bottom max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border-t border-surface-border bg-surface-card p-5 animate-[slideUp_.2s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-gray-400 hover:bg-surface-border"
            aria-label="Schließen"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-surface-border py-12 text-center">
      <div className="mb-3 text-gray-500">{icon}</div>
      <p className="font-medium text-gray-300">{title}</p>
      {hint && <p className="mt-1 max-w-xs text-sm text-gray-500">{hint}</p>}
    </div>
  );
}

export function StatusChip({
  label,
  tone,
}: {
  label: string;
  tone: "green" | "yellow" | "red" | "blue" | "gray" | "cyan";
}) {
  const tones: Record<string, string> = {
    green: "bg-green-500/15 text-green-300",
    yellow: "bg-yellow-500/15 text-yellow-300",
    red: "bg-red-500/15 text-red-300",
    blue: "bg-blue-500/15 text-blue-300",
    gray: "bg-gray-500/15 text-gray-300",
    cyan: "bg-brand/15 text-brand-light",
  };
  return <span className={`chip ${tones[tone]}`}>{label}</span>;
}
