import { createFileRoute } from "@tanstack/react-router"
import { ImageProvider } from "@/components/image-context"
import { ImageJobForm } from "@/components/image-form"
import { ImagePreview } from "@/components/image-preview/image-preview"
import { Header } from "@/components/header"

export const Route = createFileRoute("/")({
  component: HomePage,
})

function HomePage() {
  return (
    <ImageProvider>
      <main className="flex h-dvh w-full flex-col">
        <Header />
        <div className="flex min-h-0 w-full flex-1 flex-row items-stretch gap-4 px-4 py-3">
          <ImageJobForm className="w-1/4" />
          <ImagePreview />
        </div>
      </main>
    </ImageProvider>
  )
}
