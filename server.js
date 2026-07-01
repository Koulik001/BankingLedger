require('dotenv').config();
const app = require('./src/app');
const { query, getClient } = require("./src/config/db")
const { setUpCleanupJob } = require('./src/jobs/cleanup')
// pg connects lazily on first query — just verify the pool works
getClient().then(client => {
    console.log("DB pool initialized")
    client.release()
})

setUpCleanupJob()

app.listen(3000, ()=>{
    console.log('server started on port 3000');
})