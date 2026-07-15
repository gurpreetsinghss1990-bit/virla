# Implementation Plan: VIRLA Sprint 3 (Complete Booking Flow)

This document details the plan to implement Sprint 3 of **VIRLA**, India's premium home wellness membership platform. We will focus on building the complete booking experience from workout details to confirmation, including a filtered bookings dashboard and detailed session page.

No Firebase, Firestore, or backend connections will be built in this sprint.

---

## Architecture & Navigation Flow

We will add three new navigation routes and update the existing bookings tab:

1.  **Workout Detail Screen (`src/app/workout-detail.tsx`)**: Displays specific workout specifications, difficulty levels, required gear, and a "Book Session" trigger.
2.  **Booking Wizard Screen (`src/app/booking.tsx`)**: A premium multi-step transaction screen running Steps 2 to 8:
    *   *Step 2*: Location Selection (Home, Society Gym, My Gym, Outdoor).
    *   *Step 3*: Session Beneficiary (Myself, Family, Friend with custom sub-fields).
    *   *Step 4*: Date Picker (Custom Apple-style next 30-day selector).
    *   *Step 5*: Time Selector (6 AM to 10 PM slots).
    *   *Step 6*: Mock Matchmaker (2-second loading animation + coach assignment card).
    *   *Step 7*: Booking Summary (Quota metrics, confirmation summary).
    *   *Step 8*: Confirmation Splash (Success animation, navigational buttons).
3.  **Session Detail Screen (`src/app/session-detail.tsx`)**: In-depth schedule viewing showing coach profiles, training instructions, notes, and support utilities.
4.  **Refactored Bookings Tab (`src/app/(tabs)/bookings.tsx`)**: Filtered tabs segmenting "Upcoming", "Completed", and "Cancelled" bookings.

---

## Proposed Changes

### Phase 1: Reusable Components
We will build the 10 custom booking components in `src/components/`:
*   `WorkoutDetailCard`: Summary view of workout details.
*   `LocationCard`: Selectable card options for venue.
*   `MemberCard`: Family list item selector.
*   `DatePicker`: Grid calendar displaying next 30 days.
*   `TimeSlotCard`: Gridded time-selection capsules.
*   `CoachCard` (updated): Expanded coach card showing matches and stats.
*   `BookingSummaryCard`: Confirmation checklist.
*   `BookingStatusBadge`: Visual label for active, completed, or cancelled statuses.
*   `SuccessAnimation`: Premium visual confirmation checkmark.
*   `BookingCard`: Row card inside the Bookings Tab.

### Phase 2: State Extensions
We will extend **Booking Store (`bookingStore.ts`)**:
*   Add cancelled bookings list and mock completed/cancelled records.
*   Implement `cancelSession(id)` and `rescheduleSession(id, date, time)` state modifiers.
*   Integrate mock family data inside `userStore.ts`.

### Phase 3: Route Integration
1.  Add `src/app/workout-detail.tsx`.
2.  Add `src/app/booking.tsx` with step-by-step layouts and animations.
3.  Add `src/app/session-detail.tsx`.
4.  Update `src/app/(tabs)/bookings.tsx` with filters and detailed actions.
5.  Link home dashboard taps (Workout card click) to route directly to `workout-detail`.

---

## Verification Plan

### Automated Verification
- Run typescript compilation `npx tsc --noEmit` to ensure no syntax/type issues.

### Manual Verification
- Test selecting "Strength Training" from Home -> View Workout Details -> Start Booking -> Select Location -> Select Myself -> Select Date/Time -> Watch matchmaker assign a coach -> View Booking Summary -> Confirm -> Verify remaining credits update -> View Details in Bookings tab.
