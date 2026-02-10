import { databaseService } from './services/DatabaseService';
import { botController } from './controllers/BotController';
import { webService } from './services/WebService';

async function startServer() {
    console.log('--- STARTING IN SERVER MODE (HEADLESS) ---');

    // Ensure we are in headless mode
    process.env.HEADLESS = 'true';

    // Initialize core services
    try {
        console.log('[Server] Initializing Database...');
        databaseService.init();

        console.log('[Server] Initializing Bot Controller...');
        botController.init();

        console.log('[Server] Initializing Web Service...');
        await webService.init();

        console.log('--- SERVER MODE ACTIVE AND READY ---');
    } catch (err) {
        console.error('Failed to initialize server services:', err);
        process.exit(1);
    }
}

startServer().catch(err => {
    console.error('Fatal error starting server:', err);
    process.exit(1);
});
