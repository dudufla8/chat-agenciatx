#!/usr/bin/env bash
set -e

echo "=========================================================="
echo "🚕 DEPLOY AUTOMATIZADO - CHAT AGÊNCIA TX IA (SAAS) 🚕"
echo "🌐 Domínio: chat.agenciatx.ia.br"
echo "=========================================================="

# 1. Verificar e Instalar Docker e Docker Compose
if ! command -v docker &> /dev/null; then
    echo "📦 Instalando Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    systemctl enable docker
    systemctl start docker
fi

if ! command -v docker compose &> /dev/null && ! command -v docker-compose &> /dev/null; then
    echo "📦 Instalando Docker Compose Plugin..."
    apt-get update && apt-get install -y docker-compose-plugin
fi

# 2. Configurar .env se não existir
if [ ! -f .env ]; then
    echo "⚙️ Criando .env a partir de .env.example..."
    cp .env.example .env
fi

# 3. Configurar Apache como Proxy Reverso (compatível com WordPress existente)
if command -v apache2 &> /dev/null; then
    echo "🌐 Configurando módulos e VirtualHost no Apache para chat.agenciatx.ia.br..."
    a2enmod proxy proxy_http proxy_wstunnel rewrite headers ssl || true

    cat << 'EOF' > /etc/apache2/sites-available/chat.agenciatx.ia.br.conf
<VirtualHost *:80>
    ServerName chat.agenciatx.ia.br
    ServerAdmin contato@agenciatx.ia.br

    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} =websocket [NC]
    RewriteRule /(.*)           ws://127.0.0.1:3000/$1 [P,L]
    RewriteCond %{HTTP:Upgrade} !=websocket [NC]
    RewriteRule /(.*)           http://127.0.0.1:3000/$1 [P,L]

    ProxyPassReverse / http://127.0.0.1:3000/

    ErrorLog ${APACHE_LOG_DIR}/chat_agenciatx_error.log
    CustomLog ${APACHE_LOG_DIR}/chat_agenciatx_access.log combined
</VirtualHost>
EOF

    a2ensite chat.agenciatx.ia.br.conf || true
    systemctl reload apache2 || true
fi

# 4. Subir Contêineres com Docker Compose (App, PostgreSQL, Redis)
echo "🚀 Subindo contêineres Docker (App Next.js, PostgreSQL 16, Redis 7)..."
docker compose down || true
docker compose up -d --build

# 5. Aguardar o Banco de Dados iniciar
echo "⏳ Aguardando banco de dados PostgreSQL estar pronto..."
sleep 10

# 6. Executar Migrações do Prisma e Seed dos dados iniciais
echo "🗄️ Executando Prisma DB Push e Seed dos dados iniciais..."
docker compose exec app npx prisma db push --accept-data-loss
docker compose exec app npm run prisma:seed

# 7. Configurar Certificado SSL Gratuito Let's Encrypt via Certbot
echo "🔒 Configurando Certificado SSL com Certbot..."
if command -v certbot &> /dev/null; then
    certbot --apache -d chat.agenciatx.ia.br --non-interactive --agree-tos -m contato@agenciatx.ia.br --redirect || true
else
    echo "⚠️ Certbot não encontrado. Instalando Certbot Apache..."
    apt-get update && apt-get install -y certbot python3-certbot-apache
    certbot --apache -d chat.agenciatx.ia.br --non-interactive --agree-tos -m contato@agenciatx.ia.br --redirect || true
fi

echo "=========================================================="
echo "✅ DEPLOY CONCLUÍDO COM SUCESSO!"
echo "🌐 Acesso ao painel: https://chat.agenciatx.ia.br"
echo "👨‍💻 Login Operador: operador@taxifrota.com.br / admin123"
echo "📱 Chat Motorista / In-App: https://chat.agenciatx.ia.br/driver/auth"
echo "=========================================================="
