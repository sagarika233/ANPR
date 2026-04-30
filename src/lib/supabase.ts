import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = (supabaseUrl && supabaseUrl.startsWith('https://')) 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
