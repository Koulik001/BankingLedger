const cron = require('node-cron')
const blacklistModel = require('../models/blacklist.model')

//Runs once every day at 3:00 AM (as low traffic)

function setUpCleanupJob(){
    cron.schedule("0 3 * * *", async ()=>{
        console.log(`[${new Date().toISOString()}] Running token blacklist cleanup...`)

        try {
            await blacklistModel.cleanupExpiredTokens()
        } catch (err) {
            console.error(`[${new Date().toISOString()}] Cleanup job failed:`, err.message)
        }
    })
}

module.exports = {
    setUpCleanupJob
}