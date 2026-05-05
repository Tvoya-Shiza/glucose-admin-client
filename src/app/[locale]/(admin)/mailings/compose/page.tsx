import { MailingsComposeForm } from './mailings-compose-form';

/**
 * Phase 8 Plan 05 — Mailings compose page (PSH-05).
 *
 * Server component shell — the form is client-side because it owns react-hook-form
 * + AudienceSelector + AudiencePreview + send mutation state.
 */
export default function ComposePage() {
    return (
        <div className='max-w-3xl'>
            <MailingsComposeForm />
        </div>
    );
}
