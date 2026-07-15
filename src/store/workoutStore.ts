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
    description: 'Build lean muscle and improve overall body strength at home.',
    calories: 320,
    duration: 45,
  },
  {
    id: 'w-2',
    title: 'Yoga',
    icon: '🧘‍♀️',
    description: 'Enhance flexibility, balance, and mental mindfulness.',
    calories: 180,
    duration: 50,
  },
  {
    id: 'w-3',
    title: 'Stretching',
    icon: '🤸‍♂️',
    description: 'Relieve muscle tension and improve flexibility.',
    calories: 120,
    duration: 30,
  },
  {
    id: 'w-4',
    title: 'Boxing',
    icon: '🥊',
    description: 'High energy cardio and boxing technique routines.',
    calories: 450,
    duration: 40,
  },
  {
    id: 'w-5',
    title: 'Dance Fitness',
    icon: '💃',
    description: 'Fun, calorie-burning rhythmic dance workouts.',
    calories: 380,
    duration: 45,
  },
  {
    id: 'w-6',
    title: 'Pilates',
    icon: '🧘',
    description: 'Focus on core strength, posture control, and stability.',
    calories: 220,
    duration: 45,
  },
  {
    id: 'w-7',
    title: 'Mobility',
    icon: '🔄',
    description: 'Improve joint range of motion and ease of movement.',
    calories: 130,
    duration: 30,
  },
  {
    id: 'w-8',
    title: 'HIIT',
    icon: '⚡',
    description: 'High intensity interval training for maximum burn.',
    calories: 480,
    duration: 35,
  },
  {
    id: 'w-9',
    title: 'Senior Fitness',
    icon: '👴',
    description: 'Low-impact movements for strength, balance, and longevity.',
    calories: 150,
    duration: 40,
  },
  {
    id: 'w-10',
    title: 'Pregnancy Fitness',
    icon: '🤰',
    description: 'Safe pre-natal exercises to stay active and prepare for delivery.',
    calories: 160,
    duration: 35,
  },
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
