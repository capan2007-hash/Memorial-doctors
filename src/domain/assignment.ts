export interface DoctorScope {
  categoryId: string
  subcategoryId: string | null
}
export interface ScopedDoctor {
  id: string
  isActive: boolean
  scopes: DoctorScope[]
}
export interface AssignmentTarget {
  categoryId: string
  subcategoryId: string | null
}

function scopeMatches(scope: DoctorScope, target: AssignmentTarget): boolean {
  if (scope.categoryId !== target.categoryId) return false
  return target.subcategoryId == null
    ? scope.subcategoryId == null
    : scope.subcategoryId === target.subcategoryId
}

export function resolveAssignees(target: AssignmentTarget, doctors: ScopedDoctor[]): string[] {
  return doctors
    .filter((d) => d.isActive && d.scopes.some((s) => scopeMatches(s, target)))
    .map((d) => d.id)
}
