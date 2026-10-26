'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  extractImageFromClipboard,
  uploadChatImage
} from '@/lib/clipboardHelper';

export interface DriverChatMessage {
  id: string;
  senderType: 'DRIVER' | 'OPERATOR' | 'BOT' | 'SYSTEM';
  senderId?: string;
  content: string;
  mediaUrl?: string | null;
  createdAt: string | Date;
}

export interface DriverProfileData {
  driverId: string;
  tenantId: string;
  prefixo: string;
  name: string;
  phone: string;
  plate?: string;
}

export interface DriverTicketData {
  id: string;
  status: string;
  triageStep?: string;
  department?: { name: string };
  operator?: { name: string };
}

interface DriverChatMobileProps {
  driver: DriverProfileData | null;
  ticket: DriverTicketData | null;
  messages: DriverChatMessage[];
  connected: boolean;
  operatorTyping?: boolean;
  uploading?: boolean;
  onSendMessage: (text?: string, mediaUrl?: string) => void;
  onFileUpload: (file: File) => Promise<void>;
  onExitChat: () => void;
  showOptionsManual?: boolean;
  onToggleOptions?: () => void;
  quickOptions?: { num: string; text: string }[];
}

export default function DriverChatMobile({
  driver,
  ticket,
  messages,
  connected,
  operatorTyping = false,
  uploading: externalUploading = false,
  onSendMessage,
  onFileUpload,
  onExitChat,
  showOptionsManual = false,
  onToggleOptions,
  quickOptions = [],
}: DriverChatMobileProps) {
  const [inputText, setInputText] = useState('');
  const [localUploading, setLocalUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [pasteNotice, setPasteNotice] = useState(false);

  const isUploading = externalUploading || localUploading;

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, operatorTyping]);

  // Global and local paste handling (Ctrl + V / Colar)
  const processClipboardEvent = async (e: ClipboardEvent | React.ClipboardEvent) => {
    const file = await extractImageFromClipboard(e);
    if (!file) return;

    if (e.cancelable) e.preventDefault();
    setLocalUploading(true);
    setPasteNotice(true);

    try {
      const url = await uploadChatImage(file);
      if (url) {
        onSendMessage('Comprovante / Foto anexada', url);
      }
    } finally {
      setLocalUploading(false);
      setTimeout(() => setPasteNotice(false), 2000);
    }
  };

  // Window-level listener so paste works anywhere on the screen
  useEffect(() => {
    const handleWindowPaste = (e: ClipboardEvent) => {
      processClipboardEvent(e);
    };

    window.addEventListener('paste', handleWindowPaste);
    return () => window.removeEventListener('paste', handleWindowPaste);
  }, [onSendMessage]);

  const handleSend = () => {
    const text = inputText.trim();
    if (!text && !isUploading) return;
    onSendMessage(text);
    setInputText('');
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLocalUploading(true);
    try {
      await onFileUpload(file);
    } finally {
      setLocalUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div
      ref={chatContainerRef}
      onPaste={processClipboardEvent}
      className="flex flex-col h-screen w-full max-w-[390px] mx-auto border-x shadow-2xl overflow-hidden font-sans select-none"
      style={{
        backgroundColor: 'var(--bg-app)',
        borderColor: 'var(--border-subtle)',
        color: 'var(--text-main)',
      }}
    >
      {/* 1. CABEÇALHO WHITE-LABEL (390px mobile frame) */}
      <header
        className="flex items-center justify-between px-4 py-3 border-b shadow-sm sticky top-0 z-20 backdrop-blur-md"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="flex items-center gap-3">
          {/* Logo / Badge com a cor institucional do Tenant */}
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm tracking-wider shadow-md transition-transform hover:scale-105"
            style={{
              backgroundColor: 'var(--brand-primary)',
              color: 'var(--brand-primary-contrast)',
            }}
          >
            <span className="material-symbols-outlined text-xl">local_taxi</span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-tight" style={{ color: 'var(--text-main)' }}>
                Prefixo #{driver?.prefixo || '101'}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                ({driver?.name?.split(' ')[0] || 'Motorista'})
              </span>
            </div>

            {/* Indicador de Atendente Ativo e Status de Conexão */}
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className="w-2 h-2 rounded-full animate-pulse"
                style={{
                  backgroundColor: connected ? 'var(--brand-secondary)' : 'var(--brand-danger)',
                }}
              />
              <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
                {ticket?.operator?.name
                  ? `Atendente: ${ticket.operator.name}`
                  : connected
                  ? 'Conectado à Central'
                  : 'Reconectando...'}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={onExitChat}
          title="Encerrar Sessão"
          className="p-2 rounded-xl transition-colors hover:opacity-80 active:scale-95"
          style={{
            color: 'var(--text-muted)',
            backgroundColor: 'var(--brand-primary-light)',
          }}
        >
          <span className="material-symbols-outlined text-lg">logout</span>
        </button>
      </header>

      {/* SUB-HEADER: STATUS & TRIAGEM BUTTON */}
      <div
        className="px-4 py-2 border-b flex items-center justify-between text-xs backdrop-blur-sm"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Status:
          </span>
          {ticket?.status === 'BOT_TRIAGE' && (
            <span
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold text-[11px]"
              style={{
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                color: 'var(--brand-warning)',
              }}
            >
              <span className="material-symbols-outlined text-xs">smart_toy</span>
              Triagem Automática
            </span>
          )}
          {ticket?.status === 'WAITING_QUEUE' && (
            <span
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold text-[11px]"
              style={{
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                color: 'var(--brand-warning)',
              }}
            >
              <span className="material-symbols-outlined text-xs">schedule</span>
              Fila de Espera
            </span>
          )}
          {ticket?.status === 'IN_PROGRESS' && (
            <span
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold text-[11px]"
              style={{
                backgroundColor: 'rgba(0, 108, 73, 0.15)',
                color: 'var(--brand-secondary)',
              }}
            >
              <span className="material-symbols-outlined text-xs">support_agent</span>
              Em Atendimento
            </span>
          )}
          {(ticket?.status === 'RESOLVED' || ticket?.status === 'CLOSED') && (
            <span
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold text-[11px]"
              style={{
                backgroundColor: 'var(--brand-primary-light)',
                color: 'var(--brand-primary)',
              }}
            >
              <span className="material-symbols-outlined text-xs">check_circle</span>
              Concluído
            </span>
          )}
        </div>

        {onToggleOptions && (
          <button
            type="button"
            onClick={onToggleOptions}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-all active:scale-95"
            style={{
              backgroundColor: 'var(--brand-primary-light)',
              borderColor: 'var(--brand-primary)',
              color: 'var(--brand-primary)',
            }}
          >
            <span className="material-symbols-outlined text-xs">menu_book</span>
            <span>{showOptionsManual ? 'Fechar' : 'Ver Assuntos'}</span>
          </button>
        )}
      </div>

      {/* AVISO TEMPORÁRIO DE COLAGEM */}
      {pasteNotice && (
        <div
          className="py-1 px-3 text-center text-xs font-semibold animate-pulse"
          style={{
            backgroundColor: 'var(--brand-primary-light)',
            color: 'var(--brand-primary)',
          }}
        >
          Enviando imagem colada...
        </div>
      )}

      {/* 2. FEED DE MENSAGENS */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
        {messages.map((msg) => {
          const isDriver = msg.senderType === 'DRIVER';
          const isBot = msg.senderType === 'BOT';
          const isSystem = msg.senderType === 'SYSTEM';

          if (isSystem) {
            return (
              <div key={msg.id} className="flex justify-center my-2">
                <span
                  className="px-3.5 py-1 rounded-full border text-[11px] text-center max-w-[90%] shadow-sm"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-muted)',
                  }}
                >
                  {msg.content}
                </span>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isDriver ? 'items-end' : 'items-start'} animate-in fade-in-50 duration-200`}
            >
              {/* Nome do Remetente */}
              <div className="flex items-center gap-1 mb-1 px-1 text-[11px] font-semibold">
                {isDriver ? (
                  <span style={{ color: 'var(--text-muted)' }}>Você (#{driver?.prefixo || '101'})</span>
                ) : isBot ? (
                  <span className="flex items-center gap-1" style={{ color: 'var(--brand-primary)' }}>
                    <span className="material-symbols-outlined text-xs">smart_toy</span>
                    Assistente Automático
                  </span>
                ) : (
                  <span className="flex items-center gap-1" style={{ color: 'var(--brand-secondary)' }}>
                    <span className="material-symbols-outlined text-xs">support_agent</span>
                    {ticket?.operator?.name || 'Central Táxi'}
                  </span>
                )}
              </div>

              {/* Balão de Mensagem */}
              <div
                className={`max-w-[85%] rounded-3xl p-3.5 text-xs shadow-sm border transition-all ${
                  isDriver ? 'rounded-br-sm' : 'rounded-bl-sm'
                }`}
                style={
                  isDriver
                    ? {
                        backgroundColor: 'var(--bubble-driver-bg)',
                        color: 'var(--bubble-driver-text)',
                        borderColor: 'transparent',
                      }
                    : {
                        backgroundColor: 'var(--bubble-attendant-bg)',
                        color: 'var(--bubble-attendant-text)',
                        borderColor: 'var(--bubble-border)',
                      }
                }
              >
                {/* Balão com Anexo de Comprovante/Foto PIX */}
                {msg.mediaUrl && (
                  <div
                    onClick={() => setPreviewImage(msg.mediaUrl || null)}
                    className="mb-2 rounded-2xl overflow-hidden border cursor-pointer group"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <img
                      src={msg.mediaUrl}
                      alt="Comprovante / Anexo"
                      className="w-full max-h-56 object-cover transition-transform group-hover:scale-105"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                        const fallback = (e.target as HTMLElement).parentElement?.querySelector('.img-fallback');
                        if (fallback) fallback.classList.remove('hidden');
                      }}
                    />
                    <div
                      className="img-fallback hidden p-4 text-center text-xs"
                      style={{
                        backgroundColor: 'var(--brand-primary-light)',
                        color: 'var(--brand-primary)',
                      }}
                    >
                      <span className="material-symbols-outlined text-2xl block mb-1">receipt_long</span>
                      <span className="font-semibold">Comprovante / Foto PIX</span>
                    </div>
                  </div>
                )}

                {/* Texto da Mensagem */}
                <div className="font-normal leading-relaxed whitespace-pre-wrap select-text">
                  {msg.content}
                </div>

                {/* Horário e Confirmação */}
                <div
                  className="text-[10px] mt-1.5 flex items-center justify-end gap-1"
                  style={{
                    color: isDriver ? 'rgba(255, 255, 255, 0.85)' : 'var(--text-muted)',
                  }}
                >
                  <span>
                    {new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {isDriver && (
                    <span className="material-symbols-outlined text-xs">done_all</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Indicador de Atendente Digitando */}
        {operatorTyping && (
          <div
            className="flex items-center gap-1.5 text-xs italic py-1 px-2 animate-pulse"
            style={{ color: 'var(--brand-primary)' }}
          >
            <span className="material-symbols-outlined text-sm">edit</span>
            <span>Atendente digitando resposta...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 3. BALÕES INTERATIVOS / OPÇÕES DE TRIAGEM */}
      {quickOptions.length > 0 && (ticket?.status === 'BOT_TRIAGE' || showOptionsManual) && (
        <div
          className="p-3 border-t animate-in slide-in-from-bottom-2 duration-200"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-[11px] font-bold flex items-center gap-1" style={{ color: 'var(--brand-primary)' }}>
              <span className="material-symbols-outlined text-xs">list_alt</span>
              Escolha uma opção de atendimento:
            </p>
          </div>
          <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto pr-1">
            {quickOptions.map((opt) => (
              <button
                key={opt.num}
                type="button"
                onClick={() => onSendMessage(opt.num)}
                className="px-3 py-2 rounded-2xl border text-xs font-medium transition-all text-left shadow-sm active:scale-98 flex items-center gap-2.5 group"
                style={{
                  backgroundColor: 'var(--brand-primary-light)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--brand-primary)',
                }}
              >
                <span
                  className="w-6 h-6 rounded-xl flex items-center justify-center font-black text-xs shadow-sm"
                  style={{
                    backgroundColor: 'var(--brand-primary)',
                    color: 'var(--brand-primary-contrast)',
                  }}
                >
                  {opt.num}
                </span>
                <span className="truncate flex-1 font-semibold">{opt.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 4. BARRA DE MENSAGENS COM CÂMERA E ENVIO INSTITUCIONAL */}
      <footer
        className="p-3 border-t flex items-center gap-2 sticky bottom-0 z-20 backdrop-blur-md"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        {/* Input Oculto de Arquivo/Câmera */}
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handleFileInputChange}
          className="hidden"
        />

        {/* Botão de Câmera / Comprovante */}
        <button
          type="button"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
          title="Tirar foto ou anexar comprovante"
          className="p-3 rounded-2xl border transition-all active:scale-95 flex-shrink-0 disabled:opacity-50"
          style={{
            backgroundColor: 'var(--brand-primary-light)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--brand-primary)',
          }}
        >
          {isUploading ? (
            <span className="material-symbols-outlined animate-spin text-lg">sync</span>
          ) : (
            <span className="material-symbols-outlined text-lg">photo_camera</span>
          )}
        </button>

        {/* Campo de Texto com suporte a Ctrl + V */}
        <input
          type="text"
          placeholder="Digite ou cole (Ctrl + V)..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend();
          }}
          className="flex-1 py-3 px-4 border rounded-full text-xs outline-none transition-colors"
          style={{
            backgroundColor: 'var(--bg-app)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-main)',
          }}
        />

        {/* Botão de Envio Estilizado com var(--brand-primary) */}
        <button
          type="button"
          onClick={handleSend}
          disabled={!inputText.trim() && !isUploading}
          className="p-3 rounded-full font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 shadow-md flex-shrink-0"
          style={{
            backgroundColor: 'var(--brand-primary)',
            color: 'var(--brand-primary-contrast)',
          }}
        >
          <span className="material-symbols-outlined text-lg">send</span>
        </button>
      </footer>

      {/* LIGHTBOX MODAL DE ZOOM */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-sm max-h-[85vh]">
            <img
              src={previewImage}
              alt="Visualização ampliada"
              className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl"
            />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-3 -right-3 p-2 rounded-full text-white shadow-lg"
              style={{ backgroundColor: 'var(--brand-danger)' }}
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
