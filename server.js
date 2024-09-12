const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const path = require('path');
const sequelize = require('./config/database'); // Import Sequelize instance\
const cors = require('cors');


const app = express();
app.use(cors());
const port = 5000;
app.use(express.json());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const wahaApiUrl = 'http://localhost:3000'; // Ganti dengan URL WAHA API Anda
const yourWhatsAppId = '083129701774';

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
let globaltemplate = '';


const sendText = async (chatId, text) => {
  const myChatId = '6283129701774@c.us'; // Ganti dengan nomor WhatsApp Anda
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

// Rute untuk mengirim pesan melalui WAHA
app.post('/send-message', async (req, res) => {
  const { chatId, text } = req.body;

  try {
    const result = await sendText(chatId, text);
    res.json({ status: 'success', data: result });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});


app.post('/send', (req, res) => {
    // Extract message details from the request body
    const { chatId, text } = req.body;

    // Handle sending message logic here
    console.log(`Sending message to ${chatId}: ${text}`);

    // Respond with success message
    res.json({ status: 'success', message: 'Message sent' });
});

app.get('/chat-room/:number', async (req, res) => {
  const number = req.params.number;
  try {
    const [rows] = await sequelize.query(
      `SELECT * FROM rsvp_message WHERE sender_id = ? OR recipient_id = ?`,
      {
        replacements: [number, number],
      }
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching chat room messages:', error);
    res.status(500).send('Failed to fetch chat room messages');
  }
});

// Endpoint untuk mendapatkan semua nomor
app.get('/numbers', async (req, res) => {
  try {
    const [rows] = await sequelize.query('SELECT DISTINCT sender_id FROM rsvp_message');
    res.json(rows.map(row => row.sender_id));
  } catch (error) {
    console.error('Error fetching numbers:', error);
    res.status(500).send('Failed to fetch numbers');
  }
});

app.get('/get-numbers', async (req, res) => {
  try {
    const [rows] = await sequelize.query(
      `SELECT DISTINCT sender_id AS number FROM rsvp_message WHERE sender_id IS NOT NULL`
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching numbers:', error);
    res.status(500).send('Failed to fetch numbers');
  }
});


// Endpoint untuk mendapatkan pesan diterima berdasarkan nomor
app.get('/received-messages/:number', async (req, res) => {
  const { number } = req.params;
  try {
    const [rows] = await sequelize.query(
      `SELECT * FROM rsvp_message WHERE sender_id = ? AND status = 'Received'`,
      {
        replacements: [number],
      }
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching received messages:', error);
    res.status(500).send('Failed to fetch received messages');
  }
});





app.get('/messages/:phoneNumber', async (req, res) => {
  const phoneNumber = req.params.phoneNumber;

  try {
    const [rows] = await sequelize.query(
      `SELECT * FROM rsvp_message WHERE sender_id = ?`,
      {
        replacements: [phoneNumber],
      }
    );

    if (rows.length > 0) {
      res.json(rows);
    } else {
      res.status(404).json({ message: 'No messages found for this phone number.' });
    }
  } catch (error) {
    console.error('Error retrieving messages:', error);
    res.status(500).json({ message: 'Error retrieving messages.' });
  }
});

app.get('/api/phoneNumbers', async (req, res) => {
  try {
    const [rows] = await sequelize.query(
      `SELECT DISTINCT sender_id FROM rsvp_message`
    );
    
    res.json(rows);
  } catch (error) {
    console.error('Error retrieving phone numbers:', error);
    res.status(500).json({ message: 'Error retrieving phone numbers.' });
  }
});


// Endpoint untuk mendapatkan pesan yang dikirim
// Endpoint untuk mendapatkan pesan yang dikirim
app.get('/sent-messages', async (req, res) => {
  try {
    const [rows] = await sequelize.query(
      `SELECT * FROM rsvp_message WHERE sender_id = ? AND (status = 'Sent' OR status = 'Delivered' OR status = 'Read')`,
      {
        replacements: [yourWhatsAppId],
      }
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching sent messages:', error);
    res.status(500).send('Failed to fetch sent messages');
  }
});

// Function to format chatId
const formatChatId = (chatId) => {
  // Replace '62' with '08' at the start of the chatId
  if (chatId.startsWith('62')) {
    return '0' + chatId.substring(2);
  }
  return chatId; // Return the chatId as is if it doesn't start with '62'
};


// Endpoint untuk mengirim undangan
app.post('/send-invitation', async (req, res) => {
  const { chatId, name, groomName, brideName, dateAkad, timeAkad, locationAkad, dateResepsi, timeResepsi, locationResepsi, template } = req.body;

  console.log('Template received:', template);

  // Tambahkan pengecekan untuk template
  if (!template) {
    return res.status(400).send('Template is required');
  }
  
  // Format chatId
  const formattedChatId = formatChatId(chatId);


  // Simpan data ke variabel global (jika diperlukan)
  globalGroomName = groomName;
  globalBrideName = brideName;
  globalDateAkad = dateAkad;
  globalTimeAkad = timeAkad;
  globalLocationAkad = locationAkad;
  globalDateResepsi = dateResepsi;
  globalTimeResepsi = timeResepsi;
  globalLocationResepsi = locationResepsi;
  globaltemplate = template;
  let invitationText;
  if (template === 'english') {
   invitationText = `
    Hii,
    With this invitation, I would like to invite
    Mr./Mrs./Sisters to attend our wedding ceremony
    ${groomName} & ${brideName}
    The wedding ceremony will be held on
    Day and Date: ${dateAkad} 
    At: ${timeAkad}.
    Location: ${locationAkad}
    Thus the invitation from us who are happy.
    We hope that you will be pleased to attend our event.
    You can confirm your attendance by invitation
    Or type “RSVP”
  `;
} else {
  invitationText = `
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
}
console.log('Invitation Text:', invitationText);

  try {
      const result = await sendText(chatId, invitationText);
    // Simpan pesan undangan ke database
    await sequelize.query(
      `INSERT INTO messaging (messageid, tanggal, type, status, sentat, deliveredat, seenat, id_pengguna, id_tamu, sender_number, recipient_number, message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      {
         replacements: [
          null, // Assuming WAHA API returns a message ID
          new Date(), // current date
          'text',
          'Sent',
          new Date(),
          null,
          null,
          null,
          null,
          yourWhatsAppId, // Change as per your sender logic
          formattedChatId,
          invitationText
        ],
      }
    );

    // Kirim teks (misalnya melalui WhatsApp API)
    await sendText(chatId, invitationText);
    res.status(200).send('Invitation sent successfully');
  } catch (error) {
    console.error('Error sending invitation:', error);
    res.status(500).send('Failed to send invitation');
  }
});


// Melayani file statis dari folder 'public'
app.use(express.static(path.join(__dirname, 'public')));


app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});
app.get('/message', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'message.html'));
});

yourNumber = '6283129701774@c.us';
app.post('/webhook', async (req, res) => {
  const webhookData= req.body;
 
  console.log('Received message webhook:', webhookData);
  console.log('Payload:', JSON.stringify(webhookData, null, 2));

    // Check if webhookData and payload are defined
    if (!webhookData || !webhookData.payload) {
      console.error('Webhook data or payload is missing');
      return res.status(400).send('Invalid webhook data');
    }

  const { payload } = webhookData;
   console.log('Payload:', payload);

  const { id, from, body, isGroupMsg } = webhookData.payload;
  
  
  // Process phone numbers
  const processPhoneNumber = (number) => {
    if (number.endsWith('@c.us')) {
      number = number.slice(0, -5); // Remove '@c.us' from the end
    }
    if (number.startsWith('62')) {
      number = '0' + number.slice(2); // Replace '62' with '0'
    }
    return number;
  };
  let replyText = '';
  let finalMessage = ''; // Declare finalMessage at the top
  let finalMessage2 = ''; // Declare finalMessage2 at the top

  const template = globaltemplate;

   const sender_number = processPhoneNumber(payload.to); // Nomor pengirim
    const recipient_number = processPhoneNumber(payload.from); // Nomor penerima

    console.log('Sender Number:', sender_number);
  console.log('Recipient Number:', recipient_number);
  
     if (payload.from === yourNumber) {
      console.log('Message is from the bot itself. Ignoring.');
      return res.status(200).send('Message ignored');
     }
  

  // Save received message
  try {
    await sequelize.query(
      `INSERT INTO messaging (messageid, tanggal, type, status, sentat, deliveredat, seenat, id_pengguna, id_tamu, sender_number, recipient_number, message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      {
        replacements: [
          null, // Or a unique ID if you have one
          new Date(),
          'text',
          'Received',
          null,
          null,
          null,
          null,
          null,
          recipient_number,
          sender_number, // Change as per your sender logic
          body
        ],
      }
    );
  } catch (error) {
    console.error('Error saving received message:', error);
  }

  if (from === yourWhatsAppId) {
    console.log('Message is from myself. No reply will be sent.');
    return res.status(200).send('Message from myself. No reply sent.');
  }

  else if (body.toLowerCase().includes('hello')) {
    replyText = template === 'english'
      ? 'Hello! How can I assist you today?'
      : 'Halo! Bagaimana saya bisa membantu Anda hari ini?';
  } else if (body.toLowerCase().includes('help')) {
    replyText = template === 'english'
      ? 'Here are some commands you can use: "rsvp"'
      : 'Berikut beberapa perintah yang dapat Anda gunakan: "rsvp"';
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
        replyText = template === 'english' 
          ? `You are already registered with the following details:
             Attendance: Not Attending
             Groom's Name: ${existingRSVP.groom_name} & Bride's Name: ${existingRSVP.bride_name}
             Wedding Date: ${existingRSVP.date_akad}
             Wedding Time: ${existingRSVP.time_akad}
             Reception Date: ${existingRSVP.date_resepsi}
             Reception Time: ${existingRSVP.time_resepsi}
             
             Do you want to reset this registration? Reply with *RESET* if yes.`
          : `Anda sudah terdaftar dengan rincian sebagai berikut:
             Kehadiran: Tidak Hadir
             Nama Pengantin: ${existingRSVP.groom_name} & ${existingRSVP.bride_name}
             Tanggal Akad: ${existingRSVP.date_akad}
             Waktu Akad: ${existingRSVP.time_akad}
             Tanggal Resepsi: ${existingRSVP.date_resepsi}
             Waktu Resepsi: ${existingRSVP.time_resepsi}
          
            Apakah Anda ingin mereset pendaftaran ini? Balas dengan *RESET* jika ya.
        `;
        awaitingResetConfirmation = true;
      } else {
        replyText = template === 'english'
        ?`Hi,  
        With this invitation, I would like to invite Mr./Mrs./Sir to attend our wedding ceremony.  
        *${globalGroomName} & ${globalBrideName}*  
        The Akad (Islamic marriage contract) will be held on  
        *Day and Date: ${globalDateAkad}*  
        *Time: ${globalTimeAkad}.*  
        *Location: ${globalLocationAkad}*  

        The Reception will be held on  
        *Day and Date: ${globalDateResepsi}*  
        *Time: ${globalTimeResepsi}.*  
        *Location: ${globalLocationResepsi}*  

        This is an invitation from us who are in happiness.  
        We hope that Mr./Mrs./Sir will be able to attend our event.  

        Will you attend? Reply with  
        *Attend*  
        *Not Attend* 
        `
        : `Hii,
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
          *Tidak Hadir*`;
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
          `DELETE FROM messaging WHERE sender_number = ?`,
          {
            replacements: [from],
            transaction,
          }
        );
      });

      replyText = template === 'english'  
      ?`Your registration has been reset. Please start over by replying with *RSVP*.`
      :'Pendaftaran Anda telah direset. Silakan mulai dari awal balas dengan *RSVP*';
      awaitingResetConfirmation = false;
      awaitingGuests = false;
      awaitingAccommodation = false;
    } catch (error) {
      console.error('Error resetting RSVP data:', error);
      replyText = template === 'english'
       ?`Failed to reset the data. Please try again later.`
       :'Gagal mereset data. Mohon coba lagi nanti.';
    }
  } else if (body.toLowerCase() === 'hadir' || body.toLowerCase() === 'attend') {
    awaitingGuests = true;
    awaitingAccommodation = false;
    awaitingResetConfirmation = false;
    replyText = template === 'english'
    ? `Thank you for your confirmation!  
      Your invitation is valid for 4 people\n  
      How many people will be attending? (example: *2*)`
    :`
      Terima kasih atas konfirmasinya!
      Undangan anda berlaku 4 orang\n
      Berapa orang yang akan hadir? (contoh: *2*)
    `;
  } else if (body.toLowerCase() === 'tidak hadir' || body.toLowerCase() === 'not attend') {
    finalMessage2 = template === 'english'
     ?`Attendance: Not Attending  
      Groom's Name: ${globalGroomName} & Bride's Name: ${globalBrideName}  
      Akad Date: ${globalDateAkad}  
      Akad Time: ${globalTimeAkad}  
      Akad Location: ${globalLocationAkad}  
      Reception Date: ${globalDateResepsi}  
      Reception Time: ${globalTimeResepsi}  
      Reception Location: ${globalLocationResepsi}`
     :`Kehadiran : Tidak hadir
      Nama Pengantin: ${globalGroomName} & ${globalBrideName}
      Tanggal Akad: ${globalDateAkad}
      Waktu Akad: ${globalTimeAkad}
      Lokasi Akad: ${globalLocationAkad}
      Tanggal Resepsi: ${globalDateResepsi}
      Waktu Resepsi: ${globalTimeResepsi}
      Lokasi Resepsi: ${globalLocationResepsi}`;

    replyText = template === "english"
    ?`Thank you for the information.  
      If there are any changes, please inform us again by replying with *RESET*  

      Here are the event details:  
      ${finalMessage2}  `
    :`
      Terima kasih atas informasinya.
      Jika ada perubahan, silakan informasikan kembali dengan membalas *RESET*
      
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
        await sendText(recipient_number, replyText);
        await sequelize.query(
          `INSERT INTO messaging (messageid, tanggal, type, status, sentat, deliveredat, seenat, id_pengguna, id_tamu, sender_number, recipient_number, message)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          {
            replacements: [
          null, // Or a unique ID if you have one
          new Date(),
          'text',
          'Sent',
          null,
          null,
          null,
          null,
          null,
          sender_number,
          recipient_number, // Change as per your sender logic
          replyText
        ],
            transaction,
          }
        );
        res.status(200).send('Reply sent');
      });
    } catch (error) {
      console.error('Error saving RSVP data to database:', error);
      replyText = template === 'english'
      ?`An error occurred while saving the RSVP data.`
      :'Terjadi kesalahan saat menyimpan data RSVP.';
    }
  } else if (awaitingGuests && body.toLowerCase().match(/^\d+$/)) {
    const guests = parseInt(body);

    if (guests > 4) {
      replyText = template === 'english' 
      ?`Sorry, the number you provided exceeds the quota. Please try again.`
      :'Mohon maaf, jumlah yang Anda kirimkan melebihi kuota. Mohon ulangi lagi.';
    } else {
      globalGuests = guests;
      awaitingGuests = false;
      awaitingAccommodation = true;
      awaitingResetConfirmation = false;
      replyText = template === 'english'
      ?` You will receive accommodation facilities. For how many nights will you be staying at the Hotel Malang?  
        1. 1 night, check-in on 16 January 2024, check-out on 17 January 2024  
        2. 1 night, check-in on 15 January 2024, check-out on 16 January 2024  
        3. No hotel
        (example: *2*)`
      :`
        Anda akan mendapatkan fasilitas penginapan untuk akomodasi. Hotel Malang berapa lama Anda akan menginap?
        1. 1 malam check in di 16 Januari 2024, check out di 17 Januari 2024
        2. 1 malam check in di 15 Januari 2024, check out di 16 Januari 2024
        3. Tanpa hotel
        (contoh: *2*)
      `;
    }
  } else if (awaitingAccommodation && body.toLowerCase().match(/^\d+$/)) {
    const accommodationOption = parseInt(body);
    let accommodationText = '';

    if (accommodationOption === 1) {
      accommodationText = template === 'english'
        ? '1 night check-in on January 16, 2024, check-out on January 17, 2024'
        : '1 malam check-in di 16 Januari 2024, check-out di 17 Januari 2024';
    } else if (accommodationOption === 2) {
      accommodationText = template === 'english'
        ? '1 night check-in on January 15, 2024, check-out on January 16, 2024'
        : '1 malam check-in di 15 Januari 2024, check-out di 16 Januari 2024';
    } else if (accommodationOption === 3) {
      accommodationText = template === 'english'
        ? 'No hotel required'
        : 'Tanpa hotel';
    } else {
      replyText = template === 'english'
      ?`Invalid option. Please choose 1, 2, or 3.`
      :'Pilihan tidak valid. Mohon pilih antara 1, 2, atau 3.';
      return res.status(200).send(replyText);
    }

    finalMessage = template === 'english'
    ?`Thank you for confirming your attendance!  
      Registration Details:  
      Couple's Name: ${globalGroomName} & ${globalBrideName}  
      Akad Date: ${globalDateAkad}  
      Akad Time: ${globalTimeAkad}  
      Akad Location: ${globalLocationAkad}  
      Reception Date: ${globalDateResepsi}  
      Reception Time: ${globalTimeResepsi}  
      Reception Location: ${globalLocationResepsi}  
      Number of Guests: ${globalGuests}  
      Accommodation: ${accommodationText}  `
    :`
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
          `INSERT INTO messaging (messageid, tanggal, type, status, sentat, deliveredat, seenat, id_pengguna, id_tamu, sender_number, recipient_number, message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          {
            replacements:  [null, new Date(), 'text', 'Sent',null, null, null,null, null, sender_number, recipient_number, replyText],
            transaction,
          }
        );
         replyText = template === 'english'
         ?`Thank you for completing the RSVP. We look forward to your attendance.  
        Your registration details:  

        ${finalMessage} `
         :`Terimakasih telah melengkapi RSVP. Kami menunggu kehadiran Anda.
        Daftar kehadiran Anda:

        ${finalMessage}
      `;
      awaitingAccommodation = false;
      awaitingGuests = false;
      });
    } catch (error) {
      console.error('Error saving RSVP data to database:', error);
      replyText = template === 'english' 
      ?`An error occurred while saving the RSVP data.`
      :'Terjadi kesalahan saat menyimpan data RSVP.';
    }
  } 



  try {
    if (replyText) {
      await sendText(from, replyText);
      await sequelize.query(
     `INSERT INTO messaging (messageid, tanggal, type, status, sentat, deliveredat, seenat, id_pengguna, id_tamu, sender_number, recipient_number, message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      {
        replacements: [null, new Date(), 'text', 'Sent',null, null, null,null, null, sender_number, recipient_number, replyText],
      }
    );
    }
    return res.status(200).send('Reply sent');
  } catch (error) {
    console.error('Error sending reply:', error);
    return res.status(500).send('Failed to send reply');
  }
});


app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});