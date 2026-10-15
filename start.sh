#!/bin/sh
# Ponto de entrada do container (ver Dockerfile).
# Sobe o serviço de análise (Python) em segundo plano, só em 127.0.0.1, e o servidor
# Java em primeiro plano. Se o Python cair, o site continua funcionando sem a análise.
cd "$(dirname "$0")"

ANALISE_HOST=127.0.0.1 python3 analise/servico.py &

# A pasta de dados só seria usada sem banco, o que o Dockerfile impede (EXIGIR_BANCO=1).
exec java -cp "out:lib/*" br.com.recomeco.Main frontend /tmp/recomeco-dados
