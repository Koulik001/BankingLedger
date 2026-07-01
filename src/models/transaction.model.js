const db = require('../config/db')
/**
 * Find a transaction by idempotency key
 * Used in: createTransaction — checked before doing anything else
 */
async function findByIdempotencyKey(idempotencyKey) {
    const result = await db.query(
        `SELECT id, from_ac_id, to_ac_id, amount, status, idempotency_key, created_at
        FROM transactions WHERE idempotency_key = $1`, [ idempotencyKey ]
    )

    return result.rows[0] || null
}
/**
 * Create a new transaction in PENDING state.
 * Means we have acknowledged the request but have not 
 * moved the money yet.
 */

async function createTransaction ( client, 
    {from_ac_id, to_ac_id, amount, idempotency_key}
){
    const result = await client.query(
        `INSERT INTO transactions(from_ac_id, to_ac_id, amount, idempotency_key, status) 
        VALUES($1, $2, $3, $4, 'PENDING')
        RETURNING *`, [ from_ac_id, to_ac_id, amount, idempotency_key ]
    )
    return result.rows[0]
}

/**
 * Update status of transaction 
 * Used after both ledger entries succeeds to mark as COMPLETED
 */

async function updateStatus(client, txn_id, status) {
    const result = await client.query(
        `UPDATE transactions 
        SET status = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *`, [ status, txn_id ]
    )

    return result.rows[0]
}


module.exports = {
    findByIdempotencyKey,
    createTransaction,
    updateStatus
}
