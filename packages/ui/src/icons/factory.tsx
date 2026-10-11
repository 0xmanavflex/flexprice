import {
  cloneElement,
  forwardRef,
  type ComponentType,
  type HTMLAttributes,
  type ReactElement,
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
      ...rest
    } = props
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

/**
 * A ReUI animated outline icon. It animates itself on hover; the wrapper adds
 * the size lucide icons had by default, unless the caller sizes it.
 */
export function animatedIcon(Source: AnimatedSource, name: string, rotate?: number): IconComponent {
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
    return (
      <Source
        {...(rest as HTMLAttributes<HTMLDivElement>)}
        {...decorative(props)}
        className={cn('inline-flex shrink-0', !HAS_SIZE.test(className ?? '') && 'size-6', className)}
        style={{ ...rotation(rotate), ...sized, ...(style as HTMLAttributes<HTMLDivElement>['style']) }}
      />
    )
  }
  Icon.displayName = name
  return Icon
}
