/**
 * Admin Activity Logger Service
 * Logs all administrative actions for audit trail
 */

import * as db from './database';
import { randomUUID } from 'crypto';

export interface ActivityLogEntry {
    id: string;
    admin_username: string;
    action_type: string;
    entity_type: string;
    entity_id?: string;
    entity_name?: string;
    old_value?: string;
    new_value?: string;
    ip_address?: string;
    user_agent?: string;
    timestamp: string;
}

// Action Types
export const ACTION_TYPES = {
    // Tenant Actions
    TENANT_CREATED: 'TENANT_CREATED',
    TENANT_UPDATED: 'TENANT_UPDATED',
    TENANT_DELETED: 'TENANT_DELETED',
    TENANT_LIMITS_UPDATED: 'TENANT_LIMITS_UPDATED',
    TENANT_STATUS_CHANGED: 'TENANT_STATUS_CHANGED',

    // User Actions
    USER_CREATED: 'USER_CREATED',
    USER_UPDATED: 'USER_UPDATED',
    USER_DELETED: 'USER_DELETED',

    // OEM Actions
    OEM_CREATED: 'OEM_CREATED',
    OEM_UPDATED: 'OEM_UPDATED',
    OEM_DELETED: 'OEM_DELETED',
    OEM_BULK_DELETED: 'OEM_BULK_DELETED',
    OEM_SEEDER_TRIGGERED: 'OEM_SEEDER_TRIGGERED',
    OEM_VALIDATOR_TRIGGERED: 'OEM_VALIDATOR_TRIGGERED',

    // Email Actions
    EMAIL_CAMPAIGN_SENT: 'EMAIL_CAMPAIGN_SENT',
    EMAIL_TEMPLATE_CREATED: 'EMAIL_TEMPLATE_CREATED',

    // Auth Actions
    ADMIN_LOGIN: 'ADMIN_LOGIN',
    ADMIN_LOGOUT: 'ADMIN_LOGOUT',
    PASSWORD_RESET_REQUESTED: 'PASSWORD_RESET_REQUESTED',
    PASSWORD_CHANGED: 'PASSWORD_CHANGED',

    // System Actions
    SETTINGS_CHANGED: 'SETTINGS_CHANGED'
} as const;

export type ActionType = typeof ACTION_TYPES[keyof typeof ACTION_TYPES];

// Entity Types
export const ENTITY_TYPES = {
    TENANT: 'TENANT',
    USER: 'USER',
    OEM: 'OEM',
    EMAIL: 'EMAIL',
    SYSTEM: 'SYSTEM',
    ADMIN: 'ADMIN'
} as const;

export type EntityType = typeof ENTITY_TYPES[keyof typeof ENTITY_TYPES];

/**
 * Log an administrative action
 */
export async function logActivity(params: {
    adminUsername: string;
    actionType: ActionType;
    entityType: EntityType;
    entityId?: string;
    entityName?: string;
    oldValue?: any;
    newValue?: any;
    ipAddress?: string;
    userAgent?: string;
}): Promise<void> {
    const id = randomUUID();
    const timestamp = new Date().toISOString();

    try {
        await db.run(
            `INSERT INTO admin_activity_log 
             (id, admin_username, action_type, entity_type, entity_id, entity_name, old_value, new_value, ip_address, user_agent, timestamp)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                params.adminUsername,
                params.actionType,
                params.entityType,
                params.entityId || null,
                params.entityName || null,
                params.oldValue ? JSON.stringify(params.oldValue) : null,
                params.newValue ? JSON.stringify(params.newValue) : null,
                params.ipAddress || null,
                params.userAgent || null,
                timestamp
            ]
        );
        console.log(`📝 Activity logged: ${params.actionType} by ${params.adminUsername}`);
    } catch (error: any) {
        console.error('Failed to log activity:', error.message);
    }
}

/**
 * Get recent activity log entries
 */
export async function getRecentActivity(
    limit: number = 50,
    filters?: {
        adminUsername?: string;
        actionType?: string;
        entityType?: string;
        fromDate?: string;
        toDate?: string;
    }
): Promise<ActivityLogEntry[]> {
    let query = 'SELECT * FROM admin_activity_log WHERE 1=1';
    const params: any[] = [];

    if (filters?.adminUsername) {
        query += ' AND admin_username = ?';
        params.push(filters.adminUsername);
    }

    if (filters?.actionType) {
        query += ' AND action_type = ?';
        params.push(filters.actionType);
    }

    if (filters?.entityType) {
        query += ' AND entity_type = ?';
        params.push(filters.entityType);
    }

    if (filters?.fromDate) {
        query += ' AND timestamp >= ?';
        params.push(filters.fromDate);
    }

    if (filters?.toDate) {
        query += ' AND timestamp <= ?';
        params.push(filters.toDate);
    }

    query += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);

    return await db.all<ActivityLogEntry>(query, params);
}

/**
 * Get activity count by admin
 */
export async function getActivityStats(): Promise<{ admin: string; count: number }[]> {
    return await db.all<{ admin: string; count: number }>(
        `SELECT admin_username as admin, COUNT(*) as count 
         FROM admin_activity_log 
         GROUP BY admin_username 
         ORDER BY count DESC`
    );
}
