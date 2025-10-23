/**
 * Utility function to validate if the input time matches the specified period.
 * @param {string|number} time - The time to validate. Can be a Date string or a number (milliseconds).
 * @param {string|number} period - The period to compare the time against. Can be a predefined period label, numeric duration, or custom string (e.g., '5m', '2h', '1d').
 * @returns {boolean} - Returns true if the time is valid for the given period, false otherwise.
 * @throws {Error} - Throws an error if the time format is invalid or period is not recognized.
 */
const validateTime = (time, period) => {
    const now = Date.now(); // Current timestamp
    const inputTime = new Date(time).getTime(); // Convert the input time to milliseconds

    // Validate if the input time is a valid number
    if (isNaN(inputTime)) {
        throw new Error('Invalid time format');
    }

    // Handle custom durations in string format (e.g., '5m', '2h', '1d')
    if (typeof period === 'string' && period.match(/^\d+[mhdw\.]/)) {
        const duration = parseDuration(period);
        return inputTime >= now - duration && inputTime <= now;
    }

    // Handle numeric durations (e.g., 5 minutes in milliseconds)
    if (typeof period === 'number') {
        return inputTime >= now - period && inputTime <= now;
    }

    // Handle predefined period labels
    switch (period) {
        case 'past':
            return inputTime < now; // Time should be in the past
        case 'future':
            return inputTime >= now; // Time should be in the future
        case 'within24hours':
            return inputTime >= now - 24 * 60 * 60 * 1000 && inputTime <= now; // Time within the last 24 hours
        case 'today':
            const startOfDay = new Date(now).setHours(0, 0, 0, 0); // Start of today
            const endOfDay = new Date(now).setHours(23, 59, 59, 999); // End of today
            return inputTime >= startOfDay && inputTime <= endOfDay; // Time within today
        default:
            throw new Error('Invalid period specified'); // Invalid period
    }
};

/**
 * Helper function to parse custom time durations like '5m', '2h', '1d', '2h3m', etc.
 * Converts a string duration into total milliseconds.
 * @param {string} duration - The custom time duration (e.g., '5m', '2h', '1d').
 * @returns {number} - The total duration in milliseconds.
 * @throws {Error} - Throws an error if the duration format is unsupported.
 */
const parseDuration = (duration) => {
    let totalMilliseconds = 0;

    // Regular expression to match numbers followed by time unit (m, h, d, w)
    const regex = /(\d+\.?\d*)([mhdw])/g;
    let match;

    // Loop through all matches and calculate total milliseconds
    while ((match = regex.exec(duration)) !== null) {
        const value = parseFloat(match[1]);
        const unit = match[2];

        switch (unit) {
            case 'm':
                totalMilliseconds += value * 60 * 1000; // Minutes to milliseconds
                break;
            case 'h':
                totalMilliseconds += value * 60 * 60 * 1000; // Hours to milliseconds
                break;
            case 'd':
                totalMilliseconds += value * 24 * 60 * 60 * 1000; // Days to milliseconds
                break;
            case 'w':
                totalMilliseconds += value * 7 * 24 * 60 * 60 * 1000; // Weeks to milliseconds
                break;
            default:
                throw new Error('Unsupported duration format'); // Unsupported unit
        }
    }

    return totalMilliseconds; // Return the total duration in milliseconds
};

// Export the validateTime function using ES6 export
export default validateTime;
