import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://ocbovnvvdmxdejcswmca.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jYm92bnZ2ZG14ZGVqY3N3bWNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNjE1NTAsImV4cCI6MjEwMTkzNzU1MH0.0xGPQeUCsf-2_WktKYhRsodDQbGGkB6UC0tzabaxgIE';

export const supabase = createClient(supabaseUrl, supabaseKey);
