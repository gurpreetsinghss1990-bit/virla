import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Switch, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useUserProfileStore, SavedAddress } from '../store/userProfileStore';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { fetchGooglePlacesAutocomplete, fetchGooglePlaceDetails, reverseGeocodeCoords, AutocompleteSuggestion } from '../utils/distance';

export default function AddressManagementScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addresses, addAddress, updateAddress, deleteAddress, setDefaultAddress } = useUserProfileStore();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [label, setLabel] = useState<'Home' | 'Office' | 'Gym' | 'Custom'>('Home');
  const [name, setName] = useState('');
  const [building, setBuilding] = useState('');
  const [street, setStreet] = useState('');
  const [landmark, setLandmark] = useState('');
  const [city, setCity] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  // New location-based states
  const [lat, setLat] = useState<number | undefined>(undefined);
  const [lng, setLng] = useState<number | undefined>(undefined);
  const [placeId, setPlaceId] = useState('');
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Array<AutocompleteSuggestion>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [sessionToken, setSessionToken] = useState('');

  // Generate session token on form open
  useEffect(() => {
    if (showForm) {
      setSessionToken(Math.random().toString(36).substring(2, 15) + Date.now().toString());
    }
  }, [showForm]);

  // Debounced search query autocomplete
  useEffect(() => {
    if (searchQuery.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    let active = true;
    const delay = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetchGooglePlacesAutocomplete(searchQuery, sessionToken);
        if (active) {
          setSuggestions(res);
        }
      } catch (err) {
        console.warn('Autocomplete fetch failed:', err);
      } finally {
        if (active) {
          setIsSearching(false);
        }
      }
    }, 450);

    return () => {
      active = false;
      clearTimeout(delay);
    };
  }, [searchQuery, sessionToken]);

  const handleUseCurrentLocation = async () => {
    setIsSearching(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to use your current location.');
        setIsSearching(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });
      const { latitude, longitude } = loc.coords;
      const res = await reverseGeocodeCoords(latitude, longitude);

      setLat(latitude);
      setLng(longitude);
      setPlaceId(res.placeId || '');
      setStreet(res.address);
      setSearchQuery(res.address);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to get current location.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSuggestion = async (suggestion: AutocompleteSuggestion) => {
    setIsSearching(true);
    setSuggestions([]);
    try {
      const details = await fetchGooglePlaceDetails(suggestion.placeId);
      setLat(details.latitude);
      setLng(details.longitude);
      setPlaceId(suggestion.placeId);
      setStreet(details.address);
      setSearchQuery(details.address);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load place details.');
    } finally {
      setIsSearching(false);
    }
  };

  const resetForm = () => {
    setLabel('Home');
    setName('');
    setBuilding('');
    setStreet('');
    setLandmark('');
    setCity('');
    setPinCode('');
    setIsDefault(false);
    setLat(undefined);
    setLng(undefined);
    setPlaceId('');
    setSearchQuery('');
    setSuggestions([]);
    setEditingId(null);
    setShowForm(false);
  };

  const handleSave = () => {
    if (!name.trim() || !building.trim() || !street.trim() || !city.trim() || !pinCode.trim()) {
      Alert.alert('Incomplete Form', 'Please fill in Name, Building, Street, City, and PIN Code.');
      return;
    }
    if (lat === undefined || lng === undefined || lat === 0 || lng === 0) {
      Alert.alert('Location Required', 'Please resolve your coordinates by using Current Location or selecting an autocomplete suggestion.');
      return;
    }

    const payload = {
      label,
      name: name.trim(),
      building: building.trim(),
      street: street.trim(),
      landmark: landmark.trim(),
      city: city.trim(),
      pinCode: pinCode.trim(),
      isDefault,
      lat,
      lng,
      placeId,
      gpsPlaceholder: `${lat.toFixed(5)}, ${lng.toFixed(5)}`
    };

    if (editingId) {
      updateAddress(editingId, payload);
      Alert.alert('Success', 'Address updated successfully.');
    } else {
      addAddress(payload);
      Alert.alert('Success', 'New address added successfully.');
    }

    resetForm();
  };

  const handleEdit = (addr: SavedAddress) => {
    setEditingId(addr.id);
    setLabel(addr.label);
    setName(addr.name);
    setBuilding(addr.building);
    setStreet(addr.street);
    setLandmark(addr.landmark || '');
    setCity(addr.city);
    setPinCode(addr.pinCode);
    setIsDefault(addr.isDefault);
    setLat(addr.lat);
    setLng(addr.lng);
    setPlaceId(addr.placeId || '');
    setSearchQuery(addr.street);
    setShowForm(true);
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
          }
        }
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F8FC', paddingTop: insets.top }}>
      {/* Header */}
      <View className="h-14 flex-row items-center px-6 border-b border-[#E5E7EB] bg-white justify-between">
        <TouchableOpacity onPress={() => router.back()} className="w-8 h-8 items-center justify-center">
          <Ionicons name="arrow-back" size={20} color="#101828" />
        </TouchableOpacity>
        <Text className="text-[#101828] text-sm font-black uppercase tracking-wider">
          Saved Addresses
        </Text>
        <TouchableOpacity onPress={() => { if (showForm) { resetForm(); } else { setShowForm(true); } }}>
          <Text className="text-indigo-600 text-xs font-black uppercase">
            {showForm ? 'Cancel' : 'Add New'}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} className="p-6" contentContainerStyle={{ paddingBottom: 60 }}>
          <View className="gap-6">
            
            <View>
              <Text className="text-zinc-900 text-2xl font-black tracking-tight leading-tight">Addresses</Text>
              <Text className="text-zinc-500 text-xs font-semibold mt-1 leading-relaxed">
                Add, edit, or set default delivery addresses for fitness sessions at home or work.
              </Text>
            </View>

            {showForm ? (
              /* Add/Edit Form Panel */
              <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4">
                <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider border-b border-zinc-50 pb-2">
                  {editingId ? 'Modify Address Details' : 'New Address Details'}
                </Text>

                {/* Label Category Selection */}
                <View className="gap-2">
                  <Text className="text-zinc-500 text-[8px] font-black uppercase">Address Label</Text>
                  <View className="flex-row gap-2">
                    {(['Home', 'Office', 'Gym', 'Custom'] as const).map((l) => (
                      <TouchableOpacity
                        key={l}
                        onPress={() => setLabel(l)}
                        className={`px-3.5 py-2 rounded-xl border ${
                          label === l ? 'bg-zinc-950 border-zinc-950' : 'bg-[#F7F8FC] border-zinc-200'
                        }`}
                      >
                        <Text className={`text-[8px] font-black uppercase ${
                          label === l ? 'text-white' : 'text-zinc-650'
                        }`}>{l}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View className="gap-1">
                  <Text className="text-zinc-500 text-[8px] font-black uppercase">Location Nickname</Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="e.g. My Residence, Worli HQ"
                    className="border border-[#E5E7EB] bg-[#F7F8FC] p-3.5 rounded-xl text-xs font-semibold"
                  />
                </View>

                <View className="gap-1">
                  <Text className="text-zinc-500 text-[8px] font-black uppercase">Flat / Building name</Text>
                  <TextInput
                    value={building}
                    onChangeText={setBuilding}
                    placeholder="Flat 12A, Sea Tower"
                    className="border border-[#E5E7EB] bg-[#F7F8FC] p-3.5 rounded-xl text-xs font-semibold"
                  />
                </View>

                {/* Search Address / Autocomplete */}
                <View className="gap-1.5 bg-indigo-50/30 border border-indigo-150/40 p-3 rounded-2xl">
                  <Text className="text-zinc-500 text-[8px] font-black uppercase">Resolve Workout Address</Text>
                  
                  <TouchableOpacity
                    onPress={handleUseCurrentLocation}
                    disabled={isSearching}
                    className="bg-indigo-50 border border-indigo-200/50 py-2.5 rounded-xl flex-row justify-center items-center gap-2"
                  >
                    <Feather name="navigation" size={12} color="#4F46E5" />
                    <Text className="text-indigo-600 text-[9px] font-black uppercase tracking-wider">Use Current Location</Text>
                  </TouchableOpacity>

                  <TextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search address..."
                    className="border border-[#E5E7EB] bg-white p-3 rounded-xl text-xs font-semibold text-zinc-900"
                  />

                  {suggestions.length > 0 && (
                    <View className="bg-white border border-zinc-200 rounded-xl overflow-hidden mt-1 py-1 max-h-40">
                      {suggestions.map((item, idx) => (
                        <TouchableOpacity
                          key={idx}
                          onPress={() => handleSelectSuggestion(item)}
                          className="p-3 border-b border-zinc-100 flex-row items-center gap-2"
                        >
                          <Feather name="map-pin" size={10} color="#6B7280" />
                          <Text className="text-zinc-700 text-[10px] font-bold flex-1" numberOfLines={2}>
                            {item.description}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {lat !== undefined && lng !== undefined && (
                    <View className="flex-row items-center gap-1.5 mt-1">
                      <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                      <Text className="text-[#10B981] text-[9px] font-black uppercase">Location selected</Text>
                    </View>
                  )}
                </View>

                <View className="gap-1">
                  <Text className="text-zinc-500 text-[8px] font-black uppercase">Street / Locality</Text>
                  <TextInput
                    value={street}
                    onChangeText={setStreet}
                    placeholder="e.g. Worli Sea Face road"
                    className="border border-[#E5E7EB] bg-[#F7F8FC] p-3.5 rounded-xl text-xs font-semibold"
                  />
                </View>

                <View className="gap-1">
                  <Text className="text-zinc-500 text-[8px] font-black uppercase">Landmark (Optional)</Text>
                  <TextInput
                    value={landmark}
                    onChangeText={setLandmark}
                    placeholder="e.g. Opposite Trident Hotel"
                    className="border border-[#E5E7EB] bg-[#F7F8FC] p-3.5 rounded-xl text-xs font-semibold"
                  />
                </View>

                <View className="flex-row gap-3">
                  <View className="flex-1 gap-1">
                    <Text className="text-zinc-500 text-[8px] font-black uppercase">City</Text>
                    <TextInput
                      value={city}
                      onChangeText={setCity}
                      placeholder="Mumbai"
                      className="border border-[#E5E7EB] bg-[#F7F8FC] p-3.5 rounded-xl text-xs font-semibold"
                    />
                  </View>
                  <View className="flex-1 gap-1">
                    <Text className="text-zinc-500 text-[8px] font-black uppercase">PIN Code</Text>
                    <TextInput
                      value={pinCode}
                      onChangeText={setPinCode}
                      placeholder="400030"
                      keyboardType="numeric"
                      maxLength={6}
                      className="border border-[#E5E7EB] bg-[#F7F8FC] p-3.5 rounded-xl text-xs font-semibold"
                    />
                  </View>
                </View>

                <View className="flex-row justify-between items-center py-2">
                  <Text className="text-zinc-950 text-xs font-black uppercase">Set Default Address</Text>
                  <Switch value={isDefault} onValueChange={setIsDefault} />
                </View>

                <TouchableOpacity
                  onPress={handleSave}
                  className="w-full bg-[#101828] py-4 rounded-2xl items-center justify-center mt-2 shadow-xs"
                >
                  <Text className="text-white text-xs font-black uppercase">
                    {editingId ? 'Update Address' : 'Save Address'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* Address List View */
              <View className="gap-4">
                {addresses.map((addr) => (
                  <View
                    key={addr.id}
                    className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-3.5"
                  >
                    <View className="flex-row justify-between items-start">
                      <View className="gap-0.5 flex-1 pr-3">
                        <Text className="text-zinc-950 text-sm font-black">{addr.name}</Text>
                        <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5">{addr.label}</Text>
                      </View>
                      {addr.isDefault && (
                        <View className="bg-emerald-50 border border-emerald-150 px-2 py-0.5 rounded-full">
                          <Text className="text-emerald-600 text-[7px] font-black uppercase">Default</Text>
                        </View>
                      )}
                    </View>

                    <View className="gap-1 pl-1">
                      <Text className="text-zinc-650 text-xs font-semibold leading-relaxed">
                        {addr.building}, {addr.street}
                      </Text>
                      {addr.landmark ? <Text className="text-zinc-450 text-[10px] font-medium italic">Landmark: {addr.landmark}</Text> : null}
                      <Text className="text-zinc-500 text-[10px] font-semibold">
                        {addr.city} - {addr.pinCode}
                      </Text>
                    </View>

                    <View className="h-[1px] bg-zinc-50" />

                    <View className="flex-row gap-3">
                      <TouchableOpacity
                        onPress={() => handleEdit(addr)}
                        className="flex-1 bg-zinc-50 border border-zinc-100 py-2.5 rounded-xl items-center flex-row justify-center gap-1.5"
                      >
                        <Feather name="edit" size={11} color="#101828" />
                        <Text className="text-zinc-950 text-[8px] font-black uppercase">Edit</Text>
                      </TouchableOpacity>

                      {!addr.isDefault && (
                        <TouchableOpacity
                          onPress={() => setDefaultAddress(addr.id)}
                          className="flex-1 bg-zinc-50 border border-zinc-100 py-2.5 rounded-xl items-center flex-row justify-center gap-1.5"
                        >
                          <Feather name="check" size={11} color="#4F46E5" />
                          <Text className="text-[#4F46E5] text-[8px] font-black uppercase">Make Default</Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        onPress={() => handleDelete(addr.id)}
                        className="w-10 bg-rose-50 border border-rose-100 py-2.5 rounded-xl items-center justify-center"
                      >
                        <Feather name="trash-2" size={12} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
