/**
 * STATE MACHINE INDEX
 * 
 * Auto-initializes all state handlers when imported.
 */

import { registerHandler } from './stateMachine';

// Core flow handlers
import { chooseLanguageHandler } from './handlers/chooseLanguageHandler';
import { collectVehicleHandler } from './handlers/collectVehicleHandler';
import { confirmVehicleHandler } from './handlers/confirmVehicleHandler';
import { collectPartHandler } from './handlers/collectPartHandler';
import { oemLookupHandler } from './handlers/oemLookupHandler';

// Offer flow handlers
import { showOffersHandler } from './handlers/showOffersHandler';
import { awaitOfferChoiceHandler } from './handlers/awaitOfferChoiceHandler';
import { awaitOfferConfirmationHandler } from './handlers/awaitOfferConfirmationHandler';

// Post-offer handlers
import { collectDeliveryPreferenceHandler } from './handlers/collectDeliveryPreferenceHandler';
import { collectAddressHandler } from './handlers/collectAddressHandler';
import { doneHandler } from './handlers/doneHandler';

// Register all handlers
registerHandler(chooseLanguageHandler);
registerHandler(collectVehicleHandler);
registerHandler(confirmVehicleHandler);
registerHandler(collectPartHandler);
registerHandler(oemLookupHandler);
registerHandler(showOffersHandler);
registerHandler(awaitOfferChoiceHandler);
registerHandler(awaitOfferConfirmationHandler);
registerHandler(collectDeliveryPreferenceHandler);
registerHandler(collectAddressHandler);
registerHandler(doneHandler);

// Re-export core interfaces
export * from './stateMachine';
