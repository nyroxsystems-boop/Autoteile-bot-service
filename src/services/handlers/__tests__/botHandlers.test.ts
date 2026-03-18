import { handleIntent } from '../intentRouter';
import { handleGetOffer } from '../oemHandler';
import { handleCheckOrders } from '../checkOrdersHandler';
import { handleGreeting } from '../greetingHandler';
import { handleStatusQuery } from '../statusHandler';
import { handleDeliveryAddress } from '../deliveryHandler';
import { sendTwilioReply } from '../../queue/botWorker';

// Mock the handlers 
jest.mock('../oemHandler', () => ({ handleGetOffer: jest.fn() }));
jest.mock('../checkOrdersHandler', () => ({ handleCheckOrders: jest.fn() }));
jest.mock('../greetingHandler', () => ({ handleGreeting: jest.fn() }));
jest.mock('../statusHandler', () => ({ handleStatusQuery: jest.fn() }));
jest.mock('../deliveryHandler', () => ({ handleDeliveryAddress: jest.fn() }));

describe('Bot Handlers: Intent Router', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should route "hi" to greeting handler', async () => {
        const text = "Hi bot";
        const from = "whatsapp:+123";
        await handleIntent(text, from, 'IN');
        expect(handleGreeting).toHaveBeenCalled();
    });

    it('should route "status" to status query handler', async () => {
        const text = "wie ist der status meiner bestellung?";
        const from = "whatsapp:+123";
        await handleIntent(text, from, 'IN');
        expect(handleStatusQuery).toHaveBeenCalled();
    });

    it('should route "adresse" to delivery address handler', async () => {
        const text = "meine lieferadresse ist musterhaus 1";
        const from = "whatsapp:+123";
        await handleIntent(text, from, 'IN');
        expect(handleDeliveryAddress).toHaveBeenCalled();
    });

    it('should fallback to OEM handler if intent is unclear', async () => {
        const text = "ich brauche bremsscheiben fÃ¼r einen bmw g20";
        const from = "whatsapp:+123";
        await handleIntent(text, from, 'IN');
        expect(handleGetOffer).toHaveBeenCalled();
    });
});
