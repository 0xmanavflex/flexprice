import { createContext, useContext } from 'react'

/**
 * Lets a `Composer` know it is rendering inside a `FormDialog`, whose body
 * already supplies the reference's `p-6`, so the form does not pad twice.
 */
export const FormDialogBodyContext = createContext(false)

export function useInFormDialog(): boolean {
  return useContext(FormDialogBodyContext)
}
