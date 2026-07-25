import express from 'express'
import cors from 'cors'
import authRoutes from './routes/auth.js'
import transactionRoutes from './routes/transactions.js'
import dashboardRoutes from './routes/dashboard.js'
import configRoutes from './routes/config.js'
import categoriesRoutes from './routes/categories.js'

const app = express()

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean)
  : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175']

app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }))
app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/transactions', transactionRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/config', configRoutes)
app.use('/api/categories', categoriesRoutes)

export default app
