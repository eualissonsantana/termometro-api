import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

const transactionSchema = z.object({
  type: z.enum(['entrada', 'saida', 'diario', 'economia', 'cartao']),
  category_id: z.string().uuid().optional().nullable(),
  amount: z.number().positive(),
  description: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source: z.enum(['web', 'whatsapp']).optional().default('web'),
})

export async function list(req, res) {
  const { month } = req.query

  const where = { user_id: req.userId }

  if (month) {
    const [year, m] = month.split('-')
    const start = new Date(Date.UTC(Number(year), Number(m) - 1, 1))
    const end = new Date(Date.UTC(Number(year), Number(m), 1))
    where.date = { gte: start, lt: end }
  }

  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: { date: 'asc' },
    include: {
      category: {
        select: { id: true, name: true },
      },
    },
  })

  return res.json(transactions)
}

export async function create(req, res) {
  const result = transactionSchema.safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({ error: result.error.flatten().fieldErrors })
  }

  const { date, category_id, ...rest } = result.data

  // Valida que a category_id pertence ao tipo correto e é acessível pelo usuário
  if (category_id) {
    const category = await prisma.category.findFirst({
      where: {
        id: category_id,
        type: rest.type,
        active: true,
        OR: [{ user_id: null }, { user_id: req.userId }],
      },
    })
    if (!category) {
      return res.status(400).json({ error: 'Categoria inválida para este tipo de transação' })
    }
  }

  const transaction = await prisma.transaction.create({
    data: { ...rest, category_id: category_id ?? null, user_id: req.userId, date: new Date(date) },
    include: { category: { select: { id: true, name: true } } },
  })

  return res.status(201).json(transaction)
}

export async function update(req, res) {
  const { id } = req.params

  const existing = await prisma.transaction.findUnique({ where: { id } })
  if (!existing || existing.user_id !== req.userId) {
    return res.status(404).json({ error: 'Transação não encontrada' })
  }

  const result = transactionSchema.partial().safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({ error: result.error.flatten().fieldErrors })
  }

  const { date, category_id, ...rest } = result.data
  const finalType = rest.type ?? existing.type

  if (category_id) {
    const category = await prisma.category.findFirst({
      where: {
        id: category_id,
        type: finalType,
        active: true,
        OR: [{ user_id: null }, { user_id: req.userId }],
      },
    })
    if (!category) {
      return res.status(400).json({ error: 'Categoria inválida para este tipo de transação' })
    }
  }

  const data = { ...rest }
  if (date) data.date = new Date(date)
  if ('category_id' in result.data) data.category_id = category_id ?? null

  const transaction = await prisma.transaction.update({
    where: { id },
    data,
    include: { category: { select: { id: true, name: true } } },
  })

  return res.json(transaction)
}

export async function remove(req, res) {
  const { id } = req.params

  const existing = await prisma.transaction.findUnique({ where: { id } })
  if (!existing || existing.user_id !== req.userId) {
    return res.status(404).json({ error: 'Transação não encontrada' })
  }

  await prisma.transaction.delete({ where: { id } })

  return res.status(204).send()
}
