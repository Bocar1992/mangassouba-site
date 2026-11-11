-- =====================================================================
-- SCHÉMA COMPLET — MANGASSOUBA ET FILS (à jour avec le code)
-- Pour une NOUVELLE base vide. Pour une base existante, lancez plutôt
-- database/migration_001_correctifs.sql.
-- Ne supprime plus aucune table (l'ancienne version commençait par des DROP TABLE).
-- Aucun mot de passe par défaut : créez le premier admin avec
--   cd backend && npm run create-admin -- email@exemple.com "Votre Nom" "MotDePasse"
-- =====================================================================

CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'admin',
    reset_code VARCHAR(10),
    reset_code_expires TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(30) UNIQUE NOT NULL,
    email VARCHAR(150) UNIQUE,
    password VARCHAR(255) NOT NULL,
    points INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    nom VARCHAR(100) UNIQUE NOT NULL,
    nom_en VARCHAR(100),
    nom_ar VARCHAR(100),
    slug VARCHAR(100) UNIQUE NOT NULL,
    parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    nom VARCHAR(200) NOT NULL,
    nom_en VARCHAR(200),
    nom_ar VARCHAR(200),
    prix NUMERIC(10,2) NOT NULL CHECK (prix >= 0),
    prix_achat NUMERIC(10,2) NOT NULL DEFAULT 0,
    prix_gros NUMERIC(10,2) NOT NULL DEFAULT 0,
    seuil_gros INTEGER NOT NULL DEFAULT 10,
    description TEXT,
    description_en TEXT,
    description_ar TEXT,
    media TEXT,
    video TEXT,
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    clientName VARCHAR(150) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    address TEXT,
    items JSONB NOT NULL,
    total NUMERIC(10,2) NOT NULL,
    payment VARCHAR(60) NOT NULL,
    paymentDetails JSONB,
    promo_code VARCHAR(50),
    discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    delivery_zone VARCHAR(100),
    delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'en attente'
        CONSTRAINT orders_status_check CHECK (status IN ('en attente','confirmée','livrée','annulée')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promo_codes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    discount_percent INTEGER NOT NULL CHECK (discount_percent BETWEEN 1 AND 100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS delivery_zones (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0)
);

CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    client_name VARCHAR(100) NOT NULL,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS banners (
    id SERIAL PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    image_url TEXT,
    link_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS proformas (
    id SERIAL PRIMARY KEY,
    client_name VARCHAR(150) NOT NULL,
    phone VARCHAR(30),
    address TEXT,
    items JSONB NOT NULL,
    total NUMERIC(12,2) NOT NULL,
    valid_until DATE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
    description VARCHAR(200) NOT NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    category VARCHAR(50) NOT NULL DEFAULT 'Autre',
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_phone_key    ON orders ((RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g'), 8)));
CREATE INDEX IF NOT EXISTS idx_customers_phone_key ON customers ((RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g'), 8)));
CREATE INDEX IF NOT EXISTS idx_orders_status       ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_created      ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_category   ON products (category_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product     ON reviews (product_id);

-- ---- DONNÉES DE BASE (ignorées si elles existent déjà) ----
INSERT INTO categories (nom, slug) VALUES ('Quincaillerie', 'quincaillerie'), ('Alimentation', 'alimentation'), ('Divers', 'divers')
    ON CONFLICT DO NOTHING;
INSERT INTO delivery_zones (name, price)
    SELECT v.name, v.price FROM (VALUES ('Sélibaby Centre', 50), ('Sélibaby Périphérie', 100), ('Hors Sélibaby', 500)) AS v(name, price)
    WHERE NOT EXISTS (SELECT 1 FROM delivery_zones);
INSERT INTO promo_codes (code, discount_percent) VALUES ('BIENVENUE10', 10) ON CONFLICT DO NOTHING;
