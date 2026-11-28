import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useUserProfileStore } from '../store/userProfileStore';
import { useWalletStore } from '../store/walletStore';
import { Feather } from '@expo/vector-icons';
import { ScreenHeader } from '../components/ScreenHeader';
import { CalculatedTargetsCard } from '../components/CalculatedTargetsCard';
import { softShadow } from '../utils/shadows';

const C = {
  canvas: '#FFF8F8',
  card: '#FFFFFF',
  hairline: '#E5E7EB',
  ink: '#1D1B1B',
  body: '#475569',
  muted: '#9CA3AF',
  crimson: '#B80035',
  crimsonSoft: '#FFF1F2',
  amber: '#F59E0B',
  emerald: '#059669',
};

const MONTHLY_LOG = [
  { m: 'Mar', c: 4 },
  { m: 'Apr', c: 6 },
  { m: 'May', c: 8 },
  { m: 'Jun', c: 12 },
  { m: 'Jul', c: 15 },
];

export default function PersonalStatisticsScreen() {
  const { creditBalance } = useWalletStore();
  const profile = useUserProfileStore();

  const stats = [
    { label: 'Total Workouts', val: String(profile.totalSessions), icon: 'activity', tone: C.crimson },
    { label: 'Completed Visits', val: String(profile.totalSessions - profile.cancelledSessions), icon: 'check-circle', tone: C.emerald },
    { label: 'Cancelled Visits', val: String(profile.cancelledSessions), icon: 'x-circle', tone: '#BA1A1A' },
    { label: 'Hours Trained', val: `${profile.hoursTrained}h`, icon: 'clock', tone: C.body },
    { label: 'Calories Burned', val: profile.totalCalories.toLocaleString(), icon: 'zap', tone: C.amber },
    { label: 'Lifetime Spend', val: profile.lifetimeSpend, icon: 'shopping-bag', tone: C.ink },
    { label: 'Wallet Balance', val: `${creditBalance}`, icon: 'credit-card', tone: C.crimson },
    { label: 'Current Streak', val: `${profile.currentStreak}`, icon: 'trending-up', tone: '#815100' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      <ScreenHeader title="Personal Statistics" category="VIRLA METRICS" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 96 }}
      >
        <View style={{ gap: 20 }}>
          <View>
            <Text style={{ fontFamily: 'Outfit_800Bold', fontSize: 26, lineHeight: 32, color: C.ink }}>
              Analytics Dashboard
            </Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, color: '#5C3F40', marginTop: 4 }}>
              Track your performance summaries, calories burned, and booking statistics.
            </Text>
          </View>

          <CalculatedTargetsCard />

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 }}>
            {stats.map((s) => (
              <View
                key={s.label}
                style={{
                  width: '48%',
                  backgroundColor: C.card,
                  borderRadius: 24,
                  borderWidth: 1,
                  borderColor: C.hairline,
                  paddingVertical: 16,
                  paddingHorizontal: 16,
                  ...softShadow({ color: '#101828', opacity: 0.04, radius: 16, offsetY: 6 }),
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <Text
                    numberOfLines={2}
                    style={{
                      flex: 1,
                      fontFamily: 'Inter_700Bold',
                      fontSize: 10,
                      lineHeight: 14,
                      letterSpacing: 0.8,
                      textTransform: 'uppercase',
                      color: C.muted,
                    }}
                  >
                    {s.label}
                  </Text>
                  <View
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 13,
                      backgroundColor: C.crimsonSoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Feather name={s.icon as any} size={13} color={C.crimson} />
                  </View>
                </View>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={{ fontFamily: 'Outfit_800Bold', fontSize: 20, lineHeight: 26, color: s.tone, marginTop: 10 }}
                >
                  {s.val}
                </Text>
              </View>
            ))}
          </View>

          <View
            style={{
              backgroundColor: C.card,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: C.hairline,
              padding: 20,
              gap: 16,
              ...softShadow({ color: '#101828', opacity: 0.04, radius: 16, offsetY: 6 }),
            }}
          >
            <Text
              style={{
                fontFamily: 'Inter_700Bold',
                fontSize: 10,
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                color: C.muted,
                paddingBottom: 12,
                borderBottomWidth: 1,
                borderBottomColor: '#F3ECEC',
              }}
            >
              Monthly Workouts Log
            </Text>

            <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 112, paddingTop: 12 }}>
              {MONTHLY_LOG.map((item) => {
                const barHeight = Math.max(10, (item.c / 15) * 76);
                return (
                  <View key={item.m} style={{ alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: C.ink }}>{item.c}</Text>
                    <View style={{ height: barHeight, width: 24, backgroundColor: C.crimson, borderRadius: 8 }} />
                    <Text
                      style={{
                        fontFamily: 'Inter_700Bold',
                        fontSize: 10,
                        letterSpacing: 0.6,
                        textTransform: 'uppercase',
                        color: C.muted,
                      }}
                    >
                      {item.m}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
