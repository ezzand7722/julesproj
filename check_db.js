const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://rkhkvmcnjuwoxammhsqn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJraGt2bWNuanV3b3hhbW1oc3FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzODk0MjcsImV4cCI6MjA4NTk2NTQyN30.iGTVKa7iap8MLZ8v0efCvzsqzviNBbacVfEDxQGDsZQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkColumns() {
    console.log("Checking providers table columns...");

    // Try to select the new columns
    const { data, error } = await supabase
        .from('providers')
        .select('social_facebook, social_instagram, social_website')
        .limit(1);

    if (error) {
        console.error("❌ Error selecting columns:", error.message);
        console.error("This means the migration '13_add_social_links.sql' was NOT run correctly.");
        console.log("Please copy the content of 'migrations/13_add_social_links.sql' and run it in the Supabase SQL Editor.");
    } else {
        console.log("✅ Columns exist! The database is ready.");
        console.log("Data sample:", data);
    }
}

checkColumns();
