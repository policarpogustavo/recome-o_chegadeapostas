"""Testes do serviço de análise. Rode com: python -m unittest discover analise"""

import json
import threading
import unittest
import urllib.request
from http.server import ThreadingHTTPServer

from servico import criar_handler, moderar, percentil, resumo


def avaliacao(score, nivel, faixa="25-34", dia=(), data="2026-10-01T12:00:00Z", gasto=300):
    return {"score": score, "nivel": nivel, "faixaEtaria": faixa, "diaADia": list(dia), "data": data,
            "gastoMensal": gasto}


class ModeracaoTest(unittest.TestCase):
    def test_aprova_mensagem_de_apoio(self):
        self.assertTrue(moderar("Estou há 30 dias sem apostar. Você também consegue, força!")["aprovado"])

    def test_recusa_links_contatos_e_documentos(self):
        for texto in ["entra em www.exemplo.com", "meu email é ana@exemplo.com.br",
                      "me liga (11) 98765-4321", "cpf 123.456.789-09"]:
            self.assertFalse(moderar(texto)["aprovado"], texto)

    def test_recusa_divulgacao_de_apostas(self):
        r = moderar("Usa o código promocional que a plataforma pagando é essa")
        self.assertFalse(r["aprovado"])
        self.assertIn("divulgam", r["motivo"])

    def test_recusa_palavrao_mesmo_disfarcado(self):
        self.assertFalse(moderar("que p0rr4 de vida")["aprovado"])

    def test_nao_confunde_palavras_parecidas(self):
        # "computador" contém "puta", mas não é palavrão
        self.assertTrue(moderar("Troquei o computador de lugar para não apostar")["aprovado"])

    def test_recusa_texto_todo_em_maiusculas(self):
        self.assertFalse(moderar("PAREM DE APOSTAR AGORA MESMO GENTE")["aprovado"])


class AnaliseTest(unittest.TestCase):
    def test_percentil_precisa_de_amostra(self):
        self.assertFalse(percentil([avaliacao(3, "moderado")], 5)["suficiente"])

    def test_percentil(self):
        regs = [avaliacao(s, "baixo") for s in (0, 1, 2, 3, 4, 5, 6, 7, 8, 9)]
        r = percentil(regs, 9)
        self.assertTrue(r["suficiente"])
        self.assertEqual(r["percentil"], 95)

    def test_resumo_por_faixa_e_sinais(self):
        regs = (
            [avaliacao(10, "problematico", "18-24", ["recuperar_perdas", "mente"]) for _ in range(3)]
            + [avaliacao(5, "moderado", "18-24", ["recuperar_perdas"]) for _ in range(2)]
            + [avaliacao(0, "sem_risco", "45-59") for _ in range(5)]
        )
        r = resumo(regs)
        self.assertTrue(r["suficiente"])
        self.assertEqual(r["total"], 10)
        faixa = next(f for f in r["porFaixa"] if f["faixa"] == "18-24")
        self.assertEqual(faixa["percentRisco"], 100.0)
        self.assertEqual(r["sinaisNoRisco"][0]["sinal"], "recuperar_perdas")
        self.assertEqual(r["sinaisNoRisco"][0]["percent"], 100.0)
        self.assertEqual(r["gastoAnualComunidade"], 300 * 10 * 12)

    def test_resumo_esconde_grupos_pequenos(self):
        # Com 1 pessoa na faixa 60+, a média dela seria a pontuação dela: não pode aparecer.
        regs = [avaliacao(2, "baixo", "25-34") for _ in range(5)] + [avaliacao(20, "problematico", "60+", ["mente"])]
        r = resumo(regs)
        self.assertEqual([f["faixa"] for f in r["porFaixa"]], ["25-34"])
        self.assertEqual(r["sinaisNoRisco"], [])

    def test_resumo_com_poucas_avaliacoes(self):
        r = resumo([avaliacao(7, "moderado")])
        self.assertFalse(r["suficiente"])
        self.assertEqual(r["porFaixa"], [])


class HttpTest(unittest.TestCase):
    """Sobe o serviço numa porta livre e chama as rotas como o Java faz."""

    @classmethod
    def setUpClass(cls):
        cls.servidor = ThreadingHTTPServer(("127.0.0.1", 0), criar_handler())
        cls.base = f"http://127.0.0.1:{cls.servidor.server_address[1]}"
        threading.Thread(target=cls.servidor.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.servidor.shutdown()
        cls.servidor.server_close()

    def post(self, rota, corpo):
        req = urllib.request.Request(self.base + rota, data=json.dumps(corpo).encode(),
                                     headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req) as res:
                return res.status, json.loads(res.read())
        except urllib.error.HTTPError as e:
            with e:
                return e.code, json.loads(e.read())

    def test_saude(self):
        with urllib.request.urlopen(self.base + "/saude") as res:
            self.assertEqual(json.loads(res.read()), {"ok": True})

    def test_resumo_e_percentil_recebem_as_avaliacoes(self):
        regs = [avaliacao(s, "baixo") for s in range(10)]
        status, r = self.post("/resumo", {"avaliacoes": regs})
        self.assertEqual((status, r["total"]), (200, 10))
        status, r = self.post("/percentil", {"avaliacoes": regs, "score": 9})
        self.assertEqual((status, r["percentil"]), (200, 95))

    def test_percentil_valida_pontuacao(self):
        for score in (28, -1, "5", True, None):
            self.assertEqual(self.post("/percentil", {"avaliacoes": [], "score": score})[0], 400, score)

    def test_ignora_lixo_na_lista(self):
        status, r = self.post("/resumo", {"avaliacoes": [1, "x", None]})
        self.assertEqual((status, r["total"]), (200, 0))


if __name__ == "__main__":
    unittest.main()
