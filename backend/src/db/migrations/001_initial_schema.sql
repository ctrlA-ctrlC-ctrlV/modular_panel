-- UP
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create price_config table
CREATE TABLE price_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    label VARCHAR(255) NOT NULL,
    currency VARCHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    current BOOLEAN NOT NULL DEFAULT FALSE,
    valid_from DATE NOT NULL,
    valid_to DATE,
    base JSONB NOT NULL,
    cladding JSONB NOT NULL,
    bathroom JSONB NOT NULL,
    glazing JSONB NOT NULL,
    electrical JSONB NOT NULL,
    internal JSONB NOT NULL,
    flooring JSONB NOT NULL,
    delivery JSONB NOT NULL,
    extras JSONB NOT NULL,
    taxes JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(label, valid_from)
);

-- Create unique constraint for current flag
CREATE UNIQUE INDEX idx_price_config_current_unique 
ON price_config (current) 
WHERE current = TRUE AND valid_to IS NULL;

-- Create quote_sequence table for generating quote numbers
CREATE TABLE quote_sequence (
    id SERIAL PRIMARY KEY,
    year INTEGER NOT NULL,
    sequence_number INTEGER NOT NULL DEFAULT 0,
    UNIQUE(year)
);

-- Create product_config table  
CREATE TABLE product_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    size JSONB NOT NULL,
    cladding JSONB NOT NULL DEFAULT '{}',
    bathroom JSONB NOT NULL DEFAULT '{}',
    electrical JSONB NOT NULL DEFAULT '{}',
    internal_doors INTEGER NOT NULL DEFAULT 0,
    internal_wall JSONB NOT NULL DEFAULT '{}',
    heaters INTEGER NOT NULL DEFAULT 0,
    glazing JSONB NOT NULL DEFAULT '{}',
    floor JSONB NOT NULL DEFAULT '{}',
    delivery JSONB NOT NULL DEFAULT '{}',
    extras JSONB NOT NULL DEFAULT '{}',
    discount DECIMAL(10,2) NOT NULL DEFAULT 0,
    estimate JSONB NOT NULL,
    notes TEXT CHECK (length(notes) <= 2000),
    permitted_development_flags JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create quote table
CREATE TABLE quote (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quote_number VARCHAR(20) UNIQUE NOT NULL,
    quote_date DATE NOT NULL DEFAULT CURRENT_DATE,
    customer JSONB NOT NULL,
    product_config_id UUID REFERENCES product_config(id),
    product_config_snapshot JSONB NOT NULL,
    price_config_id UUID REFERENCES price_config(id) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    vat_rate DECIMAL(5,4) NOT NULL,
    subtotal_ex_vat DECIMAL(12,2) NOT NULL CHECK (subtotal_ex_vat >= 0),
    total_inc_vat DECIMAL(12,2) NOT NULL CHECK (total_inc_vat >= 0),
    notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deleted')),
    audit JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_price_config_current ON price_config (current) WHERE current = TRUE;
CREATE INDEX idx_price_config_valid_dates ON price_config (valid_from, valid_to);
CREATE INDEX idx_quote_quote_number ON quote (quote_number);
CREATE INDEX idx_quote_date ON quote (quote_date);
CREATE INDEX idx_quote_status ON quote (status);
CREATE INDEX idx_quote_customer_name ON quote USING GIN ((customer->>'name') gin_trgm_ops);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_price_config_updated_at BEFORE UPDATE ON price_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_config_updated_at BEFORE UPDATE ON product_config  
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quote_updated_at BEFORE UPDATE ON quote
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- DOWN
DROP TRIGGER IF EXISTS update_quote_updated_at ON quote;
DROP TRIGGER IF EXISTS update_product_config_updated_at ON product_config;
DROP TRIGGER IF EXISTS update_price_config_updated_at ON price_config;
DROP FUNCTION IF EXISTS update_updated_at_column();

DROP INDEX IF EXISTS idx_quote_customer_name;
DROP INDEX IF EXISTS idx_quote_status;
DROP INDEX IF EXISTS idx_quote_date;
DROP INDEX IF EXISTS idx_quote_quote_number;
DROP INDEX IF EXISTS idx_price_config_valid_dates;
DROP INDEX IF EXISTS idx_price_config_current;

DROP TABLE IF EXISTS quote;
DROP TABLE IF EXISTS product_config;
DROP TABLE IF EXISTS quote_sequence;
DROP TABLE IF EXISTS price_config;