"""Testes do serviço de análise. Rode com: python -m unittest discover analise"""

import json
import tempfile
import unittest
from pathlib import Path

from servico import Avaliacoes, moderar, percentil, resumo


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
        regs = [
            avaliacao(10, "problematico", "18-24", ["recuperar_perdas", "mente"]),
            avaliacao(5, "moderado", "18-24", ["recuperar_perdas"]),
            avaliacao(0, "sem_risco", "45-59"),
        ]
        r = resumo(regs)
        self.assertEqual(r["total"], 3)
        faixa = next(f for f in r["porFaixa"] if f["faixa"] == "18-24")
        self.assertEqual(faixa["percentRisco"], 100.0)
        self.assertEqual(r["sinaisNoRisco"][0]["sinal"], "recuperar_perdas")
        self.assertEqual(r["sinaisNoRisco"][0]["percent"], 100.0)
        self.assertEqual(r["gastoAnualComunidade"], 300 * 3 * 12)

    def test_le_arquivo_e_ignora_linhas_quebradas(self):
        with tempfile.TemporaryDirectory() as pasta:
            arq = Path(pasta) / "avaliacoes.jsonl"
            arq.write_text(json.dumps(avaliacao(4, "moderado")) + "\n{quebrada\n", encoding="utf-8")
            self.assertEqual(len(Avaliacoes(arq).todas()), 1)
            self.assertEqual(Avaliacoes(Path(pasta) / "nao-existe.jsonl").todas(), [])


if __name__ == "__main__":
    unittest.main()
