/*
 * LightningChartJS example that showcases usage of BoxSeries and RangeSeries to show some made-up statistical graphs.
 */
// Import LightningChartJS
const lcjs = require('@arction/lcjs')

// Extract required parts from LightningChartJS.
const {
    ColorPalettes,
    SolidFill,
    SolidLine,
    emptyLine,
    lightningChart,
    yDimensionStrategy,
    LegendBoxBuilders,
    UIDraggingModes,
    AxisScrollStrategies,
    AutoCursorModes,
    UIOrigins
} = lcjs

// Import data-generator from 'xydata'-library.
const {
    createProgressiveFunctionGenerator
} = require('@arction/xydata')

// ----- Cache used styles -----
const palette = ColorPalettes.arction(10)
const colors = [2, 4, 0, 0].map(palette)
const Style = (color) => {
    const solidFill = new SolidFill({ color })
    const opaqueFill = new SolidFill({ color: color.setA(100) })
    const solidLine = new SolidLine({ fillStyle: solidFill, thickness: 2 })
    return { solidFill, opaqueFill, solidLine }
}
const styles = colors.map(Style)
const medianStrokeStyle = new SolidLine({ fillStyle: new SolidFill({ color: colors[3] }), thickness: 6 })

// Utilities for graphing distribution functions.
//#region
const cumulativeDistribution = (
    probabilityDistributionFunction,
    rangeMin,
    rangeMax,
    step
) => {
    // Simulate values of respective probability density function.
    const probabilityValues = []
    for (let x = rangeMin; x <= rangeMax; x += step)
        probabilityValues.push(probabilityDistributionFunction(x))
    // Normalize probability values and push them to a cached array.
    const probabilitySum = probabilityValues.reduce((prev, cur) => prev + cur, 0)
    const values = []
    let accumulatedNormProb = 0
    for (const probabilityValue of probabilityValues) {
        const normalizedprobabilityValue = probabilityValue / probabilitySum
        accumulatedNormProb += normalizedprobabilityValue
        values.push(accumulatedNormProb)
    }
    // Return function that returns the closest value (by x) from the cached 'values' array.
    return (x) => {
        const xAsIndex = (x - rangeMin) / (rangeMax - rangeMin) * ((rangeMax - rangeMin) / step)
        // Pick closest index (left/right) that exists
        const closestIndex = Math.min(Math.max(Math.round(xAsIndex), 0), values.length - 1)
        return values[closestIndex]
    }
}
const findQuartileX = (
    yToLookFor,
    cumulativeDistributionFunction,
    rangeMin,
    rangeMax,
    step
) => {
    // Iterate over possible 'X' values and pick the one where resulting 'Y' is closest to 'yToLookFor'
    let bestResult
    for (let x = rangeMin; x <= rangeMax; x += step) {
        const y = cumulativeDistributionFunction(x)
        const delta = Math.abs(y - yToLookFor)
        if (bestResult === undefined || delta < bestResult.delta)
            bestResult = { x, delta }
        else if (bestResult !== undefined && delta > bestResult.delta)
            break
    }
    return bestResult.x
}
const probabilityDistribution = (mean, variance) =>
    (x) =>
        (1 / (variance * Math.sqrt(2 * Math.PI))) * Math.pow(Math.E, -Math.pow((x - mean), 2) / (2 * variance * variance))
//#endregion

// Make chart with series graphing standard probability density and cumulative distribution functions.
const chart = lightningChart().ChartXY()
    .setTitle('Probability distribution + Simulated accumulation and BoxSeries')
    // Set auto-cursor mode to 'onHover'
    .setAutoCursorMode(AutoCursorModes.onHover)
    .setAutoCursor((cursor) => cursor
        .setResultTableAutoTextStyle(false)
        .setTickMarkerXAutoTextStyle(false)
        .setTickMarkerYAutoTextStyle(false)
    )
    .setPadding({ right: 20 })

const xBounds = { min: -4, max: 4 }
const step = 0.02
// Setup axes.
const axisDistribution = chart.getDefaultAxisY()
const axisNormalized = chart.addAxisY()
const axisX = chart.getDefaultAxisX()
    .setInterval(xBounds.min, xBounds.max)
    .setScrollStrategy(undefined)

axisDistribution
    .setTitle('Distribution function')
    .setScrollStrategy(AxisScrollStrategies.expansion)
    // Modify TickStyle to hide gridStrokes.
    .setTickStyle(visibleTicks => visibleTicks
        .setGridStrokeStyle(emptyLine)
    )

axisNormalized
    .setTitle('Accumulated distribution (%)')
    .setInterval(0, 1)
    .setScrollStrategy(undefined)
    // Modify TickStyle to hide gridStroke.
    .setTickStyle(visibleTicks => visibleTicks
        .setGridStrokeStyle(emptyLine)
    )

// Cumulative distribution.
const cumulativeDistributionSeries = chart.addAreaSeries({ yAxis: axisNormalized })
    .setName('Simulated Cumulative Distribution')
    .setFillStyle(styles[0].opaqueFill)
    .setStrokeStyle(styles[0].solidLine)

// probability distribution.
const probabilityDistributionSeries = chart.addAreaSeries({ yAxis: axisDistribution })
    .setName('Probability Distribution')
    .setFillStyle(styles[1].opaqueFill)
    .setStrokeStyle(styles[1].solidLine)

// 'Violin' series.
const violinSeries = chart.addAreaRangeSeries({ yAxis: axisDistribution })
    .setName('Violin')
    .setHighFillStyle(styles[2].opaqueFill)
    .setLowFillStyle(styles[2].opaqueFill)
    .setHighStrokeStyle(styles[2].solidLine)
    .setLowStrokeStyle(styles[2].solidLine)

// Box series.
const boxSeries = chart.addBoxSeries({ yAxis: axisDistribution, dimensionStrategy: yDimensionStrategy })
    .setName('Box')
    .setDefaultStyle((boxAndWhiskers) => boxAndWhiskers
        .setBodyFillStyle(styles[2].opaqueFill)
        .setBodyStrokeStyle(styles[2].solidLine)
        .setStrokeStyle(styles[2].solidLine)
        .setMedianStrokeStyle(medianStrokeStyle)
        .setTailWidth(0)
    )

// Drawing logic
//#region
const graphDistribution = (mean, variance) => {
    // Clear points from series.
    cumulativeDistributionSeries.clear()
    probabilityDistributionSeries.clear()
    boxSeries.clear()
    violinSeries.clear()

    // Generate and stream points.
    const probabilityDistributionFunction = probabilityDistribution(mean, variance)
    const cumulativeDistributionFunction = cumulativeDistribution(probabilityDistributionFunction, xBounds.min, xBounds.max, step)
    const streamDuration = 1500
    const streamInterval = 30

    // Reset interval if user isn't up to something.
    if (!axisDistribution.isStopped())
        axisDistribution.setInterval(0, 1.0)

    createProgressiveFunctionGenerator()
        .setSamplingFunction(cumulativeDistributionFunction)
        .setStart(xBounds.min)
        .setEnd(xBounds.max)
        .setStep(step)
        .generate()
        .setStreamBatchSize(1000 * (xBounds.max - xBounds.min) / (step * streamInterval * streamDuration))
        .setStreamInterval(streamInterval)
        .toStream()
        .forEach((point) => cumulativeDistributionSeries.add(point))
    createProgressiveFunctionGenerator()
        .setSamplingFunction(probabilityDistributionFunction)
        .setStart(xBounds.min)
        .setEnd(xBounds.max)
        .setStep(step)
        .generate()
        .setStreamBatchSize(1000 * (xBounds.max - xBounds.min) / (step * streamInterval * streamDuration))
        .setStreamInterval(streamInterval)
        .toStream()
        .forEach((point) => {
            probabilityDistributionSeries.add(point)
            if (point.y >= 0.001)
                // Add mirrored area-point to violin point
                violinSeries.add({
                    position: point.x,
                    high: 1.0 + point.y / 2,
                    low: 1.0 - point.y / 2
                })
        })

    // Add box figure after streaming points.
    setTimeout(() => {
        // Find quartile values using cumulative distribution function.
        const q1 = findQuartileX(0.25, cumulativeDistributionFunction, xBounds.min, xBounds.max, step)
        const q2 = findQuartileX(0.50, cumulativeDistributionFunction, xBounds.min, xBounds.max, step)
        const q3 = findQuartileX(0.75, cumulativeDistributionFunction, xBounds.min, xBounds.max, step)
        const iqr = q3 - q1
        const boxSeriesDimensions = {
            // Purely visual 'Y' -dimensions
            start: 0.90,
            end: 1.10,
            // Actual data -dimensions along 'X' -axis
            lowerExtreme: q1 - 1.5 * iqr,
            lowerQuartile: q1,
            median: q2,
            upperQuartile: q3,
            upperExtreme: q3 + 1.5 * iqr
        }
        boxSeries.add(boxSeriesDimensions)
    }, streamDuration)
}
//#endregion

graphDistribution(0, 1)

// Add LegendBox as part of chart.
const legend = chart.addLegendBox(LegendBoxBuilders.HorizontalLegendBox, { x: chart.uiScale.x, y: chart.pixelScale.y })
    .setOrigin(UIOrigins.LeftBottom)
    .setPosition({ x: 15, y: 250 })
    .setDraggingMode(UIDraggingModes.freelyDraggable)
legend.add(chart, 'Series')

cumulativeDistributionSeries.setResultTableFormatter((tableBuilder, rangeSeries, position, high, low) => {
    const x = (position.toFixed(2) == '-0.00') ? '0.00' : position.toFixed(2);
    return tableBuilder
        .addRow('Simulated Cumulative Distribution')
        .addRow('Position ' + x)
        .addRow('High ' + high.toFixed(2))
        .addRow('Base ' + low.toFixed(2))
})
probabilityDistributionSeries.setResultTableFormatter((tableBuilder, rangeSeries, position, high, low) => {
    const x = (position.toFixed(2) == '-0.00') ? '0.00' : position.toFixed(2);
    return tableBuilder
        .addRow('Probability Distribution')
        .addRow('Position ' + x)
        .addRow('Value ' + high.toFixed(2))
        .addRow('Base ' + low.toFixed(2))
})
violinSeries.setResultTableFormatter((tableBuilder, rangeSeries, position, high, low) => {
    const x = (position.toFixed(2) == '-0.00') ? '0.00' : position.toFixed(2);
    return tableBuilder
        .addRow('Violin')
        .addRow('Position ' + x)
        .addRow('Value ' + high.toFixed(2))
        .addRow('Low ' + low.toFixed(2))
})
