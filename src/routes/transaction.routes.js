const express = require('express')
const router = express.Router()
const transactionController = require('../controllers/transaction.controller')
const authMiddleware = require('../middlewares/auth.middleware')

/**
 * - POST /api/transaction/
 * - Create a new transaction from one account(logged in) to another
 */
router.post('/', authMiddleware.authUser, transactionController.createTransactionController)

/**
 * - POST /api/transaction/system/initial-funds
 * - Create initial funds transaction from system user
 */
router.post('/system/initial-funds', authMiddleware.authSystemUser, transactionController.createInitialFundsTransaction)

module.exports = router