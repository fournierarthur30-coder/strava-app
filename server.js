require('dotenv').config();
const express = require('express');
const path = require("path");
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
const CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

app.use(express.static(path.join(__dirname, "public")));

let userTokens = {};
let trainingProgress = {};

// Page d'accueil avec connexion Strava
app.get('/', function(req, res) {
  res.send('<html><head><title>Tirte Running</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;background:#000;color:#fff}.welcome{text-align:center;padding:60px 20px}.logo{width:80px;height:80px;margin:0 auto 20px}.logo img{width:100%;height:100%;border-radius:50%}.welcome h1{font-size:32px;margin-bottom:12px}.welcome p{font-size:16px;color:#888;margin-bottom:32px}.btn{background:#3b82f6;color:#fff;padding:14px 24px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600;width:90%;max-width:300px}.features{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:32px;max-width:300px;margin-left:auto;margin-right:auto}.feature{background:#111;padding:16px;border-radius:8px;border:1px solid #222;font-size:14px;color:#888}</style></head><body><div class="welcome"><div class="logo"><img src="/logo.png" alt="Logo"></div><h1>Tirte Running</h1><p>Analyse tes performances<br>et progresse</p><a href="/auth/strava" class="btn">Se connecter avec Strava</a><div class="features"><div class="feature">📊 Graphiques</div><div class="feature">🏆 Records</div><div class="feature">🔮 Prédictions</div><div class="feature">🎯 Programme</div></div></div></body></html>');
});

// Auth Strava
app.get('/auth/strava', function(req, res) {
  const authUrl = STRAVA_AUTH_URL + '?client_id=' + CLIENT_ID + '&response_type=code&redirect_uri=' + REDIRECT_URI + '&approval_prompt=force&scope=read,activity:read_all,profile:read_all';
  res.redirect(authUrl);
});

app.get('/auth/strava/callback', async function(req, res) {
  const authCode = req.query.code;
  if (!authCode) return res.send('Erreur: Pas de code autorisation');

  try {
    const tokenResponse = await axios.post(STRAVA_TOKEN_URL, {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code: authCode,
      grant_type: 'authorization_code'
    });

    const data = tokenResponse.data;
    userTokens[data.athlete.id] = { 
      accessToken: data.access_token, 
      refreshToken: data.refresh_token, 
      expiresAt: data.expires_at, 
      athlete: data.athlete 
    };
    res.redirect('/dashboard');
  } catch (error) {
    res.send('Erreur authentification');
  }
});

// Dashboard
app.get('/dashboard', async function(req, res) {
  const athleteId = Object.keys(userTokens)[0];
  if (!athleteId) return res.redirect('/');
  const user = userTokens[athleteId];

  try {
    let allActivities = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore && page <= 10) {
      const activitiesResponse = await axios.get('https://www.strava.com/api/v3/athlete/activities', {
        headers: { 'Authorization': 'Bearer ' + user.accessToken },
        params: { per_page: 200, page: page }
      });
      
      const activities = activitiesResponse.data;
      if (activities.length === 0) {
        hasMore = false;
      } else {
        allActivities = allActivities.concat(activities);
        page++;
      }
    }

    const runs = allActivities.filter(function(a) { return a.type === 'Run'; });
    const badges = calculateBadgesWithLocked(runs, athleteId);
    
    let badgesHTML = '';
    if (badges.unlocked.length > 0) {
      badgesHTML = '<div class="section-title">🏆 Badges débloqués (' + badges.unlocked.length + ') <button class="view-all-btn" onclick="openBadgesModal()">Voir tout</button></div><div class="badges-grid">';
      for (let i = 0; i < Math.min(4, badges.unlocked.length); i++) {
        const badge = badges.unlocked[i];
        badgesHTML += '<div class="badge-card level-' + badge.level + '"><div class="badge-icon">' + badge.icon + '</div><div class="badge-name">' + badge.name + '</div><div class="badge-desc">' + badge.desc + '</div>';
        if (badge.stats) badgesHTML += '<div class="badge-stats">' + badge.stats + '</div>';
        badgesHTML += '</div>';
      }
      badgesHTML += '</div>';
    }
    
    let activitiesHTML = '<div class="section-title">Activités récentes</div>';
    for (let i = 0; i < Math.min(20, allActivities.length); i++) {
      const a = allActivities[i];
      const dist = (a.distance / 1000).toFixed(1);
      const dur = Math.floor(a.moving_time / 60);
      const date = new Date(a.start_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      const paceSeconds = a.distance > 0 ? a.moving_time / (a.distance / 1000) : 0;
      const paceMin = Math.floor(paceSeconds / 60);
      const paceSec = Math.round(paceSeconds % 60);
      const pace = paceMin + ':' + String(paceSec).padStart(2, '0');
      
      activitiesHTML += '<div class="activity" onclick="window.location.href=\'/activity/' + a.id + '\'"><h3>' + a.name + '</h3><div class="stats"><div>📅 ' + date + '</div><div>📏 ' + dist + ' km</div><div>⏱️ ' + dur + ' min</div><div>⚡ ' + pace + ' /km</div></div></div>';
    }
    
    let modalUnlockedHTML = '';
    for (let i = 0; i < badges.unlocked.length; i++) {
      const badge = badges.unlocked[i];
      modalUnlockedHTML += '<div class="badge-card level-' + badge.level + '"><div class="badge-icon">' + badge.icon + '</div><div class="badge-name">' + badge.name + '</div><div class="badge-desc">' + badge.desc + '</div>';
      if (badge.stats) modalUnlockedHTML += '<div class="badge-stats">' + badge.stats + '</div>';
      modalUnlockedHTML += '</div>';
    }
    
    let modalLockedHTML = '';
    for (let i = 0; i < badges.locked.length; i++) {
      const badge = badges.locked[i];
      modalLockedHTML += '<div class="badge-card locked level-' + badge.level + '"><div class="badge-icon">' + badge.icon + '</div><div class="badge-name">' + badge.name + '</div><div class="badge-desc">' + badge.desc + '</div>';
      if (badge.requirement) modalLockedHTML += '<div class="badge-stats">' + badge.requirement + '</div>';
      modalLockedHTML += '</div>';
    }
    
    const html = '<html><head><title>Dashboard</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;background:#0a0a0a;color:#e0e0e0;padding-bottom:70px}.header{background:#111;padding:20px 16px;border-bottom:1px solid #222}h1{font-size:24px;font-weight:600;margin-bottom:4px;color:#fff}.subtitle{font-size:14px;color:#888}.container{padding:16px}.section-title{font-size:18px;font-weight:600;margin:20px 0 12px 0;color:#fff}.view-all-btn{background:#3b82f6;color:#fff;padding:8px 16px;border-radius:20px;font-size:12px;font-weight:500;border:none;cursor:pointer;margin-left:12px}.badges-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin:16px 0}.badge-card{background:#111;border-radius:12px;padding:16px;border:2px solid #222;display:flex;flex-direction:column;gap:8px}.badge-card.level-1{border-color:#3b82f6}.badge-card.level-2{border-color:#ef4444}.badge-card.level-3{border-color:#fbbf24}.badge-card.locked{opacity:0.4;filter:grayscale(1)}.badge-icon{font-size:40px;text-align:center}.badge-icon img{width:60px;height:60px}.badge-name{font-size:14px;font-weight:600;color:#fff}.badge-desc{font-size:11px;color:#888;line-height:1.4}.badge-stats{font-size:10px;color:#3b82f6;margin-top:4px}.badge-card.level-2 .badge-stats{color:#ef4444}.badge-card.level-3 .badge-stats{color:#fbbf24}.activity{background:#111;border-radius:12px;padding:16px;margin-bottom:12px;border:1px solid #222}.activity h3{font-size:16px;font-weight:600;margin-bottom:8px;color:#fff}.stats{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;font-size:13px;color:#888}.bottom-nav{position:fixed;bottom:0;left:0;right:0;background:#111;border-top:1px solid #222;display:grid;grid-template-columns:repeat(5,1fr);padding:8px 0;z-index:1000}.nav-item{display:flex;flex-direction:column;align-items:center;padding:6px;text-decoration:none;color:#888;font-size:10px;transition:all .2s}.nav-item.active{color:#3b82f6}.nav-icon{font-size:20px;margin-bottom:2px}.modal{display:none;position:fixed;z-index:2000;left:0;top:0;width:100%;height:100%;background-color:rgba(0,0,0,0.95);overflow-y:auto}.modal.active{display:block}.modal-content{background-color:#0a0a0a;margin:20px;padding:20px;border-radius:16px;border:1px solid #222}.close{color:#888;float:right;font-size:32px;font-weight:bold;cursor:pointer;line-height:1}.close:hover{color:#fff}.modal-title{font-size:24px;font-weight:700;color:#fff;margin-bottom:20px;clear:both}.modal-section{margin:30px 0}.modal-section h3{font-size:16px;color:#888;margin-bottom:16px;text-transform:uppercase;letter-spacing:1px;font-weight:600}</style></head><body><div class="header"><h1>Salut ' + user.athlete.firstname + ' 👋</h1><div class="subtitle">Tableau de bord</div></div><div class="container">' + badgesHTML + activitiesHTML + '</div><div id="badgesModal" class="modal"><div class="modal-content"><span class="close" onclick="closeBadgesModal()">&times;</span><h2 class="modal-title">🏆 Collection de badges</h2><div class="modal-section"><h3>✅ Débloqués (' + badges.unlocked.length + ')</h3><div class="badges-grid">' + modalUnlockedHTML + '</div></div><div class="modal-section"><h3>🔒 À débloquer (' + badges.locked.length + ')</h3><div class="badges-grid">' + modalLockedHTML + '</div></div></div></div><div class="bottom-nav"><a href="/dashboard" class="nav-item active"><div class="nav-icon">🏠</div><div>Accueil</div></a><a href="/progression" class="nav-item"><div class="nav-icon">📈</div><div>Progression</div></a><a href="/records" class="nav-item"><div class="nav-icon">🏆</div><div>Records</div></a><a href="/prediction" class="nav-item"><div class="nav-icon">🔮</div><div>Prédictions</div></a><a href="/run-in-lyon" class="nav-item"><div class="nav-icon">🎯</div><div>Lyon 2026</div></a></div><script>function openBadgesModal(){document.getElementById("badgesModal").classList.add("active")}function closeBadgesModal(){document.getElementById("badgesModal").classList.remove("active")}</script></body></html>';
    
    res.send(html);
  } catch (error) {
    res.send('Erreur données');
  }
});

// Fonction calcul badges
function calculateBadgesWithLocked(runs, athleteId) {
  const unlocked = [];
  const locked = [];
  
  const totalDistance = runs.reduce(function(sum, r) { return sum + r.distance / 1000; }, 0);
  const totalRuns = runs.length;
  
  // BADGES DISTANCE
  const distanceBadges = [
    { threshold: 100, level: 1, icon: '<img src="/100km.png" style="width:60px;height:60px;">', name: 'Centurion', desc: '100 premiers km !', stats: totalDistance.toFixed(0) + ' km' },
    { threshold: 500, level: 2, icon: '<img src="/500km.png" style="width:60px;height:60px;">', name: 'Marathonien', desc: '500 km parcourus', stats: totalDistance.toFixed(0) + ' km' },
    { threshold: 1000, level: 3, icon: '<img src="/1000km.png" style="width:60px;height:60px;">', name: 'Globe Trotter', desc: '1000 km !', stats: totalDistance.toFixed(0) + ' km' }
  ];
  
  let distanceUnlocked = false;
  for (let i = distanceBadges.length - 1; i >= 0; i--) {
    if (totalDistance >= distanceBadges[i].threshold) {
      unlocked.push(distanceBadges[i]);
      distanceUnlocked = true;
      break;
    }
  }
  
  for (let i = 0; i < distanceBadges.length; i++) {
    const badge = distanceBadges[i];
    if (totalDistance < badge.threshold) {
      locked.push({
        threshold: badge.threshold,
        level: badge.level,
        icon: badge.icon,
        name: badge.name,
        desc: badge.desc,
        requirement: (badge.threshold - totalDistance).toFixed(0) + ' km restants'
      });
    }
  }
  
  // BADGES NOMBRE DE COURSES
  const runsBadges = [
    { threshold: 10, level: 1, icon: '<img src="/10courses.png" style="width:60px;height:60px;">', name: 'Débutant Pro', desc: '10 sorties', stats: totalRuns + ' courses' },
    { threshold: 50, level: 2, icon: '<img src="/50courses.png" style="width:60px;height:60px;">', name: 'Assidu', desc: '50 courses', stats: totalRuns + ' courses' },
    { threshold: 100, level: 3, icon: '<img src="/100courses.png" style="width:60px;height:60px;">', name: 'Centenaire', desc: '100 sorties !', stats: totalRuns + ' courses' }
  ];
  
  let runsUnlocked = false;
  for (let i = runsBadges.length - 1; i >= 0; i--) {
    if (totalRuns >= runsBadges[i].threshold) {
      unlocked.push(runsBadges[i]);
      runsUnlocked = true;
      break;
    }
  }
  
  for (let i = 0; i < runsBadges.length; i++) {
    const badge = runsBadges[i];
    if (totalRuns < badge.threshold) {
      locked.push({
        threshold: badge.threshold,
        level: badge.level,
        icon: badge.icon,
        name: badge.name,
        desc: badge.desc,
        requirement: (badge.threshold - totalRuns) + ' courses restantes'
      });
    }
  }
  
  // BADGES ALLURE
  const bestPaceRun = runs.reduce(function(best, run) {
    const pace = run.distance > 0 ? (run.moving_time / 60) / (run.distance / 1000) : Infinity;
    const bestPace = best.distance > 0 ? (best.moving_time / 60) / (best.distance / 1000) : Infinity;
    return pace < bestPace ? run : best;
  }, runs[0] || {});
  const bestPace = bestPaceRun.distance > 0 ? (bestPaceRun.moving_time / 60) / (bestPaceRun.distance / 1000) : 999;
  
  const paceBadges = [
    { threshold: 5.5, level: 1, icon: '<img src="/530.png" style="width:60px;height:60px;">', name: 'Rapide', desc: 'Allure sous 5:30/km' },
    { threshold: 4.5, level: 2, icon: '<img src="/430.png" style="width:60px;height:60px;">', name: 'Vitesse Éclair', desc: 'Allure sous 4:30/km !' }
  ];
  
  function getPaceStr(p) {
    const m = Math.floor(p);
    const s = Math.round((p % 1) * 60);
    return m + ':' + String(s).padStart(2, '0');
  }
  
  let paceUnlocked = false;
  for (let i = paceBadges.length - 1; i >= 0; i--) {
    if (bestPace > 0 && bestPace < paceBadges[i].threshold) {
      const badge = paceBadges[i];
      unlocked.push({
        threshold: badge.threshold,
        level: badge.level,
        icon: badge.icon,
        name: badge.name,
        desc: badge.desc,
        stats: 'Record : ' + getPaceStr(bestPace) + '/km'
      });
      paceUnlocked = true;
      break;
    }
  }
  
  for (let i = 0; i < paceBadges.length; i++) {
    const badge = paceBadges[i];
    if (bestPace >= badge.threshold) {
      locked.push({
        threshold: badge.threshold,
        level: badge.level,
        icon: badge.icon,
        name: badge.name,
        desc: badge.desc,
        requirement: 'Objectif : ' + getPaceStr(badge.threshold - 0.01) + '/km'
      });
    }
  }
  
  // BADGES LONGUE DISTANCE
  const longestRun = runs.reduce(function(longest, run) { 
    return run.distance > (longest.distance || 0) ? run : longest; 
  }, runs[0] || {});
  const longestDistance = longestRun.distance || 0;
  
  const longDistanceBadges = [
    { threshold: 21000, level: 2, icon: '<img src="/semi.png" style="width:60px;height:60px;">', name: 'Semi-Marathonien', desc: '21.1 km !' },
    { threshold: 42195, level: 3, icon: '<img src="/marathon.png" style="width:60px;height:60px;">', name: 'Marathonien', desc: '42.195 km !' }
  ];
  
  let longDistUnlocked = false;
  for (let i = longDistanceBadges.length - 1; i >= 0; i--) {
    if (longestDistance >= longDistanceBadges[i].threshold) {
      const badge = longDistanceBadges[i];
      unlocked.push({
        threshold: badge.threshold,
        level: badge.level,
        icon: badge.icon,
        name: badge.name,
        desc: badge.desc,
        stats: 'Plus longue : ' + (longestDistance / 1000).toFixed(2) + ' km'
      });
      longDistUnlocked = true;
      break;
    }
  }
  
  for (let i = 0; i < longDistanceBadges.length; i++) {
    const badge = longDistanceBadges[i];
    if (longestDistance < badge.threshold) {
      locked.push({
        threshold: badge.threshold,
        level: badge.level,
        icon: badge.icon,
        name: badge.name,
        desc: badge.desc,
        requirement: ((badge.threshold - longestDistance) / 1000).toFixed(2) + ' km restants'
      });
    }
  }
  
  // BADGES RÉGULARITÉ
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const runsThisWeek = runs.filter(function(r) { return new Date(r.start_date) > oneWeekAgo; }).length;
  
  const regularityBadges = [
    { threshold: 3, level: 1, icon: '<img src="/3courses.png" style="width:60px;height:60px;">', name: 'Régulier', desc: '3+ sorties/semaine' },
    { threshold: 4, level: 2, icon: '<img src="/4courses.png" style="width:60px;height:60px;">', name: 'Ultra Régulier', desc: '4+ sorties/semaine !' }
  ];
  
  let regularityUnlocked = false;
  for (let i = regularityBadges.length - 1; i >= 0; i--) {
    if (runsThisWeek >= regularityBadges[i].threshold) {
      const badge = regularityBadges[i];
      unlocked.push({
        threshold: badge.threshold,
        level: badge.level,
        icon: badge.icon,
        name: badge.name,
        desc: badge.desc,
        stats: runsThisWeek + ' courses cette semaine'
      });
      regularityUnlocked = true;
      break;
    }
  }
  
  for (let i = 0; i < regularityBadges.length; i++) {
    const badge = regularityBadges[i];
    if (runsThisWeek < badge.threshold) {
      locked.push({
        threshold: badge.threshold,
        level: badge.level,
        icon: badge.icon,
        name: badge.name,
        desc: badge.desc,
        requirement: (badge.threshold - runsThisWeek) + ' courses cette semaine'
      });
    }
  }
  
  return { unlocked: unlocked, locked: locked };
}

// PAGE PROGRESSION
app.get('/progression', async function(req, res) {
  const athleteId = Object.keys(userTokens)[0];
  if (!athleteId) return res.redirect('/');
  const user = userTokens[athleteId];

  try {
    const activitiesResponse = await axios.get('https://www.strava.com/api/v3/athlete/activities', {
      headers: { 'Authorization': 'Bearer ' + user.accessToken },
      params: { per_page: 200 }
    });

    const runs = activitiesResponse.data.filter(function(a) { return a.type === 'Run'; });
    const weeklyData = {};
    
    runs.forEach(function(run) {
      const date = new Date(run.start_date);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (!weeklyData[weekKey]) {
        weeklyData[weekKey] = { distance: 0, totalTime: 0, count: 0, week: weekKey };
      }
      weeklyData[weekKey].distance += run.distance / 1000;
      weeklyData[weekKey].totalTime += run.moving_time;
      weeklyData[weekKey].count += 1;
    });
    
    const weeklyArray = Object.values(weeklyData)
      .sort(function(a, b) { return new Date(a.week) - new Date(b.week); })
      .slice(-12);
    
    const weeks = [];
    const distances = [];
    const paces = [];
    
    for (let i = 0; i < weeklyArray.length; i++) {
      const w = weeklyArray[i];
      weeks.push(new Date(w.week).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }));
      distances.push(Math.round(w.distance * 10) / 10);
      paces.push(w.distance > 0 ? Math.round((w.totalTime / 60) / w.distance * 10) / 10 : 0);
    }
    
    const html = '<html><head><title>Progression</title><meta name="viewport" content="width=device-width,initial-scale=1"><script src="https://cdn.jsdelivr.net/npm/chart.js"></script><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;background:#0a0a0a;color:#e0e0e0;padding-bottom:70px}.header{background:#111;padding:20px 16px;border-bottom:1px solid #222}h1{font-size:24px;font-weight:600;margin-bottom:4px;color:#fff}.subtitle{font-size:14px;color:#888}.container{padding:16px}.chart-container{background:#111;padding:16px;margin:16px 0;border-radius:12px;border:1px solid #222}.chart-container h2{font-size:16px;margin-bottom:16px;color:#fff}canvas{max-height:250px!important}.bottom-nav{position:fixed;bottom:0;left:0;right:0;background:#111;border-top:1px solid #222;display:grid;grid-template-columns:repeat(5,1fr);padding:8px 0;z-index:1000}.nav-item{display:flex;flex-direction:column;align-items:center;padding:6px;text-decoration:none;color:#888;font-size:10px}.nav-item.active{color:#3b82f6}.nav-icon{font-size:20px;margin-bottom:2px}</style></head><body><div class="header"><h1>📈 Ma Progression</h1><div class="subtitle">Évolution hebdomadaire</div></div><div class="container"><div class="chart-container"><h2>Distance/semaine (km)</h2><canvas id="distanceChart"></canvas></div><div class="chart-container"><h2>Allure moyenne (min/km)</h2><canvas id="paceChart"></canvas></div></div><div class="bottom-nav"><a href="/dashboard" class="nav-item"><div class="nav-icon">🏠</div><div>Accueil</div></a><a href="/progression" class="nav-item active"><div class="nav-icon">📈</div><div>Progression</div></a><a href="/records" class="nav-item"><div class="nav-icon">🏆</div><div>Records</div></a><a href="/prediction" class="nav-item"><div class="nav-icon">🔮</div><div>Prédictions</div></a><a href="/run-in-lyon" class="nav-item"><div class="nav-icon">🎯</div><div>Lyon 2026</div></a></div><script>Chart.defaults.color="#666";Chart.defaults.borderColor="#222";new Chart(document.getElementById("distanceChart"),{type:"bar",data:{labels:' + JSON.stringify(weeks) + ',datasets:[{label:"Distance (km)",data:' + JSON.stringify(distances) + ',backgroundColor:"rgba(59,130,246,0.6)",borderColor:"rgba(59,130,246,1)",borderWidth:2}]},options:{responsive:true,maintainAspectRatio:true,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,grid:{color:"#222"},ticks:{color:"#666",font:{size:10}}},x:{grid:{color:"#222"},ticks:{color:"#666",font:{size:9}}}}}});new Chart(document.getElementById("paceChart"),{type:"line",data:{labels:' + JSON.stringify(weeks) + ',datasets:[{label:"Allure (min/km)",data:' + JSON.stringify(paces) + ',backgroundColor:"rgba(139,92,246,0.2)",borderColor:"rgba(139,92,246,1)",borderWidth:2,fill:true,tension:0.4}]},options:{responsive:true,maintainAspectRatio:true,plugins:{legend:{display:false}},scales:{y:{reverse:true,grid:{color:"#222"},ticks:{color:"#666",font:{size:10}}},x:{grid:{color:"#222"},ticks:{color:"#666",font:{size:9}}}}}});</script></body></html>';
    
    res.send(html);
  } catch (error) {
    res.send('Erreur');
  }
});

// PAGE RECORDS
app.get('/records', async function(req, res) {
  const athleteId = Object.keys(userTokens)[0];
  if (!athleteId) return res.redirect('/');
  const user = userTokens[athleteId];

  try {
    const activitiesResponse = await axios.get('https://www.strava.com/api/v3/athlete/activities', {
      headers: { 'Authorization': 'Bearer ' + user.accessToken },
      params: { per_page: 200 }
    });

    const runs = activitiesResponse.data.filter(function(a) { return a.type === 'Run'; });
    
    const bestPaceRun = runs.reduce(function(best, run) {
      const pace = run.distance > 0 ? (run.moving_time / 60) / (run.distance / 1000) : Infinity;
      const bestPace = best.distance > 0 ? (best.moving_time / 60) / (best.distance / 1000) : Infinity;
      return pace < bestPace ? run : best;
    }, runs[0] || {});
    
    const bestPace = bestPaceRun.distance > 0 ? ((bestPaceRun.moving_time / 60) / (bestPaceRun.distance / 1000)).toFixed(2) : 0;
    const longestRun = runs.reduce(function(longest, run) { 
      return run.distance > (longest.distance || 0) ? run : longest; 
    }, runs[0] || {});
    const biggestElevationRun = runs.reduce(function(biggest, run) { 
      return (run.total_elevation_gain || 0) > (biggest.total_elevation_gain || 0) ? run : biggest; 
    }, runs[0] || {});
    
    const html = '<html><head><title>Records</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;background:#0a0a0a;color:#e0e0e0;padding-bottom:70px}.header{background:#111;padding:20px 16px;border-bottom:1px solid #222}h1{font-size:24px;font-weight:600;margin-bottom:4px;color:#fff}.subtitle{font-size:14px;color:#888}.container{padding:16px}.record-card{background:#111;padding:20px;border-radius:12px;border:1px solid #222;margin-bottom:16px}.record-icon{font-size:36px;margin-bottom:12px}.record-title{font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px}.record-value{font-size:32px;font-weight:700;color:#fff;margin:12px 0}.record-activity{color:#888;font-size:12px;margin-top:12px;padding-top:12px;border-top:1px solid #1a1a1a;line-height:1.6}.record-date{color:#666;font-size:11px;margin-top:6px}.bottom-nav{position:fixed;bottom:0;left:0;right:0;background:#111;border-top:1px solid #222;display:grid;grid-template-columns:repeat(5,1fr);padding:8px 0;z-index:1000}.nav-item{display:flex;flex-direction:column;align-items:center;padding:6px;text-decoration:none;color:#888;font-size:10px}.nav-item.active{color:#3b82f6}.nav-icon{font-size:20px;margin-bottom:2px}</style></head><body><div class="header"><h1>🏆 Records Personnels</h1><div class="subtitle">Tes meilleures performances</div></div><div class="container"><div class="record-card"><div class="record-icon">⚡</div><div class="record-title">Meilleure Allure</div><div class="record-value">' + bestPace + ' /km</div><div class="record-activity">' + (bestPaceRun.name || 'N/A') + '<br>' + (bestPaceRun.distance / 1000).toFixed(2) + ' km<div class="record-date">' + (bestPaceRun.start_date ? new Date(bestPaceRun.start_date).toLocaleDateString('fr-FR') : '') + '</div></div></div><div class="record-card"><div class="record-icon">📏</div><div class="record-title">Plus Longue Distance</div><div class="record-value">' + (longestRun.distance / 1000).toFixed(2) + ' km</div><div class="record-activity">' + (longestRun.name || 'N/A') + '<br>' + Math.floor((longestRun.moving_time || 0) / 60) + ' minutes<div class="record-date">' + (longestRun.start_date ? new Date(longestRun.start_date).toLocaleDateString('fr-FR') : '') + '</div></div></div><div class="record-card"><div class="record-icon">⛰️</div><div class="record-title">Plus Gros Dénivelé</div><div class="record-value">' + Math.round(biggestElevationRun.total_elevation_gain || 0) + ' m</div><div class="record-activity">' + (biggestElevationRun.name || 'N/A') + '<br>' + (biggestElevationRun.distance / 1000).toFixed(2) + ' km<div class="record-date">' + (biggestElevationRun.start_date ? new Date(biggestElevationRun.start_date).toLocaleDateString('fr-FR') : '') + '</div></div></div></div><div class="bottom-nav"><a href="/dashboard" class="nav-item"><div class="nav-icon">🏠</div><div>Accueil</div></a><a href="/progression" class="nav-item"><div class="nav-icon">📈</div><div>Progression</div></a><a href="/records" class="nav-item active"><div class="nav-icon">🏆</div><div>Records</div></a><a href="/prediction" class="nav-item"><div class="nav-icon">🔮</div><div>Prédictions</div></a><a href="/run-in-lyon" class="nav-item"><div class="nav-icon">🎯</div><div>Lyon 2026</div></a></div></body></html>';
    
    res.send(html);
  } catch (error) {
    res.send('Erreur');
  }
});

// PAGE PREDICTIONS
app.get('/prediction', async function(req, res) {
  const athleteId = Object.keys(userTokens)[0];
  if (!athleteId) return res.redirect('/');
  const user = userTokens[athleteId];

  try {
    const activitiesResponse = await axios.get('https://www.strava.com/api/v3/athlete/activities', {
      headers: { 'Authorization': 'Bearer ' + user.accessToken },
      params: { per_page: 50 }
    });

    const runs = activitiesResponse.data.filter(function(a) { return a.type === 'Run' && a.distance > 3000; });
    if (runs.length === 0) return res.send('Pas assez de données');
    
    const recentPaces = runs.slice(0, 10).map(function(run) { 
      return (run.moving_time / 60) / (run.distance / 1000); 
    });
    const avgPace = recentPaces.reduce(function(sum, pace) { return sum + pace; }, 0) / recentPaces.length;
    
    function predictTime(distance, basePace) {
      const baseDistance = 5;
      const factor = Math.pow(distance / baseDistance, 1.06);
      return (basePace * baseDistance * factor);
    }
    
    function formatTime(minutes) {
      const hours = Math.floor(minutes / 60);
      const mins = Math.floor(minutes % 60);
      if (hours > 0) return hours + 'h' + String(mins).padStart(2, '0');
      return mins + 'min';
    }
    
    const pred5km = formatTime(predictTime(5, avgPace));
    const pred10km = formatTime(predictTime(10, avgPace));
    const predSemi = formatTime(predictTime(21.1, avgPace));
    const predMarathon = formatTime(predictTime(42.2, avgPace));
    
    const html = '<html><head><title>Prédictions</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;background:#0a0a0a;color:#e0e0e0;padding-bottom:70px}.header{background:#111;padding:20px 16px;border-bottom:1px solid #222}h1{font-size:24px;font-weight:600;margin-bottom:4px;color:#fff}.subtitle{font-size:14px;color:#888}.container{padding:16px}.info-box{background:#111;padding:16px;border-radius:12px;margin-bottom:20px;text-align:center;border:1px solid #222}.prediction-card{background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);border-radius:12px;padding:24px;margin-bottom:16px;text-align:center;border:1px solid rgba(59,130,246,0.3)}.distance{font-size:16px;color:#888;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px}.time{font-size:32px;font-weight:700;color:#3b82f6}.bottom-nav{position:fixed;bottom:0;left:0;right:0;background:#111;border-top:1px solid #222;display:grid;grid-template-columns:repeat(5,1fr);padding:8px 0;z-index:1000}.nav-item{display:flex;flex-direction:column;align-items:center;padding:6px;text-decoration:none;color:#888;font-size:10px}.nav-item.active{color:#3b82f6}.nav-icon{font-size:20px;margin-bottom:2px}</style></head><body><div class="header"><h1>🔮 Prédictions</h1><div class="subtitle">Temps estimés</div></div><div class="container"><div class="info-box"><div style="font-size:12px;color:#888;margin-bottom:4px;">Basé sur ton allure moyenne</div><div style="font-size:24px;font-weight:700;color:#3b82f6;">' + avgPace.toFixed(2) + ' min/km</div></div><div class="prediction-card"><div class="distance">5km</div><div class="time">' + pred5km + '</div></div><div class="prediction-card"><div class="distance">10km</div><div class="time">' + pred10km + '</div></div><div class="prediction-card"><div class="distance">Semi</div><div class="time">' + predSemi + '</div></div><div class="prediction-card"><div class="distance">Marathon</div><div class="time">' + predMarathon + '</div></div></div><div class="bottom-nav"><a href="/dashboard" class="nav-item"><div class="nav-icon">🏠</div><div>Accueil</div></a><a href="/progression" class="nav-item"><div class="nav-icon">📈</div><div>Progression</div></a><a href="/records" class="nav-item"><div class="nav-icon">🏆</div><div>Records</div></a><a href="/prediction" class="nav-item active"><div class="nav-icon">🔮</div><div>Prédictions</div></a><a href="/run-in-lyon" class="nav-item"><div class="nav-icon">🎯</div><div>Lyon 2026</div></a></div></body></html>';
    
    res.send(html);
  } catch (error) {
    res.send('Erreur');
  }
});

// PAGE RUN IN LYON - Programme complet 16 semaines
app.get('/run-in-lyon', function(req, res) {
  const athleteId = Object.keys(userTokens)[0];
  if (!athleteId) return res.redirect('/');

  if (!trainingProgress[athleteId]) {
    trainingProgress[athleteId] = {};
  }

  const raceDate = new Date('2026-10-02');
  const today = new Date();
  const weeksUntilRace = Math.ceil((raceDate - today) / (7 * 24 * 60 * 60 * 1000));
  
  const weeklyPlan = [
    { week: 1, volume: 30, sessions: ['Repos', '6km facile 6:00/km', '6km endurance 5:50/km', 'Repos', '6km facile', 'Repos', '10km sortie longue 6:10/km'] },
    { week: 2, volume: 35, sessions: ['Repos', '7km facile', '8x400m à 5:00/km', 'Repos', '7km endurance', 'Repos', '12km sortie longue'] },
    { week: 3, volume: 38, sessions: ['Repos', '7km facile', '8km endurance', 'Repos', '10x400m VMA 4:50/km', 'Repos', '13km sortie longue'] },
    { week: 4, volume: 28, sessions: ['Repos', '6km récup', '6km facile', 'Repos', '5km facile', 'Repos', '9km léger (récup)'] },
    { week: 5, volume: 42, sessions: ['Repos', '8km facile', '5x1000m à 5:10/km', 'Repos', '8km endurance', 'Repos', '15km sortie longue'] },
    { week: 6, volume: 45, sessions: ['Repos', '8km facile', '6x1000m seuil 5:15/km', 'Repos', '9km endurance', 'Repos', '16km sortie longue'] },
    { week: 7, volume: 48, sessions: ['Repos', '8km facile', '3x2000m à 5:20/km', 'Repos', '10km endurance', 'Repos', '18km sortie longue'] },
    { week: 8, volume: 32, sessions: ['Repos', '7km récup', '6km facile', 'Repos', '6km facile', 'Repos', '10km léger (récup)'] },
    { week: 9, volume: 52, sessions: ['Repos', '9km facile', '10x400m VMA', 'Repos', '10km endurance', 'Repos', '20km sortie longue'] },
    { week: 10, volume: 55, sessions: ['Repos', '9km facile', '2x3000m seuil 5:20/km', 'Repos', '10km endurance', 'Repos', '21km distance course!'] },
    { week: 11, volume: 58, sessions: ['Repos', '10km facile', '15km allure semi 5:30/km', 'Repos', '10km endurance', 'Repos', '19km sortie longue'] },
    { week: 12, volume: 38, sessions: ['Repos', '7km récup', '7km facile', 'Repos', '7km facile', 'Repos', '12km léger (récup)'] },
    { week: 13, volume: 52, sessions: ['Repos', '9km facile', '3x3000m à 5:20/km', 'Repos', '10km endurance', 'Repos', '20km sortie longue'] },
    { week: 14, volume: 48, sessions: ['Repos', '8km facile', '18km allure objectif 5:27/km', 'Repos', '8km endurance', 'Repos', '12km léger'] },
    { week: 15, volume: 38, sessions: ['Repos', '7km facile', '6x1000m à 5:10/km', 'Repos', '6km facile', 'Repos', '10km affûtage'] },
    { week: 16, volume: 28, sessions: ['Repos', '5km facile', '3km + 5x400m', 'Repos', '4km très facile', 'Repos', '🏁 COURSE 1h55!'] }
  ];
  
  const completedDays = Object.values(trainingProgress[athleteId]).filter(function(v) { return v; }).length;
  let currentStreak = 0;
  let maxStreak = 0;
  let tempStreak = 0;
  
  const sortedDates = Object.keys(trainingProgress[athleteId]).sort();
  for (let i = 0; i < sortedDates.length; i++) {
    if (trainingProgress[athleteId][sortedDates[i]]) {
      tempStreak++;
      maxStreak = Math.max(maxStreak, tempStreak);
    } else {
      tempStreak = 0;
    }
  }
  
  const recentDates = sortedDates.slice(-30);
  for (let i = recentDates.length - 1; i >= 0; i--) {
    if (trainingProgress[athleteId][recentDates[i]]) {
      currentStreak++;
    } else {
      break;
    }
  }
  
  let weeksHTML = '';
  for (let weekIdx = 0; weekIdx < weeklyPlan.length; weekIdx++) {
    const week = weeklyPlan[weekIdx];
    const isCurrentWeek = weekIdx === Math.min(weeklyPlan.length - 1, Math.max(0, 16 - weeksUntilRace));
    const currentClass = isCurrentWeek ? ' current-week' : '';
    const currentLabel = isCurrentWeek ? ' ←' : '';
    
    let sessionsHTML = '';
    const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    for (let dayIdx = 0; dayIdx < week.sessions.length; dayIdx++) {
      const session = week.sessions[dayIdx];
      const dayKey = 'w' + week.week + 'd' + dayIdx;
      const isCompleted = trainingProgress[athleteId][dayKey];
      const isRest = session.toLowerCase().indexOf('repos') !== -1;
      const completedClass = isCompleted ? ' completed' : '';
      const restClass = isRest ? ' rest' : '';
      const onclick = isRest ? '' : ' onclick="toggleSession(\'' + dayKey + '\')"';
      const checkIcon = isCompleted ? '<div class="check-icon">✓</div>' : '';
      
      sessionsHTML += '<div class="session-day' + completedClass + restClass + '"' + onclick + '><div class="day-name">' + dayNames[dayIdx] + '</div><div class="session-name">' + session + '</div>' + checkIcon + '</div>';
    }
    
    weeksHTML += '<div class="week-card' + currentClass + '"><div class="week-header"><div class="week-title">Semaine ' + week.week + currentLabel + '</div><div class="week-volume">' + week.volume + ' km</div></div><div class="sessions-list">' + sessionsHTML + '</div></div>';
  }
  
  const html = '<html><head><title>Run In Lyon 2026</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;background:#000;color:#fff;padding-bottom:100px}.race-header{background:linear-gradient(135deg,#ff3366 0%,#ff6b9d 100%);padding:24px 16px;text-align:center}.race-emoji{font-size:48px;margin-bottom:12px}.race-title{font-size:24px;font-weight:700;margin-bottom:6px}.race-subtitle{font-size:12px;opacity:0.9;margin-bottom:16px}.countdown{font-size:48px;font-weight:800;margin:12px 0}.target-banner{background:linear-gradient(90deg,#6366f1 0%,#8b5cf6 100%);padding:16px;text-align:center;font-size:16px;font-weight:700}.container{padding:16px}.stats-row{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin:16px 0}.stat-card{background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:16px;border-radius:12px;text-align:center;border:1px solid rgba(255,255,255,0.1)}.stat-value{font-size:32px;font-weight:800;margin:8px 0}.stat-label{color:rgba(255,255,255,0.7);font-size:10px;text-transform:uppercase;letter-spacing:0.5px}.fire-emoji{font-size:24px}.section-title{font-size:18px;font-weight:600;margin:20px 0 12px 0}.week-card{background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:16px;margin:12px 0;border-radius:12px;border:1px solid rgba(255,255,255,0.1)}.week-card.current-week{border:2px solid #ff3366;box-shadow:0 0 20px rgba(255,51,102,0.3)}.week-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.1)}.week-title{font-size:16px;font-weight:700;color:#fff}.week-volume{background:linear-gradient(135deg,#ff3366 0%,#ff6b9d 100%);color:#fff;padding:6px 12px;border-radius:12px;font-size:12px;font-weight:700}.sessions-list{display:flex;flex-direction:column;gap:8px}.session-day{background:rgba(255,255,255,0.05);padding:12px;border-radius:8px;border:1px solid transparent;display:flex;align-items:center;gap:12px}.session-day.completed{background:linear-gradient(135deg,#10b981 0%,#059669 100%);border-color:#10b981}.session-day.rest{background:rgba(255,255,255,0.02);opacity:0.5}.day-name{font-size:11px;font-weight:700;color:rgba(255,255,255,0.6);text-transform:uppercase;min-width:35px}.session-name{font-size:12px;color:#fff;flex:1;line-height:1.4}.check-icon{font-size:18px;color:#fff}.tips-section{background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);padding:20px;margin:20px 0;border-radius:12px}.tips-section h3{color:#fff;margin-bottom:12px;font-size:18px}.tips-section ul{line-height:2;color:rgba(255,255,255,0.95);font-size:12px;list-style:none;padding:0}.tips-section li{padding-left:20px;position:relative;margin-bottom:8px}.tips-section li::before{content:"→";position:absolute;left:0;color:#fff;font-weight:bold}.bottom-nav{position:fixed;bottom:0;left:0;right:0;background:#111;border-top:1px solid #222;display:grid;grid-template-columns:repeat(5,1fr);padding:8px 0;z-index:1000}.nav-item{display:flex;flex-direction:column;align-items:center;padding:6px;text-decoration:none;color:#888;font-size:10px}.nav-item.active{color:#3b82f6}.nav-icon{font-size:20px;margin-bottom:2px}</style></head><body><div class="race-header"><div class="race-emoji">🏃‍♂️</div><div class="race-title">Run In Lyon 2026</div><div class="race-subtitle">Semi-Marathon • 2 Oct 2026 • 21.1 km</div><div class="countdown">' + weeksUntilRace + ' semaines</div></div><div class="target-banner">🎯 Objectif : 1h55 • Allure : 5:27/km</div><div class="container"><div class="stats-row"><div class="stat-card"><div class="stat-value">' + completedDays + '</div><div class="stat-label">Séances complétées</div></div><div class="stat-card"><div class="stat-value"><span class="fire-emoji">🔥</span> ' + currentStreak + '</div><div class="stat-label">Chaîne actuelle</div></div><div class="stat-card"><div class="stat-value"><span class="fire-emoji">⭐</span> ' + maxStreak + '</div><div class="stat-label">Record chaîne</div></div><div class="stat-card"><div class="stat-value">' + Math.round((completedDays / (16 * 7)) * 100) + '%</div><div class="stat-label">Progression</div></div></div><div class="section-title">Programme 16 semaines</div>' + weeksHTML + '<div class="tips-section"><h3>💡 Plan pour réussir 1h55</h3><ul><li><strong>Allure cible : 5:27/km</strong> - Entraîne-toi à cette allure</li><li><strong>VMA : ~17-18 km/h</strong> - Travaille ta vitesse</li><li><strong>Seuil anaérobie</strong> - Séances 5:15-5:20/km cruciales</li><li><strong>Volume progressif</strong> - Jusqu\'à 58 km/sem en S11</li><li><strong>Sorties longues</strong> - Habitue ton corps sur 21 km</li><li><strong>Récupération</strong> - Semaines allégées essentielles</li><li><strong>Nutrition</strong> - Teste ton ravitaillement</li><li><strong>Mental</strong> - Visualise, découpe en segments</li></ul></div></div><div class="bottom-nav"><a href="/dashboard" class="nav-item"><div class="nav-icon">🏠</div><div>Accueil</div></a><a href="/progression" class="nav-item"><div class="nav-icon">📈</div><div>Progression</div></a><a href="/records" class="nav-item"><div class="nav-icon">🏆</div><div>Records</div></a><a href="/prediction" class="nav-item"><div class="nav-icon">🔮</div><div>Prédictions</div></a><a href="/run-in-lyon" class="nav-item active"><div class="nav-icon">🎯</div><div>Lyon 2026</div></a></div><script>function toggleSession(dayKey){fetch("/toggle-session?key="+dayKey+"&athlete=' + athleteId + '").then(function(){location.reload()})}</script></body></html>';
  
  res.send(html);
});

app.get('/toggle-session', function(req, res) {
  const key = req.query.key;
  const athlete = req.query.athlete;
  if (!trainingProgress[athlete]) trainingProgress[athlete] = {};
  trainingProgress[athlete][key] = !trainingProgress[athlete][key];
  res.send('OK');
});

// PAGE ANALYSES
app.get('/analyses', async function(req, res) {
  const athleteId = Object.keys(userTokens)[0];
  if (!athleteId) return res.redirect('/');
  const user = userTokens[athleteId];

  try {
    const activitiesResponse = await axios.get('https://www.strava.com/api/v3/athlete/activities', {
      headers: { 'Authorization': 'Bearer ' + user.accessToken },
      params: { per_page: 200 }
    });

    const runs = activitiesResponse.data.filter(function(a) { return a.type === 'Run'; });
    
    const runsWithCadence = runs.filter(function(r) { return r.average_cadence; });
    const avgCadence = runsWithCadence.length > 0 
      ? Math.round(runsWithCadence.reduce(function(sum, r) { return sum + r.average_cadence * 2; }, 0) / runsWithCadence.length) 
      : 0;
    
    const paces = runs.filter(function(r) { return r.distance > 1000; }).map(function(r) { 
      return (r.moving_time / 60) / (r.distance / 1000); 
    });
    const avgPace = paces.reduce(function(sum, p) { return sum + p; }, 0) / paces.length;
    const variance = paces.reduce(function(sum, p) { return sum + Math.pow(p - avgPace, 2); }, 0) / paces.length;
    const stdDev = Math.sqrt(variance);
    const variability = (stdDev / avgPace * 100).toFixed(1);
    
    let variabilityDesc = '';
    if (variability < 10) {
      variabilityDesc = 'Excellent ! Très constant';
    } else if (variability < 15) {
      variabilityDesc = 'Bon, assez régulier';
    } else {
      variabilityDesc = 'À améliorer';
    }
    
    const html = '<html><head><title>Analyses</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;background:#0a0a0a;color:#e0e0e0;padding-bottom:70px}.header{background:#111;padding:20px 16px;border-bottom:1px solid #222}h1{font-size:24px;font-weight:600;margin-bottom:4px;color:#fff}.subtitle{font-size:14px;color:#888}.container{padding:16px}.stats-grid{display:grid;grid-template-columns:1fr;gap:12px;margin:16px 0}.stat-card{background:#111;padding:20px;border-radius:12px;border:1px solid #222}.stat-icon{font-size:32px;margin-bottom:12px}.stat-label{color:#666;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px}.stat-value{font-size:36px;font-weight:700;color:#fff;margin:8px 0}.stat-desc{color:#888;font-size:12px;margin-top:8px;line-height:1.5}.bottom-nav{position:fixed;bottom:0;left:0;right:0;background:#111;border-top:1px solid #222;display:grid;grid-template-columns:repeat(5,1fr);padding:8px 0;z-index:1000}.nav-item{display:flex;flex-direction:column;align-items:center;padding:6px;text-decoration:none;color:#888;font-size:10px}.nav-item.active{color:#3b82f6}.nav-icon{font-size:20px;margin-bottom:2px}</style></head><body><div class="header"><h1>📊 Analyses Avancées</h1><div class="subtitle">Métriques détaillées</div></div><div class="container"><div class="stats-grid"><div class="stat-card"><div class="stat-icon">🦶</div><div class="stat-label">Cadence Moyenne</div><div class="stat-value">' + avgCadence + '</div><div class="stat-desc">Foulées/minute • Optimal : 170-180</div></div><div class="stat-card"><div class="stat-icon">📉</div><div class="stat-label">Variabilité d\'Allure</div><div class="stat-value">' + variability + '%</div><div class="stat-desc">' + variabilityDesc + '</div></div><div class="stat-card"><div class="stat-icon">⚡</div><div class="stat-label">Allure Moyenne Globale</div><div class="stat-value">' + avgPace.toFixed(2) + '</div><div class="stat-desc">min/km sur ' + paces.length + ' courses</div></div></div></div><div class="bottom-nav"><a href="/dashboard" class="nav-item"><div class="nav-icon">🏠</div><div>Accueil</div></a><a href="/progression" class="nav-item"><div class="nav-icon">📈</div><div>Progression</div></a><a href="/records" class="nav-item"><div class="nav-icon">🏆</div><div>Records</div></a><a href="/prediction" class="nav-item"><div class="nav-icon">🔮</div><div>Prédictions</div></a><a href="/run-in-lyon" class="nav-item"><div class="nav-icon">🎯</div><div>Lyon 2026</div></a></div></body></html>';
    
    res.send(html);
  } catch (error) {
    res.send('Erreur');
  }
});

// DETAIL ACTIVITE
app.get('/activity/:id', async function(req, res) {
  const athleteId = Object.keys(userTokens)[0];
  if (!athleteId) return res.redirect('/');
  const user = userTokens[athleteId];
  const activityId = req.params.id;

  try {
    const activityResponse = await axios.get('https://www.strava.com/api/v3/activities/' + activityId, {
      headers: { 'Authorization': 'Bearer ' + user.accessToken }
    });

    const activity = activityResponse.data;
    
    let streams = {};
    try {
      const streamsResponse = await axios.get('https://www.strava.com/api/v3/activities/' + activityId + '/streams', {
        headers: { 'Authorization': 'Bearer ' + user.accessToken },
        params: { keys: 'distance,altitude,heartrate,time,cadence', key_by_type: true }
      });
      streams = streamsResponse.data;
    } catch (e) {
      console.log('Pas de streams');
    }

    const distance = (activity.distance / 1000).toFixed(2);
    const duration = Math.floor(activity.moving_time / 60);
    const durationSeconds = activity.moving_time % 60;
    const avgPaceSeconds = activity.distance > 0 ? activity.moving_time / (activity.distance / 1000) : 0;
    const paceMinutes = Math.floor(avgPaceSeconds / 60);
    const paceSeconds = Math.round(avgPaceSeconds % 60);
    const pace = paceMinutes + ':' + String(paceSeconds).padStart(2, '0');
    const date = new Date(activity.start_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    const elevation = Math.round(activity.total_elevation_gain || 0);
    const avgCadence = activity.average_cadence ? Math.round(activity.average_cadence * 2) : null;
    const maxCadence = streams.cadence ? Math.round(Math.max.apply(Math, streams.cadence.data) * 2) : null;
    const avgHR = activity.average_heartrate ? Math.round(activity.average_heartrate) : null;
    const maxHR = activity.max_heartrate ? Math.round(activity.max_heartrate) : null;
    
    let paceTableHTML = '';
    if (activity.splits_metric && activity.splits_metric.length > 0) {
      paceTableHTML = '<div class="pace-table"><h3>Allures par kilomètre</h3>';
      for (let idx = 0; idx < activity.splits_metric.length; idx++) {
        const split = activity.splits_metric[idx];
        const paceSecondsVal = split.moving_time / (split.distance / 1000);
        const paceMin = Math.floor(paceSecondsVal / 60);
        const paceSec = Math.round(paceSecondsVal % 60);
        const splitPace = paceMin + ':' + String(paceSec).padStart(2, '0');
        const paceInSeconds = paceMin * 60 + paceSec;
        const avgPaceInSeconds = paceMinutes * 60 + paceSeconds;
        let className = '';
        if (paceInSeconds < avgPaceInSeconds - 5) className = 'fast';
        else if (paceInSeconds > avgPaceInSeconds + 5) className = 'slow';
        const kmDist = (split.distance / 1000).toFixed(2);
        const kmLabel = kmDist === '1.00' ? 'KM ' + (idx + 1) : 'KM ' + (idx + 1) + ' (' + kmDist + 'km)';
        paceTableHTML += '<div class="pace-row ' + className + '"><div class="km">' + kmLabel + '</div><div class="pace">' + splitPace + '</div></div>';
      }
      paceTableHTML += '</div>';
    }
    
    let extraStatsHTML = '';
    if (avgCadence) {
      extraStatsHTML += '<div class="stat-box"><div class="stat-value">' + avgCadence + '</div><div class="stat-label">Cadence Moy (spm)</div></div>';
    }
    if (maxCadence) {
      extraStatsHTML += '<div class="stat-box"><div class="stat-value">' + maxCadence + '</div><div class="stat-label">Cadence Max (spm)</div></div>';
    }
    if (avgHR) {
      extraStatsHTML += '<div class="stat-box"><div class="stat-value">' + avgHR + '</div><div class="stat-label">FC Moy (bpm)</div></div>';
    }
    if (maxHR) {
      extraStatsHTML += '<div class="stat-box"><div class="stat-value">' + maxHR + '</div><div class="stat-label">FC Max (bpm)</div></div>';
    }
    
    let chartsHTML = '';
    let chartsScriptHTML = '';
    
    if (streams.altitude && streams.distance) {
      chartsHTML += '<div class="chart-container"><h3>Profil d\'altitude</h3><canvas id="elevationChart"></canvas></div>';
      chartsScriptHTML += 'new Chart(document.getElementById("elevationChart"),{type:"line",data:{labels:' + JSON.stringify(streams.distance.data.map(function(d) { return (d/1000).toFixed(1); })) + ',datasets:[{data:' + JSON.stringify(streams.altitude.data) + ',backgroundColor:"rgba(59,130,246,0.1)",borderColor:"#3b82f6",borderWidth:2,fill:true,tension:0.4,pointRadius:0}]},options:{responsive:true,maintainAspectRatio:true,plugins:{legend:{display:false}},scales:{x:{grid:{color:"#1a1a1a"},ticks:{color:"#666",font:{size:9}}},y:{grid:{color:"#1a1a1a"},ticks:{color:"#666",font:{size:9}}}}}});';
    }
    
    if (streams.heartrate) {
      chartsHTML += '<div class="chart-container"><h3>Fréquence cardiaque</h3><canvas id="hrChart"></canvas></div>';
      chartsScriptHTML += 'new Chart(document.getElementById("hrChart"),{type:"line",data:{labels:' + JSON.stringify(streams.time.data.map(function(t) { return Math.floor(t/60); })) + ',datasets:[{data:' + JSON.stringify(streams.heartrate.data) + ',backgroundColor:"rgba(239,68,68,0.1)",borderColor:"#ef4444",borderWidth:2,fill:true,tension:0.4,pointRadius:0}]},options:{responsive:true,maintainAspectRatio:true,plugins:{legend:{display:false}},scales:{x:{grid:{color:"#1a1a1a"},ticks:{color:"#666",font:{size:9}}},y:{grid:{color:"#1a1a1a"},ticks:{color:"#666",font:{size:9}}}}}});';
    }
    
    if (streams.cadence) {
      chartsHTML += '<div class="chart-container"><h3>Cadence</h3><canvas id="cadenceChart"></canvas></div>';
      chartsScriptHTML += 'new Chart(document.getElementById("cadenceChart"),{type:"line",data:{labels:' + JSON.stringify(streams.time.data.map(function(t) { return Math.floor(t/60); })) + ',datasets:[{data:' + JSON.stringify(streams.cadence.data.map(function(c) { return c * 2; })) + ',backgroundColor:"rgba(139,92,246,0.1)",borderColor:"#8b5cf6",borderWidth:2,fill:true,tension:0.4,pointRadius:0}]},options:{responsive:true,maintainAspectRatio:true,plugins:{legend:{display:false}},scales:{x:{grid:{color:"#1a1a1a"},ticks:{color:"#666",font:{size:9}}},y:{grid:{color:"#1a1a1a"},ticks:{color:"#666",font:{size:9}}}}}});';
    }
    
    const scriptTag = chartsScriptHTML ? '<script src="https://cdn.jsdelivr.net/npm/chart.js"></script><script>Chart.defaults.color="#666";Chart.defaults.borderColor="#1a1a1a";' + chartsScriptHTML + '</script>' : '';
    
    const html = '<html><head><title>' + activity.name + '</title><meta name="viewport" content="width=device-width,initial-scale=1">' + (chartsScriptHTML ? '<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>' : '') + '<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;background:#0a0a0a;color:#e0e0e0;padding-bottom:20px}.header{background:#111;padding:20px 16px;border-bottom:1px solid #222}h1{font-size:20px;font-weight:600;margin-bottom:4px;color:#fff}.subtitle{font-size:14px;color:#888}.container{padding:16px}.back-btn{color:#3b82f6;text-decoration:none;font-size:14px;display:inline-block;margin-bottom:16px}.stats-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:20px}.stat-box{background:#111;border-radius:12px;padding:16px;text-align:center;border:1px solid #222}.stat-value{font-size:24px;font-weight:700;color:#fff;margin-bottom:4px}.stat-label{font-size:10px;color:#888;text-transform:uppercase}.chart-container{background:#111;padding:16px;margin:16px 0;border-radius:12px;border:1px solid #222}.chart-container h3{font-size:14px;margin-bottom:12px;color:#fff}canvas{max-height:200px!important}.pace-table{background:#111;border-radius:12px;padding:16px;margin:16px 0;border:1px solid #222}.pace-table h3{font-size:14px;margin-bottom:12px;color:#fff}.pace-row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #1a1a1a;font-size:13px}.pace-row:last-child{border-bottom:none}.pace-row .km{color:#888}.pace-row .pace{color:#fff;font-weight:600}.pace-row.fast .pace{color:#4ade80}.pace-row.slow .pace{color:#fb923c}</style></head><body><div class="header"><h1>' + activity.name + '</h1><div class="subtitle">' + date + '</div></div><div class="container"><a href="/dashboard" class="back-btn">← Retour</a><div class="stats-grid"><div class="stat-box"><div class="stat-value">' + distance + '</div><div class="stat-label">Distance (km)</div></div><div class="stat-box"><div class="stat-value">' + duration + ':' + String(durationSeconds).padStart(2, '0') + '</div><div class="stat-label">Temps</div></div><div class="stat-box"><div class="stat-value">' + pace + '</div><div class="stat-label">Allure (/km)</div></div><div class="stat-box"><div class="stat-value">' + elevation + 'm</div><div class="stat-label">Dénivelé</div></div>' + extraStatsHTML + '</div>' + paceTableHTML + chartsHTML + '</div>' + (chartsScriptHTML ? '<script>Chart.defaults.color="#666";Chart.defaults.borderColor="#1a1a1a";' + chartsScriptHTML + '</script>' : '') + '</body></html>';
    
    res.send(html);
  } catch (error) {
    res.send('Erreur');
  }
});

app.listen(PORT, function() {
  console.log('Serveur mobile sur http://localhost:' + PORT);
});