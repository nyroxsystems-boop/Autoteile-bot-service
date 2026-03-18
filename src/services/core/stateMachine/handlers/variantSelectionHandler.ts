/**
 * VARIANT SELECTION STATE HANDLER
 *
 * Handles user's selection when OEM resolver found multiple variants
 * (e.g. facelift vs pre-facelift, different engine codes).
 * Extracted from botLogicService.ts lines 1391-1488.
 */

import { createHandler, StateContext, StateResult } from '../stateMachine';
import { ConversationStatus, updateOrderData, updateOrderOEM } from '../../../adapters/supabaseService';
import { scrapeOffersForOrder } from '../../../scraping/scrapingService';
import { t } from '../../botResponses';
import { logger } from '../../../../utils/logger';

export const variantSelectionHandler = createHandler(
    'VariantSelectionHandler',
    ['awaiting_variant_selection' as ConversationStatus],
    async (ctx: StateContext): Promise<StateResult> => {
        const { orderId, order, orderData, language, userText, parsed } = ctx;

        const pendingVariants = orderData?.pendingVariants;
        if (!pendingVariants || !Array.isArray(pendingVariants) || pendingVariants.length === 0) {
            logger.warn('[VariantSelection] No pending variants found', { orderId });
            return {
                reply: t('oem_product_uncertain', language),
                nextStatus: 'needs_human' as ConversationStatus,
            };
        }

        const selectionText = (parsed.part || parsed.userPartText || userText || '').trim();

        // Try to parse customer's selection
        let selectedIndex = -1;

        // Method 1: Direct number ("1", "2", "3")
        const numMatch = selectionText.match(/^(\d+)$/);
        if (numMatch) {
            selectedIndex = parseInt(numMatch[1], 10) - 1;
        }

        // Method 2: Number at start ("2 bitte", "3 das ist meins")
        if (selectedIndex < 0) {
            const startNumMatch = selectionText.match(/^(\d+)\s/);
            if (startNumMatch) {
                selectedIndex = parseInt(startNumMatch[1], 10) - 1;
            }
        }

        // Method 3: Match description text to a variant
        if (selectedIndex < 0) {
            const lowerText = selectionText.toLowerCase();
            for (let i = 0; i < pendingVariants.length; i++) {
                const v = pendingVariants[i];
                const diff = (v.differentiator || '').toLowerCase();
                const desc = (v.description || '').toLowerCase();
                if (diff && lowerText.includes(diff)) { selectedIndex = i; break; }
                if (desc && lowerText.includes(desc)) { selectedIndex = i; break; }
                if (v.oem && lowerText.includes(v.oem.toLowerCase())) { selectedIndex = i; break; }
            }
        }

        // Validate selection
        if (selectedIndex < 0 || selectedIndex >= pendingVariants.length) {
            const maxNum = pendingVariants.length;
            return {
                reply: language === 'de'
                    ? `Bitte antworten Sie mit einer Zahl von 1 bis ${maxNum}, um Ihre Variante auszuwählen.`
                    : `Please reply with a number from 1 to ${maxNum} to select your variant.`,
                nextStatus: 'awaiting_variant_selection' as ConversationStatus,
            };
        }

        const selectedVariant = pendingVariants[selectedIndex];
        const selectedOem = selectedVariant.oem;

        logger.info('[VariantSelection] Customer selected variant', {
            orderId,
            selectedIndex: selectedIndex + 1,
            selectedOem,
            differentiator: selectedVariant.differentiator,
        });

        // Persist selected OEM
        try {
            await updateOrderData(orderId, {
                oemNumber: selectedOem,
                oemConfidence: selectedVariant.confidence,
                selectedVariant,
                pendingVariants: null,
            });
            try {
                await updateOrderOEM(orderId, {
                    oemStatus: 'resolved',
                    oemNumber: selectedOem,
                    oemData: { selectedVariant, allVariants: pendingVariants },
                });
            } catch (err: any) {
                logger.warn('Failed to persist selected variant OEM', { orderId, error: err?.message });
            }
        } catch (err: any) {
            logger.warn('Failed to persist variant selection', { orderId, error: err?.message });
        }

        // Scrape offers with selected OEM
        try {
            await scrapeOffersForOrder(orderId, selectedOem);
            const variantLabel = selectedVariant.differentiator || selectedOem;
            return {
                reply: language === 'de'
                    ? `✅ *${variantLabel}* ausgewählt (${selectedOem}).\n\n🔍 Ich suche jetzt die besten Angebote für Sie...`
                    : `✅ *${variantLabel}* selected (${selectedOem}).\n\n🔍 Searching for the best offers for you...`,
                nextStatus: 'show_offers',
            };
        } catch (err: any) {
            logger.error('Scrape after variant selection failed', { error: err?.message, orderId });
            return {
                reply: t('oem_scrape_failed', language),
                nextStatus: 'needs_human' as ConversationStatus,
            };
        }
    }
);
