-- Migration: Trainer Workout Assignments Table
-- Created At: 2026-08-13

-- Create trainer_workout_assignments table
CREATE TABLE IF NOT EXISTS public.trainer_workout_assignments (
    id TEXT PRIMARY KEY,
    trainer_id TEXT REFERENCES public.trainers(id) ON DELETE CASCADE,
    workout_category TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'REMOVAL_REQUESTED', 'REMOVED')),
    requested_at BIGINT NOT NULL,
    approved_at BIGINT,
    approved_by TEXT,
    rejected_at BIGINT,
    rejected_by TEXT,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Grant client access permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trainer_workout_assignments TO anon, authenticated;

-- Enable RLS
ALTER TABLE public.trainer_workout_assignments ENABLE ROW LEVEL SECURITY;

-- Disable existing policy if present and create read/write policy
DROP POLICY IF EXISTS "Enable read/write for simulation trainer_workout_assignments" ON public.trainer_workout_assignments;
CREATE POLICY "Enable read/write for simulation trainer_workout_assignments" ON public.trainer_workout_assignments FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime for trainer_workout_assignments
do $$
begin
  -- Add table to publication if it's not already in it
  if not exists (
    select 1 
    from pg_publication_tables 
    where pubname = 'supabase_realtime' and tablename = 'trainer_workout_assignments'
  ) then
    alter publication supabase_realtime add table public.trainer_workout_assignments;
  end if;
exception
  when others then null;
end $$;
