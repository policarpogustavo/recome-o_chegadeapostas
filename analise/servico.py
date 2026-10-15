"""
Serviço de análise do Recomeço (Python, só biblioteca padrão).

Roda ao lado do servidor Java, no mesmo container, ouvindo só em 127.0.0.1.
O Java repassa para cá as rotas /api/analise/* e pede a revisão das mensagens
do mural. Este serviço não acessa o banco: o Java envia, a cada pedido, só os
campos anônimos das avaliações (faixa etária, pontuação, nível, data, sinais e
gasto), sem hash de IP nem id de conta.

Rotas:
    GET  /saude          verifica se o serviço está no ar
    POST /resumo         {"avaliacoes": [...]}: análise da comunidade
    POST /percentil      {"avaliacoes": [...], "score": N}: compara uma pontuação com as demais
    POST /moderar        {"texto": "..."}: revisa um texto do mural

Uso:
    python analise/servico.py
    Variáveis: ANALISE_PORTA (padrão 8081) e ANALISE_HOST (padrão 127.0.0.1).
"""

from __future__ import annotations

import json
import os
import re
import unicodedata
from collections import Counter, defaultdict
from datetime import date, datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

FAIXAS = ["menor", "18-24", "25-34", "35-44", "45-59", "60+"]
ROTULO_FAIXA = {
    "menor": "Menos de 18", "18-24": "18 a 24", "25-34": "25 a 34",
    "35-44": "35 a 44", "45-59": "45 a 59", "60+": "60 ou mais",
}
ROTULO_SINAL = {
    "acorda_pensando": "Acorda pensando em apostar",
    "aposta_trabalho": "Aposta no trabalho ou nos estudos",
    "perde_sono": "Perde o sono apostando",
    "ansiedade": "Sente ansiedade ou culpa",
    "mente": "Mente sobre as apostas",
    "isolamento": "Se afastou de amigos e família",
    "pede_emprestado": "Pede dinheiro emprestado",
    "recuperar_perdas": "Aposta para recuperar perdas",
    "irritado_sem_jogar": "Fica irritado sem apostar",
    "deixou_lazer": "Largou o lazer",
}
NIVEIS_RISCO = {"moderado", "problematico"}
MAX_TEXTO = 16 * 1024
MAX_AVALIACOES = 8 * 1024 * 1024
# Grupos menores que isso não são mostrados: médias de 1 ou 2 pessoas revelariam as respostas delas.
MINIMO_GRUPO = 5


# --------------------------------------------------------------------------- dados

def _numero(v) -> float:
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else 0.0


def resumo(registros: list[dict]) -> dict:
    """Agregados anônimos que o painel de dados mostra além das estatísticas do Java."""
    total = len(registros)
    if total < MINIMO_GRUPO:
        return {"total": total, "suficiente": False, "percentEmRisco": 0, "porFaixa": [], "porSemana": [],
                "sinaisNoRisco": [], "gastoAnualComunidade": 0}
    por_faixa = []
    grupos = defaultdict(list)
    for r in registros:
        grupos[r.get("faixaEtaria")].append(r)
    for faixa in FAIXAS:
        g = grupos.get(faixa, [])
        if len(g) < MINIMO_GRUPO:
            continue
        risco = sum(1 for r in g if r.get("nivel") in NIVEIS_RISCO)
        por_faixa.append({
            "faixa": faixa,
            "rotulo": ROTULO_FAIXA[faixa],
            "total": len(g),
            "mediaScore": round(sum(_numero(r.get("score")) for r in g) / len(g), 1),
            "percentRisco": round(100 * risco / len(g), 1),
        })

    semanas = defaultdict(list)
    for r in registros:
        try:
            d = datetime.fromisoformat(str(r.get("data")).replace("Z", "+00:00")).date()
        except ValueError:
            continue
        ano, semana, _ = d.isocalendar()
        semanas[(ano, semana)].append(_numero(r.get("score")))
    por_semana = []
    for (ano, semana) in sorted(semanas)[-12:]:
        scores = semanas[(ano, semana)]
        if len(scores) < MINIMO_GRUPO:
            continue
        inicio = date.fromisocalendar(ano, semana, 1)
        por_semana.append({
            "semana": inicio.isoformat(),
            "total": len(scores),
            "mediaScore": round(sum(scores) / len(scores), 1),
        })

    em_risco = [r for r in registros if r.get("nivel") in NIVEIS_RISCO]
    contagem = Counter(s for r in em_risco for s in r.get("diaADia") or [] if s in ROTULO_SINAL)
    sinais = [
        {"sinal": s, "rotulo": ROTULO_SINAL[s], "percent": round(100 * n / len(em_risco), 1)}
        for s, n in contagem.most_common(5)
    ] if len(em_risco) >= MINIMO_GRUPO else []

    gasto_anual = sum(_numero(r.get("gastoMensal")) for r in registros) * 12
    return {
        "total": total,
        "suficiente": True,
        "percentEmRisco": round(100 * len(em_risco) / total, 1) if total else 0,
        "porFaixa": por_faixa,
        "porSemana": por_semana,
        "sinaisNoRisco": sinais,
        "gastoAnualComunidade": round(gasto_anual, 2),
    }


def percentil(registros: list[dict], score: int) -> dict:
    """Quantas avaliações tiveram pontuação menor que a informada."""
    scores = [_numero(r.get("score")) for r in registros]
    total = len(scores)
    if total < MINIMO_GRUPO:
        return {"score": score, "total": total, "suficiente": False}
    menores = sum(1 for s in scores if s < score)
    iguais = sum(1 for s in scores if s == score)
    pct = round(100 * (menores + iguais / 2) / total)
    media = round(sum(scores) / total, 1)
    if score > media:
        mensagem = (f"Sua pontuação ficou acima da média de quem fez a avaliação aqui ({str(media).replace('.', ',')}). "
                    "Isso mostra que vale a pena agir agora, e você já começou.")
    elif score == 0:
        mensagem = "Sua pontuação está entre as mais baixas da comunidade. Continue assim e fique atento(a)."
    else:
        mensagem = (f"Sua pontuação ficou abaixo ou na média da comunidade ({str(media).replace('.', ',')}). "
                    "Mesmo assim, pequenos sinais merecem atenção.")
    return {"score": score, "total": total, "suficiente": True, "percentil": pct,
            "mediaScore": media, "mensagem": mensagem}


# --------------------------------------------------------------------------- moderação

def _normalizar(texto: str) -> str:
    sem_acento = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    sem_acento = sem_acento.lower()
    # Desfaz trocas comuns usadas para burlar filtros: "p0rr4", "m3rd@"
    return sem_acento.translate(str.maketrans("013457@$", "oieastas"))


PALAVROES = [
    "porra", "caralho", "merda", "puta", "puto", "fdp", "foda se", "foder", "fodase", "buceta", "cuzao",
    "arrombado", "viado", "retardado", "vagabunda", "desgracado", "desgracada", "piranha", "vadia",
]
DIVULGACAO = [
    "codigo promocional", "cupom", "link na bio", "cadastre se", "cadastra ai", "plataforma pagando",
    "plataforma nova", "deposite", "deposito minimo", "bonus de cadastro", "sinais do aviator",
    "grupo de sinais", "estrategia infalivel", "ganhe dinheiro", "renda extra", "chama no direct",
    "chama no zap", "me chama no", "telegram", "whatsapp",
]
RE_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+")
RE_TELEFONE = re.compile(r"(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?9?\d{4}[\s.-]?\d{4}\b")
RE_CPF = re.compile(r"\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b")
RE_LINK = re.compile(r"(https?://|www\.|\.com\b|\.bet\b|\.net\b|\.io\b|\.ly\b)", re.I)


def _contem(texto_norm: str, termos: list[str]) -> bool:
    plano = " " + " ".join(re.sub(r"[^a-z0-9]+", " ", texto_norm).split()) + " "
    return any(f" {t} " in plano for t in termos)


def moderar(texto: str) -> dict:
    if not isinstance(texto, str) or not texto.strip():
        return {"aprovado": False, "motivo": "Escreva uma mensagem."}
    if RE_LINK.search(texto):
        return {"aprovado": False, "motivo": "Links não são permitidos no mural."}
    if RE_EMAIL.search(texto):
        return {"aprovado": False, "motivo": "Para proteger você, não coloque e-mails no mural."}
    if RE_CPF.search(texto):
        return {"aprovado": False, "motivo": "Para proteger você, não coloque documentos no mural."}
    if RE_TELEFONE.search(texto):
        return {"aprovado": False, "motivo": "Para proteger você, não coloque números de telefone no mural."}
    norm = _normalizar(texto)
    if _contem(norm, DIVULGACAO):
        return {"aprovado": False, "motivo": "Mensagens que divulgam apostas ou contatos não são permitidas."}
    if _contem(norm, PALAVROES):
        return {"aprovado": False, "motivo": "Sua mensagem tem palavras ofensivas. Reescreva com carinho, por favor."}
    letras = [c for c in texto if c.isalpha()]
    if len(letras) >= 20 and sum(c.isupper() for c in letras) / len(letras) > 0.7:
        return {"aprovado": False, "motivo": "Evite escrever tudo em letras maiúsculas."}
    if re.search(r"(.)\1{7,}", texto):
        return {"aprovado": False, "motivo": "A mensagem tem caracteres repetidos demais."}
    return {"aprovado": True, "motivo": ""}


# --------------------------------------------------------------------------- HTTP

def _avaliacoes(corpo) -> list[dict]:
    lista = corpo.get("avaliacoes") if isinstance(corpo, dict) else None
    return [r for r in lista if isinstance(r, dict)] if isinstance(lista, list) else []


def criar_handler():
    class Handler(BaseHTTPRequestHandler):
        server_version = "RecomecoAnalise/1.0"

        def log_message(self, formato, *args):  # silencioso, como o servidor Java
            pass

        def _json(self, status: int, corpo) -> None:
            dados = json.dumps(corpo, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(dados)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(dados)

        def do_GET(self):
            if urlparse(self.path).path == "/saude":
                return self._json(200, {"ok": True})
            return self._json(404, {"erro": "Rota não encontrada."})

        def do_POST(self):
            rota = urlparse(self.path).path
            if rota not in ("/moderar", "/resumo", "/percentil"):
                return self._json(404, {"erro": "Rota não encontrada."})
            tamanho = int(self.headers.get("Content-Length") or 0)
            if tamanho > (MAX_TEXTO if rota == "/moderar" else MAX_AVALIACOES):
                return self._json(413, {"erro": "Conteúdo grande demais."})
            try:
                corpo = json.loads(self.rfile.read(tamanho) or b"{}")
            except (json.JSONDecodeError, UnicodeDecodeError):
                return self._json(400, {"erro": "JSON inválido."})
            if rota == "/moderar":
                return self._json(200, moderar(corpo.get("texto") if isinstance(corpo, dict) else None))
            if rota == "/resumo":
                return self._json(200, resumo(_avaliacoes(corpo)))
            score = corpo.get("score") if isinstance(corpo, dict) else None
            if not isinstance(score, int) or isinstance(score, bool) or not 0 <= score <= 27:
                return self._json(400, {"erro": "Informe uma pontuação entre 0 e 27."})
            return self._json(200, percentil(_avaliacoes(corpo), score))

    return Handler


def main() -> None:
    porta = int(os.environ.get("ANALISE_PORTA", "8081"))
    host = os.environ.get("ANALISE_HOST", "127.0.0.1")
    servidor = ThreadingHTTPServer((host, porta), criar_handler())
    print(f"Análise do Recomeço rodando em http://{host}:{porta}", flush=True)
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
