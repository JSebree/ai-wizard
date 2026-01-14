import dotenv from 'dotenv';
import path from 'path';

// Load from backend root .env (for standalone backend runs)
dotenv.config({ path: path.resolve(__dirname, '../.env') });
// Load from project root .env (monorepo style)
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

console.log("Loading .env.local & .env from:", path.resolve(__dirname, '../../'));
console.log("Supabase Keys found:", Object.keys(process.env).filter(k => k.includes('SUPABASE')));
// Config object
export const CONFIG = {
    PORT: process.env.PORT || 3001,
    SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    SUPABASE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY, // Prefer Service Role for Backend ops
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    RUNPOD_API_KEY: process.env.RUNPOD_API_KEY || process.env.VITE_RUNPOD_API_KEY,
    I2V_API_URL: process.env.I2V_API_URL || process.env.VITE_I2V_API_URL, // LTX/Hunyuan Endpoint
    TAVILY_API_KEY: process.env.TAVILY_API_KEY || process.env.VITE_TAVILY_API_KEY,
    SPACES_KEY: process.env.SPACES_KEY,
    SPACES_SECRET: process.env.SPACES_SECRET,
    SPACES_BUCKET: process.env.SPACES_BUCKET,
};

if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_KEY) {
    console.warn("Missing Supabase Credentials! Check your .env file.");
}
