import { test, expect, Page } from '@playwright/test'

async function createSessionAndEnter(page: Page): Promise<string> {
  await page.goto('/')
  await page.getByRole('button', { name: 'Criar Sessão' }).click()
  await page.waitForURL(/\/board\/[A-Z0-9]{6}/)

  // Set name if prompted
  const namePrompt = page.getByPlaceholder('Seu nome ou apelido')
  if (await namePrompt.isVisible({ timeout: 1000 }).catch(() => false)) {
    await namePrompt.fill('Testador')
    await page.getByRole('button', { name: 'Entrar na Retro' }).click()
  }

  await expect(page.getByText('O que foi bom')).toBeVisible()
  return page.url().split('/board/')[1]
}

test.describe('Board - Colunas e Layout', () => {
  test.beforeEach(async ({ page }) => {
    await createSessionAndEnter(page)
  })

  test('exibe as 4 colunas', async ({ page }) => {
    await expect(page.getByText('O que foi bom')).toBeVisible()
    await expect(page.getByText('O que pode melhorar')).toBeVisible()
    await expect(page.getByText('Ideias')).toBeVisible()
    await expect(page.getByText('Ações')).toBeVisible()
  })

  test('exibe token no header', async ({ page }) => {
    const token = page.url().split('/board/')[1]
    await expect(page.getByText(token)).toBeVisible()
  })

  test('exibe status de conexão', async ({ page }) => {
    await expect(page.getByText('Conectado')).toBeVisible()
  })

  test('exibe contagem de participantes', async ({ page }) => {
    await expect(page.getByText('Participantes')).toBeVisible()
  })

  test('exibe timer no sidebar', async ({ page }) => {
    await expect(page.getByText('Timer')).toBeVisible()
    await expect(page.getByText('05:00')).toBeVisible()
  })
})

test.describe('Board - Cards Anônimos', () => {
  test.beforeEach(async ({ page }) => {
    await createSessionAndEnter(page)
  })

  test('adiciona card na coluna Bom (aparece imediatamente)', async ({ page }) => {
    await page.getByRole('button', { name: 'Adicionar' }).first().click()
    await page.getByPlaceholder('Digite seu feedback...').fill('Boa comunicação')
    await page.locator('button:has(svg)').filter({ hasText: '' }).nth(3).click()

    // Card deve aparecer sem nome do autor (anônimo)
    await expect(page.getByText('Boa comunicação')).toBeVisible()
  })

  test('card não exibe nome do autor', async ({ page }) => {
    await page.getByRole('button', { name: 'Adicionar' }).first().click()
    await page.getByPlaceholder('Digite seu feedback...').fill('Card anônimo')
    // Click send button (last button in the form area)
    const form = page.locator('[class*="border-dashed"]').first()
    await form.locator('button').last().click()

    await expect(page.getByText('Card anônimo')).toBeVisible({ timeout: 5000 })

    // Não deve ter "Testador" visível no card
    const column = page.locator('[class*="column-good"]').first()
    await expect(column.getByText('Testador')).not.toBeVisible()
  })

  test('exibe contador de caracteres', async ({ page }) => {
    await page.getByRole('button', { name: 'Adicionar' }).first().click()
    await page.getByPlaceholder('Digite seu feedback...').fill('Hello')
    await expect(page.getByText('5/500')).toBeVisible()
  })

  test('vota e remove voto', async ({ page }) => {
    // Adicionar card
    await page.getByRole('button', { name: 'Adicionar' }).first().click()
    await page.getByPlaceholder('Digite seu feedback...').fill('Card para votar')
    const form = page.locator('[class*="border-dashed"]').first()
    await form.locator('button').last().click()

    await expect(page.getByText('Card para votar')).toBeVisible({ timeout: 5000 })

    // Votar (button with text "0")
    await page.getByRole('button', { name: '0' }).first().click()
    await expect(page.getByRole('button', { name: '1' }).first()).toBeVisible({ timeout: 5000 })

    // Remover voto
    await page.getByRole('button', { name: '1' }).first().click()
    await expect(page.getByRole('button', { name: '0' }).first()).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Board - Coluna Ações', () => {
  test.beforeEach(async ({ page }) => {
    await createSessionAndEnter(page)
  })

  test('adiciona ação com responsável', async ({ page }) => {
    await page.getByRole('button', { name: 'Adicionar Ação' }).click()
    await page.getByPlaceholder('Descreva a ação...').fill('Melhorar testes')
    await page.getByPlaceholder('Responsável (opcional)').fill('Tech Lead')

    // Submit
    const sendBtn = page.locator('[class*="column-actions"]').locator('button:has(svg)').last()
    await sendBtn.click()

    await expect(page.getByText('Melhorar testes')).toBeVisible()
    await expect(page.getByText('Tech Lead')).toBeVisible()
  })

  test('adiciona ação sem responsável', async ({ page }) => {
    await page.getByRole('button', { name: 'Adicionar Ação' }).click()
    await page.getByPlaceholder('Descreva a ação...').fill('Ação do time')

    const sendBtn = page.locator('[class*="column-actions"]').locator('button:has(svg)').last()
    await sendBtn.click()

    await expect(page.getByText('Ação do time')).toBeVisible()
  })
})
