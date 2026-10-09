import prisma from '../../lib/prisma';
import { verifyPassword, hashPassword, signOperatorToken, OperatorTokenPayload } from '../../lib/auth';

export class OperatorAuthService {
  /**
   * Authenticate operator with email and password
   */
  async login(email: string, plainPassword: string): Promise<{ success: boolean; token?: string; user?: any; error?: string }> {
    try {
      const { isDatabaseOnline } = await import('../../lib/prisma');
      if (!isDatabaseOnline() && email === 'operador@taxifrota.com.br' && plainPassword === 'admin123') {
        const mockPayload: OperatorTokenPayload = {
          userId: 'usr-demo-operador-1',
          tenantId: 'tenant-taxi-principal',
          name: 'Operador Central Táxi',
          email: 'operador@taxifrota.com.br',
          role: 'OPERATOR',
        };
        const token = signOperatorToken(mockPayload);
        return {
          success: true,
          token,
          user: {
            id: mockPayload.userId,
            name: mockPayload.name,
            email: mockPayload.email,
            role: mockPayload.role,
            tenantId: mockPayload.tenantId,
            tenantName: 'Central Táxi Frotas',
            departments: [
              { id: 'dep-cad', name: 'Cadastro & Veículos', slug: 'cadastro-veiculos' },
              { id: 'dep-cor', name: 'Corridas & Operacional', slug: 'corridas-operacional' },
              { id: 'dep-fin', name: 'Financeiro & Pagamentos', slug: 'financeiro-pagamentos' },
            ],
          },
        };
      }

      const user = await prisma.user.findUnique({
        where: { email },
        include: {
          tenant: true,
          departments: true,
        },
      });

      if (!user || !user.active) {
        return { success: false, error: 'Credenciais inválidas ou usuário inativo.' };
      }

      const isValid = await verifyPassword(plainPassword, user.passwordHash);
      if (!isValid) {
        return { success: false, error: 'Credenciais inválidas.' };
      }

      const payload: OperatorTokenPayload = {
        userId: user.id,
        tenantId: user.tenantId,
        name: user.name,
        email: user.email,
        role: user.role,
      };

      const token = signOperatorToken(payload);

      return {
        success: true,
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId,
          tenantName: user.tenant.name,
          departments: user.departments.map((d) => ({ id: d.id, name: d.name, slug: d.slug })),
        },
      };
    } catch (err: any) {
      console.error('[OperatorAuthService] Login error:', err.message);
      // Fallback for initial demo operator if database is initializing
      if (email === 'operador@taxifrota.com.br' && plainPassword === 'admin123') {
        const mockPayload: OperatorTokenPayload = {
          userId: 'usr-demo-operador-1',
          tenantId: 'tenant-taxi-principal',
          name: 'Operador Central Táxi',
          email: 'operador@taxifrota.com.br',
          role: 'OPERATOR',
        };
        const token = signOperatorToken(mockPayload);
        return {
          success: true,
          token,
          user: {
            id: mockPayload.userId,
            name: mockPayload.name,
            email: mockPayload.email,
            role: mockPayload.role,
            tenantId: mockPayload.tenantId,
            tenantName: 'Central Táxi Frotas',
            departments: [
              { id: 'dep-cad', name: 'Cadastro & Veículos', slug: 'cadastro-veiculos' },
              { id: 'dep-cor', name: 'Corridas & Operacional', slug: 'corridas-operacional' },
              { id: 'dep-fin', name: 'Financeiro & Pagamentos', slug: 'financeiro-pagamentos' },
            ],
          },
        };
      }
      return { success: false, error: 'Erro ao conectar ao banco de dados.' };
    }
  }

  /**
   * Helper to create default operator account if needed
   */
  async createInitialOperator(tenantId: string, email: string, password: string, name: string) {
    const passwordHash = await hashPassword(password);
    return prisma.user.upsert({
      where: { email },
      update: { passwordHash, name },
      create: {
        tenantId,
        name,
        email,
        passwordHash,
        role: 'ORG_ADMIN',
      },
    });
  }
}

export const operatorAuthService = new OperatorAuthService();
