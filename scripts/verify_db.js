const { supabase } = require('../src/db');

async function verifySchema() {
    console.log('🔍 Verifying Jarvis Database Schema...');
    
    if (!supabase) {
        console.error('❌ Supabase client not initialized. Check .env');
        process.exit(1);
    }

    // 1. Check history table
    const { error: histErr } = await supabase.from('history').select('id').limit(1);
    if (histErr) {
        console.error('❌ history table check failed:', histErr.message);
    } else {
        console.log('✅ history table exists.');
    }

    // 2. Check delivery_queue sent_at column
    const { error: sentAtErr } = await supabase.from('delivery_queue').select('sent_at').limit(1);
    
    if (sentAtErr && sentAtErr.message.includes('column "sent_at" does not exist')) {
         console.log('❌ delivery_queue "sent_at" column DOES NOT exist.');
    } else if (sentAtErr) {
        console.warn('⚠️ Could not verify sent_at (unexpected error):', sentAtErr.message);
    } else {
        console.log('✅ delivery_queue "sent_at" column exists.');
    }

    process.exit(0);
}

verifySchema().catch(err => {
    console.error('Fatal Error:', err.message);
    process.exit(1);
});
