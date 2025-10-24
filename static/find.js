function limparMascaraCNPJ(cnpj) {
  return cnpj.replace(/[^\d]/g, ""); // remove tudo que não for dígito
}

async function buscarEmpresa() {
  const cnpjInput = document.getElementById("cnpjCompleto").value.trim();
  const cnpjCompleto = limparMascaraCNPJ(cnpjInput);
  const resultadoCards = document.getElementById("resultado-cards");

  // Limpar resultado anterior
  resultadoCards.innerHTML = "";
  resultadoCards.classList.add("hidden");

  if (!cnpjCompleto || cnpjCompleto.length !== 14) {
    // Mostrar erro com estilo melhorado
    showError("Por favor, digite um CNPJ completo com 14 dígitos.");
    return;
  }

  // Mostrar loading
  showLoading();

  try {
    const response = await fetch(`/api/find?cnpj=${cnpjCompleto}`);
    if (!response.ok) throw new Error("Erro ao buscar empresa.");

    const dados = await response.json();

    if (dados.length === 0) {
      resultadoCards.innerHTML = `
        <div class="glass-effect rounded-2xl p-8 text-center">
          <div class="w-16 h-16 bg-gray-400/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-8 h-8 text-gray-300">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.182 16.318A4.486 4.486 0 0012.016 15a4.486 4.486 0 00-3.198 1.318M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.008H9.375V9.75z" />
            </svg>
          </div>
          <p class='text-xl text-white mb-2'>Nenhuma empresa encontrada</p>
          <p class='text-gray-300'>Verifique se o CNPJ está correto e tente novamente</p>
        </div>`;
      resultadoCards.classList.remove("hidden");
      return;
    }

    // Preencher os cards com design melhorado
    dados.forEach((empresa) => {
      // Card Empresa
      const cardEmpresa = `
      <div class="result-card empresa-card p-6 mb-6 card-hover">
        <div class="flex items-center gap-3 mb-6">
          <div class="w-12 h-12 bg-gradient-to-r from-orange-400 to-orange-500 rounded-xl flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="white" class="w-6 h-6">
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75" />
            </svg>
          </div>
          <h2 class="text-2xl font-bold text-gray-800">Informações da Empresa</h2>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-gray-700">
          <div class="space-y-4">
            <div class="bg-gray-50/50 rounded-lg p-4">
              <h3 class="font-semibold text-orange-600 mb-1">CNPJ</h3>
              <p class="text-lg font-mono">${empresa.cnpj_completo}</p>
            </div>
            <div class="bg-gray-50/50 rounded-lg p-4">
              <h3 class="font-semibold text-orange-600 mb-1">Razão Social</h3>
              <p class="font-medium">${empresa.razao_social}</p>
            </div>
            <div class="bg-gray-50/50 rounded-lg p-4">
              <h3 class="font-semibold text-orange-600 mb-1">Nome Fantasia</h3>
              <p>${empresa.nome_fantasia || "Não informado"}</p>
            </div>
            <div class="bg-gray-50/50 rounded-lg p-4">
              <h3 class="font-semibold text-orange-600 mb-1">Capital Social</h3>
              <p>${empresa.capital_social}</p>
            </div>
            <div class="bg-gray-50/50 rounded-lg p-4">
              <h3 class="font-semibold text-orange-600 mb-1">Divisão</h3>
              <p>${empresa.divisao}</p>
            </div>
          </div>
          
          <div class="space-y-4">
            <div class="bg-gray-50/50 rounded-lg p-4">
              <h3 class="font-semibold text-orange-600 mb-1">CNAE Principal</h3>
              <p><span class="font-mono text-sm">${empresa.cnae_principal_codigo}</span></p>
              <p class="text-sm text-gray-600 mt-1">${empresa.cnaeDescricao}</p>
            </div>
            <div class="bg-gray-50/50 rounded-lg p-4">
              <h3 class="font-semibold text-orange-600 mb-1">Município</h3>
              <p>${empresa.municipio}</p>
            </div>
            <div class="bg-gray-50/50 rounded-lg p-4">
              <h3 class="font-semibold text-orange-600 mb-1">Tipo de Unidade</h3>
              <p>${empresa.tipo_unidade}</p>
            </div>
            <div class="bg-gray-50/50 rounded-lg p-4">
              <h3 class="font-semibold text-orange-600 mb-1">Data de Abertura</h3>
              <p>${empresa.data_abertura}</p>
            </div>
            <div class="bg-gray-50/50 rounded-lg p-4">
              <h3 class="font-semibold text-orange-600 mb-1">Situação</h3>
              <p class="font-medium ${empresa.situacao === 'ATIVA' ? 'text-green-600' : 'text-red-600'}">${empresa.situacao}</p>
            </div>
          </div>
        </div>
      </div>
      `;

      // Card Simples Nacional e MEI
      const cardSimples = `
      <div class="result-card simples-card p-6 mb-6 card-hover">
        <div class="flex items-center gap-3 mb-6">
          <div class="w-12 h-12 bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-xl flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="white" class="w-6 h-6">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3-6h.75a2.25 2.25 0 012.25 2.25v6a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25v-6A2.25 2.25 0 016 12h.75m12 0a2.25 2.25 0 012.25 2.25v6a2.25 2.25 0 01-2.25 2.25H9a2.25 2.25 0 01-2.25-2.25v-6A2.25 2.25 0 019 12h.75" />
            </svg>
          </div>
          <h2 class="text-2xl font-bold text-gray-800">Simples Nacional / MEI</h2>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-gray-700">
          <div class="space-y-4">
            <div class="bg-gray-50/50 rounded-lg p-4">
              <h3 class="font-semibold text-yellow-600 mb-1">Optante Simples Nacional</h3>
              <p class="font-medium">${empresa.simples.opcao_simples}</p>
            </div>
            <div class="bg-gray-50/50 rounded-lg p-4">
              <h3 class="font-semibold text-yellow-600 mb-1">Data de Opção Simples</h3>
              <p>${empresa.simples.data_opcao_simples || "Não informado"}</p>
            </div>
            <div class="bg-gray-50/50 rounded-lg p-4">
              <h3 class="font-semibold text-yellow-600 mb-1">Data de Exclusão Simples</h3>
              <p>${empresa.simples.data_exclusao_simples || "Não informado"}</p>
            </div>
          </div>
          
          <div class="space-y-4">
            <div class="bg-gray-50/50 rounded-lg p-4">
              <h3 class="font-semibold text-yellow-600 mb-1">Optante MEI</h3>
              <p class="font-medium">${empresa.simples.opcao_mei}</p>
            </div>
            <div class="bg-gray-50/50 rounded-lg p-4">
              <h3 class="font-semibold text-yellow-600 mb-1">Data de Opção MEI</h3>
              <p>${empresa.simples.data_opcao_mei || "Não informado"}</p>
            </div>
            <div class="bg-gray-50/50 rounded-lg p-4">
              <h3 class="font-semibold text-yellow-600 mb-1">Data de Exclusão MEI</h3>
              <p>${empresa.simples.data_exclusao_mei || "Não informado"}</p>
            </div>
          </div>
        </div>
      </div>
      `;

      // Card Contato
      const cardContato = `
      <div class="result-card contato-card p-6 mb-6 card-hover">
        <div class="flex items-center gap-3 mb-6">
          <div class="w-12 h-12 bg-gradient-to-r from-green-400 to-green-500 rounded-xl flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="white" class="w-6 h-6">
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
            </svg>
          </div>
          <h2 class="text-2xl font-bold text-gray-800">Informações de Contato</h2>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-gray-50/50 rounded-lg p-4 text-center">
            <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-blue-600">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
            <h3 class="font-semibold text-green-600 mb-1">Email</h3>
            <p class="text-gray-700">${empresa.email || "Não informado"}</p>
          </div>
          
          <div class="bg-gray-50/50 rounded-lg p-4 text-center">
            <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-green-600">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
            </div>
            <h3 class="font-semibold text-green-600 mb-1">Telefone</h3>
            <p class="text-gray-700">${empresa.telefone || "Não informado"}</p>
          </div>
          
          <div class="bg-gray-50/50 rounded-lg p-4 text-center">
            <div class="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-purple-600">
                <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
              </svg>
            </div>
            <h3 class="font-semibold text-green-600 mb-1">Telefone 2</h3>
            <p class="text-gray-700">${empresa.telefone2 || "Não informado"}</p>
          </div>
        </div>
      </div>
      `;

      // Card Sócios
      const listaSocios = (empresa.socios && empresa.socios.length > 0)
        ? empresa.socios.map(nome => `
            <li class="bg-gray-50/50 rounded-lg p-3 flex items-center gap-3">
              <div class="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 text-purple-600">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
              <span class="text-gray-700">${nome}</span>
            </li>
          `).join("")
        : `<li class="bg-gray-50/50 rounded-lg p-3 text-center text-gray-500">Nenhum sócio cadastrado</li>`;

      const cardSocios = `
      <div class="result-card socios-card p-6 mb-6 card-hover">
        <div class="flex items-center gap-3 mb-6">
          <div class="w-12 h-12 bg-gradient-to-r from-purple-400 to-purple-500 rounded-xl flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="white" class="w-6 h-6">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          </div>
          <h2 class="text-2xl font-bold text-gray-800">Quadro Societário</h2>
        </div>
        
        <ul class="space-y-3">${listaSocios}</ul>
      </div>
      `;

      resultadoCards.insertAdjacentHTML("beforeend", cardEmpresa);
      resultadoCards.insertAdjacentHTML("beforeend", cardSimples);
      resultadoCards.insertAdjacentHTML("beforeend", cardContato);
      resultadoCards.insertAdjacentHTML("beforeend", cardSocios);
    });

    resultadoCards.classList.remove("hidden");

  } catch (error) {
    console.error("Erro:", error);
    showError("Ocorreu um erro ao buscar a empresa. Tente novamente.");
  }
}

// Funções auxiliares para loading e error
function showLoading() {
  const resultadoCards = document.getElementById("resultado-cards");
  resultadoCards.innerHTML = `
  `;
  resultadoCards.classList.remove("hidden");
}

function hideLoading() {
    const resultadoCards = document.getElementById("resultado-cards");
    resultadoCards.classList.add("hidden"); // esconde o container
}

function showError(message) {
  const input = document.getElementById('cnpjCompleto');
  const resultadoCards = document.getElementById("resultado-cards");
  
  // Efeito visual no input
  input.classList.add('ring-2', 'ring-red-400');
  setTimeout(() => {
    input.classList.remove('ring-2', 'ring-red-400');
  }, 3000);
  
  // Mostrar mensagem de erro
  resultadoCards.innerHTML = `
    <div class="glass-effect rounded-2xl p-8 text-center">
      <div class="w-16 h-16 bg-red-400/20 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-8 h-8 text-red-300">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
      </div>
      <p class='text-xl text-white mb-2'>Erro na busca</p>
      <p class='text-gray-300'>${message}</p>
    </div>`;
  resultadoCards.classList.remove("hidden");
}

// Event listeners originais do find.js
document.addEventListener("DOMContentLoaded", function () {
  const inputCnpj = document.getElementById("cnpjCompleto");

  if (inputCnpj) {
    // Formatar CNPJ em tempo real
    inputCnpj.addEventListener("input", function (e) {
      let valor = e.target.value.replace(/\D/g, "");
      if (valor.length > 14) valor = valor.slice(0, 14);

      valor = valor.replace(/^(\d{2})(\d)/, "$1.$2");
      valor = valor.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
      valor = valor.replace(/\.(\d{3})(\d)/, ".$1/$2");
      valor = valor.replace(/(\d{4})(\d)/, "$1-$2");

      e.target.value = valor;
    });

    // Pressionar Enter chama a busca
    inputCnpj.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        buscarEmpresa();
      }
    });
    
    // Efeitos visuais no input
    inputCnpj.addEventListener('focus', function() {
      this.parentElement.parentElement.classList.add('ring-2', 'ring-orange-400/50');
    });
    
    inputCnpj.addEventListener('blur', function() {
      this.parentElement.parentElement.classList.remove('ring-2', 'ring-orange-400/50');
    });
  }
});
