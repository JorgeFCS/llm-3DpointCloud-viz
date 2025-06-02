import React from 'react';

function createColorGradientCSS(interpolator, steps = 20) {
    const colorStops = Array.from({ length: steps }, (_, i) => {
        const t = i / (steps - 1);
        return `${interpolator(t)} ${Math.round(t * 100)}%`;
    });
    return `linear-gradient(to right, ${colorStops.join(', ')})`;
}

const ColorBar = ({ colormapName, min, max, mid = 0, mode = "sequential" }) => {
    const isDiverging = mode === "diverging";
    
    const gradient = createColorGradientCSS(colormapName);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 10 }}>
            <div style={{
                background: gradient,
                width: '100%',
                height: '20px',
                marginBottom: 5,
                border: '1px solid #ccc'
            }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '0.8em' }}>
                <span>{min.toFixed(2)}</span>
                {isDiverging && <span>{mid.toFixed(2)}</span>}
                <span>{max.toFixed(2)}</span>
            </div>
        </div>
    );
};

export default ColorBar;