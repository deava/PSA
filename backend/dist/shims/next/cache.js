"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unstable_cache = exports.revalidateTag = exports.revalidatePath = void 0;
// Stub — caching not needed in Express
const revalidatePath = () => { };
exports.revalidatePath = revalidatePath;
const revalidateTag = () => { };
exports.revalidateTag = revalidateTag;
const unstable_cache = (fn) => fn;
exports.unstable_cache = unstable_cache;
