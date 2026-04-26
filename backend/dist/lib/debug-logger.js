"use strict";
/**
 * Centralized Debug Logging System
 * Provides structured logging with levels, timestamps, and contextual data
 * Automatically sanitizes sensitive data in production
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchError = exports.batchComplete = exports.batchStart = exports.performance = exports.orgChartAction = exports.componentError = exports.componentRender = exports.permissionCheck = exports.roleManagement = exports.userAction = exports.databaseError = exports.databaseQuery = exports.apiResponse = exports.apiCall = exports.error = exports.warn = exports.info = exports.debug = exports.logger = exports.LogLevel = void 0;
const config_1 = require("./config");
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
class DebugLogger {
    constructor() {
        this.sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'api_key', 'authorization', 'cookie', 'sessionId', 'session_id'];
        this.isDevelopment = config_1.config.isDevelopment;
        const logLevel = config_1.config.logging.level;
        this.minLevel = logLevel === 'debug' ? LogLevel.DEBUG :
            logLevel === 'info' ? LogLevel.INFO :
                logLevel === 'warn' ? LogLevel.WARN :
                    LogLevel.ERROR;
    }
    /**
     * Sanitize sensitive data in objects before logging
     * Only runs in production for performance
     */
    sanitize(obj) {
        if (!config_1.config.logging.sanitizeSensitiveData) {
            return obj;
        }
        if (typeof obj !== 'object' || obj === null) {
            return obj;
        }
        if (Array.isArray(obj)) {
            return obj.map((item) => this.sanitize(item));
        }
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            const keyLower = key.toLowerCase();
            const isSensitive = this.sensitiveFields.some((field) => keyLower.includes(field.toLowerCase()));
            if (isSensitive) {
                sanitized[key] = '[REDACTED]';
            }
            else if (typeof value === 'object' && value !== null) {
                sanitized[key] = this.sanitize(value);
            }
            else {
                sanitized[key] = value;
            }
        }
        return sanitized;
    }
    formatTimestamp() {
        return new Date().toISOString();
    }
    getColor(level) {
        const colors = {
            [LogLevel.DEBUG]: '\x1b[36m', // Cyan
            [LogLevel.INFO]: '\x1b[32m', // Green
            [LogLevel.WARN]: '\x1b[33m', // Yellow
            [LogLevel.ERROR]: '\x1b[31m', // Red
        };
        return colors[level] || '\x1b[0m';
    }
    getLevelName(level) {
        const names = {
            [LogLevel.DEBUG]: 'DEBUG',
            [LogLevel.INFO]: 'INFO',
            [LogLevel.WARN]: 'WARN',
            [LogLevel.ERROR]: 'ERROR',
        };
        return names[level] || 'UNKNOWN';
    }
    formatContext(context) {
        if (!context)
            return '';
        const parts = [];
        if (context.function)
            parts.push(`fn:${context.function}`);
        if (context.component)
            parts.push(`comp:${context.component}`);
        if (context.userId)
            parts.push(`user:${context.userId}`);
        if (context.roleId)
            parts.push(`role:${context.roleId}`);
        if (context.departmentId)
            parts.push(`dept:${context.departmentId}`);
        if (context.action)
            parts.push(`action:${context.action}`);
        return parts.length > 0 ? `[${parts.join(' ')}]` : '';
    }
    shouldLog(level) {
        return level >= this.minLevel;
    }
    log(level, message, context, error) {
        if (!this.shouldLog(level))
            return;
        const timestamp = this.formatTimestamp();
        const levelName = this.getLevelName(level);
        // Sanitize context in production
        const sanitizedContext = this.sanitize(context);
        const contextStr = this.formatContext(sanitizedContext);
        const color = this.getColor(level);
        const reset = '\x1b[0m';
        const logMessage = `${color}[${timestamp}] ${levelName}${reset} ${contextStr} ${message}`;
        if (error) {
            // In production, don't log full stack traces
            if (config_1.config.logging.includeStackTrace) {
                console.error(logMessage, error);
            }
            else {
                console.error(logMessage, error.message);
            }
        }
        else {
            console.log(logMessage);
        }
        // In development, also log to browser console if available
        if (this.isDevelopment && typeof window !== 'undefined') {
            const browserLog = {
                level: levelName,
                message,
                timestamp,
                context: sanitizedContext,
                error: config_1.config.logging.includeStackTrace ? error?.stack : error?.message,
            };
            switch (level) {
                case LogLevel.DEBUG:
                    console.debug('🔍 [DEBUG]', browserLog);
                    break;
                case LogLevel.INFO:
                    console.info('ℹ️ [INFO]', browserLog);
                    break;
                case LogLevel.WARN:
                    console.warn('⚠️ [WARN]', browserLog);
                    break;
                case LogLevel.ERROR:
                    console.error('❌ [ERROR]', browserLog);
                    break;
            }
        }
    }
    debug(message, context) {
        this.log(LogLevel.DEBUG, message, context);
    }
    info(message, context) {
        this.log(LogLevel.INFO, message, context);
    }
    warn(message, context) {
        this.log(LogLevel.WARN, message, context);
    }
    error(message, context, error) {
        this.log(LogLevel.ERROR, message, context, error);
    }
    // Specialized logging methods for common scenarios
    apiCall(method, endpoint, context) {
        this.info(`API ${method} ${endpoint}`, { ...context, action: 'api_call' });
    }
    apiResponse(method, endpoint, status, context) {
        const level = status >= 400 ? LogLevel.ERROR : LogLevel.INFO;
        this.log(level, `API ${method} ${endpoint} -> ${status}`, { ...context, action: 'api_response' });
    }
    databaseQuery(operation, table, context) {
        this.debug(`DB ${operation} ${table}`, { ...context, action: 'db_query' });
    }
    databaseError(operation, table, error, context) {
        this.error(`DB ${operation} ${table} failed`, { ...context, action: 'db_error' }, error);
    }
    userAction(action, userId, context) {
        this.info(`User ${action}`, { ...context, userId, action: 'user_action' });
    }
    roleManagement(action, roleId, userId, context) {
        this.info(`Role ${action}`, { ...context, roleId, userId, action: 'role_management' });
    }
    permissionCheck(permission, userId, granted, context) {
        const level = granted ? LogLevel.DEBUG : LogLevel.WARN;
        this.log(level, `Permission ${permission}: ${granted ? 'GRANTED' : 'DENIED'}`, {
            ...context,
            userId,
            action: 'permission_check'
        });
    }
    componentRender(component, props, context) {
        this.debug(`Component ${component} rendered`, { ...context, component, action: 'component_render' });
    }
    componentError(component, error, context) {
        this.error(`Component ${component} error`, { ...context, component, action: 'component_error' }, error);
    }
    orgChartAction(action, nodeId, context) {
        this.debug(`OrgChart ${action}`, { ...context, nodeId, action: 'org_chart' });
    }
    // Performance logging
    performance(operation, duration, context) {
        const level = duration > 1000 ? LogLevel.WARN : LogLevel.DEBUG;
        this.log(level, `${operation} took ${duration}ms`, { ...context, action: 'performance' });
    }
    // Batch operations
    batchStart(operation, count, context) {
        this.info(`Starting batch ${operation} (${count} items)`, { ...context, action: 'batch_start' });
    }
    batchComplete(operation, count, duration, context) {
        this.info(`Completed batch ${operation} (${count} items) in ${duration}ms`, {
            ...context,
            action: 'batch_complete'
        });
    }
    batchError(operation, error, context) {
        this.error(`Batch ${operation} failed`, { ...context, action: 'batch_error' }, error);
    }
}
// Export singleton instance
exports.logger = new DebugLogger();
// Export convenience functions
const debug = (message, context) => exports.logger.debug(message, context);
exports.debug = debug;
const info = (message, context) => exports.logger.info(message, context);
exports.info = info;
const warn = (message, context) => exports.logger.warn(message, context);
exports.warn = warn;
const error = (message, context, err) => exports.logger.error(message, context, err);
exports.error = error;
// Export specialized functions
const apiCall = (method, endpoint, context) => exports.logger.apiCall(method, endpoint, context);
exports.apiCall = apiCall;
const apiResponse = (method, endpoint, status, context) => exports.logger.apiResponse(method, endpoint, status, context);
exports.apiResponse = apiResponse;
const databaseQuery = (operation, table, context) => exports.logger.databaseQuery(operation, table, context);
exports.databaseQuery = databaseQuery;
const databaseError = (operation, table, error, context) => exports.logger.databaseError(operation, table, error, context);
exports.databaseError = databaseError;
const userAction = (action, userId, context) => exports.logger.userAction(action, userId, context);
exports.userAction = userAction;
const roleManagement = (action, roleId, userId, context) => exports.logger.roleManagement(action, roleId, userId, context);
exports.roleManagement = roleManagement;
const permissionCheck = (permission, userId, granted, context) => exports.logger.permissionCheck(permission, userId, granted, context);
exports.permissionCheck = permissionCheck;
const componentRender = (component, props, context) => exports.logger.componentRender(component, props, context);
exports.componentRender = componentRender;
const componentError = (component, error, context) => exports.logger.componentError(component, error, context);
exports.componentError = componentError;
const orgChartAction = (action, nodeId, context) => exports.logger.orgChartAction(action, nodeId, context);
exports.orgChartAction = orgChartAction;
const performance = (operation, duration, context) => exports.logger.performance(operation, duration, context);
exports.performance = performance;
const batchStart = (operation, count, context) => exports.logger.batchStart(operation, count, context);
exports.batchStart = batchStart;
const batchComplete = (operation, count, duration, context) => exports.logger.batchComplete(operation, count, duration, context);
exports.batchComplete = batchComplete;
const batchError = (operation, error, context) => exports.logger.batchError(operation, error, context);
exports.batchError = batchError;
