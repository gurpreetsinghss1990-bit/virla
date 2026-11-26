import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { softShadow } from '../../../utils/shadows';

interface WalletOverviewTabProps {
  activeLots: any[];
  showAllLots: boolean;
  setShowAllLots: (v: boolean) => void;
  isReady: boolean;
  isEliteUser: boolean;
  approachingLots: any[];
  role: string;
  formatToDDMMYYYY: (d: string) => string;
}

export const WalletOverviewTab = React.memo(function WalletOverviewTab({
  activeLots,
  showAllLots,
  setShowAllLots,
  isReady,
  isEliteUser,
  approachingLots,
  role,
  formatToDDMMYYYY,
}: WalletOverviewTabProps) {
  return (
<View className="gap-3">
              <View className="px-0.5">
                <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-base text-slate-900 tracking-tight leading-tight">
                  Credit Expiry Breakdown
                </Text>
                <Text style={{ fontFamily: 'Outfit_400Regular' }} className="text-[11px] text-slate-400 mt-0.5">
                  Oldest expiring credits are used first
                </Text>
              </View>

              {/* Clean Circle Breakdown */}
              <View 
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 20,
                  padding: 20,
                  borderColor: '#F1F4F9',
                  borderWidth: 1,
                  position: 'relative',
                  ...softShadow({ color: '#0F172A', opacity: 0.04, radius: 10, offsetY: 2 }),
                }}
              >
                {activeLots.length === 0 ? (
                  <View className="py-4 items-center justify-center">
                    <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-slate-400 text-xs">
                      No active credit packs right now.
                    </Text>
                  </View>
                ) : (
                  <>
                    {activeLots.length > 1 && (
                      <View
                        className="absolute h-[2px] bg-[#E11D48]/25"
                        style={{
                          top: 42,
                          left: activeLots.length === 2 ? '25%' : '16.6%',
                          width: activeLots.length === 2 ? '50%' : '66.8%',
                        }}
                        pointerEvents="none"
                      />
                    )}

                    <View className="flex-row justify-around items-start">
                      {activeLots.slice(0, 3).map((lot: any, idx: number) => {
                        const expiryMs = new Date(lot.official_expiry_date).getTime();
                        const daysLeft = isNaN(expiryMs)
                          ? 0
                          : Math.max(0, Math.ceil((expiryMs - Date.now()) / (1000 * 60 * 60 * 24)));
                        const isFirst = idx === 0;
                        const isExpiringSoon = daysLeft <= 14;
                        const stepLabel = isFirst ? 'USE FIRST' : idx === 1 ? 'NEXT' : 'LATER';

                        return (
                          <View key={lot.id || idx} className="items-center flex-1">
                            <View
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: 22,
                                backgroundColor: isFirst ? '#E11D48' : '#E1EFFE',
                                alignItems: 'center',
                                justifyContent: 'center',
                                ...(isFirst ? softShadow({ color: '#E11D48', opacity: 0.3, radius: 6, offsetY: 2 }) : {}),
                              }}
                            >
                              <Text style={{ fontFamily: 'Outfit_700Bold' }} className={`text-sm ${isFirst ? 'text-white' : 'text-slate-800'}`}>
                                {lot.remaining_credits || 0}
                              </Text>
                            </View>
                            <Text
                              style={{ fontFamily: 'Outfit_700Bold', letterSpacing: 0.8 }}
                              className={`text-[10px] uppercase mt-2.5 ${
                                isFirst ? 'text-[#E11D48]' : 'text-slate-400'
                              }`}
                            >
                              {stepLabel}
                            </Text>
                            <Text
                              style={{ fontFamily: 'Outfit_700Bold' }}
                              className={`text-[10.5px] mt-0.5 ${
                                isExpiringSoon ? 'text-[#E11D48]' : 'text-emerald-600'
                              }`}
                            >
                              {daysLeft}d left
                            </Text>
                            <Text style={{ fontFamily: 'Outfit_400Regular' }} className="text-slate-400 text-[10px] mt-0.5">
                              {lot.official_expiry_date ? formatToDDMMYYYY(lot.official_expiry_date) : '-'}
                            </Text>
                          </View>
                        );
                      })}
                    </View>

                    {activeLots.length > 3 && (
                      <View style={{ marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderColor: '#F1F4F9' }}>
                        <Pressable
                          onPress={() => setShowAllLots(!showAllLots)}
                          className="items-center justify-center py-1"
                          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                        >
                          <Text style={{ fontFamily: 'Outfit_700Bold', letterSpacing: 0.6 }} className="text-slate-600 text-[11px] uppercase">
                            {showAllLots ? 'Show Less' : `View All ${activeLots.length} Packs`}
                          </Text>
                        </Pressable>

                        {showAllLots && (
                          <View className="gap-2.5 mt-3">
                            {activeLots.slice(3).map((lot: any, idx: number) => (
                              <View key={lot.id || idx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 }}>
                                <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-slate-900 text-xs">{lot.remaining_credits} Credits</Text>
                                <Text style={{ fontFamily: 'Outfit_400Regular' }} className="text-slate-400 text-[11px]">
                                  Expires {lot.official_expiry_date ? formatToDDMMYYYY(lot.official_expiry_date) : '-'}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    )}
                  </>
                )}
              </View>

              {/* Contextual Benefit / Tip Card (Deferred until transition finishes) */}
              {isReady && (
                isEliteUser && approachingLots.length > 0 ? (
                  <View 
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#F1F4F9',
                      borderWidth: 1,
                      borderRadius: 18,
                      padding: 16,
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      gap: 12,
                      marginTop: 2,
                      ...softShadow({ color: '#0F172A', opacity: 0.03, radius: 8, offsetY: 2 }),
                    }}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFF1F2', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="heart-outline" size={18} color="#E11D48" />
                    </View>
                    <View className="flex-1">
                      <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-slate-900 text-xs">
                        A special benefit for you ❤️
                      </Text>
                      <Text style={{ fontFamily: 'Outfit_400Regular' }} className="text-slate-500 text-xs mt-1 leading-relaxed">
                        Your credits are approaching their expiry date. Because you&apos;re a premium Virla client, we&apos;re giving you an additional 7 days to use your remaining credits.
                      </Text>
                    </View>
                  </View>
                ) : role === 'trainer' ? (
                  <View 
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#F1F4F9',
                      borderWidth: 1,
                      borderRadius: 18,
                      padding: 16,
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      gap: 12,
                      marginTop: 2,
                      ...softShadow({ color: '#0F172A', opacity: 0.03, radius: 8, offsetY: 2 }),
                    }}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="information-circle-outline" size={18} color="#3B82F6" />
                    </View>
                    <View className="flex-1">
                      <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-slate-900 text-xs">
                        Transfer-Only Credits
                      </Text>
                      <Text style={{ fontFamily: 'Outfit_400Regular' }} className="text-slate-500 text-xs mt-1 leading-relaxed">
                        As a trainer, you can receive and transfer credits, but you cannot use credits to book sessions for yourself.
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View 
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#F1F4F9',
                      borderWidth: 1,
                      borderRadius: 18,
                      padding: 16,
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      gap: 12,
                      marginTop: 2,
                      ...softShadow({ color: '#0F172A', opacity: 0.03, radius: 8, offsetY: 2 }),
                    }}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFFBEB', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="bulb-outline" size={18} color="#D97706" />
                    </View>
                    <View className="flex-1">
                      <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-slate-900 text-xs">
                        Session Scheduling Tip
                      </Text>
                      <Text style={{ fontFamily: 'Outfit_400Regular' }} className="text-slate-500 text-xs mt-1 leading-relaxed">
                        Schedule your workout sessions in advance to ensure your available credits are utilized effectively before expiration.
                      </Text>
                    </View>
                  </View>
                )
              )}
            </View>
  );
});
