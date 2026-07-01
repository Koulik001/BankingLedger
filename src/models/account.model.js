const db = require('../config/db')

/**
 * Create a new account of an user
 * Used in - createAccountController
 */

async function createAccount(userId){
    const result = await db.query(
        `INSERT INTO accounts (user_id)
        VALUES ($1)
        RETURNING id, user_id, status, currency, created_at`,
        [ userId ]
    )
    return result.rows[0]
}
/**
 * Find all accounts of an existing user
 * Used in - getUserAccountController
 */
async function findByUserId(userId){
    const result = await db.query(
        `SELECT id, user_id, status, currency, created_at
        FROM accounts WHERE user_id = $1`, [ userId ] 
    )
    return result.rows
}

/**
 * Find account by account_id
 * Used in - transaction controller (validate accounts exist)
 */

async function findById(id){
    const result = await db.query(
        `SELECT id, user_id, status, currency
        FROM accounts WHERE id = $1`, [ id ]
    )
    return result.rows[0] || null
}

/**
 * find a single account by its Id scoped to a specific user
 * Used in -  getAccountBalanceController
 */

async function findByIdAndUserId(id, userId){
    const result = await db.query(
        `SELECT id, user_id, status, currency 
        FROM accounts WHERE id = $1 AND user_id = $2`, [ id, userId ]
    )
    return result.rows[0] || null
}

/**
 * Find balance of an account id
 * Used in - getAccountBalanceController
 */

async function getBalance(ac_id){
    const result = await db.query(
        `SELECT 
        COALESCE(SUM(CASE WHEN type = 'CREDIT' THEN amount ELSE 0 END), 0) - 
        COALESCE(SUM(CASE WHEN type = 'DEBIT' THEN amount ELSE 0 END), 0)
        AS balance
        FROM ledger_entries
        WHERE ac_id = $1`, [ ac_id ]
    )

    return parseFloat(result.rows[0].balance)
}

module.exports = {
    createAccount, 
    findByUserId,
    findById, 
    findByIdAndUserId,
    getBalance
}