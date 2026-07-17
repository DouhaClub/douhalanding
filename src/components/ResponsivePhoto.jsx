import { resolveResponsiveImageProps } from '../lib/responsiveImage';

/**
 * Imagem responsiva estilo CircoLoco: srcset + WebP opcional, qualidade alta (90+).
 * URLs locais ou externas sem Supabase render passam direto.
 */
export function ResponsivePhoto({
  src,
  preset = 'hero',
  alt = '',
  loading = 'lazy',
  decoding = 'async',
  fetchPriority,
  className,
  draggable,
  onLoad,
  onDragStart,
  useWebp = true,
  ...rest
}) {
  const { src: fallbackSrc, srcSet, sizes, webpSrcSet } = resolveResponsiveImageProps(src, preset, { useWebp });

  if (!fallbackSrc) return null;

  const imgProps = {
    src: fallbackSrc,
    alt,
    loading,
    decoding,
    fetchPriority,
    className,
    draggable,
    onLoad,
    onDragStart,
    ...rest,
  };

  if (srcSet) {
    imgProps.srcSet = srcSet;
    imgProps.sizes = sizes;
  }

  if (webpSrcSet) {
    return (
      <picture>
        <source type="image/webp" srcSet={webpSrcSet} sizes={sizes} />
        <img {...imgProps} />
      </picture>
    );
  }

  return <img {...imgProps} />;
}
