import { createContext, useContext, useState } from "react"

type ImageContextType = {
  image: File | null
  processedImage: File | null
  setImage: (image: File | null) => void
  setProcessedImage: (image: File | null) => void
  showComparison: boolean
  setShowComparison: (show: boolean) => void
}

const imageContext = createContext<ImageContextType>({
  image: null,
  processedImage: null,
  setImage: () => {},
  setProcessedImage: () => {},
  showComparison: false,
  setShowComparison: () => {},
})

export function ImageProvider({ children }: { children: React.ReactNode }) {
  const [image, setImage] = useState<File | null>(null)
  const [processedImage, setProcessedImage] = useState<File | null>(null)
  const [showComparison, setShowComparison] = useState(false)
  return (
    <imageContext.Provider value={{ image, processedImage, setImage, setProcessedImage, showComparison, setShowComparison }}>
      {children}
    </imageContext.Provider>
  )
}

export const useImageContext = () => useContext(imageContext)