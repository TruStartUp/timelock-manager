import Head from 'next/head'
import '../styles/globals.css'
import '@rainbow-me/rainbowkit/styles.css'
import type { AppProps } from 'next/app'
import { Inter } from 'next/font/google'
import dynamic from 'next/dynamic'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

const Providers = dynamic(() => import('../components/common/Providers').then(m => m.Providers), {
  ssr: false,
})

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <div className={inter.className}>
      <Head>
        <title>Rootstock Timelock Manager</title>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </Head>
      <ErrorBoundary>
        <Providers>
          <Component {...pageProps} />
        </Providers>
      </ErrorBoundary>
    </div>
  )
}

export default MyApp
