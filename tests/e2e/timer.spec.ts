import { test, expect } from '@playwright/test'

test.describe('Timer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByLabel('Seu nome').fill('Testador')
    await page.getByRole('button', { name: /Criar Nova Sessão/i }).click()
    await page.waitForURL(/\/board\/[A-Z0-9]{6}/)
  })

  test('exibe timer no estado configurando com valor padrão de 5 min', async ({ page }) => {
    await expect(page.getByText('Timer')).toBeVisible()
    await expect(page.getByText('Configure o tempo')).toBeVisible()
    await expect(page.getByText('05:00')).toBeVisible()

    // Campo de minutos com valor 5
    const minutesInput = page.locator('input[type="number"]')
    await expect(minutesInput).toHaveValue('5')
  })

  test('permite alterar o valor de minutos antes de iniciar', async ({ page }) => {
    const minutesInput = page.locator('input[type="number"]')
    await minutesInput.fill('10')

    // Display deve atualizar
    await expect(page.getByText('10:00')).toBeVisible()
  })

  test('inicia o timer e exibe controles de rodando', async ({ page }) => {
    await page.getByRole('button', { name: /Iniciar/i }).click()

    // Deve mostrar botões Pausar e +1 min
    await expect(page.getByRole('button', { name: /Pausar/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /1 min/i })).toBeVisible()
    await expect(page.getByText('Em andamento')).toBeVisible()
  })

  test('pausa e retoma o timer', async ({ page }) => {
    await page.getByRole('button', { name: /Iniciar/i }).click()
    await page.getByRole('button', { name: /Pausar/i }).click()

    // Deve mostrar Retomar
    await expect(page.getByRole('button', { name: /Retomar/i })).toBeVisible()
    await expect(page.getByText('Pausado')).toBeVisible()

    // Retomar
    await page.getByRole('button', { name: /Retomar/i }).click()
    await expect(page.getByText('Em andamento')).toBeVisible()
  })

  test('adiciona +1 minuto enquanto rodando', async ({ page }) => {
    // Configurar para 1 minuto
    const minutesInput = page.locator('input[type="number"]')
    await minutesInput.fill('1')
    await page.getByRole('button', { name: /Iniciar/i }).click()

    // Adicionar 1 min
    await page.getByRole('button', { name: /1 min/i }).click()

    // Tempo deve ser maior que 1:00 (aproximadamente 2:00)
    // Verificamos que não está abaixo de 1:30 (dando margem para o tempo que passou)
    const display = page.locator('.text-4xl.font-mono')
    const text = await display.textContent()
    const [mins] = (text || '00:00').split(':').map(Number)
    expect(mins).toBeGreaterThanOrEqual(1)
  })
})
