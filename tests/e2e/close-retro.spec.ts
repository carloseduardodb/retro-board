import { test, expect, Page } from '@playwright/test'

async function createSessionAndEnter(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Criar Sessão' }).click()
  await page.waitForURL(/\/board\/[A-Z0-9]{6}/)

  const namePrompt = page.getByPlaceholder('Seu nome ou apelido')
  if (await namePrompt.isVisible({ timeout: 1000 }).catch(() => false)) {
    await namePrompt.fill('Facilitador')
    await page.getByRole('button', { name: 'Entrar na Retro' }).click()
  }

  await expect(page.getByText('O que foi bom')).toBeVisible()
}

async function addAction(page: Page, text: string) {
  const column = page.getByTestId('column-actions')
  await column.getByRole('button', { name: 'Adicionar Ação' }).click()
  await column.getByPlaceholder('Descreva a ação...').fill(text)
  // Click the send button inside the actions column form
  await column.locator('[class*="border-dashed"]').locator('button').last().click()
  await expect(
    column.locator('[data-action-id]:not([data-action-id^="temp-"])').filter({ hasText: text })
  ).toHaveCount(1, { timeout: 10000 })
}

async function closeRetro(page: Page) {
  // Register dialog handler BEFORE triggering
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Mais ações' }).click()
  await page.getByRole('menuitem', { name: 'Encerrar Retro' }).click()
}

test.describe('Encerramento da Retro', () => {
  test.beforeEach(async ({ page }) => {
    await createSessionAndEnter(page)
  })

  test('botão Encerrar Retro está no menu', async ({ page }) => {
    await page.getByRole('button', { name: 'Mais ações' }).click()
    await expect(page.getByRole('menuitem', { name: 'Encerrar Retro' })).toBeVisible()
  })

  test('encerrar retro limpa ações e reseta timer', async ({ page }) => {
    await addAction(page, 'Ação da sprint')

    await closeRetro(page)

    // Ação deve sumir
    await expect(page.getByText('Ação da sprint')).not.toBeVisible({ timeout: 10000 })

    // Timer deve resetar
    await expect(page.getByText('05:00')).toBeVisible()
    await expect(page.getByText('Configure o tempo')).toBeVisible()
  })

  test('ações são salvas como ações anteriores', async ({ page }) => {
    await addAction(page, 'Ação persistente')

    await closeRetro(page)
    await expect(page.getByText('Ação persistente')).not.toBeVisible({ timeout: 10000 })

    // Verificar ações anteriores
    await page.getByRole('button', { name: 'Mais ações' }).click()
    await page.getByRole('menuitem', { name: 'Ações Anteriores' }).click()

    await expect(page.getByText('Ações da Sprint Anterior')).toBeVisible()
    await expect(page.getByText('Ação persistente')).toBeVisible()
  })

  test('checkbox de ação anterior funciona', async ({ page }) => {
    await addAction(page, 'Ação para marcar')

    await closeRetro(page)
    await expect(page.getByText('Ação para marcar')).not.toBeVisible({ timeout: 10000 })

    // Abrir ações anteriores
    await page.getByRole('button', { name: 'Mais ações' }).click()
    await page.getByRole('menuitem', { name: 'Ações Anteriores' }).click()
    await expect(page.getByText('0 de 1 concluídas')).toBeVisible()

    await page.getByRole('checkbox').click()
    await expect(page.getByText('1 de 1 concluídas')).toBeVisible()
  })
})
