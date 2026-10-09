import React from 'react';
import { useI18n } from '../i18n/index.jsx';
import { STATUS_TONE, VERIFY_TONE } from '../lib/status.js';

export function StatusChip({ status }) {
  const { t } = useI18n();
  return <span className={`chip chip--${STATUS_TONE[status] || 'grey'}`}>{t(`status.${status}`)}</span>;
}

export function VerifyChip({ status }) {
  const { t } = useI18n();
  if (!status) return <span className="sub" style={{ color: 'var(--ink-3)' }}>–</span>;
  return <span className={`chip chip--${VERIFY_TONE[status] || 'grey'}`}>{t(`verify.${status}`)}</span>;
}

export function Priority({ band, breached }) {
  const { t } = useI18n();
  return (
    <span>
      <span className={`prio prio--${band}`}>{t(`priority.${band}`)}</span>
      {breached && <div className="breach">SLA</div>}
    </span>
  );
}
