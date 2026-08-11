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

/**
 * Cria uma ação e espera o id definitivo do servidor. O card entra otimista com
 * um id temporário e é trocado quando o POST responde — a troca remonta o card
 * e cancelaria um editor aberto logo em seguida.
 */
async function addAction(page: Page, text: string) {
  const column = page.getByTestId('column-actions')
  await column.getByRole('button', { name: 'Adicionar Ação' }).click()
  await column.getByPlaceholder('Descreva a ação...').fill(text)
  await column.locator('[class*="border-dashed"]').locator('button').last().click()
  await expect(
    column.locator('[data-action-id]:not([data-action-id^="temp-"])').filter({ hasText: text })
  ).toHaveCount(1, { timeout: 10000 })
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

/**
 * Cria um card e espera o id definitivo do servidor. O card entra otimista com
 * um id temporário e é trocado quando o POST responde — a troca remonta o card
 * e fecharia um menu aberto logo em seguida.
 */
async function addCard(page: Page, column: 'good' | 'bad' | 'ideas', text: string) {
  const col = page.getByTestId(`column-${column}`)
  await col.getByRole('button', { name: 'Adicionar' }).click()
  await col.getByPlaceholder('Digite seu feedback...').fill(text)
  await col.locator('[class*="border-dashed"]').locator('button').last().click()
  await expect(
    col.locator('[data-card-id]:not([data-card-id^="temp-"])').filter({ hasText: text })
  ).toHaveCount(1, { timeout: 10000 })
}

test.describe('Board - Cards Anônimos', () => {
  test.beforeEach(async ({ page }) => {
    await createSessionAndEnter(page)
  })

  test('adiciona card na coluna Bom (aparece imediatamente)', async ({ page }) => {
    const column = page.getByTestId('column-good')
    await column.getByRole('button', { name: 'Adicionar' }).click()
    await column.getByPlaceholder('Digite seu feedback...').fill('Boa comunicação')
    await column.locator('[class*="border-dashed"]').locator('button').last().click()

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
    const column = page.getByTestId('column-good')
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

  test('adiciona ação', async ({ page }) => {
    await addAction(page, 'Ação do time')
    await expect(page.getByText('Ação do time')).toBeVisible()
  })

  test('registra o responsável pela ação', async ({ page }) => {
    const column = page.getByTestId('column-actions')

    await column.getByRole('button', { name: 'Adicionar Ação' }).click()
    await column.getByPlaceholder('Descreva a ação...').fill('Quebrar o job da CI')
    await column.getByPlaceholder('Responsável (opcional)').fill('Diego')
    await column.locator('[class*="border-dashed"]').locator('button').last().click()

    const actionCard = column.locator('[data-action-id]').filter({ hasText: 'Quebrar o job da CI' })
    await expect(actionCard).toHaveCount(1, { timeout: 10000 })
    await expect(actionCard.getByText('Diego')).toBeVisible()
  })

  test('responsável sugere quem está na sala', async ({ page }) => {
    const column = page.getByTestId('column-actions')
    await column.getByRole('button', { name: 'Adicionar Ação' }).click()

    // O campo é livre — quem vai tocar a ação pode não estar na retro —, mas
    // oferece os presentes como atalho.
    const field = column.getByPlaceholder('Responsável (opcional)')
    const listId = await field.getAttribute('list')
    expect(listId).toBeTruthy()
    await expect(page.locator(`#${listId} option`).first()).toHaveAttribute('value', /.+/)
  })

  test('edita uma ação existente', async ({ page }) => {
    const actionsColumn = page.getByTestId('column-actions')
    await addAction(page, 'Melhorar testes')

    const actionCard = actionsColumn.locator('.group', { hasText: 'Melhorar testes' }).first()
    await expect(actionCard).toBeVisible()

    await actionCard.hover()
    await actionCard.getByTitle('Editar ação').click()

    await actionsColumn.locator('textarea').fill('Melhorar testes de integração')
    await actionsColumn.locator('button:has(svg)').last().click()

    await expect(actionsColumn.getByText('Melhorar testes de integração')).toBeVisible()
  })
})

test.describe('Board - Card vira ação', () => {
  test('mover para Ações tira o card da coluna de origem', async ({ page }) => {
    await createSessionAndEnter(page)
    await addCard(page, 'bad', 'Build da CI passou de 18 minutos')

    const origem = page.getByTestId('column-bad')
    await origem.locator('[data-card-id]').first().hover()
    await origem.getByTitle('Ações do card').click()

    // O menu do Radix abre com animação; clicar antes de assentar não pega.
    const item = page.getByRole('menuitem', { name: 'Transformar em ação' })
    await expect(item).toBeVisible()
    await page.waitForTimeout(300)
    await item.click()

    // Ações vivem noutra tabela: o card sai de vez, sem cópia para trás.
    const acoes = page.getByTestId('column-actions')
    await expect(acoes.getByText('Build da CI passou de 18 minutos')).toBeVisible({ timeout: 10000 })
    await expect(origem.locator('[data-card-id]')).toHaveCount(0)
  })
})

test.describe('Board - Peso do card', () => {
  test('reações contam junto com os votos na ordenação', async ({ page }) => {
    const token = await createSessionAndEnter(page)
    const coluna = page.getByTestId('column-good')

    await addCard(page, 'good', 'Card com votos')
    await addCard(page, 'good', 'Card com reacoes')

    const ids = await coluna.locator('[data-card-id]').evaluateAll((els) =>
      els.map((e) => ({ id: e.getAttribute('data-card-id'), texto: e.textContent ?? '' }))
    )
    const comVotos = ids.find((c) => c.texto.includes('Card com votos'))!.id
    const comReacoes = ids.find((c) => c.texto.includes('Card com reacoes'))!.id

    // Três votos contra quatro reações: reagir também é dizer que importa, então
    // o card reagido tem de subir mesmo sem nenhum joinha.
    await page.evaluate(
      async ({ token, comVotos, comReacoes }) => {
        const post = (url: string, body: unknown) =>
          fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        for (let i = 0; i < 3; i++) {
          await post('/api/cards/vote', {
            card_id: comVotos,
            participant_id: `v${i}-${token}`,
            action: 'vote',
          })
        }
        for (let i = 0; i < 4; i++) {
          await post('/api/cards/react', {
            card_id: comReacoes,
            participant_id: `r${i}-${token}`,
            emoji: '🚀',
          })
        }
      },
      { token, comVotos, comReacoes }
    )

    await page.reload()
    await expect(coluna.locator('[data-card-id]')).toHaveCount(2)
    const ordem = await coluna.locator('[data-card-id] p').allInnerTexts()
    expect(ordem[0]).toContain('Card com reacoes')
    expect(ordem[1]).toContain('Card com votos')
  })
})

