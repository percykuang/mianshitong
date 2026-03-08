import { bundledLanguages, codeToHtml, type BundledLanguage } from 'shiki/bundle/web';

const LIGHT_THEME = 'github-light';
const DARK_THEME = 'github-dark';

function isBundledLanguage(language: string): language is BundledLanguage {
  return language in bundledLanguages;
}

export function resolveShikiLanguage(language: string): BundledLanguage | null {
  const normalizedLanguage = language.trim().toLowerCase();

  if (!normalizedLanguage || normalizedLanguage === 'text') {
    return null;
  }

  return isBundledLanguage(normalizedLanguage) ? normalizedLanguage : null;
}

export async function highlightCodeBlock(code: string, language: string) {
  const resolvedLanguage = resolveShikiLanguage(language);

  if (!resolvedLanguage) {
    return null;
  }

  return codeToHtml(code, {
    lang: resolvedLanguage,
    themes: {
      light: LIGHT_THEME,
      dark: DARK_THEME,
    },
    defaultColor: false,
  });
}
