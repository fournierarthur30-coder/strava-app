require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
const CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

let userTokens = {};

app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Mon App Strava</title>
        <style>
          body { font-family: Arial; text-align: center; padding: 50px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; min-height: 100vh; }
          .connect-btn { background: #FC4C02; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-size: 18px; display: inline-block; margin-top: 20px; transition: transform 0.2s; }
          .connect-btn:hover { transform: scale(1.05); }
          h1 { font-size: 48px; margin-bottom: 10px; }
        </style>
      </head>
      <body>
        <h1>🏃‍♂️ Mon Coach Running Strava</h1>
        <p style="font-size: 20px;">Analyse tes performances • Prédit tes temps • Crée ton programme personnalisé</p>
        <a href="/auth/strava" class="connect-btn">Se connecter avec Strava</a>
      </body>
    </html>
  `);
});

app.get('/auth/strava', (req, res) => {
  const authUrl = `${STRAVA_AUTH_URL}?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${REDIRECT_URI}&approval_prompt=force&scope=read,activity:read_all,profile:read_all`;
  res.redirect(authUrl);
});

app.get('/auth/strava/callback', async (req, res) => {
  const authCode = req.query.code;
  if (!authCode) return res.send('Erreur: Pas de code autorisation');

  try {
    const tokenResponse = await axios.post(STRAVA_TOKEN_URL, {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code: authCode,
      grant_type: 'authorization_code'
    });

    const { access_token, refresh_token, expires_at, athlete } = tokenResponse.data;
    userTokens[athlete.id] = { accessToken: access_token, refreshToken: refresh_token, expiresAt: expires_at, athlete: athlete };
    res.redirect('/dashboard');
  } catch (error) {
    res.send('Erreur authentification');
  }
});

app.get('/dashboard', async (req, res) => {
  const athleteId = Object.keys(userTokens)[0];
  if (!athleteId) return res.redirect('/');
  const user = userTokens[athleteId];

  try {
    const activitiesResponse = await axios.get('https://www.strava.com/api/v3/athlete/activities', {
      headers: { 'Authorization': `Bearer ${user.accessToken}` },
      params: { per_page: 10 }
    });

    const activities = activitiesResponse.data;
    let html = `<html><head><title>Dashboard</title><style>* { margin: 0; padding: 0; box-sizing: border-box; } body { font-family: Arial; background: #f5f7fa; } .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; } .container { max-width: 1200px; margin: 0 auto; padding: 20px; } .nav { display: flex; gap: 15px; margin: 20px 0; flex-wrap: wrap; } .nav-btn { background: white; color: #667eea; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; } .nav-btn.special { background: #ff6b6b; color: white; animation: pulse 2s infinite; } @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } } .activity { background: white; padding: 20px; margin: 15px 0; border-radius: 10px; cursor: pointer; transition: all 0.2s; } .activity:hover { transform: translateY(-2px); box-shadow: 0 4px 10px rgba(0,0,0,0.12); } .stats { color: #666; display: flex; gap: 20px; flex-wrap: wrap; }</style></head><body><div class="header"><div class="container"><h1>👋 Bienvenue ${user.athlete.firstname} !</h1></div></div><div class="container"><div class="nav"><a href="/progression" class="nav-btn">📈 Progression</a><a href="/records" class="nav-btn">🏆 Records</a><a href="/prediction" class="nav-btn">🔮 Prédictions</a><a href="/programme" class="nav-btn">📋 Programme</a><a href="/run-in-lyon" class="nav-btn special">🏃‍♂️ Run In Lyon 2025</a></div><h2 style="margin: 30px 0 20px 0;">Dernières activités</h2>`;

    activities.forEach(a => {
      const dist = (a.distance / 1000).toFixed(2);
      const dur = Math.floor(a.moving_time / 60);
      const date = new Date(a.start_date).toLocaleDateString('fr-FR');
      const paceSeconds = a.distance > 0 ? a.moving_time / (a.distance / 1000) : 0;
      const paceMin = Math.floor(paceSeconds / 60);
      const paceSec = Math.round(paceSeconds % 60);
      const pace = `${paceMin}:${String(paceSec).padStart(2, '0')}`;
      html += `<div class="activity" style="cursor: pointer;" onclick="window.location.href='/activity/${a.id}'"><h3>${a.name}</h3><div class="stats"><div>📅 ${date}</div><div>📏 ${dist} km</div><div>⏱️ ${dur} min</div><div>⚡ ${pace} /km</div><div>👉 Voir détails</div></div></div>`;
    });

    html += `</div></body></html>`;
    res.send(html);
  } catch (error) {
    res.send('Erreur données');
  }
});

app.get('/progression', async (req, res) => {
  const athleteId = Object.keys(userTokens)[0];
  if (!athleteId) return res.redirect('/');
  const user = userTokens[athleteId];

  try {
    const activitiesResponse = await axios.get('https://www.strava.com/api/v3/athlete/activities', {
      headers: { 'Authorization': `Bearer ${user.accessToken}` },
      params: { per_page: 200 }
    });

    const runs = activitiesResponse.data.filter(a => a.type === 'Run');
    const weeklyData = {};
    
    runs.forEach(run => {
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
      .sort((a, b) => new Date(a.week) - new Date(b.week))
      .slice(-12)
      .map(w => ({
        week: new Date(w.week).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
        distance: Math.round(w.distance * 10) / 10,
        pace: w.distance > 0 ? Math.round((w.totalTime / 60) / w.distance * 10) / 10 : 0
      }));
    
    const weeks = JSON.stringify(weeklyArray.map(w => w.week));
    const distances = JSON.stringify(weeklyArray.map(w => w.distance));
    const paces = JSON.stringify(weeklyArray.map(w => w.pace));
    
    res.send(`<html><head><title>Progression</title><script src="https://cdn.jsdelivr.net/npm/chart.js"></script><style>body { font-family: Arial; background: #f5f7fa; margin: 0; } .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; } .container { max-width: 1200px; margin: 0 auto; padding: 20px; } .nav a { color: #667eea; text-decoration: none; font-weight: 600; margin-right: 20px; } .chart-container { background: white; padding: 25px; margin: 20px 0; border-radius: 10px; }</style></head><body><div class="header"><div class="container"><h1>📈 Ma Progression</h1></div></div><div class="container"><div class="nav"><a href="/dashboard">← Dashboard</a></div><div class="chart-container"><h2>Distance/semaine (km)</h2><canvas id="distanceChart"></canvas></div><div class="chart-container"><h2>Allure moyenne (min/km)</h2><canvas id="paceChart"></canvas></div></div><script>new Chart(document.getElementById('distanceChart'), { type: 'bar', data: { labels: ${weeks}, datasets: [{ label: 'Distance (km)', data: ${distances}, backgroundColor: 'rgba(102, 126, 234, 0.6)', borderColor: 'rgba(102, 126, 234, 1)', borderWidth: 2 }] }, options: { responsive: true, scales: { y: { beginAtZero: true } } } }); new Chart(document.getElementById('paceChart'), { type: 'line', data: { labels: ${weeks}, datasets: [{ label: 'Allure (min/km)', data: ${paces}, backgroundColor: 'rgba(118, 75, 162, 0.2)', borderColor: 'rgba(118, 75, 162, 1)', borderWidth: 2, fill: true, tension: 0.4 }] }, options: { responsive: true, scales: { y: { reverse: true } } } });</script></body></html>`);
  } catch (error) {
    res.send('Erreur');
  }
});

app.get('/records', async (req, res) => {
  const athleteId = Object.keys(userTokens)[0];
  if (!athleteId) return res.redirect('/');
  const user = userTokens[athleteId];

  try {
    const activitiesResponse = await axios.get('https://www.strava.com/api/v3/athlete/activities', {
      headers: { 'Authorization': `Bearer ${user.accessToken}` },
      params: { per_page: 200 }
    });

    const runs = activitiesResponse.data.filter(a => a.type === 'Run');
    
    const bestPaceRun = runs.reduce((best, run) => {
      const pace = run.distance > 0 ? (run.moving_time / 60) / (run.distance / 1000) : Infinity;
      const bestPace = best.distance > 0 ? (best.moving_time / 60) / (best.distance / 1000) : Infinity;
      return pace < bestPace ? run : best;
    }, runs[0] || {});
    
    const bestPace = bestPaceRun.distance > 0 ? ((bestPaceRun.moving_time / 60) / (bestPaceRun.distance / 1000)).toFixed(2) : 0;
    const longestRun = runs.reduce((longest, run) => run.distance > (longest.distance || 0) ? run : longest, runs[0] || {});
    const biggestElevationRun = runs.reduce((biggest, run) => (run.total_elevation_gain || 0) > (biggest.total_elevation_gain || 0) ? run : biggest, runs[0] || {});
    
    res.send(`<html><head><title>Records</title><style>body { font-family: Arial; background: #f5f7fa; margin: 0; } .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; } .container { max-width: 1200px; margin: 0 auto; padding: 20px; } .nav a { color: #667eea; text-decoration: none; margin-right: 20px; } .records-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin: 20px 0; } .record-card { background: white; padding: 25px; border-radius: 10px; } .record-icon { font-size: 48px; } .record-value { font-size: 32px; font-weight: bold; color: #667eea; margin: 10px 0; }</style></head><body><div class="header"><div class="container"><h1>🏆 Mes Records</h1></div></div><div class="container"><div class="nav"><a href="/dashboard">← Dashboard</a></div><div class="records-grid"><div class="record-card"><div class="record-icon">⚡</div><h3>Meilleure Allure</h3><div class="record-value">${bestPace} min/km</div><p>${bestPaceRun.name || 'N/A'}</p></div><div class="record-card"><div class="record-icon">📏</div><h3>Plus Longue Distance</h3><div class="record-value">${(longestRun.distance / 1000).toFixed(2)} km</div><p>${longestRun.name || 'N/A'}</p></div><div class="record-card"><div class="record-icon">⛰️</div><h3>Plus Gros Dénivelé</h3><div class="record-value">${Math.round(biggestElevationRun.total_elevation_gain || 0)} m</div><p>${biggestElevationRun.name || 'N/A'}</p></div></div></div></body></html>`);
  } catch (error) {
    res.send('Erreur');
  }
});

app.get('/prediction', async (req, res) => {
  const athleteId = Object.keys(userTokens)[0];
  if (!athleteId) return res.redirect('/');
  const user = userTokens[athleteId];

  try {
    const activitiesResponse = await axios.get('https://www.strava.com/api/v3/athlete/activities', {
      headers: { 'Authorization': `Bearer ${user.accessToken}` },
      params: { per_page: 50 }
    });

    const runs = activitiesResponse.data.filter(a => a.type === 'Run' && a.distance > 3000);
    if (runs.length === 0) return res.send('Pas assez de données');
    
    const recentPaces = runs.slice(0, 10).map(run => (run.moving_time / 60) / (run.distance / 1000));
    const avgPace = recentPaces.reduce((sum, pace) => sum + pace, 0) / recentPaces.length;
    
    function predictTime(distance, basePace) {
      const baseDistance = 5;
      const factor = Math.pow(distance / baseDistance, 1.06);
      return (basePace * baseDistance * factor);
    }
    
    function formatTime(minutes) {
      const hours = Math.floor(minutes / 60);
      const mins = Math.floor(minutes % 60);
      const secs = Math.floor((minutes % 1) * 60);
      if (hours > 0) return `${hours}h${mins.toString().padStart(2, '0')}min`;
      return `${mins}min${secs.toString().padStart(2, '0')}s`;
    }
    
    const predictions = {
      '5km': predictTime(5, avgPace),
      '10km': predictTime(10, avgPace),
      'Semi': predictTime(21.1, avgPace),
      'Marathon': predictTime(42.2, avgPace)
    };
    
    res.send(`<html><head><title>Prédictions</title><style>body { font-family: Arial; background: #f5f7fa; margin: 0; } .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; } .container { max-width: 1200px; margin: 0 auto; padding: 20px; } .nav a { color: #667eea; text-decoration: none; margin-right: 20px; } .predictions-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; } .prediction-card { background: white; padding: 30px; border-radius: 10px; text-align: center; } .time-prediction { font-size: 32px; font-weight: bold; color: #667eea; margin: 10px 0; }</style></head><body><div class="header"><div class="container"><h1>🔮 Prédictions</h1></div></div><div class="container"><div class="nav"><a href="/dashboard">← Dashboard</a></div><p style="margin: 20px 0;">Basé sur ton allure moyenne : ${avgPace.toFixed(2)} min/km</p><div class="predictions-grid">${Object.entries(predictions).map(([distance, time]) => `<div class="prediction-card"><h3>${distance}</h3><div class="time-prediction">${formatTime(time)}</div></div>`).join('')}</div></div></body></html>`);
  } catch (error) {
    res.send('Erreur');
  }
});

app.get('/programme', async (req, res) => {
  const athleteId = Object.keys(userTokens)[0];
  if (!athleteId) return res.redirect('/');
  const user = userTokens[athleteId];

  try {
    const activitiesResponse = await axios.get('https://www.strava.com/api/v3/athlete/activities', {
      headers: { 'Authorization': `Bearer ${user.accessToken}` },
      params: { per_page: 50 }
    });

    const runs = activitiesResponse.data.filter(a => a.type === 'Run');
    
    const weeklyDistances = {};
    runs.forEach(run => {
      const weekKey = new Date(run.start_date).toISOString().split('T')[0].slice(0, 7);
      weeklyDistances[weekKey] = (weeklyDistances[weekKey] || 0) + (run.distance / 1000);
    });
    
    const avgWeeklyKm = Object.values(weeklyDistances).length > 0 
      ? Object.values(weeklyDistances).reduce((sum, d) => sum + d, 0) / Object.values(weeklyDistances).length
      : 20;
    
    const programs = {
      debutant: {
        title: "Débutant",
        weeklyKm: Math.max(15, Math.round(avgWeeklyKm * 0.8)),
        sessions: [
          "Lundi: Repos",
          "Mardi: 30min endurance",
          "Mercredi: Repos",
          "Jeudi: 35min fartlek",
          "Vendredi: Repos",
          "Samedi: 45min endurance",
          "Dimanche: 1h sortie longue"
        ]
      },
      intermediaire: {
        title: "Intermédiaire",
        weeklyKm: Math.max(30, Math.round(avgWeeklyKm)),
        sessions: [
          "Lundi: Repos ou 30min récup",
          "Mardi: VMA 8x400m",
          "Mercredi: 45min endurance",
          "Jeudi: Seuil 50min",
          "Vendredi: Repos",
          "Samedi: 1h endurance active",
          "Dimanche: 1h30-2h sortie longue"
        ]
      },
      confirme: {
        title: "Confirmé",
        weeklyKm: Math.max(50, Math.round(avgWeeklyKm * 1.2)),
        sessions: [
          "Lundi: 40min récup",
          "Mardi: Fractionné 5x1000m",
          "Mercredi: 1h endurance",
          "Jeudi: Seuil + VMA",
          "Vendredi: 45min léger",
          "Samedi: 1h15 tempo",
          "Dimanche: 2h-2h30 sortie longue"
        ]
      }
    };
    
    let suggestedLevel = 'debutant';
    if (avgWeeklyKm > 25 && runs.length > 30) suggestedLevel = 'intermediaire';
    if (avgWeeklyKm > 45 && runs.length > 50) suggestedLevel = 'confirme';
    
    res.send(`<html><head><title>Programme</title><style>body { font-family: Arial; background: #f5f7fa; margin: 0; } .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; } .container { max-width: 1200px; margin: 0 auto; padding: 20px; } .nav a { color: #667eea; text-decoration: none; margin-right: 20px; } .programs { display: grid; gap: 20px; margin: 30px 0; } .program-card { background: white; padding: 25px; border-radius: 10px; border: 3px solid #ddd; } .program-card.suggested { border-color: #667eea; } .program-title { font-size: 24px; color: #667eea; margin-bottom: 15px; } .session { padding: 10px; margin: 5px 0; background: #f8f9fa; border-radius: 5px; }</style></head><body><div class="header"><div class="container"><h1>📋 Programmes d'Entraînement</h1></div></div><div class="container"><div class="nav"><a href="/dashboard">← Dashboard</a></div><p>Niveau suggéré: <strong>${suggestedLevel}</strong> (${avgWeeklyKm.toFixed(0)} km/semaine actuellement)</p><div class="programs">${Object.entries(programs).map(([level, program]) => `<div class="program-card ${level === suggestedLevel ? 'suggested' : ''}"><div class="program-title">${program.title} ${level === suggestedLevel ? '✨ Suggéré' : ''}</div><p>Volume: ${program.weeklyKm} km/semaine</p><div style="margin-top: 15px;">${program.sessions.map(s => `<div class="session">${s}</div>`).join('')}</div></div>`).join('')}</div></div></body></html>`);
  } catch (error) {
    res.send('Erreur');
  }
});

// DETAIL D'UNE ACTIVITE
app.get('/activity/:id', async (req, res) => {
  const athleteId = Object.keys(userTokens)[0];
  if (!athleteId) return res.redirect('/');
  const user = userTokens[athleteId];
  const activityId = req.params.id;

  try {
    const activityResponse = await axios.get(`https://www.strava.com/api/v3/activities/${activityId}`, {
      headers: { 'Authorization': `Bearer ${user.accessToken}` }
    });

    const activity = activityResponse.data;
    
    // Récupérer les streams (données détaillées)
    let streams = {};
    try {
      const streamsResponse = await axios.get(`https://www.strava.com/api/v3/activities/${activityId}/streams`, {
        headers: { 'Authorization': `Bearer ${user.accessToken}` },
        params: { keys: 'distance,altitude,heartrate,time', key_by_type: true }
      });
      streams = streamsResponse.data;
    } catch (e) {
      console.log('Pas de streams disponibles');
    }

    const distance = (activity.distance / 1000).toFixed(2);
    const duration = Math.floor(activity.moving_time / 60);
    const durationSeconds = activity.moving_time % 60;
    const avgPaceSeconds = activity.distance > 0 ? activity.moving_time / (activity.distance / 1000) : 0;
    const paceMinutes = Math.floor(avgPaceSeconds / 60);
    const paceSeconds = Math.round(avgPaceSeconds % 60);
    const pace = `${paceMinutes}:${String(paceSeconds).padStart(2, '0')}`;
    const date = new Date(activity.start_date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    // Récupérer les splits officiels de Strava
    let paceByKm = [];
    if (activity.splits_metric && activity.splits_metric.length > 0) {
      // Utiliser les splits officiels de Strava (plus précis)
      activity.splits_metric.forEach((split, idx) => {
        // Inclure tous les splits, même partiels
        const paceSeconds = split.moving_time / (split.distance / 1000);
        const paceMinutes = Math.floor(paceSeconds / 60);
        const paceSecs = Math.round(paceSeconds % 60);
        paceByKm.push({ 
          km: idx + 1, 
          pace: `${paceMinutes}:${String(paceSecs).padStart(2, '0')}`,
          distance: (split.distance / 1000).toFixed(2)
        });
      });
    } else if (streams.distance && streams.time) {
      // Fallback sur les streams si pas de splits
      const distanceData = streams.distance.data;
      const timeData = streams.time.data;
      
      for (let km = 1; km <= Math.floor(activity.distance / 1000); km++) {
        const kmDistance = km * 1000;
        const prevKmDistance = (km - 1) * 1000;
        
        let startIdx = distanceData.findIndex(d => d >= prevKmDistance);
        let endIdx = distanceData.findIndex(d => d >= kmDistance);
        
        if (startIdx !== -1 && endIdx !== -1 && startIdx !== endIdx) {
          const timeDiff = (timeData[endIdx] - timeData[startIdx]) / 60;
          const minutes = Math.floor(timeDiff);
          const seconds = Math.round((timeDiff % 1) * 60);
          paceByKm.push({ km: km, pace: `${minutes}:${String(seconds).padStart(2, '0')}` });
        }
      }
    }
    
    // Stats cardio
    const avgHR = activity.average_heartrate ? Math.round(activity.average_heartrate) : null;
    const maxHR = activity.max_heartrate ? Math.round(activity.max_heartrate) : null;
    
    // Dénivelé
    const elevation = Math.round(activity.total_elevation_gain || 0);
    
    res.send(`<html><head><title>Détails Activité</title><script src="https://cdn.jsdelivr.net/npm/chart.js"></script><style>body { font-family: Arial; background: #f5f7fa; margin: 0; } .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; } .container { max-width: 1200px; margin: 0 auto; padding: 20px; } .nav a { color: #667eea; text-decoration: none; margin-right: 20px; font-weight: 600; } .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 20px 0; } .stat-box { background: white; padding: 20px; border-radius: 10px; text-align: center; } .stat-value { font-size: 28px; font-weight: bold; color: #667eea; } .stat-label { font-size: 12px; color: #666; margin-top: 5px; } .chart-container { background: white; padding: 25px; margin: 20px 0; border-radius: 10px; } .pace-table { background: white; padding: 25px; margin: 20px 0; border-radius: 10px; } table { width: 100%; border-collapse: collapse; } th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; } th { background: #f8f9fa; color: #667eea; font-weight: 600; } .fast { color: #4caf50; font-weight: bold; } .slow { color: #ff9800; }</style></head><body><div class="header"><div class="container"><h1>${activity.name}</h1><p style="opacity: 0.9;">${date}</p></div></div><div class="container"><div class="nav"><a href="/dashboard">← Dashboard</a></div><div class="stats-grid"><div class="stat-box"><div class="stat-value">${distance} km</div><div class="stat-label">Distance</div></div><div class="stat-box"><div class="stat-value">${duration}:${String(durationSeconds).padStart(2, '0')}</div><div class="stat-label">Durée</div></div><div class="stat-box"><div class="stat-value">${pace} /km</div><div class="stat-label">Allure moyenne</div></div><div class="stat-box"><div class="stat-value">${elevation} m</div><div class="stat-label">Dénivelé</div></div>${avgHR ? `<div class="stat-box"><div class="stat-value">${avgHR} bpm</div><div class="stat-label">FC moyenne</div></div>` : ''}${maxHR ? `<div class="stat-box"><div class="stat-value">${maxHR} bpm</div><div class="stat-label">FC max</div></div>` : ''}</div>${paceByKm.length > 0 ? `<div class="pace-table"><h2>Allure par kilomètre</h2><table><thead><tr><th>Kilomètre</th><th>Allure (min/km)</th></tr></thead><tbody>${paceByKm.map(p => {
      const splitPace = p.pace.split(':');
      const paceInSeconds = parseInt(splitPace[0]) * 60 + parseInt(splitPace[1]);
      const avgPaceInSeconds = paceMinutes * 60 + paceSeconds;
      const className = paceInSeconds < avgPaceInSeconds - 5 ? 'fast' : (paceInSeconds > avgPaceInSeconds + 5 ? 'slow' : '');
      const kmLabel = p.distance == '1.00' ? `Km ${p.km}` : `Km ${p.km} (${p.distance} km)`;
      return `<tr><td>${kmLabel}</td><td class="${className}">${p.pace} /km</td></tr>`;
    }).join('')}</tbody></table></div>` : '<div style="background: white; padding: 25px; margin: 20px 0; border-radius: 10px;"><p style="color: #666;">Les détails par kilomètre ne sont pas disponibles pour cette activité.</p></div>'}${streams.altitude && streams.distance ? `<div class="chart-container"><h2>Profil d'altitude</h2><canvas id="elevationChart"></canvas></div><script>new Chart(document.getElementById('elevationChart'), { type: 'line', data: { labels: ${JSON.stringify(streams.distance.data.map(d => (d/1000).toFixed(1)))}, datasets: [{ label: 'Altitude (m)', data: ${JSON.stringify(streams.altitude.data)}, backgroundColor: 'rgba(118, 75, 162, 0.2)', borderColor: 'rgba(118, 75, 162, 1)', borderWidth: 2, fill: true, tension: 0.4 }] }, options: { responsive: true, scales: { x: { title: { display: true, text: 'Distance (km)' } }, y: { title: { display: true, text: 'Altitude (m)' } } } } });</script>` : ''}${streams.heartrate ? `<div class="chart-container"><h2>Fréquence cardiaque</h2><canvas id="hrChart"></canvas></div><script>new Chart(document.getElementById('hrChart'), { type: 'line', data: { labels: ${JSON.stringify(streams.time.data.map(t => Math.floor(t/60)))}, datasets: [{ label: 'BPM', data: ${JSON.stringify(streams.heartrate.data)}, backgroundColor: 'rgba(244, 67, 54, 0.2)', borderColor: 'rgba(244, 67, 54, 1)', borderWidth: 2, fill: true, tension: 0.4 }] }, options: { responsive: true, scales: { x: { title: { display: true, text: 'Temps (min)' } }, y: { title: { display: true, text: 'BPM' } } } } });</script>` : ''}</div></body></html>`);
  } catch (error) {
    console.error('Erreur:', error.response?.data || error.message);
    res.send('Erreur lors de la récupération des détails');
  }
});

// PROGRAMME RUN IN LYON
let trainingProgress = {};

app.get('/run-in-lyon', (req, res) => {
  const athleteId = Object.keys(userTokens)[0];
  if (!athleteId) return res.redirect('/');

  const raceDate = new Date('2025-10-02');
  const today = new Date();
  const weeksUntilRace = Math.ceil((raceDate - today) / (7 * 24 * 60 * 60 * 1000));
  
  // Programme de 16 semaines pour un semi-marathon
  const weeklyPlan = [
    { week: 1, volume: 25, sessions: ['Repos', '5km facile', '6km endurance', 'Repos', '5km facile', 'Repos', '8km sortie longue'] },
    { week: 2, volume: 28, sessions: ['Repos', '6km facile', '6x400m VMA', 'Repos', '6km endurance', 'Repos', '10km sortie longue'] },
    { week: 3, volume: 30, sessions: ['Repos', '6km facile', '7km endurance', 'Repos', '6x400m VMA', 'Repos', '11km sortie longue'] },
    { week: 4, volume: 22, sessions: ['Repos', '5km récup', '5km facile', 'Repos', '5km facile', 'Repos', '7km léger (semaine récup)'] },
    { week: 5, volume: 33, sessions: ['Repos', '7km facile', '8x400m VMA', 'Repos', '7km endurance', 'Repos', '12km sortie longue'] },
    { week: 6, volume: 36, sessions: ['Repos', '7km facile', '5x1000m seuil', 'Repos', '8km endurance', 'Repos', '13km sortie longue'] },
    { week: 7, volume: 38, sessions: ['Repos', '8km facile', '6x1000m seuil', 'Repos', '8km endurance', 'Repos', '14km sortie longue'] },
    { week: 8, volume: 25, sessions: ['Repos', '6km récup', '5km facile', 'Repos', '6km facile', 'Repos', '8km léger (semaine récup)'] },
    { week: 9, volume: 42, sessions: ['Repos', '8km facile', '8x400m VMA', 'Repos', '10km endurance', 'Repos', '16km sortie longue'] },
    { week: 10, volume: 45, sessions: ['Repos', '8km facile', '3x2000m seuil', 'Repos', '10km endurance', 'Repos', '17km sortie longue'] },
    { week: 11, volume: 48, sessions: ['Repos', '8km facile', '10km tempo', 'Repos', '10km endurance', 'Repos', '18km sortie longue'] },
    { week: 12, volume: 30, sessions: ['Repos', '6km récup', '6km facile', 'Repos', '6km facile', 'Repos', '10km léger (semaine récup)'] },
    { week: 13, volume: 45, sessions: ['Repos', '8km facile', '2x3000m seuil', 'Repos', '10km endurance', 'Repos', '19km sortie longue'] },
    { week: 14, volume: 42, sessions: ['Repos', '8km facile', '15km allure semi', 'Repos', '8km endurance', 'Repos', '11km léger'] },
    { week: 15, volume: 35, sessions: ['Repos', '6km facile', '5x1000m', 'Repos', '6km facile', 'Repos', '10km affûtage'] },
    { week: 16, volume: 25, sessions: ['Repos', '5km facile', '3km + 3x400m', 'Repos', '4km facile', 'Repos', '🏁 COURSE Run In Lyon 21.1km !'] }
  ];
  
  // Initialiser la progression si nécessaire
  if (!trainingProgress[athleteId]) {
    trainingProgress[athleteId] = {};
  }
  
  // Calculer la chaîne de réussite
  const completedDays = Object.values(trainingProgress[athleteId]).filter(v => v).length;
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
  
  // Calculer la chaîne actuelle
  const recentDates = sortedDates.slice(-30);
  for (let i = recentDates.length - 1; i >= 0; i--) {
    if (trainingProgress[athleteId][recentDates[i]]) {
      currentStreak++;
    } else {
      break;
    }
  }
  
  res.send(`<html><head><title>Run In Lyon 2025</title><style>body { font-family: Arial; background: #f5f7fa; margin: 0; } .header { background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%); color: white; padding: 40px; text-align: center; } .race-logo { font-size: 64px; margin-bottom: 10px; } .countdown { font-size: 48px; font-weight: bold; margin: 20px 0; } .container { max-width: 1200px; margin: 0 auto; padding: 20px; } .nav a { color: #ff6b6b; text-decoration: none; margin-right: 20px; font-weight: 600; } .stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; } .stat-card { background: white; padding: 25px; border-radius: 10px; text-align: center; box-shadow: 0 2px 5px rgba(0,0,0,0.08); } .stat-value { font-size: 36px; font-weight: bold; color: #ff6b6b; } .stat-label { color: #666; margin-top: 8px; } .week-card { background: white; padding: 25px; margin: 20px 0; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.08); } .week-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #ff6b6b; padding-bottom: 15px; } .week-title { font-size: 20px; font-weight: bold; color: #333; } .week-volume { background: #ff6b6b; color: white; padding: 8px 16px; border-radius: 20px; font-size: 14px; } .sessions-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 10px; } .session-day { background: #f8f9fa; padding: 15px 10px; border-radius: 8px; text-align: center; cursor: pointer; transition: all 0.2s; border: 2px solid transparent; } .session-day:hover { transform: translateY(-2px); box-shadow: 0 4px 8px rgba(0,0,0,0.1); } .session-day.completed { background: #d4edda; border-color: #28a745; } .session-day.rest { background: #e9ecef; opacity: 0.7; cursor: default; } .day-name { font-size: 11px; font-weight: bold; color: #666; margin-bottom: 8px; } .session-name { font-size: 12px; color: #333; line-height: 1.4; } .check-icon { font-size: 20px; color: #28a745; margin-top: 5px; } .streak-badge { display: inline-block; background: #ffd700; color: #333; padding: 5px 15px; border-radius: 20px; font-weight: bold; margin: 0 10px; } .fire-emoji { font-size: 24px; } .current-week { border: 3px solid #ff6b6b; }</style></head><body><div class="header"><div class="race-logo">🏃‍♂️</div><h1 style="font-size: 48px; margin: 10px 0;">Run In Lyon 2025</h1><p style="font-size: 20px; opacity: 0.9;">Semi-Marathon • 2 Octobre 2025 • 21.1 km</p><div class="countdown">${weeksUntilRace} semaines restantes</div></div><div class="container"><div class="nav"><a href="/dashboard">← Dashboard</a><a href="/programme">Autres programmes</a></div><div class="stats-row"><div class="stat-card"><div class="stat-value">${completedDays}</div><div class="stat-label">Séances complétées</div></div><div class="stat-card"><div class="stat-value"><span class="fire-emoji">🔥</span> ${currentStreak}</div><div class="stat-label">Chaîne actuelle</div></div><div class="stat-card"><div class="stat-value"><span class="fire-emoji">⭐</span> ${maxStreak}</div><div class="stat-label">Record de chaîne</div></div><div class="stat-card"><div class="stat-value">${Math.round((completedDays / (16 * 7)) * 100)}%</div><div class="stat-label">Progression programme</div></div></div><h2 style="color: #ff6b6b; margin: 40px 0 20px 0;">Programme d'entraînement 16 semaines</h2>${weeklyPlan.map((week, weekIdx) => {
    const isCurrentWeek = weekIdx === Math.min(weeklyPlan.length - 1, Math.max(0, 16 - weeksUntilRace));
    return `<div class="week-card ${isCurrentWeek ? 'current-week' : ''}"><div class="week-header"><div class="week-title">Semaine ${week.week} ${isCurrentWeek ? '← Semaine actuelle' : ''}</div><div class="week-volume">${week.volume} km</div></div><div class="sessions-grid">${week.sessions.map((session, dayIdx) => {
      const dayKey = `w${week.week}d${dayIdx}`;
      const isCompleted = trainingProgress[athleteId][dayKey];
      const isRest = session.toLowerCase().includes('repos');
      const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
      return `<div class="session-day ${isCompleted ? 'completed' : ''} ${isRest ? 'rest' : ''}" onclick="${isRest ? '' : `toggleSession('${dayKey}')`}"><div class="day-name">${dayNames[dayIdx]}</div><div class="session-name">${session}</div>${isCompleted ? '<div class="check-icon">✓</div>' : ''}</div>`;
    }).join('')}</div></div>`;
  }).join('')}<div style="background: white; padding: 25px; margin: 30px 0; border-radius: 10px;"><h3 style="color: #ff6b6b; margin-bottom: 15px;">💡 Conseils pour réussir</h3><ul style="line-height: 2.5; color: #666;"><li>📅 <strong>Respecte les jours de repos</strong> - Ils sont essentiels pour progresser</li><li>🏃 <strong>Allure semi = Allure actuelle + 10-15 sec/km</strong></li><li>💧 <strong>Hydrate-toi</strong> avant, pendant et après chaque sortie</li><li>🔥 <strong>Maintiens ta chaîne</strong> - La régularité fait la différence !</li><li>📈 <strong>Augmente progressivement</strong> - Les semaines de récup sont importantes</li><li>🎯 <strong>Visualise ton objectif</strong> - 21.1 km à Lyon, tu vas y arriver !</li></ul></div></div><script>function toggleSession(dayKey) { fetch('/toggle-session?key=' + dayKey + '&athlete=' + '${athleteId}').then(() => location.reload()); }</script></body></html>`);
});

app.get('/toggle-session', (req, res) => {
  const { key, athlete } = req.query;
  if (!trainingProgress[athlete]) trainingProgress[athlete] = {};
  trainingProgress[athlete][key] = !trainingProgress[athlete][key];
  res.send('OK');
});

app.listen(PORT, () => {
  console.log(`Serveur demarre sur http://localhost:${PORT}`);
});