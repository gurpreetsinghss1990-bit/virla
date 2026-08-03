import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, Animated, Platform, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAIWellnessStore, AIWellnessPlan } from '../store/aiWellnessStore';
import { Feather, Ionicons } from '@expo/vector-icons';

export default function VirlaAIScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { savedPlan, savePlan, clearPlan } = useAIWellnessStore();

  // Onboarding Wizard Step
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
  const [loadingText, setLoadingText] = useState('Analyzing macro targets...');
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
        Alert.alert('Invalid Height', 'Please enter a valid height in cm.');
        return;
      }
      if (isNaN(wVal) || wVal < 30 || wVal > 200) {
        Alert.alert('Invalid Weight', 'Please enter a valid weight in kg.');
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
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true })
    ]).start();

    if (step < 12) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true })
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
        if (next === 25) setLoadingText('Compiling diet preferences...');
        if (next === 50) setLoadingText('Calculating recovery index...');
        if (next === 75) setLoadingText('Generating healthy snack index...');
        if (next >= 100) {
          clearInterval(interval);
          const computedPlan = runWellnessGenerator();
          setGeneratedPlan(computedPlan);
          setIsGenerating(false);
          setStep(12);
        }
        return next;
      });
    }, 600);
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

    let tdee = bmr * multiplier;

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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <View style={{ flex: 1, backgroundColor: '#F8F9FC', paddingTop: insets.top }}>
        {/* Header */}
        <View className="h-14 flex-row items-center px-6 border-b border-[#E5E7EB] bg-white justify-between">
          {step > 1 && !generatedPlan ? (
            <TouchableOpacity onPress={handleBack} className="w-8 h-8 items-center justify-center">
              <Ionicons name="arrow-back" size={20} color="#101828" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => router.back()} className="w-8 h-8 items-center justify-center">
              <Ionicons name="close" size={20} color="#101828" />
            </TouchableOpacity>
          )}
          <Text className="text-[#101828] text-xs font-black uppercase tracking-widest">
            {generatedPlan ? 'My AI Wellness Plan' : `AI Wellness Wizard (${step}/12)`}
          </Text>
          <View className="w-8" />
        </View>

        {isGenerating ? (
          /* ========================================== */
          /* ============= GENERATION LOADER ============ */
          /* ========================================== */
          <View className="flex-1 justify-center items-center px-8 bg-[#FAF9FC]">
            <View className="p-8 bg-white border border-[#E5E7EB] rounded-[36px] items-center gap-6 shadow-sm w-full">
              <View className="w-16 h-16 rounded-full bg-rose-50 items-center justify-center">
                <Feather name="cpu" size={28} color="#E11D48" />
              </View>
              
              <Text className="text-zinc-950 text-base font-black text-center">{loadingText}</Text>
              
              {/* Progress bar container */}
              <View className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                <View 
                  className="h-full bg-[#E11D48]"
                  style={{ width: `${generationProgress}%` }}
                />
              </View>
              
              <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">
                VIRLA AI is creating your personalized wellness plan...
              </Text>
            </View>
          </View>
        ) : generatedPlan ? (
          /* ========================================== */
          /* ============= ACTIVE PLAN VIEW ============ */
          /* ========================================== */
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingBottom: 120 }}>
            <View className="gap-6">
              {/* Header Info */}
              <View className="bg-zinc-950 p-6 rounded-[32px] border border-zinc-800 gap-4">
                <View className="flex-row items-center gap-2">
                  <Text className="text-[#EC4899] text-xs">✦</Text>
                  <Text className="text-white/60 text-[10px] font-semibold uppercase tracking-widest">Calculated Macros Targets</Text>
                </View>
                <View className="flex-row justify-between items-baseline">
                  <Text className="text-white text-3xl font-black">{generatedPlan.dailyCalories} kcal</Text>
                  <Text className="text-zinc-400 text-xs font-bold">Daily Calories</Text>
                </View>

                {/* Macro progress sliders */}
                <View className="gap-3 mt-1">
                  <View className="gap-1">
                    <View className="flex-row justify-between">
                      <Text className="text-zinc-400 text-[10px] font-bold uppercase">Protein</Text>
                      <Text className="text-white text-[10px] font-black">{generatedPlan.proteinTarget}g</Text>
                    </View>
                    <View className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                      <View className="h-full bg-rose-500" style={{ width: '40%' }} />
                    </View>
                  </View>

                  <View className="gap-1">
                    <View className="flex-row justify-between">
                      <Text className="text-zinc-400 text-[10px] font-bold uppercase">Carbohydrates</Text>
                      <Text className="text-white text-[10px] font-black">{generatedPlan.carbTarget}g</Text>
                    </View>
                    <View className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                      <View className="h-full bg-indigo-500" style={{ width: '50%' }} />
                    </View>
                  </View>

                  <View className="gap-1">
                    <View className="flex-row justify-between">
                      <Text className="text-zinc-400 text-[10px] font-bold uppercase">Fats</Text>
                      <Text className="text-white text-[10px] font-black">{generatedPlan.fatTarget}g</Text>
                    </View>
                    <View className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                      <View className="h-full bg-amber-500" style={{ width: '30%' }} />
                    </View>
                  </View>
                </View>
              </View>

              {/* Workout & Lifestyle Card */}
              <View className="bg-white border border-[#E5E7EB] p-6 rounded-[32px] gap-4">
                <View className="flex-row items-center gap-2.5 border-b border-zinc-100 pb-3">
                  <View className="w-7 h-7 rounded-full bg-rose-50 items-center justify-center">
                    <Feather name="activity" size={13} color="#E11D48" />
                  </View>
                  <Text className="text-[#101828] text-xs font-black uppercase tracking-wider">Fitness & Training Recommendation</Text>
                </View>

                <View className="gap-3">
                  <View className="gap-1">
                    <Text className="text-zinc-400 text-[9px] font-bold uppercase">Workout Routine</Text>
                    <Text className="text-zinc-900 text-xs font-semibold leading-relaxed">{generatedPlan.workoutRecommendation}</Text>
                  </View>
                  <View className="gap-1 border-t border-zinc-50 pt-2 flex-row justify-between">
                    <View>
                      <Text className="text-zinc-400 text-[9px] font-bold uppercase">Daily Step Goal</Text>
                      <Text className="text-zinc-900 text-xs font-black">{generatedPlan.dailyStepGoal.toLocaleString()} steps</Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-zinc-400 text-[9px] font-bold uppercase">Hydration Goal</Text>
                      <Text className="text-emerald-700 text-xs font-black">{generatedPlan.hydrationGoal}</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Diet Suggestions Card */}
              <View className="bg-white border border-[#E5E7EB] p-6 rounded-[32px] gap-4">
                <View className="flex-row items-center gap-2.5 border-b border-zinc-100 pb-3">
                  <View className="w-7 h-7 rounded-full bg-rose-50 items-center justify-center">
                    <Feather name="heart" size={13} color="#E11D48" />
                  </View>
                  <Text className="text-[#101828] text-xs font-black uppercase tracking-wider">Daily Meal Plan Suggestions</Text>
                </View>

                <View className="gap-3.5">
                  <View className="gap-1">
                    <Text className="text-rose-500 text-[9px] font-black uppercase tracking-wide">Breakfast</Text>
                    {(generatedPlan.breakfastSuggestions || []).map((x, i) => (
                      <Text key={i} className="text-zinc-700 text-xs font-medium">• {x}</Text>
                    ))}
                  </View>
                  <View className="gap-1 border-t border-zinc-50 pt-2">
                    <Text className="text-rose-500 text-[9px] font-black uppercase tracking-wide">Lunch</Text>
                    {(generatedPlan.lunchSuggestions || []).map((x, i) => (
                      <Text key={i} className="text-zinc-700 text-xs font-medium">• {x}</Text>
                    ))}
                  </View>
                  <View className="gap-1 border-t border-zinc-50 pt-2">
                    <Text className="text-rose-500 text-[9px] font-black uppercase tracking-wide">Dinner</Text>
                    {(generatedPlan.dinnerSuggestions || []).map((x, i) => (
                      <Text key={i} className="text-zinc-700 text-xs font-medium">• {x}</Text>
                    ))}
                  </View>
                  <View className="gap-1 border-t border-zinc-50 pt-2">
                    <Text className="text-rose-500 text-[9px] font-black uppercase tracking-wide">Healthy Snacks</Text>
                    {(generatedPlan.snackSuggestions || []).map((x, i) => (
                      <Text key={i} className="text-zinc-700 text-xs font-medium">• {x}</Text>
                    ))}
                  </View>
                </View>
              </View>

              {/* Lifestyle & Recovery Advice */}
              <View className="bg-white border border-[#E5E7EB] p-6 rounded-[32px] gap-4">
                <View className="flex-row items-center gap-2.5 border-b border-zinc-100 pb-3">
                  <View className="w-7 h-7 rounded-full bg-rose-50 items-center justify-center">
                    <Feather name="coffee" size={13} color="#E11D48" />
                  </View>
                  <Text className="text-[#101828] text-xs font-black uppercase tracking-wider">Lifestyle & Recovery</Text>
                </View>

                <View className="gap-3">
                  <View className="gap-1">
                    <Text className="text-zinc-400 text-[9px] font-bold uppercase">Sleep Routine</Text>
                    <Text className="text-zinc-900 text-xs font-semibold leading-relaxed">{generatedPlan.sleepRecommendation || '8 hours of restful sleep'}</Text>
                  </View>
                  <View className="gap-1 border-t border-zinc-50 pt-2">
                    <Text className="text-zinc-400 text-[9px] font-bold uppercase">Recovery Advice</Text>
                    <Text className="text-zinc-900 text-xs font-semibold leading-relaxed">{generatedPlan.recoveryAdvice || 'Light stretching post workout'}</Text>
                  </View>
                </View>
              </View>

              {/* Weekly progress milestones */}
              <View className="bg-white border border-[#E5E7EB] p-6 rounded-[32px] gap-4">
                <View className="flex-row items-center gap-2.5 border-b border-zinc-100 pb-3">
                  <View className="w-7 h-7 rounded-full bg-rose-50 items-center justify-center">
                    <Feather name="target" size={13} color="#E11D48" />
                  </View>
                  <Text className="text-[#101828] text-xs font-black uppercase tracking-wider">Weekly Progress Goals</Text>
                </View>

                <View className="gap-2.5">
                  {(generatedPlan.weeklyProgressGoals || []).map((g, idx) => (
                    <View key={idx} className="flex-row items-center gap-2">
                      <Feather name="check" size={12} color="#10B981" />
                      <Text className="text-zinc-700 text-xs font-semibold flex-1">{g}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Save Plan or Regenerate actions */}
              <View className="gap-3 mt-2">
                {!savedPlan && (
                  <TouchableOpacity
                    onPress={handleSavePlan}
                    className="w-full bg-[#E11D48] py-4 rounded-[20px] items-center justify-center shadow-sm"
                  >
                    <Text className="text-white text-sm font-black uppercase">Save & Activate Plan</Text>
                  </TouchableOpacity>
                )}
                
                <TouchableOpacity
                  onPress={handleRegenerate}
                  className="w-full bg-zinc-50 border border-zinc-200 py-4 rounded-[20px] items-center justify-center"
                >
                  <Text className="text-zinc-650 text-sm font-black uppercase">Regenerate Wellness Plan</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        ) : (
          /* ========================================== */
          /* ============= ONBOARDING STEPS ============= */
          /* ========================================== */
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingBottom: 100 }}>
            <Animated.View style={{ opacity: fadeAnim, gap: 24 }}>
              
              {/* STEP 1: Welcome Intro */}
              {step === 1 && (
                <View className="gap-6 pt-4">
                  <View className="w-20 h-20 rounded-full bg-rose-50 items-center justify-center self-center shadow-inner">
                    <Text className="text-3xl">✦</Text>
                  </View>
                  
                  <View className="gap-2 items-center">
                    <Text className="text-zinc-950 text-2xl font-black text-center tracking-tight">Create My AI Wellness Plan</Text>
                    <Text className="text-zinc-500 text-sm text-center leading-relaxed px-2">
                      Answer a few questions so VIRLA AI can create a personalized wellness plan.
                    </Text>
                  </View>

                  <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] mt-2 gap-4">
                    <View className="flex-row items-center gap-3">
                      <View className="w-6 h-6 rounded-full bg-rose-50 items-center justify-center">
                        <Feather name="check" size={12} color="#E11D48" />
                      </View>
                      <Text className="text-zinc-700 text-xs font-semibold">Custom Calorie & Hydration Targets</Text>
                    </View>
                    <View className="flex-row items-center gap-3 border-t border-zinc-50 pt-3">
                      <View className="w-6 h-6 rounded-full bg-rose-50 items-center justify-center">
                        <Feather name="check" size={12} color="#E11D48" />
                      </View>
                      <Text className="text-zinc-700 text-xs font-semibold">Macro splits & Foods suggestions</Text>
                    </View>
                    <View className="flex-row items-center gap-3 border-t border-zinc-50 pt-3">
                      <View className="w-6 h-6 rounded-full bg-rose-50 items-center justify-center">
                        <Feather name="check" size={12} color="#E11D48" />
                      </View>
                      <Text className="text-zinc-700 text-xs font-semibold">Lifestyle-adaptive recovery goals</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={handleNext}
                    className="w-full bg-[#E11D48] py-4 rounded-[20px] items-center justify-center mt-4 shadow-sm"
                  >
                    <Text className="text-white text-sm font-black uppercase">Get Started</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* STEP 2: Basic Metrics */}
              {step === 2 && (
                <View className="gap-5">
                  <View className="gap-1">
                    <Text className="text-zinc-400 text-[10px] font-black uppercase tracking-wider">Step 2 of 11</Text>
                    <Text className="text-zinc-950 text-xl font-black tracking-tight">Tell us about your metrics</Text>
                  </View>

                  <View className="bg-white border border-[#E5E7EB] p-6 rounded-[28px] gap-4">
                    <View className="gap-1.5">
                      <Text className="text-zinc-500 text-[10px] font-bold uppercase pl-0.5">Age (years)</Text>
                      <TextInput
                        value={age}
                        onChangeText={setAge}
                        placeholder="e.g. 28"
                        keyboardType="numeric"
                        maxLength={2}
                        className="bg-zinc-50 border border-zinc-200 text-zinc-900 rounded-xl px-4 py-3.5 text-sm font-semibold"
                      />
                    </View>

                    <View className="gap-1.5">
                      <Text className="text-zinc-500 text-[10px] font-bold uppercase pl-0.5">Gender</Text>
                      <View className="flex-row gap-2">
                        {['Male', 'Female', 'Other'].map(g => (
                          <TouchableOpacity
                            key={g}
                            onPress={() => setGender(g)}
                            className={`flex-1 py-3.5 rounded-xl border items-center ${
                              gender === g ? 'bg-rose-50 border-rose-200' : 'bg-zinc-50 border-zinc-200'
                            }`}
                          >
                            <Text className={`text-xs font-bold ${gender === g ? 'text-[#E11D48]' : 'text-zinc-650'}`}>{g}</Text>
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
                        keyboardType="numeric"
                        maxLength={3}
                        className="bg-zinc-50 border border-zinc-200 text-zinc-900 rounded-xl px-4 py-3.5 text-sm font-semibold"
                      />
                    </View>

                    <View className="gap-1.5">
                      <Text className="text-zinc-500 text-[10px] font-bold uppercase pl-0.5">Weight (kg)</Text>
                      <TextInput
                        value={weight}
                        onChangeText={setWeight}
                        placeholder="e.g. 68"
                        keyboardType="numeric"
                        maxLength={3}
                        className="bg-zinc-50 border border-zinc-200 text-zinc-900 rounded-xl px-4 py-3.5 text-sm font-semibold"
                      />
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={handleNext}
                    className="w-full bg-[#E11D48] py-4 rounded-[20px] items-center justify-center mt-2"
                  >
                    <Text className="text-white text-sm font-black uppercase">Continue</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* STEP 3: Fitness Goal */}
              {step === 3 && (
                <View className="gap-5">
                  <View className="gap-1">
                    <Text className="text-zinc-400 text-[10px] font-black uppercase tracking-wider">Step 3 of 11</Text>
                    <Text className="text-zinc-950 text-xl font-black tracking-tight">Select your wellness goal</Text>
                  </View>

                  <View className="flex-row flex-wrap justify-between gap-y-3">
                    {goalsList.map(goal => (
                      <TouchableOpacity
                        key={goal}
                        onPress={() => setFitnessGoal(goal)}
                        className={`w-[48%] p-4 rounded-2xl border bg-white ${
                          fitnessGoal === goal ? 'bg-rose-50/40 border-rose-300' : 'border-zinc-200'
                        }`}
                      >
                        <Text className={`text-xs font-bold leading-normal ${fitnessGoal === goal ? 'text-[#E11D48]' : 'text-zinc-700'}`}>{goal}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TouchableOpacity
                    onPress={handleNext}
                    className="w-full bg-[#E11D48] py-4 rounded-[20px] items-center justify-center mt-2"
                  >
                    <Text className="text-white text-sm font-black uppercase">Continue</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* STEP 4: Activity Level */}
              {step === 4 && (
                <View className="gap-5">
                  <View className="gap-1">
                    <Text className="text-zinc-400 text-[10px] font-black uppercase tracking-wider">Step 4 of 11</Text>
                    <Text className="text-zinc-950 text-xl font-black tracking-tight">What is your activity level?</Text>
                  </View>

                  <View className="bg-white border border-[#E5E7EB] rounded-[28px] overflow-hidden">
                    {activityList.map((lvl, index) => (
                      <TouchableOpacity
                        key={lvl}
                        onPress={() => setActivityLevel(lvl)}
                        className={`p-5 flex-row justify-between items-center ${
                          activityLevel === lvl ? 'bg-rose-50/30' : ''
                        } ${index < activityList.length - 1 ? 'border-b border-zinc-100' : ''}`}
                      >
                        <View>
                          <Text className={`text-xs font-black ${activityLevel === lvl ? 'text-[#E11D48]' : 'text-zinc-900'}`}>{lvl}</Text>
                          <Text className="text-zinc-400 text-[9px] font-medium mt-0.5">
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
                    onPress={handleNext}
                    className="w-full bg-[#E11D48] py-4 rounded-[20px] items-center justify-center mt-2"
                  >
                    <Text className="text-white text-sm font-black uppercase">Continue</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* STEP 5: Workout Frequency & Duration */}
              {step === 5 && (
                <View className="gap-5">
                  <View className="gap-1">
                    <Text className="text-zinc-400 text-[10px] font-black uppercase tracking-wider">Step 5 of 11</Text>
                    <Text className="text-zinc-950 text-xl font-black tracking-tight">Workout frequency & duration</Text>
                  </View>

                  <View className="bg-white border border-[#E5E7EB] p-6 rounded-[28px] gap-5">
                    <View className="gap-2">
                      <Text className="text-zinc-500 text-[10px] font-bold uppercase pl-0.5">How many days per week?</Text>
                      <View className="flex-row justify-between gap-1 mt-1">
                        {['1', '2', '3', '4', '5', '6', '7'].map(num => (
                          <TouchableOpacity
                            key={num}
                            onPress={() => setWorkoutFrequency(num)}
                            className={`w-9 h-9 rounded-full border items-center justify-center ${
                              workoutFrequency === num ? 'bg-[#E11D48] border-[#E11D48]' : 'bg-zinc-50 border-zinc-200'
                            }`}
                          >
                            <Text className={`text-xs font-black ${workoutFrequency === num ? 'text-white' : 'text-zinc-650'}`}>{num}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    <View className="gap-2 border-t border-zinc-100 pt-4">
                      <Text className="text-zinc-500 text-[10px] font-bold uppercase pl-0.5">Preferred workout duration</Text>
                      <View className="flex-row flex-wrap justify-between gap-y-2 mt-1">
                        {durationList.map(dur => (
                          <TouchableOpacity
                            key={dur}
                            onPress={() => setPreferredDuration(dur)}
                            className={`w-[48%] py-3 rounded-xl border items-center ${
                              preferredDuration === dur ? 'bg-rose-50 border-rose-200' : 'bg-zinc-50 border-zinc-200'
                            }`}
                          >
                            <Text className={`text-xs font-bold ${preferredDuration === dur ? 'text-[#E11D48]' : 'text-zinc-650'}`}>{dur}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={handleNext}
                    className="w-full bg-[#E11D48] py-4 rounded-[20px] items-center justify-center mt-2"
                  >
                    <Text className="text-white text-sm font-black uppercase">Continue</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* STEP 6: Lifestyle Details */}
              {step === 6 && (
                <View className="gap-5">
                  <View className="gap-1">
                    <Text className="text-zinc-400 text-[10px] font-black uppercase tracking-wider">Step 6 of 11</Text>
                    <Text className="text-zinc-950 text-xl font-black tracking-tight">Lifestyle habits</Text>
                  </View>

                  <View className="bg-white border border-[#E5E7EB] p-6 rounded-[28px] gap-4">
                    <View className="flex-row justify-between gap-3">
                      <View className="flex-1 gap-1.5">
                        <Text className="text-zinc-500 text-[10px] font-bold uppercase pl-0.5">Wake-up Time</Text>
                        <TextInput
                          value={wakeupTime}
                          onChangeText={setWakeupTime}
                          placeholder="e.g. 06:30 AM"
                          className="bg-zinc-50 border border-zinc-200 text-zinc-900 rounded-xl px-4 py-3 text-xs font-semibold"
                        />
                      </View>
                      
                      <View className="flex-1 gap-1.5">
                        <Text className="text-zinc-500 text-[10px] font-bold uppercase pl-0.5">Sleep Time</Text>
                        <TextInput
                          value={sleepTime}
                          onChangeText={setSleepTime}
                          placeholder="e.g. 10:30 PM"
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
                              onPress={() => toggleLifestyle(tag)}
                              className={`px-4 py-2.5 rounded-full border ${
                                isSel ? 'bg-rose-50 border-rose-200' : 'bg-zinc-50 border-zinc-200'
                              }`}
                            >
                              <Text className={`text-[10px] font-black uppercase ${isSel ? 'text-[#E11D48]' : 'text-zinc-650'}`}>{tag}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={handleNext}
                    className="w-full bg-[#E11D48] py-4 rounded-[20px] items-center justify-center mt-2"
                  >
                    <Text className="text-white text-sm font-black uppercase">Continue</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* STEP 7: Food Preferences */}
              {step === 7 && (
                <View className="gap-5">
                  <View className="gap-1">
                    <Text className="text-zinc-400 text-[10px] font-black uppercase tracking-wider">Step 7 of 11</Text>
                    <Text className="text-zinc-950 text-xl font-black tracking-tight">Food preferences</Text>
                  </View>

                  <View className="flex-row flex-wrap justify-between gap-y-3">
                    {foodPrefs.map(pref => (
                      <TouchableOpacity
                        key={pref}
                        onPress={() => setFoodPreference(pref)}
                        className={`w-[48%] p-4.5 rounded-2xl border bg-white ${
                          foodPreference === pref ? 'bg-rose-50/40 border-rose-300' : 'border-zinc-200'
                        }`}
                      >
                        <Text className={`text-xs font-black ${foodPreference === pref ? 'text-[#E11D48]' : 'text-zinc-700'}`}>{pref}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TouchableOpacity
                    onPress={handleNext}
                    className="w-full bg-[#E11D48] py-4 rounded-[20px] items-center justify-center mt-2"
                  >
                    <Text className="text-white text-sm font-black uppercase">Continue</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* STEP 8: Diet Restrictions */}
              {step === 8 && (
                <View className="gap-5">
                  <View className="gap-1">
                    <Text className="text-zinc-400 text-[10px] font-black uppercase tracking-wider">Step 8 of 11</Text>
                    <Text className="text-zinc-950 text-xl font-black tracking-tight">Any diet restrictions?</Text>
                  </View>

                  <View className="bg-white border border-[#E5E7EB] rounded-[28px] overflow-hidden">
                    {restrictionsList.map((tag, index) => {
                      const isSel = selectedRestrictions.includes(tag);
                      return (
                        <TouchableOpacity
                          key={tag}
                          onPress={() => toggleTag(tag, selectedRestrictions, setSelectedRestrictions)}
                          className={`p-4.5 flex-row justify-between items-center ${
                            isSel ? 'bg-rose-50/30' : ''
                          } ${index < restrictionsList.length - 1 ? 'border-b border-zinc-100' : ''}`}
                        >
                          <Text className={`text-xs font-bold ${isSel ? 'text-[#E11D48]' : 'text-zinc-700'}`}>{tag}</Text>
                          {isSel && <Feather name="check" size={14} color="#E11D48" />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <TouchableOpacity
                    onPress={handleNext}
                    className="w-full bg-[#E11D48] py-4 rounded-[20px] items-center justify-center mt-2"
                  >
                    <Text className="text-white text-sm font-black uppercase">Continue</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* STEP 9: Medical Conditions */}
              {step === 9 && (
                <View className="gap-5">
                  <View className="gap-1">
                    <Text className="text-zinc-400 text-[10px] font-black uppercase tracking-wider">Step 9 of 11 (Optional)</Text>
                    <Text className="text-zinc-950 text-xl font-black tracking-tight">Medical conditions</Text>
                  </View>

                  <View className="bg-white border border-[#E5E7EB] rounded-[28px] overflow-hidden">
                    {conditionsList.map((tag, index) => {
                      const isSel = selectedConditions.includes(tag);
                      return (
                        <TouchableOpacity
                          key={tag}
                          onPress={() => toggleTag(tag, selectedConditions, setSelectedConditions)}
                          className={`p-4.5 flex-row justify-between items-center ${
                            isSel ? 'bg-rose-50/30' : ''
                          } ${index < conditionsList.length - 1 ? 'border-b border-zinc-100' : ''}`}
                        >
                          <Text className={`text-xs font-bold ${isSel ? 'text-[#E11D48]' : 'text-zinc-700'}`}>{tag}</Text>
                          {isSel && <Feather name="check" size={14} color="#E11D48" />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <TouchableOpacity
                    onPress={handleNext}
                    className="w-full bg-[#E11D48] py-4 rounded-[20px] items-center justify-center mt-2"
                  >
                    <Text className="text-white text-sm font-black uppercase">Continue</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* STEP 10: Water Intake */}
              {step === 10 && (
                <View className="gap-5">
                  <View className="gap-1">
                    <Text className="text-zinc-400 text-[10px] font-black uppercase tracking-wider">Step 10 of 11</Text>
                    <Text className="text-zinc-950 text-xl font-black tracking-tight">Daily water intake goal</Text>
                  </View>

                  <View className="bg-white border border-[#E5E7EB] p-6 rounded-[28px] gap-2">
                    <Text className="text-zinc-500 text-[10px] font-bold uppercase pl-0.5">How much water do you drink daily?</Text>
                    <View className="flex-row flex-wrap justify-between gap-y-2.5 mt-2">
                      {waterList.map(qty => (
                        <TouchableOpacity
                          key={qty}
                          onPress={() => setWaterIntake(qty)}
                          className={`w-[48%] py-3.5 rounded-xl border items-center ${
                            waterIntake === qty ? 'bg-rose-50 border-rose-200' : 'bg-zinc-50 border-zinc-200'
                          }`}
                        >
                          <Text className={`text-xs font-bold ${waterIntake === qty ? 'text-[#E11D48]' : 'text-zinc-650'}`}>{qty}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={handleNext}
                    className="w-full bg-[#E11D48] py-4 rounded-[20px] items-center justify-center mt-2"
                  >
                    <Text className="text-white text-sm font-black uppercase">Continue</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* STEP 11: Supplements */}
              {step === 11 && (
                <View className="gap-5">
                  <View className="gap-1">
                    <Text className="text-zinc-400 text-[10px] font-black uppercase tracking-wider">Step 11 of 11 (Optional)</Text>
                    <Text className="text-zinc-950 text-xl font-black tracking-tight">Supplements stack</Text>
                  </View>

                  <View className="bg-white border border-[#E5E7EB] p-6 rounded-[28px] gap-2">
                    <Text className="text-zinc-500 text-[10px] font-bold uppercase pl-0.5">Check supplements you take daily</Text>
                    <View className="flex-row flex-wrap gap-2.5 mt-2">
                      {supplementsList.map(tag => {
                        const isSel = selectedSupplements.includes(tag);
                        return (
                          <TouchableOpacity
                            key={tag}
                            onPress={() => {
                              setSelectedSupplements(prev => 
                                prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                              );
                            }}
                            className={`px-4 py-2.5 rounded-full border ${
                              isSel ? 'bg-rose-50 border-rose-200' : 'bg-zinc-50 border-zinc-200'
                            }`}
                          >
                            <Text className={`text-[10px] font-black uppercase ${isSel ? 'text-[#E11D48]' : 'text-zinc-650'}`}>{tag}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={handleGenerate}
                    className="w-full bg-[#E11D48] py-4 rounded-[20px] items-center justify-center mt-2"
                  >
                    <Text className="text-white text-sm font-black uppercase">Generate AI Wellness Plan</Text>
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
