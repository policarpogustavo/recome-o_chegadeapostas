#!/usr/bin/env sh
# Compila o backend Java e sobe os dois serviços: análise (Python) e site (Java).
cd "$(dirname "$0")"
mkdir -p backend/out data
javac -encoding UTF-8 -d backend/out backend/src/br/com/recomeco/*.java || exit 1

PY=$(command -v python3 || command -v python)
if [ -n "$PY" ]; then
  "$PY" analise/servico.py data &
  PY_PID=$!
  trap 'kill $PY_PID 2>/dev/null' EXIT INT TERM
else
  echo "Python não encontrado: o site funciona, mas sem a análise detalhada e a moderação avançada do mural."
fi

java -cp backend/out br.com.recomeco.Main frontend data
