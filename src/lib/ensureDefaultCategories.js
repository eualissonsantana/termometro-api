import { prisma } from './prisma.js'
import { defaultCategories } from './defaultCategories.js'

function categoryKey(type, name) {
  return `${type}:${String(name ?? '').trim().toLocaleLowerCase('pt-BR')}`
}

export async function ensureDefaultCategories() {
  const existingDefaults = await prisma.category.findMany({
    where: { user_id: null },
    select: { id: true, type: true, name: true, active: true, is_default: true },
  })

  const existingByKey = new Map(
    existingDefaults.map(category => [categoryKey(category.type, category.name), category])
  )

  const missingCategories = []
  const categoriesToFix = []

  for (const category of defaultCategories) {
    const existing = existingByKey.get(categoryKey(category.type, category.name))

    if (!existing) {
      missingCategories.push(category)
      continue
    }

    if (!existing.active || !existing.is_default) {
      categoriesToFix.push(existing.id)
    }
  }

  if (missingCategories.length > 0) {
    await prisma.category.createMany({
      data: missingCategories.map(category => ({
        user_id: null,
        type: category.type,
        name: category.name,
        is_default: true,
        active: true,
      })),
    })
  }

  if (categoriesToFix.length > 0) {
    await prisma.category.updateMany({
      where: { id: { in: categoriesToFix } },
      data: { active: true, is_default: true },
    })
  }

  return {
    created: missingCategories.length,
    fixed: categoriesToFix.length,
  }
}
