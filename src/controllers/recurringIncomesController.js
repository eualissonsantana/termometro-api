import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

const schema = z.object({
  name: z.string().min(1).max(100),
  amount: z.number().positive(),
  receive_day: z.number().int().min(1).max(31),
})

export async function list(req, res) {
  const incomes = await prisma.recurringIncome.findMany({
    where: { user_id: req.userId },
    orderBy: { receive_day: 'asc' },
  })
  return res.json(incomes)
}

export async function create(req, res) {
  const result = schema.safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({ error: result.error.flatten().fieldErrors })
  }

  const income = await prisma.recurringIncome.create({
    data: { user_id: req.userId, ...result.data },
  })
  return res.status(201).json(income)
}

export async function update(req, res) {
  const { id } = req.params
  const existing = await prisma.recurringIncome.findUnique({ where: { id } })
  if (!existing || existing.user_id !== req.userId) {
    return res.status(404).json({ error: 'Entrada recorrente não encontrada' })
  }

  const result = schema.partial().safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({ error: result.error.flatten().fieldErrors })
  }

  const income = await prisma.recurringIncome.update({ where: { id }, data: result.data })
  return res.json(income)
}

export async function remove(req, res) {
  const { id } = req.params
  const existing = await prisma.recurringIncome.findUnique({ where: { id } })
  if (!existing || existing.user_id !== req.userId) {
    return res.status(404).json({ error: 'Entrada recorrente não encontrada' })
  }

  await prisma.recurringIncome.delete({ where: { id } })
  return res.status(204).send()
}
