import type { Metadata } from 'next'
import {
  Clock,
  EyeOff,
  Layers,
  Link2,
  Pencil,
  Plus,
  Smile,
  Sparkles,
  Target,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { SessionForm } from '@/components/landing/session-form'
import { HeroRecap } from '@/components/landing/hero-recap'
import { ScrollRecap } from '@/components/landing/scroll-recap'
import { demoRecap } from '@/remotion/data/demo'

export const metadata: Metadata = {
  title: 'Retro Board — a retro do seu time vira vídeo',
  description:
    'Retrospectiva colaborativa em tempo real, sem cadastro: ocultação anti-viés, agrupamento, reações, rabiscos ao vivo e um recap em vídeo da própria sessão.',
}

const features = [
  {
    icon: EyeOff,
    title: 'Ocultação anti-viés',
    body: 'Enquanto o timer roda, cada um só vê o que escreveu. Quando o timer para, tudo aparece de uma vez — sem botão de revelar, para ninguém liberar antes da hora.',
  },
  {
    icon: Layers,
    title: 'Agrupamento por tema',
    body: 'Arraste um card sobre o outro e eles viram um bloco único, com título editável e a soma dos votos ordenando a coluna.',
  },
  {
    icon: Smile,
    title: 'Reações com emoji',
    body: 'Seletor completo com busca em português, categorias e usados recentemente. Independente da votação — reagir não mexe na ordem.',
  },
  {
    icon: Pencil,
    title: 'Rabiscos ao vivo',
    body: 'Desenhe por cima do board e todo mundo vê na hora. Os traços somem sozinhos 6 s depois que você para — o desenho inteiro junto, nunca pela metade.',
  },
  {
    icon: Clock,
    title: 'Timer sincronizado',
    body: 'Um timer só para a sala inteira, com pausa e +1 min. É ele que controla a fase de escrita e a revelação.',
  },
  {
    icon: Sparkles,
    title: 'Ações sugeridas por IA',
    body: 'O board monta o prompt com os cards por votos, você cola na IA que preferir e traz o JSON de volta. Cada sugestão é aprovada ou descartada pelo time.',
  },
  {
    icon: Target,
    title: 'Ações da sprint anterior',
    body: 'Ao encerrar, as ações ficam guardadas e voltam na próxima retro com checkbox de concluído. A retro cobra a si mesma.',
  },
  {
    icon: Link2,
    title: 'Só um link',
    body: 'Sem login, sem convite, sem papéis. Quem tem o link de 6 caracteres participa em tempo real.',
  },
]

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-6 lg:px-8">
        <div className="flex gap-1">
          <div className="h-3 w-3 rounded-sm bg-column-good" />
          <div className="h-3 w-3 rounded-sm bg-column-bad" />
          <div className="h-3 w-3 rounded-sm bg-column-ideas" />
          <div className="h-3 w-3 rounded-sm bg-column-actions" />
        </div>
        <span className="text-lg font-bold">Retro Board</span>
        <span className="ml-auto hidden text-sm text-muted-foreground sm:block">
          Retrospectiva colaborativa em tempo real
        </span>
      </header>

      {/* ---------------------------------------------------------------- hero */}
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:px-8">
        <div>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            Tempo real, sem cadastro
          </p>
          <h1 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            A retro do seu time,{' '}
            {/* Tons fixos: os tokens de tema deixariam esta ponta do gradiente
                azul-escuro sobre fundo preto no tema escuro. */}
            <span className="bg-gradient-to-r from-[oklch(0.62_0.16_250)] to-[oklch(0.72_0.14_205)] bg-clip-text text-transparent">
              do primeiro card à última ação
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-pretty text-lg text-muted-foreground">
            Escrita anônima com ocultação anti-viés, votos que reordenam o board sozinhos,
            agrupamento por tema e rabiscos ao vivo. No fim, o time sai com ações — e com um vídeo
            do que aconteceu.
          </p>

          <div id="comecar" className="mt-8 max-w-sm scroll-mt-8">
            <SessionForm />
          </div>
        </div>

        <div className="lg:justify-self-end">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
            <div className="flex items-center gap-1.5 border-b border-border px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-column-ideas" />
              <span className="h-2.5 w-2.5 rounded-full bg-column-good" />
              <span className="ml-3 font-mono text-xs text-muted-foreground">
                /board/{demoRecap.token}
              </span>
            </div>
            <div className="aspect-video w-full">
              <HeroRecap />
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Isto não é uma gravação: é o board desenhado quadro a quadro pelos próprios dados da
            sessão.
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------- scroll-scrub */}
      <section className="mx-auto max-w-3xl px-4 pb-10 text-center lg:px-8">
        <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
          Role a página e conduza a retro
        </h2>
        <p className="mt-4 text-muted-foreground">
          Cada rolada avança o vídeo um quadro. Suba de volta e a retro se desfaz na mesma ordem —
          votos descem, grupos se abrem, os cards voltam a ficar ocultos.
        </p>
      </section>
      <ScrollRecap data={demoRecap} />

      {/* ------------------------------------------------------------ features */}
      <section className="mx-auto max-w-7xl px-4 py-24 lg:px-8">
        <h2 className="max-w-2xl text-balance text-3xl font-bold tracking-tight sm:text-4xl">
          Feito para a parte difícil da retro: falar a verdade e sair com ação
        </h2>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-xl border border-border bg-card p-6 transition-shadow hover:shadow-md"
            >
              <Icon className="h-5 w-5 text-primary" />
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------------------- recap */}
      <section className="border-y border-border bg-card">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-24 lg:grid-cols-2 lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Recap da sessão
            </p>
            <h2 className="mt-4 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
              O vídeo desta página é o mesmo que o seu time recebe
            </h2>
            <p className="mt-6 text-muted-foreground">
              O vídeo que você acabou de assistir aceita qualquer sessão como entrada. Abra{' '}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">
                /board/SEUTOKEN/recap
              </code>{' '}
              e ele toca a sua retro: os seus cards entrando, os seus votos subindo, os seus temas
              se agrupando e as ações que o time se comprometeu a fazer.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                Ótimo para quem faltou: os destaques da retro em menos de um minuto. Board grande
                mostra os mais votados de cada coluna e diz quantos ficaram de fora.
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                O vídeo acompanha a retro que aconteceu: sem votos, sem agrupamento ou sem ações,
                as cenas correspondentes simplesmente não entram.
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                Continua anônimo — nomes de autor não aparecem em card nenhum.
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                Nada é gravado: o vídeo é montado na hora, a partir do estado atual do board.
              </li>
            </ul>
          </div>
          <div className="rounded-xl border border-border bg-background p-6">
            <p className="font-mono text-sm text-muted-foreground">
              <span className="text-primary">const</span> recap ={' '}
              <span className="text-primary">buildRecapData</span>({'{'}
              <br />
              &nbsp;&nbsp;session, cards, actionCards,
              <br />
              {'}'})
            </p>
            <p className="mt-6 text-sm text-muted-foreground">
              O board e esta página tocam o mesmo vídeo. Aqui ele roda com uma sessão de exemplo;
              no seu board, com a sua. Não existe vídeo de propaganda separado para ficar
              desatualizado.
            </p>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------------- cta */}
      <section className="mx-auto max-w-2xl px-4 py-24 text-center lg:px-8">
        <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
          Comece a retro agora
        </h2>
        <p className="mt-4 text-muted-foreground">
          Cria a sessão, manda o link no canal do time, roda o timer. É isso.
        </p>
        <Button asChild size="lg" className="mt-8">
          <a href="#comecar">
            <Plus className="mr-2 h-4 w-4" />
            Criar sessão
          </a>
        </Button>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-8 text-sm text-muted-foreground sm:flex-row lg:px-8">
          <span>Retro Board</span>
          <span>Sem cadastro, sem instalação — a sessão é o link</span>
        </div>
      </footer>
    </main>
  )
}
