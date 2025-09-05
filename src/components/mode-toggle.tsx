'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useTranslation } from 'react-i18next';

type ModeToggleProps = {
    currentMode: 'generate' | 'edit';
    onModeChange: (mode: 'generate' | 'edit') => void;
};

export function ModeToggle({ currentMode, onModeChange }: ModeToggleProps) {
    const { t } = useTranslation('common');

    return (
        <div className='flex items-center gap-3'>
            <LanguageSwitcher />
            <Tabs
                value={currentMode}
                onValueChange={(value) => onModeChange(value as 'generate' | 'edit')}
                className='w-auto'>
                <TabsList className='grid h-auto grid-cols-2 gap-1 rounded-md border-none bg-transparent p-0'>
                    <TabsTrigger
                        value='generate'
                        className={`rounded-md border px-3 py-1 text-sm transition-colors ${
                            currentMode === 'generate'
                                ? 'border-white bg-white text-black'
                                : 'border-dashed border-white/30 bg-transparent text-white/60 hover:border-white/50 hover:text-white/80'
                        } `}>
                        {t('generate')}
                    </TabsTrigger>
                    <TabsTrigger
                        value='edit'
                        className={`rounded-md border px-3 py-1 text-sm transition-colors ${
                            currentMode === 'edit'
                                ? 'border-white bg-white text-black'
                                : 'border-dashed border-white/30 bg-transparent text-white/60 hover:border-white/50 hover:text-white/80'
                        } `}>
                        {t('edit')}
                    </TabsTrigger>
                </TabsList>
            </Tabs>
        </div>
    );
}
