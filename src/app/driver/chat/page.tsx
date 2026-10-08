'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import {
  Send,
  Camera,
  Paperclip,
  LogOut,
  Car,
  CheckCheck,
  Bot,
  UserCheck,
  Loader2,
  Image as ImageIcon,
  AlertCircle
} from 'lucide-react';

interface Message {
  id: string;
  senderType: 'DRIVER' | 'OPERATOR' | 'BOT' | 'SYSTEM';
  senderId?: string;
  content: string;
  mediaUrl?: string | null;
  createdAt: string | Date;
}

interface DriverProfile {
  driverId: string;
  tenantId: string;
  prefixo: string;
  name: string;
  phone: string;
  plate?: string;
}

interface Ticket {
  id: string;
  status: string;
  triageStep?: string;
  department?: { name: string };
  operator?: { name: string };
}

// Generates an elegant subtle audio chime using Web Audio API
function playSubtleNotificationSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880.0, ctx.currentTime + 0.15); // A5

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
  const [driver, setDriver] = useState<DriverProfile | null>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [operatorTyping, setOperatorTyping] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, operatorTyping]);

  // Load Driver Session & Ticket
  useEffect(() => {
    let socket: Socket;

    async function init() {
      try {
        const sessionRes = await fetch('/api/auth/driver-session');
        const sessionData = await sessionRes.json();

        if (!sessionRes.ok || !sessionData.authenticated) {
          router.replace('/driver/auth');
          return;
        }

        const driverData = sessionData.driver;
        const sessionToken = sessionData.token;
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
          });

          socket.on('disconnect', () => {
            setConnected(false);
          });

          socket.on('new_message', (msg: Message) => {
            setMessages((prev) => {
              // Avoid duplicates
              if (prev.some((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });

            if (msg.senderType === 'OPERATOR') {
              playSubtleNotificationSound();
            }
          });

          socket.on('ticket_updated', (updatedTicket: Ticket) => {
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

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [router]);

  // Send Driver Message
  const handleSendMessage = (textToSend?: string, mediaUrl?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text && !mediaUrl) return;
    if (!ticket) return;

    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('send_message', {
        ticketId: ticket.id,
        content: text || 'Foto enviada',
        mediaUrl,
      });
    }

    setInputText('');
  };

  // Upload photo from camera or file
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Exit chat
  const handleExitChat = async () => {
    if (confirm('Deseja realmente encerrar a sessão de atendimento?')) {
      await fetch('/api/auth/driver-session', { method: 'DELETE' });
      router.replace('/driver/auth');
    }
  };

  // Extract quick options from the latest bot message if present
  const extractQuickOptions = () => {
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.senderType !== 'BOT') return null;

    const lines = lastMsg.content.split('\n');
    const options: { num: string; text: string }[] = [];

    lines.forEach((line) => {
      const match = line.match(/^\[([1-5])\]\s*(.+)/);
      if (match) {
        options.push({ num: match[1], text: match[2] });
      }
    });

    return options.length > 0 ? options : null;
  };

  const quickOptions = extractQuickOptions();

  if (loading) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
          <Car className="w-8 h-8 text-amber-400 animate-pulse" />
        </div>
        <p className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
          Conectando à Central de Atendimento...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-slate-950 border-x border-slate-800 shadow-2xl overflow-hidden">
      {/* 1. Header Minimalista */}
      <header className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shadow-inner">
            <Car className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white tracking-wide">
                Prefixo {driver?.prefixo || '---'}
              </span>
              <span className="text-xs text-slate-400">({driver?.name?.split(' ')[0]})</span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  connected ? 'bg-emerald-500 animate-pulse-subtle' : 'bg-rose-500'
                }`}
              />
              <span className="text-[11px] font-medium text-slate-300">
                {connected ? 'Conectado à Central' : 'Reconectando...'}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={handleExitChat}
          title="Encerrar"
          className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      {/* Status Bar Sub-header */}
      <div className="bg-slate-900/40 px-4 py-1.5 border-b border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
        <span>
          Status:{' '}
          <strong className="text-amber-400 font-medium">
            {ticket?.status === 'BOT_TRIAGE'
              ? 'Triagem Automática'
              : ticket?.status === 'WAITING_QUEUE'
              ? 'Fila de Espera'
              : ticket?.status === 'IN_PROGRESS'
              ? 'Atendimento Humano'
              : 'Concluído'}
          </strong>
        </span>
        {ticket?.operator?.name && (
          <span className="text-emerald-400 font-medium truncate max-w-[150px]">
            Atendente: {ticket.operator.name}
          </span>
        )}
      </div>

      {/* 2. Messages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-950/70">
        {messages.map((msg) => {
          const isDriver = msg.senderType === 'DRIVER';
          const isBot = msg.senderType === 'BOT';
          const isSystem = msg.senderType === 'SYSTEM';

          if (isSystem) {
            return (
              <div key={msg.id} className="flex justify-center my-2">
                <span className="px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] text-slate-400 text-center max-w-[85%]">
                  {msg.content}
                </span>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isDriver ? 'items-end' : 'items-start'}`}
            >
              {/* Sender Name/Badge */}
              <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] font-medium text-slate-400">
                {isBot && (
                  <>
                    <Bot className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-amber-400 font-semibold">Assistente Virtual Táxi</span>
                  </>
                )}
                {!isDriver && !isBot && (
                  <>
                    <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-blue-400 font-semibold">
                      {ticket?.operator?.name || 'Atendente da Central'}
                    </span>
                  </>
                )}
                {isDriver && <span>Você ({driver?.prefixo})</span>}
              </div>

              {/* Message Bubble */}
              <div
                className={`max-w-[86%] rounded-2xl px-4 py-2.5 text-sm shadow-md whitespace-pre-wrap leading-relaxed ${
                  isDriver
                    ? 'bg-amber-500 text-slate-950 font-medium rounded-br-xs'
                    : isBot
                    ? 'bg-slate-900 border border-slate-800 text-slate-100 rounded-bl-xs'
                    : 'bg-blue-600/90 text-white rounded-bl-xs'
                }`}
              >
                {msg.mediaUrl && (
                  <div className="mb-2 rounded-lg overflow-hidden border border-black/10">
                    <img
                      src={msg.mediaUrl}
                      alt="Anexo enviado"
                      className="w-full max-h-48 object-cover"
                    />
                  </div>
                )}
                <div>{msg.content}</div>
                <div
                  className={`text-[10px] mt-1 text-right flex items-center justify-end gap-1 ${
                    isDriver ? 'text-amber-950/70' : 'text-slate-400'
                  }`}
                >
                  <span>
                    {new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {isDriver && <CheckCheck className="w-3 h-3" />}
                </div>
              </div>
            </div>
          );
        })}

        {/* Operator Typing Indicator */}
        {operatorTyping && (
          <div className="flex items-center gap-2 text-xs text-slate-400 italic py-1">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
            <span>Atendente digitando resposta...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 3. Balões interativos para as opções numéricas */}
      {quickOptions && ticket?.status === 'BOT_TRIAGE' && (
        <div className="p-2.5 bg-slate-900 border-t border-slate-800/80">
          <p className="text-[11px] font-semibold text-amber-400 mb-2 px-1">
            Toque para escolher uma opção rápida:
          </p>
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
            {quickOptions.map((opt) => (
              <button
                key={opt.num}
                onClick={() => handleSendMessage(opt.num)}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 border border-slate-700 text-xs text-slate-200 font-medium transition-all text-left shadow-sm active:scale-95 flex items-center gap-1.5"
              >
                <span className="w-5 h-5 rounded-md bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold text-[11px]">
                  {opt.num}
                </span>
                <span className="truncate max-w-[260px]">{opt.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 4. Bottom Input Bar */}
      <footer className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
        {/* Hidden Camera/File Input */}
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handleFileUpload}
          className="hidden"
        />

        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          title="Tirar foto ou anexar documento"
          className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors disabled:opacity-50 active:scale-95"
        >
          {uploading ? (
            <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
          ) : (
            <Camera className="w-5 h-5" />
          )}
        </button>

        <input
          type="text"
          placeholder="Digite sua mensagem ou o número..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSendMessage();
          }}
          className="flex-1 py-2.5 px-4 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
        />

        <button
          type="button"
          onClick={() => handleSendMessage()}
          disabled={!inputText.trim()}
          className="p-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 shadow-md shadow-amber-500/20"
        >
          <Send className="w-5 h-5" />
        </button>
      </footer>
    </div>
  );
}
