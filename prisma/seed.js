import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const defaultCategories = [
  { type: 'entrada', name: 'Salário' },
  { type: 'entrada', name: 'Comissão' },
  { type: 'entrada', name: 'Vale' },
  { type: 'entrada', name: 'Benefício' },
  { type: 'entrada', name: 'Outros' },
  { type: 'saida', name: 'Aluguel' },
  { type: 'saida', name: 'Financiamento' },
  { type: 'saida', name: 'Condomínio' },
  { type: 'saida', name: 'Conta de luz' },
  { type: 'saida', name: 'Conta de água' },
  { type: 'saida', name: 'Internet' },
  { type: 'saida', name: 'Outros' },
  { type: 'diario', name: 'Mercado' },
  { type: 'diario', name: 'Transporte' },
  { type: 'diario', name: 'Farmácia' },
  { type: 'diario', name: 'Lanche' },
  { type: 'diario', name: 'Restaurante' },
  { type: 'diario', name: 'Outros' },
  { type: 'economia', name: 'Reserva de emergência' },
  { type: 'economia', name: 'Investimento' },
  { type: 'economia', name: 'Outros' },
  { type: 'cartao', name: 'Compras' },
  { type: 'cartao', name: 'Assinaturas' },
  { type: 'cartao', name: 'Viagem' },
  { type: 'cartao', name: 'Outros' },
]

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
