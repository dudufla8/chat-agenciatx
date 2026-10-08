'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ShieldAlert, Car, Loader2, ArrowRight } from 'lucide-react';

function DriverAuthContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    const mode = searchParams.get('mode');

    // Avulso Signup Mode
    if (mode === 'signup') {
      router.replace('/driver/signup');
      return;
    }

    // Missing Token
    if (!token) {
      setLoading(false);
      setError('Acesso restrito. Abra o chat pelo aplicativo do motorista.');
      return;
    }

    // Authenticate with SSO API
    async function doAuth() {
      try {
        const res = await fetch('/api/auth/driver-sso', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const data = await res.json();

        if (res.ok && data.success) {
          // Success! Redirect to chat view
          router.replace('/driver/chat');
        } else {
          setError(data.error || 'Acesso restrito. Abra o chat pelo aplicativo do motorista.');
          setLoading(false);
        }
      } catch {
        setError('Acesso restrito. Abra o chat pelo aplicativo do motorista.');
        setLoading(false);
      }
    }

    doAuth();
  }, [searchParams, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-6 animate-pulse">
          <Car className="w-8 h-8 text-amber-400" />
        </div>
        <div className="flex items-center gap-3 text-slate-300 font-medium mb-2">
          <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
          <span>Validando credenciais do motorista...</span>
        </div>
        <p className="text-xs text-slate-500 max-w-xs">
          Verificando identificação e autorização com a central da frota.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-sm">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-6">
          <ShieldAlert className="w-8 h-8 text-rose-500" />
        </div>

        <h1 className="text-xl font-bold text-white mb-3">
          Acesso Restrito
        </h1>

        <p className="text-sm text-slate-300 mb-6 leading-relaxed bg-rose-950/30 border border-rose-900/40 p-4 rounded-xl">
          {error || 'Abra o chat pelo aplicativo do motorista.'}
        </p>

        <p className="text-xs text-slate-400 mb-6">
          Por motivos de segurança e identificação da frota, este canal só pode ser acessado através do botão de suporte no seu aplicativo oficial Táxi Digital.
        </p>

        <div className="pt-4 border-t border-slate-800 flex flex-col gap-3">
          <a
            href="/driver/signup"
            className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-colors shadow-lg shadow-amber-500/20"
          >
            <span>Quero me cadastrar como motorista</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
}

export default function DriverAuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-amber-400 mb-4" />
          <p className="text-xs text-slate-400">Carregando autenticação...</p>
        </div>
      }
    >
      <DriverAuthContent />
    </Suspense>
  );
}
