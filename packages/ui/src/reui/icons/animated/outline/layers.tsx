// @ts-nocheck — vendored from the ReUI registry (Motion Icons); do not hand-edit.
// Regenerate with: pnpm icons:sync   (see scripts/icons-sync.mjs)
import type { HTMLAttributes } from "react"
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react"
import { cn } from '@ui/lib/cn'
import type { Variants } from "motion/react"
import { motion, useAnimation } from "motion/react"

export interface LayersIconHandle {
  startAnimation: () => void
  stopAnimation: () => void
}

interface LayersIconProps extends HTMLAttributes<HTMLDivElement> {}

const TOP_LAYER_VARIANTS: Variants = {
  normal: { y: 0, transition: { duration: 0.3, ease: "easeOut" } },
  animate: {
    y: [0, -3, 0.6, 0],
    transition: { duration: 0.7, ease: "easeInOut", times: [0, 0.4, 0.75, 1] },
  },
}

const MIDDLE_LAYER_VARIANTS: Variants = {
  normal: { y: 0, transition: { duration: 0.3, ease: "easeOut" } },
  animate: {
    y: [0, -1.4, 0.3, 0],
    transition: {
      duration: 0.7,
      ease: "easeInOut",
      times: [0, 0.4, 0.75, 1],
      delay: 0.05,
    },
  },
}

const BOTTOM_LAYER_VARIANTS: Variants = {
  normal: { y: 0, transition: { duration: 0.3, ease: "easeOut" } },
  animate: {
    y: [0, 1.1, -0.25, 0],
    transition: {
      duration: 0.7,
      ease: "easeInOut",
      times: [0, 0.4, 0.75, 1],
      delay: 0.1,
    },
  },
}

const LayersIcon = forwardRef<LayersIconHandle, LayersIconProps>(
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
            d="M11.97 22.733C11.522 22.734 11.079 22.649 10.663 22.483L2.472 19.201C2.111 19.056 1.802 18.807 1.584 18.485C1.366 18.163 1.25 17.783 1.25 17.395C1.25 17.006 1.366 16.626 1.584 16.305C1.802 15.983 2.111 15.733 2.472 15.589C2.564 15.548 2.664 15.527 2.766 15.527C2.867 15.526 2.967 15.546 3.06 15.585C3.153 15.624 3.238 15.682 3.308 15.755C3.378 15.827 3.433 15.913 3.469 16.008C3.508 16.104 3.527 16.207 3.524 16.31C3.52 16.414 3.495 16.515 3.45 16.608C3.405 16.702 3.341 16.784 3.261 16.851C3.182 16.918 3.09 16.967 2.991 16.996C2.907 17.03 2.836 17.088 2.787 17.162C2.737 17.237 2.71 17.325 2.711 17.415C2.709 17.505 2.735 17.593 2.785 17.668C2.835 17.743 2.907 17.801 2.991 17.834L11.192 21.106C11.672 21.3 12.209 21.3 12.688 21.106L20.95 17.814C21.034 17.781 21.105 17.723 21.155 17.648C21.205 17.573 21.231 17.485 21.229 17.395C21.226 17.308 21.198 17.225 21.148 17.154C21.099 17.083 21.03 17.028 20.95 16.996C20.854 16.961 20.767 16.907 20.694 16.836C20.62 16.766 20.562 16.682 20.523 16.588C20.483 16.494 20.464 16.394 20.465 16.292C20.466 16.191 20.489 16.09 20.531 15.998C20.567 15.903 20.622 15.817 20.692 15.745C20.762 15.672 20.847 15.614 20.94 15.575C21.033 15.536 21.133 15.516 21.235 15.517C21.336 15.517 21.436 15.538 21.528 15.579C21.889 15.723 22.198 15.973 22.416 16.295C22.634 16.616 22.75 16.996 22.75 17.385C22.75 17.773 22.634 18.153 22.416 18.475C22.198 18.797 21.889 19.046 21.528 19.191L13.277 22.483C12.861 22.649 12.418 22.734 11.97 22.733Z"
            fill="currentColor"
            variants={BOTTOM_LAYER_VARIANTS}
            animate={controls}
          />
          <motion.path
            d="M11.97 17.345C11.522 17.343 11.078 17.255 10.663 17.085L2.472 13.813C2.111 13.668 1.802 13.419 1.584 13.097C1.366 12.775 1.25 12.396 1.25 12.007C1.25 11.618 1.366 11.239 1.584 10.917C1.802 10.595 2.111 10.346 2.472 10.201L3.469 9.812C3.562 9.771 3.661 9.75 3.762 9.748C3.862 9.747 3.962 9.766 4.055 9.804C4.148 9.842 4.233 9.899 4.304 9.971C4.374 10.042 4.43 10.127 4.467 10.221C4.506 10.314 4.526 10.414 4.526 10.514C4.526 10.615 4.506 10.715 4.467 10.808C4.428 10.901 4.371 10.985 4.299 11.055C4.227 11.126 4.142 11.182 4.048 11.219L3.05 11.608C2.966 11.641 2.895 11.698 2.845 11.773C2.795 11.848 2.769 11.937 2.771 12.027C2.77 12.117 2.797 12.205 2.846 12.279C2.896 12.354 2.967 12.412 3.05 12.446L11.252 15.719C11.732 15.913 12.268 15.913 12.748 15.719L20.95 12.426C21.033 12.392 21.104 12.334 21.154 12.259C21.203 12.185 21.23 12.097 21.229 12.007C21.231 11.917 21.205 11.828 21.155 11.753C21.105 11.678 21.034 11.621 20.95 11.588L19.952 11.199C19.86 11.163 19.777 11.109 19.706 11.041C19.635 10.972 19.578 10.891 19.538 10.8C19.499 10.71 19.478 10.613 19.476 10.514C19.474 10.416 19.492 10.318 19.528 10.226C19.564 10.134 19.618 10.051 19.686 9.98C19.754 9.909 19.836 9.852 19.926 9.812C20.017 9.773 20.114 9.752 20.213 9.75C20.311 9.748 20.409 9.766 20.501 9.802L21.498 10.201C21.859 10.346 22.168 10.595 22.386 10.917C22.604 11.239 22.72 11.618 22.72 12.007C22.72 12.396 22.604 12.775 22.386 13.097C22.168 13.419 21.859 13.668 21.498 13.813L13.307 17.085C12.883 17.258 12.428 17.346 11.97 17.345Z"
            fill="currentColor"
            variants={MIDDLE_LAYER_VARIANTS}
            animate={controls}
          />
          <motion.path
            d="M11.97 12.007C11.522 12.005 11.078 11.917 10.663 11.748L2.472 8.425C2.111 8.28 1.802 8.031 1.584 7.709C1.366 7.387 1.25 7.008 1.25 6.619C1.25 6.231 1.366 5.851 1.584 5.529C1.802 5.207 2.111 4.958 2.472 4.813L10.663 1.531C11.502 1.196 12.438 1.196 13.277 1.531L21.469 4.813C21.829 4.958 22.138 5.207 22.356 5.529C22.574 5.851 22.69 6.231 22.69 6.619C22.69 7.008 22.574 7.387 22.356 7.709C22.138 8.031 21.829 8.28 21.469 8.425L13.277 11.698C12.865 11.884 12.422 11.989 11.97 12.007ZM11.222 10.361C11.702 10.555 12.238 10.555 12.718 10.361L20.95 7.018C21.033 6.984 21.104 6.926 21.154 6.852C21.203 6.777 21.23 6.689 21.229 6.599C21.227 6.513 21.2 6.428 21.15 6.357C21.1 6.286 21.03 6.232 20.95 6.2L12.718 2.918C12.238 2.723 11.702 2.723 11.222 2.918L2.991 6.2C2.907 6.233 2.835 6.291 2.785 6.366C2.735 6.441 2.709 6.529 2.711 6.619C2.714 6.706 2.742 6.789 2.792 6.86C2.842 6.931 2.91 6.986 2.991 7.018L11.222 10.361Z"
            fill="currentColor"
            variants={TOP_LAYER_VARIANTS}
            animate={controls}
          />
        </svg>
      </div>
    )
  }
)

LayersIcon.displayName = "LayersIcon"

export { LayersIcon }
export default LayersIcon