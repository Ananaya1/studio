'use client';

import dynamic from 'next/dynamic';

const JOYstickPageClient = dynamic(() => import('@/components/joy-stick-game'), {
  ssr: false,
});

export default function Page() {
  return <JOYstickPageClient />;
}
