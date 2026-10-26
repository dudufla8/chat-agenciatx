'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  extractImageFromClipboard,
  uploadChatImage
} from '@/lib/clipboardHelper';

export interface AttendantOperator {
  userId: string;
  name: string;
  email: string;
  role: string;
}

export interface AttendantDriver {
  prefixo: string;
  name: string;
  phone: string;
  plate?: string;
  model?: string;
  status?: string;
  latitude?: string | null;
  longitude?: string | null;
  positionDate?: string | null;
}

export interface AttendantTicket {
  id: string;
  status: 'BOT_TRIAGE' | 'WAITING_QUEUE' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority?: 'URGENTE' | 'NORMAL';
  department?: { id: string; name: string };
  operator?: { id: string; name: string };
  driver: AttendantDriver;
  createdAt: string;
  updatedAt: string;
  messages?: any[];
  internalNotes?: string | null;
}

export interface AttendantCanned {
  id: string;
  shortcut: string;
  title: string;
  content: string;
}

interface AttendantDashboardProps {
  operator: AttendantOperator | null;
  tickets: AttendantTicket[];
  activeTicket: AttendantTicket | null;
  messages: any[];
  cannedResponses?: AttendantCanned[];
  onSelectTicket: (ticket: AttendantTicket) => void;
  onSendMessage: (text: string, mediaUrl?: string) => void;
  onClaimTicket: (ticketId: string) => void;
  onCloseTicket: (ticketId: string) => void;
  onTransferTicket?: (ticketId: string, departmentId: string) => void;
  onSaveNotes?: (ticketId: string, notes: string) => void;
  onOpenAdmin?: (view: 'flowbuilder' | 'team' | 'queues') => void;
  onLogout?: () => void;
  cooperativeName?: string;
  departments?: { id: string; name: string }[];
}

export default function AttendantDashboard({
  operator,
  tickets = [],
  activeTicket,
  messages = [],
  cannedResponses = [
    { id: '1', shortcut: '/pix', title: 'Chave PIX', content: 'Nossa chave PIX oficial da Cooperativa é: financeiro@taxidigital.com.br' },
    { id: '2', shortcut: '/docs', title: 'Documentos', content: 'Por favor, envie uma foto nítida do seu CRLV e CNH para atualizarmos seu cadastro.' },
    { id: '3', shortcut: '/corrida', title: 'Status Corrida', content: 'Localizamos a sua corrida no sistema. Já estamos validando os dados com o cliente.' },
    { id: '4', shortcut: '/espera', title: 'Fila de Espera', content: 'Aguarde um momento, estamos concluindo a verificação com o setor operacional.' },
  ],
  onSelectTicket,
  onSendMessage,
  onClaimTicket,
  onCloseTicket,
  onTransferTicket,
  onSaveNotes,
  onOpenAdmin,
  onLogout,
  cooperativeName = 'Cooperativa Táxi Digital',
  departments = [],
}: AttendantDashboardProps) {
  // Navigation / Tabs in Column 1 & 2
  const [activeTab, setActiveTab] = useState<'ativos' | 'fila' | 'slas'>('ativos');
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | 'URGENTE' | 'NORMAL'>('ALL');

  // Chat message input & upload
  const [inputText, setInputText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [pasteNotice, setPasteNotice] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Notes & Modals
  const [internalNotes, setInternalNotes] = useState(activeTicket?.internalNotes || '');
  const [notesSaved, setNotesSaved] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [targetDept, setTargetDept] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync internal notes with active ticket
  useEffect(() => {
    setInternalNotes(activeTicket?.internalNotes || '');
  }, [activeTicket]);

  // Scroll feed to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Unified Clipboard Paste Handler (Ctrl + V / Colar)
  const processPaste = async (e: ClipboardEvent | React.ClipboardEvent) => {
    if (!activeTicket) return;

    const file = await extractImageFromClipboard(e);
    if (!file) return;

    if (e.cancelable) e.preventDefault();
    setUploading(true);
    setPasteNotice(true);

    try {
      const url = await uploadChatImage(file);
      if (url) {
        onSendMessage('Comprovante / Anexo enviado pelo atendente', url);
      }
    } finally {
      setUploading(false);
      setTimeout(() => setPasteNotice(false), 2000);
    }
  };

  // Window-level listener for desktop convenience
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      processPaste(e);
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [activeTicket]);

  const handleSend = () => {
    const text = inputText.trim();
    if (!text && !uploading) return;
    onSendMessage(text);
    setInputText('');
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeTicket) return;

    setUploading(true);
    try {
      const url = await uploadChatImage(file);
      if (url) {
        onSendMessage('Comprovante / Anexo enviado pelo atendente', url);
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Filter conversations
  const filteredTickets = tickets.filter((t) => {
    const term = searchTerm.toLowerCase();
    const matchSearch =
      t.driver.name.toLowerCase().includes(term) ||
      t.driver.prefixo.includes(term) ||
      (t.driver.plate && t.driver.plate.toLowerCase().includes(term));

    if (!matchSearch) return false;

    if (priorityFilter !== 'ALL') {
      const p = t.priority || 'NORMAL';
      if (p !== priorityFilter) return false;
    }

    if (activeTab === 'ativos') {
      return t.status === 'IN_PROGRESS';
    }
    if (activeTab === 'fila') {
      return t.status === 'WAITING_QUEUE' || t.status === 'BOT_TRIAGE';
    }
    return true;
  });

  // Calculate metrics
  const waitingCount = tickets.filter((t) => t.status === 'WAITING_QUEUE' || t.status === 'BOT_TRIAGE').length;
  const inProgressCount = tickets.filter((t) => t.status === 'IN_PROGRESS').length;

  return (
    <div
      onPaste={processPaste}
      className="flex h-screen w-full overflow-hidden font-sans select-none"
      style={{
        backgroundColor: 'var(--bg-app)',
        color: 'var(--text-main)',
      }}
    >
      {/* ========================================================================= */}
      {/* COLUNA 1: SIDEBAR (240px)                                                 */}
      {/* Identidade da Cooperativa, Conversas Ativas, Fila e Métricas de SLA        */}
      {/* ========================================================================= */}
      <aside
        className="w-[240px] flex-shrink-0 flex flex-col justify-between border-r shadow-sm z-30"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div>
          {/* Identidade da Cooperativa (White-Label Brand) */}
          <div
            className="p-4 border-b flex items-center gap-3"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm shadow-md transition-transform hover:scale-105"
              style={{
                backgroundColor: 'var(--brand-primary)',
                color: 'var(--brand-primary-contrast)',
              }}
            >
              <span className="material-symbols-outlined text-2xl">local_taxi</span>
            </div>
            <div className="overflow-hidden">
              <h1 className="text-xs font-bold truncate leading-tight" style={{ color: 'var(--text-main)' }}>
                {cooperativeName}
              </h1>
              <span className="text-[10px] font-semibold" style={{ color: 'var(--brand-secondary)' }}>
                ● Central Operacional
              </span>
            </div>
          </div>

          {/* Navegação entre Conversas Ativas, Fila e SLA */}
          <nav className="p-3 space-y-1">
            <button
              onClick={() => setActiveTab('ativos')}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all"
              style={
                activeTab === 'ativos'
                  ? {
                      backgroundColor: 'var(--brand-primary-light)',
                      color: 'var(--brand-primary)',
                    }
                  : {
                      color: 'var(--text-muted)',
                      backgroundColor: 'transparent',
                    }
              }
            >
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-base">chat</span>
                <span>Conversas Ativas</span>
              </div>
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{
                  backgroundColor: 'var(--brand-primary)',
                  color: 'var(--brand-primary-contrast)',
                }}
              >
                {inProgressCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('fila')}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all"
              style={
                activeTab === 'fila'
                  ? {
                      backgroundColor: 'var(--brand-primary-light)',
                      color: 'var(--brand-primary)',
                    }
                  : {
                      color: 'var(--text-muted)',
                      backgroundColor: 'transparent',
                    }
              }
            >
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-base">hourglass_top</span>
                <span>Fila de Espera</span>
              </div>
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{
                  backgroundColor: 'var(--brand-warning)',
                  color: '#ffffff',
                }}
              >
                {waitingCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('slas')}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all"
              style={
                activeTab === 'slas'
                  ? {
                      backgroundColor: 'var(--brand-primary-light)',
                      color: 'var(--brand-primary)',
                    }
                  : {
                      color: 'var(--text-muted)',
                      backgroundColor: 'transparent',
                    }
              }
            >
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-base">timer</span>
                <span>Métricas de SLA</span>
              </div>
              <span className="text-[10px]" style={{ color: 'var(--brand-secondary)' }}>
                98%
              </span>
            </button>
          </nav>

          {/* Cards de Métricas de Atendimento */}
          <div className="px-3 pt-3 space-y-2">
            <div
              className="p-3 rounded-2xl border text-xs"
              style={{
                backgroundColor: 'var(--bg-app)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>
                Tempo Médio de Resposta
              </span>
              <div className="flex items-center justify-between">
                <span className="text-base font-black" style={{ color: 'var(--brand-primary)' }}>
                  1m 15s
                </span>
                <span className="material-symbols-outlined text-sm" style={{ color: 'var(--brand-secondary)' }}>
                  trending_up
                </span>
              </div>
            </div>

            <div
              className="p-3 rounded-2xl border text-xs"
              style={{
                backgroundColor: 'var(--bg-app)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>
                SLA em Risco (&gt;5m)
              </span>
              <div className="flex items-center justify-between">
                <span className="text-base font-black" style={{ color: 'var(--brand-warning)' }}>
                  0 chamados
                </span>
                <span className="material-symbols-outlined text-sm" style={{ color: 'var(--brand-warning)' }}>
                  alarm
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Ferramentas de Gestão Multi-Tenant */}
        {onOpenAdmin && (
          <div className="p-3 border-t space-y-1.5" style={{ borderColor: 'var(--border-subtle)' }}>
            <button
              type="button"
              onClick={() => onOpenAdmin('flowbuilder')}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold border transition-all hover:opacity-85"
              style={{
                backgroundColor: 'var(--brand-primary-light)',
                borderColor: 'var(--brand-primary)',
                color: 'var(--brand-primary)',
              }}
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base">smart_toy</span>
                <span>Configurar Bot</span>
              </div>
              <span className="text-[10px] font-bold">Auto</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenAdmin('team')}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold border transition-all hover:opacity-85"
              style={{
                backgroundColor: 'var(--bg-app)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-main)',
              }}
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base">group</span>
                <span>Equipe & Acessos</span>
              </div>
              <span className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>Gestão</span>
            </button>
          </div>
        )}

        {/* Rodapé do Atendente */}
        <div
          className="p-3 border-t flex items-center justify-between"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs"
              style={{
                backgroundColor: 'var(--brand-primary)',
                color: 'var(--brand-primary-contrast)',
              }}
            >
              {operator?.name?.slice(0, 1) || 'A'}
            </div>
            <div className="overflow-hidden">
              <span className="text-xs font-bold block truncate" style={{ color: 'var(--text-main)' }}>
                {operator?.name || 'Atendente'}
              </span>
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                {operator?.role || 'Operador Central'}
              </span>
            </div>
          </div>

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              title="Encerrar Sessão"
              className="p-1.5 rounded-xl hover:opacity-80 transition-colors"
              style={{ color: 'var(--text-muted)' }}
            >
              <span className="material-symbols-outlined text-lg">logout</span>
            </button>
          )}
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* COLUNA 2: LISTA DE CONVERSAS (320px)                                      */}
      {/* Busca por prefixo/motorista, tags de prioridade e status em trânsito     */}
      {/* ========================================================================= */}
      <section
        className="w-[320px] flex-shrink-0 flex flex-col border-r shadow-sm z-20"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        {/* Campo de Busca & Filtros */}
        <div className="p-3 border-b space-y-2.5" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="relative">
            <span
              className="material-symbols-outlined text-base absolute left-3 top-2.5"
              style={{ color: 'var(--text-muted)' }}
            >
              search
            </span>
            <input
              type="text"
              placeholder="Buscar por prefixo, motorista ou placa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border rounded-xl text-xs outline-none transition-colors"
              style={{
                backgroundColor: 'var(--bg-app)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-main)',
              }}
            />
          </div>

          {/* Tags de Prioridade ('Todos', 'Urgente', 'Normal') */}
          <div className="flex gap-1.5">
            <button
              onClick={() => setPriorityFilter('ALL')}
              className="flex-1 py-1 rounded-lg text-[11px] font-semibold transition-all border"
              style={
                priorityFilter === 'ALL'
                  ? {
                      backgroundColor: 'var(--brand-primary)',
                      color: 'var(--brand-primary-contrast)',
                      borderColor: 'var(--brand-primary)',
                    }
                  : {
                      backgroundColor: 'var(--bg-app)',
                      color: 'var(--text-muted)',
                      borderColor: 'var(--border-subtle)',
                    }
              }
            >
              Todos
            </button>
            <button
              onClick={() => setPriorityFilter('URGENTE')}
              className="flex-1 py-1 rounded-lg text-[11px] font-semibold transition-all border"
              style={
                priorityFilter === 'URGENTE'
                  ? {
                      backgroundColor: 'var(--brand-danger)',
                      color: '#ffffff',
                      borderColor: 'var(--brand-danger)',
                    }
                  : {
                      backgroundColor: 'var(--bg-app)',
                      color: 'var(--brand-danger)',
                      borderColor: 'var(--border-subtle)',
                    }
              }
            >
              Urgente
            </button>
            <button
              onClick={() => setPriorityFilter('NORMAL')}
              className="flex-1 py-1 rounded-lg text-[11px] font-semibold transition-all border"
              style={
                priorityFilter === 'NORMAL'
                  ? {
                      backgroundColor: 'var(--brand-secondary)',
                      color: '#ffffff',
                      borderColor: 'var(--brand-secondary)',
                    }
                  : {
                      backgroundColor: 'var(--bg-app)',
                      color: 'var(--brand-secondary)',
                      borderColor: 'var(--border-subtle)',
                    }
              }
            >
              Normal
            </button>
          </div>
        </div>

        {/* Lista de Chamados */}
        <div className="flex-1 overflow-y-auto divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
          {filteredTickets.length === 0 ? (
            <div className="p-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
              <span className="material-symbols-outlined text-3xl block mb-2 opacity-40">inbox</span>
              Nenhuma conversa encontrada nesta fila.
            </div>
          ) : (
            filteredTickets.map((t) => {
              const isSelected = activeTicket?.id === t.id;
              const isUrgent = t.priority === 'URGENTE';
              const lastMsg = t.messages?.[t.messages.length - 1]?.content || 'Atendimento iniciado';

              return (
                <div
                  key={t.id}
                  onClick={() => onSelectTicket(t)}
                  className="p-3 cursor-pointer transition-colors border-l-4"
                  style={{
                    backgroundColor: isSelected ? 'var(--brand-primary-light)' : 'transparent',
                    borderLeftColor: isSelected
                      ? 'var(--brand-primary)'
                      : isUrgent
                      ? 'var(--brand-danger)'
                      : 'transparent',
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold" style={{ color: 'var(--text-main)' }}>
                        #{t.driver.prefixo}
                      </span>
                      <span className="text-xs font-semibold truncate max-w-[120px]" style={{ color: 'var(--text-muted)' }}>
                        {t.driver.name.split(' ')[0]}
                      </span>
                    </div>
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {new Date(t.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Status em trânsito e última mensagem */}
                  <p className="text-[11px] truncate leading-tight mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {lastMsg}
                  </p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {/* Status de Telemetria Táxi Digital (Livre / Ocupado / Passageiro) */}
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded font-bold"
                        style={{
                          backgroundColor:
                            t.driver.status === 'LIVRE'
                              ? 'rgba(0, 108, 73, 0.15)'
                              : t.driver.status === 'PASSAGEIRO'
                              ? 'rgba(0, 74, 198, 0.15)'
                              : 'rgba(245, 158, 11, 0.15)',
                          color:
                            t.driver.status === 'LIVRE'
                              ? 'var(--brand-secondary)'
                              : t.driver.status === 'PASSAGEIRO'
                              ? 'var(--brand-primary)'
                              : 'var(--brand-warning)',
                        }}
                      >
                        {t.driver.status || 'EM TRÂNSITO'}
                      </span>

                      {/* Tag de Prioridade */}
                      {isUrgent && (
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded font-bold"
                          style={{
                            backgroundColor: 'rgba(239, 68, 68, 0.15)',
                            color: 'var(--brand-danger)',
                          }}
                        >
                          URGENTE
                        </span>
                      )}
                    </div>

                    {t.driver.plate && (
                      <span className="text-[10px] font-mono font-bold" style={{ color: 'var(--text-muted)' }}>
                        {t.driver.plate}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* COLUNA 3: CHAT CENTRAL E FICHA LATERAL                                   */}
      {/* Feed com telemetria automática, respostas rápidas e ficha do veículo      */}
      {/* ========================================================================= */}
      <main className="flex-1 flex overflow-hidden">
        {/* Painel Central de Mensagens */}
        <div
          className="flex-1 flex flex-col justify-between border-r"
          style={{
            backgroundColor: 'var(--bg-app)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          {activeTicket ? (
            <>
              {/* Topo do Chat Ativo */}
              <header
                className="p-3.5 border-b flex items-center justify-between shadow-sm"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm shadow-sm"
                    style={{
                      backgroundColor: 'var(--brand-primary)',
                      color: 'var(--brand-primary-contrast)',
                    }}
                  >
                    #{activeTicket.driver.prefixo}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold" style={{ color: 'var(--text-main)' }}>
                        {activeTicket.driver.name}
                      </span>
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                        style={{
                          backgroundColor: 'var(--brand-primary-light)',
                          color: 'var(--brand-primary)',
                        }}
                      >
                        {activeTicket.department?.name || 'Geral'}
                      </span>
                    </div>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Placa: {activeTicket.driver.plate || 'N/A'} • Tel: {activeTicket.driver.phone || 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Botão Assumir / Encerrar Chamado */}
                  {activeTicket.status !== 'IN_PROGRESS' ? (
                    <button
                      onClick={() => onClaimTicket(activeTicket.id)}
                      className="py-2 px-3.5 rounded-xl font-bold text-xs shadow-sm flex items-center gap-1.5 transition-all"
                      style={{
                        backgroundColor: 'var(--brand-primary)',
                        color: 'var(--brand-primary-contrast)',
                      }}
                    >
                      <span className="material-symbols-outlined text-sm">front_hand</span>
                      <span>Assumir Chamado</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => onCloseTicket(activeTicket.id)}
                      className="py-2 px-3.5 rounded-xl font-bold text-xs border transition-all"
                      style={{
                        backgroundColor: 'var(--bg-card)',
                        borderColor: 'var(--brand-secondary)',
                        color: 'var(--brand-secondary)',
                      }}
                    >
                      <span className="material-symbols-outlined text-sm">check_circle</span>
                      <span>Resolver / Encerrar</span>
                    </button>
                  )}
                </div>
              </header>

              {/* Banner de Telemetria Automática da Táxi Digital */}
              <div
                className="px-4 py-2 border-b flex items-center justify-between text-xs"
                style={{
                  backgroundColor: 'var(--brand-primary-light)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--brand-primary)',
                }}
              >
                <div className="flex items-center gap-2 font-medium">
                  <span className="material-symbols-outlined text-base">my_location</span>
                  <span>
                    Telemetria Táxi Digital: Status <strong>{activeTicket.driver.status || 'Ativo'}</strong>
                    {activeTicket.driver.latitude && ` • GPS (${activeTicket.driver.latitude}, ${activeTicket.driver.longitude})`}
                  </span>
                </div>
                <span className="text-[11px] font-semibold">Tempo Real</span>
              </div>

              {/* Feed de Mensagens */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                {messages.map((m) => {
                  const isDriver = m.senderType === 'DRIVER';

                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isDriver ? 'items-start' : 'items-end'}`}
                    >
                      <span className="text-[10px] mb-1 px-1 font-semibold" style={{ color: 'var(--text-muted)' }}>
                        {isDriver ? `Motorista (#${activeTicket.driver.prefixo})` : 'Você (Central)'}
                      </span>

                      <div
                        className={`max-w-[75%] rounded-3xl p-3.5 text-xs shadow-sm border ${
                          isDriver ? 'rounded-bl-sm' : 'rounded-br-sm'
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
                        {m.mediaUrl && (
                          <div
                            onClick={() => setPreviewImage(m.mediaUrl)}
                            className="mb-2 rounded-2xl overflow-hidden border cursor-pointer"
                            style={{ borderColor: 'var(--border-subtle)' }}
                          >
                            <img
                              src={m.mediaUrl}
                              alt="Anexo enviado"
                              className="w-full max-h-60 object-cover hover:scale-105 transition-transform"
                            />
                          </div>
                        )}

                        <div className="whitespace-pre-wrap leading-relaxed select-text font-normal">
                          {m.content}
                        </div>

                        <div
                          className="text-[10px] mt-1.5 flex items-center justify-end gap-1"
                          style={{
                            color: isDriver ? 'rgba(255,255,255,0.85)' : 'var(--text-muted)',
                          }}
                        >
                          <span>
                            {new Date(m.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {!isDriver && (
                            <span className="material-symbols-outlined text-xs">done_all</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Respostas Rápidas (1-Clique) */}
              <div
                className="px-3 py-2 border-t flex items-center gap-1.5 overflow-x-auto"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <span className="text-[11px] font-bold shrink-0" style={{ color: 'var(--text-muted)' }}>
                  Respostas Rápidas:
                </span>
                {cannedResponses.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onSendMessage(c.content)}
                    className="py-1 px-2.5 rounded-full border text-[11px] font-medium shrink-0 transition-colors hover:opacity-80"
                    style={{
                      backgroundColor: 'var(--brand-primary-light)',
                      borderColor: 'var(--border-subtle)',
                      color: 'var(--brand-primary)',
                    }}
                  >
                    {c.title}
                  </button>
                ))}
              </div>

              {/* Barra de Envio com Suporte Total a Ctrl + V */}
              <footer
                className="p-3 border-t flex items-center gap-2"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <input
                  type="file"
                  accept="image/*,.pdf"
                  ref={fileInputRef}
                  onChange={handleFileInputChange}
                  className="hidden"
                />

                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  title="Anexar comprovante ou documento"
                  className="p-3 rounded-2xl border transition-all active:scale-95 flex-shrink-0 disabled:opacity-50"
                  style={{
                    backgroundColor: 'var(--brand-primary-light)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--brand-primary)',
                  }}
                >
                  <span className="material-symbols-outlined text-lg">attach_file</span>
                </button>

                <input
                  type="text"
                  placeholder="Digite sua resposta ou cole uma foto (Ctrl + V)..."
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

                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!inputText.trim() && !uploading}
                  className="p-3 rounded-full font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 shadow-md flex-shrink-0"
                  style={{
                    backgroundColor: 'var(--brand-primary)',
                    color: 'var(--brand-primary-contrast)',
                  }}
                >
                  <span className="material-symbols-outlined text-lg">send</span>
                </button>
              </footer>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center" style={{ color: 'var(--text-muted)' }}>
              <div
                className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4"
                style={{ backgroundColor: 'var(--brand-primary-light)', color: 'var(--brand-primary)' }}
              >
                <span className="material-symbols-outlined text-3xl">chat_bubble_outline</span>
              </div>
              <h3 className="text-base font-bold mb-1" style={{ color: 'var(--text-main)' }}>
                Selecione uma conversa ao lado
              </h3>
              <p className="text-xs max-w-sm">
                Escolha um chamado na fila de espera ou em andamento para visualizar o histórico de mensagens, telemetria e ficha do veículo.
              </p>
            </div>
          )}
        </div>

        {/* Ficha Lateral (Dados do Veículo e Localização GPS) */}
        {activeTicket && (
          <aside
            className="w-[280px] flex-shrink-0 flex flex-col justify-between p-4 border-l overflow-y-auto"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <div className="space-y-4">
              {/* Header da Ficha */}
              <div className="pb-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--brand-primary)' }}>
                  Ficha do Veículo & Motorista
                </h4>
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  Dados oficiais validados na frota
                </span>
              </div>

              {/* Informações Estruturadas */}
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center">
                  <span style={{ color: 'var(--text-muted)' }}>Prefixo:</span>
                  <span className="font-bold text-sm" style={{ color: 'var(--brand-primary)' }}>
                    #{activeTicket.driver.prefixo}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span style={{ color: 'var(--text-muted)' }}>Motorista:</span>
                  <span className="font-semibold" style={{ color: 'var(--text-main)' }}>
                    {activeTicket.driver.name}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span style={{ color: 'var(--text-muted)' }}>Placa Mercosul:</span>
                  <span
                    className="font-mono font-bold px-2 py-0.5 rounded border"
                    style={{
                      backgroundColor: 'var(--brand-primary-light)',
                      borderColor: 'var(--brand-primary)',
                      color: 'var(--brand-primary)',
                    }}
                  >
                    {activeTicket.driver.plate || 'BRA-2E19'}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span style={{ color: 'var(--text-muted)' }}>Modelo do Veículo:</span>
                  <span className="font-semibold" style={{ color: 'var(--text-main)' }}>
                    {activeTicket.driver.model || 'Toyota Corolla Sedan'}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span style={{ color: 'var(--text-muted)' }}>Telefone:</span>
                  <span className="font-mono font-semibold" style={{ color: 'var(--text-main)' }}>
                    {activeTicket.driver.phone || 'N/A'}
                  </span>
                </div>
              </div>

              {/* Localização GPS em Tempo Real */}
              <div
                className="p-3 rounded-2xl border space-y-1.5"
                style={{
                  backgroundColor: 'var(--bg-app)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: 'var(--brand-secondary)' }}>
                  <span className="material-symbols-outlined text-sm">location_on</span>
                  <span>Localização GPS</span>
                </div>
                <p className="text-[11px] leading-tight" style={{ color: 'var(--text-muted)' }}>
                  Lat: {activeTicket.driver.latitude || '-23.5505'} | Long: {activeTicket.driver.longitude || '-46.6333'}
                </p>
                <a
                  href={`https://www.google.com/maps?q=${activeTicket.driver.latitude || '-23.5505'},${activeTicket.driver.longitude || '-46.6333'}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-bold transition-all hover:underline"
                  style={{ color: 'var(--brand-primary)' }}
                >
                  <span>Abrir no Google Maps</span>
                  <span className="material-symbols-outlined text-xs">open_in_new</span>
                </a>
              </div>

              {/* Link de Acesso WhatsApp do Motorista */}
              <div className="pt-2 border-t space-y-2" style={{ borderColor: 'var(--border-subtle)' }}>
                <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--brand-primary)' }}>
                  Link Direto de Atendimento
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const domain = typeof window !== 'undefined' ? window.location.origin : 'https://chat.agenciatx.ia.br';
                    const url = `${domain}/driver/login?prefixo=${activeTicket.driver.prefixo}&placa=${encodeURIComponent(activeTicket.driver.plate || '')}`;
                    navigator.clipboard.writeText(url);
                    setLinkCopied(true);
                    setTimeout(() => setLinkCopied(false), 3000);
                  }}
                  className="w-full py-2 px-3 rounded-xl border font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm"
                  style={{
                    backgroundColor: 'var(--brand-primary-light)',
                    borderColor: 'var(--brand-primary)',
                    color: 'var(--brand-primary)',
                  }}
                >
                  <span className="material-symbols-outlined text-sm">content_copy</span>
                  <span>{linkCopied ? '✓ Link Copiado!' : 'Copiar Link WhatsApp'}</span>
                </button>

                {activeTicket.driver.phone && (
                  <a
                    href={`https://wa.me/55${activeTicket.driver.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                      `Olá ${activeTicket.driver.name.split(' ')[0]}! Para falar com nossa Central pelo chat da frota, acesse o link: https://chat.agenciatx.ia.br/driver/login?prefixo=${activeTicket.driver.prefixo}&placa=${activeTicket.driver.plate || ''}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-1.5 px-3 rounded-xl border text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors text-center"
                    style={{
                      backgroundColor: 'var(--bg-app)',
                      borderColor: 'var(--border-subtle)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <span>Abrir WhatsApp Web →</span>
                  </a>
                )}
              </div>

              {/* Notas Internas Confidenciais */}
              <div className="pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                <label className="block text-[11px] font-bold mb-1 flex items-center justify-between" style={{ color: 'var(--text-main)' }}>
                  <span>Notas Internas da Equipe</span>
                  {notesSaved && <span className="text-[10px]" style={{ color: 'var(--brand-secondary)' }}>Salvo!</span>}
                </label>
                <textarea
                  rows={3}
                  placeholder="Anotações confidenciais sobre este atendimento..."
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  className="w-full p-2.5 border rounded-xl text-xs outline-none resize-none transition-colors mb-2"
                  style={{
                    backgroundColor: 'var(--bg-app)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-main)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (onSaveNotes && activeTicket) {
                      onSaveNotes(activeTicket.id, internalNotes);
                      setNotesSaved(true);
                      setTimeout(() => setNotesSaved(false), 3000);
                    }
                  }}
                  className="w-full py-1.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  style={{
                    backgroundColor: 'var(--brand-primary-light)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--brand-primary)',
                  }}
                >
                  <span className="material-symbols-outlined text-sm">save</span>
                  <span>Salvar Anotação</span>
                </button>
              </div>
            </div>
          </aside>
        )}
      </main>

      {/* LIGHTBOX MODAL */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={previewImage}
              alt="Anexo Ampliado"
              className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl"
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
