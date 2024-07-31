const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const path = require('path');
const sequelize = require('./config/database'); // Import Sequelize instance

const app = express();
const port = 4000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const wahaApiUrl = 'http://localhost:3000';
const yourWhatsAppId = '6283129701774@c.us';

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

// Test database connection
sequelize.authenticate()
  .then(() => {
    console.log('Database connection has been established successfully.');
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err);
  });

const sendText = async (chatId, text) => {
  try {
    const response = await axios.post(
      `${wahaApiUrl}/api/sendText`,
      {
        chatId,
        text,
        session: 'default'
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('Message sent:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error sending message:', error.response ? error.response.data : error.message);
    throw error;
  }
};

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/save-data', async (req, res) => {
  const { groomName, brideName, dateAkad, timeAkad, locationAkad, dateResepsi, timeResepsi, locationResepsi } = req.body;

  try {
    console.log('Saving data:', { groomName, brideName, dateAkad, timeAkad, locationAkad, dateResepsi, timeResepsi, locationResepsi });
    await sequelize.query(
      `INSERT INTO invitations (groom_name, bride_name, date_akad, time_akad, location_akad, date_resepsi, time_resepsi, location_resepsi)
       VALUES (:groomName, :brideName, :dateAkad, :timeAkad, :locationAkad, :dateResepsi, :timeResepsi, :locationResepsi)`,
      {
        replacements: {
          groomName,
          brideName,
          dateAkad,
          timeAkad,
          locationAkad,
          dateResepsi,
          timeResepsi,
          locationResepsi
        },
        type: sequelize.QueryTypes.INSERT
      }
    );
    console.log('Data successfully saved');
    res.status(200).send('Data successfully saved');
  } catch (error) {
    console.error('Failed to save data:', error);
    res.status(500).send('Failed to save data');
  }
});

app.post('/webhook', async (req, res) => {
  const webhookData = req.body;
  console.log('Received message webhook:', webhookData);
  console.log('Payload:', JSON.stringify(webhookData, null, 2));

  const { from, body, isGroupMsg } = webhookData.payload;
  console.log('Received message from:', from);
  console.log('Message Body:', body);

  if (isGroupMsg || from === yourWhatsAppId) {
    console.log('Message is from a group or from myself. No reply will be sent.');
    return res.status(200).send('Message from a group or myself. No reply sent.');
  }

  let replyText = '';
  let accommodationText = ''; // Initialize accommodationText here

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
  } else if (awaitingAccommodation) {
    const accommodationOption = parseInt(body);

    if (accommodationOption === 1) {
      accommodationText = '1 malam check in di 16 Januari 2024, check out di 17 Januari 2024';
    } else if (accommodationOption === 2) {
      accommodationText = '1 malam check in di 15 Januari 2024, check out di 16 Januari 2024';
    } else if (accommodationOption === 3) {
      accommodationText = 'Tanpa hotel';
    } else {
      replyText = 'Pilihan tidak valid. Mohon pilih opsi yang benar.';
      return res.status(200).send(replyText);
    }

    // Save data to database
    try {
      await sequelize.query(
        `INSERT INTO rsvp (sender_name, number_of_guests, accommodation)
         VALUES (:senderName, :numberOfGuests, :accommodation)`,
        {
          replacements: {
            senderName: webhookData.payload.senderName || 'Unknown Sender',
            numberOfGuests: globalGuests,
            accommodation: accommodationOption // Use accommodationOption directly
          },
          type: sequelize.QueryTypes.INSERT
        }
      );
      console.log('RSVP data successfully saved');
      replyText = `Terima kasih atas konfirmasinya! ...`;
    } catch (error) {
      console.error('Failed to save RSVP data:', error);
      replyText = 'Terjadi kesalahan saat menyimpan data. Mohon coba lagi.';
    }
  } else if (awaitingResetConfirmation && body.toLowerCase() === 'reset') {
    // Reset global variables
    globalGroomName = '';
    globalBrideName = '';
    globalDateAkad = '';
    globalTimeAkad = '';
    globalLocationAkad = '';
    globalDateResepsi = '';
    globalTimeResepsi = '';
    globalLocationResepsi = '';
    globalGuests = 0;
    globalAccommodation = '';
    isRSVPCompleted = false;
    awaitingGuests = false;
    awaitingAccommodation = false;
    awaitingResetConfirmation = false;

    replyText = 'Semua data telah direset. Jika ada pertanyaan, silakan kirim pesan lagi.';
  }

  // Send reply message
  if (replyText) {
    await sendText(from, replyText);
  }

  res.status(200).send('Webhook processed successfully');
});



// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
