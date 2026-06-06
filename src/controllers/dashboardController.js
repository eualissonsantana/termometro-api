import { getThermometerData, getPerformanceData } from '../services/thermometerService.js'
import { ensureMonthSetup } from '../services/monthlySetupService.js'
import { prisma } from '../lib/prisma.js'

const todayStr = () => new Date().toISOString().slice(0, 7) // "YYYY-MM"

export async function thermometer(req, res) {
  const { month } = req.query
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'Parâmetro month obrigatório (formato: YYYY-MM)' })
  }

  if (month <= todayStr()) {
    await ensureMonthSetup(req.userId, month)
  }

  const [days, savingsAgg] = await Promise.all([
    getThermometerData(req.userId, month),
    prisma.transaction.aggregate({
      where: { user_id: req.userId, type: 'economia' },
      _sum: { amount: true },
    }),
  ])

  const savings_total = Number(savingsAgg._sum.amount ?? 0)
  return res.json({ days, savings_total })
}

export async function performance(req, res) {
  const { year } = req.query
  if (!year || !/^\d{4}$/.test(year)) {
    return res.status(400).json({ error: 'Parâmetro year obrigatório (formato: YYYY)' })
  }

  const data = await getPerformanceData(req.userId, year)
  return res.json(data)
}
