'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import {
  Car,
  Headphones,
  Search,
  Send,
  Phone,
  MessageSquare,
  Clock,
  CheckCircle,
  FileText,
  Forward,
  XCircle,
  LogOut,
  ChevronRight,
  Shield,
  Bot,
  User as UserIcon,
  Paperclip,
  CheckCheck,
  AlertCircle,
  Sparkles,
  ExternalLink,
  Save,
  Loader2
} from 'lucide-react';

interface Operator {
  userId: string;
  tenantId: string;
  name: string;
  email: string;
  role: string;
}

interface Department {
  id: string;
  name: string;
  slug: string;
}

interface CannedResponse {
  id: string;
  shortcut: string;
  title: string;
  content: string;
}

interface TicketItem {
  id: string;
  tenantId: string;
  driverId: string;
  departmentId?: string | null;
  operatorId?: string | null;
  status: 'BOT_TRIAGE' | 'WAITING_QUEUE' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  triageStep?: string;
  collectedData?: any;
  internalNotes?: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt?: string | null;
  driver: {
    prefixo: string;
    name: string;
    phone: string;
    plate?: string;
  };
  department?: Department;
  operator?: { id: string; name: string };
  messages?: any[];
}

export default function OperatorDashboardPage() {
  const router = useRouter();
  const [operator, setOperator] = useState<Operator | null>(null);
  const [operatorStatus, setOperatorStatus] = useState<'ONLINE' | 'PAUSED'>('ONLINE');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('ALL');

  // Tabs: 'waiting' | 'myChats' | 'closed'
  const [activeTab, setActiveTab] = useState<'waiting' | 'myChats' | 'closed'>('waiting');
  const [searchTerm, setSearchTerm] = useState('');

  // Ticket Lists
  const [waitingTickets, setWaitingTickets] = useState<TicketItem[]>([]);
  const [myTickets, setMyTickets] = useState<TicketItem[]>([]);
  const [closedTickets, setClosedTickets] = useState<TicketItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [cannedResponses, setCannedResponses] = useState<CannedResponse[]>([]);

  // Selected Chat State
  const [activeTicket, setActiveTicket] = useState<TicketItem | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSavedSuccess, setNotesSavedSuccess] = useState(false);

  // Canned response popup
  const [showCannedMenu, setShowCannedMenu] = useState(false);
  const [cannedSearch, setCannedSearch] = useState('');

  // Transfer modal
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTargetDept, setTransferTargetDept] = useState('');

  // Sockets & UI
  const [loading, setLoading] = useState(true);
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load Dashboard Data
  const loadDashboardData = async (token?: string) => {
    try {
      const url = selectedDeptId !== 'ALL'
        ? `/api/operator/dashboard?departmentId=${selectedDeptId}`
        : '/api/operator/dashboard';

      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!res.ok) {
        if (res.status === 401) {
          router.replace('/operator/login');
          return;
        }
      }

      const data = await res.json();
      if (data.success) {
        setOperator(data.operator);
        setWaitingTickets(data.tickets.waiting || []);
        setMyTickets(data.tickets.myChats || []);
        setClosedTickets(data.tickets.closed || []);
        setDepartments(data.departments || []);
        setCannedResponses(data.cannedResponses || []);
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    }
  };

  // Init Operator Session & Socket
  useEffect(() => {
    let socket: Socket;

    async function init() {
      try {
        const sessionRes = await fetch('/api/auth/operator-session');
        const sessionData = await sessionRes.json();

        if (!sessionRes.ok || !sessionData.authenticated) {
          router.replace('/operator/login');
          return;
        }

        const op = sessionData.user;
        const token = sessionData.token;
        setOperator(op);

        await loadDashboardData(token);

        // Connect Socket
        socket = io({
          auth: { token },
          transports: ['websocket', 'polling'],
        });

        socketRef.current = socket;

        socket.on('connect', () => {
          // Socket connected
        });

        socket.on('dashboard_refresh', () => {
          loadDashboardData(token);
        });

        socket.on('queue_new_ticket', () => {
          loadDashboardData(token);
        });

        socket.on('new_message', (msg: any) => {
          setActiveTicket((current) => {
            if (current && current.id === msg.ticketId) {
              setMessages((prev) => [...prev, msg]);
            }
            return current;
          });
        });

        socket.on('ticket_updated', (updatedTicket: TicketItem) => {
          setActiveTicket((current) => {
            if (current && current.id === updatedTicket.id) {
              return { ...current, ...updatedTicket };
            }
            return current;
          });
          loadDashboardData(token);
        });

        setLoading(false);
      } catch (err) {
        console.error('Operator init error:', err);
        setLoading(false);
      }
    }

    init();

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [router, selectedDeptId]);

  // Select Ticket to View
  const handleSelectTicket = async (ticket: TicketItem) => {
    setActiveTicket(ticket);
    setInternalNotes(ticket.internalNotes || '');

    if (socketRef.current) {
      socketRef.current.emit('join_ticket', { ticketId: ticket.id });
    }

    try {
      const res = await fetch(`/api/operator/ticket-details?ticketId=${ticket.id}`);
      const data = await res.json();
      if (data.success && data.ticket) {
        setActiveTicket(data.ticket);
        setMessages(data.ticket.messages || []);
        setInternalNotes(data.ticket.internalNotes || '');
      }
    } catch {
      setMessages(ticket.messages || []);
    }
  };

  // Send Operator Message
  const handleSendMessage = () => {
    if (!inputText.trim() || !activeTicket) return;

    if (socketRef.current) {
      socketRef.current.emit('send_message', {
        ticketId: activeTicket.id,
        content: inputText.trim(),
      });
    }

    setInputText('');
    setShowCannedMenu(false);
  };

  // Canned response selection
  const handleSelectCannedResponse = (content: string) => {
    setInputText(content);
    setShowCannedMenu(false);
  };

  // Claim Ticket
  const handleClaimTicket = async () => {
    if (!activeTicket) return;
    try {
      const res = await fetch('/api/operator/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: activeTicket.id }),
      });
      const data = await res.json();
      if (data.success) {
        setActiveTicket(data.ticket);
        setActiveTab('myChats');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Transfer Ticket
  const handleTransferTicket = async () => {
    if (!activeTicket || !transferTargetDept) return;
    try {
      const res = await fetch('/api/operator/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: activeTicket.id,
          departmentId: transferTargetDept,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActiveTicket(data.ticket);
        setShowTransferModal(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Close Ticket
  const handleCloseTicket = async () => {
    if (!activeTicket) return;
    if (!confirm('Deseja realmente encerrar este chamado?')) return;

    try {
      const res = await fetch('/api/operator/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: activeTicket.id }),
      });
      const data = await res.json();
      if (data.success) {
        setActiveTicket(data.ticket);
        setActiveTab('closed');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Save Internal Notes
  const handleSaveNotes = async () => {
    if (!activeTicket) return;
    setNotesSaving(true);
    setNotesSavedSuccess(false);

    try {
      await fetch('/api/operator/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: activeTicket.id,
          notes: internalNotes,
        }),
      });
      setNotesSavedSuccess(true);
      setTimeout(() => setNotesSavedSuccess(false), 2500);
    } catch (err) {
      console.error(err);
    } finally {
      setNotesSaving(false);
    }
  };

  // Logout
  const handleLogout = async () => {
    await fetch('/api/auth/operator-session', { method: 'DELETE' });
    router.replace('/operator/login');
  };

  // Filter current ticket list
  const currentList =
    activeTab === 'waiting'
      ? waitingTickets
      : activeTab === 'myChats'
      ? myTickets
      : closedTickets;

  const filteredList = currentList.filter((item) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const prefixo = item.driver?.prefixo?.toLowerCase() || '';
    const name = item.driver?.name?.toLowerCase() || '';
    const plate = item.driver?.plate?.toLowerCase() || '';
    return prefixo.includes(term) || name.includes(term) || plate.includes(term);
  });

  // Watch for "/" in message input to trigger canned responses
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);

    if (val.startsWith('/')) {
      setShowCannedMenu(true);
      setCannedSearch(val.slice(1).toLowerCase());
    } else {
      setShowCannedMenu(false);
    }
  };

  const filteredCanned = cannedResponses.filter(
    (c) =>
      c.shortcut.toLowerCase().includes(cannedSearch) ||
      c.title.toLowerCase().includes(cannedSearch)
  );

  if (loading) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
          <Headphones className="w-8 h-8 text-amber-400 animate-pulse" />
        </div>
        <p className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
          Carregando Central de Atendimento...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* ============================================================== */}
      {/* 1. BARRA SUPERIOR (HEADER)                                     */}
      {/* ============================================================== */}
      <header className="h-14 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between z-30">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center shadow-md shadow-amber-500/20">
              <Car className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <span className="text-sm font-black text-white tracking-wider">TX CENTRAL</span>
              <span className="text-xs text-amber-400 ml-1.5 font-bold uppercase tracking-widest text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15">
                Atendimento
              </span>
            </div>
          </div>

          <div className="h-5 w-px bg-slate-800" />

          {/* Department Filter */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Departamento Fila:</span>
            <select
              value={selectedDeptId}
              onChange={(e) => setSelectedDeptId(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            >
              <option value="ALL">Todos os Departamentos</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Operator Status & Profile */}
        <div className="flex items-center gap-4">
          {/* Status Switcher */}
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-full px-3 py-1">
            <span
              className={`w-2 h-2 rounded-full ${
                operatorStatus === 'ONLINE' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <select
              value={operatorStatus}
              onChange={(e) => setOperatorStatus(e.target.value as any)}
              className="bg-transparent text-xs font-semibold text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="ONLINE" className="bg-slate-900">Online</option>
              <option value="PAUSED" className="bg-slate-900">Em Pausa</option>
            </select>
          </div>

          <div className="flex items-center gap-2.5 text-xs text-slate-300">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-amber-400">
              {operator?.name?.slice(0, 2).toUpperCase() || 'OP'}
            </div>
            <div className="hidden sm:block">
              <p className="font-semibold text-white leading-tight">{operator?.name}</p>
              <p className="text-[11px] text-slate-400 leading-tight">{operator?.email}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            title="Sair"
            className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Container - 3 Columns */}
      <div className="flex-1 flex overflow-hidden">
        {/* ============================================================== */}
        {/* 2. COLUNA DA ESQUERDA (LISTA DE CONVERSAS)                    */}
        {/* ============================================================== */}
        <aside className="w-80 md:w-96 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
          {/* Navigation Tabs */}
          <div className="grid grid-cols-3 p-2 bg-slate-950/60 border-b border-slate-800 gap-1 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('waiting')}
              className={`py-2 px-1 rounded-lg transition-all flex flex-col items-center gap-0.5 ${
                activeTab === 'waiting'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/15'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <span>Aguardando</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeTab === 'waiting' ? 'bg-amber-950/40 text-slate-950 font-bold' : 'bg-slate-800 text-amber-400'}`}>
                {waitingTickets.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('myChats')}
              className={`py-2 px-1 rounded-lg transition-all flex flex-col items-center gap-0.5 ${
                activeTab === 'myChats'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/15'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <span>Meus Chats</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeTab === 'myChats' ? 'bg-amber-950/40 text-slate-950 font-bold' : 'bg-slate-800 text-blue-400'}`}>
                {myTickets.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('closed')}
              className={`py-2 px-1 rounded-lg transition-all flex flex-col items-center gap-0.5 ${
                activeTab === 'closed'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/15'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <span>Finalizados</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeTab === 'closed' ? 'bg-amber-950/40 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'}`}>
                {closedTickets.length}
              </span>
            </button>
          </div>

          {/* Search Box */}
          <div className="p-3 border-b border-slate-800">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar por prefixo, nome ou placa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Conversation Cards List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/50">
            {filteredList.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                Nenhum chamado encontrado nesta aba.
              </div>
            ) : (
              filteredList.map((item) => {
                const isSelected = activeTicket?.id === item.id;
                const lastMsg = item.messages?.[0]?.content || 'Chamado iniciado';
                const motivo = item.collectedData?.motivoPrincipal || item.department?.name || 'Geral';

                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectTicket(item)}
                    className={`p-3.5 cursor-pointer transition-colors border-l-4 ${
                      isSelected
                        ? 'bg-slate-800/90 border-amber-500 shadow-sm'
                        : 'border-transparent hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-xs">
                          {item.driver?.prefixo || 'S/P'}
                        </span>
                        <span className="font-semibold text-xs text-white truncate max-w-[130px]">
                          {item.driver?.name}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(item.updatedAt || item.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <p className="text-[11px] text-amber-400/90 font-medium mb-1 truncate">
                      {motivo}
                    </p>

                    <p className="text-xs text-slate-400 line-clamp-1">
                      {lastMsg}
                    </p>

                    {item.department && (
                      <div className="mt-2 flex items-center justify-between text-[10px]">
                        <span className="text-slate-400 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800">
                          {item.department.name}
                        </span>
                        {item.status === 'WAITING_QUEUE' && (
                          <span className="text-amber-400 font-bold">Fila de Espera</span>
                        )}
                        {item.status === 'IN_PROGRESS' && (
                          <span className="text-blue-400 font-bold">Em Atendimento</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* ============================================================== */}
        {/* 3. COLUNA CENTRAL (JANELA DO CHAT)                             */}
        {/* ============================================================== */}
        <main className="flex-1 flex flex-col bg-slate-950 border-r border-slate-800 relative">
          {activeTicket ? (
            <>
              {/* Chat Action Header */}
              <div className="h-16 px-6 bg-slate-900 border-b border-slate-800 flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                    <Car className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">
                        {activeTicket.driver?.name}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-extrabold text-[11px]">
                        {activeTicket.driver?.prefixo}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Placa: {activeTicket.driver?.plate || 'Não informada'} | Setor:{' '}
                      <strong className="text-slate-300">
                        {activeTicket.department?.name || 'Em Triagem'}
                      </strong>
                    </p>
                  </div>
                </div>

                {/* Operator Actions Buttons */}
                <div className="flex items-center gap-2">
                  {activeTicket.status === 'WAITING_QUEUE' && (
                    <button
                      onClick={handleClaimTicket}
                      className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all active:scale-95"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Assumir Chamado</span>
                    </button>
                  )}

                  {activeTicket.status === 'IN_PROGRESS' && (
                    <>
                      <button
                        onClick={() => setShowTransferModal(true)}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-1.5 transition-colors"
                      >
                        <Forward className="w-4 h-4 text-amber-400" />
                        <span>Transferir Setor</span>
                      </button>

                      <button
                        onClick={handleCloseTicket}
                        className="px-3.5 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-rose-500/20 transition-all active:scale-95"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Encerrar Atendimento</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Messages Flow */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-950/80">
                {messages.map((m) => {
                  const isDriver = m.senderType === 'DRIVER';
                  const isBot = m.senderType === 'BOT';
                  const isSystem = m.senderType === 'SYSTEM';
                  const isOperator = m.senderType === 'OPERATOR';

                  if (isSystem) {
                    return (
                      <div key={m.id} className="flex justify-center my-3">
                        <span className="px-4 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-400 shadow-sm">
                          {m.content}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isOperator ? 'items-end' : 'items-start'}`}
                    >
                      {/* Sender Label */}
                      <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] font-semibold text-slate-400">
                        {isBot && (
                          <>
                            <Bot className="w-3.5 h-3.5 text-amber-400" />
                            <span className="text-amber-400">Bot de Triagem</span>
                          </>
                        )}
                        {isDriver && (
                          <>
                            <Car className="w-3.5 h-3.5 text-slate-300" />
                            <span className="text-slate-300">
                              Motorista ({activeTicket.driver?.prefixo})
                            </span>
                          </>
                        )}
                        {isOperator && (
                          <>
                            <Headphones className="w-3.5 h-3.5 text-blue-400" />
                            <span className="text-blue-400">Você (Operador)</span>
                          </>
                        )}
                        <span className="text-[10px] text-slate-500 font-normal">
                          {new Date(m.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      {/* Message Content */}
                      <div
                        className={`max-w-[75%] rounded-2xl p-4 text-sm whitespace-pre-wrap leading-relaxed shadow-md ${
                          isOperator
                            ? 'bg-blue-600 text-white rounded-br-xs'
                            : isDriver
                            ? 'bg-slate-800 text-slate-100 border border-slate-700/80 rounded-bl-xs'
                            : 'bg-slate-900 text-slate-200 border border-slate-800 rounded-bl-xs'
                        }`}
                      >
                        {m.mediaUrl && (
                          <div className="mb-3 rounded-lg overflow-hidden border border-slate-700 bg-black/20">
                            <a href={m.mediaUrl} target="_blank" rel="noreferrer">
                              <img
                                src={m.mediaUrl}
                                alt="Comprovante"
                                className="max-h-60 rounded-md object-contain hover:scale-105 transition-transform"
                              />
                            </a>
                            <p className="text-[10px] text-slate-400 p-1 flex items-center gap-1">
                              <ExternalLink className="w-3 h-3" /> Clique para abrir comprovante original
                            </p>
                          </div>
                        )}
                        <div>{m.content}</div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Canned Responses Floating Menu (Triggered by "/") */}
              {showCannedMenu && (
                <div className="absolute bottom-20 left-6 right-6 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-3 z-30 max-h-64 overflow-y-auto">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-xs font-bold text-amber-400">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" /> Respostas Rápidas Pré-cadastradas
                    </span>
                    <span className="text-[10px] text-slate-500">Digite para filtrar</span>
                  </div>
                  <div className="space-y-1">
                    {filteredCanned.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => handleSelectCannedResponse(c.content)}
                        className="w-full text-left p-2 rounded-xl hover:bg-slate-800 flex items-center justify-between text-xs transition-colors"
                      >
                        <div>
                          <strong className="text-amber-400 mr-2">{c.shortcut}</strong>
                          <span className="text-slate-200 font-semibold">{c.title}</span>
                          <p className="text-[11px] text-slate-400 line-clamp-1">{c.content}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-500" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Message Input Bar */}
              <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center gap-3">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Digite sua mensagem ou digite '/' para respostas rápidas..."
                    value={inputText}
                    onChange={handleInputChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSendMessage();
                    }}
                    className="w-full py-3 px-4 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                  <span className="absolute right-3 top-3 text-[11px] text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                    Atalho: /
                  </span>
                </div>

                <button
                  onClick={handleSendMessage}
                  disabled={!inputText.trim()}
                  className="p-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-amber-500/20 active:scale-95"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
              <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-4 text-slate-600">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-semibold text-slate-300 mb-1">
                Nenhum chamado selecionado
              </h3>
              <p className="text-xs text-slate-500 max-w-sm">
                Selecione um chamado na lista à esquerda para visualizar a conversa e iniciar o atendimento.
              </p>
            </div>
          )}
        </main>

        {/* ============================================================== */}
        {/* 4. COLUNA DA DIREITA (FICHA CADASTRAL DO MOTORISTA)            */}
        {/* ============================================================== */}
        <aside className="w-80 md:w-88 bg-slate-900 p-5 flex flex-col shrink-0 overflow-y-auto">
          {activeTicket ? (
            <div className="space-y-6">
              {/* Profile Card */}
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Ficha Cadastral do Motorista
                </h3>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Prefixo</span>
                    <span className="px-2.5 py-0.5 rounded-lg bg-amber-500 text-slate-950 font-black text-xs">
                      {activeTicket.driver?.prefixo}
                    </span>
                  </div>

                  <div>
                    <span className="text-xs text-slate-500">Nome Completo</span>
                    <p className="text-sm font-bold text-white mt-0.5">
                      {activeTicket.driver?.name}
                    </p>
                  </div>

                  <div>
                    <span className="text-xs text-slate-500">Telefone / Contato</span>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-slate-200 font-medium">
                        {activeTicket.driver?.phone}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <a
                          href={`tel:${activeTicket.driver?.phone.replace(/\D/g, '')}`}
                          className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 transition-colors"
                          title="Ligar"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                        <a
                          href={`https://wa.me/55${activeTicket.driver?.phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 transition-colors"
                          title="WhatsApp"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                    <div>
                      <span className="text-xs text-slate-500">Placa do Veículo</span>
                      <p className="text-xs font-bold text-amber-400 uppercase">
                        {activeTicket.driver?.plate || 'Não informada'}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
                      ATIVO
                    </span>
                  </div>
                </div>
              </div>

              {/* Bot Triage Summary */}
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Resumo Coletado pelo Bot
                </h3>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5 text-xs">
                  {activeTicket.collectedData && Object.keys(activeTicket.collectedData).length > 0 ? (
                    Object.entries(activeTicket.collectedData).map(([key, val]) => (
                      <div key={key} className="pb-2 border-b border-slate-900 last:border-none">
                        <span className="text-[11px] text-slate-500 uppercase font-bold tracking-wider">
                          {key}:
                        </span>
                        <p className="text-xs text-slate-200 mt-0.5 font-medium">
                          {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-500 italic text-xs">
                      Nenhum dado adicional coletado na triagem.
                    </p>
                  )}
                </div>
              </div>

              {/* Internal Notes */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Notas Internas da Equipe
                  </h3>
                  <span className="text-[10px] text-amber-400">Privado (Invisível ao motorista)</span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <textarea
                    rows={4}
                    placeholder="Adicione anotações confidenciais sobre este atendimento..."
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 resize-none"
                  />

                  <div className="flex items-center justify-between pt-1">
                    {notesSavedSuccess ? (
                      <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> Salvo com sucesso!
                      </span>
                    ) : (
                      <span />
                    )}

                    <button
                      onClick={handleSaveNotes}
                      disabled={notesSaving}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{notesSaving ? 'Salvando...' : 'Salvar Nota'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-center text-slate-500 text-xs">
              Selecione um chamado para visualizar a ficha do motorista.
            </div>
          )}
        </aside>
      </div>

      {/* Transfer Department Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-sm font-bold text-white mb-2">
              Transferir para outro Departamento
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Selecione o setor de destino para onde este chamado deve ser encaminhado:
            </p>

            <select
              value={transferTargetDept}
              onChange={(e) => setTransferTargetDept(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white mb-5 focus:outline-none focus:border-amber-500"
            >
              <option value="">Selecione o setor...</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowTransferModal(false)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                disabled={!transferTargetDept}
                onClick={handleTransferTicket}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold disabled:opacity-40 transition-colors"
              >
                Confirmar Transferência
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
