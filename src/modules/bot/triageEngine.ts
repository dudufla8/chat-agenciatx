import { TriageContext, TriageStepResult, TriageState, TriageOption } from './triageTypes';

export class TriageEngine {
  /**
   * Generates the initial welcome message and main menu options
   */
  getInitialGreeting(context: TriageContext): TriageStepResult {
    const greeting = `Olá, ${context.driverName || 'motorista'}! Seja bem-vindo à Central de Atendimento Táxi 2.0.\n\nSelecione o número da opção desejada:\n[1] Atualização de Cadastro / Veículo\n[2] Corridas (Correção de valor, Cancelamentos, Agendamentos)\n[3] Novo Cadastro - Quero participar\n[4] Outros Assuntos / Dúvidas Gerais\n[5] Dúvidas sobre Pagamentos / Repasses`;

    const options: TriageOption[] = [
      { id: '1', label: '1 - Atualização de Cadastro / Veículo' },
      { id: '2', label: '2 - Corridas (Correção, Cancelamento, Agendamento)' },
      { id: '3', label: '3 - Novo Cadastro - Quero participar' },
      { id: '4', label: '4 - Outros Assuntos / Dúvidas Gerais' },
      { id: '5', label: '5 - Dúvidas sobre Pagamentos / Repasses' },
    ];

    return {
      botMessage: greeting,
      options,
      nextStep: TriageState.MAIN_MENU,
      transitionToQueue: false,
      inputExpected: 'option',
    };
  }

  /**
   * Processes an incoming message from the driver during the BOT_TRIAGE phase
   */
  processMessage(
    context: TriageContext,
    userMessage: string,
    mediaUrl?: string | null
  ): TriageStepResult {
    const cleanInput = (userMessage || '').trim();
    const currentStep = context.currentStep || TriageState.MAIN_MENU;

    switch (currentStep) {
      // ==========================================
      // MAIN MENU
      // ==========================================
      case TriageState.MAIN_MENU: {
        const option = cleanInput.replace(/[^1-5]/g, '').slice(0, 1) || cleanInput;

        if (option === '1' || cleanInput.toLowerCase().includes('cadastro') || cleanInput.toLowerCase().includes('veículo')) {
          return {
            botMessage: `*Atualização de Cadastro / Veículo*\nSelecione a opção desejada:\n[1] Troca de Celular / IMEI\n[2] Troca de Carro\n[3] Outros documentos`,
            options: [
              { id: '1', label: '1 - Troca de Celular / IMEI' },
              { id: '2', label: '2 - Troca de Carro' },
              { id: '3', label: '3 - Outros documentos' },
            ],
            nextStep: TriageState.CADASTRO_SUBMENU,
            transitionToQueue: false,
            inputExpected: 'option',
            collectedDataUpdate: { motivoPrincipal: 'Atualização de Cadastro / Veículo' },
          };
        }

        if (option === '2' || cleanInput.toLowerCase().includes('corrida')) {
          return {
            botMessage: `*Corridas e Operacional*\nSelecione o motivo:\n[1] Corrigir valor de corrida\n[2] Cancelamento de corrida\n[3] Agendamentos`,
            options: [
              { id: '1', label: '1 - Corrigir valor de corrida' },
              { id: '2', label: '2 - Cancelamento de corrida' },
              { id: '3', label: '3 - Agendamentos' },
            ],
            nextStep: TriageState.CORRIDAS_SUBMENU,
            transitionToQueue: false,
            inputExpected: 'option',
            collectedDataUpdate: { motivoPrincipal: 'Corridas / Operacional' },
          };
        }

        if (option === '3' || cleanInput.toLowerCase().includes('participar') || cleanInput.toLowerCase().includes('novo')) {
          return {
            botMessage: `*Novo Cadastro de Motorista*\nPor favor, envie seu nome completo, cidade e telefone com WhatsApp para iniciarmos seu credenciamento.`,
            nextStep: TriageState.NOVO_CADASTRO_COLLECT,
            transitionToQueue: false,
            inputExpected: 'text',
            collectedDataUpdate: { motivoPrincipal: 'Novo Cadastro - Quero participar' },
          };
        }

        if (option === '4' || cleanInput.toLowerCase().includes('outro') || cleanInput.toLowerCase().includes('gerais')) {
          return {
            botMessage: `*Outros Assuntos / Dúvidas Gerais*\nDescreva resumidamente sua dúvida para direcionarmos ao setor correto.`,
            nextStep: TriageState.OUTROS_COLLECT,
            transitionToQueue: false,
            inputExpected: 'text',
            collectedDataUpdate: { motivoPrincipal: 'Outros Assuntos / Dúvidas Gerais' },
          };
        }

        if (option === '5' || cleanInput.toLowerCase().includes('pagamento') || cleanInput.toLowerCase().includes('repasse')) {
          return {
            botMessage: `*Dúvidas sobre Pagamentos / Repasses*\nSelecione uma opção:\n[1] Não recebi meu repasse\n[2] Recebi mas preciso da data/extrato\n[3] Quero alterar chave Pix\n[4] Outra dúvida sobre repasse`,
            options: [
              { id: '1', label: '1 - Não recebi meu repasse' },
              { id: '2', label: '2 - Recebi mas preciso de extrato' },
              { id: '3', label: '3 - Quero alterar chave Pix' },
              { id: '4', label: '4 - Outra dúvida sobre repasse' },
            ],
            nextStep: TriageState.PAGAMENTOS_SUBMENU,
            transitionToQueue: false,
            inputExpected: 'option',
            collectedDataUpdate: { motivoPrincipal: 'Dúvidas sobre Pagamentos / Repasses' },
          };
        }

        // Invalid option
        return {
          botMessage: `Opção inválida. Por favor, selecione um número de 1 a 5:\n[1] Atualização de Cadastro / Veículo\n[2] Corridas\n[3] Novo Cadastro\n[4] Outros Assuntos\n[5] Pagamentos / Repasses`,
          options: [
            { id: '1', label: '1 - Atualização de Cadastro' },
            { id: '2', label: '2 - Corridas' },
            { id: '3', label: '3 - Novo Cadastro' },
            { id: '4', label: '4 - Outros Assuntos' },
            { id: '5', label: '5 - Pagamentos' },
          ],
          nextStep: TriageState.MAIN_MENU,
          transitionToQueue: false,
          inputExpected: 'option',
        };
      }

      // ==========================================
      // SUBFLOW 1: CADASTRO E VEÍCULOS
      // ==========================================
      case TriageState.CADASTRO_SUBMENU: {
        const subOption = cleanInput.slice(0, 1);
        let subTipo = 'Outros documentos';
        if (subOption === '1') subTipo = 'Troca de Celular/IMEI';
        if (subOption === '2') subTipo = 'Troca de Carro';

        return {
          botMessage: `Entendido (${subTipo}). Por favor, envie uma foto ou print do documento/comprovante necessário (ou descreva os novos dados).`,
          nextStep: TriageState.CADASTRO_COLLECT_DOC,
          transitionToQueue: false,
          inputExpected: 'media',
          collectedDataUpdate: { subTipoCadastro: subTipo },
        };
      }

      case TriageState.CADASTRO_COLLECT_DOC: {
        return {
          botMessage: `Comprovante/informação registrada! Estamos transferindo você para a equipe de *Cadastro & Veículos*. Um atendente humano irá te atender em breve.`,
          nextStep: TriageState.COMPLETED,
          targetDepartmentSlug: 'cadastro-veiculos',
          transitionToQueue: true,
          collectedDataUpdate: {
            detalhesCadastro: cleanInput || 'Documento enviado',
            comprovanteUrl: mediaUrl || null,
          },
        };
      }

      // ==========================================
      // SUBFLOW 2: CORRIDAS E OPERACIONAL
      // ==========================================
      case TriageState.CORRIDAS_SUBMENU: {
        const subOption = cleanInput.slice(0, 1);
        let motivo = 'Outros operacional';
        if (subOption === '1') motivo = 'Corrigir valor de corrida';
        if (subOption === '2') motivo = 'Cancelamento de corrida';
        if (subOption === '3') motivo = 'Agendamentos';

        return {
          botMessage: `Entendido (${motivo}). Por favor, informe o *número da corrida*, *valor cobrado* e o *motivo detalhado*.`,
          nextStep: TriageState.CORRIDAS_COLLECT_DETAILS,
          transitionToQueue: false,
          inputExpected: 'text',
          collectedDataUpdate: { subMotivoCorrida: motivo },
        };
      }

      case TriageState.CORRIDAS_COLLECT_DETAILS: {
        return {
          botMessage: `Dados da corrida anotados! Seu chamado foi adicionado à fila do setor de *Corridas e Operacional*. Aguarde um momento.`,
          nextStep: TriageState.COMPLETED,
          targetDepartmentSlug: 'corridas-operacional',
          transitionToQueue: true,
          collectedDataUpdate: {
            dadosCorrida: cleanInput,
            anexoCorrida: mediaUrl || null,
          },
        };
      }

      // ==========================================
      // SUBFLOW 3: NOVO CADASTRO
      // ==========================================
      case TriageState.NOVO_CADASTRO_COLLECT: {
        return {
          botMessage: `Obrigado pelo interesse em fazer parte da frota! Seus dados foram encaminhados para o setor *Comercial & Novos Cadastros*. Nossa equipe entrará em contato em instantes.`,
          nextStep: TriageState.COMPLETED,
          targetDepartmentSlug: 'comercial-novos-cadastros',
          transitionToQueue: true,
          collectedDataUpdate: {
            dadosNovoCadastro: cleanInput,
          },
        };
      }

      // ==========================================
      // SUBFLOW 4: OUTROS ASSUNTOS
      // ==========================================
      case TriageState.OUTROS_COLLECT: {
        return {
          botMessage: `Obrigado pelo detalhamento. Direcionamos seu contato para nossa fila de *Dúvidas Gerais*. Aguarde, já vamos te atender!`,
          nextStep: TriageState.COMPLETED,
          targetDepartmentSlug: 'duvidas-gerais',
          transitionToQueue: true,
          collectedDataUpdate: {
            descricaoDuvida: cleanInput,
          },
        };
      }

      // ==========================================
      // SUBFLOW 5: PAGAMENTOS E REPASSES
      // ==========================================
      case TriageState.PAGAMENTOS_SUBMENU: {
        const subOption = cleanInput.slice(0, 1);
        let motivo = 'Outra dúvida sobre repasse';
        if (subOption === '1') motivo = 'Não recebi meu repasse';
        if (subOption === '2') motivo = 'Recebi mas preciso de extrato';
        if (subOption === '3') motivo = 'Quero alterar chave Pix';

        // Regra específica: Se opção 1 ou 3, solicita chave Pix e confirmação de nome/telefone
        if (subOption === '1' || subOption === '3') {
          return {
            botMessage: `Identificado: *${motivo}*.\nPor favor, informe sua *chave Pix* e confirme seu *nome completo e telefone*.`,
            nextStep: TriageState.PAGAMENTOS_COLLECT_PIX,
            transitionToQueue: false,
            inputExpected: 'text',
            collectedDataUpdate: { subMotivoPagamento: motivo },
          };
        }

        return {
          botMessage: `Identificado: *${motivo}*.\nPor favor, informe os detalhes ou a data do período desejado.`,
          nextStep: TriageState.PAGAMENTOS_COLLECT_DETAILS,
          transitionToQueue: false,
          inputExpected: 'text',
          collectedDataUpdate: { subMotivoPagamento: motivo },
        };
      }

      case TriageState.PAGAMENTOS_COLLECT_PIX: {
        return {
          botMessage: `Dados para repasse/Pix anotados no sistema! Encaminhado para a fila de *Financeiro & Pagamentos*.`,
          nextStep: TriageState.COMPLETED,
          targetDepartmentSlug: 'financeiro-pagamentos',
          transitionToQueue: true,
          collectedDataUpdate: {
            dadosPixConfirmacao: cleanInput,
            comprovantePixUrl: mediaUrl || null,
          },
        };
      }

      case TriageState.PAGAMENTOS_COLLECT_DETAILS: {
        return {
          botMessage: `Solicitação registrada! Seu chamado está na fila de *Financeiro & Pagamentos*. Em breve um operador responderá.`,
          nextStep: TriageState.COMPLETED,
          targetDepartmentSlug: 'financeiro-pagamentos',
          transitionToQueue: true,
          collectedDataUpdate: {
            detalhesFinanceiro: cleanInput,
          },
        };
      }

      default: {
        // Fallback to Main Menu
        return this.getInitialGreeting(context);
      }
    }
  }
}

export const triageEngine = new TriageEngine();
