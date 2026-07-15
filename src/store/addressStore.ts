import { create } from 'zustand';

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
}

const mockAddresses: Address[] = [
  {
    id: 'a-1',
    label: 'Home',
    addressLine: 'Flat 402, Sea Breeze Apts, Bandra West, Mumbai, Maharashtra 400050',
    isDefault: true,
  },
  {
    id: 'a-2',
    label: 'Office',
    addressLine: '9th Floor, Maker Chambers VI, Nariman Point, Mumbai, Maharashtra 400021',
    isDefault: false,
  },
  {
    id: 'a-3',
    label: 'Saved Address',
    addressLine: 'Bungalow 12, Windermere Society, Juhu, Mumbai, Maharashtra 400049',
    isDefault: false,
  },
];

export const useAddressStore = create<AddressState>((set) => ({
  addresses: mockAddresses,
  selectedAddressId: 'a-1',
  addAddress: (addr) =>
    set((state) => {
      const id = `a-${Date.now()}`;
      const newAddress = { ...addr, id };
      const updatedAddresses = addr.isDefault
        ? state.addresses.map((a) => ({ ...a, isDefault: false })).concat(newAddress)
        : state.addresses.concat(newAddress);
      return { addresses: updatedAddresses, selectedAddressId: addr.isDefault ? id : state.selectedAddressId };
    }),
  updateAddress: (id, updated) =>
    set((state) => {
      let updatedAddresses = state.addresses.map((a) =>
        a.id === id ? { ...a, ...updated } : a
      );
      if (updated.isDefault) {
        updatedAddresses = updatedAddresses.map((a) =>
          a.id === id ? a : { ...a, isDefault: false }
        );
      }
      return { addresses: updatedAddresses };
    }),
  deleteAddress: (id) =>
    set((state) => {
      const updated = state.addresses.filter((a) => a.id !== id);
      // Fallback default
      if (updated.length > 0 && !updated.some((a) => a.isDefault)) {
        updated[0].isDefault = true;
      }
      return {
        addresses: updated,
        selectedAddressId: state.selectedAddressId === id ? (updated[0]?.id || '') : state.selectedAddressId,
      };
    }),
  setDefaultAddress: (id) =>
    set((state) => ({
      addresses: state.addresses.map((a) => ({
        ...a,
        isDefault: a.id === id,
      })),
    })),
  setSelectedAddressId: (id) => set({ selectedAddressId: id }),
}));
