const { Sequelize, DataTypes } = require('sequelize');

// Konfigurasi Sequelize langsung di sini
const sequelize = new Sequelize('postgres://postgres:realme@localhost:5432/waha', {
  dialect: 'postgres',
  dialectOptions: {
    ssl: false // Matikan SSL
  },
  logging: false // Matikan logging jika tidak diperlukan
});

// Definisikan model RSVP
const RSVP = sequelize.define('RSVP', {
  chatId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  groomName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  brideName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  dateAkad: {
    type: DataTypes.DATE,
    allowNull: false
  },
  timeAkad: {
    type: DataTypes.STRING,
    allowNull: false
  },
  locationAkad: {
    type: DataTypes.STRING,
    allowNull: false
  },
  dateResepsi: {
    type: DataTypes.DATE,
    allowNull: false
  },
  timeResepsi: {
    type: DataTypes.STRING,
    allowNull: false
  },
  locationResepsi: {
    type: DataTypes.STRING,
    allowNull: false
  },
  guests: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  accommodation: {
    type: DataTypes.STRING,
    allowNull: false
  },
  isRSVPCompleted: {
    type: DataTypes.BOOLEAN,
    allowNull: false
  }
});

// Sinkronisasi model dengan database
sequelize.sync({ force: true }) // force: true akan menghapus tabel jika sudah ada
  .then(() => {
    console.log('Database & tables created!');
    sequelize.close();
  })
  .catch((err) => {
    console.error('Unable to connect to the database:', err);
    sequelize.close();
  });
