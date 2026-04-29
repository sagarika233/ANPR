import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://iaypkmmfsbsrofirbmhd.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_rFqKjObrhw5Z4n2zT2mDrw_PT-6mPHk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
