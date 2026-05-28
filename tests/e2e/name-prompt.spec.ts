import { test, expect } from '@playwright/test'

test.describe('Prompt de Nome', () => {
  let boardUrl: string

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage()
    await page.goto('/')
    await page.getByRole('button', { name: 'Criar Sessão' }).click()
    await page.waitForURL(/\/board\/[A-Z0-9]{6}/)
    boardUrl = page.url()
    await page.close()
  })

  test('exibe prompt de nome quando localStorage está vazio', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto(boardUrl)
    await page.evaluate(() => {
      localStorage.removeItem('retro_participant_name')
      localStorage.removeItem('retro_participant_id')
    })
    await page.reload()

    await expect(page.getByText('Como você quer ser chamado?')).toBeVisible()
    await expect(page.getByPlaceholder('Seu nome ou apelido')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Entrar na Retro' })).toBeDisabled()
  })

  test('botão habilitado após digitar nome', async ({ page }) => {
    await page.goto(boardUrl)
    await page.evaluate(() => {
      localStorage.removeItem('retro_participant_name')
      localStorage.removeItem('retro_participant_id')
    })
    await page.reload()

    await page.getByPlaceholder('Seu nome ou apelido').fill('João')
    await expect(page.getByRole('button', { name: 'Entrar na Retro' })).toBeEnabled()
  })

  test('limita nome a 20 caracteres', async ({ page }) => {
    await page.goto(boardUrl)
    await page.evaluate(() => {
      localStorage.removeItem('retro_participant_name')
      localStorage.removeItem('retro_participant_id')
    })
    await page.reload()

    const input = page.getByPlaceholder('Seu nome ou apelido')
    await input.fill('A'.repeat(25))
    await expect(input).toHaveValue('A'.repeat(20))
  })

  test('após confirmar nome, mostra o board', async ({ page }) => {
    await page.goto(boardUrl)
    await page.evaluate(() => {
      localStorage.removeItem('retro_participant_name')
      localStorage.removeItem('retro_participant_id')
    })
    await page.reload()

    await page.getByPlaceholder('Seu nome ou apelido').fill('Ana')
    await page.getByRole('button', { name: 'Entrar na Retro' }).click()

    await expect(page.getByText('O que foi bom')).toBeVisible()
    await expect(page.getByText('Ana')).toBeVisible()
  })

  test('nome persiste no localStorage para próximas visitas', async ({ page }) => {
    await page.goto(boardUrl)
    await page.evaluate(() => {
      localStorage.removeItem('retro_participant_name')
      localStorage.removeItem('retro_participant_id')
    })
    await page.reload()

    await page.getByPlaceholder('Seu nome ou apelido').fill('Pedro')
    await page.getByRole('button', { name: 'Entrar na Retro' }).click()
    await expect(page.getByText('O que foi bom')).toBeVisible()

    // Recarregar — não deve pedir nome de novo
    await page.reload()
    await expect(page.getByText('O que foi bom')).toBeVisible()
    await expect(page.getByText('Como você quer ser chamado?')).not.toBeVisible()
  })
})
