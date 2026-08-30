-- Migration: Add Aerial Yoga workout catalog record
-- Created At: 2026-08-30

INSERT INTO public.workouts (
  id, title, icon, description, calories, duration, hero_image, category, benefits, difficulty, equipment, home_visit_badge, session_price, rating, reviews, faqs
) VALUES (
  'w-aerial',
  'ZenFlow Aerial',
  '🧘‍♀️',
  'Defy gravity. Perform guided yoga stretches and core decompression exercises supported by a premium silk hammock to boost spinal flexibility.',
  210,
  55,
  'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=800&q=80',
  'Aerial Yoga',
  ARRAY['Spinal decompression & core alignment', 'Deep upper body & shoulder flexibility', 'Build functional core strength'],
  'Beginner - Medium',
  ARRAY['Aerial hammock', 'Yoga mat'],
  true,
  1500,
  5.0,
  '[]'::jsonb,
  '[]'::jsonb
)
ON CONFLICT (id) DO NOTHING;
