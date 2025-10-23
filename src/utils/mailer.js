import path from 'path';
import fs from 'fs';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: process.env.MAIL_PORT,
  secure: process.env.MAIL_PORT == 465,
  auth: {
    user: process.env.NODEMAILER_USER,
    pass: process.env.NODEMAILER_PASS,
  },
});

/**
 * Utility function to send dynamic emails with HTML templates.
 * This function can send verification emails, password reset emails, or any other type.
 *
 * @param {string} to - Recipient email address.
 * @param {string} userName - Name of the user (for personalized emails).
 * @param {string} subject - Subject of the email.
 * @param {string} templateName - Template file name (without extension) to use.
 * @param {Object} dynamicValues - Dynamic values to replace placeholders in the template.
 * @returns {Promise} - Returns a promise with email sending status (info).
 */
const sendEmail = async (
  to,
  userName,
  subject,
  templateName,
  dynamicValues
) => {
  try {
    // Path to email template folder (assuming the templates are stored in `emailTemplates` directory)
    const templatePath = path.join(
      __dirname,
      '../../static/emailTemplates',
      `${templateName}.html`
    );

    // Read the template file
    const template = await fs.promises.readFile(templatePath, 'utf8');

    // Replace dynamic values (placeholders) in the template
    let html = template;
    for (const [key, value] of Object.entries(dynamicValues)) {
      html = html.replace(`{{${key}}}`, value);
    }

    // Email options
    const mailOptions = {
      from: process.env.MAIL_FROM_ADDRESS, // Sender email address
      to, // Recipient email address
      subject, // Subject
      html, // HTML content with replaced placeholders
    };

    // Send the email
    const info = await transporter.sendMail(mailOptions);
    return info; // Return email sending info (status)
  } catch (error) {
    // Handle errors
    console.error('Error sending email:', error);
    throw new Error('Failed to send email');
  }
};

export default sendEmail;
