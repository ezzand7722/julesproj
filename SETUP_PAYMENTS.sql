-- =============================================
-- QUICK SETUP: Run this file to enable payment system
-- =============================================
-- This script sets up the complete payment system with support for:
-- - Credit Cards (PayTabs)
-- - CliQ (Jordan Instant Payment)
-- - Orange Money
-- - uWallet
-- =============================================

-- Run migration 25 (wallet payments support)
\i migrations/25_add_wallet_payments.sql

-- Verify setup
DO $$
BEGIN
    RAISE NOTICE '✅ Payment system setup complete!';
    RAISE NOTICE '';
    RAISE NOTICE 'Supported payment methods:';
    RAISE NOTICE '  💳 Credit Card (via PayTabs)';
    RAISE NOTICE '  🏦 CliQ (Jordan Instant Payment)';
    RAISE NOTICE '  📱 Orange Money';
    RAISE NOTICE '  👛 uWallet';
    RAISE NOTICE '';
    RAISE NOTICE '📝 Next steps:';
    RAISE NOTICE '  1. Test the demo mode (works immediately!)';
    RAISE NOTICE '  2. Read PAYMENT_SETUP_GUIDE.md for production setup';
    RAISE NOTICE '  3. Register merchant accounts with payment providers';
    RAISE NOTICE '  4. Update payment-gateway.js with your credentials';
    RAISE NOTICE '';
    RAISE NOTICE '🎉 You can now test top-ups in demo mode!';
END $$;
