import { create } from 'zustand';
import { User, Invoice } from '../types';

interface FamilyMember {
  id: string;
  name: string;
  relation: string;
  age?: number;
  gender?: string;
  notes?: string;
}

interface UserState {
  user: User;
  familyMembers: FamilyMember[];
  updateProfile: (profile: Partial<User>) => void;
  // Sprint 6 additions
  role: 'customer' | 'trainer';
  setRole: (role: 'customer' | 'trainer') => void;
  invoices: Invoice[];
  addInvoice: (invoice: Omit<Invoice, 'id' | 'date'>) => void;
}

const mockUser: User = {
  id: 'u-1',
  name: 'Viral',
  email: 'viral@example.com',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
  location: 'Mumbai, India',
  role: 'customer',
};

const mockFamily: FamilyMember[] = [
  { id: 'fm-1', name: 'Aarav Sharma', relation: 'Brother' },
  { id: 'fm-2', name: 'Neha Sharma', relation: 'Sister' },
  { id: 'fm-3', name: 'Vikram Sharma', relation: 'Father' },
];

const mockInvoices: Invoice[] = [
  {
    id: 'inv-101',
    type: 'Elite Premium Annual Membership Plan',
    amount: '₹14,999',
    date: 'Jul 01, 2026',
    status: 'paid',
    credits: 16,
  },
  {
    id: 'inv-102',
    type: 'Concierge Top-up credit pack (5 Credits)',
    amount: '₹4,500',
    date: 'Jul 10, 2026',
    status: 'paid',
    credits: 5,
  }
];

export const useUserStore = create<UserState>((set) => ({
  user: mockUser,
  familyMembers: mockFamily,
  updateProfile: (profile) =>
    set((state) => ({
      user: { ...state.user, ...profile },
    })),
  // Sprint 6 state & actions
  role: 'customer',
  setRole: (r) => set((state) => ({
    role: r,
    user: { ...state.user, role: r }
  })),
  invoices: mockInvoices,
  addInvoice: (inv) => set((state) => {
    const newInv: Invoice = {
      ...inv,
      id: `inv-${Date.now().toString().slice(-4)}`,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
    };
    return { invoices: [newInv, ...state.invoices] };
  }),
}));
