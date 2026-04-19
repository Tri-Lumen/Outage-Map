import ServiceDetailView from '@/components/ServiceDetailView';
import { SERVICES } from '@/lib/services';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { slug: string };
}

export default function ServicePage({ params }: PageProps) {
  const service = SERVICES.find((s) => s.slug === params.slug);
  if (!service) notFound();
  return <ServiceDetailView slug={params.slug} />;
}
