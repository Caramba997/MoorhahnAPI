const express = require('express'),
      router = express.Router(),
      bodyParser = require('body-parser'),
      cors = require('cors'),
      settings = require('./config/api').settings,
      Highscore = require('./model/highscore');

require('dotenv').config();
require('./config/database.js').connect();

var app = express();

app.use(bodyParser.json({
  limit: '10mb'
}));
app.use(cors({
  origin: (origin, callback) => {
    if (settings.allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  allowedHeaders: 'Content-Type, Set-Cookie'
}));

router.post('/checkscore', async function (req, res) {
  const { difficulty, gamemode, points } = req.body;
  if (!(difficulty && gamemode && points)) return res.status(400).json({ msg: 'Parameter is missing' });
  if (!['easy', 'normal', 'hard', 'pro'].includes(difficulty)) return res.status(400).json({ msg: 'Illegal difficulty' });
  if (!['classic', 'deluxe'].includes(gamemode)) return res.status(400).json({ msg: 'Illegal gamemode' });

  const highscore = await Highscore.findOne({ difficulty: difficulty, gamemode: gamemode });
  let result = {
    highscore: false,
    place: 0
  };
  if (highscore) {
    let isHighscore = false;
    for (let i = 0; i < highscore.scores.length; i++) {
      const current = highscore.scores[i];
      if (current.score < points) {
        result.highscore = true;
        result.place = i + 1;
        isHighscore = true;
        break;
      }
    }
    if (highscore.scores.length < settings.maxHighscores && !isHighscore)  {
      result.highscore = true;
      result.place = highscore.scores.length + 1;
    }
  }
  else {
    result.highscore = true;
    result.place = 1;
  }

  return res.status(200).json(result);
});

router.post('/highscore', async function (req, res) {
  const { difficulty, gamemode, points, username, checksum } = req.body;
  if (!(difficulty && gamemode && points && username && checksum)) return res.status(400).json({ msg: 'Parameter is missing' });
  if (!['easy', 'normal', 'hard', 'pro'].includes(difficulty)) return res.status(400).json({ msg: 'Illegal difficulty' });
  if (!['classic', 'deluxe'].includes(gamemode)) return res.status(400).json({ msg: 'Illegal gamemode' });

  let timestamp;
  try {
    timestamp = checksum.split(':')[0];
    const pointsArr = checksum.split('p'),
          pointsAcc = pointsArr.reduce((prev, curr, index) => {
            return (index > 0) ? prev + parseInt(curr) : prev;
          }, 0);
    if (pointsAcc !== parseInt(points)) return res.status(400).json({ msg: 'Illegal score, checksum is incorrect' });
  }
  catch (e) {
    return res.status(400).json({ msg: 'Checksum validation failed' });
  }

  const highscore = await Highscore.findOne({ difficulty: difficulty, gamemode: gamemode });
  let result = null;
  if (highscore) {
    result = highscore;
    let isHighscore = false;
    for (let i = 0; i < highscore.scores.length; i++) {
      const current = highscore.scores[i];
      if (current.timestamp === timestamp) return res.status(400).json({ msg: 'Highscore cannot be saved twice' });
      if (current.score < points) {
        highscore.scores.splice(i, 0, {
          username: username,
          score: points,
          timestamp: timestamp
        });
        isHighscore = true;
        break;
      }
    }
    if (highscore.scores.length > settings.maxHighscores) {
      highscore.scores.splice(settings.maxHighscores);
    }
    else if (highscore.scores.length < settings.maxHighscores && !isHighscore)  {
      highscore.scores.push({
        username: username,
        score: points,
        timestamp: timestamp
      });
    }
    highscore.save();
  }
  else {
    result = await Highscore.create({
      difficulty: difficulty,
      gamemode: gamemode,
      scores: [
        {
          username: username,
          score: points,
          timestamp: timestamp
        }
      ],
    });
  }

  return res.status(200).json(result);
});

router.get('/highscores', async function (req, res) {
  try {
    const highscores = await Highscore.find({});
    if (highscores) return res.status(200).json(highscores);

    return res.status(404).json({ msg: 'Failed finding highscores' });
  } catch (err) {
    console.error(err);
  }
});

app.use(settings.path, router);

module.exports = app;