import http from 'http';
import fs from 'fs';
import path from 'path';

// Automatically load .env file if it exists
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath) && typeof (process as any).loadEnvFile === 'function') {
    (process as any).loadEnvFile(envPath);
  }
} catch {
  // Ignore if not present
}

import next from 'next';
import { parse } from 'url';
import { env } from './config/env';
import { initSocketServer } from './lib/socket';

const dev = env.NODE_ENV !== 'production';
const app = next({ dev, hostname: '0.0.0.0', port: env.PORT });
const handle = app.getRequestHandler();

async function startServer() {
  try {
    await app.prepare();

    const server = http.createServer((req, res) => {
      const parsedUrl = parse(req.url!, true);
      handle(req, res, parsedUrl);
    });

    // Initialize Socket.io server attached to HTTP server
    initSocketServer(server);

    server.listen(env.PORT, '0.0.0.0', () => {
      console.log(`
=====================================================
🚕 CENTRAL TÁXI OMNICHANNEL & HELP DESK SAAS 🚕
=====================================================
🚀 Servidor executando em: http://localhost:${env.PORT}
📡 WebSockets (Socket.io) ativos na porta: ${env.PORT}
🌐 Domínio de Produção: https://${env.DOMAIN_NAME}
⚙️ Ambiente: ${env.NODE_ENV}
=====================================================
      `);
    });
  } catch (err: any) {
    console.error('Falha ao iniciar o servidor:', err);
    process.exit(1);
  }
}

startServer();
