import * as db from '../core/database';
import { logger } from '@utils/logger';

/**
 * Gets the merchant ID and user email for a given phone number
 * @param phoneNumber - WhatsApp phone number in format "whatsapp:+14155238886"
 * @returns Object with merchantId and userEmail, or null if not found
 */
export async function getMerchantByPhone(phoneNumber: string): Promise<{ merchantId: string; userEmail: string | null } | null> {
    try {
        const row = await db.get<any>(
            `SELECT merchant_id, user_email FROM phone_merchant_mapping WHERE phone_number = ?`,
            [phoneNumber]
        );

        if (row) {
            return {
                merchantId: row.merchant_id,
                userEmail: row.user_email || null
            };
        }

        // Default fallback - use environment variable or 'admin'
        const defaultMerchant = process.env.DEFAULT_MERCHANT_ID || 'admin';
        logger.info('No phone mapping found, using default merchant', { phoneNumber, defaultMerchant });

        return {
            merchantId: defaultMerchant,
            userEmail: null
        };
    } catch (error: any) {
        logger.error('Failed to get merchant by phone', { error: error?.message, phoneNumber });
        return {
            merchantId: process.env.DEFAULT_MERCHANT_ID || 'admin',
            userEmail: null
        };
    }
}

/**
 * Sets or updates the merchant mapping for a phone number
 */
export async function setPhoneMerchantMapping(
    phoneNumber: string,
    merchantId: string,
    userEmail?: string,
    notes?: string
): Promise<boolean> {
    try {
        await db.run(
            `INSERT INTO phone_merchant_mapping (phone_number, merchant_id, user_email, notes)
             VALUES (?, ?, ?, ?)
             ON CONFLICT (phone_number) DO UPDATE 
             SET merchant_id = EXCLUDED.merchant_id,
                 user_email = EXCLUDED.user_email,
                 notes = EXCLUDED.notes`,
            [phoneNumber, merchantId, userEmail || null, notes || null]
        );

        logger.info('Phone merchant mapping updated', { phoneNumber, merchantId, userEmail });
        return true;
    } catch (error: any) {
        logger.error('Failed to set phone merchant mapping', { error: error?.message });
        return false;
    }
}
