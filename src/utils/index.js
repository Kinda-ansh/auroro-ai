export const parseCookies = (cookieHeader = '') =>
  cookieHeader.split(';').reduce((cookies, cookie) => {
    const [name, value] = cookie.split('=').map((c) => c.trim());
    cookies[name] = decodeURIComponent(value);
    return cookies;
  }, {});
