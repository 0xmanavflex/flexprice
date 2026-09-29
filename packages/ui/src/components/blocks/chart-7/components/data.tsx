// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
export interface MetricMember {
  avatar?: string
  initials: string
  name: string
}

export interface ArcMetric {
  title: string
  state: string
  label: string
  value: string
  audience: string
  activeSegments: number
  segmentColor: string
  /** Segment pillars around the arc (Figma-style gauge). Default 40. */
  segmentCount?: number
  /** Inactive segment fill; lighter than default when set. */
  segmentTrackColor?: string
  members: MetricMember[]
}

export const arcMetrics: ArcMetric[] = [
  {
    title: "Performance Metrics",
    state: "Stable",
    label: "Server Uptime",
    value: "99.7%",
    audience: "6 reviewers",
    activeSegments: 36,
    segmentCount: 40,
    segmentColor: "var(--success)",
    segmentTrackColor:
      "color-mix(in oklch, var(--muted-foreground) 12%, var(--card))",
    members: [
      {
        avatar:
          "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=96&h=96&dpr=2&q=80",
        initials: "AM",
        name: "Ari Morgan",
      },
      {
        avatar:
          "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=96&h=96&dpr=2&q=80",
        initials: "CL",
        name: "Chris Lee",
      },
      {
        initials: "K",
        name: "Kai Tan",
      },
      {
        avatar:
          "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=96&h=96&dpr=2&q=80",
        initials: "RN",
        name: "Ravi Noor",
      },
    ],
  },
  {
    title: "Quality Metrics",
    state: "In Review",
    label: "Code Coverage",
    value: "48.2%",
    audience: "9 testers",
    activeSegments: 20,
    segmentCount: 40,
    segmentColor: "var(--warning)",
    segmentTrackColor:
      "color-mix(in oklch, var(--muted-foreground) 12%, var(--card))",
    members: [
      {
        avatar:
          "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=96&h=96&dpr=2&q=80",
        initials: "EL",
        name: "Elena Lee",
      },
      {
        avatar:
          "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=96&h=96&dpr=2&q=80",
        initials: "OM",
        name: "Owen Miles",
      },
      {
        initials: "K",
        name: "Kei Park",
      },
      {
        avatar:
          "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=96&h=96&dpr=2&q=80",
        initials: "BT",
        name: "Ben Torres",
      },
    ],
  },
]