-- The green-tshirt placeholder portrait is no longer shipped with the app.
-- Blanking these rows makes every renderer fall back to the bundled
-- male/female trainer default avatar instead of that stock photo.
update public.trainers set photo = ''
  where photo like '%photo-1568602471122%' or photo like '%master_trainer_coach%';

update public.users set avatar = ''
  where avatar like '%photo-1568602471122%' or avatar like '%master_trainer_coach%';

update public.bookings set trainer_photo = ''
  where trainer_photo like '%photo-1568602471122%' or trainer_photo like '%master_trainer_coach%';
