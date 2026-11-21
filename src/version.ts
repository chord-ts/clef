declare const __CLEF_VERSION__: string;

export const version = typeof __CLEF_VERSION__ === 'string' ? __CLEF_VERSION__ : '0.0.0-dev';