import { ReadonlyURLSearchParams } from 'next/navigation';

// Supported languages
export const supportedLanguages = ['en', 'zh'] as const;
export type SupportedLanguage = typeof supportedLanguages[number];

/**
 * Get locale from URL search parameters
 * Supports both 'lang' and 'locale' parameter names
 */
export function getLocaleFromUrl(searchParams: ReadonlyURLSearchParams | URLSearchParams): SupportedLanguage | null {
  const langParam = searchParams.get('lang') || searchParams.get('locale');
  
  if (langParam && supportedLanguages.includes(langParam as SupportedLanguage)) {
    return langParam as SupportedLanguage;
  }
  
  return null;
}

/**
 * Get locale from current window URL (client-side only)
 */
export function getLocaleFromCurrentUrl(): SupportedLanguage | null {
  if (typeof window === 'undefined') return null;
  
  const url = new URL(window.location.href);
  return getLocaleFromUrl(url.searchParams);
}

/**
 * Update URL with new locale parameter
 */
export function updateUrlWithLocale(currentUrl: string, locale: SupportedLanguage): string {
  const url = new URL(currentUrl, window.location.origin);
  url.searchParams.set('lang', locale);
  return url.toString();
}

/**
 * Create a new URL with locale parameter
 */
export function createUrlWithLocale(baseUrl: string, locale: SupportedLanguage, preserveParams = true): string {
  const url = new URL(baseUrl, window.location.origin);
  
  if (!preserveParams) {
    // Clear existing params if not preserving
    url.search = '';
  }
  
  url.searchParams.set('lang', locale);
  return url.pathname + url.search;
}

/**
 * Validate if a string is a supported language
 */
export function isValidLanguage(lang: string | null): lang is SupportedLanguage {
  return lang !== null && supportedLanguages.includes(lang as SupportedLanguage);
}
