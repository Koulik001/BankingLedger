const express = require('express');
const authController = require('../controllers/auth.controller');
const router = express.Router();

/**
 * - POST /api/auth/register
 * - Register a new user
 */
router.post('/register', authController.registerUserController);
/**
 * - POST /api/auth/login
 * - Log in a registered user
 */
router.post('/login', authController.loginUser);
/**
 * - POST /api/auth/logout
 * - Log out a user by erasing and blacklisting the token
 */
router.post('/logout', authController.logoutUser)

module.exports = router;