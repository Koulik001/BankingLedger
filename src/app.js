const express = require('express');
const app = express();
const cookieParser = require('cookie-parser')
app.use(express.json());
app.use(cookieParser())
const authRoutes = require('../src/routes/auth.routes');
const accountRoutes = require('../src/routes/account.routes');
const transactionRoutes = require('../src/routes/transaction.routes')

app.get('/', (req, res)=>{
    res.send('Ledger service is up and running')
})

app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/transaction', transactionRoutes);
module.exports = app;