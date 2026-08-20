# VIRLA PRE-ONE-BRAIN BASELINE DOCUMENTATION

This document represents the official and verified baseline of the Virla application immediately before the implementation of the "Single Brain" timezone-safe architecture changes. Future modifications must preserve existing functionality, and any changes to business workflows must refer to this baseline.

---

## A. RELEASE INFORMATION
- **App Name**: Virla
- **App Version**: `1.0.0`
- **Build Number**: `58`
- **Bundle Identifier**: `com.varshaniviral.Virla`
- **Expo SDK Version**: `~57.0.13`
- **React Native Version**: `0.86.2`
- **Node.js Version**: `v25.6.1`
- **Git Branch**: `main`
- **Git Commit SHA**: `f471d59f9b3ef01af2798298b93e797ad6a4d2f4`
- **Git Tag**: `virla-pre-one-brain-baseline`
- **EAS Profile**: `production`
- **EAS Build ID**: `57dafcde-3396-4b14-8945-c813877f41e2`
- **EAS Build URL**: `https://expo.dev/accounts/varshaniviral/projects/Virla/builds/57dafcde-3396-4b14-8945-c813877f41e2`

---

## B. AUTHENTICATION
- **OTP Authentication**: Supported via MSG91 widget configuration. Users request a verification code via mobile, which is validated by a dedicated verify-otp handler.
- **New User Registration & Profile Setup**: When a new number registers, a mock profile setup screen collects basic details (name, age, gender, fitness goals) and inserts it atomically into `public.users` and `public.user_profiles` tables via the `create_user_with_profile` database function.
- **Session Persistence & Logout**: Authenticated state is managed client-side using `zustand` and persisted in `AsyncStorage` / `SecureStore`. Logging out clears local state keys and resets navigation roots.
- **Admin & Trainer Authentication**: Admin users authenticate with credentials (or mock admin profile roles matching status flags in the database). Trainers log in using their verified phone number.

---

## C. USER / ROLE SYSTEM
- **User Roles**: Defined strictly by the `role` check constraint on `public.users(role)`:
  - `customer` (Standard customer app views)
  - `trainer` (Access to Trainer Console tab)
  - `admin` (Access to Admin Console and system metrics)
- **Role Assignment & Permissions**: Determined by querying `public.users.role`. RLS policies are enabled on all tables but allow simulated client-side inserts/reads via `FOR ALL USING (true) WITH CHECK (true)` policies to simplify client offline synchronization.

---

## D. MEMBERSHIP / CREDITS
- **Membership Status**:
  - `Standard` or `Premium` levels tracked inside `public.user_profiles.membership_status`.
- **Credits & Credit Wallet**:
  - Customer profile stores `credits_balance` inside `public.user_profiles`.
  - Bookings deduct client credits balance inside `addBooking` / `addDirectBooking`.
  - Transaction history is recorded inside `public.credit_transactions`.

---

## E. TRAINER AVAILABILITY & APPLICATION
- **Trainer Onboarding Application**: New applicants submit details (Aadhaar, PAN, experience, photos, emergency contact) to `public.trainer_applications`. Status transitions are managed via admin approval functions.
- **Admin Approval Flow**: Admin approves applications via `approve_trainer_application` RPC. This creates a trainer profile inside `public.trainers`, registers their details, and flags them as a verified trainer.
- **Trainer Availability & Slots**: Approved trainers set availability arrays and weekly working slots. Time slots are stored in `availability` text arrays.

---

## F. BOOKING WORKFLOW
- **Slot Discovery & Selection**: Clients search for workouts and check trainer availability windows.
- **Slot Reservation**: Temporary slot reservations are recorded in `public.slot_reservations` with an expiry timestamp (`expires_at`) to prevent double reservations.
- **Booking Request Insertion**: Confirming booking creates exactly one record in `public.bookings` with status `upcoming` and timeline status `booked`.
- **Trainer Notification Escalation**:
  - **T = 0**: First notification is sent to the trainer (`New Session Request`).
  - **T + 5 minutes**: Second notification reminder is sent if still pending.
  - **T + 10 minutes**: Third notification is sent, and system auto-accepts the request.
- **Manual vs Auto-Acceptance**:
  - Manual accept sets `acceptance_method = 'manual'` and `trainer_accepted_at` timestamp.
  - Auto-accept (server-side via database cron) sets `acceptance_method = 'auto'` and `auto_accepted_at` timestamp, sending an operational warning to the admin.

---

## G. SESSION WORKFLOW
- **Travel Window**: Trainer can start travel (transition to `trainer_travelling`) exactly within `25 minutes` before the scheduled workout start time. Early travel attempts are rejected by the trigger check.
- **Arrival**: Trainer clicks "Arrived" to update timeline status to `trainer_arrived`.
- **Check-in OTP**: Client provides the 4-digit session OTP (saved on the booking row) to the trainer.
- **Start Workout**: OTP validation transitions the booking timeline status to `otp_verified` and then `workout_started`.
- **Completion & Report**: Workouts are marked `workout_completed` (which updates `status` to `completed` in the database). The trainer submits a performance report, transitioning status to `trainer_report_submitted`.
- **Customer Review & Closure**: Client leaves rating/feedback, transitioning status to `customer_review_pending` and finally `session_closed`.

---

## H. ADMIN PANEL
- **Admin Dashboard**: Displays active ongoing sessions, upcoming bookings lists, total earnings, active users, and onboarding trainer applications.
- **Verification Logs**: Displays acceptance logs clearly demarcating whether a session was confirmed manually (`MANUALLY ACCEPTED`) or automatically (`AUTO-ACCEPTED`) along with the acceptance timestamp.

---

## I. DATABASE SCHEMA SNAPSHOT
- **Supabase Reference**: `ferowbqvgsbbovnwqkae`
- **Tables**:
  - `public.users` (id, name, phone, email, password_hash, avatar, role, status, created_date, last_login, device_info, notification_prefs)
  - `public.user_profiles` (id, user_id, age, gender, height, weight, fitness_goal, preferred_workout, emergency_contact, medical_notes, membership_status, credits_balance, dob, fitness_level, preferred_language, city, member_since, selected_goals)
  - `public.trainers` (id, name, photo, experience, rating, specialty, years_experience, languages, short_bio, completed_sessions, about_text, level, verified_badge, preferences)
  - `public.workouts` (id, title, icon, description, calories, duration, category, benefits, difficulty, equipment, session_price, rating)
  - `public.bookings` (id, status, timeline_status, otp, client_name, client_phone, trainer_name, trainer_photo, date, time, workout_title, price, address, client_id, trainer_id, rating_details, travel_started_at, workout_completed_at, acceptance_notification_count, last_acceptance_notification_at, acceptance_method, acceptance_deadline, auto_accepted_at, trainer_accepted_at)
  - `public.slot_reservations` (id, slot_time, slot_date, trainer_id, client_id, expires_at)
  - `public.notifications` (id, user_id, title, body, read, timestamp, "group", icon)
  - `public.chat_messages` (id, chat_id, sender, text, timestamp)
  - `public.addresses` (id, user_id, label, name, building, street, landmark, city, pin_code, is_default)
  - `public.trainer_applications` (id, status, full_name, phone, email, dob, gender, avatar, documents, bank_details)
- **Functions & Triggers**:
  - `validate_booking_transition()`: Timeline status machine transitions validation check (enforces 10-minute acceptance window, travel time offsets).
  - `on_booking_status_updated()`: Client notification triggers.
  - `process_pending_acceptance_bookings()`: T+5m reminders and T+10m auto-acceptance.
  - `get_server_time()`: Authoritative NTP clock reference.

---

## J. KNOWN ISSUES
- **PRE-EXISTING ISSUE**: Local clock drift on client devices can mismatch local notifications timers from the server clock.
- **PRE-EXISTING ISSUE**: Push notifications are sent via Expo services; local device notification sound configurations may not render if device permissions are revoked.

---

## K. BASELINE RULE
This document represents the Virla application state immediately before the Single Brain architecture project. Future changes must not accidentally remove or alter existing working functionality. Any intentional business logic change must be explicitly documented and approved.
