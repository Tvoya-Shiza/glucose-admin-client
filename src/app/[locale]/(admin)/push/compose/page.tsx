import { PushComposeForm } from './push-compose-form';

/**
 * Phase 8 Plan 03 — Compose page (PSH-01).
 *
 * Server component shell — the form is client-side because it owns react-hook-form
 * state, AudienceSelector, AudiencePreview, and TanStack Query mutations.
 */
export default function ComposePage() {
    return (
        <div className='max-w-3xl'>
            <PushComposeForm />
        </div>
    );
}
