# Virla Core Booking Stable Checkpoint

- **Checkpoint Name**: Virla Core Booking Milestone — Client Booking Visible to Trainer
- **Date**: 2026-08-28
- **Git Branch**: `virla/one-brain-phase-2`
- **Git Tag**: `virla-core-booking-stable-2026-08-28`
- **Remote Supabase Project**: `ferowbqvgsbbovnwqkae` (URL: `https://ferowbqvgsbbovnwqkae.supabase.co`)

---

## Recovery Baseline

This checkpoint represents the stable, working recovery point of the Virla application core booking journey. All features below have been fully tested and validated on the physical iPhone development build.

### Locked Feature List

#### 1. Client Journey
- OTP Login (MSG91 OTP verification)
- Client Profile Creation & Editing (persists across app restarts)
- Credit Purchase/Wallet Top-up (Apple Pay simulated transactions)
- Wallet Balance visibility & Credit Transfer
- Client Location setup
- Trainer Discovery & Category eligibility
- Trainer availability slots visibility
- Booking Creation from enabled trainer slot
- Credit deduction logic (1 credit for solo, 2 credits for couple sessions)

#### 2. Trainer Journey
- Trainer Registration & Application submission
- Trainer Login & Module access (after Admin approval)
- Trainer Profile management
- Available Slot Enable / Disable (toggles availability overrides in `public.trainers`)
- Day availability toggles
- Trainer Specialty Workout Requests (`public.trainer_workout_assignments`)
- Incoming customer booking request visibility & notification

#### 3. Administrative Controls
- Admin Application review & Trainer approvals
- Specialty Workout Request approvals
- Trainer and Booking data lookup

---

## Release & TestFlight Development Guidelines
1. **This Checkpoint is the Recovery Baseline**: If any subsequent development breaks the booking flow or database RLS configurations, return to this commit immediately.
2. **Strict Module Freeze**: Do not modify, refactor, or rewrite authentication, wallet transactions, booking creation, slot toggling, or profile management unless explicitly authorized.
