export interface AssignableDoctor {
  id: string
  categoryId: string
  subcategoryId: string | null
  isActive: boolean
}
export interface AssignmentTarget {
  categoryId: string
  subcategoryId: string | null
}

export function resolveAssignees(
  target: AssignmentTarget,
  doctors: AssignableDoctor[],
): string[] {
  return doctors
    .filter((d) => d.isActive && d.categoryId === target.categoryId)
    .filter((d) => (target.subcategoryId == null ? true : d.subcategoryId === target.subcategoryId))
    .map((d) => d.id)
}
