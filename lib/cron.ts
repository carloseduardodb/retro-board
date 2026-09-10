import cron from 'node-cron'
import { captureSnapshots, lastCapturedDate } from './snapshot-capture'
import { calculateReferenceDate } from './snapshot-utils'

const TIMEZONE = 'America/Sao_Paulo'

// Janela de recuperação, em horas de Brasília. Uma virada perdida (deploy no
// meio da noite, container reiniciado, processo dormindo) é refeita na hora
// seguinte — mas só de madrugada, para que uma reinicialização às 15h nunca
// limpe o board de uma retro em andamento.
const CATCHUP_UNTIL_HOUR = 6

function brasiliaHour(now = new Date()): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: TIMEZONE,
      hour: '2-digit',
      hour12: false,
    }).format(now),
  )
}

async function runCapture(motivo: string) {
  console.log(`[cron] Iniciando captura de snapshots (${motivo})...`)

  try {
    const { captured, skipped, errors } = await captureSnapshots()
    console.log(
      `[cron] Snapshots capturados: ${captured}, ignorados: ${skipped}, erros: ${errors.length}`,
    )
    for (const erro of errors) {
      console.error(`[cron] ${erro}`)
    }
  } catch (error) {
    console.error('[cron] Erro na captura de snapshots:', error)
  }
}

/**
 * A virada do dia já aconteceu? Compara a data de referência de hoje (o dia
 * anterior em Brasília) com a última efetivamente gravada.
 */
async function precisaCapturar(): Promise<boolean> {
  try {
    const ultima = await lastCapturedDate()
    return ultima === null || ultima < calculateReferenceDate()
  } catch (error) {
    console.error('[cron] Erro ao verificar último snapshot:', error)
    return false
  }
}

/**
 * Agenda os cron jobs do aplicativo.
 * Chamado uma vez na inicialização do servidor via instrumentation.ts
 */
export function scheduleCronJobs() {
  // A captura roda de hora em hora durante a madrugada e para assim que o dia
  // já estiver gravado. O tique da meia-noite é a captura normal; os seguintes
  // só agem se aquele não tiver acontecido.
  cron.schedule(
    '0 * * * *',
    async () => {
      const hora = brasiliaHour()

      if (hora >= CATCHUP_UNTIL_HOUR) return
      if (!(await precisaCapturar())) return

      await runCapture(hora === 0 ? 'virada do dia' : `recuperação ${hora}h`)
    },
    { timezone: TIMEZONE },
  )

  console.log(
    `[cron] Snapshot diário agendado para 00:00 (${TIMEZONE}), com recuperação de hora em hora até as ${CATCHUP_UNTIL_HOUR}h`,
  )
}
