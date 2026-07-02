const db = require('../config/db')

/**
 * Create a ledger entry using a pg client as a part of transaction
 */
async function createLedgerEntry(client, {
    ac_id, 
    txn_id,
    amount,
    type
}){
    const result = await client.query(
        `INSERT INTO ledger_entries(ac_id, transaction_id, amount, type)
        VALUES($1, $2, $3, $4)
        RETURNING *`, [ac_id, txn_id, amount, type]
    )
    return result.rows[0]
}

/**
 * Get all ledger entries corresponding to an account id
 * Useful in auditing and see transaction history
 */

async function findByAcId(ac_id){
    const result = await db.query(
        `SELECT id, transaction_id, amount, type, created_at
        FROM ledger_entries WHERE ac_id = $1
        ORDER BY created_at DESC`, [ac_id]
    )
    return result.rows
}

/**
 * Get all ledger entries corrensponding to a transaction id
 * Should return exactly two rows one for debit and another for credit
 */

// async function findByTxnId(txn_id){
//     const result = await db.query(
//         `SELECT id, ac_id, amount, type, created_at
//         FROM ledger_entries WHERE transaction_id = $1
//         ORDER BY type ASC`, [ txn_id ]
//     )
//     return result.rows
// }

module.exports = {
    createLedgerEntry, 
    findByAcId
}