@echo off
chcp 65001 >nul
rem Compila o backend Java e sobe os dois servicos: analise (Python) e site (Java).
rem Le as variaveis do arquivo .env, se existir (veja .env.example).
cd /d "%~dp0"
setlocal

if exist .env (
  for /f "usebackq eol=# tokens=1* delims==" %%a in (".env") do if not "%%b"=="" set "%%a=%%b"
)

rem Driver JDBC do Postgres (o mesmo do Dockerfile), baixado uma vez e conferido pelo SHA-256.
set "PG_JDBC=backend\lib\postgresql-42.7.14.jar"
set "PG_JDBC_SHA256=73914527305a40cce504b0d3d90b23caf565136912d607ae8ae7c5895512332c"
if not exist "%PG_JDBC%" call :baixar_driver || exit /b 1

if not exist backend\out mkdir backend\out
if not exist data mkdir data
javac -encoding UTF-8 -d backend\out backend\src\br\com\recomeco\*.java || exit /b 1

where python >nul 2>nul
if %errorlevel%==0 (
  start "Recomeco analise (Python)" /min python analise\servico.py
) else (
  echo Python nao encontrado: o site funciona, mas sem a analise detalhada e a moderacao avancada do mural.
)

java -cp "backend\out;backend\lib\*" br.com.recomeco.Main frontend data
exit /b

:baixar_driver
if not exist backend\lib mkdir backend\lib
curl -fsSL -o "%PG_JDBC%.tmp" "https://repo1.maven.org/maven2/org/postgresql/postgresql/42.7.14/postgresql-42.7.14.jar"
if errorlevel 1 (
  del "%PG_JDBC%.tmp" 2>nul
  echo Nao foi possivel baixar o driver do Postgres: sem banco, os dados ficam na pasta data\.
  exit /b 0
)
set "SOMA="
for /f "skip=1 delims=" %%h in ('certutil -hashfile "%PG_JDBC%.tmp" SHA256') do if not defined SOMA set "SOMA=%%h"
set "SOMA=%SOMA: =%"
if /i "%SOMA%"=="%PG_JDBC_SHA256%" (
  move /y "%PG_JDBC%.tmp" "%PG_JDBC%" >nul
  exit /b 0
)
del "%PG_JDBC%.tmp"
echo O driver do Postgres baixado nao confere com o SHA-256 esperado.
exit /b 1
