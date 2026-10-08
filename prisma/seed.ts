import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando carga de dados (Seed) para a Central Táxi Omnichannel...');

  // 1. Criar Tenant Principal
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'central-taxi-frotas' },
    update: {},
    create: {
      id: 'tenant-taxi-principal',
      name: 'Central Táxi Frotas',
      slug: 'central-taxi-frotas',
      active: true,
    },
  });

  console.log(`Tenant pronto: ${tenant.name} (${tenant.id})`);

  // 2. Criar Departamentos Padrão
  const departmentsData = [
    { name: 'Cadastro & Veículos', slug: 'cadastro-veiculos' },
    { name: 'Corridas & Operacional', slug: 'corridas-operacional' },
    { name: 'Comercial & Novos Cadastros', slug: 'comercial-novos-cadastros' },
    { name: 'Dúvidas Gerais', slug: 'duvidas-gerais' },
    { name: 'Financeiro & Pagamentos', slug: 'financeiro-pagamentos' },
  ];

  const createdDepartments = [];
  for (const dept of departmentsData) {
    const d = await prisma.department.upsert({
      where: {
        tenantId_slug: {
          tenantId: tenant.id,
          slug: dept.slug,
        },
      },
      update: { name: dept.name },
      create: {
        tenantId: tenant.id,
        name: dept.name,
        slug: dept.slug,
      },
    });
    createdDepartments.push(d);
  }
  console.log(`Departamentos criados: ${createdDepartments.length}`);

  // 3. Criar Usuário Operador Padrão
  const passwordHash = await bcrypt.hash('admin123', 10);
  const operatorUser = await prisma.user.upsert({
    where: { email: 'operador@taxifrota.com.br' },
    update: {
      passwordHash,
      departments: {
        connect: createdDepartments.map((d) => ({ id: d.id })),
      },
    },
    create: {
      id: 'usr-demo-operador-1',
      tenantId: tenant.id,
      name: 'Carlos Atendente Central',
      email: 'operador@taxifrota.com.br',
      passwordHash,
      role: UserRole.ORG_ADMIN,
      departments: {
        connect: createdDepartments.map((d) => ({ id: d.id })),
      },
    },
  });
  console.log(`Operador padrão criado: ${operatorUser.email} (Senha: admin123)`);

  // 4. Criar Respostas Rápidas (Canned Responses)
  const cannedList = [
    {
      shortcut: '/pix',
      title: 'Chave Pix Oficial',
      content: 'Nossa chave Pix CNPJ para repasses e acertos é: 12.345.678/0001-90 (Central Táxi Frotas).',
    },
    {
      shortcut: '/regras',
      title: 'Regulamento de Cancelamento',
      content: 'Conforme regulamento operacional da frota, cancelamentos sem justificativa válida após 5 minutos estão sujeitos a taxa de deslocamento.',
    },
    {
      shortcut: '/suporte',
      title: 'Suporte Técnico App',
      content: 'Caso o aplicativo esteja apresentando travamento ou lentidão, favor limpar o cache nas configurações do aparelho e reiniciar o GPS.',
    },
    {
      shortcut: '/documentos',
      title: 'Documentos Necessários',
      content: 'Para atualização cadastral do veículo, envie foto legível do CRLV atualizado e CNH com observação EAR.',
    },
  ];

  for (const item of cannedList) {
    const existing = await prisma.cannedResponse.findFirst({
      where: { tenantId: tenant.id, shortcut: item.shortcut },
    });

    if (!existing) {
      await prisma.cannedResponse.create({
        data: {
          tenantId: tenant.id,
          shortcut: item.shortcut,
          title: item.title,
          content: item.content,
        },
      });
    }
  }
  console.log('Respostas rápidas cadastradas com sucesso.');

  // 5. Criar Motoristas de Teste
  const testDrivers = [
    { prefixo: '101', name: 'Carlos Eduardo Oliveira', phone: '(11) 98765-4321', plate: 'BRA-2E19' },
    { prefixo: '204', name: 'Marcos Roberto Santos', phone: '(11) 97123-9988', plate: 'SP-ABC1234' },
    { prefixo: '305', name: 'Ana Paula Ferraz', phone: '(11) 99887-1122', plate: 'SP-XYZ9876' },
    { prefixo: '555', name: 'Roberto Da Silva Tavares', phone: '(11) 96543-2109', plate: 'RIO-9A88' },
  ];

  for (const drv of testDrivers) {
    await prisma.driver.upsert({
      where: {
        tenantId_prefixo: {
          tenantId: tenant.id,
          prefixo: drv.prefixo,
        },
      },
      update: drv,
      create: {
        tenantId: tenant.id,
        ...drv,
      },
    });
  }
  console.log('Motoristas de teste da frota cadastrados com sucesso.');
  console.log('Seed concluído com êxito!');
}

main()
  .catch((e) => {
    console.error('Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
