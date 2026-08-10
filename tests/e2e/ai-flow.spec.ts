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

test.describe('Fluxo de IA', () => {
  test.beforeEach(async ({ page }) => {
    await createSessionAndEnter(page)
  })

  test('abre painel de IA com prompt para copiar', async ({ page }) => {
    // Open dropdown menu (the outline button in the header)
    await page.getByRole('button', { name: 'Mais ações' }).click()
    await page.getByRole('menuitem', { name: 'Gerar Ações com IA' }).click()

    await expect(page.getByText('Sugestões via IA Externa')).toBeVisible()
    await expect(page.getByText('Passo 1 — Copiar prompt')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Copiar Prompt' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Colar Retorno' })).toBeVisible()
  })

  test('navega para tela de colar JSON', async ({ page }) => {
    await page.getByRole('button', { name: 'Mais ações' }).click()
    await page.getByRole('menuitem', { name: 'Gerar Ações com IA' }).click()
    await page.getByRole('button', { name: 'Colar Retorno' }).click()

    await expect(page.getByText('Passo 2 — Colar retorno da IA')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Confirmar' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Voltar' })).toBeVisible()
  })

  test('rejeita JSON inválido', async ({ page }) => {
    await page.getByRole('button', { name: 'Mais ações' }).click()
    await page.getByRole('menuitem', { name: 'Gerar Ações com IA' }).click()
    await page.getByRole('button', { name: 'Colar Retorno' }).click()

    await page.locator('textarea').fill('isso não é json')
    await page.getByRole('button', { name: 'Confirmar' }).click()

    await expect(page.getByText(/JSON inválido/i)).toBeVisible()
  })

  test('aceita JSON válido e cria sugestões pendentes', async ({ page }) => {
    await page.getByRole('button', { name: 'Mais ações' }).click()
    await page.getByRole('menuitem', { name: 'Gerar Ações com IA' }).click()
    await page.getByRole('button', { name: 'Colar Retorno' }).click()

    const json = JSON.stringify([
      { id: '1', text: 'Não fazer deploy na sexta' },
      { id: '2', text: 'Daily mais curta' },
    ])
    await page.locator('textarea').fill(json)
    await page.getByRole('button', { name: 'Confirmar' }).click()

    await expect(page.getByText('Sugestões Pendentes')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Não fazer deploy na sexta')).toBeVisible()
    await expect(page.getByText('Daily mais curta')).toBeVisible()
  })

  test('aprovar sugestão cria card na coluna Ações', async ({ page }) => {
    await page.getByRole('button', { name: 'Mais ações' }).click()
    await page.getByRole('menuitem', { name: 'Gerar Ações com IA' }).click()
    await page.getByRole('button', { name: 'Colar Retorno' }).click()

    const json = JSON.stringify([
      { id: '1', text: 'Ação para aprovar' },
    ])
    await page.locator('textarea').fill(json)
    await page.getByRole('button', { name: 'Confirmar' }).click()

    await expect(page.getByText('Ação para aprovar')).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: 'Aprovar' }).click()

    // Fechar painel
    await page.locator('.fixed button:has(svg)').first().click()

    // Verificar na coluna Ações
    await expect(page.getByTestId('column-actions').getByText('Ação para aprovar')).toBeVisible()
  })

  test('editar sugestão antes de aprovar', async ({ page }) => {
    await page.getByRole('button', { name: 'Mais ações' }).click()
    await page.getByRole('menuitem', { name: 'Gerar Ações com IA' }).click()
    await page.getByRole('button', { name: 'Colar Retorno' }).click()

    const json = JSON.stringify([
      { id: '1', text: 'Texto original' },
    ])
    await page.locator('textarea').fill(json)
    await page.getByRole('button', { name: 'Confirmar' }).click()

    await expect(page.getByText('Texto original')).toBeVisible({ timeout: 10000 })

    // Clicar Editar
    await page.getByRole('button', { name: 'Editar' }).click()

    // Editar texto
    await page.locator('.fixed textarea').fill('Texto editado pelo time')

    // Aprovar com edição
    await page.getByRole('button', { name: 'Aprovar' }).click()

    // Fechar painel
    await page.locator('.fixed button:has(svg)').first().click()

    // Verificar que o texto editado aparece na coluna Ações
    await expect(page.getByTestId('column-actions').getByText('Texto editado pelo time')).toBeVisible()
  })

  test('rejeitar sugestão remove da lista', async ({ page }) => {
    await page.getByRole('button', { name: 'Mais ações' }).click()
    await page.getByRole('menuitem', { name: 'Gerar Ações com IA' }).click()
    await page.getByRole('button', { name: 'Colar Retorno' }).click()

    const json = JSON.stringify([
      { id: '1', text: 'Ação para rejeitar' },
    ])
    await page.locator('textarea').fill(json)
    await page.getByRole('button', { name: 'Confirmar' }).click()

    await expect(page.getByText('Ação para rejeitar')).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: 'Rejeitar' }).click()

    await expect(page.getByText('Ação para rejeitar')).not.toBeVisible()
  })
})
