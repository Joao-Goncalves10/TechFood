document.addEventListener("DOMContentLoaded", function () {
  renderizarPedidos();
  // setInterval: executa a função repetidamente a cada 30 segundos.
  // Novos pedidos aparecem no painel sem precisar recarregar a página.
  setInterval(renderizarPedidos, 30000);
});

// ─────────────────────────────────────────────────────────────────────────────
// renderizarPedidos()
// Aula 8: lia o array do localStorage e montava <li> com createElement.
// Aula 9: busca via GET /pedidos (api.js) — mesma técnica de criação de
//   elementos, mas os dados vêm do banco de dados real.
//
// Novidades em relação à Aula 8:
//   ✦ pedido.status → badge colorido (CSS: .badge-pendente, .badge-preparo…)
//   ✦ gerarBotaoStatus() → botão inline que avança o status na cozinha
//   ✦ setInterval no DOMContentLoaded → painel se atualiza sozinho
//   ✦ try/catch captura falha de rede e exibe mensagem de erro
// ─────────────────────────────────────────────────────────────────────────────
async function renderizarPedidos() {
  var lista = document.querySelector("#lista-pedidos");
  var spanTotal = document.querySelector("#valor-total");
  var spanResumoItens = document.querySelector("#contador-itens");
  var spanResumoTotal = document.querySelector("#valor-total-resumo");
  if (!lista) return;

  try {
    // buscarPedidos() no api.js — GET /pedidos
    var resposta = await buscarPedidos();
    var pedidos = resposta.dados || resposta;

    if (!pedidos || pedidos.length === 0) {
      lista.innerHTML = "<li class='pedido-vazio'>Nenhum pedido ainda. 😊</li>";
      if (spanTotal) spanTotal.textContent = "R$ 0,00";
      return;
    }

    lista.innerHTML = "";
    var totalGeral = 0;
    var totalItens = 0;

    pedidos.forEach(function (pedido) {
      // createElement — Aula 7: cria o item do pedido
      var li = document.createElement("li");
      // status-pendente / status-preparo / status-pronto / status-entregue
      li.classList.add("item-pedido", "status-" + pedido.status);

      li.innerHTML =
        "<div class='pedido-info'>" +
        "<strong>#" +
        pedido.id +
        " — " +
        (pedido.cliente || "Cliente") +
        "</strong>" +
        "<span class='pedido-total'>R$ " +
        parseFloat(pedido.total).toFixed(2).replace(".", ",") +
        "</span>" +
        "</div>" +
        "<div class='pedido-status'>" +
        "<span class='badge-status badge-" +
        pedido.status +
        "'>" +
        pedido.status.toUpperCase() +
        "</span>" +
        gerarBotaoStatus(pedido.id, pedido.status) +
        "</div>";

      lista.appendChild(li);
      totalGeral += parseFloat(pedido.total || 0);
      if (pedido.itens) {
        totalItens += pedido.itens.reduce(function (acc, item) {
          return acc + Number(item.quantidade || 0);
        }, 0);
      }
    });

    if (spanTotal) {
      spanTotal.textContent = "R$ " + totalGeral.toFixed(2).replace(".", ",");
    }
    if (spanResumoItens) {
      spanResumoItens.textContent = totalItens + " itens";
    }
    if (spanResumoTotal) {
      spanResumoTotal.textContent = "R$ " + totalGeral.toFixed(2).replace(".", ",");
    }
  } catch (erro) {
    lista.innerHTML =
      "<li class='pedido-vazio erro'>Erro ao carregar pedidos.</li>";
    if (spanResumoItens) spanResumoItens.textContent = "0 itens";
    if (spanResumoTotal) spanResumoTotal.textContent = "R$ 0,00";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// gerarBotaoStatus(pedidoId, statusAtual)
// Retorna o HTML do botão que avança o status do pedido.
// Define qual é o próximo status para cada estado atual — fluxo linear:
//   pendente → preparo → pronto → entregue → (fim)
//
// Retorna HTML como string porque é chamada dentro de um innerHTML —
// não pode usar addEventListener aqui. O onclick chama avancarStatus()
// que está no escopo global (definida abaixo).
// ─────────────────────────────────────────────────────────────────────────────
function gerarBotaoStatus(pedidoId, statusAtual) {
  var proximo = {
    pendente: { label: "▶ Iniciar preparo", status: "preparo" },
    preparo: { label: "✓ Marcar como pronto", status: "pronto" },
    pronto: { label: "🛵 Marcar entregue", status: "entregue" },
    entregue: null,
  };

  var acao = proximo[statusAtual];
  if (!acao) return "<span class='entregue-label'>✓ Concluído</span>";

  return (
    "<button class='btn-status' onclick='avancarStatus(" +
    pedidoId +
    ', "' +
    acao.status +
    "\")'>" +
    acao.label +
    "</button>"
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// avancarStatus(pedidoId, novoStatus)
// Chamada pelo onclick do botão gerado em gerarBotaoStatus().
// Envia PATCH /pedidos/:id/status via atualizarStatusPedido() do api.js,
// depois re-renderiza o painel para refletir o novo estado.
// ─────────────────────────────────────────────────────────────────────────────
async function avancarStatus(pedidoId, novoStatus) {
  try {
    // atualizarStatusPedido() no api.js — PATCH /pedidos/:id/status
    await atualizarStatusPedido(pedidoId, novoStatus);
    // Re-renderiza o painel após atualizar
    renderizarPedidos();
  } catch (erro) {
    alert("Erro ao atualizar status: " + erro.message);
  }
}
