import Head from 'next/head'
import '../styles/globals.css'
import '@rainbow-me/rainbowkit/styles.css'
import type { AppProps } from 'next/app'
import { Inter } from 'next/font/google'
import dynamic from 'next/dynamic'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { ThemeProvider } from '@/components/common/ThemeProvider'

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
        <ThemeProvider>
          <Providers>
            <Component {...pageProps} />
          </Providers>
        </ThemeProvider>
      </ErrorBoundary>
    </div>
  )
}

export default MyApp
