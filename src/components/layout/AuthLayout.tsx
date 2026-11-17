import { Outlet } from 'react-router'
import { Logo } from '../brand/Logo'
import { Mascot } from '../brand/Mascot'

/** Frase do painel: factual, sem sugerir custódia pelo usuário nem dinheiro real. */
export const AUTH_PANEL_PHRASE = 'Sua carteira Ethereum, na rede de teste Sepolia.'

/**
 * Telas de entrada (cadastro e login), momento 1 do desenho, seção 5.
 *
 * Desktop: duas colunas. À esquerda, o painel azul-noite com o logo na versão
 * escura, o mascote grande sobre o disco de apoio e a frase; à direita, o
 * formulário em fundo claro.
 * Celular: o painel vira uma faixa azul-noite no topo, só com o logo escuro (o
 * guia reserva o símbolo isolado para fundos claros). O mascote não entra.
 *
 * O mascote é decorativo e igual em todos os estados da tela: não indica
 * sucesso, erro, alerta nem progresso.
 */
export function AuthLayout() {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-2">
      <header className="bg-night px-4 py-3 lg:flex lg:flex-col lg:items-start lg:justify-center lg:gap-10 lg:px-16 lg:py-16">
        <div className="lg:hidden">
          <Logo background="night" height={40} />
        </div>
        <div className="hidden lg:block">
          <Logo background="night" height={56} />
        </div>
        <Mascot background="night" size={280} className="hidden lg:inline-flex" />
        <p className="hidden max-w-sm text-2xl leading-snug text-night-text lg:block">
          {AUTH_PANEL_PHRASE}
        </p>
      </header>
      <main className="flex justify-center px-4 py-8 sm:py-12 lg:items-center">
        <div className="w-full max-w-md rounded-xl border border-divider bg-surface p-6 sm:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
