-- Base schema + compatibility migration for bot service

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Drop FK constraints to allow type changes (if they exist)
ALTER TABLE IF EXISTS sessions DROP CONSTRAINT IF EXISTS sessions_user_id_fkey;
ALTER TABLE IF EXISTS messages DROP CONSTRAINT IF EXISTS messages_order_id_fkey;
ALTER TABLE IF EXISTS shop_offers DROP CONSTRAINT IF EXISTS shop_offers_order_id_fkey;

-- Users
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE,
    name TEXT,
    full_name TEXT,
    password_hash TEXT,
    role TEXT DEFAULT 'user',
    is_active INTEGER DEFAULT 1,
    merchant_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

ALTER TABLE IF EXISTS users ALTER COLUMN id TYPE TEXT USING id::text;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS is_active INTEGER DEFAULT 1;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS merchant_id TEXT;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_merchant ON users(merchant_id);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE IF EXISTS sessions ALTER COLUMN id TYPE TEXT USING id::text;
ALTER TABLE IF EXISTS sessions ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE IF EXISTS sessions ADD COLUMN IF NOT EXISTS token TEXT;
ALTER TABLE IF EXISTS sessions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;
ALTER TABLE IF EXISTS sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    customer_contact TEXT,
    customer_name TEXT,
    customer_phone TEXT,
    customer_id TEXT,
    vehicle_id TEXT,
    status TEXT DEFAULT 'choose_language',
    total NUMERIC(10, 2),
    oem_number TEXT,
    oem_status TEXT,
    oem_error TEXT,
    oem_data JSONB,
    match_confidence NUMERIC,
    language TEXT,
    order_data JSONB,
    vehicle_data JSONB,
    scrape_result JSONB,
    vehicle_description TEXT,
    part_description TEXT,
    requested_part_name TEXT,
    merchant_id TEXT,
    dealer_id TEXT,
    country TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE IF EXISTS orders ALTER COLUMN id TYPE TEXT USING id::text;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS customer_contact TEXT;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS customer_id TEXT;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS vehicle_id TEXT;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'choose_language';
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS total NUMERIC(10, 2);
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS oem_number TEXT;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS oem_status TEXT;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS oem_error TEXT;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS oem_data JSONB;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS match_confidence NUMERIC;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS language TEXT;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS order_data JSONB;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS vehicle_data JSONB;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS scrape_result JSONB;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS vehicle_description TEXT;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS part_description TEXT;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS requested_part_name TEXT;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS merchant_id TEXT;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS dealer_id TEXT;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_merchant ON orders(merchant_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_customer_contact ON orders(customer_contact);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    order_id TEXT,
    direction TEXT,
    channel TEXT,
    from_identifier TEXT,
    to_identifier TEXT,
    phone TEXT,
    content TEXT,
    raw_payload JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE IF EXISTS messages ALTER COLUMN id TYPE TEXT USING id::text;
ALTER TABLE IF EXISTS messages ALTER COLUMN order_id TYPE TEXT USING order_id::text;
ALTER TABLE IF EXISTS messages ADD COLUMN IF NOT EXISTS direction TEXT;
ALTER TABLE IF EXISTS messages ADD COLUMN IF NOT EXISTS channel TEXT;
ALTER TABLE IF EXISTS messages ADD COLUMN IF NOT EXISTS from_identifier TEXT;
ALTER TABLE IF EXISTS messages ADD COLUMN IF NOT EXISTS to_identifier TEXT;
ALTER TABLE IF EXISTS messages ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE IF EXISTS messages ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE IF EXISTS messages ADD COLUMN IF NOT EXISTS raw_payload JSONB;
ALTER TABLE IF EXISTS messages ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_messages_order ON messages(order_id);
CREATE INDEX IF NOT EXISTS idx_messages_phone ON messages(phone);

-- Shop offers
CREATE TABLE IF NOT EXISTS shop_offers (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    order_id TEXT,
    oem TEXT,
    data JSONB,
    inserted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    shop_name TEXT,
    brand TEXT,
    price NUMERIC,
    currency TEXT,
    availability TEXT,
    delivery_time_days INTEGER,
    product_name TEXT,
    base_price NUMERIC,
    margin_percent NUMERIC,
    oem_number TEXT,
    image_url TEXT,
    url TEXT,
    tier TEXT,
    status TEXT,
    supplier_id TEXT,
    rating NUMERIC,
    is_recommended BOOLEAN
);

ALTER TABLE IF EXISTS shop_offers ALTER COLUMN id TYPE TEXT USING id::text;
ALTER TABLE IF EXISTS shop_offers ALTER COLUMN order_id TYPE TEXT USING order_id::text;
ALTER TABLE IF EXISTS shop_offers ADD COLUMN IF NOT EXISTS oem TEXT;
ALTER TABLE IF EXISTS shop_offers ADD COLUMN IF NOT EXISTS data JSONB;
ALTER TABLE IF EXISTS shop_offers ADD COLUMN IF NOT EXISTS inserted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE IF EXISTS shop_offers ADD COLUMN IF NOT EXISTS shop_name TEXT;
ALTER TABLE IF EXISTS shop_offers ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE IF EXISTS shop_offers ADD COLUMN IF NOT EXISTS price NUMERIC;
ALTER TABLE IF EXISTS shop_offers ADD COLUMN IF NOT EXISTS currency TEXT;
ALTER TABLE IF EXISTS shop_offers ADD COLUMN IF NOT EXISTS availability TEXT;
ALTER TABLE IF EXISTS shop_offers ADD COLUMN IF NOT EXISTS delivery_time_days INTEGER;
ALTER TABLE IF EXISTS shop_offers ADD COLUMN IF NOT EXISTS product_name TEXT;
ALTER TABLE IF EXISTS shop_offers ADD COLUMN IF NOT EXISTS base_price NUMERIC;
ALTER TABLE IF EXISTS shop_offers ADD COLUMN IF NOT EXISTS margin_percent NUMERIC;
ALTER TABLE IF EXISTS shop_offers ADD COLUMN IF NOT EXISTS oem_number TEXT;
ALTER TABLE IF EXISTS shop_offers ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE IF EXISTS shop_offers ADD COLUMN IF NOT EXISTS url TEXT;
ALTER TABLE IF EXISTS shop_offers ADD COLUMN IF NOT EXISTS tier TEXT;
ALTER TABLE IF EXISTS shop_offers ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE IF EXISTS shop_offers ADD COLUMN IF NOT EXISTS supplier_id TEXT;
ALTER TABLE IF EXISTS shop_offers ADD COLUMN IF NOT EXISTS rating NUMERIC;
ALTER TABLE IF EXISTS shop_offers ADD COLUMN IF NOT EXISTS is_recommended BOOLEAN;

CREATE INDEX IF NOT EXISTS idx_shop_offers_order ON shop_offers(order_id);
CREATE INDEX IF NOT EXISTS idx_shop_offers_oem ON shop_offers(oem);
CREATE INDEX IF NOT EXISTS idx_shop_offers_oem_number ON shop_offers(oem_number);

-- Merchant settings
CREATE TABLE IF NOT EXISTS merchant_settings (
    merchant_id TEXT PRIMARY KEY,
    settings JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE IF EXISTS merchant_settings ADD COLUMN IF NOT EXISTS settings JSONB;
ALTER TABLE IF EXISTS merchant_settings ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE IF EXISTS merchant_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
    IF to_regclass('public.merchant_settings') IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'merchant_settings_merchant_id_key'
        ) THEN
            ALTER TABLE merchant_settings ADD CONSTRAINT merchant_settings_merchant_id_key UNIQUE (merchant_id);
        END IF;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_merchant_settings_merchant ON merchant_settings(merchant_id);

-- Parts
CREATE TABLE IF NOT EXISTS parts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT,
    description TEXT,
    oem_number TEXT,
    stock INTEGER DEFAULT 0,
    category TEXT,
    location TEXT,
    ipn TEXT,
    manufacturer TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE IF EXISTS parts ALTER COLUMN id TYPE TEXT USING id::text;
ALTER TABLE IF EXISTS parts ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE IF EXISTS parts ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE IF EXISTS parts ADD COLUMN IF NOT EXISTS oem_number TEXT;
ALTER TABLE IF EXISTS parts ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0;
ALTER TABLE IF EXISTS parts ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE IF EXISTS parts ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE IF EXISTS parts ADD COLUMN IF NOT EXISTS ipn TEXT;
ALTER TABLE IF EXISTS parts ADD COLUMN IF NOT EXISTS manufacturer TEXT;
ALTER TABLE IF EXISTS parts ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_parts_oem ON parts(oem_number);

-- Companies
CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    description TEXT,
    website TEXT,
    email TEXT,
    phone TEXT,
    is_customer BOOLEAN DEFAULT false,
    is_supplier BOOLEAN DEFAULT false,
    active BOOLEAN DEFAULT true,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE IF EXISTS companies ALTER COLUMN id TYPE TEXT USING id::text;
ALTER TABLE IF EXISTS companies ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE IF EXISTS companies ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE IF EXISTS companies ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE IF EXISTS companies ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE IF EXISTS companies ADD COLUMN IF NOT EXISTS is_customer BOOLEAN DEFAULT false;
ALTER TABLE IF EXISTS companies ADD COLUMN IF NOT EXISTS is_supplier BOOLEAN DEFAULT false;
ALTER TABLE IF EXISTS companies ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;
ALTER TABLE IF EXISTS companies ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE IF EXISTS companies ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);

-- Vehicles (optional, for future expansion)
CREATE TABLE IF NOT EXISTS vehicles (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    order_id TEXT,
    make TEXT,
    model TEXT,
    year INTEGER,
    engine_code TEXT,
    vin TEXT,
    hsn TEXT,
    tsn TEXT,
    raw_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE IF EXISTS vehicles ALTER COLUMN id TYPE TEXT USING id::text;
ALTER TABLE IF EXISTS vehicles ADD COLUMN IF NOT EXISTS order_id TEXT;
ALTER TABLE IF EXISTS vehicles ADD COLUMN IF NOT EXISTS make TEXT;
ALTER TABLE IF EXISTS vehicles ADD COLUMN IF NOT EXISTS model TEXT;
ALTER TABLE IF EXISTS vehicles ADD COLUMN IF NOT EXISTS year INTEGER;
ALTER TABLE IF EXISTS vehicles ADD COLUMN IF NOT EXISTS engine_code TEXT;
ALTER TABLE IF EXISTS vehicles ADD COLUMN IF NOT EXISTS vin TEXT;
ALTER TABLE IF EXISTS vehicles ADD COLUMN IF NOT EXISTS hsn TEXT;
ALTER TABLE IF EXISTS vehicles ADD COLUMN IF NOT EXISTS tsn TEXT;
ALTER TABLE IF EXISTS vehicles ADD COLUMN IF NOT EXISTS raw_data JSONB;
ALTER TABLE IF EXISTS vehicles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_vehicles_make_model_year ON vehicles(make, model, year);

-- Re-add FK constraints after type alignment
ALTER TABLE IF EXISTS sessions DROP CONSTRAINT IF EXISTS sessions_user_id_fkey;
ALTER TABLE IF EXISTS messages DROP CONSTRAINT IF EXISTS messages_order_id_fkey;
ALTER TABLE IF EXISTS shop_offers DROP CONSTRAINT IF EXISTS shop_offers_order_id_fkey;

ALTER TABLE IF EXISTS sessions
    ADD CONSTRAINT sessions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS messages
    ADD CONSTRAINT messages_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS shop_offers
    ADD CONSTRAINT shop_offers_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
