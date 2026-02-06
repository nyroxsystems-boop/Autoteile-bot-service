/**
 * STATE MACHINE INDEX
 * 
 * Auto-initializes all state handlers when imported.
 */

import { registerHandler } from './stateMachine';
import { chooseLanguageHandler } from './handlers/chooseLanguageHandler';
import { collectVehicleHandler } from './handlers/collectVehicleHandler';
import { collectPartHandler } from './handlers/collectPartHandler';

// Register all handlers
registerHandler(chooseLanguageHandler);
registerHandler(collectVehicleHandler);
registerHandler(collectPartHandler);

// Re-export core interfaces
export * from './stateMachine';
