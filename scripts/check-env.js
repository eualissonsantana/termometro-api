import 'dotenv/config'

const required = ['DATABASE_URL', 'DIRECT_URL', 'JWT_SECRET']
const missing = required.filter((key) => !process.env[key])

if (missing.length > 0) {
  console.error(`Faltam variaveis de ambiente obrigatorias: ${missing.join(', ')}`)
  console.error('A API nao consegue subir sem essas variaveis.')
  process.exit(1)
}

const isRender = process.env.RENDER === 'true'

if (isRender && !process.env.ALLOWED_ORIGINS) {
  console.warn('Aviso: ALLOWED_ORIGINS nao esta definida no Render.')
}

const databaseUrl = process.env.DATABASE_URL
const directUrl = process.env.DIRECT_URL

if (databaseUrl.includes('supabase.com') && !databaseUrl.includes(':6543')) {
  console.warn('Aviso: DATABASE_URL do Supabase normalmente usa a porta 6543 para pooler.')
}

if (databaseUrl.includes('supabase.com') && !databaseUrl.includes('pgbouncer=true')) {
  console.warn('Aviso: DATABASE_URL do Supabase com pooler costuma precisar de ?pgbouncer=true.')
}

if (directUrl.includes('supabase.com') && !directUrl.includes(':5432')) {
  console.warn('Aviso: DIRECT_URL do Supabase normalmente usa a porta 5432.')
}

console.log('Variaveis de ambiente obrigatorias encontradas.')
