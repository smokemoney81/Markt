"use client";

import { useCallback, useEffect, useState } from "react";

function storageKey(table: string) {
  return `markt_${table}`;
}

function loadRows<T>(table: string): T[] {
  try {
    const raw = localStorage.getItem(storageKey(table));
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function saveRows<T>(table: string, rows: T[]) {
  localStorage.setItem(storageKey(table), JSON.stringify(rows));
}

export function useTable<T extends { id: string; created_at: string }>(
  table: string,
  options?: { orderBy?: string; ascending?: boolean },
) {
  const orderBy = options?.orderBy ?? "created_at";
  const ascending = options?.ascending ?? false;

  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    const all = loadRows<T>(table);
    const sorted = [...all].sort((a, b) => {
      const av = String((a as Record<string, unknown>)[orderBy] ?? "");
      const bv = String((b as Record<string, unknown>)[orderBy] ?? "");
      return ascending ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    setRows(sorted);
    setLoading(false);
  }, [table, orderBy, ascending]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const insert = useCallback(
    async (values: Record<string, unknown>) => {
      const all = loadRows<T>(table);
      const newRow = {
        ...values,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        user_id: "local",
      } as unknown as T;
      saveRows(table, [...all, newRow]);
      refresh();
    },
    [table, refresh],
  );

  const update = useCallback(
    async (id: string, values: Record<string, unknown>) => {
      const all = loadRows<T>(table);
      saveRows(table, all.map((r) => (r.id === id ? { ...r, ...values } : r)));
      refresh();
    },
    [table, refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      const all = loadRows<T>(table);
      saveRows(table, all.filter((r) => r.id !== id));
      refresh();
    },
    [table, refresh],
  );

  return { rows, loading, error: null, refresh, insert, update, remove };
}
