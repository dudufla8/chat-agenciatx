import prisma from '../../lib/prisma';
import { triageEngine } from '../bot/triageEngine';
import { TriageContext, TriageState } from '../bot/triageTypes';
import { TicketStatus, SenderType } from '@prisma/client';

export interface InMemoryTicket {
  id: string;
  tenantId: string;
  driverId: string;
  departmentId?: string | null;
  operatorId?: string | null;
  status: TicketStatus;
  triageStep?: string | null;
  collectedData: Record<string, any>;
  internalNotes?: string | null;
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date | null;
  driver?: any;
  department?: any;
  operator?: any;
  messages: any[];
}

// Resilient memory store to support both PostgreSQL and standalone operation
const MEMORY_TICKETS = new Map<string, InMemoryTicket>();

export class TicketService {
  /**
   * Finds or creates an active ticket for a driver
   */
  async getOrCreateActiveTicketForDriver(driver: {
    id: string;
    tenantId: string;
    prefixo: string;
    name: string;
    phone: string;
    plate?: string | null;
  }): Promise<{ ticket: any; initialMessages?: any[] }> {
    try {
      // 1. Try finding existing active ticket in Prisma
      let existingTicket = await prisma.ticket.findFirst({
        where: {
          driverId: driver.id,
          status: {
            in: [TicketStatus.BOT_TRIAGE, TicketStatus.WAITING_QUEUE, TicketStatus.IN_PROGRESS],
          },
        },
        include: {
          messages: { orderBy: { createdAt: 'asc' } },
          department: true,
          operator: true,
          driver: true,
        },
      });

      if (existingTicket) {
        return { ticket: existingTicket };
      }

      // 2. Create new ticket in BOT_TRIAGE
      const newTicket = await prisma.ticket.create({
        data: {
          tenantId: driver.tenantId,
          driverId: driver.id,
          status: TicketStatus.BOT_TRIAGE,
          triageStep: TriageState.MAIN_MENU,
          collectedData: {},
        },
        include: {
          driver: true,
          department: true,
          operator: true,
          messages: true,
        },
      });

      // Generate bot greeting
      const context: TriageContext = {
        ticketId: newTicket.id,
        driverName: driver.name,
        driverPrefixo: driver.prefixo,
        currentStep: TriageState.MAIN_MENU,
        collectedData: {},
      };

      const greeting = triageEngine.getInitialGreeting(context);

      // Save initial bot message
      const initialMessage = await prisma.message.create({
        data: {
          ticketId: newTicket.id,
          senderType: SenderType.BOT,
          content: greeting.botMessage,
        },
      });

      return {
        ticket: {
          ...newTicket,
          messages: [initialMessage],
        },
      };
    } catch (err: any) {
      console.warn('[TicketService] Using resilient In-Memory store for ticket:', err.message);

      // Check if ticket already exists in memory
      for (const t of MEMORY_TICKETS.values()) {
        if (
          t.driverId === driver.id &&
          ([TicketStatus.BOT_TRIAGE, TicketStatus.WAITING_QUEUE, TicketStatus.IN_PROGRESS] as TicketStatus[]).includes(t.status)
        ) {
          return { ticket: t };
        }
      }

      // Create in-memory ticket
      const ticketId = `tkt-${Date.now()}`;
      const context: TriageContext = {
        ticketId,
        driverName: driver.name,
        driverPrefixo: driver.prefixo,
        currentStep: TriageState.MAIN_MENU,
        collectedData: {},
      };
      const greeting = triageEngine.getInitialGreeting(context);

      const initialMessage = {
        id: `msg-${Date.now()}-1`,
        ticketId,
        senderType: SenderType.BOT,
        content: greeting.botMessage,
        createdAt: new Date(),
      };

      const mockTicket: InMemoryTicket = {
        id: ticketId,
        tenantId: driver.tenantId,
        driverId: driver.id,
        status: TicketStatus.BOT_TRIAGE,
        triageStep: TriageState.MAIN_MENU,
        collectedData: {},
        internalNotes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        driver: {
          id: driver.id,
          prefixo: driver.prefixo,
          name: driver.name,
          phone: driver.phone,
          plate: driver.plate || 'N/A',
        },
        messages: [initialMessage],
      };

      MEMORY_TICKETS.set(ticketId, mockTicket);
      return { ticket: mockTicket };
    }
  }

  /**
   * Handles a message sent by the driver
   */
  async handleDriverMessage(
    ticketId: string,
    driverId: string,
    content: string,
    mediaUrl?: string | null
  ): Promise<{ userMessage: any; botResponse?: any; ticket: any }> {
    // 1. Fetch current ticket
    let ticket: any;
    let isMemory = false;

    try {
      ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        include: { driver: true, department: true, operator: true, messages: true },
      });
    } catch {
      ticket = MEMORY_TICKETS.get(ticketId);
      isMemory = true;
    }

    if (!ticket) {
      ticket = MEMORY_TICKETS.get(ticketId);
      isMemory = true;
    }

    if (!ticket) {
      throw new Error('Chamado não encontrado.');
    }

    // 2. Save Driver Message
    let userMessage: any;
    if (!isMemory) {
      try {
        userMessage = await prisma.message.create({
          data: {
            ticketId,
            senderType: SenderType.DRIVER,
            senderId: driverId,
            content,
            mediaUrl: mediaUrl || null,
          },
        });
      } catch {
        isMemory = true;
      }
    }

    if (isMemory) {
      userMessage = {
        id: `msg-${Date.now()}-d`,
        ticketId,
        senderType: SenderType.DRIVER,
        senderId: driverId,
        content,
        mediaUrl: mediaUrl || null,
        createdAt: new Date(),
      };
      ticket.messages.push(userMessage);
    }

    // 3. If ticket is currently in BOT_TRIAGE, process with TriageEngine
    let botResponse: any = null;
    if (ticket.status === TicketStatus.BOT_TRIAGE) {
      const context: TriageContext = {
        ticketId: ticket.id,
        driverName: ticket.driver?.name || 'Motorista',
        driverPrefixo: ticket.driver?.prefixo || '',
        currentStep: ticket.triageStep || TriageState.MAIN_MENU,
        collectedData: (ticket.collectedData as Record<string, any>) || {},
      };

      const result = triageEngine.processMessage(context, content, mediaUrl);

      // Merge collected data
      const mergedCollectedData = {
        ...context.collectedData,
        ...(result.collectedDataUpdate || {}),
      };

      // Save Bot Message
      if (!isMemory) {
        try {
          botResponse = await prisma.message.create({
            data: {
              ticketId,
              senderType: SenderType.BOT,
              content: result.botMessage,
            },
          });

          // Check if transitioning to WAITING_QUEUE
          let departmentId = ticket.departmentId;
          if (result.targetDepartmentSlug) {
            const dept = await prisma.department.findFirst({
              where: {
                tenantId: ticket.tenantId,
                slug: result.targetDepartmentSlug,
              },
            });
            if (dept) {
              departmentId = dept.id;
            }
          }

          ticket = await prisma.ticket.update({
            where: { id: ticketId },
            data: {
              triageStep: result.nextStep,
              collectedData: mergedCollectedData,
              status: result.transitionToQueue ? TicketStatus.WAITING_QUEUE : TicketStatus.BOT_TRIAGE,
              departmentId: departmentId,
              updatedAt: new Date(),
            },
            include: { driver: true, department: true, operator: true, messages: true },
          });
        } catch {
          isMemory = true;
        }
      }

      if (isMemory) {
        botResponse = {
          id: `msg-${Date.now()}-b`,
          ticketId,
          senderType: SenderType.BOT,
          content: result.botMessage,
          createdAt: new Date(),
        };
        ticket.messages.push(botResponse);
        ticket.triageStep = result.nextStep;
        ticket.collectedData = mergedCollectedData;
        if (result.transitionToQueue) {
          ticket.status = TicketStatus.WAITING_QUEUE;
          ticket.department = {
            id: `dep-${result.targetDepartmentSlug}`,
            name: result.targetDepartmentSlug?.toUpperCase(),
            slug: result.targetDepartmentSlug,
          };
        }
        MEMORY_TICKETS.set(ticketId, ticket);
      }
    }

    return { userMessage, botResponse, ticket };
  }

  /**
   * Handles a message sent by a human operator
   */
  async handleOperatorMessage(
    ticketId: string,
    operatorId: string,
    content: string,
    mediaUrl?: string | null
  ): Promise<{ operatorMessage: any; ticket: any }> {
    let ticket: any;
    let isMemory = false;

    try {
      ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        include: { driver: true, department: true, operator: true, messages: true },
      });
    } catch {
      ticket = MEMORY_TICKETS.get(ticketId);
      isMemory = true;
    }

    if (!ticket) {
      ticket = MEMORY_TICKETS.get(ticketId);
      isMemory = true;
    }

    let operatorMessage: any;
    if (!isMemory) {
      try {
        operatorMessage = await prisma.message.create({
          data: {
            ticketId,
            senderType: SenderType.OPERATOR,
            senderId: operatorId,
            content,
            mediaUrl: mediaUrl || null,
          },
        });
      } catch {
        isMemory = true;
      }
    }

    if (isMemory) {
      operatorMessage = {
        id: `msg-${Date.now()}-op`,
        ticketId,
        senderType: SenderType.OPERATOR,
        senderId: operatorId,
        content,
        mediaUrl: mediaUrl || null,
        createdAt: new Date(),
      };
      ticket.messages.push(operatorMessage);
      ticket.updatedAt = new Date();
      MEMORY_TICKETS.set(ticketId, ticket);
    }

    return { operatorMessage, ticket };
  }

  /**
   * Operator claims ticket
   */
  async claimTicket(ticketId: string, operatorId: string, operatorName: string): Promise<any> {
    try {
      const ticket = await prisma.ticket.update({
        where: { id: ticketId },
        data: {
          operatorId,
          status: TicketStatus.IN_PROGRESS,
          updatedAt: new Date(),
        },
        include: { driver: true, department: true, operator: true, messages: true },
      });

      // Add system announcement message
      await prisma.message.create({
        data: {
          ticketId,
          senderType: SenderType.SYSTEM,
          content: `O atendente ${operatorName} iniciou o atendimento.`,
        },
      });

      return ticket;
    } catch {
      const ticket = MEMORY_TICKETS.get(ticketId);
      if (ticket) {
        ticket.operatorId = operatorId;
        ticket.status = TicketStatus.IN_PROGRESS;
        ticket.operator = { id: operatorId, name: operatorName };
        ticket.messages.push({
          id: `msg-${Date.now()}-sys`,
          ticketId,
          senderType: SenderType.SYSTEM,
          content: `O atendente ${operatorName} iniciou o atendimento.`,
          createdAt: new Date(),
        });
        MEMORY_TICKETS.set(ticketId, ticket);
      }
      return ticket;
    }
  }

  /**
   * Operator transfers ticket to another department
   */
  async transferTicket(ticketId: string, departmentId: string, operatorName: string): Promise<any> {
    try {
      const dept = await prisma.department.findUnique({ where: { id: departmentId } });
      const deptName = dept?.name || 'outro departamento';

      const ticket = await prisma.ticket.update({
        where: { id: ticketId },
        data: {
          departmentId,
          operatorId: null,
          status: TicketStatus.WAITING_QUEUE,
          updatedAt: new Date(),
        },
        include: { driver: true, department: true, operator: true, messages: true },
      });

      await prisma.message.create({
        data: {
          ticketId,
          senderType: SenderType.SYSTEM,
          content: `Atendimento transferido por ${operatorName} para o setor de ${deptName}.`,
        },
      });

      return ticket;
    } catch {
      const ticket = MEMORY_TICKETS.get(ticketId);
      if (ticket) {
        ticket.departmentId = departmentId;
        ticket.operatorId = null;
        ticket.status = TicketStatus.WAITING_QUEUE;
        ticket.messages.push({
          id: `msg-${Date.now()}-sys`,
          ticketId,
          senderType: SenderType.SYSTEM,
          content: `Atendimento transferido por ${operatorName} para outro setor.`,
          createdAt: new Date(),
        });
        MEMORY_TICKETS.set(ticketId, ticket);
      }
      return ticket;
    }
  }

  /**
   * Operator closes ticket
   */
  async closeTicket(ticketId: string, operatorName: string): Promise<any> {
    try {
      const ticket = await prisma.ticket.update({
        where: { id: ticketId },
        data: {
          status: TicketStatus.CLOSED,
          closedAt: new Date(),
          updatedAt: new Date(),
        },
        include: { driver: true, department: true, operator: true, messages: true },
      });

      await prisma.message.create({
        data: {
          ticketId,
          senderType: SenderType.SYSTEM,
          content: `Atendimento finalizado por ${operatorName}.`,
        },
      });

      return ticket;
    } catch {
      const ticket = MEMORY_TICKETS.get(ticketId);
      if (ticket) {
        ticket.status = TicketStatus.CLOSED;
        ticket.closedAt = new Date();
        ticket.messages.push({
          id: `msg-${Date.now()}-sys`,
          ticketId,
          senderType: SenderType.SYSTEM,
          content: `Atendimento finalizado por ${operatorName}.`,
          createdAt: new Date(),
        });
        MEMORY_TICKETS.set(ticketId, ticket);
      }
      return ticket;
    }
  }

  /**
   * Save internal notes for a ticket (not visible to driver)
   */
  async saveInternalNotes(ticketId: string, notes: string): Promise<any> {
    try {
      return await prisma.ticket.update({
        where: { id: ticketId },
        data: { internalNotes: notes },
      });
    } catch {
      const ticket = MEMORY_TICKETS.get(ticketId);
      if (ticket) {
        ticket.internalNotes = notes;
        MEMORY_TICKETS.set(ticketId, ticket);
      }
      return ticket;
    }
  }

  /**
   * Fetches dashboard tickets grouped by tabs: Aguardando, Meus Atendimentos, Finalizados
   */
  async getDashboardTickets(tenantId: string, operatorId?: string, departmentId?: string) {
    try {
      const [waiting, myChats, closed] = await Promise.all([
        prisma.ticket.findMany({
          where: {
            tenantId,
            status: TicketStatus.WAITING_QUEUE,
            ...(departmentId ? { departmentId } : {}),
          },
          include: { driver: true, department: true, messages: { take: 1, orderBy: { createdAt: 'desc' } } },
          orderBy: { createdAt: 'asc' },
        }),
        prisma.ticket.findMany({
          where: {
            tenantId,
            operatorId: operatorId,
            status: TicketStatus.IN_PROGRESS,
          },
          include: { driver: true, department: true, messages: { take: 1, orderBy: { createdAt: 'desc' } } },
          orderBy: { updatedAt: 'desc' },
        }),
        prisma.ticket.findMany({
          where: {
            tenantId,
            status: { in: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
          },
          include: { driver: true, department: true, operator: true, messages: { take: 1, orderBy: { createdAt: 'desc' } } },
          orderBy: { closedAt: 'desc' },
          take: 50,
        }),
      ]);

      return { waiting, myChats, closed };
    } catch {
      const waiting: any[] = [];
      const myChats: any[] = [];
      const closed: any[] = [];

      for (const t of MEMORY_TICKETS.values()) {
        if (t.tenantId !== tenantId) continue;
        if (t.status === TicketStatus.WAITING_QUEUE) waiting.push(t);
        else if (t.status === TicketStatus.IN_PROGRESS && t.operatorId === operatorId) myChats.push(t);
        else if (([TicketStatus.RESOLVED, TicketStatus.CLOSED] as TicketStatus[]).includes(t.status)) closed.push(t);
      }

      return { waiting, myChats, closed };
    }
  }

  /**
   * Get canned responses for tenant
   */
  async getCannedResponses(tenantId: string) {
    try {
      const responses = await prisma.cannedResponse.findMany({
        where: { tenantId },
        orderBy: { shortcut: 'asc' },
      });
      if (responses.length > 0) return responses;
    } catch {
      // Fallback
    }

    return [
      { id: '1', shortcut: '/pix', title: 'Chave Pix Oficial', content: 'Nossa chave Pix CNPJ para repasses e acertos é: 12.345.678/0001-90 (Central Táxi Frotas).' },
      { id: '2', shortcut: '/regras', title: 'Regulamento de Cancelamento', content: 'Conforme regulamento operacional da frota, cancelamentos sem justificativa válida após 5 minutos estão sujeitos a taxa de deslocamento.' },
      { id: '3', shortcut: '/suporte', title: 'Suporte Técnico App', content: 'Caso o aplicativo esteja apresentando travamento, favor limpar o cache nas configurações do aparelho e reiniciar o GPS.' },
      { id: '4', shortcut: '/documentos', title: 'Documentos Necessários', content: 'Para atualização cadastral do veículo, envie foto legível do CRLV atualizado e CNH com observação EAR.' },
    ];
  }
}

export const ticketService = new TicketService();
