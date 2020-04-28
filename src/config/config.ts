
const env = Deno.env();
export const VERSION = 'v0.0.1'
export const APP_HOST = env.FN_HOST || "127.0.0.1";
export const APP_PORT = env.FN_PORT || 8080;
export const SIGNATURE_SECRET = env.FN_SIGNATURE_SECRET
export const SERVICE = env.FN_SERVICE || "babelfish";
export const WORKER_PATH = env.FN_WORKER_PATH || "./customerFn.js";