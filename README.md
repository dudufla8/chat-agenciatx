# 🚕 Central Táxi 2.0 - SaaS Omnichannel & Help Desk para Frotas de Táxi

Plataforma completa de atendimento omnichannel, triagem automatizada com máquina de estados finitos, autenticação In-App SSO sem login manual e gestão de atendimento humano para frotas de táxi.

Construído com **Node.js**, **TypeScript**, **Next.js (App Router)**, **Tailwind CSS**, **Prisma ORM**, **PostgreSQL**, **Redis**, **Socket.io** e containerizado com **Docker Compose** e **Nginx**.

---

## 📁 Estrutura de Pastas do Projeto

```
├── prisma/
│   ├── schema.prisma              # Definição multi-tenant (Tenant, User, Department, Driver, Ticket, Message, CannedResponse)
│   └── seed.ts                    # Carga inicial (Departamentos, Operador admin, Respostas rápidas e Motoristas)
├── public/
│   └── uploads/                   # Diretório de fotos e comprovantes enviados
├── nginx/
│   └── nginx.conf                 # Configuração do Proxy Reverso Nginx com WebSockets e SSL
├── src/
│   ├── config/
│   │   └── env.ts                 # Validação e carregamento de variáveis de ambiente
│   ├── lib/
│   │   ├── prisma.ts              # Instância singleton do Prisma Client
│   │   ├── redis.ts               # Cliente Redis com fallback In-Memory para dev local
│   │   ├── auth.ts                # Assinatura e verificação de JWTs (SSO, Operador, Motorista)
│   │   └── socket.ts              # Servidor Socket.io para comunicação em tempo real
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── driverSsoService.ts    # Validação do In-App SSO, verificação < 5 min e criação de sessão
│   │   │   └── operatorAuthService.ts # Login e autenticação do operador com bcrypt e JWT
│   │   ├── bot/
│   │   │   ├── triageEngine.ts        # Máquina de Estados da triagem automática (Menus, subfluxos e roteamento)
│   │   │   └── triageTypes.ts         # Tipos e nós da árvore de decisão
│   │   ├── taxi-digital/
│   │   │   └── taxiDigitalService.ts  # Consulta à API da Táxi Digital com cache Redis e fallback
│   │   ├── notifications/
│   │   │   ├── INotificationProvider.ts # Interface desacoplada para envio de notificações
│   │   │   └── MetaCloudApiProvider.ts  # Implementação da API Oficial do WhatsApp (Meta Cloud)
│   │   └── tickets/
│   │       └── ticketService.ts       # Gestão do ciclo de vida dos chamados, filas e mensagens
│   ├── app/
│   │   ├── layout.tsx             # Layout global com viewport mobile-first
│   │   ├── page.tsx               # Portal de entrada com simulador In-App SSO e acesso rápido
│   │   ├── driver/
│   │   │   ├── auth/page.tsx      # Rota de validação SSO com tela de acesso restrito
│   │   │   ├── chat/page.tsx      # Interface mobile do motorista com botões interativos e áudio
│   │   │   └── signup/page.tsx    # Formulário de novo cadastro (?mode=signup)
│   │   ├── operator/
│   │   │   ├── login/page.tsx     # Tela de login do operador
│   │   │   └── dashboard/page.tsx # Painel desktop de 3 colunas da central
│   │   └── api/
│   │       ├── auth/...           # Endpoints de autenticação
│   │       ├── tickets/...        # Endpoints de chamados
│   │       ├── operator/...       # Ações do operador (assumir, transferir, encerrar, notas)
│   │       ├── upload/...         # Upload de documentos e comprovantes
│   │       └── webhooks/whatsapp/ # Webhook Meta Cloud API (GET challenge e POST eventos)
│   └── server.ts                  # Ponto de entrada customizado Node.js + Next.js + Socket.io
├── Dockerfile                     # Multi-stage build Node 20 Alpine
├── docker-compose.yml             # Orquestração (App, PostgreSQL 16, Redis 7, Nginx)
├── deploy-vps.sh                  # Script de deploy automático em 1 comando para VPS Ubuntu
└── .env.example                   # Modelo de variáveis de ambiente
```

---

## 1. 🔑 Arquitetura de Autenticação In-App SSO

### Como Funciona:
1. O motorista **nunca digita login nem senha**.
2. O aplicativo mobile oficial gera um token JWT assinado com a chave secreta compartilhada `DRIVER_SSO_SECRET`.
3. O app abre a WebView para:
   ```
   https://atendimento.seudominio.com.br/driver/auth?token={JWT_PAYLOAD}
   ```
4. O payload obrigatório do JWT:
   ```json
   {
     "tenant_id": "tenant-taxi-principal",
     "prefixo": "101",
     "driver_external_id": "TX-101",
     "timestamp": 1728345600
   }
   ```
5. O backend do sistema valida a assinatura e verifica se a emissão ocorreu em **menos de 5 minutos** (`timestamp`).
6. Se o token for inválido ou expirado, a tela exibe:
   > **"Acesso restrito. Abra o chat pelo aplicativo do motorista."**
7. Se for válido, consulta a API Táxi Digital, sincroniza na tabela `Driver` e emite um Cookie HTTPOnly com sessão JWT segura.
8. Acesso avulso para novos interessados é permitido exclusivamente via:
   ```
   https://atendimento.seudominio.com.br/driver/auth?mode=signup
   ```

---

## 2. 🤖 Máquina de Estados da Triagem Automática (`triageEngine.ts`)

O chamado nasce com status `BOT_TRIAGE`. A máquina orienta o motorista pelas opções:

- **[1] Atualização de Cadastro / Veículo:**
  - Opções: *Troca de Celular/IMEI*, *Troca de Carro*, *Outros documentos*.
  - Coleta: Foto ou print do documento/comprovante.
  - Ação: Vincula ao departamento `cadastro-veiculos` e move para `WAITING_QUEUE`.

- **[2] Corridas (Correção de valor, Cancelamentos, Agendamentos):**
  - Opções: *Corrigir valor de corrida*, *Cancelamento de corrida*, *Agendamentos*.
  - Coleta: Número da corrida, valor cobrado e motivo detalhado.
  - Ação: Vincula ao departamento `corridas-operacional` e move para `WAITING_QUEUE`.

- **[3] Novo Cadastro - Quero participar:**
  - Coleta: Nome completo, cidade e WhatsApp.
  - Ação: Vincula ao departamento `comercial-novos-cadastros` e move para `WAITING_QUEUE`.

- **[4] Outros Assuntos / Dúvidas Gerais:**
  - Coleta: Descrição resumida da dúvida.
  - Ação: Vincula ao departamento `duvidas-gerais` e move para `WAITING_QUEUE`.

- **[5] Dúvidas sobre Pagamentos / Repasses:**
  - Opções: *Não recebi meu repasse*, *Preciso de extrato*, *Alterar chave Pix*, *Outra dúvida*.
  - Se opção [1] ou [3]: Solicita chave Pix e confirmação de nome/telefone.
  - Ação: Salva no JSON `collectedData`, vincula a `financeiro-pagamentos` e move para `WAITING_QUEUE`.

> **Regra de Fila:** O chamado **só aparece no painel dos atendentes humanos** quando o status mudar para `WAITING_QUEUE`.

---

## 3. 🖥️ Painel Desktop do Operador

- **Barra Superior:** Identificação do operador, seletor de status (**Online / Em Pausa**) e filtro por departamento.
- **Coluna da Esquerda:** Abas organizadas por status:
  - **Aguardando:** Fila de espera do setor do atendente.
  - **Meus Chats:** Conversas ativas em andamento com o operador logado.
  - **Finalizados:** Histórico com campo de busca por prefixo, nome ou placa.
- **Coluna Central:**
  - Distinção clara de mensagens (Bot, Motorista, Operador e Sistema).
  - Pré-visualização de fotos e comprovantes enviados.
  - Atalhos rápidos com **`/`** (ex: `/pix`, `/regras`, `/suporte`, `/documentos`).
  - Botões de ação rápida: **Assumir Chamado**, **Transferir Setor** e **Encerrar Atendimento**.
- **Coluna da Direita:**
  - Ficha Cadastral completa (Prefixo, Nome, Telefone com ligação e WhatsApp com 1 clique, Placa).
  - Resumo dos dados coletados pelo bot na triagem.
  - **Notas Internas:** Bloco confidencial da equipe que o motorista não visualiza.

---

## 4. 📱 Interface Mobile do Motorista

- Otimizada para WebView de smartphone.
- Indicador visual verde pulsante de conexão em tempo real (**Conectado à Central**).
- **Balões interativos de resposta rápida:** o motorista pode tocar no botão com a opção desejada ou digitar o número.
- Upload instantâneo pela câmera ou galeria do smartphone.
- Notificação sonora sutil sintetizada via Web Audio API quando o operador responde.

---

## 5. 🚀 Deploy em VPS Ubuntu (Hostinger) com Docker Compose

### Passo 1: Enviar os arquivos para a VPS
```bash
scp -r . root@IP_DA_SUA_VPS:/root/taxi-atendimento
```

### Passo 2: Acessar a VPS via SSH
```bash
ssh root@IP_DA_SUA_VPS
cd /root/taxi-atendimento
```

### Passo 3: Configurar o arquivo `.env`
```bash
cp .env.example .env
nano .env
```
Altere o `DOMAIN_NAME` para o seu domínio (ex: `atendimento.seudominio.com.br`) e defina senhas seguras.

### Passo 4: Executar o deploy automatizado
```bash
chmod +x deploy-vps.sh
./deploy-vps.sh
```

O script irá:
1. Instalar o Docker e Docker Compose automaticamente (se não instalados).
2. Orquestrar os contêineres: **App (Node.js/Next.js)**, **PostgreSQL 16**, **Redis 7** e **Nginx**.
3. Aplicar as migrações do banco com o Prisma.
4. Executar o seed inicial com o usuário administrador padrão:
   - **Email:** `operador@taxifrota.com.br`
   - **Senha:** `admin123`

---

## 6. 🧪 Como Testar Localmente

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Gere o cliente do Prisma:
   ```bash
   npx prisma generate
   ```

3. Inicie o servidor:
   ```bash
   npm run dev
   ```

4. Abra `http://localhost:3000`:
   - Clique em **"Simulador de Acesso (Motorista In-App SSO)"** para testar a experiência do motorista com geração de token em tempo real.
   - Clique em **"Painel do Atendente (Central)"** e faça login com `operador@taxifrota.com.br` / `admin123` para atender as conversas em tempo real!
