-- Add attendance update counter to registrations
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS attendance_update_count integer DEFAULT 0 NOT NULL;

-- Optionally, create an index if you need to query by this field
CREATE INDEX IF NOT EXISTS idx_registrations_update_count ON public.registrations(attendance_update_count);
