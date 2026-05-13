import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

const categorySchema = z.object({
  type: z.enum(['entrada', 'saida', 'diario', 'economia', 'cartao']),
  name: z.string().min(1).max(100),
})

export async function list(req, res) {
  const { type } = req.query

  const where = {
    active: true,
    OR: [
      { user_id: null },          // categorias padrão do sistema
      { user_id: req.userId },    // categorias do próprio usuário
    ],
  }

  if (type) {
    const parsed = z.enum(['entrada', 'saida', 'diario', 'economia', 'cartao']).safeParse(type)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Tipo inválido' })
    }
    where.type = parsed.data
  }

  const categories = await prisma.category.findMany({
    where,
    orderBy: [{ is_default: 'desc' }, { name: 'asc' }],
    select: { id: true, type: true, name: true, is_default: true, user_id: true },
  })

  return res.json(categories)
}

export async function create(req, res) {
  const result = categorySchema.safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({ error: result.error.flatten().fieldErrors })
  }

  const category = await prisma.category.create({
    data: {
      user_id: req.userId,
      type: result.data.type,
      name: result.data.name,
      is_default: false,
      active: true,
    },
  })

  return res.status(201).json(category)
}

export async function update(req, res) {
  const { id } = req.params

  const category = await prisma.category.findUnique({ where: { id } })

  if (!category) {
    return res.status(404).json({ error: 'Categoria não encontrada' })
  }

  // Categorias padrão do sistema (user_id null) não podem ser editadas
  if (category.user_id !== req.userId) {
    return res.status(403).json({ error: 'Não é possível editar categorias padrão do sistema' })
  }

  const result = categorySchema.partial().safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({ error: result.error.flatten().fieldErrors })
  }

  const updated = await prisma.category.update({
    where: { id },
    data: result.data,
  })

  return res.json(updated)
}

export async function remove(req, res) {
  const { id } = req.params

  const category = await prisma.category.findUnique({ where: { id } })

  if (!category) {
    return res.status(404).json({ error: 'Categoria não encontrada' })
  }

  if (category.user_id !== req.userId) {
    return res.status(403).json({ error: 'Não é possível remover categorias padrão do sistema' })
  }

  // Soft delete: marca como inativa em vez de deletar do banco
  // Assim transações que já usam esta categoria não ficam com referência quebrada
  await prisma.category.update({ where: { id }, data: { active: false } })

  return res.status(204).send()
}
