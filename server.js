const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
const port = 4000;

// Middleware to parse JSON requests
app.use(bodyParser.json());

// WAHA API configuration
const wahaApiUrl = 'http://localhost:3000'; // Ganti dengan URL WAHA API Anda

// Function to send a text message via WAHA API
const sendText = async (chatId, text) => {
  try {
    const response = await axios.post(
      `${wahaApiUrl}/api/sendText`,
      {
        chatId,
        text,
        session: 'default' // Sesuaikan dengan session yang Anda gunakan
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('Message sent:', response.data); // Log response from WAHA API
    return response.data;
  } catch (error) {
    console.error('Error sending message:', error.response ? error.response.data : error.message);
    throw error;
  }
};

// Endpoint to handle incoming message webhook
app.post('/webhook', async (req, res) => {
  const webhookData = req.body;
  console.log('Received message webhook:', webhookData);

  // Log seluruh payload untuk memeriksa struktur data
  console.log('Payload:', JSON.stringify(webhookData, null, 2));

  // Extract message details
  const { from, body } = webhookData.payload;

  console.log('Received message from:', from);
  console.log('Message Body:', body);

  // Balas pesan sesuai dengan isi pesan yang diterima
  let replyText;
  if (body.toLowerCase().includes('hello')) {
    replyText = 'Hello! How can I assist you today?';
  } else if (body.toLowerCase().includes('help')) {
    replyText = 'Here are some commands you can use: "status", "info", "contact".';
  } else if (body.toLowerCase().includes('hadir')) {
    replyText = 'Terima kasih atas konfirmasinya. Anda telah tercatat hadir.';
  } else {
    replyText = `You said: "${body}". Please let me know if you need help.`;
  }

  // Log balasan yang akan dikirim
  console.log('Reply text:', replyText);

  // Balas pesan sesuai dengan isi pesan
  try {
    await sendText(from, replyText);
    res.status(200).send('Message received and replied successfully');
  } catch (error) {
    res.status(500).send('Failed to send reply');
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
