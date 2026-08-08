import { getThermometerData, getPerformanceData, getReserveSnapshot } from '../services/thermometerService.js'
import { ensureMonthSetup } from '../services/monthlySetupService.js'

export async function thermometer(req, res) {
  const { month } = req.query
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'Parâmetro month obrigatório (formato: YYYY-MM)' })
  }

  await ensureMonthSetup(req.userId, month)

  const [days, reserveSnapshot] = await Promise.all([
    getThermometerData(req.userId, month),
    getReserveSnapshot(req.userId, month),
  ])

  const savings_month = reserveSnapshot.reserve_month_contributions
  return res.json({
    days,
    savings_month,
    savings_total: savings_month,
    ...reserveSnapshot,
  })
}

export async function performance(req, res) {
  const { year } = req.query
  if (!year || !/^\d{4}$/.test(year)) {
    return res.status(400).json({ error: 'Parâmetro year obrigatório (formato: YYYY)' })
  }

  const data = await getPerformanceData(req.userId, year)
  return res.json(data)
}
