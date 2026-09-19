import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export interface ScreenHeaderProps {
  title: string;
  category?: string;
  subtitle?: string;
  onBack?: () => void;
  showBack?: boolean;
  rightElement?: React.ReactNode;
  accentColor?: string;
  showBorder?: boolean;
  backButtonBg?: boolean;
}

export function ScreenHeader({
  title,
  category = 'VIRLA CONCIERGE',
  subtitle,
  onBack,
  showBack = true,
  rightElement,
  accentColor = '#E11D48',
  showBorder = true,
  backButtonBg = false,
}: ScreenHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <>
      <StatusBar style="dark" />
      <View 
        style={{ paddingTop: insets.top }} 
        className={`bg-white ${showBorder ? 'border-b border-zinc-100 shadow-xs' : ''}`}
      >
        <View className="h-14 flex-row items-center px-5 justify-between">
          {showBack ? (
            <TouchableOpacity 
              onPress={handleBack} 
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              className={`w-9 h-9 items-center justify-center ${
                backButtonBg 
                  ? 'rounded-full bg-zinc-100/80 border border-zinc-200/60' 
                  : ''
              }`}
            >
              <Ionicons name="arrow-back" size={22} color="#09090B" />
            </TouchableOpacity>
          ) : (
            <View className="w-9" />
          )}

          {/* Premium Editorial Header Title */}
          <View className="items-center flex-1 mx-2">
            {Boolean(category && category.trim()) && (
              <View className="flex-row items-center gap-1.5">
                <View 
                  style={{ backgroundColor: accentColor }} 
                  className="w-1.5 h-1.5 rounded-full" 
                />
                <Text 
                  style={{ letterSpacing: 2.2 }}
                  className="text-zinc-500 text-[9.5px] font-bold uppercase"
                  numberOfLines={1}
                >
                  {category}
                </Text>
              </View>
            )}
            <Text 
              numberOfLines={1}
              className="text-zinc-950 text-base font-extrabold tracking-tight mt-0.5"
            >
              {title}
            </Text>
            {subtitle ? (
              <Text className="text-indigo-600 text-[9px] font-black uppercase tracking-widest mt-0.5">
                {subtitle}
              </Text>
            ) : null}
          </View>

          {rightElement ? (
            <View className="min-w-[36px] items-end justify-center">
              {rightElement}
            </View>
          ) : (
            <View className="w-9" />
          )}
        </View>
      </View>
    </>
  );
}

export default ScreenHeader;
