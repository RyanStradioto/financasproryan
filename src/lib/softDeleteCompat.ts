import type { PostgrestError } from '@supabase/supabase-js';

type QueryResult<T> = PromiseLike<{ data: T[] | null; error: PostgrestError | null }>;
type MutationResult = PromiseLike<{ error: PostgrestError | null }>;
type MutationResultWithData<T> = PromiseLike<{ data: T | null; error: PostgrestError | null }>;

function getErrorText(error: PostgrestError | null | undefined) {
  return [error?.code, error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function isMissingColumnError(error: PostgrestError | null | undefined, column: string) {
  const text = getErrorText(error);
  const columnName = column.toLowerCase();
  return (
    text.includes(columnName) &&
    (text.includes('column') ||
      text.includes('schema cache') ||
      text.includes('not found') ||
      error?.code === '42703' ||
      error?.code === 'PGRST204')
  );
}

export function isMissingDeletedAtError(error: PostgrestError | null | undefined) {
  return isMissingColumnError(error, 'deleted_at');
}

export function isMissingRelationError(error: PostgrestError | null | undefined, relation: string) {
  const text = getErrorText(error);
  const relationName = relation.toLowerCase();
  return (
    text.includes(relationName) &&
    (text.includes('relation') ||
      text.includes('table') ||
      text.includes('schema cache') ||
      text.includes('not found') ||
      error?.code === '42P01' ||
      error?.code === 'PGRST204')
  );
}

export async function queryWithSoftDeleteFallback<T>(
  runQuery: (supportsSoftDelete: boolean) => QueryResult<T>,
) {
  const primary = await runQuery(true);
  if (!primary.error) return primary.data ?? [];
  if (!isMissingDeletedAtError(primary.error)) throw primary.error;

  console.warn('[soft-delete] coluna deleted_at ausente; usando consulta legada');

  const fallback = await runQuery(false);
  if (fallback.error) throw fallback.error;
  return fallback.data ?? [];
}

export async function deleteWithSoftDeleteFallback(
  runMutation: (supportsSoftDelete: boolean) => MutationResult,
) {
  const primary = await runMutation(true);
  if (!primary.error) return { softDeleted: true };
  if (!isMissingDeletedAtError(primary.error)) throw primary.error;

  console.warn('[soft-delete] coluna deleted_at ausente; usando exclusao permanente legada');

  const fallback = await runMutation(false);
  if (fallback.error) throw fallback.error;
  return { softDeleted: false };
}

function hasMissingOptionalColumnError(
  error: PostgrestError | null | undefined,
  optionalColumns: string[],
) {
  return optionalColumns.some((column) => isMissingColumnError(error, column));
}

function omitOptionalColumns<T extends Record<string, unknown>>(payload: T, optionalColumns: string[]) {
  const sanitized = { ...payload };
  for (const column of optionalColumns) {
    delete sanitized[column];
  }
  return sanitized;
}

export async function mutateWithOptionalColumnsFallback<T>(
  payload: Record<string, unknown>,
  optionalColumns: string[],
  runMutation: (sanitizedPayload: Record<string, unknown>) => MutationResultWithData<T>,
) {
  const primary = await runMutation(payload);
  if (!primary.error) return primary.data;
  if (!hasMissingOptionalColumnError(primary.error, optionalColumns)) throw primary.error;

  console.warn(
    `[schema-compat] colunas opcionais ausentes (${optionalColumns.join(', ')}); repetindo sem elas`,
  );

  const fallback = await runMutation(omitOptionalColumns(payload, optionalColumns));
  if (fallback.error) throw fallback.error;
  return fallback.data;
}

export async function mutateManyWithOptionalColumnsFallback(
  payloads: Record<string, unknown>[],
  optionalColumns: string[],
  runMutation: (sanitizedPayloads: Record<string, unknown>[]) => MutationResult,
) {
  const primary = await runMutation(payloads);
  if (!primary.error) return;
  if (!hasMissingOptionalColumnError(primary.error, optionalColumns)) throw primary.error;

  console.warn(
    `[schema-compat] colunas opcionais ausentes (${optionalColumns.join(', ')}); repetindo lote sem elas`,
  );

  const fallback = await runMutation(payloads.map((payload) => omitOptionalColumns(payload, optionalColumns)));
  if (fallback.error) throw fallback.error;
}
