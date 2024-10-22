import React, { useState } from 'react';
import axios from 'axios';
import Anthropic from '@anthropic-ai/sdk';

const models = [
  { name: 'Llama 3 Groq 70B Tool Use', key: 'LLAMA', color: '#007AFF' },
  { name: 'ChatGPT 4.0', key: 'CHATGPT', color: '#34C759' },
  { name: 'Claude 3.5 Sonnet', key: 'CLAUDE', color: '#5856D6' },
  { name: 'Gemini 1.5 PRO', key: 'GEMINI', color: '#FF9500' },
];

function App() {
  const [selectedModel, setSelectedModel] = useState(models[0]);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [apiCosts, setApiCosts] = useState({
    LLAMA: 0,
    CHATGPT: 0,
    CLAUDE: 0,
    GEMINI: 0,
  });

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { role: "user", content: input };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');

    try {
      const response = await callApi(selectedModel.key, updatedMessages);
      const botMessage = { role: "assistant", content: response.message };
      setMessages([...updatedMessages, botMessage]);

      setApiCosts(prevCosts => ({
        ...prevCosts,
        [selectedModel.key]: prevCosts[selectedModel.key] + response.cost,
      }));
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = { role: "assistant", content: `Error: ${error.message}` };
      setMessages([...updatedMessages, errorMessage]);
    }
  };

  const callApi = async (modelKey, messageHistory) => {
    const apiKey = import.meta.env[`VITE_${modelKey}_API_KEY`];
    const pricePerMillion = parseFloat(import.meta.env[`VITE_${modelKey}_PRICE_PER_MILLION`]);
    let response, tokenCount;

    try {
      switch (modelKey) {
        case 'LLAMA':
          response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: "llama3-groq-70b-8192-tool-use-preview",
            messages: messageHistory,
            temperature: 0.5,
            max_tokens: 4096,
          }, {
            headers: { 
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            }
          });
          console.log('Llama response:', response.data);
          tokenCount = response.data.usage.total_tokens;
          return {
            message: response.data.choices[0].message.content,
            cost: (tokenCount / 1000000) * pricePerMillion,
          };

        case 'CHATGPT':
          response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: "gpt-4",
            messages: messageHistory,
          }, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
          });
          tokenCount = response.data.usage.total_tokens;
          return {
            message: response.data.choices[0].message.content,
            cost: (tokenCount / 1000000) * pricePerMillion,
          };

        case 'CLAUDE':
          const anthropic = new Anthropic({
            apiKey: apiKey,
            dangerouslyAllowBrowser: true // Allow usage in browser
          });
          response = await anthropic.messages.create({
            model: "claude-3-sonnet-20240229",
            max_tokens: 1000,
            temperature: 0.3,
            messages: messageHistory
          });
          console.log('Claude response:', response);
          tokenCount = response.usage.input_tokens + response.usage.output_tokens;
          return {
            message: response.content[0].text,
            cost: (tokenCount / 1000000) * pricePerMillion,
          };

        case 'GEMINI':
          // Convert messages to Gemini's expected format
          const geminiMessages = messageHistory.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
          }));
          
          response = await axios.post('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent', {
            contents: geminiMessages,
          }, {
            params: { key: apiKey },
            headers: { 'Content-Type': 'application/json' }
          });
          
          console.log('Gemini response:', response.data);
          
          // Estimate token count (Gemini doesn't provide this directly)
          tokenCount = messageHistory.reduce((acc, msg) => acc + msg.content.length, 0) * 1.3;
          
          return {
            message: response.data.candidates[0].content.parts[0].text,
            cost: (tokenCount / 1000000) * pricePerMillion,
          };

        default:
          throw new Error('Invalid model selected');
      }
    } catch (error) {
      console.error(`Error in ${modelKey} API call:`, error.response ? error.response.data : error.message);
      throw new Error(`Failed to get response from ${modelKey}: ${error.response ? JSON.stringify(error.response.data) : error.message}`);
    }
  };

  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      maxWidth: '900px',
      margin: '0 auto',
      padding: '10px',
      backgroundColor: '#F5F5F7'
    }}>
      <div style={{
        backgroundColor: '#000000',
        color: '#FFFFFF',
        padding: '10px',
        borderRadius: '12px',
        marginBottom: '20px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        <h1 style={{
          fontSize: '30px',
          fontWeight: '600',
          textAlign: 'center',
          margin: '0'
        }}>Chat UI</h1>
        <div style={{
          display: 'flex',
          justifyContent: 'space-around',
          flexWrap: 'wrap'
        }}>
          {models.map(model => (
            <div key={model.key} style={{
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              padding: '10px',
              borderRadius: '8px',
              textAlign: 'center',
              minWidth: '100px',
              margin: '5px',
              cursor: 'pointer',
              border: selectedModel.key === model.key ? `2px solid ${model.color}` : 'none'
            }} onClick={() => setSelectedModel(model)}>
              <div style={{ fontSize: '14px', marginBottom: '5px' }}>{model.name}</div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: model.color }}>
                ${apiCosts[model.key].toFixed(6)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{
        height: '400px',
        overflowY: 'auto',
        border: '1px solid #D1D1D6',
        borderRadius: '12px',
        padding: '15px',
        marginBottom: '20px',
        backgroundColor: '#FFFFFF'
      }}>
        {messages.map((message, index) => (
          <div key={index} style={{
            padding: '10px',
            marginBottom: '10px',
            borderRadius: '8px',
            backgroundColor: message.role === 'user' ? '#007AFF' : '#E9E9EB',
            color: message.role === 'user' ? '#FFFFFF' : '#000000',
            textAlign: message.role === 'user' ? 'right' : 'left'
          }}>
            {message.content}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type your message..."
          style={{
            flexGrow: 1,
            marginRight: '10px',
            padding: '12px',
            fontSize: '16px',
            borderRadius: '8px',
            border: '1px solid #D1D1D6',
            backgroundColor: '#FFFFFF'
          }}
        />
        <button 
          onClick={sendMessage}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            fontWeight: '500',
            backgroundColor: '#007AFF',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default App;
