import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'sonner'
import { Providers } from './providers'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: {
    default: 'MapLab – ECU Tuning Platform',
    template: '%s | MapLab',
  },
  description: 'The open platform for ECU tuning. Version control, community, and AI assistance for your tune files.',
  keywords: ['ECU tuning', 'chiptuning', 'map editor', 'ecu maps'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body className={inter.variable}>
        <Providers>
          {children}
          <Toaster richColors position="bottom-right" theme="dark" />
        </Providers>
      </body>
    </html>
  )
}
