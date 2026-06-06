import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

export async function getConfig(req, res) {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, name: true, email: true, daily_rate: true, start_date: true },
  })
  const data = {
    ...user,
    start_date: user.start_date ? user.start_date.toISOString().slice(0, 10) : null,
  }
  return res.json(data)
}

export async function updateDailyRate(req, res) {
  const schema = z.object({ daily_rate: z.coerce.number().positive() })
  const result = schema.safeParse(req.body)
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

export async function updateStartDate(req, res) {
  const schema = z.object({
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  })
  const result = schema.safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({ error: result.error.flatten().fieldErrors })
  }

  const user = await prisma.user.update({
    where: { id: req.userId },
    data: { start_date: result.data.start_date ? new Date(result.data.start_date) : null },
    select: { id: true, name: true, email: true, daily_rate: true, start_date: true },
  })
  return res.json({
    ...user,
    start_date: user.start_date ? user.start_date.toISOString().slice(0, 10) : null,
  })
}

export async function resetAccount(req, res) {
  const userId = req.userId

  await prisma.$transaction([
    prisma.monthlySetup.deleteMany({ where: { user_id: userId } }),
    prisma.transaction.deleteMany({ where: { user_id: userId } }),
    prisma.fixedExpense.deleteMany({ where: { user_id: userId } }),
    prisma.recurringIncome.deleteMany({ where: { user_id: userId } }),
    prisma.dailyCategory.deleteMany({ where: { user_id: userId } }),
    prisma.category.deleteMany({ where: { user_id: userId, is_default: false } }),
    prisma.user.update({
      where: { id: userId },
      data: { daily_rate: 0 },
    }),
  ])

  return res.json({ ok: true })
}
