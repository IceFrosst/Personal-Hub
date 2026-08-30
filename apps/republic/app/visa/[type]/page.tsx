import { notFound } from 'next/navigation'
import { VISAS, type VisaType } from '@/lib/content'
import { RequireIdentity } from '@/components/RequireIdentity'
import { TouristStep } from '@/components/visa-steps/TouristStep'
import { ConsultationStep } from '@/components/visa-steps/ConsultationStep'
import { FianceStep } from '@/components/visa-steps/FianceStep'
import { BusinessStep } from '@/components/visa-steps/BusinessStep'
import { SpecialStep } from '@/components/visa-steps/SpecialStep'

export function generateStaticParams() {
  return VISAS.map((visa) => ({ type: visa.slug }))
}

const VALID_SLUGS = new Set(VISAS.map((v) => v.slug))

export default async function VisaSubStepPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params
  if (!VALID_SLUGS.has(type as VisaType)) notFound()

  switch (type as VisaType) {
    case 'tourist':
      return (
        <RequireIdentity>
          <TouristStep />
        </RequireIdentity>
      )
    case 'consultation':
      return (
        <RequireIdentity>
          <ConsultationStep />
        </RequireIdentity>
      )
    case 'fiance':
      return (
        <RequireIdentity>
          <FianceStep />
        </RequireIdentity>
      )
    case 'business':
      return (
        <RequireIdentity>
          <BusinessStep />
        </RequireIdentity>
      )
    case 'special':
      return (
        <RequireIdentity>
          <SpecialStep />
        </RequireIdentity>
      )
    default:
      notFound()
  }
}
