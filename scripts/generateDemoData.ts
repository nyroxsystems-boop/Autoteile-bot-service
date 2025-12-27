import { runSeeding } from '../src/services/seedingService';

async function main() {
    console.log('╔════════════════════════════════════════════╗');
    console.log('║   WAWI Demo Data Generator                 ║');
    console.log('║   Autoteile Assistent System               ║');
    console.log('╚════════════════════════════════════════════╝');

    try {
        // Initialize database first
        const { initDb } = await import('../src/services/database');
        await initDb();
        console.log('✅ Database initialized\n');

        await runSeeding(50); // 50 realistic orders

        console.log('✅ Demo data generation completed successfully!');

    } catch (error) {
        console.error('❌ Error generating demo data:', error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch(err => {
            console.error(err);
            process.exit(1);
        });
}

export { main as generateDemoData };
