import { setRequestLocale } from 'next-intl/server';
import { use } from 'react';

import { AuditExperience } from '@/components/audit-experience';
import { SiteHeader } from '@/components/site-header';

type Props = {
  params: Promise<{ locale: string }>;
};

export default function Home({ params }: Props) {
  const { locale } = use(params);
  setRequestLocale(locale);

  return (
    <>
      <SiteHeader />
      <AuditExperience />
    </>
  );
}
