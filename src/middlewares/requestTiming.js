// Registra quanto tempo cada request levou, ex: "GET /api/dashboard/thermometer?month=2026-10 200 184ms".
// É a nossa linha de base para medir se as otimizações de performance funcionaram.
// O evento 'finish' dispara quando a resposta terminou de ser enviada.
export function requestTiming(req, res, next) {
  // O cron de keep-alive bate no /health a cada 10 min — não vale poluir o log com isso
  if (req.path === '/api/health') return next()

  const start = process.hrtime.bigint()

  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(0)}ms`)
  })

  next()
}
