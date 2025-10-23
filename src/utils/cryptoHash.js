import crypto from 'crypto';

/**
 * Utility for AES encryption and decryption
 */
const aesUtils = {
  /**
   * Generate a random 256-bit AES key and 128-bit IV (Initialization Vector)
   * 
   * @returns {Object} - Contains the key and IV
   */
  generateKeyAndIv: () => {
    const key = crypto.randomBytes(32);  // 32 bytes = 256 bits for AES-256
    const iv = crypto.randomBytes(16);   // 16 bytes for AES block size (128 bits)
    return { key, iv };
  },

  /**
   * Encrypt text using AES-256-CBC
   *
   * @param {string} text - The plain text to encrypt
   * @param {Buffer} key - The AES encryption key
   * @param {Buffer} iv - The AES initialization vector
   * @returns {string} - The encrypted text in hex format
   */
  encrypt: (text, key, iv) => {
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  },

  /**
   * Decrypt text using AES-256-CBC
   *
   * @param {string} encryptedText - The encrypted text to decrypt
   * @param {Buffer} key - The AES encryption key
   * @param {Buffer} iv - The AES initialization vector
   * @returns {string} - The decrypted plain text
   */
  decrypt: (encryptedText, key, iv) => {
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
};

export default aesUtils;
