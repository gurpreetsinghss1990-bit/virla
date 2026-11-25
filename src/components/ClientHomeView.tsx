import React from 'react';
import {
  ClientRecoveryHeroCard,
  ClientWorkoutCategoriesSection,
  ClientTopTrainersSection,
  ClientTodayOverviewSection,
  ClientAIWellnessSection,
  ClientUpcomingSessionSection,
} from './home';

interface ClientHomeViewProps {
  greeting: { title: string; subtitle?: string };
  user: { id?: string | null };
  recoveryVal: number;
  userRecovery: number | null;
  recoveryStatus: { title: string; desc: string };
  membership: {
    tier?: string;
    availableCredits: number;
    totalCredits: number;
  };
  caloriesToday: number;
  caloriesGoal: number;
  waterMl: number;
  waterGoal: number;
  streak: number;
  weeklyStreakGoal: number;
  savedPlan: any;
  upcomingBookings: any[];
  activeBooking: any;
  topPerformingTrainers: any[];
  onWorkoutScroll: (event: any) => void;
  onTrainerScroll: (event: any) => void;
  handleLogCalories: () => void;
  handleLogWater: () => void;
  navigateSafely: (target: any) => void;
  trainerPhotoSource: (id?: string | null, photo?: string | null) => any;
  getWorkoutEmoji: (title: string) => string;
  getDisplayWorkoutTitle: (title: string) => string;
  formatToDDMMYYYY: (dateStr: string) => string;
  setActivePartnerBookingId: (id: string) => void;
  setPartnerModalVisible: (visible: boolean) => void;
}

export const ClientHomeView: React.FC<ClientHomeViewProps> = ({
  greeting,
  user,
  recoveryVal,
  userRecovery,
  recoveryStatus,
  membership,
  caloriesToday,
  caloriesGoal,
  waterMl,
  waterGoal,
  streak,
  weeklyStreakGoal,
  savedPlan,
  upcomingBookings,
  activeBooking,
  topPerformingTrainers,
  onWorkoutScroll,
  onTrainerScroll,
  handleLogCalories,
  handleLogWater,
  navigateSafely,
  trainerPhotoSource,
  getWorkoutEmoji,
  getDisplayWorkoutTitle,
  formatToDDMMYYYY,
  setActivePartnerBookingId,
  setPartnerModalVisible,
}) => {
  return (
    <>
      {/* 1. Greeting & Recovery Hero Card */}
      <ClientRecoveryHeroCard
        greeting={greeting}
        user={user}
        recoveryVal={recoveryVal}
        userRecovery={userRecovery}
        recoveryStatus={recoveryStatus}
        membership={membership}
        navigateSafely={navigateSafely}
      />

      {/* 2. Choose Your Workout Section */}
      <ClientWorkoutCategoriesSection
        onWorkoutScroll={onWorkoutScroll}
        navigateSafely={navigateSafely}
      />

      {/* 3. Top Performing Trainers Section */}
      <ClientTopTrainersSection
        activeBooking={activeBooking}
        topPerformingTrainers={topPerformingTrainers}
        onTrainerScroll={onTrainerScroll}
        navigateSafely={navigateSafely}
        trainerPhotoSource={trainerPhotoSource}
        getWorkoutEmoji={getWorkoutEmoji}
        getDisplayWorkoutTitle={getDisplayWorkoutTitle}
      />

      {/* 4. Today's Overview Section */}
      <ClientTodayOverviewSection
        caloriesToday={caloriesToday}
        caloriesGoal={caloriesGoal}
        waterMl={waterMl}
        waterGoal={waterGoal}
        membership={membership}
        streak={streak}
        weeklyStreakGoal={weeklyStreakGoal}
        handleLogCalories={handleLogCalories}
        handleLogWater={handleLogWater}
        navigateSafely={navigateSafely}
      />

      {/* 5. AI Wellness Coach Section */}
      <ClientAIWellnessSection
        savedPlan={savedPlan}
        upcomingBookings={upcomingBookings}
        formatToDDMMYYYY={formatToDDMMYYYY}
        navigateSafely={navigateSafely}
      />

      {/* 6. Upcoming Session Section */}
      <ClientUpcomingSessionSection
        upcomingBookings={upcomingBookings}
        formatToDDMMYYYY={formatToDDMMYYYY}
        getDisplayWorkoutTitle={getDisplayWorkoutTitle}
        trainerPhotoSource={trainerPhotoSource}
        setActivePartnerBookingId={setActivePartnerBookingId}
        setPartnerModalVisible={setPartnerModalVisible}
        navigateSafely={navigateSafely}
      />
    </>
  );
};
