from duckduckgo_search import DDGS
from unidecode import unidecode
from urllib.parse import urlparse

# Busca nomes no LinkedIn via DuckDuckGo
def buscar_nomes_ddg(cargo: str, empresa: str, max_resultados=5):
    query = f'site:linkedin.com/in "{empresa}" "{cargo}"'
    nomes = []

    with DDGS() as ddgs:
        for r in ddgs.text(query, max_results=max_resultados):
            titulo = r["title"]
            if "-" in titulo:
                nome = titulo.split("-")[0].strip()
                nomes.append(nome)
    return nomes


# Gera variações de e-mails com base em nome e domínio (versão melhorada)
def gerar_possiveis_emails(nome_completo: str, dominio: str):
    nome_completo = unidecode(nome_completo.lower().strip())
    partes = nome_completo.split()

    if len(partes) < 2:
        return []

    primeiro_nome = partes[0]
    primeira_letra = primeiro_nome[0]
    sobrenome = partes[-1]
    penultimo = partes[-2] if len(partes) >= 3 else sobrenome

    # Possíveis composições
    emails = [
        f"{primeira_letra}{penultimo}@{dominio}",
        f"{primeira_letra}{sobrenome}@{dominio}",
        f"{primeira_letra}.{sobrenome}@{dominio}",
        f"{primeira_letra}.{penultimo}@{dominio}",
        f"{primeiro_nome}.{sobrenome}@{dominio}",
        f"{primeiro_nome}.{penultimo}@{dominio}",
        f"{primeiro_nome}_{sobrenome}@{dominio}",
        f"{primeiro_nome}@{dominio}",
        f"{sobrenome}@{dominio}",
        f"{penultimo}@{dominio}",
        f"{penultimo}{sobrenome}@{dominio}",
        f"{primeira_letra}_{sobrenome}@{dominio}",
        f"{primeira_letra}_{penultimo}@{dominio}",
        f"{primeiro_nome}{sobrenome}@{dominio}",
        f"{primeiro_nome}{penultimo}@{dominio}",
        f"{primeira_letra}{penultimo}{sobrenome}@{dominio}",
        f"{primeira_letra}{sobrenome}{penultimo}@{dominio}"
    ]

    return list(set(emails))


# Extrai domínio de site ou e-mail, ou cria com base no nome fantasia
def extrair_dominio(site: str = None, email: str = None, nome_fantasia: str = None):
    if email and "@" in email:
        return email.split("@")[-1]
    
    if site:
        try:
            if not site.startswith("http"):
                site = "https://" + site
            parsed = urlparse(site)
            dominio = parsed.netloc
            if dominio.startswith("www."):
                dominio = dominio[4:]
            return dominio
        except Exception:
            pass

    if nome_fantasia:
        base = unidecode(nome_fantasia.lower().replace(" ", "").replace("-", ""))
        return f"{base}.com.br"

    return None


# Gera e-mails para vários sócios com base nos dados da empresa
def gerar_emails_para_socios(socios: list[str], site: str = None, email: str = None, nome_fantasia: str = None):
    dominio = extrair_dominio(site, email, nome_fantasia)
    if not dominio:
        return {}

    resultado = {}
    for nome in socios:
        resultado[nome] = gerar_possiveis_emails(nome, dominio)
    return resultado
