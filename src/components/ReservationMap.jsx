import { useMemo } from 'react';

const ZONE_COLORS = {
  mesa: '#4a7c59',
  camarote: '#8b6914',
};

function tableFill(occupied, selected, zone) {
  if (occupied) return 'var(--res-busy)';
  if (selected) return 'var(--res-pick)';
  return ZONE_COLORS[zone] || 'var(--res-free)';
}

function renderTableShape(table, layout, occupiedTableIds, selectedTableId, onSelectTable) {
  const width = layout.width || 1000;
  const height = layout.height || 700;
  const occupied = occupiedTableIds.has(table.id);
  const selected = selectedTableId === table.id;
  const zone = table.zone || 'mesa';
  const fill = tableFill(occupied, selected, zone);
  const statusLabel = occupied ? 'Reservado' : selected ? 'Selecionado' : 'Disponivel';
  const hasBg = Boolean(layout.backgroundImage);
  const fillOpacity = hasBg ? (occupied ? 0.92 : selected ? 0.88 : 0.72) : 1;
  const showLabel = !hasBg;

  const commonProps = {
    className: `reservation-table-hit${occupied ? ' is-busy' : ''}${selected ? ' is-selected' : ''}`,
    tabIndex: occupied ? -1 : 0,
    role: 'button',
    'aria-label': `${table.label}, ${statusLabel}, ate ${table.capacity} pessoas`,
    'aria-pressed': selected,
    'aria-disabled': occupied,
    fill,
    fillOpacity,
    stroke: 'rgba(255, 255, 255, 0.9)',
    strokeWidth: hasBg ? 2 : 1.5,
    onClick: () => {
      if (!occupied) onSelectTable?.(table);
    },
    onKeyDown: (event) => {
      if (occupied) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelectTable?.(table);
      }
    },
  };

  if (table.shape === 'rect') {
    const w = (table.w || 0.08) * width;
    const h = (table.h || 0.1) * height;
    const x = table.x * width - w / 2;
    const y = table.y * height - h / 2;
    return (
      <g key={table.id}>
        <rect x={x} y={y} width={w} height={h} rx={6} {...commonProps} />
        {showLabel ? (
          <text
            x={table.x * width}
            y={table.y * height}
            textAnchor="middle"
            dominantBaseline="middle"
            className="reservation-table-label"
            pointerEvents="none"
          >
            {table.label.replace(/^(Mesa|Camarote)\s*/i, '')}
          </text>
        ) : null}
      </g>
    );
  }

  const cx = table.x * width;
  const cy = table.y * height;
  const r = (table.r || 0.04) * Math.min(width, height);

  return (
    <g key={table.id}>
      <circle cx={cx} cy={cy} r={r} {...commonProps} />
      {showLabel ? (
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
      ) : null}
    </g>
  );
}

export function ReservationMap({
  layout,
  occupiedTableIds,
  selectedTableId,
  onSelectTable,
}) {
  const tables = layout?.tables || [];
  const width = layout?.width || 1000;
  const height = layout?.height || 700;
  const bgImage = String(layout?.backgroundImage || '').trim();

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
      <div className={`reservation-map-stage${bgImage ? ' reservation-map-stage--floor-plan' : ''}`}>
        {!bgImage ? <p className="reservation-map-stage-label">Palco</p> : null}
        <svg
          className="reservation-map-svg"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Mapa de mesas e camarotes Douha Club"
        >
          {!bgImage ? (
            <>
              <rect x="0" y="0" width={width} height={height} className="reservation-map-floor" rx="16" />
              <rect
                x={width * 0.04}
                y={height * 0.2}
                width={width * 0.12}
                height={height * 0.6}
                className="reservation-map-palco"
                rx="8"
              />
            </>
          ) : (
            <image
              href={bgImage}
              x="0"
              y="0"
              width={width}
              height={height}
              preserveAspectRatio="xMidYMid meet"
              className="reservation-map-bg"
            />
          )}
          {tables.map((table) => renderTableShape(
            table,
            { ...layout, width, height },
            occupiedTableIds,
            selectedTableId,
            onSelectTable,
          ))}
        </svg>
      </div>
      <p className="about-copy reservation-map-hint">
        Toque na mesa ou camarote no mapa. Verde = disponivel, cinza = ja reservado.
      </p>
    </div>
  );
}
