import { prisma } from '../lib/prisma.js'

function toUtcDate(dateStr) {
  return new Date(`${dateStr}T00:00:00.000Z`)
}

function toDateString(date) {
  return date.toISOString().slice(0, 10)
}

function addDays(date, days) {
  const shifted = new Date(date)
  shifted.setUTCDate(shifted.getUTCDate() + days)
  return shifted
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function nextRecurringDate(anchorDate, recurrence, afterDate) {
  const anchor = new Date(anchorDate)
  const after = new Date(afterDate)

  if (recurrence === 'daily') return toDateString(addDays(after, 1))
  if (recurrence === 'weekly') return toDateString(addDays(after, 7))
  if (recurrence !== 'monthly') return null

  const year = after.getUTCFullYear()
  const month = after.getUTCMonth() + 1
  const nextYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  const day = Math.min(anchor.getUTCDate(), daysInMonth(nextYear, nextMonth))
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function scheduledDatesThrough(anchorDate, recurrence, endDate) {
  const anchor = new Date(anchorDate)
  const end = toUtcDate(endDate)
  const dates = []

  if (recurrence === 'daily' || recurrence === 'weekly') {
    const interval = recurrence === 'daily' ? 1 : 7
    for (let date = anchor; date <= end; date = addDays(date, interval)) {
      dates.push(toDateString(date))
    }
    return dates
  }

  if (recurrence === 'monthly') {
    const anchorYear = anchor.getUTCFullYear()
    const anchorMonth = anchor.getUTCMonth()
    const anchorDay = anchor.getUTCDate()
    const finalYear = end.getUTCFullYear()
    const finalMonth = end.getUTCMonth()

    for (let cursor = new Date(Date.UTC(anchorYear, anchorMonth, 1)); cursor <= new Date(Date.UTC(finalYear, finalMonth, 1)); cursor.setUTCMonth(cursor.getUTCMonth() + 1)) {
      const year = cursor.getUTCFullYear()
      const month = cursor.getUTCMonth() + 1
      const day = Math.min(anchorDay, daysInMonth(year, month))
      const slot = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      if (slot >= toDateString(anchor) && slot <= endDate) dates.push(slot)
    }
  }

  return dates
}

// Open series are stored one occurrence at a time as a month is viewed. Keeping
// their scheduled slot separate lets a user move one payment date without
// changing the series cadence or creating a duplicate at the old date.
export async function ensureOpenRecurringTransactionsThrough(userId, endDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return

  const seriesTemplates = await prisma.transaction.findMany({
    where: {
      user_id: userId,
      recurrence_open_ended: true,
      recurrence: { in: ['daily', 'weekly', 'monthly'] },
      recurrence_anchor_date: { lte: toUtcDate(endDate) },
      series_id: { not: null },
    },
    // Use the latest scheduled occurrence so edits applied to "this and
    // following" also become the template for dates not materialized yet.
    orderBy: [
      { recurrence_slot_date: 'desc' },
      { created_at: 'desc' },
    ],
    distinct: ['series_id'],
    select: {
      series_id: true,
      recurrence: true,
      recurrence_anchor_date: true,
      recurrence_slot_date: true,
      recurrence_open_ended: true,
      user_id: true,
      type: true,
      category_id: true,
      amount: true,
      description: true,
      source: true,
    },
  })

  for (const template of seriesTemplates) {
    if (!template.recurrence_anchor_date || !template.series_id) continue

    const scheduledDates = scheduledDatesThrough(
      template.recurrence_anchor_date,
      template.recurrence,
      endDate,
    )
    if (scheduledDates.length === 0) continue

    const existingSlots = await prisma.transaction.findMany({
      where: {
        user_id: userId,
        series_id: template.series_id,
        recurrence_slot_date: {
          gte: toUtcDate(scheduledDates[0]),
          lte: toUtcDate(endDate),
        },
      },
      select: { recurrence_slot_date: true },
    })
    const existingSlotSet = new Set(
      existingSlots
        .filter(item => item.recurrence_slot_date)
        .map(item => toDateString(item.recurrence_slot_date)),
    )
    const skippedSlots = await prisma.recurrenceException.findMany({
      where: {
        user_id: userId,
        series_id: template.series_id,
        slot_date: { lte: toUtcDate(endDate) },
      },
      select: { slot_date: true },
    })
    for (const item of skippedSlots) existingSlotSet.add(toDateString(item.slot_date))

    const missingDates = scheduledDates.filter(date => !existingSlotSet.has(date))
    if (missingDates.length === 0) continue

    await prisma.transaction.createMany({
      data: missingDates.map(date => ({
        user_id: template.user_id,
        series_id: template.series_id,
        recurrence: template.recurrence,
        recurrence_open_ended: true,
        recurrence_anchor_date: template.recurrence_anchor_date,
        recurrence_slot_date: toUtcDate(date),
        type: template.type,
        category_id: template.category_id,
        amount: template.amount,
        description: template.description,
        date: toUtcDate(date),
        source: template.source,
        paid: null,
      })),
      skipDuplicates: true,
    })
  }
}
