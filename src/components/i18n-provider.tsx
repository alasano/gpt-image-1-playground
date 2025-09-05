'use client';

import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { getLocaleFromUrl, isValidLanguage } from '@/lib/locale-utils';

type I18nProviderProps = {
    children: React.ReactNode;
};

export function I18nProvider({ children }: I18nProviderProps) {
    const [mounted, setMounted] = React.useState(false);
    const searchParams = useSearchParams();

    React.useEffect(() => {
        // Check for URL parameter on mount
        if (searchParams) {
            const urlLocale = getLocaleFromUrl(searchParams);
            if (urlLocale && urlLocale !== i18n.language) {
                i18n.changeLanguage(urlLocale);
            }
        }
        setMounted(true);
    }, [searchParams]);

    if (!mounted) {
        return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
    }

    return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
