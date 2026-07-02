const db = require('../config/db')

const transactionModel = require('../models/transaction.model')
const ledgerModel = require('../models/ledger.model')
const accountModel = require('../models/account.model')
const emailService = require('../services/email.service')

/**
 * POST /api/transactions
 *
 * THE TRANSFER FLOW — 10 STEPS:
 *
 * PRE-TRANSACTION (validation before touching the DB transactionally):
 *   Step 1 — Validate request body fields exist
 *   Step 2 — Validate both accounts exist in DB
 *   Step 3 — Check idempotency key — has this request been seen before?
 *   Step 4 — Check both accounts are ACTIVE
 *   
 *
 * INSIDE TRANSACTION (atomic — all succeed or all roll back):
 *   Step 5 — Derive sender balance — do they have enough funds?
 *   Step 6 — Create transaction record (PENDING)
 *   Step 7 — Create DEBIT ledger entry (money leaves sender)
 *   Step 8 — Create CREDIT ledger entry (money arrives at receiver)
 *   Step 9 — Mark transaction COMPLETED
 *   Step 10 — COMMIT
 *
 * POST-TRANSACTION:
 *   Step 11 — Send email notification (non-blocking)
 */

async function createTransactionController(req, res){
    try{
        const {from_ac, to_ac, idempotency_key} = req.body
        const amount = parseFloat(req.body.amount)
        if(!from_ac || !to_ac || !amount || !idempotency_key){
            return res.status(400).json({
                message: "from account, to account, amount, idempotency key all are required to create a transaction"
            })
        }

        if(from_ac == to_ac){
            return res.status(400).json({
                message: "from account and to account can not be same for transaction"
            })
        }

        if(!isFinite(amount) || isNaN(amount) || amount <= 0){
            return res.status(400).json({
                message: "transaction amount must be a valid positive number"
            })
        }
        // Rounding to 2 decimal places (to match (15, 2)) before db write
        const roundedAmount = Math.round(amount * 100) / 100

        const [fromAc, toAc] = await Promise.all([
            accountModel.findByIdAndUserId(from_ac, req.user.id),
            accountModel.findById(to_ac)
        ])

        if(!fromAc){
            return res.status(403).json({
                message: "Account not found or ownership denied"
            })
        }

        if(!toAc){
            return res.status(404).json({
                message: "Receiver account not found"
            })
        }

        if(fromAc.status !== "ACTIVE"){
            return res.status(400).json({
                message: "from Account is not active"
            })
        }

        if(toAc.status !== "ACTIVE"){
            return res.status(400).json({
                message: "to Account is not active"
            })
        }

        const existingTxn = await transactionModel.findByIdempotencyKey(idempotency_key)

        if(existingTxn){
            if(existingTxn.status === "COMPLETED"){
                return res.status(200).json({
                    message: "Transaction already processed"
                })
            }

            if(existingTxn.status === "PENDING"){
                return res.status(200).json({
                    message: "Transaction is still processing, please wait"
                })
            }

            if(existingTxn.status === "FAILED"){
                return res.status(400).json({
                    message: "Transaction failed. Please retry with a new idempotency key"
                })
            }

            if(existingTxn.status === "REVERSED"){
                return res.status(400).json({
                    message: "Transaction reversed, retry with new idempotency key"
                })
            }
        }

        

        const client = await db.getClient()
        let transaction 
        try{
            await client.query("BEGIN")
            // Lock sender account row first
            // Any concurrent transaction trying to debit this account locks till commit or rollback
            await client.query(
                `SELECT id FROM accounts
                WHERE id = $1
                FOR UPDATE`, [ from_ac ]
            )
            // Check sender balance under applied lock
            const avlBalance = await client.query(
                `SELECT 
                    COALESCE(SUM(CASE WHEN type = 'CREDIT' THEN amount ELSE 0 END), 0) -
                    COALESCE(SUM(CASE WHEN type = 'DEBIT' THEN amount ELSE 0 END), 0)
                    AS balance
                FROM ledger_entries
                WHERE ac_id = $1`, [from_ac]
            )

            const senderBalance = parseFloat(avlBalance.rows[0].balance)
            if(senderBalance < roundedAmount){
                await client.query("ROLLBACK")
                return res.status(400).json({
                    message: `Insufficient balance to process the transaction, Current balance: ${senderBalance}, requested: ${amount}`
                })
            }
            //Create a valid transaction
            transaction = await transactionModel.createTransaction(client, {
                from_ac_id: from_ac,
                to_ac_id: to_ac,
                amount: roundedAmount,
                idempotency_key
            })

            //DEBIT sender
            await ledgerModel.createLedgerEntry(client,{
                ac_id: from_ac,
                txn_id: transaction.id,
                amount: roundedAmount,
                type: "DEBIT"
            })

            //CREDIT receiver
            await ledgerModel.createLedgerEntry(client, {
                ac_id: to_ac,
                txn_id: transaction.id,
                amount: roundedAmount, 
                type: "CREDIT"
            })

            //Mark the status complete 
            transaction = await transactionModel.updateStatus(client, transaction.id, "COMPLETED")

            await client.query("COMMIT")
        }catch(err){
            await client.query("ROLLBACK")
            console.log("Some unexpected DB error: ", err)
            await emailService.sendTransactionFailureEmail(req.user.email, req.user.name, roundedAmount, to_ac)
            return res.status(500).json({
                message: "Transaction failed, please retry"
            })
        } finally{
            client.release()
        }

        await emailService.sendTransactionEmail(req.user.email,req.user.name, roundedAmount, to_ac) 

        return res.status(201).json({
            message: "Transaction completed successfully",
            transaction
        })
    }catch(err){
        console.error("Unexpected error in createTransaction:", err)
        return res.status(500).json({
            message: "An unexpected error occurred"
        })
    }
}

async function createInitialFundsTransaction(req, res){
    try{
        const {to_ac, idempotency_key} = req.body
        const amount = parseFloat(req.body.amount)

        if(!to_ac || !idempotency_key){
            return res.status(400).json({
                message: "Account and idempotency key both required"
            })
        }

        if(isNaN(amount) || !isFinite(amount) || amount <= 0){
            return res.status(400).json({
                message: "Amount must be a positive number"
            })
        }
        
        const roundedAmount = Math.round(amount * 100) / 100
        //console.log(roundedAmount)
        const toAc = await accountModel.findById(to_ac)

        if(!toAc){
            return res.status(404).json({
                message: "Receiver account not find"
            })
        }

        const systemAcs = await accountModel.findByUserId(req.user.id)

        if(!systemAcs || systemAcs.length === 0){
            return res.status(500).json({
                message: "System account not found. Contact administrator"
            })
        }

        const systemAc = await systemAcs.find(
            acc => acc.status === "ACTIVE"
        )

        if(!systemAc){
            return res.status(500).json({
                message: "No active system account found. Contact administrator"
            })
        }

        if(systemAc.id == to_ac){
            return res.status(400).json({
                message: "Can not transfer money to own account"
            })
        }

        const existingTxn = await transactionModel.findByIdempotencyKey(idempotency_key)

        if(existingTxn){
            if(existingTxn.status === "COMPLETED"){
                return res.status(200).json({
                    message: "Transaction already processed"
                })
            }

            if(existingTxn.status === "PENDING"){
                return res.status(200).json({
                    message: "Transaction is still processing, please wait"
                })
            }

            if(existingTxn.status === "FAILED"){
                return res.status(400).json({
                    message: "Transaction failed. Please retry with a new idempotency key"
                })
            }

            if(existingTxn.status === "REVERSED"){
                return res.status(400).json({
                    message: "Transaction reversed, retry with new idempotency key"
                })
            }
        }

        const client = await db.getClient()
        let transaction 
        try{
            await client.query("BEGIN")
            //No balance check for System account requried, as it is the source of amount
            transaction = await transactionModel.createTransaction(client, {
                from_ac_id: systemAc.id,
                to_ac_id: to_ac,
                amount: roundedAmount,
                idempotency_key
            })

            await ledgerModel.createLedgerEntry(client,{
                ac_id: systemAc.id,
                txn_id: transaction.id,
                amount: roundedAmount,
                type: "DEBIT"
            })

            await ledgerModel.createLedgerEntry(client, {
                ac_id: to_ac,
                txn_id: transaction.id,
                amount: roundedAmount,
                type: "CREDIT"
            })

            transaction = await transactionModel.updateStatus(client, transaction.id, "COMPLETED") 

            await client.query("COMMIT")
        } catch(err){
            await client.query("ROLLBACK")
            console.error("Initial funds transaction error:", err)
            return res.status(500).json({
                message: "Failed to credit initial funds, please retry"
            })
        }finally{
            client.release()
        }

        return res.status(201).json({
            message: "Initial funds created successfully",
            transaction
        })
    }catch(err){
        console.error("Unexpected error in createInitialFundsTransaction:", err)
        return res.status(500).json({
            message: "An unexpected error occurred"
        })
    }
}

/**
 * Get the transaction history of an account (recent transaction first)
 */

async function getTransactionHistoryController(req, res){
    const { ac_id } = req.params

    const account = await accountModel.findByIdAndUserId(ac_id, req.user.id)
    if(!account){
        return res.status(403).json({
            message: "Account not found or access denied"
        })
    }

    const history = await transactionModel.findByAcId(ac_id)

    return res.status(200).json({ history })
}

module.exports = {
    createTransactionController,
    createInitialFundsTransaction,
    getTransactionHistoryController
}