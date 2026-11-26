import React from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Loading } from '../../Loading';
import { softShadow } from '../../../utils/shadows';
import { clampInt } from '../../../utils/inputSafety';

interface WalletTransferTabProps {
  transferPhone: string;
  setTransferPhone: (v: string) => void;
  transferAmount: string;
  setTransferAmount: (v: string) => void;
  recipientName: string;
  setRecipientName: (v: string) => void;
  recipientStatus: string;
  setRecipientStatus: (v: any) => void;
  isInviteSent: boolean;
  setIsInviteSent: (v: boolean) => void;
  handleVerifyRecipient: () => void;
  handleInviteWhatsApp: () => void;
  handleShareMoreOptions: () => void;
  creditBalance: number;
  isEliteUser: boolean;
  renderExpirySection: () => React.ReactNode;
  handleTransfer: () => void;
  t: (key: string, opts?: any) => string;
}

export const WalletTransferTab = React.memo(function WalletTransferTab({
  transferPhone,
  setTransferPhone,
  transferAmount,
  setTransferAmount,
  recipientName,
  setRecipientName,
  recipientStatus,
  setRecipientStatus,
  isInviteSent,
  setIsInviteSent,
  handleVerifyRecipient,
  handleInviteWhatsApp,
  handleShareMoreOptions,
  creditBalance,
  isEliteUser,
  renderExpirySection,
  handleTransfer,
  t,
}: WalletTransferTabProps) {
  return (
<View className="gap-3">
              <View className="px-0.5">
                <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-base text-slate-900 tracking-tight leading-tight">
                  Peer-to-Peer Transfer
                </Text>
                <Text style={{ fontFamily: 'Outfit_400Regular' }} className="text-[11px] text-slate-400 mt-0.5">
                  Instantly share booking credits with friends or family on Virla.
                </Text>
              </View>

              <View 
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 20,
                  padding: 20,
                  borderColor: '#F1F4F9',
                  borderWidth: 1,
                  gap: 16,
                  ...softShadow({ color: '#0F172A', opacity: 0.04, radius: 10, offsetY: 2 }),
                }}
              >
                <View className="gap-3.5">
                  <View>
                    <Text style={{ fontFamily: 'Outfit_700Bold', letterSpacing: 0.8 }} className="text-[10px] uppercase text-slate-400 mb-1.5">
                      Recipient Phone Number
                    </Text>
                    <View className="flex-row gap-2">
                      <View 
                        style={{
                          backgroundColor: '#F8FAFC',
                          borderColor: '#E2E8F0',
                          borderWidth: 1,
                          paddingHorizontal: 14,
                          borderRadius: 12,
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-slate-700 text-xs">+91</Text>
                      </View>
                      <TextInput
                        placeholder="Enter 10-digit mobile number"
                        placeholderTextColor="#94A3B8"
                        value={transferPhone}
                        onChangeText={(txt) => {
                          const cleaned = txt.replace(/\D/g, '');
                          if (cleaned.length <= 10) {
                            setTransferPhone(cleaned);
                            setRecipientStatus('idle');
                            setRecipientName('');
                            setIsInviteSent(false);
                          }
                        }}
                        keyboardType="numeric"
                        maxLength={10}
                        style={{
                          flex: 1,
                          backgroundColor: '#FAFBFD',
                          borderColor: '#E2E8F0',
                          borderWidth: 1,
                          paddingHorizontal: 16,
                          paddingVertical: 12,
                          borderRadius: 12,
                          fontFamily: 'Outfit_600SemiBold',
                          fontSize: 13,
                          color: '#0F172A',
                        }}
                      />
                      <Pressable
                        onPress={handleVerifyRecipient}
                        style={({ pressed }) => [
                          {
                            backgroundColor: '#090D16',
                            paddingHorizontal: 16,
                            borderRadius: 12,
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: pressed ? 0.85 : 1,
                            ...softShadow({ color: '#090D16', opacity: 0.15, radius: 6, offsetY: 2 }),
                          },
                        ]}
                      >
                        <Text style={{ fontFamily: 'Outfit_700Bold', letterSpacing: 0.6 }} className="text-white text-[11px] uppercase">
                          Verify
                        </Text>
                      </Pressable>
                    </View>

                    {/* Recipient status confirmations */}
                    {recipientStatus === 'searching' && (
                      <View className="flex-row items-center gap-2 mt-2.5 ml-1">
                        <Loading size="small" color="#4F46E5" />
                        <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-slate-400 text-[11px]">
                          Checking registered Virla users...
                        </Text>
                      </View>
                    )}
                    {recipientStatus === 'not_found' && (
                      <View 
                        style={{
                          marginTop: 12,
                          padding: 14,
                          borderRadius: 16,
                          backgroundColor: '#FEFBF2',
                          borderColor: '#FDEBBA',
                          borderWidth: 1,
                          gap: 12,
                        }}
                      >
                        <View className="flex-row items-center gap-2">
                          <Feather name="info" size={15} color="#D97706" />
                          <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-slate-800 text-xs">
                            {t('wallet.recipient_not_found', "This person isn't on Virla yet.")}
                          </Text>
                        </View>
                        
                        <View className="flex-row gap-2">
                          <Pressable
                            onPress={handleInviteWhatsApp}
                            style={{
                              flex: 1,
                              paddingVertical: 10,
                              paddingHorizontal: 12,
                              borderRadius: 12,
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexDirection: 'row',
                              gap: 6,
                              backgroundColor: isInviteSent ? '#1EBE5D' : '#25D366',
                            }}
                          >
                            <Ionicons name="logo-whatsapp" size={15} color="white" />
                            <Text style={{ fontFamily: 'Outfit_700Bold', letterSpacing: 0.5 }} className="text-white text-[11px] uppercase">
                              {isInviteSent ? t('wallet.invited_whatsapp', 'Invited on WhatsApp ✓') : t('wallet.invite_whatsapp', 'Invite via WhatsApp')}
                            </Text>
                          </Pressable>

                          <Pressable
                            onPress={handleShareMoreOptions}
                            style={{
                              backgroundColor: '#FFFFFF',
                              borderColor: '#E2E8F0',
                              borderWidth: 1,
                              paddingVertical: 10,
                              paddingHorizontal: 12,
                              borderRadius: 12,
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexDirection: 'row',
                              gap: 6,
                            }}
                          >
                            <Feather name="share-2" size={13} color="#374151" />
                            <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-slate-700 text-[11px]">
                              {t('wallet.more_options', 'More')}
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    )}
                    {recipientStatus === 'self' && (
                      <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-rose-600 text-[11px] mt-2 ml-1">
                        You cannot transfer credits to yourself.
                      </Text>
                    )}
                    {recipientStatus === 'found' && (
                      <View 
                        style={{
                          marginTop: 10,
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 10,
                          backgroundColor: '#ECFDF5',
                          borderColor: '#D1FAE5',
                          borderWidth: 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Feather name="check-circle" size={14} color="#059669" />
                        <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-emerald-700 text-xs uppercase">
                          Verified: {recipientName}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View>
                    <Text style={{ fontFamily: 'Outfit_700Bold', letterSpacing: 0.8 }} className="text-[10px] uppercase text-slate-400 mb-1.5">
                      Credits Amount
                    </Text>
                    <TextInput
                      maxLength={12}
                      placeholder="Number of credits to send"
                      placeholderTextColor="#94A3B8"
                      value={transferAmount}
                      onChangeText={(v) => setTransferAmount(clampInt(v, 6))}
                      keyboardType="numeric"
                      editable={recipientStatus === 'found'}
                      style={{
                        backgroundColor: '#FAFBFD',
                        borderColor: '#E2E8F0',
                        borderWidth: 1,
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        borderRadius: 12,
                        fontFamily: 'Outfit_600SemiBold',
                        fontSize: 13,
                        color: '#0F172A',
                        opacity: recipientStatus !== 'found' ? 0.5 : 1,
                      }}
                    />
                  </View>

                  <Pressable
                    onPress={handleTransfer}
                    disabled={recipientStatus !== 'found'}
                    style={({ pressed }) => [
                      {
                        width: '100%',
                        paddingVertical: 14,
                        borderRadius: 14,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginTop: 4,
                        backgroundColor: recipientStatus === 'found' ? '#090D16' : '#F1F5F9',
                        opacity: pressed && recipientStatus === 'found' ? 0.88 : 1,
                        ...(recipientStatus === 'found' ? softShadow({ color: '#090D16', opacity: 0.2, radius: 8, offsetY: 3 }) : {}),
                      },
                    ]}
                  >
                    <Text 
                      style={{ fontFamily: 'Outfit_700Bold', letterSpacing: 0.8 }}
                      className={`text-xs uppercase ${recipientStatus === 'found' ? 'text-white' : 'text-slate-400'}`}
                    >
                      Transfer Credits
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
  );
});
