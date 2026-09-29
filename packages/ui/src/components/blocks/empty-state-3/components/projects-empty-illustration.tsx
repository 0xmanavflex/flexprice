// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
import { cn } from "cn"

export function ProjectsEmptyIllustration({
  variant = "hero",
}: {
  variant?: "hero" | "compact"
}) {
  const isCompact = variant === "compact"

  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative isolate",
        isCompact ? "h-11 w-20" : "h-32 w-[13.5rem]"
      )}
    >
      {isCompact ? <CompactView /> : <HeroView />}
    </div>
  )
}

function HeroView() {
  return (
    <svg viewBox="0 0 220 140" fill="none" className="h-full w-full">
      <line
        x1="40"
        y1="0"
        x2="40"
        y2="140"
        stroke="currentColor"
        strokeOpacity="0.05"
        strokeWidth="0.5"
      />
      <line
        x1="110"
        y1="0"
        x2="110"
        y2="140"
        stroke="currentColor"
        strokeOpacity="0.05"
        strokeWidth="0.5"
      />
      <line
        x1="180"
        y1="0"
        x2="180"
        y2="140"
        stroke="currentColor"
        strokeOpacity="0.05"
        strokeWidth="0.5"
      />
      <line
        x1="0"
        y1="25"
        x2="220"
        y2="25"
        stroke="currentColor"
        strokeOpacity="0.05"
        strokeWidth="0.5"
      />
      <line
        x1="0"
        y1="70"
        x2="220"
        y2="70"
        stroke="currentColor"
        strokeOpacity="0.05"
        strokeWidth="0.5"
      />
      <line
        x1="0"
        y1="115"
        x2="220"
        y2="115"
        stroke="currentColor"
        strokeOpacity="0.05"
        strokeWidth="0.5"
      />

      {/* Cube A - bottom step */}
      <polygon
        points="89,58 110,70 110,94 89,106 68,94 68,70"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.28"
        strokeWidth="0.75"
        strokeLinejoin="round"
      />
      <line
        x1="89"
        y1="82"
        x2="68"
        y2="70"
        stroke="currentColor"
        strokeOpacity="0.18"
        strokeWidth="0.5"
      />
      <line
        x1="89"
        y1="82"
        x2="110"
        y2="70"
        stroke="currentColor"
        strokeOpacity="0.18"
        strokeWidth="0.5"
      />
      <line
        x1="89"
        y1="82"
        x2="89"
        y2="106"
        stroke="currentColor"
        strokeOpacity="0.18"
        strokeWidth="0.5"
      />

      {/* Cube B - middle step */}
      <polygon
        points="110,46 131,58 131,82 110,94 89,82 89,58"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.38"
        strokeWidth="0.75"
        strokeLinejoin="round"
      />
      <line
        x1="110"
        y1="70"
        x2="89"
        y2="58"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="0.5"
      />
      <line
        x1="110"
        y1="70"
        x2="131"
        y2="58"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="0.5"
      />
      <line
        x1="110"
        y1="70"
        x2="110"
        y2="94"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="0.5"
      />

      {/* Cube C - top step */}
      <polygon
        points="131,34 152,46 152,70 131,82 110,70 110,46"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.5"
        strokeWidth="0.75"
        strokeLinejoin="round"
      />
      <line
        x1="131"
        y1="58"
        x2="110"
        y2="46"
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="0.5"
      />
      <line
        x1="131"
        y1="58"
        x2="152"
        y2="46"
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="0.5"
      />
      <line
        x1="131"
        y1="58"
        x2="131"
        y2="82"
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="0.5"
      />

      {/* Floating diamond - ghost block suggesting growth */}
      <path
        d="M148 22 L155 26 L148 30 L141 26 Z"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.18"
        strokeWidth="0.5"
        strokeDasharray="2 2"
      />

      {/* Accent dots */}
      <circle cx="40" cy="70" r="1.5" fill="currentColor" opacity="0.1" />
      <circle cx="180" cy="70" r="1.5" fill="currentColor" opacity="0.1" />
      <circle cx="110" cy="25" r="1.5" fill="currentColor" opacity="0.07" />
    </svg>
  )
}

function CompactView() {
  return (
    <svg viewBox="0 0 80 44" fill="none" className="h-full w-full">
      {/* Cube A - bottom step */}
      <polygon
        points="33,18 40,22 40,30 33,34 26,30 26,22"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.28"
        strokeWidth="0.75"
        strokeLinejoin="round"
      />
      <line
        x1="33"
        y1="26"
        x2="26"
        y2="22"
        stroke="currentColor"
        strokeOpacity="0.18"
        strokeWidth="0.5"
      />
      <line
        x1="33"
        y1="26"
        x2="40"
        y2="22"
        stroke="currentColor"
        strokeOpacity="0.18"
        strokeWidth="0.5"
      />
      <line
        x1="33"
        y1="26"
        x2="33"
        y2="34"
        stroke="currentColor"
        strokeOpacity="0.18"
        strokeWidth="0.5"
      />

      {/* Cube B - middle step */}
      <polygon
        points="40,14 47,18 47,26 40,30 33,26 33,18"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.38"
        strokeWidth="0.75"
        strokeLinejoin="round"
      />
      <line
        x1="40"
        y1="22"
        x2="33"
        y2="18"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="0.5"
      />
      <line
        x1="40"
        y1="22"
        x2="47"
        y2="18"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="0.5"
      />
      <line
        x1="40"
        y1="22"
        x2="40"
        y2="30"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="0.5"
      />

      {/* Cube C - top step */}
      <polygon
        points="47,10 54,14 54,22 47,26 40,22 40,14"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.5"
        strokeWidth="0.75"
        strokeLinejoin="round"
      />
      <line
        x1="47"
        y1="18"
        x2="40"
        y2="14"
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="0.5"
      />
      <line
        x1="47"
        y1="18"
        x2="54"
        y2="14"
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="0.5"
      />
      <line
        x1="47"
        y1="18"
        x2="47"
        y2="26"
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="0.5"
      />
    </svg>
  )
}