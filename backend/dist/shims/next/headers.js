"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.headers = exports.cookies = void 0;
// Stub — not used in Express context
const cookies = () => ({ get: () => undefined, getAll: () => [] });
exports.cookies = cookies;
const headers = () => new Headers();
exports.headers = headers;
