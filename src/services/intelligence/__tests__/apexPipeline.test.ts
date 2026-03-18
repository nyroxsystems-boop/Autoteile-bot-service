import { resolveOemApex } from '../apexPipeline';
import { databaseSource } from '../sources/databaseSource';
import { geminiGroundedOemSource } from '../sources/geminiGroundedOemSource';
import * as adversaryValidator from '../adversaryValidator';

// Mock dependencies
jest.mock('../sources/databaseSource');
jest.mock('../sources/geminiGroundedOemSource');
jest.mock('../adversaryValidator');
jest.mock('../../core/alertService', () => ({
    trackOemResolutionResult: jest.fn()
}));
jest.mock('../oemMetrics', () => ({
    recordOemResolution: jest.fn()
}));
jest.mock('../oemLearner', () => ({
    learnFromResolution: jest.fn()
}));
jest.mock('../accuracyTracker', () => ({
    trackResolution: jest.fn()
}));

const mockDatabaseSource = databaseSource as jest.Mocked<typeof databaseSource>;
const mockGeminiSource = geminiGroundedOemSource as jest.Mocked<typeof geminiGroundedOemSource>;
const mockAdversary = adversaryValidator as jest.Mocked<typeof adversaryValidator>;

describe('APEX Pipeline', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return DB hit if confidence is very high (Phase 1)', async () => {
        // Arrange
        mockDatabaseSource.resolveCandidates.mockResolvedValue([
            { oem: 'DB123', confidence: 0.95, source: 'database', method: 'exact' }
        ]);

        // Act
        const req = { orderId: 'test1', partName: 'Brake Pad', vehicle: { make: 'BMW', model: '320i', year: 2010 } };
        const result = await resolveOemApex(req);

        // Assert
        expect(result.success).toBe(true);
        expect(result.oemNumber).toBe('DB123');
        expect(result.metadata.phaseName).toBe('DB_CACHE_HIT');
        expect(mockGeminiSource.resolveCandidates).not.toHaveBeenCalled();
    });

    it('should fallback to Gemini if DB hit is low confidence (Phase 2)', async () => {
        // Arrange
        mockDatabaseSource.resolveCandidates.mockResolvedValue([
            { oem: 'DB123', confidence: 0.80, source: 'database', method: 'fuzzy' }
        ]);
        mockGeminiSource.resolveCandidates.mockResolvedValue([
            { oem: 'GEM456', confidence: 0.85, source: 'gemini', method: 'ai' }
        ]);
        mockAdversary.isAdversaryAvailable.mockReturnValue(false);

        // Act
        const req = { orderId: 'test2', partName: 'Brake Pad', vehicle: { make: 'BMW' } };
        const result = await resolveOemApex(req);

        // Assert
        expect(result.success).toBe(true);
        expect(result.oemNumber).toBe('GEM456'); // Gemini overrides lower conf DB
        expect(mockGeminiSource.resolveCandidates).toHaveBeenCalled();
    });

    it('should use Claude Adversary if Gemini confidence is border-line (Phase 3)', async () => {
        // Arrange
        mockDatabaseSource.resolveCandidates.mockResolvedValue([]);
        mockGeminiSource.resolveCandidates.mockResolvedValue([
            { oem: 'GEM456', confidence: 0.75, source: 'gemini', method: 'ai' }
        ]);
        
        mockAdversary.isAdversaryAvailable.mockReturnValue(true);
        mockAdversary.validateWithAdversary.mockResolvedValue({
            verdict: 'CONFIRMED',
            reason: 'Matches part dimensions.',
            confidenceAdjustment: +0.15,
            latencyMs: 1000
        });

        // Act
        const req = { orderId: 'test3', partName: 'Brake Pad', vehicle: { make: 'Audi' } };
        const result = await resolveOemApex(req);

        // Assert
        expect(result.success).toBe(true);
        expect(result.oemNumber).toBe('GEM456');
        expect(result.metadata.topCandidate?.confidence).toBe(0.90); // 0.75 + 0.15
        expect(mockAdversary.validateWithAdversary).toHaveBeenCalled();
    });

    it('should correct OEM using Claude Adversary if originally incorrect', async () => {
        // Arrange
        mockDatabaseSource.resolveCandidates.mockResolvedValue([]);
        mockGeminiSource.resolveCandidates.mockResolvedValue([
            { oem: 'WRONG123', confidence: 0.70, source: 'gemini', method: 'ai' }
        ]);
        
        mockAdversary.isAdversaryAvailable.mockReturnValue(true);
        mockAdversary.validateWithAdversary.mockResolvedValue({
            verdict: 'CORRECTED',
            reason: 'OEM WRONG123 is for front, not rear.',
            confidenceAdjustment: 0,
            alternativeOem: 'CORRECT456',
            latencyMs: 1200
        });

        // Act
        const req = { orderId: 'test4', partName: 'Rear Brake Pad', vehicle: { make: 'Audi' } };
        const result = await resolveOemApex(req);

        // Assert
        expect(result.success).toBe(true);
        expect(result.oemNumber).toBe('CORRECT456');
        expect(mockAdversary.validateWithAdversary).toHaveBeenCalled();
    });

    it('should fail resolution if all phases fail', async () => {
        // Arrange
        mockDatabaseSource.resolveCandidates.mockResolvedValue([]);
        mockGeminiSource.resolveCandidates.mockResolvedValue([]);
        
        // Act
        const req = { orderId: 'test5', partName: 'Unknown Part', vehicle: { make: 'Alien' } };
        const result = await resolveOemApex(req);

        // Assert
        expect(result.success).toBe(false);
        expect(result.oemNumber).toBeNull();
    });
});
