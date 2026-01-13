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
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'SF Pro Display', -apple-system, Arial;
            background: #000;
            color: #fff;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            overflow: hidden;
          }
          body::before {
            content: '';
            position: absolute;
            width: 800px;
            height: 800px;
            background: radial-gradient(circle, rgba(255,51,102,0.3) 0%, transparent 70%);
            top: -200px;
            right: -200px;
            animation: pulse 4s ease-in-out infinite;
          }
          body::after {
            content: '';
            position: absolute;
            width: 600px;
            height: 600px;
            background: radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%);
            bottom: -150px;
            left: -150px;
            animation: pulse 5s ease-in-out infinite;
          }
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 0.5; }
            50% { transform: scale(1.1); opacity: 0.7; }
          }
          .container {
            text-align: center;
            position: relative;
            z-index: 1;
            padding: 50px;
          }
          .logo { 
            font-size: 120px;
            margin-bottom: 30px;
            animation: float 3s ease-in-out infinite;
          }
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-20px); }
          }
          h1 { 
            font-size: 72px;
            font-weight: 900;
            margin-bottom: 20px;
            background: linear-gradient(135deg, #ff3366 0%, #ff6b9d 50%, #6366f1 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            letter-spacing: -3px;
          }
          p {
            font-size: 24px;
            color: rgba(255,255,255,0.7);
            margin-bottom: 50px;
            font-weight: 300;
          }
          .connect-btn { 
            background: linear-gradient(135deg, #ff3366 0%, #ff6b9d 100%);
            color: white;
            padding: 20px 50px;
            text-decoration: none;
            border-radius: 50px;
            font-size: 20px;
            font-weight: 700;
            display: inline-block;
            transition: all 0.3s;
            box-shadow: 0 10px 40px rgba(255,51,102,0.4);
            border: none;
            cursor: pointer;
          }
          .connect-btn:hover {
            transform: translateY(-5px);
            box-shadow: 0 15px 50px rgba(255,51,102,0.6);
          }
          .features {
            display: flex;
            gap: 30px;
            justify-content: center;
            margin-top: 60px;
            flex-wrap: wrap;
          }
          .feature {
            background: rgba(255,255,255,0.05);
            padding: 20px 30px;
            border-radius: 20px;
            border: 1px solid rgba(255,255,255,0.1);
            backdrop-filter: blur(10px);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">🏃‍♂️</div>
          <h1>Mon Coach Running</h1>
          <p>Analyse • Prédis • Progresse</p>
          <a href="/auth/strava" class="connect-btn">Se connecter avec Strava</a>
          <div class="features">
            <div class="feature">📈 Graphiques de progression</div>
            <div class="feature">🏆 Records personnels</div>
            <div class="feature">🔮 Prédictions</div>
            <div class="feature">📋 Programmes sur mesure</div>
          </div>
        </div>
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
    let html = `<html><head><title>Dashboard</title><style>* { margin: 0; padding: 0; box-sizing: border-box; } body { font-family: 'SF Pro Display', -apple-system, Arial; background: #000; color: #fff; } .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 50px 30px; border-bottom: 1px solid rgba(255,255,255,0.1); } .header-content { max-width: 1400px; margin: 0 auto; } .welcome { font-size: 48px; font-weight: 800; margin-bottom: 10px; background: linear-gradient(135deg, #ff3366 0%, #6366f1 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; } .subtitle { color: rgba(255,255,255,0.6); font-size: 18px; } .container { max-width: 1400px; margin: 0 auto; padding: 40px 20px; } .nav { display: flex; gap: 15px; margin: 30px 0; flex-wrap: wrap; } .nav-btn { background: linear-gradient(135deg, rgba(255,51,102,0.1) 0%, rgba(99,102,241,0.1) 100%); color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 16px; font-weight: 600; border: 1px solid rgba(255,255,255,0.1); transition: all 0.3s; display: inline-block; } .nav-btn:hover { background: linear-gradient(135deg, rgba(255,51,102,0.2) 0%, rgba(99,102,241,0.2) 100%); transform: translateY(-2px); border-color: rgba(255,51,102,0.5); } .nav-btn.special { background: linear-gradient(135deg, #ff3366 0%, #ff6b9d 100%); animation: pulse 2s infinite; box-shadow: 0 0 30px rgba(255,51,102,0.4); } h2 { margin: 50px 0 25px 0; font-size: 32px; font-weight: 800; } .activity { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 25px; margin: 20px 0; border-radius: 20px; cursor: pointer; transition: all 0.3s; border: 1px solid rgba(255,255,255,0.1); position: relative; overflow: hidden; } .activity::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, #ff3366, #6366f1); opacity: 0; transition: opacity 0.3s; } .activity:hover { transform: translateY(-5px); box-shadow: 0 10px 40px rgba(255,51,102,0.2); border-color: rgba(255,51,102,0.3); } .activity:hover::before { opacity: 1; } .activity h3 { font-size: 20px; margin-bottom: 15px; color: #fff; } .stats { color: rgba(255,255,255,0.7); display: flex; gap: 25px; flex-wrap: wrap; font-size: 15px; } .stats > div { display: flex; align-items: center; gap: 8px; }</style></head><body><div class="header"><div class="header-content"><div class="welcome">👋 Bienvenue ${user.athlete.firstname} !</div><div class="subtitle">Ton coach running personnel</div></div></div><div class="container"><div class="nav"><a href="/progression" class="nav-btn">📈 Progression</a><a href="/records" class="nav-btn">🏆 Records</a><a href="/prediction" class="nav-btn">🔮 Prédictions</a><a href="/programme" class="nav-btn">📋 Programme</a><a href="/run-in-lyon" class="nav-btn special">🏃‍♂️ Run In Lyon 2026</a></div><h2>Dernières activités</h2>`;

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
    
    res.send(`<html><head><title>Records</title><style>* { margin: 0; padding: 0; box-sizing: border-box; } body { font-family: 'SF Pro Display', -apple-system, Arial; background: #000; color: #fff; } .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 50px 30px; border-bottom: 1px solid rgba(255,255,255,0.1); } .header-content { max-width: 1400px; margin: 0 auto; } h1 { font-size: 48px; font-weight: 800; background: linear-gradient(135deg, #ff3366 0%, #ffd700 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; } .container { max-width: 1400px; margin: 0 auto; padding: 40px 20px; } .nav { margin: 30px 0; display: flex; gap: 15px; flex-wrap: wrap; } .nav a { color: rgba(255,255,255,0.7); text-decoration: none; font-weight: 600; padding: 12px 24px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); transition: all 0.3s; } .nav a:hover { color: #ff3366; border-color: rgba(255,51,102,0.5); background: rgba(255,51,102,0.1); } .records-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 30px; margin: 40px 0; } .record-card { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 40px; border-radius: 24px; border: 1px solid rgba(255,255,255,0.1); position: relative; overflow: hidden; transition: all 0.3s; } .record-card:hover { transform: translateY(-5px); box-shadow: 0 20px 60px rgba(255,215,0,0.2); border-color: rgba(255,215,0,0.3); } .record-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px; } .record-card:nth-child(1)::before { background: linear-gradient(90deg, #ffd700, #ffed4e); } .record-card:nth-child(2)::before { background: linear-gradient(90deg, #ff3366, #ff6b9d); } .record-card:nth-child(3)::before { background: linear-gradient(90deg, #6366f1, #8b5cf6); } .record-icon { font-size: 64px; margin-bottom: 20px; } .record-title { font-size: 16px; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 2px; margin-bottom: 15px; font-weight: 600; } .record-value { font-size: 48px; font-weight: 900; margin: 20px 0; } .record-card:nth-child(1) .record-value { background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; } .record-card:nth-child(2) .record-value { background: linear-gradient(135deg, #ff3366 0%, #ff6b9d 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; } .record-card:nth-child(3) .record-value { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; } .record-activity { color: rgba(255,255,255,0.5); font-size: 15px; margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); line-height: 1.8; } .record-date { color: rgba(255,255,255,0.4); font-size: 13px; margin-top: 8px; }</style></head><body><div class="header"><div class="header-content"><h1>🏆 Mes Records Personnels</h1></div></div><div class="container"><div class="nav"><a href="/dashboard">← Dashboard</a><a href="/progression">📈 Progression</a><a href="/prediction">🔮 Prédictions</a></div><div class="records-grid"><div class="record-card"><div class="record-icon">⚡</div><div class="record-title">Meilleure Allure</div><div class="record-value">${bestPace} /km</div><div class="record-activity"><strong>${bestPaceRun.name || 'N/A'}</strong><br>${(bestPaceRun.distance / 1000).toFixed(2)} km<div class="record-date">${bestPaceRun.start_date ? new Date(bestPaceRun.start_date).toLocaleDateString('fr-FR') : ''}</div></div></div><div class="record-card"><div class="record-icon">📏</div><div class="record-title">Plus Longue Distance</div><div class="record-value">${(longestRun.distance / 1000).toFixed(2)} km</div><div class="record-activity"><strong>${longestRun.name || 'N/A'}</strong><br>${Math.floor((longestRun.moving_time || 0) / 60)} minutes<div class="record-date">${longestRun.start_date ? new Date(longestRun.start_date).toLocaleDateString('fr-FR') : ''}</div></div></div><div class="record-card"><div class="record-icon">⛰️</div><div class="record-title">Plus Gros Dénivelé</div><div class="record-value">${Math.round(biggestElevationRun.total_elevation_gain || 0)} m</div><div class="record-activity"><strong>${biggestElevationRun.name || 'N/A'}</strong><br>${(biggestElevationRun.distance / 1000).toFixed(2)} km<div class="record-date">${biggestElevationRun.start_date ? new Date(biggestElevationRun.start_date).toLocaleDateString('fr-FR') : ''}</div></div></div></div></div></body></html>`);
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
    
    res.send(`<html><head><title>Détails Activité</title><script src="https://cdn.jsdelivr.net/npm/chart.js"></script><style>* { margin: 0; padding: 0; box-sizing: border-box; } body { font-family: 'SF Pro Display', -apple-system, Arial; background: #000; color: #fff; } .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 50px 30px; border-bottom: 1px solid rgba(255,255,255,0.1); } .header-content { max-width: 1400px; margin: 0 auto; } h1 { font-size: 42px; font-weight: 800; background: linear-gradient(135deg, #ff3366 0%, #6366f1 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 10px; } .date-info { color: rgba(255,255,255,0.6); font-size: 16px; } .container { max-width: 1400px; margin: 0 auto; padding: 40px 20px; } .nav { margin: 30px 0; display: flex; gap: 15px; flex-wrap: wrap; } .nav a { color: rgba(255,255,255,0.7); text-decoration: none; font-weight: 600; padding: 12px 24px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); transition: all 0.3s; } .nav a:hover { color: #ff3366; border-color: rgba(255,51,102,0.5); background: rgba(255,51,102,0.1); } .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 20px; margin: 30px 0; } .stat-box { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; border-radius: 20px; text-align: center; border: 1px solid rgba(255,255,255,0.1); position: relative; overflow: hidden; } .stat-box::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, #ff3366, #6366f1); } .stat-value { font-size: 36px; font-weight: 800; background: linear-gradient(135deg, #ff3366 0%, #6366f1 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 10px 0; } .stat-label { font-size: 12px; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; } .chart-container { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 35px; margin: 30px 0; border-radius: 24px; border: 1px solid rgba(255,255,255,0.1); } .pace-table { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 35px; margin: 30px 0; border-radius: 24px; border: 1px solid rgba(255,255,255,0.1); } h2 { margin-bottom: 25px; font-size: 24px; font-weight: 700; color: rgba(255,255,255,0.9); } table { width: 100%; border-collapse: collapse; } th, td { padding: 16px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.05); } th { background: rgba(255,255,255,0.02); color: rgba(255,255,255,0.8); font-weight: 600; text-transform: uppercase; font-size: 12px; letter-spacing: 1px; } td { color: rgba(255,255,255,0.9); } .fast { color: #10b981; font-weight: bold; } .slow { color: #f59e0b; font-weight: bold; } canvas { max-height: 400px; }</style></head><body><div class="header"><div class="header-content"><h1>${activity.name}</h1><div class="date-info">${date}</div></div></div><div class="container"><div class="nav"><a href="/dashboard">← Dashboard</a></div><div class="stats-grid"><div class="stat-box"><div class="stat-value">${distance} km</div><div class="stat-label">Distance</div></div><div class="stat-box"><div class="stat-value">${duration}:${String(durationSeconds).padStart(2, '0')}</div><div class="stat-label">Durée</div></div><div class="stat-box"><div class="stat-value">${pace} /km</div><div class="stat-label">Allure moyenne</div></div><div class="stat-box"><div class="stat-value">${elevation} m</div><div class="stat-label">Dénivelé</div></div>${avgHR ? `<div class="stat-box"><div class="stat-value">${avgHR} bpm</div><div class="stat-label">FC moyenne</div></div>` : ''}${maxHR ? `<div class="stat-box"><div class="stat-value">${maxHR} bpm</div><div class="stat-label">FC max</div></div>` : ''}</div>${paceByKm.length > 0 ? `<div class="pace-table"><h2>Allure par kilomètre</h2><table><thead><tr><th>Kilomètre</th><th>Allure (min/km)</th></tr></thead><tbody>${paceByKm.map(p => {
      const splitPace = p.pace.split(':');
      const paceInSeconds = parseInt(splitPace[0]) * 60 + parseInt(splitPace[1]);
      const avgPaceInSeconds = paceMinutes * 60 + paceSeconds;
      const className = paceInSeconds < avgPaceInSeconds - 5 ? 'fast' : (paceInSeconds > avgPaceInSeconds + 5 ? 'slow' : '');
      const kmLabel = p.distance == '1.00' ? `Km ${p.km}` : `Km ${p.km} (${p.distance} km)`;
      return `<tr><td>${kmLabel}</td><td class="${className}">${p.pace} /km</td></tr>`;
    }).join('')}</tbody></table></div>` : '<div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 35px; margin: 30px 0; border-radius: 24px; border: 1px solid rgba(255,255,255,0.1);"><p style="color: rgba(255,255,255,0.6);">Les détails par kilomètre ne sont pas disponibles pour cette activité.</p></div>'}${streams.altitude && streams.distance ? `<div class="chart-container"><h2>Profil d'altitude</h2><canvas id="elevationChart"></canvas></div><script>Chart.defaults.color = 'rgba(255,255,255,0.7)'; Chart.defaults.borderColor = 'rgba(255,255,255,0.1)'; new Chart(document.getElementById('elevationChart'), { type: 'line', data: { labels: ${JSON.stringify(streams.distance.data.map(d => (d/1000).toFixed(1)))}, datasets: [{ label: 'Altitude (m)', data: ${JSON.stringify(streams.altitude.data)}, backgroundColor: function(context) { const gradient = context.chart.ctx.createLinearGradient(0, 0, 0, 400); gradient.addColorStop(0, 'rgba(139, 92, 246, 0.3)'); gradient.addColorStop(1, 'rgba(99, 102, 241, 0.1)'); return gradient; }, borderColor: 'rgba(139, 92, 246, 1)', borderWidth: 3, fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: 'rgba(139, 92, 246, 1)', pointBorderColor: '#fff', pointBorderWidth: 2 }] }, options: { responsive: true, plugins: { legend: { labels: { font: { size: 14 } } } }, scales: { x: { grid: { color: 'rgba(255,255,255,0.05)' }, title: { display: true, text: 'Distance (km)', font: { size: 14 } } }, y: { grid: { color: 'rgba(255,255,255,0.05)' }, title: { display: true, text: 'Altitude (m)', font: { size: 14 } } } } } });</script>` : ''}${streams.heartrate ? `<div class="chart-container"><h2>Fréquence cardiaque</h2><canvas id="hrChart"></canvas></div><script>new Chart(document.getElementById('hrChart'), { type: 'line', data: { labels: ${JSON.stringify(streams.time.data.map(t => Math.floor(t/60)))}, datasets: [{ label: 'BPM', data: ${JSON.stringify(streams.heartrate.data)}, backgroundColor: function(context) { const gradient = context.chart.ctx.createLinearGradient(0, 0, 0, 400); gradient.addColorStop(0, 'rgba(239, 68, 68, 0.3)'); gradient.addColorStop(1, 'rgba(220, 38, 38, 0.1)'); return gradient; }, borderColor: 'rgba(239, 68, 68, 1)', borderWidth: 3, fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: 'rgba(239, 68, 68, 1)', pointBorderColor: '#fff', pointBorderWidth: 2 }] }, options: { responsive: true, plugins: { legend: { labels: { font: { size: 14 } } } }, scales: { x: { grid: { color: 'rgba(255,255,255,0.05)' }, title: { display: true, text: 'Temps (min)', font: { size: 14 } } }, y: { grid: { color: 'rgba(255,255,255,0.05)' }, title: { display: true, text: 'BPM', font: { size: 14 } } } } } });</script>` : ''}</div></body></html>`);
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

  const raceDate = new Date('2026-10-02');
  const today = new Date();
  const weeksUntilRace = Math.ceil((raceDate - today) / (7 * 24 * 60 * 60 * 1000));
  
  // Objectif : 1h55 sur semi = 5:27/km
  const targetPace = '5:27';
  const targetTime = '1h55';
  
  // Programme adapté pour 1h55 (allure ~5:27/km)
  const weeklyPlan = [
    { week: 1, volume: 30, sessions: ['Repos', '6km facile 6:00/km', '6km endurance 5:50/km', 'Repos', '6km facile', 'Repos', '10km sortie longue 6:10/km'] },
    { week: 2, volume: 35, sessions: ['Repos', '7km facile', '8x400m à 5:00/km', 'Repos', '7km endurance', 'Repos', '12km sortie longue'] },
    { week: 3, volume: 38, sessions: ['Repos', '7km facile', '8km endurance', 'Repos', '10x400m VMA 4:50/km', 'Repos', '13km sortie longue'] },
    { week: 4, volume: 28, sessions: ['Repos', '6km récup', '6km facile', 'Repos', '5km facile', 'Repos', '9km léger (semaine récup)'] },
    { week: 5, volume: 42, sessions: ['Repos', '8km facile', '5x1000m à 5:10/km', 'Repos', '8km endurance', 'Repos', '15km sortie longue'] },
    { week: 6, volume: 45, sessions: ['Repos', '8km facile', '6x1000m seuil 5:15/km', 'Repos', '9km endurance', 'Repos', '16km sortie longue'] },
    { week: 7, volume: 48, sessions: ['Repos', '8km facile', '3x2000m à 5:20/km', 'Repos', '10km endurance', 'Repos', '18km sortie longue'] },
    { week: 8, volume: 32, sessions: ['Repos', '7km récup', '6km facile', 'Repos', '6km facile', 'Repos', '10km léger (semaine récup)'] },
    { week: 9, volume: 52, sessions: ['Repos', '9km facile', '10x400m VMA', 'Repos', '10km endurance', 'Repos', '20km sortie longue 6:00/km'] },
    { week: 10, volume: 55, sessions: ['Repos', '9km facile', '2x3000m seuil 5:20/km', 'Repos', '10km endurance', 'Repos', '21km sortie longue (distance course !)'] },
    { week: 11, volume: 58, sessions: ['Repos', '10km facile', '15km allure semi 5:30/km', 'Repos', '10km endurance', 'Repos', '19km sortie longue'] },
    { week: 12, volume: 38, sessions: ['Repos', '7km récup', '7km facile', 'Repos', '7km facile', 'Repos', '12km léger (semaine récup)'] },
    { week: 13, volume: 52, sessions: ['Repos', '9km facile', '3x3000m à 5:20/km', 'Repos', '10km endurance', 'Repos', '20km sortie longue'] },
    { week: 14, volume: 48, sessions: ['Repos', '8km facile', '18km allure objectif 5:27/km', 'Repos', '8km endurance', 'Repos', '12km léger'] },
    { week: 15, volume: 38, sessions: ['Repos', '7km facile', '6x1000m à 5:10/km', 'Repos', '6km facile', 'Repos', '10km affûtage'] },
    { week: 16, volume: 28, sessions: ['Repos', '5km facile', '3km + 5x400m', 'Repos', '4km très facile', 'Repos', '🏁 COURSE Run In Lyon - Objectif 1h55 !'] }
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
  
  res.send(`<html><head><title>Run In Lyon 2026</title><style>* { margin: 0; padding: 0; box-sizing: border-box; } body { font-family: 'SF Pro Display', -apple-system, Arial; background: #000; color: #fff; } .header { background: linear-gradient(135deg, #ff3366 0%, #ff6b9d 100%); padding: 60px 30px; text-align: center; position: relative; overflow: hidden; } .header::before { content: ''; position: absolute; top: -50%; right: -20%; width: 500px; height: 500px; background: rgba(255,255,255,0.1); border-radius: 50%; } .race-logo { font-size: 80px; margin-bottom: 20px; animation: float 3s ease-in-out infinite; } @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } } .header h1 { font-size: 56px; font-weight: 800; margin: 15px 0; letter-spacing: -2px; } .header p { font-size: 22px; opacity: 0.95; font-weight: 300; } .countdown { font-size: 72px; font-weight: 800; margin: 30px 0; background: linear-gradient(135deg, #fff 0%, #ffd4e5 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; text-shadow: 0 0 30px rgba(255,255,255,0.5); } .target-banner { background: linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%); padding: 25px; text-align: center; font-size: 28px; font-weight: 700; } .container { max-width: 1400px; margin: 0 auto; padding: 40px 20px; } .stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 25px; margin: 40px 0; } .stat-card { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 35px; border-radius: 24px; text-align: center; border: 1px solid rgba(255,255,255,0.1); position: relative; overflow: hidden; transition: transform 0.3s; } .stat-card:hover { transform: translateY(-5px); } .stat-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, #ff3366, #ff6b9d, #6366f1); } .stat-value { font-size: 56px; font-weight: 800; background: linear-gradient(135deg, #ff3366 0%, #ff6b9d 50%, #6366f1 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 15px 0; } .stat-label { color: rgba(255,255,255,0.7); font-size: 15px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; } .fire-emoji { font-size: 36px; } h2 { color: #fff; margin: 60px 0 30px 0; font-size: 36px; font-weight: 800; } .week-card { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 35px; margin: 25px 0; border-radius: 24px; border: 1px solid rgba(255,255,255,0.1); transition: all 0.3s; } .week-card:hover { border-color: rgba(255,51,102,0.5); box-shadow: 0 10px 40px rgba(255,51,102,0.2); } .week-card.current-week { border: 2px solid #ff3366; box-shadow: 0 0 30px rgba(255,51,102,0.4); } .week-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; padding-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); } .week-title { font-size: 24px; font-weight: 700; color: #fff; } .week-volume { background: linear-gradient(135deg, #ff3366 0%, #ff6b9d 100%); color: white; padding: 10px 20px; border-radius: 20px; font-size: 16px; font-weight: 700; } .sessions-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 15px; } .session-day { background: rgba(255,255,255,0.05); padding: 20px 12px; border-radius: 16px; text-align: center; cursor: pointer; transition: all 0.3s; border: 2px solid transparent; } .session-day:hover:not(.rest) { background: rgba(255,51,102,0.1); border-color: #ff3366; transform: translateY(-3px); } .session-day.completed { background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-color: #10b981; } .session-day.rest { background: rgba(255,255,255,0.02); opacity: 0.5; cursor: default; } .day-name { font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.6); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px; } .session-name { font-size: 13px; color: #fff; line-height: 1.5; font-weight: 500; } .check-icon { font-size: 28px; color: #fff; margin-top: 8px; } .tips-section { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 40px; margin: 50px 0; border-radius: 24px; } .tips-section h3 { color: #fff; margin-bottom: 25px; font-size: 28px; } .tips-section ul { line-height: 2.8; color: rgba(255,255,255,0.95); font-size: 16px; list-style: none; } .tips-section li { padding-left: 35px; position: relative; } .tips-section li::before { content: '→'; position: absolute; left: 0; color: #fff; font-weight: bold; font-size: 20px; } .nav { margin: 30px 0; } .nav a { color: rgba(255,255,255,0.7); text-decoration: none; margin-right: 25px; font-weight: 600; transition: color 0.3s; } .nav a:hover { color: #ff3366; }</style></head><body><div class="header"><div class="race-logo">🏃‍♂️</div><h1>Run In Lyon 2026</h1><p>Semi-Marathon • 2 Octobre 2026 • 21.1 km</p><div class="countdown">${weeksUntilRace} semaines</div></div><div class="target-banner">🎯 Objectif : ${targetTime} • Allure : ${targetPace}/km</div><div class="container"><div class="nav"><a href="/dashboard">← Dashboard</a><a href="/programme">Autres programmes</a></div><div class="stats-row"><div class="stat-card"><div class="stat-value">${completedDays}</div><div class="stat-label">Séances complétées</div></div><div class="stat-card"><div class="stat-value"><span class="fire-emoji">🔥</span> ${currentStreak}</div><div class="stat-label">Chaîne actuelle</div></div><div class="stat-card"><div class="stat-value"><span class="fire-emoji">⭐</span> ${maxStreak}</div><div class="stat-label">Record de chaîne</div></div><div class="stat-card"><div class="stat-value">${Math.round((completedDays / (16 * 7)) * 100)}%</div><div class="stat-label">Progression programme</div></div></div><h2>Programme d'entraînement 16 semaines</h2>${weeklyPlan.map((week, weekIdx) => {
    const isCurrentWeek = weekIdx === Math.min(weeklyPlan.length - 1, Math.max(0, 16 - weeksUntilRace));
    return `<div class="week-card ${isCurrentWeek ? 'current-week' : ''}"><div class="week-header"><div class="week-title">Semaine ${week.week} ${isCurrentWeek ? '← Semaine actuelle' : ''}</div><div class="week-volume">${week.volume} km</div></div><div class="sessions-grid">${week.sessions.map((session, dayIdx) => {
      const dayKey = `w${week.week}d${dayIdx}`;
      const isCompleted = trainingProgress[athleteId][dayKey];
      const isRest = session.toLowerCase().includes('repos');
      const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
      return `<div class="session-day ${isCompleted ? 'completed' : ''} ${isRest ? 'rest' : ''}" onclick="${isRest ? '' : `toggleSession('${dayKey}')`}"><div class="day-name">${dayNames[dayIdx]}</div><div class="session-name">${session}</div>${isCompleted ? '<div class="check-icon">✓</div>' : ''}</div>`;
    }).join('')}</div></div>`;
  }).join('')}<div class="tips-section"><h3>💡 Plan pour réussir 1h55</h3><ul><li><strong>Allure cible : ${targetPace}/km</strong> - Entraîne-toi à maintenir cette allure</li><li><strong>VMA nécessaire : ~17-18 km/h</strong> - Travaille ta vitesse avec les séances de fractionné</li><li><strong>Seuil anaérobie</strong> - Les séances à 5:15-5:20/km sont cruciales</li><li><strong>Volume progressif</strong> - Monte jusqu'à 58 km/semaine en S11</li><li><strong>Sorties longues</strong> - Jusqu'à 21 km pour habituer le corps</li><li><strong>Récupération</strong> - Les semaines allégées sont essentielles</li><li><strong>Nutrition</strong> - Teste ton ravitaillement pendant l'entraînement</li><li><strong>Mental</strong> - Visualise ta course, découpe-la en segments</li></ul></div></div><script>function toggleSession(dayKey) { fetch('/toggle-session?key=' + dayKey + '&athlete=' + '${athleteId}').then(() => location.reload()); }</script></body></html>`);
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