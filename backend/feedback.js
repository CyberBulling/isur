// Мобильное меню
document.getElementById('mobileMenuBtn').addEventListener('click', function() {
    const nav = document.getElementById('mainNav');
    const isVisible = nav.style.display === 'flex';
    nav.style.display = isVisible ? 'none' : 'flex';
    
    if (window.innerWidth <= 768 && !isVisible) {
        nav.style.flexDirection = 'column';
        nav.style.position = 'absolute';
        nav.style.top = '100%';
        nav.style.left = '0';
        nav.style.right = '0';
        nav.style.background = 'linear-gradient(to right, #1D5DEB, #3A7BFF)';
        nav.style.padding = '20px';
        nav.style.gap = '15px';
        nav.style.zIndex = '1000';
    }
});

// Адаптивное меню
window.addEventListener('resize', function() {
    const nav = document.getElementById('mainNav');
    if (window.innerWidth > 768) {
        nav.style.display = 'flex';
        nav.style.flexDirection = 'row';
        nav.style.position = 'static';
        nav.style.background = 'none';
        nav.style.padding = '0';
    } else {
        nav.style.display = 'none';
    }
});

// Функция проверки email
/*function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Валидация в реальном времени
function validateField(fieldId, groupId, validator) {
    const field = document.getElementById(fieldId);
    const group = document.getElementById(groupId);
    const value = field.value.trim();
    
    if (field.hasAttribute('required') && !value) {
        field.classList.remove('valid');
        field.classList.add('error');
        group.classList.add('error');
        return false;
    }
    
    if (value && validator && !validator(value)) {
        field.classList.remove('valid');
        field.classList.add('error');
        group.classList.add('error');
        return false;
    }
    
    if (value && (!validator || validator(value))) {
        field.classList.remove('error');
        field.classList.add('valid');
        group.classList.remove('error');
        return true;
    }
    
    // Для необязательных полей убираем классы если пусто
    if (!field.hasAttribute('required') && !value) {
        field.classList.remove('error', 'valid');
        group.classList.remove('error');
        return true;
    }
    
    return true;
}

// Валидация имени и фамилии
function validateName(name) {
    return name.length >= 2 && /^[а-яА-ЯёЁa-zA-Z\s-]+$/.test(name);
}

// Валидация телефона (необязательное поле)
function validatePhone(phone) {
    if (!phone) return true;
    return /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/.test(phone);
}

// Настройка валидации в реальном времени
document.getElementById('firstName').addEventListener('input', function() {
    validateField('firstName', 'firstNameGroup', validateName);
});

document.getElementById('firstName').addEventListener('blur', function() {
    validateField('firstName', 'firstNameGroup', validateName);
});

document.getElementById('lastName').addEventListener('input', function() {
    validateField('lastName', 'lastNameGroup', validateName);
});

document.getElementById('lastName').addEventListener('blur', function() {
    validateField('lastName', 'lastNameGroup', validateName);
});

document.getElementById('email').addEventListener('input', function() {
    validateField('email', 'emailGroup', isValidEmail);
});

document.getElementById('email').addEventListener('blur', function() {
    validateField('email', 'emailGroup', isValidEmail);
});

document.getElementById('phone').addEventListener('input', function() {
    validateField('phone', 'phoneGroup', validatePhone);
});

document.getElementById('phone').addEventListener('blur', function() {
    validateField('phone', 'phoneGroup', validatePhone);
});

document.getElementById('subject').addEventListener('change', function() {
    validateField('subject', 'subjectGroup');
});

const messageValidator = function(msg) {
    return msg.length >= 10;
};

document.getElementById('message').addEventListener('input', function() {
    validateField('message', 'messageGroup', messageValidator);
});

document.getElementById('message').addEventListener('blur', function() {
    validateField('message', 'messageGroup', messageValidator);
});
*/
// Обработка формы - отправка через бэкенд API
document.getElementById('contactForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // Собираем данные
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const subject = document.getElementById('subject').value;
    const message = document.getElementById('message').value.trim();
    
    // Валидация всех полей
    let isValid = true;
    /*isValid &= validateField('firstName', 'firstNameGroup', validateName);
    isValid &= validateField('lastName', 'lastNameGroup', validateName);
    isValid &= validateField('email', 'emailGroup', isValidEmail);
    isValid &= validateField('phone', 'phoneGroup', validatePhone);
    isValid &= validateField('subject', 'subjectGroup');
    isValid &= validateField('message', 'messageGroup', messageValidator);*/
    
    if (!isValid) {
        showAlert('Пожалуйста, исправьте ошибки в форме', 'error');
        return;
    }
    
    // Кнопка отправки
    const submitButton = this.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = 'Отправка...';
    
    try {
        // Отправка через бэкенд API
        const response = await fetch('http://localhost:5000/api/send-feedback', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                firstName,
                lastName,
                email,
                phone: phone || null,
                subject,
                message
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert(result.message || 'Ваше сообщение отправлено успешно! Мы свяжемся с вами в ближайшее время.', 'success');
            
            // Очистка формы
            setTimeout(() => {
                document.getElementById('contactForm').reset();
                // Убираем классы валидации
                document.querySelectorAll('.form-group input, .form-group select, .form-group textarea').forEach(el => {
                    el.classList.remove('error', 'valid');
                });
                document.querySelectorAll('.form-group').forEach(el => {
                    el.classList.remove('error');
                });
            }, 1000);
        } else {
            throw new Error(result.message || 'Ошибка при отправке');
        }
    } catch (error) {
        console.error('Ошибка при отправке формы:', error);
        let errorMessage = 'Ошибка при отправке сообщения. ';
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            errorMessage += 'Сервер не запущен или недоступен. Запустите сервер: cd backend && npm start';
        } else {
            errorMessage += error.message;
        }
        showAlert(errorMessage, 'error');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
    }
});

// Функция показа уведомлений
function showAlert(message, type) {
    const alertBox = document.getElementById('alertBox');
    alertBox.textContent = message;
    alertBox.className = `alert alert-${type}`;
    alertBox.style.display = 'block';
    
    setTimeout(() => {
        alertBox.style.display = 'none';
    }, 5000);
}

// FAQ аккордеон
const faqQuestions = document.querySelectorAll('.faq-question');
faqQuestions.forEach(question => {
    question.addEventListener('click', () => {
        const item = question.parentElement;
        item.classList.toggle('faq-active');
        
        const icon = question.querySelector('i');
        if (item.classList.contains('faq-active')) {
            icon.className = 'fas fa-chevron-up';
        } else {
            icon.className = 'fas fa-chevron-down';
        }
    });
});

