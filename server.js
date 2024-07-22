const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();
const port = 4000;

// Middleware to parse JSON requests
app.use(bodyParser.json());

// WAHA API configuration
const wahaApiUrl = 'http://localhost:3000'; // Ganti dengan URL WAHA API Anda

// Variabel untuk menyimpan detail pesan terakhir
let lastMessageDetails = {
  chatId: null,
  messageId: null,
  from: null
};

// Function to send a reply via WAHA API
const sendReply = async (chatId, replyTo, text) => {
  try {
    const response = await axios.post(
      `${wahaApiUrl}/api/reply`,
      {
        chatId,
        reply_to: replyTo,
        text,
        session: 'default' // Sesuaikan dengan session yang Anda gunakan
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error sending reply:', error);
    throw error;
  }
};

// Endpoint to handle session status webhook
app.post('/webhook/session-status', (req, res) => {
  const webhookData = req.body;
  console.log('Received session status webhook:', webhookData);
  res.status(200).send('Session status received successfully');
});

// Endpoint to handle incoming message webhook
app.post('/webhook/message', async (req, res) => {
  const webhookData = req.body;
  console.log('Received message webhook:', webhookData);

  const { from, id, body } = webhookData.payload;

  // Simpan detail pesan terakhir
  lastMessageDetails = {
    chatId: from,
    messageId: id,
    from
  };

  // Periksa isi pesan dan balas sesuai dengan pilihan
  let replyText;
  if (body.toLowerCase() === 'hadir') {
    replyText = 'Terima kasih! Anda telah tercatat hadir.';
  } else if (body.toLowerCase() === 'tidak hadir') {
    replyText = 'Terima kasih! Anda telah tercatat tidak hadir.';
  } else {
    replyText = 'Silakan balas dengan "Hadir" atau "Tidak Hadir".';
  }

  // Balas pesan sesuai dengan pilihan
  try {
    await sendReply(lastMessageDetails.chatId, lastMessageDetails.messageId, replyText);
    res.status(200).send('Message received and replied successfully');
  } catch (error) {
    res.status(500).send('Failed to send reply');
  }
});

// Endpoint untuk membalas pesan terakhir secara manual
app.post('/send-reply', async (req, res) => {
  try {
    await sendReply(lastMessageDetails.chatId, lastMessageDetails.messageId, 'Ini adalah balasan otomatis!');
    res.status(200).send('Reply sent successfully');
  } catch (error) {
    res.status(500).send('Failed to send reply');
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
