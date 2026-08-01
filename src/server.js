import 'dotenv/config'
import app from './app.js'
import { ensureDefaultCategories } from './lib/ensureDefaultCategories.js'

const PORT = process.env.PORT || 3000

async function start() {
  try {
    const { created, fixed } = await ensureDefaultCategories()

    if (created > 0 || fixed > 0) {
      console.log(`Categorias padrão verificadas: ${created} criadas, ${fixed} reativadas.`)
    }

    app.listen(PORT, () => {
      console.log(`Servidor rodando na porta ${PORT}`)
    })
  } catch (error) {
    console.error('Falha ao iniciar o servidor:', error)
    process.exit(1)
  }
}

start()
