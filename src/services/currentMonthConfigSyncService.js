import { prisma } from '../lib/prisma.js'

function currentMonthStr() {
  return new Date().toISOString().slice(0, 7)
}

function monthBounds(month) {
  const [year, monthNum] = month.split('-').map(Number)
  const start = new Date(Date.UTC(year, monthNum - 1, 1))
  const end = new Date(Date.UTC(year, monthNum, 1))
  return { start, end }
}

function transactionDateForMonth(month, day) {
  const [year, monthNum] = month.split('-').map(Number)
  const daysInMonth = new Date(Date.UTC(year, monthNum, 0)).getUTCDate()
  const clampedDay = Math.min(day, daysInMonth)
  return new Date(Date.UTC(year, monthNum - 1, clampedDay))
}

function normalizeDateOnly(dateValue) {
  if (!dateValue) return null

  if (dateValue instanceof Date) {
    return new Date(Date.UTC(
      dateValue.getUTCFullYear(),
      dateValue.getUTCMonth(),
      dateValue.getUTCDate(),
    ))
  }

  const [year, month, day] = String(dateValue).slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

export function isMonthlyConfigActiveForDate(config, generatedDate) {
  const startDate = normalizeDateOnly(config.start_date)
  if (!startDate) return true

  return generatedDate >= startDate
}

function buildGeneratedTransaction(userId, month, kind, config) {
  const isExpense = kind === 'fixed-expense'
  const day = isExpense ? config.due_day : config.receive_day
  const generatedDate = transactionDateForMonth(month, day)

  return {
    user_id: userId,
    type: isExpense ? 'saida' : 'entrada',
    amount: config.amount,
    description: config.name,
    date: generatedDate,
    recurrence: 'monthly',
    source: 'web',
  }
}

async function findMonthlySetup(userId, month) {
  return prisma.monthlySetup.findUnique({
    where: { user_id_month: { user_id: userId, month } },
  })
}

async function findGeneratedTransaction(userId, month, kind, config) {
  const tx = buildGeneratedTransaction(userId, month, kind, config)

  return prisma.transaction.findFirst({
    where: {
      user_id: userId,
      type: tx.type,
      recurrence: 'monthly',
      source: 'web',
      description: tx.description,
      amount: tx.amount,
      date: tx.date,
    },
  })
}

export async function syncCreatedConfigToCurrentMonth(userId, kind, config) {
  const month = currentMonthStr()
  const setup = await findMonthlySetup(userId, month)
  if (!setup) return

  const nextTxData = buildGeneratedTransaction(userId, month, kind, config)
  if (!isMonthlyConfigActiveForDate(config, nextTxData.date)) return

  const existingTx = await findGeneratedTransaction(userId, month, kind, config)
  if (existingTx) return

  await prisma.transaction.create({
    data: nextTxData,
  })
}

export async function syncUpdatedConfigToCurrentMonth(userId, kind, previousConfig, nextConfig) {
  const month = currentMonthStr()
  const setup = await findMonthlySetup(userId, month)
  if (!setup) return

  const previousTx = await findGeneratedTransaction(userId, month, kind, previousConfig)
  const nextTxData = buildGeneratedTransaction(userId, month, kind, nextConfig)
  const nextIsActive = isMonthlyConfigActiveForDate(nextConfig, nextTxData.date)

  if (previousTx) {
    if (!nextIsActive) {
      await prisma.transaction.delete({ where: { id: previousTx.id } })
      return
    }

    await prisma.transaction.update({
      where: { id: previousTx.id },
      data: {
        amount: nextTxData.amount,
        description: nextTxData.description,
        date: nextTxData.date,
      },
    })
    return
  }

  if (!nextIsActive) return

  const existingNextTx = await findGeneratedTransaction(userId, month, kind, nextConfig)
  if (existingNextTx) return

  await prisma.transaction.create({ data: nextTxData })
}

export async function syncRemovedConfigFromCurrentMonth(userId, kind, config) {
  const month = currentMonthStr()
  const setup = await findMonthlySetup(userId, month)
  if (!setup) return

  const existingTx = await findGeneratedTransaction(userId, month, kind, config)
  if (!existingTx) return

  await prisma.transaction.delete({ where: { id: existingTx.id } })
}

export function getMonthDateRange(month) {
  return monthBounds(month)
}
