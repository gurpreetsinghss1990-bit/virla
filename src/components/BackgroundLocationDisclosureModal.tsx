import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Linking, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocationDisclosureStore } from '../store/locationDisclosureStore';

const PRIVACY_POLICY_URL = 'https://virla.in/privacy.html';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

const POINTS: { icon: FeatherName; label: string; body: string }[] = [
  {
    icon: 'navigation',
    label: 'When we collect it',
    body:
      'Only while you have an active travel to a client venue, starting after you tap "Start Travel" on a confirmed session.',
  },
  {
    icon: 'activity',
    label: 'Why we collect it',
    body:
      'To share your live route and estimated arrival time with that client during the travel window.',
  },
  {
    icon: 'clock',
    label: 'How long we keep tracking',
    body:
      'Tracking stops automatically when you tap "Reached Location" or start the session. It never runs outside an active travel window.',
  },
  {
    icon: 'shield-off',
    label: 'What we never do',
    body:
      'We never collect location for advertising, and never track you between sessions or after the travel ends.',
  },
];

export const BackgroundLocationDisclosureModal: React.FC = () => {
  const visible = useLocationDisclosureStore((s) => s.visible);
  const accept = useLocationDisclosureStore((s) => s.accept);
  const decline = useLocationDisclosureStore((s) => s.decline);
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={decline}
    >
      <View style={{ flex: 1 }} className="flex-1 bg-black/60 justify-end">
        <View
          className="bg-white rounded-t-[28px] px-5 pt-4"
          style={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}
        >
          <View className="items-center mb-3">
            <View className="w-10 h-1 rounded-full bg-zinc-200" />
          </View>

          <View className="flex-row items-center gap-3 mb-3">
            <View className="w-11 h-11 rounded-2xl bg-[#E11D48]/10 items-center justify-center">
              <Feather name="map-pin" size={20} color="#E11D48" />
            </View>
            <View className="flex-1">
              <Text className="text-[#101828] text-lg font-black tracking-tight leading-tight">
                Background Location Permission
              </Text>
              <Text className="text-[#E11D48] text-[10px] font-black uppercase tracking-widest mt-1">
                VIRLA · Trainer Travel
              </Text>
            </View>
          </View>

          <Text className="text-zinc-700 text-xs leading-relaxed">
            VIRLA collects your device&apos;s location data, including while the app is closed or
            not in use, only during an active travel to a client venue. Please review how we use it
            before continuing.
          </Text>

          <ScrollView
            style={{ maxHeight: 260 }}
            className="mt-3"
            showsVerticalScrollIndicator={false}
          >
            <View className="gap-2.5">
              {POINTS.map((p) => (
                <View
                  key={p.label}
                  className="flex-row gap-2.5 bg-zinc-50 border border-zinc-200/70 rounded-2xl p-3"
                >
                  <View className="w-7 h-7 rounded-xl bg-white border border-zinc-200 items-center justify-center">
                    <Feather name={p.icon} size={13} color="#E11D48" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-zinc-900 text-[11px] font-black uppercase tracking-wider">
                      {p.label}
                    </Text>
                    <Text className="text-zinc-600 text-[11px] leading-relaxed mt-0.5">{p.body}</Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => Linking.openURL(PRIVACY_POLICY_URL).catch(() => {})}
            className="flex-row items-center gap-1.5 mt-3 self-start"
          >
            <Feather name="external-link" size={12} color="#E11D48" />
            <Text className="text-[#E11D48] text-[11px] font-bold underline">
              Read our Privacy &amp; Location Policy
            </Text>
          </TouchableOpacity>

          <Text className="text-zinc-500 text-[10px] leading-relaxed mt-2">
            You can turn location access off at any time in your device Settings. Without
            &quot;Allow all the time&quot;, live arrival tracking will only work while VIRLA is open.
          </Text>

          <View className="gap-2 mt-4">
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={accept}
              className="bg-[#E11D48] py-3.5 rounded-2xl items-center justify-center flex-row gap-2"
            >
              <Feather name="check-circle" size={15} color="#FFFFFF" />
              <Text className="text-white text-xs font-black uppercase tracking-wider">
                Agree &amp; Continue
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={decline}
              className="bg-zinc-100 py-3 rounded-2xl items-center justify-center"
            >
              <Text className="text-zinc-700 text-xs font-bold">Not Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
