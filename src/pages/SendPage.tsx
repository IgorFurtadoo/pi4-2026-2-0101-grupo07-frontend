import { Info } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import { useNavigate } from 'react-router'
import { ApiError } from '../api/client'
import { UNCERTAIN_SEND_MESSAGE, isUncertainSendError, messageFor } from '../api/errors'
import { sendTransaction, type SendTransactionResult } from '../api/transactions'
import { useAuth } from '../auth/useAuth'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { TextField } from '../components/ui/TextField'
import { ETH_DECIMALS, formatEth, normalizeAmountInput } from '../lib/format'
import { addressProblem, amountProblem, type AddressProblem, type AmountProblem } from '../lib/validate'

const ADDRESS_MESSAGES: Record<AddressProblem, string> = {
  empty: 'Informe o endereço de destino.',
  format: 'O endereço precisa começar com 0x e ter mais 40 caracteres, de 0 a 9 ou de a a f.',
}

const AMOUNT_MESSAGES: Record<AmountProblem, string> = {
  empty: 'Informe o valor.',
  format: 'Use só números, com vírgula ou ponto para os decimais (por exemplo, 0,01).',
  zero: 'O valor precisa ser maior que zero.',
  too_many_decimals: 'Use no máximo 18 casas decimais.',
  too_many_integer_digits: 'Use no máximo 20 dígitos antes da vírgula.',
}

const AMOUNT_HINT =
  'Use vírgula ou ponto só para os decimais, sem separador de milhar. Deixe uma pequena folga para a taxa de rede.'

type Step = 'form' | 'review'
type FieldErrors = { address?: string; amount?: string }
type FocusTarget = 'title' | 'address' | 'amount' | 'uncertain' | 'error'

function addressError(value: string): string | undefined {
  const problem = addressProblem(value)
  return problem ? ADDRESS_MESSAGES[problem] : undefined
}

function amountError(value: string): string | undefined {
  const problem = amountProblem(value)
  return problem ? AMOUNT_MESSAGES[problem] : undefined
}

/**
 * Envio de ETH (CT9, desenho, seção 6.4): formulário e revisão na mesma rota.
 * "Continuar" só valida; o envio sai só de "Confirmar envio". Em 202, a tela
 * é substituída pelo acompanhamento (replace, para o "voltar" não reabrir a
 * revisão). Não lê o saldo nem bloqueia valor acima dele: quem decide é o
 * servidor. Sem mascote. O TOKEN_INVALID é tratado no cliente e no AuthContext.
 *
 * O CT9 não tem idempotência: duas requisições são duas transações. Por isso
 * a trava síncrona por ref, o botão desabilitado durante o envio e nenhuma
 * retentativa automática. Falha de rede, tempo esgotado ou 500 não provam que
 * nada foi gravado: a tela avisa e o usuário decide se envia de novo.
 */
export function SendPage() {
  const { session } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>('form')
  const [address, setAddress] = useState('')
  const [amount, setAmount] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [reviewError, setReviewError] = useState<string | null>(null)
  // Fica até sair da tela: editar e enviar depois de um resultado incerto ainda é enviar de novo.
  const [uncertain, setUncertain] = useState(false)
  const [sending, setSending] = useState(false)

  // Trava síncrona: o disabled do botão só vale depois do próximo render.
  const sendingRef = useRef(false)
  const aliveRef = useRef(false)
  const focusRef = useRef<FocusTarget | null>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const addressRef = useRef<HTMLInputElement>(null)
  const amountRef = useRef<HTMLInputElement>(null)
  const uncertainRef = useRef<HTMLDivElement>(null)
  const errorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])

  // Foco pedido por um handler, aplicado depois de o React desenhar o alvo.
  useEffect(() => {
    const target = focusRef.current
    if (!target) return
    focusRef.current = null
    const refs = {
      title: titleRef,
      address: addressRef,
      amount: amountRef,
      uncertain: uncertainRef,
      error: errorRef,
    }
    refs[target].current?.focus()
  })

  function handleContinue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const errors: FieldErrors = { address: addressError(address), amount: amountError(amount) }
    setFieldErrors(errors)
    if (errors.address) {
      addressRef.current?.focus()
      return
    }
    if (errors.amount) {
      amountRef.current?.focus()
      return
    }
    setReviewError(null)
    focusRef.current = 'title'
    setStep('review')
  }

  function handleEdit() {
    setReviewError(null)
    focusRef.current = 'title'
    setStep('form')
  }

  /**
   * Segundo clique de um duplo clique (detail 2 ou mais): o primeiro já
   * enviou, ou caiu no "Continuar" e trocou a etapa embaixo do cursor. Não
   * envia. Teclado e Enter têm detail 0.
   */
  function handleConfirmClick(event: MouseEvent<HTMLButtonElement>) {
    if (event.detail > 1) event.preventDefault()
  }

  async function handleConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // Antes de qualquer await: um segundo clique ou Enter para aqui.
    if (sendingRef.current) return
    sendingRef.current = true
    setSending(true)
    setReviewError(null)

    let result: SendTransactionResult
    try {
      result = await sendTransaction(session?.token ?? '', {
        destinationAddress: address,
        amountEth: amount,
      })
    } catch (error) {
      // Saiu da tela com o envio em voo: o resultado é ignorado.
      if (!aliveRef.current) return
      sendingRef.current = false
      setSending(false)
      handleSendError(error)
      return
    }

    // Em sucesso a trava fica: a tela é substituída. Se o usuário saiu antes
    // do 202, a requisição não foi cancelada (cancelar não desfaz o que o
    // servidor já processou) e o resultado é ignorado; sem histórico de
    // transações (desenho, seção 7, [Aberto]), o taskId se perde nesse caso.
    if (!aliveRef.current) return
    navigate(`/transacoes/${encodeURIComponent(result.taskId)}`, { replace: true })
  }

  function handleSendError(error: unknown) {
    const code = error instanceof ApiError ? error.code : 'INTERNAL_ERROR'
    const serverMessage = error instanceof ApiError ? error.message : undefined

    // Cliente e AuthContext encerram a sessão e levam a /entrar.
    if (code === 'TOKEN_INVALID') return

    if (code === 'ADDRESS_INVALID' || code === 'AMOUNT_INVALID') {
      const field = code === 'ADDRESS_INVALID' ? 'address' : 'amount'
      setFieldErrors({ [field]: messageFor(code) })
      // O erro do campo não tem role=alert: com o foco no campo, o leitor de
      // tela lê o rótulo e a mensagem.
      focusRef.current = field
      setStep('form')
      return
    }

    if (isUncertainSendError(code)) {
      setUncertain(true)
      focusRef.current = 'uncertain'
      return
    }

    setReviewError(messageFor(code, serverMessage))
    focusRef.current = 'error'
  }

  const uncertainAlert = uncertain && (
    <Alert ref={uncertainRef} variant="error" className="mt-6">
      <p>{UNCERTAIN_SEND_MESSAGE}</p>
    </Alert>
  )

  if (step === 'form') {
    return (
      <form
        noValidate
        onSubmit={handleContinue}
        aria-labelledby="titulo-enviar"
        className="mx-auto max-w-xl"
      >
        <h1 ref={titleRef} id="titulo-enviar" tabIndex={-1} className="text-3xl">
          Enviar ETH
        </h1>
        <p className="mt-2 text-text-muted">
          Informe o endereço de destino e o valor. Você revisa tudo antes do envio.
        </p>

        {uncertainAlert}

        <div className="mt-6 space-y-5">
          <TextField
            ref={addressRef}
            label="Endereço de destino"
            name="destinationAddress"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            error={fieldErrors.address}
          />
          <TextField
            ref={amountRef}
            label="Valor (ETH)"
            name="amountEth"
            inputMode="decimal"
            autoComplete="off"
            required
            hint={AMOUNT_HINT}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            error={fieldErrors.amount}
          />
        </div>

        <Button type="submit" className="mt-8 w-full">
          Continuar
        </Button>
      </form>
    )
  }

  const destination = address.trim()
  const shownAmount = formatEth(normalizeAmountInput(amount), ETH_DECIMALS)

  return (
    <form
      noValidate
      onSubmit={handleConfirm}
      aria-labelledby="titulo-revisao"
      className="mx-auto max-w-xl"
    >
      <h1 ref={titleRef} id="titulo-revisao" tabIndex={-1} className="text-3xl">
        Revise o envio
      </h1>

      {uncertainAlert}
      {reviewError && (
        <Alert ref={errorRef} variant="error" className="mt-6">
          <p>{reviewError}</p>
        </Alert>
      )}

      <div className="mt-6 rounded-2xl border border-divider bg-surface p-6">
        <p className="text-lg">
          Você vai enviar <strong className="font-medium whitespace-nowrap">{shownAmount} ETH</strong>{' '}
          para o endereço:
        </p>
        <p className="mt-3 rounded-md bg-primary-soft px-3 py-2 font-mono text-sm break-all">
          {destination}
        </p>
        <dl className="mt-4 flex flex-wrap gap-x-2">
          <dt className="text-text-muted">Rede:</dt>
          <dd>Sepolia · testnet</dd>
        </dl>
      </div>

      <p className="mt-4 flex items-start gap-2 text-text-muted">
        <Info aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <span>Uma transação na blockchain não pode ser desfeita. Confira o endereço e o valor.</span>
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between">
        <Button variant="secondary" onClick={handleEdit} disabled={sending}>
          Voltar e editar
        </Button>
        <Button type="submit" onClick={handleConfirmClick} loading={sending} loadingText="Enviando…">
          {uncertain ? 'Enviar de novo' : 'Confirmar envio'}
        </Button>
      </div>
    </form>
  )
}
