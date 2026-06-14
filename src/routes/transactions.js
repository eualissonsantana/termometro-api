import { Router } from 'express'
import { list, create, bulkCreate, update, remove } from '../controllers/transactionController.js'
import { authenticate } from '../middlewares/authMiddleware.js'

const router = Router()

router.use(authenticate)

router.get('/', list)
router.post('/', create)
router.post('/bulk', bulkCreate)
router.put('/:id', update)
router.delete('/:id', remove)

export default router
