import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export const IST = 'Asia/Kolkata';
export const getISTNow = () => dayjs().tz(IST);

export default dayjs;
