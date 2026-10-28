/* eslint-disable react-hooks/set-state-in-effect */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, Image, Animated, Modal, KeyboardAvoidingView, Platform, ActivityIndicator, Share, StyleSheet, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useBookingStore } from '../store/bookingStore';
import { useMembershipStore } from '../store/membershipStore';
import { calculateDistanceKm, geocodeAddressSync, fetchGooglePlacesAutocomplete, fetchGooglePlaceDetails, reverseGeocodeCoords, AutocompleteSuggestion, getCurrentLocationCoords, searchNearbyPlaces } from '../utils/distance';
import { normalizeDate, canonicalizeTimeRange, formatToDDMMYYYY } from '../utils/date';
import * as Location from 'expo-location';
import { useAddressStore } from '../store/addressStore';
import { useCoachStore, generateMonthlySlots } from '../store/coachStore';
import { useNotificationStore } from '../store/notificationStore';
import { useUserStore } from '../store/userStore';
import { EmptyState, ApplePayConfirmation, BookingSuccessAnimation } from '../components';
import { Ionicons, Feather } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';
import Svg, { Circle, Line, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { AssignmentEngine } from '../services/AssignmentEngine';
import { Database, getCurrentServerTime, getISTDateInfo } from '../database/Database';
import { WORKOUT_CATEGORY_MAPPING, getCategoryFromTitle } from '../config/WorkoutMapping';
import { MASTER_TRAINER_AVATAR_IMAGE } from '../constants/masterTrainerAvatar';

// Error boundary to prevent MapView crash if native Google Maps API Key is uninitialized on older client builds
class SafeMapWrapper extends React.Component<{ children: React.ReactNode; fallback?: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: any) {
    console.warn('[SafeMapWrapper] Caught MapView render crash gracefully:', error);
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <View style={{ flex: 1, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <Feather name="map-pin" size={32} color="#E11D48" />
          <Text style={{ marginTop: 10, color: '#475569', fontSize: 13, fontWeight: '700', textAlign: 'center' }}>
            Map View Unavailable
          </Text>
          <Text style={{ marginTop: 4, color: '#64748B', fontSize: 11, textAlign: 'center' }}>
            Please use search or GPS button to set your address.
          </Text>
        </View>
      );
    }
    return <View style={{ flex: 1 }}>{this.props.children}</View>;
  }
}

// 5 Premium experiences specified
interface Experience {
  id: string;
  title: string;
  description: string;
  icon: string;
  gradientColors: string[];
  emoji: string;
  duration: number;
}

const EXPERIENCES: Experience[] = [
  {
    id: 'exp-pilates',
    title: 'Pilates',
    description: 'Core strength, posture and sculpting',
    icon: 'activity',
    gradientColors: ['#F43F5E', '#E11D48'],
    emoji: '🤸‍♀️',
    duration: 60,
  },
  {
    id: 'exp-strength',
    title: 'Strength Training',
    description: 'Build strength and muscle',
    icon: 'dumbbell',
    gradientColors: ['#FF5A5F', '#FF385C'],
    emoji: '🏋️‍♂️',
    duration: 60,
  },
  {
    id: 'exp-flow',
    title: 'Yoga & Mobility',
    description: 'Improve flexibility and balance',
    icon: 'compass',
    gradientColors: ['#10B981', '#047857'],
    emoji: '🧘‍♀️',
    duration: 60,
  },
  {
    id: 'exp-rhythm',
    title: 'Dance Fitness',
    description: 'Cardio through dance',
    icon: 'music',
    gradientColors: ['#EC4899', '#BE185D'],
    emoji: '💃',
    duration: 60,
  },
  {
    id: 'exp-reset',
    title: 'Stretch & Recovery',
    description: 'Relax and restore your body',
    icon: 'coffee',
    gradientColors: ['#64748B', '#475569'],
    emoji: '🧘‍♂️',
    duration: 60,
  },
  {
    id: 'exp-combat',
    title: 'Boxing Fitness',
    description: 'Boxing drills and conditioning',
    icon: 'activity',
    gradientColors: ['#F59E0B', '#D97706'],
    emoji: '🥊',
    duration: 60,
  },
  {
    id: 'exp-aerial',
    title: 'Aerial Yoga',
    description: 'Yoga using aerial hammocks',
    icon: 'wind',
    gradientColors: ['#8B5CF6', '#6D28D9'],
    emoji: '🧘‍♀️',
    duration: 60,
  },
];

const TRAINER_PREFERENCES = [
  { id: 'any', label: 'No Preference', icon: 'shuffle', desc: 'Any expert match' },
  { id: 'female', label: 'Female Trainer', icon: 'smile', desc: 'Match female coach' },
  { id: 'male', label: 'Male Trainer', icon: 'user', desc: 'Match male coach' },
  { id: 'favourite', label: 'Favourite Trainer', icon: 'heart', desc: 'Choose saved favorites' }
];

function getCustomerDisplayTime(timeRangeStr: string): string {
  const normalized = timeRangeStr.replace(/–/g, '-').replace(/\s+/g, ' ').trim();
  const parts = normalized.split('-');
  if (parts.length === 2) {
    return `${parts[0].trim()} — ${parts[1].trim()}`;
  }
  return normalized;
}

function splitAddress(fullAddress: string) {
  if (!fullAddress) return { main: 'Selected Location', secondary: '' };
  const commaIndex = fullAddress.indexOf(',');
  if (commaIndex === -1) return { main: fullAddress, secondary: '' };
  const main = fullAddress.substring(0, commaIndex).trim();
  const secondary = fullAddress.substring(commaIndex + 1).trim();
  return { main, secondary };
}

function resolveBuildingName(
  results: any[] | undefined,
  defaultAddress: string
): { buildingName: string; formattedAddress: string } {
  if (!results || results.length === 0) {
    const parts = splitAddress(defaultAddress);
    return { buildingName: parts.main || 'Selected Location', formattedAddress: defaultAddress };
  }

  // Priority building/premise types we want to match
  const buildingTypes = [
    'premise',
    'subpremise',
    'shopping_mall',
    'residential_complex',
    'apartment',
    'society',
    'condominium',
    'establishment',
    'point_of_interest'
  ];

  // Excluded business types we want to avoid choosing as building names
  const excludedBusinessTypes = [
    'restaurant', 'food', 'cafe', 'bar', 'clothing_store', 'store', 'beauty_salon',
    'hair_care', 'spa', 'gym', 'health', 'atm', 'bank', 'liquor_store', 'car_repair',
    'gas_station', 'doctor', 'pharmacy'
  ];

  for (const res of results) {
    // Check if the overall result has any of our priority building/premise types
    const hasBuildingType = res.types && res.types.some((t: string) => buildingTypes.includes(t));
    if (hasBuildingType) {
      if (res.address_components && res.address_components.length > 0) {
        // The first component is usually the building/establishment name
        const firstComp = res.address_components[0];
        
        // Ensure the component is not a street number or just digits
        const isDigits = /^\d+$/.test(firstComp.long_name || '');
        const isStreetNumber = firstComp.types && firstComp.types.includes('street_number');

        if (!isDigits && !isStreetNumber) {
          // Verify it's not an excluded business type
          const isExcludedBusiness = res.types && res.types.some((t: string) => excludedBusinessTypes.includes(t));
          
          if (!isExcludedBusiness) {
            return {
              buildingName: firstComp.long_name,
              formattedAddress: res.formatted_address || defaultAddress
            };
          }
        }
      }
    }
  }

  // 2. Priority 3: route + street number
  for (const res of results) {
    if (res.types && (res.types.includes('street_address') || res.types.includes('route'))) {
      const streetNumber = res.address_components?.find((c: any) => c.types && c.types.includes('street_number'))?.long_name;
      const route = res.address_components?.find((c: any) => c.types && c.types.includes('route'))?.long_name;
      if (streetNumber && route) {
        return {
          buildingName: `${streetNumber} ${route}`,
          formattedAddress: res.formatted_address || defaultAddress
        };
      } else if (route) {
        return {
          buildingName: route,
          formattedAddress: res.formatted_address || defaultAddress
        };
      }
    }
  }

  // 3. Priority 4: neighbourhood / sublocality
  for (const type of ['neighborhood', 'sublocality_level_1', 'sublocality_level_2', 'sublocality']) {
    for (const res of results) {
      if (res.types && res.types.includes(type)) {
        const comp = res.address_components?.find((c: any) => c.types && c.types.includes(type));
        if (comp && comp.long_name) {
          return {
            buildingName: comp.long_name,
            formattedAddress: res.formatted_address || defaultAddress
          };
        }
      }
    }
  }

  // 4. Default fallback
  const firstRes = results[0];
  const mainPart = splitAddress(firstRes.formatted_address || defaultAddress).main;
  return {
    buildingName: mainPart || 'Selected Location',
    formattedAddress: firstRes.formatted_address || defaultAddress
  };
}

function rankNearbyCandidates(
  places: any[],
  centerLat: number,
  centerLng: number
): any | null {
  if (!places || places.length === 0) return null;

  const excludedTypes = [
    'restaurant', 'food', 'cafe', 'bar', 'clothing_store', 'store', 
    'beauty_salon', 'hair_care', 'spa', 'gym', 'health', 'atm', 'bank', 
    'liquor_store', 'car_repair', 'gas_station', 'doctor', 'pharmacy'
  ];

  const candidates = places.map(place => {
    const lat1 = centerLat;
    const lon1 = centerLng;
    const lat2 = place.location?.latitude || 0;
    const lon2 = place.location?.longitude || 0;
    
    // Haversine formula
    const R = 6371e3; // meters
    const phi1 = lat1 * Math.PI/180;
    const phi2 = lat2 * Math.PI/180;
    const deltaPhi = (lat2-lat1) * Math.PI/180;
    const deltaLambda = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(deltaPhi/2) * Math.sin(deltaPhi/2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda/2) * Math.sin(deltaLambda/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c; // in meters

    let weight = 0;
    const types = place.types || [];
    
    const name = (place.displayName?.text || '').toLowerCase();
    const isNamedBuilding = name.includes('society') || 
                            name.includes('building') || 
                            name.includes('apartment') || 
                            name.includes('residences') ||
                            name.includes('chambers') || 
                            name.includes('complex') || 
                            name.includes('park') || 
                            name.includes('tower') || 
                            name.includes('heights') || 
                            name.includes('villa') || 
                            name.includes('residency') || 
                            name.includes('manor') || 
                            name.includes('estate') ||
                            name.includes('mall') ||
                            name.includes('plaza') ||
                            name.includes('court') ||
                            name.includes('house') ||
                            name.includes('gardens') ||
                            name.includes('arcade') ||
                            name.includes('square') ||
                            name.includes('center') ||
                            name.includes('centre');

    if (types.includes('premise') || types.includes('subpremise')) {
      weight += 100;
    } else if (types.includes('residential') || types.includes('housing')) {
      weight += 80;
    } else if (isNamedBuilding) {
      weight += 60;
    } else if (types.includes('establishment') || types.includes('point_of_interest')) {
      weight += 30;
    }

    const hasExcludedType = types.some((t: string) => excludedTypes.includes(t));
    if (hasExcludedType) {
      weight -= 80;
    }

    const finalScore = weight - distance;

    return {
      place,
      distance,
      isNamedBuilding,
      finalScore
    };
  });

  candidates.sort((a, b) => b.finalScore - a.finalScore);

  const best = candidates[0];
  if (best && best.finalScore > 10) {
    return best.place;
  }
  return null;
}

async function resolveExactLocation(
  latitude: number,
  longitude: number,
  geocodedAddress: string,
  geocodedResults: any[] | undefined
): Promise<{ buildingName: string; formattedAddress: string }> {
  const geoResolved = resolveBuildingName(geocodedResults, geocodedAddress);
  
  const isGeneric = geoResolved.buildingName === 'Selected Location' ||
                    /^\d/.test(geoResolved.buildingName) ||
                    geoResolved.buildingName.includes('°') ||
                    geoResolved.buildingName.toLowerCase() === 'andheri west' ||
                    geoResolved.buildingName.toLowerCase() === 'mumbai suburban' ||
                    geoResolved.buildingName.toLowerCase() === 'mumbai' ||
                    geoResolved.buildingName.toLowerCase() === 'maharashtra' ||
                    geoResolved.buildingName.toLowerCase() === 'juhu' ||
                    geoResolved.buildingName.toLowerCase() === 'bandra west' ||
                    geoResolved.buildingName.toLowerCase() === 'bandra' ||
                    geoResolved.buildingName.toLowerCase() === 'colaba' ||
                    geoResolved.buildingName.toLowerCase() === 'powai' ||
                    /\b(road|rd|lane|nagar|gali|marg|street|st)\b/i.test(geoResolved.buildingName);

  if (isGeneric) {
    try {
      const nearbyPlaces = await searchNearbyPlaces(latitude, longitude);
      const bestCandidate = rankNearbyCandidates(nearbyPlaces, latitude, longitude);
      if (bestCandidate) {
        return {
          buildingName: bestCandidate.displayName?.text || geoResolved.buildingName,
          formattedAddress: bestCandidate.formattedAddress || geoResolved.formattedAddress
        };
      }
    } catch (e) {
      console.warn('Failed resolving nearby places for center pin:', e);
    }
  }

  return geoResolved;
}

export default function BookingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const noteInputRef = React.useRef<TextInput>(null);
  const params = useLocalSearchParams();
  const initialWorkoutId = params.workoutId as string;
  const initialWorkoutType = params.workoutType as string;
  const initialWorkoutName = params.workoutName as string;

  const { addBooking, bookings } = useBookingStore();
  const { consumeCredit } = useMembershipStore();
  const { addresses, addAddress, selectedAddressId, setSelectedAddressId } = useAddressStore();
  const { coaches } = useCoachStore();
  const { addNotification } = useNotificationStore();
  const { user } = useUserStore();

  // Booking Wizard Steps (1 to 7)
  const initialBookingId = (params.bookingId as string) || '';
  const initialStep = params.step 
    ? Math.min(Math.max(parseInt(params.step as string, 10), 1), 7)
    : (initialBookingId ? 7 : 1);
  const [step, setStep] = useState<number>(initialStep);
  const [scrollY, setScrollY] = useState(0);

  // Animated slide-up and fade for the floating Continue button
  const continueButtonAnim = useRef(new Animated.Value(0)).current;

  const getInitialExperience = () => {
    const searchString = [initialWorkoutId, initialWorkoutType, initialWorkoutName]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (searchString) {
      if (
        searchString.includes('pilates') ||
        searchString.includes('corealign') ||
        searchString.includes('exp-pilates') ||
        searchString.includes('w-3')
      ) {
        return EXPERIENCES.find((e) => e.id === 'exp-pilates') || EXPERIENCES[0];
      } else if (
        searchString.includes('strength') ||
        searchString.includes('forge') ||
        searchString.includes('exp-strength') ||
        searchString.includes('w-1')
      ) {
        return EXPERIENCES.find((e) => e.id === 'exp-strength') || EXPERIENCES[1];
      } else if (
        searchString.includes('aerial') ||
        searchString.includes('hammock') ||
        searchString.includes('exp-aerial')
      ) {
        return EXPERIENCES.find((e) => e.id === 'exp-aerial') || EXPERIENCES[6];
      } else if (
        searchString.includes('yoga') || 
        searchString.includes('flow') || 
        searchString.includes('mind & body') || 
        searchString.includes('w-2')
      ) {
        return EXPERIENCES.find((e) => e.id === 'exp-flow') || EXPERIENCES[2];
      } else if (
        searchString.includes('dance') || 
        searchString.includes('rhythm') || 
        searchString.includes('cardio') || 
        searchString.includes('w-4')
      ) {
        return EXPERIENCES.find((e) => e.id === 'exp-rhythm') || EXPERIENCES[3];
      } else if (
        searchString.includes('stretch') || 
        searchString.includes('recovery') || 
        searchString.includes('reset') || 
        searchString.includes('mobility') || 
        searchString.includes('w-5')
      ) {
        return EXPERIENCES.find((e) => e.id === 'exp-reset') || EXPERIENCES[4];
      } else if (
        searchString.includes('boxing') || 
        searchString.includes('combat') || 
        searchString.includes('kickboxing') || 
        searchString.includes('w-8')
      ) {
        return EXPERIENCES.find((e) => e.id === 'exp-combat') || EXPERIENCES[5];
      }
    }
    return null;
  };

  const [selectedExperience, setSelectedExperience] = useState<Experience | null>(() => getInitialExperience());
  const [trainerPref, setTrainerPref] = useState<'any' | 'female' | 'male' | 'favourite'>(() => {
    const profile = Database.getProfile(useUserStore.getState().user?.id || '');
    const pref = (profile?.trainerPreference || 'no_preference').toLowerCase();
    if (pref === 'male') return 'male';
    if (pref === 'female') return 'female';
    return 'any';
  });
  const [selectedTrainerId, setSelectedTrainerId] = useState<string>('');
  
  // Location selection (legacy tabs unused state cleaned)
  const [addrDefault, setAddrDefault] = useState(false);

  // Location SPRINT 4 states
  const [gpsPermission, setGpsPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [gpsSignalFailure, setGpsSignalFailure] = useState(false);
  const [networkFailure, setNetworkFailure] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [activeCoords, setActiveCoords] = useState({ lat: 19.0176, lng: 72.8164 });
  const [googleSuggestions, setGoogleSuggestions] = useState<Array<AutocompleteSuggestion>>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [sessionToken, setSessionToken] = useState(() => Math.random().toString(36).substring(2, 15) + Date.now().toString());
  const [hasConfirmedSearchSelection, setHasConfirmedSearchSelection] = useState(false);
  const [isPinSelectionAuthoritative, setIsPinSelectionAuthoritative] = useState(true);

  // Debounced search query autocomplete for workout location selector
  useEffect(() => {
    if (searchQuery.trim().length < 3 || hasConfirmedSearchSelection) {
      setGoogleSuggestions([]);
      return;
    }
    let active = true;
    const delay = setTimeout(async () => {
      setIsSearchingLocation(true);
      try {
        const res = await fetchGooglePlacesAutocomplete(searchQuery, sessionToken);
        if (active) {
          setGoogleSuggestions(res);
          setShowSearchDropdown(true);
        }
      } catch (err) {
        console.warn('Google autocomplete failed:', err);
      } finally {
        if (active) {
          setIsSearchingLocation(false);
        }
      }
    }, 450);

    return () => {
      active = false;
      clearTimeout(delay);
    };
  }, [searchQuery, sessionToken, hasConfirmedSearchSelection]);
  const [etaText, setEtaText] = useState('~12 mins travel');
  const [distanceText, setDistanceText] = useState('3.2 km');
  const [isLocationOutsideCoverage, setIsLocationOutsideCoverage] = useState(false);
  const [successBookingId, setSuccessBookingId] = useState(initialBookingId);

  // Fallback to latest booking if step 7 (success) is mounted/refreshed without a specific bookingId
  useEffect(() => {
    if (step === 7 && !successBookingId) {
      const userBookings = bookings.filter(b => !user?.id || b.clientId === user?.id);
      const latest = userBookings[userBookings.length - 1] || bookings[bookings.length - 1];
      if (latest) {
        setSuccessBookingId(latest.id);
      }
    }
  }, [step, successBookingId, bookings, user?.id]);

  // Redesigned Step 3 location modal/flow states
  const [isAddAddressModalVisible, setIsAddAddressModalVisible] = useState(false);
  const [addAddressStep, setAddAddressStep] = useState<1 | 2>(1); // Stage 1 (Map/Search), Stage 2 (Details)
  const [placeId, setPlaceId] = useState('');
  const [resolvedPlaceName, setResolvedPlaceName] = useState('Selected Location');
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [isMapConfirmed, setIsMapConfirmed] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const mapRef = useRef<MapView>(null);
  const reverseGeocodeTimerRef = useRef<any>(null);
  const geocodeRequestCounterRef = useRef(0);
  const isMountedRef = useRef(true);
  const autoTransitionTimerRef = useRef<any>(null);

  // New address form fields
  const [newHouseNo, setNewHouseNo] = useState('');
  const [newBuildingName, setNewBuildingName] = useState('');
  const [newFloor, setNewFloor] = useState('');
  const [newTower, setNewTower] = useState('');
  const [newLandmark, setNewLandmark] = useState('');
  const [newArrivalInstructions, setNewArrivalInstructions] = useState('');
  const [newAddressLabelType, setNewAddressLabelType] = useState<'Home' | 'Office' | 'Gym' | 'Custom'>('Home');
  const [newCustomLabel, setNewCustomLabel] = useState('');
  const [addressFormAttempted, setAddressFormAttempted] = useState(false);
  const [addressFieldTouched, setAddressFieldTouched] = useState<{ [key: string]: boolean }>({});

  const validateHouseNo = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) return 'Flat / House number is mandatory';
    if (!/[a-zA-Z0-9]/.test(trimmed)) return 'Must contain valid letters or digits (e.g. 401, A-12)';
    if (trimmed.length > 30) return 'Must be 30 characters or less';
    return null;
  };

  const validateBuildingName = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) return 'Building / Society name is mandatory';
    if (trimmed.length < 3) return 'Must be at least 3 characters';
    if (!/[a-zA-Z0-9]/.test(trimmed)) return 'Must contain a valid building or society name';
    if (trimmed.length > 80) return 'Must be 80 characters or less';
    return null;
  };

  const validateCustomLabel = (val: string, labelType: string) => {
    if (labelType !== 'Custom') return null;
    const trimmed = val.trim();
    if (!trimmed) return 'Custom label is mandatory';
    if (trimmed.length < 2) return 'Must be at least 2 characters (e.g. Studio, Villa)';
    if (!/[a-zA-Z0-9]/.test(trimmed)) return 'Must contain letters or numbers';
    if (trimmed.length > 20) return 'Must be 20 characters or less';
    return null;
  };

  const openAddressModal = async () => {
    // Prominently request permission FIRST before opening the map page
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Required 📍',
          'Virla requires location access to pinpoint your doorstep workout address and check service availability. Please allow location access to proceed.',
          [{ text: 'OK' }]
        );
        return;
      }
    } catch (err) {
      console.warn('[Booking] Location permission check error:', err);
      return;
    }

    geocodeRequestCounterRef.current++;
    if (reverseGeocodeTimerRef.current) {
      clearTimeout(reverseGeocodeTimerRef.current);
    }
    setIsReverseGeocoding(false);

    setAddressFormAttempted(false);
    setAddressFieldTouched({});
    setNewHouseNo('');
    setNewBuildingName('');
    setNewFloor('');
    setNewLandmark('');
    setNewTower('');
    setNewAddressLabelType('Home');
    setNewCustomLabel('');
    setSearchQuery('');
    setPlaceId('');
    setResolvedPlaceName('Selected Location');
    setHasConfirmedSearchSelection(false);
    setIsPinSelectionAuthoritative(true);
    
    // Automatically fetch current GPS location so user starts at their current spot
    let lat = activeCoords.lat !== 0 ? activeCoords.lat : 19.0176;
    let lng = activeCoords.lng !== 0 ? activeCoords.lng : 72.8164;

    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });
      lat = loc.coords.latitude;
      lng = loc.coords.longitude;
      setGpsAccuracy(loc.coords.accuracy || null);
      reverseGeocodeCoords(lat, lng).then((res) => {
        setSearchQuery(res.address);
        setPlaceId(res.placeId || '');
        setResolvedPlaceName(res.name || 'Current Location');
      }).catch(() => {});
    } catch (locErr) {
      console.warn('[Booking] Initial GPS position fetch error:', locErr);
    }

    setActiveCoords({ lat, lng });

    setTimeout(() => {
      mapRef.current?.animateToRegion({
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 300);
    }, 300);

    setAddAddressStep(1);
    setIsAddAddressModalVisible(true);
  };

  const handleSearchTextChange = (text: string) => {
    setSearchQuery(text);
    setHasConfirmedSearchSelection(false);
    setIsPinSelectionAuthoritative(false);
    setPlaceId('');
    if (text.trim().length < 3) {
      setGoogleSuggestions([]);
      setShowSearchDropdown(false);
    } else {
      setShowSearchDropdown(true);
    }
  };

  const formatISTDate = (date: Date): string => {
    const info = getISTDateInfo(date);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[info.month - 1]} ${info.day}, ${info.year}`;
  };

  // Date selection
  const [dateSelectionType, setDateSelectionType] = useState<'today' | 'tomorrow' | 'dayafter' | 'calendar'>('today');
  const [selectedDate, setSelectedDate] = useState(() => {
    const istNow = getCurrentServerTime();
    const info = getISTDateInfo(istNow);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[info.month - 1]} ${info.day}, ${info.year}`;
  });
  const [showCalendarPicker, setShowCalendarPicker] = useState(false);

  const getDefaultTimePeriod = () => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  };
  const [timePeriod, setTimePeriod] = useState<'morning' | 'afternoon' | 'evening' | 'night'>(() => getDefaultTimePeriod());
  const [selectedTime, setSelectedTime] = useState('');

  // Matchmaker and reveal state
  const [matchStage, setMatchStage] = useState(0);
  const [matchDone, setMatchDone] = useState(false);
  const [matchedCoach, setMatchedCoach] = useState<any>(null);
  const [trainerNote, setTrainerNote] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);

  // Step 5: Health & Safety Questionnaire States
  const [workoutFrequency, setWorkoutFrequency] = useState<string>('3–4 days a week');
  const [injuriesOrPain, setInjuriesOrPain] = useState<string[]>(['No injuries or pain']);
  const [healthConditions, setHealthConditions] = useState<string[]>(['None']);
  const [doctorAdvice, setDoctorAdvice] = useState<string>('No');
  const [safetyNotes, setSafetyNotes] = useState<string>('');
  const [otherInjuryText, setOtherInjuryText] = useState<string>('');
  const [otherHealthText, setOtherHealthText] = useState<string>('');
  const [healthValidationErrors, setHealthValidationErrors] = useState<Record<string, string>>({});
  const [hasAttemptedSafetySubmit, setHasAttemptedSafetySubmit] = useState<boolean>(false);
  const [showHealthDetailsModal, setShowHealthDetailsModal] = useState<boolean>(false);

  // Reservation states (Phase 3.1)
  const [reservationId, setReservationId] = useState<string>('');
  const [reservationTimeLeft, setReservationTimeLeft] = useState<number>(0);

  // Layout Animation
  const [slideAnim] = useState(() => new Animated.Value(0));
  const [radarAnim] = useState(() => new Animated.Value(0));

  // Synchronize database content on mount in case of direct deep link / refresh
  useEffect(() => {
    const initData = async () => {
      try {
        console.log('[BOOKING] Waiting for userStore hydration on mount...');
        // Wait for Zustand store to rehydrate from persistent storage
        while (!useUserStore.persist.hasHydrated()) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }

        const user = useUserStore.getState().user;
        const isLoggedIn = useUserStore.getState().isLoggedIn;
        console.log('[BOOKING] userStore hydrated. isLoggedIn:', isLoggedIn, 'userId:', user?.id);

        if (isLoggedIn && user && user.id) {
          Database.setCurrentUserId(user.id);
        } else {
          console.warn('[BOOKING] User is not logged in or userId is missing on mount');
        }

        if (!Database.getIsLoaded()) {
          await Database.load();
        }

        if (isMountedRef.current) {
          useCoachStore.getState().syncFromDB();
          useAddressStore.getState().syncFromDB();
          console.log('[BOOKING] Database reloaded and stores synchronized.');
        }
      } catch (err) {
        console.warn('Direct store sync failed on mount:', err);
      }
    };
    initData();

    return () => {
      isMountedRef.current = false;
      if (autoTransitionTimerRef.current) {
        clearTimeout(autoTransitionTimerRef.current);
      }
      if (reverseGeocodeTimerRef.current) {
        clearTimeout(reverseGeocodeTimerRef.current);
      }
    };
  }, []);

  const parseTimeToMinutesHelper = (timeStr: string): number => {
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return 0;
    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const ampm = match[3].toUpperCase();
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  };

  const getDevelopmentDiagnostics = () => {
    const targetCategory = selectedExperience ? (WORKOUT_CATEGORY_MAPPING[selectedExperience.id] || '') : '';
    const customerAddress = addresses.find(a => a.id === selectedAddressId);
    
    const candidates = coaches.length;
    let favFilter = 0;
    let onlineFilter = 0;
    let partnerFilter = 0;
    let workoutFilter = 0;
    let locationFilter = 0;
    let radiusFilter = 0;
    let workloadFilter = 0;

    if (!customerAddress || customerAddress.lat === undefined || customerAddress.lng === undefined || customerAddress.lat === null || customerAddress.lng === null) {
      return {
        candidates,
        favFilter,
        onlineFilter,
        partnerFilter,
        workoutFilter,
        locationFilter,
        radiusFilter,
        workloadFilter,
        customerLocationError: true
      };
    }

    const customerLat = customerAddress.lat;
    const customerLng = customerAddress.lng;

    for (const coach of coaches) {
      const isFavOk = (trainerPref !== 'favourite' || !selectedTrainerId || coach.id === selectedTrainerId);
      if (isFavOk) favFilter++;

      const isOnline = coach.preferences?.online !== false;
      if (isFavOk && isOnline) onlineFilter++;

      const isPartnerApproved = coach.verifiedBadge !== false;
      if (isFavOk && isOnline && isPartnerApproved) partnerFilter++;
      const assignments = Database.getWorkoutAssignments(coach.id);
      const isApproved = assignments.some(a => a.workoutCategory === targetCategory && a.status === 'APPROVED');
      const acceptsAll = assignments.some(a => a.workoutCategory === 'All Workouts' && a.status === 'APPROVED');
      const workoutApproved = acceptsAll || isApproved;
      if (isFavOk && isOnline && isPartnerApproved && workoutApproved) workoutFilter++;

      const locationStatus = coach.preferences?.operatingLocationStatus;
      const isLocationApproved = locationStatus === 'verified';
      if (isFavOk && isOnline && isPartnerApproved && workoutApproved && isLocationApproved) locationFilter++;

      const trainerLat = coach.preferences?.operatingLatitude;
      const trainerLng = coach.preferences?.operatingLongitude;
      const radiusLimit = Math.min(coach.preferences?.radiusKm || 5, 5);
      let distance = 999999;
      let insideRadius = false;
      if (trainerLat !== undefined && trainerLat !== null && trainerLng !== undefined && trainerLng !== null) {
        distance = calculateDistanceKm(trainerLat, trainerLng, customerLat, customerLng);
        insideRadius = distance <= radiusLimit;
      }
      if (isFavOk && isOnline && isPartnerApproved && workoutApproved && isLocationApproved && insideRadius) radiusFilter++;

      const activeCount = bookings.filter(b => 
        b.trainerId === coach.id && 
        normalizeDate(b.date) === normalizeDate(selectedDate) &&
        b.status === 'upcoming' &&
        (b.timelineStatus === 'booked' || b.timelineStatus === 'trainer_assigned' || b.timelineStatus === 'trainer_accepted' || b.timelineStatus === 'trainer_preparing' || b.timelineStatus === 'trainer_travelling' || b.timelineStatus === 'trainer_arrived' || b.timelineStatus === 'otp_verified' || b.timelineStatus === 'workout_started')
      ).length;
      const maxSessions = coach.preferences?.maxDailySessions || 5;
      const workloadOk = activeCount < maxSessions;
      if (isFavOk && isOnline && isPartnerApproved && workoutApproved && isLocationApproved && insideRadius && workloadOk) workloadFilter++;
    }

    return {
      candidates,
      favFilter,
      onlineFilter,
      partnerFilter,
      workoutFilter,
      locationFilter,
      radiusFilter,
      workloadFilter,
      customerLocationError: false
    };
  };

  const checkDateHasAvailableSlots = (dateStr: string): boolean => {
    if (!selectedExperience) return false;
    const targetCategory = WORKOUT_CATEGORY_MAPPING[selectedExperience.id] || '';
    if (!targetCategory) return false;

    const customerAddress = addresses.find(a => a.id === selectedAddressId);
    if (!customerAddress || customerAddress.lat === undefined || customerAddress.lng === undefined || customerAddress.lat === null || customerAddress.lng === null) {
      return false;
    }

    const customerLat = customerAddress.lat;
    const customerLng = customerAddress.lng;
    const normalizedDateStr = normalizeDate(dateStr);
    const dateParts = normalizedDateStr.split('-');
    const targetYear = parseInt(dateParts[0], 10);
    const targetMonth = parseInt(dateParts[1], 10) - 1;

    const monthlyDaySlots = generateMonthlySlots(targetMonth, targetYear);
    const defaultDaySlots = monthlyDaySlots.find(d => normalizeDate(d.date) === normalizedDateStr)?.slots || [];

    const now = getCurrentServerTime();
    const nowUtc = now.getTime();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(nowUtc + istOffset);
    const istYear = istTime.getUTCFullYear();
    const istMonth = istTime.getUTCMonth() + 1;
    const istDay = istTime.getUTCDate();
    const istHours = istTime.getUTCHours();
    const istMinutes = istTime.getUTCMinutes();
    const istSeconds = istTime.getUTCSeconds();
    const nowIst = new Date(Date.UTC(istYear, istMonth - 1, istDay, istHours, istMinutes, istSeconds));

    for (const coach of coaches) {
      if (trainerPref === 'favourite' && selectedTrainerId && coach.id !== selectedTrainerId) {
        continue;
      }
      const isOnline = coach.preferences?.online !== false;
      const isPartnerApproved = coach.verifiedBadge !== false;
      if (!isOnline || !isPartnerApproved) continue;

      const assignments = Database.getWorkoutAssignments(coach.id);
      const isApproved = assignments.some(a => a.workoutCategory === targetCategory && a.status === 'APPROVED');
      const acceptsAll = assignments.some(a => a.workoutCategory === 'All Workouts' && a.status === 'APPROVED');
      if (!acceptsAll && !isApproved) continue;

      const locationStatus = coach.preferences?.operatingLocationStatus;
      const locationApproved = locationStatus === 'verified' || locationStatus === 'pending' || !locationStatus;
      if (!locationApproved) continue;

      const trainerGender = (coach.gender || '').toLowerCase();
      const genderValid = !trainerGender || trainerGender === 'male' || trainerGender === 'female';
      if (!genderValid) continue;

      let genderApproved = false;
      if (trainerPref === 'any') {
        genderApproved = true;
      } else if (trainerPref === 'male') {
        genderApproved = trainerGender === 'male';
      } else if (trainerPref === 'female') {
        genderApproved = trainerGender === 'female';
      } else if (trainerPref === 'favourite') {
        const clientPref = (Database.getProfile(user.id || '')?.trainerPreference || 'no_preference').toLowerCase();
        genderApproved = clientPref === 'male' ? trainerGender === 'male' : clientPref === 'female' ? trainerGender === 'female' : true;
      }
      if (!genderApproved) continue;

      const trainerLat = coach.preferences?.operatingLatitude;
      const trainerLng = coach.preferences?.operatingLongitude;
      const radiusLimit = Math.min(coach.preferences?.radiusKm || 5, 5);
      if (trainerLat !== undefined && trainerLat !== null && trainerLng !== undefined && trainerLng !== null) {
        const distance = calculateDistanceKm(trainerLat, trainerLng, customerLat, customerLng);
        if (distance > radiusLimit) continue;
      } else {
        continue;
      }

      const activeCount = bookings.filter(b => 
        b.trainerId === coach.id && 
        normalizeDate(b.date) === normalizedDateStr &&
        b.status === 'upcoming'
      ).length;
      const maxSessions = coach.preferences?.maxDailySessions || 5;
      if (activeCount >= maxSessions) continue;

      const overrides = coach.preferences?.availabilityOverrides || [];
      const dailySlots = defaultDaySlots.map(slot => {
        const override = overrides.find(o => 
          normalizeDate(o.date) === normalizedDateStr && 
          canonicalizeTimeRange(o.time) === canonicalizeTimeRange(slot.time)
        );
        const isAvailable = override ? override.isAvailable : true;
        const slotCategory = override?.category || '';
        return {
          ...slot,
          isAvailable,
          category: slotCategory
        };
      }).filter((s: any) => {
        if (!s.isAvailable) return false;
        const categoryMatch = !s.category || s.category === 'All Workouts' || s.category === 'ANY WORKOUT' || s.category === targetCategory;
        if (!categoryMatch) return false;

        const startPart = s.time.split('-')[0].trim();
        const match = startPart.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (match) {
          let hour = parseInt(match[1], 10);
          const minute = parseInt(match[2], 10);
          const ampm = match[3].toUpperCase();
          if (ampm === 'PM' && hour < 12) hour += 12;
          if (ampm === 'AM' && hour === 12) hour = 0;

          const slotStartIst = new Date(Date.UTC(targetYear, targetMonth, parseInt(dateParts[2], 10), hour, minute, 0));
          if (nowIst.getTime() > slotStartIst.getTime() - 15 * 60 * 1000) return false;
        }
        return true;
      });

      for (const slot of dailySlots) {
        const hasBooking = bookings.some(b => 
          b.trainerId === coach.id && 
          b.status === 'upcoming' && 
          normalizeDate(b.date) === normalizedDateStr && 
          canonicalizeTimeRange(b.time) === canonicalizeTimeRange(slot.time)
        );
        if (!hasBooking) return true; // Found at least 1 available slot on this date!
      }
    }
    return false;
  };

  const getDynamicAvailableSlots = (): any[] => {
    if (!selectedExperience) return [];
    const targetCategory = WORKOUT_CATEGORY_MAPPING[selectedExperience.id] || '';
    if (!targetCategory) return [];

    const customerAddress = addresses.find(a => a.id === selectedAddressId);
    if (!customerAddress || customerAddress.lat === undefined || customerAddress.lng === undefined || customerAddress.lat === null || customerAddress.lng === null) {
      console.log('CUSTOMER_LOCATION_ERROR: Customer booking address has no coordinates');
      return [];
    }

    const customerLat = customerAddress.lat;
    const customerLng = customerAddress.lng;

    const normalizedDateStr = normalizeDate(selectedDate);
    const dateParts = normalizedDateStr.split('-');
    const targetYear = parseInt(dateParts[0], 10);
    const targetMonth = parseInt(dateParts[1], 10) - 1; // 0-indexed month
    const targetDay = parseInt(dateParts[2], 10);
    const targetDateObj = new Date(targetYear, targetMonth, targetDay);

    const monthlyDaySlots = generateMonthlySlots(targetMonth, targetYear);
    const defaultDaySlots = monthlyDaySlots.find(d => normalizeDate(d.date) === normalizedDateStr)?.slots || [];

    const trainerPool = coaches.map(coach => {
      // 1. Account approved
      const isOnline = coach.preferences?.online !== false;
      const isPartnerApproved = coach.verifiedBadge !== false;
      const accountApproved = isOnline && isPartnerApproved;

      // 2. Workout approved
      const assignments = Database.getWorkoutAssignments(coach.id);
      const isApproved = assignments.some(a => a.workoutCategory === targetCategory && a.status === 'APPROVED');
      const acceptsAll = assignments.some(a => a.workoutCategory === 'All Workouts' && a.status === 'APPROVED');
      const workoutApproved = acceptsAll || isApproved;

      // 3. Location approved
      const locationStatus = coach.preferences?.operatingLocationStatus;
      const locationApproved = locationStatus === 'verified' || locationStatus === 'pending' || !locationStatus;

      // 3b. Gender approved (using canonical lowercase comparison)
      const trainerGender = (coach.gender || '').toLowerCase();
      const genderValid = !trainerGender || trainerGender === 'male' || trainerGender === 'female';
      
      let genderApproved = false;
      if (genderValid) {
        if (trainerPref === 'any') {
          genderApproved = true;
        } else if (trainerPref === 'male') {
          genderApproved = trainerGender === 'male';
        } else if (trainerPref === 'female') {
          genderApproved = trainerGender === 'female';
        } else if (trainerPref === 'favourite') {
          const clientPref = (Database.getProfile(user.id || '')?.trainerPreference || 'no_preference').toLowerCase();
          if (clientPref === 'male') {
            genderApproved = trainerGender === 'male';
          } else if (clientPref === 'female') {
            genderApproved = trainerGender === 'female';
          } else {
            genderApproved = true;
          }
        }
      }

      // 4. Radius eligible
      const trainerLat = coach.preferences?.operatingLatitude;
      const trainerLng = coach.preferences?.operatingLongitude;
      const radiusLimit = Math.min(coach.preferences?.radiusKm || 5, 5);
      let distance = 999999;
      let radiusEligible = false;
      if (trainerLat !== undefined && trainerLat !== null && trainerLng !== undefined && trainerLng !== null) {
        distance = calculateDistanceKm(trainerLat, trainerLng, customerLat, customerLng);
        radiusEligible = distance <= radiusLimit;
      }

      // 5. Workload OK
      const activeCount = bookings.filter(b => 
        b.trainerId === coach.id && 
        normalizeDate(b.date) === normalizedDateStr &&
        b.status === 'upcoming' &&
        (b.timelineStatus === 'booked' || b.timelineStatus === 'trainer_assigned' || b.timelineStatus === 'trainer_accepted' || b.timelineStatus === 'trainer_preparing' || b.timelineStatus === 'trainer_travelling' || b.timelineStatus === 'trainer_arrived' || b.timelineStatus === 'otp_verified' || b.timelineStatus === 'workout_started')
      ).length;
      const maxSessions = coach.preferences?.maxDailySessions || 5;
      const workloadOk = activeCount < maxSessions;

      // 6. Slots availability mapping
      const overrides = coach.preferences?.availabilityOverrides || [];
      
      // Get current time in IST (UTC+5:30)
      const now = getCurrentServerTime();
      const nowUtc = now.getTime();
      const istOffset = 5.5 * 60 * 60 * 1000;
      const istTime = new Date(nowUtc + istOffset);
      const istYear = istTime.getUTCFullYear();
      const istMonth = istTime.getUTCMonth() + 1;
      const istDay = istTime.getUTCDate();
      const istHours = istTime.getUTCHours();
      const istMinutes = istTime.getUTCMinutes();
      const istSeconds = istTime.getUTCSeconds();
      const nowIst = new Date(Date.UTC(istYear, istMonth - 1, istDay, istHours, istMinutes, istSeconds));

      const dailySlots = defaultDaySlots.map(slot => {
        const override = overrides.find(o => 
          normalizeDate(o.date) === normalizedDateStr && 
          canonicalizeTimeRange(o.time) === canonicalizeTimeRange(slot.time)
        );
        const isAvailable = override ? override.isAvailable : true;
        const slotCategory = override?.category || '';
        return {
          ...slot,
          isAvailable,
          category: slotCategory
        };
      }).filter((s: any) => {
        if (!s.isAvailable) return false;

        const categoryMatch = !s.category || s.category === 'All Workouts' || s.category === 'ANY WORKOUT' || s.category === targetCategory;
        if (!categoryMatch) return false;

        // Apply universal 15-minute slot visibility rule
        const startPart = s.time.split('-')[0].trim(); // e.g. "07:00 PM"
        const match = startPart.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (match) {
          let hour = parseInt(match[1], 10);
          const minute = parseInt(match[2], 10);
          const ampm = match[3].toUpperCase();
          if (ampm === 'PM' && hour < 12) hour += 12;
          if (ampm === 'AM' && hour === 12) hour = 0;

          const dateParts = normalizedDateStr.split('-');
          const slotYear = parseInt(dateParts[0], 10);
          const slotMonth = parseInt(dateParts[1], 10);
          const slotDay = parseInt(dateParts[2], 10);

          const slotStartIst = new Date(Date.UTC(slotYear, slotMonth - 1, slotDay, hour, minute, 0));
          const visibilityStartMs = slotStartIst.getTime() - 15 * 60 * 1000;

          if (nowIst.getTime() > visibilityStartMs) {
            return false; // Hide slot if after T-15 minutes
          }
        }
        return true;
      });

      let hasAvailableSlot = false;
      for (const slot of dailySlots) {
        const hasBooking = bookings.some(b => 
          b.trainerId === coach.id && 
          b.status === 'upcoming' && 
          normalizeDate(b.date) === normalizedDateStr && 
          canonicalizeTimeRange(b.time) === canonicalizeTimeRange(slot.time)
        );
        const targetMinutes = parseTimeToMinutesHelper(slot.time);
        const hasBufferConflict = bookings.some(b => {
          if (b.trainerId !== coach.id || b.status !== 'upcoming' || normalizeDate(b.date) !== normalizedDateStr) return false;
          const bMinutes = parseTimeToMinutesHelper(b.time);
          const diff = Math.abs(bMinutes - targetMinutes);
          const duration = b.durationMinutes || 60;
          return diff < (duration + 30);
        });
        const slotReservations = Database.schema.slot_reservations || [];
        const isReserved = slotReservations.some(r => 
          r.trainer_id === coach.id && 
          normalizeDate(r.slot_date) === normalizedDateStr && 
          canonicalizeTimeRange(r.slot_time) === canonicalizeTimeRange(slot.time) && 
          r.client_id !== user.id
        );
        if (!hasBooking && !hasBufferConflict && !isReserved) {
          hasAvailableSlot = true;
        }
      }
      const slotEligible = hasAvailableSlot;

      // 7. Favoring/Explicit selection checks
      const isFavOk = (trainerPref !== 'favourite' || !selectedTrainerId || coach.id === selectedTrainerId);

      // Final Eligibility
      const coachEligible = isFavOk && accountApproved && workoutApproved && locationApproved && radiusEligible && workloadOk && genderApproved && genderValid;
      const finalEligible = coachEligible && slotEligible;

      // 8. Exclusion reasons list
      const exclusionReasons: string[] = [];
      if (!genderValid) exclusionReasons.push('INVALID_GENDER');
      if (genderValid && !genderApproved) exclusionReasons.push('GENDER_MISMATCH');
      if (trainerPref === 'favourite' && selectedTrainerId && coach.id !== selectedTrainerId) exclusionReasons.push('NOT_SELECTED_FAVOURITE_TRAINER');
      if (!isOnline) exclusionReasons.push('TRAINER_OFFLINE');
      if (!isPartnerApproved) exclusionReasons.push('TRAINER_NOT_VERIFIED');
      if (!workoutApproved) exclusionReasons.push('WORKOUT_NOT_APPROVED');
      if (!locationApproved) exclusionReasons.push('TRAINER_LOCATION_NOT_VERIFIED');
      if (trainerLat === undefined || trainerLat === null || trainerLng === undefined || trainerLng === null) {
        exclusionReasons.push('TRAINER_LOCATION_MISSING');
      } else if (!radiusEligible) {
        exclusionReasons.push('OUTSIDE_SERVICE_RADIUS');
      }
      if (!workloadOk) exclusionReasons.push('DAILY_LIMIT');
      if (coachEligible && !slotEligible) exclusionReasons.push('NO_AVAILABLE_SLOTS');

      return {
        id: coach.id,
        name: coach.name,
        isRealBackendTrainer: !coach.id.startsWith('c-'),
        accountApproved,
        workoutApproved,
        locationApproved,
        radiusEligible,
        slotEligible,
        finalEligible,
        exclusionReasons
      };
    });

    const finalEligibleTrainers = trainerPool.filter(t => t.finalEligible);

    console.log('TRAINER_MATCH_DEBUG', JSON.stringify({
      databaseSource: Database.loadSource === 'supabase' ? 'REMOTE_SUPABASE' : 'LOCAL_FALLBACK',
      databaseTrainerCount: coaches.length,
      trainerPool,
      finalEligibleTrainerCount: finalEligibleTrainers.length,
      finalEligibleTrainerIds: finalEligibleTrainers.map(t => t.id),
      finalEligibleTrainerNames: finalEligibleTrainers.map(t => t.name)
    }, null, 2));

    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('\n================ TRAINER MATCHING DIAGNOSTICS ================');
      trainerPool.forEach(tp => {
        const coachObj = coaches.find(c => c.id === tp.id);
        if (!coachObj) return;

        const trainerGender = (coachObj.gender || '').toLowerCase();
        const genderValid = trainerGender === 'male' || trainerGender === 'female';
        
        let genderApproved = false;
        if (genderValid) {
          if (trainerPref === 'any') {
            genderApproved = true;
          } else if (trainerPref === 'male') {
            genderApproved = trainerGender === 'male';
          } else if (trainerPref === 'female') {
            genderApproved = trainerGender === 'female';
          } else if (trainerPref === 'favourite') {
            const clientPref = (Database.getProfile(user.id || '')?.trainerPreference || 'no_preference').toLowerCase();
            if (clientPref === 'male') {
              genderApproved = trainerGender === 'male';
            } else if (clientPref === 'female') {
              genderApproved = trainerGender === 'female';
            } else {
              genderApproved = true;
            }
          }
        }

        const isOnline = coachObj.preferences?.online !== false;
        const isPartnerApproved = coachObj.verifiedBadge !== false;
        
        const assignments = Database.getWorkoutAssignments(coachObj.id);
        const isApproved = assignments.some(a => a.workoutCategory === targetCategory && a.status === 'APPROVED');
        const acceptsAll = assignments.some(a => a.workoutCategory === 'All Workouts' && a.status === 'APPROVED');
        const workoutApproved = acceptsAll || isApproved;

        const locationStatus = coachObj.preferences?.operatingLocationStatus;
        const locationApproved = locationStatus === 'verified';

        const trainerLat = coachObj.preferences?.operatingLatitude;
        const trainerLng = coachObj.preferences?.operatingLongitude;
        const radiusLimit = Math.min(coachObj.preferences?.radiusKm || 5, 5);
        let distance = 999999;
        let radiusEligible = false;
        if (trainerLat !== undefined && trainerLat !== null && trainerLng !== undefined && trainerLng !== null) {
          distance = calculateDistanceKm(trainerLat, trainerLng, customerLat, customerLng);
          radiusEligible = distance <= radiusLimit;
        }

        const activeCount = bookings.filter(b => 
          b.trainerId === coachObj.id && 
          normalizeDate(b.date) === normalizedDateStr &&
          b.status === 'upcoming'
        ).length;
        const maxSessions = coachObj.preferences?.maxDailySessions || 5;
        const workloadOk = activeCount < maxSessions;

        // Evaluate failed steps
        let firstFailedStep = '';
        if (!isOnline) firstFailedStep = 'Step 2: Trainer is offline';
        else if (!isPartnerApproved) firstFailedStep = 'Step 3: Trainer is not verified';
        else if (!genderValid) firstFailedStep = 'Step 4: Invalid/missing trainer gender in database';
        else if (!genderApproved) firstFailedStep = `Step 5: Trainer gender (${trainerGender}) does not match client preference (${trainerPref})`;
        else if (!workoutApproved) firstFailedStep = `Step 6: Trainer is not approved for category "${targetCategory}"`;
        else if (!locationApproved) firstFailedStep = `Step 12: Trainer operating location verification status is "${locationStatus}"`;
        else if (trainerLat === undefined || trainerLng === undefined) firstFailedStep = 'Step 12: Trainer has no operating coordinates configured';
        else if (!radiusEligible) firstFailedStep = `Step 11: Trainer is outside service radius (Distance: ${distance === 999999 ? 'N/A' : distance.toFixed(1) + ' km'}, Limit: ${radiusLimit} km)`;
        else if (!workloadOk) firstFailedStep = `Step 10: Maximum daily session limit reached (${activeCount}/${maxSessions})`;
        else if (!tp.slotEligible) firstFailedStep = 'Step 8: No time slots available on this date';

        console.log(`TRAINER MATCHING DIAGNOSTIC\n\n` +
          `Trainer: ${coachObj.name}\n` +
          `Trainer ID: ${coachObj.id}\n\n` +
          `Gender:\n` +
          `  Database gender: ${coachObj.gender || 'null'}\n` +
          `  Mapped gender: ${trainerGender}\n` +
          `  Gender valid: ${genderValid ? 'PASS' : 'FAIL'}\n` +
          `  Gender preference match: ${genderApproved ? 'PASS' : 'FAIL'}\n\n` +
          `Status:\n` +
          `  Trainer active: ${isOnline ? 'PASS' : 'FAIL'}\n` +
          `  Trainer verified: ${isPartnerApproved ? 'PASS' : 'FAIL'}\n\n` +
          `Workout:\n` +
          `  Requested workout: ${selectedExperience?.title || 'None'} (Category: ${targetCategory})\n` +
          `  Trainer workout approved: ${workoutApproved ? 'PASS' : 'FAIL'}\n\n` +
          `Date:\n` +
          `  Requested date: ${selectedDate} (${normalizedDateStr})\n` +
          `  Trainer available that date: PASS (no overrides blocking the day)\n\n` +
          `Location:\n` +
          `  Client location coordinates: ${customerLat}, ${customerLng}\n` +
          `  Trainer operating location coordinates: ${trainerLat || 'null'}, ${trainerLng || 'null'}\n` +
          `  Service radius limit: ${radiusLimit} km\n` +
          `  Distance calculated: ${distance === 999999 ? 'N/A' : distance.toFixed(2) + ' km'}\n` +
          `  Radius eligibility: ${radiusEligible ? 'PASS' : 'FAIL'}\n\n` +
          `Final:\n` +
          `  ELIGIBLE: ${tp.finalEligible ? 'YES' : 'NO'}\n` +
          (tp.finalEligible ? '' : `  REJECTION REASON: ${firstFailedStep}\n`)
        );
      });
      console.log('==============================================================\n');
    }

    // Construct slot mapping
    const aggregatedSlotsMap: Record<string, { slot: any; trainers: typeof coaches }> = {};
    const eligibleCoachesList = coaches.filter(c => {
      const matchStatus = trainerPool.find(tp => tp.id === c.id);
      return matchStatus ? matchStatus.finalEligible : false;
    });

    for (const coach of eligibleCoachesList) {
      const overrides = coach.preferences?.availabilityOverrides || [];
      const dailySlots = defaultDaySlots.map(slot => {
        const override = overrides.find(o => 
          normalizeDate(o.date) === normalizedDateStr && 
          canonicalizeTimeRange(o.time) === canonicalizeTimeRange(slot.time)
        );
        const isAvailable = override ? override.isAvailable : true;
        const slotCategory = override?.category || '';
        return {
          ...slot,
          isAvailable,
          category: slotCategory
        };
      }).filter((s: any) => 
        s.isAvailable && 
        (!s.category || s.category === 'All Workouts' || s.category === 'ANY WORKOUT' || s.category === targetCategory)
      );

      for (const slot of dailySlots) {
        const hasBooking = bookings.some(b => 
          b.trainerId === coach.id && 
          b.status === 'upcoming' && 
          normalizeDate(b.date) === normalizedDateStr && 
          canonicalizeTimeRange(b.time) === canonicalizeTimeRange(slot.time)
        );
        const targetMinutes = parseTimeToMinutesHelper(slot.time);
        const hasBufferConflict = bookings.some(b => {
          if (b.trainerId !== coach.id || b.status !== 'upcoming' || normalizeDate(b.date) !== normalizedDateStr) return false;
          const bMinutes = parseTimeToMinutesHelper(b.time);
          const diff = Math.abs(bMinutes - targetMinutes);
          const duration = b.durationMinutes || 60;
          return diff < (duration + 30);
        });
        const slotReservations = Database.schema.slot_reservations || [];
        const isReserved = slotReservations.some(r => 
          r.trainer_id === coach.id && 
          normalizeDate(r.slot_date) === normalizedDateStr && 
          canonicalizeTimeRange(r.slot_time) === canonicalizeTimeRange(slot.time) && 
          r.client_id !== user.id
        );

        if (!hasBooking && !hasBufferConflict && !isReserved) {
          if (!aggregatedSlotsMap[slot.time]) {
            aggregatedSlotsMap[slot.time] = { slot, trainers: [] };
          }
          aggregatedSlotsMap[slot.time].trainers.push(coach);
        }
      }
    }

    return Object.keys(aggregatedSlotsMap).map(time => {
      const { slot, trainers } = aggregatedSlotsMap[time];
      return {
        time,
        tag: slot.isPrime ? 'Prime Time' : '',
        isPrime: slot.isPrime,
        trainers: trainers.map(t => t.id)
      };
    });
  };

  const handleSelectGoogleSuggestion = async (suggestion: AutocompleteSuggestion) => {
    setIsSearchingLocation(true);
    setGoogleSuggestions([]);
    setShowSearchDropdown(false);
    try {
      const details = await fetchGooglePlaceDetails(suggestion.placeId);
      
      // Increment request counter and clear timers to prevent map pan geocodes from overwriting
      geocodeRequestCounterRef.current++;
      if (reverseGeocodeTimerRef.current) {
        clearTimeout(reverseGeocodeTimerRef.current);
      }
      setIsReverseGeocoding(false);

      setActiveCoords({ lat: details.latitude, lng: details.longitude });
      setSearchQuery(details.address);
      setPlaceId(suggestion.placeId || '');
      setHasConfirmedSearchSelection(true);
      setIsPinSelectionAuthoritative(false);
      
      let finalBuildingName = details.placeName || splitAddress(details.address).main;
      const isGenericName = !finalBuildingName || 
                            finalBuildingName === 'Selected Location' ||
                            /^\d/.test(finalBuildingName) ||
                            finalBuildingName.includes('°') ||
                            ['andheri west', 'mumbai suburban', 'mumbai', 'maharashtra', 'juhu', 'bandra west', 'bandra', 'colaba', 'powai'].includes(finalBuildingName.toLowerCase()) ||
                            /\b(road|rd|lane|nagar|gali|marg|street|st)\b/i.test(finalBuildingName);
      
      if (isGenericName) {
        const resolved = await resolveExactLocation(details.latitude, details.longitude, details.address, undefined);
        finalBuildingName = resolved.buildingName;
      }
      
      setResolvedPlaceName(finalBuildingName);
      setIsMapConfirmed(false);
      setGpsAccuracy(null);
      
      const centerMumbai = { lat: 19.0176, lng: 72.8164 };
      const dist = calculateDistanceKm(details.latitude, details.longitude, centerMumbai.lat, centerMumbai.lng);
      setDistanceText(`${dist.toFixed(1)} km`);
      setEtaText(`~${Math.round(dist * 2.5 + 5)} mins`);
      setIsLocationOutsideCoverage(dist > 30);

      // Animate map to coordinates
      mapRef.current?.animateToRegion({
        latitude: details.latitude,
        longitude: details.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005
      }, 800);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load details.');
    } finally {
      setIsSearchingLocation(false);
    }
  };

  const handleUseCurrentGps = async () => {
    setIsSearchingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Location permission was denied. Please allow location access in settings or enter your address manually.');
      }
      
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });
      const { latitude, longitude, accuracy } = loc.coords;
      setGpsAccuracy(accuracy || null);

      const res = await reverseGeocodeCoords(latitude, longitude);

      // Increment request counter and clear timers to prevent map pan geocodes from overwriting
      geocodeRequestCounterRef.current++;
      if (reverseGeocodeTimerRef.current) {
        clearTimeout(reverseGeocodeTimerRef.current);
      }
      setIsReverseGeocoding(false);

      setActiveCoords({ lat: latitude, lng: longitude });
      setSearchQuery(res.address);
      setPlaceId(res.placeId || '');
      setHasConfirmedSearchSelection(false);
      setIsPinSelectionAuthoritative(true);
      
      const resolved = await resolveExactLocation(latitude, longitude, res.address, res.results);
      setResolvedPlaceName(resolved.buildingName);
      setIsMapConfirmed(false);
      
      const centerMumbai = { lat: 19.0176, lng: 72.8164 };
      const dist = calculateDistanceKm(latitude, longitude, centerMumbai.lat, centerMumbai.lng);
      setDistanceText(`${dist.toFixed(1)} km`);
      setEtaText(`~${Math.round(dist * 2.5 + 5)} mins`);
      setIsLocationOutsideCoverage(dist > 30);

      // Animate map to current location coordinates
      mapRef.current?.animateToRegion({
        latitude,
        longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005
      }, 800);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to resolve current location.');
    } finally {
      setIsSearchingLocation(false);
    }
  };

  const handleSelectSlot = useCallback((slotTime: string, eligibleTrainerIds: string[]) => {
    setSelectedTime(slotTime);
    const tempBooking = {
      id: 'temp-id',
      workoutTitle: (() => {
        switch (selectedExperience?.id) {
          case 'exp-pilates': return 'Pilates';
          case 'exp-strength': return 'Strength Training';
          case 'exp-flow': return 'Yoga & Mobility';
          case 'exp-rhythm': return 'Dance Fitness';
          case 'exp-reset': return 'Stretch & Recovery';
          case 'exp-combat': return 'Boxing Fitness';
          case 'exp-aerial': return 'Aerial Yoga';
          default: return selectedExperience?.title || 'Pilates';
        }
      })(),
      date: selectedDate,
      time: slotTime,
      address: (() => {
        const addr = addresses.find(a => a.id === selectedAddressId);
        if (!addr) return 'Selected Location';
        const jsonPayload = {
          addressLine: addr.addressLine || '',
          lat: addr.lat,
          lng: addr.lng,
          place_id: addr.placeId || '',
          buildingName: addr.building || '',
          flatNumber: addr.apartment || '',
          floor: addr.floor || '',
          landmark: addr.landmark || '',
          arrivalInstructions: addr.notes || ''
        };
        return JSON.stringify(jsonPayload);
      })(),
      timelineStatus: 'booked' as const,
      status: 'upcoming' as const,
      createdAt: Date.now()
    };
    if (trainerPref === 'favourite' && selectedTrainerId) {
      const fav = coaches.find(c => c.id === selectedTrainerId);
      if (fav && eligibleTrainerIds.includes(fav.id)) {
        setMatchedCoach(fav);
        return;
      }
    }
    const rated = AssignmentEngine.rankTrainers(tempBooking as any);
    const matched = rated.find(rt => eligibleTrainerIds.includes(rt.coach.id));
    if (matched) {
      setMatchedCoach(matched.coach);
    } else {
      const coach = coaches.find(c => eligibleTrainerIds.includes(c.id));
      if (coach) setMatchedCoach(coach);
    }
  }, [selectedExperience, selectedDate, addresses, selectedAddressId, coaches]);

  const handleReleaseReservation = async () => {
    if (reservationId) {
      await Database.releaseSlot(reservationId);
      setReservationId('');
      setReservationTimeLeft(0);
    }
  };

  useEffect(() => {
    let timer: any;
    if (reservationTimeLeft > 0) {
      timer = setInterval(() => {
        setReservationTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            handleReleaseReservation();
            Alert.alert('Reservation Expired ⚠️', 'Your temporary slot holding time has expired. Please re-select the slot.');
            setStep(4);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [reservationTimeLeft, reservationId]);

  useEffect(() => {
    return () => {
      if (reservationId) {
        Database.releaseSlot(reservationId);
      }
    };
  }, [reservationId]);

  // Initial workout matching logic for Sprint 3 compatibility
  useEffect(() => {
    const searchString = [initialWorkoutId, initialWorkoutType, initialWorkoutName]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (searchString) {
      let matchedExp = EXPERIENCES[0];
      if (
        searchString.includes('aerial') ||
        searchString.includes('hammock') ||
        searchString.includes('w-aerial')
      ) {
        matchedExp = EXPERIENCES[5];
      } else if (
        searchString.includes('yoga') || 
        searchString.includes('flow') || 
        searchString.includes('pilates') || 
        searchString.includes('mind & body') || 
        searchString.includes('w-2') || 
        searchString.includes('w-3')
      ) {
        matchedExp = EXPERIENCES[1];
      } else if (
        searchString.includes('dance') || 
        searchString.includes('rhythm') || 
        searchString.includes('cardio') || 
        searchString.includes('w-4')
      ) {
        matchedExp = EXPERIENCES[2];
      } else if (
        searchString.includes('stretch') || 
        searchString.includes('recovery') || 
        searchString.includes('reset') || 
        searchString.includes('mobility') || 
        searchString.includes('w-5')
      ) {
        matchedExp = EXPERIENCES[3];
      } else if (
        searchString.includes('boxing') || 
        searchString.includes('combat') || 
        searchString.includes('kickboxing') || 
        searchString.includes('w-8')
      ) {
        matchedExp = EXPERIENCES[4];
      }
      setSelectedExperience(matchedExp);
    }
  }, [initialWorkoutId, initialWorkoutType, initialWorkoutName]);

  useEffect(() => {

    if (step === 3 && selectedAddressId) {
      const addr = addresses.find(a => a.id === selectedAddressId);
      if (addr) {
        if (addr.lat !== undefined && addr.lng !== undefined && addr.lat !== 0 && addr.lng !== 0) {
          setActiveCoords({ lat: addr.lat, lng: addr.lng });
          const centerMumbai = { lat: 19.0176, lng: 72.8164 };
          const dist = calculateDistanceKm(addr.lat, addr.lng, centerMumbai.lat, centerMumbai.lng);
          setDistanceText(`${dist.toFixed(1)} km`);
          setEtaText(`~${Math.round(dist * 2.5 + 5)} mins`);
          setIsLocationOutsideCoverage(dist > 30);
        } else {
          const lower = addr.addressLine.toLowerCase();
          if (lower.includes('pune') || lower.includes('delhi') || lower.includes('bangalore') || lower.includes('kolkata')) {
            setIsLocationOutsideCoverage(true);
            setEtaText('N/A (Out of bounds)');
            setDistanceText('> 100 km');
          } else if (lower.includes('juhu')) {
            setIsLocationOutsideCoverage(false);
            setEtaText('~18 mins travel');
            setDistanceText('6.5 km');
            setActiveCoords({ lat: 19.1076, lng: 72.8264 });
          } else if (lower.includes('bandra')) {
            setIsLocationOutsideCoverage(false);
            setEtaText('~12 mins travel');
            setDistanceText('3.2 km');
            setActiveCoords({ lat: 19.0596, lng: 72.8295 });
          } else if (lower.includes('worli')) {
            setIsLocationOutsideCoverage(false);
            setEtaText('~15 mins travel');
            setDistanceText('4.1 km');
            setActiveCoords({ lat: 18.9986, lng: 72.8174 });
          } else {
            setIsLocationOutsideCoverage(false);
            setEtaText('~15 mins travel');
            setDistanceText('4.2 km');
            setActiveCoords({ lat: 19.0176, lng: 72.8164 });
          }
        }
      }
    }
  }, [selectedAddressId, step, addresses]);

  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const availabilityLoadedRef = useRef(false);

  const loadAvailabilityForSelectedDate = useCallback(async (dateStr: string, forceReload = false) => {
    // Only hit DB reload if not already loaded or explicitly forced
    if (availabilityLoadedRef.current && !forceReload) {
      return;
    }
    setIsLoadingAvailability(true);
    try {
      console.log(`[AVAILABILITY] Loading availability for date: ${dateStr}`);
      await Database.reload();
      useCoachStore.getState().syncFromDB();
      useBookingStore.getState().syncFromDB();
      useAddressStore.getState().syncFromDB();
      availabilityLoadedRef.current = true;
    } catch (err) {
      console.warn('Failed to reload database for availability:', err);
    } finally {
      setIsLoadingAvailability(false);
    }
  }, []);

  // Pulse animation for radar scanning map
  useEffect(() => {

    if (step === 3) {
      radarAnim.setValue(0);
      Animated.loop(
        Animated.timing(radarAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        })
      ).start();
    }
  }, [step, radarAnim]);

  // Step transitions
  const triggerTransition = (nextStep: number) => {
    if (!isMountedRef.current) return;
    if (autoTransitionTimerRef.current) {
      clearTimeout(autoTransitionTimerRef.current);
      autoTransitionTimerRef.current = null;
    }

    Animated.sequence([
      Animated.timing(slideAnim, {
        toValue: -10,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 10,
        duration: 0,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      })
    ]).start();
    
    if (nextStep === 6) {
      const activeCoach = matchedCoach || coaches[0];
      if (activeCoach) {
        Database.reserveSlot(user.id, activeCoach.id, selectedDate, selectedTime).then(resId => {
          if (!isMountedRef.current) return;
          if (resId) {
            setReservationId(resId);
            setReservationTimeLeft(300); // 5 mins countdown
            setStep(6);
          } else {
            Alert.alert('Slot Unavailable ⚠️', 'That slot has just been reserved by another user. Please choose another time.');
            setStep(4);
          }
        }).catch(() => {
          if (isMountedRef.current) {
            setStep(4);
          }
        });
        return;
      }
    }

    if (isMountedRef.current) {
      setStep(nextStep);
    }
  };

  const hasActiveSession = bookings.some(b =>
    (!user?.id || b.clientId === user?.id) &&
    b.status === 'upcoming' &&
    !!b.timelineStatus &&
    ['trainer_travelling', 'trainer_arrived', 'otp_verified', 'workout_started'].includes(b.timelineStatus)
  );

  const handleNext = () => {
    if (hasActiveSession && step <= 4) return;
    if (step === 1 && !selectedExperience) {
      Alert.alert('Selection Required', 'Please select a training experience.');
      return;
    }
    if (step === 2 && trainerPref === 'favourite' && !selectedTrainerId) {
      const favouritesExist = coaches.some(c => c.isFavourite);
      if (favouritesExist) {
        Alert.alert('Selection Required', 'Please select one of your favorite coaches.');
        return;
      }
      // If none exist, they are stuck, let them change preference
      Alert.alert('Preference Required', 'Please choose another trainer preference.');
      return;
    }
    if (step === 3) {
      if (!selectedAddressId) {
        Alert.alert('Location Required', 'Please choose a training address.');
        return;
      }
      if (isLocationOutsideCoverage) {
        Alert.alert('Outside Coverage', 'The selected address lies outside the VIRLA active fitness coverage zone.');
        return;
      }
      // Navigate to step 4 (Select Date & Time) with Today selected by default
      setDateSelectionType('today');
      setShowCalendarPicker(false);
      const istNow = getCurrentServerTime();
      const info = getISTDateInfo(istNow);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const formatted = `${months[info.month - 1]} ${info.day}, ${info.year}`;
      setSelectedDate(formatted);
      setSelectedTime('');
      triggerTransition(4);
      loadAvailabilityForSelectedDate(formatted);
      return;
    }
    if (step === 4) {
      if (!selectedDate) {
        Alert.alert('Date Required', 'Please select a date.');
        return;
      }
      if (!selectedTime) {
        Alert.alert('Time Required', 'Please select an available time slot.');
        return;
      }
      finalizeMatch();
      triggerTransition(5);
      return;
    }
    if (step === 5) {
      setHasAttemptedSafetySubmit(true);
      const errors: Record<string, string> = {};
      if (!workoutFrequency) {
        errors.workoutFrequency = 'Please select how often you work out.';
      }
      if (!injuriesOrPain || injuriesOrPain.length === 0) {
        errors.injuriesOrPain = 'Please select at least one option.';
      } else if (injuriesOrPain.includes('Other injury or pain') && !otherInjuryText.trim()) {
        errors.otherInjury = 'Please specify your injury or pain details.';
      }
      if (!healthConditions || healthConditions.length === 0) {
        errors.healthConditions = 'Please select at least one health option.';
      } else if (healthConditions.includes('Other health condition') && !otherHealthText.trim()) {
        errors.otherHealth = 'Please specify your health condition details.';
      }
      if (!doctorAdvice) {
        errors.doctorAdvice = 'Please select an option regarding doctor advice.';
      }
      if (safetyNotes && safetyNotes.length > 250) {
        errors.safetyNotes = 'Safety notes cannot exceed 250 characters.';
      }

      setHealthValidationErrors(errors);
      if (Object.keys(errors).length > 0) {
        Alert.alert('Incomplete Information ⚠️', 'Please answer all required health & safety questions marked below.');
        return;
      }

      triggerTransition(6);
      return;
    }
    triggerTransition(step + 1);
  };

  const handleBack = () => {
    if (autoTransitionTimerRef.current) {
      clearTimeout(autoTransitionTimerRef.current);
      autoTransitionTimerRef.current = null;
    }

    if (step === 6) {
      handleReleaseReservation();
    }
    if (step > 1) {
      triggerTransition(step - 1);
    } else {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)');
      }
    }
  };

  // Matchmaker simulation trigger
  const startMatchmaker = () => {
    setMatchStage(0);
    setMatchDone(false);
    
    const interval = setInterval(() => {
      setMatchStage((prev) => {
        if (prev >= 4) {
          clearInterval(interval);
          finalizeMatch();
          return 5;
        }
        return prev + 1;
      });
    }, 600);
  };

  const finalizeMatch = () => {
    // Check favourite trainer mismatch conflict if applicable
    if (trainerPref === 'favourite' && selectedTrainerId) {
      const fav = coaches.find(c => c.id === selectedTrainerId);
      if (fav) {
        const favGender = (fav.gender || '').toLowerCase();
        const clientPref = (Database.getProfile(user.id || '')?.trainerPreference || 'no_preference').toLowerCase();
        
        if ((clientPref === 'male' && favGender !== 'male') || (clientPref === 'female' && favGender !== 'female')) {
          Alert.alert(
            'Preference Mismatch ⚠️',
            'Your selected Trainer does not match your Trainer preference. Please choose another Trainer or update your preference.',
            [{ text: 'OK', onPress: () => setStep(2) }]
          );
          setMatchedCoach(undefined as any);
          setMatchDone(false);
          return;
        }
      }
    }

    // Select coach based on preference and workout specialty
    let pool = coaches;

    // Filter by gender if requested
    if (trainerPref === 'female') {
      pool = pool.filter(c => (c.gender || '').toLowerCase() === 'female');
    } else if (trainerPref === 'male') {
      pool = pool.filter(c => (c.gender || '').toLowerCase() === 'male');
    } else if (trainerPref === 'favourite') {
      const clientPref = (Database.getProfile(user.id || '')?.trainerPreference || 'no_preference').toLowerCase();
      if (clientPref === 'male') {
        pool = pool.filter(c => (c.gender || '').toLowerCase() === 'male');
      } else if (clientPref === 'female') {
        pool = pool.filter(c => (c.gender || '').toLowerCase() === 'female');
      }
    }

    // Filter by specialty if applicable
    let specFilter = 'Strength';
    if (selectedExperience?.id === 'exp-pilates') specFilter = 'Pilates';
    if (selectedExperience?.id === 'exp-flow') specFilter = 'Yoga';
    if (selectedExperience?.id === 'exp-rhythm') specFilter = 'Dance';
    if (selectedExperience?.id === 'exp-reset') specFilter = 'Mobility';
    if (selectedExperience?.id === 'exp-combat') specFilter = 'Boxing';
    if (selectedExperience?.id === 'exp-aerial') specFilter = 'Aerial Yoga';

    let specialtyPool = pool.filter(c => c.specialty.includes(specFilter) || c.workoutSpecialties?.some(s => s.includes(specFilter)));
    if (specialtyPool.length === 0) {
      if (selectedExperience?.id === 'exp-aerial') {
        Alert.alert('No Trainers Available ⚠️', 'No certified Aerial Yoga trainers are currently available in your area.');
        setStep(2);
        setMatchedCoach(undefined as any);
        setMatchDone(false);
        return;
      }
      specialtyPool = pool;
    }

    // Pick specific coach
    let finalCoach = specialtyPool[0];
    if (trainerPref === 'favourite' && selectedTrainerId) {
      const fav = coaches.find(c => c.id === selectedTrainerId);
      if (fav) finalCoach = fav;
    }

    // Fallback if somehow undefined
    if (!finalCoach) finalCoach = coaches[0];

    setMatchedCoach(finalCoach);
    setMatchDone(true);
  };

  // Legacy add address handler removed in favor of Step 3 Redesign Add Address wizard modal

  const handleConfirmBooking = () => {
    if (isConfirming) return;
    setIsConfirming(true);

    const targetAddress = (() => {
      const addr = addresses.find(a => a.id === selectedAddressId);
      if (!addr) return 'Selected Location';
      const jsonPayload = {
        addressLine: addr.addressLine || '',
        lat: addr.lat,
        lng: addr.lng,
        place_id: addr.placeId || '',
        buildingName: addr.building || '',
        flatNumber: addr.apartment || '',
        floor: addr.floor || '',
        landmark: addr.landmark || '',
        arrivalInstructions: addr.notes || ''
      };
      return JSON.stringify(jsonPayload);
    })();
    const activeCoach = matchedCoach || coaches[0];

    if (!activeCoach) {
      Alert.alert('Selection Error', 'No matching trainer selected.');
      setIsConfirming(false);
      return;
    }

    const clientProfile = Database.getProfile(user.id || '');
    const isCouple = (clientProfile?.membershipStatus || '').toLowerCase().includes('couple');

    const tempBooking = {
      trainerId: activeCoach.id,
      trainerName: activeCoach.name,
      trainerPhoto: activeCoach.photo,
      workoutTitle: (() => {
        switch (selectedExperience?.id) {
          case 'exp-pilates': return 'Pilates';
          case 'exp-strength': return 'Strength Training';
          case 'exp-flow': return 'Yoga & Mobility';
          case 'exp-rhythm': return 'Dance Fitness';
          case 'exp-reset': return 'Stretch & Recovery';
          case 'exp-combat': return 'Boxing Fitness';
          case 'exp-aerial': return 'Aerial Yoga';
          default: return selectedExperience?.title || 'Pilates';
        }
      })(),
      date: selectedDate,
      time: selectedTime,
      price: activeCoach.price || 1200,
      address: targetAddress,
      goal: selectedExperience?.title || 'Workout',
      trainerLevel: activeCoach.level || 'Certified',
      trainerRating: activeCoach.rating,
      trainerCompletedSessions: activeCoach.completedSessions || 150,
      trainerSpeciality: activeCoach.specialty,
      trainerLanguages: activeCoach.languages,
      trainerDistance: `${(1.5 + Math.random() * 2).toFixed(1)} km`,
      trainerArrivalTime: `${Math.round(10 + Math.random() * 10)} mins`,
      assignedTrainersPool: [activeCoach.id],
      currentTrainerIndex: 0,
      trainerNote: trainerNote.trim() || undefined,
      durationMinutes: selectedExperience?.duration || 60,
      createdAt: Date.now(),
      preferredCoachId: (trainerPref === 'favourite' && selectedTrainerId) ? selectedTrainerId : undefined,
      isFavouriteTrainer: (trainerPref === 'favourite' && !!selectedTrainerId && (selectedTrainerId === activeCoach.id)),
      questionnaire: {
        workoutFrequency,
        injuriesOrPain,
        healthConditions,
        doctorAdvice,
        safetyNotes: safetyNotes.trim() || undefined,
      },
      participantCount: isCouple ? 2 : 1,
      sessionType: (isCouple ? 'COUPLE' : 'SINGLE') as 'SINGLE' | 'COUPLE',
      originalPackageType: (isCouple ? 'COUPLE' : 'SINGLE') as 'SINGLE' | 'COUPLE',
    };

    setTimeout(async () => {
      try {
        // Enforce mid-flow slot availability check before confirmation
        const freshCoaches = Database.getCoaches();
        const freshCoach = freshCoaches.find(c => c.id === activeCoach.id);
        
        const overrides = freshCoach?.preferences?.availabilityOverrides || [];
        const override = overrides.find(o => 
          normalizeDate(o.date) === normalizeDate(selectedDate) && 
          canonicalizeTimeRange(o.time) === canonicalizeTimeRange(selectedTime)
        );
        const isAvailable = override ? override.isAvailable : true;
        
        const bookings = Database.schema.bookings || [];
        const isBooked = bookings.some((b: any) => 
          b.trainerId === activeCoach.id && 
          normalizeDate(b.date) === normalizeDate(selectedDate) && 
          canonicalizeTimeRange(b.time) === canonicalizeTimeRange(selectedTime) && 
          b.status === 'upcoming'
        );
        
        if (!isAvailable || isBooked) {
          throw new Error('This slot is no longer available. Please select another slot.');
        }

        // Call transactional add with validations
        const finalBooking = await Database.addBookingWithValidation(user.id, tempBooking);
        
        // Sync stores
        useBookingStore.getState().syncFromDB();

        // Release temporary reservation
        handleReleaseReservation();

        // Trigger notifications
        addNotification({
          title: 'Booking Confirmed 📅',
          body: `Your VIRLA ${selectedExperience?.title || 'Workout'} session is confirmed for ${selectedDate} @ ${selectedTime}. Waiting for Trainer Confirmation.`,
        });

        setSuccessBookingId(finalBooking.id);
        setStep(7);
        router.setParams({ step: '7', bookingId: finalBooking.id });
      } catch (err: any) {
        Alert.alert('Booking Failed ⚠️', err.message || 'Unable to complete your booking. Please try again.');
      } finally {
        setIsConfirming(false);
      }
    }, 1800);
  };

  interface SlotItem {
    time: string;
    tag: string;
    isPrime: boolean;
    isBooked?: boolean;
    trainers?: string[];
  }

  const isTimeSlotPassed = (timeSlotStr: string, dateStr: string) => {
    const istNow = getCurrentServerTime();
    const info = getISTDateInfo(istNow);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const todayStr = `${months[info.month - 1]} ${info.day}, ${info.year}`;
    if (dateStr !== todayStr) {
      return false;
    }

    const startTimePart = timeSlotStr.split(' - ')[0]; // e.g. "06:00 AM"
    const [timeVal, modifier] = startTimePart.split(' '); // ["06:00", "AM"]
    let [hours, minutes] = timeVal.split(':').map(Number);

    if (modifier === 'PM' && hours < 12) {
      hours += 12;
    }
    if (modifier === 'AM' && hours === 12) {
      hours = 0;
    }

    const slotDateTime = new Date(Date.UTC(info.year, info.month - 1, info.day, hours, minutes, 0, 0));
    const slotTimeMs = slotDateTime.getTime() - 5.5 * 60 * 60 * 1000;

    return slotTimeMs <= istNow.getTime();
  };

  const getFilteredSlotsForPeriod = (): SlotItem[] => {
    const allAvailable = getDynamicAvailableSlots();
    const todayNormalized = normalizeDate(getCurrentServerTime());
    if (normalizeDate(selectedDate) === todayNormalized) {
      return allAvailable.filter(slot => !isTimeSlotPassed(slot.time, selectedDate));
    }
    return allAvailable;
  };

  const isContinueVisible = step <= 4 && (step !== 1 || !!selectedExperience) && (step !== 4 || !!selectedTime);

  useEffect(() => {
    if (isContinueVisible) {
      Animated.spring(continueButtonAnim, {
        toValue: 1,
        friction: 8,
        tension: 50,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(continueButtonAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start();
    }
  }, [isContinueVisible, continueButtonAnim]);

  const renderBadge = (slotObj: any) => {
    if (slotObj.isBooked) {
      return (
        <View className="bg-zinc-100 border border-zinc-200 px-2.5 py-1 rounded-full flex-row items-center gap-1">
          <Text className="text-zinc-500 text-[9px] font-black uppercase tracking-wider">⛔ Fully Booked</Text>
        </View>
      );
    }
    if (slotObj.tag === 'High Demand') {
      return (
        <View className="bg-red-50 border border-red-100 px-2.5 py-1 rounded-full flex-row items-center gap-1">
          <Text className="text-red-500 text-[9px] font-black uppercase tracking-wider">🔥 High Demand</Text>
        </View>
      );
    }
    if (slotObj.tag === 'Almost Full' || slotObj.tag === 'Only 2 left' || slotObj.tag === 'Only 1 left') {
      return (
        <View className="bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full flex-row items-center gap-1">
          <Text className="text-amber-600 text-[9px] font-black uppercase tracking-wider">⚠ Only 2 Left</Text>
        </View>
      );
    }
    if (slotObj.isPrime) {
      return (
        <View className="bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-full flex-row items-center gap-1">
          <Text className="text-indigo-600 text-[9px] font-black uppercase tracking-wider">⭐ Prime Time</Text>
        </View>
      );
    }
    return null;
  };

  const getWorkoutImage = (id: string) => {
    switch (id) {
      case 'exp-pilates':
        return 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=800&q=80';
      case 'exp-strength':
        return 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80';
      case 'exp-flow':
        return 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=800&q=80';
      case 'exp-rhythm':
        return 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=800&q=80';
      case 'exp-reset':
        return 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=800&q=80';
      case 'exp-combat':
        return 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?auto=format&fit=crop&w=800&q=80';
      case 'exp-aerial':
        return 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=800&q=80';
      default:
        return 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80';
    }
  };

  const getFormattedDateLabel = () => {
    return formatToDDMMYYYY(selectedDate);
  };

  const handleChipPress = (chip: string) => {
    if (chip === 'Other') {
      noteInputRef.current?.focus();
      return;
    }
    setTrainerNote((prev) => {
      const trimmed = prev.trim();
      if (prev.includes(chip)) {
        const regex = new RegExp(`\\s*${chip},?\\s*|\\s*,?\\s*${chip}`, 'g');
        let next = prev.replace(regex, '').trim();
        next = next.replace(/,\s*,/g, ',').replace(/^,|,$/g, '').trim();
        return next;
      } else {
        if (trimmed.length === 0) {
          return chip;
        }
        const suffix = `, ${chip}`;
        if (trimmed.length + suffix.length <= 250) {
          return `${trimmed}${suffix}`;
        }
        return prev;
      }
    });
  };

  const handleShareBooking = async () => {
    try {
      const shareMessage = `I just booked a ${selectedExperience?.title || 'Forge Strength'} session with VIRLA for ${selectedDate}, ${selectedTime}! Join me on VIRLA: https://virla.app/booking/${successBookingId || ''}`;
      await Share.share({
        message: shareMessage,
      });
    } catch (error) {
      console.log('Error sharing booking:', error);
    }
  };

  const addressHouseError = validateHouseNo(newHouseNo);
  const showAddressHouseError = (addressFormAttempted || addressFieldTouched.houseNo) && !!addressHouseError;

  const addressBuildingError = validateBuildingName(newBuildingName);
  const showAddressBuildingError = (addressFormAttempted || addressFieldTouched.buildingName) && !!addressBuildingError;

  const addressCustomLabelError = validateCustomLabel(newCustomLabel, newAddressLabelType);
  const showAddressCustomLabelError = (addressFormAttempted || addressFieldTouched.customLabel) && !!addressCustomLabelError;

  const isAddressFormValid = !addressHouseError && !addressBuildingError && !addressCustomLabelError;

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F8FC' }}>
      <StatusBar style="dark" />

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={{ flex: 1, backgroundColor: '#F7F8FC' }}>
          {step <= 7 ? (
          <ScrollView 
            showsVerticalScrollIndicator={false} 
            scrollEnabled={step !== 4}
            style={{ flex: 1 }} 
            contentContainerStyle={{ 
              paddingHorizontal: 24, 
              paddingTop: insets.top + 60, 
              paddingBottom: (step === 4 || step === 5) ? 0 : 100,
              flexGrow: (step === 4 || step === 5) ? 1 : undefined
            }}
            scrollEventThrottle={16}
            onScroll={(e) => {
              setScrollY(e.nativeEvent.contentOffset.y);
            }}
          >
            <View className="gap-6">
              {hasActiveSession && step <= 4 && (
                <View className="flex-row items-center gap-2 bg-rose-50 border border-rose-200 rounded-2xl px-4 py-3">
                  <Feather name="alert-circle" size={16} color="#E11D48" />
                  <Text className="text-[#E11D48] text-[13px] font-semibold flex-1">
                    You already have an active session.
                  </Text>
                </View>
              )}
              
              {/* STEP 1: EXPERIENCE SELECTOR */}
              {step === 1 && (
                <View className="gap-5">
                  <View>
                    <Text className="text-[#E11D48] text-xs font-black uppercase tracking-[1.8px] mb-1">
                      Training Experience
                    </Text>
                    <Text className="text-zinc-950 text-2xl font-black tracking-tight leading-tight">
                      Choose Workout Experience
                    </Text>
                    <Text className="text-zinc-500 text-sm font-normal mt-1 leading-relaxed">
                      Select a specialized discipline for your certified coach to lead at your residence.
                    </Text>
                  </View>

                  <View className="gap-3.5">
                    {EXPERIENCES.map((exp) => {
                      const isSelected = selectedExperience?.id === exp.id;
                      return (
                        <TouchableOpacity
                          key={exp.id}
                          activeOpacity={0.75}
                          onPress={() => {
                            if (isSelected) {
                              setSelectedExperience(null);
                            } else {
                              setSelectedExperience(exp);
                            }
                          }}
                          className="rounded-[24px] border flex-row items-center justify-between"
                          style={[
                            expCardStyles.card,
                            isSelected ? expCardStyles.cardSelected : expCardStyles.cardUnselected,
                            {
                              shadowColor: isSelected ? '#000000' : '#101828',
                              shadowOffset: { width: 0, height: isSelected ? 4 : 1 },
                              shadowOpacity: isSelected ? 0.2 : 0.04,
                              shadowRadius: isSelected ? 8 : 2,
                              elevation: isSelected ? 4 : 1,
                            },
                          ]}
                        >
                          <View className="flex-row items-center gap-3.5 flex-1">
                            <View
                              style={{
                                backgroundColor: exp.gradientColors[0],
                              }}
                              className="w-12 h-12 rounded-2xl items-center justify-center"
                            >
                              <Text className="text-2xl">{exp.emoji}</Text>
                            </View>
                            <View className="flex-1 pr-2">
                              <View className="flex-row items-center gap-2">
                                <Text
                                  className="text-[15px] font-bold tracking-tight"
                                  style={isSelected ? expCardStyles.titleSelected : expCardStyles.titleUnselected}
                                >
                                  {exp.title}
                                </Text>
                                <View
                                  className="px-2 py-0.5 rounded-full border"
                                  style={isSelected ? expCardStyles.badgeSelected : expCardStyles.badgeUnselected}
                                >
                                  <Text
                                    className="text-[9px] font-bold uppercase tracking-wider"
                                    style={isSelected ? expCardStyles.badgeTextSelected : expCardStyles.badgeTextUnselected}
                                  >
                                    {exp.duration} min
                                  </Text>
                                </View>
                              </View>
                              <Text
                                className="text-xs font-normal mt-1 leading-relaxed"
                                style={isSelected ? expCardStyles.descSelected : expCardStyles.descUnselected}
                              >
                                {exp.description}
                              </Text>
                            </View>
                          </View>
                          {isSelected ? (
                            <View className="w-6 h-6 rounded-full bg-[#E11D48] items-center justify-center">
                              <Feather name="check" size={13} color="white" />
                            </View>
                          ) : (
                            <View className="w-6 h-6 rounded-full border border-zinc-200 bg-zinc-50" />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* STEP 2: TRAINER PREFERENCE */}
              {step === 2 && (
                <View className="gap-5">
                  <View>
                    <Text className="text-[#E11D48] text-xs font-black uppercase tracking-[1.8px] mb-1">
                      Concierge Match
                    </Text>
                    <Text className="text-zinc-950 text-2xl font-black tracking-tight leading-tight">
                      Trainer Preference
                    </Text>
                    <Text className="text-zinc-500 text-sm font-normal mt-1 leading-relaxed">
                      Choose coach assignment preferences for your scheduled slot.
                    </Text>
                  </View>

                  <View className="flex-row flex-wrap justify-between gap-y-3.5">
                    {TRAINER_PREFERENCES.map((pref) => {
                      const isSelected = trainerPref === pref.id;
                      return (
                        <TouchableOpacity
                          key={pref.id}
                          activeOpacity={0.8}
                          onPress={() => {
                            setTrainerPref(pref.id as any);
                            if (pref.id !== 'favourite') {
                              setSelectedTrainerId('');
                              if (user.id) {
                                const dbPref = pref.id === 'any' ? 'no_preference' : pref.id;
                                Database.updateProfile(user.id, { trainerPreference: dbPref });
                              }
                              // No auto-advance: user confirms via the Continue button (handleNext -> step 3)
                            }
                          }}
                          className="w-[48%] rounded-[22px] border items-center justify-center gap-2"
                          style={[
                            {
                              paddingVertical: 18,
                              paddingHorizontal: 12,
                              minHeight: 116,
                            },
                            isSelected ? prefCardStyles.cardSelected : prefCardStyles.cardUnselected,
                          ]}
                        >
                          <Feather name={pref.icon as any} size={20} color={isSelected ? '#F59E0B' : '#71717A'} />
                          <View className="items-center">
                            <Text
                              className="text-xs font-bold tracking-tight text-center"
                              style={isSelected ? prefCardStyles.labelSelected : prefCardStyles.labelUnselected}
                            >
                              {pref.label}
                            </Text>
                            <Text
                              className="text-[10px] text-center font-normal mt-0.5"
                              style={isSelected ? prefCardStyles.descSelected : prefCardStyles.descUnselected}
                            >
                              {pref.desc}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Favourites Section */}
                  {trainerPref === 'favourite' && (
                    <View className="mt-4 gap-3">
                      <Text className="text-[#101828] text-xs font-black uppercase tracking-wider pl-1">Select Favorite Coach</Text>
                      {(() => {
                        // Find coaches who trained this user in past bookings (strictly real trainers, exclude test mock trainers)
                        const pastTrainerIds = Array.from(
                          new Set(
                            bookings
                              .filter(b => (!user?.id || b.clientId === user?.id) && (b.trainerId || b.coachId))
                              .map(b => b.trainerId || b.coachId)
                              .filter(Boolean)
                          )
                        );

                        // Only show real trainers who trained the user before; exclude mock/test trainers (e.g. 'c-', 'test', etc.)
                        const favoriteCoaches = coaches.filter(c => 
                          pastTrainerIds.includes(c.id) &&
                          !c.id.toLowerCase().includes('test') &&
                          !c.name.toLowerCase().includes('test') &&
                          !c.id.startsWith('c-')
                        );

                        if (favoriteCoaches.length === 0) {
                          return <EmptyState type="no-favourite-trainer" />;
                        }

                        return (
                          <ScrollView 
                            horizontal 
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ gap: 16, paddingHorizontal: 4, paddingVertical: 8 }}
                          >
                            {favoriteCoaches.map((coach) => {
                              const isSelected = selectedTrainerId === coach.id;
                              // Image source matching trainer's own profile page (handles master trainer profile image correctly)
                              const imageSource = (() => {
                                const raw = coach.photo;
                                if (raw && typeof raw === 'string' && (raw.startsWith('http') || raw.startsWith('data:')) && !raw.includes('photo-1534528741775') && !raw.includes('photo-1544005313') && !raw.includes('photo-1568602471122') && !raw.includes('selfie.jpg')) {
                                  return { uri: raw };
                                }
                                return MASTER_TRAINER_AVATAR_IMAGE;
                              })();

                              return (
                                <TouchableOpacity
                                  key={coach.id}
                                  activeOpacity={0.8}
                                  onPress={() => {
                                    if (isSelected) {
                                      setSelectedTrainerId('');
                                    } else {
                                      setSelectedTrainerId(coach.id);
                                    }
                                  }}
                                  className="items-center gap-2"
                                  style={{ minWidth: 80, maxWidth: 96 }}
                                >
                                  {/* Circular Profile Picture */}
                                  <View 
                                    className={`w-16 h-16 rounded-full items-center justify-center border-2 ${
                                      isSelected ? 'border-[#E11D48] bg-rose-50' : 'border-zinc-200 bg-zinc-100'
                                    }`}
                                    style={{
                                      shadowColor: isSelected ? '#E11D48' : '#101828',
                                      shadowOffset: { width: 0, height: 2 },
                                      shadowOpacity: isSelected ? 0.25 : 0.04,
                                      shadowRadius: 4,
                                      elevation: isSelected ? 3 : 1,
                                    }}
                                  >
                                    <Image 
                                      source={imageSource} 
                                      className="w-14 h-14 rounded-full" 
                                      resizeMode="cover"
                                    />
                                    {isSelected && (
                                      <View className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-[#E11D48] items-center justify-center border-2 border-white">
                                        <Feather name="check" size={10} color="white" />
                                      </View>
                                    )}
                                  </View>
                                  {/* Trainer Full Name */}
                                  <Text 
                                    numberOfLines={2}
                                    className={`text-[11px] font-black text-center ${
                                      isSelected ? 'text-[#E11D48]' : 'text-zinc-900'
                                    }`}
                                  >
                                    {coach.name}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </ScrollView>
                        );
                      })()}
                    </View>
                  )}
                </View>
              )}

              {/* STEP 3: LOCATION & MAP */}
              {step === 3 && (
                <View className="gap-5">
                  <View>
                    <Text className="text-[#E11D48] text-xs font-black uppercase tracking-[1.8px] mb-1">
                      Training Venue
                    </Text>
                    <Text className="text-zinc-950 text-2xl font-black tracking-tight leading-tight">
                      Select Training Location
                    </Text>
                    <Text className="text-zinc-500 text-sm font-normal mt-1 leading-relaxed">
                      Choose where your VIRLA Wellness Coach should visit.
                    </Text>
                  </View>

                  {/* Saved Locations List */}
                  <View className="gap-3.5">
                    {addresses.map((addr) => {
                      const isSelected = selectedAddressId === addr.id;
                      // Display dynamic mock ETA/distance for address cards context
                      let cardEta = '12–15 mins';
                      if (((addr.building || '') || '').toLowerCase().includes('worli')) cardEta = '18–22 mins';
                      if (((addr.building || '') || '').toLowerCase().includes('juhu')) cardEta = '15–18 mins';
                      if (((addr.building || '') || '').toLowerCase().includes('bandra')) cardEta = '10–12 mins';

                      return (
                        <TouchableOpacity
                          key={addr.id}
                          activeOpacity={0.9}
                          onPress={() => {
                            setSelectedAddressId(addr.id);
                            // Auto transition to step 4 on card tap after small delay
                            if (autoTransitionTimerRef.current) clearTimeout(autoTransitionTimerRef.current);
                            autoTransitionTimerRef.current = setTimeout(() => {
                              if (isMountedRef.current) {
                                triggerTransition(4);
                              }
                            }, 300);
                          }}
                          className={`p-5 rounded-[24px] border flex-row items-center justify-between  ${
                            isSelected 
                              ? 'bg-white border-[#E11D48]' 
                              : 'bg-white border-[#E5E7EB]'
                          }`}
                          style={{
                            shadowColor: isSelected ? '#E11D48' : '#101828',
                            shadowOffset: { width: 0, height: isSelected ? 6 : 2 },
                            shadowOpacity: isSelected ? 0.08 : 0.03,
                            shadowRadius: isSelected ? 12 : 6,
                            elevation: isSelected ? 4 : 2,
                          }}
                        >
                          <View className="flex-row items-center gap-4 flex-1">
                            <View className={`w-11 h-11 rounded-2xl items-center justify-center ${isSelected ? 'bg-rose-50' : 'bg-zinc-50'}`}>
                              <Text className="text-xl">
                                {addr.label === 'Home' ? '🏠' : addr.label === 'Office' ? '🏢' : addr.label === 'Gym' ? '🏋️' : '📍'}
                              </Text>
                            </View>
                            <View className="flex-1 gap-1">
                              <View className="flex-row items-center gap-2">
                                <Text className="text-[#101828] text-sm font-black">{addr.label}</Text>
                                {addr.isDefault && (
                                  <View className="bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded-full">
                                    <Text className="text-[#6B7280] text-[8px] font-black uppercase tracking-wider">Default</Text>
                                  </View>
                                )}
                                {isSelected && (
                                  <View className="bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full">
                                    <Text className="text-[#E11D48] text-[8px] font-black uppercase tracking-wider">Selected</Text>
                                  </View>
                                )}
                              </View>
                              <Text className="text-[#6B7280] text-xs font-semibold leading-relaxed">
                                {addr.addressLine}
                              </Text>
                              <View className="flex-row items-center gap-4 mt-1">
                                <Text className="text-green-600 text-[10px] font-bold">✓ Covered</Text>
                                <Text className="text-zinc-400 text-[10px] font-medium">• Est. arrival: {cardEta}</Text>
                              </View>
                            </View>
                          </View>

                          <View className="ml-2">
                            {isSelected ? (
                              <View className="w-6 h-6 rounded-full bg-[#E11D48] items-center justify-center">
                                <Feather name="check" size={14} color="white" />
                              </View>
                            ) : (
                              <View className="w-6 h-6 rounded-full border border-zinc-200 bg-zinc-50" />
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}

                    {addresses.length === 0 && (
                      <View className="p-8 rounded-[24px] border border-dashed border-[#CBD5E1] bg-white items-center justify-center gap-2">
                        <Text className="text-3xl">📍</Text>
                        <Text className="text-[#101828] text-sm font-bold">No Saved Addresses</Text>
                        <Text className="text-zinc-500 text-xs text-center">Add a training location to begin booking.</Text>
                      </View>
                    )}

                    {/* Add New Location Trigger with In-line Prominent Disclosure */}
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => openAddressModal()}
                      className="p-4 rounded-[24px] border border-dashed border-zinc-300 bg-white flex-row items-center justify-between"
                      style={{
                        shadowColor: '#101828',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.02,
                        shadowRadius: 6,
                        elevation: 1,
                      }}
                    >
                      <View className="flex-row items-center gap-3 flex-1 pr-2">
                        <View className="w-8 h-8 rounded-full bg-zinc-100 items-center justify-center">
                          <Feather name="plus" size={15} color="#18181B" />
                        </View>
                        <View className="flex-1">
                          <Text className="text-zinc-900 text-xs font-black uppercase tracking-wider">
                            Add New Location
                          </Text>
                          <Text className="text-zinc-500 text-[10.5px] font-medium mt-0.5 leading-tight">
                            Virla uses location to pinpoint your doorstep workout address
                          </Text>
                        </View>
                      </View>
                      <View className="bg-zinc-900 px-3 py-1.5 rounded-full">
                        <Text className="text-white text-[10px] font-bold uppercase tracking-wider">
                          Enable
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>

                  {/* Compact Service Availability card */}
                  {selectedAddressId ? (
                    !isLocationOutsideCoverage ? (
                      <View className="bg-emerald-50 border border-emerald-100 p-5 rounded-[24px] flex-row items-center gap-4">
                        <View className="w-10 h-10 rounded-full bg-emerald-100 items-center justify-center">
                          <Feather name="check-circle" size={20} color="#059669" />
                        </View>
                        <View className="flex-1 gap-0.5">
                          <Text className="text-emerald-800 text-xs font-black uppercase tracking-wider">🟢 Service Available</Text>
                          <Text className="text-emerald-700 text-xs font-semibold">Your location is within the VIRLA service area.</Text>
                          
                          <View className="flex-row gap-6 mt-2">
                            <View>
                              <Text className="text-zinc-500 text-[8px] font-bold uppercase">Estimated Trainer Arrival</Text>
                              <Text className="text-zinc-900 text-xs font-extrabold">{etaText}</Text>
                            </View>
                            <View>
                              <Text className="text-zinc-500 text-[8px] font-bold uppercase">Coverage Status</Text>
                              <Text className="text-zinc-900 text-xs font-extrabold">Available</Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    ) : (
                      <View className="bg-red-50 border border-red-200 p-5 rounded-[24px] gap-3">
                        <View className="flex-row items-center gap-3">
                          <View className="w-10 h-10 rounded-full bg-red-100 items-center justify-center">
                            <Feather name="alert-triangle" size={20} color="#DC2626" />
                          </View>
                          <View className="flex-1">
                            <Text className="text-red-800 text-xs font-black uppercase tracking-wider">⚠️ Outside Service Area</Text>
                            <Text className="text-red-700 text-xs font-semibold">Sorry, VIRLA is not yet available in this area.</Text>
                          </View>
                        </View>
                        <Text className="text-zinc-500 text-xs leading-relaxed pl-1">
                          Join our waitlist and we&apos;ll notify you when we launch here.
                        </Text>
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => Alert.alert('Waitlist Joined', 'Thank you! We will notify you as soon as VIRLA launches in your area.')}
                          className="bg-red-600 h-11 rounded-xl items-center justify-center self-start px-6"
                        >
                          <Text className="text-white text-xs font-black uppercase tracking-wider">Notify Me</Text>
                        </TouchableOpacity>
                      </View>
                    )
                  ) : null}

                  <Modal
                    visible={isAddAddressModalVisible}
                    animationType="slide"
                    onRequestClose={() => setIsAddAddressModalVisible(false)}
                  >
                    <View style={{ flex: 1, backgroundColor: addAddressStep === 2 ? '#FFFFFF' : '#F7F8FC' }}>
                      <StatusBar style="dark" />
                      {/* Conditional Header for Stage 2 only */}
                      {addAddressStep === 2 && (
                        <View 
                          style={{ paddingTop: insets.top }} 
                          className="bg-white border-b border-zinc-100 shadow-xs"
                        >
                          <View className="h-14 flex-row items-center px-5 justify-between">
                            <TouchableOpacity 
                              onPress={() => setAddAddressStep(1)} 
                              activeOpacity={0.7}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                              className="w-9 h-9 items-center justify-center rounded-full"
                            >
                              <Ionicons name="arrow-back" size={20} color="#09090B" />
                            </TouchableOpacity>
                            <View className="items-center flex-1 mx-2">
                              <View className="flex-row items-center gap-1.5">
                                <View className="w-1.5 h-1.5 rounded-full bg-[#E11D48]" />
                                <Text 
                                  style={{ letterSpacing: 2.2 }}
                                  className="text-zinc-500 text-[9.5px] font-bold uppercase"
                                >
                                  TRAINING LOCATION
                                </Text>
                              </View>
                              <Text 
                                numberOfLines={1}
                                className="text-zinc-950 text-base font-extrabold tracking-tight mt-0.5"
                              >
                                Address Details
                              </Text>
                            </View>
                            <View className="w-9" />
                          </View>
                        </View>
                      )}

                      <View style={{ flex: 1, backgroundColor: addAddressStep === 2 ? '#FFFFFF' : '#F7F8FC' }}>
                        {/* STAGE 1: MAP + SEARCH */}
                        {addAddressStep === 1 && (
                          <View style={{ flex: 1, position: 'relative' }}>
                            <SafeMapWrapper>
                              <MapView
                                ref={mapRef}
                                provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
                                style={{ flex: 1, width: '100%', height: '100%' }}
                                initialRegion={{
                                  latitude: activeCoords.lat,
                                  longitude: activeCoords.lng,
                                  latitudeDelta: 0.005,
                                  longitudeDelta: 0.005,
                                }}
                                onRegionChangeComplete={(region) => {
                                  // Prevent geocoding cycle if region hasn't moved meaningfully
                                  const latDiff = Math.abs(region.latitude - activeCoords.lat);
                                  const lngDiff = Math.abs(region.longitude - activeCoords.lng);
                                  if (latDiff > 0.00005 || lngDiff > 0.00005) {
                                    if (reverseGeocodeTimerRef.current) {
                                      clearTimeout(reverseGeocodeTimerRef.current);
                                    }
                                    setIsReverseGeocoding(true);
                                    const requestId = ++geocodeRequestCounterRef.current;
                                    
                                    reverseGeocodeTimerRef.current = setTimeout(async () => {
                                      try {
                                        const res = await reverseGeocodeCoords(region.latitude, region.longitude);
                                        if (requestId !== geocodeRequestCounterRef.current) {
                                          return;
                                        }
                                        
                                        setActiveCoords({ lat: region.latitude, lng: region.longitude });
                                        setSearchQuery(res.address);
                                        setPlaceId(res.placeId || '');
                                        setHasConfirmedSearchSelection(false);
                                        setIsPinSelectionAuthoritative(true);
                                        
                                        const resolved = await resolveExactLocation(region.latitude, region.longitude, res.address, res.results);
                                        setResolvedPlaceName(resolved.buildingName);
                                        
                                        const centerMumbai = { lat: 19.0176, lng: 72.8164 };
                                        const dist = calculateDistanceKm(region.latitude, region.longitude, centerMumbai.lat, centerMumbai.lng);
                                        setDistanceText(`${dist.toFixed(1)} km`);
                                        setEtaText(`~${Math.round(dist * 2.5 + 5)} mins`);
                                        setIsLocationOutsideCoverage(dist > 30);
                                      } catch (e) {
                                        console.warn('Map settle geocode failure:', e);
                                      } finally {
                                        if (requestId === geocodeRequestCounterRef.current) {
                                          setIsReverseGeocoding(false);
                                        }
                                      }
                                    }, 800);
                                  }
                                }}
                              />
                            </SafeMapWrapper>

                            {/* Static Central pin overlay */}
                            <View 
                              pointerEvents="none" 
                              style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                marginLeft: -24,
                                marginTop: -48,
                                width: 48,
                                height: 48,
                                alignItems: 'center',
                                justifyContent: 'center',
                                zIndex: 10,
                              }}
                            >
                              <View 
                                className={`w-12 h-12 rounded-full ${
                                  isLocationOutsideCoverage ? 'bg-red-500' : 'bg-[#E11D48]'
                                } border-4 border-white items-center justify-center shadow-lg`}
                              >
                                <Feather name={isLocationOutsideCoverage ? 'alert-triangle' : 'map-pin'} size={20} color="white" />
                              </View>
                            </View>

                            {/* Floating Header Card at Top */}
                            <View 
                              style={{
                                position: 'absolute',
                                top: Math.max(insets.top, 16) + 8,
                                left: 16,
                                right: 16,
                                backgroundColor: 'white',
                                borderRadius: 24,
                                padding: 16,
                                zIndex: 50,
                                borderWidth: 1,
                                borderColor: '#E5E7EB',
                                shadowColor: '#101828',
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.08,
                                shadowRadius: 12,
                                elevation: 4,
                              }}
                            >
                              {/* Back button and title */}
                              <View className="flex-row items-center justify-between mb-3">
                                <TouchableOpacity 
                                  onPress={() => setIsAddAddressModalVisible(false)} 
                                  activeOpacity={0.7}
                                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                  className="w-9 h-9 items-center justify-center rounded-full"
                                >
                                  <Ionicons name="arrow-back" size={20} color="#09090B" />
                                </TouchableOpacity>
                                <View className="items-center flex-1 mx-2">
                                  <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider">
                                    Select Training Location
                                  </Text>
                                  <Text className="text-zinc-400 text-[9px] font-semibold mt-0.5">
                                    Drag map to set your location pin
                                  </Text>
                                </View>
                                <View className="w-9" />
                              </View>

                              {/* Search Input field */}
                              <View className="flex-row items-center bg-zinc-50 border border-zinc-200/80 px-3.5 h-11 rounded-xl">
                                <Feather name="search" size={15} color="#71717A" />
                                <TextInput
                                  placeholder="Search society, street, building or area..."
                                  placeholderTextColor="#A1A1AA"
                                  value={searchQuery}
                                  onChangeText={(t) => handleSearchTextChange(t)}
                                  className="flex-1 text-xs font-semibold text-zinc-900 ml-2.5 py-0"
                                />
                                {searchQuery.trim().length > 0 && (
                                  <TouchableOpacity 
                                    onPress={() => handleSearchTextChange('')}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                  >
                                    <Feather name="x" size={14} color="#A1A1AA" />
                                  </TouchableOpacity>
                                )}
                              </View>

                              {/* Dropdown list of suggestions */}
                              {showSearchDropdown && googleSuggestions.length > 0 && (
                                <ScrollView 
                                  style={{ maxHeight: 200 }} 
                                  keyboardShouldPersistTaps="handled" 
                                  showsVerticalScrollIndicator={false} 
                                  className="mt-2 border-t border-zinc-100"
                                >
                                  {googleSuggestions.map((item, idx) => (
                                    <TouchableOpacity
                                      key={idx}
                                      onPress={() => handleSelectGoogleSuggestion(item)}
                                      className="py-3 border-b border-zinc-100 flex-row justify-between items-center bg-white"
                                    >
                                      <View className="flex-1 pr-2 gap-0.5">
                                        <Text className="text-zinc-900 text-xs font-bold">
                                          {item.mainText || item.description}
                                        </Text>
                                        {!!item.secondaryText && (
                                          <Text className="text-zinc-500 text-[10px] font-semibold">
                                            {item.secondaryText}
                                          </Text>
                                        )}
                                      </View>
                                      <Feather name="arrow-up-left" size={12} color="#9CA3AF" />
                                    </TouchableOpacity>
                                  ))}
                                </ScrollView>
                              )}
                            </View>

                            {/* Floating Current Location Button */}
                            <TouchableOpacity
                              activeOpacity={0.8}
                              onPress={handleUseCurrentGps}
                              style={{
                                position: 'absolute',
                                bottom: Math.max(insets.bottom, 16) + 210,
                                right: 16,
                                width: 44,
                                height: 44,
                                borderRadius: 22,
                                backgroundColor: 'white',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderWidth: 1,
                                borderColor: '#E5E7EB',
                                shadowColor: '#101828',
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.1,
                                shadowRadius: 8,
                                elevation: 4,
                                zIndex: 30,
                              }}
                            >
                              <Feather name="navigation" size={18} color="#4F46E5" />
                            </TouchableOpacity>

                            {/* Bottom Sheet Address Panel */}
                            <View 
                              style={{
                                position: 'absolute',
                                bottom: Math.max(insets.bottom + 8, Platform.OS === 'android' ? 20 : 16),
                                left: 16,
                                right: 16,
                                backgroundColor: 'white',
                                borderRadius: 24,
                                padding: 16,
                                borderWidth: 1,
                                borderColor: '#E5E7EB',
                                shadowColor: '#101828',
                                shadowOffset: { width: 0, height: 6 },
                                shadowOpacity: 0.1,
                                shadowRadius: 16,
                                elevation: 6,
                                zIndex: 30,
                              }}
                            >
                              <Text className="text-zinc-400 text-[9.5px] font-black uppercase tracking-[1.5px] text-center mb-2.5">
                                Target Location
                              </Text>

                              <View className="bg-zinc-50 border border-zinc-200/80 p-3.5 rounded-2xl mb-3 flex-row items-start gap-3">
                                <View className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-100 items-center justify-center mt-0.5">
                                  <Feather name="map-pin" size={14} color="#E11D48" />
                                </View>
                                <View className="flex-1">
                                  <Text className="text-zinc-900 text-xs font-black mb-0.5 uppercase tracking-tight">
                                    {isReverseGeocoding
                                      ? 'Locating target entrance...'
                                      : ((!hasConfirmedSearchSelection && !isPinSelectionAuthoritative) ? 'Selected location' : resolvedPlaceName)}
                                  </Text>
                                  <Text className="text-zinc-500 text-[10px] font-semibold leading-relaxed" numberOfLines={2}>
                                    {isReverseGeocoding
                                      ? 'Fetching address details...'
                                      : ((!hasConfirmedSearchSelection && !isPinSelectionAuthoritative) ? 'Select a location from search or move the pin on the map' : searchQuery || 'Select your location on map')}
                                  </Text>

                                  {gpsAccuracy !== null && !isReverseGeocoding && (
                                    <Text className="text-indigo-600 text-[9px] font-bold mt-1">
                                      🛰️ Accuracy: {gpsAccuracy <= 15 ? `High (~${gpsAccuracy.toFixed(0)}m)` : `Medium (~${gpsAccuracy.toFixed(0)}m)`}
                                    </Text>
                                  )}
                                </View>
                              </View>

                              {isLocationOutsideCoverage && (
                                <View className="bg-rose-50 border border-rose-100 p-2.5 rounded-xl mb-3">
                                  <Text className="text-[#E11D48] text-[9px] font-bold uppercase text-center">Outside Service Area (Mumbai Only)</Text>
                                </View>
                              )}

                              <TouchableOpacity
                                activeOpacity={0.8}
                                disabled={isReverseGeocoding || (!hasConfirmedSearchSelection && !isPinSelectionAuthoritative)}
                                onPress={() => {
                                  setIsMapConfirmed(true);
                                  if (resolvedPlaceName && 
                                      resolvedPlaceName !== 'Selected Location' && 
                                      !/^\d/.test(resolvedPlaceName) && 
                                      !resolvedPlaceName.includes('°')) {
                                    setNewBuildingName(resolvedPlaceName);
                                  } else {
                                    setNewBuildingName('');
                                  }
                                  setAddAddressStep(2);
                                }}
                                className={`w-full h-12 rounded-xl items-center justify-center flex-row gap-2 ${
                                  (isReverseGeocoding || (!hasConfirmedSearchSelection && !isPinSelectionAuthoritative)) ? 'bg-zinc-200' : 'bg-zinc-950'
                                }`}
                              >
                                {isReverseGeocoding ? (
                                  <ActivityIndicator size="small" color="#6B7280" />
                                ) : (
                                  <Text className="text-white text-xs font-black uppercase tracking-wider">Confirm Location</Text>
                                )}
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}

                        {/* STAGE 2: ADDRESS DETAILS FORM */}
                        {addAddressStep === 2 && (
                          <KeyboardAvoidingView
                            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                            style={{ flex: 1, backgroundColor: '#FFFFFF' }}
                          >
                            <ScrollView 
                              showsVerticalScrollIndicator={false}
                              contentContainerStyle={{ 
                                paddingHorizontal: 20,
                                paddingTop: 20,
                                paddingBottom: Math.max(insets.bottom + 32, 60),
                              }}
                              className="flex-1 bg-white"
                            >
                              <View className="gap-6">
                                {/* Confirmed Location Preview */}
                                <View className="gap-2">
                                  <View className="flex-row items-center justify-between">
                                    <Text className="text-zinc-500 text-[10px] font-bold uppercase tracking-[1.5px] pl-0.5">
                                      Confirmed Location
                                    </Text>
                                    <TouchableOpacity 
                                      onPress={() => setAddAddressStep(1)} 
                                      className="flex-row items-center gap-1"
                                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                      <Feather name="edit-2" size={11} color="#E11D48" />
                                      <Text className="text-[#E11D48] text-[10px] font-bold uppercase tracking-wider">Change</Text>
                                    </TouchableOpacity>
                                  </View>
                                  <View className="bg-zinc-50 border border-zinc-200/90 p-3.5 rounded-2xl flex-row items-start gap-3">
                                    <View className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-100 items-center justify-center mt-0.5">
                                      <Feather name="map-pin" size={14} color="#E11D48" />
                                    </View>
                                    <View className="flex-1">
                                      <Text className="text-zinc-900 text-xs font-black mb-0.5 uppercase tracking-tight">
                                        {resolvedPlaceName}
                                      </Text>
                                      <Text className="text-zinc-500 text-[10px] font-semibold leading-relaxed">
                                        {searchQuery}
                                      </Text>
                                    </View>
                                  </View>
                                </View>

                                {/* House & Street Details Fields */}
                                <View className="gap-4">
                                  <Text className="text-zinc-500 text-[10px] font-bold uppercase tracking-[1.5px] pl-0.5">
                                    House & Street Details
                                  </Text>
                                  <View className="gap-3.5">
                                    {/* Flat / House No. (Mandatory) */}
                                    <View className="gap-1.5">
                                      <View className="flex-row items-center justify-between">
                                        <View className="flex-row items-center gap-1">
                                          <Text className="text-zinc-700 text-[10px] font-bold uppercase tracking-wider pl-0.5">Flat / House No.</Text>
                                          <Text className="text-red-500 font-black text-xs">*</Text>
                                        </View>
                                        <Text className="text-red-500 text-[9px] font-black uppercase tracking-wider">Required</Text>
                                      </View>
                                      <TextInput
                                        value={newHouseNo}
                                        onChangeText={(text) => {
                                          setNewHouseNo(text);
                                          if (!addressFieldTouched.houseNo) {
                                            setAddressFieldTouched(prev => ({ ...prev, houseNo: true }));
                                          }
                                        }}
                                        onBlur={() => setAddressFieldTouched(prev => ({ ...prev, houseNo: true }))}
                                        placeholder="Enter flat or house number (e.g. 401, A-12)"
                                        placeholderTextColor="#9CA3AF"
                                        maxLength={30}
                                        className={`h-12 border px-4 rounded-xl text-xs font-semibold text-zinc-900 ${
                                          showAddressHouseError
                                            ? 'border-red-500 bg-red-50/20'
                                            : 'border-zinc-200/90 bg-zinc-50'
                                        }`}
                                      />
                                      {showAddressHouseError && (
                                        <View className="flex-row items-center gap-1 pl-0.5 mt-0.5">
                                          <Feather name="alert-circle" size={11} color="#EF4444" />
                                          <Text className="text-red-500 text-[10px] font-bold">{addressHouseError}</Text>
                                        </View>
                                      )}
                                    </View>

                                    {/* Building / Society Name (Mandatory) */}
                                    <View className="gap-1.5">
                                      <View className="flex-row items-center justify-between">
                                        <View className="flex-row items-center gap-1">
                                          <Text className="text-zinc-700 text-[10px] font-bold uppercase tracking-wider pl-0.5">Building / Society Name</Text>
                                          <Text className="text-red-500 font-black text-xs">*</Text>
                                        </View>
                                        <Text className="text-red-500 text-[9px] font-black uppercase tracking-wider">Required</Text>
                                      </View>
                                      <TextInput
                                        value={newBuildingName}
                                        onChangeText={(text) => {
                                          setNewBuildingName(text);
                                          if (!addressFieldTouched.buildingName) {
                                            setAddressFieldTouched(prev => ({ ...prev, buildingName: true }));
                                          }
                                        }}
                                        onBlur={() => setAddressFieldTouched(prev => ({ ...prev, buildingName: true }))}
                                        placeholder="Enter building or society name (e.g. Oberoi Woods)"
                                        placeholderTextColor="#9CA3AF"
                                        maxLength={80}
                                        className={`h-12 border px-4 rounded-xl text-xs font-semibold text-zinc-900 ${
                                          showAddressBuildingError
                                            ? 'border-red-500 bg-red-50/20'
                                            : 'border-zinc-200/90 bg-zinc-50'
                                        }`}
                                      />
                                      {showAddressBuildingError && (
                                        <View className="flex-row items-center gap-1 pl-0.5 mt-0.5">
                                          <Feather name="alert-circle" size={11} color="#EF4444" />
                                          <Text className="text-red-500 text-[10px] font-bold">{addressBuildingError}</Text>
                                        </View>
                                      )}
                                    </View>

                                    {/* Floor & Tower (Optional) */}
                                    <View className="flex-row gap-3">
                                      <View className="flex-1 gap-1.5">
                                        <View className="flex-row items-center justify-between">
                                          <Text className="text-zinc-700 text-[10px] font-bold uppercase tracking-wider pl-0.5">Floor</Text>
                                          <Text className="text-zinc-400 text-[9px] font-medium">Optional</Text>
                                        </View>
                                        <TextInput
                                          value={newFloor}
                                          onChangeText={setNewFloor}
                                          placeholder="e.g. 5th Floor"
                                          placeholderTextColor="#9CA3AF"
                                          maxLength={20}
                                          className="h-12 border border-zinc-200/90 px-4 rounded-xl text-xs font-semibold bg-zinc-50 text-zinc-900"
                                        />
                                      </View>
                                      <View className="flex-1 gap-1.5">
                                        <View className="flex-row items-center justify-between">
                                          <Text className="text-zinc-700 text-[10px] font-bold uppercase tracking-wider pl-0.5">Tower / Wing</Text>
                                          <Text className="text-zinc-400 text-[9px] font-medium">Optional</Text>
                                        </View>
                                        <TextInput
                                          value={newTower}
                                          onChangeText={setNewTower}
                                          placeholder="e.g. Wing B"
                                          placeholderTextColor="#9CA3AF"
                                          maxLength={20}
                                          className="h-12 border border-zinc-200/90 px-4 rounded-xl text-xs font-semibold bg-zinc-50 text-zinc-900"
                                        />
                                      </View>
                                    </View>

                                    {/* Landmark (Optional) */}
                                    <View className="gap-1.5">
                                      <View className="flex-row items-center justify-between">
                                        <Text className="text-zinc-700 text-[10px] font-bold uppercase tracking-wider pl-0.5">Landmark</Text>
                                        <Text className="text-zinc-400 text-[9px] font-medium">Optional</Text>
                                      </View>
                                      <TextInput
                                        value={newLandmark}
                                        onChangeText={setNewLandmark}
                                        placeholder="e.g. Opposite Citi Mall / Near Gate 2"
                                        placeholderTextColor="#9CA3AF"
                                        maxLength={80}
                                        className="h-12 border border-zinc-200/90 px-4 rounded-xl text-xs font-semibold bg-zinc-50 text-zinc-900"
                                      />
                                    </View>

                                    {/* Arrival Instructions (Optional) */}
                                    <View className="gap-1.5">
                                      <View className="flex-row items-center justify-between">
                                        <Text className="text-zinc-700 text-[10px] font-bold uppercase tracking-wider pl-0.5">Arrival instructions</Text>
                                        <Text className="text-zinc-400 text-[9px] font-medium">Optional</Text>
                                      </View>
                                      <TextInput
                                        value={newArrivalInstructions}
                                        onChangeText={setNewArrivalInstructions}
                                        placeholder="e.g. Call me when you reach the security gate"
                                        placeholderTextColor="#9CA3AF"
                                        maxLength={200}
                                        className="h-12 border border-zinc-200/90 px-4 rounded-xl text-xs font-semibold bg-zinc-50 text-zinc-900"
                                      />
                                    </View>
                                  </View>
                                </View>

                                {/* Save As selector */}
                                <View className="gap-2.5">
                                  <Text className="text-zinc-500 text-[10px] font-bold uppercase tracking-[1.5px] pl-0.5">
                                    Save Address As
                                  </Text>
                                  <View className="flex-row gap-2">
                                    {[
                                      { id: 'Home', emoji: '🏠' },
                                      { id: 'Office', emoji: '🏢' },
                                      { id: 'Gym', emoji: '🏋️' },
                                      { id: 'Custom', emoji: '📍' }
                                    ].map((item) => {
                                      const isSel = newAddressLabelType === item.id;
                                      return (
                                        <TouchableOpacity
                                          key={item.id}
                                          activeOpacity={0.8}
                                          onPress={() => setNewAddressLabelType(item.id as any)}
                                          className={`flex-1 py-3.5 rounded-xl border items-center justify-center flex-row gap-1.5 ${
                                            isSel ? 'bg-zinc-950 border-zinc-950' : 'bg-zinc-50 border-zinc-200/90'
                                          }`}
                                        >
                                          <Text className="text-xs">{item.emoji}</Text>
                                          <Text className={`text-[10px] font-black uppercase ${isSel ? 'text-white' : 'text-zinc-800'}`}>{item.id}</Text>
                                        </TouchableOpacity>
                                      );
                                    })}
                                  </View>

                                  {newAddressLabelType === 'Custom' && (
                                    <View className="gap-1.5 mt-1">
                                      <View className="flex-row items-center justify-between">
                                        <View className="flex-row items-center gap-1">
                                          <Text className="text-zinc-700 text-[10px] font-bold uppercase tracking-wider pl-0.5">Custom Label</Text>
                                          <Text className="text-red-500 font-black text-xs">*</Text>
                                        </View>
                                        <Text className="text-red-500 text-[9px] font-black uppercase tracking-wider">Required</Text>
                                      </View>
                                      <TextInput
                                        value={newCustomLabel}
                                        onChangeText={(text) => {
                                          setNewCustomLabel(text);
                                          if (!addressFieldTouched.customLabel) {
                                            setAddressFieldTouched(prev => ({ ...prev, customLabel: true }));
                                          }
                                        }}
                                        onBlur={() => setAddressFieldTouched(prev => ({ ...prev, customLabel: true }))}
                                        placeholder="Custom label (e.g. Parents, Guest, Studio)"
                                        placeholderTextColor="#9CA3AF"
                                        maxLength={20}
                                        className={`h-12 border px-4 rounded-xl text-xs font-semibold text-zinc-900 ${
                                          showAddressCustomLabelError
                                            ? 'border-red-500 bg-red-50/20'
                                            : 'border-zinc-200/90 bg-zinc-50'
                                        }`}
                                      />
                                      {showAddressCustomLabelError && (
                                        <View className="flex-row items-center gap-1 pl-0.5 mt-0.5">
                                          <Feather name="alert-circle" size={11} color="#EF4444" />
                                          <Text className="text-red-500 text-[10px] font-bold">{addressCustomLabelError}</Text>
                                        </View>
                                      )}
                                    </View>
                                  )}
                                </View>

                                {/* Receiver details */}
                                <View className="gap-2">
                                  <Text className="text-zinc-500 text-[10px] font-bold uppercase tracking-[1.5px] pl-0.5">
                                    Receiver details
                                  </Text>
                                  <View className="bg-zinc-50 border border-zinc-200/90 p-4 rounded-2xl gap-2.5">
                                    <View className="flex-row justify-between items-center">
                                      <Text className="text-zinc-500 text-[10px] font-bold uppercase">Name</Text>
                                      <Text className="text-zinc-900 text-xs font-black">{user.name}</Text>
                                    </View>
                                    <View className="flex-row justify-between items-center border-t border-zinc-200/60 pt-2.5 mt-1">
                                      <Text className="text-zinc-500 text-[10px] font-bold uppercase">Phone</Text>
                                      <Text className="text-zinc-900 text-xs font-black">
                                        {Database.schema.users.find(u => u.id === user?.id)?.phone || 'No phone number'}
                                      </Text>
                                    </View>
                                  </View>
                                  <Text className="text-zinc-400 text-[9px] font-medium pl-0.5">
                                    To edit receiver details, update profile settings.
                                  </Text>
                                </View>

                                {/* Save Button */}
                                <TouchableOpacity
                                  activeOpacity={0.8}
                                  onPress={async () => {
                                    setAddressFormAttempted(true);

                                    const houseErr = validateHouseNo(newHouseNo);
                                    if (houseErr) {
                                      Alert.alert('Flat / House No. Required', houseErr);
                                      return;
                                    }

                                    const bldgErr = validateBuildingName(newBuildingName);
                                    if (bldgErr) {
                                      Alert.alert('Building / Society Required', bldgErr);
                                      return;
                                    }

                                    const customErr = validateCustomLabel(newCustomLabel, newAddressLabelType);
                                    if (customErr) {
                                      Alert.alert('Custom Label Required', customErr);
                                      return;
                                    }

                                    if (!activeCoords.lat || !activeCoords.lng || activeCoords.lat === 0 || activeCoords.lng === 0) {
                                      Alert.alert('Validation Error', 'Verified location coordinates are missing. Please confirm your location on the map.');
                                      return;
                                    }
                                    if (activeCoords.lat < -90 || activeCoords.lat > 90 || activeCoords.lng < -180 || activeCoords.lng > 180) {
                                      Alert.alert('Validation Error', 'Invalid location coordinates detected. Please confirm your location on the map again.');
                                      return;
                                    }
                                    if (!isMapConfirmed) {
                                      Alert.alert('Validation Error', 'Please confirm your location pin on the map.');
                                      return;
                                    }

                                    const finalLabel = (newAddressLabelType === 'Custom'
                                      ? (newCustomLabel.trim() || 'Custom')
                                      : newAddressLabelType) as 'Home' | 'Office' | 'Gym' | 'Custom';

                                    // Prepend house number and combine building name and tower
                                    const displayBuilding = newTower.trim() 
                                      ? `${newBuildingName.trim()} (${newTower.trim()})` 
                                      : newBuildingName.trim();
                                    const fullBuilding = `${newHouseNo.trim()}, ${displayBuilding}`;
                                    
                                    // Combine floor and geocoded street info
                                    const fullStreet = [newFloor.trim() ? `${newFloor.trim()}` : '', searchQuery.trim()].filter(Boolean).join(', ');

                                    try {
                                      const added = await addAddress({
                                        label: finalLabel,
                                        building: fullBuilding,
                                        street: fullStreet,
                                        landmark: newLandmark.trim(),
                                        city: 'Mumbai',
                                        pinCode: '',
                                        isDefault: false,
                                        lat: activeCoords.lat,
                                        lng: activeCoords.lng,
                                        apartment: newHouseNo.trim(),
                                        floor: newFloor.trim(),
                                        notes: newArrivalInstructions.trim(),
                                        placeId: placeId || undefined
                                      });

                                      setSelectedAddressId(added.id);
                                      setIsAddAddressModalVisible(false);
                                      Alert.alert('Address Saved 🏠', 'Your training venue has been successfully saved with exact GPS coordinates.');
                                    } catch (err: any) {
                                      console.error('[DIAGNOSTIC] Saving address failed:', err);
                                      Alert.alert('Save Failed', `Database error: ${err?.message || 'Could not persist location.'}`);
                                    }
                                  }}
                                  className={`w-full h-14 rounded-2xl items-center justify-center mt-2 ${
                                    isAddressFormValid ? 'bg-zinc-950' : 'bg-zinc-900'
                                  }`}
                                  style={isAddressFormValid ? {
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.15,
                                    shadowRadius: 4,
                                    elevation: 3,
                                  } : undefined}
                                >
                                  <Text className="text-xs font-black uppercase tracking-wider text-white">
                                    Save Location
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            </ScrollView>
                          </KeyboardAvoidingView>
                        )}
                      </View>
                    </View>
                  </Modal>
                </View>
              )}

              {/* STEP 4: DATE & TIME SELECTOR */}
              {step === 4 && (
                <View style={{ height: Dimensions.get('window').height - insets.top - 80 }} className="gap-4">
                  <View>
                    <Text className="text-[#E11D48] text-xs font-black uppercase tracking-[1.8px] mb-1">
                      Schedule Day & Time
                    </Text>
                    <Text className="text-zinc-950 text-2xl font-black tracking-tight leading-tight">
                      Select Date & Time
                    </Text>
                    <Text className="text-zinc-500 text-sm font-normal mt-1 leading-relaxed">
                      Choose which calendar day and available hour works best for your home session.
                    </Text>
                  </View>

                  {/* Horizontal Date Capsules (Today, Tomorrow, Day After, Calendar) */}
                  <View className="flex-row justify-between gap-2.5">
                    {((istNow) => {
                      const infoToday = getISTDateInfo(istNow);
                      const tomorrowTime = new Date(istNow.getTime() + 24 * 60 * 60 * 1000);
                      const infoTomorrow = getISTDateInfo(tomorrowTime);
                      const dayAfterTime = new Date(istNow.getTime() + 2 * 24 * 60 * 60 * 1000);
                      const infoDayAfter = getISTDateInfo(dayAfterTime);
                      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                      const weekdays = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
                      
                      const dayAfterDate = new Date(infoDayAfter.year, infoDayAfter.month - 1, infoDayAfter.day);
                      const dayAfterLabel = weekdays[dayAfterDate.getDay()];

                      return [
                        { id: 'today', label: 'TODAY', sub: `${infoToday.day} ${months[infoToday.month - 1].toUpperCase()}` },
                        { id: 'tomorrow', label: 'TOMORROW', sub: `${infoTomorrow.day} ${months[infoTomorrow.month - 1].toUpperCase()}` },
                        { id: 'dayafter', label: dayAfterLabel, sub: `${infoDayAfter.day} ${months[infoDayAfter.month - 1].toUpperCase()}` },
                        { id: 'calendar', label: 'CALENDAR', sub: showCalendarPicker ? 'Hide' : 'Pick Date' }
                      ];
                    })(getCurrentServerTime()).map((capsule) => {
                      const isSelected = dateSelectionType === capsule.id;
                      return (
                        <TouchableOpacity
                          key={capsule.id}
                          activeOpacity={0.8}
                          onPress={async () => {
                            if (capsule.id === 'calendar') {
                              setDateSelectionType('calendar');
                              setShowCalendarPicker(true);
                              setSelectedDate('');
                              setSelectedTime('');
                              return;
                            }
                            setDateSelectionType(capsule.id as any);
                            setShowCalendarPicker(false);
                            const istNow = getCurrentServerTime();
                            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                            let targetDateFormatted = '';
                            if (capsule.id === 'today') {
                              const info = getISTDateInfo(istNow);
                              targetDateFormatted = `${months[info.month - 1]} ${info.day}, ${info.year}`;
                            } else if (capsule.id === 'tomorrow') {
                              const tomorrowTime = new Date(istNow.getTime() + 24 * 60 * 60 * 1000);
                              const info = getISTDateInfo(tomorrowTime);
                              targetDateFormatted = `${months[info.month - 1]} ${info.day}, ${info.year}`;
                            } else if (capsule.id === 'dayafter') {
                              const dayAfterTime = new Date(istNow.getTime() + 2 * 24 * 60 * 60 * 1000);
                              const info = getISTDateInfo(dayAfterTime);
                              targetDateFormatted = `${months[info.month - 1]} ${info.day}, ${info.year}`;
                            }
                            
                            setSelectedDate(targetDateFormatted);
                            setSelectedTime('');
                            loadAvailabilityForSelectedDate(targetDateFormatted);
                          }}
                          className={`flex-1 px-1 py-3.5 rounded-2xl border items-center justify-center gap-1 ${
                            isSelected ? 'bg-zinc-950 border-zinc-950' : 'bg-white border-[#E5E7EB]'
                          }`}
                          style={{
                            shadowColor: '#101828',
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.02,
                            shadowRadius: 2,
                            elevation: 1,
                          }}
                        >
                          <Text 
                            numberOfLines={1}
                            adjustsFontSizeToFit={true}
                            className={`text-[9px] font-black uppercase tracking-wider text-center ${isSelected ? 'text-white' : 'text-[#101828]'}`}
                          >
                            {capsule.label}
                          </Text>
                          <Text 
                            numberOfLines={1}
                            className={`text-[8px] font-bold text-center mt-0.5 ${isSelected ? 'text-zinc-400' : 'text-[#6B7280]'}`}
                          >
                            {capsule.sub}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Horizontal Bar under Calendar when Calendar is selected */}
                  {showCalendarPicker && (
                    <View className="bg-white border border-[#E5E7EB] p-3 rounded-2xl gap-2 shadow-2xs">
                      <ScrollView 
                        horizontal 
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: 8, paddingVertical: 2, alignItems: 'center' }}
                      >
                        {(() => {
                          const istNow = getCurrentServerTime();
                          const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                          const monthsFull = [
                            'January', 'February', 'March', 'April', 'May', 'June',
                            'July', 'August', 'September', 'October', 'November', 'December'
                          ];
                          const weekdaysShort = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

                          const items: any[] = [];
                          let lastMonthIdx = -1;

                          // Show 21 days forward from day after tomorrow onwards
                          for (let i = 2; i < 25; i++) {
                            const dateObj = new Date(istNow.getTime() + i * 24 * 60 * 60 * 1000);
                            const info = getISTDateInfo(dateObj);
                            const currentMonthIdx = info.month - 1;

                            if (currentMonthIdx !== lastMonthIdx) {
                              items.push({
                                type: 'month-badge',
                                key: `cal-month-${info.year}-${currentMonthIdx}`,
                                shortName: monthsShort[currentMonthIdx].toUpperCase(),
                                fullName: monthsFull[currentMonthIdx],
                              });
                              lastMonthIdx = currentMonthIdx;
                            }

                            const dateFormatted = `${monthsShort[currentMonthIdx]} ${info.day}, ${info.year}`;
                            const dayDate = new Date(info.year, currentMonthIdx, info.day);
                            const weekday = weekdaysShort[dayDate.getDay()];

                            items.push({
                              type: 'date-capsule',
                              key: `cal-date-${info.year}-${info.month}-${info.day}`,
                              dateString: dateFormatted,
                              dayNum: info.day,
                              monthShort: monthsShort[currentMonthIdx].toUpperCase(),
                              weekday,
                            });
                          }

                          return items.map((item) => {
                            if (item.type === 'month-badge') {
                              return (
                                <View 
                                  key={item.key}
                                  className="px-2 py-1 justify-center mr-1"
                                >
                                  <Text className="text-zinc-900 text-xs font-black uppercase tracking-wider">
                                    {item.shortName}
                                  </Text>
                                  <Text className="text-zinc-400 text-[9px] font-semibold">
                                    {item.fullName}
                                  </Text>
                                </View>
                              );
                            }

                            const isPicked = selectedDate === item.dateString;
                            const isAvailable = checkDateHasAvailableSlots(item.dateString);
                            return (
                              <TouchableOpacity
                                key={item.key}
                                activeOpacity={0.8}
                                onPress={() => {
                                  setSelectedDate(item.dateString);
                                  setSelectedTime('');
                                  loadAvailabilityForSelectedDate(item.dateString);
                                }}
                                className={`w-14 h-14 rounded-full border items-center justify-center relative ${
                                  isPicked ? 'bg-[#E11D48] border-[#E11D48]' : 'bg-zinc-50 border-[#E5E7EB]'
                                }`}
                                style={{
                                  shadowColor: '#101828',
                                  shadowOffset: { width: 0, height: 1 },
                                  shadowOpacity: isPicked ? 0.15 : 0.02,
                                  shadowRadius: 3,
                                  elevation: 1,
                                }}
                              >
                                <Text className={`text-[8px] font-black uppercase tracking-wider text-center ${
                                  isPicked ? 'text-white/80' : 'text-zinc-400'
                                }`}>
                                  {item.weekday}
                                </Text>
                                <Text className={`text-sm font-black tracking-tight text-center ${
                                  isPicked ? 'text-white' : 'text-zinc-900'
                                }`}>
                                  {item.dayNum}
                                </Text>
                                {/* Availability Status Indicator Dot (Green = Available, Red = Full/Unavailable) */}
                                <View 
                                  className={`w-1.5 h-1.5 rounded-full absolute bottom-1 ${
                                    isPicked 
                                      ? (isAvailable ? 'bg-emerald-300' : 'bg-rose-300')
                                      : (isAvailable ? 'bg-emerald-500' : 'bg-red-500')
                                  }`} 
                                />
                              </TouchableOpacity>
                            );
                          });
                        })()}
                      </ScrollView>
                    </View>
                  )}

                  {/* Available Time Slots Section (Embedded in Date & Time Step) */}
                  <View className="flex-1 mt-1">
                    <View className="mb-2">
                      <Text className="text-zinc-950 text-lg font-black tracking-tight">
                        Select Time Slot
                      </Text>
                      <Text className="text-zinc-500 text-xs font-normal mt-0.5 leading-relaxed">
                        Choose an available hour for your coach visit.
                      </Text>
                    </View>

                    <ScrollView
                      showsVerticalScrollIndicator={false}
                      style={{ flex: 1 }}
                      contentContainerStyle={{ paddingBottom: 160, gap: 10 }}
                    >

                    {(() => {
                      if (!selectedDate) {
                        return (
                          <View 
                            className="bg-white border border-[#E5E7EB] p-8 rounded-[24px] items-center justify-center mt-2 shadow-2xs gap-2"
                            style={{ minHeight: 160 }}
                          >
                            <Feather name="calendar" size={28} color="#9CA3AF" />
                            <Text className="text-zinc-900 text-sm font-bold text-center">
                              Select a date from calendar
                            </Text>
                            <Text className="text-zinc-500 text-xs text-center">
                              Choose any date from the bar above to view available time slots.
                            </Text>
                          </View>
                        );
                      }

                      if (isLoadingAvailability) {
                        return (
                          <View 
                            className="bg-white border border-[#E5E7EB] p-8 rounded-[28px] items-center justify-center mt-2 shadow-sm"
                            style={{
                              shadowColor: '#101828',
                              shadowOffset: { width: 0, height: 2 },
                              shadowOpacity: 0.02,
                              shadowRadius: 6,
                              elevation: 1,
                              minHeight: 180
                            }}
                          >
                            <ActivityIndicator size="large" color="#4F46E5" />
                            <Text className="text-zinc-650 text-xs font-black uppercase tracking-widest text-center mt-4">
                              Checking availability for {formatToDDMMYYYY(selectedDate)}...
                            </Text>
                          </View>
                        );
                      }

                      const customerAddress = addresses.find(a => a.id === selectedAddressId);
                      const customerHasNoCoords = selectedAddressId ? (!customerAddress || customerAddress.lat === undefined || customerAddress.lng === undefined || customerAddress.lat === null || customerAddress.lng === null) : false;

                      if (customerHasNoCoords) {
                        return (
                          <View 
                            className="bg-white border border-[#E5E7EB] p-8 rounded-[28px] items-center gap-6 mt-2 shadow-sm"
                            style={{
                              shadowColor: '#101828',
                              shadowOffset: { width: 0, height: 2 },
                              shadowOpacity: 0.02,
                              shadowRadius: 6,
                              elevation: 1
                            }}
                          >
                            <View className="w-16 h-16 rounded-full bg-rose-50 items-center justify-center">
                              <Feather name="map-pin" size={32} color="#E11D48" />
                            </View>
                            <View className="items-center gap-2">
                              <Text className="text-[#101828] text-base font-black tracking-tight text-center">
                                Location Coordinates Missing
                              </Text>
                              <Text className="text-[#6B7280] text-[10px] font-medium leading-relaxed text-center max-w-[80%]">
                                The selected address does not have valid GPS coordinates. Please select or edit your address with a valid location.
                              </Text>
                            </View>
                            <TouchableOpacity
                              activeOpacity={0.8}
                              onPress={() => triggerTransition(3)}
                              className="bg-[#101828] py-4 px-8 rounded-xl items-center justify-center w-full"
                            >
                              <Text className="text-white text-xs font-black uppercase tracking-wider">Select Location</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      }

                      const availableSlots = getDynamicAvailableSlots();
                      const targetCategory = selectedExperience ? (WORKOUT_CATEGORY_MAPPING[selectedExperience.id] || '') : '';
                      const customerLat = customerAddress?.lat || 0;
                      const customerLng = customerAddress?.lng || 0;
                      const finalEligibleTrainers = coaches.filter(coach => {
                        const assignments = Database.getWorkoutAssignments(coach.id);
                        const isApproved = assignments.some(a => a.workoutCategory === targetCategory && a.status === 'APPROVED');
                        const acceptsAll = assignments.some(a => a.workoutCategory === 'All Workouts' && a.status === 'APPROVED');
                        const workoutApproved = acceptsAll || isApproved;

                        const isOnline = coach.preferences?.online !== false;
                        const isPartnerApproved = coach.verifiedBadge !== false;

                        const locationStatus = coach.preferences?.operatingLocationStatus;
                        const locationApproved = locationStatus === 'verified';

                        const trainerLat = coach.preferences?.operatingLatitude;
                        const trainerLng = coach.preferences?.operatingLongitude;
                        const radiusLimit = Math.min(coach.preferences?.radiusKm || 5, 5);

                        let distance = 999999;
                        let insideRadius = false;
                        if (trainerLat !== undefined && trainerLat !== null && trainerLng !== undefined && trainerLng !== null) {
                          distance = calculateDistanceKm(trainerLat, trainerLng, customerLat, customerLng);
                          insideRadius = distance <= radiusLimit;
                        }

                        // Apply gender filters
                        const trainerGender = (coach.gender || '').toLowerCase();
                        const genderValid = trainerGender === 'male' || trainerGender === 'female';
                        
                        let genderApproved = false;
                        if (genderValid) {
                          if (trainerPref === 'any') {
                            genderApproved = true;
                          } else if (trainerPref === 'male') {
                            genderApproved = trainerGender === 'male';
                          } else if (trainerPref === 'female') {
                            genderApproved = trainerGender === 'female';
                          } else if (trainerPref === 'favourite') {
                            const clientPref = (Database.getProfile(user.id || '')?.trainerPreference || 'no_preference').toLowerCase();
                            if (clientPref === 'male') {
                              genderApproved = trainerGender === 'male';
                            } else if (clientPref === 'female') {
                              genderApproved = trainerGender === 'female';
                            } else {
                              genderApproved = true;
                            }
                          }
                        }

                        return isOnline && isPartnerApproved && workoutApproved && locationApproved && insideRadius && genderValid && genderApproved;
                      });

                      const slotsToDisplay = getFilteredSlotsForPeriod();

                      if (slotsToDisplay.length === 0) {
                        const selectedNormalized = normalizeDate(selectedDate);
                        const todayNormalized = normalizeDate(getCurrentServerTime());
                        const tomorrowTime = new Date(getCurrentServerTime().getTime() + 24 * 60 * 60 * 1000);
                        const tomorrowNormalized = normalizeDate(tomorrowTime);

                        const isTodayVal = (selectedNormalized === todayNormalized);
                        const isTomorrowVal = (selectedNormalized === tomorrowNormalized);
                        
                        let dateLabel = '';
                        if (isTodayVal) {
                          dateLabel = 'today';
                        } else if (isTomorrowVal) {
                          dateLabel = 'tomorrow';
                        } else {
                          const parts = selectedNormalized.split('-');
                          const y = parseInt(parts[0], 10);
                          const m = parseInt(parts[1], 10) - 1;
                          const d = parseInt(parts[2], 10);
                          const dateObj = new Date(y, m, d);
                          const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                          dateLabel = weekdays[dateObj.getDay()];
                        }

                        const mainText = `Sorry, we're fully booked for ${dateLabel}. Our trainers are in high demand and unfortunately, we don't have any sessions available ${isTodayVal ? 'today' : 'on this date'}.`;
                        const subText = `Try ${isTodayVal ? 'tomorrow or choose ' : ''}another date to find an available session.`;

                        return (
                          <View 
                            className="bg-white border border-[#E5E7EB] p-8 rounded-[28px] items-center gap-6 mt-2 shadow-sm"
                            style={{
                              shadowColor: '#101828',
                              shadowOffset: { width: 0, height: 2 },
                              shadowOpacity: 0.02,
                              shadowRadius: 6,
                              elevation: 1
                            }}
                          >
                            <View className="w-16 h-16 rounded-full bg-amber-50 items-center justify-center">
                              <Feather name="flame" size={30} color="#F59E0B" />
                            </View>
                            <View className="items-center gap-2">
                              <Text className="text-zinc-900 text-[10px] font-black uppercase tracking-widest text-center">
                                WE&apos;RE IN HIGH DEMAND
                              </Text>
                              <Text className="text-[#101828] text-base font-black tracking-tight text-center mt-1">
                                Fully Booked
                              </Text>
                              <Text className="text-[#6B7280] text-[11px] font-semibold leading-relaxed text-center max-w-[90%] mt-1">
                                {mainText}
                              </Text>
                              <Text className="text-zinc-400 text-[10px] font-bold text-center max-w-[90%] mt-1">
                                {subText}
                              </Text>
                            </View>
                            <View className="w-full gap-3">
                              <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={() => {
                                  Alert.alert('Notification Set 🔔', `We will alert you as soon as a coach for ${selectedExperience?.title || 'this workout'} becomes available on this date.`);
                                }}
                                className="bg-[#101828] py-4 rounded-xl items-center justify-center"
                              >
                                <Text className="text-white text-xs font-black uppercase tracking-wider">Notify Me</Text>
                              </TouchableOpacity>
                              
                              <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={() => triggerTransition(1)}
                                className="bg-zinc-50 border border-zinc-200 py-4 rounded-xl items-center justify-center"
                              >
                                <Text className="text-zinc-800 text-xs font-black uppercase tracking-wider">Try Another Workout</Text>
                              </TouchableOpacity>

                              {trainerPref === 'favourite' && (
                                <TouchableOpacity
                                  activeOpacity={0.8}
                                  onPress={() => triggerTransition(2)}
                                  className="bg-zinc-50 border border-zinc-200 py-4 rounded-xl items-center justify-center"
                                >
                                  <Text className="text-zinc-800 text-xs font-black uppercase tracking-wider">Change Trainer Preference</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                        );
                      }

                      return (
                        <View className="gap-3.5">
                          {slotsToDisplay.map((slotObj, idx) => {
                            const isPicked = selectedTime === slotObj.time;
                            const isDisabled = !!slotObj.isBooked;
                            const displayTime = getCustomerDisplayTime(slotObj.time);

                            return (
                              <TouchableOpacity
                                key={idx}
                                disabled={isDisabled}
                                activeOpacity={isDisabled ? 1 : 0.8}
                                onPress={() => {
                                  if (isPicked) {
                                    setSelectedTime('');
                                  } else {
                                    handleSelectSlot(slotObj.time, slotObj.trainers || []);
                                  }
                                }}
                                style={{
                                  height: 80,
                                  shadowColor: '#101828',
                                  shadowOffset: { width: 0, height: 2 },
                                  shadowOpacity: isPicked ? 0.12 : 0.03,
                                  shadowRadius: 8,
                                  elevation: 2,
                                }}
                                className={`px-5 rounded-2xl border flex-row justify-between items-center ${
                                  isDisabled
                                    ? 'bg-zinc-50 border-zinc-200 opacity-60'
                                    : isPicked
                                    ? 'bg-[#E11D48] border-[#E11D48]'
                                    : 'bg-white border-[#E5E7EB]'
                                }`}
                              >
                                <View className="flex-row items-center gap-4">
                                  <View className={`w-8 h-8 rounded-full items-center justify-center ${
                                    isDisabled ? 'bg-zinc-100' : isPicked ? 'bg-white/20' : 'bg-rose-50'
                                  }`}>
                                    <Feather 
                                      name="clock" 
                                      size={14} 
                                      color={isDisabled ? '#9CA3AF' : isPicked ? 'white' : '#E11D48'} 
                                    />
                                  </View>
                                  <View className="gap-1">
                                    <View className="flex-row items-center gap-2">
                                      <Text 
                                        className={`text-sm font-extrabold tracking-tight ${
                                          isDisabled ? 'text-zinc-400 line-through' : isPicked ? 'text-white' : 'text-zinc-900'
                                        }`}
                                      >
                                        {displayTime}
                                      </Text>
                                      <View className={`px-2 py-0.5 rounded-md ${
                                        isPicked ? 'bg-white/20' : 'bg-zinc-100'
                                      }`}>
                                        <Text className={`text-[8px] font-extrabold tracking-wider ${
                                          isPicked ? 'text-white' : 'text-zinc-500'
                                        }`}>1 HR SESSION</Text>
                                      </View>
                                    </View>
                                    <Text className={`text-[9px] font-black tracking-wider uppercase ${
                                      isPicked ? 'text-rose-100' : 'text-[#6B7280]'
                                    }`}>
                                      {isDisabled ? 'UNAVAILABLE' : 'AVAILABLE'}
                                    </Text>
                                  </View>
                                </View>
                                
                                {/* Right badge or checkmark indicator */}
                                <View className="flex-row items-center gap-2">
                                  {isPicked ? (
                                    <View className="w-6 h-6 rounded-full bg-white items-center justify-center">
                                      <Feather name="check" size={14} color="#E11D48" />
                                    </View>
                                  ) : isDisabled ? (
                                    <Text className="text-zinc-400 text-[10px] font-black uppercase tracking-wider">FULL</Text>
                                  ) : (
                                    <View className="w-6 h-6 rounded-full border border-zinc-200 bg-zinc-50" />
                                  )}
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      );
                    })()}
                    </ScrollView>
                  </View>
                </View>
              )}

              {/* STEP 5: HEALTH & SAFETY QUESTIONNAIRE */}
              {step === 5 && (
                <View className="gap-6 pb-28">
                  {/* Header Title Section */}
                  <View>
                    <View className="flex-row items-center gap-1.5 mb-1">
                      <Text className="text-[#E11D48] text-xs font-black uppercase tracking-[1.8px]">
                        YOUR SAFETY COMES FIRST
                      </Text>
                      <Text className="text-sm">❤️</Text>
                    </View>
                    <Text className="text-zinc-950 text-2xl font-black tracking-tight leading-tight">
                      Let’s personalise your workout
                    </Text>
                    <Text className="text-zinc-500 text-sm font-normal mt-1.5 leading-relaxed">
                      Help us understand your fitness routine and health needs so your trainer can prepare a suitable session.
                    </Text>
                  </View>

                  {/* Question 1: Workout Frequency (Radio - Select one) */}
                  <View className={`bg-white border p-5 rounded-[24px] shadow-2xs gap-3.5 ${
                    healthValidationErrors.workoutFrequency ? 'border-rose-400 bg-rose-50/20' : 'border-[#E5E7EB]'
                  }`}>
                    <View>
                      <Text className="text-zinc-900 text-sm font-bold tracking-tight">
                        1. How often do you work out?
                      </Text>
                      <Text className="text-zinc-400 text-xs font-medium mt-0.5">
                        Select one.
                      </Text>
                      {healthValidationErrors.workoutFrequency && (
                        <View className="flex-row items-center gap-1.5 mt-1.5">
                          <Feather name="alert-circle" size={12} color="#E11D48" />
                          <Text className="text-[#E11D48] text-[11px] font-semibold">
                            {healthValidationErrors.workoutFrequency}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View className="gap-2">
                      {[
                        'Rarely or never',
                        '1–2 days a week',
                        '3–4 days a week',
                        '5 or more days a week',
                      ].map((opt) => {
                        const isSelected = workoutFrequency === opt;
                        return (
                          <TouchableOpacity
                            key={opt}
                            activeOpacity={0.75}
                            onPress={() => {
                              setWorkoutFrequency(opt);
                              if (healthValidationErrors.workoutFrequency) {
                                setHealthValidationErrors(prev => {
                                  const n = { ...prev };
                                  delete n.workoutFrequency;
                                  return n;
                                });
                              }
                            }}
                            className={`flex-row items-center justify-between p-3.5 rounded-2xl border transition-all ${
                              isSelected
                                ? 'bg-rose-50/60 border-[#E11D48]'
                                : 'bg-zinc-50/60 border-zinc-200/80'
                            }`}
                          >
                            <Text
                              className={`text-xs font-semibold ${
                                isSelected ? 'text-zinc-950 font-bold' : 'text-zinc-700'
                              }`}
                            >
                              {opt}
                            </Text>
                            <View
                              className={`w-5 h-5 rounded-full items-center justify-center border ${
                                isSelected
                                  ? 'border-[#E11D48] bg-[#E11D48]'
                                  : 'border-zinc-300 bg-white'
                              }`}
                            >
                              {isSelected && (
                                <View className="w-2 h-2 rounded-full bg-white" />
                              )}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Question 2: Injuries or Pain (Checkbox - Select all that apply) */}
                  <View className={`bg-white border p-5 rounded-[24px] shadow-2xs gap-3.5 ${
                    (healthValidationErrors.injuriesOrPain || healthValidationErrors.otherInjury) ? 'border-rose-400 bg-rose-50/20' : 'border-[#E5E7EB]'
                  }`}>
                    <View>
                      <Text className="text-zinc-900 text-sm font-bold tracking-tight">
                        2. Do you currently have any injuries or pain?
                      </Text>
                      <Text className="text-zinc-400 text-xs font-medium mt-0.5">
                        Select all that apply.
                      </Text>
                      {healthValidationErrors.injuriesOrPain && (
                        <View className="flex-row items-center gap-1.5 mt-1.5">
                          <Feather name="alert-circle" size={12} color="#E11D48" />
                          <Text className="text-[#E11D48] text-[11px] font-semibold">
                            {healthValidationErrors.injuriesOrPain}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View className="gap-2">
                      {[
                        'No injuries or pain',
                        'Back or neck pain',
                        'Knee or joint pain',
                        'Shoulder or wrist injury',
                        'Muscle injury or strain',
                        'Other injury or pain',
                      ].map((opt) => {
                        const isSelected = injuriesOrPain.includes(opt);
                        return (
                          <TouchableOpacity
                            key={opt}
                            activeOpacity={0.75}
                            onPress={() => {
                              if (healthValidationErrors.injuriesOrPain) {
                                setHealthValidationErrors(prev => {
                                  const n = { ...prev };
                                  delete n.injuriesOrPain;
                                  return n;
                                });
                              }
                              if (opt === 'No injuries or pain') {
                                setInjuriesOrPain(['No injuries or pain']);
                                setOtherInjuryText('');
                              } else {
                                const filtered = injuriesOrPain.filter(
                                  (item) => item !== 'No injuries or pain'
                                );
                                if (isSelected) {
                                  const next = filtered.filter((item) => item !== opt);
                                  setInjuriesOrPain(
                                    next.length > 0 ? next : ['No injuries or pain']
                                  );
                                  if (opt === 'Other injury or pain') {
                                    setOtherInjuryText('');
                                  }
                                } else {
                                  setInjuriesOrPain([...filtered, opt]);
                                }
                              }
                            }}
                            className={`flex-row items-center justify-between p-3.5 rounded-2xl border ${
                              isSelected
                                ? 'bg-rose-50/60 border-[#E11D48]'
                                : 'bg-zinc-50/60 border-zinc-200/80'
                            }`}
                          >
                            <Text
                              className={`text-xs font-semibold ${
                                isSelected ? 'text-zinc-950 font-bold' : 'text-zinc-700'
                              }`}
                            >
                              {opt}
                            </Text>
                            <View
                              className={`w-5 h-5 rounded-md items-center justify-center border ${
                                isSelected
                                  ? 'border-[#E11D48] bg-[#E11D48]'
                                  : 'border-zinc-300 bg-white'
                              }`}
                            >
                              {isSelected && (
                                <Feather name="check" size={13} color="#FFFFFF" />
                              )}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Inline Input Box for "Other injury or pain" */}
                    {injuriesOrPain.includes('Other injury or pain') && (
                      <View className="mt-1 gap-1.5">
                        <Text className="text-zinc-700 text-xs font-semibold">
                          Specify injury or pain details <Text className="text-rose-500">*</Text>
                        </Text>
                        <TextInput
                          value={otherInjuryText}
                          onChangeText={(txt) => {
                            setOtherInjuryText(txt);
                            if (healthValidationErrors.otherInjury && txt.trim()) {
                              setHealthValidationErrors(prev => {
                                const n = { ...prev };
                                delete n.otherInjury;
                                return n;
                              });
                            }
                          }}
                          placeholder="e.g. Lower back stiffness, right ankle sprain"
                          placeholderTextColor="#9CA3AF"
                          className={`bg-zinc-50 border p-3.5 rounded-2xl text-xs font-medium text-zinc-900 ${
                            healthValidationErrors.otherInjury ? 'border-rose-400 bg-rose-50/40' : 'border-zinc-200/90'
                          }`}
                          maxLength={120}
                        />
                        {healthValidationErrors.otherInjury && (
                          <View className="flex-row items-center gap-1.5 pl-1">
                            <Feather name="alert-circle" size={12} color="#E11D48" />
                            <Text className="text-[#E11D48] text-[11px] font-semibold">
                              {healthValidationErrors.otherInjury}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>

                  {/* Question 3: Health Conditions (Checkbox - Select all that apply) */}
                  <View className={`bg-white border p-5 rounded-[24px] shadow-2xs gap-3.5 ${
                    (healthValidationErrors.healthConditions || healthValidationErrors.otherHealth) ? 'border-rose-400 bg-rose-50/20' : 'border-[#E5E7EB]'
                  }`}>
                    <View>
                      <Text className="text-zinc-900 text-sm font-bold tracking-tight">
                        3. Do you have any health conditions your trainer should know about?
                      </Text>
                      <Text className="text-zinc-400 text-xs font-medium mt-0.5">
                        Select all that apply.
                      </Text>
                      {healthValidationErrors.healthConditions && (
                        <View className="flex-row items-center gap-1.5 mt-1.5">
                          <Feather name="alert-circle" size={12} color="#E11D48" />
                          <Text className="text-[#E11D48] text-[11px] font-semibold">
                            {healthValidationErrors.healthConditions}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View className="gap-2">
                      {[
                        'None',
                        'Heart or blood pressure condition',
                        'Asthma or breathing condition',
                        'Diabetes',
                        'Other health condition',
                        'Prefer not to say',
                      ].map((opt) => {
                        const isSelected = healthConditions.includes(opt);
                        return (
                          <TouchableOpacity
                            key={opt}
                            activeOpacity={0.75}
                            onPress={() => {
                              if (healthValidationErrors.healthConditions) {
                                setHealthValidationErrors(prev => {
                                  const n = { ...prev };
                                  delete n.healthConditions;
                                  return n;
                                });
                              }
                              if (opt === 'None' || opt === 'Prefer not to say') {
                                setHealthConditions([opt]);
                                setOtherHealthText('');
                              } else {
                                const filtered = healthConditions.filter(
                                  (item) => item !== 'None' && item !== 'Prefer not to say'
                                );
                                if (isSelected) {
                                  const next = filtered.filter((item) => item !== opt);
                                  setHealthConditions(
                                    next.length > 0 ? next : ['None']
                                  );
                                  if (opt === 'Other health condition') {
                                    setOtherHealthText('');
                                  }
                                } else {
                                  setHealthConditions([...filtered, opt]);
                                }
                              }
                            }}
                            className={`flex-row items-center justify-between p-3.5 rounded-2xl border ${
                              isSelected
                                ? 'bg-rose-50/60 border-[#E11D48]'
                                : 'bg-zinc-50/60 border-zinc-200/80'
                            }`}
                          >
                            <Text
                              className={`text-xs font-semibold ${
                                isSelected ? 'text-zinc-950 font-bold' : 'text-zinc-700'
                              }`}
                            >
                              {opt}
                            </Text>
                            <View
                              className={`w-5 h-5 rounded-md items-center justify-center border ${
                                isSelected
                                  ? 'border-[#E11D48] bg-[#E11D48]'
                                  : 'border-zinc-300 bg-white'
                              }`}
                            >
                              {isSelected && (
                                <Feather name="check" size={13} color="#FFFFFF" />
                              )}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Inline Input Box for "Other health condition" */}
                    {healthConditions.includes('Other health condition') && (
                      <View className="mt-1 gap-1.5">
                        <Text className="text-zinc-700 text-xs font-semibold">
                          Specify health condition details <Text className="text-rose-500">*</Text>
                        </Text>
                        <TextInput
                          value={otherHealthText}
                          onChangeText={(txt) => {
                            setOtherHealthText(txt);
                            if (healthValidationErrors.otherHealth && txt.trim()) {
                              setHealthValidationErrors(prev => {
                                const n = { ...prev };
                                delete n.otherHealth;
                                return n;
                              });
                            }
                          }}
                          placeholder="e.g. Hypertension, vertigo, post-surgery recovery"
                          placeholderTextColor="#9CA3AF"
                          className={`bg-zinc-50 border p-3.5 rounded-2xl text-xs font-medium text-zinc-900 ${
                            healthValidationErrors.otherHealth ? 'border-rose-400 bg-rose-50/40' : 'border-zinc-200/90'
                          }`}
                          maxLength={120}
                        />
                        {healthValidationErrors.otherHealth && (
                          <View className="flex-row items-center gap-1.5 pl-1">
                            <Feather name="alert-circle" size={12} color="#E11D48" />
                            <Text className="text-[#E11D48] text-[11px] font-semibold">
                              {healthValidationErrors.otherHealth}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>

                  {/* Question 4: Doctor Advice (Radio - Select one) */}
                  <View className={`bg-white border p-5 rounded-[24px] shadow-2xs gap-3.5 ${
                    healthValidationErrors.doctorAdvice ? 'border-rose-400 bg-rose-50/20' : 'border-[#E5E7EB]'
                  }`}>
                    <View>
                      <Text className="text-zinc-900 text-sm font-bold tracking-tight">
                        4. Has a doctor advised you to avoid any exercises or physical activities?
                      </Text>
                      <Text className="text-zinc-400 text-xs font-medium mt-0.5">
                        Select one.
                      </Text>
                      {healthValidationErrors.doctorAdvice && (
                        <View className="flex-row items-center gap-1.5 mt-1.5">
                          <Feather name="alert-circle" size={12} color="#E11D48" />
                          <Text className="text-[#E11D48] text-[11px] font-semibold">
                            {healthValidationErrors.doctorAdvice}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View className="gap-2">
                      {[
                        'No',
                        'Yes',
                        'Not sure',
                        'Prefer not to say',
                      ].map((opt) => {
                        const isSelected = doctorAdvice === opt;
                        return (
                          <TouchableOpacity
                            key={opt}
                            activeOpacity={0.75}
                            onPress={() => {
                              setDoctorAdvice(opt);
                              if (healthValidationErrors.doctorAdvice) {
                                setHealthValidationErrors(prev => {
                                  const n = { ...prev };
                                  delete n.doctorAdvice;
                                  return n;
                                });
                              }
                            }}
                            className={`flex-row items-center justify-between p-3.5 rounded-2xl border ${
                              isSelected
                                ? 'bg-rose-50/60 border-[#E11D48]'
                                : 'bg-zinc-50/60 border-zinc-200/80'
                            }`}
                          >
                            <Text
                              className={`text-xs font-semibold ${
                                isSelected ? 'text-zinc-950 font-bold' : 'text-zinc-700'
                              }`}
                            >
                              {opt}
                            </Text>
                            <View
                              className={`w-5 h-5 rounded-full items-center justify-center border ${
                                isSelected
                                  ? 'border-[#E11D48] bg-[#E11D48]'
                                  : 'border-zinc-300 bg-white'
                              }`}
                            >
                              {isSelected && (
                                <View className="w-2 h-2 rounded-full bg-white" />
                              )}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Question 5: Additional note for trainer */}
                  <View className="bg-white border border-[#E5E7EB] p-5 rounded-[24px] shadow-2xs gap-3">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-zinc-900 text-sm font-bold tracking-tight">
                        5. Is there anything else your trainer should know?
                      </Text>
                      <Text className="text-zinc-400 text-xs font-semibold">
                        Optional
                      </Text>
                    </View>
                    <View className={`bg-zinc-50 border rounded-2xl p-3.5 ${
                      healthValidationErrors.safetyNotes ? 'border-rose-400 bg-rose-50/40' : 'border-zinc-200/90'
                    }`}>
                      <TextInput
                        multiline
                        numberOfLines={3}
                        value={safetyNotes}
                        onChangeText={(txt) => {
                          setSafetyNotes(txt);
                          if (txt.length <= 250 && healthValidationErrors.safetyNotes) {
                            setHealthValidationErrors(prev => {
                              const n = { ...prev };
                              delete n.safetyNotes;
                              return n;
                            });
                          }
                        }}
                        placeholder="Add a note (e.g. recovering from mild shoulder strain, prefers low impact)"
                        placeholderTextColor="#9CA3AF"
                        className="text-zinc-900 text-xs font-medium h-16 text-start"
                        style={{ minHeight: 60, padding: 0, textAlignVertical: 'top' }}
                        maxLength={250}
                      />
                      <Text className={`text-right text-[10px] font-medium mt-1 ${
                        safetyNotes.length >= 240 ? 'text-rose-500 font-bold' : 'text-zinc-400'
                      }`}>
                        {safetyNotes.length}/250
                      </Text>
                    </View>
                    {healthValidationErrors.safetyNotes && (
                      <View className="flex-row items-center gap-1.5 pl-1">
                        <Feather name="alert-circle" size={12} color="#E11D48" />
                        <Text className="text-[#E11D48] text-[11px] font-semibold">
                          {healthValidationErrors.safetyNotes}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Trust Banner */}
                  <View className="bg-zinc-100/70 border border-zinc-200/70 p-4 rounded-2xl flex-row items-start gap-2.5">
                    <Feather name="shield" size={16} color="#E11D48" style={{ marginTop: 2 }} />
                    <Text className="text-zinc-600 text-xs font-medium flex-1 leading-5">
                      Your safety matters. Please share any relevant health concerns or exercise restrictions with your trainer before your session.
                    </Text>
                  </View>

                  {/* Save & Continue Primary Action */}
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleNext}
                    style={{
                      backgroundColor: '#E11D48',
                      height: 52,
                      borderRadius: 26,
                      shadowColor: '#E11D48',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.28,
                      shadowRadius: 10,
                      elevation: 4,
                    }}
                    className="w-full items-center justify-center flex-row gap-2 mt-1"
                  >
                    <Text className="text-white text-xs font-black uppercase tracking-wider">
                      SAVE & CONTINUE
                    </Text>
                    <Feather name="arrow-right" size={15} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              )}

              {/* STEP 6: REVIEW & CONFIRM */}
              {step === 6 && (
                <View className="gap-6 pb-6">
                  {/* Reservation countdown warning alert */}
                  {reservationTimeLeft > 0 && (
                    <View className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl flex-row items-center justify-between shadow-sm">
                      <View className="flex-row items-center gap-2">
                        <Feather name="clock" size={15} color="#D97706" />
                        <Text className="text-amber-800 text-xs font-medium">
                          Slot reserved. Complete checkout in:
                        </Text>
                      </View>
                      <Text className="text-amber-900 text-sm font-bold tracking-wide">
                        {Math.floor(reservationTimeLeft / 60)}:{(reservationTimeLeft % 60).toString().padStart(2, '0')}
                      </Text>
                    </View>
                  )}

                  {/* Section 1 — Booking Summary Card */}
                  <View 
                    className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4"
                    style={{
                      shadowColor: '#101828',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.02,
                      shadowRadius: 6,
                      elevation: 1,
                    }}
                  >
                    {/* Card Header: Calendar Icon, Title, Edit Button */}
                    <View className="flex-row justify-between items-center">
                      <View className="flex-row items-center gap-2.5">
                        <View className="w-8 h-8 rounded-full bg-rose-50 items-center justify-center">
                          <Feather name="calendar" size={14} color="#E11D48" />
                        </View>
                        <Text className="text-zinc-900 text-sm font-bold tracking-tight">Booking Summary</Text>
                      </View>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => triggerTransition(1)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        className="bg-rose-50 border border-rose-100 rounded-xl px-3 py-1.5 flex-row items-center gap-1.5"
                      >
                        <Feather name="edit-2" size={12} color="#E11D48" />
                        <Text className="text-[#E11D48] text-xs font-semibold">Edit</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Workout Info: Thumbnail, Title, Solo Badge */}
                    <View className="flex-row gap-4 items-center mt-1">
                      <Image 
                        source={{ uri: getWorkoutImage(selectedExperience?.id || 'exp-strength') }} 
                        className="w-20 h-20 rounded-[20px] bg-zinc-50 border border-zinc-100" 
                      />
                      <View className="flex-1 gap-1.5">
                        <Text className="text-[#101828] text-base font-bold tracking-tight">{selectedExperience?.title || 'Workout Session'}</Text>
                        <View className="flex-row">
                          <View className="bg-rose-50 border border-rose-100 px-2.5 py-1 rounded-full flex-row items-center gap-1.5">
                            <Feather name="user" size={10} color="#E11D48" />
                            <Text className="text-[#E11D48] text-[11px] font-semibold">Solo Session</Text>
                          </View>
                        </View>
                      </View>
                    </View>

                    {/* Summary Row Items */}
                    <View className="mt-2">
                      {/* Date Row */}
                      <View className="border-t border-dashed border-[#E5E7EB] py-3.5 flex-row justify-between items-center">
                        <View className="flex-row items-center gap-2">
                          <Feather name="calendar" size={15} color="#6B7280" />
                          <Text className="text-[#6B7280] text-[13px] font-medium">Date</Text>
                        </View>
                        <Text className="text-[#101828] text-[13px] font-bold">{getFormattedDateLabel()}</Text>
                      </View>

                      {/* Time Row */}
                      <View className="border-t border-dashed border-[#E5E7EB] py-3.5 flex-row justify-between items-center">
                        <View className="flex-row items-center gap-2">
                          <Feather name="clock" size={15} color="#6B7280" />
                          <Text className="text-[#6B7280] text-[13px] font-medium">Time</Text>
                        </View>
                        <Text className="text-[#101828] text-[13px] font-bold">
                          {getCustomerDisplayTime(selectedTime)} <Text className="text-[#6B7280] font-normal">({selectedExperience?.duration || 60} min)</Text>
                        </Text>
                      </View>

                      {/* Trainer Preference Row */}
                      <View className="border-t border-dashed border-[#E5E7EB] py-3.5 flex-row justify-between items-center">
                        <View className="flex-row items-center gap-2">
                          <Feather name="user" size={15} color="#6B7280" />
                          <Text className="text-[#6B7280] text-[13px] font-medium">Trainer Preference</Text>
                        </View>
                        <Text className="text-[#101828] text-[13px] font-bold">
                          {trainerPref === 'any' ? 'No Preference' : trainerPref === 'female' ? 'Female Trainer' : trainerPref === 'male' ? 'Male Trainer' : 'Favorite Trainer'}
                        </Text>
                      </View>

                      {/* Location Row */}
                      <View className="border-t border-dashed border-[#E5E7EB] py-3.5 flex-row justify-between items-start">
                        <View className="flex-row items-center gap-2 mt-0.5">
                          <Feather name="map-pin" size={15} color="#6B7280" />
                          <Text className="text-[#6B7280] text-[13px] font-medium">Location</Text>
                        </View>
                        <Text className="text-[#101828] text-[13px] font-bold max-w-[60%] text-right leading-relaxed">
                          {addresses.find(a => a.id === selectedAddressId)?.addressLine || 'Selected Location'}
                        </Text>
                      </View>

                      {/* Credits Row */}
                      <View className="border-t border-dashed border-[#E5E7EB] pt-3.5 flex-row justify-between items-center">
                        <View className="flex-row items-center gap-2">
                          <Feather name="credit-card" size={15} color="#6B7280" />
                          <Text className="text-[#6B7280] text-[13px] font-medium">Credits</Text>
                        </View>
                        <Text className="text-[#101828] text-[13px] font-bold">1 Credit will be used</Text>
                      </View>
                    </View>
                  </View>

                  {/* About Your Health Summary Card */}
                  <View
                    className="bg-white border border-[#E5E7EB] p-4.5 rounded-[24px] shadow-2xs gap-3"
                    style={{
                      shadowColor: '#101828',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.02,
                      shadowRadius: 6,
                      elevation: 1,
                    }}
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-2">
                        <View className="w-7 h-7 rounded-full bg-rose-50 items-center justify-center">
                          <Feather name="heart" size={13} color="#E11D48" />
                        </View>
                        <Text className="text-zinc-900 text-[13px] font-bold tracking-tight">
                          About your health
                        </Text>
                      </View>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => setShowHealthDetailsModal(true)}
                        className="px-2.5 py-1 rounded-full bg-rose-50 border border-rose-100"
                      >
                        <Text className="text-[#E11D48] text-[11px] font-black uppercase tracking-wider">
                          View All
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <Text className="text-zinc-500 text-xs font-normal leading-relaxed">
                      Workout: {workoutFrequency} • Pain: {injuriesOrPain.join(', ')}
                    </Text>
                  </View>

                  {/* Section 2 — Note to Your Trainer (Optional) */}
                  <View className="gap-3 mt-1">
                    {/* Header: Clipboard Icon, Title, Subtitle */}
                    <View className="flex-row gap-3 items-center">
                      <View className="w-9 h-9 rounded-full bg-rose-50 items-center justify-center">
                        <Feather name="edit-3" size={16} color="#E11D48" />
                      </View>
                      <View className="flex-1">
                        <View className="flex-row items-center gap-1.5">
                          <Text className="text-[#101828] text-sm font-bold tracking-tight">Note to Your Trainer</Text>
                          <Text className="text-[#6B7280] text-xs font-medium">(Optional)</Text>
                        </View>
                        <Text className="text-[#6B7280] text-xs font-normal mt-0.5">Share anything that will help your trainer prepare better.</Text>
                      </View>
                    </View>

                    {/* Chips horizontal scroll */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2 mt-1 py-1" contentContainerStyle={{ gap: 8 }}>
                      {[
                        { label: 'I have yoga mat', icon: 'award' },
                        { label: 'I have injury', icon: 'activity' },
                        { label: 'Security gate access', icon: 'shield' },
                        { label: 'Bring resistance bands', icon: 'gift' },
                        { label: 'Other', icon: 'chevron-down' }
                      ].map((chip) => {
                        const isSelected = trainerNote.includes(chip.label);
                        return (
                          <TouchableOpacity
                            key={chip.label}
                            activeOpacity={0.8}
                            onPress={() => handleChipPress(chip.label)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            className={`px-3.5 py-2 rounded-full border flex-row items-center gap-1.5 ${
                              isSelected ? 'bg-rose-100/80 border-rose-300' : 'bg-rose-50/50 border-rose-100'
                            }`}
                          >
                            <Feather name={chip.icon as any} size={12} color="#E11D48" />
                            <Text className="text-[#E11D48] text-xs font-semibold">{chip.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>

                    {/* Multiline text box */}
                    <View className="relative bg-white border border-[#E5E7EB] rounded-2xl p-4 mt-0.5">
                      <TextInput
                        ref={noteInputRef}
                        multiline
                        numberOfLines={4}
                        value={trainerNote}
                        onChangeText={(text) => {
                          if (text.length <= 250) {
                            setTrainerNote(text);
                          }
                        }}
                        placeholder="Anything else your trainer should know..."
                        placeholderTextColor="#9CA3AF"
                        className="text-[#101828] text-sm font-medium h-20 text-start"
                        style={{ minHeight: 80, padding: 0, textAlignVertical: 'top' }}
                        maxLength={250}
                      />
                      <Text className="text-right text-[#9CA3AF] text-xs font-medium mt-1">
                        {trainerNote.length}/250
                      </Text>
                    </View>
                  </View>

                  {/* Section 3 — Session Policies Card */}
                  <View 
                    className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4 mt-1"
                    style={{
                      shadowColor: '#101828',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.02,
                      shadowRadius: 6,
                      elevation: 1,
                    }}
                  >
                    {/* Header: Shield Icon, Title & View Details button */}
                    <View className="flex-row justify-between items-center">
                      <View className="flex-row items-center gap-2.5 flex-1 pr-2">
                        <View className="w-8 h-8 rounded-full bg-amber-50 items-center justify-center">
                          <Feather name="shield" size={15} color="#D97706" />
                        </View>
                        <View className="flex-1">
                          <Text className="text-zinc-900 text-sm font-bold tracking-tight">Session Policies</Text>
                          <Text className="text-zinc-500 text-xs font-normal mt-0.5">Cancellation, safety & session rules</Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => router.push('/legal-center')}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-1.5 flex-row items-center gap-1"
                      >
                        <Text className="text-zinc-700 text-xs font-semibold">View Details</Text>
                        <Feather name="chevron-right" size={12} color="#6B7280" />
                      </TouchableOpacity>
                    </View>

                    {/* 2x2 Highlights Grid */}
                    <View className="bg-zinc-50/80 border border-zinc-100 rounded-2xl p-3 gap-2.5">
                      <View className="flex-row gap-2.5">
                        <View className="flex-1 bg-white border border-zinc-200/80 p-2.5 rounded-xl flex-row items-center gap-2.5">
                          <View className="w-7 h-7 rounded-lg bg-indigo-50 items-center justify-center">
                            <Feather name="clock" size={13} color="#4F46E5" />
                          </View>
                          <View className="flex-1">
                            <Text className="text-zinc-900 text-xs font-bold leading-tight">15 Min Grace</Text>
                            <Text className="text-zinc-500 text-[10px] font-normal leading-tight mt-0.5">Preparation window</Text>
                          </View>
                        </View>

                        <View className="flex-1 bg-white border border-zinc-200/80 p-2.5 rounded-xl flex-row items-center gap-2.5">
                          <View className="w-7 h-7 rounded-lg bg-emerald-50 items-center justify-center">
                            <Feather name="activity" size={13} color="#059669" />
                          </View>
                          <View className="flex-1">
                            <Text className="text-zinc-900 text-xs font-bold leading-tight">60 Min Workout</Text>
                            <Text className="text-zinc-500 text-[10px] font-normal leading-tight mt-0.5">Starts after OTP</Text>
                          </View>
                        </View>
                      </View>

                      <View className="flex-row gap-2.5">
                        <View className="flex-1 bg-white border border-zinc-200/80 p-2.5 rounded-xl flex-row items-center gap-2.5">
                          <View className="w-7 h-7 rounded-lg bg-rose-50 items-center justify-center">
                            <Feather name="shield" size={13} color="#E11D48" />
                          </View>
                          <View className="flex-1">
                            <Text className="text-zinc-900 text-xs font-bold leading-tight">Fair & Clear</Text>
                            <Text className="text-zinc-500 text-[10px] font-normal leading-tight mt-0.5">Transparent policy</Text>
                          </View>
                        </View>

                        <View className="flex-1 bg-white border border-zinc-200/80 p-2.5 rounded-xl flex-row items-center gap-2.5">
                          <View className="w-7 h-7 rounded-lg bg-purple-50 items-center justify-center">
                            <Feather name="lock" size={13} color="#7C3AED" />
                          </View>
                          <View className="flex-1">
                            <Text className="text-zinc-900 text-xs font-bold leading-tight">Secure & Private</Text>
                            <Text className="text-zinc-500 text-[10px] font-normal leading-tight mt-0.5">Safety guaranteed</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Confirm Booking Primary Action */}
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleConfirmBooking}
                    disabled={isConfirming}
                    className="w-full bg-[#E11D48] items-center justify-center flex-row gap-2 mt-4"
                    style={{
                      height: 56,
                      borderRadius: 16,
                      shadowColor: '#E11D48',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.15,
                      shadowRadius: 8,
                      elevation: 3,
                    }}
                  >
                    {isConfirming ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <>
                        <Text className="text-white text-base font-bold">Confirm Booking</Text>
                        <Feather name="chevron-right" size={18} color="white" />
                      </>
                    )}
                  </TouchableOpacity>

                  {/* Secure booking guarantee lock label */}
                  <View className="flex-row items-center justify-center gap-1.5 mt-1.5">
                    <Feather name="lock" size={13} color="#9CA3AF" />
                    <Text className="text-[#9CA3AF] text-xs font-medium">Your booking is 100% secure</Text>
                  </View>
                </View>
              )}

              {/* Health & Safety Details Modal */}
              <Modal
                visible={showHealthDetailsModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowHealthDetailsModal(false)}
              >
                <View className="flex-1 bg-black/60 justify-end">
                  <View 
                    style={{ maxHeight: '82%', paddingBottom: Math.max(insets.bottom, 20) }}
                    className="bg-white rounded-t-[32px] p-6 shadow-2xl"
                  >
                    {/* Modal Header */}
                    <View className="flex-row items-center justify-between pb-4 border-b border-zinc-100">
                      <View className="flex-row items-center gap-2">
                        <View className="w-8 h-8 rounded-full bg-rose-50 items-center justify-center">
                          <Feather name="heart" size={15} color="#E11D48" />
                        </View>
                        <Text className="text-zinc-950 text-base font-black tracking-tight">
                          Health & Safety Details
                        </Text>
                      </View>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => setShowHealthDetailsModal(false)}
                        className="w-8 h-8 rounded-full bg-zinc-100 items-center justify-center"
                      >
                        <Feather name="x" size={16} color="#71717A" />
                      </TouchableOpacity>
                    </View>

                    {/* Modal Content */}
                    <ScrollView showsVerticalScrollIndicator={false} className="mt-4 gap-4">
                      <View className="bg-zinc-50 border border-zinc-200/80 p-4 rounded-2xl gap-1">
                        <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">
                          1. Workout Frequency
                        </Text>
                        <Text className="text-zinc-900 text-xs font-semibold">
                          {workoutFrequency}
                        </Text>
                      </View>

                      <View className="bg-zinc-50 border border-zinc-200/80 p-4 rounded-2xl gap-1">
                        <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">
                          2. Current Injuries or Pain
                        </Text>
                        <Text className="text-zinc-900 text-xs font-semibold">
                          {injuriesOrPain.join(', ')}
                        </Text>
                      </View>

                      <View className="bg-zinc-50 border border-zinc-200/80 p-4 rounded-2xl gap-1">
                        <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">
                          3. Health Conditions
                        </Text>
                        <Text className="text-zinc-900 text-xs font-semibold">
                          {healthConditions.join(', ')}
                        </Text>
                      </View>

                      <View className="bg-zinc-50 border border-zinc-200/80 p-4 rounded-2xl gap-1">
                        <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">
                          4. Doctor Advised Restrictions
                        </Text>
                        <Text className="text-zinc-900 text-xs font-semibold">
                          {doctorAdvice}
                        </Text>
                      </View>

                      {safetyNotes.trim() ? (
                        <View className="bg-zinc-50 border border-zinc-200/80 p-4 rounded-2xl gap-1">
                          <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">
                            5. Additional Safety Note
                          </Text>
                          <Text className="text-zinc-900 text-xs font-semibold">
                            {safetyNotes}
                          </Text>
                        </View>
                      ) : null}

                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => {
                          setShowHealthDetailsModal(false);
                          triggerTransition(5);
                        }}
                        className="py-3 rounded-2xl bg-zinc-100 border border-zinc-200/80 items-center justify-center mt-2"
                      >
                        <Text className="text-zinc-800 text-xs font-bold">
                          Edit Safety Details
                        </Text>
                      </TouchableOpacity>
                    </ScrollView>
                  </View>
                </View>
              </Modal>

              {/* STEP 7: SUCCESS EXPERIENCE */}
              {step === 7 && (
                <BookingSuccessAnimation
                  workoutTitle={selectedExperience?.title || 'Workout Session'}
                  workoutDuration={selectedExperience?.duration || 60}
                  selectedDate={selectedDate}
                  selectedTime={selectedTime}
                  locationAddress={addresses.find(a => a.id === selectedAddressId)?.addressLine || 'Selected Location'}
                  successBookingId={successBookingId}
                  onViewSession={(id) => {
                    router.replace({
                      pathname: '/session-detail',
                      params: { id },
                    });
                  }}
                  onBackToHome={() => {
                    router.replace('/(tabs)');
                  }}
                  onShare={handleShareBooking}
                />
              )}

            </View>
          </ScrollView>
        ) : null}
      </View>
    </KeyboardAvoidingView>

      {/* Footer wizard navigation buttons (Steps 1 to 4) - Animated smooth slide-up red pill button */}
      {step <= 4 && (
        <Animated.View 
          pointerEvents={isContinueVisible ? 'box-none' : 'none'}
          className="absolute left-0 right-0 items-center justify-center"
          style={{
            bottom: Math.max(insets.bottom + 12, Platform.OS === 'android' ? 28 : 20),
            zIndex: 40,
            opacity: continueButtonAnim,
            transform: [
              {
                translateY: continueButtonAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [50, 0],
                }),
              },
            ],
          }}
        >
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleNext}
            style={{
              backgroundColor: '#E11D48', // Virla signature primary red
              height: 44,
              borderRadius: 22, // Curvy pill shape
              paddingHorizontal: 32, // Content-hugging natural width
              shadowColor: '#E11D48',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.32,
              shadowRadius: 8,
              elevation: 5,
            }}
            className="items-center justify-center flex-row gap-2"
          >
            <Text className="text-white text-xs font-black uppercase tracking-wider">
              Continue
            </Text>
            <Feather name="arrow-right" size={14} color="#FFFFFF" />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Floating Top Header: Left Back Button, Center Pill Section, Right Share/Slot status */}
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          top: insets.top + 8,
          left: 16,
          right: 16,
          zIndex: 40,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View 
          pointerEvents="box-none" 
          className="relative flex-row items-center"
          style={{ zIndex: 50 }}
        >
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -6,
              left: -8,
              right: -32,
              bottom: -6,
            }}
          >
            <Svg width="100%" height="100%" preserveAspectRatio="none">
              <Defs>
                <LinearGradient id="bookingBackBtnScrim" x1="0%" y1="0%" x2="100%" y2="0%">
                  <Stop offset="0%" stopColor="#F7F8FC" stopOpacity="0.95" />
                  <Stop offset="65%" stopColor="#F7F8FC" stopOpacity="0.85" />
                  <Stop offset="85%" stopColor="#F7F8FC" stopOpacity="0.4" />
                  <Stop offset="100%" stopColor="#F7F8FC" stopOpacity="0" />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" rx={25} ry={25} fill="url(#bookingBackBtnScrim)" />
            </Svg>
          </View>

          <TouchableOpacity
            activeOpacity={0.6}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            onPress={() => {
              console.log('[BOOKING] Back button pressed, current step:', step);
              if (step < 6) {
                handleBack();
              } else {
                router.replace('/(tabs)');
              }
            }}
            style={{ zIndex: 51 }}
            className="w-10 h-10 rounded-full bg-white/90 border border-zinc-200/80 shadow-xs items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={22} color="#101828" style={{ marginLeft: -1 }} />
          </TouchableOpacity>
        </View>

        {/* Center Pill Section: Same styling as Credit Details, dynamically switches on scroll */}
        <View pointerEvents="none" className="absolute left-0 right-0 items-center justify-center">
          <View 
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.55)',
              borderColor: 'rgba(226, 232, 240, 0.7)',
              borderWidth: 1,
            }}
            className="flex-col items-center px-4 py-1.5 rounded-full shadow-2xs"
          >
            <View className="flex-row items-center gap-1">
              <View className="w-1.5 h-1.5 rounded-full bg-[#E11D48]" />
              <Text 
                style={{ letterSpacing: 1.5 }}
                className="text-zinc-500 text-[8.5px] font-bold uppercase"
              >
                VIRLA AT-HOME
              </Text>
            </View>
            <Text className="text-zinc-950 text-[12px] font-black tracking-tight">
              {step === 5 ? 'Health & Safety' : step === 6 ? 'Review & Confirm' : step === 7 ? 'Session Confirmed' : 'Schedule Home Session'}
            </Text>
          </View>
        </View>

        {/* Right side element: step/5 small pill for steps 1-5, Share button for step 7 */}
        {step <= 5 ? (
          <View 
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.65)',
              borderColor: 'rgba(226, 232, 240, 0.8)',
              borderWidth: 1,
            }}
            className="px-2.5 py-1 rounded-full items-center justify-center shadow-2xs"
          >
            <Text className="text-zinc-800 text-[10.5px] font-black uppercase tracking-wider">
              {step}/5
            </Text>
          </View>
        ) : step === 7 ? (
          <TouchableOpacity
            onPress={handleShareBooking}
            activeOpacity={0.8}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            className="w-10 h-10 items-center justify-center rounded-full bg-white/90 border border-zinc-200/80 shadow-xs"
          >
            <Feather name="share-2" size={16} color="#09090B" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} pointerEvents="none" />
        )}
      </View>
    </View>
  );
}

const expCardStyles = StyleSheet.create({
  card: {
    padding: 16,
  },
  cardSelected: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  cardUnselected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#F1F5F9',
  },
  titleSelected: {
    color: '#FFFFFF',
  },
  titleUnselected: {
    color: '#0F172A',
  },
  badgeSelected: {
    backgroundColor: 'rgba(225, 29, 72, 0.2)',
    borderColor: 'rgba(225, 29, 72, 0.4)',
  },
  badgeUnselected: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FFE4E6',
  },
  badgeTextSelected: {
    color: '#FB7185',
  },
  badgeTextUnselected: {
    color: '#E11D48',
  },
  descSelected: {
    color: '#94A3B8',
  },
  descUnselected: {
    color: '#64748B',
  },
});

const prefCardStyles = StyleSheet.create({
  cardSelected: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  cardUnselected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#F1F5F9',
  },
  labelSelected: {
    color: '#FFFFFF',
  },
  labelUnselected: {
    color: '#0F172A',
  },
  descSelected: {
    color: '#94A3B8',
  },
  descUnselected: {
    color: '#64748B',
  },
});
