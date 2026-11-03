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

async function openDrafts(page: Page) {
  await page.getByRole('button', { name: /Caixinha da sprint/ }).click()
  return page.getByRole('dialog', { name: 'Caixinha da sprint' })
}

async function addDraft(page: Page, column: string, text: string) {
  const dialog = page.getByRole('dialog', { name: 'Caixinha da sprint' })
  await dialog.getByRole('radio', { name: column }).click()
  await dialog.getByLabel('Anotação').fill(text)
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(dialog.locator('[data-draft-id]', { hasText: text })).toBeVisible({ timeout: 10000 })
}

test.describe('Caixinha da sprint', () => {
  test('guarda, edita e apaga anotações; elas persistem após recarregar', async ({ page }) => {
    await enterBoard(page, 'Ana')
    let dialog = await openDrafts(page)

    await addDraft(page, 'O que foi bom', 'Deploy sem dor')
    await addDraft(page, 'Ações', 'Documentar o runbook')

    const draft = dialog.locator('[data-draft-id]', { hasText: 'Deploy sem dor' })
    await draft.getByRole('button', { name: 'Editar anotação' }).click()
    await draft.locator('textarea').fill('Deploy sem dor nenhuma')
    await draft.getByRole('button', { name: 'Salvar edição' }).click()
    await expect(dialog.getByText('Deploy sem dor nenhuma')).toBeVisible({ timeout: 10000 })

    await page.reload()
    dialog = await openDrafts(page)
    await expect(dialog.getByText('Deploy sem dor nenhuma')).toBeVisible({ timeout: 10000 })
    await expect(dialog.getByText('Documentar o runbook')).toBeVisible()

    await dialog.locator('[data-draft-id]', { hasText: 'Documentar o runbook' })
      .getByRole('button', { name: 'Apagar anotação' }).click()
    await expect(dialog.getByText('Documentar o runbook')).toHaveCount(0, { timeout: 10000 })
  })

  test('os outros só veem a contagem, e jogar no board leva tudo para as colunas', async ({ browser }) => {
    const ana = await (await browser.newContext()).newPage()
    const bruno = await (await browser.newContext()).newPage()

    const token = await enterBoard(ana, 'Ana')
    await openDrafts(ana)
    await addDraft(ana, 'O que pode melhorar', 'Reunião longa demais')
    await addDraft(ana, 'Ações', 'Timebox nas dailies')

    await enterBoard(bruno, 'Bruno', token)
    await expect(bruno.getByRole('button', { name: 'Caixinha da sprint (2 anotações)' })).toBeVisible({ timeout: 10000 })
    const dialog = await openDrafts(bruno)
    await expect(dialog.getByText('Na caixinha do time: 1 a melhorar · 1 ação')).toBeVisible()
    await expect(dialog.getByText('Reunião longa demais')).toHaveCount(0)

    bruno.once('dialog', d => d.accept())
    await dialog.getByRole('button', { name: 'Jogar no board (2)' }).click()

    for (const page of [ana, bruno]) {
      await expect(page.getByTestId('column-bad').getByText('Reunião longa demais')).toBeVisible({ timeout: 10000 })
      await expect(page.getByText('Timebox nas dailies')).toBeVisible({ timeout: 10000 })
    }
    // A lista aberta da Ana esvazia quando a caixinha é jogada
    await expect(ana.getByRole('dialog').getByText('Você ainda não anotou nada nesta sprint.')).toBeVisible({ timeout: 10000 })
  })
})
