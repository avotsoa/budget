import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useHousehold } from '@/hooks/useHousehold';
import type { FinanceAlert } from '@/lib/finance/alerts';
import type { NotificationRow } from '@/types/database';

const notificationsQueryKey = ['notifications'] as const;

/**
 * Persistance et rejet des alertes.
 *
 * Les règles sont réévaluées à chaque chargement : sans état persistant, une
 * alerte rejetée reviendrait à la visite suivante. La contrainte unique
 * `(user_id, dedupe_key)` permet un upsert idempotent — la clé identifie le
 * fait signalé, pas l'instant de l'évaluation.
 *
 * Les notifications sont strictement personnelles : rejeter une alerte chez
 * soi ne la masque pas chez son partenaire.
 */
export function useAlertInbox(alerts: FinanceAlert[]) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { household } = useHousehold();

  const { data: notifications } = useQuery({
    queryKey: [...notificationsQueryKey, household?.id, user?.id],
    queryFn: async (): Promise<NotificationRow[]> => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('household_id', household?.id ?? '')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      return (data ?? []) as NotificationRow[];
    },
    enabled: Boolean(household?.id && user?.id),
    staleTime: 60_000,
  });

  const dismissedKeys = useMemo(
    () =>
      new Set(
        (notifications ?? [])
          .filter((notification) => notification.dismissed_at !== null)
          .map((notification) => notification.dedupe_key),
      ),
    [notifications],
  );

  // Clés déjà écrites pendant cette session : évite de renvoyer le même upsert
  // à chaque re-rendu, l'écriture étant de toute façon idempotente côté base.
  const persistedKeys = useRef(new Set<string>());

  useEffect(() => {
    if (!household?.id || !user?.id || alerts.length === 0) return;

    const pending = alerts.filter((alert) => !persistedKeys.current.has(alert.dedupeKey));
    if (pending.length === 0) return;

    for (const alert of pending) persistedKeys.current.add(alert.dedupeKey);

    void supabase
      .from('notifications')
      .upsert(
        pending.map((alert) => ({
          household_id: household.id,
          user_id: user.id,
          type: alert.type,
          severity: alert.severity,
          title: alert.title,
          body: alert.body,
          dedupe_key: alert.dedupeKey,
        })),
        { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true },
      )
      .then(({ error }) => {
        if (error) {
          // L'historique des alertes est un confort : son échec ne doit pas
          // empêcher l'affichage, qui repose sur les règles calculées.
          console.warn('Historisation des alertes impossible :', error.message);
        }
      });
  }, [alerts, household?.id, user?.id]);

  const dismiss = useMutation({
    mutationFn: async (dedupeKey: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ dismissed_at: new Date().toISOString() })
        .eq('user_id', user?.id ?? '')
        .eq('dedupe_key', dedupeKey);

      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
    },
  });

  const restoreAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notifications')
        .update({ dismissed_at: null })
        .eq('user_id', user?.id ?? '')
        .not('dismissed_at', 'is', null);

      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
    },
  });

  const visibleAlerts = useMemo(
    () => alerts.filter((alert) => !dismissedKeys.has(alert.dedupeKey)),
    [alerts, dismissedKeys],
  );

  const onDismiss = useCallback((dedupeKey: string) => dismiss.mutate(dedupeKey), [dismiss]);
  const onRestoreAll = useCallback(() => restoreAll.mutate(), [restoreAll]);

  return {
    visibleAlerts,
    /** Nombre d'alertes actives masquées par l'utilisateur. */
    dismissedCount: alerts.length - visibleAlerts.length,
    onDismiss,
    onRestoreAll,
  };
}
