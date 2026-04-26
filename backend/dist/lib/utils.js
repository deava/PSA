"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cn = cn;
exports.formatLocalDate = formatLocalDate;
exports.getErrorMessage = getErrorMessage;
exports.getErrorDetails = getErrorDetails;
const clsx_1 = require("clsx");
const tailwind_merge_1 = require("tailwind-merge");
function cn(...inputs) {
    return (0, tailwind_merge_1.twMerge)((0, clsx_1.clsx)(inputs));
}
/**
 * Format a Date as YYYY-MM-DD in local timezone.
 * Avoids the UTC off-by-one bug caused by toISOString().
 */
function formatLocalDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
function getErrorMessage(error) {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    if (error && typeof error === 'object' && 'message' in error) {
        return String(error.message);
    }
    return 'An unknown error occurred';
}
function getErrorDetails(error) {
    if (error instanceof Error) {
        return {
            message: error.message,
            name: error.name,
            stack: error.stack,
        };
    }
    if (error && typeof error === 'object') {
        const err = error;
        return {
            message: typeof err.message === 'string' ? err.message : 'Unknown error',
            name: typeof err.name === 'string' ? err.name : undefined,
            status: typeof err.status === 'number' ? err.status : undefined,
            stack: typeof err.stack === 'string' ? err.stack : undefined,
        };
    }
    return { message: String(error) };
}
