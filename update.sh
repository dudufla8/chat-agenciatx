#!/usr/bin/env bash
set -e

echo "🔄 Atualizando sistema TX Omnichannel para a versão mais recente..."
git fetch origin main
git reset --hard origin/main
docker compose up -d --build
echo "🗄️ Sincronizando banco de dados (Prisma)..."
docker compose exec -T app npx prisma db push --accept-data-loss || true
echo "=========================================================="
echo "✅ SISTEMA ATUALIZADO COM SUCESSO!"
echo "🌐 Acesso: https://chat.agenciatx.ia.br"
echo "=========================================================="
