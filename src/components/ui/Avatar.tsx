type Size = 'sm' | 'md' | 'lg'

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-base',
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
}

export function Avatar({
  src,
  name,
  size = 'md',
}: {
  src?: string | null
  name: string
  size?: Size
}) {
  const sizeClass = SIZE_CLASSES[size]
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`rounded-full object-cover ${sizeClass}`}
      />
    )
  }
  return (
    <div
      className={`bg-brand-100 text-brand-700 rounded-full flex items-center justify-center font-medium ${sizeClass}`}
    >
      {initials(name)}
    </div>
  )
}
