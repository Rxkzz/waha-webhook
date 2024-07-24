// Import required modules
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const path = require('path');

// Initialize the app and port
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
let globalDateAkad = '';
let globalTimeAkad = '';
let globalLocationAkad = '';
let globalDateResepsi = '';
let globalTimeResepsi = '';
let globalLocationResepsi = '';
let globalGuests = 0;
let globalAccommodation = '';
let isRSVPCompleted = false;
let awaitingGuests = false;
let awaitingAccommodation = false;
let awaitingResetConfirmation = false;

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

// Serve the HTML form on the root URL
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));

});

// Endpoint to send invitation
app.post('/send-invitation', async (req, res) => {
  const { chatId, name, dateAkad, timeAkad, locationAkad, dateResepsi, timeResepsi, locationResepsi, groomName, brideName } = req.body;

  // Save names and date in global variables
  globalGroomName = groomName;
  globalBrideName = brideName;
  globalDateAkad = dateAkad;
  globalTimeAkad = timeAkad;
  globalLocationAkad = locationAkad;
  globalDateResepsi = dateResepsi;
  globalTimeResepsi = timeResepsi;
  globalLocationResepsi = locationResepsi;
  isRSVPCompleted = false;
  awaitingGuests = false;
  awaitingAccommodation = false;
  awaitingResetConfirmation = false;

  // Construct the invitation message
  const invitationText = `
    Hi ${name},
    Bersama undangan ini, saya turut mengundang
    Bapak/Ibu/Saudara untuk hadir acara pernikahan kami
    ${groomName} & ${brideName}
    Akad akan di gelar pada
    Hari dan Tanggal : ${dateAkad} 
    Pukul : ${timeAkad}.
    Location: ${locationAkad}

    Resepsi akan di gelar pada
    Hari dan Tanggal : ${dateResepsi} 
    Pukul : ${timeResepsi}.
    Location: ${locationResepsi}

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

  let replyText = '';

  if (body.toLowerCase().includes('hello')) {
    replyText = 'Hello! How can I assist you today?';
  } else if (body.toLowerCase().includes('help')) {
    replyText = 'Here are some commands you can use: "rsvp"';
  } else if (body.toLowerCase().includes('rsvp')) {
    replyText = `
      Hi ${webhookData.payload.senderName},
      Bersama undangan ini, saya turut mengundang
      Bapak/Ibu/Saudara untuk hadir acara pernikahan kami
      *${globalGroomName} & ${globalBrideName}*
      Akad akan di gelar pada
      *Hari dan Tanggal : ${globalDateAkad}*
      *Pukul : ${globalTimeAkad}.*
      *Location: ${globalLocationAkad}*

      Resepsi akan di gelar pada
      *Hari dan Tanggal : ${globalDateResepsi}*
      *Pukul : ${globalTimeResepsi}.*
      *Location: ${globalLocationResepsi}*

      Demikian undangan dari kami yang sedang berbahagia.
      Kami berharap Bapak/Ibu/Saudara berkenan untuk hadir di acara kami ini.

      Apakah Anda akan hadir? Balas dengan 
      *Hadir*
      *Tidak Hadir*
    `;
    awaitingGuests = false;
    awaitingAccommodation = false;
    awaitingResetConfirmation = false;
  } else if (body.toLowerCase() === 'hadir') {
    awaitingGuests = true;
    awaitingAccommodation = false;
    awaitingResetConfirmation = false;
    replyText = `
      Terima kasih atas konfirmasinya!
      Undangan anda berlaku 4 orang\n
      Berapa orang yang akan hadir? (contoh: *2*)
    `;
  } else if (body.toLowerCase() === 'tidak hadir') {
    replyText = 'Terima kasih atas informasinya. Jika ada perubahan, silakan informasikan kembali.';
    isRSVPCompleted = true;
    awaitingGuests = false;
    awaitingAccommodation = false;
    awaitingResetConfirmation = false;
  } else if (awaitingGuests && body.toLowerCase().match(/^\d+$/)) {
    const guests = parseInt(body);

    if (guests > 4) {
      replyText = 'Mohon maaf, jumlah yang Anda kirimkan melebihi kuota. Mohon ulangi lagi.';
    } else {
      globalGuests = guests;
      awaitingGuests = false;
      awaitingAccommodation = true;
      awaitingResetConfirmation = false;
      replyText = `
        Anda akan mendapatkan fasilitas penginapan untuk akomodasi. Hotel Malang berapa lama Anda akan menginap?
        1. 1 malam check in di 16 Januari 2024, check out di 17 Januari 2024
        2. 1 malam check in di 15 Januari 2024, check out di 16 Januari 2024
        3. Tanpa hotel
        Balas pesan ini dengan angka (contoh: *2*).
      `;
    }
  } else if (awaitingAccommodation && body.toLowerCase().match(/^\d+$/)) {
    const accommodationOption = parseInt(body);

    if (accommodationOption === 1) {
      replyText = `
        Terimakasih telah melengkapi RSVP ini. Berikut ringkasan pengisian RSVP Anda:
        - Kehadiran: Hadir
        - Jumlah: ${globalGuests}
        - Akomodasi: 1 malam check-in di 16 Januari 2024, check-out di 17 Januari 2024
        
        Jika Anda ingin mengubah RSVP ini silahkan balas dengan "reset" atau abaikan pesan ini.
      `;
      isRSVPCompleted = true;
      awaitingAccommodation = false;
      awaitingResetConfirmation = false;
    } else if (accommodationOption === 2) {
      replyText = `
        Terimakasih telah melengkapi RSVP ini. Berikut ringkasan pengisian RSVP Anda:
        - Kehadiran: Hadir
        - Jumlah: ${globalGuests}
        - Akomodasi: 1 malam check-in di 15 Januari 2024, check-out di 16 Januari 2024
        
        Jika Anda ingin mengubah RSVP ini silahkan balas dengan "reset" atau abaikan pesan ini.
      `;
      isRSVPCompleted = true;
      awaitingAccommodation = false;
      awaitingResetConfirmation = false;
    } else if (accommodationOption === 3) {
      replyText = `
        Terimakasih telah melengkapi RSVP ini. Berikut ringkasan pengisian RSVP Anda:
        - Kehadiran: Hadir
        - Jumlah: ${globalGuests}
        - Akomodasi: Tanpa hotel
        
        Jika Anda ingin mengubah RSVP ini silahkan balas dengan "reset" atau abaikan pesan ini.
      `;
      isRSVPCompleted = true;
      awaitingAccommodation = false;
      awaitingResetConfirmation = false;
    } else {
      replyText = 'Pilihan tidak valid. Silakan balas dengan angka yang benar.';
    }
  } else if (body.toLowerCase() === 'reset') {
    awaitingResetConfirmation = true;
    awaitingGuests = false;
    awaitingAccommodation = false;
    replyText = `
      Apakah Anda yakin ingin mengatur ulang RSVP Anda? Balas dengan "ya" untuk mengonfirmasi atau "tidak" untuk membatalkan.
    `;
  } else if (awaitingResetConfirmation && body.toLowerCase() === 'ya') {
    isRSVPCompleted = false;
    awaitingGuests = false;
    awaitingAccommodation = false;
    awaitingResetConfirmation = false;
    replyText = `
      RSVP Anda telah diatur ulang. Silakan balas "rsvp" untuk memulai ulang proses RSVP.
    `;
  } else if (awaitingResetConfirmation && body.toLowerCase() === 'tidak') {
    awaitingResetConfirmation = false;
    replyText = 'Reset RSVP dibatalkan.';
  } else {
    replyText = 'Maaf, saya tidak mengerti pesan Anda. Silakan ketik "help" untuk daftar perintah yang tersedia.';
  }

  try {
    await sendText(from, replyText);
    res.status(200).send('Reply sent successfully');
  } catch (error) {
    res.status(500).send('Failed to send reply');
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
