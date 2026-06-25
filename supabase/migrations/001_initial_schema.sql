-- =============================================================================
-- La La Sweett Sales System — Initial Database Schema
-- Migration 001: Create all tables, constraints, indexes
-- =============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- ENUM-LIKE CHECK CONSTRAINTS (using varchar + CHECK for Supabase compatibility)
-- =============================================================================

-- =============================================================================
-- TABLE: customers
-- =============================================================================
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(254) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    delivery_address TEXT,
    marketing_consent BOOLEAN NOT NULL DEFAULT FALSE,
    consent_timestamp TIMESTAMPTZ,
    consent_channel VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_phone ON customers(phone);

-- =============================================================================
-- TABLE: categories
-- =============================================================================
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    sort_order INT NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_sort_order ON categories(sort_order);

-- =============================================================================
-- TABLE: products
-- =============================================================================
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    name VARCHAR(200) NOT NULL,
    description_short VARCHAR(150) NOT NULL DEFAULT '',
    price_min DECIMAL(10,2) NOT NULL,
    price_max DECIMAL(10,2) NOT NULL,
    min_servings INT NOT NULL,
    max_servings INT NOT NULL,
    lead_time_days INT NOT NULL,
    image_url TEXT NOT NULL DEFAULT '',
    allergen_tags JSONB NOT NULL DEFAULT '[]',
    structured_data JSONB NOT NULL DEFAULT '{}',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_products_price CHECK (price_min >= 0 AND price_max >= price_min),
    CONSTRAINT chk_products_servings CHECK (min_servings >= 1 AND max_servings >= min_servings)
);

CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_active ON products(active);

-- =============================================================================
-- TABLE: product_flavors
-- =============================================================================
CREATE TABLE product_flavors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    flavor_name VARCHAR(100) NOT NULL,
    available BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_product_flavors_product_id ON product_flavors(product_id);

-- =============================================================================
-- TABLE: orders
-- =============================================================================
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    state VARCHAR(20) NOT NULL DEFAULT 'Inquiry'
        CHECK (state IN (
            'Inquiry', 'Quoted', 'Deposit_Received', 'Confirmed',
            'In_Production', 'Ready', 'Delivered', 'Picked_Up', 'Cancelled'
        )),
    event_date DATE NOT NULL,
    servings INT NOT NULL CHECK (servings >= 1 AND servings <= 500),
    flavor_preference VARCHAR(200) NOT NULL DEFAULT '',
    design_description TEXT NOT NULL DEFAULT '',
    budget_range VARCHAR(50) NOT NULL DEFAULT '',
    quoted_price DECIMAL(10,2),
    deposit_amount DECIMAL(10,2),
    delivery_preference VARCHAR(10)
        CHECK (delivery_preference IS NULL OR delivery_preference IN ('delivery', 'pickup')),
    delivery_address TEXT,
    originating_channel VARCHAR(20) NOT NULL
        CHECK (originating_channel IN ('whatsapp', 'instagram', 'chat_widget')),
    cancellation_reason TEXT,
    refund_flagged BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_state ON orders(state);
CREATE INDEX idx_orders_event_date ON orders(event_date);
CREATE INDEX idx_orders_created_at ON orders(created_at);

-- =============================================================================
-- TABLE: order_state_transitions
-- =============================================================================
CREATE TABLE order_state_transitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    from_state VARCHAR(20) NOT NULL,
    to_state VARCHAR(20) NOT NULL,
    triggered_by VARCHAR(100) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_state_transitions_order_id ON order_state_transitions(order_id);
CREATE INDEX idx_order_state_transitions_created_at ON order_state_transitions(created_at);

-- =============================================================================
-- TABLE: conversations
-- =============================================================================
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    channel VARCHAR(20) NOT NULL
        CHECK (channel IN ('whatsapp', 'instagram', 'chat_widget')),
    session_id VARCHAR(100) NOT NULL,
    intent_tags TEXT[] NOT NULL DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'resolved', 'escalated')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conversations_customer_id ON conversations(customer_id);
CREATE INDEX idx_conversations_session_id ON conversations(session_id);
CREATE INDEX idx_conversations_status ON conversations(status);

-- =============================================================================
-- TABLE: messages
-- =============================================================================
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL
        CHECK (role IN ('customer', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- =============================================================================
-- TABLE: escalations
-- =============================================================================
CREATE TABLE escalations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    context_summary VARCHAR(500) NOT NULL,
    originating_channel VARCHAR(20) NOT NULL
        CHECK (originating_channel IN ('whatsapp', 'instagram', 'chat_widget')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'in_progress', 'resolved', 'dismissed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_escalations_conversation_id ON escalations(conversation_id);
CREATE INDEX idx_escalations_status ON escalations(status);

-- =============================================================================
-- TABLE: consent_records
-- =============================================================================
CREATE TABLE consent_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    consent_type VARCHAR(50) NOT NULL,
    granted BOOLEAN NOT NULL,
    channel VARCHAR(50) NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_consent_records_customer_id ON consent_records(customer_id);

-- =============================================================================
-- TABLE: marketing_channels
-- =============================================================================
CREATE TABLE marketing_channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    monthly_budget DECIMAL(10,2) NOT NULL DEFAULT 0,
    channel_type VARCHAR(50) NOT NULL
);

-- =============================================================================
-- TABLE: marketing_attributions
-- =============================================================================
CREATE TABLE marketing_attributions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES marketing_channels(id) ON DELETE RESTRICT,
    referral_source VARCHAR(200) NOT NULL DEFAULT '',
    first_interaction TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    attributed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_marketing_attributions_customer_id ON marketing_attributions(customer_id);
CREATE INDEX idx_marketing_attributions_channel_id ON marketing_attributions(channel_id);

-- =============================================================================
-- TABLE: notifications
-- =============================================================================
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(50) NOT NULL,
    recipient_type VARCHAR(20) NOT NULL
        CHECK (recipient_type IN ('owner', 'customer')),
    recipient_id VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    actions JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'delivered', 'failed', 'queued')),
    retry_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivered_at TIMESTAMPTZ
);

CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_recipient_id ON notifications(recipient_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- =============================================================================
-- TRIGGER: Auto-update updated_at timestamps
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
