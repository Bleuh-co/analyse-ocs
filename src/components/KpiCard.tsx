"use client";

import { ReactNode } from "react";

interface KpiCardProps {
  icon: string;
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  loading?: boolean;
}

export function KpiCard({
  icon,
  label,
  value,
  subtitle,
  trend,
  trendValue,
  loading,
}: KpiCardProps) {
  const trendColor =
    trend === "up"
      ? "#48BB78"
      : trend === "down"
        ? "#E53E3E"
        : "var(--color-placeholder)";
  const trendIcon = trend === "up" ? "↑" : trend === "down" ? "↓" : "→";

  return (
    <div className="kpi-card">
      <div className="kpi-icon">{icon}</div>
      <div className="kpi-body">
        <div className="kpi-label">{label}</div>
        <div className="kpi-value">
          {loading ? (
            <span className="kpi-skeleton" />
          ) : (
            value
          )}
        </div>
        {(subtitle || trendValue) && (
          <div className="kpi-footer">
            {trendValue && (
              <span className="kpi-trend" style={{ color: trendColor }}>
                {trendIcon} {trendValue}
              </span>
            )}
            {subtitle && <span className="kpi-subtitle">{subtitle}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

export function KpiRow({ children }: { children: ReactNode }) {
  return <div className="kpi-row">{children}</div>;
}
