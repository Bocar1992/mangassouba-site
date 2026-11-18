-- =====================================================================
-- MIGRATION 001 — à exécuter UNE FOIS sur votre base existante (Render)
-- Idempotente : on peut la relancer sans risque. Ne supprime aucune donnée.
-- =====================================================================
BEGIN;

-- ---- Colonnes utilisées par le code mais absentes de l'ancien database.sql ----
ALTER TABLE categories ADD COLUMN IF NOT EXISTS nom_en    VARCHAR(100);
ALTER TABLE categories ADD COLUMN IF NOT EXISTS nom_ar    VARCHAR(100);
ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL;

ALTER TABLE products ADD COLUMN IF NOT EXISTS nom_en         VARCHAR(200);
ALTER TABLE products ADD COLUMN IF NOT EXISTS nom_ar         VARCHAR(200);
ALTER TABLE products ADD COLUMN IF NOT EXISTS description_en TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS description_ar TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS prix_achat     NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS prix_gros      NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS seuil_gros     INTEGER NOT NULL DEFAULT 10;
ALTER TABLE products ADD COLUMN IF NOT EXISTS video          TEXT;

-- ---- Tables utilisées par le code mais absentes de l'ancien database.sql ----
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

-- ---- Commandes : nouveau statut "annulée" (remet le stock) ----
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
    CHECK (status IN ('en attente','confirmée','livrée','annulée'));
ALTER TABLE orders ALTER COLUMN phone TYPE VARCHAR(30);
ALTER TABLE customers ALTER COLUMN phone TYPE VARCHAR(30);

-- ---- Le compte n°1 est le Super Admin principal ----
UPDATE admins SET role = 'superadmin' WHERE id = 1;

-- ---- Index (suivi de commande, tableaux de bord, fiches produit) ----
CREATE INDEX IF NOT EXISTS idx_orders_phone_key  ON orders ((RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g'), 8)));
CREATE INDEX IF NOT EXISTS idx_customers_phone_key ON customers ((RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g'), 8)));
CREATE INDEX IF NOT EXISTS idx_orders_status     ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_created    ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_category ON products (category_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product   ON reviews (product_id);

COMMIT;
