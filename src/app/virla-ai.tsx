import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, Animated, Platform, KeyboardAvoidingView, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useAIWellnessStore, AIWellnessPlan } from '../store/aiWellnessStore';
import { Feather, Ionicons } from '@expo/vector-icons';

export default function VirlaAIScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { savedPlan, savePlan, clearPlan } = useAIWellnessStore();

  // Onboarding Wizard Step (1: Welcome, 2-11: Questions, 12: Plan)
  const [step, setStep] = useState(1);

  // Form State Variables
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Male');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [fitnessGoal, setFitnessGoal] = useState('General Fitness');
  const [activityLevel, setActivityLevel] = useState('Moderately Active');
  const [workoutFrequency, setWorkoutFrequency] = useState('3');
  const [preferredDuration, setPreferredDuration] = useState('45 min');
  const [wakeupTime, setWakeupTime] = useState('06:30 AM');
  const [sleepTime, setSleepTime] = useState('10:30 PM');
  const [selectedLifestyle, setSelectedLifestyle] = useState<string[]>([]);
  const [foodPreference, setFoodPreference] = useState('Vegetarian');
  const [selectedRestrictions, setSelectedRestrictions] = useState<string[]>(['No Restrictions']);
  const [selectedConditions, setSelectedConditions] = useState<string[]>(['None']);
  const [waterIntake, setWaterIntake] = useState('3 Liters');
  const [selectedSupplements, setSelectedSupplements] = useState<string[]>([]);

  // Generation loading states
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [loadingText, setLoadingText] = useState('Analyzing body metrics...');
  const [generatedPlan, setGeneratedPlan] = useState<AIWellnessPlan | null>(null);

  // Animation values
  const [fadeAnim] = useState(() => new Animated.Value(1));

  // If a plan already exists, default to displaying it
  useEffect(() => {
    if (savedPlan) {
      setTimeout(() => setGeneratedPlan(savedPlan), 0);
    } else {
      setTimeout(() => {
        setGeneratedPlan(null);
        setStep(1);
      }, 0);
    }
  }, [savedPlan]);

  const handleNext = () => {
    // Basic screen validations
    if (step === 2) {
      if (!age.trim() || !height.trim() || !weight.trim()) {
        Alert.alert('Incomplete Profile', 'Please fill in all your body metric measurements.');
        return;
      }
      const ageVal = parseInt(age);
      const hVal = parseInt(height);
      const wVal = parseInt(weight);
      if (isNaN(ageVal) || ageVal < 10 || ageVal > 100) {
        Alert.alert('Invalid Age', 'Please enter a valid age between 10 and 100.');
        return;
      }
      if (isNaN(hVal) || hVal < 100 || hVal > 250) {
        Alert.alert('Invalid Height', 'Please enter a valid height in cm (100 - 250 cm).');
        return;
      }
      if (isNaN(wVal) || wVal < 30 || wVal > 250) {
        Alert.alert('Invalid Weight', 'Please enter a valid weight in kg (30 - 250 kg).');
        return;
      }
    }

    if (step === 6) {
      if (!wakeupTime.trim() || !sleepTime.trim()) {
        Alert.alert('Incomplete Fields', 'Please specify your sleep and wake-up timings.');
        return;
      }
    }

    // Trigger step transition animation
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true })
    ]).start();

    if (step < 11) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true })
    ]).start();

    if (step > 1) {
      setStep(step - 1);
    }
  };

  const toggleTag = (tag: string, list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>) => {
    if (tag === 'No Restrictions' || tag === 'None') {
      setList([tag]);
      return;
    }
    
    setList(prev => {
      const filtered = prev.filter(item => item !== 'No Restrictions' && item !== 'None');
      if (filtered.includes(tag)) {
        const next = filtered.filter(item => item !== tag);
        return next.length === 0 ? (tag === 'None' ? ['None'] : ['No Restrictions']) : next;
      } else {
        return [...filtered, tag];
      }
    });
  };

  const toggleLifestyle = (tag: string) => {
    setSelectedLifestyle(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleGenerate = () => {
    setIsGenerating(true);
    setGenerationProgress(0);
    setLoadingText('Analyzing body metrics...');

    const interval = setInterval(() => {
      setGenerationProgress(prev => {
        const next = prev + 25;
        if (next === 25) setLoadingText('Calculating BMR & calorie targets...');
        if (next === 50) setLoadingText('Personalizing macronutrient splits...');
        if (next === 75) setLoadingText('Crafting adaptive meal & recovery routine...');
        if (next >= 100) {
          clearInterval(interval);
          const computedPlan = runWellnessGenerator();
          setGeneratedPlan(computedPlan);
          setIsGenerating(false);
          setStep(12);
        }
        return next;
      });
    }, 550);
  };

  const runWellnessGenerator = (): AIWellnessPlan => {
    const wVal = parseFloat(weight) || 70;
    const hVal = parseFloat(height) || 170;
    const aVal = parseFloat(age) || 28;

    // BMR Mifflin-St Jeor Equation
    let bmr = 10 * wVal + 6.25 * hVal - 5 * aVal;
    if (gender === 'Male') bmr += 5;
    else if (gender === 'Female') bmr -= 161;
    else bmr -= 80;

    // Activity Multiplier
    let multiplier = 1.375; // Lightly Active default
    if (activityLevel === 'Sedentary') multiplier = 1.2;
    else if (activityLevel === 'Moderately Active') multiplier = 1.55;
    else if (activityLevel === 'Active') multiplier = 1.725;
    else if (activityLevel === 'Athlete') multiplier = 1.9;

    const tdee = bmr * multiplier;

    // Adjust for Goal
    let calorieGoal = Math.round(tdee);
    if (fitnessGoal === 'Weight Loss' || fitnessGoal === 'Fat Loss') {
      calorieGoal = Math.round(tdee - 450);
    } else if (fitnessGoal === 'Muscle Gain') {
      calorieGoal = Math.round(tdee + 350);
    } else if (fitnessGoal === 'Strength' || fitnessGoal === 'Sports Performance') {
      calorieGoal = Math.round(tdee + 150);
    }
    calorieGoal = Math.max(1200, calorieGoal);

    // Protein Target
    let proteinMultiplier = 1.6;
    if (fitnessGoal === 'Muscle Gain' || fitnessGoal === 'Strength' || fitnessGoal === 'Sports Performance') {
      proteinMultiplier = 2.0;
    }
    const proteinTarget = Math.round(wVal * proteinMultiplier);

    // Fat Target (25% of calories)
    const fatCalories = calorieGoal * 0.25;
    const fatTarget = Math.round(fatCalories / 9);

    // Carbs Target (Remaining calories)
    const carbCalories = calorieGoal - (proteinTarget * 4) - (fatTarget * 9);
    const carbTarget = Math.max(50, Math.round(carbCalories / 4));

    // Hydration Goal
    let lit = Math.round(wVal * 0.035 * 10) / 10;
    if (activityLevel === 'Active' || activityLevel === 'Athlete') lit += 0.5;
    const hydrationGoal = `${lit.toFixed(1)} Liters daily`;

    // Food Suggestions lists
    let breakfast = ['Oatmeal with berries & chia seeds', 'Scrambled tofu with vegetables', 'Boiled eggs & sliced avocado'];
    let lunch = ['Brown rice with mixed dal, tofu and broccoli', 'Chickpea & quinoa salad bowl', 'Roti with paneer sabzi & sprouts'];
    let dinner = ['Sautéed tofu with bell peppers & mushrooms', 'Lentil soup with spinach & sweet potato', 'Stir-fry vegetables & cottage cheese'];
    let snacks = ['Handful of mixed walnuts & almonds', 'Roasted makhana', 'Cucumber sticks with home-made hummus'];

    if (foodPreference === 'Vegan') {
      breakfast = ['Oatmeal with almonds & pumpkin seeds', 'Tofu scramble with spinach & rye toast', 'Chia seeds pudding with soy milk'];
      lunch = ['Lentil soup with sweet potato & quinoa', 'Chickpea & avocado salad bowl', 'Sautéed mushrooms & kidney beans'];
      dinner = ['Tofu & broccoli stir-fry with brown rice', 'Quinoa khichdi with mixed vegetables', 'Bean soup with roasted cauliflower'];
    } else if (foodPreference === 'Eggitarian') {
      breakfast = ['Egg white omelette with spinach & toast', 'Double boiled eggs with oatmeal', 'Scrambled eggs & berries'];
      lunch = ['Chickpea quinoa salad bowl', 'Egg bhurji with roti & green salad', 'Lentil soup with cottage cheese'];
      dinner = ['Stir-fry egg whites with beans & veggies', 'Baked sweet potato with eggs', 'Quinoa khichdi'];
    } else if (foodPreference === 'Non-Vegetarian') {
      breakfast = ['Egg white omelette with chicken breast strips', 'Greek yogurt with berries & honey', 'Oatmeal & boiled eggs'];
      lunch = ['Grilled chicken breast with broccoli & brown rice', 'Salmon filet with sweet potato', 'Turkey wrap with salad'];
      dinner = ['Baked fish with asparagus & quinoa', 'Grilled chicken salad with almonds', 'Minced turkey stir-fry with beans'];
    } else if (foodPreference === 'Jain') {
      breakfast = ['Oatmeal with banana & walnuts', 'Milk with almonds & saffron', 'Kuttu (Buckwheat) chilla'];
      lunch = ['Moong dal khichdi with parwal sabzi', 'Roti with raw banana curry & green salad', 'Rice with tur dal & cabbage'];
      dinner = ['Sautéed paneer with beans & bell peppers', 'Quinoa vegetable soup (before sunset)', 'Rice chilla with mung salad'];
      snacks = ['Almonds & raisins', 'Roasted makhana', 'Cucumber slices'];
    }

    // Filter by allergies/dietary restrictions
    if (selectedRestrictions.includes('Lactose Intolerant')) {
      breakfast = breakfast.map(x => x.replace(/paneer|yogurt|milk|cottage cheese/gi, 'almond milk / tofu'));
      lunch = lunch.map(x => x.replace(/paneer|yogurt|milk|cottage cheese/gi, 'almond milk / tofu'));
      dinner = dinner.map(x => x.replace(/paneer|yogurt|milk|cottage cheese/gi, 'almond milk / tofu'));
    }
    if (selectedRestrictions.includes('Gluten Free')) {
      breakfast = breakfast.map(x => x.replace(/toast|oatmeal|bread/gi, 'gluten-free oats / rice wrap'));
      lunch = lunch.map(x => x.replace(/roti|paratha/gi, 'brown rice / quinoa'));
      dinner = dinner.map(x => x.replace(/roti|paratha/gi, 'brown rice / quinoa'));
    }

    // Workout Recommendation
    let workout = 'Functional cardio: 3 days cardiovascular circuits + 2 days mobility/stretching';
    if (fitnessGoal === 'Muscle Gain' || fitnessGoal === 'Strength') {
      workout = `Hypertrophy focus: Progressive overload weight training ${workoutFrequency} days per week, prioritising recovery`;
    } else if (fitnessGoal === 'Weight Loss' || fitnessGoal === 'Fat Loss') {
      workout = `HIIT & Strength split: High energy circuits ${workoutFrequency} days/wk + Daily step targets`;
    } else if (fitnessGoal === 'Flexibility') {
      workout = 'Active stretching & Vinyasa flows 4 days/wk with focus on joints mobility';
    }

    // Step Goal
    let stepGoal = 8000;
    if (activityLevel === 'Active') stepGoal = 10000;
    else if (activityLevel === 'Athlete') stepGoal = 12000;

    // Sleep timing recommendation
    const sleepRec = `7.5 - 8.5 hours. Maintain consistent sleep at ${sleepTime} and wake up at ${wakeupTime}.`;

    // Progress Targets
    let progress = ['Log daily water intake targets', 'Maintain workout consistency this week', 'Complete daily step goals'];
    if (fitnessGoal === 'Weight Loss' || fitnessGoal === 'Fat Loss') {
      progress = ['Maintain calorie deficit of 400 kcal', 'Complete all scheduled HIIT cycles', 'Log morning body weight'];
    } else if (fitnessGoal === 'Muscle Gain') {
      progress = ['Log targets of 1.8g+ protein / kg bodyweight', 'Complete progressively heavier lifts', 'Secure 8 hours of sleep'];
    }

    return {
      age,
      gender,
      height,
      weight,
      fitnessGoal,
      activityLevel,
      workoutFrequency,
      preferredDuration,
      wakeupTime,
      sleepTime,
      lifestyle: selectedLifestyle,
      foodPreference,
      dietRestrictions: selectedRestrictions,
      medicalConditions: selectedConditions,
      waterIntake,
      supplements: selectedSupplements,
      dailyCalories: calorieGoal,
      proteinTarget,
      carbTarget,
      fatTarget,
      hydrationGoal,
      mealTiming: selectedLifestyle.includes('Shift Worker') ? 'Shift timing adjusted' : 'Regular consistent pacing',
      breakfastSuggestions: breakfast,
      lunchSuggestions: lunch,
      dinnerSuggestions: dinner,
      snackSuggestions: snacks,
      workoutRecommendation: workout,
      dailyStepGoal: stepGoal,
      sleepRecommendation: sleepRec,
      recoveryAdvice: 'Perform light stretching routines daily post-workout. Take 1-2 rest days weekly.',
      weeklyProgressGoals: progress,
      generatedAt: Date.now()
    };
  };

  const handleSavePlan = () => {
    if (generatedPlan) {
      savePlan(generatedPlan);
      Alert.alert('Plan Saved Successfully', 'Your AI Wellness Plan is updated and active.', [
        { text: 'Okay', onPress: () => router.back() }
      ]);
    }
  };

  const handleRegenerate = () => {
    clearPlan();
    setGeneratedPlan(null);
    setStep(1);
  };

  // Helper arrays for questionnaire choices
  const goalsList = ['Weight Loss', 'Fat Loss', 'Muscle Gain', 'Strength', 'General Fitness', 'Flexibility', 'Endurance', 'Sports Performance'];
  const activityList = ['Sedentary', 'Lightly Active', 'Moderately Active', 'Active', 'Athlete'];
  const durationList = ['30 min', '45 min', '60 min', '90 min'];
  const lifestyleList = ['Office Job', 'Work From Home', 'Student', 'Shift Worker', 'Travel Frequently'];
  const foodPrefs = ['Vegetarian', 'Vegan', 'Eggitarian', 'Non-Vegetarian', 'Jain', 'Other'];
  const restrictionsList = ['Diabetes', 'Hypertension', 'High Cholesterol', 'Lactose Intolerant', 'Gluten Free', 'Nut Allergy', 'No Restrictions'];
  const conditionsList = ['Lower Back Pain', 'Knee Stiffness', 'Asthma', 'Thyroid', 'None'];
  const waterList = ['1.5 Liters', '2 Liters', '3 Liters', '4 Liters+'];
  const supplementsList = ['Protein', 'Creatine', 'Multivitamins', 'Omega-3', 'Other'];

  const progressPercent = step === 1 ? 8 : Math.min(100, Math.round(((step - 1) / 10) * 100));

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: '#FFFFFF' }}
    >
      <StatusBar style="dark" />

      {/* Unified Header & Status Bar Area - Eliminates Top Bleed */}
      <View style={{ paddingTop: insets.top, backgroundColor: '#FFFFFF' }} className="z-10">
        <View className="h-14 flex-row items-center px-4 justify-between">
          {step > 1 && !generatedPlan ? (
            <TouchableOpacity 
              onPress={handleBack} 
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              className="w-10 h-10 items-center justify-center"
            >
              <Ionicons name="arrow-back" size={22} color="#101828" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              onPress={() => router.back()} 
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              className="w-10 h-10 items-center justify-center"
            >
              <Ionicons name="close" size={22} color="#101828" />
            </TouchableOpacity>
          )}

          <View className="flex-1 items-center px-2">
            {generatedPlan ? (
              <>
                <Text className="text-[10px] font-bold uppercase text-[#E11D48]">
                  VIRLA PROTOCOL
                </Text>
                <Text className="text-[#101828] text-sm font-bold mt-0.5 text-center">
                  My AI Wellness Plan
                </Text>
              </>
            ) : (
              <Text className="text-[#101828] text-base font-bold text-center">
                AI Wellness Coach
              </Text>
            )}
          </View>

          {generatedPlan ? (
            <TouchableOpacity
              onPress={handleRegenerate}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              className="w-10 h-10 items-center justify-center"
            >
              <Feather name="refresh-cw" size={16} color="#101828" />
            </TouchableOpacity>
          ) : step > 1 ? (
            <View className="px-2.5 py-1 rounded-full bg-rose-50 border border-rose-100">
              <Text className="text-[10px] font-bold text-[#E11D48]">
                {step - 1}/10
              </Text>
            </View>
          ) : (
            <View className="w-10" />
          )}
        </View>

        {/* Wizard Top Progress Bar (Only during active questions 2-11) */}
        {step > 1 && !generatedPlan && !isGenerating && (
          <View className="w-full h-[2px] bg-zinc-100">
            <View
              className="h-full bg-[#E11D48]"
              style={{ width: `${progressPercent}%` }}
            />
          </View>
        )}
      </View>

      {/* Screen Body */}
      <View style={{ flex: 1, backgroundColor: '#F8F9FB' }}>
        {isGenerating ? (
          /* ========================================== */
          /* ============= GENERATION LOADER ============ */
          /* ========================================== */
          <View className="flex-1 justify-center items-center px-6">
            <View className="p-8 bg-white border border-zinc-200 rounded-[32px] items-center gap-6 shadow-sm w-full max-w-sm">
              <View className="w-16 h-16 rounded-full bg-rose-50 border border-rose-100 items-center justify-center">
                <Feather name="cpu" size={28} color="#E11D48" />
              </View>
              
              <View className="items-center gap-1.5">
                <Text className="text-zinc-900 text-lg font-bold text-center">{loadingText}</Text>
                <Text className="text-zinc-500 text-xs font-medium text-center">
                  Calculating tailored targets with Mifflin-St Jeor engine
                </Text>
              </View>
              
              {/* Progress bar container */}
              <View className="w-full gap-2">
                <View className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                  <View 
                    className="h-full bg-[#E11D48] rounded-full"
                    style={{ width: `${generationProgress}%` }}
                  />
                </View>
                <View className="flex-row justify-between items-center px-1">
                  <Text className="text-zinc-400 text-[10px] font-bold uppercase">Compiling Protocol</Text>
                  <Text className="text-[#E11D48] text-xs font-bold">{generationProgress}%</Text>
                </View>
              </View>
            </View>
          </View>
        ) : generatedPlan ? (
          /* ========================================== */
          /* ============= ACTIVE PLAN VIEW ============ */
          /* ========================================== */
          <ScrollView 
            showsVerticalScrollIndicator={false} 
            contentContainerStyle={{ 
              padding: 20, 
              paddingBottom: Math.max(insets.bottom, 24) + 40 
            }}
          >
            <View className="gap-5">
              {/* Header Info - Hero Obsidian Card */}
              <View className="bg-[#0B0F19] p-6 rounded-[28px] border border-zinc-800 gap-4 shadow-sm">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <Feather name="zap" size={13} color="#EC4899" />
                    <Text className="text-white/70 text-[10px] font-bold uppercase">Calculated Targets</Text>
                  </View>
                  <View className="px-2.5 py-0.5 rounded-full bg-white/10 border border-white/10">
                    <Text className="text-white/80 text-[10px] font-bold uppercase">{generatedPlan.fitnessGoal}</Text>
                  </View>
                </View>

                <View className="flex-row justify-between items-baseline mt-1">
                  <Text className="text-white text-3xl font-bold">{generatedPlan.dailyCalories.toLocaleString()} kcal</Text>
                  <Text className="text-zinc-400 text-xs font-medium">Daily Calorie Target</Text>
                </View>

                {/* Macro progress sliders */}
                <View className="gap-3 mt-2 pt-3 border-t border-zinc-800">
                  <View className="gap-1.5">
                    <View className="flex-row justify-between">
                      <Text className="text-zinc-400 text-[10px] font-bold uppercase">Protein</Text>
                      <Text className="text-white text-xs font-bold">{generatedPlan.proteinTarget}g</Text>
                    </View>
                    <View className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <View className="h-full bg-rose-500 rounded-full" style={{ width: '40%' }} />
                    </View>
                  </View>

                  <View className="gap-1.5">
                    <View className="flex-row justify-between">
                      <Text className="text-zinc-400 text-[10px] font-bold uppercase">Carbohydrates</Text>
                      <Text className="text-white text-xs font-bold">{generatedPlan.carbTarget}g</Text>
                    </View>
                    <View className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <View className="h-full bg-indigo-500 rounded-full" style={{ width: '45%' }} />
                    </View>
                  </View>

                  <View className="gap-1.5">
                    <View className="flex-row justify-between">
                      <Text className="text-zinc-400 text-[10px] font-bold uppercase">Fats</Text>
                      <Text className="text-white text-xs font-bold">{generatedPlan.fatTarget}g</Text>
                    </View>
                    <View className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <View className="h-full bg-amber-500 rounded-full" style={{ width: '30%' }} />
                    </View>
                  </View>
                </View>

                {/* Quick stats pills */}
                <View className="flex-row justify-between pt-3 border-t border-zinc-800 gap-2">
                  <View className="flex-1 bg-white/5 rounded-2xl p-2.5 items-center border border-white/5">
                    <Text className="text-zinc-400 text-[9px] font-bold uppercase">Daily Steps</Text>
                    <Text className="text-white text-xs font-bold mt-0.5">{generatedPlan.dailyStepGoal.toLocaleString()}</Text>
                  </View>
                  <View className="flex-1 bg-white/5 rounded-2xl p-2.5 items-center border border-white/5">
                    <Text className="text-zinc-400 text-[9px] font-bold uppercase">Water Goal</Text>
                    <Text className="text-emerald-400 text-xs font-bold mt-0.5">{generatedPlan.hydrationGoal.split(' ')[0]} L</Text>
                  </View>
                  <View className="flex-1 bg-white/5 rounded-2xl p-2.5 items-center border border-white/5">
                    <Text className="text-zinc-400 text-[9px] font-bold uppercase">Frequency</Text>
                    <Text className="text-white text-xs font-bold mt-0.5">{generatedPlan.workoutFrequency} days/wk</Text>
                  </View>
                </View>
              </View>

              {/* Workout Routine Card */}
              <View className="bg-white border border-zinc-200 p-6 rounded-[28px] gap-4 shadow-sm">
                <View className="flex-row items-center gap-2.5 border-b border-zinc-100 pb-3">
                  <View className="w-8 h-8 rounded-full bg-rose-50 items-center justify-center">
                    <Feather name="activity" size={15} color="#E11D48" />
                  </View>
                  <View>
                    <Text className="text-zinc-900 text-xs font-bold uppercase">Fitness & Training Routine</Text>
                    <Text className="text-zinc-400 text-[10px] font-medium">Calibrated for {generatedPlan.preferredDuration} sessions</Text>
                  </View>
                </View>

                <View className="gap-3">
                  <View className="gap-1 bg-zinc-50 p-3.5 rounded-2xl border border-zinc-100">
                    <Text className="text-zinc-400 text-[9px] font-bold uppercase">Recommended Routine</Text>
                    <Text className="text-zinc-800 text-xs font-semibold leading-relaxed mt-0.5">{generatedPlan.workoutRecommendation}</Text>
                  </View>
                </View>
              </View>

              {/* Diet Suggestions Card */}
              <View className="bg-white border border-zinc-200 p-6 rounded-[28px] gap-4 shadow-sm">
                <View className="flex-row items-center gap-2.5 border-b border-zinc-100 pb-3">
                  <View className="w-8 h-8 rounded-full bg-rose-50 items-center justify-center">
                    <Feather name="heart" size={15} color="#E11D48" />
                  </View>
                  <View>
                    <Text className="text-zinc-900 text-xs font-bold uppercase">Daily Meal Plan Suggestions</Text>
                    <Text className="text-zinc-400 text-[10px] font-medium">Adapted for {generatedPlan.foodPreference} preference</Text>
                  </View>
                </View>

                <View className="gap-3">
                  <View className="gap-1 bg-zinc-50 p-3.5 rounded-2xl border border-zinc-100">
                    <Text className="text-rose-600 text-[10px] font-bold uppercase">Breakfast</Text>
                    {(generatedPlan.breakfastSuggestions || []).map((x, i) => (
                      <Text key={i} className="text-zinc-700 text-xs font-medium leading-relaxed">• {x}</Text>
                    ))}
                  </View>
                  <View className="gap-1 bg-zinc-50 p-3.5 rounded-2xl border border-zinc-100">
                    <Text className="text-rose-600 text-[10px] font-bold uppercase">Lunch</Text>
                    {(generatedPlan.lunchSuggestions || []).map((x, i) => (
                      <Text key={i} className="text-zinc-700 text-xs font-medium leading-relaxed">• {x}</Text>
                    ))}
                  </View>
                  <View className="gap-1 bg-zinc-50 p-3.5 rounded-2xl border border-zinc-100">
                    <Text className="text-rose-600 text-[10px] font-bold uppercase">Dinner</Text>
                    {(generatedPlan.dinnerSuggestions || []).map((x, i) => (
                      <Text key={i} className="text-zinc-700 text-xs font-medium leading-relaxed">• {x}</Text>
                    ))}
                  </View>
                  <View className="gap-1 bg-zinc-50 p-3.5 rounded-2xl border border-zinc-100">
                    <Text className="text-rose-600 text-[10px] font-bold uppercase">Healthy Snacks</Text>
                    {(generatedPlan.snackSuggestions || []).map((x, i) => (
                      <Text key={i} className="text-zinc-700 text-xs font-medium leading-relaxed">• {x}</Text>
                    ))}
                  </View>
                </View>
              </View>

              {/* Lifestyle & Recovery Advice */}
              <View className="bg-white border border-zinc-200 p-6 rounded-[28px] gap-4 shadow-sm">
                <View className="flex-row items-center gap-2.5 border-b border-zinc-100 pb-3">
                  <View className="w-8 h-8 rounded-full bg-rose-50 items-center justify-center">
                    <Feather name="moon" size={15} color="#E11D48" />
                  </View>
                  <View>
                    <Text className="text-zinc-900 text-xs font-bold uppercase">Lifestyle & Recovery</Text>
                    <Text className="text-zinc-400 text-[10px] font-medium">Sleep and restorative habits</Text>
                  </View>
                </View>

                <View className="gap-3">
                  <View className="gap-1 bg-zinc-50 p-3.5 rounded-2xl border border-zinc-100">
                    <Text className="text-zinc-400 text-[9px] font-bold uppercase">Sleep Routine</Text>
                    <Text className="text-zinc-800 text-xs font-semibold leading-relaxed mt-0.5">{generatedPlan.sleepRecommendation || '8 hours of restful sleep'}</Text>
                  </View>
                  <View className="gap-1 bg-zinc-50 p-3.5 rounded-2xl border border-zinc-100">
                    <Text className="text-zinc-400 text-[9px] font-bold uppercase">Recovery Advice</Text>
                    <Text className="text-zinc-800 text-xs font-semibold leading-relaxed mt-0.5">{generatedPlan.recoveryAdvice || 'Light stretching post workout'}</Text>
                  </View>
                </View>
              </View>

              {/* Weekly progress milestones */}
              <View className="bg-white border border-zinc-200 p-6 rounded-[28px] gap-4 shadow-sm">
                <View className="flex-row items-center gap-2.5 border-b border-zinc-100 pb-3">
                  <View className="w-8 h-8 rounded-full bg-rose-50 items-center justify-center">
                    <Feather name="check-circle" size={15} color="#E11D48" />
                  </View>
                  <Text className="text-zinc-900 text-xs font-bold uppercase">Weekly Progress Goals</Text>
                </View>

                <View className="gap-2.5">
                  {(generatedPlan.weeklyProgressGoals || []).map((g, idx) => (
                    <View key={idx} className="flex-row items-center gap-3 bg-zinc-50 p-3 rounded-xl border border-zinc-100">
                      <Feather name="check" size={14} color="#10B981" />
                      <Text className="text-zinc-800 text-xs font-semibold flex-1">{g}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Save Plan or Regenerate actions */}
              <View className="gap-3 mt-2">
                {!savedPlan && (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleSavePlan}
                    className="w-full bg-[#E11D48] py-4 rounded-[20px] items-center justify-center shadow-sm flex-row gap-2"
                  >
                    <Feather name="check" size={16} color="#FFFFFF" />
                    <Text className="text-white text-sm font-bold uppercase">Save & Activate Plan</Text>
                  </TouchableOpacity>
                )}
                
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handleRegenerate}
                  className="w-full bg-white border border-zinc-200 py-4 rounded-[20px] items-center justify-center shadow-sm"
                >
                  <Text className="text-zinc-700 text-sm font-bold uppercase">Retake Questionnaire</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        ) : (
          /* ========================================== */
          /* ============= ONBOARDING STEPS ============= */
          /* ========================================== */
          <ScrollView 
            showsVerticalScrollIndicator={false} 
            contentContainerStyle={{ 
              padding: 20, 
              paddingBottom: Math.max(insets.bottom, 24) + 40 
            }}
          >
            <Animated.View style={{ opacity: fadeAnim, gap: 20 }}>
              
              {/* STEP 1: Welcome Intro */}
              {step === 1 && (
                <View className="gap-6 pt-2 px-1">
                  <View className="items-center my-1">
                    <Image
                      source={require('../../assets/images/ai-coach-emblem.png')}
                      style={{ width: 96, height: 96 }}
                      resizeMode="contain"
                    />
                  </View>
                  
                  <View className="gap-2 items-center px-2">
                    <Text className="text-zinc-900 text-2xl font-bold text-center leading-tight">
                      Create Your AI Wellness Plan
                    </Text>
                    <Text className="text-zinc-500 text-sm text-center leading-relaxed">
                      Answer 10 quick lifestyle questions so VIRLA AI can calculate your personalized macro targets, hydration, and training routine.
                    </Text>
                  </View>

                  {/* Feature Highlights - Clean layout without horizontal lines */}
                  <View className="gap-4 my-2">
                    <View className="flex-row items-center gap-3.5">
                      <View className="w-10 h-10 rounded-full bg-rose-50 items-center justify-center border border-rose-100">
                        <Feather name="target" size={16} color="#E11D48" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-zinc-900 text-sm font-bold">Personalized Caloric Targets</Text>
                        <Text className="text-zinc-500 text-xs leading-relaxed mt-0.5">Calculated with scientific BMR and activity equations</Text>
                      </View>
                    </View>

                    <View className="flex-row items-center gap-3.5">
                      <View className="w-10 h-10 rounded-full bg-rose-50 items-center justify-center border border-rose-100">
                        <Feather name="pie-chart" size={16} color="#E11D48" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-zinc-900 text-sm font-bold">Tailored Macro & Meal Guidance</Text>
                        <Text className="text-zinc-500 text-xs leading-relaxed mt-0.5">Custom meal splits respecting your dietary restrictions</Text>
                      </View>
                    </View>

                    <View className="flex-row items-center gap-3.5">
                      <View className="w-10 h-10 rounded-full bg-rose-50 items-center justify-center border border-rose-100">
                        <Feather name="moon" size={16} color="#E11D48" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-zinc-900 text-sm font-bold">Lifestyle-Synced Recovery</Text>
                        <Text className="text-zinc-500 text-xs leading-relaxed mt-0.5">Sleep consistency and step goals matched to your day</Text>
                      </View>
                    </View>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleNext}
                    className="w-full bg-[#E11D48] py-4 rounded-2xl items-center justify-center shadow-sm flex-row gap-2 mt-3"
                  >
                    <Text className="text-white text-sm font-bold uppercase tracking-wider">Start Assessment</Text>
                    <Feather name="arrow-right" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              )}

              {/* STEP 2: Basic Metrics */}
              {step === 2 && (
                <View className="gap-5">
                  <View className="gap-1">
                    <Text className="text-zinc-900 text-xl font-bold">Tell us about your metrics</Text>
                    <Text className="text-zinc-500 text-xs font-medium">Used to calculate your Basal Metabolic Rate (BMR).</Text>
                  </View>

                  <View className="gap-4">
                    <View className="gap-1.5">
                      <Text className="text-zinc-500 text-[10px] font-bold uppercase pl-0.5">Age (years)</Text>
                      <TextInput
                        value={age}
                        onChangeText={setAge}
                        placeholder="e.g. 28"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="numeric"
                        maxLength={3}
                        className="bg-white border border-zinc-200 text-zinc-900 rounded-xl px-4 py-3.5 text-sm font-semibold"
                      />
                    </View>

                    <View className="gap-1.5">
                      <Text className="text-zinc-500 text-[10px] font-bold uppercase pl-0.5">Gender</Text>
                      <View className="flex-row gap-2">
                        {['Male', 'Female', 'Other'].map(g => (
                          <TouchableOpacity
                            key={g}
                            activeOpacity={0.7}
                            onPress={() => setGender(g)}
                            className={`flex-1 py-3.5 rounded-xl border items-center ${
                              gender === g ? 'bg-rose-50 border-rose-300' : 'bg-white border-zinc-200'
                            }`}
                          >
                            <Text className={`text-xs font-bold ${gender === g ? 'text-[#E11D48]' : 'text-zinc-600'}`}>{g}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    <View className="gap-1.5">
                      <Text className="text-zinc-500 text-[10px] font-bold uppercase pl-0.5">Height (cm)</Text>
                      <TextInput
                        value={height}
                        onChangeText={setHeight}
                        placeholder="e.g. 172"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="numeric"
                        maxLength={3}
                        className="bg-white border border-zinc-200 text-zinc-900 rounded-xl px-4 py-3.5 text-sm font-semibold"
                      />
                    </View>

                    <View className="gap-1.5">
                      <Text className="text-zinc-500 text-[10px] font-bold uppercase pl-0.5">Weight (kg)</Text>
                      <TextInput
                        value={weight}
                        onChangeText={setWeight}
                        placeholder="e.g. 68"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="numeric"
                        maxLength={3}
                        className="bg-white border border-zinc-200 text-zinc-900 rounded-xl px-4 py-3.5 text-sm font-semibold"
                      />
                    </View>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleNext}
                    className="w-full bg-[#E11D48] py-4 rounded-[20px] items-center justify-center mt-2 shadow-sm flex-row gap-2"
                  >
                    <Text className="text-white text-sm font-bold uppercase">Continue</Text>
                    <Feather name="arrow-right" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              )}

              {/* STEP 3: Fitness Goal */}
              {step === 3 && (
                <View className="gap-5">
                  <View className="gap-1">
                    <Text className="text-zinc-900 text-xl font-bold">Select your wellness goal</Text>
                    <Text className="text-zinc-500 text-xs font-medium">Your nutrition and training splits will calibrate around this.</Text>
                  </View>

                  <View className="flex-row flex-wrap justify-between gap-y-3">
                    {goalsList.map(goal => (
                      <TouchableOpacity
                        key={goal}
                        activeOpacity={0.7}
                        onPress={() => setFitnessGoal(goal)}
                        className={`w-[48%] p-4 rounded-2xl border bg-white shadow-sm ${
                          fitnessGoal === goal ? 'bg-rose-50 border-rose-300' : 'border-zinc-200'
                        }`}
                      >
                        <View className="flex-row justify-between items-center mb-1">
                          <Text className={`text-xs font-bold leading-normal ${fitnessGoal === goal ? 'text-[#E11D48]' : 'text-zinc-800'}`}>
                            {goal}
                          </Text>
                          {fitnessGoal === goal && (
                            <Feather name="check" size={14} color="#E11D48" />
                          )}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleNext}
                    className="w-full bg-[#E11D48] py-4 rounded-[20px] items-center justify-center mt-2 shadow-sm flex-row gap-2"
                  >
                    <Text className="text-white text-sm font-bold uppercase">Continue</Text>
                    <Feather name="arrow-right" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              )}

              {/* STEP 4: Activity Level */}
              {step === 4 && (
                <View className="gap-5">
                  <View className="gap-1">
                    <Text className="text-zinc-900 text-xl font-bold">What is your activity level?</Text>
                    <Text className="text-zinc-500 text-xs font-medium">Used for TDEE (Total Daily Energy Expenditure) calculation.</Text>
                  </View>

                  <View className="bg-white border border-zinc-200 rounded-[28px] overflow-hidden shadow-sm">
                    {activityList.map((lvl, index) => (
                      <TouchableOpacity
                        key={lvl}
                        activeOpacity={0.7}
                        onPress={() => setActivityLevel(lvl)}
                        className={`p-4 flex-row justify-between items-center ${
                          activityLevel === lvl ? 'bg-rose-50' : ''
                        } ${index < activityList.length - 1 ? 'border-b border-zinc-100' : ''}`}
                      >
                        <View className="flex-1 pr-3">
                          <Text className={`text-xs font-bold ${activityLevel === lvl ? 'text-[#E11D48]' : 'text-zinc-900'}`}>{lvl}</Text>
                          <Text className="text-zinc-500 text-[10px] font-medium mt-0.5 leading-relaxed">
                            {lvl === 'Sedentary' && 'Mostly sitting, desk job with minimal movement'}
                            {lvl === 'Lightly Active' && 'Light walks, active chores 1-2 days/week'}
                            {lvl === 'Moderately Active' && 'Regular training/sports 3-5 days/week'}
                            {lvl === 'Active' && 'Heavy exercise, dynamic physical activity 6-7 days/week'}
                            {lvl === 'Athlete' && 'Professional sports conditioning multiple times daily'}
                          </Text>
                        </View>
                        {activityLevel === lvl && <Feather name="check" size={16} color="#E11D48" />}
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleNext}
                    className="w-full bg-[#E11D48] py-4 rounded-[20px] items-center justify-center mt-2 shadow-sm flex-row gap-2"
                  >
                    <Text className="text-white text-sm font-bold uppercase">Continue</Text>
                    <Feather name="arrow-right" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              )}

              {/* STEP 5: Workout Frequency & Duration */}
              {step === 5 && (
                <View className="gap-5">
                  <View className="gap-1">
                    <Text className="text-zinc-900 text-xl font-bold">Workout frequency & duration</Text>
                    <Text className="text-zinc-500 text-xs font-medium">How often and how long do you typically train?</Text>
                  </View>

                  <View className="bg-white border border-zinc-200 p-6 rounded-[28px] gap-5 shadow-sm">
                    <View className="gap-2">
                      <Text className="text-zinc-500 text-[10px] font-bold uppercase pl-0.5">Days per week</Text>
                      <View className="flex-row justify-between mt-1">
                        {['1', '2', '3', '4', '5', '6', '7'].map(num => (
                          <TouchableOpacity
                            key={num}
                            activeOpacity={0.7}
                            onPress={() => setWorkoutFrequency(num)}
                            className={`w-9 h-9 rounded-full border items-center justify-center ${
                              workoutFrequency === num ? 'bg-[#E11D48] border-[#E11D48]' : 'bg-zinc-50 border-zinc-200'
                            }`}
                          >
                            <Text className={`text-xs font-bold ${workoutFrequency === num ? 'text-white' : 'text-zinc-600'}`}>{num}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    <View className="gap-2 border-t border-zinc-100 pt-4">
                      <Text className="text-zinc-500 text-[10px] font-bold uppercase pl-0.5">Preferred session duration</Text>
                      <View className="flex-row flex-wrap justify-between gap-y-2.5 mt-1">
                        {durationList.map(dur => (
                          <TouchableOpacity
                            key={dur}
                            activeOpacity={0.7}
                            onPress={() => setPreferredDuration(dur)}
                            className={`w-[48%] py-3.5 rounded-xl border items-center ${
                              preferredDuration === dur ? 'bg-rose-50 border-rose-300' : 'bg-zinc-50 border-zinc-200'
                            }`}
                          >
                            <Text className={`text-xs font-bold ${preferredDuration === dur ? 'text-[#E11D48]' : 'text-zinc-600'}`}>{dur}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleNext}
                    className="w-full bg-[#E11D48] py-4 rounded-[20px] items-center justify-center mt-2 shadow-sm flex-row gap-2"
                  >
                    <Text className="text-white text-sm font-bold uppercase">Continue</Text>
                    <Feather name="arrow-right" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              )}

              {/* STEP 6: Lifestyle Details */}
              {step === 6 && (
                <View className="gap-5">
                  <View className="gap-1">
                    <Text className="text-zinc-900 text-xl font-bold">Lifestyle & sleep habits</Text>
                    <Text className="text-zinc-500 text-xs font-medium">Syncs your meal and recovery schedule with your day.</Text>
                  </View>

                  <View className="bg-white border border-zinc-200 p-6 rounded-[28px] gap-4 shadow-sm">
                    <View className="flex-row justify-between gap-3">
                      <View className="flex-1 gap-1.5">
                        <View className="flex-row items-center gap-1.5">
                          <Feather name="sun" size={12} color="#F59E0B" />
                          <Text className="text-zinc-500 text-[10px] font-bold uppercase">Wake-up</Text>
                        </View>
                        <TextInput
                          value={wakeupTime}
                          onChangeText={setWakeupTime}
                          placeholder="e.g. 06:30 AM"
                          placeholderTextColor="#9CA3AF"
                          className="bg-zinc-50 border border-zinc-200 text-zinc-900 rounded-xl px-4 py-3 text-xs font-semibold"
                        />
                      </View>
                      
                      <View className="flex-1 gap-1.5">
                        <View className="flex-row items-center gap-1.5">
                          <Feather name="moon" size={12} color="#6366F1" />
                          <Text className="text-zinc-500 text-[10px] font-bold uppercase">Sleep Time</Text>
                        </View>
                        <TextInput
                          value={sleepTime}
                          onChangeText={setSleepTime}
                          placeholder="e.g. 10:30 PM"
                          placeholderTextColor="#9CA3AF"
                          className="bg-zinc-50 border border-zinc-200 text-zinc-900 rounded-xl px-4 py-3 text-xs font-semibold"
                        />
                      </View>
                    </View>

                    <View className="gap-2 border-t border-zinc-100 pt-4">
                      <Text className="text-zinc-500 text-[10px] font-bold uppercase pl-0.5">Lifestyle Profile Tags</Text>
                      <View className="flex-row flex-wrap gap-2 mt-1">
                        {lifestyleList.map(tag => {
                          const isSel = selectedLifestyle.includes(tag);
                          return (
                            <TouchableOpacity
                              key={tag}
                              activeOpacity={0.7}
                              onPress={() => toggleLifestyle(tag)}
                              className={`px-4 py-2.5 rounded-full border ${
                                isSel ? 'bg-rose-50 border-rose-300' : 'bg-zinc-50 border-zinc-200'
                              }`}
                            >
                              <Text className={`text-[10px] font-bold uppercase ${isSel ? 'text-[#E11D48]' : 'text-zinc-600'}`}>{tag}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleNext}
                    className="w-full bg-[#E11D48] py-4 rounded-[20px] items-center justify-center mt-2 shadow-sm flex-row gap-2"
                  >
                    <Text className="text-white text-sm font-bold uppercase">Continue</Text>
                    <Feather name="arrow-right" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              )}

              {/* STEP 7: Food Preferences */}
              {step === 7 && (
                <View className="gap-5">
                  <View className="gap-1">
                    <Text className="text-zinc-900 text-xl font-bold">Food preferences</Text>
                    <Text className="text-zinc-500 text-xs font-medium">Select your dietary lifestyle for daily meal recommendations.</Text>
                  </View>

                  <View className="flex-row flex-wrap justify-between gap-y-3">
                    {foodPrefs.map(pref => (
                      <TouchableOpacity
                        key={pref}
                        activeOpacity={0.7}
                        onPress={() => setFoodPreference(pref)}
                        className={`w-[48%] p-4 rounded-2xl border bg-white shadow-sm ${
                          foodPreference === pref ? 'bg-rose-50 border-rose-300' : 'border-zinc-200'
                        }`}
                      >
                        <View className="flex-row justify-between items-center">
                          <Text className={`text-xs font-bold ${foodPreference === pref ? 'text-[#E11D48]' : 'text-zinc-800'}`}>{pref}</Text>
                          {foodPreference === pref && (
                            <Feather name="check" size={14} color="#E11D48" />
                          )}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleNext}
                    className="w-full bg-[#E11D48] py-4 rounded-[20px] items-center justify-center mt-2 shadow-sm flex-row gap-2"
                  >
                    <Text className="text-white text-sm font-bold uppercase">Continue</Text>
                    <Feather name="arrow-right" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              )}

              {/* STEP 8: Diet Restrictions */}
              {step === 8 && (
                <View className="gap-5">
                  <View className="gap-1">
                    <Text className="text-zinc-900 text-xl font-bold">Any diet restrictions?</Text>
                    <Text className="text-zinc-500 text-xs font-medium">We will automatically filter out incompatible foods.</Text>
                  </View>

                  <View className="bg-white border border-zinc-200 rounded-[28px] overflow-hidden shadow-sm">
                    {restrictionsList.map((tag, index) => {
                      const isSel = selectedRestrictions.includes(tag);
                      return (
                        <TouchableOpacity
                          key={tag}
                          activeOpacity={0.7}
                          onPress={() => toggleTag(tag, selectedRestrictions, setSelectedRestrictions)}
                          className={`p-4 flex-row justify-between items-center ${
                            isSel ? 'bg-rose-50' : ''
                          } ${index < restrictionsList.length - 1 ? 'border-b border-zinc-100' : ''}`}
                        >
                          <Text className={`text-xs font-bold ${isSel ? 'text-[#E11D48]' : 'text-zinc-700'}`}>{tag}</Text>
                          {isSel && <Feather name="check" size={14} color="#E11D48" />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleNext}
                    className="w-full bg-[#E11D48] py-4 rounded-[20px] items-center justify-center mt-2 shadow-sm flex-row gap-2"
                  >
                    <Text className="text-white text-sm font-bold uppercase">Continue</Text>
                    <Feather name="arrow-right" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              )}

              {/* STEP 9: Medical Conditions */}
              {step === 9 && (
                <View className="gap-5">
                  <View className="gap-1">
                    <Text className="text-zinc-900 text-xl font-bold">Physical & health considerations</Text>
                    <Text className="text-zinc-500 text-xs font-medium">Helps adjust impact levels for joint and mobility health.</Text>
                  </View>

                  <View className="bg-white border border-zinc-200 rounded-[28px] overflow-hidden shadow-sm">
                    {conditionsList.map((tag, index) => {
                      const isSel = selectedConditions.includes(tag);
                      return (
                        <TouchableOpacity
                          key={tag}
                          activeOpacity={0.7}
                          onPress={() => toggleTag(tag, selectedConditions, setSelectedConditions)}
                          className={`p-4 flex-row justify-between items-center ${
                            isSel ? 'bg-rose-50' : ''
                          } ${index < conditionsList.length - 1 ? 'border-b border-zinc-100' : ''}`}
                        >
                          <Text className={`text-xs font-bold ${isSel ? 'text-[#E11D48]' : 'text-zinc-700'}`}>{tag}</Text>
                          {isSel && <Feather name="check" size={14} color="#E11D48" />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleNext}
                    className="w-full bg-[#E11D48] py-4 rounded-[20px] items-center justify-center mt-2 shadow-sm flex-row gap-2"
                  >
                    <Text className="text-white text-sm font-bold uppercase">Continue</Text>
                    <Feather name="arrow-right" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              )}

              {/* STEP 10: Water Intake */}
              {step === 10 && (
                <View className="gap-5">
                  <View className="gap-1">
                    <Text className="text-zinc-900 text-xl font-bold">Daily water intake</Text>
                    <Text className="text-zinc-500 text-xs font-medium">How much water do you currently consume each day?</Text>
                  </View>

                  <View className="bg-white border border-zinc-200 p-6 rounded-[28px] gap-2 shadow-sm">
                    <Text className="text-zinc-500 text-[10px] font-bold uppercase pl-0.5">Select daily intake</Text>
                    <View className="flex-row flex-wrap justify-between gap-y-2.5 mt-2">
                      {waterList.map(qty => (
                        <TouchableOpacity
                          key={qty}
                          activeOpacity={0.7}
                          onPress={() => setWaterIntake(qty)}
                          className={`w-[48%] py-3.5 rounded-xl border items-center flex-row justify-center gap-2 ${
                            waterIntake === qty ? 'bg-rose-50 border-rose-300' : 'bg-zinc-50 border-zinc-200'
                          }`}
                        >
                          <Feather name="droplet" size={13} color={waterIntake === qty ? '#E11D48' : '#9CA3AF'} />
                          <Text className={`text-xs font-bold ${waterIntake === qty ? 'text-[#E11D48]' : 'text-zinc-600'}`}>{qty}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleNext}
                    className="w-full bg-[#E11D48] py-4 rounded-[20px] items-center justify-center mt-2 shadow-sm flex-row gap-2"
                  >
                    <Text className="text-white text-sm font-bold uppercase">Continue</Text>
                    <Feather name="arrow-right" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              )}

              {/* STEP 11: Supplements */}
              {step === 11 && (
                <View className="gap-5">
                  <View className="gap-1">
                    <Text className="text-zinc-900 text-xl font-bold">Supplements stack (Optional)</Text>
                    <Text className="text-zinc-500 text-xs font-medium">Check any supplements you take or plan to include.</Text>
                  </View>

                  <View className="bg-white border border-zinc-200 p-6 rounded-[28px] gap-2 shadow-sm">
                    <Text className="text-zinc-500 text-[10px] font-bold uppercase pl-0.5">Select applicable supplements</Text>
                    <View className="flex-row flex-wrap gap-2.5 mt-2">
                      {supplementsList.map(tag => {
                        const isSel = selectedSupplements.includes(tag);
                        return (
                          <TouchableOpacity
                            key={tag}
                            activeOpacity={0.7}
                            onPress={() => {
                              setSelectedSupplements(prev => 
                                prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                              );
                            }}
                            className={`px-4 py-2.5 rounded-full border ${
                              isSel ? 'bg-rose-50 border-rose-300' : 'bg-zinc-50 border-zinc-200'
                            }`}
                          >
                            <Text className={`text-[10px] font-bold uppercase ${isSel ? 'text-[#E11D48]' : 'text-zinc-600'}`}>{tag}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleGenerate}
                    className="w-full bg-[#E11D48] py-4 rounded-[20px] items-center justify-center mt-2 shadow-sm flex-row gap-2"
                  >
                    <Feather name="zap" size={16} color="#FFFFFF" />
                    <Text className="text-white text-sm font-bold uppercase">Generate AI Wellness Plan</Text>
                  </TouchableOpacity>
                </View>
              )}

            </Animated.View>
          </ScrollView>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
