# Termômetro Financeiro — API

Backend do sistema de gestão financeira pessoal baseado no método **Termômetro**. Controla entradas, saídas e gastos diários para projetar o saldo futuro dia a dia.

## Stack

- **Node.js** + **Express**
- **PostgreSQL** + **Prisma** (ORM)
- **JWT** para autenticação
- **Zod** para validação

## Como rodar localmente

**Pré-requisitos:** Node.js LTS e PostgreSQL rodando.

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Edite o .env com sua DATABASE_URL e JWT_SECRET

# 3. Criar as tabelas
npm run db:migrate

# 4. Popular categorias padrão
npm run db:seed

# 5. Iniciar em modo desenvolvimento
npm run dev
```

## Variáveis de ambiente

Crie um arquivo `.env` na raiz com:

```env
DATABASE_URL="postgresql://usuario:senha@localhost:5432/termometro"
JWT_SECRET="uma-chave-secreta-longa"
PORT=3000
```

## Rotas da API

### Auth (públicas)

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/register` | Cria conta |
| POST | `/api/auth/login` | Retorna JWT |

### Transações (requer JWT)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/transactions?month=2026-05` | Lista do mês |
| POST | `/api/transactions` | Cria transação |
| PUT | `/api/transactions/:id` | Edita |
| DELETE | `/api/transactions/:id` | Remove |

Tipos: `entrada`, `saida`, `diario`, `economia`, `cartao`

### Categorias (requer JWT)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/categories?type=entrada` | Lista padrão + do usuário |
| POST | `/api/categories` | Cria categoria personalizada |
| PUT | `/api/categories/:id` | Edita (só as próprias) |
| DELETE | `/api/categories/:id` | Remove (só as próprias) |

### Dashboard (requer JWT)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/dashboard/thermometer?month=2026-05` | Saldo dia a dia do mês |
| GET | `/api/dashboard/performance?year=2026` | Performance mensal do ano |

### Configuração (requer JWT)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/config` | Dados do usuário + daily_rate |
| PUT | `/api/config` | Atualiza daily_rate |

## O método Termômetro

O saldo é **cumulativo desde o início da conta** — o mês é apenas uma janela de visualização.

- Dias passados **com** diário lançado → usa o valor real
- Dias passados **sem** diário → usa o `daily_rate` como estimativa
- Dias futuros → usa o `daily_rate` para projetar onde o saldo vai chegar

## Scripts disponíveis

```bash
npm run dev          # Servidor com hot reload
npm run start        # Produção
npm run db:migrate   # Aplica migrations
npm run db:seed      # Insere categorias padrão
npm run db:studio    # Abre o Prisma Studio (interface visual do banco)
```
