const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
const port = 4000;

// Middleware to parse JSON requests
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// WAHA API configuration
const wahaApiUrl = 'http://localhost:3000'; // Ganti dengan URL WAHA API Anda

// Your WhatsApp ID (ganti dengan ID WhatsApp Anda)
const yourWhatsAppId = '6283129701774@c.us';

// Global variables for groom, bride names, and date
let globalGroomName = '';
let globalBrideName = '';
let globalDate = '';
let globaltime = '';
let globallocation = '';

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

// Endpoint to send invitation
app.post('/send-invitation', async (req, res) => {
  const { chatId, name, date, time, location, groomName, brideName } = req.body;

  // Save names and date in global variables
  globalGroomName = groomName;
  globalBrideName = brideName;
  globalDate = date;
  globaltime = time;
  globallocation = location;

  // Construct the invitation message
  const invitationText = `
    Hi ${name},
    Bersama undangan ini, saya turut mengundang
    Bapak/Ibu/Saudara untuk hadir acara pernikahan kami
    ${groomName} & ${brideName}
    Akad akan di gelar pada
    Hari dan Tanggal : ${date} 
    Pukul : ${time}.
    Location: ${location}

    Demikian undangan dari kami yang sedang berbahagia.
    Kami berharap Bapak/Ibu/Saudara berkenan untuk hadir di acara kami ini.

    Anda bisa konfirmasi kehadiran undangan
    Atau ketik "RSVP"
  `;

  try {
    await sendText(chatId, invitationText);
    res.status(200).send('Invitation sent successfully');
  } catch (error) {
    res.status(500).send('Failed to send invitation');
  }
});

// Endpoint to handle incoming message webhook
app.post('/webhook', async (req, res) => {
  const webhookData = req.body;
  console.log('Received message webhook:', webhookData);

  // Log seluruh payload untuk memeriksa struktur data
  console.log('Payload:', JSON.stringify(webhookData, null, 2));

  // Extract message details
  const { from, body, isGroupMsg } = webhookData.payload;

  console.log('Received message from:', from);
  console.log('Message Body:', body);

  // Jika pesan dari grup atau pengirim adalah ID Anda sendiri, tidak mengirim balasan
  if (isGroupMsg || from === yourWhatsAppId) {
    console.log('Message is from a group or from myself. No reply will be sent.');
    return res.status(200).send('Message from a group or myself. No reply sent.');
  }

  // Ambil nama pengantin dan tanggal dari variabel global
  const groomName = globalGroomName;
  const brideName = globalBrideName;
  const date = globalDate;
  const time = globaltime;
  const location = globallocation

  // Balas pesan sesuai dengan isi pesan yang diterima
  let replyText;
  if (body.toLowerCase().includes('hello')) {
    replyText = 'Hello! How can I assist you today?';
  } else if (body.toLowerCase().includes('help')) {
    replyText = 'Here are some commands you can use: "rsvp"';
  } else if (body.toLowerCase().includes('rsvp')) {
    replyText = `
      Hi ${webhookData.payload.senderName},
      Bersama undangan ini, saya turut mengundang
      Bapak/Ibu/Saudara untuk hadir acara pernikahan kami
      ${groomName} & ${brideName}
      Akad akan di gelar pada
      Hari dan Tanggal : ${date} 
      Pukul : ${time}.
      Location: ${location}

      Demikian undangan dari kami yang sedang berbahagia.
      Kami berharap Bapak/Ibu/Saudara berkenan untuk hadir di acara kami ini.

      Mohon melengkapi konfirmasi kehadiran sebelum tanggal ${date}. Balas ini dengan "hadir" atau "tidak hadir".
    `;
  } else if (body.toLowerCase().includes('hadir')) {
    replyText = 'Terima kasih atas konfirmasinya. Anda telah tercatat hadir.';
  } else if (body.toLowerCase().includes('tidak hadir')) {
    replyText = 'Terima kasih atas konfirmasinya. Anda telah tercatat tidak hadir.';
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
