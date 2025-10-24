# email_verify.py

import requests

API_KEY_ABSTRACT = "849d40a5e3284c9fb19a7bfd5309a09a"  # ⚠️ mantenha seguro

def verificar_email_avancado(email: str) -> dict:
    resultado = {
        "email": email,
        "format": "invalid",
        "type": "unknown",
        "server_status": "invalid",
        "email_status": "unknown",
        "motivo": ""
    }

    try:
        url = f"https://emailvalidation.abstractapi.com/v1/?api_key={API_KEY_ABSTRACT}&email={email}"
        response = requests.get(url, timeout=10)
        data = response.json()

        if data.get("is_valid_format", {}).get("value"):
            resultado["format"] = "valid"
        else:
            resultado["motivo"] = "Formato inválido"
            return resultado

        # Tipo do email
        if data.get("is_disposable", {}).get("value"):
            resultado["type"] = "disposable"
        elif data.get("is_webmail", {}).get("value"):
            resultado["type"] = "webmail"
        else:
            resultado["type"] = "professional"

        # Status do servidor
        if data.get("is_mx_found", {}).get("value"):
            resultado["server_status"] = "valid"
        else:
            resultado["server_status"] = "invalid"
            resultado["motivo"] = "Sem registros MX"
            return resultado

        # Status do email
        status = data.get("deliverability")
        if status == "DELIVERABLE":
            resultado["email_status"] = "valid"
        elif status == "RISKY":
            resultado["email_status"] = "accept_all"
            resultado["motivo"] = "Risco elevado ou domínio catch-all"
        elif status == "UNDELIVERABLE":
            resultado["email_status"] = "invalid"
            resultado["motivo"] = "Email não pode ser entregue"
        else:
            resultado["motivo"] = "Estado desconhecido retornado pela API"

    except requests.exceptions.RequestException as e:
        resultado["motivo"] = f"Erro na requisição: {e}"
        resultado["email_status"] = "unknown"

    return resultado
