import type { ReactNode, SVGProps } from 'react'
import type { ArtKind, Listing } from './data'

/* Icons: one stroke weight, drawn on a 24 grid. */
function Icon({ children, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {children}
    </svg>
  )
}
export const SearchIcon = () => <Icon><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Icon>
export const ShopIcon = () => <Icon><path d="M4 9h16l-1 11H5L4 9Z" /><path d="M8 9V7a4 4 0 0 1 8 0v2" /></Icon>
export const PlusIcon = () => <Icon strokeWidth={2.6}><path d="M12 5v14M5 12h14" /></Icon>
export const BackIcon = () => <Icon><path d="M15 5l-7 7 7 7" /></Icon>
export const CameraIcon = () => <Icon><path d="M4 8h3l2-3h6l2 3h3v11H4V8Z" /><circle cx="12" cy="13" r="3.5" /></Icon>
export const PinIcon = () => <Icon><path d="M12 21s-6.500-6-6.500-11a6.500 6.500 0 0 1 13 0c0 5-6.500 11-6.500 11Z" /><circle cx="12" cy="10" r="2.500" /></Icon>
export const CalendarIcon = () => <Icon><path d="M5 6h14v14H5V6ZM5 10h14M9 3v4M15 3v4" /></Icon>
export const ProfileIcon = () => <Icon><circle cx="12" cy="8.500" r="3.500" /><path d="M5 20c.8-3.600 3.600-5.500 7-5.500s6.200 1.900 7 5.500" /></Icon>
export const CloseIcon = () => <Icon><path d="M6 6l12 12M18 6 6 18" /></Icon>
export const ChatIcon = () => <Icon><path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7l-5 4v-4H6a2 2 0 0 1-2-2V6Z" /></Icon>
export const SendIcon = () => <Icon><path d="M4 12 20 4l-5 16-3-7-8-1Z" /></Icon>
export const CheckIcon = () => <Icon strokeWidth={2.6}><path d="m5 12 5 5 9-10" /></Icon>
export const HeartIcon = ({ filled }: { filled?: boolean }) => (
  <Icon fill={filled ? 'currentColor' : 'none'}>
    <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.600-7 10-7 10Z" />
  </Icon>
)

const STAR = 'M12 2c.6 5.200 4.800 9.400 10 10-5.200.6-9.400 4.800-10 10-.6-5.200-4.800-9.400-10-10 5.200-.6 9.400-4.800 10-10Z'
export const Sparkle = ({ size = 16, className }: { size?: number; className?: string }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
    <path d={STAR} fill="currentColor" />
  </svg>
)

/* Illustrated stand-ins for outfit photos, used only by sample listings. */
const SHAPES: Record<ArtKind, (fill: string, accent: string) => ReactNode> = {
  top: (f, a) => (
    <>
      <path d="M62 78c10 8 20 12 38 12s28-4 38-12l14 26-12 8v46H60v-46l-12-8 14-26Z" fill={f} />
      <path d="M60 150h80" stroke={a} strokeWidth="6" strokeLinecap="round" />
    </>
  ),
  bottom: (f, a) => (
    <>
      <path d="M66 60h68l22 130h-44l-12-84-12 84H44L66 60Z" fill={f} />
      <path d="M66 62h68" stroke={a} strokeWidth="8" strokeLinecap="round" />
    </>
  ),
  bodysuit: (f, a) => (
    <>
      <path d="M74 50h12c2 16 26 16 28 0h12l6 46c-4 16-4 28 4 54l-24 40H88l-24-40c8-26 8-38 4-54l6-46Z" fill={f} />
      <path d="M72 100h56" stroke={a} strokeWidth="6" strokeLinecap="round" />
    </>
  ),
  bikini: (f, a) => (
    <>
      <path d="M100 70 68 112h30l2-42Zm0 0 32 42h-30l-2-42Z" fill={f} />
      <path d="M60 148h80l-28 38H88l-28-38Z" fill={f} />
      <path d="M68 112 52 96m80 16 16-16M100 70V52" stroke={a} strokeWidth="4" strokeLinecap="round" />
    </>
  ),
  set: (f, a) => (
    <>
      <path d="M68 56c8 8 18 12 32 12s24-4 32-12l10 18-8 6v26H66V80l-8-6 10-18Z" fill={f} />
      <path d="M68 126h64l18 60H50l18-60Z" fill={f} />
      <path d="M68 128h64" stroke={a} strokeWidth="6" strokeLinecap="round" />
    </>
  ),
  accessory: (f, a) => (
    <>
      <path d="M58 60h32l6 120c-12 8-32 8-44 0l6-120Zm52 0h32l6 120c-12 8-32 8-44 0l6-120Z" fill={f} />
      <path d="M58 64h32m20 0h32" stroke={a} strokeWidth="8" strokeLinecap="round" />
    </>
  ),
}

export function ListingImage({ listing }: { listing: Listing }) {
  if (listing.photo) return <img className="photo" src={listing.photo} alt={listing.title} />
  const art = listing.art ?? { kind: 'set' as ArtKind, bg: '#FFE1EF', fill: '#FF7DB8', accent: '#FFFFFF' }
  return (
    <svg className="photo" viewBox="0 0 200 240" role="img" aria-label={`Illustration of ${listing.title}`}>
      <rect width="200" height="240" fill={art.bg} />
      <g fill="#FFFFFF" opacity="0.9">
        <path d={STAR} transform="translate(22 62) scale(0.7)" />
        <path d={STAR} transform="translate(164 78) scale(0.5)" />
        <path d={STAR} transform="translate(150 196) scale(1)" />
        <path d={STAR} transform="translate(24 158) scale(0.5)" />
      </g>
      {SHAPES[art.kind](art.fill, art.accent)}
    </svg>
  )
}
