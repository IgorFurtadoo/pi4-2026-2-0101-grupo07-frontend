export type ButtonVariant = 'primary' | 'secondary'

const BASE_CLASS =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-5 py-2.5 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60'

/** Classes do botão, também usadas por links com cara de botão. */
export const BUTTON_CLASS: Record<ButtonVariant, string> = {
  primary: `${BASE_CLASS} bg-primary text-on-primary hover:bg-primary-hover`,
  secondary: `${BASE_CLASS} border border-primary bg-surface text-primary hover:bg-primary-soft`,
}
