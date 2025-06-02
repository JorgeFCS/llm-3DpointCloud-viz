import * as THREE from 'three';
import { scaleDiverging, scaleSequential, scaleOrdinal } from 'd3-scale';
import { interpolateRdBu } from 'd3-scale-chromatic';

/**
 * Computes a percentile using linear interpolation.
 */
function getPercentile(data, percentile) {
    const sorted = Float32Array.from(data).sort();
    const index = (percentile / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Returns a Float32BufferAttribute of RGB colors based on a scalar attribute.
 * 
 * @param {Float32Array} attributeArray - Raw scalar attribute (e.g., 'attributions')
 * @param {Object} options - Configuration
 * @param {boolean} options.absolute - If true, use the absolute value of the values
 * @param {number} options.percentileLow - e.g. 1
 * @param {number} options.percentileHigh - e.g. 99
 * @param {number} options.midpoint - e.g. 0
 * @param {function|string[]} options.colormap - d3 interpolator (e.g. interpolateRdBu) or categorical palette
 * @param {"sequential"|"diverging"|"qualitative"} options.mode - type of colormap
 */
export function colorizeByAttribute(attributeArray, {
    absolute = false,
    percentileLow = 1,
    percentileHigh = 99,
    midpoint = 0,
    colormap = interpolateRdBu,
    mode = 'diverging'
} = {}) {
    const count = attributeArray.length;
    const colors = new Float32Array(count * 3);

    if (mode === 'qualitative') {
        const classIds = Array.from(new Set(attributeArray)).sort((a, b) => a - b);
        
        // const scale = scaleOrdinal(colormap).domain(classIds);
    
        for (let i = 0; i < count; i++) {
           let color;

           if (colormap instanceof Map){
            color = colormap.get(attributeArray[i]);
            if (!color) {
                console.warn("No color for class: ", attributeArray[i]);
                // Define a fallback color.
                color = new THREE.Color(0.5, 0.5, 0.5); // Grey.
            }
           } else {
            const scale = scaleOrdinal(colormap).domain(classIds);
            const hex = scale(attributeArray[i]);
            color = new THREE.Color(hex);
           }
            colors[i * 3 + 0] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        }
        return new THREE.BufferAttribute(colors, 3);
    }

    // Scalar colormapping: sequential or diverging.
    const raw = absolute ? attributeArray.map(Math.abs): attributeArray;
    //const count = raw.length;
    const min = getPercentile(raw, percentileLow);
    const max = getPercentile(raw, percentileHigh);

    //const scale = scaleDiverging(colormap).domain([min, midpoint, max]);

    const scale = mode === 'diverging'
        ? scaleDiverging(colormap).domain([min, midpoint, max])
        : scaleSequential(colormap).domain([0, max]);

    for (let i = 0; i < count; i++) {
        const val = raw[i];
        const clamped = Math.max(min, Math.min(max, val));
        const color = new THREE.Color(scale(clamped));
        colors[i * 3 + 0] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
    }

    return new THREE.BufferAttribute(colors, 3);
}