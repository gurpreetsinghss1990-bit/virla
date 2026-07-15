export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  location: string;
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
  status: 'upcoming' | 'completed' | 'cancelled';
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
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  read: boolean;
  timestamp: string;
}
