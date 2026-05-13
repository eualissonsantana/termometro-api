import { Router } from 'express'
import { getConfig, updateConfig, getMonthConfig, updateMonthConfig } from '../controllers/configController.js'
import { authenticate } from '../middlewares/authMiddleware.js'

const router = Router()

router.use(authenticate)

router.get('/', getConfig)
router.put('/', updateConfig)
router.get('/:month', getMonthConfig)
router.put('/:month', updateMonthConfig)

export default router
