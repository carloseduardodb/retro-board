import { test, expect, Page } from '@playwright/test'

async function enterBoard(page: Page, name: string, token?: string): Promise<string> {
  if (token) {
    await page.goto(`/board/${token}`)
  } else {
    await page.goto('/')
    await page.getByRole('button', { name: 'Criar Sessão' }).click()
    await page.waitForURL(/\/board\/[A-Z0-9]{6}/)
  }

  const namePrompt = page.getByPlaceholder('Seu nome ou apelido')
  if (await namePrompt.isVisible({ timeout: 1000 }).catch(() => false)) {
    await namePrompt.fill(name)
    await page.getByRole('button', { name: 'Entrar na Retro' }).click()
  }

  await expect(page.getByText('O que foi bom')).toBeVisible()
  return page.url().split('/board/')[1]
}

async function sendKudo(page: Page, to: string, message: string, anonymous = false) {
  await page.getByRole('button', { name: /Mural de Kudos/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Mural de Kudos' })
  await dialog.getByLabel('Para quem').fill(to)
  await dialog.getByLabel('Mensagem do kudo').fill(message)
  if (anonymous) await dialog.getByText('Enviar anonimamente').click()
  await dialog.getByRole('button', { name: 'Enviar kudo' }).click()
  await expect(dialog.getByText(message)).toBeVisible({ timeout: 10000 })
  return dialog
}

test.describe('Mural de Kudos', () => {
  test('envia, curte e apaga um kudo', async ({ page }) => {
    await enterBoard(page, 'Ana')
    const dialog = await sendKudo(page, 'Bruno', 'Salvou o deploy de sexta')

    const kudo = dialog.locator('article', { hasText: 'Salvou o deploy de sexta' })
    await expect(kudo.getByText('Para Bruno')).toBeVisible()
    await expect(kudo.getByText('— Ana (você)')).toBeVisible()

    await kudo.getByRole('button', { name: 'Curtir kudo' }).click()
    await expect(kudo.getByRole('button', { name: 'Descurtir kudo' })).toContainText('1')

    await kudo.getByRole('button', { name: 'Apagar kudo' }).click()
    await expect(dialog.getByText('Salvou o deploy de sexta')).toHaveCount(0, { timeout: 10000 })
  })

  test('kudo anônimo não mostra o autor e persiste após recarregar', async ({ page }) => {
    await enterBoard(page, 'Ana')
    await sendKudo(page, 'Bruno', 'Code review impecável', true)

    await page.reload()
    await page.getByRole('button', { name: /Mural de Kudos/ }).click()
    const kudo = page.getByRole('dialog').locator('article', { hasText: 'Code review impecável' })
    await expect(kudo.getByText('— anônimo (você)')).toBeVisible()
    await expect(kudo.getByText('Ana')).toHaveCount(0)
  })

  test('outra pessoa recebe o kudo em tempo real, destacado e com contador', async ({ browser }) => {
    const ana = await (await browser.newContext()).newPage()
    const bruno = await (await browser.newContext()).newPage()

    const token = await enterBoard(ana, 'Ana')
    await enterBoard(bruno, 'Bruno', token)

    await sendKudo(ana, 'bruno', 'Pareou comigo a tarde toda')

    // Contador de novos no header de quem não abriu o mural
    await expect(bruno.getByRole('button', { name: 'Mural de Kudos (1 novos)' })).toBeVisible({ timeout: 10000 })
    await bruno.getByRole('button', { name: /Mural de Kudos/ }).click()

    const dialog = bruno.getByRole('dialog', { name: 'Mural de Kudos' })
    await expect(dialog.getByText('(você!)')).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Para mim (1)' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Apagar kudo' })).toHaveCount(0)
  })
})
