import { create } from 'zustand';
import { Workout, Coach } from '../types';

interface WorkoutState {
  workouts: Workout[];
  coaches: Coach[];
  recommendation: {
    message: string;
    workoutId: string;
  };
}

const mockWorkouts: Workout[] = [
  {
    id: 'w-1',
    title: 'Strength Training',
    icon: '🏋️‍♂️',
    description: 'Build lean muscle and improve overall body strength at home. Our elite coach will structure exercises around resistance bands, bodyweight, and weights suited to your target zones.',
    calories: 320,
    duration: 45,
    heroImage: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80',
    category: 'Strength',
    benefits: ['Increase muscle mass & bone density', 'Boost resting metabolic rate', 'Improve joint support & posture'],
    difficulty: 'Medium - Hard',
    equipment: ['Dumbbells or Resistance bands (Trainer will bring them)', 'Workout mat'],
    homeVisitBadge: true,
    sessionPrice: 1200,
    rating: 4.9,
    reviews: [
      { reviewerName: 'Rohit K.', rating: 5, comment: 'Great workout! The coach brought all the resistance bands and adapted exercises to my small space.' },
      { reviewerName: 'Vikram S.', rating: 4.8, comment: 'Very intense but highly rewarding strength session. Proper attention to form.' }
    ],
    faqs: [
      { question: 'What space do I need?', answer: 'A standard living room space (around 6x6 feet) is more than enough for a full session.' },
      { question: 'Is this suitable for beginners?', answer: 'Yes! The coach will adjust all repetitions and exercises to match your current fitness level.' }
    ]
  },
  {
    id: 'w-2',
    title: 'Yoga',
    icon: '🧘‍♀️',
    description: 'Enhance flexibility, balance, and mental mindfulness through guided yoga flows, posture correction, and breathing routines designed to restore body harmony.',
    calories: 180,
    duration: 50,
    heroImage: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=800&q=80',
    category: 'Mind & Body',
    benefits: ['Enhance balance & posture', 'Reduce stress & mental fatigue', 'Improve core flexibility & mobility'],
    difficulty: 'Beginner - Medium',
    equipment: ['Yoga mat (Trainer will bring one if needed)', 'Yoga blocks'],
    homeVisitBadge: true,
    sessionPrice: 1100,
    rating: 4.8,
    reviews: [
      { reviewerName: 'Sneha M.', rating: 5, comment: 'Priya is amazing. Her voice is very calming and she corrected all my alignments.' },
      { reviewerName: 'Amit G.', rating: 4.6, comment: 'Very peaceful. Great breathing exercises at the end. Recommended!' }
    ],
    faqs: [
      { question: 'I have stiff hamstrings, can I join?', answer: 'Absolutely. Yoga is about progress. The coach will give you modifications and blocks to support your flexibility.' }
    ]
  },
  {
    id: 'w-3',
    title: 'Stretching',
    icon: '🤸‍♂️',
    description: 'Relieve muscle tension and improve flexibility. Passive stretching helps accelerate recovery after high-intensity training and decompress joints.',
    calories: 120,
    duration: 30,
    heroImage: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=800&q=80',
    category: 'Recovery',
    benefits: ['Relieve muscle stiffness & joint pain', 'Improve range of motion', 'Accelerate post-workout muscle recovery'],
    difficulty: 'Beginner',
    equipment: ['Comfortable loose clothes', 'Workout mat'],
    homeVisitBadge: true,
    sessionPrice: 900,
    rating: 4.75,
    reviews: [
      { reviewerName: 'Alok D.', rating: 5, comment: 'Best post-run passive stretch ever! My leg stiffness disappeared.' }
    ],
    faqs: [
      { question: 'How often should I do passive stretching?', answer: 'We recommend 2-3 times a week, especially after hard strength or boxing sessions.' }
    ]
  },
  {
    id: 'w-4',
    title: 'Boxing',
    icon: '🥊',
    description: 'High energy cardio and boxing technique routines. Learn punch combinations, footwork drills, and get an incredible core workout with trainer-held pads.',
    calories: 450,
    duration: 40,
    heroImage: 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?auto=format&fit=crop&w=800&q=80',
    category: 'Cardio',
    benefits: ['High calorie cardiovascular burn', 'Enhance hand-eye coordination & reflex', 'Relieve stress & build stamina'],
    difficulty: 'Hard',
    equipment: ['Boxing pads & gloves (Trainer will provide)', 'Hand wraps (optional)'],
    homeVisitBadge: true,
    sessionPrice: 1300,
    rating: 4.9,
    reviews: [
      { reviewerName: 'Kabir B.', rating: 5, comment: 'Rohan is a beast! Punching pads is the best stress buster. Incredible cardio.' }
    ],
    faqs: [
      { question: 'Do I need boxing gloves?', answer: 'No, the trainer will bring sanitized, high-quality focus pads and gloves for you.' }
    ]
  },
  {
    id: 'w-5',
    title: 'Dance Fitness',
    icon: '💃',
    description: 'Fun, calorie-burning rhythmic dance workouts combining high-energy music with easy-to-follow choreography.',
    calories: 380,
    duration: 45,
    heroImage: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=800&q=80',
    category: 'Cardio',
    benefits: ['Cardiovascular conditioning', 'Full body coordination', 'Endorphin release'],
    difficulty: 'Medium',
    equipment: ['Comfy sports shoes', 'Water bottle'],
    homeVisitBadge: true,
    sessionPrice: 1000,
    rating: 4.8,
    reviews: [],
    faqs: []
  },
  {
    id: 'w-6',
    title: 'Pilates',
    icon: '🧘',
    description: 'Focus on core strength, posture control, and stability. Incorporates slow, precise resistance movements.',
    calories: 220,
    duration: 45,
    heroImage: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=800&q=80',
    category: 'Mind & Body',
    benefits: ['Deep abdominal strength', 'Spinal alignment', 'Lean muscle toning'],
    difficulty: 'Medium',
    equipment: ['Pilates mat (provided)', 'Resistance circle (provided)'],
    homeVisitBadge: true,
    sessionPrice: 1200,
    rating: 4.85,
    reviews: [],
    faqs: []
  },
  {
    id: 'w-7',
    title: 'Mobility',
    icon: '🔄',
    description: 'Improve joint range of motion, relieve chronic stiffness, and enhance flexibility for daily movements.',
    calories: 130,
    duration: 30,
    heroImage: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=800&q=80',
    category: 'Recovery',
    benefits: ['Joint lubrication', 'Pain prevention', 'Better functional balance'],
    difficulty: 'Beginner',
    equipment: ['Yoga mat', 'Stretching strap (provided)'],
    homeVisitBadge: true,
    sessionPrice: 900,
    rating: 4.75,
    reviews: [],
    faqs: []
  },
  {
    id: 'w-8',
    title: 'HIIT',
    icon: '⚡',
    description: 'High intensity interval training for maximum calorie burn. Fast-paced bodyweight intervals.',
    calories: 480,
    duration: 35,
    heroImage: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80',
    category: 'Cardio',
    benefits: ['EPOC metabolic burn', 'Enhanced VO2 max', 'Quick, intensive workout'],
    difficulty: 'Hard',
    equipment: ['Towel', 'Water bottle'],
    homeVisitBadge: true,
    sessionPrice: 1200,
    rating: 4.9,
    reviews: [],
    faqs: []
  },
  {
    id: 'w-9',
    title: 'Senior Fitness',
    icon: '👴',
    description: 'Low-impact movements designed for seniors to keep active, improve joint mobility, and maintain independence.',
    calories: 150,
    duration: 40,
    heroImage: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=800&q=80',
    category: 'Specialized',
    benefits: ['Maintained bone density', 'Better fall-prevention balance', 'Gentle joint stimulation'],
    difficulty: 'Beginner',
    equipment: ['Sturdy chair', 'Light weights (provided)'],
    homeVisitBadge: true,
    sessionPrice: 1000,
    rating: 4.8,
    reviews: [],
    faqs: []
  },
  {
    id: 'w-10',
    title: 'Pregnancy Fitness',
    icon: '🤰',
    description: 'Safe pre-natal exercises designed by experts to support your body during pregnancy and prepare for labor.',
    calories: 160,
    duration: 35,
    heroImage: 'https://images.unsplash.com/photo-1518310383802-640c2de311b2?auto=format&fit=crop&w=800&q=80',
    category: 'Specialized',
    benefits: ['Reduced pregnancy back-pain', 'Better stamina for delivery', 'Controlled pre-natal blood pressure'],
    difficulty: 'Beginner',
    equipment: ['Exercise ball (provided)', 'Mat'],
    homeVisitBadge: true,
    sessionPrice: 1100,
    rating: 4.9,
    reviews: [],
    faqs: []
  }
];

const mockCoaches: Coach[] = [
  {
    id: 'c-1',
    name: 'Karan Sharma',
    photo: 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?auto=format&fit=crop&w=150&q=80',
    experience: '8 yrs exp',
    rating: 4.9,
    specialty: 'Strength & HIIT',
  },
  {
    id: 'c-2',
    name: 'Priya Patel',
    photo: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80',
    experience: '6 yrs exp',
    rating: 4.8,
    specialty: 'Yoga & Pilates',
  },
  {
    id: 'c-3',
    name: 'Rohan Mehta',
    photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
    experience: '10 yrs exp',
    rating: 4.95,
    specialty: 'Boxing & Athletics',
  },
  {
    id: 'c-4',
    name: 'Anjali Rao',
    photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
    experience: '5 yrs exp',
    rating: 4.75,
    specialty: 'Dance & Stretching',
  },
];

export const useWorkoutStore = create<WorkoutState>(() => ({
  workouts: mockWorkouts,
  coaches: mockCoaches,
  recommendation: {
    message: 'Based on your previous activity, today we recommend a Stretching session.',
    workoutId: 'w-3',
  },
}));
