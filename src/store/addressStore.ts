import { create } from 'zustand';
import { Database } from '../database/Database';
import { useUserStore } from './userStore';
import { supabase } from '../database/supabaseClient';

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
  addAddress: (address: Omit<Address, 'id' | 'addressLine'>) => Promise<any>;
  updateAddress: (id: string, updated: Partial<Address>) => void;
  deleteAddress: (id: string) => void;
  setDefaultAddress: (id: string) => void;
  setSelectedAddressId: (id: string) => void;
  syncFromDB: () => void;
}

export const useAddressStore = create<AddressState>((set, get) => ({
  addresses: [],
  selectedAddressId: '',
  addAddress: async (addr) => {
    let userId = Database.getCurrentUserId();
    if (!userId) {
      userId = useUserStore.getState().user?.id;
      if (userId) {
        Database.setCurrentUserId(userId);
      }
    }
    
    console.log('[ADDRESSSTORE] addAddress called. userId:', userId, 'payload:', addr);
    if (!userId) {
      throw new Error('Authentication required. No logged-in user found.');
    }

    // Call existing persistence mechanism
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

    if (!added || !added.id) {
      throw new Error('Local address persistence failed to return a valid address ID.');
    }

    // Database Verification: Poll Supabase to confirm the row exists
    console.log('[ADDRESSSTORE] Verifying address persistence in Supabase for ID:', added.id);
    let verified = false;
    let dbRecord = null;
    let lastError = null;

    for (let i = 0; i < 5; i++) {
      try {
        const { data, error } = await supabase
          .from('addresses')
          .select('*')
          .eq('id', added.id);

        if (error) {
          lastError = error;
        } else if (data && data.length > 0) {
          verified = true;
          dbRecord = data[0];
          break;
        }
      } catch (err) {
        lastError = err;
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    if (!verified) {
      console.error('[ADDRESSSTORE] Database write verification failed for ID:', added.id, 'Error:', lastError);
      throw new Error(
        `Address write could not be verified in the database. Detail: ${
          lastError ? JSON.stringify(lastError) : 'Timeout checking for created row'
        }`
      );
    }

    console.log('[ADDRESSSTORE] Database verification succeeded! Persisted record:', dbRecord);

    // Controlled refresh
    get().syncFromDB();

    // Verify that the newly saved address can be read back from the store
    const list = get().addresses;
    const verifiedInStore = list.some(a => a.id === added.id);
    if (!verifiedInStore) {
      throw new Error('Sync failed: Newly saved address is missing from the synchronized store.');
    }

    // Set the newly created address as the selected one
    set({ selectedAddressId: added.id });
    
    return added;
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
    let userId = Database.getCurrentUserId();
    if (!userId) {
      userId = useUserStore.getState().user?.id;
      if (userId) {
        Database.setCurrentUserId(userId);
      }
    }
    
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
