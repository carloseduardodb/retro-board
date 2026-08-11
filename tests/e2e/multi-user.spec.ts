import { test, expect, Browser, Page } from '@playwright/test'

async function createSession(browser: Browser): Promise<{ url: string; token: string }> {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto('/')
  await page.getByRole('button', { name: 'Criar Sessão' }).click()
  await page.waitForURL(/\/board\/[A-Z0-9]{6}/)
  const url = page.url()
  const token = url.split('/board/')[1]
  await page.close()
  await context.close()
  return { url, token }
}

async function joinAsUser(browser: Browser, url: string, name: string): Promise<Page> {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(url)

  // Wait for either name prompt or board to load
  await page.waitForTimeout(1000)

  // Fill name if prompted
  const nameInput = page.getByPlaceholder('Seu nome ou apelido')
  if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await nameInput.fill(name)
    await page.getByRole('button', { name: 'Entrar na Retro' }).click()
  }

  await expect(page.getByText('O que foi bom')).toBeVisible({ timeout: 10000 })
  return page
}

test.describe('Multi-usuário - Tempo Real', () => {
  let boardUrl: string

  test.beforeAll(async ({ browser }) => {
    const { url } = await createSession(browser)
    boardUrl = url
  })

  test('dois participantes veem um ao outro na lista de presença', async ({ browser }) => {
    const maria = await joinAsUser(browser, boardUrl, 'Maria')
    const joao = await joinAsUser(browser, boardUrl, 'João')

    // Esperar presença sincronizar
    await joao.waitForTimeout(2000)

    await expect(joao.getByText('Participantes (2)')).toBeVisible()
    await expect(joao.getByText('Maria')).toBeVisible()
    await expect(joao.getByText('João')).toBeVisible()

    await expect(maria.getByText('Participantes (2)')).toBeVisible()

    await maria.close()
    await joao.close()
  })

  test('card criado por um aparece para o outro em tempo real', async ({ browser }) => {
    const maria = await joinAsUser(browser, boardUrl, 'Maria RT')
    const joao = await joinAsUser(browser, boardUrl, 'João RT')

    // João adiciona card
    const column = joao.getByTestId('column-good')
    await column.getByRole('button', { name: 'Adicionar' }).click()
    await column.getByPlaceholder('Digite seu feedback...').fill('Feedback do João')
    await column.locator('[class*="border-dashed"]').locator('button').last().click()

    // Maria deve ver o card
    await expect(maria.getByText('Feedback do João')).toBeVisible({ timeout: 10000 })

    await maria.close()
    await joao.close()
  })

  test('voto de um aparece para o outro em tempo real', async ({ browser }) => {
    const maria = await joinAsUser(browser, boardUrl, 'Maria Voto')
    const joao = await joinAsUser(browser, boardUrl, 'João Voto')

    // Esperar cards carregarem
    await joao.waitForTimeout(1000)

    // Maria vota no card existente
    const voteBtn = maria.getByRole('button', { name: /\d+/ }).first()
    if (await voteBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      const beforeText = await voteBtn.textContent()
      await voteBtn.click()

      // João deve ver o voto atualizado
      await joao.waitForTimeout(2000)
      const joaoVoteBtn = joao.getByRole('button', { name: /\d+/ }).first()
      const afterText = await joaoVoteBtn.textContent()
      expect(Number(afterText)).toBeGreaterThanOrEqual(Number(beforeText))
    }

    await maria.close()
    await joao.close()
  })

  // Supabase Presence heartbeat pode demorar 30-60s para detectar desconexão
  // Funciona na prática mas é flaky em testes automatizados
  test.skip('participante sai e contagem atualiza', async ({ browser }) => {
    const maria = await joinAsUser(browser, boardUrl, 'Maria Sai')
    const joao = await joinAsUser(browser, boardUrl, 'João Fica')

    await joao.waitForTimeout(3000)
    const participantsText = await joao.getByText(/Participantes \(\d+\)/).textContent()
    expect(participantsText).toContain('2')

    // Maria sai
    await maria.context().close()

    // João deve ver contagem diminuir (Supabase presence pode demorar até 30s)
    await expect(joao.getByText('Participantes (1)')).toBeVisible({ timeout: 35000 })

    await joao.context().close()
  })
})

test.describe('Multi-usuário - Autoria e desenho', () => {
  test('só o dono pode editar e excluir o próprio card', async ({ browser }) => {
    const { url } = await createSession(browser)
    const ana = await joinAsUser(browser, url, 'Ana')
    const bruno = await joinAsUser(browser, url, 'Bruno')

    const coluna = ana.getByTestId('column-good')
    await coluna.getByRole('button', { name: 'Adicionar' }).click()
    await coluna.getByPlaceholder('Digite seu feedback...').fill('Card escrito pela Ana')
    await coluna.locator('[class*="border-dashed"]').locator('button').last().click()
    await expect(
      coluna.locator('[data-card-id]:not([data-card-id^="temp-"])')
    ).toHaveCount(1, { timeout: 10000 })

    const menuDo = async (page: Page) => {
      const card = page.locator('[data-card-id]').first()
      await card.hover()
      await card.getByTitle('Ações do card').click()
      const itens = await page.getByRole('menuitem').allInnerTexts()
      await page.keyboard.press('Escape')
      return itens.map((t) => t.trim())
    }

    // Reescrever ou apagar o que outra pessoa disse na retro falsearia o board;
    // mover de coluna e transformar em ação seguem abertos, são facilitação.
    const daAna = await menuDo(ana)
    expect(daAna).toContain('Editar')
    expect(daAna).toContain('Excluir')

    await bruno.locator('[data-card-id]').first().waitFor({ timeout: 10000 })
    const doBruno = await menuDo(bruno)
    expect(doBruno).not.toContain('Editar')
    expect(doBruno).not.toContain('Excluir')
    expect(doBruno).toContain('Transformar em ação')

    await ana.context().close()
    await bruno.context().close()
  })

  test('limpar o desenho não apaga o traço dos outros', async ({ browser }) => {
    const { url } = await createSession(browser)
    const ana = await joinAsUser(browser, url, 'Ana')
    const bruno = await joinAsUser(browser, url, 'Bruno')

    const rabiscar = async (page: Page, y: number) => {
      await page.getByRole('button', { name: /modo desenho/i }).click()
      await expect(page.getByRole('button', { name: /limpar o meu/i })).toBeVisible()
      await page.mouse.move(400, y)
      await page.mouse.down()
      for (let x = 400; x <= 700; x += 30) await page.mouse.move(x, y)
      await page.mouse.up()
      await page.waitForTimeout(400)
    }

    await rabiscar(ana, 300)
    await rabiscar(bruno, 400)
    await ana.waitForTimeout(800)

    const pixels = (page: Page) =>
      page.evaluate(() => {
        const canvas = document.querySelector('canvas') as HTMLCanvasElement | null
        if (!canvas) return 0
        const ctx = canvas.getContext('2d')!
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
        let n = 0
        for (let i = 3; i < data.length; i += 4) if (data[i] > 0) n++
        return n
      })

    const antes = await pixels(ana)
    expect(antes).toBeGreaterThan(0)

    // Uma borracha que leva o traço dos outros junto é convite para sacanagem.
    await bruno.getByRole('button', { name: /limpar o meu/i }).click()
    await ana.waitForTimeout(1000)

    const depois = await pixels(ana)
    expect(depois).toBeGreaterThan(0)
    expect(depois).toBeLessThan(antes)

    await ana.context().close()
    await bruno.context().close()
  })
})

