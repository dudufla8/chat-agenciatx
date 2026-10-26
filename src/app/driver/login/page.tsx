'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Car,
  ShieldCheck,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Hash,
  FileText,
  UserCheck
} from 'lucide-react';

function DriverLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [prefixo, setPrefixo] = useState('');
  const [plate, setPlate] = useState('');
  const [cpfDigits, setCpfDigits] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restoredDriver, setRestoredDriver] = useState<any>(null);

  useEffect(() => {
    // 1. Prefill from URL query params (e.g. from WhatsApp direct link)
    const urlPrefixo = searchParams.get('prefixo') || searchParams.get('prefix') || '';
    const urlPlate = searchParams.get('placa') || searchParams.get('plate') || '';
    const urlCpf = searchParams.get('cpf') || '';

    if (urlPrefixo) setPrefixo(urlPrefixo);
    if (urlPlate) setPlate(urlPlate.toUpperCase());
    if (urlCpf) setCpfDigits(urlCpf);

    // 2. Check existing session (Cookie or LocalStorage)
    async function verifyExistingSession() {
      try {
        const localToken = localStorage.getItem('driver_session_token');
        const res = await fetch('/api/auth/driver-session', {
          headers: localToken ? { Authorization: `Bearer ${localToken}` } : {},
        });

        const data = await res.json();
        if (res.ok && data.authenticated && data.driver) {
          setRestoredDriver(data.driver);
          // Auto-redirect after brief visual feedback
          setTimeout(() => {
            router.replace('/driver/chat');
          }, 1200);
          return;
        }
      } catch {
        // Continue to manual login
      } finally {
        setCheckingSession(false);
      }
    }

    verifyExistingSession();
  }, [searchParams, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanPrefixo = prefixo.trim();
    if (!cleanPrefixo) {
      setError('Por favor, digite o número do seu Prefixo.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/driver-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prefixo: cleanPrefixo,
          plate: plate.trim().toUpperCase() || undefined,
          cpfDigits: cpfDigits.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Não foi possível validar seus dados. Verifique o prefixo e placa.');
        setLoading(false);
        return;
      }

      // Save to localStorage for persistent mobile session
      if (rememberMe && data.token) {
        localStorage.setItem('driver_session_token', data.token);
        localStorage.setItem('driver_profile', JSON.stringify(data.driver));
      }

      // Success -> Redirect to active chat
      router.replace('/driver/chat');
    } catch {
      setError('Falha de conexão com a Central. Verifique sua internet e tente novamente.');
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[#060b11] flex flex-col items-center justify-center p-6 text-center text-white">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#ff5722] via-[#ff6b35] to-[#1e3a5f] p-0.5 mb-5 shadow-2xl shadow-[#ff5722]/30 animate-pulse">
          <div className="w-full h-full bg-[#0a111a] rounded-[22px] flex items-center justify-center font-black text-xl text-white">
            TX
          </div>
        </div>
        <div className="flex items-center gap-2.5 text-sm font-semibold text-slate-200 mb-2">
          <Loader2 className="w-4 h-4 animate-spin text-[#ff5722]" />
          <span>Verificando identificação...</span>
        </div>
        <p className="text-xs text-[#8a9ba8]">Buscando sessão salva no dispositivo</p>
      </div>
    );
  }

  if (restoredDriver) {
    return (
      <div className="min-h-screen bg-[#060b11] flex flex-col items-center justify-center p-6 text-center text-white">
        <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-5 text-emerald-400 shadow-xl shadow-emerald-500/10">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h2 className="text-base font-bold text-white mb-1">
          Bem-vindo de volta, {restoredDriver.name?.split(' ')[0]}!
        </h2>
        <p className="text-xs text-emerald-400 font-semibold mb-4">
          Prefixo #{restoredDriver.prefixo} identificado
        </p>
        <div className="flex items-center gap-2 text-xs text-[#8a9ba8]">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#ff5722]" />
          <span>Abrindo chat com a Central...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060b11] flex flex-col justify-center items-center p-4 text-white font-sans antialiased">
      <div className="w-full max-w-sm bg-[#0a111a] border border-white/[0.08] rounded-3xl p-6 sm:p-7 shadow-2xl backdrop-blur-md">
        {/* Top Header Badge */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#ff5722] via-[#ff6b35] to-[#1e3a5f] flex items-center justify-center font-black text-base text-white shadow-lg shadow-[#ff5722]/30">
              TX
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-wide">Central de Atendimento</h1>
              <span className="text-[11px] text-[#8a9ba8]">Canal Direto do Motorista</span>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
            Online
          </span>
        </div>

        {/* Subtitle */}
        <div className="mb-5 p-3 rounded-2xl bg-[#101c2b] border border-white/[0.06]">
          <p className="text-xs text-slate-300 leading-relaxed">
            Informe seu <strong>Prefixo</strong> e confirme a <strong>Placa</strong> para acessar a fila e falar em tempo real com a equipe.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-start gap-2.5 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-[#ff5722]" />
              <span>Número do Prefixo *</span>
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                required
                placeholder="Ex: 101"
                value={prefixo}
                onChange={(e) => setPrefixo(e.target.value)}
                className="w-full py-3 px-4 bg-[#101c2b] border border-white/[0.1] rounded-2xl text-white font-bold text-base focus:outline-none focus:border-[#ff5722] focus:ring-1 focus:ring-[#ff5722] transition-all placeholder:text-[#8a9ba8]/40"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Car className="w-3.5 h-3.5 text-[#ff5722]" />
              <span>Placa do Carro (ou últimos 4 dígitos)</span>
            </label>
            <input
              type="text"
              placeholder="Ex: BRA-2E19 ou 2E19"
              value={plate}
              onChange={(e) => setPlate(e.target.value.toUpperCase())}
              className="w-full py-3 px-4 bg-[#101c2b] border border-white/[0.1] rounded-2xl text-white font-semibold text-sm focus:outline-none focus:border-[#ff5722] focus:ring-1 focus:ring-[#ff5722] transition-all uppercase placeholder:text-[#8a9ba8]/40"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#8a9ba8]" />
              <span className="text-slate-400">Primeiros 3 dígitos do CPF (opcional)</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={3}
              placeholder="Ex: 123"
              value={cpfDigits}
              onChange={(e) => setCpfDigits(e.target.value)}
              className="w-full py-2.5 px-4 bg-[#101c2b] border border-white/[0.08] rounded-2xl text-white text-xs focus:outline-none focus:border-[#ff5722] transition-all placeholder:text-[#8a9ba8]/40"
            />
          </div>

          {/* Remember Me */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="rememberMe"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-[#101c2b] text-[#ff5722] focus:ring-0 focus:ring-offset-0 cursor-pointer accent-[#ff5722]"
            />
            <label htmlFor="rememberMe" className="text-xs text-[#8a9ba8] cursor-pointer select-none">
              Manter conectado neste celular (30 dias)
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#ff5722] to-[#ff6b35] hover:brightness-110 active:scale-98 text-white font-bold text-sm shadow-xl shadow-[#ff5722]/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Identificando na Central...</span>
              </>
            ) : (
              <>
                <span>Entrar no Chat da Central</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Security badge footer */}
        <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-center gap-1.5 text-[11px] text-[#8a9ba8]">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Acesso seguro verificado pela frota</span>
        </div>
      </div>
    </div>
  );
}

export default function DriverLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#060b11] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#ff5722]" />
        </div>
      }
    >
      <DriverLoginContent />
    </Suspense>
  );
}
