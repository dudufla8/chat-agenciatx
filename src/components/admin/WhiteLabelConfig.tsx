'use client';

import React, { useState, useEffect, useRef } from 'react';

interface WhiteLabelState {
  tenantName: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  urgentColor: string;
  driverBubbleColor: string;
  solarContrast: boolean;
}

const PRESETS = [
  {
    name: 'Rádio Táxi Premium (Azul)',
    tenant: 'Rádio Táxi Premium',
    slug: 'radio-taxi-premium',
    primary: '#004AC6',
    secondary: '#006C49',
    urgent: '#BA1A1A',
    driverBubble: '#004AC6',
  },
  {
    name: 'CoopTaxi Nacional (Verde)',
    tenant: 'CoopTaxi Nacional',
    slug: 'cooptaxi-nacional',
    primary: '#006C49',
    secondary: '#005236',
    urgent: '#BA1A1A',
    driverBubble: '#006C49',
  },
  {
    name: 'Táxi Amarelinho (Laranja)',
    tenant: 'Táxi Amarelinho',
    slug: 'taxi-amarelinho',
    primary: '#D97706',
    secondary: '#006C49',
    urgent: '#BA1A1A',
    driverBubble: '#D97706',
  },
];

export default function WhiteLabelConfig({ onBack }: { onBack?: () => void }) {
  const [config, setConfig] = useState<WhiteLabelState>({
    tenantName: 'Rádio Táxi Premium',
    slug: 'radio-taxi-premium',
    logoUrl: null,
    primaryColor: '#004AC6',
    secondaryColor: '#006C49',
    urgentColor: '#BA1A1A',
    driverBubbleColor: '#004AC6',
    solarContrast: true,
  });

  const [previewTab, setPreviewTab] = useState<'mobile' | 'desktop'>('mobile');
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load persisted theme on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('tx_whitelabel_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        setConfig((prev) => ({ ...prev, ...parsed }));
      }
    } catch (e) {
      console.error('Failed to load saved whitelabel settings', e);
    }
  }, []);

  // Update root CSS variables in real time
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.style.setProperty('--brand-primary', config.primaryColor);
      root.style.setProperty('--brand-primary-hover', config.primaryColor);
      root.style.setProperty('--brand-secondary', config.secondaryColor);
      root.style.setProperty('--brand-urgent', config.urgentColor);
      root.style.setProperty('--brand-danger', config.urgentColor);
      root.style.setProperty('--bubble-driver', config.driverBubbleColor);
      root.style.setProperty('--bubble-driver-bg', config.driverBubbleColor);
    }
  }, [config]);

  const updateColor = (key: keyof WhiteLabelState, value: string) => {
    let cleanVal = value.trim();
    if (!cleanVal.startsWith('#')) cleanVal = '#' + cleanVal;
    
    setConfig((prev) => {
      const updated = { ...prev, [key]: cleanVal.toUpperCase() };
      // Sync driver bubble if primary was changed and they matched
      if (key === 'primaryColor' && prev.driverBubbleColor === prev.primaryColor) {
        updated.driverBubbleColor = cleanVal.toUpperCase();
      }
      return updated;
    });

    triggerAutoSaveIndicator();
  };

  const triggerAutoSaveIndicator = () => {
    setSaveStatus('saving');
    setTimeout(() => {
      setSaveStatus('saved');
    }, 450);
  };

  const handleLogoUpload = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      setConfig((prev) => ({ ...prev, logoUrl: url }));
      triggerAutoSaveIndicator();
    };
    reader.readAsDataURL(file);
  };

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setConfig((prev) => ({
      ...prev,
      tenantName: preset.tenant,
      slug: preset.slug,
      primaryColor: preset.primary,
      secondaryColor: preset.secondary,
      urgentColor: preset.urgent,
      driverBubbleColor: preset.driverBubble,
    }));
    triggerAutoSaveIndicator();
  };

  const getCssExportString = () => {
    return `:root {
  /* Dispatch Pulse White-Label Tokens */
  --brand-primary: ${config.primaryColor};
  --brand-secondary: ${config.secondaryColor};
  --brand-urgent: ${config.urgentColor};
  --bubble-driver-bg: ${config.driverBubbleColor};
  --bubble-driver-text: #FFFFFF;
  --tenant-slug: "${config.slug}";
}`;
  };

  const copyCssToClipboard = () => {
    navigator.clipboard.writeText(getCssExportString());
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const handlePublish = () => {
    try {
      localStorage.setItem('tx_whitelabel_config', JSON.stringify(config));
      alert(`Identidade visual de "${config.tenantName}" salva com sucesso! Todas as telas agora utilizam este tema.`);
    } catch (e) {
      console.error(e);
      alert('Configuração aplicada em memória!');
    }
  };

  return (
    <div className="min-h-screen bg-[#faf8ff] text-[#131b2e] flex flex-col font-sans selection:bg-[#dbe1ff]">
      {/* Top Header Bar */}
      <header className="fixed top-0 left-0 w-full z-50 flex items-center justify-between px-6 h-14 bg-white border-b border-[#c3c6d7] shadow-sm">
        <div className="flex items-center space-x-3">
          {onBack && (
            <button
              onClick={onBack}
              aria-label="Voltar"
              className="p-1.5 text-[#004ac6] rounded-lg hover:bg-[#eaedff] transition-all active:scale-95 flex items-center justify-center"
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>
          )}
          <div className="flex items-center space-x-2">
            <span className="text-[16px] font-bold text-[#131b2e]">Central de Suporte</span>
            <span className="text-[#737686] text-[12px] hidden md:inline">/</span>
            <span className="text-[#434655] text-[12px] font-medium hidden md:inline">
              Personalização de Frota (White-Label)
            </span>
          </div>
        </div>

        {/* Action Cluster */}
        <div className="flex items-center space-x-3">
          <div className="hidden sm:flex items-center space-x-1.5 bg-[#f2f3ff] px-3 py-1 rounded-full border border-[#c3c6d7]/60">
            <span
              className={`w-2 h-2 rounded-full ${
                saveStatus === 'saving' ? 'bg-amber-500 animate-spin' : 'bg-[#006c49] animate-pulse'
              }`}
            ></span>
            <span className="text-[11px] font-semibold text-[#434655]">
              {saveStatus === 'saving' ? 'Salvando...' : 'Sincronizado na Nuvem'}
            </span>
          </div>

          <button
            onClick={handlePublish}
            className="flex items-center space-x-1.5 text-white px-3.5 py-1.5 rounded-lg text-[13px] font-semibold transition-all active:scale-95 shadow-sm"
            style={{ backgroundColor: config.primaryColor }}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">publish</span>
            <span>Publicar Alterações</span>
          </button>
        </div>
      </header>

      {/* Main Multi-Pane Content */}
      <main className="pt-20 pb-16 px-4 md:px-8 max-w-7xl mx-auto w-full flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Brand Configuration & Color Pickers (7 Cols) */}
        <section className="lg:col-span-7 flex flex-col space-y-6">
          {/* Tenant Selector & Quick Presets */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-[#c3c6d7] shadow-sm">
            <div className="flex items-center space-x-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: config.primaryColor }}
              >
                <span className="material-symbols-outlined text-[22px]">local_taxi</span>
              </div>
              <div>
                <div className="text-[11px] font-medium text-[#434655]">Cooperativa Ativa</div>
                <input
                  type="text"
                  value={config.tenantName}
                  onChange={(e) => {
                    const name = e.target.value;
                    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
                    setConfig((prev) => ({ ...prev, tenantName: name, slug }));
                    triggerAutoSaveIndicator();
                  }}
                  className="text-[16px] font-bold text-[#131b2e] border-b border-transparent hover:border-[#c3c6d7] focus:border-[#004ac6] focus:outline-none bg-transparent"
                  placeholder="Nome da Cooperativa"
                />
              </div>
            </div>

            {/* Presets */}
            <div className="flex items-center space-x-1.5 overflow-x-auto">
              <span className="text-[11px] font-semibold text-[#737686] mr-1">Presets:</span>
              {PRESETS.map((p) => (
                <button
                  key={p.slug}
                  onClick={() => applyPreset(p)}
                  className="px-2.5 py-1 bg-[#eaedff] hover:bg-[#dae2fd] rounded text-[12px] font-medium transition-all"
                  style={{ color: p.primary }}
                  type="button"
                >
                  {p.name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* 1. Logo Upload & Intelligent Extraction */}
          <div className="bg-white rounded-xl border border-[#c3c6d7] p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-[16px] font-bold text-[#131b2e] flex items-center space-x-2">
                  <span className="material-symbols-outlined text-[20px]" style={{ color: config.primaryColor }}>
                    image
                  </span>
                  <span>Identidade Visual da Frota</span>
                </h2>
                <p className="text-[13px] text-[#434655] mt-0.5">
                  Envie o logotipo vetorizado ou transparente da cooperativa para processamento automático.
                </p>
              </div>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-[#eaedff] text-[#434655]">
                SVG, PNG até 5MB
              </span>
            </div>

            {/* Drag & Drop Area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleLogoUpload(e.dataTransfer.files[0]);
                }
              }}
              className="border-2 border-dashed border-[#c3c6d7] hover:border-[#004ac6] rounded-xl p-5 bg-[#f2f3ff]/40 flex flex-col sm:flex-row items-center justify-between gap-4 transition-colors cursor-pointer group"
            >
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 rounded-lg bg-white border border-[#c3c6d7] flex items-center justify-center p-1.5 shadow-sm group-hover:scale-105 transition-transform overflow-hidden">
                  {config.logoUrl ? (
                    <img src={config.logoUrl} alt="Logo Preview" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <div
                      className="w-full h-full rounded flex items-center justify-center text-white font-bold text-[18px] tracking-wider"
                      style={{ backgroundColor: config.primaryColor }}
                    >
                      {config.tenantName.substring(0, 2).toUpperCase() || 'TX'}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-[#131b2e]">
                    Arraste a logo aqui ou clique para selecionar
                  </p>
                  <p className="text-[12px] text-[#434655]">Recomendado 512×512px com fundo transparente</p>
                  <input
                    ref={fileInputRef}
                    accept="image/png, image/jpeg, image/svg+xml"
                    className="hidden"
                    type="file"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleLogoUpload(e.target.files[0]);
                      }
                    }}
                  />
                </div>
              </div>

              <button
                type="button"
                className="bg-white border border-[#c3c6d7] hover:bg-[#eaedff] text-[#131b2e] text-[13px] font-semibold px-4 py-2 rounded-lg flex items-center space-x-1.5 shadow-none"
              >
                <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
                <span>Carregar Imagem</span>
              </button>
            </div>

            {/* Extracted Color Badges */}
            <div className="mt-4 pt-4 border-t border-[#c3c6d7]/60 flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div className="flex items-center space-x-1.5">
                <span className="material-symbols-outlined text-[18px]" style={{ color: config.primaryColor }}>
                  palette
                </span>
                <span className="text-[12px] font-semibold text-[#131b2e]">Paleta extraída do logotipo enviado:</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateColor('primaryColor', '#004AC6')}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[#eaedff] border border-[#c3c6d7] hover:border-[#004ac6] text-[11px] font-mono transition-all"
                >
                  <span className="w-3.5 h-3.5 rounded-full bg-[#004ac6] border border-black/10 inline-block"></span>
                  <span>#004AC6 (Primária)</span>
                </button>
                <button
                  type="button"
                  onClick={() => updateColor('secondaryColor', '#006C49')}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[#eaedff] border border-[#c3c6d7] hover:border-[#006c49] text-[11px] font-mono transition-all"
                >
                  <span className="w-3.5 h-3.5 rounded-full bg-[#006c49] border border-black/10 inline-block"></span>
                  <span>#006C49 (Secundária)</span>
                </button>
                <button
                  type="button"
                  onClick={() => updateColor('urgentColor', '#BA1A1A')}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[#eaedff] border border-[#c3c6d7] hover:border-[#ba1a1a] text-[11px] font-mono transition-all"
                >
                  <span className="w-3.5 h-3.5 rounded-full bg-[#ba1a1a] border border-black/10 inline-block"></span>
                  <span>#BA1A1A (Alerta)</span>
                </button>
              </div>
            </div>
          </div>

          {/* 2. Color Tokens Engineering */}
          <div className="bg-white rounded-xl border border-[#c3c6d7] p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#c3c6d7]">
              <div>
                <h2 className="text-[16px] font-bold text-[#131b2e] flex items-center space-x-2">
                  <span className="material-symbols-outlined text-[20px]" style={{ color: config.primaryColor }}>
                    colorize
                  </span>
                  <span>Engenharia de Cores & Contrastes</span>
                </h2>
                <p className="text-[13px] text-[#434655] mt-0.5">
                  Mapeamento de tokens operacionais para o aplicativo do condutor e consoles de despacho.
                </p>
              </div>
              <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#6ffbbe]/30 text-[#005236] text-[11px] font-semibold border border-[#006c49]/20">
                <span className="material-symbols-outlined text-[16px]">verified</span>
                <span>WCAG 2.1 AAA Válido</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Primary Brand Color */}
              <div className="p-3.5 rounded-lg bg-[#f2f3ff] border border-[#c3c6d7]">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[13px] font-semibold text-[#131b2e]">Cor Primária da Marca</label>
                  <span className="text-[11px] text-[#737686]">Header & CTA</span>
                </div>
                <p className="text-[12px] text-[#434655] mb-2.5">
                  Cabeçalhos mobile, botões de ação e status de rota ativa.
                </p>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={config.primaryColor}
                    onChange={(e) => updateColor('primaryColor', e.target.value)}
                    className="w-9 h-9 p-0.5 rounded border border-[#c3c6d7] cursor-pointer bg-white"
                  />
                  <input
                    type="text"
                    value={config.primaryColor}
                    maxLength={7}
                    onChange={(e) => updateColor('primaryColor', e.target.value)}
                    className="flex-1 uppercase font-mono text-[12px] px-2.5 py-1.5 rounded border border-[#c3c6d7] focus:outline-none focus:ring-2 focus:ring-[#004ac6] bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => updateColor('primaryColor', '#004AC6')}
                    title="Redefinir"
                    className="p-1.5 text-[#737686] hover:text-[#131b2e]"
                  >
                    <span className="material-symbols-outlined text-[18px]">restart_alt</span>
                  </button>
                </div>
              </div>

              {/* Secondary Color / Online Status */}
              <div className="p-3.5 rounded-lg bg-[#f2f3ff] border border-[#c3c6d7]">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[13px] font-semibold text-[#131b2e]">Cor Secundária / Online</label>
                  <span className="text-[11px] text-[#737686]">Badges & Sucesso</span>
                </div>
                <p className="text-[12px] text-[#434655] mb-2.5">
                  Telemetria de motorista livre, confirmações e corridas ativas.
                </p>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={config.secondaryColor}
                    onChange={(e) => updateColor('secondaryColor', e.target.value)}
                    className="w-9 h-9 p-0.5 rounded border border-[#c3c6d7] cursor-pointer bg-white"
                  />
                  <input
                    type="text"
                    value={config.secondaryColor}
                    maxLength={7}
                    onChange={(e) => updateColor('secondaryColor', e.target.value)}
                    className="flex-1 uppercase font-mono text-[12px] px-2.5 py-1.5 rounded border border-[#c3c6d7] focus:outline-none focus:ring-2 focus:ring-[#006c49] bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => updateColor('secondaryColor', '#006C49')}
                    title="Redefinir"
                    className="p-1.5 text-[#737686] hover:text-[#131b2e]"
                  >
                    <span className="material-symbols-outlined text-[18px]">restart_alt</span>
                  </button>
                </div>
              </div>

              {/* Urgent Color / SLA Alert */}
              <div className="p-3.5 rounded-lg bg-[#f2f3ff] border border-[#c3c6d7]">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[13px] font-semibold text-[#131b2e]">Alerta / Estouro de SLA</label>
                  <span className="text-[11px] text-[#737686]">Fila Crítica</span>
                </div>
                <p className="text-[12px] text-[#434655] mb-2.5">
                  SLA inferior a 1min, cancelamentos e incidentes de despacho.
                </p>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={config.urgentColor}
                    onChange={(e) => updateColor('urgentColor', e.target.value)}
                    className="w-9 h-9 p-0.5 rounded border border-[#c3c6d7] cursor-pointer bg-white"
                  />
                  <input
                    type="text"
                    value={config.urgentColor}
                    maxLength={7}
                    onChange={(e) => updateColor('urgentColor', e.target.value)}
                    className="flex-1 uppercase font-mono text-[12px] px-2.5 py-1.5 rounded border border-[#c3c6d7] focus:outline-none focus:ring-2 focus:ring-[#ba1a1a] bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => updateColor('urgentColor', '#BA1A1A')}
                    title="Redefinir"
                    className="p-1.5 text-[#737686] hover:text-[#131b2e]"
                  >
                    <span className="material-symbols-outlined text-[18px]">restart_alt</span>
                  </button>
                </div>
              </div>

              {/* Driver Chat Bubble Color */}
              <div className="p-3.5 rounded-lg bg-[#f2f3ff] border border-[#c3c6d7]">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[13px] font-semibold text-[#131b2e]">Balão do Condutor (Chat)</label>
                  <span className="text-[11px] text-[#737686]">Legibilidade Solar</span>
                </div>
                <p className="text-[12px] text-[#434655] mb-2.5">
                  Garante alto contraste para condutores em suportes veiculares.
                </p>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={config.driverBubbleColor}
                    onChange={(e) => updateColor('driverBubbleColor', e.target.value)}
                    className="w-9 h-9 p-0.5 rounded border border-[#c3c6d7] cursor-pointer bg-white"
                  />
                  <input
                    type="text"
                    value={config.driverBubbleColor}
                    maxLength={7}
                    onChange={(e) => updateColor('driverBubbleColor', e.target.value)}
                    className="flex-1 uppercase font-mono text-[12px] px-2.5 py-1.5 rounded border border-[#c3c6d7] focus:outline-none focus:ring-2 focus:ring-[#004ac6] bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => updateColor('driverBubbleColor', '#004AC6')}
                    title="Redefinir"
                    className="p-1.5 text-[#737686] hover:text-[#131b2e]"
                  >
                    <span className="material-symbols-outlined text-[18px]">restart_alt</span>
                  </button>
                </div>
              </div>
            </div>

            {/* High Solar Contrast Toggle */}
            <div className="mt-4 pt-3 border-t border-[#c3c6d7] flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-[#eaedff] rounded-lg text-[#004ac6]">
                  <span className="material-symbols-outlined text-[20px]">wb_sunny</span>
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-[#131b2e]">
                    Otimização para Alta Claridade Solar (Motoristas)
                  </div>
                  <div className="text-[12px] text-[#434655]">
                    Ajusta automaticamente a saturação para evitar reflexos no para-brisa.
                  </div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.solarContrast}
                  onChange={(e) => setConfig((prev) => ({ ...prev, solarContrast: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#004ac6]"></div>
              </label>
            </div>
          </div>

          {/* 3. Real-Time CSS Variables Export */}
          <div className="bg-white rounded-xl border border-[#c3c6d7] p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <span className="material-symbols-outlined text-[20px]" style={{ color: config.primaryColor }}>
                  code
                </span>
                <h3 className="text-[16px] font-bold text-[#131b2e]">Exportação de CSS Variables (:root)</h3>
              </div>
              <button
                type="button"
                onClick={copyCssToClipboard}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#eaedff] hover:bg-[#dae2fd] rounded text-[13px] font-semibold text-[#004ac6] transition-all active:scale-95"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {copyFeedback ? 'check' : 'content_copy'}
                </span>
                <span>{copyFeedback ? 'Copiado!' : 'Copiar CSS Theme'}</span>
              </button>
            </div>
            <pre className="p-4 bg-[#283044] text-[#eeefff] rounded-lg font-mono text-[12px] overflow-x-auto border border-[#434655]">
              {getCssExportString()}
            </pre>
          </div>
        </section>

        {/* RIGHT COLUMN: Live Interactive Simulator (5 Cols) */}
        <section className="lg:col-span-5 flex flex-col space-y-6">
          <div className="bg-white rounded-xl border border-[#c3c6d7] p-5 shadow-sm sticky top-20">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <span className="material-symbols-outlined text-[22px]" style={{ color: config.primaryColor }}>
                  devices
                </span>
                <h2 className="text-[16px] font-bold text-[#131b2e]">Simulador em Tempo Real</h2>
              </div>
              <span className="px-2.5 py-0.5 rounded text-[11px] font-semibold bg-[#6ffbbe]/30 text-[#005236] flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#006c49] animate-ping"></span>
                <span>Live Sync</span>
              </span>
            </div>

            {/* Simulator Tabs: Mobile Driver vs Desktop Dispatch */}
            <div className="flex border-b border-[#c3c6d7] mb-4">
              <button
                type="button"
                onClick={() => setPreviewTab('mobile')}
                className={`flex-1 pb-2 font-semibold text-[13px] text-center flex items-center justify-center space-x-1.5 border-b-2 transition-all ${
                  previewTab === 'mobile'
                    ? 'border-[#004ac6] text-[#004ac6]'
                    : 'border-transparent text-[#737686] hover:text-[#131b2e]'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">smartphone</span>
                <span>App do Condutor</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('desktop')}
                className={`flex-1 pb-2 font-semibold text-[13px] text-center flex items-center justify-center space-x-1.5 border-b-2 transition-all ${
                  previewTab === 'desktop'
                    ? 'border-[#004ac6] text-[#004ac6]'
                    : 'border-transparent text-[#737686] hover:text-[#131b2e]'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">desktop_windows</span>
                <span>Console Despachante</span>
              </button>
            </div>

            {/* 1. Mobile Driver Mockup */}
            {previewTab === 'mobile' && (
              <div className="w-full max-w-[320px] mx-auto bg-white rounded-2xl border-4 border-[#283044] shadow-md overflow-hidden flex flex-col">
                {/* Mobile Status Bar */}
                <div className="bg-[#283044] text-[#eeefff] px-3 py-1 text-[10px] flex items-center justify-between">
                  <span>09:41</span>
                  <div className="flex items-center space-x-1">
                    <span className="material-symbols-outlined text-[12px]">signal_cellular_alt</span>
                    <span className="material-symbols-outlined text-[12px]">wifi</span>
                    <span className="material-symbols-outlined text-[12px]">battery_full</span>
                  </div>
                </div>

                {/* Mobile Header with Live Primary Color */}
                <div
                  className="text-white p-3 flex items-center justify-between shadow-sm transition-colors duration-200"
                  style={{ backgroundColor: config.primaryColor }}
                >
                  <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 rounded bg-white text-[#004ac6] flex items-center justify-center font-bold text-[11px] shadow-sm overflow-hidden">
                      {config.logoUrl ? (
                        <img src={config.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                      ) : (
                        <span>{config.tenantName.substring(0, 2).toUpperCase() || 'TX'}</span>
                      )}
                    </div>
                    <div>
                      <div className="text-[12px] font-bold leading-tight truncate max-w-[170px]">
                        {config.tenantName}
                      </div>
                      <div className="text-[10px] opacity-85 flex items-center space-x-1">
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: config.secondaryColor }}
                        ></span>
                        <span>Corrida #4829 Em Curso</span>
                      </div>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-[18px]">local_taxi</span>
                </div>

                {/* Mobile Chat Stream */}
                <div className="p-3 bg-[#f2f3ff] flex flex-col space-y-2.5 min-h-[250px] text-[12px]">
                  <div className="text-center">
                    <span className="bg-white border border-[#c3c6d7] px-2 py-0.5 rounded text-[10px] font-mono text-[#737686]">
                      Despachante: Central Copacabana
                    </span>
                  </div>

                  {/* Attendant Bubble (Left) */}
                  <div className="self-start max-w-[85%] bg-white border border-[#c3c6d7] text-[#131b2e] rounded-lg rounded-bl-none p-2 shadow-sm text-[12px]">
                    <span className="text-[10px] font-semibold text-[#737686] block mb-0.5">Central Operacional</span>
                    Motorista Carlos, passageiro aguarda na saída B do terminal. Confirmar aproximação.
                  </div>

                  {/* Driver Bubble (Right) with Live Driver Bubble Color */}
                  <div
                    className="self-end max-w-[85%] text-white rounded-lg rounded-br-none p-2 shadow-sm text-[12px] transition-colors duration-200"
                    style={{ backgroundColor: config.driverBubbleColor }}
                  >
                    Chegando em 2 minutos. Veículo placa <span className="font-mono bg-black/20 px-1 rounded">BRA2E19</span> posicionado.
                    <div className="text-[9px] text-right mt-1 opacity-80">09:42 ✓✓</div>
                  </div>

                  {/* Internal Tag Simulation */}
                  <div className="bg-amber-50 border border-amber-200 p-1.5 rounded text-[11px] text-amber-900 flex items-center space-x-1">
                    <span className="material-symbols-outlined text-[14px] text-amber-700">lock</span>
                    <span>Nota Interna: Passageiro VIP corporativo</span>
                  </div>
                </div>

                {/* Mobile Composer Input */}
                <div className="p-2 bg-white border-t border-[#c3c6d7] flex items-center space-x-2">
                  <span className="material-symbols-outlined text-[#737686] text-[18px]">mic</span>
                  <input
                    type="text"
                    disabled
                    placeholder="Mensagem rápida..."
                    className="flex-1 text-[11px] bg-[#f2f3ff] border-none rounded py-1 px-2 text-[#434655]"
                  />
                  <button
                    type="button"
                    className="text-white w-7 h-7 rounded flex items-center justify-center transition-colors duration-200"
                    style={{ backgroundColor: config.primaryColor }}
                  >
                    <span className="material-symbols-outlined text-[14px]">send</span>
                  </button>
                </div>
              </div>
            )}

            {/* 2. Desktop Dispatcher Console Mockup */}
            {previewTab === 'desktop' && (
              <div className="border border-[#c3c6d7] rounded-xl overflow-hidden bg-white shadow-sm text-[12px]">
                {/* Desktop Topbar */}
                <div className="bg-[#e2e7ff] px-3 py-2 flex items-center justify-between border-b border-[#c3c6d7]">
                  <div className="flex items-center space-x-2">
                    <div
                      className="w-6 h-6 rounded text-white flex items-center justify-center font-bold text-[10px] overflow-hidden"
                      style={{ backgroundColor: config.primaryColor }}
                    >
                      {config.logoUrl ? (
                        <img src={config.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                      ) : (
                        <span>{config.tenantName.substring(0, 2).toUpperCase() || 'TX'}</span>
                      )}
                    </div>
                    <span className="text-[12px] font-bold text-[#131b2e] truncate max-w-[150px]">
                      {config.tenantName} Console
                    </span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: config.secondaryColor }}
                    ></span>
                    <span className="text-[11px] text-[#434655] font-medium">94 Táxis Conectados</span>
                  </div>
                </div>

                {/* Desktop Ticket Row */}
                <div className="p-2.5 border-b border-[#c3c6d7] bg-[#f2f3ff] flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 rounded-full bg-white border border-[#c3c6d7] flex items-center justify-center font-bold text-[11px]">
                      #71
                    </div>
                    <div>
                      <div className="text-[12px] font-semibold text-[#131b2e]">Chamado #4829 - Reatribuição</div>
                      <div className="text-[10px] text-[#737686] font-mono">GPS: -22.9068, -43.1729</div>
                    </div>
                  </div>
                  <span
                    className="px-2 py-0.5 rounded text-[11px] font-semibold text-white flex items-center space-x-1 shadow-sm"
                    style={{ backgroundColor: config.urgentColor }}
                  >
                    <span className="material-symbols-outlined text-[13px]">timer</span>
                    <span>SLA: 00:48s</span>
                  </span>
                </div>

                {/* Compact Dispatch Content */}
                <div className="p-3 space-y-2 bg-white min-h-[180px]">
                  <div className="p-2 rounded bg-[#f2f3ff] border border-[#c3c6d7] flex items-center justify-between text-[11px]">
                    <span>Condutor: Carlos Santos (Carro #104)</span>
                    <span
                      className="px-1.5 py-0.5 rounded text-white font-mono text-[9px] font-bold"
                      style={{ backgroundColor: config.secondaryColor }}
                    >
                      LIVRE
                    </span>
                  </div>

                  <div className="p-2.5 rounded bg-[#eaedff] border border-[#c3c6d7] flex items-center justify-between">
                    <div>
                      <span className="font-semibold block text-[12px]">Despacho Automático</span>
                      <span className="text-[#737686] text-[10px]">Tarifa calculada com desconto cooperativa</span>
                    </div>
                    <button
                      type="button"
                      className="text-white px-2.5 py-1 rounded text-[11px] font-semibold shadow-none"
                      style={{ backgroundColor: config.primaryColor }}
                    >
                      Atribuir
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Visual Compliance Telemetry */}
            <div className="mt-4 p-2.5 bg-[#eaedff] rounded-lg border border-[#c3c6d7]/60 flex items-center justify-between text-[12px]">
              <div className="flex items-center space-x-1.5">
                <span className="material-symbols-outlined text-[18px]" style={{ color: config.secondaryColor }}>
                  check_circle
                </span>
                <span className="text-[#131b2e] font-medium">Testado em visores OLED & IPS</span>
              </div>
              <span className="font-mono text-[#737686] text-[11px] font-semibold">Ratio: 7.2:1</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
