# Banking Ledger API

A production-minded REST API for managing bank accounts and financial transactions, built with Node.js, Express, and PostgreSQL using raw SQL.

The system implements double-entry bookkeeping — every transfer creates an immutable DEBIT and CREDIT ledger entry inside an atomic database transaction, ensuring the ledger is always the source of truth for account balances.

---

## Architecture Overview

```
Client (Postman / Frontend)
        │
        ▼
   Express Router
        │
        ▼
Auth Middleware ──────────────────────────────────┐
(JWT verify + blacklist check)                    │
        │                                         │
        ▼                                         ▼
   Controllers                            token_blacklist
(auth / accounts / transactions)         (daily cleanup via
        │                                    node-cron)
        ▼
   Model Functions
(plain query functions, raw SQL)
        │
        ▼
  PostgreSQL (via pg Pool)
        │
   ┌────┴──────────────────────────────────┐
   │                                       │
users ──► accounts ──► transactions ──► ledger_entries
                            │
                     (DEBIT + CREDIT per transaction
                      double-entry bookkeeping)
```

### Database Schema

```
users
  id, email, name, password, is_system_user,
  created_at, updated_at

accounts
  id, user_id (FK → users),
  status (ACTIVE/FROZEN/CLOSED), currency,
  created_at, updated_at

transactions
  id, from_ac_id (FK → accounts), to_ac_id (FK → accounts),
  amount, status (PENDING/COMPLETED/FAILED/REVERSED),
  idempotency_key, created_at, updated_at

ledger_entries
  id, ac_id (FK → accounts), transaction_id (FK → transactions),
  amount, type (DEBIT/CREDIT), created_at

token_blacklist
  id, token, created_at
```

---

## Key Design Decisions

### 1. PostgreSQL over MongoDB

This system is ledger-heavy by nature — every account balance is derived by summing immutable ledger entries, and every transfer involves multiple related rows across accounts, transactions, and ledger entries. This is a relational data model. PostgreSQL's foreign key constraints, CHECK constraints, and native ACID transactions are exactly what a financial system needs. A document store's flexible schema adds no value here and actively works against the structured, relational nature of the data.

### 2. Raw SQL over ORM (Sequelize / Prisma)

Using raw SQL with the `pg` library means every query is explicit and traceable — no ORM generating unpredictable SQL or hiding what runs on the database. This is especially important inside transaction blocks where the exact sequence of operations matters. The balance check, the ledger inserts, and the status update all need to be reasoned about precisely, which is easier when you wrote the SQL yourself. SQL is also a transferable skill; ORM knowledge is not.

### 3. Balance Derived from Ledger — Never Stored

Account balance is not stored as a column. It is computed fresh from ledger entries on every request:

```sql
SELECT
    COALESCE(SUM(CASE WHEN type = 'CREDIT' THEN amount ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN type = 'DEBIT'  THEN amount ELSE 0 END), 0)
    AS balance
FROM ledger_entries
WHERE ac_id = $1
```

A stored balance column can drift out of sync with ledger entries due to bugs or crashes. With this approach, the ledger is always the ground truth — balance can be recomputed from scratch at any time. This is how real banking systems work.

### 4. Double-Entry Bookkeeping

Every transfer creates exactly two ledger entries — a DEBIT on the sender's account and a CREDIT on the receiver's account. Both are created inside a single `BEGIN/COMMIT` block, so they either both exist or neither does. For any transaction, the sum of all ledger entries always balances to zero across both accounts.

### 5. Race Condition Prevention with `SELECT FOR UPDATE`

Without locking, two concurrent transfer requests for the same account could both pass the balance check before either commits — a TOCTOU (time-of-check to time-of-use) race condition that would create an overdraft.

The fix: lock the sender's account row inside the transaction block before computing balance.

```sql
-- Locks the account row — concurrent debits on this account
-- block here until the first transaction commits or rolls back
SELECT id FROM accounts WHERE id = $1 FOR UPDATE
```

After the lock, the balance is computed. Any concurrent debit sees the real post-commit balance rather than a stale pre-commit read.

Important: `FOR UPDATE` cannot be used with aggregate functions in PostgreSQL. This is why we lock the account row itself rather than the ledger entries — the account row is the single point of contention regardless of how many ledger entries exist.

### 6. Idempotency Keys

Every transaction requires a client-generated idempotency key. If the same key is submitted twice, the second request returns the result of the first instead of creating a duplicate transfer. This protects against double-payments caused by network retries, client bugs, or double-clicks.

### 7. Ledger Immutability by Omission

The ledger model has no `update` or `delete` functions — not because they are blocked at runtime, but because they simply do not exist. It is architecturally impossible to modify a ledger entry from application code regardless of who calls it. You cannot call what does not exist.

### 8. System User as Fund Source

A designated system user account acts as the source for initial fund crediting. This account is created directly in the database by a developer — there is no API endpoint to create system users. The `createUser` function only accepts `email`, `name`, and `password` via destructuring, so even if a request body includes `is_system_user: true`, it is discarded before reaching the SQL query. The `is_system_user` column defaults to `false` at the database level as a second independent layer of protection.

### 9. Password Exclusion at SQL Level

Two separate query functions exist for user lookup:

```js
findByEmail()             // SELECT id, email, name, created_at — no password
findByEmailWithPassword() // SELECT id, email, name, password — login only
```

The password never leaves the database unless the operation is authentication. This is stronger than ORM-level field exclusion, which fetches the field from the database and strips it at the application layer. Here the password is never fetched from the database at all unless explicitly needed.

### 10. Asymmetric Ownership Checks (403 vs 404)

When validating a transfer, the sender account is checked with `findByIdAndUserId` — confirming it belongs to the authenticated user. If it does not, the response is `403 Forbidden`, not `404 Not Found`. Returning `404` for an account the user does not own would leak information about which account IDs exist in the system.

The receiver account only requires existence — `404` is appropriate there since the user is not claiming ownership.

---

## Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Runtime | Node.js | — |
| Framework | Express | — |
| Database | PostgreSQL | Relational, ACID, correct for ledger systems |
| DB Client | `pg` (raw SQL) | Full control, no ORM abstraction |
| Auth | JWT + bcryptjs | Stateless auth with secure password hashing |
| Scheduling | node-cron | Daily token blacklist cleanup |
| Email | Nodemailer + Gmail OAuth2 | Transaction and registration notifications |

---

## API Reference

### Auth

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | None | Register a new user |
| POST | `/api/auth/login` | None | Login and receive JWT |
| POST | `/api/auth/logout` | Bearer token | Blacklist current token |

### Accounts

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/accounts/create-account` | Bearer token | Create a new account |
| GET | `/api/accounts` | Bearer token | Get all accounts for logged-in user |
| GET | `/api/accounts/balance/:ac_id` | Bearer token | Get derived balance for an account |

### Transactions

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/transactions` | Bearer token | Transfer funds between two accounts |
| GET | `/api/transactions/:ac_id/history` | Bearer token | Get transaction history for an account |
| POST | `/api/transactions/system/initial-funds` | System user only | Credit initial funds to a user account |

---

## Transfer Flow

```
POST /api/transactions

Pre-transaction — validation:
  1. Validate request body (required fields, amount format, decimal precision)
  2. Verify fromAccount exists and belongs to authenticated user → 403 if not
  3. Verify toAccount exists → 404 if not
  4. Idempotency key check — return existing result if key already seen
  5. Verify both accounts are ACTIVE

Inside atomic DB transaction (BEGIN / COMMIT / ROLLBACK):
  6. Lock sender account row with SELECT FOR UPDATE
  7. Compute sender balance under lock — reject if insufficient → 400
  8. Create transaction record (PENDING)
  9. Create DEBIT ledger entry (money leaves sender)
  10. Create CREDIT ledger entry (money arrives at receiver)
  11. Mark transaction COMPLETED
  12. COMMIT — all writes become permanent simultaneously
      Any error at any step triggers ROLLBACK — nothing is persisted

Post-transaction:
  13. Send email notification
      (outside transaction block — email failure never
       rolls back an already-committed transfer)
```

---

## Local Setup

### Prerequisites

- Node.js v18+
- PostgreSQL database (local or cloud)

### Installation

```bash
git clone https://github.com/Koulik001/BankingLedger.git
cd BankingLedger
npm install
```

### Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
JWT_SECRET=your_jwt_secret_here
NODE_ENV=development

EMAIL_USER=your_gmail@gmail.com
CLIENT_ID=your_google_oauth_client_id
CLIENT_SECRET=your_google_oauth_client_secret
REFRESH_TOKEN=your_gmail_refresh_token
```

### Database Setup

Run the schema against your PostgreSQL database to create all five tables, indexes, and constraints:

```bash
npm run setup:db
```

### System User Setup

The system user must be created directly in the database — there is no API endpoint for this by design. No application code path can set `is_system_user = true`.

```bash
# Step 1 — Register via API
POST /api/auth/register
{ "email": "system@ledger.com", "name": "System User", "password": "your_password" }

# Step 2 — Elevate to system user directly in DB
UPDATE users SET is_system_user = true WHERE email = 'system@ledger.com';

# Step 3 — Login as system user and create their account
POST /api/auth/login
POST /api/accounts/create-account
```

### Start the Server

```bash
npm start
```

Expected output:
```
new connection opened in pool
DB pool initialized
Token blacklist cleanup job scheduled — runs daily at 3:00 AM
Server is running on port 3000
Email server is ready to send messages
```

---

## Background Jobs

### Token Blacklist Cleanup

JWTs expire after 3 days. Once a token expires, its blacklist entry serves no security purpose — the token is rejected by JWT verification before the blacklist check even runs. A `node-cron` job runs daily at 3:00 AM to delete rows older than 3 days, keeping the blacklist table lean and the per-request lookup fast.

This runs on a schedule rather than per-request deliberately — the blacklist is on the critical path of every authenticated API call. Adding a DELETE to every request would cause lock contention with the SELECT happening in auth middleware simultaneously.

---

## Concepts Demonstrated

- Double-entry bookkeeping (immutable ledger pattern)
- ACID transactions with `BEGIN / COMMIT / ROLLBACK`
- Race condition prevention with `SELECT FOR UPDATE` on account row
- TOCTOU vulnerability awareness and fix
- Idempotency keys for safe payment retries
- Connection pooling with `pg` — `pool.query` vs `pool.connect` and when to use each
- `client.release()` in `finally` — preventing pool exhaustion
- JWT authentication with explicit token blacklisting on logout
- Two-layer JWT security — expiry check + blacklist check
- Parameterized queries — SQL injection prevention
- Password exclusion at the SQL `SELECT` level
- Principle of least privilege in query design
- Mass assignment prevention via function-level destructuring
- Immutability enforced by omission
- Asymmetric authorization checks (403 vs 404)
- Scheduled background jobs with node-cron
- `FOR UPDATE` incompatibility with aggregate functions in PostgreSQL
