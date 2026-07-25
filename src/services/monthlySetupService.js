import { prisma } from '../lib/prisma.js'
import { isMonthlyConfigActiveForDate } from './currentMonthConfigSyncService.js'

// Called every time the thermometer is requested for a past or current month.
// Generates 'saida' and 'entrada' transactions from the user's fixed config,
// but only once per month — MonthlySetup acts as the "already done" flag.
export async function ensureMonthSetup(userId, month) {
  const alreadySetUp = await prisma.monthlySetup.findUnique({
    where: { user_id_month: { user_id: userId, month } },
  })
  if (alreadySetUp) return

  const [year, m] = month.split('-').map(Number)
  const daysInMonth = new Date(Date.UTC(year, m, 0)).getUTCDate()

  const [fixedExpenses, recurringIncomes] = await Promise.all([
    prisma.fixedExpense.findMany({ where: { user_id: userId, active: true } }),
    prisma.recurringIncome.findMany({ where: { user_id: userId, active: true } }),
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
    transactions.push({
      user_id: userId,
      type: 'entrada',
      amount: income.amount,
      description: income.name,
      date: new Date(Date.UTC(year, m - 1, day)),
      recurrence: 'monthly',
      source: 'web',
    })
  }

  // Atomic: create all transactions and mark the month as set up in one DB round-trip
  await prisma.$transaction([
    ...(transactions.length ? [prisma.transaction.createMany({ data: transactions })] : []),
    prisma.monthlySetup.create({ data: { user_id: userId, month } }),
  ])
}
