
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log("URL:", supabaseUrl);
// console.log("Key:", supabaseKey); // Don't log full key

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing credentials in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
    console.log("Testing connection...");
    const { data, error } = await supabase.from('players').select('count', { count: 'exact', head: true });

    if (error) {
        console.error("Connection Error:", error.message);
    } else {
        console.log("Connection Success! Supabase is reachable.");
    }
}

testConnection();
