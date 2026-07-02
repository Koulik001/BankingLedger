CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password TEXT NOT NULL,
    is_system_user BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounts(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN('ACTIVE', 'FROZEN', 'CLOSED')),
    currency TEXT NOT NULL DEFAULT 'INR',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_ac_id UUID NOT NULL REFERENCES accounts(id),
    to_ac_id UUID NOT NULL REFERENCES accounts(id),
    amount NUMERIC(15, 2) NOT NULL CHECK(amount > 0),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'COMPLETED', 'FAILED', 'REVERSED')),
    idempotency_key TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ledger_entries(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ac_id UUID NOT NULL REFERENCES accounts(id),
    transaction_id UUID NOT NULL REFERENCES transactions(id),
    amount NUMERIC(15, 2) NOT NULL CHECK(amount > 0),
    type TEXT NOT NULL CHECK(type IN('DEBIT', 'CREDIT')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS token_blacklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);

CREATE INDEX IF NOT EXISTS idx_accounts_user_status ON accounts(user_id, status);

CREATE INDEX IF NOT EXISTS idx_ledger_account_id ON ledger_entries(ac_id);

CREATE INDEX IF NOT EXISTS idx_ledger_transaction_id ON ledger_entries(transaction_id);

CREATE INDEX IF NOT EXISTS idx_transactions_idempotency ON transactions(idempotency_key);

CREATE INDEX IF NOT EXISTS idx_token_blacklist_token ON token_blacklist(token);



