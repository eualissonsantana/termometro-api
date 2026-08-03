import { prisma } from '../lib/prisma.js'

export async function list(req, res) {
  // Busca transações recorrentes (com ou sem series_id)
  const transactions = await prisma.transaction.findMany({
    where: {
      user_id: req.userId,
      recurrence: { not: 'never' },
      type: { in: ['saida', 'cartao'] },
    },
    select: {
      series_id: true,
      description: true,
      amount: true,
      type: true,
      recurrence: true,
      date: true,
    },
    orderBy: { date: 'asc' },
  })

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  // Agrupa por series_id quando existe, ou por chave virtual quando não
  const seriesMap = new Map()

  for (const tx of transactions) {
    // Transações auto-geradas de config (monthlySetupService) não têm series_id.
    // Agrupamos por chave composta para exibi-las como "série virtual".
    const key = tx.series_id ?? `__auto__${tx.type}__${tx.description ?? ''}__${Number(tx.amount)}`

    if (!seriesMap.has(key)) {
      seriesMap.set(key, {
        series_id: tx.series_id,
        is_auto: !tx.series_id,
        description: tx.description,
        amount: tx.amount,
        type: tx.type,
        recurrence: tx.recurrence,
        total_count: 0,
        remaining_count: 0,
        first_date: tx.date,
        last_date: tx.date,
        next_date: null,
      })
    }
    const entry = seriesMap.get(key)
    entry.total_count++
    if (tx.date > entry.last_date) entry.last_date = tx.date
    if (tx.date >= today) {
      entry.remaining_count++
      if (entry.next_date === null || tx.date < entry.next_date) {
        entry.next_date = tx.date
      }
    }
  }

  const result = Array.from(seriesMap.values())
    .map(s => ({
      ...s,
      amount: Number(s.amount),
      first_date: s.first_date?.toISOString().slice(0, 10) ?? null,
      last_date: s.last_date?.toISOString().slice(0, 10) ?? null,
      next_date: s.next_date?.toISOString().slice(0, 10) ?? null,
    }))
    .sort((a, b) => b.amount - a.amount)

  return res.json(result)
}

export async function remove(req, res) {
  const { series_id } = req.params
  const scope = req.query.scope === 'future' ? 'future' : 'all'

  const sample = await prisma.transaction.findFirst({
    where: { series_id, user_id: req.userId },
  })
  if (!sample) return res.status(404).json({ error: 'Série não encontrada' })

  const where = { series_id, user_id: req.userId }
  if (scope === 'future') {
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    where.date = { gte: today }
  }

  await prisma.transaction.deleteMany({ where })
  return res.status(204).send()
}
