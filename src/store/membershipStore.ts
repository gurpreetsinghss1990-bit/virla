import { create } from 'zustand';
import { Membership } from '../types';
import { useUserStore } from './userStore';
import { useNotificationStore } from './notificationStore';
import { Database } from '../database/Database';

interface MembershipState {
  membership: Membership;
  customRenewalDate: string | null;
  consumeCredit: () => boolean;
  refundCredit: (amount: number) => void;
  addCredits: (amount: number) => void;
  purchaseMembership: (tier: string, credits: number, priceText: string) => void;
  buyCredits: (credits: number, priceText: string) => void;
  syncFromDB: () => void;
  toggleExpiryDate: () => void;
  isExpired: () => boolean;
}

const emptyMembership: Membership = {
  tier: 'No Active Membership',
  totalCredits: 0,
  availableCredits: 0,
  renewalDate: 'Not Scheduled',
};

export const useMembershipStore = create<MembershipState>((set, get) => ({
  membership: emptyMembership,
  customRenewalDate: null,
  isExpired: () => {
    const renewalDateStr = get().membership.renewalDate;
    if (!renewalDateStr || renewalDateStr === 'Not Scheduled' || renewalDateStr === 'Not Active') return false;
    const renewalDate = new Date(renewalDateStr);
    const now = new Date();
    return renewalDate.getTime() <= now.getTime();
  },
  toggleExpiryDate: () => {
    const current = get().membership.renewalDate;
    const isExpired = current === 'Jul 15, 2026';
    const newDate = isExpired ? 'Aug 15, 2026' : 'Jul 15, 2026';
    set({ customRenewalDate: newDate });
    get().syncFromDB();
  },
  consumeCredit: () => {
    const userId = Database.getCurrentUserId();
    if (userId) {
      if (get().isExpired()) {
        return false;
      }
      const profile = Database.getProfile(userId);
      if (profile && profile.creditsBalance > 0) {
        profile.creditsBalance -= 1;
        Database.updateProfile(userId, { creditsBalance: profile.creditsBalance });
        get().syncFromDB();

        // Trigger credits running low warning
        if (profile.creditsBalance <= 2) {
          useNotificationStore.getState().addNotification({
            title: 'Credits Running Low ⚠️',
            body: `You only have ${profile.creditsBalance} credits left in your wallet. Top up now to avoid session disruption.`,
            type: 'Credits',
            priority: 'high',
            actionLabel: 'Buy Credits',
            deepLink: '/membership',
            icon: 'shopping-bag'
          });
        }

        return true;
      }
    }
    return false;
  },
  refundCredit: (amount) => {
    const userId = Database.getCurrentUserId();
    if (userId) {
      const profile = Database.getProfile(userId);
      if (profile) {
        profile.creditsBalance += amount;
        Database.updateProfile(userId, { creditsBalance: profile.creditsBalance });
        get().syncFromDB();
      }
    }
  },
  addCredits: (amount) => {
    const userId = Database.getCurrentUserId();
    if (userId) {
      const profile = Database.getProfile(userId);
      if (profile) {
        profile.creditsBalance += amount;
        Database.updateProfile(userId, { creditsBalance: profile.creditsBalance });
        get().syncFromDB();
      }
    }
  },
  purchaseMembership: (tier, credits, priceText) => {
    const userId = Database.getCurrentUserId();
    if (userId) {
      Database.purchasePlan(userId, `${tier} Membership Subscription Upgrade`, credits, priceText, '₹0', priceText);
      Database.updateProfile(userId, { membershipStatus: tier });
      useUserStore.getState().syncFromDB();
      get().syncFromDB();

      // Trigger notifications
      useNotificationStore.getState().addNotification({
        title: 'Membership Purchased 🎟️',
        body: `Successfully upgraded to ${tier} Membership Subscription.`,
        type: 'Membership',
        priority: 'medium',
        actionLabel: 'View Plan',
        deepLink: '/membership',
        icon: 'award'
      });
      useNotificationStore.getState().addNotification({
        title: 'Credits Added 🪙',
        body: `Plus ${credits} credits added to your fitness wallet.`,
        type: 'Credits',
        priority: 'low',
        actionLabel: 'Check Wallet',
        deepLink: '/membership',
        icon: 'plus-circle'
      });
      useNotificationStore.getState().addNotification({
        title: 'Payment Successful 💳',
        body: `Payment of ${priceText} processed successfully. Invoice available.`,
        type: 'Payments',
        priority: 'low',
        actionLabel: 'Invoice',
        deepLink: '/membership',
        icon: 'shopping-bag'
      });
    }
  },
  buyCredits: (credits, priceText) => {
    const userId = Database.getCurrentUserId();
    if (userId) {
      Database.purchasePlan(userId, `Top-up Cred Pack (${credits} Credits)`, credits, priceText, '₹0', priceText);
      useUserStore.getState().syncFromDB();
      get().syncFromDB();

      // Trigger notifications
      useNotificationStore.getState().addNotification({
        title: 'Credits Added 🪙',
        body: `Plus ${credits} top-up credits added to your fitness wallet.`,
        type: 'Credits',
        priority: 'low',
        actionLabel: 'Check Wallet',
        deepLink: '/membership',
        icon: 'plus-circle'
      });
      useNotificationStore.getState().addNotification({
        title: 'Payment Successful 💳',
        body: `Payment of ${priceText} processed successfully. Invoice available.`,
        type: 'Payments',
        priority: 'low',
        actionLabel: 'Invoice',
        deepLink: '/membership',
        icon: 'shopping-bag'
      });
    }
  },
  syncFromDB: () => {
    const userId = Database.getCurrentUserId();
    if (userId) {
      const profile = Database.getProfile(userId);
      if (profile) {
        // Calculate total credits purchased from invoice logs
        const ledgerList = Database.getLedgerTransactions(userId) as any[];
        const totalPurchased = ledgerList
          .filter(t => t.change > 0)
          .reduce((sum, curr) => sum + curr.credits, 0);

        set({
          membership: {
            tier: profile.membershipStatus || 'Standard',
            totalCredits: totalPurchased,
            availableCredits: profile.creditsBalance,
            renewalDate: get().customRenewalDate || 'Aug 15, 2026',
          }
        });
      }
    } else {
      set({
        membership: {
          tier: 'Standard',
          totalCredits: 0,
          availableCredits: 0,
          renewalDate: 'Not Active',
        }
      });
    }
  }
}));
