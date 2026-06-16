'use client';

import * as React from 'react';

import { Input } from '@/components/ui/input';
import { formatPhoneMask, toCanonicalPhone } from '@/lib/users/phone';

export interface PhoneInputProps
    extends Omit<React.ComponentProps<'input'>, 'value' | 'onChange' | 'type'> {
    /** Canonical value (`+7XXXXXXXXXX`) or ''. */
    value: string;
    /** Emits the canonical value so form state submits exactly what the API expects. */
    onChange: (canonical: string) => void;
}

/**
 * Masked KZ phone input. Displays `+7 (777) 777-77-77` while keeping the form
 * value canonical (`+7XXXXXXXXXX`). Drop-in for RHF Controller/FormField:
 * `<PhoneInput {...field} />` (field.onChange accepts the raw value).
 */
export function PhoneInput({ value, onChange, placeholder, ...rest }: PhoneInputProps) {
    return (
        <Input
            {...rest}
            type='tel'
            inputMode='tel'
            autoComplete='tel'
            value={formatPhoneMask(value ?? '')}
            placeholder={placeholder ?? '+7 (777) 777-77-77'}
            onChange={(e) => {
                const prevDisplay = formatPhoneMask(value ?? '');
                const nextRaw = e.target.value;
                const prevDigits = (value ?? '').replace(/\D/g, '');
                let nextDigits = nextRaw.replace(/\D/g, '');
                // Backspace landed on a formatting char (the mask would otherwise
                // re-add it): drop the last real digit so deletion feels natural.
                if (nextRaw.length < prevDisplay.length && nextDigits === prevDigits) {
                    nextDigits = nextDigits.slice(0, -1);
                }
                onChange(toCanonicalPhone(nextDigits));
            }}
        />
    );
}
