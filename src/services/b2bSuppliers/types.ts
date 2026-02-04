// Flexible B2B Supplier System - Types
// Supports any supplier, easily extensible

export interface SupplierDefinition {
    key: string;
    name: string;
    description: string;
    icon: string;
    color: string;
    website: string;
    country: string;
    hasApi: boolean;
    features: string[];

    // Configuration fields
    credentialFields: CredentialField[];
    settingFields: SettingField[];
}

export interface CredentialField {
    key: string;
    label: string;
    type: 'text' | 'password';
    placeholder?: string;
    required?: boolean;
}

export interface SettingField {
    key: string;
    label: string;
    type: 'number' | 'select' | 'toggle';
    description?: string;
    defaultValue?: any;
    options?: { value: string; label: string }[];
    min?: number;
    max?: number;
}

export interface SupplierConfig {
    id: string;
    tenant_id: string;
    supplier_key: string;
    enabled: boolean;
    credentials: Record<string, string>;
    settings: Record<string, any>;
    status: 'connected' | 'disconnected' | 'error';
    last_sync?: string;
    error_message?: string;
    created_at: string;
    updated_at: string;
}

// ══════════════════════════════════════════════════════════════════
// SUPPLIER REGISTRY - Add new suppliers here
// ══════════════════════════════════════════════════════════════════

export const SUPPLIERS: SupplierDefinition[] = [
    {
        key: 'inter_cars',
        name: 'Inter Cars',
        description: 'Größter Autoteile-Großhändler in Mitteleuropa',
        icon: '🚗',
        color: '#e31837',
        website: 'https://intercars.eu',
        country: 'PL',
        hasApi: true,
        features: ['REST API', 'Echtzeit-Preise', 'Auto-Bestellung', 'Lieferverfolgung'],
        credentialFields: [
            { key: 'api_key', label: 'API Key', type: 'password', required: true },
            { key: 'api_secret', label: 'API Secret', type: 'password', required: true },
            { key: 'customer_id', label: 'Kundennummer', type: 'text', required: true }
        ],
        settingFields: [
            {
                key: 'price_tier',
                label: 'Preisstufe',
                type: 'select',
                description: 'Rabatt basierend auf Bestellvolumen',
                options: [
                    { value: 'basic', label: 'Basic (0%)' },
                    { value: 'silver', label: 'Silver (5%)' },
                    { value: 'gold', label: 'Gold (10%)' },
                    { value: 'platinum', label: 'Platinum (15%)' }
                ],
                defaultValue: 'basic'
            },
            { key: 'margin_percent', label: 'Marge (%)', type: 'number', defaultValue: 15, min: 0, max: 100 },
            { key: 'min_margin', label: 'Mindestmarge (€)', type: 'number', defaultValue: 5, min: 0 },
            { key: 'auto_order', label: 'Auto-Bestellung', type: 'toggle', defaultValue: false }
        ]
    },
    {
        key: 'moto_profil',
        name: 'Moto-Profil',
        description: 'ProfiAuto Katalog & ProfiBiznes',
        icon: '🔧',
        color: '#1e3a8a',
        website: 'https://moto-profil.pl',
        country: 'PL',
        hasApi: false,
        features: ['ProfiAuto Katalog', 'TecDoc-Daten', '50.000+ Nutzer'],
        credentialFields: [
            { key: 'username', label: 'Benutzername', type: 'text', required: true },
            { key: 'password', label: 'Passwort', type: 'password', required: true }
        ],
        settingFields: [
            { key: 'margin_percent', label: 'Marge (%)', type: 'number', defaultValue: 15, min: 0, max: 100 }
        ]
    },
    {
        key: 'auto_partner',
        name: 'Auto Partner',
        description: 'WEBterminal B2B-Plattform',
        icon: '🛠️',
        color: '#059669',
        website: 'https://autopartner.com',
        country: 'PL',
        hasApi: false,
        features: ['WEBterminal', 'VIN-Suche', 'Katalog'],
        credentialFields: [
            { key: 'username', label: 'Benutzername', type: 'text', required: true },
            { key: 'password', label: 'Passwort', type: 'password', required: true }
        ],
        settingFields: [
            { key: 'margin_percent', label: 'Marge (%)', type: 'number', defaultValue: 15, min: 0, max: 100 }
        ]
    },
    {
        key: 'gordon',
        name: 'Gordon',
        description: 'Hurtownia Motoryzacyjna',
        icon: '⚙️',
        color: '#7c3aed',
        website: 'https://gordon.com.pl',
        country: 'PL',
        hasApi: false,
        features: ['Web-Katalog', 'TecDoc', 'VIN-Lookup'],
        credentialFields: [
            { key: 'username', label: 'Benutzername', type: 'text', required: true },
            { key: 'password', label: 'Passwort', type: 'password', required: true }
        ],
        settingFields: [
            { key: 'margin_percent', label: 'Marge (%)', type: 'number', defaultValue: 15, min: 0, max: 100 }
        ]
    }
];

// Helper functions
export function getSupplier(key: string): SupplierDefinition | undefined {
    return SUPPLIERS.find(s => s.key === key);
}

export function getAllSuppliers(): SupplierDefinition[] {
    return SUPPLIERS;
}
