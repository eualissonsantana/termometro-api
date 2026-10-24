#!/usr/bin/env bash
# Backup do banco de PRODUÇÃO (Supabase). Rode antes de todo deploy que tenha migration:
#   npm run db:backup
#
# Por que não usa o .env? O .env local aponta para o Postgres do WSL (desenvolvimento).
# A URL de produção é pedida na hora (sem aparecer na tela nem ficar no histórico do terminal).
# Use a DIRECT_URL do Supabase (porta 5432) — o pooler de transações (6543) não suporta pg_dump.
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-$HOME/termometro-backups}"

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump não encontrado. Instale o cliente do PostgreSQL (veja abaixo)."
  exit 1
fi

if [ -z "${PROD_DATABASE_URL:-}" ]; then
  read -rsp "Cole a DIRECT_URL de produção do Supabase (porta 5432): " PROD_DATABASE_URL
  echo
fi

# O pg_dump precisa ser da mesma versão principal do servidor ou mais nova
SERVER_MAJOR=$(psql "$PROD_DATABASE_URL" -tAc "SHOW server_version_num" | cut -c1-2)
CLIENT_MAJOR=$(pg_dump --version | grep -oE '[0-9]+' | head -1)
if [ "$CLIENT_MAJOR" -lt "$SERVER_MAJOR" ]; then
  echo "Seu pg_dump é a versão $CLIENT_MAJOR, mas o servidor é a $SERVER_MAJOR."
  echo "Instale o cliente mais novo no WSL:"
  echo "  sudo apt install -y postgresql-common && sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh"
  echo "  sudo apt install -y postgresql-client-$SERVER_MAJOR"
  echo "Depois rode de novo: PATH=/usr/lib/postgresql/$SERVER_MAJOR/bin:\$PATH npm run db:backup"
  exit 1
fi

mkdir -p "$BACKUP_DIR"
FILE="$BACKUP_DIR/termometro-$(date +%Y%m%d-%H%M%S).dump"

# --format=custom: arquivo compactado que o pg_restore consegue restaurar por partes
# --schema=public: só as nossas tabelas (o Supabase tem schemas internos dele)
pg_dump "$PROD_DATABASE_URL" --format=custom --no-owner --no-privileges --schema=public --file="$FILE"

echo "Backup salvo em: $FILE ($(du -h "$FILE" | cut -f1))"
echo "Para restaurar numa base local: pg_restore --no-owner --dbname=termometro_restore \"$FILE\""
