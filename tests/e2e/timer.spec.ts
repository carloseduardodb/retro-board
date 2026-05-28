import { test, expect, Page } from '@playwright/test'

async function createSessionAndEnter(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Criar Sessão' }).click()
  await page.waitForURL(/\/board\/[A-Z0-9]{6}/)

  const namePrompt = page.getByPlaceholder('Seu nome ou apelido')
  if (await namePrompt.isVisible({ timeout: 1000 }).catch(() => false)) {
    await namePrompt.fill('Testador')
    await page.getByRole('button', { name: 'Entrar na Retro' }).click()
  }

  await expect(page.getByText('O que foi bom')).toBeVisible()
}

test.describe('Timer', () => {
  test.beforeEach(async ({ page }) => {
    await createSessionAndEnter(page)
  })

  test('exibe timer no estado configurando com 5 min padrão', async ({ page }) => {
    await expect(page.getByText('Timer')).toBeVisible()
    await expect(page.getByText('05:00')).toBeVisible()
    await expect(page.getByText('Configure o tempo')).toBeVisible()
    await expect(page.locator('input[type="number"]')).toHaveValue('5')
    await expect(page.getByRole('button', { name: 'Iniciar' })).toBeVisible()
  })

  test('inicia timer e mostra controles de rodando', async ({ page }) => {
    await page.getByRole('button', { name: 'Iniciar' }).click()

    await expect(page.getByRole('button', { name: 'Pausar' })).toBeVisible()
    await expect(page.getByRole('button', { name: /1 min/i })).toBeVisible()
    await expect(page.getByText('Em andamento')).toBeVisible()
  })

  test('pausa e retoma o timer', async ({ page }) => {
    await page.getByRole('button', { name: 'Iniciar' }).click()
    await page.getByRole('button', { name: 'Pausar' }).click()

    await expect(page.getByRole('button', { name: 'Retomar' })).toBeVisible()
    await expect(page.getByText('Pausado')).toBeVisible()

    await page.getByRole('button', { name: 'Retomar' }).click()
    await expect(page.getByText('Em andamento')).toBeVisible()
  })

  test('adiciona +1 minuto enquanto rodando', async ({ page }) => {
    // Configurar para 1 minuto
    await page.locator('input[type="number"]').fill('1')
    await page.getByRole('button', { name: 'Iniciar' }).click()

    // Esperar um pouco para o timer decrementar
    await page.waitForTimeout(1500)

    // Adicionar 1 min
    await page.getByRole('button', { name: /1 min/i }).click()

    // Tempo deve ser maior que 1:00
    await page.waitForTimeout(500)
    const display = page.locator('.text-4xl.font-mono')
    const text = await display.textContent()
    const [mins] = (text || '00:00').split(':').map(Number)
    expect(mins).toBeGreaterThanOrEqual(1)
  })
})
