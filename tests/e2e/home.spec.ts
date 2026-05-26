import { test, expect } from '@playwright/test'

test.describe('Tela de Entrada', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('exibe a tela inicial com campo de nome e ações', async ({ page }) => {
    await expect(page.getByText('Retro Board')).toBeVisible()
    await expect(page.getByLabel('Seu nome')).toBeVisible()
    await expect(page.getByRole('button', { name: /Criar Nova Sessão/i })).toBeVisible()
    await expect(page.getByPlaceholder('ABC123')).toBeVisible()
  })

  test('campo de nome tem limite de 20 caracteres', async ({ page }) => {
    const nameInput = page.getByLabel('Seu nome')
    await nameInput.fill('A'.repeat(25))
    await expect(nameInput).toHaveValue('A'.repeat(20))
  })

  test('exibe erro ao tentar criar sessão sem nome', async ({ page }) => {
    await page.getByRole('button', { name: /Criar Nova Sessão/i }).click()
    await expect(page.getByText('Por favor, insira seu nome')).toBeVisible()
  })

  test('exibe erro ao tentar entrar sem código', async ({ page }) => {
    await page.getByLabel('Seu nome').fill('Carlos')
    // O botão de entrar deve estar desabilitado com menos de 6 chars
    const joinButton = page.locator('button').filter({ has: page.locator('[data-lucide="arrow-right"], svg') }).last()
    await expect(joinButton).toBeDisabled()
  })

  test('campo de código aceita apenas 6 caracteres alfanuméricos maiúsculos', async ({ page }) => {
    const codeInput = page.getByPlaceholder('ABC123')
    await codeInput.fill('abc123xyz')
    await expect(codeInput).toHaveValue('ABC123')
  })

  test('cria sessão e redireciona para o board', async ({ page }) => {
    await page.getByLabel('Seu nome').fill('Facilitador')
    await page.getByRole('button', { name: /Criar Nova Sessão/i }).click()

    // Deve redirecionar para /board/[TOKEN]
    await page.waitForURL(/\/board\/[A-Z0-9]{6}/)
    await expect(page.getByText('Retro Board')).toBeVisible()
  })

  test('salva nome no localStorage e pré-preenche em visitas futuras', async ({ page }) => {
    await page.getByLabel('Seu nome').fill('Maria')
    await page.getByRole('button', { name: /Criar Nova Sessão/i }).click()
    await page.waitForURL(/\/board\//)

    // Volta para home
    await page.goto('/')
    await expect(page.getByLabel('Seu nome')).toHaveValue('Maria')
  })
})
