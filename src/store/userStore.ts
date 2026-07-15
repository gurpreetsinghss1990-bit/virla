import { create } from 'zustand';
import { User } from '../types';

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
}

const mockUser: User = {
  id: 'u-1',
  name: 'Virral',
  email: 'virral@example.com',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
  location: 'Mumbai, India',
};

const mockFamily: FamilyMember[] = [
  { id: 'fm-1', name: 'Aarav Sharma', relation: 'Brother' },
  { id: 'fm-2', name: 'Neha Sharma', relation: 'Sister' },
  { id: 'fm-3', name: 'Vikram Sharma', relation: 'Father' },
];

export const useUserStore = create<UserState>((set) => ({
  user: mockUser,
  familyMembers: mockFamily,
  updateProfile: (profile) =>
    set((state) => ({
      user: { ...state.user, ...profile },
    })),
}));
