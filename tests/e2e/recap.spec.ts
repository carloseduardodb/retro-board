import { test, expect, Page } from '@playwright/test'

/** Cria uma sessão com board suficiente para o recap existir. */
async function sessionComBoard(page: Page): Promise<string> {
  await page.goto('/')
  await page.getByRole('button', { name: 'Criar Sessão' }).click()
  await page.waitForURL(/\/board\/[A-Z0-9]{6}/)
  const token = page.url().split('/board/')[1]

  const namePrompt = page.getByPlaceholder('Seu nome ou apelido')
  if (await namePrompt.isVisible({ timeout: 2000 }).catch(() => false)) {
    await namePrompt.fill('Testador')
    await page.getByRole('button', { name: 'Entrar na Retro' }).click()
  }
  await expect(page.getByText('O que foi bom')).toBeVisible()

  await page.evaluate(async (session_token) => {
    const post = (url: string, body: unknown) =>
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    for (const [column_type, text] of [
      ['good', 'Deploy saiu sem rollback'],
      ['bad', 'CI passou de 18 minutos'],
      ['ideas', 'Testes pesados só no merge'],
    ]) {
      await post('/api/cards', {
        session_token,
        column_type,
        text,
        author: 'Testador',
        author_id: 'p-teste',
      })
    }
    await post('/api/actions', {
      session_token,
      text: 'Quebrar o job da CI',
      author: 'Testador',
      author_id: 'p-teste',
    })
  }, token)

  return token
}

/** Estado do elemento de áudio da trilha, se existir. */
function trilha(page: Page) {
  return page.evaluate(() => {
    const el = [...document.querySelectorAll('audio')].find((a) =>
      (a.getAttribute('src') ?? '').includes('recap-theme')
    )
    return el ? { paused: el.paused, muted: el.muted, volume: el.volume } : null
  })
}

test.describe('Recap - Trilha', () => {
  test('a trilha só toca quando alguém pede, e toca com som de verdade', async ({ page }) => {
    const token = await sessionComBoard(page)
    await page.goto(`/board/${token}/recap`)

    // O player é pesado; sob carga leva um tempo até montar.
    await expect(page.getByRole('button', { name: 'Ativar som' })).toBeVisible({ timeout: 30000 })
    await expect(page.locator('.__remotion-player')).toBeVisible({ timeout: 30000 })

    // Sem pedido, nem elemento de áudio existe: autoplay com som é bloqueado por
    // todo navegador, e o vídeo precisa começar de qualquer jeito.
    await page.waitForTimeout(2000)
    expect(await trilha(page)).toBeNull()

    // Ligar o som remonta o player dentro do clique — é isso que faz o navegador
    // liberar o áudio. Tocar mudo e desmutar depois não funciona: o player troca
    // a faixa por um placeholder silencioso e não volta atrás.
    await page.getByRole('button', { name: 'Ativar som' }).click()

    await expect
      .poll(async () => {
        const t = await trilha(page)
        return t !== null && !t.paused && !t.muted && t.volume > 0
      }, { timeout: 30000 })
      .toBe(true)

    await page.getByRole('button', { name: 'Silenciar' }).click()
    await expect.poll(async () => await trilha(page), { timeout: 15000 }).toBeNull()
  })
})
