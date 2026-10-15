#!/usr/bin/env sh
# Compila o backend Java e sobe os dois serviços: análise (Python) e site (Java).
# Lê as variáveis do arquivo .env, se existir (veja .env.example).
cd "$(dirname "$0")"

if [ -f .env ]; then
  set -a; . ./.env; set +a
fi

# Driver JDBC do Postgres (o mesmo do Dockerfile), baixado uma vez e conferido pelo SHA-256.
PG_JDBC=backend/lib/postgresql-42.7.14.jar
PG_JDBC_SHA256=73914527305a40cce504b0d3d90b23caf565136912d607ae8ae7c5895512332c
if [ ! -f "$PG_JDBC" ]; then
  mkdir -p backend/lib
  if curl -fsSL -o "$PG_JDBC.tmp" "https://repo1.maven.org/maven2/org/postgresql/postgresql/42.7.14/postgresql-42.7.14.jar"; then
    SOMA=$( (sha256sum "$PG_JDBC.tmp" 2>/dev/null || shasum -a 256 "$PG_JDBC.tmp") | cut -d' ' -f1)
    if [ "$SOMA" = "$PG_JDBC_SHA256" ]; then mv "$PG_JDBC.tmp" "$PG_JDBC"
    else rm -f "$PG_JDBC.tmp"; echo "O driver do Postgres baixado não confere com o SHA-256 esperado."; exit 1; fi
  else
    rm -f "$PG_JDBC.tmp"
    echo "Não foi possível baixar o driver do Postgres: sem banco, os dados ficam na pasta data/."
  fi
fi

mkdir -p backend/out data
javac -encoding UTF-8 -d backend/out backend/src/br/com/recomeco/*.java || exit 1

PY=$(command -v python3 || command -v python)
if [ -n "$PY" ]; then
  "$PY" analise/servico.py &
  PY_PID=$!
  trap 'kill $PY_PID 2>/dev/null' EXIT INT TERM
else
  echo "Python não encontrado: o site funciona, mas sem a análise detalhada e a moderação avançada do mural."
fi

java -cp "backend/out:backend/lib/*" br.com.recomeco.Main frontend data
