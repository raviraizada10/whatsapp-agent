require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';

let supabase = null;

if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('🔗 Supabase client initialized.');
} else {
    console.warn('⚠️  Supabase URL or Key is missing in .env. Database operations will be mocked or fail.');
}

/**
 * Fetch all active schedules from Supabase
 */
async function getActiveSchedules() {
    if (!supabase) return [];
    
    // Assumes a table named 'schedules' with columns 'id', 'recipient', 'contact_number', 'constraint', 'time_cron', 'is_active'
    const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .eq('is_active', true);

    if (error) {
        console.error('Error fetching schedules:', error);
        return [];
    }
    return data || [];
}

async function getNotificationSetting() {
    if (!supabase) return true; // Default to ON if DB disconnected
    try {
        const { data, error } = await supabase
            .from('settings')
            .select('admin_notifications')
            .eq('id', 1)
            .single();
        if (error) throw error;
        return data ? data.admin_notifications : true;
    } catch (err) {
        return true;
    }
}

async function getContactPersona(phone) {
    if (!supabase) return null;
    try {
        const { data } = await supabase.from('contacts').select('persona_context').eq('phone', phone).single();
        return data ? data.persona_context : null;
    } catch {
        return null;
    }
}

module.exports = {
    supabase,
    getActiveSchedules,
    getNotificationSetting,
    getContactPersona
};
