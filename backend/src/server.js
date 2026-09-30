require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const { bootstrapAdminUser } = require('./utils/adminBootstrap');
const { isSmtpConfigured } = require('./services/emailService');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    await bootstrapAdminUser();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      // Visible at a glance instead of a silent no-op on every login - see
      // backend/.env.example for the SMTP_* variables this depends on.
      console.log(
        isSmtpConfigured()
          ? 'Login confirmation email: SMTP configured, sending enabled.'
          : 'Login confirmation email: SMTP not configured (SMTP_HOST/SMTP_PORT/MAIL_FROM) - emails will be skipped.'
      );
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();