'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import {
  Send,
  Camera,
  LogOut,
  Car,
  CheckCheck,
  Bot,
  UserCheck,
  Loader2,
  Clock,
  CheckCircle2,
  Headphones,
  Image as ImageIcon,
  X,
  Sparkles
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

// Subtle pleasant chime using Web Audio API
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
  const [previewImage, setPreviewImage] = useState<string | null>(null);

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
            socket.emit('ticket:join', { ticketId: ticketData.ticket.id });
          });

          socket.on('disconnect', () => {
            setConnected(false);
          });

          const handleIncomingMsg = (msg: Message) => {
            setMessages((prev) => {
              // Deduplicate or replace optimistic temp message
              const exists = prev.some((m) => m.id === msg.id || (m.id.startsWith('temp-') && m.content === msg.content));
              if (exists) {
                return prev.map((m) => (m.id.startsWith('temp-') && m.content === msg.content ? msg : m));
              }
              return [...prev, msg];
            });

            if (msg.senderType === 'OPERATOR') {
              playSubtleNotificationSound();
            }
          };

          socket.on('new_message', handleIncomingMsg);
          socket.on('ticket:message', handleIncomingMsg);

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

    // 3-second heartbeat sync safety net in case mobile network drops WebSocket packets
    const syncInterval = setInterval(async () => {
      try {
        const sessionRes = await fetch('/api/auth/driver-session');
        const sessionData = await sessionRes.json();
        if (sessionData.authenticated && sessionData.token) {
          const ticketRes = await fetch('/api/tickets/driver-active', {
            headers: { Authorization: `Bearer ${sessionData.token}` },
          });
          const ticketData = await ticketRes.json();
          if (ticketData.ticket?.messages) {
            setMessages((prev) => {
              const incoming: Message[] = ticketData.ticket.messages;
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
    const text = (textToSend || inputText).trim();
    if (!text && !mediaUrl) return;
    if (!ticket) return;

    // Optimistic message append
    const tempMsg: Message = {
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
      socketRef.current.emit('message:send', {
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

  // Exit chat (supports native WebView bridges)
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
      <div className="h-screen bg-[#060b11] flex flex-col items-center justify-center p-6 text-center text-white">
        <div className="w-18 h-18 rounded-3xl bg-gradient-to-br from-[#ff5722] via-[#ff6b35] to-[#1e3a5f] p-0.5 mb-5 shadow-2xl shadow-[#ff5722]/30 animate-pulse">
          <div className="w-full h-full bg-[#0a111a] rounded-[22px] flex items-center justify-center font-black text-xl text-white">
            TX
          </div>
        </div>
        <p className="text-sm font-semibold text-white flex items-center gap-2 mb-2">
          <Loader2 className="w-4 h-4 animate-spin text-[#ff5722]" />
          Conectando à Central de Atendimento...
        </p>
        <span className="text-xs text-[#8a9ba8]">Identificando frota e permissões de acesso</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-[#0a111a] border-x border-white/[0.08] shadow-2xl overflow-hidden text-white font-sans antialiased">
      {/* 1. Header Premium TX */}
      <header className="flex items-center justify-between px-4 py-3 bg-[#101c2b]/95 border-b border-white/[0.08] backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#ff5722] via-[#ff6b35] to-[#1e3a5f] flex items-center justify-center font-black text-sm tracking-wider text-white shadow-lg shadow-[#ff5722]/20">
            TX
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white tracking-wide">
                Prefixo #{driver?.prefixo || '---'}
              </span>
              <span className="text-xs text-[#8a9ba8]">({driver?.name?.split(' ')[0]})</span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  connected ? 'bg-[#22c55e] animate-pulse' : 'bg-rose-500'
                }`}
              />
              <span className="text-[11px] font-medium text-[#8a9ba8]">
                {connected ? 'Conectado à Central' : 'Reconectando...'}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={handleExitChat}
          title="Encerrar Sessão"
          className="p-2 rounded-xl text-[#8a9ba8] hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      {/* Status Bar Sub-header */}
      <div className="bg-[#0d1724]/90 px-4 py-2 border-b border-white/[0.06] flex items-center justify-between text-xs backdrop-blur-sm">
        <div className="flex items-center gap-1.5">
          <span className="text-[#8a9ba8] text-[11px]">Status:</span>
          {ticket?.status === 'BOT_TRIAGE' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold text-[11px]">
              <Bot className="w-3 h-3 text-amber-400" />
              Triagem Automática
            </span>
          )}
          {ticket?.status === 'WAITING_QUEUE' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#ff5722]/15 border border-[#ff5722]/30 text-[#ff6b35] font-semibold text-[11px]">
              <Clock className="w-3 h-3 text-[#ff5722]" />
              Fila de Espera
            </span>
          )}
          {ticket?.status === 'IN_PROGRESS' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold text-[11px]">
              <Headphones className="w-3 h-3 text-emerald-400" />
              Atendimento Humano
            </span>
          )}
          {ticket?.status === 'RESOLVED' || ticket?.status === 'CLOSED' ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 font-semibold text-[11px]">
              <CheckCircle2 className="w-3 h-3 text-blue-400" />
              Concluído
            </span>
          ) : null}
        </div>

        {ticket?.operator?.name && (
          <span className="text-emerald-400 font-semibold truncate max-w-[150px] text-[11px]">
            {ticket.operator.name}
          </span>
        )}
      </div>

      {/* 2. Messages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#0a111a]">
        {messages.map((msg) => {
          const isDriver = msg.senderType === 'DRIVER';
          const isBot = msg.senderType === 'BOT';
          const isSystem = msg.senderType === 'SYSTEM';

          if (isSystem) {
            return (
              <div key={msg.id} className="flex justify-center my-2">
                <span className="px-3.5 py-1 rounded-full bg-[#101c2b] border border-white/[0.08] text-[11px] text-[#8a9ba8] text-center max-w-[90%] shadow-sm">
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
              <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] font-medium text-[#8a9ba8]">
                {isBot && (
                  <>
                    <Bot className="w-3.5 h-3.5 text-[#ff5722]" />
                    <span className="text-[#ff5722] font-semibold">Assistente Virtual TX</span>
                  </>
                )}
                {!isDriver && !isBot && (
                  <>
                    <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-cyan-400 font-semibold">
                      {ticket?.operator?.name || 'Atendente da Central'}
                    </span>
                  </>
                )}
                {isDriver && <span>Você (#{driver?.prefixo})</span>}
              </div>

              {/* Message Bubble */}
              <div
                className={`max-w-[88%] rounded-3xl px-4 py-3 text-sm shadow-md whitespace-pre-wrap leading-relaxed ${
                  isDriver
                    ? 'bg-gradient-to-r from-[#ff5722] to-[#ff6b35] text-white font-medium rounded-br-xs shadow-[#ff5722]/20'
                    : isBot
                    ? 'bg-[#101c2b] border border-white/[0.08] text-slate-100 rounded-bl-xs'
                    : 'bg-[#132338] border border-[#1e3a5f]/80 text-white rounded-bl-xs'
                }`}
              >
                {/* Imagem / Anexo com tratamento elegante */}
                {msg.mediaUrl && (
                  <div
                    onClick={() => setPreviewImage(msg.mediaUrl || null)}
                    className="mb-2.5 rounded-2xl overflow-hidden border border-white/[0.1] bg-black/20 cursor-pointer relative group"
                  >
                    <img
                      src={msg.mediaUrl}
                      alt="Anexo enviado"
                      className="w-full max-h-56 object-cover transition-transform group-hover:scale-105"
                      onError={(e) => {
                        // Fallback elegante caso a URL seja inválida ou remota
                        (e.target as HTMLElement).style.display = 'none';
                        const fallback = (e.target as HTMLElement).parentElement?.querySelector('.img-fallback');
                        if (fallback) fallback.classList.remove('hidden');
                      }}
                    />
                    <div className="img-fallback hidden p-4 text-center bg-[#172535] text-[#8a9ba8] text-xs">
                      <ImageIcon className="w-6 h-6 mx-auto mb-1 text-[#ff5722]" />
                      <span>Comprovante / Imagem Anexada</span>
                    </div>
                  </div>
                )}

                <div className="text-sm font-normal">{msg.content}</div>

                <div
                  className={`text-[10px] mt-1.5 text-right flex items-center justify-end gap-1.5 ${
                    isDriver ? 'text-white/80' : 'text-[#8a9ba8]'
                  }`}
                >
                  <span>
                    {new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {isDriver && <CheckCheck className="w-3.5 h-3.5 text-white/90" />}
                </div>
              </div>
            </div>
          );
        })}

        {/* Operator Typing Indicator */}
        {operatorTyping && (
          <div className="flex items-center gap-2 text-xs text-cyan-400 italic py-1 px-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>Atendente digitando resposta...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 3. Balões interativos para as opções numéricas da triagem */}
      {quickOptions && ticket?.status === 'BOT_TRIAGE' && (
        <div className="p-3 bg-[#101c2b] border-t border-white/[0.08]">
          <p className="text-[11px] font-semibold text-amber-400 mb-2 px-1 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Toque para escolher uma opção rápida:
          </p>
          <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
            {quickOptions.map((opt) => (
              <button
                key={opt.num}
                onClick={() => handleSendMessage(opt.num)}
                className="px-3 py-2 rounded-2xl bg-[#142030] hover:bg-[#ff5722] hover:text-white border border-white/[0.08] hover:border-[#ff5722] text-xs text-slate-200 font-medium transition-all text-left shadow-sm active:scale-98 flex items-center gap-2.5 group"
              >
                <span className="w-6 h-6 rounded-xl bg-[#ff5722]/20 text-[#ff5722] group-hover:bg-white group-hover:text-[#ff5722] flex items-center justify-center font-black text-xs transition-colors">
                  {opt.num}
                </span>
                <span className="truncate flex-1">{opt.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 4. Bottom Input Bar */}
      <footer className="p-3 bg-[#101c2b]/95 border-t border-white/[0.08] flex items-center gap-2">
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
          title="Tirar foto ou anexar comprovante"
          className="p-3 rounded-2xl bg-[#172535] hover:bg-[#1e3a5f] text-[#8a9ba8] hover:text-white border border-white/[0.06] transition-all disabled:opacity-50 active:scale-95 flex-shrink-0"
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin text-[#ff5722]" />
          ) : (
            <Camera className="w-4 h-4" />
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
          className="flex-1 py-3 px-4 bg-[#0a111a] border border-white/[0.08] focus:border-[#ff5722] rounded-full text-xs text-white placeholder-[#8a9ba8] outline-none transition-colors"
        />

        <button
          type="button"
          onClick={() => handleSendMessage()}
          disabled={!inputText.trim()}
          className="p-3 rounded-full bg-gradient-to-r from-[#ff5722] to-[#ff6b35] text-white font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 shadow-md shadow-[#ff5722]/25 flex-shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </footer>

      {/* Lightbox Modal de Imagem */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4"
        >
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={previewImage}
            alt="Preview Anexo"
            className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl object-contain"
          />
        </div>
      )}
    </div>
  );
}
