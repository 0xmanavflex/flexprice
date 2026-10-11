// @ts-nocheck — vendored from the ReUI registry (Motion Icons); do not hand-edit.
// Regenerate with: pnpm icons:sync   (see scripts/icons-sync.mjs)
import type { HTMLAttributes } from "react"
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react"
import { cn } from '@ui/lib/cn'
import type { Variants } from "motion/react"
import { motion, useAnimation } from "motion/react"

export interface CubesClusterIconHandle {
  startAnimation: () => void
  stopAnimation: () => void
}

interface CubesClusterIconProps extends HTMLAttributes<HTMLDivElement> {}

const BLADE_VARIANTS: Variants = {
  normal: { scale: 1, transition: { duration: 0.3, ease: "easeOut" } },
  animate: (i: number) => ({
    scale: [1, 0.18, 1.1, 1],
    transition: {
      delay: i * 0.1,
      duration: 0.46,
      ease: "easeInOut",
      times: [0, 0.36, 0.72, 1],
    },
  }),
}

const CubesClusterIcon = forwardRef<
  CubesClusterIconHandle,
  CubesClusterIconProps
>(({ onMouseEnter, onMouseLeave, className, ...props }, ref) => {
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
          d="M 17.232 8.917C 17.342 8.849 17.434 8.755 17.498 8.642C 17.562 8.53 17.596 8.403 17.597 8.274V 4.239C 17.597 3.949 17.522 3.664 17.377 3.414C 17.233 3.163 17.025 2.954 16.774 2.809C 16.524 2.664 16.24 2.587 15.95 2.586C 15.661 2.585 15.376 2.661 15.126 2.804L 12 4.605L 8.874 2.804C 8.624 2.661 8.339 2.585 8.05 2.586C 7.76 2.587 7.475 2.664 7.226 2.809C 6.975 2.954 6.767 3.163 6.623 3.414C 6.478 3.664 6.403 3.949 6.403 4.239V 8.274C 6.404 8.403 6.438 8.53 6.502 8.642C 6.566 8.755 6.658 8.849 6.768 8.917L 11.625 11.715C 11.738 11.781 11.868 11.815 12 11.814C 12.129 11.817 12.256 11.783 12.366 11.715L 17.232 8.917ZM 15.867 4.1C 15.892 4.085 15.922 4.078 15.951 4.078C 15.98 4.078 16.01 4.085 16.035 4.1C 16.061 4.114 16.084 4.136 16.097 4.162C 16.111 4.189 16.118 4.218 16.114 4.249V 7.839L 12.742 9.817V 5.89L 15.867 4.1ZM 7.886 4.249C 7.882 4.218 7.888 4.189 7.903 4.162C 7.916 4.136 7.939 4.114 7.964 4.1C 7.99 4.085 8.019 4.078 8.049 4.078C 8.078 4.078 8.108 4.085 8.133 4.1L 11.258 5.9V 9.856L 7.886 7.878V 4.249Z"
          fill="currentColor"
          custom={0}
          variants={BLADE_VARIANTS}
          animate={controls}
        />
        <motion.path
          d="M 21.801 11.517L 18.309 9.539C 18.198 9.472 18.07 9.436 17.939 9.436C 17.808 9.436 17.68 9.472 17.568 9.539L 12.712 12.309C 12.596 12.372 12.501 12.465 12.435 12.578C 12.369 12.692 12.335 12.82 12.337 12.952V 18.559C 12.335 18.69 12.369 18.82 12.435 18.933C 12.501 19.046 12.596 19.139 12.712 19.202L 16.203 21.18C 16.453 21.329 16.738 21.407 17.029 21.407C 17.32 21.407 17.605 21.329 17.854 21.18C 18.108 21.036 18.319 20.827 18.465 20.576C 18.61 20.324 18.687 20.037 18.686 19.746V 16.185L 21.801 14.376C 22.054 14.233 22.265 14.025 22.411 13.774C 22.558 13.523 22.634 13.237 22.634 12.947C 22.634 12.657 22.558 12.371 22.411 12.119C 22.265 11.869 22.054 11.661 21.801 11.517ZM 17.113 19.924C 17.088 19.939 17.058 19.946 17.029 19.946C 16.999 19.946 16.97 19.939 16.945 19.924L 13.82 18.124V 14.168L 17.202 16.146V 19.746C 17.208 19.782 17.203 19.818 17.187 19.85C 17.171 19.881 17.145 19.907 17.113 19.924ZM 21.069 13.08L 17.934 14.9L 14.551 12.922L 17.934 11.023L 21.049 12.833C 21.076 12.847 21.098 12.868 21.114 12.895C 21.13 12.921 21.138 12.951 21.138 12.981C 21.134 13.004 21.124 13.026 21.11 13.045C 21.098 13.063 21.079 13.079 21.059 13.09L 21.069 13.08Z"
          fill="currentColor"
          custom={1}
          variants={BLADE_VARIANTS}
          animate={controls}
        />
        <motion.path
          d="M 11.298 12.299L 6.432 9.5C 6.32 9.432 6.192 9.396 6.061 9.396C 5.93 9.396 5.802 9.432 5.691 9.5L 2.19 11.478C 1.939 11.624 1.731 11.832 1.587 12.082C 1.441 12.333 1.366 12.618 1.366 12.907C 1.366 13.197 1.441 13.481 1.587 13.732C 1.731 13.983 1.939 14.192 2.19 14.336L 5.314 16.146V 19.746C 5.313 20.037 5.39 20.324 5.535 20.576C 5.681 20.827 5.892 21.036 6.146 21.18C 6.395 21.329 6.68 21.407 6.971 21.407C 7.262 21.407 7.547 21.329 7.797 21.18L 11.288 19.202C 11.403 19.139 11.499 19.046 11.565 18.933C 11.631 18.82 11.665 18.69 11.663 18.559V 13.001C 11.674 12.862 11.645 12.722 11.578 12.599C 11.512 12.476 11.411 12.375 11.288 12.309L 11.298 12.299ZM 2.852 13.001C 2.85 12.972 2.856 12.942 2.87 12.915C 2.884 12.89 2.905 12.867 2.931 12.853L 6.066 11.023L 9.449 13.001L 6.066 14.9L 2.931 13.09C 2.913 13.082 2.896 13.069 2.882 13.054C 2.868 13.038 2.858 13.021 2.852 13.001ZM 7.055 19.924C 7.03 19.939 7.001 19.946 6.971 19.946C 6.942 19.946 6.912 19.939 6.887 19.924C 6.86 19.91 6.837 19.888 6.822 19.862C 6.806 19.836 6.797 19.807 6.797 19.776V 16.185L 10.18 14.207V 18.163L 7.055 19.924Z"
          fill="currentColor"
          custom={2}
          variants={BLADE_VARIANTS}
          animate={controls}
        />
      </svg>
    </div>
  )
})

CubesClusterIcon.displayName = "CubesClusterIcon"

export { CubesClusterIcon }
export default CubesClusterIcon