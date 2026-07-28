import { create } from 'zustand';
import { Membership } from '../types';
import { useUserStore } from './userStore';
import { Database } from '../database/Database';

interface MembershipState {
  membership: Membership;
  useCredit: () => boolean;
  refundCredit: (amount: number) => void;
  addCredits: (amount: number) => void;
  purchaseMembership: (tier: string, credits: number, priceText: string) => void;
  buyCredits: (credits: number, priceText: string) => void;
  syncFromDB: () => void;
}

const emptyMembership: Membership = {
  tier: 'No Active Membership',
  totalCredits: 0,
  availableCredits: 0,
  renewalDate: 'Not Scheduled',
};

export const useMembershipStore = create<MembershipState>((set, get) => ({
  membership: emptyMembership,
  useCredit: () => {
    const userId = Database.getCurrentUserId();
    if (userId) {
      const profile = Database.getProfile(userId);
      if (profile && profile.creditsBalance > 0) {
        profile.creditsBalance -= 1;
        Database.updateProfile(userId, { creditsBalance: profile.creditsBalance });
        get().syncFromDB();
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
    }
  },
  buyCredits: (credits, priceText) => {
    const userId = Database.getCurrentUserId();
    if (userId) {
      Database.purchasePlan(userId, `Top-up Cred Pack (${credits} Credits)`, credits, priceText, '₹0', priceText);
      useUserStore.getState().syncFromDB();
      get().syncFromDB();
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
            renewalDate: 'Aug 15, 2026',
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
