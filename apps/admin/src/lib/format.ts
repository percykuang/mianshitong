export function formatDateTime(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const text = date.toISOString();
  return text.replace('T', ' ').slice(0, 19);
}
