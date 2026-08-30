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
  creditLots: any[];
  
  // Actions
  purchasePlan: (planName: string, credits: number, priceText: string, totalText: string, gstText: string) => void;
  spendCredit: (reason: string) => boolean;
  refundCredit: (reason: string) => void;
  deductCreditLateCancel: (reason: string) => void;
  addBonusCredit: (reason: string) => void;
  syncFromDB: () => Promise<void>;
  transferCredits: (toPhone: string, amount: number) => Promise<{ success: boolean; error?: string; recipientName?: string; expiryDate?: string }>;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  creditBalance: 0,
  lifetimePurchased: 0,
  creditsUsed: 0,
  ledger: [],
  payments: [],
  creditLots: [],

  purchasePlan: async (planName, credits, priceText, totalText, gstText) => {
    const userId = Database.getCurrentUserId();
    if (userId) {
      try {
        await Database.purchasePlan(userId, planName, credits, priceText, gstText, totalText);
        if (planName.toLowerCase().includes('elite')) {
          Database.updateProfile(userId, { membershipStatus: 'Elite' });
        }
        useUserStore.getState().syncFromDB();
        useMembershipStore.getState().syncFromDB();
        get().syncFromDB();
      } catch (err) {
        console.error('[walletStore] purchasePlan failed:', err);
      }
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

  syncFromDB: async () => {
    const userId = Database.getCurrentUserId();
    if (userId) {
      if (!Database.getIsLoaded()) {
        console.warn('[WalletStore] syncFromDB called before database finished loading. Skipping sync.');
        return;
      }

      // Authoritative scheduled reminders & expiries local safety run
      await supabase.rpc('process_credit_expiries_and_reminders');

      await Database.refreshUserData(userId);
      const profile = Database.getProfile(userId);
      if (profile) {
        const ledgerList = Database.getLedgerTransactions(userId) as any[];
        const paymentList = Database.getPayments(userId) as any[];
        
        // Fetch active credit lots
        const { data: lots } = await supabase
          .from('credit_lots')
          .select('*')
          .eq('user_id', userId)
          .gt('remaining_credits', 0)
          .order('official_expiry_date', { ascending: true });

        // Calculate credits used and purchased
        const purchased = ledgerList
          .filter(t => t.type === 'paid' || t.type === 'refund' || t.type === 'purchase' || t.type === 'transfer_received')
          .reduce((sum, curr) => sum + (curr.credits || 0), 0);

        const used = ledgerList
          .filter(t => t.type === 'spend' || t.type === 'transfer_sent' || t.type === 'penalty' || t.type === 'expired')
          .reduce((sum, curr) => sum + Math.abs(curr.credits || 1), 0);

        set({
          creditBalance: profile.creditsBalance,
          creditLots: lots || [],
          ledger: ledgerList.map(tx => {
            const isAddition = tx.type === 'paid' || tx.type === 'refund' || tx.type === 'purchase' || tx.type === 'transfer_received';
            const changeVal = isAddition ? tx.credits : -Math.abs(tx.credits);
            
            let title = tx.type;
            let ledgerType: any = 'booking';

            if (tx.type === 'paid' || tx.type === 'purchase') {
              title = `Purchased ${tx.credits} Credits`;
              ledgerType = 'purchase';
            } else if (tx.type === 'spend') {
              title = 'Session Booking';
              ledgerType = 'booking';
            } else if (tx.type === 'transfer_sent') {
              title = `Credits Transferred (${tx.amount})`;
              ledgerType = 'penalty';
            } else if (tx.type === 'transfer_received') {
              title = `Credits Received (${tx.amount})`;
              ledgerType = 'purchase';
            } else if (tx.type === 'refund') {
              title = 'Credit Refund';
              ledgerType = 'refund';
            } else if (tx.type === 'penalty') {
              title = 'Cancellation Penalty';
              ledgerType = 'penalty';
            } else if (tx.type === 'expired') {
              title = 'Expired Credits';
              ledgerType = 'penalty';
            }

            return {
              id: tx.id,
              title: title,
              change: changeVal,
              date: tx.date,
              type: ledgerType
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
        creditLots: [],
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

    const { data, error } = await supabase.rpc('transfer_credits', {
      p_to_phone: toPhone,
      p_amount: amount
    });

    if (error) {
      console.error('[DB ERROR] transfer_credits failed:', error);
      return { success: false, error: error.message };
    }

    await Database.refreshUserData(userId);
    await get().syncFromDB();
    useMembershipStore.getState().syncFromDB();

    return { 
      success: true, 
      recipientName: data?.recipient_name,
      expiryDate: data?.expiry_date 
    };
  }
}));
