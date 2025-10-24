            const BASE_URL = window.location.origin;
            let paginaAtual = 1;
            let ultimaPagina = 1;
            const mostrarTotal = true;


            window.onload = async () => {
                // Carrega dados estáticos
                await carregarUFs();
                await carregarSecoesCNAE();

                // Sempre adiciona os listeners, mesmo sem filtros salvos
                document.getElementById("uf").addEventListener("change", carregarMunicipios);
                document.getElementById("secaoSelect").addEventListener("change", carregarDivisoesPorSecao);
                document.getElementById("divisaoSelect").addEventListener("change", carregarGruposPorDivisao);
                document.getElementById("grupoSelect").addEventListener("change", carregarClassesPorGrupo);
                document.getElementById("classeSelect").addEventListener("change", carregarSubclassesPorClasse);
                document.getElementById("qtdPorPagina").value = "25";


                // Listener para o botão "Consultar"
                document.getElementById("consultarBtn").addEventListener("click", () => {
                    paginaAtual = 1;
                    document.getElementById("resultado-body").innerHTML = "";
                    consultar(true);
                });
            };
    
            function atualizarContadorSelecionados() {
                const selecionados = document.querySelectorAll(".selecionar-checkbox:checked").length;
                document.getElementById("contadorSelecionados").textContent = selecionados;
            }

            async function abrirModalSalvarLead() {
                const modal = document.getElementById("modalSalvarLead");
                modal.classList.remove("hidden");

                const select = document.getElementById("listaExistente");
                select.innerHTML = '<option value="">-- Criar nova lista --</option>';

                try {
                    const res = await fetch(`${BASE_URL}/leads`);
                    const listas = await res.json();
                    listas.forEach(lista => {
                        const option = document.createElement("option");
                        option.value = lista.nome;
                        option.textContent = lista.nome;
                        select.appendChild(option);
                    });
                } catch (err) {
                    console.error("Erro ao carregar listas:", err);
                }
            }

            function onSelecionarListaExistente() {
                const select = document.getElementById("listaExistente");
                const input = document.getElementById("nomeLead");
                if (select.value) {
                    input.value = select.value;
                    input.disabled = true;
                } else {
                    input.value = "";
                    input.disabled = false;
                }
            }

            function fecharModalSalvarLead() {
                const modal = document.getElementById("modalSalvarLead");
                modal.classList.add("hidden");
            }

            async function salvarConsulta() {
                const nomeLead = document.getElementById("nomeLead").value.trim();
                if (!nomeLead) {
                    alert("Por favor, informe um nome para a lista.");
                    return;
                }

                const limite = parseInt(document.getElementById("qtdPorPagina").value) || 25;

                const linhas = document.querySelectorAll("#resultado-body tr:not(.invisible)");
                const linhasSelecionadas = Array.from(linhas).filter(tr => {
                    const checkbox = tr.querySelector("input.selecionar-checkbox");
                    return checkbox && checkbox.checked;
                });

                if (linhasSelecionadas.length === 0) {
                    alert("Nenhuma linha selecionada para salvar.");
                    return;
                }

                const dados = linhasSelecionadas.slice(0, limite).map(tr => {
                    const tds = tr.querySelectorAll("td");
                    return {
                        cnpj: tds[1]?.innerText || "—",
                        razao_social: tds[2]?.innerText || "—",
                        nome_fantasia: tds[3]?.innerText || "—",
                        nome_exibido: tds[4]?.innerText || "—",
                        capital_social: tds[5]?.innerText || "—",
                        municipio: tds[6]?.innerText || "—",
                        secao_descricao: tds[7]?.innerText || "—",
                        grupo_descricao: tds[8]?.innerText || "—",
                        classe_cnae: tds[9]?.innerText || "—",
                        cnae_principal_codigo: tds[10]?.innerText || "—",
                        cnaeDescricao: tds[11]?.innerText || "—",
                        divisao: tds[12]?.innerText || "—",
                        cnaeSecundarios: tds[13]?.innerHTML?.split("<br>") || ["—"],
                        data_inicio_atividade: tds[14]?.innerText || "—",
                        tipo_unidade: tds[15]?.innerText || "—",
                        situacao: tds[16]?.innerText || "—",
                        telefone: tds[17]?.innerText || "—",
                        telefone2: tds[18]?.innerText || "—",
                        email: tds[19]?.innerText || "—"
                    };
                });

                try {
                    const res = await fetch(`${BASE_URL}/salvar-lead`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ nome: nomeLead, dados })
                    });

                    if (!res.ok) throw new Error("Erro ao salvar os dados.");
                    alert("Consulta salva com sucesso!");
                    fecharModalSalvarLead();
                } catch (err) {
                    alert("Erro ao salvar consulta: " + err.message);
                }
            }




            // --------------------- UFs e Municípios ---------------------
            async function carregarUFs() {
                try {
                    const res = await fetch(`${BASE_URL}/ufs`);
                    const ufs = await res.json();
                    const select = document.getElementById("uf");
                    select.innerHTML = `<option value="">Selecione a UF</option>` +
                        ufs.map(uf => `<option value="${uf}">${uf}</option>`).join('');
                } catch (error) {
                    console.error("Erro ao carregar UFs:", error);
                }
            }

            async function carregarMunicipios() {
                const uf = document.getElementById("uf").value;
                const select = document.getElementById("municipio");

                resetSelect("municipio");

                if (!uf) {
                    select.disabled = true;
                    return;
                }

                try {
                    const res = await fetch(`${BASE_URL}/municipios?uf=${uf}`);
                    const municipios = await res.json();
                    select.innerHTML = `<option value="">Selecione o município</option>` +
                        municipios.map(m => `<option value="${m.codigo_municipio}">${m.municipio_descricao}</option>`).join('');
                    select.disabled = false;
                } catch (error) {
                    console.error("Erro ao carregar municípios:", error);
                    select.disabled = true;
                }
            }

            // --------------------- CNAE em cascata ---------------------
            async function carregarSecoesCNAE() {
                try {
                    const res = await fetch(`${BASE_URL}/grupo_cnae/secoes`);
                    const secoes = await res.json();
                    const select = document.getElementById("secaoSelect");
                    select.innerHTML = `<option value="">Selecione a Seção</option>` +
                        secoes.map(s => `<option value="${s.secao_codigo}">${s.secao_codigo} - ${s.secao_descricao}</option>`).join('');
                } catch (err) {
                    console.error("Erro ao carregar seções:", err);
                }
            }

            async function carregarDivisoesPorSecao() {
                const secao = document.getElementById("secaoSelect").value;
                resetSelect("divisaoSelect");
                resetSelect("grupoSelect");
                resetSelect("classeSelect");
                resetSelect("cnaeSelect");

                if (!secao) return;

                try {
                    const res = await fetch(`${BASE_URL}/grupo_cnae/divisoes?secao_codigo=${secao}`);
                    const divisoes = await res.json();
                    const select = document.getElementById("divisaoSelect");
                    select.innerHTML = `<option value="">Selecione a Divisão</option>` +
                        divisoes.map(d => `<option value="${d.divisao_codigo}">${d.divisao_codigo} - ${d.divisao_descricao}</option>`).join('');
                    select.disabled = false;
                } catch (err) {
                    console.error("Erro ao carregar divisões:", err);
                }
            }

            async function carregarGruposPorDivisao() {
                const divisao = document.getElementById("divisaoSelect").value;
                resetSelect("grupoSelect");
                resetSelect("classeSelect");
                resetSelect("cnaeSelect");

                if (!divisao) return;

                try {
                    const res = await fetch(`${BASE_URL}/grupo_cnae/grupos?divisao_codigo=${divisao}`);
                    const grupos = await res.json();
                    const select = document.getElementById("grupoSelect");
                    select.innerHTML = `<option value="">Selecione o Grupo</option>` +
                        grupos.map(g => `<option value="${g.grupo_codigo}">${g.grupo_codigo} - ${g.grupo_descricao}</option>`).join('');
                    select.disabled = false;
                } catch (err) {
                    console.error("Erro ao carregar grupos:", err);
                }
            }

            async function carregarClassesPorGrupo() {
                const grupo = document.getElementById("grupoSelect").value;
                resetSelect("classeSelect");
                resetSelect("cnaeSelect");

                if (!grupo) return;

                try {
                    const res = await fetch(`${BASE_URL}/grupo_cnae/classes?grupo_codigo=${grupo}`);
                    const classes = await res.json();
                    const select = document.getElementById("classeSelect");
                    select.innerHTML = `<option value="">Selecione a Classe</option>` +
                        classes.map(c => `<option value="${c.classe_codigo}">${c.classe_codigo} - ${c.classe_descricao}</option>`).join('');
                    select.disabled = false;
                } catch (err) {
                    console.error("Erro ao carregar classes:", err);
                }
            }

            async function carregarSubclassesPorClasse() {
                const classe = document.getElementById("classeSelect").value;
                resetSelect("cnaeSelect");

                if (!classe) return;

                try {
                    const res = await fetch(`${BASE_URL}/grupo_cnae/cnaes?classe_codigo=${classe}`);
                    const cnaes = await res.json();
                    const select = document.getElementById("cnaeSelect");
                    select.innerHTML = `<option value="">Selecione o CNAE</option>` +
                        cnaes.map(c => `<option value="${c.cnae_fiscal_principal}">${c.cnae_rotulo}</option>`).join('');
                    select.disabled = false;
                } catch (err) {
                    console.error("Erro ao carregar CNAEs:", err);
                }
            }

            // --------------------- Utilitário ---------------------
            function resetSelect(id) {
                const select = document.getElementById(id);
                select.innerHTML = `<option value="">Selecione</option>`;
                select.disabled = true;
            }

            // --------------------- Consulta e Paginação ---------------------
            function mudarPagina(direcao) {
                const novaPagina = paginaAtual + direcao;
                if (novaPagina < 1 || novaPagina > ultimaPagina) return;
                paginaAtual = novaPagina;
                consultar();

                const selectAllCheckbox = document.getElementById('selectAll');
                if (selectAllCheckbox) {
                    selectAllCheckbox.checked = false;
                }
                document.querySelectorAll('.checkbox-item').forEach(cb => {
                    cb.checked = false;
                });

            }

            function exportarParaCSV() {
                const linhas = [["CNPJ", "Empresa", "Capital Social", "Classe", "CNAE", "Tipo Unidade", "Situação", "Telefone", "E-mail"]];
                const tbody = document.getElementById("resultado-body");

                for (const row of tbody.querySelectorAll("tr")) {
                    const colunas = Array.from(row.querySelectorAll("td")).map(td => {
                        return '"' + td.innerText.replace(/"/g, '""') + '"'; // Escapa aspas
                    });
                    linhas.push(colunas);
                }

                const csvContent = linhas.map(e => e.join(",")).join("\n");
                const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });

                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.setAttribute("download", "consulta_empresas.csv");
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }


            function selecionarTodos(checkbox) {
                const checkboxes = document.querySelectorAll(".selecionar-checkbox");
                checkboxes.forEach(cb => cb.checked = checkbox.checked);

                atualizarContadorSelecionados();
            }


            function limparFiltros() {
            // Resetar selects padrão
            document.getElementById("uf").value = "";
            document.getElementById("municipio").value = "";
            document.getElementById("secaoSelect").value = "";
            document.getElementById("divisaoSelect").value = "";
            document.getElementById("grupoSelect").value = "";
            document.getElementById("classeSelect").value = "";
            document.getElementById("cnaeSelect").value = "";
            document.getElementById("situacao").value = "";
            document.getElementById("faixaCapitalMin").value = "";
            document.getElementById("faixaCapitalMax").value = "";
            document.getElementById("tipoUnidade").value = "";

            // Resetar selects em cascata
            resetSelect("municipio");
            resetSelect("divisaoSelect");
            resetSelect("grupoSelect");
            resetSelect("classeSelect");
            resetSelect("cnaeSelect");

            // Recarregar os valores padrão de UF e Seções
            carregarUFs();
            carregarSecoesCNAE();

            // Limpar a tabela de resultados
            document.getElementById("resultado-body").innerHTML = "";

            // Esconder paginação e botão salvar
            document.getElementById("paginacao-container").classList.add("hidden");
            document.getElementById("btnSalvarConsulta").classList.add("hidden");       
            document.getElementById("colunaSelecionar").classList.add("hidden");

            // Resetar paginação
            paginaAtual = 1;
            ultimaPagina = 1;

            // Limpar contagem no topo e rodapé
            const paginacaoTop = document.getElementById("paginacao-top");
            const paginacaoBase = document.getElementById("paginacao");
            if (paginacaoTop) paginacaoTop.textContent = "";
            if (paginacaoBase) paginacaoBase.textContent = "";
            }


            async function consultar() {
                
                const uf = document.getElementById("uf").value.trim();
                if (!uf) {
                    alert("UF é obrigatória para fazer a consulta.");
                    return;
                }
                const municipio = document.getElementById("municipio").value.trim();
                const secao = document.getElementById("secaoSelect").value.trim();
                const divisao = document.getElementById("divisaoSelect").value.trim();
                const grupo = document.getElementById("grupoSelect").value.trim();
                const classe = document.getElementById("classeSelect").value.trim();
                const subclasse = document.getElementById("cnaeSelect").value.trim();
                const situacao = document.getElementById("situacao").value;
                const faixaMin = document.getElementById("faixaCapitalMin").value;
                const faixaMax = document.getElementById("faixaCapitalMax").value;

                if (faixaMin && faixaMax) {
                    const min = parseFloat(faixaMin);
                    const max = parseFloat(faixaMax);

                    if (min > max) {
                        alert("O capital mínimo não pode ser maior que o capital máximo.");
                        return;
                    }

                    if (max < min) {
                        alert("O capital máximo não pode ser menor que o capital mínimo.");
                        return;
                    }
                }

                const tipoUnidade = document.getElementById("tipoUnidade").value;
                const limite = document.getElementById("qtdPorPagina").value;
                

                const params = [];
                if (uf) params.push(`uf=${encodeURIComponent(uf)}`);
                if (municipio) params.push(`municipio=${encodeURIComponent(municipio)}`);
                if (secao) params.push(`secao=${encodeURIComponent(secao)}`);
                if (divisao) params.push(`divisao=${encodeURIComponent(divisao)}`);
                if (grupo) params.push(`grupo=${encodeURIComponent(grupo)}`);
                if (classe) params.push(`classe=${encodeURIComponent(classe)}`);
                if (subclasse) params.push(`subclasse=${encodeURIComponent(subclasse)}`);
                if (situacao) params.push(`situacao=${encodeURIComponent(situacao)}`);
                if (faixaMin) params.push(`capital_min=${encodeURIComponent(faixaMin)}`);
                if (faixaMax) params.push(`capital_max=${encodeURIComponent(faixaMax)}`);
                if (tipoUnidade) params.push(`tipo_unidade=${encodeURIComponent(tipoUnidade)}`);
                params.push(`page=${paginaAtual}`);
                params.push(`limite=${limite}`);


                const loading = document.getElementById("loading");
                const tbody = document.getElementById("resultado-body");
                const paginacaoContainer = document.getElementById("paginacao-container");

                loading.classList.remove("hidden");
                tbody.innerHTML = "";

                try {
                    const res = await fetch(`${BASE_URL}/filtro?${params.join("&")}`);
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const data = await res.json();

                    paginaAtual = data.pagina_atual || 1;  
                    ultimaPagina = data.ultima_pagina || 1;
                    const total = data.total || 0;
                    const porPagina = parseInt(limite); // ajuste se o seu backend retornar outro valor
                    const inicio = (paginaAtual - 1) * porPagina + 1;
                    const fim = Math.min(paginaAtual * porPagina, total);

                    
                    document.getElementById("paginacao").textContent =
                        `${inicio}–${fim} de ${total.toLocaleString("pt-BR")} empresas`;
                    
                    document.getElementById("paginacao-top").textContent =
                        `${inicio}–${fim} de ${total.toLocaleString("pt-BR")} empresas`;    

                    if (!data.resultados || data.resultados.length === 0) {
                        tbody.innerHTML = `
                            <tr>
                                <td colspan="17" class="px-4 py-2 text-center text-gray-500">Nenhum resultado encontrado</td>
                            </tr>`;
                        paginacaoContainer.classList.add("hidden");
                        document.getElementById("btnSalvarConsulta").classList.add("hidden");
                        document.getElementById("colunaSelecionar").classList.add("hidden");
                    } else {
                        data.resultados.forEach(resultado => {
                            const cnpj = resultado.cnpj_completo || '—';
                            const razao = resultado.razao_social || "—";
                            const fantasia = resultado.nome_fantasia || "—";
                            const nomeExibido = resultado.nome_empresa || "—";
                            const capital = resultado.capital_social || '—';
                            const municipio = resultado.municipio || '—';
                            const tipo = resultado.tipo_unidade || '—';
                            const telefone = resultado.telefone1 || '—';
                            const telefone2 = resultado.telefone2 || '—';
                            const email = resultado.email || '—';
                            const situacao = resultado.situacao_cadastral || '—';
                            const classeDescricao = resultado.classe_cnae || '—';
                            const cnaeDescricao = resultado.cnae_principal_descricao || '—';
                            const divisao = resultado.divisao_descricao || '—'; 
                            const cnaesSecundarios = resultado.cnaes_secundarios?.join("<br>") || "—";
                            const grupoDescricao = resultado.grupo_descricao || '—';
                            const secaoDescricao = resultado.secao_descricao || '—';
                            const dataFundacao = resultado.data_inicio_atividade|| '—';
                            const cnaeCodigo = resultado.cnae_principal_codigo || '—';



                            let nomeFormatado = nomeExibido;
                            const pos = nomeFormatado.indexOf(' ', 50);
                            if (pos !== -1) {
                                nomeFormatado = nomeFormatado.slice(0, pos) + '<br>' + nomeFormatado.slice(pos + 1);
                            }


                            const tr = document.createElement("tr");
                            tr.innerHTML = `
                                <td class="px-3 py-2 border-b">
                                    <input type="checkbox" class="selecionar-checkbox" onchange="atualizarContadorSelecionados()">
                                </td>
                                <td class="px-3 py-2 whitespace-nowrap border-b">${cnpj}</td>
                                <td class="px-3 py-2 break-words border-b">${razao}</td>
                                <td class="px-3 py-2 break-words border-b hidden">${fantasia}</td>
                                <td class="px-3 py-2 break-words border-b hidden">${nomeFormatado}</td>
                                <td class="px-3 py-2 whitespace-nowrap border-b">${capital}</td>
                                <td class="px-3 py-2 whitespace-nowrap border-b hidden">${municipio}</td>
                                <td class="px-3 py-2 break-words border-b hidden">${secaoDescricao}</td>
                                <td class="px-3 py-2 break-words border-b hidden">${grupoDescricao}</td>
                                <td class="px-3 py-2 break-words border-b">${classeDescricao}</td>
                                <td class="px-3 py-2 break-words border-b hidden">${cnaeCodigo}</td>
                                <td class="px-3 py-2 break-words border-b">${cnaeDescricao}</td>
                                <td class="px-3 py-2 whitespace-nowrap border-b hidden">${divisao}</td>
                                <td class="px-3 py-2 break-words border-b hidden">${cnaesSecundarios}</td>
                                <td class="px-3 py-2 break-words border-b hidden">${dataFundacao}</td>
                                <td class="px-3 py-2 whitespace-nowrap border-b hidden">${tipo}</td>
                                <td class="px-3 py-2 border-b hidden">${situacao}</td>
                                <td class="px-3 py-2 whitespace-nowrap border-b hidden">${telefone}</td>
                                <td class="px-3 py-2 whitespace-nowrap border-b hidden">${telefone2}</td>
                                <td class="px-3 py-2 break-all text-sm text-gray-600 border-b hidden">${email}</td>`;
                            tbody.appendChild(tr);
                        });

                        paginacaoContainer.classList.remove("hidden");
                        document.getElementById("btnSalvarConsulta").classList.remove("hidden");
                        document.getElementById("colunaSelecionar").classList.remove("hidden");
                    }

                    document.getElementById("anterior").disabled = paginaAtual === 1;
                    document.getElementById("proximo").disabled = paginaAtual === ultimaPagina;
                    atualizarContadorSelecionados();
                    document.getElementById("qtdPorPagina").addEventListener("change", () => {
                        paginaAtual = 1;  // reseta para primeira página
                        consultar();      // refaz a consulta com nova quantidade
                    });

                    console.log("URL da consulta:", `${BASE_URL}/filtro?${params.join("&")}`);


                } catch (err) {
                    alert("Erro ao consultar API: " + err.message);
                    console.error(err);
                } 
                finally {
                    loading.classList.add("hidden");
                }
            }
