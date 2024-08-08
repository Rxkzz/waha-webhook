const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const path = require('path');
const sequelize = require('./config/database'); // Import Sequelize instance

const app = express();
const port = 4000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const wahaApiUrl = 'http://localhost:3000'; // Ganti dengan URL WAHA API Anda
const yourWhatsAppId = '6283129701774@c.us';

// Test database connection
sequelize.authenticate()
  .then(() => {
    console.log('Database connection has been established successfully.');
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err);
  });

// Define global variables at the top of your server.js file
let globalGroomName = '';
let globalBrideName = '';
let globalDateAkad = '';
let globalTimeAkad = '';
let globalLocationAkad = '';
let globalDateResepsi = '';
let globalTimeResepsi = '';
let globalLocationResepsi = '';
let isRSVPCompleted = false;
let awaitingGuests = false;
let awaitingAccommodation = false;
let awaitingResetConfirmation = false;
let globalGuests = 0; // Add this to manage the number of guests


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
    console.log('Message sent:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error sending message:', error.response ? error.response.data : error.message);
    throw error;
  }
};



app.post('/send-invitation', async (req, res) => {
  const { chatId, name, groomName, brideName, dateAkad, timeAkad, locationAkad, dateResepsi, timeResepsi, locationResepsi } = req.body;

  // Simpan data ke variabel global (jika diperlukan)
  globalGroomName = groomName;
  globalBrideName = brideName;
  globalDateAkad = dateAkad;
  globalTimeAkad = timeAkad;
  globalLocationAkad = locationAkad;
  globalDateResepsi = dateResepsi;
  globalTimeResepsi = timeResepsi;
  globalLocationResepsi = locationResepsi;
  

  // Construct the invitation message
  const invitationText = `
    Hii,
    Bersama undangan ini, saya turut mengundang
    Bapak/Ibu/Saudara untuk hadir acara pernikahan kami
    ${groomName} & ${brideName}
    Akad akan di gelar pada
    Hari dan Tanggal : ${dateAkad} 
    Pukul : ${timeAkad}.
    Location: ${locationAkad}
    Demikian undangan dari kami yang sedang berbahagia.
    Kami berharap Bapak/Ibu/Saudara berkenan untuk hadir di acara kami ini.
    Anda bisa konfirmasi kehadiran undangan
    Atau ketik "RSVP"
  `;

  try {
    // Fungsi untuk mengirim teks (misalnya melalui WhatsApp API)
    await sendText(chatId, invitationText);
    res.status(200).send('Invitation sent successfully');
  } catch (error) {
    console.error('Error sending invitation:', error);
    res.status(500).send('Failed to send invitation');
  }
});


app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


app.post('/webhook', async (req, res) => {
  const webhookData = req.body;
  console.log('Received message webhook:', webhookData);
  console.log('Payload:', JSON.stringify(webhookData, null, 2));

  const { from, body, isGroupMsg } = webhookData.payload;

  if (isGroupMsg || from === yourWhatsAppId) {
    console.log('Message is from a group or from myself. No reply will be sent.');
    return res.status(200).send('Message from a group or myself. No reply sent.');
  }

  let replyText = '';
  let finalMessage = ''; // Declare finalMessage at the top
  let finalMessage2 = ''; // Declare finalMessage2 at the top

  if (body.toLowerCase().includes('hello')) {
    replyText = 'Hello! How can I assist you today?';
  } else if (body.toLowerCase().includes('help')) {
    replyText = 'Here are some commands you can use: "rsvp"';
  } else if (body.toLowerCase().includes('rsvp')) {
    try {
      const [rows] = await sequelize.query(
        `SELECT * FROM invitations WHERE chat_id = ?`,
        {
          replacements: [from],
        }
      );

      if (rows.length > 0) {
        const existingRSVP = rows[0];
        replyText = `
          Anda sudah terdaftar dengan rincian sebagai berikut:
          Nama Pengantin: ${existingRSVP.groom_name} & ${existingRSVP.bride_name}
          Tanggal Akad: ${existingRSVP.date_akad}
          Waktu Akad: ${existingRSVP.time_akad}
          Lokasi Akad: ${existingRSVP.location_akad}
          Tanggal Resepsi: ${existingRSVP.date_resepsi}
          Waktu Resepsi: ${existingRSVP.time_resepsi}
          Lokasi Resepsi: ${existingRSVP.location_resepsi}
          Jumlah Tamu: ${existingRSVP.guest}
          Akomodasi: ${existingRSVP.accomodation}
          
          Apakah Anda ingin mereset pendaftaran ini? Balas dengan *RESET* jika ya.
        `;
        awaitingResetConfirmation = true;
      } else {
        replyText = `
          Hii,
          Bersama undangan ini, saya turut mengundang Bapak/Ibu/Saudara untuk hadir acara pernikahan kami
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
      }
    } catch (error) {
      console.error('Error checking RSVP data:', error);
      replyText = 'Terjadi kesalahan saat memeriksa data pendaftaran.';
    }
  } else if (awaitingResetConfirmation && body.toLowerCase() === 'reset') {
    try {
      await sequelize.transaction(async (transaction) => {
        await sequelize.query(
          `DELETE FROM invitations WHERE chat_id = ?`,
          {
            replacements: [from],
            transaction,
          }
        );

        await sequelize.query(
          `DELETE FROM rsvp_message WHERE sender_id = ?`,
          {
            replacements: [from],
            transaction,
          }
        );
      });

      replyText = 'Pendaftaran Anda telah direset. Silakan mulai dari awal.';
      awaitingResetConfirmation = false;
      awaitingGuests = false;
      awaitingAccommodation = false;
    } catch (error) {
      console.error('Error resetting RSVP data:', error);
      replyText = 'Gagal mereset data. Mohon coba lagi nanti.';
    }
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
    finalMessage2 = 
     `Kehadiran : Tidak hadir
      Nama Pengantin: ${globalGroomName} & ${globalBrideName}
      Tanggal Akad: ${globalDateAkad}
      Waktu Akad: ${globalTimeAkad}
      Lokasi Akad: ${globalLocationAkad}
      Tanggal Resepsi: ${globalDateResepsi}
      Waktu Resepsi: ${globalTimeResepsi}
      Lokasi Resepsi: ${globalLocationResepsi}`;

    replyText = `
     Kehadiran : Tidak hadir
      Terima kasih atas informasinya. Jika ada perubahan, silakan informasikan kembali.
      
      Berikut adalah detail acara:
      ${finalMessage2}
    `;
    isRSVPCompleted = true;
    awaitingGuests = false;
    awaitingAccommodation = false;
    awaitingResetConfirmation = false;

    try {
      await sequelize.transaction(async (transaction) => {
        await sequelize.query(
          `INSERT INTO invitations (groom_name, bride_name, date_akad, time_akad, location_akad, date_resepsi, time_resepsi, location_resepsi, guest, accomodation, is_rsvp_completed, chat_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          {
            replacements: [
              globalGroomName,
              globalBrideName,
              globalDateAkad,
              globalTimeAkad,
              globalLocationAkad,
              globalDateResepsi,
              globalTimeResepsi,
              globalLocationResepsi,
              0, // Jumlah tamu tidak relevan untuk "tidak hadir"
              'Tidak', // Tidak memerlukan akomodasi
              true,
              from
            ],
            transaction,
          }
        );

        await sequelize.query(
          `INSERT INTO rsvp_message (event_id, sender_id, recipient_id, message_body, status) VALUES (?, ?, ?, ?, ?)`,
          {
            replacements: [null, from, yourWhatsAppId, finalMessage2, 'Tidak hadir'],
            transaction,
          }
        );
      });
    } catch (error) {
      console.error('Error saving RSVP data to database:', error);
      replyText = 'Terjadi kesalahan saat menyimpan data RSVP.';
    }
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
      `;
    }
  } else if (awaitingAccommodation && body.toLowerCase().match(/^\d+$/)) {
    const accommodationOption = parseInt(body);
    let accommodationText = '';

    if (accommodationOption === 1) {
      accommodationText = '1 malam check-in di 16 Januari 2024, check-out di 17 Januari 2024';
    } else if (accommodationOption === 2) {
      accommodationText = '1 malam check-in di 15 Januari 2024, check-out di 16 Januari 2024';
    } else if (accommodationOption === 3) {
      accommodationText = 'Tanpa hotel';
    } else {
      replyText = 'Pilihan tidak valid. Mohon pilih antara 1, 2, atau 3.';
      return res.status(200).send(replyText);
    }

    finalMessage = `
      Terima kasih telah mengonfirmasi kehadiran Anda!
      Detail Pendaftaran:
      Nama Pengantin: ${globalGroomName} & ${globalBrideName}
      Tanggal Akad: ${globalDateAkad}
      Waktu Akad: ${globalTimeAkad}
      Lokasi Akad: ${globalLocationAkad}
      Tanggal Resepsi: ${globalDateResepsi}
      Waktu Resepsi: ${globalTimeResepsi}
      Lokasi Resepsi: ${globalLocationResepsi}
      Jumlah Tamu: ${globalGuests}
      Akomodasi: ${accommodationText}
    `;
    isRSVPCompleted = true;
    awaitingAccommodation = false;
    awaitingResetConfirmation = false;

    try {
      await sequelize.transaction(async (transaction) => {
        await sequelize.query(
          `INSERT INTO invitations (groom_name, bride_name, date_akad, time_akad, location_akad, date_resepsi, time_resepsi, location_resepsi, guest, accomodation, is_rsvp_completed, chat_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          {
            replacements: [
              globalGroomName,
              globalBrideName,
              globalDateAkad,
              globalTimeAkad,
              globalLocationAkad,
              globalDateResepsi,
              globalTimeResepsi,
              globalLocationResepsi,
              globalGuests,
              accommodationText,
              true,
              from
            ],
            transaction,
          }
        );

        await sequelize.query(
          `INSERT INTO rsvp_message (event_id, sender_id, recipient_id, message_body, status) VALUES (?, ?, ?, ?, ?)`,
          {
            replacements: [null, from, yourWhatsAppId, finalMessage, 'Hadir'],
            transaction,
          }
        );
         replyText = `Terimakasih telah melengkapi RSVP. Kami menunggu kehadiran Anda.
        Daftar kehadiran Anda:
        ${finalMessage}
      `;
      awaitingAccommodation = false;
      awaitingGuests = false;
      });
    } catch (error) {
      console.error('Error saving RSVP data to database:', error);
      replyText = 'Terjadi kesalahan saat menyimpan data RSVP.';
    }
  }

  try {
    if (replyText) {
      await sendText(from, replyText);
    }
    res.status(200).send('Reply sent');
  } catch (error) {
    console.error('Error sending reply:', error);
    res.status(500).send('Failed to send reply');
  }
});


app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});