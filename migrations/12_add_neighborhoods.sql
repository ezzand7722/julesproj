-- =============================================
-- ADD NEIGHBORHOOD SUPPORT TO PROVIDERS
-- Adds neighborhood/district field for more precise location filtering
-- =============================================

-- Add neighborhood column to providers
ALTER TABLE public.providers 
ADD COLUMN IF NOT EXISTS neighborhood TEXT;

-- Create index for faster neighborhood queries
CREATE INDEX IF NOT EXISTS idx_providers_neighborhood ON public.providers(neighborhood);

-- Update some existing providers with sample neighborhoods
-- Amman neighborhoods
UPDATE public.providers 
SET neighborhood = 'عبدون'
WHERE city = 'عمان' AND id IN (SELECT id FROM public.providers WHERE city = 'عمان' LIMIT 1);

UPDATE public.providers 
SET neighborhood = 'الصويفية'
WHERE city = 'عمان' AND neighborhood IS NULL AND id IN (SELECT id FROM public.providers WHERE city = 'عمان' AND neighborhood IS NULL LIMIT 1);

UPDATE public.providers 
SET neighborhood = 'مرج الحمام'
WHERE city = 'عمان' AND neighborhood IS NULL AND id IN (SELECT id FROM public.providers WHERE city = 'عمان' AND neighborhood IS NULL LIMIT 1);

-- Zarqa neighborhoods
UPDATE public.providers 
SET neighborhood = 'الزرقاء الجديدة'
WHERE city = 'الزرقاء' AND neighborhood IS NULL AND id IN (SELECT id FROM public.providers WHERE city = 'الزرقاء' AND neighborhood IS NULL LIMIT 1);

-- Irbid neighborhoods
UPDATE public.providers 
SET neighborhood = 'حي الحسين'
WHERE city = 'اربد' AND neighborhood IS NULL AND id IN (SELECT id FROM public.providers WHERE city = 'اربد' AND neighborhood IS NULL LIMIT 1);

-- Comment: Run this migration in Supabase SQL Editor
