
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load envs
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLatest() {
    const { data, error } = await supabase
        .from('express_vods')
        .select('id, title, status, created_at, settings')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error) {
        console.error("Error fetching VOD:", error);
    } else {
        console.log("Latest VOD Status:");
        console.log("-------------------");
        console.log(`ID: ${data.id}`);
        console.log(`Title: ${data.title}`);
        console.log(`Status: ${data.status}`);
        console.log(`Created: ${new Date(data.created_at).toLocaleString()}`);

        // Check for job ID in settings
        const settings = typeof data.settings === 'string' ? JSON.parse(data.settings) : data.settings;
        console.log(`Backend Job ID: ${settings?.jobId || 'Not yet assigned'}`);
    }
}

checkLatest();
