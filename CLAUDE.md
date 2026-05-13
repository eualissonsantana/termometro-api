# Termômetro Financeiro — Contexto do Projeto

## O que é este projeto

Sistema web de gestão financeira pessoal baseado no método "Termômetro", com integração via chatbot WhatsApp. O projeto tem dois objetivos paralelos: ser funcional para uso real e servir como ambiente de aprendizado de desenvolvimento web (REST API, autenticação, banco de dados relacional).

**Sempre que criar ou modificar código, explique brevemente a decisão tomada** — o dono do projeto está aprendendo desenvolvimento enquanto constrói.

---

## Repositórios

- `termometro-api` — Backend Node.js (este repositório)
- `termometro-web` — Frontend React (repositório separado)

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

Exemplo: mercado R$800 + transporte R$200 + farmácia R$100 + lazer R$200 = R$1.300/mês ÷ 31 = **R$41,93/dia**

O usuário tem duas formas de configurar:
- **Com categorias**: informa o gasto mensal estimado de cada categoria → sistema calcula o `daily_rate`
- **Direto**: ignora as categorias e informa o `daily_rate` já calculado

Quando o usuário atualiza qualquer categoria, o `daily_rate` é recalculado automaticamente.

### Tabela `fixed_expenses`

Gastos fixos mensais com valor e dia de vencimento conhecidos.

```sql
id          UUID PRIMARY KEY
user_id     UUID REFERENCES users(id) NOT NULL
name        VARCHAR(100) NOT NULL   -- ex: "aluguel", "financiamento", "condomínio"
amount      DECIMAL(10,2) NOT NULL
due_day     INTEGER NOT NULL        -- dia do mês (1–31)
active      BOOLEAN DEFAULT true
```

Toda vez que um mês começa (ou quando o usuário abre o mês pela primeira vez), o sistema gera automaticamente as transações `saida` a partir das `fixed_expenses` ativas, com a data do `due_day` do mês correspondente.

### Tabela `recurring_incomes`

Entradas fixas mensais (salários, aluguéis recebidos, etc.).

```sql
id          UUID PRIMARY KEY
user_id     UUID REFERENCES users(id) NOT NULL
name        VARCHAR(100) NOT NULL   -- ex: "salário", "freela fixo"
amount      DECIMAL(10,2) NOT NULL
receive_day INTEGER NOT NULL        -- dia do mês
active      BOOLEAN DEFAULT true
```

Mesma lógica das `fixed_expenses`: gera transações `entrada` automaticamente no início de cada mês.

**Não existe conceito de "household" ou conta compartilhada.** Cada usuário tem seus próprios dados. Se duas pessoas quiserem usar a mesma conta, compartilham o login.

---

## Stack tecnológica

### Backend (`termometro-api`)

- **Runtime**: Node.js
- **Framework**: Express.js
- **ORM**: Prisma
- **Banco**: PostgreSQL
- **Autenticação**: JWT (jsonwebtoken) + bcrypt para hash de senha
- **WhatsApp**: Baileys (biblioteca Node.js, self-hosted, gratuita)
- **Validação**: Zod

### Frontend (`termometro-web`)

- **Framework**: React + Vite
- **Estilo**: Tailwind CSS
- **Gráficos**: Recharts
- **HTTP**: Axios ou fetch nativo
- **Autenticação**: token JWT armazenado em localStorage

---

## Estrutura de pastas do backend

```
termometro-api/
  prisma/
    schema.prisma
  src/
    routes/
      auth.js
      transactions.js
      dashboard.js
      config.js
    controllers/
      authController.js
      transactionController.js
      dashboardController.js
      configController.js
    middlewares/
      authMiddleware.js     ← valida o JWT em toda rota protegida
    services/
      thermometerService.js ← lógica de cálculo do saldo e projeção
      whatsappService.js    ← integração Baileys
      parserService.js      ← interpreta mensagens do WhatsApp em português
    app.js
    server.js
  .env
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
GET /api/config                     → busca daily_rate, categorias e config geral
PUT /api/config/daily-rate          → atualiza daily_rate manualmente

GET  /api/config/daily-categories   → lista categorias do diário
POST /api/config/daily-categories   → cria categoria
PUT  /api/config/daily-categories/:id → atualiza categoria
DEL  /api/config/daily-categories/:id → remove categoria

GET  /api/config/fixed-expenses     → lista gastos fixos mensais
POST /api/config/fixed-expenses     → cria gasto fixo (nome, valor, dia)
PUT  /api/config/fixed-expenses/:id → atualiza gasto fixo
DEL  /api/config/fixed-expenses/:id → remove gasto fixo

GET  /api/config/recurring-incomes  → lista entradas recorrentes
POST /api/config/recurring-incomes  → cria entrada recorrente
PUT  /api/config/recurring-incomes/:id → atualiza
DEL  /api/config/recurring-incomes/:id → remove
```

---

## Lógica do termômetro (thermometerService)

O serviço mais importante do projeto. Para um dado mês, retorna um array com 31 posições (uma por dia) contendo:

```js
{
  day: 1,
  date: "2026-05-01",
  entrada: 5500,          // soma das entradas do dia
  saida: 700,             // soma das saídas fixas do dia
  diario: 67.10,          // real se lançado, daily_rate se não
  diario_projetado: true/false,
  cartao: 0,              // soma dos gastos de cartão do dia
  diario_categorias: {    // breakdown opcional se o usuário usa categorias
    mercado: 25.00,
    transporte: 15.00,
    farmacia: 10.00,
    lazer: 17.10
  },
  economia: 0,
  saldo: 12450.30,        // acumulado desde o início da conta
  is_future: false
}
```

O saldo de cada dia é calculado aplicando todas as transações anteriores (de toda a história da conta) + as do dia atual.

---

## Integração WhatsApp (Baileys)

O usuário conecta via QR Code (igual ao WhatsApp Web). O bot interpreta mensagens em português:

| mensagem enviada | ação |
|---|---|
| `saída 45 almoço` | cria transação saida R$45 descrição "almoço" |
| `entrada 5500 salário` | cria transação entrada R$5500 |
| `diário 80` | cria/atualiza diário do dia com R$80 |
| `economia 300` | cria transação economia R$300 |
| `saldo` | retorna saldo atual |
| `resumo` | retorna resumo do mês atual |
| `projeção` | retorna saldo projetado para o fim do mês |

O `parserService` interpreta o texto livre usando regex simples — sem IA, apenas padrões em português.

---

## Conceitos para explicar ao longo do desenvolvimento

Como o projeto é também didático, ao longo do código explique:

- **JWT**: como o token é gerado no login, como é validado no middleware, por que não guardamos senha em texto puro
- **Middleware**: o que é, por que centralizar autenticação lá
- **Prisma**: o que é um ORM, como as migrations funcionam
- **REST**: diferença entre GET/POST/PUT/DELETE, quando usar cada um
- **Status HTTP**: 200, 201, 400, 401, 404, 500 — quando retornar cada um
- **Variáveis de ambiente**: por que o `.env` nunca vai pro git

---

## Ambiente de desenvolvimento

- **OS**: WSL (Ubuntu) no Windows
- **Editor**: VSCode com extensão Remote - WSL
- **Node**: versão LTS mais recente
- **Banco local**: PostgreSQL rodando no WSL

---

## O que já foi construído no backend

- Auth completa (register + login com JWT)
- CRUD de transações com filtro por mês
- Dashboard: thermometer (31 dias com saldo real/projetado) e performance anual
- Configuração de daily_rate

## O que ainda precisa ser feito no backend

- Tabela `categories` com seed de categorias padrão
- Campo `category_id` em `transactions`
- Rotas `/api/categories`
- Tabelas `daily_categories`, `fixed_expenses`, `recurring_incomes`
- Integração WhatsApp (Baileys)

---

## O que ainda não foi decidido

- Deploy (Railway ou Render para começar de graça)
- Design visual do frontend (minimalista, com seção de analytics com gráficos)
- Internacionalização (por ora só português, moeda BRL)
