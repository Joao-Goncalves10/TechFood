var BASE_URL = "http://localhost:3000";
var PEDIDOS_LOCAL_KEY = "techfood_pedidos";

function carregarPedidosLocais() {
  var raw = localStorage.getItem(PEDIDOS_LOCAL_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) || [];
  } catch (err) {
    console.warn("carregarPedidosLocais: JSON inválido", err);
    return [];
  }
}

function salvarPedidosLocais(pedidos) {
  localStorage.setItem(PEDIDOS_LOCAL_KEY, JSON.stringify(pedidos));
}

function gerarIdPedidoLocal() {
  return Date.now() + Math.floor(Math.random() * 1000);
}

function mesclarPedidosLocais(pedidosServico, pedidosLocais) {
  if (!Array.isArray(pedidosServico)) pedidosServico = [];
  if (!Array.isArray(pedidosLocais)) pedidosLocais = [];

  var idsServico = pedidosServico.map(function (p) {
    return String(p.id);
  });

  var unidos = pedidosServico.slice();
  pedidosLocais.forEach(function (pedidoLocal) {
    if (!idsServico.includes(String(pedidoLocal.id))) {
      unidos.push(pedidoLocal);
    }
  });
  return unidos;
}

// ─────────────────────────────────────────────────────────────────────────────
// buscarProdutos()
// GET /produtos — retorna a lista de pratos do banco de dados.
//
// async/await vs .then():
//   Funcionam igual. async/await parece código síncrono mas não trava a página.
//   É o padrão moderno — mais legível, mais fácil de depurar.
//
// response.ok: verifica se o status HTTP é 2xx (sucesso).
//   Se não for (ex: 404, 500), lança um erro para o catch tratar.
// ─────────────────────────────────────────────────────────────────────────────
async function buscarProdutos() {
  try {
    const response = await fetch(`${BASE_URL}/produtos`);
    const dados = await response.json();
    if (!response.ok) throw new Error(dados.erro || `Erro: ${response.status}`);
    return dados;
  } catch (err) {
    console.warn("buscarProdutos: falha ao acessar backend:", err);
    // Tentativa de fallback: carregar mock local (útil em ambiente sem API)
    try {
      const localResp = await fetch("src/data/produtos.json");
      const localDados = await localResp.json();
      return localDados;
    } catch (err2) {
      console.warn("buscarProdutos: não foi possível carregar mock local:", err2);
      // Fallback definitivo: array hardcoded mínimo para desenvolvimento
      return [
        {
          produto_id: 1,
          nome: "Lasanha Tradicional",
          descricao: "Molho especial, queijo e carne moída.",
          imagem: "lasanha.jpg",
          preco: 28.5,
        },
        {
          produto_id: 2,
          nome: "Hambúrguer Gourmet",
          descricao: "Pão brioche, carne suculenta e queijo cheddar.",
          imagem: "hamburguer.jpg",
          preco: 22.0,
        },
        {
          produto_id: 3,
          nome: "Salada Caesar",
          descricao: "Alface, frango grelhado e molho Caesar.",
          imagem: "salada.jpg",
          preco: 18.75,
        },
      ];
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// criarPedido(cliente, itens)
// POST /pedidos — envia um novo pedido para o servidor.
//
// O back-end exige produto_id e quantidade — não o nome nem o preço.
// Preço nunca vem do front-end: o servidor busca no banco para evitar
// que alguém manipule o valor antes de enviar.
//
// headers: { "Content-Type": "application/json" } avisa o servidor
//   que o corpo da requisição é JSON — sem isso ele não consegue ler.
// JSON.stringify converte o objeto JS em texto JSON para enviar.
// ─────────────────────────────────────────────────────────────────────────────
async function criarPedido(cliente, itens) {
  try {
    const response = await fetch(`${BASE_URL}/pedidos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cliente: cliente, itens: itens }),
    });
    const dados = await response.json();
    if (!response.ok) throw new Error(dados.erro || `Erro: ${response.status}`);
    return dados;
  } catch (err) {
    console.warn("criarPedido: backend indisponível, salvando pedido localmente", err);
    var pedidos = carregarPedidosLocais();
    var produtos = await buscarProdutos().catch(function () {
      return [];
    });
    if (produtos && produtos.dados) produtos = produtos.dados;
    if (!Array.isArray(produtos)) produtos = [];

    var total = itens.reduce(function (acc, item) {
      var prod = produtos.find(function (p) {
        return Number(p.produto_id) === Number(item.produto_id);
      });
      return acc + (prod ? parseFloat(prod.preco) * item.quantidade : 0);
    }, 0);

    var pedidoLocal = {
      id: gerarIdPedidoLocal(),
      cliente: cliente,
      itens: itens,
      total: total,
      status: "pendente",
      local: true,
      criadoEm: new Date().toISOString(),
    };
    pedidos.push(pedidoLocal);
    salvarPedidosLocais(pedidos);
    return pedidoLocal;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// buscarPedidos()
// GET /pedidos — retorna todos os pedidos do banco (para o painel da cozinha).
// ─────────────────────────────────────────────────────────────────────────────
async function buscarPedidos() {
  var pedidosLocais = carregarPedidosLocais();
  try {
    const response = await fetch(`${BASE_URL}/pedidos`);
    const dados = await response.json();
    if (!response.ok) throw new Error(dados.erro || `Erro: ${response.status}`);
    var pedidosServico = dados.dados || dados;
    return mesclarPedidosLocais(pedidosServico, pedidosLocais);
  } catch (err) {
    console.warn("buscarPedidos: backend indisponível, retornando pedidos locais", err);
    return pedidosLocais;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// atualizarStatusPedido(id, novoStatus)
// PATCH /pedidos/:id/status — avança o status de um pedido na cozinha.
//
// PATCH vs PUT:
//   PUT substitui o recurso inteiro. PATCH atualiza só um campo.
//   Aqui só o status muda — PATCH é a escolha certa.
// ─────────────────────────────────────────────────────────────────────────────
async function atualizarStatusPedido(id, novoStatus) {
  try {
    const response = await fetch(`${BASE_URL}/pedidos/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ novoStatus: novoStatus }),
    });
    const dados = await response.json();
    if (!response.ok)
      throw new Error(dados.erro || `Erro: ${response.status}`);
    return dados;
  } catch (err) {
    console.warn("atualizarStatusPedido: backend indisponível, atualizando pedido local", err);
    var pedidos = carregarPedidosLocais();
    var pedido = pedidos.find(function (p) {
      return Number(p.id) === Number(id);
    });
    if (!pedido) throw err;
    pedido.status = novoStatus;
    salvarPedidosLocais(pedidos);
    return pedido;
  }
}