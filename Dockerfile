# Imagem do Recomeço para o Render: servidor Java + serviço de análise em Python no mesmo container.
# O Python ouve só em 127.0.0.1 e não fica exposto na internet; só a porta do Java é pública.

# ---------------------------------------------------------------- compilação
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app

# Driver JDBC do Postgres, conferido pelo SHA-256 (o mesmo usado em run.sh e run.bat).
ARG PG_JDBC_VERSAO=42.7.14
ARG PG_JDBC_SHA256=73914527305a40cce504b0d3d90b23caf565136912d607ae8ae7c5895512332c
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && rm -rf /var/lib/apt/lists/* \
 && mkdir lib \
 && curl -fsSL -o lib/postgresql-${PG_JDBC_VERSAO}.jar \
      https://repo1.maven.org/maven2/org/postgresql/postgresql/${PG_JDBC_VERSAO}/postgresql-${PG_JDBC_VERSAO}.jar \
 && echo "${PG_JDBC_SHA256}  lib/postgresql-${PG_JDBC_VERSAO}.jar" | sha256sum -c -

COPY backend/src backend/src
RUN javac --release 21 -encoding UTF-8 -d out backend/src/br/com/recomeco/*.java

# ---------------------------------------------------------------- execução
FROM eclipse-temurin:21-jre
RUN apt-get update && apt-get install -y --no-install-recommends python3 && rm -rf /var/lib/apt/lists/* \
 && useradd --system --create-home --shell /usr/sbin/nologin recomeco

WORKDIR /app
COPY --from=build /app/out out
COPY --from=build /app/lib lib
COPY frontend frontend
COPY analise/servico.py analise/servico.py
COPY start.sh start.sh

USER recomeco
# O plano gratuito do Render tem 512 MB de memória.
ENV PORT=8080 \
    ANALISE_URL=http://127.0.0.1:8081 \
    CONFIAR_PROXY=1 \
    EXIGIR_BANCO=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=60 -XX:+UseSerialGC -Xss512k"
EXPOSE 8080
CMD ["sh", "start.sh"]
