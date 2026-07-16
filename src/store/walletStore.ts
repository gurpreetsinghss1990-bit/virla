import { create } from 'zustand';
import { useUserStore } from './userStore';
import { useMembershipStore } from './membershipStore';

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
}

const mockLedger: LedgerTransaction[] = [
  { id: 'tx-5', title: 'Cancelled Late (Late Penalty)', change: -1, date: 'Jul 14, 2026', type: 'penalty' },
  { id: 'tx-4', title: 'Bonus Credit Awarded', change: 1, date: 'Jul 13, 2026', type: 'bonus' },
  { id: 'tx-3', title: 'Booking b-2 Refunded', change: 1, date: 'Jul 12, 2026', type: 'refund' },
  { id: 'tx-2', title: 'Booked Strength Session (Karan)', change: -1, date: 'Jul 11, 2026', type: 'booking' },
  { id: 'tx-1', title: 'Purchased Premium Pack', change: 12, date: 'Jul 10, 2026', type: 'purchase' }
];

const mockPayments: PaymentRecord[] = [
  {
    id: 'pay-1',
    invoiceNo: 'VR-2026-8910',
    date: 'Jul 10, 2026',
    planName: 'Premium Pack',
    credits: 12,
    amount: '₹8,474',
    gst: '₹1,525',
    total: '₹9,999',
    method: 'Apple Pay (•••• 4920)',
    status: 'completed'
  },
  {
    id: 'pay-2',
    invoiceNo: 'VR-2026-8742',
    date: 'Jul 08, 2026',
    planName: 'Single Session',
    credits: 1,
    amount: '₹846',
    gst: '₹153',
    total: '₹999',
    method: 'UPI Auto-debit (viral@okaxis)',
    status: 'refunded'
  },
  {
    id: 'pay-3',
    invoiceNo: 'VR-2026-8201',
    date: 'Jul 01, 2026',
    planName: 'Starter Pack',
    credits: 8,
    amount: '₹5,931',
    gst: '₹1,068',
    total: '₹6,999',
    method: 'Apple Pay (•••• 4920)',
    status: 'completed'
  },
  {
    id: 'pay-4',
    invoiceNo: 'VR-2026-7840',
    date: 'Jun 28, 2026',
    planName: 'Premium Pack',
    credits: 12,
    amount: '₹8,474',
    gst: '₹1,525',
    total: '₹9,999',
    method: 'Credit Card (•••• 5821)',
    status: 'failed'
  }
];

export const useWalletStore = create<WalletState>((set, get) => ({
  creditBalance: 12,
  lifetimePurchased: 21,
  creditsUsed: 9,
  ledger: mockLedger,
  payments: mockPayments,

  purchasePlan: (planName, credits, priceText, totalText, gstText) => {
    const { creditBalance, lifetimePurchased, payments, ledger } = get();
    
    // Add payments registry record
    const newPay: PaymentRecord = {
      id: `pay-${Date.now().toString().slice(-4)}`,
      invoiceNo: `VR-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
      planName,
      credits,
      amount: priceText,
      gst: gstText,
      total: totalText,
      method: 'Apple Pay (•••• 4920)',
      status: 'completed'
    };

    // Add ledger record
    const newTx: LedgerTransaction = {
      id: `tx-${Date.now().toString().slice(-4)}`,
      title: `Purchased ${planName}`,
      change: credits,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
      type: 'purchase'
    };

    set({
      creditBalance: creditBalance + credits,
      lifetimePurchased: lifetimePurchased + credits,
      payments: [newPay, ...payments],
      ledger: [newTx, ...ledger]
    });

    // Sync with UserStore invoices list & MembershipStore credit counts
    useUserStore.getState().addInvoice({
      type: `${planName} Purchase`,
      amount: totalText,
      status: 'paid',
      credits
    });

    // Sync with MembershipStore
    useMembershipStore.getState().addCredits(credits);
  },

  useCredit: (reason) => {
    const { creditBalance, creditsUsed, ledger } = get();
    if (creditBalance <= 0) return false;

    const newTx: LedgerTransaction = {
      id: `tx-${Date.now().toString().slice(-4)}`,
      title: reason,
      change: -1,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
      type: 'booking'
    };

    set({
      creditBalance: creditBalance - 1,
      creditsUsed: creditsUsed + 1,
      ledger: [newTx, ...ledger]
    });

    return true;
  },

  refundCredit: (reason) => {
    const { creditBalance, creditsUsed, ledger } = get();
    const newTx: LedgerTransaction = {
      id: `tx-${Date.now().toString().slice(-4)}`,
      title: reason,
      change: 1,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
      type: 'refund'
    };

    set({
      creditBalance: creditBalance + 1,
      creditsUsed: Math.max(0, creditsUsed - 1),
      ledger: [newTx, ...ledger]
    });
  },

  deductCreditLateCancel: (reason) => {
    const { creditBalance, creditsUsed, ledger } = get();
    const newTx: LedgerTransaction = {
      id: `tx-${Date.now().toString().slice(-4)}`,
      title: reason,
      change: -1,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
      type: 'penalty'
    };

    set({
      creditBalance: Math.max(0, creditBalance - 1),
      creditsUsed: creditsUsed + 1,
      ledger: [newTx, ...ledger]
    });
  },

  addBonusCredit: (reason) => {
    const { creditBalance, lifetimePurchased, ledger } = get();
    const newTx: LedgerTransaction = {
      id: `tx-${Date.now().toString().slice(-4)}`,
      title: reason,
      change: 1,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
      type: 'bonus'
    };

    set({
      creditBalance: creditBalance + 1,
      lifetimePurchased: lifetimePurchased + 1,
      ledger: [newTx, ...ledger]
    });
  }
}));
