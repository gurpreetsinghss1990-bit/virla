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
  useCredit: (reason: string) => boolean;
  refundCredit: (reason: string) => void;
  deductCreditLateCancel: (reason: string) => void;
  addBonusCredit: (reason: string) => void;
  syncFromDB: () => void;
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
      useUserStore.getState().syncFromDB();
      useMembershipStore.getState().syncFromDB();
      get().syncFromDB();
    }
  },

  useCredit: (reason) => {
    const userId = Database.getCurrentUserId();
    if (userId) {
      const profile = Database.getProfile(userId);
      if (profile && profile.creditsBalance > 0) {
        profile.creditsBalance -= 1;
        Database.addLedgerTransaction(userId, {
          id: Database.generateUUID('tx'),
          type: 'booking' as any,
          title: reason,
          change: -1,
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
        } as any);
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
          type: 'refund' as any,
          title: reason,
          change: 1,
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
        } as any);
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
          type: 'penalty' as any,
          title: reason,
          change: -1,
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
        } as any);
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
          type: 'bonus' as any,
          title: reason,
          change: 1,
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
        } as any);
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
          .filter(t => t.change > 0)
          .reduce((sum, curr) => sum + curr.credits, 0);

        const used = ledgerList
          .filter(t => t.change < 0)
          .reduce((sum, curr) => sum + Math.abs(curr.credits || 1), 0);

        set({
          creditBalance: profile.creditsBalance,
          ledger: ledgerList.map(tx => ({
            id: tx.id,
            title: tx.type === 'paid' ? `Purchased plan (${tx.credits} credits)` : tx.type,
            change: tx.credits || 0,
            date: tx.date,
            type: tx.type === 'paid' ? 'purchase' : tx.type
          })),
          payments: paymentList,
          lifetimePurchased: purchased,
          creditsUsed: used
        });
      }
    }
  }
}));
