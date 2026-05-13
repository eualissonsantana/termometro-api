import { prisma } from '../lib/prisma.js'

// Recebe userId e month ("2026-05"), retorna array com um objeto por dia do mês.
// initialBalance permite passar um saldo acumulado de fora (usado em getPerformanceData).
export async function getThermometerData(userId, month, initialBalance = null) {
  const [yearStr, monthStr] = month.split('-')
  const year = Number(yearStr)
  const m = Number(monthStr)
  const daysInMonth = new Date(Date.UTC(year, m, 0)).getUTCDate()

  // Data de hoje como string UTC — evita problemas de fuso horário
  const todayStr = new Date().toISOString().slice(0, 10)

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { daily_rate: true },
  })

  const monthStartStr = `${yearStr}-${monthStr}-01`
  // Último instante do mês em UTC
  const monthEndDate = new Date(Date.UTC(year, m, 0, 23, 59, 59))

  const allTransactions = await prisma.transaction.findMany({
    where: { user_id: userId, date: { lte: monthEndDate } },
    orderBy: { date: 'asc' },
  })

  // Converte a data de cada transação para string UTC ("2026-05-01")
  // Isso elimina o bug de fuso: Prisma devolve DateTime em UTC,
  // e comparar string com string é sempre seguro.
  const txWithDateStr = allTransactions.map(t => ({
    ...t,
    dateStr: t.date.toISOString().slice(0, 10),
  }))

  // Separa transações anteriores ao mês das que estão dentro do mês
  let runningBalance = initialBalance ?? 0
  const transactionsInMonth = []

  for (const t of txWithDateStr) {
    if (t.dateStr >= monthStartStr) {
      transactionsInMonth.push(t)
    } else {
      // Se initialBalance foi passado de fora, não recalculamos o histórico
      if (initialBalance === null) {
        runningBalance += effectOnBalance(t)
      }
    }
  }

  const result = []

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${yearStr}-${monthStr}-${String(day).padStart(2, '0')}`
    const isFuture = dateStr > todayStr

    const dayTransactions = transactionsInMonth.filter(t => t.dateStr === dateStr)

    let entrada = 0, saida = 0, diario = 0, economia = 0
    let diarioProjetado = false

    for (const t of dayTransactions) {
      if (t.type === 'entrada') entrada += Number(t.amount)
      if (t.type === 'saida') saida += Number(t.amount)
      if (t.type === 'diario') diario += Number(t.amount)
      if (t.type === 'economia') economia += Number(t.amount)
    }

    // Se não houver diário lançado (passado ou futuro), usa o daily_rate como projeção
    if (diario === 0) {
      diario = Number(user.daily_rate)
      diarioProjetado = true
    }

    runningBalance += entrada - saida - diario - economia

    result.push({
      day,
      date: dateStr,
      entrada,
      saida,
      diario,
      diario_projetado: diarioProjetado,
      economia,
      saldo: parseFloat(runningBalance.toFixed(2)),
      is_future: isFuture,
    })
  }

  return result
}

// Para a performance anual, encadeamos os meses passando o saldo acumulado para frente.
// Isso resolve o bug em que cada mês calculava do zero ignorando projeções de meses anteriores.
export async function getPerformanceData(userId, year) {
  const result = []

  // Calcula o saldo acumulado real até o final do ano anterior
  const prevYearEnd = new Date(Date.UTC(Number(year) - 1, 11, 31, 23, 59, 59))
  const priorTransactions = await prisma.transaction.findMany({
    where: { user_id: userId, date: { lte: prevYearEnd } },
    orderBy: { date: 'asc' },
  })

  // Para o saldo inicial do ano precisamos simular todos os meses anteriores
  // incluindo as projeções de daily_rate — por isso chamamos getThermometerData
  // de todos os anos anteriores à data mais antiga até o ano solicitado.
  // Solução pragmática: percorremos os meses do ano atual encadeando o saldo.
  let runningBalance = priorTransactions.reduce((acc, t) => acc + effectOnBalance(t), 0)

  // Ajuste: o saldo anterior só conta transações reais. Projeções de anos anteriores
  // não são armazenadas — isso é uma limitação conhecida para dados históricos antigos.

  for (let month = 1; month <= 12; month++) {
    const monthStr = `${year}-${String(month).padStart(2, '0')}`
    const days = await getThermometerData(userId, monthStr, runningBalance)
    const lastDay = days[days.length - 1]

    runningBalance = lastDay.saldo

    const totalEconomia = days.reduce((acc, d) => acc + d.economia, 0)
    const totalEntrada = days.reduce((acc, d) => acc + d.entrada, 0)

    result.push({
      month: monthStr,
      saldo_final: lastDay.saldo,
      total_economia: parseFloat(totalEconomia.toFixed(2)),
      total_entrada: parseFloat(totalEntrada.toFixed(2)),
      percentual_poupado: totalEntrada > 0
        ? parseFloat(((totalEconomia / totalEntrada) * 100).toFixed(1))
        : 0,
    })
  }

  return result
}

function effectOnBalance(transaction) {
  const amount = Number(transaction.amount)
  if (transaction.type === 'entrada') return amount
  if (transaction.type === 'saida') return -amount
  if (transaction.type === 'diario') return -amount
  if (transaction.type === 'economia') return -amount
  return 0
}
