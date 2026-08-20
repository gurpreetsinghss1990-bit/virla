export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  location: string;
  // Sprint 6 addition
  role?: 'customer' | 'trainer' | 'admin';
  registrationStatus?: string;
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
  status: 'upcoming' | 'completed' | 'cancelled' | 'client_no_show' | 'trainer_no_show' | 'missed_session_not_started';
  reminderSent?: boolean;
  price?: number;
  address?: string;
  goal?: string;
  preferredCoachId?: string;
  trainerNote?: string;
  familyMember?: {
    name: string;
    age: number;
    gender: string;
    relation: string;
    notes?: string;
  };
  
  // Sprint 5 additions
  timelineStatus?: 'booked' | 'trainer_assigned' | 'trainer_accepted' | 'trainer_preparing' | 'trainer_travelling' | 'trainer_arrived' | 'otp_verified' | 'workout_started' | 'workout_completed' | 'trainer_report_submitted' | 'customer_review_pending' | 'session_closed';
  acceptanceNotificationCount?: number;
  lastAcceptanceNotificationAt?: number;
  acceptanceMethod?: 'TRAINER_MANUAL_ACCEPT' | 'SYSTEM_AUTO_ACCEPT' | 'manual' | 'auto';
  acceptanceDeadline?: number;
  autoAcceptedAt?: number;
  trainerAcceptedAt?: number;
  trainerLevel?: 'Associate' | 'Certified' | 'Elite';
  trainerRating?: number;
  trainerCompletedSessions?: number;
  trainerSpeciality?: string;
  trainerLanguages?: string[];
  trainerDistance?: string;
  trainerArrivalTime?: string;
  caloriesBurned?: number;
  durationMinutes?: number;
  travelStartedAt?: number;
  workoutCompletedAt?: number;
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
  clientName?: string;
  clientPhone?: string;
  clientId?: string;
  trainerId?: string;
  createdAt?: number;
  assignedTrainersPool?: string[];
  currentTrainerIndex?: number;
  gracePeriodStartedAt?: number;
  otpExpiresAt?: number;
  workoutStartedAt?: number;
  participantCount?: number;
  sessionType?: 'SINGLE' | 'COUPLE';
  originalPackageType?: 'SINGLE' | 'COUPLE';
  partnerName?: string;
  partnerPhone?: string;
  isInvalidData?: boolean;
  validationError?: string;
}

export interface Coach {
  id: string;
  name: string;
  photo: string;
  experience: string;
  rating: number;
  specialty: string;
  bio?: string;
  gender?: string;
  
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
  punctualityRate?: number;
  availabilityCompliance?: number;
  bankDetails?: string;
  emergencyContact?: string;
  aboutText?: string;
  workingRadius?: string;
  isOnline?: boolean;
  preferences?: {
    online: boolean;
    radiusKm: number;
    maxDailySessions: number;
    categories: string[];
    weeklySchedule?: ScheduleSlot[];
    availabilityOverrides?: AvailabilityOverride[];
    operatingAddress?: string;
    operatingLatitude?: number;
    operatingLongitude?: number;
    operatingPlaceId?: string;
    operatingLocationStatus?: 'pending' | 'verified' | 'rejected';
    addressChangeRequest?: {
      requestedAddress: string;
      requestedLatitude: number;
      requestedLongitude: number;
      requestedRadius: number;
      requestedPlaceId?: string;
      status: 'pending' | 'approved' | 'rejected';
    } | null;
  };
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  read: boolean;
  timestamp: string;
  group: 'today' | 'yesterday' | 'earlier';
  icon?: string;
  type?: 'Bookings' | 'Membership' | 'Credits' | 'Payments' | 'Promotions' | 'Trainer Updates' | 'Safety' | 'System';
  priority?: 'low' | 'medium' | 'high';
  actionLabel?: string;
  deepLink?: string;
  expiry?: string;
}

// Sprint 6 additions for Ledgers
export interface Invoice {
  id: string;
  userId?: string;
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
  category?: string;
}

export interface AssignmentLog {
  id: string;
  bookingId: string;
  trainerId: string;
  timestamp: number;
  score: number;
  reason: string;
  action: string;
}

export interface AvailabilityOverride {
  date: string;
  time: string;
  isAvailable: boolean;
  category?: string;
}

export interface TrainerWorkoutAssignment {
  id: string;
  trainerId: string;
  workoutCategory: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REMOVAL_REQUESTED' | 'REMOVED';
  requestedAt: number;
  approvedAt?: number;
  approvedBy?: string;
  rejectedAt?: number;
  rejectedBy?: string;
  rejectionReason?: string;
  createdAt?: string;
  updatedAt?: string;
}

