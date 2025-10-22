@echo off
echo 启动本地题库服务...
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

echo 启动本地题库服务...
echo 服务地址: http://localhost:3001
echo 按 Ctrl+C 停止服务
echo.

npm start

pause
