/**
 * Typed Event Bus
 *
 * Decouples services via typed events. Replaces tight coupling
 * between bot logic, scraping, invoicing, and notification services.
 *
 * Usage:
 *   import { eventBus } from '@services/events/eventBus';
 *   eventBus.emit('order.created', { orderId, merchantId, phone });
 *   eventBus.on('order.created', async (data) => { ... });
 */

import { EventEmitter } from 'events';
import { logger } from '@utils/logger';

// ---------------------------------------------------------------------------
// Event Type Definitions
// ---------------------------------------------------------------------------

export interface OrderCreatedEvent {
  orderId: string;
  merchantId: string;
  customerPhone: string;
  language: string;
}

export interface OrderStatusChangedEvent {
  orderId: string;
  merchantId: string;
  previousStatus: string;
  newStatus: string;
  changedBy: 'bot' | 'admin' | 'system';
}

export interface OemResolvedEvent {
  orderId: string;
  oemNumber: string;
  confidence: number;
  pipelinePhase: 'db' | 'gemini' | 'claude' | 'self_learning';
  latencyMs: number;
}

export interface OemFailedEvent {
  orderId: string;
  reason: string;
  vehicleMake?: string;
  vehicleModel?: string;
  partDescription?: string;
}

export interface InvoiceGeneratedEvent {
  invoiceId: string;
  orderId: string;
  merchantId: string;
  amount: number;
  currency: string;
}

export interface CustomerDataDeletedEvent {
  phone: string;
  deletedAt: string;
  deletedRecords: Record<string, number>;
}

export interface DealerNotifiedEvent {
  orderId: string;
  merchantId: string;
  notificationType: 'new_order' | 'escalation' | 'status_change';
}

// ---------------------------------------------------------------------------
// Event Map
// ---------------------------------------------------------------------------

export interface EventMap {
  'order.created': OrderCreatedEvent;
  'order.statusChanged': OrderStatusChangedEvent;
  'order.cancelled': OrderStatusChangedEvent;
  'oem.resolved': OemResolvedEvent;
  'oem.failed': OemFailedEvent;
  'invoice.generated': InvoiceGeneratedEvent;
  'customer.dataDeleted': CustomerDataDeletedEvent;
  'dealer.notified': DealerNotifiedEvent;
}

// ---------------------------------------------------------------------------
// Typed Event Bus
// ---------------------------------------------------------------------------

class TypedEventBus {
  private emitter = new EventEmitter();

  constructor() {
    // Increase max listeners capacity for production
    this.emitter.setMaxListeners(50);
  }

  /**
   * Emit a typed event.
   */
  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    logger.debug({ component: 'EventBus', event }, `Event emitted: ${event}`);
    try {
      this.emitter.emit(event, data);
    } catch (err: any) {
      logger.error({ component: 'EventBus', event, error: err?.message }, 'Event handler threw');
    }
  }

  /**
   * Subscribe to a typed event.
   */
  on<K extends keyof EventMap>(event: K, handler: (data: EventMap[K]) => void | Promise<void>): void {
    this.emitter.on(event, async (data: EventMap[K]) => {
      try {
        await handler(data);
      } catch (err: any) {
        logger.error({ component: 'EventBus', event, error: err?.message }, 'Event handler failed');
      }
    });
    logger.debug({ component: 'EventBus', event }, `Handler registered for: ${event}`);
  }

  /**
   * Subscribe to a typed event (once).
   */
  once<K extends keyof EventMap>(event: K, handler: (data: EventMap[K]) => void | Promise<void>): void {
    this.emitter.once(event, async (data: EventMap[K]) => {
      try {
        await handler(data);
      } catch (err: any) {
        logger.error({ component: 'EventBus', event, error: err?.message }, 'One-time event handler failed');
      }
    });
  }

  /**
   * Remove a specific handler.
   */
  off<K extends keyof EventMap>(event: K, handler: (data: EventMap[K]) => void): void {
    this.emitter.off(event, handler as any);
  }

  /**
   * Get listener count for an event.
   */
  listenerCount<K extends keyof EventMap>(event: K): number {
    return this.emitter.listenerCount(event);
  }
}

// Singleton instance
export const eventBus = new TypedEventBus();
