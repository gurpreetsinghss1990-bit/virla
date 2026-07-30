import { create } from 'zustand';
import { Database } from '../database/Database';

export interface Address {
  id: string;
  label: 'Home' | 'Office' | 'Gym' | 'Custom';
  addressLine: string;
  building: string;
  street: string;
  landmark: string;
  city: string;
  pinCode: string;
  isDefault: boolean;
  lat: number;
  lng: number;
  apartment?: string;
  floor?: string;
  notes?: string;
}

interface AddressState {
  addresses: Address[];
  selectedAddressId: string;
  addAddress: (address: Omit<Address, 'id' | 'addressLine'>) => void;
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
        building: addr.building || '',
        street: addr.street || '',
        landmark: addr.landmark || '',
        city: addr.city || 'Mumbai',
        pinCode: addr.pinCode || '',
        isDefault: addr.isDefault,
        lat: addr.lat || 19.0176,
        lng: addr.lng || 72.8164,
        apartment: addr.apartment || '',
        floor: addr.floor || '',
        notes: addr.notes || ''
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
      building: updated.building,
      street: updated.street,
      landmark: updated.landmark,
      city: updated.city,
      pinCode: updated.pinCode,
      isDefault: updated.isDefault,
      lat: updated.lat,
      lng: updated.lng,
      apartment: updated.apartment,
      floor: updated.floor,
      notes: updated.notes
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
        label: addr.label || 'Custom',
        addressLine: addr.building + (addr.street ? `, ${addr.street}` : '') + (addr.city ? `, ${addr.city}` : ''),
        building: addr.building || '',
        street: addr.street || '',
        landmark: addr.landmark || '',
        city: addr.city || 'Mumbai',
        pinCode: addr.pinCode || '',
        isDefault: addr.isDefault,
        lat: addr.lat || 19.0176,
        lng: addr.lng || 72.8164,
        apartment: addr.apartment || '',
        floor: addr.floor || '',
        notes: addr.notes || ''
      }));
      set({
        addresses: list,
        selectedAddressId: get().selectedAddressId || list.find(a => a.isDefault)?.id || list[0]?.id || ''
      });
    } else {
      set({
        addresses: [],
        selectedAddressId: ''
      });
    }
  }
}));
