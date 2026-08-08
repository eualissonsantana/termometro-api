import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { resolveReserveStartingBalanceForTotal } from '../services/thermometerService.js'

function serializeConfig(user) {
  return {
    ...user,
    daily_rate: Number(user.daily_rate ?? 0),
    reserve_starting_balance: Number(user.reserve_starting_balance ?? 0),
    monthly_budget_total: user.monthly_budget_total == null ? null : Number(user.monthly_budget_total),
    monthly_savings_goal: user.monthly_savings_goal == null ? null : Number(user.monthly_savings_goal),
    start_date: user.start_date ? user.start_date.toISOString().slice(0, 10) : null,
  }
}

const planningValueSchema = z.union([z.coerce.number().nonnegative(), z.null()])
const reserveStartingBalanceSchema = z.coerce.number().nonnegative()
const monthSchema = z.string().regex(/^\d{4}-\d{2}$/)
const reserveTotalSchema = z.object({
  month: monthSchema,
  reserve_total: z.coerce.number().nonnegative(),
})

function serializeMonthlyPlan(plan, userConfig, month) {
  const budgetOverride = plan?.budget_total_override == null ? null : Number(plan.budget_total_override)
  const savingsOverride = plan?.savings_goal_override == null ? null : Number(plan.savings_goal_override)
  const defaultBudget = userConfig?.monthly_budget_total == null ? null : Number(userConfig.monthly_budget_total)
  const defaultSavings = userConfig?.monthly_savings_goal == null ? null : Number(userConfig.monthly_savings_goal)

  return {
    month,
    budget_total_override: budgetOverride,
    savings_goal_override: savingsOverride,
    effective_budget_total: budgetOverride ?? defaultBudget,
    effective_savings_goal: savingsOverride ?? defaultSavings,
    has_overrides: budgetOverride != null || savingsOverride != null,
  }
}

export async function getConfig(req, res) {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: {
      id: true,
      name: true,
      email: true,
      daily_rate: true,
      reserve_starting_balance: true,
      start_date: true,
      monthly_budget_total: true,
      monthly_savings_goal: true,
    },
  })

  return res.json(serializeConfig(user))
}

export async function updateDailyRate(req, res) {
  const schema = z.object({ daily_rate: z.coerce.number().positive() })
  const result = schema.safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({ error: result.error.flatten().fieldErrors })
  }

  const user = await prisma.user.update({
    where: { id: req.userId },
    data: { daily_rate: result.data.daily_rate },
    select: {
      id: true,
      name: true,
      email: true,
      daily_rate: true,
      reserve_starting_balance: true,
      start_date: true,
      monthly_budget_total: true,
      monthly_savings_goal: true,
    },
  })

  return res.json(serializeConfig(user))
}

export async function updateStartDate(req, res) {
  const schema = z.object({
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  })
  const result = schema.safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({ error: result.error.flatten().fieldErrors })
  }

  const user = await prisma.user.update({
    where: { id: req.userId },
    data: { start_date: result.data.start_date ? new Date(result.data.start_date) : null },
    select: {
      id: true,
      name: true,
      email: true,
      daily_rate: true,
      reserve_starting_balance: true,
      start_date: true,
      monthly_budget_total: true,
      monthly_savings_goal: true,
    },
  })

  return res.json(serializeConfig(user))
}

export async function updateReserveStartingBalance(req, res) {
  const schema = z.object({ reserve_starting_balance: reserveStartingBalanceSchema })
  const result = schema.safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({ error: result.error.flatten().fieldErrors })
  }

  const user = await prisma.user.update({
    where: { id: req.userId },
    data: { reserve_starting_balance: result.data.reserve_starting_balance },
    select: {
      id: true,
      name: true,
      email: true,
      daily_rate: true,
      reserve_starting_balance: true,
      start_date: true,
      monthly_budget_total: true,
      monthly_savings_goal: true,
    },
  })

  return res.json(serializeConfig(user))
}

export async function updateReserveTotal(req, res) {
  const result = reserveTotalSchema.safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({ error: result.error.flatten().fieldErrors })
  }

  const nextReserveStartingBalance = await resolveReserveStartingBalanceForTotal(
    req.userId,
    result.data.month,
    result.data.reserve_total,
  )

  const user = await prisma.user.update({
    where: { id: req.userId },
    data: { reserve_starting_balance: nextReserveStartingBalance },
    select: {
      id: true,
      name: true,
      email: true,
      daily_rate: true,
      reserve_starting_balance: true,
      start_date: true,
      monthly_budget_total: true,
      monthly_savings_goal: true,
    },
  })

  return res.json(serializeConfig(user))
}

export async function updateMonthlyBudget(req, res) {
  const schema = z.object({ monthly_budget_total: planningValueSchema })
  const result = schema.safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({ error: result.error.flatten().fieldErrors })
  }

  const user = await prisma.user.update({
    where: { id: req.userId },
    data: { monthly_budget_total: result.data.monthly_budget_total },
    select: {
      id: true,
      name: true,
      email: true,
      daily_rate: true,
      reserve_starting_balance: true,
      start_date: true,
      monthly_budget_total: true,
      monthly_savings_goal: true,
    },
  })

  return res.json(serializeConfig(user))
}

export async function updateMonthlySavingsGoal(req, res) {
  const schema = z.object({ monthly_savings_goal: planningValueSchema })
  const result = schema.safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({ error: result.error.flatten().fieldErrors })
  }

  const user = await prisma.user.update({
    where: { id: req.userId },
    data: { monthly_savings_goal: result.data.monthly_savings_goal },
    select: {
      id: true,
      name: true,
      email: true,
      daily_rate: true,
      reserve_starting_balance: true,
      start_date: true,
      monthly_budget_total: true,
      monthly_savings_goal: true,
    },
  })

  return res.json(serializeConfig(user))
}

export async function getMonthlyPlan(req, res) {
  const result = monthSchema.safeParse(req.query.month)
  if (!result.success) {
    return res.status(400).json({ error: 'Parâmetro month obrigatório (formato: YYYY-MM)' })
  }

  const month = result.data
  const [userConfig, monthlyPlan] = await Promise.all([
    prisma.user.findUnique({
      where: { id: req.userId },
      select: { monthly_budget_total: true, monthly_savings_goal: true },
    }),
    prisma.monthlyPlan.findUnique({
      where: { user_id_month: { user_id: req.userId, month } },
    }),
  ])

  return res.json(serializeMonthlyPlan(monthlyPlan, userConfig, month))
}

export async function upsertMonthlyPlan(req, res) {
  const schema = z.object({
    month: monthSchema,
    budget_total_override: planningValueSchema.optional(),
    savings_goal_override: planningValueSchema.optional(),
  })

  const result = schema.safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({ error: result.error.flatten().fieldErrors })
  }

  const { month, budget_total_override, savings_goal_override } = result.data
  const data = {
    budget_total_override: budget_total_override ?? null,
    savings_goal_override: savings_goal_override ?? null,
  }

  if (data.budget_total_override == null && data.savings_goal_override == null) {
    await prisma.monthlyPlan.deleteMany({
      where: { user_id: req.userId, month },
    })
  } else {
    await prisma.monthlyPlan.upsert({
      where: { user_id_month: { user_id: req.userId, month } },
      create: {
        user_id: req.userId,
        month,
        ...data,
      },
      update: data,
    })
  }

  const [userConfig, monthlyPlan] = await Promise.all([
    prisma.user.findUnique({
      where: { id: req.userId },
      select: { monthly_budget_total: true, monthly_savings_goal: true },
    }),
    prisma.monthlyPlan.findUnique({
      where: { user_id_month: { user_id: req.userId, month } },
    }),
  ])

  return res.json(serializeMonthlyPlan(monthlyPlan, userConfig, month))
}

export async function resetAccount(req, res) {
  const userId = req.userId

  await prisma.$transaction([
    prisma.monthlyPlan.deleteMany({ where: { user_id: userId } }),
    prisma.monthlySetup.deleteMany({ where: { user_id: userId } }),
    prisma.transaction.deleteMany({ where: { user_id: userId } }),
    prisma.fixedExpense.deleteMany({ where: { user_id: userId } }),
    prisma.recurringIncome.deleteMany({ where: { user_id: userId } }),
    prisma.dailyCategory.deleteMany({ where: { user_id: userId } }),
    prisma.category.deleteMany({ where: { user_id: userId, is_default: false } }),
    prisma.user.update({
      where: { id: userId },
      data: {
        daily_rate: 0,
        reserve_starting_balance: 0,
        monthly_budget_total: null,
        monthly_savings_goal: null,
      },
    }),
  ])

  return res.json({ ok: true })
}
