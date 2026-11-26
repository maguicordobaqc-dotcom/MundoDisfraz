import { useState, useEffect } from 'react';
import { esDriveUrl, getDriveImageUrl, getFotoById } from '../utils/fotos';

/**
 * Muestra la miniatura de un item de alquiler soportando:
 * - preview local (al editar/subir)
 * - fotoUrl directa (base64 legado o link de Google Drive)
 * - fotoId en la colección separada "alquileres_fotos" (carga bajo demanda + caché)
 */
export default function FotoItem({
  item,
  onZoom,
  style,
  className = 'thumb',
  emptyText = null,
}) {
  const directSrc = item?.preview || item?.fotoUrl || '';
  const fotoId = !directSrc ? (item?.fotoId || '') : '';
  const [loadedSrc, setLoadedSrc] = useState('');
  const [loading, setLoading] = useState(Boolean(fotoId));

  useEffect(() => {
    let active = true;
    if (!fotoId) {
      setLoadedSrc('');
      setLoading(false);
      return;
    }
    setLoading(true);
    getFotoById(fotoId).then((src) => {
      if (!active) return;
      setLoadedSrc(src || '');
      setLoading(false);
    });
    return () => { active = false; };
  }, [fotoId]);

  const src = directSrc || loadedSrc;

  if (loading) {
    return (
      <span
        className="text-muted"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: style?.width || 48,
          height: style?.height || 48,
          background: '#f0f2f5',
          borderRadius: style?.borderRadius || 6,
          fontSize: '0.75rem',
        }}
      >
        ...
      </span>
    );
  }

  if (!src) {
    return emptyText ? <span className="text-muted" style={{ fontSize: '0.8rem' }}>{emptyText}</span> : null;
  }

  const isDrive = esDriveUrl(src);
  const imgSrc = isDrive ? getDriveImageUrl(src) : src;

  return (
    <img
      src={imgSrc}
      alt={item?.nombre || 'Foto'}
      loading="lazy"
      className={className}
      style={{ cursor: onZoom ? 'pointer' : undefined, ...style }}
      onClick={() => onZoom && onZoom(src)}
      onError={(e) => {
        if (isDrive) {
          e.target.style.display = 'none';
        }
      }}
    />
  );
}
