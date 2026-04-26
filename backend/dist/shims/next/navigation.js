"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFound = exports.redirect = void 0;
// Stub — not used in Express context
const redirect = (url) => { throw new Error(`redirect:${url}`); };
exports.redirect = redirect;
const notFound = () => { throw new Error('not_found'); };
exports.notFound = notFound;
