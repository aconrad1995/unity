import { useId, type SVGProps } from 'react'
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
export const BellIcon = () => <Icon><path d="M6 16V11a6 6 0 0 1 12 0v5l1.500 2h-15L6 16Z" /><path d="M10 20.500a2.200 2.200 0 0 0 4 0" /></Icon>
export const StarIcon = ({ filled }: { filled?: boolean }) => (
  <Icon fill={filled ? 'currentColor' : 'none'}><path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5Z" /></Icon>
)
export const InstagramIcon = () => <Icon><rect x="4" y="4" width="16" height="16" rx="5" /><circle cx="12" cy="12" r="3.6" /><circle cx="17" cy="7" r="0.6" fill="currentColor" /></Icon>
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

/* Illustrated stand-ins for outfit photos. Sample listings and outfits listed without a photo use these.
   Each one gets a shaded garment, a glitter or stripe finish and a soft floor shadow. */
const GARMENT: Record<ArtKind, { body: string[]; trim: { d: string; w: number }[] }> = {
  top: {
    body: ['M62 78c10 8 20 12 38 12s28-4 38-12l14 26-12 8v46H60v-46l-12-8 14-26Z'],
    trim: [{ d: 'M60 150h80', w: 6 }],
  },
  bottom: {
    body: ['M66 60h68l22 130h-44l-12-84-12 84H44L66 60Z'],
    trim: [{ d: 'M66 62h68', w: 8 }],
  },
  bodysuit: {
    body: ['M74 50h12c2 16 26 16 28 0h12l6 46c-4 16-4 28 4 54l-24 40H88l-24-40c8-26 8-38 4-54l6-46Z'],
    trim: [{ d: 'M72 100h56', w: 6 }],
  },
  bikini: {
    body: ['M100 70 68 112h30l2-42Zm0 0 32 42h-30l-2-42Z', 'M60 148h80l-28 38H88l-28-38Z'],
    trim: [{ d: 'M68 112 52 96m80 16 16-16M100 70V52', w: 4 }],
  },
  set: {
    body: ['M68 56c8 8 18 12 32 12s24-4 32-12l10 18-8 6v26H66V80l-8-6 10-18Z', 'M68 126h64l18 60H50l18-60Z'],
    trim: [{ d: 'M68 128h64', w: 6 }],
  },
  accessory: {
    body: ['M58 60h32l6 120c-12 8-32 8-44 0l6-120Zm52 0h32l6 120c-12 8-32 8-44 0l6-120Z'],
    trim: [{ d: 'M58 64h32m20 0h32', w: 8 }],
  },
}

function mix(hex: string, to: string, t: number): string {
  const n = (h: string, k: number) => parseInt(h.slice(1 + k * 2, 3 + k * 2), 16)
  if (!/^#[0-9a-f]{6}$/i.test(hex) || !/^#[0-9a-f]{6}$/i.test(to)) return hex
  const c = [0, 1, 2].map((k) => Math.round(n(hex, k) + (n(to, k) - n(hex, k)) * t).toString(16).padStart(2, '0'))
  return `#${c.join('')}`
}

const hashOf = (text: string) => [...text].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7)

export function ListingImage({ listing, index = 0 }: { listing: Listing; index?: number }) {
  const uid = useId().replace(/\W/g, '')
  if (listing.photoCount) {
    return <img className="photo" src={`/api/photo/${listing.id}/${Math.min(index, listing.photoCount - 1)}`} alt={`${listing.title}, photo ${index + 1}`} loading="lazy" decoding="async" />
  }
  const art = listing.art ?? { kind: 'set' as ArtKind, bg: '#FFE1EF', fill: '#FF7DB8', accent: '#FFFFFF' }
  const shape = GARMENT[art.kind] ?? GARMENT.set
  const finish = hashOf(listing.id) % 3 // 0 glitter, 1 holographic stripes, 2 sparkles
  const light = mix(art.fill, '#FFFFFF', 0.45)
  const deep = mix(art.fill, '#3B1F5E', 0.22)
  const g = (name: string) => `${name}-${uid}`
  return (
    <svg className="photo" viewBox="0 0 200 240" role="img" aria-label={`Illustration of ${listing.title}`}>
      <defs>
        <linearGradient id={g('cloth')} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset="0.5" stopColor={art.fill} />
          <stop offset="1" stopColor={deep} />
        </linearGradient>
        <linearGradient id={g('sheen')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.6" />
          <stop offset="0.38" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="0.7" stopColor="#FFFFFF" stopOpacity="0.18" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <pattern id={g('finish')} width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(12)">
          {finish === 0 && (
            <g fill="#FFFFFF">
              <circle cx="4" cy="5" r="1.6" opacity="0.9" />
              <circle cx="15" cy="9" r="1.1" opacity="0.8" />
              <circle cx="9" cy="17" r="1.4" opacity="0.85" />
              <circle cx="19" cy="19" r="0.9" opacity="0.7" />
              <path d="M12 2c.3 1.300 1.200 2.200 2.500 2.500-1.300.3-2.200 1.200-2.500 2.500-.3-1.300-1.200-2.200-2.500-2.500 1.300-.3 2.200-1.200 2.500-2.500Z" opacity="0.9" />
            </g>
          )}
          {finish === 1 && (
            <g>
              <rect width="22" height="5" fill="#FFFFFF" opacity="0.35" />
              <rect y="8" width="22" height="3" fill={art.accent} opacity="0.4" />
              <rect y="14" width="22" height="2" fill="#FFFFFF" opacity="0.25" />
            </g>
          )}
          {finish === 2 && (
            <g fill={art.accent}>
              <path d="M6 3c.4 2.200 2 3.800 4.200 4.200-2.200.4-3.800 2-4.200 4.200-.4-2.200-2-3.800-4.200-4.200C4 6.800 5.600 5.200 6 3Z" opacity="0.85" />
              <circle cx="17" cy="15" r="1.800" opacity="0.7" />
            </g>
          )}
        </pattern>
      </defs>

      <rect width="200" height="240" fill={art.bg} />
      <ellipse className="floor" cx="100" cy="214" rx="54" ry="7" />

      <g strokeLinejoin="round" strokeLinecap="round">
        {shape.body.map((d) => (
          <g key={d}>
            <path d={d} fill={`url(#${g('cloth')})`} />
            <path d={d} fill={`url(#${g('finish')})`} opacity="0.85" />
            <path d={d} fill={`url(#${g('sheen')})`} />
            <path d={d} fill="none" stroke={deep} strokeOpacity="0.45" strokeWidth="1.5" />
          </g>
        ))}
        {shape.trim.map((t) => (
          <path key={t.d} d={t.d} fill="none" stroke={art.accent} strokeWidth={t.w} />
        ))}
      </g>
    </svg>
  )
}
