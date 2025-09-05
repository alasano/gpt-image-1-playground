'use client';

import { Button } from '@/components/ui/button';
import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useRouter, useSearchParams } from 'next/navigation';
import { createUrlWithLocale, type SupportedLanguage } from '@/lib/locale-utils';

export function LanguageSwitcher() {
    const { i18n, t } = useTranslation('common');
    const router = useRouter();
    const searchParams = useSearchParams();

    const toggleLanguage = () => {
        const newLang: SupportedLanguage = i18n.language === 'en' ? 'zh' : 'en';
        
        // Update i18n language
        i18n.changeLanguage(newLang);
        
        // Update URL with new language parameter
        const currentPath = window.location.pathname;
        const currentParams = new URLSearchParams(searchParams.toString());
        currentParams.set('lang', newLang);
        
        const newUrl = `${currentPath}?${currentParams.toString()}`;
        
        // Update URL without page reload
        router.replace(newUrl, { scroll: false });
    };

    return (
        <Button
            variant='ghost'
            size='sm'
            onClick={toggleLanguage}
            className='flex items-center gap-2 text-white/60 hover:bg-white/10 hover:text-white'
            aria-label={`Switch to ${i18n.language === 'en' ? 'Chinese' : 'English'}`}>
            <Languages className='h-4 w-4' />
            <span className='text-sm'>
                {i18n.language === 'en' ? t('languages.zh') : t('languages.en')}
            </span>
        </Button>
    );
}
