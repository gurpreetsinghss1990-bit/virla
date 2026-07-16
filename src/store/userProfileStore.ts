import { create } from 'zustand';

export interface SavedAddress {
  id: string;
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

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  altPhone?: string;
  medicalNotes?: string;
  isPrimary: boolean;
}

export interface HealthProfile {
  medicalConditions: string;
  pastInjuries: string;
  jointPain: string;
  bloodPressure: string;
  diabetes: string;
  heartCondition: string;
  asthma: string;
  pregnancy: string;
  surgeries: string;
  medication: string;
  foodAllergies: string;
  workoutRestrictions: string;
  doctorNotes: string;
  emergencyMedicalNotes: string;
}

export interface NotificationPrefs {
  bookingUpdates: boolean;
  trainerMessages: boolean;
  offers: boolean;
  membershipAlerts: boolean;
  workoutReminders: boolean;
  progressReports: boolean;
  promotions: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
  pushNotifications: boolean;
}

export interface PrivacySecuritySettings {
  biometricLogin: boolean;
  faceId: boolean;
  pinLock: boolean;
  locationPermission: boolean;
  cameraPermission: boolean;
  microphonePermission: boolean;
}

export interface GeneralSettings {
  theme: 'Light' | 'Dark';
  language: string;
  units: 'Metric' | 'Imperial';
  distanceUnit: 'km' | 'miles';
  timeFormat: '12h' | '24h';
}

interface UserProfileState {
  // Core profile details
  avatar: string;
  name: string;
  mobile: string;
  email: string;
  gender: string;
  dob: string;
  height: string;
  weight: string;
  fitnessLevel: string;
  targetGoal: string;
  preferredLanguage: string;
  city: string;
  memberSince: string;
  
  // Analytics stats
  totalSessions: number;
  totalCalories: number;
  lifetimeSpend: string;
  cancelledSessions: number;
  hoursTrained: number;
  averageRatingGiven: number;
  favoriteTrainer: string;
  currentStreak: number;

  // Personalization lists
  selectedGoals: string[];
  addresses: SavedAddress[];
  emergencyContacts: EmergencyContact[];
  healthProfile: HealthProfile;
  notifications: NotificationPrefs;
  privacy: PrivacySecuritySettings;
  settings: GeneralSettings;
  
  // Actions
  updateCoreProfile: (fields: Partial<Omit<UserProfileState, 'addresses' | 'emergencyContacts' | 'healthProfile' | 'notifications' | 'privacy' | 'settings'>>) => void;
  updateHealthProfile: (fields: Partial<HealthProfile>) => void;
  toggleGoal: (goal: string) => void;
  
  // Address CRUD
  addAddress: (address: Omit<SavedAddress, 'id'>) => void;
  updateAddress: (id: string, address: Partial<SavedAddress>) => void;
  deleteAddress: (id: string) => void;
  setDefaultAddress: (id: string) => void;

  // Emergency Contacts CRUD
  addEmergencyContact: (contact: Omit<EmergencyContact, 'id'>) => void;
  updateEmergencyContact: (id: string, contact: Partial<EmergencyContact>) => void;
  deleteEmergencyContact: (id: string) => void;
  setPrimaryEmergencyContact: (id: string) => void;

  // Preferences toggles
  updateNotificationPrefs: (fields: Partial<NotificationPrefs>) => void;
  updatePrivacySettings: (fields: Partial<PrivacySecuritySettings>) => void;
  updateGeneralSettings: (fields: Partial<GeneralSettings>) => void;
}

export const useUserProfileStore = create<UserProfileState>((set) => ({
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
  name: 'Viral Sharma',
  mobile: '+91 99999 88888',
  email: 'viral@example.com',
  gender: 'Male',
  dob: 'Oct 14, 1995',
  height: '178 cm',
  weight: '76 kg',
  fitnessLevel: 'Intermediate',
  targetGoal: 'Fat Loss & Strength',
  preferredLanguage: 'English',
  city: 'Mumbai',
  memberSince: 'Jul 2025',

  // Stats
  totalSessions: 24,
  totalCalories: 18200,
  lifetimeSpend: '₹24,500',
  cancelledSessions: 2,
  hoursTrained: 32,
  averageRatingGiven: 4.9,
  favoriteTrainer: 'Karan Sharma',
  currentStreak: 5,

  selectedGoals: ['Fat Loss', 'Strength', 'Mobility'],

  addresses: [
    {
      id: 'addr-1',
      label: 'Home',
      name: 'Viral Residence',
      building: 'Sea Face Towers, Flat 12A',
      street: 'Worli Sea Face Road',
      landmark: 'Near Worli Fort',
      city: 'Mumbai',
      pinCode: '400030',
      gpsPlaceholder: '19.0176, 72.8164',
      isDefault: true
    },
    {
      id: 'addr-2',
      label: 'Office',
      name: 'Virla Tech HQ',
      building: 'Maker Chambers V, 4th Floor',
      street: 'Nariman Point',
      landmark: 'Opposite Trident Hotel',
      city: 'Mumbai',
      pinCode: '400021',
      gpsPlaceholder: '18.9272, 72.8205',
      isDefault: false
    }
  ],

  emergencyContacts: [
    {
      id: 'em-1',
      name: 'Neha Sharma',
      relationship: 'Sister',
      phone: '+91 98200 11223',
      altPhone: '+91 98200 44556',
      medicalNotes: 'No allergies. Blood Group O+',
      isPrimary: true
    }
  ],

  healthProfile: {
    medicalConditions: 'None chronic. Mild seasonal pollen allergy.',
    pastInjuries: 'L4-L5 lumbar strain in 2024 (fully rehabilitated).',
    jointPain: 'Occasional tightness in right knee after long runs.',
    bloodPressure: '120/80 mmHg (Normal)',
    diabetes: 'No',
    heartCondition: 'None',
    asthma: 'No',
    pregnancy: 'Not Applicable',
    surgeries: 'None',
    medication: 'None regular.',
    foodAllergies: 'Peanuts (Mild hives)',
    workoutRestrictions: 'Avoid heavy load deadlifts without coaching supervision.',
    doctorNotes: 'Keep cardiovascular training in Zone 2 to 3.',
    emergencyMedicalNotes: 'Allergic to Peanuts. Emergency contact has blood type log.'
  },

  notifications: {
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
  },

  privacy: {
    biometricLogin: true,
    faceId: true,
    pinLock: false,
    locationPermission: true,
    cameraPermission: true,
    microphonePermission: false
  },

  settings: {
    theme: 'Light',
    language: 'English',
    units: 'Metric',
    distanceUnit: 'km',
    timeFormat: '12h'
  },

  updateCoreProfile: (fields) => set((state) => ({ ...state, ...fields })),
  updateHealthProfile: (fields) => set((state) => ({ healthProfile: { ...state.healthProfile, ...fields } })),
  
  toggleGoal: (goal) => set((state) => {
    const active = state.selectedGoals.includes(goal);
    const updated = active
      ? state.selectedGoals.filter(g => g !== goal)
      : [...state.selectedGoals, goal];
    return { selectedGoals: updated };
  }),

  // Address CRUD
  addAddress: (addr) => set((state) => {
    const id = `addr-${Date.now()}`;
    const newAddr: SavedAddress = { ...addr, id };
    const updated = addr.isDefault
      ? state.addresses.map(a => ({ ...a, isDefault: false })).concat(newAddr)
      : state.addresses.concat(newAddr);
    return { addresses: updated };
  }),
  updateAddress: (id, fields) => set((state) => ({
    addresses: state.addresses.map(a => a.id === id ? { ...a, ...fields } : a)
  })),
  deleteAddress: (id) => set((state) => ({
    addresses: state.addresses.filter(a => a.id !== id)
  })),
  setDefaultAddress: (id) => set((state) => ({
    addresses: state.addresses.map(a => ({ ...a, isDefault: a.id === id }))
  })),

  // Emergency CRUD
  addEmergencyContact: (contact) => set((state) => {
    const id = `em-${Date.now()}`;
    const newContact: EmergencyContact = { ...contact, id };
    const updated = contact.isPrimary
      ? state.emergencyContacts.map(c => ({ ...c, isPrimary: false })).concat(newContact)
      : state.emergencyContacts.concat(newContact);
    return { emergencyContacts: updated };
  }),
  updateEmergencyContact: (id, fields) => set((state) => ({
    emergencyContacts: state.emergencyContacts.map(c => c.id === id ? { ...c, ...fields } : c)
  })),
  deleteEmergencyContact: (id) => set((state) => ({
    emergencyContacts: state.emergencyContacts.filter(c => c.id !== id)
  })),
  setPrimaryEmergencyContact: (id) => set((state) => ({
    emergencyContacts: state.emergencyContacts.map(c => ({ ...c, isPrimary: c.id === id }))
  })),

  // Toggles
  updateNotificationPrefs: (fields) => set((state) => ({ notifications: { ...state.notifications, ...fields } })),
  updatePrivacySettings: (fields) => set((state) => ({ privacy: { ...state.privacy, ...fields } })),
  updateGeneralSettings: (fields) => set((state) => ({ settings: { ...state.settings, ...fields } }))
}));
