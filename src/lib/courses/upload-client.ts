/**
 * Compat re-export — the upload module moved to src/lib/uploads/ during the
 * Phase 5+ unification (uploads are not a courses concern). Update imports to
 * `@/lib/uploads` and this shim can be deleted in the next pass.
 */
export { requestUploadToken, uploadFileDirect } from '@/lib/uploads';
