-- ONE-OFF: cancel all currently booked (test) sessions. No refunds, no trainer payout.
-- Run manually in Supabase SQL editor. NOT a migration.
UPDATE public.bookings
SET status = 'cancelled', timeline_status = 'SESSION_CLOSED'
WHERE status = 'upcoming';
