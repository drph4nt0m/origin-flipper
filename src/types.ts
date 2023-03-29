export type AnyFunction = (...args: any[]) => any;

export type OriginRedirectConfig = { from: string; to: string };

export type PathRedirectConfig = { origin: string; path: string; to: string; pattern?: boolean };
