import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import {
  syncCreatedConfigToCurrentMonth,
  syncRemovedConfigFromCurrentMonth,
  syncUpdatedConfigToCurrentMonth,
} from '../services/currentMonthConfigSyncService.js'

const schema = z.object({
  name: z.string().min(1).max(100),
  amount: z.coerce.number().positive(),
  due_day: z.coerce.number().int().min(1).max(31),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
})

function serializeExpense(expense) {
  return {
    ...expense,
    start_date: expense.start_date ? expense.start_date.toISOString().slice(0, 10) : null,
  }
}

export async function list(req, res) {
  const expenses = await prisma.fixedExpense.findMany({
    where: { user_id: req.userId },
    orderBy: { amount: 'desc' },
  })
  return res.json(expenses.map(serializeExpense))
}

export async function create(req, res) {
  const result = schema.safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({ error: result.error.flatten().fieldErrors })
  }

  const expense = await prisma.fixedExpense.create({
    data: {
      user_id: req.userId,
      ...result.data,
      start_date: result.data.start_date ? new Date(`${result.data.start_date}T00:00:00.000Z`) : null,
    },
  })

  await syncCreatedConfigToCurrentMonth(req.userId, 'fixed-expense', expense)
  return res.status(201).json(serializeExpense(expense))
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

  const expense = await prisma.fixedExpense.update({
    where: { id },
    data: {
      ...result.data,
      ...(Object.prototype.hasOwnProperty.call(result.data, 'start_date')
        ? { start_date: result.data.start_date ? new Date(`${result.data.start_date}T00:00:00.000Z`) : null }
        : {}),
    },
  })
  await syncUpdatedConfigToCurrentMonth(req.userId, 'fixed-expense', existing, expense)
  return res.json(serializeExpense(expense))
}

export async function remove(req, res) {
  const { id } = req.params
  const existing = await prisma.fixedExpense.findUnique({ where: { id } })
  if (!existing || existing.user_id !== req.userId) {
    return res.status(404).json({ error: 'Gasto fixo não encontrado' })
  }

  await syncRemovedConfigFromCurrentMonth(req.userId, 'fixed-expense', existing)
  await prisma.fixedExpense.delete({ where: { id } })
  return res.status(204).send()
}
