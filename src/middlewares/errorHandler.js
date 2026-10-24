import { Prisma } from '@prisma/client'

// Middleware de erro: o Express reconhece pelos 4 parâmetros (err, req, res, next).
// No Express 5, qualquer erro lançado (ou Promise rejeitada) dentro de um controller
// async chega aqui automaticamente. No Express 4 esse erro escapava e derrubava o processo.
export function errorHandler(err, req, res, next) {
  // Se a resposta já começou a ser enviada, só o Express consegue encerrar a conexão
  if (res.headersSent) return next(err)

  // Corpo da requisição com JSON malformado
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido' })
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P2025: registro não encontrado (ex: update/delete de algo que não existe)
    if (err.code === 'P2025') return res.status(404).json({ error: 'Registro não encontrado' })
    // P2002: violou uma restrição de unicidade
    if (err.code === 'P2002') return res.status(409).json({ error: 'Registro duplicado' })
    // P2007/P2023: valor em formato inválido para a coluna (ex: texto onde se espera UUID)
    if (err.code === 'P2007' || err.code === 'P2023') {
      return res.status(400).json({ error: 'Parâmetro em formato inválido' })
    }
  }

  // Erro inesperado: registra o detalhe no log do servidor, mas não expõe ao cliente
  console.error(`Erro em ${req.method} ${req.originalUrl}:`, err)
  return res.status(500).json({ error: 'Erro interno do servidor' })
}
