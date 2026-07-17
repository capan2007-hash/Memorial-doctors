import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { CategoryRow, SubcategoryRow, OperationTypeRow } from '../../types/db'

export function useCategories() {
  return useQuery({ queryKey: ['categories'], queryFn: async () => {
    const { data, error } = await supabase.from('category').select('*').order('name')
    if (error) throw error
    return data as CategoryRow[]
  }})
}
export function useSubcategories(categoryId?: string) {
  return useQuery({ queryKey: ['subcategories', categoryId], enabled: !!categoryId, queryFn: async () => {
    const { data, error } = await supabase.from('subcategory').select('*').eq('category_id', categoryId!).order('name')
    if (error) throw error
    return data as SubcategoryRow[]
  }})
}
export function useOperationTypes(categoryId?: string, subcategoryId?: string | null) {
  return useQuery({ queryKey: ['ops', categoryId, subcategoryId], enabled: !!categoryId, queryFn: async () => {
    let q = supabase.from('operation_type').select('*').eq('category_id', categoryId!)
    if (subcategoryId) q = q.eq('subcategory_id', subcategoryId)
    const { data, error } = await q.order('name')
    if (error) throw error
    return data as OperationTypeRow[]
  }})
}
