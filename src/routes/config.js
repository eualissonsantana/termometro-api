import { Router } from 'express'
import { authenticate } from '../middlewares/authMiddleware.js'
import {
  getConfig,
  getMonthlyPlan,
  updateDailyRate,
  updateMonthlyBudget,
  updateMonthlySavingsGoal,
  updateStartDate,
  upsertMonthlyPlan,
  resetAccount,
} from '../controllers/configController.js'
import * as dailyCategories from '../controllers/dailyCategoriesController.js'
import * as fixedExpenses from '../controllers/fixedExpensesController.js'
import * as recurringIncomes from '../controllers/recurringIncomesController.js'
import * as recurringSeries from '../controllers/recurringSeriesController.js'

const router = Router()
router.use(authenticate)

router.get('/', getConfig)
router.put('/daily-rate', updateDailyRate)
router.put('/start-date', updateStartDate)
router.put('/monthly-budget', updateMonthlyBudget)
router.put('/monthly-savings-goal', updateMonthlySavingsGoal)
router.get('/monthly-plan', getMonthlyPlan)
router.put('/monthly-plan', upsertMonthlyPlan)
router.post('/reset', resetAccount)

router.get('/daily-categories', dailyCategories.list)
router.post('/daily-categories', dailyCategories.create)
router.put('/daily-categories/:id', dailyCategories.update)
router.delete('/daily-categories/:id', dailyCategories.remove)

router.get('/fixed-expenses', fixedExpenses.list)
router.post('/fixed-expenses', fixedExpenses.create)
router.put('/fixed-expenses/:id', fixedExpenses.update)
router.delete('/fixed-expenses/:id', fixedExpenses.remove)

router.get('/recurring-incomes', recurringIncomes.list)
router.post('/recurring-incomes', recurringIncomes.create)
router.put('/recurring-incomes/:id', recurringIncomes.update)
router.delete('/recurring-incomes/:id', recurringIncomes.remove)

router.get('/recurring-series', recurringSeries.list)
router.delete('/recurring-series/:series_id', recurringSeries.remove)

export default router
