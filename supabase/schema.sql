-- Esquema de base de datos para Bolt Fact v2

-- Tabla de empresas (para el sistema multi-empresa)
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  identification_type VARCHAR(10) NOT NULL,
  identification_number VARCHAR(50) NOT NULL UNIQUE,
  commercial_name VARCHAR(255),
  env_file_path VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de usuarios (para autenticación y permisos)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  company_id UUID REFERENCES companies(id),
  role VARCHAR(50) DEFAULT 'user',
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Configuración de empresa (antes en el archivo .env)
CREATE TABLE company_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) NOT NULL UNIQUE,
  -- Credenciales de administrador
  admin_username VARCHAR(255),
  admin_password VARCHAR(255),
  
  -- Credenciales de Hacienda
  hacienda_api_url VARCHAR(255),
  hacienda_token_url VARCHAR(255),
  hacienda_client_id VARCHAR(255),
  hacienda_username VARCHAR(255),
  hacienda_password VARCHAR(255),
  hacienda_certificate_path VARCHAR(255),
  hacienda_token VARCHAR(255),
  
  -- Datos del emisor
  company_name VARCHAR(255) NOT NULL,
  identification_type VARCHAR(10) NOT NULL,
  identification_number VARCHAR(50) NOT NULL,
  commercial_name VARCHAR(255),
  province VARCHAR(100),
  canton VARCHAR(100),
  district VARCHAR(100),
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  economic_activity VARCHAR(100),
  
  -- Configuración del servidor SMTP
  email_host VARCHAR(255),
  email_port INTEGER,
  email_secure BOOLEAN DEFAULT TRUE,
  email_user VARCHAR(255),
  email_password VARCHAR(255),
  email_from VARCHAR(255),
  email_from_name VARCHAR(255),
  
  -- Otras configuraciones
  include_acceptance_doc BOOLEAN DEFAULT TRUE,
  logo_path VARCHAR(255),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de clientes (ya existe pero la mejoramos)
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) NOT NULL,
  name VARCHAR(255) NOT NULL,
  identification_type VARCHAR(10) NOT NULL,
  identification_number VARCHAR(50) NOT NULL,
  tax_status VARCHAR(50) NOT NULL,  -- Estado tributario verificado con Hacienda
  email VARCHAR(255),
  phone VARCHAR(50),
  province VARCHAR(100),
  canton VARCHAR(100),
  district VARCHAR(100),
  address TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, identification_number)
);

-- Tabla de productos
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  unit_price DECIMAL(18, 2) NOT NULL,
  tax_rate DECIMAL(5, 2) NOT NULL DEFAULT 0,
  has_tax_exemption BOOLEAN DEFAULT FALSE,
  unit_measure VARCHAR(50) DEFAULT 'Unid',
  sku VARCHAR(100),
  barcode VARCHAR(100),
  stock INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, code)
);

-- Tabla de facturas
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) NOT NULL,
  consecutive VARCHAR(50) NOT NULL,
  key_document VARCHAR(100) NOT NULL,
  client_id UUID REFERENCES clients(id) NOT NULL,
  issue_date TIMESTAMP WITH TIME ZONE NOT NULL,
  sale_condition VARCHAR(50) NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'CRC',
  exchange_rate DECIMAL(18, 5) DEFAULT 1,
  subtotal DECIMAL(18, 2) NOT NULL,
  discount_total DECIMAL(18, 2) DEFAULT 0,
  tax_total DECIMAL(18, 2) DEFAULT 0,
  total DECIMAL(18, 2) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  hacienda_status VARCHAR(50),
  hacienda_message TEXT,
  xml_content TEXT,
  pdf_path VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, consecutive)
);

-- Tabla de líneas de factura
CREATE TABLE invoice_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID REFERENCES invoices(id) NOT NULL,
  product_id UUID REFERENCES products(id),
  description TEXT NOT NULL,
  quantity DECIMAL(18, 2) NOT NULL,
  unit_price DECIMAL(18, 2) NOT NULL,
  discount_percentage DECIMAL(5, 2) DEFAULT 0,
  discount_amount DECIMAL(18, 2) DEFAULT 0,
  subtotal DECIMAL(18, 2) NOT NULL,
  tax_rate DECIMAL(5, 2) DEFAULT 0,
  tax_amount DECIMAL(18, 2) DEFAULT 0,
  has_tax_exemption BOOLEAN DEFAULT FALSE,
  total DECIMAL(18, 2) NOT NULL,
  line_number INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla para almacenar el logo de las empresas
CREATE TABLE company_logos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) NOT NULL UNIQUE,
  logo_data BYTEA NOT NULL,
  filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla para almacenar certificados de Hacienda
CREATE TABLE certificates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) NOT NULL UNIQUE,
  certificate_data BYTEA NOT NULL,
  filename VARCHAR(255) NOT NULL,
  pin VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejorar el rendimiento
CREATE INDEX idx_clients_company_id ON clients(company_id);
CREATE INDEX idx_products_company_id ON products(company_id);
CREATE INDEX idx_invoices_company_id ON invoices(company_id);
CREATE INDEX idx_invoices_client_id ON invoices(client_id);
CREATE INDEX idx_invoice_lines_invoice_id ON invoice_lines(invoice_id);
