import React, { useEffect, useMemo, useState } from 'react';
import { getCrestUrlCandidates, trimImageElementToDataUrl } from '../utils/crestHelpers';

// Cache trimmed data URIs in memory so multi-card report prints render tight crests immediately with zero re-scans
const trimmedCrestCache = new Map();

/**
 * Renders a school crest image reliably using multi-endpoint Google Drive fallbacks,
 * automatic whitespace/transparent margin trimming so crests match Coat of Arms proportions,
 * and silent degradation if an external crest URL is unreachable.
 */
export default function SchoolCrestImage({
  src,
  alt = 'School Crest',
  className = '',
  fallback = null,
}) {
  const candidates = useMemo(() => getCrestUrlCandidates(src), [src]);
  const [attemptIdx, setAttemptIdx] = useState(0);
  const [trimmedEntry, setTrimmedEntry] = useState({ key: '', url: '' });

  useEffect(() => {
    setAttemptIdx(0);
    setTrimmedEntry({ key: '', url: '' });
  }, [src]);

  const activeSrc = candidates[attemptIdx] || '';
  const cachedSrc = activeSrc ? trimmedCrestCache.get(activeSrc) : undefined;
  const matchedTrimmed = trimmedEntry.key === activeSrc ? trimmedEntry.url : '';
  const displaySrc = cachedSrc || matchedTrimmed || activeSrc;

  useEffect(() => {
    if (!activeSrc || trimmedCrestCache.has(activeSrc)) return;
    if (!/^https?:\/\//i.test(activeSrc)) return;

    let cancelled = false;
    const probe = new Image();
    probe.crossOrigin = 'anonymous';
    probe.referrerPolicy = 'no-referrer';
    probe.onload = () => {
      if (cancelled) return;
      const trimmed = trimImageElementToDataUrl(probe);
      trimmedCrestCache.set(activeSrc, trimmed || activeSrc);
      if (trimmed) setTrimmedEntry({ key: activeSrc, url: trimmed });
    };
    probe.onerror = () => {
      if (!cancelled) {
        trimmedCrestCache.set(activeSrc, activeSrc);
      }
    };
    probe.src = activeSrc;

    return () => {
      cancelled = true;
    };
  }, [activeSrc]);

  if (!activeSrc) {
    return fallback;
  }

  const isExternal = /^https?:\/\//i.test(displaySrc);

  const handleLoad = (e) => {
    if (!activeSrc || trimmedCrestCache.has(activeSrc)) return;
    if (/^https?:\/\//i.test(activeSrc)) return;
    const trimmed = trimImageElementToDataUrl(e.currentTarget);
    trimmedCrestCache.set(activeSrc, trimmed || activeSrc);
    if (trimmed) {
      setTrimmedEntry({ key: activeSrc, url: trimmed });
    }
  };

  return (
    <img
      src={displaySrc}
      alt={alt}
      referrerPolicy={isExternal ? 'no-referrer' : undefined}
      onLoad={handleLoad}
      onError={() => {
        if (matchedTrimmed) {
          trimmedCrestCache.set(activeSrc, activeSrc);
          setTrimmedEntry({ key: '', url: '' });
        } else {
          setAttemptIdx((idx) => idx + 1);
        }
      }}
      className={className}
    />
  );
}
