//import logo from './logo.svg';
import './App.css';
import { Container, Row, Col } from 'react-bootstrap';
import { useState, useRef } from 'react';


import PointCloudViewer from './rendering/PointCloudViewer';
import ChatBox from './chat/ChatBox';

function App() {
  const [csvName, setCsvName] = useState(null);
  const [plotConfigs, setPlotConfigs] = useState([]);

  const viewerRef = useRef();

  // Adding or updating plots, based on plot ID.
  const setPlotConfig = (newPlot) => {
    setPlotConfigs((prev) => {
      const index = prev.findIndex(p => p.id === newPlot.id);
      const updated = index !== -1
        ? [...prev.slice(0, index), newPlot, ...prev.slice(index + 1)]
        : [...prev, newPlot];
      return updated;
    });
  };

  // Removing a plot by ID.
  const removePlotConfig = (id) => {
    setPlotConfigs((prev) => prev.filter(p => p.id !== id));
  };

  // Handling a request for a plot from ChatBox.
  const handlePlotFromGeometry = (plotRequest) => {
    if (viewerRef.current?.generatePlotFromGeometry) {
      viewerRef.current.generatePlotFromGeometry(plotRequest);
    }
  };

  return (
    <div className="App">
      <Container fluid className="p-2" style={{ height: '100vh' }}>
      <Row>
        <Col className="h-100">
          <ChatBox
            csvName={csvName}
            setPlotConfig={setPlotConfig}
            onRequestPlotFromGeometry={handlePlotFromGeometry}
          />
        </Col>
        <Col md={9}>
          <PointCloudViewer
            ref={viewerRef}
            setCsvName={setCsvName}
            plotConfigs={plotConfigs}
            setPlotConfig={setPlotConfig}
            removePlotConfig={removePlotConfig}
          />
        </Col>
      </Row>
    </Container>
    </div>
  );
}

export default App;
