import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

const schema = z.object({
  name: z.string().min(1).max(100),
  amount: z.number().positive(),
  due_day: z.number().int().min(1).max(31),
})

export async function list(req, res) {
  const expenses = await prisma.fixedExpense.findMany({
    where: { user_id: req.userId },
    orderBy: { due_day: 'asc' },
  })
  return res.json(expenses)
}

export async function create(req, res) {
  const result = schema.safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({ error: result.error.flatten().fieldErrors })
  }

  const expense = await prisma.fixedExpense.create({
    data: { user_id: req.userId, ...result.data },
  })
  return res.status(201).json(expense)
}

export async function update(req, res) {
  const { id } = req.params
  const existing = await prisma.fixedExpense.findUnique({ where: { id } })
  if (!existing || existing.user_id !== req.userId) {
    return res.status(404).json({ error: 'Gasto fixo não encontrado' })
  }

  const result = schema.partial().safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({ error: result.error.flatten().fieldErrors })
  }

  const expense = await prisma.fixedExpense.update({ where: { id }, data: result.data })
  return res.json(expense)
}

export async function remove(req, res) {
  const { id } = req.params
  const existing = await prisma.fixedExpense.findUnique({ where: { id } })
  if (!existing || existing.user_id !== req.userId) {
    return res.status(404).json({ error: 'Gasto fixo não encontrado' })
  }

  await prisma.fixedExpense.delete({ where: { id } })
  return res.status(204).send()
}
