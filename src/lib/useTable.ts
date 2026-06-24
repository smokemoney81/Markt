"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Generischer Hook für eine Tabelle: lädt die Zeilen des aktuellen Nutzers
 * und stellt insert/update/remove bereit (mit automatischem Refresh).
 */
export function useTable<T extends { id: string }>(
  table: string,
  options?: { orderBy?: string; ascending?: boolean },
) {
  const orderBy = options?.orderBy ?? "created_at";
  const ascending = options?.ascending ?? false;

  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order(orderBy, { ascending });
    if (error) setError(error.message);
    else {
      setRows((data ?? []) as T[]);
      setError(null);
    }
    setLoading(false);
  }, [supabase, table, orderBy, ascending]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const insert = useCallback(
    async (values: Record<string, unknown>) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await supabase
        .from(table)
        .insert({ ...values, user_id: user?.id });
      if (error) throw error;
      await refresh();
    },
    [supabase, table, refresh],
  );

  const update = useCallback(
    async (id: string, values: Record<string, unknown>) => {
      const { error } = await supabase.from(table).update(values).eq("id", id);
      if (error) throw error;
      await refresh();
    },
    [supabase, table, refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
      await refresh();
    },
    [supabase, table, refresh],
  );

  return { rows, loading, error, refresh, insert, update, remove };
}
