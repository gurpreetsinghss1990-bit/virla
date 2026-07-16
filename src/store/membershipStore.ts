import { create } from 'zustand';
import { Membership } from '../types';
import { useUserStore } from './userStore';

interface MembershipState {
  membership: Membership;
  useCredit: () => boolean;
  refundCredit: (amount: number) => void;
  addCredits: (amount: number) => void;
  purchaseMembership: (tier: string, credits: number, priceText: string) => void;
  buyCredits: (credits: number, priceText: string) => void;
}

const mockMembership: Membership = {
  tier: 'Elite Premium Member',
  totalCredits: 21,
  availableCredits: 12,
  renewalDate: 'Aug 15, 2026',
};

export const useMembershipStore = create<MembershipState>((set, get) => ({
  membership: mockMembership,
  useCredit: () => {
    const { membership } = get();
    if (membership.availableCredits > 0) {
      set({
        membership: {
          ...membership,
          availableCredits: membership.availableCredits - 1,
        },
      });
      return true;
    }
    return false;
  },
  refundCredit: (amount) => {
    const { membership } = get();
    set({
      membership: {
        ...membership,
        availableCredits: membership.availableCredits + amount,
      },
    });
  },
  addCredits: (amount) =>
    set((state) => ({
      membership: {
        ...state.membership,
        availableCredits: state.membership.availableCredits + amount,
        totalCredits: state.membership.totalCredits + amount,
      },
    })),
  purchaseMembership: (tier, credits, priceText) => {
    const { membership } = get();
    set({
      membership: {
        ...membership,
        tier: `${tier} Member`,
        availableCredits: membership.availableCredits + credits,
        totalCredits: membership.totalCredits + credits,
      }
    });
    // Log in invoices ledger
    useUserStore.getState().addInvoice({
      type: `${tier} Membership Subscription Upgrade`,
      amount: priceText,
      status: 'paid',
      credits,
    });
  },
  buyCredits: (credits, priceText) => {
    const { membership } = get();
    set({
      membership: {
        ...membership,
        availableCredits: membership.availableCredits + credits,
        totalCredits: membership.totalCredits + credits,
      }
    });
    // Log in invoices ledger
    useUserStore.getState().addInvoice({
      type: `Top-up Cred Pack (${credits} Credits)`,
      amount: priceText,
      status: 'paid',
      credits,
    });
  }
}));
