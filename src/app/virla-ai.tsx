import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, Animated, Platform, KeyboardAvoidingView, Image, Vibration } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAIWellnessStore, AIWellnessPlan } from '../store/aiWellnessStore';
import { useUserProfileStore } from '../store/userProfileStore';
import { useToastStore } from '../store/toastStore';
import { Feather, Ionicons } from '@expo/vector-icons';
import { GoalCard, primaryGoalsData } from '../components/GoalSelectionView';
import { MetricsSelectionView } from '../components/MetricsSelectionView';
import { FoodPreferenceCard, foodPreferencesData } from '../components/FoodPreferenceSelectionView';
import {
  SelectableGridCard,
  SelectableBannerCard,
  DIET_RESTRICTIONS_DATA,
  PHYSICAL_CONDITIONS_DATA,
  SUPPLEMENTS_DATA,
} from '../components/SelectableTagCard';
import { ActivePlanView } from '../components/ActivePlanView';

// ponytail: opacity ramp stands in for blur — RN has no blur filter, BlurView isn't worth it here.
function StepIn({ delay = 0, style, children }: { delay?: number; style?: any; children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const t = Animated.timing(v, { toValue: 1, duration: 420, delay, useNativeDriver: true });
    t.start();
    return () => t.stop();
  }, []);
  return (
    <Animated.View
      style={[
        {
          opacity: v,
          transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

export function parseHeightToCm(input: string): number | null {
  if (!input) return null;
  const raw = input.trim().toLowerCase();

  // Explicit cm: e.g. "175 cm", "175cm"
  if (raw.includes('cm')) {
    const val = parseFloat(raw.replace(/[^0-9.]/g, ''));
    if (!isNaN(val) && val >= 90 && val <= 250) return Math.round(val);
    return null;
  }

  // Feet and inches: e.g. 5'10", 5'10, 5 ft 10 in, 5ft 10in, 5ft10, 5 10, 5-10
  const ftInMatch = raw.match(/^(\d+)\s*(?:'|ft|feet|\s|-)\s*(\d+(?:\.\d+)?)\s*(?:"|''|in|inch|inches)?$/i);
  if (ftInMatch) {
    const feet = parseFloat(ftInMatch[1]);
    const inches = parseFloat(ftInMatch[2]);
    if (feet >= 3 && feet <= 8 && inches >= 0 && inches < 12) {
      const cm = Math.round((feet * 12 + inches) * 2.54);
      if (cm >= 90 && cm <= 250) return cm;
    }
  }

  // Decimal feet format: e.g. 5.8, 5.10, 5.11, 5.8 ft
  const decMatch = raw.match(/^(\d+)\s*\.\s*(\d+)\s*(?:'|ft|feet)?$/i);
  if (decMatch) {
    const feet = parseFloat(decMatch[1]);
    const decPart = decMatch[2];
    if (feet >= 3 && feet <= 8) {
      const inches = parseFloat(decPart);
      if (inches >= 0 && inches < 12) {
        const cm = Math.round((feet * 12 + inches) * 2.54);
        if (cm >= 90 && cm <= 250) return cm;
      }
      const decimalFeet = parseFloat(`${feet}.${decPart}`);
      const cm = Math.round(decimalFeet * 30.48);
      if (cm >= 90 && cm <= 250) return cm;
    }
  }

  // Plain feet: e.g. "6ft", "6 ft", "6'", "5 feet"
  const justFtMatch = raw.match(/^(\d+(?:\.\d+)?)\s*(?:'|ft|feet)$/i);
  if (justFtMatch) {
    const feet = parseFloat(justFtMatch[1]);
    if (feet >= 3 && feet <= 8) {
      const cm = Math.round(feet * 30.48);
      if (cm >= 90 && cm <= 250) return cm;
    }
  }

  // Plain inches: e.g. "70 in", "70\"", "70 inches"
  const justInMatch = raw.match(/^(\d+(?:\.\d+)?)\s*(?:"|''|in|inch|inches)$/i);
  if (justInMatch) {
    const inches = parseFloat(justInMatch[1]);
    if (inches >= 36 && inches <= 98) {
      const cm = Math.round(inches * 2.54);
      if (cm >= 90 && cm <= 250) return cm;
    }
  }

  // Plain numeric
  const num = parseFloat(raw);
  if (!isNaN(num)) {
    if (num >= 90 && num <= 250) return Math.round(num);
    if (num >= 3 && num <= 8) {
      const parts = raw.split('.');
      if (parts.length === 2) {
        const feet = parseInt(parts[0], 10);
        const inches = parseInt(parts[1], 10);
        if (inches < 12) return Math.round((feet * 12 + inches) * 2.54);
      }
      return Math.round(num * 30.48);
    }
  }

  return null;
}

export default function VirlaAIScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ step?: string; goal?: string }>();
  const insets = useSafeAreaInsets();
  const { savedPlan, savePlan, clearPlan } = useAIWellnessStore();
  const profile = useUserProfileStore();

  const getProfileAge = () => {
    if (profile.dob) {
      const birth = new Date(profile.dob);
      if (!isNaN(birth.getTime())) {
        const diff = Date.now() - birth.getTime();
        const ageDate = new Date(diff);
        const calculatedAge = Math.abs(ageDate.getUTCFullYear() - 1970);
        if (calculatedAge >= 10 && calculatedAge <= 100) {
          return String(calculatedAge);
        }
      }
    }
    return '28';
  };

  // Onboarding Wizard Step (1: Welcome, 2-6: Questions, 7: Plan)
  const [step, setStep] = useState(() => {
    if (params.step) {
      const parsed = parseInt(params.step, 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 7) return parsed;
    }
    return 1;
  });

  // Form State Variables — Initialized with NO pre-selection (compulsory user input)
  const [age, setAge] = useState(() => (params as any).age || getProfileAge());
  const [gender, setGender] = useState('');
  const [height, setHeight] = useState(() => (params as any).height || (profile.height ? `${profile.height} cm` : '178 cm'));
  const [weight, setWeight] = useState(() => (params as any).weight || profile.weight || '72');
  const [fitnessGoal, setFitnessGoal] = useState('');
  const [activityLevel, setActivityLevel] = useState('');
  const [workoutFrequency, setWorkoutFrequency] = useState('');
  const [foodPreference, setFoodPreference] = useState('');
  const [selectedRestrictions, setSelectedRestrictions] = useState<string[]>([]);
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [otherConditionText, setOtherConditionText] = useState('');
  const [selectedSupplements, setSelectedSupplements] = useState<string[]>([]);
  const [otherSupplementText, setOtherSupplementText] = useState('');

  // Generation loading states
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [loadingText, setLoadingText] = useState('Analyzing body metrics...');
  const [generatedPlan, setGeneratedPlan] = useState<AIWellnessPlan | null>(null);

  // Animation values
  const [fadeAnim] = useState(() => new Animated.Value(1));

  // If a plan already exists, default to displaying it unless a specific step was requested
  useEffect(() => {
    if (params.step) {
      const parsed = parseInt(params.step, 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 7) {
        setStep(parsed);
        return;
      }
    }
    if (savedPlan) {
      setTimeout(() => setGeneratedPlan(savedPlan), 0);
    } else {
      setTimeout(() => {
        setGeneratedPlan(null);
        setStep(1);
      }, 0);
    }
  }, [savedPlan, params.step]);

  // Step Validity Checks (All 5 questions are strictly mandatory)
  const isStep2Valid = Boolean(fitnessGoal && workoutFrequency && activityLevel);
  const isStep3Valid = Boolean(gender && age.trim() && height.trim() && weight.trim());
  const isStep4Valid = Boolean(foodPreference && selectedRestrictions.length > 0);
  const isStep5Valid = Boolean(
    selectedConditions.length > 0 &&
    (!selectedConditions.includes('Other Condition') || otherConditionText.trim().length > 0)
  );
  const isStep6Valid = Boolean(
    selectedSupplements.length > 0 &&
    (!selectedSupplements.includes('Other') || otherSupplementText.trim().length > 0)
  );

  // Floating Toast Notification Helper for Mandatory Validation
  const showWarningToast = (title: string, message: string) => {
    try {
      Vibration.vibrate([0, 30, 40, 30]);
    } catch {}
    useToastStore.getState().showToast({
      title,
      message,
      type: 'warning',
      duration: 3500,
    });
  };

  const handleNext = () => {
    // When leaving Step 2 (Goal & Routine): strictly mandatory
    if (step === 2) {
      if (!fitnessGoal) {
        showWarningToast('Goal Required', 'Please select your target fitness goal to continue.');
        return;
      }
      if (!workoutFrequency) {
        showWarningToast('Frequency Required', 'Please select how many days per week you plan to train.');
        return;
      }
      if (!activityLevel) {
        showWarningToast('Activity Level Required', 'Please choose your daily activity level.');
        return;
      }
    }

    // When leaving Step 3 (Biometrics): strictly mandatory
    if (step === 3) {
      if (!gender) {
        showWarningToast('Gender Required', 'Please select your gender to proceed.');
        return;
      }
      const ageClean = age.trim().replace(/[^0-9]/g, '');
      const hClean = height.trim().replace(/[^0-9]/g, '');
      const wClean = weight.trim().replace(/[^0-9]/g, '');

      if (!ageClean) {
        showWarningToast('Missing Age', 'Please enter your age (10 - 100 years).');
        return;
      }
      const ageVal = parseInt(ageClean, 10);
      if (isNaN(ageVal) || ageVal < 10 || ageVal > 100) {
        showWarningToast('Invalid Age', 'Please enter a valid age between 10 and 100 years.');
        return;
      }

      if (!height.trim()) {
        showWarningToast('Missing Height', 'Please enter your height in cm or ft/in.');
        return;
      }
      const parsedCm = parseHeightToCm(height);
      if (!parsedCm || parsedCm < 90 || parsedCm > 250) {
        showWarningToast('Invalid Height', 'Please enter a valid height between 90 and 250 cm.');
        return;
      }

      if (!wClean) {
        showWarningToast('Missing Weight', 'Please enter your weight in kg (30 - 250 kg).');
        return;
      }
      const wVal = parseInt(wClean, 10);
      if (isNaN(wVal) || wVal < 30 || wVal > 250) {
        showWarningToast('Invalid Weight', 'Please enter a valid weight between 30 and 250 kg.');
        return;
      }
    }

    // When leaving Step 4 (Nutrition & Diet): strictly mandatory
    if (step === 4) {
      if (!foodPreference) {
        showWarningToast('Diet Style Required', 'Please select your dietary lifestyle (e.g. Vegetarian, Non-Vegetarian).');
        return;
      }
      if (selectedRestrictions.length === 0) {
        showWarningToast('Diet Restrictions Required', 'Please select your dietary restrictions, or choose "No Restrictions".');
        return;
      }
    }

    // When leaving Step 5 (Physical Safeguards): strictly mandatory
    if (step === 5) {
      if (selectedConditions.length === 0) {
        showWarningToast('Safeguards Required', 'Please select any joint or health conditions, or choose "None / No Health Issues".');
        return;
      }
      if (selectedConditions.includes('Other Condition') && !otherConditionText.trim()) {
        showWarningToast('Description Required', 'Please specify your physical condition or injury in the text box.');
        return;
      }
    }

    // Trigger step transition animation
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true })
    ]).start();

    if (step < 6) {
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
    } else {
      router.back();
    }
  };

  const toggleTag = (tag: string, list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>) => {
    if (tag === 'No Restrictions' || tag === 'None' || tag === 'None / No Health Issues' || tag === 'None / No Supplements') {
      setList(prev => prev.includes(tag) ? [] : [tag]);
      return;
    }
    
    setList(prev => {
      const filtered = prev.filter(item => 
        item !== 'No Restrictions' && 
        item !== 'None' && 
        item !== 'None / No Health Issues' && 
        item !== 'None / No Supplements'
      );
      if (filtered.includes(tag)) {
        return filtered.filter(item => item !== tag);
      } else {
        return [...filtered, tag];
      }
    });
  };

  const handleGenerate = () => {
    // When finishing Step 6 (Supplements Stack): strictly mandatory
    if (selectedSupplements.length === 0) {
      showWarningToast('Supplements Required', 'Please select any supplements you take, or choose "None / No Supplements" to proceed.');
      return;
    }
    if (selectedSupplements.includes('Other') && !otherSupplementText.trim()) {
      showWarningToast('Description Required', 'Please specify your other supplements in the text box.');
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);
    setLoadingText('Analyzing body metrics...');

    const interval = setInterval(() => {
      setGenerationProgress(prev => {
        const next = prev + 25;
        if (next === 25) setLoadingText('Calculating BMR & caloric deficit...');
        if (next === 50) setLoadingText('Personalizing macronutrient targets...');
        if (next === 75) setLoadingText('Synthesizing injury-adapted training...');
        if (next >= 100) {
          clearInterval(interval);
          const computedPlan = runWellnessGenerator();
          setGeneratedPlan(computedPlan);
          setIsGenerating(false);
          setStep(7);
        }
        return next;
      });
    }, 550);
  };

  const runWellnessGenerator = (): AIWellnessPlan => {
    const wVal = parseFloat(weight) || 70;
    const parsedCm = parseHeightToCm(height);
    const hVal = parsedCm || parseFloat(height) || 170;
    const aVal = parseFloat(age) || 28;

    // 1. Mifflin-St Jeor BMR Equation
    let bmr = 10 * wVal + 6.25 * hVal - 5 * aVal;
    if (gender === 'Male') bmr += 5;
    else if (gender === 'Female') bmr -= 161;
    else bmr -= 80;

    // 2. Activity Multiplier
    let multiplier = 1.375; // Lightly Active default
    if (activityLevel === 'Sedentary') multiplier = 1.2;
    else if (activityLevel === 'Moderately Active') multiplier = 1.55;
    else if (activityLevel === 'Active') multiplier = 1.725;
    else if (activityLevel === 'Athlete') multiplier = 1.9;

    const tdee = bmr * multiplier;

    // 3. Goal Calorie Adjustment
    let calorieGoal = Math.round(tdee);
    if (fitnessGoal === 'Weight Loss' || fitnessGoal === 'Fat Loss') {
      calorieGoal = Math.round(tdee - 450);
    } else if (fitnessGoal === 'Muscle Gain') {
      calorieGoal = Math.round(tdee + 350);
    } else if (fitnessGoal === 'Strength' || fitnessGoal === 'Sports Performance') {
      calorieGoal = Math.round(tdee + 150);
    }
    const safeCalorieFloor = gender === 'Female' ? 1250 : 1500;
    calorieGoal = Math.max(safeCalorieFloor, calorieGoal);

    // 4. Protein Target
    let proteinMultiplier = 1.6;
    if (fitnessGoal === 'Muscle Gain' || fitnessGoal === 'Strength' || fitnessGoal === 'Sports Performance') {
      proteinMultiplier = 2.0;
    } else if (fitnessGoal === 'Weight Loss' || fitnessGoal === 'Fat Loss') {
      proteinMultiplier = 1.8; // Preserves lean muscle mass in caloric deficit
    }
    const proteinTarget = Math.round(wVal * proteinMultiplier);

    // 5. Fat Target (25% of calories)
    const fatCalories = calorieGoal * 0.25;
    const fatTarget = Math.round(fatCalories / 9);

    // 6. Carbs Target (Remaining calories)
    const carbCalories = calorieGoal - (proteinTarget * 4) - (fatTarget * 9);
    const carbTarget = Math.max(60, Math.round(carbCalories / 4));

    // 7. Scientific Hydration Target
    let lit = Math.round(wVal * 0.035 * 10) / 10;
    if (activityLevel === 'Active' || activityLevel === 'Athlete') lit += 0.5;
    const hydrationGoal = `${lit.toFixed(1)} Liters daily (~${Math.round(lit * 4)} glasses)`;

    // 8. Adaptive Meal Suggestions
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

    // 9. Workout Recommendation & Injury Adaptation
    let workout = `Functional cardio: ${workoutFrequency} days/wk dynamic circuits with core stabilization and mobility.`;
    if (fitnessGoal === 'Muscle Gain' || fitnessGoal === 'Strength') {
      workout = `Hypertrophy & progressive overload strength training ${workoutFrequency} days per week, prioritising recovery between muscle groups.`;
    } else if (fitnessGoal === 'Weight Loss' || fitnessGoal === 'Fat Loss') {
      workout = `HIIT & resistance split ${workoutFrequency} days/wk to maximize caloric expenditure + progressive weekly volume.`;
    } else if (fitnessGoal === 'Flexibility') {
      workout = `Active stretching & Vinyasa flows ${workoutFrequency} days/wk with focus on joint range of motion.`;
    } else if (fitnessGoal === 'Endurance' || fitnessGoal === 'Sports Performance') {
      workout = `Paced aerobic intervals & multi-planar agility drills ${workoutFrequency} days/wk.`;
    }

    // Direct clinical safeguards based on selected physical conditions
    if (selectedConditions.includes('Lower Back Pain')) {
      workout += ' Safeguard: Lumbar decompressions included; axial compressive loading avoided.';
    }
    if (selectedConditions.includes('Knee Stiffness')) {
      workout += ' Safeguard: Isometric quadriceps strengthening with low-impact joint mechanics.';
    }
    if (selectedConditions.includes('Asthma')) {
      workout += ' Safeguard: Structured warmup pacing and extended aerobic recovery intervals.';
    }

    // 10. Step Goal
    let stepGoal = 8000;
    if (activityLevel === 'Active') stepGoal = 10000;
    else if (activityLevel === 'Athlete') stepGoal = 12000;

    // Sleep timing recommendation
    const sleepRec = '7.5 - 8.5 hours. Maintain consistent sleep and wake timing for optimal endocrine recovery.';

    // Progress Targets
    let progress = ['Log daily hydration targets', 'Maintain training consistency this week', 'Complete daily step goals'];
    if (fitnessGoal === 'Weight Loss' || fitnessGoal === 'Fat Loss') {
      progress = ['Maintain calorie deficit of 450 kcal', 'Complete all scheduled HIIT cycles', 'Track weekly body recomposition'];
    } else if (fitnessGoal === 'Muscle Gain') {
      progress = [`Hit target ${proteinTarget}g daily protein`, 'Complete progressively heavier lifts', 'Secure 8 hours of deep recovery'];
    }

    const displayHeight = parsedCm ? `${parsedCm} cm` : height;

    return {
      age,
      gender,
      height: displayHeight,
      weight,
      fitnessGoal,
      activityLevel,
      workoutFrequency: `${workoutFrequency} Days/Wk`,
      preferredDuration: '45 min',
      wakeupTime: '06:30 AM',
      sleepTime: '10:30 PM',
      lifestyle: ['Active Schedule'],
      foodPreference: foodPreference || 'Balanced',
      dietRestrictions: selectedRestrictions.length > 0 ? selectedRestrictions : ['No Restrictions'],
      medicalConditions: (
        selectedConditions.length > 0
          ? selectedConditions.map(c => (c === 'Other Condition' && otherConditionText.trim()) ? `Other: ${otherConditionText.trim()}` : c)
          : ['None']
      ),
      waterIntake: `${lit.toFixed(1)} L baseline`,
      supplements: (
        selectedSupplements.length > 0
          ? selectedSupplements.map(s => (s === 'Other' && otherSupplementText.trim()) ? `Other: ${otherSupplementText.trim()}` : s)
          : ['None']
      ),
      dailyCalories: calorieGoal,
      proteinTarget,
      carbTarget,
      fatTarget,
      hydrationGoal,
      mealTiming: 'Regular consistent pacing with 3 balanced meals + healthy snacks',
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

  const TOTAL_STEPS = 5;
  const progressPercent = step === 1 ? 8 : Math.min(100, Math.round(((step - 1) / TOTAL_STEPS) * 100));
  const progressWidthAnim = useRef(new Animated.Value(progressPercent)).current;

  useEffect(() => {
    Animated.timing(progressWidthAnim, {
      toValue: progressPercent,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [progressPercent]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: '#FFFFFF' }}
    >
      <StatusBar style="dark" />

      {/* Unified Header & Status Bar Area - Seamless canvas without white bleed */}
      <View style={{ paddingTop: insets.top, backgroundColor: '#FFFFFF' }} className="z-10">
        <View className="h-14 flex-row items-center px-4 justify-between">
          {step > 1 && !generatedPlan ? (
            <TouchableOpacity 
              onPress={handleBack} 
              activeOpacity={0.6}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              className="w-10 h-10 items-center justify-center rounded-full"
            >
              <Ionicons name="arrow-back" size={24} color="#0F172A" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              onPress={() => router.back()} 
              activeOpacity={0.6}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              className="w-10 h-10 items-center justify-center rounded-full bg-slate-100/80"
            >
              <Ionicons name="close" size={20} color="#0F172A" />
            </TouchableOpacity>
          )}

          <View className="flex-1 items-center justify-center px-2">
            {generatedPlan ? (
              <View className="flex-row items-center gap-2">
                <Image
                  source={require('../../assets/images/ai-coach-emblem.png')}
                  style={{ width: 22, height: 22 }}
                  resizeMode="contain"
                />
                <View className="items-center">
                  <Text className="text-[#0F172A] text-base font-semibold tracking-tight text-center">
                    My AI Wellness Plan
                  </Text>
                  <Text className="text-[#64748B] text-[11px] font-medium tracking-wide text-center">
                    Virla Protocol
                  </Text>
                </View>
              </View>
            ) : (
              <View className="flex-row items-center gap-2">
                <Image
                  source={require('../../assets/images/ai-coach-emblem.png')}
                  style={{ width: 22, height: 22 }}
                  resizeMode="contain"
                />
                <Text className="text-[#0F172A] text-base font-bold text-center">
                  AI Wellness Coach
                </Text>
              </View>
            )}
          </View>

          {generatedPlan ? (
            <TouchableOpacity
              onPress={handleRegenerate}
              activeOpacity={0.6}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              className="w-10 h-10 items-center justify-center rounded-full bg-slate-100/80"
            >
              <Feather name="refresh-cw" size={17} color="#0F172A" />
            </TouchableOpacity>
          ) : step > 1 ? (
            <View
              style={{
                backgroundColor: '#FFE4E6',
                paddingHorizontal: 12,
                paddingVertical: 4.5,
                borderRadius: 9999,
              }}
            >
              <Text
                style={{
                  fontSize: 11.5,
                  fontWeight: '700',
                  color: '#E11D48',
                  letterSpacing: 0.8,
                }}
              >
                {step - 1} / {TOTAL_STEPS}
              </Text>
            </View>
          ) : (
            <View className="w-10" />
          )}
        </View>
      </View>

      {/* Screen Body - Pure canvas without boxed white background cards */}
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        {isGenerating ? (
          /* ========================================== */
          /* ============= GENERATION LOADER ============ */
          /* ========================================== */
          <View className="flex-1 justify-center items-center px-8">
            <View className="items-center gap-5 w-full max-w-sm">
              <View 
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: 42,
                  backgroundColor: '#FFFFFF',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1.5,
                  borderColor: '#FDA4AF',
                  shadowColor: '#E11D48',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.18,
                  shadowRadius: 12,
                  elevation: 3,
                }}
              >
                <Image
                  source={require('../../assets/images/ai-coach-emblem.png')}
                  style={{ width: 54, height: 54 }}
                  resizeMode="contain"
                />
              </View>
              
              <View className="items-center gap-1.5 px-2">
                <Text className="text-[#101828] text-xl font-bold tracking-tight text-center">
                  {loadingText}
                </Text>
                <Text className="text-[#64748B] text-xs font-normal text-center leading-relaxed">
                  Calibrating tailored targets with Mifflin-St Jeor engine
                </Text>
              </View>
              
              {/* Progress bar container */}
              <View className="w-full gap-2 mt-4">
                <View className="w-full h-2 bg-[#E2E8F0] rounded-full overflow-hidden">
                  <View 
                    className="h-full bg-[#E11D48] rounded-full"
                    style={{ width: `${generationProgress}%` }}
                  />
                </View>
                <View className="flex-row justify-between items-center px-1">
                  <Text className="text-[#6B7280] text-[10px] font-bold uppercase tracking-wider">
                    Compiling Protocol
                  </Text>
                  <Text className="text-[#E11D48] text-xs font-bold">
                    {generationProgress}%
                  </Text>
                </View>
              </View>
            </View>
          </View>
        ) : generatedPlan ? (
          /* ========================================== */
          /* ============= ACTIVE PLAN VIEW ============ */
          /* ========================================== */
          <ActivePlanView
            plan={generatedPlan}
            onSavePlan={handleSavePlan}
            onRegenerate={handleRegenerate}
            isSaved={!!savedPlan}
            bottomInset={insets.bottom}
          />
        ) : (
          /* ========================================== */
          /* ============= ONBOARDING STEPS ============= */
          /* ========================================== */
          <View style={{ flex: 1 }}>
            <ScrollView 
              showsVerticalScrollIndicator={false} 
              contentContainerStyle={{ 
                flexGrow: 1,
                paddingHorizontal: 22, 
                paddingTop: 12,
                paddingBottom: step === 6 ? 96 : Math.max(insets.bottom, 24) + 20 
              }}
            >
              <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
              
              {/* STEP 1: Welcome Intro */}
              {step === 1 && (
                <View className="flex-1 justify-between pb-2">
                  <View className="gap-3.5 pt-2">
                    <StepIn delay={0}>
                    <View className="items-center">
                      <Image
                        source={require('../../assets/images/ai-coach-emblem.png')}
                        style={{ width: 96, height: 96 }}
                        resizeMode="contain"
                      />
                    </View>
                    </StepIn>

                    <StepIn delay={90}>
                    <View className="gap-1.5 items-center px-2">
                      <Text
                        style={{
                          color: '#0F172A',
                          fontSize: 27,
                          fontWeight: '400',
                          letterSpacing: -0.7,
                          textAlign: 'center',
                          lineHeight: 32,
                        }}
                      >
                        Create Your AI Wellness Plan
                      </Text>
                      <Text
                        style={{
                          color: '#64748B',
                          fontSize: 13,
                          fontWeight: '400',
                          lineHeight: 20,
                          letterSpacing: 0,
                          textAlign: 'center',
                          marginTop: 2,
                        }}
                      >
                        Answer 5 quick wellness questions so VIRLA AI can calculate your personalized macro targets, hydration, and training routine.
                      </Text>
                    </View>
                    </StepIn>

                    {/* Feature Highlights - white cards matching goal grid */}
                    <View className="gap-3.5 my-1">
                      {[
                        { icon: 'target', title: 'Personalized Caloric Targets', desc: 'Calculated with scientific BMR and activity equations' },
                        { icon: 'pie-chart', title: 'Tailored Macro & Meal Guidance', desc: 'Custom meal splits respecting your dietary restrictions' },
                        { icon: 'moon', title: 'Lifestyle-Synced Recovery', desc: 'Sleep consistency and step goals matched to your day' },
                      ].map((f: any, i: number) => (
                        <StepIn key={f.title} delay={180 + i * 90}>
                        <View
                          style={{
                            backgroundColor: '#FFFFFF',
                            borderColor: '#F1F5F9',
                            borderWidth: 1.4,
                            borderRadius: 22,
                            padding: 14,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 12,
                            shadowColor: '#0F172A',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.04,
                            shadowRadius: 6,
                            elevation: 1.5,
                          }}
                        >
                          <View
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 16,
                              backgroundColor: '#FFE4E6',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Feather name={f.icon} size={17} color="#E11D48" />
                          </View>
                          <View className="flex-1">
                            <Text
                              style={{
                                color: '#0F172A',
                                fontSize: 14,
                                fontWeight: '700',
                                letterSpacing: -0.3,
                              }}
                            >
                              {f.title}
                            </Text>
                            <Text
                              style={{
                                color: '#64748B',
                                fontSize: 12,
                                fontWeight: '400',
                                lineHeight: 18,
                                letterSpacing: 0,
                                marginTop: 2,
                              }}
                            >
                              {f.desc}
                            </Text>
                          </View>
                        </View>
                        </StepIn>
                      ))}
                    </View>
                  </View>

                  <StepIn delay={480}>
                  <View className="gap-2 mt-2">
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() => {
                        try {
                          Vibration.vibrate(12);
                        } catch {}
                        handleNext();
                      }}
                      style={{
                        backgroundColor: '#E11D48',
                        height: 56,
                        borderRadius: 20,
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'row',
                        gap: 10,
                        shadowColor: '#E11D48',
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.3,
                        shadowRadius: 12,
                        elevation: 4,
                      }}
                      className="w-full mt-1"
                    >
                      <Text
                        style={{
                          color: '#FFFFFF',
                          fontSize: 15,
                          fontWeight: '800',
                          letterSpacing: 0.8,
                          textTransform: 'uppercase',
                        }}
                      >
                        Start Assessment
                      </Text>
                      <Feather name="arrow-right" size={17} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                  </StepIn>
                </View>
              )}

              {/* STEP 2 (Question 1/5): Primary Goal & Workout Frequency */}
              {step === 2 && (
                <View className="flex-1 justify-between pb-2">
                  <View className="gap-5">
                    <StepIn delay={0}>
                      <View className="gap-1.5">
                        <View className="flex-row items-center justify-between">
                          <Text
                            style={{
                              color: '#0F172A',
                              fontSize: 27,
                              fontWeight: '700',
                              letterSpacing: -0.7,
                              lineHeight: 32,
                              marginTop: 2,
                            }}
                          >
                            Primary Goal & Routine <Text style={{ color: '#E11D48', fontWeight: '800' }}>*</Text>
                          </Text>
                        </View>
                        <Text
                          style={{
                            color: '#64748B',
                            fontSize: 13,
                            fontWeight: '400',
                            lineHeight: 20,
                          }}
                        >
                          Select your primary wellness target and how frequently you can commit to workouts.
                        </Text>
                      </View>
                    </StepIn>

                    {/* Section 1: Target Fitness Goal */}
                    <View className="gap-2.5">
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '800',
                          textTransform: 'uppercase',
                          letterSpacing: 0.8,
                          color: '#64748B',
                          paddingLeft: 2,
                        }}
                      >
                        Target Goal <Text style={{ color: '#E11D48', fontWeight: '800' }}>*</Text>
                      </Text>
                      <View className="flex-row flex-wrap justify-between gap-y-3.5 my-1">
                        {primaryGoalsData.map((goal, i) => (
                          <GoalCard
                            key={goal.id}
                            goal={goal}
                            isSelected={fitnessGoal === goal.id}
                            onSelect={setFitnessGoal}
                            index={i}
                          />
                        ))}
                      </View>
                    </View>

                    {/* Section 2: Days per week */}
                    <View style={{ marginTop: 8 }}>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '800',
                          textTransform: 'uppercase',
                          letterSpacing: 0.8,
                          color: '#64748B',
                          paddingLeft: 2,
                          marginBottom: 12,
                        }}
                      >
                        Training frequency (days / week) <Text style={{ color: '#E11D48', fontWeight: '800' }}>*</Text>
                      </Text>
                      <View className="flex-row justify-between gap-2">
                        {['2', '3', '4', '5', '6'].map((num, n) => {
                          const isSel = workoutFrequency === num;
                          return (
                            <StepIn key={num} delay={100 + n * 40} style={{ flex: 1 }}>
                              <TouchableOpacity
                                activeOpacity={0.9}
                                onPress={() => {
                                  try { Vibration.vibrate(10); } catch {}
                                  setWorkoutFrequency(num);
                                }}
                                style={{
                                  width: '100%',
                                  height: 52,
                                  borderRadius: 18,
                                  backgroundColor: isSel ? '#E11D48' : '#FFFFFF',
                                  borderColor: isSel ? '#E11D48' : '#F1F5F9',
                                  borderWidth: isSel ? 2 : 1.4,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  shadowColor: isSel ? '#E11D48' : '#0F172A',
                                  shadowOffset: { width: 0, height: isSel ? 4 : 2 },
                                  shadowOpacity: isSel ? 0.2 : 0.04,
                                  shadowRadius: isSel ? 10 : 6,
                                  elevation: isSel ? 3.5 : 1.5,
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 15,
                                    fontWeight: '700',
                                    letterSpacing: -0.3,
                                    color: isSel ? '#FFFFFF' : '#0F172A',
                                    textAlign: 'center',
                                  }}
                                >
                                  {num}d
                                </Text>
                              </TouchableOpacity>
                            </StepIn>
                          );
                        })}
                      </View>
                    </View>

                    {/* Section 3: Daily Activity Level */}
                    <View style={{ marginTop: 8 }}>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '800',
                          textTransform: 'uppercase',
                          letterSpacing: 0.8,
                          color: '#64748B',
                          paddingLeft: 2,
                          marginBottom: 10,
                        }}
                      >
                        Daily Activity Level <Text style={{ color: '#E11D48', fontWeight: '800' }}>*</Text>
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                        {[
                          { id: 'Sedentary', label: 'Desk / Sedentary' },
                          { id: 'Moderately Active', label: 'Moderately Active' },
                          { id: 'Active', label: 'Very Active' },
                          { id: 'Athlete', label: 'Athlete / Physical Job' },
                        ].map((act) => {
                          const isSel = activityLevel === act.id;
                          return (
                            <TouchableOpacity
                              key={act.id}
                              activeOpacity={0.9}
                              onPress={() => {
                                try { Vibration.vibrate(10); } catch {}
                                setActivityLevel(act.id);
                              }}
                              style={{
                                paddingHorizontal: 16,
                                paddingVertical: 12,
                                borderRadius: 16,
                                backgroundColor: isSel ? '#FFF5F6' : '#FFFFFF',
                                borderColor: isSel ? '#E11D48' : '#F1F5F9',
                                borderWidth: isSel ? 1.8 : 1.2,
                                shadowColor: isSel ? '#E11D48' : '#0F172A',
                                shadowOffset: { width: 0, height: isSel ? 3 : 1 },
                                shadowOpacity: isSel ? 0.16 : 0.03,
                                shadowRadius: isSel ? 8 : 4,
                                elevation: isSel ? 2 : 1,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 13,
                                  fontWeight: isSel ? '700' : '600',
                                  color: isSel ? '#E11D48' : '#334155',
                                }}
                              >
                                {act.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  </View>

                  <StepIn delay={300}>
                    <View className="gap-2 mt-8 mb-2">
                      <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => {
                          try { Vibration.vibrate(12); } catch {}
                          handleNext();
                        }}
                        style={{
                          backgroundColor: isStep2Valid ? '#E11D48' : '#FDA4AF',
                          height: 56,
                          borderRadius: 20,
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexDirection: 'row',
                          gap: 10,
                          shadowColor: '#E11D48',
                          shadowOffset: { width: 0, height: 6 },
                          shadowOpacity: isStep2Valid ? 0.3 : 0.08,
                          shadowRadius: 12,
                          elevation: 4,
                          opacity: isStep2Valid ? 1 : 0.65,
                        }}
                        className="w-full mt-1"
                      >
                        <Text
                          style={{
                            color: '#FFFFFF',
                            fontSize: 15,
                            fontWeight: '800',
                            letterSpacing: 0.8,
                            textTransform: 'uppercase',
                          }}
                        >
                          CONTINUE
                        </Text>
                        <Feather name="arrow-right" size={17} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  </StepIn>
                </View>
              )}

              {/* STEP 3 (Question 2/5): Basic Metrics */}
              {step === 3 && (
                <MetricsSelectionView
                  gender={gender}
                  setGender={setGender}
                  age={age}
                  setAge={setAge}
                  height={height}
                  setHeight={setHeight}
                  weight={weight}
                  setWeight={setWeight}
                  onContinue={handleNext}
                  onBack={handleBack}
                  showHeader={false}
                  stepNumber={2}
                  totalSteps={5}
                />
              )}

              {/* STEP 4 (Question 3/5): Nutrition & Dietary Preferences */}
              {step === 4 && (
                <View className="flex-1 justify-between pb-2">
                  <View className="gap-5">
                    <StepIn delay={0}>
                      <View className="gap-1.5">
                        <View className="flex-row items-center justify-between">
                          <Text
                            style={{
                              color: '#0F172A',
                              fontSize: 26,
                              fontWeight: '700',
                              letterSpacing: -0.7,
                              lineHeight: 32,
                              marginTop: 2,
                            }}
                          >
                            Nutrition & Diet Preferences <Text style={{ color: '#E11D48', fontWeight: '800' }}>*</Text>
                          </Text>
                        </View>
                        <Text
                          style={{
                            color: '#64748B',
                            fontSize: 13,
                            fontWeight: '400',
                            lineHeight: 20,
                          }}
                        >
                          Select your primary dietary style and any medical or allergy restrictions.
                        </Text>
                      </View>
                    </StepIn>

                    {/* Section 1: Diet Style */}
                    <View className="gap-2.5">
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '800',
                          textTransform: 'uppercase',
                          letterSpacing: 0.8,
                          color: '#64748B',
                          paddingLeft: 2,
                        }}
                      >
                        Dietary Lifestyle <Text style={{ color: '#E11D48', fontWeight: '800' }}>*</Text>
                      </Text>
                      <View style={{ gap: 12 }}>
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                          <FoodPreferenceCard
                            item={foodPreferencesData[0]}
                            isSelected={foodPreference === foodPreferencesData[0].id}
                            onSelect={setFoodPreference}
                            index={0}
                          />
                          <FoodPreferenceCard
                            item={foodPreferencesData[3]}
                            isSelected={foodPreference === foodPreferencesData[3].id}
                            onSelect={setFoodPreference}
                            index={1}
                          />
                        </View>
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                          <FoodPreferenceCard
                            item={foodPreferencesData[1]}
                            isSelected={foodPreference === foodPreferencesData[1].id}
                            onSelect={setFoodPreference}
                            index={2}
                          />
                          <FoodPreferenceCard
                            item={foodPreferencesData[2]}
                            isSelected={foodPreference === foodPreferencesData[2].id}
                            onSelect={setFoodPreference}
                            index={3}
                          />
                        </View>
                      </View>
                    </View>

                    {/* Section 2: Diet Restrictions */}
                    <View className="gap-2.5 mt-2">
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '800',
                          textTransform: 'uppercase',
                          letterSpacing: 0.8,
                          color: '#64748B',
                          paddingLeft: 2,
                        }}
                      >
                        Diet Restrictions & Allergies <Text style={{ color: '#E11D48', fontWeight: '800' }}>*</Text>
                      </Text>
                      <View style={{ gap: 12 }}>
                        {/* Row 1: Diabetes & Hypertension */}
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                          <SelectableGridCard
                            item={DIET_RESTRICTIONS_DATA[0]}
                            isSelected={selectedRestrictions.includes(DIET_RESTRICTIONS_DATA[0].id)}
                            onToggle={() => toggleTag(DIET_RESTRICTIONS_DATA[0].id, selectedRestrictions, setSelectedRestrictions)}
                            index={0}
                          />
                          <SelectableGridCard
                            item={DIET_RESTRICTIONS_DATA[1]}
                            isSelected={selectedRestrictions.includes(DIET_RESTRICTIONS_DATA[1].id)}
                            onToggle={() => toggleTag(DIET_RESTRICTIONS_DATA[1].id, selectedRestrictions, setSelectedRestrictions)}
                            index={1}
                          />
                        </View>

                        {/* Row 2: High Cholesterol & Lactose Intolerant */}
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                          <SelectableGridCard
                            item={DIET_RESTRICTIONS_DATA[2]}
                            isSelected={selectedRestrictions.includes(DIET_RESTRICTIONS_DATA[2].id)}
                            onToggle={() => toggleTag(DIET_RESTRICTIONS_DATA[2].id, selectedRestrictions, setSelectedRestrictions)}
                            index={2}
                          />
                          <SelectableGridCard
                            item={DIET_RESTRICTIONS_DATA[3]}
                            isSelected={selectedRestrictions.includes(DIET_RESTRICTIONS_DATA[3].id)}
                            onToggle={() => toggleTag(DIET_RESTRICTIONS_DATA[3].id, selectedRestrictions, setSelectedRestrictions)}
                            index={3}
                          />
                        </View>

                        {/* Row 3: Gluten Free & Nut Allergy */}
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                          <SelectableGridCard
                            item={DIET_RESTRICTIONS_DATA[4]}
                            isSelected={selectedRestrictions.includes(DIET_RESTRICTIONS_DATA[4].id)}
                            onToggle={() => toggleTag(DIET_RESTRICTIONS_DATA[4].id, selectedRestrictions, setSelectedRestrictions)}
                            index={4}
                          />
                          <SelectableGridCard
                            item={DIET_RESTRICTIONS_DATA[5]}
                            isSelected={selectedRestrictions.includes(DIET_RESTRICTIONS_DATA[5].id)}
                            onToggle={() => toggleTag(DIET_RESTRICTIONS_DATA[5].id, selectedRestrictions, setSelectedRestrictions)}
                            index={5}
                          />
                        </View>

                        {/* Row 4: No Restrictions Banner Card */}
                        <SelectableBannerCard
                          item={DIET_RESTRICTIONS_DATA[6]}
                          isSelected={selectedRestrictions.includes(DIET_RESTRICTIONS_DATA[6].id)}
                          onToggle={() => toggleTag(DIET_RESTRICTIONS_DATA[6].id, selectedRestrictions, setSelectedRestrictions)}
                          index={6}
                        />
                      </View>
                    </View>
                  </View>

                  <StepIn delay={250}>
                    <View className="gap-2 mt-8 mb-2">
                      <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => {
                          try { Vibration.vibrate(12); } catch {}
                          handleNext();
                        }}
                        style={{
                          backgroundColor: isStep4Valid ? '#E11D48' : '#FDA4AF',
                          height: 56,
                          borderRadius: 20,
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexDirection: 'row',
                          gap: 10,
                          shadowColor: '#E11D48',
                          shadowOffset: { width: 0, height: 6 },
                          shadowOpacity: isStep4Valid ? 0.3 : 0.08,
                          shadowRadius: 12,
                          elevation: 4,
                          opacity: isStep4Valid ? 1 : 0.65,
                        }}
                        className="w-full mt-1"
                      >
                        <Text
                          style={{
                            color: '#FFFFFF',
                            fontSize: 15,
                            fontWeight: '800',
                            letterSpacing: 0.8,
                            textTransform: 'uppercase',
                          }}
                        >
                          CONTINUE
                        </Text>
                        <Feather name="arrow-right" size={17} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  </StepIn>
                </View>
              )}

              {/* STEP 5 (Question 4/5): Physical Limitations & Health Considerations */}
              {step === 5 && (
                <View className="flex-1 justify-between pb-2">
                  <View className="gap-5">
                    <StepIn delay={0}>
                      <View className="gap-1.5">
                        <View className="flex-row items-center justify-between">
                          <Text
                            style={{
                              color: '#0F172A',
                              fontSize: 25,
                              fontWeight: '700',
                              letterSpacing: -0.7,
                              lineHeight: 32,
                              marginTop: 2,
                            }}
                          >
                            Physical Safeguards <Text style={{ color: '#E11D48', fontWeight: '800' }}>*</Text>
                          </Text>
                        </View>
                        <Text
                          style={{
                            color: '#64748B',
                            fontSize: 13,
                            fontWeight: '400',
                            lineHeight: 20,
                          }}
                        >
                          Select any physical limitations or choose "None / No Health Issues".
                        </Text>
                      </View>
                    </StepIn>

                    <View style={{ gap: 12 }}>
                      {/* Row 1: Lower Back Pain & Knee Stiffness */}
                      <View style={{ flexDirection: 'row', gap: 12 }}>
                        <SelectableGridCard
                          item={PHYSICAL_CONDITIONS_DATA[0]}
                          isSelected={selectedConditions.includes(PHYSICAL_CONDITIONS_DATA[0].id)}
                          onToggle={() => toggleTag(PHYSICAL_CONDITIONS_DATA[0].id, selectedConditions, setSelectedConditions)}
                          index={0}
                        />
                        <SelectableGridCard
                          item={PHYSICAL_CONDITIONS_DATA[1]}
                          isSelected={selectedConditions.includes(PHYSICAL_CONDITIONS_DATA[1].id)}
                          onToggle={() => toggleTag(PHYSICAL_CONDITIONS_DATA[1].id, selectedConditions, setSelectedConditions)}
                          index={1}
                        />
                      </View>

                      {/* Row 2: Shoulder / Neck & Asthma */}
                      <View style={{ flexDirection: 'row', gap: 12 }}>
                        <SelectableGridCard
                          item={PHYSICAL_CONDITIONS_DATA[2]}
                          isSelected={selectedConditions.includes(PHYSICAL_CONDITIONS_DATA[2].id)}
                          onToggle={() => toggleTag(PHYSICAL_CONDITIONS_DATA[2].id, selectedConditions, setSelectedConditions)}
                          index={2}
                        />
                        <SelectableGridCard
                          item={PHYSICAL_CONDITIONS_DATA[3]}
                          isSelected={selectedConditions.includes(PHYSICAL_CONDITIONS_DATA[3].id)}
                          onToggle={() => toggleTag(PHYSICAL_CONDITIONS_DATA[3].id, selectedConditions, setSelectedConditions)}
                          index={3}
                        />
                      </View>

                      {/* Row 3: Thyroid & Other Condition */}
                      <View style={{ flexDirection: 'row', gap: 12 }}>
                        <SelectableGridCard
                          item={PHYSICAL_CONDITIONS_DATA[4]}
                          isSelected={selectedConditions.includes(PHYSICAL_CONDITIONS_DATA[4].id)}
                          onToggle={() => toggleTag(PHYSICAL_CONDITIONS_DATA[4].id, selectedConditions, setSelectedConditions)}
                          index={4}
                        />
                        <SelectableGridCard
                          item={PHYSICAL_CONDITIONS_DATA[5]}
                          isSelected={selectedConditions.includes(PHYSICAL_CONDITIONS_DATA[5].id)}
                          onToggle={() => toggleTag(PHYSICAL_CONDITIONS_DATA[5].id, selectedConditions, setSelectedConditions)}
                          index={5}
                        />
                      </View>

                      {/* Row 4: None / No Health Issues Banner Card */}
                      <SelectableBannerCard
                        item={PHYSICAL_CONDITIONS_DATA[6]}
                        isSelected={selectedConditions.includes(PHYSICAL_CONDITIONS_DATA[6].id)}
                        onToggle={() => toggleTag(PHYSICAL_CONDITIONS_DATA[6].id, selectedConditions, setSelectedConditions)}
                        index={6}
                      />

                      {/* Custom condition input box */}
                      {selectedConditions.includes('Other Condition') && (
                        <View
                          style={{
                            backgroundColor: '#FFFFFF',
                            borderColor: '#E2E8F0',
                            borderWidth: 1.5,
                            borderRadius: 20,
                            paddingHorizontal: 16,
                            paddingVertical: 14,
                            shadowColor: '#0F172A',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.04,
                            shadowRadius: 6,
                            elevation: 1.5,
                          }}
                        >
                          <TextInput
                            placeholder="Type your condition or injury here..."
                            placeholderTextColor="#94A3B8"
                            value={otherConditionText}
                            onChangeText={setOtherConditionText}
                            multiline
                            style={{
                              fontSize: 14,
                              fontWeight: '500',
                              color: '#0F172A',
                              minHeight: 52,
                              textAlignVertical: 'top',
                              padding: 0,
                            }}
                          />
                        </View>
                      )}
                    </View>
                  </View>

                  <StepIn delay={250}>
                    <View className="gap-2 mt-8 mb-2">
                      <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => {
                          try { Vibration.vibrate(12); } catch {}
                          handleNext();
                        }}
                        style={{
                          backgroundColor: isStep5Valid ? '#E11D48' : '#FDA4AF',
                          height: 56,
                          borderRadius: 20,
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexDirection: 'row',
                          gap: 10,
                          shadowColor: '#E11D48',
                          shadowOffset: { width: 0, height: 6 },
                          shadowOpacity: isStep5Valid ? 0.3 : 0.08,
                          shadowRadius: 12,
                          elevation: 4,
                          opacity: isStep5Valid ? 1 : 0.65,
                        }}
                        className="w-full mt-1"
                      >
                        <Text
                          style={{
                            color: '#FFFFFF',
                            fontSize: 15,
                            fontWeight: '800',
                            letterSpacing: 0.8,
                            textTransform: 'uppercase',
                          }}
                        >
                          CONTINUE
                        </Text>
                        <Feather name="arrow-right" size={17} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  </StepIn>
                </View>
              )}

              {/* STEP 6 (Question 5/5): Supplements Stack */}
              {step === 6 && (
                <View className="flex-1 justify-between pb-2">
                  <View className="gap-5">
                    <StepIn delay={0}>
                      <View className="gap-1.5">
                        <View className="flex-row items-center justify-between">
                          <Text
                            style={{
                              color: '#0F172A',
                              fontSize: 27,
                              fontWeight: '700',
                              letterSpacing: -0.7,
                              lineHeight: 32,
                              marginTop: 2,
                            }}
                          >
                            Supplements Stack <Text style={{ color: '#E11D48', fontWeight: '800' }}>*</Text>
                          </Text>
                        </View>
                        <Text
                          style={{
                            color: '#64748B',
                            fontSize: 13,
                            fontWeight: '400',
                            lineHeight: 20,
                          }}
                        >
                          Select any supplements you take, or choose "None / No Supplements".
                        </Text>
                      </View>
                    </StepIn>

                    <View style={{ gap: 12 }}>
                      {/* Row 1: Protein & Creatine (Whey & Creatine use custom icons) */}
                      <View style={{ flexDirection: 'row', gap: 12 }}>
                        <SelectableGridCard
                          item={SUPPLEMENTS_DATA[0]}
                          isSelected={selectedSupplements.includes(SUPPLEMENTS_DATA[0].id)}
                          onToggle={() => toggleTag(SUPPLEMENTS_DATA[0].id, selectedSupplements, setSelectedSupplements)}
                          index={0}
                        />
                        <SelectableGridCard
                          item={SUPPLEMENTS_DATA[1]}
                          isSelected={selectedSupplements.includes(SUPPLEMENTS_DATA[1].id)}
                          onToggle={() => toggleTag(SUPPLEMENTS_DATA[1].id, selectedSupplements, setSelectedSupplements)}
                          index={1}
                        />
                      </View>

                      {/* Row 2: Omega-3 & Multivitamins */}
                      <View style={{ flexDirection: 'row', gap: 12 }}>
                        <SelectableGridCard
                          item={SUPPLEMENTS_DATA[2]}
                          isSelected={selectedSupplements.includes(SUPPLEMENTS_DATA[2].id)}
                          onToggle={() => toggleTag(SUPPLEMENTS_DATA[2].id, selectedSupplements, setSelectedSupplements)}
                          index={2}
                        />
                        <SelectableGridCard
                          item={SUPPLEMENTS_DATA[3]}
                          isSelected={selectedSupplements.includes(SUPPLEMENTS_DATA[3].id)}
                          onToggle={() => toggleTag(SUPPLEMENTS_DATA[3].id, selectedSupplements, setSelectedSupplements)}
                          index={3}
                        />
                      </View>

                      {/* Row 3: Vitamin D3 & Pre-Workout */}
                      <View style={{ flexDirection: 'row', gap: 12 }}>
                        <SelectableGridCard
                          item={SUPPLEMENTS_DATA[4]}
                          isSelected={selectedSupplements.includes(SUPPLEMENTS_DATA[4].id)}
                          onToggle={() => toggleTag(SUPPLEMENTS_DATA[4].id, selectedSupplements, setSelectedSupplements)}
                          index={4}
                        />
                        <SelectableGridCard
                          item={SUPPLEMENTS_DATA[5]}
                          isSelected={selectedSupplements.includes(SUPPLEMENTS_DATA[5].id)}
                          onToggle={() => toggleTag(SUPPLEMENTS_DATA[5].id, selectedSupplements, setSelectedSupplements)}
                          index={5}
                        />
                      </View>

                      {/* Row 4: Magnesium & Other */}
                      <View style={{ flexDirection: 'row', gap: 12 }}>
                        <SelectableGridCard
                          item={SUPPLEMENTS_DATA[6]}
                          isSelected={selectedSupplements.includes(SUPPLEMENTS_DATA[6].id)}
                          onToggle={() => toggleTag(SUPPLEMENTS_DATA[6].id, selectedSupplements, setSelectedSupplements)}
                          index={6}
                        />
                        <SelectableGridCard
                          item={SUPPLEMENTS_DATA[7]}
                          isSelected={selectedSupplements.includes(SUPPLEMENTS_DATA[7].id)}
                          onToggle={() => toggleTag(SUPPLEMENTS_DATA[7].id, selectedSupplements, setSelectedSupplements)}
                          index={7}
                        />
                      </View>

                      {/* Clean minimal custom supplement input box when 'Other' is selected */}
                      {selectedSupplements.includes('Other') && (
                        <View
                          style={{
                            backgroundColor: '#FFFFFF',
                            borderColor: '#E2E8F0',
                            borderWidth: 1.5,
                            borderRadius: 20,
                            paddingHorizontal: 16,
                            paddingVertical: 14,
                            shadowColor: '#0F172A',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.04,
                            shadowRadius: 6,
                            elevation: 1.5,
                          }}
                        >
                          <TextInput
                            placeholder="Specify other supplements (e.g. Ashwagandha, Zinc, Collagen)..."
                            placeholderTextColor="#94A3B8"
                            value={otherSupplementText}
                            onChangeText={setOtherSupplementText}
                            multiline
                            style={{
                              fontSize: 14,
                              fontWeight: '500',
                              color: '#0F172A',
                              minHeight: 52,
                              textAlignVertical: 'top',
                              padding: 0,
                            }}
                          />
                        </View>
                      )}

                      {/* Row 5: None / No Supplements Banner Card */}
                      <SelectableBannerCard
                        item={SUPPLEMENTS_DATA[8]}
                        isSelected={selectedSupplements.includes(SUPPLEMENTS_DATA[8].id)}
                        onToggle={() => toggleTag(SUPPLEMENTS_DATA[8].id, selectedSupplements, setSelectedSupplements)}
                        index={8}
                      />
                    </View>
                  </View>
                </View>
              )}

            </Animated.View>
          </ScrollView>

          {/* Pinned Bottom CTA Bar for Step 6 Supplements Stack */}
          {step === 6 && (
            <View
              style={{
                backgroundColor: '#FFFFFF',
                paddingHorizontal: 22,
                paddingTop: 12,
                paddingBottom: Math.max(insets.bottom, 16) + 4,
                borderTopWidth: 1,
                borderTopColor: '#F1F5F9',
                shadowColor: '#0F172A',
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.06,
                shadowRadius: 10,
                elevation: 6,
              }}
            >
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => {
                  try {
                    Vibration.vibrate(12);
                  } catch {}
                  handleGenerate();
                }}
                style={{
                  backgroundColor: isStep6Valid ? '#E11D48' : '#FDA4AF',
                  height: 56,
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 10,
                  shadowColor: '#E11D48',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: isStep6Valid ? 0.3 : 0.08,
                  shadowRadius: 12,
                  elevation: 4,
                  opacity: isStep6Valid ? 1 : 0.65,
                }}
                className="w-full"
              >
                <Text
                  style={{
                    color: '#FFFFFF',
                    fontSize: 15,
                    fontWeight: '800',
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                  }}
                >
                  FINISH ASSESSMENT
                </Text>
                <Feather name="arrow-right" size={17} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}
        </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
