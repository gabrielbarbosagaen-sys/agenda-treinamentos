@echo off
chcp 65001 >nul
title Teste local - Agendamento de Treinamentos
cd /d "%~dp0"
if not exist node_modules (
  echo Instalando dependencias pela primeira vez...
  call npm install --no-audit --no-fund
)
set ABRIR=1
node servidor.js
pause
