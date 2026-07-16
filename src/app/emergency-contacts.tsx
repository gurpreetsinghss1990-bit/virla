import React, { useState } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, ScrollView, TextInput, Alert, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useUserProfileStore, EmergencyContact } from '../store/userProfileStore';
import { Ionicons, Feather } from '@expo/vector-icons';

export default function EmergencyContactsScreen() {
  const router = useRouter();
  const { emergencyContacts, addEmergencyContact, updateEmergencyContact, deleteEmergencyContact, setPrimaryEmergencyContact } = useUserProfileStore();

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [phone, setPhone] = useState('');
  const [altPhone, setAltPhone] = useState('');
  const [medicalNotes, setMedicalNotes] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);

  const resetForm = () => {
    setName('');
    setRelationship('');
    setPhone('');
    setAltPhone('');
    setMedicalNotes('');
    setIsPrimary(false);
    setIsAdding(false);
    setEditingId(null);
  };

  const handleAdd = () => {
    if (!name.trim() || !phone.trim() || !relationship.trim()) {
      Alert.alert('Incomplete Fields', 'Please fill in Name, Relationship, and Phone Number.');
      return;
    }
    if (editingId) {
      updateEmergencyContact(editingId, {
        name: name.trim(),
        relationship: relationship.trim(),
        phone: phone.trim(),
        altPhone: altPhone.trim(),
        medicalNotes: medicalNotes.trim(),
        isPrimary
      });
      Alert.alert('Contact Updated', 'Emergency contact has been updated.');
    } else {
      addEmergencyContact({
        name: name.trim(),
        relationship: relationship.trim(),
        phone: phone.trim(),
        altPhone: altPhone.trim(),
        medicalNotes: medicalNotes.trim(),
        isPrimary
      });
      Alert.alert('Contact Added', 'New emergency contact saved successfully.');
    }
    resetForm();
  };

  const handleEdit = (contact: EmergencyContact) => {
    setName(contact.name);
    setRelationship(contact.relationship);
    setPhone(contact.phone);
    setAltPhone(contact.altPhone || '');
    setMedicalNotes(contact.medicalNotes || '');
    setIsPrimary(contact.isPrimary);
    setEditingId(contact.id);
    setIsAdding(true);
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      'Remove Contact',
      'Are you sure you want to delete this emergency contact?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteEmergencyContact(id) }
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FB]">
      {/* Header */}
      <View className="h-14 flex-row items-center px-6 border-b border-[#E5E7EB] bg-white justify-between">
        <TouchableOpacity onPress={() => router.back()} className="w-8 h-8 items-center justify-center">
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </TouchableOpacity>
        <Text className="text-[#111827] text-sm font-black uppercase tracking-wider">
          Emergency Contacts
        </Text>
        <TouchableOpacity onPress={() => { if (isAdding) { resetForm(); } else { setIsAdding(true); } }}>
          <Text className="text-indigo-600 text-xs font-black uppercase">
            {isAdding ? 'Cancel' : 'Add New'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 p-6" contentContainerStyle={{ paddingBottom: 60 }}>
        <View className="gap-6">
          
          <View>
            <Text className="text-zinc-900 text-2xl font-black tracking-tight leading-tight">Safety Network</Text>
            <Text className="text-zinc-500 text-xs font-semibold mt-1 leading-relaxed">
              These details are accessible to your coach during check-ins and emergency SOS triggers.
            </Text>
          </View>

          {isAdding ? (
            /* Form Panel */
            <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4">
              <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider border-b border-zinc-50 pb-2">
                {editingId ? 'Modify Contact details' : 'New Contact information'}
              </Text>
              
              <View className="gap-1">
                <Text className="text-zinc-500 text-[8px] font-black uppercase">Contact Name</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter full name"
                  className="border border-[#E5E7EB] bg-[#F8F9FB] p-3.5 rounded-xl text-xs font-semibold"
                />
              </View>

              <View className="gap-1">
                <Text className="text-zinc-500 text-[8px] font-black uppercase">Relationship</Text>
                <TextInput
                  value={relationship}
                  onChangeText={setRelationship}
                  placeholder="e.g. Spouse, Brother, Father"
                  className="border border-[#E5E7EB] bg-[#F8F9FB] p-3.5 rounded-xl text-xs font-semibold"
                />
              </View>

              <View className="gap-1">
                <Text className="text-zinc-500 text-[8px] font-black uppercase">Mobile Number</Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="e.g. +91 98200 11223"
                  keyboardType="phone-pad"
                  className="border border-[#E5E7EB] bg-[#F8F9FB] p-3.5 rounded-xl text-xs font-semibold"
                />
              </View>

              <View className="gap-1">
                <Text className="text-zinc-500 text-[8px] font-black uppercase">Alternate Phone (Optional)</Text>
                <TextInput
                  value={altPhone}
                  onChangeText={setAltPhone}
                  placeholder="e.g. +91 98200 44556"
                  keyboardType="phone-pad"
                  className="border border-[#E5E7EB] bg-[#F8F9FB] p-3.5 rounded-xl text-xs font-semibold"
                />
              </View>

              <View className="gap-1">
                <Text className="text-zinc-500 text-[8px] font-black uppercase">Important Medical Notes</Text>
                <TextInput
                  value={medicalNotes}
                  onChangeText={setMedicalNotes}
                  placeholder="e.g. Heart condition history, Asthma"
                  className="border border-[#E5E7EB] bg-[#F8F9FB] p-3.5 rounded-xl text-xs font-semibold"
                />
              </View>

              <View className="flex-row justify-between items-center py-2">
                <Text className="text-zinc-950 text-xs font-black uppercase">Primary Contact Toggle</Text>
                <Switch value={isPrimary} onValueChange={setIsPrimary} />
              </View>

              <TouchableOpacity
                onPress={handleAdd}
                className="w-full bg-[#4F46E5] py-4 rounded-2xl items-center justify-center mt-2 shadow-xs"
              >
                <Text className="text-white text-xs font-black uppercase">
                  {editingId ? 'Update Contact' : 'Save Emergency Contact'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Contacts List */
            <View className="gap-4">
              {emergencyContacts.map((contact) => (
                <View
                  key={contact.id}
                  className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-3.5"
                >
                  <View className="flex-row justify-between items-start">
                    <View className="gap-0.5 flex-1 pr-3">
                      <Text className="text-zinc-950 text-sm font-black">{contact.name}</Text>
                      <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5">{contact.relationship}</Text>
                    </View>
                    {contact.isPrimary && (
                      <View className="bg-indigo-50 border border-indigo-150 px-2 py-0.5 rounded-full">
                        <Text className="text-[#4F46E5] text-[7px] font-black uppercase">Primary SOS</Text>
                      </View>
                    )}
                  </View>

                  <View className="gap-1.5">
                    <Text className="text-zinc-600 text-xs font-semibold">📞 Mobile: {contact.phone}</Text>
                    {contact.altPhone && <Text className="text-zinc-600 text-xs font-semibold">📞 Alt Mobile: {contact.altPhone}</Text>}
                    {contact.medicalNotes && <Text className="text-zinc-500 text-[10px] italic">⚠️ Medical notes: {contact.medicalNotes}</Text>}
                  </View>

                  <View className="h-[1px] bg-zinc-50" />

                  <View className="flex-row gap-3">
                    <TouchableOpacity
                      onPress={() => handleEdit(contact)}
                      className="flex-1 bg-zinc-50 border border-zinc-100 py-2.5 rounded-xl items-center flex-row justify-center gap-1.5"
                    >
                      <Feather name="edit" size={11} color="#111827" />
                      <Text className="text-zinc-950 text-[8px] font-black uppercase">Edit</Text>
                    </TouchableOpacity>

                    {!contact.isPrimary && (
                      <TouchableOpacity
                        onPress={() => setPrimaryEmergencyContact(contact.id)}
                        className="flex-1 bg-zinc-50 border border-zinc-100 py-2.5 rounded-xl items-center flex-row justify-center gap-1.5"
                      >
                        <Feather name="shield" size={11} color="#4F46E5" />
                        <Text className="text-[#4F46E5] text-[8px] font-black uppercase">Set Primary</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      onPress={() => handleDelete(contact.id)}
                      className="w-10 bg-rose-50 border border-rose-100 py-2.5 rounded-xl items-center justify-center"
                    >
                      <Feather name="trash-2" size={12} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              {emergencyContacts.length === 0 && (
                <View className="bg-white border border-[#E5E7EB] p-8 rounded-[28px] items-center justify-center py-10 shadow-xs">
                  <Feather name="users" size={24} color="#9CA3AF" />
                  <Text className="text-zinc-500 text-xs font-black uppercase mt-2">No emergency contacts saved</Text>
                </View>
              )}
            </View>
          )}

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
