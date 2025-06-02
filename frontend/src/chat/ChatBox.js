import React, { useState } from 'react';
import { Card, Form, Button, ListGroup, Spinner } from 'react-bootstrap';

const ChatBox = ({ csvName, setPlotConfig, onRequestPlotFromGeometry }) => {
  const [messages, setMessages] = useState([
    { sender: 'bot', text: 'Ask a question about your point cloud!' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [threadId, setThreadId] = useState(null);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userText = input;
    setMessages([...messages, { sender: 'user', text: userText}]);
    setInput('');
    setLoading(true);
    
    try{

      const requestBody = {
        csv_name: csvName,
        question: userText,
        ...(threadId ? { thread_id: threadId } : {})
      };

      const response = await fetch("http://localhost:8000/api/analyze", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (data.error) {
        setMessages((msgs) => [
          ...msgs,
          { sender: 'bot', text: `Error: ${data.details || data.error}`}
        ]);
      } else {
        setMessages((msgs) => [
          ...msgs,
          {
            // Sets the message in the chat.
            sender: 'bot',
            text: `${data.explanation}`
          }
        ]);

        if (data.type === "plot") {
          // Ensure a consistent unique ID for the plot.
          const plotData = {
            ...data.config,
            id: `${data.plot_type}-${data.config.x}`,
            type: data.plot_type
          };
          setPlotConfig(plotData);
          onRequestPlotFromGeometry(plotData);
        }

        // Store the thread ID to enable follow-up questions.
        if (data.thread_id && !threadId) {
          setThreadId(data.thread_id);
        }
      }
    } catch (e) {
      setMessages((msgs) => [
        ...msgs,
        { sender: 'bot', text: `Failed to fetch response.`},
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Card className="mt-4 d-flex flex-column" style={{height: '660px', padding: 0 }}>
      <Card.Header>Chat</Card.Header>
      {/* Scrollable message list */}
      <Card.Body style={{ overflowY: 'auto' }} className="flex-grow-1 px-3">
        <ListGroup variant="flush">
          {messages.map((msg, i) => (
            <ListGroup.Item
              key={i}
              className={msg.sender === 'user' ? 'text-end bg-light' : ''}
            >
              <strong>{msg.sender === 'user' ? 'You' : 'Assistant'}:</strong>
              <pre style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</pre>
            </ListGroup.Item>
          ))}
          { loading && (
            <ListGroup.Item>
              <Spinner animation="border" size="sm" /> Processing...
            </ListGroup.Item>
          )}
        </ListGroup>
      </Card.Body>

      {/* Input fixed at bottom */}
      <Card.Footer>
        <Form className="d-flex">
            <Form.Control
              as="textarea"
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              disabled={!csvName}
            />
            <Button className="ms-2" onClick={handleSend} disabled={loading || !csvName} title={!csvName ? "Upload a point cloud fist!" : ""}>
              Send
            </Button>
          </Form>
      </Card.Footer>
    </Card>
  );
};

export default ChatBox;