import React from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import Svg, { Circle, Path, Rect, Defs, LinearGradient, Stop } from 'react-native-svg';

export type EmptyStateType = 
  | 'no-sessions' 
  | 'no-notifications' 
  | 'no-progress' 
  | 'no-bookings' 
  | 'no-favourite-trainer';

interface EmptyStateProps {
  type: EmptyStateType;
  onAction?: () => void;
  actionText?: string;
  message?: string;
}

export function EmptyState({ type, onAction, actionText, message }: EmptyStateProps) {
  const scaleAnim = React.useRef(new Animated.Value(0.95)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 40,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, [type]);

  const getContent = () => {
    switch (type) {
      case 'no-sessions':
        return {
          title: 'No Active Sessions',
          description: message || 'You do not have any training sessions scheduled. Let’s get you matched with a coach.',
          icon: (
            <Svg width={120} height={120} viewBox="0 0 120 120" fill="none">
              <Defs>
                <LinearGradient id="grad-sessions" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.8" />
                  <Stop offset="100%" stopColor="#EC4899" stopOpacity="0.8" />
                </LinearGradient>
              </Defs>
              <Circle cx={60} cy={60} r={45} fill="url(#grad-sessions)" opacity={0.15} />
              <Circle cx={60} cy={60} r={35} fill="url(#grad-sessions)" opacity={0.25} />
              <Path d="M45 45H75M45 60H75M45 75H65" stroke="url(#grad-sessions)" strokeWidth={3} strokeLinecap="round" />
              <Path d="M75 75L82 82" stroke="url(#grad-sessions)" strokeWidth={3} strokeLinecap="round" />
            </Svg>
          ),
          defaultActionText: 'Schedule Session',
        };
      case 'no-notifications':
        return {
          title: 'All Caught Up',
          description: message || 'Your notification center is clear. We’ll notify you when your coach begins travel.',
          icon: (
            <Svg width={120} height={120} viewBox="0 0 120 120" fill="none">
              <Defs>
                <LinearGradient id="grad-notifs" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#3B82F6" stopOpacity="0.8" />
                  <Stop offset="100%" stopColor="#06B6D4" stopOpacity="0.8" />
                </LinearGradient>
              </Defs>
              <Circle cx={60} cy={60} r={40} fill="url(#grad-notifs)" opacity={0.15} />
              <Path d="M60 35C51.7157 35 45 41.7157 45 50V65H75V50C75 41.7157 68.2843 35 60 35Z" stroke="url(#grad-notifs)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
              <Path d="M40 65H80" stroke="url(#grad-notifs)" strokeWidth={3} strokeLinecap="round" />
              <Path d="M55 72C55 74.7614 57.2386 77 60 77C62.7614 77 65 74.7614 65 72" stroke="url(#grad-notifs)" strokeWidth={3} strokeLinecap="round" />
            </Svg>
          ),
          defaultActionText: 'Check Updates',
        };
      case 'no-progress':
        return {
          title: 'Ready to Begin?',
          description: message || 'Complete your first wellness session to generate recovery, consistency, and calorie analytics.',
          icon: (
            <Svg width={120} height={120} viewBox="0 0 120 120" fill="none">
              <Defs>
                <LinearGradient id="grad-progress" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#10B981" stopOpacity="0.8" />
                  <Stop offset="100%" stopColor="#3B82F6" stopOpacity="0.8" />
                </LinearGradient>
              </Defs>
              <Circle cx={60} cy={60} r={40} fill="url(#grad-progress)" opacity={0.15} />
              <Rect x={48} y={65} width={6} height={15} rx={3} fill="url(#grad-progress)" />
              <Rect x={57} y={50} width={6} height={30} rx={3} fill="url(#grad-progress)" />
              <Rect x={66} y={35} width={6} height={45} rx={3} fill="url(#grad-progress)" />
            </Svg>
          ),
          defaultActionText: 'Book Now',
        };
      case 'no-bookings':
        return {
          title: 'No Bookings Found',
          description: message || 'You do not have any sessions in this category. Let’s set up your next concierge training.',
          icon: (
            <Svg width={120} height={120} viewBox="0 0 120 120" fill="none">
              <Defs>
                <LinearGradient id="grad-bookings" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#F59E0B" stopOpacity="0.8" />
                  <Stop offset="100%" stopColor="#EF4444" stopOpacity="0.8" />
                </LinearGradient>
              </Defs>
              <Circle cx={60} cy={60} r={40} fill="url(#grad-bookings)" opacity={0.15} />
              <Rect x={45} y={45} width={30} height={30} rx={5} stroke="url(#grad-bookings)" strokeWidth={3} />
              <Path d="M52 40V48M68 40V48" stroke="url(#grad-bookings)" strokeWidth={3} strokeLinecap="round" />
            </Svg>
          ),
          defaultActionText: 'Book Session',
        };
      case 'no-favourite-trainer':
        return {
          title: 'No Favorite Coaches',
          description: message || 'You haven’t favorited any coaches yet. Tap the heart on a coach’s profile to save them.',
          icon: (
            <Svg width={120} height={120} viewBox="0 0 120 120" fill="none">
              <Defs>
                <LinearGradient id="grad-heart" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#EF4444" stopOpacity="0.8" />
                  <Stop offset="100%" stopColor="#EC4899" stopOpacity="0.8" />
                </LinearGradient>
              </Defs>
              <Circle cx={60} cy={60} r={40} fill="url(#grad-heart)" opacity={0.15} />
              <Path d="M60 47.35C57.65 44.5 53.65 43 49.65 43C42.45 43 37.15 48.3 37.15 55.5C37.15 63.8 45.15 71 60 81.35C74.85 71 82.85 63.8 82.85 55.5C82.85 48.3 77.55 43 70.35 43C66.35 43 62.35 44.5 60 47.35Z" fill="url(#grad-heart)" />
            </Svg>
          ),
          defaultActionText: 'Browse Coaches',
        };
    }
  };

  const content = getContent();

  return (
    <Animated.View 
      style={{
        opacity: opacityAnim,
        transform: [{ scale: scaleAnim }],
      }}
      className="bg-white border border-[#E5E7EB] p-8 rounded-[32px] items-center justify-center shadow-sm"
    >
      <View className="mb-4">{content.icon}</View>
      <Text className="text-[#111827] text-lg font-black tracking-tight text-center">{content.title}</Text>
      <Text className="text-[#6B7280] text-xs font-semibold leading-relaxed text-center mt-2 max-w-[85%]">
        {content.description}
      </Text>
      {onAction && (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onAction}
          className="mt-6 bg-[#111827] px-6 py-3.5 rounded-2xl shadow-xs"
        >
          <Text className="text-white text-xs font-extrabold tracking-wide uppercase">
            {actionText || content.defaultActionText}
          </Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}
