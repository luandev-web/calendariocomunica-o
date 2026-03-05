/**
 * JavaScript Principal do Sistema de Eventos da Igreja
 * Firebase (Firestore) direto no front (sem back)
 */

import { db } from "./firebase.js";

import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  deleteDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// ==========================================
// VARIÁVEIS GLOBAIS
// ==========================================

let mesAtual = new Date().getMonth();
let anoAtual = new Date().getFullYear();
let eventosDoMes = [];

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const ICONES_DEPARTAMENTO = {
  "Louvor": "fa-music",
  "Jovens": "fa-users",
  "Infantil": "fa-child",
  "Administrativo": "fa-briefcase",
  "Missões": "fa-globe",
  "Casais": "fa-heart",
  "Mulheres": "fa-female",
  "Homens": "fa-male",
  "Diaconia": "fa-hands-helping",
  "Ensino": "fa-book",
};

// ==========================================
// HELPERS DE DATA (YYYY-MM-DD)
// ==========================================

function pad2(n) {
  return String(n).padStart(2, "0");
}

function primeiroDiaMesISO(ano, mesIndex) {
  return `${ano}-${pad2(mesIndex + 1)}-01`;
}

function ultimoDiaMesISO(ano, mesIndex) {
  const ultimo = new Date(ano, mesIndex + 1, 0).getDate();
  return `${ano}-${pad2(mesIndex + 1)}-${pad2(ultimo)}`;
}

function normalizarDepartamento(departamento) {
  return departamento
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-");
}

// ==========================================
// INICIALIZAÇÃO
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
  const hoje = new Date();

  mesAtual = hoje.getMonth();
  anoAtual = hoje.getFullYear();

  configurarEventListeners();
  atualizarCalendario();

  const inputData = document.getElementById("data");
  if (inputData) inputData.valueAsDate = hoje;

  console.log("✅ Sistema de Eventos (Firestore) inicializado!");
});

function configurarEventListeners() {
  // Formulário
  document.getElementById("formEvento").addEventListener("submit", salvarEvento);
  document.getElementById("btnLimpar").addEventListener("click", limparFormulario);
  document.getElementById("btnToggleForm").addEventListener("click", toggleFormulario);

  // Navegação
  document.getElementById("btnMesAnterior").addEventListener("click", () => navegarMes(-1));
  document.getElementById("btnMesProximo").addEventListener("click", () => navegarMes(1));
  document.getElementById("btnAnoAnterior").addEventListener("click", () => navegarAno(-1));
  document.getElementById("btnAnoProximo").addEventListener("click", () => navegarAno(1));
  document.getElementById("btnHoje").addEventListener("click", irParaHoje);

  // Pills de mês
  document.querySelectorAll(".pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mes = parseInt(btn.dataset.month, 10);
      selecionarMes(mes);
    });
  });

  // Exportação
  document.getElementById("btnExportar").addEventListener("click", exportarCalendario);

  // Modal
  document.getElementById("btnFecharModal").addEventListener("click", fecharModal);
  document.getElementById("modalDia").addEventListener("click", (e) => {
    if (e.target.id === "modalDia") fecharModal();
  });

  // Atalhos de teclado
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") fecharModal();
    if (e.key === "ArrowLeft" && !e.target.matches("input, textarea")) navegarMes(-1);
    if (e.key === "ArrowRight" && !e.target.matches("input, textarea")) navegarMes(1);
  });
}

// ==========================================
// FUNÇÕES DO CALENDÁRIO
// ==========================================

async function atualizarCalendario() {
  document.getElementById("labelMes").textContent = MESES[mesAtual];
  document.getElementById("labelAno").textContent = anoAtual;
  document.getElementById("tituloCalendarioExport").textContent = `${MESES[mesAtual]} ${anoAtual}`;

  atualizarPills();
  await carregarEventosDoMes();
  renderizarCalendario();
}

function atualizarPills() {
  document.querySelectorAll(".pill").forEach((btn) => {
    const mes = parseInt(btn.dataset.month, 10);
    btn.classList.toggle("active", mes === mesAtual);
  });
}

function selecionarMes(mes) {
  mesAtual = mes;
  atualizarCalendario();
}

function irParaHoje() {
  const hoje = new Date();
  mesAtual = hoje.getMonth();
  anoAtual = hoje.getFullYear();
  atualizarCalendario();
  mostrarToast("Navegado para o mês atual", "sucesso");
}

/**
 * Carrega eventos do mês usando Firestore.
 * Estratégia: buscar eventos com data <= fim do mês e filtrar por sobreposição:
 * entra no mês se (fimEvento >= inicioMes).
 *
 * OBS: como datas estão em 'YYYY-MM-DD', comparação string funciona.
 */
async function carregarEventosDoMes() {
  try {
    const inicioMes = primeiroDiaMesISO(anoAtual, mesAtual);
    const fimMes = ultimoDiaMesISO(anoAtual, mesAtual);

    const q = query(
      collection(db, "eventos"),
      where("data", "<=", fimMes),
      orderBy("data")
    );

    const snap = await getDocs(q);

    const todos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Filtra por sobreposição no mês (eventoFim >= inicioMes)
    eventosDoMes = todos.filter((ev) => {
      const fimEvento = ev.data_fim || ev.data;
      return fimEvento >= inicioMes;
    });

  } catch (erro) {
    console.error("Erro ao carregar eventos:", erro);
    eventosDoMes = [];
    mostrarToast("Erro ao carregar eventos", "erro");
  }
}

function renderizarCalendario() {
  const grid = document.getElementById("calendarioGrid");
  grid.innerHTML = "";

  const primeiroDia = new Date(anoAtual, mesAtual, 1);
  const diaSemanaInicio = primeiroDia.getDay();
  const ultimoDia = new Date(anoAtual, mesAtual + 1, 0);
  const totalDias = ultimoDia.getDate();
  const ultimoDiaMesAnterior = new Date(anoAtual, mesAtual, 0).getDate();

  const hoje = new Date();
  const diaHoje = hoje.getDate();
  const mesHoje = hoje.getMonth();
  const anoHoje = hoje.getFullYear();

  const eventosPorDia = {};

  eventosDoMes.forEach((evento) => {
    const dataInicio = new Date(evento.data + "T00:00:00");
    const dataFim = evento.data_fim ? new Date(evento.data_fim + "T00:00:00") : dataInicio;

    let atual = new Date(dataInicio);
    while (atual <= dataFim) {
      if (atual.getMonth() === mesAtual && atual.getFullYear() === anoAtual) {
        const dia = atual.getDate();
        if (!eventosPorDia[dia]) eventosPorDia[dia] = [];
        eventosPorDia[dia].push(evento);
      }
      atual.setDate(atual.getDate() + 1);
    }
  });

  // Dias do mês anterior
  for (let i = diaSemanaInicio - 1; i >= 0; i--) {
    const dia = ultimoDiaMesAnterior - i;
    grid.appendChild(criarDiaCalendario(dia, true, false, []));
  }

  // Dias do mês atual
  for (let dia = 1; dia <= totalDias; dia++) {
    const ehHoje = dia === diaHoje && mesAtual === mesHoje && anoAtual === anoHoje;
    const eventosNoDia = eventosPorDia[dia] || [];
    grid.appendChild(criarDiaCalendario(dia, false, ehHoje, eventosNoDia));
  }

  // Dias do próximo mês
  const totalCelulas = diaSemanaInicio + totalDias;
  const celulasRestantes = totalCelulas % 7 === 0 ? 0 : 7 - (totalCelulas % 7);

  for (let dia = 1; dia <= celulasRestantes; dia++) {
    grid.appendChild(criarDiaCalendario(dia, true, false, []));
  }
}

function criarDiaCalendario(dia, outroMes, ehHoje, eventos) {
  const divDia = document.createElement("div");
  divDia.className = "dia";

  if (outroMes) divDia.classList.add("outro-mes");
  if (ehHoje) divDia.classList.add("hoje");
  if (eventos.length > 0) divDia.classList.add("tem-evento");

  const numeroDiv = document.createElement("div");
  numeroDiv.className = "dia-numero";
  numeroDiv.innerHTML = `<span>${dia}</span>`;

  if (eventos.length > 0 && !outroMes) {
    numeroDiv.innerHTML += `<span class="eventos-count">${eventos.length}<i class="fas fa-circle"></i></span>`;
  }
  divDia.appendChild(numeroDiv);

  if (eventos.length > 0 && !outroMes) {
    const eventosDiv = document.createElement("div");
    eventosDiv.className = "dia-eventos";

    const eventosExibir = eventos.slice(0, 2);
    eventosExibir.forEach((evento) => {
      const chip = document.createElement("div");
      chip.className = `evento-chip dept-${normalizarDepartamento(evento.departamento)}`;

      const tituloSpan = document.createElement("span");
      tituloSpan.className = "evento-chip-titulo";
      tituloSpan.textContent = evento.titulo;
      chip.appendChild(tituloSpan);

      const infoSpan = document.createElement("span");
      infoSpan.className = "evento-chip-info";
      const icone = ICONES_DEPARTAMENTO[evento.departamento] || "fa-tag";

      let infoAdicional = "";
      if (evento.data_fim && evento.data !== evento.data_fim) {
        const dFim = new Date(evento.data_fim + "T00:00:00");
        infoAdicional = ` (até ${dFim.getDate()}/${dFim.getMonth() + 1})`;
      }

      infoSpan.innerHTML = `<i class="fas ${icone}"></i> ${evento.departamento}${infoAdicional}`;
      chip.appendChild(infoSpan);

      chip.title = `${evento.titulo}\n${evento.departamento} - ${evento.responsavel}`;
      eventosDiv.appendChild(chip);
    });

    if (eventos.length > 2) {
      const maisDiv = document.createElement("div");
      maisDiv.className = "evento-mais";
      maisDiv.textContent = `+${eventos.length - 2} mais`;
      eventosDiv.appendChild(maisDiv);
    }

    divDia.appendChild(eventosDiv);
    divDia.addEventListener("click", () => abrirModalDia(dia, eventos));
  } else if (!outroMes) {
    divDia.addEventListener("click", () => abrirModalDia(dia, []));
  }

  return divDia;
}

function navegarMes(direcao) {
  mesAtual += direcao;

  if (mesAtual < 0) {
    mesAtual = 11;
    anoAtual--;
  } else if (mesAtual > 11) {
    mesAtual = 0;
    anoAtual++;
  }

  atualizarCalendario();
}

function navegarAno(direcao) {
  anoAtual += direcao;
  atualizarCalendario();
}

// ==========================================
// FUNÇÕES DO FORMULÁRIO (Firestore)
// ==========================================

async function salvarEvento(e) {
  e.preventDefault();

  const eventoId = document.getElementById("eventoId").value;

  const dados = {
    titulo: document.getElementById("titulo").value.trim(),
    descricao: document.getElementById("descricao").value.trim(),
    data: document.getElementById("data").value,
    data_fim: document.getElementById("data_fim").value || null,
    responsavel: document.getElementById("responsavel").value.trim(),
    departamento: document.getElementById("departamento").value,
  };

  if (!dados.titulo || !dados.data || !dados.responsavel || !dados.departamento) {
    mostrarToast("Preencha todos os campos obrigatórios", "aviso");
    return;
  }

  if (dados.data_fim && dados.data_fim < dados.data) {
    mostrarToast("A data de término não pode ser anterior à data de início", "aviso");
    return;
  }

  try {
    if (eventoId) {
      await updateDoc(doc(db, "eventos", eventoId), dados);
      mostrarToast("Evento atualizado!", "sucesso");
    } else {
      await addDoc(collection(db, "eventos"), {
        ...dados,
        createdAt: new Date().toISOString(),
      });
      mostrarToast("Evento criado!", "sucesso");
    }

    limparFormulario();
    atualizarCalendario();
  } catch (erro) {
    console.error("Erro ao salvar evento:", erro);
    mostrarToast("Erro ao salvar evento", "erro");
  }
}

function limparFormulario() {
  document.getElementById("formEvento").reset();
  document.getElementById("eventoId").value = "";
  document.getElementById("btnSalvar").innerHTML = '<i class="fas fa-check"></i> Salvar';
}

function preencherFormulario(evento) {
  document.getElementById("eventoId").value = evento.id;
  document.getElementById("titulo").value = evento.titulo;
  document.getElementById("descricao").value = evento.descricao || "";
  document.getElementById("data").value = evento.data;
  document.getElementById("data_fim").value = evento.data_fim || "";
  document.getElementById("responsavel").value = evento.responsavel;
  document.getElementById("departamento").value = evento.departamento;

  document.getElementById("btnSalvar").innerHTML = '<i class="fas fa-edit"></i> Atualizar';

  const form = document.getElementById("formEvento");
  const btnToggle = document.getElementById("btnToggleForm");
  if (form.classList.contains("hidden")) {
    form.classList.remove("hidden");
    btnToggle.classList.remove("collapsed");
  }

  document.querySelector(".sidebar").scrollIntoView({ behavior: "smooth" });
  fecharModal();
}

function toggleFormulario() {
  const form = document.getElementById("formEvento");
  const btn = document.getElementById("btnToggleForm");

  form.classList.toggle("hidden");
  btn.classList.toggle("collapsed");
}

// ==========================================
// FUNÇÕES DO MODAL
// ==========================================

function abrirModalDia(dia, eventos) {
  const modal = document.getElementById("modalDia");
  const titulo = document.getElementById("modalTitulo");
  const body = document.getElementById("modalBody");

  const dataFormatada = `${dia} de ${MESES[mesAtual]} de ${anoAtual}`;
  titulo.innerHTML = `<i class="fas fa-calendar-day"></i> ${dataFormatada}`;

  body.innerHTML = "";

  if (eventos.length === 0) {
    body.innerHTML = `
      <div class="sem-eventos">
        <i class="fas fa-calendar-times"></i>
        <p>Nenhum evento neste dia</p>
        <button class="btn btn-primary" onclick="criarEventoNoDia(${dia})">
          <i class="fas fa-plus"></i> Adicionar Evento
        </button>
      </div>
    `;
  } else {
    eventos.forEach((evento) => {
      const icone = ICONES_DEPARTAMENTO[evento.departamento] || "fa-tag";
      const card = document.createElement("div");
      card.className = "evento-card";

      let periodo = "";
      if (evento.data_fim && evento.data !== evento.data_fim) {
        const dIni = new Date(evento.data + "T00:00:00");
        const dFim = new Date(evento.data_fim + "T00:00:00");
        periodo = `<p><i class="fas fa-clock"></i> ${dIni.toLocaleDateString()} até ${dFim.toLocaleDateString()}</p>`;
      }

      card.innerHTML = `
        <h4><i class="fas fa-calendar-check"></i> ${evento.titulo}</h4>
        ${periodo}
        <p><i class="fas fa-user"></i> ${evento.responsavel}</p>
        <span class="departamento-badge dept-${normalizarDepartamento(evento.departamento)}">
          <i class="fas ${icone}"></i> ${evento.departamento}
        </span>
        ${evento.descricao ? `<p style="margin-top: 8px;"><i class="fas fa-align-left"></i> ${evento.descricao}</p>` : ""}
        <div class="evento-card-actions">
          <button class="btn btn-outline btn-sm" onclick="preencherFormulario(${JSON.stringify(evento).replace(/"/g, "&quot;")})">
            <i class="fas fa-edit"></i> Editar
          </button>
          <button class="btn btn-danger btn-sm" onclick="excluirEvento('${evento.id}')">
            <i class="fas fa-trash"></i> Excluir
          </button>
        </div>
      `;

      body.appendChild(card);
    });
  }

  modal.classList.add("active");
}

function fecharModal() {
  document.getElementById("modalDia").classList.remove("active");
}

function criarEventoNoDia(dia) {
  const mes = pad2(mesAtual + 1);
  const diaStr = pad2(dia);
  const data = `${anoAtual}-${mes}-${diaStr}`;

  document.getElementById("data").value = data;
  document.getElementById("data_fim").value = "";

  const form = document.getElementById("formEvento");
  const btnToggle = document.getElementById("btnToggleForm");
  if (form.classList.contains("hidden")) {
    form.classList.remove("hidden");
    btnToggle.classList.remove("collapsed");
  }

  fecharModal();
  document.getElementById("titulo").focus();
}

async function excluirEvento(id) {
  if (!confirm("Deseja excluir este evento?")) return;

  try {
    await deleteDoc(doc(db, "eventos", id));
    mostrarToast("Evento excluído", "sucesso");
    fecharModal();
    atualizarCalendario();
  } catch (erro) {
    console.error("Erro ao excluir:", erro);
    mostrarToast("Erro ao excluir evento", "erro");
  }
}

// ==========================================
// EXPORTAÇÃO
// ==========================================

async function exportarCalendario() {
  const container = document.getElementById("calendarioContainer");
  const btnExportar = document.getElementById("btnExportar");

  btnExportar.disabled = true;
  btnExportar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Exportando...';

  container.classList.add("exportando");

  try {
    await new Promise((resolve) => setTimeout(resolve, 100));

    const canvas = await html2canvas(container, {
      backgroundColor: "#ffffff",
      scale: 3,
      logging: false,
      useCORS: true,
      allowTaint: true,
      foreignObjectRendering: false,
    });

    const link = document.createElement("a");
    link.download = `calendario-${MESES[mesAtual].toLowerCase()}-${anoAtual}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();

    mostrarToast("Calendário exportado!", "sucesso");
  } catch (erro) {
    console.error("Erro ao exportar:", erro);
    mostrarToast("Erro ao exportar", "erro");
  } finally {
    container.classList.remove("exportando");
    btnExportar.disabled = false;
    btnExportar.innerHTML = '<i class="fas fa-download"></i> Exportar';
  }
}

// ==========================================
// UTILITÁRIOS
// ==========================================

function mostrarToast(mensagem, tipo = "info") {
  const toast = document.getElementById("toast");
  const toastMensagem = document.getElementById("toastMensagem");

  toast.className = "toast";
  toast.classList.add(tipo);

  let icone = "fa-info-circle";
  if (tipo === "sucesso") icone = "fa-check-circle";
  if (tipo === "erro") icone = "fa-times-circle";
  if (tipo === "aviso") icone = "fa-exclamation-triangle";

  toastMensagem.innerHTML = `<i class="fas ${icone}"></i> ${mensagem}`;

  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

// Expor funções globalmente (usadas no HTML inline do modal)
window.preencherFormulario = preencherFormulario;
window.excluirEvento = excluirEvento;
window.criarEventoNoDia = criarEventoNoDia;