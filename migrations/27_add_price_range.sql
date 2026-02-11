-- Add price range columns to providers table
-- Allows providers to display a general price range on homepage
ALTER TABLE providers ADD COLUMN IF NOT EXISTS price_range_min NUMERIC DEFAULT NULL;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS price_range_max NUMERIC DEFAULT NULL;
