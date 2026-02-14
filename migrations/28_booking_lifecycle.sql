-- =============================================
-- Migration 28: Booking Lifecycle Management
-- Handles: ghosted bookings, overdue confirmed, old completed cleanup
-- =============================================

-- 1. Add lifecycle tracking columns to bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS archived_at timestamptz DEFAULT NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS auto_action_at timestamptz DEFAULT NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS lifecycle_notified boolean DEFAULT false;

-- 2. Update the status check constraint to include 'auto_cancelled' and 'auto_completed'
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check 
  CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'auto_cancelled', 'auto_completed'));

-- 3. Create a notifications table for lifecycle events
CREATE TABLE IF NOT EXISTS booking_notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  user_role text NOT NULL CHECK (user_role IN ('customer', 'provider')),
  notification_type text NOT NULL CHECK (notification_type IN (
    'ghosted_warning',       -- pending too long, customer warned
    'ghosted_auto_cancel',   -- auto-cancelled after no response
    'overdue_reminder',      -- confirmed but past date, provider reminded
    'overdue_auto_complete', -- auto-completed after provider didn't act
    'completed_archived'     -- old completed booking archived
  )),
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 4. RLS for booking_notifications
ALTER TABLE booking_notifications ENABLE ROW LEVEL SECURITY;

-- Users can see their own notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON booking_notifications;
CREATE POLICY "Users can view own notifications" ON booking_notifications
  FOR SELECT USING (user_id = auth.uid());

-- Users can update (mark read) their own notifications  
DROP POLICY IF EXISTS "Users can update own notifications" ON booking_notifications;
CREATE POLICY "Users can update own notifications" ON booking_notifications
  FOR UPDATE USING (user_id = auth.uid());

-- Allow insert from authenticated users (the cleanup functions run client-side)
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON booking_notifications;
CREATE POLICY "Authenticated users can insert notifications" ON booking_notifications
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow delete of own notifications
DROP POLICY IF EXISTS "Users can delete own notifications" ON booking_notifications;
CREATE POLICY "Users can delete own notifications" ON booking_notifications
  FOR DELETE USING (user_id = auth.uid());

-- 5. Index for faster lifecycle queries
CREATE INDEX IF NOT EXISTS idx_bookings_status_date ON bookings(status, service_date);
CREATE INDEX IF NOT EXISTS idx_bookings_archived ON bookings(archived) WHERE archived = false;
CREATE INDEX IF NOT EXISTS idx_booking_notifications_user ON booking_notifications(user_id, is_read);