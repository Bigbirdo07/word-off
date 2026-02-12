import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kofdwqrhtpkvftaroqsn.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvZmR3cXJodHBrdmZ0YXJvcXNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NTgzMjYsImV4cCI6MjA4NjIzNDMyNn0.LpdVJAz1hoxAQqCWPl2FoCnjjP1Rdc3xuAzRW7A_U28';

export const supabase = createClient(supabaseUrl, supabaseKey);
