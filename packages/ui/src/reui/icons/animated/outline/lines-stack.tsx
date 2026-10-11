// @ts-nocheck — vendored from the ReUI registry (Motion Icons); do not hand-edit.
// Regenerate with: pnpm icons:sync   (see scripts/icons-sync.mjs)
import type { HTMLAttributes } from "react"
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react"
import { cn } from '@ui/lib/cn'
import type { Variants } from "motion/react"
import { motion, useAnimation } from "motion/react"

export interface LinesStackIconHandle {
  startAnimation: () => void
  stopAnimation: () => void
}

interface LinesStackIconProps extends HTMLAttributes<HTMLDivElement> {}

const BAR1_VARIANTS: Variants = {
  normal: { x: 0 },
  animate: {
    x: [0, -3, 3, 0, 0, 0],
    transition: { times: [0, 0.15, 0.3, 0.5, 0.7, 1], duration: 0.7 },
  },
}

const BAR2_VARIANTS: Variants = {
  normal: { x: 0 },
  animate: {
    x: [0, 0, -3, 3, 0, 0],
    transition: { times: [0, 0.15, 0.3, 0.5, 0.7, 1], duration: 0.7 },
  },
}

const BAR3_VARIANTS: Variants = {
  normal: { x: 0 },
  animate: {
    x: [0, 0, 0, -3, 3, 0],
    transition: { times: [0, 0.15, 0.3, 0.5, 0.7, 1], duration: 0.7 },
  },
}

const LinesStackIcon = forwardRef<LinesStackIconHandle, LinesStackIconProps>(
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
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          overflow="visible"
        >
          <motion.path
            d="M20.541 7.842H2.959C2.506 7.842 2.071 7.662 1.751 7.341C1.43 7.021 1.25 6.586 1.25 6.133V4.179C1.25 3.726 1.43 3.291 1.751 2.971C2.071 2.65 2.506 2.47 2.959 2.47H20.541C20.993 2.473 21.427 2.653 21.747 2.973C22.067 3.293 22.247 3.727 22.25 4.179V6.133C22.25 6.586 22.07 7.021 21.749 7.341C21.429 7.662 20.994 7.842 20.541 7.842ZM2.959 3.935C2.895 3.935 2.832 3.961 2.787 4.007C2.741 4.052 2.715 4.115 2.715 4.179V6.133C2.715 6.198 2.741 6.26 2.787 6.305C2.832 6.351 2.895 6.377 2.959 6.377H20.541C20.606 6.377 20.668 6.351 20.713 6.305C20.759 6.26 20.785 6.198 20.785 6.133V4.179C20.785 4.115 20.759 4.052 20.713 4.007C20.668 3.961 20.606 3.935 20.541 3.935H2.959Z"
            fill="currentColor"
            variants={BAR1_VARIANTS}
            initial="normal"
            animate={controls}
          />
          <motion.path
            d="M20.541 14.679H2.959C2.735 14.679 2.513 14.635 2.305 14.549C2.098 14.463 1.909 14.337 1.751 14.179C1.592 14.02 1.466 13.832 1.38 13.624C1.294 13.417 1.25 13.194 1.25 12.97V11.017C1.25 10.563 1.43 10.128 1.751 9.808C2.071 9.487 2.506 9.307 2.959 9.307H20.541C20.993 9.31 21.427 9.491 21.747 9.811C22.067 10.131 22.247 10.564 22.25 11.017V12.97C22.25 13.194 22.206 13.417 22.12 13.624C22.034 13.832 21.908 14.02 21.749 14.179C21.591 14.337 21.402 14.463 21.195 14.549C20.987 14.635 20.765 14.679 20.541 14.679ZM2.959 10.772C2.895 10.772 2.832 10.798 2.787 10.844C2.741 10.89 2.715 10.952 2.715 11.017V12.97C2.715 13.035 2.741 13.097 2.787 13.143C2.832 13.188 2.895 13.214 2.959 13.214H20.541C20.606 13.214 20.668 13.188 20.713 13.143C20.759 13.097 20.785 13.035 20.785 12.97V11.017C20.785 10.952 20.759 10.89 20.713 10.844C20.668 10.798 20.606 10.772 20.541 10.772H2.959Z"
            fill="currentColor"
            variants={BAR2_VARIANTS}
            initial="normal"
            animate={controls}
          />
          <motion.path
            d="M20.541 21.517H2.959C2.506 21.517 2.071 21.336 1.751 21.016C1.43 20.695 1.25 20.261 1.25 19.807V17.854C1.25 17.4 1.43 16.966 1.751 16.645C2.071 16.325 2.506 16.144 2.959 16.144H20.541C20.993 16.147 21.427 16.328 21.747 16.648C22.067 16.968 22.247 17.401 22.25 17.854V19.807C22.25 20.261 22.07 20.695 21.749 21.016C21.429 21.336 20.994 21.517 20.541 21.517ZM2.959 17.61C2.895 17.61 2.832 17.635 2.787 17.681C2.741 17.727 2.715 17.789 2.715 17.854V19.807C2.715 19.872 2.741 19.934 2.787 19.98C2.832 20.026 2.895 20.051 2.959 20.051H20.541C20.606 20.051 20.668 20.026 20.713 19.98C20.759 19.934 20.785 19.872 20.785 19.807V17.854C20.785 17.789 20.759 17.727 20.713 17.681C20.668 17.635 20.606 17.61 20.541 17.61H2.959Z"
            fill="currentColor"
            variants={BAR3_VARIANTS}
            initial="normal"
            animate={controls}
          />
        </svg>
      </div>
    )
  }
)

LinesStackIcon.displayName = "LinesStackIcon"

export { LinesStackIcon }
export default LinesStackIcon