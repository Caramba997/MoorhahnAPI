const mongoose = require("mongoose");

const highscoreSchema = new mongoose.Schema({
  difficulty: { type: String },
  gamemode: { type: String },
  scores: [
    {
      username: { type: String },
      score: { type: Number }
    }
  ]
}, {
  collection: 'highscores'
});

module.exports = mongoose.model("highscore", highscoreSchema);