const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    min: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    ssl: process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false
})

pool.on("connect", () => {
    console.log("new connection opened in pool")
})

pool.on("error", (err) => {
    console.error("Unexpected error on idle client", err)
    process.exit(1)
})

const query = (text, params) => {
    return pool.query(text, params)
}

const getClient = () => pool.connect();

module.exports = { query, getClient }