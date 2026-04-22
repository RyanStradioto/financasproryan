import type { PostgrestError } from '@supabase/supabase-js';

type QueryResult<T> = PromiseLike<{ data: T[] | null; error: PostgrestError | null }>;
type MutationResult = PromiseLike<{ error: PostgrestError | null }>;

function getErrorText(error: PostgrestError | null | undefined) {
  return [error?.code, error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function isMissingDeletedAtError(error: PostgrestError | null | undefined) {
  const text = getErrorText(error);
  return (
    text.includes('deleted_at') &&
    (text.includes('column') ||
      text.includes('schema cache') ||
      text.includes('not found') ||
      error?.code === '42703' ||
      error?.code === 'PGRST204')
  );
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
