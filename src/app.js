import express from 'express'
import cors from 'cors'
import compression from 'compression'
import authRoutes from './routes/auth.js'
import transactionRoutes from './routes/transactions.js'
import dashboardRoutes from './routes/dashboard.js'
import configRoutes from './routes/config.js'
import categoriesRoutes from './routes/categories.js'
import { requestTiming } from './middlewares/requestTiming.js'
import { errorHandler } from './middlewares/errorHandler.js'

const app = express()

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean)
  : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175']

app.use(requestTiming)
// gzip nas respostas: listas de transações e dias do mês encolhem ~80-90%
app.use(compression())
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }))
app.use(express.json())

// Health check público e sem banco: responde rápido para o cron de keep-alive
// e para o Render saber que a API subiu.
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/auth', authRoutes)
app.use('/api/transactions', transactionRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/config', configRoutes)
app.use('/api/categories', categoriesRoutes)

// Precisa ser o último middleware: recebe os erros de todas as rotas acima
app.use(errorHandler)

export default app
