// @ts-nocheck — vendored from the ReUI registry (Motion Icons); do not hand-edit.
// Regenerate with: pnpm icons:sync   (see scripts/icons-sync.mjs)
import type { HTMLAttributes } from "react"
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react"
import { cn } from '@ui/lib/cn'
import type { Variants } from "motion/react"
import { motion, useAnimation } from "motion/react"

export interface RingsLinkedIconHandle {
  startAnimation: () => void
  stopAnimation: () => void
}

interface RingsLinkedIconProps extends HTMLAttributes<HTMLDivElement> {}

const COUPLING_CLAMP_VARIANTS: Variants = {
  // coupling-clamp - barbell squeezes inward along its long axis then springs open and settles (volume-preserving scaleX/scaleY about center, ends exactly at rest)
  normal: {
    scaleX: 1,
    scaleY: 1,
    transition: { duration: 0.3, ease: "easeInOut" },
  },
  animate: {
    scaleX: [1, 1.03, 0.85, 1.06, 0.99, 1],
    scaleY: [1, 0.98, 1.08, 0.96, 1.01, 1],
    transition: {
      duration: 0.55,
      times: [0, 0.12, 0.42, 0.66, 0.85, 1],
      ease: "easeInOut",
    },
  },
}

const RingsLinkedIcon = forwardRef<RingsLinkedIconHandle, RingsLinkedIconProps>(
  ({ onMouseEnter, onMouseLeave, className, ...props }, ref) => {
    const controls = useAnimation()
    const isControlledRef = useRef(false)

    useImperativeHandle(ref, () => {
      isControlledRef.current = true
      return {
        startAnimation: () => controls.start("animate"),
        stopAnimation: () => controls.start("normal"),
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
          controls.start("normal")
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
        <motion.svg
          width="100%"
          height="100%"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          overflow="visible"
          variants={COUPLING_CLAMP_VARIANTS}
          animate={controls}
          style={{ transformOrigin: "center" }}
        >
          <path
            d="M 16.407 5.505H 13.958C 13.493 5.505 13.048 5.701 12.719 6.05C 12.391 6.399 12.206 6.872 12.206 7.365V 11.221H 11.716V 7.365C 11.717 6.886 11.542 6.425 11.23 6.079C 10.919 5.732 10.493 5.527 10.042 5.505H 7.593C 5.971 5.505 4.414 6.19 3.267 7.407C 2.119 8.625 1.474 10.277 1.474 12C 1.474 13.723 2.119 15.375 3.267 16.593C 4.414 17.81 5.971 18.495 7.593 18.495H 10.042C 10.507 18.495 10.953 18.299 11.281 17.95C 11.609 17.601 11.795 17.128 11.795 16.635V 12.779H 12.284V 16.635C 12.284 17.114 12.458 17.575 12.77 17.921C 13.081 18.268 13.508 18.473 13.958 18.495H 16.407C 18.029 18.495 19.586 17.81 20.733 16.593C 21.881 15.375 22.526 13.723 22.526 12C 22.526 10.277 21.881 8.625 20.733 7.407C 19.586 6.19 18.029 5.505 16.407 5.505ZM 10.286 16.635C 10.286 16.715 10.257 16.791 10.203 16.848C 10.15 16.905 10.078 16.936 10.002 16.936H 7.593C 6.36 16.936 5.177 16.416 4.305 15.49C 3.433 14.565 2.943 13.309 2.943 12C 2.943 10.691 3.433 9.435 4.305 8.51C 5.177 7.584 6.36 7.064 7.593 7.064H 10.042C 10.117 7.064 10.19 7.095 10.242 7.153C 10.296 7.209 10.326 7.285 10.326 7.365V 11.221H 8.142C 7.947 11.221 7.761 11.303 7.623 11.449C 7.485 11.595 7.408 11.793 7.408 12C 7.408 12.207 7.485 12.405 7.623 12.551C 7.761 12.697 7.947 12.779 8.142 12.779H 10.286V 16.635ZM 16.407 16.936H 13.958C 13.883 16.936 13.81 16.905 13.758 16.848C 13.705 16.791 13.674 16.715 13.674 16.635V 12.779H 15.956C 16.15 12.779 16.338 12.697 16.476 12.551C 16.613 12.405 16.691 12.207 16.691 12C 16.691 11.793 16.613 11.595 16.476 11.449C 16.338 11.303 16.15 11.221 15.956 11.221H 13.714V 7.365C 13.713 7.292 13.737 7.221 13.783 7.166C 13.827 7.111 13.89 7.074 13.958 7.064H 16.407C 17.64 7.064 18.823 7.584 19.695 8.51C 20.568 9.435 21.058 10.691 21.058 12C 21.058 13.309 20.568 14.565 19.695 15.49C 18.823 16.416 17.64 16.936 16.407 16.936Z"
            fill="currentColor"
          />
        </motion.svg>
      </div>
    )
  }
)

RingsLinkedIcon.displayName = "RingsLinkedIcon"

export { RingsLinkedIcon }
export default RingsLinkedIcon