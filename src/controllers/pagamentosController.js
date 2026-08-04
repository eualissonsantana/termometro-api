import { prisma } from '../lib/prisma.js'

// GET /api/dashboard/pagamentos?month=YYYY-MM
// Retorna todas as transações não-diário do mês com o campo `paid`,
// além de um resumo com totais de pago/pendente por grupo (entradas e despesas).
export async function pagamentos(req, res) {
  const month = req.query.month
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'Parâmetro month inválido (formato: YYYY-MM)' })
  }

  const [year, monthNum] = month.split('-').map(Number)
  const start = new Date(Date.UTC(year, monthNum - 1, 1))
  const end   = new Date(Date.UTC(year, monthNum, 1))

  const transactions = await prisma.transaction.findMany({
    where: {
      user_id: req.userId,
      type: { not: 'diario' }, // diário nunca tem status de pagamento
      date: { gte: start, lt: end },
    },
    orderBy: { date: 'asc' },
    include: {
      category: { select: { id: true, name: true } },
    },
  })

  // Calcula somatórias por grupo: entradas e despesas (saida + cartao + economia)
  let entradasTotal = 0, entradasPago = 0, entradasPendente = 0
  let despesasTotal = 0, despesasPago = 0, despesasPendente = 0

  for (const tx of transactions) {
    const amount = Number(tx.amount)
    if (tx.type === 'entrada') {
      entradasTotal += amount
      if (tx.paid === true)  entradasPago     += amount
      else                   entradasPendente += amount
    } else {
      despesasTotal += amount
      if (tx.paid === true)  despesasPago     += amount
      else                   despesasPendente += amount
    }
  }

  return res.json({
    transactions,
    summary: {
      entradas: {
        total:    Number(entradasTotal.toFixed(2)),
        recebido: Number(entradasPago.toFixed(2)),
        pendente: Number(entradasPendente.toFixed(2)),
      },
      despesas: {
        total:    Number(despesasTotal.toFixed(2)),
        pago:     Number(despesasPago.toFixed(2)),
        pendente: Number(despesasPendente.toFixed(2)),
      },
    },
  })
}
