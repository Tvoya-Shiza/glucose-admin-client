import type { QuizTopicNode } from './types';

/**
 * Выбор темы вопроса двумя полями: родительская тема + подтема.
 *
 * Справочник иерархический, а у вопроса хранится ОДИН `topic_id`. Плоский
 * список сваливал «Ботанику» и её подтемы в одну кучу — по нему нельзя было
 * понять, что чему принадлежит, и методист выбирал наугад.
 *
 * Правило простое: в базу уходит самый конкретный выбранный уровень.
 * Выбрана подтема — сохраняем её; выбрана только родительская — сохраняем
 * родительскую. Разбор результата по темам при этом группирует по тому, что
 * реально проставлено, — вложенность там не схлопывается.
 *
 * Вынесено из компонента, потому что «пересобрать выбор из сохранённого id» —
 * логика с граничными случаями (тема-сирота, архивная тема, тема удалена), и
 * проверять её в диалоге неудобно.
 */

/** Значение селекта «не выбрано». Пустая строка в shadcn Select недопустима. */
export const TOPIC_NONE = '__none__';

export interface TopicSelection {
    parent: string;
    child: string;
}

/**
 * Восстанавливает пару «родитель + подтема» из сохранённого `topic_id`.
 *
 * Если тема оказалась подтемой — родитель подставляется автоматически, чтобы
 * методист видел полный путь, а не одну подтему без контекста.
 *
 * Тема, которой нет в справочнике (удалена или заархивирована, а вопрос на неё
 * ещё ссылается), даёт пустой выбор: показать несуществующий пункт нельзя, а
 * молча подставить чужой — хуже, чем показать «не выбрано».
 */
export function seedTopicSelection(
    topicId: number | null | undefined,
    topics: ReadonlyArray<QuizTopicNode>,
): TopicSelection {
    if (topicId == null) return { parent: TOPIC_NONE, child: TOPIC_NONE };

    const found = topics.find((t) => t.id === topicId);
    if (!found) return { parent: TOPIC_NONE, child: TOPIC_NONE };

    if (found.parent_id == null) {
        return { parent: String(found.id), child: TOPIC_NONE };
    }

    // Родитель мог быть заархивирован и не попасть в выдачу — тогда подтему
    // показываем как самостоятельную, иначе она исчезла бы с экрана.
    const parentExists = topics.some((t) => t.id === found.parent_id);
    return parentExists
        ? { parent: String(found.parent_id), child: String(found.id) }
        : { parent: String(found.id), child: TOPIC_NONE };
}

/** Самый конкретный выбранный уровень — то, что уходит в базу. */
export function resolveTopicId(parent: string, child: string): number | null {
    if (child !== TOPIC_NONE) return Number(child);
    if (parent !== TOPIC_NONE) return Number(parent);
    return null;
}

/** Темы верхнего уровня — первый селект. */
export function rootTopicsOf(topics: ReadonlyArray<QuizTopicNode>): QuizTopicNode[] {
    return topics.filter((t) => t.parent_id == null);
}

/** Подтемы выбранной родительской темы — второй селект. */
export function childTopicsOf(topics: ReadonlyArray<QuizTopicNode>, parent: string): QuizTopicNode[] {
    if (parent === TOPIC_NONE) return [];
    const parentId = Number(parent);
    return topics.filter((t) => t.parent_id === parentId);
}
