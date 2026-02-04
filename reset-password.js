const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://mtuzosoqkizpwfvkcutv.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10dXpvc29xa2l6cHdmdmtjdXR2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDk1MzE4MSwiZXhwIjoyMDgwNTI5MTgxfQ.qFtHPpHB25j5Snu8GPP1ZSwuwTwMe2tcyVeCsdn8zgo';

const supabase = createClient(supabaseUrl, supabaseKey);

// Bcrypt hash for 'Start123!'
const bcryptHash = '$2b$10$eEojQmnt0tyB2Md3vUonQeWmEi3DV1BFQppqxspnbgxUpEbss8lzO';

async function resetPassword() {
    console.log('Updating password for user "admin"...');

    const { data, error } = await supabase
        .from('users')
        .update({ password_hash: bcryptHash })
        .eq('username', 'admin')
        .select();

    if (error) {
        console.error('Error:', error);
        process.exit(1);
    }

    console.log('✅ Password updated successfully!');
    console.log('Updated user:', data);
    console.log('\nNew password: Start123!');
    process.exit(0);
}

resetPassword();
