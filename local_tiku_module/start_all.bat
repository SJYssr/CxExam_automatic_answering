@echo off
echo ========================================
echo    本地题库模块启动脚本
echo ========================================
echo.

cd /d "%~dp0"

echo 检查Node.js环境...
node --version >nul 2>&1
if errorlevel 1 (
    echo 错误: 未找到Node.js，请先安装Node.js
    pause
    exit /b 1
)

echo 检查依赖包...
if not exist "node_modules" (
    echo 正在安装依赖包...
    npm install
    if errorlevel 1 (
        echo 错误: 依赖包安装失败
        pause
        exit /b 1
    )
)

echo.
echo 选择启动模式:
echo 1. 启动题库服务 (端口3001)
echo 2. 启动题库导入工具 (端口3002)
echo 3. 同时启动服务和工具
echo 4. 退出
echo.

set /p choice="请输入选择 (1-4): "

if "%choice%"=="1" goto start_service
if "%choice%"=="2" goto start_tool
if "%choice%"=="3" goto start_both
if "%choice%"=="4" goto exit
goto invalid_choice

:start_service
echo.
echo 启动题库服务...
echo 服务地址: http://localhost:3001
echo 按 Ctrl+C 停止服务
echo.
npm start
goto end

:start_tool
echo.
echo 启动题库导入工具...
echo 工具地址: http://localhost:3002
echo 按 Ctrl+C 停止工具
echo.
npm run import-tool
goto end

:start_both
echo.
echo 同时启动服务和工具...
echo 题库服务: http://localhost:3001
echo 导入工具: http://localhost:3002
echo 按 Ctrl+C 停止所有服务
echo.
start "题库服务" cmd /k "npm start"
timeout /t 2 /nobreak >nul
start "导入工具" cmd /k "npm run import-tool"
echo 服务和工具已启动，请查看新打开的窗口
pause
goto end

:invalid_choice
echo 无效选择，请重新运行脚本
pause
goto end

:exit
echo 退出
goto end

:end
