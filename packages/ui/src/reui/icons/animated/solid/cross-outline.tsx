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
          d="M18.103 2.819L12 8.922L5.897 2.819C5.693 2.615 5.416 2.5 5.128 2.5C4.839 2.5 4.562 2.615 4.358 2.819L2.819 4.358C2.615 4.562 2.5 4.839 2.5 5.128C2.5 5.416 2.615 5.693 2.819 5.897L8.922 12L2.819 18.103C2.615 18.307 2.5 18.584 2.5 18.873C2.5 19.161 2.615 19.438 2.819 19.642L4.358 21.181C4.562 21.385 4.839 21.5 5.128 21.5C5.416 21.5 5.693 21.385 5.897 21.181L12 15.078L18.103 21.181C18.307 21.385 18.584 21.5 18.873 21.5C19.161 21.5 19.438 21.385 19.642 21.181L21.181 19.642C21.385 19.438 21.5 19.161 21.5 18.873C21.5 18.584 21.385 18.307 21.181 18.103L15.078 12L21.181 5.897C21.385 5.693 21.5 5.416 21.5 5.128C21.5 4.839 21.385 4.562 21.181 4.358L19.642 2.819C19.438 2.615 19.161 2.5 18.873 2.5C18.584 2.5 18.307 2.615 18.103 2.819Z"
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