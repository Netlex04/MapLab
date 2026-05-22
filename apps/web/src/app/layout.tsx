import type { Metadata } from 'next'
import { Rajdhani, Outfit, JetBrains_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import { Providers } from './providers'
import './globals.css'

const rajdhani = Rajdhani({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-rajdhani',
})

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
})

export const metadata: Metadata = {
  title: {
    default: 'MapLab – ECU Tuning Platform',
    template: '%s | MapLab',
  },
  description:
    'The open platform for ECU tuning. Version control, community, and AI assistance for your tune files.',
  keywords: ['ECU tuning', 'chiptuning', 'map editor', 'ecu maps'],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body className={`${rajdhani.variable} ${outfit.variable} ${jetbrainsMono.variable}`}>
        <Providers>
          {children}
          <Toaster richColors position="bottom-right" theme="dark" />
        </Providers>
      </body>
    </html>
  )
}
