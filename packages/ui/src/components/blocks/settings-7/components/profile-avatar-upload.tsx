// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
"use client"

import { useState } from "react"
import { useFileUpload } from "@ui/hooks/use-file-upload"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@ui/components/primitives/avatar"
import { Button } from "@ui/components/primitives/button"
import { UserCircle, XIcon, UploadIcon } from "lucide-react"

interface ProfileAvatarUploadProps {
  defaultAvatar: string
  alt: string
  inputId?: string
}

export function ProfileAvatarUpload({
  defaultAvatar,
  alt,
  inputId,
}: ProfileAvatarUploadProps) {
  const [removedCurrentPhoto, setRemovedCurrentPhoto] = useState(false)
  const [{ files }, { removeFile, openFileDialog, getInputProps }] =
    useFileUpload({
      accept: "image/*",
    })

  const currentFile = files[0] ?? null
  const hasSavedPhoto = Boolean(defaultAvatar) && !removedCurrentPhoto
  const previewUrl =
    currentFile?.preview ?? (hasSavedPhoto ? defaultAvatar : null)
  const hasPhoto = Boolean(previewUrl)

  const handleCancelUpload = () => {
    if (!currentFile) {
      return
    }

    removeFile(currentFile.id)
  }

  const handleRemovePhoto = () => {
    if (currentFile) {
      removeFile(currentFile.id)
    }

    setRemovedCurrentPhoto(true)
  }

  return (
    <div className="flex grow flex-wrap items-center justify-start gap-2">
      {/* Actions */}
      <div className="relative">
        <Avatar className="size-10">
          <AvatarImage src={previewUrl ?? undefined} alt={alt} />
          <AvatarFallback className="text-muted-foreground bg-muted">
            <UserCircle aria-hidden="true" className="size-4 opacity-60" />
          </AvatarFallback>
        </Avatar>

        {currentFile ? (
          <Button
            variant="outline"
            size="icon-xs"
            onClick={handleCancelUpload}
            className="absolute -top-1 -right-1 size-4 rounded-full"
            aria-label={`Cancel ${currentFile.file.name}`}
          >
            <XIcon aria-hidden="true" />
          </Button>
        ) : null}
      </div>

      <div className="relative inline-flex">
        <Button
          variant="outline"
          size="sm"
          onClick={openFileDialog}
          aria-haspopup="dialog"
        >
          <UploadIcon aria-hidden="true" />
          {hasPhoto ? "Change" : "Upload"}
        </Button>
        <input
          {...getInputProps({ id: inputId })}
          className="sr-only"
          aria-label="Upload profile image"
          tabIndex={-1}
        />
      </div>

      {hasPhoto ? (
        <Button variant="outline" size="sm" onClick={handleRemovePhoto}>
          <XIcon aria-hidden="true" />
          Remove
        </Button>
      ) : null}
    </div>
  )
}