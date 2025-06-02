// Adapted from https://2019.wattenberger.com/blog/react-and-d3
import { useEffect, useState } from 'react'
import { ResizeObserver } from '@juggle/resize-observer'

export const combineChartDimensions = dimensions => {
    // dimensions should at least contain "width" and "height" attribute
    const parsedDimensions = {
        ...dimensions,
        marginTop: dimensions.marginTop || 10,
        marginRight: dimensions.marginRight || 10,
        marginBottom: dimensions.marginBottom || 40,
        marginLeft: dimensions.marginLeft || 75,
    }

    return {
        ...parsedDimensions,
        boundedHeight: Math.max(
            parsedDimensions.height
            - parsedDimensions.marginTop
            - parsedDimensions.marginBottom,
            0,
        ),
        boundedWidth: Math.max(
            parsedDimensions.width
            - parsedDimensions.marginLeft
            - parsedDimensions.marginRight,
            0,
        ),
    }
}
export const useChartDimensions = (ref, passedDimensions) => {
    const [width, setWidth] = useState(passedDimensions.width)
    const [height, setHeight] = useState(passedDimensions.height)

    const dimensions = combineChartDimensions(
        {
            ...passedDimensions,
            width: width,
            height: height
        }
    )

    useEffect(() => {
        const element = ref.current
        const resizeObserver = new ResizeObserver(
            entries => {
                if (!Array.isArray(entries)) { return }
                if (!entries.length) { return }

                const entry = entries[0]

                if (width !== entry.contentRect.width) {
                    setWidth(entry.contentRect.width)
                }
                if (height !== entry.contentRect.height) {
                    setHeight(entry.contentRect.height)
                }
            }
        )
        resizeObserver.observe(element)

        return () => {
            resizeObserver.unobserve(element);
        };
    }, [ref])

    return dimensions;
}