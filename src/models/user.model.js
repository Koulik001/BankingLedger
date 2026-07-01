const db = require('../config/db')
const bcrypt = require('bcryptjs')

/**
 * Find user using email
 * Used in - Log in , register
 */

async function findByEmail(email){
    const result = await db.query(
        `SELECT id, email, name, created_at FROM users WHERE email = $1`, [email]
    )
    return result.rows[0] || null
}

/**
 * Find a user by their ID
 * Used in - auth middleware (after JWT decode)
 */

async function findById(id){
    const result = await db.query(
        `SELECT id, email, name, created_at FROM users WHERE id = $1`, [id]
    )
    return result.rows[0] || null
}

/**
 * Find a user by ID and include system_user flag
 * Used in - authSystemUserMiddleware
 */

async function findByIdWithSystemFlag(id){
    const result = await db.query(
        `SELECT id, email, name, is_system_user FROM users WHERE id = $1`, [id]
    )
    return result.rows[0] || null
}

/**
 * Get user with the password field included
 * Used in - login (needs password to compare)
 */

async function findByEmailWithPassword(email) {
    const result = await db.query(
        `SELECT id, email, name, password FROM users WHERE email = $1`,
        [email]
    )
    return result.rows[0] || null
}

/**
 * Create a new User
 */

async function createUser({email, name, password}){
    const hashedPassword = await bcrypt.hash(password, 10)
    const result = await db.query(
        `INSERT INTO users(email, name, password)
        VALUES ($1, $2, $3)
        RETURNING id, email, name, created_at`, 
        [email, name, hashedPassword]
    )
    return result.rows[0]
}

async function comparePasswords(plainPassword, hashedPassword){
    return bcrypt.compare(plainPassword, hashedPassword)
}

module.exports = {
    findByEmail,
    findById, 
    findByEmailWithPassword, 
    findByIdWithSystemFlag, 
    createUser,
    comparePasswords
}