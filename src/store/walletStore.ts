import { create } from 'zustand';
import { useUserStore } from './userStore';
import { useMembershipStore } from './membershipStore';
import { Database } from '../database/Database';
import { supabase } from '../database/supabaseClient';

export interface LedgerTransaction {
  id: string;
  title: string;
  change: number; // e.g. +12, -1
  date: string;
  type: 'purchase' | 'booking' | 'refund' | 'bonus' | 'penalty';
}

export interface PaymentRecord {
  id: string;
  invoiceNo: string;
  date: string;
  planName: string;
  credits: number;
  amount: string;
  gst: string;
  total: string;
  method: string;
  status: 'completed' | 'refunded' | 'pending' | 'failed';
}

interface WalletState {
  creditBalance: number;
  lifetimePurchased: number;
  creditsUsed: number;
  ledger: LedgerTransaction[];
  payments: PaymentRecord[];
  
  // Actions
  purchasePlan: (planName: string, credits: number, priceText: string, totalText: string, gstText: string) => void;
  spendCredit: (reason: string) => boolean;
  refundCredit: (reason: string) => void;
  deductCreditLateCancel: (reason: string) => void;
  addBonusCredit: (reason: string) => void;
  syncFromDB: () => void;
  transferCredits: (toPhone: string, amount: number) => Promise<{ success: boolean; error?: string }>;
  clearCreditsForTesting: () => void;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  creditBalance: 0,
  lifetimePurchased: 0,
  creditsUsed: 0,
  ledger: [],
  payments: [],

  purchasePlan: (planName, credits, priceText, totalText, gstText) => {
    const userId = Database.getCurrentUserId();
    if (userId) {
      Database.purchasePlan(userId, planName, credits, priceText, gstText, totalText);
      if (planName.toLowerCase().includes('elite')) {
        Database.updateProfile(userId, { membershipStatus: 'Elite' });
      }
      useUserStore.getState().syncFromDB();
      useMembershipStore.getState().syncFromDB();
      get().syncFromDB();
    }
  },

  spendCredit: (reason) => {
    console.log('[useWalletStore] spendCredit call ignored. Credits are authoritatively deducted on Supabase.');
    return true;
  },

  refundCredit: (reason) => {
    console.log('[useWalletStore] refundCredit call ignored. Credits are authoritatively refunded on Supabase.');
  },

  deductCreditLateCancel: (reason) => {
    console.log('[useWalletStore] deductCreditLateCancel call ignored. Credits are authoritatively penalised on Supabase.');
  },

  addBonusCredit: (reason) => {
    console.log('[useWalletStore] addBonusCredit call ignored. Credits are authoritatively added on Supabase.');
  },
  syncFromDB: () => {
    const userId = Database.getCurrentUserId();
    if (userId) {
      const profile = Database.getProfile(userId);
      if (profile) {
        const ledgerList = Database.getLedgerTransactions(userId) as any[];
        const paymentList = Database.getPayments(userId) as any[];
        
        // Calculate credits used and purchased
        const purchased = ledgerList
          .filter(t => t.type === 'paid' || t.type === 'refund' || t.type === 'purchase')
          .reduce((sum, curr) => sum + (curr.credits || 0), 0);

        const used = ledgerList
          .filter(t => t.type === 'spend' || t.type === 'transfer' || t.type === 'penalty')
          .reduce((sum, curr) => sum + Math.abs(curr.credits || 1), 0);

        set({
          creditBalance: profile.creditsBalance,
          ledger: ledgerList.map(tx => {
            const isAddition = tx.type === 'paid' || tx.type === 'refund' || tx.type === 'purchase';
            const changeVal = isAddition ? tx.credits : -Math.abs(tx.credits);
            
            let title = tx.type;
            if (tx.type === 'paid' || tx.type === 'purchase') {
              title = `Purchased ${tx.credits} Credits`;
            } else if (tx.type === 'spend') {
              title = 'Session Booking';
            } else if (tx.type === 'transfer') {
              title = 'Credit Transfer';
            } else if (tx.type === 'refund') {
              title = 'Credit Refund';
            } else if (tx.type === 'penalty') {
              title = 'Cancellation Penalty';
            }

            return {
              id: tx.id,
              title: title,
              change: changeVal,
              date: tx.date,
              type: isAddition ? 'purchase' : 'booking'
            };
          }),
          payments: paymentList,
          lifetimePurchased: purchased,
          creditsUsed: used
        });
      }
    } else {
      set({
        creditBalance: 0,
        ledger: [],
        payments: [],
        lifetimePurchased: 0,
        creditsUsed: 0
      });
    }
  },
  transferCredits: async (toPhone: string, amount: number) => {
    if (useMembershipStore.getState().isExpired()) {
      return { success: false, error: 'Cannot transfer credits: your membership has expired.' };
    }
    if (amount <= 0) {
      return { success: false, error: 'Transfer amount must be greater than 0.' };
    }
    const userId = Database.getCurrentUserId();
    if (!userId) return { success: false, error: 'User not logged in.' };

    const cleanPhone = toPhone.replace(/\D/g, '');
    const { data, error } = await supabase.rpc('transfer_credits', {
      p_to_phone: cleanPhone,
      p_amount: amount
    });

    if (error) {
      console.error('[DB ERROR] transfer_credits failed:', error);
      return { success: false, error: error.message };
    }

    await Database.refreshUserData(userId);
    get().syncFromDB();
    useMembershipStore.getState().syncFromDB();
    return { success: true };
  },
  clearCreditsForTesting: () => {
    console.log('[useWalletStore] clearCreditsForTesting ignored due to RLS blocks.');
  }
}));
