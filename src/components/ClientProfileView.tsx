import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import Reanimated from 'react-native-reanimated';
import { formatToDDMMYYYY } from '../utils/date';
import {
  ClientTopBar,
  ClientHeroSection,
  ClientVirlaPassCard,
  ClientPersonalInfoCard,
  ClientFitnessGoalsCard,
  ClientTrainerApplicationSection,
  ClientQuickActionsCard,
  ClientEditProfileSheet,
  getDefaultAvatarForGender,
  type InitialProfileSnapshot,
  type ClientHeroSectionProps,
  type ClientVirlaPassCardProps,
  type ClientPersonalInfoCardProps,
  type ClientFitnessGoalsCardProps,
  type ClientTrainerApplicationSectionProps,
  type ClientQuickActionsCardProps,
  type ClientEditProfileSheetProps,
} from './profile';

export {
  ClientTopBar,
  ClientHeroSection,
  ClientVirlaPassCard,
  ClientPersonalInfoCard,
  ClientFitnessGoalsCard,
  ClientTrainerApplicationSection,
  ClientQuickActionsCard,
  ClientEditProfileSheet,
  getDefaultAvatarForGender,
  type InitialProfileSnapshot,
  type ClientHeroSectionProps,
  type ClientVirlaPassCardProps,
  type ClientPersonalInfoCardProps,
  type ClientFitnessGoalsCardProps,
  type ClientTrainerApplicationSectionProps,
  type ClientQuickActionsCardProps,
  type ClientEditProfileSheetProps,
};

// ============================================================================
// ORCHESTRATED CLIENT PROFILE VIEW
// ============================================================================
export interface ClientProfileViewProps {
  insetsTop: number;
  isHeaderCollapsed: boolean;
  setIsHeaderCollapsed: (collapsed: boolean) => void;
  handleLogout: () => void;
  openEditProfileModal: () => void;
  profile: any;
  user: any;
  isWildcardTestAccount: (user: any, mobile?: string) => boolean;
  handleRoleChange: (role: 'customer' | 'trainer' | 'admin') => void;
  creditBalance: number | null;
  membership: any;
  creditLots: any[];
  navigateThrottled: (route: string) => void;
  togglePersonalInfoExpansion: (val?: boolean) => void;
  isPersonalInfoExpanded: boolean;
  setIsGoalsModalVisible: (visible: boolean) => void;
  allFitnessGoals: string[];
  hasApplied: boolean;
  userApplication: any;
}

export const ClientProfileView: React.FC<ClientProfileViewProps> = React.memo(({
  insetsTop,
  isHeaderCollapsed,
  setIsHeaderCollapsed,
  handleLogout,
  openEditProfileModal,
  profile,
  user,
  isWildcardTestAccount,
  handleRoleChange,
  creditBalance,
  membership,
  creditLots,
  navigateThrottled,
  togglePersonalInfoExpansion,
  isPersonalInfoExpanded,
  setIsGoalsModalVisible,
  allFitnessGoals,
  hasApplied,
  userApplication,
}) => {
  const headerCollapsedRef = useRef(isHeaderCollapsed);
  useEffect(() => {
    headerCollapsedRef.current = isHeaderCollapsed;
  }, [isHeaderCollapsed]);

  const handleScroll = useCallback((e: any) => {
    const collapsed = e.nativeEvent.contentOffset.y > 60;
    if (collapsed !== headerCollapsedRef.current) {
      headerCollapsedRef.current = collapsed;
      setIsHeaderCollapsed(collapsed);
    }
  }, [setIsHeaderCollapsed]);

  const onSwitchToTrainer = useCallback(() => handleRoleChange('trainer'), [handleRoleChange]);
  const onOpenWallet = useCallback(() => navigateThrottled('/wallet'), [navigateThrottled]);
  const onToggleExpand = useCallback(() => togglePersonalInfoExpansion(), [togglePersonalInfoExpansion]);
  const onCollapseInfo = useCallback(() => togglePersonalInfoExpansion(false), [togglePersonalInfoExpansion]);
  const onOpenGoals = useCallback(() => setIsGoalsModalVisible(true), [setIsGoalsModalVisible]);
  const onNavigateTrainerApp = useCallback(() => navigateThrottled('/trainer-application'), [navigateThrottled]);
  const onNavigateStats = useCallback(() => navigateThrottled('/personal-statistics'), [navigateThrottled]);
  const onNavigateAddresses = useCallback(() => navigateThrottled('/address-management'), [navigateThrottled]);
  const onNavigateSupport = useCallback(() => navigateThrottled('/help-support'), [navigateThrottled]);

  const displayName = profile.name || user?.name || 'User';
  const displayAvatar = profile.avatar || user?.avatar;
  const displayGender = (profile.gender || (user as any)?.gender) as string | undefined;
  const canSwitchToTrainer = Boolean(
    user?.role !== 'admin' && (user?.role === 'trainer' || isWildcardTestAccount(user, profile?.mobile))
  );

  const effectiveCredits = creditBalance ?? (profile as { creditsBalance?: number }).creditsBalance ?? membership.availableCredits ?? 0;
  const membershipStatus = (profile as { membershipStatus?: string }).membershipStatus || membership.tier || '';

  const validTillText = useMemo(() => {
    if (effectiveCredits <= 0) return 'Not Active';
    const activeLot = creditLots?.find((l: any) => l.remaining_credits > 0 && l.official_expiry_date);
    if (activeLot?.official_expiry_date) {
      return formatToDDMMYYYY(activeLot.official_expiry_date);
    }
    return membership.renewalDate && membership.renewalDate !== 'Not Active' ? membership.renewalDate : 'Active';
  }, [effectiveCredits, creditLots, membership.renewalDate]);

  const mobileDisplay = profile.mobile
    ? profile.mobile.replace(/^\+?91\s*/, '')
    : (user?.phone ? user.phone.replace(/^\+?91\s*/, '') : 'Not set');
  const emailDisplay = profile.email || user?.email || 'Not set';
  const heightDisplay = profile.height
    ? (profile.height.includes('cm') ? profile.height : `${profile.height} cm`)
    : 'Not set';
  const weightDisplay = profile.weight
    ? (profile.weight.includes('kg') ? profile.weight : `${profile.weight} kg`)
    : 'Not set';

  const selectedGoalsKey = Array.isArray(profile.selectedGoals) ? profile.selectedGoals.join('|') : '';

  return (
    <Reanimated.ScrollView
      showsVerticalScrollIndicator={false}
      overScrollMode="never"
      scrollEventThrottle={16}
      decelerationRate={0.96}
      bounces={true}
      alwaysBounceVertical={true}
      onScroll={handleScroll}
      className="flex-1 bg-transparent"
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insetsTop + 14, paddingBottom: 140 }}
    >
      <ClientTopBar />

      <ClientHeroSection
        name={displayName}
        avatar={displayAvatar}
        gender={displayGender}
        canSwitchToTrainer={canSwitchToTrainer}
        onEditPress={openEditProfileModal}
        onSwitchToTrainer={onSwitchToTrainer}
      />

      <ClientVirlaPassCard
        effectiveCredits={effectiveCredits}
        membershipStatus={membershipStatus}
        validTillText={validTillText}
        onOpenWallet={onOpenWallet}
      />

      <ClientPersonalInfoCard
        isExpanded={isPersonalInfoExpanded}
        onToggleExpand={onToggleExpand}
        onCollapse={onCollapseInfo}
        onEditPress={openEditProfileModal}
        name={displayName === 'User' ? (profile.name || user?.name || 'Not set') : displayName}
        mobileDisplay={mobileDisplay}
        email={emailDisplay}
        gender={profile.gender || 'Not set'}
        dob={profile.dob || 'Not set'}
        heightDisplay={heightDisplay}
        weightDisplay={weightDisplay}
        fitnessLevel={profile.fitnessLevel || 'Not set'}
        city={profile.city || 'Not set'}
        memberSince={profile.memberSince || 'Sep 2024'}
        totalSessions={profile.totalSessions || 0}
        totalCaloriesFormatted={(profile.totalCalories || 0).toLocaleString()}
        lifetimeSpend={profile.lifetimeSpend || '₹0'}
      />

      <ClientFitnessGoalsCard
        gender={profile.gender || ''}
        selectedGoalsKey={selectedGoalsKey}
        allFitnessGoals={allFitnessGoals}
        onOpenGoals={onOpenGoals}
      />

      <ClientTrainerApplicationSection
        isTrainerRole={user?.role === 'trainer'}
        hasApplied={hasApplied}
        applicationStatus={userApplication?.status}
        onNavigateTrainerApp={onNavigateTrainerApp}
      />

      <ClientQuickActionsCard
        onNavigateStats={onNavigateStats}
        onNavigateAddresses={onNavigateAddresses}
        onNavigateSupport={onNavigateSupport}
        onLogout={handleLogout}
      />
    </Reanimated.ScrollView>
  );
});
