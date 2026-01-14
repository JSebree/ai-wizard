
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load envs
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') }); // Fallback

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing Supabase credentials. Found:", {
        URL: !!SUPABASE_URL,
        KEY: !!SUPABASE_KEY,
        VITE_URL: !!process.env.VITE_SUPABASE_URL,
        ENV_URL: !!process.env.SUPABASE_URL
    });
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkLatestJob() {
    console.log("Fetching latest VOD...");
    const { data, error } = await supabase
        .from('express_vods')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error) {
        console.error("Supabase Error:", error);
        return;
    }

    console.log("Latest VOD ID:", data.id);
    console.log("Title:", data.title);
    console.log("Status:", data.status);

    let settings = data.settings;
    if (typeof settings === 'string') {
        settings = JSON.parse(settings);
    }

    console.log("--- DATA VERIFICATION ---");
    console.log("Driver:", settings.driver);
    console.log("Style:", settings.stylePreset);
    console.log("Captions:", settings.wantsCaptions);
    console.log("Resolution:", settings.resolution);
    console.log("Route (Inferred):", settings.route || (settings.driver === 'character' ? 'aroll' : 'broll'));
    console.log("Full Settings Keys:", Object.keys(settings));
}

checkLatestJob();
