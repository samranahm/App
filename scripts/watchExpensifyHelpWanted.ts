/**
 * @deprecated Use orchestrateExpensifyWatchers.ts instead.
 * Kept for backwards compatibility with existing automations.
 */
import {orchestrate} from './orchestrateExpensifyWatchers';

async function main(): Promise<void> {
    const result = await orchestrate(false);
    console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
    main().catch((error: Error) => {
        console.error(error.message);
        process.exit(1);
    });
}
