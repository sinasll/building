// Telegram WebApp Initialization
const tg = window.Telegram.WebApp;
tg.expand();

// DOM Elements
const registrationSection = document.getElementById('registration');
const dashboardSection = document.getElementById('dashboard');
const emailInput = document.getElementById('email');
const usernameInput = document.getElementById('username');
const submitBtn = document.getElementById('submitBtn');
const tgAvatar = document.getElementById('tgAvatar');

// User Data
let userData = {
  email: '',
  username: '',
  walletAddress: '',
  tgData: tg.initDataUnsafe.user || {}
};

// Initialize Telegram avatar if available
if (userData.tgData.photo_url) {
  tgAvatar.src = userData.tgData.photo_url;
} else {
  tgAvatar.src = 'logo.PNG';
}

// Form Validation
function validateForm() {
  const emailValid = emailInput.value.includes('@');
  const usernameValid = usernameInput.value.length >= 3;
  const walletConnected = userData.walletAddress !== '';
  
  submitBtn.disabled = !(emailValid && usernameValid && walletConnected);
}

// Username Availability Check
usernameInput.addEventListener('input', async (e) => {
  const username = e.target.value;
  const statusElement = document.getElementById('usernameStatus');
  
  if (username.length < 3) {
    statusElement.textContent = 'Username must be at least 3 characters';
    statusElement.style.color = 'var(--error-color)';
    return;
  }
  
  // Simulate API call
  const { available } = await checkUsernameAvailability(username);
  statusElement.textContent = available ? '✅ Available' : '❌ Taken';
  statusElement.style.color = available ? 'var(--success-color)' : 'var(--error-color)';
  userData.username = username;
  validateForm();
});

// Email Validation
emailInput.addEventListener('input', () => {
  userData.email = emailInput.value;
  validateForm();
});

// Form Submission
document.getElementById('registrationForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  try {
    // Submit to backend (simulated)
    const mockResponse = await submitRegistration(userData);
    
    if (mockResponse.success) {
      // Show dashboard
      registrationSection.style.display = 'none';
      dashboardSection.style.display = 'block';
      
      // Populate profile data
      document.getElementById('profileUsername').textContent = 
        userData.username || userData.tgData.username || 'Player';
      document.getElementById('profileEmail').textContent = userData.email;
      document.getElementById('profileWallet').textContent = 
        userData.walletAddress.substring(0, 6) + '...' + userData.walletAddress.substring(userData.walletAddress.length - 4);
      
      triggerHaptic();
    }
  } catch (error) {
    showError('Registration failed: ' + error.message);
  }
});

// Helper Functions
async function checkUsernameAvailability(username) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({ available: Math.random() > 0.3 }); // 70% chance of being available
    }, 500);
  });
}

async function submitRegistration(data) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({ success: true });
    }, 1000);
  });
}

function triggerHaptic() {
  if (tg.isVersionAtLeast('6.1')) {
    tg.HapticFeedback.impactOccurred('light');
  }
}

function showError(message) {
  tg.showAlert(message);
}