import { PrismaClient } from '@prisma/client'
import { defaultCategories } from '../src/lib/defaultCategories.js'

const prisma = new PrismaClient()

async function main() {
  console.log('Limpando categorias padrão antigas...')

  // Só remove categorias do sistema (user_id NULL) que não estão vinculadas a transações
  // Categorias vinculadas ficam intactas para não quebrar histórico
  await prisma.category.deleteMany({
    where: { user_id: null, transactions: { none: {} } },
  })

  console.log('Inserindo categorias padrão...')
  await prisma.category.createMany({
    data: defaultCategories.map(c => ({
      user_id: null,
      type: c.type,
      name: c.name,
      is_default: true,
      active: true,
    })),
    skipDuplicates: true,
  })

  const total = await prisma.category.count({ where: { user_id: null } })
  console.log(`Seed concluído — ${total} categorias padrão no banco.`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
