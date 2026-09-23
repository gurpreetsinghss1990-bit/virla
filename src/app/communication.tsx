import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Image, Alert, Animated, KeyboardAvoidingView, Platform, Keyboard, Modal, Share, Linking, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useBookingStore } from '../store/bookingStore';
import { useNotificationStore } from '../store/notificationStore';
import { useWalletStore } from '../store/walletStore';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { ScreenHeader, ConfirmationDialog } from '../components';

import { Database } from '../database/Database';
import { useUserStore } from '../store/userStore';
import { useChatStore } from '../store/chatStore';
import { supabase } from '../database/supabaseClient';
import { getBookingISTDateRange, getDisplayWorkoutTitle } from '../utils/date';

interface ChatMessage {
  id: string;
  sender: 'customer' | 'trainer';
  text: string;
  timestamp: string;
  pending?: boolean;
}

export default function CommunicationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const bookingId = params.id as string;

  const { bookings, cancelSession } = useBookingStore();
  const { addNotification } = useNotificationStore();
  const { refundCredit } = useWalletStore();
  const { markAsRead } = useChatStore();

  const booking = bookings.find((b) => b.id === bookingId) || bookings[0];

  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      const h = e.endCoordinates ? e.endCoordinates.height : 0;
      setKeyboardHeight(h);
      setIsKeyboardVisible(true);
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
      setIsKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const getSessionStartDate = (): Date => {
    try {
      if (!booking) return new Date();
      return getBookingISTDateRange(booking).start;
    } catch (e) {
      console.log('Error parsing date:', e);
    }
    const fallback = new Date();
    fallback.setHours(fallback.getHours() + 2);
    return fallback;
  };

  const getMinutesToSession = () => {
    if (!booking) return 0;
    const sessionDate = getSessionStartDate();
    const now = new Date();
    return (sessionDate.getTime() - now.getTime()) / (1000 * 60);
  };

  const { user, role } = useUserStore();
  const [messageText, setMessageText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const isTrainer = role === 'trainer';

  // Normalize person key so that multiple sessions with the same coach/client share one unified thread
  const personKey = useMemo(() => {
    if (!booking) return '';
    if (isTrainer) {
      return (booking.clientId || booking.clientName || 'client')
        .toLowerCase()
        .replace(/^client\s+/i, '')
        .trim()
        .replace(/[^a-z0-9]/g, '_');
    }
    // For clients: resolve coach name or ID
    let raw = booking.trainerName;
    if (!raw && booking.trainerId) {
      const coach = Database.getCoaches().find((c) => c.id === booking.trainerId);
      if (coach?.name) raw = coach.name;
    }
    return (raw || booking.trainerId || 'coach')
      .toLowerCase()
      .replace(/^coach\s+/i, '')
      .trim()
      .replace(/[^a-z0-9]/g, '_');
  }, [booking, isTrainer]);

  const unifiedChatId = useMemo(() => {
    if (!personKey) return booking?.id || 'general';
    return isTrainer ? `chat-client-${personKey}` : `chat-coach-${personKey}`;
  }, [personKey, isTrainer, booking?.id]);

  // All session IDs associated with this same coach/person
  const relatedChatIds = useMemo(() => {
    const ids: string[] = [unifiedChatId];
    if (booking?.id) ids.push(booking.id);

    bookings.forEach((b) => {
      let bKey = '';
      if (isTrainer) {
        bKey = (b.clientId || b.clientName || 'client')
          .toLowerCase()
          .replace(/^client\s+/i, '')
          .trim()
          .replace(/[^a-z0-9]/g, '_');
      } else {
        let raw = b.trainerName;
        if (!raw && b.trainerId) {
          const coach = Database.getCoaches().find((c) => c.id === b.trainerId);
          if (coach?.name) raw = coach.name;
        }
        bKey = (raw || b.trainerId || 'coach')
          .toLowerCase()
          .replace(/^coach\s+/i, '')
          .trim()
          .replace(/[^a-z0-9]/g, '_');
      }

      if (bKey === personKey) {
        ids.push(b.id);
      }
    });

    return Array.from(new Set(ids));
  }, [bookings, booking, personKey, unifiedChatId, isTrainer]);

  useEffect(() => {
    if (!booking) return;
    
    const loadAndFilterMessages = () => {
      // Unified query merges all messages for this coach/person across all sessions
      const dbMsgs = Database.getUnifiedChatMessages(relatedChatIds);
      const isMoreThan60Mins = getMinutesToSession() > 60;
      const now = Date.now();
      
      const filtered = dbMsgs.map((msg) => {
        let localSender: 'customer' | 'trainer' = 'customer';
        if (msg.sender === 'trainer' || msg.sender === 'coach') {
          localSender = 'trainer';
        }
        
        return {
          id: msg.id,
          sender: localSender,
          text: msg.text,
          timestamp: msg.timestamp,
        };
      });
      
      setMessages(filtered);

      // Mark messages as read for this session and thread
      if (filtered.length > 0) {
        const keysToMark = Array.from(new Set([bookingId, booking?.id, unifiedChatId, ...relatedChatIds].filter(Boolean) as string[]));
        markAsRead(keysToMark, filtered.map((m) => m.id));
      }
    };

    loadAndFilterMessages();
    const interval = setInterval(loadAndFilterMessages, 1000);
    return () => clearInterval(interval);
  }, [booking, role, relatedChatIds, bookingId, unifiedChatId, markAsRead]);

  useEffect(() => {
    // Immediate mark as read on entering the screen
    if (bookingId || booking?.id) {
      const keysToMark = Array.from(new Set([bookingId, booking?.id, unifiedChatId, ...relatedChatIds].filter(Boolean) as string[]));
      markAsRead(keysToMark);
    }
  }, [bookingId, booking?.id, unifiedChatId, relatedChatIds, markAsRead]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages, isTyping]);

  if (!booking) {
    return (
      <View style={{ flex: 1, backgroundColor: 'white', paddingTop: insets.top }} className="justify-center items-center">
        <Text className="text-zinc-400 font-semibold">No booking details found.</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4 bg-zinc-900 px-6 py-2 rounded-full">
          <Text className="text-white font-bold text-xs">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleSendMessage = () => {
    if (!messageText.trim() || !booking) return;

    const sender = role === 'trainer' ? 'trainer' : 'customer';
    // Persist to unified chat ID so sessions with the same coach share a single continuous thread
    Database.sendChatMessage(unifiedChatId, messageText.trim(), sender);

    setMessageText('');
  };

  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isLocationConfirmVisible, setIsLocationConfirmVisible] = useState(false);
  const [isCancelConfirmVisible, setIsCancelConfirmVisible] = useState(false);
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const isCallLocked = getMinutesToSession() > 60;

  const handleCall = async () => {
    setIsMenuVisible(false);
    if (getMinutesToSession() > 60) {
      Alert.alert('Secure Line Locked', 'Voice calling unlocks 60 minutes before session start.');
      return;
    }
    // ponytail: real number only, no hardcoded dummy. Trainer dials the real client number.
    const dialNumber = isTrainer ? booking.clientPhone : undefined;
    if (!dialNumber) {
      Alert.alert('Contact Unavailable', 'Phone number is not available for this booking.');
      return;
    }
    try {
      await Linking.openURL(`tel:${dialNumber}`);
    } catch {
      Alert.alert('Call Failed', 'Could not open the dialer.');
    }
  };

  const handleShareRoute = () => {
    setIsMenuVisible(false);
    if (!booking) return;

    // Open custom stylish confirmation modal smoothly after menu closes
    setTimeout(() => {
      setIsLocationConfirmVisible(true);
    }, 200);
  };

  const confirmShareLocation = async () => {
    if (!booking) return;
    const sender = role === 'trainer' ? 'trainer' : 'customer';
    setIsSharingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setIsSharingLocation(false);
        setIsLocationConfirmVisible(false);
        Alert.alert('Permission Required', 'Location permission is required to share your live location.');
        return;
      }

      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = pos.coords;

      let placeName = '';
      try {
        const geocoded = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (geocoded && geocoded.length > 0) {
          const g = geocoded[0];
          const parts = [g.name, g.street, g.subregion || g.district, g.city].filter(Boolean);
          if (parts.length > 0) {
            placeName = parts.join(', ');
          }
        }
      } catch (geoErr) {
        // reverse geocode is optional
      }

      const mapsUrl = `https://maps.google.com/?q=${latitude},${longitude}`;
      const locationMsg = `📍 Live Location:\n${placeName ? `Near: ${placeName}\n` : ''}Coordinates: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}\n${mapsUrl}`;

      Database.sendChatMessage(unifiedChatId, locationMsg, sender);
    } catch (err) {
      // Graceful fallback to booking address
      const addressStr = booking.address || 'Client Scheduled Address';
      const routeMsg = `📍 Location Details:\n${booking.workoutTitle || 'Training Session'}\nDestination: ${addressStr}`;
      Database.sendChatMessage(unifiedChatId, routeMsg, sender);
    } finally {
      setIsSharingLocation(false);
      setIsLocationConfirmVisible(false);
    }
  };

  // Enforce late cancellation business rules
  const handleCancelBooking = () => {
    setIsMenuVisible(false);
    if (!booking || booking.status !== 'upcoming') {
      Alert.alert('Notice', 'This session is already cancelled or completed.');
      return;
    }

    setTimeout(() => {
      setIsCancelConfirmVisible(true);
    }, 200);
  };

  const coachDisplayName = useMemo(() => {
    if (role === 'trainer') {
      return booking ? `Client ${'VIRLA-C' + booking.id.slice(-6).toUpperCase()}` : 'Client';
    }
    const name = booking?.trainerName || '';
    if (!name || name.toLowerCase().includes('no trainer') || name.toLowerCase().includes('admin') || booking?.trainerId === 'searching') {
      return 'VIRLA Concierge Line';
    }
    return name.toLowerCase().startsWith('coach') ? name : `Coach ${name}`;
  }, [role, booking]);

  const coachAvatar = useMemo(() => {
    if (role === 'trainer') {
      return 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80';
    }
    const name = booking?.trainerName || '';
    if (!name || name.toLowerCase().includes('no trainer') || name.toLowerCase().includes('admin')) {
      return 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80';
    }
    return booking?.trainerPhoto || 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?auto=format&fit=crop&w=200&q=80';
  }, [role, booking]);

  // ponytail: "Live" only when session is actually live (upcoming + inside 60-min window). No fake presence.
  const isLive = booking.status === 'upcoming' && !isCallLocked;
  const coachSubtitle = useMemo(() => {
    if (role === 'trainer') {
      return isLive ? 'Solo Session • Live' : 'Solo Session • Upcoming';
    }
    const name = booking?.trainerName || '';
    if (!name || name.toLowerCase().includes('no trainer') || name.toLowerCase().includes('admin')) {
      return 'Priority Concierge & Safety';
    }
    if (!isLive) {
      return [booking?.date, booking?.time].filter(Boolean).join(' • ') || 'Upcoming Session';
    }
    return `${getDisplayWorkoutTitle(booking?.workoutTitle || '') || 'Session'} • Live`;
  }, [role, booking, isLive]);

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: '#FAF9F5', paddingBottom: Platform.OS === 'android' ? keyboardHeight + (keyboardHeight > 0 ? 8 : 0) : 0 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Claude-style Minimalist Header */}
      <View 
        style={{ paddingTop: Math.max(insets.top, 12) }} 
        className="bg-[#FAF9F5] border-b border-[#ECE7DE] px-4 pb-3"
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3 flex-1">
            <TouchableOpacity 
              onPress={() => router.back()} 
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              className="w-9 h-9 items-center justify-center"
            >
              <Feather name="arrow-left" size={18} color="#1F1E1D" />
            </TouchableOpacity>

            {/* Avatar & Title (no presence dot — Live is text-gated, not faked) */}
            <View className="flex-row items-center gap-2.5 flex-1">
              <Image
                source={{ uri: coachAvatar }}
                style={{ width: 38, height: 38, borderRadius: 19 }}
                className="bg-[#EFECE6] border border-[#E5E0D8]"
              />

              <View className="flex-1">
                <Text numberOfLines={1} className="text-[#1F1E1D] text-base font-bold tracking-tight">
                  {coachDisplayName}
                </Text>
                <Text numberOfLines={1} className="text-[#716F6A] text-[11px] font-medium mt-0.5">
                  {coachSubtitle}
                </Text>
              </View>
            </View>
          </View>

          {/* Header overflow menu (SOS removed — Call / Share / Cancel live here) */}
          <TouchableOpacity
            onPress={() => setIsMenuVisible(true)}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            className="w-9 h-9 rounded-full bg-[#F2EFE8] items-center justify-center active:bg-[#E8E4DC]"
          >
            <Feather name="more-vertical" size={17} color="#1F1E1D" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Claude Artifact-Style Session Context Card (display only — actions live in the header ⋮ menu) */}
      <View className="px-4 pt-2.5 pb-1">
        <View className="bg-white border border-[#E8E4DC] rounded-2xl p-3 shadow-xs">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2 flex-1 pr-2">
              <View className="w-7 h-7 rounded-lg bg-[#FAF5EE] items-center justify-center border border-[#EEDCC7]">
                <Feather name="activity" size={13} color="#CC785C" />
              </View>
              <View className="flex-1">
                <Text numberOfLines={1} className="text-[#1F1E1D] text-xs font-bold">
                  {getDisplayWorkoutTitle(booking.workoutTitle) || 'Personal Training Session'}
                </Text>
                <Text numberOfLines={1} className="text-[#716F6A] text-[10.5px]">
                  {booking.date ? `${booking.date} • ${booking.time || 'Upcoming'}` : (booking.time || 'Upcoming Session')}
                </Text>
              </View>
            </View>

            <View className="px-2 py-0.5 rounded-md bg-[#F4F1EA] border border-[#E8E4DC]">
              <Text className="text-[#5C5954] text-xs font-bold uppercase tracking-wider">
                {booking.sessionType === 'COUPLE' ? 'Couple' : 'Solo'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Chat Messages List - Claude Editorial Typography Stream */}
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        className="flex-1 px-4 pt-1"
        contentContainerStyle={{ paddingBottom: 16 }}
      >
        {/* Claude Security Pill */}
        <View className="self-center flex-row items-center gap-1.5 bg-[#F0ECE1] border border-[#E5E0D4] px-3 py-1 rounded-full my-2">
          <Feather name="lock" size={10} color="#716F6A" />
          <Text className="text-[#5C5954] text-xs font-medium">Private Line • Monitored for safety</Text>
        </View>

        {/* Conversation Stream */}
        <View className="gap-3.5 mt-1">
          {messages.map((msg) => {
            const isMe = (role === 'customer' && msg.sender === 'customer') ||
                         (role === 'trainer' && msg.sender === 'trainer');
            
            let timeDisplay = msg.timestamp || '';
            try {
              const d = new Date(msg.timestamp);
              if (!isNaN(d.getTime())) {
                timeDisplay = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              }
            } catch (e) {}

            return (
              <View
                key={msg.id}
                className={`max-w-[82%] ${isMe ? 'self-end' : 'self-start'}`}
              >
                <View
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 22,
                    ...(isMe ? { borderBottomRightRadius: 6 } : { borderBottomLeftRadius: 6 }),
                  }}
                  className={`${
                    isMe 
                      ? 'bg-[#232220] shadow-xs' 
                      : 'bg-white border border-[#E5E0D5] shadow-xs'
                  }`}
                >
                  {msg.text.includes('📍') ? (
                    <View className="gap-2">
                      <View className="flex-row items-center gap-1.5 pb-1 border-b border-[#E5E0D5]/40">
                        <Feather name="navigation" size={13} color={isMe ? '#FAF9F5' : '#CC785C'} />
                        <Text className={`text-xs font-bold tracking-tight ${isMe ? 'text-[#FAF9F5]' : 'text-[#1F1E1D]'}`}>
                          Live Location
                        </Text>
                      </View>
                      <Text className={`text-[13.5px] leading-relaxed ${isMe ? 'text-[#FAF9F5]/90' : 'text-[#3D3A35]'}`}>
                        {msg.text
                          .replace(/^📍\s*(Shared Route & Location Coordinates|Live Location|Location Details):\n?/, '')
                          .replace(/https?:\/\/maps\.google\.com\S+/, '')
                          .trim()}
                      </Text>
                      {msg.text.includes('maps.google.com') && (
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => {
                            const match = msg.text.match(/https?:\/\/maps\.google\.com\S+/);
                            if (match) {
                              Linking.openURL(match[0]);
                            }
                          }}
                          className={`mt-1 flex-row items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl ${
                            isMe ? 'bg-[#3A3834]' : 'bg-[#F3EFE7] border border-[#E5E0D5]'
                          }`}
                        >
                          <Feather name="map-pin" size={12} color={isMe ? '#FAF9F5' : '#CC785C'} />
                          <Text className={`text-xs font-semibold ${isMe ? 'text-[#FAF9F5]' : 'text-[#CC785C]'}`}>
                            Open in Google Maps
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : (
                    <Text className={`text-[14.5px] leading-relaxed ${isMe ? 'text-[#FAF9F5] font-normal' : 'text-[#1F1E1D] font-normal'}`}>
                      {msg.text}
                    </Text>
                  )}

                  <View className="flex-row items-center gap-1 mt-1 justify-end self-end">
                    <Text className={`text-[10px] ${isMe ? 'text-[#A6A29A]' : 'text-[#8C8983]'}`}>
                      {timeDisplay}
                    </Text>
                    {isMe && (
                      <Feather name="check" size={11} color="#A6A29A" />
                    )}
                  </View>
                </View>
              </View>
            );
          })}

          {/* Typing Indicator */}
          {isTyping && (
            <View className="bg-white border border-[#E8E4DC] p-3 rounded-2xl rounded-bl-xs self-start flex-row gap-1.5 items-center">
              <View className="w-2 h-2 rounded-full bg-[#8C8983]" />
              <View className="w-2 h-2 rounded-full bg-[#8C8983]" />
              <View className="w-2 h-2 rounded-full bg-[#8C8983]" />
            </View>
          )}
        </View>
      </ScrollView>

      {/* Claude Quick Suggestion Chips */}
      <View className="py-1.5 px-4">
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ gap: 8 }}
        >
          {[
            "I've arrived at the gate.",
            "I'm running 5 minutes late.",
            "Please ring the doorbell.",
            "Ready for workout!",
            "Do you need special equipment?"
          ].map((msgText, idx) => (
            <TouchableOpacity
              key={idx}
              activeOpacity={0.7}
              onPress={() => {
                if (!booking) return;
                const sender = role === 'trainer' ? 'trainer' : 'customer';
                Database.sendChatMessage(unifiedChatId, msgText, sender);
              }}
              className="bg-[#F3EFE7] border border-[#E5E0D5] px-3.5 py-1.5 rounded-full active:bg-[#EAE4D7]"
            >
              <Text className="text-[#3D3A35] text-xs font-semibold">{msgText}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Claude's Iconic Floating Prompt Input Box */}
      {/* ponytail: keyboard offset lives on outer KAV (whole screen lifts).
          Inner keeps only safe-area — padding inner alone just shrinks ScrollView
          and leaves bottom edge behind keyboard on edge-to-edge Android. */}
      <View 
        style={{ 
          paddingBottom: Platform.OS === 'android'
            ? Math.max(insets.bottom, 12)
            : (isKeyboardVisible ? 8 : Math.max(insets.bottom, 12)),
          paddingTop: 6,
          backgroundColor: '#FAF9F5',
        }}
        className="px-4 border-t border-[#ECE7DE]/80"
      >
        <View className="bg-white border border-[#E2DDD5] rounded-[24px] pl-4 pr-1.5 py-1.5 flex-row items-end gap-2 shadow-xs">
          {/* Text Input */}
          <TextInput
            value={messageText}
            onChangeText={setMessageText}
            placeholder={role === 'trainer' ? "Message client securely..." : `Message ${coachDisplayName}...`}
            placeholderTextColor="#9E9B93"
            multiline
            className="flex-1 text-[#1F1E1D] text-[15px] leading-relaxed max-h-28 py-1.5"
            style={{ minHeight: 36, textAlignVertical: 'center' }}
          />

          {/* Claude-style Terracotta Circular Send Button */}
          <TouchableOpacity
            onPress={handleSendMessage}
            disabled={!messageText.trim()}
            activeOpacity={0.8}
            className={`w-9 h-9 rounded-full items-center justify-center mb-0.5 transition-all ${
              messageText.trim() 
                ? 'bg-[#CC785C] active:bg-[#B6664C] shadow-xs' 
                : 'bg-[#EDE9E1]'
            }`}
          >
            <Feather 
              name="arrow-up" 
              size={18} 
              color={messageText.trim() ? '#FFFFFF' : '#9E9B93'} 
            />
            </TouchableOpacity>
          </View>
        </View>

      {/* Overflow menu — Centered on Screen */}
      <Modal visible={isMenuVisible} transparent animationType="fade" onRequestClose={() => setIsMenuVisible(false)}>
        <TouchableOpacity 
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }} 
          activeOpacity={1} 
          onPress={() => setIsMenuVisible(false)}
        >
          <TouchableOpacity 
            activeOpacity={1} 
            className="w-full max-w-[340px] bg-white rounded-3xl border border-[#E8E4DC] p-3 shadow-xl"
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header / Title */}
            <View className="px-3 pt-2 pb-2.5 flex-row items-center justify-between border-b border-[#F0ECE1]">
              <Text className="text-[#1F1E1D] text-sm font-bold tracking-tight">Session Actions</Text>
              <TouchableOpacity 
                onPress={() => setIsMenuVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                className="w-6 h-6 rounded-full bg-[#F5F2EC] items-center justify-center"
              >
                <Feather name="x" size={13} color="#716F6A" />
              </TouchableOpacity>
            </View>

            <View className="py-1">
              <TouchableOpacity 
                onPress={handleCall} 
                activeOpacity={0.7} 
                className="flex-row items-center gap-3 px-3 py-3.5 rounded-2xl active:bg-[#F5F2EC]"
              >
                <View className="w-8 h-8 rounded-xl bg-[#FAF9F5] border border-[#E8E4DC] items-center justify-center">
                  <Feather name="phone" size={15} color={isCallLocked ? '#9E9B93' : '#1F1E1D'} />
                </View>
                <View className="flex-1">
                  <Text className="text-[#1F1E1D] text-sm font-semibold">
                    Voice Call{isCallLocked ? ' (locked)' : ''}
                  </Text>
                  <Text className="text-[#716F6A] text-[11px]">
                    {isCallLocked ? 'Unlocks 60m before session' : 'Encrypted line with coach'}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={handleShareRoute} 
                activeOpacity={0.7} 
                className="flex-row items-center gap-3 px-3 py-3.5 rounded-2xl active:bg-[#F5F2EC]"
              >
                <View className="w-8 h-8 rounded-xl bg-[#FAF9F5] border border-[#E8E4DC] items-center justify-center">
                  <Feather name="navigation" size={15} color="#1F1E1D" />
                </View>
                <View className="flex-1">
                  <Text className="text-[#1F1E1D] text-sm font-semibold">Share Live Location</Text>
                  <Text className="text-[#716F6A] text-[11px]">Send real-time GPS location in this chat</Text>
                </View>
              </TouchableOpacity>

              <View className="h-px bg-[#F0ECE1] mx-2 my-1" />

              <TouchableOpacity 
                onPress={() => { setIsMenuVisible(false); handleCancelBooking(); }} 
                disabled={booking.status !== 'upcoming'} 
                activeOpacity={0.7} 
                className="flex-row items-center gap-3 px-3 py-3.5 rounded-2xl active:bg-rose-50"
              >
                <View className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-200/80 items-center justify-center">
                  <Feather name="x-circle" size={15} color={booking.status === 'upcoming' ? '#E11D48' : '#9E9B93'} />
                </View>
                <View className="flex-1">
                  <Text className={`text-sm font-semibold ${booking.status === 'upcoming' ? 'text-rose-700' : 'text-[#9E9B93]'}`}>
                    Cancel Booking
                  </Text>
                  <Text className="text-[#716F6A] text-[11px]">
                    {booking.status === 'upcoming' ? 'Refund or forfeit policy apply' : 'Session cannot be cancelled'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Lean v1 Confirmation Dialog: Live Location */}
      <ConfirmationDialog
        visible={isLocationConfirmVisible}
        title="Share Live Location?"
        message="Your real-time GPS coordinates and a map link will be shared directly in this chat so your coach can locate you instantly."
        confirmText="Share Location"
        cancelText="Cancel"
        iconName="navigation"
        isDestructive={false}
        isLoading={isSharingLocation}
        loadingText="Locating..."
        onConfirm={confirmShareLocation}
        onCancel={() => {
          if (!isSharingLocation) setIsLocationConfirmVisible(false);
        }}
      />

      {/* Lean v1 Confirmation Dialog: Destructive Cancel Booking */}
      <ConfirmationDialog
        visible={isCancelConfirmVisible}
        title="Cancel Booking?"
        message={
          booking?.timelineStatus === 'trainer_travelling' || booking?.timelineStatus === 'trainer_arrived'
            ? 'Your trainer is already travelling. Cancelling now forfeits 1 credit as travel compensation for the coach.'
            : 'Are you sure you want to cancel this session? Your credit will be fully refunded to your wallet.'
        }
        confirmText="Cancel Booking"
        cancelText="Keep Session"
        iconName="alert-triangle"
        isDestructive={true}
        onConfirm={async () => {
          setIsCancelConfirmVisible(false);
          try {
            await cancelSession(booking.id);
            Alert.alert('Booking Cancelled', 'Session has been successfully cancelled.');
            router.back();
          } catch (err: any) {
            Alert.alert('Notice', err?.message || 'Could not cancel this session.');
          }
        }}
        onCancel={() => setIsCancelConfirmVisible(false)}
      />
    </KeyboardAvoidingView>
  );
}
