from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pymongo import MongoClient
from typing import Optional
from re import sub
import re, urllib.parse, requests
from fastapi import Request,Body
from pydantic import BaseModel
from datetime import datetime
from fastapi.encoders import jsonable_encoder
from bson import ObjectId
from fastapi import HTTPException
from fastapi import APIRouter
import copy
import requests
from datetime import datetime, timezone
from collections import defaultdict
from typing import List, Optional
from typing import List, Dict
from scraper import enriquecer_empresa_por_email
import os
import httpx
from dotenv import load_dotenv
from twilio.rest import Client


app = FastAPI()
load_dotenv()
# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Conexão MongoDB
client = MongoClient("mongodb://localhost:27017/")
db = client["local"]
colecao_cnpjs = db["filtro_cnpj"]
colecao_municipios = db["municipio"]
colecao_cnaes = db["cnaes"]
colecao_grupo_cnae = db["grupo_cnae"]
colecao_empresas = db["empresa"]
colecao_leads = db["lead"]
colecao_leadsP = db["lead_pessoas"]
colecao_socios = db["socios"]
colecao_qualificacao = db["qualificacao_socio"]
colecao_simples = db["simples"]
colecao_Bigdata = db["bigdata_Pessoas"]
colecao_buscas = db["bigdata_buscas"]
colecao_site = db["site_local"]

# Índices
colecao_cnpjs.create_index([("uf", 1), ("codigo_municipio", 1), ("cnae_fiscal_principal", 1)])
colecao_empresas.create_index("cnpj_basico")

# Utilitário: formatar CNPJ
def formatar_cnpj(basico, ordem, dv):   
    cnpj = f"{basico.zfill(8)}{ordem.zfill(4)}{dv.zfill(2)}"
    return f"{cnpj[:2]}.{cnpj[2:5]}.{cnpj[5:8]}/{cnpj[8:12]}-{cnpj[12:14]}"

@app.get("/filtro")
def filtrar(
    uf: str,
    municipio: Optional[str] = "",
    secao: Optional[str] = "",
    divisao: Optional[str] = "",
    grupo: Optional[str] = "",
    classe: Optional[str] = "",
    subclasse: Optional[str] = "",
    cnae: Optional[str] = "",
    situacao: Optional[str] = "",
    capital_min: Optional[float] = None,
    capital_max: Optional[float] = None,
    tipo_unidade: Optional[str] = "",
    porte_empresa: Optional[str] = "",
    page: int = Query(1, ge=1),
    limite: int = Query(25, ge=1, le=250)  # NOVO: permite de 1 até 250 por página
):
    skip = (page - 1) * limite

    # --- Monta filtro CNAE ---
    filtro_cnae = {}
    if secao: filtro_cnae["secao_codigo"] = secao
    if divisao: filtro_cnae["divisao_codigo"] = divisao
    if grupo: filtro_cnae["grupo_codigo"] = grupo
    if classe: filtro_cnae["classe_codigo"] = classe
    if subclasse: filtro_cnae["subclasse_codigo"] = subclasse

    cnaes_filtrados = []
    if cnae:
        cnaes_filtrados = [sub(r"[-/]", "", cnae)]
    elif filtro_cnae:
        cnaes_docs = colecao_grupo_cnae.find(filtro_cnae, {"subclasse_codigo": 1})
        cnaes_filtrados = list({
            sub(r"[-/]", "", doc["subclasse_codigo"])
            for doc in cnaes_docs if "subclasse_codigo" in doc
        })

    # --- Monta filtro principal ---
    match_query = {}
    if uf: match_query["uf"] = uf.upper()
    if municipio: match_query["codigo_municipio"] = municipio.zfill(4)
    if situacao: match_query["situacao_cadastral"] = situacao
    if tipo_unidade in {"1", "2"}:
        match_query["matriz_filial"] = tipo_unidade
    if cnaes_filtrados:
        match_query["cnae_fiscal_principal"] = {"$in": cnaes_filtrados}

    # --- Pipeline base ---
    pipeline = [
        {"$match": match_query},
         {
        "$lookup": {
            "from": "filtro_cnpj",
            "localField": "cnpj_basico",
            "foreignField": "cnpj_basico",
            "as": "fantasia_info"
        }
        },
        {
        "$unwind": {
                "path": "$fantasia_info",
                "preserveNullAndEmptyArrays": True
            }
        },
        {
            "$lookup": {
            "from": "empresa",
            "localField": "cnpj_basico",
            "foreignField": "cnpj_basico",
            "as": "empresa_info"
            }
        },
        {
        "$unwind": {
            "path": "$empresa_info","preserveNullAndEmptyArrays": True}},

        {"$lookup": {
            "from": "grupo_cnae",
            "localField": "cnae_fiscal_principal",
            "foreignField": "subclasse_codigo",
            "as": "cnae_info"
        }},
        {"$unwind": {"path": "$cnae_info", "preserveNullAndEmptyArrays": True}},
        
        {
        "$lookup": {
            "from": "grupo_cnae",
            "let": { "secundaria": "$cnae_fiscal_secundaria" },
            "pipeline": [
                { "$match": {
                    "$expr": { "$eq": [ "$subclasse_codigo", { "$toString": "$$secundaria" } ] }
                }},{ "$limit": 1 }  
            ],
            "as": "cnaes_secundarios_info"
        }
    },

        {"$lookup": {
            "from": "municipio", 
            "localField": "codigo_municipio",
            "foreignField": "codigo_municipio",
            "as": "municipio_info"
                
        }},
        {"$unwind": { "path": "$municipio_info","preserveNullAndEmptyArrays": True}}
    ]
    # --- Filtro porte empresa ---
    if porte_empresa:
            pipeline.append({
                "$match": {"empresa_info.porte_empresa": porte_empresa}
            }),

    # --- Filtro capital social (min e max) ---
    if capital_min is not None or capital_max is not None:
        # Transforma a string "20.000,00" → "20000.00" → float
        pipeline.append({
            "$addFields": {
                "capital_float": {
                    "$toDouble": {
                        "$replaceAll": {
                            "input": {
                                "$replaceAll": {
                                    "input": {"$ifNull": ["$empresa_info.capital_social", "0,00"]},
                                    "find": ".",
                                    "replacement": ""  # remove milhar
                                }
                            },
                            "find": ",",
                            "replacement": "."  # troca decimal
                        }
                    }
                }
            }
        })

        # Cria o filtro numérico
        faixa = {}
        if capital_min is not None:
            faixa["$gte"] = float(capital_min)
        if capital_max is not None:
            faixa["$lte"] = float(capital_max)

        pipeline.append({
            "$match": {"capital_float": faixa}
        })

    # --- Cópia do pipeline para contagem total ---
    pipeline_total = copy.deepcopy(pipeline)
    pipeline_total += [
        {
            "$group": {
                "_id": {
                    "cnpj_basico": "$cnpj_basico",
                    "cnpj_ordem": "$cnpj_ordem",
                    "cnpj_dv": "$cnpj_dv"
                },
                "doc": { "$first": "$$ROOT" }
            }
        },
        { "$count": "total" }
    ]
    contagem = list(colecao_cnpjs.aggregate(pipeline_total))
    total = contagem[0]["total"] if contagem else 0

    # --- Adiciona paginação e projeção ---
    pipeline += [
        {
        "$group": {
            "_id": {
                "cnpj_basico": "$cnpj_basico",
                "cnpj_ordem": "$cnpj_ordem",
                "cnpj_dv": "$cnpj_dv"
            },
                "doc": { "$first": "$$ROOT" }
            }
        },
        { "$replaceRoot": { "newRoot": "$doc" } },
        {"$sort": {"cnpj_basico": 1}},
        {"$skip": skip},
        {"$limit": limite}, # NOVO: Limite de registros por página
        {"$project": {
            "_id": 0,
            "cnpj_basico": 1,
            "cnpj_ordem": 1,
            "cnpj_dv": 1,
            "matriz_filial": 1,
            "situacao_cadastral": 1,
            "ddd1": {"$ifNull": ["$ddd1", ""]},
            "telefone1": {"$ifNull": ["$telefone1", ""]},
            "ddd2": {"$ifNull": ["$ddd2", ""]},
            "telefone2": {"$ifNull": ["$telefone2", ""]},
            "email": {"$ifNull": ["$email", "—"]},
            "nome_empresa": {
                "$ifNull": [
                    {
                        "$cond": {
                            "if": {
                                "$and": [
                                    { "$ne": ["$fantasia_info.nome_fantasia", None] },
                                    { "$ne": ["$fantasia_info.nome_fantasia", ""] }
                                ]
                            },
                            "then": "$fantasia_info.nome_fantasia",
                            "else": {
                                "$cond": {
                                    "if": {
                                        "$and": [
                                            { "$ne": ["$empresa_info.razao_social", None] },
                                            { "$ne": ["$empresa_info.razao_social", ""] }
                                        ]
                                    },
                                    "then": "$empresa_info.razao_social",
                                    "else": "Desconhecida"
                                }
                            }
                        }
                    },
                    "Desconhecida"
                ]
            },
            "fantasia_info.nome_fantasia": 1,
            "empresa_info.razao_social": 1,
            "capital_social": {"$ifNull": ["$empresa_info.capital_social", "0,00"]},
            "classe_cnae": {"$ifNull": ["$cnae_info.classe_descricao", "—"]},
            "cnae_principal_descricao": {"$ifNull": ["$cnae_info.subclasse_descricao", "—"]},
            "municipio": {"$ifNull": ["$municipio_info.municipio_descricao", "—"]},
            "divisao_descricao": {"$ifNull": ["$cnae_info.divisao_descricao", "—"]},
            "secao_descricao": { "$ifNull": ["$cnae_info.secao_descricao", "—"] },
            "grupo_descricao": { "$ifNull": ["$cnae_info.grupo_descricao", "—"] },
            "data_inicio_atividade": {
                "$ifNull": ["$fantasia_info.data_inicio_atividade", None]
            },
            "cnae_fiscal_principal": 1,
            "porte_empresa": { "$ifNull": ["$empresa_info.porte_empresa", "—"] }

        }}
    ]

    # --- Executa ---
    resultados = list(colecao_cnpjs.aggregate(pipeline))

    dados = []
    for r in resultados:
        cnpj = formatar_cnpj(r["cnpj_basico"], r["cnpj_ordem"], r["cnpj_dv"])
        nome = r.get("nome_empresa", "Desconhecida")
        capital = r.get("capital_social", "0,00")

        try:
            if isinstance(capital, str):
                capital = capital.replace(".", "").replace(",", ".").strip()
            capital = float(capital)
        except Exception:
            capital = 0.0

        capital_formatado = f"R$ {capital:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

        tipo = "Matriz" if str(r.get("matriz_filial", "")).strip() == "1" else "Filial"

        situacoes = {
            "01": "NULA", "1": "NULA",
            "02": "ATIVA", "2": "ATIVA",
            "03": "SUSPENSA", "3": "SUSPENSA",
            "04": "INAPTA", "4": "INAPTA",
            "08": "BAIXADA", "8": "BAIXADA",
        }
        situacao_desc = situacoes.get(str(r.get("situacao_cadastral", "")).zfill(2), "Desconhecida")

        municipio = r.get("municipio", "—")
        divisao = r.get("divisao_descricao", "—")
        
        print("🔎 Empresa:", nome)
        print("📌 CNAEs secundários encontrados:", [
            c.get("subclasse_descricao", "—")
            for c in r.get("cnaes_secundarios_info", [])
        ])

        dados.append({  
            "cnpj_completo": cnpj,
            "nome_empresa": nome,
            "razao_social": r.get("empresa_info", {}).get("razao_social", "—"),
            "nome_fantasia": r.get("fantasia_info", {}).get("nome_fantasia", "—"),
            "capital_social": capital_formatado,
            "classe_cnae": r.get("classe_cnae", "—"),
            "cnae_principal_descricao": r.get("cnae_principal_descricao", "—"),
            "tipo_unidade": tipo,
            "situacao_cadastral": situacao_desc,
            "telefone1": f"({r['ddd1']}) {r['telefone1']}" if r.get("ddd1") and r.get("telefone1") else "—",
            "telefone2": f"({r['ddd2']}) {r['telefone2']}" if r.get("ddd2") and r.get("telefone2") else "—",
            "email": r.get("email", "—"),
            "municipio": r.get("municipio", "—"),
            "divisao_descricao": r.get("divisao_descricao", "—"),
            "cnaes_secundarios": [
                r.get("cnaes_secundarios_info", [{}])[0].get("subclasse_descricao", "—")
            ] if r.get("cnaes_secundarios_info") else ["—"],
            "grupo_descricao": r.get("grupo_descricao", "—"),
            "secao_descricao": r.get("secao_descricao", "—"),
            "data_inicio_atividade": formatar_data_br(r.get("data_inicio_atividade")),
            "cnae_principal_codigo": r.get("cnae_fiscal_principal", "—"),
            "porte_empresa": r.get("porte_empresa", "—"),
        })

    return {
        "resultados": dados,
        "total": total,
        "ultima_pagina": (total + limite - 1) // limite,
        "pagina_atual": page
    }   


def formatar_data_br(data_str):
        try:
            if data_str and len(data_str) == 8:
                return datetime.strptime(data_str, "%Y%m%d").strftime("%d/%m/%Y")
        except Exception as e:
            print("Erro ao formatar data:", e)
        return "—"

# Lista UFs
@app.get("/ufs")
def listar_ufs():
    ufs = colecao_cnpjs.distinct("uf")
    return sorted(ufs)

# Lista municípios por UF
@app.get("/municipios")
def listar_municipios(uf: str):
    codigos = colecao_cnpjs.distinct("codigo_municipio", {"uf": uf.upper()})
    municipios = list(colecao_municipios.find(
        {"codigo_municipio": {"$in": codigos}},
        {"_id": 0}
    ))
    municipios.sort(key=lambda m: m["municipio_descricao"])
    return municipios

# Lista de seções (ex: A - Agricultura...)
@app.get("/grupo_cnae/secoes")
def listar_secoes():
    secoes = colecao_grupo_cnae.distinct("secao_codigo")
    resultados = []
    for secao in secoes:
        doc = colecao_grupo_cnae.find_one({"secao_codigo": secao})
        if doc:
            resultados.append({
                "secao_codigo": secao,
                "secao_descricao": doc.get("secao_descricao", "")
            })
    return sorted(resultados, key=lambda x: x["secao_codigo"])

# Lista de divisões por seção (ex: 01 - Agricultura, pecuária...)
@app.get("/grupo_cnae/divisoes")
def listar_divisoes(secao_codigo: str):
    divisoes = colecao_grupo_cnae.find({"secao_codigo": secao_codigo})
    codigos = set()
    resultados = []
    for doc in divisoes:
        divisao = doc.get("divisao_codigo")
        if divisao and divisao not in codigos:
            resultados.append({
                "divisao_codigo": divisao,
                "divisao_descricao": doc.get("divisao_descricao", "")
            })
            codigos.add(divisao)
    return sorted(resultados, key=lambda x: x["divisao_codigo"])

# Lista de grupos por divisão (ex: 01.1 - Cultivo de arroz...)
@app.get("/grupo_cnae/grupos")
def listar_grupos(divisao_codigo: str):
    grupos = colecao_grupo_cnae.find({"divisao_codigo": divisao_codigo})
    codigos = set()
    resultados = []
    for doc in grupos:
        grupo = doc.get("grupo_codigo")
        if grupo and grupo not in codigos:
            resultados.append({
                "grupo_codigo": grupo,
                "grupo_descricao": doc.get("grupo_descricao", "")
            })
            codigos.add(grupo)
    return sorted(resultados, key=lambda x: x["grupo_codigo"])

# Lista de classes por grupo (ex: 01.11 - Cultivo de arroz em casca...)
@app.get("/grupo_cnae/classes")
def listar_classes(grupo_codigo: str):
    classes = colecao_grupo_cnae.find({"grupo_codigo": grupo_codigo})
    codigos = set()
    resultados = []
    for doc in classes:
        classe = doc.get("classe_codigo")
        if classe and classe not in codigos:
            resultados.append({
                "classe_codigo": classe,
                "classe_descricao": doc.get("classe_descricao", "")
            })
            codigos.add(classe)
    return sorted(resultados, key=lambda x: x["classe_codigo"])


# Lista de CNAEs por classe (ex: 0111-3/01 - Cultivo de arroz em casca...)
@app.get("/grupo_cnae/cnaes")
def listar_cnaes(classe_codigo: str):
    cnaes = colecao_grupo_cnae.find({"classe_codigo": classe_codigo})
    resultados = []
    for doc in cnaes:
        subclasse = doc.get("subclasse_codigo", "")
        subclasse_limpo = sub(r"[-/]", "", subclasse)  # transforma "0111-3/01" em "0111301"
        if subclasse:
            resultados.append({
                "cnae_fiscal_principal": subclasse_limpo,
                "cnae_rotulo": f"{subclasse} - {doc.get('subclasse_descricao', '')}"
            })
    return sorted(resultados, key=lambda x: x["cnae_fiscal_principal"])

# Endpoint para salvar leads (lead.html/lead.js)
class LeadInput(BaseModel):
    nome: str
    dados: list[dict]

@app.post("/salvar-lead")
async def salvar_lead(request: Request, body: LeadInput):
    if not body.dados:
        return {"erro": "Nenhum dado para salvar"}

    nome_lista = body.nome.strip()
    dados_limite = body.dados[:250] # Limite de 250 dados

    existente = colecao_leads.find_one({"nome": nome_lista})

    if existente:
        # ✅ Evita duplicatas por CNPJ
        cnpjs_existentes = {d["cnpj"] for d in existente.get("dados", [])}
        dados_unicos = [d for d in dados_limite if d["cnpj"] not in cnpjs_existentes]

        if not dados_unicos:
            return {"mensagem": f"Nenhum dado novo para adicionar à lista '{nome_lista}'."}

        colecao_leads.update_one(
            {"_id": existente["_id"]},
            {"$push": {"dados": {"$each": dados_unicos}}}
        )
        return {"mensagem": f"{len(dados_unicos)} novos dados adicionados à lista '{nome_lista}' com sucesso!"}

    else:
        novo_doc = {
            "nome": nome_lista,
            "criado_em": datetime.utcnow(),
            "dados": dados_limite
        }   
        colecao_leads.insert_one(novo_doc)
        return {"mensagem": f"Lista '{nome_lista}' criada e dados salvos com sucesso!"}


@app.get("/leads")
async def listar_leads():
    try:
        leads = colecao_leads.find({}, {"nome": 1, "dados": 1, "criado_em": 1})
        return jsonable_encoder([converter_obj_id(lead) for lead in leads])
    except Exception as e:
        print("Erro ao listar leads:", e)
        raise HTTPException(status_code=500, detail="Erro interno ao listar leads.")


def converter_obj_id(doc):
    doc["_id"] = str(doc["_id"])
    return doc


@app.put("/leads/{lead_id}")
async def editar_nome_lead(lead_id: str, body: dict):
    novo_nome = body.get("nome")
    if not novo_nome:
        raise HTTPException(status_code=400, detail="Nome é obrigatório.")

    result = colecao_leads.update_one(
        {"_id": ObjectId(lead_id)},
        {"$set": {"nome": novo_nome}}
    )

    if result.modified_count == 0:  
        raise HTTPException(status_code=404, detail="Lead não encontrada ou nome igual ao anterior.")

    return {"mensagem": "Nome da lead atualizado com sucesso."}


@app.delete("/leads/{lead_id}")
async def deletar_lead(lead_id: str):
    result = colecao_leads.delete_one({"_id": ObjectId(lead_id)})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lead não encontrada.")

    return {"mensagem": "Lead excluída com sucesso."}

@app.get("/leads/detalhada")
def obter_leads_ou_detalhe(lead_id: str = Query(...)):
    try:
        lead = colecao_leads.find_one({"_id": ObjectId(lead_id)})
        if not lead:
            raise HTTPException(status_code=404, detail="Lead não encontrada.")
        return converter_obj_id(lead)
    except Exception as e:
        raise HTTPException(status_code=400, detail="ID inválido ou erro ao buscar lead.")

@app.get("/leads/detalhada-paginada")
def obter_lead_detalhada_paginada(
    lead_id: str = Query(...),
    pagina: int = Query(1, ge=1),
    limite: int = Query(10, ge=1, le=100)
):
    try:
        lead = colecao_leads.find_one({"_id": ObjectId(lead_id)})
        if not lead:
            raise HTTPException(status_code=404, detail="Lead não encontrada.")

        total_dados = len(lead["dados"])
        inicio = (pagina - 1) * limite
        fim = inicio + limite

        dados_paginados = lead["dados"][inicio:fim]

        return {
            "_id": str(lead["_id"]),
            "nome": lead["nome"],
            "dados": dados_paginados,
            "intervalo": f"{inicio + 1} - {min(fim, total_dados)} de {total_dados}",
            "pagina": pagina,
            "limite": limite,
            "total": total_dados
        }
    except Exception as e:
        print(e)
        raise HTTPException(status_code=400, detail="Erro ao buscar lead paginada.")


# Endpoint para buscar empresa por CNPJ(find.html/find.js)
from fastapi import Query
from typing import List

@app.get("/api/find")
def buscar_empresa(cnpj: str = Query(..., min_length=14, max_length=14)):
    cnpj_basico = cnpj[:8]
    cnpj_ordem = cnpj[8:12]
    cnpj_dv = cnpj[12:14]

    doc_filtro = colecao_cnpjs.find_one({
        "cnpj_basico": cnpj_basico,
        "cnpj_ordem": cnpj_ordem,
        "cnpj_dv": cnpj_dv
    })

    doc_empresa = colecao_empresas.find_one({"cnpj_basico": cnpj_basico})

    if not doc_filtro and not doc_empresa:
        return []

    doc_cnae = colecao_grupo_cnae.find_one({
        "subclasse_codigo": doc_filtro.get("cnae_fiscal_principal", "")
    })

    socios = list(colecao_socios.find(
        {"cnpj_basico": cnpj_basico},
        {"_id": 0, "nome_socio": 1}
    ))

    # Função auxiliar para formatar datas antes de qualquer uso
    def formatar_data_br(data_str):
        if not data_str or len(data_str) != 8:
            return "—"
        return f"{data_str[6:8]}/{data_str[4:6]}/{data_str[0:4]}"

    # 🔍 Buscar nome do município com base no código
    codigo_municipio = doc_filtro.get("codigo_municipio", "").zfill(4)
    doc_municipio = colecao_municipios.find_one(
        {"codigo_municipio": codigo_municipio},
        {"_id": 0, "municipio_descricao": 1}
    )
    municipio_nome = doc_municipio["municipio_descricao"] if doc_municipio else "—"

    # 🔍 Dados do Simples Nacional e MEI
    doc_simples = colecao_simples.find_one({"cnpj_basico": cnpj_basico})
    if doc_simples:
        simples = {
            "opcao_simples": "Sim" if doc_simples.get("opcao_simples") == "S" else "Não",
            "data_opcao_simples": formatar_data_br(doc_simples.get("data_opcao_simples", "")),
            "data_exclusao_simples": formatar_data_br(doc_simples.get("data_exclusao_simples", "")),
            "opcao_mei": "Sim" if doc_simples.get("opcao_mei") == "S" else "Não",
            "data_opcao_mei": formatar_data_br(doc_simples.get("data_opcao_mei", "")),
            "data_exclusao_mei": formatar_data_br(doc_simples.get("data_exclusao_mei", ""))
        }
    else:
        simples = {
            "opcao_simples": "—",
            "data_opcao_simples": "—",
            "data_exclusao_simples": "—",
            "opcao_mei": "—",
            "data_opcao_mei": "—",
            "data_exclusao_mei": "—"
        }

    # Funções auxiliares
    def format_cnpj(b, o, d):
        return f"{b[:2]}.{b[2:5]}.{b[5:8]}/{o}-{d}"

    def format_capital(valor):
        try:
            if isinstance(valor, str):
                valor = valor.replace(".", "").replace(",", ".")
            return f"R$ {float(valor):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
        except:
            return "R$ 0,00"

    def formatar_telefone(ddd, numero):
        if ddd and numero:
            return f"({ddd}) {numero}"
        return "—"

    def formatar_data_br(data_str):
        if not data_str or len(data_str) != 8:
            return "—"
        return f"{data_str[6:8]}/{data_str[4:6]}/{data_str[0:4]}"

    situacoes = {
        "01": "NULA", "1": "NULA",
        "02": "ATIVA", "2": "ATIVA",
        "03": "SUSPENSA", "3": "SUSPENSA",
        "04": "INAPTA", "4": "INAPTA",
        "08": "BAIXADA", "8": "BAIXADA",
    }

    data_inicio = doc_filtro.get("data_inicio_atividade", "")
    data_abertura = formatar_data_br(str(data_inicio).strip()) if data_inicio else "—"

    return [{
        "cnpj_completo": format_cnpj(cnpj_basico, cnpj_ordem, cnpj_dv),
        "cnpj": f"{cnpj_basico}{cnpj_ordem}{cnpj_dv}",
        "razao_social": doc_empresa.get("razao_social", "—") if doc_empresa else "—",
        "nome_fantasia": doc_filtro.get("nome_fantasia", "—"),
        "nome_exibido": doc_empresa.get("nome_exibido", "—") if doc_empresa else "—",
        "capital_social": format_capital(doc_empresa.get("capital_social", "0,00") if doc_empresa else "0,00"),
        "municipio": municipio_nome,
        "secao_descricao": doc_cnae.get("secao_descricao", "—") if doc_cnae else "—",
        "grupo_descricao": doc_cnae.get("grupo_descricao", "—") if doc_cnae else "—",
        "classe_cnae": doc_cnae.get("classe_descricao", "—") if doc_cnae else "—",
        "cnae_principal_codigo": doc_filtro.get("cnae_fiscal_principal", "—"),
        "cnaeDescricao": doc_cnae.get("subclasse_descricao", "—") if doc_cnae else "—",
        "divisao": doc_cnae.get("divisao_descricao", "—") if doc_cnae else "—",
        "email": doc_filtro.get("email", "—"),
        "telefone": formatar_telefone(doc_filtro.get("ddd1"), doc_filtro.get("telefone1")),
        "telefone2": formatar_telefone(doc_filtro.get("ddd2"), doc_filtro.get("telefone2")),
        "site": doc_empresa.get("site", "—") if doc_empresa else "—",
        "data_abertura": data_abertura,
        "tipo_unidade": "Matriz" if doc_filtro.get("matriz_filial", "") == "1" else "Filial",
        "situacao": situacoes.get(str(doc_filtro.get("situacao_cadastral", "")).zfill(2), "Desconhecida"),
        "socios": [s["nome_socio"] for s in socios] if socios else [],
        "simples": simples
    }]



# 🔹 Endpoint para enriquecer empresa pelo e-mail
@app.get("/enriquecer")
def rota_enriquecer(
    email: str = Query(..., description="E-mail da empresa")
):
    return enriquecer_empresa_por_email(email)

# Endpoint para listar sócios (lead.html/lead.js)
@app.get("/funcionarios")
def listar_socios(cnpj: str):
    cnpj_limpo = re.sub(r"\D", "", cnpj)
    if len(cnpj_limpo) != 14:
        return []

    cnpj_basico = cnpj_limpo[:8]

    socios = list(colecao_socios.find({"cnpj_basico": cnpj_basico}, {"_id": 0}))

    # Tenta enriquecer com a descrição da qualificação
    qualificacoes = {
        q["codigo"]: q["descricao"]
        for q in colecao_qualificacao.find({}, {"_id": 0, "codigo": 1, "descricao": 1})
    }

    pessoas = []
    for s in socios:
        pessoas.append({
            "nome": s.get("nome_socio", "—"),
            "cargo": qualificacoes.get(s.get("codigo_qualificacao", ""), "Sócio"),
            "email": None  # Dados abertos não contêm e-mail
        })

    return pessoas

class EmpresaInput(BaseModel):
    socios: List[str]
    site: Optional[str] = None
    email: Optional[str] = None
    nome_fantasia: Optional[str] = None


# salvar lead de pessoas (lead.html/lead.js)

class LeadPessoaInput(BaseModel):
    nome: str
    dados: List[Dict]

# ✅ POST: Salvar lista de pessoas
@app.post("/salvar-lead-pessoas")
async def salvar_lead_pessoas(body: LeadPessoaInput):
    if not body.dados:
        return {"erro": "Nenhum dado para salvar"}

    nome_lista = body.nome.strip()
    dados_limite = body.dados[:500]  # Limite de 500

    existente = colecao_leadsP.find_one({"nome": nome_lista})

    if existente:
        # Evita duplicatas por nome_socio e razao_social
        chaves_existentes = {(d["nome_socio"], d["razao_social"]) for d in existente.get("dados", [])}
        dados_unicos = [
            d for d in dados_limite
            if (d["nome_socio"], d["razao_social"]) not in chaves_existentes
        ]

        if not dados_unicos:
            return {"mensagem": f"Nenhum dado novo para adicionar à lista '{nome_lista}'."}

        colecao_leadsP.update_one(
            {"_id": existente["_id"]},
            {"$push": {"dados": {"$each": dados_unicos}}}
        )
        return {"mensagem": f"{len(dados_unicos)} novos dados adicionados à lista '{nome_lista}' com sucesso!"}
    else:
        novo_doc = {
            "nome": nome_lista,
            "criado_em": datetime.utcnow(),
            "dados": dados_limite
        }
        colecao_leadsP.insert_one(novo_doc)
        return {"mensagem": f"Lista '{nome_lista}' criada e dados salvos com sucesso!"}

# ✅ GET: Listar todas as listas de pessoas
@app.get("/leads-pessoas")
def listar_leads_pessoas():
    leads = list(colecao_leadsP.find({}, {"nome": 1, "dados": 1}))  # inclui os dados
    return [
        {
            "_id": str(lead["_id"]),
            "nome": lead["nome"],
            "dados": lead.get("dados", [])
        }
        for lead in leads
    ]

@app.get("/leads-pessoas/detalhada")
def obter_lead_pessoa_detalhada(lead_id: str = Query(...)):
    try:
        lead = colecao_leadsP.find_one({"_id": ObjectId(lead_id)})
        if not lead:
            raise HTTPException(status_code=404, detail="Lead não encontrada.")
        return converter_obj_id(lead)
    except Exception:
        raise HTTPException(status_code=400, detail="ID inválido ou erro ao buscar lead.")
# verificar email
class EmailInput(BaseModel):
    emails: List[str]

@app.put("/leads-pessoas/{lead_id}")
async def editar_nome_lead_pessoa(lead_id: str, body: dict):
    novo_nome = body.get("nome")
    if not novo_nome:
        raise HTTPException(status_code=400, detail="Nome é obrigatório.")

    result = colecao_leadsP.update_one(
        {"_id": ObjectId(lead_id)},
        {"$set": {"nome": novo_nome}}
    )

    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Lead não encontrada ou nome igual ao anterior.")

    return {"mensagem": "Nome da lead de pessoa atualizado com sucesso."}

@app.delete("/leads-pessoas/{lead_id}")
async def deletar_lead_pessoa(lead_id: str):
    result = colecao_leadsP.delete_one({"_id": ObjectId(lead_id)})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lead não encontrada.")

    return {"mensagem": "Lead de pessoa excluída com sucesso."}

@app.get("/leads-pessoas/detalhada-paginada")
def obter_lead_pessoa_detalhada_paginada(
    lead_id: str = Query(...),
    pagina: int = Query(1, ge=1),
    limite: int = Query(10, ge=1, le=100)
):
    try:
        lead = colecao_leadsP.find_one({"_id": ObjectId(lead_id)})
        if not lead:
            raise HTTPException(status_code=404, detail="Lead não encontrada.")

        total_dados = len(lead["dados"])
        inicio = (pagina - 1) * limite
        fim = inicio + limite

        dados_paginados = lead["dados"][inicio:fim]

        return {
            "_id": str(lead["_id"]),
            "nome": lead["nome"],
            "dados": dados_paginados,
            "intervalo": f"{inicio + 1} - {min(fim, total_dados)} de {total_dados}",
            "pagina": pagina,
            "limite": limite,
            "total": total_dados
        }
    except Exception as e:
        print(e)
        raise HTTPException(status_code=400, detail="Erro ao buscar lead paginada.")


# Endpoint simples nacional
@app.get("/simples")
def obter_simples(cnpj: str = Query(...)):
    cnpj_limpo = re.sub(r"\D", "", cnpj)
    if len(cnpj_limpo) != 14:
        print(f"❌ CNPJ inválido recebido: {cnpj}")
        raise HTTPException(status_code=400, detail="CNPJ inválido.")

    cnpj_basico = cnpj_limpo[:8]
    print(f"🔍 Buscando Simples para cnpj_basico: {cnpj_basico}")

    doc = colecao_simples.find_one({"cnpj_basico": cnpj_basico})  # ← sem int()

    if not doc:
        print(f"❌ Nenhum documento encontrado para: {cnpj_basico}")
        raise HTTPException(status_code=404, detail="Empresa não encontrada no Simples Nacional.")

    print(f"✅ Documento encontrado: {doc}")

    return {
        "opcao_simples": doc.get("opcao_simples", "N"),
        "data_opcao_simples": doc.get("data_opcao_simples", "00000000"),
        "data_exclusao_simples": doc.get("data_exclusao_simples", "00000000"),
        "opcao_mei": doc.get("opcao_mei", "N"),
        "data_opcao_mei": doc.get("data_opcao_mei", "00000000"),
        "data_exclusao_mei": doc.get("data_exclusao_mei", "00000000"),
    }

#pintar linha lead empresa
@app.get("/leads-pessoas-cnpjs", response_model=List[str])
def get_cnpjs_leads_pessoas():
    cnpjs_set = set()

    for lead in db["lead_pessoas"].find({}, {"dados.cnpj": 1, "_id": 0}):
        for dado in lead.get("dados", []):
            cnpj = dado.get("cnpj", "")
            cnpj_limpo = "".join(filter(str.isdigit, cnpj))
            if cnpj_limpo:
                cnpjs_set.add(cnpj_limpo)

    return list(cnpjs_set)


# Cache para nomes e WhatsApp
cache_nomes_cpf = {}
cache_whatsapp = {}

def extrair_cpf(tipo_string: str) -> Optional[str]:
    match = re.search(r"\d{11}", tipo_string or "")
    return match.group(0) if match else None

async def buscar_nome_por_cpf(cpf: str, headers: dict) -> Optional[str]:
    if cpf in cache_nomes_cpf:
        return cache_nomes_cpf[cpf]

    payload = {"q": f"doc{{{cpf}}}", "Datasets": "basic_data", "Limit": 1}
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            res = await client.post(
                "https://plataforma.bigdatacorp.com.br/pessoas",
                json=payload,
                headers=headers
            )
            res.raise_for_status()
            result = res.json().get("Result", [])
            if result:
                nome = result[0].get("BasicData", {}).get("Name")
                cache_nomes_cpf[cpf] = nome
                return nome
        except Exception as e:
            print(f"❌ Erro ao buscar nome para CPF {cpf}: {e}")
    return None

def ano_valido(last_update_str: Optional[str]) -> bool:
    if not last_update_str:
        return False
    try:
        ano = datetime.fromisoformat(last_update_str.replace("Z", "")).year
        return 2019 <= ano <= 2025
    except ValueError:
        return False
"""
async def verificar_whatsapp(numero: str) -> bool:
    numero_limpo = "+55" + re.sub(r"\D", "", numero)
    if numero_limpo in cache_whatsapp:
        return cache_whatsapp[numero_limpo]

    try:
        twilio_client.messages.create(
            from_=TWILIO_WHATSAPP_FROM,
            body="Teste de verificação",
            to=f"whatsapp:{numero_limpo}"
        )
        cache_whatsapp[numero_limpo] = True
        return True
    except Exception as e:
        if "not a valid whatsapp user" in str(e).lower():
            cache_whatsapp[numero_limpo] = False
            return False
        print(f"⚠️ Erro ao enviar mensagem Twilio para {numero_limpo}: {e}")
        cache_whatsapp[numero_limpo] = False
        return False
"""
@app.post("/bigdata-telefones")
async def buscar_telefones_bigdata(request: Request):
    body = await request.json()
    cnpj = body.get("cnpj", "").replace(".", "").replace("/", "").replace("-", "")
    if not cnpj:
        raise HTTPException(status_code=400, detail="CNPJ ausente")

    payload_empresa = {
        "q": f"doc{{{cnpj}}}",
        "Datasets": "related_people_phones,phones_extended",
        "Limit": 1
    }

    headers = {
        "accept": "application/json",
        "content-type": "application/json",
        "AccessToken":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiRlRSSVNUQU5URUBCRUxQSVQuQ09NLkJSIiwianRpIjoiMmI0Mjk4ZTMtYmFmNC00NDk2LWFjNjMtMWQxZGU5NjljOTdmIiwibmFtZVVzZXIiOiJGZWxpcGUgVHJpc3RhbnRlIiwidW5pcXVlX25hbWUiOiJGVFJJU1RBTlRFQEJFTFBJVC5DT00uQlIiLCJkb21haW4iOiJCRUxQSVQiLCJwcm9kdWN0cyI6WyJCSUdCT09TVCIsIkJJR0lEIl0sIm5iZiI6MTc1NDMzMzgyMiwiZXhwIjoxNzg1ODY5ODIyLCJpYXQiOjE3NTQzMzM4MjIsImlzcyI6IkJpZyBEYXRhIENvcnAuIn0.cRI9ih-FU_H-0VQ-V-wT7gxe5yQOpdMZvxwg9uTjxvA",
        "TokenId":"6891027e951493648797fab3"
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            res = await client.post(
                "https://plataforma.bigdatacorp.com.br/empresas",
                json=payload_empresa,
                headers=headers
            )
            res.raise_for_status()
            data = res.json()

        resultados = data.get("Result", [])
        if not resultados:
            raise HTTPException(status_code=404, detail="Nenhum resultado retornado da BigData")

        resultado = resultados[0]
        related = resultado.get("RelatedPeoplePhones", [])
        phones_extended = resultado.get("PhonesExtended", {}).get("Phones", [])

        # Telefones já salvos no banco (para esse CNPJ)
        telefones_salvos = set(
            doc["dados"]["numero"]
            for doc in db["lead_pessoas"].find({"cnpj": cnpj}, {"dados.numero": 1})
            if doc.get("dados", {}).get("numero")
        )

        # Extrai CPFs únicos (para buscar nomes)
        cpfs = set()
        for tel in related:
            tipo_str = tel.get("Type", "")
            if "HOME" in tipo_str.upper():
                continue
            if not ano_valido(tel.get("LastUpdateDate")):
                continue
            if tel.get("RelationshipType") != "QSA" and not tel.get("IsActive", False):
                continue
            cpf = extrair_cpf(tipo_str)
            if cpf:
                cpfs.add(cpf)

        cpf_para_nome = {}
        for cpf in cpfs:
            nome = await buscar_nome_por_cpf(cpf, headers)
            if nome:
                cpf_para_nome[cpf] = nome

        socios, funcionarios = [], []

        # Telefones sócios/funcionários
        for tel in related:
            tipo_str = tel.get("Type", "")
            if "HOME" in tipo_str.upper() or not ano_valido(tel.get("LastUpdateDate")):
                continue
            if tel.get("RelationshipType") != "QSA" and not tel.get("IsActive", False):
                continue

            cpf = extrair_cpf(tipo_str)
            nome = cpf_para_nome.get(cpf, "—")
            telefone = f"({tel.get('AreaCode')}) {tel.get('Number')}" if tel.get("AreaCode") and tel.get("Number") else None
            if not telefone:
                continue

            cargo = "Sócio" if tel.get("RelationshipType") == "QSA" else "Funcionário"

            dado = {
                "nome": nome,
                "cpf": cpf,
                "telefone": telefone,
                "ativo": tel.get("IsActive", False),
                "last_update": tel.get("LastUpdateDate"),
                "salvo": telefone in telefones_salvos,
                "tipo": tel.get("Type", "").upper(),
                "cargo": cargo
            }
            if tel.get("RelationshipType") == "QSA":
                socios.append(dado)
            else:
                funcionarios.append(dado)

            # ✅ Limita já durante a iteração
            if len(funcionarios) >= 10:
                break

        # Telefones atendimentos (sem CPF, tratamos sempre como funcionário)
        for idx, tel in enumerate(phones_extended, start=1):
            if len(funcionarios) >= 10:  # ✅ para o loop se já tiver 10
                break
            if not ano_valido(tel.get("LastUpdateDate")) or not tel.get("IsActive", False):
                continue
            telefone = f"({tel.get('AreaCode')}) {tel.get('Number')}" if tel.get("AreaCode") and tel.get("Number") else None
            if not telefone:
                continue

            dado = {
                "nome": f"Atendimento {idx}",
                "cpf": tel.get("Document", ""),
                "telefone": telefone,
                "ativo": tel.get("IsActive", False),
                "last_update": tel.get("LastUpdateDate"),
                "salvo": telefone in telefones_salvos,
                "tipo": tel.get("Type", "").upper(),
                "cargo": "Funcionário"
            }
            funcionarios.append(dado)

        return {
            "socios": socios,
            "funcionarios": funcionarios,
            "telefones_salvos": list(telefones_salvos)
        }

    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"Erro BigData: {e.response.text}")
    except Exception as e:
        print("❌ Erro interno:", e)
        raise HTTPException(status_code=500, detail="Erro interno ao processar dados.")


@app.post("/salvar-bigdata-pessoas")
async def salvar_bigdata_pessoas(body: dict = Body(...)):
    """
    Salva ou atualiza sócios/funcionários consultados em bigdata_pessoas
    """
    cnpj = body.get("cnpj")
    empresa = body.get("empresa")
    pessoas = body.get("pessoas", [])

    if not cnpj or not pessoas:
        raise HTTPException(status_code=400, detail="CNPJ ou pessoas ausentes")

    salvos, atualizados = 0, 0

    for pessoa in pessoas:
        telefone = pessoa.get("telefone") or pessoa.get("numero") or ""
        telefone = telefone.strip() or None

        filtro = {"cnpj": cnpj, "cpf": pessoa.get("cpf"), "telefone": telefone}
        update_doc = {
            "$set": {
                "empresa": empresa,
                "nome": pessoa.get("nome"),
                "cargo": pessoa.get("cargo"),
                "tipo": pessoa.get("tipo"),
                "ativo": pessoa.get("ativo", False),
                "whatsapp": pessoa.get("whatsapp", False),
                "last_update": pessoa.get("last_update"),
            }
        }

        result = colecao_Bigdata.update_one(filtro, update_doc, upsert=True)

        if result.matched_count > 0:
            atualizados += 1
        elif result.upserted_id:
            salvos += 1

    return {"status": "ok", "salvos": salvos, "atualizados": atualizados}


    
def normalizar_cpf(valor) -> str | None:
    if not valor:
        return None
    d = re.sub(r"\D", "", str(valor))
    return d.zfill(11) if d else None

@app.get("/bigdata-pessoas")
async def get_bigdata_pessoas(cnpj: str):
    """
    Retorna pessoas (sócios e funcionários) já salvas no bigdata_pessoas para um CNPJ,
    marcando 'salvo' = True somente se o TELEFONE existir em lead_pessoas,
    já ordenadas da mais recente para a mais antiga pelo campo last_update.
    """
    cursor = colecao_Bigdata.find({"cnpj": cnpj}, {"_id": 0})
    pessoas = list(cursor)

    # Telefones já salvos em lead_pessoas
    telefones_lp_dados = db["lead_pessoas"].distinct("dados.numero")
    telefones_lp_raiz  = db["lead_pessoas"].distinct("numero")

    # normalizar todos como string sem máscara
    def normalizar_tel(t):
        if not t:
            return None
        return "".join([c for c in str(t) if c.isdigit()])

    tels_salvos = {
        normalizar_tel(t) for t in [*telefones_lp_dados, *telefones_lp_raiz] if t
    }

    def normalizar_last_update(lu):
        """Transforma last_update em datetime ou None."""
        if isinstance(lu, datetime):
            return lu
        if isinstance(lu, dict) and "$date" in lu:
            try:
                return datetime.fromisoformat(lu["$date"].replace("Z", "+00:00"))
            except:
                return None
        if isinstance(lu, str) and lu.strip():
            try:
                return datetime.fromisoformat(lu.replace("Z", "+00:00"))
            except:
                return None
        return None

    for p in pessoas:
        # garantir telefone como string limpa
        tel = p.get("telefone") or p.get("numero")
        tel_norm = normalizar_tel(tel)
        p["telefone"] = tel_norm if tel_norm else None

        # marcar salvo se telefone já existe
        p["salvo"] = tel_norm in tels_salvos if tel_norm else False

        # padronizar last_update
        dt = normalizar_last_update(p.get("last_update"))
        if dt:
            p["_dt"] = dt
            p["last_update"] = dt.isoformat()
        else:
            p["_dt"] = datetime.min
            p["last_update"] = None

    # 🔽 Ordenar (mais recente primeiro)
    pessoas.sort(key=lambda x: x["_dt"], reverse=True)

    socios = [p for p in pessoas if p.get("cargo") == "Sócio"]
    funcionarios = [p for p in pessoas if p.get("cargo") == "Funcionário"]

    # remover campo auxiliar antes de retornar
    for p in pessoas:
        p.pop("_dt", None)

    return {"socios": socios, "funcionarios": funcionarios}



@app.post("/registrar-busca-pessoas")
async def registrar_busca_pessoas(body: dict = Body(...)):
    """
    Registra a data/hora da busca de pessoas relacionadas para um CNPJ
    """
    cnpj = body.get("cnpj")
    if not cnpj:
        return {"erro": "CNPJ é obrigatório"}

    registro = {
        "cnpj": cnpj,
        "tipo": "pessoas_relacionadas",
        "data_busca": datetime.now()
    }
    colecao_buscas.insert_one(registro)

    return {"ok": True, "data_busca": registro["data_busca"]}

@app.get("/ultima-busca-pessoas")
async def ultima_busca_pessoas(cnpj: str = Query(...)):
    """
    Retorna a última busca de pessoas relacionadas para o CNPJ informado
    """
    doc = colecao_buscas.find_one(
        {"cnpj": cnpj, "tipo": "pessoas_relacionadas"},
        sort=[("data_busca", -1)]
    )

    if doc:
        return {"cnpj": cnpj, "data_busca": doc["data_busca"]}
    return {"cnpj": cnpj, "data_busca": None}

#salvar rapido





# Página inicial    
@app.get("/")
def raiz():
    return FileResponse("template/index.html")

# Arquivos estáticos
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/template", StaticFiles(directory="template"), name="template")
