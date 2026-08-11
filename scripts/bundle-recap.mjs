/**
 * Empacota a composição do recap para o renderizador.
 *
 * Roda no build (ver Dockerfile), não a cada download: o bundle é webpack, leva
 * dezenas de segundos e não muda entre uma sessão e outra. Em produção a imagem
 * carrega só a pasta pronta — o servidor de runtime nunca precisa empacotar.
 */

import path from 'node:path'
import { bundle } from '@remotion/bundler'

const outDir = path.join(process.cwd(), '.remotion-bundle')

const serveUrl = await bundle({
  entryPoint: path.join(process.cwd(), 'remotion', 'Root.tsx'),
  publicDir: path.join(process.cwd(), 'public'),
  outDir,
  onProgress: (percent) => {
    if (percent % 25 === 0) process.stdout.write(`bundle ${percent}%\n`)
  },
})

console.log(`bundle do recap pronto em ${serveUrl}`)
