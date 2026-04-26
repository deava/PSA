"use strict";
/**
 * Global constants used throughout the application
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_DAILY_HOURS = exports.DEFAULT_WEEKLY_HOURS = void 0;
/**
 * Default weekly hours for users without explicit availability records
 * Used in capacity calculations to prevent zero-division and show meaningful data
 */
exports.DEFAULT_WEEKLY_HOURS = 40;
/**
 * Default daily hours (DEFAULT_WEEKLY_HOURS / 5 work days)
 */
exports.DEFAULT_DAILY_HOURS = 8;
