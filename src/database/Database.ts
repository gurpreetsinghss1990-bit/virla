import { supabase } from './supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, Workout, Coach, Booking, NotificationItem, Invoice, TrainerEarning, ScheduleSlot, AssignmentLog } from '../types';

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
  sender: 'user' | 'coach' | 'virla' | 'customer' | 'trainer';
  text: string;
  timestamp: string;
  isPinned?: boolean;
  isFavorite?: boolean;
}

export interface TrainerApplication {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: 'pending' | 'approved' | 'rejected' | 'info_requested';
  
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
  aadhaarStatus?: 'pending_verification' | 'verified' | 'rejected';
  panStatus?: 'pending_verification' | 'verified' | 'rejected';
  aadhaarVerificationNotes?: string;
  panVerificationNotes?: string;
  adminNotes?: string;
  acceptedAgreementTimestamp?: string;
  acceptedAgreementAppVersion?: string;
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
  
  lat?: number;
  lng?: number;
  apartment?: string;
  floor?: string;
  notes?: string;
}

export interface DBUser {
  id: string;
  name: string;
  phone: string;
  email: string;
  passwordHash: string;
  avatar: string;
  role: 'customer' | 'trainer' | 'admin';
  status: 'active' | 'suspended';
  createdDate: string;
  lastLogin: string;
  deviceInfo: string;
  notificationPrefs: string; // JSON string
}

// ==================== MAPPERS ====================

export function mapDBUser(row: any): DBUser {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email || '',
    passwordHash: row.password_hash || '',
    avatar: row.avatar || '',
    role: row.role,
    status: row.status,
    createdDate: row.created_date || '',
    lastLogin: row.last_login || '',
    deviceInfo: row.device_info || '',
    notificationPrefs: JSON.stringify(row.notification_prefs || {})
  };
}

export function mapDBUserToPostgres(user: DBUser): any {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    password_hash: user.passwordHash,
    avatar: user.avatar,
    role: user.role,
    status: user.status,
    created_date: user.createdDate,
    last_login: user.lastLogin,
    device_info: user.deviceInfo,
    notification_prefs: JSON.parse(user.notificationPrefs || '{}')
  };
}

export function mapUserProfile(row: any): UserProfile {
  return {
    id: row.id,
    userId: row.user_id,
    age: row.age || 0,
    gender: row.gender || '',
    height: row.height || '',
    weight: row.weight || '',
    fitnessGoal: row.fitness_goal || '',
    preferredWorkout: row.preferred_workout || '',
    emergencyContact: JSON.stringify(row.emergency_contact || {}),
    medicalNotes: row.medical_notes || '',
    membershipStatus: row.membership_status || '',
    creditsBalance: row.credits_balance || 0,
    trainerPreference: row.trainer_preference || '',
    dob: row.dob || '',
    fitnessLevel: row.fitness_level || '',
    preferredLanguage: row.preferred_language || '',
    city: row.city || '',
    memberSince: row.member_since || '',
    selectedGoals: row.selected_goals || []
  };
}

export function mapUserProfileToPostgres(profile: UserProfile): any {
  return {
    id: profile.id,
    user_id: profile.userId,
    age: profile.age,
    gender: profile.gender,
    height: profile.height,
    weight: profile.weight,
    fitness_goal: profile.fitnessGoal,
    preferred_workout: profile.preferredWorkout,
    emergency_contact: JSON.parse(profile.emergencyContact || '{}'),
    medical_notes: profile.medicalNotes,
    membership_status: profile.membershipStatus,
    credits_balance: profile.creditsBalance,
    trainer_preference: profile.trainerPreference,
    dob: profile.dob,
    fitness_level: profile.fitnessLevel,
    preferred_language: profile.preferredLanguage,
    city: profile.city,
    member_since: profile.memberSince,
    selected_goals: profile.selectedGoals
  };
}

export function mapCoach(row: any): Coach {
  return {
    id: row.id,
    name: row.name,
    photo: row.photo || '',
    experience: row.experience || '',
    rating: Number(row.rating) || 5.0,
    specialty: row.specialty || '',
    yearsExperience: row.years_experience || 0,
    specialization: row.specialization || '',
    languages: row.languages || [],
    shortBio: row.short_bio || '',
    price: row.price || 1200,
    verifiedBadge: row.verified_badge ?? true,
    certifications: row.certifications || [],
    achievements: row.achievements || [],
    reviews: row.reviews || [],
    workoutSpecialties: row.workout_specialties || [],
    availability: row.availability || [],
    level: row.level || 'Associate',
    completedSessions: row.completed_sessions || 0,
    isFavourite: row.is_favourite ?? false,
    weeklySlotsSubmitted: row.weekly_slots_submitted || 0,
    remainingSlotChanges: row.remaining_slot_changes || 3,
    retainerStatus: row.retainer_status || 'not_eligible',
    attendanceRate: Number(row.attendance_rate) || 100.0,
    punctualityRate: Number(row.punctuality_rate) || 100.0,
    availabilityCompliance: Number(row.availability_compliance) || 100.0,
    bankDetails: row.bank_details ? JSON.stringify(row.bank_details) : '',
    emergencyContact: row.emergency_contact ? JSON.stringify(row.emergency_contact) : '',
    aboutText: row.about_text || '',
    workingRadius: row.working_radius || '',
    preferences: row.preferences ? (typeof row.preferences === 'string' ? JSON.parse(row.preferences) : row.preferences) : { online: false, radiusKm: 15, maxDailySessions: 5, categories: [] }
  };
}

export function mapCoachToPostgres(coach: Coach): any {
  return {
    id: coach.id,
    name: coach.name,
    photo: coach.photo,
    experience: coach.experience,
    rating: coach.rating,
    specialty: coach.specialty,
    years_experience: coach.yearsExperience,
    specialization: coach.specialization,
    languages: coach.languages,
    short_bio: coach.shortBio,
    completed_sessions: coach.completedSessions,
    is_favourite: coach.isFavourite,
    weekly_slots_submitted: coach.weeklySlotsSubmitted,
    remaining_slot_changes: coach.remainingSlotChanges,
    retainer_status: coach.retainerStatus,
    attendance_rate: coach.attendanceRate,
    punctuality_rate: coach.punctualityRate,
    availability_compliance: coach.availabilityCompliance,
    bank_details: coach.bankDetails ? JSON.parse(coach.bankDetails) : null,
    emergency_contact: coach.emergencyContact ? JSON.parse(coach.emergencyContact) : null,
    about_text: coach.aboutText,
    availability: coach.availability,
    working_radius: coach.workingRadius,
    preferences: coach.preferences || { online: false, radiusKm: 15, maxDailySessions: 5, categories: [] }
  };
}

export function mapWorkout(row: any): Workout {
  return {
    id: row.id,
    title: row.title,
    icon: row.icon || '',
    description: row.description || '',
    calories: row.calories || 300,
    duration: row.duration || 45,
    heroImage: row.hero_image || '',
    category: row.category || '',
    benefits: row.benefits || [],
    difficulty: row.difficulty || 'Medium',
    equipment: row.equipment || [],
    homeVisitBadge: row.home_visit_badge ?? true,
    sessionPrice: row.session_price || 1200,
    rating: Number(row.rating) || 4.8,
    reviews: row.reviews || [],
    faqs: row.faqs || []
  };
}

export function mapWorkoutToPostgres(w: Workout): any {
  return {
    id: w.id,
    title: w.title,
    icon: w.icon,
    description: w.description,
    calories: w.calories,
    duration: w.duration,
    hero_image: w.heroImage || '',
    category: w.category || '',
    benefits: w.benefits || [],
    difficulty: w.difficulty || 'Medium',
    equipment: w.equipment || [],
    home_visit_badge: w.homeVisitBadge ?? true,
    session_price: w.sessionPrice || 1200,
    rating: w.rating || 5.0,
    reviews: w.reviews || [],
    faqs: w.faqs || []
  };
}

export function mapBooking(row: any): Booking {
  return {
    id: row.id,
    status: row.status,
    timelineStatus: row.timeline_status,
    otp: row.otp,
    clientName: row.client_name || '',
    clientPhone: row.client_phone || '',
    trainerName: row.trainer_name || '',
    trainerPhoto: row.trainer_photo || '',
    date: row.date,
    time: row.time,
    workoutTitle: row.workout_title,
    price: row.price,
    address: row.address || '',
    clientId: row.client_id || '',
    trainerId: row.trainer_id || '',
    trainerLevel: row.trainer_level,
    trainerRating: Number(row.trainer_rating) || 5.0,
    trainerCompletedSessions: row.trainer_completed_sessions,
    trainerSpeciality: row.trainer_speciality,
    trainerLanguages: row.trainer_languages || [],
    trainerDistance: row.trainer_distance,
    trainerArrivalTime: row.trainer_arrival_time,
    caloriesBurned: row.calories_burned,
    durationMinutes: row.duration_minutes,
    ratingDetails: row.rating_details ? JSON.parse(row.rating_details) : undefined,
    trainerNote: row.trainer_note || undefined,
    createdAt: row.created_at ? Number(row.created_at) : undefined,
  };
}

export function mapBookingToPostgres(b: Booking): any {
  return {
    id: b.id,
    status: b.status,
    timeline_status: b.timelineStatus,
    otp: b.otp,
    client_name: b.clientName || '',
    client_phone: b.clientPhone || '',
    trainer_name: b.trainerName,
    trainer_photo: b.trainerPhoto,
    date: b.date,
    time: b.time,
    workout_title: b.workoutTitle,
    price: b.price || 0,
    address: b.address || '',
    client_id: b.clientId || null,
    trainer_id: b.trainerId || null,
    trainer_level: b.trainerLevel,
    trainer_rating: b.trainerRating,
    trainer_completed_sessions: b.trainerCompletedSessions,
    trainer_speciality: b.trainerSpeciality,
    trainer_languages: b.trainerLanguages,
    trainer_distance: b.trainerDistance,
    trainer_arrival_time: b.trainerArrivalTime,
    calories_burned: b.caloriesBurned,
    duration_minutes: b.durationMinutes,
    rating_details: b.ratingDetails ? JSON.stringify(b.ratingDetails) : null,
    trainer_note: b.trainerNote || null,
    created_at: b.createdAt || null,
  };
}

export function mapInvoice(row: any): Invoice {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type || 'paid',
    amount: row.amount || '',
    date: row.date || '',
    status: row.status || 'paid',
    credits: row.credits || 0
  };
}

export function mapInvoiceToPostgres(inv: Invoice, userId: string): any {
  return {
    id: inv.id,
    user_id: userId,
    type: inv.type,
    amount: inv.amount,
    date: inv.date,
    status: inv.status,
    credits: inv.credits
  };
}

export function mapHydrationLog(row: any): HydrationLog {
  return {
    id: row.id,
    userId: row.user_id,
    date: row.date,
    amount: row.amount
  };
}

export function mapHydrationLogToPostgres(log: HydrationLog): any {
  return {
    id: log.id,
    user_id: log.userId,
    date: log.date,
    amount: log.amount
  };
}

export function mapCalorieLog(row: any): CalorieLog {
  return {
    id: row.id,
    userId: row.user_id,
    date: row.date,
    amount: row.amount
  };
}

export function mapCalorieLogToPostgres(log: CalorieLog): any {
  return {
    id: log.id,
    user_id: log.userId,
    date: log.date,
    amount: log.amount
  };
}

export function mapNotificationItem(row: any): NotificationItem {
  let body = row.body || '';
  let type: any = 'System';
  let priority: any = 'medium';
  let actionLabel = '';
  let deepLink = '';
  let expiry = '';

  if (body.startsWith('{"is_meta":true')) {
    try {
      const parsed = JSON.parse(body);
      body = parsed.body || '';
      type = parsed.type || 'System';
      priority = parsed.priority || 'medium';
      actionLabel = parsed.actionLabel || '';
      deepLink = parsed.deepLink || '';
      expiry = parsed.expiry || '';
    } catch (e) {
      // fallback
    }
  }

  return {
    id: row.id,
    title: row.title,
    body: body,
    read: row.read ?? false,
    timestamp: row.timestamp || '',
    group: row.group || 'today',
    icon: row.icon || '',
    type,
    priority,
    actionLabel,
    deepLink,
    expiry
  };
}

export function mapNotificationItemToPostgres(n: NotificationItem, userId: string): any {
  const bodyPayload = JSON.stringify({
    is_meta: true,
    body: n.body,
    type: n.type || 'System',
    priority: n.priority || 'medium',
    actionLabel: n.actionLabel || '',
    deepLink: n.deepLink || '',
    expiry: n.expiry || ''
  });

  return {
    id: n.id,
    user_id: userId,
    title: n.title,
    body: bodyPayload,
    read: n.read,
    timestamp: n.timestamp,
    group: n.group,
    icon: n.icon || ''
  };
}

export function mapChatMessage(row: any): ChatMessage {
  return {
    id: row.id,
    chatId: row.chat_id,
    sender: row.sender,
    text: row.text,
    timestamp: row.timestamp,
    isPinned: row.is_pinned ?? false,
    isFavorite: row.is_favorite ?? false
  };
}

export function mapChatMessageToPostgres(msg: ChatMessage): any {
  return {
    id: msg.id,
    chat_id: msg.chatId,
    sender: msg.sender,
    text: msg.text,
    timestamp: msg.timestamp,
    is_pinned: msg.isPinned,
    is_favorite: msg.isFavorite
  };
}

export function mapSavedAddress(row: any): SavedAddress {
  return {
    id: row.id,
    userId: row.user_id,
    label: row.label,
    name: row.name,
    building: row.building,
    street: row.street,
    landmark: row.landmark || '',
    city: row.city,
    pinCode: row.pin_code,
    gpsPlaceholder: row.gps_placeholder || '',
    isDefault: row.is_default,
    lat: row.lat || 0,
    lng: row.lng || 0,
    apartment: row.apartment || '',
    floor: row.floor || '',
    notes: row.notes || ''
  };
}

export function mapSavedAddressToPostgres(addr: SavedAddress): any {
  return {
    id: addr.id,
    user_id: addr.userId,
    label: addr.label,
    name: addr.name,
    building: addr.building,
    street: addr.street,
    landmark: addr.landmark,
    city: addr.city,
    pin_code: addr.pinCode,
    gps_placeholder: addr.gpsPlaceholder,
    is_default: addr.isDefault,
    lat: addr.lat || 0,
    lng: addr.lng || 0,
    apartment: addr.apartment || '',
    floor: addr.floor || '',
    notes: addr.notes || ''
  };
}

export function mapTrainerEarning(row: any): TrainerEarning {
  return {
    id: row.id,
    bookingId: row.booking_id,
    clientName: row.client_name,
    amount: row.amount,
    date: row.date,
    type: row.type
  };
}

export function mapTrainerEarningToPostgres(earn: TrainerEarning, trainerId: string): any {
  return {
    id: earn.id,
    trainer_id: trainerId,
    booking_id: earn.bookingId,
    client_name: earn.clientName,
    amount: earn.amount,
    date: earn.date,
    type: earn.type
  };
}

export function mapTrainerApplication(row: any): TrainerApplication {
  let certsObj: any = {};
  try {
    certsObj = row.document_certifications ? (typeof row.document_certifications === 'string' ? JSON.parse(row.document_certifications) : row.document_certifications) : {};
  } catch (e) {
    certsObj = {};
  }

  const certsList = Array.isArray(certsObj) ? certsObj : (certsObj.certifications || []);
  const aadhaarStatus = certsObj.aadhaarStatus || 'pending_verification';
  const panStatus = certsObj.panStatus || 'pending_verification';
  const aadhaarVerificationNotes = certsObj.aadhaarVerificationNotes || '';
  const panVerificationNotes = certsObj.panVerificationNotes || '';
  const adminNotes = certsObj.adminNotes || '';
  const acceptedAgreementTimestamp = certsObj.acceptedAgreementTimestamp || '';
  const acceptedAgreementAppVersion = certsObj.acceptedAgreementAppVersion || '';

  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status,
    fullName: row.full_name,
    phone: row.phone,
    email: row.email,
    dob: row.dob,
    gender: row.gender,
    avatar: row.avatar || '',
    address: row.address,
    city: row.city,
    state: row.state,
    pinCode: row.pin_code,
    emergencyContact: JSON.stringify(row.emergency_contact || {}),
    primaryWorkout: row.primary_workout,
    secondarySkills: row.secondary_skills,
    yearsOfExperience: row.years_of_experience,
    languages: row.languages,
    aboutMe: row.about_me,
    fitnessQualifications: row.fitness_qualifications,
    workingDays: row.working_days || [],
    availabilityMorning: row.availability_morning,
    availabilityAfternoon: row.availability_afternoon,
    availabilityEvening: row.availability_evening,
    maxSessionsPerDay: row.max_sessions_per_day,
    preferredWorkingRadius: row.preferred_working_radius,
    preferredCities: row.preferred_cities || [],
    bankAccountName: row.bank_account_name || '',
    bankName: row.bank_name || '',
    bankAccountNumber: row.bank_account_number || '',
    bankIfsc: row.bank_ifsc || '',
    bankUpiId: row.bank_upi_id || '',
    panNumber: row.pan_number,
    gstNumber: row.gst_number || '',
    documentAadhaar: row.document_aadhaar,
    documentPan: row.document_pan,
    documentSelfie: row.document_selfie,
    documentCertifications: JSON.stringify(certsList),
    aadhaarStatus,
    panStatus,
    aadhaarVerificationNotes,
    panVerificationNotes,
    adminNotes,
    acceptedAgreementTimestamp,
    acceptedAgreementAppVersion
  };
}

export function mapTrainerApplicationToPostgres(app: TrainerApplication): any {
  let certsList = [];
  try {
    certsList = JSON.parse(app.documentCertifications || '[]');
  } catch (e) {
    certsList = [];
  }

  const certsObj = {
    certifications: certsList,
    aadhaarStatus: app.aadhaarStatus || 'pending_verification',
    panStatus: app.panStatus || 'pending_verification',
    aadhaarVerificationNotes: app.aadhaarVerificationNotes || '',
    panVerificationNotes: app.panVerificationNotes || '',
    adminNotes: app.adminNotes || '',
    acceptedAgreementTimestamp: app.acceptedAgreementTimestamp || '',
    acceptedAgreementAppVersion: app.acceptedAgreementAppVersion || ''
  };

  return {
    id: app.id,
    created_at: app.createdAt,
    updated_at: app.updatedAt,
    status: app.status,
    full_name: app.fullName,
    phone: app.phone,
    email: app.email,
    dob: app.dob,
    gender: app.gender,
    avatar: app.avatar,
    address: app.address,
    city: app.city,
    state: app.state,
    pin_code: app.pinCode,
    emergency_contact: JSON.parse(app.emergencyContact || '{}'),
    primary_workout: app.primaryWorkout,
    secondary_skills: app.secondarySkills,
    years_of_experience: app.yearsOfExperience,
    languages: app.languages,
    about_me: app.aboutMe,
    fitness_qualifications: app.fitnessQualifications,
    working_days: app.workingDays,
    availability_morning: app.availabilityMorning,
    availability_afternoon: app.availabilityAfternoon,
    availability_evening: app.availabilityEvening,
    max_sessions_per_day: app.maxSessionsPerDay,
    preferred_working_radius: app.preferredWorkingRadius,
    preferred_cities: app.preferredCities,
    bank_account_name: app.bankAccountName || '',
    bank_name: app.bankName || '',
    bank_account_number: app.bankAccountNumber || '',
    bank_ifsc: app.bankIfsc || '',
    bank_upi_id: app.bankUpiId || '',
    pan_number: app.panNumber,
    gst_number: app.gstNumber,
    document_aadhaar: app.documentAadhaar,
    document_pan: app.documentPan,
    document_selfie: app.documentSelfie,
    document_certifications: certsObj
  };
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
    trainer_applications: any[];
    assignment_logs: AssignmentLog[];
    slot_reservations: any[];
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
    trainer_applications: [],
    assignment_logs: [],
    slot_reservations: []
  };

  private currentUserId: string | null = null;
  private isLoaded = false;

  constructor() {
    this.load();
  }

  generateUUID(prefix = 'id'): string {
    return generateUUID(prefix);
  }

  private log(action: string, details: string) {
    console.log(`[DB LOG] [${new Date().toISOString()}] Action: ${action} | Details: ${details}`);
  }

  async reload(): Promise<void> {
    console.log('[DEBUG-DB] Database.reload() invoked. Resetting isLoaded and fetching fresh collections...');
    this.isLoaded = false;
    await this.load();
  }

  async resetAndClearLocalOnly(): Promise<void> {
    console.log('[DEBUG-DB] Database.resetAndClearLocalOnly() called. Clearing session and local memory caches...');
    this.currentUserId = null;
    this.isLoaded = false;
    
    // Clear only local cached collections
    this.schema.bookings = [];
    this.schema.notifications = [];
    this.schema.messages = [];
    this.schema.addresses = [];
    this.schema.credit_transactions = [];
    this.schema.hydration = [];
    this.schema.calories = [];
    this.schema.earnings = [];
    
    if (typeof AsyncStorage !== 'undefined') {
      try {
        await AsyncStorage.removeItem(STORAGE_KEY);
      } catch (err) {
        console.error('[DB ERROR] Failed to clear offline database AsyncStorage cache:', err);
      }
    }
  }

  async load(): Promise<void> {
    console.log('[DEBUG-DB] Database.load() called. isLoaded:', this.isLoaded);
    if (this.isLoaded) return;
    try {
      this.log('LoadDatabase', 'Loading database collections from Supabase...');
      
      const fetchPromise = Promise.all([
        supabase.from('users').select('*'),
        supabase.from('user_profiles').select('*'),
        supabase.from('trainers').select('*'),
        supabase.from('workouts').select('*'),
        supabase.from('bookings').select('*'),
        supabase.from('credit_transactions').select('*'),
        supabase.from('hydration_logs').select('*'),
        supabase.from('calorie_logs').select('*'),
        supabase.from('notifications').select('*'),
        supabase.from('chat_messages').select('*'),
        supabase.from('addresses').select('*'),
        supabase.from('trainer_earnings').select('*'),
        supabase.from('trainer_applications').select('*')
      ]);

      const timeoutPromise = new Promise<any>((_, reject) =>
        setTimeout(() => reject(new Error('Supabase load query timed out')), 2000)
      );

      const [
        resUsers,
        resProfiles,
        resTrainers,
        resWorkouts,
        resBookings,
        resTransactions,
        resHydration,
        resCalories,
        resNotifications,
        resMessages,
        resAddresses,
        resEarnings,
        resApps
      ] = await Promise.race([fetchPromise, timeoutPromise]);

      // Populate local caches using mapper functions
      this.schema.users = (resUsers.data || []).map(mapDBUser);
      this.schema.profiles = (resProfiles.data || []).map(mapUserProfile);
      this.schema.coaches = (resTrainers.data || []).map(mapCoach);
      this.schema.workouts = (resWorkouts.data || []).map(mapWorkout);
      this.schema.bookings = (resBookings.data || []).map(mapBooking);
      this.schema.credit_transactions = (resTransactions.data || []).map(mapInvoice);
      this.schema.hydration = (resHydration.data || []).map(mapHydrationLog);
      this.schema.calories = (resCalories.data || []).map(mapCalorieLog);
      this.schema.notifications = (resNotifications.data || []).map(mapNotificationItem);
      this.schema.messages = (resMessages.data || []).map(mapChatMessage);
      this.schema.addresses = (resAddresses.data || []).map(mapSavedAddress);
      this.schema.earnings = (resEarnings.data || []).map(mapTrainerEarning);
      this.schema.trainer_applications = (resApps.data || []).map(mapTrainerApplication);

      // Seed workouts and trainers in Supabase if database is empty
      await this.seedData();

      // Safely query slot_reservations (in case SQL migrations haven't run yet)
      try {
        const { data: resReservations, error: resResError } = await supabase.from('slot_reservations').select('*');
        if (resReservations && !resResError) {
          this.schema.slot_reservations = resReservations;
        }
      } catch (resErr) {
        console.log('[DEBUG-DB] slot_reservations table not yet configured:', resErr);
      }

      console.log('[DEBUG-DB] Database.load() completed successfully from Supabase.');
      this.isLoaded = true;
      this.log('LoadDatabase', 'Successfully synchronized local cache from Supabase');
      
      this.save();
    } catch (err) {
      console.log('[DEBUG-DB] Database.load() error caught. Falling back. Error:', err);
      console.error('[DB ERROR] Failed to load database from Supabase, trying AsyncStorage fallback:', err);
      // Fallback to AsyncStorage cache if offline/error
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        this.schema = {
          ...this.schema,
          ...parsed,
          trainer_applications: parsed.trainer_applications || []
        };
      }
      this.isLoaded = true;
    }
  }

  private async save(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.schema));
    } catch (err) {
      console.error('[DB ERROR] Failed to save database:', err);
    }
  }

  private async seedData() {
    let mutated = false;

    // Seed coaches if empty
    if (this.schema.coaches.length === 0) {
      const initialCoaches: Coach[] = [
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
      this.schema.coaches = initialCoaches;
      await supabase.from('trainers').insert(initialCoaches.map(mapCoachToPostgres));
      mutated = true;
    }

    // Seed trainer users in database if missing
    for (const coach of this.schema.coaches) {
      const exists = this.schema.users.find(u => u.name === coach.name);
      if (!exists) {
        const phoneMap: any = {
          'Karan Sharma': '9999988888',
          'Priya Patel': '9999977777',
          'Rohan Mehta': '9999966666',
          'Anjali Rao': '9999955555'
        };
        const phone = phoneMap[coach.name] || `99999${coach.id.replace('c-', '')}`;
        const trainerUser: DBUser = {
          id: coach.id.replace('c-', 'u-'),
          name: coach.name,
          phone,
          email: `${coach.name.toLowerCase().replace(/ /g, '.')}@virla.in`,
          passwordHash: hashPassword('123456'),
          avatar: coach.photo,
          role: 'trainer',
          status: 'active',
          createdDate: new Date().toLocaleDateString(),
          lastLogin: new Date().toISOString(),
          deviceInfo: 'Seeded Trainer Account',
          notificationPrefs: JSON.stringify({
            bookingUpdates: true,
            trainerMessages: true,
            offers: false,
            membershipAlerts: true
          })
        };
        this.schema.users.push(trainerUser);
        await supabase.from('users').insert(mapDBUserToPostgres(trainerUser));
        mutated = true;
      }
    }

    // Seed workouts if empty
    if (this.schema.workouts.length === 0) {
      const initialWorkouts: Workout[] = [
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
      this.schema.workouts = initialWorkouts;
      await supabase.from('workouts').insert(initialWorkouts.map(mapWorkoutToPostgres));
      mutated = true;
    }

    if (mutated) {
      await this.save();
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
      age: 0,
      gender: '',
      height: '',
      weight: '',
      fitnessGoal: '',
      preferredWorkout: '',
      emergencyContact: '{}',
      medicalNotes: '',
      membershipStatus: 'Standard',
      creditsBalance: 0,
      trainerPreference: '',
      dob: '',
      fitnessLevel: '',
      preferredLanguage: 'English',
      city: '',
      memberSince: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      selectedGoals: []
    };

    this.schema.users.push(newUser);
    this.schema.profiles.push(newProfile);
    this.currentUserId = userId;

    const { error } = await supabase.rpc('create_user_with_profile', {
      user_row: mapDBUserToPostgres(newUser),
      profile_row: mapUserProfileToPostgres(newProfile)
    });

    if (error) {
      throw new Error(`Database signup failed: ${error.message}`);
    }

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

    await supabase.from('users').update({ last_login: user.lastLogin }).eq('id', user.id);

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

  async oauthLogin(provider: string, providerId: string, name: string, email?: string, role: 'customer' | 'trainer' | 'admin' = 'customer'): Promise<User> {
    await this.load();
    const userEmail = email || `${providerId}@${provider}.com`;
    let user = this.schema.users.find(u => u.email === userEmail);
    if (!user) {
      const userId = generateUUID('u');
      user = {
        id: userId,
        name,
        phone: '',
        email: userEmail,
        passwordHash: hashPassword(providerId),
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
        role,
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
        age: 0,
        gender: '',
        height: '',
        weight: '',
        fitnessGoal: '',
        preferredWorkout: '',
        emergencyContact: '{}',
        medicalNotes: '',
        membershipStatus: 'Standard',
        creditsBalance: 0,
        trainerPreference: '',
        dob: '',
        fitnessLevel: '',
        preferredLanguage: 'English',
        city: '',
        memberSince: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        selectedGoals: []
      };

      this.schema.users.push(user);
      this.schema.profiles.push(newProfile);

      const { error } = await supabase.rpc('create_user_with_profile', {
        user_row: mapDBUserToPostgres(user),
        profile_row: mapUserProfileToPostgres(newProfile)
      });
      if (error) {
        throw new Error(`Database signup failed: ${error.message}`);
      }
    } else {
      user.lastLogin = new Date().toISOString();
      await supabase.from('users').update({ last_login: user.lastLogin }).eq('id', user.id);
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
    const profile = this.schema.profiles.find(p => p.userId === userId) || null;
    if (profile && typeof __DEV__ !== 'undefined' && __DEV__) {
      const user = this.schema.users.find(u => u.id === userId);
      if (user && user.role === 'admin' && profile.creditsBalance === 0) {
        profile.creditsBalance = 50;
      }
    }
    return profile;
  }

  updateUser(userId: string, fields: Partial<DBUser>): void {
    const user = this.schema.users.find(u => u.id === userId);
    if (user) {
      Object.assign(user, fields);
      
      const pgUser = mapDBUserToPostgres(user);
      const updateFields: any = {};
      for (const k of Object.keys(fields)) {
        const snakeKey = k.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        updateFields[snakeKey] = pgUser[snakeKey];
      }
      supabase.from('users').update(updateFields).eq('id', userId).then();

      this.save();
      this.log('UpdateUser', `Updated user fields for ID ${userId}`);
    }
  }

  updateProfile(userId: string, fields: Partial<UserProfile>): void {
    const profile = this.getProfile(userId);
    if (profile) {
      Object.assign(profile, fields);
      
      const pgProfile = mapUserProfileToPostgres(profile);
      const updateFields: any = {};
      for (const k of Object.keys(fields)) {
        const snakeKey = k.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        updateFields[snakeKey] = pgProfile[snakeKey];
      }
      supabase.from('user_profiles').update(updateFields).eq('user_id', userId).then();

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
    let coach = this.schema.coaches.find(c => c.id === coachId);
    if (!coach) {
      const user = this.schema.users.find(u => u.id === coachId);
      coach = {
        id: coachId,
        name: user ? user.name : 'Trainer Name',
        photo: user ? user.avatar : 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?auto=format&fit=crop&w=300&q=80',
        experience: 'Not specified',
        rating: 5.0,
        specialty: 'Not specified',
        yearsExperience: 0,
        specialization: 'Not specified',
        languages: ['English'],
        shortBio: '',
        completedSessions: 0,
        aboutText: '',
        availability: [],
        workingRadius: '0 km',
        bankDetails: '{}',
        emergencyContact: '{}',
        level: 'Associate',
        isFavourite: false
      };
      this.schema.coaches.push(coach);
    }
    
    Object.assign(coach, fields);
    
    const pgCoach = mapCoachToPostgres(coach);
    
    supabase.from('trainers').upsert(pgCoach).then();

    this.save();
    this.log('UpdateCoach', `Upserted trainer record for ID ${coachId}`);
  }

  toggleFavouriteCoach(coachId: string): void {
    const coach = this.schema.coaches.find(c => c.id === coachId);
    if (coach) {
      coach.isFavourite = !coach.isFavourite;
      supabase.from('trainers').update({ is_favourite: coach.isFavourite }).eq('id', coachId).then();
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
    return this.schema.bookings.filter(b => b.clientId === userId || b.id.includes(userId) || b.id.startsWith('b-'));
  }

  async refreshBookings(): Promise<void> {
    try {
      const { data, error } = await supabase.from('bookings').select('*');
      if (data && !error) {
        this.schema.bookings = data.map(mapBooking);
        this.save();
      }
    } catch (e) {
      console.error('refreshBookings error:', e);
    }
  }

  cleanExpiredReservations(): void {
    const now = Date.now();
    this.schema.slot_reservations = this.schema.slot_reservations.filter(r => {
      const isExpired = Number(r.expires_at) <= now;
      if (isExpired) {
        supabase.from('slot_reservations').delete().eq('id', r.id).then();
      }
      return !isExpired;
    });
  }

  async reserveSlot(clientId: string, trainerId: string, date: string, time: string): Promise<string | null> {
    this.cleanExpiredReservations();
    // Check if already reserved by another client
    const isReserved = this.schema.slot_reservations.some(r => 
      r.trainer_id === trainerId && r.slot_date === date && r.slot_time === time && r.client_id !== clientId
    );
    if (isReserved) return null;

    const id = `res-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 mins
    const reservation = {
      id,
      slot_time: time,
      slot_date: date,
      trainer_id: trainerId,
      client_id: clientId,
      expires_at: expiresAt
    };

    this.schema.slot_reservations.push(reservation);
    try {
      await supabase.from('slot_reservations').insert(reservation);
    } catch (e) {
      console.error('reserveSlot insert error:', e);
    }
    return id;
  }

  async releaseSlot(reservationId: string): Promise<void> {
    this.schema.slot_reservations = this.schema.slot_reservations.filter(r => r.id !== reservationId);
    try {
      await supabase.from('slot_reservations').delete().eq('id', reservationId);
    } catch (e) {
      console.error('releaseSlot delete error:', e);
    }
  }

  async addBookingWithValidation(userId: string, bookingData: Omit<Booking, 'id' | 'status' | 'timelineStatus'>): Promise<Booking> {
    this.cleanExpiredReservations();
    
    const assignedTrainerId = bookingData.trainerId;
    if (!assignedTrainerId) throw new Error('Trainer ID is required.');
    const date = bookingData.date;
    const time = bookingData.time;

    // 1. Verify Trainer Availability (exists and is online/supports category)
    const coach = this.schema.coaches.find(c => c.id === assignedTrainerId);
    if (!coach) throw new Error('Trainer not found.');
    if (coach.preferences?.online === false) throw new Error('Trainer is currently offline.');

    // 2. Verify slot exists in Trainer's schedule and is Available & Unbooked
    const schedule = (coach.preferences as any)?.weeklySchedule || [];
    const dateObj = new Date(date);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayOfWeek = days[dateObj.getDay()];
    const slot = schedule.find((s: any) => s.day === dayOfWeek && s.time === time);
    if (!slot || !slot.isAvailable || slot.isBooked) {
      throw new Error('That slot has just become unavailable. Please choose another time.');
    }

    // 3. Verify no conflicting bookings (Double Booking Check)
    const isDoubleBooked = this.schema.bookings.some(b => 
      b.trainerId === assignedTrainerId && b.status === 'upcoming' && b.date === date && b.time === time
    );
    if (isDoubleBooked) {
      throw new Error('That slot has just become unavailable. Please choose another time.');
    }

    // 4. Slot Buffer Check (30 minutes travel buffer)
    const targetMinutes = this.parseTimeToMinutesHelper(time);
    const hasBufferConflict = this.schema.bookings.some(b => {
      if (b.trainerId !== assignedTrainerId || b.status !== 'upcoming' || b.date !== date) return false;
      const bMinutes = this.parseTimeToMinutesHelper(b.time);
      const diff = Math.abs(bMinutes - targetMinutes);
      const duration = b.durationMinutes || 60;
      return diff < (duration + 30); // 30 minutes buffer
    });
    if (hasBufferConflict) {
      throw new Error('Trainer has a back-to-back session buffer conflict.');
    }

    // 5. Dynamic Workload limit calculation
    const activeBookingsCount = this.schema.bookings.filter(b => 
      b.trainerId === assignedTrainerId && 
      b.date === date &&
      b.status === 'upcoming' &&
      (b.timelineStatus === 'booked' || b.timelineStatus === 'trainer_assigned' || b.timelineStatus === 'trainer_accepted' || b.timelineStatus === 'trainer_preparing' || b.timelineStatus === 'trainer_travelling' || b.timelineStatus === 'trainer_arrived' || b.timelineStatus === 'otp_verified' || b.timelineStatus === 'workout_started')
    ).length;
    const maxSessions = coach.preferences?.maxDailySessions || 5;
    if (activeBookingsCount >= maxSessions) {
      throw new Error('Trainer has reached maximum daily workload limit.');
    }

    // All checks pass! Perform transaction operations atomically
    const bookingId = generateUUID('booking');
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const newBooking: Booking = {
      ...bookingData,
      id: bookingId,
      status: 'upcoming',
      timelineStatus: 'booked',
      otp,
      clientId: userId
    };

    // Decrement credits
    const profile = this.getProfile(userId);
    if (profile) {
      profile.creditsBalance = Math.max(0, profile.creditsBalance - 1);
    }

    const tx: Invoice = {
      id: generateUUID('tx'),
      type: 'paid',
      amount: '₹0',
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
      status: 'paid',
      credits: -1
    };

    // Save locally
    this.schema.bookings.unshift(newBooking);
    this.schema.credit_transactions.unshift(tx);
    this.save();

    // Log the assignment audit log
    this.logAssignmentEvent({
      bookingId,
      trainerId: assignedTrainerId,
      score: 100,
      reason: 'Dynamically booked real trainer slot',
      action: 'assigned'
    });

    // Write to Supabase (Atomically trigger)
    try {
      await Promise.all([
        supabase.from('bookings').insert(mapBookingToPostgres(newBooking)),
        profile ? supabase.from('user_profiles').update({ credits_balance: profile.creditsBalance }).eq('user_id', userId) : Promise.resolve(),
        supabase.from('credit_transactions').insert(mapInvoiceToPostgres(tx, userId))
      ]);
    } catch (dbErr) {
      // Rollback local state in case of database insert failure
      this.schema.bookings = this.schema.bookings.filter(b => b.id !== bookingId);
      this.schema.credit_transactions = this.schema.credit_transactions.filter(t => t.id !== tx.id);
      if (profile) {
        profile.creditsBalance = profile.creditsBalance + 1;
      }
      this.save();
      throw new Error('Database write operation failed. Rolled back booking transaction.');
    }

    this.log('AddBooking', `User ${userId} booked ${bookingData.workoutTitle} with OTP ${otp}`);
    return newBooking;
  }

  // Helper utility function for time parsing
  parseTimeToMinutesHelper(timeStr: string): number {
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return 0;
    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const ampm = match[3].toUpperCase();
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }

  addBooking(userId: string, bookingData: Omit<Booking, 'id' | 'status' | 'timelineStatus'>): Booking {
    const bookingId = generateUUID('booking');
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const newBooking: Booking = {
      ...bookingData,
      id: bookingId,
      status: 'upcoming',
      timelineStatus: 'booked',
      otp,
      clientId: userId
    };

    this.schema.bookings.unshift(newBooking);

    const profile = this.getProfile(userId);
    if (profile) {
      profile.creditsBalance = Math.max(0, profile.creditsBalance - 1);
    }

    const tx: Invoice = {
      id: generateUUID('tx'),
      type: 'paid',
      amount: '₹0',
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
      status: 'paid',
      credits: -1
    };

    this.schema.credit_transactions.unshift(tx);

    Promise.all([
      supabase.from('bookings').insert(mapBookingToPostgres(newBooking)),
      profile ? supabase.from('user_profiles').update({ credits_balance: profile.creditsBalance }).eq('user_id', userId) : Promise.resolve(),
      supabase.from('credit_transactions').insert(mapInvoiceToPostgres(tx, userId))
    ]).then();

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

      const tx: Invoice = {
        id: generateUUID('tx'),
        type: 'paid',
        amount: '₹0',
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
        status: 'paid',
        credits: isLate ? -1 : 1
      };
      
      this.schema.credit_transactions.unshift(tx);

      const profile = this.getProfile(userId);
      if (!isLate && profile) {
        profile.creditsBalance += 1;
      }

      Promise.all([
        supabase.from('bookings').update({ status: booking.status, timeline_status: booking.timelineStatus }).eq('id', bookingId),
        supabase.from('credit_transactions').insert(mapInvoiceToPostgres(tx, userId)),
        (profile && !isLate) ? supabase.from('user_profiles').update({ credits_balance: profile.creditsBalance }).eq('user_id', userId) : Promise.resolve()
      ]).then();

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
      
      supabase.from('bookings').update({
        date: booking.date,
        time: booking.time,
        status: booking.status,
        timeline_status: booking.timelineStatus
      }).eq('id', bookingId).then();

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
      
      supabase.from('bookings').update({
        status: booking.status,
        timeline_status: booking.timelineStatus
      }).eq('id', bookingId).then();

      this.save();
      this.log('UpdateTimelineStatus', `Updated booking ${bookingId} status to ${timelineStatus}`);
    }
  }

  updateBookingNote(bookingId: string, trainerNote: string): void {
    const booking = this.schema.bookings.find(b => b.id === bookingId);
    if (booking) {
      booking.trainerNote = trainerNote;
      supabase.from('bookings').update({
        trainer_note: trainerNote
      }).eq('id', bookingId).then();
      this.save();
      this.log('UpdateBookingNote', `Updated note for booking ${bookingId} to: ${trainerNote}`);
    }
  }

  updateBookingTrainer(bookingId: string, trainer: {
    trainerId?: string;
    trainerName?: string;
    trainerPhoto?: string;
    trainerLevel?: string;
    trainerRating?: number;
    trainerCompletedSessions?: number;
    trainerSpeciality?: string;
    trainerLanguages?: string[];
    price?: number;
    createdAt?: number;
    currentTrainerIndex?: number;
    status?: Booking['status'];
    timelineStatus?: Booking['timelineStatus'];
  }): void {
    const booking = this.schema.bookings.find(b => b.id === bookingId);
    if (booking) {
      if (trainer.trainerId !== undefined) booking.trainerId = trainer.trainerId;
      if (trainer.trainerName !== undefined) booking.trainerName = trainer.trainerName;
      if (trainer.trainerPhoto !== undefined) booking.trainerPhoto = trainer.trainerPhoto;
      if (trainer.trainerLevel !== undefined) booking.trainerLevel = trainer.trainerLevel as any;
      if (trainer.trainerRating !== undefined) booking.trainerRating = trainer.trainerRating;
      if (trainer.trainerCompletedSessions !== undefined) booking.trainerCompletedSessions = trainer.trainerCompletedSessions;
      if (trainer.trainerSpeciality !== undefined) booking.trainerSpeciality = trainer.trainerSpeciality;
      if (trainer.trainerLanguages !== undefined) booking.trainerLanguages = trainer.trainerLanguages;
      if (trainer.price !== undefined) booking.price = trainer.price;
      if (trainer.createdAt !== undefined) booking.createdAt = trainer.createdAt;
      if (trainer.currentTrainerIndex !== undefined) booking.currentTrainerIndex = trainer.currentTrainerIndex;
      if (trainer.status !== undefined) booking.status = trainer.status;
      if (trainer.timelineStatus !== undefined) booking.timelineStatus = trainer.timelineStatus;
      
      supabase.from('bookings').update({
        trainer_id: trainer.trainerId || booking.trainerId || null,
        trainer_name: trainer.trainerName || booking.trainerName,
        trainer_photo: trainer.trainerPhoto || booking.trainerPhoto,
        trainer_level: trainer.trainerLevel || booking.trainerLevel,
        trainer_rating: trainer.trainerRating !== undefined ? trainer.trainerRating : booking.trainerRating,
        trainer_completed_sessions: trainer.trainerCompletedSessions !== undefined ? trainer.trainerCompletedSessions : booking.trainerCompletedSessions,
        trainer_speciality: trainer.trainerSpeciality || booking.trainerSpeciality,
        trainer_languages: trainer.trainerLanguages || booking.trainerLanguages,
        price: trainer.price !== undefined ? trainer.price : booking.price,
        created_at: trainer.createdAt || booking.createdAt || null,
        current_trainer_index: trainer.currentTrainerIndex ?? booking.currentTrainerIndex ?? null,
        status: trainer.status || booking.status,
        timeline_status: trainer.timelineStatus || booking.timelineStatus || null
      }).eq('id', bookingId).then();

      this.save();
      this.log('ReassignTrainer', `Reassigned booking ${bookingId} to trainer ${trainer.trainerName || 'No Trainer Available'}`);
    }
  }

  updateBookingSessionDetails(bookingId: string, details: {
    status?: Booking['status'];
    timelineStatus?: Booking['timelineStatus'];
    otp?: string;
    gracePeriodStartedAt?: number;
    otpExpiresAt?: number;
    workoutStartedAt?: number;
  }): void {
    const booking = this.schema.bookings.find(b => b.id === bookingId);
    if (booking) {
      if (details.status !== undefined) booking.status = details.status;
      if (details.timelineStatus !== undefined) booking.timelineStatus = details.timelineStatus;
      if (details.otp !== undefined) booking.otp = details.otp;
      if (details.gracePeriodStartedAt !== undefined) booking.gracePeriodStartedAt = details.gracePeriodStartedAt;
      if (details.otpExpiresAt !== undefined) booking.otpExpiresAt = details.otpExpiresAt;
      if (details.workoutStartedAt !== undefined) booking.workoutStartedAt = details.workoutStartedAt;
      
      supabase.from('bookings').update({
        status: booking.status,
        timeline_status: booking.timelineStatus,
        otp: booking.otp,
        grace_period_started_at: booking.gracePeriodStartedAt,
        otp_expires_at: booking.otpExpiresAt,
        workout_started_at: booking.workoutStartedAt
      }).eq('id', bookingId).then(() => {});

      this.save();
      this.log('UpdateBookingSessionDetails', `Updated session details for booking ${bookingId} to status: ${booking.status}, timeline: ${booking.timelineStatus}`);
    }
  }

  updateBookingRating(bookingId: string, ratingDetails: Booking['ratingDetails']): void {
    const booking = this.schema.bookings.find(b => b.id === bookingId);
    if (booking) {
      booking.ratingDetails = ratingDetails;
      booking.timelineStatus = 'session_closed';
      booking.status = 'completed';

      supabase.from('bookings').update({
        status: booking.status,
        timeline_status: booking.timelineStatus,
        rating_details: ratingDetails
      }).eq('id', bookingId).then();

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
    const newLog = { id, userId, date, amount };
    this.schema.hydration.push(newLog);
    
    supabase.from('hydration_logs').insert(mapHydrationLogToPostgres(newLog)).then();

    this.save();
    this.log('LogHydration', `Logged ${amount}ml of water for user ${userId}`);
    return this.getHydration(userId, date);
  }

  // Calories Operations
  getCalories(userId: string, date: string): number {
    const logs = this.schema.calories.filter(l => l.userId === userId && l.date === date);
    const manualKcal = logs.reduce((sum, curr) => sum + curr.amount, 0);

    const sessionsKcal = this.schema.bookings
      .filter(b => b.status === 'completed' && b.clientId === userId && b.date === date)
      .reduce((sum, curr) => sum + (curr.caloriesBurned || 300), 0);

    return manualKcal + sessionsKcal;
  }

  logCalories(userId: string, date: string, amount: number): number {
    const id = generateUUID('cal');
    const newLog = { id, userId, date, amount };
    this.schema.calories.push(newLog);
    
    supabase.from('calorie_logs').insert(mapCalorieLogToPostgres(newLog)).then();

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

    const uniqueDates = Array.from(new Set(completedDates)).map(d => new Date(d));
    uniqueDates.sort((a, b) => b.getTime() - a.getTime());

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let checkDate = new Date(today);
    
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
    const workoutsCount = this.schema.bookings.filter(b => b.status === 'completed').length;
    const waterToday = this.getHydration(userId, date);

    if (workoutsCount === 0 && waterToday === 0) {
      return null;
    }

    const hydrationPercentage = Math.min(100, (waterToday / 2500) * 100);
    const streakBonus = Math.min(20, this.getStreak(userId) * 4);
    const score = Math.round(50 + (hydrationPercentage * 0.3) + streakBonus);
    return Math.min(100, score);
  }

  // Invoices & Purchases
  getLedgerTransactions(userId: string): Invoice[] {
    return this.schema.credit_transactions.filter(t => t.userId === userId);
  }

  addLedgerTransaction(userId: string, tx: Invoice): void {
    this.schema.credit_transactions.unshift(tx);
    supabase.from('credit_transactions').insert(mapInvoiceToPostgres(tx, userId)).then();
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

    Promise.all([
      supabase.from('credit_transactions').insert(mapInvoiceToPostgres(newTx, userId)),
      profile ? supabase.from('user_profiles').update({ credits_balance: profile.creditsBalance }).eq('user_id', userId) : Promise.resolve()
    ]).then();

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
    
    supabase.from('notifications').insert(mapNotificationItemToPostgres(newNotify, userId)).then();

    this.save();
    this.log('AddNotification', `Logged notification for user ${userId}: ${item.title}`);
    return newNotify;
  }

  markNotificationAsRead(userId: string, id: string): void {
    const n = this.schema.notifications.find(item => item.id === id);
    if (n) {
      n.read = true;
      supabase.from('notifications').update({ read: true }).eq('id', id).then();
      this.save();
    }
  }

  markAllNotificationsRead(userId: string): void {
    this.schema.notifications.forEach(n => {
      n.read = true;
    });
    supabase.from('notifications').update({ read: true }).eq('user_id', userId).then();
    this.save();
  }

  clearAllNotifications(userId: string): void {
    this.schema.notifications = [];
    supabase.from('notifications').delete().eq('user_id', userId).then();
    this.save();
  }

  deleteNotification(userId: string, id: string): void {
    this.schema.notifications = this.schema.notifications.filter(n => n.id !== id);
    supabase.from('notifications').delete().eq('id', id).then();
    this.save();
  }

  // Chats & Chat Messages
  getChats(userId: string): any[] {
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
      if (chatId === 'chat-c-1') {
        return [
          { id: 'm-init-1', chatId, sender: 'coach', text: "Hello! I'm preparing for our Strength session today.", timestamp: '10:05 AM' },
          { id: 'm-init-2', chatId, sender: 'coach', text: 'Do you have any specific areas of muscle soreness we should prioritize?', timestamp: '10:06 AM' }
        ];
      }
    }
    return list;
  }

  sendChatMessage(chatId: string, text: string, sender: ChatMessage['sender']): ChatMessage {
    const timeStr = new Date().toISOString();
    const msg: ChatMessage = {
      id: generateUUID('msg'),
      chatId,
      sender,
      text,
      timestamp: timeStr
    };
    this.schema.messages.push(msg);
    
    supabase.from('chat_messages').insert(mapChatMessageToPostgres(msg)).then();

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
    return list.some(m => m.sender !== 'user' && m.id.startsWith('msg-u-'));
  }

  // Address Management
  getAddresses(userId: string): SavedAddress[] {
    return this.schema.addresses.filter(a => a.userId === userId);
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
      supabase.from('addresses').update({ is_default: false }).eq('user_id', userId).then();
    }

    this.schema.addresses.push(newAddr);
    supabase.from('addresses').insert(mapSavedAddressToPostgres(newAddr)).then();

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
        if (addr.userId) {
          supabase.from('addresses').update({ is_default: false }).eq('user_id', addr.userId).neq('id', id).then();
        }
      }
      
      const pgAddr = mapSavedAddressToPostgres(addr);
      const updateFields: any = {};
      for (const k of Object.keys(fields)) {
        const snakeKey = k.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        updateFields[snakeKey] = pgAddr[snakeKey];
      }
      supabase.from('addresses').update(updateFields).eq('id', id).then();

      this.save();
    }
  }

  deleteAddress(id: string): void {
    this.schema.addresses = this.schema.addresses.filter(a => a.id !== id);
    supabase.from('addresses').delete().eq('id', id).then();
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

  // Trainer Earnings & Schedules
  getEarnings(userId: string): TrainerEarning[] {
    return this.schema.earnings;
  }

  addEarning(earning: Omit<TrainerEarning, 'id' | 'date'>): void {
    const date = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    const id = generateUUID('earn');
    const newEarn = {
      ...earning,
      id,
      date
    };
    this.schema.earnings.unshift(newEarn);
    
    if (earning.bookingId) {
      // Find trainer user matching current trainer name or ID
      const trainerId = this.currentUserId || '';
      supabase.from('trainer_earnings').insert(mapTrainerEarningToPostgres(newEarn, trainerId)).then();
    }
    this.save();
  }

  async submitTrainerApplication(appData: Omit<TrainerApplication, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<TrainerApplication> {
    const id = generateUUID('app');
    const newApp: TrainerApplication = {
      ...appData,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'pending'
    };
    this.schema.trainer_applications.unshift(newApp);
    
    const { error } = await supabase.from('trainer_applications').insert(mapTrainerApplicationToPostgres(newApp));
    if (error) {
      throw new Error(`Failed to submit application: ${error.message}`);
    }

    await this.save();
    return newApp;
  }

  async updateTrainerApplication(appId: string, appData: Partial<TrainerApplication>): Promise<TrainerApplication> {
    await this.load();
    const appIndex = this.schema.trainer_applications.findIndex(a => a.id === appId);
    if (appIndex === -1) {
      throw new Error('Application not found');
    }
    const updatedApp = {
      ...this.schema.trainer_applications[appIndex],
      ...appData,
      updatedAt: new Date().toISOString(),
      status: 'pending' as const
    };
    this.schema.trainer_applications[appIndex] = updatedApp;
    
    const { error } = await supabase
      .from('trainer_applications')
      .update(mapTrainerApplicationToPostgres(updatedApp))
      .eq('id', appId);
      
    if (error) {
      throw new Error(`Failed to update application: ${error.message}`);
    }
    
    await this.save();
    return updatedApp;
  }

  getTrainerApplication(phone: string): TrainerApplication | null {
    return this.schema.trainer_applications.find(a => a.phone === phone) || null;
  }

  async fetchAllTrainerApplications(): Promise<TrainerApplication[]> {
    const { data, error } = await supabase.from('trainer_applications').select('*');
    if (error) {
      throw new Error(`Failed to fetch applications: ${error.message}`);
    }
    this.schema.trainer_applications = (data || []).map(mapTrainerApplication);
    return this.schema.trainer_applications;
  }

  async approveTrainerApplication(appId: string): Promise<void> {
    const app = this.schema.trainer_applications.find(a => a.id === appId);
    if (app) {
      app.status = 'approved';
      app.aadhaarStatus = 'verified';
      app.panStatus = 'verified';
      app.updatedAt = new Date().toISOString();

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
          languages: app.languages.split(',').map((s: string) => s.trim()),
          shortBio: app.aboutMe,
          completedSessions: 0,
          aboutText: app.fitnessQualifications,
          availability: app.workingDays,
          workingRadius: `${app.preferredWorkingRadius} km`,
          bankDetails: JSON.stringify({
            accountName: app.bankAccountName || '',
            bankName: app.bankName || '',
            accountNumber: app.bankAccountNumber || '',
            ifsc: app.bankIfsc || '',
            upiId: app.bankUpiId || ''
          }),
          emergencyContact: app.emergencyContact
        };
        this.schema.coaches.push(newCoach);
        coachObj = newCoach;
      }

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

      const pgApp = mapTrainerApplicationToPostgres(app);
      const [resApp, resUser, resTrainer, resProfile] = await Promise.all([
        supabase.from('trainer_applications').update({ 
          status: 'approved', 
          updated_at: app.updatedAt,
          document_certifications: pgApp.document_certifications
        }).eq('id', appId),
        supabase.from('users').upsert(mapDBUserToPostgres(userObj)),
        supabase.from('trainers').upsert(mapCoachToPostgres(coachObj)),
        supabase.from('user_profiles').upsert(mapUserProfileToPostgres(profileObj))
      ]);

      if (resApp.error) throw new Error(`Failed to update application: ${resApp.error.message}`);
      if (resUser.error) throw new Error(`Failed to update user: ${resUser.error.message}`);
      if (resTrainer.error) throw new Error(`Failed to insert trainer: ${resTrainer.error.message}`);
      if (resProfile.error) throw new Error(`Failed to insert profile: ${resProfile.error.message}`);

      await this.save();
      this.log('ApproveTrainer', `Approved application for ${app.fullName} and generated trainer login.`);
    }
  }

  async rejectTrainerApplication(appId: string): Promise<void> {
    const app = this.schema.trainer_applications.find(a => a.id === appId);
    if (app) {
      if (app.status === 'approved') {
        throw new Error('Cannot reject an already approved application');
      }
      app.status = 'rejected';
      app.aadhaarStatus = 'rejected';
      app.panStatus = 'rejected';
      app.updatedAt = new Date().toISOString();
      
      const pgApp = mapTrainerApplicationToPostgres(app);
      const { error } = await supabase.from('trainer_applications').update({ 
        status: 'rejected', 
        updated_at: app.updatedAt,
        document_certifications: pgApp.document_certifications
      }).eq('id', appId);
      
      if (error) {
        throw new Error(`Failed to reject application: ${error.message}`);
      }

      await this.save();
      this.log('RejectTrainer', `Rejected application for ${app.fullName}.`);
    }
  }

  async requestMoreInfoTrainerApplication(appId: string): Promise<void> {
    const app = this.schema.trainer_applications.find(a => a.id === appId);
    if (app) {
      if (app.status === 'approved') {
        throw new Error('Cannot request additional information for an approved application');
      }
      app.status = 'info_requested';
      app.updatedAt = new Date().toISOString();
      
      const pgApp = mapTrainerApplicationToPostgres(app);
      const { error } = await supabase.from('trainer_applications').update({ 
        status: 'info_requested', 
        updated_at: app.updatedAt,
        document_certifications: pgApp.document_certifications
      }).eq('id', appId);
      
      if (error) {
        throw new Error(`Failed to request info: ${error.message}`);
      }

      await this.save();
      this.log('RequestMoreInfoTrainer', `Requested additional info for application of ${app.fullName}.`);
    }
  }

  logAssignmentEvent(event: Omit<AssignmentLog, 'id' | 'timestamp'>): void {
    const log: AssignmentLog = {
      ...event,
      id: generateUUID('log'),
      timestamp: Date.now()
    };
    if (!this.schema.assignment_logs) {
      this.schema.assignment_logs = [];
    }
    this.schema.assignment_logs.push(log);
    
    // Asynchronously update supabase schema log if possible
    supabase.from('assignment_logs').insert([log]).then(() => {});
    
    this.save();
    console.log(`[ASSIGNMENT ENGINE EVENT] Booking ID: ${log.bookingId} | Trainer ID: ${log.trainerId} | Action: ${log.action.toUpperCase()} | Score: ${log.score.toFixed(1)} | Reason: ${log.reason}`);
  }

  updateTrainerOnlineStatus(coachId: string, isOnline: boolean): void {
    const coach = this.schema.coaches.find(c => c.id === coachId);
    if (coach) {
      coach.isOnline = isOnline;
      if (!coach.preferences) {
        coach.preferences = { online: isOnline, radiusKm: 15, maxDailySessions: 5, categories: [] };
      } else {
        coach.preferences.online = isOnline;
      }
      this.updateCoach(coachId, { preferences: coach.preferences });
    }
  }

  updateTrainerPreferences(coachId: string, preferences: any): void {
    const coach = this.schema.coaches.find(c => c.id === coachId);
    if (coach) {
      coach.preferences = {
        ...(coach.preferences || { online: false, radiusKm: 15, maxDailySessions: 5, categories: [] }),
        ...preferences
      };
      this.updateCoach(coachId, { preferences: coach.preferences });
    }
  }
}

export const Database = new DatabaseClient();
