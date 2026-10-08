import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { ticketService } from '../modules/tickets/ticketService';
import { verifyDriverSessionToken, verifyOperatorToken } from './auth';

let io: SocketIOServer | null = null;

export function initSocketServer(server: HttpServer): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket: Socket) => {
    // 1. Handshake Auth
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    let userType: 'DRIVER' | 'OPERATOR' | 'ANONYMOUS' = 'ANONYMOUS';
    let authData: any = null;

    if (token && typeof token === 'string') {
      const driverAuth = verifyDriverSessionToken(token);
      if (driverAuth) {
        userType = 'DRIVER';
        authData = driverAuth;
        socket.join(`driver:${driverAuth.driverId}`);
      } else {
        const opAuth = verifyOperatorToken(token);
        if (opAuth) {
          userType = 'OPERATOR';
          authData = opAuth;
          socket.join(`operator:${opAuth.userId}`);
          socket.join(`tenant:${opAuth.tenantId}`);
        }
      }
    }

    // 2. Join Ticket Room
    socket.on('join_ticket', ({ ticketId }: { ticketId: string }) => {
      if (ticketId) {
        socket.join(`ticket:${ticketId}`);
      }
    });

    // 3. Driver/Operator sends a message
    socket.on(
      'send_message',
      async ({
        ticketId,
        content,
        mediaUrl,
      }: {
        ticketId: string;
        content: string;
        mediaUrl?: string;
      }) => {
        try {
          if (!ticketId || !content) return;

          if (userType === 'OPERATOR') {
            const { operatorMessage, ticket } = await ticketService.handleOperatorMessage(
              ticketId,
              authData.userId,
              content,
              mediaUrl
            );

            // Broadcast message to ticket room (Driver + Operators looking at ticket)
            io?.to(`ticket:${ticketId}`).emit('new_message', operatorMessage);
            io?.to(`ticket:${ticketId}`).emit('ticket_updated', ticket);

            // Notify all operators in tenant of activity
            io?.to(`tenant:${authData.tenantId}`).emit('dashboard_refresh');
          } else {
            // Driver Message
            const driverId = authData?.driverId || 'driver-unknown';
            const { userMessage, botResponse, ticket } = await ticketService.handleDriverMessage(
              ticketId,
              driverId,
              content,
              mediaUrl
            );

            // Broadcast driver message to ticket room
            io?.to(`ticket:${ticketId}`).emit('new_message', userMessage);

            // If bot replied, broadcast bot message
            if (botResponse) {
              setTimeout(() => {
                io?.to(`ticket:${ticketId}`).emit('new_message', botResponse);
                io?.to(`ticket:${ticketId}`).emit('ticket_updated', ticket);
              }, 400);
            }

            // If ticket transitioned to queue, notify operators
            if (ticket.status === 'WAITING_QUEUE') {
              io?.to(`tenant:${ticket.tenantId}`).emit('queue_new_ticket', ticket);
              io?.to(`tenant:${ticket.tenantId}`).emit('dashboard_refresh');
            }
          }
        } catch (err: any) {
          socket.emit('error', { message: err.message });
        }
      }
    );

    // 4. Operator Claims Ticket
    socket.on('claim_ticket', async ({ ticketId }: { ticketId: string }) => {
      try {
        if (userType !== 'OPERATOR') return;
        const operatorName = authData?.name || 'Operador';
        const updatedTicket = await ticketService.claimTicket(ticketId, authData.userId, operatorName);

        io?.to(`ticket:${ticketId}`).emit('ticket_updated', updatedTicket);
        io?.to(`tenant:${authData.tenantId}`).emit('dashboard_refresh');
      } catch (err: any) {
        socket.emit('error', { message: err.message });
      }
    });

    // 5. Operator Transfers Ticket
    socket.on('transfer_ticket', async ({ ticketId, departmentId }: { ticketId: string; departmentId: string }) => {
      try {
        if (userType !== 'OPERATOR') return;
        const operatorName = authData?.name || 'Operador';
        const updatedTicket = await ticketService.transferTicket(ticketId, departmentId, operatorName);

        io?.to(`ticket:${ticketId}`).emit('ticket_updated', updatedTicket);
        io?.to(`tenant:${authData.tenantId}`).emit('dashboard_refresh');
      } catch (err: any) {
        socket.emit('error', { message: err.message });
      }
    });

    // 6. Operator Closes Ticket
    socket.on('close_ticket', async ({ ticketId }: { ticketId: string }) => {
      try {
        if (userType !== 'OPERATOR') return;
        const operatorName = authData?.name || 'Operador';
        const updatedTicket = await ticketService.closeTicket(ticketId, operatorName);

        io?.to(`ticket:${ticketId}`).emit('ticket_updated', updatedTicket);
        io?.to(`tenant:${authData.tenantId}`).emit('dashboard_refresh');
      } catch (err: any) {
        socket.emit('error', { message: err.message });
      }
    });

    // 7. Typing Indicator
    socket.on('typing', ({ ticketId, isTyping }: { ticketId: string; isTyping: boolean }) => {
      socket.to(`ticket:${ticketId}`).emit('user_typing', {
        userType,
        userName: authData?.name || 'Usuário',
        isTyping,
      });
    });

    socket.on('disconnect', () => {
      // Clean disconnect
    });
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}
