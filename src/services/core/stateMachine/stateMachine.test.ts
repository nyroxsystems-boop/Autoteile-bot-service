/**
 * State Machine Unit Tests
 * 
 * Tests the core state machine architecture.
 */

import {
    registerHandler,
    getHandler,
    executeState,
    createHandler,
    StateContext,
    StateResult
} from '../stateMachine';

describe('stateMachine', () => {
    describe('createHandler', () => {
        it('creates a valid handler object', () => {
            const handler = createHandler(
                'TestHandler',
                ['choose_language'],
                async () => ({
                    reply: 'test',
                    nextStatus: 'collect_vehicle' as const,
                    shouldPersistStatus: true
                })
            );

            expect(handler.name).toBe('TestHandler');
            expect(handler.handles).toContain('choose_language');
            expect(typeof handler.handle).toBe('function');
        });
    });

    describe('registerHandler / getHandler', () => {
        it('registers and retrieves a handler', () => {
            const testHandler = createHandler(
                'MockChooseLanguage',
                ['choose_language'],
                async () => ({
                    reply: 'registered',
                    nextStatus: 'collect_vehicle' as const,
                })
            );

            registerHandler(testHandler);
            const retrieved = getHandler('choose_language');

            expect(retrieved).not.toBeNull();
            expect(retrieved?.name).toBe('MockChooseLanguage');
        });
    });

    describe('executeState', () => {
        it('executes handler and returns result', async () => {
            const mockHandler = createHandler(
                'ExecuteTestHandler',
                ['collect_vehicle'],
                async (ctx: StateContext): Promise<StateResult> => ({
                    reply: `Hello ${ctx.language}`,
                    nextStatus: 'collect_part',
                })
            );

            registerHandler(mockHandler);

            const ctx: StateContext = {
                orderId: 'test-123',
                order: { id: 'test-123' },
                orderData: {},
                language: 'de',
                userText: 'Test message',
                parsed: {},
                currentStatus: 'collect_vehicle'
            };

            const result = await executeState('collect_vehicle', ctx);

            expect(result.reply).toBe('Hello de');
            expect(result.nextStatus).toBe('collect_part');
        });

        it('returns error reply for unregistered state', async () => {
            const ctx: StateContext = {
                orderId: 'test-456',
                order: { id: 'test-456' },
                orderData: {},
                language: 'en',
                userText: 'Test',
                parsed: {},
                currentStatus: 'done' // Not registered
            };

            const result = await executeState('done', ctx);

            expect(result.reply).toContain('unexpected error');
            expect(result.nextStatus).toBe('done'); // Stays in same state
        });
    });
});
