import { test, expect } from '@playwright/test'

test.describe('Tela Inicial', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('exibe título e descrição', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Retro Board' })).toBeVisible()
    await expect(page.getByText('Retrospectiva colaborativa em tempo real')).toBeVisible()
  })

  test('exibe abas Nova Sessão e Entrar', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'Nova Sessão' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Entrar' })).toBeVisible()
  })

  test('aba Nova Sessão está selecionada por padrão', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'Nova Sessão' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('button', { name: 'Criar Sessão' })).toBeVisible()
  })

  test('cria sessão e redireciona para o board', async ({ page }) => {
    await page.getByRole('button', { name: 'Criar Sessão' }).click()
    await page.waitForURL(/\/board\/[A-Z0-9]{6}/)
  })

  test('aba Entrar mostra campo de código', async ({ page }) => {
    await page.getByRole('tab', { name: 'Entrar' }).click()
    await expect(page.getByPlaceholder('ABC123')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Entrar na Sessão' })).toBeVisible()
  })

  test('campo de código aceita apenas 6 caracteres alfanuméricos maiúsculos', async ({ page }) => {
    await page.getByRole('tab', { name: 'Entrar' }).click()
    const codeInput = page.getByPlaceholder('ABC123')
    await codeInput.fill('abc123xyz')
    await expect(codeInput).toHaveValue('ABC123')
  })

  test('botão Entrar desabilitado com menos de 6 caracteres', async ({ page }) => {
    await page.getByRole('tab', { name: 'Entrar' }).click()
    await page.getByPlaceholder('ABC123').fill('ABC')
    await expect(page.getByRole('button', { name: 'Entrar na Sessão' })).toBeDisabled()
  })

  test('exibe erro ao tentar entrar com código inválido', async ({ page }) => {
    await page.getByRole('tab', { name: 'Entrar' }).click()
    await page.getByPlaceholder('ABC123').fill('ZZZZZZ')
    await page.getByRole('button', { name: 'Entrar na Sessão' }).click()
    await expect(page.getByText(/não encontrada/i)).toBeVisible()
  })

  test('entra em sessão existente com código válido', async ({ page }) => {
    // Criar sessão primeiro
    await page.getByRole('button', { name: 'Criar Sessão' }).click()
    await page.waitForURL(/\/board\/[A-Z0-9]{6}/)
    const token = page.url().split('/board/')[1]

    // Voltar e entrar com o código
    await page.goto('/')
    await page.getByRole('tab', { name: 'Entrar' }).click()
    await page.getByPlaceholder('ABC123').fill(token)
    await page.getByRole('button', { name: 'Entrar na Sessão' }).click()
    await page.waitForURL(`/board/${token}`)
  })
})
