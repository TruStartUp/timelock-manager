import Head from 'next/head'
import '../styles/globals.css'
import '@rainbow-me/rainbowkit/styles.css'
import type { AppProps } from 'next/app'
import { Inter } from 'next/font/google'
import dynamic from 'next/dynamic'

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
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined"
          rel="stylesheet"
        />
      </Head>
      <Providers>
        <Component {...pageProps} />
      </Providers>
    </div>
  )
}

export default MyApp
