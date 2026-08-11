/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // O renderer carrega o compositor por plataforma (`require('@remotion/compositor-<os>-<arch>')`)
  // em tempo de execução. Empacotá-lo faria o build tentar resolver as variantes
  // de darwin e arm64, que não estão instaladas, e falhar.
  serverExternalPackages: ['@remotion/renderer'],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
