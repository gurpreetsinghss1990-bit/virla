import { create } from 'zustand';
import { useUserStore } from './userStore';
import { useMembershipStore } from './membershipStore';
import { Database } from '../database/Database';

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
  transferCredits: (toPhone: string, amount: number) => { success: boolean; error?: string };
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
    if (useMembershipStore.getState().isExpired()) {
      return false;
    }
    const userId = Database.getCurrentUserId();
    if (userId) {
      const profile = Database.getProfile(userId);
      if (profile && profile.creditsBalance > 0) {
        profile.creditsBalance -= 1;
        Database.addLedgerTransaction(userId, {
          id: Database.generateUUID('tx'),
          type: 'spend',
          amount: '₹0',
          status: 'paid',
          credits: 1,
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
        });
        useMembershipStore.getState().syncFromDB();
        get().syncFromDB();
        return true;
      }
    }
    return false;
  },

  refundCredit: (reason) => {
    const userId = Database.getCurrentUserId();
    if (userId) {
      const profile = Database.getProfile(userId);
      if (profile) {
        profile.creditsBalance += 1;
        Database.addLedgerTransaction(userId, {
          id: Database.generateUUID('tx'),
          type: 'refund',
          amount: '₹0',
          status: 'paid',
          credits: 1,
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
        });
        useMembershipStore.getState().syncFromDB();
        get().syncFromDB();
      }
    }
  },

  deductCreditLateCancel: (reason) => {
    const userId = Database.getCurrentUserId();
    if (userId) {
      const profile = Database.getProfile(userId);
      if (profile) {
        profile.creditsBalance = Math.max(0, profile.creditsBalance - 1);
        Database.addLedgerTransaction(userId, {
          id: Database.generateUUID('tx'),
          type: 'penalty',
          amount: '₹0',
          status: 'paid',
          credits: 1,
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
        });
        useMembershipStore.getState().syncFromDB();
        get().syncFromDB();
      }
    }
  },

  addBonusCredit: (reason) => {
    const userId = Database.getCurrentUserId();
    if (userId) {
      const profile = Database.getProfile(userId);
      if (profile) {
        profile.creditsBalance += 1;
        Database.addLedgerTransaction(userId, {
          id: Database.generateUUID('tx'),
          type: 'refund',
          amount: '₹0',
          status: 'paid',
          credits: 1,
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
        });
        useMembershipStore.getState().syncFromDB();
        get().syncFromDB();
      }
    }
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
  transferCredits: (toPhone: string, amount: number) => {
    if (useMembershipStore.getState().isExpired()) {
      return { success: false, error: 'Cannot transfer credits: your membership has expired.' };
    }
    const currentBalance = get().creditBalance;
    if (amount <= 0) {
      return { success: false, error: 'Transfer amount must be greater than 0.' };
    }
    if (currentBalance < amount) {
      return { success: false, error: 'Insufficient credits available for transfer.' };
    }
    const userId = Database.getCurrentUserId();
    if (userId) {
      const profile = Database.getProfile(userId);
      if (profile) {
        profile.creditsBalance -= amount;
        Database.updateProfile(userId, { creditsBalance: profile.creditsBalance });
        
        Database.addLedgerTransaction(userId, {
          id: Database.generateUUID('tx'),
          type: 'transfer',
          amount: '₹0',
          status: 'paid',
          credits: amount,
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
        });

        get().syncFromDB();
        useMembershipStore.getState().syncFromDB();
        return { success: true };
      }
    }
    return { success: false, error: 'An unexpected error occurred during transfer.' };
  },
  clearCreditsForTesting: () => {
    const userId = Database.getCurrentUserId();
    if (userId) {
      const profile = Database.getProfile(userId);
      if (profile) {
        profile.creditsBalance = 0;
        Database.updateProfile(userId, { creditsBalance: 0 });
        get().syncFromDB();
        useMembershipStore.getState().syncFromDB();
      }
    }
  }
}));
