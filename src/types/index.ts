export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  location: string;
  // Sprint 6 addition
  role?: 'customer' | 'trainer';
}

export interface Membership {
  tier: string;
  totalCredits: number;
  availableCredits: number;
  renewalDate: string;
}

export interface Workout {
  id: string;
  title: string;
  icon: string;
  description: string;
  calories: number;
  duration: number;
  
  // Sprint 3 additions
  heroImage?: string;
  category?: string;
  benefits?: string[];
  difficulty?: string;
  equipment?: string[];
  homeVisitBadge?: boolean;
  sessionPrice?: number;
  rating?: number;
  reviews?: { reviewerName: string; rating: number; comment: string }[];
  faqs?: { question: string; answer: string }[];
}

export interface Booking {
  id: string;
  trainerName: string;
  trainerPhoto: string;
  workoutTitle: string;
  date: string;
  time: string;
  status: 'upcoming' | 'completed' | 'cancelled' | 'client_no_show' | 'trainer_no_show';
  price?: number;
  address?: string;
  goal?: string;
  preferredCoachId?: string;
  familyMember?: {
    name: string;
    age: number;
    gender: string;
    relation: string;
    notes?: string;
  };
  
  // Sprint 5 additions
  timelineStatus?: 'confirmed' | 'trainer_assigned' | 'on_the_way' | 'arrived' | 'started' | 'completed' | 'feedback_pending';
  trainerLevel?: 'Associate' | 'Certified' | 'Elite';
  trainerRating?: number;
  trainerCompletedSessions?: number;
  trainerSpeciality?: string;
  trainerLanguages?: string[];
  trainerDistance?: string;
  trainerArrivalTime?: string;
  caloriesBurned?: number;
  durationMinutes?: number;
  ratingDetails?: {
    overallRating: number;
    trainerRating: number;
    workoutRating: number;
    difficulty: string;
    energy: string;
    comments?: string;
  };

  // Sprint 6 additions
  otp?: string;
  questionnaire?: {
    mobilityScore: number;
    workoutSummary: string;
    coachNotes: string;
    coachSignature: string;
  };
}

export interface Coach {
  id: string;
  name: string;
  photo: string;
  experience: string;
  rating: number;
  specialty: string;
  bio?: string;
  
  // Sprint 3 additions
  yearsExperience?: number;
  specialization?: string;
  languages?: string[];
  shortBio?: string;
  price?: number;
  verifiedBadge?: boolean;
  certifications?: string[];
  achievements?: string[];
  reviews?: { reviewerName: string; rating: number; comment: string }[];
  workoutSpecialties?: string[];
  availability?: string[];

  // Sprint 5 additions
  level?: 'Associate' | 'Certified' | 'Elite';
  completedSessions?: number;
  isFavourite?: boolean;

  // Sprint 7 additions
  weeklySlotsSubmitted?: number;
  remainingSlotChanges?: number;
  retainerStatus?: 'eligible' | 'not_eligible';
  attendanceRate?: number;
  availabilityCompliance?: number;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  read: boolean;
  timestamp: string;
}

// Sprint 6 additions for Ledgers
export interface Invoice {
  id: string;
  type: string;
  amount: string;
  date: string;
  status: 'paid' | 'pending';
  credits: number;
}

export interface TrainerEarning {
  id: string;
  bookingId: string;
  clientName: string;
  amount: number;
  date: string;
  type: 'session' | 'no_show_compensation' | 'penalty';
}

// Sprint 7 additions for availability planning
export interface ScheduleSlot {
  id: string;
  day: string;
  time: string;
  isPrime: boolean;
  isBooked: boolean;
  isAvailable: boolean;
}

