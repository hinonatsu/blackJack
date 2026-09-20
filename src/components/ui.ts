/** Lightweight UI helpers kept dependency-free for the training table. */
export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export function formatCurrency(cents: number): string {
  const amount = Math.abs(cents) / 100;
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return cents < 0 ? `-${formatted}` : formatted;
}

export function formatResponseTime(milliseconds?: number | null): string {
  if (milliseconds === undefined || milliseconds === null || !Number.isFinite(milliseconds)) {
    return '—';
  }

  return `${(milliseconds / 1000).toFixed(milliseconds < 10_000 ? 2 : 1)} sec`;
}
