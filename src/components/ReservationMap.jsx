import { useMemo, useState } from 'react';
import { enrichSpotWithPackage } from '../lib/reservations';

const ZONE_COLORS = {
  mesa: '#4a7c59',
  camarote: '#8b6914',
};

function formatBrl(value) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function tableFill(occupied, selected, zone) {
  if (occupied) return 'var(--res-busy)';
  if (selected) return 'var(--res-pick)';
  return ZONE_COLORS[zone] || 'var(--res-free)';
}

function renderTableShape(table, layout, occupiedTableIds, selectedTableId, onSelectTable, preview, onHoverTable) {
  const infoOnly = Boolean(table.infoOnly);
  if (table.reservable === false && !infoOnly) return null;

  const width = layout.width || 1000;
  const height = layout.height || 700;
  const occupied = occupiedTableIds.has(table.id);
  const selected = selectedTableId === table.id;
  const zone = table.zone || 'mesa';
  const statusLabel = occupied ? 'Reservado' : selected ? 'Selecionado' : 'Disponível';
  const hasBg = Boolean(layout.backgroundImage);
  const showLabel = !hasBg;
  const interactive = !preview && !infoOnly && typeof onSelectTable === 'function';
  const ghostHit = hasBg;
  const isMesa = zone === 'mesa';
  const hitRadius = table.r || 0.038;

  const commonProps = {
    className: `reservation-table-hit${ghostHit ? ' is-ghost' : ''}${infoOnly ? ' is-ghost-info' : ''}${isMesa && ghostHit ? ' is-ghost-mesa' : ''}${!isMesa && ghostHit && !infoOnly ? ' is-ghost-camarote' : ''}${occupied ? ' is-busy' : ''}${selected ? ' is-selected' : ''}${preview ? ' is-preview' : ''}`,
    tabIndex: (interactive && !occupied) || (infoOnly && !preview) ? 0 : -1,
    role: interactive ? 'button' : infoOnly ? 'note' : 'presentation',
    'aria-label': infoOnly
      ? `${table.label} — ${table.hoverLabel || 'Apenas convidados'}`
      : interactive ? `${table.label}, ${statusLabel}, até ${table.capacity} pessoas` : undefined,
    'aria-pressed': interactive ? selected : undefined,
    'aria-disabled': interactive ? occupied : undefined,
    fill: ghostHit ? 'transparent' : tableFill(occupied, selected, zone),
    fillOpacity: ghostHit ? 0 : 1,
    stroke: ghostHit ? 'transparent' : 'rgba(255, 255, 255, 0.9)',
    strokeWidth: ghostHit ? 0 : 1.5,
    style: infoOnly ? { cursor: 'default' } : undefined,
    onClick: interactive ? () => {
      if (!occupied) onSelectTable(table);
    } : undefined,
    onKeyDown: interactive ? (event) => {
      if (occupied) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelectTable(table);
      }
    } : undefined,
    onMouseEnter: !preview ? () => onHoverTable?.(table.id) : undefined,
    onMouseLeave: !preview ? () => onHoverTable?.(null) : undefined,
    onFocus: !preview ? () => onHoverTable?.(table.id) : undefined,
    onBlur: !preview ? () => onHoverTable?.(null) : undefined,
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
  const r = hitRadius * Math.min(width, height);

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

function ReservationMapTooltip({ table, occupied }) {
  const spot = enrichSpotWithPackage(table);
  const infoOnly = Boolean(table.infoOnly);
  // Posiciona acima do ponto; perto da borda superior, abre para baixo.
  const topEdge = table.y < 0.18;
  const anchorY = table.shape === 'rect' ? table.y - (table.h || 0.1) / 2 : table.y;
  const style = {
    left: `${table.x * 100}%`,
    top: `${(topEdge ? table.y + (table.h || 0.08) / 2 : anchorY) * 100}%`,
  };

  if (infoOnly) {
    return (
      <div
        className={`reservation-map-tooltip reservation-map-tooltip--info${topEdge ? ' is-below' : ''}`}
        style={style}
        role="status"
      >
        <p className="reservation-map-tooltip__name">{table.label}</p>
        <p className="reservation-map-tooltip__status is-info">
          {table.hoverLabel || 'Apenas convidados'}
        </p>
      </div>
    );
  }

  return (
    <div
      className={`reservation-map-tooltip${topEdge ? ' is-below' : ''}`}
      style={style}
      role="status"
    >
      <p className="reservation-map-tooltip__name">{table.label}</p>
      <p className={`reservation-map-tooltip__status${occupied ? ' is-busy' : ' is-free'}`}>
        {occupied ? 'Reservado' : 'Aberto — disponível'}
      </p>
      {!occupied && spot?.priceTotal ? (
        <p className="reservation-map-tooltip__price">
          {formatBrl(spot.priceTotal)}
          {spot.priceConsumption ? ` · ${formatBrl(spot.priceConsumption)} consumação` : ''}
        </p>
      ) : null}
      {!occupied && (spot?.entriesIncluded || spot?.capacity) ? (
        <p className="reservation-map-tooltip__meta">
          {spot.entriesIncluded ? `${spot.entriesIncluded} entrada${spot.entriesIncluded > 1 ? 's' : ''}` : ''}
          {spot.entriesIncluded && spot.capacity ? ' · ' : ''}
          {spot.capacity ? `até ${spot.capacity} pessoas` : ''}
        </p>
      ) : null}
      {!occupied ? (
        <p className="reservation-map-tooltip__hint">Clique para reservar</p>
      ) : null}
    </div>
  );
}

export function ReservationMap({
  layout,
  occupiedTableIds = new Set(),
  selectedTableId,
  onSelectTable,
  preview = false,
  hint,
  mesasOnly = false,
}) {
  const [hoveredTableId, setHoveredTableId] = useState(null);

  const tables = (layout?.tables || []).filter((table) => (
    !mesasOnly || (table.zone === 'mesa' && table.reservable !== false)
  ));
  const width = layout?.width || 1000;
  const height = layout?.height || 700;
  const bgImage = String(layout?.backgroundImage || '').trim();

  const hoveredTable = hoveredTableId
    ? tables.find((table) => table.id === hoveredTableId) || null
    : null;

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

  const floorPlanMode = Boolean(bgImage);

  return (
    <div className={`reservation-map-wrap${preview ? ' reservation-map-wrap--preview' : ''}${floorPlanMode ? ' reservation-map-wrap--floor-plan' : ''}`}>
      {floorPlanMode ? (
        <p className="reservation-map-legend reservation-map-legend--text" aria-hidden="true">
          Passe o mouse na mesa ou camarote para ver se está aberto. FF é apenas convidados.
        </p>
      ) : (
        <div className="reservation-map-legend" aria-hidden="true">
          <span className="reservation-legend-item reservation-legend-item--free">Disponível</span>
          <span className="reservation-legend-item reservation-legend-item--busy">Reservado</span>
          <span className="reservation-legend-item reservation-legend-item--pick">Selecionado</span>
          {legend.map(([key, label]) => (
            <span key={key} className="reservation-legend-zone" style={{ '--zone-color': ZONE_COLORS[key] || '#2d2916' }}>
              {label}
            </span>
          ))}
        </div>
      )}
      <div className={`reservation-map-stage${bgImage ? ' reservation-map-stage--floor-plan' : ''}`}>
        {!bgImage ? <p className="reservation-map-stage-label">Palco</p> : null}
        <div
          className="reservation-map-visual"
          style={bgImage ? { aspectRatio: `${width} / ${height}` } : undefined}
        >
          {bgImage ? (
            <img
              src={bgImage}
              alt="Planta do Douha Club com mesas e camarotes"
              className="reservation-map-bg-img"
              width={width}
              height={height}
              decoding="async"
            />
          ) : null}
          <svg
            className={`reservation-map-svg${bgImage ? ' reservation-map-svg--overlay' : ''}`}
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
            ) : null}
            {tables.map((table) => renderTableShape(
              table,
              { ...layout, width, height },
              occupiedTableIds,
              selectedTableId,
              onSelectTable,
              preview,
              setHoveredTableId,
            ))}
          </svg>
          {!preview && hoveredTable ? (
            <ReservationMapTooltip
              table={hoveredTable}
              occupied={occupiedTableIds.has(hoveredTable.id)}
            />
          ) : null}
        </div>
      </div>
      {hint !== false ? (
        <p className="about-copy reservation-map-hint">
          {hint || (floorPlanMode
            ? 'Passe o mouse na planta para ver mesa/camarote aberto e clique para reservar.'
            : 'Toque na mesa ou camarote no mapa. Verde = disponível, cinza = já reservado. O camarote C1 não está disponível para reserva.')}
        </p>
      ) : null}
    </div>
  );
}
