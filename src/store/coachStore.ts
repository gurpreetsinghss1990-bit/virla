import { create } from 'zustand';
import { Coach } from '../types';

interface CoachState {
  coaches: Coach[];
  selectedCoachId: string;
  setSelectedCoachId: (id: string) => void;
}

const mockCoaches: Coach[] = [
  {
    id: 'c-1',
    name: 'Karan Sharma',
    photo: 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?auto=format&fit=crop&w=300&q=80',
    experience: '8 yrs exp',
    rating: 4.9,
    specialty: 'Strength & HIIT',
    yearsExperience: 8,
    specialization: 'Strength Training, Muscle Hypertrophy & High Intensity Cardio',
    languages: ['English', 'Hindi', 'Punjabi'],
    shortBio: 'Certified personal trainer with a passion for helping clients build long-term athletic strength and lean muscle from home.',
    price: 1200,
    verifiedBadge: true,
    certifications: [
      'ACE Certified Personal Trainer',
      'ISSA Strength & Conditioning Specialist',
      'CPR/AED Certified'
    ],
    achievements: [
      'Trained 450+ clients across India',
      'Featured in FitIndia Magazine 2025',
      'Specialist Coach of the Year 2025 (VIRLA)'
    ],
    reviews: [
      { reviewerName: 'Rahul V.', rating: 5, comment: 'Karan completely changed how I think about home workouts. High energy and great technique corrections!' },
      { reviewerName: 'Amit S.', rating: 4.8, comment: 'Punctual, professional, and very encouraging. Highly recommend him for strength training!' }
    ],
    workoutSpecialties: ['Strength Training', 'HIIT', 'Boxing', 'Mobility'],
    availability: ['06:00 AM - 07:00 AM', '07:00 AM - 08:00 AM', '09:00 AM - 10:00 AM', '04:00 PM - 05:00 PM', '07:00 PM - 08:00 PM']
  },
  {
    id: 'c-2',
    name: 'Priya Patel',
    photo: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&q=80',
    experience: '6 yrs exp',
    rating: 4.8,
    specialty: 'Yoga & Pilates',
    yearsExperience: 6,
    specialization: 'Vinyasa Flow, Ashtanga Yoga, Core Rehabilitation & Pilates',
    languages: ['English', 'Gujarati', 'Hindi'],
    shortBio: 'Dedicated Yoga and Pilates teacher focusing on posture correction, core alignment, and stress reduction through breathwork.',
    price: 1100,
    verifiedBadge: true,
    certifications: [
      'RYT 500 Yoga Alliance Certified',
      'Balanced Body Pilates Instructor',
      'Pre-Natal & Post-Natal Yoga Specialist'
    ],
    achievements: [
      'Conducted 600+ wellness hours',
      'Co-founded MindfulFlow Retreats',
      'Yoga Expert panelist for Wellness Weekly'
    ],
    reviews: [
      { reviewerName: 'Sneha M.', rating: 5, comment: 'Priya has a wonderful calming presence. Her posture adjustments are incredibly helpful!' },
      { reviewerName: 'Deepa K.', rating: 4.6, comment: 'Perfect mix of strength and mindfulness. Loved the pregnancy fitness guidance.' }
    ],
    workoutSpecialties: ['Yoga', 'Pilates', 'Stretching', 'Pregnancy Fitness'],
    availability: ['07:00 AM - 08:00 AM', '09:00 AM - 10:00 AM', '10:00 AM - 11:00 AM', '05:00 PM - 06:00 PM', '09:00 PM - 10:00 PM']
  },
  {
    id: 'c-3',
    name: 'Rohan Mehta',
    photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
    experience: '10 yrs exp',
    rating: 4.95,
    specialty: 'Boxing & Athletics',
    yearsExperience: 10,
    specialization: 'Boxing, Kickboxing, Functional Cardio & Speed-Agility training',
    languages: ['English', 'Hindi', 'Marathi'],
    shortBio: 'Former national level kickboxer offering dynamic boxing fitness and high-intensity agility workouts directly at your home.',
    price: 1500,
    verifiedBadge: true,
    certifications: [
      'WAKO Certified Kickboxing Coach',
      'National Academy of Sports Medicine (NASM) CPT',
      'FMS Level 1 Functional Movement Specialist'
    ],
    achievements: [
      'National Kickboxing Bronze Medalist',
      'Trainer to celebrity corporate executives',
      'VIRLA Elite Master Trainer designation'
    ],
    reviews: [
      { reviewerName: 'Vikram R.', rating: 5, comment: 'Rohan brings boxing gym energy to your living room. Brutal but incredibly satisfying workout!' },
      { reviewerName: 'Rohit J.', rating: 4.9, comment: 'Amazing pads drills. His attention to footwork and form is outstanding.' }
    ],
    workoutSpecialties: ['Boxing', 'HIIT', 'Strength Training', 'Mobility'],
    availability: ['06:00 AM - 07:00 AM', '08:00 AM - 09:00 AM', '04:00 PM - 05:00 PM', '07:00 PM - 08:00 PM', '09:00 PM - 10:00 PM']
  },
  {
    id: 'c-4',
    name: 'Anjali Rao',
    photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80',
    experience: '5 yrs exp',
    rating: 4.75,
    specialty: 'Dance & Stretching',
    yearsExperience: 5,
    specialization: 'Zumba Fitness, Dance Conditioning & Passive Decompression Stretching',
    languages: ['English', 'Kannada', 'Hindi'],
    shortBio: 'High-energy dance fitness instructor and passive stretching therapist specializing in active recovery and cardiovascular conditioning.',
    price: 1000,
    verifiedBadge: false,
    certifications: [
      'Licensed Zumba Instructor (L1 & L2)',
      'AFAA Group Fitness Certification',
      'Therapeutic Stretching Specialist'
    ],
    achievements: [
      'Choreographed virtual wellness events for corporate giants',
      'VIRLA Rising Star Coach award nominee',
      'Certified 100+ seniors in active aging exercises'
    ],
    reviews: [
      { reviewerName: 'Priyanka D.', rating: 4.8, comment: 'So much fun! The dance routines fly by, and I burn close to 400 calories every time.' },
      { reviewerName: 'Nisha G.', rating: 4.7, comment: 'Anjali is super positive. Her stretching session cured my chronic lower back stiffness.' }
    ],
    workoutSpecialties: ['Dance Fitness', 'Stretching', 'Senior Fitness', 'Mobility'],
    availability: ['07:00 AM - 08:00 AM', '09:00 AM - 10:00 AM', '04:00 PM - 05:00 PM', '05:00 PM - 06:00 PM', '07:00 PM - 08:00 PM']
  }
];

export const useCoachStore = create<CoachState>((set) => ({
  coaches: mockCoaches,
  selectedCoachId: 'c-1',
  setSelectedCoachId: (id) => set({ selectedCoachId: id }),
}));
