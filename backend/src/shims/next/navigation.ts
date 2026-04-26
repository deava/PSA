// Stub — not used in Express context
export const redirect = (url: string) => { throw new Error(`redirect:${url}`); };
export const notFound = () => { throw new Error('not_found'); };
