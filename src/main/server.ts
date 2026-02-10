import { databaseService } from './services/DatabaseService';
import { botController } from './controllers/BotController';
import { webService } from './services/WebService';
import { setupIpc } from './ipc';

async function startServer() {
    console.log('--- STARTING IN SERVER MODE (HEADLESS) ---');

    // Ensure we are in headless mode
    process.env.HEADLESS = 'true';

    // Initialize core services
    try {
        databaseService.init();
        setupIpc(); // Still setup IPC in case some internal logic depends on it (though window events won't fire)
        botController.init();
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
