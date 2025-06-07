-- ESQUEMA DE BASE DE DATOS PARA BOLT FACT v2
-- Este archivo contiene la definición de todas las tablas necesarias
-- para el funcionamiento del sistema en Supabase

-- Habilitar extensión pgcrypto para UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tabla de empresas (companies)
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255) NOT NULL,
    identification_type VARCHAR(50) NOT NULL, -- Física, Jurídica, DIMEX, etc.
    identification_number VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    address TEXT,
    province VARCHAR(100),
    canton VARCHAR(100),
    district VARCHAR(100),
    postal_code VARCHAR(10),
    hacienda_username VARCHAR(255),
    hacienda_password VARCHAR(255),
    currency VARCHAR(10) DEFAULT 'CRC',
    tax_regime VARCHAR(50),
    economic_activity VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de usuarios (users)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id),
    username VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    full_name VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'user', -- admin, user, etc.
    last_login TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(username, company_id)
);

-- Crear índice para búsqueda por usuario
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Tabla de clientes (clients)
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    name VARCHAR(255) NOT NULL,
    identification_type VARCHAR(50) NOT NULL, -- Física, Jurídica, DIMEX, etc.
    identification_number VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    province VARCHAR(100),
    canton VARCHAR(100),
    district VARCHAR(100),
    postal_code VARCHAR(10),
    tax_regime VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(company_id, identification_number)
);

-- Crear índice para búsqueda por nombre e identificación
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(company_id, name);
CREATE INDEX IF NOT EXISTS idx_clients_identification ON clients(company_id, identification_number);

-- Tabla de productos (products)
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    unit_price DECIMAL(18, 5) NOT NULL,
    tax_rate DECIMAL(5, 2) NOT NULL DEFAULT 13.00,
    has_tax_exemption BOOLEAN DEFAULT FALSE,
    unit_measure VARCHAR(50) DEFAULT 'Unid',
    sku VARCHAR(100),
    barcode VARCHAR(100),
    stock DECIMAL(18, 3) DEFAULT 0,
    min_stock DECIMAL(18, 3) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(company_id, code)
);

-- Crear índice para búsqueda por nombre y código
CREATE INDEX IF NOT EXISTS idx_products_name ON products(company_id, name);
CREATE INDEX IF NOT EXISTS idx_products_code ON products(company_id, code);

-- Tabla de facturas (invoices)
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    consecutive VARCHAR(50) NOT NULL, -- Número de factura secuencial
    key_document VARCHAR(50) NOT NULL, -- Clave numérica de la factura
    client_id UUID NOT NULL REFERENCES clients(id),
    issue_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    sale_condition VARCHAR(50) NOT NULL DEFAULT '01', -- Condición de venta (01: Contado, 02: Crédito, etc.)
    payment_method VARCHAR(50) NOT NULL DEFAULT '01', -- Método de pago (01: Efectivo, 02: Tarjeta, etc.)
    currency VARCHAR(10) NOT NULL DEFAULT 'CRC',
    exchange_rate DECIMAL(18, 5),
    subtotal DECIMAL(18, 5) NOT NULL,
    discount_total DECIMAL(18, 5) DEFAULT 0,
    tax_total DECIMAL(18, 5) DEFAULT 0,
    total DECIMAL(18, 5) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft', -- draft, sent, approved, rejected, etc.
    hacienda_status VARCHAR(50), -- aceptado, rechazado, etc.
    hacienda_message TEXT,
    xml_content TEXT,
    pdf_path VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(company_id, consecutive)
);

-- Crear índice para búsqueda por consecutivo y fecha
CREATE INDEX IF NOT EXISTS idx_invoices_consecutive ON invoices(company_id, consecutive);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(company_id, issue_date);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(company_id, client_id);

-- Tabla de líneas de factura (invoice_lines)
CREATE TABLE IF NOT EXISTS invoice_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    description VARCHAR(255) NOT NULL,
    quantity DECIMAL(18, 3) NOT NULL,
    unit_price DECIMAL(18, 5) NOT NULL,
    discount_percentage DECIMAL(5, 2) DEFAULT 0,
    discount_amount DECIMAL(18, 5) DEFAULT 0,
    subtotal DECIMAL(18, 5) NOT NULL,
    tax_rate DECIMAL(5, 2) DEFAULT 13.00,
    tax_amount DECIMAL(18, 5) DEFAULT 0,
    has_tax_exemption BOOLEAN DEFAULT FALSE,
    total DECIMAL(18, 5) NOT NULL,
    line_number INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índice para búsqueda rápida por factura
CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON invoice_lines(invoice_id);

-- Tabla para logos de empresas (company_logos)
CREATE TABLE IF NOT EXISTS company_logos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) UNIQUE,
    storage_path VARCHAR(255) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla para certificados de Hacienda (certificates)
CREATE TABLE IF NOT EXISTS certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) UNIQUE,
    storage_path VARCHAR(255) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    pin VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla para configuraciones de empresas (company_settings)
CREATE TABLE IF NOT EXISTS company_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) UNIQUE,
    logo_url VARCHAR(255),
    theme_primary_color VARCHAR(20) DEFAULT '#0ea5e9',
    theme_secondary_color VARCHAR(20) DEFAULT '#0284c7',
    invoice_notes TEXT,
    invoice_footer TEXT,
    default_tax_rate DECIMAL(5, 2) DEFAULT 13.00,
    default_currency VARCHAR(10) DEFAULT 'CRC',
    receipt_printer_config JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla para historial de actividades (activity_logs)
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL, -- 'invoice', 'client', 'product', etc.
    entity_id UUID,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índice para búsqueda por empresa y acción
CREATE INDEX IF NOT EXISTS idx_activity_logs_company ON activity_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(company_id, action);

-- Datos de ejemplo para pruebas
-- Crear empresa de prueba
INSERT INTO companies (
    name, legal_name, identification_type, identification_number, 
    email, phone, address, province, canton, district, postal_code
) VALUES (
    'ACME SA', 'ACME SOCIEDAD ANÓNIMA', 'Jurídica', '3101123456',
    'info@acme.co.cr', '2222-3333', 'Avenida Central, Calle 5', 
    'San José', 'San José', 'Carmen', '10101'
) ON CONFLICT (identification_number) DO NOTHING;

-- Crear usuario administrador
INSERT INTO users (
    company_id, username, password_hash, email, full_name, role
) VALUES (
    (SELECT id FROM companies WHERE identification_number = '3101123456'),
    'admin', 
    crypt('admin123', gen_salt('bf')), 
    'admin@acme.co.cr', 
    'Administrador', 
    'admin'
) ON CONFLICT (username, company_id) DO NOTHING;

-- Crear cliente de prueba
INSERT INTO clients (
    company_id, name, identification_type, identification_number,
    email, phone
) VALUES (
    (SELECT id FROM companies WHERE identification_number = '3101123456'),
    'Cliente General', 'Física', '1-1111-1111',
    'cliente@ejemplo.com', '8888-9999'
) ON CONFLICT (company_id, identification_number) DO NOTHING;

-- Crear producto de prueba
INSERT INTO products (
    company_id, code, name, description, unit_price, tax_rate
) VALUES (
    (SELECT id FROM companies WHERE identification_number = '3101123456'),
    'P001', 'Producto de prueba', 'Este es un producto de prueba',
    1000.00, 13.00
) ON CONFLICT (company_id, code) DO NOTHING;
