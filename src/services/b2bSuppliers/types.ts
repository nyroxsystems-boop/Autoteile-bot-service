// B2B Supplier Types
// Shared types for all B2B supplier integrations

export interface B2BSupplierConfig {
    id: string;
    tenant_id: string;
    supplier_name: B2BSupplierName;
    enabled: boolean;

    // API Credentials
    api_key?: string;
    api_secret?: string;
    account_number?: string;
    username?: string;

    // Pricing Configuration
    price_tier: PriceTier;
    margin_type: 'percentage' | 'fixed';
    margin_value: number;
    minimum_margin: number;
    rounding_strategy: 'up' | 'down' | 'nearest';
    round_to: number;

    priority: number;
    created_at: string;
    updated_at: string;
}

export type B2BSupplierName = 'inter_cars' | 'moto_profil' | 'auto_partner' | 'gordon';
export type PriceTier = 'basic' | 'silver' | 'gold' | 'platinum';

export interface B2BPartSearchResult {
    supplierId: string;
    supplierName: B2BSupplierName;
    partNumber: string;
    oemNumber: string;
    name: string;
    brand: string;

    // Pricing (before margin)
    purchasePrice: number;
    currency: string;

    // Availability
    inStock: boolean;
    quantity: number;
    deliveryDays: number;

    // Additional info
    imageUrl?: string;
    productUrl?: string;
    description?: string;
}

export interface B2BPartOffer extends B2BPartSearchResult {
    // Pricing (after margin)
    sellingPrice: number;
    marginAmount: number;
    marginPercent: number;
}

export interface B2BOrderRequest {
    partNumber: string;
    oemNumber: string;
    quantity: number;
    customerOrderId: string;
}

export interface B2BOrderResponse {
    success: boolean;
    orderId?: string;
    supplierOrderId?: string;
    estimatedDelivery?: string;
    error?: string;
}

export interface B2BSupplierAdapter {
    name: B2BSupplierName;
    displayName: string;

    // Check if properly configured
    isConfigured(): boolean;

    // Search for parts
    searchParts(oem: string): Promise<B2BPartSearchResult[]>;

    // Check stock for specific part
    checkStock(partNumber: string): Promise<{ inStock: boolean; quantity: number; deliveryDays: number }>;

    // Get current price (may vary by tier)
    getPrice(partNumber: string): Promise<{ price: number; currency: string }>;

    // Place order
    placeOrder(order: B2BOrderRequest): Promise<B2BOrderResponse>;

    // Check order status
    getOrderStatus(orderId: string): Promise<{ status: string; trackingNumber?: string }>;
}
