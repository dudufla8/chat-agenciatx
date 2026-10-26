'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { Loader2 } from 'lucide-react';
import DriverChatMobile, {
  DriverChatMessage,
  DriverProfileData,
  DriverTicketData
} from '@/components/chat/DriverChatMobile';

// Subtle pleasant chime using Web Audio API
function playSubtleNotificationSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880.0, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // Ignore audio permission issues
  }
}

export default function DriverChatPage() {
  const router = useRouter();
  const [driver, setDriver] = useState<DriverProfileData | null>(null);
  const [ticket, setTicket] = useState<DriverTicketData | null>(null);
  const [messages, setMessages] = useState<DriverChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [operatorTyping, setOperatorTyping] = useState(false);
  const [showOptionsManual, setShowOptionsManual] = useState(false);

  const socketRef = useRef<Socket | null>(null);

  // Load Driver Session & Ticket
  useEffect(() => {
    let socket: Socket;

    async function init() {
      try {
        const localToken = typeof window !== 'undefined' ? localStorage.getItem('driver_session_token') : null;
        const sessionRes = await fetch('/api/auth/driver-session', {
          headers: localToken ? { Authorization: `Bearer ${localToken}` } : {},
        });
        const sessionData = await sessionRes.json();

        if (!sessionRes.ok || !sessionData.authenticated) {
          router.replace('/driver/login');
          return;
        }

        const driverData = sessionData.driver;
        const sessionToken = sessionData.token || localToken;
        setDriver(driverData);

        // Fetch or create ticket
        const ticketRes = await fetch('/api/tickets/driver-active', {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        const ticketData = await ticketRes.json();

        if (ticketData.ticket) {
          setTicket(ticketData.ticket);
          setMessages(ticketData.ticket.messages || []);

          // Connect Socket.io
          socket = io({
            auth: { token: sessionToken },
            transports: ['websocket', 'polling'],
          });

          socketRef.current = socket;

          socket.on('connect', () => {
            setConnected(true);
            socket.emit('join_ticket', { ticketId: ticketData.ticket.id });
            socket.emit('ticket:join', { ticketId: ticketData.ticket.id });
          });

          socket.on('disconnect', () => {
            setConnected(false);
          });

          const handleIncomingMsg = (newMsg: DriverChatMessage) => {
            if (newMsg.senderType === 'OPERATOR') {
              playSubtleNotificationSound();
            }

            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              const filtered = prev.filter(
                (m) =>
                  !(
                    m.id.startsWith('temp-') &&
                    m.content === newMsg.content &&
                    m.senderType === newMsg.senderType
                  )
              );
              return [...filtered, newMsg];
            });
          };

          socket.on('message:receive', handleIncomingMsg);
          socket.on('new_message', handleIncomingMsg);

          socket.on('ticket_updated', (updatedTicket: DriverTicketData) => {
            setTicket((prev) => ({ ...prev, ...updatedTicket }));
          });

          socket.on('user_typing', ({ userType, isTyping }: any) => {
            if (userType === 'OPERATOR') {
              setOperatorTyping(isTyping);
            }
          });
        }

        setLoading(false);
      } catch (err) {
        console.error('Init error:', err);
        setLoading(false);
      }
    }

    init();

    // Heartbeat sync safety net for mobile network
    const syncInterval = setInterval(async () => {
      try {
        const localToken = typeof window !== 'undefined' ? localStorage.getItem('driver_session_token') : null;
        const sessionRes = await fetch('/api/auth/driver-session', {
          headers: localToken ? { Authorization: `Bearer ${localToken}` } : {},
        });
        const sessionData = await sessionRes.json();
        if (sessionData.authenticated && sessionData.token) {
          const ticketRes = await fetch('/api/tickets/driver-active', {
            headers: { Authorization: `Bearer ${sessionData.token}` },
          });
          const ticketData = await ticketRes.json();
          if (ticketData.ticket?.messages) {
            setMessages((prev) => {
              const incoming: DriverChatMessage[] = ticketData.ticket.messages;
              if (incoming.length !== prev.length || incoming[incoming.length - 1]?.id !== prev[prev.length - 1]?.id) {
                return incoming;
              }
              return prev;
            });
            if (ticketData.ticket.status) {
              setTicket((prev) => (prev ? { ...prev, status: ticketData.ticket.status } : ticketData.ticket));
            }
          }
        }
      } catch {
        // Silently continue
      }
    }, 3000);

    return () => {
      clearInterval(syncInterval);
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [router]);

  // Send Driver Message
  const handleSendMessage = (textToSend?: string, mediaUrl?: string) => {
    const text = (textToSend || '').trim();
    if (!text && !mediaUrl) return;
    if (!ticket) return;

    // Optimistic message append
    const tempMsg: DriverChatMessage = {
      id: `temp-${Date.now()}`,
      senderType: 'DRIVER',
      content: text || 'Foto enviada',
      mediaUrl,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);

    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('send_message', {
        ticketId: ticket.id,
        content: text || 'Foto enviada',
        mediaUrl,
      });
    }
  };

  // Upload photo from camera or file
  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.url) {
        handleSendMessage('Comprovante / Foto anexada', data.url);
      }
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  // Exit chat
  const handleExitChat = async () => {
    try {
      if ((window as any).ReactNativeWebView?.postMessage) {
        (window as any).ReactNativeWebView.postMessage(JSON.stringify({ type: 'CLOSE_CHAT' }));
      }
      if ((window as any).flutter_inappwebview?.callHandler) {
        (window as any).flutter_inappwebview.callHandler('closeChat');
      }
      if ((window as any).AndroidBridge?.closeChat) {
        (window as any).AndroidBridge.closeChat();
      }
      if ((window as any).webkit?.messageHandlers?.closeChat) {
        (window as any).webkit.messageHandlers.closeChat.postMessage({});
      }
    } catch {
      // Ignore
    }

    if (confirm('Deseja realmente encerrar a sessão de atendimento?')) {
      try {
        localStorage.removeItem('driver_session_token');
        localStorage.removeItem('driver_profile');
      } catch {}
      await fetch('/api/auth/driver-session', { method: 'DELETE' });
      router.replace('/driver/login');
    }
  };

  // Extract quick options from bot message or default menu
  const extractQuickOptions = () => {
    const lastBotMsg = [...messages].reverse().find((m) => m.senderType === 'BOT');
    if (lastBotMsg?.content) {
      const lines = lastBotMsg.content.split('\n');
      const options: { num: string; text: string }[] = [];
      lines.forEach((line) => {
        const match = line.match(/^(\d+)\s*[-.)]\s*(.+)/);
        if (match) {
          options.push({ num: match[1], text: match[2].trim() });
        }
      });
      if (options.length > 0) return options;
    }

    return [
      { num: '1', text: 'Atualização de Cadastro / Veículo' },
      { num: '2', text: 'Corridas & Operacional' },
      { num: '3', text: 'Novo Cadastro - Quero me credenciar' },
      { num: '4', text: 'Dúvidas Gerais / Outros Assuntos' },
      { num: '5', text: 'Financeiro & Pagamentos / PIX' },
    ];
  };

  const quickOptions = extractQuickOptions();

  if (loading) {
    return (
      <div
        className="h-screen flex flex-col items-center justify-center p-6 text-center select-none"
        style={{ backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
      >
        <div
          className="w-16 h-16 rounded-3xl flex items-center justify-center font-black text-xl mb-5 shadow-xl animate-pulse"
          style={{
            backgroundColor: 'var(--brand-primary)',
            color: 'var(--brand-primary-contrast)',
          }}
        >
          <span className="material-symbols-outlined text-3xl">local_taxi</span>
        </div>
        <p className="text-sm font-semibold flex items-center gap-2 mb-2" style={{ color: 'var(--text-main)' }}>
          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          Conectando à Central de Atendimento...
        </p>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Identificando frota e permissões de acesso
        </span>
      </div>
    );
  }

  return (
    <DriverChatMobile
      driver={driver}
      ticket={ticket}
      messages={messages}
      connected={connected}
      operatorTyping={operatorTyping}
      uploading={uploading}
      onSendMessage={handleSendMessage}
      onFileUpload={handleFileUpload}
      onExitChat={handleExitChat}
      showOptionsManual={showOptionsManual}
      onToggleOptions={() => setShowOptionsManual(!showOptionsManual)}
      quickOptions={quickOptions}
    />
  );
}
