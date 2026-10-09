@echo off
chcp 65001 > nul
title Lounge Discord Bot - Launcher
color 0B

echo =======================================================
echo          LOUNGE DISCORD BOT - CONTROL PANEL
echo =======================================================
echo.

:: Проверка наличия Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js не обнаружен в вашей системе!
    echo Установите Node.js версии 18 или новее с официального сайта:
    echo https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: Проверка файла .env
if not exist ".env" (
    echo [ПРЕДУПРЕЖДЕНИЕ] Файл конфигурации .env не найден!
    if exist ".env.example" (
        echo Создаю .env на основе .env.example...
        copy .env.example .env > nul
        echo Файл .env успешно создан! Пожалуйста, откройте его и укажите DISCORD_TOKEN, CLIENT_ID и GUILD_ID.
        echo.
        notepad .env
    ) else (
        echo Файл .env.example также не найден.
    )
    echo Нажмите любую клавишу после настройки файла .env...
    pause > nul
)

:: Проверка зависимостей
if not exist "node_modules" (
    echo [ИНФО] Папка node_modules не найдена. Устанавливаю зависимости через npm...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Ошибка при установке npm-пакетов!
        pause
        exit /b 1
    )
)

:MENU
cls
echo =======================================================
echo          LOUNGE DISCORD BOT - CONTROL PANEL
echo =======================================================
echo.
echo  1. Регистрация слэш-команд в Discord (npm run deploy)
echo  2. Запуск бота (npm start)
echo  3. Зарегистрировать команды и сразу запустить бота
echo  4. Установить / обновить зависимости (npm install)
echo  5. Открыть файл .env в Блокноте
echo  6. Выход
echo.
echo =======================================================
set /p choice="Выберите действие (1-6): "

if "%choice%"=="1" (
    echo.
    echo [ДЕЙСТВИЕ] Регистрация слэш-команд через Discord REST API...
    node src/deploy-commands.js
    echo.
    echo Нажмите любую клавишу для возврата в меню...
    pause > nul
    goto MENU
)

if "%choice%"=="2" (
    echo.
    echo [ДЕЙСТВИЕ] Запуск Lounge Discord Bot...
    node src/index.js
    echo.
    pause
    goto MENU
)

if "%choice%"=="3" (
    echo.
    echo [ДЕЙСТВИЕ 1/2] Регистрация команд...
    node src/deploy-commands.js
    echo.
    echo [ДЕЙСТВИЕ 2/2] Запуск бота...
    node src/index.js
    echo.
    pause
    goto MENU
)

if "%choice%"=="4" (
    echo.
    echo [ДЕЙСТВИЕ] Установка зависимостей...
    call npm install
    echo.
    pause
    goto MENU
)

if "%choice%"=="5" (
    notepad .env
    goto MENU
)

if "%choice%"=="6" (
    exit /b 0
)

echo Неверный выбор, попробуйте снова.
timeout /t 2 > nul
goto MENU
