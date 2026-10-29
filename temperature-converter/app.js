const DATABASE_NAME = 'campo-eletrico';
const DATABASE_VERSION = 2;
const STORE_NAME = 'levantamentos';
const MAX_SES = 30;
const MAX_PANELS_PER_SE = 60;
const MAX_TRANSFORMERS_PER_SE = 20;
const MAX_EQUIPMENT_PER_SE = 30;
const MAX_PROTECTION_DEVICES_PER_PANEL = 60;
const MAX_PANEL_COLUMNS = 60;
const MAX_PHOTO_SIZE = 12 * 1024 * 1024;

const SUBSTATION_TEMPLATE = document.getElementById('substation-template');
const PANEL_TEMPLATE = document.getElementById('panel-template');
const substationList = document.getElementById('substation-list');
const serviceForm = document.getElementById('service-form');
const homeScreen = document.getElementById('home-screen');
const wizardScreen = document.getElementById('wizard-screen');
const appAlert = document.getElementById('app-alert');
const saveStatus = document.getElementById('save-status');

// Modelo persistido: Obra -> Subestacoes -> Transformadores e Paineis.
const modeloLevantamento = {
  id: null,
  criadoEm: null,
  atualizadoEm: null,
  obra: {
    numero: '',
    cliente: '',
    nomeServico: '',
    escopoServico: [],
    outrosItensEscopo: [],
    outrosEscopos: '',
    quantidadeSEs: 1,
    observacoes: ''
  },
  subestacoes: [{
    id: null,
    nome: 'SE-01',
    podeAlimentarMesmoBarramento: null,
    modoOperacaoTrafos: [],
    quantidadeTransformadores: 1,
    transformadores: [{
      nome: '',
      placaAcessivel: null,
      possuiAterramentoEnrolamento: null,
      aterramentoPorResistor: null,
      placaResistorAcessivel: null,
      fotos: { transformador: [], placa: [], resistorPlaca: [], resistorPainel: [] }
    }],
    possuiDemaisEquipamentos: null,
    demaisEquipamentos: [],
    observacoes: '',
    informacoesColetadas: null,
    justificativaInformacoesNaoColetadas: '',
    possuiObservacaoAdicional: null,
    observacaoAdicional: '',
    foto_observacao_se: [],
    paineis: [{
      id: null,
      dadosPainel: {
        nome: '',
        tipo: '',
        nivelTensao: '',
        outroNivelTensao: '',
        outroTipo: '',
        configuracaoColunas: null,
        quantidadeColunas: 0,
        observacoes: '',
        observacoesFinais: {
          informacoesColetadas: null,
          justificativaInformacoesNaoColetadas: '',
          possuiObservacaoAdicional: null,
          observacaoAdicional: ''
        },
        curtoCircuito: {
          suportabilidadePainelDisponivel: null,
          justificativaSuportabilidadePainel: '',
          suportabilidadeDisjuntorDisponivel: null,
          justificativaSuportabilidadeDisjuntor: '',
          possuiMotoresMT: null,
          quantidadeMotoresMT: 0,
          motores: [],
          informacoesCabosDisponiveis: null,
          distanciaCabos: '',
          bitolaCabos: '',
          quantidadeCabos: '',
          cabos: [],
          possuiInformacaoAdicionalDisjuntores: null,
          informacaoAdicionalDisjuntores: '',
          fotosInformacaoAdicionalDisjuntores: []
        },
        coordenacaoSeletividade: {
          quantidadeRelesProtecao: 0,
          relesProtecao: [],
          quantidadeDisjuntoresLSIG: 0,
          disjuntoresLSIG: [],
          possuiTCsTPs: null,
          fotosTCs: [],
          fotosTPs: [],
          possuiRelesInteligentes: null,
          quantidadeRelesInteligentes: 0,
          relesInteligentes: [],
          fotosDispositivosProtecaoBT: []
        },
        energiaIncidente: {
          possuiReleArco: null,
          fotosReleArco: [],
          ajustesReleArcoObtidos: null,
          backupReleArcoPossivel: null,
          releArcoTrip: null,
          possuiCompartimentoUnico: null,
          compartimentos: {
            entrada: { altura: '', largura: '', profundidade: '', fotos: [], disjuntorExtraivel: null },
            menor: { altura: '', largura: '', profundidade: '', fotos: [], disjuntorExtraivel: null }
          }
        },
        fotos: {
          foto_identificacao: [],
          foto_painel_completo: [],
          foto_observacao_painel: [],
          foto_suportabilidades: [],
          foto_suportabilidade_disjuntor: [],
          fotos_placas_motores_mt: [],
          fotos_colunas: []
        }
      }
    }]
  }]
};

window.modeloLevantamento = modeloLevantamento;

let database;
let currentSurvey = null;
let savedSurveys = [];
let currentStep = 1;
let saveTimer;
let alertTimer;

function clone(value) {
  return structuredClone(value);
}

function createId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function makePanel() {
  const panel = clone(modeloLevantamento.subestacoes[0].paineis[0]);
  panel.id = createId();
  return panel;
}

function makeProtectionRelay() {
  return {
    backupObtido: null,
    cubiculo: '',
    alimentacao: '',
    equipamentoProtegido: '',
    fotosModeloOrderCode: []
  };
}

function makeLsigBreaker() {
  return { cubiculo: '', alimentacao: '', equipamentoProtegido: '', fotosAjustes: [] };
}

function makeIntelligentRelay() {
  return { arquivoObtido: null, fotosModelo: [] };
}

function resizeRecords(records, count, factory) {
  const next = records.slice(0, count);
  while (next.length < count) next.push(factory());
  return next;
}

function makeSubstation(index) {
  const substation = clone(modeloLevantamento.subestacoes[0]);
  substation.id = createId();
  substation.nome = `SE-${String(index + 1).padStart(2, '0')}`;
  substation.paineis = [makePanel()];
  return substation;
}

function makeSurvey() {
  const survey = clone(modeloLevantamento);
  const now = new Date().toISOString();
  survey.id = createId();
  survey.criadoEm = now;
  survey.atualizadoEm = now;
  survey.subestacoes = [makeSubstation(0)];
  return survey;
}

function asPhotoArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeSurvey(survey) {
  survey.obra = { ...clone(modeloLevantamento.obra), ...survey.obra };
  survey.obra.escopoServico = Array.isArray(survey.obra.escopoServico) ? survey.obra.escopoServico : [];
  survey.obra.outrosItensEscopo = Array.isArray(survey.obra.outrosItensEscopo)
    ? survey.obra.outrosItensEscopo
    : [];
  ['Ajustes dos Relés Inteligentes', 'Painéis de baixa tensão (QD/QDL/QL)'].forEach(item => {
    if (survey.obra.escopoServico.includes(item)) {
      survey.obra.escopoServico = survey.obra.escopoServico.filter(scope => scope !== item);
      if (!survey.obra.outrosItensEscopo.includes(item)) survey.obra.outrosItensEscopo.push(item);
    }
  });
  survey.subestacoes = Array.isArray(survey.subestacoes) ? survey.subestacoes : [];

  survey.subestacoes.forEach((substation, seIndex) => {
    substation.id ||= createId();
    const firstLegacyPanel = substation.paineis?.[0]?.dadosPainel;
    const legacyShort = firstLegacyPanel?.curtoCircuito || {};
    const legacyPhotosByPanel = (substation.paineis || []).map(panel => panel.dadosPainel?.fotos || {});
    const legacyPhotos = key => legacyPhotosByPanel.flatMap(photos => asPhotoArray(photos[key]));
    substation.nome ||= `SE-${String(seIndex + 1).padStart(2, '0')}`;
    const legacyModes = substation.modoOperacaoTrafos ?? legacyShort.modoOperacaoTrafos ?? '';
    substation.modoOperacaoTrafos = Array.isArray(legacyModes)
      ? legacyModes
      : (legacyModes ? [legacyModes] : []);
    substation.podeAlimentarMesmoBarramento ??= substation.modoOperacaoTrafos.length ? 'sim' : null;
    const legacyResistorAnswer = substation.aterramentoTrafoPorResistor
      ?? legacyShort.aterramentoTrafoPorResistor ?? null;
    substation.observacoes ||= '';
    substation.informacoesColetadas ??= null;
    substation.justificativaInformacoesNaoColetadas ||= '';
    substation.possuiObservacaoAdicional ??= null;
    substation.observacaoAdicional ||= '';
    substation.foto_observacao_se = asPhotoArray(substation.foto_observacao_se);
    substation.possuiDemaisEquipamentos ??= null;
    const legacyResistorPhotos = substation.fotosResistor || {
      placa: legacyPhotos('foto_placa_resistor'),
      painel: legacyPhotos('foto_painel_resistor')
    };

    if (!Array.isArray(substation.transformadores)) {
      const oldTransformerPhotos = legacyPhotos('foto_placa_trafo');
      substation.transformadores = [{
        nome: '',
        fotos: { transformador: [], placa: oldTransformerPhotos }
      }];
    }
    substation.transformadores.forEach((transformer, transformerIndex) => {
      transformer.aterramentoPorResistor ??= legacyResistorAnswer;
      transformer.placaAcessivel ??= null;
      transformer.possuiAterramentoEnrolamento ??= transformer.aterramentoPorResistor === 'sim' ? 'sim' : null;
      transformer.placaResistorAcessivel ??= null;
      transformer.fotos = {
        transformador: [],
        placa: [],
        resistorPlaca: [],
        resistorPainel: [],
        ...transformer.fotos
      };
      transformer.fotos.transformador = asPhotoArray(transformer.fotos.transformador);
      transformer.fotos.placa = asPhotoArray(transformer.fotos.placa);
      transformer.fotos.resistorPlaca = asPhotoArray(transformer.fotos.resistorPlaca);
      transformer.fotos.resistorPainel = asPhotoArray(transformer.fotos.resistorPainel);
      delete transformer.correnteResistor;
      if (transformerIndex === 0 && transformer.fotos.resistorPlaca.length === 0) {
        transformer.fotos.resistorPlaca = asPhotoArray(legacyResistorPhotos.placa);
      }
      if (transformerIndex === 0 && transformer.fotos.resistorPainel.length === 0) {
        transformer.fotos.resistorPainel = asPhotoArray(legacyResistorPhotos.painel);
      }
    });
    substation.quantidadeTransformadores = substation.transformadores.length;
    delete substation.aterramentoTrafoPorResistor;
    delete substation.fotosResistor;

    if (!Array.isArray(substation.demaisEquipamentos)) {
      const oldEquipmentPhotos = legacyPhotos('fotos_demais_equipamentos');
      substation.demaisEquipamentos = oldEquipmentPhotos.length
        ? [{ nome: 'Equipamento de média tensão', fotos: oldEquipmentPhotos }]
        : [];
    }
    substation.demaisEquipamentos.forEach(equipment => { equipment.fotos = asPhotoArray(equipment.fotos); });
    substation.paineis = Array.isArray(substation.paineis) ? substation.paineis : [];
    substation.paineis.forEach(panel => {
      panel.id ||= createId();
      panel.dadosPainel ||= {};
      const data = panel.dadosPainel;
      const oldShort = data.curtoCircuito || {};
      data.nome ||= '';
      data.tipo ||= '';
      const legacyPanelTypes = {
        'QGBT': 'Outros',
        'QGBT de MT': 'Outros',
        'QGBT de BT': 'Outros',
        'QD/QDL/QL/PNL': 'PNL/QDL/QL'
      };
      if (legacyPanelTypes[data.tipo] === 'Outros') data.outroTipo ||= data.tipo;
      data.tipo = legacyPanelTypes[data.tipo] || data.tipo;
      data.outroTipo ||= '';
      data.nivelTensao ||= '';
      const legacyPanelVoltages = {
        '34.5kV': '34.5 kV',
        '13.8kV': '13.8 kV',
        '6.9kV': '6.9 kV',
        '4.16kV': '4.16 kV'
      };
      if (legacyPanelVoltages[data.nivelTensao]) data.nivelTensao = legacyPanelVoltages[data.nivelTensao];
      if (data.nivelTensao === '440V') {
        data.nivelTensao = 'Outro';
        data.outroNivelTensao ||= '440V';
      }
      data.outroNivelTensao ||= '';
      data.quantidadeColunas = Math.max(0, Math.min(
        MAX_PANEL_COLUMNS,
        Number(data.quantidadeColunas) || data.fotos?.fotos_colunas?.length || 0
      ));
      data.configuracaoColunas ||= data.quantidadeColunas > 1 ? 'diversas_colunas' : null;
      delete data.possuiUnifilar;
      data.observacoes ||= '';
      data.observacoesFinais = {
        informacoesColetadas: null,
        justificativaInformacoesNaoColetadas: '',
        possuiObservacaoAdicional: null,
        observacaoAdicional: '',
        ...(data.observacoesFinais || {})
      };
      data.curtoCircuito = {
        suportabilidadePainelDisponivel: oldShort.suportabilidadePainelDisponivel
          ?? (asPhotoArray(data.fotos?.foto_suportabilidades).length
            ? 'sim'
            : (oldShort.naoFoiPossivelObterSuportabilidade ? 'nao' : null)),
        justificativaSuportabilidadePainel: oldShort.justificativaSuportabilidadePainel || '',
        suportabilidadeDisjuntorDisponivel: oldShort.suportabilidadeDisjuntorDisponivel
          ?? (asPhotoArray(data.fotos?.foto_suportabilidade_disjuntor).length
            ? 'sim'
            : (oldShort.naoFoiPossivelObterSuportabilidade ? 'nao' : null)),
        justificativaSuportabilidadeDisjuntor: oldShort.justificativaSuportabilidadeDisjuntor || '',
        possuiMotoresMT: oldShort.possuiMotoresMT ?? null,
        quantidadeMotoresMT: Number(oldShort.quantidadeMotoresMT) || 0,
        motores: Array.isArray(oldShort.motores) ? oldShort.motores : [],
        informacoesCabosDisponiveis: oldShort.informacoesCabosDisponiveis ?? null,
        distanciaCabos: oldShort.distanciaCabos || '',
        bitolaCabos: oldShort.bitolaCabos || '',
        quantidadeCabos: oldShort.quantidadeCabos || '',
        cabos: Array.isArray(oldShort.cabos) ? oldShort.cabos : [],
        possuiInformacaoAdicionalDisjuntores: oldShort.possuiInformacaoAdicionalDisjuntores ?? null,
        informacaoAdicionalDisjuntores: oldShort.informacaoAdicionalDisjuntores || '',
        fotosInformacaoAdicionalDisjuntores: asPhotoArray(oldShort.fotosInformacaoAdicionalDisjuntores)
      };
      if (!data.curtoCircuito.cabos.length
          && (data.curtoCircuito.distanciaCabos || data.curtoCircuito.bitolaCabos || data.curtoCircuito.quantidadeCabos)) {
        data.curtoCircuito.cabos.push({
          finalidade: '',
          distancia: data.curtoCircuito.distanciaCabos,
          bitola: data.curtoCircuito.bitolaCabos,
          quantidadePorFase: data.curtoCircuito.quantidadeCabos
        });
      }
      data.curtoCircuito.cabos = data.curtoCircuito.cabos.map(cable => ({
        finalidade: cable.finalidade ?? cable.tipo ?? '',
        distancia: '',
        bitola: '',
        quantidadePorFase: '',
        ...cable
      }));
      data.curtoCircuito.cabos.forEach(cable => {
        cable.finalidade = cable.finalidade ?? cable.tipo ?? '';
        delete cable.tipo;
      });
      const coordination = data.coordenacaoSeletividade || {};
      data.coordenacaoSeletividade = {
        quantidadeRelesProtecao: coordination.relesProtecao?.length || 0,
        relesProtecao: [],
        quantidadeDisjuntoresLSIG: coordination.disjuntoresLSIG?.length || 0,
        disjuntoresLSIG: [],
        possuiTCsTPs: null,
        fotosTCs: [],
        fotosTPs: [],
        possuiRelesInteligentes: null,
        quantidadeRelesInteligentes: coordination.relesInteligentes?.length || 0,
        relesInteligentes: [],
        fotosDispositivosProtecaoBT: [],
        ...coordination
      };
      data.coordenacaoSeletividade.relesProtecao = Array.isArray(data.coordenacaoSeletividade.relesProtecao)
        ? data.coordenacaoSeletividade.relesProtecao.map(relay => ({
          backupObtido: null,
          cubiculo: '',
          alimentacao: '',
          equipamentoProtegido: '',
          fotosModeloOrderCode: [],
          ...relay,
          fotosModeloOrderCode: asPhotoArray(relay.fotosModeloOrderCode)
        }))
        : [];
      data.coordenacaoSeletividade.relesProtecao.forEach(relay => {
        relay.cubiculo = String(relay.cubiculo || '').match(/\d+/)?.[0] || '';
        if (relay.alimentacao && !['Entrada', 'Alimentador'].includes(relay.alimentacao)) {
          if (!relay.equipamentoProtegido) relay.equipamentoProtegido = relay.alimentacao;
          relay.alimentacao = /entrada/i.test(relay.alimentacao) ? 'Entrada' : 'Alimentador';
        } else if (relay.alimentacao) {
          relay.alimentacao = relay.alimentacao.charAt(0).toUpperCase() + relay.alimentacao.slice(1).toLowerCase();
        }
      });
      data.coordenacaoSeletividade.disjuntoresLSIG = Array.isArray(data.coordenacaoSeletividade.disjuntoresLSIG)
        ? data.coordenacaoSeletividade.disjuntoresLSIG.map(breaker => ({
          cubiculo: '',
          alimentacao: '',
          equipamentoProtegido: '',
          fotosAjustes: [],
          ...breaker,
          fotosAjustes: asPhotoArray(breaker.fotosAjustes)
        }))
        : [];
      data.coordenacaoSeletividade.disjuntoresLSIG.forEach(breaker => {
        breaker.cubiculo = String(breaker.cubiculo || '').match(/\d+/)?.[0] || '';
        if (breaker.alimentacao && !['Entrada', 'Alimentador'].includes(breaker.alimentacao)) {
          if (!breaker.equipamentoProtegido) breaker.equipamentoProtegido = breaker.alimentacao;
          breaker.alimentacao = /entrada/i.test(breaker.alimentacao) ? 'Entrada' : 'Alimentador';
        } else if (breaker.alimentacao) {
          breaker.alimentacao = breaker.alimentacao.charAt(0).toUpperCase() + breaker.alimentacao.slice(1).toLowerCase();
        }
      });
      data.coordenacaoSeletividade.relesInteligentes = Array.isArray(data.coordenacaoSeletividade.relesInteligentes)
        ? data.coordenacaoSeletividade.relesInteligentes.map(relay => ({
          arquivoObtido: null,
          fotosModelo: [],
          ...relay,
          fotosModelo: asPhotoArray(relay.fotosModelo)
        }))
        : [];
      data.coordenacaoSeletividade.quantidadeRelesProtecao = data.coordenacaoSeletividade.relesProtecao.length;
      data.coordenacaoSeletividade.quantidadeDisjuntoresLSIG = data.coordenacaoSeletividade.disjuntoresLSIG.length;
      data.coordenacaoSeletividade.quantidadeRelesInteligentes = data.coordenacaoSeletividade.relesInteligentes.length;
      data.coordenacaoSeletividade.fotosTCs = asPhotoArray(data.coordenacaoSeletividade.fotosTCs);
      data.coordenacaoSeletividade.fotosTPs = asPhotoArray(data.coordenacaoSeletividade.fotosTPs);
      data.coordenacaoSeletividade.fotosDispositivosProtecaoBT =
        asPhotoArray(data.coordenacaoSeletividade.fotosDispositivosProtecaoBT);
      const incident = data.energiaIncidente || {};
      data.energiaIncidente = {
        possuiReleArco: null,
        fotosReleArco: [],
        ajustesReleArcoObtidos: null,
        backupReleArcoPossivel: incident.backupReleArcoPossivel
          ?? incident.ajustesReleArcoObtidos ?? null,
        releArcoTrip: null,
        possuiCompartimentoUnico: null,
        compartimentos: {
          entrada: { altura: '', largura: '', profundidade: '', fotos: [], disjuntorExtraivel: null },
          menor: { altura: '', largura: '', profundidade: '', fotos: [], disjuntorExtraivel: null }
        },
        ...incident
      };
      data.energiaIncidente.ajustesReleArcoObtidos = data.energiaIncidente.backupReleArcoPossivel;
      data.energiaIncidente.fotosReleArco = asPhotoArray(data.energiaIncidente.fotosReleArco);
      data.energiaIncidente.compartimentos ||= {};
      ['entrada', 'menor'].forEach(name => {
        const compartment = data.energiaIncidente.compartimentos[name] || {};
        data.energiaIncidente.compartimentos[name] = {
          altura: '',
          largura: '',
          profundidade: '',
          fotos: [],
          disjuntorExtraivel: null,
          ...compartment,
          fotos: asPhotoArray(compartment.fotos)
        };
        if (!data.energiaIncidente.compartimentos[name].profundidade) {
          data.energiaIncidente.compartimentos[name].profundidade =
            data.energiaIncidente.compartimentos[name].comprimento || '';
        }
        delete data.energiaIncidente.compartimentos[name].comprimento;
      });
      if (!data.configuracaoColunas) {
        if (data.energiaIncidente.possuiCompartimentoUnico === 'sim') {
          data.configuracaoColunas = 'coluna_unica';
        } else if (data.energiaIncidente.possuiCompartimentoUnico === 'nao'
            || data.quantidadeColunas > 1) {
          data.configuracaoColunas = 'diversas_colunas';
        }
      }
      if (data.configuracaoColunas) {
        data.energiaIncidente.possuiCompartimentoUnico =
          data.configuracaoColunas === 'diversas_colunas' ? 'nao' : 'sim';
      }
      if (data.configuracaoColunas === 'coluna_unica') data.quantidadeColunas = 1;
      else if (data.configuracaoColunas === 'diversas_colunas') {
        data.quantidadeColunas = Math.max(2, data.quantidadeColunas);
      }
      data.fotos = { ...clone(modeloLevantamento.subestacoes[0].paineis[0].dadosPainel.fotos), ...data.fotos };
      Object.keys(data.fotos).filter(key => key !== 'fotos_colunas')
        .forEach(key => { data.fotos[key] = asPhotoArray(data.fotos[key]); });
      data.fotos.fotos_colunas = Array.isArray(data.fotos.fotos_colunas)
        ? data.fotos.fotos_colunas.map(asPhotoArray)
        : [];
      data.fotos.fotos_colunas = resizeRecords(data.fotos.fotos_colunas, data.quantidadeColunas, () => []);
      if (data.fotos.fotos_placas_motores_mt.length === 0 && data.fotos.foto_placa_motor_mt) {
        data.fotos.fotos_placas_motores_mt = asPhotoArray(data.fotos.foto_placa_motor_mt);
      }
      const legacyMotorPhotos = data.fotos.fotos_placas_motores_mt;
      const motorCount = Math.max(
        data.curtoCircuito.quantidadeMotoresMT,
        data.curtoCircuito.motores.length,
        legacyMotorPhotos.length
      );
      data.curtoCircuito.motores = resizeRecords(data.curtoCircuito.motores, motorCount, () => ({
        nome: '',
        placaAcessivel: null,
        fotos: []
      })).map((motor, index) => ({
        nome: '',
        placaAcessivel: null,
        fotos: [],
        ...motor,
        fotos: asPhotoArray(motor.fotos?.length ? motor.fotos : legacyMotorPhotos[index])
      }));
      data.curtoCircuito.quantidadeMotoresMT = data.curtoCircuito.motores.length;
      if (legacyMotorPhotos.length && data.curtoCircuito.possuiMotoresMT === null) {
        data.curtoCircuito.possuiMotoresMT = 'sim';
      }
      data.fotos.fotos_placas_motores_mt = data.curtoCircuito.motores.flatMap(motor => motor.fotos);
      ['foto_placa_trafo', 'foto_placa_resistor', 'foto_painel_resistor', 'fotos_outros_equipamentos', 'foto_placa_motor_mt']
        .forEach(key => { delete data.fotos[key]; });
    });
  });
  return survey;
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Falha ao abrir o armazenamento dos levantamentos.'));
  });
}

function requestStore(mode, action) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = action(transaction.objectStore(STORE_NAME));
    let result;
    request.onsuccess = () => { result = request.result; };
    request.onerror = () => reject(request.error || new Error('Falha ao acessar o levantamento.'));
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error || new Error('Falha na transação do IndexedDB.'));
    transaction.onabort = () => reject(transaction.error || new Error('A gravação no IndexedDB foi cancelada.'));
  });
}

function showAlert(message, isError = false) {
  clearTimeout(alertTimer);
  appAlert.textContent = message;
  appAlert.classList.toggle('error', isError);
  appAlert.classList.add('visible');
  alertTimer = setTimeout(() => appAlert.classList.remove('visible'), 3800);
}

function updateSaveStatus(message, isError = false) {
  saveStatus.innerHTML = `<span class="status-dot"></span> ${message}`;
  saveStatus.classList.toggle('text-warning', isError);
}

async function reloadSavedSurveys() {
  savedSurveys = (await requestStore('readonly', store => store.getAll()))
    .map(normalizeSurvey)
    .sort((first, second) => second.atualizadoEm.localeCompare(first.atualizadoEm));
  renderHome();
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function safeArchiveName(value) {
  return String(value || 'sem-nome')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._-]+|[._-]+$/g, '') || 'sem-nome';
}

function toWorksheet(rows, headers) {
  const worksheet = window.XLSX.utils.aoa_to_sheet([
    headers,
    ...rows.map(row => headers.map(header => row[header] ?? ''))
  ]);
  applyWorksheetStyles(worksheet);
  return worksheet;
}

function applyWorksheetStyles(worksheet) {
  const thinBorder = { style: 'thin', color: { rgb: 'FF000000' } };
  Object.keys(worksheet).forEach(address => {
    if (address.startsWith('!')) return;

    const isHeader = window.XLSX.utils.decode_cell(address).r === 0;
    worksheet[address].s = {
      fill: {
        patternType: 'solid',
        fgColor: { rgb: isHeader ? 'FF0070C0' : 'FFFFFFFF' }
      },
      font: {
        color: { rgb: isHeader ? 'FFFFFFFF' : 'FF000000' },
        bold: isHeader
      },
      alignment: {
        horizontal: 'center',
        vertical: 'center'
      },
      border: {
        top: thinBorder,
        bottom: thinBorder,
        left: thinBorder,
        right: thinBorder
      }
    };
  });
}

function photoDataExists(photos) {
  return asPhotoArray(photos).some(photo => {
    const value = photo instanceof Blob ? photo : photo?.blob ?? photo?.base64 ?? photo?.data;
    return value instanceof Blob ? value.size > 0 : typeof value === 'string' && value.length > 0;
  });
}

function answerLabel(value) {
  if (value === 'sim') return 'Sim';
  if (value === 'nao') return 'Não';
  if (value === 'nao_identificado') return 'Não é possível identificar';
  return '';
}

function panelVoltage(data) {
  return data.nivelTensao === 'Outro' ? data.outroNivelTensao : data.nivelTensao;
}

function createSurveyWorkbook(survey) {
  if (!window.XLSX) {
    throw new Error('A biblioteca xlsx-js-style não foi carregada. Conecte-se à internet e tente novamente.');
  }
  normalizeSurvey(survey);
  const substationHeaders = [
    'Nome da SE',
    'Quantidade de Transformadores',
    'Quantidade de painéis daquela SE',
    'Possibilidade de Alimentação do Mesmo Barramento',
    'Modo de Operação',
    'Outros Equipamentos de Média Tensão',
    'Observações da SE'
  ];
  const panelHeaders = [
    'Nome da SE',
    'Nome do Painel',
    'Nível de Tensão',
    'Suportabilidades do painel obtidas?',
    'Justificativa — suportabilidades do painel',
    'Foto da suportabilidade do painel capturada',
    'Suportabilidades do disjuntor de entrada obtidas?',
    'Justificativa — suportabilidades do disjuntor de entrada',
    'Foto da suportabilidade do disjuntor capturada',
    'Quantidade de colunas',
    'Fotos das colunas capturadas',
    'Tipo de Painel',
    'Observações do Painel'
  ];
  const transformerHeaders = [
    'Nome da SE',
    'Nome do Transformador',
    'Aterrado por resistor?',
    'Tem Foto do Trafo?',
    'Tem Foto da placa do trafo?'
  ];
  const selectivityHeaders = [
    'Nome da SE',
    'Nome do Painel',
    'Tipo de Painel',
    'Nível de Tensão',
    'Nome do cubículo do relé/disjuntor',
    'Entrada/Saída',
    'Foi possível obter backup do relé/Ajustes do disjuntor LSIG?'
  ];
  const incidentHeaders = [
    'Nome da SE',
    'Nome do Painel',
    'Tipo de Painel',
    'Nível de Tensão',
    'Compartimento',
    'Altura (mm)',
    'Largura (mm)',
    'Profundidade (mm)',
    'Disjuntor é extraível?',
    'Possui relé de arco?',
    'Tem foto do relé de arco?',
    'Ajuste do relé de arco?',
    'TRIP local ou a montante?'
  ];
  const substations = survey.subestacoes.map(substation => ({
    'Nome da SE': substation.nome,
    'Quantidade de Transformadores': substation.transformadores.length,
    'Quantidade de painéis daquela SE': substation.paineis.length,
    'Possibilidade de Alimentação do Mesmo Barramento': substation.podeAlimentarMesmoBarramento,
    'Modo de Operação': substation.modoOperacaoTrafos.join(', '),
    'Outros Equipamentos de Média Tensão': substation.demaisEquipamentos.map(item => item.nome).filter(Boolean).join('; '),
    'Observações da SE': substation.observacoes
  }));
  const transformers = survey.subestacoes.flatMap(substation => substation.transformadores.map(transformer => ({
    'Nome da SE': substation.nome,
    'Nome do Transformador': transformer.nome,
    'Aterrado por resistor?': answerLabel(transformer.aterramentoPorResistor),
    'Tem Foto do Trafo?': photoDataExists(transformer.fotos.transformador) ? 'Sim' : 'Não',
    'Tem Foto da placa do trafo?': photoDataExists(transformer.fotos.placa) ? 'Sim' : 'Não'
  })));
  const panels = survey.subestacoes.flatMap(substation => substation.paineis.map(panel => {
    const data = panel.dadosPainel;
    const short = data.curtoCircuito;
    return {
      'Nome da SE': substation.nome,
      'Nome do Painel': data.nome,
      'Nível de Tensão': panelVoltage(data),
      'Suportabilidades do painel obtidas?': answerLabel(short.suportabilidadePainelDisponivel),
      'Justificativa — suportabilidades do painel': short.justificativaSuportabilidadePainel,
      'Foto da suportabilidade do painel capturada':
        data.fotos.foto_suportabilidades.length > 0 ? 'Sim' : 'Não',
      'Suportabilidades do disjuntor de entrada obtidas?': answerLabel(short.suportabilidadeDisjuntorDisponivel),
      'Justificativa — suportabilidades do disjuntor de entrada': short.justificativaSuportabilidadeDisjuntor,
      'Foto da suportabilidade do disjuntor capturada':
        data.fotos.foto_suportabilidade_disjuntor.length > 0 ? 'Sim' : 'Não',
      'Quantidade de colunas': data.quantidadeColunas,
      'Fotos das colunas capturadas': data.fotos.fotos_colunas.some(photoDataExists) ? 'Sim' : 'Não',
      'Tipo de Painel': data.tipo,
      'Observações do Painel': data.observacoes
    };
  }));
  const selectivity = survey.subestacoes.flatMap(substation => substation.paineis.flatMap(panel => {
    const data = panel.dadosPainel;
    const coordination = data.coordenacaoSeletividade;
    const voltage = panelVoltage(data);
    return [
      ...coordination.relesProtecao.map(relay => ({
        'Nome da SE': substation.nome,
        'Nome do Painel': data.nome,
        'Tipo de Painel': data.tipo,
        'Nível de Tensão': voltage,
        'Nome do cubículo do relé/disjuntor': relay.cubiculo,
        'Entrada/Saída': relay.alimentacao,
        'Foi possível obter backup do relé/Ajustes do disjuntor LSIG?': answerLabel(relay.backupObtido)
      })),
      ...coordination.disjuntoresLSIG.map(breaker => ({
        'Nome da SE': substation.nome,
        'Nome do Painel': data.nome,
        'Tipo de Painel': data.tipo,
        'Nível de Tensão': voltage,
        'Nome do cubículo do relé/disjuntor': breaker.cubiculo,
        'Entrada/Saída': breaker.alimentacao,
        'Foi possível obter backup do relé/Ajustes do disjuntor LSIG?': photoDataExists(breaker.fotosAjustes) ? 'Sim' : 'Não'
      }))
    ];
  }));
  const incidentEnergy = survey.subestacoes.flatMap(substation => substation.paineis.flatMap(panel => {
    const data = panel.dadosPainel;
    const incident = data.energiaIncidente;
    const compartmentNames = incident.possuiCompartimentoUnico === 'nao'
      ? ['entrada', 'menor']
      : ['entrada'];
    return compartmentNames.map(name => {
      const compartment = incident.compartimentos[name];
      return {
        'Nome da SE': substation.nome,
        'Nome do Painel': data.nome,
        'Tipo de Painel': data.tipo,
        'Nível de Tensão': panelVoltage(data),
        'Compartimento': name === 'entrada' ? 'Entrada' : 'Menor Gaveta',
        'Altura (mm)': compartment.altura,
        'Largura (mm)': compartment.largura,
        'Profundidade (mm)': compartment.profundidade,
        'Disjuntor é extraível?': answerLabel(compartment.disjuntorExtraivel),
        'Possui relé de arco?': answerLabel(incident.possuiReleArco),
        'Tem foto do relé de arco?': photoDataExists(incident.fotosReleArco) ? 'Sim' : 'Não',
        'Ajuste do relé de arco?': answerLabel(incident.ajustesReleArcoObtidos),
        'TRIP local ou a montante?': answerLabel(incident.releArcoTrip)
      };
    });
  }));
  const workbook = window.XLSX.utils.book_new();
  const substationSheet = toWorksheet(substations, substationHeaders);
  const panelSheet = toWorksheet(panels, panelHeaders);
  const transformerSheet = toWorksheet(transformers, transformerHeaders);
  const selectivitySheet = toWorksheet(selectivity, selectivityHeaders);
  const incidentSheet = toWorksheet(incidentEnergy, incidentHeaders);
  [
    [substationSheet, substationHeaders],
    [panelSheet, panelHeaders],
    [transformerSheet, transformerHeaders],
    [selectivitySheet, selectivityHeaders],
    [incidentSheet, incidentHeaders]
  ].forEach(([worksheet, headers]) => {
    worksheet['!cols'] = headers.map(header => ({ wch: Math.min(48, Math.max(16, header.length + 3)) }));
  });
  window.XLSX.utils.book_append_sheet(workbook, substationSheet, 'Informações da SE');
  window.XLSX.utils.book_append_sheet(workbook, panelSheet, 'Estudo de Curto-Circuito');
  window.XLSX.utils.book_append_sheet(workbook, transformerSheet, 'Informações dos TRAFOS');
  window.XLSX.utils.book_append_sheet(workbook, selectivitySheet, 'Estudo de Seletividade');
  window.XLSX.utils.book_append_sheet(workbook, incidentSheet, 'Estudo de Energia Incidente');
  return workbook;
}

function workbookFilename(survey) {
  return `levantamento-${safeArchiveName(survey.obra.numero || survey.obra.nomeServico)}.xlsx`;
}

function downloadBlob(blob, filename) {
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
}

function exportarExcel(survey) {
  const workbook = createSurveyWorkbook(survey);
  window.XLSX.writeFile(workbook, workbookFilename(survey));
  return {
    substations: survey.subestacoes.length,
    panels: survey.subestacoes.reduce((total, substation) => total + substation.paineis.length, 0)
  };
}

function photoPayload(photo) {
  if (photo instanceof Blob) return { blob: photo, name: photo.name || '', type: photo.type || '' };

  const value = photo && typeof photo === 'object'
    ? (photo.blob ?? photo.base64 ?? photo.data)
    : photo;
  const name = photo && typeof photo === 'object' ? (photo.name || '') : '';
  const type = photo && typeof photo === 'object' ? (photo.type || '') : '';
  if (value instanceof Blob) return { blob: value, name, type: type || value.type };
  if (typeof value !== 'string' || !value) {
    throw new Error(`A foto "${name || 'sem nome'}" não contém dados de imagem válidos.`);
  }

  const dataUrlMatch = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/s);
  const base64 = dataUrlMatch ? dataUrlMatch[2] : value;
  const contentType = dataUrlMatch?.[1] || type || 'image/jpeg';
  let binary;
  try {
    binary = atob(base64.replace(/\s/g, ''));
  } catch {
    throw new Error(`A foto "${name || 'sem nome'}" contém uma sequência base64 inválida.`);
  }
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  return { blob: new Blob([bytes], { type: contentType }), name, type: contentType };
}

function photoExtension(photo) {
  const mimeExtension = photo.type.split('/')[1]?.toLowerCase().replace('jpeg', 'jpg');
  if (mimeExtension && /^[a-z0-9]+$/.test(mimeExtension)) return mimeExtension;
  const filenameExtension = photo.name.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase();
  return filenameExtension || 'jpg';
}

function addPhotosToZip(zipFolder, photos, filenameBase, watermarkContext, pendingWatermarks) {
  const photoList = asPhotoArray(photos);
  let watermarkTask = pendingWatermarks[pendingWatermarks.length - 1] || Promise.resolve();
  photoList.forEach((photo, index) => {
    const suffix = photoList.length > 1 ? `_${index + 1}` : '';
    watermarkTask = watermarkTask.then(async () => {
      const payload = await watermarkPhoto(photo, watermarkContext);
      zipFolder.file(`${filenameBase}${suffix}.${photoExtension(payload)}`, payload.blob);
    });
    pendingWatermarks.push(watermarkTask);
  });
}

async function gerarZipCompleto(survey) {
  if (!window.JSZip) {
    throw new Error('A biblioteca JSZip não foi carregada. Conecte-se à internet e tente novamente.');
  }
  const pendingWatermarks = [];
  const makeWatermarkContext = (substation, subject, description) => ({
    substation: substation || 'SE',
    subject: subject || '',
    description
  });
  const workbook = createSurveyWorkbook(survey);
  const zip = new window.JSZip();
  const workFolder = zip.folder(safeArchiveName(survey.obra.numero || survey.obra.nomeServico));
  workFolder.file(workbookFilename(survey), window.XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }));

  survey.subestacoes.forEach((substation, seIndex) => {
    const seFolder = workFolder.folder(safeArchiveName(substation.nome || `SE_${seIndex + 1}`));
    addPhotosToZip(
      seFolder,
      substation.foto_observacao_se,
      'Foto_Observacoes_Gerais_SE',
      makeWatermarkContext(substation.nome, substation.nome, 'Foto das observações gerais da subestação'),
      pendingWatermarks
    );
    substation.transformadores.forEach((transformer, transformerIndex) => {
      const transformerFolder = seFolder
        .folder('Transformadores')
        .folder(safeArchiveName(transformer.nome || `Trafo_${transformerIndex + 1}`));
      const transformerName = transformer.nome || `Transformador ${transformerIndex + 1}`;
      const transformerContext = (description) =>
        makeWatermarkContext(substation.nome, transformerName, description);
      addPhotosToZip(transformerFolder, transformer.fotos.transformador,
        `Foto_Trafo_${transformerIndex + 1}`, transformerContext(`Foto do ${transformerName}`), pendingWatermarks);
      addPhotosToZip(transformerFolder, transformer.fotos.placa,
        `Placa_Trafo_${transformerIndex + 1}`, transformerContext(`Placa do transformador ${transformerName}`), pendingWatermarks);
      addPhotosToZip(transformerFolder, transformer.fotos.resistorPlaca,
        `Placa_Resistor_Trafo_${transformerIndex + 1}`, transformerContext(`Placa do resistor do TRAFO ${transformerName}`), pendingWatermarks);
      addPhotosToZip(transformerFolder, transformer.fotos.resistorPainel,
        `Painel_Resistor_Trafo_${transformerIndex + 1}`, transformerContext(`Painel do resistor do TRAFO ${transformerName}`), pendingWatermarks);
    });

    substation.demaisEquipamentos.forEach((equipment, equipmentIndex) => {
      const equipmentFolder = seFolder
        .folder('Equipamentos_MT')
        .folder(safeArchiveName(equipment.nome || `Equipamento_${equipmentIndex + 1}`));
      addPhotosToZip(
        equipmentFolder,
        equipment.fotos,
        `Foto_Equipamento_${equipmentIndex + 1}`,
        makeWatermarkContext(substation.nome, equipment.nome || 'Equipamento de MT', `Equipamento ${equipmentIndex + 1}`),
        pendingWatermarks
      );
    });

    substation.paineis.forEach((panel, panelIndex) => {
      const data = panel.dadosPainel;
      const panelFolder = seFolder.folder(safeArchiveName(data.nome || `Painel_${panelIndex + 1}`));
      const panelName = data.nome || 'Painel';
      const panelContext = description =>
        makeWatermarkContext(substation.nome, panelName, description);
      const photoNames = {
        foto_identificacao: 'Foto_Identificacao_Painel',
        foto_unifilar: 'Foto_Unifilar',
        foto_painel_completo: 'Visao_Geral_Painel',
        foto_suportabilidades: 'Foto_Suportabilidade',
        foto_suportabilidade_disjuntor: 'Foto_Suportabilidade_Disjuntor',
        fotos_placas_motores_mt: 'Placa_Motor_MT'
      };
      const photoDescriptions = {
        foto_identificacao: 'Foto de identificação do painel',
        foto_unifilar: 'Foto do Unifilar',
        foto_painel_completo: 'Foto completa do painel',
        foto_suportabilidades: 'Foto da suportabilidade do painel',
        foto_suportabilidade_disjuntor: 'Foto da suportabilidade do disjuntor',
        fotos_placas_motores_mt: 'Placa dos motores de MT'
      };
      Object.entries(photoNames).forEach(([key, filename]) => {
        addPhotosToZip(panelFolder, data.fotos[key], filename, panelContext(photoDescriptions[key]), pendingWatermarks);
      });
      data.fotos.fotos_colunas.forEach((photos, index) => {
        addPhotosToZip(panelFolder, photos, `Foto_Coluna_${index + 1}`,
          panelContext(`Foto da Coluna ${index + 1}`), pendingWatermarks);
      });
      const coordination = data.coordenacaoSeletividade;
      const coordinationFolder = panelFolder.folder('Seletividade_Coordenacao');
      coordination.relesProtecao.forEach((relay, index) => {
        addPhotosToZip(coordinationFolder, relay.fotosModeloOrderCode, `Rele_Protecao_${index + 1}_Modelo_Order_Code`,
          panelContext(`Relé de proteção ${index + 1} — modelo e order code`), pendingWatermarks);
      });
      coordination.disjuntoresLSIG.forEach((breaker, index) => {
        addPhotosToZip(coordinationFolder, breaker.fotosAjustes, `Disjuntor_LSIG_${index + 1}_Ajustes`,
          panelContext(`Disjuntor LSIG ${index + 1} — ajustes`), pendingWatermarks);
      });
      addPhotosToZip(coordinationFolder, coordination.fotosTCs, 'Foto_TCs',
        panelContext('Foto dos TCs'), pendingWatermarks);
      addPhotosToZip(coordinationFolder, coordination.fotosTPs, 'Foto_TPs',
        panelContext('Foto dos TPs'), pendingWatermarks);
      coordination.relesInteligentes.forEach((relay, index) => {
        addPhotosToZip(coordinationFolder, relay.fotosModelo, `Rele_Inteligente_${index + 1}_Modelo`,
          panelContext(`Relé inteligente ${index + 1} — modelo`), pendingWatermarks);
      });
      addPhotosToZip(coordinationFolder, coordination.fotosDispositivosProtecaoBT, 'Dispositivos_Protecao_BT',
        panelContext('Fotos dos dispositivos de proteção que o painel possui'), pendingWatermarks);

      const incident = data.energiaIncidente;
      const incidentFolder = panelFolder.folder('Energia_Incidente');
      addPhotosToZip(incidentFolder, incident.fotosReleArco, 'Rele_Arco',
        panelContext('Foto do relé de arco'), pendingWatermarks);
      ['entrada', 'menor'].forEach(name => {
        const compartment = incident.compartimentos[name];
        const title = name === 'entrada' ? 'Compartimento de Entrada' : 'Menor Compartimento';
        const dimensions = ['altura', 'largura', 'profundidade']
          .map(dimension => compartment[dimension] || '—')
          .join(' x ');
        addPhotosToZip(incidentFolder, compartment.fotos,
          name === 'entrada' ? 'Compartimento_Entrada' : 'Menor_Compartimento',
          panelContext(`Foto do ${title} - Dimensões: ${dimensions} mm`), pendingWatermarks);
      });
    });
  });

  await Promise.all(pendingWatermarks);
  const archive = await zip.generateAsync({ type: 'blob' });
  return {
    archive,
    substations: survey.subestacoes.length,
    panels: survey.subestacoes.reduce((total, substation) => total + substation.paineis.length, 0),
    photos: Object.keys(zip.files).filter(path => !zip.files[path].dir && /\.(jpe?g|png|webp|gif)$/i.test(path)).length
  };
}

async function exportarZipCompleto(survey) {
  const result = await gerarZipCompleto(survey);
  downloadBlob(result.archive, `levantamento-completo-${safeArchiveName(survey.obra.numero || survey.obra.nomeServico)}.zip`);
  return {
    substations: result.substations,
    panels: result.panels,
    photos: result.photos
  };
}

const msalConfig = {
  auth: {
    clientId: '748cbb73-1db2-488a-af7c-9a11fe8fbc6b',
    authority: 'https://login.microsoftonline.com/4f7cc68e-46e3-4398-aeac-6e8089484e7e',
    redirectUri: `${window.location.origin}${window.location.pathname}`
  },
  cache: {
    cacheLocation: 'sessionStorage'
  }
};
const GRAPH_SCOPES = ['Files.ReadWrite', 'User.Read'];
const ONEDRIVE_CHUNK_SIZE = 10 * 320 * 1024;
let msalApplication;

function getMsalApplication() {
  if (!window.msal?.PublicClientApplication) {
    throw new Error('A biblioteca de autenticação Microsoft não foi carregada. Verifique a conexão e tente novamente.');
  }
  msalApplication ||= new window.msal.PublicClientApplication(msalConfig);
  return msalApplication;
}

async function loginPopup() {
  const application = getMsalApplication();
  const result = await application.loginPopup({ scopes: GRAPH_SCOPES });
  application.setActiveAccount(result.account);
  return result.account;
}

async function getGraphAccessToken() {
  const application = getMsalApplication();
  let account = application.getActiveAccount() || application.getAllAccounts()[0];
  if (!account) account = await loginPopup();

  try {
    const result = await application.acquireTokenSilent({ account, scopes: GRAPH_SCOPES });
    return result.accessToken;
  } catch (error) {
    if (!(error instanceof window.msal.InteractionRequiredAuthError)) throw error;
    const result = await application.acquireTokenPopup({ account, scopes: GRAPH_SCOPES });
    application.setActiveAccount(result.account);
    return result.accessToken;
  }
}

async function graphError(response, action) {
  const body = await response.text();
  let detail = body;
  try {
    const payload = JSON.parse(body);
    detail = payload.error?.message || body;
  } catch {
    detail = body;
  }
  return new Error(`${action} (HTTP ${response.status})${detail ? `: ${detail}` : '.'}`);
}

async function ensureOneDriveFolder(accessToken, parentId, folderName, pathParts) {
  const encodedPath = pathParts.map(encodeURIComponent).join('/');
  const itemUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/${encodedPath}`;
  const existing = await fetch(itemUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (existing.ok) return existing.json();
  if (existing.status !== 404) throw await graphError(existing, 'Não foi possível verificar a pasta do OneDrive');

  const created = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${parentId}/children`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: folderName,
      folder: {},
      '@microsoft.graph.conflictBehavior': 'fail'
    })
  });
  if (created.ok) return created.json();
  if (created.status === 409) {
    const raced = await fetch(itemUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (raced.ok) return raced.json();
    throw await graphError(raced, 'Não foi possível acessar a pasta existente no OneDrive');
  }
  throw await graphError(created, 'Não foi possível criar a pasta no OneDrive');
}

// Uploads the generated ZIP in Graph-compatible, sequential byte ranges.
async function createUploadSession(survey, archiveBlob, accessToken = null) {
  accessToken ||= await getGraphAccessToken();
  const projectFolder = safeArchiveName(survey.obra.numero || survey.obra.nomeServico);
  const rootFolder = await ensureOneDriveFolder(accessToken, 'root', 'Levantamentos_PWA', ['Levantamentos_PWA']);
  const destinationFolder = await ensureOneDriveFolder(
    accessToken,
    rootFolder.id,
    projectFolder,
    ['Levantamentos_PWA', projectFolder]
  );
  const fileName = `Levantamento-${projectFolder}.zip`;
  const sessionResponse = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/items/${destinationFolder.id}:/${encodeURIComponent(fileName)}:/createUploadSession`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        item: {
          name: fileName,
          '@microsoft.graph.conflictBehavior': 'replace'
        }
      })
    }
  );
  if (!sessionResponse.ok) throw await graphError(sessionResponse, 'Não foi possível iniciar o upload para o OneDrive');
  const { uploadUrl } = await sessionResponse.json();
  if (!uploadUrl) throw new Error('O Microsoft Graph não retornou a URL da sessão de upload.');

  for (let start = 0; start < archiveBlob.size; start += ONEDRIVE_CHUNK_SIZE) {
    const end = Math.min(start + ONEDRIVE_CHUNK_SIZE, archiveBlob.size);
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Range': `bytes ${start}-${end - 1}/${archiveBlob.size}` },
      body: archiveBlob.slice(start, end)
    });
    if (!response.ok) throw await graphError(response, 'Falha ao enviar um bloco do arquivo ao OneDrive');
  }
}

async function shareSurveyZip(survey) {
  const { archive } = await gerarZipCompleto(survey);
  const arquivoZip = new File([archive], 'Levantamento.zip', { type: 'application/zip' });
  if (!navigator.share || !navigator.canShare || !navigator.canShare({ files: [arquivoZip] })) {
    downloadBlob(archive, arquivoZip.name);
    showAlert('Este navegador não oferece compartilhamento nativo de arquivos. O ZIP foi baixado para você compartilhar manualmente.');
    return;
  }
  try {
    await navigator.share({
      files: [arquivoZip],
      title: 'Levantamento de Campo'
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      downloadBlob(archive, arquivoZip.name);
      showAlert('O navegador bloqueou o compartilhamento nativo. O ZIP foi baixado para você compartilhar manualmente.');
      return;
    }
    throw error;
  }
}

function renderHome() {
  const list = document.getElementById('saved-surveys');
  const empty = document.getElementById('home-empty');
  list.replaceChildren();
  empty.hidden = savedSurveys.length > 0;

  savedSurveys.forEach(survey => {
    const card = document.createElement('article');
    card.className = 'card survey-card';
    const selectedScopes = [...survey.obra.escopoServico, ...survey.obra.outrosItensEscopo];
    const scopes = selectedScopes.length
      ? selectedScopes.join(' · ')
      : 'Escopo não selecionado';
    const panelCount = survey.subestacoes.reduce((total, se) => total + se.paineis.length, 0);
    card.innerHTML = `
      <div class="card-body">
        <div><p class="eyebrow mb-2">Obra ${escapeHtml(survey.obra.numero || 'sem número')}</p>
          <h2>${escapeHtml(survey.obra.nomeServico || survey.obra.cliente || 'Levantamento sem título')}</h2>
          <div class="survey-meta mt-1">${escapeHtml(survey.obra.cliente || 'Cliente não informado')}</div></div>
        <div class="survey-meta">${survey.subestacoes.length} SE · ${panelCount} painéis</div>
        <div class="small text-secondary">${escapeHtml(scopes)}</div>
        <div class="survey-card-actions">
          <button class="btn btn-sm btn-primary" type="button" data-open-survey="${survey.id}">Continuar</button>
          <button class="btn btn-sm btn-secondary" type="button" data-export-survey="${survey.id}" data-export-format="excel">Exportar Apenas Planilha (.xlsx)</button>
          <button class="btn btn-sm btn-success" type="button" data-export-survey="${survey.id}" data-export-format="zip">Exportar Levantamento Completo (.zip)</button>
          <button class="btn btn-sm btn-outline-primary" type="button" data-upload-survey="${survey.id}">☁️ Upload para OneDrive</button>
          <button class="btn btn-sm btn-outline-secondary" type="button" data-share-survey="${survey.id}">📤 Compartilhar (WhatsApp / Drive)</button>
          <button class="btn btn-sm btn-outline-danger" type="button" data-delete-survey="${survey.id}">Excluir</button>
        </div>
      </div>`;
    list.append(card);
  });
}

function showScreen(screen) {
  const isWizard = screen === 'wizard';
  homeScreen.hidden = isWizard;
  wizardScreen.hidden = !isWizard;
}

function setStep(step) {
  currentStep = step;
  document.getElementById('step-1').hidden = step !== 1;
  document.getElementById('step-2').hidden = step !== 2;
  const firstTab = document.getElementById('step-tab-1');
  const secondTab = document.getElementById('step-tab-2');
  firstTab.classList.toggle('active', step === 1);
  firstTab.classList.toggle('complete', step === 2);
  secondTab.classList.toggle('active', step === 2);
  firstTab.setAttribute('aria-current', step === 1 ? 'step' : 'false');
  secondTab.setAttribute('aria-current', step === 2 ? 'step' : 'false');
  secondTab.disabled = !currentSurvey?.obra.numero || !currentSurvey?.obra.cliente;
  document.getElementById('wizard-title').textContent = step === 1 ? 'Dados do serviço' : 'SEs e painéis';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateWorkHeader() {
  document.getElementById('wizard-work-number').textContent = currentSurvey?.obra.numero
    ? `Obra ${currentSurvey.obra.numero}`
    : 'Novo levantamento';
}

function loadSurveyIntoForm() {
  normalizeSurvey(currentSurvey);
  serviceForm.reset();
  document.querySelectorAll('[data-service-field]').forEach(input => {
    input.value = currentSurvey.obra[input.dataset.serviceField] ?? '';
  });
  document.querySelectorAll('[data-scope]').forEach(input => {
    input.checked = currentSurvey.obra.escopoServico.includes(input.value);
  });
  document.querySelectorAll('[data-additional-scope]').forEach(input => {
    input.checked = currentSurvey.obra.outrosItensEscopo.includes(input.value);
  });
  document.getElementById('quantidade-ses').value = currentSurvey.subestacoes.length;
  syncScopeVisibility();
  renderSubstations();
  updateWorkHeader();
  setStep(1);
  showScreen('wizard');
}

function getPanel(seIndex, panelIndex) {
  return currentSurvey.subestacoes[seIndex]?.paineis[panelIndex];
}

function releasePhotoUrls(root) {
  root.querySelectorAll('img[data-object-url]').forEach(image => URL.revokeObjectURL(image.dataset.objectUrl));
}

function radioName(prefix, seIndex, panelIndex, field) {
  return `${prefix}-${field}-se-${seIndex}-painel-${panelIndex}`;
}

function paintPhotoPreview(preview, photos, onRemove) {
  preview.querySelectorAll('img[data-object-url]').forEach(image => URL.revokeObjectURL(image.dataset.objectUrl));
  preview.replaceChildren();
  asPhotoArray(photos).forEach((photo, index) => {
    const image = document.createElement('img');
    image.alt = photo.name || 'Foto registrada';
    image.src = URL.createObjectURL(photoPayload(photo).blob);
    image.dataset.objectUrl = image.src;
    preview.append(image);
    const remove = document.createElement('button');
    remove.className = 'btn btn-sm btn-link text-danger p-0 ms-1';
    remove.type = 'button';
    remove.textContent = 'Remover';
    remove.addEventListener('click', () => onRemove(index));
    preview.append(remove);
  });
}

function renderPhotoPreview(preview, photos) {
  paintPhotoPreview(preview, photos, async index => {
    photos.splice(index, 1);
    const input = preview.closest('.photo-field')?.querySelector('.photo-input');
    syncMotorPhotoExport(input);
    renderPhotoPreview(preview, photos);
    await persistCurrentSurvey();
  });
}

function createInlineTipButton(modalId, label) {
  const button = document.createElement('button');
  button.className = 'btn btn-sm btn-outline-info py-0 px-1';
  button.type = 'button';
  button.dataset.bsToggle = 'modal';
  button.dataset.bsTarget = `#${modalId}`;
  button.setAttribute('aria-label', label);
  button.textContent = 'ℹ️';
  return button;
}

function addPhotoField(container, title, owner, key, photos, metadata = {}) {
  const field = document.createElement('div');
  field.className = `photo-field ${metadata.photoFieldClass || 'col-md-6'}`;
  const heading = document.createElement('span');
  heading.className = `form-label d-block${metadata.helpModalId ? ' mb-0' : ''}`;
  heading.textContent = title;
  if (metadata.helpModalId) {
    const headingRow = document.createElement('div');
    headingRow.className = 'd-flex align-items-center gap-2 mb-1';
    headingRow.append(heading, createInlineTipButton(
      metadata.helpModalId,
      metadata.helpLabel || `Dica: ${title}`
    ));
    field.append(headingRow);
  } else {
    field.append(heading);
  }
  const label = document.createElement('label');
  label.className = 'btn btn-sm btn-outline-secondary photo-button';
  const buttonText = document.createElement('span');
  buttonText.textContent = `＋ ${metadata.buttonLabel || `Tirar foto: ${title}`}`;
  const input = document.createElement('input');
  input.className = 'photo-input';
  input.type = 'file';
  input.accept = 'image/*';
  input.multiple = owner !== 'substation';
  input.dataset.photoOwner = owner;
  input.dataset.photoKey = key;
  input.dataset.photoDescription = title;
  Object.entries(metadata).forEach(([name, value]) => { input.dataset[name] = String(value); });
  input.id = `photo-${owner}-${metadata.seIndex}-${metadata.transformerIndex ?? ''}-${metadata.equipmentIndex ?? ''}-${key}`;
  if (metadata.photoPath) input.id = `photo-${owner}-${metadata.seIndex}-${metadata.panelIndex}-${metadata.photoPath.replaceAll('.', '-')}`;
  if (owner === 'transformer' && key === 'transformador') {
    buttonText.dataset.transformerPhotoLabel = '';
    buttonText.textContent = `＋ ${metadata.buttonLabel || `Tirar foto de ${title.replace(/^Transformador /, '')}`}`;
  }
  label.htmlFor = input.id;
  label.append(buttonText, input);
  const preview = document.createElement('div');
  preview.className = 'photo-preview';
  field.append(label, preview);
  container.append(field);
  renderPhotoPreview(preview, photos);
}

function createFieldset(legendText, className = 'col-12') {
  const fieldset = document.createElement('fieldset');
  fieldset.className = className;
  const legend = document.createElement('legend');
  legend.className = 'form-label';
  legend.textContent = legendText;
  fieldset.append(legend);
  return fieldset;
}

function addPanelExtraRadio(container, question, sectionName, fieldName, value, options, metadata = {}) {
  const fieldset = createFieldset(question, metadata.className || 'col-12');
  options.forEach((option, index) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'form-check form-check-inline';
    const input = document.createElement('input');
    input.className = 'form-check-input';
    input.type = 'radio';
    input.name = `${sectionName}-${fieldName}-${metadata.seIndex}-${metadata.panelIndex}-${metadata.recordIndex ?? ''}`;
    input.id = `${input.name}-${index}`;
    input.value = option.value;
    input.checked = value === option.value;
    input.dataset.panelExtraField = fieldName;
    input.dataset.extraSection = sectionName;
    if (metadata.recordArray) {
      input.dataset.extraRecordArray = metadata.recordArray;
      input.dataset.extraRecordIndex = String(metadata.recordIndex);
    }
    input.dataset.seIndex = String(metadata.seIndex);
    input.dataset.panelIndex = String(metadata.panelIndex);
    if (metadata.required) input.required = true;
    const label = document.createElement('label');
    label.className = 'form-check-label';
    label.htmlFor = input.id;
    label.textContent = option.label;
    wrapper.append(input, label);
    fieldset.append(wrapper);
  });
  container.append(fieldset);
  return fieldset;
}

function addPanelExtraText(container, question, fieldName, value, metadata) {
  const wrapper = document.createElement('div');
  wrapper.className = 'col-12';
  const label = document.createElement('label');
  label.className = 'form-label';
  const input = document.createElement('input');
  input.className = 'form-control';
  input.type = metadata.type || 'text';
  input.maxLength = 120;
  if (metadata.min !== undefined) input.min = String(metadata.min);
  if (metadata.required !== false) input.required = true;
  input.value = value || '';
  input.dataset.panelExtraText = fieldName;
  input.dataset.extraSection = 'coordenacaoSeletividade';
  input.dataset.extraRecordArray = metadata.recordArray;
  input.dataset.extraRecordIndex = String(metadata.recordIndex);
  input.dataset.seIndex = String(metadata.seIndex);
  input.dataset.panelIndex = String(metadata.panelIndex);
  input.id = `se-${metadata.seIndex}-panel-${metadata.panelIndex}-${metadata.recordArray}-${metadata.recordIndex}-${fieldName}`;
  label.htmlFor = input.id;
  label.textContent = question;
  wrapper.append(label, input);
  container.append(wrapper);
  return input;
}

function addPanelExtraSelect(container, question, fieldName, value, options, metadata) {
  const wrapper = document.createElement('div');
  wrapper.className = 'col-12';
  const label = document.createElement('label');
  label.className = 'form-label';
  const select = document.createElement('select');
  select.className = 'form-select';
  select.required = metadata.required !== false;
  select.dataset.panelExtraField = fieldName;
  select.dataset.extraSection = 'coordenacaoSeletividade';
  select.dataset.extraRecordArray = metadata.recordArray;
  select.dataset.extraRecordIndex = String(metadata.recordIndex);
  select.dataset.seIndex = String(metadata.seIndex);
  select.dataset.panelIndex = String(metadata.panelIndex);
  select.id = `se-${metadata.seIndex}-panel-${metadata.panelIndex}-${metadata.recordArray}-${metadata.recordIndex}-${fieldName}`;
  label.htmlFor = select.id;
  label.textContent = question;
  options.forEach(option => {
    const element = document.createElement('option');
    element.value = option.value;
    element.textContent = option.label;
    select.append(element);
  });
  select.value = value || '';
  wrapper.append(label, select);
  container.append(wrapper);
  return select;
}

function addPanelExtraCount(container, labelText, sectionName, countField, arrayField, count, metadata) {
  const wrapper = document.createElement('div');
  wrapper.className = 'col-12';
  const label = document.createElement('label');
  label.className = 'form-label';
  const input = document.createElement('input');
  input.className = 'form-control';
  input.type = 'number';
  input.min = '0';
  input.max = String(MAX_PROTECTION_DEVICES_PER_PANEL);
  input.step = '1';
  input.value = String(count);
  input.id = `se-${metadata.seIndex}-panel-${metadata.panelIndex}-${countField}`;
  input.dataset.panelExtraCount = countField;
  input.dataset.extraSection = sectionName;
  input.dataset.extraArray = arrayField;
  input.dataset.seIndex = String(metadata.seIndex);
  input.dataset.panelIndex = String(metadata.panelIndex);
  label.htmlFor = input.id;
  label.textContent = labelText;
  if (metadata.helpModalId) {
    const labelRow = document.createElement('div');
    labelRow.className = 'd-flex align-items-center gap-2';
    labelRow.append(label, createInlineTipButton(metadata.helpModalId, metadata.helpLabel || `Dica: ${labelText}`));
    wrapper.append(labelRow, input);
  } else {
    wrapper.append(label, input);
  }
  container.append(wrapper);
}

function addPanelDynamicPhoto(container, title, dataPath, photos, metadata) {
  addPhotoField(container, title, 'panelDynamic', 'dynamic', photos, {
    ...metadata,
    photoPath: dataPath
  });
}

function renderPanelColumnPhotos(card, data, seIndex, panelIndex) {
  const container = card.querySelector('.column-photo-fields');
  releasePhotoUrls(container);
  container.replaceChildren();
  if (data.configuracaoColunas !== 'diversas_colunas') return;
  data.fotos.fotos_colunas.forEach((photos, index) => {
    addPanelDynamicPhoto(container, `Foto da Coluna ${index + 1}`,
      `fotos.fotos_colunas.${index}`, photos, {
        seIndex,
        panelIndex,
        buttonLabel: `Tirar foto da Coluna ${index + 1}`,
        photoFieldClass: 'col-12'
      });
  });
}

function renderFinalObservationFields(container, state, context) {
  container.replaceChildren();
  [
    ['informacoesColetadas', 'Foi possível coletar todas as informações solicitadas acima?'],
    ['possuiObservacaoAdicional', 'Tem alguma observação adicional?']
  ].forEach(([field, question]) => {
    const fieldset = createFieldset(question);
    ['sim', 'nao'].forEach((value, answerIndex) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'form-check form-check-inline';
      const input = document.createElement('input');
      input.className = 'form-check-input';
      input.type = 'radio';
      input.name = `${context.owner}-final-${context.seIndex}-${context.panelIndex ?? ''}-${field}`;
      input.id = `${input.name}-${answerIndex}`;
      input.value = value;
      input.checked = state[field] === value;
      input.required = true;
      input.dataset.finalObservationField = field;
      input.dataset.finalOwner = context.owner;
      input.dataset.seIndex = String(context.seIndex);
      if (context.panelIndex !== undefined) input.dataset.panelIndex = String(context.panelIndex);
      const label = document.createElement('label');
      label.className = 'form-check-label';
      label.htmlFor = input.id;
      label.textContent = value === 'sim' ? 'Sim' : 'Não';
      wrapper.append(input, label);
      fieldset.append(wrapper);
    });
    container.append(fieldset);

    const isMissingInfo = field === 'informacoesColetadas';
    const details = document.createElement('div');
    details.className = isMissingInfo ? 'missing-info-field' : 'additional-observation-field';
    details.hidden = isMissingInfo
      ? state.informacoesColetadas !== 'nao'
      : state.possuiObservacaoAdicional !== 'sim';
    const label = document.createElement('label');
    label.className = 'form-label';
    label.htmlFor = `${context.owner}-final-${context.seIndex}-${context.panelIndex ?? ''}-${isMissingInfo ? 'reason' : 'observation'}`;
    label.textContent = isMissingInfo
      ? 'Informe qual informação não foi coletada e o porquê não foi possível.'
      : 'Informe a observação adicional.';
    const textarea = document.createElement('textarea');
    textarea.className = 'form-control';
    textarea.id = label.htmlFor;
    textarea.rows = '3';
    textarea.maxLength = 2000;
    textarea.required = true;
    textarea.value = state[isMissingInfo ? 'justificativaInformacoesNaoColetadas' : 'observacaoAdicional'] || '';
    textarea.dataset.finalObservationField = isMissingInfo
      ? 'justificativaInformacoesNaoColetadas'
      : 'observacaoAdicional';
    textarea.dataset.finalOwner = context.owner;
    textarea.dataset.seIndex = String(context.seIndex);
    if (context.panelIndex !== undefined) textarea.dataset.panelIndex = String(context.panelIndex);
    details.append(label, textarea);
    if (field === 'possuiObservacaoAdicional' && context.owner === 'panel') {
      const photoContainer = document.createElement('div');
      photoContainer.className = 'final-observation-photo mt-2';
      photoContainer.hidden = state.possuiObservacaoAdicional !== 'sim';
      details.append(photoContainer);
      addPanelDynamicPhoto(photoContainer, 'Foto opcional vinculada à observação do painel',
        'fotos.foto_observacao_painel', context.panelData.fotos.foto_observacao_painel, {
          seIndex: context.seIndex,
          panelIndex: context.panelIndex,
          buttonLabel: 'Adicionar foto opcional da observação',
          photoFieldClass: 'col-12'
        });
    }
    container.append(details);
  });

  if (context.owner === 'se') {
    const photoContainer = document.createElement('div');
    photoContainer.className = 'final-observation-photo mt-2';
    photoContainer.hidden = state.possuiObservacaoAdicional !== 'sim';
    container.append(photoContainer);
    addPhotoField(photoContainer, 'Foto opcional vinculada à observação da SE',
      'substation', 'foto_observacao_se', context.substation.foto_observacao_se, {
        seIndex: context.seIndex,
        buttonLabel: 'Adicionar foto opcional da observação',
        photoFieldClass: 'col-12'
      });
  }
}

function renderCompartmentBlock(container, incident, name, seIndex, panelIndex, singleColumn = false) {
  const compartment = incident.compartimentos[name];
  const block = document.createElement('section');
  block.className = 'compartment-block col-12 border rounded p-3 row g-3 mt-2';
  const heading = document.createElement('div');
  heading.className = 'col-12 d-flex align-items-center flex-wrap gap-2';
  const title = document.createElement('h6');
  title.className = 'form-section-title mb-0';
  title.textContent = singleColumn
    ? 'Dimensões globais do painel'
    : name === 'entrada' ? 'Compartimento de Entrada' : 'Menor Compartimento (gaveta)';
  heading.append(title);
  if (singleColumn) {
    heading.append(createInlineTipButton('modalDicaUnico', 'Como medir o compartimento único?'));
  } else {
    heading.append(createInlineTipButton(
      name === 'entrada' ? 'modalDicaEntrada' : 'modalDicaMenor',
      `Como medir o compartimento ${name === 'entrada' ? 'de entrada' : 'menor'}?`
    ));
  }
  block.append(heading);
  ['altura', 'largura', 'profundidade'].forEach(dimension => {
    const wrapper = document.createElement('div');
    wrapper.className = 'col-md-4';
    const label = document.createElement('label');
    label.className = 'form-label';
    label.htmlFor = `se-${seIndex}-panel-${panelIndex}-${name}-${dimension}`;
    label.textContent = `${dimension.charAt(0).toUpperCase() + dimension.slice(1)} (mm)`;
    const input = document.createElement('input');
    input.className = 'form-control';
    input.type = 'text';
    input.value = compartment[dimension];
    input.id = label.htmlFor;
    input.dataset.compartment = name;
    input.dataset.compartmentField = dimension;
    input.dataset.seIndex = String(seIndex);
    input.dataset.panelIndex = String(panelIndex);
    wrapper.append(label, input);
    block.append(wrapper);
  });
  addPanelDynamicPhoto(block, singleColumn ? 'Foto do painel'
    : `Foto do ${name === 'entrada' ? 'Compartimento de Entrada' : 'Menor Compartimento'}`,
    `energiaIncidente.compartimentos.${name}.fotos`, compartment.fotos, { seIndex, panelIndex });
  addPanelExtraRadio(block, 'O disjuntor é extraível?', 'energiaIncidente',
    'disjuntorExtraivel', compartment.disjuntorExtraivel, [
      { value: 'sim', label: 'Sim' },
      { value: 'nao', label: 'Não' },
      { value: 'nao_identificado', label: 'Não identificado' }
    ], { seIndex, panelIndex, recordArray: 'compartimentos', recordIndex: name, required: true });
  block.dataset.compartmentName = name;
  container.append(block);
}

function renderPanelConfigurationFields(card, data, seIndex, panelIndex) {
  const container = card.querySelector('.panel-configuration-fields');
  releasePhotoUrls(container);
  container.replaceChildren();
  const fieldset = createFieldset('O painel tem apenas uma coluna ou possui várias?');
  [
    { value: 'coluna_unica', label: 'Coluna única' },
    { value: 'diversas_colunas', label: 'Diversas Colunas' }
  ].forEach((option, index) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'form-check form-check-inline';
    const input = document.createElement('input');
    input.className = 'form-check-input';
    input.type = 'radio';
    input.name = `se-${seIndex}-panel-${panelIndex}-configuracao-colunas`;
    input.id = `${input.name}-${index}`;
    input.value = option.value;
    input.checked = data.configuracaoColunas === option.value;
    input.required = true;
    input.dataset.panelField = 'configuracaoColunas';
    input.dataset.seIndex = String(seIndex);
    input.dataset.panelIndex = String(panelIndex);
    const label = document.createElement('label');
    label.className = 'form-check-label';
    label.htmlFor = input.id;
    label.textContent = option.label;
    wrapper.append(input, label);
    fieldset.append(wrapper);
  });
  container.append(fieldset);

  if (data.configuracaoColunas === 'diversas_colunas') {
    const wrapper = document.createElement('div');
    wrapper.className = 'col-md-4 mt-2';
    const label = document.createElement('label');
    label.className = 'form-label';
    label.htmlFor = `se-${seIndex}-panel-${panelIndex}-column-count`;
    label.textContent = 'Quantidade de colunas';
    const input = document.createElement('input');
    input.className = 'form-control';
    input.type = 'number';
    input.min = '2';
    input.max = String(MAX_PANEL_COLUMNS);
    input.step = '1';
    input.value = String(data.quantidadeColunas);
    input.required = true;
    input.id = label.htmlFor;
    input.dataset.panelField = 'quantidadeColunas';
    input.dataset.seIndex = String(seIndex);
    input.dataset.panelIndex = String(panelIndex);
    wrapper.append(label, input);
    container.append(wrapper);
  }

}

function renderCableInformation(container, short, seIndex, panelIndex) {
  const cableRecords = short.cabos.length
    ? short.cabos
    : [{ finalidade: '', distancia: '', bitola: '', quantidadePorFase: '' }];
  const list = document.createElement('div');
  list.className = 'cable-list';
  cableRecords.forEach((cable, index) => {
    const block = document.createElement('div');
    block.className = 'row g-3 border rounded p-3 mx-0 mt-2 cable-item';
    [
      ['finalidade', 'Entrada e/ou Saída', 'Descreva se é entrada, saída ou ambos'],
      ['distancia', 'Distância', 'Ex.: 45 m'],
      ['bitola', 'Bitola', 'Ex.: 3 x 240 mm²'],
      ['quantidadePorFase', 'Quantidade por fase', 'Ex.: 2']
    ].forEach(([field, labelText, placeholder]) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'col-md-3';
      const label = document.createElement('label');
      label.className = 'form-label';
      label.htmlFor = `se-${seIndex}-panel-${panelIndex}-cable-${index}-${field}`;
      label.textContent = labelText;
      const input = document.createElement('input');
      input.className = 'form-control';
      input.type = 'text';
      input.id = label.htmlFor;
      input.value = cable[field] || '';
      input.placeholder = placeholder;
      input.dataset.cableField = field;
      input.dataset.cableIndex = String(index);
      input.dataset.seIndex = String(seIndex);
      input.dataset.panelIndex = String(panelIndex);
      wrapper.append(label, input);
      block.append(wrapper);
    });
    list.append(block);
  });
  container.append(list);
  const addButton = document.createElement('button');
  addButton.className = 'btn btn-sm btn-outline-primary mt-2 add-cable-button';
  addButton.type = 'button';
  addButton.dataset.seIndex = String(seIndex);
  addButton.dataset.panelIndex = String(panelIndex);
  addButton.textContent = '＋ Deseja acrescentar informações de outros cabos?';
  container.append(addButton);
}

function renderMotorFields(container, short, seIndex, panelIndex) {
  container.replaceChildren();
  const countWrapper = document.createElement('div');
  countWrapper.className = 'col-md-4';
  const countLabel = document.createElement('label');
  countLabel.className = 'form-label';
  countLabel.htmlFor = `se-${seIndex}-panel-${panelIndex}-motor-count`;
  countLabel.textContent = 'Quantidade de motores';
  const countInput = document.createElement('input');
  countInput.className = 'form-control';
  countInput.type = 'number';
  countInput.min = '1';
  countInput.max = String(MAX_PROTECTION_DEVICES_PER_PANEL);
  countInput.step = '1';
  countInput.value = String(short.quantidadeMotoresMT);
  countInput.id = countLabel.htmlFor;
  countInput.dataset.motorCount = 'true';
  countInput.dataset.seIndex = String(seIndex);
  countInput.dataset.panelIndex = String(panelIndex);
  countWrapper.append(countLabel, countInput);
  container.append(countWrapper);

  short.motores.forEach((motor, index) => {
    const block = document.createElement('div');
    block.className = 'row g-3 border rounded p-3 mx-0 mt-2 motor-item';
    const nameWrapper = document.createElement('div');
    nameWrapper.className = 'col-12';
    const nameLabel = document.createElement('label');
    nameLabel.className = 'form-label';
    nameLabel.htmlFor = `se-${seIndex}-panel-${panelIndex}-motor-${index}-name`;
    nameLabel.textContent = `Nome/TAG do motor ${index + 1}`;
    const nameInput = document.createElement('input');
    nameInput.className = 'form-control';
    nameInput.type = 'text';
    nameInput.maxLength = 120;
    nameInput.value = motor.nome;
    nameInput.id = nameLabel.htmlFor;
    nameInput.dataset.motorField = 'nome';
    nameInput.dataset.motorIndex = String(index);
    nameInput.dataset.seIndex = String(seIndex);
    nameInput.dataset.panelIndex = String(panelIndex);
    nameWrapper.append(nameLabel, nameInput);
    block.append(nameWrapper);

    const accessField = createFieldset(`A placa do motor${motor.nome ? ` ${motor.nome}` : ''} é acessível?`);
    ['sim', 'nao'].forEach((value, answerIndex) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'form-check form-check-inline';
      const input = document.createElement('input');
      input.className = 'form-check-input';
      input.type = 'radio';
      input.name = `se-${seIndex}-panel-${panelIndex}-motor-${index}-plate-access`;
      input.id = `${input.name}-${answerIndex}`;
      input.value = value;
      input.checked = motor.placaAcessivel === value;
      input.dataset.motorField = 'placaAcessivel';
      input.dataset.motorIndex = String(index);
      input.dataset.seIndex = String(seIndex);
      input.dataset.panelIndex = String(panelIndex);
      const label = document.createElement('label');
      label.className = 'form-check-label';
      label.htmlFor = input.id;
      label.textContent = value === 'sim' ? 'Sim' : 'Não';
      wrapper.append(input, label);
      accessField.append(wrapper);
    });
    block.append(accessField);

    const photoField = document.createElement('div');
    photoField.className = 'motor-plate-photo-field col-12';
    photoField.hidden = motor.placaAcessivel !== 'sim';
    addPanelDynamicPhoto(photoField, `Foto da placa do motor ${motor.nome || index + 1}`,
      `curtoCircuito.motores.${index}.fotos`, motor.fotos, {
        seIndex,
        panelIndex,
        buttonLabel: 'Tirar foto da placa do motor'
      });
    block.append(photoField);
    container.append(block);
  });
}

function renderCoordinationFields(card, data, seIndex, panelIndex) {
  const container = card.querySelector('.coordination-fields');
  const coordination = data.coordenacaoSeletividade;
  releasePhotoUrls(container);
  container.replaceChildren();
  const base = document.createElement('div');
  base.className = 'coordination-base-fields';
  addPanelExtraCount(base, 'Quantidade de Relés de Proteção?', 'coordenacaoSeletividade',
    'quantidadeRelesProtecao', 'relesProtecao', coordination.relesProtecao.length, { seIndex, panelIndex });
  coordination.relesProtecao.forEach((relay, index) => {
    const item = document.createElement('div');
    item.className = 'row g-3 border rounded p-3 mx-0 mt-3';
    const heading = document.createElement('h6');
    heading.className = 'form-section-title col-12 mb-0';
    heading.textContent = `Dados do Relé ${index + 1}`;
    item.append(heading);
    addPanelExtraText(item, 'Qual o número do cubículo o relé está instalado?', 'cubiculo',
      relay.cubiculo, {
        seIndex, panelIndex, recordArray: 'relesProtecao', recordIndex: index,
        type: 'number', min: 0
      });
    const relayFeed = addPanelExtraSelect(item, 'O relé está instalado na Entrada ou em um Alimentador?',
      'alimentacao', relay.alimentacao, [
        { value: '', label: 'Selecione...' },
        { value: 'Entrada', label: 'Entrada' },
        { value: 'Alimentador', label: 'Alimentador' }
      ], { seIndex, panelIndex, recordArray: 'relesProtecao', recordIndex: index });
    const relayCircuit = addPanelExtraText(item, 'Qual equipamento/circuito este relé faz a proteção?',
      'equipamentoProtegido', relay.equipamentoProtegido, {
        seIndex, panelIndex, recordArray: 'relesProtecao', recordIndex: index,
        required: relay.alimentacao === 'Alimentador'
      });
    relayCircuit.parentElement.classList.add('protected-device-field');
    relayCircuit.parentElement.dataset.protectedArray = 'relesProtecao';
    relayCircuit.parentElement.dataset.protectedIndex = String(index);
    relayCircuit.parentElement.dataset.feedType = relayFeed.value;
    addPanelExtraRadio(item, 'Foi possível obter o backup do relé?', 'coordenacaoSeletividade',
      'backupObtido', relay.backupObtido, [
        { value: 'sim', label: 'Sim' },
        { value: 'nao', label: 'Não' }
      ], { seIndex, panelIndex, recordArray: 'relesProtecao', recordIndex: index, required: true });
    const path = `coordenacaoSeletividade.relesProtecao.${index}.fotosModeloOrderCode`;
    const relayPhoto = document.createElement('div');
    relayPhoto.className = 'relay-model-photo col-12';
    relayPhoto.dataset.relayModelPhotoIndex = String(index);
    relayPhoto.hidden = relay.backupObtido !== 'nao';
    addPanelDynamicPhoto(relayPhoto, `Relé de proteção ${index + 1} — modelo e order code`, path,
      relay.fotosModeloOrderCode, {
        seIndex,
        panelIndex,
        helpModalId: 'modalDicaRele',
        helpLabel: 'Dica sobre modelo e Order Code do relé'
      });
    item.append(relayPhoto);
    base.append(item);
  });

  addPanelExtraCount(base, 'Quantidade de disjuntores com disparador LSIG?', 'coordenacaoSeletividade',
    'quantidadeDisjuntoresLSIG', 'disjuntoresLSIG', coordination.disjuntoresLSIG.length, {
      seIndex,
      panelIndex,
      helpModalId: 'modalDicaLSIG',
      helpLabel: 'Dica sobre disjuntores com disparador LSIG'
    });
  coordination.disjuntoresLSIG.forEach((breaker, index) => {
    const item = document.createElement('div');
    item.className = 'row g-3 border rounded p-3 mx-0 mt-3';
    addPanelDynamicPhoto(item, `Disjuntor LSIG ${index + 1} — ajustes`,
      `coordenacaoSeletividade.disjuntoresLSIG.${index}.fotosAjustes`, breaker.fotosAjustes,
      { seIndex, panelIndex });
    addPanelExtraText(item, 'Qual o número do cubículo o disjuntor LSIG está instalado?', 'cubiculo',
      breaker.cubiculo, {
        seIndex, panelIndex, recordArray: 'disjuntoresLSIG', recordIndex: index,
        type: 'number', min: 0
      });
    const breakerFeed = addPanelExtraSelect(item,
      'O disjuntor LSIG está instalado na Entrada ou em um Alimentador?',
      'alimentacao', breaker.alimentacao, [
        { value: '', label: 'Selecione...' },
        { value: 'Entrada', label: 'Entrada' },
        { value: 'Alimentador', label: 'Alimentador' }
      ], { seIndex, panelIndex, recordArray: 'disjuntoresLSIG', recordIndex: index });
    const breakerCircuit = addPanelExtraText(item, 'Qual equipamento/circuito este disjuntor LSIG faz a proteção?',
      'equipamentoProtegido', breaker.equipamentoProtegido, {
        seIndex, panelIndex, recordArray: 'disjuntoresLSIG', recordIndex: index,
        required: breaker.alimentacao === 'Alimentador'
      });
    breakerCircuit.parentElement.classList.add('protected-device-field');
    breakerCircuit.parentElement.dataset.protectedArray = 'disjuntoresLSIG';
    breakerCircuit.parentElement.dataset.protectedIndex = String(index);
    breakerCircuit.parentElement.dataset.feedType = breakerFeed.value;
    base.append(item);
  });

  container.append(base);

  const intelligentScope = hasAdditionalScope('Ajustes dos Relés Inteligentes');
  const intelligent = document.createElement('div');
  intelligent.className = 'intelligent-relay-fields mt-3';
  intelligent.hidden = !intelligentScope;
  if (intelligentScope) {
    const heading = document.createElement('h6');
    heading.className = 'form-section-title';
    heading.textContent = 'Ajustes dos Relés Inteligentes';
    intelligent.append(heading);
    addPanelExtraRadio(intelligent, 'O painel possui relés inteligentes?', 'coordenacaoSeletividade',
      'possuiRelesInteligentes', coordination.possuiRelesInteligentes, [
        { value: 'sim', label: 'Sim' },
        { value: 'nao', label: 'Não' }
      ], { seIndex, panelIndex });
    const relayList = document.createElement('div');
    relayList.className = 'intelligent-relay-list mt-2';
    relayList.hidden = coordination.possuiRelesInteligentes !== 'sim';
    addPanelExtraCount(relayList, 'Quantidade de relés inteligentes?', 'coordenacaoSeletividade',
      'quantidadeRelesInteligentes', 'relesInteligentes', coordination.relesInteligentes.length,
      { seIndex, panelIndex });
    coordination.relesInteligentes.forEach((relay, index) => {
      const item = document.createElement('div');
      item.className = 'row g-3 border rounded p-3 mx-0 mt-3';
      addPanelDynamicPhoto(item, `Relé inteligente ${index + 1} — modelo`,
        `coordenacaoSeletividade.relesInteligentes.${index}.fotosModelo`, relay.fotosModelo,
        { seIndex, panelIndex });
      addPanelExtraRadio(item, 'Foi possível obter o arquivo do relé?', 'coordenacaoSeletividade',
        'arquivoObtido', relay.arquivoObtido, [
          { value: 'sim', label: 'Sim' },
          { value: 'nao', label: 'Não' }
        ], { seIndex, panelIndex, recordArray: 'relesInteligentes', recordIndex: index, required: true });
      relayList.append(item);
    });
    intelligent.append(relayList);
  }
  container.append(intelligent);

  const lowVoltageScope = hasAdditionalScope('Painéis de baixa tensão (QD/QDL/QL)');
  const lowVoltage = document.createElement('div');
  lowVoltage.className = 'low-voltage-protection-fields mt-3';
  lowVoltage.hidden = !lowVoltageScope || !isLowVoltagePanel(data.tipo);
  if (lowVoltageScope) {
    const heading = document.createElement('h6');
    heading.className = 'form-section-title';
    heading.textContent = 'Painéis de baixa tensão (QD/QDL/QL)';
    lowVoltage.append(heading);
    addPanelDynamicPhoto(lowVoltage, 'Fotos dos dispositivos de proteção que o painel possui',
      'coordenacaoSeletividade.fotosDispositivosProtecaoBT',
      coordination.fotosDispositivosProtecaoBT, { seIndex, panelIndex });
  }
  container.append(lowVoltage);
}

function renderIncidentEnergyFields(card, data, seIndex, panelIndex) {
  const container = card.querySelector('.incident-energy-fields');
  const incident = data.energiaIncidente;
  releasePhotoUrls(container);
  container.replaceChildren();
  addPanelExtraRadio(container, 'O painel possui relé de arco?', 'energiaIncidente',
    'possuiReleArco', incident.possuiReleArco, [
      { value: 'sim', label: 'Sim' },
      { value: 'nao', label: 'Não' }
    ], { seIndex, panelIndex });
  const arc = document.createElement('div');
  arc.className = 'arc-relay-fields row g-3 mt-1';
  arc.hidden = incident.possuiReleArco !== 'sim';
  addPanelExtraRadio(arc, 'É possível realizar um backup do arquivo do relé de arco?', 'energiaIncidente',
    'backupReleArcoPossivel', incident.backupReleArcoPossivel, [
      { value: 'sim', label: 'Sim' },
      { value: 'nao', label: 'Não' }
    ], { seIndex, panelIndex, required: true });
  const settingsPhoto = document.createElement('div');
  settingsPhoto.className = 'arc-settings-photo col-12';
  settingsPhoto.hidden = incident.backupReleArcoPossivel !== 'nao';
  addPanelDynamicPhoto(settingsPhoto, 'Foto dos ajustes implantados do relé de arco',
    'energiaIncidente.fotosReleArco', incident.fotosReleArco, { seIndex, panelIndex });
  arc.append(settingsPhoto);
  addPanelExtraRadio(arc, 'O relé de arco envia trip a montante (transfer trip)?', 'energiaIncidente',
    'releArcoTrip', incident.releArcoTrip, [
      { value: 'sim', label: 'Sim' },
      { value: 'nao', label: 'Não' },
      { value: 'nao_identificado', label: 'Não foi possível identificar' }
    ], { seIndex, panelIndex, required: true });
  container.append(arc);
  const compartmentNames = data.configuracaoColunas === 'coluna_unica' ? ['entrada']
    : data.configuracaoColunas === 'diversas_colunas' ? ['entrada', 'menor'] : [];
  compartmentNames.forEach(name => renderCompartmentBlock(container, incident, name,
    seIndex, panelIndex, data.configuracaoColunas === 'coluna_unica'));
}

function renderPanelModules(card, data, seIndex, panelIndex) {
  renderCoordinationFields(card, data, seIndex, panelIndex);
  renderIncidentEnergyFields(card, data, seIndex, panelIndex);
  const short = data.curtoCircuito;
  const otherBreakers = card.querySelector('.other-breaker-fields');
  otherBreakers.replaceChildren();
  addPanelExtraRadio(otherBreakers,
    'Deseja adicionar alguma informação adicional sobre outros disjuntores?',
    'curtoCircuito', 'possuiInformacaoAdicionalDisjuntores',
    short.possuiInformacaoAdicionalDisjuntores, [
      { value: 'sim', label: 'Sim' },
      { value: 'nao', label: 'Não' }
    ], { seIndex, panelIndex });
  const otherBreakerDetails = document.createElement('div');
  otherBreakerDetails.className = 'other-breaker-details row g-3 mt-1';
  otherBreakerDetails.hidden = short.possuiInformacaoAdicionalDisjuntores !== 'sim';
  const textWrap = document.createElement('div');
  textWrap.className = 'col-12';
  const textLabel = document.createElement('label');
  textLabel.className = 'form-label';
  textLabel.htmlFor = `se-${seIndex}-panel-${panelIndex}-other-breaker-info`;
  textLabel.textContent = 'Informações adicionais sobre outros disjuntores';
  const textInput = document.createElement('textarea');
  textInput.className = 'form-control';
  textInput.rows = '3';
  textInput.maxLength = 2000;
  textInput.id = textLabel.htmlFor;
  textInput.value = short.informacaoAdicionalDisjuntores;
  textInput.dataset.shortField = 'informacaoAdicionalDisjuntores';
  textInput.dataset.seIndex = String(seIndex);
  textInput.dataset.panelIndex = String(panelIndex);
  textWrap.append(textLabel, textInput);
  otherBreakerDetails.append(textWrap);
  addPanelDynamicPhoto(otherBreakerDetails, 'Foto opcional sobre outros disjuntores',
    'curtoCircuito.fotosInformacaoAdicionalDisjuntores',
    short.fotosInformacaoAdicionalDisjuntores, { seIndex, panelIndex });
  otherBreakers.append(otherBreakerDetails);

  const cableFields = card.querySelector('.cable-information-fields');
  cableFields.replaceChildren();
  cableFields.append(createFieldset('Informações dos cabos'));
  renderCableInformation(cableFields, short, seIndex, panelIndex);
  renderMotorFields(card.querySelector('.motor-fields'), short, seIndex, panelIndex);
}

function renderSubstations() {
  const expandedSections = new Map(
    Array.from(substationList.querySelectorAll('.substation-collapse, .panel-collapse, .module-collapse'), section => [
      section.id,
      section.classList.contains('show')
    ])
  );
  releasePhotoUrls(substationList);
  substationList.replaceChildren();
  document.getElementById('quantidade-ses').value = currentSurvey.subestacoes.length;
  currentSurvey.subestacoes.forEach((substation, seIndex) => {
    const fragment = SUBSTATION_TEMPLATE.content.cloneNode(true);
    const card = fragment.querySelector('.substation-card');
    card.dataset.seIndex = String(seIndex);
    card.querySelector('.substation-title').textContent = substation.nome || `SE ${String(seIndex + 1).padStart(2, '0')}`;
    const substationCollapse = card.querySelector('.substation-collapse');
    const substationCollapseId = `se-collapse-${seIndex}`;
    substationCollapse.id = substationCollapseId;
    substationCollapse.classList.toggle('show', expandedSections.get(substationCollapseId) ?? true);
    card.querySelectorAll('[data-bs-toggle="collapse"]').forEach(toggle => {
      toggle.setAttribute('data-bs-target', `#${substationCollapseId}`);
      toggle.setAttribute('aria-controls', substationCollapseId);
      toggle.setAttribute('aria-expanded', String(substationCollapse.classList.contains('show')));
      if (toggle.classList.contains('collapse-label')) {
        toggle.textContent = substationCollapse.classList.contains('show') ? 'Minimizar' : 'Maximizar';
      }
    });

    const name = card.querySelector('.se-name-input');
    name.id = `se-${seIndex}-name`;
    name.value = substation.nome;
    name.dataset.seIndex = String(seIndex);
    card.querySelector('.se-name-label').htmlFor = name.id;
    card.querySelectorAll('.same-bus-input').forEach((input, index) => {
      input.name = `se-${seIndex}-mesmo-barramento`;
      input.id = `${input.name}-${index}`;
      input.checked = input.value === substation.podeAlimentarMesmoBarramento;
      input.dataset.seIndex = String(seIndex);
      input.nextElementSibling.htmlFor = input.id;
    });
    card.querySelector('.operation-modes').hidden = substation.podeAlimentarMesmoBarramento !== 'sim';
    card.querySelectorAll('.se-mode-input').forEach((input, index) => {
      input.name = `se-${seIndex}-modo-operacao`;
      input.id = `${input.name}-${index}`;
      input.checked = substation.modoOperacaoTrafos.includes(input.value);
      input.dataset.seIndex = String(seIndex);
      input.dataset.modeOption = input.value;
      input.nextElementSibling.htmlFor = input.id;
    });
    card.querySelectorAll('.equipment-answer').forEach((input, index) => {
      input.name = `se-${seIndex}-demais-equipamentos`;
      input.id = `${input.name}-${index}`;
      input.checked = input.value === substation.possuiDemaisEquipamentos;
      input.dataset.seIndex = String(seIndex);
      input.nextElementSibling.htmlFor = input.id;
    });

    const transformerCount = card.querySelector('.transformer-count-input');
    transformerCount.id = `se-${seIndex}-transformer-count`;
    transformerCount.value = substation.transformadores.length;
    transformerCount.dataset.seIndex = String(seIndex);
    card.querySelector('.transformer-count-label').htmlFor = transformerCount.id;
    card.querySelector('.same-bus-field').hidden = substation.transformadores.length <= 1;
    card.querySelector('.operation-modes').hidden =
      substation.transformadores.length <= 1 || substation.podeAlimentarMesmoBarramento !== 'sim';
    const transformerList = card.querySelector('.transformer-list');
    substation.transformadores.forEach((transformer, transformerIndex) => {
      const section = document.createElement('section');
      section.className = 'transformer-item row g-3 mt-2';
      section.dataset.transformerIndex = String(transformerIndex);
      const nameWrap = document.createElement('div');
      nameWrap.className = 'col-12';
      const label = document.createElement('label');
      label.className = 'form-label';
      label.htmlFor = `se-${seIndex}-transformer-${transformerIndex}-name`;
      label.textContent = `Nome do transformador ${transformerIndex + 1}`;
      const input = document.createElement('input');
      input.className = 'form-control';
      input.id = label.htmlFor;
      input.maxLength = 100;
      input.placeholder = 'Ex.: TR-01';
      input.value = transformer.nome;
      input.dataset.seIndex = String(seIndex);
      input.dataset.transformerIndex = String(transformerIndex);
      input.dataset.transformerField = 'nome';
      nameWrap.append(label, input);
      section.append(nameWrap);
      const addTransformerQuestion = (question, fieldName, value) => {
        const fieldset = createFieldset(question);
        ['sim', 'nao'].forEach((answerValue, answerIndex) => {
          const wrapper = document.createElement('div');
          wrapper.className = 'form-check form-check-inline';
          const answer = document.createElement('input');
          answer.className = 'form-check-input';
          answer.type = 'radio';
          answer.name = `se-${seIndex}-transformer-${transformerIndex}-${fieldName}`;
          answer.id = `${answer.name}-${answerIndex}`;
          answer.value = answerValue;
          answer.checked = value === answerValue;
          answer.dataset.seIndex = String(seIndex);
          answer.dataset.transformerIndex = String(transformerIndex);
          answer.dataset.transformerField = fieldName;
          const answerLabel = document.createElement('label');
          answerLabel.className = 'form-check-label';
          answerLabel.htmlFor = answer.id;
          answerLabel.textContent = answerValue === 'sim' ? 'Sim' : 'Não';
          wrapper.append(answer, answerLabel);
          fieldset.append(wrapper);
        });
        section.append(fieldset);
      };
      addTransformerQuestion('A placa do transformador é acessível?', 'placaAcessivel',
        transformer.placaAcessivel);
      const transformerPhotoGrid = document.createElement('div');
      transformerPhotoGrid.className = 'row g-3 transformer-photo';
      addPhotoField(transformerPhotoGrid, `Foto do Trafo ${transformer.nome || transformerIndex + 1}`,
        'transformer', 'transformador', transformer.fotos.transformador, {
          seIndex, transformerIndex, buttonLabel: 'Foto do Trafo'
        });
      section.append(transformerPhotoGrid);
      const transformerPlatePhotoGrid = document.createElement('div');
      transformerPlatePhotoGrid.className = 'row g-3 transformer-plate-photos';
      transformerPlatePhotoGrid.hidden = transformer.placaAcessivel !== 'sim';
      addPhotoField(transformerPlatePhotoGrid, `Foto da Placa ${transformer.nome || transformerIndex + 1}`,
        'transformer', 'placa', transformer.fotos.placa, {
          seIndex, transformerIndex, buttonLabel: 'Foto da Placa'
        });
      section.append(transformerPlatePhotoGrid);
      addTransformerQuestion('O transformador possui aterramento em algum de seus enrolamentos?',
        'possuiAterramentoEnrolamento', transformer.possuiAterramentoEnrolamento);
      const groundingDetails = document.createElement('div');
      groundingDetails.className = 'grounding-details';
      groundingDetails.hidden = transformer.possuiAterramentoEnrolamento !== 'sim';
      const resistorAnswer = createFieldset('O aterramento é por resistor?');
      ['sim', 'nao'].forEach((answerValue, answerIndex) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'form-check form-check-inline';
        const answer = document.createElement('input');
        answer.className = 'form-check-input';
        answer.type = 'radio';
        answer.name = `se-${seIndex}-transformer-${transformerIndex}-aterramento-resistor`;
        answer.id = `${answer.name}-${answerIndex}`;
        answer.value = answerValue;
        answer.checked = transformer.aterramentoPorResistor === answerValue;
        answer.dataset.seIndex = String(seIndex);
        answer.dataset.transformerIndex = String(transformerIndex);
        answer.dataset.transformerField = 'aterramentoPorResistor';
        const answerLabel = document.createElement('label');
        answerLabel.className = 'form-check-label';
        answerLabel.htmlFor = answer.id;
        answerLabel.textContent = answerValue === 'sim' ? 'Sim' : 'Não';
        wrapper.append(answer, answerLabel);
        resistorAnswer.append(wrapper);
      });
      groundingDetails.append(resistorAnswer);
      const resistorDetails = document.createElement('div');
      resistorDetails.className = 'resistor-details';
      resistorDetails.hidden = transformer.aterramentoPorResistor !== 'sim';
      const resistorPlateAnswer = createFieldset('A placa do resistor é acessível?');
      ['sim', 'nao'].forEach((answerValue, answerIndex) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'form-check form-check-inline';
        const answer = document.createElement('input');
        answer.className = 'form-check-input';
        answer.type = 'radio';
        answer.name = `se-${seIndex}-transformer-${transformerIndex}-placa-resistor`;
        answer.id = `${answer.name}-${answerIndex}`;
        answer.value = answerValue;
        answer.checked = transformer.placaResistorAcessivel === answerValue;
        answer.dataset.seIndex = String(seIndex);
        answer.dataset.transformerIndex = String(transformerIndex);
        answer.dataset.transformerField = 'placaResistorAcessivel';
        const answerLabel = document.createElement('label');
        answerLabel.className = 'form-check-label';
        answerLabel.htmlFor = answer.id;
        answerLabel.textContent = answerValue === 'sim' ? 'Sim' : 'Não';
        wrapper.append(answer, answerLabel);
        resistorPlateAnswer.append(wrapper);
      });
      resistorDetails.append(resistorPlateAnswer);
      const resistorPhotoGrid = document.createElement('div');
      resistorPhotoGrid.className = 'row g-3 resistor-plate-photos';
      resistorPhotoGrid.hidden = transformer.placaResistorAcessivel !== 'sim';
      addPhotoField(resistorPhotoGrid, `Placa do resistor do TRAFO ${transformer.nome || transformerIndex + 1}`,
        'transformer', 'resistorPlaca', transformer.fotos.resistorPlaca, {
          seIndex, transformerIndex, buttonLabel: 'Placa do resistor'
        });
      addPhotoField(resistorPhotoGrid, `Painel do resistor do TRAFO ${transformer.nome || transformerIndex + 1}`,
        'transformer', 'resistorPainel', transformer.fotos.resistorPainel, {
          seIndex, transformerIndex, buttonLabel: 'Painel do resistor'
        });
      resistorDetails.append(resistorPhotoGrid);
      groundingDetails.append(resistorDetails);
      section.append(groundingDetails);
      transformerList.append(section);
    });

    const equipmentList = card.querySelector('.equipment-list');
    if (substation.possuiDemaisEquipamentos === 'sim' && substation.demaisEquipamentos.length === 0) {
      substation.demaisEquipamentos.push({ nome: '', fotos: [] });
    }
    equipmentList.hidden = substation.possuiDemaisEquipamentos !== 'sim';
    card.querySelector('.equipment-details').hidden = substation.possuiDemaisEquipamentos !== 'sim';
    card.querySelector('.add-equipment-button').hidden = substation.possuiDemaisEquipamentos !== 'sim';
    substation.demaisEquipamentos.forEach((equipment, equipmentIndex) => {
      const row = document.createElement('div');
      row.className = 'equipment-item row g-3 align-items-start mb-3';
      const nameWrap = document.createElement('div');
      nameWrap.className = 'col-md-5';
      const label = document.createElement('label');
      label.className = 'form-label';
      label.htmlFor = `se-${seIndex}-equipment-${equipmentIndex}-name`;
      label.textContent = `Nome do equipamento ${equipmentIndex + 1}`;
      const input = document.createElement('input');
      input.className = 'form-control';
      input.id = label.htmlFor;
      input.maxLength = 100;
      input.value = equipment.nome;
      input.placeholder = 'Ex.: Inversor INV-01';
      input.required = substation.possuiDemaisEquipamentos === 'sim';
      input.dataset.seIndex = String(seIndex);
      input.dataset.equipmentIndex = String(equipmentIndex);
      input.dataset.equipmentField = 'nome';
      nameWrap.append(label, input);
      row.append(nameWrap);
      addPhotoField(row, `Equipamento ${equipmentIndex + 1}`, 'equipment', 'foto', equipment.fotos, { seIndex, equipmentIndex });
      const removeWrap = document.createElement('div');
      removeWrap.className = 'col-12';
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'btn btn-sm btn-link text-danger px-0';
      remove.textContent = 'Remover equipamento';
      remove.dataset.removeEquipment = String(equipmentIndex);
      remove.dataset.seIndex = String(seIndex);
      removeWrap.append(remove);
      row.append(removeWrap);
      equipmentList.append(row);
    });

    renderFinalObservationFields(card.querySelector('.se-observation-fields'), substation, {
      owner: 'se',
      seIndex,
      substation
    });
    card.querySelector('.remove-se-button').dataset.seIndex = String(seIndex);
    card.querySelector('.add-panel-button').dataset.seIndex = String(seIndex);
    card.querySelector('.save-substation-button').dataset.seIndex = String(seIndex);
    substation.paineis.forEach((panel, panelIndex) => {
      card.querySelector('.panel-list').append(renderPanel(panel, seIndex, panelIndex, expandedSections));
    });
    substationList.append(fragment);
  });
  syncShortCircuitVisibility();
}

function setupPanelModuleCollapse(card, selector, sectionKey, seIndex, panelIndex, expandedSections) {
  const section = card.querySelector(selector);
  section.classList.add('module-card-section');
  const title = section.querySelector('h5');
  const header = document.createElement('div');
  header.className = 'module-section-heading card-header d-flex justify-content-between align-items-center mb-3';
  header.append(title);
  section.classList.add('card');
  const sectionId = `se-${seIndex}-panel-${panelIndex}-module-${sectionKey}`;
  const collapse = document.createElement('div');
  collapse.className = 'collapse show module-collapse';
  collapse.id = sectionId;
  collapse.dataset.panelModule = sectionKey;
  collapse.classList.toggle('show', expandedSections.get(sectionId) ?? true);
  Array.from(section.children).forEach(child => {
    if (child !== header) collapse.append(child);
  });
  const toggle = document.createElement('button');
  toggle.className = 'btn btn-sm btn-outline-secondary module-collapse-label';
  toggle.type = 'button';
  toggle.dataset.bsToggle = 'collapse';
  toggle.dataset.bsTarget = `#${sectionId}`;
  toggle.setAttribute('aria-controls', sectionId);
  toggle.setAttribute('aria-expanded', String(collapse.classList.contains('show')));
  toggle.textContent = collapse.classList.contains('show') ? 'Minimizar' : 'Maximizar';
  header.append(toggle);
  const body = document.createElement('div');
  body.className = 'card-body';
  body.append(collapse);
  section.replaceChildren(header, body);
}

function renderPanel(panel, seIndex, panelIndex, expandedSections) {
  const fragment = PANEL_TEMPLATE.content.cloneNode(true);
  const card = fragment.querySelector('.panel-card');
  const data = panel.dadosPainel;
  card.dataset.seIndex = String(seIndex);
  card.dataset.panelIndex = String(panelIndex);
  const panelCollapse = card.querySelector('.panel-collapse');
  const panelCollapseId = `se-${seIndex}-panel-collapse-${panelIndex}`;
  panelCollapse.id = panelCollapseId;
  panelCollapse.classList.toggle('show', expandedSections.get(panelCollapseId) ?? true);
  card.querySelectorAll('.panel-card-heading [data-bs-toggle="collapse"]').forEach(toggle => {
    toggle.setAttribute('data-bs-target', `#${panelCollapseId}`);
    toggle.setAttribute('aria-controls', panelCollapseId);
    toggle.setAttribute('aria-expanded', String(panelCollapse.classList.contains('show')));
    if (toggle.classList.contains('collapse-label')) {
      toggle.textContent = panelCollapse.classList.contains('show') ? 'Minimizar' : 'Maximizar';
    }
  });
  card.querySelector('.panel-title').textContent = data.nome || `Painel ${String(panelIndex + 1).padStart(2, '0')}`;
  [
    ['.short-circuit-section', 'short-circuit'],
    ['.coordination-section', 'coordination'],
    ['.incident-energy-section', 'incident-energy']
  ].forEach(([selector, key]) => setupPanelModuleCollapse(
    card, selector, key, seIndex, panelIndex, expandedSections
  ));
  card.querySelector('.remove-panel-button').dataset.seIndex = String(seIndex);
  card.querySelector('.remove-panel-button').dataset.panelIndex = String(panelIndex);
  card.querySelector('.save-panel-button').dataset.seIndex = String(seIndex);
  card.querySelector('.save-panel-button').dataset.panelIndex = String(panelIndex);

  const fields = [
    ['.panel-name-input', '.panel-name-label', data.nome, 'name'],
    ['.panel-type-select', '.panel-type-label', data.tipo, 'type'],
    ['.panel-voltage-select', '.panel-voltage-label', data.nivelTensao, 'voltage'],
    ['.other-panel-type-input', '.other-panel-type-label', data.outroTipo, 'other-type'],
    ['.other-voltage-input', '.other-voltage-label', data.outroNivelTensao, 'other-voltage']
  ];
  fields.forEach(([selector, labelSelector, value, suffix]) => {
    const input = card.querySelector(selector);
    input.id = `se-${seIndex}-panel-${panelIndex}-${suffix}`;
    input.value = value ?? '';
    input.dataset.seIndex = String(seIndex);
    input.dataset.panelIndex = String(panelIndex);
    const label = card.querySelector(labelSelector);
    if (label) label.htmlFor = input.id;
  });
  card.querySelector('[data-panel-photo-label="identificacao"]').textContent =
    `＋ Tirar foto de identificação de ${data.nome || 'painel'}`;
  card.querySelector('[data-panel-photo-label="completo"]').textContent =
    `＋ Tirar foto completa de ${data.nome || 'painel'}`;

  card.querySelectorAll('[data-short-field]').forEach((input, index) => {
    const field = input.dataset.shortField;
    input.dataset.seIndex = String(seIndex);
    input.dataset.panelIndex = String(panelIndex);
    if (input.type === 'radio') {
      input.name = radioName('short', seIndex, panelIndex, field);
      input.id = `${input.name}-${index}`;
      input.checked = input.value === data.curtoCircuito[field];
      input.nextElementSibling.htmlFor = input.id;
    } else {
      input.id = `se-${seIndex}-panel-${panelIndex}-short-${field}`;
      if (input.type === 'checkbox') input.checked = Boolean(data.curtoCircuito[field]);
      else input.value = data.curtoCircuito[field] ?? '';
      const label = input.parentElement.querySelector('label');
      if (label) label.htmlFor = input.id;
    }
  });
  card.querySelectorAll('[data-photo-key]').forEach(input => {
    input.dataset.photoOwner = 'panel';
    input.dataset.seIndex = String(seIndex);
    input.dataset.panelIndex = String(panelIndex);
    input.id = `photo-panel-se-${seIndex}-panel-${panelIndex}-${input.dataset.photoKey}`;
    const preview = card.querySelector(`[data-preview-key="${input.dataset.photoKey}"]`);
    renderPhotoPreview(preview, data.fotos[input.dataset.photoKey]);
  });
  renderFinalObservationFields(card.querySelector('.panel-observation-fields'),
    data.observacoesFinais, { owner: 'panel', seIndex, panelIndex, panelData: data });
  renderPanelConfigurationFields(card, data, seIndex, panelIndex);
  renderPanelColumnPhotos(card, data, seIndex, panelIndex);
  card.querySelector('.other-voltage-field').hidden = data.nivelTensao !== 'Outro';
  card.querySelector('.other-panel-type-field').hidden = data.tipo !== 'Outros';
  renderPanelModules(card, data, seIndex, panelIndex);
  updatePanelConditions(card, data);
  return fragment;
}

function updatePanelConditions(card, data) {
  card.querySelector('[data-module-key="short-circuit"]').hidden = !hasShortCircuitScope();
  const mediumVoltage = ['4.16 kV', '6.9 kV', '13.8 kV', '34.5 kV'].includes(data.nivelTensao);
  const motorsEnabled = mediumVoltage && data.curtoCircuito.possuiMotoresMT === 'sim';
  card.querySelector('.medium-voltage-motors').hidden = !mediumVoltage;
  const motorFields = card.querySelector('.motor-fields');
  motorFields.hidden = !motorsEnabled;
  motorFields.querySelector('[data-motor-count]').required = motorsEnabled;
  motorFields.querySelectorAll('[data-motor-field="placaAcessivel"]').forEach(input => {
    input.required = motorsEnabled;
  });
  motorFields.querySelectorAll('.motor-plate-photo-field').forEach((field, index) => {
    field.hidden = !motorsEnabled || data.curtoCircuito.motores[index]?.placaAcessivel !== 'sim';
  });
  card.querySelector('.support-panel-photo-field').hidden =
    data.curtoCircuito.suportabilidadePainelDisponivel !== 'sim';
  card.querySelector('.support-panel-photo-field input[type="file"]').required =
    data.curtoCircuito.suportabilidadePainelDisponivel === 'sim';
  card.querySelector('.support-breaker-photo-field').hidden =
    data.curtoCircuito.suportabilidadeDisjuntorDisponivel !== 'sim';
  card.querySelector('.support-breaker-photo-field input[type="file"]').required =
    data.curtoCircuito.suportabilidadeDisjuntorDisponivel === 'sim';
  card.querySelector('.other-panel-type-field').hidden = data.tipo !== 'Outros';
  card.querySelector('.other-panel-type-input').required = data.tipo === 'Outros';
  const coordinationScope = currentSurvey.obra.escopoServico.includes('Coordenação e Seletividade');
  const intelligentScope = hasAdditionalScope('Ajustes dos Relés Inteligentes');
  const lowVoltageScope = hasAdditionalScope('Painéis de baixa tensão (QD/QDL/QL)') && isLowVoltagePanel(data.tipo);
  card.querySelector('.coordination-section').hidden =
    !coordinationScope && !intelligentScope && !lowVoltageScope;
  card.querySelector('.incident-energy-section').hidden =
    !currentSurvey.obra.escopoServico.includes('Energia Incidente');
  const coordination = data.coordenacaoSeletividade;
  const coordinationBase = card.querySelector('.coordination-base-fields');
  if (coordinationBase) coordinationBase.hidden = !coordinationScope;
  card.querySelector('.coordination-section .module-section-heading > .form-section-title').hidden =
    !coordinationScope;
  card.querySelectorAll('[data-relay-model-photo-index]').forEach(photoField => {
    const relay = coordination.relesProtecao[Number(photoField.dataset.relayModelPhotoIndex)];
    photoField.hidden = relay?.backupObtido !== 'nao';
  });
  const intelligentRelayList = card.querySelector('.intelligent-relay-list');
  if (intelligentRelayList) intelligentRelayList.hidden = coordination.possuiRelesInteligentes !== 'sim';
  const intelligentFields = card.querySelector('.intelligent-relay-fields');
  if (intelligentFields) intelligentFields.hidden = !intelligentScope;
  const lowVoltageFields = card.querySelector('.low-voltage-protection-fields');
  if (lowVoltageFields) {
    lowVoltageFields.hidden = !lowVoltageScope || !isLowVoltagePanel(data.tipo);
  }
  const energy = data.energiaIncidente;
  const arcFields = card.querySelector('.arc-relay-fields');
  if (arcFields) arcFields.hidden = energy.possuiReleArco !== 'sim';
  const settingsPhoto = card.querySelector('.arc-settings-photo');
  if (settingsPhoto) settingsPhoto.hidden = energy.backupReleArcoPossivel !== 'nao';
  const additionalBreakerInfo = card.querySelector('.other-breaker-details');
  if (additionalBreakerInfo) {
    additionalBreakerInfo.hidden = data.curtoCircuito.possuiInformacaoAdicionalDisjuntores !== 'sim';
  }
  card.querySelectorAll('.protected-device-field').forEach(field => {
    const feed = coordination[field.dataset.protectedArray]?.[Number(field.dataset.protectedIndex)]?.alimentacao;
    field.hidden = feed !== 'Alimentador';
    field.querySelector('input').required = feed === 'Alimentador';
  });
}

function hasShortCircuitScope() {
  return currentSurvey.obra.escopoServico.includes('Curto-circuito');
}

function hasAdditionalScope(value) {
  return currentSurvey.obra.outrosItensEscopo.includes(value);
}

function isLowVoltagePanel(type) {
  return ['QD de BT', 'PNL/QDL/QL', 'QD/QDL/QL/PNL'].includes(type);
}

function syncScopeVisibility() {
  document.getElementById('other-scope-field').hidden = !currentSurvey.obra.escopoServico.includes('Outros');
  document.getElementById('scope-feedback').hidden = currentSurvey.obra.escopoServico.length > 0;
  syncShortCircuitVisibility();
}

function syncShortCircuitVisibility() {
  const visible = hasShortCircuitScope();
  substationList.querySelectorAll('.panel-card').forEach(card => {
    updatePanelConditions(card, getPanel(Number(card.dataset.seIndex), Number(card.dataset.panelIndex)).dadosPainel);
    card.querySelector('[data-module-key="short-circuit"]').hidden = !visible;
  });
}

function syncMotorPhotoExport(input) {
  if (!input?.dataset.photoPath?.startsWith('curtoCircuito.motores.')) return;
  const panel = getPanel(Number(input.dataset.seIndex), Number(input.dataset.panelIndex));
  if (panel) {
    panel.dadosPainel.fotos.fotos_placas_motores_mt =
      panel.dadosPainel.curtoCircuito.motores.flatMap(motor => motor.fotos);
  }
}

function getPhotoArray(input) {
  const se = currentSurvey.subestacoes[Number(input.dataset.seIndex)];
  if (!se) return null;
  if (input.dataset.photoOwner === 'panel') {
    return getPanel(Number(input.dataset.seIndex), Number(input.dataset.panelIndex))?.dadosPainel.fotos[input.dataset.photoKey] ?? null;
  }
  if (input.dataset.photoOwner === 'transformer') {
    return se.transformadores[Number(input.dataset.transformerIndex)]?.fotos[input.dataset.photoKey] ?? null;
  }
  if (input.dataset.photoOwner === 'equipment') return se.demaisEquipamentos[Number(input.dataset.equipmentIndex)]?.fotos ?? null;
  if (input.dataset.photoOwner === 'substation') return se.foto_observacao_se;
  if (input.dataset.photoOwner === 'panelDynamic') {
    const panel = getPanel(Number(input.dataset.seIndex), Number(input.dataset.panelIndex));
    if (!panel) return null;
    return input.dataset.photoPath.split('.').reduce((value, key) => value?.[key], panel.dadosPainel);
  }
  return null;
}

function decodeImageFile(blob) {
  if (typeof createImageBitmap === 'function') return createImageBitmap(blob);
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(blob);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível abrir a imagem para a exportação.'));
    };
    image.src = url;
  });
}

async function watermarkPhoto(photo, watermarkContext) {
  const source = photoPayload(photo);
  const image = await decodeImageFile(source.blob);
  const maxDimension = 1920;
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext('2d');
  if (!context) {
    image.close?.();
    throw new Error('Não foi possível preparar a marca d’água no Canvas durante a exportação.');
  }
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close?.();

  const now = new Date();
  const twoDigits = value => String(value).padStart(2, '0');
  const timestamp = `${twoDigits(now.getDate())}/${twoDigits(now.getMonth() + 1)}/${now.getFullYear()} ${twoDigits(now.getHours())}:${twoDigits(now.getMinutes())}`;
  const lines = [
    timestamp,
    watermarkContext.substation,
    watermarkContext.subject,
    watermarkContext.description
  ].filter(Boolean);
  const fontSize = Math.max(14, Math.min(48, Math.round(Math.min(canvas.width, canvas.height) * 0.04)));
  const lineHeight = Math.ceil(fontSize * 1.25);
  const padding = Math.ceil(fontSize * 0.7);
  const right = canvas.width - padding;
  let bottom = canvas.height - padding;
  context.font = `600 ${fontSize}px sans-serif`;
  context.textAlign = 'right';
  context.textBaseline = 'alphabetic';
  context.lineJoin = 'round';
  context.lineWidth = Math.max(2, fontSize * 0.16);
  context.strokeStyle = '#000000';
  context.fillStyle = '#FFFFFF';
  for (const line of [...lines].reverse()) {
    context.strokeText(line, right, bottom, canvas.width - padding * 2);
    context.fillText(line, right, bottom, canvas.width - padding * 2);
    bottom -= lineHeight;
  }
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(result => {
      if (result) resolve(result);
      else reject(new Error(`Não foi possível converter a foto "${source.name || 'sem nome'}" durante a exportação.`));
    }, 'image/jpeg', 0.9);
  });
  if (blob.size > MAX_PHOTO_SIZE) throw new Error(`A foto "${source.name || 'sem nome'}" excede 12 MB após a marca d’água.`);
  return {
    name: source.name.replace(/\.[^.]+$/, '') + '.jpg',
    type: 'image/jpeg',
    blob
  };
}

function readPhotoAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error(`Não foi possível ler a foto "${file.name}".`));
    };
    reader.onerror = () => reject(reader.error || new Error(`Não foi possível ler a foto "${file.name}".`));
    reader.readAsDataURL(file);
  });
}

async function handlePhotoInput(input) {
  const photos = getPhotoArray(input);
  if (!photos) return;
  const preview = input.closest('.photo-field')?.querySelector('.photo-preview');
  if (!preview) {
    showAlert('Não foi possível localizar a pré-visualização da foto.', true);
    return;
  }
  const files = Array.from(input.files || []);
  const valid = files.filter(file => {
    if (!file.type.startsWith('image/')) {
      showAlert(`O arquivo "${file.name}" não é uma imagem.`, true);
      return false;
    }
    if (file.size > MAX_PHOTO_SIZE) {
      showAlert(`A foto "${file.name}" excede o limite de 12 MB.`, true);
      return false;
    }
    return true;
  });
  input.value = '';
  for (const file of valid) {
    try {
      photos.push({
        name: file.name,
        type: file.type,
        blob: await readPhotoAsDataUrl(file)
      });
    } catch (error) {
      console.error(`Não foi possível adicionar a foto "${file.name}".`, error);
      showAlert(error.message || `Não foi possível adicionar a foto "${file.name}".`, true);
    }
  }
  syncMotorPhotoExport(input);
  renderPhotoPreview(preview, photos);
  await persistCurrentSurvey();
}

function scheduleSave() {
  clearTimeout(saveTimer);
  updateSaveStatus('Salvando...');
  saveTimer = setTimeout(() => persistCurrentSurvey(), 350);
}

async function persistCurrentSurvey() {
  if (!database || !currentSurvey) return false;
  clearTimeout(saveTimer);
  currentSurvey.atualizadoEm = new Date().toISOString();
  currentSurvey.obra.quantidadeSEs = currentSurvey.subestacoes.length;
  currentSurvey.subestacoes.forEach(se => {
    se.quantidadePaineis = se.paineis.length;
    se.quantidadeTransformadores = se.transformadores.length;
  });
  try {
    await requestStore('readwrite', store => store.put(currentSurvey));
    updateSaveStatus('Salvo neste dispositivo');
    await reloadSavedSurveys();
    return true;
  } catch (error) {
    console.error('Falha ao salvar o levantamento localmente.', error);
    updateSaveStatus('Falha ao salvar', true);
    showAlert('Não foi possível salvar no dispositivo. Verifique o armazenamento disponível.', true);
    return false;
  }
}

function resizeSubstations(count) {
  const substations = currentSurvey.subestacoes.slice(0, count);
  while (substations.length < count) substations.push(makeSubstation(substations.length));
  return substations;
}

function validateStepOne() {
  const numberInput = document.getElementById('obra-numero');
  const clientInput = document.getElementById('obra-cliente');
  const hasScope = currentSurvey.obra.escopoServico.length > 0;
  numberInput.classList.toggle('is-invalid', !numberInput.value.trim());
  clientInput.classList.toggle('is-invalid', !clientInput.value.trim());
  document.getElementById('scope-feedback').hidden = hasScope;
  if (!numberInput.value.trim() || !clientInput.value.trim() || !hasScope) {
    showAlert('Preencha número e cliente e selecione ao menos um escopo.', true);
    return false;
  }
  return true;
}

function updatePanelField(input) {
  const panel = getPanel(Number(input.dataset.seIndex), Number(input.dataset.panelIndex));
  if (!panel) return;
  const card = input.closest('.panel-card');
  const field = input.dataset.panelField;
  if (field === 'quantidadeColunas') {
    const count = Math.max(2, Math.min(MAX_PANEL_COLUMNS, Math.trunc(Number(input.value) || 2)));
    panel.dadosPainel.quantidadeColunas = count;
    panel.dadosPainel.fotos.fotos_colunas = resizeRecords(
      panel.dadosPainel.fotos.fotos_colunas,
      count,
      () => []
    );
    input.value = String(count);
    renderPanelColumnPhotos(card, panel.dadosPainel,
      Number(input.dataset.seIndex), Number(input.dataset.panelIndex));
  } else if (field === 'configuracaoColunas') {
    panel.dadosPainel.configuracaoColunas = input.value;
    panel.dadosPainel.energiaIncidente.possuiCompartimentoUnico =
      input.value === 'coluna_unica' ? 'sim' : 'nao';
    if (input.value === 'coluna_unica') {
      panel.dadosPainel.quantidadeColunas = 1;
      panel.dadosPainel.fotos.fotos_colunas = [];
    } else {
      panel.dadosPainel.quantidadeColunas = Math.max(2, panel.dadosPainel.quantidadeColunas || 0);
      panel.dadosPainel.fotos.fotos_colunas = resizeRecords(
        panel.dadosPainel.fotos.fotos_colunas,
        panel.dadosPainel.quantidadeColunas,
        () => []
      );
    }
  } else {
    panel.dadosPainel[field] = input.value;
  }
  if (field === 'nome') {
    card.querySelector('.panel-title').textContent = input.value || `Painel ${String(Number(input.dataset.panelIndex) + 1).padStart(2, '0')}`;
    card.querySelector('[data-panel-photo-label="identificacao"]').textContent =
      `＋ Tirar foto de identificação de ${input.value || 'painel'}`;
    card.querySelector('[data-panel-photo-label="completo"]').textContent =
      `＋ Tirar foto completa de ${input.value || 'painel'}`;
  }
  if (field === 'nivelTensao') card.querySelector('.other-voltage-field').hidden = input.value !== 'Outro';
  if (field === 'tipo') card.querySelector('.other-panel-type-field').hidden = input.value !== 'Outros';
  if (field === 'configuracaoColunas' || field === 'quantidadeColunas') {
    renderPanelConfigurationFields(card, panel.dadosPainel,
      Number(input.dataset.seIndex), Number(input.dataset.panelIndex));
    renderPanelColumnPhotos(card, panel.dadosPainel,
      Number(input.dataset.seIndex), Number(input.dataset.panelIndex));
    if (field === 'configuracaoColunas') {
      renderIncidentEnergyFields(card, panel.dadosPainel,
        Number(input.dataset.seIndex), Number(input.dataset.panelIndex));
    }
  }
  updatePanelConditions(card, panel.dadosPainel);
  scheduleSave();
}

function updateShortCircuitField(input) {
  const panel = getPanel(Number(input.dataset.seIndex), Number(input.dataset.panelIndex));
  if (!panel) return;
  const short = panel.dadosPainel.curtoCircuito;
  short[input.dataset.shortField] = input.type === 'checkbox'
    ? input.checked
    : input.value;
  if (input.dataset.shortField === 'possuiMotoresMT' && input.value !== 'sim') {
    short.motores = [];
    short.quantidadeMotoresMT = 0;
    panel.dadosPainel.fotos.fotos_placas_motores_mt = [];
  }
  const card = input.closest('.panel-card');
  if (input.dataset.shortField === 'possuiMotoresMT') {
    renderMotorFields(card.querySelector('.motor-fields'), short,
      Number(input.dataset.seIndex), Number(input.dataset.panelIndex));
  }
  updatePanelConditions(card, panel.dadosPainel);
  scheduleSave();
}

function updateMotorCount(input) {
  const panel = getPanel(Number(input.dataset.seIndex), Number(input.dataset.panelIndex));
  if (!panel) return;
  const short = panel.dadosPainel.curtoCircuito;
  const requested = Math.max(1, Math.min(
    MAX_PROTECTION_DEVICES_PER_PANEL,
    Math.trunc(Number(input.value) || 1)
  ));
  short.motores = resizeRecords(short.motores, requested, () => ({
    nome: '',
    placaAcessivel: null,
    fotos: []
  }));
  short.quantidadeMotoresMT = requested;
  panel.dadosPainel.fotos.fotos_placas_motores_mt = short.motores.flatMap(motor => motor.fotos);
  const card = input.closest('.panel-card');
  renderMotorFields(card.querySelector('.motor-fields'), short,
    Number(input.dataset.seIndex), Number(input.dataset.panelIndex));
  updatePanelConditions(card, panel.dadosPainel);
  scheduleSave();
}

function updateMotorField(input) {
  const panel = getPanel(Number(input.dataset.seIndex), Number(input.dataset.panelIndex));
  const motor = panel?.dadosPainel.curtoCircuito.motores[Number(input.dataset.motorIndex)];
  if (!motor) return;
  motor[input.dataset.motorField] = input.value;
  const item = input.closest('.motor-item');
  if (input.dataset.motorField === 'nome') {
    const label = item.querySelector('.motor-plate-photo-field .form-label');
    if (label) label.textContent = `Foto da placa do motor ${input.value.trim() || Number(input.dataset.motorIndex) + 1}`;
    const button = item.querySelector('.motor-plate-photo-field .photo-button span');
    if (button) button.textContent = `＋ Foto da placa do motor ${input.value.trim() || Number(input.dataset.motorIndex) + 1}`;
  }
  scheduleSave();
}

function updateMotorPlateAccess(input) {
  const panel = getPanel(Number(input.dataset.seIndex), Number(input.dataset.panelIndex));
  const short = panel?.dadosPainel.curtoCircuito;
  const motor = short?.motores[Number(input.dataset.motorIndex)];
  if (!panel || !short || !motor) return;
  motor.placaAcessivel = input.value;
  if (input.value !== 'sim') motor.fotos = [];
  panel.dadosPainel.fotos.fotos_placas_motores_mt = short.motores.flatMap(item => item.fotos);
  const item = input.closest('.motor-item');
  item.querySelector('.motor-plate-photo-field').hidden = input.value !== 'sim';
  renderPhotoPreview(
    item.querySelector('.motor-plate-photo-field .photo-preview'),
    motor.fotos
  );
  scheduleSave();
}

function updatePanelExtraField(input) {
  const panel = getPanel(Number(input.dataset.seIndex), Number(input.dataset.panelIndex));
  if (!panel) return;
  const section = panel.dadosPainel[input.dataset.extraSection];
  const recordArray = input.dataset.extraRecordArray;
  const recordIndex = input.dataset.extraRecordIndex;
  if (recordArray) {
    section[recordArray][recordIndex][input.dataset.panelExtraField] = input.value;
  } else {
    section[input.dataset.panelExtraField] = input.value;
  }
  const card = input.closest('.panel-card');
  if (input.dataset.extraSection === 'energiaIncidente'
      && input.dataset.panelExtraField === 'backupReleArcoPossivel') {
    section.ajustesReleArcoObtidos = input.value;
  } else if (input.dataset.extraSection === 'energiaIncidente'
      && input.dataset.panelExtraField === 'possuiCompartimentoUnico') {
    // Keep the legacy export field synchronized with the panel configuration.
    section.possuiCompartimentoUnico = input.value;
  }
  updatePanelConditions(card, panel.dadosPainel);
  scheduleSave();
}

function updateCableField(input) {
  const panel = getPanel(Number(input.dataset.seIndex), Number(input.dataset.panelIndex));
  if (!panel) return;
  const short = panel.dadosPainel.curtoCircuito;
  const index = Number(input.dataset.cableIndex);
  while (short.cabos.length <= index) {
    short.cabos.push({ finalidade: '', distancia: '', bitola: '', quantidadePorFase: '' });
  }
  short.cabos[index][input.dataset.cableField] = input.value;
  if (index === 0) {
    short.distanciaCabos = short.cabos[0].distancia;
    short.bitolaCabos = short.cabos[0].bitola;
    short.quantidadeCabos = short.cabos[0].quantidadePorFase;
  }
  scheduleSave();
}

function updateFinalObservationField(input) {
  const seIndex = Number(input.dataset.seIndex);
  const substation = currentSurvey.subestacoes[seIndex];
  if (!substation) return;
  const state = input.dataset.finalOwner === 'se'
    ? substation
    : getPanel(seIndex, Number(input.dataset.panelIndex))?.dadosPainel.observacoesFinais;
  if (!state) return;
  state[input.dataset.finalObservationField] = input.value;
  if (input.dataset.finalObservationField === 'observacaoAdicional') {
    if (input.dataset.finalOwner === 'se') substation.observacoes = input.value;
    else getPanel(seIndex, Number(input.dataset.panelIndex)).dadosPainel.observacoes = input.value;
  }
  const container = input.closest(input.dataset.finalOwner === 'se'
    ? '.se-observation-fields'
    : '.panel-observation-fields');
  if (container) {
    const missing = container.querySelector('.missing-info-field');
    const additional = container.querySelector('.additional-observation-field');
    if (missing) missing.hidden = state.informacoesColetadas !== 'nao';
    if (additional) additional.hidden = state.possuiObservacaoAdicional !== 'sim';
    const photo = container.querySelector('.final-observation-photo');
    if (photo) photo.hidden = state.possuiObservacaoAdicional !== 'sim';
  }
  scheduleSave();
}

function updatePanelExtraText(input) {
  const panel = getPanel(Number(input.dataset.seIndex), Number(input.dataset.panelIndex));
  if (!panel) return;
  const section = panel.dadosPainel[input.dataset.extraSection];
  section[input.dataset.extraRecordArray][Number(input.dataset.extraRecordIndex)][input.dataset.panelExtraText] =
    input.value;
  scheduleSave();
}

function updatePanelExtraCount(input) {
  const panel = getPanel(Number(input.dataset.seIndex), Number(input.dataset.panelIndex));
  if (!panel) return;
  const section = panel.dadosPainel[input.dataset.extraSection];
  const requested = Math.max(0, Math.min(MAX_PROTECTION_DEVICES_PER_PANEL, Number(input.value) || 0));
  const factories = {
    relesProtecao: makeProtectionRelay,
    disjuntoresLSIG: makeLsigBreaker,
    relesInteligentes: makeIntelligentRelay
  };
  section[input.dataset.extraArray] = resizeRecords(
    section[input.dataset.extraArray],
    requested,
    factories[input.dataset.extraArray]
  );
  section[input.dataset.panelExtraCount] = requested;
  input.value = String(requested);
  const card = input.closest('.panel-card');
  if (input.dataset.extraSection === 'energiaIncidente') {
    renderIncidentEnergyFields(card, panel.dadosPainel, Number(input.dataset.seIndex), Number(input.dataset.panelIndex));
  } else {
    renderCoordinationFields(card, panel.dadosPainel, Number(input.dataset.seIndex), Number(input.dataset.panelIndex));
  }
  updatePanelConditions(card, panel.dadosPainel);
  scheduleSave();
}

function updateServiceField(input) {
  const field = input.dataset.serviceField;
  if (field === 'quantidadeSEs') {
    const requested = Math.max(1, Math.min(MAX_SES, Number(input.value) || 1));
    currentSurvey.obra.quantidadeSEs = requested;
    currentSurvey.subestacoes = resizeSubstations(requested);
    input.value = String(requested);
    renderSubstations();
  } else {
    currentSurvey.obra[field] = input.value;
    if (field === 'numero') updateWorkHeader();
  }
  scheduleSave();
}

function focusPanelRequirement(seIndex, panelIndex, target, message) {
  const substationCard = substationList.querySelector(`.substation-card[data-se-index="${seIndex}"]`);
  const panelCard = substationCard?.querySelector(`.panel-card[data-panel-index="${panelIndex}"]`);
  if (!substationCard || !panelCard) return false;
  const element = typeof target === 'string' ? panelCard.querySelector(target) : target;
  const moduleCollapse = element?.closest('.module-collapse');
  if (moduleCollapse) {
    window.bootstrap?.Collapse.getOrCreateInstance(moduleCollapse, { toggle: false }).show();
  }
  window.bootstrap?.Collapse.getOrCreateInstance(substationCard.querySelector('.substation-collapse'), { toggle: false }).show();
  window.bootstrap?.Collapse.getOrCreateInstance(panelCard.querySelector('.panel-collapse'), { toggle: false }).show();
  window.setTimeout(() => {
    if (element) element.tabIndex = -1;
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element?.focus?.({ preventScroll: true });
  }, 400);
  showAlert(message, true);
  return false;
}

function validatePanelRequirements({
  seIndex: seIndexFilter = null,
  panelIndex: panelIndexFilter = null,
  validateEquipment = true
} = {}) {
  const scopes = currentSurvey.obra.escopoServico;
  for (const [seIndex, substation] of currentSurvey.subestacoes.entries()) {
    if (seIndexFilter !== null && seIndex !== Number(seIndexFilter)) continue;
    if (validateEquipment && substation.possuiDemaisEquipamentos === 'sim') {
      const incompleteEquipmentIndex = substation.demaisEquipamentos.findIndex(item => !item.nome.trim());
      if (incompleteEquipmentIndex !== -1) {
        const seCard = substationList.querySelector(`.substation-card[data-se-index="${seIndex}"]`);
        const equipmentInput = seCard.querySelector(
          `[data-equipment-field="nome"][data-equipment-index="${incompleteEquipmentIndex}"]`
        );
        window.bootstrap?.Collapse.getOrCreateInstance(seCard.querySelector('.substation-collapse'), { toggle: false }).show();
        window.setTimeout(() => {
          equipmentInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          equipmentInput?.focus({ preventScroll: true });
        }, 350);
        showAlert('Informe o nome de cada equipamento de média tensão da subestação.', true);
        return false;
      }
    }
    for (const [panelIndex, panel] of substation.paineis.entries()) {
      if (panelIndexFilter !== null && panelIndex !== Number(panelIndexFilter)) continue;
      const data = panel.dadosPainel;
      const coordination = data.coordenacaoSeletividade;
      if (scopes.includes('Curto-circuito')) {
        const panelCard = substationList.querySelector(
          `.substation-card[data-se-index="${seIndex}"] .panel-card[data-panel-index="${panelIndex}"]`
        );
        const supportabilityRequirements = [
          {
            answerField: 'suportabilidadePainelDisponivel',
            answer: data.curtoCircuito.suportabilidadePainelDisponivel,
            photos: data.fotos.foto_suportabilidades,
            photoSelector: '.support-panel-photo-field',
            subject: 'do painel'
          },
          {
            answerField: 'suportabilidadeDisjuntorDisponivel',
            answer: data.curtoCircuito.suportabilidadeDisjuntorDisponivel,
            photos: data.fotos.foto_suportabilidade_disjuntor,
            photoSelector: '.support-breaker-photo-field',
            subject: 'do disjuntor de entrada'
          }
        ];
        for (const requirement of supportabilityRequirements) {
          if (!requirement.answer) {
            const question = panelCard.querySelector(
              `[data-short-field="${requirement.answerField}"]`
            )?.closest('fieldset');
            return focusPanelRequirement(seIndex, panelIndex, question,
              `Informe se é possível obter as suportabilidades ${requirement.subject} no painel "${data.nome || `Painel ${panelIndex + 1}`}".`);
          }
          if (requirement.answer === 'sim' && !requirement.photos.length) {
            return focusPanelRequirement(seIndex, panelIndex,
              panelCard.querySelector(requirement.photoSelector),
              `A foto da suportabilidade ${requirement.subject} é obrigatória em "${data.nome || `Painel ${panelIndex + 1}`}".`);
          }
        }
      }
      if (scopes.includes('Coordenação e Seletividade')) {
        const findCoordinationInput = (field, recordArray, recordIndex) =>
          substationList.querySelector(
            `.substation-card[data-se-index="${seIndex}"] .panel-card[data-panel-index="${panelIndex}"] [data-panel-extra-field="${field}"][data-extra-record-array="${recordArray}"][data-extra-record-index="${recordIndex}"]`
          );
        const findCoordinationText = (field, recordArray, recordIndex) =>
          substationList.querySelector(
            `.substation-card[data-se-index="${seIndex}"] .panel-card[data-panel-index="${panelIndex}"] [data-panel-extra-text="${field}"][data-extra-record-array="${recordArray}"][data-extra-record-index="${recordIndex}"]`
          );
        const findRadio = (field, recordArray, recordIndex) => {
          let selector = `[data-panel-extra-field="${field}"][data-extra-section="coordenacaoSeletividade"]`;
          if (recordArray) selector += `[data-extra-record-array="${recordArray}"][data-extra-record-index="${recordIndex}"]`;
          return substationList.querySelector(
            `.substation-card[data-se-index="${seIndex}"] .panel-card[data-panel-index="${panelIndex}"] ${selector}`
          );
        };
        for (const [index, relay] of coordination.relesProtecao.entries()) {
          if (!String(relay.cubiculo).trim() || !relay.alimentacao) {
            const input = !String(relay.cubiculo).trim()
              ? findCoordinationText('cubiculo', 'relesProtecao', index)
              : findCoordinationInput('alimentacao', 'relesProtecao', index);
            return focusPanelRequirement(seIndex, panelIndex, input,
              `Informe o número do cubículo e se o relé de proteção ${index + 1} está na Entrada ou em um Alimentador.`);
          }
          if (relay.alimentacao === 'Alimentador' && !relay.equipamentoProtegido.trim()) {
            return focusPanelRequirement(seIndex, panelIndex,
              findCoordinationText('equipamentoProtegido', 'relesProtecao', index),
              `Informe qual equipamento/circuito o relé ${index + 1} protege.`);
          }
          if (!relay.backupObtido) {
            return focusPanelRequirement(seIndex, panelIndex, findRadio('backupObtido', 'relesProtecao', index)?.closest('fieldset'),
              `Informe se foi possível obter o backup do relé ${index + 1}.`);
          }
          if (relay.backupObtido === 'nao') {
            const photoPath = `coordenacaoSeletividade.relesProtecao.${index}.fotosModeloOrderCode`;
            const photoInput = substationList.querySelector(
              `.substation-card[data-se-index="${seIndex}"] .panel-card[data-panel-index="${panelIndex}"] [data-photo-path="${photoPath}"]`
            );
            if (!relay.fotosModeloOrderCode.length) {
              return focusPanelRequirement(seIndex, panelIndex, photoInput?.closest('.photo-field'),
                `A foto do modelo e order code do relé ${index + 1} é obrigatória.`);
            }
          }
        }
        for (const [index, breaker] of coordination.disjuntoresLSIG.entries()) {
          if (!String(breaker.cubiculo).trim() || !breaker.alimentacao) {
            const input = !String(breaker.cubiculo).trim()
              ? findCoordinationText('cubiculo', 'disjuntoresLSIG', index)
              : findCoordinationInput('alimentacao', 'disjuntoresLSIG', index);
            return focusPanelRequirement(seIndex, panelIndex, input,
              `Informe o número do cubículo e se o disjuntor LSIG ${index + 1} está na Entrada ou em um Alimentador.`);
          }
          if (breaker.alimentacao === 'Alimentador' && !breaker.equipamentoProtegido.trim()) {
            return focusPanelRequirement(seIndex, panelIndex,
              findCoordinationText('equipamentoProtegido', 'disjuntoresLSIG', index),
              `Informe qual equipamento/circuito o disjuntor LSIG ${index + 1} protege.`);
          }
          const photoPath = `coordenacaoSeletividade.disjuntoresLSIG.${index}.fotosAjustes`;
          const photoInput = substationList.querySelector(
            `.substation-card[data-se-index="${seIndex}"] .panel-card[data-panel-index="${panelIndex}"] [data-photo-path="${photoPath}"]`
          );
          if (!breaker.fotosAjustes.length) {
            return focusPanelRequirement(seIndex, panelIndex, photoInput?.closest('.photo-field'),
              `A foto dos ajustes do disjuntor LSIG ${index + 1} é obrigatória.`);
          }
        }
      }
      if (hasAdditionalScope('Ajustes dos Relés Inteligentes')) {
        const findIntelligentRadio = (field, recordIndex) => {
          let selector = `[data-panel-extra-field="${field}"][data-extra-section="coordenacaoSeletividade"]`;
          if (recordIndex !== undefined) {
            selector += `[data-extra-record-array="relesInteligentes"][data-extra-record-index="${recordIndex}"]`;
          }
          return substationList.querySelector(
            `.substation-card[data-se-index="${seIndex}"] .panel-card[data-panel-index="${panelIndex}"] ${selector}`
          );
        };
        if (!coordination.possuiRelesInteligentes) {
          return focusPanelRequirement(seIndex, panelIndex,
            findIntelligentRadio('possuiRelesInteligentes')?.closest('fieldset'),
            'Informe se o painel possui relés inteligentes.');
        }
        if (coordination.possuiRelesInteligentes === 'sim') {
          for (const [index, relay] of coordination.relesInteligentes.entries()) {
            const photoPath = `coordenacaoSeletividade.relesInteligentes.${index}.fotosModelo`;
            const photoInput = substationList.querySelector(
              `.substation-card[data-se-index="${seIndex}"] .panel-card[data-panel-index="${panelIndex}"] [data-photo-path="${photoPath}"]`
            );
            if (!relay.fotosModelo.length) {
              return focusPanelRequirement(seIndex, panelIndex, photoInput?.closest('.photo-field'),
                `A foto do modelo do relé inteligente ${index + 1} é obrigatória.`);
            }
            if (!relay.arquivoObtido) {
              return focusPanelRequirement(seIndex, panelIndex,
                findIntelligentRadio('arquivoObtido', index)?.closest('fieldset'),
                `Informe se foi possível obter o arquivo do relé inteligente ${index + 1}.`);
            }
          }
        }
      }
      if (hasAdditionalScope('Painéis de baixa tensão (QD/QDL/QL)') && isLowVoltagePanel(data.tipo)
          && !coordination.fotosDispositivosProtecaoBT.length) {
        const photoInput = substationList.querySelector(
          `.substation-card[data-se-index="${seIndex}"] .panel-card[data-panel-index="${panelIndex}"] [data-photo-path="coordenacaoSeletividade.fotosDispositivosProtecaoBT"]`
        );
        return focusPanelRequirement(seIndex, panelIndex, photoInput?.closest('.photo-field'),
          'Registre as fotos dos dispositivos de proteção do painel de baixa tensão.');
      }
      if (scopes.includes('Energia Incidente')) {
        const findEnergyRadio = field => substationList.querySelector(
          `.substation-card[data-se-index="${seIndex}"] .panel-card[data-panel-index="${panelIndex}"] [data-panel-extra-field="${field}"][data-extra-section="energiaIncidente"]`
        );
        const incident = data.energiaIncidente;
        if (!incident.possuiReleArco) {
          return focusPanelRequirement(seIndex, panelIndex, findEnergyRadio('possuiReleArco')?.closest('fieldset'),
            'Informe se o painel possui relé de arco.');
        }
        if (incident.possuiReleArco === 'sim') {
          if (!incident.backupReleArcoPossivel) {
            return focusPanelRequirement(seIndex, panelIndex,
              findEnergyRadio('backupReleArcoPossivel')?.closest('fieldset'),
              'Informe se é possível realizar o backup do arquivo do relé de arco.');
          }
          if (incident.backupReleArcoPossivel === 'nao' && !incident.fotosReleArco.length) {
            const settingsPhoto = substationList.querySelector(
              `.substation-card[data-se-index="${seIndex}"] .panel-card[data-panel-index="${panelIndex}"] [data-photo-path="energiaIncidente.fotosReleArco"]`
            );
            return focusPanelRequirement(seIndex, panelIndex, settingsPhoto?.closest('.photo-field'),
              'A foto dos ajustes implantados do relé de arco é obrigatória.');
          }
          if (!incident.releArcoTrip) {
            return focusPanelRequirement(seIndex, panelIndex, findEnergyRadio('releArcoTrip')?.closest('fieldset'),
              'Informe se o relé de arco envia trip a montante (transfer trip).');
          }
        }
      }
    }
  }
  return true;
}

document.getElementById('start-survey-button').addEventListener('click', () => {
  currentSurvey = makeSurvey();
  loadSurveyIntoForm();
});

document.getElementById('back-home-button').addEventListener('click', async () => {
  if (await persistCurrentSurvey()) {
    currentSurvey = null;
    showScreen('home');
  }
});

document.getElementById('step-1-next').addEventListener('click', async () => {
  if (!validateStepOne()) return;
  const countInput = document.getElementById('quantidade-ses');
  const count = Math.max(1, Math.min(MAX_SES, Number(countInput.value) || 1));
  countInput.value = String(count);
  currentSurvey.obra.quantidadeSEs = count;
  currentSurvey.subestacoes = resizeSubstations(count);
  renderSubstations();
  if (await persistCurrentSurvey()) setStep(2);
});

document.getElementById('step-2-back').addEventListener('click', async () => {
  if (await persistCurrentSurvey()) setStep(1);
});

document.getElementById('step-tab-1').addEventListener('click', async () => {
  if (currentStep === 2 && await persistCurrentSurvey()) setStep(1);
});

document.getElementById('step-tab-2').addEventListener('click', async () => {
  if (currentStep === 1 && validateStepOne()) {
    renderSubstations();
    if (await persistCurrentSurvey()) setStep(2);
  }
});

document.getElementById('add-se-button').addEventListener('click', async () => {
  if (currentSurvey.subestacoes.length >= MAX_SES) {
    showAlert(`O limite é de ${MAX_SES} subestações por levantamento.`, true);
    return;
  }
  currentSurvey.subestacoes.push(makeSubstation(currentSurvey.subestacoes.length));
  renderSubstations();
  await persistCurrentSurvey();
});

document.getElementById('finish-survey-button').addEventListener('click', async () => {
  for (const card of substationList.querySelectorAll('.substation-card')) {
    if (!validateSaveContainer(card)) return;
  }
  if (!validatePanelRequirements()) return;
  const emptyPanel = substationList.querySelector('.panel-name-input:invalid');
  if (emptyPanel) {
    emptyPanel.focus();
    emptyPanel.reportValidity();
    showAlert('Informe o nome de cada painel antes de salvar o levantamento.', true);
    return;
  }
  if (await persistCurrentSurvey()) {
    showAlert('Levantamento salvo neste dispositivo.');
    currentSurvey = null;
    showScreen('home');
  }
});

serviceForm.addEventListener('input', event => {
  const input = event.target;
  if (input.matches('[data-service-field]:not([data-service-field="quantidadeSEs"])')) updateServiceField(input);
  else if (input.matches('[data-se-field="nome"]')) {
    const se = currentSurvey.subestacoes[Number(input.dataset.seIndex)];
    if (se) {
      se[input.dataset.seField] = input.value;
      if (input.dataset.seField === 'nome') input.closest('.substation-card').querySelector('.substation-title').textContent = input.value || `SE ${Number(input.dataset.seIndex) + 1}`;
      scheduleSave();
    }
  } else if (input.matches('[data-final-observation-field]:not([type="radio"])')) {
    updateFinalObservationField(input);
  } else if (input.matches('[data-cable-field]')) updateCableField(input);
  else if (input.matches('[data-motor-field]:not([type="radio"])')) updateMotorField(input);
  else if (input.matches('[data-panel-field]')) updatePanelField(input);
  else if (input.matches('[data-short-field]') && input.type !== 'radio') updateShortCircuitField(input);
  else if (input.matches('[data-transformer-field]') && input.type !== 'radio') {
    const transformer = currentSurvey.subestacoes[Number(input.dataset.seIndex)]?.transformadores[Number(input.dataset.transformerIndex)];
    if (transformer) {
      transformer[input.dataset.transformerField] = input.value;
      if (input.dataset.transformerField === 'nome') {
        const item = input.closest('.transformer-item');
        const displayName = input.value.trim() || `Trafo ${Number(input.dataset.transformerIndex) + 1}`;
        const photoButton = item.querySelector('[data-transformer-photo-label]');
        if (photoButton) photoButton.textContent = `＋ Foto do Trafo ${displayName}`;
        item.querySelectorAll('.form-label').forEach(label => {
          if (/^Transformador /.test(label.textContent)) label.textContent = `Transformador ${displayName}`;
          else if (/^Placa do transformador/.test(label.textContent)) {
            label.textContent = `Placa do transformador ${displayName}`;
          }
        });
      }
      scheduleSave();
    }
  } else if (input.matches('[data-compartment-field]')) {
    const panel = getPanel(Number(input.dataset.seIndex), Number(input.dataset.panelIndex));
    if (panel) {
      panel.dadosPainel.energiaIncidente.compartimentos[input.dataset.compartment][input.dataset.compartmentField] = input.value;
      scheduleSave();
    }
  } else if (input.matches('[data-panel-extra-text]')) {
    updatePanelExtraText(input);
  } else if (input.matches('[data-equipment-field="nome"]')) {
    const equipment = currentSurvey.subestacoes[Number(input.dataset.seIndex)]?.demaisEquipamentos[Number(input.dataset.equipmentIndex)];
    if (equipment) {
      equipment.nome = input.value;
      scheduleSave();
    }
  }
});

serviceForm.addEventListener('change', async event => {
  const input = event.target;
  if (input.matches('[data-scope]')) {
    currentSurvey.obra.escopoServico = Array.from(document.querySelectorAll('[data-scope]:checked'), checkbox => checkbox.value);
    renderSubstations();
    syncScopeVisibility();
    scheduleSave();
  } else if (input.matches('[data-additional-scope]')) {
    currentSurvey.obra.outrosItensEscopo = Array.from(
      document.querySelectorAll('[data-additional-scope]:checked'),
      checkbox => checkbox.value
    );
    renderSubstations();
    scheduleSave();
  } else if (input.matches('[data-service-field="quantidadeSEs"]')) updateServiceField(input);
  else if (input.matches('[data-se-field="podeAlimentarMesmoBarramento"]')) {
    const se = currentSurvey.subestacoes[Number(input.dataset.seIndex)];
    if (se) {
      se.podeAlimentarMesmoBarramento = input.value;
      if (input.value !== 'sim') se.modoOperacaoTrafos = [];
      const card = input.closest('.substation-card');
      card.querySelector('.operation-modes').hidden = input.value !== 'sim';
      card.querySelectorAll('[data-mode-option]').forEach(option => { option.checked = se.modoOperacaoTrafos.includes(option.value); });
      scheduleSave();
    }
  } else if (input.matches('[data-mode-option]')) {
    const se = currentSurvey.subestacoes[Number(input.dataset.seIndex)];
    if (se) {
      se.modoOperacaoTrafos = Array.from(
        input.closest('.substation-card').querySelectorAll('[data-mode-option]:checked'),
        option => option.value
      );
      scheduleSave();
    }
  } else if (input.matches('[data-se-field="possuiDemaisEquipamentos"]')) {
    const se = currentSurvey.subestacoes[Number(input.dataset.seIndex)];
    if (se) {
      se.possuiDemaisEquipamentos = input.value;
      renderSubstations();
      scheduleSave();
    }
  } else if (input.matches('[data-se-field="quantidadeTransformadores"]')) {
    const se = currentSurvey.subestacoes[Number(input.dataset.seIndex)];
    if (se) {
      const count = Math.max(0, Math.min(MAX_TRANSFORMERS_PER_SE, Number(input.value) || 0));
      se.transformadores = se.transformadores.slice(0, count);
      while (se.transformadores.length < count) {
        se.transformadores.push({
          nome: '',
          placaAcessivel: null,
          possuiAterramentoEnrolamento: null,
          aterramentoPorResistor: null,
          placaResistorAcessivel: null,
          fotos: { transformador: [], placa: [], resistorPlaca: [], resistorPainel: [] }
        });
      }
      se.quantidadeTransformadores = count;
      renderSubstations();
      scheduleSave();
    }
  } else if (input.matches('[data-cable-field]')) updateCableField(input);
  else if (input.matches('[data-motor-count]')) updateMotorCount(input);
  else if (input.matches('[data-motor-field][type="radio"]')) updateMotorPlateAccess(input);
  else if (input.matches('[data-panel-extra-count]')) updatePanelExtraCount(input);
  else if (input.matches('[data-panel-extra-field]')) updatePanelExtraField(input);
  else if (input.matches('[data-final-observation-field][type="radio"]')) {
    updateFinalObservationField(input);
  } else if (input.matches('[data-panel-field]')) updatePanelField(input);
  else if (input.matches('[data-short-field]')) updateShortCircuitField(input);
  else if (input.matches('[data-transformer-field][type="radio"]')) {
    const transformer = currentSurvey.subestacoes[Number(input.dataset.seIndex)]
      ?.transformadores[Number(input.dataset.transformerIndex)];
    if (transformer) {
      transformer[input.dataset.transformerField] = input.value;
      if (input.dataset.transformerField === 'possuiAterramentoEnrolamento' && input.value !== 'sim') {
        transformer.aterramentoPorResistor = null;
        transformer.placaResistorAcessivel = null;
      } else if (input.dataset.transformerField === 'aterramentoPorResistor' && input.value !== 'sim') {
        transformer.placaResistorAcessivel = null;
      }
      const item = input.closest('.transformer-item');
      item.querySelector('.transformer-plate-photos').hidden = transformer.placaAcessivel !== 'sim';
      item.querySelector('.grounding-details').hidden =
        transformer.possuiAterramentoEnrolamento !== 'sim';
      item.querySelector('.resistor-details').hidden = transformer.aterramentoPorResistor !== 'sim';
      item.querySelector('.resistor-plate-photos').hidden = transformer.placaResistorAcessivel !== 'sim';
      item.querySelectorAll('[data-transformer-field]').forEach(answer => {
        answer.checked = answer.value === transformer[answer.dataset.transformerField];
      });
      scheduleSave();
    }
  }
  else if (input.matches('[data-photo-key]')) await handlePhotoInput(input);
});

substationList.addEventListener('shown.bs.collapse', event => {
  const card = event.target.closest('.substation-card, .panel-card');
  const toggle = event.target.classList.contains('module-collapse')
    ? event.target.closest('.module-card-section')?.querySelector('.module-collapse-label')
    : card?.querySelector('.collapse-label');
  if (toggle) {
    toggle.textContent = 'Minimizar';
    toggle.setAttribute('aria-expanded', 'true');
  }
});

substationList.addEventListener('hidden.bs.collapse', event => {
  const card = event.target.closest('.substation-card, .panel-card');
  const toggle = event.target.classList.contains('module-collapse')
    ? event.target.closest('.module-card-section')?.querySelector('.module-collapse-label')
    : card?.querySelector('.collapse-label');
  if (toggle) {
    toggle.textContent = 'Maximizar';
    toggle.setAttribute('aria-expanded', 'false');
  }
});

function hasCapturedPhoto(input) {
  const photos = getPhotoArray(input) || [];
  const storedPhoto = asPhotoArray(photos).some(photo => {
    const value = photo && typeof photo === 'object'
      ? (photo.blob ?? photo.base64 ?? photo.data)
      : photo;
    if (value instanceof Blob) return value.size > 0;
    if (typeof value !== 'string') return false;
    return /^data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)
      || /^[A-Za-z0-9+/]+={0,2}$/.test(value);
  });
  if (storedPhoto) return true;

  const previewImage = input.closest('.photo-field')?.querySelector('.photo-preview img');
  const previewSource = previewImage?.getAttribute('src') || '';
  return previewSource.startsWith('blob:')
    || /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(previewSource);
}

function validateSaveContainer(container) {
  for (const element of container.querySelectorAll('[required]')) {
    if (element.closest('[hidden]')) continue;

    // Campos file são limpos após a conversão; valide os dados persistidos, não o input.
    if (element.matches('input[type="file"]')) {
      if (hasCapturedPhoto(element)) continue;
      const photoLabel = element.closest('.photo-field')?.querySelector('.form-label')?.textContent.trim()
        || 'Foto obrigatória';
      window.alert(`A foto obrigatória não foi capturada: ${photoLabel}`);
      element.focus();
      return false;
    }

    // Aplica a validação nativa do navegador antes de gravar qualquer dado.
    if (!element.checkValidity()) {
      element.reportValidity();
      return false;
    }
  }
  return true;
}

async function salvarPainel(saveButton) {
  const panelCard = saveButton.closest('.panel-card');
  if (!panelCard || !validateSaveContainer(panelCard)) return false;
  const seIndex = Number(saveButton.dataset.seIndex);
  const panelIndex = Number(saveButton.dataset.panelIndex);
  if (!validatePanelRequirements({ seIndex, panelIndex, validateEquipment: false })) return false;
  if (!(await persistCurrentSurvey())) return false;
  window.alert('Painel salvo');
  return true;
}

async function salvarSE(saveButton) {
  const substationCard = saveButton.closest('.substation-card');
  if (!substationCard || !validateSaveContainer(substationCard)) return false;
  const seIndex = Number(saveButton.dataset.seIndex);
  if (!validatePanelRequirements({ seIndex })) return false;
  if (!(await persistCurrentSurvey())) return false;
  window.alert('SE salva');
  return true;
}

substationList.addEventListener('click', async event => {
  const target = event.target;
  const addCable = target.closest('.add-cable-button');
  if (addCable) {
    const panel = getPanel(Number(addCable.dataset.seIndex), Number(addCable.dataset.panelIndex));
    if (!panel) return;
    const cables = panel.dadosPainel.curtoCircuito.cabos;
    if (cables.length >= MAX_PROTECTION_DEVICES_PER_PANEL) {
      showAlert(`O limite é de ${MAX_PROTECTION_DEVICES_PER_PANEL} registros de cabo por painel.`, true);
      return;
    }
    if (!cables.length) cables.push({
      tipo: '',
      distancia: '',
      bitola: '',
      quantidadePorFase: ''
    });
    cables.push({ tipo: '', distancia: '', bitola: '', quantidadePorFase: '' });
    const card = addCable.closest('.panel-card');
    const cableFields = card.querySelector('.cable-information-fields');
    cableFields.querySelectorAll('.cable-list, .add-cable-button').forEach(element => element.remove());
    renderCableInformation(cableFields,
      panel.dadosPainel.curtoCircuito, Number(addCable.dataset.seIndex), Number(addCable.dataset.panelIndex));
    await persistCurrentSurvey();
    return;
  }
  const savePanel = target.closest('.save-panel-button');
  if (savePanel) {
    await salvarPainel(savePanel);
    return;
  }
  const saveSubstation = target.closest('.save-substation-button');
  if (saveSubstation) {
    await salvarSE(saveSubstation);
    return;
  }
  const removeEquipment = target.closest('[data-remove-equipment]');
  if (removeEquipment) {
    const se = currentSurvey.subestacoes[Number(removeEquipment.dataset.seIndex)];
    se.demaisEquipamentos.splice(Number(removeEquipment.dataset.removeEquipment), 1);
    renderSubstations();
    await persistCurrentSurvey();
    return;
  }
  const removeSe = target.closest('.remove-se-button');
  if (removeSe) {
    if (currentSurvey.subestacoes.length <= 1) {
      showAlert('O levantamento precisa ter pelo menos uma SE.', true);
      return;
    }
    currentSurvey.subestacoes.splice(Number(removeSe.dataset.seIndex), 1);
    renderSubstations();
    await persistCurrentSurvey();
    return;
  }
  const addEquipment = target.closest('.add-equipment-button');
  if (addEquipment) {
    const se = currentSurvey.subestacoes[Number(addEquipment.closest('.substation-card').dataset.seIndex)];
    if (se.demaisEquipamentos.length >= MAX_EQUIPMENT_PER_SE) {
      showAlert(`O limite é de ${MAX_EQUIPMENT_PER_SE} equipamentos por SE.`, true);
      return;
    }
    se.demaisEquipamentos.push({ nome: '', fotos: [] });
    renderSubstations();
    await persistCurrentSurvey();
    return;
  }
  const addPanel = target.closest('.add-panel-button');
  if (addPanel) {
    const se = currentSurvey.subestacoes[Number(addPanel.dataset.seIndex)];
    if (se.paineis.length >= MAX_PANELS_PER_SE) {
      showAlert(`O limite é de ${MAX_PANELS_PER_SE} painéis por SE.`, true);
      return;
    }
    se.paineis.push(makePanel());
    renderSubstations();
    await persistCurrentSurvey();
    return;
  }
  const removePanel = target.closest('.remove-panel-button');
  if (removePanel) {
    const se = currentSurvey.subestacoes[Number(removePanel.dataset.seIndex)];
    se.paineis.splice(Number(removePanel.dataset.panelIndex), 1);
    renderSubstations();
    await persistCurrentSurvey();
  }
});

document.getElementById('saved-surveys').addEventListener('click', async event => {
  const cloudButton = event.target.closest('[data-upload-survey], [data-share-survey]');
  if (cloudButton) {
    const surveyId = cloudButton.dataset.uploadSurvey || cloudButton.dataset.shareSurvey;
    const survey = savedSurveys.find(item => item.id === surveyId);
    if (!survey) return;
    const originalLabel = cloudButton.textContent;
    cloudButton.disabled = true;
    cloudButton.textContent = cloudButton.hasAttribute('data-upload-survey')
      ? 'Enviando...'
      : 'Preparando ZIP...';
    try {
      if (cloudButton.hasAttribute('data-upload-survey')) {
        const accessToken = await getGraphAccessToken();
        const { archive } = await gerarZipCompleto(survey);
        await createUploadSession(survey, archive, accessToken);
        showAlert('Levantamento enviado ao OneDrive.');
      } else {
        await shareSurveyZip(survey);
      }
    } catch (error) {
      if (error.name === 'AbortError') return;
      console.error('Não foi possível concluir o upload ou compartilhamento.', error);
      showAlert(error.message || 'Não foi possível concluir a operação.', true);
    } finally {
      cloudButton.disabled = false;
      cloudButton.textContent = originalLabel;
    }
    return;
  }

  const exportButton = event.target.closest('[data-export-survey]');
  if (exportButton) {
    const survey = savedSurveys.find(item => item.id === exportButton.dataset.exportSurvey);
    if (!survey) return;
    const format = exportButton.dataset.exportFormat;
    const originalLabel = exportButton.textContent;
    exportButton.disabled = true;
    exportButton.textContent = 'Gerando...';
    try {
      const result = format === 'zip'
        ? await exportarZipCompleto(survey)
        : exportarExcel(survey);
      const outputType = format === 'zip' ? 'ZIP completo' : 'Excel';
      const photoSummary = format === 'zip' ? ` e ${result.photos} foto(s)` : '';
      showAlert(`${outputType} gerado com ${result.substations} SE(s), ${result.panels} painel(is)${photoSummary}.`);
    } catch (error) {
      console.error('Não foi possível exportar o levantamento.', error);
      showAlert(error.message || 'Não foi possível gerar o arquivo de exportação.', true);
    } finally {
      exportButton.disabled = false;
      exportButton.textContent = originalLabel;
    }
    return;
  }

  const openButton = event.target.closest('[data-open-survey]');
  if (openButton) {
    const survey = savedSurveys.find(item => item.id === openButton.dataset.openSurvey);
    if (!survey) return;
    currentSurvey = survey;
    loadSurveyIntoForm();
    return;
  }
  const deleteButton = event.target.closest('[data-delete-survey]');
  if (deleteButton) {
    const survey = savedSurveys.find(item => item.id === deleteButton.dataset.deleteSurvey);
    if (!survey || !confirm(`Excluir o levantamento "${survey.obra.numero || survey.obra.cliente}" deste dispositivo?`)) return;
    try {
      await requestStore('readwrite', store => store.delete(survey.id));
      await reloadSavedSurveys();
      showAlert('Levantamento excluído.');
    } catch (error) {
      console.error('Não foi possível excluir o levantamento.', error);
      showAlert('Não foi possível excluir o levantamento.', true);
    }
  }
});

(async function initialize() {
  try {
    database = await openDatabase();
    await reloadSavedSurveys();
  } catch (error) {
    console.error('Não foi possível inicializar o armazenamento local.', error);
    updateSaveStatus('Armazenamento indisponível', true);
    showAlert('O armazenamento local não está disponível neste navegador.', true);
    document.getElementById('start-survey-button').disabled = true;
  }
})();
