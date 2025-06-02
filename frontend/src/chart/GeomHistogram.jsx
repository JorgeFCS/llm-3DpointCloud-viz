import { useRef, useMemo } from "react"
import * as d3 from "d3";
import { AxisLeft, AxisBottom } from "./Axis"
import { useChartDimensions } from "../utils/chart";

// TODO add "padding" to domain to not have points on axis, or maybe use padding in chartDimensions
export default function GeomHistogram({
    dataset = [],
    config = {},
    dimensions = {
        width: 500,
        height: 500
    }
}) {
    // config can contain the following:
    // config.x - Dataset entry accessor name for horizontal axis
    // config.bins - Number of bins, default: 10
    // config.xTickFormat - Horizontal axis tick format (function)
    // config.xLabel - Horizontal axis label (String)
    // config.yLabel - Vertical axis label (String)

    const ref = useRef()
    const dms = useChartDimensions(ref, dimensions)

    const bins = d3.bin()
        .thresholds(config.bins ? config.bins : 30)
        .value((d) => d[config.x])
        (dataset)

    const xScale = useMemo(() => {
        return d3.scaleLinear()
            .domain([bins[0].x0, bins[bins.length - 1].x1])
            .range([0, dms.boundedWidth]);
    }, [dms.boundedWidth, config.x])

    const yScale = useMemo(() => {
        return d3.scaleLinear()
            .domain([0, d3.max(bins, (d) => d.length)])
            .range([0, dms.boundedHeight]);
    }, [dms.boundedHeight, config.y])


    return (
        <div ref={ref}>
            <svg width={dms.width} height={dms.height}>
                <g transform={`translate(${[
                    dms.marginLeft,
                    dms.marginTop
                ].join(",")})`}>
                    {bins.map((d, i) => {
                        const tooltipContent = `${d.x0} - ${d.x1}\ncount: ${d.length}`;
                        return <g key={i}>
                            <rect
                                x={xScale(d.x0) + 1}
                                width={xScale(d.x1) - xScale(d.x0) - 1}
                                y={dms.boundedHeight - yScale(d.length)}
                                height={yScale(d.length) - yScale(0)}
                                fill="steelblue" />
                            <title>
                                <text>{tooltipContent}</text>
                            </title>
                        </g>
                    })}
                    <g transform={`translate(${[
                        0,
                        dms.boundedHeight,
                    ].join(",")})`}>
                        <AxisBottom
                            scale={xScale}
                            label={config.xLabel ? config.xLabel : config.x}
                            {...(config.xTickFormat && { formatter: config.xTickFormat })}
                            dimensions={dms}

                        />
                    </g>
                    <g>
                        <AxisLeft
                            scale={yScale}
                            label={config.yLabel ? config.yLabel : "Frequency"}
                            {...(config.yTickFormat && { formatter: config.yTickFormat })}
                            dimensions={dms}
                        />
                    </g>
                </g>
            </svg>
        </div>
    )
}