import React from 'react';
import { useUserStore } from '../store/userStore';
import CustomerWallet from '../components/wallet/CustomerWallet';
import TrainerWallet from '../components/wallet/TrainerWallet';

export default function WalletScreen() {
  const role = useUserStore((s) => s.role);
  return role === 'trainer' ? <TrainerWallet /> : <CustomerWallet />;
}
