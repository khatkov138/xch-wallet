import { notFound } from 'next/navigation'
import { isSupportedLanguage } from '@/config/i18n'
import ExplorerStatus from './ExplorerStatus'

interface NodesStatusPageProps {
  params: Promise<{ lang: string }>
}

export const instant = false

export default async function NodesStatusPage({ params }: NodesStatusPageProps) {
  const { lang } = await params

  if (!isSupportedLanguage(lang)) {
    notFound()
  }

  return <ExplorerStatus />
}
