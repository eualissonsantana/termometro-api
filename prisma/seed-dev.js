/**
 * Seed de desenvolvimento local.
 * Cria categorias padrão + um usuário de teste com transações do mês atual,
 * incluindo exemplos com paid=true, paid=false e paid=null para testar a feature.
 *
 * Uso: npm run db:seed-dev
 * Login: dev@termometro.com / dev123
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
import { defaultCategories } from '../src/lib/defaultCategories.js'

const prisma = new PrismaClient()

// Retorna "YYYY-MM-DD" para o dia D do mês atual
function thisMonth(day) {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${y}-${m}-${d}`
}

async function main() {
  // ── 1. Categorias padrão ──────────────────────────────────────────────────
  console.log('📂 Inserindo categorias padrão...')
  await prisma.category.deleteMany({ where: { user_id: null, transactions: { none: {} } } })
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

  // ── 2. Usuário de teste ───────────────────────────────────────────────────
  const email = 'dev@termometro.com'
  console.log(`👤 Criando usuário ${email}...`)

  const password_hash = await bcrypt.hash('dev123', 10)
  const user = await prisma.user.upsert({
    where: { email },
    update: { password_hash, daily_rate: 80, start_date: new Date(thisMonth(1)) },
    create: {
      name: 'Dev Local',
      email,
      password_hash,
      daily_rate: 80,
      start_date: new Date(thisMonth(1)),
      monthly_budget_total: 4500,
      monthly_savings_goal: 500,
    },
  })

  // Limpa transações existentes do usuário para seed limpo
  await prisma.transaction.deleteMany({ where: { user_id: user.id } })

  // Busca IDs das categorias padrão para vincular corretamente
  const cats = await prisma.category.findMany({ where: { user_id: null } })
  const catId = (type, name) => cats.find(c => c.type === type && c.name === name)?.id ?? null

  // ── 3. Transações do mês atual ────────────────────────────────────────────
  console.log('💰 Criando transações...')

  const transactions = [
    // ENTRADAS — testa paid e não-paid
    { type: 'entrada', amount: 5000, description: 'Salário · Empresa',  date: thisMonth(5),  category_id: catId('entrada', 'Salário'),   paid: true  },
    { type: 'entrada', amount: 1200, description: 'Comissão · Projeto', date: thisMonth(10), category_id: catId('entrada', 'Comissão'),  paid: false },
    { type: 'entrada', amount: 300,  description: 'Vale refeição',       date: thisMonth(5),  category_id: catId('entrada', 'Vale'),      paid: true  },

    // SAÍDAS FIXAS — mix de pago/pendente/sem status
    { type: 'saida', amount: 1500, description: 'Aluguel · Apto 302',   date: thisMonth(1),  category_id: catId('saida', 'Aluguel'),         paid: true  },
    { type: 'saida', amount: 120,  description: 'Internet · Claro',      date: thisMonth(10), category_id: catId('saida', 'Internet'),         paid: true  },
    { type: 'saida', amount: 210,  description: 'Conta de luz · CELESC', date: thisMonth(15), category_id: catId('saida', 'Conta de luz'),     paid: false },
    { type: 'saida', amount: 95,   description: 'Conta de água · CASAN', date: thisMonth(20), category_id: catId('saida', 'Conta de água'),    paid: false },
    { type: 'saida', amount: 580,  description: 'Financiamento · Carro', date: thisMonth(5),  category_id: catId('saida', 'Financiamento'),    paid: true  },
    { type: 'saida', amount: 350,  description: 'Condomínio',            date: thisMonth(10), category_id: catId('saida', 'Condomínio'),       paid: null  },

    // CARTÃO — sem status (null) para mostrar como "pendente" na lista
    { type: 'cartao', amount: 1200, description: 'Fatura · Nubank',      date: thisMonth(18), category_id: catId('cartao', 'Compras'),     paid: false },
    { type: 'cartao', amount: 45,   description: 'Spotify · Assinatura', date: thisMonth(3),  category_id: catId('cartao', 'Assinaturas'), paid: true  },

    // ECONOMIA — pago = transferiu para reserva
    { type: 'economia', amount: 500, description: 'Reserva de emergência', date: thisMonth(5), category_id: catId('economia', 'Reserva de emergência'), paid: true },

    // DIÁRIO — últimos dias com valores reais (paid sempre null)
    { type: 'diario', amount: 120, description: 'Mercado da semana',   date: thisMonth(2),  category_id: catId('diario', 'Mercado'),      paid: null },
    { type: 'diario', amount: 35,  description: 'Lanche · trabalho',   date: thisMonth(3),  category_id: catId('diario', 'Lanche'),       paid: null },
    { type: 'diario', amount: 85,  description: 'Mercado · reposição', date: thisMonth(6),  category_id: catId('diario', 'Mercado'),      paid: null },
    { type: 'diario', amount: 22,  description: 'Transporte · semana', date: thisMonth(7),  category_id: catId('diario', 'Transporte'),   paid: null },
    { type: 'diario', amount: 55,  description: 'Farmácia',            date: thisMonth(9),  category_id: catId('diario', 'Farmácia'),     paid: null },
  ]

  await prisma.transaction.createMany({
    data: transactions.map(tx => ({
      user_id: user.id,
      type:        tx.type,
      amount:      tx.amount,
      description: tx.description,
      date:        new Date(tx.date),
      category_id: tx.category_id,
      paid:        tx.paid ?? null,
      recurrence:  'never',
      source:      'web',
    })),
  })

  console.log(`✅ Seed concluído!`)
  console.log(`   Usuário:      ${email}`)
  console.log(`   Senha:        dev123`)
  console.log(`   Transações:   ${transactions.length} criadas`)
  console.log(`   Daily rate:   R$ 80/dia`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
