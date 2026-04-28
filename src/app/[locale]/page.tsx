import '@/lib/shared-types-smoke';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function Home() {
    const t = useTranslations('home');
    return (
        <main className='flex min-h-screen items-center justify-center bg-slate-50 p-8'>
            <Card className='w-full max-w-md'>
                <CardHeader>
                    <CardTitle>{t('title')}</CardTitle>
                    <CardDescription>{t('subtitle')}</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button>OK</Button>
                </CardContent>
            </Card>
        </main>
    );
}
