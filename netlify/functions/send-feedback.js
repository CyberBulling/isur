const nodemailer = require('nodemailer');

const jsonResponse = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  },
  body: JSON.stringify(body)
});

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { message: 'Метод не поддерживается' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return jsonResponse(400, { message: 'Некорректный формат данных' });
  }

  const firstName = String(payload.firstName || '').trim();
  const lastName = String(payload.lastName || '').trim();
  const email = String(payload.email || '').trim();
  const phone = String(payload.phone || '').trim();
  const subject = String(payload.subject || '').trim();
  const message = String(payload.message || '').trim();

  if (!firstName || !lastName || !email || !subject || !message) {
    return jsonResponse(400, { message: 'Заполните все обязательные поля' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse(400, { message: 'Некорректный email адрес' });
  }

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.error('GMAIL_USER и GMAIL_APP_PASSWORD не настроены в Netlify');
    return jsonResponse(500, { message: 'Сервис отправки сообщений не настроен' });
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });

  const safeFirstName = escapeHtml(firstName);
  const safeLastName = escapeHtml(lastName);
  const safeEmail = escapeHtml(email);
  const safePhone = escapeHtml(phone);
  const safeSubject = escapeHtml(subject);
  const safeMessage = escapeHtml(message);

  try {
    await transporter.sendMail({
      from: `"Сайт ИСУР" <${process.env.GMAIL_USER}>`,
      to: process.env.GMAIL_USER,
      replyTo: email,
      subject: `Сообщение с сайта: ${subject} от ${lastName} ${firstName}`,
      text: [
        `Тема обращения: ${subject}`,
        `Отправитель: ${lastName} ${firstName}`,
        `Email: ${email}`,
        phone ? `Телефон: ${phone}` : '',
        '',
        'Сообщение:',
        message
      ].filter(Boolean).join('\n'),
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#1b6db7">Новое сообщение с сайта ИСУР</h2>
          <p><strong>Тема обращения:</strong> ${safeSubject}</p>
          <p><strong>Отправитель:</strong> ${safeLastName} ${safeFirstName}</p>
          <p><strong>Email:</strong> ${safeEmail}</p>
          ${safePhone ? `<p><strong>Телефон:</strong> ${safePhone}</p>` : ''}
          <h3>Сообщение:</h3>
          <p style="white-space:pre-wrap">${safeMessage}</p>
        </div>
      `
    });

    return jsonResponse(200, { message: 'Сообщение отправлено успешно!' });
  } catch (error) {
    console.error('Ошибка при отправке сообщения:', error);
    return jsonResponse(500, { message: 'Ошибка при отправке сообщения' });
  }
};
