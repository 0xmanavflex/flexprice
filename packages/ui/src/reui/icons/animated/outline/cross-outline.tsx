// @ts-nocheck — vendored from the ReUI registry (Motion Icons); do not hand-edit.
// Regenerate with: pnpm icons:sync   (see scripts/icons-sync.mjs)
import type { HTMLAttributes } from "react"
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react"
import { cn } from '@ui/lib/cn'
import type { Variants } from "motion/react"
import { motion, useAnimation } from "motion/react"

export interface CrossOutlineIconHandle {
  startAnimation: () => void
  stopAnimation: () => void
}

interface CrossOutlineIconProps extends HTMLAttributes<HTMLDivElement> {}

const PATH_VARIANTS: Variants = {
  normal: {
    rotate: 0,
    transition: { duration: 0.26, ease: "easeOut" },
  },
  animate: {
    rotate: [0, 90, 0],
    transition: {
      duration: 0.46,
      ease: "easeInOut",
      times: [0, 0.58, 1],
    },
  },
}

const CrossOutlineIcon = forwardRef<
  CrossOutlineIconHandle,
  CrossOutlineIconProps
>(({ onMouseEnter, onMouseLeave, className, ...props }, ref) => {
  const controls = useAnimation()
  const isControlledRef = useRef(false)

  useImperativeHandle(ref, () => {
    isControlledRef.current = true
    return {
      startAnimation: () => controls.start("animate"),
      // Each hover runs one complete cycle and returns to rest on its own.
      stopAnimation: () => {},
    }
  })

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isControlledRef.current) {
        onMouseEnter?.(e)
      } else {
        controls.start("animate")
      }
    },
    [controls, onMouseEnter]
  )

  const handleMouseLeave = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isControlledRef.current) {
        onMouseLeave?.(e)
      } else {
        // no reset on leave; the in-flight cycle completes on its own
      }
    },
    [controls, onMouseLeave]
  )

  return (
    <div
      className={cn(className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        overflow="visible"
      >
        <motion.path
          d="M21.016 17.127L15.889 12L21.016 6.874C21.341 6.544 21.524 6.099 21.524 5.636C21.524 5.173 21.341 4.728 21.016 4.399L19.601 2.984C19.273 2.656 18.828 2.472 18.364 2.472C17.9 2.472 17.455 2.656 17.126 2.984L12 8.111L6.873 2.984C6.545 2.656 6.1 2.472 5.636 2.472C5.172 2.472 4.727 2.656 4.398 2.984L2.984 4.399C2.822 4.561 2.693 4.754 2.605 4.966C2.517 5.179 2.472 5.406 2.472 5.636C2.472 5.866 2.517 6.094 2.605 6.306C2.693 6.518 2.822 6.711 2.984 6.874L8.111 12L2.984 17.127C2.656 17.455 2.472 17.9 2.472 18.364C2.472 18.828 2.656 19.273 2.984 19.602L4.398 21.016C4.561 21.178 4.754 21.307 4.966 21.395C5.179 21.483 5.406 21.528 5.636 21.528C5.866 21.528 6.093 21.483 6.306 21.395C6.518 21.307 6.711 21.178 6.873 21.016L12 15.889L17.126 21.016C17.289 21.178 17.482 21.307 17.694 21.395C17.906 21.483 18.134 21.528 18.364 21.528C18.594 21.528 18.821 21.483 19.034 21.395C19.246 21.307 19.439 21.178 19.601 21.016L21.016 19.602C21.341 19.272 21.524 18.827 21.524 18.364C21.524 17.901 21.341 17.456 21.016 17.127ZM18.541 19.955C18.494 20.002 18.43 20.028 18.364 20.028C18.298 20.028 18.234 20.002 18.187 19.955L12 13.768L5.813 19.955C5.766 20.002 5.702 20.028 5.636 20.028C5.57 20.028 5.506 20.002 5.459 19.955L4.045 18.541C3.998 18.494 3.972 18.43 3.972 18.364C3.972 18.298 3.998 18.234 4.045 18.187L10.232 12L4.045 5.813C3.998 5.766 3.972 5.702 3.972 5.636C3.972 5.57 3.998 5.506 4.045 5.459L5.459 4.045C5.506 3.998 5.57 3.972 5.636 3.972C5.702 3.972 5.766 3.998 5.813 4.045L12 10.232L18.187 4.045C18.234 3.998 18.298 3.972 18.364 3.972C18.43 3.972 18.494 3.998 18.541 4.045L19.955 5.459C20.002 5.506 20.028 5.57 20.028 5.636C20.028 5.702 20.002 5.766 19.955 5.813L13.768 12L19.955 18.187C20.002 18.234 20.028 18.298 20.028 18.364C20.028 18.43 20.002 18.494 19.955 18.541L18.541 19.955Z"
          fill="currentColor"
          variants={PATH_VARIANTS}
          animate={controls}
        />
      </svg>
    </div>
  )
})

CrossOutlineIcon.displayName = "CrossOutlineIcon"

export { CrossOutlineIcon }
export default CrossOutlineIcon