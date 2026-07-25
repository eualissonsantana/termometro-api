# Termômetro Financeiro — Contexto do Projeto

## O que é este projeto

Sistema web de gestão financeira pessoal baseado no método "Termômetro", com integração via chatbot WhatsApp. O projeto tem dois objetivos paralelos: ser funcional para uso real e servir como ambiente de aprendizado de desenvolvimento web (REST API, autenticação, banco de dados relacional).

**Sempre que criar ou modificar código, explique brevemente a decisão tomada** — o dono do projeto está aprendendo desenvolvimento enquanto constrói.

---

## Repositórios

- `termometro-api` — Backend Node.js (este repositório)
- `termometro-web` — Frontend React (repositório separado, `/home/alisson/projects/termometro-web`)

---

## Deploy (produção)

| Serviço | Plataforma | URL |
|---|---|---|
| API (backend) | Render — Web Service | `termometro-api.onrender.com` |
| Web (frontend) | Render — Static Site | `termometro-web.onrender.com` |
| Banco de dados | Supabase — PostgreSQL | projeto `termometro` |

**Variáveis de ambiente da API no Render:**
- `DATABASE_URL` — URL do pooler de transações do Supabase (porta 6543, `?pgbouncer=true`)
- `DIRECT_URL` — URL do pooler de sessão do Supabase (porta 5432, usada pelo `prisma migrate deploy`)
- `JWT_SECRET` — segredo para assinar tokens JWT
- `NODE_ENV=production`
- `ALLOWED_ORIGINS` — origens CORS permitidas (ex: `https://termometro-web.onrender.com`)

**Por que Supabase e não o PostgreSQL do Render?**
O PostgreSQL gratuito do Render expira e é deletado após 90 dias. O Supabase é gratuito e não expira.

**Por que duas URLs no Supabase?**
O Prisma precisa de uma URL de pooler para queries (`DATABASE_URL`) e de uma URL direta para rodar migrations (`DIRECT_URL`). Isso é configurado no `prisma/schema.prisma` com `directUrl = env("DIRECT_URL")`.

---

## O método Termômetro — regras de negócio

### Saldo é contínuo (nunca reseta)

O saldo do usuário é um valor acumulado desde o início da conta. O mês não zera o saldo — ele é apenas uma janela de visualização. O saldo atual é sempre:

```
saldo = soma(entradas) − soma(saídas) − soma(diários reais ou projetados) − soma(economias)
```

### As três naturezas de gasto — distinção fundamental

**1. Diário** (`type: 'diario'`) — gastos variáveis do cotidiano
Tudo que acontece todo mês mas o valor não é fixo: mercado, transporte, farmácia, lanches, saídas. O usuário pode configurar o diário de duas formas:
- **Valor único**: define um `daily_rate` total (ex: R$ 67,10/dia)
- **Por categorias**: define subcategorias (mercado, transporte, lazer, farmácia, outros) com valores estimados que somados compõem o `daily_rate`

O `daily_rate` final é sempre a soma de todas as categorias ativas, ou o valor único se não usar categorias.

**2. Saídas fixas recorrentes** (`type: 'saida'`) — contas mensais com valor conhecido
Aluguel, financiamento, condomínio, assinaturas, mensalidades. São configuradas uma vez com o valor e o dia do mês em que vencem. Aparecem automaticamente como transação `saida` todo mês na data configurada. **Não entram no diário.**

**3. Economia** (`type: 'economia'`) — poupança manual
Não é automática. O usuário decide quando e quanto guardar. Sai do saldo geral e vai para o saldo de poupança.

---

### Tipos de transação

| type | efeito no saldo | efeito na poupança | origem |
|---|---|---|---|
| `entrada` | +valor | — | manual ou recorrente |
| `saida` | −valor | — | manual ou recorrente fixa |
| `diario` | −valor | — | manual (real) ou projetado |
| `economia` | −valor | +valor | sempre manual |
| `cartao` | −valor | — | manual (gasto avulso ou fatura total) |

O type `cartao` funciona como `saida` para efeito de saldo, mas é separado para permitir visualização e analytics distintos (ex: quanto foi no cartão no mês, total de fatura).

### O diário (coração do termômetro)

O usuário configura um `daily_rate` padrão que serve como **projeção**: quanto se espera gastar por dia no cotidiano.

- Dias passados **com** transação `diario` registrada → usa o valor real lançado
- Dias passados **sem** transação `diario` → usa o `daily_rate` como estimativa
- Dias futuros → usa o `daily_rate` para projetar o saldo futuro

Isso cria duas curvas no dashboard:
- **Saldo real**: calculado com os valores que o usuário realmente registrou
- **Saldo projetado**: a partir de hoje, usando o `daily_rate` para mostrar onde o saldo vai chegar

O usuário pode lançar um diário com valor diferente do padrão (gastou mais ou menos naquele dia). Se usar categorias, pode detalhar quanto foi em cada uma.

### Economia

Não é calculada automaticamente. O usuário decide o dia e o valor que quer guardar, lança como uma transação do tipo `economia`. Esse valor sai do saldo geral e vai para um "balde" separado de poupança.

---

## Modelo de dados

### Tabela `users`

```sql
id            UUID PRIMARY KEY
name          VARCHAR(100) NOT NULL
email         VARCHAR(150) UNIQUE NOT NULL
password_hash VARCHAR(255) NOT NULL
daily_rate    DECIMAL(10,2) NOT NULL DEFAULT 0
start_date    DATE                              -- data de início da conta (para cálculo de saldo)
created_at    TIMESTAMP DEFAULT NOW()
```

### Tabela `categories`

Categorias de transação. Quando `user_id` é NULL, é uma categoria padrão do sistema visível para todos. Quando tem `user_id`, foi criada pelo próprio usuário.

```sql
id          UUID PRIMARY KEY
user_id     UUID REFERENCES users(id) NULL  -- NULL = padrão do sistema
type        ENUM('entrada', 'saida', 'diario', 'economia', 'cartao') NOT NULL
name        VARCHAR(100) NOT NULL
is_default  BOOLEAN DEFAULT false
active      BOOLEAN DEFAULT true
```

**Categorias padrão (seed):**

| type | categorias |
|---|---|
| `entrada` | Salário, Comissão, Vale, Benefício, Outros |
| `saida` | Aluguel, Financiamento, Condomínio, Conta de luz, Conta de água, Internet, Outros |
| `diario` | Mercado, Transporte, Farmácia, Lanche, Restaurante, Outros |
| `economia` | Reserva de emergência, Investimento, Outros |
| `cartao` | Compras, Assinaturas, Viagem, Outros |

O usuário pode criar categorias personalizadas além das padrão. Não pode editar nem remover as categorias padrão do sistema.

### Tabela `transactions`

```sql
id          UUID PRIMARY KEY
user_id     UUID REFERENCES users(id) NOT NULL
type        ENUM('entrada', 'saida', 'diario', 'economia', 'cartao') NOT NULL
category_id UUID REFERENCES categories(id) NULL  -- opcional
amount      DECIMAL(10,2) NOT NULL
description VARCHAR(255)
date        DATE NOT NULL
recurrence  VARCHAR(50) DEFAULT 'never'           -- 'never' | 'monthly' | 'weekly'
series_id   UUID                                  -- agrupa transações de uma série recorrente
source      ENUM('web', 'whatsapp') DEFAULT 'web'
created_at  TIMESTAMP DEFAULT NOW()
```

### Tabela `daily_categories`

Subcategorias opcionais que compõem o diário. Se o usuário preferir, configura só o `daily_rate` no `users` e ignora essa tabela.

```sql
id             UUID PRIMARY KEY
user_id        UUID REFERENCES users(id) NOT NULL
name           VARCHAR(100) NOT NULL   -- ex: "mercado", "transporte", "farmácia"
monthly_amount DECIMAL(10,2) NOT NULL  -- valor estimado por MÊS
active         BOOLEAN DEFAULT true
```

O `daily_rate` é calculado como:

```
daily_rate = soma(monthly_amount de todas as categorias ativas) / 31
```

### Tabela `fixed_expenses`

Gastos fixos mensais com valor e dia de vencimento conhecidos.

```sql
id          UUID PRIMARY KEY
user_id     UUID REFERENCES users(id) NOT NULL
name        VARCHAR(100) NOT NULL
amount      DECIMAL(10,2) NOT NULL
due_day     INTEGER NOT NULL        -- dia do mês (1–31)
active      BOOLEAN DEFAULT true
```

Toda vez que o usuário abre um mês pela primeira vez, o sistema gera automaticamente as transações `saida` a partir das `fixed_expenses` ativas. Controlado pela tabela `monthly_setups`.

### Tabela `recurring_incomes`

Entradas fixas mensais (salários, aluguéis recebidos, etc.).

```sql
id          UUID PRIMARY KEY
user_id     UUID REFERENCES users(id) NOT NULL
name        VARCHAR(100) NOT NULL
amount      DECIMAL(10,2) NOT NULL
receive_day INTEGER NOT NULL        -- dia do mês
active      BOOLEAN DEFAULT true
```

### Tabela `monthly_setups`

Controla quais meses já tiveram suas transações fixas geradas, evitando duplicatas.

```sql
id      UUID PRIMARY KEY
user_id UUID REFERENCES users(id) NOT NULL
month   VARCHAR(7) NOT NULL   -- ex: "2026-07"
UNIQUE(user_id, month)
```

**Não existe conceito de "household" ou conta compartilhada.** Cada usuário tem seus próprios dados.

---

## Stack tecnológica

### Backend (`termometro-api`)

- **Runtime**: Node.js (ESM — `"type": "module"`)
- **Framework**: Express.js
- **ORM**: Prisma (com `directUrl` para funcionar com o pooler do Supabase)
- **Banco**: PostgreSQL via Supabase
- **Autenticação**: JWT (jsonwebtoken) + bcrypt para hash de senha
- **WhatsApp**: Baileys (planejado — não implementado ainda)
- **Validação**: Zod
- **CORS**: configurado via env var `ALLOWED_ORIGINS`

### Frontend (`termometro-web`)

- **Framework**: React + Vite
- **Estilo**: Tailwind CSS + CSS custom (classes `tm-*` desktop, `tmm-*` mobile)
- **Gráficos**: Recharts
- **CSV import**: PapaParse
- **HTTP**: fetch nativo via `src/services/api.js`
- **Autenticação**: token JWT armazenado em localStorage
- **Responsividade**: hook `useIsMobile()` — renderiza `MobileApp` (≤768px) ou rotas desktop (>768px)

---

## Estrutura de pastas do backend

```
termometro-api/
  prisma/
    schema.prisma         ← modelos + directUrl para Supabase
    seed.js               ← categorias padrão do sistema
    migrations/           ← histórico de migrations (rodam via prisma migrate deploy no start)
  src/
    routes/
      auth.js
      transactions.js     ← inclui rota POST /bulk
      dashboard.js
      config.js
      categories.js
    controllers/
      authController.js
      transactionController.js   ← inclui bulkCreate (até 2000 itens)
      dashboardController.js
      configController.js
      categoriesController.js
    middlewares/
      authMiddleware.js     ← valida o JWT em toda rota protegida
    services/
      thermometerService.js ← lógica de cálculo do saldo e projeção
    app.js                  ← CORS via ALLOWED_ORIGINS
    server.js
  .env
```

## Estrutura de pastas do frontend

```
termometro-web/
  src/
    components/
      mobile/
        MobileHeader.jsx    ← hero saldo + nav de mês + barra termômetro
        MonthThermo.jsx     ← 31 barras de saldo (altura proporcional)
        AgendaList.jsx      ← lista de dias agrupada por semana
        BottomNav.jsx       ← navegação inferior (Mês | Análises | FAB | Ajustes)
        LaunchSheet.jsx     ← bottom sheet para lançar transação
        DayDetailSheet.jsx  ← bottom sheet com movimentos do dia
        MobileAnalytics.jsx ← grid de KPIs + cards de performance por ano
        MobileSettings.jsx  ← abas: conta / faixas / fixas / entradas / dados
      ImportModal.jsx       ← importação de planilha CSV (12 meses lado a lado)
      DayCard.jsx
      DayDetailModal.jsx
      TopBar.jsx
    hooks/
      useIsMobile.js        ← observa window.innerWidth, retorna boolean
      useDashboard.js       ← busca thermometer + performance, calcula kpis e monthContext
      useTransactions.js
    pages/
      MobileApp.jsx         ← orquestrador mobile (tela: cal | ana | set; sheet: null | lancar | detail)
      Dashboard.jsx         ← layout desktop (calendário + KPIs contextuais)
      Analytics.jsx
      Settings.jsx
    services/
      api.js                ← todas as chamadas HTTP, inclui bulkCreateTransactions
    utils/
      format.js             ← enrichDay (isToday só verdadeiro no mês atual), fmtBRL, addMonth
      importParser.js       ← parsePlanilha: lê CSV com 12 meses lado a lado (offsets 0,6,12...)
```

---

## Rotas da API

### Auth (públicas)

```
POST /api/auth/register   → cria conta (name, email, password)
POST /api/auth/login      → retorna JWT token
```

### Transações (protegidas — requer JWT)

```
GET    /api/transactions?month=2026-05   → lista transações do mês (inclui nome da categoria)
POST   /api/transactions                 → cria transação (category_id opcional)
POST   /api/transactions/bulk            → importação em lote (até 2000 itens)
PUT    /api/transactions/:id             → edita transação
DELETE /api/transactions/:id             → remove transação
```

### Categorias (protegidas)

```
GET    /api/categories?type=entrada  → lista categorias do tipo (padrão + do usuário)
POST   /api/categories               → cria categoria personalizada
PUT    /api/categories/:id           → edita (só categorias do próprio usuário)
DELETE /api/categories/:id           → remove (só categorias do próprio usuário)
```

### Dashboard (protegidas)

```
GET /api/dashboard/thermometer?month=2026-05
  → saldo dia a dia do mês (real para dias passados, projetado para dias futuros)

GET /api/dashboard/performance?year=2026
  → performance mensal do ano (saldo final de cada mês, economia, % poupado)
```

### Configuração (protegidas)

```
GET /api/config                           → busca daily_rate e config geral
PUT /api/config/daily-rate                → atualiza daily_rate manualmente

GET  /api/config/daily-categories         → lista categorias do diário
POST /api/config/daily-categories         → cria categoria
PUT  /api/config/daily-categories/:id     → atualiza categoria
DEL  /api/config/daily-categories/:id     → remove categoria

GET  /api/config/fixed-expenses           → lista gastos fixos mensais
POST /api/config/fixed-expenses           → cria gasto fixo (nome, valor, dia)
PUT  /api/config/fixed-expenses/:id       → atualiza gasto fixo
DEL  /api/config/fixed-expenses/:id       → remove gasto fixo

GET  /api/config/recurring-incomes        → lista entradas recorrentes
POST /api/config/recurring-incomes        → cria entrada recorrente
PUT  /api/config/recurring-incomes/:id    → atualiza
DEL  /api/config/recurring-incomes/:id    → remove
```

---

## Lógica do termômetro (thermometerService)

O serviço mais importante do projeto. Para um dado mês, retorna um array com dias do mês contendo:

```js
{
  day: 1,
  date: "2026-05-01",
  weekday: 4,             // 0 = domingo, usado para agrupar semanas na agenda
  entrada: 5500,
  saida: 700,
  diario: 67.10,          // real se lançado, daily_rate se não
  diario_projetado: true/false,
  cartao: 0,
  economia: 0,
  saldo: 12450.30,        // acumulado desde o início da conta
  is_future: false
}
```

### monthContext e KPIs contextuais

O frontend calcula `monthContext` em `useDashboard.js` comparando o mês visualizado com o mês atual:

| monthContext | heroLabel | heroValue | sideLabel | sideValue |
|---|---|---|---|---|
| `past` | Saldo final | saldoFim | performance | variacao |
| `current` | Saldo · hoje | saldoHoje | projeção · fim | saldoFim |
| `future` | Projeção · início | saldoInicio | projeção · fim | saldoFim |

### Regra isToday

`isToday` só é `true` quando o mês visualizado é o mês atual (`isCurrentMonth`). Em meses passados ou futuros, nenhum dia é "hoje". Implementado em `enrichDay(apiDay, todayNum, isCurrentMonth)` em `src/utils/format.js`.

---

## Importação de planilha CSV

O usuário pode importar dados históricos via `ImportModal`. O formato esperado é a planilha do método Termômetro com **12 meses lado a lado**, onde cada mês ocupa 6 colunas (Data, Entrada, Saída, Diário, Saldo + 1 vazia de separação).

```
Offsets de colunas: [0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60, 66]
Colunas por mês:    Data | Entrada | Saída | Diário | Saldo | (vazia)
```

O `parsePlanilha(csvText, year)` em `src/utils/importParser.js` lê o CSV, detecta meses com diário projetado (valores uniformes = estimativa, não real) e retorna um array de meses para seleção antes do import. O import usa `POST /api/transactions/bulk` em lotes de 200.

---

## Integração WhatsApp (Baileys) — planejada, não implementada

O usuário conectaria via QR Code (igual ao WhatsApp Web). O bot interpretaria mensagens em português:

| mensagem enviada | ação |
|---|---|
| `saída 45 almoço` | cria transação saida R$45 descrição "almoço" |
| `entrada 5500 salário` | cria transação entrada R$5500 |
| `diário 80` | cria/atualiza diário do dia com R$80 |
| `economia 300` | cria transação economia R$300 |
| `saldo` | retorna saldo atual |
| `resumo` | retorna resumo do mês atual |
| `projeção` | retorna saldo projetado para o fim do mês |

---

## Conceitos para explicar ao longo do desenvolvimento

Como o projeto é também didático, ao longo do código explique:

- **JWT**: como o token é gerado no login, como é validado no middleware, por que não guardamos senha em texto puro
- **Middleware**: o que é, por que centralizar autenticação lá
- **Prisma**: o que é um ORM, como as migrations funcionam
- **REST**: diferença entre GET/POST/PUT/DELETE, quando usar cada um
- **Status HTTP**: 200, 201, 400, 401, 404, 500 — quando retornar cada um
- **Variáveis de ambiente**: por que o `.env` nunca vai pro git
- **Connection pooler**: por que o Supabase precisa de duas URLs (queries vs migrations)

---

## Ambiente de desenvolvimento

- **OS**: WSL (Ubuntu) no Windows
- **Editor**: VSCode com extensão Remote - WSL
- **Node**: versão LTS mais recente
- **Banco local**: PostgreSQL rodando no WSL (ou usar a string do Supabase direto)

---

## O que já foi construído

### Backend
- Auth completa (register + login com JWT)
- CRUD de transações com filtro por mês
- Importação em lote de transações (`POST /bulk`, até 2000 itens)
- Dashboard: thermometer (dias com saldo real/projetado) e performance anual
- Configuração de daily_rate (manual ou via categorias)
- Tabelas e rotas: categories (com seed), daily_categories, fixed_expenses, recurring_incomes
- Geração automática de transações fixas ao abrir o mês (monthly_setups)
- CORS configurado via variável de ambiente
- Deploy no Render com Supabase como banco

### Frontend
- Layout desktop: calendário mensal com KPIs contextuais por mês
- Layout mobile Phase 2: agenda por semana, barra termômetro, bottom nav, bottom sheets
- KPIs contextuais: labels e valores mudam conforme mês passado / atual / futuro
- Importação de planilha CSV no formato do método Termômetro
- Hook `useIsMobile` para renderizar mobile ou desktop conforme largura da tela
- Deploy no Render como Static Site

---

## Backlog de melhorias (próximas sessões)

### Alta prioridade
- **Integração WhatsApp (Baileys)** — lançar transações e consultar saldo via WhatsApp
- **Recorrência de transações** — campos `recurrence` e `series_id` já existem no schema, falta implementar a lógica de editar/deletar "esta e as próximas" ou "todas da série"
- **Gestão de categorias no frontend** — tela para criar e editar categorias personalizadas (backend já tem as rotas)

### Média prioridade
- **Notificações de faixa** — alertar quando o saldo atingir faixa amarela ou vermelha (email ou push)
- **Meta de economia mensal** — o usuário define quanto quer guardar no mês e o dashboard mostra progresso
- **Exportação de dados** — gerar PDF ou CSV do histórico do mês/ano
- **PWA (Progressive Web App)** — manifest + service worker para instalar o app no celular como app nativo

### Baixa prioridade / exploratório
- **Integração bancária (Open Finance)** — importar extratos automaticamente via API do banco
- **Análise por categoria** — gráfico de pizza mostrando distribuição de gastos por categoria no mês
- **Comparativo mensal** — quanto gastou nesta categoria em relação ao mês anterior
- **IA no WhatsApp** — interpretar mensagens mais complexas com Claude API ao invés de regex simples
- **Multi-moeda** — suporte a dólar e euro para quem tem renda ou gastos em outras moedas
