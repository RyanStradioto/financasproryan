/**
 * appLogger — logging centralizado para produção.
 *
 * Em desenvolvimento: exibe tudo normalmente no console.
 * Em produção: suprime logs de debug/info. Apenas warn e error passam.
 *
 * Uso: import { appLogger } from '@/lib/appLogger';
 *      appLogger.info('mensagem', dados);
 *      appLogger.warn('aviso', dados);
 *      appLogger.error('erro crítico', error);
 */

const isDev = import.meta.env.DEV;

function noop(..._args: unknown[]): void {}

export const appLogger = {
  /** Log de debug — visível apenas em desenvolvimento. */
  debug: isDev ? console.debug.bind(console, '[debug]') : noop,

  /** Log informativo — visível apenas em desenvolvimento. */
  info: isDev ? console.info.bind(console, '[info]') : noop,

  /** Aviso — visível em qualquer ambiente. */
  warn: console.warn.bind(console, '[warn]'),

  /** Erro — visível em qualquer ambiente. */
  error: console.error.bind(console, '[error]'),
} as const;
