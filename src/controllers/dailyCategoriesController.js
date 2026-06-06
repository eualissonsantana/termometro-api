import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

const schema = z.object({
  name: z.string().min(1).max(100),
  monthly_amount: z.coerce.number().positive(),
})

// Recalculates daily_rate as sum(active monthly_amounts) / 31 and saves on the user.
async function syncDailyRate(userId) {
  const categories = await prisma.dailyCategory.findMany({
    where: { user_id: userId, active: true },
    select: { monthly_amount: true },
  })
  const total = categories.reduce((sum, c) => sum + Number(c.monthly_amount), 0)
  const dailyRate = parseFloat((total / 31).toFixed(2))
  await prisma.user.update({ where: { id: userId }, data: { daily_rate: dailyRate } })
  return dailyRate
}

export async function list(req, res) {
  const categories = await prisma.dailyCategory.findMany({
    where: { user_id: req.userId },
    orderBy: { name: 'asc' },
  })
  return res.json(categories)
}

export async function create(req, res) {
  const result = schema.safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({ error: result.error.flatten().fieldErrors })
  }

  const category = await prisma.dailyCategory.create({
    data: { user_id: req.userId, ...result.data },
  })

  const daily_rate = await syncDailyRate(req.userId)
  return res.status(201).json({ ...category, daily_rate })
}

export async function update(req, res) {
  const { id } = req.params
  const existing = await prisma.dailyCategory.findUnique({ where: { id } })
  if (!existing || existing.user_id !== req.userId) {
    return res.status(404).json({ error: 'Categoria não encontrada' })
  }

  const result = schema.partial().safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({ error: result.error.flatten().fieldErrors })
  }

  const category = await prisma.dailyCategory.update({ where: { id }, data: result.data })
  const daily_rate = await syncDailyRate(req.userId)
  return res.json({ ...category, daily_rate })
}

export async function remove(req, res) {
  const { id } = req.params
  const existing = await prisma.dailyCategory.findUnique({ where: { id } })
  if (!existing || existing.user_id !== req.userId) {
    return res.status(404).json({ error: 'Categoria não encontrada' })
  }

  await prisma.dailyCategory.delete({ where: { id } })
  const daily_rate = await syncDailyRate(req.userId)
  return res.json({ daily_rate })
}
