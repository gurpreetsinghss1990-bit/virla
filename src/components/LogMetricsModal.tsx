import React, { useState, useEffect } from 'react';
import {
  Modal,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useUserStore } from '../store/userStore';

interface LogMetricsModalProps {
  visible: boolean;
  type: 'hydration' | 'calories';
  onClose: () => void;
  onSelect: (amount: number) => void;
}

interface PresetOption {
  amount: number;
  title: string;
  icon: string;
  subtitle: string;
}

const CALORIE_PRESETS: PresetOption[] = [
  { amount: 150, title: 'Walk / Stretch', icon: '🚶', subtitle: 'Light exertion' },
  { amount: 300, title: 'Cardio / Gym', icon: '🏋️', subtitle: 'Moderate session' },
  { amount: 500, title: 'Intense HIIT', icon: '⚡', subtitle: 'High intensity' },
];

export const LogMetricsModal: React.FC<LogMetricsModalProps> = ({
  visible,
  type,
  onClose,
  onSelect,
}) => {
  const { user } = useUserStore();
  const rawName = user?.name?.trim() || '';
  const firstName = rawName ? rawName.split(' ')[0] : 'Champion';

  const isHydration = type === 'hydration';
  const defaultAmount = isHydration ? 500 : 300;
  const [amount, setAmount] = useState<number>(defaultAmount);

  const unit = isHydration ? 'ML' : 'KCAL';
  const step = 50;
  const minAmount = 50;
  const maxAmount = isHydration ? 3000 : 2500;

  useEffect(() => {
    if (visible) {
      setAmount(defaultAmount);
    }
  }, [visible, isHydration, defaultAmount]);

  const handleDecrement = () => {
    setAmount((prev) => Math.max(minAmount, prev - step));
  };

  const handleIncrement = () => {
    setAmount((prev) => Math.min(maxAmount, prev + step));
  };

  const handleSave = () => {
    onSelect(amount);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        className="flex-1 bg-slate-950/50 items-center justify-center px-5"
        style={{
          backgroundColor: 'rgba(15, 23, 42, 0.45)',
        }}
      >
        <TouchableWithoutFeedback>
          <View
            className="w-full max-w-sm rounded-[32px] p-6 shadow-2xl"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.96)',
              borderWidth: 1.5,
              borderColor: 'rgba(255, 255, 255, 0.85)',
              elevation: 16,
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: 0.2,
              shadowRadius: 24,
            }}
          >
            {/* Header with Title and Top-Right Dismiss ✕ Icon */}
            <View className="flex-row items-start justify-between mb-3">
              <View className="flex-1 pr-2">
                {/* Personalized Motivation Pill */}
                <View
                  className={`flex-row items-center gap-1.5 self-start px-2.5 py-1 rounded-full mb-2 ${
                    isHydration
                      ? 'bg-cyan-50 border border-cyan-100'
                      : 'bg-rose-50 border border-rose-100'
                  }`}
                >
                  <Text className="text-xs">{isHydration ? '💧' : '🔥'}</Text>
                  <Text
                    className={`text-[11px] font-bold ${
                      isHydration ? 'text-cyan-700' : 'text-[#A82B50]'
                    }`}
                  >
                    {isHydration
                      ? `Stay hydrated, ${firstName}!`
                      : `Looking strong, ${firstName}!`}
                  </Text>
                </View>

                <Text className="text-zinc-950 text-xl font-bold tracking-tight">
                  {isHydration ? 'Log Hydration' : 'Log Active Burn'}
                </Text>
                <Text className="text-zinc-500 text-xs mt-0.5 leading-relaxed font-medium">
                  {isHydration
                    ? `Keep your vitality at peak today, ${firstName}. Adjust your water intake:`
                    : `Every calorie fuels your progress, ${firstName}. Adjust your burn below:`}
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={onClose}
                className="w-8 h-8 rounded-full bg-zinc-100/90 items-center justify-center border border-zinc-200/60 active:bg-zinc-200"
                accessibilityRole="button"
                accessibilityLabel="Close dialog"
              >
                <Feather name="x" size={16} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Custom Numerical Stepper (Clean background-free layout) */}
            <View className="flex-row items-center justify-between py-3 mb-5 px-1">
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleDecrement}
                disabled={amount <= minAmount}
                className={`w-12 h-12 rounded-full items-center justify-center border shadow-sm ${
                  amount <= minAmount
                    ? 'bg-zinc-100 border-zinc-200/60 opacity-40'
                    : 'bg-white border-zinc-200 active:bg-zinc-100'
                }`}
                accessibilityRole="button"
                accessibilityLabel="Decrease value"
              >
                <Feather name="minus" size={20} color="#374151" />
              </TouchableOpacity>

              <View className="items-center justify-center flex-1 px-3">
                <View className="flex-row items-baseline justify-center">
                  <Text className="text-[38px] font-black text-zinc-950 tracking-tight">
                    {amount}
                  </Text>
                  <Text className="text-[14px] font-extrabold text-zinc-400 ml-1.5 uppercase tracking-wider">
                    {unit}
                  </Text>
                </View>
                <Text className="text-[11px] font-medium text-zinc-400 mt-0.5">
                  {isHydration ? 'fluid intake' : 'active burn'}
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleIncrement}
                disabled={amount >= maxAmount}
                className={`w-12 h-12 rounded-full items-center justify-center border shadow-sm ${
                  amount >= maxAmount
                    ? 'bg-zinc-100 border-zinc-200/60 opacity-40'
                    : 'bg-white border-zinc-200 active:bg-zinc-100'
                }`}
                accessibilityRole="button"
                accessibilityLabel="Increase value"
              >
                <Feather name="plus" size={20} color="#374151" />
              </TouchableOpacity>
            </View>

            {/* Preset Activity Chips / Structured Cards (Only for Active Burn / Calories) */}
            {!isHydration && (
              <View className="mb-5">
                <Text className="text-zinc-400 text-[11px] font-bold uppercase tracking-wider mb-2.5 pl-0.5">
                  Activity Presets
                </Text>
                <View className="gap-2">
                  {CALORIE_PRESETS.map((preset) => {
                    const isSelected = amount === preset.amount;
                    return (
                      <TouchableOpacity
                        key={preset.amount}
                        activeOpacity={0.75}
                        onPress={() => setAmount(preset.amount)}
                        className={`flex-row items-center justify-between p-3 rounded-2xl border ${
                          isSelected
                            ? 'bg-[#A82B50]/[0.08] border-[#A82B50]'
                            : 'bg-white border-zinc-200/80 active:bg-zinc-50'
                        }`}
                        style={
                          isSelected ? { borderColor: '#A82B50' } : undefined
                        }
                      >
                        <View className="flex-row items-center gap-3">
                          <View
                            className={`w-10 h-10 rounded-xl items-center justify-center ${
                              isSelected
                                ? 'bg-[#A82B50]/15'
                                : 'bg-zinc-100'
                            }`}
                          >
                            <Text className="text-base">{preset.icon}</Text>
                          </View>
                          <View>
                            <Text
                              className={`text-[13.5px] font-bold ${
                                isSelected
                                  ? 'text-[#A82B50]'
                                  : 'text-zinc-900'
                              }`}
                            >
                              {preset.title}
                            </Text>
                            <Text className="text-[11px] text-zinc-400 font-medium">
                              {preset.subtitle}
                            </Text>
                          </View>
                        </View>

                        <View
                          className={`px-2.5 py-1 rounded-full ${
                            isSelected
                              ? 'bg-[#A82B50]'
                              : 'bg-zinc-100'
                          }`}
                          style={
                            isSelected
                              ? { backgroundColor: '#A82B50' }
                              : undefined
                          }
                        >
                          <Text
                            className={`text-xs font-bold ${
                              isSelected ? 'text-white' : 'text-zinc-600'
                            }`}
                          >
                            +{preset.amount} kcal
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Brand-Cohesive Actions */}
            <View className="gap-2">
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleSave}
                className="w-full h-[50px] rounded-2xl items-center justify-center shadow-md active:opacity-90"
                style={{
                  backgroundColor: isHydration ? '#0891B2' : '#A82B50',
                  shadowColor: isHydration ? '#0891B2' : '#A82B50',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.25,
                  shadowRadius: 8,
                  elevation: 4,
                }}
              >
                <Text className="text-white text-sm font-bold tracking-wide">
                  {isHydration ? 'Save Hydration' : 'Save Active Burn'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.6}
                onPress={onClose}
                className="py-2.5 w-full items-center justify-center active:opacity-60"
              >
                <Text className="text-zinc-400 text-xs font-bold uppercase tracking-wider">
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </TouchableOpacity>
    </Modal>
  );
};

