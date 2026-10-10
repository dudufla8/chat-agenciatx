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
    // 1. Handshake Auth (auth object, query param or cookies fallback)
    let token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token && socket.request?.headers?.cookie) {
      const cookieStr = socket.request.headers.cookie;
      const opMatch = cookieStr.match(/operator_token=([^;]+)/);
      const drvMatch = cookieStr.match(/driver_session=([^;]+)/);
      if (opMatch) token = decodeURIComponent(opMatch[1]);
      else if (drvMatch) token = decodeURIComponent(drvMatch[1]);
    }

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

    // 2. Operator Join (Support explicit operator:join event)
    socket.on('operator:join', ({ tenantId, operatorId }: { tenantId?: string; operatorId?: string }) => {
      if (tenantId) socket.join(`tenant:${tenantId}`);
      if (operatorId) socket.join(`operator:${operatorId}`);
      userType = 'OPERATOR';
      if (!authData) {
        authData = { userId: operatorId || 'op-operator', tenantId: tenantId || 'tenant-default' };
      }
    });

    // 3. Join Ticket Room (Support both join_ticket and ticket:join)
    const handleJoinTicket = ({ ticketId }: { ticketId: string }) => {
      if (ticketId) {
        socket.join(`ticket:${ticketId}`);
      }
    };
    socket.on('join_ticket', handleJoinTicket);
    socket.on('ticket:join', handleJoinTicket);

    // 4. Message Sender (Supports send_message and message:send)
    const handleMessageSend = async ({
      ticketId,
      content,
      senderType,
      senderId,
      mediaUrl,
    }: {
      ticketId: string;
      content: string;
      senderType?: string;
      senderId?: string;
      mediaUrl?: string;
    }) => {
      try {
        if (!ticketId || (!content && !mediaUrl)) return;

        const isOperator = userType === 'OPERATOR' || senderType === 'OPERATOR';

        if (isOperator) {
          const effectiveOpId = authData?.userId || senderId || 'operator-admin';
          const { operatorMessage, ticket } = await ticketService.handleOperatorMessage(
            ticketId,
            effectiveOpId,
            content,
            mediaUrl
          );

          // Broadcast message to ticket room (Driver + Operators looking at ticket)
          io?.to(`ticket:${ticketId}`).emit('new_message', operatorMessage);
          io?.to(`ticket:${ticketId}`).emit('ticket:message', operatorMessage);
          io?.to(`ticket:${ticketId}`).emit('ticket_updated', ticket);

          // Notify all operators in tenant of activity
          const tenantId = authData?.tenantId || ticket?.tenantId;
          if (tenantId) {
            io?.to(`tenant:${tenantId}`).emit('dashboard_refresh');
          }
        } else {
          // Driver Message
          const driverId = authData?.driverId || senderId || 'driver-unknown';
          const { userMessage, botResponse, ticket } = await ticketService.handleDriverMessage(
            ticketId,
            driverId,
            content,
            mediaUrl
          );

          // Broadcast driver message to ticket room (both event formats for 100% compatibility)
          io?.to(`ticket:${ticketId}`).emit('new_message', userMessage);
          io?.to(`ticket:${ticketId}`).emit('ticket:message', userMessage);
          io?.to(`ticket:${ticketId}`).emit('ticket_updated', ticket);

          // Always notify all operators in tenant of new message/activity so conversation card updates
          if (ticket?.tenantId) {
            io?.to(`tenant:${ticket.tenantId}`).emit('dashboard_refresh');
            if (ticket.status === 'WAITING_QUEUE') {
              io?.to(`tenant:${ticket.tenantId}`).emit('queue_new_ticket', ticket);
            }
          }

          // If bot replied, broadcast bot message
          if (botResponse) {
            setTimeout(() => {
              io?.to(`ticket:${ticketId}`).emit('new_message', botResponse);
              io?.to(`ticket:${ticketId}`).emit('ticket:message', botResponse);
              io?.to(`ticket:${ticketId}`).emit('ticket_updated', ticket);
              if (ticket?.tenantId) {
                io?.to(`tenant:${ticket.tenantId}`).emit('dashboard_refresh');
              }
            }, 300);
          }
        }
      } catch (err: any) {
        console.error('[Socket Server] Error handling message:', err.message);
        socket.emit('error', { message: err.message });
      }
    };

    socket.on('send_message', handleMessageSend);
    socket.on('message:send', handleMessageSend);

    // 5. Operator Claims Ticket
    socket.on('claim_ticket', async ({ ticketId }: { ticketId: string }) => {
      try {
        const operatorName = authData?.name || 'Operador';
        const operatorId = authData?.userId || 'op-claim';
        const updatedTicket = await ticketService.claimTicket(ticketId, operatorId, operatorName);

        io?.to(`ticket:${ticketId}`).emit('ticket_updated', updatedTicket);
        if (authData?.tenantId || updatedTicket?.tenantId) {
          io?.to(`tenant:${authData?.tenantId || updatedTicket.tenantId}`).emit('dashboard_refresh');
        }
      } catch (err: any) {
        socket.emit('error', { message: err.message });
      }
    });

    // 6. Operator Transfers Ticket
    socket.on('transfer_ticket', async ({ ticketId, departmentId }: { ticketId: string; departmentId: string }) => {
      try {
        const operatorName = authData?.name || 'Operador';
        const updatedTicket = await ticketService.transferTicket(ticketId, departmentId, operatorName);

        io?.to(`ticket:${ticketId}`).emit('ticket_updated', updatedTicket);
        if (authData?.tenantId || updatedTicket?.tenantId) {
          io?.to(`tenant:${authData?.tenantId || updatedTicket.tenantId}`).emit('dashboard_refresh');
        }
      } catch (err: any) {
        socket.emit('error', { message: err.message });
      }
    });

    // 7. Operator Closes Ticket
    socket.on('close_ticket', async ({ ticketId }: { ticketId: string }) => {
      try {
        const operatorName = authData?.name || 'Operador';
        const updatedTicket = await ticketService.closeTicket(ticketId, operatorName);

        io?.to(`ticket:${ticketId}`).emit('ticket_updated', updatedTicket);
        if (authData?.tenantId || updatedTicket?.tenantId) {
          io?.to(`tenant:${authData?.tenantId || updatedTicket.tenantId}`).emit('dashboard_refresh');
        }
      } catch (err: any) {
        socket.emit('error', { message: err.message });
      }
    });

    // 8. Typing Indicator
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
