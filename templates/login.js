document.addEventListener('DOMContentLoaded', () => {
    const modeToggle = document.getElementById('mode-toggle');
    const sunIcon = document.getElementById('sun-icon');
    const moonIcon = document.getElementById('moon-icon');
    const body = document.body;

    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const formTitle = document.getElementById('form-title');
    const toggleFormBtn = document.getElementById('toggle-form-btn');
    const toggleText = document.getElementById('toggle-text');

    const userProfileArea = document.getElementById('user-profile-area');
    const loginButton = document.getElementById('login-button');

    // --- Dark/Light Mode Toggle ---
    const currentTheme = localStorage.getItem('theme');
    if (currentTheme === 'dark') {
        body.classList.add('dark');
        body.classList.remove('light');
        sunIcon.classList.add('hidden');
        moonIcon.classList.remove('hidden');
    } else {
        body.classList.add('light');
        body.classList.remove('dark');
        sunIcon.classList.remove('hidden');
        moonIcon.classList.add('hidden');
    }

    modeToggle.addEventListener('click', () => {
        body.classList.toggle('dark');
        body.classList.toggle('light');
        sunIcon.classList.toggle('hidden');
        moonIcon.classList.toggle('hidden');

        if (body.classList.contains('dark')) {
            localStorage.setItem('theme', 'dark');
        } else {
            localStorage.setItem('theme', 'light');
        }
    });

    // --- Login/Signup Form Toggle ---
    toggleFormBtn.addEventListener('click', () => {
        if (loginForm.classList.contains('hidden')) {
            // Currently showing signup, switch to login
            loginForm.classList.remove('hidden');
            signupForm.classList.add('hidden');
            formTitle.textContent = 'Login';
            toggleText.textContent = "Don't have an account?";
            toggleFormBtn.textContent = 'Sign Up';
        } else {
            // Currently showing login, switch to signup
            loginForm.classList.add('hidden');
            signupForm.classList.remove('hidden');
            formTitle.textContent = 'Sign Up';
            toggleText.textContent = "Already have an account?";
            toggleFormBtn.textContent = 'Login';
        }
    });

    // --- Simulated Login State ---
    // In a real application, this would be managed by a backend
    // and session/token storage.
    let isLoggedIn = false; // Initial state

    function updateLoginStateUI() {
        if (isLoggedIn) {
            userProfileArea.classList.remove('hidden');
            loginButton.classList.add('hidden');
        } else {
            userProfileArea.classList.add('hidden');
            loginButton.classList.remove('hidden');
        }
    }

    // Initialize UI based on login state
    updateLoginStateUI();

    // Simulate successful login/signup
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        alert('Login successful! (Simulated)');
        isLoggedIn = true;
        updateLoginStateUI();
        // Redirect to dashboard or home page in a real app
        // window.location.href = 'index.html'; 
    });

    signupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const password = document.getElementById('signup-password').value;
        const confirmPassword = document.getElementById('signup-confirm-password').value;

        if (password !== confirmPassword) {
            alert("Passwords do not match!");
            return;
        }

        alert('Signup successful! (Simulated)');
        isLoggedIn = true;
        updateLoginStateUI();
        // Redirect to dashboard or home page in a real app
        // window.location.href = 'index.html';
    });

    // Handle the "Login" button click when not logged in
    loginButton.addEventListener('click', () => {
        // Here you would typically redirect to the login page or open a modal
        alert('Navigating to login page...');
        // For this example, if the current page *is* the login page, we'll just log in.
        // In a real app, this button would be on a *different* page to bring you *to* login.
        isLoggedIn = true; // Simulating successful login after clicking the button
        updateLoginStateUI();
    });
});