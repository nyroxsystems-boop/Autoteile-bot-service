import { resolveByMotorcode } from '../motorcodeResolver';

describe('motorcodeResolver', () => {
    it('should resolve OEM for known motorcode + part category', () => {
        const result = resolveByMotorcode('CHPA', 'WATER_PUMP');
        expect(result.found).toBe(true);
        expect(result.oemMapping?.oem).toBe('04E121600C');
    });

    it('should return found=false for unknown motorcode', () => {
        const result = resolveByMotorcode('ZZZZZ', 'WATER_PUMP');
        expect(result.found).toBe(false);
    });

    it('should return found=false for known motorcode but unknown part category', () => {
        const result = resolveByMotorcode('CHPA', 'ROCKET_LAUNCHER');
        expect(result.found).toBe(false);
        expect(result.warning).toBeDefined();
    });

    it('should return engine info for known motorcode even without OEM mapping', () => {
        // CHYB has engine info but no OEM mappings defined
        const result = resolveByMotorcode('CHYB', 'WATER_PUMP');
        expect(result.found).toBe(false);
        expect(result.engineInfo).toBeDefined();
        expect(result.engineInfo?.displacement).toBe(1.0);
    });
});
