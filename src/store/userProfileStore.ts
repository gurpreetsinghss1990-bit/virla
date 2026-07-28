

import { create } from 'zustand';
import { Database } from '../database/Database';

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
  syncFromDB: () => void;
}

export const useUserProfileStore = create<UserProfileState>((set, get) => ({
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
  name: 'Viral Sharma',
  mobile: '+91 99999 88888',
  email: '',
  gender: 'Male',
  dob: 'Oct 14, 1995',
  height: '178 cm',
  weight: '75 kg',
  fitnessLevel: 'Intermediate',
  targetGoal: 'Fat Loss & Strength',
  preferredLanguage: 'English',
  city: 'Mumbai',
  memberSince: 'Jul 2025',

  // Stats (will be fetched/calculated dynamically)
  totalSessions: 0,
  totalCalories: 0,
  lifetimeSpend: '₹0',
  cancelledSessions: 0,
  hoursTrained: 0,
  averageRatingGiven: 5.0,
  favoriteTrainer: 'None',
  currentStreak: 0,

  selectedGoals: [],
  addresses: [],
  emergencyContacts: [],

  healthProfile: {
    medicalConditions: '',
    pastInjuries: '',
    jointPain: '',
    bloodPressure: '120/80 mmHg',
    diabetes: 'No',
    heartCondition: 'None',
    asthma: 'No',
    pregnancy: 'Not Applicable',
    surgeries: 'None',
    medication: 'None',
    foodAllergies: '',
    workoutRestrictions: '',
    doctorNotes: '',
    emergencyMedicalNotes: ''
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

  updateCoreProfile: (fields) => {
    const userId = Database.getCurrentUserId();
    if (userId) {
      Database.updateProfile(userId, fields as any);
      get().syncFromDB();
    }
  },

  updateHealthProfile: (fields) => {
    const userId = Database.getCurrentUserId();
    if (userId) {
      const profile = Database.getProfile(userId);
      if (profile) {
        const currentHealth = profile.medicalNotes ? JSON.parse(profile.medicalNotes) : {};
        const updatedHealth = { ...currentHealth, ...fields };
        Database.updateProfile(userId, { medicalNotes: JSON.stringify(updatedHealth) });
        get().syncFromDB();
      }
    }
  },
  
  toggleGoal: (goal) => {
    const userId = Database.getCurrentUserId();
    if (userId) {
      const currentGoals = get().selectedGoals;
      const updated = currentGoals.includes(goal)
        ? currentGoals.filter(g => g !== goal)
        : [...currentGoals, goal];
      Database.updateProfile(userId, { selectedGoals: updated } as any);
      get().syncFromDB();
    }
  },

  // Address CRUD
  addAddress: (addr) => {
    const userId = Database.getCurrentUserId();
    if (userId) {
      Database.addAddress(userId, {
        label: addr.label,
        name: addr.name,
        building: addr.building,
        street: addr.street,
        landmark: addr.landmark,
        city: addr.city,
        pinCode: addr.pinCode,
        gpsPlaceholder: addr.gpsPlaceholder,
        isDefault: addr.isDefault
      });
      get().syncFromDB();
    }
  },

  updateAddress: (id, fields) => {
    Database.updateAddress(id, fields as any);
    get().syncFromDB();
  },

  deleteAddress: (id) => {
    Database.deleteAddress(id);
    get().syncFromDB();
  },

  setDefaultAddress: (id) => {
    Database.updateAddress(id, { isDefault: true } as any);
    get().syncFromDB();
  },

  // Emergency Contacts CRUD
  addEmergencyContact: (contact) => {
    const userId = Database.getCurrentUserId();
    if (userId) {
      Database.updateProfile(userId, { emergencyContact: JSON.stringify(contact) });
      get().syncFromDB();
    }
  },

  updateEmergencyContact: (id, fields) => {
    const userId = Database.getCurrentUserId();
    if (userId) {
      const profile = Database.getProfile(userId);
      if (profile && profile.emergencyContact) {
        const currentContact = JSON.parse(profile.emergencyContact);
        Database.updateProfile(userId, { emergencyContact: JSON.stringify({ ...currentContact, ...fields }) });
        get().syncFromDB();
      }
    }
  },

  deleteEmergencyContact: (id) => {
    const userId = Database.getCurrentUserId();
    if (userId) {
      Database.updateProfile(userId, { emergencyContact: '' });
      get().syncFromDB();
    }
  },

  setPrimaryEmergencyContact: (id) => {
    // Single emergency contact maps to primary directly
  },

  // Toggles
  updateNotificationPrefs: (fields) => {
    const userId = Database.getCurrentUserId();
    if (userId) {
      const user = Database.schema.users.find(u => u.id === userId);
      if (user) {
        const currentPrefs = user.notificationPrefs ? JSON.parse(user.notificationPrefs) : {};
        user.notificationPrefs = JSON.stringify({ ...currentPrefs, ...fields });
        Database.updateProfile(userId, { notifications: { ...get().notifications, ...fields } } as any);
        get().syncFromDB();
      }
    }
  },

  updatePrivacySettings: (fields) => {
    set((state) => ({ privacy: { ...state.privacy, ...fields } }));
  },

  updateGeneralSettings: (fields) => {
    set((state) => ({ settings: { ...state.settings, ...fields } }));
  },

  syncFromDB: () => {
    const userId = Database.getCurrentUserId();
    if (userId) {
      const profile = Database.getProfile(userId);
      const userDb = Database.schema.users.find(u => u.id === userId);
      if (profile && userDb) {
        const addressesList = Database.getAddresses(userId).map(addr => ({
          id: addr.id,
          label: addr.label,
          name: addr.name,
          building: addr.building,
          street: addr.street,
          landmark: addr.landmark,
          city: addr.city,
          pinCode: addr.pinCode,
          gpsPlaceholder: addr.gpsPlaceholder,
          isDefault: addr.isDefault
        }));

        const emergencyList: EmergencyContact[] = [];
        if (profile.emergencyContact) {
          const contact = JSON.parse(profile.emergencyContact);
          emergencyList.push({
            id: 'em-1',
            name: contact.name,
            relationship: contact.relationship,
            phone: contact.phone,
            isPrimary: true
          });
        }

        const healthObj = profile.medicalNotes ? JSON.parse(profile.medicalNotes) : {};
        const fullHealth: HealthProfile = {
          medicalConditions: healthObj.medicalConditions || '',
          pastInjuries: healthObj.pastInjuries || '',
          jointPain: healthObj.jointPain || '',
          bloodPressure: healthObj.bloodPressure || '120/80 mmHg',
          diabetes: healthObj.diabetes || 'No',
          heartCondition: healthObj.heartCondition || 'None',
          asthma: healthObj.asthma || 'No',
          pregnancy: healthObj.pregnancy || 'Not Applicable',
          surgeries: healthObj.surgeries || 'None',
          medication: healthObj.medication || 'None',
          foodAllergies: healthObj.foodAllergies || '',
          workoutRestrictions: healthObj.workoutRestrictions || '',
          doctorNotes: healthObj.doctorNotes || '',
          emergencyMedicalNotes: healthObj.emergencyMedicalNotes || ''
        };

        const notificationPrefs = userDb.notificationPrefs ? JSON.parse(userDb.notificationPrefs) : {};

        // Calculate dynamic stats
        const bookingsList = Database.getBookings(userId);
        const completedSessions = bookingsList.filter(b => b.status === 'completed');
        const cancelledCount = bookingsList.filter(b => b.status === 'cancelled').length;
        const totalCals = Database.getCalories(userId, new Date().toLocaleDateString('en-CA')); // YYYY-MM-DD
        const currentStreakVal = Database.getStreak(userId);
        
        let favoriteTrainerName = 'None';
        if (completedSessions.length > 0) {
          const trainersMap: Record<string, number> = {};
          completedSessions.forEach(s => {
            trainersMap[s.trainerName] = (trainersMap[s.trainerName] || 0) + 1;
          });
          favoriteTrainerName = Object.keys(trainersMap).reduce((a, b) => trainersMap[a] > trainersMap[b] ? a : b);
        }

        set({
          name: userDb.name,
          email: userDb.email,
          mobile: userDb.phone,
          avatar: userDb.avatar,
          gender: profile.gender,
          dob: profile.dob,
          height: profile.height,
          weight: profile.weight,
          fitnessLevel: profile.fitnessLevel,
          targetGoal: profile.fitnessGoal,
          preferredLanguage: profile.preferredLanguage,
          city: profile.city,
          memberSince: profile.memberSince,
          addresses: addressesList,
          emergencyContacts: emergencyList,
          healthProfile: fullHealth,
          notifications: {
            bookingUpdates: notificationPrefs.bookingUpdates ?? true,
            trainerMessages: notificationPrefs.trainerMessages ?? true,
            offers: notificationPrefs.offers ?? false,
            membershipAlerts: notificationPrefs.membershipAlerts ?? true,
            workoutReminders: notificationPrefs.workoutReminders ?? true,
            progressReports: notificationPrefs.progressReports ?? true,
            promotions: notificationPrefs.promotions ?? false,
            emailNotifications: notificationPrefs.emailNotifications ?? true,
            smsNotifications: notificationPrefs.smsNotifications ?? true,
            pushNotifications: notificationPrefs.pushNotifications ?? true
          },
          // Stats
          totalSessions: completedSessions.length,
          totalCalories: totalCals,
          lifetimeSpend: `₹${completedSessions.length * 1200}`,
          cancelledSessions: cancelledCount,
          hoursTrained: Math.round((completedSessions.length * 45) / 60),
          currentStreak: currentStreakVal,
          favoriteTrainer: favoriteTrainerName,
          selectedGoals: (profile as any).selectedGoals || ['Strength', 'Fitness']
        });
      }
    }
  }
}));
