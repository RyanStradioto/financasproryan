export function formatWorkTime(result: { days: number; hours: number; totalHours: number } | null): string {
  if (!result) return '';
  if (result.days > 0) {
    return result.hours > 0
      ? `${result.days}d ${result.hours}h`
      : `${result.days}d`;
  }
  if (result.totalHours < 1) {
    return `${Math.round(result.totalHours * 60)}min`;
  }
  return `${result.hours}h`;
}
