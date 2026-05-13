import { Router } from 'express'
import { list, create, update, remove } from '../controllers/categoriesController.js'
import { authenticate } from '../middlewares/authMiddleware.js'

const router = Router()

router.use(authenticate)

router.get('/', list)
router.post('/', create)
router.put('/:id', update)
router.delete('/:id', remove)

export default router
