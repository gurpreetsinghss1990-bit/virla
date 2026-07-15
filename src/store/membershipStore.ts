import { create } from 'zustand';
import { Membership } from '../types';

interface MembershipState {
  membership: Membership;
  useCredit: () => boolean;
  addCredits: (amount: number) => void;
}

const mockMembership: Membership = {
  tier: 'Premium Member',
  totalCredits: 16,
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
  addCredits: (amount) =>
    set((state) => ({
      membership: {
        ...state.membership,
        availableCredits: state.membership.availableCredits + amount,
        totalCredits: state.membership.totalCredits + amount,
      },
    })),
}));
