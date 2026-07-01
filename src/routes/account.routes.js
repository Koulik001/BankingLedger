const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const accountsController = require('../controllers/account.controller');

const router = express.Router();
/**
 * - POST /api/accounts/create-account
 * - Create a new account
 */
router.post('/create-account', authMiddleware.authUser, accountsController.createAccountController);
/**
 * - GET /api/accounts/
 *  - Get all accounts of a logged in user
 */
router.get('/', authMiddleware.authUser, accountsController.getUserAccountController);
/**
 * - GET /api/accounts/:accountId
 * - Get balance of an user account
 */
router.get('/balance/:ac_id', authMiddleware.authUser, accountsController.getAccountBalanceController)
module.exports = router