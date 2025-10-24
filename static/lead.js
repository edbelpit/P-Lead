    const BASE_URL = window.location.origin;

    let leadIdParaEditar = null;
    let nomeAtualLead = "";
    let paginaAtual = 1;
    const itensPorPagina = 25;
    const estadosPaginacao = {};  // chave = lead_id, valor = {paginaAtual: 1}
    const LEAD_TODAS_EMPRESAS_ID = "TODAS_EMPRESAS";
    const estadosPaginacaoPessoas = {};
    let leadIdPessoaParaDeletar = null;
    let nomePessoaParaDeletar = "";
    const mapaEmpresasPorCnpj = {};



    window.onload = async () => {
        await carregarCnpjsLeadsPessoas();   // 1. busca todos os CNPJs já salvos
        carregarLeads();                     // 2. só depois pinta a tabela
        carregarMenuLateralLeads();
        carregarMenuLateralLeadsPessoas();
    };

    async function carregarMenuLateralLeads() {
        try {
            const res = await fetch(`${BASE_URL}/leads`);
            if (!res.ok) throw new Error("Erro ao buscar leads salvas");

            const leads = await res.json();
            const submenu = document.getElementById("submenuEmpresas");
            const contador = document.getElementById("contador-leads");

            submenu.innerHTML = ""; // Limpa a lista

            // Contar total de empresas de todas as leads somadas
            const totalEmpresas = leads.reduce((acc, lead) => acc + (lead.dados?.length || 0), 0);
            contador.textContent = totalEmpresas;

            if (leads.length === 0) {
                submenu.innerHTML = `<li class="text-gray-400">Nenhuma lead salva</li>`;
                return;
            }

            const liTodas = document.createElement("li");
            liTodas.innerHTML = `
                <a href="#" 
                onclick="carregarLeads(); return false;" 
                class="flex justify-between hover:text-blue-600 font-semibold">
                    <span>Todas Empresas</span>
                    <span class="text-gray-400">${totalEmpresas}</span>
                </a>`;
            submenu.appendChild(liTodas);

            // Listar leads
            leads.forEach(lead => {
                const li = document.createElement("li");
                li.innerHTML = `
                    <a href="#" 
                    onclick="carregarLeads('${lead._id}'); return false;" 
                    class="flex justify-between hover:text-blue-600 font-semibold">
                        <span>${lead.nome}</span>
                        <span class="text-gray-400">${lead.dados?.length || 0}</span>
                    </a>`;
                submenu.appendChild(li);
            });
        } catch (err) {
            console.error("Erro:", err);
        }
    }

    async function carregarMenuLateralLeadsPessoas() {
        try {
            const res = await fetch(`${BASE_URL}/leads-pessoas`);
            if (!res.ok) throw new Error("Erro ao buscar leads de pessoas");

            const leadsPessoas = await res.json();
            const submenu = document.getElementById("submenuPessoas");
            const contador = document.getElementById("contador-leads-pessoas");

            submenu.innerHTML = "";

            const totalPessoas = leadsPessoas.reduce((acc, lead) => acc + (lead.dados?.length || 0), 0);
            contador.textContent = totalPessoas;

            if (leadsPessoas.length === 0) {
                submenu.innerHTML = `<li class="text-gray-400">Nenhuma lead salva</li>`;
                return;
            }

            const liTodas = document.createElement("li");
            liTodas.innerHTML = `
                <a href="#" 
                onclick="carregarLeadsPessoas(); return false;" 
                class="flex justify-between hover:text-blue-600 font-semibold">
                    <span>Todas as Pessoas</span>
                    <span class="text-gray-400">${totalPessoas}</span>
                </a>`;
            submenu.appendChild(liTodas);

            leadsPessoas.forEach(lead => {
                const li = document.createElement("li");
                li.innerHTML = `
                    <a href="#" 
                    onclick="carregarLeadsPessoas('${lead._id}'); return false;" 
                    class="flex justify-between hover:text-blue-600 font-semibold">
                        <span>${lead.nome}</span>
                        <span class="text-gray-400">${lead.dados?.length || 0}</span>
                    </a>`;
                submenu.appendChild(li);
            });
        } catch (err) {
            console.error("Erro ao carregar leads de pessoas:", err);
        }
    }

    async function carregarLeads(leadId = null) {
        fecharPainelDetalhes();
        document.getElementById("header-lead-pessoas").style.display = "none";
        document.getElementById("header-lead-empresas").style.display = "none";
        await carregarCnpjsLeadsPessoas();
        leadAtualId = leadId || LEAD_TODAS_EMPRESAS_ID;

        const tbody = document.getElementById("resultado-body");
        tbody.innerHTML = "";

        atualizarCabecalhoEmpresas();
        atualizarTituloCinematico("empresa");


        try {
            const url = leadId
                ? `${BASE_URL}/leads/detalhada?lead_id=${encodeURIComponent(leadId)}`
                : `${BASE_URL}/leads`;

            const res = await fetch(url);
            if (!res.ok) throw new Error("Erro ao buscar leads salvos");

            let leads = await res.json();
            if (leadId) {
                leads = [leads];
            } else {
                const dadosCombinados = leads.flatMap(lead => lead.dados || []);
                const leadCombinado = {
                    _id: LEAD_TODAS_EMPRESAS_ID,
                    nome: "Todas Empresas",
                    dados: dadosCombinados
                };
                leads = [leadCombinado];
            }

            if (!leads.length) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="9" class="text-center text-gray-500 py-4">Nenhuma lead salva.</td>
                    </tr>`;
                return;
            }

            leads.forEach(lead => {
                lead.dados.forEach(emp => {
                    if (emp.cnpj) {
                        mapaEmpresasPorCnpj[emp.cnpj] = emp;
                    }
                });
            });

            leads.forEach((lead) => {
                const nomeEncoded = encodeURIComponent(lead.nome);
                const leadIdEncoded = encodeURIComponent(lead._id);

                // Inferir tipo de lead com base no primeiro dado
                const tipo = lead.dados?.[0]?.cpf ? "pessoa" : "empresa";

                // Renderizar cabeçalho certo
                if (tipo === "pessoa") {
                    document.getElementById("header-lead-pessoas").style.display = "block";
                    renderizarCabecalhoLeadPessoa(lead);
                } else {
                    document.getElementById("header-lead-empresas").style.display = "block";
                    renderizarCabecalhoLeadEmpresa(lead);
                }

                // Paginação
                if (Array.isArray(lead.dados)) {
                    if (!estadosPaginacao[lead._id]) {
                        estadosPaginacao[lead._id] = {
                            paginaAtual: 1,
                            total: lead.dados.length,
                            lead: lead
                        };
                    } else {
                        estadosPaginacao[lead._id].lead = lead;
                        estadosPaginacao[lead._id].total = lead.dados.length;
                    }

                    for (const lead of leads) {
                        renderizarLead(lead);
                    }
                }
            });

        } catch (err) {
            console.error("Erro:", err);
            alert("Erro ao carregar leads: " + err.message);
        }
    }


    function renderizarCabecalhoLeadEmpresa(lead) {
        const leadIdEncoded = encodeURIComponent(lead._id);
        const nomeEncoded = encodeURIComponent(lead.nome);
        const header = document.getElementById("header-lead-empresas");
        if (!header) return;

        header.innerHTML = `
            <div class="flex justify-between items-center px-4 py-3 bg-blue-50 text-blue-700 font-semibold rounded-t">
                <span id="nome-lead-header" class="text-base">${lead.nome}</span>

                <div class="flex items-center gap-4">
                    <span class="text-sm text-gray-700" id="intervalo-${leadIdEncoded}">
                        ${lead.intervalo || ""}
                    </span>

                    <button onclick="exportarEmpresasParaExcel('${leadIdEncoded}')" class="text-green-600 hover:text-green-800" title="Exportar Excel">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" fill="currentColor" class="w-5 h-5">
                            <path d="M 28.875 0 C 28.855469 0.0078125 28.832031 0.0195313 28.8125 0.03125 L 0.8125 5.34375 C 0.335938 5.433594 -0.0078125 5.855469 0 6.34375 L 0 43.65625 C -0.0078125 44.144531 0.335938 44.566406 0.8125 44.65625 L 28.8125 49.96875 C 29.101563 50.023438 29.402344 49.949219 29.632813 49.761719 C 29.859375 49.574219 29.996094 49.296875 30 49 L 30 44 L 47 44 C 48.09375 44 49 43.09375 49 42 L 49 8 C 49 6.90625 48.09375 6 47 6 L 30 6 L 30 1 C 30.003906 0.710938 29.878906 0.4375 29.664063 0.246094 C 29.449219 0.0546875 29.160156 -0.0351563 28.875 0 Z M 28 2.1875 L 28 6.53125 C 27.867188 6.808594 27.867188 7.128906 28 7.40625 L 28 42.8125 C 27.972656 42.945313 27.972656 43.085938 28 43.21875 L 28 47.8125 L 2 42.84375 L 2 7.15625 Z M 30 8 L 47 8 L 47 42 L 30 42 L 30 37 L 34 37 L 34 35 L 30 35 L 30 29 L 34 29 L 34 27 L 30 27 L 30 22 L 34 22 L 34 20 L 30 20 L 30 15 L 34 15 L 34 13 L 30 13 Z M 36 13 L 36 15 L 44 15 L 44 13 Z M 6.6875 15.6875 L 12.15625 25.03125 L 6.1875 34.375 L 11.1875 34.375 L 14.4375 28.34375 C 14.664063 27.761719 14.8125 27.316406 14.875 27.03125 L 14.90625 27.03125 C 15.035156 27.640625 15.160156 28.054688 15.28125 28.28125 L 18.53125 34.375 L 23.5 34.375 L 17.75 24.9375 L 23.34375 15.6875 L 18.65625 15.6875 L 15.6875 21.21875 C 15.402344 21.941406 15.199219 22.511719 15.09375 22.875 L 15.0625 22.875 C 14.898438 22.265625 14.710938 21.722656 14.5 21.28125 L 11.8125 15.6875 Z M 36 20 L 36 22 L 44 22 L 44 20 Z M 36 27 L 36 29 L 44 29 L 44 27 Z M 36 35 L 36 37 L 44 37 L 44 35 Z"></path>
                        </svg>
                    </button>

                    <button onclick="paginarLead('${leadIdEncoded}', 'anterior')" class="text-gray-600 hover:text-black" title="Página anterior">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                        </svg>
                    </button>

                    <button onclick="paginarLead('${leadIdEncoded}', 'proximo')" class="text-gray-600 hover:text-black" title="Próxima página">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                        </svg>
                    </button>

                    ${lead._id !== "TODAS_EMPRESAS" ? `
                        <button onclick="abrirModalEditarNome('${leadIdEncoded}', decodeURIComponent('${nomeEncoded}'))" class="flex items-center text-blue-600 hover:text-blue-800" title="Editar nome">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                                <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                                <path stroke-linecap="round" stroke-linejoin="round" d="M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                            </svg>
                        </button>
                        <button onclick="deletarLead('${leadIdEncoded}')" class="flex items-center text-red-600 hover:text-red-800" title="Deletar lista">
                            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                            </svg>
                        </button>
                    ` : ""}
                </div>
            </div>
        `;
    }

    function renderizarCabecalhoLeadPessoa(lead) {
        const leadIdEncoded = encodeURIComponent(lead._id);
        const nomeEncoded = encodeURIComponent(lead.nome);
        const header = document.getElementById("header-lead-pessoas");

        header.innerHTML = `
            <div class="flex justify-between items-center px-4 py-3 bg-blue-50 text-blue-700 font-semibold rounded-t">
                <span id="nome-lead-header" class="text-base">${lead.nome}</span>

                <div class="flex items-center gap-4">
                    <span class="text-sm text-gray-700" id="intervalo-${leadIdEncoded}">
                        ${lead.intervalo || ""}
                    </span>

                    <button onclick="exportarPessoasParaExcel('${leadIdEncoded}')" class="text-green-600 hover:text-green-800" title="Exportar Excel">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" fill="currentColor" class="w-5 h-5">
                            <path d="M 28.875 0 C 28.855469 0.0078125 28.832031 0.0195313 28.8125 0.03125 L 0.8125 5.34375 C 0.335938 5.433594 -0.0078125 5.855469 0 6.34375 L 0 43.65625 C -0.0078125 44.144531 0.335938 44.566406 0.8125 44.65625 L 28.8125 49.96875 C 29.101563 50.023438 29.402344 49.949219 29.632813 49.761719 C 29.859375 49.574219 29.996094 49.296875 30 49 L 30 44 L 47 44 C 48.09375 44 49 43.09375 49 42 L 49 8 C 49 6.90625 48.09375 6 47 6 L 30 6 L 30 1 C 30.003906 0.710938 29.878906 0.4375 29.664063 0.246094 C 29.449219 0.0546875 29.160156 -0.0351563 28.875 0 Z M 28 2.1875 L 28 6.53125 C 27.867188 6.808594 27.867188 7.128906 28 7.40625 L 28 42.8125 C 27.972656 42.945313 27.972656 43.085938 28 43.21875 L 28 47.8125 L 2 42.84375 L 2 7.15625 Z M 30 8 L 47 8 L 47 42 L 30 42 L 30 37 L 34 37 L 34 35 L 30 35 L 30 29 L 34 29 L 34 27 L 30 27 L 30 22 L 34 22 L 34 20 L 30 20 L 30 15 L 34 15 L 34 13 L 30 13 Z M 36 13 L 36 15 L 44 15 L 44 13 Z M 6.6875 15.6875 L 12.15625 25.03125 L 6.1875 34.375 L 11.1875 34.375 L 14.4375 28.34375 C 14.664063 27.761719 14.8125 27.316406 14.875 27.03125 L 14.90625 27.03125 C 15.035156 27.640625 15.160156 28.054688 15.28125 28.28125 L 18.53125 34.375 L 23.5 34.375 L 17.75 24.9375 L 23.34375 15.6875 L 18.65625 15.6875 L 15.6875 21.21875 C 15.402344 21.941406 15.199219 22.511719 15.09375 22.875 L 15.0625 22.875 C 14.898438 22.265625 14.710938 21.722656 14.5 21.28125 L 11.8125 15.6875 Z M 36 20 L 36 22 L 44 22 L 44 20 Z M 36 27 L 36 29 L 44 29 L 44 27 Z M 36 35 L 36 37 L 44 37 L 44 35 Z"></path>
                        </svg>
                    </button>

                    <button onclick="paginarLeadPessoa('${leadIdEncoded}', 'anterior')" class="text-gray-600 hover:text-black" title="Página anterior">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                        </svg>
                    </button>

                    <button onclick="paginarLeadPessoa('${leadIdEncoded}', 'proximo')" class="text-gray-600 hover:text-black" title="Próxima página">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                        </svg>
                    </button>

                    ${lead._id !== "TODAS_PESSOAS" ? `
                        <button onclick="abrirModalEditarNomePessoa('${leadIdEncoded}', decodeURIComponent('${nomeEncoded}'))" class="flex items-center text-blue-600 hover:text-blue-800" title="Editar nome">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                                <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                                <path stroke-linecap="round" stroke-linejoin="round" d="M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                            </svg>
                        </button>
                        <button onclick="deletarLeadPessoa('${leadIdEncoded}')" class="flex items-center text-red-600 hover:text-red-800" title="Deletar lista">
                            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                            </svg>
                        </button>
                    ` : ""}
                </div>
            </div>
        `;
    }


    async function carregarLeadsPessoas(leadId = null) {
        fecharPainelDetalhes();
        document.getElementById("header-lead-pessoas").style.display = "block";
        
        document.getElementById("header-lead-empresas").style.display = "none";

        const tbody = document.getElementById("resultado-body");
        tbody.innerHTML = "";
        atualizarCabecalhoPessoas();
        atualizarTituloCinematico("pessoa");

        try {
            const url = leadId
                ? `${BASE_URL}/leads-pessoas/detalhada?lead_id=${encodeURIComponent(leadId)}`
                : `${BASE_URL}/leads-pessoas`;

            const res = await fetch(url);
            if (!res.ok) throw new Error("Erro ao buscar leads de pessoas");

            let leads = await res.json();

            if (leadId) {
                leads = [leads];
            } else {
                const dadosCombinados = leads.flatMap(lead => lead.dados || []);
                leads = [{
                    _id: "TODAS_PESSOAS",
                    nome: "Todas Pessoas",
                    dados: dadosCombinados
                }];
            }

            if (!leads.length || leads[0].dados.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5" class="text-center text-gray-500 py-4">Nenhuma pessoa encontrada.</td>
                    </tr>`;
                return;
            }

            leads.forEach(lead => {
                const leadIdEncoded = encodeURIComponent(lead._id);
                const nomeEncoded = encodeURIComponent(lead.nome);

                // renderiza o header fora da tabela
                renderizarCabecalhoLeadPessoa(lead);


                if (!estadosPaginacaoPessoas[lead._id]) {
                    estadosPaginacaoPessoas[lead._id] = {
                        paginaAtual: 1,
                        total: lead.dados.length,
                        lead
                    };
                } else {
                    estadosPaginacaoPessoas[lead._id].lead = lead;
                    estadosPaginacaoPessoas[lead._id].total = lead.dados.length;
                }

                renderizarLeadPessoa(lead);
            });

        } catch (err) {
            console.error("Erro ao carregar leads de pessoas:", err);
            alert("Erro ao carregar pessoas: " + err.message);
        }
    }

    let cnpjsSalvosComoPessoa = new Set();

    function limparCnpj(cnpj) {
        return (cnpj || "").replace(/\D/g, ""); // remove tudo que não for número
    }

    async function carregarCnpjsLeadsPessoas() {
        try {
            const res = await fetch(`${BASE_URL}/leads-pessoas-cnpjs`);
            const arr = await res.json();          // ex.: ["01.379.118/0001-35", …]
            cnpjsSalvosComoPessoa = new Set(
                arr.map(limparCnpj)                // só dígitos no Set
            );
        } catch (err) {
            console.error("Erro ao carregar CNPJs:", err);
        }
    }

    function empresaJaSalvaComoLeadPessoa(dado) {
        const cnpjLimpo = limparCnpj(dado.cnpj);
        return cnpjsSalvosComoPessoa.has(cnpjLimpo);
    }

    function renderizarLead(lead) {
        const tbody = document.getElementById("resultado-body");
        const estado = estadosPaginacao[lead._id];
        const pagina = estado.paginaAtual;

        // Remove dados antigos dessa lead
        const linhasAntigas = document.querySelectorAll(`tr[data-lead="${lead._id}"]`);
        linhasAntigas.forEach(linha => linha.remove());

        let dadosOrdenados = [...lead.dados];

        if (ordenacaoAtual.campo) {
            dadosOrdenados.sort((a, b) => {
                const valA = (a[ordenacaoAtual.campo] || "").toString().toLowerCase();
                const valB = (b[ordenacaoAtual.campo] || "").toString().toLowerCase();

                const numA = parseFloat(valA.replace(/[^\d.-]/g, ""));
                const numB = parseFloat(valB.replace(/[^\d.-]/g, ""));
                const isNumber = !isNaN(numA) && !isNaN(numB);

                if (isNumber) {
                    return ordenacaoAtual.ordem === "asc" ? numA - numB : numB - numA;
                }

                return ordenacaoAtual.ordem === "asc"
                    ? valA.localeCompare(valB)
                    : valB.localeCompare(valA);
            });
        }

        const inicio = (pagina - 1) * itensPorPagina;
        const fim = inicio + itensPorPagina;
        const dadosPagina = dadosOrdenados.slice(inicio, fim);


        // Atualiza o intervalo no título
        const intervaloSpan = document.getElementById(`intervalo-${lead._id}`);
        if (intervaloSpan) {
            intervaloSpan.textContent = `${inicio + 1}-${Math.min(fim, lead.dados.length)} de ${lead.dados.length} empresas`;
        }

        // Adiciona as linhas de dados
        dadosPagina.forEach(dado => {
            const tr = document.createElement("tr");
            tr.className = "border-b hover:bg-gray-50 cursor-pointer";
            tr.setAttribute("data-lead", lead._id);

            if (empresaJaSalvaComoLeadPessoa(dado)) {
                tr.classList.add("bg-green-100"); // destaque visual
            }

            tr.onclick = async () => {
                const dadoBasico = {
                    empresa: dado.razao_social || "—",
                    razao_social: dado.razao_social || "—",
                    nome_fantasia: dado.nome_fantasia || "—",
                    cnpj: dado.cnpj || "—",
                    data_inicio_atividade: dado.data_inicio_atividade || "—",
                    divisao: dado.divisao || "—",
                    cnaeDescricao: dado.cnaeDescricao || "—",
                    site: null,
                    email: dado.email || null,
                    linkedin: null,
                };

                try {
                    const url = new URL("http://127.0.0.1:8000/enriquecer");
                    url.searchParams.append("nome", dado.razao_social);
                    if (dado.municipio) url.searchParams.append("cidade", dado.municipio);

                    const response = await fetch(url);
                    if (!response.ok) throw new Error("Erro ao buscar dados da empresa");

                    const dadosEnriquecidos = await response.json();

                    dadoBasico.site = dadosEnriquecidos.site || null;
                    dadoBasico.email = (dadosEnriquecidos.emails && dadosEnriquecidos.emails.length > 0)
                        ? dadosEnriquecidos.emails[0]
                        : dadoBasico.email;
                    dadoBasico.linkedin = dadosEnriquecidos.linkedin || null;
                } catch (error) {
                    console.error("Erro ao enriquecer dados da empresa:", error);
                }

                abrirPainelDetalhesEmpresa(dadoBasico);
            };

            tr.innerHTML = `
                <td class="px-6 py-3 text-left text-sm whitespace-nowrap">${dado.cnpj || "-"}</td>
                <td class="px-6 py-3 text-left text-sm">${dado.razao_social}</td>
                <td class="px-6 py-3 text-left text-sm whitespace-nowrap">${dado.capital_social}</td>
                <td class="px-6 py-3 text-left text-sm whitespace-nowrap" id="">${dado.municipio || "-"}</td>
                <td class="px-6 py-3 text-left text-sm whitespace-nowrap">
                    ${(dado.telefone || "-")}${dado.telefone2 ? `<br>${dado.telefone2}` : ""}
                </td>
                <td class="px-6 py-3 text-left text-sm">${dado.email || "-"}</td>
            `;
            tbody.appendChild(tr);
            const totalPaginas = Math.ceil(lead.dados.length / itensPorPagina);

            const btnAnterior = document.getElementById(`btn-anterior-${lead._id}`);
            const btnProximo = document.getElementById(`btn-proximo-${lead._id}`);

            if (btnAnterior) {
                btnAnterior.disabled = (pagina === 1);
                btnAnterior.classList.toggle("opacity-50", pagina === 1);
                btnAnterior.classList.toggle("cursor-not-allowed", pagina === 1);
            }

            if (btnProximo) {
                btnProximo.disabled = (pagina >= totalPaginas);
                btnProximo.classList.toggle("opacity-50", pagina >= totalPaginas);
                btnProximo.classList.toggle("cursor-not-allowed", pagina >= totalPaginas);
            }
        });
    }


    async function renderizarLeadPessoa(lead) {
    const tbody = document.getElementById("resultado-body");

    const estado = estadosPaginacaoPessoas[lead._id];
    const { paginaAtual } = estado;
    const dadosPorPagina = 25;
    const inicio = (paginaAtual - 1) * dadosPorPagina;
    const fim = inicio + dadosPorPagina;

    // Limpa linhas antigas
    const linhasAntigas = document.querySelectorAll(`tr[data-lead="${lead._id}"]`);
    linhasAntigas.forEach(linha => linha.remove());

    const dadosPagina = lead.dados.slice(inicio, fim);

    for (const pessoa of dadosPagina) {
        const empresa = mapaEmpresasPorCnpj[pessoa.cnpj] || {};

        const simples = {
            opcao_simples: pessoa.simples_opcao,
            data_opcao_simples: pessoa.simples_data_opcao,
            data_exclusao_simples: pessoa.simples_data_exclusao,
            opcao_mei: pessoa.simples_opcao_mei,
            data_opcao_mei: pessoa.simples_data_opcao_mei,
            data_exclusao_mei: pessoa.simples_data_exclusao_mei
        };

        const tr = document.createElement("tr");

        tr.className = "border-b hover:bg-gray-50";
        tr.setAttribute("data-lead", lead._id);

        tr.innerHTML = `
            <td class="px-6 py-3 text-sm whitespace-nowrap">${pessoa.cnpj || "—"}</td>
            <td class="px-6 py-3 text-sm whitespace-nowrap">${empresa.razao_social || pessoa.razao_social || "—"}</td>
            <td class="px-6 py-3 text-sm whitespace-nowrap">${empresa.capital_social || "—"}</td>
            <td class="px-6 py-3 text-sm whitespace-nowrap">${empresa.data_inicio_atividade || "—"}</td>
            <td class="px-6 py-3 text-sm whitespace-nowrap">
                ${simples.opcao_simples === "Sim" ? "Sim" : simples.opcao_simples === "Não" ? "Não" : "—"}
            </td>
            <td class="px-6 py-3 text-sm whitespace-nowrap">${simples.data_opcao_simples || "—"}</td>
            <td class="px-6 py-3 text-sm whitespace-nowrap">${simples.data_exclusao_simples || "—"}</td>
            <td class="px-6 py-3 text-sm whitespace-nowrap">
                ${simples.opcao_mei === "Sim" ? "Sim" : simples.opcao_mei === "Não" ? "Não" : "—"}
            </td>
            <td class="px-6 py-3 text-sm whitespace-nowrap">${simples.data_opcao_mei || "—"}</td>
            <td class="px-6 py-3 text-sm whitespace-nowrap">${simples.data_exclusao_mei || "—"}</td>
            <td class="px-6 py-3 text-sm whitespace-nowrap">${empresa.divisao || pessoa.divisao || "—"}</td>
            <td class="px-6 py-3 text-sm whitespace-nowrap">
                ${empresa.cnae_principal_codigo ? `${empresa.cnae_principal_codigo} - ${empresa.cnaeDescricao}` : (empresa.cnaeDescricao || "—")}
            </td>
            <td class="px-6 py-3 text-sm whitespace-nowrap">${empresa.municipio || pessoa.municipio || "—"}</td>
            <td class="px-6 py-3 text-sm whitespace-nowrap">${pessoa.nome_socio || "—"}</td>
            <td class="px-6 py-3 text-sm whitespace-nowrap">${pessoa.cargo || "—"}</td>
            <td class="px-6 py-3 text-sm whitespace-nowrap">
                ${pessoa.site ? `<a href="${pessoa.site}" class="text-blue-600 underline" target="_blank">${pessoa.site}</a>` : "—"}
            </td>
            <td class="px-6 py-3 text-sm whitespace-nowrap">
                ${pessoa.linkedin ? `<a href="${pessoa.linkedin}" class="text-blue-600 underline" target="_blank">Perfil</a>` : "—"}
            </td>
            <td class="px-6 py-3 text-sm whitespace-nowrap">
                ${(empresa.telefone || "—")}${empresa.telefone2 ? `<br>${empresa.telefone2}` : ""}
            </td>
            <td class="px-6 py-3 text-sm whitespace-nowrap">${pessoa.numero || "—"}</td>
            <td class="px-6 py-3 text-sm whitespace-nowrap">${empresa.email || "—"}</td>
        `;

        tbody.appendChild(tr);
    }

    // Atualiza o intervalo
    const intervaloSpan = document.getElementById(`intervalo-${lead._id}`);
    if (intervaloSpan) {
        const total = lead.dados.length;
        const inicioIntervalo = (estado.paginaAtual - 1) * dadosPorPagina + 1;
        const fimIntervalo = Math.min(inicioIntervalo + dadosPorPagina - 1, total);
        intervaloSpan.textContent = `${inicioIntervalo} - ${fimIntervalo} de ${total}`;
    }
}

    function paginarLead(leadId, direcao) {
        const estado = estadosPaginacao[leadId];
        if (!estado) return;

        const totalPaginas = Math.ceil(estado.total / itensPorPagina);

        if (direcao === 'anterior' && estado.paginaAtual > 1) {
            estado.paginaAtual--;
            renderizarLead(estado.lead);
        } else if (direcao === 'proximo' && estado.paginaAtual < totalPaginas) {
            estado.paginaAtual++;
            renderizarLead(estado.lead);
        }
    }

    function paginarLeadPessoa(leadId, direcao) {
        const estado = estadosPaginacaoPessoas[leadId];
        if (!estado) return;

        const totalPaginas = Math.ceil(estado.total / 25);

        if (direcao === "anterior" && estado.paginaAtual > 1) {
            estado.paginaAtual--;
        } else if (direcao === "proximo" && estado.paginaAtual < totalPaginas) {
            estado.paginaAtual++;
        }

        carregarLeadsPessoas(leadId);
    }



    function abrirModalEditarNome(id, nomeAtual) {
        leadIdParaEditar = id;
        nomeAtualLead = nomeAtual;
        document.getElementById("inputNovoNome").value = nomeAtual;
        document.getElementById("modalEditarNome").classList.remove("hidden");
    }

    function abrirModalEditarNomePessoa(id, nomeAtual) {
        leadIdParaEditar = id;
        nomeAtualLead = nomeAtual;
        document.getElementById("inputNovoNomePessoa").value = nomeAtual;
        document.getElementById("modalEditarNomePessoa").classList.remove("hidden");
    }

    function fecharModalEditarNome() {
        document.getElementById("modalEditarNome").classList.add("hidden");
        leadIdParaEditar = null;
        nomeAtualLead = "";
    }

    function fecharModalEditarNomePessoa() {
        document.getElementById("modalEditarNomePessoa").classList.add("hidden");
        leadIdParaEditar = null;
        nomeAtualLead = "";
    }


    function confirmarEditarNome() {
        const novoNome = document.getElementById("inputNovoNome").value.trim();

        if (!novoNome || novoNome === nomeAtualLead) {
            alert("Informe um nome diferente.");
            return;
        }

        fetch(`${BASE_URL}/leads/${leadIdParaEditar}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nome: novoNome })
        })
        .then(res => {
            if (!res.ok) throw new Error("Erro ao editar nome.");
            return res.json();
        })
        .then(() => {
            fecharModalEditarNome();
            carregarLeads();
        })
        .catch(err => {
            alert(err.message);
            fecharModalEditarNome();
        });
    }

    function confirmarEditarNomePessoa() {
        const novoNome = document.getElementById("inputNovoNomePessoa").value.trim();

        if (!novoNome || novoNome === nomeAtualLead) {
            alert("Informe um nome diferente.");
            return;
        }

        fetch(`${BASE_URL}/leads-pessoas/${leadIdParaEditar}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nome: novoNome })
        })
        .then(res => {
            if (!res.ok) throw new Error("Erro ao editar nome.");
            return res.json();
        })
        .then(() => {
            fecharModalEditarNomePessoa();
            carregarLeadsPessoas(); // Atualiza leads de pessoas
            carregarMenuLateralLeadsPessoas(); // Atualiza menu lateral
        })
        .catch(err => {
            alert(err.message);
            fecharModalEditarNomePessoa();
        });
    }


    function deletarLead(leadId) {
        if (confirm("Tem certeza que deseja excluir esta lista?")) {
            fetch(`${BASE_URL}/leads/${leadId}`, {
                method: "DELETE"
            })
            .then(res => {
                if (!res.ok) throw new Error("Erro ao deletar lista.");
                return res.json();
            })
            .then(() => {
                carregarLeads();                // Recarrega a tabela de leads
                carregarMenuLateralLeads();    // Atualiza o menu lateral
                carregarMenuLateralLeadsPessoas(); // Atualiza o menu lateral de pessoas
            })
            .catch(err => alert(err.message));
        }
    }

    function deletarLeadPessoa(leadId) {
        if (confirm("Tem certeza que deseja excluir esta lista?")) {
            fetch(`${BASE_URL}/leads-pessoas/${leadId}`, {
                method: "DELETE"
            })
            .then(res => {
                if (!res.ok) throw new Error("Erro ao deletar lista.");
                return res.json();
            })
            .then(() => {
                carregarLeadsPessoas();
                carregarMenuLateralLeadsPessoas();
            })
            .catch(err => alert(err.message));
        }
    }


    async function carregarDetalhesEmpresa(nome, cidade = "") {
    try {
        // Monta a URL com query params
        const url = new URL("http://127.0.0.1:8000/enriquecer");
        url.searchParams.append("nome", nome);
        if (cidade) url.searchParams.append("cidade", cidade);

        // Faz a requisição GET
        const response = await fetch(url);
        if (!response.ok) throw new Error("Erro ao buscar dados da empresa");

        const dados = await response.json();

        // Montar o objeto no formato esperado pelo painel
        const dadoPainel = {
        empresa: nome,
        nome_fantasia: (dados.nome_fantasia && dados.nome_fantasia !== "Access Denied")
            ? dados.nome_fantasia : "—",
        divisao: dados.divisao || "—",
        site: dados.site || null,
        email: (dados.emails && dados.emails.length > 0) ? dados.emails[0] : null,
        linkedin: dados.linkedin || null,
        cnpj: dados.cnpj || "",
        data_inicio_atividade: dados.data_inicio_atividade || "", 
        cnaeDescricao: dados.cnaeDescricao || "—"                  
        };
        console.log("🔎 Dados para o painel:", dadoPainel);
        // Abre o painel com os dados
        abrirPainelDetalhesEmpresa(dadoPainel);
        
    } catch (error) {
        console.error("Erro ao carregar detalhes da empresa:", error);
        alert("Não foi possível carregar os detalhes da empresa.");
    }
    }

    async function gerarEmails(socios, site, email, nomeFantasia) {
        try {
            const resposta = await fetch(`${BASE_URL}/api/gerar-emails`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    socios: socios,
                    site: site || null,
                    email: email || null,
                    nome_fantasia: nomeFantasia || null
                })
            });

            if (!resposta.ok) throw new Error("Erro ao gerar e-mails");

            const resultado = await resposta.json();
            return resultado.emails;
        } catch (error) {
            console.error("❌ Falha ao gerar e-mails:", error);
            return {};
        }
    }

    async function abrirPainelDetalhesEmpresa(dado) {
        console.log("🔍 Dados recebidos:", dado);

        // Preenche campos do painel
        document.getElementById("painel-razao").textContent = dado.razao_social || "—";
        document.getElementById("painel-nomeFantasia").textContent = dado.nome_fantasia || "—";
        document.getElementById("painel-cnpj").textContent = dado.cnpj || "—";
        document.getElementById("painel-fundacao").textContent = dado.data_inicio_atividade || "—";
        document.getElementById("painel-divisao").textContent = dado.divisao || "—";
        document.getElementById("painel-cnae").textContent = dado.cnaeDescricao || "—";
        document.getElementById("painel-site").innerHTML = dado.site
            ? `<a href="${dado.site}" target="_blank" class="text-blue-600 underline">${dado.site}</a>`
            : "—";
        document.getElementById("painel-email").textContent = dado.email || "—";
        document.getElementById("painel-linkedin").innerHTML = dado.linkedin
            ? `<a href="${dado.linkedin}" target="_blank" class="text-blue-600 underline">${dado.linkedin}</a>`
            : "—";

        const painel = document.getElementById("painelDetalhesEmpresa");
        painel.classList.remove("translate-x-full");

        // 🔑 CNPJ limpo (a partir do que foi exibido no painel)
        const cnpjTexto = document.getElementById("painel-cnpj").textContent || "";
        const cnpjLimpo = cnpjTexto.replace(/\D/g, "");
        console.log("🔑 CNPJ limpo:", cnpjLimpo);

        // 🔹 Carrega pessoas salvas do banco
        carregarSociosDoBanco(cnpjLimpo);
        carregarPessoasDoBanco(cnpjLimpo);

        // 🔄 Simples Nacional
        fetch(`/simples?cnpj=${cnpjLimpo}`)
            .then(res => res.ok ? res.json() : null)
            .then(simples => {
                if (simples) {
                    document.getElementById("simples-opcao").textContent = simples.opcao_simples === "S" ? "Sim" : "Não";
                    document.getElementById("simples-data-opcao").textContent = formatarData(simples.data_opcao_simples);
                    document.getElementById("simples-data-exclusao").textContent = formatarData(simples.data_exclusao_simples);
                    document.getElementById("simples-opcao-mei").textContent = simples.opcao_mei === "S" ? "Sim" : "Não";
                }
            })
            .catch(() => {
                document.getElementById("simples-opcao").textContent = "—";
                document.getElementById("simples-data-opcao").textContent = "—";
                document.getElementById("simples-data-exclusao").textContent = "—";
                document.getElementById("simples-opcao-mei").textContent = "—";
            });

        // 🔹 Carrega a última busca já registrada (se houver)
        try {
            const resp = await fetch(`/ultima-busca-pessoas?cnpj=${cnpjLimpo}`);
            if (resp.ok) {
                const data = await resp.json();
                if (data?.data_busca) {
                    const dt = new Date(data.data_busca);
                    document.getElementById("info-busca-pessoas").textContent =
                        `Última busca em: ${dt.toLocaleDateString()} ${dt.toLocaleTimeString()}`;
                } else {
                    document.getElementById("info-busca-pessoas").textContent =
                        "Nenhuma busca registrada ainda.";
                }
            }
        } catch (e) {
            console.warn("⚠️ Não foi possível carregar a última busca:", e);
        }

        // 📌 Vincula evento ao botão "Buscar Pessoas"
        const btnBuscar = document.getElementById("btn-buscar-pessoas");
        if (btnBuscar) {
            btnBuscar.onclick = async () => {
                // Força busca no BigData
                buscarPessoasRelacionadas(cnpjLimpo, true);

                // 🔹 Salva data da busca
                try {
                    const resp = await fetch("/registrar-busca-pessoas", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ cnpj: cnpjLimpo, tipo: "pessoas_relacionadas" })
                    });

                    const data = await resp.json();
                    if (data.ok) {
                        const dt = new Date(data.data_busca);
                        document.getElementById("info-busca-pessoas").textContent =
                            `Última busca em: ${dt.toLocaleDateString()} ${dt.toLocaleTimeString()}`;
                    }
                } catch (e) {
                    console.error("❌ Erro ao registrar busca:", e);
                }
            };
        }
    }


    async function carregarSociosDoBanco(cnpj) {
        const lista = document.getElementById("lista-socios-local");
        lista.innerHTML = "<p class='text-gray-500 text-sm'>Carregando sócios...</p>";

        try {
            const resp = await fetch(`/funcionarios?cnpj=${cnpj}`);
            if (!resp.ok) throw new Error("Erro ao buscar sócios");

            const socios = await resp.json();
            lista.innerHTML = "";

            if (socios.length === 0) {
                lista.innerHTML = "<p class='text-gray-500 text-sm'>Nenhum sócio encontrado.</p>";
                return;
            }

            socios.forEach((socio, idx) => {
                const item = document.createElement("div");
                item.className = "flex items-center gap-2";

                item.innerHTML = `
                    <input type="checkbox" 
                        class="checkbox-pessoa"
                        id="socio-${idx}"
                        data-nome="${socio.nome || "—"}"
                        data-cargo="${socio.cargo || "Sócio"}"
                        data-cpf="${socio.cpf || "—"}"
                        data-numero="${socio.numero || "—"}"
                        data-ativo="${socio.ativo ?? true}"
                        data-last_update="${socio.last_update || "—"}"
                    >
                    <label for="socio-${idx}" class="flex flex-col text-sm">
                        <span class="font-semibold"> ${socio.nome || "—"}</span>
                        <span class="text-sm text-gray-600"><strong>Cargo:</strong> ${socio.cargo || "—"}</span>
                    </label>
                `;
                lista.appendChild(item);
            });
        } catch (e) {
            console.error("❌ Erro ao carregar sócios:", e);
            lista.innerHTML = "<p class='text-red-500 text-sm'>Erro ao carregar sócios.</p>";
        }
    }

        // Utilidade para formatar data AAAAMMDD → DD/MM/AAAA
        function formatarData(dataStr) {
            if (!dataStr || dataStr === "00000000") return "—";
            const ano = dataStr.slice(0, 4);
            const mes = dataStr.slice(4, 6);
            const dia = dataStr.slice(6, 8);
            return `${dia}/${mes}/${ano}`;
        }
        // Utilidade para formatar data ISO → DD/MM/AAAA
        function formatarDataISO(dataISO) {
            if (!dataISO) return "—";
            const date = new Date(dataISO);
            if (isNaN(date)) return "—";
            const dia = String(date.getDate()).padStart(2, '0');
            const mes = String(date.getMonth() + 1).padStart(2, '0');
            const ano = date.getFullYear();
            return `${dia}/${mes}/${ano}`;
        }

    async function carregarPessoasDoBanco(cnpjLimpo) {
        const listaSocios = document.getElementById("lista-socios");
        const listaEmpregados = document.getElementById("lista-empregados");

        try {
            const respLocal = await fetch(`/bigdata-pessoas?cnpj=${cnpjLimpo}`);
            if (!respLocal.ok) throw new Error("Erro ao buscar no banco");

            const dados = await respLocal.json();
            const socios = dados?.socios || [];
            const funcionarios = dados?.funcionarios || [];

            // Renderiza sócios e funcionários do banco local
            listaSocios.innerHTML = socios.length
                ? socios.map(p => renderPessoaHTML(p)).join("")
                : "<p class='text-gray-500'>Nenhum sócio encontrado.</p>";

            listaEmpregados.innerHTML = funcionarios.length
                ? funcionarios.map(p => renderPessoaHTML(p)).join("")
                : "<p class='text-gray-500'>Nenhum funcionário encontrado.</p>";

        } catch (e) {
            console.error(e);
            listaSocios.innerHTML = "<p class='text-red-500'>Erro ao carregar sócios.</p>";
            listaEmpregados.innerHTML = "<p class='text-red-500'>Erro ao carregar funcionários.</p>";
        }
    }


    function ordenarPorData(lista) {
        return lista.sort((a, b) => {
            const dataA = a?.last_update ? new Date(a.last_update).getTime() : 0;
            const dataB = b?.last_update ? new Date(b.last_update).getTime() : 0;
            return dataB - dataA; // mais recente primeiro
        });
    }
    function diasEntre(dateStr) {
        if (!dateStr) return null;
        const d = new Date(dateStr);
        const diff = Date.now() - d.getTime();
        return Math.floor(diff / (1000 * 60 * 60 * 24));
    }

    async function buscarPessoasRelacionadas(cnpjLimpo, forcarBusca = false) {
        const listaSocios = document.getElementById("lista-socios");
        const listaEmpregados = document.getElementById("lista-empregados");

        listaSocios.innerHTML = "<p class='text-gray-500'>Carregando sócios...</p>";
        listaEmpregados.innerHTML = "<p class='text-gray-500'>Carregando funcionários...</p>";

        try {
            let dados;

            // 🔎 Primeiro tenta buscar no banco salvo
            if (!forcarBusca) {
                const respLocal = await fetch(`/bigdata-pessoas?cnpj=${cnpjLimpo}`);
                if (respLocal.ok) {
                    dados = await respLocal.json();
                    if ((dados?.socios?.length || 0) > 0 || (dados?.funcionarios?.length || 0) > 0) {
                        console.log("📂 Dados carregados do banco bigdata_pessoas");
                    } else {
                        console.log("⚠️ Nenhum dado no banco, BigData só será chamado manualmente");
                        return; // Sai da função
                    }
                } else {
                    console.warn("⚠️ Erro ao buscar no banco, BigData só será chamado manualmente");
                    return; // Sai da função
                }
            }

            // 🌐 Busca no BigData se forçar
            if (forcarBusca) {
                const response = await fetch("/bigdata-telefones", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ cnpj: cnpjLimpo })
                });

                if (!response.ok) throw new Error("Erro na consulta ao BigData");

                dados = await response.json();

                // 🔄 Salva no backend
                const todasPessoas = [
                    ...(dados?.socios || []).map(p => ({ ...p, cargo: "Sócio", tipoPessoa: "socio" })),
                    ...(dados?.funcionarios || []).map(p => ({ ...p, cargo: "Funcionário", tipoPessoa: "funcionario" }))
                ];

                await fetch("/salvar-bigdata-pessoas", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        cnpj: cnpjLimpo,
                        empresa: document.getElementById("painel-razao").textContent,
                        pessoas: todasPessoas
                    })
                });

                console.log("✅ Pessoas salvas em bigdata_pessoas:", todasPessoas.length);
            }
            // ✅ Ordena por last_update antes de renderizar
            const socios = ordenarPorData(dados?.socios || []);
            const funcionarios = ordenarPorData(dados?.funcionarios || []);

            // Renderização
            listaSocios.innerHTML = socios.length
                ? socios.map((p, idx) => renderPessoaHTML(p)).join("")
                : "<p class='text-gray-500'>Nenhum telefone encontrado para sócios.</p>";

            listaEmpregados.innerHTML = funcionarios.length
                ? funcionarios.map((p, idx) => renderPessoaHTML(p)).join("")
                : "<p class='text-gray-500'>Nenhum telefone encontrado para funcionários.</p>";

        } catch (e) {
            console.error("❌ Erro ao buscar ou salvar pessoas:", e);
            listaSocios.innerHTML = "<p class='text-red-500'>Erro ao carregar dados de sócios.</p>";
            listaEmpregados.innerHTML = "<p class='text-red-500'>Erro ao carregar dados de funcionários.</p>";
        }
    }

    function renderPessoaHTML(pessoa) {
        const cpf = (pessoa.cpf || '').replace(/\D/g, '');

        // Extrai apenas o "MOBILE" ou "WORK"
        let tipoFormatado = "—";
        if (pessoa.tipo) {
            const partes = pessoa.tipo.split("-");
            tipoFormatado = partes[partes.length - 1].trim().toUpperCase(); 
        }

        return `
            <div class="mb-3 border-b pb-2">
                <div class="flex items-center gap-2">
                    <input type="checkbox" class="checkbox-pessoa"
                        data-nome="${pessoa.nome}"
                        data-cargo="${pessoa.cargo}"
                        data-cpf="${cpf}"
                        data-numero="${pessoa.telefone || ''}"
                        data-ativo="${pessoa.ativo}"
                        data-last_update="${pessoa.last_update || ''}" />
                    <p><span class="font-semibold">${pessoa.nome}</span></p>
                </div>
                <p>
                    ${pessoa.telefone || "—"} 
                    <span class="text-sm text-gray-600">${pessoa.ativo ? "✅ Ativo" : "❌ Inativo"}</span>
                    ${pessoa.salvo ? '<span class="text-green-600 ml-1">✅ salvo</span>' : ''}
                </p>
                <p class="text-sm text-gray-600">
                    Tipo: ${tipoFormatado}
                </p>
                <p class="text-sm text-gray-600">
                    CPF: ${cpf || "—"}
                </p>
                <p class="text-sm text-gray-600">Última Atualização: ${formatarDataISO(pessoa.last_update)}</p>
            </div>
        `;
    }



        async function salvarPessoasSelecionadas() {
            const checkboxes = document.querySelectorAll(".checkbox-pessoa:checked");
            if (checkboxes.length === 0) {
                alert("Nenhuma pessoa selecionada.");
                return;
            }

            const nomeLista = document.getElementById("nomeListaPessoas").value.trim();
            if (!nomeLista) {
                alert("Informe o nome da lista.");
                return;
            }

            const razao_social = document.getElementById("painel-razao")?.textContent || "—";
            const nome_fantasia = document.getElementById("painel-nomeFantasia")?.textContent || "—";
            const divisao = document.getElementById("painel-divisao")?.textContent || "—";
            const cnpj = document.getElementById("painel-cnpj")?.textContent || "—";
            const site = document.getElementById("painel-site")?.textContent || null;
            const linkedin = document.getElementById("painel-linkedin")?.textContent || null;

            const simplesOpcao = document.getElementById("simples-opcao")?.textContent || "—";
            const simplesDataOpcao = document.getElementById("simples-data-opcao")?.textContent || "—";
            const simplesDataExclusao = document.getElementById("simples-data-exclusao")?.textContent || "—";
            const simplesOpcaoMei = document.getElementById("simples-opcao-mei")?.textContent || "—";

            const dadosFinal = Array.from(checkboxes).map(cb => {
                return {
                    nome_socio: cb.dataset.nome,
                    cargo: cb.dataset.cargo || "Sócio",
                    cpf: cb.dataset.cpf || "—",
                    numero: cb.dataset.numero || "—",
                    ativo: cb.dataset.ativo === "true",
                    last_update: cb.dataset.last_update || "—",
                    razao_social,
                    nome_fantasia,
                    divisao,
                    cnpj,
                    site,
                    linkedin,
                    simples_opcao: simplesOpcao,
                    simples_data_opcao: simplesDataOpcao,
                    simples_data_exclusao: simplesDataExclusao,
                    simples_opcao_mei: simplesOpcaoMei
                };
            });

            try {
                const res = await fetch(`${BASE_URL}/salvar-lead-pessoas`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ nome: nomeLista, dados: dadosFinal })
                });

                if (!res.ok) throw new Error("Erro ao salvar dados.");

                const resposta = await res.json();
                alert(resposta.mensagem || "Pessoas salvas com sucesso!");

                // Atualiza o Set
                for (const dado of dadosFinal) {
                    const cnpjLimpo = limparCnpj(dado.cnpj);
                    cnpjsSalvosComoPessoa.add(cnpjLimpo);
                }

                // Marca os CNPJs visíveis
                document.querySelectorAll(`#resultado-body tr`).forEach(tr => {
                    const cnpjCelula = tr.querySelector("td:first-child");
                    if (!cnpjCelula) return;

                    const cnpj = limparCnpj(cnpjCelula.textContent);
                    if (cnpjsSalvosComoPessoa.has(cnpj)) {
                        tr.classList.add("bg-green-100");
                    }
                });

                fecharModalSalvarPessoas();
                carregarMenuLateralLeadsPessoas();
            } catch (err) {
                alert("Erro ao salvar: " + err.message);
            }
        }


        function abrirModalSalvarPessoas() {
            const modal = document.getElementById("modalSalvarPessoas");
            modal.classList.remove("hidden");

            const select = document.getElementById("listaExistente");
            const input = document.getElementById("nomeListaPessoas");
            select.innerHTML = '<option value="">-- Criar nova lista --</option>';
            input.value = "";
            input.disabled = false;

            // Buscar listas existentes
            fetch(`${BASE_URL}/leads-pessoas`)
                .then(res => res.json())
                .then(listas => {
                    listas.forEach(lista => {
                        const option = document.createElement("option");
                        option.value = lista.nome;
                        option.textContent = lista.nome;
                        select.appendChild(option);
                    });
                })
                .catch(err => console.error("Erro ao carregar listas de pessoas:", err));
        }

        function onSelecionarListaPessoasExistente() {
            const select = document.getElementById("listaExistente");
            const input = document.getElementById("nomeListaPessoas");
            if (select.value) {
                input.value = select.value;
                input.disabled = true;
            } else {
                input.value = "";
                input.disabled = false;
            }
        }

        function fecharModalSalvarPessoas() {
            document.getElementById("modalSalvarPessoas").classList.add("hidden");
        }

        function fecharPainelDetalhes() {
            document.getElementById("painelDetalhesEmpresa").classList.add("translate-x-full");
        }

    function atualizarTituloCinematico(tipo) {
        const titulo = document.getElementById("titulo-cinematico");
        if (!titulo) return;

        if (tipo === "pessoa") {
            titulo.textContent = "📋 Consultas Salvas Pessoas";
        } else {
            titulo.textContent = "📋 Consultas Salvas Empresas";
        }
    }

    let ordenacaoAtual = { campo: "cnpj", ordem: "asc" };
    let leadAtualId = null;

    function atualizarCabecalhoEmpresas() {
        const isCnpj = ordenacaoAtual.campo === "cnpj";
        const icone = isCnpj
            ? ordenacaoAtual.ordem === "asc"
                ? `<svg xmlns="http://www.w3.org/2000/svg" class="inline w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>`
                : `<svg xmlns="http://www.w3.org/2000/svg" class="inline w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="m4.5 15.75 7.5-7.5 7.5 7.5" /></svg>`
            : "";

        document.getElementById("resultado-head").innerHTML = `
            <tr class="border-b">
                <th class="sortable" data-campo="cnpj">CNPJ ${icone}</th>
                <th class="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Empresa</th>
                <th class="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Capital Social</th>
                <th class="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Município</th>
                <th class="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Telefone</th>
                <th class="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">E-mail</th>
            </tr>
        `;

        // Só permite ordenação clicando em "CNPJ"
        document.querySelectorAll(".sortable").forEach(th => {
            th.classList.add("px-6", "py-3", "text-left", "text-xs", "font-medium", "text-gray-500", "uppercase", "tracking-wider", "cursor-pointer");
            th.onclick = () => {
                const campo = th.getAttribute("data-campo");
                if (campo !== "cnpj") return; // restringe a ordenação apenas ao CNPJ

                if (ordenacaoAtual.campo === campo) {
                    ordenacaoAtual.ordem = ordenacaoAtual.ordem === "asc" ? "desc" : "asc";
                } else {
                    ordenacaoAtual = { campo, ordem: "asc" };
                }

                // Atualiza o cabeçalho para mostrar o ícone certo
                atualizarCabecalhoEmpresas();
                if (leadAtualId && estadosPaginacao[leadAtualId]?.lead) {
                    renderizarLead(estadosPaginacao[leadAtualId].lead);
                }
            };
        });
    }


    function atualizarCabecalhoPessoas() {
        document.getElementById("resultado-head").innerHTML = `
            <tr class="border-b">
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CNPJ</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Empresa</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Capital Social</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Data de Fundação</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Opção Simples</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Data inicio simples</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Data fim simples</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Opção MEI</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Data inicio MEI</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Data fim MEI</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Divisão</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SubClasse CNAE</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Município</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome Sócio</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cargo</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Site</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">LinkedIn Empresa</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Telefone</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Telefone Socio</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">E-mail</th>
            </tr>
        `;
    }

    // Exporta empresas para Excel
    async function exportarEmpresasParaExcel(leadId) {
        const estado = estadosPaginacao[leadId];
        if (!estado) return;

        const empresas = estado.lead.dados;
        if (!empresas || empresas.length === 0) {
            alert("Nenhuma empresa para exportar.");
            return;
        }

        const dados = empresas.map(emp => ({
            "CNPJ": emp.cnpj || "-",
            "Razão Social": emp.razao_social || "-",
            "Nome Fantasia": emp.nome_fantasia || "-",
            "Capital Social": emp.capital_social || "-",
            "Município": emp.municipio || "-",
            "Telefone": emp.telefone || "-",
            "Telefone 2": emp.telefone2 || "-",
            "E-mail": emp.email || "-"
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(dados);
        XLSX.utils.book_append_sheet(wb, ws, "Leads Empresas");

        const nomeArquivo = leadId === "TODAS_EMPRESAS" ? "todas_empresas.xlsx" : `lead_empresas_${leadId}.xlsx`;
        XLSX.writeFile(wb, nomeArquivo);
    }

    // Exporta pessoas para Excel
    async function exportarPessoasParaExcel(leadId) {
        const estado = estadosPaginacaoPessoas[leadId];
        if (!estado) return;

        const pessoas = estado.lead.dados;
        if (!pessoas || pessoas.length === 0) {
            alert("Nenhuma pessoa para exportar.");
            return;
        }

        const dados = [];

        for (const pessoa of pessoas) {
            const empresa = mapaEmpresasPorCnpj[pessoa.cnpj] || {};
            let simples = {};

            try {
                const cnpjLimpo = pessoa.cnpj.replace(/\D/g, "");
                const res = await fetch(`/simples?cnpj=${cnpjLimpo}`);
                if (res.ok) {
                    simples = await res.json();
                }
            } catch (err) {
                // Se falhar, simples permanece {}
            }

            dados.push({
                "CNPJ": pessoa.cnpj || "-",
                "Razão Social": pessoa.razao_social || empresa.razao_social || "-",
                "Nome Fantasia": pessoa.nome_fantasia || empresa.nome_fantasia || "-",
                "Capital Social": pessoa.capital_social || empresa.capital_social || "-",
                "Data Fundação": (empresa.data_inicio_atividade),
                "Opção Simples": simples.opcao_simples === "S" ? "Sim" : simples.opcao_simples === "N" ? "Não" : "-",
                "Data Início Simples": formatarData(simples.data_opcao_simples),
                "Data Fim Simples": formatarData(simples.data_exclusao_simples),
                "Opção MEI": simples.opcao_mei === "S" ? "Sim" : simples.opcao_mei === "N" ? "Não" : "-",
                "Data Início MEI": formatarData(simples.data_opcao_mei),
                "Data Fim MEI": formatarData(simples.data_exclusao_mei),
                "Divisão": pessoa.divisao || empresa.divisao || "-",
                "SubClasse CNAE": empresa.cnaeDescricao || "-",
                "Município": pessoa.municipio || empresa.municipio || "-",
                "Sócio": pessoa.nome_socio || "-",
                "Cargo": pessoa.cargo || "-",
                "Site": pessoa.site || "-",
                "LinkedIn": pessoa.linkedin || "-",
                "Telefone": empresa.telefone || "-",
                "Telefone 2": empresa.telefone2 || "-",
                "Telefone Sócio": pessoa.numero || "-",
                "Email": empresa.email || "-"
            });
        }

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(dados);
        XLSX.utils.book_append_sheet(wb, ws, "Leads Pessoas");

        const nomeArquivo = leadId === "TODAS_PESSOAS" ? "todas_pessoas.xlsx" : `lead_pessoas_${leadId}.xlsx`;
        XLSX.writeFile(wb, nomeArquivo);
    }
