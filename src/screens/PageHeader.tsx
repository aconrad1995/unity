import { BackIcon } from '../art'

export function PageHeader({ title, back = '#/', backLabel = 'Back to shop' }: { title: string; back?: string; backLabel?: string }) {
  return (
    <header className="top top-small">
      <div className="top-inner top-row">
        <a href={back} className="back" aria-label={backLabel}><BackIcon /></a>
        <h1 className="top-title">{title}</h1>
      </div>
      <div className="cloud-edge" aria-hidden="true" />
    </header>
  )
}
