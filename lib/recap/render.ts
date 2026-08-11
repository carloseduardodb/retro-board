/**
 * Renderização do recap em MP4, no servidor.
 *
 * O vídeo que a pessoa assiste na página é DOM sendo animado pelo navegador —
 * não existe arquivo nenhum para baixar. Para virar MP4 alguém precisa
 * rasterizar os ~1.600 quadros e comprimir, e é isso que acontece aqui: o
 * Remotion abre a composição num Chrome headless, percorre quadro a quadro e
 * entrega ao ffmpeg.
 *
 * É caro (minutos de CPU), então há três defesas: cache por conteúdo, uma
 * renderização por vez e recusa explícita quando já há uma rodando.
 *
 * O render também não acontece dentro da requisição que o pede. Um pedido que
 * fica minutos em silêncio morre no proxy — o `proxy_read_timeout` padrão do
 * nginx é de 60s — então quem pede recebe um identificador na hora e pergunta
 * pelo andamento depois. Daí o registro de trabalhos abaixo.
 */

import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readdir, rename, rm, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { renderMedia, selectComposition, type OpenGlRenderer } from '@remotion/renderer'

import { RECAP_COMPOSITION } from '@/remotion/composition'
import type { RecapData } from '@/remotion/types'

/**
 * Bundle gerado no build por `scripts/bundle-recap.mjs`. Empacotar sob demanda
 * levaria dezenas de segundos no primeiro download e arrastaria o webpack para
 * dentro da imagem de produção.
 */
const BUNDLE_DIR = path.join(process.cwd(), '.remotion-bundle')
const CACHE_DIR = path.join(os.tmpdir(), 'retro-recap-render')
/** Cada MP4 pesa dezenas de MB; sem prazo de validade o disco enche sozinho. */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000

/**
 * O custo do render é por pixel: medido, 1080p rende ~3,3 quadros/s em 2 vCPU.
 * `REMOTION_RECAP_SCALE=0.667` entrega 720p em cerca de metade do tempo, sem
 * mexer no player — que continua em 1080p.
 */
const SCALE = Number(process.env.REMOTION_RECAP_SCALE ?? 1) || 1

export class RenderBusyError extends Error {}
export class BundleMissingError extends Error {}

export type RenderJob = {
  /** Hash do conteúdo do board: mesmo board, mesmo trabalho e mesmo arquivo. */
  id: string
  status: 'rendering' | 'done' | 'error'
  /** 0 a 1, vindo do próprio renderizador. */
  progress: number
  file?: string
  error?: string
  startedAt: number
}

let inFlight: Promise<string> | null = null

/**
 * Trabalhos em memória. Perder isso num restart não perde o vídeo: o arquivo
 * pronto se chama `<id>.mp4` no cache, e é de lá que o download sai.
 */
const jobs = new Map<string, RenderJob>()
const JOB_TTL_MS = 60 * 60 * 1000

function forgetOldJobs() {
  const now = Date.now()
  for (const [id, job] of jobs) {
    if (job.status !== 'rendering' && now - job.startedAt > JOB_TTL_MS) jobs.delete(id)
  }
}

/**
 * Mesmos dados, mesmo arquivo: reabrir o download não re-renderiza nada.
 *
 * A escala entra na chave porque muda o arquivo: sem ela, baixar depois de
 * trocar a variável devolveria o vídeo na resolução antiga.
 */
function cacheKey(data: RecapData): string {
  return createHash('sha1')
    .update(`${SCALE}:${JSON.stringify(data)}`)
    .digest('hex')
    .slice(0, 16)
}

export function recapFilename(data: RecapData): string {
  return `retro-${data.token.toLowerCase()}.mp4`
}

/** Varre o cache antes de gravar mais um arquivo. Falha aqui nunca é fatal. */
async function sweepCache(): Promise<void> {
  const now = Date.now()
  const entries = await readdir(CACHE_DIR).catch(() => [])
  await Promise.all(
    entries.map(async (entry) => {
      const file = path.join(CACHE_DIR, entry)
      const info = await stat(file).catch(() => null)
      if (info && now - info.mtimeMs > CACHE_TTL_MS) {
        await rm(file, { force: true }).catch(() => {})
      }
    }),
  )
}

async function render(
  data: RecapData,
  output: string,
  onProgress: (progress: number) => void,
): Promise<string> {
  if (!existsSync(path.join(BUNDLE_DIR, 'index.html'))) {
    throw new BundleMissingError(
      'Bundle do recap não encontrado. Rode `npm run bundle:recap` (o build já faz isso).',
    )
  }

  const inputProps = { data, showCaptions: true, music: true }
  const composition = await selectComposition({
    serveUrl: BUNDLE_DIR,
    id: RECAP_COMPOSITION,
    inputProps,
    browserExecutable: process.env.REMOTION_BROWSER_EXECUTABLE,
  })

  await mkdir(CACHE_DIR, { recursive: true })
  await sweepCache()

  // Grava fora do caminho final e só então renomeia: um render interrompido no
  // meio deixaria um MP4 truncado que a requisição seguinte serviria como bom.
  // O sufixo entra antes da extensão porque o Remotion recusa gravar h264+aac
  // num arquivo que não termine em .mp4/.mkv/.mov.
  const partial = output.replace(/\.mp4$/, '.partial.mp4')
  await renderMedia({
    composition,
    serveUrl: BUNDLE_DIR,
    codec: 'h264',
    audioCodec: 'aac',
    outputLocation: partial,
    inputProps,
    browserExecutable: process.env.REMOTION_BROWSER_EXECUTABLE,
    // Em container não há GPU; sem isso o Chrome tenta um backend que não existe.
    chromiumOptions: { gl: (process.env.REMOTION_GL as OpenGlRenderer | undefined) ?? 'swangle' },
    logLevel: 'error',
    scale: SCALE,
    onProgress: ({ progress }) => onProgress(progress),
  }).catch(async (cause) => {
    await rm(partial, { force: true }).catch(() => {})
    throw cause
  })

  await rename(partial, output)
  return output
}

const isJobId = (id: string) => /^[0-9a-f]{16}$/.test(id)

/** Caminho do arquivo de um trabalho, validando o id — ele vem da URL. */
async function cachedFile(id: string): Promise<string | null> {
  if (!isJobId(id)) return null
  const file = path.join(CACHE_DIR, `${id}.mp4`)
  const info = await stat(file).catch(() => null)
  return info?.isFile() && info.size > 0 ? file : null
}

/**
 * Põe o recap na fila e devolve na hora — quem pediu não fica esperando na
 * conexão. Se o vídeo desse board já existe, volta pronto.
 *
 * @throws {RenderBusyError} quando já há outra renderização em andamento. Duas
 * ao mesmo tempo não terminam antes: só dividem a mesma CPU e derrubam a
 * responsividade do site para todo mundo.
 */
export async function startRecapRender(data: RecapData): Promise<RenderJob> {
  forgetOldJobs()
  const id = cacheKey(data)

  const done = await cachedFile(id)
  if (done) {
    const job: RenderJob = { id, status: 'done', progress: 1, file: done, startedAt: Date.now() }
    jobs.set(id, job)
    return job
  }

  const existing = jobs.get(id)
  if (existing?.status === 'rendering') return existing

  if (inFlight) {
    throw new RenderBusyError('Já há um recap sendo gerado. Tente de novo em instantes.')
  }

  const job: RenderJob = { id, status: 'rendering', progress: 0, startedAt: Date.now() }
  jobs.set(id, job)

  const output = path.join(CACHE_DIR, `${id}.mp4`)
  inFlight = render(data, output, (progress) => {
    job.progress = progress
  })
    .then((file) => {
      job.status = 'done'
      job.progress = 1
      job.file = file
      return file
    })
    .catch((cause) => {
      job.status = 'error'
      job.error = cause instanceof Error ? cause.message : 'Falha ao renderizar'
      throw cause
    })
    .finally(() => {
      inFlight = null
    })

  // A promessa vive fora da requisição; sem isso a falha viraria
  // `unhandledRejection` e derrubaria o processo.
  inFlight.catch(() => {})

  return job
}

/** Estado de um trabalho. Sobrevive a restart quando o arquivo já está pronto. */
export async function getRecapJob(id: string): Promise<RenderJob | null> {
  const job = jobs.get(id)
  if (job) return job

  const file = await cachedFile(id)
  return file ? { id, status: 'done', progress: 1, file, startedAt: 0 } : null
}
