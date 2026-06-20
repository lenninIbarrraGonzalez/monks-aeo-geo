'use client';

import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

/** Marcas conocidas para probar el demo sin tener que escribir. Los nombres no se traducen. */
const EXAMPLE_BRANDS = ['Notion', 'Figma', 'Stripe', 'Linear', 'Mercado Libre'] as const;

interface ExampleBrandsProps {
  /** Dispara la auditoría con la marca elegida. */
  onSelect: (brand: string) => void;
}

/** Atajos de marcas destacadas que disparan una auditoría de ejemplo al hacer clic. */
export function ExampleBrands({ onSelect }: ExampleBrandsProps) {
  const t = useTranslations('Audit');

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-muted-foreground text-sm">{t('examplesTitle')}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {EXAMPLE_BRANDS.map((brand) => (
          <Button
            key={brand}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onSelect(brand)}
          >
            {brand}
          </Button>
        ))}
      </div>
    </div>
  );
}
