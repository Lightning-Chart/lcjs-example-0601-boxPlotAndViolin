/*
 * LightningChartJS example that showcases usage of BoxSeries and RangeSeries to show some made-up statistical graphs.
 */
// Import LightningChartJS
const lcjs = require('@lightningchart/lcjs')

// Import xydata
const xydata = require('@lightningchart/xydata')

// Extract required parts from LightningChartJS.
const {
    emptyLine,
    lightningChart,
    yDimensionStrategy,
    LegendBoxBuilders,
    AxisScrollStrategies,
    AxisTickStrategies,
    AutoCursorModes,
    Themes,
} = lcjs

// Import data-generator from 'xydata'-library.
const { createProgressiveFunctionGenerator } = xydata

// Utilities for graphing distribution functions.
//#region
const cumulativeDistribution = (probabilityDistributionFunction, rangeMin, rangeMax, step) => {
    // Simulate values of respective probability density function.
    const probabilityValues = []
    for (let x = rangeMin; x <= rangeMax; x += step) probabilityValues.push(probabilityDistributionFunction(x))
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
        const xAsIndex = ((x - rangeMin) / (rangeMax - rangeMin)) * ((rangeMax - rangeMin) / step)
        // Pick closest index (left/right) that exists
        const closestIndex = Math.min(Math.max(Math.round(xAsIndex), 0), values.length - 1)
        return values[closestIndex]
    }
}
const findQuartileX = (yToLookFor, cumulativeDistributionFunction, rangeMin, rangeMax, step) => {
    // Iterate over possible 'X' values and pick the one where resulting 'Y' is closest to 'yToLookFor'
    let bestResult
    for (let x = rangeMin; x <= rangeMax; x += step) {
        const y = cumulativeDistributionFunction(x)
        const delta = Math.abs(y - yToLookFor)
        if (bestResult === undefined || delta < bestResult.delta) bestResult = { x, delta }
        else if (bestResult !== undefined && delta > bestResult.delta) break
    }
    return bestResult.x
}
const probabilityDistribution = (mean, variance) => (x) =>
    (1 / (variance * Math.sqrt(2 * Math.PI))) * Math.pow(Math.E, -Math.pow(x - mean, 2) / (2 * variance * variance))
//#endregion

// Make chart with series graphing standard probability density and cumulative distribution functions.
const chart = lightningChart({
            resourcesBaseUrl: new URL(document.head.baseURI).origin + new URL(document.head.baseURI).pathname + 'resources/',
        })
    .ChartXY({
        theme: Themes[new URLSearchParams(window.location.search).get('theme') || 'darkGold'] || undefined,
    })
    .setTitle('Probability distribution + Simulated accumulation and BoxSeries')
    .setCursorMode('show-pointed')
    .setPadding({ right: 20 })

const xBounds = { min: -4, max: 4 }
const step = 0.02
// Setup axes.
const axisDistribution = chart.getDefaultAxisY()
const axisNormalized = chart.addAxisY()
const axisX = chart
    .getDefaultAxisX()
    .setInterval({ start: xBounds.min, end: xBounds.max, stopAxisAfter: false })
    .setScrollStrategy(undefined)

// Set up the Distribution Axis.
axisDistribution
    .setTitle('Distribution function')
    .setScrollStrategy(AxisScrollStrategies.expansion)
    // Modify the TickStrategy to remove gridLines from this Y Axis.
    .setTickStrategy(
        // Use Numeric TickStrategy as base.
        AxisTickStrategies.Numeric,
        // Use mutator to modify the TickStrategy.
        (tickStrategy) =>
            tickStrategy
                // Modify Major Tick Style by using a mutator.
                .setMajorTickStyle((tickStyle) => tickStyle.setGridStrokeStyle(emptyLine))
                // Modify Minor Tick Style by using a mutator.
                .setMinorTickStyle((tickStyle) => tickStyle.setGridStrokeStyle(emptyLine)),
    )

// Set up the Normalized Axis.
axisNormalized
    .setTitle('Accumulated distribution (%)')
    .setInterval({ start: 0, end: 1, stopAxisAfter: false })
    .setScrollStrategy(undefined)
    // Modify the TickStrategy to remove gridLines from this Y Axis.
    .setTickStrategy(
        // Use Numeric TickStrategy as base.
        AxisTickStrategies.Numeric,
        // Use mutator to modify the TickStrategy.
        (tickStrategy) =>
            tickStrategy
                // Modify Major Tick Style by using a mutator.
                .setMajorTickStyle((tickStyle) => tickStyle.setGridStrokeStyle(emptyLine))
                // Modify Minor Tick Style by using a mutator.
                .setMinorTickStyle((tickStyle) => tickStyle.setGridStrokeStyle(emptyLine)),
    )

// Cumulative distribution.
const cumulativeDistributionSeries = chart.addAreaSeries({ yAxis: axisNormalized }).setName('Simulated Cumulative Distribution')

// Probability distribution.
const probabilityDistributionSeries = chart.addAreaSeries({ yAxis: axisDistribution }).setName('Probability Distribution')

// 'Violin' series.
const violinSeries = chart.addAreaRangeSeries({ yAxis: axisDistribution }).setName('Violin')

// Box series.
const boxSeries = chart.addBoxSeries({ yAxis: axisDistribution, dimensionStrategy: yDimensionStrategy }).setName('Box')

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
    if (!axisDistribution.getStopped()) axisDistribution.setInterval({ start: 0, end: 1.0, stopAxisAfter: false })

    createProgressiveFunctionGenerator()
        .setSamplingFunction(cumulativeDistributionFunction)
        .setStart(xBounds.min)
        .setEnd(xBounds.max)
        .setStep(step)
        .generate()
        .setStreamBatchSize((1000 * (xBounds.max - xBounds.min)) / (step * streamInterval * streamDuration))
        .setStreamInterval(streamInterval)
        .toStream()
        .forEach((point) => cumulativeDistributionSeries.add(point))
    createProgressiveFunctionGenerator()
        .setSamplingFunction(probabilityDistributionFunction)
        .setStart(xBounds.min)
        .setEnd(xBounds.max)
        .setStep(step)
        .generate()
        .setStreamBatchSize((1000 * (xBounds.max - xBounds.min)) / (step * streamInterval * streamDuration))
        .setStreamInterval(streamInterval)
        .toStream()
        .forEach((point) => {
            probabilityDistributionSeries.add(point)
            if (point.y >= 0.001)
                // Add mirrored area-point to violin point
                violinSeries.add({
                    position: point.x,
                    high: 1.0 + point.y / 2,
                    low: 1.0 - point.y / 2,
                })
        })

    // Add box figure after streaming points.
    setTimeout(() => {
        // Find quartile values using cumulative distribution function.
        const q1 = findQuartileX(0.25, cumulativeDistributionFunction, xBounds.min, xBounds.max, step)
        const q2 = findQuartileX(0.5, cumulativeDistributionFunction, xBounds.min, xBounds.max, step)
        const q3 = findQuartileX(0.75, cumulativeDistributionFunction, xBounds.min, xBounds.max, step)
        const iqr = q3 - q1
        const boxSeriesDimensions = {
            // Purely visual 'Y' -dimensions
            start: 0.9,
            end: 1.1,
            // Actual data -dimensions along 'X' -axis
            lowerExtreme: q1 - 1.5 * iqr,
            lowerQuartile: q1,
            median: q2,
            upperQuartile: q3,
            upperExtreme: q3 + 1.5 * iqr,
        }
        boxSeries.add(boxSeriesDimensions)
    }, streamDuration)
}
//#endregion

graphDistribution(0, 1)

// Add LegendBox as part of chart.
const legend = chart
    .addLegendBox(LegendBoxBuilders.HorizontalLegendBox)
    // Dispose example UI elements automatically if they take too much space. This is to avoid bad UI on mobile / etc. devices.
    .setAutoDispose({
        type: 'max-width',
        maxWidth: 0.8,
    })
legend.add(chart)
