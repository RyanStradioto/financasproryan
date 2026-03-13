export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date + 'T00:00:00'));
}

export function getMonthYear(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function getMonthLabel(monthStr: string): string {
  const [year, month] = monthStr.split('-');
  const date = new Date(Number(year), Number(month) - 1);
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date);
}

export function getStatusColor(status: string) {
  switch (status) {
    case 'concluido': return 'bg-success/10 text-success';
    case 'pendente': return 'bg-warning/10 text-warning';
    case 'agendado': return 'bg-info/10 text-info';
    default: return 'bg-muted text-muted-foreground';
  }
}

export function getStatusLabel(status: string) {
  switch (status) {
    case 'concluido': return 'Concluído';
    case 'pendente': return 'Pendente';
    case 'agendado': return 'Agendado';
    default: return status;
  }
}
