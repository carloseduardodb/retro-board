import cron from 'node-cron'

/**
 * Agenda os cron jobs do aplicativo.
 * Chamado uma vez na inicialização do servidor via instrumentation.ts
 */
export function scheduleCronJobs() {
  // Captura de snapshots: todo dia às 00:00 horário de Brasília
  cron.schedule('0 0 * * *', async () => {
    console.log('[cron] Iniciando captura de snapshots...')

    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

      const res = await fetch(`${baseUrl}/api/snapshots/capture`, {
        method: 'POST',
      })

      if (res.ok) {
        const data = await res.json()
        console.log(`[cron] Snapshots capturados: ${data.captured}, ignorados: ${data.skipped}, erros: ${data.errors.length}`)
      } else {
        console.error(`[cron] Falha na captura: HTTP ${res.status}`)
      }
    } catch (error) {
      console.error('[cron] Erro na captura de snapshots:', error)
    }
  }, {
    timezone: 'America/Sao_Paulo',
  })

  console.log('[cron] Snapshot diário agendado para 00:00 (America/Sao_Paulo)')
}
