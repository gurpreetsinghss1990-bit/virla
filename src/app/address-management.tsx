import React, { useState } from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAddressStore, Address } from '../store/addressStore';
import { Ionicons } from '@expo/vector-icons';

export default function AddressManagementScreen() {
  const router = useRouter();
  const { addresses, addAddress, updateAddress, deleteAddress, setDefaultAddress } = useAddressStore();

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  const resetForm = () => {
    setLabel('');
    setAddressLine('');
    setIsDefault(false);
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (addr: Address) => {
    setEditingId(addr.id);
    setLabel(addr.label);
    setAddressLine(addr.addressLine);
    setIsDefault(addr.isDefault);
    setShowForm(true);
  };

  const handleSave = () => {
    if (!label.trim() || !addressLine.trim()) {
      Alert.alert('Incomplete Form', 'Please enter a label (e.g. Home, Work) and the full address.');
      return;
    }

    if (editingId) {
      updateAddress(editingId, {
        label: label.trim(),
        addressLine: addressLine.trim(),
        isDefault,
      });
      Alert.alert('Success', 'Address updated successfully.');
    } else {
      addAddress({
        label: label.trim(),
        addressLine: addressLine.trim(),
        isDefault,
      });
      Alert.alert('Success', 'New address added successfully.');
    }

    resetForm();
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      'Delete Address',
      'Are you sure you want to remove this address?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteAddress(id);
            Alert.alert('Deleted', 'Address removed successfully.');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header back button */}
      <View className="h-14 flex-row items-center px-6 border-b border-zinc-100">
        <TouchableOpacity onPress={() => router.back()} className="w-8 h-8 items-center justify-center">
          <Ionicons name="arrow-back" size={20} color="#111111" />
        </TouchableOpacity>
        <Text className="flex-1 text-center text-primary text-base font-black tracking-tight mr-8">
          Manage Addresses
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView showsVerticalScrollIndicator={false} className="flex-1 p-6">
          {showForm ? (
            /* Address Form View (Add / Edit) */
            <View className="gap-5">
              <Text className="text-primary text-lg font-black tracking-tight">
                {editingId ? 'Edit Address' : 'Add New Address'}
              </Text>

              <View className="gap-2">
                <Text className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Address Label</Text>
                <TextInput
                  value={label}
                  onChangeText={setLabel}
                  placeholder="e.g. Home, Office, Parents House"
                  placeholderTextColor="#A1A1AA"
                  className="border border-zinc-200 p-4 rounded-xl text-primary text-xs font-bold bg-zinc-50"
                />
              </View>

              <View className="gap-2">
                <Text className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Full Address Details</Text>
                <TextInput
                  value={addressLine}
                  onChangeText={setAddressLine}
                  placeholder="Street, flat number, landmark, city, pin code"
                  placeholderTextColor="#A1A1AA"
                  multiline
                  numberOfLines={3}
                  className="border border-zinc-200 p-4 rounded-xl text-primary text-xs font-bold bg-zinc-50 h-24 text-top"
                />
              </View>

              {/* Set as Default Switch */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setIsDefault(!isDefault)}
                className="flex-row items-center gap-3 p-1"
              >
                <View className={`w-5 h-5 rounded border items-center justify-center ${isDefault ? 'bg-green-500 border-green-500' : 'border-zinc-300'}`}>
                  {isDefault && <Ionicons name="checkmark" size={12} color="white" />}
                </View>
                <Text className="text-primary text-xs font-bold">Set as Default Address</Text>
              </TouchableOpacity>

              <View className="flex-row gap-4 mt-4">
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={resetForm}
                  className="flex-1 py-4 bg-zinc-100 rounded-2xl items-center justify-center border border-zinc-200/50"
                >
                  <Text className="text-primary text-xs font-bold">Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleSave}
                  className="flex-1 py-4 bg-zinc-900 rounded-2xl items-center justify-center"
                >
                  <Text className="text-white text-xs font-black">Save Address</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* Saved Addresses List View */
            <View className="gap-5">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-zinc-500 text-sm font-medium">Your registered session venues</Text>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setShowForm(true)}
                  className="bg-zinc-900 px-4 py-2 rounded-full flex-row items-center gap-1 shadow-sm"
                >
                  <Ionicons name="add" size={14} color="white" />
                  <Text className="text-white text-[10px] font-black uppercase tracking-wider">Add New</Text>
                </TouchableOpacity>
              </View>

              {addresses.map((addr) => (
                <View
                  key={addr.id}
                  className={`p-5 rounded-2xl border-2 shadow-xs bg-white ${
                    addr.isDefault ? 'border-primary' : 'border-zinc-100'
                  }`}
                >
                  <View className="flex-row justify-between items-center mb-2">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-primary text-base font-black tracking-tight">{addr.label}</Text>
                      {addr.isDefault && (
                        <View className="bg-green-500/10 px-2.5 py-0.5 rounded-full border border-green-500/20">
                          <Text className="text-green-600 text-[8px] font-black uppercase tracking-wider">Default</Text>
                        </View>
                      )}
                    </View>
                    <View className="flex-row gap-2">
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleEdit(addr)}
                        className="w-8 h-8 rounded-full bg-zinc-50 items-center justify-center border border-zinc-100"
                      >
                        <Ionicons name="pencil" size={14} color="#71717A" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleDelete(addr.id)}
                        className="w-8 h-8 rounded-full bg-zinc-50 items-center justify-center border border-zinc-100"
                      >
                        <Ionicons name="trash" size={14} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Text className="text-zinc-500 text-xs font-semibold leading-relaxed mb-4">
                    {addr.addressLine}
                  </Text>

                  {!addr.isDefault && (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => setDefaultAddress(addr.id)}
                      className="border border-zinc-200 py-2 rounded-xl items-center"
                    >
                      <Text className="text-primary text-[10px] font-bold uppercase tracking-wider">Set as Default</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
