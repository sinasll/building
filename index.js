    /**********************
     * 1. Initialize Firebase
     **********************/
    const firebaseConfig = {
        apiKey: "AIzaSyAzXSCn_QL2XeyRZD71By443sl4wOtXf2Y",
        authDomain: "pipcore-8844f.firebaseapp.com",
        projectId: "pipcore-8844f",
        storageBucket: "pipcore-8844f.appspot.com",
        messagingSenderId: "921115337984",
        appId: "1:921115337984:web:17161651342ad78017bfe5"
      };
      firebase.initializeApp(firebaseConfig);
      const db = firebase.firestore();
      firebase.firestore().enablePersistence()
        .catch((err) => {
          console.error("Firebase persistence error:", err);
        });
      
      /**********************
       * Global Variables
       **********************/
      let miningInterval;
      let lastMiningUpdate = Date.now();
      let totalMinedTokens = 0;
      let isMiningActive = true;
      let miningStartTime = Date.now(); // checkpoint for elapsed time
      let userRef;
      
      /**********************
       * 2. User Management with Mining Integration
       **********************/
      async function initializeUser() {
        const tg = window.Telegram?.WebApp;
        const tgUser = tg?.initDataUnsafe?.user;
        
        const userId = tgUser?.id?.toString() || generateGuestId();
        userRef = db.collection('users').doc(userId);
        
        try {
          const doc = await userRef.get();
          const username = tgUser?.username || `guest_${userId.slice(-4)}`;
          
          if (!doc.exists) {
            await userRef.set({
              username: username,
              telegramUsername: tgUser?.username || null,
              referrals: 0,
              invitedBy: null,
              invitedByUsername: null,
              createdAt: firebase.firestore.FieldValue.serverTimestamp(),
              lastActive: firebase.firestore.FieldValue.serverTimestamp(),
              platform: tg ? 'telegram' : 'web',
              referralCode: generateReferralCode(userId),
              minedTokens: 0,
              lastMiningUpdate: firebase.firestore.FieldValue.serverTimestamp()
            });
          } else {
            totalMinedTokens = doc.data().minedTokens || 0;
            document.getElementById('token-count').textContent = totalMinedTokens.toFixed(3) + ' pCORE';
            
            await userRef.update({
              lastActive: firebase.firestore.FieldValue.serverTimestamp()
            });
          }
          
          return userRef;
        } catch (error) {
          console.error("User init error:", error);
          return userRef;
        }
      }
      
      // Helper to update tokens to Firestore using the elapsed time
      async function updateMinedTokens() {
        const now = Date.now();
        const elapsedSeconds = (now - miningStartTime) / 1000;
        const tokensMined = elapsedSeconds * 0.001;
        if (tokensMined > 0) {
          totalMinedTokens += tokensMined;
          document.getElementById('token-count').textContent = totalMinedTokens.toFixed(3) + ' pCORE';
          try {
            await userRef.update({
              minedTokens: firebase.firestore.FieldValue.increment(tokensMined),
              lastMiningUpdate: firebase.firestore.FieldValue.serverTimestamp()
            });
          } catch (error) {
            console.error("Error updating mined tokens:", error);
          }
          // Reset checkpoint
          miningStartTime = now;
        }
      }
      
      // Start mining function with robust elapsed tracking
      function startMining() {
        if (miningInterval) clearInterval(miningInterval);
        
        miningInterval = setInterval(async () => {
          if (isMiningActive) {
            const now = Date.now();
            const elapsedSeconds = (now - miningStartTime) / 1000;
            const tokensMined = elapsedSeconds * 0.001;
            // Update display without immediately committing to Firestore
            document.getElementById('token-count').textContent = (totalMinedTokens + tokensMined).toFixed(3) + ' pCORE';
            // If 10 seconds have passed, commit the update
            if (now - lastMiningUpdate > 10000) {
              await updateMinedTokens();
              lastMiningUpdate = now;
            }
          }
        }, 1000);
      }
      
      // Handle visibility changes to update tokens immediately when page is hidden/resumed
      function setupVisibilityHandler() {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            // Resuming: re-enable mining and reset the checkpoint
            isMiningActive = true;
            miningStartTime = Date.now();
            document.getElementById('mining-status').textContent = 'ON';
          } else {
            // Pausing: immediately update any pending tokens before pausing
            isMiningActive = false;
            document.getElementById('mining-status').textContent = 'PAUSED';
            updateMinedTokens().catch(console.error);
          }
        });
      }
      
      /**********************
       * 3. Enhanced Referral System
       **********************/
      async function checkReferral(currentUserRef) {
        const urlParams = new URLSearchParams(window.location.search);
        const referralCode = urlParams.get('start');
        
        if (!referralCode || referralCode === currentUserRef.id) return;
      
        try {
          const referrerRef = db.collection('users').doc(referralCode);
          const referrerDoc = await referrerRef.get();
          
          if (!referrerDoc.exists) {
            console.log("Invalid referral code");
            return;
          }
      
          const referrerData = referrerDoc.data();
          const referrerUsername = referrerData.telegramUsername || referrerData.username;
      
          const currentUserData = (await currentUserRef.get()).data();
          if (currentUserData.invitedBy && currentUserData.invitedBy !== referralCode) {
            console.log("User was already referred by someone else");
            return;
          }
          
          await db.runTransaction(async (transaction) => {
            transaction.update(referrerRef, {
              referrals: firebase.firestore.FieldValue.increment(1),
              lastReferral: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            transaction.update(currentUserRef, {
              invitedBy: referralCode,
              invitedByUsername: referrerUsername,
              referralDate: firebase.firestore.FieldValue.serverTimestamp()
            });
          });
          
          console.log(`Referred by @${referrerUsername}`);
          showAlert(`🎉 Thanks for joining via @${referrerUsername}'s link!`);
          
        } catch (error) {
          console.error("Referral error:", error);
        }
      }
      
      /**********************
       * 4. Helper Functions
       **********************/
      function generateGuestId() {
        let guestId = localStorage.getItem('guestId');
        if (!guestId) {
          guestId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
          localStorage.setItem('guestId', guestId);
        }
        return guestId;
      }
      
      function generateReferralCode(userId) {
        return btoa(userId).replace(/=/g, '').substr(-8);
      }
      
      function showAlert(message) {
        if (window.Telegram?.WebApp?.showAlert) {
          try {
            Telegram.WebApp.showAlert(message);
          } catch (e) {
            console.warn("Telegram alert failed:", e);
            alert(message);
          }
        } else {
          alert(message);
        }
      }
      
      function triggerHaptic() {
        if (window.Telegram?.WebApp?.HapticFeedback) {
          window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
        }
      }
      
      /**********************
       * 5. UI Updates with Real-time Data
       **********************/
      function setupRealtimeUpdates(userRef) {
        userRef.onSnapshot((doc) => {
          if (doc.exists) {
            const data = doc.data();
            document.getElementById('invite-count').textContent = data.referrals || 0;
            document.getElementById('username').textContent = `@${data.telegramUsername || data.username}`;
            document.getElementById('referral-link').value = `https://t.me/inbuild1bot?start=${userRef.id}`;
          }
        }, (error) => {
          console.error("Snapshot error:", error);
        });
      }
      
      /**********************
       * 6. Referral Button Handlers
       **********************/
      function setupReferralButtons(userRef) {
        const copyButton = document.getElementById('copy-referral-button');
        const sendButton = document.getElementById('send-referral-button');
        
        copyButton.addEventListener('click', () => {
          const referralLink = document.getElementById('referral-link').value;
          navigator.clipboard.writeText(referralLink).then(() => {
            showAlert('Link copied');
            triggerHaptic();
            userRef.update({
              lastCopied: firebase.firestore.FieldValue.serverTimestamp()
            }).catch(console.error);
          }).catch(err => {
            console.error('Failed to copy:', err);
            showAlert('Failed to copy link. Please try again.');
          });
        });
        
        sendButton.addEventListener('click', () => {
          const tg = window.Telegram?.WebApp;
          const referralLink = document.getElementById('referral-link').value;
          const message = `Join with me on PipCore - the ultimate trading journal mini app! ${referralLink}`;
          
          if (tg?.platform !== 'unknown' && tg?.sendData) {
            tg.sendData(JSON.stringify({
              action: 'share_referral',
              message: message
            }));
          } else if (navigator.share) {
            navigator.share({
              title: 'Join PipCore',
              text: 'Join the ultimate trading journal mini app!',
              url: referralLink
            }).catch(console.error);
          } else {
            navigator.clipboard.writeText(message).then(() => {
              showAlert('Invite message copied to clipboard! You can now paste it in Telegram.');
            }).catch(console.error);
          }
          
          triggerHaptic();
          userRef.update({
            lastShared: firebase.firestore.FieldValue.serverTimestamp()
          }).catch(console.error);
        });
      }
      
      /**********************
       * 7. Leaderboard System
       **********************/
      function setupLeaderboard() {
        const leaderboardList = document.getElementById('leaderboard-list');
        
        const unsubscribe = db.collection('users')
          .orderBy('minedTokens', 'desc')
          .limit(10)
          .onSnapshot(snapshot => {
            leaderboardList.innerHTML = '';
            
            snapshot.forEach((doc, index) => {
              const user = doc.data();
              const rank = index + 1;
              
              const item = document.createElement('div');
              item.className = 'leaderboard-item';
              item.innerHTML = `
                <div class="leaderboard-rank">#${rank}</div>
                <div class="leaderboard-user">${user.telegramUsername || user.username}</div>
                <div class="leaderboard-tokens">${user.minedTokens?.toFixed(3) || '0.000'} pCORE</div>
              `;
              
              leaderboardList.appendChild(item);
            });
            
            if (snapshot.empty) {
              leaderboardList.innerHTML = '<div class="loader">No miners yet. Be the first!</div>';
            }
          }, error => {
            console.error('Leaderboard error:', error);
            leaderboardList.innerHTML = '<div class="loader">Failed to load leaderboard</div>';
          });
        
        // Return unsubscribe function for cleanup
        return unsubscribe;
      }
      
      /**********************
       * 8. Initialization & Event Listeners
       **********************/
      document.addEventListener('DOMContentLoaded', async () => {
        // Telegram WebApp integration
        if (window.Telegram?.WebApp?.ready) {
          Telegram.WebApp.ready();
          if (Telegram.WebApp.expand) Telegram.WebApp.expand();
          const colorScheme = Telegram.WebApp.colorScheme;
          document.body.setAttribute('data-theme', colorScheme === 'dark' ? 'dark' : 'light');
        }
        
        // Theme toggle initialization
        const body = document.body;
        const themeToggle = document.getElementById('theme-toggle');
        const savedTheme = localStorage.getItem('theme') || 'dark';
        body.setAttribute('data-theme', savedTheme);
        if (themeToggle) {
          themeToggle.innerHTML = `<i class="fas ${savedTheme === 'dark' ? 'fa-moon' : 'fa-sun'}"></i>`;
          themeToggle.addEventListener('click', () => {
            const currentTheme = body.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            body.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            themeToggle.innerHTML = `<i class="fas ${newTheme === 'dark' ? 'fa-moon' : 'fa-sun'}"></i>`;
            triggerHaptic();
          });
        }
        
        // Initialize user, mining, referral, and real-time updates
        userRef = await initializeUser();
        startMining();
        setupVisibilityHandler();
        await checkReferral(userRef);
        setupRealtimeUpdates(userRef);
        setupReferralButtons(userRef);
        
        // Leaderboard initialization with cleanup on unload
        const unsubscribeLeaderboard = setupLeaderboard();
        window.addEventListener('beforeunload', () => {
          unsubscribeLeaderboard();
          if (isMiningActive && userRef) {
            updateMinedTokens();
          }
        });
        
        // Hamburger menu toggle
        const hamburger = document.getElementById('hamburger');
        const navMenu = document.getElementById('nav-menu');
        if (hamburger && navMenu) {
          hamburger.addEventListener('click', () => {
            navMenu.classList.toggle('active');
            hamburger.classList.toggle('active');
            triggerHaptic();
          });
        }
        
        // Active link highlighting for navigation
        const navLinks = document.querySelectorAll('.nav-list li a');
        navLinks.forEach(link => {
          link.addEventListener('click', function () {
            navLinks.forEach(link => link.classList.remove('active'));
            this.classList.add('active');
          });
        });
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        navLinks.forEach(link => {
          if (link.getAttribute('href') === currentPage) {
            link.classList.add('active');
          }
        });
      });