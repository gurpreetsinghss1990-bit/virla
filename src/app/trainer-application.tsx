import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, Switch, StyleSheet, Platform, KeyboardAvoidingView, NativeModules, Image, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Database, TrainerApplication } from '../database/Database';
import { LuxuryCard } from '../components/LuxuryCard';
import { useUserProfileStore } from '../store/userProfileStore';
import { supabase } from '../database/supabaseClient';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
const getNativePickerModules = () => {
  const g = globalThis as any;
  const expoModules = g.expo?.modules || g.ExpoModules || {};

  const hasDocPicker = !!expoModules.ExpoDocumentPicker || !!NativeModules.ExpoDocumentPicker;
  const hasImgPicker = !!expoModules.ExpoImagePicker || !!NativeModules.ExpoImagePicker;
  const hasFS = !!expoModules.ExponentFileSystem || !!expoModules.ExpoFileSystem || !!NativeModules.ExponentFileSystem || !!NativeModules.ExpoFileSystem;

  if (!hasDocPicker || !hasImgPicker || !hasFS) {
    return {
      DocumentPicker: null,
      ImagePicker: null,
      FileSystem: null,
      isSupported: false,
    };
  }

  try {
    const DocPicker = require('expo-document-picker');
    const ImgPicker = require('expo-image-picker');
    const FS = require('expo-file-system');

    return {
      DocumentPicker: DocPicker,
      ImagePicker: ImgPicker,
      FileSystem: FS,
      isSupported: true,
    };
  } catch (e) {
    console.warn('[DEBUG] Native upload modules not available in this client build. Falling back to simulation mode.', e);
    return {
      DocumentPicker: null,
      ImagePicker: null,
      FileSystem: null,
      isSupported: false,
    };
  }
};

export default function TrainerApplicationScreen() {
  const router = useRouter();
  const mobile = useUserProfileStore(state => state.mobile);
  
  const [currentStep, setCurrentStep] = useState(1);
  const [appId, setAppId] = useState<string | null>(null);
  const [appStatus, setAppStatus] = useState<'draft' | 'pending' | 'approved' | 'rejected' | 'info_requested'>('draft');

  // Policies Pre-Application Flow
  const [hasAcceptedPolicies, setHasAcceptedPolicies] = useState(false);
  const [policyPage, setPolicyPage] = useState<1 | 2>(1);
  const [hasScrolledToBottomPage1, setHasScrolledToBottomPage1] = useState(false);
  const [hasScrolledToBottomPage2, setHasScrolledToBottomPage2] = useState(false);

  // Policy checkboxes
  const [checkEarningsPolicy, setCheckEarningsPolicy] = useState(false);
  const [checkTermsPolicy, setCheckTermsPolicy] = useState(false);
  const [checkReviewUnderstanding, setCheckReviewUnderstanding] = useState(false);
  const [checkFollowRules, setCheckFollowRules] = useState(false);

  // Captured audit information
  const [acceptedAgreementTimestamp, setAcceptedAgreementTimestamp] = useState('');
  const [acceptedAgreementAppVersion, setAcceptedAgreementAppVersion] = useState('');

  // Step 1: Personal Info
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('Male');
  const [avatar, setAvatar] = useState('https://images.unsplash.com/photo-1568602471122-7832951cc4c5?auto=format&fit=crop&w=300&q=80');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Mumbai');
  const [state, setState] = useState('Maharashtra');
  const [pinCode, setPinCode] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');

  // Step 2: Fitness & Professional Details
  const [primaryWorkout, setPrimaryWorkout] = useState('Strength Training');
  const [secondarySkills, setSecondarySkills] = useState('HIIT, Core, Mobility');
  const [fitnessQualifications, setFitnessQualifications] = useState('ACE Certified Personal Trainer');
  const [aboutMe, setAboutMe] = useState('');

  // Step 3: Experience & Working Preferences
  const [yearsOfExperience, setYearsOfExperience] = useState('5');
  const [languages, setLanguages] = useState('English, Hindi');
  const [workingDays, setWorkingDays] = useState<string[]>(['Mon', 'Wed', 'Fri']);
  const [availabilityMorning, setAvailabilityMorning] = useState(true);
  const [availabilityAfternoon, setAvailabilityAfternoon] = useState(true);
  const [availabilityEvening, setAvailabilityEvening] = useState(true);
  const [maxSessionsPerDay, setMaxSessionsPerDay] = useState('4');
  const [preferredWorkingRadius, setPreferredWorkingRadius] = useState('10');
  const [preferredCities, setPreferredCities] = useState<string[]>(['Mumbai']);

  // Step 4: Verification uploads (Live Supabase paths)
  const [documentAadhaar, setDocumentAadhaar] = useState('');
  const [documentPan, setDocumentPan] = useState('');
  const [documentSelfie, setDocumentSelfie] = useState('');
  const [documentCertifications, setDocumentCertifications] = useState('');

  const [aadhaarUploadStatus, setAadhaarUploadStatus] = useState<'NOT_UPLOADED' | 'UPLOADING' | 'UPLOADED' | 'FAILED'>('NOT_UPLOADED');
  const [panUploadStatus, setPanUploadStatus] = useState<'NOT_UPLOADED' | 'UPLOADING' | 'UPLOADED' | 'FAILED'>('NOT_UPLOADED');
  const [selfieUploadStatus, setSelfieUploadStatus] = useState<'NOT_UPLOADED' | 'UPLOADING' | 'UPLOADED' | 'FAILED'>('NOT_UPLOADED');
  const [certsUploadStatus, setCertsUploadStatus] = useState<'NOT_UPLOADED' | 'UPLOADING' | 'UPLOADED' | 'FAILED'>('NOT_UPLOADED');

  const [aadhaarStatus, setAadhaarStatus] = useState<'pending_verification' | 'verified' | 'rejected'>('pending_verification');
  const [panStatus, setPanStatus] = useState<'pending_verification' | 'verified' | 'rejected'>('pending_verification');
  const [aadhaarVerificationNotes, setAadhaarVerificationNotes] = useState('');
  const [panVerificationNotes, setPanVerificationNotes] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);

  // Real ID Verification states
  const [showPickerModal, setShowPickerModal] = useState(false);
  const [activeUploadType, setActiveUploadType] = useState<'aadhaar' | 'pan' | 'selfie' | 'certs' | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'image' | 'pdf' | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  
  const [verifyingStatus, setVerifyingStatus] = useState<'IDLE' | 'UPLOADING' | 'PROCESSING' | 'VERIFIED' | 'NAME_MISMATCH' | 'MANUAL_REVIEW'>('IDLE');
  const [extractedIdName, setExtractedIdName] = useState('');
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [trainerAttested, setTrainerAttested] = useState(false);

  // Load existing application if present
  useEffect(() => {
    const loadApplication = async () => {
      const searchPhone = mobile || phone;
      if (searchPhone) {
        try {
          await Database.fetchAllTrainerApplications();
          const app = Database.getTrainerApplication(searchPhone);
          if (app) {
            setAppId(app.id);
            setAppStatus(app.status);
            setHasAcceptedPolicies(true); // Bypass policies for loaded applications
            setFullName(app.fullName || '');
            setPhone(app.phone || '');
            setEmail(app.email || '');
            setDob(app.dob || '');
            const normalizedGen = (app.gender || '').toLowerCase();
            setGender(normalizedGen === 'female' ? 'Female' : 'Male');
            setAvatar(app.avatar || '');
            setAddress(app.address || '');
            setCity(app.city || 'Mumbai');
            setState(app.state || 'Maharashtra');
            setPinCode(app.pinCode || '');
            setPrimaryWorkout(app.primaryWorkout || 'Strength Training');
            setSecondarySkills(app.secondarySkills || '');
            setFitnessQualifications(app.fitnessQualifications || '');
            setAboutMe(app.aboutMe || '');
            setYearsOfExperience((app.yearsOfExperience || 3).toString());
            setLanguages(app.languages || 'English');
            setWorkingDays(app.workingDays || []);
            setAvailabilityMorning(app.availabilityMorning);
            setAvailabilityAfternoon(app.availabilityAfternoon);
            setAvailabilityEvening(app.availabilityEvening);
            setMaxSessionsPerDay((app.maxSessionsPerDay || 4).toString());
            setPreferredWorkingRadius((app.preferredWorkingRadius || 10).toString());
            setPreferredCities(app.preferredCities || []);
            setDocumentAadhaar(app.documentAadhaar || '');
            setAadhaarUploadStatus(app.documentAadhaar ? 'UPLOADED' : 'NOT_UPLOADED');
            setDocumentPan(app.documentPan || '');
            setPanUploadStatus(app.documentPan ? 'UPLOADED' : 'NOT_UPLOADED');
            setDocumentSelfie(app.documentSelfie || '');
            setSelfieUploadStatus(app.documentSelfie ? 'UPLOADED' : 'NOT_UPLOADED');
            
            setAadhaarStatus(app.aadhaarStatus || 'pending_verification');
            setPanStatus(app.panStatus || 'pending_verification');
            setAadhaarVerificationNotes(app.aadhaarVerificationNotes || '');
            setPanVerificationNotes(app.panVerificationNotes || '');
            setAdminNotes(app.adminNotes || '');
            
            setAcceptedAgreementTimestamp(app.acceptedAgreementTimestamp || '');
            setAcceptedAgreementAppVersion(app.acceptedAgreementAppVersion || '');

            try {
              const parsedCerts = JSON.parse(app.documentCertifications || '[]');
              setDocumentCertifications(parsedCerts[0] || '');
              setCertsUploadStatus(parsedCerts[0] ? 'UPLOADED' : 'NOT_UPLOADED');
            } catch (e) {
              setDocumentCertifications(app.documentCertifications || '');
              setCertsUploadStatus(app.documentCertifications ? 'UPLOADED' : 'NOT_UPLOADED');
            }

            try {
              const emergency = JSON.parse(app.emergencyContact || '{}');
              setEmergencyName(emergency.name || '');
              setEmergencyPhone(emergency.phone || '');
            } catch (e) {}

            try {
              const docs = await Database.fetchTrainerVerificationDocs(app.id);
              if (docs.length > 0) {
                const latestDoc = docs[0];
                setActiveDocId(latestDoc.id);
                setVerifyingStatus(latestDoc.verification_status);
                setExtractedIdName(latestDoc.extracted_name || '');
                setOcrConfidence(latestDoc.confidence ? parseFloat(latestDoc.confidence) : null);
                setTrainerAttested(latestDoc.trainer_attested || false);
              }
            } catch (err) {
              console.error('[TrainerApp] Failed to load verification documents:', err);
            }
          }
        } catch (err) {
          console.error('[TrainerApp] Failed to load application:', err);
        }
      }
    };
    loadApplication();
  }, [mobile]);

  const toggleDay = (day: string) => {
    if (workingDays.includes(day)) {
      setWorkingDays(workingDays.filter(d => d !== day));
    } else {
      setWorkingDays([...workingDays, day]);
    }
  };

  const handleScrollPage1 = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 30;
    if (isCloseToBottom) {
      setHasScrolledToBottomPage1(true);
    }
  };

  const handleScrollPage2 = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 30;
    if (isCloseToBottom) {
      setHasScrolledToBottomPage2(true);
    }
  };

  const uploadFile = async (docType: 'aadhaar' | 'pan' | 'selfie' | 'certs') => {
    setActiveUploadType(docType);
    setShowPickerModal(true);
  };

  const pickDocument = async (source: 'camera' | 'library' | 'file') => {
    try {
      setShowPickerModal(false);
      let result: any = null;

      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Camera permission is required to take photos.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
        });
      } else if (source === 'library') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Photo library permission is required to select photos.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
        });
      } else if (source === 'file') {
        result = await DocumentPicker.getDocumentAsync({
          type: activeUploadType === 'aadhaar' ? ['application/pdf', 'image/*'] : '*/*',
          copyToCacheDirectory: true,
        });
      }

      if (!result || result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset) return;

      setPreviewUri(asset.uri);
      setPreviewName(asset.name || (activeUploadType === 'selfie' ? 'selfie.jpg' : 'document.jpg'));
      setPreviewType(asset.mimeType?.includes('pdf') || asset.uri.endsWith('.pdf') ? 'pdf' : 'image');
      setShowPreview(true);
    } catch (err: any) {
      console.error('[TrainerApp] Document picking failed:', err);
      Alert.alert('Error', 'Unable to pick document. Please try again.');
    }
  };

  const confirmAndUpload = async () => {
    if (!previewUri || !activeUploadType) return;
    setShowPreview(false);
    
    const docType = activeUploadType;
    const uri = previewUri;
    const name = previewName || `${docType}_document`;
    const isPdf = previewType === 'pdf';
    const ext = name.split('.').pop() || (isPdf ? 'pdf' : 'jpg');

    try {
      setUploadingDoc(docType);
      if (docType === 'aadhaar') {
        setAadhaarUploadStatus('UPLOADING');
        setVerifyingStatus('UPLOADING');
      } else if (docType === 'pan') setPanUploadStatus('UPLOADING');
      else if (docType === 'selfie') setSelfieUploadStatus('UPLOADING');
      else if (docType === 'certs') setCertsUploadStatus('UPLOADING');

      let arrayBuffer: ArrayBuffer;
      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        arrayBuffer = await response.arrayBuffer();
      } else {
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        arrayBuffer = bytes.buffer;
      }

      const trainerId = Database.getCurrentUserId();
      if (!trainerId) throw new Error('Trainer ID not found');
      
      const docId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const cleanFileName = `${docId}.${ext}`;
      
      const bucketName = docType === 'aadhaar' ? 'trainer-verification' : 'trainer-documents';
      const filePath = docType === 'aadhaar' ? `${trainerId}/${cleanFileName}` : `trainer-docs/${cleanFileName}`;
      const contentType = isPdf ? 'application/pdf' : `image/${ext}`;

      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(filePath, arrayBuffer, {
          upsert: true,
          contentType,
        });

      if (error) throw new Error(error.message);

      let fileUrl = '';
      if (docType !== 'aadhaar') {
        const { data: publicUrlData } = supabase.storage
          .from(bucketName)
          .getPublicUrl(filePath);
        fileUrl = publicUrlData.publicUrl;
      } else {
        fileUrl = filePath; 
      }

      console.log(`[TrainerApp] Upload successful. Path: ${filePath}`);

      if (docType === 'aadhaar') {
        setDocumentAadhaar(fileUrl);
        setAadhaarUploadStatus('UPLOADED');
        setVerifyingStatus('PROCESSING');
        
        await Database.createTrainerVerificationDoc({
          id: docId,
          trainer_id: trainerId,
          storage_path: filePath,
          file_type: contentType,
          verification_status: 'PROCESSING',
        });
        setActiveDocId(docId);

        try {
          const { data: fnResult, error: fnError } = await supabase.functions.invoke('process-id', {
            body: { documentId: docId },
          });

          if (fnError) throw fnError;

          const docs = await Database.fetchTrainerVerificationDocs(trainerId);
          if (docs.length > 0) {
            const updated = docs[0];
            setVerifyingStatus(updated.verification_status);
            setExtractedIdName(updated.extracted_name || '');
            setOcrConfidence(updated.confidence ? parseFloat(updated.confidence) : null);
            setTrainerAttested(updated.trainer_attested || false);
          }
        } catch (err: any) {
          console.error('[TrainerApp] AI Verification failed:', err);
          await Database.updateTrainerVerificationDoc(docId, 'MANUAL_REVIEW', false);
          setVerifyingStatus('MANUAL_REVIEW');
          setTrainerAttested(false);
          Alert.alert('AI Processing Delay', 'AI verification is taking longer than expected. Your document has been submitted for manual admin review.');
        }
      } else if (docType === 'pan') {
        setDocumentPan(fileUrl);
        setPanStatus('pending_verification');
        setPanUploadStatus('UPLOADED');
      } else if (docType === 'selfie') {
        setDocumentSelfie(fileUrl);
        setAvatar(fileUrl);
        setSelfieUploadStatus('UPLOADED');
      } else if (docType === 'certs') {
        setDocumentCertifications(fileUrl);
        setCertsUploadStatus('UPLOADED');
      }

      if (docType !== 'aadhaar') {
        Alert.alert('Upload Successful', `✓ ${docType.toUpperCase()} document uploaded successfully.`);
      }
    } catch (err: any) {
      console.error(`[TrainerApp] Upload failed for ${docType}:`, err);
      if (docType === 'aadhaar') {
        setAadhaarUploadStatus('FAILED');
        setVerifyingStatus('IDLE');
      } else if (docType === 'pan') setPanUploadStatus('FAILED');
      else if (docType === 'selfie') setSelfieUploadStatus('FAILED');
      else if (docType === 'certs') setCertsUploadStatus('FAILED');

      Alert.alert(
        'Upload failed',
        `Unable to securely upload this document: ${err.message || err}`,
        [
          { text: 'Try Again', onPress: () => uploadFile(docType) },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } finally {
      setUploadingDoc(null);
      setPreviewUri(null);
      setPreviewName(null);
      setPreviewType(null);
    }
  };

  const handleAttestNames = async () => {
    if (!activeDocId) return;
    try {
      setVerifyingStatus('PROCESSING');
      await Database.updateTrainerVerificationDoc(activeDocId, 'MANUAL_REVIEW', true);
      setVerifyingStatus('MANUAL_REVIEW');
      setTrainerAttested(true);
      Alert.alert('Attestation Received', 'Your attestation has been recorded. The admin will verify both names manually.');
    } catch (err: any) {
      Alert.alert('Error', 'Failed to submit attestation.');
      setVerifyingStatus('NAME_MISMATCH');
    }
  };

  const handleUploadDifferentId = () => {
    setDocumentAadhaar('');
    setAadhaarUploadStatus('NOT_UPLOADED');
    setVerifyingStatus('IDLE');
    setExtractedIdName('');
    setOcrConfidence(null);
    setActiveDocId(null);
    setTrainerAttested(false);
    uploadFile('aadhaar');
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (!fullName || !phone || !email || !dob || !address || !pinCode) {
        Alert.alert('Missing Info', 'Please fill in all personal details.');
        return;
      }
    } else if (currentStep === 2) {
      if (!primaryWorkout || !fitnessQualifications || !aboutMe) {
        Alert.alert('Missing Info', 'Please fill in all professional specializations and bio.');
        return;
      }
    } else if (currentStep === 3) {
      if (!yearsOfExperience || !languages || workingDays.length === 0) {
        Alert.alert('Missing Info', 'Please enter experience, languages, and select working days.');
        return;
      }
    }
    setCurrentStep(prev => prev + 1);
  };

  const handleBack = () => {
    setCurrentStep(prev => prev - 1);
  };

  const handleSubmit = async () => {
    if (!documentAadhaar || !documentPan || !documentSelfie) {
      Alert.alert('Required Documents', 'Please upload Aadhaar, PAN, and selfie.');
      return;
    }

    try {
      const emergencyContactJSON = JSON.stringify({
        name: emergencyName || 'Neha Sharma',
        relationship: 'Sister',
        phone: emergencyPhone || '+91 98200 11223'
      });

      const applicationData = {
        fullName,
        phone,
        email,
        dob,
        gender,
        avatar,
        address,
        city,
        state,
        pinCode,
        emergencyContact: emergencyContactJSON,
        primaryWorkout,
        secondarySkills,
        yearsOfExperience: parseInt(yearsOfExperience) || 3,
        languages,
        aboutMe,
        fitnessQualifications,
        workingDays,
        availabilityMorning,
        availabilityAfternoon,
        availabilityEvening,
        maxSessionsPerDay: parseInt(maxSessionsPerDay) || 4,
        preferredWorkingRadius: parseInt(preferredWorkingRadius) || 10,
        preferredCities,
        bankAccountName: '',
        bankName: '',
        bankAccountNumber: '',
        bankIfsc: '',
        bankUpiId: '',
        panNumber: 'VERIFICATION_PENDING',
        gstNumber: '',
        documentAadhaar,
        documentPan,
        documentSelfie,
        documentCertifications: JSON.stringify([documentCertifications]),
        aadhaarStatus: 'pending_verification' as const,
        panStatus: 'pending_verification' as const,
        aadhaarVerificationNotes: '',
        panVerificationNotes: '',
        adminNotes: '',
        acceptedAgreementTimestamp,
        acceptedAgreementAppVersion
      };

      if (appId) {
        const application = await Database.updateTrainerApplication(appId, applicationData);
        setAppStatus('pending');
        Alert.alert('Application Updated', 'Your updated trainer application has been submitted for review.');
      } else {
        const application = await Database.submitTrainerApplication(applicationData);
        setAppId(application.id);
        setAppStatus('pending');
        Alert.alert('Application Submitted', 'Your onboarding credentials are under review by the operations team.');
      }
    } catch (err: any) {
      Alert.alert('Submission Error', err.message || 'Error occurred while saving application.');
    }
  };

  // Render Pre-Application Agreement Pages
  if (appStatus === 'draft' && !hasAcceptedPolicies) {
    return (
      <SafeAreaViewWrapper>
        {/* Header */}
        <View className="h-16 flex-row items-center px-6 justify-between bg-white border-b border-zinc-150">
          <TouchableOpacity 
            activeOpacity={0.8} 
            onPress={() => {
              if (policyPage === 2) {
                setPolicyPage(1);
              } else {
                router.replace('/(tabs)/profile' as any);
              }
            }} 
            className="flex-row items-center gap-1"
          >
            <Feather name="arrow-left" size={16} color="#101828" />
            <Text className="text-zinc-900 text-xs font-bold uppercase tracking-wider">Back</Text>
          </TouchableOpacity>
          <Text className="text-[#E11D48] text-sm font-black tracking-widest uppercase">Trainer Join</Text>
          <View className="w-10" />
        </View>

        {/* Scroll Content */}
        <ScrollView 
          onScroll={policyPage === 1 ? handleScrollPage1 : handleScrollPage2}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 140 }}
          className="flex-1 bg-[#F7F8FC]"
        >
          {/* Step indicator: Step 1 of 3 (Policies -> Application -> Review) */}
          <View className="mb-6">
            <Text className="text-[#E11D48] text-xs font-black uppercase tracking-widest">Step 1 of 3: Policies</Text>
            <Text className="text-[#101828] text-xl font-black mt-1">
              {policyPage === 1 ? 'Earnings & Partner Program' : 'Terms & Professional Standards'}
            </Text>
            <View className="flex-row items-center gap-1.5 mt-3">
              <View className="h-2 rounded-full flex-1 bg-[#E11D48]" />
              <View className="h-2 rounded-full flex-1 bg-zinc-200" />
              <View className="h-2 rounded-full flex-1 bg-zinc-200" />
            </View>
          </View>

          {policyPage === 1 ? (
            <View className="gap-5">
              <Text className="text-[#101828] text-lg font-black tracking-tight leading-snug">
                Welcome to the VIRLA Partner Coach Program
              </Text>
              <Text className="text-zinc-600 text-xs font-semibold leading-relaxed">
                Thank you for your interest in becoming a VIRLA Partner Coach.
              </Text>
              <Text className="text-zinc-600 text-xs leading-relaxed">
                VIRLA is India&apos;s premium home fitness platform connecting verified fitness professionals with customers seeking high-quality in-home wellness services. We believe in professionalism, transparency, fair earnings, and long-term career growth.
              </Text>

              <LuxuryCard className="p-5 gap-3.5" interactive={false}>
                <Text className="text-zinc-900 text-xs font-black uppercase tracking-wider border-b border-zinc-100 pb-2">
                  Your Journey at VIRLA
                </Text>
                <Text className="text-zinc-500 text-[11px] leading-relaxed">
                  Every approved trainer joins as an <Text className="font-extrabold text-zinc-900">Associate Coach</Text>. As you continue delivering excellent service, you may become eligible for promotion to:
                </Text>
                
                <View className="flex-row items-center gap-2 mt-1">
                  <View className="px-3 py-1.5 bg-zinc-100 rounded-lg">
                    <Text className="text-zinc-800 text-[9px] font-black uppercase">Associate Coach</Text>
                  </View>
                  <Feather name="arrow-right" size={12} color="#98A2B3" />
                  <View className="px-3 py-1.5 bg-indigo-50 rounded-lg">
                    <Text className="text-indigo-700 text-[9px] font-black uppercase">Certified Coach</Text>
                  </View>
                  <Feather name="arrow-right" size={12} color="#98A2B3" />
                  <View className="px-3 py-1.5 bg-amber-50 rounded-lg">
                    <Text className="text-amber-800 text-[9px] font-black uppercase">Elite Coach</Text>
                  </View>
                </View>

                <Text className="text-zinc-400 text-[9.5px] leading-normal font-medium italic mt-1">
                  Promotions are based on performance, attendance, customer ratings, professionalism, and policy compliance. Promotions are reviewed solely by VIRLA and are not guaranteed.
                </Text>
              </LuxuryCard>

              <LuxuryCard className="p-5 gap-3" interactive={false}>
                <Text className="text-zinc-900 text-xs font-black uppercase tracking-wider border-b border-zinc-100 pb-2">
                  How You Earn
                </Text>
                <Text className="text-zinc-500 text-[11px] leading-relaxed">
                  As a VIRLA Partner Coach, your income may include:{"\n"}
                  • Payment for completed training sessions{"\n"}
                  • Monthly Fixed Retainer (for eligible Partner Coaches){"\n"}
                  • Performance incentives{"\n"}
                  • Peak-hour incentives{"\n"}
                  • Special campaign bonuses{"\n"}
                  • Referral rewards (when applicable)
                </Text>
                <Text className="text-zinc-400 text-[9.5px] leading-normal font-medium italic">
                  Actual payout rates are available inside the Trainer Dashboard after approval and may change from time to time.
                </Text>
              </LuxuryCard>

              <LuxuryCard className="p-5 gap-3.5" interactive={false}>
                <Text className="text-zinc-900 text-xs font-black uppercase tracking-wider border-b border-zinc-100 pb-2">
                  Monthly Fixed Retainer
                </Text>
                <Text className="text-zinc-500 text-[11px] leading-relaxed">
                  Eligible Partner Coaches may receive a Monthly Fixed Retainer in addition to their session earnings. The retainer rewards trainers who consistently maintain their committed availability and service quality.
                </Text>
                <Text className="text-zinc-600 text-xs font-bold uppercase mt-1">Retainer Eligibility Requirements:</Text>
                <Text className="text-zinc-500 text-[11px] leading-relaxed">
                  • Meeting minimum attendance requirements{"\n"}
                  • Maintaining committed weekly availability{"\n"}
                  • Completing accepted sessions professionally{"\n"}
                  • Following VIRLA Partner Policies{"\n"}
                  • Maintaining satisfactory customer ratings{"\n"}
                  • No repeated cancellations or no-shows
                </Text>
                <Text className="text-zinc-400 text-[9.5px] leading-normal font-medium italic">
                  The Monthly Fixed Retainer is performance-based and is not guaranteed. VIRLA may revise eligibility criteria or retainer amounts as the platform evolves.
                </Text>
              </LuxuryCard>

              <LuxuryCard className="p-5 gap-3" interactive={false}>
                <Text className="text-zinc-900 text-xs font-black uppercase tracking-wider border-b border-zinc-100 pb-2">
                  Weekly Payouts
                </Text>
                <Text className="text-zinc-500 text-[11px] leading-relaxed">
                  Payments are processed on a weekly basis for eligible completed sessions. Bank details are collected only after your application has been approved.
                </Text>
              </LuxuryCard>

              <LuxuryCard className="p-5 gap-3" interactive={false}>
                <Text className="text-zinc-900 text-xs font-black uppercase tracking-wider border-b border-zinc-100 pb-2">
                  Identity Verification
                </Text>
                <Text className="text-zinc-500 text-[11px] leading-relaxed">
                  To protect both customers and trainers, all applicants must successfully complete identity verification. During your application you will be asked to upload required documents.
                </Text>
              </LuxuryCard>

              <View className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl items-center my-2">
                {!hasScrolledToBottomPage1 ? (
                  <Text className="text-zinc-400 text-[10px] font-black uppercase tracking-widest text-center">
                    ⚠️ Scroll to the bottom to continue
                  </Text>
                ) : (
                  <Text className="text-emerald-700 text-[10px] font-black uppercase tracking-widest text-center">
                    ✓ You may proceed
                  </Text>
                )}
              </View>

              <TouchableOpacity
                disabled={!hasScrolledToBottomPage1}
                onPress={() => setPolicyPage(2)}
                className={`py-4 rounded-xl items-center justify-center ${
                  hasScrolledToBottomPage1 ? 'bg-[#101828]' : 'bg-zinc-300'
                }`}
              >
                <Text className="text-white text-xs font-black uppercase tracking-wider text-center">
                  Next: Terms & Standards
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="gap-5">
              <Text className="text-[#101828] text-lg font-black tracking-tight leading-snug">
                VIRLA Partner Coach Terms & Professional Standards
              </Text>
              <Text className="text-zinc-600 text-xs leading-relaxed">
                Our customers trust VIRLA to provide safe, professional, and high-quality fitness experiences. Every Partner Coach is expected to maintain these standards.
              </Text>

              <LuxuryCard className="p-5 gap-2.5" interactive={false}>
                <Text className="text-zinc-900 text-xs font-black uppercase tracking-wider border-b border-zinc-100 pb-2">
                  Professional Behaviour
                </Text>
                <Text className="text-zinc-500 text-[11px] leading-relaxed">
                  Every trainer must arrive on time, dress professionally, maintain excellent personal hygiene, and be respectful and courteous.
                </Text>
              </LuxuryCard>

              <LuxuryCard className="p-5 gap-2.5" interactive={false}>
                <Text className="text-zinc-900 text-xs font-black uppercase tracking-wider border-b border-zinc-100 pb-2">
                  Mobile Phone Policy
                </Text>
                <Text className="text-zinc-500 text-[11px] leading-relaxed">
                  During an active training session, trainers must give their complete attention to the customer. Personal mobile phone usage (social media, messages, calls) is strictly prohibited.
                </Text>
              </LuxuryCard>

              <LuxuryCard className="p-5 gap-2.5" interactive={false}>
                <Text className="text-zinc-900 text-xs font-black uppercase tracking-wider border-b border-zinc-100 pb-2">
                  Physical Contact Policy
                </Text>
                <Text className="text-zinc-500 text-[11px] leading-relaxed">
                  Trainers must maintain professional boundaries at all times. Avoid unnecessary physical contact. Physical assistance should only be provided for technique correction or safety with the customer&apos;s explicit consent.
                </Text>
                <Text className="text-rose-600 text-[9.5px] font-black uppercase">
                  ⚠️ Any inappropriate behaviour will result in permanent removal from the platform.
                </Text>
              </LuxuryCard>

              <LuxuryCard className="p-5 gap-2.5" interactive={false}>
                <Text className="text-zinc-900 text-xs font-black uppercase tracking-wider border-b border-zinc-100 pb-2">
                  Attendance & Reliability
                </Text>
                <Text className="text-zinc-500 text-[11px] leading-relaxed">
                  Accept only bookings you are genuinely available to complete. Repeated cancellations or no-shows affect incentives, retainers, and platform eligibility.
                </Text>
              </LuxuryCard>

              <LuxuryCard className="p-5 gap-2.5" interactive={false}>
                <Text className="text-zinc-900 text-xs font-black uppercase tracking-wider border-b border-zinc-100 pb-2">
                  Independent Partner
                </Text>
                <Text className="text-zinc-500 text-[11px] leading-relaxed">
                  VIRLA Partner Coaches provide services as independent partners. Acceptance onto the platform does not guarantee any minimum number of sessions or earnings.
                </Text>
              </LuxuryCard>

              <View className="w-full h-[1px] bg-zinc-200 my-2" />

              <View className="gap-3.5">
                <Text className="text-[#101828] text-xs font-black uppercase tracking-wider">
                  Accept Terms & Conditions
                </Text>

                {/* Checkbox 1 */}
                <TouchableOpacity 
                  disabled={!hasScrolledToBottomPage2}
                  onPress={() => setCheckEarningsPolicy(!checkEarningsPolicy)}
                  className="flex-row items-start gap-2.5"
                >
                  <View className={`w-4 h-4 border rounded items-center justify-center mt-0.5 ${
                    checkEarningsPolicy ? 'bg-emerald-600 border-emerald-600' : 'bg-white border-zinc-300'
                  }`}>
                    {checkEarningsPolicy && <Feather name="check" size={10} color="white" />}
                  </View>
                  <Text className={`text-[10.5px] leading-tight flex-1 font-semibold ${
                    !hasScrolledToBottomPage2 ? 'text-zinc-400' : 'text-zinc-700'
                  }`}>
                    I have read and understood the VIRLA Earnings & Payout Policy.
                  </Text>
                </TouchableOpacity>

                {/* Checkbox 2 */}
                <TouchableOpacity 
                  disabled={!hasScrolledToBottomPage2}
                  onPress={() => setCheckTermsPolicy(!checkTermsPolicy)}
                  className="flex-row items-start gap-2.5"
                >
                  <View className={`w-4 h-4 border rounded items-center justify-center mt-0.5 ${
                    checkTermsPolicy ? 'bg-emerald-600 border-emerald-600' : 'bg-white border-zinc-300'
                  }`}>
                    {checkTermsPolicy && <Feather name="check" size={10} color="white" />}
                  </View>
                  <Text className={`text-[10.5px] leading-tight flex-1 font-semibold ${
                    !hasScrolledToBottomPage2 ? 'text-zinc-400' : 'text-zinc-700'
                  }`}>
                    I have read and understood the VIRLA Partner Terms & Professional Standards.
                  </Text>
                </TouchableOpacity>

                {/* Checkbox 3 */}
                <TouchableOpacity 
                  disabled={!hasScrolledToBottomPage2}
                  onPress={() => setCheckReviewUnderstanding(!checkReviewUnderstanding)}
                  className="flex-row items-start gap-2.5"
                >
                  <View className={`w-4 h-4 border rounded items-center justify-center mt-0.5 ${
                    checkReviewUnderstanding ? 'bg-emerald-600 border-emerald-600' : 'bg-white border-zinc-300'
                  }`}>
                    {checkReviewUnderstanding && <Feather name="check" size={10} color="white" />}
                  </View>
                  <Text className={`text-[10.5px] leading-tight flex-1 font-semibold ${
                    !hasScrolledToBottomPage2 ? 'text-zinc-400' : 'text-zinc-700'
                  }`}>
                    I understand that my application will be reviewed before approval.
                  </Text>
                </TouchableOpacity>

                {/* Checkbox 4 */}
                <TouchableOpacity 
                  disabled={!hasScrolledToBottomPage2}
                  onPress={() => setCheckFollowRules(!checkFollowRules)}
                  className="flex-row items-start gap-2.5"
                >
                  <View className={`w-4 h-4 border rounded items-center justify-center mt-0.5 ${
                    checkFollowRules ? 'bg-emerald-600 border-emerald-600' : 'bg-white border-zinc-300'
                  }`}>
                    {checkFollowRules && <Feather name="check" size={10} color="white" />}
                  </View>
                  <Text className={`text-[10.5px] leading-tight flex-1 font-semibold ${
                    !hasScrolledToBottomPage2 ? 'text-zinc-400' : 'text-zinc-700'
                  }`}>
                    I agree to follow all VIRLA Partner Policies while using the platform.
                  </Text>
                </TouchableOpacity>
              </View>

              <View className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl items-center mt-2">
                {!hasScrolledToBottomPage2 ? (
                  <Text className="text-zinc-400 text-[10px] font-black uppercase tracking-widest text-center">
                    ⚠️ Scroll to the bottom to activate checkboxes
                  </Text>
                ) : (!checkEarningsPolicy || !checkTermsPolicy || !checkReviewUnderstanding || !checkFollowRules) ? (
                  <Text className="text-amber-800 text-[10px] font-black uppercase tracking-widest text-center">
                    ⚠️ Accept all 4 policies to proceed
                  </Text>
                ) : (
                  <Text className="text-emerald-700 text-[10px] font-black uppercase tracking-widest text-center">
                    ✓ Policies Accepted
                  </Text>
                )}
              </View>

              <TouchableOpacity
                disabled={
                  !hasScrolledToBottomPage2 || 
                  !checkEarningsPolicy || 
                  !checkTermsPolicy || 
                  !checkReviewUnderstanding || 
                  !checkFollowRules
                }
                onPress={() => {
                  setAcceptedAgreementTimestamp(new Date().toISOString());
                  setAcceptedAgreementAppVersion('1.0.0');
                  setHasAcceptedPolicies(true);
                  Alert.alert('Agreement Confirmed', 'You may now proceed to complete your personal details.');
                }}
                className={`py-4 rounded-xl items-center justify-center ${
                  (hasScrolledToBottomPage2 && checkEarningsPolicy && checkTermsPolicy && checkReviewUnderstanding && checkFollowRules)
                    ? 'bg-[#E11D48]' 
                    : 'bg-zinc-300'
                }`}
              >
                <Text className="text-white text-xs font-black uppercase tracking-wider text-center">
                  Continue to Personal Details
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </SafeAreaViewWrapper>
    );
  }

  return (
    <SafeAreaViewWrapper>
      <View className="h-16 flex-row items-center px-6 justify-between bg-white border-b border-zinc-150">
        <TouchableOpacity 
          activeOpacity={0.8} 
          onPress={() => {
            if (currentStep > 1 && appStatus === 'draft') {
              handleBack();
            } else {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)/profile' as any);
              }
            }
          }} 
          className="flex-row items-center gap-1"
        >
          <Feather name="arrow-left" size={16} color="#101828" />
          <Text className="text-zinc-900 text-xs font-bold uppercase tracking-wider">Back</Text>
        </TouchableOpacity>
        <Text className="text-[#E11D48] text-sm font-black tracking-widest uppercase">Trainer Join</Text>
        <View className="w-10" />
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        className="flex-1"
      >
        <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 140 }}
        className="flex-1 bg-[#F7F8FC]"
      >
        <View className="mb-6">
          <Text className="text-zinc-400 text-xs font-extrabold uppercase tracking-widest text-start">Step 2 of 3: Application</Text>
          <Text className="text-[#101828] text-2xl font-black tracking-tight mt-1 text-start">Onboarding Application</Text>
          {appStatus === 'draft' && (
            <View className="flex-row items-center gap-1.5 mt-3">
              {[1, 2, 3, 4].map(step => (
                <View 
                  key={step} 
                  className={`h-2 rounded-full flex-1 ${step <= currentStep ? 'bg-[#E11D48]' : 'bg-zinc-200'}`}
                />
              ))}
            </View>
          )}
        </View>

        {appStatus === 'pending' && (
          <LuxuryCard className="p-6 gap-5 items-center justify-center bg-white border border-zinc-200" interactive={false}>
            <Text className="text-4xl text-center">✅</Text>
            <Text className="text-[#101828] text-lg font-extrabold text-center uppercase tracking-wider">Application Submitted</Text>
            <Text className="text-[#E11D48] text-[10px] font-black uppercase tracking-widest text-center mt-1">Step 3 of 3: Review</Text>
            
            <View className="w-full bg-[#ECFDF5] border border-[#A7F3D0] p-4 rounded-xl items-center my-1">
              <Text className="text-emerald-800 text-xs font-black uppercase tracking-wider text-center">🟢 Under Review</Text>
            </View>

            <Text className="text-zinc-600 text-xs leading-relaxed text-center px-2">
              Our operations team is reviewing your:{"\n"}
              • Identity documents{"\n"}
              • Fitness qualifications{"\n"}
              • Professional experience
            </Text>

            <View className="bg-zinc-50 border border-zinc-200 p-3 rounded-xl w-full items-center">
              <Text className="text-zinc-400 text-[9px] font-bold uppercase tracking-wider text-center">Average review time</Text>
              <Text className="text-zinc-900 text-sm font-black mt-0.5 text-center">24–48 hours</Text>
            </View>

            <Text className="text-zinc-400 text-[10px] text-center font-medium leading-relaxed mt-2">
              We&apos;ll notify you through the VIRLA app once your application has been reviewed.
            </Text>

            <TouchableOpacity
              onPress={() => router.replace('/(tabs)')}
              className="w-full py-4 bg-[#101828] rounded-xl items-center justify-center mt-4"
            >
              <Text className="text-white text-xs font-black uppercase tracking-wider text-center">Return to Home</Text>
            </TouchableOpacity>
          </LuxuryCard>
        )}

        {appStatus === 'approved' && (
          <LuxuryCard className="p-6 gap-5 items-center justify-center bg-emerald-50/20 border-emerald-100/50" interactive={false}>
            <Text className="text-4xl text-center">🎉</Text>
            <Text className="text-[#101828] text-lg font-extrabold text-center uppercase tracking-wider">Application Approved</Text>
            <Text className="text-zinc-500 text-xs text-center leading-relaxed">
              Congratulations! Your trainer profile is now active on the platform.
            </Text>
            <TouchableOpacity
              onPress={() => router.replace('/(tabs)')}
              className="w-full py-4 bg-[#101828] rounded-xl items-center justify-center mt-2"
            >
              <Text className="text-white text-xs font-black uppercase tracking-wider text-center">Go to Dashboard</Text>
            </TouchableOpacity>
          </LuxuryCard>
        )}

        {appStatus === 'rejected' && (
          <LuxuryCard className="p-6 gap-5 items-center justify-center bg-rose-50/20 border-rose-100/50" interactive={false}>
            <Text className="text-4xl text-center">❌</Text>
            <Text className="text-[#101828] text-lg font-extrabold text-center uppercase tracking-wider">Application Rejected</Text>
            <Text className="text-zinc-500 text-xs text-center leading-relaxed">
              Your certificates do not comply with the standards. Resubmit correct qualifications.
            </Text>
            <TouchableOpacity
              onPress={() => setAppStatus('draft')}
              className="w-full py-4 bg-zinc-900 rounded-xl items-center justify-center mt-2"
            >
              <Text className="text-white text-xs font-black uppercase tracking-wider text-center">Modify Application</Text>
            </TouchableOpacity>
          </LuxuryCard>
        )}

        {appStatus === 'info_requested' && (
          <LuxuryCard className="p-6 gap-5 items-center justify-center bg-amber-50/30 border border-amber-200/50" interactive={false}>
            <Text className="text-4xl text-center">⚠️</Text>
            <Text className="text-[#101828] text-lg font-extrabold text-center uppercase tracking-wider">Additional Info Required</Text>
            
            <View className="bg-amber-50 border border-amber-200 p-4 rounded-xl w-full">
              <Text className="text-amber-800 text-[10px] font-black uppercase tracking-widest mb-1 text-start">Feedback from Admin:</Text>
              <Text className="text-amber-950 text-xs font-semibold leading-relaxed text-start">{adminNotes || 'Please review your uploaded certifications or residential details.'}</Text>
            </View>

            <Text className="text-zinc-500 text-xs text-center leading-relaxed">
              You can modify the requested details below and resubmit without losing your other progress.
            </Text>

            <TouchableOpacity
              onPress={() => setAppStatus('draft')}
              className="w-full py-4 bg-zinc-900 rounded-xl items-center justify-center mt-2"
            >
              <Text className="text-white text-xs font-black uppercase tracking-wider text-center">Update Details</Text>
            </TouchableOpacity>
          </LuxuryCard>
        )}

        {appStatus === 'draft' && (
          <>
            {currentStep === 1 && (
              <LuxuryCard className="p-5 gap-4" interactive={false}>
                <Text className="text-[#101828] text-xs font-black uppercase tracking-widest border-b border-zinc-100 pb-2 text-start">Step 1: Personal Details</Text>
                
                <View className="gap-3.5">
                  <View>
                    <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-1 text-start">Full Name</Text>
                    <TextInput 
                      value={fullName} onChangeText={setFullName} placeholder="Karan Sharma"
                      className="bg-zinc-50 border border-zinc-150 p-3 rounded-xl text-zinc-900 text-xs font-semibold"
                    />
                  </View>
                  <View className="flex-row gap-2">
                    <View className="flex-1">
                      <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-1 text-start">Mobile Number</Text>
                      <TextInput 
                        value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+91 99999 88888"
                        className="bg-zinc-50 border border-zinc-150 p-3 rounded-xl text-zinc-900 text-xs font-semibold"
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-1 text-start">Email</Text>
                      <TextInput 
                        value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="karan@virla.pro"
                        className="bg-zinc-50 border border-zinc-150 p-3 rounded-xl text-zinc-900 text-xs font-semibold"
                      />
                    </View>
                  </View>
                  <View className="flex-row gap-2">
                    <View className="flex-1">
                      <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-1 text-start">Date of Birth</Text>
                      <TextInput 
                        value={dob} onChangeText={setDob} placeholder="14/10/1995"
                        className="bg-zinc-50 border border-zinc-150 p-3 rounded-xl text-zinc-900 text-xs font-semibold"
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-1 text-start">Gender</Text>
                      <View className="flex-row border border-zinc-150 rounded-xl overflow-hidden bg-zinc-50 h-11">
                        {['Male', 'Female'].map((g) => {
                          const isSelected = gender === g;
                          return (
                            <TouchableOpacity
                              key={g}
                              activeOpacity={0.8}
                              onPress={() => setGender(g)}
                              className={`flex-1 items-center justify-center ${isSelected ? 'bg-zinc-950' : 'bg-transparent'}`}
                            >
                              <Text className={`text-xs font-black uppercase ${isSelected ? 'text-white' : 'text-zinc-650'}`}>
                                {g}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  </View>
                  <View>
                    <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-1 text-start">Residential Address</Text>
                    <TextInput 
                      value={address} onChangeText={setAddress} placeholder="A-404, Sea Breeze Towers, Worli"
                      className="bg-zinc-50 border border-zinc-150 p-3 rounded-xl text-zinc-900 text-xs font-semibold"
                    />
                  </View>
                  <View className="flex-row gap-2">
                    <View className="flex-1">
                      <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-1 text-start">City</Text>
                      <TextInput value={city} onChangeText={setCity} className="bg-zinc-50 border border-zinc-150 p-3 rounded-xl text-zinc-900 text-xs font-semibold" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-1 text-start">PIN Code</Text>
                      <TextInput 
                        value={pinCode} onChangeText={setPinCode} placeholder="400018"
                        className="bg-zinc-50 border border-zinc-150 p-3 rounded-xl text-zinc-900 text-xs font-semibold"
                      />
                    </View>
                  </View>
                  <View className="flex-row gap-2">
                    <View className="flex-1">
                      <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-1 text-start">Emergency Contact Name</Text>
                      <TextInput value={emergencyName} onChangeText={setEmergencyName} placeholder="Neha Sharma" className="bg-zinc-50 border border-zinc-150 p-3 rounded-xl text-zinc-900 text-xs font-semibold" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-1 text-start">Emergency Phone</Text>
                      <TextInput value={emergencyPhone} onChangeText={setEmergencyPhone} placeholder="+91 98200 11223" className="bg-zinc-50 border border-zinc-150 p-3 rounded-xl text-zinc-900 text-xs font-semibold" />
                    </View>
                  </View>
                </View>
              </LuxuryCard>
            )}

            {currentStep === 2 && (
              <LuxuryCard className="p-5 gap-4" interactive={false}>
                <Text className="text-[#101828] text-xs font-black uppercase tracking-widest border-b border-zinc-100 pb-2 text-start">Step 2: Fitness & Professional Details</Text>
                
                <View className="gap-3.5">
                  <View>
                    <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-1 text-start">Primary Workout Specialization</Text>
                    <TextInput 
                      value={primaryWorkout} onChangeText={setPrimaryWorkout} placeholder="Strength Training"
                      className="bg-zinc-50 border border-zinc-150 p-3 rounded-xl text-zinc-900 text-xs font-semibold"
                    />
                  </View>
                  <View>
                    <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-1 text-start">Secondary Skills</Text>
                    <TextInput value={secondarySkills} onChangeText={setSecondarySkills} placeholder="HIIT, Core, Boxing Conditioning" className="bg-zinc-50 border border-zinc-150 p-3 rounded-xl text-zinc-900 text-xs font-semibold" />
                  </View>
                  <View>
                    <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-1 text-start">Fitness Qualifications</Text>
                    <TextInput value={fitnessQualifications} onChangeText={setFitnessQualifications} placeholder="ACE Certified Trainer, CPR/AED" className="bg-zinc-50 border border-zinc-150 p-3 rounded-xl text-zinc-900 text-xs font-semibold" />
                  </View>
                  <View>
                    <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-1 text-start">About Me / Coach Bio</Text>
                    <TextInput 
                      value={aboutMe} onChangeText={setAboutMe} multiline numberOfLines={3} placeholder="Tell clients about your coaching style and philosophy..."
                      className="bg-zinc-50 border border-zinc-150 p-3 rounded-xl text-zinc-900 text-xs font-semibold h-20 text-start"
                    />
                  </View>
                </View>
              </LuxuryCard>
            )}

            {currentStep === 3 && (
              <LuxuryCard className="p-5 gap-4" interactive={false}>
                <Text className="text-[#101828] text-xs font-black uppercase tracking-widest border-b border-zinc-100 pb-2 text-start">Step 3: Experience & Working Preferences</Text>
                
                <View className="gap-4">
                  <View className="flex-row gap-2">
                    <View className="flex-1">
                      <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-1 text-start">Years of Experience</Text>
                      <TextInput value={yearsOfExperience} onChangeText={setYearsOfExperience} keyboardType="number-pad" className="bg-zinc-50 border border-zinc-150 p-3 rounded-xl text-zinc-900 text-xs font-semibold" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-1 text-start">Languages Spoken</Text>
                      <TextInput value={languages} onChangeText={setLanguages} placeholder="English, Hindi, Punjabi" className="bg-zinc-50 border border-zinc-150 p-3 rounded-xl text-zinc-900 text-xs font-semibold" />
                    </View>
                  </View>

                  <View>
                    <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-2 text-start">Available Working Days</Text>
                    <View className="flex-row flex-wrap gap-2">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => {
                        const selected = workingDays.includes(day);
                        return (
                          <TouchableOpacity 
                            key={day} onPress={() => toggleDay(day)}
                            className={`px-3.5 py-2 rounded-xl border ${selected ? 'bg-[#101828] border-[#101828]' : 'bg-white border-zinc-200'}`}
                          >
                            <Text className={`text-[9px] font-bold uppercase ${selected ? 'text-white' : 'text-zinc-500'}`}>{day}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  <View>
                    <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-2.5 border-b border-zinc-100 pb-1.5 text-start">Availability Segments</Text>
                    <View className="gap-2.5">
                      <View className="flex-row justify-between items-center">
                        <Text className="text-zinc-700 text-xs font-semibold text-start">Morning Slot (06:00 AM - 12:00 PM)</Text>
                        <Switch value={availabilityMorning} onValueChange={setAvailabilityMorning} trackColor={{ true: '#E11D48' }} />
                      </View>
                      <View className="flex-row justify-between items-center">
                        <Text className="text-zinc-700 text-xs font-semibold text-start">Afternoon Slot (12:00 PM - 04:00 PM)</Text>
                        <Switch value={availabilityAfternoon} onValueChange={setAvailabilityAfternoon} trackColor={{ true: '#E11D48' }} />
                      </View>
                      <View className="flex-row justify-between items-center">
                        <Text className="text-zinc-700 text-xs font-semibold text-start">Evening Slot (04:00 PM - 09:00 PM)</Text>
                        <Switch value={availabilityEvening} onValueChange={setAvailabilityEvening} trackColor={{ true: '#E11D48' }} />
                      </View>
                    </View>
                  </View>

                  <View className="flex-row gap-2">
                    <View className="flex-1">
                      <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-1 text-start">Max Sessions/Day</Text>
                      <TextInput value={maxSessionsPerDay} onChangeText={setMaxSessionsPerDay} keyboardType="number-pad" className="bg-zinc-50 border border-zinc-150 p-3 rounded-xl text-zinc-900 text-xs font-semibold" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-1 text-start">Working Radius (km)</Text>
                      <TextInput value={preferredWorkingRadius} onChangeText={setPreferredWorkingRadius} keyboardType="number-pad" className="bg-zinc-50 border border-zinc-150 p-3 rounded-xl text-zinc-900 text-xs font-semibold" />
                    </View>
                  </View>
                </View>
              </LuxuryCard>
            )}

            {currentStep === 4 && (
              <LuxuryCard className="p-5 gap-4" interactive={false}>
                <Text className="text-[#101828] text-xs font-black uppercase tracking-widest border-b border-zinc-100 pb-2 text-start">Step 4: Document Verification</Text>
                
                <View className="gap-4">
                  {/* Aadhaar Upload */}
                  <View className="flex-row justify-between items-center border-b border-zinc-100 pb-3">
                    <View className="flex-1 pr-3">
                      <Text className="text-zinc-900 text-xs font-semibold text-start">Aadhaar Card (PDF/Image)</Text>
                      {aadhaarUploadStatus === 'UPLOADED' ? (
                        <Text className="text-emerald-600 text-[9px] font-black uppercase mt-1 text-start">✓ Aadhaar Uploaded</Text>
                      ) : aadhaarUploadStatus === 'FAILED' ? (
                        <Text className="text-rose-600 text-[9px] font-black uppercase mt-1 text-start">❌ Upload Failed</Text>
                      ) : (
                        <Text className="text-rose-600 text-[9px] font-black uppercase mt-1 text-start">⚠️ Required</Text>
                      )}
                      {aadhaarVerificationNotes ? (
                        <Text className="text-amber-700 text-[9px] font-semibold mt-0.5 text-start">Notes: {aadhaarVerificationNotes}</Text>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      onPress={() => uploadFile('aadhaar')}
                      disabled={uploadingDoc === 'aadhaar'}
                      className={`px-4 py-2.5 rounded-xl border ${aadhaarUploadStatus === 'UPLOADED' ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-zinc-200'}`}
                    >
                      <Text className={`text-[8.5px] font-black uppercase ${aadhaarUploadStatus === 'UPLOADED' ? 'text-emerald-600' : 'text-zinc-800'}`}>
                        {uploadingDoc === 'aadhaar' ? 'Uploading...' : aadhaarUploadStatus === 'FAILED' ? 'Retry Upload' : documentAadhaar ? 'Replace' : 'Upload'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Aadhaar AI Verification status display */}
                  {verifyingStatus !== 'IDLE' && verifyingStatus !== 'UPLOADING' && (
                    <View className="bg-zinc-50 p-4 rounded-xl border border-zinc-150 gap-3">
                      <View className="flex-row justify-between items-center">
                        <Text className="text-zinc-500 text-[8.5px] font-black uppercase tracking-wider text-start">Aadhaar AI Status</Text>
                        <View className={`px-2 py-0.5 rounded-full ${
                          verifyingStatus === 'VERIFIED' 
                            ? 'bg-green-50 border border-green-200' 
                            : verifyingStatus === 'NAME_MISMATCH' 
                            ? 'bg-rose-50 border border-rose-200' 
                            : verifyingStatus === 'PROCESSING'
                            ? 'bg-blue-50 border border-blue-200'
                            : 'bg-amber-50 border border-amber-200'
                        }`}>
                          <Text className={`text-[7.5px] font-black uppercase ${
                            verifyingStatus === 'VERIFIED' 
                              ? 'text-green-600' 
                              : verifyingStatus === 'NAME_MISMATCH' 
                              ? 'text-rose-600' 
                              : verifyingStatus === 'PROCESSING'
                              ? 'text-blue-600'
                              : 'text-amber-600'
                          }`}>
                            {verifyingStatus === 'PROCESSING' ? 'Processing...' : verifyingStatus}
                          </Text>
                        </View>
                      </View>

                      {verifyingStatus === 'PROCESSING' && (
                        <View className="flex-row items-center gap-2 py-1">
                          <ActivityIndicator size="small" color="#E11D48" />
                          <Text className="text-zinc-600 text-xs font-medium text-start">Reading name on document and verifying...</Text>
                        </View>
                      )}

                      {verifyingStatus === 'VERIFIED' && (
                        <View className="gap-1">
                          <Text className="text-[#101828] text-xs font-semibold text-start">✓ Name Matched Account Successfully</Text>
                          <Text className="text-zinc-500 text-[10px] text-start">Your identity documents are automatically verified.</Text>
                        </View>
                      )}

                      {verifyingStatus === 'NAME_MISMATCH' && (
                        <View className="gap-3">
                          <Text className="text-rose-600 text-xs font-bold text-start">⚠️ Name Mismatch Detected</Text>
                          <View className="bg-white p-3 rounded-lg border border-rose-100 gap-1.5">
                            <Text className="text-[11px] text-zinc-600 text-start">Virla Account Name: <Text className="font-bold text-zinc-800">{fullName}</Text></Text>
                            <Text className="text-[11px] text-zinc-600 text-start">Name extracted from ID: <Text className="font-bold text-zinc-800">{extractedIdName || 'Unreadable'}</Text></Text>
                            {ocrConfidence !== null && (
                              <Text className="text-[10px] text-zinc-400 text-start">Match confidence: {Math.round(ocrConfidence * 100)}%</Text>
                            )}
                          </View>
                          
                          <View className="flex-row gap-2 mt-1">
                            <TouchableOpacity
                              onPress={handleUploadDifferentId}
                              className="flex-1 py-3 bg-zinc-800 rounded-xl items-center justify-center"
                            >
                              <Text className="text-white text-[8px] font-black uppercase tracking-wider text-center">Upload Different ID</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              onPress={handleAttestNames}
                              className="flex-1 py-3 bg-[#E11D48] rounded-xl items-center justify-center"
                            >
                              <Text className="text-white text-[8px] font-black uppercase tracking-wider text-center">Both Names Belong to Me</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}

                      {verifyingStatus === 'MANUAL_REVIEW' && (
                        <View className="gap-1">
                          <Text className="text-amber-600 text-xs font-semibold text-start">ℹ️ Under Manual Review</Text>
                          <Text className="text-zinc-500 text-[10px] text-start">
                            {trainerAttested 
                              ? 'Submitted for manual review (Attested: Both names belong to you).' 
                              : 'Submitted for manual review (AI uncertainty / low confidence).'}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* PAN Upload */}
                  <View className="flex-row justify-between items-center border-b border-zinc-100 pb-3">
                    <View className="flex-1 pr-3">
                      <Text className="text-zinc-900 text-xs font-semibold text-start">PAN Card (PDF/Image)</Text>
                      {panUploadStatus === 'UPLOADED' ? (
                        <Text className="text-emerald-600 text-[9px] font-black uppercase mt-1 text-start">✓ PAN Uploaded</Text>
                      ) : panUploadStatus === 'FAILED' ? (
                        <Text className="text-rose-600 text-[9px] font-black uppercase mt-1 text-start">❌ Upload Failed</Text>
                      ) : (
                        <Text className="text-rose-600 text-[9px] font-black uppercase mt-1 text-start">⚠️ Required</Text>
                      )}
                      {panVerificationNotes ? (
                        <Text className="text-amber-700 text-[9px] font-semibold mt-0.5 text-start">Notes: {panVerificationNotes}</Text>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      onPress={() => uploadFile('pan')}
                      disabled={uploadingDoc === 'pan'}
                      className={`px-4 py-2.5 rounded-xl border ${panUploadStatus === 'UPLOADED' ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-zinc-200'}`}
                    >
                      <Text className={`text-[8.5px] font-black uppercase ${panUploadStatus === 'UPLOADED' ? 'text-emerald-600' : 'text-zinc-800'}`}>
                        {uploadingDoc === 'pan' ? 'Uploading...' : panUploadStatus === 'FAILED' ? 'Retry Upload' : documentPan ? 'Replace' : 'Upload'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Selfie Upload */}
                  <View className="flex-row justify-between items-center border-b border-zinc-100 pb-3">
                    <View className="flex-1 pr-3">
                      <Text className="text-zinc-900 text-xs font-semibold text-start">Profile Selfie Photo</Text>
                      {selfieUploadStatus === 'UPLOADED' ? (
                        <Text className="text-emerald-600 text-[9px] font-black uppercase mt-1 text-start">✓ Selfie Uploaded</Text>
                      ) : selfieUploadStatus === 'FAILED' ? (
                        <Text className="text-rose-600 text-[9px] font-black uppercase mt-1 text-start">❌ Upload Failed</Text>
                      ) : (
                        <Text className="text-rose-600 text-[9px] font-black uppercase mt-1 text-start">⚠️ Required</Text>
                      )}
                    </View>
                    <TouchableOpacity
                      onPress={() => uploadFile('selfie')}
                      disabled={uploadingDoc === 'selfie'}
                      className={`px-4 py-2.5 rounded-xl border ${selfieUploadStatus === 'UPLOADED' ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-zinc-200'}`}
                    >
                      <Text className={`text-[8.5px] font-black uppercase ${selfieUploadStatus === 'UPLOADED' ? 'text-emerald-600' : 'text-zinc-800'}`}>
                        {uploadingDoc === 'selfie' ? 'Uploading...' : selfieUploadStatus === 'FAILED' ? 'Retry Upload' : documentSelfie ? 'Replace' : 'Upload'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Certifications (Optional) */}
                  <View className="flex-row justify-between items-center pb-2">
                    <View className="flex-1 pr-3">
                      <Text className="text-zinc-900 text-xs font-semibold text-start">Fitness Certificates</Text>
                      {certsUploadStatus === 'UPLOADED' ? (
                        <Text className="text-emerald-600 text-[9px] font-black uppercase mt-1 text-start">✓ Certificates Uploaded</Text>
                      ) : certsUploadStatus === 'FAILED' ? (
                        <Text className="text-rose-600 text-[9px] font-black uppercase mt-1 text-start">❌ Upload Failed</Text>
                      ) : (
                        <Text className="text-zinc-400 text-[9px] font-bold uppercase mt-1 text-start">Optional</Text>
                      )}
                    </View>
                    <TouchableOpacity
                      onPress={() => uploadFile('certs')}
                      disabled={uploadingDoc === 'certs'}
                      className={`px-4 py-2.5 rounded-xl border ${certsUploadStatus === 'UPLOADED' ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-zinc-200'}`}
                    >
                      <Text className={`text-[8.5px] font-black uppercase ${certsUploadStatus === 'UPLOADED' ? 'text-emerald-600' : 'text-zinc-800'}`}>
                        {uploadingDoc === 'certs' ? 'Uploading...' : certsUploadStatus === 'FAILED' ? 'Retry Upload' : documentCertifications ? 'Replace' : 'Upload'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </LuxuryCard>
            )}

            <View className="flex-row gap-3 mt-6">
              {currentStep > 1 && (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleBack}
                  className="flex-1 py-4 bg-zinc-200 rounded-xl items-center justify-center"
                >
                  <Text className="text-zinc-800 text-xs font-black uppercase tracking-wider text-center">Back</Text>
                </TouchableOpacity>
              )}
              
              {currentStep < 4 ? (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleNext}
                  className="flex-1 py-4 bg-[#101828] rounded-xl items-center justify-center"
                >
                  <Text className="text-white text-xs font-black uppercase tracking-wider text-center">Next</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleSubmit}
                  disabled={!documentAadhaar || !documentPan || !documentSelfie}
                  style={{
                    shadowColor: '#E11D48',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.15,
                    shadowRadius: 8,
                    elevation: 4
                  }}
                  className={`flex-1 py-4 rounded-xl items-center justify-center ${(!documentAadhaar || !documentPan || !documentSelfie) ? 'bg-zinc-300' : 'bg-[#E11D48]'}`}
                >
                  <Text className="text-white text-xs font-black uppercase tracking-wider text-center">Submit Application</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Custom Picker Selection Overlay */}
      {showPickerModal && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, justifyContent: 'flex-end' }]}>
          <TouchableOpacity activeOpacity={1} onPress={() => setShowPickerModal(false)} style={{ flex: 1 }} />
          <View className="bg-white p-6 rounded-t-3xl gap-4">
            <Text className="text-[#101828] text-sm font-black uppercase tracking-wider text-center">Select Document Source</Text>
            
            <View className="gap-2">
              <TouchableOpacity
                onPress={() => pickDocument('camera')}
                className="py-3.5 bg-zinc-50 rounded-xl border border-zinc-150 flex-row justify-center items-center gap-2"
              >
                <Feather name="camera" size={16} color="#101828" />
                <Text className="text-zinc-800 text-xs font-black uppercase tracking-wider">Take Photo (Camera)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => pickDocument('library')}
                className="py-3.5 bg-zinc-50 rounded-xl border border-zinc-150 flex-row justify-center items-center gap-2"
              >
                <Feather name="image" size={16} color="#101828" />
                <Text className="text-zinc-800 text-xs font-black uppercase tracking-wider">Choose from Gallery (Library)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => pickDocument('file')}
                className="py-3.5 bg-zinc-50 rounded-xl border border-zinc-150 flex-row justify-center items-center gap-2"
              >
                <Feather name="file" size={16} color="#101828" />
                <Text className="text-zinc-800 text-xs font-black uppercase tracking-wider">Choose File (PDF/Docs)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowPickerModal(false)}
                className="py-3.5 bg-zinc-100 rounded-xl items-center mt-2"
              >
                <Text className="text-zinc-600 text-xs font-black uppercase tracking-wider">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Preview and Confirmation Overlay */}
      {showPreview && previewUri && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 10000, justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
          <View className="bg-white rounded-2xl w-full p-5 gap-4">
            <Text className="text-[#101828] text-xs font-black uppercase tracking-widest text-center">Document Preview</Text>
            
            <View className="h-[250px] bg-zinc-50 border border-zinc-200 rounded-xl overflow-hidden justify-center items-center">
              {previewType === 'image' ? (
                <Image source={{ uri: previewUri }} style={{ width: '100%', height: '100%', resizeMode: 'contain' }} />
              ) : (
                <View className="items-center justify-center gap-2">
                  <Feather name="file-text" size={48} color="#E11D48" />
                  <Text className="text-zinc-800 text-xs font-bold px-4 text-center" numberOfLines={2}>{previewName}</Text>
                  <Text className="text-zinc-400 text-[10px] font-medium">PDF Document</Text>
                </View>
              )}
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => {
                  setShowPreview(false);
                  uploadFile(activeUploadType!);
                }}
                className="flex-1 py-3 bg-zinc-100 rounded-xl items-center justify-center"
              >
                <Text className="text-zinc-600 text-xs font-black uppercase tracking-wider">Retake / Change</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={confirmAndUpload}
                className="flex-1 py-3 bg-[#E11D48] rounded-xl items-center justify-center"
              >
                <Text className="text-white text-xs font-black uppercase tracking-wider">Confirm & Upload</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaViewWrapper>
  );
}

function SafeAreaViewWrapper({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: '#F7F8FC', paddingTop: insets.top }}>
      {children}
    </View>
  );
}
