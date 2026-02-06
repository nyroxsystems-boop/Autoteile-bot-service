/**
 * Unit Tests for Conversation Intelligence Layer
 * Tests the pattern-matching logic without requiring AI calls
 */

import { quickPatternCheck } from './conversationIntelligence';

describe('conversationIntelligence', () => {
    describe('quickPatternCheck', () => {
        describe('confirmation patterns -> continue_flow', () => {
            const confirmations = ['ja', 'Jo', 'jap', 'yes', 'ok', 'okay', 'genau', 'stimmt', 'richtig', 'korrekt', 'passt', 'gut'];

            confirmations.forEach(text => {
                it(`"${text}" should return continue_flow`, () => {
                    const result = quickPatternCheck(text);
                    expect(result).not.toBeNull();
                    expect(result?.decision).toBe('continue_flow');
                    expect(result?.confidence).toBeGreaterThanOrEqual(0.9);
                });
            });

            it('"ja!" with punctuation should return continue_flow', () => {
                const result = quickPatternCheck('ja!');
                expect(result?.decision).toBe('continue_flow');
            });

            it('"ok." with period should return continue_flow', () => {
                const result = quickPatternCheck('ok.');
                expect(result?.decision).toBe('continue_flow');
            });
        });

        describe('reset part patterns -> reset_part', () => {
            const resetPatterns = ['anderes teil', 'neues Teil bitte', 'andere Anfrage', 'was anderes suchen'];

            resetPatterns.forEach(text => {
                it(`"${text}" should return reset_part`, () => {
                    const result = quickPatternCheck(text);
                    expect(result).not.toBeNull();
                    expect(result?.decision).toBe('reset_part');
                });
            });
        });

        describe('escalation patterns -> escalate', () => {
            const escalationPatterns = ['echter Mitarbeiter', 'mit Menschen reden', 'hilfe bitte', 'das klappt nicht'];

            escalationPatterns.forEach(text => {
                it(`"${text}" should return escalate`, () => {
                    const result = quickPatternCheck(text);
                    expect(result).not.toBeNull();
                    expect(result?.decision).toBe('escalate');
                });
            });
        });

        describe('wait patterns -> wait', () => {
            const waitPatterns = ['moment mal', 'warte kurz', 'eine Sekunde'];

            waitPatterns.forEach(text => {
                it(`"${text}" should return wait`, () => {
                    const result = quickPatternCheck(text);
                    expect(result).not.toBeNull();
                    expect(result?.decision).toBe('wait');
                });
            });
        });

        describe('complex messages -> null (needs AI)', () => {
            const complexMessages = [
                'Ich brauche Bremsscheiben für meinen BMW',
                'Was kostet das Teil?',
                'Hallo, ich suche Ersatzteile',
                'Gibt es das auch in rot?',
            ];

            complexMessages.forEach(text => {
                it(`"${text}" should return null (needs AI analysis)`, () => {
                    const result = quickPatternCheck(text);
                    expect(result).toBeNull();
                });
            });
        });
    });
});
