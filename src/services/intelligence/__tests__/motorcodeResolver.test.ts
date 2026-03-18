import { resolveMotorcode } from '../motorcodeResolver';
import { geminiGroundedOemSource } from '../sources/geminiGroundedOemSource';

jest.mock('../sources/geminiGroundedOemSource', () => ({
    geminiGroundedOemSource: {
        resolveCandidates: jest.fn()
    }
}));

const mockGemini = geminiGroundedOemSource as jest.Mocked<typeof geminiGroundedOemSource>;

describe('motorcodeResolver', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return motorcode when Gemini finds it', async () => {
        mockGemini.resolveCandidates.mockResolvedValue([
            { oem: 'B48B20', confidence: 0.9, source: 'gemini', method: 'ai' }
        ]);

        const result = await resolveMotorcode({ make: 'BMW', model: '320i', year: 2020 });
        expect(result).toBe('B48B20');
    });

    it('should return null when Gemini cannot find motorcode', async () => {
        mockGemini.resolveCandidates.mockResolvedValue([]);
        const result = await resolveMotorcode({ make: 'Unknown', model: 'Car' });
        expect(result).toBeNull();
    });
});
