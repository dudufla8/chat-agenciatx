'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Car,
  Headphones,
  KeyRound,
  ExternalLink,
  ShieldCheck,
  Smartphone,
  Server,
  Layers,
  ArrowRight,
  UserPlus
} from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const [selectedPrefixo, setSelectedPrefixo] = useState('101');
  const [generatingToken, setGeneratingToken] = useState(false);

  const handleLaunchDriverSso = async () => {
    setGeneratingToken(true);
    try {
      const res = await fetch('/api/demo/generate-sso-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefixo: selectedPrefixo }),
      });
      const data = await res.json();
      if (data.success && data.authUrl) {
        window.open(data.authUrl, '_blank');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingToken(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-6">
      <div className="max-w-5xl mx-auto w-full pt-10 pb-16">
        {/* Hero Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-4">
            <Car className="w-4 h-4" />
            <span>SaaS Omnichannel Multi-Tenant • Frotas & Operações</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight mb-4">
            Central de Atendimento <span className="text-amber-400">TX Omnichannel</span>
          </h1>
          <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Plataforma corporativa de Help Desk, triagem automatizada com máquina de estados, autenticação In-App SSO integrada e gestão de filas de atendimento em tempo real.
          </p>
        </div>

        {/* Action Grid */}
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Card 1: Operator Desktop Dashboard */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 flex flex-col justify-between shadow-2xl hover:border-slate-700 transition-all">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-6">
                <Headphones className="w-7 h-7 text-blue-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Painel do Atendente (Central)</h2>
              <p className="text-xs text-slate-400 leading-relaxed mb-6">
                Interface desktop para operadores humanos com fila de triagem, atalhos rápidos com barra <code className="text-amber-400">/</code>, ficha cadastral do motorista e notas internas confidenciais.
              </p>
              <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 text-xs text-slate-400 mb-6 space-y-1">
                <div>Credenciais de Demonstração:</div>
                <div className="text-white font-mono">operador@taxifrota.com.br / admin123</div>
              </div>
            </div>

            <button
              onClick={() => router.push('/operator/login')}
              className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20 active:scale-98"
            >
              <span>Acessar Painel do Operador</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Card 2: Driver In-App SSO Simulator */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 flex flex-col justify-between shadow-2xl hover:border-slate-700 transition-all">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-6">
                <Smartphone className="w-7 h-7 text-amber-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Simulador de Acesso (Motorista In-App SSO)</h2>
              <p className="text-xs text-slate-400 leading-relaxed mb-6">
                Gera um token JWT assinado com a chave secreta <code className="text-amber-400">DRIVER_SSO_SECRET</code> e abre a tela mobile simulando o clique no botão do app mobile do motorista.
              </p>

              <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 mb-6">
                <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                  Selecione o Prefixo do Motorista:
                </label>
                <select
                  value={selectedPrefixo}
                  onChange={(e) => setSelectedPrefixo(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="101">Prefixo 101 - Carlos Eduardo Oliveira (BRA-2E19)</option>
                  <option value="204">Prefixo 204 - Marcos Roberto Santos (SP-ABC1234)</option>
                  <option value="305">Prefixo 305 - Ana Paula Ferraz (SP-XYZ9876)</option>
                  <option value="555">Prefixo 555 - Roberto Da Silva Tavares (RIO-9A88)</option>
                </select>
              </div>
            </div>

            <div className="space-y-2.5">
              <button
                onClick={handleLaunchDriverSso}
                disabled={generatingToken}
                className="w-full py-3.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/20 active:scale-98 disabled:opacity-50"
              >
                <KeyRound className="w-4 h-4" />
                <span>{generatingToken ? 'Gerando Token SSO...' : 'Abrir Chat In-App (Nova Janela)'}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => router.push('/driver/signup')}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Novo Cadastro (?mode=signup)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Feature Badges */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
            <p className="text-xs font-semibold text-white">In-App SSO Zero-Login</p>
            <p className="text-[11px] text-slate-400 mt-1">Validação de token &lt; 5 min</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
            <p className="text-xs font-semibold text-white">Máquina de Estados</p>
            <p className="text-[11px] text-slate-400 mt-1">Triagem 100% estruturada</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
            <p className="text-xs font-semibold text-white">Meta / WhatsApp Ready</p>
            <p className="text-[11px] text-slate-400 mt-1">Módulo plugável & Webhook</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
            <p className="text-xs font-semibold text-white">Docker & Nginx</p>
            <p className="text-[11px] text-slate-400 mt-1">Deploy VPS Hostinger pronto</p>
          </div>
        </div>
      </div>

      <footer className="text-center text-xs text-slate-500 py-4 border-t border-slate-900">
        TX Omnichannel SaaS &bull; Agência TX IA &bull; Node.js, Next.js, Prisma, PostgreSQL, Redis, Socket.io
      </footer>
    </div>
  );
}
