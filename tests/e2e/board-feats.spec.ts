import { test, expect, Page } from '@playwright/test'

async function createSessionAndEnter(page: Page): Promise<string> {
  await page.goto('/')
  await page.getByRole('button', { name: 'Criar Sessão' }).click()
  await page.waitForURL(/\/board\/[A-Z0-9]{6}/)

  const namePrompt = page.getByPlaceholder('Seu nome ou apelido')
  if (await namePrompt.isVisible({ timeout: 1000 }).catch(() => false)) {
    await namePrompt.fill('Testador')
    await page.getByRole('button', { name: 'Entrar na Retro' }).click()
  }

  await expect(page.getByText('O que foi bom')).toBeVisible()
  return page.url().split('/board/')[1]
}

async function addCard(page: Page, text: string) {
  const column = page.getByTestId('column-good')
  await column.getByRole('button', { name: 'Adicionar' }).click()
  await column.getByPlaceholder('Digite seu feedback...').fill(text)
  await column.locator('[class*="border-dashed"]').locator('button').last().click()
  await expect(page.getByText(text)).toBeVisible({ timeout: 10000 })
  // O card entra otimista com id temporário e é trocado pelo card do servidor
  // quando o POST responde — a troca remonta o card e derruba qualquer popover
  // aberto. Esperar o id definitivo evita corrida.
  await expect(
    column.locator('[data-card-id]:not([data-card-id^="temp-"])').filter({ hasText: text })
  ).toHaveCount(1, { timeout: 10000 })
}

test.describe('Board - Reações com emoji', () => {
  test.beforeEach(async ({ page }) => {
    await createSessionAndEnter(page)
  })

  test('adiciona e remove reação em um card', async ({ page }) => {
    await addCard(page, 'Pareamento funcionou bem')

    const card = page.locator('.group', { hasText: 'Pareamento funcionou bem' }).first()
    await card.hover()
    await card.getByRole('button', { name: 'Reagir' }).click()

    await page.getByRole('button', { name: '🔥', exact: true }).click()
    await expect(card.getByText('🔥')).toBeVisible({ timeout: 10000 })
    await expect(card.getByTitle('1 reação')).toBeVisible()

    // Clicar no chip remove a reação
    await card.getByTitle('1 reação').click()
    await expect(card.getByTitle('1 reação')).toHaveCount(0, { timeout: 10000 })
  })

  test('busca emoji por palavra-chave no seletor', async ({ page }) => {
    await addCard(page, 'Deploy quebrou em produção')

    const card = page.locator('.group', { hasText: 'Deploy quebrou em produção' }).first()
    await card.hover()
    await card.getByRole('button', { name: 'Reagir' }).click()

    await page.getByPlaceholder('Buscar emoji').fill('bug')
    await page.getByRole('button', { name: '🐛', exact: true }).click()

    await expect(card.getByText('🐛')).toBeVisible({ timeout: 10000 })
  })

  test('navega entre categorias do seletor', async ({ page }) => {
    await addCard(page, 'Documentação melhorou')

    const card = page.locator('.group', { hasText: 'Documentação melhorou' }).first()
    await card.hover()
    await card.getByRole('button', { name: 'Reagir' }).click()

    await expect(page.getByText('Usados recentemente')).toBeVisible()

    await page.getByTitle('Comida').click()
    await page.getByRole('button', { name: '☕', exact: true }).click()

    await expect(card.getByText('☕')).toBeVisible({ timeout: 10000 })
  })
})

test.describe('Board - Ocultação anti-viés', () => {
  test.beforeEach(async ({ page }) => {
    await createSessionAndEnter(page)
  })

  test('cards próprios continuam visíveis com o timer rodando', async ({ page }) => {
    await addCard(page, 'Card do próprio autor')
    await page.getByRole('button', { name: 'Iniciar' }).click()

    await expect(page.getByText('Card do próprio autor')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Oculto enquanto o timer roda')).toHaveCount(0)
  })

  test('não existe botão de revelar cards', async ({ page }) => {
    await page.getByRole('button', { name: 'Iniciar' }).click()
    await expect(page.getByRole('button', { name: 'Revelar cards' })).toHaveCount(0)
  })
})

test.describe('Board - Agrupamento de cards', () => {
  test.beforeEach(async ({ page }) => {
    await createSessionAndEnter(page)
  })

  test('agrupa dois cards arrastando um sobre o outro', async ({ page }) => {
    await addCard(page, 'Deploy demora demais')
    await addCard(page, 'Pipeline trava no build')

    const source = page.locator('.group', { hasText: 'Pipeline trava no build' }).first()
    const target = page.locator('.group', { hasText: 'Deploy demora demais' }).first()

    await source.hover()
    const handle = source.locator('svg').first()
    const targetBox = await target.boundingBox()
    if (!targetBox) throw new Error('Card alvo sem bounding box')

    await handle.hover()
    await page.mouse.down()
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 12 })
    await page.mouse.up()

    await expect(page.getByText('Sem nome')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTitle('2 cards agrupados')).toBeVisible()

    // Nomear o grupo
    await page.getByText('Sem nome').click()
    await page.getByPlaceholder('Nome do grupo').fill('Deploy lento')
    await page.getByPlaceholder('Nome do grupo').press('Enter')
    await expect(page.getByText('Deploy lento')).toBeVisible({ timeout: 10000 })

    // Recolher e expandir
    await page.getByTitle('Recolher grupo').click()
    await expect(page.getByText('Mostrar 2 cards agrupados')).toBeVisible()
    await page.getByTitle('Expandir grupo').click()
    await expect(page.getByText('Deploy demora demais')).toBeVisible()

    // Desagrupar
    await page.getByTitle('Desagrupar todos').click()
    await expect(page.getByTitle('2 cards agrupados')).toHaveCount(0, { timeout: 10000 })
  })
})
