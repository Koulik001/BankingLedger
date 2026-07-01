const accountModel = require('../models/account.model');
/**
 * Create a new account of an user
 */
async function createAccountController(req, res){
    const user = req.user;
    
    const account = await accountModel.createAccount(user.id)

    return res.status(201).json({
        message: "Account created successfully", 
        account
    })
}

/**
 * Find all accounts of an user
 */

async function getUserAccountController(req, res){
    const accounts = await accountModel.findByUserId(req.user.id)

    return res.status(200).json({accounts})
}

/**
 * Get account balance of an user account
 */

async function getAccountBalanceController(req, res){
    const {ac_id} = req.params
    const account = await accountModel.findByIdAndUserId(ac_id, req.user.id)

    if(!account){
        return res.status(404).json({
            message: "Account not found"
        })
    }

    const balance = await accountModel.getBalance(ac_id)

    return res.status(200).json({
        accountId: account.id,
        currency: account.currency,
        balance
    })
}



module.exports = { 
    createAccountController,
    getUserAccountController,
    getAccountBalanceController
}

