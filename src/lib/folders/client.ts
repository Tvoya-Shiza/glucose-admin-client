/**
 * Folders client — Phase 10 media-library folder CRUD.
 * Mirrors uploads/client.ts conventions: all calls go through the BFF proxy
 * (`/api/proxy/v1/admin/folders/...`) with admin Bearer cookie auth.
 */
import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import type {
    CreateFolderRequest,
    FileFolder,
    FolderDetailResponse,
    ListFoldersResponse,
    MoveFolderRequest,
    RenameFolderRequest,
} from '@shared/folders';

async function parseOrThrow<T>(res: Response, fallback: string): Promise<T> {
    if (!res.ok) {
        const json = await res.json().catch(() => ({}) as Record<string, unknown>);
        const msg = (json as { message?: string })?.message ?? `${fallback}_${res.status}`;
        throw new Error(msg);
    }
    if (res.status === 204) {
        return undefined as T;
    }
    const json = await res.json();
    return (json && typeof json === 'object' && 'data' in (json as Record<string, unknown>)
        ? (json as { data: T }).data
        : (json as T));
}

export async function listFolders(): Promise<ListFoldersResponse> {
    const res = await fetchWithRefresh('/api/proxy/v1/admin/folders');
    if (!res.ok) {
        const json = await res.json().catch(() => ({}) as Record<string, unknown>);
        const msg = (json as { message?: string })?.message ?? `folders_list_failed_${res.status}`;
        throw new Error(msg);
    }
    const json = await res.json();
    if (json && typeof json === 'object' && 'data' in json && Array.isArray((json as { data: unknown }).data)) {
        return json as ListFoldersResponse;
    }
    if (json && typeof json === 'object' && 'data' in (json as Record<string, unknown>)) {
        return (json as { data: ListFoldersResponse }).data;
    }
    return json as ListFoldersResponse;
}

export async function getFolder(id: number): Promise<FolderDetailResponse> {
    const res = await fetchWithRefresh(`/api/proxy/v1/admin/folders/${id}`);
    return parseOrThrow<FolderDetailResponse>(res, 'folder_get_failed');
}

export async function createFolder(body: CreateFolderRequest): Promise<FileFolder> {
    const res = await fetchWithRefresh('/api/proxy/v1/admin/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return parseOrThrow<FileFolder>(res, 'folder_create_failed');
}

export async function renameFolder(id: number, body: RenameFolderRequest): Promise<FileFolder> {
    const res = await fetchWithRefresh(`/api/proxy/v1/admin/folders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return parseOrThrow<FileFolder>(res, 'folder_rename_failed');
}

export async function moveFolder(id: number, body: MoveFolderRequest): Promise<FileFolder> {
    const res = await fetchWithRefresh(`/api/proxy/v1/admin/folders/${id}/move`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return parseOrThrow<FileFolder>(res, 'folder_move_failed');
}

export async function deleteFolder(id: number): Promise<void> {
    const res = await fetchWithRefresh(`/api/proxy/v1/admin/folders/${id}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) {
        const json = await res.json().catch(() => ({}) as Record<string, unknown>);
        const msg = (json as { message?: string })?.message ?? `folder_delete_failed_${res.status}`;
        throw new Error(msg);
    }
}
