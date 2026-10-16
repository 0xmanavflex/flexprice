// @ts-nocheck — vendored from the ReUI registry (Motion Icons); do not hand-edit.
// Regenerate with: pnpm icons:sync   (see scripts/icons-sync.mjs)
"use client"

import type { HTMLAttributes } from "react"
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react"
import { cn } from '@ui/lib/cn'
import type { Variants } from "motion/react"
import { motion, useAnimation } from "motion/react"

export interface BoltIconHandle {
  startAnimation: () => void
  stopAnimation: () => void
}

interface BoltIconProps extends HTMLAttributes<HTMLDivElement> {}

const BOLT_VARIANTS: Variants = {
  normal: {
    rotate: 0,
    scale: 1,
    y: 0,
    opacity: 1,
    transition: { duration: 0.3, ease: "easeOut" },
  },
  animate: {
    scale: [1, 0.8, 1.18, 0.94, 1.04, 1],
    rotate: [0, 7, -8, 5, -2, 0],
    y: [0, -1.6, 1.2, -0.4, 0, 0],
    opacity: [1, 0.6, 1, 1, 1, 1],
    transition: {
      duration: 0.7,
      ease: "easeInOut",
      times: [0, 0.22, 0.45, 0.65, 0.85, 1],
    },
  },
}

const BoltIcon = forwardRef<BoltIconHandle, BoltIconProps>(
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
            d="M 20.788 10.137C 20.638 9.87 20.418 9.648 20.152 9.494C 19.887 9.341 19.585 9.262 19.278 9.266H 12.747V 3.626C 12.746 3.249 12.621 2.885 12.391 2.587C 12.161 2.29 11.841 2.076 11.478 1.979C 11.114 1.882 10.73 1.908 10.382 2.052C 10.035 2.196 9.745 2.45 9.557 2.776L 3.196 12.157C 3.046 12.423 2.968 12.724 2.97 13.028C 2.972 13.334 3.054 13.634 3.207 13.897C 3.361 14.162 3.582 14.381 3.846 14.533C 4.11 14.686 4.41 14.766 4.716 14.767H 11.247V 20.408C 11.253 20.778 11.38 21.137 11.61 21.428C 11.84 21.719 12.159 21.926 12.517 22.018C 12.664 22.058 12.815 22.078 12.967 22.078C 13.267 22.078 13.561 21.998 13.819 21.847C 14.077 21.696 14.291 21.479 14.438 21.218L 20.798 11.837C 20.944 11.577 21.02 11.283 21.018 10.985C 21.017 10.688 20.937 10.395 20.788 10.137ZM 4.716 13.267C 4.672 13.267 4.629 13.256 4.591 13.235C 4.552 13.214 4.52 13.184 4.496 13.147C 4.476 13.108 4.465 13.065 4.465 13.022C 4.465 12.978 4.476 12.935 4.496 12.897L 10.857 3.525C 10.87 3.498 10.89 3.473 10.914 3.454C 10.938 3.435 10.967 3.421 10.997 3.415H 11.057C 11.104 3.423 11.146 3.447 11.176 3.484C 11.205 3.522 11.22 3.568 11.217 3.616V 13.257L 4.716 13.267ZM 19.498 11.136L 13.138 20.508C 13.114 20.547 13.079 20.577 13.037 20.595C 12.995 20.612 12.949 20.614 12.905 20.604C 12.861 20.592 12.822 20.567 12.794 20.532C 12.765 20.497 12.749 20.453 12.747 20.408V 10.766H 19.278C 19.322 10.766 19.365 10.777 19.403 10.799C 19.442 10.819 19.475 10.85 19.498 10.886C 19.519 10.925 19.529 10.968 19.529 11.012C 19.529 11.055 19.519 11.098 19.498 11.136Z"
            fill="currentColor"
            variants={BOLT_VARIANTS}
            initial="normal"
            animate={controls}
          />
        </svg>
      </div>
    )
  }
)

BoltIcon.displayName = "BoltIcon"

export { BoltIcon }
export default BoltIcon