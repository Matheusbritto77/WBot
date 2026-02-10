import { join } from 'path';
import { existsSync } from 'fs';
import { databaseService } from './services/DatabaseService';
import { botController } from './controllers/BotController';
import { webService } from './services/WebService';

async function startServer() {
    console.log('--- STARTING IN SERVER MODE (HEADLESS) ---');

    // Initialize services
    databaseService.init();
    botController.init();

    // Serve static files if in production
    // In VPS, we usually run after 'npm run build'
    // The build output for renderer is in 'out/renderer' or similar
    const rendererPath = join(process.cwd(), 'out', 'renderer');

    if (existsSync(rendererPath)) {
        console.log(`[Server] Serving renderer from: ${rendererPath}`);
        // We'll need to update WebService to support static file serving
    }

    await webService.init();

    console.log('--- SERVER MODE ACTIVE ---');
}

startServer().catch(err => {
    console.error('Fatal error starting server:', err);
    process.exit(1);
});
