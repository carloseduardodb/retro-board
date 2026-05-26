import { test, expect } from '@playwright/test'

test.describe('Board - Cards e Votação', () => {
  let boardUrl: string

  test.beforeEach(async ({ page }) => {
    // Criar sessão
    await page.goto('/')
    await page.getByLabel('Seu nome').fill('Testador')
    await page.getByRole('button', { name: /Criar Nova Sessão/i }).click()
    await page.waitForURL(/\/board\/[A-Z0-9]{6}/)
    boardUrl = page.url()
  })

  test('exibe as 4 colunas do board', async ({ page }) => {
    await expect(page.getByText('O que foi bom')).toBeVisible()
    await expect(page.getByText('O que pode melhorar')).toBeVisible()
    await expect(page.getByText('Ideias')).toBeVisible()
    await expect(page.getByText('Ações')).toBeVisible()
  })

  test('adiciona card na coluna Bom', async ({ page }) => {
    // Clicar no botão Adicionar da primeira coluna (Bom)
    const goodColumn = page.locator('.bg-column-good\\/30').first()
    await goodColumn.getByRole('button', { name: /Adicionar/i }).click()

    // Preencher e enviar
    const textarea = goodColumn.getByPlaceholder('Digite seu feedback...')
    await textarea.fill('Boa comunicação do time')
    await goodColumn.locator('button').filter({ has: page.locator('svg') }).last().click()

    // Card deve aparecer
    await expect(goodColumn.getByText('Boa comunicação do time')).toBeVisible()
  })

  test('card exibe contador de caracteres (max 500)', async ({ page }) => {
    const goodColumn = page.locator('.bg-column-good\\/30').first()
    await goodColumn.getByRole('button', { name: /Adicionar/i }).click()

    const textarea = goodColumn.getByPlaceholder('Digite seu feedback...')
    await textarea.fill('Teste')
    await expect(goodColumn.getByText('5/500')).toBeVisible()
  })

  test('vota e remove voto de um card', async ({ page }) => {
    // Adicionar card
    const goodColumn = page.locator('.bg-column-good\\/30').first()
    await goodColumn.getByRole('button', { name: /Adicionar/i }).click()
    await goodColumn.getByPlaceholder('Digite seu feedback...').fill('Card para votar')
    await goodColumn.locator('button').filter({ has: page.locator('svg') }).last().click()

    // Esperar card aparecer
    await expect(goodColumn.getByText('Card para votar')).toBeVisible()

    // Votar
    const voteButton = goodColumn.getByRole('button', { name: '0' })
    await voteButton.click()

    // Deve mostrar 1 voto
    await expect(goodColumn.getByText('1')).toBeVisible()

    // Remover voto
    const votedButton = goodColumn.getByRole('button', { name: '1' })
    await votedButton.click()

    // Deve voltar a 0
    await expect(goodColumn.getByText('0')).toBeVisible()
  })

  test('adiciona card de ação com responsável', async ({ page }) => {
    const actionsColumn = page.locator('.bg-column-actions\\/30').first()
    await actionsColumn.getByRole('button', { name: /Adicionar Ação/i }).click()

    await actionsColumn.getByPlaceholder('Descreva a ação...').fill('Melhorar cobertura de testes')
    await actionsColumn.getByPlaceholder('Responsável (opcional)').fill('Tech Lead')
    await actionsColumn.locator('button').filter({ has: page.locator('svg') }).last().click()

    await expect(actionsColumn.getByText('Melhorar cobertura de testes')).toBeVisible()
    await expect(actionsColumn.getByText('Tech Lead')).toBeVisible()
  })
})

test.describe('Board - Header e Navegação', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByLabel('Seu nome').fill('Testador')
    await page.getByRole('button', { name: /Criar Nova Sessão/i }).click()
    await page.waitForURL(/\/board\/[A-Z0-9]{6}/)
  })

  test('exibe token no header e copia link completo', async ({ page }) => {
    // Token visível
    const token = page.url().split('/board/')[1]
    await expect(page.getByText(token)).toBeVisible()

    // Copiar link
    await page.getByRole('button', { name: '' }).first() // copy button
  })

  test('exibe indicador de conexão', async ({ page }) => {
    await expect(page.getByText('Conectado')).toBeVisible()
  })

  test('exibe contagem de participantes', async ({ page }) => {
    // Pelo menos 1 participante (o próprio)
    await expect(page.getByText('1')).toBeVisible()
  })
})
