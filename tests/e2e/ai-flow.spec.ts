import { test, expect } from '@playwright/test'

test.describe('Fluxo de IA', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByLabel('Seu nome').fill('Facilitador')
    await page.getByRole('button', { name: /Criar Nova Sessão/i }).click()
    await page.waitForURL(/\/board\/[A-Z0-9]{6}/)
  })

  test('abre painel de IA e exibe prompt para copiar', async ({ page }) => {
    // Abrir menu e clicar em IA
    await page.getByRole('button', { name: '' }).last().click() // menu button
    await page.getByText('Gerar Ações com IA').click()

    // Deve exibir o painel com o prompt
    await expect(page.getByText('Sugestões via IA Externa')).toBeVisible()
    await expect(page.getByText('Passo 1 — Copiar prompt')).toBeVisible()
    await expect(page.getByRole('button', { name: /Copiar Prompt/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Colar Retorno/i })).toBeVisible()
  })

  test('navega para tela de colar JSON', async ({ page }) => {
    await page.getByRole('button', { name: '' }).last().click()
    await page.getByText('Gerar Ações com IA').click()

    await page.getByRole('button', { name: /Colar Retorno/i }).click()

    await expect(page.getByText('Passo 2 — Colar retorno da IA')).toBeVisible()
    await expect(page.getByRole('button', { name: /Confirmar/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Voltar/i })).toBeVisible()
  })

  test('rejeita JSON inválido com mensagem de erro', async ({ page }) => {
    await page.getByRole('button', { name: '' }).last().click()
    await page.getByText('Gerar Ações com IA').click()
    await page.getByRole('button', { name: /Colar Retorno/i }).click()

    // Colar texto inválido
    await page.locator('textarea').fill('isso não é json')
    await page.getByRole('button', { name: /Confirmar/i }).click()

    await expect(page.getByText(/JSON inválido/i)).toBeVisible()
  })

  test('aceita JSON válido e cria sugestões pendentes', async ({ page }) => {
    await page.getByRole('button', { name: '' }).last().click()
    await page.getByText('Gerar Ações com IA').click()
    await page.getByRole('button', { name: /Colar Retorno/i }).click()

    // Colar JSON válido
    const validJson = JSON.stringify([
      { id: '1', text: 'Implementar code review obrigatório', responsible: 'Tech Lead' },
      { id: '2', text: 'Daily mais curta', responsible: null },
    ])
    await page.locator('textarea').fill(validJson)
    await page.getByRole('button', { name: /Confirmar/i }).click()

    // Deve mostrar sugestões pendentes
    await expect(page.getByText('Sugestões Pendentes')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Implementar code review obrigatório')).toBeVisible()
    await expect(page.getByText('Daily mais curta')).toBeVisible()
  })

  test('aprova sugestão e cria card de ação', async ({ page }) => {
    await page.getByRole('button', { name: '' }).last().click()
    await page.getByText('Gerar Ações com IA').click()
    await page.getByRole('button', { name: /Colar Retorno/i }).click()

    const validJson = JSON.stringify([
      { id: '1', text: 'Ação aprovável', responsible: 'Time' },
    ])
    await page.locator('textarea').fill(validJson)
    await page.getByRole('button', { name: /Confirmar/i }).click()

    // Aprovar
    await expect(page.getByText('Ação aprovável')).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: /Aprovar/i }).click()

    // Fechar painel e verificar que a ação aparece na coluna
    await page.locator('button').filter({ has: page.locator('svg.lucide-x') }).first().click()
    
    const actionsColumn = page.locator('.bg-column-actions\\/30').first()
    await expect(actionsColumn.getByText('Ação aprovável')).toBeVisible()
  })
})
