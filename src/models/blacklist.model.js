const db = require('../config/db')

/**
 * blacklist a token
 * Used in - logOutUser
 */

async function addTokenBlacklist(token){
    await db.query(
        `INSERT INTO token_blacklist(token)
        VALUES ($1)`, [token]
    )
}

/**
 * Check if a token is already blacklisted
 * Used in - every auth middleware check
 */

async function isBlacklisted(token){
    const result = await db.query(
        `SELECT id FROM token_blacklist WHERE token = $1`, [token]
    )
    return result.rows.length > 0
}

/**
 * Clean up expired tokens older than 3 days (matching JWT expiry)
 * Used in - Cron job
 */


async function cleanupExpiredTokens(){
    const result = await db.query(
        `DELETE FROM token_blacklist
        WHERE created_at < NOW() - INTERVAL '3 days'`
    )
    console.log(`Cleaned up ${result.rowCount} expired tokens`)
}   

module.exports = {
    addTokenBlacklist, 
    isBlacklisted, 
    cleanupExpiredTokens
}