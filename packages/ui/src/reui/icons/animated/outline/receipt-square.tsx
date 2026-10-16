// @ts-nocheck — vendored from the ReUI registry (Motion Icons); do not hand-edit.
// Regenerate with: pnpm icons:sync   (see scripts/icons-sync.mjs)
"use client"

import type { HTMLAttributes } from "react"
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react"
import { cn } from '@ui/lib/cn'
import type { Variants } from "motion/react"
import { motion, useAnimation } from "motion/react"

export interface ReceiptSquareIconHandle {
  startAnimation: () => void
  stopAnimation: () => void
}

interface ReceiptSquareIconProps extends HTMLAttributes<HTMLDivElement> {}

const FRAME_PATH =
  "M 16.576 22.511H 7.375C 5.808 22.496 4.312 21.863 3.209 20.75C 2.107 19.638 1.489 18.135 1.489 16.569V 7.372C 1.502 5.807 2.133 4.311 3.244 3.209C 4.356 2.107 5.859 1.489 7.424 1.489H 16.625C 18.191 1.502 19.687 2.133 20.79 3.243C 21.893 4.355 22.511 5.856 22.511 7.421V 16.618C 22.499 18.184 21.868 19.682 20.757 20.784C 19.644 21.888 18.142 22.508 16.576 22.511ZM 7.375 2.901C 6.787 2.901 6.206 3.017 5.665 3.241C 5.122 3.466 4.63 3.796 4.215 4.211C 3.8 4.626 3.472 5.119 3.248 5.662C 3.024 6.205 2.91 6.786 2.912 7.372V 16.569C 2.912 17.753 3.381 18.89 4.218 19.728C 5.055 20.566 6.19 21.038 7.375 21.041H 16.576C 17.761 21.038 18.896 20.566 19.733 19.728C 20.569 18.89 21.04 17.753 21.04 16.569V 7.372C 21.04 6.188 20.569 5.054 19.732 4.217C 18.895 3.381 17.76 2.911 16.576 2.911L 7.375 2.901Z"

const FLAG_PATH =
  "M 11.975 18.432C 11.578 18.432 11.187 18.326 10.842 18.126C 10.498 17.927 10.212 17.64 10.013 17.295L 9.542 16.471L 9.19 17.06C 9.018 17.347 8.757 17.571 8.445 17.696C 8.135 17.82 7.791 17.84 7.468 17.751C 7.145 17.662 6.86 17.469 6.657 17.202C 6.454 16.935 6.344 16.611 6.345 16.275V 8.176C 6.345 7.463 6.628 6.78 7.132 6.276C 7.636 5.773 8.32 5.49 9.033 5.49H 14.918C 15.632 5.49 16.317 5.772 16.823 6.275C 17.328 6.779 17.614 7.463 17.616 8.176V 16.275C 17.616 16.612 17.504 16.938 17.3 17.205C 17.094 17.472 16.807 17.664 16.482 17.751C 16.157 17.837 15.812 17.816 15.501 17.687C 15.19 17.558 14.93 17.331 14.762 17.04L 14.428 16.471L 13.957 17.295C 13.755 17.642 13.467 17.929 13.119 18.129C 12.771 18.329 12.376 18.433 11.975 18.432ZM 9.523 14.913C 9.769 14.913 10.011 14.978 10.223 15.102C 10.434 15.226 10.61 15.404 10.73 15.618L 11.259 16.54C 11.331 16.662 11.434 16.762 11.557 16.833C 11.68 16.903 11.819 16.94 11.961 16.94C 12.102 16.94 12.242 16.903 12.365 16.833C 12.487 16.762 12.591 16.662 12.662 16.54L 13.182 15.628C 13.303 15.409 13.481 15.228 13.697 15.102C 13.913 14.977 14.159 14.911 14.408 14.913C 14.654 14.91 14.894 14.974 15.107 15.096C 15.319 15.218 15.494 15.395 15.615 15.608L 16.008 16.275H 16.125V 8.176C 16.122 7.856 15.995 7.55 15.77 7.323C 15.544 7.095 15.238 6.965 14.918 6.96H 9.033C 8.872 6.958 8.712 6.989 8.563 7.049C 8.413 7.11 8.277 7.199 8.162 7.312C 8.048 7.425 7.956 7.56 7.894 7.708C 7.831 7.856 7.797 8.015 7.797 8.176V 16.275H 7.904L 8.316 15.589C 8.441 15.38 8.617 15.208 8.829 15.088C 9.041 14.97 9.28 14.909 9.523 14.913Z"

const RECEIPT_VARIANTS: Variants = {
  normal: {
    scaleX: 1,
    scaleY: 1,
    x: 0,
    y: 0,
    rotate: 0,
    skewX: 0,
    transition: { duration: 0.3, ease: "easeOut" },
  },
  animate: {
    scaleX: [1, 1.025, 0.99, 1.012, 1.004, 1],
    scaleY: [1, 0.99, 1.012, 0.996, 1.002, 1],
    x: [0, -0.55, 0.46, -0.24, 0.1, 0],
    y: [0, 0.18, -0.12, 0.08, -0.03, 0],
    rotate: [0, -3.2, 2.4, -1.2, 0.45, 0],
    skewX: [0, -2.2, 1.6, -0.7, 0.25, 0],
    transition: {
      duration: 0.64,
      ease: [0.16, 1, 0.3, 1],
      times: [0, 0.18, 0.38, 0.58, 0.78, 1],
    },
  },
}

const ReceiptSquareIcon = forwardRef<
  ReceiptSquareIconHandle,
  ReceiptSquareIconProps
>(({ onMouseEnter, onMouseLeave, className, ...props }, ref) => {
  const controls = useAnimation()
  const isControlledRef = useRef(false)

  useImperativeHandle(ref, () => {
    isControlledRef.current = true
    return {
      startAnimation: () => controls.start("animate"),
      // Each hover fires ONE complete cycle that runs start-to-finish and
      // returns to rest on its own; the gallery calls stopAnimation() on
      // mouse-leave, so a no-op here keeps that cycle from being
      // interrupted or reversed. The "animate" variant must end at rest.
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
        <path d={FRAME_PATH} fill="currentColor" />
        <motion.path
          d={FLAG_PATH}
          fill="currentColor"
          variants={RECEIPT_VARIANTS}
          animate={controls}
        />
      </svg>
    </div>
  )
})

ReceiptSquareIcon.displayName = "ReceiptSquareIcon"

export { ReceiptSquareIcon }
export default ReceiptSquareIcon