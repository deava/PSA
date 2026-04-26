"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NextResponse = exports.NextRequest = void 0;
/**
 * Shim for next/server imports used in route files.
 * Re-exports our Express-compatible adapter classes.
 */
var adapter_1 = require("../../adapter");
Object.defineProperty(exports, "NextRequest", { enumerable: true, get: function () { return adapter_1.NextRequest; } });
Object.defineProperty(exports, "NextResponse", { enumerable: true, get: function () { return adapter_1.NextResponse; } });
