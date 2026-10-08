export interface TriageOption {
  id: string;
  label: string;
  value?: string;
}

export interface TriageStepResult {
  botMessage: string;
  options?: TriageOption[];
  nextStep: string | null;
  targetDepartmentSlug?: string;
  transitionToQueue: boolean;
  collectedDataUpdate?: Record<string, any>;
  inputExpected?: 'option' | 'text' | 'media';
}

export interface TriageContext {
  ticketId: string;
  driverName: string;
  driverPrefixo: string;
  currentStep: string | null;
  collectedData: Record<string, any>;
}

export enum TriageState {
  MAIN_MENU = 'MAIN_MENU',
  
  // Subflow 1: Cadastro
  CADASTRO_SUBMENU = 'CADASTRO_SUBMENU',
  CADASTRO_COLLECT_DOC = 'CADASTRO_COLLECT_DOC',

  // Subflow 2: Corridas
  CORRIDAS_SUBMENU = 'CORRIDAS_SUBMENU',
  CORRIDAS_COLLECT_DETAILS = 'CORRIDAS_COLLECT_DETAILS',

  // Subflow 3: Novo Cadastro
  NOVO_CADASTRO_COLLECT = 'NOVO_CADASTRO_COLLECT',

  // Subflow 4: Outros Assuntos
  OUTROS_COLLECT = 'OUTROS_COLLECT',

  // Subflow 5: Pagamentos
  PAGAMENTOS_SUBMENU = 'PAGAMENTOS_SUBMENU',
  PAGAMENTOS_COLLECT_PIX = 'PAGAMENTOS_COLLECT_PIX',
  PAGAMENTOS_COLLECT_DETAILS = 'PAGAMENTOS_COLLECT_DETAILS',

  COMPLETED = 'COMPLETED',
}
