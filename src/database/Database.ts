import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, Workout, Coach, Booking, NotificationItem, Invoice, TrainerEarning, ScheduleSlot } from '../types';

// Simple UUID generator
export function generateUUID(prefix = 'id'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// Deterministic simple hash function to avoid storing plain-text passwords
export function hashPassword(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `secure-hash-${hash}-${password.length}`;
}

export interface UserProfile {
  id: string;
  userId: string;
  age: number;
  gender: string;
  height: string;
  weight: string;
  fitnessGoal: string;
  preferredWorkout: string;
  emergencyContact: string; // JSON string
  medicalNotes: string;
  membershipStatus: string;
  creditsBalance: number;
  trainerPreference: string;
  dob: string;
  fitnessLevel: string;
  preferredLanguage: string;
  city: string;
  memberSince: string;
  selectedGoals: string[];
}

export interface HydrationLog {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  amount: number; // ml
}

export interface CalorieLog {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  amount: number; // kcal
}

export interface ChatMessage {
  id: string;
  chatId: string;
  sender: 'user' | 'coach' | 'virla';
  text: string;
  timestamp: string;
  isPinned?: boolean;
  isFavorite?: boolean;
}

export interface TrainerApplication {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  
  // Step 1: Personal Info
  fullName: string;
  phone: string;
  email: string;
  dob: string;
  gender: string;
  avatar: string;
  address: string;
  city: string;
  state: string;
  pinCode: string;
  emergencyContact: string; // JSON string

  // Step 2: Professional Info
  primaryWorkout: string;
  secondarySkills: string;
  yearsOfExperience: number;
  languages: string;
  aboutMe: string;
  fitnessQualifications: string;

  // Step 3: Working Preferences
  workingDays: string[];
  availabilityMorning: boolean;
  availabilityAfternoon: boolean;
  availabilityEvening: boolean;
  maxSessionsPerDay: number;
  preferredWorkingRadius: number; // km
  preferredCities: string[];

  // Step 4: Bank Details
  bankAccountName: string;
  bankName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankUpiId: string;
  panNumber: string;
  gstNumber?: string;

  // Step 5: Verification uploads
  documentAadhaar: string;
  documentPan: string;
  documentSelfie: string;
  documentCertifications: string; // JSON string array
}

export interface SavedAddress {
  id: string;
  userId: string;
  label: 'Home' | 'Office' | 'Gym' | 'Custom';
  name: string;
  building: string;
  street: string;
  landmark: string;
  city: string;
  pinCode: string;
  gpsPlaceholder?: string;
  isDefault: boolean;
}

export interface DBUser {
  id: string;
  name: string;
  phone: string;
  email: string;
  passwordHash: string;
  avatar: string;
  role: 'customer' | 'trainer';
  status: 'active' | 'suspended';
  createdDate: string;
  lastLogin: string;
  deviceInfo: string;
  notificationPrefs: string; // JSON string
}

const STORAGE_KEY = 'virla_production_database';

class DatabaseClient {
  public schema: {
    users: DBUser[];
    profiles: UserProfile[];
    coaches: Coach[];
    workouts: Workout[];
    bookings: Booking[];
    credit_transactions: Invoice[];
    payments: any[];
    hydration: HydrationLog[];
    calories: CalorieLog[];
    notifications: NotificationItem[];
    messages: ChatMessage[];
    addresses: SavedAddress[];
    earnings: TrainerEarning[];
    schedules: ScheduleSlot[];
    trainer_applications: TrainerApplication[];
  } = {
    users: [],
    profiles: [],
    coaches: [],
    workouts: [],
    bookings: [],
    credit_transactions: [],
    payments: [],
    hydration: [],
    calories: [],
    notifications: [],
    messages: [],
    addresses: [],
    earnings: [],
    schedules: [],
    trainer_applications: []
  };

  private currentUserId: string | null = null;
  private isLoaded = false;

  constructor() {
    // Non-blocking load
    this.load();
  }

  generateUUID(prefix = 'id'): string {
    return generateUUID(prefix);
  }

  private log(action: string, details: string) {
    console.log(`[DB LOG] [${new Date().toISOString()}] Action: ${action} | Details: ${details}`);
  }

  async load(): Promise<void> {
    if (this.isLoaded) return;
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        this.schema = {
          ...this.schema,
          ...parsed,
          trainer_applications: parsed.trainer_applications || []
        };
      }
      // Guarantee reference tables are seeded
      this.seedData();
      this.isLoaded = true;
      this.log('LoadDatabase', 'Successfully loaded database from AsyncStorage');
    } catch (err) {
      console.error('[DB ERROR] Failed to load database:', err);
    }
  }

  private async save(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.schema));
    } catch (err) {
      console.error('[DB ERROR] Failed to save database:', err);
    }
  }

  private seedData() {
    let mutated = false;

    // Seed coaches if empty
    if (this.schema.coaches.length === 0) {
      this.schema.coaches = [
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
          isFavourite: false
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
          isFavourite: true
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
          isFavourite: true
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
          isFavourite: false
        }
      ];
      mutated = true;
    }

    // Seed workouts if empty
    if (this.schema.workouts.length === 0) {
      this.schema.workouts = [
        {
          id: 'w-1',
          title: 'PowerForge',
          icon: '💪',
          description: 'Build Strength. Build Confidence. Elite resistance training structured around bodyweight, resistance bands, and custom weights to build lean muscle and speed up metabolism.',
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
          reviews: [{ reviewerName: 'Rohit K.', rating: 5, comment: 'Great strength workout! The coach brought all the resistance bands.' }],
          faqs: [{ question: 'What space do I need?', answer: 'A standard living room space (around 6x6 feet) is more than enough for a full session.' }]
        },
        {
          id: 'w-2',
          title: 'ZenFlow',
          icon: '🧘‍♀️',
          description: 'Balance Mind & Body. Gentle, guided yoga sequences focusing on alignment, breathing work, and deep flexibility to eliminate work stress and joint stiffness.',
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
          reviews: [{ reviewerName: 'Sneha M.', rating: 5, comment: 'Very peaceful. Great breathing exercises at the end. Recommended!' }],
          faqs: [{ question: 'Do I need blocks?', answer: 'If you have blocks it is good, otherwise the trainer will provide them.' }]
        },
        {
          id: 'w-3',
          title: 'CoreAlign',
          icon: '🧘',
          description: 'Core Stability & Posture. Specialized Pilates sessions that target deep abdominal stabilizers, spinal alignment, and postural core balance.',
          calories: 220,
          duration: 45,
          heroImage: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=800&q=80',
          category: 'Mind & Body',
          benefits: ['Deep abdominal strength', 'Spinal alignment', 'Lean muscle toning'],
          difficulty: 'Medium',
          equipment: ['Pilates mat (provided)', 'Resistance circle (provided)'],
          homeVisitBadge: true,
          sessionPrice: 1300,
          rating: 4.85
        },
        {
          id: 'w-4',
          title: 'RhythmX',
          icon: '💃',
          description: 'Move. Sweat. Enjoy. Cardio-intensive dance cardio workouts syncing rhythm, music beats, and energetic movements to burn max calories while having fun.',
          calories: 380,
          duration: 45,
          heroImage: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=800&q=80',
          category: 'Cardio',
          benefits: ['Cardiovascular conditioning', 'Full body coordination', 'Endorphin release'],
          difficulty: 'Medium',
          equipment: ['Comfy sports shoes', 'Water bottle'],
          homeVisitBadge: true,
          sessionPrice: 1000,
          rating: 4.8
        },
        {
          id: 'w-5',
          title: 'KinetiX',
          icon: '⚡',
          description: 'Functional Agility & Balance. Multi-planar conditioning that mimics daily movement biomechanics to build strength, mobility, and lower injury risks.',
          calories: 300,
          duration: 45,
          heroImage: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=800&q=80',
          category: 'Conditioning',
          benefits: ['Better daily life agility', 'Lower injury risk', 'Full body coordination'],
          difficulty: 'Medium',
          equipment: ['Kettlebells (provided)', 'Resistance bands (provided)', 'Mat'],
          homeVisitBadge: true,
          sessionPrice: 1200,
          rating: 4.8
        },
        {
          id: 'w-8',
          title: 'FightLab',
          icon: '🥊',
          description: 'Train Like a Champion. Learn kickboxing combos, speed pad punching, and conditioning drills with a professional personal trainer guiding your guard.',
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
          reviews: [{ reviewerName: 'Kabir B.', rating: 5, comment: 'Brutal but incredibly satisfying workout! Punching pads is the best.' }],
          faqs: [{ question: 'Do I need boxing gloves?', answer: 'No, the trainer will bring sanitized, high-quality focus pads and gloves for you.' }]
        }
      ];
      mutated = true;
    }

    if (mutated) {
      this.save();
    }
  }

  // Auth Operations
  async register(name: string, phone: string, passwordPlain: string): Promise<User> {
    await this.load();
    const existing = this.schema.users.find(u => u.phone === phone);
    if (existing) {
      throw new Error('An account with this mobile number already exists');
    }

    const userId = generateUUID('u');
    const passwordHash = hashPassword(passwordPlain);

    const newUser: DBUser = {
      id: userId,
      name,
      phone,
      email: '',
      passwordHash,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
      role: 'customer',
      status: 'active',
      createdDate: new Date().toLocaleDateString(),
      lastLogin: new Date().toISOString(),
      deviceInfo: 'Simulator',
      notificationPrefs: JSON.stringify({
        bookingUpdates: true,
        trainerMessages: true,
        offers: false,
        membershipAlerts: true,
        workoutReminders: true,
        progressReports: true,
        promotions: false,
        emailNotifications: true,
        smsNotifications: true,
        pushNotifications: true
      })
    };

    const newProfile: UserProfile = {
      id: generateUUID('prof'),
      userId,
      age: 28,
      gender: 'Male',
      height: '178 cm',
      weight: '75 kg',
      fitnessGoal: 'Gain Strength & Fit',
      preferredWorkout: 'PowerForge',
      emergencyContact: JSON.stringify({ name: 'Neha Sharma', relationship: 'Sister', phone: '+91 98200 11223' }),
      medicalNotes: '',
      membershipStatus: 'Elite Premium Member',
      creditsBalance: 12,
      trainerPreference: 'Karan Sharma',
      dob: 'Oct 14, 1995',
      fitnessLevel: 'Intermediate',
      preferredLanguage: 'English',
      city: 'Mumbai',
      memberSince: 'Jul 2025',
      selectedGoals: ['Gain Strength & Fit']
    };

    this.schema.users.push(newUser);
    this.schema.profiles.push(newProfile);
    this.currentUserId = userId;

    await this.save();
    this.log('UserRegistration', `Registered user ${name} (${phone})`);
    return {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      avatar: newUser.avatar,
      location: 'Mumbai, India',
      role: newUser.role
    };
  }

  async login(phone: string, passwordPlain: string): Promise<User> {
    await this.load();
    const hash = hashPassword(passwordPlain);
    const user = this.schema.users.find(u => u.phone === phone && u.passwordHash === hash);
    if (!user) {
      throw new Error('Invalid mobile number or password');
    }

    user.lastLogin = new Date().toISOString();
    this.currentUserId = user.id;

    await this.save();
    this.log('UserLogin', `Logged in user ${user.name} (${phone})`);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      location: 'Mumbai, India',
      role: user.role
    };
  }

  async oauthLogin(provider: string, providerId: string, name: string): Promise<User> {
    await this.load();
    let user = this.schema.users.find(u => u.email === `${providerId}@${provider}.com`);
    if (!user) {
      const userId = generateUUID('u');
      user = {
        id: userId,
        name,
        phone: '',
        email: `${providerId}@${provider}.com`,
        passwordHash: hashPassword(providerId),
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
        role: 'customer',
        status: 'active',
        createdDate: new Date().toLocaleDateString(),
        lastLogin: new Date().toISOString(),
        deviceInfo: 'OAuth',
        notificationPrefs: JSON.stringify({
          bookingUpdates: true,
          trainerMessages: true,
          offers: false,
          membershipAlerts: true,
          workoutReminders: true,
          progressReports: true,
          promotions: false,
          emailNotifications: true,
          smsNotifications: true,
          pushNotifications: true
        })
      };

      const newProfile: UserProfile = {
        id: generateUUID('prof'),
        userId,
        age: 28,
        gender: 'Male',
        height: '178 cm',
        weight: '75 kg',
        fitnessGoal: 'Fat Loss & Strength',
        preferredWorkout: 'PowerForge',
        emergencyContact: JSON.stringify({ name: 'Neha Sharma', relationship: 'Sister', phone: '+91 98200 11223' }),
        medicalNotes: '',
        membershipStatus: 'Elite Premium Member',
        creditsBalance: 12,
        trainerPreference: 'Karan Sharma',
        dob: 'Oct 14, 1995',
        fitnessLevel: 'Intermediate',
        preferredLanguage: 'English',
        city: 'Mumbai',
        memberSince: 'Jul 2025',
        selectedGoals: ['Fat Loss', 'Strength']
      };

      this.schema.users.push(user);
      this.schema.profiles.push(newProfile);
    } else {
      user.lastLogin = new Date().toISOString();
    }

    this.currentUserId = user.id;
    await this.save();
    this.log('OAuthLogin', `OAuth login with ${provider} for user ${user.name}`);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      location: 'Mumbai, India',
      role: user.role
    };
  }

  getCurrentUserId(): string | null {
    return this.currentUserId;
  }

  setCurrentUserId(id: string | null) {
    this.currentUserId = id;
  }

  // Profile Operations
  getProfile(userId: string): UserProfile | null {
    return this.schema.profiles.find(p => p.userId === userId) || null;
  }

  updateProfile(userId: string, fields: Partial<UserProfile>): void {
    const profile = this.getProfile(userId);
    if (profile) {
      Object.assign(profile, fields);
      this.save();
      this.log('UpdateProfile', `Updated profile fields for user ID ${userId}`);
    }
  }

  // Workouts and Coaches
  getWorkouts(): Workout[] {
    return this.schema.workouts;
  }

  getCoaches(): Coach[] {
    return this.schema.coaches;
  }

  updateCoach(coachId: string, fields: Partial<Coach>): void {
    const coach = this.schema.coaches.find(c => c.id === coachId);
    if (coach) {
      Object.assign(coach, fields);
      this.save();
      this.log('UpdateCoach', `Updated profile fields for coach ID ${coachId}`);
    }
  }

  toggleFavouriteCoach(coachId: string): void {
    const coach = this.schema.coaches.find(c => c.id === coachId);
    if (coach) {
      coach.isFavourite = !coach.isFavourite;
      this.save();
      this.log('ToggleFavouriteCoach', `Toggled favourite status of coach ${coach.name}`);
    }
  }

  // Bookings & Sessions
  getBookings(userId: string): Booking[] {
    const userObj = this.schema.users.find(u => u.id === userId);
    if (userObj && userObj.role === 'trainer') {
      return this.schema.bookings.filter(b => b.trainerName === userObj.name);
    }
    return this.schema.bookings.filter(b => b.id.includes(userId) || b.id.startsWith('b-'));
  }

  addBooking(userId: string, bookingData: Omit<Booking, 'id' | 'status' | 'timelineStatus'>): Booking {
    const bookingId = generateUUID('booking');
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const newBooking: Booking = {
      ...bookingData,
      id: bookingId,
      status: 'upcoming',
      timelineStatus: 'booked',
      otp
    };

    this.schema.bookings.unshift(newBooking);

    // Deduct credits
    const profile = this.getProfile(userId);
    if (profile) {
      profile.creditsBalance = Math.max(0, profile.creditsBalance - 1);
    }

    // Ledger transaction
    this.addLedgerTransaction(userId, {
      id: generateUUID('tx'),
      type: 'paid',
      amount: '₹0', // quota debit
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
      status: 'paid',
      credits: -1
    });

    this.save();
    this.log('AddBooking', `User ${userId} booked ${bookingData.workoutTitle} with OTP ${otp}`);
    return newBooking;
  }

  cancelBooking(userId: string, bookingId: string, reason = ''): void {
    const booking = this.schema.bookings.find(b => b.id === bookingId);
    if (booking && booking.status === 'upcoming') {
      const isLate = booking.timelineStatus === 'trainer_travelling' || booking.timelineStatus === 'trainer_arrived';
      booking.status = 'cancelled';
      booking.timelineStatus = 'session_closed';

      if (isLate) {
        // Late cancellation penalty - forfeit credit
        this.addLedgerTransaction(userId, {
          id: generateUUID('tx'),
          type: 'paid',
          amount: '₹0',
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
          status: 'paid',
          credits: -1
        });
        this.log('LateCancellationPenalty', `Fined user ${userId} for late cancellation of ${bookingId}`);
      } else {
        // Full refund
        const profile = this.getProfile(userId);
        if (profile) {
          profile.creditsBalance += 1;
        }
        this.addLedgerTransaction(userId, {
          id: generateUUID('tx'),
          type: 'paid',
          amount: '₹0',
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
          status: 'paid',
          credits: 1
        });
      }

      this.save();
    }
  }

  rescheduleBooking(bookingId: string, date: string, time: string): void {
    const booking = this.schema.bookings.find(b => b.id === bookingId);
    if (booking) {
      booking.date = date;
      booking.time = time;
      booking.status = 'upcoming';
      booking.timelineStatus = 'booked';
      this.save();
      this.log('RescheduleBooking', `Rescheduled booking ${bookingId} to ${date} at ${time}`);
    }
  }

  updateTimelineStatus(bookingId: string, timelineStatus: Booking['timelineStatus']): void {
    const booking = this.schema.bookings.find(b => b.id === bookingId);
    if (booking) {
      booking.timelineStatus = timelineStatus;
      if (timelineStatus === 'session_closed' || timelineStatus === 'workout_completed') {
        booking.status = 'completed';
      }
      this.save();
      this.log('UpdateTimelineStatus', `Updated booking ${bookingId} status to ${timelineStatus}`);
    }
  }

  updateBookingRating(bookingId: string, ratingDetails: Booking['ratingDetails']): void {
    const booking = this.schema.bookings.find(b => b.id === bookingId);
    if (booking) {
      booking.ratingDetails = ratingDetails;
      booking.timelineStatus = 'session_closed';
      booking.status = 'completed';
      this.save();
      this.log('RateSession', `Rated session ${bookingId} overall ${ratingDetails?.overallRating}`);
    }
  }

  // Hydration Operations
  getHydration(userId: string, date: string): number {
    const logs = this.schema.hydration.filter(l => l.userId === userId && l.date === date);
    return logs.reduce((sum, current) => sum + current.amount, 0);
  }

  logHydration(userId: string, date: string, amount: number): number {
    const id = generateUUID('hyd');
    this.schema.hydration.push({ id, userId, date, amount });
    this.save();
    this.log('LogHydration', `Logged ${amount}ml of water for user ${userId}`);
    return this.getHydration(userId, date);
  }

  // Calories Operations
  getCalories(userId: string, date: string): number {
    // Sum from calorie logs + completed sessions today
    const logs = this.schema.calories.filter(l => l.userId === userId && l.date === date);
    const manualKcal = logs.reduce((sum, curr) => sum + curr.amount, 0);

    // Filter completed sessions today
    const sessionsKcal = this.schema.bookings
      .filter(b => b.status === 'completed' && b.date === date)
      .reduce((sum, curr) => sum + (curr.caloriesBurned || 300), 0);

    return manualKcal + sessionsKcal;
  }

  logCalories(userId: string, date: string, amount: number): number {
    const id = generateUUID('cal');
    this.schema.calories.push({ id, userId, date, amount });
    this.save();
    this.log('LogCalories', `Logged ${amount}kcal for user ${userId}`);
    return this.getCalories(userId, date);
  }

  // Streaks calculation
  getStreak(userId: string): number {
    const completedDates = this.schema.bookings
      .filter(b => b.status === 'completed')
      .map(b => b.date);

    if (completedDates.length === 0) return 0;

    // Parse unique dates
    const uniqueDates = Array.from(new Set(completedDates)).map(d => new Date(d));
    uniqueDates.sort((a, b) => b.getTime() - a.getTime()); // desc

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let checkDate = new Date(today);
    
    // Check if the user worked out today or yesterday to continue streak
    let workoutFound = uniqueDates.some(d => d.toDateString() === today.toDateString());
    if (!workoutFound) {
      checkDate.setDate(today.getDate() - 1);
      workoutFound = uniqueDates.some(d => d.toDateString() === checkDate.toDateString());
    }

    if (!workoutFound) return 0;

    while (true) {
      const match = uniqueDates.some(d => d.toDateString() === checkDate.toDateString());
      if (match) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  }

  // Recovery Score Calculation
  getRecoveryScore(userId: string, date: string): number | null {
    // Return null if no workouts completed yet, and hydration is 0
    const workoutsCount = this.schema.bookings.filter(b => b.status === 'completed').length;
    const waterToday = this.getHydration(userId, date);

    if (workoutsCount === 0 && waterToday === 0) {
      return null;
    }

    // Dynamic recovery calculation
    const hydrationPercentage = Math.min(100, (waterToday / 2500) * 100);
    const streakBonus = Math.min(20, this.getStreak(userId) * 4);
    const score = Math.round(50 + (hydrationPercentage * 0.3) + streakBonus);
    return Math.min(100, score);
  }

  // Invoices & Purchases
  getLedgerTransactions(userId: string): Invoice[] {
    return this.schema.credit_transactions;
  }

  addLedgerTransaction(userId: string, tx: Invoice) {
    this.schema.credit_transactions.unshift(tx);
    this.save();
  }

  getPayments(userId: string): any[] {
    return this.schema.payments;
  }

  purchasePlan(userId: string, planName: string, credits: number, priceText: string, gstText: string, totalText: string): void {
    const invoiceNo = `VR-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const date = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

    const newPay = {
      id: generateUUID('pay'),
      invoiceNo,
      date,
      planName,
      credits,
      amount: priceText,
      gst: gstText,
      total: totalText,
      method: 'Apple Pay (•••• 4920)',
      status: 'completed'
    };

    const newTx: Invoice = {
      id: generateUUID('tx'),
      type: 'paid',
      amount: totalText,
      date,
      status: 'paid',
      credits
    };

    this.schema.payments.unshift(newPay);
    this.schema.credit_transactions.unshift(newTx);

    const profile = this.getProfile(userId);
    if (profile) {
      profile.creditsBalance += credits;
    }

    this.save();
    this.log('PurchaseCredits', `User ${userId} bought ${planName} for ${totalText} adding ${credits} credits`);
  }

  // Notifications Operations
  getNotifications(userId: string): NotificationItem[] {
    return this.schema.notifications;
  }

  addNotification(userId: string, item: Omit<NotificationItem, 'id' | 'read' | 'timestamp' | 'group'>): NotificationItem {
    const newNotify: NotificationItem = {
      ...item,
      id: generateUUID('notify'),
      read: false,
      timestamp: 'Just now',
      group: 'today'
    };
    this.schema.notifications.unshift(newNotify);
    this.save();
    this.log('AddNotification', `Logged notification for user ${userId}: ${item.title}`);
    return newNotify;
  }

  markNotificationAsRead(userId: string, id: string): void {
    const n = this.schema.notifications.find(item => item.id === id);
    if (n) {
      n.read = true;
      this.save();
    }
  }

  markAllNotificationsRead(userId: string): void {
    this.schema.notifications.forEach(n => {
      n.read = true;
    });
    this.save();
  }

  clearAllNotifications(userId: string): void {
    this.schema.notifications = [];
    this.save();
  }

  // Chats & Chat Messages
  getChats(userId: string): any[] {
    // Dynamic listing of chats joined with mock coaches details
    return [
      {
        id: 'chat-c-1',
        name: 'Coach Karan Sharma',
        avatar: 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?auto=format&fit=crop&w=150&q=80',
        lastMessage: this.getLastChatMessage('chat-c-1') || "I'll be bringing the resistance bands today. See you at 10 AM!",
        time: '20m ago',
        unread: this.hasUnreadMessages('chat-c-1')
      },
      {
        id: 'chat-c-2',
        name: 'Coach Priya Patel',
        avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80',
        lastMessage: this.getLastChatMessage('chat-c-2') || 'Great job during yesterday yoga session! Take plenty of fluids.',
        time: 'Yesterday',
        unread: this.hasUnreadMessages('chat-c-2')
      }
    ];
  }

  getChatMessages(chatId: string): ChatMessage[] {
    const list = this.schema.messages.filter(m => m.chatId === chatId);
    if (list.length === 0) {
      // Seed initial messages for chat-c-1
      if (chatId === 'chat-c-1') {
        return [
          { id: 'm-init-1', chatId, sender: 'coach', text: "Hello! I'm preparing for our Strength session today.", timestamp: '10:05 AM' },
          { id: 'm-init-2', chatId, sender: 'coach', text: 'Do you have any specific areas of muscle soreness we should prioritize?', timestamp: '10:06 AM' }
        ];
      }
    }
    return list;
  }

  sendChatMessage(chatId: string, text: string, sender: 'user' | 'coach' | 'virla'): ChatMessage {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msg: ChatMessage = {
      id: generateUUID('msg'),
      chatId,
      sender,
      text,
      timestamp: timeStr
    };
    this.schema.messages.push(msg);
    this.save();

    this.log('SendMessage', `Sent message: "${text}" in chat ${chatId}`);
    return msg;
  }

  private getLastChatMessage(chatId: string): string | null {
    const list = this.getChatMessages(chatId);
    return list.length > 0 ? list[list.length - 1].text : null;
  }

  private hasUnreadMessages(chatId: string): boolean {
    const list = this.getChatMessages(chatId);
    return list.some(m => m.sender !== 'user' && m.id.startsWith('msg-u-')); // unread mock logic
  }

  // Address Management
  getAddresses(userId: string): SavedAddress[] {
    return this.schema.addresses;
  }

  addAddress(userId: string, addr: Omit<SavedAddress, 'id' | 'userId'>): SavedAddress {
    const id = generateUUID('addr');
    const newAddr: SavedAddress = {
      ...addr,
      id,
      userId,
      isDefault: addr.isDefault
    };

    if (addr.isDefault) {
      this.schema.addresses.forEach(a => {
        a.isDefault = false;
      });
    }

    this.schema.addresses.push(newAddr);
    this.save();
    return newAddr;
  }

  updateAddress(id: string, fields: Partial<SavedAddress>): void {
    const addr = this.schema.addresses.find(a => a.id === id);
    if (addr) {
      Object.assign(addr, fields);
      if (fields.isDefault) {
        this.schema.addresses.forEach(a => {
          if (a.id !== id) a.isDefault = false;
        });
      }
      this.save();
    }
  }

  deleteAddress(id: string): void {
    this.schema.addresses = this.schema.addresses.filter(a => a.id !== id);
    this.save();
  }

  // AI Wellness Coach Recommendations
  getAIRecommendations(userId: string): { title: string; desc: string }[] {
    const profile = this.getProfile(userId);
    if (!profile || !profile.fitnessGoal) {
      return [
        { title: 'Complete Profile 📋', desc: 'Add your fitness goals to generate custom AI wellness briefs.' },
        { title: 'Book First Session 🏋️', desc: 'Schedule a recovery or conditioning session to begin metrics tracking.' }
      ];
    }

    const workoutsCount = this.schema.bookings.filter(b => b.status === 'completed').length;
    if (workoutsCount === 0) {
      return [
        { title: 'Start with PowerForge', desc: `Ready to target "${profile.fitnessGoal}"? Schedule a low-intensity mobility session.` },
        { title: 'Hydration Briefing', desc: 'Drinking 2.5L water daily optimizes your recovery indices.' },
        { title: 'Add Emergency Contact', desc: 'Secure verification: double-check emergency contact notes are set.' }
      ];
    }

    return [
      { title: 'Increase Intensity 🔥', desc: `Optimal Recovery: Great day to book a strength PowerForge session based on your goal "${profile.fitnessGoal}".` },
      { title: 'Try ZenFlow Yoga 🧘‍♀️', desc: 'Active recovery: loosen muscle tightness with 45 mins gentle mobility yoga.' },
      { title: 'Streak Boost ⏱', desc: 'You are building a great workout habit. Log 1 session tomorrow to continue.' }
    ];
  }

  // Trainer Earnings & Schedules (Sprint 6 & 7)
  getEarnings(userId: string): TrainerEarning[] {
    return this.schema.earnings;
  }

  addEarning(earning: Omit<TrainerEarning, 'id' | 'date'>): void {
    const date = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    const id = generateUUID('earn');
    this.schema.earnings.unshift({
      ...earning,
      id,
      date
    });
    this.save();
  }

  submitTrainerApplication(appData: Omit<TrainerApplication, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<TrainerApplication> {
    const id = generateUUID('app');
    const newApp: TrainerApplication = {
      ...appData,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'pending'
    };
    this.schema.trainer_applications.unshift(newApp);
    this.save();
    return Promise.resolve(newApp);
  }

  getTrainerApplication(phone: string): TrainerApplication | null {
    return this.schema.trainer_applications.find(a => a.phone === phone) || null;
  }

  async approveTrainerApplication(appId: string): Promise<void> {
    const app = this.schema.trainer_applications.find(a => a.id === appId);
    if (app) {
      app.status = 'approved';
      app.updatedAt = new Date().toISOString();

      // Check if user already exists
      let userObj = this.schema.users.find(u => u.phone === app.phone);
      if (!userObj) {
        userObj = {
          id: generateUUID('user'),
          name: app.fullName,
          phone: app.phone,
          email: app.email,
          passwordHash: hashPassword('password123'),
          avatar: app.avatar || 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?auto=format&fit=crop&w=150&q=80',
          role: 'trainer',
          status: 'active',
          createdDate: new Date().toISOString(),
          lastLogin: '',
          deviceInfo: 'Simulated Onboard',
          notificationPrefs: JSON.stringify({
            bookingUpdates: true,
            trainerMessages: true,
            offers: true,
            membershipAlerts: true
          })
        };
        this.schema.users.push(userObj);
      } else {
        userObj.role = 'trainer';
      }

      // Create coach profile if not exists
      let coachObj = this.schema.coaches.find(c => c.name === app.fullName);
      if (!coachObj) {
        const newCoach: Coach = {
          id: generateUUID('coach'),
          name: app.fullName,
          photo: app.avatar || 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?auto=format&fit=crop&w=300&q=80',
          experience: `${app.yearsOfExperience} yrs exp`,
          rating: 5.0,
          specialty: app.primaryWorkout,
          yearsExperience: app.yearsOfExperience,
          specialization: `${app.primaryWorkout}, ${app.secondarySkills}`,
          languages: app.languages.split(',').map(s => s.trim()),
          shortBio: app.aboutMe,
          completedSessions: 0,
          aboutText: app.fitnessQualifications,
          availability: app.workingDays,
          workingRadius: `${app.preferredWorkingRadius} km`,
          bankDetails: JSON.stringify({
            accountName: app.bankAccountName,
            bankName: app.bankName,
            accountNumber: app.bankAccountNumber,
            ifsc: app.bankIfsc,
            upiId: app.bankUpiId
          }),
          emergencyContact: app.emergencyContact
        };
        this.schema.coaches.push(newCoach);
        coachObj = newCoach;
      }

      // Create profile for trainer user
      let profileObj = this.schema.profiles.find(p => p.userId === userObj!.id);
      if (!profileObj) {
        profileObj = {
          id: generateUUID('prof'),
          userId: userObj.id,
          age: 30,
          gender: app.gender,
          height: '180 cm',
          weight: '80 kg',
          fitnessGoal: app.primaryWorkout,
          preferredWorkout: 'PowerForge',
          emergencyContact: app.emergencyContact,
          medicalNotes: '',
          membershipStatus: 'Trainer Account',
          creditsBalance: 0,
          trainerPreference: '',
          dob: app.dob,
          fitnessLevel: 'Trainer',
          preferredLanguage: app.languages.split(',')[0] || 'English',
          city: app.city,
          memberSince: 'Jul 2025',
          selectedGoals: [app.primaryWorkout]
        };
        this.schema.profiles.push(profileObj);
      }

      await this.save();
      this.log('ApproveTrainer', `Approved application for ${app.fullName} and generated trainer login.`);
    }
  }

  async rejectTrainerApplication(appId: string): Promise<void> {
    const app = this.schema.trainer_applications.find(a => a.id === appId);
    if (app) {
      app.status = 'rejected';
      app.updatedAt = new Date().toISOString();
      await this.save();
      this.log('RejectTrainer', `Rejected application for ${app.fullName}.`);
    }
  }
}

export const Database = new DatabaseClient();
