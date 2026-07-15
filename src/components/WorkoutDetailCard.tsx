import React, { useState } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Workout } from '../types';
import { Ionicons } from '@expo/vector-icons';

if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

interface WorkoutDetailCardProps {
  workout: Workout;
}

export function WorkoutDetailCard({ workout }: WorkoutDetailCardProps) {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} className="flex-1 bg-white">
      {/* 1. Large Hero Image with Accent Badges */}
      <View className="relative w-full aspect-[16/11]">
        <Image
          source={{ uri: workout.heroImage || 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80' }}
          className="w-full h-full"
          resizeMode="cover"
        />
        
        {/* Soft dark vignette gradient overlay */}
        <View className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        
        {/* Badges on Top Image */}
        <View className="absolute bottom-5 left-6 right-6 flex-row justify-between items-end">
          <View className="gap-1">
            <Text className="text-white text-2xl font-black tracking-tight">{workout.title}</Text>
            <View className="flex-row gap-2 mt-1">
              <View className="bg-orange-500 px-3 py-1 rounded-full flex-row items-center gap-1 shadow-sm">
                <Text className="text-white text-[10px] font-black uppercase tracking-wider">🏠 Home Visit</Text>
              </View>
              <View className="bg-white/20 px-3 py-1 rounded-full border border-white/10 backdrop-blur-md">
                <Text className="text-white text-[10px] font-bold uppercase tracking-wider">{workout.category || 'Fitness'}</Text>
              </View>
            </View>
          </View>
          
          <View className="bg-white/95 px-4 py-2 rounded-2xl shadow-md backdrop-blur-md items-end">
            <Text className="text-zinc-400 text-[8px] font-bold uppercase">Session Price</Text>
            <Text className="text-primary text-base font-black">₹{workout.sessionPrice || 1200}</Text>
          </View>
        </View>
      </View>

      {/* Main content body */}
      <View className="p-6 gap-6">
        
        {/* 2. Specs Highlights Row */}
        <View className="flex-row justify-around bg-zinc-50 border border-zinc-100 p-4 rounded-[24px]">
          <View className="items-center">
            <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">Duration</Text>
            <Text className="text-primary text-sm font-black mt-1">⏱️ {workout.duration} mins</Text>
          </View>
          <View className="w-[1px] bg-zinc-200" />
          <View className="items-center">
            <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">Avg Burn</Text>
            <Text className="text-primary text-sm font-black mt-1">🔥 {workout.calories} kcal</Text>
          </View>
          <View className="w-[1px] bg-zinc-200" />
          <View className="items-center">
            <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">Difficulty</Text>
            <Text className="text-primary text-sm font-black mt-1">💪 {workout.difficulty || 'Medium'}</Text>
          </View>
        </View>

        {/* 3. Description */}
        <View className="gap-2">
          <Text className="text-primary text-base font-extrabold tracking-tight">Overview</Text>
          <Text className="text-zinc-500 text-sm leading-relaxed font-medium">
            {workout.description}
          </Text>
        </View>

        {/* 4. Benefits */}
        {workout.benefits && workout.benefits.length > 0 && (
          <View className="gap-3">
            <Text className="text-primary text-base font-extrabold tracking-tight">Key Benefits</Text>
            <View className="gap-2.5">
              {workout.benefits.map((benefit, i) => (
                <View key={i} className="flex-row items-start">
                  <Text className="text-orange-500 text-sm mr-2.5">✓</Text>
                  <Text className="text-zinc-600 text-sm font-semibold flex-1 leading-relaxed">
                    {benefit}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 5. Equipment Required */}
        {workout.equipment && workout.equipment.length > 0 && (
          <View className="gap-3">
            <Text className="text-primary text-base font-extrabold tracking-tight">Required Equipment</Text>
            <View className="flex-row flex-wrap gap-2">
              {workout.equipment.map((item, i) => (
                <View key={i} className="bg-zinc-50 border border-zinc-100 px-4 py-3 rounded-2xl flex-row items-center gap-2">
                  <Text className="text-xs">📦</Text>
                  <Text className="text-zinc-700 text-xs font-bold">{item}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 6. Ratings & Reviews */}
        <View className="gap-4">
          <View className="flex-row justify-between items-center">
            <Text className="text-primary text-base font-extrabold tracking-tight">Ratings & Reviews</Text>
            <View className="flex-row items-center gap-1.5">
              <Ionicons name="star" size={16} color="#EAB308" />
              <Text className="text-primary text-sm font-black">{workout.rating || '4.8'}</Text>
              <Text className="text-zinc-400 text-xs font-bold">({workout.reviews?.length || 0} reviews)</Text>
            </View>
          </View>

          {workout.reviews && workout.reviews.length > 0 ? (
            <View className="gap-3">
              {workout.reviews.map((rev, i) => (
                <View key={i} className="bg-zinc-50 border border-zinc-100/50 p-4 rounded-2xl shadow-sm gap-2">
                  <View className="flex-row justify-between items-center">
                    <Text className="text-primary text-xs font-extrabold">{rev.reviewerName}</Text>
                    <View className="flex-row items-center gap-0.5">
                      {[...Array(5)].map((_, idx) => (
                        <Ionicons
                          key={idx}
                          name="star"
                          size={10}
                          color={idx < Math.floor(rev.rating) ? '#EAB308' : '#D1D5DB'}
                        />
                      ))}
                    </View>
                  </View>
                  <Text className="text-zinc-500 text-xs font-medium leading-relaxed">
                    "{rev.comment}"
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View className="bg-zinc-50 border border-zinc-100 p-4 rounded-2xl items-center">
              <Text className="text-zinc-400 text-xs font-medium">No reviews yet for this workout category.</Text>
            </View>
          )}
        </View>

        {/* 7. FAQs Section */}
        {workout.faqs && workout.faqs.length > 0 && (
          <View className="gap-3 mb-8">
            <Text className="text-primary text-base font-extrabold tracking-tight">Frequently Asked Questions</Text>
            <View className="gap-2">
              {workout.faqs.map((faq, i) => {
                const isExpanded = expandedFaq === i;
                return (
                  <View key={i} className="border border-zinc-100 rounded-2xl overflow-hidden">
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => toggleFaq(i)}
                      className="bg-zinc-50/50 px-4 py-4 flex-row justify-between items-center"
                    >
                      <Text className="text-primary text-xs font-extrabold flex-1 pr-4">{faq.question}</Text>
                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color="#71717A"
                      />
                    </TouchableOpacity>
                    {isExpanded && (
                      <View className="bg-white px-4 py-3.5 border-t border-zinc-100">
                        <Text className="text-zinc-500 text-xs font-medium leading-relaxed">
                          {faq.answer}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}

      </View>
    </ScrollView>
  );
}
