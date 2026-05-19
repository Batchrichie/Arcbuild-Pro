import { useCallback, useState } from 'react'

export default function useModal(initialValue = false) {
  const [open, setOpen] = useState(initialValue)

  const openModal = useCallback(() => setOpen(true), [])
  const closeModal = useCallback(() => setOpen(false), [])
  const toggleModal = useCallback(() => setOpen((current) => !current), [])

  return {
    open,
    openModal,
    closeModal,
    toggleModal,
    setOpen,
  }
}
