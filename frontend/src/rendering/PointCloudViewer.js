import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { Card, Form, Container, Row, Col, Button } from 'react-bootstrap';
import * as THREE from 'three';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls';
import { interpolateInferno, interpolateRdBu, schemeObservable10, interpolateViridis } from 'd3-scale-chromatic';
import { quantileSorted } from 'd3-array';

import { colorizeByAttribute } from '../utils/colorizeByAttribute';
// Works for custom attributes, only for ASCII PLY files.
import { ExtendedPLYLoader } from '../io/ExtendedPLYLoader';
import GeomHistogram from '../chart/GeomHistogram';
import ColorBar from './ColorBar';

const PointCloudViewer = forwardRef(({ setCsvName, plotConfigs, setPlotConfig, removePlotConfig }, ref) => {
    const mountRef = useRef();
    const sceneRef = useRef();
    const rendererRef = useRef();
    const controlsRef = useRef();
    const pointCloudRef = useRef();

    const [fileURL, setFileURL] = useState(null);
    const [loadedGeometry, setLoadedGeometry] = useState(null);
    const [colorMode, setColorMode] = useState("rgb");
    const [colormapMode, setColorMap] = useState("rdbu"); // Or rdbu
    const [pointSize, setPointSize] = useState(0.02);
    const [classColorMap, setClassColorMap] = useState(new Map());
    const [colorBarRange, setColorBarRange] = useState(null);

    const classLabelMap = {
        0: 'Ceiling',
        1: 'Floor',
        2: 'Wall',
        3: 'Beam',
        4: 'Column',
        5: 'Window',
        6: 'Door',
        7: 'Table',
        8: 'Chair',
        9: 'Sofa',
        10: 'Bookcase',
        11: 'Board',
        12: 'Clutter'
    };

    const pointMaterial = useRef(new THREE.PointsMaterial({
        size: pointSize,
        vertexColors: true,
        sizeAttenuation: true
    }));

    useEffect(() => {
        return () => {
            pointMaterial.current.dispose();
        };
    }, [pointMaterial]);

    useEffect(() => {
        pointMaterial.current.size = pointSize;
    }, [pointSize]);

    // File change handler.
    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file || !file.name.endsWith('.ply')) return;

        // Send file to FastAPI for cleaning and server-side saving.
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('http://localhost:8000/api/upload', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const data = await response.json();
            // Rendering the point cloud.
            const fileURL = URL.createObjectURL(file);
            setFileURL(fileURL);
            const csvFileName = data.file_path?.split('/').pop();
            if (csvFileName) setCsvName(csvFileName);
        } else {
            console.error("File upload failed.");
        }
    };

    // Initializing scene and renderer.
    useEffect(() => {
        const mount = mountRef.current;
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xffffff);
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
        camera.position.z = 2;

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        mount.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        const controls = new TrackballControls(camera, renderer.domElement);
        controls.rotateSpeed = 1.0;
        controls.zoomSpeed = 0.5;
        controls.panSpeed = 0.2;
        controls.noZoom = false;
        controls.noPan = false;
        controls.staticMoving = false;
        controls.dynamicDampingFactor = 0.15;
        controlsRef.current = controls;

        const resize = () => {
            const width = mount.clientWidth;
            const height = mount.clientHeight;
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height, false); // `false` keeps canvas style from being overwritten.
        };

        const resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(mount);
        resize(); // Initial resize.

        const animate = () => {
            requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        };
        animate();

        return () => {
            resizeObserver.disconnect();
            renderer.dispose();
            if (mount.contains(renderer.domElement)) {
                mount.removeChild(renderer.domElement);
            }
            controls.dispose();
        };
    }, []);

    // Loading PLY file.
    useEffect(() => {
        if (!fileURL) return;

        const loader = new ExtendedPLYLoader();
        loader.load(fileURL, geometry => {
            geometry.computeVertexNormals();
            setLoadedGeometry(geometry);
        });
    }, [fileURL]);

    // Updating point cloud color.
    useEffect(() => {
        if (!loadedGeometry || !sceneRef.current) return;

        const geometry = loadedGeometry.clone();

        if (colorMode === "attributions") {
            const attributions = geometry.attributes.scalar_attributions;

            if (!attributions) {
                console.warn("No 'attributions' attribute found.");
                return;
            }

            const colorAttribute = colorizeByAttribute(attributions.array, {
                absolute: colormapMode === "inferno" ? true : false,
                percentileLow: 1,
                percentileHigh: 99,
                midpoint: 0,
                colormap: colormapMode === "inferno" ? interpolateInferno : interpolateRdBu,
                mode: colormapMode === "inferno" ? "sequential" : "diverging"
            });

            geometry.setAttribute('color', colorAttribute);

            // For the color bar.
            const values = attributions.array;
            const sorted = [...values].sort((a, b) => a - b);
            const min = quantileSorted(sorted, 0.01);
            const max = quantileSorted(sorted, 0.99);
            const mid = 0;
            const colorBarMode = colormapMode === "inferno" ? "sequential" : "diverging";
            setColorBarRange({ min, mid, max, mode: colorBarMode });

        } else if (colorMode === "class" || colorMode === "ground_truth") {
            const classes = geometry.attributes.scalar_class;
            const groundTruth = geometry.attributes.scalar_ground_truth;
            
            const chosenLabels = colorMode === "class"
                ? classes
                : groundTruth;
            if (!chosenLabels) {
                console.warn("No 'class' or 'ground_truth' attribute found.");
                return;
            }

            // Creating a consistent colormap for both class and ground truth labels.
            const classValues = new Set([
                ...Array.from(classes?.array || []),
                ...Array.from(groundTruth?.array || [])
            ]);

            const sortedClasses = Array.from(classValues).sort((a, b) => a - b);

            // Class to color mapping.
            const classToColor = new Map();
            sortedClasses.forEach((cls, i) => {
                const color = schemeObservable10[i % schemeObservable10.length];
                classToColor.set(cls, new THREE.Color(color));
            });

            // For showing the class mapping in the UI.
            setClassColorMap(classToColor);

            const colorAttribute = colorizeByAttribute(chosenLabels.array, {
                colormap: classToColor,
                mode: "qualitative"
            });

            geometry.setAttribute('color', colorAttribute);
        } else if (colorMode === "curvature") {
            const curvatureVals = geometry.attributes.scalar_curvature;

            if (!curvatureVals) {
                console.warn("No 'curvature' attribute found.");
                return;
            }

            const colorAttribute = colorizeByAttribute(curvatureVals.array, {
                absolute: false,
                percentileLow: 1,
                percentileHigh: 99,
                midpoint: 0,
                colormap: interpolateViridis,
                mode: "sequential"
            });

            geometry.setAttribute('color', colorAttribute);

            // For the color bar.
            const values = curvatureVals.array;
            const sorted = [...values].sort((a, b) => a - b);
            const min = quantileSorted(sorted, 0.01);
            const max = quantileSorted(sorted, 0.99);
            const mid = 0;
            const colorBarMode = "sequential"
            setColorBarRange({ min, mid, max, mode: colorBarMode });
        } else if (colorMode === "rgb" && geometry.attributes.color) {
            geometry.setAttribute('color', geometry.attributes.color.clone());
        }

        const points = new THREE.Points(geometry, pointMaterial.current);
        if (pointCloudRef.current) {
            sceneRef.current.remove(pointCloudRef.current);
            pointCloudRef.current.geometry.dispose();
        }

        pointCloudRef.current = points;
        sceneRef.current.add(points);
    }, [loadedGeometry, pointMaterial, colorMode, colormapMode]);

    // Extracting point cloud data for the plot(s).
    const extractPointCloudData = (geometry) => {
        if (!geometry || !geometry.attributes.position) return [];

        const count = geometry.attributes.position.count;
        const result = [];

        for (let i = 0; i < count; i++) {
            const point = {
                x: geometry.attributes.position.array[i * 3],
                y: geometry.attributes.position.array[i * 3 + 1],
                z: geometry.attributes.position.array[i * 3 + 2],
            };

            if (geometry.attributes.color) {
                point.r = geometry.attributes.color.array[i * 3];
                point.g = geometry.attributes.color.array[i * 3 + 1];
                point.b = geometry.attributes.color.array[i * 3 + 2];
            }

            if (geometry.attributes.scalar_attributions)
                point.attributions = geometry.attributes.scalar_attributions.array[i];

            if (geometry.attributes.scalar_curvature)
                point.curvature = geometry.attributes.scalar_curvature.array[i];

            if (geometry.attributes.scalar_class)
                point.class = geometry.attributes.scalar_class.array[i];

            if (geometry.attributes.scalar_ground_truth)
                point.ground_truth = geometry.attributes.scalar_ground_truth.array[i];

            result.push(point);
        }

        return result;
    };

    useImperativeHandle(ref, () => ({
        generatePlotFromGeometry: (plotRequest) => {
            const data = extractPointCloudData(loadedGeometry);
            if (!data.length) return;

            const plot = {
                id: plotRequest.id,
                data,
                config: {
                    "x": plotRequest.x,
                    "y": plotRequest.y,
                    "xLabel": plotRequest.xLabel,
                    "yLabel": plotRequest.yLabel
                }
            };
        
            setPlotConfig(plot);
        }
      }));

    return (
        <Card className="mt-4 d-flex flex-column" style={{ height: '660px', padding: 0 }}>
            <Card.Header>
                <Container fluid>
                    <Row>
                        <Col>
                            <Form.Group controlId="fileUpload">
                                <Form.Label>Load Point Cloud (.ply)</Form.Label>
                                <Form.Control type="file" accept=".ply" onChange={handleFileChange} />
                            </Form.Group>
                        </Col>
                        <Col>
                            <Form.Group controlId="colorMode"> 
                                <Form.Label>Color Mode</Form.Label>
                                <Form.Control as="select" value={colorMode} onChange={(e) => {
                                    const selected = e.target.value;
                                    setColorMode(selected);
                                    if (selected === "curvature") {
                                        setColorMap("viridis");
                                    }
                                    if (selected === "attributions") {
                                        setColorMap("rdbu");
                                    }
                                }}>
                                    <option value="rgb">RGB</option>
                                    <option value="attributions">Saliency</option>
                                    <option value="class">Predicted Class</option>
                                    <option value="ground_truth">Ground Truth</option>
                                    <option value="curvature">Curvature</option>
                                </Form.Control>
                            </Form.Group>
                        </Col>
                        <Col>
                            <Form.Group controlId="colormap">
                                <Form.Label>Saliency Colormap</Form.Label>
                                <Form.Control as="select" value={colormapMode} onChange={(e) => setColorMap(e.target.value)} disabled={colorMode !== "attributions"}>
                                    <option value="rdbu">RdBu (diverging)</option>
                                    <option value="inferno">Inferno (sequential)</option>
                                </Form.Control>
                            </Form.Group>
                        </Col>
                        <Col>
                            <Form.Group controlId="pointSizeSlider">
                                <Form.Label>Point Size</Form.Label>
                                <Form.Range
                                    min={.005}
                                    max={0.1}
                                    step={.001}
                                    value={pointSize}
                                    onChange={(e) => setPointSize(parseFloat(e.target.value))}
                                />
                                <div>{pointSize.toFixed(3)}</div>
                            </Form.Group>
                        </Col>
                    </Row>
                </Container>
            </Card.Header>
            <Card.Body style={{ height: '100%' }}>
                <Container fluid style={{ height: '100%' }}>
                    <Row style={{ height: '100%' }}>
                        <Col>
                            {(colorMode === "attributions" || colorMode === "curvature") && colorBarRange && (
                                <ColorBar
                                    colormapName={
                                        colormapMode === 'inferno' ? interpolateInferno :
                                        colormapMode === 'rdbu' ? interpolateRdBu :
                                        interpolateViridis
                                    }
                                    min={colorBarRange.min}
                                    max={colorBarRange.max}
                                    mid={colorBarRange.mid}
                                    mode={colorBarRange.mode}
                                />
                            )}
                            {(colorMode === "class" || colorMode === "ground_truth") && (
                                <div style={{overflowY: 'auto'}}>
                                    {[...classColorMap.entries()].map(([cls, color]) => (
                                        <div key={cls} style={{display: 'flex', alignItems: 'center'}}>
                                            <div
                                                style={{
                                                    backgroundColor: `rgb(${color.r * 255}, ${color.g * 255}, ${color.b * 255})`,
                                                    width: 10,
                                                    height: 20,
                                                    marginRight: 1,
                                                    border: '1px solid #ccc'
                                                }}
                                            />
                                            <span className="fs-6">{classLabelMap[cls] ?? `${cls}`}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Col>
                        <Col md={6}>
                            <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
                        </Col>
                        <Col md={4} style={{ overflow: 'auto' }}>
                            <div style={{ width: "100%", height: "100%" }}>
                                {plotConfigs.map((plot) => (
                                    <Card key={plot.id} style={{ width: '100%' }}>
                                        <Card.Body>
                                            <Card.Title>
                                                {plot.config?.xLabel || plot.config?.x}
                                            </Card.Title>
                                            <GeomHistogram
                                                dataset={plot.data}
                                                config={plot.config}
                                                dimensions={{}}
                                            />
                                            <div className="my-2" />
                                            <Button
                                                size="sm"
                                                variant="danger"
                                                onClick={() => removePlotConfig(plot.id)}
                                            >
                                                Remove
                                            </Button>
                                        </Card.Body>
                                    </Card>
                                ))}
                            </div>
                        </Col>
                    </Row>
                </Container>
            </Card.Body>
        </Card>
    );
});

export default PointCloudViewer;