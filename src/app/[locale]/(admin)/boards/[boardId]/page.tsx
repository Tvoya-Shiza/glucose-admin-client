import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { BoardClient } from './board-client';

export default async function BoardDetailPage({
    params,
}: {
    params: Promise<{ locale: string; boardId: string }>;
}) {
    const { locale, boardId } = await params;
    setRequestLocale(locale);
    const id = Number(boardId);
    if (!Number.isFinite(id) || id <= 0) notFound();
    return <BoardClient boardId={id} />;
}
