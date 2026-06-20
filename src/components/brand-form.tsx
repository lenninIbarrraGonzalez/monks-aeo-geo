'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface BrandFormProps {
  /** Se invoca con la marca/URL ya recortada cuando el usuario envía un valor no vacío. */
  onSubmit: (brand: string) => void;
}

/** Formulario de entrada de la landing: nombre de marca o URL a auditar. */
export function BrandForm({ onSubmit }: BrandFormProps) {
  const t = useTranslations('Audit');
  const [value, setValue] = useState('');
  const [invalid, setInvalid] = useState(false);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const brand = value.trim();
    if (!brand) {
      setInvalid(true);
      return;
    }
    onSubmit(brand);
  };

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-xl flex-col gap-3">
      <label htmlFor="brand" className="sr-only">
        {t('inputLabel')}
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          id="brand"
          name="brand"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            if (invalid) setInvalid(false);
          }}
          placeholder={t('inputPlaceholder')}
          aria-invalid={invalid}
          aria-describedby={invalid ? 'brand-error' : undefined}
          autoComplete="off"
          className="h-11 flex-1 text-base"
        />
        <Button type="submit" size="lg" className="h-11 px-8">
          {t('submit')}
        </Button>
      </div>
      {invalid && (
        <p id="brand-error" role="alert" className="text-destructive text-sm">
          {t('emptyError')}
        </p>
      )}
    </form>
  );
}
