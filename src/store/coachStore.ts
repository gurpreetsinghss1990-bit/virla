import { create } from 'zustand';
import { Coach, TrainerEarning, ScheduleSlot } from '../types';
import { Alert } from 'react-native';

interface CoachState {
  coaches: Coach[];
  selectedCoachId: string;
  setSelectedCoachId: (id: string) => void;
  toggleFavouriteCoach: (id: string) => void;
  
  // Trainer ledger (S6)
  earningsList: TrainerEarning[];
  totalEarnings: number;
  addEarning: (earning: Omit<TrainerEarning, 'id' | 'date'>) => void;
  restoreAvailabilitySlot: (slot: string) => void;

  // Sprint 7 availability planner
  weeklySchedule: ScheduleSlot[];
  remainingSlotChanges: number;
  isScheduleSubmitted: boolean;
  toggleSlotAvailability: (slotId: string) => void;
  editScheduleSlot: (slotId: string, newTime: string) => boolean;
  submitSchedule: () => void;
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
    certifications: ['ACE Certified Personal Trainer', 'ISSA Strength & Conditioning Specialist', 'CPR/AED Certified'],
    achievements: ['Trained 450+ clients across India', 'Featured in FitIndia Magazine 2025', 'Specialist Coach of the Year 2025 (VIRLA)'],
    reviews: [
      { reviewerName: 'Rahul V.', rating: 5, comment: 'Karan completely changed how I think about home workouts. High energy and great technique corrections!' },
      { reviewerName: 'Amit S.', rating: 4.8, comment: 'Punctual, professional, and very encouraging. Highly recommend him for strength training!' }
    ],
    workoutSpecialties: ['Strength Training', 'HIIT', 'Boxing', 'Mobility'],
    availability: ['07:00 AM - 08:00 AM', '08:00 AM - 09:00 AM', '09:00 AM - 10:00 AM', '05:00 PM - 06:00 PM', '07:00 PM - 08:00 PM'],
    level: 'Certified',
    completedSessions: 245,
    isFavourite: false,
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
    certifications: ['RYT 500 Yoga Alliance Certified', 'Balanced Body Pilates Instructor', 'Pre-Natal & Post-Natal Yoga Specialist'],
    achievements: ['Conducted 600+ wellness hours', 'Co-founded MindfulFlow Retreats', 'Yoga Expert panelist for Wellness Weekly'],
    reviews: [
      { reviewerName: 'Sneha M.', rating: 5, comment: 'Priya has a wonderful calming presence. Her posture adjustments are incredibly helpful!' },
      { reviewerName: 'Deepa K.', rating: 4.6, comment: 'Perfect mix of strength and mindfulness. Loved the pregnancy guidance.' }
    ],
    workoutSpecialties: ['Yoga', 'Pilates', 'Stretching', 'Pregnancy Fitness'],
    availability: ['07:00 AM - 08:00 AM', '09:00 AM - 10:00 AM', '10:00 AM - 11:00 AM', '05:00 PM - 06:00 PM', '09:00 PM - 10:00 PM'],
    level: 'Certified',
    completedSessions: 190,
    isFavourite: true,
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
    certifications: ['WAKO Certified Kickboxing Coach', 'National Academy of Sports Medicine (NASM) CPT', 'FMS Level 1 Functional Movement Specialist'],
    achievements: ['National Kickboxing Bronze Medalist', 'Trainer to celebrity corporate executives', 'VIRLA Elite Master Trainer designation'],
    reviews: [
      { reviewerName: 'Vikram R.', rating: 5, comment: 'Rohan brings boxing gym energy to your living room. Brutal but incredibly satisfying workout!' },
      { reviewerName: 'Rohit J.', rating: 4.9, comment: 'Amazing pads drills. His attention to footwork and form is outstanding.' }
    ],
    workoutSpecialties: ['Boxing', 'HIIT', 'Strength Training', 'Mobility'],
    availability: ['07:00 AM - 08:00 AM', '08:00 AM - 09:00 AM', '05:00 PM - 06:00 PM', '07:00 PM - 08:00 PM', '09:00 PM - 10:00 PM'],
    level: 'Elite',
    completedSessions: 480,
    isFavourite: true,
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
    certifications: ['Licensed Zumba Instructor (L1 & L2)', 'AFAA Group Fitness Certification', 'Therapeutic Stretching Specialist'],
    achievements: ['Choreographed virtual wellness events for corporate giants', 'VIRLA Rising Star Coach award nominee', 'Certified 100+ seniors in active aging exercises'],
    reviews: [
      { reviewerName: 'Priyanka D.', rating: 4.8, comment: 'So much fun! The dance routines fly by, and I burn close to 400 calories every time.' },
      { reviewerName: 'Nisha G.', rating: 4.7, comment: 'Anjali is super positive. Her stretching session cured my chronic lower back stiffness.' }
    ],
    workoutSpecialties: ['Dance Fitness', 'Stretching', 'Senior Fitness', 'Mobility'],
    availability: ['07:00 AM - 08:00 AM', '09:00 AM - 10:00 AM', '04:00 PM - 05:00 PM', '05:00 PM - 06:00 PM', '07:00 PM - 08:00 PM'],
    level: 'Associate',
    completedSessions: 95,
    isFavourite: false,
  }
];

const mockEarnings: TrainerEarning[] = [
  {
    id: 'earn-1',
    bookingId: 'b-old-10',
    clientName: 'Viral',
    amount: 800,
    date: 'Jul 14, 2026',
    type: 'session',
  },
  {
    id: 'earn-2',
    bookingId: 'b-old-11',
    clientName: 'Rahul V.',
    amount: 800,
    date: 'Jul 11, 2026',
    type: 'session',
  },
  {
    id: 'earn-3',
    bookingId: 'b-old-12',
    clientName: 'Aarav S.',
    amount: 400,
    date: 'Jul 08, 2026',
    type: 'no_show_compensation',
  }
];

// Helper to pre-populate 36 slots
const generateInitialSchedule = (): ScheduleSlot[] => {
  const list: ScheduleSlot[] = [];
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  days.forEach((day) => {
    // Generate 4 Prime Slots (eligible availability)
    list.push({ id: `${day}-p1`, day, time: '07:00 AM - 08:00 AM', isPrime: true, isBooked: false, isAvailable: true });
    list.push({ id: `${day}-p2`, day, time: '08:00 AM - 09:00 AM', isPrime: true, isBooked: false, isAvailable: true });
    list.push({ id: `${day}-p3`, day, time: '05:00 PM - 06:00 PM', isPrime: true, isBooked: false, isAvailable: true });
    list.push({ id: `${day}-p4`, day, time: '06:00 PM - 07:00 PM', isPrime: true, isBooked: false, isAvailable: true });

    // Generate 2 Off-Peak Slots
    list.push({ id: `${day}-o1`, day, time: '09:00 AM - 10:00 AM', isPrime: false, isBooked: false, isAvailable: true });
    list.push({ id: `${day}-o2`, day, time: '10:00 AM - 11:00 AM', isPrime: false, isBooked: false, isAvailable: true });
  });

  // Mark two slots as Booked (locked)
  list[2].isBooked = true; // Tuesday Prime
  list[8].isBooked = true; // Thursday Off Peak

  return list;
};

export const useCoachStore = create<CoachState>((set, get) => ({
  coaches: mockCoaches,
  selectedCoachId: '',
  setSelectedCoachId: (id) => set({ selectedCoachId: id }),
  toggleFavouriteCoach: (id) => set((state) => ({
    coaches: state.coaches.map(c => c.id === id ? { ...c, isFavourite: !c.isFavourite } : c)
  })),
  earningsList: mockEarnings,
  totalEarnings: mockEarnings.reduce((acc, curr) => acc + curr.amount, 0),
  addEarning: (earning) => set((state) => {
    const newEarn: TrainerEarning = {
      ...earning,
      id: `earn-${Date.now().toString().slice(-4)}`,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
    };
    const updated = [newEarn, ...state.earningsList];
    return {
      earningsList: updated,
      totalEarnings: updated.reduce((acc, curr) => acc + curr.amount, 0),
    };
  }),
  restoreAvailabilitySlot: (slot) => set((state) => {
    return {
      coaches: state.coaches.map(c => {
        if (c.id === 'c-1' && c.availability && !c.availability.includes(slot)) {
          return { ...c, availability: [...c.availability, slot] };
        }
        return c;
      })
    };
  }),
  
  // Sprint 7 availability planner states
  weeklySchedule: generateInitialSchedule(),
  remainingSlotChanges: 2,
  isScheduleSubmitted: true, // starts submitted so changes limits apply

  toggleSlotAvailability: (slotId) => {
    const { isScheduleSubmitted, remainingSlotChanges, weeklySchedule } = get();
    const slot = weeklySchedule.find(s => s.id === slotId);

    if (!slot) return;

    // Policy Rule 2: Booked slots cannot be edited
    if (slot.isBooked) {
      Alert.alert('Change Blocked', 'Booked slots are locked and cannot be edited or toggled.');
      return;
    }

    if (isScheduleSubmitted) {
      // Policy Rule 1: Limit slot changes to 2 per week
      if (remainingSlotChanges <= 0) {
        Alert.alert('Change Blocked', 'Remaining Changes: 0/2. You have used all allowed changes for this week.');
        return;
      }

      set((state) => ({
        weeklySchedule: state.weeklySchedule.map(s => 
          s.id === slotId ? { ...s, isAvailable: !s.isAvailable } : s
        ),
        remainingSlotChanges: state.remainingSlotChanges - 1
      }));
    } else {
      // Draft mode toggles freely
      set((state) => ({
        weeklySchedule: state.weeklySchedule.map(s => 
          s.id === slotId ? { ...s, isAvailable: !s.isAvailable } : s
        )
      }));
    }
  },

  editScheduleSlot: (slotId, newTime) => {
    const { isScheduleSubmitted, remainingSlotChanges, weeklySchedule } = get();
    const slot = weeklySchedule.find(s => s.id === slotId);

    if (!slot) return false;

    if (slot.isBooked) {
      Alert.alert('Change Blocked', 'Booked slots are locked and cannot be edited.');
      return false;
    }

    if (isScheduleSubmitted && remainingSlotChanges <= 0) {
      Alert.alert('Change Blocked', 'Remaining Changes: 0/2. You have used all allowed changes for this week.');
      return false;
    }

    // Update time slot
    set((state) => ({
      weeklySchedule: state.weeklySchedule.map(s => 
        s.id === slotId ? { ...s, time: newTime } : s
      ),
      remainingSlotChanges: isScheduleSubmitted ? state.remainingSlotChanges - 1 : state.remainingSlotChanges
    }));
    
    return true;
  },

  submitSchedule: () => set({ isScheduleSubmitted: true, remainingSlotChanges: 2 })
}));
