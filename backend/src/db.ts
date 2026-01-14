import { createClient } from '@supabase/supabase-js';
import { CONFIG } from './config';

export const supabase = createClient(CONFIG.SUPABASE_URL as string, CONFIG.SUPABASE_KEY as string);

console.log(`Connected to Supabase at ${CONFIG.SUPABASE_URL}`);
