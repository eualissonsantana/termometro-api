import { Router } from 'express'
import { thermometer, performance } from '../controllers/dashboardController.js'
import { authenticate } from '../middlewares/authMiddleware.js'

const router = Router()

router.use(authenticate)

router.get('/thermometer', thermometer)
router.get('/performance', performance)

export default router
