@echo off
cd /d "%~dp0"
if not exist backend\out mkdir backend\out
javac -encoding UTF-8 -d backend\out backend\src\br\com\recomeco\*.java || exit /b 1
java -cp backend\out br.com.recomeco.Main frontend data
