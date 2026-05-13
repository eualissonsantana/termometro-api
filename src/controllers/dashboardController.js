import { getThermometerData, getPerformanceData } from '../services/thermometerService.js'

export async function thermometer(req, res) {
  const { month } = req.query
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'Parâmetro month obrigatório (formato: YYYY-MM)' })
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
