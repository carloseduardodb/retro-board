export async function register() {
  // Only run cron on the server (not during build or in the browser)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { scheduleCronJobs } = await import('./lib/cron')
    scheduleCronJobs()
  }
}
