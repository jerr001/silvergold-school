// Theme toggle functionality
const themeToggle = document.getElementById('themeToggle');
const body = document.body;

function toggleTheme() {
    const currentTheme = body.getAttribute('data-theme');
    if (currentTheme === 'dark') {
        body.removeAttribute('data-theme');
        themeToggle.textContent = '🌙';
        localStorage.setItem('theme', 'light');
    } else {
        body.setAttribute('data-theme', 'dark');
        themeToggle.textContent = '☀️';
        localStorage.setItem('theme', 'dark');
    }
}

// Load saved theme
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') {
    body.setAttribute('data-theme', 'dark');
    themeToggle.textContent = '☀️';
} else {
    themeToggle.textContent = '🌙';
}

themeToggle.addEventListener('click', toggleTheme);

// Mobile menu toggle
const hamburger = document.querySelector('.hamburger');
const navLinks = document.querySelector('.nav-links');

hamburger.addEventListener('click', () => {
    navLinks.classList.toggle('active');
    hamburger.classList.toggle('active');
});

// Close mobile menu when clicking on a link
const navItems = document.querySelectorAll('.nav-links a');
navItems.forEach(item => {
    item.addEventListener('click', () => {
        navLinks.classList.remove('active');
        hamburger.classList.remove('active');
    });
});

// Contact form validation and submission
const contactForm = document.getElementById('contactForm');
const formStatus = document.getElementById('formStatus');

if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const name = document.getElementById('name').value.trim();
        const email = document.getElementById('email').value.trim();
        const message = document.getElementById('message').value.trim();

        let isValid = true;
        let errorMessage = '';

        // Name validation
        if (name === '') {
            isValid = false;
            errorMessage += 'Name is required.\n';
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (email === '') {
            isValid = false;
            errorMessage += 'Email is required.\n';
        } else if (!emailRegex.test(email)) {
            isValid = false;
            errorMessage += 'Please enter a valid email address.\n';
        }

        // Message validation
        if (message === '') {
            isValid = false;
            errorMessage += 'Message is required.\n';
        }

        if (!isValid) {
            alert('Please correct the following errors:\n' + errorMessage);
            return;
        }

        // Show sending state
        const submitBtn = contactForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Sending...';
        submitBtn.disabled = true;
        formStatus.style.display = 'none';

        // Submit to the school server API.
        const formData = {
            name: name,
            email: email,
            message: message
        };

        fetch('/api/contact', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(formData)
        })
          .then(async response => {
              const data = await response.json().catch(() => ({}));
              if (!response.ok || !data.ok) {
                  throw new Error(data.error || `The school server could not accept your message (HTTP ${response.status}).`);
              }
              return data;
          })
          .then(data => {
              formStatus.textContent = data.message || 'Thank you. We have received your message. Please check your email address for a response.';
              formStatus.style.color = '#28a745';
              formStatus.style.display = 'block';
              contactForm.reset();
          })
          .catch(error => {
              formStatus.textContent = error.message === 'Failed to fetch'
                  ? 'Cannot reach the school server. Open the website through http://localhost:3000, then try again.'
                  : (error.message || 'Sorry, something went wrong. Please try again later.');
            formStatus.style.color = '#dc3545';
            formStatus.style.display = 'block';
        })
        .finally(() => {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        });
    });
}

// Smooth scrolling for anchor links (if needed)
const anchorLinks = document.querySelectorAll('a[href^="#"]');
anchorLinks.forEach(link => {
    link.addEventListener('click', function(e) {
        e.preventDefault();
        const targetId = this.getAttribute('href').substring(1);
        const targetElement = document.getElementById(targetId);

        if (targetElement) {
            targetElement.scrollIntoView({
                behavior: 'smooth'
            });
        }
    });
});

// Intersection Observer for animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe elements for animations
document.addEventListener('DOMContentLoaded', () => {
    const animatedElements = document.querySelectorAll('.fade-in-up, .slide-in-left, .slide-in-right');
    animatedElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        observer.observe(el);
    });

    // Active menu highlighting
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('.nav-links a');

    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPage) {
            link.classList.add('active');
        }
    });

});

// Gallery lightbox functionality
const galleryCards = document.querySelectorAll('.gallery-card');
const imageModal = document.getElementById('imageModal');
const modalImage = document.getElementById('modalImage');
const modalClose = document.querySelector('.modal-close');
const modalPrev = document.querySelector('.modal-prev');
const modalNext = document.querySelector('.modal-next');

let currentImageIndex = 0;
const images = Array.from(galleryCards).map(card => ({
    src: card.dataset.image,
    alt: card.dataset.alt
}));

if (galleryCards.length > 0) {
    // Open modal on gallery card click
    galleryCards.forEach((card, index) => {
        card.addEventListener('click', () => {
            currentImageIndex = index;
            openModal();
        });
    });

    // Close modal
    modalClose.addEventListener('click', closeModal);
    imageModal.addEventListener('click', (e) => {
        if (e.target === imageModal) {
            closeModal();
        }
    });

    // Navigation
    modalPrev.addEventListener('click', (e) => {
        e.stopPropagation();
        currentImageIndex = (currentImageIndex - 1 + images.length) % images.length;
        updateModalImage();
    });

    modalNext.addEventListener('click', (e) => {
        e.stopPropagation();
        currentImageIndex = (currentImageIndex + 1) % images.length;
        updateModalImage();
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (imageModal.classList.contains('active')) {
            if (e.key === 'Escape') {
                closeModal();
            } else if (e.key === 'ArrowLeft') {
                currentImageIndex = (currentImageIndex - 1 + images.length) % images.length;
                updateModalImage();
            } else if (e.key === 'ArrowRight') {
                currentImageIndex = (currentImageIndex + 1) % images.length;
                updateModalImage();
            }
        }
    });
}

function openModal() {
    imageModal.classList.add('active');
    updateModalImage();
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    imageModal.classList.remove('active');
    document.body.style.overflow = 'auto';
}

function updateModalImage() {
    const image = images[currentImageIndex];
    modalImage.src = image.src;
    modalImage.alt = image.alt;
}

// Submit admission applications to the school's API.
const admissionForm = document.getElementById('admissionForm');
if (admissionForm) {
    const admissionStatus = document.getElementById('admissionStatus');
    admissionForm.addEventListener('submit', async event => {
        event.preventDefault();
        if (!admissionForm.reportValidity()) return;
        const button = admissionForm.querySelector('button[type="submit"]');
        button.disabled = true;
        button.textContent = 'Submitting…';
        admissionStatus.textContent = '';
        try {
            const response = await fetch('/api/admissions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(Object.fromEntries(new FormData(admissionForm)))
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Unable to submit your application.');
            admissionStatus.textContent = `Thank you. Your application was received. Reference: ${result.reference}`;
            admissionStatus.style.color = '#17633a';
            admissionForm.reset();
        } catch (error) {
            admissionStatus.textContent = error.message;
            admissionStatus.style.color = '#a73737';
        } finally {
            button.disabled = false;
            button.textContent = 'Submit Application';
        }
    });
}
