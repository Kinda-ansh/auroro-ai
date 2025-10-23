import moment from "moment";
import axios from "axios";

const generateOTP = (length = 6) => {
  const digits = '0123456789';
  return Array.from(
    { length },
    () => digits[Math.floor(Math.random() * digits.length)]
  ).join('');
}

const sendOtp = (mobile, otp) => {
  const SMS_API_CONFIG = {
    baseURL: 'https://sms.troology.com/api/api_http.php',
    username: 'TROLGY1',
    password: 'Troology@109',
    senderid: 'TROLGY',
    type: 'text',
    route: 'Informative'
  };
  const message = encodeURIComponent(
    `Your Login OTP is ${otp}. Valid for only 5 minutes.`
  );

  const URL = `${SMS_API_CONFIG.baseURL}?username=${SMS_API_CONFIG.username}&password=${SMS_API_CONFIG.password}&senderid=${SMS_API_CONFIG.senderid}&to=${mobile}&text=${message}&type=${SMS_API_CONFIG.type}&route=${SMS_API_CONFIG.route}`;
  return axios.get(URL);
}

function getISTDateTime() {
  const now = new Date();

  const istOffset = 5.5 * 60; // IST offset in minutes
  const istTime = new Date(now.getTime() + (istOffset + now.getTimezoneOffset()) * 60000);

  const year = istTime.getFullYear();
  const month = String(istTime.getMonth() + 1).padStart(2, '0');
  const day = String(istTime.getDate()).padStart(2, '0');
  const hours = String(istTime.getHours()).padStart(2, '0');
  const minutes = String(istTime.getMinutes()).padStart(2, '0');
  const seconds = String(istTime.getSeconds() + 1).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export const miscellaneousUtils = {
  generateOTP,
  sendOtp
}