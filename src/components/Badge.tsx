export function Badge({ count }: { count: number }) {
  if (count <= 0) return null
  return <span className="ms-2 inline-flex items-center justify-center min-w-5 h-5 px-1 text-xs font-bold text-white bg-red-600 rounded-full">{count}</span>
}
