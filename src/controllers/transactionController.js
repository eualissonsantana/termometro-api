import { z } from 'zod'
import { randomUUID } from 'crypto'
import { prisma } from '../lib/prisma.js'

const RECURRENCE_VALUES = ['never', 'daily', 'weekly', 'monthly']
const TRANSACTION_TYPES = ['entrada', 'saida', 'diario', 'economia', 'cartao']
const monthQuerySchema = z.string().regex(/^\d{4}-\d{2}$/)
const dateQuerySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

function parseCsvQueryValue(value) {
  if (value == null) return []
  const raw = Array.isArray(value) ? value.join(',') : String(value)
  return raw
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

function startOfMonthUtc(monthStr) {
  const [year, month] = monthStr.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, 1))
}

function nextMonthUtc(monthStr) {
  const [year, month] = monthStr.split('-').map(Number)
  return new Date(Date.UTC(year, month, 1))
}

function startOfDayUtc(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function nextDayUtc(dateStr) {
  const date = startOfDayUtc(dateStr)
  date.setUTCDate(date.getUTCDate() + 1)
  return date
}

// Returns additional dates (after the primary date) to generate for the given recurrence.
// repeatCount: max number of extra dates to generate
// repeatUntil: stop generating at this date string (inclusive), e.g. '2026-12-31'
function generateRecurringDates(dateStr, recurrence, { repeatCount = null, repeatUntil = null } = {}) {
  const [year, month, day] = dateStr.split('-').map(Number)
  const pad = (n) => String(n).padStart(2, '0')
  const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate()

  function addDays(ds, n) {
    const d = new Date(ds + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() + n)
    return d.toISOString().substring(0, 10)
  }

  const dates = []

  if (recurrence === 'daily') {
    const defaultEnd = `${year}-${pad(month)}-${pad(daysInMonth(year, month))}`
    let cur = addDays(dateStr, 1)
    while (true) {
      if (repeatCount !== null && dates.length >= repeatCount) break
      const end = repeatUntil ?? defaultEnd
      if (cur > end) break
      dates.push(cur)
      cur = addDays(cur, 1)
    }
  } else if (recurrence === 'weekly') {
    const defaultEnd = `${year}-${pad(month)}-${pad(daysInMonth(year, month))}`
    let cur = addDays(dateStr, 7)
    while (true) {
      if (repeatCount !== null && dates.length >= repeatCount) break
      const end = repeatUntil ?? defaultEnd
      if (cur > end) break
      dates.push(cur)
      cur = addDays(cur, 7)
    }
  } else if (recurrence === 'monthly') {
    for (let m = month + 1; m <= 12; m++) {
      if (repeatCount !== null && dates.length >= repeatCount) break
      const clamped = Math.min(day, daysInMonth(year, m))
      const ds = `${year}-${pad(m)}-${pad(clamped)}`
      if (repeatUntil && ds > repeatUntil) break
      dates.push(ds)
    }
  }

  return dates
}

const transactionSchema = z.object({
  type: z.enum(['entrada', 'saida', 'diario', 'economia', 'cartao']),
  category_id: z.string().uuid().optional().nullable(),
  amount: z.number().min(0),
  description: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  recurrence: z.enum(RECURRENCE_VALUES).optional().default('never'),
  source: z.enum(['web', 'whatsapp']).optional().default('web'),
  repeat_count: z.coerce.number().int().positive().optional().nullable(),
  repeat_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
})

const bulkItemSchema = z.object({
  type: z.enum(['entrada', 'saida', 'diario', 'economia', 'cartao']),
  amount: z.number().min(0),
  description: z.string().optional().default(''),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export async function bulkCreate(req, res) {
  const raw = req.body?.transactions
  if (!Array.isArray(raw) || raw.length === 0) {
    return res.status(400).json({ error: 'Envie um array "transactions" com ao menos um item' })
  }
  if (raw.length > 2000) {
    return res.status(400).json({ error: 'Limite de 2000 transações por importação' })
  }

  const parsed = []
  for (const item of raw) {
    const r = bulkItemSchema.safeParse(item)
    if (!r.success) return res.status(400).json({ error: r.error.flatten().fieldErrors })
    parsed.push(r.data)
  }

  const result = await prisma.transaction.createMany({
    data: parsed.map(t => ({
      user_id: req.userId,
      type: t.type,
      amount: t.amount,
      description: t.description,
      date: new Date(t.date),
      source: 'web',
      recurrence: 'never',
    })),
    skipDuplicates: false,
  })

  return res.status(201).json({ imported: result.count })
}

export async function list(req, res) {
  const month = req.query.month
  const from = req.query.from
  const to = req.query.to
  const typeValues = parseCsvQueryValue(req.query.types)
  const categoryIds = parseCsvQueryValue(req.query.category_ids)

  const where = { user_id: req.userId }

  if (month != null) {
    const parsedMonth = monthQuerySchema.safeParse(month)
    if (!parsedMonth.success) {
      return res.status(400).json({ error: 'Parâmetro month inválido (formato: YYYY-MM)' })
    }
  }

  if (from != null) {
    const parsedFrom = dateQuerySchema.safeParse(from)
    if (!parsedFrom.success) {
      return res.status(400).json({ error: 'Parâmetro from inválido (formato: YYYY-MM-DD)' })
    }
  }

  if (to != null) {
    const parsedTo = dateQuerySchema.safeParse(to)
    if (!parsedTo.success) {
      return res.status(400).json({ error: 'Parâmetro to inválido (formato: YYYY-MM-DD)' })
    }
  }

  if (month && (from || to)) {
    return res.status(400).json({ error: 'Use month ou from/to, mas não os dois ao mesmo tempo' })
  }

  if ((from && !to) || (!from && to)) {
    return res.status(400).json({ error: 'Envie from e to juntos para filtrar por período' })
  }

  if (from && to && from > to) {
    return res.status(400).json({ error: 'O período informado é inválido: from não pode ser maior que to' })
  }

  if (typeValues.length > 0) {
    const parsedTypes = z.array(z.enum(TRANSACTION_TYPES)).safeParse(typeValues)
    if (!parsedTypes.success) {
      return res.status(400).json({ error: 'Parâmetro types inválido' })
    }

    where.type = { in: parsedTypes.data }
  }

  if (categoryIds.length > 0) {
    const parsedCategoryIds = z.array(z.string().uuid()).safeParse(categoryIds)
    if (!parsedCategoryIds.success) {
      return res.status(400).json({ error: 'Parâmetro category_ids inválido' })
    }

    where.category_id = { in: parsedCategoryIds.data }
  }

  if (month) {
    const start = startOfMonthUtc(month)
    const end = nextMonthUtc(month)
    where.date = { gte: start, lt: end }
  } else if (from && to) {
    where.date = {
      gte: startOfDayUtc(from),
      lt: nextDayUtc(to),
    }
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

  const { date, category_id, recurrence, repeat_count, repeat_until, ...rest } = result.data

  if (rest.amount === 0 && rest.type !== 'diario') {
    return res.status(400).json({ error: 'Valor zero só é permitido para o tipo diário' })
  }

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

  const seriesId = recurrence !== 'never' ? randomUUID() : null
  const baseData = { ...rest, recurrence, series_id: seriesId, category_id: category_id ?? null, user_id: req.userId }

  const transaction = await prisma.transaction.create({
    data: { ...baseData, date: new Date(date) },
    include: { category: { select: { id: true, name: true } } },
  })

  if (recurrence !== 'never') {
    const extraDates = generateRecurringDates(date, recurrence, { repeatCount: repeat_count ?? null, repeatUntil: repeat_until ?? null })
    if (extraDates.length > 0) {
      await prisma.transaction.createMany({
        data: extraDates.map(d => ({ ...baseData, date: new Date(d) })),
        skipDuplicates: true,
      })
    }
  }

  return res.status(201).json(transaction)
}

export async function update(req, res) {
  const { id } = req.params
  // scope: 'one' (default) | 'future' | 'all'
  const scope = ['one', 'future', 'all'].includes(req.query.scope) ? req.query.scope : 'one'

  const existing = await prisma.transaction.findUnique({ where: { id } })
  if (!existing || existing.user_id !== req.userId) {
    return res.status(404).json({ error: 'Transação não encontrada' })
  }

  const result = transactionSchema.partial().safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({ error: result.error.flatten().fieldErrors })
  }

  const { date, category_id, repeat_count, repeat_until, ...rest } = result.data
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

  if (scope !== 'one' && existing.series_id) {
    const where = { series_id: existing.series_id, user_id: req.userId }
    if (scope === 'future') where.date = { gte: existing.date }
    // updateMany não aceita date dentro do data (só campos simples), então
    // extraímos date separado e fazemos update individual no registro atual
    const { date: _d, ...dataWithoutDate } = data
    await prisma.transaction.updateMany({ where, data: dataWithoutDate })
    if (data.date) await prisma.transaction.update({ where: { id }, data: { date: data.date } })
  } else {
    await prisma.transaction.update({ where: { id }, data })
  }

  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: { category: { select: { id: true, name: true } } },
  })

  return res.json(transaction)
}

export async function remove(req, res) {
  const { id } = req.params
  // scope: 'one' (default) | 'future' | 'all'
  const scope = ['one', 'future', 'all'].includes(req.query.scope) ? req.query.scope : 'one'

  const existing = await prisma.transaction.findUnique({ where: { id } })
  if (!existing || existing.user_id !== req.userId) {
    return res.status(404).json({ error: 'Transação não encontrada' })
  }

  if (scope !== 'one' && existing.series_id) {
    const where = { series_id: existing.series_id, user_id: req.userId }
    if (scope === 'future') where.date = { gte: existing.date }
    await prisma.transaction.deleteMany({ where })
  } else {
    await prisma.transaction.delete({ where: { id } })
  }

  return res.status(204).send()
}
