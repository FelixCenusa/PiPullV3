const form = document.querySelector('#registerForm');

form.addEventListener('submit', function(event) {
    event.preventDefault();
    const response = grecaptcha.getResponse();
    if (!response) {
        alert('Please complete the reCAPTCHA challenge.');
    } else {
        form.submit();
    }
});

