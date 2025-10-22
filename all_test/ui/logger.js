const fs = require('fs');
const path = require('path');

class Logger {
    constructor() {
        this.logDir = path.join(__dirname, 'logs');
        this.currentLogFile = null;
        this.ensureLogDir();
        this.createLogFile();
        this.originalConsole = {
            log: console.log,
            error: console.error,
            warn: console.warn,
            info: console.info,
            debug: console.debug
        };
        this.setupConsoleRedirection();
    }

    // 确保logs目录存在
    ensureLogDir() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
            this.writeToLog(`[${this.getTimestamp()}] 日志目录已创建: ${this.logDir}`);
        }
    }

    // 创建日志文件，格式：年-月-日-小时-分钟.log
    createLogFile() {
        const now = new Date();
        const timestamp = now.toISOString().slice(0, 16).replace(/:/g, '-').replace('T', '-');
        const filename = `${timestamp}.log`;
        this.currentLogFile = path.join(this.logDir, filename);
        
        // 写入文件头
        const header = `=== 应用程序日志文件 ===\n` +
                      `创建时间: ${now.toLocaleString('zh-CN')}\n` +
                      `日志文件: ${filename}\n` +
                      `================================\n\n`;
        
        fs.writeFileSync(this.currentLogFile, header, 'utf8');
        this.writeToLog(`[${this.getTimestamp()}] 日志文件已创建: ${this.currentLogFile}`);
    }

    // 获取当前时间戳
    getTimestamp() {
        return new Date().toLocaleString('zh-CN');
    }

    // 写入日志到文件
    writeToLog(message) {
        if (this.currentLogFile) {
            try {
                fs.appendFileSync(this.currentLogFile, message + '\n', 'utf8');
            } catch (error) {
                // 如果写入失败，回退到原始控制台输出
                this.originalConsole.error(`日志写入失败: ${error.message}`);
            }
        }
    }

    // 设置控制台重定向
    setupConsoleRedirection() {
        // 重写console.log
        console.log = (...args) => {
            const message = `[${this.getTimestamp()}] [INFO] ${args.join(' ')}`;
            this.writeToLog(message);
            this.originalConsole.log(...args);
        };

        // 重写console.error
        console.error = (...args) => {
            const message = `[${this.getTimestamp()}] [ERROR] ${args.join(' ')}`;
            this.writeToLog(message);
            this.originalConsole.error(...args);
        };

        // 重写console.warn
        console.warn = (...args) => {
            const message = `[${this.getTimestamp()}] [WARN] ${args.join(' ')}`;
            this.writeToLog(message);
            this.originalConsole.warn(...args);
        };

        // 重写console.info
        console.info = (...args) => {
            const message = `[${this.getTimestamp()}] [INFO] ${args.join(' ')}`;
            this.writeToLog(message);
            this.originalConsole.info(...args);
        };

        // 重写console.debug
        console.debug = (...args) => {
            const message = `[${this.getTimestamp()}] [DEBUG] ${args.join(' ')}`;
            this.writeToLog(message);
            this.originalConsole.debug(...args);
        };
    }

    // 自定义日志方法
    info(message) {
        console.info(message);
    }

    error(message) {
        console.error(message);
    }

    warn(message) {
        console.warn(message);
    }

    debug(message) {
        console.debug(message);
    }

    // 获取当前日志文件路径
    getCurrentLogFile() {
        return this.currentLogFile;
    }

    // 获取日志目录
    getLogDir() {
        return this.logDir;
    }
}

// 创建全局日志实例
const logger = new Logger();

module.exports = logger;