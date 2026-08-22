import { create } from 'zustand';
import { Membership } from '../types';
import { useUserStore } from './userStore';
import { useNotificationStore } from './notificationStore';
import { Database } from '../database/Database';

interface MembershipState {
  membership: Membership;
  customRenewalDate: string | null;
  consumeCredit: () => boolean;
  refundCredit: (amount: number) => void;
  addCredits: (amount: number) => void;
  purchaseMembership: (tier: string, credits: number, priceText: string) => void;
  buyCredits: (credits: number, priceText: string) => void;
  syncFromDB: () => void;
  toggleExpiryDate: () => void;
  isExpired: () => boolean;
}

const emptyMembership: Membership = {
  tier: 'STANDARD',
  totalCredits: 0,
  availableCredits: 0,
  renewalDate: 'Not Active',
};

export const useMembershipStore = create<MembershipState>((set, get) => ({
  membership: emptyMembership,
  customRenewalDate: null,
  isExpired: () => {
    const renewalDateStr = get().membership.renewalDate;
    if (!renewalDateStr || renewalDateStr === 'Not Scheduled' || renewalDateStr === 'Not Active') return false;
    const renewalDate = new Date(renewalDateStr);
    const now = new Date();
    return renewalDate.getTime() <= now.getTime();
  },
  toggleExpiryDate: () => {
    const isCurrentlyExpired = get().isExpired();
    const now = new Date();
    let newDate: string;
    
    if (isCurrentlyExpired) {
      const future = new Date(now);
      future.setFullYear(future.getFullYear() + 1);
      newDate = future.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    } else {
      const past = new Date(now);
      past.setDate(past.getDate() - 1);
      newDate = past.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    }
    
    set({ customRenewalDate: newDate });
    get().syncFromDB();
  },
  consumeCredit: () => {
    const userId = Database.getCurrentUserId();
    if (userId) {
      if (get().isExpired()) {
        return false;
      }
      const profile = Database.getProfile(userId);
      if (profile && profile.creditsBalance > 0) {
        profile.creditsBalance -= 1;
        Database.updateProfile(userId, { creditsBalance: profile.creditsBalance });
        get().syncFromDB();

        // Trigger credits running low warning
        if (profile.creditsBalance <= 2) {
          useNotificationStore.getState().addNotification({
            title: 'Credits Running Low ⚠️',
            body: `You only have ${profile.creditsBalance} credits left in your wallet. Top up now to avoid session disruption.`,
            type: 'Credits',
            priority: 'high',
            actionLabel: 'Buy Credits',
            deepLink: '/membership',
            icon: 'shopping-bag'
          });
        }

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

      // Trigger notifications
      useNotificationStore.getState().addNotification({
        title: 'Membership Purchased 🎟️',
        body: `Successfully upgraded to ${tier} Membership Subscription.`,
        type: 'Membership',
        priority: 'medium',
        actionLabel: 'View Plan',
        deepLink: '/membership',
        icon: 'award'
      });
      useNotificationStore.getState().addNotification({
        title: 'Credits Added 🪙',
        body: `Plus ${credits} credits added to your fitness wallet.`,
        type: 'Credits',
        priority: 'low',
        actionLabel: 'Check Wallet',
        deepLink: '/membership',
        icon: 'plus-circle'
      });
      useNotificationStore.getState().addNotification({
        title: 'Payment Successful 💳',
        body: `Payment of ${priceText} processed successfully. Invoice available.`,
        type: 'Payments',
        priority: 'low',
        actionLabel: 'Invoice',
        deepLink: '/membership',
        icon: 'shopping-bag'
      });
    }
  },
  buyCredits: (credits, priceText) => {
    const userId = Database.getCurrentUserId();
    if (userId) {
      Database.purchasePlan(userId, `Top-up Cred Pack (${credits} Credits)`, credits, priceText, '₹0', priceText);
      useUserStore.getState().syncFromDB();
      get().syncFromDB();

      // Trigger notifications
      useNotificationStore.getState().addNotification({
        title: 'Credits Added 🪙',
        body: `Plus ${credits} top-up credits added to your fitness wallet.`,
        type: 'Credits',
        priority: 'low',
        actionLabel: 'Check Wallet',
        deepLink: '/membership',
        icon: 'plus-circle'
      });
      useNotificationStore.getState().addNotification({
        title: 'Payment Successful 💳',
        body: `Payment of ${priceText} processed successfully. Invoice available.`,
        type: 'Payments',
        priority: 'low',
        actionLabel: 'Invoice',
        deepLink: '/membership',
        icon: 'shopping-bag'
      });
    }
  },
  syncFromDB: () => {
    const userId = Database.getCurrentUserId();
    if (userId) {
      const profile = Database.getProfile(userId);
      const user = Database.schema.users.find(u => u.id === userId);
      if (profile && user) {
        // Calculate total credits purchased from invoice logs
        const ledgerList = Database.getLedgerTransactions(userId) as any[];
        const purchases = ledgerList.filter(t => t.type === 'purchase');
        
        let hasActiveValidCredits = false;
        let calculatedExpiryStr = 'Not Active';
        
        if (profile.creditsBalance > 0) {
          if (get().customRenewalDate) {
            calculatedExpiryStr = get().customRenewalDate!;
            const expiryDate = new Date(calculatedExpiryStr);
            const now = new Date();
            hasActiveValidCredits = isNaN(expiryDate.getTime()) ? true : (now.getTime() < expiryDate.getTime());
          } else if (purchases.length > 0) {
            const parseDate = (dStr: string) => {
              const d = new Date(dStr);
              return isNaN(d.getTime()) ? new Date() : d;
            };
            const sortedPurchases = [...purchases].sort((a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime());
            const latestPurchaseDate = parseDate(sortedPurchases[0].date);
            const expiryDate = new Date(latestPurchaseDate);
            expiryDate.setFullYear(expiryDate.getFullYear() + 1);
            
            const now = new Date();
            hasActiveValidCredits = now.getTime() < expiryDate.getTime();
            calculatedExpiryStr = expiryDate.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
          } else {
            // No purchase transaction in ledger, but creditsBalance > 0 (e.g. admin 50 credits or reset)
            // Treat as valid, expiry is 1 year from registration or 1 year from today
            hasActiveValidCredits = true;
            let regDate = new Date();
            if (user.createdDate) {
              const d = new Date(user.createdDate);
              if (!isNaN(d.getTime())) regDate = d;
            } else if (profile.memberSince) {
              const d = new Date(profile.memberSince);
              if (!isNaN(d.getTime())) regDate = d;
            }
            const expiryDate = new Date(regDate);
            expiryDate.setFullYear(expiryDate.getFullYear() + 1);
            calculatedExpiryStr = expiryDate.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
          }
        }
        
        const calculatedTier = hasActiveValidCredits ? 'PREMIUM' : 'STANDARD';
        
        // Update database if changed to keep it in sync
        if (profile.membershipStatus?.toUpperCase() !== calculatedTier.toUpperCase()) {
          profile.membershipStatus = calculatedTier;
          Database.updateProfile(userId, { membershipStatus: calculatedTier });
        }
        
        const totalPurchased = ledgerList
          .filter(t => t.type === 'purchase')
          .reduce((sum, curr) => sum + curr.credits, 0);

        set({
          membership: {
            tier: calculatedTier,
            totalCredits: totalPurchased,
            availableCredits: profile.creditsBalance,
            renewalDate: calculatedExpiryStr,
          }
        });
      }
    } else {
      set({
        membership: {
          tier: 'STANDARD',
          totalCredits: 0,
          availableCredits: 0,
          renewalDate: 'Not Active',
        }
      });
    }
  }
}));
