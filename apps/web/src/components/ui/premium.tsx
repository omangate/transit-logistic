'use client';

import type { ReactNode } from 'react';

type KpiCardProps = {
  label: string;
  value: string | number;
  hint?: string;
};

export function KpiCard({ label, value, hint }: KpiCardProps) {
  return (
    <article className="kpi-card">
      <div className="kpi-card__label">{label}</div>
      <div className="kpi-card__value">{value}</div>
      {hint ? <div className="kpi-card__hint">{hint}</div> : null}
    </article>
  );
}

type ShipmentPipelineProps = {
  stages: readonly string[];
  activeStage: string;
  labelForStage: (stage: string) => string;
};

export function ShipmentPipeline({ stages, activeStage, labelForStage }: ShipmentPipelineProps) {
  const activeIndex = Math.max(0, stages.indexOf(activeStage));

  return (
    <div className="shipment-pipeline">
      <div className="shipment-pipeline__track">
        {stages.map((stage, index) => {
          const state =
            index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'pending';

          return (
            <div
              key={stage}
              className={`shipment-pipeline__step shipment-pipeline__step--${state}`}
            >
              <span className="shipment-pipeline__dot" aria-hidden="true" />
              <span className="shipment-pipeline__label">{labelForStage(stage)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type DataSourceBadgeProps = {
  quality: 'live' | 'manual' | 'external';
  label: string;
};

export function DataSourceBadge({ quality, label }: DataSourceBadgeProps) {
  return <span className={`data-source-badge data-source-badge--${quality}`}>{label}</span>;
}

type IntegrationStatusBadgeProps = {
  status: string;
  label: string;
};

export function IntegrationStatusBadge({ status, label }: IntegrationStatusBadgeProps) {
  const normalized = status.toLowerCase().replace(/\s+/g, '_');
  return <span className={`integration-status integration-status--${normalized}`}>{label}</span>;
}

type EmptyPanelProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyPanel({ title, description, action }: EmptyPanelProps) {
  return (
    <div className="empty-state">
      <p>{title}</p>
      {description ? <p className="muted-text">{description}</p> : null}
      {action}
    </div>
  );
}
