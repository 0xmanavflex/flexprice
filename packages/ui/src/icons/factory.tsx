import {
  cloneElement,
  forwardRef,
  useEffect,
  useRef,
  type ComponentType,
  type HTMLAttributes,
  type ReactElement,
  type Ref,
  type SVGProps,
} from 'react'
import { cn } from '@ui/lib/cn'

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'ref' | 'children'> {
  size?: number | string
  /** Accepted for call-site compatibility; ReUI icons are filled shapes, so stroke settings do nothing. */
  absoluteStrokeWidth?: boolean
}

export type IconComponent = ComponentType<IconProps>

type StaticSource = (props: { className?: string }) => ReactElement<SVGProps<SVGSVGElement>>
type AnimatedSource = ComponentType<HTMLAttributes<HTMLDivElement>>

const HAS_SIZE = /(^|\s)(size|w|h)-/

const rotation = (degrees: number | undefined) =>
  degrees ? { transform: `rotate(${degrees}deg)` } : undefined

const decorative = (props: IconProps) =>
  props['aria-label'] === undefined && props['aria-labelledby'] === undefined && props.role === undefined
    ? { 'aria-hidden': true as const }
    : undefined

/**
 * A ReUI static outline icon. The registry component only takes `className`, so
 * everything else a caller passes (size, aria, data attributes) is applied to
 * the svg it renders.
 */
export function staticIcon(Source: StaticSource, name: string, rotate?: number): IconComponent {
  const Icon = forwardRef<SVGSVGElement, IconProps>(function StaticIcon(props, ref) {
    const {
      size,
      className,
      style,
      absoluteStrokeWidth: _absoluteStrokeWidth,
      stroke: _stroke,
      strokeWidth: _strokeWidth,
      fill: _fill,
      // Base UI's `Select.Icon` and similar slots inject a text child ("▼");
      // cloning it onto the svg would replace the glyph's paths with that text.
      children: _children,
      ...rest
    } = props as IconProps & { children?: unknown }
    const svg = Source(className === undefined ? {} : { className })
    const dimensions = size === undefined ? undefined : { width: size, height: size }
    return cloneElement(svg, {
      ...decorative(props),
      ...rest,
      ...dimensions,
      style: { ...rotation(rotate), ...style },
      ref,
    })
  })
  Icon.displayName = name
  return Icon
}

interface AnimationHandle {
  startAnimation: () => void
  stopAnimation: () => void
}

const HOST = 'a,button,[role="menuitem"],[role="option"],[role="tab"]'

/**
 * A ReUI animated outline icon. The icon only animates when the pointer is on
 * the glyph itself, which a 16px icon in a 32px row rarely is, so it is driven
 * by the control it sits in instead: hovering the row plays it, and a row that
 * becomes active (`data-active` / `aria-current`) plays it once. The wrapper
 * adds the size lucide icons had by default, unless the caller sizes it.
 */
export function animatedIcon(Source: AnimatedSource, name: string, rotate?: number): IconComponent {
  const Animated = Source as unknown as ComponentType<
    HTMLAttributes<HTMLDivElement> & { ref?: Ref<AnimationHandle> }
  >
  const Icon: IconComponent = function AnimatedIcon(props) {
    const {
      size,
      className,
      style,
      absoluteStrokeWidth: _absoluteStrokeWidth,
      stroke: _stroke,
      strokeWidth: _strokeWidth,
      fill: _fill,
      width: _width,
      height: _height,
      color: _color,
      ...rest
    } = props
    const sized = size === undefined ? undefined : { width: size, height: size }
    const handle = useRef<AnimationHandle>(null)
    const anchor = useRef<HTMLSpanElement>(null)

    useEffect(() => {
      const node = anchor.current
      if (!node) return
      const host = node.closest<HTMLElement>(HOST) ?? node
      const play = () => handle.current?.startAnimation()
      const rest = () => handle.current?.stopAnimation()
      const isActive = () =>
        host.hasAttribute('data-active') || host.getAttribute('aria-current') === 'page'
      let active = isActive()
      host.addEventListener('mouseenter', play)
      host.addEventListener('mouseleave', rest)
      host.addEventListener('focusin', play)
      host.addEventListener('focusout', rest)
      const observer = new MutationObserver(() => {
        const now = isActive()
        if (now && !active) play()
        active = now
      })
      observer.observe(host, { attributes: true, attributeFilter: ['data-active', 'aria-current'] })
      return () => {
        host.removeEventListener('mouseenter', play)
        host.removeEventListener('mouseleave', rest)
        host.removeEventListener('focusin', play)
        host.removeEventListener('focusout', rest)
        observer.disconnect()
      }
    }, [])

    return (
      <span ref={anchor} className="inline-flex shrink-0">
        <Animated
          ref={handle}
          {...(rest as HTMLAttributes<HTMLDivElement>)}
          {...decorative(props)}
          className={cn('inline-flex shrink-0', !HAS_SIZE.test(className ?? '') && 'size-6', className)}
          style={{
            ...rotation(rotate),
            ...sized,
            ...(style as HTMLAttributes<HTMLDivElement>['style']),
          }}
        />
      </span>
    )
  }
  Icon.displayName = name
  return Icon
}
