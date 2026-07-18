import { useEffect } from 'react';
import './ReceiptLightbox.css';

export interface ReceiptItem {
  title: string;
  url: string;
  filename: string;
  isPdf: boolean;
}

interface Props {
  receipts: ReceiptItem[];
  index: number;
  onChange: (index: number) => void;
  onClose: () => void;
}

const ReceiptLightbox = ({ receipts, index, onChange, onClose }: Props) => {
  const current = receipts[index];
  const hasPrev = index > 0;
  const hasNext = index < receipts.length - 1;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasPrev) onChange(index - 1);
      if (e.key === 'ArrowRight' && hasNext) onChange(index + 1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [index, hasPrev, hasNext, onChange, onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  if (!current) return null;

  return (
    <div className="lb-backdrop" onClick={onClose}>
      <div className="lb-container" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="lb-header">
          <span className="lb-filename">
            <span className="lb-filename-icon">📎</span>
            {current.filename}
          </span>
          {receipts.length > 1 && (
            <span className="lb-counter">{index + 1} / {receipts.length}</span>
          )}
          <button className="lb-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* ── Body ── */}
        <div className="lb-body">
          <button
            className="lb-nav lb-nav-prev"
            onClick={() => onChange(index - 1)}
            disabled={!hasPrev}
            aria-label="Previous"
          >
            ‹
          </button>

          <div className="lb-media">
            {current.isPdf ? (
              <div className="lb-pdf">
                <div className="lb-pdf-icon">📄</div>
                <p className="lb-pdf-name">{current.filename}</p>
                <a
                  href={current.url}
                  target="_blank"
                  rel="noreferrer"
                  className="lb-pdf-open"
                  onClick={e => e.stopPropagation()}
                >
                  Open PDF ↗
                </a>
              </div>
            ) : (
              <img
                src={current.url}
                alt={current.title}
                className="lb-image"
                draggable={false}
              />
            )}
          </div>

          <button
            className="lb-nav lb-nav-next"
            onClick={() => onChange(index + 1)}
            disabled={!hasNext}
            aria-label="Next"
          >
            ›
          </button>
        </div>

        {/* ── Footer caption ── */}
        <div className="lb-footer">
          <span className="lb-caption">{current.title}</span>
          {receipts.length > 1 && (
            <div className="lb-dots">
              {receipts.map((_, i) => (
                <button
                  key={i}
                  className={`lb-dot ${i === index ? 'active' : ''}`}
                  onClick={() => onChange(i)}
                  aria-label={`Go to receipt ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default ReceiptLightbox;
