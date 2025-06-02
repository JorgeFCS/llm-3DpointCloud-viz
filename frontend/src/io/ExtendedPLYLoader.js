import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader';
import * as THREE from 'three';

export class ExtendedPLYLoader extends PLYLoader {
    parse(text) {
        // Handle both BufferSource or decoded string.
        const lines = (typeof text === 'string' ? text : new TextDecoder().decode(text)).split('\n');
        let headerEnded = false;
        const headerLines = [];
        const dataLines = [];

        for (const line of lines) {
            if (!headerEnded) {
                headerLines.push(line);
                if (line.trim() === 'end_header') headerEnded = true;
            } else {
                dataLines.push(line);
            }
        }

        const propertyNames = [];
        for (const line of headerLines) {
            const tokens = line.trim().split(/\s+/);
            if (tokens[0] === 'property' && tokens.length === 3) {
                propertyNames.push(tokens[2]); // e.g., "x", "y", ..., "attributions".
            }
        }

        const columns = propertyNames.length;

        const parsedValues = dataLines
            .map(line => line.trim().split(/\s+/).map(Number))
            .filter(arr => arr.length === propertyNames.length); // Ensure row has expected # of columns.

        const numVertices = parsedValues.length;

        if (numVertices === 0) {
            throw new Error("No valid vertex data parsed from PLY file.");
        }

        const arrays = {};
        for (const name of propertyNames) {
            arrays[name] = new Float32Array(numVertices);
        }

        for (let i = 0; i < numVertices; i++) {
            const row = parsedValues[i];
            if (!row) continue; // Defensive check.
            for (let j = 0; j < columns; j++) {
                arrays[propertyNames[j]][i] = row[j];
            }
        }

        const geometry = new THREE.BufferGeometry();

        if (arrays.x && arrays.y && arrays.z) {
            const position = new Float32Array(numVertices * 3);
            for (let i = 0; i < numVertices; i++) {
                position[i * 3 + 0] = arrays.x[i];
                position[i * 3 + 1] = arrays.y[i];
                position[i * 3 + 2] = arrays.z[i];
            }
            geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
        }

        if (arrays.red && arrays.green && arrays.blue) {
            const color = new Float32Array(numVertices * 3);
            for (let i = 0; i < numVertices; i++) {
                color[i * 3 + 0] = arrays.red[i] / 255;
                color[i * 3 + 1] = arrays.green[i] / 255;
                color[i * 3 + 2] = arrays.blue[i] / 255;
            }
            geometry.setAttribute('color', new THREE.BufferAttribute(color, 3));
        }

        // Set remaining custom attributes
        for (const name of propertyNames) {
            if (['x', 'y', 'z', 'red', 'green', 'blue', 'alpha'].includes(name)) continue;
            geometry.setAttribute(name, new THREE.BufferAttribute(arrays[name], 1));
        }

        return geometry;
    }
}