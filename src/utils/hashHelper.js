import bcrypt from 'bcryptjs';
import config from '../config';

/**
 * Utility for hashing and comparing values using bcrypt
 */
const hashUtils = {
    /**
     * Hash a plain text string
     *
     * @param {string} plainText - The plain text value to hash (e.g., password or token)
     * @returns {Promise<string>} - The hashed string
     */
    hash: async (plainText) => {
        try {
            const saltRounds = config.bcrypt.salt;
            const hashedValue = await bcrypt.hash(plainText, Number(saltRounds));
            return hashedValue;
        } catch (error) {
            throw new Error('Error hashing the value: ' + error.message);
        }
    },

    /**
     * Compare a plain text string with a hashed value
     *
     * @param {string} plainText - The plain text value to compare
     * @param {string} hashedValue - The stored hashed value to compare against
     * @returns {Promise<boolean>} - True if the values match, false otherwise
     */
    compare: async (plainText, hashedValue) => {
        try {
            const isMatch = await bcrypt.compare(plainText, hashedValue);
            return isMatch;
        } catch (error) {
            throw new Error('Error comparing the hash: ' + error.message);
        }
    }
};

export default hashUtils;
