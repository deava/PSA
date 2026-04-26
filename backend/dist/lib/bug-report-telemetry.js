"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initConsoleCapture = initConsoleCapture;
exports.getConsoleErrors = getConsoleErrors;
exports.collectTelemetry = collectTelemetry;
const MAX_ERRORS = 10;
const MAX_ERROR_MESSAGE_LENGTH = 1000;
const errorBuffer = [];
let originalConsoleError = null;
function initConsoleCapture() {
    if (originalConsoleError) {
        // Already patched
        return () => { };
    }
    originalConsoleError = console.error;
    console.error = (...args) => {
        const message = args
            .map((arg) => {
            if (arg instanceof Error)
                return `${arg.name}: ${arg.message}`;
            if (typeof arg === 'string')
                return arg;
            try {
                return JSON.stringify(arg);
            }
            catch {
                return String(arg);
            }
        })
            .join(' ')
            .slice(0, MAX_ERROR_MESSAGE_LENGTH);
        errorBuffer.push({
            message,
            timestamp: new Date().toISOString(),
        });
        // Keep only last N errors (circular buffer)
        if (errorBuffer.length > MAX_ERRORS) {
            errorBuffer.shift();
        }
        // Still call the original
        originalConsoleError(...args);
    };
    return () => {
        if (originalConsoleError) {
            console.error = originalConsoleError;
            originalConsoleError = null;
        }
    };
}
function getConsoleErrors() {
    return [...errorBuffer];
}
function collectTelemetry(userProfile) {
    return {
        url: typeof window !== 'undefined' ? window.location.href : '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        viewport: {
            width: typeof window !== 'undefined' ? window.innerWidth : 0,
            height: typeof window !== 'undefined' ? window.innerHeight : 0,
        },
        consoleErrors: getConsoleErrors(),
        user: userProfile
            ? {
                id: userProfile.id,
                email: userProfile.email || '',
                name: userProfile.name || '',
            }
            : null,
    };
}
