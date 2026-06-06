import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

export async function getConfig(req, res) {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, name: true, email: true, daily_rate: true },
  })
  return res.json(user)
}

export async function updateDailyRate(req, res) {
  const schema = z.object({ daily_rate: z.number().positive() })
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
