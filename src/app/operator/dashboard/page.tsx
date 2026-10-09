'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import {
  MessageSquare,
  Users,
  SlidersHorizontal,
  Search,
  Phone,
  Video,
  Info,
  Paperclip,
  Smile,
  Send,
  CheckCheck,
  Heart,
  Megaphone,
  Crown,
  Settings,
  LogOut,
  Bell,
  ChevronDown,
  Plus,
  Sparkles,
  Bot,
  GitBranch,
  Layers,
  Shield,
  Headphones,
  ArrowRight,
  Clock,
  UserCheck,
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  ExternalLink,
  Save,
  Trash2,
  Lock,
  Mail,
  User,
  Car
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
  _count?: {
    tickets: number;
    users: number;
  };
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

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  departments: { id: string; name: string }[];
}

interface FlowNode {
  id: string;
  label: string;
  departmentSlug: string;
  responseMsg: string;
}

export default function OperatorDashboardPage() {
  const router = useRouter();

  // Navigation Views: 'chat' | 'flowbuilder' | 'team' | 'queues' | 'canned'
  const [activeNav, setActiveNav] = useState<'chat' | 'flowbuilder' | 'team' | 'queues' | 'canned'>('chat');

  // Operator Session
  const [operator, setOperator] = useState<Operator | null>(null);
  const [operatorStatus, setOperatorStatus] = useState<'ONLINE' | 'PAUSED'>('ONLINE');

  // Conversations & Queue State
  const [waitingTickets, setWaitingTickets] = useState<TicketItem[]>([]);
  const [myTickets, setMyTickets] = useState<TicketItem[]>([]);
  const [closedTickets, setClosedTickets] = useState<TicketItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [cannedResponses, setCannedResponses] = useState<CannedResponse[]>([]);
  
  // Filtering & Selection
  const [activeQueueTab, setActiveQueueTab] = useState<'all' | 'waiting' | 'myChats' | 'closed'>('all');
  const [searchMember, setSearchMember] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('ALL');

  // Active Chat State
  const [activeTicket, setActiveTicket] = useState<TicketItem | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSavedSuccess, setNotesSavedSuccess] = useState(false);
  const [showRightDetails, setShowRightDetails] = useState(true);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [selectedTransferDept, setSelectedTransferDept] = useState('');

  // Reaction State for demo
  const [messageReactions, setMessageReactions] = useState<{ [key: string]: boolean }>({});

  // Team Management State
  const [teamList, setTeamList] = useState<TeamMember[]>([]);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'OPERATOR' | 'ADMIN'>('OPERATOR');
  const [newUserDepts, setNewUserDepts] = useState<string[]>([]);
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [teamSubmitting, setTeamSubmitting] = useState(false);

  // FlowBuilder State
  const [flowWelcome, setFlowWelcome] = useState('Olá! Seja bem-vindo à nossa Central de Atendimento Inteligente.\n\nPor favor, escolha uma das opções abaixo:');
  const [flowFallback, setFlowFallback] = useState('Opção inválida. Por favor, digite o número correspondente:');
  const [flowNodes, setFlowNodes] = useState<FlowNode[]>([
    { id: '1', label: 'Atualização de Cadastro / Veículo', departmentSlug: 'cadastro-veiculos', responseMsg: 'Conectando com o setor de Cadastro...' },
    { id: '2', label: 'Corridas & Operacional', departmentSlug: 'corridas-operacional', responseMsg: 'Transferindo para a fila de Operações...' },
    { id: '3', label: 'Novo Cadastro - Quero me credenciar', departmentSlug: 'comercial-novos-cadastros', responseMsg: 'Direcionando para Admissão e Credenciamento...' },
    { id: '4', label: 'Dúvidas Gerais / Outros Assuntos', departmentSlug: 'duvidas-gerais', responseMsg: 'Aguarde um momento, conectando com a central...' },
    { id: '5', label: 'Financeiro & Pagamentos / PIX', departmentSlug: 'financeiro-pagamentos', responseMsg: 'Encaminhando para o setor Financeiro...' },
  ]);
  const [flowSaving, setFlowSaving] = useState(false);
  const [flowSavedSuccess, setFlowSavedSuccess] = useState(false);

  // New Department State
  const [newDeptName, setNewDeptName] = useState('');
  const [deptSubmitting, setDeptSubmitting] = useState(false);

  // Canned Filter Dropdown in Chat
  const [cannedFiltered, setCannedFiltered] = useState<CannedResponse[]>([]);
  const [showCannedDropdown, setShowCannedDropdown] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // 1. Initial Data Fetch
  const fetchDashboardData = async () => {
    try {
      const res = await fetch('/api/operator/dashboard');
      if (res.status === 401) {
        router.push('/operator/login');
        return;
      }
      const data = await res.json();
      if (data.success) {
        setOperator(data.operator);
        setWaitingTickets(data.tickets?.waiting || []);
        setMyTickets(data.tickets?.inProgress || []);
        setClosedTickets(data.tickets?.closed || []);
        setDepartments(data.departments || []);
        setCannedResponses(data.cannedResponses || []);
      }
    } catch (err) {
      console.error('Erro ao buscar dados do dashboard:', err);
    }
  };

  // 2. Fetch Team Data
  const fetchTeamData = async () => {
    try {
      const res = await fetch('/api/operator/team');
      const data = await res.json();
      if (data.success) {
        setTeamList(data.team || []);
      }
    } catch (err) {
      console.error('Erro ao buscar equipe:', err);
    }
  };

  // 3. Fetch FlowBuilder Data
  const fetchFlowData = async () => {
    try {
      const res = await fetch('/api/operator/flow');
      const data = await res.json();
      if (data.success && data.flow) {
        setFlowWelcome(data.flow.welcomeMsg || flowWelcome);
        setFlowFallback(data.flow.fallbackMsg || flowFallback);
        if (Array.isArray(data.flow.nodes) && data.flow.nodes.length > 0) {
          setFlowNodes(data.flow.nodes);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar fluxo do bot:', err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    fetchTeamData();
    fetchFlowData();
  }, []);

  // Socket Connection
  useEffect(() => {
    if (!operator) return;

    const socket = io({
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('operator:join', {
        tenantId: operator.tenantId,
        operatorId: operator.userId,
      });
    });

    socket.on('ticket:message', (data: any) => {
      if (activeTicket && data.ticketId === activeTicket.id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.id)) return prev;
          return [...prev, data];
        });
      }
      fetchDashboardData();
    });

    socket.on('ticket:assigned', () => fetchDashboardData());
    socket.on('ticket:statusChanged', () => fetchDashboardData());

    return () => {
      socket.disconnect();
    };
  }, [operator, activeTicket]);

  // Load Active Ticket Details
  const handleSelectTicket = async (ticket: TicketItem) => {
    setActiveTicket(ticket);
    setInternalNotes(ticket.internalNotes || '');
    setNotesSavedSuccess(false);

    try {
      const res = await fetch(`/api/operator/ticket-details?id=${ticket.id}`);
      const data = await res.json();
      if (data.success && data.ticket) {
        setActiveTicket(data.ticket);
        setMessages(data.ticket.messages || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Scroll messages to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle Input text changes & Canned response shortcut /
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);

    if (val.startsWith('/')) {
      const query = val.slice(1).toLowerCase();
      const filtered = cannedResponses.filter(
        (c) => c.shortcut.toLowerCase().includes(query) || c.title.toLowerCase().includes(query)
      );
      setCannedFiltered(filtered);
      setShowCannedDropdown(filtered.length > 0);
    } else {
      setShowCannedDropdown(false);
    }
  };

  const handleSelectCanned = (content: string) => {
    setInputText(content);
    setShowCannedDropdown(false);
  };

  // Send Message
  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !activeTicket || !operator) return;

    const textToSend = inputText.trim();
    setInputText('');
    setShowCannedDropdown(false);

    if (socketRef.current) {
      socketRef.current.emit('message:send', {
        ticketId: activeTicket.id,
        senderType: 'OPERATOR',
        senderId: operator.userId,
        content: textToSend,
      });
    }
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
        handleSelectTicket(data.ticket);
        fetchDashboardData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Close Ticket
  const handleCloseTicket = async () => {
    if (!activeTicket) return;
    try {
      const res = await fetch('/api/operator/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: activeTicket.id, internalNotes }),
      });
      const data = await res.json();
      if (data.success) {
        fetchDashboardData();
        setActiveTicket(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Transfer Ticket
  const handleTransferTicket = async () => {
    if (!activeTicket || !selectedTransferDept) return;
    try {
      const res = await fetch('/api/operator/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: activeTicket.id,
          departmentId: selectedTransferDept,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTransferModalOpen(false);
        fetchDashboardData();
        setActiveTicket(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Save Internal Notes
  const handleSaveNotes = async () => {
    if (!activeTicket) return;
    setNotesSaving(true);
    try {
      const res = await fetch('/api/operator/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: activeTicket.id,
          internalNotes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNotesSavedSuccess(true);
        setTimeout(() => setNotesSavedSuccess(false), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setNotesSaving(false);
    }
  };

  // Toggle Heart Reaction
  const toggleReaction = (msgId: string) => {
    setMessageReactions((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  // Save FlowBuilder
  const handleSaveFlow = async () => {
    setFlowSaving(true);
    try {
      const res = await fetch('/api/operator/flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          welcomeMsg: flowWelcome,
          fallbackMsg: flowFallback,
          nodes: flowNodes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFlowSavedSuccess(true);
        setTimeout(() => setFlowSavedSuccess(false), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFlowSaving(false);
    }
  };

  // Add Flow Node
  const handleAddFlowNode = () => {
    const nextId = (flowNodes.length + 1).toString();
    setFlowNodes([
      ...flowNodes,
      {
        id: nextId,
        label: `Nova Opção ${nextId}`,
        departmentSlug: departments[0]?.slug || 'duvidas-gerais',
        responseMsg: 'Encaminhando seu atendimento...',
      },
    ]);
  };

  // Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setTeamSubmitting(true);
    try {
      const res = await fetch('/api/operator/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newUserName,
          email: newUserEmail,
          password: newUserPassword,
          role: newUserRole,
          departmentIds: newUserDepts,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTeamModalOpen(false);
        setNewUserName('');
        setNewUserEmail('');
        setNewUserPassword('');
        setNewUserDepts([]);
        fetchTeamData();
      } else {
        alert(data.error || 'Erro ao cadastrar usuário.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTeamSubmitting(false);
    }
  };

  // Delete User
  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Deseja realmente remover este usuário da equipe?')) return;
    try {
      const res = await fetch(`/api/operator/team?id=${userId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchTeamData();
      } else {
        alert(data.error || 'Erro ao remover usuário.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Create Department
  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) return;
    setDeptSubmitting(true);
    try {
      const res = await fetch('/api/operator/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newDeptName.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setNewDeptName('');
        fetchDashboardData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDeptSubmitting(false);
    }
  };

  // Logout
  const handleLogout = async () => {
    document.cookie = 'operator_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    router.push('/operator/login');
  };

  // Filter conversations
  const allConversations = [
    ...myTickets.map((t) => ({ ...t, tabType: 'myChats' })),
    ...waitingTickets.map((t) => ({ ...t, tabType: 'waiting' })),
    ...closedTickets.map((t) => ({ ...t, tabType: 'closed' })),
  ];

  const filteredConversations = allConversations.filter((t) => {
    if (activeQueueTab === 'waiting' && t.status !== 'WAITING_QUEUE' && t.status !== 'BOT_TRIAGE') return false;
    if (activeQueueTab === 'myChats' && t.status !== 'IN_PROGRESS') return false;
    if (activeQueueTab === 'closed' && t.status !== 'CLOSED' && t.status !== 'RESOLVED') return false;
    if (selectedDeptFilter !== 'ALL' && t.departmentId !== selectedDeptFilter) return false;

    if (searchMember.trim()) {
      const term = searchMember.toLowerCase();
      const matchName = t.driver?.name?.toLowerCase().includes(term);
      const matchPrefix = t.driver?.prefixo?.toLowerCase().includes(term);
      const matchPhone = t.driver?.phone?.toLowerCase().includes(term);
      return matchName || matchPrefix || matchPhone;
    }
    return true;
  });

  const totalUnreadCount = waitingTickets.length;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0a111a] text-white font-sans antialiased">

      {/* ========================================================================= */}
      {/* COLUNA 1: SIDEBAR PRINCIPAL (Navegação Global)                            */}
      {/* ========================================================================= */}
      <aside className="w-64 min-w-[16rem] bg-[#101c2b] border-r border-white/[0.08] flex flex-col justify-between p-4 z-40 select-none">
        <div>
          {/* Logo Composto: DA / TX com gradiente */}
          <div className="flex items-center gap-3 px-2 py-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#ff5722] via-[#ff6b35] to-[#1e3a5f] flex items-center justify-center font-black text-lg tracking-wider text-white shadow-lg shadow-[#ff5722]/20">
              TX
            </div>
            <div>
              <div className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
                <span>TX Mensageria</span>
              </div>
              <p className="text-[11px] text-[#8a9ba8] font-medium tracking-wide">
                Community & Connection
              </p>
            </div>
          </div>

          {/* Menu de Navegação Vertical */}
          <nav className="space-y-1.5">
            {/* Dashboard / Chat Item */}
            <button
              onClick={() => setActiveNav('chat')}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-semibold transition-all ${
                activeNav === 'chat'
                  ? 'bg-white/[0.08] text-white shadow-inner border border-white/[0.06]'
                  : 'text-[#8a9ba8] hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center gap-3">
                <MessageSquare className={`w-4 h-4 ${activeNav === 'chat' ? 'text-[#ff5722]' : ''}`} />
                <span>Member Chat</span>
              </div>
              {totalUnreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[#ff5722] text-white text-[10px] font-bold shadow-md shadow-[#ff5722]/30">
                  {totalUnreadCount}
                </span>
              )}
            </button>

            {/* FlowBuilder */}
            <button
              onClick={() => setActiveNav('flowbuilder')}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-semibold transition-all ${
                activeNav === 'flowbuilder'
                  ? 'bg-white/[0.08] text-white shadow-inner border border-white/[0.06]'
                  : 'text-[#8a9ba8] hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center gap-3">
                <GitBranch className={`w-4 h-4 ${activeNav === 'flowbuilder' ? 'text-[#ff5722]' : ''}`} />
                <span>FlowBuilder (Bot)</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-bold">
                Auto
              </span>
            </button>

            {/* Equipe & Acessos */}
            <button
              onClick={() => setActiveNav('team')}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-semibold transition-all ${
                activeNav === 'team'
                  ? 'bg-white/[0.08] text-white shadow-inner border border-white/[0.06]'
                  : 'text-[#8a9ba8] hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Users className={`w-4 h-4 ${activeNav === 'team' ? 'text-[#ff5722]' : ''}`} />
                <span>Equipe & Acessos</span>
              </div>
              <span className="text-[11px] text-[#8a9ba8] font-bold">
                {teamList.length}
              </span>
            </button>

            {/* Filas & Departamentos */}
            <button
              onClick={() => setActiveNav('queues')}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-semibold transition-all ${
                activeNav === 'queues'
                  ? 'bg-white/[0.08] text-white shadow-inner border border-white/[0.06]'
                  : 'text-[#8a9ba8] hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Layers className={`w-4 h-4 ${activeNav === 'queues' ? 'text-[#ff5722]' : ''}`} />
                <span>Filas & Setores</span>
              </div>
              <span className="text-[11px] text-[#8a9ba8] font-bold">
                {departments.length}
              </span>
            </button>

            {/* Respostas Rápidas */}
            <button
              onClick={() => setActiveNav('canned')}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-semibold transition-all ${
                activeNav === 'canned'
                  ? 'bg-white/[0.08] text-white shadow-inner border border-white/[0.06]'
                  : 'text-[#8a9ba8] hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Sparkles className={`w-4 h-4 ${activeNav === 'canned' ? 'text-[#ff5722]' : ''}`} />
                <span>Respostas Rápidas</span>
              </div>
              <span className="text-[11px] text-[#8a9ba8] font-bold">
                /{cannedResponses.length}
              </span>
            </button>

            {/* Premium Indicator */}
            <div className="pt-2">
              <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-semibold text-amber-400/90 bg-amber-500/10 border border-amber-500/20">
                <Crown className="w-4 h-4 text-amber-400" />
                <span>Plano Multi-Tenant</span>
              </div>
            </div>
          </nav>
        </div>

        {/* Card Promocional Inferior (CTA Banner) */}
        <div>
          <div className="bg-gradient-to-br from-[#172535] to-[#101c2b] border border-white/[0.08] rounded-3xl p-4.5 mb-4 relative overflow-hidden group shadow-xl">
            <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-[#ff5722]/10 rounded-full blur-xl group-hover:bg-[#ff5722]/20 transition-all" />
            <div className="w-10 h-10 rounded-2xl bg-[#ff5722]/20 border border-[#ff5722]/30 flex items-center justify-center mb-3">
              <Megaphone className="w-5 h-5 text-[#ff5722]" />
            </div>
            <h4 className="text-xs font-bold text-white mb-1">Stand Out. Get Results.</h4>
            <p className="text-[11px] text-[#8a9ba8] leading-relaxed mb-3.5">
              Automatize a triagem e conecte seus membros instantaneamente!
            </p>
            <button
              onClick={() => setActiveNav('flowbuilder')}
              className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#ff5722] to-[#ff6b35] hover:opacity-95 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 shadow-md shadow-[#ff5722]/25 transition-all"
            >
              <span>Personalizar Bot →</span>
            </button>
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-[#8a9ba8] hover:text-rose-400 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Encerrar Sessão</span>
          </button>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* ÁREA PRINCIPAL: ALTERNA ENTRE CHAT (4 COLUNAS) E TELAS ADMINISTRATIVAS   */}
      {/* ========================================================================= */}

      {activeNav === 'chat' ? (
        <>
          {/* ======================================================================= */}
          {/* COLUNA 2: LISTA DE CONVERSAS (Conversations)                            */}
          {/* ======================================================================= */}
          <section className="w-80 min-w-[20rem] bg-[#0d1724] border-r border-white/[0.08] flex flex-col justify-between z-30">
            {/* Header da Lista */}
            <div className="p-4 border-b border-white/[0.08]">
              <div className="flex items-center justify-between mb-3.5">
                <h2 className="text-base font-bold text-white tracking-tight">Conversations</h2>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      if (selectedDeptFilter === 'ALL') setSelectedDeptFilter(departments[0]?.id || 'ALL');
                      else setSelectedDeptFilter('ALL');
                    }}
                    className="p-1.5 rounded-xl hover:bg-white/[0.06] text-[#8a9ba8] hover:text-white transition-colors"
                    title="Filtrar por Departamento"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Barra de Pesquisa */}
              <div className="relative mb-3">
                <Search className="w-4 h-4 text-[#8a9ba8] absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search members..."
                  value={searchMember}
                  onChange={(e) => setSearchMember(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-[#101c2b] border border-white/[0.08] rounded-xl text-xs text-white placeholder-[#8a9ba8] focus:outline-none focus:border-[#ff5722] transition-colors"
                />
              </div>

              {/* Filtros em Pílulas */}
              <div className="flex items-center gap-1.5 text-[11px] overflow-x-auto no-scrollbar">
                <button
                  onClick={() => setActiveQueueTab('all')}
                  className={`px-3 py-1 rounded-full font-semibold transition-all ${
                    activeQueueTab === 'all'
                      ? 'bg-[#ff5722] text-white shadow-sm shadow-[#ff5722]/30'
                      : 'bg-[#101c2b] text-[#8a9ba8] hover:text-white'
                  }`}
                >
                  Todas ({allConversations.length})
                </button>
                <button
                  onClick={() => setActiveQueueTab('waiting')}
                  className={`px-3 py-1 rounded-full font-semibold transition-all ${
                    activeQueueTab === 'waiting'
                      ? 'bg-[#ff5722] text-white shadow-sm shadow-[#ff5722]/30'
                      : 'bg-[#101c2b] text-[#8a9ba8] hover:text-white'
                  }`}
                >
                  Fila ({waitingTickets.length})
                </button>
                <button
                  onClick={() => setActiveQueueTab('myChats')}
                  className={`px-3 py-1 rounded-full font-semibold transition-all ${
                    activeQueueTab === 'myChats'
                      ? 'bg-[#ff5722] text-white shadow-sm shadow-[#ff5722]/30'
                      : 'bg-[#101c2b] text-[#8a9ba8] hover:text-white'
                  }`}
                >
                  Meus ({myTickets.length})
                </button>
              </div>
            </div>

            {/* Lista de Contatos / Chamados */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {filteredConversations.length === 0 ? (
                <div className="py-16 text-center text-[#8a9ba8]">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">Nenhum atendimento encontrado</p>
                </div>
              ) : (
                filteredConversations.map((ticket) => {
                  const isSelected = activeTicket?.id === ticket.id;
                  const lastMsg = ticket.messages && ticket.messages.length > 0
                    ? ticket.messages[ticket.messages.length - 1].content
                    : 'Atendimento aguardando resposta...';

                  return (
                    <div
                      key={ticket.id}
                      onClick={() => handleSelectTicket(ticket)}
                      className={`p-3 rounded-2xl cursor-pointer transition-all flex items-center gap-3 relative ${
                        isSelected
                          ? 'bg-[#172535] border border-white/[0.12] shadow-lg'
                          : 'bg-[#101c2b]/80 hover:bg-[#101c2b] border border-white/[0.04]'
                      }`}
                    >
                      {/* Avatar com indicador de presença verde */}
                      <div className="relative flex-shrink-0">
                        <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-[#1e3a5f] to-[#ff5722]/80 flex items-center justify-center font-bold text-white text-xs shadow-md">
                          {ticket.driver?.name?.slice(0, 2).toUpperCase() || 'TX'}
                        </div>
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#22c55e] border-2 border-[#101c2b] rounded-full shadow-sm" />
                      </div>

                      {/* Conteúdo do Card */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-xs font-bold text-white truncate">
                            {ticket.driver?.name || `Motorista #${ticket.driver?.prefixo}`}
                          </h4>
                          <span className="text-[10px] text-[#8a9ba8] ml-2 flex-shrink-0">
                            {new Date(ticket.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#8a9ba8] truncate leading-tight">
                          {lastMsg}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/[0.06] text-[#8a9ba8] font-medium">
                            {ticket.department?.name || 'Triagem'}
                          </span>
                          {ticket.driver?.prefixo && (
                            <span className="text-[9px] text-[#ff5722] font-semibold">
                              #{ticket.driver.prefixo}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Badge de mensagens não lidas */}
                      {ticket.status === 'WAITING_QUEUE' && (
                        <div className="w-4.5 h-4.5 rounded-full bg-[#ff5722] text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0 shadow-sm shadow-[#ff5722]/40">
                          1
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Rodapé da Coluna */}
            <div className="p-3 border-t border-white/[0.08]">
              <a
                href="/driver/signup"
                target="_blank"
                className="w-full py-2.5 px-3 rounded-2xl border border-white/[0.08] hover:border-[#ff5722]/50 hover:bg-white/[0.03] text-[#8a9ba8] hover:text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all"
              >
                <Plus className="w-3.5 h-3.5 text-[#ff5722]" />
                <span>+ Novo Atendimento / Cadastro</span>
              </a>
            </div>
          </section>

          {/* ======================================================================= */}
          {/* COLUNA 3: PAINEL CENTRAL DE CHAT (Área Principal)                       */}
          {/* ======================================================================= */}
          <main className="flex-1 bg-[#0a111a] flex flex-col justify-between overflow-hidden relative">
            {activeTicket ? (
              <>
                {/* Barra Superior do Chat (Chat Header) */}
                <header className="h-16 px-6 bg-[#101c2b]/90 backdrop-blur-md border-b border-white/[0.08] flex items-center justify-between z-20">
                  <div className="flex items-center gap-3.5">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#1e3a5f] to-[#ff5722] flex items-center justify-center font-bold text-xs text-white shadow-md">
                        {activeTicket.driver?.name?.slice(0, 2).toUpperCase() || 'TX'}
                      </div>
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#22c55e] border-2 border-[#101c2b] rounded-full" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <span>{activeTicket.driver?.name || 'Sophia Bennett'}</span>
                        {activeTicket.driver?.prefixo && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-mono">
                            Prefixo {activeTicket.driver.prefixo}
                          </span>
                        )}
                      </h3>
                      <p className="text-[11px] text-[#22c55e] font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] inline-block animate-pulse" />
                        Online
                      </p>
                    </div>
                  </div>

                  {/* Ações Rápidas no Header */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => alert(`Iniciando chamada para: ${activeTicket.driver?.phone || 'Motorista'}`)}
                      className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[#ff6b35] transition-colors"
                      title="Chamada de Voz"
                    >
                      <Phone className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => alert('Recurso de vídeo disponível na versão corporativa')}
                      className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[#ff6b35] transition-colors"
                      title="Chamada de Vídeo"
                    >
                      <Video className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setShowRightDetails(!showRightDetails)}
                      className={`p-2.5 rounded-xl transition-colors ${
                        showRightDetails
                          ? 'bg-[#ff5722]/20 text-[#ff5722]'
                          : 'bg-white/[0.04] hover:bg-white/[0.08] text-[#ff6b35]'
                      }`}
                      title="Informações do Atendimento"
                    >
                      <Info className="w-4 h-4" />
                    </button>

                    {/* Botão Assumir ou Encerrar */}
                    {activeTicket.status === 'WAITING_QUEUE' || activeTicket.status === 'BOT_TRIAGE' ? (
                      <button
                        onClick={handleClaimTicket}
                        className="ml-2 px-3.5 py-2 rounded-xl bg-[#ff5722] hover:bg-[#ff6b35] text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-[#ff5722]/20 transition-all"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Assumir</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleCloseTicket}
                        className="ml-2 px-3.5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-xs flex items-center gap-1.5 border border-rose-500/30 transition-all"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Encerrar</span>
                      </button>
                    )}
                  </div>
                </header>

                {/* Fluxo de Mensagens */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {/* Divisor de Linha do Tempo: Today */}
                  <div className="flex justify-center my-4">
                    <span className="px-3.5 py-1 rounded-full bg-white/[0.06] text-[#8a9ba8] text-[11px] font-semibold border border-white/[0.04] backdrop-blur-sm shadow-sm">
                      Today
                    </span>
                  </div>

                  {messages.length === 0 ? (
                    <div className="py-20 text-center text-[#8a9ba8]">
                      <Bot className="w-10 h-10 mx-auto mb-3 opacity-30 text-[#ff5722]" />
                      <p className="text-xs">Início da conversa com este membro.</p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isOperator = msg.senderType === 'OPERATOR';
                      const isBot = msg.senderType === 'BOT';
                      const isHearted = messageReactions[msg.id];

                      return (
                        <div
                          key={msg.id}
                          className={`flex items-end gap-2.5 group ${
                            isOperator ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          {/* Avatar à esquerda para mensagens recebidas */}
                          {!isOperator && (
                            <div className="w-8 h-8 rounded-full bg-[#1e3a5f] flex items-center justify-center text-xs font-bold text-white flex-shrink-0 shadow-sm">
                              {isBot ? <Bot className="w-4 h-4 text-amber-400" /> : 'MB'}
                            </div>
                          )}

                          {/* Balão de Mensagem */}
                          <div className="relative max-w-lg">
                            <div
                              className={`p-3.5 rounded-3xl text-xs leading-relaxed shadow-md ${
                                isOperator
                                  ? 'bg-[#173b64] text-white rounded-br-xs'
                                  : isBot
                                  ? 'bg-[#142030] text-amber-200/90 border border-amber-500/15 rounded-bl-xs'
                                  : 'bg-[#142030] text-slate-100 border border-white/[0.06] rounded-bl-xs'
                              }`}
                            >
                              <p className="whitespace-pre-wrap">{msg.content}</p>

                              {/* Timestamp e Status */}
                              <div
                                className={`flex items-center gap-1.5 mt-1.5 text-[10px] ${
                                  isOperator ? 'justify-end text-cyan-200/70' : 'text-[#8a9ba8]'
                                }`}
                              >
                                <span>
                                  {new Date(msg.createdAt || Date.now()).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                                {isOperator && (
                                  <CheckCheck className="w-3.5 h-3.5 text-cyan-400" />
                                )}
                              </div>
                            </div>

                            {/* Reação de Coração Flutuante */}
                            <button
                              onClick={() => toggleReaction(msg.id)}
                              className={`absolute -bottom-2 right-2 w-6 h-6 rounded-full flex items-center justify-center border shadow-md transition-transform active:scale-125 ${
                                isHearted
                                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-500'
                                  : 'bg-[#101c2b] border-white/[0.1] text-transparent hover:text-rose-400 group-hover:opacity-100 opacity-0'
                              }`}
                            >
                              <Heart className={`w-3.5 h-3.5 ${isHearted ? 'fill-rose-500' : ''}`} />
                            </button>
                          </div>

                          {/* Avatar à direita para operador */}
                          {isOperator && (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#ff5722] to-[#ff6b35] flex items-center justify-center text-xs font-bold text-white flex-shrink-0 shadow-sm">
                              {operator?.name?.slice(0, 1) || 'A'}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Barra de Entrada de Texto (Chat Input Footer) */}
                <div className="p-4 bg-[#101c2b]/95 border-t border-white/[0.08] relative">
                  {/* Dropdown de Respostas Rápidas com barra / */}
                  {showCannedDropdown && (
                    <div className="absolute bottom-full left-4 right-4 mb-2 bg-[#142030] border border-white/[0.1] rounded-2xl p-2 shadow-2xl z-30 max-h-48 overflow-y-auto">
                      <div className="text-[10px] font-bold text-[#8a9ba8] uppercase tracking-wider px-2 py-1 mb-1">
                        Respostas Rápidas (Pressione para inserir):
                      </div>
                      {cannedFiltered.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => handleSelectCanned(c.content)}
                          className="px-3 py-2 rounded-xl hover:bg-white/[0.06] cursor-pointer text-xs transition-colors"
                        >
                          <span className="font-bold text-[#ff5722] mr-2">{c.shortcut}</span>
                          <span className="text-white font-medium">{c.title}</span>
                          <p className="text-[11px] text-[#8a9ba8] truncate">{c.content}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <form onSubmit={handleSendMessage} className="flex items-center gap-2.5">
                    {/* Botão de Anexo */}
                    <button
                      type="button"
                      onClick={() => alert('Envio de anexos liberado para fotos e documentos')}
                      className="p-2.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-[#8a9ba8] hover:text-white transition-colors"
                      title="Anexar arquivo"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>

                    {/* Input Pill */}
                    <div className="flex-1 relative flex items-center">
                      <input
                        type="text"
                        placeholder="Type a message... (digite / para respostas rápidas)"
                        value={inputText}
                        onChange={handleInputChange}
                        className="w-full pl-4 pr-10 py-3 bg-[#0a111a] border border-white/[0.08] rounded-full text-xs text-white placeholder-[#8a9ba8] focus:outline-none focus:border-[#ff5722] transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setInputText((prev) => prev + ' 😊')}
                        className="absolute right-3 text-[#8a9ba8] hover:text-amber-400 transition-colors"
                      >
                        <Smile className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Botão de Envio Primário Laranja */}
                    <button
                      type="submit"
                      disabled={!inputText.trim()}
                      className="py-3 px-5 rounded-full bg-gradient-to-r from-[#ff5722] to-[#ff6b35] hover:opacity-95 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-[#ff5722]/25 transition-all"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send</span>
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[#8a9ba8]">
                <div className="w-16 h-16 rounded-3xl bg-[#101c2b] border border-white/[0.08] flex items-center justify-center mb-4 text-[#ff5722] shadow-xl">
                  <MessageSquare className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-white mb-1">Nenhum chat selecionado</h3>
                <p className="text-xs max-w-sm">
                  Selecione uma conversa na lista ao lado para iniciar o atendimento em tempo real.
                </p>
              </div>
            )}
          </main>

          {/* ======================================================================= */}
          {/* COLUNA 4: BARRA LATERAL DIREITA (Widgets de Engajamento & Ficha)        */}
          {/* ======================================================================= */}
          {showRightDetails && (
            <aside className="w-80 min-w-[20rem] bg-[#0d1724] border-l border-white/[0.08] flex flex-col justify-between overflow-y-auto p-4 z-30">
              <div>
                {/* Topo: Header com Controles Globais e Perfil Alex Morgan */}
                <div className="flex items-center justify-between pb-4 border-b border-white/[0.08] mb-5">
                  <div className="flex items-center gap-2">
                    <button className="p-2 rounded-xl bg-white/[0.04] text-[#8a9ba8] hover:text-white transition-colors">
                      <Search className="w-4 h-4" />
                    </button>
                    <div className="relative">
                      <button className="p-2 rounded-xl bg-white/[0.04] text-[#8a9ba8] hover:text-white transition-colors">
                        <Bell className="w-4 h-4" />
                      </button>
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#ff5722] text-white text-[9px] font-bold flex items-center justify-center shadow-md">
                        12
                      </span>
                    </div>
                  </div>

                  {/* Perfil do Usuário */}
                  <div className="flex items-center gap-2 cursor-pointer bg-white/[0.04] hover:bg-white/[0.08] px-2.5 py-1.5 rounded-2xl border border-white/[0.06] transition-all">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#1e3a5f] to-[#ff5722] flex items-center justify-center font-bold text-xs text-white">
                      {operator?.name?.slice(0, 1) || 'A'}
                    </div>
                    <span className="text-xs font-semibold text-white max-w-[5rem] truncate">
                      {operator?.name?.split(' ')[0] || 'Alex'}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-[#8a9ba8]" />
                  </div>
                </div>

                {/* Subtítulo da Sessão */}
                <div className="mb-5">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Member Chat</h4>
                  <p className="text-[11px] text-[#8a9ba8]">Connect. Share. Grow Together.</p>
                </div>

                {/* Widget "Active Now" com Facepile e Contador */}
                <div className="bg-[#101c2b] border border-white/[0.08] rounded-3xl p-4.5 mb-5 shadow-xl">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-white">
                      <Users className="w-4 h-4 text-[#ff5722]" />
                      <span>Active Now</span>
                    </div>
                    <span className="text-[11px] font-semibold text-[#22c55e] flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                      128 Online
                    </span>
                  </div>

                  {/* Facepile (Stack de Avatares Sobrepostos) */}
                  <div className="flex items-center -space-x-2 mb-3.5">
                    <div className="w-7 h-7 rounded-full bg-blue-600 border-2 border-[#101c2b] flex items-center justify-center text-[10px] font-bold text-white">JD</div>
                    <div className="w-7 h-7 rounded-full bg-purple-600 border-2 border-[#101c2b] flex items-center justify-center text-[10px] font-bold text-white">SB</div>
                    <div className="w-7 h-7 rounded-full bg-emerald-600 border-2 border-[#101c2b] flex items-center justify-center text-[10px] font-bold text-white">RC</div>
                    <div className="w-7 h-7 rounded-full bg-amber-600 border-2 border-[#101c2b] flex items-center justify-center text-[10px] font-bold text-white">AL</div>
                    <div className="w-7 h-7 rounded-full bg-[#1e3a5f] border-2 border-[#101c2b] flex items-center justify-center text-[10px] font-bold text-white">+124</div>
                  </div>

                  <button
                    onClick={() => setActiveNav('flowbuilder')}
                    className="w-full py-2 px-3 rounded-xl bg-white/[0.04] hover:bg-[#ff5722]/15 text-[#ff5722] border border-[#ff5722]/30 font-bold text-[11px] flex items-center justify-center gap-1 transition-all"
                  >
                    <span>Configurar Triagem Automática →</span>
                  </button>
                </div>

                {/* Detalhes do Atendimento Ativo */}
                {activeTicket ? (
                  <div className="bg-[#101c2b] border border-white/[0.08] rounded-3xl p-4.5 space-y-4 shadow-xl">
                    <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
                      <h5 className="text-xs font-bold text-white">Ficha do Solicitante</h5>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-[#8a9ba8] font-mono">
                        {activeTicket.status}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-[#8a9ba8]">Prefixo:</span>
                        <span className="text-white font-bold">#{activeTicket.driver?.prefixo || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#8a9ba8]">Telefone:</span>
                        <span className="text-white font-mono">{activeTicket.driver?.phone || 'N/A'}</span>
                      </div>
                      {activeTicket.driver?.plate && (
                        <div className="flex justify-between">
                          <span className="text-[#8a9ba8]">Placa:</span>
                          <span className="text-amber-400 font-mono font-bold">{activeTicket.driver.plate}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-[#8a9ba8]">Fila Atual:</span>
                        <span className="text-emerald-400 font-semibold">{activeTicket.department?.name || 'Geral'}</span>
                      </div>
                    </div>

                    {/* Transferir Fila Button */}
                    <button
                      onClick={() => setTransferModalOpen(true)}
                      className="w-full py-2 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[#8a9ba8] hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <GitBranch className="w-3.5 h-3.5 text-[#ff5722]" />
                      <span>Transferir de Fila</span>
                    </button>

                    {/* Notas Internas Confidenciais */}
                    <div className="pt-2">
                      <label className="block text-[11px] font-bold text-white mb-1.5 flex items-center justify-between">
                        <span>Notas Internas (Equipe)</span>
                        {notesSavedSuccess && (
                          <span className="text-[#22c55e] text-[10px]">Salvo!</span>
                        )}
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Anotações confidenciais que o motorista não visualiza..."
                        value={internalNotes}
                        onChange={(e) => setInternalNotes(e.target.value)}
                        className="w-full p-2.5 bg-[#0a111a] border border-white/[0.08] rounded-xl text-xs text-white placeholder-[#8a9ba8] focus:outline-none focus:border-[#ff5722] transition-colors resize-none mb-2"
                      />
                      <button
                        onClick={handleSaveNotes}
                        disabled={notesSaving}
                        className="w-full py-1.5 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Save className="w-3.5 h-3.5 text-[#ff5722]" />
                        <span>{notesSaving ? 'Salvando...' : 'Salvar Anotação'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-3xl bg-[#101c2b] border border-white/[0.06] text-center text-[#8a9ba8] text-xs">
                    <Info className="w-5 h-5 mx-auto mb-2 text-[#ff5722]" />
                    Selecione um chamado para ver a ficha completa e notas internas.
                  </div>
                )}
              </div>
            </aside>
          )}
        </>
      ) : activeNav === 'flowbuilder' ? (
        /* ======================================================================= */
        /* VIEW FLOWBUILDER: CONSTRUTOR DE FLUXO E TRIAGEM DO BOT                 */
        /* ======================================================================= */
        <main className="flex-1 bg-[#0a111a] overflow-y-auto p-8">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/[0.08]">
              <div>
                <div className="flex items-center gap-2 text-xs text-[#ff5722] font-bold uppercase tracking-wider mb-1">
                  <GitBranch className="w-4 h-4" />
                  <span>Automação & Triagem</span>
                </div>
                <h1 className="text-2xl font-bold text-white tracking-tight">FlowBuilder de Respostas e Filas</h1>
                <p className="text-xs text-[#8a9ba8] mt-1">
                  Configure as opções do bot interativo para direcionar os motoristas automaticamente para as filas certas.
                </p>
              </div>

              <button
                onClick={handleSaveFlow}
                disabled={flowSaving}
                className="py-2.5 px-5 rounded-2xl bg-gradient-to-r from-[#ff5722] to-[#ff6b35] hover:opacity-95 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-[#ff5722]/20 transition-all"
              >
                {flowSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{flowSavedSuccess ? 'Publicado com Sucesso!' : 'Salvar e Publicar Fluxo'}</span>
              </button>
            </div>

            {/* Passo 1: Mensagem de Boas-Vindas */}
            <div className="bg-[#101c2b] border border-white/[0.08] rounded-3xl p-6 mb-6 shadow-xl">
              <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#ff5722]/20 text-[#ff5722] flex items-center justify-center text-xs">1</span>
                <span>Mensagem de Boas-Vindas (Abertura do Atendimento)</span>
              </h3>
              <p className="text-xs text-[#8a9ba8] mb-3">
                Texto que o motorista ou cliente recebe assim que abre o chat:
              </p>
              <textarea
                rows={3}
                value={flowWelcome}
                onChange={(e) => setFlowWelcome(e.target.value)}
                className="w-full p-3 bg-[#0a111a] border border-white/[0.08] rounded-2xl text-xs text-white focus:outline-none focus:border-[#ff5722] transition-colors resize-none"
              />
            </div>

            {/* Passo 2: Nós de Triagem e Direcionamento */}
            <div className="bg-[#101c2b] border border-white/[0.08] rounded-3xl p-6 mb-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#ff5722]/20 text-[#ff5722] flex items-center justify-center text-xs">2</span>
                  <span>Opções do Menu & Fila de Destino</span>
                </h3>
                <button
                  onClick={handleAddFlowNode}
                  className="py-1.5 px-3 rounded-xl bg-white/[0.06] hover:bg-[#ff5722] hover:text-white text-xs font-semibold text-[#8a9ba8] transition-all flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar Opção</span>
                </button>
              </div>

              <div className="space-y-3">
                {flowNodes.map((node, idx) => (
                  <div
                    key={node.id}
                    className="p-4 rounded-2xl bg-[#0a111a] border border-white/[0.08] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <span className="w-8 h-8 rounded-xl bg-[#1e3a5f] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {node.id}
                      </span>
                      <input
                        type="text"
                        value={node.label}
                        onChange={(e) => {
                          const updated = [...flowNodes];
                          updated[idx].label = e.target.value;
                          setFlowNodes(updated);
                        }}
                        className="bg-transparent border-b border-white/[0.1] focus:border-[#ff5722] text-xs text-white font-bold py-1 px-1 focus:outline-none w-full sm:w-64"
                      />
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-[#8a9ba8]">Direcionar para:</span>
                        <select
                          value={node.departmentSlug}
                          onChange={(e) => {
                            const updated = [...flowNodes];
                            updated[idx].departmentSlug = e.target.value;
                            setFlowNodes(updated);
                          }}
                          className="bg-[#101c2b] border border-white/[0.1] rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#ff5722]"
                        >
                          {departments.map((d) => (
                            <option key={d.id} value={d.slug}>{d.name}</option>
                          ))}
                        </select>
                      </div>

                      <button
                        onClick={() => {
                          if (flowNodes.length <= 1) return;
                          setFlowNodes(flowNodes.filter((_, i) => i !== idx));
                        }}
                        className="p-1.5 text-[#8a9ba8] hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Passo 3: Mensagem Fallback */}
            <div className="bg-[#101c2b] border border-white/[0.08] rounded-3xl p-6 shadow-xl">
              <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#ff5722]/20 text-[#ff5722] flex items-center justify-center text-xs">3</span>
                <span>Resposta de Opção Inválida (Fallback)</span>
              </h3>
              <input
                type="text"
                value={flowFallback}
                onChange={(e) => setFlowFallback(e.target.value)}
                className="w-full p-3 bg-[#0a111a] border border-white/[0.08] rounded-2xl text-xs text-white focus:outline-none focus:border-[#ff5722] transition-colors"
              />
            </div>
          </div>
        </main>
      ) : activeNav === 'team' ? (
        /* ======================================================================= */
        /* VIEW EQUIPE & ACESSOS: GESTÃO DE OPERADORES E ADMINS                    */
        /* ======================================================================= */
        <main className="flex-1 bg-[#0a111a] overflow-y-auto p-8">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/[0.08]">
              <div>
                <div className="flex items-center gap-2 text-xs text-[#ff5722] font-bold uppercase tracking-wider mb-1">
                  <Users className="w-4 h-4" />
                  <span>Gestão de Usuários</span>
                </div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Equipe & Acessos da Central</h1>
                <p className="text-xs text-[#8a9ba8] mt-1">
                  Cadastre atendentes, operadores e defina quais filas cada pessoa pode atender.
                </p>
              </div>

              <button
                onClick={() => setTeamModalOpen(true)}
                className="py-2.5 px-4 rounded-2xl bg-gradient-to-r from-[#ff5722] to-[#ff6b35] hover:opacity-95 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-[#ff5722]/20 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>+ Novo Membro da Equipe</span>
              </button>
            </div>

            {/* Tabela de Membros */}
            <div className="bg-[#101c2b] border border-white/[0.08] rounded-3xl overflow-hidden shadow-xl">
              <div className="p-4 border-b border-white/[0.08] flex items-center justify-between">
                <span className="text-xs font-bold text-white uppercase tracking-wider">Membros Ativos ({teamList.length})</span>
              </div>
              <div className="divide-y divide-white/[0.06]">
                {teamList.map((member) => (
                  <div key={member.id} className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#1e3a5f] to-[#ff5722] flex items-center justify-center font-bold text-xs text-white">
                        {member.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">{member.name}</h4>
                        <p className="text-[11px] text-[#8a9ba8]">{member.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        member.role === 'ORG_ADMIN' || member.role === 'SUPERADMIN'
                          ? 'bg-amber-500/15 text-amber-400'
                          : 'bg-blue-500/15 text-blue-400'
                      }`}>
                        {member.role === 'ORG_ADMIN' ? 'Administrador' : 'Operador'}
                      </span>

                      <div className="flex items-center gap-1 max-w-xs flex-wrap justify-end">
                        {member.departments && member.departments.length > 0 ? (
                          member.departments.map((d) => (
                            <span key={d.id} className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-[#8a9ba8]">
                              {d.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-[#8a9ba8] italic">Todas as filas</span>
                        )}
                      </div>

                      {member.id !== operator?.userId && (
                        <button
                          onClick={() => handleDeleteUser(member.id)}
                          className="p-1.5 text-[#8a9ba8] hover:text-rose-400 transition-colors"
                          title="Remover Usuário"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      ) : activeNav === 'queues' ? (
        /* ======================================================================= */
        /* VIEW FILAS & DEPARTAMENTOS: GESTÃO DE SETORES                           */
        /* ======================================================================= */
        <main className="flex-1 bg-[#0a111a] overflow-y-auto p-8">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/[0.08]">
              <div>
                <div className="flex items-center gap-2 text-xs text-[#ff5722] font-bold uppercase tracking-wider mb-1">
                  <Layers className="w-4 h-4" />
                  <span>Filas de Atendimento</span>
                </div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Setores & Departamentos</h1>
                <p className="text-xs text-[#8a9ba8] mt-1">
                  Organize seus atendimentos por fila para direcionar os motoristas e clientes.
                </p>
              </div>
            </div>

            {/* Criar Nova Fila */}
            <form onSubmit={handleCreateDepartment} className="bg-[#101c2b] border border-white/[0.08] rounded-3xl p-5 mb-6 flex items-center gap-3 shadow-xl">
              <input
                type="text"
                placeholder="Nome da Nova Fila (ex: Ouvidoria, RH, Vendas)..."
                value={newDeptName}
                onChange={(e) => setNewDeptName(e.target.value)}
                className="flex-1 p-3 bg-[#0a111a] border border-white/[0.08] rounded-2xl text-xs text-white focus:outline-none focus:border-[#ff5722]"
              />
              <button
                type="submit"
                disabled={deptSubmitting || !newDeptName.trim()}
                className="py-3 px-5 rounded-2xl bg-[#ff5722] hover:bg-[#ff6b35] disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-[#ff5722]/20"
              >
                <Plus className="w-4 h-4" />
                <span>Adicionar Fila</span>
              </button>
            </form>

            {/* Grid de Filas */}
            <div className="grid sm:grid-cols-2 gap-4">
              {departments.map((dept) => (
                <div key={dept.id} className="p-5 rounded-3xl bg-[#101c2b] border border-white/[0.08] shadow-xl flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white">{dept.name}</h4>
                    <p className="text-[11px] text-[#8a9ba8] font-mono mt-0.5">slug: {dept.slug}</p>
                  </div>
                  <div className="w-8 h-8 rounded-xl bg-white/[0.04] flex items-center justify-center text-[#ff5722]">
                    <Layers className="w-4 h-4" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      ) : (
        /* ======================================================================= */
        /* VIEW RESPOSTAS RÁPIDAS (CANNED RESPONSES)                               */
        /* ======================================================================= */
        <main className="flex-1 bg-[#0a111a] overflow-y-auto p-8">
          <div className="max-w-4xl mx-auto">
            <div className="mb-8 pb-4 border-b border-white/[0.08]">
              <div className="flex items-center gap-2 text-xs text-[#ff5722] font-bold uppercase tracking-wider mb-1">
                <Sparkles className="w-4 h-4" />
                <span>Agilidade no Chat</span>
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Respostas Rápidas com Barra /</h1>
              <p className="text-xs text-[#8a9ba8] mt-1">
                Cadastre mensagens prontas para seus atendentes responderem com 1 toque no chat digitando <code className="text-[#ff5722]">/</code>.
              </p>
            </div>

            <div className="space-y-3">
              {cannedResponses.map((item) => (
                <div key={item.id} className="p-4 rounded-3xl bg-[#101c2b] border border-white/[0.08] shadow-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-[#ff5722] text-xs font-mono">{item.shortcut}</span>
                    <span className="text-xs font-bold text-white">{item.title}</span>
                  </div>
                  <p className="text-xs text-[#8a9ba8] bg-[#0a111a] p-3 rounded-2xl border border-white/[0.04] leading-relaxed">
                    {item.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </main>
      )}

      {/* ========================================================================= */}
      {/* MODAL: TRANSFERÊNCIA DE FILA                                              */}
      {/* ========================================================================= */}
      {transferModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#101c2b] border border-white/[0.1] rounded-3xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-[#ff5722]" />
              <span>Transferir Atendimento</span>
            </h3>
            <p className="text-xs text-[#8a9ba8] mb-4">
              Selecione o novo departamento para encaminhar o chamado de {activeTicket?.driver?.name}:
            </p>
            <div className="space-y-2 mb-6">
              {departments.map((dept) => (
                <div
                  key={dept.id}
                  onClick={() => setSelectedTransferDept(dept.id)}
                  className={`p-3 rounded-2xl cursor-pointer text-xs font-semibold transition-all ${
                    selectedTransferDept === dept.id
                      ? 'bg-[#ff5722] text-white shadow-md'
                      : 'bg-[#0a111a] text-[#8a9ba8] hover:text-white border border-white/[0.06]'
                  }`}
                >
                  {dept.name}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setTransferModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/[0.06] text-xs font-semibold text-[#8a9ba8] hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={handleTransferTicket}
                disabled={!selectedTransferDept}
                className="flex-1 py-2.5 rounded-xl bg-[#ff5722] hover:bg-[#ff6b35] disabled:opacity-40 text-xs font-bold text-white shadow-md shadow-[#ff5722]/30"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: NOVO MEMBRO DA EQUIPE                                              */}
      {/* ========================================================================= */}
      {teamModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#101c2b] border border-white/[0.1] rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/[0.08]">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <User className="w-4 h-4 text-[#ff5722]" />
                <span>Novo Usuário da Equipe</span>
              </h3>
              <button onClick={() => setTeamModalOpen(false)} className="text-[#8a9ba8] hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[#8a9ba8] mb-1 font-semibold">Nome Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Carlos Silva"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full p-2.5 bg-[#0a111a] border border-white/[0.08] rounded-xl text-white focus:outline-none focus:border-[#ff5722]"
                />
              </div>

              <div>
                <label className="block text-[#8a9ba8] mb-1 font-semibold">E-mail de Acesso *</label>
                <input
                  type="email"
                  required
                  placeholder="Ex: carlos@empresa.com.br"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full p-2.5 bg-[#0a111a] border border-white/[0.08] rounded-xl text-white focus:outline-none focus:border-[#ff5722]"
                />
              </div>

              <div>
                <label className="block text-[#8a9ba8] mb-1 font-semibold">Senha Inicial *</label>
                <input
                  type="password"
                  required
                  placeholder="Mínimo 6 caracteres"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="w-full p-2.5 bg-[#0a111a] border border-white/[0.08] rounded-xl text-white focus:outline-none focus:border-[#ff5722]"
                />
              </div>

              <div>
                <label className="block text-[#8a9ba8] mb-1 font-semibold">Nível de Permissão</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNewUserRole('OPERATOR')}
                    className={`flex-1 py-2 rounded-xl font-bold transition-all ${
                      newUserRole === 'OPERATOR'
                        ? 'bg-[#ff5722] text-white shadow-sm'
                        : 'bg-[#0a111a] text-[#8a9ba8] border border-white/[0.06]'
                    }`}
                  >
                    Operador (Atendimento)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewUserRole('ADMIN')}
                    className={`flex-1 py-2 rounded-xl font-bold transition-all ${
                      newUserRole === 'ADMIN'
                        ? 'bg-[#ff5722] text-white shadow-sm'
                        : 'bg-[#0a111a] text-[#8a9ba8] border border-white/[0.06]'
                    }`}
                  >
                    Administrador
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={teamSubmitting}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#ff5722] to-[#ff6b35] text-white font-bold text-xs shadow-lg shadow-[#ff5722]/20 flex items-center justify-center gap-1.5"
                >
                  {teamSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                  <span>Cadastrar Membro</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
