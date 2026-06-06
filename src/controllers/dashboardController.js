import { getThermometerData, getPerformanceData } from '../services/thermometerService.js'
import { ensureMonthSetup } from '../services/monthlySetupService.js'

const todayStr = () => new Date().toISOString().slice(0, 7) // "YYYY-MM"

export async function thermometer(req, res) {
  const { month } = req.query
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'Parâmetro month obrigatório (formato: YYYY-MM)' })
  }

  // Generate fixed transactions for this month if it's current or past and not yet set up
  if (month <= todayStr()) {
    await ensureMonthSetup(req.userId, month)
  }

  const data = await getThermometerData(req.userId, month)
  return res.json(data)
}

export async function performance(req, res) {
  const { year } = req.query
  if (!year || !/^\d{4}$/.test(year)) {
    return res.status(400).json({ error: 'Parâmetro year obrigatório (formato: YYYY)' })
  }

  const data = await getPerformanceData(req.userId, year)
  return res.json(data)
}
