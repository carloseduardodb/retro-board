import { test, expect, Page } from '@playwright/test'

async function createSessionAndEnter(page: Page, name: string): Promise<string> {
  await page.goto('/')
  await page.getByRole('button', { name: 'Criar Sessão' }).click()
  await page.waitForURL(/\/board\/[A-Z0-9]{6}/)

  const namePrompt = page.getByPlaceholder('Seu nome ou apelido')
  if (await namePrompt.isVisible({ timeout: 3000 }).catch(() => false)) {
    await namePrompt.fill(name)
    await page.getByRole('button', { name: 'Entrar na Retro' }).click()
  }

  await expect(page.getByText('O que foi bom')).toBeVisible()
  return page.url()
}

/** Conta pixels desenhados no canvas de rabiscos. */
async function pixelsDesenhados(page: Page): Promise<number> {
  return page.locator('canvas').evaluate((el) => {
    const canvas = el as HTMLCanvasElement
    const ctx = canvas.getContext('2d')!
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
    let n = 0
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) n++
    return n
  })
}

async function rabiscar(page: Page) {
  const box = (await page.locator('canvas').boundingBox())!
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2

  await page.mouse.move(cx - 200, cy)
  await page.mouse.down()
  for (let i = 0; i <= 30; i++) {
    await page.mouse.move(cx - 200 + i * 12, cy + Math.sin(i / 3) * 40)
    await page.waitForTimeout(8)
  }
  await page.mouse.up()
}

test.describe('Board - Modo desenho', () => {
  test('entra e sai do modo desenho', async ({ page }) => {
    await createSessionAndEnter(page, 'Testador')

    await expect(page.getByRole('button', { name: 'Limpar' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Modo desenho' }).click()
    await expect(page.getByRole('button', { name: 'Limpar' })).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Limpar' })).toHaveCount(0)
  })

  test('rabisco aparece, é limpo e some sozinho', async ({ page }) => {
    await createSessionAndEnter(page, 'Testador')
    await page.getByRole('button', { name: 'Modo desenho' }).click()

    await rabiscar(page)
    await page.waitForTimeout(300)
    expect(await pixelsDesenhados(page)).toBeGreaterThan(0)

    await page.getByRole('button', { name: 'Limpar' }).click()
    await page.waitForTimeout(300)
    expect(await pixelsDesenhados(page)).toBe(0)

    // Sem limpar, o traço desaparece sozinho após hold + fade
    await rabiscar(page)
    await page.waitForTimeout(300)
    expect(await pixelsDesenhados(page)).toBeGreaterThan(0)

    await page.waitForTimeout(6500)
    expect(await pixelsDesenhados(page)).toBe(0)
  })

  test('outro participante vê o rabisco sem entrar no modo desenho', async ({ browser }) => {
    const ctxA = await browser.newContext()
    const A = await ctxA.newPage()
    const url = await createSessionAndEnter(A, 'Ana')

    const ctxB = await browser.newContext()
    await ctxB.addInitScript(() => localStorage.setItem('retro_participant_name', 'Bruno'))
    const B = await ctxB.newPage()
    await B.goto(url)
    await expect(B.getByText('O que foi bom')).toBeVisible()
    await B.waitForTimeout(1500)

    await A.getByRole('button', { name: 'Modo desenho' }).click()
    await rabiscar(A)
    await B.waitForTimeout(800)

    expect(await pixelsDesenhados(B)).toBeGreaterThan(0)
    // B continua fora do modo desenho
    await expect(B.getByRole('button', { name: 'Limpar' })).toHaveCount(0)

    await ctxA.close()
    await ctxB.close()
  })
})
