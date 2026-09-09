import { createContext, useCallback, useMemo, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { DEFAULT_PARTNER_LABELS, SHARED_LABEL } from '@/lib/constants';
import type {
  HouseholdMemberRow,
  HouseholdRow,
  MemberRole,
  OwnerSlot,
  PartnerSlot,
  ProfileRow,
} from '@/types/database';
import { useAuth } from '@/hooks/useAuth';

export interface HouseholdMember extends HouseholdMemberRow {
  profile: ProfileRow;
}

interface HouseholdContextValue {
  household: HouseholdRow | null;
  members: HouseholdMember[];
  /** Place occupée par l'utilisateur courant dans le foyer. */
  mySlot: PartnerSlot | null;
  myRole: MemberRole | null;
  /** Faux pour un `viewer` : l'interface masque alors toute action d'écriture. */
  canWrite: boolean;
  isLoading: boolean;
  error: Error | null;
  /** Nom affichable d'une place, ou « Commun » pour le pot partagé. */
  ownerLabel: (owner: OwnerSlot) => string;
  /** Place de l'autre partenaire, `null` s'il n'a pas encore rejoint. */
  partnerSlot: PartnerSlot | null;
  createHousehold: (name: string) => Promise<void>;
  joinHousehold: (inviteCode: string) => Promise<void>;
  regenerateInviteCode: () => Promise<string>;
  refresh: () => Promise<void>;
}

export const HouseholdContext = createContext<HouseholdContextValue | null>(null);

export const householdQueryKey = ['household'] as const;

interface HouseholdData {
  household: HouseholdRow | null;
  members: HouseholdMember[];
}

async function fetchHousehold(userId: string): Promise<HouseholdData> {
  const { data: membership, error: membershipError } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (membershipError) throw membershipError;
  if (!membership) return { household: null, members: [] };

  const householdId = (membership as { household_id: string }).household_id;

  // Deux requêtes plutôt qu'une jointure imbriquée : la RLS de `profiles`
  // autorise déjà la lecture des membres du même foyer, et le résultat reste
  // trivial à typer.
  const [householdResult, membersResult] = await Promise.all([
    supabase.from('households').select('*').eq('id', householdId).single(),
    supabase
      .from('household_members')
      .select('*, profile:profiles(*)')
      .eq('household_id', householdId)
      .order('partner_slot'),
  ]);

  if (householdResult.error) throw householdResult.error;
  if (membersResult.error) throw membersResult.error;

  return {
    household: householdResult.data as HouseholdRow,
    members: (membersResult.data ?? []) as unknown as HouseholdMember[],
  };
}

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;

  const { data, isLoading, error } = useQuery({
    queryKey: [...householdQueryKey, userId],
    queryFn: () => fetchHousehold(userId as string),
    enabled: Boolean(userId),
    staleTime: 30_000,
  });

  const household = data?.household ?? null;
  const members = useMemo(() => data?.members ?? [], [data]);

  const myMembership = useMemo(
    () => members.find((member) => member.user_id === userId) ?? null,
    [members, userId],
  );

  const mySlot = myMembership?.partner_slot ?? null;
  const myRole = myMembership?.role ?? null;

  const partnerSlot = useMemo<PartnerSlot | null>(() => {
    if (!mySlot) return null;
    const other = mySlot === 'partnerA' ? 'partnerB' : 'partnerA';
    return members.some((member) => member.partner_slot === other) ? other : null;
  }, [members, mySlot]);

  const ownerLabel = useCallback(
    (owner: OwnerSlot): string => {
      if (owner === 'shared') return SHARED_LABEL;
      const member = members.find((candidate) => candidate.partner_slot === owner);
      return member?.profile.display_name ?? DEFAULT_PARTNER_LABELS[owner];
    },
    [members],
  );

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: householdQueryKey });
  }, [queryClient]);

  const createHousehold = useCallback(
    async (name: string) => {
      const { error: rpcError } = await supabase.rpc('create_household', { p_name: name });
      if (rpcError) throw rpcError;
      await refresh();
    },
    [refresh],
  );

  const joinHousehold = useCallback(
    async (inviteCode: string) => {
      const { error: rpcError } = await supabase.rpc('join_household', {
        p_invite_code: inviteCode.trim().toUpperCase(),
      });
      if (rpcError) throw rpcError;
      await refresh();
    },
    [refresh],
  );

  const regenerateInviteCode = useCallback(async () => {
    if (!household) throw new Error('Aucun foyer actif');
    const { data: code, error: rpcError } = await supabase.rpc('regenerate_invite_code', {
      p_household: household.id,
    });
    if (rpcError) throw rpcError;
    await refresh();
    return code as string;
  }, [household, refresh]);

  const value = useMemo<HouseholdContextValue>(
    () => ({
      household,
      members,
      mySlot,
      myRole,
      canWrite: myRole === 'owner' || myRole === 'editor',
      isLoading: Boolean(userId) && isLoading,
      error: (error as Error | null) ?? null,
      ownerLabel,
      partnerSlot,
      createHousehold,
      joinHousehold,
      regenerateInviteCode,
      refresh,
    }),
    [
      household,
      members,
      mySlot,
      myRole,
      userId,
      isLoading,
      error,
      ownerLabel,
      partnerSlot,
      createHousehold,
      joinHousehold,
      regenerateInviteCode,
      refresh,
    ],
  );

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>;
}
