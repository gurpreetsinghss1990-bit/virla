import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

interface DatePickerProps {
  selectedDate: string; // E.g., "Jul 16"
  onSelect: (dateStr: string) => void;
}

export function DatePicker({ selectedDate, onSelect }: DatePickerProps) {
  // Helper to generate next 30 days starting from today
  const generateDates = () => {
    const dates = [];
    const today = new Date();
    
    for (let i = 0; i < 30; i++) {
      const futureDate = new Date(today);
      futureDate.setDate(today.getDate() + i);
      
      const dayName = futureDate.toLocaleDateString('en-US', { weekday: 'short' }); // "Mon"
      const dayNum = futureDate.getDate(); // 20
      const monthName = futureDate.toLocaleDateString('en-US', { month: 'short' }); // "Jul"
      const year = futureDate.getFullYear();
      
      const dayOfWeek = futureDate.getDay(); // 0 is Sunday, 6 is Saturday
      const isUnavailable = dayOfWeek === 0 || dayOfWeek === 6; // Mock unavailable: Weekends disabled
      
      const formatted = `${monthName} ${dayNum}`; // "Jul 20"
      
      dates.push({
        id: `${year}-${monthName}-${dayNum}`,
        dayName,
        dayNum,
        monthName,
        formatted,
        isUnavailable,
      });
    }
    
    return dates;
  };

  const dateList = generateDates();

  return (
    <View className="w-full">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 4 }}
        className="flex-row"
      >
        {dateList.map((date) => {
          const isSelected = selectedDate === date.formatted;
          
          if (date.isUnavailable) {
            // Render Disabled/Greyed out Weekend Date Card
            return (
              <View
                key={date.id}
                className="bg-zinc-50 border border-zinc-100 p-4 rounded-2xl w-16 items-center mr-3 opacity-30 justify-center"
              >
                <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">{date.dayName}</Text>
                <Text className="text-zinc-400 text-lg font-black mt-1.5">{date.dayNum}</Text>
                <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-1">{date.monthName}</Text>
              </View>
            );
          }

          return (
            <TouchableOpacity
              key={date.id}
              activeOpacity={0.8}
              onPress={() => onSelect(date.formatted)}
              className={`p-4 rounded-2xl w-16 items-center mr-3 justify-center border-2 ${
                isSelected 
                  ? 'bg-zinc-900 border-zinc-900 shadow-sm' 
                  : 'bg-white border-zinc-100'
              }`}
            >
              <Text className={`text-[10px] font-bold uppercase tracking-wider ${
                isSelected ? 'text-zinc-400' : 'text-zinc-400'
              }`}>
                {date.dayName}
              </Text>
              <Text className={`text-lg font-black mt-1.5 ${
                isSelected ? 'text-white' : 'text-primary'
              }`}>
                {date.dayNum}
              </Text>
              <Text className={`text-[8px] font-bold uppercase mt-1 ${
                isSelected ? 'text-orange-400' : 'text-zinc-400'
              }`}>
                {date.monthName}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
