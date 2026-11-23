import { useEffect } from 'react';

function esDriveUrl(url) {
  return url && (url.includes('drive.google.com') || url.includes('googleusercontent'));
}

function getDriveImageUrl(url) {
  const match = url.match(/[-\w]{25,}/);
  return match ? `https://drive.google.com/thumbnail?id=${match[0]}&sz=w800-h800` : url;
}

export default function FotoModal({ src, onClose }) {
  useEffect(() => {
    if (!src) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [src, onClose]);

  if (!src) return null;
  const esDrive = esDriveUrl(src);
  return (
    <div className="modal-overlay" onClick={onClose} style={{ cursor: 'zoom-out', background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', maxWidth: '95vw', maxHeight: '95vh' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: -32, right: 0, background: 'none', border: 'none', color: '#fff', fontSize: 24, cursor: 'pointer', padding: '4px 8px' }}>✕</button>
        {esDrive ? (
          <img src={getDriveImageUrl(src)} alt="Foto" style={{ maxWidth: '100%', maxHeight: '95vh', borderRadius: 8, boxShadow: '0 4px 30px rgba(0,0,0,0.5)' }} onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.innerHTML = '<a href="' + src + '" target="_blank" rel="noreferrer" style="color:#fff;font-size:1.2rem">Abrir en Google Drive</a>'; }} />
        ) : (
          <img src={src} alt="Foto" style={{ maxWidth: '100%', maxHeight: '95vh', borderRadius: 8, boxShadow: '0 4px 30px rgba(0,0,0,0.5)' }} />
        )}
      </div>
    </div>
  );
}
