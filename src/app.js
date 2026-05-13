import express from 'express'
import authRoutes from './routes/auth.js'
import transactionRoutes from './routes/transactions.js'
import dashboardRoutes from './routes/dashboard.js'
import configRoutes from './routes/config.js'
import categoriesRoutes from './routes/categories.js'

const app = express()

app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/transactions', transactionRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/config', configRoutes)
app.use('/api/categories', categoriesRoutes)

export default app
