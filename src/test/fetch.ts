/**
 * Resposta que nunca chega. Rejeita com AbortError quando o signal cancela,
 * como o fetch do navegador.
 */
export function pendingResponse(signal?: AbortSignal | null): Promise<Response> {
  return new Promise<Response>((_resolve, reject) => {
    const abort = () => reject(new DOMException('Cancelado', 'AbortError'))
    if (signal?.aborted) abort()
    else signal?.addEventListener('abort', abort, { once: true })
  })
}
