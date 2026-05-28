import { Suspense } from 'react';
import Link from 'next/link';
import PostmortemView from '@/components/PostmortemView';
import PageHeader from '@/components/ui/PageHeader';

export const metadata = { title: 'Postmortem — Outage Map' };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PostmortemPage({ params }: Props) {
  const { id } = await params;
  const numericId = parseInt(id, 10);

  if (isNaN(numericId)) {
    return (
      <div className="flex flex-col gap-6">
        <p className="text-sm text-muted">Invalid incident ID.</p>
        <Link href="/" className="text-xs text-accent-cyan hover:underline">← Back to overview</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2 text-xs text-muted">
        <Link href="/" className="hover:text-foreground transition-colors">Overview</Link>
        <span>›</span>
        <Link href={`/services`} className="hover:text-foreground transition-colors">Incidents</Link>
        <span>›</span>
        <span className="text-foreground">Postmortem #{numericId}</span>
      </div>

      <PageHeader
        title={`Incident #${numericId} Postmortem`}
        description="Auto-generated postmortem draft. Edit and save as needed."
      />

      <Suspense fallback={<div className="text-muted text-sm">Generating postmortem…</div>}>
        <PostmortemView incidentId={numericId} />
      </Suspense>
    </div>
  );
}
