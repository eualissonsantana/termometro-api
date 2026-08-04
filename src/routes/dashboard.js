import { Router } from 'express'
import { thermometer, performance } from '../controllers/dashboardController.js'
import { pagamentos } from '../controllers/pagamentosController.js'
import { authenticate } from '../middlewares/authMiddleware.js'

const router = Router()

router.use(authenticate)

router.get('/thermometer', thermometer)
router.get('/performance', performance)
router.get('/pagamentos', pagamentos)

export default router
