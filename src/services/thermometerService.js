import { prisma } from '../lib/prisma.js'
import { ensureMonthSetup } from './monthlySetupService.js'

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

// Walks day-by-day from the user's first transaction up to (not including) the first day
// of `monthStr`, accumulating the real balance including projected daily_rate for days
// without a real 'diario' entry. This is what makes the balance truly continuous.
async function computeBalanceBeforeMonth(userId, monthStr) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { daily_rate: true, start_date: true },
  })
  const dailyRate = Number(user.daily_rate)
  const startDate = user.start_date ? user.start_date.toISOString().slice(0, 10) : null

  const monthStartDate = new Date(monthStr + '-01T00:00:00.000Z')

  const dateFilter = { lt: monthStartDate }
  if (startDate) dateFilter.gte = new Date(startDate + 'T00:00:00.000Z')

  const priorTransactions = await prisma.transaction.findMany({
    where: { user_id: userId, date: dateFilter },
    orderBy: { date: 'asc' },
  })

  if (!priorTransactions.length) return 0

  // Group by UTC date string for O(1) lookup in the day loop
  const byDate = {}
  for (const t of priorTransactions) {
    const key = t.date.toISOString().slice(0, 10)
    if (!byDate[key]) byDate[key] = []
    byDate[key].push(t)
  }

  const startDateStr = priorTransactions[0].date.toISOString().slice(0, 10)
  const endDateStr = shiftDay(monthStr + '-01', -1) // last day of the month before monthStr

  let balance = 0
  let current = startDateStr

  while (current <= endDateStr) {
    const dayTxs = byDate[current] || []
    let income = 0, expense = 0, daily = 0, savings = 0, card = 0, rescue = 0
    let hasDiario = false

    for (const t of dayTxs) {
      if (t.type === 'entrada') income += Number(t.amount)
      else if (t.type === 'saida') expense += Number(t.amount)
      else if (t.type === 'diario') { daily += Number(t.amount); hasDiario = true }
      else if (t.type === 'economia') savings += Number(t.amount)
      else if (t.type === 'cartao') card += Number(t.amount)
      else if (t.type === 'resgate') rescue += Number(t.amount)
    }

    if (!hasDiario) daily = dailyRate

    balance += income + rescue - expense - daily - savings - card
    current = shiftDay(current, 1)
  }

  return balance
}

// Returns YYYY-MM-DD shifted by `days` (positive or negative).
function shiftDay(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

// Returns the thermometer array (one object per day) for the given month.
// `startingBalance` is optional: when null, computes full history via computeBalanceBeforeMonth.
// When provided (chained calls from getPerformanceData), uses the value directly.
export async function getThermometerData(userId, month, startingBalance = null) {
  const [yearStr, monthStr] = month.split('-')
  const year = Number(yearStr)
  const m = Number(monthStr)
  const daysInMonth = new Date(Date.UTC(year, m, 0)).getUTCDate()
  const todayStr = new Date().toISOString().slice(0, 10)

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { daily_rate: true, start_date: true },
  })
  const dailyRate = Number(user.daily_rate)
  const startDate = user.start_date ? user.start_date.toISOString().slice(0, 10) : null

  const monthStartDate = new Date(Date.UTC(year, m - 1, 1))
  const monthEndDate = new Date(Date.UTC(year, m, 0, 23, 59, 59))

  const initialBalance = startingBalance !== null
    ? startingBalance
    : await computeBalanceBeforeMonth(userId, month)

  // Only fetch transactions from start_date onwards (if configured)
  const effectiveStart = startDate && startDate > monthStartDate.toISOString().slice(0, 10)
    ? new Date(startDate + 'T00:00:00.000Z')
    : monthStartDate

  const transactions = await prisma.transaction.findMany({
    where: { user_id: userId, date: { gte: effectiveStart, lte: monthEndDate } },
    orderBy: { date: 'asc' },
  })

  const byDate = {}
  for (const t of transactions) {
    const key = t.date.toISOString().slice(0, 10)
    if (!byDate[key]) byDate[key] = []
    byDate[key].push(t)
  }

  let balance = initialBalance
  const result = []

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${yearStr}-${monthStr}-${String(day).padStart(2, '0')}`
    const isFuture = dateStr > todayStr
    const dayTxs = byDate[dateStr] || []

    let income = 0, expense = 0, daily = 0, savings = 0, card = 0, rescue = 0
    let hasDiario = false
    let dailyIsProjected = false

    // Days before start_date are treated as blank (no transactions, no daily_rate)
    const isBeforeStart = startDate && dateStr < startDate

    if (!isBeforeStart) {
      for (const t of dayTxs) {
        if (t.type === 'entrada') income += Number(t.amount)
        else if (t.type === 'saida') expense += Number(t.amount)
        else if (t.type === 'diario') { daily += Number(t.amount); hasDiario = true }
        else if (t.type === 'economia') savings += Number(t.amount)
        else if (t.type === 'cartao') card += Number(t.amount)
        else if (t.type === 'resgate') rescue += Number(t.amount)
      }

      // No diario registered → use projected daily_rate (even if value would be 0)
      if (!hasDiario) {
        daily = dailyRate
        dailyIsProjected = true
      }
    }

    balance += income + rescue - expense - daily - savings - card

    // All numeric fields are always present and never null — frontend sums these directly
    result.push({
      day,
      date: dateStr,
      entrada: income,
      saida: expense,
      diario: daily,
      diario_projetado: dailyIsProjected,
      cartao: card,
      economia: savings,
      resgate: rescue,
      saldo: parseFloat(balance.toFixed(2)),
      is_future: isFuture,
    })
  }

  return result
}

export async function getReserveSnapshot(userId, month) {
  const [yearStr, monthStr] = month.split('-')
  const year = Number(yearStr)
  const monthNumber = Number(monthStr)
  const monthStart = new Date(Date.UTC(year, monthNumber - 1, 1))
  const monthEnd = new Date(Date.UTC(year, monthNumber, 1))

  const [user, cumulativeFlows, monthFlows] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { reserve_starting_balance: true },
    }),
    prisma.transaction.groupBy({
      by: ['type'],
      where: {
        user_id: userId,
        type: { in: ['economia', 'resgate'] },
        date: { lt: monthEnd },
      },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ['type'],
      where: {
        user_id: userId,
        type: { in: ['economia', 'resgate'] },
        date: { gte: monthStart, lt: monthEnd },
      },
      _sum: { amount: true },
    }),
  ])

  const reserveBase = Number(user?.reserve_starting_balance ?? 0)
  const cumulativeEconomy = Number(cumulativeFlows.find(item => item.type === 'economia')?._sum.amount ?? 0)
  const cumulativeRescue = Number(cumulativeFlows.find(item => item.type === 'resgate')?._sum.amount ?? 0)
  const monthEconomy = Number(monthFlows.find(item => item.type === 'economia')?._sum.amount ?? 0)
  const monthRescue = Number(monthFlows.find(item => item.type === 'resgate')?._sum.amount ?? 0)
  const reserveMonthNet = Number((monthEconomy - monthRescue).toFixed(2))
  const reserveTotal = Number((reserveBase + cumulativeEconomy - cumulativeRescue).toFixed(2))
  const reserveMonthStart = Number((reserveTotal - reserveMonthNet).toFixed(2))

  return {
    reserve_total: reserveTotal,
    reserve_month_start: reserveMonthStart,
    reserve_month_net: reserveMonthNet,
    reserve_month_contributions: Number(monthEconomy.toFixed(2)),
    reserve_month_withdrawals: Number(monthRescue.toFixed(2)),
  }
}

export async function getPerformanceData(userId, year) {
  const todayStr = new Date().toISOString().slice(0, 10)
  const currentMonthStr = todayStr.slice(0, 7) // e.g. "2026-05"

  // Balance accumulated up to the end of the previous year
  let runningBalance = await computeBalanceBeforeMonth(userId, `${year}-01`)

  const result = []

  for (let month = 1; month <= 12; month++) {
    const monthStr = `${year}-${String(month).padStart(2, '0')}`
    const isFuture = monthStr > currentMonthStr
    const isCurrent = monthStr === currentMonthStr

    if (isFuture) {
      result.push({ m: MONTH_LABELS[month - 1], end: null, in: null, out: null, series: null, current: false, future: true })
      continue
    }

    await ensureMonthSetup(userId, monthStr)

    const days = await getThermometerData(userId, monthStr, runningBalance)
    runningBalance = days[days.length - 1].saldo

    const totalIn = parseFloat(days.reduce((acc, d) => acc + d.entrada, 0).toFixed(2))
    // out = all money that left the account: fixed expenses + daily + card + savings transfer
    const totalOut = parseFloat(days.reduce((acc, d) => acc + d.saida + d.diario + d.cartao + d.economia, 0).toFixed(2))

    // 5 evenly-spaced balance snapshots for the sparkline (day 1, ~week 1-3, last day)
    const series = [0, 6, 13, 20, days.length - 1]
      .filter((v, i, arr) => arr.indexOf(v) === i && v < days.length)
      .map(i => days[i].saldo)

    result.push({
      m: MONTH_LABELS[month - 1],
      end: parseFloat(runningBalance.toFixed(2)),
      in: totalIn,
      out: totalOut,
      series,
      current: isCurrent,
      future: false,
    })
  }

  return result
}
