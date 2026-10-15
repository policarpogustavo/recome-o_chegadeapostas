@echo off
chcp 65001 >nul
rem Compila o backend Java e sobe os dois servicos: analise (Python) e site (Java).
cd /d "%~dp0"
if not exist backend\out mkdir backend\out
if not exist data mkdir data
javac -encoding UTF-8 -d backend\out backend\src\br\com\recomeco\*.java || exit /b 1

where python >nul 2>nul
if %errorlevel%==0 (
  start "Recomeco analise (Python)" /min python analise\servico.py data
) else (
  echo Python nao encontrado: o site funciona, mas sem a analise detalhada e a moderacao avancada do mural.
)

java -cp backend\out br.com.recomeco.Main frontend data
