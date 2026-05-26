import { test, expect } from '@playwright/test'

test.describe('Encerramento da Retro', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByLabel('Seu nome').fill('Facilitador')
    await page.getByRole('button', { name: /Criar Nova Sessão/i }).click()
    await page.waitForURL(/\/board\/[A-Z0-9]{6}/)
  })

  test('botão Encerrar Retro está disponível no menu', async ({ page }) => {
    await page.getByRole('button', { name: '' }).last().click()
    await expect(page.getByText('Encerrar Retro')).toBeVisible()
  })

  test('encerrar retro limpa todos os cards e salva ações como prev_actions', async ({ page }) => {
    // Adicionar um card na coluna Bom
    const goodColumn = page.locator('.bg-column-good\\/30').first()
    await goodColumn.getByRole('button', { name: /Adicionar/i }).click()
    await goodColumn.getByPlaceholder('Digite seu feedback...').fill('Card que será removido')
    await goodColumn.locator('button').filter({ has: page.locator('svg') }).last().click()
    await expect(goodColumn.getByText('Card que será removido')).toBeVisible()

    // Adicionar uma ação
    const actionsColumn = page.locator('.bg-column-actions\\/30').first()
    await actionsColumn.getByRole('button', { name: /Adicionar Ação/i }).click()
    await actionsColumn.getByPlaceholder('Descreva a ação...').fill('Ação para próxima sprint')
    await actionsColumn.locator('button').filter({ has: page.locator('svg') }).last().click()
    await expect(actionsColumn.getByText('Ação para próxima sprint')).toBeVisible()

    // Encerrar retro (aceitar confirmação)
    page.on('dialog', dialog => dialog.accept())
    await page.getByRole('button', { name: '' }).last().click()
    await page.getByText('Encerrar Retro').click()

    // Cards devem sumir
    await expect(goodColumn.getByText('Card que será removido')).not.toBeVisible({ timeout: 10000 })
    await expect(actionsColumn.getByText('Ação para próxima sprint')).not.toBeVisible()
  })

  test('ações anteriores ficam disponíveis após encerramento', async ({ page }) => {
    // Adicionar uma ação
    const actionsColumn = page.locator('.bg-column-actions\\/30').first()
    await actionsColumn.getByRole('button', { name: /Adicionar Ação/i }).click()
    await actionsColumn.getByPlaceholder('Descreva a ação...').fill('Ação persistente')
    await actionsColumn.locator('button').filter({ has: page.locator('svg') }).last().click()
    await expect(actionsColumn.getByText('Ação persistente')).toBeVisible()

    // Encerrar retro
    page.on('dialog', dialog => dialog.accept())
    await page.getByRole('button', { name: '' }).last().click()
    await page.getByText('Encerrar Retro').click()

    // Esperar limpeza
    await expect(actionsColumn.getByText('Ação persistente')).not.toBeVisible({ timeout: 10000 })

    // Abrir painel de ações anteriores
    await page.getByRole('button', { name: '' }).last().click()
    await page.getByText('Ações Anteriores').click()

    // Deve mostrar a ação como prev_action
    await expect(page.getByText('Ação persistente')).toBeVisible()
  })
})
