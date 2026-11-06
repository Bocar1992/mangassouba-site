-- CRÉATION DES TABLES POUR MANGASSOUBA ET FILS

DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS promo_codes CASCADE;
DROP TABLE IF EXISTS delivery_zones CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS admins CASCADE;

CREATE TABLE admins (
    id SERIAL PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'admin',
    reset_code VARCHAR(10),
    reset_code_expires TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(150) UNIQUE,
    password VARCHAR(255) NOT NULL,
    points INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    nom VARCHAR(100) UNIQUE NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    nom VARCHAR(200) NOT NULL,
    prix NUMERIC(10,2) NOT NULL CHECK (prix >= 0),
    description TEXT,
    media TEXT,
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    clientName VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    address TEXT,
    items JSONB NOT NULL,
    total NUMERIC(10,2) NOT NULL,
    payment VARCHAR(50) NOT NULL,
    paymentDetails JSONB,
    promo_code VARCHAR(50),
    discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    delivery_zone VARCHAR(100),
    delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'en attente' CHECK (status IN ('en attente','confirmée','livrée')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE promo_codes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    discount_percent INTEGER NOT NULL CHECK (discount_percent BETWEEN 1 AND 100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE delivery_zones (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0)
);

CREATE TABLE reviews (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    client_name VARCHAR(100) NOT NULL,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- AJOUT DES DONNÉES DE BASE
INSERT INTO categories (nom, slug) VALUES ('Quincaillerie', 'quincaillerie'), ('Alimentation', 'alimentation'), ('Divers', 'divers');
INSERT INTO delivery_zones (name, price) VALUES ('Sélibaby Centre', 50), ('Sélibaby Périphérie', 100), ('Hors Sélibaby', 500);
INSERT INTO promo_codes (code, discount_percent) VALUES ('BIENVENUE10', 10);

-- ADMIN PAR DÉFAUT (Mot de passe : admin123 - On le sécurisera plus tard)
INSERT INTO admins (nom, email, password) VALUES ('Admin Mangassouba', 'admin@mangassouba.mr', '$2b$10$e.wN3y.5hIu7hK5g4z3y2uX1w0v9u8t7s6r5q4p3o2n1m0l9k8j7h');