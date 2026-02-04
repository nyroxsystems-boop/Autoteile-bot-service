const bcrypt = require('bcrypt');

const password = 'Start123!';

bcrypt.hash(password, 10, (err, hash) => {
    if (err) {
        console.error('Error:', err);
        process.exit(1);
    }
    console.log('Password:', password);
    console.log('Bcrypt Hash:', hash);
    console.log('');
    console.log('SQL to run in Supabase:');
    console.log(`UPDATE users SET password_hash = '${hash}' WHERE username = 'admin';`);
    process.exit(0);
});
