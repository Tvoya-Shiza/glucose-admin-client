# Permissions — как добавлять и масштабировать

Короткий howto для расширения RBAC. Полную модель см. в
`glucose-admin-api/docs/access-control.md`.

## TL;DR — путь permission через стек

```
prisma/seeds/permissions.seed.ts  ←  каталог (источник истины)
        ↓ при seed
roles + permissions + role_permissions   ←  таблицы БД
        ↓ при логине
JWT (role_name, role_id)   ←  кладётся в access-token
        ↓ при /auth/me
listEffectivePermissions(actor)   ←  для admin = all, иначе role_permissions
        ↓ возвращается клиенту
useMe()  →  data.permissions[], data.is_super
        ↓ используется в UI
usePermission('code')  /  <Can permission="code">  /  AdminNav filter
```

Backend дополнительно защищает endpoint декораторами `@RequirePermission('code')`.
Браузерные UI-гейты — UX-only; реальный enforcement на admin-api.

---

## Шаг 1. Добавить новый permission code

### 1a. Каталог на бекенде

Файл: [`glucose-admin-api/prisma/seeds/permissions.seed.ts`](../../glucose-admin-api/prisma/seeds/permissions.seed.ts)

Добавь запись в `PERMISSION_CATALOG` (или соответствующую группу). Пример:

```typescript
{
    code: 'reports.view',
    group_code: 'reports',
    name_ru: 'Просмотр отчётов',
    name_kz: 'Есептерді көру',
    action: 'view',
    display_order: 100,
},
```

Если это новая группа — добавь её в `PERMISSION_GROUPS`. Если ты хочешь
давать этот permission куратору/учителю по умолчанию — допиши код в
`default_grants` соответствующей роли в `CORE_ROLES`.

Затем запусти seed (порядок upsert, существующие строки не пострадают):

```bash
cd glucose-admin-api
npx ts-node prisma/seeds/permissions.seed.ts
```

После сидинга bump Redis version key чтобы инвалидировать закешированные
permissions:

```bash
redis-cli DEL geonline-admin:perms:version
# или просто перезапусти admin-api — он сам построит кеш заново
```

### 1b. Каталог на фронте

Файл: [`src/lib/access/permission-codes.ts`](../src/lib/access/permission-codes.ts)

Добавь строку в массив `PERMISSION_CODES`. Тип `PermissionCode` автоматически
обновится — TypeScript начнёт принимать новый код в `usePermission('reports.view')`
без `as string`.

```typescript
export const PERMISSION_CODES = [
    // ...
    'reports.view',
    'reports.export',
] as const;
```

**Каталоги должны быть синхронизированы.** Если код есть в seed, но нет в
permission-codes.ts — `usePermission` примет его только через `as string`,
а в `<Can permission='...'>` потеряется автокомплит.

---

## Шаг 2. Защитить endpoint в admin-api

### 2a. Один permission на эндпоинте

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionGuard } from '../access/guards/permission.guard';
import { RequirePermission } from '../access/decorators/require-permission.decorator';

@Controller('admin-api/v1/admin/reports')
// ОЧЕНЬ ВАЖНО — порядок: JwtGuard → RolesGuard → PermissionGuard.
// JwtGuard заполняет req.user; PermissionGuard читает req.user.role_name +
// проверяет permissions. Если поменять порядок — PermissionGuard упадёт
// с 'unauthenticated' (см. инцидент в репо-комменте app.module.ts).
@UseGuards(JwtGuard, RolesGuard, PermissionGuard)
export class ReportsController {
    @Get()
    @Roles('admin', 'curator', 'teacher')   // допустимые роли (allowlist)
    @RequirePermission('reports.view')      // конкретный permission code
    async list() { /* ... */ }
}
```

`@Roles(...)` — грубый фильтр на уровне роли. `@RequirePermission(...)` —
тонкая проверка на уровне permission code. Обычно нужны оба:
- `@Roles` отсекает обычных пользователей (student) до проверки permissions
- `@RequirePermission` проверяет, что у curator/teacher есть нужный код

Админ (`role_name === 'admin'`) проходит **все** проверки автоматически
(super-bypass и в `listEffectivePermissions`, и в `PermissionGuard`).

### 2b. Несколько permission codes

```typescript
// Достаточно ЛЮБОГО из перечисленных (OR):
@RequirePermission(['reports.view', 'reports.export'], { mode: 'any' })

// Нужны ВСЕ (AND):
@RequirePermission(['reports.view', 'reports.publish'], { mode: 'all' })
```

### 2c. Endpoint без permission check

Если хватает проверки роли — просто не вешай `@RequirePermission`. Default-pass:
PermissionGuard пропустит запрос если metadata нет.

---

## Шаг 3. Защитить UI в admin-client

### 3a. Скрыть кнопку/действие

```tsx
import { Can } from '@/lib/access/can';

<Can permission='reports.export'>
    <Button onClick={exportCsv}>Export</Button>
</Can>

// Альтернативно с fallback:
<Can permission='reports.export' fallback={<DisabledButton />}>
    <Button>Export</Button>
</Can>

// Любой из нескольких permissions:
<Can anyOf={['reports.view', 'reports.export']}>...</Can>

// Все из перечисленных:
<Can allOf={['reports.edit', 'reports.publish']}>...</Can>
```

### 3b. Гейт страницы (loading / error / no-access)

Не используй `usePermission()` напрямую для гейта целой страницы — он
возвращает `false` пока `/auth/me` грузится, и юзер увидит мигание
"нет доступа". Используй `useMe()`:

```tsx
import { useMe } from '@/lib/access/use-me';

export function ReportsPage() {
    const { data: me, isPending, error } = useMe();

    if (isPending || !me) return <PageShell><LoadingCard /></PageShell>;
    if (error) return <PageShell><ErrorState /></PageShell>;

    const canView = me.is_super || me.role_name === 'admin'
                  || me.permissions?.includes('reports.view');

    if (!canView) return <PageShell><NoAccessEmpty /></PageShell>;

    return <ReportsList />;
}
```

### 3c. Пункт в сайдбаре

Файл: [`src/components/admin/admin-nav.tsx`](../src/components/admin/admin-nav.tsx)

Добавь item в нужную секцию `NAV_SECTIONS`:

```typescript
{
    titleKey: 'sections.content',
    items: [
        // ...
        { href: '/reports', labelKey: 'reports', icon: BarChart3, permission: 'reports.view' },
    ],
}
```

И ключ перевода `admin.nav.reports` в `messages/ru.json` + `messages/kz.json`.

---

## Что НЕ делать

- ❌ **Не хардкодь** `me.role_name === 'admin'` в случайных компонентах.
  Используй `useMe()` → `is_super` или `usePermission(...)`.
- ❌ **Не создавай свой** `useQuery({ queryKey: ['auth.me'], queryFn: ... })`.
  Используй `useMe()` из `@/lib/access/use-me`. 12 легаси-компонентов уже
  делали так и получили cache-collision (envelope vs unwrapped data) — это
  возвращало `is_super=undefined` на /access/roles. Сейчас `ME_QUERY_KEY`
  изолирован как `['access', 'me']` чтобы не конфликтовать. Любой новый
  код должен ходить через `useMe()`.
- ❌ **Не проверяй permission только на клиенте**. UI-гейт — UX, не security.
  Real enforcement = `@RequirePermission` на admin-api.
- ❌ **Не забывай порядок guards** на новом контроллере. Правильно:
  `@UseGuards(JwtGuard, RolesGuard, PermissionGuard)`. PermissionGuard
  должен идти ПОСЛЕ JwtGuard, иначе `req.user` ещё undefined.
- ❌ **Не ищи Role по `name`** при создании/импорте пользователей. Только
  по `code` (см. `users-create.service.ts` — фикс уже сделан). `name` это
  русское display-label, оно может меняться.

---

## Troubleshooting

**Юзер видит "нет доступа" после правки permissions в UI матрицы.**
TanStack Query `staleTime` 60s. Либо подожди, либо в матрице PUT уже
делает `invalidateQueries({ queryKey: ME_QUERY_KEY })` — должен подхватиться.

**Curator не получает permissions хотя матрица их даёт.**
Redis-кеш `geonline-admin:perms:role:<id>` живёт 10 минут. PUT
`/access/roles/:id/permissions` сам инвалидирует. Если вручную правил БД —
сделай `DEL geonline-admin:perms:version` чтобы bump version.

**Endpoint возвращает 403 'unauthenticated' хотя юзер залогинен.**
Проверь `@UseGuards` — должен быть `JwtGuard, RolesGuard, PermissionGuard`
в этом порядке. Глобальный `PermissionGuard` (через APP_GUARD) бежит до
controller-level `JwtGuard` и видит `req.user === undefined`.

**Endpoint возвращает 403 'insufficient_permission'.**
Реальная нехватка прав. Залогинься как admin для теста или дай
permission через `/kz/access/roles` → матрица.

**Sidebar пустой при F5.**
`useMe` ещё грузит `/auth/me`. AdminNav уже показывает skeleton в этом
состоянии. Если skeleton не исчезает — `/api/auth/me` падает (открой
Network tab).

---

## Ссылки

- Backend RBAC модель: [`glucose-admin-api/docs/access-control.md`](../../glucose-admin-api/docs/access-control.md)
- Каталог permissions (бекенд): [`glucose-admin-api/prisma/seeds/permissions.seed.ts`](../../glucose-admin-api/prisma/seeds/permissions.seed.ts)
- Каталог permissions (фронт): [`src/lib/access/permission-codes.ts`](../src/lib/access/permission-codes.ts)
- Источник истины me-запроса: [`src/lib/access/use-me.ts`](../src/lib/access/use-me.ts)
- Хуки и `<Can>`: [`src/lib/access/use-permission.ts`](../src/lib/access/use-permission.ts), [`src/lib/access/can.tsx`](../src/lib/access/can.tsx)
- Управление ролями UI: [`src/app/[locale]/(admin)/access/roles/`](../src/app/[locale]/(admin)/access/roles/)
- PermissionGuard: [`glucose-admin-api/src/modules/access/guards/permission.guard.ts`](../../glucose-admin-api/src/modules/access/guards/permission.guard.ts)
