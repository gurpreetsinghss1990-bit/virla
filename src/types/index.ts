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
}

export interface Booking {
  id: string;
  trainerName: string;
  trainerPhoto: string;
  workoutTitle: string;
  date: string;
  time: string;
  status: 'upcoming' | 'completed' | 'cancelled';
}

export interface Coach {
  id: string;
  name: string;
  photo: string;
  experience: string;
  rating: number;
  specialty: string;
  bio?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  read: boolean;
  timestamp: string;
}
