import { prisma } from '../lib/prisma.js'
import { isMonthlyConfigActiveForDate } from './currentMonthConfigSyncService.js'

// Called every time the thermometer is requested for a past or current month.
// Generates 'saida' and 'entrada' transactions from the user's fixed config,
// but only once per month — MonthlySetup acts as the "already done" flag.
export async function ensureMonthSetup(userId, month) {
  // Caminho rápido: na grande maioria das vezes o mês já foi preparado
  const alreadySetUp = await prisma.monthlySetup.findUnique({
    where: { user_id_month: { user_id: userId, month } },
  })
  if (alreadySetUp) return

  const [year, m] = month.split('-').map(Number)
  const daysInMonth = new Date(Date.UTC(year, m, 0)).getUTCDate()

  await prisma.$transaction(async (tx) => {
    // O INSERT ... ON CONFLICT DO NOTHING (skipDuplicates) funciona como uma trava:
    // se dois requests chegam juntos (ex: thermometer + performance), só um consegue
    // inserir a linha. O outro espera o primeiro terminar, recebe count = 0 e sai,
    // sem gerar transações duplicadas e sem estourar erro de chave única.
    const { count } = await tx.monthlySetup.createMany({
      data: [{ user_id: userId, month }],
      skipDuplicates: true,
    })
    if (count === 0) return

    const [fixedExpenses, recurringIncomes] = await Promise.all([
      tx.fixedExpense.findMany({ where: { user_id: userId, active: true } }),
      tx.recurringIncome.findMany({ where: { user_id: userId, active: true } }),
    ])

    const transactions = []

    for (const expense of fixedExpenses) {
      const day = Math.min(expense.due_day, daysInMonth)
      const generatedDate = new Date(Date.UTC(year, m - 1, day))
      if (!isMonthlyConfigActiveForDate(expense, generatedDate)) continue

      transactions.push({
        user_id: userId,
        type: 'saida',
        amount: expense.amount,
        description: expense.name,
        date: generatedDate,
        recurrence: 'monthly',
        source: 'web',
      })
    }

    for (const income of recurringIncomes) {
      const day = Math.min(income.receive_day, daysInMonth)
      const generatedDate = new Date(Date.UTC(year, m - 1, day))
      // Entradas recorrentes também têm start_date: não gera antes de começarem a valer
      if (!isMonthlyConfigActiveForDate(income, generatedDate)) continue

      transactions.push({
        user_id: userId,
        type: 'entrada',
        amount: income.amount,
        description: income.name,
        date: generatedDate,
        recurrence: 'monthly',
        source: 'web',
      })
    }

    if (transactions.length) {
      await tx.transaction.createMany({ data: transactions })
    }
  })
}
