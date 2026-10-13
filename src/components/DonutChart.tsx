"use client";

import { useId, useMemo } from "react";
import type { Tone } from "@/lib/constants";

export interface DonutDatum {
  key: string;
  label: string;
  value: number;
  tone: Tone;
}

interface Props {
  data: DonutDatum[];
  size?: number;
  thickness?: number;
  centerValue?: string | number;
  centerLabel?: string;
  emptyLabel: string;
  ariaLabel: string;
  onSelect?: (key: string) => void;
  selectedKey?: string | null;
  emphasisKey?: string | null;
}

const GAP_PX = 2;

function toneVar(tone: Tone): string {
  return `var(--tone-${tone}-fg)`;
}

/**
 * Accessible SVG donut. Segments are focusable buttons: click or Enter/Space
 * invokes `onSelect` with the datum key. Colors come from the existing tone
 * tokens so charts track the light/dark theme automatically.
 */
export default function DonutChart({
  data,
  size = 220,
  thickness = 26,
  centerValue,
  centerLabel,
  emptyLabel,
  ariaLabel,
  onSelect,
  selectedKey,
  emphasisKey,
}: Props) {
  const titleId = useId();
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const gapPercent = data.length > 1 ? (GAP_PX / circumference) * 100 : 0;

  const total = useMemo(
    () => data.reduce((sum, datum) => sum + datum.value, 0),
    [data],
  );

  const segments = useMemo(() => {
    let offset = 0;
    return data.map((datum) => {
      const percent = total > 0 ? (datum.value / total) * 100 : 0;
      const length = Math.max(percent - gapPercent, 0.5);
      const segment = {
        datum,
        percent,
        dashArray: `${length} ${100 - length}`,
        dashOffset: -offset,
      };
      offset += percent;
      return segment;
    });
  }, [data, total, gapPercent]);

  if (data.length === 0 || total === 0) {
    return (
      <div
        className="grid place-items-center rounded-2xl border border-dashed border-line/50 bg-inset text-center"
        style={{ width: size, height: size }}
      >
        <p className="max-w-[80%] font-mono text-[11px] uppercase tracking-[0.12em] text-faint">
          {emptyLabel}
        </p>
      </div>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      role="group"
      aria-labelledby={titleId}
      className="shrink-0"
    >
      <title id={titleId}>{ariaLabel}</title>

      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--line)"
        strokeOpacity={0.25}
        strokeWidth={thickness}
      />

      {segments.map(({ datum, percent, dashArray, dashOffset }) => {
        const dimmed = emphasisKey !== null && emphasisKey !== undefined && datum.key !== emphasisKey;
        const selected = selectedKey === datum.key;
        const interactive = Boolean(onSelect);
        const label = `${datum.label}: ${datum.value} (${Math.round(percent)}%)`;
        return (
          <circle
            key={datum.key}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={toneVar(datum.tone)}
            strokeWidth={selected ? thickness + 4 : thickness}
            strokeDasharray={dashArray}
            strokeDashoffset={dashOffset}
            pathLength={100}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            strokeLinecap="butt"
            role={interactive ? "button" : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-label={interactive ? label : undefined}
            aria-pressed={interactive && selectedKey !== undefined ? selected : undefined}
            onClick={interactive ? () => onSelect?.(datum.key) : undefined}
            onKeyDown={
              interactive
                ? (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect?.(datum.key);
                    }
                  }
                : undefined
            }
            className={
              interactive
                ? "cursor-pointer outline-none transition-opacity hover:opacity-80 focus-visible:opacity-100 focus-visible:[filter:drop-shadow(0_0_4px_var(--accent))]"
                : undefined
            }
            style={{
              opacity: dimmed ? 0.25 : 1,
              filter: selected ? "drop-shadow(0 0 6px var(--accent))" : undefined,
            }}
          >
            <title>{label}</title>
          </circle>
        );
      })}

      {centerValue !== undefined && (
        <>
          <text
            x={size / 2}
            y={centerLabel ? size / 2 - 2 : size / 2 + 6}
            textAnchor="middle"
            className="fill-ink font-mono text-2xl font-semibold"
          >
            {centerValue}
          </text>
          {centerLabel && (
            <text
              x={size / 2}
              y={size / 2 + 18}
              textAnchor="middle"
              className="fill-muted text-[9px] uppercase"
              style={{ letterSpacing: "0.14em" }}
            >
              {centerLabel}
            </text>
          )}
        </>
      )}
    </svg>
  );
}
