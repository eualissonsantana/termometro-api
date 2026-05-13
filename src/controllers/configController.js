import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

const dailyRateSchema = z.object({
  daily_rate: z.number().positive(),
})

const monthConfigSchema = z.object({
  recurring_incomes: z.array(
    z.object({
      description: z.string(),
      amount: z.number().positive(),
    })
  ),
})

export async function getConfig(req, res) {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, name: true, email: true, daily_rate: true },
  })
  return res.json(user)
}

export async function updateConfig(req, res) {
  const result = dailyRateSchema.safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({ error: result.error.flatten().fieldErrors })
  }

  const user = await prisma.user.update({
    where: { id: req.userId },
    data: { daily_rate: result.data.daily_rate },
    select: { id: true, name: true, email: true, daily_rate: true },
  })

  return res.json(user)
}

export async function getMonthConfig(req, res) {
  const { month } = req.params
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'Formato inválido. Use YYYY-MM' })
  }

  const config = await prisma.monthlyConfig.findUnique({
    where: { user_id_month: { user_id: req.userId, month } },
  })

  return res.json(config ?? { month, recurring_incomes: [] })
}

export async function updateMonthConfig(req, res) {
  const { month } = req.params
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'Formato inválido. Use YYYY-MM' })
  }

  const result = monthConfigSchema.safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({ error: result.error.flatten().fieldErrors })
  }

  const config = await prisma.monthlyConfig.upsert({
    where: { user_id_month: { user_id: req.userId, month } },
    update: { recurring_incomes: result.data.recurring_incomes },
    create: { user_id: req.userId, month, recurring_incomes: result.data.recurring_incomes },
  })

  return res.json(config)
}
