import type { ServiceStatusResponse, IncidentResponse, HistoryPoint } from '@/lib/types';

export interface LiveData {
  services: ServiceStatusResponse[];
  incidents: IncidentResponse[];
  history: Record<string, HistoryPoint[]>;
  isLoading: boolean;
  lastUpdated?: string;
}

export interface TileProps {
  config: Record<string, unknown>;
  editing?: boolean;
  dataPoints: string[];
  toggleDataPoint: (key: string) => void;
  onConfigChange: (patch: Record<string, unknown>) => void;
  onResize?: () => void;
  onRemove?: () => void;
  onDuplicate?: () => void;
  onRename?: (label: string | null) => void;
  live: LiveData;
}
