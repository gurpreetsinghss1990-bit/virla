import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LedgerTransaction } from '../../../store/walletStore';
import { softShadow } from '../../../utils/shadows';

interface WalletLedgerTabProps {
  ledgerLength: number;
  ledgerFilter: 'all' | 'booking' | 'purchase' | 'refund';
  setLedgerFilter: (filter: 'all' | 'booking' | 'purchase' | 'refund') => void;
  setVisibleLedgerCount: (count: number) => void;
  filteredLedger: LedgerTransaction[];
  visibleLedgerCount: number;
  getLedgerIcon: (type: LedgerTransaction['type']) => { icon: string; color: string; bg: string; border: string };
  onLoadMore: () => void;
}

export const WalletLedgerTab = React.memo(function WalletLedgerTab({
  ledgerLength,
  ledgerFilter,
  setLedgerFilter,
  setVisibleLedgerCount,
  filteredLedger,
  visibleLedgerCount,
  getLedgerIcon,
  onLoadMore,
}: WalletLedgerTabProps) {
  return (
    <View className="gap-3 mt-1">
      {/* Ledger Subheader & Total Counter */}
      <View className="flex-row items-center justify-between px-0.5">
        <View>
          <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-base text-slate-900 tracking-tight leading-tight">
            Transaction Ledger
          </Text>
          <Text style={{ fontFamily: 'Outfit_400Regular' }} className="text-[11px] text-slate-400 mt-0.5">
            Session debits & credit top-ups
          </Text>
        </View>
        <View className="px-2.5 py-0.5 bg-slate-100 rounded-full">
          <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-slate-600 text-[11px]">
            {ledgerLength} Total
          </Text>
        </View>
      </View>

      {/* Quick Filter Horizontal Pills matching Sessions tab date filter */}
      <View style={{ paddingVertical: 4, marginBottom: 0, marginHorizontal: -16 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8, flexDirection: 'row', alignItems: 'center' }}
        >
          {(['booking', 'purchase', 'refund', 'all'] as const).map((filter) => {
            const isActive = ledgerFilter === filter;
            const label = filter === 'booking' ? 'Sessions' : filter === 'purchase' ? 'Purchases' : filter === 'refund' ? 'Refunds' : 'All';
            return (
              <View
                key={filter}
                style={{
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: isActive ? '#0F172A' : '#E2E8F0',
                  backgroundColor: isActive ? '#0F172A' : '#FFFFFF',
                  paddingVertical: 7,
                  paddingHorizontal: isActive ? 18 : 15,
                  elevation: isActive ? 2 : 1,
                }}
              >
                <Pressable
                  onPress={() => {
                    setLedgerFilter(filter);
                    setVisibleLedgerCount(8);
                  }}
                  hitSlop={6}
                >
                  <Text
                    style={{
                      fontFamily: isActive ? 'Outfit_700Bold' : 'Outfit_600SemiBold',
                      fontSize: 12,
                      color: isActive ? '#FFFFFF' : '#475569',
                    }}
                  >
                    {label}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      </View>

      {/* Transaction List Cards Container — curved top like progress tab */}
      <View
        style={{
          borderTopLeftRadius: 32,
          borderTopRightRadius: 32,
          overflow: 'hidden',
          backgroundColor: '#F8F9FC',
          marginHorizontal: -16,
          paddingHorizontal: 16,
          paddingTop: 16,
          ...softShadow({ color: '#0F172A', opacity: 0.05, radius: 10, offsetY: -3 }),
        }}
      >
        <ScrollView
          nestedScrollEnabled
          bounces
          alwaysBounceVertical
          overScrollMode="always"
          showsVerticalScrollIndicator={false}
          style={{ maxHeight: 420 }}
          contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
        >
          {filteredLedger.length === 0 ? (
            <View className="bg-white rounded-2xl p-8 border border-slate-100 items-center justify-center gap-2 shadow-sm">
              <Feather name="inbox" size={26} color="#CBD5E1" />
              <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-slate-400 text-sm">
                No transactions found
              </Text>
            </View>
          ) : (
            <>
              {filteredLedger.slice(0, visibleLedgerCount).map((tx) => {
                const isAdd = tx.change >= 0;
                const iconInfo = getLedgerIcon(tx.type);
                return (
                  <View
                    key={tx.id}
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: 16,
                      padding: 16,
                      borderWidth: 1,
                      borderColor: '#F1F5F9',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      ...softShadow({ color: '#0F172A', opacity: 0.03, radius: 6, offsetY: 2 }),
                    }}
                  >
                    <View className="flex-row items-center gap-3.5 flex-1 mr-3">
                      <View
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 14,
                          backgroundColor: iconInfo.bg,
                          borderWidth: 1,
                          borderColor: iconInfo.border,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Feather name={iconInfo.icon as any} size={18} color={iconInfo.color} />
                      </View>
                      <View className="flex-1">
                        <Text
                          style={{ fontFamily: 'Outfit_700Bold' }}
                          className="text-slate-900 text-sm tracking-tight"
                          numberOfLines={1}
                        >
                          {tx.title}
                        </Text>
                        <View className="flex-row items-center gap-1.5 mt-0.5">
                          <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-slate-400 text-[11px]">
                            {tx.date}
                          </Text>
                          <View className="w-1 h-1 rounded-full bg-slate-300" />
                          <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-slate-400 text-[10px] uppercase">
                            {tx.type}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <View className="items-end">
                      <Text
                        style={{ fontFamily: 'Outfit_800ExtraBold' }}
                        className={`text-base ${isAdd ? 'text-emerald-600' : 'text-slate-900'}`}
                      >
                        {isAdd ? `+${tx.change}` : `${tx.change}`}
                      </Text>
                      <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-slate-400 text-[9.5px] uppercase tracking-wider">
                        Credits
                      </Text>
                    </View>
                  </View>
                );
              })}
              {filteredLedger.length > visibleLedgerCount && (
                <Pressable
                  onPress={onLoadMore}
                  style={{
                    marginTop: 8,
                    paddingVertical: 12,
                    borderRadius: 16,
                    backgroundColor: '#FFFFFF',
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 12, color: '#1E293B' }}>
                    {`LOAD MORE (${filteredLedger.length - visibleLedgerCount} REMAINING)`}
                  </Text>
                </Pressable>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </View>
  );
});
