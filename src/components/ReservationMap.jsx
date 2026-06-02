import { useMemo } from 'react';

const ZONE_COLORS = {
  mesa: '#4a7c59',
  camarote: '#8b6914',
};

export function ReservationMap({
  layout,
  occupiedTableIds,
  selectedTableId,
  onSelectTable,
}) {
  const tables = layout?.tables || [];
  const width = layout?.width || 1000;
  const height = layout?.height || 640;

  const legend = useMemo(() => {
    const zones = new Map();
    tables.forEach((table) => {
      const key = table.zone || 'mesa';
      if (!zones.has(key)) {
        zones.set(key, layout?.zones?.[key]?.label || key);
      }
    });
    return Array.from(zones.entries());
  }, [layout?.zones, tables]);

  return (
    <div className="reservation-map-wrap">
      <div className="reservation-map-legend" aria-hidden="true">
        <span className="reservation-legend-item reservation-legend-item--free">Disponivel</span>
        <span className="reservation-legend-item reservation-legend-item--busy">Reservado</span>
        <span className="reservation-legend-item reservation-legend-item--pick">Selecionado</span>
        {legend.map(([key, label]) => (
          <span key={key} className="reservation-legend-zone" style={{ '--zone-color': ZONE_COLORS[key] || '#2d2916' }}>
            {label}
          </span>
        ))}
      </div>
      <div className="reservation-map-stage">
        <p className="reservation-map-stage-label">Pista / DJ</p>
        <svg
          className="reservation-map-svg"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Mapa de mesas e camarotes"
        >
          <rect x="0" y="0" width={width} height={height} className="reservation-map-floor" rx="16" />
          <rect
            x={width * 0.2}
            y={height * 0.04}
            width={width * 0.6}
            height={height * 0.1}
            className="reservation-map-dj"
            rx="8"
          />
          {tables.map((table) => {
            const cx = table.x * width;
            const cy = table.y * height;
            const r = (table.r || 0.04) * Math.min(width, height);
            const occupied = occupiedTableIds.has(table.id);
            const selected = selectedTableId === table.id;
            const zone = table.zone || 'mesa';
            const fill = occupied
              ? 'var(--res-busy)'
              : selected
                ? 'var(--res-pick)'
                : ZONE_COLORS[zone] || 'var(--res-free)';
            const statusLabel = occupied ? 'Reservado' : selected ? 'Selecionado' : 'Disponivel';

            return (
              <g key={table.id}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={fill}
                  className={`reservation-table-dot${occupied ? ' is-busy' : ''}${selected ? ' is-selected' : ''}`}
                  tabIndex={occupied ? -1 : 0}
                  role="button"
                  aria-label={`${table.label}, ${statusLabel}, ate ${table.capacity} pessoas`}
                  aria-pressed={selected}
                  aria-disabled={occupied}
                  onClick={() => {
                    if (!occupied) onSelectTable?.(table);
                  }}
                  onKeyDown={(event) => {
                    if (occupied) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelectTable?.(table);
                    }
                  }}
                />
                <text
                  x={cx}
                  y={cy}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="reservation-table-label"
                  pointerEvents="none"
                >
                  {table.label.replace(/^(Mesa|Camarote)\s*/i, '')}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
