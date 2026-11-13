import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

export interface Plan {
  id: string;
  name: string;
  credits: number;
  price: string;
  originalPrice?: string;
  savings?: string;
  gstText: string;
  gstVal: string;
  amountVal: string;
  finalPrice?: string;
  idealFor: string;
  perSessionText?: string;
  popular?: boolean;
  badge?: string;
  ribbon?: string;
  category?: any;
  bulletPoints?: string[];
  [key: string]: any;
}

interface PlanCardProps {
  plan: Plan;
  isExpanded: boolean;
  buddyNotice: boolean;
  hasCredits: boolean;
  onPress: (plan: Plan) => void;
  onBlocked: () => void;
}

function PlanCardBase({ plan, isExpanded, buddyNotice, hasCredits, onPress, onBlocked }: PlanCardProps) {
  const displayName = plan.name;
  const is8SessionPack = plan.id === 'plan-ind-2';
  const isBuddyAddon = plan.id === 'plan-ind-addon-buddy';
  const isBuddyDisabled = isBuddyAddon && !hasCredits;

  let sectionCallout: { text: string; icon: any; color: string } | null = null;
  if (is8SessionPack) {
    sectionCallout = { text: 'LIMITED OFFER • FIRST 100 USERS', icon: 'zap', color: '#D97706' };
  } else if (isBuddyAddon) {
    sectionCallout = { text: 'FLEXIBILITY PASS • BRING A FRIEND', icon: 'users', color: '#059669' };
  }

  return (
    <>
      {/* Attractive inline divider text with extra spacing */}
      {sectionCallout && (
        <View style={{ marginTop: 14, marginBottom: 12, paddingHorizontal: 6, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Feather name={sectionCallout.icon} size={12} color={sectionCallout.color} />
          <Text style={{ fontSize: 10.5, fontWeight: '900', color: sectionCallout.color, letterSpacing: 0.8, textTransform: 'uppercase' }}>
            {sectionCallout.text}
          </Text>
        </View>
      )}

      <View
        style={{
          backgroundColor: isBuddyDisabled
            ? '#FAFAFA'
            : (is8SessionPack
              ? '#FEFDF8'
              : '#FFFFFF'),
          borderRadius: 22,
          borderWidth: is8SessionPack ? 1.2 : (isBuddyDisabled ? 1 : 0),
          borderColor: is8SessionPack ? '#FDE68A' : (isBuddyDisabled ? '#E4E4E7' : 'transparent'),
          shadowColor: is8SessionPack ? '#D97706' : '#000000',
          shadowOffset: { width: 0, height: 7 },
          shadowOpacity: isExpanded ? 0.12 : (isBuddyDisabled ? 0.02 : (is8SessionPack ? 0.10 : 0.08)),
          shadowRadius: isExpanded ? 12 : (isBuddyDisabled ? 4 : (is8SessionPack ? 10 : 9)),
          elevation: isExpanded ? 5 : (isBuddyDisabled ? 1 : (is8SessionPack ? 4 : 3)),
          position: 'relative',
          opacity: isBuddyDisabled ? 0.72 : 1,
          marginBottom: 16, // Clean increased spacing between cards
        }}
      >
        {/* Floating Flag/Ribbon Badge at top-left outside */}
        {(plan.badge || plan.ribbon) && (
          <View
            style={{
              position: 'absolute',
              top: -10,
              left: 18,
              zIndex: 10,
              backgroundColor: isBuddyDisabled
                ? '#71717A'
                : (is8SessionPack
                  ? '#D97706'
                  : (plan.popular ? '#6366F1' : (plan.isHighlighted ? '#E11D48' : '#18181B'))),
              paddingHorizontal: 10,
              paddingVertical: 3,
              borderRadius: 6,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 9.5, fontWeight: '900', letterSpacing: 0.6, textTransform: 'uppercase' }}>
              {isBuddyDisabled ? 'ADD-ON LOCKED' : (is8SessionPack ? 'FIRST 100 EXCLUSIVE' : (plan.ribbon || plan.badge))}
            </Text>
          </View>
        )}

        {/* Card Collapsed/Expanded Top Summary Bar */}
        <TouchableOpacity
          activeOpacity={isBuddyDisabled ? 0.95 : 0.85}
          onPress={isBuddyDisabled ? onBlocked : () => onPress(plan)}
          style={{
            padding: 18,
            paddingTop: (plan.badge || plan.ribbon) ? 20 : 18,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={{ fontSize: 16, fontWeight: '900', color: isBuddyDisabled ? '#71717A' : '#18181B', letterSpacing: -0.2 }}>
              {displayName}
            </Text>
            <Text style={{ fontSize: 12, color: '#71717A', marginTop: 2, fontWeight: '500' }}>
              {plan.idealFor}
            </Text>

            {/* Always visible promo point without enlarging / opening the card */}
            {is8SessionPack && (
              <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Feather name="gift" size={12} color="#D97706" />
                <Text style={{ fontSize: 11, color: '#B45309', fontWeight: '800' }}>
                  Limited time offer for first 100 users
                </Text>
              </View>
            )}

            {/* Inline helper message when user with 0 credits clicks Workout Buddy */}
            {isBuddyAddon && isBuddyDisabled && buddyNotice && (
              <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Feather name="info" size={12} color="#E11D48" />
                <Text style={{ fontSize: 11, color: '#E11D48', fontWeight: '700' }}>
                  This is an add-on plan, not a standalone pack.
                </Text>
              </View>
            )}
          </View>

          <View style={{ alignItems: 'flex-end', flexDirection: 'row', gap: 6 }}>
            <View style={{ alignItems: 'flex-end' }}>
              {plan.originalPrice && (
                <Text style={{ fontSize: 11, color: '#A1A1AA', textDecorationLine: 'line-through', fontWeight: '600' }}>
                  {plan.originalPrice}
                </Text>
              )}
              <Text style={{
                fontSize: 21,
                fontWeight: '900',
                color: is8SessionPack
                  ? '#D97706'
                  : (isBuddyDisabled ? '#71717A' : '#18181B'),
                letterSpacing: -0.5
              }}>
                {plan.price}
              </Text>
              <Text style={{ fontSize: 10, color: '#A1A1AA', fontWeight: '600' }}>
                {plan.perSessionText || 'per session'}
              </Text>
            </View>

            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                backgroundColor: isExpanded ? (is8SessionPack ? '#FEF3C7' : '#FFF1F2') : (is8SessionPack ? '#FEF3C7' : '#F4F4F6'),
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: 4,
              }}
            >
              <Feather
                name={isBuddyDisabled ? 'lock' : (isExpanded ? 'chevron-up' : 'chevron-down')}
                size={15}
                color={is8SessionPack ? '#D97706' : (isExpanded ? '#E11D48' : '#71717A')}
              />
            </View>
          </View>
        </TouchableOpacity>

        {/* Expanded Details Section */}
        {isExpanded && (
          <View style={{ paddingHorizontal: 18, paddingBottom: 16, borderTopWidth: 1, borderTopColor: is8SessionPack ? '#FEF3C7' : '#F4F4F6', paddingTop: 14 }}>
            {/* Bullet Points with Clean Check / Tick mark */}
            <View style={{ gap: 8 }}>
              {plan.bulletPoints?.map((bullet, bIdx) => (
                <View key={bIdx} style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                  <Feather name="check" size={14} color={is8SessionPack ? '#D97706' : '#E11D48'} />
                  <Text style={{ fontSize: 12.5, color: '#3F3F46', fontWeight: '500', flex: 1, lineHeight: 17 }}>
                    {bullet}
                  </Text>
                </View>
              ))}
            </View>

            {/* Add-on Specific Disclaimer below bullets */}
            {isBuddyAddon && (
              <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F4F4F5' }}>
                <Text style={{ fontSize: 11, color: '#71717A', fontStyle: 'italic', lineHeight: 16 }}>
                  * This is an add-on plan, not a standalone pack, so the 6-month pack validity does not apply.
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    </>
  );
}

// Only the cards whose data actually changed re-render. The callbacks are
// intentionally excluded: both are update-only and therefore stale-proof.
export const PlanCard = React.memo(
  PlanCardBase,
  (prev, next) =>
    prev.plan === next.plan &&
    prev.isExpanded === next.isExpanded &&
    prev.buddyNotice === next.buddyNotice &&
    prev.hasCredits === next.hasCredits
);
