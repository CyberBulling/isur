const express = require('express');
const nodemailer = require('nodemailer');
const router = express.Router();

// Маршрут для отправки обратной связи
router.post('/send-feedback', async (req, res) => {
  const { firstName, lastName, email, phone, subject, message } = req.body;

  // 🔹 Валидация обязательных полей
  if (!firstName || !lastName || !email || !subject || !message) {
    return res.status(400).json({ message: "Заполните все обязательные поля" });
  }

  // 🔹 Валидация email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: "Некорректный email адрес" });
  }

  // 🔹 Настройка транспортера Nodemailer через Gmail
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER, // из .env
      pass: process.env.GMAIL_APP_PASSWORD // из .env
    }
  });

  // 🔹 Формирование письма
  const mailOptions = {
    from: `"Сайт ИСУР" <${process.env.GMAIL_USER}>`,
    to: process.env.GMAIL_USER, // можно поменять на другой почтовый адрес
    replyTo: email,
    subject: `Сообщение с сайта: ${subject} от ${lastName} ${firstName}`,
    text: `
📧 Тема обращения: ${subject}
👤 Отправитель: ${lastName} ${firstName}
📩 Email: ${email}
${phone ? `📞 Телефон: ${phone}` : ''}

💬 Сообщение:
${message}
    `,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1B6DB7;">Новое сообщение с сайта ИСУР</h2>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Тема обращения:</strong> ${subject}</p>
          <p><strong>Отправитель:</strong> ${lastName} ${firstName}</p>
          <p><strong>Email:</strong> ${email}</p>
          ${phone ? `<p><strong>Телефон:</strong> ${phone}</p>` : ''}
        </div>
        <div style="background: #fff; padding: 20px; border-left: 4px solid #1B6DB7; margin: 20px 0;">
          <h3>Сообщение:</h3>
          <p style="white-space: pre-wrap;">${message}</p>
        </div>
      </div>
    `
  };

  // 🔹 Отправка письма
  try {
    await transporter.sendMail(mailOptions);
    res.json({ message: "Сообщение отправлено успешно!" });
  } catch (error) {
    console.error("Ошибка при отправке:", error);
    res.status(500).json({
      message: "Ошибка при отправке сообщения",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
