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

/**
 * Resposta mínima (ok, status, headers, text) para o cliente da API. Resolve
 * só com microtarefas, sem o corpo em stream do Node, então funciona com
 * relógio falso.
 */
export function fakeResponse(status: number, body: string): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    text: () => Promise.resolve(body),
  } as unknown as Response
}
