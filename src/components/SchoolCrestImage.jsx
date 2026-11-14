import React, { useEffect, useMemo, useState } from 'react';
import { getCrestUrlCandidates } from '../utils/crestHelpers';

/**
 * Renders a school crest image reliably using multi-endpoint Google Drive fallbacks
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

  useEffect(() => {
    setAttemptIdx(0);
  }, [src]);

  const activeSrc = candidates[attemptIdx] || '';
  if (!activeSrc) {
    return fallback;
  }

  const isExternal = /^https?:\/\//i.test(activeSrc);

  return (
    <img
      src={activeSrc}
      alt={alt}
      referrerPolicy={isExternal ? 'no-referrer' : undefined}
      onError={() => setAttemptIdx((idx) => idx + 1)}
      className={className}
    />
  );
}
