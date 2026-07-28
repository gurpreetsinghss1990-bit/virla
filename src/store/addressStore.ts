import { create } from 'zustand';
import { Database } from '../database/Database';

export interface Address {
  id: string;
  label: string; // 'Home' | 'Office' | 'Saved Address' etc.
  addressLine: string;
  isDefault: boolean;
}

interface AddressState {
  addresses: Address[];
  selectedAddressId: string;
  addAddress: (address: Omit<Address, 'id'>) => void;
  updateAddress: (id: string, updated: Partial<Address>) => void;
  deleteAddress: (id: string) => void;
  setDefaultAddress: (id: string) => void;
  setSelectedAddressId: (id: string) => void;
  syncFromDB: () => void;
}

export const useAddressStore = create<AddressState>((set, get) => ({
  addresses: [],
  selectedAddressId: '',
  addAddress: (addr) => {
    const userId = Database.getCurrentUserId();
    if (userId) {
      const added = Database.addAddress(userId, {
        label: addr.label as any,
        name: addr.label,
        building: addr.addressLine,
        street: '',
        landmark: '',
        city: 'Mumbai',
        pinCode: '',
        isDefault: addr.isDefault
      });
      get().syncFromDB();
      if (addr.isDefault) {
        set({ selectedAddressId: added.id });
      }
    }
  },
  updateAddress: (id, updated) => {
    Database.updateAddress(id, {
      label: updated.label as any,
      building: updated.addressLine,
      isDefault: updated.isDefault
    });
    get().syncFromDB();
  },
  deleteAddress: (id) => {
    Database.deleteAddress(id);
    get().syncFromDB();
    const { addresses } = get();
    if (addresses.length > 0 && !addresses.some(a => a.isDefault)) {
      Database.updateAddress(addresses[0].id, { isDefault: true } as any);
      get().syncFromDB();
    }
  },
  setDefaultAddress: (id) => {
    Database.updateAddress(id, { isDefault: true } as any);
    get().syncFromDB();
  },
  setSelectedAddressId: (id) => set({ selectedAddressId: id }),
  syncFromDB: () => {
    const userId = Database.getCurrentUserId();
    if (userId) {
      const list = Database.getAddresses(userId).map(addr => ({
        id: addr.id,
        label: addr.label,
        addressLine: addr.building + (addr.street ? `, ${addr.street}` : '') + (addr.city ? `, ${addr.city}` : ''),
        isDefault: addr.isDefault
      }));
      set({
        addresses: list,
        selectedAddressId: get().selectedAddressId || list.find(a => a.isDefault)?.id || list[0]?.id || ''
      });
    }
  }
}));
