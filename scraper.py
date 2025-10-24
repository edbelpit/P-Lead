import socket
import requests

# 🔹 Lista de domínios genéricos que devem ser ignorados
BLACKLIST_DOMINIOS = {
    "gmail.com",
    "yahoo.com",
    "yahoo.com.br",
    "hotmail.com",
    "hotmail.com.br",
    "outlook.com",
    "outlook.com.br",
    "live.com",
    "icloud.com",
    "aol.com",
    "bol.com.br",
    "uol.com.br",
    "terra.com.br",
    "msn.com",
    "protonmail.com",
    "zoho.com"
}


def extrair_dominio_email(email: str) -> str:
    """Extrai o domínio depois do @"""
    return email.split("@")[-1].lower().strip()


def validar_dominio(dominio: str) -> bool:
    """Testa se o domínio existe e responde HTTP"""
    try:
        # DNS resolve
        socket.gethostbyname(dominio)

        # Testa acesso HTTP/HTTPS
        for prefix in ["https://", "http://"]:
            try:
                r = requests.get(prefix + dominio, timeout=5)
                if r.status_code in [200, 301, 302]:
                    return True
            except requests.RequestException:
                continue
        return False
    except socket.gaierror:
        return False


def enriquecer_empresa_por_email(email: str):
    """
    Usa apenas o domínio do e-mail para verificar se existe um site válido.
    Se sim -> retorna site.
    Se não -> marca para usar fallback (ex: Hunter API).
    Bloqueia provedores genéricos (ex: Gmail, Yahoo, Hotmail).
    """
    dominio = extrair_dominio_email(email)

    # 🔹 Se for domínio genérico -> ignora
    if dominio in BLACKLIST_DOMINIOS:
        return {
            "site": None,
            "emails": [email],
            "linkedin": None,
            "origem": "email_generico_blacklist"
        }

    # 🔹 Se o domínio é válido -> retorna site
    if validar_dominio(dominio):
        return {
            "site": f"https://{dominio}",
            "emails": [email],
            "linkedin": None,
            "origem": "email_dominio_valido"
        }
    else:
        # 🔹 Caso não valide -> usa fallback
        return {
            "site": None,
            "emails": [email],
            "linkedin": None,
            "origem": "fallback_hunter"
        }
